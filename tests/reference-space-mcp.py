#!/usr/bin/env python3
import json
import os
import shutil
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

temp_dir = Path(tempfile.mkdtemp(prefix="frisframe-reference-space-"))
os.environ["PREVIS_DB_PATH"] = str(temp_dir / "frisframe.db")
os.environ["FRISFRAME_MCP_OWNER_LICENSE_HASH"] = "local"

import mcp_server as core  # noqa: E402
import mcp_previs_server as base  # noqa: E402
import reference_space_core as space  # noqa: E402
import reference_space_mcp as extension  # noqa: E402


def project_payload(project_id):
    return json.loads(core.handle_get_project(project_id))


def first_blocking(project_id):
    payload = project_payload(project_id)
    return payload["document"]["project"]["scenes"][0]["cuts"][0]["blocking"]


def main():
    try:
        names = {tool.get("name") for tool in base.TOOLS}
        assert {
            "calibrate_reference_camera",
            "apply_reference_camera_calibration",
            "apply_reference_mass_blocks",
            "validate_reference_space",
        } <= names
        assert base.call_tool is extension.call_tool
        assert extension._image_observation_fields({}) == {}
        assert extension._image_observation_fields({"image_x": 0.27}) == {"image_x": 0.27}
        assert extension._image_observation_fields({"image_x": 0.27, "image_y": 0.63}) == {"image_x": 0.27, "image_y": 0.63}

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
        assert calibration["tilt_deg"] < 0

        solved_from_distance = space.calibrate_reference_camera({
            "axis": "height",
            "physical_size_m": 1.78,
            "frame_fraction": frame_fraction,
            "distance_m": 10,
        }, {"focal_mm": 85, "sensor_width_mm": 36, "aspect": 16 / 9})
        assert abs(solved_from_distance["focal_mm"] - 50) < 1e-9, "explicit distance must solve focal instead of reusing current focal"

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

        created = json.loads(core.handle_create_project("Reference Space Test"))
        project_id = created["project_id"]
        revision = created["revision"]
        blocking = first_blocking(project_id)
        actor = blocking["items"][0]
        actor_id = actor["id"]
        target_dims = extension._target_dimensions(actor, "height", 1.78)
        actual_distance = extension._target_distance(blocking, actor_id, target_dims)
        camera = blocking["camera"]
        sensor_width = (blocking.get("cameraSetup") or {}).get("sensorWidthMm", 36)
        aspect = space.aspect_value(blocking["aspect"])
        observed_fraction = space.predicted_frame_fraction(
            1.78,
            actual_distance,
            camera["focal"],
            sensor_width,
            aspect,
            "height",
        )
        observed_horizon = space.horizon_from_tilt(camera["tiltDeg"], camera["focal"], sensor_width, aspect)
        stage_width, stage_depth = space.stage_dimensions(blocking["aspect"])
        actor_world_x, actor_world_z = extension._world_xy(blocking, actor)
        observed_screen = space.project_world_point_to_frame(
            {
                "x": (float(camera.get("x", 0.5)) - 0.5) * stage_width,
                "y": float(camera.get("height", 1.6)),
                "z": (float(camera.get("y", 0.5)) - 0.5) * stage_depth,
            },
            {
                "x": actor_world_x,
                "y": extension._target_center_height(actor, target_dims),
                "z": actor_world_z,
            },
            pan_deg=camera.get("panDeg", 180),
            tilt_deg=camera.get("tiltDeg", 0),
            focal_mm=camera["focal"],
            sensor_width_mm=sensor_width,
            aspect=blocking["aspect"],
        )
        assert observed_screen["in_front"] is True
        assert observed_screen["frame_x"] is not None and observed_screen["frame_y"] is not None

        applied = json.loads(extension.call_tool("apply_reference_camera_calibration", {
            "project_id": project_id,
            "revision": revision,
            "scene_index": 0,
            "cut_index": 0,
            "target_id": actor_id,
            "anchor_id": "actor-scale",
            "axis": "height",
            "physical_size_m": 1.78,
            "frame_fraction": observed_fraction,
            "image_x": observed_screen["frame_x"],
            "image_y": observed_screen["frame_y"],
            "horizon_y": observed_horizon,
            "apply_distance": True,
            "apply_focal": True,
            "apply_tilt": True,
            "source_name": "external-reference",
        }))
        assert applied["revision"] == revision + 1, "camera calibration must be one atomic scene revision"
        assert applied["reference_camera"]["anchor_id"] == "actor-scale"
        assert applied["reference_camera"]["camera_keyframes_present"] == 0

        updated = first_blocking(project_id)
        updated_actor = next(item for item in updated["items"] if item["id"] == actor_id)
        assert updated_actor["referenceAnchorId"] == "actor-scale"
        assert abs(updated_actor["referenceDimensionsM"]["height"] - 1.78) < 1e-9
        guide_kinds = {anchor["kind"] for anchor in updated["spatialGuide"]["anchors"]}
        assert {"scale-height", "horizon"} <= guide_kinds

        validation = json.loads(extension.call_tool("validate_reference_space", {
            "project_id": project_id,
            "scene_index": 0,
            "cut_index": 0,
        }))
        assert validation["status"] == "ready", validation
        assert len(validation["projection_checks"]) == 1
        assert validation["horizon_check"] is not None
        assert validation["screen_position_policy"] == "diagnostic-only-no-readiness-impact"
        assert len(validation["screen_position_checks"]) == 1
        screen_check = validation["screen_position_checks"][0]
        assert screen_check["anchor_id"] == "actor-scale"
        assert screen_check["item_id"] == actor_id
        assert screen_check["in_front"] is True
        assert abs(screen_check["residual_x"]) < 1e-9, screen_check
        assert abs(screen_check["residual_y"]) < 1e-9, screen_check

        diagnostic_x = 0.1 if screen_check["predicted_x"] > 0.5 else 0.9
        diagnostic_y = 0.1 if screen_check["predicted_y"] > 0.5 else 0.9
        diagnostic_only = json.loads(extension.call_tool("validate_reference_space", {
            "project_id": project_id,
            "scene_index": 0,
            "cut_index": 0,
            "horizon_y": validation["horizon_check"]["predicted"],
            "scale_anchors": [{
                "id": "actor-scale-diagnostic",
                "axis": "height",
                "physical_size_m": 1.78,
                "frame_fraction": validation["projection_checks"][0]["predicted"],
                "target_id": actor_id,
                "dimensions_m": updated_actor["referenceDimensionsM"],
                "image_x": diagnostic_x,
                "image_y": diagnostic_y,
            }],
        }))
        assert diagnostic_only["status"] == "ready", diagnostic_only
        assert diagnostic_only["issues"] == []
        assert abs(diagnostic_only["screen_position_checks"][0]["residual_x"]) > 0.1
        assert abs(diagnostic_only["screen_position_checks"][0]["residual_y"]) > 0.1

        no_screen_created = json.loads(core.handle_create_project("Reference Space No Screen Guess"))
        no_screen_project_id = no_screen_created["project_id"]
        no_screen_revision = no_screen_created["revision"]
        no_screen_blocking = first_blocking(no_screen_project_id)
        no_screen_actor = no_screen_blocking["items"][0]
        no_screen_actor_id = no_screen_actor["id"]
        no_screen_dims = extension._target_dimensions(no_screen_actor, "height", 1.78)
        no_screen_distance = extension._target_distance(no_screen_blocking, no_screen_actor_id, no_screen_dims)
        no_screen_camera = no_screen_blocking["camera"]
        no_screen_sensor = (no_screen_blocking.get("cameraSetup") or {}).get("sensorWidthMm", 36)
        no_screen_aspect = space.aspect_value(no_screen_blocking["aspect"])
        no_screen_fraction = space.predicted_frame_fraction(
            1.78,
            no_screen_distance,
            no_screen_camera["focal"],
            no_screen_sensor,
            no_screen_aspect,
            "height",
        )
        no_screen_applied = json.loads(extension.call_tool("apply_reference_camera_calibration", {
            "project_id": no_screen_project_id,
            "revision": no_screen_revision,
            "scene_index": 0,
            "cut_index": 0,
            "target_id": no_screen_actor_id,
            "anchor_id": "actor-scale-no-screen",
            "axis": "height",
            "physical_size_m": 1.78,
            "frame_fraction": no_screen_fraction,
            "apply_distance": False,
            "apply_focal": False,
            "apply_tilt": False,
            "source_name": "external-reference-no-screen-observation",
        }))
        assert no_screen_applied["revision"] == no_screen_revision + 1
        no_screen_updated = first_blocking(no_screen_project_id)
        no_screen_anchor = next(anchor for anchor in no_screen_updated["spatialGuide"]["anchors"] if anchor["id"] == "actor-scale-no-screen")
        assert no_screen_anchor.get("imageX") is None, no_screen_anchor
        assert no_screen_anchor.get("imageY") is None, no_screen_anchor
        no_screen_validation = json.loads(extension.call_tool("validate_reference_space", {
            "project_id": no_screen_project_id,
            "scene_index": 0,
            "cut_index": 0,
        }))
        assert no_screen_validation["status"] == "ready", no_screen_validation
        assert len(no_screen_validation["projection_checks"]) == 1
        assert no_screen_validation["screen_position_checks"] == [], no_screen_validation

        keyed = first_blocking(project_id)
        keyed["motion"]["keyframes"] = [{"id": "cam-key", "source": "camera", "time": 0, "pose": dict(keyed["camera"])}]
        assert len(extension._camera_keyframes(keyed)) == 1

        print("reference-space-mcp: calibration, persisted diagnostics, no synthetic screen center, and mass blocking checks passed")
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


if __name__ == "__main__":
    main()
