const assert = require("node:assert/strict");

const {
  activeMotionSegment,
  cameraDirectionVector,
  circularArcPoint,
  constrainPathEndpoint,
  finiteNumber,
  motionSegments,
  normalizePathMode,
  normalizeTransition,
  poseFieldsChanged,
  rescaleKeyframeTimes,
  samplePlanarPath,
  transitionProgress,
} = require("../motion-core.js");

function near(actual, expected, epsilon = 0.0001) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} should be near ${expected}`);
}

assert.equal(normalizeTransition("linear"), "linear");
assert.equal(finiteNumber("12.5", 0), 12.5);
assert.equal(finiteNumber("bad", 4), 4);
assert.equal(normalizeTransition("unknown"), "smooth");
near(transitionProgress(0.5, 0, 1, "linear"), 0.5);
near(transitionProgress(0.25, 0, 1, "smooth"), 0.125);
assert.equal(transitionProgress(0.99, 0, 1, "hold"), 0);
assert.equal(transitionProgress(1, 0, 1, "cut"), 1);

const straightDown = cameraDirectionVector(25, -90);
near(straightDown.x, 0, 0.000001);
near(straightDown.y, -1, 0.000001);
near(straightDown.z, 0, 0.000001);
const nearVertical = cameraDirectionVector(180, 89);
near(Math.asin(nearVertical.y) * 180 / Math.PI, 89, 0.0001);

assert.equal(normalizePathMode("drone", "camera"), "drone");
assert.equal(normalizePathMode("drone", "actor"), "straight");
assert.equal(normalizePathMode("unknown", "camera"), "straight");

const horizontal = constrainPathEndpoint(
  { x: 0.1, y: 0.4, aimY: 0.5 },
  { x: 0.8, y: 0.9, aimY: 0.7 },
  "horizontal",
  "camera",
);
near(horizontal.y, 0.4);
near(horizontal.aimY, 0.2);

const vertical = constrainPathEndpoint(
  { x: 0.2, y: 0.1, aimX: 0.3 },
  { x: 0.8, y: 0.9, aimX: 0.6 },
  "vertical",
  "camera",
);
near(vertical.x, 0.2);
near(vertical.aimX, 0);

const straight = samplePlanarPath({ x: 0, y: 0 }, { x: 1, y: 1 }, 0.5, "straight");
near(straight.x, 0.5);
near(straight.y, 0.5);

const invalid = samplePlanarPath({ x: "bad", y: null }, { x: 1, y: "bad" }, 0.5, "straight");
assert.ok(Number.isFinite(invalid.x));
assert.ok(Number.isFinite(invalid.y));

const curve = samplePlanarPath(
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  0.5,
  "free-curve",
  { control: { x: 0.5, y: 1 } },
);
near(curve.x, 0.5);
near(curve.y, 0.5);

const arcStart = circularArcPoint({ x: 0, y: 0 }, { x: 1, y: 0 }, 0, 1);
const arcMid = circularArcPoint({ x: 0, y: 0 }, { x: 1, y: 0 }, 0.5, 1);
const arcEnd = circularArcPoint({ x: 0, y: 0 }, { x: 1, y: 0 }, 1, 1);
near(arcStart.x, 0);
near(arcEnd.x, 1);
assert.ok(Math.abs(arcMid.y) > 0.1, "arc midpoint should leave the straight chord");

assert.equal(poseFieldsChanged({ x: 0.2, y: 0.4 }, { x: 0.2, y: 0.4 }), false);
assert.equal(poseFieldsChanged({ x: 0.2, y: 0.4 }, { x: 0.7, y: 0.4 }), true);
const guideKeys = [
  { id: "a", time: 0, pose: { x: 0.2, y: 0.4 } },
  { id: "b", time: 2, transition: "linear", pose: { x: 0.8, y: 0.4 } },
  { id: "c", time: 4, transition: "hold", pose: { x: 0.8, y: 0.8 } },
];
assert.equal(motionSegments(guideKeys).length, 2);
assert.equal(activeMotionSegment(guideKeys, 1)?.end.id, "b");
assert.equal(activeMotionSegment(guideKeys, 3), null, "hold segments do not report continuous movement");

const originalTiming = [
  { id: "start", time: 0 },
  { id: "middle", time: 3 },
  { id: "end", time: 6 },
];
assert.deepEqual(rescaleKeyframeTimes(originalTiming, 6, 6).map((key) => key.time), [0, 3, 6]);
assert.deepEqual(rescaleKeyframeTimes(originalTiming, 6, 12).map((key) => key.time), [0, 6, 12]);
assert.deepEqual(rescaleKeyframeTimes(originalTiming, 6, 0).map((key) => key.time), [0, 3, 6]);
assert.deepEqual(originalTiming.map((key) => key.time), [0, 3, 6], "rescaling must not mutate the source array");

console.log("motion-core: transitions and path constraints passed");
