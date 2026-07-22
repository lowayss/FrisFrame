"use strict";

const { spawnSync } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const version = "8.1.2";
const sourceUrl = `https://ffmpeg.org/releases/ffmpeg-${version}.tar.xz`;
const sourceSha256 = "464beb5e7bf0c311e68b45ae2f04e9cc2af88851abb4082231742a74d97b524c";
const cache = path.join(root, ".runtime-cache");
const archive = path.join(cache, `ffmpeg-${version}.tar.xz`);
const source = path.join(cache, `ffmpeg-${version}-src`);
const output = path.join(root, "dist-runtime", "ffmpeg");
const licenseOutput = path.join(root, "dist-runtime", "licenses");
const configureArgs = [
  "--prefix=/usr/local",
  "--cc=clang",
  "--arch=arm64",
  "--target-os=darwin",
  "--disable-everything",
  "--disable-autodetect",
  "--disable-doc",
  "--disable-debug",
  "--disable-network",
  "--disable-ffplay",
  "--disable-ffprobe",
  "--disable-avdevice",
  "--disable-swresample",
  "--enable-small",
  "--enable-ffmpeg",
  "--enable-protocol=file",
  "--enable-demuxer=image2",
  "--enable-decoder=mjpeg",
  "--enable-encoder=h264_videotoolbox",
  "--enable-muxer=mp4",
  "--enable-filter=scale,format",
  "--enable-videotoolbox",
  "--extra-cflags=-mmacosx-version-min=12.0",
  "--extra-ldflags=-mmacosx-version-min=12.0",
];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || root,
    env: { ...process.env, MACOSX_DEPLOYMENT_TARGET: "12.0", ...(options.env || {}) },
    encoding: options.capture ? "utf8" : undefined,
    stdio: options.capture ? "pipe" : "inherit",
  });
  if (result.status !== 0) throw new Error(result.stderr || `${command} 명령을 완료하지 못했습니다.`);
  return result.stdout || "";
}

function sha256(filename) {
  return crypto.createHash("sha256").update(fs.readFileSync(filename)).digest("hex");
}

function ensureSource() {
  if (process.platform !== "darwin" || process.arch !== "arm64") {
    throw new Error("현재 FFmpeg 빌드는 Apple Silicon macOS에서만 지원합니다.");
  }
  fs.mkdirSync(cache, { recursive: true });
  if (!fs.existsSync(archive)) {
    run("curl", ["--fail", "--location", "--retry", "3", "--output", archive, sourceUrl]);
  }
  if (sha256(archive) !== sourceSha256) throw new Error("FFmpeg 소스 체크섬이 일치하지 않습니다.");
  fs.rmSync(source, { recursive: true, force: true });
  fs.mkdirSync(source, { recursive: true });
  run("tar", ["-xJf", archive, "-C", source, "--strip-components=1"]);
}

ensureSource();
run("./configure", configureArgs, { cwd: source });
run("make", [`-j${Math.min(8, os.availableParallelism?.() || os.cpus().length || 4)}`], { cwd: source });
const versionText = run(path.join(source, "ffmpeg"), ["-hide_banner", "-version"], { capture: true });
if (/--enable-(?:gpl|nonfree)\b/.test(versionText)) throw new Error("FFmpeg 빌드에 배포 제한 옵션이 포함되었습니다.");
const encoders = run(path.join(source, "ffmpeg"), ["-hide_banner", "-encoders"], { capture: true });
if (!/\bh264_videotoolbox\b/.test(encoders)) throw new Error("FFmpeg에 h264_videotoolbox 인코더가 없습니다.");
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.copyFileSync(path.join(source, "ffmpeg"), output);
fs.chmodSync(output, 0o755);
fs.mkdirSync(licenseOutput, { recursive: true });
fs.copyFileSync(path.join(source, "COPYING.LGPLv2.1"), path.join(licenseOutput, "FFmpeg-LICENSE.txt"));
fs.copyFileSync(archive, path.join(licenseOutput, `ffmpeg-${version}-source.tar.xz`));
fs.writeFileSync(path.join(licenseOutput, "FFmpeg-BUILD.txt"), [
  `FFmpeg ${version}`,
  `Source: ${sourceUrl}`,
  `SHA-256: ${sourceSha256}`,
  "License: LGPL 2.1 or later",
  "",
  "Configure options:",
  configureArgs.join(" "),
  "",
].join("\n"));
console.log(`FrisFrame FFmpeg 런타임 준비: ${output}`);
