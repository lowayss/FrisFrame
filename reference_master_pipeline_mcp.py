#!/usr/bin/env python3
"""Reference image interpretation -> metric Master Set pipeline for FrisFrame.

The external vision-capable MCP client interprets image pixels. FrisFrame then
normalizes those observations, compiles a deterministic 2D metric master plan,
and applies that plan to the shared blocking state used by 2D, 2.5D and 3D.

This module intentionally keeps reference-camera observations as evidence during
set construction. It does not move the authored FrisFrame camera. Camera
calibration remains a later, explicit previs step.
"""

from __future__ import annotations

import copy
import json
import math

import mcp_previs_server as base
import mcp_server as core
import reference_interpretation_mcp as interpretation
import reference_space_mcp as reference
import set_reconstruction_mcp as set_reconstruction
import autonomous_scale_core as autonomous_scale


PIPELINE_POLICY = "reference-image-to-master-set-single-source-of-truth"
SET_ROLES = set(set_reconstruction.ROLE_VALUES)
BASE_ROLES = set(interpretation.ROLE_VALUES)

RECONSTRUCTION_POLICY = "reference-reconstruction-v2"
SCENE_TYPE_VALUES = {"interior", "exterior", "vehicle", "mixed", "unknown"}
PREVIS_PRIORITY_VALUES = {"critical", "major", "supporting", "detail"}
CRITICAL_KINDS = {"wall", "partition", "railing", "door", "window", "column", "stairs"}
MAJOR_KINDS = {
    "sofa", "bed", "table", "counter", "cabinet", "refrigerator", "stove",
    "bathtub", "toilet", "sink", "tree", "vegetation", "pergola", "platform",
}

ASSET_KIND_MAP = {
    "wall": "wall",
    "partition": "partition",
    "door": "door",
    "window": "window",
    "cylinder": "column",
    "cabinet": "cabinet",
    "dining-table": "table",
    "table": "table",
    "chair": "chair",
    "sofa": "sofa",
    "bed": "bed",
    "stairs": "stairs",
    "tree": "tree",
    "forest": "vegetation",
    "sink": "sink",
    "toilet": "toilet",
    "bathtub": "bathtub",
    "refrigerator": "refrigerator",
    "stove": "stove",
    "television": "television",
}

COLLECTION_BY_ROLE = {
    "structure": "architecture",
    "surface": "architecture",
    "opening": "architecture",
    "furniture": "furniture",
    "service": "fixtures",
    "vegetation": "environment",
    "prop": "props",
}

COLLECTION_NAMES = {
    "architecture": "Architecture",
    "furniture": "Furniture",
    "fixtures": "Fixtures",
    "environment": "Environment",
    "props": "Props",
}

BASE_ROLE_BY_SET_ROLE = {
    "structure": "structure",
    "surface": "surface",
    "opening": "structure",
    "furniture": "prop",
    "service": "prop",
    "prop": "prop",
    "vegetation": "vegetation",
}


def _extended_interpretation_schema():
    schema = copy.deepcopy(interpretation.INTERPRETATION_SCHEMA)
    object_schema = schema["properties"]["objects"]["items"]
    object_schema["required"] = ["id"]
    object_schema["properties"]["role"] = {"type": "string", "enum": sorted(SET_ROLES | BASE_ROLES)}
    object_schema["properties"].update({
        "kind": {"type": "string", "enum": sorted(set_reconstruction.KIND_VALUES)},
        "collection_id": {"type": "string"},
        "parent_id": {"type": "string"},
        "start_x_m": {"type": "number"},
        "start_z_m": {"type": "number"},
        "end_x_m": {"type": "number"},
        "end_z_m": {"type": "number"},
        "thickness_m": {"type": "number", "exclusiveMinimum": 0},
        "notes": {"type": "string"},
        "locked": {"type": "boolean"},
        "previs_priority": {"type": "string", "enum": sorted(PREVIS_PRIORITY_VALUES)},
        "image_bbox": {
            "type": "object",
            "properties": {
                "x": {"type": "number", "minimum": 0, "maximum": 1},
                "y": {"type": "number", "minimum": 0, "maximum": 1},
                "width": {"type": "number", "exclusiveMinimum": 0, "maximum": 1},
                "height": {"type": "number", "exclusiveMinimum": 0, "maximum": 1},
            },
            "required": ["x", "y", "width", "height"],
        },
        "visible_fraction": {"type": "number", "minimum": 0, "maximum": 1},
        "occluded_by": {"type": "array", "maxItems": 32, "items": {"type": "string"}},
        "evidence_note": {"type": "string"},
    })
    schema["properties"].update({
        "declared_width_m": {"type": "number", "exclusiveMinimum": 0},
        "declared_depth_m": {"type": "number", "exclusiveMinimum": 0},
        "scene_type": {"type": "string", "enum": sorted(SCENE_TYPE_VALUES)},
        "scene_label": {"type": "string"},
        "scene_envelope": {
            "type": "object",
            "properties": {
                "width_m": {"type": "number", "exclusiveMinimum": 0},
                "depth_m": {"type": "number", "exclusiveMinimum": 0},
                "height_m": {"type": "number", "exclusiveMinimum": 0},
                "basis": {"type": "string", "enum": sorted(interpretation.BASIS_VALUES)},
                "confidence": {"type": "number", "minimum": 0, "maximum": 1},
                "notes": {"type": "string"},
            },
        },
    })
    return schema

REFERENCE_MASTER_INTERPRETATION_SCHEMA = _extended_interpretation_schema()


def _finite_number(value, label):
    try:
        number = float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{label} 값이 숫자가 아닙니다.") from exc
    if not math.isfinite(number):
        raise ValueError(f"{label} 값이 유효한 유한수가 아닙니다.")
    return number


def _unit_interval(value, label):
    number = _finite_number(value, label)
    if not 0 <= number <= 1:
        raise ValueError(f"{label} 값은 0~1 사이여야 합니다.")
    return number


