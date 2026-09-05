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
const camera = { x: 0.5, y: 0.8, height: 1.6, focal: 50, panDeg: 270, tiltDeg: 0 };
const actorWorld = spatial.stageNormalizedToWorld(actor, { width: stage.width, depth: stage.depth });
const cameraWorld = spatial.stageNormalizedToWorld(camera, { width: stage.width, depth: stage.depth });
const actorCenterHeight = actor.referenceDimensionsM.height / 2;
const horizontalDistanceM = Math.hypot(actorWorld.x - cameraWorld.x, actorWorld.z - cameraWorld.z);
camera.tiltDeg = Math.atan2(actorCenterHeight - camera.height, horizontalDistanceM) * 180 / Math.PI;
const distanceM = Math.hypot(
  actorWorld.x - cameraWorld.x,
  actorWorld.z - cameraWorld.z,
  actorCenterHeight - camera.height,
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
assert.equal(ready.screenPositionPolicy, "diagnostic-only-no-readiness-impact");
assert.equal(ready.screenPositionChecks.length, 1);
assert.ok(ready.horizonCheck);
const readyScreen = ready.screenPositionChecks[0];
assert.equal(readyScreen.anchorId, "scale-actor-a");
assert.equal(readyScreen.itemId, actor.id);
assert.equal(readyScreen.inFront, true);
assert.equal(readyScreen.inFrame, true);
assert.ok(Math.abs(readyScreen.predictedX - 0.5) < 1e-8);
assert.ok(Math.abs(readyScreen.predictedY - 0.5) < 1e-8);
assert.ok(Math.abs(readyScreen.residualX) < 1e-8);
assert.ok(Math.abs(readyScreen.residualY) < 1e-8);

const badProjection = structuredClone(blocking);
badProjection.spatialGuide.anchors[0].imageHeight += 0.1;
const reviewProjection = workflow.validateReferenceSpaceBlocking(badProjection, { spatialCore: spatial });
assert.equal(reviewProjection.status, "review");
assert.ok(reviewProjection.issues.some((issue) => issue.code === "scale-anchor-frame-mismatch"));
const shiftedImageObservation = structuredClone(blocking);
shiftedImageObservation.spatialGuide.anchors[0].imageX = 0.62;
shiftedImageObservation.spatialGuide.anchors[0].imageY = 0.42;
const unchangedValidation = workflow.validateReferenceSpaceBlocking(shiftedImageObservation, { spatialCore: spatial });
assert.equal(unchangedValidation.status, "ready", "screen-position residual must remain diagnostic-only in this slice");
assert.equal(unchangedValidation.issues.length, 0);
assert.equal(unchangedValidation.screenPositionChecks.length, 1);
const shiftedCheck = unchangedValidation.screenPositionChecks[0];
assert.ok(Math.abs(shiftedCheck.residualX - 0.12) < 1e-8);
assert.ok(Math.abs(shiftedCheck.residualY + 0.08) < 1e-8);
const badPosition = structuredClone(blocking);
badPosition.items[0].x += 0.05;
const reviewPosition = workflow.validateReferenceSpaceBlocking(badPosition, { spatialCore: spatial });
assert.ok(reviewPosition.issues.some((issue) => issue.code === "anchor-x-mismatch"));

const nullObservations = structuredClone(blocking);
nullObservations.spatialGuide.anchors[0].imageX = null;
nullObservations.spatialGuide.anchors[0].imageY = null;
nullObservations.spatialGuide.anchors[0].worldX = null;
nullObservations.spatialGuide.anchors[0].worldZ = null;
nullObservations.spatialGuide.anchors[1].imageY = null;
const nullValidation = workflow.validateReferenceSpaceBlocking(nullObservations, { spatialCore: spatial });
assert.equal(nullValidation.status, "ready", "null optional observations must not create false REVIEW issues");
assert.equal(nullValidation.projectionChecks.length, 1, "valid Scale fraction must still be checked when optional position observations are absent");
assert.equal(nullValidation.screenPositionChecks.length, 0, "null image X/Y must not be converted to a synthetic screen observation");
assert.equal(nullValidation.horizonCheck, null, "null Horizon Y must remain absent");
assert.ok(!nullValidation.issues.some((issue) => ["anchor-x-mismatch", "anchor-z-mismatch", "horizon-mismatch"].includes(issue.code)));
const emptyObservations = structuredClone(nullObservations);
emptyObservations.spatialGuide.anchors[0].imageX = "";
emptyObservations.spatialGuide.anchors[0].imageY = "";
emptyObservations.spatialGuide.anchors[0].worldX = "";
emptyObservations.spatialGuide.anchors[0].worldZ = "";
emptyObservations.spatialGuide.anchors[1].imageY = "";
const emptyValidation = workflow.validateReferenceSpaceBlocking(emptyObservations, { spatialCore: spatial });
assert.equal(emptyValidation.status, "ready");
assert.equal(emptyValidation.screenPositionChecks.length, 0);
assert.equal(emptyValidation.horizonCheck, null);
const explicitZeroObservation = structuredClone(blocking);
explicitZeroObservation.spatialGuide.anchors[0].imageX = 0;
explicitZeroObservation.spatialGuide.anchors[0].imageY = 0;
const zeroValidation = workflow.validateReferenceSpaceBlocking(explicitZeroObservation, { spatialCore: spatial });
assert.equal(zeroValidation.status, "ready", "screen residual remains diagnostic-only even for a frame-edge observation");
assert.equal(zeroValidation.screenPositionChecks.length, 1);
assert.equal(zeroValidation.screenPositionChecks[0].observedX, 0);
assert.equal(zeroValidation.screenPositionChecks[0].observedY, 0);

console.log("reference-validation-ui: local screen diagnostics ignore missing/null observations, preserve explicit zero, and remain readiness-neutral");
