#!/usr/bin/env python3
"""Reference-image interpretation contract for external vision-capable MCP clients.

FrisFrame does not analyze pixels or call an AI API. The external MCP client is
responsible for looking at the reference image and submitting explicit metric
camera, object, scale-anchor, and relationship observations through this module.
This module validates those observations and deterministically compiles them into
FrisFrame Reference Space mutations.
"""

from __future__ import annotations

import json
import math
import re

import mcp_previs_server as base
import mcp_server as core
import reference_space_core as space
import reference_space_mcp as reference


BASIS_VALUES = {"observed", "inferred", "user_fixed"}
ROLE_VALUES = {"structure", "surface", "prop", "vegetation"}
RELATION_VALUES = {
    "distance",
    "clearance",
    "parallel_to",
    "left_of",
    "right_of",
    "front_of",
    "behind",
    "adjacent_to",
}
ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,64}$")


OBJECT_SCHEMA = {
    "type": "object",
    "properties": {
        "id": {"type": "string"},
        "name": {"type": "string"},
        "role": {"type": "string", "enum": sorted(ROLE_VALUES)},
        "basis": {"type": "string", "enum": sorted(BASIS_VALUES)},
        "confidence": {"type": "number", "minimum": 0, "maximum": 1},
        "world_x_m": {"type": "number"},
        "world_z_m": {"type": "number"},
        "width_m": {"type": "number", "exclusiveMinimum": 0},
        "height_m": {"type": "number", "exclusiveMinimum": 0},
        "depth_m": {"type": "number", "exclusiveMinimum": 0},
        "rotation_deg": {"type": "number"},
        "mounted_height_m": {"type": "number"},
        "asset_type": {"type": "string"},
        "depth_layer": {"type": "string"},
        "include_in_scene": {"type": "boolean"},
    },
    "required": ["id", "world_x_m", "world_z_m", "width_m", "height_m", "depth_m"],
}


SCALE_ANCHOR_SCHEMA = {
    "type": "object",
    "properties": {
        "id": {"type": "string"},
        "object_id": {"type": "string"},
        "axis": {"type": "string", "enum": ["height", "width"]},
        "physical_size_m": {"type": "number", "exclusiveMinimum": 0},
        "frame_fraction": {"type": "number", "exclusiveMinimum": 0},
        "measured_pixels": {"type": "number", "exclusiveMinimum": 0},
        "image_axis_pixels": {"type": "number", "exclusiveMinimum": 0},
        "distance_m": {"type": "number", "exclusiveMinimum": 0},
        "image_x": {"type": "number", "minimum": 0, "maximum": 1},
        "image_y": {"type": "number", "minimum": 0, "maximum": 1},
        "basis": {"type": "string", "enum": sorted(BASIS_VALUES)},
        "confidence": {"type": "number", "minimum": 0, "maximum": 1},
    },
    "required": ["id", "object_id"],
}


RELATION_SCHEMA = {
    "type": "object",
    "properties": {
        "type": {"type": "string", "enum": sorted(RELATION_VALUES)},
        "from_id": {"type": "string"},
        "to_id": {"type": "string"},
        "distance_m": {"type": "number", "minimum": 0},
        "tolerance_m": {"type": "number", "exclusiveMinimum": 0},
        "basis": {"type": "string", "enum": sorted(BASIS_VALUES)},
        "confidence": {"type": "number", "minimum": 0, "maximum": 1},
    },
    "required": ["type", "from_id", "to_id"],
}


CAMERA_SCHEMA = {
    "type": "object",
    "properties": {
        "target_id": {"type": "string"},
        "anchor_id": {"type": "string"},
        "axis": {"type": "string", "enum": ["height", "width"]},
        "physical_size_m": {"type": "number", "exclusiveMinimum": 0},
        "frame_fraction": {"type": "number", "exclusiveMinimum": 0},
        "measured_pixels": {"type": "number", "exclusiveMinimum": 0},
        "image_axis_pixels": {"type": "number", "exclusiveMinimum": 0},
        "focal_mm": {"type": "number", "exclusiveMinimum": 0},
        "distance_m": {"type": "number", "exclusiveMinimum": 0},
        "sensor_width_mm": {"type": "number", "exclusiveMinimum": 0},
        "aspect": {"type": ["number", "string"]},
        "horizon_y": {"type": "number", "minimum": 0, "maximum": 1},
        "image_x": {"type": "number", "minimum": 0, "maximum": 1},
        "image_y": {"type": "number", "minimum": 0, "maximum": 1},
        "height_m": {"type": "number", "minimum": 0.4, "maximum": 35},
        "world_x_m": {"type": "number"},
        "world_z_m": {"type": "number"},
        "pan_deg": {"type": "number"},
        "tilt_deg": {"type": "number", "minimum": -90, "maximum": 90},
        "apply_focal": {"type": "boolean"},
        "apply_distance": {"type": "boolean"},
        "apply_tilt": {"type": "boolean"},
        "orient_to_target": {"type": "boolean"},
        "basis": {"type": "string", "enum": sorted(BASIS_VALUES)},
        "confidence": {"type": "number", "minimum": 0, "maximum": 1},
    },
    "required": ["target_id"],
}


