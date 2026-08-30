const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "electron/helper-raycast-ux.js"), "utf8");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const main = fs.readFileSync(path.join(root, "electron/main.cjs"), "utf8");

assert.match(source, /function hasInteractiveMetadata\(/,
  "raycast pruning must preserve objects that participate in editor interaction");
assert.match(source, /data\.editor \|\| data\.poseJoint \|\| data\.gizmoAxis \|\| data\.isMoveHandle/,
  "editor, pose, gizmo, and move-handle metadata must keep raycasting enabled");
assert.match(source, /child\.geometry\?\.type !== "PlaneGeometry"/,
  "the noninteractive stage floor must be removed from exact raycast work");
assert.match(source, /frisframe:cached-motion-paths/,
  "cached visual motion paths must be pruned from raycast traversal");
assert.match(source, /makeStageGrid[\s\S]*pruneVisualGroup/,
  "stage grid geometry must be visual-only for raycasts");
assert.match(source, /makeStageBorder[\s\S]*pruneVisualGroup/,
  "stage border geometry must be visual-only for raycasts");
assert.match(source, /makeThreeItem[\s\S]*pruneIncidentalHelpers/,
  "item bodies must retain editor hits while incidental helpers are pruned");
assert.match(source, /makeThreeCamera[\s\S]*pruneIncidentalHelpers/,
  "camera bodies must retain editor hits while incidental helpers are pruned");

const sandbox = {
  console,
  document: { documentElement: { dataset: {} } },
  window: {},
};
vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: "helper-raycast-ux.js" });
const api = sandbox.window.FrisFrameHelperRaycastUxTest;
assert.ok(api, "helper raycast layer must expose deterministic policy helpers for tests");

const editorParent = { userData: { editor: { kind: "camera" } }, parent: null };
const visualChild = { userData: {}, parent: editorParent };
assert.equal(api.hasInteractiveMetadata(visualChild, null), true,
  "a mesh under an editor-owned camera body must remain raycastable");
const decorativeParent = { userData: {}, parent: null };
const decorativeChild = { userData: {}, parent: decorativeParent };
assert.equal(api.hasInteractiveMetadata(decorativeChild, null), false,
  "purely decorative helpers must be eligible for pruning");

assert.ok(packageJson.build.files.includes("electron/helper-raycast-ux.js"),
  "desktop package must include helper raycast pruning");
assert.match(main, /"camera-path-cache-ux\.js"[\s\S]*"helper-raycast-ux\.js"[\s\S]*"preview-cache-ux\.js"/,
  "helper pruning must load after cached editor geometry exists and before preview/performance wrappers");

console.log("helper-raycast-ux-contract: noninteractive 3D helper pruning contracts passed");
