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
assert.ok(documentObject.getElementById("architecturalCadToolbox"), "2.5D CAD toolbox must be installed");

const bottom = api.createWall(-2, -1.5, 2, -1.5, { commit: false, snap: false });
const right = api.createWall(2, -1.5, 2, 1.5, { commit: false, snap: false });
const top = api.createWall(2, 1.5, -2, 1.5, { commit: false, snap: false });
const left = api.createWall(-2, 1.5, -2, -1.5, { commit: false, snap: false });
assert.ok(bottom && right && top && left);
assert.equal(api.roomZones.length, 1, "four drawn walls should derive one closed room");
assert.equal(api.roomZones[0].areaM2, 12);
assert.equal(commitCount, 0, "preview/programmatic construction with commit:false must not create history revisions");

const door = api.insertOpening("door", bottom, 0.5, -1.5, { commit: false });
assert.ok(door);
let doorElement = stateObject.setMasterPlan.elements.find((entry) => entry.id === door);
assert.equal(doorElement.parentId, bottom);
assert.equal(doorElement.kind, "door");

const split = api.splitWall(bottom, 0, -1.5, { commit: false });
assert.ok(split && split.wallIds.length === 2, "wall split should produce two segments");
assert.equal(split.wallIds[0], bottom, "first split segment keeps the original wall id");
const bottomB = split.wallIds[1];
doorElement = stateObject.setMasterPlan.elements.find((entry) => entry.id === door);
assert.equal(doorElement.parentId, bottomB, "opening on the second half must move to the new wall segment");
assert.equal(api.roomZones.length, 1, "splitting a boundary wall must preserve the room boundary");
assert.equal(api.splitWall(bottom, -1.98, -1.5, { commit: false }), false, "splitting too close to an endpoint must be rejected");

const merged = api.mergeWalls(bottom, bottomB, { commit: false });
assert.equal(merged, bottom, "merge keeps the first wall as the surviving source id");
assert.equal(stateObject.setMasterPlan.elements.some((entry) => entry.id === bottomB), false);
doorElement = stateObject.setMasterPlan.elements.find((entry) => entry.id === door);
assert.equal(doorElement.parentId, bottom, "openings from merged segments must re-parent to the surviving wall");
assert.equal(api.roomZones.length, 1);
assert.equal(api.mergeWalls(bottom, right, { commit: false }), false, "perpendicular walls must not merge");

const windowId = api.insertOpening("window", top, 0, 1.5, { commit: false });
assert.ok(windowId);
const windowElement = stateObject.setMasterPlan.elements.find((entry) => entry.id === windowId);
assert.equal(windowElement.parentId, top);
assert.equal(windowElement.kind, "window");
assert.equal(windowElement.mountedHeightM, 0.9);

const summary = api.getMeasurementSummary();
assert.equal(summary.walls.length, 4);
assert.equal(summary.rooms.length, 1);
assert.equal(summary.rooms[0].areaM2, 12);
assert.equal(summary.walls.reduce((sum, wall) => sum + wall.lengthM, 0), 14);
assert.equal(api.setMeasurementsVisible(false), false);
assert.equal(api.setMeasurementsVisible(true), true);
assert.equal(api.setTool("wall"), true);
assert.equal(api.activeTool, "wall");
assert.equal(api.setTool("bogus"), false);

const architecture = stateObject.setCollections.find((collection) => collection.id === "architecture");
assert.ok(architecture, "direct CAD entities must live in the shared architecture collection");
for (const id of [bottom, right, top, left, door, windowId]) {
  assert.ok(architecture.memberIds.includes(id), `architecture collection must include ${id}`);
}

const extra = api.createWall(-3, -3, -1, -3, { commit: true, snap: false });
assert.ok(extra);
assert.equal(commitCount, 1, "a committed CAD construction must create exactly one project revision");

console.log("architectural-cad-v3-runtime: draw, split, merge, opening insertion, collections, and metric overlays passed");