INTERPRETATION_SCHEMA = {
    "type": "object",
    "properties": {
        "source_name": {"type": "string"},
        "image": {
            "type": "object",
            "properties": {
                "width_px": {"type": "number", "exclusiveMinimum": 0},
                "height_px": {"type": "number", "exclusiveMinimum": 0},
            },
        },
        "objects": {"type": "array", "minItems": 1, "maxItems": 100, "items": OBJECT_SCHEMA},
        "scale_anchors": {"type": "array", "maxItems": 32, "items": SCALE_ANCHOR_SCHEMA},
        "relationships": {"type": "array", "maxItems": 128, "items": RELATION_SCHEMA},
        "camera": CAMERA_SCHEMA,
        "notes": {"type": "string"},
    },
    "required": ["objects"],
}


CONTRACT_TOOL = {
    "name": "get_reference_interpretation_contract",
    "description": (
        "레퍼런스 이미지를 FrisFrame 프리비즈로 옮길 때 외부 vision-capable MCP 클라이언트가 따라야 하는 "
        "해석 순서와 데이터 계약을 반환합니다. FrisFrame 자체는 이미지를 분석하지 않습니다."
    ),
    "inputSchema": {"type": "object", "properties": {}},
}

VALIDATE_TOOL = {
    "name": "validate_reference_interpretation",
    "description": (
        "외부 모델이 이미지에서 추출한 카메라·실측 스케일·구조물·거리 관계를 mutation 없이 검증합니다. "
        "프리비즈 생성 전 반드시 호출해 metric 일관성과 누락을 확인하는 용도입니다."
    ),
    "inputSchema": {
        "type": "object",
        "properties": {
            "interpretation": INTERPRETATION_SCHEMA,
            "relation_tolerance_m": {"type": "number", "exclusiveMinimum": 0},
            "parallel_tolerance_deg": {"type": "number", "exclusiveMinimum": 0, "maximum": 45},
        },
        "required": ["interpretation"],
    },
}

APPLY_TOOL = {
    "name": "apply_reference_interpretation",
    "description": (
        "외부 vision-capable MCP 클라이언트가 레퍼런스 이미지를 해석한 구조화 결과를 검증한 뒤, "
        "world-meter Mass Blocking·Scale Anchor·카메라를 한 revision으로 프리비즈에 적용합니다. "
        "장식 디테일보다 실제 크기·거리·배치·카메라를 우선하며 FrisFrame은 AI API를 호출하지 않습니다."
    ),
    "inputSchema": {
        "type": "object",
        "properties": {
            **base.COMMON_TARGET_PROPERTIES,
            "interpretation": INTERPRETATION_SCHEMA,
            "require_ready": {"type": "boolean"},
            "allow_outside_stage": {"type": "boolean"},
            "validate_after_apply": {"type": "boolean"},
            "relation_tolerance_m": {"type": "number", "exclusiveMinimum": 0},
            "parallel_tolerance_deg": {"type": "number", "exclusiveMinimum": 0, "maximum": 45},
        },
        "required": ["project_id", "revision", "interpretation"],
    },
}


def _finite(value, label):
    try:
        number = float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{label} 값이 숫자가 아닙니다.") from exc
    if not math.isfinite(number):
        raise ValueError(f"{label} 값이 유효한 유한수가 아닙니다.")
    return number


def _positive(value, label):
    number = _finite(value, label)
    if number <= 0:
        raise ValueError(f"{label} 값은 0보다 커야 합니다.")
    return number


def _confidence(value, basis):
    if value is None:
        return 1.0 if basis == "user_fixed" else (0.78 if basis == "observed" else 0.5)
    return min(1.0, max(0.0, _finite(value, "confidence")))


def _basis(value):
    candidate = str(value or "inferred")
    if candidate not in BASIS_VALUES:
        raise ValueError(f"basis는 {sorted(BASIS_VALUES)} 중 하나여야 합니다.")
    return candidate


def _identifier(value, label):
    candidate = str(value or "").strip()
    if not ID_RE.fullmatch(candidate):
        raise ValueError(f"{label}는 영문/숫자/_/- 64자 이하여야 합니다.")
    return candidate


def _frame_fraction(data, label):
    direct = data.get("frame_fraction")
    if direct is not None:
        return _positive(direct, f"{label}.frame_fraction")
    measured = data.get("measured_pixels")
    image_axis = data.get("image_axis_pixels")
    if measured is None or image_axis is None:
        raise ValueError(f"{label}에는 frame_fraction 또는 measured_pixels + image_axis_pixels가 필요합니다.")
    return _positive(measured, f"{label}.measured_pixels") / _positive(image_axis, f"{label}.image_axis_pixels")