def _positive_number(value, label):
    number = _finite_number(value, label)
    if number <= 0:
        raise ValueError(f"{label} 값은 0보다 커야 합니다.")
    return number


def _scene_type(value):
    candidate = str(value or "unknown").strip().lower()
    if candidate not in SCENE_TYPE_VALUES:
        raise ValueError(f"scene_type은 {sorted(SCENE_TYPE_VALUES)} 중 하나여야 합니다.")
    return candidate


def _basis_confidence(basis, confidence):
    candidate = str(basis or "inferred").strip()
    if candidate not in interpretation.BASIS_VALUES:
        raise ValueError(f"basis는 {sorted(interpretation.BASIS_VALUES)} 중 하나여야 합니다.")
    if confidence is None:
        confidence = 1.0 if candidate == "user_fixed" else (0.78 if candidate == "observed" else 0.5)
    return candidate, _unit_interval(confidence, "confidence")


def _normalize_scene_envelope(raw):
    if raw is None:
        return None
    if not isinstance(raw, dict):
        raise ValueError("scene_envelope는 객체여야 합니다.")
    result = {}
    for key in ("width_m", "depth_m", "height_m"):
        if raw.get(key) is not None:
            result[key] = _positive_number(raw[key], f"scene_envelope.{key}")
    if not result:
        raise ValueError("scene_envelope에는 width_m/depth_m/height_m 중 하나 이상이 필요합니다.")
    basis, confidence = _basis_confidence(raw.get("basis"), raw.get("confidence"))
    result["basis"] = basis
    result["confidence"] = confidence
    result["notes"] = str(raw.get("notes") or "")[:500]
    result["source"] = "explicit-scene-envelope"
    return result


def _normalize_image_bbox(raw, label):
    if raw is None:
        return None
    if not isinstance(raw, dict):
        raise ValueError(f"{label}는 객체여야 합니다.")
    bbox = {
        "x": _unit_interval(raw.get("x"), f"{label}.x"),
        "y": _unit_interval(raw.get("y"), f"{label}.y"),
        "width": _positive_number(raw.get("width"), f"{label}.width"),
        "height": _positive_number(raw.get("height"), f"{label}.height"),
    }
    if bbox["width"] > 1 or bbox["height"] > 1:
        raise ValueError(f"{label}.width/height는 1 이하여야 합니다.")
    if bbox["x"] + bbox["width"] > 1.000001 or bbox["y"] + bbox["height"] > 1.000001:
        raise ValueError(f"{label}가 이미지 정규화 범위 0~1을 벗어납니다.")
    return bbox


def _default_previs_priority(kind, role):
    if kind in CRITICAL_KINDS or role in {"structure", "opening"}:
        return "critical"
    if kind in MAJOR_KINDS or role in {"furniture", "service", "vegetation"}:
        return "major"
    if role == "prop" and kind == "generic":
        return "detail"
    return "supporting"


def _previs_priority(raw_object, kind, role):
    requested = str(raw_object.get("previs_priority") or "").strip().lower()
    if not requested:
        return _default_previs_priority(kind, role)
    if requested not in PREVIS_PRIORITY_VALUES:
        raise ValueError(f"previs_priority는 {sorted(PREVIS_PRIORITY_VALUES)} 중 하나여야 합니다.")
    return requested

CONTRACT_TOOL = {
    "name": "get_reference_master_set_contract",
    "description": (
        "레퍼런스 이미지를 사진 복제 3D가 아니라 촬영 가능한 Master Set으로 재구성하는 FrisFrame 권장 파이프라인을 반환합니다. "
        "외부 vision 모델이 공간을 해석하고, FrisFrame은 2D metric master plan을 source-of-truth로 만들어 2D/2.5D/3D가 같은 데이터를 공유합니다."
    ),
    "inputSchema": {"type": "object", "properties": {}},
}

COMPILE_TOOL = {
    "name": "compile_reference_master_plan",
    "description": (
        "외부 vision 모델의 레퍼런스 이미지 해석을 mutation 없이 2D 미터 기반 Master Set 계획으로 컴파일합니다. "
        "벽 선분, 문/창, 가구, observed/inferred/user_fixed provenance와 confidence를 보존합니다."
    ),
    "inputSchema": {
        "type": "object",
        "properties": {
            "interpretation": REFERENCE_MASTER_INTERPRETATION_SCHEMA,
            "project_id": {"type": "string"},
            "scene_index": {"type": "integer", "minimum": 0},
            "cut_index": {"type": "integer", "minimum": 0},
            "allow_outside_stage": {"type": "boolean"},
            "minimum_reliable_confidence": {"type": "number", "minimum": 0, "maximum": 1},
            "relation_tolerance_m": {"type": "number", "exclusiveMinimum": 0},
            "parallel_tolerance_deg": {"type": "number", "exclusiveMinimum": 0, "maximum": 45},
            "autonomous_scale": {
                "type": "boolean",
                "description": "사용자 실측 입력 없이 object/scene size prior 합의로 전역 미터 스케일을 자동 보정합니다. 기본 true.",
            },
            "minimum_autonomous_scale_confidence": {
                "type": "number", "minimum": 0.25, "maximum": 0.95,
                "description": "자동 스케일 합의를 blocking-ready로 인정할 최소 confidence. 기본 0.58.",
            },
        },
        "required": ["interpretation"],
    },
}

