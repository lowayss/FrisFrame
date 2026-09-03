const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const ux = fs.readFileSync(path.join(root, "electron", "phone-motion-camera-ux.js"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const mcp = fs.readFileSync(path.join(root, "mcp_previs_server.py"), "utf8");

test("Physical Camera persists successful take context in the same Camera Operator commit", () => {
  assert.match(ux, /function finalizeTakeContextBeforeCommit\(\)/);
  assert.match(ux, /cameraOperatorTakes/);
  assert.match(ux, /latestCameraOperatorTakeId/);
  assert.match(ux, /TAKE_HISTORY_LIMIT = 20/);
  assert.match(ux, /finalizeTakeContextBeforeCommit\(\);\s*\n\s*return originalCommit/);
  assert.match(ux, /commit = wrappedCommit/);
  assert.match(ux, /if \(activeTake && operator\(\)\?\.mode === "idle"\) activeTake = null/);
});

test("take context records tracking semantics needed by downstream generation", () => {
  assert.match(ux, /source:"physical-camera"/);
  assert.match(ux, /stabilization:activeTake\.stabilization/);
  assert.match(ux, /heldTranslationSamples/);
  assert.match(ux, /metricSamples/);
  assert.match(ux, /visualSamples/);
  assert.match(ux, /confidence:\{/);
  assert.match(ux, /units:allMetric \? "meters-local-space" : "relative-virtual-travel"/);
  assert.match(ux, /promptSeed/);
  assert.match(ux, /finalPromptOwner:"mcp-client"/);
});

test("non-metric and mixed tracking cannot claim exact travel distance", () => {
  assert.match(ux, /mixed WebXR \/ Visual Flow non-metric tracking/);
  assert.match(ux, /Visual Flow non-metric tracking/);
  assert.match(ux, /metricDistanceAllowed:allMetric/);
  assert.match(ux, /do not infer or state an exact physical travel distance/);
  assert.match(ux, /WebXR values are measured local-space displacement relative to the recentered take origin/);
});

test("project normalization does not retire the new take-context fields", () => {
  assert.doesNotMatch(app, /delete state\.motion\.cameraOperatorTakes/);
  assert.doesNotMatch(app, /delete state\.motion\.latestCameraOperatorTakeId/);
  assert.match(app, /state\.motion = state\.motion \|\| \{\}/);
});

test("existing MCP get_project remains the deterministic handoff for final prompt composition", () => {
  assert.match(mcp, /"name": "get_project"/);
  assert.match(mcp, /프로젝트 전체 상태와 revision을 읽습니다/);
  assert.match(mcp, /final Seedance prompt composition remain outside the app in the MCP conversation/);
  assert.match(mcp, /if name == "get_project":\s*\n\s*return core\.handle_get_project/);
});
