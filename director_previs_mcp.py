#!/usr/bin/env python3
"""Director-facing previs orchestration for FrisFrame.

Codex/MCP decides scene meaning, blocking intent, lens choice, framing, and paths.
FrisFrame deterministically executes those explicit commands against one
Authoritative Master Set + actor blocking + camera/shot state and commits the
whole plan in exactly one revision or not at all.
"""

from __future__ import annotations

import copy
import json
import math

import mcp_previs_server as base
import mcp_server as core
import reference_space_core as space
import reference_space_mcp as reference
import set_reconstruction_mcp as sets
import spatial_command_mcp as spatial


POLICY = "director-previs-command-engine-v1"
MAX_ACTOR_COMMANDS = 64
MAX_PATH_POINTS = 96
MAX_MOTION_OPERATIONS = 200
SHOT_STATUS = {"draft", "planned", "ready", "approved"}
ACTOR_OPS = {"create", "update", "delete"}


ACTOR_FIELDS = {
    "id": {"type": "string"},
    "name": {"type": "string"},
    "dummy_type": {"type": "string", "enum": sorted(core.MCP_DUMMY_TYPES)},
    "color": {"type": "string", "pattern": "^#[0-9A-Fa-f]{6}$"},
    "world_x_m": {"type": "number"},
    "world_z_m": {"type": "number"},
    "facing_deg": {"type": "number"},
    "vertical_offset_m": {"type": "number"},
    "size": {"type": "number", "minimum": 0.25, "maximum": 4},
    "scale_x": {"type": "number", "minimum": 0.25, "maximum": 3.5},
    "scale_y": {"type": "number", "minimum": 0.25, "maximum": 3.5},
    "scale_z": {"type": "number", "minimum": 0.25, "maximum": 3.5},
    "visible": {"type": "boolean"},
    "pose_preset": {"type": "string", "enum": sorted(core.MCP_POSE_PRESETS)},
    "body_pose": {"type": "object"},
}

ACTOR_SCHEMA = {"type": "object", "properties": ACTOR_FIELDS, "required": ["id"]}
ACTOR_COMMAND_SCHEMA = {
    "type": "object",
    "properties": {
        "op": {"type": "string", "enum": sorted(ACTOR_OPS)},
        "id": {"type": "string"},
        "actor": ACTOR_SCHEMA,
        "changes": {"type": "object", "properties": ACTOR_FIELDS},
    },
    "required": ["op"],
}

PATH_POINT_SCHEMA = {
    "type": "object",
    "properties": {
        "time_sec": {"type": "number", "minimum": 0, "maximum": core.MAX_TIMELINE_DURATION},
        "world_x_m": {"type": "number"},
        "world_z_m": {"type": "number"},
        "facing_deg": {"type": "number"},
        "pose_preset": {"type": "string", "enum": sorted(core.MCP_POSE_PRESETS)},
        "body_pose": {"type": "object"},
        "transition": {"type": "string", "enum": sorted(core.MCP_TRANSITIONS)},
        "path_mode": {"type": "string", "enum": sorted(core.MCP_PATH_MODES)},
    },
    "required": ["time_sec", "world_x_m", "world_z_m"],
}

ACTOR_PATH_SCHEMA = {
    "type": "object",
    "properties": {
        "actor_id": {"type": "string"},
        "replace_existing": {"type": "boolean"},
        "transition": {"type": "string", "enum": sorted(core.MCP_TRANSITIONS)},
        "path_mode": {"type": "string", "enum": sorted(core.MCP_PATH_MODES)},
        "points": {"type": "array", "minItems": 1, "maxItems": MAX_PATH_POINTS, "items": PATH_POINT_SCHEMA},
    },
    "required": ["actor_id", "points"],
}

CAMERA_FIELDS = {
    "world_x_m": {"type": "number"},
    "world_z_m": {"type": "number"},
    "height_m": {"type": "number", "minimum": core.CAMERA_HEIGHT_MIN, "maximum": core.CAMERA_HEIGHT_MAX},
    "pan_deg": {"type": "number"},
    "tilt_deg": {"type": "number", "minimum": core.CAMERA_TILT_MIN, "maximum": core.CAMERA_TILT_MAX},
    "focal_mm": {"type": "integer", "minimum": core.CAMERA_FOCAL_MIN, "maximum": core.CAMERA_FOCAL_MAX},
    "focus_distance_m": {"type": "number", "exclusiveMinimum": 0},
    "tracking_target_id": {"type": "string"},
    "locks": {
        "type": "object",
        "properties": {
            "position": {"type": "boolean"},
            "orientation": {"type": "boolean"},
            "lens": {"type": "boolean"},
            "height": {"type": "boolean"},
        },
    },
}
CAMERA_SCHEMA = {"type": "object", "properties": CAMERA_FIELDS}

