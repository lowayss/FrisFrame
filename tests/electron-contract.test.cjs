const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const packageLock = JSON.parse(fs.readFileSync(path.join(root, "package-lock.json"), "utf8"));
const main = fs.readFileSync(path.join(root, "electron/main.cjs"), "utf8");
const clipboardBridge = fs.readFileSync(path.join(root, "electron/clipboard.cjs"), "utf8");
const fileSaveBridge = fs.readFileSync(path.join(root, "electron/file-save.cjs"), "utf8");
const preload = fs.readFileSync(path.join(root, "electron/preload.cjs"), "utf8");
const appJs = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const server = fs.readFileSync(path.join(root, "server.py"), "utf8");
const runtimeBuilder = fs.readFileSync(path.join(root, "electron/scripts/build-python-runtime.cjs"), "utf8");
const packageVerifier = fs.readFileSync(path.join(root, "electron/scripts/verify-package.cjs"), "utf8");
const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");

assert.equal(packageJson.main, "electron/main.cjs");
assert.equal(packageLock.version, packageJson.version);
assert.equal(packageLock.packages[""].version, packageJson.version);
assert.ok(readme.includes(`FrisFrame-${packageJson.version}-arm64.dmg`));
assert.equal(packageJson.build.asar, true);
assert.equal(packageJson.build.mac.identity, null);
assert.ok(packageJson.build.extraResources.some((entry) => entry.to === "runtime/server"));
assert.ok(packageJson.build.extraResources.some((entry) => entry.to === "runtime/ffmpeg"));
assert.ok(packageJson.build.extraResources.some((entry) => entry.to === "licenses/THIRD_PARTY_NOTICES.md"));
assert.equal(packageJson.build.mac.icon, "build/icon.icns");
assert.ok(packageJson.build.files.includes("electron/clipboard.cjs"));
assert.ok(packageJson.build.files.includes("electron/file-save.cjs"));

assert.match(main, /contextIsolation:\s*true/);
assert.match(main, /nodeIntegration:\s*false/);
assert.match(main, /sandbox:\s*true/);
assert.match(main, /FRISFRAME_REQUIRE_ORIGIN:\s*"true"/);
assert.match(main, /app\.getPath\("userData"\)/);
assert.match(main, /runtime\.json/);
assert.match(main, /\/api\/health/);
assert.match(main, /FRISFRAME_STARTUP_NONCE/);
assert.match(main, /setPermissionRequestHandler/);
assert.match(main, /setWindowOpenHandler/);
assert.match(main, /registerClipboardImageHandler/);
assert.match(main, /registerFileSaveHandler/);
assert.match(clipboardBridge, /ipcMain\.handle\("clipboard:write-image"/);
assert.match(clipboardBridge, /clipboard\.writeImage\(image\)/);
assert.match(clipboardBridge, /nativeImage\.createFromBuffer/);
assert.match(clipboardBridge, /senderOrigin !== allowedOrigin/);
assert.match(clipboardBridge, /PNG_SIGNATURE/);
assert.match(preload, /copyImage:\s*\(pngBytes\)\s*=>\s*ipcRenderer\.invoke\("clipboard:write-image", pngBytes\)/);
assert.match(preload, /saveFile:\s*\(payload\)\s*=>\s*ipcRenderer\.invoke\("file:save", payload\)/);
assert.match(fileSaveBridge, /ipcMain\.handle\("file:save"/);
assert.match(fileSaveBridge, /dialog\.showSaveDialog/);
assert.match(fileSaveBridge, /senderOrigin\(event\) !== allowedOrigin/);
assert.match(appJs, /window\.frisframeDesktop\.copyImage\(new Uint8Array\(await pngBlob\.arrayBuffer\(\)\)\)/);
assert.match(appJs, /window\.frisframeDesktop\.saveFile/);
assert.match(main, /app\.on\("will-quit"/);
assert.equal(/app\.on\("before-quit"[^]*killServerProcess/.test(main), false,
  "server must remain available while the renderer can still cancel quit");
assert.match(fs.readFileSync(path.join(root, "app.js"), "utf8"),
  /writeManagedProjectRecoveryNow\(\);\s*if \(window\.frisframeDesktop\?\.isDesktop\) return;/,
  "desktop quit must preserve recovery without silently cancelling app termination");

assert.equal(/https:\/\/(?:cdn\.jsdelivr\.net|unpkg\.com)/.test(html), false, "renderer must not load CDN scripts");
assert.ok(html.includes("./vendor/three.min.js"));
assert.ok(html.includes("./vendor/lucide.min.js"));
assert.ok(html.includes("Content-Security-Policy"));
assert.ok(server.includes('"/vendor/three.min.js"'));
assert.ok(server.includes('"/vendor/lucide.min.js"'));
assert.ok(server.includes('"/pose-core.js"'));
assert.ok(server.includes('"/camera-drafting-core.js"'));
assert.ok(server.includes('"/multi-camera-core.js"'));
assert.ok(server.includes('"/timeline-core.js"'));
assert.ok(runtimeBuilder.includes('"pose-core.js"'), "desktop runtime must bundle pose-core.js");
assert.ok(runtimeBuilder.includes('"camera-drafting-core.js"'), "desktop runtime must bundle camera-drafting-core.js");
assert.ok(runtimeBuilder.includes('"multi-camera-core.js"'), "desktop runtime must bundle multi-camera-core.js");
assert.ok(runtimeBuilder.includes('"timeline-core.js"'), "desktop runtime must bundle timeline-core.js");
assert.match(appJs, /window\.FrisFrameTimelineCore/);
assert.ok(packageVerifier.includes("fs.accessSync(required[4], fs.constants.X_OK)"), "package verification must check FFmpeg executable permission");
assert.ok(server.includes("FRISFRAME_FFMPEG"));
assert.equal(/https:\/\/(?:cdn\.jsdelivr\.net|unpkg\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)/.test(server), false,
  "server CSP must not allow remote renderer assets");

console.log("electron-contract: runtime, security, offline assets, and persistent data path passed");
