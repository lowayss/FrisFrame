#!/usr/bin/env python3
"""FrisFrame MCP entrypoint for deterministic previs authoring.

The MCP client may use vision/language reasoning, but FrisFrame itself never calls
an AI API. This process only converts explicit stage, camera, and keyframe plans
into validated FrisFrame project mutations.
"""

import json
import math
import sys

import mcp_server as core


SCENE_OPERATION_SCHEMA = {
    "type": "object",
    "properties": {
        "op": {
            "type": "string",
            "enum": ["add_dummy", "update_dummy", "remove_dummy", "set_camera", "update_camera", "set_spatial_guide"],
        },
        "id": {"type": "string"},
        "type": {"type": "string", "enum": ["actor", "prop"]},
        "name": {"type": "string"},
        "dummy_type": {"type": "string"},
        "asset_type": {"type": "string"},
        "x": {"type": "number", "minimum": 0.02, "maximum": 0.98},
        "y": {"type": "number", "minimum": 0.02, "maximum": 0.98},
        "world_x_m": {"type": "number"},
        "world_z_m": {"type": "number"},
        "facing": {"type": "number"},
        "pitch": {"type": "number"},
        "height": {"type": "number"},
        "pan_deg": {"type": "number"},
        "tilt_deg": {"type": "number", "minimum": -90, "maximum": 90},
        "focal": {"type": "integer", "minimum": 14, "maximum": 135},
        "size": {"type": "number", "minimum": 0.1, "maximum": 8},
        "scale_x": {"type": "number", "minimum": 0.05, "maximum": 20},
        "scale_y": {"type": "number", "minimum": 0.05, "maximum": 20},
        "scale_z": {"type": "number", "minimum": 0.05, "maximum": 20},
        "vertical_offset": {"type": "number"},
        "mounted_height": {"type": "number"},
        "color": {"type": "string", "pattern": "^#[0-9A-Fa-f]{6}$"},
        "visible": {"type": "boolean"},
        "anchor_id": {"type": "string"},
        "guide": {"type": "object"},
        "spatial_guide": {"type": "object"},
        "physical_dimensions_m": {
            "type": "object",
            "properties": {
                "width": {"type": "number", "exclusiveMinimum": 0},
                "height": {"type": "number", "exclusiveMinimum": 0},
                "depth": {"type": "number", "exclusiveMinimum": 0},
            },
        },
    },
    "required": ["op"],
}

MOTION_OPERATION_SCHEMA = {
    "type": "object",
    "properties": {
        "op": {
            "type": "string",
            "enum": [
                "add_keyframe", "set_pose_key", "set_motion_key",
                "update_keyframe", "update_pose_key", "remove_keyframe",
                "clear_source_keys", "set_duration", "set_export_range",
            ],
        },
        "id": {"type": "string"},
        "source_id": {"type": "string", "description": "camera 또는 배우/소품 ID"},
        "time": {"type": "number", "minimum": 0, "maximum": 60},
        "x": {"type": "number", "minimum": 0.02, "maximum": 0.98},
        "y": {"type": "number", "minimum": 0.02, "maximum": 0.98},
        "world_x_m": {"type": "number"},
        "world_z_m": {"type": "number"},
        "facing": {"type": "number"},
        "pitch": {"type": "number"},
        "height": {"type": "number"},
        "vertical_offset": {"type": "number"},
        "mounted_height": {"type": "number"},
        "pan_deg": {"type": "number"},
        "tilt_deg": {"type": "number", "minimum": -90, "maximum": 90},
        "focal": {"type": "integer", "minimum": 14, "maximum": 135},
        "focus_distance_m": {"type": "number", "exclusiveMinimum": 0},
        "transition": {"type": "string", "enum": ["smooth", "linear", "hold", "cut"]},
        "path_mode": {
            "type": "string",
            "enum": ["straight", "horizontal", "vertical", "arc-left", "arc-right", "free-curve", "drone", "jib-up", "jib-down"],
        },
        "pose_preset": {"type": "string", "enum": sorted(core.MCP_POSE_PRESETS)},
        "body_pose": {"type": "object"},
        "label": {"type": "string"},
        "note": {"type": "string"},
        "duration": {"type": "number", "minimum": 1, "maximum": 60},
        "start": {"type": "number", "minimum": 0, "maximum": 60},
        "end": {"type": "number", "minimum": 0, "maximum": 60},
    },
    "required": ["op"],
}