def _normalize_object(raw, index):
    if not isinstance(raw, dict):
        raise ValueError(f"objects[{index}]가 객체가 아닙니다.")
    object_id = _identifier(raw.get("id"), f"objects[{index}].id")
    basis = _basis(raw.get("basis"))
    role = str(raw.get("role") or "structure")
    if role not in ROLE_VALUES:
        raise ValueError(f"objects[{index}].role은 {sorted(ROLE_VALUES)} 중 하나여야 합니다.")
    return {
        "id": object_id,
        "name": str(raw.get("name") or object_id)[:80],
        "role": role,
        "basis": basis,
        "confidence": _confidence(raw.get("confidence"), basis),
        "world_x_m": _finite(raw.get("world_x_m"), f"objects[{index}].world_x_m"),
        "world_z_m": _finite(raw.get("world_z_m"), f"objects[{index}].world_z_m"),
        "width_m": _positive(raw.get("width_m"), f"objects[{index}].width_m"),
        "height_m": _positive(raw.get("height_m"), f"objects[{index}].height_m"),
        "depth_m": _positive(raw.get("depth_m"), f"objects[{index}].depth_m"),
        "rotation_deg": _finite(raw.get("rotation_deg", 0), f"objects[{index}].rotation_deg"),
        "mounted_height_m": _finite(raw.get("mounted_height_m", 0), f"objects[{index}].mounted_height_m"),
        "asset_type": str(raw.get("asset_type") or ("tree" if role == "vegetation" else "box"))[:64],
        "depth_layer": str(raw.get("depth_layer") or "")[:48],
        "include_in_scene": bool(raw.get("include_in_scene", True)),
    }


def _normalize_scale_anchor(raw, index, objects_by_id):
    if not isinstance(raw, dict):
        raise ValueError(f"scale_anchors[{index}]가 객체가 아닙니다.")
    anchor_id = _identifier(raw.get("id"), f"scale_anchors[{index}].id")
    object_id = _identifier(raw.get("object_id"), f"scale_anchors[{index}].object_id")
    if object_id not in objects_by_id:
        raise ValueError(f"scale_anchors[{index}].object_id '{object_id}'가 objects에 없습니다.")
    axis = "width" if str(raw.get("axis", "height")).lower() == "width" else "height"
    obj = objects_by_id[object_id]
    physical_size = raw.get("physical_size_m")
    if physical_size is None:
        physical_size = obj["width_m"] if axis == "width" else obj["height_m"]
    basis = _basis(raw.get("basis", obj["basis"]))
    result = {
        "id": anchor_id,
        "object_id": object_id,
        "axis": axis,
        "physical_size_m": _positive(physical_size, f"scale_anchors[{index}].physical_size_m"),
        "frame_fraction": _frame_fraction(raw, f"scale_anchors[{index}]"),
        "distance_m": None if raw.get("distance_m") is None else _positive(raw.get("distance_m"), f"scale_anchors[{index}].distance_m"),
        "basis": basis,
        "confidence": _confidence(raw.get("confidence"), basis),
    }
    for key in ("image_x", "image_y"):
        if raw.get(key) is not None:
            value = _finite(raw[key], f"scale_anchors[{index}].{key}")
            if not 0 <= value <= 1:
                raise ValueError(f"scale_anchors[{index}].{key}는 0~1 사이여야 합니다.")
            result[key] = value
    return result


def _normalize_relation(raw, index, objects_by_id):
    if not isinstance(raw, dict):
        raise ValueError(f"relationships[{index}]가 객체가 아닙니다.")
    relation_type = str(raw.get("type") or "")
    if relation_type not in RELATION_VALUES:
        raise ValueError(f"relationships[{index}].type은 {sorted(RELATION_VALUES)} 중 하나여야 합니다.")
    from_id = _identifier(raw.get("from_id"), f"relationships[{index}].from_id")
    to_id = _identifier(raw.get("to_id"), f"relationships[{index}].to_id")
    if from_id == to_id:
        raise ValueError(f"relationships[{index}]는 같은 대상을 서로 연결할 수 없습니다.")
    if from_id not in objects_by_id or to_id not in objects_by_id:
        raise ValueError(f"relationships[{index}]가 objects에 없는 id를 참조합니다.")
    basis = _basis(raw.get("basis"))
    return {
        "type": relation_type,
        "from_id": from_id,
        "to_id": to_id,
        "distance_m": None if raw.get("distance_m") is None else max(0.0, _finite(raw.get("distance_m"), f"relationships[{index}].distance_m")),
        "tolerance_m": None if raw.get("tolerance_m") is None else _positive(raw.get("tolerance_m"), f"relationships[{index}].tolerance_m"),
        "basis": basis,
        "confidence": _confidence(raw.get("confidence"), basis),
    }


