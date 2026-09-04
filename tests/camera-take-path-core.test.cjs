const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../electron/camera-take-path-core.js");

test("capturePath archives only camera keys inside the finished take range", () => {
  const path = core.capturePath([
    {id:"actor",source:"actor",time:1,pose:{x:9,y:9}},
    {id:"before",source:"camera",time:0.5,pose:{x:0,y:0,height:1,panDeg:0,tiltDeg:0,focal:35}},
    {id:"a",source:"camera",time:1,pose:{x:0.2,y:0.3,height:1.5,panDeg:350,tiltDeg:1,focal:35}},
    {id:"b",source:"camera",time:2,pose:{x:0.4,y:0.6,height:1.7,panDeg:10,tiltDeg:3,focal:50},transition:"linear",operatorContinuity:true},
    {id:"after",source:"camera",time:3,pose:{x:1,y:1,height:2,panDeg:30,tiltDeg:4,focal:50}},
  ], 1, 2);
  assert.equal(path.keyframeCount, 2);
  assert.equal(path.startTime, 1);
  assert.equal(path.endTime, 2);
  assert.equal(path.duration, 1);
  assert.deepEqual(path.keyframes.map((frame) => frame.time), [1,2]);
  assert.ok(/^fnv1a-[0-9a-f]{8}$/.test(path.fingerprint));
});

test("samplePath takes the shortest pan route across 360 degrees", () => {
  const path = core.capturePath([
    {source:"camera",time:0,pose:{x:0,y:0,height:1.6,panDeg:350,tiltDeg:0,focal:35}},
    {source:"camera",time:1,pose:{x:1,y:1,height:2,panDeg:10,tiltDeg:10,focal:55}},
  ], 0, 1);
  const pose = core.samplePath(path, 0.5);
  assert.equal(pose.x, 0.5);
  assert.equal(pose.y, 0.5);
  assert.equal(pose.height, 1.8);
  assert.equal(pose.panDeg, 0);
  assert.equal(pose.tiltDeg, 5);
  assert.equal(pose.focal, 45);
});

test("samplePath can reuse Camera Operator vector spline interpolation", () => {
  const path = core.capturePath([
    {source:"camera",time:0,pose:{x:0,y:0,height:1.6,panDeg:0,tiltDeg:0,focal:35}},
    {source:"camera",time:1,pose:{x:1,y:0.5,height:1.8,panDeg:20,tiltDeg:4,focal:40}},
    {source:"camera",time:2,pose:{x:1.5,y:1,height:2,panDeg:30,tiltDeg:8,focal:50}},
  ], 0, 2);
  let continuity = null;
  const pose = core.samplePath(path, 0.5, (from, to, progress, value) => {
    continuity = value;
    return {
      x:from.x + (to.x-from.x)*progress,
      y:from.y + (to.y-from.y)*progress,
      height:1.7,panDeg:10,tiltDeg:2,focal:37.5,
    };
  });
  assert.equal(pose.x, 0.5);
  assert.equal(continuity.startTime, 0);
  assert.equal(continuity.endTime, 1);
  assert.equal(continuity.nextTime, 2);
});

test("removeCameraRange replaces only the archived take interval", () => {
  const path = core.capturePath([
    {source:"camera",time:1,pose:{x:0,y:0,height:1.6,panDeg:0,tiltDeg:0,focal:35}},
    {source:"camera",time:2,pose:{x:1,y:1,height:1.8,panDeg:20,tiltDeg:2,focal:40}},
  ], 1, 2);
  const kept = core.removeCameraRange([
    {id:"before",source:"camera",time:0.5},
    {id:"inside-a",source:"camera",time:1},
    {id:"actor",source:"actor",time:1.5},
    {id:"inside-b",source:"camera",time:2},
    {id:"after",source:"camera",time:2.5},
  ], path);
  assert.deepEqual(kept.map((key) => key.id), ["before","actor","after"]);
});

test("legacy takes without cameraPath stay valid but cannot be replayed", () => {
  assert.equal(core.normalizePath(null), null);
  assert.equal(core.normalizePath({keyframes:[]}), null);
  assert.equal(core.samplePath(null, 1), null);
});
