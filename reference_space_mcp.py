#!/usr/bin/env python3
"""Reference Space tools layered onto FrisFrame's existing previs MCP server."""

from __future__ import annotations

import json

import mcp_previs_server as base
import mcp_server as core
import reference_space_core as space

REFERENCE_SPACE_TOOLS = [
    {
        "name": "calibrate_reference_camera",
        "description": "외부 모델이 측정한 실제 크기/화면 점유율로 거리·렌즈·FOV·수평선 틸트를 계산합니다. FrisFrame은 이미지를 분석하지 않습니다.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "project_id": {"type": "string"}, "scene_index": {"type": "integer", "minimum": 0}, "cut_index": {"type": "integer", "minimum": 0},
                "axis": {"type": "string", "enum": ["height", "width"]}, "physical_size_m": {"type": "number", "exclusiveMinimum": 0},
                "frame_fraction": {"type": "number", "exclusiveMinimum": 0}, "measured_pixels": {"type": "number", "exclusiveMinimum": 0},
                "image_axis_pixels": {"type": "number", "exclusiveMinimum": 0}, "focal_mm": {"type": "number", "exclusiveMinimum": 0},
                "distance_m": {"type": "number", "exclusiveMinimum": 0}, "sensor_width_mm": {"type": "number", "exclusiveMinimum": 0},
                "aspect": {"type": "number", "exclusiveMinimum": 0}, "horizon_y": {"type": "number", "minimum": 0, "maximum": 1},
                "image_x": {"type": "number", "minimum": 0, "maximum": 1}
            },
            "required": ["physical_size_m"]
        }
    },
    {
        "name": "apply_reference_mass_blocks",
        "description": "외부 모델이 확정한 큰 공간 덩어리를 world meter + 실제 W/H/D로 현재 컷에 업서트하고 spatialGuide 앵커와 연결합니다.",
        "inputSchema": {
            "type": "object",
            "properties": {
                **base.COMMON_TARGET_PROPERTIES,
                "source_name": {"type": "string"}, "allow_outside_stage": {"type": "boolean"},
                "masses": {"type": "array", "minItems": 1, "maxItems": 100, "items": {"type": "object"}}
            },
            "required": ["project_id", "revision", "masses"]
        }
    },
    {
        "name": "validate_reference_space",
        "description": "현재 spatialGuide 앵커와 실제 더미 위치/치수, 현재 카메라의 scale anchor 화면 점유율 및 horizon 오차를 검증합니다.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "project_id": {"type": "string"}, "scene_index": {"type": "integer", "minimum": 0}, "cut_index": {"type": "integer", "minimum": 0},
                "position_tolerance_m": {"type": "number", "exclusiveMinimum": 0}, "dimension_tolerance_ratio": {"type": "number", "minimum": 0, "maximum": 1},
                "frame_tolerance": {"type": "number", "minimum": 0, "maximum": 1}, "horizon_y": {"type": "number", "minimum": 0, "maximum": 1},
                "scale_anchors": {"type": "array", "maxItems": 32, "items": {"type": "object"}}
            },
            "required": ["project_id"]
        }
    }
]

_ORIGINAL_CALL_TOOL = base.call_tool


def _blocking(args):
    return base._load_blocking(args.get("project_id"), int(args.get("scene_index", 0)), int(args.get("cut_index", 0)))


def _camera_defaults(blocking):
    camera = blocking.get("camera") or {}
    setup = blocking.get("cameraSetup") or {}
    return {"focal_mm": camera.get("focal", 50), "sensor_width_mm": setup.get("sensorWidthMm", 36), "aspect": blocking.get("aspect", "16:9")}


def _merge_guide(blocking, source_name, anchors):
    existing = blocking.get("spatialGuide") if isinstance(blocking.get("spatialGuide"), dict) else {}
    merged = {str(a.get("id")): dict(a) for a in existing.get("anchors", []) if isinstance(a, dict) and a.get("id")}
    for anchor in anchors:
        merged[str(anchor["id"])] = anchor
    return {
        "source_name": str(source_name or existing.get("sourceName") or "Reference Space")[:160],
        "source_kind": "external-analysis", "status": "applied", "opacity": existing.get("opacity", 0.22),
        "anchors": list(merged.values()), "depth_layers": existing.get("depthLayers") or []
    }


def _apply_mass_blocks(args):
    blocking = _blocking(args)
    plan = space.mass_block_plan(blocking, args.get("masses"), bool(args.get("allow_outside_stage", False)))
    payload = base._target_args(args)
    payload["operations"] = plan["operations"]
    payload["spatial_guide"] = _merge_guide(blocking, args.get("source_name"), plan["anchors"])
    result = base._json_result(core.handle_apply_scene_commands(args.get("project_id"), payload))
    if "revision" not in result:
        raise ValueError(result.get("raw", "Reference mass 적용 결과를 읽지 못했습니다."))
    result["reference_space"] = {"masses": [a["id"] for a in plan["anchors"]], "stage": plan["stage"], "issues": plan["issues"]}
    return result


def _world_xy(blocking, item):
    width, depth = space.stage_dimensions(blocking.get("aspect", "16:9"))
    return (float(item.get("x", 0.5)) - 0.5) * width, (float(item.get("y", 0.5)) - 0.5) * depth


