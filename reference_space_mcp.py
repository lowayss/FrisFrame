#!/usr/bin/env python3
"""Reference Space tools layered onto FrisFrame's existing previs MCP server."""

from __future__ import annotations

import json
import math
import re

import mcp_previs_server as base
import mcp_server as core
import reference_space_core as space


REFERENCE_DIMENSIONS_SCHEMA = {
    "type": "object",
    "properties": {
        "width": {"type": "number", "exclusiveMinimum": 0},
        "height": {"type": "number", "exclusiveMinimum": 0},
        "depth": {"type": "number", "exclusiveMinimum": 0},
    },
    "required": ["width", "height", "depth"],
}

REFERENCE_CAMERA_PROPERTIES = {
    "axis": {"type": "string", "enum": ["height", "width"]},
    "physical_size_m": {"type": "number", "exclusiveMinimum": 0},
    "frame_fraction": {"type": "number", "exclusiveMinimum": 0},
    "measured_pixels": {"type": "number", "exclusiveMinimum": 0},
    "image_axis_pixels": {"type": "number", "exclusiveMinimum": 0},
    "focal_mm": {"type": "number", "exclusiveMinimum": 0},
    "distance_m": {"type": "number", "exclusiveMinimum": 0},
    "sensor_width_mm": {"type": "number", "exclusiveMinimum": 0},
    "aspect": {"type": "number", "exclusiveMinimum": 0},
    "horizon_y": {"type": "number", "minimum": 0, "maximum": 1},
    "image_x": {"type": "number", "minimum": 0, "maximum": 1},
    "image_y": {"type": "number", "minimum": 0, "maximum": 1},
}

REFERENCE_SPACE_TOOLS = [
    {
        "name": "calibrate_reference_camera",
        "description": "외부 모델이 측정한 실제 크기/화면 점유율로 거리·렌즈·FOV·수평선 틸트를 계산합니다. FrisFrame은 이미지를 분석하지 않습니다.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "project_id": {"type": "string"},
                "scene_index": {"type": "integer", "minimum": 0},
                "cut_index": {"type": "integer", "minimum": 0},
                **REFERENCE_CAMERA_PROPERTIES,
            },
            "required": ["physical_size_m"],
        },
    },
    {
        "name": "apply_reference_camera_calibration",
        "description": "확정된 Scale Anchor 측정을 현재 컷의 베이스 카메라와 spatialGuide에 한 revision으로 적용합니다. 카메라 키프레임이 이미 있으면 기본적으로 차단해 기존 프리비즈 타이밍을 보호합니다.",
        "inputSchema": {
            "type": "object",
            "properties": {
                **base.COMMON_TARGET_PROPERTIES,
                **REFERENCE_CAMERA_PROPERTIES,
                "target_id": {"type": "string"},
                "anchor_id": {"type": "string"},
                "horizon_anchor_id": {"type": "string"},
                "source_name": {"type": "string"},
                "confidence": {"type": "number", "minimum": 0, "maximum": 1},
                "reference_dimensions_m": REFERENCE_DIMENSIONS_SCHEMA,
                "apply_focal": {"type": "boolean"},
                "apply_tilt": {"type": "boolean"},
                "apply_distance": {"type": "boolean"},
                "orient_to_target": {"type": "boolean"},
                "allow_keyframed_base_camera": {"type": "boolean"},
            },
            "required": ["project_id", "revision", "target_id", "physical_size_m"],
        },
    },
    {
        "name": "apply_reference_mass_blocks",
        "description": "외부 모델이 확정한 큰 공간 덩어리를 world meter + 실제 W/H/D로 현재 컷에 업서트하고 spatialGuide 앵커와 연결합니다.",
        "inputSchema": {
            "type": "object",
            "properties": {
                **base.COMMON_TARGET_PROPERTIES,
                "source_name": {"type": "string"},
                "allow_outside_stage": {"type": "boolean"},
                "masses": {"type": "array", "minItems": 1, "maxItems": 100, "items": {"type": "object"}},
            },
            "required": ["project_id", "revision", "masses"],
        },
    },
    {
        "name": "validate_reference_space",
        "description": "현재 spatialGuide 앵커와 실제 더미 위치/치수, 저장된 Scale Anchor 화면 점유율 및 horizon 오차를 검증합니다. scale_anchors/horizon_y를 다시 넣지 않아도 적용된 Reference Space 앵커를 재검증합니다.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "project_id": {"type": "string"},
                "scene_index": {"type": "integer", "minimum": 0},
                "cut_index": {"type": "integer", "minimum": 0},
                "position_tolerance_m": {"type": "number", "exclusiveMinimum": 0},
                "dimension_tolerance_ratio": {"type": "number", "minimum": 0, "maximum": 1},
                "frame_tolerance": {"type": "number", "minimum": 0, "maximum": 1},
                "horizon_y": {"type": "number", "minimum": 0, "maximum": 1},
                "scale_anchors": {"type": "array", "maxItems": 32, "items": {"type": "object"}},
            },
            "required": ["project_id"],
        },
    },
]

