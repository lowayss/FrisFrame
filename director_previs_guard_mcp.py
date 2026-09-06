#!/usr/bin/env python3
"""Strict preflight guard for the Director Previs command layer.

This module does not own scene state. It only rejects malformed or stale
Director Previs requests before the existing deterministic orchestration runs.
"""

from __future__ import annotations

import json
import math

import director_previs_mcp as director
import mcp_previs_server as base
import mcp_server as core


POLICY = "director-previs-preflight-v1"


def _finite(value, label):
    try:
        number = float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{label} 값이 숫자가 아닙니다.") from exc
    if not math.isfinite(number):
        raise ValueError(f"{label} 값이 유효한 유한수가 아닙니다.")
    return number


def _transition(value, label):
    transition = str(value or "smooth").lower()
    if transition not in core.MCP_TRANSITIONS:
        raise ValueError(f"{label} 전환 방식이 올바르지 않습니다: {transition}")
    return transition


def _path_mode(value, label):
    mode = str(value or "straight").lower()
    if mode not in core.MCP_PATH_MODES:
        raise ValueError(f"{label} 경로 방식이 올바르지 않습니다: {mode}")
    return mode


def _positive_focus(value, label):
    distance = _finite(value, label)
    if distance <= 0:
        raise ValueError(f"{label}은 0보다 커야 합니다.")
    return distance


def _validate_actor_paths(args):
    paths = args.get("actor_paths")
    if paths is None:
        return
    if not isinstance(paths, list):
        raise ValueError("actor_paths는 배열이어야 합니다.")
    for index, path in enumerate(paths):
        if not isinstance(path, dict):
            raise ValueError(f"actor_paths[{index}]가 객체가 아닙니다.")
        default_transition = _transition(path.get("transition", "smooth"), f"actor_paths[{index}].transition")
        default_mode = _path_mode(path.get("path_mode", "straight"), f"actor_paths[{index}].path_mode")
        points = path.get("points") or []
        for point_index, point in enumerate(points):
            if not isinstance(point, dict):
                raise ValueError(f"actor_paths[{index}].points[{point_index}]가 객체가 아닙니다.")
            _transition(point.get("transition", default_transition), f"actor_paths[{index}].points[{point_index}].transition")
            _path_mode(point.get("path_mode", default_mode), f"actor_paths[{index}].points[{point_index}].path_mode")


def _validate_camera_path(args):
    path = args.get("camera_path")
    if path is None:
        return
    if not isinstance(path, dict):
        raise ValueError("camera_path는 객체여야 합니다.")
    default_transition = _transition(path.get("transition", "smooth"), "camera_path.transition")
    default_mode = _path_mode(path.get("path_mode", "straight"), "camera_path.path_mode")
    points = path.get("points") or []
    for index, point in enumerate(points):
        if not isinstance(point, dict):
            raise ValueError(f"camera_path.points[{index}]가 객체가 아닙니다.")
        _transition(point.get("transition", default_transition), f"camera_path.points[{index}].transition")
        _path_mode(point.get("path_mode", default_mode), f"camera_path.points[{index}].path_mode")
        if point.get("focus_distance_m") is not None:
            _positive_focus(point.get("focus_distance_m"), f"camera_path.points[{index}].focus_distance_m")
        for unsupported in ("tracking_target_id", "locks"):
            if unsupported in point:
                raise ValueError(f"camera_path.points[{index}].{unsupported}는 시간 경로에서 지원하지 않습니다. static camera에 지정하세요.")


def _validate_timeline(args):
    timeline = args.get("timeline")
    if timeline is None:
        return
    if not isinstance(timeline, dict):
        raise ValueError("timeline은 객체여야 합니다.")
    blocking = base._load_blocking(
        args.get("project_id"),
        int(args.get("scene_index", 0)),
        int(args.get("cut_index", 0)),
    )
    current_duration = _finite((blocking.get("motion") or {}).get("duration", 15), "timeline.current_duration")
    duration = timeline.get("duration_sec")
    if duration is None:
        duration = current_duration
    else:
        duration = _finite(duration, "timeline.duration_sec")
        if duration < 1 or duration > core.MAX_TIMELINE_DURATION:
            raise ValueError("timeline.duration_sec가 허용 범위를 벗어났습니다.")
    start = timeline.get("export_start_sec")
    end = timeline.get("export_end_sec")
    if start is None and end is None:
        return
    start = 0.0 if start is None else _finite(start, "timeline.export_start_sec")
    end = duration if end is None else _finite(end, "timeline.export_end_sec")
    if start < 0 or end > duration or end <= start:
        raise ValueError("timeline export range가 현재/요청 duration 범위를 벗어났습니다.")


def preflight(args):
    if not isinstance(args, dict):
        raise ValueError("Director Previs 인자는 객체여야 합니다.")
    _validate_actor_paths(args)
    _validate_camera_path(args)
    _validate_timeline(args)
    return {"valid": True, "policy": POLICY}


def _check_revision(args):
    try:
        requested = int(args.get("revision"))
    except (TypeError, ValueError) as exc:
        raise ValueError("revision이 필요합니다.") from exc
    payload = base._json_result(core.handle_get_project(args.get("project_id")))
    current = int(payload.get("revision") or 0)
    if requested != current:
        raise ValueError(f"revision_conflict: 현재 revision은 {current}입니다. 프로젝트를 다시 불러와 주세요.")


def _tighten_camera_path_schema():
    allowed = {
        "time_sec", "world_x_m", "world_z_m", "height_m", "pan_deg", "tilt_deg",
        "focal_mm", "focus_distance_m", "transition", "path_mode",
    }
    for tool in base.TOOLS:
        if tool.get("name") not in {"validate_director_previs_plan", "apply_director_previs_plan"}:
            continue
        schema = tool.get("inputSchema") or {}
        camera_path = (schema.get("properties") or {}).get("camera_path") or {}
        points = (camera_path.get("properties") or {}).get("points") or {}
        item = points.get("items") or {}
        properties = item.get("properties")
        if not isinstance(properties, dict):
            continue
        for key in list(properties):
            if key not in allowed:
                properties.pop(key, None)


_PREVIOUS_CALL_TOOL = base.call_tool


def call_tool(name, args):
    if name == "validate_director_previs_plan":
        preflight(args)
        return _PREVIOUS_CALL_TOOL(name, args)
    if name == "apply_director_previs_plan":
        _check_revision(args)
        preflight(args)
        return _PREVIOUS_CALL_TOOL(name, args)
    if name == "get_director_previs_contract":
        payload = json.loads(_PREVIOUS_CALL_TOOL(name, args))
        if isinstance(payload, dict):
            payload["preflight"] = {
                "policy": POLICY,
                "stale_revision_first": True,
                "strict_transition_and_path_mode": True,
                "positive_camera_path_focus": True,
                "export_range_uses_current_or_requested_duration": True,
                "camera_path_static_only_fields_rejected": ["tracking_target_id", "locks"],
            }
        return json.dumps(payload, ensure_ascii=False)
    return _PREVIOUS_CALL_TOOL(name, args)


def install():
    if getattr(base, "_director_previs_guard_installed", False):
        return
    _tighten_camera_path_schema()
    base.call_tool = call_tool
    base._director_previs_guard_installed = True


install()
