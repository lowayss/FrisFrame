#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CORE = ROOT / "mcp_server.py"
PREVIS = ROOT / "mcp_previs_server.py"
QUALITY = ROOT / "quality_check.py"
WORKFLOW_DOC = ROOT / "MCP_FIRST_WORKFLOW.md"
BOUNDARY_TEST = ROOT / "tests" / "mcp-first-product-boundary.test.cjs"
E2E = ROOT / "tests" / "mcp-previs-e2e.py"

# --- Core: add a re-entrant in-memory mutation context so existing scene/motion
# handlers can participate in one outer SQLite transaction without duplicating
# their validation/mutation logic.
core = CORE.read_text(encoding="utf-8")
if "import contextvars\n" not in core:
    anchor = "import sys\nimport json\n"
    if anchor not in core:
        raise SystemExit("mcp_server import anchor changed")
    core = core.replace(anchor, "import sys\nimport json\nimport contextvars\n", 1)

context_anchor = "MCP_TRANSITIONS = {\"smooth\", \"linear\", \"hold\", \"cut\"}\n"
context_insert = context_anchor + "\n# During an atomic previs plan, existing command handlers reuse the outer\n# transaction's in-memory project instead of opening/committing nested DB writes.\n_ATOMIC_MUTATION_CONTEXT = contextvars.ContextVar(\"frisframe_atomic_mutation\", default=None)\n"
if "_ATOMIC_MUTATION_CONTEXT" not in core:
    if context_anchor not in core:
        raise SystemExit("MCP_TRANSITIONS anchor changed")
    core = core.replace(context_anchor, context_insert, 1)

start = core.index("def mutate_project(project_id, revision, mutation):")
end = core.index("\n# JSON Helper to output logs to stderr safely", start)
old_mutate = core[start:end]
new_mutate = '''def mutate_project(project_id, revision, mutation):
    project_id = project_id_or_error(project_id)
    expected_revision = expected_revision_or_error(revision)

    atomic_context = _ATOMIC_MUTATION_CONTEXT.get()
    if atomic_context is not None:
        if project_id != atomic_context["project_id"]:
            raise ValueError("atomic mutation은 하나의 프로젝트에서만 실행할 수 있습니다.")
        if expected_revision != atomic_context["revision"]:
            raise ValueError(
                f"revision_conflict: atomic plan revision은 {atomic_context['revision']}입니다."
            )
        detail = mutation(atomic_context["project"])
        return json.dumps({
            "project_id": project_id,
            "revision": expected_revision,
            "updated_at": atomic_context["updated_at"],
            "message": detail,
        }, ensure_ascii=False)

    conn = connect_db()
    try:
        cursor = conn.cursor()
        cursor.execute("BEGIN IMMEDIATE")
        row = load_project_row(cursor, project_id)
        document = project_document(json.loads(row["content"]))
        detail = mutation(document["project"])
        next_revision, updated_at = save_mutated_document(cursor, row, document, expected_revision)
        conn.commit()
        return json.dumps({
            "project_id": project_id,
            "revision": next_revision,
            "updated_at": updated_at,
            "message": detail,
        }, ensure_ascii=False)
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def mutate_project_atomic(project_id, revision, mutation):
    """Run several existing MCP mutations as one DB transaction/revision."""
    project_id = project_id_or_error(project_id)
    expected_revision = expected_revision_or_error(revision)

    def atomic_mutation(project_obj):
        token = _ATOMIC_MUTATION_CONTEXT.set({
            "project_id": project_id,
            "revision": expected_revision,
            "project": project_obj,
            "updated_at": utc_now(),
        })
        try:
            return mutation(project_obj)
        finally:
            _ATOMIC_MUTATION_CONTEXT.reset(token)

    return mutate_project(project_id, expected_revision, atomic_mutation)
'''
if "def mutate_project_atomic(" not in core:
    core = core[:start] + new_mutate + core[end:]
else:
    raise SystemExit("atomic mutation helper already exists; stop rather than double-patch")
CORE.write_text(core, encoding="utf-8")