MOTION_MACRO_SCHEMA = {
    "type": "object",
    "properties": {
        "type": {
            "type": "string",
            "enum": [
                "camera_orbit",
                "camera_dolly_and_zoom",
                "camera_jib",
                "camera_follow_actor",
                "pair_approach",
                "move_subject",
            ],
        },
        "start_time": {"type": "number", "minimum": 0, "maximum": 60},
        "end_time": {"type": "number", "minimum": 0, "maximum": 60},
        "target_id": {"type": "string"},
        "source_id": {"type": "string"},
        "actor_a_id": {"type": "string"},
        "actor_b_id": {"type": "string"},
        "degrees": {"type": "number", "minimum": 1, "maximum": 360},
        "direction": {"type": "string", "enum": ["left", "right", "ccw", "cw"]},
        "steps": {"type": "integer", "minimum": 2, "maximum": 16},
        "radius": {"type": "number", "exclusiveMinimum": 0},
        "distance_ratio": {"type": "number", "exclusiveMinimum": 0, "maximum": 2},
        "start_focal": {"type": "integer", "minimum": 14, "maximum": 135},
        "end_focal": {"type": "integer", "minimum": 14, "maximum": 135},
        "start_height": {"type": "number", "minimum": 0.4, "maximum": 35},
        "end_height": {"type": "number", "minimum": 0.4, "maximum": 35},
        "end_x": {"type": "number", "minimum": 0.02, "maximum": 0.98},
        "end_y": {"type": "number", "minimum": 0.02, "maximum": 0.98},
        "move_fraction": {"type": "number", "minimum": 0, "maximum": 1},
        "face_each_other": {"type": "boolean"},
        "transition": {"type": "string", "enum": ["smooth", "linear"]},
        "label": {"type": "string"},
    },
    "required": ["type", "start_time", "end_time"],
}

COMMON_TARGET_PROPERTIES = {
    "project_id": {"type": "string", "description": "FrisFrame 프로젝트 ID"},
    "revision": {"type": "integer", "minimum": 1, "description": "직전 get_project 결과의 revision"},
    "scene_index": {"type": "integer", "minimum": 0, "default": 0},
    "cut_index": {"type": "integer", "minimum": 0, "default": 0},
}

TOOLS = [
    {
        "name": "list_projects",
        "description": "작업 가능한 FrisFrame 프로젝트와 revision을 조회합니다.",
        "inputSchema": {"type": "object", "properties": {}},
    },
    {
        "name": "get_project",
        "description": "MCP 수정 전에 프로젝트 전체 상태와 revision을 읽습니다. 수동 편집과 MCP 편집을 섞을 때 항상 최신 상태를 다시 읽으세요.",
        "inputSchema": {
            "type": "object",
            "properties": {"project_id": {"type": "string"}},
            "required": ["project_id"],
        },
    },
    {
        "name": "apply_stage_layout",
        "description": "이미지 레퍼런스를 MCP 클라이언트가 해석한 결과를 더미/소품/카메라/공간 앵커로 구현합니다. FrisFrame 자체는 이미지를 분석하지 않습니다. 이후 매크로에서 참조할 대상은 add_dummy에 안정적인 id를 지정하세요.",
        "inputSchema": {
            "type": "object",
            "properties": {
                **COMMON_TARGET_PROPERTIES,
                "operations": {"type": "array", "minItems": 1, "maxItems": 200, "items": SCENE_OPERATION_SCHEMA},
                "spatial_guide": {
                    "type": "object",
                    "description": "MCP가 레퍼런스 이미지에서 확정한 구조 정보. 이미지 파일 자체가 아니라 앵커/깊이/치수만 저장합니다.",
                },
            },
            "required": ["project_id", "revision", "operations"],
        },
    },
    {
        "name": "apply_motion_timeline",
        "description": "카메라/배우/소품의 확정된 시간별 키프레임을 직접 적용합니다. 자동 보조 동작은 생성하지 않습니다.",
        "inputSchema": {
            "type": "object",
            "properties": {
                **COMMON_TARGET_PROPERTIES,
                "operations": {"type": "array", "minItems": 1, "maxItems": 200, "items": MOTION_OPERATION_SCHEMA},
            },
            "required": ["project_id", "revision", "operations"],
        },
    },
    {
        "name": "apply_motion_macros",
        "description": "자주 쓰는 복잡한 연출 명령을 결정적인 키프레임 묶음으로 변환합니다. 지원: 카메라 오빗, 돌리+줌, 지브, 배우 추적, 두 배우 접근, 대상 이동. 생성된 결과는 일반 키프레임이라 UI에서 그대로 수정할 수 있습니다.",
        "inputSchema": {
            "type": "object",
            "properties": {
                **COMMON_TARGET_PROPERTIES,
                "macros": {"type": "array", "minItems": 1, "maxItems": 32, "items": MOTION_MACRO_SCHEMA},
            },
            "required": ["project_id", "revision", "macros"],
        },
    },
    {
        "name": "apply_previs_plan",
        "description": "무대 배치 + 명시적 키프레임 + 고수준 모션 매크로를 한 요청에서 순서대로 적용하는 권장 도구입니다. 수동 편집 후에는 최신 revision을 읽고 호출하세요. AI API나 최종 Seedance 프롬프트 생성은 하지 않습니다.",
        "inputSchema": {
            "type": "object",
            "properties": {
                **COMMON_TARGET_PROPERTIES,
                "stage_operations": {"type": "array", "maxItems": 200, "items": SCENE_OPERATION_SCHEMA},
                "spatial_guide": {"type": "object"},
                "motion_operations": {"type": "array", "maxItems": 200, "items": MOTION_OPERATION_SCHEMA},
                "motion_macros": {"type": "array", "maxItems": 32, "items": MOTION_MACRO_SCHEMA},
            },
            "required": ["project_id", "revision"],
        },
    },
]


