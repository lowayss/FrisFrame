const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.resolve(__dirname, "../electron/selection-ux.js"), "utf8");

function makeContext(items, selectedItem = null) {
  const renderState = {
    items,
    camera: {},
  };
  const context = {
    console,
    document: { documentElement: { dataset: {} } },
    window: { THREE: null },
    state: renderState,
    evaluatedViewState: renderState,
    stageRect: { x: 0, y: 0, w: 1000, h: 1000 },
    selected: selectedItem,
    threeView: null,
    isPointInItem() { return false; },
    hitTest() { return null; },
    pickThreeEditor() { return null; },
    resolvedItemPose(item) { return item; },
    toCanvas(item) { return { x: item.x * 1000, y: item.y * 1000 }; },
    itemRadius(item) { return Number(item.radius || 5); },
    distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); },
    stageWorldSize() { return { width: 10, depth: 10 }; },
    getPropPhysicalDimensions(assetType) {
      if (assetType === "room") return [10, 10];
      if (assetType === "needle") return [0.05, 0.05];
      return [0.2, 0.2];
    },
    propDefinition(assetType) {
      return { kind: assetType === "room" ? "architecture" : "generic" };
    },
    degToRad(value) { return Number(value || 0) * Math.PI / 180; },
    isGroupLeader() { return false; },
    facingHandlePoint() { return { x: -1000, y: -1000 }; },
    cameraFieldRenderEntries() { return []; },
    clone(value) { return JSON.parse(JSON.stringify(value)); },
  };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: "selection-ux.js" });
  return context;
}

{
  const prop = {
    id: "tiny",
    type: "prop",
    assetType: "needle",
    x: 0.5,
    y: 0.5,
    size: 1,
    scaleX: 1,
    scaleZ: 1,
    facing: 0,
    visible: true,
  };
  const context = makeContext([prop]);
  assert.equal(context.isPointInItem({ x: 514, y: 500 }, prop, context.state), true,
    "tiny props should keep a practical invisible click target");
}

{
  const actor = {
    id: "actor",
    type: "actor",
    x: 0.49,
    y: 0.5,
    radius: 10,
    visible: true,
  };
  const prop = {
    id: "prop",
    type: "prop",
    assetType: "generic",
    x: 0.503,
    y: 0.5,
    size: 1,
    scaleX: 1,
    scaleZ: 1,
    facing: 0,
    visible: true,
  };
  const context = makeContext([actor, prop]);
  const hit = context.hitTest({ x: 504, y: 500 }, context.state);
  assert.equal(hit.id, "prop",
    "overlap resolution should primarily follow pointer proximity instead of absolute actor-first priority");
}

{
  const room = {
    id: "room",
    type: "prop",
    assetType: "room",
    x: 0.5,
    y: 0.5,
    size: 1,
    scaleX: 1,
    scaleZ: 1,
    facing: 0,
    visible: true,
  };
  const prop = {
    id: "small-prop",
    type: "prop",
    assetType: "generic",
    x: 0.505,
    y: 0.5,
    size: 1,
    scaleX: 1,
    scaleZ: 1,
    facing: 0,
    visible: true,
  };
  const context = makeContext([room, prop]);
  const hit = context.hitTest({ x: 506, y: 500 }, context.state);
  assert.equal(hit.id, "small-prop",
    "large architecture surfaces should not steal a click from a nearby small prop");
}

console.log("selection-ux: adaptive 2D hit areas and overlap priority passed");
