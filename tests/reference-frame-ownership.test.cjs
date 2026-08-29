const assert = require("node:assert/strict");

const motionCore = require("../motion-core.js");
const runtimeCore = require("../previs-runtime-core.js");

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

console.log("reference-frame-ownership: motion-core owns the shared preview/export evaluator semantics");
