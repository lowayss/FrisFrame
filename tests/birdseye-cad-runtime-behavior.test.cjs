"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

const source = fs.readFileSync(path.resolve(__dirname, "../boot-errors.js"), "utf8");
const start = source.indexOf("(function initBirdseyeCadEditFlow() {");
assert.ok(start >= 0, "CAD bootstrap is missing");
const cadSource = source.slice(start);

const listeners = {};
const documentStub = {
  head: { appendChild() {} },
  addEventListener(type, handler) { listeners[type] = handler; },
  getElementById() { return null; },
  querySelector() { return null; },
};
const windowStub = {
  FrisFrameBirdseye25D: { mode: "2d", setMode() {}, fit() {} },
  addEventListener(type, handler) { listeners[`window:${type}`] = handler; },
};
const context = {
  console,
  window: windowStub,
  document: documentStub,
  Element: class Element {},
  requestAnimationFrame(fn) { fn(); },
  setTimeout() {},
  state: { items: [], setMasterPlan: null },
  updateThreeEditorDrag() {},
  pollManagedProjectCommands: async () => {},
  syncUi() {},
  renderThreeView() {},
};
vm.createContext(context);
vm.runInContext(cadSource, context, { filename: "boot-errors.js#cad" });
assert.equal(typeof listeners["window:load"], "function");

console.log("2.5D CAD runtime bootstrap behavior passed");
