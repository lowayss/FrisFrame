#!/usr/bin/env python3
"""Metric 2D master-plan -> FrisFrame set reconstruction MCP extension.

The external vision-capable MCP client interprets the reference image. This
module requires that interpretation to be expressed first as a top-down metric
master plan, validates the plan, and then applies the same metric objects to
FrisFrame. Because FrisFrame's 2D stage and 3D preview share the same blocking
items and referenceDimensionsM, the 2D plan is the spatial source of truth and
the 3D proxy set is a deterministic view of that plan.

No AI API is called from FrisFrame.
"""

from __future__ import annotations

import json
import math
import re

import mcp_previs_server as base
import mcp_server as core
import reference_space_core as space
import reference_space_mcp as reference


ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,64}$")
BASIS_VALUES = {"observed", "inferred", "user_fixed"}
ROLE_VALUES = {"structure", "surface", "opening", "furniture", "prop", "vegetation", "service"}
KIND_VALUES = {
    "zone", "floor", "slab", "platform", "stage", "deck",
    "wall", "partition", "door", "window", "column", "beam",
    "counter", "cabinet", "table", "chair", "sofa", "bed",
    "stairs", "railing", "pool", "pergola",
    "tree", "vegetation",
    "sink", "toilet", "bathtub", "refrigerator", "stove", "television",
    "generic",
}
DEFAULT_KIND = {
    "zone": {"asset_type": "box", "role": "surface", "height_m": 0.05, "color": "#DDD2C8"},
    "floor": {"asset_type": "box", "role": "surface", "height_m": 0.08, "color": "#D9D1C5"},
    "slab": {"asset_type": "box", "role": "surface", "height_m": 0.15, "color": "#B9B4AE"},
    "platform": {"asset_type": "box", "role": "structure", "height_m": 0.3, "color": "#C58F98"},
    "stage": {"asset_type": "box", "role": "structure", "height_m": 0.3, "color": "#C58F98"},
    "deck": {"asset_type": "box", "role": "surface", "height_m": 0.15, "color": "#B89979"},
    "wall": {"asset_type": "wall", "role": "structure", "height_m": 2.8, "thickness_m": 0.15, "color": "#66605B"},
    "partition": {"asset_type": "partition", "role": "structure", "height_m": 2.2, "thickness_m": 0.12, "color": "#817A74"},
    "door": {"asset_type": "door", "role": "opening", "height_m": 2.1, "depth_m": 0.12, "color": "#A88465"},
    "window": {"asset_type": "window", "role": "opening", "height_m": 1.2, "depth_m": 0.10, "color": "#AFC8CC"},
    "column": {"asset_type": "cylinder", "role": "structure", "height_m": 2.8, "color": "#8D8781"},
    "beam": {"asset_type": "box", "role": "structure", "height_m": 0.25, "color": "#7D7771"},
    "counter": {"asset_type": "cabinet", "role": "service", "height_m": 0.9, "depth_m": 0.75, "color": "#C59693"},
    "cabinet": {"asset_type": "cabinet", "role": "furniture", "height_m": 1.45, "depth_m": 0.55, "color": "#B8947A"},
    "table": {"asset_type": "dining-table", "role": "furniture", "height_m": 0.75, "depth_m": 0.9, "color": "#C49D83"},
    "chair": {"asset_type": "chair", "role": "furniture", "height_m": 0.9, "depth_m": 0.55, "color": "#C49D83"},
    "sofa": {"asset_type": "sofa", "role": "furniture", "height_m": 0.9, "depth_m": 0.9, "color": "#C78991"},
    "bed": {"asset_type": "bed", "role": "furniture", "height_m": 0.65, "depth_m": 2.0, "color": "#D5B6A8"},
    "stairs": {"asset_type": "stairs", "role": "structure", "height_m": 1.2, "depth_m": 2.0, "color": "#9B938B"},
    "railing": {"asset_type": "panel", "role": "structure", "height_m": 1.05, "thickness_m": 0.06, "color": "#8FA1A2"},
    "pool": {"asset_type": "box", "role": "surface", "height_m": 0.18, "color": "#79AFC2"},
    "pergola": {"asset_type": "box", "role": "structure", "height_m": 2.5, "color": "#9D8A75"},
    "tree": {"asset_type": "tree", "role": "vegetation", "height_m": 3.5, "depth_m": 1.2, "color": "#76906A"},
    "vegetation": {"asset_type": "forest", "role": "vegetation", "height_m": 2.5, "depth_m": 1.5, "color": "#78966D"},
    "sink": {"asset_type": "sink", "role": "service", "height_m": 0.88, "depth_m": 0.55, "color": "#D7D7D2"},
    "toilet": {"asset_type": "toilet", "role": "service", "height_m": 0.8, "depth_m": 0.7, "color": "#D7D7D2"},
    "bathtub": {"asset_type": "bathtub", "role": "service", "height_m": 0.6, "depth_m": 0.8, "color": "#D7D7D2"},
    "refrigerator": {"asset_type": "refrigerator", "role": "service", "height_m": 1.9, "depth_m": 0.75, "color": "#A9B0B1"},
    "stove": {"asset_type": "stove", "role": "service", "height_m": 0.9, "depth_m": 0.7, "color": "#9B9D9D"},
    "television": {"asset_type": "television", "role": "prop", "height_m": 1.1, "depth_m": 0.15, "color": "#4C4C4C"},
    "generic": {"asset_type": "box", "role": "prop", "height_m": 1.0, "depth_m": 1.0, "color": "#A7A09A"},
}


