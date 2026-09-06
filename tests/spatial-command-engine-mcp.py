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

temp_dir = Path(tempfile.mkdtemp(prefix="frisframe-spatial-command-engine-"))
os.environ["PREVIS_DB_PATH"] = str(temp_dir / "frisframe.db")
os.environ["FRISFRAME_MCP_OWNER_LICENSE_HASH"] = "local"

import mcp_server as core  # noqa: E402
import mcp_previs_server as base  # noqa: E402
import reference_space_mcp as reference_extension  # noqa: E402,F401
import set_reconstruction_mcp as set_extension  # noqa: E402,F401
import spatial_command_mcp as command_extension  # noqa: E402,F401


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


def call(name, args):
    return json.loads(base.call_tool(name, args))


def expect_value_error(fn, contains):
    try:
        fn()
    except ValueError as exc:
        assert contains in str(exc), (contains, str(exc))
        return str(exc)
    raise AssertionError(f"ValueError expected containing: {contains}")


def initial_commands():
    # Intentionally put attach before the create commands. The engine must first
    # materialize creates, then resolve dependencies independent of input order.
    return [
        {"op": "attach", "id": "door-entry", "parent_id": "wall-back", "attachment_t": 0.75},
        {
            "op": "create",
            "element": {
                "id": "sofa-main",
                "name": "Main Sofa",
                "kind": "sofa",
                "role": "furniture",
                "basis": "inferred",
                "confidence": 0.78,
                "collection_id": "main-set",
                "world_x_m": 0.0,
                "world_z_m": -0.7,
                "width_m": 2.1,
                "height_m": 0.85,
                "depth_m": 0.9,
                "rotation_deg": 0,
            },
        },
        {
            "op": "create",
            "element": {
                "id": "door-entry",
                "name": "Entry Door",
                "kind": "door",
                "role": "opening",
                "basis": "inferred",
                "confidence": 0.82,
                "collection_id": "main-set",
                "width_m": 0.9,
                "height_m": 2.05,
                "depth_m": 0.12,
            },
        },
        {
            "op": "create",
            "element": {
                "id": "wall-back",
                "name": "Back Wall",
                "kind": "wall",
                "role": "structure",
                "basis": "inferred",
                "confidence": 0.86,
                "collection_id": "main-set",
                "start_x_m": -2.0,
                "start_z_m": 1.0,
                "end_x_m": 2.0,
                "end_z_m": 1.0,
                "thickness_m": 0.15,
                "height_m": 2.7,
            },
        },
    ]


