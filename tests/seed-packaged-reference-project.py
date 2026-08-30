#!/usr/bin/env python3
"""Seed managed FrisFrame projects for packaged MCP integration verification."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

if not os.environ.get("PREVIS_DB_PATH"):
    raise SystemExit("PREVIS_DB_PATH is required")
os.environ.setdefault("FRISFRAME_MCP_OWNER_LICENSE_HASH", "local")

import mcp_server as core  # noqa: E402
import mcp_previs_server as base  # noqa: E402
import reference_space_core as space  # noqa: E402
import reference_space_mcp as reference  # noqa: E402


def project_state(project_id):
    project = json.loads(core.handle_get_project(project_id))
    blocking = project["document"]["project"]["scenes"][0]["cuts"][0]["blocking"]
    actor = next(item for item in blocking["items"] if item.get("type") == "actor")
    return project, blocking, actor


def create_plain_project():
    created = json.loads(core.handle_create_project("Packaged Reference Orientation"))
    project, _blocking, actor = project_state(created["project_id"])
    return {
        "project_id": created["project_id"],
        "revision": int(project["revision"]),
        "actor_id": str(actor["id"]),
    }


def create_horizon_guard_project():
    created = json.loads(core.handle_create_project("Packaged Reference Horizon Guard"))
    project_id = created["project_id"]
    project, blocking, actor = project_state(project_id)
    camera = blocking["camera"]
    setup = blocking.get("cameraSetup") or {}
    observed_horizon = space.horizon_from_tilt(
        camera.get("tiltDeg", 0),
        camera.get("focal", 50),
        setup.get("sensorWidthMm", 36),
        blocking.get("aspect", "16:9"),
    )
    payload = base._target_args({
        "revision": int(project["revision"]),
        "scene_index": 0,
        "cut_index": 0,
    })
    payload["operations"] = []
    payload["spatial_guide"] = reference._merge_guide(blocking, "Packaged Horizon Guard", [{
        "id": "packaged-reference-horizon",
        "label": "Packaged reference horizon",
        "kind": "horizon",
        "image_y": observed_horizon,
        "confidence": 1,
    }])
    persisted = json.loads(core.handle_apply_scene_commands(project_id, payload))
    updated, updated_blocking, updated_actor = project_state(project_id)
    assert int(updated["revision"]) == int(persisted["revision"])
    assert reference._persisted_horizon(updated_blocking.get("spatialGuide") or {}) is not None
    return {
        "project_id": project_id,
        "revision": int(updated["revision"]),
        "actor_id": str(updated_actor["id"]),
        "horizon_y": observed_horizon,
    }


def create_keyframed_project():
    created = json.loads(core.handle_create_project("Packaged Reference Camera Keyframe Guard"))
    project_id = created["project_id"]
    project, _blocking, actor = project_state(project_id)
    applied = json.loads(base.call_tool("apply_motion_timeline", {
        "project_id": project_id,
        "revision": int(project["revision"]),
        "scene_index": 0,
        "cut_index": 0,
        "operations": [{
            "op": "add_keyframe",
            "source_id": "camera",
            "time": 1.0,
            "pan_deg": 180,
            "tilt_deg": -6,
            "focal": 85,
            "transition": "linear",
        }],
    }))
    updated, updated_blocking, updated_actor = project_state(project_id)
    assert int(updated["revision"]) == int(applied["revision"])
    assert reference._camera_keyframes(updated_blocking), "camera keyframe fixture was not persisted"
    return {
        "project_id": project_id,
        "revision": int(updated["revision"]),
        "actor_id": str(updated_actor["id"]),
        "camera_keyframes": len(reference._camera_keyframes(updated_blocking)),
    }


def main() -> None:
    plain = create_plain_project()
    fixture = {
        **plain,
        "horizon_guard": create_horizon_guard_project(),
        "keyframed": create_keyframed_project(),
    }
    print(json.dumps(fixture, ensure_ascii=False))


if __name__ == "__main__":
    main()
