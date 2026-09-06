const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const tls = require("node:tls");
const vm = require("node:vm");
const { sanitizeMotionInput, normalizeDirectorStatus, bootstrapHtml, motionHtml } = require("../electron/phone-motion-server.cjs");
const { extensionConfig, localCaConfig, pemCertificateToDer, isCertificateAuthority } = require("../electron/phone-remote-tls.cjs");

const root = path.join(__dirname, "..");
const phoneMotionUx = fs.readFileSync(path.join(root, "electron", "phone-motion-camera-ux.js"), "utf8");
const viewfinderServer = fs.readFileSync(path.join(root, "electron", "phone-director-viewfinder.cjs"), "utf8");
const focalPatch = fs.readFileSync(path.join(root, "electron", "phone-motion-core-absolute-focal.js"), "utf8");
const commandPatch = fs.readFileSync(path.join(root, "electron", "phone-handheld-command-ux.js"), "utf8");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

test("motion transport clamps hostile input and keeps phone lens absolute", () => {
  const value = sanitizeMotionInput({
    seq:-4,
    command:"toggle-record",
    commandId:"not allowed!",
    focalMm:999,
    rigProfile:"nonsense",
    motion:{
      enabled:true,calibrationId:8,screenAngle:999,
      orientation:{alpha:999,beta:-999,gamma:999,absolute:true},
      acceleration:{x:999,y:-999,z:Infinity},
      visual:{x:99,y:-99,z:99,confidence:4,metric:true},
    },
  });
  assert.equal(value.seq,0);
  assert.equal(value.command,"toggle-record");
  assert.equal(value.commandId,"");
  assert.equal(value.focal,0);
  assert.equal(value.focalMm,300);
  assert.equal(value.motion.focalMm,300);
  assert.equal(value.rigProfile,"handheld");
  assert.equal(value.motion.rigProfile,"handheld");
  assert.equal(value.motion.screenAngle,360);
  assert.deepEqual(value.motion.orientation,{alpha:360,beta:-180,gamma:90,absolute:true});
  assert.deepEqual(value.motion.acceleration,{x:100,y:-100,z:0});
  assert.deepEqual(value.motion.visual,{x:8,y:-8,z:8,confidence:1,metric:false});
});

test("valid lens, rig and command acknowledgement identity survive sanitation", () => {
  const value = sanitizeMotionInput({
    seq:41,
    command:"stop",
    commandId:"cmd_take_0041",
    focalMm:50,
    rigProfile:"heavy",
    motion:{enabled:true},
  });
  assert.equal(value.seq,41);
  assert.equal(value.command,"stop");
  assert.equal(value.commandId,"cmd_take_0041");
  assert.equal(value.focalMm,50);
  assert.equal(value.motion.focalMm,50);
  assert.equal(value.rigProfile,"heavy");
});

test("WebXR is the only transport path allowed to claim metric 6DoF", () => {
  const value = sanitizeMotionInput({
    motion:{spatial:{mode:"webxr",metric:true,position:{x:120,y:-120,z:2.25},orientation:{x:0,y:2,z:0,w:2},confidence:3}},
  });
  assert.equal(value.motion.spatial.mode,"webxr");
  assert.equal(value.motion.spatial.metric,true);
  assert.deepEqual(value.motion.spatial.position,{x:50,y:-50,z:2.25});
  assert.equal(value.motion.spatial.confidence,1);
  assert.ok(Math.abs(value.motion.spatial.orientation.y - Math.SQRT1_2) < 1e-9);
  assert.ok(Math.abs(value.motion.spatial.orientation.w - Math.SQRT1_2) < 1e-9);
  const spoofed = sanitizeMotionInput({motion:{spatial:{mode:"visual-flow",metric:true,position:{x:1,y:2,z:3},confidence:1}}});
  assert.equal(spoofed.motion.spatial.mode,"none");
  assert.equal(spoofed.motion.spatial.metric,false);
});

test("bootstrap introduces a virtual Director Viewfinder", () => {
  const html = bootstrapHtml("token", "https://192.168.0.2:4443/?token=token", "AA:BB", "");
  assert.match(html,/Director Viewfinder/);
  assert.match(html,/FrisFrame 로컬 CA 설치/);
  assert.match(html,/가상 핸드헬드 카메라/);
  assert.match(html,/후면 카메라는 움직임 추적 센서/);
  assert.match(html,/AA:BB/);
});