def _json_result(text):
    try:
        return json.loads(text)
    except Exception:
        return {"raw": text}


def _target_args(args, revision=None):
    return {
        "revision": int(revision if revision is not None else args["revision"]),
        "scene_index": int(args.get("scene_index", 0)),
        "cut_index": int(args.get("cut_index", 0)),
    }


def _clamp(value, low=core.STAGE_COORD_MIN, high=core.STAGE_COORD_MAX):
    return min(high, max(low, float(value)))


def _project_from_payload(payload):
    if not isinstance(payload, dict):
        return None
    document = payload.get("document")
    if isinstance(document, dict) and isinstance(document.get("project"), dict):
        return document["project"]
    if isinstance(payload.get("project"), dict):
        return payload["project"]
    if "scenes" in payload and isinstance(payload.get("scenes"), list):
        return payload
    for value in payload.values():
        if isinstance(value, dict):
            found = _project_from_payload(value)
            if found:
                return found
    return None


def _load_blocking(project_id, scene_index, cut_index):
    payload = _json_result(core.handle_get_project(project_id))
    project = _project_from_payload(payload)
    if not project:
        raise ValueError("프로젝트 문서에서 scenes를 찾지 못했습니다.")
    scenes = project.get("scenes") or []
    if not 0 <= scene_index < len(scenes):
        raise ValueError(f"scene_index 범위를 벗어났습니다: {scene_index}")
    cuts = scenes[scene_index].get("cuts") or []
    if not 0 <= cut_index < len(cuts):
        raise ValueError(f"cut_index 범위를 벗어났습니다: {cut_index}")
    blocking = cuts[cut_index].get("blocking")
    if not isinstance(blocking, dict):
        raise ValueError("선택한 컷에 blocking 데이터가 없습니다.")
    return blocking


def _find_item(blocking, item_id):
    item = next((entry for entry in blocking.get("items", []) if str(entry.get("id")) == str(item_id)), None)
    if not item:
        raise ValueError(f"대상을 찾을 수 없습니다: {item_id}")
    return item


def _source_pose(blocking, source_id, time_value):
    if source_id == "camera":
        source = dict(blocking.get("camera") or {})
    else:
        source = dict(_find_item(blocking, source_id))
    keys = [
        key for key in (blocking.get("motion") or {}).get("keyframes", [])
        if str(key.get("source")) == str(source_id) and float(key.get("time", 0)) <= float(time_value)
    ]
    if keys:
        keys.sort(key=lambda key: float(key.get("time", 0)))
        source.update(keys[-1].get("pose") or {})
    return source


