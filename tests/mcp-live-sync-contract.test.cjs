const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");

assert.match(
  appSource,
  /async function pollManagedProjectCommands\(\)\s*\{/,
  "the editor must keep an explicit managed-project polling path for external MCP writes",
);

assert.ok(
  appSource.includes("if (!managedProjectId || managedSyncInFlight || managedSaveInFlight || managedSaveConflict) return;"),
  "live sync must not overlap saves, duplicate polls, or an unresolved conflict",
);

assert.ok(
  appSource.includes("fetchWithTimeout(`/api/projects/load?id=${encodeURIComponent(managedProjectId)}`, {}, 8000)"),
  "live sync must reload the same managed project from the local project API",
);

assert.ok(
  appSource.includes("if (!remoteRevision || remoteRevision <= Number(managedProjectRevision || 0)) return;"),
  "live sync must only apply a strictly newer external revision",
);

const unsavedGuard = appSource.indexOf("if (hasUnsavedProjectChanges()) {");
const conflictFlag = appSource.indexOf("managedSaveConflict = true;", unsavedGuard);
const externalMcpNotice = appSource.indexOf("외부 MCP 명령이 도착했지만 저장되지 않은 편집이 있어 반영을 멈췄습니다.", unsavedGuard);
const remoteLoad = appSource.indexOf("loadProjectDocument(projectFromPayload(payload.document));", unsavedGuard);
assert.ok(unsavedGuard >= 0, "live sync must check for unsaved local edits");
assert.ok(conflictFlag > unsavedGuard, "unsaved local edits must enter the managed-project conflict state");
assert.ok(externalMcpNotice > conflictFlag, "the user must be told why an external MCP revision was not applied");
assert.ok(remoteLoad > externalMcpNotice, "remote project replacement must occur only after the unsaved-edit conflict guard");

assert.ok(
  appSource.includes("managedProjectRevision = remoteRevision;"),
  "after accepting an MCP edit the editor must advance to the remote revision",
);
assert.ok(
  appSource.includes("managedProjectUpdatedAt = payload.storage.updatedAt || \"\";"),
  "after accepting an MCP edit the editor must retain the remote update timestamp",
);
assert.ok(
  appSource.includes("managedSaveConflict = false;"),
  "a successful remote reload must leave the managed project out of conflict state",
);

const syncTimerMatch = appSource.match(/managedSyncTimer\s*=\s*setInterval\(\(\)\s*=>\s*pollManagedProjectCommands\(\),\s*(\d+)\s*\)/);
assert.ok(syncTimerMatch, "managed-project live sync must be scheduled continuously");
const syncIntervalMs = Number(syncTimerMatch[1]);
assert.ok(syncIntervalMs >= 500 && syncIntervalMs <= 5000,
  `managed-project live sync cadence is outside the interactive range: ${syncIntervalMs}ms`);

assert.ok(
  /\bstartManagedProjectSync\(\);/.test(appSource),
  "application initialization must start managed-project live sync",
);

console.log(`mcp-live-sync-contract: external revisions protected and polled every ${syncIntervalMs}ms`);
