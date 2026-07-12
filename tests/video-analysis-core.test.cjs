const assert = require("node:assert/strict");
const {
  assignTrackCandidates,
  accumulateCameraTransforms,
  classifyCameraMotion,
  compensatedMotionFeatures,
  estimateGlobalFrameMotion,
  fitFrameSize,
  inferSustainedActorCount,
  mapActorScreenPose,
  mapReferenceDelta,
  projectScreenToStage3D,
  resolveDraftDuration,
  circularArcPoint,
  constrainPathEndpoint,
  normalizePathMode,
  normalizeTransition,
  quadraticBezierPoint,
  samplePlanarPath,
  smoothCameraTransforms,
  stabilizeDetection,
  transitionProgress,
} = require("../video-analysis-core.js");

const width = 96;
const height = 54;

assert.deepEqual(fitFrameSize(1080, 1920, 512), { width: 288, height: 512 });
assert.deepEqual(fitFrameSize(1920, 1080, 240), { width: 240, height: 135 });
assert.equal(resolveDraftDuration(5, []), 5, "a short draft must replace the default timeline length");
assert.equal(resolveDraftDuration(5, [{ time: 12 }]), 12, "manual keys beyond the draft must remain reachable");
assert.equal(resolveDraftDuration(5, [{ time: 12, provenance: { type: "reference" } }]), 5, "generated keys must not extend a replacement draft");

function patternedFrame(seed = 0) {
  const frame = new Float32Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let hash = Math.imul(x + seed * 101, 374761393) + Math.imul(y + 17, 668265263);
      hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
      frame[y * width + x] = 22 + ((hash ^ (hash >>> 16)) >>> 0) % 211;
    }
  }
  return frame;
}

function shiftedFrame(source, dx, dy) {
  const frame = new Float32Array(source.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const targetX = (x + dx + width) % width;
      const targetY = (y + dy + height) % height;
      frame[targetY * width + targetX] = source[y * width + x];
    }
  }
  return frame;
}

function sample(luma) {
  let total = 0;
  const histogram = new Float32Array(16);
  luma.forEach((value) => {
    total += value;
    histogram[Math.min(15, Math.floor(value / 16))] += 1 / luma.length;
  });
  return { luma, width, height, mean: total / luma.length, histogram };
}

const base = patternedFrame();
const staticMotion = estimateGlobalFrameMotion(sample(base), sample(base));
assert.equal(staticMotion.cut, false);
assert.ok(Math.abs(staticMotion.dx) <= 1 / width, JSON.stringify(staticMotion));
assert.ok(Math.abs(staticMotion.dy) <= 1 / height, JSON.stringify(staticMotion));
assert.ok(staticMotion.confidence > 0.9);

const shifted = shiftedFrame(base, 4, -2);
const panMotion = estimateGlobalFrameMotion(sample(base), sample(shifted));
assert.equal(panMotion.cut, false);
assert.ok(Math.abs(panMotion.dx * width - 4) <= 1, `expected dx near 4px, got ${panMotion.dx * width}`);
assert.ok(Math.abs(panMotion.dy * height + 2) <= 1, `expected dy near -2px, got ${panMotion.dy * height}`);

const compensatedPan = compensatedMotionFeatures(sample(base), sample(shifted), panMotion);
assert.ok(compensatedPan.energy < 0.02, `pure camera pan leaked ${compensatedPan.energy}`);

const actorMove = new Float32Array(shifted);
for (let y = 20; y < 32; y += 1) {
  for (let x = 55; x < 67; x += 1) actorMove[y * width + x] = 255;
}
const actorPreviousSample = sample(base);
const actorCurrentSample = sample(actorMove);
const probeDifference = Math.abs(actorPreviousSample.luma[22 * width + 52] - (actorCurrentSample.luma[20 * width + 56] - (actorCurrentSample.mean - actorPreviousSample.mean)));
assert.ok(probeDifference > 17, `probe difference ${probeDifference}`);
const actorMotion = compensatedMotionFeatures(actorPreviousSample, actorCurrentSample, panMotion);
assert.ok(actorMotion.energy > compensatedPan.energy, JSON.stringify({ panMotion, compensatedPan, actorMotion }));
assert.ok(actorMotion.regions.length > 0, JSON.stringify(actorMotion));