CAMERA_PATH_POINT_SCHEMA = {
    "type": "object",
    "properties": {
        "time_sec": {"type": "number", "minimum": 0, "maximum": core.MAX_TIMELINE_DURATION},
        **CAMERA_FIELDS,
        "transition": {"type": "string", "enum": sorted(core.MCP_TRANSITIONS)},
        "path_mode": {"type": "string", "enum": sorted(core.MCP_PATH_MODES)},
    },
    "required": ["time_sec", "world_x_m", "world_z_m"],
}
CAMERA_PATH_SCHEMA = {
    "type": "object",
    "properties": {
        "replace_existing": {"type": "boolean"},
        "transition": {"type": "string", "enum": sorted(core.MCP_TRANSITIONS)},
        "path_mode": {"type": "string", "enum": sorted(core.MCP_PATH_MODES)},
        "points": {"type": "array", "minItems": 1, "maxItems": MAX_PATH_POINTS, "items": CAMERA_PATH_POINT_SCHEMA},
    },
    "required": ["points"],
}

SHOT_SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": "string"},
        "shot_type": {"type": "string"},
        "camera_note": {"type": "string"},
        "intent": {"type": "string"},
        "notes": {"type": "string"},
        "status": {"type": "string", "enum": sorted(SHOT_STATUS)},
        "target_ids": {"type": "array", "maxItems": 32, "items": {"type": "string"}},
        "framing": {"type": "object"},
    },
}

TIMELINE_SCHEMA = {
    "type": "object",
    "properties": {
        "duration_sec": {"type": "number", "minimum": 1, "maximum": core.MAX_TIMELINE_DURATION},
        "export_start_sec": {"type": "number", "minimum": 0, "maximum": core.MAX_TIMELINE_DURATION},
        "export_end_sec": {"type": "number", "minimum": 0, "maximum": core.MAX_TIMELINE_DURATION},
    },
}

SET_SCHEMA = {
    "type": "object",
    "properties": {
        "mode": {"type": "string", "enum": ["patch", "replace"]},
        "source_name": {"type": "string"},
        "operations": {"type": "array", "minItems": 1, "maxItems": spatial.MAX_COMMANDS, "items": spatial.OPERATION_SCHEMA},
        "collections": {"type": "array", "maxItems": 32, "items": sets.COLLECTION_SCHEMA},
        "allow_outside_stage": {"type": "boolean"},
        "lock_after_apply": {"type": "boolean"},
    },
    "required": ["operations"],
}

PLAN_PROPERTIES = {
    **base.COMMON_TARGET_PROPERTIES,
    "transaction_id": {"type": "string"},
    "set": SET_SCHEMA,
    "actors": {"type": "array", "maxItems": MAX_ACTOR_COMMANDS, "items": ACTOR_COMMAND_SCHEMA},
    "actor_paths": {"type": "array", "maxItems": MAX_ACTOR_COMMANDS, "items": ACTOR_PATH_SCHEMA},
    "camera": CAMERA_SCHEMA,
    "camera_path": CAMERA_PATH_SCHEMA,
    "shot": SHOT_SCHEMA,
    "timeline": TIMELINE_SCHEMA,
}

