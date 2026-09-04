#!/usr/bin/env python3
from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    with tempfile.TemporaryDirectory(prefix="frisframe-camera-motion-hint-") as directory:
        old_db = os.environ.get("PREVIS_DB_PATH")
        old_owner = os.environ.get("FRISFRAME_MCP_OWNER_LICENSE_HASH")
        os.environ["PREVIS_DB_PATH"] = str(Path(directory) / "motion-hint.db")
        os.environ["FRISFRAME_MCP_OWNER_LICENSE_HASH"] = "local"
        try:
            if str(ROOT) not in sys.path:
                sys.path.insert(0, str(ROOT))

            import camera_take_context_mcp as extension

            summary = {
                "available": True,
                "motion_phases": {
                    "phase_count": 4,
                    "raw_phase_count": 4,
                    "compacted": False,
                    "phases": [
                        {
                            "cues": [
                                {"type": "pan", "direction": "positive"},
                                {"type": "stage-translate", "x": 0.2, "units": "frisframe-stage-units", "physical_meters": False},
                            ],
                        },
                        {"cues": [{"type": "lens", "direction": "positive", "fov_change": "narrower"}]},
                        {
                            "cues": [
                                {"type": "pan", "direction": "negative"},
                                {"type": "stage-translate", "x": 0.2, "units": "frisframe-stage-units", "physical_meters": False},
                            ],
                        },
                        {"cues": [{"type": "hold"}]},
                    ],
                },
            }
            hint = extension._camera_path_motion_hint(summary)
            assert hint == {
                "available": True,
                "phase_count": 4,
                "raw_phase_count": 4,
                "compacted": False,
                "sequence": ["pan:+/move", "lens:in", "pan:-/move", "hold"],
                "omitted_phase_count": 0,
                "action_types": ["pan", "stage-translate", "lens", "hold"],
                "has_hold": True,
                "direction_reversals": ["pan"],
            }

            long_summary = {
                "available": True,
                "motion_phases": {
                    "phase_count": 12,
                    "raw_phase_count": 29,
                    "compacted": True,
                    "phases": [
                        {"cues": [{"type": "pan", "direction": "positive" if index % 2 == 0 else "negative"}]}
                        for index in range(12)
                    ],
                },
            }
            long_hint = extension._camera_path_motion_hint(long_summary)
            assert long_hint["phase_count"] == 12
            assert long_hint["raw_phase_count"] == 29
            assert long_hint["compacted"] is True
            assert len(long_hint["sequence"]) == 6
            assert long_hint["omitted_phase_count"] == 6
            assert long_hint["direction_reversals"] == ["pan"]

            legacy_hint = extension._camera_path_motion_hint({
                "available": False,
                "reason": "legacy-take-without-camera-path",
            })
            assert legacy_hint == {
                "available": False,
                "reason": "legacy-take-without-camera-path",
            }

            take = {
                "id": "hint-take",
                "cameraPath": {
                    "fingerprint": "hint-path",
                    "keyframes": [
                        {"time": 0, "pose": {"x": 0, "y": 0, "height": 1.6, "panDeg": 0, "tiltDeg": 0, "focal": 35}},
                        {"time": 1, "pose": {"x": 0.2, "y": 0, "height": 1.6, "panDeg": 20, "tiltDeg": 0, "focal": 35}},
                        {"time": 2, "pose": {"x": 0.2, "y": 0, "height": 1.6, "panDeg": 20, "tiltDeg": 0, "focal": 50}},
                        {"time": 3, "pose": {"x": 0.4, "y": 0, "height": 1.6, "panDeg": 5, "tiltDeg": 0, "focal": 50}},
                        {"time": 4, "pose": {"x": 0.4, "y": 0, "height": 1.6, "panDeg": 5, "tiltDeg": 0, "focal": 50}},
                    ],
                },
            }
            listed = extension._take_summary(take, 0, "hint-take", "hint-take")
            assert listed["motion_hint"]["sequence"] == ["pan:+/move", "lens:in", "pan:-/move", "hold"]
            assert listed["motion_hint"]["direction_reversals"] == ["pan"]

            print("Camera Take Motion Hint MCP: compact sequence, truncation, reversal and legacy behavior passed")
        finally:
            if old_db is None:
                os.environ.pop("PREVIS_DB_PATH", None)
            else:
                os.environ["PREVIS_DB_PATH"] = old_db
            if old_owner is None:
                os.environ.pop("FRISFRAME_MCP_OWNER_LICENSE_HASH", None)
            else:
                os.environ["FRISFRAME_MCP_OWNER_LICENSE_HASH"] = old_owner


if __name__ == "__main__":
    main()
