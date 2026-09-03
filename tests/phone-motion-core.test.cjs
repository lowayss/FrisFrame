const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const core = require("../electron/phone-motion-core.js");

const phoneMotionUx = fs.readFileSync(path.join(__dirname, "..", "electron", "phone-motion-camera-ux.js"), "utf8");

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

test("visual translation maps relative flow into virtual scene travel without claiming physical meters", () => {
  const anchor = core.createAnchor({orientation:{alpha:0,beta:0,gamma:0},visual:{x:0,y:0,z:0,confidence:1}}, {x:0.5,y:0.5,height:1.6,panDeg:0,tiltDeg:0,focal:35});
  const pose = core.derivePose(anchor, {orientation:{alpha:0,beta:0,gamma:0},visual:{x:1,y:0.5,z:1,confidence:0.8}}, {stageWidth:10,stageDepth:20,forward:{x:1,z:0},virtualTravelScale:2});
  assert.equal(pose.x, 0.7);
  assert.equal(pose.y, 0.6);
  assert.equal(pose.height, 2.6);
  assert.equal(pose.diagnostic.translation.metric, false);
  assert.equal(pose.diagnostic.translation.sourceUnits, "relative-optical-flow");
  assert.equal(pose.diagnostic.translation.outputUnits, "virtual-scene-travel");
  assert.equal(pose.diagnostic.translationTrusted, true);
});

test("legacy visualScaleMeters option remains a compatibility alias", () => {
  const anchor = core.createAnchor({orientation:{alpha:0,beta:0,gamma:0},visual:{x:0,y:0,z:0,confidence:1}}, {x:0.5,y:0.5,height:1.6,panDeg:0,tiltDeg:0,focal:35});
  const pose = core.derivePose(anchor, {orientation:{alpha:0,beta:0,gamma:0},visual:{x:0,y:0,z:1,confidence:1}}, {stageWidth:10,stageDepth:10,forward:{x:1,z:0},visualScaleMeters:2});
  assert.equal(pose.x, 0.7);
});

test("WebXR 6DoF maps local-space meter displacement one-to-one into the virtual stage", () => {
  const baseline = {
    spatial:{mode:"webxr",metric:true,position:{x:0,y:0,z:0},orientation:{x:0,y:0,z:0,w:1},confidence:1},
    orientation:{alpha:200,beta:80,gamma:20},
  };
  const anchor = core.createAnchor(baseline,{x:0.5,y:0.5,height:1.6,panDeg:30,tiltDeg:5,focal:35});
  const pose = core.derivePose({ ...anchor },{
    spatial:{mode:"webxr",metric:true,position:{x:0.5,y:0.2,z:-1},orientation:{x:0,y:0,z:0,w:1},confidence:1},
    orientation:{alpha:320,beta:-80,gamma:-20},
  },{stageWidth:10,stageDepth:20,forward:{x:1,z:0},confidenceThreshold:0.2});

  assert.equal(pose.x,0.6);
  assert.equal(pose.y,0.525);
  assert.equal(pose.height,1.8);
  assert.equal(pose.panDeg,30,"identity WebXR orientation should ignore conflicting DeviceOrientation data");
  assert.equal(pose.tiltDeg,5);
  assert.equal(pose.diagnostic.trackingMode,"webxr");
  assert.equal(pose.diagnostic.translation.metric,true);
  assert.equal(pose.diagnostic.translation.sourceUnits,"meters");
  assert.equal(pose.diagnostic.translation.outputUnits,"virtual-scene-meters");
  assert.equal(pose.diagnostic.translation.truck,0.5);
  assert.equal(pose.diagnostic.translation.pedestal,0.2);
  assert.equal(pose.diagnostic.translation.dolly,1);
});

test("WebXR orientation takes precedence over DeviceOrientation and drives relative pan", () => {
  const half = Math.sin(Math.PI / 8);
  const scalar = Math.cos(Math.PI / 8);
  const anchor = core.createAnchor({
    spatial:{mode:"webxr",metric:true,position:{x:0,y:0,z:0},orientation:{x:0,y:0,z:0,w:1},confidence:1},
    orientation:{alpha:250,beta:70,gamma:30},
  },{x:0.5,y:0.5,height:1.6,panDeg:100,tiltDeg:0,focal:35});
  const pose = core.derivePose(anchor,{
    spatial:{mode:"webxr",metric:true,position:{x:0,y:0,z:0},orientation:{x:0,y:half,z:0,w:scalar},confidence:1},
    orientation:{alpha:10,beta:-70,gamma:-30},
  },{stageWidth:10,stageDepth:10,forward:{x:1,z:0}});
  assert.ok(Math.abs(core.shortestAngleDelta(145,pose.panDeg)) < 0.001,`unexpected WebXR pan ${pose.panDeg}`);
  assert.equal(pose.diagnostic.translation.metric,true);
});

