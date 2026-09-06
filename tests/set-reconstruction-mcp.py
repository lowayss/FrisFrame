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

temp_dir = Path(tempfile.mkdtemp(prefix="frisframe-set-master-plan-"))
os.environ["PREVIS_DB_PATH"] = str(temp_dir / "frisframe.db")
os.environ["FRISFRAME_MCP_OWNER_LICENSE_HASH"] = "local"

import mcp_server as core  # noqa: E402
import mcp_previs_server as base  # noqa: E402
import reference_space_mcp as reference_extension  # noqa: F401,E402
import reference_space_consistency_mcp as consistency_extension  # noqa: F401,E402
import reference_space_plan_mcp as plan_extension  # noqa: F401,E402
import reference_space_orientation_mcp as orientation_extension  # noqa: F401,E402
import reference_interpretation_mcp as interpretation_extension  # noqa: F401,E402
import set_reconstruction_mcp as set_extension  # noqa: E402


def project_payload(project_id):
    return json.loads(core.handle_get_project(project_id))


def blocking(project_id):
    payload = project_payload(project_id)
    return payload["document"]["project"]["scenes"][0]["cuts"][0]["blocking"]


def revision(project_id):
    connection = sqlite3.connect(os.environ["PREVIS_DB_PATH"])
    try:
        row = connection.execute("SELECT revision FROM projects WHERE id = ?", (project_id,)).fetchone()
        return int(row[0])
    finally:
        connection.close()


def item_map(project_id):
    return {str(item["id"]): item for item in blocking(project_id)["items"]}


