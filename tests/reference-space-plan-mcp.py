#!/usr/bin/env python3
import json
import os
import shutil
import sqlite3
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

temp_dir = Path(tempfile.mkdtemp(prefix="frisframe-reference-plan-"))
os.environ["PREVIS_DB_PATH"] = str(temp_dir / "frisframe.db")
os.environ["FRISFRAME_MCP_OWNER_LICENSE_HASH"] = "local"

import mcp_server as core  # noqa: E402
import mcp_previs_server as base  # noqa: E402
import reference_space_core as space  # noqa: E402
import reference_space_mcp as reference  # noqa: E402
import reference_space_consistency_mcp as consistency_extension  # noqa: E402
import reference_space_plan_mcp as plan_extension  # noqa: E402


def project_payload(project_id):
    return json.loads(core.handle_get_project(project_id))


def first_blocking(project_id):
    return project_payload(project_id)["document"]["project"]["scenes"][0]["cuts"][0]["blocking"]


def project_revision(project_id):
    connection = sqlite3.connect(os.environ["PREVIS_DB_PATH"])
    try:
        row = connection.execute("SELECT revision FROM projects WHERE id = ?", (project_id,)).fetchone()
        if not row:
            raise AssertionError(f"project revision row missing: {project_id}")
        return int(row[0])
    finally:
        connection.close()


def anchor_fraction(physical_size_m, distance_m, focal_mm, aspect, axis="height"):
    return space.predicted_frame_fraction(physical_size_m, distance_m, focal_mm, 36, aspect, axis)