_ORIGINAL_CALL_TOOL = base.call_tool


def _blocking(args):
    return base._load_blocking(args.get("project_id"), int(args.get("scene_index", 0)), int(args.get("cut_index", 0)))


def _camera_defaults(blocking):
    camera = blocking.get("camera") or {}
    setup = blocking.get("cameraSetup") or {}
    return {
        "focal_mm": camera.get("focal", 50),
        "sensor_width_mm": setup.get("sensorWidthMm", 36),
        "aspect": blocking.get("aspect", "16:9"),
    }


def _merge_guide(blocking, source_name, anchors):
    existing = blocking.get("spatialGuide") if isinstance(blocking.get("spatialGuide"), dict) else {}
    merged = {str(a.get("id")): dict(a) for a in existing.get("anchors", []) if isinstance(a, dict) and a.get("id")}
    for anchor in anchors:
        merged[str(anchor["id"])] = anchor
    return {
        "source_name": str(source_name or existing.get("sourceName") or "Reference Space")[:160],
        "source_kind": "external-analysis",
        "status": "applied",
        "opacity": existing.get("opacity", 0.22),
        "anchors": list(merged.values()),
        "depth_layers": existing.get("depthLayers") or [],
    }


def _anchor_id(value, fallback):
    candidate = str(value or fallback).strip()
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,64}", candidate):
        raise ValueError("Reference anchor id는 영문, 숫자, _, -만 사용할 수 있습니다.")
    return candidate


def _dimensions(value):
    if not isinstance(value, dict):
        return None
    result = {}
    for key in ("width", "height", "depth"):
        result[key] = space.positive(value.get(key), f"reference_dimensions_m.{key}")
    return result


def _target_dimensions(item, axis, physical_size_m, supplied=None):
    provided = _dimensions(supplied)
    if provided:
        mismatch = abs(provided[axis] - physical_size_m) / max(physical_size_m, 1e-9)
        if mismatch > 0.05:
            raise ValueError(f"reference_dimensions_m.{axis}와 physical_size_m 차이가 5%를 초과합니다.")
        provided[axis] = physical_size_m
        return provided

    existing = _dimensions(item.get("referenceDimensionsM"))
    if existing:
        ratio = physical_size_m / existing[axis]
        return {key: value * ratio for key, value in existing.items()}

    if item.get("type") == "actor":
        base_dims = {"width": 0.54, "height": 1.78, "depth": 0.36}
        ratio = physical_size_m / base_dims[axis]
        return {key: value * ratio for key, value in base_dims.items()}

    raise ValueError("소품 Scale Anchor에는 기존 referenceDimensionsM 또는 reference_dimensions_m 전체 W/H/D가 필요합니다.")


def _world_xy(blocking, item):
    width, depth = space.stage_dimensions(blocking.get("aspect", "16:9"))
    return (float(item.get("x", 0.5)) - 0.5) * width, (float(item.get("y", 0.5)) - 0.5) * depth


