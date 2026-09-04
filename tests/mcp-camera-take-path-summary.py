#!/usr/bin/env python3
from __future__ import annotations

import math
import os
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    with tempfile.TemporaryDirectory(prefix="frisframe-camera-path-summary-") as directory:
        old_db = os.environ.get("PREVIS_DB_PATH")
        old_owner = os.environ.get("FRISFRAME_MCP_OWNER_LICENSE_HASH")
        os.environ["PREVIS_DB_PATH"] = str(Path(directory) / "path-summary.db")
        os.environ["FRISFRAME_MCP_OWNER_LICENSE_HASH"] = "local"
        try:
            if str(ROOT) not in sys.path:
                sys.path.insert(0, str(ROOT))

            import camera_take_context_mcp as extension

            metric_take = {
                "id": "metric-path",
                "tracking": {
                    "mode": "webxr",
                    "metric": True,
                    "translation": {
                        "dolly": 0.8,
                        "truck": -0.1,
                        "pedestal": 0.2,
                        "units": "meters-local-space",
                    },
                },
                "promptPolicy": {
                    "metricDistanceAllowed": True,
                    "distanceGuard": "measured local-space only",
                },
                "cameraPath": {
                    "schemaVersion": 1,
                    "fingerprint": "fnv1a-test",
                    "keyframes": [
                        {
                            "time": 0.0,
                            "pose": {"x": 0.0, "y": 0.0, "height": 1.6, "panDeg": 350, "tiltDeg": -2, "focal": 35},
                        },
                        {
                            "time": 1.0,
                            "pose": {"x": 0.2, "y": 0.1, "height": 1.7, "panDeg": 5, "tiltDeg": 3, "focal": 50},
                        },
                        {
                            "time": 2.0,
                            "pose": {"x": 0.4, "y": 0.2, "height": 1.8, "panDeg": 20, "tiltDeg": 5, "focal": 50},
                        },
                    ],
                },
            }
            summary = extension._camera_path_summary(metric_take)
            assert summary["available"] is True
            assert summary["source"] == "archived-camera-path"
            assert summary["fingerprint"] == "fnv1a-test"
            assert summary["keyframe_count"] == 3
            assert summary["duration"] == 2.0
            assert summary["start_pose"]["pan_deg"] == 350.0
            assert summary["end_pose"]["pan_deg"] == 20.0
            assert summary["orientation"]["pan_net_deg"] == 30.0, "350→5→20 must unwrap across zero"
            assert summary["orientation"]["pan_travel_deg"] == 30.0
            assert summary["orientation"]["tilt_net_deg"] == 7.0
            assert summary["lens"]["change_mm"] == 15.0
            assert summary["lens"]["travel_mm"] == 15.0
            assert summary["stage_displacement"] == {
                "x": 0.4,
                "y": 0.2,
                "height": 0.2,
                "distance": round(math.sqrt(0.24), 4),
                "units": "frisframe-stage-units",
                "physical_meters": False,
            }
            assert summary["tracked_translation"]["units"] == "meters-local-space"
            assert summary["tracked_translation"]["exact_distance_allowed"] is True
            assert summary["metric_policy"]["camera_path_position_is_physical_meters"] is False
            assert summary["metric_policy"]["metric_distance_allowed"] is True
            action_types = [action["type"] for action in summary["actions"]]
            assert action_types == ["pan", "tilt", "lens", "dolly", "truck", "pedestal"]
            assert next(action for action in summary["actions"] if action["type"] == "dolly")["metric"] is True

            phases = summary["motion_phases"]
            assert phases["phase_count"] == 2
            assert phases["raw_phase_count"] == 2
            assert phases["compacted"] is False
            assert phases["max_phases"] == 12
            first_phase_types = [cue["type"] for cue in phases["phases"][0]["cues"]]
            second_phase_types = [cue["type"] for cue in phases["phases"][1]["cues"]]
            assert first_phase_types == ["pan", "tilt", "lens", "stage-translate"]
            assert second_phase_types == ["pan", "tilt", "stage-translate"]
            assert phases["phases"][0]["cues"][0]["direction"] == "positive"
            first_stage = next(cue for cue in phases["phases"][0]["cues"] if cue["type"] == "stage-translate")
            assert first_stage["units"] == "frisframe-stage-units"
            assert first_stage["physical_meters"] is False, "cameraPath phases must never relabel stage coordinates as meters"

            ordered_take = {
                "id": "ordered-path",
                "cameraPath": {
                    "schemaVersion": 1,
                    "fingerprint": "ordered-test",
                    "keyframes": [
                        {"time": 0.0, "pose": {"x": 0.0, "y": 0.0, "height": 1.6, "panDeg": 0, "tiltDeg": 0, "focal": 35}},
                        {"time": 1.0, "pose": {"x": 0.2, "y": 0.0, "height": 1.6, "panDeg": 20, "tiltDeg": 0, "focal": 35}},
                        {"time": 2.0, "pose": {"x": 0.2, "y": 0.0, "height": 1.6, "panDeg": 20, "tiltDeg": 0, "focal": 50}},
                        {"time": 3.0, "pose": {"x": 0.4, "y": 0.0, "height": 1.6, "panDeg": 5, "tiltDeg": 0, "focal": 50}},
                        {"time": 4.0, "pose": {"x": 0.4, "y": 0.0, "height": 1.6, "panDeg": 5, "tiltDeg": 0, "focal": 50}},
                    ],
                },
            }
            ordered = extension._camera_path_summary(ordered_take)["motion_phases"]
            assert ordered["phase_count"] == 4
            assert [phase["start_time"] for phase in ordered["phases"]] == [0.0, 1.0, 2.0, 3.0]
            assert [phase["end_time"] for phase in ordered["phases"]] == [1.0, 2.0, 3.0, 4.0]
            assert ordered["phases"][0]["cues"][0] == {
                "type": "pan",
                "direction": "positive",
                "net_deg": 20.0,
                "travel_deg": 20.0,
            }
            assert ordered["phases"][1]["cues"][0]["type"] == "lens"
            assert ordered["phases"][1]["cues"][0]["fov_change"] == "narrower"
            assert ordered["phases"][2]["cues"][0] == {
                "type": "pan",
                "direction": "negative",
                "net_deg": -15.0,
                "travel_deg": 15.0,
            }
            assert ordered["phases"][3]["cues"] == [{"type": "hold"}]

            noisy_keys = []
            for index in range(30):
                noisy_keys.append({
                    "time": float(index),
                    "pose": {
                        "x": 0.0,
                        "y": 0.0,
                        "height": 1.6,
                        "panDeg": 10 if index % 2 else 0,
                        "tiltDeg": 0,
                        "focal": 35,
                    },
                })
            compacted = extension._camera_path_summary({
                "id": "compacted-path",
                "cameraPath": {"schemaVersion": 1, "fingerprint": "compacted-test", "keyframes": noisy_keys},
            })["motion_phases"]
            assert compacted["raw_phase_count"] == 29
            assert compacted["phase_count"] == 12
            assert compacted["compacted"] is True
            assert compacted["phases"][0]["start_time"] == 0.0
            assert compacted["phases"][-1]["end_time"] == 29.0

            visual_take = {
                "id": "visual-path",
                "tracking": {
                    "mode": "visual-flow",
                    "metric": False,
                    "translation": {
                        "dolly": 0.55,
                        "truck": -0.2,
                        "pedestal": 0.0,
                        "units": "relative-virtual-travel",
                    },
                },
                "promptPolicy": {
                    "metricDistanceAllowed": False,
                    "distanceGuard": "do not infer exact physical distance",
                },
                "cameraPath": metric_take["cameraPath"],
            }
            visual_summary = extension._camera_path_summary(visual_take)
            assert visual_summary["available"] is True
            assert visual_summary["tracked_translation"]["metric"] is False
            assert visual_summary["tracked_translation"]["exact_distance_allowed"] is False
            assert visual_summary["metric_policy"]["metric_distance_allowed"] is False
            assert visual_summary["metric_policy"]["camera_path_position_is_physical_meters"] is False
            dolly = next(action for action in visual_summary["actions"] if action["type"] == "dolly")
            assert dolly["units"] == "relative-virtual-travel"
            assert dolly["metric"] is False
            visual_stage = next(
                cue
                for phase in visual_summary["motion_phases"]["phases"]
                for cue in phase["cues"]
                if cue["type"] == "stage-translate"
            )
            assert visual_stage["physical_meters"] is False

            legacy = extension._camera_path_summary({"id": "legacy"})
            assert legacy == {"available": False, "reason": "legacy-take-without-camera-path"}

            listed = extension._take_summary(metric_take, 0, "metric-path", "metric-path")
            assert listed["camera_path"] == {
                "available": True,
                "fingerprint": "fnv1a-test",
                "keyframe_count": 3,
                "reason": None,
            }

            print("Camera Take Path Summary MCP: ordered motion phases, compaction, metric guardrails, angle unwrap, and legacy compatibility passed")
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