def _normalize_camera(raw, objects_by_id):
    if raw is None:
        return None
    if not isinstance(raw, dict):
        raise ValueError("camera가 객체가 아닙니다.")
    target_id = _identifier(raw.get("target_id"), "camera.target_id")
    basis = _basis(raw.get("basis"))
    camera = dict(raw)
    camera["target_id"] = target_id
    camera["anchor_id"] = _identifier(raw.get("anchor_id") or f"scale-{target_id}", "camera.anchor_id")
    camera["axis"] = "width" if str(raw.get("axis", "height")).lower() == "width" else "height"
    camera["basis"] = basis
    camera["confidence"] = _confidence(raw.get("confidence"), basis)
    if target_id in objects_by_id:
        target = objects_by_id[target_id]
        if camera.get("physical_size_m") is None:
            camera["physical_size_m"] = target["width_m"] if camera["axis"] == "width" else target["height_m"]
    if camera.get("physical_size_m") is not None:
        camera["physical_size_m"] = _positive(camera["physical_size_m"], "camera.physical_size_m")
    if any(camera.get(key) is not None for key in ("frame_fraction", "measured_pixels", "image_axis_pixels")):
        camera["frame_fraction"] = _frame_fraction(camera, "camera")
    for key in ("focal_mm", "distance_m", "sensor_width_mm"):
        if camera.get(key) is not None:
            camera[key] = _positive(camera[key], f"camera.{key}")
    for key in ("height_m", "world_x_m", "world_z_m", "pan_deg", "tilt_deg"):
        if camera.get(key) is not None:
            camera[key] = _finite(camera[key], f"camera.{key}")
    for key in ("horizon_y", "image_x", "image_y"):
        if camera.get(key) is not None:
            value = _finite(camera[key], f"camera.{key}")
            if not 0 <= value <= 1:
                raise ValueError(f"camera.{key}는 0~1 사이여야 합니다.")
            camera[key] = value
    return camera


def _rotation_delta_degrees(a, b):
    delta = abs((float(a) - float(b)) % 180.0)
    return min(delta, 180.0 - delta)


def _center_distance(a, b):
    return math.hypot(float(a["world_x_m"]) - float(b["world_x_m"]), float(a["world_z_m"]) - float(b["world_z_m"]))