test("phone permissions and WebXR start only from explicit user buttons", () => {
  const html = motionHtml("token");
  assert.match(html,/id="startBtn">START CAMERA/);
  assert.match(html,/id="xrBtn"[^>]*>START 6DoF/);
  assert.match(html,/Promise\.all\(\[permission\(window\.DeviceOrientationEvent\),permission\(window\.DeviceMotionEvent\)\]\)/);
  assert.match(html,/startBtn"\)\.addEventListener\("click",startCameraFromGesture\)/);
  assert.match(html,/xrBtn"\)\.addEventListener\("click",startXRFromGesture\)/);
  assert.match(html,/navigator\.xr\.requestSession\("immersive-ar"/);
  assert.doesNotMatch(html,/start\(\)\.then\(tryXR\)/);
  assert.doesNotMatch(html,/setInterval\(send,24\)/);
});

test("phone exposes absolute 24 35 50 85 mm presets and no local smoothing layer", () => {
  const html = motionHtml("token");
  for (const focal of [24,35,50,85]) assert.match(html,new RegExp(`data-focal-mm=\\"${focal}\\"`));
  assert.match(html,/selectedFocalMm=35/);
  assert.match(html,/focalMm:selectedFocalMm/);
  assert.match(html,/rigProfile/);
  assert.doesNotMatch(html,/lastFiltered|angleAlpha|positionHalfLifeMs/);
});

test("fallback visual flow removes orientation-driven image motion before translation", () => {
  const html = motionHtml("token");
  assert.match(html,/rotationCompensatedResidual/);
  assert.match(html,/Math\.abs\(flow\.dx\)-rotationalX/);
  assert.match(html,/Math\.abs\(flow\.dy\)-rotationalY/);
  assert.match(html,/previousOrientation/);
  assert.match(html,/Visual Flow는 회전 성분을 제거한 상대 이동/);
});

test("XR mode releases the regular rear-camera tracker before immersive AR", () => {
  const html = motionHtml("token");
  const stopIndex = html.indexOf("stopTracker();const c=document.createElement");
  const requestIndex = html.indexOf('navigator.xr.requestSession("immersive-ar"');
  assert.ok(stopIndex >= 0 && requestIndex > stopIndex);
});

test("REC and STOP are retried until a command-id acknowledgement arrives", () => {
  const html = motionHtml("token");
  assert.match(html,/pendingCommand/);
  assert.match(html,/commandId:cmd\?\.id/);
  assert.match(html,/ack\.ack===cmd\.id/);
  assert.match(html,/while\(alive\)/);
  assert.doesNotMatch(html,/command="";try/);
  assert.match(viewfinderServer,/commandAcks = new Map/);
  assert.match(viewfinderServer,/commandAcks\.has\(input\.commandId\)/);
  assert.match(viewfinderServer,/duplicate:true/);
});

test("motion packets reject stale sequence values and renderer patches install once", () => {
  assert.match(viewfinderServer,/lastAcceptedSeq/);
  assert.match(viewfinderServer,/input\.seq <= lastAcceptedSeq/);
  assert.match(viewfinderServer,/ensureRendererPatches/);
  assert.match(viewfinderServer,/phone-motion-core-absolute-focal\.js/);
  assert.match(viewfinderServer,/phone-handheld-command-ux\.js/);
});

test("viewfinder capture targets the clean camera canvas before its UI container", () => {
  assert.match(viewfinderServer,/document\.getElementById\("cameraFrameCanvas"\)\|\|document\.getElementById\("cameraFrame"\)/);
  assert.match(viewfinderServer,/webContents\.capturePage/);
  assert.match(viewfinderServer,/multipart\/x-mixed-replace/);
  assert.match(viewfinderServer,/authorized\(requestUrl\)/);
});

test("viewfinder targets 30 fps and drops stale frames under backpressure", () => {
  assert.match(viewfinderServer,/VIEWFINDER_INTERVAL_MS = 33/);
  assert.match(viewfinderServer,/VIEWFINDER_JPEG_QUALITY = 62/);
  assert.match(viewfinderServer,/VIEWFINDER_MAX_WIDTH = 854/);
  assert.match(viewfinderServer,/client\.blocked/);
  assert.match(viewfinderServer,/droppedFrames \+= 1/);
  assert.match(viewfinderServer,/response\.once\("drain"/);
  assert.match(viewfinderServer,/response\.socket\?\.setNoDelay\?\.\(true\)/);
  assert.match(viewfinderServer,/Buffer\.concat\(\[header, frame/);
  assert.match(viewfinderServer,/X-FrisFrame-Frame-Seq/);
  assert.match(viewfinderServer,/latestFrameFirst:true/);
});

test("phone HUD exposes measured viewfinder fps and latency telemetry", () => {
  const html = motionHtml("token");
  assert.match(html,/id="vfFps"/);
  assert.match(html,/id="latency"/);
  assert.match(html,/pollLinkTelemetry/);
  assert.match(html,/\/status\?token=/);
  assert.match(html,/data\.serverNow/);
  assert.match(html,/data\.lastFrameAt/);
  assert.match(html,/data\.measuredFps/);
  assert.match(viewfinderServer,/serverNow:Date\.now\(\)/);
  assert.match(viewfinderServer,/lastFrameSeq/);
  assert.match(viewfinderServer,/captureMs:lastCaptureDurationMs/);
  assert.match(viewfinderServer,/measuredFps:/);
  assert.match(viewfinderServer,/droppedFrames:totalDroppedFrames/);
  assert.match(viewfinderServer,/latencyTelemetry:true/);
});

test("absolute focal renderer patch overrides anchor focal in every physical pose", () => {
  const sandbox = {
    document:{documentElement:{dataset:{}}},
    window:{FrisFramePhoneMotionCore:Object.freeze({
      clamp:(value,min,max)=>Math.min(max,Math.max(min,Number(value)||0)),
      derivePose:()=>({x:0,y:0,height:1.6,panDeg:0,tiltDeg:0,focal:35}),
    })},
  };
  vm.runInNewContext(focalPatch,sandbox);
  const pose = sandbox.window.FrisFramePhoneMotionCore.derivePose({}, {focalMm:85}, {});
  assert.equal(pose.focal,85);
});

test("phone rig profile delegates stabilization to desktop exactly once per profile", () => {
  let handler = null;
  const calls = [];
  const camera = {stabilization:"handheld",setStabilization(value){calls.push(value);this.stabilization=value;}};
  const sandbox = {
    document:{documentElement:{dataset:{}}},
    window:{
      FrisFrameCameraOperatorInputs:{mode:"phone"},
      FrisFramePhoneMotionCamera:camera,
      addEventListener(_name,fn){handler=fn;},
    },
  };
  vm.runInNewContext(commandPatch,sandbox);
  handler({detail:{rigProfile:"heavy"}});
  handler({detail:{rigProfile:"heavy"}});
  handler({detail:{rigProfile:"handheld"}});
  assert.deepEqual(calls,["cinema","handheld"]);
});

test("desktop remains the single pose stabilizer and still documents metric boundaries", () => {
  assert.match(phoneMotionUx,/createPoseStabilizer/);
  assert.match(phoneMotionUx,/WebXR 모드만 물리적 local-space 위치를 meter로 사용합니다/);
  assert.match(phoneMotionUx,/Visual Flow는 실제 이동거리 측정값이 아니라/);
});

test("handheld compatibility patches are shipped in the desktop package", () => {
  assert.ok(packageJson.build.files.includes("electron/phone-motion-core-absolute-focal.js"));
  assert.ok(packageJson.build.files.includes("electron/phone-handheld-command-ux.js"));
});


test("director status normalization keeps REC state, timecode inputs, focal and rig bounded", () => {
  const value = normalizeDirectorStatus({
    mode:"recording",
    playheadSeconds:12.345,
    durationSeconds:60,
    focalMm:500,
    rigProfile:"cinema",
    connected:true,
  });
  assert.equal(value.mode,"recording");
  assert.equal(value.recording,true);
  assert.equal(value.standby,false);
  assert.equal(value.playheadSeconds,12.345);
  assert.equal(value.durationSeconds,60);
  assert.equal(value.focalMm,300);
  assert.equal(value.rigProfile,"heavy");
  assert.equal(value.connected,true);
});

test("phone Director Viewfinder renders renderer-backed REC STBY timecode and acknowledgement HUD", () => {
  const html = motionHtml("token");
  assert.match(html,/id="recordState">LIVE/);
  assert.match(html,/id="timecode">00:00:00:00/);
  assert.match(html,/id="ackHud">/);
  assert.match(html,/formatTimecode/);
  assert.match(html,/directorPlayheadNow/);
  assert.match(html,/applyDirectorStatus/);
  assert.match(html,/requestAnimationFrame\(renderDirectorHud\)/);
  assert.match(viewfinderServer,/VIEWFINDER_TELEMETRY_INTERVAL_MS = 200/);
});

test("status backchannel reads authoritative Camera Operator state and reports the latest command ACK", () => {
  assert.match(viewfinderServer,/async function readRendererDirectorStatus/);
  assert.match(viewfinderServer,/FrisFrameCameraOperator/);
  assert.match(viewfinderServer,/playheadSeconds:Number\(appState\?\.motion\?\.playhead/);
  assert.match(viewfinderServer,/focalMm:Number\(appState\?\.camera\?\.focal/);
  assert.match(viewfinderServer,/lastCommandAck/);
  assert.match(viewfinderServer,/recordBackchannel:true/);
  assert.match(viewfinderServer,/timecodeBackchannel:true/);
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
