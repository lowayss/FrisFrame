"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "../..");

function packagedMcpExecutable() {
  if (process.platform === "win32") {
    return path.join(root, "release", "win-unpacked", "resources", "runtime", "mcp", "frisframe-mcp.exe");
  }
  if (process.platform === "darwin") {
    return path.join(root, "release", "mac-arm64", "FrisFrame.app", "Contents", "Resources", "runtime", "mcp", "frisframe-mcp");
  }
  throw new Error(`패키지 MCP 검증을 지원하지 않는 플랫폼입니다: ${process.platform}`);
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
    throw new Error(`패키지 MCP 실행 실패 (${result.status}): ${result.stderr || result.stdout || "출력 없음"}`);
  }
  const lines = String(result.stdout || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length !== 1) {
    throw new Error(`패키지 MCP 응답 수가 올바르지 않습니다: ${lines.length}\n${result.stdout || ""}`);
  }
  const response = JSON.parse(lines[0]);
  if (response.id !== request.id) throw new Error(`MCP 응답 id 불일치: ${response.id} !== ${request.id}`);
  return response;
}

function parseToolJson(response, label) {
  if (response?.result?.isError !== false) {
    throw new Error(`${label} 호출 실패: ${JSON.stringify(response)}`);
  }
  return JSON.parse(response?.result?.content?.[0]?.text || "null");
}

function seedProject(database) {
  const script = path.join(root, "tests", "seed-packaged-reference-project.py");
  const candidates = [process.env.PYTHON, "python3", "python"].filter(Boolean);
  let lastFailure = null;
  for (const python of candidates) {
    const result = spawnSync(python, [script], {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        PREVIS_DB_PATH: database,
        FRISFRAME_MCP_OWNER_LICENSE_HASH: "local",
        PYTHONUNBUFFERED: "1",
      },
      timeout: 10000,
      windowsHide: true,
    });
    if (!result.error && result.status === 0) {
      const lines = String(result.stdout || "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      return JSON.parse(lines.at(-1) || "null");
    }
    lastFailure = result.error || new Error(result.stderr || result.stdout || `${python} exited ${result.status}`);
  }
  throw new Error(`Camera Take 패키지 fixture 생성 실패: ${lastFailure?.message || "unknown"}`);
}

function main() {
  const executable = packagedMcpExecutable();
  if (!fs.existsSync(executable)) throw new Error(`패키지 MCP 실행 파일이 없습니다: ${executable}`);

  const smokeDir = fs.mkdtempSync(path.join(os.tmpdir(), "frisframe-camera-take-mcp-"));
  const database = path.join(smokeDir, "frisframe.db");
  try {
    const fixture = seedProject(database);
    if (!fixture?.project_id || !Number.isFinite(Number(fixture?.revision))) {
      throw new Error(`Camera Take 패키지 fixture가 올바르지 않습니다: ${JSON.stringify(fixture)}`);
    }

    const listedTools = runMcpRequest(executable, database, {
      jsonrpc: "2.0",
      id: 101,
      method: "tools/list",
    });
    const toolNames = new Set((listedTools?.result?.tools || []).map((tool) => tool.name));
    assert.ok(toolNames.has("list_camera_takes"), "패키지 MCP manifest에 list_camera_takes가 없습니다.");
    assert.ok(toolNames.has("get_camera_take_context"), "패키지 MCP manifest에 get_camera_take_context가 없습니다.");

    const before = parseToolJson(runMcpRequest(executable, database, {
      jsonrpc: "2.0",
      id: 102,
      method: "tools/call",
      params: { name: "get_project", arguments: { project_id: fixture.project_id } },
    }), "Camera Take 읽기 전 프로젝트");

    const browser = parseToolJson(runMcpRequest(executable, database, {
      jsonrpc: "2.0",
      id: 103,
      method: "tools/call",
      params: { name: "list_camera_takes", arguments: { project_id: fixture.project_id } },
    }), "패키지 Camera Take Browser");

    const context = parseToolJson(runMcpRequest(executable, database, {
      jsonrpc: "2.0",
      id: 104,
      method: "tools/call",
      params: { name: "get_camera_take_context", arguments: { project_id: fixture.project_id } },
    }), "패키지 Camera Take Context");

    const after = parseToolJson(runMcpRequest(executable, database, {
      jsonrpc: "2.0",
      id: 105,
      method: "tools/call",
      params: { name: "get_project", arguments: { project_id: fixture.project_id } },
    }), "Camera Take 읽기 후 프로젝트");

    assert.equal(browser.schema, "frisframe-camera-take-list");
    assert.equal(browser.version, 1);
    assert.equal(browser.read_only, true);
    assert.equal(browser.final_prompt_owner, "mcp-client");
    assert.equal(browser.available, false, "기본 패키지 fixture에는 Physical Camera Take가 없어야 합니다.");
    assert.equal(browser.total_count, 0);
    assert.equal(browser.returned_count, 0);
    assert.deepEqual(browser.items, []);
    assert.equal(browser.next_step?.tool, "get_camera_take_context");
    assert.equal(browser.next_step?.argument, "take_id");
    assert.equal(Number(browser.revision), Number(fixture.revision));

    assert.equal(context.schema, "frisframe-camera-take-context");
    assert.equal(context.version, 1);
    assert.equal(context.read_only, true);
    assert.equal(context.final_prompt_owner, "mcp-client");
    assert.equal(context.available, false, "기본 패키지 fixture에는 Physical Camera Take가 없어야 합니다.");
    assert.equal(context.selection?.strategy, "none");
    assert.equal(Number(context.revision), Number(fixture.revision));
    assert.equal(Number(before.revision), Number(after.revision), "Camera Take 조회가 revision을 변경했습니다.");
    assert.deepEqual(before.document, after.document, "Camera Take 조회가 프로젝트 문서를 변경했습니다.");

    console.log(`Packaged Camera Take Browser/Context MCP verified: ${process.platform}`);
  } finally {
    fs.rmSync(smokeDir, { recursive: true, force: true });
  }
}

main();
