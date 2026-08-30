#!/usr/bin/env python3
"""Explicit opt-in camera orientation tools for Reference Space screen observations."""

from __future__ import annotations

import json
import math

import mcp_previs_server as base
import mcp_server as core
import reference_space_core as space
import reference_space_mcp as reference


ORIENTATION_PROPERTIES = {
    "project_id": {"type": "string"},
    "scene_index": {"type": "integer", "minimum": 0},
    "cut_index": {"type": "integer", "minimum": 0},
    "target_id": {"type": "string"},
    "image_x": {"type": "number", "minimum": 0, "maximum": 1},
    "image_y": {"type": "number", "minimum": 0, "maximum": 1},
    "horizon_tolerance": {"type": "number", "minimum": 0, "maximum": 1},
}

REFERENCE_ORIENTATION_TOOLS = [
    {
        "name": "solve_reference_camera_orientation",
        "description": (
            "외부 분석이 준 target 화면 중심 image_x/image_y를 현재 FrisFrame 카메라 위치와 렌즈에서 만족하도록 "
            "pan/tilt를 결정론적으로 계산합니다. 프로젝트를 수정하지 않습니다."
        ),
        "inputSchema": {
            "type": "object",
            "properties": ORIENTATION_PROPERTIES,
            "required": ["project_id", "target_id", "image_x", "image_y"],
        },
    },
    {
        "name": "apply_reference_camera_orientation",
        "description": (
            "solve_reference_camera_orientation 결과와 같은 방식으로 명시적 screen X/Y 관측을 카메라 pan/tilt에 적용합니다. "
            "카메라 키프레임과 기존 Horizon 관측은 기본적으로 보호합니다."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                **ORIENTATION_PROPERTIES,
                "revision": {"type": "integer", "minimum": 1},
                "allow_keyframed_base_camera": {"type": "boolean"},
                "allow_horizon_mismatch": {"type": "boolean"},
            },
            "required": ["project_id", "revision", "target_id", "image_x", "image_y"],
        },
    },
]

_PREVIOUS_CALL_TOOL = base.call_tool


def _image_coordinate(value, name):
    try:
        number = float(value)
    except (TypeError, ValueError) as error:
        raise ValueError(f"{name} 값이 숫자가 아닙니다.") from error
    if not math.isfinite(number) or number < 0 or number > 1:
        raise ValueError(f"{name} 값은 0~1 사이여야 합니다.")
    return number


def _angle_distance_degrees(left, right):
    return abs(((float(left) - float(right) + 180.0) % 360.0) - 180.0)


def _camera_and_target_world(blocking, target):
    camera = blocking.get("camera") or {}
    stage_width, stage_depth = space.stage_dimensions(blocking.get("aspect", "16:9"))
    target_world_x, target_world_z = reference._world_xy(blocking, target)
    return (
        {
            "x": (float(camera.get("x", 0.5)) - 0.5) * stage_width,
            "y": float(camera.get("height", 1.6)),
            "z": (float(camera.get("y", 0.5)) - 0.5) * stage_depth,
        },
        {
            "x": target_world_x,
            "y": reference._target_center_height(target),
            "z": target_world_z,
        },
    )


