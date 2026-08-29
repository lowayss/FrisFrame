#!/usr/bin/env python3
import json
import os
import sqlite3
import subprocess
import sys
import tempfile
from pathlib import Path


def run_smoke_test():
    print("Running MCP Server stdio integration test...")
    with tempfile.TemporaryDirectory(prefix="frisframe-mcp-") as directory:
        db_path = Path(directory) / "mcp-test.db"
        environment = os.environ.copy()
        environment["PREVIS_DB_PATH"] = str(db_path)
        process = subprocess.Popen(
            [sys.executable, "mcp_server.py"],
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
            process.stdin.write(json.dumps(payload) + "\n")
            process.stdin.flush()
            response = json.loads(process.stdout.readline().strip())
            assert response.get("id") == request_id
            return response

        def call_tool(name, arguments=None):
            response = request("tools/call", {"name": name, "arguments": arguments or {}})
            result = response["result"]
            text = result["content"][0]["text"]
            return result, text

        try:
            process.stdin.write("{broken json\n")
            process.stdin.flush()
            parse_error = json.loads(process.stdout.readline().strip())
            assert parse_error["error"]["code"] == -32700

            initialized = request("initialize", {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "SmokeTestClient", "version": "1.0"},
            })
            assert "capabilities" in initialized["result"]

            listed = request("tools/list")
            tools = listed["result"]["tools"]
            tool_names = [tool["name"] for tool in tools]
            expected = {
                "list_projects",
                "get_project",
                "create_project",
                "save_project",
                "create_cut",
                "update_camera_blocking",
                "add_actor_to_cut",
                "apply_scene_commands",
            }
            assert expected.issubset(tool_names)

            unknown_method = request("unknown/method")
            assert unknown_method["error"]["code"] == -32601

            unknown_tool_result, _ = call_tool("unknown_tool", {"secret": "DO_NOT_LOG_THIS_PAYLOAD"})
            assert unknown_tool_result["isError"] is True

            create_result, create_text = call_tool("create_project", {
                "title": "MCP 통합 검사",
                "logline": "수정 이력과 충돌을 검사합니다.",
            })
            assert create_result["isError"] is False
            created = json.loads(create_text)
            project_id = created["project_id"]
            assert created["revision"] == 1

            _, get_text = call_tool("get_project", {"project_id": project_id})
            loaded = json.loads(get_text)
            assert loaded["revision"] == 1
            assert loaded["document"]["schemaVersion"] == 11
            assert loaded["document"]["project"]["title"] == "MCP 통합 검사"

            future_document = json.loads(json.dumps(loaded["document"]))
            future_document["schemaVersion"] = 999
            future_result, future_text = call_tool("save_project", {
                "project_id": project_id,
                "revision": 1,
                "content": future_document,
            })
            assert future_result["isError"] is True
            assert "새로운 프로젝트 형식" in future_text

            conn = sqlite3.connect(db_path)
            try:
                content = conn.execute("SELECT content FROM projects WHERE id = ?", (project_id,)).fetchone()[0]
                conn.execute(
                    "INSERT INTO projects (id, title, content, owner_license_hash, kind, revision, updated_at) "
                    "VALUES ('foreign1', '다른 사용자', ?, 'other-owner', 'managed', 1, '2026-01-01T00:00:00Z')",
                    (content,),
                )
                conn.commit()
            finally:
                conn.close()
            _, scoped_list_text = call_tool("list_projects")
            scoped_projects = json.loads(scoped_list_text)
            assert [entry["id"] for entry in scoped_projects] == [project_id]

            update_result, update_text = call_tool("update_camera_blocking", {
                "project_id": project_id,
                "revision": 1,
                "scene_index": 0,
                "cut_index": 0,
                "height": 99,
                "x": 1.5,
            })
            assert update_result["isError"] is False
            assert json.loads(update_text)["revision"] == 2

            _, updated_text = call_tool("get_project", {"project_id": project_id})
            updated = json.loads(updated_text)
            camera = updated["document"]["project"]["scenes"][0]["cuts"][0]["blocking"]["camera"]
            assert updated["revision"] == 2
            assert camera["height"] == 35.0
            assert camera["x"] == 0.98

            conflict_result, conflict_text = call_tool("update_camera_blocking", {
                "project_id": project_id,
                "revision": 1,
                "height": 2,
            })
            assert conflict_result["isError"] is True
            assert "revision_conflict" in conflict_text

            apply_result, apply_text = call_tool("apply_scene_commands", {
                "project_id": project_id,
                "revision": 2,
                "scene_index": 0,
                "cut_index": 0,
                "spatial_guide": {
                    "source_name": "set-reference.jpg",
                    "status": "applied",
                    "anchors": [
                        {
                            "id": "back-wall",
                            "label": "후면 벽",
                            "kind": "set",
                            "world_x_m": 0,
                            "world_z_m": -3,
                            "dimensions_m": {"width": 10.2, "height": 3, "depth": 0.18},
                            "depth_layer": "background",
                        },
                    ],
                    "depth_layers": [
                        {"id": "background", "label": "배경", "order": 0, "distance_m": 3},
                    ],
                },
                "operations": [
                    {
                        "op": "add_dummy",
                        "id": "image-actor",
                        "type": "actor",
                        "dummy_type": "child",
                        "name": "이미지 인물",
                        "x": 0.22,
                        "y": 0.44,
                        "height": 0.8,
                        "physical_dimensions_m": {"width": 0.54, "height": 1.78, "depth": 0.36},
                        "world_x_m": -1.1,
                        "world_z_m": 1.8,
                        "anchor_id": "person-a",
                        "rotation": 35,
                        "color": "#ff6262",
                    },
                    {
                        "op": "add_dummy",
                        "id": "image-table",
                        "type": "prop",
                        "asset_type": "dining-table",
                        "name": "이미지 테이블",
                        "x": 0.7,
                        "y": 0.6,
                        "height": 1.2,
                        "physical_dimensions_m": {"width": 1.8, "height": 0.82, "depth": 1.05},
                        "world_x_m": 2.0,
                        "rotation": 90,
                        "scale_y": 1.3,
                        "color": "#65d66f",
                    },
                    {"op": "update_dummy", "id": "image-actor", "x": 0.3, "rotation": 45},
                ],
            })
            assert apply_result["isError"] is False
            applied = json.loads(apply_text)
            assert applied["revision"] == 3

            _, applied_project_text = call_tool("get_project", {"project_id": project_id})
            applied_project = json.loads(applied_project_text)
            applied_items = applied_project["document"]["project"]["scenes"][0]["cuts"][0]["blocking"]["items"]
            actor = next(item for item in applied_items if item["id"] == "image-actor")
            table = next(item for item in applied_items if item["id"] == "image-table")
            assert actor["x"] == 0.3 and actor["verticalOffset"] == 0.8 and actor["facing"] == 45
            assert actor["dummyType"] == "child" and actor["color"] == "#ff6262"
            assert actor["referenceAnchorId"] == "person-a"
            assert actor["referenceDimensionsM"] == {"width": 0.54, "height": 1.78, "depth": 0.36}
            assert table["assetType"] == "dining-table" and table["mountedHeight"] == 1.2
            assert table["scaleY"] == 1.3 and table["facing"] == 90
            assert table["referenceDimensionsM"] == {"width": 1.8, "height": 0.82, "depth": 1.05}
            guide = applied_project["document"]["project"]["scenes"][0]["cuts"][0]["blocking"]["spatialGuide"]
            assert guide["sourceName"] == "set-reference.jpg"
            assert guide["anchors"][0]["worldZ"] == -3.0

            conn = sqlite3.connect(db_path)
            try:
                row = conn.execute(
                    "SELECT revision, kind, owner_license_hash FROM projects WHERE id = ?",
                    (project_id,),
                ).fetchone()
                versions = conn.execute("SELECT revision FROM project_versions WHERE project_id = ?", (project_id,)).fetchall()
            finally:
                conn.close()
            assert row == (3, "managed", "local")
            assert sorted(versions) == [(1,), (2,)]
            print("MCP Server: protocol, schema, clamping, version history, and conflict checks passed")
        finally:
            process.terminate()
            process.wait(timeout=5)
            stderr_output = process.stderr.read()
            assert "DO_NOT_LOG_THIS_PAYLOAD" not in stderr_output


if __name__ == "__main__":
    run_smoke_test()
