"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const controller = fs.readFileSync(path.join(root, "electron", "camera-operator-live-ux.js"), "utf8");
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

const injection = main.indexOf('"camera-operator-live-ux.js"');
const interaction = main.indexOf('"interaction-ux.js"');
assert.ok(interaction >= 0 && injection > interaction, "live Camera Operator controller must inject after interaction-ux.js");
assert.ok(pkg.build.files.includes("electron/camera-operator-live-ux.js"), "desktop package must include the live Camera Operator controller");

console.log("Camera Operator live timeline contract passed");
