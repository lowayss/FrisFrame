"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "../..");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

function requireFiles(files) {
  for (const target of files) {
    if (!fs.existsSync(target)) throw new Error(`패키지 파일이 없습니다: ${target}`);
  }
}

function verifyMcpExecutable(executable) {
  const smokeDir = fs.mkdtempSync(path.join(os.tmpdir(), "frisframe-mcp-verify-"));
  const database = path.join(smokeDir, "frisframe.db");
  try {
    const result = spawnSync(executable, [], {
      encoding: "utf8",
      env: {
        ...process.env,
        PREVIS_DB_PATH: database,
        FRISFRAME_MCP_OWNER_LICENSE_HASH: "local",
        PYTHONUNBUFFERED: "1",
      },
      input: "",
      timeout: 10000,
      windowsHide: true,
    });
    if (result.error) throw result.error;
    if (result.status !== 0) {
      throw new Error(`MCP 실행 확인 실패 (${result.status}): ${result.stderr || result.stdout || "출력 없음"}`);
    }
  } finally {
    fs.rmSync(smokeDir, { recursive: true, force: true });
  }
}

function verifyWindows() {
  const appPath = path.join(root, "release", "win-unpacked");
  const resources = path.join(appPath, "resources", "runtime");
  const licenses = path.join(appPath, "resources", "licenses");
  const mcpExecutable = path.join(resources, "mcp", "frisframe-mcp.exe");
  const required = [
    path.join(appPath, "FrisFrame.exe"),
    path.join(resources, "server", "frisframe-server.exe"),
    path.join(resources, "server", "_internal", "pose-core.js"),
    path.join(resources, "server", "_internal", "camera-drafting-core.js"),
    path.join(resources, "server", "_internal", "timeline-core.js"),
    mcpExecutable,
    path.join(resources, "ffmpeg.exe"),
    path.join(licenses, "FrisFrame-LICENSE.txt"),
    path.join(licenses, "THIRD_PARTY_NOTICES.md"),
  ];
  requireFiles(required);
  verifyMcpExecutable(mcpExecutable);
  const installer = path.join(root, "release", `FrisFrame-${packageJson.version}-x64.exe`);
  if (!fs.existsSync(installer)) throw new Error(`Windows NSIS 설치 파일이 없습니다: ${installer}`);
  console.log(`FrisFrame Windows 패키지 확인: ${installer}`);
}

function verifyMac() {
  const appPath = path.join(root, "release", "mac-arm64", "FrisFrame.app");
  const resources = path.join(appPath, "Contents", "Resources", "runtime");
  const licenses = path.join(appPath, "Contents", "Resources", "licenses");
  const mcpExecutable = path.join(resources, "mcp", "frisframe-mcp");
  const required = [
    path.join(appPath, "Contents", "MacOS", "FrisFrame"),
    path.join(resources, "server", "frisframe-server"),
    path.join(resources, "server", "_internal", "pose-core.js"),
    path.join(resources, "server", "_internal", "camera-drafting-core.js"),
    path.join(resources, "server", "_internal", "timeline-core.js"),
    mcpExecutable,
    path.join(resources, "ffmpeg"),
    path.join(licenses, "FrisFrame-LICENSE.txt"),
    path.join(licenses, "THIRD_PARTY_NOTICES.md"),
  ];
  requireFiles(required);
  fs.accessSync(required[0], fs.constants.X_OK);
  fs.accessSync(required[1], fs.constants.X_OK);
  fs.accessSync(mcpExecutable, fs.constants.X_OK);
  fs.accessSync(path.join(resources, "ffmpeg"), fs.constants.X_OK);
  verifyMcpExecutable(mcpExecutable);
  const plistCheck = spawnSync(
    "/usr/bin/plutil",
    ["-extract", "NSAppTransportSecurity.NSAllowsArbitraryLoads", "raw", path.join(appPath, "Contents", "Info.plist")],
    { encoding: "utf8" },
  );
  if (plistCheck.status !== 0 || plistCheck.stdout.trim() !== "false") {
    throw new Error("앱 전역 네트워크 허용이 꺼져 있지 않습니다.");
  }
  console.log(`FrisFrame macOS 앱 패키지 확인: ${appPath}`);
}

if (process.platform === "win32") verifyWindows();
else if (process.platform === "darwin") verifyMac();
else throw new Error(`패키지 검증을 지원하지 않는 플랫폼입니다: ${process.platform}`);
