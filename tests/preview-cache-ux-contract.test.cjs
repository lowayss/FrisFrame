const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const main = fs.readFileSync(path.join(root, "electron/main.cjs"), "utf8");
const source = fs.readFileSync(path.join(root, "electron/preview-cache-ux.js"), "utf8");

assert.match(source, /function previewWorldSignature\(/,
  "preview cache must fingerprint scene geometry independently from camera values");
assert.match(source, /renderState\.groups \|\| \[\]/,
  "preview cache signature must include grouped transforms");
assert.match(source, /renderState\.items \|\| \[\]/,
  "preview cache signature must include all actor and prop state");
assert.match(source, /signature === cachedWorldSignature && fastRenderCameraPreview/,
  "camera-only updates must reuse the existing preview world");
assert.match(source, /cameraPreviewDocument\(renderState, profile\.id\)/,
  "cached preview must still resolve each active camera profile on every render");
assert.match(source, /threeView\.frameCamera\.fov = horizontalFovToVerticalFov/,
  "cached preview must update lens FOV instead of freezing camera optics");
assert.match(source, /stats\.previewWorldReuses \+= 1/,
  "preview cache reuse must be observable for desktop performance diagnostics");
assert.match(source, /cachedLabelSignature/,
  "unchanged multicamera labels should not be rebuilt on every camera move");

assert.ok(packageJson.build.files.includes("electron/preview-cache-ux.js"),
  "desktop package must include the camera preview cache layer");
const previewIndex = main.indexOf('"preview-cache-ux.js"');
const performanceIndex = main.indexOf('"performance-ux.js"');
assert.ok(previewIndex >= 0 && performanceIndex > previewIndex,
  "preview cache must load before the generic render coalescer so cache signatures update only after real world rebuilds");

console.log("preview-cache-ux-contract: world reuse, live camera optics, labels, and injection order passed");
