#!/usr/bin/env python3
from __future__ import annotations

import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import spatial_quality_mcp as quality


def sample_interpretation():
    return {
        "source_name": "quality-fixture",
        "objects": [
            {
                "id": "wall-a",
                "kind": "wall",
                "start_x_m": -3.0,
                "start_z_m": -2.0,
                "end_x_m": 0.05,
                "end_z_m": -2.0,
                "height_m": 2.8,
                "basis": "observed",
                "confidence": 0.95,
            },
            {
                "id": "wall-b",
                "kind": "wall",
                "start_x_m": 0.0,
                "start_z_m": -1.94,
                "end_x_m": 0.0,
                "end_z_m": 2.0,
                "height_m": 2.8,
                "basis": "observed",
                "confidence": 0.95,
            },
            {
                "id": "wall-island",
                "kind": "wall",
                "start_x_m": 5.0,
                "start_z_m": 5.0,
                "end_x_m": 7.0,
                "end_z_m": 5.0,
                "height_m": 2.8,
                "basis": "inferred",
                "confidence": 0.5,
            },
            {
                "id": "door-1",
                "kind": "door",
                "world_x_m": 0.18,
                "world_z_m": 0.4,
                "width_m": 0.9,
                "depth_m": 0.12,
                "height_m": 2.1,
                "rotation_deg": 86,
                "basis": "observed",
                "confidence": 0.9,
            },
        ],
    }


def closed_room_interpretation():
    return {
        "source_name": "closed-room-fixture",
        "objects": [
            {
                "id": "bottom",
                "kind": "wall",
                "start_x_m": -2.0,
                "start_z_m": -1.5,
                "end_x_m": 2.0,
                "end_z_m": -1.5,
                "height_m": 2.8,
                "basis": "observed",
                "confidence": 0.95,
            },
            {
                "id": "right",
                "kind": "wall",
                "start_x_m": 2.0,
                "start_z_m": -1.5,
                "end_x_m": 2.0,
                "end_z_m": 1.5,
                "height_m": 2.8,
                "basis": "observed",
                "confidence": 0.95,
            },
            {
                "id": "top",
                "kind": "wall",
                "start_x_m": 2.0,
                "start_z_m": 1.5,
                "end_x_m": -2.0,
                "end_z_m": 1.5,
                "height_m": 2.8,
                "basis": "observed",
                "confidence": 0.95,
            },
            {
                "id": "left",
                "kind": "wall",
                "start_x_m": -2.0,
                "start_z_m": 1.5,
                "end_x_m": -2.0,
                "end_z_m": -1.5,
                "height_m": 2.8,
                "basis": "observed",
                "confidence": 0.95,
            },
        ],
    }


def main():
    original = sample_interpretation()
    enhanced, report = quality.enhance_interpretation(original)

    # Input must remain immutable.
    assert original["objects"][0]["end_x_m"] == 0.05
    assert original["objects"][1]["start_z_m"] == -1.94

    wall_a = enhanced["objects"][0]
    wall_b = enhanced["objects"][1]
    door = enhanced["objects"][3]

    # Two near endpoints become one canonical corner.
    assert report["snapped_endpoint_count"] == 2, report
    assert report["snap_cluster_count"] == 1, report
    assert math.isclose(wall_a["end_x_m"], wall_b["start_x_m"], abs_tol=1e-9)
    assert math.isclose(wall_a["end_z_m"], wall_b["start_z_m"], abs_tol=1e-9)

    # A nearby opening attaches to the vertical-ish wall and aligns to its actual snapped angle.
    assert door["parent_id"] == "wall-b", door
    assert report["inferred_attachment_count"] == 1, report
    wall_angle = math.degrees(math.atan2(
        wall_b["end_z_m"] - wall_b["start_z_m"],
        wall_b["end_x_m"] - wall_b["start_x_m"],
    ))
    assert math.isclose(door["rotation_deg"], wall_angle, abs_tol=1e-6), (door, wall_angle)

    # The disconnected island remains disconnected instead of being fabricated into a room.
    topology = report["topology"]
    assert topology["connected_component_count"] == 2, topology
    assert topology["open_endpoint_count"] >= 4, topology
    assert report["status"] == "review", report
    assert report["room_zone_count"] == 0, report
    assert "no missing wall is synthesized" in report["guardrail"].lower(), report

    # Tightening the opening tolerance must not attach the door.
    strict, strict_report = quality.enhance_interpretation(original, opening_attach_tolerance_m=0.1)
    assert not strict["objects"][3].get("parent_id"), strict["objects"][3]
    assert strict_report["inferred_attachment_count"] == 0, strict_report

    # Four actual closed walls derive one metric room zone. No floor/wall is synthesized.
    closed, closed_report = quality.enhance_interpretation(closed_room_interpretation())
    assert closed_report["status"] == "ready", closed_report
    assert closed_report["topology"]["open_endpoint_count"] == 0, closed_report
    assert closed_report["room_zone_count"] == 1, closed_report
    zone = closed_report["room_zones"][0]
    assert math.isclose(zone["area_m2"], 12.0, abs_tol=1e-9), zone
    assert math.isclose(zone["perimeter_m"], 14.0, abs_tol=1e-9), zone
    assert set(zone["wall_ids"]) == {"bottom", "right", "top", "left"}, zone
    assert closed["derived_room_zones"] == closed_report["room_zones"], closed

    # Break one wall: the derived room must disappear rather than inventing a closing wall.
    open_room = closed_room_interpretation()
    open_room["objects"].pop()
    open_result, open_report = quality.enhance_interpretation(open_room)
    assert open_report["room_zone_count"] == 0, open_report
    assert open_report["status"] == "review", open_report
    assert open_result["derived_room_zones"] == [], open_result

    print("spatial-quality-mcp: endpoint canonicalization, wall attachment, topology diagnostics, and closed room zones passed")


if __name__ == "__main__":
    main()
