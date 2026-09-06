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

temp_dir = Path(tempfile.mkdtemp(prefix="frisframe-reference-reconstruction-v2-"))
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
import reference_master_pipeline_mcp as pipeline_extension  # noqa: E402
import spatial_quality_mcp as quality_extension  # noqa: E402,F401


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


def reference_interpretation():
    return {
        "source_name": "living-room-reference-v2.jpg",
        "scene_type": "interior",
        "scene_label": "compact living room",
        "image": {"width_px": 1920, "height_px": 1080},
        "scene_envelope": {
            "width_m": 6.2,
            "depth_m": 4.8,
            "height_m": 2.7,
            "basis": "inferred",
            "confidence": 0.64,
            "notes": "Room envelope estimated from wall convergence and door scale.",
        },
        "objects": [
            {
                "id": "wall-back",
                "name": "Back wall",
                "kind": "wall",
                "role": "structure",
                "basis": "observed",
                "confidence": 0.94,
                "previs_priority": "critical",
                "start_x_m": -3.1,
                "start_z_m": 2.4,
                "end_x_m": 3.1,
                "end_z_m": 2.4,
                "thickness_m": 0.15,
                "height_m": 2.7,
                "image_bbox": {"x": 0.12, "y": 0.10, "width": 0.78, "height": 0.78},
                "visible_fraction": 0.88,
                "evidence_note": "Long rear wall clearly visible behind sofa.",
            },
            {
                "id": "wall-left-hidden",
                "name": "Left continuation",
                "kind": "wall",
                "role": "structure",
                "basis": "inferred",
                "confidence": 0.46,
                "previs_priority": "critical",
                "start_x_m": -3.1,
                "start_z_m": -2.4,
                "end_x_m": -3.1,
                "end_z_m": 2.4,
                "thickness_m": 0.15,
                "height_m": 2.7,
                "visible_fraction": 0.18,
                "occluded_by": ["sofa-main"],
                "evidence_note": "Only a short edge is visible; continuation is inferred.",
            },
            {
                "id": "door-main",
                "name": "Entry door",
                "kind": "door",
                "role": "opening",
                "basis": "observed",
                "confidence": 0.91,
                "previs_priority": "critical",
                "parent_id": "wall-back",
                "world_x_m": 2.1,
                "world_z_m": 2.32,
                "width_m": 0.9,
                "height_m": 2.1,
                "depth_m": 0.12,
                "rotation_deg": 0,
                "image_bbox": {"x": 0.74, "y": 0.18, "width": 0.14, "height": 0.64},
                "visible_fraction": 0.96,
                "evidence_note": "Door frame is fully readable and used as scale evidence.",
            },
            {
                "id": "sofa-main",
                "name": "Main sofa",
                "kind": "sofa",
                "role": "furniture",
                "basis": "inferred",
                "confidence": 0.74,
                "previs_priority": "major",
                "world_x_m": -0.3,
                "world_z_m": 1.35,
                "width_m": 2.3,
                "height_m": 0.86,
                "depth_m": 0.92,
                "rotation_deg": 180,
                "image_bbox": {"x": 0.25, "y": 0.48, "width": 0.42, "height": 0.28},
                "visible_fraction": 0.93,
            },
            {
                "id": "table-main",
                "name": "Coffee table",
                "kind": "table",
                "role": "furniture",
                "basis": "observed",
                "confidence": 0.82,
                "previs_priority": "major",
                "world_x_m": -0.1,
                "world_z_m": 0.25,
                "width_m": 1.15,
                "height_m": 0.42,
                "depth_m": 0.62,
                "rotation_deg": 0,
                "image_bbox": {"x": 0.40, "y": 0.68, "width": 0.23, "height": 0.15},
                "visible_fraction": 0.72,
            },
            {
                "id": "lamp-detail",
                "name": "Small lamp",
                "kind": "generic",
                "role": "prop",
                "basis": "inferred",
                "confidence": 0.24,
                "previs_priority": "detail",
                "world_x_m": -2.2,
                "world_z_m": 1.8,
                "width_m": 0.25,
                "height_m": 0.55,
                "depth_m": 0.25,
                "rotation_deg": 0,
                "visible_fraction": 0.35,
            },
        ],
        "scale_anchors": [
            {
                "id": "door-width-anchor",
                "object_id": "door-main",
                "axis": "width",
                "physical_size_m": 0.9,
                "frame_fraction": 0.14,
                "basis": "user_fixed",
                "confidence": 1.0,
            }
        ],
        "relationships": [
            {
                "type": "adjacent_to",
                "from_id": "sofa-main",
                "to_id": "wall-back",
                "basis": "inferred",
                "confidence": 0.72,
            }
        ],
        "notes": "Prioritize shootable spatial relationships over decorative fidelity.",
    }


