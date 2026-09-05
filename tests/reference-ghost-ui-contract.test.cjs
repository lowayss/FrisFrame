const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const workflow = fs.readFileSync(path.join(root, "reference-workflow-core.js"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "styles.css"), "utf8");

for (const source of [workflow, app, styles]) {
  assert.equal(source.includes("Reference Ghost"), false, "Reference Ghost must stay removed from the user-facing app");
  assert.equal(source.includes("referenceGhost"), false, "Reference Ghost selectors and state must stay removed");
  assert.equal(source.includes("reference-ghost"), false, "Reference Ghost CSS and events must stay removed");
}

assert.equal(workflow.includes("installReferenceGhostUi"), false, "Reference Ghost must not have an installer");
assert.equal(workflow.includes("buildReferenceGhostObservationModel"), false, "Reference Ghost observation model must be removed");
assert.equal(app.includes("cameraPreviewGhostSettings"), false, "Camera preview must not read Ghost opacity state");
assert.equal(app.includes("applyCameraPreviewSubjectOpacity"), false, "Camera preview must keep authored actor opacity");
assert.match(app, /function renderCameraFramePreview\(/, "The regular camera preview must remain available");
assert.match(app, /previewScene\.background = null/, "The regular camera preview must remain free of the editor stage shell");
assert.match(app, /canvas: frameCanvas,[\s\S]*?alpha: true/, "The regular camera preview must preserve transparent compositing");
assert.match(workflow, /installBatchReferenceExportUi/, "Reference video export must remain available");
assert.match(workflow, /installReferenceValidationUi/, "Reference Space validation code must remain available for explicit MCP/headless use");

console.log("reference-ghost-ui-contract: Reference Ghost user-facing feature is removed and regular preview/Reference Space boundaries remain");
