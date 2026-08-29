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
const runtimeStager = fs.readFileSync(path.join(root, "electron/scripts/stage-runtime.cjs"), "utf8");
const afterPack = fs.readFileSync(path.join(root, "electron/after-pack.cjs"), "utf8");
const desktopWorkflow = fs.readFileSync(path.join(root, ".github/workflows/desktop-builds.yml"), "utf8");
const signingGuide = fs.readFileSync(path.join(root, "SIGNING.md"), "utf8");
const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");

assert.equal(packageJson.main, "electron/main.cjs");
assert.equal(packageLock.version, packageJson.version);
assert.equal(packageLock.packages[""].version, packageJson.version);
assert.ok(readme.includes(`FrisFrame-${packageJson.version}-arm64.dmg`));
assert.ok(readme.includes(`FrisFrame-${packageJson.version}-x64.exe`));
assert.equal(packageJson.build.asar, true);
assert.equal(packageJson.build.mac.hardenedRuntime, true);
assert.equal(packageJson.build.mac.notarize, false,
  "ordinary builds stay unsigned; tagged release workflow enables notarization explicitly");
assert.equal(Object.prototype.hasOwnProperty.call(packageJson.build.mac, "identity"), false,
  "macOS signing identity must come from CI credentials, not repository config");
assert.ok(packageJson.build.extraResources.some((entry) => entry.to === "runtime" && entry.from === "dist-runtime/staged-runtime"));
assert.ok(packageJson.build.extraResources.some((entry) => entry.to === "licenses/THIRD_PARTY_NOTICES.md"));
assert.equal(packageJson.build.mac.icon, "build/icon.icns");
assert.ok(packageJson.build.files.includes("electron/clipboard.cjs"));
assert.ok(packageJson.build.files.includes("electron/file-save.cjs"));
assert.ok(packageJson.build.files.includes("electron/selection-ux.js"));
assert.match(main, /"selection-ux\.js"/);
assert.equal(packageJson.scripts["desktop:build:mac"], "npm run desktop:prepare && electron-builder --mac dmg zip --arm64");
assert.equal(packageJson.scripts["desktop:build:win"], "npm run desktop:prepare && electron-builder --win nsis --x64");
assert.ok(packageJson.build.win.target.includes("nsis"));
assert.equal(packageJson.build.nsis.oneClick, false);
assert.match(runtimeBuilder, /darwin-arm64/);
assert.match(runtimeBuilder, /win32-x64/);
assert.match(runtimeBuilder, /x86_64-pc-windows-msvc-install_only_stripped\.tar\.gz/);
assert.match(runtimeBuilder, /24168aff2e7d93784c6a436124c4ebb79b076a4e289bde4902c08333507b71d0/);
assert.match(runtimeBuilder, /python\.exe/);
assert.match(runtimeBuilder, /Scripts/);
assert.match(runtimeStager, /require\("ffmpeg-static"\)/);
assert.match(runtimeStager, /ffmpeg\.exe/);
assert.match(main, /frisframe-server\.exe/);
assert.match(main, /ffmpeg\.exe/);
assert.match(main, /taskkill/);
assert.match(main, /windowsHide:\s*true/);
assert.match(afterPack, /electronPlatformName === "win32"/);
assert.match(desktopWorkflow, /name: macOS · Apple Silicon/);
assert.match(desktopWorkflow, /runs-on: macos-latest/);
assert.match(desktopWorkflow, /name: Windows · x64/);
assert.match(desktopWorkflow, /runs-on: windows-latest/);
assert.match(desktopWorkflow, /name: FrisFrame-macOS-arm64/);
assert.match(desktopWorkflow, /name: FrisFrame-Windows-x64/);
assert.match(desktopWorkflow, /MAC_CSC_LINK:\s*\$\{\{ secrets\.MAC_CSC_LINK \}\}/);
assert.match(desktopWorkflow, /APPLE_APP_SPECIFIC_PASSWORD:\s*\$\{\{ secrets\.APPLE_APP_SPECIFIC_PASSWORD \}\}/);
assert.match(desktopWorkflow, /APPLE_TEAM_ID:\s*\$\{\{ secrets\.APPLE_TEAM_ID \}\}/);
assert.match(desktopWorkflow, /WIN_CSC_LINK:\s*\$\{\{ secrets\.WIN_CSC_LINK \}\}/);
assert.match(desktopWorkflow, /--config\.forceCodeSigning=true/);
assert.match(desktopWorkflow, /--config\.mac\.notarize=true/);
assert.match(desktopWorkflow, /codesign --verify --deep --strict/);
assert.match(desktopWorkflow, /xcrun stapler validate/);
assert.match(desktopWorkflow, /Get-AuthenticodeSignature/);
assert.match(signingGuide, /Developer ID \+ notarization/);
assert.match(signingGuide, /WIN_CSC_KEY_PASSWORD/);
assert.match(signingGuide, /missing or invalid production signing secret intentionally fails/i);

