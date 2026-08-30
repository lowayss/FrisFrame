const assert = require("node:assert/strict");
const spatial = require("../spatial-scale-core.js");
const workflow = require("../reference-workflow-core.js");

const aspect = 16 / 9;
const stage = spatial.stageWorldSize({ aspect });
const actor = {
  id: "actor-a",
  type: "actor",
  x: 0.5,
  y: 0.5,
  size: 1,
  scaleX: 1,
  scaleY: 1,
  scaleZ: 1,
  verticalOffset: 0,
  facing: 0,
  referenceDimensionsM: { width: 0.54, height: 1.78, depth: 0.36 },
};
const camera = { x: 0.5, y: 0.8, height: 1.6, focal: 50, tiltDeg: -10 };
const actorWorld = spatial.stageNormalizedToWorld(actor, { width: stage.width, depth: stage.depth });
const cameraWorld = spatial.stageNormalizedToWorld(camera, { width: stage.width, depth: stage.depth });
const distanceM = Math.hypot(
  actorWorld.x - cameraWorld.x,
  actorWorld.z - cameraWorld.z,
  actor.referenceDimensionsM.height / 2 - camera.height,
);
const observedHeight = spatial.frameFractionForDistance({
  axis: "height",
  subjectSizeM: actor.referenceDimensionsM.height,
  distanceM,
  focalMm: camera.focal,
  sensorWidthMm: 36,
  aspect,
});
const horizonY = spatial.horizonFromTilt({ tiltDeg: camera.tiltDeg, focalMm: camera.focal, sensorWidthMm: 36, aspect });

const blocking = {
  aspect: "16:9",
  camera,
  cameraSetup: { sensorWidthMm: 36 },
  items: [actor],
  motion: { keyframes: [] },
  spatialGuide: {
    anchors: [
      {
        id: "scale-actor-a",
        label: "Actor height",
        kind: "scale-height",
        imageX: 0.5,
        imageY: 0.5,
        imageWidth: 0,
        imageHeight: observedHeight,
        worldX: actorWorld.x,
        worldZ: actorWorld.z,
        dimensionsM: actor.referenceDimensionsM,
        attachedItemId: actor.id,
      },
      {
        id: "reference-horizon",
        label: "Horizon",
        kind: "horizon",
        imageY: horizonY,
      },
    ],
  },
};

const ready = workflow.validateReferenceSpaceBlocking(blocking, { spatialCore: spatial });
assert.equal(ready.status, "ready");
assert.equal(ready.issues.length, 0);
assert.equal(ready.projectionChecks.length, 1);
assert.ok(ready.horizonCheck);

const overlayRect = { x: 100, y: 50, width: 960, height: 540 };
const ghostReady = workflow.buildReferenceGhostObservationModel(blocking, { spatialCore: spatial, overlayRect });
assert.equal(ghostReady.status, "ready");
assert.equal(ghostReady.scales.length, 1);
assert.equal(ghostReady.horizons.length, 1);
assert.equal(ghostReady.legend.observed, "reference");
assert.equal(ghostReady.legend.predicted, "current-camera");
assert.ok(Math.abs(ghostReady.scales[0].center.x - 580) < 1e-9);
assert.ok(Math.abs(ghostReady.scales[0].center.y - 320) < 1e-9);
assert.ok(Math.abs(ghostReady.scales[0].observedLengthPx - observedHeight * overlayRect.height) < 1e-9);
assert.ok(Math.abs(ghostReady.scales[0].predictedLengthPx - ghostReady.scales[0].observedLengthPx) < 1e-9);
assert.ok(Math.abs(ghostReady.horizons[0].observedYPx - (overlayRect.y + horizonY * overlayRect.height)) < 1e-9);
assert.ok(Math.abs(ghostReady.horizons[0].predictedYPx - ghostReady.horizons[0].observedYPx) < 1e-9);

const badProjection = structuredClone(blocking);
badProjection.spatialGuide.anchors[0].imageHeight += 0.1;
const reviewProjection = workflow.validateReferenceSpaceBlocking(badProjection, { spatialCore: spatial });
assert.equal(reviewProjection.status, "review");
assert.ok(reviewProjection.issues.some((issue) => issue.code === "scale-anchor-frame-mismatch"));
const ghostReview = workflow.buildReferenceGhostObservationModel(badProjection, { spatialCore: spatial, overlayRect });
assert.equal(ghostReview.status, "review");
assert.ok(Math.abs(ghostReview.scales[0].observedLengthPx - ghostReview.scales[0].predictedLengthPx) > 1);
assert.ok(ghostReview.issues.some((issue) => issue.code === "scale-anchor-frame-mismatch"));

const badPosition = structuredClone(blocking);
badPosition.items[0].x += 0.05;
const reviewPosition = workflow.validateReferenceSpaceBlocking(badPosition, { spatialCore: spatial });
assert.ok(reviewPosition.issues.some((issue) => issue.code === "anchor-x-mismatch"));

console.log("reference-validation-ui: anchor validation plus observed/current Ghost overlay geometry passed");
