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
            assert "list_camera_takes" in tool_names
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
                "createdAt": "2026-09-03T10:00:00Z",
                "startTime": 0.5,
                "endTime": 2.5,
                "duration": 2.0,
                "stabilization": "cinema",
                "tracking": {
                    "mode": "webxr",
                    "metric": True,
                    "samples": 100,
                    "heldTranslationSamples": 5,
                    "confidence": {"average": 0.93},
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
                "createdAt": "2026-09-03T10:01:00Z",
                "startTime": 2.5,
                "endTime": 4.5,
                "duration": 2.0,
                "stabilization": "handheld",
                "tracking": {
                    "mode": "visual-flow",
                    "metric": False,
                    "samples": 80,
                    "heldTranslationSamples": 20,
                    "confidence": {"average": 0.71},
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
            motion["selectedCameraOperatorTakeId"] = metric_take["id"]
            saved = json.loads(core.handle_save_project(project_id, document, 1))
            assert saved["revision"] == 2

            before_list = json.loads(core.handle_get_project(project_id))
            listed = json.loads(base.call_tool("list_camera_takes", {
                "project_id": project_id,
                "scene_index": 0,
                "cut_index": 0,
            }))
            after_list = json.loads(core.handle_get_project(project_id))

            assert before_list["revision"] == after_list["revision"] == listed["revision"] == 2
            assert before_list["document"] == after_list["document"], "take browser must not mutate project state"
            assert listed["schema"] == "frisframe-camera-take-list"
            assert listed["version"] == 1
            assert listed["available"] is True
            assert listed["read_only"] is True
            assert listed["final_prompt_owner"] == "mcp-client"
            assert listed["selected_take_id"] == "physical-metric"
            assert listed["latest_take_id"] == "physical-visual"
            assert listed["selection_priority"] == ["requested-id", "selected-id", "latest-id", "last-take-fallback"]
            assert listed["total_count"] == 2
            assert listed["returned_count"] == 2
            assert [item["id"] for item in listed["items"]] == ["physical-visual", "physical-metric"]
            assert listed["items"][0]["record_index"] == 1
            assert listed["items"][0]["is_latest"] is True
            assert listed["items"][0]["is_selected"] is False
            assert listed["items"][0]["tracking"] == {
                "mode": "visual-flow",
                "metric": False,
                "samples": 80,
                "confidence_average": 0.71,
                "held_translation_samples": 20,
                "held_translation_ratio": 0.25,
                "translation_units": "relative-virtual-travel",
            }
            assert listed["items"][0]["prompt_seed"] == "visual direction seed"
            assert listed["items"][0]["metric_distance_allowed"] is False
            assert listed["items"][1]["is_selected"] is True
            assert listed["items"][1]["is_latest"] is False
            assert listed["items"][1]["tracking"]["metric"] is True
            assert listed["items"][1]["tracking"]["held_translation_ratio"] == 0.05
            assert listed["items"][1]["metric_distance_allowed"] is True
            assert listed["camera_timeline"]["keyframe_count"] == 2
            assert listed["next_step"]["tool"] == "get_camera_take_context"
            assert listed["next_step"]["argument"] == "take_id"

            limited = json.loads(base.call_tool("list_camera_takes", {
                "project_id": project_id,
                "limit": 1,
            }))
            assert limited["total_count"] == 2
            assert limited["returned_count"] == 1
            assert [item["id"] for item in limited["items"]] == ["physical-visual"]
            assert limited["selected_take_id"] == "physical-metric", "selection metadata must remain visible even when the selected Take is outside limit"

            before = json.loads(core.handle_get_project(project_id))
            selected = json.loads(base.call_tool("get_camera_take_context", {
                "project_id": project_id,
                "scene_index": 0,
                "cut_index": 0,
            }))
            after = json.loads(core.handle_get_project(project_id))

            assert before["revision"] == after["revision"] == selected["revision"] == 2
            assert before["document"] == after["document"], "read-only tool must not mutate project state"
            assert selected["schema"] == "frisframe-camera-take-context"
            assert selected["available"] is True
            assert selected["read_only"] is True
            assert selected["final_prompt_owner"] == "mcp-client"
            assert selected["selection"] == {
                "strategy": "selected-id",
                "requested_take_id": None,
                "selected_take_id": "physical-metric",
                "latest_take_id": "physical-visual",
                "resolved_take_id": "physical-metric",
                "take_count": 2,
            }
            assert selected["take"] == metric_take
            assert selected["prompt_seed"] == metric_take["promptSeed"]
            assert selected["prompt_policy"] == metric_take["promptPolicy"]
            assert selected["prompt_policy"]["metricDistanceAllowed"] is True
            assert selected["camera_timeline"]["keyframe_count"] == 2
            assert selected["camera_timeline"]["first_time"] == 0.5
            assert selected["camera_timeline"]["last_time"] == 4.5
            assert selected["camera_timeline"]["duration"] == 6
            assert selected["camera_timeline"]["export_range"] == {"start": 0.5, "end": 5.5}

            requested = json.loads(base.call_tool("get_camera_take_context", {
                "project_id": project_id,
                "take_id": "physical-visual",
            }))
            assert requested["selection"]["strategy"] == "requested-id"
            assert requested["selection"]["selected_take_id"] == "physical-metric"
            assert requested["take"] == visual_take
            assert requested["prompt_policy"]["metricDistanceAllowed"] is False

            stale_selected_document = json.loads(core.handle_get_project(project_id))["document"]
            stale_selected_motion = stale_selected_document["project"]["scenes"][0]["cuts"][0]["blocking"]["motion"]
            stale_selected_motion["selectedCameraOperatorTakeId"] = "stale-selected-id"
            stale_selected_saved = json.loads(core.handle_save_project(project_id, stale_selected_document, 2))
            assert stale_selected_saved["revision"] == 3
            latest_fallback = json.loads(base.call_tool("get_camera_take_context", {"project_id": project_id}))
            assert latest_fallback["selection"]["strategy"] == "latest-id"
            assert latest_fallback["selection"]["selected_take_id"] == "stale-selected-id"
            assert latest_fallback["selection"]["resolved_take_id"] == "physical-visual"

            stale_both_document = json.loads(core.handle_get_project(project_id))["document"]
            stale_both_motion = stale_both_document["project"]["scenes"][0]["cuts"][0]["blocking"]["motion"]
            stale_both_motion["latestCameraOperatorTakeId"] = "stale-latest-id"
            stale_both_saved = json.loads(core.handle_save_project(project_id, stale_both_document, 3))
            assert stale_both_saved["revision"] == 4
            last_fallback = json.loads(base.call_tool("get_camera_take_context", {"project_id": project_id}))
            assert last_fallback["selection"]["strategy"] == "last-take-fallback"
            assert last_fallback["selection"]["resolved_take_id"] == "physical-visual"

            try:
                base.call_tool("get_camera_take_context", {"project_id": project_id, "take_id": "missing"})
            except ValueError as exc:
                assert "Camera Operator Take를 찾을 수 없습니다" in str(exc)
            else:
                raise AssertionError("explicit missing take_id must fail instead of silently selecting another take")

            empty_created = json.loads(core.handle_create_project("No Take", "empty camera take context"))
            empty_list = json.loads(base.call_tool("list_camera_takes", {"project_id": empty_created["project_id"]}))
            assert empty_list["available"] is False
            assert empty_list["selected_take_id"] is None
            assert empty_list["items"] == []
            assert empty_list["total_count"] == 0
            assert empty_list["returned_count"] == 0

            empty = json.loads(base.call_tool("get_camera_take_context", {"project_id": empty_created["project_id"]}))
            assert empty["available"] is False
            assert empty["take"] is None
            assert empty["selection"]["strategy"] == "none"
            assert empty["selection"]["selected_take_id"] is None
            assert empty["selection"]["take_count"] == 0

            assert extension.list_camera_takes
            assert extension.get_camera_take_context
            print("Camera Take MCP: requested > selected > latest > last fallback, browser policy fidelity, and read-only DB contract passed")
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