def _target_xy(blocking, item_id, time_value):
    pose = _source_pose(blocking, item_id, time_value)
    return float(pose.get("x", 0.5)), float(pose.get("y", 0.5))


def _camera_pan_to(camera_x, camera_y, target_x, target_y):
    angle_from_target = math.atan2(camera_y - target_y, camera_x - target_x)
    return (math.degrees(angle_from_target + math.pi) + 360.0) % 360.0


def _facing_to(source_x, source_y, target_x, target_y):
    return (math.degrees(math.atan2(target_y - source_y, target_x - source_x)) + 360.0) % 360.0


def _time_bounds(macro):
    start = float(macro["start_time"])
    end = float(macro["end_time"])
    if not (0 <= start < end <= core.MAX_TIMELINE_DURATION):
        raise ValueError("매크로 시간은 0 <= start_time < end_time <= 60 이어야 합니다.")
    return start, end


def _base_key(source_id, time_value, transition, label):
    return {
        "op": "add_keyframe",
        "source_id": source_id,
        "time": round(float(time_value), 4),
        "transition": transition,
        "path_mode": "straight",
        "label": label,
    }


def _expand_camera_orbit(blocking, macro, index):
    start, end = _time_bounds(macro)
    target_id = str(macro.get("target_id") or "")
    if not target_id:
        raise ValueError("camera_orbit에는 target_id가 필요합니다.")
    target_x, target_y = _target_xy(blocking, target_id, start)
    camera = _source_pose(blocking, "camera", start)
    camera_x = float(camera.get("x", 0.9))
    camera_y = float(camera.get("y", 0.5))
    radius = float(macro.get("radius") or math.hypot(camera_x - target_x, camera_y - target_y))
    if radius <= 0:
        raise ValueError("camera_orbit radius가 0입니다.")
    degrees = float(macro.get("degrees", 90))
    direction = str(macro.get("direction", "left")).lower()
    sign = 1 if direction in {"left", "ccw"} else -1
    steps = int(macro.get("steps") or max(3, min(9, math.ceil(abs(degrees) / 30) + 1)))
    start_angle = math.atan2(camera_y - target_y, camera_x - target_x)
    focal = int(macro.get("start_focal") or camera.get("focal", 50))
    tilt = float(camera.get("tiltDeg", 0))
    transition = str(macro.get("transition", "smooth"))
    label = str(macro.get("label") or f"카메라 오빗 {index + 1}")
    operations = []
    for step in range(steps):
        progress = step / (steps - 1)
        angle = start_angle + math.radians(degrees * sign * progress)
        x = _clamp(target_x + math.cos(angle) * radius)
        y = _clamp(target_y + math.sin(angle) * radius)
        key = _base_key("camera", start + (end - start) * progress, transition, label)
        key.update({
            "x": x,
            "y": y,
            "pan_deg": _camera_pan_to(x, y, target_x, target_y),
            "tilt_deg": tilt,
            "focal": focal,
        })
        operations.append(key)
    return operations


def _expand_camera_dolly_and_zoom(blocking, macro, index):
    start, end = _time_bounds(macro)
    target_id = str(macro.get("target_id") or "")
    if not target_id:
        raise ValueError("camera_dolly_and_zoom에는 target_id가 필요합니다.")
    target_x, target_y = _target_xy(blocking, target_id, start)
    camera = _source_pose(blocking, "camera", start)
    x0, y0 = float(camera.get("x", 0.9)), float(camera.get("y", 0.5))
    ratio = float(macro.get("distance_ratio", 0.55))
    x1 = _clamp(target_x + (x0 - target_x) * ratio)
    y1 = _clamp(target_y + (y0 - target_y) * ratio)
    start_focal = int(macro.get("start_focal") or camera.get("focal", 35))
    end_focal = int(macro.get("end_focal") or 85)
    transition = str(macro.get("transition", "smooth"))
    label = str(macro.get("label") or f"돌리+줌 {index + 1}")
    tilt = float(camera.get("tiltDeg", 0))
    first = _base_key("camera", start, transition, label)
    first.update({"x": x0, "y": y0, "pan_deg": _camera_pan_to(x0, y0, target_x, target_y), "tilt_deg": tilt, "focal": start_focal})
    second = _base_key("camera", end, transition, label)
    second.update({"x": x1, "y": y1, "pan_deg": _camera_pan_to(x1, y1, target_x, target_y), "tilt_deg": tilt, "focal": end_focal})
    return [first, second]