test("low-confidence WebXR translation is marked untrusted and can be held by the stabilizer", () => {
  const anchor = core.createAnchor({
    spatial:{mode:"webxr",metric:true,position:{x:0,y:0,z:0},orientation:{x:0,y:0,z:0,w:1},confidence:1},
  },{x:0.5,y:0.5,height:1.6,panDeg:0,tiltDeg:0,focal:35});
  const pose = core.derivePose(anchor,{
    spatial:{mode:"webxr",metric:true,position:{x:5,y:5,z:-5},orientation:{x:0,y:0,z:0,w:1},confidence:0.05},
  },{stageWidth:10,stageDepth:10,forward:{x:1,z:0},confidenceThreshold:0.2});
  assert.equal(pose.diagnostic.translation.metric,true);
  assert.equal(pose.diagnostic.translationTrusted,false);
  assert.equal(pose.x,0.5);
  assert.equal(pose.y,0.5);
  assert.equal(pose.height,1.6);
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

test("pose stabilizer holds the last translation when visual confidence drops instead of snapping to anchor", () => {
  const stabilizer = core.createPoseStabilizer({positionHalfLifeMs:0,angleHalfLifeMs:0});
  const trusted = stabilizer.update({
    x:0.75,y:0.62,height:2.1,panDeg:40,tiltDeg:2,focal:35,
    diagnostic:{translationTrusted:true,translation:{confidence:0.8}},
  }, 1000);
  assert.equal(trusted.x, 0.75);
  const lost = stabilizer.update({
    x:0.5,y:0.5,height:1.6,panDeg:58,tiltDeg:-6,focal:35,
    diagnostic:{translationTrusted:false,translation:{confidence:0.05}},
  }, 1033);
  assert.equal(lost.x, 0.75);
  assert.equal(lost.y, 0.62);
  assert.equal(lost.height, 2.1);
  assert.equal(lost.panDeg, 58);
  assert.equal(lost.tiltDeg, -6);
  assert.equal(lost.diagnostic.stabilization.heldTranslation, true);
});

test("pose stabilizer follows the shortest pan route across 360 degrees", () => {
  const stabilizer = core.createPoseStabilizer({positionHalfLifeMs:0,angleHalfLifeMs:100});
  stabilizer.update({x:0,y:0,height:1.6,panDeg:358,tiltDeg:0,focal:35,diagnostic:{translationTrusted:true}}, 1000);
  const next = stabilizer.update({x:0,y:0,height:1.6,panDeg:2,tiltDeg:0,focal:35,diagnostic:{translationTrusted:true}}, 1100);
  assert.ok(next.panDeg > 358 || next.panDeg < 2.1, `unexpected wrapped pan ${next.panDeg}`);
  assert.ok(Math.abs(core.shortestAngleDelta(358, next.panDeg)) < 4.01);
});

test("RAW stabilizer applies trusted motion without smoothing", () => {
  const stabilizer = core.createPoseStabilizer({positionHalfLifeMs:0,angleHalfLifeMs:0,focalHalfLifeMs:0});
  stabilizer.update({x:0,y:0,height:1.6,panDeg:10,tiltDeg:0,focal:35,diagnostic:{translationTrusted:true}}, 1000);
  const next = stabilizer.update({x:0.8,y:0.6,height:2.2,panDeg:90,tiltDeg:12,focal:50,diagnostic:{translationTrusted:true}}, 1033);
  assert.deepEqual(
    {x:next.x,y:next.y,height:next.height,panDeg:next.panDeg,tiltDeg:next.tiltDeg,focal:next.focal},
    {x:0.8,y:0.6,height:2.2,panDeg:90,tiltDeg:12,focal:50},
  );
});

test("landscape remap uses gamma for pitch so rotating the screen does not swap camera semantics", () => {
  assert.deepEqual(core.remapOrientation({screenAngle:90,orientation:{alpha:30,beta:40,gamma:12}}), {yaw:30,pitch:-12,roll:40,screenAngle:90});
  assert.deepEqual(core.remapOrientation({screenAngle:-90,orientation:{alpha:30,beta:40,gamma:12}}), {yaw:30,pitch:12,roll:-40,screenAngle:-90});
});

test("desktop physical-camera UX exposes stabilization, confidence hold, recenter, metric badge and live 3D redraw", () => {
  assert.match(phoneMotionUx, /STABILIZATION_PRESETS/);
  assert.match(phoneMotionUx, /raw:\s*\{\s*label:"RAW"/);
  assert.match(phoneMotionUx, /handheld:\s*\{\s*label:"HANDHELD"/);
  assert.match(phoneMotionUx, /cinema:\s*\{\s*label:"CINEMA"/);
  assert.match(phoneMotionUx, /createPoseStabilizer/);
  assert.match(phoneMotionUx, /virtualTravelScale:1\.75/);
  assert.doesNotMatch(phoneMotionUx, /visualScaleMeters:1\.75/);
  assert.match(phoneMotionUx, /heldTranslation/);
  assert.match(phoneMotionUx, /이동 HOLD/);
  assert.match(phoneMotionUx, /WebXR 6DoF · METRIC/);
  assert.match(phoneMotionUx, /translation\?\.metric === true/);
  assert.match(phoneMotionUx, /renderThreeView\(renderState, true\)/);
  assert.match(phoneMotionUx, /data-phone-motion-recenter/);
  assert.match(phoneMotionUx, /setStabilization/);
});
