"use strict";

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const venv = path.join(root, ".venv-electron");
const python = process.env.FRISFRAME_BUILD_PYTHON || "python3.11";
const venvPython = path.join(venv, "bin", "python");

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status || 1);
}

if (!fs.existsSync(venvPython)) run(python, ["-m", "venv", venv]);
let probe = spawnSync(venvPython, ["-m", "PyInstaller", "--version"], { cwd: root, stdio: "ignore" });
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
  "project-recovery-core.js",
  "manual-guide-core.js",
  "pose-core.js",
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