ELEMENT_SCHEMA = {
    "type": "object",
    "properties": {
        "id": {"type": "string"},
        "name": {"type": "string"},
        "kind": {"type": "string", "enum": sorted(KIND_VALUES)},
        "role": {"type": "string", "enum": sorted(ROLE_VALUES)},
        "basis": {"type": "string", "enum": sorted(BASIS_VALUES)},
        "confidence": {"type": "number", "minimum": 0, "maximum": 1},
        "collection_id": {"type": "string"},
        "parent_id": {"type": "string"},
        "world_x_m": {"type": "number"},
        "world_z_m": {"type": "number"},
        "width_m": {"type": "number", "exclusiveMinimum": 0},
        "height_m": {"type": "number", "exclusiveMinimum": 0},
        "depth_m": {"type": "number", "exclusiveMinimum": 0},
        "rotation_deg": {"type": "number"},
        "mounted_height_m": {"type": "number"},
        "start_x_m": {"type": "number"},
        "start_z_m": {"type": "number"},
        "end_x_m": {"type": "number"},
        "end_z_m": {"type": "number"},
        "thickness_m": {"type": "number", "exclusiveMinimum": 0},
        "asset_type": {"type": "string"},
        "color": {"type": "string", "pattern": "^#[0-9A-Fa-f]{6}$"},
        "visible": {"type": "boolean"},
        "include_in_scene": {"type": "boolean"},
        "locked": {"type": "boolean"},
        "motion_enabled": {"type": "boolean"},
        "notes": {"type": "string"},
    },
    "required": ["id", "kind"],
}

COLLECTION_SCHEMA = {
    "type": "object",
    "properties": {
        "id": {"type": "string"},
        "name": {"type": "string"},
        "parent_id": {"type": "string"},
        "locked": {"type": "boolean"},
        "allow_partial_unlock": {"type": "boolean"},
    },
    "required": ["id"],
}

MASTER_PLAN_SCHEMA = {
    "type": "object",
    "properties": {
        "source_name": {"type": "string"},
        "unit": {"type": "string", "enum": ["meter", "m"]},
        "declared_width_m": {"type": "number", "exclusiveMinimum": 0},
        "declared_depth_m": {"type": "number", "exclusiveMinimum": 0},
        "origin_note": {"type": "string"},
        "elements": {"type": "array", "minItems": 1, "maxItems": 180, "items": ELEMENT_SCHEMA},
        "collections": {"type": "array", "maxItems": 32, "items": COLLECTION_SCHEMA},
        "notes": {"type": "string"},
    },
    "required": ["elements"],
}


CONTRACT_TOOL = {
    "name": "get_set_reconstruction_contract",
    "description": (
        "레퍼런스 이미지를 바로 3D로 추측하지 않고, 먼저 실측 미터 기반 2D 조감도/평면 마스터를 만든 뒤 "
        "그 동일 데이터를 3D 프록시 세트로 구현하는 권장 계약을 반환합니다. 이미지 해석은 외부 vision MCP 클라이언트가 담당합니다."
    ),
    "inputSchema": {"type": "object", "properties": {}},
}

VALIDATE_TOOL = {
    "name": "validate_set_master_plan",
    "description": (
        "외부 vision 모델이 만든 2D 세트 마스터 플랜을 mutation 없이 검증합니다. "
        "실측 크기, 벽 선분, 무대 범위, collection, observed/inferred provenance를 검사합니다."
    ),
    "inputSchema": {
        "type": "object",
        "properties": {
            "project_id": {"type": "string"},
            "scene_index": {"type": "integer", "minimum": 0},
            "cut_index": {"type": "integer", "minimum": 0},
            "master_plan": MASTER_PLAN_SCHEMA,
            "allow_outside_stage": {"type": "boolean"},
            "minimum_reliable_confidence": {"type": "number", "minimum": 0, "maximum": 1},
        },
        "required": ["master_plan"],
    },
}

APPLY_TOOL = {
    "name": "apply_set_master_plan",
    "description": (
        "검증된 미터 기반 2D 마스터 플랜을 FrisFrame blocking item으로 적용합니다. "
        "referenceDimensionsM가 2D footprint와 3D proxy에 동시에 사용되므로 2D가 공간 source-of-truth가 됩니다. "
        "기존 배우/카메라는 보존하고, 이전에 이 도구가 생성한 세트만 선택적으로 교체할 수 있습니다."
    ),
    "inputSchema": {
        "type": "object",
        "properties": {
            **base.COMMON_TARGET_PROPERTIES,
            "master_plan": MASTER_PLAN_SCHEMA,
            "require_ready": {"type": "boolean"},
            "allow_outside_stage": {"type": "boolean"},
            "replace_existing_set": {"type": "boolean"},
            "lock_after_apply": {"type": "boolean"},
            "minimum_reliable_confidence": {"type": "number", "minimum": 0, "maximum": 1},
        },
        "required": ["project_id", "revision", "master_plan"],
    },
}

