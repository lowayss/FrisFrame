const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "electron", "workspace-ux.js"), "utf8");

assert.ok(source.includes('[["setup", "구성"], ["motion", "움직임"]]'),
  "the desktop shell must expose setup and motion as the two previs work phases");
assert.ok(source.includes('storyboardLabel.textContent = "스토리"'),
  "storyboard must remain a distinct planning entry instead of being mixed with stage views");
assert.ok(source.includes('viewDock.append(viewButtons)'),
  "2D/3D must live with the stage instead of competing with workflow phases in the top navigation");
assert.ok(source.includes('html[data-frisframe-workflow-phase="setup"] .timeline.panel'),
  "setup phase must be able to remove the timeline from the primary workspace");
assert.ok(source.includes('workflowPhase = safeStorage.get("frisframe.ui.workflowPhase")'),
  "the chosen workflow phase must persist as a UI preference");

assert.ok(source.includes('exportSummaryLabel.textContent = "프리비즈 출력"'),
  "export must read as one primary previs action");
assert.ok(source.includes('videoLabel.textContent = "프리비즈 MP4 만들기"'),
  "MP4 must be the primary export choice");
assert.ok(source.includes('exportPopover.prepend(videoBtn)'),
  "MP4 must appear before secondary frame exports");
assert.ok(source.includes('출력 구간 · 고급 설정'),
  "export range controls must be progressively disclosed");
assert.ok(source.includes('백업 · 공유'),
  "backup and sharing utilities must be grouped away from everyday project actions");

for (const requiredId of [
  "storyboardBtn",
  "viewButtons",
  "videoBtn",
  "frameBtn",
  "framePairBtn",
  "exportRangeTools",
  "projectMenu",
  "backupBtn",
  "importBtn",
  "shareBtn",
  "propertiesPanel",
]) {
  assert.ok(source.includes(`getElementById("${requiredId}")`),
    `workflow simplification must preserve the existing ${requiredId} contract`);
}

assert.ok(source.includes('rememberDisclosure(actorPanel, "frisframe.ui.actorPanel", false)'),
  "actor details should default closed to reduce left-rail density");
assert.ok(source.includes('rememberDisclosure(propPanel, "frisframe.ui.propPanel", false)'),
  "prop details should default closed to reduce left-rail density");
assert.ok(source.includes('rememberDisclosure(cameraPanel, "frisframe.ui.cameraPanel", true)'),
  "camera controls should remain immediately available in normal shot setup");

console.log("workflow-shell-ux-contract: simplified phases, local stage views, progressive export, existing IDs preserved");
