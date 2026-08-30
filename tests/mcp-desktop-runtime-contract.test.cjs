const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const entry = fs.readFileSync(path.join(root, "mcp_desktop_entry.py"), "utf8");
const build = fs.readFileSync(path.join(root, "electron/scripts/build-python-runtime.cjs"), "utf8");
const stage = fs.readFileSync(path.join(root, "electron/scripts/stage-runtime.cjs"), "utf8");
const verify = fs.readFileSync(path.join(root, "electron/scripts/verify-package.cjs"), "utf8");

assert.match(entry, /PREVIS_DB_PATH/,
  "packaged MCP must bind to the same managed-project database contract as the desktop app");
assert.match(entry, /Library" \/ "Application Support" \/ "FrisFrame"/,
  "packaged MCP must resolve the macOS Electron userData location");
assert.match(entry, /"APPDATA", "LOCALAPPDATA"/,
  "packaged MCP must resolve Windows Electron userData locations");
assert.match(entry, /def configure_stdio_utf8\(\)/,
  "packaged MCP entrypoint must explicitly configure stdio for UTF-8 JSON-RPC");
assert.match(entry, /reconfigure\(encoding="utf-8", errors="strict"\)/,
  "packaged MCP stdio must not depend on the Windows system code page for Korean tool metadata or project content");
assert.match(entry, /configure_stdio_utf8\(\)[\s\S]*import reference_space_mcp[\s\S]*import reference_space_consistency_mcp[\s\S]*import reference_space_plan_mcp[\s\S]*from mcp_previs_server import main as run_mcp/,
  "UTF-8 setup must run before all Reference Space extensions and deterministic MCP server start");
assert.match(entry, /import reference_space_mcp/,
  "packaged MCP entrypoint must statically import the Reference Space extension so PyInstaller bundles it");
assert.match(entry, /import reference_space_consistency_mcp/,
  "packaged MCP entrypoint must statically import the multi-anchor consistency extension so PyInstaller bundles it");
assert.match(entry, /import reference_space_plan_mcp/,
  "packaged MCP entrypoint must statically import the atomic Reference Space plan extension so PyInstaller bundles it");
assert.match(entry, /from mcp_previs_server import main as run_mcp/,
  "desktop entrypoint must run the deterministic previs MCP server rather than a separate implementation");
assert.match(build, /name: "frisframe-mcp"/,
  "desktop preparation must create a dedicated stdio MCP executable");
assert.match(build, /entrypoint: "mcp_desktop_entry\.py"/,
  "the packaged MCP executable must use the desktop database resolver entrypoint");
assert.match(build, /mcpExecutable: "frisframe-mcp"/,
  "macOS runtime config must name the packaged MCP executable");
assert.match(build, /mcpExecutable: "frisframe-mcp\.exe"/,
  "Windows runtime config must name the packaged MCP executable");
assert.match(stage, /sourceMcp[\s\S]*stagedMcp[\s\S]*fs\.cpSync\(sourceMcp, stagedMcp/,
  "runtime staging must copy the MCP bundle into Electron extraResources");
assert.match(verify, /path\.join\(resources, "mcp", "frisframe-mcp\.exe"\)/,
  "Windows release verification must require the packaged MCP executable");
assert.match(verify, /path\.join\(resources, "mcp", "frisframe-mcp"\)/,
  "macOS release verification must require the packaged MCP executable");
assert.match(verify, /verifyMcpExecutable\(mcpExecutable\)/,
  "release verification must exercise the packaged MCP process");
assert.match(verify, /function runMcpRequest\(executable, database, request\)/,
  "package verification must isolate one stdio JSON-RPC request per process for Windows-safe EOF handling");
assert.ok((verify.match(/runMcpRequest\(executable, database, \{/g) || []).length >= 5,
  "package verification must independently exercise initialization, discovery, DB access, calibration, and anchor consistency");
assert.match(verify, /input: `\$\{JSON\.stringify\(request\)\}\\n`/,
  "each packaged MCP verification process must receive exactly one newline-delimited request");
assert.match(verify, /method: "initialize"/,
  "packaged MCP verification must perform an MCP initialize handshake");
assert.match(verify, /method: "tools\/list"/,
  "packaged MCP verification must request the real tool manifest");
assert.match(verify, /name: "list_projects"/,
  "packaged MCP verification must execute a DB-backed MCP tool call");
assert.match(verify, /"apply_previs_plan"/,
  "packaged MCP verification must require the atomic previs-plan tool in the bundled manifest");
assert.match(verify, /"calibrate_reference_camera"/,
  "packaged MCP verification must require Reference Space camera calibration");
assert.match(verify, /"apply_reference_camera_calibration"/,
  "packaged MCP verification must require safe calibrated camera application");
assert.match(verify, /"apply_reference_mass_blocks"/,
  "packaged MCP verification must require meter-based Reference Space mass blocking");
assert.match(verify, /"check_reference_anchor_consistency"/,
  "packaged MCP verification must require multi-anchor perspective consistency checks");
assert.match(verify, /"apply_reference_space_plan"/,
  "packaged MCP verification must require atomic full Reference Space application");
assert.match(verify, /"validate_reference_space"/,
  "packaged MCP verification must require Reference Space validation");
assert.match(verify, /PREVIS_DB_PATH: database/,
  "MCP package protocol tests must use an isolated temporary database");
assert.match(verify, /fs\.existsSync\(database\)/,
  "packaged MCP verification must confirm the SQLite database was really initialized");

console.log("mcp-desktop-runtime-contract: packaged UTF-8 stdio MCP + Reference Space runtime contracts passed");
