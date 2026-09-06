#!/usr/bin/env python3
import copy
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

temp_dir = Path(tempfile.mkdtemp(prefix="frisframe-reference-master-set-"))
os.environ["PREVIS_DB_PATH"] = str(temp_dir / "frisframe.db")
os.environ["FRISFRAME_MCP_OWNER_LICENSE_HASH"] = "local"

import mcp_server as core  # noqa: E402
import mcp_previs_server as base  # noqa: E402
import reference_space_core as space  # noqa: E402
import reference_space_mcp as reference_extension  # noqa: E402,F401
import reference_space_consistency_mcp as consistency_extension  # noqa: E402,F401
import reference_space_plan_mcp as plan_extension  # noqa: E402,F401
import reference_space_orientation_mcp as orientation_extension  # noqa: E402,F401
import reference_interpretation_mcp as interpretation_extension  # noqa: E402,F401
import set_reconstruction_mcp as set_extension  # noqa: E402,F401
import reference_master_pipeline_mcp as pipeline_extension  # noqa: E402


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


def main():
    try:
        names = {tool.get("name") for tool in base.TOOLS}
        assert {
            "get_reference_master_set_contract",
            "compile_reference_master_plan",
            "apply_reference_master_set",
        } <= names
        assert base.call_tool is pipeline_extension.call_tool

        contract = json.loads(pipeline_extension.call_tool("get_reference_master_set_contract", {}))
        assert contract["source_of_truth"]["data"] == "blocking.setMasterPlan + shared blocking items"
        assert contract["authoritative_flow"][:5] == [
            "reference image",
            "spatial interpretation",
            "metric scale + provenance review",
            "2D Master Set",
            "2.5D layout review",
        ]
        assert contract["preferred_tools"][2:4] == [
            "compile_reference_master_plan",
            "apply_reference_master_set",
        ]

        legacy_contract = json.loads(pipeline_extension.call_tool("get_reference_interpretation_contract", {}))
        assert legacy_contract["preferred_master_set_pipeline"] == [
            "compile_reference_master_plan",
            "apply_reference_master_set",
        ]

        created = json.loads(core.handle_create_project("Reference Master Set"))
        project_id = created["project_id"]
        revision = created["revision"]
        blocking = first_blocking(project_id)
        aspect = space.aspect_value(blocking["aspect"])
        focal_mm = 35.0
        distance_m = 8.0
        door_height_m = 2.1
        frame_fraction = space.predicted_frame_fraction(
            door_height_m,
            distance_m,
            focal_mm,
            36,
            aspect,
            "height",
        )

        interpretation = {
            "source_name": "living-room-reference.jpg",
            "image": {"width_px": 1920, "height_px": 1080},
            "declared_width_m": 8.0,
            "declared_depth_m": 6.0,
            "objects": [
                {
                    "id": "wall-left",
                    "name": "Left wall",
                    "kind": "wall",
                    "role": "structure",
                    "basis": "observed",
                    "confidence": 0.95,
                    "start_x_m": -4.0,
                    "start_z_m": -3.0,
                    "end_x_m": -4.0,
                    "end_z_m": 3.0,
                    "thickness_m": 0.15,
                    "height_m": 2.8,
                },
                {
                    "id": "door-main",
                    "name": "Main door",
                    "kind": "door",
                    "role": "opening",
                    "basis": "observed",
                    "confidence": 0.9,
                    "world_x_m": -3.92,
                    "world_z_m": 0.0,
                    "width_m": 0.9,
                    "height_m": door_height_m,
                    "depth_m": 0.12,
                    "rotation_deg": 90,
                },
                {
                    "id": "sofa-main",
                    "name": "Main sofa",
                    "kind": "sofa",
                    "role": "furniture",
                    "basis": "inferred",
                    "confidence": 0.72,
                    "world_x_m": 0.5,
                    "world_z_m": 1.0,
                    "width_m": 2.2,
                    "height_m": 0.9,
                    "depth_m": 0.9,
                    "rotation_deg": 180,
                },
            ],
            "scale_anchors": [
                {
                    "id": "door-height-scale",
                    "object_id": "door-main",
                    "axis": "height",
                    "physical_size_m": door_height_m,
                    "frame_fraction": frame_fraction,
                    "distance_m": distance_m,
                    "basis": "observed",
                    "confidence": 0.92,
                }
            ],
            "relationships": [
                {
                    "type": "parallel_to",
                    "from_id": "wall-left",
                    "to_id": "door-main",
                    "basis": "observed",
                    "confidence": 0.9,
                }
            ],
            "camera": {
                "target_id": "door-main",
                "anchor_id": "door-camera-observation",
                "axis": "height",
                "physical_size_m": door_height_m,
                "frame_fraction": frame_fraction,
                "focal_mm": focal_mm,
                "distance_m": distance_m,
                "height_m": 1.65,
                "basis": "inferred",
                "confidence": 0.78,
            },
        }

        before_compile_revision = project_revision(project_id)
        compiled = json.loads(pipeline_extension.call_tool("compile_reference_master_plan", {
            "project_id": project_id,
            "scene_index": 0,
            "cut_index": 0,
            "interpretation": interpretation,
        }))
        assert compiled["status"] == "ready", compiled
        assert project_revision(project_id) == before_compile_revision, "compile must be read-only"
        master = compiled["master_plan"]
        elements = {entry["id"]: entry for entry in master["elements"]}
        wall = elements["wall-left"]
        assert wall["kind"] == "wall"
        assert abs(wall["width_m"] - 6.0) < 1e-9
        assert abs(wall["world_x_m"] + 4.0) < 1e-9
        assert abs(wall["rotation_deg"] - 90.0) < 1e-9
        assert wall["line"]["start_z_m"] == -3.0
        assert elements["door-main"]["role"] == "opening"
        assert elements["sofa-main"]["collection_id"] == "furniture"
        collection_ids = {entry["id"] for entry in master["collections"]}
        assert {"architecture", "furniture"} <= collection_ids
        assert compiled["camera_policy"] == "observation-retained-not-applied-during-master-set"

        camera_before = copy.deepcopy(first_blocking(project_id)["camera"])
        applied = json.loads(pipeline_extension.call_tool("apply_reference_master_set", {
            "project_id": project_id,
            "revision": revision,
            "scene_index": 0,
            "cut_index": 0,
            "interpretation": interpretation,
            "require_interpretation_ready": True,
            "require_master_plan_ready": True,
            "replace_existing_set": True,
        }))
        assert applied["revision"] == revision + 1, applied
        summary = applied["reference_master_pipeline"]
        assert summary["atomic_revision"] is True
        assert summary["camera_observation_retained"] is True
        assert summary["camera_applied"] is False
        assert summary["source_of_truth"] == "blocking.setMasterPlan"
        assert set(summary["generated_item_ids"]) == {"wall-left", "door-main", "sofa-main"}

        updated = first_blocking(project_id)
        assert updated["camera"] == camera_before, "Master Set construction must not move the authored camera"
        item_ids = {item["id"] for item in updated["items"]}
        assert {"wall-left", "door-main", "sofa-main"} <= item_ids
        persisted = updated["setMasterPlan"]
        assert persisted["pipelinePolicy"] == pipeline_extension.PIPELINE_POLICY
        assert persisted["cameraAppliedDuringSetBuild"] is False
        assert set(persisted["generatedItemIds"]) == {"wall-left", "door-main", "sofa-main"}
        evidence = persisted["referenceInterpretation"]
        assert evidence["sourceName"] == "living-room-reference.jpg"
        assert evidence["cameraApplied"] is False
        assert evidence["cameraObservation"]["target_id"] == "door-main"
        assert evidence["summary"]["inferred_object_ids"] == ["sofa-main"]
        anchor_ids = {anchor["id"] for anchor in updated["spatialGuide"]["anchors"]}
        assert "door-height-scale" in anchor_ids

        print("reference-master-pipeline-mcp: reference -> metric Master Set -> shared state passed")
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


if __name__ == "__main__":
    main()
