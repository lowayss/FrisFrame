#!/usr/bin/env python3
"""Keep Python Reference Space projection numerically aligned with spatial-scale-core.js."""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import reference_space_core as space  # noqa: E402


def close(actual, expected, tolerance=1e-9):
    assert abs(float(actual) - float(expected)) < tolerance, (actual, expected)


def python_projection(case):
    return space.project_world_point_to_frame(
        case["cameraPosition"],
        case["worldPoint"],
        pan_deg=case["panDeg"],
        tilt_deg=case["tiltDeg"],
        focal_mm=case["focalMm"],
        sensor_width_mm=case["sensorWidthMm"],
        aspect=case["aspect"],
    )


def javascript_projections(cases):
    node = shutil.which("node")
    if not node:
        raise AssertionError("Node.js is required for JS/Python Reference Space projection parity")
    script = r"""
const fs = require('node:fs');
const spatial = require('./spatial-scale-core.js');
const cases = JSON.parse(fs.readFileSync(0, 'utf8'));
const results = cases.map((entry) => spatial.projectWorldPointToFrame(entry));
process.stdout.write(JSON.stringify(results));
"""
    completed = subprocess.run(
        [node, "-e", script],
        cwd=ROOT,
        input=json.dumps(cases),
        text=True,
        capture_output=True,
        check=False,
    )
    if completed.returncode:
        raise AssertionError(f"JS projection parity runner failed: {completed.stderr}")
    return json.loads(completed.stdout)


def assert_runtime_parity(cases):
    js_results = javascript_projections(cases)
    assert len(js_results) == len(cases)
    for index, (case, js_result) in enumerate(zip(cases, js_results)):
        py_result = python_projection(case)
        assert py_result["in_front"] is bool(js_result["inFront"]), (index, py_result, js_result)
        assert py_result["in_frame"] is bool(js_result["inFrame"]), (index, py_result, js_result)
        for py_key, js_key in (
            ("frame_x", "frameX"),
            ("frame_y", "frameY"),
            ("depth_m", "depthM"),
            ("right_m", "rightM"),
            ("up_m", "upM"),
        ):
            py_value = py_result[py_key]
            js_value = js_result[js_key]
            if py_value is None or js_value is None:
                assert py_value is None and js_value is None, (index, py_key, py_value, js_value)
            else:
                close(py_value, js_value, 1e-9)


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

    parity_cases = [
        {
            "cameraPosition": {"x": 0, "y": 0, "z": 0},
            "worldPoint": {"x": 10, "y": 0, "z": 0},
            "panDeg": 0,
            "tiltDeg": 0,
            "focalMm": 50,
            "sensorWidthMm": 36,
            "aspect": 16 / 9,
        },
        {
            "cameraPosition": {"x": 0, "y": 0, "z": 0},
            "worldPoint": {"x": 10, "y": 0, "z": 1.8},
            "panDeg": 0,
            "tiltDeg": 0,
            "focalMm": 50,
            "sensorWidthMm": 36,
            "aspect": 16 / 9,
        },
        {
            "cameraPosition": {"x": 0, "y": 0, "z": 0},
            "worldPoint": {"x": 10, "y": 1.0125, "z": 0},
            "panDeg": 0,
            "tiltDeg": 0,
            "focalMm": 50,
            "sensorWidthMm": 36,
            "aspect": 16 / 9,
        },
        {
            "cameraPosition": {"x": 2, "y": 1.6, "z": 4},
            "worldPoint": {
                "x": 2 + tilted_basis["forward"]["x"] * 10,
                "y": 1.6 + tilted_basis["forward"]["y"] * 10,
                "z": 4 + tilted_basis["forward"]["z"] * 10,
            },
            "panDeg": 270,
            "tiltDeg": -10,
            "focalMm": 35,
            "sensorWidthMm": 36,
            "aspect": 16 / 9,
        },
        {
            "cameraPosition": {"x": -3.2, "y": 2.1, "z": 5.4},
            "worldPoint": {"x": 4.8, "y": 0.7, "z": -1.3},
            "panDeg": 318,
            "tiltDeg": -7.5,
            "focalMm": 62,
            "sensorWidthMm": 36,
            "aspect": 4 / 3,
        },
        {
            "cameraPosition": {"x": 1.1, "y": 1.4, "z": -2.3},
            "worldPoint": {"x": -5.2, "y": 3.0, "z": 6.7},
            "panDeg": 127,
            "tiltDeg": 12,
            "focalMm": 24,
            "sensorWidthMm": 32,
            "aspect": 9 / 16,
        },
        {
            "cameraPosition": {"x": 0, "y": 0, "z": 0},
            "worldPoint": {"x": -1, "y": 0, "z": 0},
            "panDeg": 0,
            "tiltDeg": 0,
            "focalMm": 50,
            "sensorWidthMm": 36,
            "aspect": 16 / 9,
        },
    ]
    assert_runtime_parity(parity_cases)

    print("reference-space-projection: Python and JS world-to-frame projection are numerically aligned")


if __name__ == "__main__":
    main()
