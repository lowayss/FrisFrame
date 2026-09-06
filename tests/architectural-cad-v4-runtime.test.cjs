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
    this.textContent = "";
    this.title = "";
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
  removeChild(child) { this.children = this.children.filter((entry) => entry !== child); return child; }
  get firstChild() { return this.children[0] || null; }
  addEventListener(type, handler) { this.listeners[type] = handler; }
  setAttribute() {}
  focus() {}
  select() {}
  closest() { return null; }
  querySelector(selector) {
    const endpoint = selector.match(/data-wall-endpoint=\"([^\"]+)\"/);
    if (endpoint) return this.children.find((child) => child.dataset?.wallEndpoint === endpoint[1]) || null;
    return null;
  }
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
  items: [],
  setCollections: [],
  setMasterPlan: {
    schema: "frisframe-set-master-plan",
    version: 1,
    status: "ready",
    unit: "meter",
    workflowPolicy: "direct-architectural-cad-v1",
    generatedItemIds: [],
    elements: [],
    roomZones: [],
  },
};

let commitCount = 0;
const context = vm.createContext({
  console,
  module: { exports: {} }, exports: {}, window: windowObject, globalThis: windowObject,
  document: documentObject, state: stateObject, selected: null,
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

const bottom = api.createWall(-2, -1.5, 2, -1.5, { commit: false, snap: false, thicknessM: 0.2 });
const right = api.createWall(2, -1.5, 2, 1.5, { commit: false, snap: false, thicknessM: 0.2 });
const top = api.createWall(2, 1.5, -2, 1.5, { commit: false, snap: false, thicknessM: 0.2 });
const left = api.createWall(-2, 1.5, -2, -1.5, { commit: false, snap: false, thicknessM: 0.2 });
assert.equal(api.roomZones.length, 1);
assert.equal(api.roomZones[0].areaM2, 12);

const roomMeta = api.setRoomMetadata(api.roomZones[0].id, { name: "거실", use: "living" }, { commit: false });
assert.equal(roomMeta.name, "거실");
assert.equal(roomMeta.use, "living");
assert.equal(api.roomZones[0].name, "거실");
assert.equal(api.roomZones[0].use, "living");

const split = api.splitWall(top, 0, 1.5, { commit: false });
assert.ok(split);
assert.equal(api.roomZones[0].name, "거실", "room metadata must survive a topology-preserving split");
assert.equal(api.roomZones[0].use, "living");
assert.equal(api.mergeWalls(top, split.wallIds[1], { commit: false }), top);
assert.equal(api.roomZones[0].name, "거실", "room metadata must survive merging the split wall back");

const door = api.insertOpening("door", bottom, 0.4, -1.5, { commit: false });
const windowId = api.insertOpening("window", top, 0, 1.5, { commit: false });
assert.ok(door && windowId);

const swingResult = api.setDoorSwing(door, "left", "in", { commit: false });
assert.equal(swingResult.hinge, "left");
assert.equal(swingResult.direction, "in");
assert.equal(swingResult.angleDeg, 90);
let doorElement = stateObject.setMasterPlan.elements.find((entry) => entry.id === door);
let doorItem = stateObject.items.find((entry) => entry.id === door);
assert.equal(doorElement.doorSwing.hinge, "left");
assert.equal(doorItem.doorSwing.direction, "in");

const openingMetrics = api.setOpeningMetrics(windowId, {
  widthM: 1.8,
  heightM: 1.1,
  mountedHeightM: 1.0,
  depthM: 0.14,
}, { commit: false });
assert.equal(openingMetrics.widthM, 1.8);
assert.equal(openingMetrics.heightM, 1.1);
assert.equal(openingMetrics.mountedHeightM, 1);
let windowElement = stateObject.setMasterPlan.elements.find((entry) => entry.id === windowId);
let windowItem = stateObject.items.find((entry) => entry.id === windowId);
assert.equal(windowElement.widthM, 1.8);
assert.equal(windowElement.heightM, 1.1);
assert.equal(windowItem.referenceDimensionsM.width, 1.8);
assert.equal(windowItem.mountedHeight, 1);
assert.equal(api.setOpeningMetrics(windowId, { widthM: 9 }, { commit: false }), false, "opening wider than its wall must be rejected");
assert.equal(windowElement.widthM, 1.8);

const bottomElement = stateObject.setMasterPlan.elements.find((entry) => entry.id === bottom);
const originalStartZ = bottomElement.line.start_z_m;
const originalEndZ = bottomElement.line.end_z_m;
assert.equal(api.setWallThicknessAlignment(bottom, "inside", { commit: false }), "inside");
assert.equal(bottomElement.thicknessAlignment, "inside");
assert.equal(bottomElement.line.start_z_m, originalStartZ, "alignment must not move the topology baseline");
assert.equal(bottomElement.line.end_z_m, originalEndZ);
let bottomItem = stateObject.items.find((entry) => entry.id === bottom);
assert.ok(Math.abs((bottomItem.y - 0.5) * 10 - (-1.4)) < 1e-9, "inside alignment should offset wall body toward the room by half thickness");
doorItem = stateObject.items.find((entry) => entry.id === door);
assert.ok(Math.abs((doorItem.y - 0.5) * 10 - (-1.4)) < 1e-9, "attached door must follow the physical wall-body offset");

assert.ok(api.setWallMetrics(bottom, 4, 0.3, { commit: false }));
bottomItem = stateObject.items.find((entry) => entry.id === bottom);
assert.ok(Math.abs((bottomItem.y - 0.5) * 10 - (-1.35)) < 1e-9, "changing thickness must preserve baseline and recompute inside offset");
assert.equal(bottomElement.line.start_z_m, -1.5);
assert.equal(bottomElement.line.end_z_m, -1.5);
doorItem = stateObject.items.find((entry) => entry.id === door);
assert.ok(Math.abs((doorItem.y - 0.5) * 10 - (-1.35)) < 1e-9);

const summary = api.getMeasurementSummary();
assert.equal(summary.rooms[0].name, "거실");
assert.equal(summary.rooms[0].use, "living");
assert.equal(summary.walls.find((entry) => entry.id === bottom).thicknessAlignment, "inside");
assert.equal(summary.openings.find((entry) => entry.id === windowId).widthM, 1.8);
assert.equal(summary.openings.find((entry) => entry.id === door).doorSwing.direction, "in");

const extra = api.createWall(-3, -3, -1, -3, { commit: false, snap: false });
assert.ok(extra);
assert.ok(api.setWallLengthFromMeasurement(extra, 3, { commit: false }));
const extraElement = stateObject.setMasterPlan.elements.find((entry) => entry.id === extra);
assert.equal(extraElement.line.length_m, 3);
assert.equal(commitCount, 0, "all commit:false CAD refinements must stay preview-only");

assert.equal(api.setRoomMetadata(api.roomZones[0].id, { name: "메인 거실", use: "living-room" }, { commit: true }).name, "메인 거실");
assert.equal(commitCount, 1, "an explicit committed room metadata edit must create exactly one revision");

console.log("architectural-cad-v4-runtime: room metadata, opening dimensions, door swing, editable measurements, and wall thickness alignment passed");
