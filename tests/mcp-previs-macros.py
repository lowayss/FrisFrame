#!/usr/bin/env python3
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import mcp_previs_server as previs


def base_blocking():
    return {
        "camera": {
            "x": 0.85,
            "y": 0.50,
            "height": 1.6,
            "panDeg": 180,
            "tiltDeg": -6,
            "focal": 35,
        },
        "items": [
            {"id": "actor-a", "type": "actor", "x": 0.50, "y": 0.50, "facing": 0, "motionEnabled": True},
            {"id": "actor-b", "type": "actor", "x": 0.70, "y": 0.50, "facing": 180, "motionEnabled": True},
        ],
        "motion": {
            "keyframes": [
                {
                    "id": "a-end",
                    "source": "actor-a",
                    "time": 4.0,
                    "pose": {"x": 0.62, "y": 0.55, "facing": 10},
                }
            ]
        },
    }


def main():
    blocking = base_blocking()

    orbit, summary = previs._expand_macros(blocking, [{
        "type": "camera_orbit",
        "start_time": 0,
        "end_time": 3,
        "target_id": "actor-a",
        "degrees": 120,
        "direction": "left",
        "steps": 5,
    }])
    assert summary == [{"type": "camera_orbit", "keyframes": 5}]
    assert len(orbit) == 5
    assert orbit[0]["source_id"] == "camera"
    assert orbit[-1]["time"] == 3.0
    assert all(14 <= key["focal"] <= 135 for key in orbit)
    radius0 = math.hypot(orbit[0]["x"] - 0.5, orbit[0]["y"] - 0.5)
    radius1 = math.hypot(orbit[-1]["x"] - 0.5, orbit[-1]["y"] - 0.5)
    assert abs(radius0 - radius1) < 0.03

    dolly, _ = previs._expand_macros(blocking, [{
        "type": "camera_dolly_and_zoom",
        "start_time": 0,
        "end_time": 2.5,
        "target_id": "actor-a",
        "distance_ratio": 0.55,
        "start_focal": 35,
        "end_focal": 85,
    }])
    assert [key["focal"] for key in dolly] == [35, 85]
    assert math.hypot(dolly[-1]["x"] - 0.5, dolly[-1]["y"] - 0.5) < math.hypot(dolly[0]["x"] - 0.5, dolly[0]["y"] - 0.5)

    approach, _ = previs._expand_macros(blocking, [{
        "type": "pair_approach",
        "start_time": 1,
        "end_time": 3,
        "actor_a_id": "actor-a",
        "actor_b_id": "actor-b",
        "move_fraction": 0.6,
        "face_each_other": True,
    }])
    assert len(approach) == 4
    a_end = next(key for key in approach if key["source_id"] == "actor-a" and key["time"] == 3.0)
    b_end = next(key for key in approach if key["source_id"] == "actor-b" and key["time"] == 3.0)
    assert abs(a_end["x"] - b_end["x"]) < 0.2
    assert "facing" in a_end and "facing" in b_end

    follow, _ = previs._expand_macros(blocking, [{
        "type": "camera_follow_actor",
        "start_time": 0,
        "end_time": 4,
        "target_id": "actor-a",
    }])
    assert follow[0]["time"] == 0.0 and follow[-1]["time"] == 4.0
    assert len(follow) >= 2

    tool_names = {tool["name"] for tool in previs.TOOLS}
    assert {"apply_stage_layout", "apply_motion_timeline", "apply_motion_macros", "apply_previs_plan"}.issubset(tool_names)
    print("MCP previs macro checks passed.")


if __name__ == "__main__":
    main()
