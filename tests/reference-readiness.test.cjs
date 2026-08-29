const assert = require("node:assert/strict");

const motion = require("../motion-core.js");
const workflow = require("../reference-workflow-core.js");
const {
  SEEDANCE_REFERENCE_MAX_SECONDS,
  evaluateProjectReferenceReadiness,
  evaluateReferenceReadiness,
  isFrameAligned,
  referenceFinalCameraExposure,
  referenceTailDiscreteEvents,
} = motion;

assert.equal(workflow.SEEDANCE_REFERENCE_MAX_SECONDS, motion.SEEDANCE_REFERENCE_MAX_SECONDS,
  "workflow must expose the motion-core Seedance reference limit");
assert.equal(workflow.collectReferenceBatchCuts, motion.collectReferenceBatchCuts,
  "workflow must reuse the motion-core batch-cut collector");
assert.equal(workflow.evaluateReferenceReadiness, motion.evaluateReferenceReadiness,
  "workflow must reuse the motion-core readiness evaluator");
assert.equal(workflow.evaluateProjectReferenceReadiness, motion.evaluateProjectReferenceReadiness,
  "workflow must reuse the motion-core project readiness evaluator");
assert.equal(workflow.partitionReferenceBatchByReadiness, motion.partitionReferenceBatchByReadiness,
  "workflow must reuse the motion-core READY/REVIEW/BLOCKED partitioner");

function baseBlocking(overrides = {}) {
  const actor = { id: "actor-1", type: "actor", name: "A", x: 0.45, y: 0.5, facing: 0 };
  return {
    camera: { x: 0.8, y: 0.5, height: 1.6, panDeg: 180, tiltDeg: -4, focal: 50, trackingTargetId: "actor-1" },
    items: [actor],
    motion: {
      duration: 5,
      fps: 24,
      exportRange: { start: 0, end: 5 },
      keyframes: [
        { id: "cam-0", source: "camera", time: 0, pose: { x: 0.8, y: 0.5, height: 1.6, panDeg: 180, tiltDeg: -4, focal: 50, trackingTargetId: "actor-1" } },
        { id: "cam-1", source: "camera", time: 2, pose: { x: 0.7, y: 0.5, height: 1.6, panDeg: 180, tiltDeg: -4, focal: 50, trackingTargetId: "actor-1" } },
        { id: "actor-0", source: "actor-1", time: 0, pose: { x: 0.45, y: 0.5, facing: 0 } },
        { id: "actor-1", source: "actor-1", time: 3, pose: { x: 0.55, y: 0.5, facing: 0 } },
      ],
    },
    ...overrides,
  };
}

assert.equal(SEEDANCE_REFERENCE_MAX_SECONDS, 30);
assert.equal(isFrameAligned(1, 24), true);
assert.equal(isFrameAligned(1.041667, 24), true);
assert.equal(isFrameAligned(1.01, 24), false);

const ready = evaluateReferenceReadiness(baseBlocking());
assert.equal(ready.status, "ready");
assert.equal(ready.score, 100);
assert.equal(ready.errorCount, 0);
assert.equal(ready.warningCount, 0);
assert.equal(ready.stats.actorCount, 1);
assert.equal(ready.stats.cameraKeyCount, 2);

const staticEstablishing = evaluateReferenceReadiness({
  camera: { x: 0.8, y: 0.5, height: 1.6, panDeg: 180, tiltDeg: -4, focal: 35, trackingTargetId: "" },
  items: [],
  motion: { duration: 4, fps: 24, keyframes: [] },
});
assert.equal(staticEstablishing.status, "ready", "static/actorless establishing shots must not be failed just for being static or actorless");

const longShot = baseBlocking();
longShot.motion.duration = 35;
longShot.motion.exportRange = { start: 0, end: 35 };
const longResult = evaluateReferenceReadiness(longShot);
assert.equal(longResult.status, "review");
assert.ok(longResult.issues.some((issue) => issue.code === "duration-long"));
assert.ok(longResult.issues.some((issue) => issue.code === "export-range-long"));

