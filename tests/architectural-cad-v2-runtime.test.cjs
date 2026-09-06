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
    this.tagName = String(tagName).toUpperCase();
    this.children = [];
    this.hidden = false;
    this.style = {};
    this.dataset = {};
    this.value = "";
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
  appendChild(child) { this.children.push(child); child.parentNode = this; return child; }
  append(...children) { children.forEach((child) => this.appendChild(child)); }
  insertBefore(child) { return this.appendChild(child); }
  addEventListener(type, handler) { this.listeners[type] = handler; }
  setAttribute() {}
  closest() { return null; }
  querySelector(selector) {
    const match = selector.match(/data-wall-endpoint=\"([^\"]+)\"/);
    if (!match) return null;
    return this.children.find((child) => child.dataset?.wallEndpoint === match[1]) || null;
  }
}

function wallElement(id, sx, sz, ex, ez) {
  const length = Math.hypot(ex - sx, ez - sz);
  const rotationDeg = Math.atan2(ez - sz, ex - sx) * 180 / Math.PI;
  return {
    id, name: id, kind: "wall", role: "structure", parentId: "",
    worldXM: (sx + ex) / 2, worldZM: (sz + ez) / 2,
    widthM: length, heightM: 2.8, depthM: 0.15, rotationDeg,
    line: { start_x_m: sx, start_z_m: sz, end_x_m: ex, end_z_m: ez, length_m: length, thickness_m: 0.15 },
  };
}

const controls = new FakeElement("div"); controls.id = "birdseyeCadControls";
const readout = new FakeElement("span"); readout.id = "birdseyeCadReadout"; controls.appendChild(readout);
const threeWrap = new FakeElement("div"); threeWrap.id = "threeWrap";

const documentObject = {
  activeElement: null,
  createElement(tag) { return new FakeElement(tag); },
  getElementById(id) { return elementsById.get(id) || null; },
  addEventListener() {},
};
const windowObject = {
  FrisFrameBirdseyeCad: {},
  FrisFrameBirdseye25D: { mode: "2.5d" },
  addEventListener(type, handler) { if (type === "load") loadHandlers.push(handler); },
};

const stateObject = {
  aspect: "1:1",
  items: [
    { id: "w1", type: "prop", assetType: "wall", name: "bottom", x: 0.5, y: 0.35, facing: 0, referenceDimensionsM: { width: 4, height: 2.8, depth: 0.15 } },
    { id: "w2", type: "prop", assetType: "wall", name: "right", x: 0.7, y: 0.5, facing: 90, referenceDimensionsM: { width: 3, height: 2.8, depth: 0.15 } },
    { id: "w3", type: "prop", assetType: "wall", name: "top", x: 0.5, y: 0.65, facing: 180, referenceDimensionsM: { width: 4, height: 2.8, depth: 0.15 } },
    { id: "w4", type: "prop", assetType: "wall", name: "left", x: 0.3, y: 0.5, facing: 270, referenceDimensionsM: { width: 3, height: 2.8, depth: 0.15 } },
    { id: "door", type: "prop", assetType: "door", name: "door", x: 0.55, y: 0.35, facing: 0, referenceDimensionsM: { width: 0.9, height: 2.1, depth: 0.12 } },
  ],
  setMasterPlan: {
    schema: "frisframe-set-master-plan", version: 1,
    elements: [
      wallElement("w1", -2, -1.5, 2, -1.5),
      wallElement("w2", 2, -1.5, 2, 1.5),
      wallElement("w3", 2, 1.5, -2, 1.5),
      wallElement("w4", -2, 1.5, -2, -1.5),
      { id: "door", name: "door", kind: "door", role: "opening", parentId: "w1", worldXM: 0.5, worldZM: -1.5, widthM: 0.9, heightM: 2.1, depthM: 0.12, rotationDeg: 0, line: null },
    ],
  },
};

let commitCount = 0;
const context = vm.createContext({
  console,
  module: { exports: {} }, exports: {}, window: windowObject, globalThis: windowObject,
  document: documentObject, state: stateObject, selected: { kind: "item", id: "w1" },
  stageWorldSize() { return { width: 10, depth: 10 }; },
  sourceEditLocked() { return false; },
  transformLeaderIdForItem(id) { return id; },
  resolvedItemPose(item) { return item; },
  materializeEvaluatedViewForEditing() {},
  updateThreeEditorDrag() {}, syncUi() {}, renderThreeView() {},
  commit() { commitCount += 1; },
  requestAnimationFrame(callback) { callback(); }, setTimeout() {},
});

vm.runInContext(source, context, { filename: "multi-camera-core.js" });
loadHandlers[loadHandlers.length - 1]();
const api = windowObject.FrisFrameArchitecturalCad;
assert.ok(api, "architectural CAD API must be available");
assert.equal(api.roomZones.length, 1);

// Drag the bottom wall end near the right-wall corner. It must canonicalize to that corner.
assert.equal(api.setWallEndpoint("w1", "end", 2.12, -1.46, { snap: true, commit: false }), true);
let w1 = stateObject.setMasterPlan.elements.find((entry) => entry.id === "w1");
assert.equal(w1.line.end_x_m, 2);
assert.equal(w1.line.end_z_m, -1.5);
assert.equal(api.lastEndpointSnap.wallId, "w2");
assert.equal(api.lastEndpointSnap.endpoint, "start");
assert.equal(api.roomZones.length, 1, "corner snapping must preserve the closed room loop");

// Moving beyond snap tolerance must really break the room; no missing wall is synthesized.
assert.equal(api.setWallEndpoint("w1", "end", 2.5, -1.5, { snap: true, commit: false }), true);
w1 = stateObject.setMasterPlan.elements.find((entry) => entry.id === "w1");
assert.equal(w1.line.end_x_m, 2.5);
assert.equal(api.lastEndpointSnap, null);
assert.equal(api.roomZones.length, 0);

// Restore the exact corner, then drag the opening close to the top wall and re-parent it automatically.
assert.equal(api.setWallEndpoint("w1", "end", 2, -1.5, { snap: true, commit: false }), true);
const door = stateObject.items.find((item) => item.id === "door");
door.x = 0.55;
door.y = 0.64;
assert.equal(api.reattachOpeningToNearestWall("door"), true);
const doorElement = stateObject.setMasterPlan.elements.find((entry) => entry.id === "door");
assert.equal(doorElement.parentId, "w3");
assert.ok(Math.abs((door.y - 0.5) * 10 - 1.5) < 1e-9, "door must project onto the newly selected wall");
assert.equal(door.facing, 180);
assert.equal(api.roomZones.length, 1);
assert.equal(commitCount, 0, "preview endpoint edits must not create history revisions until pointer release/explicit commit");

// Committed endpoint edit creates exactly one revision.
assert.equal(api.setWallEndpoint("w1", "start", -2, -1.5, { snap: true, commit: true }), true);
assert.equal(commitCount, 1);

console.log("architectural-cad-v2-runtime: endpoint corner snapping, preview edits, and opening wall reattachment passed");
