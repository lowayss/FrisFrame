"use strict";

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const source = path.join(root, "build", "icon.svg");
const sourcePng = path.join(root, "build", "icon-source.png");
const iconset = path.join(root, "build", "icon.iconset");
const output = path.join(root, "build", "icon.icns");

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit", windowsHide: true });
  if (result.status !== 0) process.exit(result.status || 1);
}

if (!fs.existsSync(source)) throw new Error(`아이콘 원본이 없습니다: ${source}`);

if (process.platform !== "darwin") {
  console.log(`FrisFrame 아이콘 준비: ${process.platform}에서는 Electron Builder 기본 Windows 아이콘을 사용합니다.`);
  process.exit(0);
}

fs.rmSync(iconset, { recursive: true, force: true });
fs.mkdirSync(iconset, { recursive: true });
run("/usr/bin/sips", ["-s", "format", "png", source, "--out", sourcePng]);
for (const size of [16, 32, 128, 256, 512]) {
  run("/usr/bin/sips", ["-z", String(size), String(size), sourcePng, "--out", path.join(iconset, `icon_${size}x${size}.png`)]);
  run("/usr/bin/sips", ["-z", String(size * 2), String(size * 2), sourcePng, "--out", path.join(iconset, `icon_${size}x${size}@2x.png`)]);
}
run("/usr/bin/iconutil", ["-c", "icns", iconset, "-o", output]);
console.log(`FrisFrame 아이콘 생성: ${output}`);
