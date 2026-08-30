#!/usr/bin/env python3
import json

import mcp_previs_server as base
import reference_space_core as space
import reference_space_mcp as extension


def main():
    names = {tool.get("name") for tool in base.TOOLS}
    assert {"calibrate_reference_camera", "apply_reference_mass_blocks", "validate_reference_space"} <= names
    assert base.call_tool is extension.call_tool

    frame_fraction = 1.78 * 50 / (10 * (36 / (16 / 9)))
    calibration = json.loads(extension.call_tool("calibrate_reference_camera", {
        "axis": "height",
        "physical_size_m": 1.78,
        "frame_fraction": frame_fraction,
        "focal_mm": 50,
        "sensor_width_mm": 36,
        "aspect": 16 / 9,
        "horizon_y": 0.43,
    }))
    assert abs(calibration["distance_m"] - 10) < 1e-9
    assert calibration["applicable_to_frisframe_camera"] is True
    assert calibration["tilt_deg"] is not None

    plan = space.mass_block_plan({"aspect": "16:9", "items": []}, [{
        "id": "back-wall",
        "name": "Back wall",
        "world_x_m": 0,
        "world_z_m": -6,
        "width_m": 10,
        "height_m": 4,
        "depth_m": 0.4,
        "rotation_deg": 0,
    }])
    operation = plan["operations"][0]
    assert operation["op"] == "add_dummy"
    assert operation["physical_dimensions_m"] == {"width": 10.0, "height": 4.0, "depth": 0.4}
    assert plan["issues"] == []

    try:
        space.mass_block_plan({"aspect": "16:9", "items": []}, [{
            "id": "outside",
            "world_x_m": 17.9,
            "world_z_m": 0,
            "width_m": 4,
            "height_m": 3,
            "depth_m": 2,
        }])
    except ValueError as error:
        assert "무대 밖" in str(error)
    else:
        raise AssertionError("outside-stage mass must fail by default")

    print("reference-space-mcp: calibration, tool registration, and mass blocking checks passed")


if __name__ == "__main__":
    main()
