const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const main = fs.readFileSync(path.join(root, "electron/main.cjs"), "utf8");
const source = fs.readFileSync(path.join(root, "electron/scene-cache-ux.js"), "utf8");

assert.match(source, /function staticItemEligible\(/,
  "scene cache must explicitly define which props are safe to reuse as static scene objects");
assert.match(source, /item\.type !== "prop"/,
  "the static prop path must remain limited to props");
assert.match(source, /sourceHasMotion\(item\.id, renderState\)/,
  "props with authored motion must never be reused as static scene objects");
assert.match(source, /itemInManualGroup\(item\.id, renderState\)/,
  "grouped props must remain dynamic because their resolved pose can depend on a leader");
assert.match(source, /function actorRigEligible\(/,
  "moving actors must have an explicit reusable-rig eligibility contract");
assert.match(source, /threeEditMode === "pose"[\s\S]*selected\?\.kind === "item"/,
  "the selected actor must leave the reusable-rig path while pose handles are being edited");
assert.match(source, /delete structural\.x;[\s\S]*delete structural\.bodyPose;/,
  "actor position, orientation and body pose must be treated as transform-only changes rather than rig rebuilds");
assert.match(source, /function applyActorJointTransforms\(/,
  "cached actor rigs must update existing joint groups from the evaluated body pose");
assert.match(source, /!object\.isGroup \|\| !object\.userData\?\.jointId/,
  "actor joint updates must reject meshes and target only rig joint groups");
assert.match(source, /body\.scale\.set\(/,
  "cached actor rigs must refresh physical actor scale without recreating geometry");
assert.match(source, /body\.rotation\.set\(pitch, Math\.PI \/ 2 - angle, 0, "YXZ"\)/,
  "cached actor rigs must refresh actor pitch and facing");
assert.match(source, /group\.position\.set\(position\.x, position\.y, position\.z\)/,
  "cached actor rigs must refresh evaluated stage position");
assert.match(source, /arrow\.setDirection\(direction\)/,
  "cached actor rigs must keep the 3D direction helper synchronized with facing");
assert.match(source, /threeView\.world\.remove\(entry\.group\)/,
  "reusable scene objects must be detached before the normal world clear disposes dynamic content");
assert.match(source, /stats\.actorRigReuses \+= 1/,
  "actor reuse must be observable for performance validation");
assert.match(source, /previewRenderDepth/,
  "editor-world caching must be isolated from the separate camera-preview scene graph");

assert.ok(packageJson.build.files.includes("electron/scene-cache-ux.js"),
  "desktop package must include the scene cache layer");
assert.match(main, /"scene-cache-ux\.js"[\s\S]*"preview-cache-ux\.js"[\s\S]*"performance-ux\.js"/,
  "scene caching must load before preview caching and render coalescing");

console.log("scene-cache-ux-contract: static prop cache and moving actor-rig reuse contracts passed");
