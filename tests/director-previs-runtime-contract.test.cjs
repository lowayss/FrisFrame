"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const entry = fs.readFileSync(path.join(root, "mcp_desktop_entry.py"), "utf8");
const runtime = fs.readFileSync(path.join(root, "director_previs_mcp.py"), "utf8");

assert.match(entry, /import director_previs_mcp/,
  "packaged MCP entrypoint must statically import the director previs engine so PyInstaller bundles it");
for (const tool of [
  "get_director_previs_contract",
  "validate_director_previs_plan",
  "apply_director_previs_plan",
  "get_director_previs_snapshot",
]) {
  assert.match(runtime, new RegExp(`\\"${tool}\\"`), `director previs runtime must expose ${tool}`);
}
assert.match(runtime, /core\.mutate_project_atomic\(/,
  "director previs apply must commit through one atomic project transaction");
assert.match(runtime, /spatial\._prepare_transaction\(/,
  "director previs set layer must reuse the authoritative spatial command engine rather than invent a second set model");
assert.match(runtime, /core\.handle_apply_scene_commands\(/,
  "director previs must execute existing deterministic stage commands for actors/camera/set proxies");
assert.match(runtime, /core\.handle_apply_motion_commands\(/,
  "director previs must execute existing deterministic actor/camera timeline keys");
assert.match(runtime, /semantic_guessing_inside_frisframe[\s\S]*False/,
  "director previs contract must preserve the MCP-decides / FrisFrame-executes product boundary");
assert.match(runtime, /setMasterPlan/,
  "director snapshot must preserve Master Set as the spatial source of truth");
assert.match(runtime, /shotDesign/,
  "director previs must persist shot/framing metadata with the cut");
assert.match(runtime, /trackingTargetId/,
  "director camera implementation must persist explicit tracking targets");
assert.match(runtime, /focusDistanceM/,
  "director camera implementation must persist explicit focus distance");

console.log("director-previs-runtime-contract: atomic Master Set + actor + camera/lens + shot orchestration contract passed");