LOCK_TOOL = {
    "name": "set_set_collection_lock",
    "description": (
        "apply_set_master_plan이 만든 semantic set collection의 편집 잠금을 제어합니다. "
        "전체 잠금/전체 해제와 일부 member만 잠금 또는 해제를 지원하며, actor/camera에는 영향을 주지 않습니다."
    ),
    "inputSchema": {
        "type": "object",
        "properties": {
            **base.COMMON_TARGET_PROPERTIES,
            "collection_id": {"type": "string"},
            "mode": {
                "type": "string",
                "enum": ["lock_all", "unlock_all", "lock_members", "unlock_members"],
            },
            "item_ids": {"type": "array", "maxItems": 180, "items": {"type": "string"}},
        },
        "required": ["project_id", "revision", "collection_id", "mode"],
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


def _identifier(value, label):
    candidate = str(value or "").strip()
    if not ID_RE.fullmatch(candidate):
        raise ValueError(f"{label}는 영문/숫자/_/- 64자 이하여야 합니다.")
    return candidate


def _basis(value):
    candidate = str(value or "inferred").strip()
    if candidate not in BASIS_VALUES:
        raise ValueError(f"basis는 {sorted(BASIS_VALUES)} 중 하나여야 합니다.")
    return candidate


def _confidence(value, basis):
    if value is None:
        return 1.0 if basis == "user_fixed" else (0.78 if basis == "observed" else 0.5)
    return min(1.0, max(0.0, _finite(value, "confidence")))


def _color(value, fallback):
    candidate = str(value or fallback).strip()
    if not re.fullmatch(r"#[0-9A-Fa-f]{6}", candidate):
        raise ValueError("color는 #RRGGBB 형식이어야 합니다.")
    return candidate.upper()


def _blocking_from_project(project_obj, scene_index, cut_index):
    scenes = project_obj.get("scenes") or []
    if not 0 <= scene_index < len(scenes):
        raise ValueError(f"scene_index 범위를 벗어났습니다: {scene_index}")
    cuts = scenes[scene_index].get("cuts") or []
    if not 0 <= cut_index < len(cuts):
        raise ValueError(f"cut_index 범위를 벗어났습니다: {cut_index}")
    blocking = cuts[cut_index].get("blocking")
    if not isinstance(blocking, dict):
        raise ValueError("선택한 컷에 blocking 데이터가 없습니다.")
    return blocking


def _line_rect(raw, index, defaults):
    required = ("start_x_m", "start_z_m", "end_x_m", "end_z_m")
    present = [key for key in required if raw.get(key) is not None]
    if not present:
        return None
    if len(present) != len(required):
        raise ValueError(f"elements[{index}] 선분은 start/end x/z를 모두 제공해야 합니다.")
    sx = _finite(raw["start_x_m"], f"elements[{index}].start_x_m")
    sz = _finite(raw["start_z_m"], f"elements[{index}].start_z_m")
    ex = _finite(raw["end_x_m"], f"elements[{index}].end_x_m")
    ez = _finite(raw["end_z_m"], f"elements[{index}].end_z_m")
    length = math.hypot(ex - sx, ez - sz)
    if length < 0.02:
        raise ValueError(f"elements[{index}] 선분 길이가 너무 짧습니다.")
    thickness = _positive(
        raw.get("thickness_m", defaults.get("thickness_m", raw.get("depth_m", 0.12))),
        f"elements[{index}].thickness_m",
    )
    rotation = math.degrees(math.atan2(ez - sz, ex - sx))
    return {
        "world_x_m": (sx + ex) / 2,
        "world_z_m": (sz + ez) / 2,
        "width_m": length,
        "depth_m": thickness,
        "rotation_deg": rotation,
        "line": {
            "start_x_m": sx,
            "start_z_m": sz,
            "end_x_m": ex,
            "end_z_m": ez,
            "length_m": length,
            "thickness_m": thickness,
        },
    }


def _normalize_element(raw, index, known_collection_ids):
    if not isinstance(raw, dict):
        raise ValueError(f"elements[{index}]가 객체가 아닙니다.")
    element_id = _identifier(raw.get("id"), f"elements[{index}].id")
    kind = str(raw.get("kind") or "generic")
    if kind not in KIND_VALUES:
        raise ValueError(f"elements[{index}].kind은 {sorted(KIND_VALUES)} 중 하나여야 합니다.")
    defaults = DEFAULT_KIND[kind]
    basis = _basis(raw.get("basis"))
    collection_id = _identifier(raw.get("collection_id") or "main-set", f"elements[{index}].collection_id")
    if known_collection_ids and collection_id not in known_collection_ids:
        raise ValueError(f"elements[{index}].collection_id '{collection_id}'가 collections에 없습니다.")

    line = _line_rect(raw, index, defaults)
    if line is not None:
        world_x = line["world_x_m"]
        world_z = line["world_z_m"]
        width = line["width_m"]
        depth = line["depth_m"]
        rotation = line["rotation_deg"]
    else:
        world_x = _finite(raw.get("world_x_m"), f"elements[{index}].world_x_m")
        world_z = _finite(raw.get("world_z_m"), f"elements[{index}].world_z_m")
        width = _positive(raw.get("width_m"), f"elements[{index}].width_m")
        depth_value = raw.get("depth_m", defaults.get("depth_m"))
        if depth_value is None:
            if kind in {"column"}:
                depth_value = width
            elif kind in {"wall", "partition", "railing"}:
                depth_value = defaults.get("thickness_m", 0.12)
            else:
                depth_value = width
        depth = _positive(depth_value, f"elements[{index}].depth_m")
        rotation = _finite(raw.get("rotation_deg", 0), f"elements[{index}].rotation_deg")

    height = _positive(raw.get("height_m", defaults["height_m"]), f"elements[{index}].height_m")
    mounted_height = _finite(
        raw.get("mounted_height_m", -0.12 if kind == "pool" else 0),
        f"elements[{index}].mounted_height_m",
    )
    asset_type = str(raw.get("asset_type") or defaults["asset_type"])
    if asset_type not in core.MCP_PROP_TYPES:
        asset_type = defaults["asset_type"] if defaults["asset_type"] in core.MCP_PROP_TYPES else "box"

    role = str(raw.get("role") or defaults["role"])
    if role not in ROLE_VALUES:
        raise ValueError(f"elements[{index}].role은 {sorted(ROLE_VALUES)} 중 하나여야 합니다.")
    parent_id = ""
    if raw.get("parent_id"):
        parent_id = _identifier(raw.get("parent_id"), f"elements[{index}].parent_id")

    return {
        "id": element_id,
        "name": str(raw.get("name") or element_id)[:80],
        "kind": kind,
        "role": role,
        "basis": basis,
        "confidence": _confidence(raw.get("confidence"), basis),
        "collection_id": collection_id,
        "parent_id": parent_id,
        "world_x_m": world_x,
        "world_z_m": world_z,
        "width_m": width,
        "height_m": height,
        "depth_m": depth,
        "rotation_deg": rotation,
        "mounted_height_m": mounted_height,
        "asset_type": asset_type,
        "color": _color(raw.get("color"), defaults["color"]),
        "visible": bool(raw.get("visible", True)),
        "include_in_scene": bool(raw.get("include_in_scene", True)),
        "locked": None if raw.get("locked") is None else bool(raw.get("locked")),
        "motion_enabled": bool(raw.get("motion_enabled", False)),
        "notes": str(raw.get("notes") or "")[:500],
        "line": None if line is None else line["line"],
    }


def _normalize_collection(raw, index):
    if not isinstance(raw, dict):
        raise ValueError(f"collections[{index}]가 객체가 아닙니다.")
    collection_id = _identifier(raw.get("id"), f"collections[{index}].id")
    parent_id = ""
    if raw.get("parent_id"):
        parent_id = _identifier(raw.get("parent_id"), f"collections[{index}].parent_id")
    return {
        "id": collection_id,
        "name": str(raw.get("name") or collection_id)[:80],
        "parent_id": parent_id,
        "locked": bool(raw.get("locked", False)),
        "allow_partial_unlock": bool(raw.get("allow_partial_unlock", True)),
    }


def _element_bounds(element):
    return space.mass_bounds({
        "world_x_m": element["world_x_m"],
        "world_z_m": element["world_z_m"],
        "width_m": element["width_m"],
        "depth_m": element["depth_m"],
        "rotation_deg": element["rotation_deg"],
    })


def _plan_bounds(elements):
    if not elements:
        return {"min_x": 0, "max_x": 0, "min_z": 0, "max_z": 0, "width_m": 0, "depth_m": 0}
    bounds = [_element_bounds(element) for element in elements if element["include_in_scene"]]
    if not bounds:
        return {"min_x": 0, "max_x": 0, "min_z": 0, "max_z": 0, "width_m": 0, "depth_m": 0}
    min_x = min(entry["min_x"] for entry in bounds)
    max_x = max(entry["max_x"] for entry in bounds)
    min_z = min(entry["min_z"] for entry in bounds)
    max_z = max(entry["max_z"] for entry in bounds)
    return {
        "min_x": min_x,
        "max_x": max_x,
        "min_z": min_z,
        "max_z": max_z,
        "width_m": max_x - min_x,
        "depth_m": max_z - min_z,
    }


def normalize_master_plan(raw, *, blocking=None, allow_outside_stage=False, minimum_reliable_confidence=0.6):
    if not isinstance(raw, dict):
        raise ValueError("master_plan은 객체여야 합니다.")
    elements_raw = raw.get("elements") or []
    if not isinstance(elements_raw, list) or not elements_raw:
        raise ValueError("master_plan.elements는 하나 이상 필요합니다.")
    if len(elements_raw) > 180:
        raise ValueError("master_plan.elements는 180개까지 지원합니다.")

    collections_raw = raw.get("collections") or []
    if not isinstance(collections_raw, list) or len(collections_raw) > 32:
        raise ValueError("master_plan.collections는 배열이며 32개까지 지원합니다.")
    collections = [_normalize_collection(entry, index) for index, entry in enumerate(collections_raw)]
    if not collections:
        collections = [{
            "id": "main-set",
            "name": "Main Set",
            "parent_id": "",
            "locked": False,
            "allow_partial_unlock": True,
        }]
    collection_ids = [entry["id"] for entry in collections]
    if len(collection_ids) != len(set(collection_ids)):
        raise ValueError("master_plan.collections id가 중복되었습니다.")
    collection_id_set = set(collection_ids)
    for collection in collections:
        if collection["parent_id"] and collection["parent_id"] not in collection_id_set:
            raise ValueError(f"collection '{collection['id']}' parent_id가 존재하지 않습니다.")

    elements = [_normalize_element(entry, index, collection_id_set) for index, entry in enumerate(elements_raw)]
    element_ids = [entry["id"] for entry in elements]
    if len(element_ids) != len(set(element_ids)):
        raise ValueError("master_plan.elements id가 중복되었습니다.")
    element_id_set = set(element_ids)
    for element in elements:
        if element["parent_id"] and element["parent_id"] not in element_id_set:
            raise ValueError(f"element '{element['id']}' parent_id가 존재하지 않습니다.")

    issues = []
    threshold = min(1.0, max(0.0, _finite(minimum_reliable_confidence, "minimum_reliable_confidence")))
    included = [entry for entry in elements if entry["include_in_scene"]]
    structural = [entry for entry in included if entry["role"] in {"structure", "surface"}]
    if not structural:
        issues.append({"code": "missing-structure", "severity": "review", "message": "2D 마스터에 구조물/바닥이 없습니다."})
    reliable = [
        entry for entry in included
        if entry["confidence"] >= threshold and entry["basis"] in {"observed", "user_fixed"}
    ]
    if not reliable:
        issues.append({
            "code": "missing-reliable-observation",
            "severity": "review",
            "message": "observed/user_fixed 요소 중 신뢰도 기준을 넘는 실측 기준이 없습니다.",
        })

    plan_bounds = _plan_bounds(included)
    stage = None
    if blocking is not None:
        stage_width, stage_depth = space.stage_dimensions(blocking.get("aspect", "16:9"))
        stage = {"width_m": stage_width, "depth_m": stage_depth}
        half_w, half_d = stage_width / 2, stage_depth / 2
        outside = []
        for element in included:
            bounds = _element_bounds(element)
            if (
                bounds["min_x"] < -half_w or bounds["max_x"] > half_w
                or bounds["min_z"] < -half_d or bounds["max_z"] > half_d
            ):
                outside.append({"id": element["id"], "bounds": bounds})
        if outside:
            issues.append({
                "code": "elements-outside-stage",
                "severity": "review",
                "count": len(outside),
                "elements": outside[:20],
            })

    declared_width = raw.get("declared_width_m")
    declared_depth = raw.get("declared_depth_m")
    if declared_width is not None:
        declared_width = _positive(declared_width, "master_plan.declared_width_m")
        if plan_bounds["width_m"] > declared_width * 1.08:
            issues.append({
                "code": "declared-width-smaller-than-content",
                "severity": "review",
                "declared_width_m": declared_width,
                "content_width_m": plan_bounds["width_m"],
            })
    if declared_depth is not None:
        declared_depth = _positive(declared_depth, "master_plan.declared_depth_m")
        if plan_bounds["depth_m"] > declared_depth * 1.08:
            issues.append({
                "code": "declared-depth-smaller-than-content",
                "severity": "review",
                "declared_depth_m": declared_depth,
                "content_depth_m": plan_bounds["depth_m"],
            })

    collection_summary = []
    for collection in collections:
        members = [element["id"] for element in elements if element["collection_id"] == collection["id"]]
        collection_summary.append({**collection, "member_ids": members})

    return {
        "schema": "frisframe-set-master-plan",
        "version": 1,
        "status": "ready" if not issues else "review",
        "source_name": str(raw.get("source_name") or "Reference Set")[:160],
        "unit": "meter",
        "declared_width_m": declared_width,
        "declared_depth_m": declared_depth,
        "origin_note": str(raw.get("origin_note") or "")[:300],
        "elements": elements,
        "collections": collection_summary,
        "bounds": plan_bounds,
        "stage": stage,
        "issues": issues,
        "summary": {
            "element_count": len(elements),
            "included_count": len(included),
            "structure_count": len(structural),
            "reliable_observation_count": len(reliable),
            "collection_count": len(collections),
            "kind_counts": {
                kind: sum(1 for entry in elements if entry["kind"] == kind)
                for kind in sorted({entry["kind"] for entry in elements})
            },
        },
        "notes": str(raw.get("notes") or "")[:1000],
        "workflow_policy": "2d-master-first-single-source-of-truth",
    }


def reconstruction_contract():
    return {
        "schema": "frisframe-set-reconstruction-contract",
        "version": 1,
        "ai_boundary": {
            "image_interpretation_owner": "external-vision-mcp-client",
            "frisframe_calls_ai_api": False,
        },
        "priority": [
            "spatial_relationships",
            "metric_scale",
            "2d_master_plan",
            "camera",
            "major_geometry",
            "decorative_detail",
        ],
        "required_workflow": [
            "1. Interpret the reference image and mark observations as observed/inferred/user_fixed.",
            "2. Resolve a top-down metric master plan first. Do not jump straight to decorative 3D.",
            "3. Validate wall lengths, room/zone footprints, furniture clearances, and stage bounds.",
            "4. Apply the master plan. FrisFrame uses the same items and referenceDimensionsM in 2D and 3D.",
            "5. Review the 2D overview and only then refine 3D/camera details.",
            "6. Lock the finished set collection; unlock only the pieces that need correction.",
        ],
        "element_rules": {
            "walls_and_railings": "Prefer start_x_m/start_z_m/end_x_m/end_z_m + thickness_m.",
            "rectangular_objects": "Use world_x_m/world_z_m + width_m/depth_m + height_m.",
            "scale": "All geometry is meters. Use realistic architectural/furniture dimensions.",
            "provenance": "Every important element should state basis and confidence.",
            "hidden_geometry": "Mark unseen but necessary geometry inferred, never observed.",
        },
        "supported_kinds": sorted(KIND_VALUES),
        "locking": {
            "semantic_collections": True,
            "full_lock": True,
            "partial_unlock": True,
            "implementation": "item.editLocked + persisted setCollections metadata",
        },
    }


def _compile_operations(normalized, blocking, replace_existing_set):
    stage_width, stage_depth = space.stage_dimensions(blocking.get("aspect", "16:9"))
    half_w, half_d = stage_width / 2, stage_depth / 2
    current_ids = {str(item.get("id")) for item in blocking.get("items", [])}
    previous_plan = blocking.get("setMasterPlan") if isinstance(blocking.get("setMasterPlan"), dict) else {}
    previous_ids = {
        str(item_id) for item_id in previous_plan.get("generatedItemIds", [])
        if item_id
    }

    operations = []
    if replace_existing_set:
        next_ids = {entry["id"] for entry in normalized["elements"] if entry["include_in_scene"]}
        for item_id in sorted(previous_ids - next_ids):
            if item_id in current_ids:
                operations.append({"op": "remove_dummy", "id": item_id})

    anchors = []
    applied_elements = []
    for element in normalized["elements"]:
        if not element["include_in_scene"]:
            continue
        bounds = _element_bounds(element)
        outside = (
            bounds["min_x"] < -half_w or bounds["max_x"] > half_w
            or bounds["min_z"] < -half_d or bounds["max_z"] > half_d
        )
        x = 0.5 + element["world_x_m"] / stage_width
        y = 0.5 + element["world_z_m"] / stage_depth
        if outside or not (core.STAGE_COORD_MIN <= x <= core.STAGE_COORD_MAX and core.STAGE_COORD_MIN <= y <= core.STAGE_COORD_MAX):
            raise ValueError(
                f"set-element-outside-stage: '{element['id']}'가 현재 {stage_width:.2f}m × {stage_depth:.2f}m 무대 밖입니다."
            )
        if element["id"] in current_ids and element["id"] not in previous_ids:
            existing = next((item for item in blocking.get("items", []) if str(item.get("id")) == element["id"]), None)
            if existing and existing.get("type") != "prop":
                raise ValueError(f"set element id '{element['id']}'가 기존 배우 ID와 충돌합니다.")

        operation = {
            "op": "update_dummy" if element["id"] in current_ids else "add_dummy",
            "id": element["id"],
            "type": "prop",
            "name": element["name"],
            "asset_type": element["asset_type"],
            "world_x_m": element["world_x_m"],
            "world_z_m": element["world_z_m"],
            "facing": element["rotation_deg"],
            "mounted_height": element["mounted_height_m"],
            "color": element["color"],
            "visible": element["visible"],
            "anchor_id": element["id"],
            "physical_dimensions_m": {
                "width": element["width_m"],
                "height": element["height_m"],
                "depth": element["depth_m"],
            },
        }
        operations.append(operation)
        anchors.append({
            "id": element["id"],
            "label": element["name"],
            "kind": f"set-{element['kind']}",
            "world_x_m": element["world_x_m"],
            "world_z_m": element["world_z_m"],
            "physical_dimensions_m": {
                "width": element["width_m"],
                "height": element["height_m"],
                "depth": element["depth_m"],
            },
            "confidence": element["confidence"],
            "attached_item_id": element["id"],
        })
        applied_elements.append(element)

    if len(operations) > 200:
        raise ValueError("set master plan 적용 명령이 200개를 초과했습니다.")
    return operations, anchors, applied_elements


def _persist_plan(blocking, normalized, applied_elements, lock_after_apply):
    item_map = {str(item.get("id")): item for item in blocking.get("items", [])}
    persisted_collections = []
    for collection in normalized["collections"]:
        member_ids = [
            entry["id"] for entry in applied_elements
            if entry["collection_id"] == collection["id"]
        ]
        collection_locked = bool(lock_after_apply or collection["locked"])
        unlocked_member_ids = []
        for element in applied_elements:
            if element["collection_id"] != collection["id"]:
                continue
            item = item_map.get(element["id"])
            if not item:
                continue
            explicit = element["locked"]
            locked = collection_locked if explicit is None else explicit
            item["editLocked"] = bool(locked)
            item["motionEnabled"] = bool(element["motion_enabled"])
            if not locked:
                unlocked_member_ids.append(element["id"])
        persisted_collections.append({
            "id": collection["id"],
            "name": collection["name"],
            "parentId": collection["parent_id"],
            "memberIds": member_ids,
            "locked": collection_locked,
            "allowPartialUnlock": collection["allow_partial_unlock"],
            "unlockedMemberIds": unlocked_member_ids,
        })

    blocking["setCollections"] = persisted_collections
    blocking["setMasterPlan"] = {
        "schema": normalized["schema"],
        "version": normalized["version"],
        "sourceName": normalized["source_name"],
        "unit": "meter",
        "workflowPolicy": normalized["workflow_policy"],
        "declaredWidthM": normalized["declared_width_m"],
        "declaredDepthM": normalized["declared_depth_m"],
        "bounds": normalized["bounds"],
        "generatedItemIds": [entry["id"] for entry in applied_elements],
        "elements": [
            {
                "id": entry["id"],
                "name": entry["name"],
                "kind": entry["kind"],
                "role": entry["role"],
                "basis": entry["basis"],
                "confidence": entry["confidence"],
                "collectionId": entry["collection_id"],
                "parentId": entry["parent_id"],
                "worldXM": entry["world_x_m"],
                "worldZM": entry["world_z_m"],
                "widthM": entry["width_m"],
                "heightM": entry["height_m"],
                "depthM": entry["depth_m"],
                "rotationDeg": entry["rotation_deg"],
                "mountedHeightM": entry["mounted_height_m"],
                "assetType": entry["asset_type"],
                "line": entry["line"],
                "notes": entry["notes"],
            }
            for entry in normalized["elements"]
        ],
        "notes": normalized["notes"],
    }
    return persisted_collections


def _apply_master_plan(args):
    project_id = args.get("project_id")
    revision = int(args["revision"])
    scene_index = int(args.get("scene_index", 0))
    cut_index = int(args.get("cut_index", 0))
    blocking = base._load_blocking(project_id, scene_index, cut_index)
    normalized = normalize_master_plan(
        args.get("master_plan"),
        blocking=blocking,
        allow_outside_stage=bool(args.get("allow_outside_stage", False)),
        minimum_reliable_confidence=args.get("minimum_reliable_confidence", 0.6),
    )
    if bool(args.get("require_ready", True)) and normalized["status"] != "ready":
        codes = ", ".join(issue["code"] for issue in normalized["issues"][:8])
        raise ValueError(f"set-master-plan-review-required: {codes}")

    replace_existing = bool(args.get("replace_existing_set", True))
    operations, anchors, applied_elements = _compile_operations(normalized, blocking, replace_existing)
    spatial_guide = reference._merge_guide(blocking, normalized["source_name"], anchors)

    def apply_atomic(project_obj):
        payload = base._target_args(args, revision)
        payload["operations"] = operations
        payload["spatial_guide"] = spatial_guide
        stage_result = base._json_result(core.handle_apply_scene_commands(project_id, payload))
        stage_detail = base._json_result(stage_result.get("message", ""))
        if not isinstance(stage_detail, dict):
            raise ValueError("set master plan 적용 결과를 읽지 못했습니다.")
        current_blocking = _blocking_from_project(project_obj, scene_index, cut_index)
        collections = _persist_plan(
            current_blocking,
            normalized,
            applied_elements,
            bool(args.get("lock_after_apply", False)),
        )
        return {"stage": stage_detail, "collections": collections}

    committed = base._json_result(core.mutate_project_atomic(project_id, revision, apply_atomic))
    detail = committed.get("message")
    if not isinstance(detail, dict):
        detail = base._json_result(detail)
    return {
        "project_id": project_id,
        "revision": committed["revision"],
        "updated_at": committed.get("updated_at"),
        "set_master_plan": {
            "status": normalized["status"],
            "summary": normalized["summary"],
            "issues": normalized["issues"],
            "bounds": normalized["bounds"],
            "generated_item_ids": [entry["id"] for entry in applied_elements],
            "collection_ids": [entry["id"] for entry in normalized["collections"]],
            "operation_count": len(operations),
            "atomic_revision": True,
            "2d_3d_policy": "same-items-same-referenceDimensionsM",
        },
        "stage": detail.get("stage") if isinstance(detail, dict) else detail,
        "collections": detail.get("collections") if isinstance(detail, dict) else None,
    }


def _set_collection_lock(args):
    project_id = args.get("project_id")
    revision = int(args["revision"])
    scene_index = int(args.get("scene_index", 0))
    cut_index = int(args.get("cut_index", 0))
    collection_id = _identifier(args.get("collection_id"), "collection_id")
    mode = str(args.get("mode") or "")
    if mode not in {"lock_all", "unlock_all", "lock_members", "unlock_members"}:
        raise ValueError("mode가 올바르지 않습니다.")
    requested_ids = [str(value) for value in (args.get("item_ids") or [])]
    if mode.endswith("_members") and not requested_ids:
        raise ValueError(f"{mode}에는 item_ids가 하나 이상 필요합니다.")

    def mutation(project_obj):
        blocking = _blocking_from_project(project_obj, scene_index, cut_index)
        collections = blocking.get("setCollections")
        if not isinstance(collections, list):
            raise ValueError("이 컷에는 setCollections가 없습니다. apply_set_master_plan을 먼저 실행하세요.")
        collection = next((entry for entry in collections if str(entry.get("id")) == collection_id), None)
        if not collection:
            raise ValueError(f"set collection을 찾을 수 없습니다: {collection_id}")
        member_ids = [str(value) for value in collection.get("memberIds", [])]
        member_set = set(member_ids)
        item_map = {str(item.get("id")): item for item in blocking.get("items", [])}
        invalid = [item_id for item_id in requested_ids if item_id not in member_set]
        if invalid:
            raise ValueError(f"collection member가 아닌 item_id가 있습니다: {', '.join(invalid[:8])}")

        if mode == "lock_all":
            targets = member_ids
            locked = True
            collection["locked"] = True
            collection["unlockedMemberIds"] = []
        elif mode == "unlock_all":
            targets = member_ids
            locked = False
            collection["locked"] = False
            collection["unlockedMemberIds"] = list(member_ids)
        elif mode == "lock_members":
            targets = requested_ids
            locked = True
            unlocked = set(str(value) for value in collection.get("unlockedMemberIds", []))
            unlocked.difference_update(targets)
            collection["unlockedMemberIds"] = sorted(unlocked)
        else:
            if not bool(collection.get("allowPartialUnlock", True)):
                raise ValueError("이 collection은 partial unlock을 허용하지 않습니다.")
            targets = requested_ids
            locked = False
            unlocked = set(str(value) for value in collection.get("unlockedMemberIds", []))
            unlocked.update(targets)
            collection["unlockedMemberIds"] = sorted(unlocked)

        changed = []
        for item_id in targets:
            item = item_map.get(item_id)
            if not item:
                continue
            item["editLocked"] = locked
            changed.append(item_id)
        return {
            "collection_id": collection_id,
            "mode": mode,
            "changed_item_ids": changed,
            "locked": collection.get("locked", False),
            "unlocked_member_ids": collection.get("unlockedMemberIds", []),
        }

    return base._json_result(core.mutate_project(project_id, revision, mutation))


_PREVIOUS_CALL_TOOL = base.call_tool


def call_tool(name, args):
    if name == "get_set_reconstruction_contract":
        return json.dumps(reconstruction_contract(), ensure_ascii=False)
    if name == "validate_set_master_plan":
        blocking = None
        if args.get("project_id"):
            blocking = base._load_blocking(
                args.get("project_id"),
                int(args.get("scene_index", 0)),
                int(args.get("cut_index", 0)),
            )
        return json.dumps(normalize_master_plan(
            args.get("master_plan"),
            blocking=blocking,
            allow_outside_stage=bool(args.get("allow_outside_stage", False)),
            minimum_reliable_confidence=args.get("minimum_reliable_confidence", 0.6),
        ), ensure_ascii=False)
    if name == "apply_set_master_plan":
        return json.dumps(_apply_master_plan(args), ensure_ascii=False)
    if name == "set_set_collection_lock":
        return json.dumps(_set_collection_lock(args), ensure_ascii=False)
    return _PREVIOUS_CALL_TOOL(name, args)


def install():
    if getattr(base, "_set_reconstruction_extension_installed", False):
        return
    existing = {tool.get("name") for tool in base.TOOLS}
    for tool in (CONTRACT_TOOL, VALIDATE_TOOL, APPLY_TOOL, LOCK_TOOL):
        if tool["name"] not in existing:
            base.TOOLS.append(tool)
    base.call_tool = call_tool
    base._set_reconstruction_extension_installed = True


install()