const cutFrame = new Float32Array(width * height);
for (let y = 0; y < height; y += 1) {
  for (let x = 0; x < width; x += 1) {
    cutFrame[y * width + x] = ((x < width / 2) !== (y < height / 2)) ? 235 : 18;
  }
}
const cutMotion = estimateGlobalFrameMotion(sample(base), sample(cutFrame));
assert.equal(cutMotion.cut, true);

const right = mapReferenceDelta(1, 0, 0, { lateralScale: 0.8, rotation: 0 });
assert.ok(Math.abs(right.x - 0.8) < 0.0001 && Math.abs(right.y) < 0.0001);
const down = mapReferenceDelta(1, 0, 0, { lateralScale: 0.8, rotation: 90 });
assert.ok(Math.abs(down.x) < 0.0001 && Math.abs(down.y - 0.8) < 0.0001);
const mirrored = mapReferenceDelta(1, 0, 0, { lateralScale: 0.8, mirrorX: true });
assert.ok(Math.abs(mirrored.x + 0.8) < 0.0001);
const actorOrigin = { x: 0.3, y: 0.7, size: 0.4 };
const actorAnchor = { x: 0.42, y: 0.36 };
const anchoredStart = mapActorScreenPose(actorOrigin, actorOrigin, actorAnchor, { anchorToCurrent: true });
assert.deepEqual(anchoredStart, actorAnchor);
const actorMovedRight = mapActorScreenPose(
  { x: 0.5, y: 0.7, size: 0.4 },
  actorOrigin,
  actorAnchor,
  { anchorToCurrent: true, lateralScale: 0.8 },
);
assert.ok(Math.abs(actorMovedRight.x - 0.58) < 0.0001 && Math.abs(actorMovedRight.y - 0.36) < 0.0001);
const actorMovedDownOnMap = mapActorScreenPose(
  { x: 0.5, y: 0.7, size: 0.4 },
  actorOrigin,
  actorAnchor,
  { anchorToCurrent: true, lateralScale: 0.8, rotation: 90 },
);
assert.ok(Math.abs(actorMovedDownOnMap.x - 0.42) < 0.0001 && Math.abs(actorMovedDownOnMap.y - 0.52) < 0.0001);

const projectionCamera = {
  x: 0.5,
  y: 0.92,
  aimX: 0.5,
  aimY: 0.48,
  height: 1.7,
  focusHeight: 0.9,
  focal: 35,
};
const projectedCenter = projectScreenToStage3D(0.5, 0.82, projectionCamera, { aspect: 16 / 9, stageWidth: 12, stageDepth: 6.75 });
const projectedLeft = projectScreenToStage3D(0.35, 0.82, projectionCamera, { aspect: 16 / 9, stageWidth: 12, stageDepth: 6.75 });
const projectedRight = projectScreenToStage3D(0.65, 0.82, projectionCamera, { aspect: 16 / 9, stageWidth: 12, stageDepth: 6.75 });
assert.equal(projectedCenter.hit, true);
assert.ok(projectedCenter.confidence > 0.2, JSON.stringify(projectedCenter));
assert.ok(projectedLeft.x < projectedCenter.x && projectedRight.x > projectedCenter.x);

assert.equal(normalizeTransition("cut"), "cut");
assert.equal(normalizeTransition("unknown"), "smooth");
assert.equal(transitionProgress(2.5, 2, 4, "linear"), 0.25);
assert.equal(transitionProgress(2.5, 2, 4, "smooth"), 0.125);
assert.equal(transitionProgress(3.99, 2, 4, "hold"), 0);
assert.equal(transitionProgress(4, 2, 4, "hold"), 1);
assert.equal(transitionProgress(3.99, 2, 4, "cut"), 0);
assert.equal(transitionProgress(4, 2, 4, "cut"), 1);