def main():
    try:
        names = {tool.get("name") for tool in base.TOOLS}
        assert {"check_reference_anchor_consistency", "apply_reference_space_plan"} <= names
        assert base.call_tool is plan_extension.call_tool

        created = json.loads(core.handle_create_project("Atomic Reference Plan"))
        project_id = created["project_id"]
        revision = created["revision"]
        blocking = first_blocking(project_id)
        actor = blocking["items"][0]
        actor_id = actor["id"]
        target_dims = reference._target_dimensions(actor, "height", 1.78)
        distance = reference._target_distance(blocking, actor_id, target_dims)
        camera = blocking["camera"]
        sensor_width = (blocking.get("cameraSetup") or {}).get("sensorWidthMm", 36)
        aspect = space.aspect_value(blocking["aspect"])
        observed_fraction = anchor_fraction(1.78, distance, camera["focal"], aspect)
        observed_horizon = space.horizon_from_tilt(camera["tiltDeg"], camera["focal"], sensor_width, aspect)
        stage_width, stage_depth = space.stage_dimensions(blocking["aspect"])
        actor_world_x, actor_world_z = reference._world_xy(blocking, actor)
        observed_screen = space.project_world_point_to_frame(
            {
                "x": (float(camera.get("x", 0.5)) - 0.5) * stage_width,
                "y": float(camera.get("height", 1.6)),
                "z": (float(camera.get("y", 0.5)) - 0.5) * stage_depth,
            },
            {
                "x": actor_world_x,
                "y": reference._target_center_height(actor, target_dims),
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

        consistency_anchors = [
            {
                "id": "actor-check",
                "axis": "height",
                "physical_size_m": 1.78,
                "distance_m": distance,
                "frame_fraction": observed_fraction,
            },
            {
                "id": "door-check",
                "axis": "height",
                "physical_size_m": 2.0,
                "distance_m": 8.0,
                "frame_fraction": anchor_fraction(2.0, 8.0, camera["focal"], aspect),
            },
        ]
        consistency = json.loads(consistency_extension.call_tool("check_reference_anchor_consistency", {
            "anchors": consistency_anchors,
            "sensor_width_mm": sensor_width,
            "aspect": aspect,
            "expected_focal_mm": camera["focal"],
        }))
        assert consistency["consistent"] is True
        assert abs(consistency["diagnostic_median_focal_mm"] - camera["focal"]) < 1e-9
        assert consistency["application_policy"] == "diagnostic-only-no-auto-average"

        result = json.loads(plan_extension.call_tool("apply_reference_space_plan", {
            "project_id": project_id,
            "revision": revision,
            "scene_index": 0,
            "cut_index": 0,
            "source_name": "external-full-reference",
            "camera_calibration": {
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
            },
            "consistency_anchors": consistency_anchors,
            "consistency_tolerance_ratio": 0.05,
            "require_anchor_consistency": True,
            "masses": [{
                "id": "back-wall",
                "name": "Back wall",
                "world_x_m": 0,
                "world_z_m": -6,
                "width_m": 8,
                "height_m": 3.5,
                "depth_m": 0.3,
                "rotation_deg": 0,
            }],
            "validate_after_apply": True,
        }))

        assert result["revision"] == revision + 1, "camera + masses must commit as one revision"
        summary = result["reference_space_plan"]
        assert summary["atomic_revision"] is True
        assert summary["camera"]["anchor_id"] == "actor-scale"
        assert summary["anchor_consistency"]["consistent"] is True
        assert summary["masses"] == ["back-wall"]
        assert summary["operation_count"] >= 3
        validation = result["validation"]
        assert validation["status"] == "ready", validation
        assert validation["screen_position_policy"] == "diagnostic-only-no-readiness-impact"
        assert len(validation["screen_position_checks"]) == 1
        screen_check = validation["screen_position_checks"][0]
        assert screen_check["anchor_id"] == "actor-scale"
        assert screen_check["item_id"] == actor_id
        assert screen_check["in_front"] is True
        assert abs(screen_check["residual_x"]) < 1e-9, screen_check
        assert abs(screen_check["residual_y"]) < 1e-9, screen_check

        updated = first_blocking(project_id)
        ids = {item["id"] for item in updated["items"]}
        assert "back-wall" in ids
        anchor_ids = {anchor["id"] for anchor in updated["spatialGuide"]["anchors"]}
        assert {"actor-scale", "reference-horizon", "back-wall"} <= anchor_ids

        stable_revision = project_revision(project_id)
        assert stable_revision == result["revision"]
        wrong_focal = float(camera["focal"]) * 0.60
        bad_anchors = [
            consistency_anchors[0],
            {
                "id": "wrong-door-depth",
                "axis": "height",
                "physical_size_m": 2.0,
                "distance_m": 8.0,
                "frame_fraction": anchor_fraction(2.0, 8.0, wrong_focal, aspect),
            },
        ]
        bad_check = space.evaluate_scale_anchor_consistency(
            bad_anchors,
            sensor_width_mm=sensor_width,
            aspect=aspect,
            tolerance_ratio=0.05,
            expected_focal_mm=camera["focal"],
        )
        assert bad_check["consistent"] is False, bad_check
        try:
            plan_extension.call_tool("apply_reference_space_plan", {
                "project_id": project_id,
                "revision": stable_revision,
                "scene_index": 0,
                "cut_index": 0,
                "camera_calibration": {
                    "target_id": actor_id,
                    "axis": "height",
                    "physical_size_m": 1.78,
                    "frame_fraction": observed_fraction,
                    "apply_distance": False,
                    "apply_focal": False,
                    "apply_tilt": False,
                },
                "consistency_anchors": bad_anchors,
                "consistency_tolerance_ratio": 0.05,
                "require_anchor_consistency": True,
                "masses": [{
                    "id": "must-not-exist",
                    "world_x_m": 4,
                    "world_z_m": 0,
                    "width_m": 1,
                    "height_m": 1,
                    "depth_m": 1,
                }],
            })
        except ValueError as error:
            assert "reference-anchor-inconsistent" in str(error)
        else:
            raise AssertionError("inconsistent anchors must block the atomic plan")

        assert project_revision(project_id) == stable_revision, "failed consistency preflight must not create a revision"
        assert "must-not-exist" not in {item["id"] for item in first_blocking(project_id)["items"]}

        print("reference-space-plan-mcp: consistency preflight, camera, masses, screen diagnostics, validation, atomic commit, and atomic rejection passed")
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


if __name__ == "__main__":
    main()
