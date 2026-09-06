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

temp_dir = Path(tempfile.mkdtemp(prefix="frisframe-director-previs-"))
os.environ["PREVIS_DB_PATH"] = str(temp_dir / "frisframe.db")
os.environ["FRISFRAME_MCP_OWNER_LICENSE_HASH"] = "local"

import mcp_server as core  # noqa: E402
import mcp_previs_server as base  # noqa: E402
import reference_space_mcp  # noqa: E402,F401
import set_reconstruction_mcp  # noqa: E402,F401
import spatial_command_mcp  # noqa: E402,F401
import director_previs_mcp  # noqa: E402,F401


def call(name, args):
    return json.loads(base.call_tool(name, args))


def payload(project_id):
    return json.loads(core.handle_get_project(project_id))


def first_cut(project_id):
    return payload(project_id)["document"]["project"]["scenes"][0]["cuts"][0]


def blocking(project_id):
    return first_cut(project_id)["blocking"]


def revision(project_id):
    connection = sqlite3.connect(os.environ["PREVIS_DB_PATH"])
    try:
        row = connection.execute("SELECT revision FROM projects WHERE id = ?", (project_id,)).fetchone()
        return int(row[0])
    finally:
        connection.close()


def expect_error(fn, contains):
    try:
        fn()
    except ValueError as exc:
        assert contains in str(exc), (contains, str(exc))
        return
    raise AssertionError(f"expected ValueError containing {contains}")


def set_commands():
    return [
        {
            "op": "create",
            "element": {
                "id": "floor-main", "name": "Floor", "kind": "floor", "role": "surface",
                "basis": "inferred", "confidence": 0.8, "collection_id": "main-set",
                "world_x_m": 0, "world_z_m": 0, "width_m": 6.0, "depth_m": 4.0, "height_m": 0.08,
            },
        },
        {
            "op": "create",
            "element": {
                "id": "wall-back", "name": "Back Wall", "kind": "wall", "role": "structure",
                "basis": "inferred", "confidence": 0.88, "collection_id": "main-set",
                "start_x_m": -3.0, "start_z_m": 1.8, "end_x_m": 3.0, "end_z_m": 1.8,
                "thickness_m": 0.15, "height_m": 2.7,
            },
        },
        {
            "op": "create",
            "element": {
                "id": "door-entry", "name": "Entry", "kind": "door", "role": "opening",
                "basis": "inferred", "confidence": 0.82, "collection_id": "main-set",
                "parent_id": "wall-back", "width_m": 0.9, "depth_m": 0.12, "height_m": 2.05,
                "world_x_m": 1.2, "world_z_m": 1.8,
            },
        },
    ]


