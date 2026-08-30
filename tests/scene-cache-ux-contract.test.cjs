const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const main = fs.readFileSync(path.join(root, "electron/main.cjs"), "utf8");
const source = fs.readFileSync(path.join(root, "electron/scene-cache-ux.js"), "utf8");

assert.match(source, /function buildStaticEligibilityIndex\(/,
  "scene cache must index motion sources and group membership once per editor render");
assert.match(source, /const motionSources = new Set\(\)/,
  "static eligibility must use an O(1) motion-source lookup set");
assert.match(source, /const groupedItemIds = new Set\(\)/,
  "static eligibility must use an O(1) manual-group lookup set");
assert.match(source, /eligibilityIndex = buildStaticEligibilityIndex\(renderState\)/,
  "the static eligibility index must be built at the render boundary rather than once per prop");
assert.match(source, /eligibilityIndex\.renderState !== renderState/,
  "eligibility lookup must reject an index built for a different evaluated frame");
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
assert.match(source, /const actorRigRuntime = new WeakMap\(\)/,
  "actor runtime state must be cached without keeping disposed rigs alive");
assert.match(source, /function applyActorJointTransforms\(/,
  "cached actor rigs must update existing joint groups from the evaluated body pose");
assert.match(source, /!object\.isGroup \|\| !object\.userData\?\.jointId/,
  "actor joint updates must reject meshes and target only rig joint groups");
assert.match(source, /runtime\.poseSignature !== poseSignature/,
  "joint transforms must only be reapplied when the actor body pose changes");
assert.match(source, /stats\.actorJointTransformSkips \+= 1/,
  "skipped joint work must be observable for performance validation");
assert.match(source, /runtime\.scaleSignature !== scaleSignature/,
  "actor scale writes must be skipped when physical dimensions are unchanged");
assert.match(source, /runtime\.groundingSignature !== groundingSignature/,
  "expensive actor bounds grounding must only rerun when pose or physical scale changes");
assert.match(source, /new THREE\.Box3\(\)\.setFromObject\(body\)/,
  "grounding recomputation must retain the existing accurate Box3 path when needed");
assert.match(source, /stats\.actorGroundingReuses \+= 1/,
  "reused grounding must be observable for performance validation");
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

const sandbox = {
  console,
  document: { documentElement: { dataset: {} } },
  window: { addEventListener() {} },
  state: {
    aspect: "16:9",
    showNames: true,
    motion: { keyframes: [] },
    groups: [],
    items: [],
  },
  selected: null,
  threeEditMode: "move",
  actorBodyPoseForRender: (actor) => actor?.bodyPose || {},
};
vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: "scene-cache-ux.js" });
const cacheApi = sandbox.window.FrisFrameSceneCacheUxTest;
assert.ok(cacheApi, "scene cache must expose its deterministic cache policy for regression tests");

const eligibilityState = {
  aspect: "16:9",
  motion: {
    keyframes: [
      { id: "k1", source: "moving-prop" },
      { id: "k2", source: "moving-prop" },
      { id: "k3", source: "camera" },
    ],
  },
  groups: [
    { id: "g1", members: [{ itemId: "grouped-prop" }, { itemId: "grouped-actor" }] },
  ],
  items: [],
};
const indexBuildsBefore = cacheApi.stats.staticEligibilityIndexBuilds;
const indexedKeysBefore = cacheApi.stats.staticEligibilityMotionKeysIndexed;
const indexedMembersBefore = cacheApi.stats.staticEligibilityGroupMembersIndexed;
const eligibilityIndex = cacheApi.buildStaticEligibilityIndex(eligibilityState);
assert.equal(cacheApi.stats.staticEligibilityIndexBuilds, indexBuildsBefore + 1,
  "building one render index must be observable for large-scene performance validation");
assert.equal(cacheApi.stats.staticEligibilityMotionKeysIndexed, indexedKeysBefore + 3,
  "one render index must inspect every authored key exactly once");
assert.equal(cacheApi.stats.staticEligibilityGroupMembersIndexed, indexedMembersBefore + 2,
  "one render index must inspect group members exactly once");
assert.equal(eligibilityIndex.motionSources.has("moving-prop"), true,
  "render eligibility index must record moving prop sources");
assert.equal(eligibilityIndex.motionSources.has("static-prop"), false,
  "render eligibility index must not invent motion sources");
