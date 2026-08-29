const assert = require("node:assert/strict");

const {
  CAMERA_MOTION_PRESETS,
  applyCameraMotionPreset,
  buildCameraMotionPreset,
  orbitCameraPose,
} = require("../previs-runtime-core.js");

function near(actual, expected, epsilon = 0.000001) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} should be near ${expected}`);
}

const baseCamera = {
  x: 0.5,
  y: 0.5,
  aimX: 0.7,
  aimY: 0.5,
  height: 1.6,
  panDeg: 0,
  tiltDeg: -4,
  focal: 50,
  trackingTargetId: "",
};

assert.deepEqual(
  Object.keys(CAMERA_MOTION_PRESETS),
  ["dolly-in", "dolly-out", "truck-left", "truck-right", "pedestal-up", "pedestal-down", "arc-left", "arc-right", "follow-selected"],
);

const dollyIn = buildCameraMotionPreset({
  presetId: "dolly-in",
  camera: baseCamera,
  stageWidthM: 10,
  stageDepthM: 20,
  amount: 2,
});
near(dollyIn.startPose.x, 0.5);
near(dollyIn.endPose.x, 0.7);
near(dollyIn.endPose.y, 0.5);
near(dollyIn.endPose.aimX, 0.7, 0.000001);
assert.equal(dollyIn.pathMode, "straight");

const dollyOut = buildCameraMotionPreset({
  presetId: "dolly-out",
  camera: baseCamera,
  stageWidthM: 10,
  stageDepthM: 20,
  amount: 2,
});
near(dollyOut.endPose.x, 0.3);

const truckRight = buildCameraMotionPreset({
  presetId: "truck-right",
  camera: baseCamera,
  stageWidthM: 10,
  stageDepthM: 20,
  amount: 2,
});
near(truckRight.endPose.x, 0.5);
near(truckRight.endPose.y, 0.6);
near(truckRight.endPose.aimY, 0.6);

const truckLeft = buildCameraMotionPreset({
  presetId: "truck-left",
  camera: baseCamera,
  stageWidthM: 10,
  stageDepthM: 20,
  amount: 2,
});
near(truckLeft.endPose.y, 0.4);

const pedestalUp = buildCameraMotionPreset({ presetId: "pedestal-up", camera: baseCamera, amount: 1.25 });
near(pedestalUp.endPose.height, 2.85);
const pedestalDown = buildCameraMotionPreset({ presetId: "pedestal-down", camera: baseCamera, amount: 0.5 });
near(pedestalDown.endPose.height, 1.1);

const orbit = orbitCameraPose(baseCamera, 10, 20, 30);
const startRadius = Math.hypot((baseCamera.x - baseCamera.aimX) * 10, (baseCamera.y - baseCamera.aimY) * 20);
const endRadius = Math.hypot((orbit.x - orbit.aimX) * 10, (orbit.y - orbit.aimY) * 20);
near(endRadius, startRadius, 0.00001);
assert.notEqual(orbit.x, baseCamera.x);
assert.notEqual(orbit.y, baseCamera.y);

const arcLeft = buildCameraMotionPreset({
  presetId: "arc-left",
  camera: baseCamera,
  stageWidthM: 10,
  stageDepthM: 20,
  amount: 30,
});
assert.equal(arcLeft.pathMode, "arc-left");
const arcRight = buildCameraMotionPreset({
  presetId: "arc-right",
  camera: baseCamera,
  stageWidthM: 10,
  stageDepthM: 20,
  amount: 30,
});
assert.equal(arcRight.pathMode, "arc-right");
assert.notEqual(arcLeft.endPose.y, arcRight.endPose.y);

const actorStart = { id: "actor-1", type: "actor", x: 0.3, y: 0.4 };
const actorEnd = { ...actorStart, x: 0.42, y: 0.33 };
const follow = buildCameraMotionPreset({
  presetId: "follow-selected",
  camera: baseCamera,
  stageWidthM: 10,
  stageDepthM: 20,
  actorId: actorStart.id,
  actorStartPose: actorStart,
  actorEndPose: actorEnd,
  followPathMode: "free-curve",
});
near(follow.endPose.x - follow.startPose.x, actorEnd.x - actorStart.x);
near(follow.endPose.y - follow.startPose.y, actorEnd.y - actorStart.y);
assert.equal(follow.startPose.trackingTargetId, actorStart.id);
assert.equal(follow.endPose.trackingTargetId, actorStart.id);
assert.equal(follow.pathMode, "free-curve");

const cameraKeys = [];
const actorKeys = [
  { id: "actor-start", source: "actor-1", time: 0, pose: { ...actorStart } },
  { id: "actor-next", source: "actor-1", time: 3, pose: { ...actorEnd }, segment: { mode: "straight" } },
];
let currentCamera = { ...baseCamera };
let commits = 0;
let historyPushes = 0;
let activeSource = "actor-1";
const notices = [];
const fakeTarget = {
  currentInteractionFrame() {
    return {
      camera: { ...currentCamera },
      items: [{ ...actorStart }],
      motion: { playhead: 0 },
    };
  },
  displayPlayhead() { return 0; },
  stageWorldSize() { return { width: 10, depth: 20 }; },
  applySourcePose(sourceId, pose) {
    assert.equal(sourceId, "camera");
    currentCamera = { ...pose };
  },
  createSourceKeyframe(sourceId, time, pathMode) {
    assert.equal(sourceId, "camera");
    const keyframe = {
      id: `camera-${cameraKeys.length + 1}`,
      source: "camera",
      time,
      transition: "linear",
      pose: { ...currentCamera },
      segment: { mode: pathMode },
    };
    cameraKeys.push(keyframe);
    return keyframe;
  },
  keysForSource(sourceId) {
    if (sourceId === "camera") return cameraKeys;
    if (sourceId === "actor-1") return actorKeys;
    return [];
  },
  commit() { commits += 1; },
  pushHistory() { historyPushes += 1; },
  setActiveSource(sourceId) { activeSource = sourceId; },
  selectedSourceId() { return "actor-1"; },
  ensureDurationCovers() {},
  availableKeyTime(time) { return time; },
  applyPathModeToKeyframe(keyframe, pathMode) { keyframe.segment = { mode: pathMode }; },
  selectKeyframe() {},
  notifyApp(message) { notices.push(message); },
};

const applied = applyCameraMotionPreset(fakeTarget, {
  presetId: "follow-selected",
  transition: "smooth",
});
assert.equal(cameraKeys.length, 2, "preset must materialize ordinary start/end camera keys");
assert.equal(actorKeys.length, 2, "camera preset must not create or mutate actor key count");
assert.equal(cameraKeys[0].pose.trackingTargetId, "actor-1");
assert.equal(cameraKeys[1].pose.trackingTargetId, "actor-1");
assert.equal(cameraKeys[1].transition, "smooth");
assert.equal(cameraKeys[1].segment.mode, "straight");
near(cameraKeys[1].pose.x - cameraKeys[0].pose.x, actorEnd.x - actorStart.x);
near(cameraKeys[1].pose.y - cameraKeys[0].pose.y, actorEnd.y - actorStart.y);
near(applied.endTime, 3);
assert.equal(activeSource, "camera");
assert.equal(commits, 1);
assert.equal(historyPushes, 1);
assert.ok(notices.at(-1).includes("Follow Actor"));

console.log("camera-motion-presets: authored camera-key macros passed");
