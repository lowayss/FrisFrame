#!/usr/bin/env python3
"""Keep Python Reference Space projection signs aligned with spatial-scale-core.js."""

from __future__ import annotations

import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import reference_space_core as space  # noqa: E402


def close(actual, expected, tolerance=1e-9):
    assert abs(float(actual) - float(expected)) < tolerance, (actual, expected)


def main():
    front_center = space.project_world_point_to_frame(
        {"x": 0, "y": 0, "z": 0},
        {"x": 10, "y": 0, "z": 0},
        pan_deg=0,
        tilt_deg=0,
        focal_mm=50,
        sensor_width_mm=36,
        aspect=16 / 9,
    )
    close(front_center["frame_x"], 0.5)
    close(front_center["frame_y"], 0.5)
    assert front_center["in_frame"] is True

    quarter_right = space.project_world_point_to_frame(
        {"x": 0, "y": 0, "z": 0},
        {"x": 10, "y": 0, "z": 1.8},
        pan_deg=0,
        tilt_deg=0,
        focal_mm=50,
        sensor_width_mm=36,
        aspect=16 / 9,
    )
    close(quarter_right["frame_x"], 0.75)
    close(quarter_right["frame_y"], 0.5)
    assert quarter_right["frame_x"] > front_center["frame_x"], "camera-local right must increase normalized X"

    quarter_up = space.project_world_point_to_frame(
        {"x": 0, "y": 0, "z": 0},
        {"x": 10, "y": 1.0125, "z": 0},
        pan_deg=0,
        tilt_deg=0,
        focal_mm=50,
        sensor_width_mm=36,
        aspect=16 / 9,
    )
    close(quarter_up["frame_y"], 0.25)
    assert quarter_up["frame_y"] < front_center["frame_y"], "camera-local up must decrease normalized Y"

    tilted_basis = space.camera_basis(270, -10)
    along_tilted_forward = space.project_world_point_to_frame(
        {"x": 2, "y": 1.6, "z": 4},
        {
            "x": 2 + tilted_basis["forward"]["x"] * 10,
            "y": 1.6 + tilted_basis["forward"]["y"] * 10,
            "z": 4 + tilted_basis["forward"]["z"] * 10,
        },
        pan_deg=270,
        tilt_deg=-10,
        focal_mm=35,
        sensor_width_mm=36,
        aspect=16 / 9,
    )
    close(along_tilted_forward["frame_x"], 0.5)
    close(along_tilted_forward["frame_y"], 0.5)

    behind = space.project_world_point_to_frame(
        {"x": 0, "y": 0, "z": 0},
        {"x": -1, "y": 0, "z": 0},
        pan_deg=0,
        tilt_deg=0,
        focal_mm=50,
        sensor_width_mm=36,
        aspect=16 / 9,
    )
    assert behind["in_front"] is False
    assert behind["frame_x"] is None
    assert behind["frame_y"] is None

    print("reference-space-projection: Python center/right/up/pan-tilt/behind signs match JS contract")


if __name__ == "__main__":
    main()