def _expand_camera_jib(blocking, macro, index):
    start, end = _time_bounds(macro)
    camera = _source_pose(blocking, "camera", start)
    x0, y0 = float(camera.get("x", 0.9)), float(camera.get("y", 0.5))
    x1 = _clamp(macro.get("end_x", x0))
    y1 = _clamp(macro.get("end_y", y0))
    h0 = float(macro.get("start_height", camera.get("height", 1.6)))
    h1 = float(macro.get("end_height", h0 + 2.0))
    focal = int(macro.get("end_focal") or camera.get("focal", 50))
    transition = str(macro.get("transition", "smooth"))
    label = str(macro.get("label") or f"지브 {index + 1}")
    path = "jib-up" if h1 >= h0 else "jib-down"
    first = _base_key("camera", start, transition, label)
    first.update({"x": x0, "y": y0, "height": h0, "pan_deg": camera.get("panDeg", 180), "tilt_deg": camera.get("tiltDeg", 0), "focal": camera.get("focal", focal), "path_mode": path})
    second = _base_key("camera", end, transition, label)
    second.update({"x": x1, "y": y1, "height": h1, "pan_deg": camera.get("panDeg", 180), "tilt_deg": camera.get("tiltDeg", 0), "focal": focal, "path_mode": path})
    return [first, second]


def _expand_move_subject(blocking, macro, index):
    start, end = _time_bounds(macro)
    source_id = str(macro.get("source_id") or "")
    if not source_id or source_id == "camera":
        raise ValueError("move_subject에는 배우/소품 source_id가 필요합니다.")
    pose = _source_pose(blocking, source_id, start)
    if macro.get("end_x") is None or macro.get("end_y") is None:
        raise ValueError("move_subject에는 end_x와 end_y가 필요합니다.")
    x0, y0 = float(pose.get("x", 0.5)), float(pose.get("y", 0.5))
    x1, y1 = _clamp(macro["end_x"]), _clamp(macro["end_y"])
    transition = str(macro.get("transition", "smooth"))
    label = str(macro.get("label") or f"대상 이동 {index + 1}")
    first = _base_key(source_id, start, transition, label)
    first.update({"x": x0, "y": y0})
    second = _base_key(source_id, end, transition, label)
    second.update({"x": x1, "y": y1})
    if "facing" in pose:
        first["facing"] = pose["facing"]
        second["facing"] = pose["facing"]
    return [first, second]


def _expand_pair_approach(blocking, macro, index):
    start, end = _time_bounds(macro)
    actor_a = str(macro.get("actor_a_id") or "")
    actor_b = str(macro.get("actor_b_id") or "")
    if not actor_a or not actor_b or actor_a == actor_b:
        raise ValueError("pair_approach에는 서로 다른 actor_a_id와 actor_b_id가 필요합니다.")
    ax, ay = _target_xy(blocking, actor_a, start)
    bx, by = _target_xy(blocking, actor_b, start)
    move_fraction = float(macro.get("move_fraction", 0.6))
    move_fraction = min(1.0, max(0.0, move_fraction))
    half = move_fraction / 2.0
    a1x, a1y = _clamp(ax + (bx - ax) * half), _clamp(ay + (by - ay) * half)
    b1x, b1y = _clamp(bx + (ax - bx) * half), _clamp(by + (ay - by) * half)
    transition = str(macro.get("transition", "smooth"))
    label = str(macro.get("label") or f"두 배우 접근 {index + 1}")
    face = bool(macro.get("face_each_other", True))
    operations = []
    for source_id, x0, y0, x1, y1, other0x, other0y, other1x, other1y in [
        (actor_a, ax, ay, a1x, a1y, bx, by, b1x, b1y),
        (actor_b, bx, by, b1x, b1y, ax, ay, a1x, a1y),
    ]:
        first = _base_key(source_id, start, transition, label)
        second = _base_key(source_id, end, transition, label)
        first.update({"x": x0, "y": y0})
        second.update({"x": x1, "y": y1})
        if face:
            first["facing"] = _facing_to(x0, y0, other0x, other0y)
            second["facing"] = _facing_to(x1, y1, other1x, other1y)
        operations.extend([first, second])
    return operations


