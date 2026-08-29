const assert = require("node:assert/strict");

const {
  activeMotionSegment,
  cameraDirectionVector,
  circularArcPoint,
  constrainPathEndpoint,
  composeBaseInterpolatedPose,
  finiteNumber,
  motionSegments,
  normalizePathMode,
  normalizeTransition,
  pointDistance,
  poseFieldsChanged,
  quadraticBezierArcLengthPoint,
  rescaleKeyframeTimes,
  samplePlanarPath,
  transitionProgress,
} = require("../motion-core.js");

function near(actual, expected, epsilon = 0.0001) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} should be near ${expected}`);
}

function segmentDistances(points) {
  return points.slice(1).map((point, index) => pointDistance(points[index], point));
}

function spreadRatio(values) {
  const safe = values.filter((value) => value > 0.000001);
  return Math.max(...safe) / Math.min(...safe);
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
near(curve.x, 0.5, 0.001);
near(curve.y, 0.5, 0.001);

const arcLengthStart = quadraticBezierArcLengthPoint(
  { x: 0, y: 0 },
  { x: 0.05, y: 1.4 },
  { x: 1, y: 0 },
  0,
);
const arcLengthEnd = quadraticBezierArcLengthPoint(
  { x: 0, y: 0 },
  { x: 0.05, y: 1.4 },
  { x: 1, y: 0 },
  1,
);
near(arcLengthStart.x, 0);
near(arcLengthStart.y, 0);
near(arcLengthEnd.x, 1);
near(arcLengthEnd.y, 0);

const curveStart = { x: 0, y: 0 };
const curveControl = { x: 0.05, y: 1.4 };
const curveEnd = { x: 1, y: 0 };
const equalTimeSteps = Array.from({ length: 9 }, (_entry, index) => index / 8);
// Constant-distance remapping is camera-only by design: Seedance should receive
// cleaner camera velocity without silently changing authored actor motion.
const cameraCurve = equalTimeSteps.map((progress) => samplePlanarPath(
  curveStart,
  curveEnd,
  progress,
  "free-curve",
  { sourceType: "camera", control: curveControl, arcLengthSamples: 96 },
));
const actorCurve = equalTimeSteps.map((progress) => samplePlanarPath(
  curveStart,
  curveEnd,
  progress,
  "free-curve",
  { sourceType: "actor", control: curveControl },
));
const cameraSpeedSpread = spreadRatio(segmentDistances(cameraCurve));
const actorSpeedSpread = spreadRatio(segmentDistances(actorCurve));
assert.ok(cameraSpeedSpread < 1.08, `camera free-curve speed spread should stay low, got ${cameraSpeedSpread}`);
assert.ok(actorSpeedSpread > 2, "actor free-curve must keep authored parameter timing instead of receiving camera-only speed remapping");

const optedOutCameraCurve = equalTimeSteps.map((progress) => samplePlanarPath(
  curveStart,
  curveEnd,
  progress,
  "free-curve",
  { sourceType: "camera", control: curveControl, constantSpeed: false },
));
assert.ok(spreadRatio(segmentDistances(optedOutCameraCurve)) > 2, "camera constant-speed remapping must be explicitly disableable");

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

const propHeightKeys = [
  { id: "floor", time: 0, pose: { mountedHeight: 2 } },
  { id: "drop", time: 3, transition: "linear", pose: { mountedHeight: 0 } },
];
assert.equal(motionSegments(propHeightKeys, ["mountedHeight"]).length, 1);
assert.equal(activeMotionSegment(propHeightKeys, 1, ["mountedHeight"])?.end.id, "drop");

const originalTiming = [
  { id: "start", time: 0 },
  { id: "middle", time: 3 },
  { id: "end", time: 6 },
];
assert.deepEqual(rescaleKeyframeTimes(originalTiming, 6, 6).map((key) => key.time), [0, 3, 6]);
assert.deepEqual(rescaleKeyframeTimes(originalTiming, 6, 12).map((key) => key.time), [0, 6, 12]);
assert.deepEqual(rescaleKeyframeTimes(originalTiming, 6, 0).map((key) => key.time), [0, 3, 6]);
assert.deepEqual(originalTiming.map((key) => key.time), [0, 3, 6], "rescaling must not mutate the source array");

const baseCameraPose = composeBaseInterpolatedPose({
  sourceId: "camera",
  from: { x: 0.2, y: 0.3, height: 1.5, panDeg: 350, tiltDeg: -10, focal: 24, focusDistanceM: 3, trackingTargetId: "actor-a" },
  to: { x: 0.8, y: 0.7, height: 2.5, panDeg: 10, tiltDeg: 10, focal: 70, focusDistanceM: 7, trackingTargetId: "actor-b" },
  progress: 0.25,
  spatial: { x: 0.35, y: 0.4, height: 1.75 },
});
near(baseCameraPose.x, 0.35);
near(baseCameraPose.height, 1.75);
near(baseCameraPose.panDeg, 355);
near(baseCameraPose.tiltDeg, -5);
assert.equal(baseCameraPose.focal, 36, "base app-compatible focal composition remains rounded before reference semantics correct it");
assert.equal(baseCameraPose.trackingTargetId, "actor-a");
const baseCameraLate = composeBaseInterpolatedPose({
  sourceId: "camera",
  from: { trackingTargetId: "actor-a" },
  to: { trackingTargetId: "actor-b" },
  progress: 0.75,
  spatial: {},
});
assert.equal(baseCameraLate.trackingTargetId, "actor-b", "base compatibility layer keeps the old midpoint switch that the reference guard overrides");

const neutralBodyPose = { torso: { x: 0 } };
const destinationBodyPose = { torso: { x: 20 } };
const baseActorBefore = composeBaseInterpolatedPose({
  sourceId: "actor-1",
  from: { type: "actor", x: 0.2, y: 0.3, verticalOffset: 0, pitch: 0, facing: 350, bodyPose: neutralBodyPose, visible: true },
  to: { type: "actor", x: 0.8, y: 0.7, verticalOffset: 1, pitch: 20, facing: 10, bodyPose: destinationBodyPose, visible: false },
  progress: 0.998,
  spatial: { x: 0.5, y: 0.5, height: 0.5 },
  transformed: { size: 1.2, scaleX: 1, scaleY: 1.1, scaleZ: 0.9 },
});
assert.equal(baseActorBefore.bodyPose, neutralBodyPose);
near(baseActorBefore.facing, 9.96, 0.001);
near(baseActorBefore.verticalOffset, 0.5);
const baseActorAtLegacyThreshold = composeBaseInterpolatedPose({
  sourceId: "actor-1",
  from: { type: "actor", bodyPose: neutralBodyPose },
  to: { type: "actor", bodyPose: destinationBodyPose },
  progress: 0.999,
  spatial: {},
  transformed: {},
});
assert.equal(baseActorAtLegacyThreshold.bodyPose, destinationBodyPose,
  "base compatibility layer keeps the old 0.999 switch while the reference guard holds until the authored destination");

console.log("motion-core: transitions, path constraints, camera reference speed, and base pose composition passed");