def normalize_interpretation(raw, *, relation_tolerance_m=0.75, parallel_tolerance_deg=12.0):
    if not isinstance(raw, dict):
        raise ValueError("interpretation은 객체여야 합니다.")
    objects_raw = raw.get("objects") or []
    if not isinstance(objects_raw, list) or not objects_raw:
        raise ValueError("interpretation.objects는 하나 이상 필요합니다.")
    if len(objects_raw) > 100:
        raise ValueError("interpretation.objects는 100개까지 지원합니다.")

    objects = [_normalize_object(entry, index) for index, entry in enumerate(objects_raw)]
    ids = [entry["id"] for entry in objects]
    if len(ids) != len(set(ids)):
        raise ValueError("interpretation.objects id가 중복되었습니다.")
    objects_by_id = {entry["id"]: entry for entry in objects}

    anchors_raw = raw.get("scale_anchors") or []
    if not isinstance(anchors_raw, list) or len(anchors_raw) > 32:
        raise ValueError("interpretation.scale_anchors는 배열이며 32개까지 지원합니다.")
    anchors = [_normalize_scale_anchor(entry, index, objects_by_id) for index, entry in enumerate(anchors_raw)]
    anchor_ids = [entry["id"] for entry in anchors]
    if len(anchor_ids) != len(set(anchor_ids)):
        raise ValueError("interpretation.scale_anchors id가 중복되었습니다.")

    relations_raw = raw.get("relationships") or []
    if not isinstance(relations_raw, list) or len(relations_raw) > 128:
        raise ValueError("interpretation.relationships는 배열이며 128개까지 지원합니다.")
    relations = [_normalize_relation(entry, index, objects_by_id) for index, entry in enumerate(relations_raw)]
    camera = _normalize_camera(raw.get("camera"), objects_by_id)

    issues = []
    if camera is None:
        issues.append({"code": "missing-camera", "severity": "review", "message": "원본 시점 재현을 위한 camera 해석이 없습니다."})
    elif camera["target_id"] not in objects_by_id:
        issues.append({"code": "camera-target-not-in-interpretation", "severity": "review", "target_id": camera["target_id"], "message": "camera target이 새 interpretation object가 아니므로 현재 프로젝트의 기존 대상이어야 합니다."})

    scene_objects = [entry for entry in objects if entry["include_in_scene"]]
    if not any(entry["role"] in {"structure", "surface"} for entry in scene_objects):
        issues.append({"code": "missing-structure", "severity": "review", "message": "세트의 큰 구조물 또는 surface가 없습니다."})

    reliable_scale = [entry for entry in anchors if entry["confidence"] >= 0.6]
    if camera and camera.get("physical_size_m") and camera.get("frame_fraction") and camera["confidence"] >= 0.6:
        reliable_scale.append({"id": camera["anchor_id"]})
    if not reliable_scale:
        issues.append({"code": "missing-reliable-scale-anchor", "severity": "review", "message": "confidence 0.6 이상의 실측/추정 Scale Anchor가 하나 이상 필요합니다."})

    relation_tolerance = _positive(relation_tolerance_m, "relation_tolerance_m")
    parallel_tolerance = _positive(parallel_tolerance_deg, "parallel_tolerance_deg")
    relation_checks = []
    for relation in relations:
        left = objects_by_id[relation["from_id"]]
        right = objects_by_id[relation["to_id"]]
        check = {
            "type": relation["type"],
            "from_id": relation["from_id"],
            "to_id": relation["to_id"],
            "status": "ok",
        }
        if relation["type"] in {"distance", "adjacent_to", "clearance"} and relation.get("distance_m") is not None:
            actual = _center_distance(left, right)
            tolerance = relation.get("tolerance_m") or relation_tolerance
            residual = actual - relation["distance_m"]
            check.update({"actual_center_distance_m": actual, "expected_distance_m": relation["distance_m"], "residual_m": residual, "tolerance_m": tolerance})
            if abs(residual) > tolerance:
                check["status"] = "review"
                issues.append({
                    "code": "relationship-distance-mismatch",
                    "severity": "review",
                    "from_id": relation["from_id"],
                    "to_id": relation["to_id"],
                    "residual_m": residual,
                    "tolerance_m": tolerance,
                })
        elif relation["type"] == "parallel_to":
            delta = _rotation_delta_degrees(left["rotation_deg"], right["rotation_deg"])
            check.update({"rotation_delta_deg": delta, "tolerance_deg": parallel_tolerance})
            if delta > parallel_tolerance:
                check["status"] = "review"
                issues.append({
                    "code": "relationship-parallel-mismatch",
                    "severity": "review",
                    "from_id": relation["from_id"],
                    "to_id": relation["to_id"],
                    "rotation_delta_deg": delta,
                    "tolerance_deg": parallel_tolerance,
                })
        relation_checks.append(check)

    status = "review" if issues else "ready"
    counts = {basis: sum(1 for entry in objects if entry["basis"] == basis) for basis in sorted(BASIS_VALUES)}
    return {
        "schema": "frisframe-reference-interpretation",
        "version": 1,
        "source_name": str(raw.get("source_name") or "Reference image")[:160],
        "image": dict(raw.get("image") or {}),
        "objects": objects,
        "scale_anchors": anchors,
        "relationships": relations,
        "camera": camera,
        "notes": str(raw.get("notes") or "")[:2000],
        "status": status,
        "issues": issues,
        "relation_checks": relation_checks,
        "summary": {
            "object_count": len(objects),
            "scene_object_count": len(scene_objects),
            "structure_count": sum(1 for entry in scene_objects if entry["role"] in {"structure", "surface"}),
            "scale_anchor_count": len(anchors),
            "reliable_scale_anchor_count": len(reliable_scale),
            "relationship_count": len(relations),
            "basis_counts": counts,
            "inferred_object_ids": [entry["id"] for entry in objects if entry["basis"] == "inferred"],
        },
    }


def interpretation_contract():
    return {
        "schema": "frisframe-reference-interpretation-contract",
        "version": 1,
        "ownership": {
            "image_reasoning": "external-vision-mcp-client",
            "deterministic_validation_and_apply": "FrisFrame",
            "frisframe_calls_ai_api": False,
        },
        "priority": ["spatial_relationships", "metric_scale", "camera", "major_shape", "decorative_detail"],
        "workflow": [
            "Identify the major structural masses and surfaces before props or decoration.",
            "Estimate the reference camera: horizon, focal class, target, height, and view direction.",
            "Choose one to three visible scale anchors with plausible real-world dimensions.",
            "Express every scene object in world meters with width/height/depth and rotation.",
            "Record important pairwise distances or parallel relationships so layout can be checked.",
            "Mark each decision as observed, inferred, or user_fixed and attach confidence.",
            "Call validate_reference_interpretation and fix REVIEW diagnostics before mutation when possible.",
            "Call apply_reference_interpretation only after the metric layout is coherent.",
        ],
        "minimum_ready": {
            "objects": ">=1",
            "structure_or_surface": ">=1",
            "camera": "recommended and required for READY status",
            "reliable_scale_anchor": "confidence >= 0.6 through scale_anchors or camera target measurement",
        },
        "schema_hint": INTERPRETATION_SCHEMA,
    }


def _object_dimensions(obj):
    return {"width": obj["width_m"], "height": obj["height_m"], "depth": obj["depth_m"]}


def _mass_from_object(obj):
    return {
        "id": obj["id"],
        "name": obj["name"],
        "role": obj["role"],
        "world_x_m": obj["world_x_m"],
        "world_z_m": obj["world_z_m"],
        "width_m": obj["width_m"],
        "height_m": obj["height_m"],
        "depth_m": obj["depth_m"],
        "rotation_deg": obj["rotation_deg"],
        "mounted_height_m": obj["mounted_height_m"],
        "asset_type": obj["asset_type"],
        "depth_layer": obj["depth_layer"],
        "confidence": obj["confidence"],
    }