APPLY_TOOL = {
    "name": "apply_reference_master_set",
    "description": (
        "검증된 레퍼런스 이미지 해석을 반드시 2D metric Master Set으로 컴파일한 뒤 FrisFrame blocking에 한 revision으로 적용합니다. "
        "setMasterPlan이 2D/2.5D/3D의 단일 source-of-truth가 되며, camera 관찰값은 증거로 보존하지만 카메라는 이 단계에서 이동하지 않습니다."
    ),
    "inputSchema": {
        "type": "object",
        "properties": {
            **base.COMMON_TARGET_PROPERTIES,
            "interpretation": REFERENCE_MASTER_INTERPRETATION_SCHEMA,
            "require_interpretation_ready": {"type": "boolean"},
            "require_master_plan_ready": {"type": "boolean"},
            "allow_outside_stage": {"type": "boolean"},
            "replace_existing_set": {"type": "boolean"},
            "lock_after_apply": {"type": "boolean"},
            "minimum_reliable_confidence": {"type": "number", "minimum": 0, "maximum": 1},
            "relation_tolerance_m": {"type": "number", "exclusiveMinimum": 0},
            "parallel_tolerance_deg": {"type": "number", "exclusiveMinimum": 0, "maximum": 45},
            "autonomous_scale": {
                "type": "boolean",
                "description": "사용자 실측 입력 없이 object/scene size prior 합의로 전역 미터 스케일을 자동 보정합니다. 기본 true.",
            },
            "minimum_autonomous_scale_confidence": {
                "type": "number", "minimum": 0.25, "maximum": 0.95,
                "description": "자동 스케일 합의를 blocking-ready로 인정할 최소 confidence. 기본 0.58.",
            },
        },
        "required": ["project_id", "revision", "interpretation"],
    },
}


def _set_kind(raw_object):
    explicit = str(raw_object.get("kind") or "").strip()
    if explicit:
        if explicit not in set_reconstruction.KIND_VALUES:
            raise ValueError(f"reference object kind '{explicit}'를 지원하지 않습니다.")
        return explicit
    asset_type = str(raw_object.get("asset_type") or "").strip()
    return ASSET_KIND_MAP.get(asset_type, "generic")


def _set_role(raw_object, kind, normalized_object=None):
    requested = str(raw_object.get("role") or "").strip()
    if requested in SET_ROLES:
        return requested
    if kind != "generic":
        return set_reconstruction.DEFAULT_KIND[kind]["role"]
    if normalized_object and normalized_object.get("role") in SET_ROLES:
        return normalized_object["role"]
    return "prop"


def _prepare_object(raw_object, index):
    if not isinstance(raw_object, dict):
        raise ValueError(f"objects[{index}]가 객체가 아닙니다.")
    prepared = copy.deepcopy(raw_object)
    kind = _set_kind(raw_object)
    defaults = set_reconstruction.DEFAULT_KIND[kind]
    requested_role = str(raw_object.get("role") or defaults["role"])
    set_role = requested_role if requested_role in SET_ROLES else defaults["role"]
    prepared["role"] = BASE_ROLE_BY_SET_ROLE.get(requested_role, requested_role if requested_role in BASE_ROLES else "prop")
    prepared["previs_priority"] = _previs_priority(raw_object, kind, set_role)

    bbox = _normalize_image_bbox(raw_object.get("image_bbox"), f"objects[{index}].image_bbox")
    if bbox is not None:
        prepared["image_bbox"] = bbox
    if raw_object.get("visible_fraction") is not None:
        prepared["visible_fraction"] = _unit_interval(raw_object["visible_fraction"], f"objects[{index}].visible_fraction")
    occluded_by = raw_object.get("occluded_by") or []
    if not isinstance(occluded_by, list) or len(occluded_by) > 32:
        raise ValueError(f"objects[{index}].occluded_by는 32개 이하 배열이어야 합니다.")
    prepared["occluded_by"] = [str(value).strip() for value in occluded_by if str(value).strip()]
    prepared["evidence_note"] = str(raw_object.get("evidence_note") or "")[:500]

    line_keys = ("start_x_m", "start_z_m", "end_x_m", "end_z_m")
    present = [key for key in line_keys if raw_object.get(key) is not None]
    if present and len(present) != len(line_keys):
        raise ValueError(f"objects[{index}] 선분은 start/end x/z를 모두 제공해야 합니다.")

    if len(present) == len(line_keys):
        sx = float(raw_object["start_x_m"])
        sz = float(raw_object["start_z_m"])
        ex = float(raw_object["end_x_m"])
        ez = float(raw_object["end_z_m"])
        length = math.hypot(ex - sx, ez - sz)
        if not math.isfinite(length) or length < 0.02:
            raise ValueError(f"objects[{index}] 선분 길이가 너무 짧습니다.")
        thickness = raw_object.get("thickness_m", defaults.get("thickness_m", raw_object.get("depth_m", 0.12)))
        prepared["world_x_m"] = (sx + ex) / 2
        prepared["world_z_m"] = (sz + ez) / 2
        prepared["width_m"] = length
        prepared["depth_m"] = float(thickness)
        prepared["rotation_deg"] = math.degrees(math.atan2(ez - sz, ex - sx))
    else:
        for key in ("world_x_m", "world_z_m", "width_m"):
            if prepared.get(key) is None:
                raise ValueError(f"objects[{index}].{key}가 필요합니다.")
        if prepared.get("depth_m") is None:
            if defaults.get("depth_m") is not None:
                prepared["depth_m"] = defaults["depth_m"]
            elif kind in {"wall", "partition", "railing"}:
                prepared["depth_m"] = defaults.get("thickness_m", 0.12)
            elif kind == "column":
                prepared["depth_m"] = prepared["width_m"]
            else:
                raise ValueError(f"objects[{index}].depth_m가 필요합니다.")

    if prepared.get("height_m") is None:
        prepared["height_m"] = defaults["height_m"]
    if not prepared.get("asset_type"):
        prepared["asset_type"] = defaults["asset_type"]
    return prepared

