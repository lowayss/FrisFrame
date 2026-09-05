"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "../..");
const source = path.resolve(process.argv[2] || path.join(root, "release", "mac-arm64", "FrisFrame.app"));
const applicationsDir = "/Applications";
const target = path.join(applicationsDir, "FrisFrame.app");
const trashDir = path.join(os.homedir(), ".Trash");

function fail(message) {
  throw new Error(`[FrisFrame macOS 설치] ${message}`);
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8", windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    fail(`${command} 실행 실패 (${result.status}): ${result.stderr || result.stdout || "출력 없음"}`);
  }
  return result;
}

function isFrisFrameAppName(name) {
  return name === "FrisFrame.app"
    || name.startsWith("FrisFrame.app.")
    || (name.startsWith("FrisFrame") && name.endsWith(".app"));
}

function installedCandidates() {
  return fs.readdirSync(applicationsDir, { withFileTypes: true })
    .filter((entry) => isFrisFrameAppName(entry.name))
    .map((entry) => path.join(applicationsDir, entry.name));
}

function uniqueTrashPath(name) {
  const stamp = new Date().toISOString().replace(/[.:]/g, "-");
  let candidate = path.join(trashDir, `${name}.previous-${stamp}`);
  let suffix = 2;
  while (fs.existsSync(candidate)) {
    candidate = path.join(trashDir, `${name}.previous-${stamp}-${suffix}`);
    suffix += 1;
  }
  return candidate;
}

function frisFrameIsRunning() {
  const result = spawnSync("/usr/bin/pgrep", ["-x", "FrisFrame"], { stdio: "ignore" });
  if (result.error) throw result.error;
  return result.status === 0;
}

function quitRunningFrisFrame() {
  if (!frisFrameIsRunning()) return;
  spawnSync("/usr/bin/osascript", [
    "-e",
    'tell application id "studio.frisframe.desktop" to quit',
  ], { stdio: "ignore" });

  const deadline = Date.now() + 10000;
  while (frisFrameIsRunning()) {
    if (Date.now() >= deadline) {
      fail("실행 중인 FrisFrame이 종료되지 않아 설치를 중단했습니다. 앱을 종료한 뒤 다시 실행하세요.");
    }
    spawnSync("/bin/sleep", ["0.2"], { stdio: "ignore" });
  }
}

function moveToTrash(applicationPath) {
  const destination = uniqueTrashPath(path.basename(applicationPath));
  fs.renameSync(applicationPath, destination);
  return destination;
}

function installStagedApp(stagedApp) {
  try {
    fs.renameSync(stagedApp, target);
  } catch (error) {
    if (error.code !== "EXDEV") throw error;
    run("/usr/bin/ditto", [stagedApp, target]);
    fs.rmSync(stagedApp, { recursive: true, force: true });
  }
}

function main() {
  if (process.platform !== "darwin") fail("이 명령은 macOS에서만 실행할 수 있습니다.");
  if (!fs.existsSync(source) || !fs.statSync(source).isDirectory()) {
    fail(`설치할 앱이 없습니다: ${source}\n먼저 npm run desktop:dir:mac을 실행하세요.`);
  }
  if (path.resolve(source) === path.resolve(target)) {
    fail("설치 원본은 /Applications/FrisFrame.app과 달라야 합니다.");
  }

  const stagingDir = fs.mkdtempSync(path.join(os.tmpdir(), "frisframe-install-"));
  const stagedApp = path.join(stagingDir, "FrisFrame.app");
  const moved = [];
  try {
    run("/usr/bin/ditto", [source, stagedApp]);

    const candidates = installedCandidates();
    if (candidates.length > 0) {
      fs.mkdirSync(trashDir, { recursive: true });
      quitRunningFrisFrame();
    }
    for (const candidate of candidates) moved.push(moveToTrash(candidate));

    installStagedApp(stagedApp);
    const remaining = installedCandidates();
    if (remaining.length !== 1 || remaining[0] !== target) {
      fail(`설치 후 FrisFrame 앱이 하나만 남지 않았습니다: ${remaining.join(", ") || "없음"}`);
    }

    console.log(`설치 완료: ${target}`);
    if (moved.length > 0) {
      console.log(`기존 앱 ${moved.length}개를 휴지통으로 이동했습니다.`);
    }
  } finally {
    if (fs.existsSync(stagingDir)) fs.rmSync(stagingDir, { recursive: true, force: true });
  }
}

main();
