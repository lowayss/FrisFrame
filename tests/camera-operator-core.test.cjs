const assert = require("node:assert/strict");

const core = require("../electron/interaction-ux.js");

function sample(time, overrides = {}) {
  return {
    time,
    x: 0.5,
    y: 0.5,
    height: 1.6,
    panDeg: 180,
    tiltDeg: 0,
    focal: 35,
    ...overrides,
  };
}

// Endpoints are authored intent and must never drift during jitter cleanup.
{
  const input = [
    sample(0, { panDeg: 180 }),
    sample(0.1, { panDeg: 180.8 }),
    sample(0.2, { panDeg: 179.2 }),
    sample(0.3, { panDeg: 180.7 }),
    sample(0.4, { panDeg: 180 }),
  ];
  const output = core.smoothSamples(input, 0.2);
  assert.deepEqual(output[0], input[0]);
  assert.deepEqual(output.at(-1), input.at(-1));
  const beforeJitter = Math.abs(input[1].panDeg - 180) + Math.abs(input[2].panDeg - 180) + Math.abs(input[3].panDeg - 180);
  const afterJitter = Math.abs(core.shortestAngleDelta(180, output[1].panDeg))
    + Math.abs(core.shortestAngleDelta(180, output[2].panDeg))
    + Math.abs(core.shortestAngleDelta(180, output[3].panDeg));
  assert.ok(afterJitter < beforeJitter, "micro pan jitter should be reduced");
}

// Angle cleanup must cross 0/360 through the short direction, never spin through 180 degrees.
{
  const input = [
    sample(0, { panDeg: 358 }),
    sample(0.1, { panDeg: 359.5 }),
    sample(0.2, { panDeg: 0.5 }),
    sample(0.3, { panDeg: 2 }),
  ];
  const output = core.smoothSamples(input, 0.2);
  assert.ok(Math.abs(core.shortestAngleDelta(359.5, output[1].panDeg)) < 3);
  assert.ok(Math.abs(core.shortestAngleDelta(0.5, output[2].panDeg)) < 3);
}

// Mouse samples are resampled to a stable clock so playback does not change
// velocity merely because pointer events arrived at uneven intervals.
{
  const input = [
    sample(0, { x: 0.2, panDeg: 359 }),
    sample(0.13, { x: 0.4, panDeg: 1 }),
    sample(0.79, { x: 0.8, panDeg: 5 }),
  ];
  const output = core.resampleSamples(input, 0.2);
  assert.deepEqual(output.map((entry) => Number(entry.time.toFixed(2))), [0, 0.2, 0.4, 0.6, 0.79]);
  assert.equal(output[0].x, input[0].x);
  assert.equal(output.at(-1).x, input.at(-1).x);
  assert.ok(Math.abs(core.shortestAngleDelta(359, output[1].panDeg)) < 3, "resampling must use the shortest angle path");
}

// Uniform, straight, constant-speed motion can collapse to its endpoints.
{
  const input = Array.from({ length: 11 }, (_, index) => sample(index / 10, { x: 0.2 + index * 0.04 }));
  const output = core.simplifySamples(input, {
    positionTolerance: 0.0001,
    heightTolerance: 0.001,
    angleTolerance: 0.01,
    focalTolerance: 0.01,
    maxGap: 99,
  });
  assert.equal(output.length, 2);
}

// A human-style hold -> accelerate -> settle on the same straight path must retain timing keys.
// Geometric-only simplification would incorrectly collapse this to two endpoints and make speed mechanical.
{
  const input = [
    sample(0.0, { x: 0.20 }),
    sample(0.2, { x: 0.20 }),
    sample(0.4, { x: 0.205 }),
    sample(0.6, { x: 0.24 }),
    sample(0.8, { x: 0.35 }),
    sample(1.0, { x: 0.46 }),
    sample(1.2, { x: 0.50 }),
  ];
  const output = core.simplifySamples(input, {
    positionTolerance: 0.002,
    heightTolerance: 0.02,
    angleTolerance: 0.2,
    focalTolerance: 0.25,
    maxGap: 99,
  });
  assert.ok(output.length >= 4, "speed/tension changes must survive key reduction");
  assert.equal(output[0].time, 0);
  assert.equal(output.at(-1).time, 1.2);
}

// Physical Camera reduction must preserve both edges of a real hold so playback
// can settle, stay still, and then leave the hold without spline drift.
{
  const input = [
    sample(0.0, { x: 0.20 }),
    sample(0.1, { x: 0.20 }),
    sample(0.2, { x: 0.20 }),
    sample(0.3, { x: 0.23 }),
    sample(0.4, { x: 0.26 }),
    sample(0.5, { x: 0.26 }),
    sample(0.6, { x: 0.26 }),
  ];
  const output = core.simplifySamples(input, {
    positionTolerance: 0.001,
    heightTolerance: 0.01,
    angleTolerance: 0.1,
    focalTolerance: 0.2,
    maxGap: 99,
    preserveNaturalMotion: true,
  });
  const times = output.map((entry) => Number(entry.time.toFixed(1)));
  assert.ok(times.includes(0.2), "the release edge of an opening hold must survive");
  assert.ok(times.includes(0.4), "the first settled sample of a closing hold must survive");
}

// A deliberate handheld reversal is an authored beat, not jitter.
{
  const input = [
    sample(0.0, { x: 0.20 }),
    sample(0.1, { x: 0.23 }),
    sample(0.2, { x: 0.26 }),
    sample(0.3, { x: 0.23 }),
    sample(0.4, { x: 0.20 }),
  ];
  const output = core.simplifySamples(input, {
    positionTolerance: 0.001,
    heightTolerance: 0.01,
    angleTolerance: 0.1,
    focalTolerance: 0.2,
    maxGap: 99,
    preserveNaturalMotion: true,
  });
  assert.ok(output.some((entry) => Math.abs(entry.time - 0.2) < 0.000001),
    "the direction-change apex must survive Physical Camera key reduction");
}

console.log("camera-operator-core: jitter cleanup, angle wrap, and time-aware key reduction passed");