def _prepare_interpretation(raw):
    if not isinstance(raw, dict):
        raise ValueError("interpretation은 객체여야 합니다.")
    prepared = copy.deepcopy(raw)
    prepared["scene_type"] = _scene_type(raw.get("scene_type"))
    prepared["scene_label"] = str(raw.get("scene_label") or "")[:160]
    envelope = _normalize_scene_envelope(raw.get("scene_envelope"))
    if envelope is not None:
        prepared["scene_envelope"] = envelope
    objects = raw.get("objects") or []
    if not isinstance(objects, list) or not objects:
        raise ValueError("interpretation.objects는 하나 이상 필요합니다.")
    prepared["objects"] = [_prepare_object(entry, index) for index, entry in enumerate(objects)]
    ids = {str(entry.get("id") or "") for entry in prepared["objects"]}
    for index, entry in enumerate(prepared["objects"]):
        object_id = str(entry.get("id") or "")
        for reference_id in entry.get("occluded_by") or []:
            if reference_id == object_id:
                raise ValueError(f"objects[{index}].occluded_by가 자기 자신을 참조합니다.")
            if reference_id not in ids:
                raise ValueError(f"objects[{index}].occluded_by '{reference_id}'가 objects에 없습니다.")
    return prepared

def _autonomous_scale_raw(raw, args):
    if not isinstance(raw, dict):
        raise ValueError("interpretation은 객체여야 합니다.")
    internal = args.get("_autonomous_scale_report") if isinstance(args, dict) else None
    if isinstance(internal, dict):
        return copy.deepcopy(raw), copy.deepcopy(internal)

    prepared = _prepare_interpretation(raw)
    scaled_prepared, report = autonomous_scale.infer_and_apply(
        prepared,
        minimum_confidence=(args or {}).get(
            "minimum_autonomous_scale_confidence",
            autonomous_scale.DEFAULT_MIN_CONFIDENCE,
        ),
        enabled=bool((args or {}).get("autonomous_scale", True)),
    )

    # _prepare_object maps set roles (opening/furniture/service) into the legacy
    # interpretation role vocabulary. Restore the caller's original role token
    # before Master Plan compilation while keeping the scaled geometry/defaults.
    original_by_id = {
        str(entry.get("id")): entry
        for entry in raw.get("objects", [])
        if isinstance(entry, dict) and entry.get("id")
    }
    for entry in scaled_prepared.get("objects") or []:
        original = original_by_id.get(str(entry.get("id") or ""), {})
        if "role" in original:
            entry["role"] = original["role"]
        else:
            entry.pop("role", None)
    return scaled_prepared, report


def _default_collection_id(role):
    return COLLECTION_BY_ROLE.get(role, "props")


def _compile_raw_master_plan(raw, normalized_interpretation):
    raw_by_id = {
        str(entry.get("id")): entry
        for entry in raw.get("objects", [])
        if isinstance(entry, dict) and entry.get("id")
    }
    elements = []
    used_collections = []

    for normalized_object in normalized_interpretation["objects"]:
        raw_object = raw_by_id.get(normalized_object["id"], {})
        kind = _set_kind(raw_object)
        role = _set_role(raw_object, kind, normalized_object)
        collection_id = str(raw_object.get("collection_id") or _default_collection_id(role))
        if collection_id not in used_collections:
            used_collections.append(collection_id)

        element = {
            "id": normalized_object["id"],
            "name": normalized_object["name"],
            "kind": kind,
            "role": role,
            "basis": normalized_object["basis"],
            "confidence": normalized_object["confidence"],
            "collection_id": collection_id,
            "world_x_m": normalized_object["world_x_m"],
            "world_z_m": normalized_object["world_z_m"],
            "width_m": normalized_object["width_m"],
            "height_m": normalized_object["height_m"],
            "depth_m": normalized_object["depth_m"],
            "rotation_deg": normalized_object["rotation_deg"],
            "mounted_height_m": normalized_object["mounted_height_m"],
            "asset_type": normalized_object["asset_type"],
            "include_in_scene": normalized_object["include_in_scene"],
            "notes": str(raw_object.get("notes") or "")[:500],
        }
        if raw_object.get("parent_id"):
            element["parent_id"] = raw_object["parent_id"]
        if raw_object.get("locked") is not None:
            element["locked"] = bool(raw_object["locked"])

        line_keys = ("start_x_m", "start_z_m", "end_x_m", "end_z_m")
        if all(raw_object.get(key) is not None for key in line_keys):
            for key in line_keys:
                element[key] = raw_object[key]
            if raw_object.get("thickness_m") is not None:
                element["thickness_m"] = raw_object["thickness_m"]
        elements.append(element)

    collections = []
    for collection_id in used_collections:
        collections.append({
            "id": collection_id,
            "name": COLLECTION_NAMES.get(collection_id, collection_id.replace("-", " ").title()),
            "locked": False,
            "allow_partial_unlock": True,
        })

    plan = {
        "source_name": normalized_interpretation["source_name"],
        "unit": "meter",
        "origin_note": "Compiled from reference-image interpretation before 3D/camera refinement.",
        "elements": elements,
        "collections": collections,
        "notes": "Master Set is authoritative; 2D, 2.5D and 3D are views of the same metric blocking items.",
    }
    for key in ("declared_width_m", "declared_depth_m"):
        if raw.get(key) is not None:
            plan[key] = raw[key]
    return plan


def _normalize_pipeline(args, *, blocking=None):
    raw = args.get("interpretation")
    metric_raw, autonomous_report = _autonomous_scale_raw(raw, args)
    prepared = _prepare_interpretation(metric_raw)
    prepared["_autonomous_scale"] = copy.deepcopy(autonomous_report)
    normalized_interpretation = interpretation.normalize_interpretation(
        prepared,
        relation_tolerance_m=args.get("relation_tolerance_m", 0.75),
        parallel_tolerance_deg=args.get("parallel_tolerance_deg", 12.0),
    )
    raw_master_plan = _compile_raw_master_plan(metric_raw, normalized_interpretation)
    normalized_master_plan = set_reconstruction.normalize_master_plan(
        raw_master_plan,
        blocking=blocking,
        allow_outside_stage=bool(args.get("allow_outside_stage", False)),
        minimum_reliable_confidence=args.get("minimum_reliable_confidence", 0.6),
    )
    return prepared, normalized_interpretation, raw_master_plan, normalized_master_plan

