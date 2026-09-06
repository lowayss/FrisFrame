#!/usr/bin/env python3
import copy
import json
import os
import shutil
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

temp_dir = Path(tempfile.mkdtemp(prefix="frisframe-autonomous-scale-"))
os.environ["PREVIS_DB_PATH"] = str(temp_dir / "frisframe.db")
os.environ["FRISFRAME_MCP_OWNER_LICENSE_HASH"] = "local"

import mcp_server as core  # noqa: E402
import mcp_previs_server as base  # noqa: E402
import reference_space_mcp as reference_extension  # noqa: E402,F401
import reference_space_consistency_mcp as consistency_extension  # noqa: E402,F401
import reference_space_plan_mcp as plan_extension  # noqa: E402,F401
import reference_space_orientation_mcp as orientation_extension  # noqa: E402,F401
import reference_interpretation_mcp as interpretation_extension  # noqa: E402,F401
import set_reconstruction_mcp as set_extension  # noqa: E402,F401
import reference_master_pipeline_mcp as pipeline_extension  # noqa: E402,F401
import spatial_quality_mcp as quality_extension  # noqa: E402,F401


def project_payload(project_id):
    return json.loads(core.handle_get_project(project_id))


def first_blocking(project_id):
    return project_payload(project_id)["document"]["project"]["scenes"][0]["cuts"][0]["blocking"]


def half_scale_reference():
    # Vision produced a coherent but globally half-sized provisional layout.
    # No user-supplied metric dimension or scale anchor is present.
    return {
        "source_name": "autonomous-scale-room.jpg",
        "scene_type": "interior",
        "scene_label": "living room from one reference image",
        "image": {"width_px": 1920, "height_px": 1080},
        "scene_envelope": {
            "width_m": 3.10,
            "depth_m": 2.40,
            "height_m": 1.35,
            "basis": "inferred",
            "confidence": 0.62,
            "notes": "Provisional vision geometry before autonomous metric normalization.",
        },
        "objects": [
            {
                "id": "wall-bottom",
                "name": "Bottom wall",
                "kind": "wall",
                "role": "structure",
                "basis": "observed",
                "confidence": 0.90,
                "start_x_m": -1.55,
                "start_z_m": -1.20,
                "end_x_m": 1.55,
                "end_z_m": -1.20,
                "thickness_m": 0.075,
                "height_m": 1.35,
                "visible_fraction": 0.70,
            },
            {
                "id": "wall-right",
                "name": "Right wall",
                "kind": "wall",
                "role": "structure",
                "basis": "observed",
                "confidence": 0.88,
                "start_x_m": 1.55,
                "start_z_m": -1.20,
                "end_x_m": 1.55,
                "end_z_m": 1.20,
                "thickness_m": 0.075,
                "height_m": 1.35,
            },
            {
                "id": "wall-top",
                "name": "Top wall",
                "kind": "wall",
                "role": "structure",
                "basis": "inferred",
                "confidence": 0.74,
                "start_x_m": 1.55,
                "start_z_m": 1.20,
                "end_x_m": -1.55,
                "end_z_m": 1.20,
                "thickness_m": 0.075,
                "height_m": 1.35,
            },
            {
                "id": "wall-left",
                "name": "Left wall",
                "kind": "wall",
                "role": "structure",
                "basis": "inferred",
                "confidence": 0.72,
                "start_x_m": -1.55,
                "start_z_m": 1.20,
                "end_x_m": -1.55,
                "end_z_m": -1.20,
                "thickness_m": 0.075,
                "height_m": 1.35,
            },
            {
                "id": "door-main",
                "name": "Entry door",
                "kind": "door",
                "role": "opening",
                "basis": "observed",
                "confidence": 0.94,
                "parent_id": "wall-bottom",
                "world_x_m": 0.95,
                "world_z_m": -1.16,
                "width_m": 0.45,
                "height_m": 1.025,
                "depth_m": 0.06,
                "rotation_deg": 0,
                "image_bbox": {"x": 0.69, "y": 0.16, "width": 0.13, "height": 0.65},
                "visible_fraction": 0.96,
                "evidence_note": "Door outline is strongly visible but its physical size was not supplied by the user.",
            },
            {
                "id": "sofa-main",
                "name": "Main sofa",
                "kind": "sofa",
                "role": "furniture",
                "basis": "observed",
                "confidence": 0.86,
                "world_x_m": -0.20,
                "world_z_m": 0.35,
                "width_m": 1.05,
                "height_m": 0.43,
                "depth_m": 0.45,
                "rotation_deg": 180,
                "image_bbox": {"x": 0.24, "y": 0.50, "width": 0.44, "height": 0.27},
                "visible_fraction": 0.92,
            },
            {
                "id": "lamp-detail",
                "name": "Decorative lamp",
                "kind": "generic",
                "role": "prop",
                "basis": "inferred",
                "confidence": 0.25,
                "previs_priority": "detail",
                "world_x_m": -0.9,
                "world_z_m": 0.8,
                "width_m": 0.06,
                "height_m": 0.95,
                "depth_m": 0.06,
                "rotation_deg": 0,
            },
        ],
        "scale_anchors": [],
        "relationships": [],
        "notes": "No actual dimensions were provided by the user.",
    }