def main():
    try:
        names = {tool.get("name") for tool in base.TOOLS}
        assert {
            "get_set_reconstruction_contract",
            "validate_set_master_plan",
            "apply_set_master_plan",
            "set_set_collection_lock",
        } <= names

        contract = json.loads(set_extension.call_tool("get_set_reconstruction_contract", {}))
        assert contract["required_workflow"][1].startswith("2.")
        assert contract["locking"]["full_lock"] is True
        assert contract["locking"]["partial_unlock"] is True
        assert contract["ai_boundary"]["frisframe_calls_ai_api"] is False

        created = json.loads(core.handle_create_project("2D Master Set"))
        project_id = created["project_id"]
        start_revision = created["revision"]
        initial = blocking(project_id)
        actor_id = initial["items"][0]["id"]

        master_plan = {
            "source_name": "MAID SAKURA style plan",
            "unit": "meter",
            "declared_width_m": 8.6,
            "declared_depth_m": 14.8,
            "collections": [
                {"id": "architecture", "name": "Architecture", "locked": True},
                {"id": "furniture", "name": "Furniture", "locked": False},
            ],
            "elements": [
                {
                    "id": "floor-main",
                    "name": "Main floor",
                    "kind": "floor",
                    "collection_id": "architecture",
                    "world_x_m": 0,
                    "world_z_m": 0,
                    "width_m": 8.4,
                    "depth_m": 14.4,
                    "basis": "observed",
                    "confidence": 0.95,
                },
                {
                    "id": "wall-left",
                    "name": "Left wall",
                    "kind": "wall",
                    "collection_id": "architecture",
                    "start_x_m": -4.2,
                    "start_z_m": -7.2,
                    "end_x_m": -4.2,
                    "end_z_m": 7.2,
                    "thickness_m": 0.16,
                    "height_m": 2.8,
                    "basis": "observed",
                    "confidence": 0.92,
                },
                {
                    "id": "wall-back",
                    "name": "Back wall",
                    "kind": "wall",
                    "collection_id": "architecture",
                    "start_x_m": -4.2,
                    "start_z_m": -7.2,
                    "end_x_m": 4.2,
                    "end_z_m": -7.2,
                    "thickness_m": 0.16,
                    "height_m": 2.8,
                    "basis": "observed",
                    "confidence": 0.9,
                },
                {
                    "id": "main-door",
                    "name": "Main double door",
                    "kind": "door",
                    "collection_id": "architecture",
                    "world_x_m": 0,
                    "world_z_m": 7.1,
                    "width_m": 1.8,
                    "depth_m": 0.12,
                    "height_m": 2.2,
                    "basis": "user_fixed",
                },
                {
                    "id": "counter",
                    "name": "Payment counter",
                    "kind": "counter",
                    "collection_id": "furniture",
                    "world_x_m": 2.5,
                    "world_z_m": 1.5,
                    "width_m": 1.0,
                    "depth_m": 4.5,
                    "basis": "observed",
                    "confidence": 0.86,
                },
                {
                    "id": "table-1",
                    "name": "Round table proxy",
                    "kind": "table",
                    "collection_id": "furniture",
                    "world_x_m": -1.4,
                    "world_z_m": 1.5,
                    "width_m": 1.0,
                    "depth_m": 1.0,
                    "basis": "observed",
                    "confidence": 0.82,
                },
            ],
        }

        validated = json.loads(set_extension.call_tool("validate_set_master_plan", {
            "project_id": project_id,
            "master_plan": master_plan,
        }))
        assert validated["status"] == "ready", validated
        assert validated["workflow_policy"] == "2d-master-first-single-source-of-truth"
        assert validated["summary"]["element_count"] == 6
        assert abs(validated["bounds"]["depth_m"] - 14.4) < 0.3

        applied = json.loads(set_extension.call_tool("apply_set_master_plan", {
            "project_id": project_id,
            "revision": start_revision,
            "master_plan": master_plan,
            "lock_after_apply": True,
        }))
        assert applied["revision"] == start_revision + 1
        assert applied["set_master_plan"]["atomic_revision"] is True
        assert applied["set_master_plan"]["2d_3d_policy"] == "same-items-same-referenceDimensionsM"

        items = item_map(project_id)
        for item_id in ("floor-main", "wall-left", "wall-back", "main-door", "counter", "table-1"):
            assert item_id in items
            assert items[item_id]["type"] == "prop"
            assert items[item_id]["editLocked"] is True
            assert items[item_id]["motionEnabled"] is False
        assert actor_id in items
        assert items[actor_id].get("editLocked") is False

        floor = items["floor-main"]
        assert abs(floor["x"] - 0.5) < 1e-9
        assert abs(floor["y"] - 0.5) < 1e-9
        assert floor["referenceDimensionsM"] == {"width": 8.4, "height": 0.08, "depth": 14.4}
        left = items["wall-left"]
        assert abs(left["referenceDimensionsM"]["width"] - 14.4) < 1e-9
        assert abs(left["referenceDimensionsM"]["depth"] - 0.16) < 1e-9
        assert abs((left["facing"] % 360) - 90) < 1e-9

        persisted = blocking(project_id)
        assert persisted["setMasterPlan"]["workflowPolicy"] == "2d-master-first-single-source-of-truth"
        assert set(persisted["setMasterPlan"]["generatedItemIds"]) == {
            "floor-main", "wall-left", "wall-back", "main-door", "counter", "table-1",
        }
        collection_map = {entry["id"]: entry for entry in persisted["setCollections"]}
        assert collection_map["architecture"]["locked"] is True
        assert collection_map["furniture"]["locked"] is True
        assert "table-1" in collection_map["furniture"]["memberIds"]

        unlocked = json.loads(set_extension.call_tool("set_set_collection_lock", {
            "project_id": project_id,
            "revision": applied["revision"],
            "collection_id": "furniture",
            "mode": "unlock_members",
            "item_ids": ["table-1"],
        }))
        assert unlocked["revision"] == applied["revision"] + 1
        items = item_map(project_id)
        assert items["table-1"]["editLocked"] is False
        assert items["counter"]["editLocked"] is True
        furniture = next(entry for entry in blocking(project_id)["setCollections"] if entry["id"] == "furniture")
        assert furniture["locked"] is True
        assert furniture["unlockedMemberIds"] == ["table-1"]

        architecture_unlocked = json.loads(set_extension.call_tool("set_set_collection_lock", {
            "project_id": project_id,
            "revision": unlocked["revision"],
            "collection_id": "architecture",
            "mode": "unlock_all",
        }))
        assert architecture_unlocked["revision"] == unlocked["revision"] + 1
        items = item_map(project_id)
        for item_id in ("floor-main", "wall-left", "wall-back", "main-door"):
            assert items[item_id]["editLocked"] is False
        assert items["counter"]["editLocked"] is True

        replacement = json.loads(json.dumps(master_plan))
        replacement["elements"] = [entry for entry in replacement["elements"] if entry["id"] != "table-1"]
        replacement["elements"].append({
            "id": "chair-1",
            "name": "Chair",
            "kind": "chair",
            "collection_id": "furniture",
            "world_x_m": -1.4,
            "world_z_m": 2.2,
            "width_m": 0.55,
            "depth_m": 0.55,
            "basis": "observed",
            "confidence": 0.8,
        })
        replaced = json.loads(set_extension.call_tool("apply_set_master_plan", {
            "project_id": project_id,
            "revision": architecture_unlocked["revision"],
            "master_plan": replacement,
            "replace_existing_set": True,
            "lock_after_apply": False,
        }))
        items = item_map(project_id)
        assert "table-1" not in items
        assert "chair-1" in items
        assert actor_id in items
        assert replaced["revision"] == architecture_unlocked["revision"] + 1

        stable_revision = revision(project_id)
        review_plan = {
            "source_name": "low confidence guess",
            "elements": [{
                "id": "guess-only",
                "kind": "wall",
                "start_x_m": -1,
                "start_z_m": 0,
                "end_x_m": 1,
                "end_z_m": 0,
                "basis": "inferred",
                "confidence": 0.3,
            }],
        }
        review = json.loads(set_extension.call_tool("validate_set_master_plan", {
            "project_id": project_id,
            "master_plan": review_plan,
        }))
        assert review["status"] == "review"
        assert any(issue["code"] == "missing-reliable-observation" for issue in review["issues"])
        try:
            set_extension.call_tool("apply_set_master_plan", {
                "project_id": project_id,
                "revision": stable_revision,
                "master_plan": review_plan,
            })
        except ValueError as error:
            assert "set-master-plan-review-required" in str(error)
        else:
            raise AssertionError("review plan must be blocked by default")
        assert revision(project_id) == stable_revision

        outside_plan = {
            "elements": [{
                "id": "outside",
                "kind": "floor",
                "world_x_m": 30,
                "world_z_m": 0,
                "width_m": 4,
                "depth_m": 4,
                "basis": "observed",
                "confidence": 0.9,
            }],
        }
        outside = json.loads(set_extension.call_tool("validate_set_master_plan", {
            "project_id": project_id,
            "master_plan": outside_plan,
        }))
        assert outside["status"] == "review"
        assert any(issue["code"] == "elements-outside-stage" for issue in outside["issues"])

        print("set-reconstruction-mcp: 2D master plan, metric 2D/3D source, replacement, and collection locking passed")
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


if __name__ == "__main__":
    main()
