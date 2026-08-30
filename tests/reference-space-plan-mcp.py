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
import reference_space_plan_mcp as plan_extension  # noqa: E402


def first_blocking(project_id):
    payload = json.loads(core.handle_get_project(project_id))
    return payload["document"]["project"]["scenes"][0]["cuts"][0]["blocking"]


def main():
    try:
        names = {tool.get("name") for tool in base.TOOLS}
        assert "apply_reference_space_plan" in names
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
        observed_fraction = space.predicted_frame_fraction(
            1.78,
            distance,
            camera["focal"],
            36,
            aspect,
            "height",
        )
        observed_horizon = space.horizon_from_tilt(camera["tiltDeg"], camera["focal"], 36, aspect)

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
        assert summary["masses"] == ["back-wall"]
        assert summary["operation_count"] >= 3
        assert result["validation"]["status"] == "ready", result["validation"]

        updated = first_blocking(project_id)
        ids = {item["id"] for item in updated["items"]}
        assert "back-wall" in ids
        anchor_ids = {anchor["id"] for anchor in updated["spatialGuide"]["anchors"]}
        assert {"actor-scale", "reference-horizon", "back-wall"} <= anchor_ids

        print("reference-space-plan-mcp: camera, masses, guide, validation, and single-revision commit passed")
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


if __name__ == "__main__":
    main()