def _camera_observation(camera):
    if not isinstance(camera, dict):
        return None
    keys = (
        "target_id", "anchor_id", "axis", "physical_size_m", "frame_fraction",
        "focal_mm", "distance_m", "sensor_width_mm", "aspect", "horizon_y",
        "image_x", "image_y", "height_m", "world_x_m", "world_z_m",
        "pan_deg", "tilt_deg", "basis", "confidence",
    )
    return {key: camera.get(key) for key in keys if camera.get(key) is not None}


def _report_scene_envelope(prepared):
    explicit = prepared.get("scene_envelope")
    if isinstance(explicit, dict):
        return copy.deepcopy(explicit)
    declared = {}
    if prepared.get("declared_width_m") is not None:
        declared["width_m"] = _positive_number(prepared["declared_width_m"], "declared_width_m")
    if prepared.get("declared_depth_m") is not None:
        declared["depth_m"] = _positive_number(prepared["declared_depth_m"], "declared_depth_m")
    if not declared:
        return None
    declared.update({
        "basis": "inferred",
        "confidence": 0.55,
        "notes": "Legacy declared dimensions retained as coarse scene-envelope evidence.",
        "source": "declared-dimensions",
    })
    return declared


def _object_evidence(prepared_object, normalized_object):
    kind = _set_kind(prepared_object)
    role = _set_role(prepared_object, kind, normalized_object)
    priority = _previs_priority(prepared_object, kind, role)
    result = {
        "id": normalized_object["id"],
        "name": normalized_object["name"],
        "kind": kind,
        "role": role,
        "basis": normalized_object["basis"],
        "confidence": normalized_object["confidence"],
        "previs_priority": priority,
        "include_in_scene": normalized_object["include_in_scene"],
        "visible_fraction": prepared_object.get("visible_fraction"),
        "occluded_by": list(prepared_object.get("occluded_by") or []),
        "evidence_note": str(prepared_object.get("evidence_note") or "")[:500],
    }
    if prepared_object.get("image_bbox") is not None:
        result["image_bbox"] = copy.deepcopy(prepared_object["image_bbox"])
    else:
        result["image_bbox"] = None
    result["hidden_inference"] = bool(
        result["basis"] == "inferred"
        and result["visible_fraction"] is not None
        and float(result["visible_fraction"]) < 0.35
    )
    return result