assert.equal(normalizePathMode("arc-left", "actor"), "arc-left");
assert.equal(normalizePathMode("drone", "actor"), "straight");
assert.equal(normalizePathMode("drone", "camera"), "drone");
assert.equal(normalizePathMode("free-curve", "actor"), "free-curve");
const horizontalCamera = constrainPathEndpoint(
  { x: 0.2, y: 0.35, aimX: 0.4, aimY: 0.35 },
  { x: 0.8, y: 0.52, aimX: 0.9, aimY: 0.52, moveAimWithCamera: true },
  "horizontal",
  "camera",
);
assert.equal(horizontalCamera.y, 0.35);
assert.ok(Math.abs(horizontalCamera.aimY - 0.35) < 0.000001);
const verticalActor = constrainPathEndpoint({ x: 0.41, y: 0.2 }, { x: 0.67, y: 0.8 }, "vertical", "actor");
assert.equal(verticalActor.x, 0.41);
const arcStart = { x: 0, y: 0 };
const arcEnd = { x: 1, y: 0 };
const arcMid = circularArcPoint(arcStart, arcEnd, 0.5, 1, 0.32);
assert.ok(arcMid.y > 0.3, JSON.stringify(arcMid));
assert.deepEqual(circularArcPoint(arcStart, arcEnd, 0, 1), arcStart);
assert.deepEqual(circularArcPoint(arcStart, arcEnd, 1, 1), arcEnd);
const oppositeArcMid = samplePlanarPath(arcStart, arcEnd, 0.5, "arc-right", { sourceType: "camera" });
assert.ok(oppositeArcMid.y < -0.3, JSON.stringify(oppositeArcMid));
const arcSamples = Array.from({ length: 11 }, (_, index) => circularArcPoint(arcStart, arcEnd, index / 10, 1, 0.32));
const circleFromThreePoints = (a, b, c) => {
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  const ux = ((a.x * a.x + a.y * a.y) * (b.y - c.y) + (b.x * b.x + b.y * b.y) * (c.y - a.y) + (c.x * c.x + c.y * c.y) * (a.y - b.y)) / d;
  const uy = ((a.x * a.x + a.y * a.y) * (c.x - b.x) + (b.x * b.x + b.y * b.y) * (a.x - c.x) + (c.x * c.x + c.y * c.y) * (b.x - a.x)) / d;
  return { x: ux, y: uy, radius: Math.hypot(a.x - ux, a.y - uy) };
};
const arcCircle = circleFromThreePoints(arcSamples[0], arcSamples[5], arcSamples[10]);
arcSamples.forEach((point) => {
  assert.ok(Math.abs(Math.hypot(point.x - arcCircle.x, point.y - arcCircle.y) - arcCircle.radius) < 0.000001);
});
const straightQuarter = samplePlanarPath({ x: 0.2, y: 0.3 }, { x: 0.6, y: 0.7 }, 0.25, "horizontal", { sourceType: "camera" });
assert.ok(Math.abs(straightQuarter.x - 0.3) < 0.000001 && Math.abs(straightQuarter.y - 0.3) < 0.000001);
const verticalQuarter = samplePlanarPath({ x: 0.2, y: 0.3 }, { x: 0.6, y: 0.7 }, 0.25, "vertical", { sourceType: "camera" });
assert.ok(Math.abs(verticalQuarter.x - 0.2) < 0.000001 && Math.abs(verticalQuarter.y - 0.4) < 0.000001);
const freeCurveMid = quadraticBezierPoint({ x: 0, y: 0 }, { x: 0.5, y: 1 }, { x: 1, y: 0 }, 0.5);
assert.deepEqual(freeCurveMid, { x: 0.5, y: 0.5 });
assert.deepEqual(samplePlanarPath({ x: 0, y: 0 }, { x: 1, y: 0 }, 0.5, "free-curve", {
  sourceType: "actor",
  control: { x: 0.5, y: 1 },
}), { x: 0.5, y: 0.5 });

const accumulatedPan = accumulateCameraTransforms([
  { dx: 0, dy: 0, scale: 1, confidence: 1 },
  { dx: 0.1, dy: 0, scale: 1, confidence: 1 },
  { dx: 0.05, dy: 0, scale: 1, confidence: 1 },
]);
assert.ok(Math.abs(accumulatedPan[2].tx - 0.15) < 0.0001);
const stabilizedPerson = stabilizeDetection({ x: 0.65, y: 0.5, size: 0.4, width: 0.16 }, accumulatedPan[2], 1);
assert.ok(Math.abs(stabilizedPerson.x - 0.5) < 0.0001);
assert.equal(stabilizedPerson.rawX, 0.65);

const accumulatedZoom = accumulateCameraTransforms([
  { dx: 0, dy: 0, scale: 1, confidence: 1 },
  { dx: 0, dy: 0, scale: 1.1, confidence: 1 },
]);
const stabilizedZoomPerson = stabilizeDetection({ x: 0.61, y: 0.5, size: 0.44, width: 0.176 }, accumulatedZoom[1], 1);
assert.ok(Math.abs(stabilizedZoomPerson.x - 0.6) < 0.0001);
assert.ok(Math.abs(stabilizedZoomPerson.size - 0.4) < 0.0001);

