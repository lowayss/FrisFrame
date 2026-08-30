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

function runMcpRequest(executable, database, request) {
  const result = spawnSync(executable, [], {
    encoding: "utf8",
    env: {
      ...process.env,
      PREVIS_DB_PATH: database,
      FRISFRAME_MCP_OWNER_LICENSE_HASH: "local",
      PYTHONUNBUFFERED: "1",
    },
    input: `${JSON.stringify(request)}\n`,
    timeout: 10000,
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`MCP 실행 확인 실패 (${result.status}): ${result.stderr || result.stdout || "출력 없음"}`);
  }

  const lines = String(result.stdout || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length !== 1) {
    throw new Error(
      `MCP 단일 요청 응답 수가 올바르지 않습니다: 요청 id=${request.id}, 응답 ${lines.length}\n` +
      `stdout=${result.stdout || ""}\nstderr=${result.stderr || ""}`,
    );
  }

  let response;
  try {
    response = JSON.parse(lines[0]);
  } catch (error) {
    throw new Error(`MCP 패키지 응답이 JSON이 아닙니다: ${lines[0]}\n${error.message}`);
  }
  if (response.id !== request.id) {
    throw new Error(`MCP 응답 id가 다릅니다: 요청 ${request.id}, 응답 ${response.id}`);
  }
  return response;
}

function verifyMcpExecutable(executable) {
  const smokeDir = fs.mkdtempSync(path.join(os.tmpdir(), "frisframe-mcp-verify-"));
  const database = path.join(smokeDir, "frisframe.db");
  try {
    // Windows PyInstaller stdio executables can drop the final response when
    // several JSON-RPC lines are delivered together immediately before EOF.
    // Exercise each protocol path as an independent request/process while
    // retaining one isolated DB, which also verifies cross-process persistence.
    const initialized = runMcpRequest(executable, database, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "FrisFramePackageVerify", version: packageJson.version },
      },
    });
    if (initialized?.result?.serverInfo?.name !== "FrisFramePrevisAuthoring") {
      throw new Error(`MCP initialize 응답이 올바르지 않습니다: ${JSON.stringify(initialized)}`);
    }

    const listed = runMcpRequest(executable, database, {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
    });
    const toolNames = new Set((listed?.result?.tools || []).map((tool) => tool.name));
    for (const toolName of [
      "list_projects",
      "get_project",
      "apply_stage_layout",
      "apply_motion_timeline",
      "apply_motion_macros",
      "apply_previs_plan",
      "calibrate_reference_camera",
      "apply_reference_camera_calibration",
      "apply_reference_mass_blocks",
      "validate_reference_space",
    ]) {
      if (!toolNames.has(toolName)) throw new Error(`패키지 MCP 도구가 없습니다: ${toolName}`);
    }

    const projectList = runMcpRequest(executable, database, {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "list_projects", arguments: {} },
    });
    if (projectList?.result?.isError !== false) {
      throw new Error(`패키지 MCP list_projects 호출 실패: ${JSON.stringify(projectList)}`);
    }
    const listText = projectList?.result?.content?.[0]?.text;
    let parsedList;
    try {
      parsedList = JSON.parse(listText || "null");
    } catch (error) {
      throw new Error(`패키지 MCP list_projects 결과가 JSON이 아닙니다: ${listText}\n${error.message}`);
    }
    if (!Array.isArray(parsedList) || parsedList.length !== 0) {
      throw new Error(`격리된 MCP DB의 초기 프로젝트 목록이 비어 있지 않습니다: ${listText}`);
    }
    if (!fs.existsSync(database)) {
      throw new Error("패키지 MCP가 격리된 SQLite DB를 초기화하지 못했습니다.");
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
    path.join(resources, "server", "_internal", "reference-validation-ui.js"),
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
    path.join(resources, "server", "_internal", "reference-validation-ui.js"),
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
