"use strict";

const { spawnSync } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const runtimeVersion = "3.12.13-20260510";
const runtimeUrl = "https://github.com/astral-sh/python-build-standalone/releases/download/20260510/cpython-3.12.13%2B20260510-aarch64-apple-darwin-install_only_stripped.tar.gz";
const runtimeSha256 = "55bc1a5edbc8ac4da0081f4f5731ed2d1ed10c57cb37a820b2a0dbc7cad742e9";
const cache = path.join(root, ".runtime-cache");
const archive = path.join(cache, `cpython-${runtimeVersion}-aarch64.tar.gz`);
const runtime = path.join(cache, `python-${runtimeVersion}`);
const bundledPython = path.join(runtime, "python", "bin", "python3");
const venv = path.join(root, `.venv-electron-${runtimeVersion}`);
const venvPython = path.join(venv, "bin", "python");

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit" });
  if (result.status !== 0) throw new Error(`${command} 명령을 완료하지 못했습니다.`);
}

function sha256(filename) {
  return crypto.createHash("sha256").update(fs.readFileSync(filename)).digest("hex");
}

function ensureBundledPython() {
  if (process.platform !== "darwin" || process.arch !== "arm64") {
    throw new Error("현재 데스크톱 빌드는 Apple Silicon macOS에서만 지원합니다.");
  }
  fs.mkdirSync(cache, { recursive: true });
  if (!fs.existsSync(archive)) {
    run("curl", ["--fail", "--location", "--retry", "3", "--output", archive, runtimeUrl]);
  }
  if (sha256(archive) !== runtimeSha256) {
    throw new Error("다운로드한 Python 런타임의 체크섬이 일치하지 않습니다.");
  }
  if (!fs.existsSync(bundledPython)) {
    fs.rmSync(runtime, { recursive: true, force: true });
    fs.mkdirSync(runtime, { recursive: true });
    run("tar", ["-xzf", archive, "-C", runtime]);
  }
  return bundledPython;
}

function minimumMacVersions(filename) {
  const result = spawnSync("otool", ["-l", filename], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`macOS 호환 버전을 읽지 못했습니다: ${filename}`);
  return [...result.stdout.matchAll(/\bminos\s+(\d+(?:\.\d+){1,2})/g)].map((match) => match[1]);
}

function versionGreaterThan(left, right) {
  const a = String(left).split(".").map(Number);
  const b = String(right).split(".").map(Number);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    if ((a[index] || 0) !== (b[index] || 0)) return (a[index] || 0) > (b[index] || 0);
  }
  return false;
}

const python = process.env.FRISFRAME_BUILD_PYTHON || ensureBundledPython();
for (const minimum of minimumMacVersions(fs.realpathSync(python))) {
  if (versionGreaterThan(minimum, "12.0")) {
    throw new Error(`Python 런타임이 macOS ${minimum} 이상을 요구해 배포 기준 12.0을 초과합니다.`);
  }
}

if (!fs.existsSync(venvPython)) run(python, ["-m", "venv", venv]);
const probe = spawnSync(venvPython, ["-m", "PyInstaller", "--version"], { cwd: root, stdio: "ignore" });
if (probe.status !== 0) run(venvPython, ["-m", "pip", "install", "--disable-pip-version-check", "pyinstaller==6.21.0"]);

fs.mkdirSync(path.join(root, "dist-runtime"), { recursive: true });
fs.rmSync(path.join(root, "dist-runtime", "frisframe-server"), { recursive: true, force: true });
const dataFiles = [
  "index.html",
  "styles.css",
  "app.js",
  "boot-errors.js",
  "storyboard-core.js",
  "motion-core.js",
  "timeline-core.js",
  "project-recovery-core.js",
  "manual-guide-core.js",
  "pose-core.js",
  "camera-drafting-core.js",
  "multi-camera-core.js",
  "license_activation.html",
];
const args = [
  "-m", "PyInstaller",
  "--noconfirm",
  "--clean",
  "--onedir",
  "--name", "frisframe-server",
  "--target-arch", "arm64",
  "--distpath", path.join(root, "dist-runtime"),
  "--workpath", path.join(root, "build", "pyinstaller-work"),
  "--specpath", path.join(root, "build", "pyinstaller-spec"),
];
for (const filename of dataFiles) args.push("--add-data", `${path.join(root, filename)}:.`);
args.push("--add-data", `${path.join(root, "vendor")}:vendor`, path.join(root, "server.py"));
run(venvPython, args);
fs.chmodSync(path.join(root, "dist-runtime", "frisframe-server", "frisframe-server"), 0o755);
