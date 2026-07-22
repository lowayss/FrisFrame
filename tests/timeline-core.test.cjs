const assert = require("node:assert/strict");

const {
  expandSynchronizedCutSelection,
  moveSelection,
  normalizedSelection,
  pasteTimes,
  sameTime,
  scaleSelection,
  selectionRange,
  snapTime,
} = require("../timeline-core.js");

const keys = [
  { id: "a", source: "camera", time: 0 },
  { id: "b", source: "camera", time: 2, transition: "cut" },
  { id: "c", source: "actor", time: 2, transition: "cut" },
  { id: "d", source: "camera", time: 4 },
  { id: "e", source: "actor", time: 6 },
];

assert.equal(snapTime(1.02, "frame", 24), 1);
assert.equal(snapTime(1.03, "frame", 24), 1.0417);
assert.equal(snapTime(1.01, "frame", 60), 1.0167);
assert.equal(snapTime(1.24, "0.5", 24), 1);
assert.equal(sameTime(1, 1.0004), true);

assert.deepEqual(normalizedSelection(keys, ["missing", "a"], "b"), { ids: ["a", "b"], primaryId: "b" });
assert.deepEqual(new Set(expandSynchronizedCutSelection(keys, ["b"])), new Set(["b", "c"]));
assert.deepEqual(selectionRange(keys, ["a", "d"]), { start: 0, end: 4, duration: 4, count: 2 });

const moved = moveSelection(keys, ["b"], "b", 3, { mode: "0.1", fps: 24, maximum: 10 });
assert.equal(moved.ok, true);
assert.equal(moved.keyframes.find((key) => key.id === "b").time, 3);
assert.equal(moved.keyframes.find((key) => key.id === "c").time, 3, "cut companions must stay synchronized");

const groupedMove = moveSelection(keys, ["a", "d"], "a", 1, { mode: "0.1", maximum: 10 });
assert.equal(groupedMove.ok, true);
assert.equal(groupedMove.keyframes.find((key) => key.id === "a").time, 1);
assert.equal(groupedMove.keyframes.find((key) => key.id === "d").time, 5);

const crossing = moveSelection(keys, ["a"], "a", 5, { mode: "0.1", maximum: 10 });
assert.equal(crossing.ok, false, "a key must not cross a stationary key from the same source");

const offGridKeys = [
  { id: "off-a", source: "camera", time: 0.03 },
  { id: "off-b", source: "camera", time: 1.13 },
];
const frameMoved = moveSelection(offGridKeys, ["off-a", "off-b"], "off-a", 1, { mode: "frame", fps: 24, maximum: 10 });
assert.equal(frameMoved.ok, true);
frameMoved.keyframes.forEach((keyframe) => {
  assert.ok(Math.abs(keyframe.time * 24 - Math.round(keyframe.time * 24)) < 0.001, "every moved key must land on a frame tick");
});

const sixtyFpsMoved = moveSelection(offGridKeys, ["off-a", "off-b"], "off-a", 1.01, { mode: "frame", fps: 60, maximum: 10 });
assert.equal(sixtyFpsMoved.ok, true);
sixtyFpsMoved.keyframes.forEach((keyframe) => {
  assert.ok(Math.abs(keyframe.time * 60 - Math.round(keyframe.time * 60)) < 0.0021, "60 FPS moves must remain on frame ticks");
});

const scaled = scaleSelection(keys, ["a", "d"], 8, { mode: "0.1", maximum: 12 });
assert.equal(scaled.ok, true);
assert.equal(scaled.keyframes.find((key) => key.id === "d").time, 8);

const collision = scaleSelection(keys, ["a", "d"], 2, { mode: "0.1", maximum: 12 });
assert.equal(collision.ok, false, "retiming onto an unselected key in the same source must fail");
assert.equal(collision.reason, "order", "retiming across a stationary key must report an order conflict");

const pasted = pasteTimes(keys, [
  { source: "camera", offset: 0 },
  { source: "actor", offset: 1 },
], 0, { mode: "0.1", maximum: 10 });
assert.equal(pasted.ok, true);
assert.ok(pasted.baseTime > 0, "paste should move as a group when the requested slot is occupied");
assert.equal(Number((pasted.times[1] - pasted.times[0]).toFixed(4)), 1);

console.log("timeline-core: selection, snapping, retiming, and paste constraints passed");
