#!/usr/bin/env python3
"""Seed one managed FrisFrame project for packaged MCP integration verification."""

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


def main() -> None:
    created = json.loads(core.handle_create_project("Packaged Reference Orientation"))
    project_id = created["project_id"]
    project = json.loads(core.handle_get_project(project_id))
    blocking = project["document"]["project"]["scenes"][0]["cuts"][0]["blocking"]
    actor = next(item for item in blocking["items"] if item.get("type") == "actor")
    print(json.dumps({
        "project_id": project_id,
        "revision": int(project["revision"]),
        "actor_id": str(actor["id"]),
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
