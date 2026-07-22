const assert = require("node:assert/strict");
const multiCamera = require("../multi-camera-core.js");

const legacyCamera = { x: 0.9, y: 0.5, height: 1.6, focal: 50 };
const legacySetup = { sensorFormat: "full-frame", sensorWidthMm: 36, apertureFStop: 2.8 };
const actorKey = { id: "actor-key", source: "actor-1", time: 1, x: 0.2 };
const cameraKey = { id: "camera-key", source: "camera", time: 1, camera: { x: 0.8 } };

const legacyProfiles = multiCamera.normalizeProfiles(undefined, legacyCamera, [cameraKey], legacySetup);
assert.equal(legacyProfiles.length, 1);
assert.equal(legacyProfiles[0].id, "camera-1");
assert.deepEqual(legacyProfiles[0].camera, legacyCamera);
assert.deepEqual(legacyProfiles[0].cameraSetup, legacySetup);
assert.deepEqual(legacyProfiles[0].keyframes, [cameraKey]);

const documentState = {
  cameras: [
    {
      id: "wide",
      name: "와이드",
      color: "#69c9ff",
      camera: { x: 0.8, focal: 24 },
      cameraSetup: { sensorFormat: "super-35", sensorWidthMm: 24.9, apertureFStop: 4 },
      keyframes: [{ id: "wide-key", source: "camera", time: 0, camera: { x: 0.8 } }],
    },
    {
      id: "close",
      name: "클로즈",
      color: "#a78bfa",
      camera: { x: 0.7, focal: 85 },
      cameraSetup: { sensorFormat: "full-frame", sensorWidthMm: 36, apertureFStop: 1.8 },
      keyframes: [{ id: "close-key", source: "camera", time: 0, camera: { x: 0.7 } }],
    },
  ],
  activeCameraId: "wide",
  camera: { x: 0.8, focal: 24 },
  cameraSetup: { sensorFormat: "super-35", sensorWidthMm: 24.9, apertureFStop: 4 },
  motion: { keyframes: [actorKey, cameraKey], selectedKeyId: "actor-key" },
};

const closeDocument = multiCamera.applyProfile(documentState, "close");
assert.equal(closeDocument.activeCameraId, "close");
assert.deepEqual(closeDocument.camera, documentState.cameras[1].camera);
assert.deepEqual(closeDocument.cameraSetup, documentState.cameras[1].cameraSetup);
assert.deepEqual(closeDocument.motion.keyframes.filter((key) => key.source === "camera"), documentState.cameras[1].keyframes);
assert.deepEqual(closeDocument.motion.keyframes.filter((key) => key.source === "actor-1"), [actorKey]);
assert.equal(closeDocument.motion.selectedKeyId, null);

const merged = multiCamera.mergeCameraKeyframes(
  [{ ...actorKey }, { ...cameraKey, time: 4 }],
  [{ id: "new-camera-key", source: "camera", time: 2 }],
);
assert.deepEqual(merged.map((key) => key.id), ["actor-key", "new-camera-key"]);
assert.equal(merged.find((key) => key.id === "new-camera-key").source, "camera");

const unique = multiCamera.normalizeProfiles([
  { id: "camera", name: "첫 번째" },
  { id: "camera", name: "두 번째" },
], legacyCamera, [], legacySetup);
assert.deepEqual(unique.map((profile) => profile.id), ["camera", "camera-2"]);

console.log("multi-camera-core: migration, profile switching, keyframe isolation, and ids passed");