const badTracking = baseBlocking();
badTracking.camera.trackingTargetId = "missing-actor";
const badTrackingResult = evaluateReferenceReadiness(badTracking);
assert.equal(badTrackingResult.status, "blocked");
assert.ok(badTrackingResult.issues.some((issue) => issue.code === "tracking-missing"));

const duplicate = baseBlocking();
duplicate.motion.keyframes.push({
  id: "cam-duplicate",
  source: "camera",
  time: 2,
  pose: { x: 0.65, y: 0.5, height: 1.6, panDeg: 180, tiltDeg: -4, focal: 50 },
});
const duplicateResult = evaluateReferenceReadiness(duplicate);
assert.equal(duplicateResult.status, "blocked");
assert.ok(duplicateResult.issues.some((issue) => issue.code === "duplicate-key-time"));

const offGrid = baseBlocking();
offGrid.motion.keyframes[1].time = 2.01;
const offGridResult = evaluateReferenceReadiness(offGrid);
assert.equal(offGridResult.status, "review");
assert.ok(offGridResult.issues.some((issue) => issue.code === "keys-off-frame-grid"));

const missingSource = baseBlocking();
missingSource.motion.keyframes.push({ id: "ghost", source: "missing", time: 4, pose: { x: 0.2, y: 0.3 } });
const missingSourceResult = evaluateReferenceReadiness(missingSource);
assert.equal(missingSourceResult.status, "blocked");
assert.ok(missingSourceResult.issues.some((issue) => issue.code === "key-source-missing"));

const invalidRange = baseBlocking();
invalidRange.motion.exportRange = { start: 4, end: 2 };
const invalidRangeResult = evaluateReferenceReadiness(invalidRange);
assert.equal(invalidRangeResult.status, "blocked");
assert.ok(invalidRangeResult.issues.some((issue) => issue.code === "export-range-invalid"));

const smoothEnd = baseBlocking();
smoothEnd.motion.keyframes.push({
  id: "cam-end-smooth",
  source: "camera",
  time: 5,
  transition: "smooth",
  pose: { x: 0.6, y: 0.5, height: 1.6, panDeg: 180, tiltDeg: -4, focal: 50, trackingTargetId: "actor-1" },
});
const smoothEndResult = evaluateReferenceReadiness(smoothEnd);
assert.equal(smoothEndResult.status, "review", "a changed final camera framing with zero CFR samples should be reviewed");
assert.ok(smoothEndResult.issues.some((issue) => issue.code === "camera-final-framing-short"));
assert.equal(smoothEndResult.stats.tailDiscreteEventCount, 0, "smooth framing warning must not be misclassified as a discrete event");
assert.equal(smoothEndResult.stats.finalCameraExposureFrames, 0);
const smoothEndExposure = referenceFinalCameraExposure(smoothEnd, { start: 0, end: 5 }, 24, 2);
assert.equal(smoothEndExposure.changed, true);
assert.equal(smoothEndExposure.exposureFrames, 0);

const oneFrameCameraEnd = baseBlocking();
oneFrameCameraEnd.motion.keyframes.push({
  id: "cam-end-one-frame",
  source: "camera",
  time: 119 / 24,
  transition: "smooth",
  pose: { x: 0.6, y: 0.5, height: 1.6, panDeg: 180, tiltDeg: -4, focal: 50, trackingTargetId: "actor-1" },
});
const oneFrameCameraEndResult = evaluateReferenceReadiness(oneFrameCameraEnd);
assert.equal(oneFrameCameraEndResult.status, "review");
assert.ok(oneFrameCameraEndResult.issues.some((issue) => issue.code === "camera-final-framing-short"));
assert.equal(oneFrameCameraEndResult.stats.finalCameraExposureFrames, 1);

