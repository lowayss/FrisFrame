"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");

function sha256(filename) {
  return crypto.createHash("sha256").update(fs.readFileSync(filename)).digest("hex");
}

function packagedServerInternal() {
  if (process.platform === "win32") {
    return path.join(root, "release", "win-unpacked", "resources", "runtime", "server", "_internal");
  }
  if (process.platform === "darwin") {
    return path.join(root, "release", "mac-arm64", "FrisFrame.app", "Contents", "Resources", "runtime", "server", "_internal");
  }
  throw new Error(`패키지 런타임 일치 검사를 지원하지 않는 플랫폼입니다: ${process.platform}`);
}

const packagedRoot = packagedServerInternal();
const runtimeFiles = [
  "index.html",
  "styles.css",
  "app.js",
  "boot-errors.js",
  "storyboard-core.js",
  "motion-core.js",
  "scene-blocking-core.js",
  "previs-runtime-core.js",
  "reference-workflow-core.js",
  "timeline-core.js",
  "project-recovery-core.js",
  "manual-guide-core.js",
  "pose-core.js",
  "camera-drafting-core.js",
  "multi-camera-core.js",
  "spatial-scale-core.js",
];

for (const filename of runtimeFiles) {
  const source = path.join(root, filename);
  const packaged = path.join(packagedRoot, filename);
  if (!fs.existsSync(packaged)) throw new Error(`패키지 웹 런타임 파일이 없습니다: ${packaged}`);
  const sourceHash = sha256(source);
  const packagedHash = sha256(packaged);
  if (sourceHash !== packagedHash) {
    throw new Error(`패키지 웹 런타임이 현재 소스와 다릅니다: ${filename}\nsource=${sourceHash}\npackage=${packagedHash}`);
  }
}

const packagedApp = fs.readFileSync(path.join(packagedRoot, "app.js"), "utf8");
if (packagedApp.includes("renderSpatialGuideControls")) {
  throw new Error("패키지 app.js에 폐기된 renderSpatialGuideControls 호출/정의가 남아 있습니다.");
}

console.log(`FrisFrame 패키지 웹 런타임 일치 확인: ${runtimeFiles.length}개 파일`);
