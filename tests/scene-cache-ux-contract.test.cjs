const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const main = fs.readFileSync(path.join(root, "electron/main.cjs"), "utf8");
const source = fs.readFileSync(path.join(root, "electron/scene-cache-ux.js"), "utf8");

assert.match(source, /function staticItemEligible\(/,
  "scene cache must explicitly define which items are safe to reuse");
assert.match(source, /item\.type !== "prop"/,
  "actors must remain on the dynamic 3D path");
assert.match(source, /sourceHasMotion\(item\.id, renderState\)/,
  "props with authored motion must never be reused as static scene objects");
assert.match(source, /itemInManualGroup\(item\.id, renderState\)/,
  "grouped props must remain dynamic because their resolved pose can depend on a leader");
assert.match(source, /selected\?\.kind === "item" && selected\.id === item\.id/,
  "the actively selected item must remain dynamic so selection\/edit helpers stay current");
assert.match(source, /threeView\.world\.remove\(entry\.group\)/,
  "reusable static objects must be detached before the normal world clear disposes dynamic content");
assert.match(source, /return cached\.group;/,
  "unchanged static objects must reuse their existing Three.js group");
assert.match(source, /previewRenderDepth/,
  "editor-world caching must be isolated from the separate camera-preview scene graph");

assert.ok(packageJson.build.files.includes("electron/scene-cache-ux.js"),
  "desktop package must include the static scene cache layer");
assert.match(main, /"scene-cache-ux\.js"[\s\S]*"preview-cache-ux\.js"[\s\S]*"performance-ux\.js"/,
  "static scene caching must load before preview caching and render coalescing");

console.log("scene-cache-ux-contract: static/dynamic 3D scene cache contracts passed");
