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

            conn = sqlite3.connect(db_path)
            try:
                row = conn.execute(
                    "SELECT revision, kind, owner_license_hash FROM projects WHERE id = ?",
                    (project_id,),
                ).fetchone()
                versions = conn.execute("SELECT revision FROM project_versions WHERE project_id = ?", (project_id,)).fetchall()
            finally:
                conn.close()
            assert row == (2, "managed", "local")
            assert versions == [(1,)]
            print("MCP Server: protocol, schema, clamping, version history, and conflict checks passed")
        finally:
            process.terminate()
            process.wait(timeout=5)
            stderr_output = process.stderr.read()
            assert "DO_NOT_LOG_THIS_PAYLOAD" not in stderr_output


if __name__ == "__main__":
    run_smoke_test()
