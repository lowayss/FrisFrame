const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const tls = require("node:tls");
const { sanitizeMotionInput, bootstrapHtml, motionHtml } = require("../electron/phone-motion-server.cjs");
const precision = require("../electron/phone-motion-server-v2.cjs");
const { extensionConfig, localCaConfig, pemCertificateToDer, isCertificateAuthority } = require("../electron/phone-remote-tls.cjs");

const phoneMotionUx = fs.readFileSync(path.join(__dirname, "..", "electron", "phone-motion-camera-ux.js"), "utf8");
const phoneMotionIpcUx = fs.readFileSync(path.join(__dirname, "..", "electron", "phone-motion-ipc-ux.js"), "utf8");
const phoneRemotePreload = fs.readFileSync(path.join(__dirname, "..", "electron", "phone-remote-preload.cjs"), "utf8");
const mainEntry = fs.readFileSync(path.join(__dirname, "..", "electron", "main-entry.cjs"), "utf8");
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"));

test("motion transport clamps hostile sensor input and never marks visual flow metric", () => {
  const value = sanitizeMotionInput({
    seq:-4,
    command:"toggle-record",
    motion:{
      enabled:true,calibrationId:8,screenAngle:999,
      orientation:{alpha:999,beta:-999,gamma:999,absolute:true},
      acceleration:{x:999,y:-999,z:Infinity},
      visual:{x:99,y:-99,z:99,confidence:4,metric:true},
    },
  });
  assert.equal(value.seq,0);
  assert.equal(value.command,"toggle-record");
  assert.equal(value.motion.screenAngle,360);
  assert.deepEqual(value.motion.orientation,{alpha:360,beta:-180,gamma:90,absolute:true});
  assert.deepEqual(value.motion.acceleration,{x:100,y:-100,z:0});
  assert.deepEqual(value.motion.visual,{x:8,y:-8,z:8,confidence:1,metric:false});
  assert.deepEqual(value.motion.spatial,{
    mode:"none",metric:false,
    position:{x:0,y:0,z:0},
    orientation:{x:0,y:0,z:0,w:1},
    confidence:0,
  });
});

test("WebXR spatial input is the only transport path allowed to claim metric 6DoF", () => {
  const value = sanitizeMotionInput({
    motion:{
      enabled:true,
      spatial:{
        mode:"webxr",metric:true,
        position:{x:120,y:-120,z:2.25},
        orientation:{x:0,y:2,z:0,w:2},
        confidence:3,
      },
    },
  });
  assert.equal(value.motion.spatial.mode,"webxr");
  assert.equal(value.motion.spatial.metric,true);
  assert.deepEqual(value.motion.spatial.position,{x:50,y:-50,z:2.25});
  assert.equal(value.motion.spatial.confidence,1);
  assert.ok(Math.abs(value.motion.spatial.orientation.y - Math.SQRT1_2) < 1e-9);
  assert.ok(Math.abs(value.motion.spatial.orientation.w - Math.SQRT1_2) < 1e-9);

  const spoofed = sanitizeMotionInput({
    motion:{spatial:{mode:"visual-flow",metric:true,position:{x:1,y:2,z:3},confidence:1}},
  });
  assert.equal(spoofed.motion.spatial.mode,"none");
  assert.equal(spoofed.motion.spatial.metric,false);
});

test("bootstrap keeps CA onboarding separate from the HTTPS motion controller", () => {
  const html = bootstrapHtml("token", "https://192.168.0.2:4443/?token=token", "AA:BB", "");
  assert.match(html,/FrisFrame 로컬 CA 설치/);
  assert.match(html,/HTTPS 모션 카메라 열기/);
  assert.match(html,/AA:BB/);
  assert.match(html,/WebXR/);
  assert.match(html,/Visual Flow/);
});