# --- MCP-first server: apply the whole plan through the new atomic context.
previs = PREVIS.read_text(encoding="utf-8")
description_old = (
    '"description": "무대 배치 + 명시적 키프레임 + 고수준 모션 매크로를 한 요청에서 순서대로 적용하는 권장 도구입니다. '
    '수동 편집 후에는 최신 revision을 읽고 호출하세요. AI API나 최종 Seedance 프롬프트 생성은 하지 않습니다.",'
)
description_new = (
    '"description": "무대 배치 + 명시적 키프레임 + 고수준 모션 매크로를 한 DB 트랜잭션과 한 revision으로 원자적으로 적용하는 권장 도구입니다. '
    '중간 단계가 실패하면 전체 계획을 롤백합니다. 수동 편집 후에는 최신 revision을 읽고 호출하세요. AI API나 최종 Seedance 프롬프트 생성은 하지 않습니다.",'
)
if description_old not in previs:
    raise SystemExit("apply_previs_plan tool description anchor changed")
previs = previs.replace(description_old, description_new, 1)

plan_start = previs.index('    if name == "apply_previs_plan":')
plan_end = previs.index('    raise ValueError(f"Tool \'{name}\' is not recognized.")', plan_start)
new_plan = '''    if name == "apply_previs_plan":
        project_id = args.get("project_id")
        revision = int(args["revision"])
        stage_operations = list(args.get("stage_operations") or [])
        spatial_guide = args.get("spatial_guide")
        explicit_motion_operations = list(args.get("motion_operations") or [])
        motion_macros = list(args.get("motion_macros") or [])
        if not stage_operations and spatial_guide is None and not explicit_motion_operations and not motion_macros:
            raise ValueError("stage_operations, spatial_guide, motion_operations, motion_macros 중 하나 이상이 필요합니다.")

        scene_index = int(args.get("scene_index", 0))
        cut_index = int(args.get("cut_index", 0))

        def apply_atomic_plan(project_obj):
            steps = []
            if stage_operations or spatial_guide is not None:
                payload = _target_args(args, revision)
                payload["operations"] = stage_operations
                if spatial_guide is not None:
                    payload["spatial_guide"] = spatial_guide
                stage_result = _json_result(core.handle_apply_scene_commands(project_id, payload))
                stage_detail = _json_result(stage_result.get("message", ""))
                if not isinstance(stage_detail, dict):
                    raise ValueError("무대 명령 적용 결과를 읽지 못했습니다.")
                steps.append({"stage": stage_detail})

            motion_operations = list(explicit_motion_operations)
            macro_summaries = []
            if motion_macros:
                _, _, cut = core._scene_cut(project_obj, {
                    "scene_index": scene_index,
                    "cut_index": cut_index,
                })
                blocking = cut["blocking"]
                expanded, macro_summaries = _expand_macros(blocking, motion_macros)
                motion_operations.extend(expanded)

            if motion_operations:
                if len(motion_operations) > 200:
                    raise ValueError("명시적 키프레임 + 매크로 확장 결과가 200개 명령을 초과했습니다.")
                payload = _target_args(args, revision)
                payload["operations"] = motion_operations
                motion_result = _json_result(core.handle_apply_motion_commands(project_id, payload))
                motion_detail = _json_result(motion_result.get("message", ""))
                if not isinstance(motion_detail, dict):
                    raise ValueError("모션 명령 적용 결과를 읽지 못했습니다.")
                if macro_summaries:
                    motion_detail["expanded_macros"] = macro_summaries
                    motion_detail["expanded_keyframes"] = sum(entry["keyframes"] for entry in macro_summaries)
                steps.append({"motion": motion_detail})

            return {
                "steps": steps,
                "expanded_macros": macro_summaries,
            }

        committed = _json_result(core.mutate_project_atomic(project_id, revision, apply_atomic_plan))
        detail = committed.get("message")
        if not isinstance(detail, dict):
            detail = _json_result(detail)
        if not isinstance(detail, dict):
            raise ValueError("원자적 프리비즈 계획 결과를 읽지 못했습니다.")
        return json.dumps({
            "project_id": project_id,
            "revision": committed["revision"],
            "updated_at": committed.get("updated_at"),
            "steps": detail.get("steps", []),
            "expanded_macros": detail.get("expanded_macros", []),
            "message": "프리비즈 계획을 한 revision으로 적용했습니다. 실패 시 전체 계획을 롤백합니다. 수동 수정 후에는 get_project로 revision을 다시 읽으세요.",
        }, ensure_ascii=False)
'''
previs = previs[:plan_start] + new_plan + previs[plan_end:]
PREVIS.write_text(previs, encoding="utf-8")

