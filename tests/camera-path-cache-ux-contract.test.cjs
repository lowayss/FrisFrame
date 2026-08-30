const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const main = fs.readFileSync(path.join(root, "electron/main.cjs"), "utf8");
const source = fs.readFileSync(path.join(root, "electron/camera-path-cache-ux.js"), "utf8");

assert.match(source, /function motionPathSourceSignature\(/,
  "3D motion path cache must track source identity, color and visibility without tracking live transforms");
assert.match(source, /function motionPathSignature\(/,
  "3D motion paths must have an explicit deterministic cache signature");
assert.match(source, /renderState\.motion\?\.keyframes \|\| \[\]/,
  "motion path cache identity must be driven by authored keyframes");
assert.doesNotMatch(source, /motionPathSourceSignature[\s\S]{0,500}\.x/,
  "source style identity must not include live X positions that change during playback");
assert.doesNotMatch(source, /motionPathSourceSignature[\s\S]{0,500}\.y/,
  "source style identity must not include live Y positions that change during playback");
assert.match(source, /item\.color \|\| ""/,
  "source color changes must invalidate colored 3D path geometry");
assert.match(source, /item\.visible !== false/,
  "source visibility changes must invalidate the visible path set");
assert.match(source, /new window\.THREE\.Group\(\)/,
  "path meshes and key markers must be collected into one reusable Three.js group");
assert.match(source, /originalDrawThreeMotionPaths\(renderState, group\)/,
  "the existing path renderer must remain the source of truth for cached path geometry");
assert.match(source, /function cameraRigStructureSignature\(/,
  "camera rigs must separate structural cache identity from live pose values");
assert.match(source, /function syncCameraRig\(/,
  "moving cameras must update an existing camera rig rather than rebuilding it");
assert.match(source, /function syncCameraCone\(/,
  "FOV cone geometry must be updated in place for moving or zooming cameras");
assert.match(source, /if \(!face\.geometry\.index\) face\.geometry\.setIndex\(\[0, 1, 2\]\)/,
  "the constant FOV triangle index must not be rewritten on every camera update");
assert.match(source, /setLinePoints\(parts\.supportLines\[0\]/,
  "tripod support lines must be updated in place");
assert.match(source, /parts\.body\.position\.copy\(camPos\)/,
  "camera body transform must follow the evaluated camera pose");
assert.match(source, /parts\.aimArrow\.setDirection\(aimDirection\)/,
  "camera aim helper must follow live orientation");
assert.match(source, /stats\.cameraRigReuses \+= 1/,
  "camera rig reuse must be observable for performance validation");
assert.match(source, /stats\.cameraRigTransformUpdates \+= 1/,
  "camera transform-only updates must be observable for performance validation");
assert.match(source, /threeView\.world\.remove\(pathCache\.group\)/,
  "cached motion paths must be detached before normal world disposal");
assert.match(source, /threeView\.world\.remove\(entry\.group\)/,
  "cached camera rigs must be detached before normal world disposal");
assert.match(source, /previewRenderDepth/,
  "editor camera/path caches must remain isolated from camera preview rendering");

const sandbox = {
  console,
  document: { documentElement: { dataset: {} } },
  window: { addEventListener() {} },
  state: {
    aspect: "16:9",
    activeCameraId: "camera-1",
    cameraSetup: { sensorWidthMm: 36 },
    cameras: [{ id: "camera-1", color: "#69c9ff" }],
    items: [{ id: "actor-1", type: "actor", color: "#55c7bb", visible: true, x: 0.25, y: 0.4 }],
    motion: { playhead: 0, keyframes: [
      { id: "k1", source: "camera", time: 0, pose: { x: 0.2, y: 0.3 } },
      { id: "k2", source: "camera", time: 2, pose: { x: 0.7, y: 0.6 } },
      { id: "a1", source: "actor-1", time: 0, pose: { x: 0.25, y: 0.4 } },
      { id: "a2", source: "actor-1", time: 2, pose: { x: 0.72, y: 0.4 } },
    ] },
    groups: [],
  },
  selected: null,
  activeSourceId: () => "camera",
  selectedKeyIdForRender: () => "",
};
vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: "camera-path-cache-ux.js" });
const api = sandbox.window.FrisFrameCameraPathCacheUxTest;
assert.ok(api, "camera/path cache must expose deterministic cache policy for regression tests");

const laterPlayhead = {
  ...sandbox.state,
  motion: { ...sandbox.state.motion, playhead: 1.5 },
};
assert.equal(
  api.motionPathSignature(sandbox.state),
  api.motionPathSignature(laterPlayhead),
  "ordinary playback must reuse identical authored 3D path geometry",
);
const movedLiveSource = {
  ...sandbox.state,
  items: sandbox.state.items.map((item) => ({ ...item, x: 0.8, y: 0.75 })),
};
assert.equal(
  api.motionPathSignature(sandbox.state),
  api.motionPathSignature(movedLiveSource),
  "evaluated source movement must not rebuild an authored 3D path",
);
const recoloredSource = {
  ...sandbox.state,
  items: sandbox.state.items.map((item) => ({ ...item, color: "#ff6262" })),
};
assert.notEqual(
  api.motionPathSignature(sandbox.state),
  api.motionPathSignature(recoloredSource),
  "source color changes must rebuild path materials and key markers",
);
const hiddenSource = {
  ...sandbox.state,
  items: sandbox.state.items.map((item) => ({ ...item, visible: false })),
};
assert.notEqual(
  api.motionPathSignature(sandbox.state),
  api.motionPathSignature(hiddenSource),
  "source visibility changes must rebuild the visible path set",
);
const changedKeys = {
  ...sandbox.state,
  motion: {
    ...sandbox.state.motion,
    keyframes: sandbox.state.motion.keyframes.map((key, index) => index === 1
      ? { ...key, pose: { x: 0.8, y: 0.6 } }
      : key),
  },
};
assert.notEqual(
  api.motionPathSignature(sandbox.state),
  api.motionPathSignature(changedKeys),
  "editing an authored key must invalidate the 3D path cache",
);

const profile = { id: "camera-1", name: "A CAM", color: "#69c9ff" };
const camera = { x: 0.2, y: 0.3, height: 1.6, panDeg: 25, tiltDeg: 0, focal: 35 };
assert.notEqual(
  api.cameraRigSignature(camera, sandbox.state, profile, true, { x: 0, y: 0 }),
  api.cameraRigSignature({ ...camera, panDeg: 40, focal: 85 }, sandbox.state, profile, true, { x: 0, y: 0 }),
  "exact camera diagnostics must still detect live pose and lens changes",
);
assert.equal(
  api.cameraRigStructureSignature(sandbox.state, profile, true),
  api.cameraRigStructureSignature({ ...sandbox.state, cameraSetup: { sensorWidthMm: 24 } }, profile, true),
  "lens/sensor changes must stay on the transform/FOV update path instead of rebuilding the camera body",
);
assert.notEqual(
  api.cameraRigStructureSignature(sandbox.state, profile, true),
  api.cameraRigStructureSignature(sandbox.state, { ...profile, color: "#ff5f57" }, true),
  "profile material changes must rebuild the camera rig structure",
);
assert.notEqual(
  api.cameraRigStructureSignature(sandbox.state, profile, true),
  api.cameraRigStructureSignature(sandbox.state, profile, false),
  "active/selection helper structure changes must rebuild the appropriate rig shell",
);

assert.ok(packageJson.build.files.includes("electron/camera-path-cache-ux.js"),
  "desktop package must include the camera/path cache layer");
assert.match(main, /"scene-cache-ux\.js"[\s\S]*"camera-path-cache-ux\.js"[\s\S]*"preview-cache-ux\.js"[\s\S]*"performance-ux\.js"/,
  "camera/path caching must load after scene caching and before preview/render coalescing");

console.log("camera-path-cache-ux-contract: moving camera rig, FOV cone, source-style and 3D motion path cache contracts passed");
