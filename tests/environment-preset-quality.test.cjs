"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "multi-camera-core.js"), "utf8");

const loadHandlers = [];
const clickHandlers = [];
const buttonRoot = {
  addEventListener(type, handler) {
    if (type === "click") clickHandlers.push(handler);
  },
};
const windowObject = {
  addEventListener(type, handler) {
    if (type === "load") loadHandlers.push(handler);
  },
};
const context = vm.createContext({
  console,
  module: { exports: {} },
  exports: {},
  window: windowObject,
  globalThis: windowObject,
  document: {
    getElementById(id) {
      return id === "environmentPresetButtons" ? buttonRoot : null;
    },
  },
  queueMicrotask(callback) { callback(); },
});

vm.runInContext(`
  let commits = 0;
  let state = {
    aspect: "16:9",
    spacePresetId: "living",
    items: [
      { id: "room-1", type: "prop", assetType: "room", name: "거실", x: 0.5, y: 0.5, facing: 0, size: 2, scaleX: 1, scaleY: 1, scaleZ: 1, presetInstanceId: "preset-1" },
      { id: "door-1", type: "prop", assetType: "door", name: "현관문", x: 0.339, y: 0.327, facing: 90, size: 1.1, scaleX: 1, scaleY: 1, scaleZ: 1, presetInstanceId: "preset-1" },
      { id: "sofa-1", type: "prop", assetType: "sofa", name: "메인 소파", x: 0.5, y: 0.525, facing: 0, size: 1.2, scaleX: 1, scaleY: 1, scaleZ: 1, presetInstanceId: "preset-1" },
    ],
  };
  const environmentPresets = {
    living: {
      label: "거실",
      items: [
        ["room", "거실", 0.5, 0.5, 0, 2.0],
        ["door", "현관문", 0.339, 0.327, 90, 1.1],
        ["sofa", "메인 소파", 0.5, 0.525, 0, 1.2],
      ],
    },
  };
  function stageWorldSize() { return { width: 36, depth: 20.25 }; }
  function commit() { commits += 1; }
  function syncUi() {}
`, context);

vm.runInContext(source, context, { filename: "multi-camera-core.js" });
assert.equal(loadHandlers.length, 1, "preset quality extension must register one load handler");
loadHandlers[0]();

const api = windowObject.FrisFrameEnvironmentPresetQuality;
assert.ok(api, "preset quality API must be exposed");
assert.equal(api.version, 2);
assert.ok(api.presetIds.includes("living"));
assert.ok(api.presetIds.includes("train_cabin"));
assert.ok(api.presetIds.includes("classic_salon"));
assert.equal(api.getSpec("living").width, 7.2);
assert.equal(api.upgradeCurrent(), true);

const snapshot = vm.runInContext(`({ state, commits })`, context);
assert.equal(snapshot.commits, 1);
assert.equal(snapshot.state.setMasterPlan.schema, "frisframe-set-master-plan");
assert.equal(snapshot.state.setMasterPlan.workflowPolicy, "curated-preset-master-set-v2");
assert.equal(snapshot.state.setMasterPlan.declaredWidthM, 7.2);
assert.equal(snapshot.state.setMasterPlan.declaredDepthM, 5.4);
assert.equal(snapshot.state.setMasterPlan.generatedItemIds.length, 3);
assert.equal(snapshot.state.setCollections.some((entry) => entry.id === "architecture"), true);
assert.equal(snapshot.state.setCollections.some((entry) => entry.id === "furniture"), true);

const room = snapshot.state.items.find((item) => item.id === "room-1");
const door = snapshot.state.items.find((item) => item.id === "door-1");
const sofa = snapshot.state.items.find((item) => item.id === "sofa-1");
assert.deepEqual(JSON.parse(JSON.stringify(room.referenceDimensionsM)), { width: 7.2, depth: 5.4, height: 2.8 });
assert.deepEqual(JSON.parse(JSON.stringify(sofa.referenceDimensionsM)), { width: 2.3, depth: 0.95, height: 0.9 });
assert.equal(room.size, 1, "metric referenceDimensionsM must not be multiplied by legacy preset size");
assert.equal(sofa.size, 1, "furniture must use exact metric dimensions");
assert.ok(door.referenceDimensionsM.width > 0.9 && door.referenceDimensionsM.height >= 2.1);

const doorElement = snapshot.state.setMasterPlan.elements.find((entry) => entry.id === "door-1");
assert.equal(doorElement.kind, "door");
assert.equal(doorElement.role, "opening");
assert.equal(doorElement.parentId, "room-1", "room openings must retain a spatial parent");
assert.equal(doorElement.basis, "user_fixed");
assert.equal(doorElement.confidence, 1);

console.log("environment-preset-quality: curated metric layouts, semantics, dimensions and Master Set persistence passed");
