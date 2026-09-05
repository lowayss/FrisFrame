"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const inputs = fs.readFileSync(path.join(root, "electron", "camera-operator-inputs-ux.js"), "utf8");
const phoneRemote = fs.readFileSync(path.join(root, "electron", "phone-remote.cjs"), "utf8");
const phonePreload = fs.readFileSync(path.join(root, "electron", "phone-remote-preload.cjs"), "utf8");
const main = fs.readFileSync(path.join(root, "electron", "main.cjs"), "utf8");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const server = fs.readFileSync(path.join(root, "server.py"), "utf8");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const { sanitizeInput } = require(path.join(root, "electron", "phone-remote.cjs"));

for (const label of ["🖱 마우스", "🎮 패드", "📱 폰"]) {
  assert.ok(inputs.includes(label), `Camera Operator must expose ${label} input choice`);
}
assert.match(inputs, /const MODES = \["mouse", "gamepad", "phone"\]/, "Camera Operator input modes must use mouse as the desktop default");
assert.match(inputs, /data-mode="mouse"/, "Camera Operator must expose mouse control as the primary desktop mode");
assert.doesNotMatch(inputs, /data-mode="keyboard"|⌨ 키보드|keyboardAxes/, "Camera Operator must not present keyboard as its operator mode");
assert.match(inputs, /navigator\.getGamepads\(\)/, "Bluetooth/USB gamepads must use the standard Gamepad API");
assert.match(inputs, /moveX:\s*deadzone\(pad\.axes\?\.\[0\]/, "left stick X must control truck movement");
assert.match(inputs, /moveY:\s*-deadzone\(pad\.axes\?\.\[1\]/, "left stick Y must control dolly movement");
assert.match(inputs, /lookX:\s*deadzone\(pad\.axes\?\.\[2\]/, "right stick X must control pan");
assert.match(inputs, /lookY:\s*-deadzone\(pad\.axes\?\.\[3\]/, "right stick Y must control tilt");
assert.match(inputs, /pad\.buttons\?\.\[7\]/, "right trigger must participate in pedestal control");
assert.match(inputs, /pad\.buttons\?\.\[6\]/, "left trigger must participate in pedestal control");
assert.match(inputs, /if \(pressed\(0\)\) toggleRecording\(\)/, "gamepad A must toggle Camera Operator REC");
assert.match(inputs, /if \(pressed\(1\)/, "gamepad B must cancel an active take");
assert.match(inputs, /마우스 드래그 Pan\/Tilt·이동\/거리/, "mouse mode must describe the actual Camera Operator interaction");
assert.match(inputs, /frisframe:phone-remote-input/, "phone remote input must be isolated behind a dedicated renderer event");
assert.match(inputs, /moveX: phoneState\.moveX/, "phone mode must use the virtual-pad movement X axis");
assert.match(inputs, /lookX: phoneState\.lookX/, "phone mode must use the virtual-pad pan X axis");
assert.match(inputs, /왼쪽 조이스틱/, "phone mode must label the left virtual joystick");
assert.match(inputs, /오른쪽 조이스틱/, "phone mode must label the right virtual joystick");
assert.match(inputs, /motionActive|sensorYaw|sensorPitch|phoneSensorAnchor/, "phone mode must retain a separate device-motion angle channel");
assert.match(inputs, /phoneMotionPose|applyPhoneMotion|motion-zero/, "phone motion must calibrate and apply an absolute camera angle");
assert.match(inputs, /\["idle", "armed", "recording"\]\.includes\(op\.mode\)/, "phone gyro must drive the live preview, STBY, and REC take");
assert.match(inputs, /get phoneAimOffset\(\)/, "phone gyro must expose a tracking-safe relative angle offset");
assert.match(inputs, /applyPose\(live, renderState, \{ maintainTarget: false \}\)/, "phone preview must preserve the live angle after tracking evaluation");
assert.match(inputs, /__preserveLiveCameraOrientation = true/, "phone preview must mark the already-composed live orientation");
assert.match(fs.readFileSync(path.join(root, "app.js"), "utf8"), /__preserveLiveCameraOrientation/, "camera preview must not reapply tracking over the live phone orientation");
assert.match(inputs, /window\.frisframePhoneRemote/, "phone mode must use the narrow desktop phone-remote bridge");
assert.match(inputs, /window\.qrcode/, "phone pairing must use the bundled QR generator");
assert.match(inputs, /createSvgTag/, "phone pairing must render the connection URL as an SVG QR code");
assert.match(inputs, /frisframe-phone-qr/, "phone pairing must include a visible QR container");
assert.match(inputs, /capturePhonePreviewFrame|sendPhonePreviewFrame|startPhonePreviewStream/, "phone mode must send the desktop camera frame to the paired phone");
assert.match(inputs, /cameraFrameCanvas/, "phone preview must use the shared camera preview canvas");
assert.match(inputs, /PHONE_PREVIEW_INTERVAL_MS = 50/, "desktop phone preview publishing must stay low-latency");
assert.match(phoneRemote, /PREVIEW_POLL_INTERVAL_MS = 50/, "phone preview polling must stay low-latency");
assert.match(inputs, /PHONE_PREVIEW_MAX_WIDTH = 640/, "phone preview payload must stay lightweight");
assert.match(inputs, /if \(selectedMode === "phone"\) startPhoneBridge\(\)/, "selecting Phone must open the LAN bridge on demand");
assert.match(inputs, /else if \(previousMode === "phone" \|\| phoneConfig \|\| phoneStartPromise\) stopPhoneBridge\(\)/,
  "leaving Phone mode must close the LAN bridge");
assert.match(inputs, /window\.FrisFrameCameraOperatorInputs/, "multi-input runtime must expose a smoke-testable marker");
assert.match(inputs, /startRecording:\s*syntheticStart/, "Physical Camera must reuse the existing Camera Operator start path instead of duplicating recording startup");
assert.match(inputs, /multiInput:\s*true/, "multi-input runtime marker must identify the new controller");

assert.match(phoneRemote, /crypto\.randomBytes\(24\)/, "phone pairing must use a high-entropy random token");
assert.match(phoneRemote, /crypto\.timingSafeEqual/, "phone pairing token comparison must be timing-safe");
assert.match(phoneRemote, /http\.createServer\(handleRequest\)/, "phone virtual-pad bridge must use a simple HTTP listener");
assert.match(phoneRemote, /http:\/\/\$\{address\}/, "phone pairing must advertise a simple HTTP URL");
assert.match(phoneRemote, /DeviceOrientationEvent|deviceorientation/, "phone controller must read device orientation after an explicit user action");
assert.match(phoneRemote, /motionBtn|zeroBtn|motion-zero/, "phone controller must expose motion start and calibration controls");
assert.match(phoneRemote, /id="previewImage"|\/preview/, "phone controller must show the synchronized desktop camera preview");
assert.match(phoneRemote, /MAX_PREVIEW_BYTES|setPreviewFrame|previewFrame/, "phone preview frames must be bounded and held only in the paired bridge");
assert.match(phoneRemote, /server\.listen\(0, "0\.0\.0\.0"/, "only the dedicated phone controller may listen on the LAN");
assert.match(phoneRemote, /MAX_BODY_BYTES = 8192/, "phone input payload size must be bounded");
assert.match(phoneRemote, /content-security-policy/, "phone controller page must ship its own restrictive CSP");
assert.match(phoneRemote, /frame-ancestors 'none'/, "phone controller must not be frameable by another origin");
assert.match(phoneRemote, /id="movePad"/, "phone controller must expose a left virtual movement pad");
assert.match(phoneRemote, /id="lookPad"/, "phone controller must expose a right virtual look pad");
assert.match(phoneRemote, /id="l1Btn"/, "phone controller must expose an L1 height button");
assert.match(phoneRemote, /id="r1Btn"/, "phone controller must expose an R1 height button");
assert.match(phoneRemote, /state\.moveX=x;state\.moveY=-y/, "left virtual joystick must map horizontal and dolly movement");
assert.match(inputs, /\["idle", "armed", "recording"\]\.includes\(op\.mode\)/, "remote joystick must drive the live preview before REC");
assert.match(inputs, /operatorAimTrim\.panDeg \+=/, "tracked joystick pan must accumulate as a manual angle offset");
assert.match(inputs, /get operatorAimOffset\(\)/, "tracked joystick angle must be exposed to the live controller");
assert.match(inputs, /resetAimOffset: resetOperatorAimTrim/, "manual angle offset must have an explicit reset path");
assert.match(phoneRemote, /state\.sensorYaw = signedAngle\(alpha \+ gamma\)/, "device orientation must support both flat and upright phone grips");
assert.match(phoneRemote, /holdButton\("r1Btn","height",1\)/, "R1 must raise the camera");
assert.match(phoneRemote, /holdButton\("l1Btn","height",-1\)/, "L1 must lower the camera");
assert.match(phoneRemote, /id="recBtn"/, "phone controller must expose a REC button");
assert.match(phoneRemote, /id="stopBtn"/, "phone controller must expose a STOP button");
assert.doesNotMatch(phoneRemote, /api\/projects|api\/export|api\/mcp/, "phone bridge must not expose project, export, or MCP endpoints");

const sanitized = sanitizeInput({
  moveX: 50,
  moveY: -50,
  lookX: 3,
  lookY: -3,
  height: 9,
  focal: -9,
  command: "not-allowed",
});
assert.equal(sanitized.moveX, 1);
assert.equal(sanitized.moveY, -1);
assert.equal(sanitized.lookX, 1);
assert.equal(sanitized.lookY, -1);
assert.equal(sanitized.height, 1);
assert.equal(sanitized.focal, -1);
assert.equal(sanitizeInput({ motionActive: true, sensorYaw: 270, sensorPitch: -190, sensorRoll: 190 }).motionActive, true);
assert.equal(sanitizeInput({ motionActive: true, sensorYaw: 270, sensorPitch: -190, sensorRoll: 190 }).sensorYaw, 180);
assert.equal(sanitizeInput({ motionActive: true, sensorYaw: 270, sensorPitch: -190, sensorRoll: 190 }).sensorPitch, -180);
assert.equal(sanitizeInput({ motionActive: true, sensorYaw: 270, sensorPitch: -190, sensorRoll: 190 }).sensorRoll, 180);
assert.equal(sanitized.command, "");
assert.equal(sanitizeInput({ command: "toggle-record" }).command, "toggle-record");
assert.equal(sanitizeInput({ command: "zero" }).command, "");
assert.equal(sanitizeInput({ command: "motion-zero" }).command, "motion-zero");

assert.match(phonePreload, /const \{ contextBridge, ipcRenderer \} = require\("electron"\)/,
  "phone bridge must remain compatible with Electron sandboxed preload restrictions");
assert.doesNotMatch(phonePreload, /require\("\.\//,
  "sandboxed phone preload must not import another local CommonJS file");
assert.match(phonePreload, /contextBridge\.exposeInMainWorld\("frisframePhoneRemote"/, "phone preload must expose only a dedicated narrow API");
assert.match(phonePreload, /ipcRenderer\.invoke\("phone-remote:start"\)/);
assert.match(phonePreload, /ipcRenderer\.invoke\("phone-remote:stop"\)/);
assert.match(phonePreload, /ipcRenderer\.invoke\("phone-remote:status"\)/);
assert.match(phonePreload, /ipcRenderer\.invoke\("phone-remote:preview"/, "desktop must expose only the narrow preview publish IPC");

assert.match(main, /createPhoneRemoteBridge/, "Electron main must own the isolated phone bridge");
assert.match(main, /ipcMain\.handle\("phone-remote:start"/, "phone LAN listener must be opened only through an explicit renderer request");
assert.match(main, /ipcMain\.handle\("phone-remote:stop"/, "phone LAN listener must have an explicit close path");
assert.match(main, /ipcMain\.handle\("phone-remote:preview"/, "desktop preview publishing must be origin-checked in the main process");
assert.match(main, /rendererEventAllowed\(event\)/, "phone IPC must verify the calling renderer origin");
assert.match(main, /preload:\s*path\.join\(__dirname, "preload\.cjs"\)/,
  "the established hardened BrowserWindow preload must remain unchanged");
assert.match(main, /session\.defaultSession\.registerPreloadScript\(\{[\s\S]*type:\s*"frame"[\s\S]*filePath:\s*path\.join\(__dirname, "phone-remote-preload\.cjs"\)/,
  "phone IPC must use Electron's supported additional sandboxed preload registration");
assert.match(main, /phoneRemoteBridge\?\.stop\?\.\(\)/, "desktop quit must close the phone controller bridge");
const readyBlock = main.match(/app\.whenReady\(\)\.then\(async \(\) => \{[\s\S]*?\n  \}\);/)?.[0] || "";
assert.doesNotMatch(readyBlock, /phoneRemoteBridge\.start\(\)/,
  "ordinary app startup must not open a LAN listener before the user selects Phone mode");
const liveIndex = main.indexOf('"camera-operator-live-ux.js"');
const inputsIndex = main.indexOf('"camera-operator-inputs-ux.js"');
assert.ok(liveIndex >= 0 && inputsIndex > liveIndex, "multi-input UX must inject after the live Camera Operator controller");
assert.match(main, /--host", "127\.0\.0\.1"/, "project/MCP HTTP runtime must remain loopback-only");
assert.ok(pkg.build.files.includes("electron/preload.cjs"));
assert.ok(pkg.build.files.includes("electron/phone-remote-preload.cjs"));
assert.equal(pkg.build.files.includes("electron/preload-entry.cjs"), false);
assert.ok(pkg.build.files.includes("electron/camera-operator-inputs-ux.js"));
assert.ok(pkg.build.files.includes("electron/phone-remote.cjs"));
assert.match(index, /vendor\/qrcode-generator\.js\?v=1\.4\.4/, "the QR generator must be loaded as a bundled offline vendor asset");
assert.match(server, /"\/vendor\/qrcode-generator\.js"/, "the local server must allow the bundled QR asset");

console.log("Camera Operator mouse/gamepad/phone input contract passed");
