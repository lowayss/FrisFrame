#!/usr/bin/env python3
"""Read-only Physical Camera take context for FrisFrame's previs MCP server.

This extension intentionally does not compose a creative video prompt. It exposes
persisted Camera Operator take intent, archived camera-path motion and prompt
guardrails in compact payloads so the MCP client can browse and reuse a take
without scanning the entire project document.
"""

from __future__ import annotations

import json
import math

import mcp_previs_server as base
import mcp_server as core


CAMERA_TAKE_CONTEXT_TOOLS = [
    {
        "name": "list_camera_takes",
        "description": (
            "선택한 컷의 Physical Camera Take 목록을 읽기 전용으로 반환합니다. "
            "최근 Take부터 추적 방식·metric 여부·안정화·신뢰도·promptSeed와 cameraPath 보유 여부를 간단히 비교하고 "
            "FrisFrame UI에서 명시적으로 선택한 AI Take도 표시합니다."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "project_id": {"type": "string"},
                "scene_index": {"type": "integer", "minimum": 0, "default": 0},
                "cut_index": {"type": "integer", "minimum": 0, "default": 0},
                "limit": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 20,
                    "default": 20,
                    "description": "최근 Take부터 반환할 최대 개수.",
                },
            },
            "required": ["project_id"],
        },
    },
    {
        "name": "get_camera_take_context",
        "description": (
            "선택한 컷의 Physical Camera Take를 읽기 전용으로 요약합니다. "
            "명시적 take_id가 없으면 FrisFrame에서 AI 사용으로 선택한 Take, 그 다음 최신 Take를 사용합니다. "
            "저장된 promptSeed/promptPolicy, WebXR·Visual Flow metric 의미와 archived cameraPath 동작 요약을 그대로 반환합니다."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "project_id": {"type": "string"},
                "scene_index": {"type": "integer", "minimum": 0, "default": 0},
                "cut_index": {"type": "integer", "minimum": 0, "default": 0},
                "take_id": {
                    "type": "string",
                    "description": "특정 Camera Operator Take ID. 생략하면 UI selected Take → latest Take → 마지막 Take 순서로 사용합니다.",
                },
            },
            "required": ["project_id"],
        },
    },
]

_ORIGINAL_CALL_TOOL = base.call_tool


def _clone(value):
    return json.loads(json.dumps(value, ensure_ascii=False))


def _finite(value, fallback=0.0):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return float(fallback)
    return number if math.isfinite(number) else float(fallback)


def _rounded(value, digits=4):
    return round(_finite(value), digits)


def _normalize_angle(value):
    normalized = _finite(value) % 360.0
    return normalized + 360.0 if normalized < 0 else normalized


def _shortest_angle_delta(left, right):
    delta = _normalize_angle(right) - _normalize_angle(left)
    if delta > 180.0:
        delta -= 360.0
    if delta < -180.0:
        delta += 360.0
    return delta


def _project_payload(project_id):
    payload = base._json_result(core.handle_get_project(project_id))
    project = base._project_from_payload(payload)
    if not project:
        raise ValueError("프로젝트 문서에서 scenes를 찾지 못했습니다.")
    return payload, project


def _blocking_from_project(project, scene_index, cut_index):
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


def _valid_takes(motion):
    raw = motion.get("cameraOperatorTakes") if isinstance(motion, dict) else None
    if not isinstance(raw, list):
        return []
    return [entry for entry in raw if isinstance(entry, dict) and str(entry.get("id") or "").strip()]


def _select_take(motion, requested_take_id=None):
    takes = _valid_takes(motion)
    requested = str(requested_take_id or "").strip()
    selected_id = str(motion.get("selectedCameraOperatorTakeId") or "").strip() if isinstance(motion, dict) else ""
    latest_id = str(motion.get("latestCameraOperatorTakeId") or "").strip() if isinstance(motion, dict) else ""

    if requested:
        selected = next((entry for entry in takes if str(entry.get("id")) == requested), None)
        if not selected:
            raise ValueError(f"Camera Operator Take를 찾을 수 없습니다: {requested}")
        return selected, "requested-id", selected_id, latest_id, takes

    if selected_id:
        selected = next((entry for entry in takes if str(entry.get("id")) == selected_id), None)
        if selected:
            return selected, "selected-id", selected_id, latest_id, takes

    if latest_id:
        selected = next((entry for entry in takes if str(entry.get("id")) == latest_id), None)
        if selected:
            return selected, "latest-id", selected_id, latest_id, takes

    if takes:
        return takes[-1], "last-take-fallback", selected_id, latest_id, takes
    return None, "none", selected_id, latest_id, takes