def _reconstruction_report(prepared, normalized_interpretation, normalized_master_plan):
    prepared_by_id = {
        str(entry.get("id")): entry
        for entry in prepared.get("objects", [])
        if isinstance(entry, dict) and entry.get("id")
    }
    object_evidence = [
        _object_evidence(prepared_by_id.get(entry["id"], {}), entry)
        for entry in normalized_interpretation["objects"]
    ]
    important = [entry for entry in object_evidence if entry["previs_priority"] in {"critical", "major"} and entry["include_in_scene"]]
    critical = [entry for entry in important if entry["previs_priority"] == "critical"]
    major = [entry for entry in important if entry["previs_priority"] == "major"]
    details = [entry for entry in object_evidence if entry["previs_priority"] == "detail" and entry["include_in_scene"]]
    scene_type = _scene_type(prepared.get("scene_type"))
    envelope = _report_scene_envelope(prepared)
    reliable_scale = int(normalized_interpretation["summary"].get("reliable_scale_anchor_count", 0))
    autonomous_report = copy.deepcopy(prepared.get("_autonomous_scale") or {})
    autonomous_ready = bool(autonomous_report.get("ready"))
    user_fixed_envelope = bool(
        envelope
        and envelope.get("basis") == "user_fixed"
        and float(envelope.get("confidence", 0)) >= 0.8
        and any(envelope.get(key) is not None for key in ("width_m", "depth_m"))
    )
    scale_ready = reliable_scale > 0 or user_fixed_envelope or autonomous_ready
    if reliable_scale > 0 or user_fixed_envelope:
        scale_status = "anchored"
    elif autonomous_ready:
        scale_status = "autonomous"
    else:
        scale_status = "unanchored"

    queue = []
    if not scale_ready:
        queue.append({
            "code": "scale-anchor-needed",
            "rank": 0,
            "severity": "blocking",
            "message": "자동 object/scene prior 합의로도 안정적인 미터 스케일을 얻지 못했습니다. 이 경우에만 추가 scale evidence가 필요합니다.",
        })

    if scene_type == "interior":
        if envelope is None:
            queue.append({
                "code": "scene-envelope-needed",
                "rank": 1,
                "severity": "review",
                "message": "실내 공간의 대략적인 폭/깊이/높이 envelope가 아직 없습니다.",
            })
        elif float(envelope.get("confidence", 0)) < 0.6:
            queue.append({
                "code": "scene-envelope-low-confidence",
                "rank": 1,
                "severity": "review",
                "confidence": envelope.get("confidence"),
                "message": "실내 공간 envelope 신뢰도가 낮습니다. 전체 도면 정밀화가 아니라 방 규모만 먼저 확인하세요.",
            })

    for entry in critical:
        threshold = 0.7 if entry["basis"] == "inferred" else 0.58
        if float(entry["confidence"]) < threshold:
            queue.append({
                "code": "critical-spatial-uncertainty",
                "rank": 2,
                "severity": "review",
                "object_id": entry["id"],
                "kind": entry["kind"],
                "basis": entry["basis"],
                "confidence": entry["confidence"],
                "hidden_inference": entry["hidden_inference"],
                "message": "배우/카메라 배치에 영향을 주는 핵심 공간 요소의 위치·크기·방향을 확인하세요.",
            })
        if entry["kind"] in {"door", "window"}:
            raw = prepared_by_id.get(entry["id"], {})
            if not raw.get("parent_id"):
                queue.append({
                    "code": "opening-parent-unresolved",
                    "rank": 2,
                    "severity": "review",
                    "object_id": entry["id"],
                    "kind": entry["kind"],
                    "message": "문/창이 어느 벽에 속하는지 확인하세요.",
                })

    for entry in major:
        if float(entry["confidence"]) < 0.5:
            queue.append({
                "code": "major-blocking-object-uncertain",
                "rank": 5,
                "severity": "review",
                "object_id": entry["id"],
                "kind": entry["kind"],
                "confidence": entry["confidence"],
                "message": "블로킹에 영향을 주는 주요 가구/환경 오브젝트를 확인하세요.",
            })

    ignored_issue_codes = {"missing-camera", "camera-target-not-in-interpretation"}
    if autonomous_ready:
        ignored_issue_codes.add("missing-reliable-scale-anchor")
    for issue in normalized_interpretation.get("issues", []):
        if issue.get("code") in ignored_issue_codes:
            continue
        queue.append({
            "code": f"interpretation-{issue.get('code', 'review')}",
            "rank": 1,
            "severity": "review",
            "message": issue.get("message") or "Reference interpretation consistency needs review.",
        })

    room_zones = prepared.get("derived_room_zones") or []
    wall_count = sum(1 for entry in object_evidence if entry["kind"] in {"wall", "partition", "railing"} and entry["include_in_scene"])
    if scene_type == "interior" and wall_count >= 3 and not room_zones:
        queue.append({
            "code": "room-envelope-open",
            "rank": 4,
            "severity": "review",
            "message": "보이는 벽만으로 닫힌 방이 확인되지 않습니다. 보이지 않는 벽을 자동 생성하지 말고 필요할 때만 inferred로 확인하세요.",
        })

    deduped = []
    seen = set()
    for entry in sorted(queue, key=lambda item: (item.get("rank", 99), str(item.get("object_id") or ""), str(item.get("code") or ""))):
        key = (entry.get("code"), entry.get("object_id"))
        if key in seen:
            continue
        seen.add(key)
        clean = dict(entry)
        clean.pop("rank", None)
        deduped.append(clean)

    structure_count = sum(
        1 for entry in object_evidence
        if entry["include_in_scene"] and entry["role"] in {"structure", "surface"}
    )
    meaningful_count = len(important) + sum(
        1 for entry in object_evidence
        if entry["include_in_scene"] and entry["previs_priority"] == "supporting"
    )
    structure_ready = structure_count > 0 if scene_type == "interior" else meaningful_count > 0
    geometry_ready = normalized_master_plan.get("status") == "ready"
    blocking_viable = bool(scale_ready and structure_ready and geometry_ready and meaningful_count > 0)
    evidence_count = sum(
        1 for entry in important
        if entry.get("image_bbox") is not None
        or entry.get("visible_fraction") is not None
        or entry.get("evidence_note")
    )
    evidence_coverage = 1.0 if not important else evidence_count / len(important)
    camera = normalized_interpretation.get("camera")

    return {
        "policy": RECONSTRUCTION_POLICY,
        "goal": "shootable-set-first",
        "status": "review" if deduped else "ready",
        "blocking_viable": blocking_viable,
        "scene": {
            "type": scene_type,
            "label": str(prepared.get("scene_label") or "")[:160],
            "envelope": envelope,
            "occupied_bounds": copy.deepcopy(normalized_master_plan.get("bounds") or {}),
            "derived_room_zone_count": len(room_zones),
        },
        "scale": {
            "status": scale_status,
            "reliable_anchor_count": reliable_scale,
            "user_fixed_scene_envelope": user_fixed_envelope,
            "autonomous": autonomous_report,
        },
        "camera_evidence": {
            "present": camera is not None,
            "confidence": None if camera is None else camera.get("confidence"),
            "target_id": None if camera is None else camera.get("target_id"),
            "blocks_master_set": False,
            "applied_during_set_build": False,
        },
        "coverage": {
            "critical_count": len(critical),
            "major_count": len(major),
            "supporting_count": sum(1 for entry in object_evidence if entry["previs_priority"] == "supporting" and entry["include_in_scene"]),
            "detail_count": len(details),
            "important_evidence_coverage": round(evidence_coverage, 4),
            "observed_count": sum(1 for entry in object_evidence if entry["basis"] == "observed"),
            "inferred_count": sum(1 for entry in object_evidence if entry["basis"] == "inferred"),
            "user_fixed_count": sum(1 for entry in object_evidence if entry["basis"] == "user_fixed"),
        },
        "focus_object_ids": [entry["id"] for entry in important],
        "ignored_detail_ids": [entry["id"] for entry in details],
        "object_evidence": object_evidence,
        "correction_queue": deduped,
        "next_action": "correct-flagged-spatial-uncertainties" if deduped else "actor-blocking-and-camera-design",
        "guardrails": [
            "Do not synthesize unseen walls or objects silently; hidden geometry must remain explicit inferred evidence.",
            "Decorative detail never blocks first-pass shootable-set readiness.",
            "Reference-camera evidence is retained but never moves the authored previs camera during set build.",
            "Correct only spatial uncertainties that can change blocking, camera placement, framing, or movement clearance.",
        ],
    }


def _reference_evidence(normalized_interpretation, prepared=None, reconstruction=None):
    prepared = prepared or {}
    reconstruction = reconstruction or {}
    return {
        "schema": normalized_interpretation["schema"],
        "version": normalized_interpretation["version"],
        "sourceName": normalized_interpretation["source_name"],
        "image": copy.deepcopy(normalized_interpretation.get("image") or {}),
        "statusAtCompile": normalized_interpretation["status"],
        "summary": copy.deepcopy(normalized_interpretation["summary"]),
        "scaleAnchors": copy.deepcopy(normalized_interpretation["scale_anchors"]),
        "relationships": copy.deepcopy(normalized_interpretation["relationships"]),
        "cameraObservation": _camera_observation(normalized_interpretation.get("camera")),
        "cameraApplied": False,
        "pipelinePolicy": PIPELINE_POLICY,
        "reconstructionPolicy": RECONSTRUCTION_POLICY,
        "sceneType": _scene_type(prepared.get("scene_type")),
        "sceneLabel": str(prepared.get("scene_label") or "")[:160],
        "sceneEnvelope": copy.deepcopy(reconstruction.get("scene", {}).get("envelope")),
        "objectEvidence": copy.deepcopy(reconstruction.get("object_evidence") or []),
        "derivedRoomZones": copy.deepcopy(prepared.get("derived_room_zones") or []),
        "reconstruction": copy.deepcopy(reconstruction),
    }