def _target_center_height(item, dimensions=None):
    dims = dimensions or (_dimensions(item.get("referenceDimensionsM")) if isinstance(item, dict) else None) or {}
    height = float(dims.get("height", 1.78 if item.get("type") == "actor" else 1.0))
    bottom = float(item.get("verticalOffset", item.get("mountedHeight", 0)) or 0)
    return bottom + height / 2


def _target_distance(blocking, target_id, dimensions=None):
    item = base._find_item(blocking, target_id)
    camera = blocking.get("camera") or {}
    width, depth = space.stage_dimensions(blocking.get("aspect", "16:9"))
    dx = (float(item.get("x", 0.5)) - float(camera.get("x", 0.5))) * width
    dz = (float(item.get("y", 0.5)) - float(camera.get("y", 0.5))) * depth
    dy = _target_center_height(item, dimensions) - float(camera.get("height", 1.6))
    return (dx * dx + dz * dz + dy * dy) ** 0.5


def _camera_position_for_distance(blocking, item, dimensions, distance_m):
    camera = blocking.get("camera") or {}
    stage_width, stage_depth = space.stage_dimensions(blocking.get("aspect", "16:9"))
    target_x, target_z = _world_xy(blocking, item)
    camera_x = (float(camera.get("x", 0.5)) - 0.5) * stage_width
    camera_z = (float(camera.get("y", 0.5)) - 0.5) * stage_depth
    vertical = _target_center_height(item, dimensions) - float(camera.get("height", 1.6))
    desired = space.positive(distance_m, "distance_m")
    if desired <= abs(vertical) + 1e-9:
        raise ValueError("Scale Anchor 거리보다 카메라와 피사체 중심의 높이 차가 커서 카메라 위치를 계산할 수 없습니다.")
    horizontal = math.sqrt(max(0.0, desired * desired - vertical * vertical))
    rel_x, rel_z = camera_x - target_x, camera_z - target_z
    rel_length = math.hypot(rel_x, rel_z)
    if rel_length < 1e-6:
        pan = math.radians(float(camera.get("panDeg", 180)))
        rel_x, rel_z, rel_length = -math.cos(pan), -math.sin(pan), 1.0
    unit_x, unit_z = rel_x / rel_length, rel_z / rel_length
    next_world_x = target_x + unit_x * horizontal
    next_world_z = target_z + unit_z * horizontal
    next_x = 0.5 + next_world_x / stage_width
    next_y = 0.5 + next_world_z / stage_depth
    if not (core.STAGE_COORD_MIN <= next_x <= core.STAGE_COORD_MAX and core.STAGE_COORD_MIN <= next_y <= core.STAGE_COORD_MAX):
        raise ValueError(
            f"보정 거리 {desired:.2f}m를 적용하면 카메라가 현재 {stage_width:.2f}m × {stage_depth:.2f}m 무대 밖으로 나갑니다."
        )
    return {
        "x": next_x,
        "y": next_y,
        "world_x_m": next_world_x,
        "world_z_m": next_world_z,
        "horizontal_distance_m": horizontal,
        "vertical_offset_m": vertical,
    }


def _pan_to_target(blocking, camera_x, camera_y, item):
    stage_width, stage_depth = space.stage_dimensions(blocking.get("aspect", "16:9"))
    camera_world_x = (float(camera_x) - 0.5) * stage_width
    camera_world_z = (float(camera_y) - 0.5) * stage_depth
    target_x, target_z = _world_xy(blocking, item)
    return (math.degrees(math.atan2(target_z - camera_world_z, target_x - camera_world_x)) + 360.0) % 360.0


def _camera_keyframes(blocking):
    return [
        key for key in (blocking.get("motion") or {}).get("keyframes", [])
        if isinstance(key, dict) and str(key.get("source")) == "camera"
    ]


