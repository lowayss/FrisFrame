const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const main = fs.readFileSync(path.join(root, "electron/main.cjs"), "utf8");
const source = fs.readFileSync(path.join(root, "electron/camera-path-cache-ux.js"), "utf8");

assert.match(source, /function motionPathSignature\(/,
  "3D motion paths must have an explicit deterministic cache signature");
assert.match(source, /renderState\.motion\?\.keyframes \|\| \[\]/,
  "motion path cache identity must be driven by authored keyframes");
assert.doesNotMatch(source, /motionPathSignature[\s\S]{0,500}playhead/,
  "playhead-only changes must not invalidate expensive 3D motion path geometry");
assert.match(source, /new window\.THREE\.Group\(\)/,
  "path meshes and key markers must be collected into one reusable Three.js group");
assert.match(source, /originalDrawThreeMotionPaths\(renderState, group\)/,
  "the existing path renderer must remain the source of truth for cached path geometry");
assert.match(source, /function cameraRigSignature\(/,
  "camera rigs must have an explicit cache identity");
assert.match(source, /stats\.cameraRigReuses \+= 1/,
  "camera rig reuse must be observable for performance validation");
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
    motion: { playhead: 0, keyframes: [
      { id: "k1", source: "camera", time: 0, pose: { x: 0.2, y: 0.3 } },
      { id: "k2", source: "camera", time: 2, pose: { x: 0.7, y: 0.6 } },
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
assert.equal(
  api.cameraRigSignature(camera, sandbox.state, profile, true, { x: 0, y: 0 }),
  api.cameraRigSignature({ ...camera }, sandbox.state, { ...profile }, true, { x: 0, y: 0 }),
  "unchanged camera state must reuse the complete rig including its FOV cone",
);
assert.notEqual(
  api.cameraRigSignature(camera, sandbox.state, profile, true, { x: 0, y: 0 }),
  api.cameraRigSignature({ ...camera, panDeg: 40 }, sandbox.state, profile, true, { x: 0, y: 0 }),
  "camera pose changes must invalidate an exact camera rig cache rather than showing stale helpers",
);

assert.ok(packageJson.build.files.includes("electron/camera-path-cache-ux.js"),
  "desktop package must include the camera/path cache layer");
assert.match(main, /"scene-cache-ux\.js"[\s\S]*"camera-path-cache-ux\.js"[\s\S]*"preview-cache-ux\.js"[\s\S]*"performance-ux\.js"/,
  "camera/path caching must load after scene caching and before preview/render coalescing");

console.log("camera-path-cache-ux-contract: camera rig and 3D motion path cache contracts passed");
