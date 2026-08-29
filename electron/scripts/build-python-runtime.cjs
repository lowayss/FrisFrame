"use strict";

const { spawnSync } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const runtimeVersion = "3.12.13-20260510";
const runtimeConfigs = {
  "darwin-arm64": {
    url: "https://github.com/astral-sh/python-build-standalone/releases/download/20260510/cpython-3.12.13%2B20260510-aarch64-apple-darwin-install_only_stripped.tar.gz",
    sha256: "55bc1a5edbc8ac4da0081f4f5731ed2d1ed10c57cb37a820b2a0dbc7cad742e9",
    bundledPython: ["python", "bin", "python3"],
    venvPython: ["bin", "python"],
    serverExecutable: "frisframe-server",
    mcpExecutable: "frisframe-mcp",
    targetArch: "arm64",
  },
  "win32-x64": {
    url: "https://github.com/astral-sh/python-build-standalone/releases/download/20260510/cpython-3.12.13%2B20260510-x86_64-pc-windows-msvc_install_only_stripped.tar.gz",
    sha256: "24168aff2e7d93784c6a436124c4ebb79b076a4e289bde4902c08333507b71d0",
    bundledPython: ["python", "python.exe"],
    venvPython: ["Scripts", "python.exe"],
    serverExecutable: "frisframe-server.exe",
    mcpExecutable: "frisframe-mcp.exe",
    targetArch: null,
  },
};

const platformKey = `${process.platform}-${process.arch}`;
const runtimeConfig = runtimeConfigs[platformKey];
if (!runtimeConfig) {
  throw new Error(`지원하지 않는 데스크톱 빌드 환경입니다: ${platformKey}. macOS arm64 또는 Windows x64에서 빌드하세요.`);
}

const cache = path.join(root, ".runtime-cache");
const archive = path.join(cache, `cpython-${runtimeVersion}-${platformKey}.tar.gz`);
const runtime = path.join(cache, `python-${runtimeVersion}-${platformKey}`);
const bundledPython = path.join(runtime, ...runtimeConfig.bundledPython);
const venv = path.join(root, `.venv-electron-${runtimeVersion}-${platformKey}`);
const venvPython = path.join(venv, ...runtimeConfig.venvPython);

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit", windowsHide: true });
  if (result.status !== 0) throw new Error(`${command} 명령을 완료하지 못했습니다.`);
}

function sha256(filename) {
  return crypto.createHash("sha256").update(fs.readFileSync(filename)).digest("hex");
}

function ensureBundledPython() {
  fs.mkdirSync(cache, { recursive: true });
  if (!fs.existsSync(archive)) {
    run("curl", ["--fail", "--location", "--retry", "3", "--output", archive, runtimeConfig.url]);
  }
  if (sha256(archive) !== runtimeConfig.sha256) {
    throw new Error("다운로드한 Python 런타임의 체크섬이 일치하지 않습니다.");
  }
  if (!fs.existsSync(bundledPython)) {
    fs.rmSync(runtime, { recursive: true, force: true });
    fs.mkdirSync(runtime, { recursive: true });
    run("tar", ["-xzf", archive, "-C", runtime]);
  }
  if (!fs.existsSync(bundledPython)) {
    throw new Error(`Python 런타임 실행 파일을 찾지 못했습니다: ${bundledPython}`);
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
if (process.platform === "darwin") {
  for (const minimum of minimumMacVersions(fs.realpathSync(python))) {
    if (versionGreaterThan(minimum, "12.0")) {
      throw new Error(`Python 런타임이 macOS ${minimum} 이상을 요구해 배포 기준 12.0을 초과합니다.`);
    }
  }
}

if (!fs.existsSync(venvPython)) run(python, ["-m", "venv", venv]);
const probe = spawnSync(venvPython, ["-m", "PyInstaller", "--version"], { cwd: root, stdio: "ignore", windowsHide: true });
if (probe.status !== 0) run(venvPython, ["-m", "pip", "install", "--disable-pip-version-check", "pyinstaller==6.21.0"]);

const distRuntime = path.join(root, "dist-runtime");
fs.mkdirSync(distRuntime, { recursive: true });
const addDataSeparator = process.platform === "win32" ? ";" : ":";

function buildTarget({ name, entrypoint, dataFiles = [], dataDirectories = [] }) {
  fs.rmSync(path.join(distRuntime, name), { recursive: true, force: true });
  const args = [
    "-m", "PyInstaller",
    "--noconfirm",
    "--clean",
    "--onedir",
    "--name", name,
    "--distpath", distRuntime,
    "--workpath", path.join(root, "build", `pyinstaller-work-${name}-${platformKey}`),
    "--specpath", path.join(root, "build", `pyinstaller-spec-${name}-${platformKey}`),
  ];
  if (runtimeConfig.targetArch) args.push("--target-arch", runtimeConfig.targetArch);
  for (const filename of dataFiles) {
    args.push("--add-data", `${path.join(root, filename)}${addDataSeparator}.`);
  }
  for (const [source, destination] of dataDirectories) {
    args.push("--add-data", `${path.join(root, source)}${addDataSeparator}${destination}`);
  }
  args.push(path.join(root, entrypoint));
  run(venvPython, args);
}

const serverDataFiles = [
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
  "license_activation.html",
];

buildTarget({
  name: "frisframe-server",
  entrypoint: "server.py",
  dataFiles: serverDataFiles,
  dataDirectories: [["vendor", "vendor"]],
});

buildTarget({
  name: "frisframe-mcp",
  entrypoint: "mcp_desktop_entry.py",
  dataFiles: ["package.json"],
});

const serverExecutable = path.join(distRuntime, "frisframe-server", runtimeConfig.serverExecutable);
const mcpExecutable = path.join(distRuntime, "frisframe-mcp", runtimeConfig.mcpExecutable);
for (const executable of [serverExecutable, mcpExecutable]) {
  if (!fs.existsSync(executable)) throw new Error(`PyInstaller 실행 파일이 없습니다: ${executable}`);
  if (process.platform !== "win32") fs.chmodSync(executable, 0o755);
}
console.log(`FrisFrame Python 런타임 생성: ${platformKey} · server=${serverExecutable} · mcp=${mcpExecutable}`);