def _stage_world_camera(blocking):
    camera = blocking.get("camera") or {}
    stage_width, stage_depth = space.stage_dimensions(blocking.get("aspect", "16:9"))
    return {
        "x": (float(camera.get("x", 0.5)) - 0.5) * stage_width,
        "z": (float(camera.get("y", 0.5)) - 0.5) * stage_depth,
        "height": float(camera.get("height", 1.6)),
        "stage_width": stage_width,
        "stage_depth": stage_depth,
    }


def _normalize_camera_world_position(blocking, world_x, world_z):
    stage_width, stage_depth = space.stage_dimensions(blocking.get("aspect", "16:9"))
    x = 0.5 + float(world_x) / stage_width
    y = 0.5 + float(world_z) / stage_depth
    if not (core.STAGE_COORD_MIN <= x <= core.STAGE_COORD_MAX and core.STAGE_COORD_MIN <= y <= core.STAGE_COORD_MAX):
        raise ValueError(f"camera world 위치가 현재 {stage_width:.2f}m × {stage_depth:.2f}m stage 밖입니다.")
    return x, y


def _camera_position_for_target(blocking, target, distance_m, camera_height_m):
    current = _stage_world_camera(blocking)
    target_center_y = target["mounted_height_m"] + target["height_m"] / 2.0
    vertical = target_center_y - float(camera_height_m)
    desired = _positive(distance_m, "camera.distance_m")
    if desired <= abs(vertical) + 1e-9:
        raise ValueError("camera distance보다 카메라와 target 중심의 높이 차가 커서 위치를 계산할 수 없습니다.")
    horizontal = math.sqrt(max(0.0, desired * desired - vertical * vertical))
    rel_x = current["x"] - target["world_x_m"]
    rel_z = current["z"] - target["world_z_m"]
    rel_length = math.hypot(rel_x, rel_z)
    if rel_length < 1e-6:
        pan = math.radians(float((blocking.get("camera") or {}).get("panDeg", 180)))
        rel_x, rel_z, rel_length = -math.cos(pan), -math.sin(pan), 1.0
    world_x = target["world_x_m"] + rel_x / rel_length * horizontal
    world_z = target["world_z_m"] + rel_z / rel_length * horizontal
    x, y = _normalize_camera_world_position(blocking, world_x, world_z)
    return {"x": x, "y": y, "world_x_m": world_x, "world_z_m": world_z, "horizontal_distance_m": horizontal, "vertical_offset_m": vertical}


def _pan_to_world_target(blocking, camera_x, camera_y, target):
    stage_width, stage_depth = space.stage_dimensions(blocking.get("aspect", "16:9"))
    camera_world_x = (float(camera_x) - 0.5) * stage_width
    camera_world_z = (float(camera_y) - 0.5) * stage_depth
    return (math.degrees(math.atan2(target["world_z_m"] - camera_world_z, target["world_x_m"] - camera_world_x)) + 360.0) % 360.0


def _scale_anchor_payload(anchor, obj):
    payload = {
        "id": anchor["id"],
        "label": obj["name"],
        "kind": f"scale-{anchor['axis']}",
        "image_width": anchor["frame_fraction"] if anchor["axis"] == "width" else 0,
        "image_height": anchor["frame_fraction"] if anchor["axis"] == "height" else 0,
        "world_x_m": obj["world_x_m"],
        "world_z_m": obj["world_z_m"],
        "physical_dimensions_m": _object_dimensions(obj),
        "confidence": anchor["confidence"],
        "attached_item_id": obj["id"],
    }
    if anchor.get("image_x") is not None:
        payload["image_x"] = anchor["image_x"]
    if anchor.get("image_y") is not None:
        payload["image_y"] = anchor["image_y"]
    return payload