test("motion page processes camera frames locally and progressively enables WebXR 6DoF", () => {
  const html = motionHtml("token");
  assert.match(html,/getUserMedia/);
  assert.match(html,/deviceorientation/);
  assert.match(html,/devicemotion/);
  assert.match(html,/calibrationId/);
  assert.match(html,/visual:\{/);
  assert.match(html,/spatial:\{/);
  assert.match(html,/navigator\.xr\.isSessionSupported\("immersive-ar"\)/);
  assert.match(html,/navigator\.xr\.requestSession\("immersive-ar"/);
  assert.match(html,/requestReferenceSpace\("local"\)/);
  assert.match(html,/getViewerPose\(xrSpace\)/);
  assert.match(html,/XRWebGLLayer/);
  assert.match(html,/mode:"webxr",metric:true/);
  assert.match(html,/6DoF WebXR 시작/);
  assert.match(html,/후면 카메라 Visual Flow/);
  assert.doesNotMatch(html,/toDataURL|base64|image\/jpeg|image\/png/);
});

test("precision motion page uses single-flight 60Hz-class transport and anchors XR on the first valid pose", () => {
  const html = precision.motionHtml("token");
  assert.match(html,/sendInFlight/);
  assert.match(html,/sendQueued/);
  assert.match(html,/clientRttMs:lastRttMs/);
  assert.match(html,/keepalive:true/);
  assert.match(html,/setInterval\(\(\)=>\{if\(state\.enabled\|\|command\)send\(\)\},16\)/);
  assert.doesNotMatch(html,/setInterval\(send,33\)/);
  assert.match(html,/timer=setInterval\(track,50\)/);
  assert.match(html,/xrNeedsRecenter=true/);
  assert.match(html,/if\(xrNeedsRecenter\)\{recenter\(\);xrNeedsRecenter=false\}/);
  assert.match(html,/addEventListener\?\.\("reset"/);
  assert.match(html,/state\.spatial=\{\.\.\.state\.spatial,confidence:0\}/);
  assert.match(html,/command="toggle-record";send\(\)/);
  assert.match(html,/command="stop";send\(\)/);
});

test("precision sanitizer carries a bounded session id and phone-observed RTT", () => {
  const value = precision.sanitizeMotionInput({
    sessionId:"phone session!?_01",
    clientRttMs:9999,
    seq:8,
    motion:{enabled:true},
  });
  assert.equal(value.sessionId,"phonesession_01");
  assert.equal(value.clientRttMs,2000);
  assert.equal(value.seq,8);
});

test("latest-only dispatcher rejects reordered packets, coalesces motion and dispatches commands immediately", () => {
  let now = 1000;
  let scheduled = null;
  const sent = [];
  const dispatcher = precision.createLatestDispatcher({
    dispatch:(payload)=>sent.push(payload),
    intervalMs:16,
    now:()=>now,
    setTimer:(callback,delay)=>{scheduled={callback,delay};return scheduled;},
    clearTimer:()=>{scheduled=null;},
  });

  assert.equal(dispatcher.push({sessionId:"a",seq:1}).immediate,true);
  assert.equal(sent.at(-1).seq,1);
  now = 1004;
  assert.equal(dispatcher.push({sessionId:"a",seq:2}).immediate,false);
  assert.equal(scheduled.delay,12);
  now = 1005;
  dispatcher.push({sessionId:"a",seq:3});
  const stale = dispatcher.push({sessionId:"a",seq:2});
  assert.equal(stale.accepted,false);
  assert.equal(stale.reason,"stale-sequence");
  now = 1016;
  const flush = scheduled.callback;
  scheduled = null;
  flush();
  assert.equal(sent.at(-1).seq,3,"only the newest queued motion packet should render");

  now = 1017;
  const command = dispatcher.push({sessionId:"a",seq:4,command:"stop"});
  assert.equal(command.immediate,true);
  assert.equal(sent.at(-1).command,"stop");

  now = 1020;
  const reloaded = dispatcher.push({sessionId:"b",seq:1});
  assert.equal(reloaded.accepted,true,"a reloaded phone page gets a fresh sequence namespace");
});

test("renderer IPC bridge drops stale work, coalesces rendering and forces a fresh anchor on tracking-mode transitions", () => {
  assert.match(phoneRemotePreload,/ipcRenderer\.on\("phone-motion:input"/);
  assert.match(phoneRemotePreload,/onMotionInput/);
  assert.match(phoneMotionIpcUx,/MAX_RENDER_AGE_MS = 100/);
  assert.match(phoneMotionIpcUx,/droppedStaleSequence/);
  assert.match(phoneMotionIpcUx,/droppedRendererAge/);
  assert.match(phoneMotionIpcUx,/requestAnimationFrame\(flush\)/);
  assert.match(phoneMotionIpcUx,/modeEpoch \+= 1/);
  assert.match(phoneMotionIpcUx,/calibrationId:calibrationId \* 1024 \+ modeEpoch/);
  assert.match(phoneMotionIpcUx,/frisframe:phone-remote-input/);
  assert.match(mainEntry,/phone-motion-server-v2\.cjs/);
  assert.match(mainEntry,/phone-motion-ipc-ux\.js/);
  assert.ok(packageJson.build.files.includes("electron/phone-motion-server-v2.cjs"));
  assert.ok(packageJson.build.files.includes("electron/phone-motion-ipc-ux.js"));
});

test("Physical Camera UX explains metric boundaries and exposes no image serialization path", () => {
  assert.match(phoneMotionUx,/WebXR 모드만 물리적 local-space 위치를 meter로 사용합니다/);
  assert.match(phoneMotionUx,/Visual Flow는 실제 이동거리 측정값이 아니라/);
  assert.doesNotMatch(phoneMotionUx,/toDataURL|base64|image\/jpeg|image\/png/);
});

test("TLS SAN configuration includes localhost and LAN IPs", () => {
  const config = extensionConfig(["192.168.0.21","10.0.0.8"]);
  assert.match(config,/DNS\.1=localhost/);
  assert.match(config,/IP\.1=127\.0\.0\.1/);
  assert.match(config,/192\.168\.0\.21/);
  assert.match(config,/10\.0\.0\.8/);
});

test("local CA configuration explicitly marks the certificate as a signing CA", () => {
  const config = localCaConfig();
  assert.match(config,/basicConstraints=critical,CA:TRUE/);
  assert.match(config,/keyUsage=critical,keyCertSign,cRLSign/);
});

test("downloadable local CA is DER X.509 data without PEM or private-key material", () => {
  const pem = tls.rootCertificates[0];
  assert.equal(isCertificateAuthority(pem),true);
  const der = pemCertificateToDer(pem);
  assert.ok(Buffer.isBuffer(der));
  assert.equal(der[0],0x30);
  assert.ok(der.length > 256);
  const text = der.toString("latin1");
  assert.doesNotMatch(text,/BEGIN CERTIFICATE/);
  assert.doesNotMatch(text,/PRIVATE KEY/);
});