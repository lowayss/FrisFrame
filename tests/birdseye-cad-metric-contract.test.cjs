"use strict";

const assert = require("node:assert/strict");

function snapNormalized(normalized, spanMeters, stepMeters) {
  const world = (normalized - 0.5) * spanMeters;
  const snappedWorld = Math.round(world / stepMeters) * stepMeters;
  return 0.5 + snappedWorld / spanMeters;
}

const stageWidth = 36;
const stageDepth = 20.25;
const step = 0.25;
const x = snapNormalized(0.537, stageWidth, step);
const z = snapNormalized(0.463, stageDepth, step);
const worldX = (x - 0.5) * stageWidth;
const worldZ = (z - 0.5) * stageDepth;

assert.ok(Math.abs(worldX / step - Math.round(worldX / step)) < 1e-9);
assert.ok(Math.abs(worldZ / step - Math.round(worldZ / step)) < 1e-9);
assert.ok(Math.abs((step / stageWidth) * stageWidth - step) < 1e-9);
assert.ok(Math.abs((step / stageDepth) * stageDepth - step) < 1e-9);

console.log("2.5D CAD metric snap contract passed");
