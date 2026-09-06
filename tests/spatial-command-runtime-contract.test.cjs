const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const entry = fs.readFileSync(path.join(root, "mcp_desktop_entry.py"), "utf8");
const source = fs.readFileSync(path.join(root, "spatial_command_mcp.py"), "utf8");
const build = fs.readFileSync(path.join(root, "electron/scripts/build-python-runtime.cjs"), "utf8");

assert.match(entry, /import spatial_command_mcp/,
  "packaged MCP entrypoint must statically import the spatial command engine so PyInstaller bundles it");
assert.match(build, /entrypoint: "mcp_desktop_entry\.py"/,
  "desktop MCP bundle must still originate from the static extension entrypoint");

for (const tool of [
  "get_spatial_command_contract",
  "validate_spatial_set_commands",
  "apply_spatial_set_commands",
  "get_master_set_snapshot",
]) {
  assert.match(source, new RegExp(`\\"${tool}\\"`), `spatial command MCP must expose ${tool}`);
}

assert.match(source, /mcp-spatial-command-engine-v1/,
  "the engine must publish a stable execution policy id");
assert.match(source, /mutate_project_atomic/,
  "spatial command application must use the atomic project mutation path");
assert.match(source, /_compile_delta_operations/,
  "partial MCP edits must compile a stage delta instead of blindly rebuilding every item");
assert.match(source, /parent dependency cycle/,
  "dependency cycles must be rejected explicitly");
assert.match(source, /opening-too-wide/,
  "openings wider than their parent wall must be hard validation failures");
assert.match(source, /opening-attachment-clamped/,
  "small deterministic attachment repairs must be reported rather than hidden");
assert.match(source, /stable identity/,
  "MCP patches must preserve stable ids");
assert.match(source, /semantic_inference[^\n]*False/,
  "FrisFrame command validation must explicitly report that semantic inference is disabled");
assert.doesNotMatch(source, /requests\.|urllib|httpx|fetch\(/,
  "the execution engine must not search the web or call an AI/network service for spatial meaning");

console.log("spatial-command-runtime-contract: packaged deterministic MCP command engine contract passed");
