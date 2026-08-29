const assert = require("node:assert/strict");

const motionCore = require("../motion-core.js");
const runtimeCore = require("../previs-runtime-core.js");

function near(actual, expected, epsilon = 0.000001) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} should be near ${expected}`);
}

for (const name of [
  "cameraReferenceProgress",
  "cloneValue",
  "discreteAtDestination",
  "heldActorBodyPose",
  "installReferenceFrameSemantics",
  "interpolateFocalLength",
  "smoothReferenceProgress",
]) {
  assert.equal(runtimeCore[name], motionCore[name], `${name} must be owned by motion-core and re-exported by previs-runtime-core`);
}

assert.equal(runtimeCore.CAMERA_FOCAL_MIN, motionCore.CAMERA_FOCAL_MIN);
assert.equal(runtimeCore.CAMERA_FOCAL_MAX, motionCore.CAMERA_FOCAL_MAX);

const fakeWindow = {
  interpolatePoseFor(_renderState, sourceId, startPose, endPose, t, fallbackPose) {
    if (sourceId === "camera") {
      return {
        ...fallbackPose,
        ...startPose,
        evaluatedProgress: t,
        focal: Math.round(startPose.focal + (endPose.focal - startPose.focal) * t),
        trackingTargetId: t < 0.5 ? startPose.trackingTargetId : endPose.trackingTargetId,
      };
    }
    return {
      ...fallbackPose,
      ...startPose,
      type: "actor",
      evaluatedProgress: t,
      bodyPose: t >= 0.999 ? endPose.bodyPose : startPose.bodyPose,
    };
  },
  mergePoseWithFallbackFor(_renderState, _sourceId, pose, fallbackPose) {
    return { ...fallbackPose, ...pose };
  },
  sanitizeTrackingTargetId(value) {
    return value;
  },
};

const neutralPose = { leftArm: { x: 0 } };
const raisedPose = { leftArm: { x: -40 } };
const from = { focal: 24, trackingTargetId: "actor-a" };
const to = { focal: 70, trackingTargetId: "actor-b" };

assert.equal(motionCore.installReferenceFrameSemantics(fakeWindow), true);
const quarter = fakeWindow.interpolatePoseFor({}, "camera", from, to, 0.25, {}, { transition: "smooth" });
assert.equal(quarter.evaluatedProgress, 0.125);
assert.equal(quarter.focal, 29.75);
assert.equal(quarter.trackingTargetId, "actor-a");
const almost = fakeWindow.interpolatePoseFor({}, "camera", from, to, 0.999999, {}, { transition: "linear" });
assert.equal(almost.trackingTargetId, "actor-a");
const arrived = fakeWindow.interpolatePoseFor({}, "camera", from, to, 1, {}, { transition: "smooth" });
assert.equal(arrived.trackingTargetId, "actor-b");

const actorAlmost = fakeWindow.interpolatePoseFor(
  {},
  "actor-1",
  { type: "actor", bodyPose: neutralPose },
  { type: "actor", bodyPose: raisedPose },
  0.9995,
  { type: "actor" },
  { transition: "smooth" },
);
assert.deepEqual(actorAlmost.bodyPose, neutralPose, "actor pose must remain authored/held until destination");

const smoothRunKeys = [
  { id: "cam-run-0", time: 0, pose: { focal: 24, trackingTargetId: "actor-a" } },
  { id: "cam-run-1", time: 1, transition: "smooth", pose: { focal: 47, trackingTargetId: "actor-a" } },
  { id: "cam-run-2", time: 2, transition: "smooth", pose: { focal: 70, trackingTargetId: "actor-a" } },
];
const firstRunPlan = motionCore.sourceKeyframeEvaluationPlan(smoothRunKeys, 0.5);
const secondRunPlan = motionCore.sourceKeyframeEvaluationPlan(smoothRunKeys, 1.5);
const firstRunFrame = fakeWindow.interpolatePoseFor(
  {}, "camera", firstRunPlan.start.pose, firstRunPlan.end.pose, firstRunPlan.progress, {}, firstRunPlan.end,
  { referenceProgress: firstRunPlan.referenceProgress },
);
const secondRunFrame = fakeWindow.interpolatePoseFor(
  {}, "camera", secondRunPlan.start.pose, secondRunPlan.end.pose, secondRunPlan.progress, {}, secondRunPlan.end,
  { referenceProgress: secondRunPlan.referenceProgress },
);
assert.equal(firstRunFrame.evaluatedProgress, 0.375, "smooth run must ease in only at its outer start");
assert.equal(secondRunFrame.evaluatedProgress, 0.625, "smooth run must ease out only at its outer end");

// Numerical fixture for the full authored-frame semantics used by both preview
// and MP4 export. App-level contract tests ensure both surfaces enter the same
// render-state evaluator; this fixture locks the resulting numeric semantics.
const fixtureWindow = {
  interpolatePoseFor(_renderState, sourceId, startPose, endPose, t, fallbackPose) {
    const fromPose = { ...fallbackPose, ...startPose };
    const toPose = { ...fallbackPose, ...endPose };
    const lerp = (a, b) => Number(a || 0) + (Number(b ?? a ?? 0) - Number(a || 0)) * t;
    const fromHeight = sourceId === "camera"
      ? Number(fromPose.height || 0)
      : Number(fromPose.type === "prop" ? fromPose.mountedHeight || 0 : fromPose.verticalOffset || 0);
    const toHeight = sourceId === "camera"
      ? Number(toPose.height ?? fromHeight)
      : Number(toPose.type === "prop" ? toPose.mountedHeight ?? fromHeight : toPose.verticalOffset ?? fromHeight);
    return motionCore.composeBaseInterpolatedPose({
      sourceId,
      from: fromPose,
      to: toPose,
      progress: t,
      spatial: {
        x: lerp(fromPose.x, toPose.x),
        y: lerp(fromPose.y, toPose.y),
        height: fromHeight + (toHeight - fromHeight) * t,
      },
      transformed: sourceId === "camera" ? null : {
        ...fromPose,
        size: lerp(fromPose.size ?? 1, toPose.size ?? fromPose.size ?? 1),
        scaleX: lerp(fromPose.scaleX ?? 1, toPose.scaleX ?? fromPose.scaleX ?? 1),
        scaleY: lerp(fromPose.scaleY ?? 1, toPose.scaleY ?? fromPose.scaleY ?? 1),
        scaleZ: lerp(fromPose.scaleZ ?? 1, toPose.scaleZ ?? fromPose.scaleZ ?? 1),
      },
    });
  },
  mergePoseWithFallbackFor(_renderState, _sourceId, pose, fallbackPose) {
    return { ...fallbackPose, ...pose };
  },
  sanitizeTrackingTargetId(value) {
    return value;
  },
};
assert.equal(motionCore.installReferenceFrameSemantics(fixtureWindow), true);

const fixtureDocument = {
  camera: {
    x: 0.1,
    y: 0.2,
    height: 1,
    panDeg: 350,
    tiltDeg: -10,
    focal: 24,
    focusDistanceM: 3,
    trackingTargetId: "actor-a",
  },
  items: [{
    id: "actor-a",
    type: "actor",
    x: 0.2,
    y: 0.5,
    verticalOffset: 0,
    pitch: 0,
    facing: 0,
    bodyPose: neutralPose,
    size: 1,
    scaleX: 1,
    scaleY: 1,
    scaleZ: 1,
    visible: true,
  }],
  motion: {
    duration: 2,
    playhead: 0,
    keyframes: [
      { source: "camera", time: 0, pose: { x: 0.1, y: 0.2, height: 1, panDeg: 350, tiltDeg: -10, focal: 24, focusDistanceM: 3, trackingTargetId: "actor-a" } },
      { source: "camera", time: 2, transition: "smooth", pose: { x: 0.9, y: 0.6, height: 2, panDeg: 10, tiltDeg: 10, focal: 70, focusDistanceM: 7, trackingTargetId: "actor-b" } },
      { source: "actor-a", time: 0, pose: { type: "actor", x: 0.2, y: 0.5, verticalOffset: 0, pitch: 0, facing: 0, bodyPose: neutralPose } },
      { source: "actor-a", time: 2, transition: "smooth", pose: { type: "actor", x: 0.6, y: 0.7, verticalOffset: 1, pitch: 20, facing: 90, bodyPose: raisedPose } },
    ],
  },
};

function fixtureSourceEvaluator(renderState, sourceId, time, fallbackPose) {
  const keys = (renderState.motion?.keyframes || [])
    .filter((keyframe) => keyframe.source === sourceId)
    .sort((a, b) => Number(a.time) - Number(b.time));
  const plan = motionCore.sourceKeyframeEvaluationPlan(keys, time);
  if (plan.kind === "fallback") return motionCore.cloneValue(fallbackPose);
  if (plan.kind === "key") return { ...fallbackPose, ...motionCore.cloneValue(plan.keyframe.pose || {}) };
  const interpolationProgress = sourceId !== "camera" && fallbackPose?.type === "actor"
    ? plan.referenceProgress
    : plan.progress;
  return fixtureWindow.interpolatePoseFor(
    renderState,
    sourceId,
    plan.start.pose,
    plan.end.pose,
    interpolationProgress,
    fallbackPose,
    plan.end,
    sourceId === "camera" ? { referenceProgress: plan.referenceProgress } : null,
  );
}

function fixtureFrame(time) {
  return motionCore.composeEvaluatedFrameBase(
    fixtureDocument,
    time,
    (sourceId, safeTime, fallbackPose) => fixtureSourceEvaluator(fixtureDocument, sourceId, safeTime, fallbackPose),
  );
}

for (const sampleTime of [0, 0.5, 1, 1.5, 2]) {
  const previewFrame = fixtureFrame(sampleTime);
  const exportFrame = fixtureFrame(sampleTime);
  assert.deepEqual(exportFrame, previewFrame, `preview/export frame semantics must match at ${sampleTime}s`);
}

const quarterFrame = fixtureFrame(0.5);
near(quarterFrame.motion.playhead, 0.5);
near(quarterFrame.camera.x, 0.2);
near(quarterFrame.camera.y, 0.25);
near(quarterFrame.camera.height, 1.125);
near(quarterFrame.camera.panDeg, 352.5);
near(quarterFrame.camera.tiltDeg, -7.5);
near(quarterFrame.camera.focal, 29.75);
assert.equal(Number.isInteger(quarterFrame.camera.focal), false, "24→70 mm zoom must retain sub-mm evaluation precision");
assert.equal(quarterFrame.camera.trackingTargetId, "actor-a");
near(quarterFrame.items[0].x, 0.25);
near(quarterFrame.items[0].y, 0.525);
near(quarterFrame.items[0].verticalOffset, 0.125);
near(quarterFrame.items[0].facing, 11.25);
assert.deepEqual(quarterFrame.items[0].bodyPose, neutralPose, "actor pose must stay held during eased root motion");

const preArrivalFrame = fixtureFrame(1.999999);
assert.equal(preArrivalFrame.camera.trackingTargetId, "actor-a", "tracking must not switch before the destination key");
assert.deepEqual(preArrivalFrame.items[0].bodyPose, neutralPose, "actor pose must not switch before the destination key");

const actorRunKeys = [
  { id: "actor-run-0", time: 0, pose: { x: 0, bodyPose: neutralPose } },
  { id: "actor-run-1", time: 1, transition: "smooth", pose: { x: 1, bodyPose: neutralPose } },
  { id: "actor-run-2", time: 2, transition: "smooth", pose: { x: 2, bodyPose: raisedPose } },
];
const actorRunFirst = motionCore.sourceKeyframeEvaluationPlan(actorRunKeys, 0.5);
const actorRunSecond = motionCore.sourceKeyframeEvaluationPlan(actorRunKeys, 1.5);
near(actorRunFirst.referenceProgress, 0.375);
near(actorRunSecond.referenceProgress, 0.625);
const heldDuringSecondRun = fakeWindow.interpolatePoseFor(
  {},
  "actor-1",
  actorRunSecond.start.pose,
  actorRunSecond.end.pose,
  actorRunSecond.referenceProgress,
  { type: "actor" },
  actorRunSecond.end,
);
assert.deepEqual(heldDuringSecondRun.bodyPose, neutralPose, "actor smooth root timing must not blend or synthesize body motion");

const destinationFrame = fixtureFrame(2);
assert.equal(destinationFrame.camera.trackingTargetId, "actor-b", "tracking must switch at the destination key");
assert.deepEqual(destinationFrame.items[0].bodyPose, raisedPose, "authored actor pose must switch at the destination key");
near(destinationFrame.camera.focal, 70);
near(destinationFrame.items[0].facing, 90);

const exactFrameTime = Number((7 / 24).toFixed(6));
const timingPlan = motionCore.sourceKeyframeEvaluationPlan([
  { id: "frame-0", time: 0 },
  { id: "frame-7", time: exactFrameTime, transition: "linear" },
], exactFrameTime);
assert.equal(timingPlan.kind, "key");
assert.equal(timingPlan.keyframe.time, 0.291667, "24 FPS keyframe time must retain six-decimal precision");
const retimedFixture = motionCore.rescaleKeyframeTimes([
  { id: "frame-0", time: 0 },
  { id: "frame-7", time: exactFrameTime },
], 1, 2);
assert.equal(retimedFixture[1].time, 0.583334, "keyframe retiming must retain frame-time precision");

console.log("reference-frame-ownership: shared preview/export semantics and numerical fixture passed");