def _camera_timeline(blocking):
    motion = blocking.get("motion") if isinstance(blocking.get("motion"), dict) else {}
    camera_keys = [
        key for key in motion.get("keyframes", [])
        if isinstance(key, dict) and str(key.get("source")) == "camera"
    ]
    times = sorted(float(key.get("time", 0)) for key in camera_keys)
    export_range = motion.get("exportRange") if isinstance(motion.get("exportRange"), dict) else None
    camera = blocking.get("camera") if isinstance(blocking.get("camera"), dict) else {}
    return {
        "keyframe_count": len(camera_keys),
        "first_time": times[0] if times else None,
        "last_time": times[-1] if times else None,
        "duration": motion.get("duration"),
        "export_range": _clone(export_range) if export_range else None,
        "base_camera": {
            "x": camera.get("x"),
            "y": camera.get("y"),
            "height": camera.get("height"),
            "panDeg": camera.get("panDeg"),
            "tiltDeg": camera.get("tiltDeg"),
            "focal": camera.get("focal"),
            "focusDistanceM": camera.get("focusDistanceM"),
        },
    }


def _pose_summary(pose):
    pose = pose if isinstance(pose, dict) else {}
    return {
        "x": _rounded(pose.get("x")),
        "y": _rounded(pose.get("y")),
        "height": _rounded(pose.get("height"), 3),
        "pan_deg": _rounded(_normalize_angle(pose.get("panDeg")), 3),
        "tilt_deg": _rounded(pose.get("tiltDeg"), 3),
        "focal_mm": _rounded(pose.get("focal", 35), 3),
    }