def _expand_camera_follow_actor(blocking, macro, index):
    start, end = _time_bounds(macro)
    target_id = str(macro.get("target_id") or "")
    if not target_id:
        raise ValueError("camera_follow_actor에는 target_id가 필요합니다.")
    camera = _source_pose(blocking, "camera", start)
    tx0, ty0 = _target_xy(blocking, target_id, start)
    offset_x = float(camera.get("x", 0.9)) - tx0
    offset_y = float(camera.get("y", 0.5)) - ty0
    motion_keys = [
        key for key in (blocking.get("motion") or {}).get("keyframes", [])
        if str(key.get("source")) == target_id and start < float(key.get("time", 0)) < end
    ]
    sample_times = [start] + sorted({float(key.get("time", 0)) for key in motion_keys}) + [end]
    if len(sample_times) > 16:
        stride = max(1, math.ceil((len(sample_times) - 2) / 14))
        sample_times = [sample_times[0]] + sample_times[1:-1:stride][:14] + [sample_times[-1]]
    transition = str(macro.get("transition", "smooth"))
    label = str(macro.get("label") or f"배우 추적 {index + 1}")
    focal = int(macro.get("end_focal") or camera.get("focal", 50))
    tilt = float(camera.get("tiltDeg", 0))
    operations = []
    for time_value in sample_times:
        tx, ty = _target_xy(blocking, target_id, time_value)
        cx, cy = _clamp(tx + offset_x), _clamp(ty + offset_y)
        key = _base_key("camera", time_value, transition, label)
        key.update({
            "x": cx,
            "y": cy,
            "pan_deg": _camera_pan_to(cx, cy, tx, ty),
            "tilt_deg": tilt,
            "focal": focal,
        })
        operations.append(key)
    return operations


def _expand_macros(blocking, macros):
    operations = []
    summaries = []
    expanders = {
        "camera_orbit": _expand_camera_orbit,
        "camera_dolly_and_zoom": _expand_camera_dolly_and_zoom,
        "camera_jib": _expand_camera_jib,
        "camera_follow_actor": _expand_camera_follow_actor,
        "pair_approach": _expand_pair_approach,
        "move_subject": _expand_move_subject,
    }
    for index, macro in enumerate(macros):
        if not isinstance(macro, dict):
            raise ValueError(f"macros[{index}]가 객체가 아닙니다.")
        macro_type = str(macro.get("type") or "")
        expander = expanders.get(macro_type)
        if not expander:
            raise ValueError(f"지원하지 않는 모션 매크로입니다: {macro_type}")
        expanded = expander(blocking, macro, index)
        operations.extend(expanded)
        summaries.append({"type": macro_type, "keyframes": len(expanded)})
    if len(operations) > 200:
        raise ValueError("매크로 확장 결과가 200개 키프레임을 초과했습니다.")
    return operations, summaries


def _apply_motion_macros(project_id, args, revision=None):
    scene_index = int(args.get("scene_index", 0))
    cut_index = int(args.get("cut_index", 0))
    macros = args.get("macros") or args.get("motion_macros") or []
    if not macros:
        raise ValueError("motion macros를 하나 이상 넣어 주세요.")
    blocking = _load_blocking(project_id, scene_index, cut_index)
    operations, summaries = _expand_macros(blocking, macros)
    payload = _target_args(args, revision)
    payload["operations"] = operations
    result = _json_result(core.handle_apply_motion_commands(project_id, payload))
    if "revision" not in result:
        raise ValueError(result.get("raw", "모션 매크로 적용 결과를 읽지 못했습니다."))
    result["expanded_macros"] = summaries
    result["expanded_keyframes"] = len(operations)
    return result


