#!/usr/bin/env python3
import json
import math
import os
import shutil
import sqlite3
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

temp_dir = Path(tempfile.mkdtemp(prefix="frisframe-reference-interpretation-"))
os.environ["PREVIS_DB_PATH"] = str(temp_dir / "frisframe.db")
os.environ["FRISFRAME_MCP_OWNER_LICENSE_HASH"] = "local"

import mcp_server as core  # noqa: E402
import mcp_previs_server as base  # noqa: E402
import reference_space_core as space  # noqa: E402
import reference_space_mcp as reference_extension  # noqa: E402,F401
import reference_space_consistency_mcp as consistency_extension  # noqa: E402,F401
import reference_space_plan_mcp as plan_extension  # noqa: E402,F401
import reference_space_orientation_mcp as orientation_extension  # noqa: E402,F401
import reference_interpretation_mcp as interpretation_extension  # noqa: E402


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
            "get_reference_interpretation_contract",
            "validate_reference_interpretation",
            "apply_reference_interpretation",
        } <= names
        assert base.call_tool is interpretation_extension.call_tool

        contract = json.loads(interpretation_extension.call_tool("get_reference_interpretation_contract", {}))
        assert contract["ownership"]["image_reasoning"] == "external-vision-mcp-client"
        assert contract["ownership"]["frisframe_calls_ai_api"] is False
        assert contract["priority"][:3] == ["spatial_relationships", "metric_scale", "camera"]

        created = json.loads(core.handle_create_project("Reference Interpretation"))
        project_id = created["project_id"]
        revision = created["revision"]
        blocking = first_blocking(project_id)
        aspect = space.aspect_value(blocking["aspect"])
        focal_mm = 35.0
        distance_m = 12.0
        villa_height_m = 6.0
        frame_fraction = space.predicted_frame_fraction(villa_height_m, distance_m, focal_mm, 36, aspect, "height")

        interpretation = {
            "source_name": "villa-reference.jpg",
            "image": {"width_px": 1536, "height_px": 1024},
            "objects": [
                {
                    "id": "villa-main",
                    "name": "Main villa mass",
                    "role": "structure",
                    "basis": "observed",
                    "confidence": 0.92,
                    "world_x_m": 0,
                    "world_z_m": -2,
                    "width_m": 8,
                    "height_m": villa_height_m,
                    "depth_m": 6,
                    "rotation_deg": 0,
                    "asset_type": "box",
                },
                {
                    "id": "pool-main",
                    "name": "Pool footprint",
                    "role": "surface",
                    "basis": "observed",
                    "confidence": 0.84,
                    "world_x_m": 4,
                    "world_z_m": 2,
                    "width_m": 3,
                    "height_m": 0.4,
                    "depth_m": 8,
                    "rotation_deg": 0,
                    "asset_type": "box",
                },
                {
                    "id": "rear-tree",
                    "name": "Rear tree proxy",
                    "role": "vegetation",
                    "basis": "inferred",
                    "confidence": 0.48,
                    "world_x_m": -5,
                    "world_z_m": -5,
                    "width_m": 1.5,
                    "height_m": 4.2,
                    "depth_m": 1.5,
                    "rotation_deg": 0,
                    "asset_type": "tree",
                },
            ],
            "scale_anchors": [
                {
                    "id": "villa-height-anchor",
                    "object_id": "villa-main",
                    "axis": "height",
                    "physical_size_m": villa_height_m,
                    "frame_fraction": frame_fraction,
                    "distance_m": distance_m,
                    "basis": "observed",
                    "confidence": 0.9,
                }
            ],
            "relationships": [
                {
                    "type": "parallel_to",
                    "from_id": "villa-main",
                    "to_id": "pool-main",
                    "basis": "observed",
                    "confidence": 0.9,
                },
                {
                    "type": "distance",
                    "from_id": "villa-main",
                    "to_id": "pool-main",
                    "distance_m": math.sqrt(32),
                    "tolerance_m": 0.1,
                    "basis": "observed",
                    "confidence": 0.85,
                },
            ],
            "camera": {
                "target_id": "villa-main",
                "anchor_id": "villa-camera-anchor",
                "axis": "height",
                "physical_size_m": villa_height_m,
                "frame_fraction": frame_fraction,
                "focal_mm": focal_mm,
                "distance_m": distance_m,
                "height_m": 1.8,
                "apply_focal": True,
                "apply_distance": True,
                "apply_tilt": False,
                "orient_to_target": True,
                "basis": "inferred",
                "confidence": 0.78,
            },
        }

        before_validate_revision = project_revision(project_id)
        validated = json.loads(interpretation_extension.call_tool("validate_reference_interpretation", {
            "interpretation": interpretation,
        }))
        assert validated["status"] == "ready", validated
        assert validated["summary"]["object_count"] == 3
        assert validated["summary"]["structure_count"] == 2
        assert validated["summary"]["reliable_scale_anchor_count"] >= 1
        assert validated["summary"]["inferred_object_ids"] == ["rear-tree"]
        assert all(check["status"] == "ok" for check in validated["relation_checks"]), validated["relation_checks"]
        assert project_revision(project_id) == before_validate_revision, "validate tool must be read-only"

        applied = json.loads(interpretation_extension.call_tool("apply_reference_interpretation", {
            "project_id": project_id,
            "revision": revision,
            "scene_index": 0,
            "cut_index": 0,
            "interpretation": interpretation,
            "require_ready": True,
            "validate_after_apply": True,
        }))
        assert applied["revision"] == revision + 1, applied
        summary = applied["reference_interpretation"]
        assert summary["atomic_revision"] is True
        assert summary["applied_object_ids"] == ["villa-main", "pool-main", "rear-tree"]
        assert summary["camera"]["target_id"] == "villa-main"
        assert summary["operation_count"] == 4, summary
        assert summary["anchor_count"] >= 4

        updated = first_blocking(project_id)
        item_ids = {item["id"] for item in updated["items"]}
        assert {"villa-main", "pool-main", "rear-tree"} <= item_ids
        guide = updated["spatialGuide"]
        anchor_ids = {anchor["id"] for anchor in guide["anchors"]}
        assert {"villa-main", "pool-main", "rear-tree", "villa-height-anchor", "villa-camera-anchor"} <= anchor_ids
        camera = updated["camera"]
        assert int(camera["focal"]) == 35
        assert abs(float(camera["height"]) - 1.8) < 1e-9
        assert applied["validation"]["status"] in {"ready", "review"}

        stable_revision = project_revision(project_id)
        review_only = {
            "source_name": "unscaled-reference",
            "objects": [{
                "id": "unscaled-room",
                "role": "structure",
                "basis": "inferred",
                "confidence": 0.4,
                "world_x_m": 0,
                "world_z_m": 0,
                "width_m": 5,
                "height_m": 3,
                "depth_m": 5,
            }],
        }
        review_result = json.loads(interpretation_extension.call_tool("validate_reference_interpretation", {
            "interpretation": review_only,
        }))
        review_codes = {issue["code"] for issue in review_result["issues"]}
        assert review_result["status"] == "review"
        assert {"missing-camera", "missing-reliable-scale-anchor"} <= review_codes
        try:
            interpretation_extension.call_tool("apply_reference_interpretation", {
                "project_id": project_id,
                "revision": stable_revision,
                "interpretation": review_only,
                "require_ready": True,
            })
        except ValueError as error:
            assert "reference-interpretation-review-required" in str(error)
        else:
            raise AssertionError("REVIEW interpretation must not mutate when require_ready=true")
        assert project_revision(project_id) == stable_revision
        assert "unscaled-room" not in {item["id"] for item in first_blocking(project_id)["items"]}

        mismatched = json.loads(json.dumps(interpretation))
        mismatched["relationships"][1]["distance_m"] = 15
        mismatch_result = json.loads(interpretation_extension.call_tool("validate_reference_interpretation", {
            "interpretation": mismatched,
            "relation_tolerance_m": 0.25,
        }))
        assert mismatch_result["status"] == "review"
        assert any(issue["code"] == "relationship-distance-mismatch" for issue in mismatch_result["issues"])

        print("reference-interpretation-mcp: contract, metric validation, atomic apply, and review guard passed")
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


if __name__ == "__main__":
    main()
