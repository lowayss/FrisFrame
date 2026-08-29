const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const main = fs.readFileSync(path.join(root, "electron/main.cjs"), "utf8");
const source = fs.readFileSync(path.join(root, "electron/stage-shell-cache-ux.js"), "utf8");

assert.match(source, /function stageShellSignature\(/,
  "3D stage shell must have a deterministic size-based cache identity");
assert.match(source, /Number\(width\.toFixed\(6\)\)/,
  "stage width must be normalized before cache comparison");
assert.match(source, /Number\(depth\.toFixed\(6\)\)/,
  "stage depth must be normalized before cache comparison");
assert.match(source, /STAGE_GRID_STEP_METERS/,
  "grid cache identity must include the authored grid step");
assert.match(source, /threeView\.world\.remove\(gridCache\.group\)/,
  "cached grid geometry must be detached before the normal Three.js world clear");
assert.match(source, /threeView\.world\.remove\(borderCache\.group\)/,
  "cached border geometry must be detached before the normal Three.js world clear");
assert.match(source, /originalMakeStageGrid\(size\)/,
  "the existing stage-grid renderer must remain the source of truth");
assert.match(source, /originalMakeStageBorder\(size\)/,
  "the existing stage-border renderer must remain the source of truth");
assert.match(source, /stats\.gridReuses \+= 1/,
  "grid reuse must be observable for performance validation");
assert.match(source, /stats\.borderReuses \+= 1/,
  "border reuse must be observable for performance validation");
assert.match(source, /previewRenderDepth/,
  "editor stage-shell caching must remain isolated from camera preview rendering");

const sandbox = {
  console,
  document: { documentElement: { dataset: {} } },
  window: { addEventListener() {} },
  state: {},
  STAGE_GRID_STEP_METERS: 1,
};
vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: "stage-shell-cache-ux.js" });
const api = sandbox.window.FrisFrameStageShellCacheUxTest;
assert.ok(api, "stage shell cache must expose deterministic cache policy for regression tests");

const landscape = { width: 12, depth: 6.75 };
assert.equal(
  api.stageShellSignature(landscape),
  api.stageShellSignature({ width: 12, depth: 6.75 }),
  "unchanged stage dimensions must reuse the same grid and border shell",
);
assert.notEqual(
  api.stageShellSignature(landscape),
  api.stageShellSignature({ width: 12, depth: 9 }),
  "aspect/stage-depth changes must invalidate the cached shell",
);
assert.notEqual(
  api.stageShellSignature(landscape),
  api.stageShellSignature({ width: 10, depth: 6.75 }),
  "stage-width changes must invalidate the cached shell",
);

assert.ok(packageJson.build.files.includes("electron/stage-shell-cache-ux.js"),
  "desktop package must include the stage-shell cache layer");
assert.match(main, /"scene-cache-ux\.js"[\s\S]*"stage-shell-cache-ux\.js"[\s\S]*"camera-path-cache-ux\.js"[\s\S]*"preview-cache-ux\.js"/,
  "stage-shell caching must load after item caching and before camera/path and preview caching");

console.log("stage-shell-cache-ux-contract: 3D grid and border shell cache contracts passed");