def _compile_camera(blocking, normalized, objects_by_id):
    camera = normalized.get("camera")
    if not camera:
        return {"operations": [], "anchors": [], "summary": None}

    target = objects_by_id.get(camera["target_id"])
    existing_target = None
    if target is None:
        try:
            existing_target = base._find_item(blocking, camera["target_id"])
        except ValueError:
            raise ValueError(f"camera.target_id '{camera['target_id']}'를 interpretation objects나 현재 project에서 찾을 수 없습니다.")

    axis = camera["axis"]
    if target:
        target_dims = _object_dimensions(target)
        physical_size = camera.get("physical_size_m") or target_dims[axis]
        target_for_world = target
    else:
        physical_size = camera.get("physical_size_m")
        if physical_size is None:
            raise ValueError("기존 project target을 camera anchor로 쓸 때는 camera.physical_size_m이 필요합니다.")
        target_dims = reference._target_dimensions(existing_target, axis, physical_size, None)
        world_x, world_z = reference._world_xy(blocking, existing_target)
        target_for_world = {
            "id": camera["target_id"],
            "name": str(existing_target.get("name") or camera["target_id"]),
            "world_x_m": world_x,
            "world_z_m": world_z,
            "width_m": target_dims["width"],
            "height_m": target_dims["height"],
            "depth_m": target_dims["depth"],
            "mounted_height_m": float(existing_target.get("verticalOffset", existing_target.get("mountedHeight", 0)) or 0),
        }

    if camera.get("frame_fraction") is None:
        raise ValueError("camera에는 target의 frame_fraction 또는 measured_pixels + image_axis_pixels가 필요합니다.")

    calibration_args = {
        "axis": axis,
        "physical_size_m": physical_size,
        "frame_fraction": camera["frame_fraction"],
    }
    for key in ("focal_mm", "distance_m", "sensor_width_mm", "aspect", "horizon_y", "image_x"):
        if camera.get(key) is not None:
            calibration_args[key] = camera[key]
    calibration = space.calibrate_reference_camera(calibration_args, reference._camera_defaults(blocking))

    apply_focal = bool(camera.get("apply_focal", True))
    apply_distance = bool(camera.get("apply_distance", True))
    apply_tilt = bool(camera.get("apply_tilt", camera.get("horizon_y") is not None or camera.get("tilt_deg") is not None))
    orient_to_target = bool(camera.get("orient_to_target", True))
    current_camera = blocking.get("camera") or {}
    camera_height = float(camera.get("height_m", current_camera.get("height", 1.6)))
    operation = {"op": "update_camera", "height": camera_height}

    if apply_focal:
        if not calibration["applicable_to_frisframe_camera"]:
            raise ValueError(f"camera focal {calibration['focal_mm']:.2f}mm가 FrisFrame 허용 범위 밖입니다.")
        operation["focal"] = max(core.CAMERA_FOCAL_MIN, min(core.CAMERA_FOCAL_MAX, int(round(calibration["focal_mm"]))))

    position = None
    explicit_world_position = camera.get("world_x_m") is not None or camera.get("world_z_m") is not None
    if explicit_world_position:
        if camera.get("world_x_m") is None or camera.get("world_z_m") is None:
            raise ValueError("camera.world_x_m와 camera.world_z_m는 함께 제공해야 합니다.")
        x, y = _normalize_camera_world_position(blocking, camera["world_x_m"], camera["world_z_m"])
        operation["x"], operation["y"] = x, y
        position = {"x": x, "y": y, "world_x_m": camera["world_x_m"], "world_z_m": camera["world_z_m"], "source": "explicit"}
    elif apply_distance:
        position = _camera_position_for_target(blocking, target_for_world, calibration["distance_m"], camera_height)
        operation["x"], operation["y"] = position["x"], position["y"]
        position["source"] = "scale-anchor-distance"

    if camera.get("pan_deg") is not None:
        operation["pan_deg"] = camera["pan_deg"]
    elif orient_to_target:
        operation["pan_deg"] = _pan_to_world_target(
            blocking,
            operation.get("x", current_camera.get("x", 0.5)),
            operation.get("y", current_camera.get("y", 0.5)),
            target_for_world,
        )

    if apply_tilt:
        if camera.get("tilt_deg") is not None:
            operation["tilt_deg"] = camera["tilt_deg"]
        elif calibration.get("tilt_deg") is not None:
            operation["tilt_deg"] = calibration["tilt_deg"]
        else:
            raise ValueError("camera.apply_tilt=true이면 tilt_deg 또는 horizon_y가 필요합니다.")

    anchor = {
        "id": camera["anchor_id"],
        "label": target_for_world["name"],
        "kind": f"scale-{axis}",
        "image_width": camera["frame_fraction"] if axis == "width" else 0,
        "image_height": camera["frame_fraction"] if axis == "height" else 0,
        "world_x_m": target_for_world["world_x_m"],
        "world_z_m": target_for_world["world_z_m"],
        "physical_dimensions_m": target_dims,
        "confidence": camera["confidence"],
        "attached_item_id": camera["target_id"],
    }
    if camera.get("image_x") is not None:
        anchor["image_x"] = camera["image_x"]
    if camera.get("image_y") is not None:
        anchor["image_y"] = camera["image_y"]
    anchors = [anchor]
    if camera.get("horizon_y") is not None:
        anchors.append({
            "id": "reference-horizon",
            "label": "Reference horizon",
            "kind": "horizon",
            "image_y": camera["horizon_y"],
            "confidence": camera["confidence"],
        })

    operations = []
    if existing_target is not None:
        operations.append({
            "op": "update_dummy",
            "id": camera["target_id"],
            "anchor_id": camera["anchor_id"],
            "physical_dimensions_m": target_dims,
        })
    operations.append(operation)
    return {
        "operations": operations,
        "anchors": anchors,
        "summary": {
            "target_id": camera["target_id"],
            "anchor_id": camera["anchor_id"],
            "calibration": calibration,
            "position_solution": position,
            "applied": {key: value for key, value in operation.items() if key != "op"},
        },
    }


