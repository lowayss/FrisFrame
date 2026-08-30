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
assert.match(controller, /draw\(renderState\)/, "the live evaluated scene must be drawn during REC");
assert.match(controller, /renderThreeView\(renderState, true\)/, "3D view must render the live evaluated scene during REC");
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
