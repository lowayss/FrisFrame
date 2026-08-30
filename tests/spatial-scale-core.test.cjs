const assert = require("node:assert/strict");
const spatial = require("../spatial-scale-core.js");

const adult = spatial.actorDimensions({ size: 1, dummyScale: { scaleX: 1, scaleY: 1, scaleZ: 1 } });
assert.equal(adult.height, 1.78);
assert.equal(Number(adult.width.toFixed(2)), 0.54);

const tall = spatial.actorDimensions({
  size: 1.1,
  scaleX: 0.9,
  scaleY: 1.05,
  scaleZ: 1.2,
  dummyScale: { scaleX: 0.92, scaleY: 1.18, scaleZ: 0.92 },
});
assert.ok(tall.height > adult.height, "dummy and authored Y scale must affect actor height");
assert.ok(tall.depth > adult.depth, "authored Z scale must affect actor depth");
assert.equal(Number(spatial.actorRigScale(1).toFixed(4)), Number((1.78 / 1.98).toFixed(4)));

const prop = spatial.propDimensions({ width: 2.2, height: 0.9, depth: 0.86, size: 1.2, scaleX: 0.8, scaleY: 1.1, scaleZ: 1.25 });
assert.deepEqual(Object.fromEntries(Object.entries(prop).map(([key, value]) => [key, Number(value.toFixed(3))])), { width: 2.112, height: 1.188, depth: 1.29 });

const fit = spatial.fitBounds({ width: 4, height: 2, depth: 1, minY: -0.1 }, { width: 2, height: 3, depth: 0.5 });
assert.deepEqual(fit.scale, { x: 0.5, y: 1.5, z: 0.5 });
assert.equal(Number(fit.groundOffsetY.toFixed(3)), 0.15);

const perspective = spatial.perspectiveMetrics({ focalMm: 50, sensorWidthMm: 36, aspect: 16 / 9, distanceM: 10, subjectHeightM: 1.78 });
assert.ok(perspective.horizontalFovDeg > 39 && perspective.horizontalFovDeg < 40);
assert.ok(perspective.verticalFovDeg > 22 && perspective.verticalFovDeg < 23);
assert.ok(perspective.normalizedFrameHeight > 0.4 && perspective.normalizedFrameHeight < 0.5);

const stage = spatial.stageWorldSize({ aspect: 16 / 9 });
assert.equal(stage.width, 36);
assert.equal(Number(stage.depth.toFixed(2)), 20.25);
assert.deepEqual(
  Object.fromEntries(Object.entries(spatial.stageNormalizedToWorld({ x: 0.75, y: 0.25 }, stage)).map(([key, value]) => [key, Number(value.toFixed(4))])),
  { x: 9, z: -5.0625, y: 0 },
);
const normalized = spatial.worldToStageNormalized({ x: 9, z: -5.0625 }, stage);
assert.equal(Number(normalized.x.toFixed(4)), 0.75);
assert.equal(Number(normalized.y.toFixed(4)), 0.25);

const anchorFraction = perspective.normalizedFrameHeight;
const anchor = spatial.solveScaleAnchor({
  id: "actor-a",
  label: "actor height",
  axis: "height",
  physicalSizeM: 1.78,
  frameFraction: anchorFraction,
}, {
  focalMm: 50,
  sensorWidthMm: 36,
  aspect: 16 / 9,
});
assert.ok(Math.abs(anchor.inferredDistanceM - 10) < 1e-9, "scale anchor must recover camera distance from known focal length");

const solvedFocal = spatial.calibratePerspective({
  anchor: {
    axis: "height",
    physicalSizeM: 1.78,
    frameFraction: anchorFraction,
    distanceM: 10,
  },
  sensorWidthMm: 36,
  aspect: 16 / 9,
});
assert.ok(Math.abs(solvedFocal.focalMm - 50) < 1e-9, "perspective calibration must recover focal length from known distance");

const horizon = spatial.horizonFromTilt({ tiltDeg: 10, focalMm: 50, sensorWidthMm: 36, aspect: 16 / 9 });
const recoveredTilt = spatial.tiltFromHorizon({ horizonY: horizon, focalMm: 50, sensorWidthMm: 36, aspect: 16 / 9 });
assert.ok(Math.abs(recoveredTilt - 10) < 1e-9, "horizon calibration must round-trip camera tilt");
assert.ok(spatial.horizonFromTilt({ tiltDeg: -10, focalMm: 50, sensorWidthMm: 36, aspect: 16 / 9 }) < 0.5,
  "negative FrisFrame tilt looks down and must move the horizon above frame center");
