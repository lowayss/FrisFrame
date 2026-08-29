"use strict";

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

function requireRuntimeFiles(resources, filenames) {
  for (const filename of filenames) {
    const target = path.join(resources, filename);
    if (!fs.existsSync(target)) throw new Error(`패키지 런타임이 없습니다: ${target}`);
  }
}

module.exports = async function afterPack(context) {
  if (context.electronPlatformName === "win32") {
    const resources = path.join(context.appOutDir, "resources", "runtime");
    requireRuntimeFiles(resources, [path.join("server", "frisframe-server.exe"), "ffmpeg.exe"]);
    return;
  }

  if (context.electronPlatformName !== "darwin") return;
  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  const resources = path.join(appPath, "Contents", "Resources", "runtime");
  requireRuntimeFiles(resources, [path.join("server", "frisframe-server"), "ffmpeg"]);
  for (const filename of [path.join("server", "frisframe-server"), "ffmpeg"]) {
    fs.chmodSync(path.join(resources, filename), 0o755);
  }

  const infoPlist = path.join(appPath, "Contents", "Info.plist");
  for (const key of [
    "NSAudioCaptureUsageDescription",
    "NSBluetoothAlwaysUsageDescription",
    "NSBluetoothPeripheralUsageDescription",
    "NSCameraUsageDescription",
    "NSMicrophoneUsageDescription",
  ]) {
    spawnSync("/usr/bin/plutil", ["-remove", key, infoPlist], { stdio: "ignore" });
  }
  const hardenTransport = spawnSync(
    "/usr/bin/plutil",
    ["-replace", "NSAppTransportSecurity.NSAllowsArbitraryLoads", "-bool", "NO", infoPlist],
    { stdio: "inherit" },
  );
  if (hardenTransport.status !== 0) throw new Error("macOS 네트워크 보안 설정을 적용하지 못했습니다.");
};
