const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const main = fs.readFileSync(path.join(root, "electron/main.cjs"), "utf8");
const source = fs.readFileSync(path.join(root, "electron/dynamic-prop-cache-ux.js"), "utf8");

assert.match(source, /function dynamicPropEligible\(/,
  "moving/grouped/selected props must have an explicit reusable-rig eligibility contract");
assert.match(source, /sourceHasMotion\(item\.id, renderState\)/,
  "animated props must use the dynamic prop cache path");
assert.match(source, /itemInManualGroup\(item\.id, renderState\)/,
  "group-following props must use the dynamic prop cache path");
assert.match(source, /delete structural\.x;[\s\S]*delete structural\.mountedHeight;/,
  "prop position, facing and elevation must be transform-only cache changes");
assert.match(source, /function syncPropRig\(/,
  "cached prop rigs must update existing transforms rather than rebuilding models");
assert.match(source, /group\.position\.set\(position\.x, position\.y, position\.z\)/,
  "cached props must follow evaluated stage position and mounted height");
assert.match(source, /body\.rotation\.y = -angle/,
  "cached props must follow evaluated facing");
assert.match(source, /arrow\.setDirection\(direction\)/,
  "cached prop direction helpers must stay synchronized with facing");
assert.match(source, /threeView\.world\.remove\(entry\.group\)/,
  "reusable prop rigs must be detached before the normal Three.js world clear");
assert.match(source, /stats\.reuses \+= 1/,
  "dynamic prop reuse must be observable for performance validation");
assert.match(source, /previewRenderDepth/,
  "editor dynamic-prop caching must remain isolated from camera preview rendering");

const sandbox = {
  console,
  document: { documentElement: { dataset: {} } },
  window: { addEventListener() {} },
  selected: null,
  state: {
    showNames: true,
    motion: { keyframes: [] },
    groups: [],
  },
};
vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: "dynamic-prop-cache-ux.js" });
const api = sandbox.window.FrisFrameDynamicPropCacheUxTest;
assert.ok(api, "dynamic prop cache must expose deterministic cache policy for regression tests");

const prop = {
  id: "car-1",
  type: "prop",
  name: "Car",
  assetType: "car",
  color: "#6aa7ff",
  visible: true,
  size: 1,
  scaleX: 1,
  scaleY: 1,
  scaleZ: 1,
  x: 0.2,
  y: 0.4,
  facing: 15,
  mountedHeight: 0,
};
assert.equal(api.dynamicPropEligible(prop, sandbox.state), false,
  "an unchanged ordinary prop should remain on the existing static-prop cache path");
const animatedState = {
  ...sandbox.state,
  motion: { keyframes: [{ id: "p1", source: prop.id, time: 0, pose: { x: 0.2, y: 0.4 } }] },
};
assert.equal(api.dynamicPropEligible(prop, animatedState), true,
  "a prop with authored motion must be eligible for dynamic rig reuse");
const groupedState = {
  ...sandbox.state,
  groups: [{ id: "g1", leaderId: "actor-1", members: [{ itemId: "actor-1" }, { itemId: prop.id }] }],
};
assert.equal(api.dynamicPropEligible(prop, groupedState), true,
  "a grouped prop must remain reusable while following its leader");
sandbox.selected = { kind: "item", id: prop.id };
assert.equal(api.dynamicPropEligible(prop, sandbox.state), true,
  "a selected prop must use the dynamic path so selection helpers can move with it");

const moved = { ...prop, x: 0.75, y: 0.7, facing: 220, mountedHeight: 1.2 };
assert.equal(
  api.propRigSignature(prop, sandbox.state),
  api.propRigSignature(moved, sandbox.state),
  "translation, facing and mounted-height changes must reuse the same prop model",
);
assert.notEqual(
  api.propRigSignature(prop, sandbox.state),
  api.propRigSignature({ ...prop, color: "#ff625f" }, sandbox.state),
  "material/color changes must rebuild the prop model",
);
assert.notEqual(
  api.propRigSignature(prop, sandbox.state),
  api.propRigSignature({ ...prop, size: 1.3 }, sandbox.state),
  "physical-size changes must rebuild the prop model so fitted bounds stay correct",
);

assert.ok(packageJson.build.files.includes("electron/dynamic-prop-cache-ux.js"),
  "desktop package must include the dynamic prop cache layer");
assert.match(main, /"scene-cache-ux\.js"[\s\S]*"dynamic-prop-cache-ux\.js"[\s\S]*"stage-shell-cache-ux\.js"[\s\S]*"camera-path-cache-ux\.js"/,
  "dynamic props must load after static/actor scene caching and before stage/camera cache layers");

console.log("dynamic-prop-cache-ux-contract: moving, grouped and selected prop rig reuse contracts passed");