def call_tool(name, args):
    if name == "list_projects":
        return core.handle_list_projects()
    if name == "get_project":
        return core.handle_get_project(args.get("project_id"))
    if name == "apply_stage_layout":
        payload = _target_args(args)
        payload["operations"] = args.get("operations") or []
        if args.get("spatial_guide") is not None:
            payload["spatial_guide"] = args["spatial_guide"]
        return core.handle_apply_scene_commands(args.get("project_id"), payload)
    if name == "apply_motion_timeline":
        payload = _target_args(args)
        payload["operations"] = args.get("operations") or []
        return core.handle_apply_motion_commands(args.get("project_id"), payload)
    if name == "apply_motion_macros":
        result = _apply_motion_macros(args.get("project_id"), args)
        return json.dumps(result, ensure_ascii=False)
    if name == "apply_previs_plan":
        project_id = args.get("project_id")
        revision = int(args["revision"])
        steps = []
        stage_operations = args.get("stage_operations") or []
        spatial_guide = args.get("spatial_guide")
        motion_operations = list(args.get("motion_operations") or [])
        motion_macros = args.get("motion_macros") or []
        if not stage_operations and spatial_guide is None and not motion_operations and not motion_macros:
            raise ValueError("stage_operations, spatial_guide, motion_operations, motion_macros 중 하나 이상이 필요합니다.")

        if stage_operations or spatial_guide is not None:
            payload = _target_args(args, revision)
            payload["operations"] = stage_operations
            if spatial_guide is not None:
                payload["spatial_guide"] = spatial_guide
            stage_result = _json_result(core.handle_apply_scene_commands(project_id, payload))
            if "revision" not in stage_result:
                raise ValueError(stage_result.get("raw", "무대 명령 적용 결과를 읽지 못했습니다."))
            revision = int(stage_result["revision"])
            steps.append({"stage": stage_result})

        macro_summaries = []
        if motion_macros:
            blocking = _load_blocking(project_id, int(args.get("scene_index", 0)), int(args.get("cut_index", 0)))
            expanded, macro_summaries = _expand_macros(blocking, motion_macros)
            motion_operations.extend(expanded)

        if motion_operations:
            if len(motion_operations) > 200:
                raise ValueError("명시적 키프레임 + 매크로 확장 결과가 200개 명령을 초과했습니다.")
            payload = _target_args(args, revision)
            payload["operations"] = motion_operations
            motion_result = _json_result(core.handle_apply_motion_commands(project_id, payload))
            if "revision" not in motion_result:
                raise ValueError(motion_result.get("raw", "모션 명령 적용 결과를 읽지 못했습니다."))
            revision = int(motion_result["revision"])
            if macro_summaries:
                motion_result["expanded_macros"] = macro_summaries
            steps.append({"motion": motion_result})

        return json.dumps({
            "project_id": project_id,
            "revision": revision,
            "steps": steps,
            "message": "프리비즈 계획을 적용했습니다. 앱에서 결과를 확인하고 수동 수정 후에는 get_project로 revision을 다시 읽으세요.",
        }, ensure_ascii=False)
    raise ValueError(f"Tool '{name}' is not recognized.")


def write(payload):
    sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def process(line):
    req = json.loads(line)
    req_id = req.get("id")
    method = req.get("method")
    if req_id is None:
        return
    if method == "initialize":
        write({
            "jsonrpc": "2.0",
            "id": req_id,
            "result": {
                "protocolVersion": "2024-11-05",
                "capabilities": {"tools": {}},
                "serverInfo": {"name": "FrisFramePrevisAuthoring", "version": core.APP_VERSION},
            },
        })
        return
    if method == "tools/list":
        write({"jsonrpc": "2.0", "id": req_id, "result": {"tools": TOOLS}})
        return
    if method == "tools/call":
        params = req.get("params") or {}
        name = params.get("name")
        args = params.get("arguments") or {}
        try:
            result = call_tool(name, args)
            write({
                "jsonrpc": "2.0",
                "id": req_id,
                "result": {"content": [{"type": "text", "text": result}], "isError": False},
            })
        except Exception as exc:
            core.log_debug(f"MCP previs command failed: {exc}")
            write({
                "jsonrpc": "2.0",
                "id": req_id,
                "result": {"content": [{"type": "text", "text": str(exc)}], "isError": True},
            })
        return
    write({"jsonrpc": "2.0", "id": req_id, "error": {"code": -32601, "message": "Method not found"}})


def main():
    core.log_debug("FrisFrame deterministic previs MCP server started.")
    core.log_debug(f"Active DB path resolved to: {core.get_db_path()}")
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            process(line)
        except Exception as exc:
            core.log_debug(f"Invalid MCP request: {exc}")


if __name__ == "__main__":
    main()