def full_plan(project_id, rev, default_actor_id):
    return {
        "project_id": project_id,
        "revision": rev,
        "scene_index": 0,
        "cut_index": 0,
        "transaction_id": "reference-to-shot-001",
        "set": {
            "mode": "replace",
            "source_name": "Codex Reference Plan",
            "collections": [{"id": "main-set", "name": "Main Set"}],
            "operations": set_commands(),
        },
        "actors": [
            {"op": "delete", "id": default_actor_id},
            {
                "op": "create",
                "actor": {
                    "id": "actor-a", "name": "Lead", "dummy_type": "human", "color": "#3366FF",
                    "world_x_m": -0.8, "world_z_m": -0.3, "facing_deg": 20, "pose_preset": "attention",
                },
            },
            {
                "op": "create",
                "actor": {
                    "id": "actor-b", "name": "Partner", "dummy_type": "human", "color": "#FF6633",
                    "world_x_m": 0.8, "world_z_m": 0.2, "facing_deg": 200, "pose_preset": "neutral",
                },
            },
        ],
        "actor_paths": [
            {
                "actor_id": "actor-a",
                "replace_existing": True,
                "transition": "smooth",
                "path_mode": "straight",
                "points": [
                    {"time_sec": 0, "world_x_m": -0.8, "world_z_m": -0.3, "facing_deg": 20, "pose_preset": "attention"},
                    {"time_sec": 4, "world_x_m": -0.1, "world_z_m": 0.35, "facing_deg": 40, "pose_preset": "point"},
                ],
            }
        ],
        "camera": {
            "world_x_m": 0.0, "world_z_m": -2.4, "height_m": 1.55,
            "pan_deg": 90, "tilt_deg": -3, "focal_mm": 50, "focus_distance_m": 4.5,
            "tracking_target_id": "actor-a",
        },
        "camera_path": {
            "replace_existing": True,
            "transition": "smooth",
            "path_mode": "straight",
            "points": [
                {"time_sec": 0, "world_x_m": 0.0, "world_z_m": -2.4, "height_m": 1.55, "pan_deg": 90, "tilt_deg": -3, "focal_mm": 50},
                {"time_sec": 4, "world_x_m": 0.4, "world_z_m": -2.0, "height_m": 1.6, "pan_deg": 100, "tilt_deg": -4, "focal_mm": 65, "focus_distance_m": 3.8},
            ],
        },
        "shot": {
            "title": "Lead crosses to partner",
            "shot_type": "MS",
            "camera_note": "50mm start, gentle push to 65mm",
            "intent": "Keep both performers spatially readable",
            "notes": "Reference-driven blocking",
            "status": "ready",
            "target_ids": ["actor-a", "actor-b"],
            "framing": {"composition": "two-shot", "headroom": "normal", "lookroom": "balanced"},
        },
        "timeline": {"duration_sec": 8, "export_start_sec": 0, "export_end_sec": 8},
    }


