const test = require("node:test");
const assert = require("node:assert/strict");
const { sanitizeMotionInput, bootstrapHtml, motionHtml } = require("../electron/phone-motion-server.cjs");
const { extensionConfig } = require("../electron/phone-remote-tls.cjs");

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
});

test("bootstrap keeps CA onboarding separate from the HTTPS motion controller", () => {
  const html = bootstrapHtml("token", "https://192.168.0.2:4443/?token=token", "AA:BB", "");
  assert.match(html,/FrisFrame 로컬 CA 설치/);
  assert.match(html,/HTTPS 모션 카메라 열기/);
  assert.match(html,/AA:BB/);
});

test("motion page processes camera frames locally and sends only derived motion fields", () => {
  const html = motionHtml("token");
  assert.match(html,/getUserMedia/);
  assert.match(html,/deviceorientation/);
  assert.match(html,/devicemotion/);
  assert.match(html,/calibrationId/);
  assert.match(html,/visual:\{/);
  assert.doesNotMatch(html,/toDataURL|base64|image\/jpeg|image\/png/);
  assert.match(html,/카메라 영상은 이 휴대폰 안에서만/);
});

test("TLS SAN configuration includes localhost and LAN IPs", () => {
  const config = extensionConfig(["192.168.0.21","10.0.0.8"]);
  assert.match(config,/DNS\.1=localhost/);
  assert.match(config,/IP\.1=127\.0\.0\.1/);
  assert.match(config,/192\.168\.0\.21/);
  assert.match(config,/10\.0\.0\.8/);
});