def _apply_camera_calibration(args):
    blocking = _blocking(args)
    camera_keys = _camera_keyframes(blocking)
    if camera_keys and not bool(args.get("allow_keyframed_base_camera", False)):
        raise ValueError(
            "camera-keyframes-present: 이 컷에는 카메라 키프레임이 있습니다. "
            "베이스 카메라만 바꾸면 영상 타이밍과 불일치할 수 있으므로 calibrate_reference_camera 후 apply_motion_timeline으로 원하는 시점의 카메라 키를 명시적으로 수정하세요."
        )

    target_id = str(args.get("target_id") or "").strip()
    target = base._find_item(blocking, target_id)
    axis = "width" if str(args.get("axis", "height")).lower() == "width" else "height"
    physical_size_m = space.positive(args.get("physical_size_m"), "physical_size_m")
    target_dims = _target_dimensions(target, axis, physical_size_m, args.get("reference_dimensions_m"))
    calibration = space.calibrate_reference_camera(args, _camera_defaults(blocking))

    apply_focal = bool(args.get("apply_focal", True))
    apply_tilt = bool(args.get("apply_tilt", args.get("horizon_y") is not None))
    apply_distance = bool(args.get("apply_distance", True))
    orient_to_target = bool(args.get("orient_to_target", False))

    if apply_focal and not calibration["applicable_to_frisframe_camera"]:
        raise ValueError(
            f"보정 focal {calibration['focal_mm']:.2f}mm가 FrisFrame 허용 범위 {core.CAMERA_FOCAL_MIN}~{core.CAMERA_FOCAL_MAX}mm 밖입니다."
        )

    anchor_id = _anchor_id(args.get("anchor_id"), f"scale-{target_id}")
    operations = [{
        "op": "update_dummy",
        "id": target_id,
        "anchor_id": anchor_id,
        "physical_dimensions_m": target_dims,
    }]
    camera_operation = {"op": "update_camera"}
    applied = {}

    if apply_focal:
        applied_focal = int(round(calibration["focal_mm"]))
        applied_focal = max(core.CAMERA_FOCAL_MIN, min(core.CAMERA_FOCAL_MAX, applied_focal))
        camera_operation["focal"] = applied_focal
        applied["focal_mm"] = applied_focal
    if apply_tilt:
        if calibration.get("tilt_deg") is None:
            raise ValueError("apply_tilt=true이면 horizon_y가 필요합니다.")
        camera_operation["tilt_deg"] = calibration["tilt_deg"]
        applied["tilt_deg"] = calibration["tilt_deg"]

    position = None
    if apply_distance:
        position = _camera_position_for_distance(blocking, target, target_dims, calibration["distance_m"])
        camera_operation["x"] = position["x"]
        camera_operation["y"] = position["y"]
        applied["distance_m"] = calibration["distance_m"]
        applied["x"] = position["x"]
        applied["y"] = position["y"]

    if orient_to_target:
        camera_x = camera_operation.get("x", (blocking.get("camera") or {}).get("x", 0.5))
        camera_y = camera_operation.get("y", (blocking.get("camera") or {}).get("y", 0.5))
        camera_operation["pan_deg"] = _pan_to_target(blocking, camera_x, camera_y, target)
        applied["pan_deg"] = camera_operation["pan_deg"]

    if len(camera_operation) > 1:
        operations.append(camera_operation)

    target_world_x, target_world_z = _world_xy(blocking, target)
    fraction = space.frame_fraction(args)
    scale_anchor = {
        "id": anchor_id,
        "label": str(args.get("label") or target.get("name") or target_id)[:80],
        "kind": f"scale-{axis}",
        "image_x": float(args.get("image_x", 0.5)),
        "image_y": float(args.get("image_y", 0.5)),
        "image_width": fraction if axis == "width" else 0,
        "image_height": fraction if axis == "height" else 0,
        "world_x_m": target_world_x,
        "world_z_m": target_world_z,
        "physical_dimensions_m": target_dims,
        "confidence": min(1.0, max(0.0, float(args.get("confidence", 1.0)))),
        "attached_item_id": target_id,
    }
    anchors = [scale_anchor]
    if args.get("horizon_y") is not None:
        anchors.append({
            "id": _anchor_id(args.get("horizon_anchor_id"), "reference-horizon"),
            "label": "Reference horizon",
            "kind": "horizon",
            "image_x": 0.5,
            "image_y": float(args["horizon_y"]),
            "confidence": min(1.0, max(0.0, float(args.get("confidence", 1.0)))),
        })

    payload = base._target_args(args)
    payload["operations"] = operations
    payload["spatial_guide"] = _merge_guide(blocking, args.get("source_name"), anchors)
    result = base._json_result(core.handle_apply_scene_commands(args.get("project_id"), payload))
    if "revision" not in result:
        raise ValueError(result.get("raw", "Reference camera 적용 결과를 읽지 못했습니다."))
    result["reference_camera"] = {
        "anchor_id": anchor_id,
        "target_id": target_id,
        "calibration": calibration,
        "applied": applied,
        "position_solution": position,
        "camera_keyframes_present": len(camera_keys),
        "keyframe_policy": "base-camera-only-explicit" if camera_keys else "base-camera-safe",
    }
    return result


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


