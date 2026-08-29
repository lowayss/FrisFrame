const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.resolve(__dirname, "../electron/alignment-ux.js"), "utf8");

function mockElement() {
  return {
    className: "",
    textContent: "",
    style: {},
    classList: {
      add() {},
      remove() {},
      toggle() {},
    },
    append() {},
    addEventListener() {},
    getBoundingClientRect() { return { left: 0, top: 0, width: 1000, height: 1000 }; },
  };
}

const stageCanvas = mockElement();
const threeCanvas = mockElement();
const canvasWrap = mockElement();
const context = {
  console,
  document: {
    documentElement: { dataset: {} },
    head: { append() {} },
    createElement() { return mockElement(); },
    getElementById(id) {
      if (id === "stageCanvas") return stageCanvas;
      if (id === "threeCanvas") return threeCanvas;
      return null;
    },
    querySelector(selector) { return selector === ".canvas-wrap" ? canvasWrap : null; },
  },
  window: {
    addEventListener() {},
  },
  requestAnimationFrame() { return 1; },
};
vm.createContext(context);
vm.runInContext(source, context, { filename: "alignment-ux.js" });

const { nearestAxisSnap } = context.window.FrisFrameAlignmentUxTest;
const targets = [
  { value: 0.5, label: "center" },
  { value: 0.75, label: "actor" },
];
assert.equal(nearestAxisSnap(0.506, targets, 0.01).value, 0.5,
  "alignment snapping should choose a target inside the threshold");
assert.equal(nearestAxisSnap(0.742, targets, 0.01).value, 0.75,
  "alignment snapping should choose the nearest eligible axis");
assert.equal(nearestAxisSnap(0.62, targets, 0.01), null,
  "alignment snapping should stay out of the way when no target is near");

console.log("alignment-ux: nearest-axis snapping threshold passed");