def main():
    try:
        created = json.loads(core.handle_create_project("Director Previs E2E"))
        project_id = created["project_id"]
        initial_revision = created["revision"]
        default_actor_id = next(item["id"] for item in blocking(project_id)["items"] if item["type"] == "actor")

        contract = call("get_director_previs_contract", {})
        assert contract["policy"] == "director-previs-command-engine-v1"
        assert contract["semantic_guessing_inside_frisframe"] is False
        assert contract["single_revision_full_previs"] is True
        assert contract["supports"]["actor_pose_and_metric_paths"] is True
        assert contract["supports"]["camera_metric_position_lens_focus"] is True
        assert contract["supports"]["shot_metadata_and_framing"] is True

        plan = full_plan(project_id, initial_revision, default_actor_id)
        before_validate = revision(project_id)
        validation = call("validate_director_previs_plan", {key: value for key, value in plan.items() if key != "revision"})
        assert validation["valid"] is True
        assert validation["set"]["diff"]["created_count"] == 3
        assert validation["actors"]["created"] == ["actor-a", "actor-b"]
        assert validation["actors"]["deleted"] == [default_actor_id]
        assert validation["camera"]["static_update"] is True
        assert validation["shot_update"] is True
        assert validation["motion_operation_count"] >= 6
        assert revision(project_id) == before_validate, "director validation must be read-only"

        result = call("apply_director_previs_plan", plan)
        assert result["revision"] == initial_revision + 1, result
        assert result["atomic_revision"] is True
        assert revision(project_id) == initial_revision + 1

        shot = first_cut(project_id)
        state = shot["blocking"]
        assert set(state["setMasterPlan"]["generatedItemIds"]) == {"floor-main", "wall-back", "door-entry"}
        door = next(entry for entry in state["setMasterPlan"]["elements"] if entry["id"] == "door-entry")
        assert door["parentId"] == "wall-back"
        actor_ids = {item["id"] for item in state["items"] if item["type"] == "actor"}
        assert actor_ids == {"actor-a", "actor-b"}, actor_ids
        assert default_actor_id not in actor_ids
        camera = state["camera"]
        assert camera["focal"] == 50
        assert abs(camera["height"] - 1.55) < 1e-6
        assert abs(camera["focusDistanceM"] - 4.5) < 1e-6
        assert camera["trackingTargetId"] == "actor-a"
        assert shot["shotType"] == "MS"
        assert shot["status"] == "ready"
        assert shot["shotDesign"]["targetIds"] == ["actor-a", "actor-b"]
        assert shot["shotDesign"]["framing"]["composition"] == "two-shot"
        assert state["motion"]["duration"] == 8
        assert state["motion"]["exportRange"] == {"start": 0.0, "end": 8.0}
        assert any(key["source"] == "actor-a" and key.get("posePreset") == "point" for key in state["motion"]["keyframes"])
        assert sum(1 for key in state["motion"]["keyframes"] if key["source"] == "camera") == 2
        assert state["directorPrevis"]["transactionId"] == "reference-to-shot-001"
        assert state["directorPrevis"]["atomicRevision"] is True

        snapshot = call("get_director_previs_snapshot", {"project_id": project_id})
        assert snapshot["ready_for_previs"] is True
        assert snapshot["master_set_item_count"] == 3
        assert snapshot["actor_count"] == 2
        assert snapshot["shot"]["shot_type"] == "MS"
        assert snapshot["timeline"]["actor_keyframe_count"] == 2
        assert snapshot["timeline"]["camera_keyframe_count"] == 2

        # One later director patch updates actor + lens + shot metadata in one revision.
        current_revision = result["revision"]
        patch = call("apply_director_previs_plan", {
            "project_id": project_id,
            "revision": current_revision,
            "transaction_id": "shot-refine-002",
            "actors": [{"op": "update", "id": "actor-b", "changes": {"world_x_m": 0.55, "world_z_m": 0.1, "facing_deg": 210}}],
            "camera": {"focal_mm": 85, "focus_distance_m": 3.2},
            "shot": {"shot_type": "MCU", "status": "approved", "target_ids": ["actor-a"], "framing": {"composition": "single"}},
        })
        assert patch["revision"] == current_revision + 1
        state = blocking(project_id)
        assert state["camera"]["focal"] == 85
        assert abs(state["camera"]["focusDistanceM"] - 3.2) < 1e-6
        assert first_cut(project_id)["shotType"] == "MCU"
        assert first_cut(project_id)["status"] == "approved"
        actor_b = next(item for item in state["items"] if item["id"] == "actor-b")
        assert actor_b["facing"] == 210

        # Invalid cross-layer reference must roll back the entire plan.
        stable_revision = patch["revision"]
        before = copy.deepcopy(first_cut(project_id))
        expect_error(
            lambda: call("apply_director_previs_plan", {
                "project_id": project_id,
                "revision": stable_revision,
                "actors": [{"op": "update", "id": "actor-a", "changes": {"world_x_m": 0.2}}],
                "camera": {"tracking_target_id": "missing-actor"},
                "shot": {"shot_type": "CU", "target_ids": ["actor-a"]},
            }),
            "tracking target",
        )
        assert revision(project_id) == stable_revision
        assert first_cut(project_id) == before

        # A set/actor ID collision is rejected before mutation.
        expect_error(
            lambda: call("validate_director_previs_plan", {
                "project_id": project_id,
                "set": {"mode": "patch", "operations": [{
                    "op": "create",
                    "element": {
                        "id": "actor-a", "kind": "table", "role": "furniture", "basis": "inferred", "confidence": 0.5,
                        "world_x_m": 0, "world_z_m": 0, "width_m": 1, "depth_m": 0.8, "height_m": 0.75,
                    },
                }]},
            }),
            "actor/non-set item",
        )
        assert revision(project_id) == stable_revision

        # Metric camera path outside the stage is a hard validation failure, not a clamp.
        expect_error(
            lambda: call("validate_director_previs_plan", {
                "project_id": project_id,
                "camera_path": {"points": [{"time_sec": 0, "world_x_m": 999, "world_z_m": 999}]},
            }),
            "무대 범위",
        )
        assert revision(project_id) == stable_revision

        print("director-previs-command-engine-mcp: full Set -> Actor Blocking -> Camera/Lens -> Shot -> Timeline E2E, snapshot, single revision, and rollback passed")
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


if __name__ == "__main__":
    main()