const transformAfterCut = accumulateCameraTransforms([
  { dx: 0, dy: 0, scale: 1, confidence: 1 },
  { dx: 0.1, dy: 0, scale: 1, confidence: 1 },
  { dx: 0, dy: 0, scale: 1, confidence: 0, cut: true },
]);
assert.equal(transformAfterCut[2].shot, 2);
assert.equal(transformAfterCut[2].tx, 0);

const smoothedJitter = smoothCameraTransforms([
  { tx: 0, ty: 0, scale: 1, shot: 1, cut: false },
  { tx: 0.1, ty: 0, scale: 1, shot: 1, cut: false },
  { tx: 0, ty: 0, scale: 1, shot: 1, cut: false },
], 1);
assert.ok(smoothedJitter[1].tx < 0.1 && smoothedJitter[1].tx > 0);

assert.equal(classifyCameraMotion([
  { confidence: 1 },
  { dx: 0, dy: 0, scale: 1, confidence: 1 },
]).type, "static");
assert.equal(classifyCameraMotion([
  { confidence: 1 },
  { dx: 0.01, dy: 0, scale: 1, confidence: 1 },
  { dx: 0.012, dy: 0, scale: 1, confidence: 1 },
]).type, "pan");
assert.equal(classifyCameraMotion([
  { confidence: 1 },
  { dx: 0, dy: 0, scale: 1.02, confidence: 1 },
  { dx: 0, dy: 0, scale: 1.02, confidence: 1 },
]).type, "zoom");
assert.equal(classifyCameraMotion([
  { confidence: 1 },
  { dx: 0.01, dy: 0, scale: 1, confidence: 1 },
  { dx: -0.01, dy: 0, scale: 1, confidence: 1 },
  { dx: 0.01, dy: 0, scale: 1, confidence: 1 },
], [0, 0.1, 0.1, 0.1]).type, "handheld");

const person = (score = 0.9) => ({ score });
assert.equal(inferSustainedActorCount([
  { people: [person()] },
  { people: [person(), person()] },
  { people: [person()] },
  { people: [person()] },
], 1), 1, "one-frame false positive must not raise actor count");
assert.equal(inferSustainedActorCount([
  { people: [person(), person()] },
  { people: [person(), person()] },
  { people: [person(), person()] },
  { people: [person()] },
], 1), 2, "sustained two-person detection must raise actor count");
const scatteredDetections = Array.from({ length: 80 }, (_, index) => ({
  people: index % 5 === 0 ? [person(), person()] : [person()],
}));
assert.equal(inferSustainedActorCount(scatteredDetections, 1), 1, "scattered detections must not count as sustained");
const sustainedDetections = Array.from({ length: 80 }, (_, index) => ({
  people: index >= 20 && index < 30 ? [person(), person()] : [person()],
}));
assert.equal(inferSustainedActorCount(sustainedDetections, 1), 2, "a consecutive run must raise actor count");
const shortShotDetections = Array.from({ length: 80 }, (_, index) => ({
  people: index >= 30 && index < 34 ? [person(), person(), person()] : [person()],
}));
assert.equal(inferSustainedActorCount(shortShotDetections, 1), 3, "a short multi-person shot must raise actor count");

assert.deepEqual(assignTrackCandidates([
  { x: 0.08, y: 0.1, vx: 0, vy: 0, size: 0.3, initialized: false },
], [
  { x: 0.92, y: 0.88, size: 0.34, score: 0.91 },
]), [0], "an uninitialized track must acquire a distant first detection");

assert.deepEqual(assignTrackCandidates([
  { x: 0.2, y: 0.3, vx: 0, vy: 0, size: 0.3, initialized: true },
  { x: 0.8, y: 0.3, vx: 0, vy: 0, size: 0.3, initialized: true },
], [
  { x: 0.78, y: 0.31, size: 0.3, score: 0.9 },
  { x: 0.22, y: 0.29, size: 0.3, score: 0.9 },
]), [1, 0], "initialized tracks must preserve nearby identities");

console.log("video-analysis-core: motion, stabilization, calibration, and transition scenarios passed");
