"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const sourceServer = path.join(root, "dist-runtime", "frisframe-server");
const sourceMcp = path.join(root, "dist-runtime", "frisframe-mcp");
const stagedRuntime = path.join(root, "dist-runtime", "staged-runtime");
const stagedServer = path.join(stagedRuntime, "server");
const stagedMcp = path.join(stagedRuntime, "mcp");
const ffmpegSource = require("ffmpeg-static");
const ffmpegName = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
const stagedFfmpeg = path.join(stagedRuntime, ffmpegName);

if (!fs.existsSync(sourceServer)) throw new Error(`Python 서버 런타임이 없습니다: ${sourceServer}`);
if (!fs.existsSync(sourceMcp)) throw new Error(`MCP 런타임이 없습니다: ${sourceMcp}`);
if (!ffmpegSource || !fs.existsSync(ffmpegSource)) throw new Error(`FFmpeg 런타임이 없습니다: ${ffmpegSource || "unknown"}`);

fs.rmSync(stagedRuntime, { recursive: true, force: true });
fs.mkdirSync(stagedRuntime, { recursive: true });
fs.cpSync(sourceServer, stagedServer, { recursive: true });
fs.cpSync(sourceMcp, stagedMcp, { recursive: true });
fs.copyFileSync(ffmpegSource, stagedFfmpeg);

if (process.platform !== "win32") {
  fs.chmodSync(path.join(stagedServer, "frisframe-server"), 0o755);
  fs.chmodSync(path.join(stagedMcp, "frisframe-mcp"), 0o755);
  fs.chmodSync(stagedFfmpeg, 0o755);
}

console.log(`FrisFrame 런타임 스테이징 완료: ${process.platform}-${process.arch} · server + MCP · ${stagedRuntime}`);