def pipeline_contract():
    return {
        "schema": "frisframe-reference-master-set-contract",
        "version": 2,
        "product_definition": (
            "A reference image is spatial evidence. FrisFrame reconstructs a shootable virtual set for blocking and camera design, "
            "not a pixel-identical 3D copy and not a precision CAD drawing."
        ),
        "reconstruction_policy": RECONSTRUCTION_POLICY,
        "first_pass_goal": "shootable-spatial-set",
        "detail_policy": "decorative-detail-never-blocks-first-pass-readiness",
        "correction_policy": "Correct only flagged spatial uncertainties that can change actor blocking, camera placement, framing, or movement clearance.",
        "autonomous_scale": {
            "default": True,
            "policy": autonomous_scale.POLICY,
            "user_metric_input_required": False,
            "method": "robust consensus of familiar object-size priors + scene-envelope prior + vision spatial geometry",
            "user_fixed_override": "optional and authoritative when present",
            "uncertainty": "single-image absolute scale remains probabilistic; confidence and evidence are always retained",
        },
        "ownership": {
            "image_pixel_reasoning": "external-vision-mcp-client",
            "metric_validation_master_set_and_views": "FrisFrame",
            "frisframe_calls_ai_api": False,
        },
        "authoritative_flow": [
            "reference image",
            "spatial interpretation",
            "metric scale + provenance review",
            "2D Master Set",
            "2.5D layout review",
            "3D proxy set",
            "actor blocking",
            "camera placement and shot design",
        ],
        "first_pass_priority": [
            "scene envelope and usable metric scale",
            "walls/boundaries/openings that affect movement and framing",
            "major furniture and obstacles that affect blocking",
            "reference-camera evidence for later calibration",
            "decorative detail only when it matters to a shot",
        ],
        "source_of_truth": {
            "data": "blocking.setMasterPlan + shared blocking items",
            "views": ["2D", "2.5D", "3D"],
            "policy": "same-items-same-referenceDimensionsM",
        },
        "interpretation_rules": {
            "linear_architecture": "Prefer kind + start_x_m/start_z_m/end_x_m/end_z_m + thickness_m for walls/partitions/railings.",
            "rectangular_elements": "Use world_x_m/world_z_m + width_m/depth_m; height can use kind defaults when omitted.",
            "provenance": "Every blocking-relevant object should be observed, inferred, or user_fixed with confidence.",
            "visual_evidence": "For important objects, retain normalized image_bbox, visible_fraction, occlusion references, and a short evidence note when available.",
            "priority": "Mark spatially decisive architecture/openings as critical, large blocking objects as major, and nonessential decoration as detail.",
            "hidden_geometry": "Never silently close a room. Hidden boundaries must be explicitly supplied as inferred geometry with confidence/evidence.",
            "scale": "Infer metric scale autonomously from multiple familiar object/scene priors by default; explicit user-fixed dimensions are optional overrides, not prerequisites.",
            "camera": "Reference camera observation is evidence for later shot calibration and never moves the authored FrisFrame camera while building the set.",
        },
        "preferred_tools": [
            "get_reference_master_set_contract",
            "validate_reference_interpretation",
            "compile_reference_master_plan",
            "apply_reference_master_set",
            "set_set_collection_lock",
        ],
        "legacy_note": "apply_reference_interpretation remains available for compatibility; new set reconstruction should prefer apply_reference_master_set.",
        "schema_hint": REFERENCE_MASTER_INTERPRETATION_SCHEMA,
    }

def _compile(args):
    blocking = None
    if args.get("project_id"):
        blocking = base._load_blocking(
            args.get("project_id"),
            int(args.get("scene_index", 0)),
            int(args.get("cut_index", 0)),
        )
    prepared, normalized_interpretation, _, normalized_master_plan = _normalize_pipeline(args, blocking=blocking)
    reconstruction = _reconstruction_report(prepared, normalized_interpretation, normalized_master_plan)
    return {
        "schema": "frisframe-reference-master-set-compile",
        "version": 2,
        "status": "ready" if reconstruction["blocking_viable"] else "review",
        "pipeline_policy": PIPELINE_POLICY,
        "reconstruction_policy": RECONSTRUCTION_POLICY,
        "reference_interpretation": {
            "status": normalized_interpretation["status"],
            "summary": normalized_interpretation["summary"],
            "issues": normalized_interpretation["issues"],
            "relation_checks": normalized_interpretation["relation_checks"],
        },
        "reference_reconstruction": reconstruction,
        "master_plan": normalized_master_plan,
        "camera_policy": "observation-retained-not-applied-during-master-set",
    }

