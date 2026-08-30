const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.resolve(__dirname, "../reference-workflow-core.js"), "utf8");

assert.match(source, /function installReferenceGhostUi\(target\)/, "Reference Ghost installer must exist");
assert.match(source, /referenceGhostPanel/, "Reference Ghost controls must be installed without editing the main app shell");
assert.match(source, /referenceGhostLayer/, "Reference Ghost image layer must exist");
assert.match(source, /referenceGhostObservationLayer/, "Reference Ghost must expose a DOM-only Scale\/Horizon observation layer");
assert.match(source, /referenceGhostObservationsEnabled/, "Reference observation guides must be independently showable from the Ghost image");
assert.match(source, /function buildReferenceGhostObservationModel\(blocking = \{\}, options = \{\}\)/,
  "Reference Ghost observation geometry must be a deterministic testable model");
assert.match(source, /normalizedToOverlayPoint/, "Observation guides must reuse shared normalized-image overlay coordinates");
assert.match(source, /scale-height/, "Ghost observations must understand persisted height anchors");
assert.match(source, /scale-width/, "Ghost observations must understand persisted width anchors");
assert.match(source, /kind === "horizon"/, "Ghost observations must understand persisted horizon anchors");
assert.match(source, /실선=Reference \/ 점선=현재 카메라/, "Ghost UI must explain observed versus current-camera geometry");
assert.match(source, /fitOverlayRect/, "Ghost layout must reuse spatial-scale-core overlay math");
assert.match(source, /ResizeObserver/, "Ghost layout must follow camera-preview resizing");
assert.match(source, /setInterval\?\.\(\(\) => \{[\s\S]*ghostState\.observationsEnabled[\s\S]*1200\)/,
  "Ghost observations must refresh after external MCP\/project changes without touching render ownership");
assert.match(source, /프리비즈 렌더와 MP4에는 포함되지 않습니다/, "UI must explain that the ghost is inspection-only");
assert.match(source, /function validateReferenceSpaceBlocking\(blocking = \{\}, options = \{\}\)/,
  "Reference Space validation must live in the already-shipped workflow core");
assert.match(source, /function installReferenceValidationUi\(target\)/,
  "Reference Space validation panel must be installed from the existing workflow runtime");
assert.match(source, /referenceSpaceValidationPanel/,
  "Reference Space validation panel must be visible without restoring the retired spatial runtime");
assert.equal(source.includes("reference-validation-ui.js"), false,
  "Reference Space validation must not introduce an extra static runtime file");
assert.equal(source.includes("reference-observation-ui.js"), false,
  "Reference Ghost observations must stay inside the shipped workflow runtime rather than adding a second spatial UI runtime");

const installerStart = source.indexOf("function installReferenceGhostUi(target)");
const installerEnd = source.indexOf("function installBatchReferenceExportUi(target)");
assert.ok(installerStart >= 0 && installerEnd > installerStart, "Reference Ghost installer boundaries must be inspectable");
const installer = source.slice(installerStart, installerEnd);
assert.equal(installer.includes("drawImage("), false, "Ghost and observations must stay out of render canvases");
assert.equal(installer.includes("exportVideoForDocument("), false, "Ghost observations must not alter the MP4 export path");

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

console.log("reference-ghost-ui-contract: non-destructive Ghost + observed/current Scale-Horizon overlay + validation contracts passed");