# --- End-to-end regression: real stdio MCP process + shared DB + simulated UI save.
e2e = r'''#!/usr/bin/env python3
import json
import os
import sqlite3
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main():
    with tempfile.TemporaryDirectory(prefix="frisframe-e2e-") as directory:
        db_path = Path(directory) / "frisframe-e2e.db"
        old_db = os.environ.get("PREVIS_DB_PATH")
        old_owner = os.environ.get("FRISFRAME_MCP_OWNER_LICENSE_HASH")
        os.environ["PREVIS_DB_PATH"] = str(db_path)
        os.environ["FRISFRAME_MCP_OWNER_LICENSE_HASH"] = "local"
        try:
            if str(ROOT) not in sys.path:
                sys.path.insert(0, str(ROOT))
            import mcp_server as core

            created = json.loads(core.handle_create_project("E2E 프리비즈", "UI와 MCP 왕복 검사"))
            project_id = created["project_id"]
            assert created["revision"] == 1

            environment = os.environ.copy()
            process = subprocess.Popen(
                [sys.executable, "mcp_previs_server.py"],
                cwd=ROOT,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                env=environment,
            )
            request_id = 0

            def request(method, params=None):
                nonlocal request_id
                request_id += 1
                payload = {"jsonrpc": "2.0", "id": request_id, "method": method}
                if params is not None:
                    payload["params"] = params
                process.stdin.write(json.dumps(payload, ensure_ascii=False) + "\n")
                process.stdin.flush()
                line = process.stdout.readline().strip()
                assert line, f"MCP process returned EOF for {method}"
                response = json.loads(line)
                assert response.get("id") == request_id
                return response

            def call_tool(name, arguments=None):
                response = request("tools/call", {"name": name, "arguments": arguments or {}})
                result = response["result"]
                text = result["content"][0]["text"]
                return result, text

            try:
                initialized = request("initialize", {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {},
                    "clientInfo": {"name": "FrisFrameE2E", "version": "1"},
                })
                assert initialized["result"]["serverInfo"]["name"] == "FrisFramePrevisAuthoring"
                listed = request("tools/list")
                names = {entry["name"] for entry in listed["result"]["tools"]}
                assert {"get_project", "apply_stage_layout", "apply_motion_timeline", "apply_motion_macros", "apply_previs_plan"}.issubset(names)

                _, initial_text = call_tool("get_project", {"project_id": project_id})
                initial = json.loads(initial_text)
                assert initial["revision"] == 1

                plan_result, plan_text = call_tool("apply_previs_plan", {
                    "project_id": project_id,
                    "revision": 1,
                    "scene_index": 0,
                    "cut_index": 0,
                    "stage_operations": [
                        {"op": "add_dummy", "id": "e2e-actor", "type": "actor", "name": "E2E 배우", "x": 0.30, "y": 0.52, "facing": 15},
                        {"op": "add_dummy", "id": "e2e-table", "type": "prop", "asset_type": "dining-table", "name": "E2E 테이블", "x": 0.63, "y": 0.57},
                        {"op": "update_camera", "x": 0.86, "y": 0.48, "focal": 35, "pan_deg": 180},
                    ],
                    "motion_operations": [
                        {"op": "set_duration", "duration": 4},
                        {"op": "set_export_range", "start": 0, "end": 4},
                    ],
                    "motion_macros": [
                        {"type": "move_subject", "source_id": "e2e-actor", "start_time": 0, "end_time": 3, "end_x": 0.55, "end_y": 0.52, "transition": "linear"},
                    ],
                })
                assert plan_result["isError"] is False, plan_text
                plan = json.loads(plan_text)
                assert plan["revision"] == 2, "one apply_previs_plan call must create exactly one revision"
                assert len(plan["steps"]) == 2
                assert plan["expanded_macros"] == [{"type": "move_subject", "keyframes": 2}]

                _, authored_text = call_tool("get_project", {"project_id": project_id})
                authored = json.loads(authored_text)
                assert authored["revision"] == 2
                core.project_document(authored["document"])
                blocking = authored["document"]["project"]["scenes"][0]["cuts"][0]["blocking"]
                actor = next(item for item in blocking["items"] if item["id"] == "e2e-actor")
                table = next(item for item in blocking["items"] if item["id"] == "e2e-table")
                assert actor["name"] == "E2E 배우" and table["assetType"] == "dining-table"
                assert blocking["camera"]["focal"] == 35
                actor_keys = [key for key in blocking["motion"]["keyframes"] if key["source"] == "e2e-actor"]
                assert [key["time"] for key in actor_keys] == [0.0, 3.0]
                assert actor_keys[-1]["pose"]["x"] == 0.55
                assert blocking["motion"]["duration"] == 4.0
                assert blocking["motion"]["exportRange"] == {"start": 0.0, "end": 4.0}

                # A bad motion command after a valid stage command must roll back the whole plan.
                failed_result, failed_text = call_tool("apply_previs_plan", {
                    "project_id": project_id,
                    "revision": 2,
                    "stage_operations": [
                        {"op": "add_dummy", "id": "rollback-probe", "type": "prop", "name": "남으면 안 됨", "x": 0.4, "y": 0.4},
                    ],
                    "motion_operations": [
                        {"op": "add_keyframe", "source_id": "missing-source", "time": 1},
                    ],
                })
                assert failed_result["isError"] is True
                assert "대상을 찾을 수 없습니다" in failed_text
                _, after_failure_text = call_tool("get_project", {"project_id": project_id})
                after_failure = json.loads(after_failure_text)
                assert after_failure["revision"] == 2
                after_failure_items = after_failure["document"]["project"]["scenes"][0]["cuts"][0]["blocking"]["items"]
                assert all(item["id"] != "rollback-probe" for item in after_failure_items)

                # Simulate a normal UI save against the same managed project DB.
                manual_document = after_failure["document"]
                manual_document["project"]["title"] = "UI에서 수정한 제목"
                manual_document["project"]["scenes"][0]["cuts"][0]["blocking"]["camera"]["focal"] = 50
                manual_saved = json.loads(core.handle_save_project(project_id, manual_document, 2))
                assert manual_saved["revision"] == 3

                # A stale MCP plan must not overwrite the UI save or leak its stage mutation.
                stale_result, stale_text = call_tool("apply_previs_plan", {
                    "project_id": project_id,
                    "revision": 2,
                    "stage_operations": [
                        {"op": "add_dummy", "id": "stale-probe", "type": "actor", "name": "오래된 revision", "x": 0.5, "y": 0.5},
                    ],
                })
                assert stale_result["isError"] is True
                assert "revision_conflict" in stale_text

                _, fresh_text = call_tool("get_project", {"project_id": project_id})
                fresh = json.loads(fresh_text)
                assert fresh["revision"] == 3
                assert fresh["document"]["project"]["title"] == "UI에서 수정한 제목"
                fresh_blocking = fresh["document"]["project"]["scenes"][0]["cuts"][0]["blocking"]
                assert fresh_blocking["camera"]["focal"] == 50
                assert all(item["id"] != "stale-probe" for item in fresh_blocking["items"])

                # Re-read the revision, then continue authoring through MCP.
                final_result, final_text = call_tool("apply_previs_plan", {
                    "project_id": project_id,
                    "revision": 3,
                    "motion_macros": [
                        {"type": "camera_dolly_and_zoom", "target_id": "e2e-actor", "start_time": 0, "end_time": 4, "distance_ratio": 0.7, "start_focal": 50, "end_focal": 85},
                    ],
                })
                assert final_result["isError"] is False, final_text
                final_plan = json.loads(final_text)
                assert final_plan["revision"] == 4

                _, final_project_text = call_tool("get_project", {"project_id": project_id})
                final_project = json.loads(final_project_text)
                assert final_project["revision"] == 4
                core.project_document(final_project["document"])
                final_blocking = final_project["document"]["project"]["scenes"][0]["cuts"][0]["blocking"]
                camera_keys = [key for key in final_blocking["motion"]["keyframes"] if key["source"] == "camera"]
                assert [key["time"] for key in camera_keys] == [0.0, 4.0]
                assert camera_keys[-1]["pose"]["focal"] == 85

                with sqlite3.connect(db_path) as conn:
                    revision = conn.execute("SELECT revision FROM projects WHERE id = ?", (project_id,)).fetchone()[0]
                    versions = [row[0] for row in conn.execute(
                        "SELECT revision FROM project_versions WHERE project_id = ? ORDER BY revision",
                        (project_id,),
                    ).fetchall()]
                assert revision == 4
                assert versions == [1, 2, 3], versions
                print("MCP E2E: atomic plan, rollback, UI save, revision conflict, and resumed authoring passed")
            finally:
                process.stdin.close()
                process.wait(timeout=5)
                stderr = process.stderr.read()
                assert "Traceback" not in stderr
        finally:
            if old_db is None:
                os.environ.pop("PREVIS_DB_PATH", None)
            else:
                os.environ["PREVIS_DB_PATH"] = old_db
            if old_owner is None:
                os.environ.pop("FRISFRAME_MCP_OWNER_LICENSE_HASH", None)
            else:
                os.environ["FRISFRAME_MCP_OWNER_LICENSE_HASH"] = old_owner


if __name__ == "__main__":
    main()
'''
E2E.write_text(e2e, encoding="utf-8")

