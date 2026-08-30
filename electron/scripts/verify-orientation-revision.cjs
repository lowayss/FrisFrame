"use strict";

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
  throw new Error(`패키지 MCP revision 검증을 지원하지 않는 플랫폼입니다: ${process.platform}`);
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
    throw new Error(`MCP 단일 요청 응답 수가 올바르지 않습니다: id=${request.id}, 응답=${lines.length}`);
  }
  const response = JSON.parse(lines[0]);
  if (response.id !== request.id) throw new Error(`MCP 응답 id가 다릅니다: 요청 ${request.id}, 응답 ${response.id}`);
  return response;
}

function parseToolJson(response, label) {
  if (response?.result?.isError !== false) throw new Error(`${label} 호출 실패: ${JSON.stringify(response)}`);
  return JSON.parse(response?.result?.content?.[0]?.text || "null");
}

function expectToolError(response, label, expectedText) {
  if (response?.result?.isError !== true) throw new Error(`${label}가 차단되지 않았습니다: ${JSON.stringify(response)}`);
  const text = String(response?.result?.content?.[0]?.text || "");
  if (!text.includes(expectedText)) throw new Error(`${label} 오류가 예상과 다릅니다: ${text}`);
}

function seedReferenceProject(database) {
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
      const lines = String(result.stdout || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      return JSON.parse(lines.at(-1) || "null");
    }
    lastFailure = result.error || new Error(result.stderr || result.stdout || `${python} exited ${result.status}`);
  }
  throw new Error(`패키지 MCP fixture Python 실행 실패: ${lastFailure?.message || "unknown error"}`);
}

function currentCamera(projectPayload) {
  return projectPayload?.document?.project?.scenes?.[0]?.cuts?.[0]?.blocking?.camera || null;
}

function getProject(executable, database, projectId, id, label) {
  return parseToolJson(runMcpRequest(executable, database, {
    jsonrpc: "2.0",
    id,
    method: "tools/call",
    params: { name: "get_project", arguments: { project_id: projectId } },
  }), label);
}

