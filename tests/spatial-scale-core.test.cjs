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

console.log("spatial-scale-core: metric actor, prop, fit, and perspective checks passed");
