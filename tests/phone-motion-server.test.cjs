const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const tls = require("node:tls");
const { sanitizeMotionInput, bootstrapHtml, motionHtml } = require("../electron/phone-motion-server.cjs");
const { extensionConfig, localCaConfig, pemCertificateToDer, isCertificateAuthority } = require("../electron/phone-remote-tls.cjs");

const phoneMotionUx = fs.readFileSync(path.join(__dirname, "..", "electron", "phone-motion-camera-ux.js"), "utf8");
const viewfinderServer = fs.readFileSync(path.join(__dirname, "..", "electron", "phone-director-viewfinder.cjs"), "utf8");

test("motion transport clamps hostile sensor input and never marks visual flow metric", () => {
  const value = sanitizeMotionInput({
    seq:-4,
    command:"toggle-record",
    focal:9,
    motion:{
      enabled:true,calibrationId:8,screenAngle:999,
      orientation:{alpha:999,beta:-999,gamma:999,absolute:true},
      acceleration:{x:999,y:-999,z:Infinity},
      visual:{x:99,y:-99,z:99,confidence:4,metric:true},
    },
  });
  assert.equal(value.seq,0);
  assert.equal(value.command,"toggle-record");
  assert.equal(value.focal,1);
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

test("bootstrap introduces the phone as a Director Viewfinder rather than a visible rear-camera controller", () => {
  const html = bootstrapHtml("token", "https://192.168.0.2:4443/?token=token", "AA:BB", "");
  assert.match(html,/Director Viewfinder/);
  assert.match(html,/FrisFrame 로컬 CA 설치/);
  assert.match(html,/가상 핸드헬드 카메라/);
  assert.match(html,/실제 후면 카메라 대신 FrisFrame 가상 카메라 프레임/);
  assert.match(html,/AA:BB/);
});

test("phone page uses the FrisFrame virtual frame as the visible viewfinder and keeps the real camera hidden for tracking", () => {
  const html = motionHtml("token");
  assert.match(html,/DIRECTOR VIEWFINDER/);
  assert.match(html,/id="feed" class="feed"/);
  assert.match(html,/\/viewfinder\.mjpeg\?token=/);
  assert.match(html,/id="tracker" class="tracker"/);
  assert.match(html,/getUserMedia/);
  assert.match(html,/deviceorientation/);
  assert.match(html,/devicemotion/);
  assert.match(html,/calibrationId/);
  assert.match(html,/HANDHELD/);
  assert.match(html,/HEAVY/);
  assert.match(html,/RAW/);
  assert.match(html,/RECENTER/);
  assert.match(html,/navigator\.xr\.isSessionSupported\("immersive-ar"\)/);
  assert.match(html,/navigator\.xr\.requestSession\("immersive-ar"/);
  assert.match(html,/requestReferenceSpace\("local"\)/);
  assert.match(html,/getViewerPose\(xrSpace\)/);
  assert.match(html,/mode:"webxr",metric:true/);
  assert.doesNotMatch(html,/toDataURL|base64/);
});

test("Director Viewfinder bridge captures only the camera surface and streams a token-protected MJPEG feed", () => {
  assert.match(viewfinderServer,/cameraFrameRect/);
  assert.match(viewfinderServer,/document\.getElementById\("cameraFrame"\)/);
  assert.match(viewfinderServer,/webContents\.capturePage/);
  assert.match(viewfinderServer,/multipart\/x-mixed-replace/);
  assert.match(viewfinderServer,/viewfinder\.mjpeg/);
  assert.match(viewfinderServer,/authorized\(requestUrl\)/);
  assert.match(viewfinderServer,/VIEWFINDER_INTERVAL_MS = 66/);
  assert.match(viewfinderServer,/VIEWFINDER_MAX_WIDTH = 960/);
});

test("phone-side rig keeps RAW immediate, HANDHELD responsive, and HEAVY more inertial", () => {
  const html = motionHtml("token");
  assert.match(html,/rig==="raw"\?1/);
  assert.match(html,/rig==="heavy"\?1-Math\.pow\(\.5,dt\/145\)/);
  assert.match(html,/dt\/48/);
  assert.match(html,/angleStep/);
  assert.match(html,/lastFiltered=null/);
});

test("Physical Camera UX still explains metric boundaries and exposes no image serialization path", () => {
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
