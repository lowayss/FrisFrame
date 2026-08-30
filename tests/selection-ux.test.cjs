const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.resolve(__dirname, "../electron/selection-ux.js"), "utf8");

function mockElement() {
  return {
    className: "",
    textContent: "",
    isConnected: false,
    style: {},
    classList: {
      add() {},
      remove() {},
      toggle() {},
    },
    setAttribute() {},
    append() {},
    addEventListener() {},
  };
}

function makeContext(items, selectedItem = null) {
  const renderState = {
    items,
    camera: {},
    activeCameraId: "camera-main",
  };
  const documentMock = {
    documentElement: { dataset: {} },
    head: { append() {} },
    createElement() { return mockElement(); },
    querySelector() { return null; },
    getElementById() { return null; },
    addEventListener() {},
  };
  const context = {
    console,
    document: documentMock,
    performance: { now: () => 1000 },
    requestAnimationFrame(callback) { callback(); return 1; },
    window: {
      THREE: null,
      clearTimeout() {},
      setTimeout() { return 1; },
    },
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

{
  const left = {
    id: "left",
    type: "prop",
    assetType: "generic",
    x: 0.5,
    y: 0.5,
    size: 1,
    scaleX: 1,
    scaleZ: 1,
    facing: 0,
    visible: true,
  };
  const right = { ...left, id: "right", x: 0.508 };
  const context = makeContext([left, right], { kind: "item", id: "left" });
  const hit = context.hitTest({ x: 503, y: 500 }, context.state);
  assert.equal(hit.id, "left",
    "the selected item should remain slightly sticky while the pointer is still clearly inside it");
}

{
  const context = makeContext([]);
  const { resolveCycleIndex } = context.window.FrisFrameSelectionUxTest;
  assert.equal(resolveCycleIndex(3, 0, -1, false), 1,
    "the first overlap-cycle click should advance from the currently selected candidate");
  assert.equal(resolveCycleIndex(3, 1, 1, true), 2,
    "repeated overlap-cycle clicks should advance in stable order");
  assert.equal(resolveCycleIndex(3, 2, 2, true), 0,
    "overlap-cycle selection should wrap after the last candidate");
}

console.log("selection-ux: adaptive hit areas, overlap priority, stickiness, and cycling passed");
