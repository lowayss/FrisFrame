const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const entry = fs.readFileSync(path.join(root, "mcp_desktop_entry.py"), "utf8");
const extension = fs.readFileSync(path.join(root, "set_reconstruction_mcp.py"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const sceneCore = fs.readFileSync(path.join(root, "scene-blocking-core.js"), "utf8");

assert.match(entry,
  /import reference_interpretation_mcp[\s\S]*import set_reconstruction_mcp[\s\S]*from mcp_previs_server import main as run_mcp/,
  "packaged MCP must install reference interpretation before 2D-master set reconstruction");

for (const tool of [
  "get_set_reconstruction_contract",
  "validate_set_master_plan",
  "apply_set_master_plan",
  "set_set_collection_lock",
]) {
  assert.ok(extension.includes(`\"${tool}\"`), `${tool} must remain in the set reconstruction extension`);
}

assert.match(extension, /2d-master-first-single-source-of-truth/,
  "set reconstruction must keep the 2D metric master plan as source of truth");
assert.match(extension, /referenceDimensionsM/,
  "set reconstruction must compile master-plan dimensions into shared metric scene dimensions");
assert.match(extension, /setCollections/,
  "semantic set collections must be persisted separately from rigid motion groups");
assert.match(extension, /editLocked/,
  "semantic collection locking must use the editor's persisted item lock contract");
assert.match(extension, /unlockedMemberIds/,
  "semantic set collections must preserve partial unlock exceptions");
assert.match(extension, /motionEnabled/,
  "generated static set pieces must not accidentally become motion subjects");

assert.match(sceneCore, /referenceDimensionsM/,
  "scene blocking core must keep metric physical dimensions on shared scene objects");
assert.match(app, /function propPhysicalDimensions\(item\)/,
  "2D and 3D renderer must resolve metric prop dimensions through one function");
assert.match(app, /const dimensions = propPhysicalDimensions\(renderItem\);[\s\S]*drawPropFootprint/,
  "2D stage footprint must be based on metric prop dimensions");
assert.match(app, /const propDimensions = item\.type === \"prop\" \? propPhysicalDimensions\(renderItem\) : null/,
  "3D rendering path must use the same metric prop dimensions");

console.log("set-reconstruction-runtime-contract: 2D-first metric source, 3D reuse, semantic locks, and packaged MCP import passed");