def _camera_path_summary(take):
    if not isinstance(take, dict):
        return {"available": False, "reason": "no-take"}
    path = take.get("cameraPath")
    if not isinstance(path, dict) or not isinstance(path.get("keyframes"), list):
        return {"available": False, "reason": "legacy-take-without-camera-path"}

    frames = []
    for raw in path.get("keyframes") or []:
        if not isinstance(raw, dict) or not isinstance(raw.get("pose"), dict):
            continue
        try:
            time_value = float(raw.get("time", 0))
        except (TypeError, ValueError):
            continue
        if not math.isfinite(time_value):
            continue
        frames.append({"time": time_value, "pose": raw["pose"]})
    frames.sort(key=lambda item: item["time"])
    if not frames:
        return {"available": False, "reason": "camera-path-has-no-valid-keyframes"}

    start = frames[0]
    end = frames[-1]
    start_pose = _pose_summary(start["pose"])
    end_pose = _pose_summary(end["pose"])

    pan_steps = [
        _shortest_angle_delta(frames[index - 1]["pose"].get("panDeg"), frames[index]["pose"].get("panDeg"))
        for index in range(1, len(frames))
    ]
    tilt_steps = [
        _finite(frames[index]["pose"].get("tiltDeg")) - _finite(frames[index - 1]["pose"].get("tiltDeg"))
        for index in range(1, len(frames))
    ]
    focal_steps = [
        _finite(frames[index]["pose"].get("focal", 35)) - _finite(frames[index - 1]["pose"].get("focal", 35))
        for index in range(1, len(frames))
    ]

    dx = end_pose["x"] - start_pose["x"]
    dy = end_pose["y"] - start_pose["y"]
    dh = end_pose["height"] - start_pose["height"]
    stage_distance = math.sqrt(dx * dx + dy * dy + dh * dh)
    pan_net = sum(pan_steps)
    tilt_net = end_pose["tilt_deg"] - start_pose["tilt_deg"]
    focal_net = end_pose["focal_mm"] - start_pose["focal_mm"]

    tracking = take.get("tracking") if isinstance(take.get("tracking"), dict) else {}
    translation = tracking.get("translation") if isinstance(tracking.get("translation"), dict) else {}
    policy = take.get("promptPolicy") if isinstance(take.get("promptPolicy"), dict) else {}
    translation_units = translation.get("units")
    metric_translation = (
        tracking.get("metric") is True
        and policy.get("metricDistanceAllowed") is True
        and translation_units == "meters-local-space"
    )

    actions = []
    if abs(pan_net) >= 0.05 or sum(abs(value) for value in pan_steps) >= 0.05:
        actions.append({
            "type": "pan",
            "net_deg": _rounded(pan_net, 3),
            "travel_deg": _rounded(sum(abs(value) for value in pan_steps), 3),
        })
    if abs(tilt_net) >= 0.05 or sum(abs(value) for value in tilt_steps) >= 0.05:
        actions.append({
            "type": "tilt",
            "net_deg": _rounded(tilt_net, 3),
            "travel_deg": _rounded(sum(abs(value) for value in tilt_steps), 3),
        })
    if abs(focal_net) >= 0.05 or sum(abs(value) for value in focal_steps) >= 0.05:
        actions.append({
            "type": "lens",
            "start_focal_mm": start_pose["focal_mm"],
            "end_focal_mm": end_pose["focal_mm"],
            "change_mm": _rounded(focal_net, 3),
            "fov_change": "narrower" if focal_net > 0 else "wider" if focal_net < 0 else "mixed",
        })
    for movement in ("dolly", "truck", "pedestal"):
        raw_value = translation.get(movement)
        if raw_value is None or abs(_finite(raw_value)) < 0.0001:
            continue
        actions.append({
            "type": movement,
            "value": _rounded(raw_value, 4),
            "units": translation_units,
            "metric": metric_translation,
        })

    return {
        "available": True,
        "source": "archived-camera-path",
        "fingerprint": path.get("fingerprint"),
        "keyframe_count": len(frames),
        "start_time": _rounded(start["time"], 6),
        "end_time": _rounded(end["time"], 6),
        "duration": _rounded(max(0.0, end["time"] - start["time"]), 6),
        "start_pose": start_pose,
        "end_pose": end_pose,
        "orientation": {
            "pan_net_deg": _rounded(pan_net, 3),
            "pan_travel_deg": _rounded(sum(abs(value) for value in pan_steps), 3),
            "tilt_net_deg": _rounded(tilt_net, 3),
            "tilt_travel_deg": _rounded(sum(abs(value) for value in tilt_steps), 3),
        },
        "lens": {
            "start_focal_mm": start_pose["focal_mm"],
            "end_focal_mm": end_pose["focal_mm"],
            "change_mm": _rounded(focal_net, 3),
            "travel_mm": _rounded(sum(abs(value) for value in focal_steps), 3),
        },
        "stage_displacement": {
            "x": _rounded(dx, 4),
            "y": _rounded(dy, 4),
            "height": _rounded(dh, 4),
            "distance": _rounded(stage_distance, 4),
            "units": "frisframe-stage-units",
            "physical_meters": False,
        },
        "tracked_translation": {
            "dolly": translation.get("dolly"),
            "truck": translation.get("truck"),
            "pedestal": translation.get("pedestal"),
            "units": translation_units,
            "metric": tracking.get("metric") is True,
            "exact_distance_allowed": metric_translation,
        },
        "metric_policy": {
            "camera_path_position_units": "frisframe-stage-units",
            "camera_path_position_is_physical_meters": False,
            "tracking_metric": tracking.get("metric") is True,
            "metric_distance_allowed": metric_translation,
            "distance_guard": policy.get("distanceGuard"),
        },
        "actions": actions,
    }


def _take_summary(take, record_index, selected_id, latest_id):
    tracking = take.get("tracking") if isinstance(take.get("tracking"), dict) else {}
    confidence = tracking.get("confidence") if isinstance(tracking.get("confidence"), dict) else {}
    translation = tracking.get("translation") if isinstance(tracking.get("translation"), dict) else {}
    prompt_policy = take.get("promptPolicy") if isinstance(take.get("promptPolicy"), dict) else {}
    samples = int(tracking.get("samples") or 0)
    held = int(tracking.get("heldTranslationSamples") or 0)
    take_id = str(take.get("id"))
    path_summary = _camera_path_summary(take)
    return {
        "id": take_id,
        "record_index": int(record_index),
        "is_latest": take_id == latest_id,
        "is_selected": take_id == selected_id,
        "source": take.get("source"),
        "created_at": take.get("createdAt"),
        "start_time": take.get("startTime"),
        "end_time": take.get("endTime"),
        "duration": take.get("duration"),
        "stabilization": take.get("stabilization"),
        "tracking": {
            "mode": tracking.get("mode"),
            "metric": tracking.get("metric") is True,
            "samples": samples,
            "confidence_average": confidence.get("average"),
            "held_translation_samples": held,
            "held_translation_ratio": (held / samples) if samples > 0 else 0,
            "translation_units": translation.get("units"),
        },
        "camera_path": {
            "available": path_summary.get("available") is True,
            "fingerprint": path_summary.get("fingerprint"),
            "keyframe_count": path_summary.get("keyframe_count", 0),
            "reason": path_summary.get("reason"),
        },
        "prompt_seed": take.get("promptSeed"),
        "metric_distance_allowed": prompt_policy.get("metricDistanceAllowed") is True,
    }


