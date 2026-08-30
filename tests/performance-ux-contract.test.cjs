const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const main = fs.readFileSync(path.join(root, "electron/main.cjs"), "utf8");
const source = fs.readFileSync(path.join(root, "electron/performance-ux.js"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

assert.ok(source.includes("function activeDirectEdit()"),
  "performance layer must distinguish direct manipulation from ordinary UI updates");
assert.match(source, /activeTimelineDrag\(\) && fastTimelineDragStatus\(\)/,
  "timeline dragging must use the incremental marker path before falling back to a full rebuild");
assert.match(source, /if \(!updateInputs && cachedTimelineSignature && signature === cachedTimelineSignature\)/,
  "playhead-only timeline refreshes must reuse existing marker DOM when key topology is unchanged");
assert.match(source, /function objectListSignature\(\)/,
  "large actor\/prop lists must have a stable render signature");
assert.match(source, /cachedObjectListSkips \+= 1/,
  "unchanged actor\/prop lists must skip DOM reconstruction");
assert.match(source, /function sourceSelectSignature\(\)/,
  "timeline source selector must be cacheable independently from scene transforms");
assert.match(source, /cachedSourceSelectSkips \+= 1/,
  "unchanged source selectors must skip option reconstruction");
assert.match(source, /if \(root\?\.hidden\) return;/,
  "hidden split timelines must not be rebuilt in combined-timeline mode");
assert.match(source, /renderObjectLists = noop/,
  "direct manipulation must suppress actor\/prop list rebuilding");
assert.match(source, /renderSourceSelect = noop/,
  "direct manipulation must suppress source-select rebuilding");
assert.match(source, /syncProjectChrome = noop/,
  "direct manipulation must not recalculate project chrome and save fingerprints every pointer event");
assert.match(source, /function activeThreeNavigation\(\)/,
  "3D editor navigation must be distinguished from scene-authoring edits");
assert.match(source, /threeView\.renderer\.render\(threeView\.scene, threeView\.camera\)/,
  "3D orbit\/pan\/zoom must redraw the existing scene without rebuilding its world");
assert.match(source, /fastThreeNavigationRenders \+= 1/,
  "fast 3D navigation renders must be observable for regression diagnostics");
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
assert.match(app, /function scheduleAnnotationPreview\(/,
  "pen previews must be coalesced to animation frames");
assert.match(app, /function scheduleEraserPoint\(/,
  "eraser edits must be coalesced to animation frames");
assert.match(app, /currentAnnoTool === "eraser"[\s\S]*?if \(isAnnoDrawing\) scheduleEraserPoint/,
  "eraser hover must not repaint the full annotation canvas");
assert.ok(app.includes("annotation-eraser-cursor"),
  "eraser hover feedback must use a lightweight cursor layer");
assert.match(app, /function commitAnnotationChange\(\)/,
  "annotation edits must have a lightweight commit path");
assert.match(app, /let eraserChanged = false/,
  "eraser gesture changes must be grouped before committing");
assert.match(app, /if \(eraserChanged\) commitAnnotationChange\(\)/,
  "eraser must commit once when the gesture ends");
assert.match(app, /annotationBaseCache/,
  "3D annotation previews must reuse a cached committed layer");
assert.match(app, /viewMode !== "3d" && typeof drawAnnotations === "function"/,
  "3D draw must not repaint the annotation layer twice");

assert.ok(packageJson.build.files.includes("electron/performance-ux.js"),
  "desktop package must include the performance UX layer");
assert.match(main, /"performance-ux\.js"/,
  "Electron main process must inject the performance UX layer");

console.log("performance-ux-contract: large-scene caches, navigation fast path, posing, timeline, and render coalescing contracts passed");