def main():
    try:
        created = json.loads(core.handle_create_project("Reference Reconstruction v2"))
        project_id = created["project_id"]
        revision = created["revision"]
        camera_before = copy.deepcopy(first_blocking(project_id)["camera"])

        contract = json.loads(base.call_tool("get_reference_master_set_contract", {}))
        assert contract["version"] == 2
        assert contract["reconstruction_policy"] == "reference-reconstruction-v2"
        assert contract["first_pass_goal"] == "shootable-spatial-set"
        assert contract["detail_policy"] == "decorative-detail-never-blocks-first-pass-readiness"
        assert "correct only flagged spatial uncertainties" in contract["correction_policy"].lower()

        interpretation = reference_interpretation()
        before_compile_revision = project_revision(project_id)
        compiled = json.loads(base.call_tool("compile_reference_master_plan", {
            "project_id": project_id,
            "scene_index": 0,
            "cut_index": 0,
            "interpretation": interpretation,
        }))
        assert project_revision(project_id) == before_compile_revision, "compile must remain read-only"
        assert compiled["status"] == "ready", compiled
        reconstruction = compiled["reference_reconstruction"]
        assert reconstruction["policy"] == "reference-reconstruction-v2"
        assert reconstruction["blocking_viable"] is True
        assert reconstruction["status"] == "review", "uncertain hidden wall should be reviewable without blocking first-pass set"
        assert reconstruction["scene"]["type"] == "interior"
        assert reconstruction["scene"]["envelope"]["width_m"] == 6.2
        assert reconstruction["scene"]["envelope"]["confidence"] == 0.64
        assert reconstruction["scale"]["status"] == "anchored"
        assert reconstruction["camera_evidence"]["present"] is False
        assert reconstruction["camera_evidence"]["blocks_master_set"] is False
        assert reconstruction["focus_object_ids"] == [
            "wall-back", "wall-left-hidden", "door-main", "sofa-main", "table-main"
        ]
        assert reconstruction["ignored_detail_ids"] == ["lamp-detail"]
        queue_ids = [entry.get("object_id") for entry in reconstruction["correction_queue"]]
        assert "wall-left-hidden" in queue_ids
        assert "lamp-detail" not in queue_ids, "decorative detail must never block or pollute correction queue"
        hidden = next(entry for entry in reconstruction["object_evidence"] if entry["id"] == "wall-left-hidden")
        assert hidden["occluded_by"] == ["sofa-main"]
        assert hidden["visible_fraction"] == 0.18
        assert hidden["previs_priority"] == "critical"
        door = next(entry for entry in reconstruction["object_evidence"] if entry["id"] == "door-main")
        assert door["image_bbox"]["width"] == 0.14
        assert reconstruction["next_action"] == "correct-flagged-spatial-uncertainties"

        # The legacy interpretation validator reports missing-camera as review. The
        # Master Set pipeline must still allow a shootable first-pass set because
        # reference-camera calibration belongs after the set is spatially stable.
        assert compiled["reference_interpretation"]["status"] == "review"
        assert any(issue["code"] == "missing-camera" for issue in compiled["reference_interpretation"]["issues"])

        applied = json.loads(base.call_tool("apply_reference_master_set", {
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
        assert summary["blocking_viable"] is True
        assert summary["camera_applied"] is False
        assert summary["reconstruction_status"] == "review"
        assert summary["next_step"].startswith("Correct only flagged spatial uncertainties")

        blocking = first_blocking(project_id)
        assert blocking["camera"] == camera_before, "set reconstruction must never move the authored previs camera"
        persisted = blocking["setMasterPlan"]
        assert persisted["referenceReconstruction"]["policy"] == "reference-reconstruction-v2"
        assert persisted["referenceReconstruction"]["blocking_viable"] is True
        evidence = persisted["referenceInterpretation"]
        assert evidence["sceneType"] == "interior"
        assert evidence["sceneEnvelope"]["depth_m"] == 4.8
        assert any(entry["id"] == "door-main" and entry["image_bbox"]["height"] == 0.64 for entry in evidence["objectEvidence"])
        assert evidence["cameraApplied"] is False

        # Remove all reliable metric scale evidence: this must no longer be
        # considered shootable, even though the geometry can still be compiled.
        unscaled = reference_interpretation()
        unscaled["scale_anchors"] = []
        unscaled["scene_envelope"]["basis"] = "inferred"
        unscaled["scene_envelope"]["confidence"] = 0.45
        review = json.loads(base.call_tool("compile_reference_master_plan", {
            "interpretation": unscaled,
        }))
        assert review["status"] == "review"
        assert review["reference_reconstruction"]["blocking_viable"] is False
        assert review["reference_reconstruction"]["scale"]["status"] == "unanchored"
        assert review["reference_reconstruction"]["correction_queue"][0]["code"] == "scale-anchor-needed"

        print("reference-reconstruction-v2-mcp: shootable-set readiness, evidence retention, and focused correction queue passed")
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


if __name__ == "__main__":
    main()
