const assert = require("node:assert/strict");
const { detectRenderRuntime } = require("../previs-runtime-core.js");

function fakeDocument(contexts) {
  return { createElement: () => ({ getContext: (name) => contexts.includes(name) ? {} : null }) };
}

assert.equal(
  detectRenderRuntime({ navigatorObject: { platform: "MacIntel" }, documentObject: fakeDocument(["webgl2"]) }).label,
  "Mac GPU · WebGL",
);
assert.equal(
  detectRenderRuntime({ navigatorObject: { platform: "MacIntel", gpu: {} }, documentObject: fakeDocument([]) }).label,
  "Mac GPU · WebGPU",
);
assert.equal(
  detectRenderRuntime({ rendererEngine: "webgl", navigatorObject: { platform: "MacIntel", gpu: {} }, documentObject: fakeDocument([]) }).label,
  "Mac GPU · WebGL",
);
assert.equal(
  detectRenderRuntime({ navigatorObject: { platform: "Linux" }, documentObject: fakeDocument([]) }).label,
  "CPU fallback",
);

console.log("previs-runtime-core: render runtime detection passed");
