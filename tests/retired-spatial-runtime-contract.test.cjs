const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

const retiredSpatialSymbols = [
  "renderSpatialGuideControls",
  "importSpatialReferenceImage",
  "clearSpatialReference",
  "spatialReferenceImageInput",
  "spatialReferenceStatus",
  "spatialReferencePreview",
  "clearSpatialReferenceBtn",
];

for (const symbol of retiredSpatialSymbols) {
  assert.equal(app.includes(symbol), false, `${symbol} must stay absent from app.js`);
  assert.equal(html.includes(symbol), false, `${symbol} must stay absent from index.html`);
}

console.log("retired-spatial-runtime-contract: removed spatial-reference runtime symbols remain absent");
