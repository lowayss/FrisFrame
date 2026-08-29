const assert = require("node:assert/strict");

const {
  buildCameraRail,
  createTargetTransaction,
  interpolateSceneObject,
  normalizeSceneObject,
  sample3DWaypoint,
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

console.log("scene-blocking-core: object model, 3D waypoints, camera rail, and target transactions passed");