def list_camera_takes(args):
    project_id = str(args.get("project_id") or "").strip()
    if not project_id:
        raise ValueError("project_id가 필요합니다.")
    scene_index = int(args.get("scene_index", 0))
    cut_index = int(args.get("cut_index", 0))
    limit = max(1, min(20, int(args.get("limit", 20))))
    payload, project = _project_payload(project_id)
    blocking = _blocking_from_project(project, scene_index, cut_index)
    motion = blocking.get("motion") if isinstance(blocking.get("motion"), dict) else {}
    takes = _valid_takes(motion)
    selected_id = str(motion.get("selectedCameraOperatorTakeId") or "").strip()
    latest_id = str(motion.get("latestCameraOperatorTakeId") or "").strip()
    indexed = list(enumerate(takes))
    visible = list(reversed(indexed[-limit:]))
    items = [_take_summary(take, index, selected_id, latest_id) for index, take in visible]

    return {
        "schema": "frisframe-camera-take-list",
        "version": 1,
        "project_id": project_id,
        "revision": payload.get("revision"),
        "scene_index": scene_index,
        "cut_index": cut_index,
        "available": bool(takes),
        "selected_take_id": selected_id or None,
        "latest_take_id": latest_id or None,
        "total_count": len(takes),
        "returned_count": len(items),
        "items": items,
        "camera_timeline": _camera_timeline(blocking),
        "read_only": True,
        "final_prompt_owner": "mcp-client",
        "selection_priority": ["requested-id", "selected-id", "latest-id", "last-take-fallback"],
        "next_step": {
            "tool": "get_camera_take_context",
            "argument": "take_id",
            "instruction": "특정 Take를 강제로 사용할 때 items[].id를 take_id로 전달합니다. 생략하면 UI AI 선택 Take가 우선됩니다.",
        },
    }


def get_camera_take_context(args):
    project_id = str(args.get("project_id") or "").strip()
    if not project_id:
        raise ValueError("project_id가 필요합니다.")
    scene_index = int(args.get("scene_index", 0))
    cut_index = int(args.get("cut_index", 0))
    payload, project = _project_payload(project_id)
    blocking = _blocking_from_project(project, scene_index, cut_index)
    motion = blocking.get("motion") if isinstance(blocking.get("motion"), dict) else {}
    selected, selection, selected_id, latest_id, takes = _select_take(motion, args.get("take_id"))
    selected_copy = _clone(selected) if selected else None

    return {
        "schema": "frisframe-camera-take-context",
        "version": 1,
        "project_id": project_id,
        "revision": payload.get("revision"),
        "scene_index": scene_index,
        "cut_index": cut_index,
        "available": selected_copy is not None,
        "selection": {
            "strategy": selection,
            "requested_take_id": str(args.get("take_id") or "").strip() or None,
            "selected_take_id": selected_id or None,
            "latest_take_id": latest_id or None,
            "resolved_take_id": selected_copy.get("id") if selected_copy else None,
            "take_count": len(takes),
        },
        "take": selected_copy,
        "prompt_seed": selected_copy.get("promptSeed") if selected_copy else None,
        "prompt_policy": _clone(selected_copy.get("promptPolicy")) if selected_copy and isinstance(selected_copy.get("promptPolicy"), dict) else None,
        "camera_path_summary": _camera_path_summary(selected_copy),
        "camera_timeline": _camera_timeline(blocking),
        "read_only": True,
        "final_prompt_owner": "mcp-client",
    }


def call_tool(name, args):
    if name == "list_camera_takes":
        return json.dumps(list_camera_takes(args), ensure_ascii=False)
    if name == "get_camera_take_context":
        return json.dumps(get_camera_take_context(args), ensure_ascii=False)
    return _ORIGINAL_CALL_TOOL(name, args)


def install():
    if getattr(base, "_camera_take_context_extension_installed", False):
        return
    names = {tool.get("name") for tool in base.TOOLS}
    base.TOOLS.extend(tool for tool in CAMERA_TAKE_CONTEXT_TOOLS if tool["name"] not in names)
    base.call_tool = call_tool
    base._camera_take_context_extension_installed = True


install()
