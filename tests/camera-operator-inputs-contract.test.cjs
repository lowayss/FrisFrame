"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const inputs = fs.readFileSync(path.join(root, "electron", "camera-operator-inputs-ux.js"), "utf8");
const phoneRemote = fs.readFileSync(path.join(root, "electron", "phone-remote.cjs"), "utf8");
const phonePreload = fs.readFileSync(path.join(root, "electron", "phone-remote-preload.cjs"), "utf8");
const main = fs.readFileSync(path.join(root, "electron", "main.cjs"), "utf8");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const { sanitizeInput } = require(path.join(root, "electron", "phone-remote.cjs"));

for (const label of ["⌨ 키보드", "🎮 패드", "📱 폰"]) {
  assert.ok(inputs.includes(label), `Camera Operator must expose ${label} input choice`);
}
assert.match(inputs, /navigator\.getGamepads\(\)/, "Bluetooth/USB gamepads must use the standard Gamepad API");
assert.match(inputs, /moveX:\s*deadzone\(pad\.axes\?\.\[0\]/, "left stick X must control truck movement");
assert.match(inputs, /moveY:\s*-deadzone\(pad\.axes\?\.\[1\]/, "left stick Y must control dolly movement");
assert.match(inputs, /lookX:\s*deadzone\(pad\.axes\?\.\[2\]/, "right stick X must control pan");
assert.match(inputs, /lookY:\s*-deadzone\(pad\.axes\?\.\[3\]/, "right stick Y must control tilt");
assert.match(inputs, /pad\.buttons\?\.\[7\]/, "right trigger must participate in pedestal control");
assert.match(inputs, /pad\.buttons\?\.\[6\]/, "left trigger must participate in pedestal control");
assert.match(inputs, /if \(pressed\(0\)\) toggleRecording\(\)/, "gamepad A must toggle Camera Operator REC");
assert.match(inputs, /if \(pressed\(1\)/, "gamepad B must cancel an active take");
assert.match(inputs, /KeyW/, "keyboard mode must support forward movement");
assert.match(inputs, /ArrowRight/, "keyboard mode must support camera look controls");
assert.match(inputs, /frisframe:phone-remote-input/, "phone remote input must be isolated behind a dedicated renderer event");
assert.match(inputs, /phoneState\.sensorActive/, "phone mode must accept orientation-sensor camera rotation");
assert.match(inputs, /window\.frisframePhoneRemote/, "phone mode must use the narrow desktop phone-remote bridge");
assert.match(inputs, /if \(selectedMode === "phone"\) startPhoneBridge\(\)/, "selecting Phone must open the LAN bridge on demand");
assert.match(inputs, /else if \(previousMode === "phone" \|\| phoneConfig \|\| phoneStartPromise\) stopPhoneBridge\(\)/,
  "leaving Phone mode must close the LAN bridge");
assert.match(inputs, /window\.FrisFrameCameraOperatorInputs/, "multi-input runtime must expose a smoke-testable marker");
assert.match(inputs, /multiInput:\s*true/, "multi-input runtime marker must identify the new controller");

assert.match(phoneRemote, /crypto\.randomBytes\(24\)/, "phone pairing must use a high-entropy random token");
assert.match(phoneRemote, /crypto\.timingSafeEqual/, "phone pairing token comparison must be timing-safe");
assert.match(phoneRemote, /server\.listen\(0, "0\.0\.0\.0"/, "only the dedicated phone controller may listen on the LAN");
assert.match(phoneRemote, /MAX_BODY_BYTES = 8192/, "phone input payload size must be bounded");
assert.match(phoneRemote, /content-security-policy/, "phone controller page must ship its own restrictive CSP");
assert.match(phoneRemote, /frame-ancestors 'none'/, "phone controller must not be frameable by another origin");
assert.match(phoneRemote, /DeviceOrientationEvent\.requestPermission/, "phone controller must request sensor permission when the platform requires it");
assert.match(phoneRemote, /window\.isSecureContext/, "phone controller must detect browser sensor security restrictions");
assert.doesNotMatch(phoneRemote, /api\/projects|api\/export|api\/mcp/, "phone bridge must not expose project, export, or MCP endpoints");

const sanitized = sanitizeInput({
  moveX: 50,
  moveY: -50,
  lookX: 3,
  lookY: -3,
  height: 9,
  focal: -9,
  sensorYaw: 900,
  sensorPitch: -900,
  command: "not-allowed",
});
assert.equal(sanitized.moveX, 1);
assert.equal(sanitized.moveY, -1);
assert.equal(sanitized.lookX, 1);
assert.equal(sanitized.lookY, -1);
assert.equal(sanitized.height, 1);
assert.equal(sanitized.focal, -1);
assert.equal(sanitized.sensorYaw, 720);
assert.equal(sanitized.sensorPitch, -180);
assert.equal(sanitized.command, "");
assert.equal(sanitizeInput({ command: "toggle-record" }).command, "toggle-record");

assert.match(phonePreload, /const \{ contextBridge, ipcRenderer \} = require\("electron"\)/,
  "phone bridge must remain compatible with Electron sandboxed preload restrictions");
assert.doesNotMatch(phonePreload, /require\("\.\//,
  "sandboxed phone preload must not import another local CommonJS file");
assert.match(phonePreload, /contextBridge\.exposeInMainWorld\("frisframePhoneRemote"/, "phone preload must expose only a dedicated narrow API");
assert.match(phonePreload, /ipcRenderer\.invoke\("phone-remote:start"\)/);
assert.match(phonePreload, /ipcRenderer\.invoke\("phone-remote:stop"\)/);
assert.match(phonePreload, /ipcRenderer\.invoke\("phone-remote:status"\)/);

assert.match(main, /createPhoneRemoteBridge/, "Electron main must own the isolated phone bridge");
assert.match(main, /ipcMain\.handle\("phone-remote:start"/, "phone LAN listener must be opened only through an explicit renderer request");
assert.match(main, /ipcMain\.handle\("phone-remote:stop"/, "phone LAN listener must have an explicit close path");
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

console.log("Camera Operator keyboard/gamepad/phone input contract passed");