def _relative_error(actual, expected):
    return abs(float(actual) - float(expected)) / max(abs(float(expected)), 1e-9)


def _persisted_scale_anchors(guide):
    observations = []
    for anchor in guide.get("anchors") or []:
        if not isinstance(anchor, dict):
            continue
        kind = str(anchor.get("kind") or "")
        if kind not in {"scale-height", "scale-width"}:
            continue
        axis = "width" if kind == "scale-width" else "height"
        dimensions = anchor.get("dimensionsM") if isinstance(anchor.get("dimensionsM"), dict) else {}
        observed = anchor.get("imageWidth") if axis == "width" else anchor.get("imageHeight")
        physical = dimensions.get(axis)
        target_id = str(anchor.get("attachedItemId") or "")
        if observed and physical and target_id:
            observations.append({
                "id": str(anchor.get("id") or target_id),
                "axis": axis,
                "physical_size_m": physical,
                "frame_fraction": observed,
                "target_id": target_id,
                "dimensions_m": dimensions,
                "image_x": anchor.get("imageX"),
                "image_y": anchor.get("imageY"),
            })
    return observations


def _persisted_horizon(guide):
    for anchor in guide.get("anchors") or []:
        if isinstance(anchor, dict) and str(anchor.get("kind") or "") == "horizon":
            value = anchor.get("imageY")
            if value is not None:
                return float(value)
    return None


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
        kind = str(anchor.get("kind") or "")
        if kind == "horizon":
            continue
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
        checked.append({"anchor_id": aid, "item_id": iid, "world_x_m": wx, "world_z_m": wz, "kind": kind})

    defaults = _camera_defaults(blocking)
    camera = blocking.get("camera") or {}
    stage_width, stage_depth = space.stage_dimensions(blocking.get("aspect", "16:9"))
    camera_position = {
        "x": (float(camera.get("x", 0.5)) - 0.5) * stage_width,
        "y": float(camera.get("height", 1.6)),
        "z": (float(camera.get("y", 0.5)) - 0.5) * stage_depth,
    }
    projection = []
    screen_positions = []
    scale_observations = list(args.get("scale_anchors") or []) or _persisted_scale_anchors(guide)
    for index, obs in enumerate(scale_observations):
        if not isinstance(obs, dict):
            issues.append({"code": "scale-anchor-invalid", "index": index})
            continue
        axis = "width" if str(obs.get("axis", "height")) == "width" else "height"
        target_id = str(obs.get("target_id") or "")
        if not target_id:
            issues.append({"code": "scale-anchor-target-missing", "index": index})
            continue
        dimensions = obs.get("dimensions_m") if isinstance(obs.get("dimensions_m"), dict) else None
        physical = obs.get("physical_size_m")
        if physical is None and dimensions:
            physical = dimensions.get(axis)
        observed = obs.get("frame_fraction")
        if physical is None or observed is None:
            issues.append({"code": "scale-anchor-observation-incomplete", "id": str(obs.get("id") or f"scale-{index + 1}")})
            continue
        distance = obs.get("distance_m") or _target_distance(blocking, target_id, dimensions)
        predicted = space.predicted_frame_fraction(
            physical,
            distance,
            defaults["focal_mm"],
            defaults["sensor_width_mm"],
            space.aspect_value(defaults["aspect"]),
            axis,
        )
        observed = float(observed)
        entry = {
            "id": str(obs.get("id") or f"scale-{index + 1}"),
            "target_id": target_id,
            "axis": axis,
            "observed": observed,
            "predicted": predicted,
            "residual": observed - predicted,
            "distance_m": distance,
        }
        projection.append(entry)
        if abs(entry["residual"]) > frame_tol:
            issues.append({"code": "scale-anchor-frame-mismatch", **entry, "tolerance": frame_tol})

        observed_x = obs.get("image_x")
        observed_y = obs.get("image_y")
        if observed_x is None or observed_y is None:
            continue
        item = items.get(target_id)
        if not item:
            continue
        world_x, world_z = _world_xy(blocking, item)
        screen = space.project_world_point_to_frame(
            camera_position,
            {"x": world_x, "y": _target_center_height(item, dimensions), "z": world_z},
            pan_deg=camera.get("panDeg", 180),
            tilt_deg=camera.get("tiltDeg", 0),
            focal_mm=defaults["focal_mm"],
            sensor_width_mm=defaults["sensor_width_mm"],
            aspect=defaults["aspect"],
        )
        observed_x = float(observed_x)
        observed_y = float(observed_y)
        predicted_x = screen.get("frame_x")
        predicted_y = screen.get("frame_y")
        screen_positions.append({
            "anchor_id": entry["id"],
            "item_id": target_id,
            "observed_x": observed_x,
            "observed_y": observed_y,
            "predicted_x": predicted_x,
            "predicted_y": predicted_y,
            "residual_x": None if predicted_x is None else observed_x - predicted_x,
            "residual_y": None if predicted_y is None else observed_y - predicted_y,
            "depth_m": screen.get("depth_m"),
            "in_front": bool(screen.get("in_front")),
            "in_frame": bool(screen.get("in_frame")),
        })

    horizon = None
    observed_horizon = args.get("horizon_y")
    if observed_horizon is None:
        observed_horizon = _persisted_horizon(guide)
    if observed_horizon is not None:
        observed = float(observed_horizon)
        predicted = space.horizon_from_tilt(camera.get("tiltDeg", 0), defaults["focal_mm"], defaults["sensor_width_mm"], defaults["aspect"])
        horizon = {"observed": observed, "predicted": predicted, "residual": observed - predicted}
        if abs(horizon["residual"]) > frame_tol:
            issues.append({"code": "horizon-mismatch", **horizon, "tolerance": frame_tol})

    return {
        "schema": "frisframe-reference-space-validation",
        "version": 1,
        "status": "ready" if not issues else "review",
        "anchors_checked": checked,
        "projection_checks": projection,
        "screen_position_checks": screen_positions,
        "screen_position_policy": "diagnostic-only-no-readiness-impact",
        "horizon_check": horizon,
        "camera_keyframes": len(_camera_keyframes(blocking)),
        "issues": issues,
    }


def call_tool(name, args):
    if name == "calibrate_reference_camera":
        blocking = _blocking(args) if args.get("project_id") else None
        defaults = _camera_defaults(blocking) if blocking else None
        return json.dumps(space.calibrate_reference_camera(args, defaults), ensure_ascii=False)
    if name == "apply_reference_camera_calibration":
        return json.dumps(_apply_camera_calibration(args), ensure_ascii=False)
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