assert.ok(spatial.tiltFromHorizon({ horizonY: 0.4, focalMm: 50, sensorWidthMm: 36, aspect: 16 / 9 }) < 0,
  "a horizon above frame center must calibrate to negative FrisFrame tilt");

const frontCenter = spatial.projectWorldPointToFrame({
  cameraPosition: { x: 0, y: 0, z: 0 },
  worldPoint: { x: 10, y: 0, z: 0 },
  panDeg: 0,
  tiltDeg: 0,
  focalMm: 50,
  sensorWidthMm: 36,
  aspect: 16 / 9,
});
assert.ok(Math.abs(frontCenter.frameX - 0.5) < 1e-9 && Math.abs(frontCenter.frameY - 0.5) < 1e-9,
  "a point on the camera forward axis must project to frame center");
assert.equal(frontCenter.inFrame, true);

const quarterRight = spatial.projectWorldPointToFrame({
  cameraPosition: { x: 0, y: 0, z: 0 },
  worldPoint: { x: 10, y: 0, z: 1.8 },
  panDeg: 0,
  tiltDeg: 0,
  focalMm: 50,
  sensorWidthMm: 36,
  aspect: 16 / 9,
});
assert.ok(Math.abs(quarterRight.frameX - 0.75) < 1e-9, "camera-local right must move toward larger normalized frame X");
assert.ok(Math.abs(quarterRight.frameY - 0.5) < 1e-9);

const quarterUp = spatial.projectWorldPointToFrame({
  cameraPosition: { x: 0, y: 0, z: 0 },
  worldPoint: { x: 10, y: 1.0125, z: 0 },
  panDeg: 0,
  tiltDeg: 0,
  focalMm: 50,
  sensorWidthMm: 36,
  aspect: 16 / 9,
});
assert.ok(Math.abs(quarterUp.frameY - 0.25) < 1e-9, "camera-local up must move toward smaller normalized frame Y");

const tiltedBasis = spatial.cameraBasis({ panDeg: 270, tiltDeg: -10 });
const alongTiltedForward = spatial.projectWorldPointToFrame({
  cameraPosition: { x: 2, y: 1.6, z: 4 },
  worldPoint: {
    x: 2 + tiltedBasis.forward.x * 10,
    y: 1.6 + tiltedBasis.forward.y * 10,
    z: 4 + tiltedBasis.forward.z * 10,
  },
  panDeg: 270,
  tiltDeg: -10,
  focalMm: 35,
  sensorWidthMm: 36,
  aspect: 16 / 9,
});
assert.ok(Math.abs(alongTiltedForward.frameX - 0.5) < 1e-9 && Math.abs(alongTiltedForward.frameY - 0.5) < 1e-9,
  "pan/tilt forward axis must remain the projected frame center");

const behind = spatial.projectWorldPointToFrame({
  cameraPosition: { x: 0, y: 0, z: 0 },
  worldPoint: { x: -1, y: 0, z: 0 },
  panDeg: 0,
  tiltDeg: 0,
  focalMm: 50,
  sensorWidthMm: 36,
  aspect: 16 / 9,
});
assert.equal(behind.inFront, false);
assert.equal(behind.frameX, null);
assert.equal(behind.frameY, null);

const overlay = spatial.fitOverlayRect({
  sourceWidth: 1920,
  sourceHeight: 1080,
  targetWidth: 1000,
  targetHeight: 1000,
  fit: "contain",
});
assert.ok(Math.abs(overlay.width - 1000) < 1e-9);
assert.equal(Number(overlay.height.toFixed(2)), 562.5);
assert.equal(Number(overlay.y.toFixed(2)), 218.75);
const overlayPoint = spatial.normalizedToOverlayPoint({ x: 0.25, y: 0.75 }, overlay);
const overlayNormalized = spatial.overlayPointToNormalized(overlayPoint, overlay);
assert.equal(Number(overlayNormalized.x.toFixed(6)), 0.25);
assert.equal(Number(overlayNormalized.y.toFixed(6)), 0.75);

const contract = spatial.normalizeReferenceSpaceSpec({
  source: { widthPx: 1920, heightPx: 1080, label: "reference" },
  camera: { focalMm: 35, horizonY: 0.42 },
  anchors: [{ id: "door", physicalSizeM: 2.1, frameFraction: 0.31 }],
  overlay: { opacity: 0.4 },
  sourceModel: "external-gpt",
});
assert.equal(contract.schema, "frisframe-reference-space");
assert.equal(contract.anchors.length, 1);
assert.equal(contract.overlay.opacity, 0.4);

console.log("spatial-scale-core: metric, anchor, perspective, world-to-frame projection, overlay, and stage-space checks passed");
