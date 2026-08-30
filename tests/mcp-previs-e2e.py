#!/usr/bin/env python3
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
                manual_blocking = manual_document["project"]["scenes"][0]["cuts"][0]["blocking"]
                manual_blocking["camera"]["focal"] = 50
                stale_key_id = next(
                    key["id"] for key in manual_blocking["motion"]["keyframes"]
                    if key["source"] == "e2e-actor"
                )
                manual_blocking["motion"]["keyframes"] = [
                    key for key in manual_blocking["motion"]["keyframes"] if key["id"] != stale_key_id
                ]
                manual_saved = json.loads(core.handle_save_project(project_id, manual_document, 2))
                assert manual_saved["revision"] == 3

                # A stale MCP plan references a key deleted by the newer UI save.
                # Revision conflict must win over mutation-specific "key missing" errors.
                stale_result, stale_text = call_tool("apply_previs_plan", {
                    "project_id": project_id,
                    "revision": 2,
                    "motion_operations": [
                        {"op": "update_keyframe", "id": stale_key_id, "source_id": "e2e-actor", "time": 1.0, "x": 0.44},
                    ],
                })
                assert stale_result["isError"] is True
                assert "revision_conflict" in stale_text
                assert "수정할 동작 키를 찾을 수 없습니다" not in stale_text

                _, fresh_text = call_tool("get_project", {"project_id": project_id})
                fresh = json.loads(fresh_text)
                assert fresh["revision"] == 3
                assert fresh["document"]["project"]["title"] == "UI에서 수정한 제목"
                fresh_blocking = fresh["document"]["project"]["scenes"][0]["cuts"][0]["blocking"]
                assert fresh_blocking["camera"]["focal"] == 50
                assert all(key["id"] != stale_key_id for key in fresh_blocking["motion"]["keyframes"])

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

                conn = sqlite3.connect(db_path)
                try:
                    revision = conn.execute("SELECT revision FROM projects WHERE id = ?", (project_id,)).fetchone()[0]
                    versions = [row[0] for row in conn.execute(
                        "SELECT revision FROM project_versions WHERE project_id = ? ORDER BY revision",
                        (project_id,),
                    ).fetchall()]
                finally:
                    conn.close()
                assert revision == 4
                assert versions == [1, 2, 3], versions
                print("MCP E2E: atomic plan, rollback, UI save, revision conflict, and resumed authoring passed")
            finally:
                try:
                    _stdout_tail, stderr = process.communicate(timeout=5)
                except subprocess.TimeoutExpired as error:
                    process.kill()
                    _stdout_tail, stderr = process.communicate(timeout=5)
                    raise AssertionError("MCP stdio process did not exit after stdin EOF") from error
                assert process.returncode == 0, stderr
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
