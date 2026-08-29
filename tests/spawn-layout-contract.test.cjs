const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const match = app.match(/function nextItemSpawnPosition\(type\) \{[\s\S]*?\n\}/);
assert.ok(match, "app.js must expose deterministic non-overlapping spawn placement");

const sandbox = {
  state: { items: [] },
  clamp: (value, min, max) => Math.min(max, Math.max(min, Number(value))),
  finiteNumber: (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback,
  propDefinition: (id) => ({ kind: id === "room" ? "architecture" : "generic" }),
};
vm.createContext(sandbox);
vm.runInContext(`${match[0]}; this.nextItemSpawnPosition = nextItemSpawnPosition;`, sandbox);
const spawn = sandbox.nextItemSpawnPosition;

assert.deepEqual({ ...spawn("actor") }, { x: 0.38, y: 0.36 }, "first actor keeps the familiar default slot");
assert.deepEqual({ ...spawn("prop") }, { x: 0.52, y: 0.58 }, "first prop keeps the familiar default slot");

const addAtSpawn = (type, dummyType = "generic") => {
  const point = spawn(type);
  sandbox.state.items.push({ type, dummyType, visible: true, x: point.x, y: point.y });
  return point;
};

const propPoints = [];
for (let index = 0; index < 10; index += 1) propPoints.push(addAtSpawn("prop"));
assert.equal(new Set(propPoints.map(({ x, y }) => `${x}:${y}`)).size, propPoints.length,
  "repeated prop quick-add must not stack new props on the same slot");
for (const point of propPoints) {
  assert.ok(point.x >= 0.12 && point.x <= 0.88 && point.y >= 0.14 && point.y <= 0.86,
    "spawn points must stay inside the editable stage area");
}

sandbox.state.items = [{ type: "prop", dummyType: "room", visible: true, x: 0.52, y: 0.58 }];
assert.deepEqual({ ...spawn("prop") }, { x: 0.52, y: 0.58 },
  "architecture shells must not block useful object spawn slots");

sandbox.state.items = [{ type: "actor", visible: true, x: 0.38, y: 0.36 }];
assert.notDeepEqual({ ...spawn("actor") }, { x: 0.38, y: 0.36 },
  "a second actor must move to a free slot");

console.log("spawn-layout-contract: deterministic free-slot placement passed");
