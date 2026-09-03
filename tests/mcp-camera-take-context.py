#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    with tempfile.TemporaryDirectory(prefix="frisframe-camera-context-") as directory:
        old_db = os.environ.get("PREVIS_DB_PATH")
        old_owner = os.environ.get("FRISFRAME_MCP_OWNER_LICENSE_HASH")
        os.environ["PREVIS_DB_PATH"] = str(Path(directory) / "camera-context.db")
        os.environ["FRISFRAME_MCP_OWNER_LICENSE_HASH"] = "local"
        try:
            if str(ROOT) not in sys.path:
                sys.path.insert(0, str(ROOT))

            import mcp_server as core
            import mcp_previs_server as base
            import camera_take_context_mcp as extension

            tool_names = {tool.get("name") for tool in base.TOOLS}
            assert "get_camera_take_context" in tool_names

            created = json.loads(core.handle_create_project("Camera Context", "read-only MCP contract"))
            project_id = created["project_id"]
            loaded = json.loads(core.handle_get_project(project_id))
            assert loaded["revision"] == 1
            document = loaded["document"]
            blocking = document["project"]["scenes"][0]["cuts"][0]["blocking"]
            motion = blocking["motion"]
            motion["duration"] = 6
            motion["exportRange"] = {"start": 0.5, "end": 5.5}
            motion["keyframes"] = [
                {
                    "id": "camera-start",
                    "source": "camera",
                    "time": 0.5,
                    "pose": {"x": 0.8, "y": 0.5, "focal": 35},
                    "transition": "linear",
                },
                {
                    "id": "camera-end",
                    "source": "camera",
                    "time": 4.5,
                    "pose": {"x": 0.6, "y": 0.5, "focal": 50},
                    "transition": "smooth",
                },
            ]
            metric_take = {
                "schemaVersion": 1,
                "id": "physical-metric",
                "source": "physical-camera",
                "startTime": 0.5,
                "endTime": 2.5,
                "tracking": {
                    "mode": "webxr",
                    "metric": True,
                    "translation": {"dolly": 0.8, "truck": 0.1, "pedestal": 0, "units": "meters-local-space"},
                },
                "promptSeed": "metric seed",
                "promptPolicy": {
                    "finalPromptOwner": "mcp-client",
                    "metricDistanceAllowed": True,
                    "distanceGuard": "measured local-space only",
                },
            }
            visual_take = {
                "schemaVersion": 1,
                "id": "physical-visual",
                "source": "physical-camera",
                "startTime": 2.5,
                "endTime": 4.5,
                "tracking": {
                    "mode": "visual-flow",
                    "metric": False,
                    "translation": {"dolly": 0.55, "truck": -0.2, "pedestal": 0, "units": "relative-virtual-travel"},
                },
                "promptSeed": "visual direction seed",
                "promptPolicy": {
                    "finalPromptOwner": "mcp-client",
                    "metricDistanceAllowed": False,
                    "distanceGuard": "do not infer exact physical distance",
                },
            }
            motion["cameraOperatorTakes"] = [metric_take, visual_take]
            motion["latestCameraOperatorTakeId"] = visual_take["id"]
            saved = json.loads(core.handle_save_project(project_id, document, 1))
            assert saved["revision"] == 2

            before = json.loads(core.handle_get_project(project_id))
            latest = json.loads(base.call_tool("get_camera_take_context", {
                "project_id": project_id,
                "scene_index": 0,
                "cut_index": 0,
            }))
            after = json.loads(core.handle_get_project(project_id))

            assert before["revision"] == after["revision"] == latest["revision"] == 2
            assert before["document"] == after["document"], "read-only tool must not mutate project state"
            assert latest["schema"] == "frisframe-camera-take-context"
            assert latest["available"] is True
            assert latest["read_only"] is True
            assert latest["final_prompt_owner"] == "mcp-client"
            assert latest["selection"] == {
                "strategy": "latest-id",
                "requested_take_id": None,
                "latest_take_id": "physical-visual",
                "resolved_take_id": "physical-visual",
                "take_count": 2,
            }
            assert latest["take"] == visual_take
            assert latest["prompt_seed"] == visual_take["promptSeed"]
            assert latest["prompt_policy"] == visual_take["promptPolicy"]
            assert latest["prompt_policy"]["metricDistanceAllowed"] is False
            assert latest["camera_timeline"]["keyframe_count"] == 2
            assert latest["camera_timeline"]["first_time"] == 0.5
            assert latest["camera_timeline"]["last_time"] == 4.5
            assert latest["camera_timeline"]["duration"] == 6
            assert latest["camera_timeline"]["export_range"] == {"start": 0.5, "end": 5.5}

            requested = json.loads(base.call_tool("get_camera_take_context", {
                "project_id": project_id,
                "take_id": "physical-metric",
            }))
            assert requested["selection"]["strategy"] == "requested-id"
            assert requested["take"] == metric_take
            assert requested["prompt_policy"]["metricDistanceAllowed"] is True

            fallback_document = json.loads(core.handle_get_project(project_id))["document"]
            fallback_motion = fallback_document["project"]["scenes"][0]["cuts"][0]["blocking"]["motion"]
            fallback_motion["latestCameraOperatorTakeId"] = "stale-missing-id"
            fallback_saved = json.loads(core.handle_save_project(project_id, fallback_document, 2))
            assert fallback_saved["revision"] == 3
            fallback = json.loads(base.call_tool("get_camera_take_context", {"project_id": project_id}))
            assert fallback["selection"]["strategy"] == "last-take-fallback"
            assert fallback["selection"]["resolved_take_id"] == "physical-visual"

            try:
                base.call_tool("get_camera_take_context", {"project_id": project_id, "take_id": "missing"})
            except ValueError as exc:
                assert "Camera Operator Take를 찾을 수 없습니다" in str(exc)
            else:
                raise AssertionError("explicit missing take_id must fail instead of silently selecting another take")

            empty_created = json.loads(core.handle_create_project("No Take", "empty camera take context"))
            empty = json.loads(base.call_tool("get_camera_take_context", {"project_id": empty_created["project_id"]}))
            assert empty["available"] is False
            assert empty["take"] is None
            assert empty["selection"]["strategy"] == "none"
            assert empty["selection"]["take_count"] == 0

            # Keep the imported module referenced so static tooling does not mistake
            # the extension import for an unused setup side effect.
            assert extension.get_camera_take_context
            print("Camera Take Context MCP: latest/requested/fallback selection, policy fidelity, and read-only DB contract passed")
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