def main():
    try:
        created = json.loads(core.handle_create_project("Spatial Command Engine"))
        project_id = created["project_id"]
        revision = created["revision"]
        camera_before = copy.deepcopy(first_blocking(project_id)["camera"])

        contract = call("get_spatial_command_contract", {})
        assert contract["policy"] == "mcp-spatial-command-engine-v1"
        assert contract["product_boundary"]["frisframe_semantic_guessing"] is False
        assert contract["partial_updates"] is True
        assert contract["rollback_on_failure"] is True

        transaction = {
            "project_id": project_id,
            "scene_index": 0,
            "cut_index": 0,
            "transaction_id": "initial-set",
            "mode": "replace",
            "source_name": "Codex Spatial Plan",
            "collections": [{"id": "main-set", "name": "Main Set"}],
            "operations": initial_commands(),
        }

        before_validate = project_revision(project_id)
        validation = call("validate_spatial_set_commands", transaction)
        assert validation["valid"] is True
        assert validation["diff"]["created_count"] == 3
        assert validation["diff"]["updated_count"] == 0
        assert validation["dependency_order"].index("wall-back") < validation["dependency_order"].index("door-entry")
        assert project_revision(project_id) == before_validate, "validate must be read-only"

        applied = call("apply_spatial_set_commands", {**transaction, "revision": revision})
        assert applied["revision"] == revision + 1
        assert applied["command_result"]["atomic_revision"] is True
        assert applied["command_result"]["stage_operation_count"] == 3
        blocking = first_blocking(project_id)
        assert blocking["camera"] == camera_before, "spatial set commands must not move authored camera"
        plan = blocking["setMasterPlan"]
        assert set(plan["generatedItemIds"]) == {"wall-back", "door-entry", "sofa-main"}
        door = next(entry for entry in plan["elements"] if entry["id"] == "door-entry")
        assert door["parentId"] == "wall-back"
        assert abs(door["worldXM"] - 1.0) < 1e-6
        assert abs(door["worldZM"] - 1.0) < 1e-6
        assert abs(door["rotationDeg"]) < 1e-6

        snapshot = call("get_master_set_snapshot", {"project_id": project_id})
        assert snapshot["present"] is True
        assert snapshot["generated_item_count"] == 3
        assert set(item["id"] for item in snapshot["generated_items"]) == {"wall-back", "door-entry", "sofa-main"}

        # Update only the parent wall. The attached door preserves its old
        # attachment ratio and follows the wall. The untouched sofa is not sent
        # as a stage operation.
        revision = applied["revision"]
        wall_patch = {
            "project_id": project_id,
            "revision": revision,
            "transaction_id": "extend-wall",
            "mode": "patch",
            "operations": [{
                "op": "update",
                "id": "wall-back",
                "changes": {"end_x_m": 3.0},
            }],
        }
        wall_applied = call("apply_spatial_set_commands", wall_patch)
        assert wall_applied["revision"] == revision + 1
        assert wall_applied["command_result"]["diff"]["updated"] == ["door-entry", "wall-back"]
        assert wall_applied["command_result"]["stage_operation_count"] == 2
        plan = first_blocking(project_id)["setMasterPlan"]
        door = next(entry for entry in plan["elements"] if entry["id"] == "door-entry")
        assert abs(door["worldXM"] - 1.75) < 1e-6, door
        sofa = next(entry for entry in plan["elements"] if entry["id"] == "sofa-main")
        assert abs(sofa["worldZM"] + 0.7) < 1e-6

        # Tiny numeric repair is allowed and must be explicit in the report.
        revision = wall_applied["revision"]
        clamp_result = call("apply_spatial_set_commands", {
            "project_id": project_id,
            "revision": revision,
            "transaction_id": "clamp-door",
            "operations": [{"op": "attach", "id": "door-entry", "parent_id": "wall-back", "attachment_t": 0.99}],
        })
        assert clamp_result["revision"] == revision + 1
        warnings = clamp_result["command_result"]["warnings"]
        assert warnings and warnings[0]["code"] == "opening-attachment-clamped"
        assert abs(warnings[0]["applied_t"] - 0.91) < 1e-6
        plan = first_blocking(project_id)["setMasterPlan"]
        door = next(entry for entry in plan["elements"] if entry["id"] == "door-entry")
        assert abs(door["worldXM"] - 2.55) < 1e-6

        # No-op patches do not create pointless revisions.
        revision = clamp_result["revision"]
        no_op = call("apply_spatial_set_commands", {
            "project_id": project_id,
            "revision": revision,
            "operations": [{"op": "update", "id": "sofa-main", "changes": {"world_z_m": -0.7}}],
        })
        assert no_op["no_op"] is True
        assert no_op["revision"] == revision
        assert project_revision(project_id) == revision

        # Invalid parent: reject before commit and preserve revision/state.
        before_invalid = copy.deepcopy(first_blocking(project_id)["setMasterPlan"])
        expect_value_error(
            lambda: call("apply_spatial_set_commands", {
                "project_id": project_id,
                "revision": revision,
                "operations": [{"op": "attach", "id": "door-entry", "parent_id": "wall-missing", "attachment_t": 0.5}],
            }),
            "parent_id가 존재하지 않습니다",
        )
        assert project_revision(project_id) == revision
        assert first_blocking(project_id)["setMasterPlan"] == before_invalid

        # A parent cannot disappear while its child survives unless cascade is explicit.
        expect_value_error(
            lambda: call("apply_spatial_set_commands", {
                "project_id": project_id,
                "revision": revision,
                "operations": [{"op": "delete", "id": "wall-back"}],
            }),
            "cascade=true",
        )
        assert project_revision(project_id) == revision

        # Opening larger than its parent wall is a hard validation failure.
        expect_value_error(
            lambda: call("apply_spatial_set_commands", {
                "project_id": project_id,
                "revision": revision,
                "operations": [{"op": "update", "id": "door-entry", "changes": {"width_m": 9.0}}],
            }),
            "opening-too-wide",
        )
        assert project_revision(project_id) == revision

        # Stable IDs cannot be rewritten in place.
        expect_value_error(
            lambda: call("validate_spatial_set_commands", {
                "project_id": project_id,
                "operations": [{"op": "update", "id": "sofa-main", "changes": {"id": "sofa-renamed"}}],
            }),
            "stable identity",
        )

        # Cascade deletes parent + child in one revision while leaving the sofa.
        cascade = call("apply_spatial_set_commands", {
            "project_id": project_id,
            "revision": revision,
            "transaction_id": "remove-wall-system",
            "operations": [{"op": "delete", "id": "wall-back", "cascade": True}],
        })
        assert cascade["revision"] == revision + 1
        assert cascade["command_result"]["diff"]["deleted"] == ["door-entry", "wall-back"]
        assert cascade["command_result"]["stage_operation_count"] == 2
        plan = first_blocking(project_id)["setMasterPlan"]
        assert plan["generatedItemIds"] == ["sofa-main"]
        assert first_blocking(project_id)["camera"] == camera_before

        # A later partial update still touches only that stable id.
        revision = cascade["revision"]
        sofa_patch = call("apply_spatial_set_commands", {
            "project_id": project_id,
            "revision": revision,
            "operations": [{"op": "update", "id": "sofa-main", "changes": {"world_x_m": 0.4}}],
        })
        assert sofa_patch["revision"] == revision + 1
        assert sofa_patch["command_result"]["diff"]["updated"] == ["sofa-main"]
        assert sofa_patch["command_result"]["stage_operation_count"] == 1
        final_plan = first_blocking(project_id)["setMasterPlan"]
        final_sofa = next(entry for entry in final_plan["elements"] if entry["id"] == "sofa-main")
        assert abs(final_sofa["worldXM"] - 0.4) < 1e-6
        assert first_blocking(project_id)["camera"] == camera_before

        print("spatial-command-engine-mcp: contract, dependency resolution, delta apply, rollback, stable ids, opening attachment, and atomic revisions passed")
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


if __name__ == "__main__":
    main()
