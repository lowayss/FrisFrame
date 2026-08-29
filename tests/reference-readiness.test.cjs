const assert = require("node:assert/strict");

const {
  SEEDANCE_REFERENCE_MAX_SECONDS,
  evaluateProjectReferenceReadiness,
  evaluateReferenceReadiness,
  isFrameAligned,
} = require("../previs-runtime-core.js");

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

const projectResults = evaluateProjectReferenceReadiness({
  scenes: [{ number: 1, cuts: [{ number: 1, title: "Ready", blocking: baseBlocking() }, { number: 2, title: "Review", blocking: longShot }] }],
});
assert.equal(projectResults.length, 2);
assert.equal(projectResults[0].readiness.status, "ready");
assert.equal(projectResults[1].readiness.status, "review");

console.log("reference-readiness: blocking, review, and non-false-positive rules passed");