assert.match(main, /contextIsolation:\s*true/);
assert.match(main, /nodeIntegration:\s*false/);
assert.match(main, /sandbox:\s*true/);
assert.match(main, /FRISFRAME_REQUIRE_ORIGIN:\s*"true"/);
assert.match(main, /app\.getPath\("userData"\)/);
assert.match(main, /runtime\.json/);
assert.match(main, /\/api\/health/);
assert.match(main, /FRISFRAME_STARTUP_NONCE/);
assert.match(main, /setPermissionCheckHandler\(\(\) => false\)/,
  "renderer permission checks must fail closed");
assert.match(main, /setPermissionRequestHandler/);
assert.match(main, /setDevicePermissionHandler\?\.\(\(\) => false\)/,
  "device permissions must be denied when supported by Electron");
assert.match(main, /setWindowOpenHandler/);
assert.match(main, /function rendererUrlMatchesOrigin/);
assert.match(main, /new URL\(value\)\.origin === allowedOrigin/,
  "navigation checks must compare parsed origins instead of trusting string prefixes");
assert.match(main, /will-navigate/);
assert.match(main, /will-redirect/,
  "cross-origin redirects must be guarded as well as direct navigation");
assert.equal(/url\.startsWith\(\`\$\{origin\}\//.test(main), false,
  "renderer navigation must not rely on prefix matching");
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
assert.ok(server.includes('"/scene-blocking-core.js"'));
assert.ok(server.includes('"/previs-runtime-core.js"'));
assert.ok(server.includes('"/reference-workflow-core.js"'));
assert.ok(server.includes('"/spatial-scale-core.js"'));
assert.ok(server.includes('"/timeline-core.js"'));
assert.ok(runtimeBuilder.includes('"pose-core.js"'), "desktop runtime must bundle pose-core.js");
assert.ok(runtimeBuilder.includes('"camera-drafting-core.js"'), "desktop runtime must bundle camera-drafting-core.js");
assert.ok(runtimeBuilder.includes('"multi-camera-core.js"'), "desktop runtime must bundle multi-camera-core.js");
assert.ok(runtimeBuilder.includes('"scene-blocking-core.js"'), "desktop runtime must bundle scene-blocking-core.js");
assert.ok(runtimeBuilder.includes('"previs-runtime-core.js"'), "desktop runtime must bundle previs-runtime-core.js");
assert.ok(runtimeBuilder.includes('"reference-workflow-core.js"'), "desktop runtime must bundle reference-workflow-core.js");
assert.ok(runtimeBuilder.includes('"spatial-scale-core.js"'), "desktop runtime must bundle spatial-scale-core.js");
assert.ok(runtimeBuilder.includes('"timeline-core.js"'), "desktop runtime must bundle timeline-core.js");
assert.match(appJs, /window\.FrisFrameTimelineCore/);
assert.ok(packageVerifier.includes('"ffmpeg.exe"'), "Windows package verification must require ffmpeg.exe");
assert.ok(packageVerifier.includes('"frisframe-server.exe"'), "Windows package verification must require the packaged server exe");
assert.ok(server.includes("FRISFRAME_FFMPEG"));
assert.equal(/https:\/\/(?:cdn\.jsdelivr\.net|unpkg\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)/.test(server), false,
  "server CSP must not allow remote renderer assets");

console.log("electron-contract: runtime, signing, security, navigation, permissions, offline assets, and persistent data path passed");
