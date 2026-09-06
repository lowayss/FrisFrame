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
    this.checked = false;
    this.attributes = {};
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
  setAttribute(name, value) { this.attributes[name] = String(value); }
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
  createElementNS(_ns, tag) { return new FakeElement(tag); },
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
assert.ok(documentObject.getElementById("architecturalCadDrafting"), "drafting SVG layer must be installed");

const bottom = api.createWall(-2, -1.5, 2, -1.5, { commit: false, snap: false, thicknessM: 0.2 });
const right = api.createWall(2, -1.5, 2, 1.5, { commit: false, snap: false, thicknessM: 0.2 });
const top = api.createWall(2, 1.5, -2, 1.5, { commit: false, snap: false, thicknessM: 0.2 });
const left = api.createWall(-2, 1.5, -2, -1.5, { commit: false, snap: false, thicknessM: 0.2 });
assert.ok(bottom && right && top && left);
assert.equal(api.roomZones.length, 1);
assert.equal(api.roomZones[0].areaM2, 12);

const selectedRoom = api.selectRoomAtPoint(0, 0);
assert.equal(selectedRoom, api.roomZones[0].id, "point inside room should select that room");
assert.equal(api.selectedRoomId, api.roomZones[0].id);
let summary = api.getMeasurementSummary();
assert.equal(summary.rooms[0].selected, true, "measurement summary must expose selected room state");
assert.equal(api.selectRoomAtPoint(4.5, 4.5), null, "point outside every room clears room selection");
assert.equal(api.selectedRoomId, null);

const dimension = api.getWallDimensionGeometry(bottom);
assert.ok(dimension);
assert.equal(Number(dimension.lengthM.toFixed(6)), 4);
assert.ok(dimension.start.zM < -1.5 && dimension.end.zM < -1.5, "bottom wall CAD dimension should sit outside the room");
assert.equal(Number(Math.hypot(dimension.end.xM - dimension.start.xM, dimension.end.zM - dimension.start.zM).toFixed(6)), 4);

const door = api.insertOpening("door", bottom, 0, -1.5, { commit: false });
assert.ok(door);
let swing = api.setDoorSwing(door, "left", "in", { commit: false, angleDeg: 90 });
assert.equal(swing.hinge, "left");
let geometry = api.getDoorSwingGeometry(door);
assert.ok(geometry && geometry.arc.length >= 7, "door swing must expose a drawable arc");
assert.ok(geometry.openEnd.zM > geometry.hinge.zM, "inward swing on bottom wall must open into the room");
assert.equal(Number(Math.hypot(geometry.openEnd.xM - geometry.hinge.xM, geometry.openEnd.zM - geometry.hinge.zM).toFixed(6)), Number(geometry.widthM.toFixed(6)), "open leaf length must equal door width");
api.setDoorSwing(door, "left", "out", { commit: false, angleDeg: 90 });
geometry = api.getDoorSwingGeometry(door);
assert.ok(geometry.openEnd.zM < geometry.hinge.zM, "outward swing must flip to the opposite side of the wall");

const constrained = api.createWall(-3, -3, -1, -3, { commit: false, snap: false });
assert.ok(constrained);
let constraint = api.setWallConstraint(constrained, { axis: "horizontal", lengthLocked: true }, { commit: false });
assert.equal(constraint.axis, "horizontal");
assert.equal(constraint.lengthLocked, true);
assert.equal(Number(constraint.lengthM.toFixed(6)), 2);
assert.ok(api.setWallEndpoint(constrained, "end", 3.5, -1.7, { snap: false, commit: false }));
let constrainedElement = stateObject.setMasterPlan.elements.find((entry) => entry.id === constrained);
assert.equal(Number(constrainedElement.line.end_z_m.toFixed(6)), -3, "horizontal constraint must keep endpoint on the same Z axis");
assert.equal(Number(constrainedElement.line.length_m.toFixed(6)), 2, "length lock must resist endpoint drag length changes");

assert.ok(api.setWallMetrics(constrained, 3.2, 0.15, { commit: false }), "numeric length edit should update a locked target length");
constraint = api.getWallConstraint(constrained);
assert.equal(Number(constraint.lengthM.toFixed(6)), 3.2);
assert.ok(api.setWallEndpoint(constrained, "end", 4.8, -2.2, { snap: false, commit: false }));
constrainedElement = stateObject.setMasterPlan.elements.find((entry) => entry.id === constrained);
assert.equal(Number(constrainedElement.line.length_m.toFixed(6)), 3.2);
assert.equal(Number(constrainedElement.line.end_z_m.toFixed(6)), -3);

const vertical = api.createWall(3, -3, 3, -1, { commit: false, snap: false });
assert.ok(vertical);
constraint = api.setWallConstraint(vertical, { axis: "vertical", lengthLocked: false }, { commit: false });
assert.equal(constraint.axis, "vertical");
assert.ok(api.setWallEndpoint(vertical, "end", 4.5, 0.5, { snap: false, commit: false }));
const verticalElement = stateObject.setMasterPlan.elements.find((entry) => entry.id === vertical);
assert.equal(Number(verticalElement.line.end_x_m.toFixed(6)), 3, "vertical constraint must preserve X while endpoint moves");

summary = api.getMeasurementSummary();
const constrainedSummary = summary.walls.find((entry) => entry.id === constrained);
assert.equal(constrainedSummary.constraint.axis, "horizontal");
assert.equal(constrainedSummary.constraint.lengthLocked, true);
const doorSummary = summary.openings.find((entry) => entry.id === door);
assert.ok(doorSummary.swingGeometry && doorSummary.swingGeometry.direction === "out");

assert.equal(commitCount, 0, "commit:false drafting and constraint edits must remain preview-only");
api.setWallConstraint(constrained, { lengthLocked: false }, { commit: true });
assert.equal(commitCount, 1, "explicit committed constraint edit must create exactly one revision");

console.log("architectural-cad-v5-runtime: room selection, door swing drafting, CAD dimensions, and wall constraints passed");
