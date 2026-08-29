const assert = require("node:assert/strict");
const { rescaleKeyframeTimes } = require("../motion-core.js");

const source = [
  { id: "start", time: 0 },
  { id: "frame-25", time: 1.041667 },
  { id: "end", time: 5 },
];

const scaled = rescaleKeyframeTimes(source, 5, 7);
assert.equal(scaled[0].time, 0);
assert.equal(scaled[1].time, 1.458334,
  "duration rescale must retain six-decimal timing rather than collapsing back to four decimals");
assert.equal(scaled[2].time, 7);
assert.equal(source[1].time, 1.041667, "rescale must not mutate the source keyframes");

// 61/60 is stored on the six-decimal timeline as 1.016667. Scaling by 1.5
// lands at 1.5250005; normal floating-point rounding may serialize that as
// numeric 1.525 (trailing zeroes are not precision information).
const sixtyFps = rescaleKeyframeTimes([{ time: 1.016667 }], 2, 3);
assert.equal(sixtyFps[0].time, 1.525,
  "60 FPS-derived timestamps must retain the correctly rounded scaled time");

// This case specifically distinguishes six-decimal retention from the old
// four-decimal path: 1.123456 * 1.5 = 1.685184, not 1.6852.
const highPrecision = rescaleKeyframeTimes([{ time: 1.123456 }], 2, 3);
assert.equal(highPrecision[0].time, 1.685184,
  "retiming must preserve meaningful fifth and sixth decimal digits");
assert.notEqual(highPrecision[0].time, 1.6852,
  "retiming must not regress to the former four-decimal timestamp precision");

console.log("retime-precision: six-decimal key timing survived duration rescale");