def _solve_orientation(args, blocking=None):
    blocking = blocking or reference._blocking(args)
    target_id = str(args.get("target_id") or "").strip()
    target = base._find_item(blocking, target_id)
    image_x = _image_coordinate(args.get("image_x"), "image_x")
    image_y = _image_coordinate(args.get("image_y"), "image_y")
    camera = blocking.get("camera") or {}
    defaults = reference._camera_defaults(blocking)
    focal = space.positive(defaults["focal_mm"], "focal_mm")
    sensor_width = space.positive(defaults["sensor_width_mm"], "sensor_width_mm")
    aspect = space.aspect_value(defaults["aspect"])
    sensor_height = sensor_width / aspect
    camera_position, target_position = _camera_and_target_world(blocking, target)

    delta_x = target_position["x"] - camera_position["x"]
    delta_y = target_position["y"] - camera_position["y"]
    delta_z = target_position["z"] - camera_position["z"]
    distance = math.sqrt(delta_x * delta_x + delta_y * delta_y + delta_z * delta_z)
    if distance <= 1e-6:
        raise ValueError("target 중심과 카메라 위치가 같아 화면 방향을 계산할 수 없습니다.")
    direction_x = delta_x / distance
    direction_y = delta_y / distance
    direction_z = delta_z / distance

    right_ratio = (image_x - 0.5) * sensor_width / focal
    up_ratio = (0.5 - image_y) * sensor_height / focal
    local_length = math.sqrt(1.0 + right_ratio * right_ratio + up_ratio * up_ratio)
    vertical_length = math.sqrt(1.0 + up_ratio * up_ratio)
    sine_value = direction_y * local_length / vertical_length
    if abs(sine_value) > 1.0 + 1e-9:
        raise ValueError(
            "요청한 screen X/Y와 현재 카메라/target 높이 관계를 roll=0 FrisFrame 카메라로 동시에 만족할 수 없습니다."
        )
    sine_value = max(-1.0, min(1.0, sine_value))
    phase = math.atan(up_ratio)
    principal = math.asin(sine_value)
    candidates = [principal - phase, math.pi - principal - phase]
    normalized = [((value + math.pi) % (2.0 * math.pi)) - math.pi for value in candidates]
    valid = [value for value in normalized if -math.pi / 2 - 1e-9 <= value <= math.pi / 2 + 1e-9]
    if not valid:
        raise ValueError("FrisFrame tilt 범위(-90~90°) 안에서 요청한 screen Y를 만족할 수 없습니다.")

    current_tilt = float(camera.get("tiltDeg", 0))
    tilt = min(valid, key=lambda value: abs(math.degrees(value) - current_tilt))
    horizontal_forward = math.cos(tilt) - up_ratio * math.sin(tilt)
    target_azimuth = math.atan2(direction_z, direction_x)
    pan = (target_azimuth - math.atan2(right_ratio, horizontal_forward)) % (2.0 * math.pi)
    pan_deg = math.degrees(pan)
    tilt_deg = math.degrees(tilt)

    projection = space.project_world_point_to_frame(
        camera_position,
        target_position,
        pan_deg=pan_deg,
        tilt_deg=tilt_deg,
        focal_mm=focal,
        sensor_width_mm=sensor_width,
        aspect=aspect,
    )
    residual_x = None if projection["frame_x"] is None else image_x - projection["frame_x"]
    residual_y = None if projection["frame_y"] is None else image_y - projection["frame_y"]
    if residual_x is None or residual_y is None or abs(residual_x) > 1e-8 or abs(residual_y) > 1e-8:
        raise ValueError("screen orientation 해를 현재 카메라 projection으로 재검증하지 못했습니다.")

    persisted_horizon = reference._persisted_horizon(
        blocking.get("spatialGuide") if isinstance(blocking.get("spatialGuide"), dict) else {}
    )
    solved_horizon = space.horizon_from_tilt(tilt_deg, focal, sensor_width, aspect)
    horizon_tolerance = float(args.get("horizon_tolerance", 0.03))
    if not math.isfinite(horizon_tolerance) or horizon_tolerance < 0 or horizon_tolerance > 1:
        raise ValueError("horizon_tolerance은 0~1 사이여야 합니다.")
    horizon_residual = None if persisted_horizon is None else persisted_horizon - solved_horizon

    return {
        "schema": "frisframe-reference-camera-orientation",
        "version": 1,
        "target_id": target_id,
        "observed": {"image_x": image_x, "image_y": image_y},
        "camera_position": camera_position,
        "target_position": target_position,
        "distance_m": distance,
        "focal_mm": focal,
        "sensor_width_mm": sensor_width,
        "aspect": aspect,
        "current": {
            "pan_deg": float(camera.get("panDeg", 180)),
            "tilt_deg": current_tilt,
        },
        "solved": {
            "pan_deg": pan_deg,
            "tilt_deg": tilt_deg,
            "pan_delta_deg": _angle_distance_degrees(pan_deg, camera.get("panDeg", 180)),
            "tilt_delta_deg": tilt_deg - current_tilt,
        },
        "projection_check": {
            "predicted_x": projection["frame_x"],
            "predicted_y": projection["frame_y"],
            "residual_x": residual_x,
            "residual_y": residual_y,
            "depth_m": projection["depth_m"],
            "in_front": projection["in_front"],
            "in_frame": projection["in_frame"],
        },
        "horizon_check": {
            "persisted_y": persisted_horizon,
            "solved_y": solved_horizon,
            "residual": horizon_residual,
            "tolerance": horizon_tolerance,
            "consistent": persisted_horizon is None or abs(horizon_residual) <= horizon_tolerance,
        },
        "application_policy": "explicit-opt-in-camera-orientation",
    }


def _apply_orientation(args):
    blocking = reference._blocking(args)
    camera_keys = reference._camera_keyframes(blocking)
    if camera_keys and not bool(args.get("allow_keyframed_base_camera", False)):
        raise ValueError(
            "camera-keyframes-present: 이 컷에는 카메라 키프레임이 있습니다. "
            "베이스 카메라 방향만 바꾸면 기존 프리비즈 타이밍과 달라질 수 있으므로 적용을 중단했습니다."
        )
    solution = _solve_orientation(args, blocking)
    horizon_check = solution["horizon_check"]
    if not horizon_check["consistent"] and not bool(args.get("allow_horizon_mismatch", False)):
        raise ValueError(
            "reference-horizon-conflict: 요청한 screen X/Y를 맞추는 tilt가 저장된 Horizon 관측과 충돌합니다. "
            "외부 분석을 다시 확인하거나 allow_horizon_mismatch=true를 명시하세요."
        )

    payload = base._target_args(args)
    payload["operations"] = [{
        "op": "update_camera",
        "pan_deg": solution["solved"]["pan_deg"],
        "tilt_deg": solution["solved"]["tilt_deg"],
    }]
    result = base._json_result(core.handle_apply_scene_commands(args.get("project_id"), payload))
    if "revision" not in result:
        raise ValueError(result.get("raw", "Reference camera orientation 적용 결과를 읽지 못했습니다."))
    result["reference_camera_orientation"] = solution
    result["validation"] = reference._validate({
        "project_id": args.get("project_id"),
        "scene_index": int(args.get("scene_index", 0)),
        "cut_index": int(args.get("cut_index", 0)),
    })
    return result


def call_tool(name, args):
    if name == "solve_reference_camera_orientation":
        return json.dumps(_solve_orientation(args), ensure_ascii=False)
    if name == "apply_reference_camera_orientation":
        return json.dumps(_apply_orientation(args), ensure_ascii=False)
    return _PREVIOUS_CALL_TOOL(name, args)


def install():
    if getattr(base, "_reference_space_orientation_extension_installed", False):
        return
    names = {tool.get("name") for tool in base.TOOLS}
    base.TOOLS.extend(tool for tool in REFERENCE_ORIENTATION_TOOLS if tool["name"] not in names)
    base.call_tool = call_tool
    base._reference_space_orientation_extension_installed = True


install()
