const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.resolve(__dirname, "../reference-workflow-core.js"), "utf8");

assert.match(source, /function installReferenceGhostUi\(target\)/, "Reference Ghost installer must exist");
assert.match(source, /referenceGhostPanel/, "Reference Ghost controls must be installed without editing the main app shell");
assert.match(source, /referenceGhostLayer/, "Reference Ghost image layer must exist");
assert.match(source, /fitOverlayRect/, "Ghost layout must reuse spatial-scale-core overlay math");
assert.match(source, /ResizeObserver/, "Ghost layout must follow camera-preview resizing");
assert.match(source, /프리비즈 렌더와 MP4에는 포함되지 않습니다/, "UI must explain that the ghost is inspection-only");
assert.match(source, /function validateReferenceSpaceBlocking\(blocking = \{\}, options = \{\}\)/,
  "Reference Space validation must live in the already-shipped workflow core");
assert.match(source, /function installReferenceValidationUi\(target\)/,
  "Reference Space validation panel must be installed from the existing workflow runtime");
assert.match(source, /referenceSpaceValidationPanel/,
  "Reference Space validation panel must be visible without restoring the retired spatial runtime");
assert.equal(source.includes("reference-validation-ui.js"), false,
  "Reference Space validation must not introduce an extra static runtime file");

const installerStart = source.indexOf("function installReferenceGhostUi(target)");
const installerEnd = source.indexOf("function installBatchReferenceExportUi(target)");
assert.ok(installerStart >= 0 && installerEnd > installerStart, "Reference Ghost installer boundaries must be inspectable");
const installer = source.slice(installerStart, installerEnd);
assert.equal(installer.includes("drawImage("), false, "Ghost must stay out of render canvases");
assert.equal(installer.includes("exportVideoForDocument("), false, "Ghost must not alter the MP4 export path");

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
  assert.equal(source.includes(symbol), false, `${symbol} must remain retired from reference-workflow-core.js`);
}

console.log("reference-ghost-ui-contract: non-destructive Ghost + inlined Reference Space validation contracts passed");