def _target_distance(blocking, target_id):
    item = base._find_item(blocking, target_id)
    camera = blocking.get("camera") or {}
    width, depth = space.stage_dimensions(blocking.get("aspect", "16:9"))
    dx = (float(item.get("x", 0.5)) - float(camera.get("x", 0.5))) * width
    dz = (float(item.get("y", 0.5)) - float(camera.get("y", 0.5))) * depth
    dims = item.get("referenceDimensionsM") if isinstance(item.get("referenceDimensionsM"), dict) else {}
    height = float(dims.get("height", 1.78 if item.get("type") == "actor" else 1.0))
    bottom = float(item.get("verticalOffset", item.get("mountedHeight", 0)) or 0)
    dy = bottom + height / 2 - float(camera.get("height", 1.6))
    return (dx * dx + dz * dz + dy * dy) ** 0.5


def _relative_error(actual, expected):
    return abs(float(actual) - float(expected)) / max(abs(float(expected)), 1e-9)


def _validate(args):
    blocking = _blocking(args)
    position_tol = float(args.get("position_tolerance_m", 0.05))
    dimension_tol = float(args.get("dimension_tolerance_ratio", 0.02))
    frame_tol = float(args.get("frame_tolerance", 0.03))
    items = {str(item.get("id")): item for item in blocking.get("items", [])}
    guide = blocking.get("spatialGuide") if isinstance(blocking.get("spatialGuide"), dict) else {}
    issues, checked = [], []
    for anchor in guide.get("anchors") or []:
        if not isinstance(anchor, dict):
            continue
        aid = str(anchor.get("id") or "")
        iid = str(anchor.get("attachedItemId") or aid)
        item = items.get(iid)
        if not item:
            issues.append({"code": "anchor-item-missing", "anchor_id": aid, "item_id": iid})
            continue
        wx, wz = _world_xy(blocking, item)
        ex, ez = anchor.get("worldX"), anchor.get("worldZ")
        if ex is not None and abs(wx - float(ex)) > position_tol:
            issues.append({"code": "anchor-x-mismatch", "anchor_id": aid, "actual_m": wx, "expected_m": float(ex)})
        if ez is not None and abs(wz - float(ez)) > position_tol:
            issues.append({"code": "anchor-z-mismatch", "anchor_id": aid, "actual_m": wz, "expected_m": float(ez)})
        expected_dims, actual_dims = anchor.get("dimensionsM"), item.get("referenceDimensionsM")
        if isinstance(expected_dims, dict) and isinstance(actual_dims, dict):
            for key in ("width", "height", "depth"):
                if key in expected_dims and key in actual_dims and _relative_error(actual_dims[key], expected_dims[key]) > dimension_tol:
                    issues.append({"code": "anchor-dimension-mismatch", "anchor_id": aid, "dimension": key})
        checked.append({"anchor_id": aid, "item_id": iid, "world_x_m": wx, "world_z_m": wz})

    defaults = _camera_defaults(blocking)
    camera = blocking.get("camera") or {}
    projection = []
    for index, obs in enumerate(args.get("scale_anchors") or []):
        axis = "width" if str(obs.get("axis", "height")) == "width" else "height"
        distance = obs.get("distance_m") or _target_distance(blocking, str(obs.get("target_id") or ""))
        predicted = space.predicted_frame_fraction(obs.get("physical_size_m"), distance, defaults["focal_mm"], defaults["sensor_width_mm"], space.aspect_value(defaults["aspect"]), axis)
        observed = float(obs.get("frame_fraction"))
        entry = {"id": str(obs.get("id") or f"scale-{index + 1}"), "observed": observed, "predicted": predicted, "residual": observed - predicted, "distance_m": distance}
        projection.append(entry)
        if abs(entry["residual"]) > frame_tol:
            issues.append({"code": "scale-anchor-frame-mismatch", **entry, "tolerance": frame_tol})

    horizon = None
    if args.get("horizon_y") is not None:
        observed = float(args["horizon_y"])
        predicted = space.horizon_from_tilt(camera.get("tiltDeg", 0), defaults["focal_mm"], defaults["sensor_width_mm"], defaults["aspect"])
        horizon = {"observed": observed, "predicted": predicted, "residual": observed - predicted}
        if abs(horizon["residual"]) > frame_tol:
            issues.append({"code": "horizon-mismatch", **horizon, "tolerance": frame_tol})
    return {"schema": "frisframe-reference-space-validation", "version": 1, "status": "ready" if not issues else "review", "anchors_checked": checked, "projection_checks": projection, "horizon_check": horizon, "issues": issues}


def call_tool(name, args):
    if name == "calibrate_reference_camera":
        blocking = _blocking(args) if args.get("project_id") else None
        defaults = _camera_defaults(blocking) if blocking else None
        return json.dumps(space.calibrate_reference_camera(args, defaults), ensure_ascii=False)
    if name == "apply_reference_mass_blocks":
        return json.dumps(_apply_mass_blocks(args), ensure_ascii=False)
    if name == "validate_reference_space":
        return json.dumps(_validate(args), ensure_ascii=False)
    return _ORIGINAL_CALL_TOOL(name, args)


def install():
    if getattr(base, "_reference_space_extension_installed", False):
        return
    names = {tool.get("name") for tool in base.TOOLS}
    base.TOOLS.extend(tool for tool in REFERENCE_SPACE_TOOLS if tool["name"] not in names)
    base.call_tool = call_tool
    base._reference_space_extension_installed = True


install()