assert.equal(eligibilityIndex.groupedItemIds.has("grouped-prop"), true,
  "render eligibility index must record manual group membership");

const staticProp = {
  id: "static-prop",
  type: "prop",
  assetType: "generic",
  visible: true,
};
const movingProp = { ...staticProp, id: "moving-prop" };
const groupedProp = { ...staticProp, id: "grouped-prop" };
assert.equal(cacheApi.staticItemEligible(staticProp, eligibilityState), true,
  "an unselected prop with no motion or group dependency remains cacheable");
assert.equal(cacheApi.staticItemEligible(movingProp, eligibilityState), false,
  "a prop with authored motion must remain dynamic");
assert.equal(cacheApi.staticItemEligible(groupedProp, eligibilityState), false,
  "a manually grouped prop must remain dynamic");

const actor = {
  id: "actor-1",
  type: "actor",
  name: "Actor 1",
  color: "#55c7bb",
  visible: true,
  size: 1,
  scaleX: 1,
  scaleY: 1,
  scaleZ: 1,
  x: 0.25,
  y: 0.4,
  facing: 10,
  pitch: 0,
  verticalOffset: 0,
  mountedHeight: 0,
  bodyPose: { chest: { x: 0, y: 0, z: 0 } },
};
const dynamicVariant = {
  ...actor,
  x: 0.75,
  y: 0.72,
  facing: 190,
  pitch: 14,
  verticalOffset: 0.3,
  mountedHeight: 0.8,
  bodyPose: { chest: { x: 20, y: -15, z: 8 } },
};
assert.equal(
  cacheApi.actorRigSignature(actor, sandbox.state),
  cacheApi.actorRigSignature(dynamicVariant, sandbox.state),
  "position, facing, pitch, elevation and pose changes must stay on the reusable actor-rig path",
);
assert.notEqual(
  cacheApi.actorRigSignature(actor, sandbox.state),
  cacheApi.actorRigSignature({ ...actor, color: "#ff6262" }, sandbox.state),
  "material/color changes must invalidate actor rig geometry/material reuse",
);
assert.notEqual(
  cacheApi.actorRigSignature(actor, sandbox.state),
  cacheApi.actorRigSignature({ ...actor, size: 1.25 }, sandbox.state),
  "actor physical-structure changes must invalidate the cached rig",
);

const translatedActor = { ...actor, x: 0.9, y: 0.1, facing: 270, pitch: -8 };
assert.equal(
  cacheApi.actorPoseTransformSignature(actor),
  cacheApi.actorPoseTransformSignature(translatedActor),
  "plain actor translation/orientation must not trigger joint-pose work",
);
assert.notEqual(
  cacheApi.actorPoseTransformSignature(actor),
  cacheApi.actorPoseTransformSignature(dynamicVariant),
  "authored body-pose changes must refresh existing joint transforms",
);
assert.equal(
  cacheApi.actorScaleSignature({ width: 0.55, height: 1.75, depth: 0.35 }),
  cacheApi.actorScaleSignature({ width: 0.55, height: 1.75, depth: 0.35 }),
  "identical physical dimensions must reuse actor scale and grounding",
);
assert.notEqual(
  cacheApi.actorScaleSignature({ width: 0.55, height: 1.75, depth: 0.35 }),
  cacheApi.actorScaleSignature({ width: 0.62, height: 1.9, depth: 0.4 }),
  "physical dimension changes must invalidate actor scale and grounding cache",
);

assert.equal(cacheApi.actorRigEligible(actor), true,
  "ordinary moving actors must be eligible for rig reuse");
sandbox.selected = { kind: "item", id: actor.id };
sandbox.threeEditMode = "pose";
assert.equal(cacheApi.actorRigEligible(actor), false,
  "the selected actor must bypass rig caching while pose handles are active");
sandbox.threeEditMode = "move";
assert.equal(cacheApi.actorRigEligible(actor), true,
  "the selected actor may reuse its rig again outside pose-edit mode");

assert.ok(packageJson.build.files.includes("electron/scene-cache-ux.js"),
  "desktop package must include the scene cache layer");
assert.match(main, /"scene-cache-ux\.js"[\s\S]*"preview-cache-ux\.js"[\s\S]*"performance-ux\.js"/,
  "scene caching must load before preview caching and render coalescing");

console.log("scene-cache-ux-contract: indexed static props, moving actor rigs, pose and grounding cache contracts passed");