CONTRACT_TOOL = {
    "name": "get_director_previs_contract",
    "description": "MCP가 해석/연출한 세트, 배우 블로킹, 카메라/렌즈, 샷, 동선을 FrisFrame이 한 번에 구현하는 최종 프리비즈 계약을 반환합니다.",
    "inputSchema": {"type": "object", "properties": {}},
}
VALIDATE_TOOL = {
    "name": "validate_director_previs_plan",
    "description": "세트 + 배우 + 카메라 + 샷 + 타임라인 계획을 mutation 없이 전체 검증합니다.",
    "inputSchema": {
        "type": "object",
        "properties": {key: value for key, value in PLAN_PROPERTIES.items() if key != "revision"},
        "required": ["project_id"],
    },
}
APPLY_TOOL = {
    "name": "apply_director_previs_plan",
    "description": "검증된 전체 프리비즈 계획을 단 하나의 atomic revision으로 적용합니다. 어느 단계든 실패하면 전체 rollback합니다.",
    "inputSchema": {"type": "object", "properties": PLAN_PROPERTIES, "required": ["project_id", "revision"]},
}
SNAPSHOT_TOOL = {
    "name": "get_director_previs_snapshot",
    "description": "현재 Master Set, 배우, 카메라/렌즈, 샷 설계, 타임라인을 한 번에 읽어 MCP가 구현 결과를 재검증하게 합니다.",
    "inputSchema": {
        "type": "object",
        "properties": {
            "project_id": {"type": "string"},
            "scene_index": {"type": "integer", "minimum": 0},
            "cut_index": {"type": "integer", "minimum": 0},
        },
        "required": ["project_id"],
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


def _identifier(value, label):
    candidate = str(value or "").strip()
    if not sets.ID_RE.fullmatch(candidate):
        raise ValueError(f"{label}는 영문/숫자/_/- 64자 이하여야 합니다.")
    return candidate


def _cut_from_project(project_obj, scene_index, cut_index):
    scenes = project_obj.get("scenes") or []
    if not 0 <= scene_index < len(scenes):
        raise ValueError(f"scene_index 범위를 벗어났습니다: {scene_index}")
    cuts = scenes[scene_index].get("cuts") or []
    if not 0 <= cut_index < len(cuts):
        raise ValueError(f"cut_index 범위를 벗어났습니다: {cut_index}")
    cut = cuts[cut_index]
    blocking = cut.get("blocking")
    if not isinstance(blocking, dict):
        raise ValueError("선택한 컷에 blocking 데이터가 없습니다.")
    return cut, blocking


def _stage_xy(blocking, world_x_m, world_z_m, label):
    wx = _finite(world_x_m, f"{label}.world_x_m")
    wz = _finite(world_z_m, f"{label}.world_z_m")
    width, depth = space.stage_dimensions(blocking.get("aspect", "16:9"))
    x = 0.5 + wx / width
    y = 0.5 + wz / depth
    if not (core.STAGE_COORD_MIN <= x <= core.STAGE_COORD_MAX and core.STAGE_COORD_MIN <= y <= core.STAGE_COORD_MAX):
        raise ValueError(f"{label} 위치가 현재 {width:.2f}m × {depth:.2f}m 무대 범위를 벗어났습니다.")
    return x, y


def _set_ids(blocking):
    plan = blocking.get("setMasterPlan") if isinstance(blocking.get("setMasterPlan"), dict) else {}
    return {str(value) for value in plan.get("generatedItemIds") or []}


def _actor_map(blocking):
    return {
        str(item.get("id")): copy.deepcopy(item)
        for item in blocking.get("items", [])
        if item.get("id") and item.get("type") == "actor"
    }


def _validate_actor_payload(raw, label, *, require_position=False):
    if not isinstance(raw, dict):
        raise ValueError(f"{label}가 객체가 아닙니다.")
    actor_id = _identifier(raw.get("id"), f"{label}.id")
    result = {"id": actor_id}
    if require_position and (raw.get("world_x_m") is None or raw.get("world_z_m") is None):
        raise ValueError(f"{label}에는 world_x_m/world_z_m가 필요합니다.")
    if "name" in raw:
        result["name"] = str(raw.get("name") or actor_id).strip()[:80] or actor_id
    if "dummy_type" in raw:
        dummy = str(raw.get("dummy_type") or "human")
        if dummy not in core.MCP_DUMMY_TYPES:
            raise ValueError(f"{label}.dummy_type이 올바르지 않습니다: {dummy}")
        result["dummy_type"] = dummy
    if "color" in raw:
        color = str(raw.get("color") or "")
        if not core.HEX_COLOR.fullmatch(color):
            raise ValueError(f"{label}.color는 #RRGGBB 형식이어야 합니다.")
        result["color"] = color
    for key in ("world_x_m", "world_z_m"):
        if key in raw:
            result[key] = _finite(raw[key], f"{label}.{key}")
    if "facing_deg" in raw:
        result["facing_deg"] = _finite(raw["facing_deg"], f"{label}.facing_deg") % 360
    if "vertical_offset_m" in raw:
        result["vertical_offset_m"] = core.clamp_number(raw["vertical_offset_m"], -1, 5, f"{label}.vertical_offset_m")
    for key, low, high in (("size", 0.25, 4), ("scale_x", 0.25, 3.5), ("scale_y", 0.25, 3.5), ("scale_z", 0.25, 3.5)):
        if key in raw:
            result[key] = core.clamp_number(raw[key], low, high, f"{label}.{key}")
    if "visible" in raw:
        result["visible"] = bool(raw["visible"])
    if "pose_preset" in raw:
        preset = str(raw.get("pose_preset") or "")
        if preset not in core.MCP_POSE_PRESETS:
            raise ValueError(f"지원하지 않는 배우 포즈 프리셋입니다: {preset}")
        result["pose_preset"] = preset
    if "body_pose" in raw:
        result["body_pose"] = core._sanitize_motion_body_pose(raw.get("body_pose"))
    return result


def _actor_stage_operation(op, actor, blocking):
    command = {"op": "add_dummy" if op == "create" else "update_dummy", "id": actor["id"], "type": "actor"}
    aliases = {
        "name": "name", "dummy_type": "dummy_type", "color": "color", "size": "size",
        "scale_x": "scale_x", "scale_y": "scale_y", "scale_z": "scale_z", "visible": "visible",
        "vertical_offset_m": "vertical_offset", "facing_deg": "facing",
        "world_x_m": "world_x_m", "world_z_m": "world_z_m",
    }
    for source, target in aliases.items():
        if source in actor:
            command[target] = actor[source]
    if "world_x_m" in actor and "world_z_m" in actor:
        _stage_xy(blocking, actor["world_x_m"], actor["world_z_m"], f"actor '{actor['id']}'")
    return command


def _prepare_actor_commands(raw_commands, blocking, candidate_set_ids):
    commands = raw_commands or []
    if not isinstance(commands, list) or len(commands) > MAX_ACTOR_COMMANDS:
        raise ValueError(f"actors는 배열이며 {MAX_ACTOR_COMMANDS}개까지 지원합니다.")
    actors = _actor_map(blocking)
    occupied_nonactors = {
        str(item.get("id")) for item in blocking.get("items", [])
        if item.get("id") and item.get("type") != "actor"
    }
    occupied_nonactors |= set(candidate_set_ids)
    stage_operations = []
    deleted = []
    initial_pose = {}
    created = []
    updated = []

    for index, raw in enumerate(commands):
        if not isinstance(raw, dict):
            raise ValueError(f"actors[{index}]가 객체가 아닙니다.")
        op = str(raw.get("op") or "").lower()
        if op not in ACTOR_OPS:
            raise ValueError(f"actors[{index}].op가 올바르지 않습니다.")
        if op == "create":
            actor = _validate_actor_payload(raw.get("actor"), f"actors[{index}].actor", require_position=True)
            actor_id = actor["id"]
            if actor_id in actors or actor_id in occupied_nonactors:
                raise ValueError(f"actor create ID가 이미 존재합니다: {actor_id}")
            stage_operations.append(_actor_stage_operation("create", actor, blocking))
            actors[actor_id] = {
                "id": actor_id, "type": "actor", "name": actor.get("name", actor_id),
                "x": _stage_xy(blocking, actor["world_x_m"], actor["world_z_m"], f"actor '{actor_id}'")[0],
                "y": _stage_xy(blocking, actor["world_x_m"], actor["world_z_m"], f"actor '{actor_id}'")[1],
            }
            if actor.get("pose_preset") or actor.get("body_pose"):
                initial_pose[actor_id] = {key: actor[key] for key in ("pose_preset", "body_pose") if key in actor}
            created.append(actor_id)
        elif op == "update":
            actor_id = _identifier(raw.get("id"), f"actors[{index}].id")
            if actor_id not in actors:
                raise ValueError(f"수정할 actor를 찾을 수 없습니다: {actor_id}")
            changes_raw = raw.get("changes")
            if not isinstance(changes_raw, dict):
                raise ValueError(f"actors[{index}].changes가 필요합니다.")
            if "id" in changes_raw and str(changes_raw.get("id")) != actor_id:
                raise ValueError("actor stable identity는 update로 변경할 수 없습니다.")
            changes = _validate_actor_payload({"id": actor_id, **changes_raw}, f"actors[{index}].changes")
            stage_fields = {key: value for key, value in changes.items() if key not in {"id", "pose_preset", "body_pose"}}
            if stage_fields:
                stage_operations.append(_actor_stage_operation("update", {"id": actor_id, **stage_fields}, blocking))
            if changes.get("pose_preset") or changes.get("body_pose"):
                initial_pose[actor_id] = {key: changes[key] for key in ("pose_preset", "body_pose") if key in changes}
            updated.append(actor_id)
        else:
            actor_id = _identifier(raw.get("id"), f"actors[{index}].id")
            if actor_id not in actors:
                raise ValueError(f"삭제할 actor를 찾을 수 없습니다: {actor_id}")
            stage_operations.append({"op": "remove_dummy", "id": actor_id})
            actors.pop(actor_id, None)
            deleted.append(actor_id)

    return {
        "stage_operations": stage_operations,
        "candidate_actor_ids": set(actors),
        "initial_pose": initial_pose,
        "created": created,
        "updated": updated,
        "deleted": deleted,
    }


def _validate_points(points, label):
    if not isinstance(points, list) or not points or len(points) > MAX_PATH_POINTS:
        raise ValueError(f"{label}.points는 1~{MAX_PATH_POINTS}개가 필요합니다.")
    previous = -1.0
    for index, point in enumerate(points):
        if not isinstance(point, dict):
            raise ValueError(f"{label}.points[{index}]가 객체가 아닙니다.")
        time_value = _finite(point.get("time_sec"), f"{label}.points[{index}].time_sec")
        if time_value < 0 or time_value > core.MAX_TIMELINE_DURATION:
            raise ValueError(f"{label}.points[{index}].time_sec가 범위를 벗어났습니다.")
        if time_value <= previous:
            raise ValueError(f"{label}.points 시간은 strictly increasing이어야 합니다.")
        previous = time_value


def _existing_motion_ids(blocking):
    return {str(entry.get("id")) for entry in (blocking.get("motion") or {}).get("keyframes", []) if entry.get("id")}


def _compile_actor_paths(raw_paths, blocking, actor_ids, initial_pose):
    paths = raw_paths or []
    if not isinstance(paths, list) or len(paths) > MAX_ACTOR_COMMANDS:
        raise ValueError(f"actor_paths는 배열이며 {MAX_ACTOR_COMMANDS}개까지 지원합니다.")
    operations = []
    path_actor_ids = set()
    existing_ids = _existing_motion_ids(blocking)
    for index, raw in enumerate(paths):
        if not isinstance(raw, dict):
            raise ValueError(f"actor_paths[{index}]가 객체가 아닙니다.")
        actor_id = _identifier(raw.get("actor_id"), f"actor_paths[{index}].actor_id")
        if actor_id not in actor_ids:
            raise ValueError(f"actor path 대상을 찾을 수 없습니다: {actor_id}")
        if actor_id in path_actor_ids:
            raise ValueError(f"같은 actor의 path가 중복되었습니다: {actor_id}")
        path_actor_ids.add(actor_id)
        points = raw.get("points")
        _validate_points(points, f"actor_paths[{index}]")
        if bool(raw.get("replace_existing", True)):
            operations.append({"op": "clear_source_keys", "source_id": actor_id})
            existing_ids = {value for value in existing_ids if not value.startswith(f"dp-{actor_id}-")}
        default_transition = str(raw.get("transition") or "smooth")
        default_path = str(raw.get("path_mode") or "straight")
        for point_index, point in enumerate(points):
            _stage_xy(blocking, point.get("world_x_m"), point.get("world_z_m"), f"actor path '{actor_id}'[{point_index}]")
            key_id = f"dp-{actor_id}-path-{point_index + 1}"[:64]
            operation = {
                "op": "update_keyframe" if key_id in existing_ids else "add_keyframe",
                "id": key_id,
                "source_id": actor_id,
                "time": point["time_sec"],
                "world_x_m": point["world_x_m"],
                "world_z_m": point["world_z_m"],
                "transition": str(point.get("transition") or default_transition),
                "path_mode": str(point.get("path_mode") or default_path),
                "label": f"{actor_id} blocking {point_index + 1}",
            }
            if point.get("facing_deg") is not None:
                operation["facing"] = _finite(point["facing_deg"], f"actor path '{actor_id}'.facing_deg") % 360
            if point.get("pose_preset"):
                preset = str(point["pose_preset"])
                if preset not in core.MCP_POSE_PRESETS:
                    raise ValueError(f"지원하지 않는 배우 포즈 프리셋입니다: {preset}")
                operation["pose_preset"] = preset
            if point.get("body_pose") is not None:
                operation["body_pose"] = core._sanitize_motion_body_pose(point["body_pose"])
            operations.append(operation)
            existing_ids.add(key_id)
    for actor_id, pose in initial_pose.items():
        if actor_id in path_actor_ids:
            continue
        key_id = f"dp-{actor_id}-pose-0"[:64]
        operation = {
            "op": "update_keyframe" if key_id in existing_ids else "add_keyframe",
            "id": key_id,
            "source_id": actor_id,
            "time": 0,
            "transition": "hold",
            "path_mode": "straight",
            "label": f"{actor_id} initial pose",
        }
        if pose.get("pose_preset"):
            operation["pose_preset"] = pose["pose_preset"]
        if pose.get("body_pose") is not None:
            operation["body_pose"] = pose["body_pose"]
        operations.append(operation)
    return operations


def _prepare_camera(raw, blocking, valid_target_ids):
    if raw is None:
        return {"stage_operation": None, "extras": {}}
    if not isinstance(raw, dict):
        raise ValueError("camera는 객체여야 합니다.")
    operation = {"op": "update_camera"}
    extras = {}
    if raw.get("world_x_m") is not None or raw.get("world_z_m") is not None:
        current = blocking.get("camera") or {}
        width, depth = space.stage_dimensions(blocking.get("aspect", "16:9"))
        current_wx = (float(current.get("x", 0.5)) - 0.5) * width
        current_wz = (float(current.get("y", 0.5)) - 0.5) * depth
        wx = raw.get("world_x_m", current_wx)
        wz = raw.get("world_z_m", current_wz)
        x, y = _stage_xy(blocking, wx, wz, "camera")
        operation["x"] = x
        operation["y"] = y
    if raw.get("height_m") is not None:
        operation["height"] = core.clamp_number(raw["height_m"], core.CAMERA_HEIGHT_MIN, core.CAMERA_HEIGHT_MAX, "camera.height_m")
    if raw.get("pan_deg") is not None:
        operation["pan_deg"] = _finite(raw["pan_deg"], "camera.pan_deg") % 360
    if raw.get("tilt_deg") is not None:
        operation["tilt_deg"] = core.clamp_number(raw["tilt_deg"], core.CAMERA_TILT_MIN, core.CAMERA_TILT_MAX, "camera.tilt_deg")
    if raw.get("focal_mm") is not None:
        operation["focal"] = int(core.clamp_number(raw["focal_mm"], core.CAMERA_FOCAL_MIN, core.CAMERA_FOCAL_MAX, "camera.focal_mm"))
    if raw.get("focus_distance_m") is not None:
        distance = _finite(raw["focus_distance_m"], "camera.focus_distance_m")
        if distance <= 0:
            raise ValueError("camera.focus_distance_m은 0보다 커야 합니다.")
        extras["focusDistanceM"] = distance
    if raw.get("tracking_target_id") is not None:
        target = str(raw.get("tracking_target_id") or "")
        if target and target not in valid_target_ids:
            raise ValueError(f"camera tracking target을 찾을 수 없습니다: {target}")
        extras["trackingTargetId"] = target
    if raw.get("locks") is not None:
        locks = raw.get("locks")
        if not isinstance(locks, dict):
            raise ValueError("camera.locks는 객체여야 합니다.")
        current_locks = dict((blocking.get("camera") or {}).get("locks") or {})
        for key in ("position", "orientation", "lens", "height"):
            if key in locks:
                current_locks[key] = bool(locks[key])
        extras["locks"] = current_locks
    return {"stage_operation": operation if len(operation) > 1 else None, "extras": extras}


def _compile_camera_path(raw, blocking):
    if raw is None:
        return []
    if not isinstance(raw, dict):
        raise ValueError("camera_path는 객체여야 합니다.")
    points = raw.get("points")
    _validate_points(points, "camera_path")
    operations = []
    if bool(raw.get("replace_existing", True)):
        operations.append({"op": "clear_source_keys", "source_id": "camera"})
    default_transition = str(raw.get("transition") or "smooth")
    default_path = str(raw.get("path_mode") or "straight")
    existing_ids = _existing_motion_ids(blocking)
    for index, point in enumerate(points):
        _stage_xy(blocking, point.get("world_x_m"), point.get("world_z_m"), f"camera_path.points[{index}]")
        key_id = f"dp-camera-path-{index + 1}"[:64]
        operation = {
            "op": "update_keyframe" if key_id in existing_ids else "add_keyframe",
            "id": key_id,
            "source_id": "camera",
            "time": point["time_sec"],
            "world_x_m": point["world_x_m"],
            "world_z_m": point["world_z_m"],
            "transition": str(point.get("transition") or default_transition),
            "path_mode": str(point.get("path_mode") or default_path),
            "label": f"camera path {index + 1}",
        }
        aliases = {
            "height_m": "height", "pan_deg": "pan_deg", "tilt_deg": "tilt_deg",
            "focal_mm": "focal", "focus_distance_m": "focus_distance_m",
        }
        for source, target in aliases.items():
            if point.get(source) is not None:
                operation[target] = point[source]
        operations.append(operation)
        existing_ids.add(key_id)
    return operations


def _timeline_operations(raw):
    if raw is None:
        return []
    if not isinstance(raw, dict):
        raise ValueError("timeline은 객체여야 합니다.")
    operations = []
    duration = raw.get("duration_sec")
    if duration is not None:
        duration = core.clamp_number(duration, 1, core.MAX_TIMELINE_DURATION, "timeline.duration_sec")
        operations.append({"op": "set_duration", "duration": duration})
    start = raw.get("export_start_sec")
    end = raw.get("export_end_sec")
    if start is not None or end is not None:
        if duration is None:
            duration = core.MAX_TIMELINE_DURATION
        start = 0 if start is None else _finite(start, "timeline.export_start_sec")
        end = duration if end is None else _finite(end, "timeline.export_end_sec")
        if start < 0 or end > duration or end <= start:
            raise ValueError("timeline export range가 올바르지 않습니다.")
        operations.append({"op": "set_export_range", "start": start, "end": end})
    return operations


def _validate_shot(raw, valid_target_ids):
    if raw is None:
        return None
    if not isinstance(raw, dict):
        raise ValueError("shot은 객체여야 합니다.")
    result = {}
    for source, target, limit in (
        ("title", "title", 160), ("shot_type", "shotType", 80), ("camera_note", "camera", 500),
        ("intent", "intent", 500), ("notes", "notes", 1000),
    ):
        if source in raw:
            result[target] = str(raw.get(source) or "")[:limit]
    if "status" in raw:
        status = str(raw.get("status") or "draft")
        if status not in SHOT_STATUS:
            raise ValueError(f"shot.status가 올바르지 않습니다: {status}")
        result["status"] = status
    target_ids = [str(value) for value in raw.get("target_ids") or []]
    missing = [value for value in target_ids if value not in valid_target_ids]
    if missing:
        raise ValueError(f"shot target을 찾을 수 없습니다: {', '.join(missing[:8])}")
    result["shotDesign"] = {
        "schema": "frisframe-shot-design",
        "version": 1,
        "targetIds": target_ids,
        "framing": copy.deepcopy(raw.get("framing") or {}),
    }
    return result


def _prepare_set(raw_set, blocking, common):
    if raw_set is None:
        return None
    if not isinstance(raw_set, dict):
        raise ValueError("set은 객체여야 합니다.")
    args = {
        "project_id": common["project_id"],
        "scene_index": common["scene_index"],
        "cut_index": common["cut_index"],
        "transaction_id": common.get("transaction_id", ""),
        **copy.deepcopy(raw_set),
    }
    prepared = spatial._prepare_transaction(args, blocking)
    stage_operations = spatial._compile_delta_operations(prepared, blocking)
    return {"args": args, "prepared": prepared, "stage_operations": stage_operations, "report": spatial._validation_report(args, prepared)}


def _project_snapshot(project_id, scene_index, cut_index):
    payload = base._json_result(core.handle_get_project(project_id))
    project = base._project_from_payload(payload)
    if not project:
        raise ValueError("프로젝트 문서를 읽지 못했습니다.")
    cut, blocking = _cut_from_project(project, scene_index, cut_index)
    set_plan = copy.deepcopy(blocking.get("setMasterPlan")) if isinstance(blocking.get("setMasterPlan"), dict) else None
    set_ids = set() if set_plan is None else {str(value) for value in set_plan.get("generatedItemIds") or []}
    actors = [copy.deepcopy(item) for item in blocking.get("items", []) if item.get("type") == "actor"]
    keyframes = copy.deepcopy((blocking.get("motion") or {}).get("keyframes") or [])
    return {
        "schema": "frisframe-director-previs-snapshot",
        "version": 1,
        "policy": POLICY,
        "master_set": set_plan,
        "master_set_item_count": len(set_ids),
        "actors": actors,
        "actor_count": len(actors),
        "camera": copy.deepcopy(blocking.get("camera") or {}),
        "shot": {
            "title": cut.get("title", ""),
            "shot_type": cut.get("shotType", ""),
            "camera_note": cut.get("camera", ""),
            "intent": cut.get("intent", ""),
            "notes": cut.get("notes", ""),
            "status": cut.get("status", "draft"),
            "shot_design": copy.deepcopy(cut.get("shotDesign") or {}),
        },
        "timeline": {
            "duration_sec": (blocking.get("motion") or {}).get("duration"),
            "export_range": copy.deepcopy((blocking.get("motion") or {}).get("exportRange") or {}),
            "keyframes": keyframes,
            "actor_keyframe_count": sum(1 for key in keyframes if key.get("source") != "camera"),
            "camera_keyframe_count": sum(1 for key in keyframes if key.get("source") == "camera"),
        },
        "director_previs": copy.deepcopy(blocking.get("directorPrevis") or {}),
        "ready_for_previs": bool(set_plan) and bool(actors) and isinstance(blocking.get("camera"), dict),
    }


def _prepare_plan(args):
    project_id = args.get("project_id")
    scene_index = int(args.get("scene_index", 0))
    cut_index = int(args.get("cut_index", 0))
    blocking = base._load_blocking(project_id, scene_index, cut_index)
    if not any(args.get(key) is not None for key in ("set", "actors", "actor_paths", "camera", "camera_path", "shot", "timeline")):
        raise ValueError("set, actors, actor_paths, camera, camera_path, shot, timeline 중 하나 이상이 필요합니다.")
    common = {
        "project_id": project_id,
        "scene_index": scene_index,
        "cut_index": cut_index,
        "transaction_id": str(args.get("transaction_id") or "")[:120],
    }
    set_prepared = _prepare_set(args.get("set"), blocking, common)
    candidate_set_ids = _set_ids(blocking)
    if set_prepared is not None:
        candidate_set_ids = {entry["id"] for entry in set_prepared["prepared"]["normalized"]["elements"] if entry["include_in_scene"]}
    actor_prepared = _prepare_actor_commands(args.get("actors"), blocking, candidate_set_ids)
    actor_ids = actor_prepared["candidate_actor_ids"]
    valid_target_ids = set(candidate_set_ids) | set(actor_ids)
    actor_motion = _compile_actor_paths(args.get("actor_paths"), blocking, actor_ids, actor_prepared["initial_pose"])
    camera_prepared = _prepare_camera(args.get("camera"), blocking, valid_target_ids)
    camera_motion = _compile_camera_path(args.get("camera_path"), blocking)
    timeline_motion = _timeline_operations(args.get("timeline"))
    motion_operations = actor_motion + camera_motion + timeline_motion
    if len(motion_operations) > MAX_MOTION_OPERATIONS:
        raise ValueError(f"전체 motion operation이 {MAX_MOTION_OPERATIONS}개를 초과했습니다.")
    shot = _validate_shot(args.get("shot"), valid_target_ids)
    return {
        "common": common,
        "blocking": blocking,
        "set": set_prepared,
        "actors": actor_prepared,
        "camera": camera_prepared,
        "motion_operations": motion_operations,
        "shot": shot,
        "valid_target_ids": valid_target_ids,
    }


def validation_report(args, prepared):
    set_report = None if prepared["set"] is None else prepared["set"]["report"]
    actors = prepared["actors"]
    return {
        "schema": "frisframe-director-previs-validation",
        "version": 1,
        "policy": POLICY,
        "valid": True,
        "transaction_id": prepared["common"]["transaction_id"],
        "set": set_report,
        "actors": {
            "created": actors["created"],
            "updated": actors["updated"],
            "deleted": actors["deleted"],
            "stage_operation_count": len(actors["stage_operations"]),
            "final_actor_count": len(actors["candidate_actor_ids"]),
        },
        "camera": {
            "static_update": prepared["camera"]["stage_operation"] is not None or bool(prepared["camera"]["extras"]),
            "motion_key_operation_count": sum(1 for op in prepared["motion_operations"] if op.get("source_id") == "camera"),
        },
        "motion_operation_count": len(prepared["motion_operations"]),
        "shot_update": prepared["shot"] is not None,
        "atomic_policy": "validate-all-then-single-commit-or-zero-change",
        "product_boundary": "MCP decides; FrisFrame executes",
    }


def validate_plan(args):
    prepared = _prepare_plan(args)
    return validation_report(args, prepared)


def apply_plan(args):
    project_id = args.get("project_id")
    revision = int(args["revision"])
    prepared = _prepare_plan(args)
    report = validation_report(args, prepared)
    scene_index = prepared["common"]["scene_index"]
    cut_index = prepared["common"]["cut_index"]

    def apply_atomic(project_obj):
        cut, blocking = _cut_from_project(project_obj, scene_index, cut_index)
        details = {}

        set_prepared = prepared["set"]
        if set_prepared is not None:
            normalized = set_prepared["prepared"]["normalized"]
            operations = set_prepared["stage_operations"]
            guide = reference._merge_guide(blocking, normalized["source_name"], spatial._anchors(normalized))
            if operations:
                payload = base._target_args(args, revision)
                payload["operations"] = operations
                payload["spatial_guide"] = guide
                stage_result = base._json_result(core.handle_apply_scene_commands(project_id, payload))
                details["set_stage"] = base._json_result(stage_result.get("message", ""))
            applied_elements = [entry for entry in normalized["elements"] if entry["include_in_scene"]]
            sets._persist_plan(blocking, normalized, applied_elements, bool(set_prepared["args"].get("lock_after_apply", False)))
            details["set"] = set_prepared["report"]

        actor_operations = prepared["actors"]["stage_operations"]
        if actor_operations:
            payload = base._target_args(args, revision)
            payload["operations"] = actor_operations
            stage_result = base._json_result(core.handle_apply_scene_commands(project_id, payload))
            details["actors"] = base._json_result(stage_result.get("message", ""))
        deleted_actor_ids = set(prepared["actors"]["deleted"])
        if deleted_actor_ids:
            motion = blocking.setdefault("motion", {})
            motion["keyframes"] = [key for key in motion.get("keyframes", []) if str(key.get("source")) not in deleted_actor_ids]
            if str(motion.get("activeSource")) in deleted_actor_ids:
                motion["activeSource"] = "camera"

        camera_operation = prepared["camera"]["stage_operation"]
        if camera_operation is not None:
            payload = base._target_args(args, revision)
            payload["operations"] = [camera_operation]
            stage_result = base._json_result(core.handle_apply_scene_commands(project_id, payload))
            details["camera_stage"] = base._json_result(stage_result.get("message", ""))
        if prepared["camera"]["extras"]:
            blocking["camera"].update(copy.deepcopy(prepared["camera"]["extras"]))

        if prepared["shot"] is not None:
            shot = prepared["shot"]
            for key in ("title", "shotType", "camera", "intent", "notes", "status", "shotDesign"):
                if key in shot:
                    cut[key] = copy.deepcopy(shot[key])
            details["shot"] = copy.deepcopy(cut.get("shotDesign") or {})

        if prepared["motion_operations"]:
            payload = base._target_args(args, revision)
            payload["operations"] = prepared["motion_operations"]
            motion_result = base._json_result(core.handle_apply_motion_commands(project_id, payload))
            details["motion"] = base._json_result(motion_result.get("message", ""))

        blocking["directorPrevis"] = {
            "schema": "frisframe-director-previs",
            "version": 1,
            "policy": POLICY,
            "transactionId": prepared["common"]["transaction_id"],
            "masterSetItemCount": len(_set_ids(blocking)),
            "actorIds": sorted(str(item.get("id")) for item in blocking.get("items", []) if item.get("type") == "actor" and item.get("id")),
            "shotType": cut.get("shotType", ""),
            "atomicRevision": True,
        }
        return details

    committed = base._json_result(core.mutate_project_atomic(project_id, revision, apply_atomic))
    detail = committed.get("message")
    if not isinstance(detail, dict):
        detail = base._json_result(detail)
    snapshot = _project_snapshot(project_id, scene_index, cut_index)
    return {
        "project_id": project_id,
        "revision": committed["revision"],
        "updated_at": committed.get("updated_at"),
        "applied": True,
        "validation": report,
        "details": detail,
        "snapshot": snapshot,
        "atomic_revision": True,
    }


def contract():
    return {
        "schema": "frisframe-director-previs-contract",
        "version": 1,
        "policy": POLICY,
        "flow": [
            "MCP interprets reference and chooses metric set geometry",
            "MCP sends explicit actor blocking and paths",
            "MCP sends explicit camera position/lens/orientation/path",
            "MCP sends shot/framing metadata",
            "FrisFrame validates the complete candidate",
            "FrisFrame commits set + actors + camera + shot + motion once or rolls back everything",
            "MCP re-reads one director previs snapshot and verifies the result",
        ],
        "frisframe_responsibility": [
            "deterministic metric execution", "stable ids", "dependency validation", "atomic transaction",
            "actor blocking implementation", "camera/lens implementation", "shot state persistence", "timeline implementation",
        ],
        "mcp_responsibility": [
            "image interpretation", "real-world dimensions", "blocking intent", "lens/framing choice", "shot meaning",
        ],
        "semantic_guessing_inside_frisframe": False,
        "master_set_source_of_truth": True,
        "single_revision_full_previs": True,
        "supports": {
            "set_create_update_delete_attach_detach": True,
            "actor_create_update_delete": True,
            "actor_pose_and_metric_paths": True,
            "camera_metric_position_lens_focus": True,
            "camera_timeline_paths": True,
            "shot_metadata_and_framing": True,
            "timeline_duration_and_export_range": True,
            "read_only_end_to_end_snapshot": True,
        },
    }


_PREVIOUS_CALL_TOOL = base.call_tool


def call_tool(name, args):
    if name == "get_director_previs_contract":
        return json.dumps(contract(), ensure_ascii=False)
    if name == "validate_director_previs_plan":
        return json.dumps(validate_plan(args), ensure_ascii=False)
    if name == "apply_director_previs_plan":
        return json.dumps(apply_plan(args), ensure_ascii=False)
    if name == "get_director_previs_snapshot":
        return json.dumps(_project_snapshot(args.get("project_id"), int(args.get("scene_index", 0)), int(args.get("cut_index", 0))), ensure_ascii=False)
    return _PREVIOUS_CALL_TOOL(name, args)


def install():
    if getattr(base, "_director_previs_extension_installed", False):
        return
    existing = {tool.get("name") for tool in base.TOOLS}
    for tool in (CONTRACT_TOOL, VALIDATE_TOOL, APPLY_TOOL, SNAPSHOT_TOOL):
        if tool["name"] not in existing:
            base.TOOLS.append(tool)
    base.call_tool = call_tool
    base._director_previs_extension_installed = True


install()