def _apply_interpretation(args):
    normalized = normalize_interpretation(
        args.get("interpretation"),
        relation_tolerance_m=args.get("relation_tolerance_m", 0.75),
        parallel_tolerance_deg=args.get("parallel_tolerance_deg", 12.0),
    )
    if bool(args.get("require_ready", True)) and normalized["status"] != "ready":
        codes = ", ".join(issue["code"] for issue in normalized["issues"][:8])
        raise ValueError(f"reference-interpretation-review-required: {codes}")

    project_id = args.get("project_id")
    revision = int(args["revision"])
    scene_index = int(args.get("scene_index", 0))
    cut_index = int(args.get("cut_index", 0))
    blocking = base._load_blocking(project_id, scene_index, cut_index)
    objects_by_id = {entry["id"]: entry for entry in normalized["objects"]}
    masses = [_mass_from_object(entry) for entry in normalized["objects"] if entry["include_in_scene"]]
    mass_plan = {"operations": [], "anchors": [], "issues": [], "stage": None}
    if masses:
        mass_plan = space.mass_block_plan(blocking, masses, bool(args.get("allow_outside_stage", False)))

    explicit_scale_anchors = [_scale_anchor_payload(anchor, objects_by_id[anchor["object_id"]]) for anchor in normalized["scale_anchors"]]
    camera_plan = _compile_camera(blocking, normalized, objects_by_id)
    operations = list(mass_plan["operations"]) + list(camera_plan["operations"])
    if len(operations) > 200:
        raise ValueError("reference interpretation 적용 명령이 200개를 초과했습니다.")

    merged_anchors = []
    by_id = {}
    for anchor in list(mass_plan["anchors"]) + explicit_scale_anchors + list(camera_plan["anchors"]):
        by_id[str(anchor["id"])] = anchor
    merged_anchors = list(by_id.values())
    spatial_guide = reference._merge_guide(blocking, normalized["source_name"], merged_anchors)

    def apply_atomic(_project_obj):
        payload = base._target_args(args, revision)
        payload["operations"] = operations
        payload["spatial_guide"] = spatial_guide
        stage_result = base._json_result(core.handle_apply_scene_commands(project_id, payload))
        stage_detail = base._json_result(stage_result.get("message", ""))
        if not isinstance(stage_detail, dict):
            raise ValueError("reference interpretation 적용 결과를 읽지 못했습니다.")
        return {"stage": stage_detail}

    committed = base._json_result(core.mutate_project_atomic(project_id, revision, apply_atomic))
    detail = committed.get("message")
    if not isinstance(detail, dict):
        detail = base._json_result(detail)
    result = {
        "project_id": project_id,
        "revision": committed["revision"],
        "updated_at": committed.get("updated_at"),
        "reference_interpretation": {
            "status": normalized["status"],
            "summary": normalized["summary"],
            "issues": normalized["issues"],
            "relation_checks": normalized["relation_checks"],
            "applied_object_ids": [entry["id"] for entry in normalized["objects"] if entry["include_in_scene"]],
            "scale_anchor_ids": [entry["id"] for entry in normalized["scale_anchors"]],
            "camera": camera_plan["summary"],
            "operation_count": len(operations),
            "anchor_count": len(merged_anchors),
            "atomic_revision": True,
        },
        "stage": detail.get("stage") if isinstance(detail, dict) else detail,
    }
    if bool(args.get("validate_after_apply", True)):
        result["validation"] = reference._validate({
            "project_id": project_id,
            "scene_index": scene_index,
            "cut_index": cut_index,
        })
    return result


_PREVIOUS_CALL_TOOL = base.call_tool


def call_tool(name, args):
    if name == "get_reference_interpretation_contract":
        return json.dumps(interpretation_contract(), ensure_ascii=False)
    if name == "validate_reference_interpretation":
        return json.dumps(normalize_interpretation(
            args.get("interpretation"),
            relation_tolerance_m=args.get("relation_tolerance_m", 0.75),
            parallel_tolerance_deg=args.get("parallel_tolerance_deg", 12.0),
        ), ensure_ascii=False)
    if name == "apply_reference_interpretation":
        return json.dumps(_apply_interpretation(args), ensure_ascii=False)
    return _PREVIOUS_CALL_TOOL(name, args)


def install():
    if getattr(base, "_reference_interpretation_extension_installed", False):
        return
    existing = {tool.get("name") for tool in base.TOOLS}
    for tool in (CONTRACT_TOOL, VALIDATE_TOOL, APPLY_TOOL):
        if tool["name"] not in existing:
            base.TOOLS.append(tool)
    base.call_tool = call_tool
    base._reference_interpretation_extension_installed = True


install()