function main() {
  const executable = packagedMcpExecutable();
  if (!fs.existsSync(executable)) throw new Error(`패키지 MCP 실행 파일이 없습니다: ${executable}`);
  const smokeDir = fs.mkdtempSync(path.join(os.tmpdir(), "frisframe-orientation-revision-"));
  const database = path.join(smokeDir, "frisframe.db");
  try {
    const fixture = seedReferenceProject(database);
    if (!fixture?.project_id || !fixture?.actor_id || Number(fixture?.revision) !== 1) {
      throw new Error(`orientation revision fixture가 올바르지 않습니다: ${JSON.stringify(fixture)}`);
    }
    if (!fixture?.horizon_guard?.project_id || !fixture?.horizon_guard?.actor_id || !fixture?.horizon_guard?.revision) {
      throw new Error(`orientation Horizon fixture가 올바르지 않습니다: ${JSON.stringify(fixture)}`);
    }
    if (!fixture?.keyframed?.project_id || !fixture?.keyframed?.actor_id || !fixture?.keyframed?.revision) {
      throw new Error(`orientation keyframed fixture가 올바르지 않습니다: ${JSON.stringify(fixture)}`);
    }

    const applied = runMcpRequest(executable, database, {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "apply_reference_camera_orientation",
        arguments: {
          project_id: fixture.project_id,
          revision: fixture.revision,
          scene_index: 0,
          cut_index: 0,
          target_id: fixture.actor_id,
          image_x: 0.62,
          image_y: 0.42,
        },
      },
    });
    const appliedPayload = parseToolJson(applied, "패키지 orientation 첫 적용");
    const currentRevision = fixture.revision + 1;
    if (Number(appliedPayload?.revision) !== currentRevision) {
      throw new Error(`첫 orientation revision이 올바르지 않습니다: ${JSON.stringify(appliedPayload)}`);
    }

    const beforeStale = getProject(executable, database, fixture.project_id, 2, "stale apply 전 프로젝트 조회");
    const cameraBefore = JSON.stringify(currentCamera(beforeStale));
    if (Number(beforeStale?.revision) !== currentRevision || !cameraBefore) {
      throw new Error(`stale apply 전 상태가 올바르지 않습니다: ${JSON.stringify(beforeStale)}`);
    }

    const staleApply = runMcpRequest(executable, database, {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "apply_reference_camera_orientation",
        arguments: {
          project_id: fixture.project_id,
          revision: fixture.revision,
          scene_index: 0,
          cut_index: 0,
          target_id: fixture.actor_id,
          image_x: 0.48,
          image_y: 0.55,
        },
      },
    });
    expectToolError(staleApply, "패키지 stale orientation apply", "revision_conflict");

    const afterStale = getProject(executable, database, fixture.project_id, 4, "stale apply 후 프로젝트 조회");
    if (Number(afterStale?.revision) !== currentRevision) {
      throw new Error(`stale orientation apply가 revision을 변경했습니다: ${JSON.stringify(afterStale)}`);
    }
    if (JSON.stringify(currentCamera(afterStale)) !== cameraBefore) {
      throw new Error("stale orientation apply가 camera state를 변경했습니다.");
    }

    const malformedImageObservation = runMcpRequest(executable, database, {
      jsonrpc: "2.0",
      id: 11,
      method: "tools/call",
      params: {
        name: "apply_reference_camera_orientation",
        arguments: {
          project_id: fixture.project_id,
          revision: currentRevision,
          scene_index: 0,
          cut_index: 0,
          target_id: fixture.actor_id,
          image_x: "0.48",
          image_y: 0.55,
        },
      },
    });
    expectToolError(malformedImageObservation, "패키지 문자열 screen observation", "JSON number");
    const afterMalformedImage = getProject(executable, database, fixture.project_id, 12, "문자열 screen observation 후 프로젝트 조회");
    if (Number(afterMalformedImage?.revision) !== currentRevision || JSON.stringify(currentCamera(afterMalformedImage)) !== cameraBefore) {
      throw new Error("문자열 screen observation이 프로젝트를 변경했습니다.");
    }

    const keyframedFixture = fixture.keyframed;
    const keyframedBefore = getProject(executable, database, keyframedFixture.project_id, 5, "문자열 camera override 전 프로젝트 조회");
    const keyframedCameraBefore = JSON.stringify(currentCamera(keyframedBefore));
    const malformedKeyframedOverride = runMcpRequest(executable, database, {
      jsonrpc: "2.0",
      id: 6,
      method: "tools/call",
      params: {
        name: "apply_reference_camera_orientation",
        arguments: {
          project_id: keyframedFixture.project_id,
          revision: keyframedFixture.revision,
          scene_index: 0,
          cut_index: 0,
          target_id: keyframedFixture.actor_id,
          image_x: 0.62,
          image_y: 0.42,
          allow_keyframed_base_camera: "false",
        },
      },
    });
    expectToolError(malformedKeyframedOverride, "패키지 문자열 camera override", "JSON boolean true/false");
    const keyframedAfter = getProject(executable, database, keyframedFixture.project_id, 7, "문자열 camera override 후 프로젝트 조회");
    if (Number(keyframedAfter?.revision) !== Number(keyframedFixture.revision) || JSON.stringify(currentCamera(keyframedAfter)) !== keyframedCameraBefore) {
      throw new Error("문자열 camera override가 keyframed 프로젝트를 변경했습니다.");
    }

    const horizonFixture = fixture.horizon_guard;
    const horizonBefore = getProject(executable, database, horizonFixture.project_id, 8, "Horizon 안전 입력 전 프로젝트 조회");
    const horizonCameraBefore = JSON.stringify(currentCamera(horizonBefore));
    const malformedTolerance = runMcpRequest(executable, database, {
      jsonrpc: "2.0",
      id: 13,
      method: "tools/call",
      params: {
        name: "apply_reference_camera_orientation",
        arguments: {
          project_id: horizonFixture.project_id,
          revision: horizonFixture.revision,
          scene_index: 0,
          cut_index: 0,
          target_id: horizonFixture.actor_id,
          image_x: 0.5,
          image_y: 0.12,
          horizon_tolerance: true,
        },
      },
    });
    expectToolError(malformedTolerance, "패키지 boolean Horizon tolerance", "horizon_tolerance 값은 JSON number");
    const horizonAfterTolerance = getProject(executable, database, horizonFixture.project_id, 14, "boolean Horizon tolerance 후 프로젝트 조회");
    if (Number(horizonAfterTolerance?.revision) !== Number(horizonFixture.revision) || JSON.stringify(currentCamera(horizonAfterTolerance)) !== horizonCameraBefore) {
      throw new Error("boolean Horizon tolerance가 프로젝트를 변경했습니다.");
    }

    const malformedHorizonOverride = runMcpRequest(executable, database, {
      jsonrpc: "2.0",
      id: 9,
      method: "tools/call",
      params: {
        name: "apply_reference_camera_orientation",
        arguments: {
          project_id: horizonFixture.project_id,
          revision: horizonFixture.revision,
          scene_index: 0,
          cut_index: 0,
          target_id: horizonFixture.actor_id,
          image_x: 0.5,
          image_y: 0.12,
          allow_horizon_mismatch: "false",
        },
      },
    });
    expectToolError(malformedHorizonOverride, "패키지 문자열 Horizon override", "JSON boolean true/false");
    const horizonAfter = getProject(executable, database, horizonFixture.project_id, 10, "문자열 Horizon override 후 프로젝트 조회");
    if (Number(horizonAfter?.revision) !== Number(horizonFixture.revision) || JSON.stringify(currentCamera(horizonAfter)) !== horizonCameraBefore) {
      throw new Error("문자열 Horizon override가 프로젝트를 변경했습니다.");
    }

    console.log("FrisFrame packaged orientation safety: stale revision, coerced numbers, and non-boolean overrides rejected without mutation");
  } finally {
    fs.rmSync(smokeDir, { recursive: true, force: true });
  }
}

main();