const twoFrameCameraEnd = baseBlocking();
twoFrameCameraEnd.motion.keyframes.push({
  id: "cam-end-two-frames",
  source: "camera",
  time: 118 / 24,
  transition: "smooth",
  pose: { x: 0.6, y: 0.5, height: 1.6, panDeg: 180, tiltDeg: -4, focal: 50, trackingTargetId: "actor-1" },
});
const twoFrameCameraEndResult = evaluateReferenceReadiness(twoFrameCameraEnd);
assert.equal(twoFrameCameraEndResult.status, "ready", "two directly sampled destination frames should be enough for readiness");
assert.equal(twoFrameCameraEndResult.stats.finalCameraExposureFrames, 2);

const redundantCameraEnd = baseBlocking();
redundantCameraEnd.motion.keyframes.push({
  id: "cam-end-redundant",
  source: "camera",
  time: 5,
  transition: "smooth",
  pose: { x: 0.7, y: 0.5, height: 1.6, panDeg: 180, tiltDeg: -4, focal: 50, trackingTargetId: "actor-1" },
});
const redundantCameraEndResult = evaluateReferenceReadiness(redundantCameraEnd);
assert.equal(redundantCameraEndResult.status, "ready", "a redundant final camera key must not trigger a framing warning");
assert.ok(!redundantCameraEndResult.issues.some((issue) => issue.code === "camera-final-framing-short"));

const holdEnd = baseBlocking();
holdEnd.motion.keyframes.push({
  id: "actor-end-hold",
  source: "actor-1",
  time: 5,
  transition: "hold",
  pose: { x: 0.6, y: 0.5, facing: 0 },
});
const holdEndResult = evaluateReferenceReadiness(holdEnd);
assert.equal(holdEndResult.status, "review");
assert.ok(holdEndResult.issues.some((issue) => issue.code === "tail-discrete-event-unsampled"));
assert.equal(holdEndResult.stats.tailDiscreteEventCount, 1);

const poseEnd = baseBlocking();
poseEnd.items[0].bodyPose = { leftArm: { x: 0 } };
poseEnd.motion.keyframes[2].pose.bodyPose = { leftArm: { x: 0 } };
poseEnd.motion.keyframes.push({
  id: "actor-end-pose",
  source: "actor-1",
  time: 5,
  transition: "smooth",
  pose: { x: 0.55, y: 0.5, facing: 0, bodyPose: { leftArm: { x: -40 } } },
});
const poseEndResult = evaluateReferenceReadiness(poseEnd);
assert.equal(poseEndResult.status, "review");
assert.ok(poseEndResult.issues.some((issue) => issue.code === "tail-discrete-event-unsampled"));

const trackingEnd = baseBlocking();
trackingEnd.items.push({ id: "actor-2", type: "actor", name: "B", x: 0.6, y: 0.5, facing: 180 });
trackingEnd.motion.keyframes.push({
  id: "cam-end-tracking",
  source: "camera",
  time: 5,
  transition: "smooth",
  pose: { x: 0.7, y: 0.5, height: 1.6, panDeg: 180, tiltDeg: -4, focal: 50, trackingTargetId: "actor-2" },
});
const trackingEndResult = evaluateReferenceReadiness(trackingEnd);
assert.equal(trackingEndResult.status, "review");
assert.ok(trackingEndResult.issues.some((issue) => issue.code === "tail-discrete-event-unsampled"));

const tailPlan = referenceTailDiscreteEvents(trackingEnd, { start: 0, end: 5 }, 24);
assert.ok(Math.abs(tailPlan.lastSampleTime - 119 / 24) < 0.000001);
assert.equal(tailPlan.events.length, 1);
assert.ok(tailPlan.events[0].reasons.includes("tracking"));

const projectResults = evaluateProjectReferenceReadiness({
  scenes: [{ number: 1, cuts: [{ number: 1, title: "Ready", blocking: baseBlocking() }, { number: 2, title: "Review", blocking: longShot }] }],
});
assert.equal(projectResults.length, 2);
assert.equal(projectResults[0].readiness.status, "ready");
assert.equal(projectResults[1].readiness.status, "review");

console.log("reference-readiness: core ownership, blocking, review, and non-false-positive rules passed");
