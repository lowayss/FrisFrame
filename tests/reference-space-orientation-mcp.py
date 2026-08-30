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

temp_dir = Path(tempfile.mkdtemp(prefix="frisframe-reference-orientation-"))
os.environ["PREVIS_DB_PATH"] = str(temp_dir / "frisframe.db")
os.environ["FRISFRAME_MCP_OWNER_LICENSE_HASH"] = "local"

import mcp_server as core  # noqa: E402
import mcp_previs_server as base  # noqa: E402
import reference_space_core as space  # noqa: E402
import reference_space_mcp as reference  # noqa: E402
import reference_space_consistency_mcp  # noqa: F401,E402
import reference_space_plan_mcp  # noqa: F401,E402
import reference_space_orientation_mcp as orientation  # noqa: E402


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


def camera_target_projection(blocking, target):
    camera = blocking["camera"]
    defaults = reference._camera_defaults(blocking)
    stage_width, stage_depth = space.stage_dimensions(blocking["aspect"])
    world_x, world_z = reference._world_xy(blocking, target)
    return space.project_world_point_to_frame(
        {
            "x": (float(camera.get("x", 0.5)) - 0.5) * stage_width,
            "y": float(camera.get("height", 1.6)),
            "z": (float(camera.get("y", 0.5)) - 0.5) * stage_depth,
        },
        {
            "x": world_x,
            "y": reference._target_center_height(target),
            "z": world_z,
        },
        pan_deg=camera.get("panDeg", 180),
        tilt_deg=camera.get("tiltDeg", 0),
        focal_mm=defaults["focal_mm"],
        sensor_width_mm=defaults["sensor_width_mm"],
        aspect=defaults["aspect"],
    )