def _apply(args):
    project_id = args.get("project_id")
    revision = int(args["revision"])
    scene_index = int(args.get("scene_index", 0))
    cut_index = int(args.get("cut_index", 0))
    blocking = base._load_blocking(project_id, scene_index, cut_index)
    prepared, normalized_interpretation, _, normalized_master_plan = _normalize_pipeline(args, blocking=blocking)
    reconstruction = _reconstruction_report(prepared, normalized_interpretation, normalized_master_plan)

    if bool(args.get("require_interpretation_ready", True)) and not reconstruction["blocking_viable"]:
        codes = ", ".join(item["code"] for item in reconstruction["correction_queue"][:8]) or "blocking-not-viable"
        raise ValueError(f"reference-reconstruction-review-required: {codes}")
    if bool(args.get("require_master_plan_ready", True)) and normalized_master_plan["status"] != "ready":
        codes = ", ".join(issue["code"] for issue in normalized_master_plan["issues"][:8])
        raise ValueError(f"reference-master-plan-review-required: {codes}")

    replace_existing = bool(args.get("replace_existing_set", True))
    operations, set_anchors, applied_elements = set_reconstruction._compile_operations(
        normalized_master_plan,
        blocking,
        replace_existing,
    )
    objects_by_id = {entry["id"]: entry for entry in normalized_interpretation["objects"]}
    scale_anchors = []
    generated_ids = {entry["id"] for entry in applied_elements}
    for anchor in normalized_interpretation["scale_anchors"]:
        if anchor["object_id"] not in generated_ids:
            continue
        if anchor["id"] in generated_ids:
            raise ValueError(f"scale anchor id '{anchor['id']}'가 Master Set element id와 충돌합니다.")
        scale_anchors.append(interpretation._scale_anchor_payload(anchor, objects_by_id[anchor["object_id"]]))

    all_anchors = list(set_anchors) + scale_anchors
    spatial_guide = reference._merge_guide(blocking, normalized_interpretation["source_name"], all_anchors)
    evidence = _reference_evidence(normalized_interpretation, prepared, reconstruction)

    def apply_atomic(project_obj):
        payload = base._target_args(args, revision)
        payload["operations"] = operations
        payload["spatial_guide"] = spatial_guide
        stage_result = base._json_result(core.handle_apply_scene_commands(project_id, payload))
        stage_detail = base._json_result(stage_result.get("message", ""))
        if not isinstance(stage_detail, dict):
            raise ValueError("reference Master Set 적용 결과를 읽지 못했습니다.")
        current_blocking = set_reconstruction._blocking_from_project(project_obj, scene_index, cut_index)
        collections = set_reconstruction._persist_plan(
            current_blocking,
            normalized_master_plan,
            applied_elements,
            bool(args.get("lock_after_apply", False)),
        )
        current_blocking["setMasterPlan"]["referenceInterpretation"] = evidence
        current_blocking["setMasterPlan"]["pipelinePolicy"] = PIPELINE_POLICY
        current_blocking["setMasterPlan"]["reconstructionPolicy"] = RECONSTRUCTION_POLICY
        current_blocking["setMasterPlan"]["referenceReconstruction"] = copy.deepcopy(reconstruction)
        current_blocking["setMasterPlan"]["cameraAppliedDuringSetBuild"] = False
        return {"stage": stage_detail, "collections": collections}

    committed = base._json_result(core.mutate_project_atomic(project_id, revision, apply_atomic))
    detail = committed.get("message")
    if not isinstance(detail, dict):
        detail = base._json_result(detail)
    return {
        "project_id": project_id,
        "revision": committed["revision"],
        "updated_at": committed.get("updated_at"),
        "reference_master_pipeline": {
            "status": "ready" if reconstruction["blocking_viable"] else "review",
            "pipeline_policy": PIPELINE_POLICY,
            "reconstruction_policy": RECONSTRUCTION_POLICY,
            "reference_status": normalized_interpretation["status"],
            "reconstruction_status": reconstruction["status"],
            "blocking_viable": reconstruction["blocking_viable"],
            "master_plan_status": normalized_master_plan["status"],
            "generated_item_ids": [entry["id"] for entry in applied_elements],
            "collection_ids": [entry["id"] for entry in normalized_master_plan["collections"]],
            "operation_count": len(operations),
            "scale_anchor_count": len(scale_anchors),
            "camera_observation_retained": normalized_interpretation.get("camera") is not None,
            "camera_applied": False,
            "atomic_revision": True,
            "source_of_truth": "blocking.setMasterPlan",
            "view_policy": "2D/2.5D/3D share the same blocking items and referenceDimensionsM",
            "next_step": (
                "Correct only flagged spatial uncertainties, then block actors and place/calibrate cameras."
                if reconstruction["correction_queue"]
                else "Block actors and place/calibrate cameras; the first-pass set is spatially ready."
            ),
            "correction_queue": copy.deepcopy(reconstruction["correction_queue"]),
        },
        "reference_reconstruction": reconstruction,
        "set_master_plan": {
            "summary": normalized_master_plan["summary"],
            "bounds": normalized_master_plan["bounds"],
            "issues": normalized_master_plan["issues"],
        },
        "stage": detail.get("stage") if isinstance(detail, dict) else detail,
        "collections": detail.get("collections") if isinstance(detail, dict) else None,
    }


_PREVIOUS_CALL_TOOL = base.call_tool


def call_tool(name, args):
    if name == "get_reference_master_set_contract":
        return json.dumps(pipeline_contract(), ensure_ascii=False)
    if name == "compile_reference_master_plan":
        return json.dumps(_compile(args), ensure_ascii=False)
    if name == "apply_reference_master_set":
        return json.dumps(_apply(args), ensure_ascii=False)
    if name == "get_reference_interpretation_contract":
        payload = json.loads(_PREVIOUS_CALL_TOOL(name, args))
        payload["preferred_master_set_pipeline"] = [
            "compile_reference_master_plan",
            "apply_reference_master_set",
        ]
        payload["legacy_apply_reference_interpretation"] = True
        return json.dumps(payload, ensure_ascii=False)
    return _PREVIOUS_CALL_TOOL(name, args)


def install():
    if getattr(base, "_reference_master_pipeline_extension_installed", False):
        return
    existing = {tool.get("name") for tool in base.TOOLS}
    for tool in (CONTRACT_TOOL, COMPILE_TOOL, APPLY_TOOL):
        if tool["name"] not in existing:
            base.TOOLS.append(tool)
    base.call_tool = call_tool
    base._reference_master_pipeline_extension_installed = True


install()
