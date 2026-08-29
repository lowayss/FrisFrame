const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const main = fs.readFileSync(path.join(root, "electron/main.cjs"), "utf8");
const source = fs.readFileSync(path.join(root, "electron/history-safety-ux.js"), "utf8");

assert.ok(packageJson.build.files.includes("electron/history-safety-ux.js"),
  "desktop package must include the history/safety UX layer");
assert.match(main, /"history-safety-ux\.js"/,
  "Electron main process must inject the history/safety UX layer");
assert.match(source, /event\.key === "Escape" && cancelActiveDirectEdit\(\)/,
  "Escape must cancel an active direct edit before the core shortcut handler runs");
assert.match(source, /event\.ctrlKey[^]*event\.key\.toLowerCase\(\) === "y"/,
  "Windows-style Ctrl+Y redo must be supported");
assert.match(source, /event\.key\.toLowerCase\(\) === "l"/,
  "L must toggle the contextual selection lock outside text inputs");
assert.match(source, /itemEditLockBtn/,
  "item quick lock must reuse the existing item lock action");
assert.match(source, /data-camera-lock="position"/,
  "camera quick lock must reuse the existing camera-position lock action");
assert.match(source, /visibilitychange/,
  "dirty managed projects should request an immediate save when the app is backgrounded");
assert.match(source, /2600/,
  "autosave detail must stay aligned with the existing 2.6 second autosave cadence");
assert.match(source, /frisframe:drag-cancelled/,
  "drag cancellation must publish a cleanup event for companion UX layers");

console.log("history-safety-contract: undo/redo, autosave, lock, and drag cancellation contracts passed");
