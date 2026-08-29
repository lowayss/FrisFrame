const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const preload = fs.readFileSync(path.join(root, "electron/preload.cjs"), "utf8");
const alignment = fs.readFileSync(path.join(root, "electron/alignment-ux.js"), "utf8");
const main = fs.readFileSync(path.join(root, "electron/main.cjs"), "utf8");
const referenceWorkflow = fs.readFileSync(path.join(root, "reference-workflow-core.js"), "utf8");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const guide = fs.readFileSync(path.join(root, "docs/USER_GUIDE.md"), "utf8");
const workflow = fs.readFileSync(path.join(root, "MCP_FIRST_WORKFLOW.md"), "utf8");

// Desktop renderer bridge stays narrow: deterministic editor support only.
assert.match(preload, /copyImage:\s*\(pngBytes\)/,
  "desktop bridge must keep image clipboard support");
assert.match(preload, /saveFile:\s*\(payload\)/,
  "desktop bridge must keep explicit file-save support");
assert.equal(/generateImage\s*:|generateVideo\s*:|seedancePrompt\s*:|aiPrompt\s*:/.test(preload), false,
  "desktop bridge must not expose generative-AI or final-prompt APIs");

// Legacy output surfaces may remain in shared app.js/index.html until their bindings are
// safely split, but the Electron product must actively remove them from the user workflow.
for (const retiredId of [
  "blockingPlanBtn",
  "backgroundSheetBtn",
  "productionPackBtn",
  "multiCamPreviewBtn",
  "multiCamVideoBtn",
]) {
  assert.ok(preload.includes(`\"${retiredId}\"`),
    `desktop workflow must retire ${retiredId}`);
}
assert.match(preload, /document\.querySelectorAll\("\.spatial-reference-panel"\)[\s\S]*\.remove\(\)/,
  "desktop workflow must remove the in-app spatial/background reference panel");

// Reference workflow core now owns only batch MP4 export + internal safety policy.
assert.match(referenceWorkflow, /installBatchReferenceExportUi/,
  "multi-cut MP4 ZIP export must remain available");
for (const retiredSymbol of [
  "buildReferencePromptGuide",
  "installReferencePromptGuideUi",
  "referencePromptGuideBtn",
  "installReferenceReadinessUi",
  "referenceReadinessBtn",
]) {
  assert.equal(referenceWorkflow.includes(retiredSymbol), false,
    `${retiredSymbol} must not return to the supported reference workflow core`);
}

// Selection/alignment polish must stay discoverable and use the freshly typed time.
assert.match(alignment, /Alt\/Option\+클릭 · 겹친 대상 순환/,
  "overlap cycling must be discoverable in 3D help");
assert.match(alignment, /Alt\+드래그 · 정렬 스냅 해제/,
  "snap bypass must be discoverable in 3D help");
assert.match(alignment, /window\.addEventListener\("pointerdown"[\s\S]*syncPlayheadFromTimeInput\(\)[\s\S]*}, true\)/,
  "typed timeline time must sync before overlap selection resolves candidates");
assert.match(alignment, /threeDrag\.editor\?\.forceMode !== "move"/,
  "forced 3D move handles must retain magnetic alignment");

// All production UX layers that own the MCP-first desktop workflow stay packaged.
for (const filename of [
  "electron/selection-ux.js",
  "electron/alignment-ux.js",
  "electron/helper-raycast-ux.js",
  "electron/performance-ux.js",
]) {
  assert.ok(packageJson.build.files.includes(filename), `${filename} must ship in desktop builds`);
  assert.ok(main.includes(`\"${path.basename(filename)}\"`), `${filename} must be injected by Electron`);
}

// User-facing documentation must describe the current boundary, not the retired pack/prompt workflow.
assert.match(guide, /외부 vision-capable MCP 클라이언트/,
  "user guide must assign image interpretation to the external MCP client");
assert.match(guide, /runtime\/mcp\/frisframe-mcp/,
  "user guide must document the packaged macOS MCP executable");
assert.match(guide, /runtime\/mcp\/frisframe-mcp\.exe/,
  "user guide must document the packaged Windows MCP executable");
assert.equal(guide.includes("촬영 자료 ZIP"), false,
  "retired Production Pack wording must not return to the primary user guide");
assert.equal(guide.includes("scene_manifest.json"), false,
  "retired background-sheet manifest flow must not return to the primary user guide");
assert.match(workflow, /FrisFrame 자체는 이미지를 분석하지 않는다/,
  "workflow doc must keep vision interpretation outside FrisFrame");
assert.match(workflow, /최종 Seedance 프롬프트를 작성한다/,
  "workflow doc must keep final prompt composition in the external MCP conversation");

console.log("mcp-first-product-boundary: prompt/readiness UI removal, desktop UI, docs, selection polish, and AI boundary contracts passed");
