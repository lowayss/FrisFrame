const assert = require("node:assert/strict");

const {
  activeMotionSegment,
  cameraDirectionVector,
  cameraReferenceProgress,
  circularArcPoint,
  constrainPathEndpoint,
  composeBaseInterpolatedPose,
  composeEvaluatedFrameBase,
  finiteNumber,
  motionSegments,
  normalizePathMode,
  normalizeTransition,
  pointDistance,
  poseFieldsChanged,
  quadraticBezierArcLengthPoint,
  referenceExportFrameSchedule,
  rescaleKeyframeTimes,
  samplePlanarPath,
  smoothRunReferenceProgress,
  sourceKeyframeEvaluationPlan,
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

const sourcePlanKeys = [
  { id: "k0", time: 0, pose: { x: 0 } },
  { id: "k1", time: 2, transition: "smooth", pose: { x: 1 } },
  { id: "k2", time: 4, transition: "hold", pose: { x: 2 } },
  { id: "k3", time: 6, transition: "cut", pose: { x: 3 } },
];
assert.equal(sourceKeyframeEvaluationPlan([], 1).kind, "fallback");
const sourcePlanBefore = sourceKeyframeEvaluationPlan(sourcePlanKeys, -1);
assert.equal(sourcePlanBefore.kind, "key");
assert.equal(sourcePlanBefore.keyframe.id, "k0");
const sourcePlanSmooth = sourceKeyframeEvaluationPlan(sourcePlanKeys, 0.5);
assert.equal(sourcePlanSmooth.kind, "segment");
assert.equal(sourcePlanSmooth.end.id, "k1");
assert.equal(sourcePlanSmooth.transition, "smooth");
near(sourcePlanSmooth.rawProgress, 0.25);
near(sourcePlanSmooth.easedProgress, 0.125);
near(sourcePlanSmooth.progress, 0.25, 0.000001);
near(sourcePlanSmooth.referenceProgress, 0.125, 0.000001);

// A smooth camera run eases only at the run boundaries. Interior keys must
// retain non-zero travel speed instead of receiving a fresh ease-in/out.
const twoSegmentSmoothRun = [
  { id: "s0", time: 0, pose: { x: 0 } },
  { id: "s1", time: 1, transition: "smooth", pose: { x: 1 } },
  { id: "s2", time: 2, transition: "smooth", pose: { x: 2 } },
];
const smoothRunFirstHalf = sourceKeyframeEvaluationPlan(twoSegmentSmoothRun, 0.5);
const smoothRunSecondHalf = sourceKeyframeEvaluationPlan(twoSegmentSmoothRun, 1.5);
near(smoothRunFirstHalf.referenceProgress, 0.375, 0.000001);
near(smoothRunSecondHalf.referenceProgress, 0.625, 0.000001);
assert.equal(smoothRunFirstHalf.hasSmoothBefore, false);
assert.equal(smoothRunFirstHalf.hasSmoothAfter, true);
assert.equal(smoothRunSecondHalf.hasSmoothBefore, true);
assert.equal(smoothRunSecondHalf.hasSmoothAfter, false);
near(cameraReferenceProgress(0.5, "smooth", { hasSmoothAfter: true }), 0.375);
near(cameraReferenceProgress(0.5, "smooth", { hasSmoothBefore: true }), 0.625);

const threeSegmentSmoothRun = [
  { id: "m0", time: 0, pose: { x: 0 } },
  { id: "m1", time: 1, transition: "smooth", pose: { x: 1 } },
  { id: "m2", time: 2, transition: "smooth", pose: { x: 2 } },
  { id: "m3", time: 3, transition: "smooth", pose: { x: 3 } },
];
const smoothRunMiddle = sourceKeyframeEvaluationPlan(threeSegmentSmoothRun, 1.5);
near(smoothRunMiddle.referenceProgress, 0.5, 0.000001);
assert.equal(smoothRunMiddle.hasSmoothBefore, true);
assert.equal(smoothRunMiddle.hasSmoothAfter, true);
near(cameraReferenceProgress(0.5, "smooth", { hasSmoothBefore: true, hasSmoothAfter: true }), 0.5);
near(cameraReferenceProgress(0.25, "smooth"), 0.125, 0.000001);
near(cameraReferenceProgress(0.25, "linear", { hasSmoothBefore: true, hasSmoothAfter: true }), 0.25, 0.000001);
near(smoothRunReferenceProgress(0.25, "smooth"), 0.125, 0.000001);
near(smoothRunReferenceProgress(0.25, "linear"), 0.25, 0.000001);

// A four-key run must pass through each interior key without a new ease-in or
// ease-out. Hold/Cut remain the explicit exceptions for authored stops.
const fourKeyRun = [
  { id: "q0", time: 0, pose: { x: 0, y: 0 } },
  { id: "q1", time: 1, transition: "smooth", pose: { x: 1, y: 0 } },
  { id: "q2", time: 2, transition: "smooth", pose: { x: 1, y: 1 } },
  { id: "q3", time: 3, transition: "smooth", pose: { x: 2, y: 1 } },
];
const fourKeyQuarterSamples = [0.25, 1.25, 2.25]
  .map((time) => sourceKeyframeEvaluationPlan(fourKeyRun, time));
const fourKeyThreeQuarterSamples = [0.75, 1.75, 2.75]
  .map((time) => sourceKeyframeEvaluationPlan(fourKeyRun, time));
fourKeyQuarterSamples.forEach((plan) => near(plan.progress, 0.25));
fourKeyThreeQuarterSamples.forEach((plan) => near(plan.progress, 0.75));
near(sourceKeyframeEvaluationPlan(fourKeyRun, 1).progress, 1);
near(sourceKeyframeEvaluationPlan(fourKeyRun, 1.000001).progress, 0.000001, 0.000001);

const actorSmoothPlan = sourceKeyframeEvaluationPlan([
  { id: "a0", time: 0, pose: { x: 0 } },
  { id: "a1", time: 2, transition: "smooth", pose: { x: 1 } },
], 0.5);
const actorLinearPlan = sourceKeyframeEvaluationPlan([
  { id: "l0", time: 0, pose: { x: 0 } },
  { id: "l1", time: 2, transition: "linear", pose: { x: 1 } },
], 0.5);
near(actorSmoothPlan.referenceProgress, 0.125, 0.000001);
near(actorLinearPlan.referenceProgress, 0.25, 0.000001);

const propSmoothPlan = sourceKeyframeEvaluationPlan([
  { id: "p0", time: 0, pose: { x: 0 } },
  { id: "p1", time: 2, transition: "smooth", pose: { x: 1 } },
], 0.5);
near(propSmoothPlan.referenceProgress, 0.125, 0.000001);

const discretePropFrame = composeBaseInterpolatedPose({
  sourceId: "prop",
  from: { type: "prop", x: 0, y: 0, mountId: "chair-a", mountAction: "sit", seatIndex: 0, visible: true },
  to: { type: "prop", x: 1, y: 1, mountId: "chair-b", mountAction: "sit", seatIndex: 1, visible: false },
  progress: 0.75,
  discreteProgress: 0.25,
  spatial: { x: 0.75, y: 0.75, height: 0 },
});
assert.equal(discretePropFrame.mountId, "chair-a", "eased spatial progress must not switch discrete prop state early");
assert.equal(discretePropFrame.visible, true, "eased spatial progress must not hide a prop before authored arrival");

const unsortedPlan = sourceKeyframeEvaluationPlan([
  { id: "u1", time: 2, pose: { x: 1 } },
  { id: "u0", time: 0, pose: { x: 0 } },
], 1);
assert.equal(unsortedPlan.start.id, "u0", "source planning must be stable even when persisted keys arrive unsorted");
assert.equal(unsortedPlan.end.id, "u1");

const sourcePlanHold = sourceKeyframeEvaluationPlan(sourcePlanKeys, 3);
assert.equal(sourcePlanHold.end.id, "k2");
assert.equal(sourcePlanHold.progress, 0, "hold must remain on the source key before arrival");
const sourcePlanHoldArrival = sourceKeyframeEvaluationPlan(sourcePlanKeys, 4);
assert.equal(sourcePlanHoldArrival.end.id, "k2");
assert.equal(sourcePlanHoldArrival.progress, 1, "hold must apply the destination exactly at arrival");
const sourcePlanCut = sourceKeyframeEvaluationPlan(sourcePlanKeys, 5);
assert.equal(sourcePlanCut.end.id, "k3");
assert.equal(sourcePlanCut.progress, 0, "cut must remain on the source key before arrival");
const sourcePlanAfter = sourceKeyframeEvaluationPlan(sourcePlanKeys, 7);
assert.equal(sourcePlanAfter.kind, "key");
assert.equal(sourcePlanAfter.keyframe.id, "k3");

const straightDown = cameraDirectionVector(25, -90);
near(straightDown.x, 0, 0.000001);
near(straightDown.y, -1, 0.000001);
near(straightDown.z, 0, 0.000001);
const nearVertical = cameraDirectionVector(180, 89);
near(Math.asin(nearVertical.y) * 180 / Math.PI, 89, 0.0001);

for (const removedPathMode of ["horizontal", "vertical", "drone", "jib-up", "jib-down"]) {
  assert.equal(normalizePathMode(removedPathMode, "camera"), "straight");
}
assert.equal(normalizePathMode("unknown", "camera"), "straight");

const unchangedEndpoint = constrainPathEndpoint(
  { x: 0.1, y: 0.4, aimY: 0.5 },
  { x: 0.8, y: 0.9, aimY: 0.7 },
  "straight",
  "camera",
);
assert.deepEqual(unchangedEndpoint, { x: 0.8, y: 0.9, aimY: 0.7 });

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
// Constant-distance remapping applies to every moving source so an authored
// free curve does not speed up near the control point.
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
assert.ok(actorSpeedSpread < 1.08, `actor free-curve speed spread should stay low, got ${actorSpeedSpread}`);

const optedOutCameraCurve = equalTimeSteps.map((progress) => samplePlanarPath(
  curveStart,
  curveEnd,
  progress,
  "free-curve",
  { sourceType: "camera", control: curveControl, constantSpeed: false },
));
assert.ok(spreadRatio(segmentDistances(optedOutCameraCurve)) > 2, "camera constant-speed remapping must be explicitly disableable");

const optedOutActorCurve = equalTimeSteps.map((progress) => samplePlanarPath(
  curveStart,
  curveEnd,
  progress,
  "free-curve",
  { sourceType: "actor", control: curveControl, constantSpeed: false },
));
assert.ok(spreadRatio(segmentDistances(optedOutActorCurve)) > 2, "actor constant-speed remapping must be explicitly disableable");

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

const schedule24 = referenceExportFrameSchedule({ start: 0, end: 2, fps: 24 });
assert.equal(schedule24.frameCount, 48);
assert.equal(schedule24.fps, 24);
near(schedule24.times[0], 0);
near(schedule24.times[1] - schedule24.times[0], 1 / 24, 0.000000001);
near(schedule24.times.at(-1), 47 / 24, 0.000000001);
assert.ok(schedule24.times.at(-1) < 2, "CFR sampling must not stretch the last evaluated frame to the range endpoint");
near(schedule24.frameCount / schedule24.fps, 2, 0.000000001);
for (let index = 1; index < schedule24.times.length; index += 1) {
  near(schedule24.times[index] - schedule24.times[index - 1], 1 / 24, 0.000000001);
}

const schedule60 = referenceExportFrameSchedule({ start: 5, end: 7, fps: 60 });
assert.equal(schedule60.frameCount, 120);
near(schedule60.times[0], 5);
near(schedule60.times[1] - schedule60.times[0], 1 / 60, 0.000000001);
near(schedule60.times.at(-1), 5 + 119 / 60, 0.000000001);
for (let index = 1; index < schedule60.times.length; index += 1) {
  near(schedule60.times[index] - schedule60.times[index - 1], 1 / 60, 0.000000001);
}
const minimumSchedule = referenceExportFrameSchedule({ start: 1, end: 1.01, fps: 24 });
assert.equal(minimumSchedule.frameCount, 2, "MP4 server compatibility requires at least two frames");

const frameDocument = {
  sceneTitle: "frame-base-test",
  camera: { x: 0.1, focal: 35 },
  items: [
    { id: "actor-a", type: "actor", x: 0.2 },
    { id: "prop-a", type: "prop", x: 0.8 },
  ],
  motion: { duration: 5, playhead: 1 },
};
const frameCalls = [];
const evaluatedFrameBase = composeEvaluatedFrameBase(frameDocument, 9, (sourceId, safeTime, fallbackPose) => {
  frameCalls.push([sourceId, safeTime]);
  return { ...fallbackPose, evaluatedAt: safeTime };
});
assert.notEqual(evaluatedFrameBase, frameDocument, "frame assembly must clone the document");
assert.equal(frameDocument.motion.playhead, 1, "frame assembly must not mutate authored playhead");
assert.equal(evaluatedFrameBase.motion.playhead, 5, "frame time must clamp to duration");
assert.deepEqual(frameCalls, [["camera", 5], ["actor-a", 5], ["prop-a", 5]]);
assert.equal(evaluatedFrameBase.camera.evaluatedAt, 5);
assert.equal(evaluatedFrameBase.items[0].evaluatedAt, 5);
const evaluatedFrameStart = composeEvaluatedFrameBase(frameDocument, -3, (_sourceId, safeTime, fallbackPose) => ({ ...fallbackPose, evaluatedAt: safeTime }));
assert.equal(evaluatedFrameStart.motion.playhead, 0, "negative frame time must clamp to zero");
assert.throws(
  () => composeEvaluatedFrameBase(frameDocument, 1),
  /source evaluator/,
  "frame assembly must not silently skip source evaluation",
);

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

console.log("motion-core: CFR export scheduling, frame assembly, source timing, transitions, path constraints, camera reference speed, and base pose composition passed");
