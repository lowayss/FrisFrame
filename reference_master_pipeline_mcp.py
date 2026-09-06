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


PIPELINE_POLICY = "reference-image-to-master-set-single-source-of-truth"
SET_ROLES = set(set_reconstruction.ROLE_VALUES)
BASE_ROLES = set(interpretation.ROLE_VALUES)

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
    })
    schema["properties"].update({
        "declared_width_m": {"type": "number", "exclusiveMinimum": 0},
        "declared_depth_m": {"type": "number", "exclusiveMinimum": 0},
    })
    return schema


REFERENCE_MASTER_INTERPRETATION_SCHEMA = _extended_interpretation_schema()

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
    prepared["role"] = BASE_ROLE_BY_SET_ROLE.get(requested_role, requested_role if requested_role in BASE_ROLES else "prop")

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
    objects = raw.get("objects") or []
    if not isinstance(objects, list) or not objects:
        raise ValueError("interpretation.objects는 하나 이상 필요합니다.")
    prepared["objects"] = [_prepare_object(entry, index) for index, entry in enumerate(objects)]
    return prepared


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
    prepared = _prepare_interpretation(raw)
    normalized_interpretation = interpretation.normalize_interpretation(
        prepared,
        relation_tolerance_m=args.get("relation_tolerance_m", 0.75),
        parallel_tolerance_deg=args.get("parallel_tolerance_deg", 12.0),
    )
    raw_master_plan = _compile_raw_master_plan(raw, normalized_interpretation)
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


def _reference_evidence(normalized_interpretation):
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
    }


def pipeline_contract():
    return {
        "schema": "frisframe-reference-master-set-contract",
        "version": 1,
        "product_definition": (
            "A reference image is spatial evidence. FrisFrame reconstructs a shootable Master Set, "
            "not a pixel-identical 3D copy."
        ),
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
        "source_of_truth": {
            "data": "blocking.setMasterPlan + shared blocking items",
            "views": ["2D", "2.5D", "3D"],
            "policy": "same-items-same-referenceDimensionsM",
        },
        "interpretation_rules": {
            "linear_architecture": "Prefer kind + start_x_m/start_z_m/end_x_m/end_z_m + thickness_m for walls/partitions/railings.",
            "rectangular_elements": "Use world_x_m/world_z_m + width_m/depth_m; height can use kind defaults when omitted.",
            "provenance": "Every important object should be observed, inferred, or user_fixed with confidence.",
            "scale": "Use one or more plausible visible scale anchors; user-fixed dimensions outrank guesses.",
            "camera": "Camera observation may be recorded during image interpretation but is not applied while building the Master Set.",
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
    _, normalized_interpretation, _, normalized_master_plan = _normalize_pipeline(args, blocking=blocking)
    return {
        "schema": "frisframe-reference-master-set-compile",
        "version": 1,
        "status": "ready" if normalized_interpretation["status"] == "ready" and normalized_master_plan["status"] == "ready" else "review",
        "pipeline_policy": PIPELINE_POLICY,
        "reference_interpretation": {
            "status": normalized_interpretation["status"],
            "summary": normalized_interpretation["summary"],
            "issues": normalized_interpretation["issues"],
            "relation_checks": normalized_interpretation["relation_checks"],
        },
        "master_plan": normalized_master_plan,
        "camera_policy": "observation-retained-not-applied-during-master-set",
    }


def _apply(args):
    project_id = args.get("project_id")
    revision = int(args["revision"])
    scene_index = int(args.get("scene_index", 0))
    cut_index = int(args.get("cut_index", 0))
    blocking = base._load_blocking(project_id, scene_index, cut_index)
    _, normalized_interpretation, _, normalized_master_plan = _normalize_pipeline(args, blocking=blocking)

    if bool(args.get("require_interpretation_ready", True)) and normalized_interpretation["status"] != "ready":
        codes = ", ".join(issue["code"] for issue in normalized_interpretation["issues"][:8])
        raise ValueError(f"reference-interpretation-review-required: {codes}")
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
    evidence = _reference_evidence(normalized_interpretation)

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
            "status": "ready",
            "pipeline_policy": PIPELINE_POLICY,
            "reference_status": normalized_interpretation["status"],
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
            "next_step": "Review the auto-opened 2.5D Master Set, correct dimensions/layout, then block actors and calibrate/place camera.",
        },
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
