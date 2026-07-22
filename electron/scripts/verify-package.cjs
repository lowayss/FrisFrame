"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "../..");
const appPath = path.join(root, "release", "mac-arm64", "FrisFrame.app");
const resources = path.join(appPath, "Contents", "Resources", "runtime");
const licenses = path.join(appPath, "Contents", "Resources", "licenses");
const required = [
  path.join(appPath, "Contents", "MacOS", "FrisFrame"),
  path.join(resources, "server", "frisframe-server"),
  path.join(resources, "server", "_internal", "pose-core.js"),
  path.join(resources, "server", "_internal", "camera-drafting-core.js"),
  path.join(resources, "ffmpeg"),
  path.join(resources, "server", "_internal", "timeline-core.js"),
  path.join(licenses, "FrisFrame-LICENSE.txt"),
  path.join(licenses, "THIRD_PARTY_NOTICES.md"),
];
for (const target of required) {
  if (!fs.existsSync(target)) throw new Error(`패키지 파일이 없습니다: ${target}`);
}
fs.accessSync(required[0], fs.constants.X_OK);
fs.accessSync(required[1], fs.constants.X_OK);
fs.accessSync(required[4], fs.constants.X_OK);
const plistCheck = spawnSync("/usr/bin/plutil", ["-extract", "NSAppTransportSecurity.NSAllowsArbitraryLoads", "raw", path.join(appPath, "Contents", "Info.plist")], { encoding: "utf8" });
if (plistCheck.status !== 0 || plistCheck.stdout.trim() !== "false") {
  throw new Error("앱 전역 네트워크 허용이 꺼져 있지 않습니다.");
}
console.log(`FrisFrame 앱 패키지 확인: ${appPath}`);
