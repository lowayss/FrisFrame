const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const main = fs.readFileSync(path.join(root, "electron/main.cjs"), "utf8");
const source = fs.readFileSync(path.join(root, "electron/performance-ux.js"), "utf8");

assert.ok(source.includes("function activeDirectEdit()"),
  "performance layer must distinguish direct manipulation from ordinary UI updates");
assert.match(source, /activeTimelineDrag\(\) && fastTimelineDragStatus\(\)/,
  "timeline dragging must use the incremental marker path before falling back to a full rebuild");
assert.match(source, /if \(root\?\.hidden\) return;/,
  "hidden split timelines must not be rebuilt in combined-timeline mode");
assert.match(source, /renderObjectLists = noop/,
  "direct manipulation must suppress actor\/prop list rebuilding");
assert.match(source, /renderSourceSelect = noop/,
  "direct manipulation must suppress source-select rebuilding");
assert.match(source, /syncProjectChrome = noop/,
  "direct manipulation must not recalculate project chrome and save fingerprints every pointer event");
assert.match(source, /function flushFastPoseControls\(/,
  "pose dragging must have a lightweight inspector update path");
assert.match(source, /activePoseDrag\(\) && scheduleFastPoseControls\(updateInputs\)/,
  "pose dragging must bypass the full properties\/preset-grid rebuild path");
assert.match(source, /stats\.coalescedPoseUi \+= 1/,
  "pose inspector writes must be coalesced to animation frames");
assert.match(source, /document\.addEventListener\("pointerup", finishPoseSession, true\)/,
  "pose inspector must perform a full refresh after the direct edit finishes");
assert.match(source, /requestAnimationFrame\(\(\) => \{/,
  "expensive direct-edit renderers must be coalesced on animation frames");
assert.match(source, /coalesceDirectRenderer\("renderThreeView"/,
  "3D world rebuilds must be coalesced during direct manipulation");
assert.match(source, /coalesceDirectRenderer\("renderCameraFramePreview"/,
  "camera-frame preview renders must be coalesced during direct manipulation");

assert.ok(packageJson.build.files.includes("electron/performance-ux.js"),
  "desktop package must include the performance UX layer");
assert.match(main, /"performance-ux\.js"/,
  "Electron main process must inject the performance UX layer");

console.log("performance-ux-contract: fast sync, incremental timeline, pose fast path, and render coalescing contracts passed");
