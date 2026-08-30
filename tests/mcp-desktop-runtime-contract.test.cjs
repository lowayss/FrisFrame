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
assert.match(verify, /method: "initialize"/,
  "packaged MCP verification must perform an MCP initialize handshake");
assert.match(verify, /method: "tools\/list"/,
  "packaged MCP verification must request the real tool manifest");
assert.match(verify, /name: "list_projects"/,
  "packaged MCP verification must execute a DB-backed MCP tool call");
assert.match(verify, /"apply_previs_plan"/,
  "packaged MCP verification must require the atomic previs-plan tool in the bundled manifest");
assert.match(verify, /PREVIS_DB_PATH: database/,
  "MCP package protocol tests must use an isolated temporary database");
assert.match(verify, /fs\.existsSync\(database\)/,
  "packaged MCP verification must confirm the SQLite database was really initialized");

console.log("mcp-desktop-runtime-contract: packaged stdio MCP protocol and runtime contracts passed");
