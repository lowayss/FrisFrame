"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const controllerPath = path.join(root, "electron", "camera-operator-live-ux.js");
const controller = fs.readFileSync(controllerPath, "utf8");
const splineCore = require(controllerPath);
const main = fs.readFileSync(path.join(root, "electron", "main.cjs"), "utf8");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

assert.match(controller, /originalButton\.cloneNode\(true\)/, "live controller must detach the original Camera Operator button listeners");
assert.match(controller, /originalSurface\.cloneNode\(true\)/, "live controller must detach the original Camera Operator surface listeners");
assert.match(controller, /state\.motion\.playhead = time;/, "REC must advance the authored timeline playhead in real time");
assert.match(controller, /updatePlayheadDisplay\(time\)/, "REC must visibly move the timeline playhead every frame");
assert.match(controller, /interpolateStateAtTime\(time\)/, "REC must evaluate actor and prop motion at the live timeline time");
assert.match(controller, /applyCameraPose\(livePose, renderState\)/, "live operator camera must override only the evaluated camera pose");
assert.match(controller, /surface\.hidden = false;/, "the preview surface must remain draggable before STBY");
assert.match(controller, /if \(mode === "idle" && event\.button === 0\) \{[\s\S]*armOperator\(\);[\s\S]*beginRecording\(event\);/, "a direct left-drag on the camera preview must start a take without a separate STBY click");
assert.match(controller, /const pointerToken = \(event\) => event\?\.pointerId == null \? "mouse" : event\.pointerId;/, "mouse input without an explicit pointer id must still be trackable");
assert.match(controller, /const isActivePointer = \(event\) => \([\s\S]*pointerId === "mouse"/, "live drag must accept the active mouse pointer consistently");
assert.match(controller, /if \(event && !isActivePointer\(event\)\) return;/, "runtime reset must release the pointer even when no event is supplied");
assert.match(controller, /const canStartAtRequestedTime = requestedTime < maxTimelineTime\(\) - 0\.0005;/, "recording at the timeline endpoint must fall back to the first camera key");
assert.match(controller, /cameraFrame\.addEventListener\("pointerdown", beginCameraFramePointerControl, true\)/, "camera frame parent must catch preview pointerdown when the overlay misses it");
assert.match(controller, /cameraFrame\.addEventListener\("mousedown", beginMouseFallback, true\)/, "native mouse down must start recording when pointer events are unavailable");
assert.match(controller, /window\.addEventListener\("mousemove", applyMouseFallback, true\)/, "native mouse drag must continue outside the preview overlay");
assert.match(controller, /const beginWorldCameraRecording = \(event\) => \{[\s\S]*pickThreeEditor\(event\)[\s\S]*beginRecording\(event, "world"\)/, "STBY camera-rig drag must enter the live recording state");
assert.match(controller, /threeCanvas\?\.addEventListener\("pointerdown", beginWorldCameraRecording, true\)/, "3D camera rig pointerdown must be captured before normal stage editing");
assert.match(controller, /recordInput !== "preview"/, "world camera recording must not reinterpret 3D rig movement as pan/tilt preview drag");
assert.match(controller, /: Math\.max\(cleanupStrength, 0\.16\)/, "mouse-driven takes must retain a baseline stabilization pass");
assert.match(controller, /resampleStep = phoneTake \? 1 \/ 30 : 1 \/ 15/, "physical takes must preserve a denser editable sample clock than mouse takes");
assert.match(controller, /const recordPhysicalPose = \(pose\) =>/, "Physical Camera must record stabilized packets on their real arrival timing");
assert.match(controller, /time - lastSampleTime >= 1 \/ 90/, "Physical Camera packet capture must retain display-class motion without duplicate bursts");
assert.match(controller, /time - lastSampleTime >= 0\.10/, "Physical Camera must write hold samples when packet flow briefly pauses");
assert.match(controller, /positionTolerance: 0\.00055/, "Physical Camera key reduction must retain small intentional position moves");
assert.match(controller, /angleTolerance: 0\.07/, "Physical Camera key reduction must retain fine pan and tilt changes");
assert.match(controller, /maxGap: 0\.22 \+ cleanupStrength \* 0\.10/, "Physical Camera must not leave long gaps between editable keys");
assert.match(controller, /preserveNaturalMotion: true/, "Physical Camera must preserve human timing anchors while reducing keys");
assert.match(controller, /recordPhysicalPose,/, "Physical Camera runtime must expose its packet-timed recorder");
assert.match(controller, /startPhysical: startPhysicalRecording/, "Physical Camera must enter a dedicated recording path instead of masquerading as mouse input");
assert.match(controller, /adoptStartPose/, "Physical Camera must rewrite the take start key to the adopted LIVE phone pose");
assert.match(controller, /exactKey \|\| \(ensureStartKey \? null : \[\.\.\.cameraKeys\]/, "Physical Camera must start at the current playhead instead of jumping to an older camera key");
assert.match(controller, /maxGap: 0\.42 \+ cleanupStrength \* 0\.18/, "camera take key reduction must leave enough time between operator spline keys");
assert.match(controller, /keyframe\.operatorContinuity = true;/, "recorded camera keys must opt into continuous pose interpolation");
assert.match(controller, /interpolateCameraOperatorPose = interpolateOperatorVectorPose;/, "Camera Operator must replace scalar PCHIP playback with its vector spline policy");
assert.match(controller, /vectorSpline: true/, "runtime must expose that vector spline playback is active");
assert.doesNotMatch(controller, /Camera Operator는 트래킹을 해제한 자유 카메라에서 사용하세요/, "Camera Operator must allow a tracked camera take");
assert.match(controller, /트래킹 방향 유지/, "tracked Camera Operator takes must communicate the direction lock");
assert.match(controller, /maintainCameraTracking/, "tracked Camera Operator poses must preserve target orientation");
assert.match(controller, /dollyMeters/, "tracked mouse drags must move camera distance instead of changing pan\/tilt");
assert.match(controller, /firstKey\.pose = \{ \.\.\.firstKey\.pose, trackingTargetId:/, "a tracked take must persist its target on the first camera key");
assert.match(controller, /trackingFrame = interpolateStateAtTime\(Number\(time\)\)/, "tracked takes must evaluate animated target positions at the live playhead");
assert.match(controller, /maintainTracking: maintainCameraTracking/, "input devices must share the tracking-aware camera operator runtime");
const liveRenderFrame = controller.match(/const renderLiveFrame = \(time\) => \{[\s\S]*?\n  \};/)?.[0] || "";
assert.match(liveRenderFrame, /draw\(renderState\)/, "the live evaluated scene must be drawn during REC");
assert.doesNotMatch(liveRenderFrame, /renderThreeView\(renderState, true\)/, "the live frame must not render the 3D scene twice");
assert.match(controller, /if \(dirty\) \{[\s\S]*renderLiveFrame\(time\);[\s\S]*updatePlayheadDisplay\(time\);/, "REC must avoid rebuilding the 3D world when the camera is idle");
assert.match(controller, /dirty = true;/, "camera input must mark the live frame dirty for the next coalesced render");
assert.match(controller, /surface\.addEventListener\("pointerup"[\s\S]*releasePointerControl\(event\);[\s\S]*?\}\);/, "releasing the mouse must release control without ending the take");
assert.doesNotMatch(
  controller.match(/surface\.addEventListener\("pointerup"[\s\S]*?\n  \}\);/)?.[0] || "",
  /finishOperatorTake\(/,
  "pointerup must not stop Camera Operator recording",
);
assert.match(controller, /else finishOperatorTake\(\);/, "the Camera Operator button must explicitly stop and commit an active take");
assert.match(controller, /liveTimeline: true/, "runtime must expose that the live timeline controller is active");

assert.equal(typeof splineCore.interpolatePose, "function", "vector spline core must expose camera pose interpolation for numeric regression tests");
const pose = (x, y, panDeg = 0) => ({ x, y, height: 1.6, panDeg, tiltDeg: 0, focal: 35 });
const p0 = pose(0.70, 0.15, 170);
const p1 = pose(0.82, 0.38, 176);
const p2 = pose(0.86, 0.68, 183);
const p3 = pose(0.84, 0.94, 190);
const p4 = pose(0.76, 1.12, 197);
const leftContinuity = {
  previous: p0,
  next: p3,
  previousTime: 0,
  startTime: 1,
  endTime: 2,
  nextTime: 3,
};
const rightContinuity = {
  previous: p1,
  next: p4,
  previousTime: 1,
  startTime: 2,
  endTime: 3,
  nextTime: 4,
};
const epsilon = 0.001;
const leftNear = splineCore.interpolatePose(p1, p2, 1 - epsilon, leftContinuity);
const rightNear = splineCore.interpolatePose(p2, p3, epsilon, rightContinuity);
const leftVelocity = {
  x: (p2.x - leftNear.x) / epsilon,
  y: (p2.y - leftNear.y) / epsilon,
};
const rightVelocity = {
  x: (rightNear.x - p2.x) / epsilon,
  y: (rightNear.y - p2.y) / epsilon,
};
assert.ok(Math.hypot(leftVelocity.x, leftVelocity.y) > 0.1,
  "a normal curved operator path must not brake to zero merely because one planar axis changes sign");
assert.ok(Math.abs(leftVelocity.x - rightVelocity.x) < 0.01,
  `operator x velocity must stay continuous across a key: ${leftVelocity.x} vs ${rightVelocity.x}`);
assert.ok(Math.abs(leftVelocity.y - rightVelocity.y) < 0.01,
  `operator y velocity must stay continuous across a key: ${leftVelocity.y} vs ${rightVelocity.y}`);

const stopped = splineCore.vectorJoinTangent(
  pose(0.2, 0.2),
  pose(0.4, 0.4),
  pose(0.4, 0.4),
  0,
  1,
  2,
);
assert.deepEqual(stopped, { x: 0, y: 0 }, "an intentional operator hold must still be allowed to stop the camera");

const injection = main.indexOf('"camera-operator-live-ux.js"');
const interaction = main.indexOf('"interaction-ux.js"');
assert.ok(interaction >= 0 && injection > interaction, "live Camera Operator controller must inject after interaction-ux.js");
assert.ok(pkg.build.files.includes("electron/camera-operator-live-ux.js"), "desktop package must include the live Camera Operator controller");

console.log("Camera Operator live timeline/vector spline contract passed");
