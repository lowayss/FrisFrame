const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../electron/phone-motion-core.js");

test("phone motion yaw crosses 360 without a camera jump", () => {
  assert.equal(core.shortestAngleDelta(358, 2), 4);
  assert.equal(core.shortestAngleDelta(2, 358), -4);
});

test("recenter anchors the current phone orientation to the current camera pose", () => {
  const sample = { screenAngle:0, orientation:{alpha:125,beta:12,gamma:3}, visual:{x:0.4,y:-0.2,z:0.7,confidence:0.9}, calibrationId:4 };
  const camera = { x:0.5,y:0.5,height:1.7,panDeg:210,tiltDeg:-8,focal:50 };
  const anchor = core.createAnchor(sample, camera);
  const pose = core.derivePose(anchor, sample, { stageWidth:10,stageDepth:10,forward:{x:1,z:0} });
  assert.equal(pose.x, camera.x);
  assert.equal(pose.y, camera.y);
  assert.equal(pose.height, camera.height);
  assert.equal(pose.panDeg, camera.panDeg);
  assert.equal(pose.tiltDeg, camera.tiltDeg);
});

test("orientation is absolute from the recenter anchor instead of accumulating every frame", () => {
  const anchor = core.createAnchor({orientation:{alpha:10,beta:20,gamma:0}}, {x:0.5,y:0.5,height:1.6,panDeg:100,tiltDeg:-5,focal:35});
  const sample = {orientation:{alpha:25,beta:26,gamma:0},visual:{confidence:0}};
  const first = core.derivePose(anchor, sample, {stageWidth:10,stageDepth:10,forward:{x:1,z:0}});
  const second = core.derivePose(anchor, sample, {stageWidth:10,stageDepth:10,forward:{x:1,z:0}});
  assert.equal(first.panDeg, 115);
  assert.equal(first.tiltDeg, -11);
  assert.deepEqual(second, first);
});

test("visual translation maps truck and dolly from the camera anchor and stays non-metric", () => {
  const anchor = core.createAnchor({orientation:{alpha:0,beta:0,gamma:0},visual:{x:0,y:0,z:0,confidence:1}}, {x:0.5,y:0.5,height:1.6,panDeg:0,tiltDeg:0,focal:35});
  const pose = core.derivePose(anchor, {orientation:{alpha:0,beta:0,gamma:0},visual:{x:1,y:0.5,z:1,confidence:0.8}}, {stageWidth:10,stageDepth:20,forward:{x:1,z:0},visualScaleMeters:2});
  assert.equal(pose.x, 0.7);
  assert.equal(pose.y, 0.6);
  assert.equal(pose.height, 2.6);
  assert.equal(pose.diagnostic.translation.metric, false);
  assert.equal(pose.diagnostic.translationTrusted, true);
});

test("low-confidence visual flow is ignored while orientation still drives pan tilt", () => {
  const anchor = core.createAnchor({orientation:{alpha:5,beta:0,gamma:0},visual:{x:0,y:0,z:0,confidence:1}}, {x:0.2,y:0.3,height:1.4,panDeg:30,tiltDeg:2,focal:35});
  const pose = core.derivePose(anchor, {orientation:{alpha:15,beta:5,gamma:0},visual:{x:5,y:5,z:5,confidence:0.05}}, {stageWidth:10,stageDepth:10,forward:{x:1,z:0},confidenceThreshold:0.2});
  assert.equal(pose.x, 0.2);
  assert.equal(pose.y, 0.3);
  assert.equal(pose.height, 1.4);
  assert.equal(pose.panDeg, 40);
  assert.equal(pose.tiltDeg, -3);
  assert.equal(pose.diagnostic.translationTrusted, false);
});

test("landscape remap uses gamma for pitch so rotating the screen does not swap camera semantics", () => {
  assert.deepEqual(core.remapOrientation({screenAngle:90,orientation:{alpha:30,beta:40,gamma:12}}), {yaw:30,pitch:-12,roll:40,screenAngle:90});
  assert.deepEqual(core.remapOrientation({screenAngle:-90,orientation:{alpha:30,beta:40,gamma:12}}), {yaw:30,pitch:12,roll:-40,screenAngle:-90});
});