def main():
    try:
        contract = json.loads(base.call_tool("get_reference_master_set_contract", {}))
        assert contract["autonomous_scale"]["default"] is True
        assert contract["autonomous_scale"]["user_metric_input_required"] is False
        assert contract["autonomous_scale"]["policy"] == "autonomous-object-prior-scale-v1"

        created = json.loads(core.handle_create_project("Autonomous Scale"))
        project_id = created["project_id"]
        revision = created["revision"]
        camera_before = copy.deepcopy(first_blocking(project_id)["camera"])
        interpretation = half_scale_reference()

        compiled = json.loads(base.call_tool("compile_reference_master_plan", {
            "project_id": project_id,
            "interpretation": interpretation,
        }))
        assert compiled["status"] == "ready", compiled
        reconstruction = compiled["reference_reconstruction"]
        auto = reconstruction["scale"]["autonomous"]
        assert auto["ready"] is True, auto
        assert auto["applied"] is True, auto
        assert auto["source"] == "object-prior-consensus"
        assert auto["confidence"] >= 0.58
        assert abs(auto["factor"] - 2.0) < 0.08, auto
        assert reconstruction["blocking_viable"] is True
        assert reconstruction["scale"]["status"] == "autonomous"
        assert not any(entry["code"] == "scale-anchor-needed" for entry in reconstruction["correction_queue"])

        master = compiled["master_plan"]
        elements = {entry["id"]: entry for entry in master["elements"]}
        assert abs(elements["wall-bottom"]["width_m"] - 6.2) < 0.08
        assert abs(elements["door-main"]["width_m"] - 0.90) < 0.03
        assert abs(elements["door-main"]["height_m"] - 2.05) < 0.04
        assert abs(elements["sofa-main"]["depth_m"] - 0.90) < 0.04
        assert abs(reconstruction["scene"]["envelope"]["width_m"] - 6.2) < 0.08
        assert abs(reconstruction["scene"]["envelope"]["depth_m"] - 4.8) < 0.08
        assert abs(reconstruction["scene"]["envelope"]["height_m"] - 2.7) < 0.06

        # Spatial-quality topology must run after autonomous metricization so its
        # room area is in the same metric state as the Master Set.
        spatial = compiled["spatial_quality"]
        assert spatial["room_zone_count"] == 1, spatial
        assert abs(spatial["room_zones"][0]["area_m2"] - 29.76) < 0.25, spatial

        applied = json.loads(base.call_tool("apply_reference_master_set", {
            "project_id": project_id,
            "revision": revision,
            "interpretation": interpretation,
            "require_interpretation_ready": True,
            "require_master_plan_ready": True,
        }))
        assert applied["reference_master_pipeline"]["blocking_viable"] is True
        assert applied["reference_reconstruction"]["scale"]["status"] == "autonomous"
        blocking = first_blocking(project_id)
        assert blocking["camera"] == camera_before
        persisted = blocking["setMasterPlan"]["referenceReconstruction"]["scale"]["autonomous"]
        assert persisted["applied"] is True
        assert abs(persisted["factor"] - 2.0) < 0.08

        disabled = json.loads(base.call_tool("compile_reference_master_plan", {
            "interpretation": half_scale_reference(),
            "autonomous_scale": False,
        }))
        assert disabled["status"] == "review"
        assert disabled["reference_reconstruction"]["blocking_viable"] is False
        assert disabled["reference_reconstruction"]["scale"]["status"] == "unanchored"
        assert disabled["reference_reconstruction"]["correction_queue"][0]["code"] == "scale-anchor-needed"

        print("autonomous-scale-inference-mcp: image-only provisional geometry -> autonomous metric Master Set passed")
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


if __name__ == "__main__":
    main()
