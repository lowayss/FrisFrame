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
    return int(project_payload(project_id)["storage"]["revision"])


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
        aspect = space.aspect_value(blocking["aspect"])
        observed_fraction = anchor_fraction(1.78, distance, camera["focal"], aspect)
        observed_horizon = space.horizon_from_tilt(camera["tiltDeg"], camera["focal"], 36, aspect)

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
            "sensor_width_mm": 36,
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
        assert result["validation"]["status"] == "ready", result["validation"]

        updated = first_blocking(project_id)
        ids = {item["id"] for item in updated["items"]}
        assert "back-wall" in ids
        anchor_ids = {anchor["id"] for anchor in updated["spatialGuide"]["anchors"]}
        assert {"actor-scale", "reference-horizon", "back-wall"} <= anchor_ids

        stable_revision = project_revision(project_id)
        bad_anchors = [
            consistency_anchors[0],
            {
                "id": "wrong-door-depth",
                "axis": "height",
                "physical_size_m": 2.0,
                "distance_m": 8.0,
                "frame_fraction": anchor_fraction(2.0, 8.0, 85, aspect),
            },
        ]
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

        print("reference-space-plan-mcp: consistency preflight, camera, masses, validation, atomic commit, and atomic rejection passed")
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


if __name__ == "__main__":
    main()
