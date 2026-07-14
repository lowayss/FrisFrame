const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const ids = new Set([...html.matchAll(/\bid=["']([^"']+)["']/g)].map((match) => match[1]));
const selectors = [...app.matchAll(/\$\(\s*["'`]([^"'`]+)["'`]\s*\)/g)].map((match) => match[1]);
const referencedIds = new Set(selectors.flatMap((selector) => (
  [...selector.matchAll(/#([A-Za-z][\w-]*)/g)].map((match) => match[1])
)));
const missingIds = [...referencedIds].filter((id) => !ids.has(id)).sort();

assert.deepEqual(missingIds, [], `app.js references missing HTML ids: ${missingIds.join(", ")}`);

const motionIndex = html.indexOf("./motion-core.js");
const recoveryIndex = html.indexOf("./project-recovery-core.js");
const storyboardIndex = html.indexOf("./storyboard-core.js");
const manualGuideIndex = html.indexOf("./manual-guide-core.js");
const poseIndex = html.indexOf("./pose-core.js");
const appIndex = html.indexOf("./app.js");
assert.ok(motionIndex >= 0 && recoveryIndex > motionIndex && storyboardIndex > recoveryIndex && manualGuideIndex > storyboardIndex && poseIndex > manualGuideIndex && appIndex > poseIndex);
assert.ok(html.includes("./boot-errors.js"));
assert.ok(html.includes("./vendor/three.min.js"));
assert.ok(html.includes("./vendor/lucide.min.js"));
assert.equal(html.includes("cdn.jsdelivr.net"), false);
assert.equal(html.includes("unpkg.com"), false);

assert.ok(html.includes("class=\"manual-example\""), "manual needs a visual walkthrough example");
assert.ok(html.includes("class=\"manual-storage-map\""), "manual needs a project storage comparison");
assert.ok(html.includes("class=\"manual-camera-compare\""), "manual needs a framing comparison");
assert.ok(html.includes("class=\"manual-key-example\""), "manual needs a keyframe timing example");
assert.ok(html.includes("class=\"manual-preview-compare\""), "manual needs a preview workflow comparison");
assert.ok(ids.has("keyInstructionInput"), "timeline needs a per-key storyboard instruction field");
assert.ok(ids.has("actorPoseFields") && ids.has("actorPoseJointSelect") && ids.has("actorPoseKeyBtn"), "3D actors need pose controls and a pose key action");
assert.ok(html.includes('data-three-mode="pose"'), "3D toolbar needs a dedicated pose mode");
assert.ok(app.includes('model.name = "humanoid-rig-v2"'), "3D actors need the articulated mannequin rig");
assert.ok(/,\s*"nose"\);/.test(app), "3D actor face needs a nose mesh");
assert.ok(/,\s*"mouth"\);/.test(app), "3D actor face needs a mouth mesh");
assert.ok(app.includes("function captureActorPoseKeyframe("), "actor poses need timeline keyframe capture");
assert.ok(app.includes("function updateThreePoseDrag("), "3D actors need direct joint dragging");
assert.ok(app.includes("function drawStoryboardNote("), "2D plan needs readable local instructions");
assert.ok(app.includes("function drawPlanPathArrows("), "2D plan needs repeated direction arrows");
assert.equal(app.includes("function drawBlockingGuideLegend("), false, "2D plan should not use a detached technical legend");
assert.equal(ids.has("cameraGuideCanvas"), false, "camera preview should not include a guide overlay canvas");
assert.equal(ids.has("cameraFrameMeta"), false, "camera preview should not include technical metadata");
assert.equal(ids.has("videoExportMode"), false, "video export should only create a clean preview");
assert.ok(ids.has("blockingPlanBtn") && ids.has("blockingPlanPanelBtn"), "2D blocking export needs toolbar and panel actions");
assert.ok(app.includes("function exportBlockingPlanImage("), "2D blocking export needs a preview-first renderer");

assert.equal(html.includes("video-analysis-core.js"), false);
assert.equal(app.includes("referenceVideo"), false);
assert.equal(app.includes("referenceMedia"), false);
assert.equal([...app.matchAll(/\bfetch\(/g)].length, 1, "network requests must use fetchWithTimeout");

console.log("dom-contract: selectors, script order, retired UI, and request guard passed");
