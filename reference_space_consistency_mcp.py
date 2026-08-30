#!/usr/bin/env python3
"""Multi-anchor consistency checks for deterministic Reference Space reconstruction."""

from __future__ import annotations

import json

import mcp_previs_server as base
import reference_space_core as space
import reference_space_mcp as reference


ANCHOR_SCHEMA = {
    "type": "object",
    "properties": {
        "id": {"type": "string"},
        "axis": {"type": "string", "enum": ["height", "width"]},
        "physical_size_m": {"type": "number", "exclusiveMinimum": 0},
        "frame_fraction": {"type": "number", "exclusiveMinimum": 0},
        "measured_pixels": {"type": "number", "exclusiveMinimum": 0},
        "image_axis_pixels": {"type": "number", "exclusiveMinimum": 0},
        "distance_m": {"type": "number", "exclusiveMinimum": 0},
    },
    "required": ["physical_size_m", "distance_m"],
}

CONSISTENCY_TOOL = {
    "name": "check_reference_anchor_consistency",
    "description": (
        "실제 distance_m이 확인된 Scale Anchor 2개 이상이 같은 카메라 focal을 지지하는지 검사합니다. "
        "각 앵커의 focal을 독립적으로 계산하며 자동 평균하거나 적용하지 않습니다."
    ),
    "inputSchema": {
        "type": "object",
        "properties": {
            "project_id": {"type": "string"},
            "scene_index": {"type": "integer", "minimum": 0},
            "cut_index": {"type": "integer", "minimum": 0},
            "anchors": {"type": "array", "minItems": 2, "maxItems": 32, "items": ANCHOR_SCHEMA},
            "sensor_width_mm": {"type": "number", "exclusiveMinimum": 0},
            "aspect": {"type": "number", "exclusiveMinimum": 0},
            "tolerance_ratio": {"type": "number", "minimum": 0, "maximum": 1},
            "expected_focal_mm": {"type": "number", "exclusiveMinimum": 0},
        },
        "required": ["anchors"],
    },
}

_PREVIOUS_CALL_TOOL = base.call_tool


def evaluate(args):
    defaults = {}
    if args.get("project_id"):
        blocking = reference._blocking(args)
        defaults = reference._camera_defaults(blocking)
    return space.evaluate_scale_anchor_consistency(
        args.get("anchors"),
        sensor_width_mm=args.get("sensor_width_mm", defaults.get("sensor_width_mm", space.DEFAULT_SENSOR_WIDTH_MM)),
        aspect=args.get("aspect", defaults.get("aspect", "16:9")),
        tolerance_ratio=args.get("tolerance_ratio", 0.08),
        expected_focal_mm=args.get("expected_focal_mm"),
    )


def call_tool(name, args):
    if name == "check_reference_anchor_consistency":
        return json.dumps(evaluate(args), ensure_ascii=False)
    return _PREVIOUS_CALL_TOOL(name, args)


def install():
    if getattr(base, "_reference_space_consistency_extension_installed", False):
        return
    names = {tool.get("name") for tool in base.TOOLS}
    if CONSISTENCY_TOOL["name"] not in names:
        base.TOOLS.append(CONSISTENCY_TOOL)
    base.call_tool = call_tool
    base._reference_space_consistency_extension_installed = True


install()
