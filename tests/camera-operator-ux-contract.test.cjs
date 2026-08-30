const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "electron/interaction-ux.js"), "utf8");

assert.match(source, /id="cameraOperatorBtn"/,
  "Camera Operator control must be installed in the camera inspector");
assert.match(source, /● 직접 촬영/,
  "Camera Operator must stay discoverable with a direct shooting action");
assert.match(source, /STBY · 화면을 눌러 시작/,
  "first REC action must arm standby before motion is captured");
assert.match(source, /먼저 촬영 시작 위치에 카메라 키프레임을 하나 찍어주세요/,
  "Camera Operator must keep the existing first-key workflow as its starting contract");
assert.match(source, /1 \/ 30/,
  "live operator input must be sampled at a bounded rate instead of creating a key on every pointer event");
assert.match(source, /smoothSamples\(samples, cleanupStrength\)/,
  "raw operator samples must pass through explicit micro-jitter cleanup");
assert.match(source, /simplifySamples\(smoothed/,
  "cleaned motion must be reduced to editable timeline keys");
assert.match(source, /keyframe\.transition = "linear"/,
  "recorded speed/tension must not be replaced by automatic easing");
assert.match(source, /Shift\+드래그 Truck\/Pedestal/,
  "mouse operator help must document positional camera control");
assert.match(source, /휠 Dolly/,
  "mouse operator help must document dolly control");
assert.match(source, /Alt\/Option\+휠 높이/,
  "mouse operator help must document camera height control");
assert.equal(/handheld|shake|noise|random/i.test(source), false,
  "Camera Operator must not synthesize handheld shake or random secondary motion");

console.log("camera-operator-ux-contract: standby, live mouse control, cleanup, and authored-motion policy passed");
