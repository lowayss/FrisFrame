"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "multi-camera-core.js"), "utf8");

const loadHandlers = [];
const elementsById = new Map();

class FakeElement {
  constructor(tagName = "span") {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.hidden = false;
    this.style = {};
    this.dataset = {};
    this.value = "";
    this.type = "";
    this.min = "";
    this.max = "";
    this.step = "";
    this.listeners = {};
    let elementId = "";
    Object.defineProperty(this, "id", {
      get() { return elementId; },
      set(value) {
        if (elementId) elementsById.delete(elementId);
        elementId = String(value || "");
        if (elementId) elementsById.set(elementId, this);
      },
    });
  }
  appendChild(child) {
    this.children.push(child);
    child.parentNode = this;
    return child;
  }
  append(...children) {
    children.forEach((child) => this.appendChild(child));
  }
  insertBefore(child) {
    return this.appendChild(child);
  }
  addEventListener(type, handler) {
    this.listeners[type] = handler;
  }
  closest() { return null; }
}

const controls = new FakeElement("div");
controls.id = "birdseyeCadControls";
const readout = new FakeElement("span");
readout.id = "birdseyeCadReadout";
controls.appendChild(readout);

const documentObject = {
  activeElement: null,
  createElement(tagName) { return new FakeElement(tagName); },
  getElementById(id) { return elementsById.get(id) || null; },
  addEventListener() {},
};

const windowObject = {
  FrisFrameBirdseyeCad: {},
  FrisFrameBirdseye25D: { mode: "2.5d" },
  addEventListener(type, handler) {
    if (type === "load") loadHandlers.push(handler);
  },
};

function wallElement(id, sx, sz, ex, ez) {
  const length = Math.hypot(ex - sx, ez - sz);
  const rotationDeg = Math.atan2(ez - sz, ex - sx) * 180 / Math.PI;
  return {
    id,
    name: id,
    kind: "wall",
    role: "structure",
    parentId: "",
    worldXM: (sx + ex) / 2,
    worldZM: (sz + ez) / 2,
    widthM: length,
    heightM: 2.8,
    depthM: 0.15,
    rotationDeg,
    line: {
      start_x_m: sx,
      start_z_m: sz,
      end_x_m: ex,
      end_z_m: ez,
      length_m: length,
      thickness_m: 0.15,
    },
  };
}

const stateObject = {
  aspect: "1:1",
  items: [
    { id: "w1", type: "prop", assetType: "wall", name: "bottom", x: 0.5, y: 0.35, facing: 0, referenceDimensionsM: { width: 4, height: 2.8, depth: 0.15 } },
    { id: "w2", type: "prop", assetType: "wall", name: "right", x: 0.7, y: 0.5, facing: 90, referenceDimensionsM: { width: 3, height: 2.8, depth: 0.15 } },
    { id: "w3", type: "prop", assetType: "wall", name: "top", x: 0.5, y: 0.65, facing: 180, referenceDimensionsM: { width: 4, height: 2.8, depth: 0.15 } },
    { id: "w4", type: "prop", assetType: "wall", name: "left", x: 0.3, y: 0.5, facing: 270, referenceDimensionsM: { width: 3, height: 2.8, depth: 0.15 } },
    { id: "door", type: "prop", assetType: "door", name: "door", x: 0.55, y: 0.38, facing: 30, referenceDimensionsM: { width: 0.9, height: 2.1, depth: 0.12 } },
  ],
  setMasterPlan: {
    schema: "frisframe-set-master-plan",
    version: 1,
    elements: [
      wallElement("w1", -2, -1.5, 2, -1.5),
      wallElement("w2", 2, -1.5, 2, 1.5),
      wallElement("w3", 2, 1.5, -2, 1.5),
      wallElement("w4", -2, 1.5, -2, -1.5),
      {
        id: "door",
        name: "door",
        kind: "door",
        role: "opening",
        parentId: "w1",
        worldXM: 0.5,
        worldZM: -1.2,
        widthM: 0.9,
        heightM: 2.1,
        depthM: 0.12,
        rotationDeg: 30,
        line: null,
      },
    ],
  },
};

let selectedObject = { kind: "item", id: "w1" };
let commitCount = 0;

const context = vm.createContext({
  console,
  module: { exports: {} },
  exports: {},
  window: windowObject,
  globalThis: windowObject,
  document: documentObject,
  state: stateObject,
  selected: selectedObject,
  stageWorldSize() { return { width: 10, depth: 10 }; },
  sourceEditLocked() { return false; },
  transformLeaderIdForItem(id) { return id; },
  resolvedItemPose(item) { return item; },
  materializeEvaluatedViewForEditing() {},
  updateThreeEditorDrag() {},
  syncUi() {},
  commit() { commitCount += 1; },
  requestAnimationFrame(callback) { callback(); },
  setTimeout() {},
});

vm.runInContext(source, context, { filename: "multi-camera-core.js" });
assert.ok(loadHandlers.length >= 2, "architectural CAD must register after preset quality");
loadHandlers[loadHandlers.length - 1]();

const api = windowObject.FrisFrameArchitecturalCad;
assert.ok(api, "architectural CAD API must be exposed");
assert.equal(api.roomZones.length, 1, "closed four-wall loop should derive one room zone");
assert.equal(api.roomZones[0].areaM2, 12);
assert.deepEqual([...api.roomZones[0].wallIds].sort(), ["w1", "w2", "w3", "w4"]);

assert.equal(api.snapOpeningToParent("door"), true);
const door = stateObject.items.find((item) => item.id === "door");
const doorElement = stateObject.setMasterPlan.elements.find((entry) => entry.id === "door");
assert.ok(Math.abs((door.y - 0.5) * 10 + 1.5) < 1e-9, "door must project onto parent wall");
assert.equal(door.facing, 0, "door must align to parent wall rotation");
assert.ok(Math.abs(doorElement.attachmentT - 0.625) < 1e-9);

assert.equal(api.setWallMetrics("w1", 6, 0.2), true);
const bottom = stateObject.items.find((item) => item.id === "w1");
const bottomElement = stateObject.setMasterPlan.elements.find((entry) => entry.id === "w1");
assert.equal(bottom.referenceDimensionsM.width, 6);
assert.equal(bottom.referenceDimensionsM.depth, 0.2);
assert.equal(bottomElement.line.length_m, 6);
assert.equal(bottomElement.line.thickness_m, 0.2);
assert.ok(Math.abs((door.x - 0.5) * 10 - 0.75) < 1e-9, "opening should preserve wall-relative attachmentT when wall length changes");
assert.equal(api.roomZones.length, 0, "breaking a wall loop must remove the derived room instead of synthesizing a wall");
assert.equal(commitCount, 1);

assert.equal(api.setWallMetrics("w1", 4, 0.2), true);
assert.equal(api.roomZones.length, 1, "restoring the closed loop should restore the derived room zone");
assert.equal(commitCount, 2);

console.log("architectural-cad-runtime: closed room zones, wall-bound openings, and wall length/thickness editing passed");