def main():
    try:
        names = {tool.get("name") for tool in base.TOOLS}
        assert {"solve_reference_camera_orientation", "apply_reference_camera_orientation"} <= names
        assert base.call_tool is orientation.call_tool

        created = json.loads(core.handle_create_project("Reference Orientation"))
        project_id = created["project_id"]
        revision = created["revision"]
        blocking = first_blocking(project_id)
        actor = blocking["items"][0]
        actor_id = actor["id"]

        desired_x = 0.62
        desired_y = 0.42
        solved = json.loads(orientation.call_tool("solve_reference_camera_orientation", {
            "project_id": project_id,
            "scene_index": 0,
            "cut_index": 0,
            "target_id": actor_id,
            "image_x": desired_x,
            "image_y": desired_y,
        }))
        assert project_revision(project_id) == revision, "solve must not create a revision"
        assert solved["application_policy"] == "explicit-opt-in-camera-orientation"
        assert abs(solved["projection_check"]["residual_x"]) < 1e-9, solved
        assert abs(solved["projection_check"]["residual_y"]) < 1e-9, solved
        assert solved["projection_check"]["in_front"] is True

        for bad_name, bad_value in (("image_x", "0.62"), ("image_y", True)):
            bad_args = {
                "project_id": project_id,
                "scene_index": 0,
                "cut_index": 0,
                "target_id": actor_id,
                "image_x": desired_x,
                "image_y": desired_y,
            }
            bad_args[bad_name] = bad_value
            try:
                orientation.call_tool("solve_reference_camera_orientation", bad_args)
            except ValueError as error:
                assert "JSON number" in str(error), error
            else:
                raise AssertionError(f"coerced {bad_name} must be rejected")
        assert project_revision(project_id) == revision, "invalid read-only numeric observations must not create a revision"

        applied = json.loads(orientation.call_tool("apply_reference_camera_orientation", {
            "project_id": project_id,
            "revision": revision,
            "scene_index": 0,
            "cut_index": 0,
            "target_id": actor_id,
            "image_x": desired_x,
            "image_y": desired_y,
        }))
        assert applied["revision"] == revision + 1
        assert applied["reference_camera_orientation"]["application_policy"] == "explicit-opt-in-camera-orientation"
        assert applied["validation"]["status"] == "ready", applied["validation"]

        updated = first_blocking(project_id)
        updated_actor = next(item for item in updated["items"] if item["id"] == actor_id)
        projection = camera_target_projection(updated, updated_actor)
        assert abs(projection["frame_x"] - desired_x) < 1e-9, projection
        assert abs(projection["frame_y"] - desired_y) < 1e-9, projection

        stale_revision = revision
        current_revision = revision + 1
        before_stale = project_payload(project_id)
        before_stale_camera = dict(first_blocking(project_id)["camera"])
        try:
            orientation.call_tool("apply_reference_camera_orientation", {
                "project_id": project_id,
                "revision": stale_revision,
                "scene_index": 0,
                "cut_index": 0,
                "target_id": actor_id,
                "image_x": 0.48,
                "image_y": 0.55,
            })
        except ValueError as error:
            assert "revision_conflict" in str(error), error
        else:
            raise AssertionError("stale orientation revision must be rejected")
        assert project_revision(project_id) == current_revision, "stale orientation apply must not create a revision"
        after_stale = project_payload(project_id)
        after_stale_camera = first_blocking(project_id)["camera"]
        assert after_stale["revision"] == before_stale["revision"] == current_revision
        assert after_stale_camera == before_stale_camera, "stale orientation apply must not mutate camera state"

        before_bad_boolean_camera = dict(first_blocking(project_id)["camera"])
        try:
            orientation.call_tool("apply_reference_camera_orientation", {
                "project_id": project_id,
                "revision": current_revision,
                "scene_index": 0,
                "cut_index": 0,
                "target_id": actor_id,
                "image_x": 0.48,
                "image_y": 0.55,
                "allow_keyframed_base_camera": "false",
            })
        except ValueError as error:
            assert "JSON boolean true/false" in str(error), error
        else:
            raise AssertionError("string false must not be accepted as a keyframed-camera override")
        assert project_revision(project_id) == current_revision, "invalid boolean override must not create a revision"
        assert first_blocking(project_id)["camera"] == before_bad_boolean_camera, "invalid boolean override must not mutate camera state"

        guarded = json.loads(core.handle_create_project("Reference Orientation Horizon Guard"))
        guarded_id = guarded["project_id"]
        guarded_revision = guarded["revision"]
        guarded_blocking = first_blocking(guarded_id)
        guarded_actor = guarded_blocking["items"][0]
        guarded_actor_id = guarded_actor["id"]
        defaults = reference._camera_defaults(guarded_blocking)
        camera = guarded_blocking["camera"]
        observed_horizon = space.horizon_from_tilt(
            camera.get("tiltDeg", 0),
            defaults["focal_mm"],
            defaults["sensor_width_mm"],
            defaults["aspect"],
        )
        payload = base._target_args({
            "revision": guarded_revision,
            "scene_index": 0,
            "cut_index": 0,
        })
        payload["operations"] = []
        payload["spatial_guide"] = reference._merge_guide(guarded_blocking, "horizon-guard", [{
            "id": "reference-horizon",
            "label": "Reference horizon",
            "kind": "horizon",
            "image_y": observed_horizon,
            "confidence": 1,
        }])
        persisted = json.loads(core.handle_apply_scene_commands(guarded_id, payload))
        guarded_revision = persisted["revision"]

        before_bad_tolerance_camera = dict(first_blocking(guarded_id)["camera"])
        try:
            orientation.call_tool("apply_reference_camera_orientation", {
                "project_id": guarded_id,
                "revision": guarded_revision,
                "scene_index": 0,
                "cut_index": 0,
                "target_id": guarded_actor_id,
                "image_x": 0.5,
                "image_y": 0.12,
                "horizon_tolerance": True,
            })
        except ValueError as error:
            assert "horizon_tolerance 값은 JSON number" in str(error), error
        else:
            raise AssertionError("boolean horizon_tolerance must not relax the Horizon guard")
        assert project_revision(guarded_id) == guarded_revision, "invalid Horizon tolerance must not create a revision"
        assert first_blocking(guarded_id)["camera"] == before_bad_tolerance_camera, "invalid Horizon tolerance must not mutate camera state"

        try:
            orientation.call_tool("apply_reference_camera_orientation", {
                "project_id": guarded_id,
                "revision": guarded_revision,
                "scene_index": 0,
                "cut_index": 0,
                "target_id": guarded_actor_id,
                "image_x": 0.5,
                "image_y": 0.12,
                "allow_horizon_mismatch": "false",
            })
        except ValueError as error:
            assert "JSON boolean true/false" in str(error), error
        else:
            raise AssertionError("string false must not be accepted as a Horizon override")
        assert project_revision(guarded_id) == guarded_revision, "invalid Horizon override must not create a revision"

        try:
            orientation.call_tool("apply_reference_camera_orientation", {
                "project_id": guarded_id,
                "revision": guarded_revision,
                "scene_index": 0,
                "cut_index": 0,
                "target_id": guarded_actor_id,
                "image_x": 0.5,
                "image_y": 0.12,
            })
        except ValueError as error:
            assert "reference-horizon-conflict" in str(error)
        else:
            raise AssertionError("persisted horizon conflict must block orientation by default")
        assert project_revision(guarded_id) == guarded_revision, "blocked orientation must not create a revision"

        overridden = json.loads(orientation.call_tool("apply_reference_camera_orientation", {
            "project_id": guarded_id,
            "revision": guarded_revision,
            "scene_index": 0,
            "cut_index": 0,
            "target_id": guarded_actor_id,
            "image_x": 0.5,
            "image_y": 0.12,
            "allow_horizon_mismatch": True,
        }))
        assert overridden["revision"] == guarded_revision + 1
        assert overridden["reference_camera_orientation"]["horizon_check"]["consistent"] is False
        assert overridden["validation"]["status"] == "review", overridden["validation"]
        assert any(issue.get("code") == "horizon-mismatch" for issue in overridden["validation"]["issues"])

        print("reference-space-orientation-mcp: exact screen orientation, strict numeric/boolean inputs, stale-revision safety, and Horizon guard passed")
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


if __name__ == "__main__":
    main()
