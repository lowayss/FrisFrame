#!/usr/bin/env python3
"""Packaged stdio entrypoint for the FrisFrame deterministic MCP server."""

from __future__ import annotations

import os
import sys
from pathlib import Path


def electron_user_data_candidates() -> list[Path]:
    home = Path.home()
    if sys.platform == "darwin":
        return [home / "Library" / "Application Support" / "FrisFrame"]
    if sys.platform == "win32":
        candidates: list[Path] = []
        for variable in ("APPDATA", "LOCALAPPDATA"):
            value = os.environ.get(variable)
            if value:
                candidates.append(Path(value) / "FrisFrame")
        if candidates:
            return candidates
        return [home / "AppData" / "Roaming" / "FrisFrame"]
    config_home = Path(os.environ.get("XDG_CONFIG_HOME") or (home / ".config"))
    return [config_home / "FrisFrame"]


def resolve_desktop_database() -> Path:
    explicit = os.environ.get("PREVIS_DB_PATH")
    if explicit:
        return Path(explicit).expanduser()

    candidates = [root / "data" / "frisframe.db" for root in electron_user_data_candidates()]
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return candidates[0]


def prepare_environment() -> Path:
    database = resolve_desktop_database()
    database.parent.mkdir(parents=True, exist_ok=True)
    os.environ["PREVIS_DB_PATH"] = str(database)
    os.environ.setdefault("FRISFRAME_MCP_OWNER_LICENSE_HASH", "local")
    os.environ.setdefault("PYTHONUNBUFFERED", "1")
    return database


def configure_stdio_utf8() -> None:
    """Keep JSON-RPC stdio UTF-8 on Windows/PyInstaller as MCP expects."""
    for stream_name in ("stdin", "stdout", "stderr"):
        stream = getattr(sys, stream_name, None)
        reconfigure = getattr(stream, "reconfigure", None)
        if not callable(reconfigure):
            continue
        try:
            reconfigure(encoding="utf-8", errors="strict")
        except (OSError, ValueError):
            # Some embedded hosts expose immutable text streams. In those hosts
            # the launcher-provided encoding remains authoritative.
            pass


def main() -> None:
    configure_stdio_utf8()
    database = prepare_environment()
    sys.stderr.write(f"[FrisFrame MCP] database={database}\n")
    sys.stderr.flush()
    from mcp_previs_server import main as run_mcp
    run_mcp()


if __name__ == "__main__":
    main()
