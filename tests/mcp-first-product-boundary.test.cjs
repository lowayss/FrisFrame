const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const preload = fs.readFileSync(path.join(root, "electron/preload.cjs"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const alignment = fs.readFileSync(path.join(root, "electron/alignment-ux.js"), "utf8");
const main = fs.readFileSync(path.join(root, "electron/main.cjs"), "utf8");
const referenceWorkflow = fs.readFileSync(path.join(root, "reference-workflow-core.js"), "utf8");
const maintenance = fs.readFileSync(path.join(root, "MAINTENANCE.md"), "utf8");
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

// Retired output/reference surfaces are physically absent from the shared browser source.
// Electron must not carry a second hide/remove compatibility layer for them.
for (const retiredId of [
  "blockingPlanBtn",
  "blockingPlanPanelBtn",
  "backgroundSheetBtn",
  "backgroundSheetPanelBtn",
  "productionPackBtn",
  "productionPackPanelBtn",
  "multiCamPreviewBtn",
  "multiCamPreviewPanelBtn",
  "multiCamPreviewPanelBtnSecondary",
  "multiCamVideoBtn",
  "multiCamVideoPanelBtn",
  "spatialReferenceImageInput",
  "clearSpatialReferenceBtn",
]) {
  assert.equal(html.includes(`id="${retiredId}"`), false,
    `${retiredId} must stay physically removed from shared HTML`);
}
for (const retiredFunction of [
  "exportBlockingPlanImage",
  "exportBackgroundSheetReference",
  "exportProductionPack",
  "exportMultiCameraPreview",
  "exportMultiCameraVideo",
  "buildSeedancePrompt",
  "buildAiGenerationBrief",
  "importSpatialReferenceImage",
  "clearSpatialReference",
]) {
  assert.equal(app.includes(`function ${retiredFunction}(`), false,
    `${retiredFunction} must stay physically removed from shared app source`);
}
assert.equal(html.includes("spatial-reference-panel"), false,
  "in-app spatial/background reference panel must stay physically removed");
assert.equal(preload.includes("retiredExportIds"), false,
  "Electron preload must not maintain a retired-export ID shim");
assert.equal(preload.includes("removeRetiredExportControls"), false,
  "Electron preload must not hide source-level legacy export controls");
assert.equal(preload.includes(".spatial-reference-panel"), false,
  "Electron preload must not remove an already-deleted spatial reference panel");

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
assert.equal(fs.existsSync(path.join(root, "REFERENCE_PROMPT_GUIDE.md")), false,
  "retired in-app Reference Prompt guide must stay deleted");

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

// User-facing and maintainer docs must describe the current boundary, not the retired pack/prompt workflow.
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
assert.match(workflow, /"mcpServers"/,
  "workflow doc must include a copyable MCP client configuration shape");
assert.match(workflow, /\/Applications\/FrisFrame\.app\/Contents\/Resources\/runtime\/mcp\/frisframe-mcp/,
  "workflow doc must include a packaged macOS MCP command example");
assert.match(workflow, /FrisFrame\\\\resources\\\\runtime\\\\mcp\\\\frisframe-mcp\.exe/,
  "workflow doc must include a packaged Windows MCP command example");
assert.match(workflow, /"PREVIS_DB_PATH"/,
  "workflow doc must show how development or test clients can target an explicit project DB");
assert.match(workflow, /`list_projects`를 먼저 호출/,
  "workflow doc must include a simple post-registration connection check");
assert.match(workflow, /`get_project`로 최신 `revision`/,
  "workflow doc must tell clients to refresh revision before mutation");
assert.match(maintenance, /Reference Prompt 사용자 UI/,
  "maintenance guide must explicitly keep Reference Prompt UI outside the product boundary");
assert.match(maintenance, /320개 대상 \+ 8,000개 키프레임/,
  "maintenance guide must document the large-scene regression fixture");
assert.equal(maintenance.includes("촬영 자료 ZIP과 MP4 프리뷰"), false,
  "maintenance checklist must not restore the retired production-pack flow");

console.log("mcp-first-product-boundary: prompt/readiness removal, desktop UI, docs, client setup, maintenance, selection polish, and AI boundary contracts passed");