quality = QUALITY.read_text(encoding="utf-8")
quality_anchor = '    run("MCP 프리비즈 매크로", [sys.executable, "tests/mcp-previs-macros.py"])\n'
quality_replacement = quality_anchor + '    run("MCP 프리비즈 E2E", [sys.executable, "tests/mcp-previs-e2e.py"])\n'
if quality_anchor not in quality:
    raise SystemExit("quality MCP macro anchor changed")
if "mcp-previs-e2e.py" not in quality:
    quality = quality.replace(quality_anchor, quality_replacement, 1)
QUALITY.write_text(quality, encoding="utf-8")

workflow = WORKFLOW_DOC.read_text(encoding="utf-8")
workflow_anchor = "수동 편집과 MCP 편집은 같은 프로젝트 상태를 사용한다. 수동 수정 뒤 MCP를 다시 사용할 때는 `get_project`로 최신 `revision`을 읽고 작업해야 한다.\n"
workflow_replacement = workflow_anchor + "\n`apply_previs_plan`은 무대 배치, 명시적 키, 모션 매크로를 **하나의 DB 트랜잭션과 하나의 revision**으로 적용한다. 중간 명령이 실패하면 앞 단계까지 포함해 전체 계획을 롤백하므로, 한 요청의 절반만 프로젝트에 남지 않는다.\n"
if workflow_anchor not in workflow:
    raise SystemExit("workflow revision paragraph anchor changed")
if "하나의 DB 트랜잭션과 하나의 revision" not in workflow:
    workflow = workflow.replace(workflow_anchor, workflow_replacement, 1)
WORKFLOW_DOC.write_text(workflow, encoding="utf-8")

boundary = BOUNDARY_TEST.read_text(encoding="utf-8")
boundary_anchor = 'assert.match(workflow, /최종 Seedance 프롬프트 생성 UI를 제공하지 않는다/,\n  "workflow doc must say clearly that final prompt UI is not part of FrisFrame");\n'
boundary_insert = boundary_anchor + 'assert.match(workflow, /하나의 DB 트랜잭션과 하나의 revision/,\n  "workflow doc must document atomic apply_previs_plan semantics");\n'
if boundary_anchor not in boundary:
    raise SystemExit("boundary workflow anchor changed")
if "atomic apply_previs_plan semantics" not in boundary:
    boundary = boundary.replace(boundary_anchor, boundary_insert, 1)
BOUNDARY_TEST.write_text(boundary, encoding="utf-8")

print("atomic previs plan hardening prepared")
