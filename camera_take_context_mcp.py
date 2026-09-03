#!/usr/bin/env python3
"""Read-only Physical Camera take context for FrisFrame's previs MCP server.

This extension intentionally does not compose a creative video prompt. It exposes
persisted Camera Operator take intent and prompt guardrails in a compact payload
so the MCP client can reuse them without scanning the entire project document.
"""

from __future__ import annotations

import json

import mcp_previs_server as base
import mcp_server as core


CAMERA_TAKE_CONTEXT_TOOLS = [
    {
        "name": "get_camera_take_context",
        "description": (
            "선택한 컷의 Physical Camera Take를 읽기 전용으로 요약합니다. "
            "저장된 promptSeed/promptPolicy와 WebXR·Visual Flow metric 의미를 그대로 반환하며 "
            "FrisFrame 자체는 최종 생성 프롬프트를 만들거나 프로젝트를 수정하지 않습니다."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "project_id": {"type": "string"},
                "scene_index": {"type": "integer", "minimum": 0, "default": 0},
                "cut_index": {"type": "integer", "minimum": 0, "default": 0},
                "take_id": {
                    "type": "string",
                    "description": "특정 Camera Operator Take ID. 생략하면 latestCameraOperatorTakeId, 없으면 마지막 Take를 사용합니다.",
                },
            },
            "required": ["project_id"],
        },
    },
]

_ORIGINAL_CALL_TOOL = base.call_tool


def _clone(value):
    return json.loads(json.dumps(value, ensure_ascii=False))


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
    latest_id = str(motion.get("latestCameraOperatorTakeId") or "").strip() if isinstance(motion, dict) else ""

    if requested:
        selected = next((entry for entry in takes if str(entry.get("id")) == requested), None)
        if not selected:
            raise ValueError(f"Camera Operator Take를 찾을 수 없습니다: {requested}")
        return selected, "requested-id", latest_id, takes

    if latest_id:
        selected = next((entry for entry in takes if str(entry.get("id")) == latest_id), None)
        if selected:
            return selected, "latest-id", latest_id, takes

    if takes:
        return takes[-1], "last-take-fallback", latest_id, takes
    return None, "none", latest_id, takes


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


def get_camera_take_context(args):
    project_id = str(args.get("project_id") or "").strip()
    if not project_id:
        raise ValueError("project_id가 필요합니다.")
    scene_index = int(args.get("scene_index", 0))
    cut_index = int(args.get("cut_index", 0))
    payload, project = _project_payload(project_id)
    blocking = _blocking_from_project(project, scene_index, cut_index)
    motion = blocking.get("motion") if isinstance(blocking.get("motion"), dict) else {}
    selected, selection, latest_id, takes = _select_take(motion, args.get("take_id"))
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
            "latest_take_id": latest_id or None,
            "resolved_take_id": selected_copy.get("id") if selected_copy else None,
            "take_count": len(takes),
        },
        "take": selected_copy,
        "prompt_seed": selected_copy.get("promptSeed") if selected_copy else None,
        "prompt_policy": _clone(selected_copy.get("promptPolicy")) if selected_copy and isinstance(selected_copy.get("promptPolicy"), dict) else None,
        "camera_timeline": _camera_timeline(blocking),
        "read_only": True,
        "final_prompt_owner": "mcp-client",
    }


def call_tool(name, args):
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
