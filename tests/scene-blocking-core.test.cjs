const assert = require("node:assert/strict");

const {
  buildCameraRail,
  createMassBlockingPlan,
  createTargetTransaction,
  interpolateSceneObject,
  massBlockFootprintBounds,
  massBlockToSceneObject,
  normalizeMassBlock,
  normalizeSceneObject,
  sample3DWaypoint,
  scenePointToWorld,
  validateMassBlocks,
  worldToScenePoint,
} = require("../scene-blocking-core.js");

const clone = (value) => JSON.parse(JSON.stringify(value));

const object = normalizeSceneObject({
  x: 1.4,
  y: -1,
  elevation: 2.5,
  facing: 350,
  size: 2,
  scaleX: 1.4,
});
assert.equal(object.x, 0.98);
assert.equal(object.y, 0.02);
assert.equal(object.elevation, 2.5);
assert.equal(object.scaleY, 1, "missing dimensions preserve the normal object scale");

const mid = interpolateSceneObject(
  { x: 0.2, y: 0.3, elevation: 0, facing: 350, size: 1, scaleX: 1, scaleY: 1, scaleZ: 1 },
  { x: 0.8, y: 0.7, elevation: 2, facing: 10, size: 2, scaleX: 2, scaleY: 3, scaleZ: 4, color: "#fff" },
  0.5,
);
assert.equal(mid.x, 0.5);
assert.equal(mid.elevation, 1);
assert.equal(mid.facing, 360);
assert.equal(mid.color, "#fff");

const waypoint = sample3DWaypoint(
  { x: 0.2, y: 0.3, elevation: 0 },
  { x: 0.8, y: 0.7, elevation: 3 },
  0.5,
  { x: 0.4, y: 0.6 },
);
assert.deepEqual(waypoint, { x: 0.4, y: 0.6, elevation: 1.5 });

const rail = buildCameraRail([
  { id: "late", time: 3, pose: { x: 0.8, y: 0.7, height: 2 } },
  { id: "early", time: 0, pose: { x: 0.2, y: 0.3, height: 1 } },
]);
assert.deepEqual(rail.map((point) => point.id), ["early", "late"]);
assert.equal(rail[1].height, 2);

const stage = { width: 36, depth: 20.25 };
const scenePoint = worldToScenePoint({ x: 9, z: -5.0625 }, stage);
assert.equal(Number(scenePoint.x.toFixed(4)), 0.75);
assert.equal(Number(scenePoint.y.toFixed(4)), 0.25);
assert.deepEqual(
  Object.fromEntries(Object.entries(scenePointToWorld(scenePoint, stage)).map(([key, value]) => [key, Number(value.toFixed(4))])),
  { x: 9, z: -5.0625 },
);

const mass = normalizeMassBlock({
  id: "back-wall",
  label: "Back wall mass",
  xM: 0,
  zM: -6,
  widthM: 10,
  heightM: 4,
  depthM: 0.4,
  rotationDeg: 0,
}, stage);
assert.equal(Number(mass.y.toFixed(4)), Number((0.5 - 6 / 20.25).toFixed(4)));
const massScene = massBlockToSceneObject(mass, stage);
assert.deepEqual(massScene.referenceDimensionsM, { width: 10, height: 4, depth: 0.4 });
assert.equal(massScene.referenceAnchorId, "back-wall");

const rotatedBounds = massBlockFootprintBounds({
  xM: 0,
  zM: 0,
  widthM: 4,
  depthM: 2,
  heightM: 2,
  rotationDeg: 90,
}, stage);
assert.equal(Number(rotatedBounds.width.toFixed(6)), 2);
assert.equal(Number(rotatedBounds.depth.toFixed(6)), 4);

const validation = validateMassBlocks([
  { id: "inside", xM: 0, zM: 0, widthM: 4, heightM: 2, depthM: 4, confidence: 0.9 },
  { id: "outside", xM: 17.5, zM: 0, widthM: 4, heightM: 2, depthM: 2, confidence: 0.4 },
], stage);
assert.ok(validation.issues.some((issue) => issue.code === "mass-outside-stage"));
assert.ok(validation.issues.some((issue) => issue.code === "mass-low-confidence"));

const plan = createMassBlockingPlan({
  stage,
  masses: [
    { id: "stage", label: "Stage", xM: 0, zM: 0, widthM: 12, heightM: 1.2, depthM: 8 },
    { id: "screen", label: "Screen", xM: 0, zM: -3.5, widthM: 8, heightM: 4, depthM: 0.3 },
  ],
});
assert.equal(plan.schema, "frisframe-mass-blocking");
assert.equal(plan.sceneObjects.length, 2);
assert.deepEqual(plan.sceneObjects[1].referenceDimensionsM, { width: 8, height: 4, depth: 0.3 });

const transaction = createTargetTransaction({ owner: "object-drag", targetIds: ["prop-1"], before: { x: 0 }, clone });
transaction.apply({ x: 1 });
assert.equal(transaction.changed, true);
assert.deepEqual(transaction.commit({ x: 1 }), {
  owner: "object-drag",
  targetIds: ["prop-1"],
  before: { x: 0 },
  after: { x: 1 },
});
assert.deepEqual(transaction.cancel(), { x: 0 }, "cancel always returns the transaction start state");

console.log("scene-blocking-core: object model, 3D waypoints, mass blocking, camera rail, and target transactions passed");
