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

const sixtyFps = rescaleKeyframeTimes([{ time: 1.016667 }], 2, 3);
assert.equal(sixtyFps[0].time, 1.525001,
  "60 FPS-derived timestamps must keep enough decimal precision after retiming");

console.log("retime-precision: six-decimal key timing survived duration rescale");
