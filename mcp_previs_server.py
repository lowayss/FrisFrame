#!/usr/bin/env python3
"""FrisFrame MCP entrypoint optimized for deterministic previs authoring.

This server intentionally exposes a small, explicit command surface for LLM/MCP clients.
It reuses the validated project mutation logic in mcp_server.py and does not call any AI API.
"""

import json
import sys

import mcp_server as core


SCENE_OPERATION_SCHEMA = {
    "oneOf": [
        {
            "type": "object",
            "properties": {
                "op": {"const": "add_dummy"},
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
                "size": {"type": "number", "minimum": 0.1, "maximum": 8},
                "scale_x": {"type": "number", "minimum": 0.05, "maximum": 20},
                "scale_y": {"type": "number", "minimum": 0.05, "maximum": 20},
                "scale_z": {"type": "number", "minimum": 0.05, "maximum": 20},
                "vertical_offset": {"type": "number"},
                "mounted_height": {"type": "number"},
                "color": {"type": "string", "pattern": "^#[0-9A-Fa-f]{6}$"},
                "visible": {"type": "boolean"},
                "anchor_id": {"type": "string"},
                "physical_dimensions_m": {
                    "type": "object",
                    "properties": {
                        "width": {"type": "number", "exclusiveMinimum": 0},
                        "height": {"type": "number", "exclusiveMinimum": 0},
                        "depth": {"type": "number", "exclusiveMinimum": 0}
                    }
                }
            },
            "required": ["op", "type", "name"]
        },
        {
            "type": "object",
            "properties": {
                "op": {"const": "update_dummy"},
                "id": {"type": "string"},
                "name": {"type": "string"},
                "dummy_type": {"type": "string"},
                "asset_type": {"type": "string"},
                "x": {"type": "number", "minimum": 0.02, "maximum": 0.98},
                "y": {"type": "number", "minimum": 0.02, "maximum": 0.98},
                "world_x_m": {"type": "number"},
                "world_z_m": {"type": "number"},
                "facing": {"type": "number"},
                "pitch": {"type": "number"},
                "size": {"type": "number", "minimum": 0.1, "maximum": 8},
                "scale_x": {"type": "number", "minimum": 0.05, "maximum": 20},
                "scale_y": {"type": "number", "minimum": 0.05, "maximum": 20},
                "scale_z": {"type": "number", "minimum": 0.05, "maximum": 20},
                "vertical_offset": {"type": "number"},
                "mounted_height": {"type": "number"},
                "visible": {"type": "boolean"},
                "anchor_id": {"type": "string"},
                "physical_dimensions_m": {"type": "object"}
            },
            "required": ["op", "id"]
        },
        {
            "type": "object",
            "properties": {
                "op": {"const": "remove_dummy"},
                "id": {"type": "string"}
            },
            "required": ["op", "id"]
        },
        {
            "type": "object",
            "properties": {
                "op": {"type": "string", "enum": ["set_camera", "update_camera"]},
                "x": {"type": "number", "minimum": 0.02, "maximum": 0.98},
                "y": {"type": "number", "minimum": 0.02, "maximum": 0.98},
                "height": {"type": "number", "minimum": 0.4, "maximum": 35},
                "pan_deg": {"type": "number"},
                "tilt_deg": {"type": "number", "minimum": -90, "maximum": 90},
                "focal": {"type": "integer", "minimum": 14, "maximum": 135}
            },
            "required": ["op"]
        }
    ]
}


MOTION_OPERATION_SCHEMA = {
    "oneOf": [
        {
            "type": "object",
            "properties": {
                "op": {"type": "string", "enum": ["add_keyframe", "set_pose_key", "set_motion_key"]},
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
                "path_mode": {"type": "string", "enum": ["straight", "horizontal", "vertical", "arc-left", "arc-right", "free-curve", "drone", "jib-up", "jib-down"]},
                "pose_preset": {"type": "string", "enum": sorted(core.MCP_POSE_PRESETS)},
                "body_pose": {"type": "object"},
                "label": {"type": "string"},
                "note": {"type": "string"}
            },
            "required": ["op", "source_id", "time"]
        },
        {
            "type": "object",
            "properties": {
                "op": {"type": "string", "enum": ["update_keyframe", "update_pose_key"]},
                "id": {"type": "string"},
                "source_id": {"type": "string"},
                "time": {"type": "number", "minimum": 0, "maximum": 60},
                "x": {"type": "number", "minimum": 0.02, "maximum": 0.98},
                "y": {"type": "number", "minimum": 0.02, "maximum": 0.98},
                "world_x_m": {"type": "number"},
                "world_z_m": {"type": "number"},
                "facing": {"type": "number"},
                "height": {"type": "number"},
                "pan_deg": {"type": "number"},
                "tilt_deg": {"type": "number", "minimum": -90, "maximum": 90},
                "focal": {"type": "integer", "minimum": 14, "maximum": 135},
                "transition": {"type": "string", "enum": ["smooth", "linear", "hold", "cut"]},
                "path_mode": {"type": "string", "enum": ["straight", "horizontal", "vertical", "arc-left", "arc-right", "free-curve", "drone", "jib-up", "jib-down"]},
                "pose_preset": {"type": "string", "enum": sorted(core.MCP_POSE_PRESETS)},
                "body_pose": {"type": "object"},
                "label": {"type": "string"},
                "note": {"type": "string"}
            },
            "required": ["op", "id", "time"]
        },
        {
            "type": "object",
            "properties": {"op": {"const": "remove_keyframe"}, "id": {"type": "string"}},
            "required": ["op", "id"]
        },
        {
            "type": "object",
            "properties": {"op": {"const": "clear_source_keys"}, "source_id": {"type": "string"}},
            "required": ["op", "source_id"]
        },
        {
            "type": "object",
            "properties": {"op": {"const": "set_duration"}, "duration": {"type": "number", "minimum": 1, "maximum": 60}},
            "required": ["op", "duration"]
        },
        {
            "type": "object",
            "properties": {
                "op": {"const": "set_export_range"},
                "start": {"type": "number", "minimum": 0, "maximum": 60},
                "end": {"type": "number", "minimum": 0, "maximum": 60}
            },
            "required": ["op", "start", "end"]
        }
    ]
}


COMMON_TARGET_PROPERTIES = {
    "project_id": {"type": "string", "description": "FrisFrame 프로젝트 ID"},
    "revision": {"type": "integer", "minimum": 1, "description": "직전 get_project 결과의 revision"},
    "scene_index": {"type": "integer", "minimum": 0, "default": 0},
    "cut_index": {"type": "integer", "minimum": 0, "default": 0}
}


TOOLS = [
    {
        "name": "list_projects",
        "description": "작업 가능한 FrisFrame 프로젝트와 revision을 조회합니다.",
        "inputSchema": {"type": "object", "properties": {}}
    },
    {
        "name": "get_project",
        "description": "MCP 수정 전에 프로젝트 전체 상태와 revision을 읽습니다. 수동 편집과 MCP 편집을 섞을 때 반드시 최신 상태를 다시 읽으세요.",
        "inputSchema": {
            "type": "object",
            "properties": {"project_id": {"type": "string"}},
            "required": ["project_id"]
        }
    },
    {
        "name": "apply_stage_layout",
        "description": "이미지 레퍼런스를 MCP 클라이언트가 해석한 뒤, 그 결과만 더미/소품/카메라/공간 앵커로 구현합니다. FrisFrame 자체는 이미지를 분석하지 않습니다.",
        "inputSchema": {
            "type": "object",
            "properties": {
                **COMMON_TARGET_PROPERTIES,
                "operations": {"type": "array", "minItems": 1, "maxItems": 200, "items": SCENE_OPERATION_SCHEMA},
                "spatial_guide": {
                    "type": "object",
                    "description": "레퍼런스 이미지에서 MCP가 확정한 구조 정보만 저장합니다. 이미지 파일 자체는 필요하지 않습니다.",
                    "properties": {
                        "source_name": {"type": "string"},
                        "status": {"type": "string", "enum": ["awaiting-plan", "applied"]},
                        "anchors": {"type": "array", "maxItems": 200, "items": {"type": "object"}},
                        "depth_layers": {"type": "array", "maxItems": 32, "items": {"type": "object"}}
                    }
                }
            },
            "required": ["project_id", "revision", "operations"]
        }
    },
    {
        "name": "apply_motion_timeline",
        "description": "카메라/배우/소품의 확정된 시간별 키프레임을 적용합니다. 복잡한 움직임도 명령을 여러 키로 분해해 정확하게 작성하며 자동 보조 동작은 만들지 않습니다.",
        "inputSchema": {
            "type": "object",
            "properties": {
                **COMMON_TARGET_PROPERTIES,
                "operations": {"type": "array", "minItems": 1, "maxItems": 200, "items": MOTION_OPERATION_SCHEMA}
            },
            "required": ["project_id", "revision", "operations"]
        }
    },
    {
        "name": "apply_previs_plan",
        "description": "한 요청에서 무대 배치와 키프레임 계획을 순서대로 적용하는 권장 도구입니다. 수동 편집 후에는 최신 revision을 읽고 호출하세요. AI API나 최종 영상 프롬프트 생성은 하지 않습니다.",
        "inputSchema": {
            "type": "object",
            "properties": {
                **COMMON_TARGET_PROPERTIES,
                "stage_operations": {"type": "array", "maxItems": 200, "items": SCENE_OPERATION_SCHEMA},
                "spatial_guide": {"type": "object"},
                "motion_operations": {"type": "array", "maxItems": 200, "items": MOTION_OPERATION_SCHEMA}
            },
            "required": ["project_id", "revision"]
        }
    }
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
        "cut_index": int(args.get("cut_index", 0))
    }


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
    if name == "apply_previs_plan":
        project_id = args.get("project_id")
        revision = int(args["revision"])
        steps = []
        stage_operations = args.get("stage_operations") or []
        spatial_guide = args.get("spatial_guide")
        motion_operations = args.get("motion_operations") or []
        if not stage_operations and spatial_guide is None and not motion_operations:
            raise ValueError("stage_operations, spatial_guide, motion_operations 중 하나 이상이 필요합니다.")
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
        if motion_operations:
            payload = _target_args(args, revision)
            payload["operations"] = motion_operations
            motion_result = _json_result(core.handle_apply_motion_commands(project_id, payload))
            if "revision" not in motion_result:
                raise ValueError(motion_result.get("raw", "모션 명령 적용 결과를 읽지 못했습니다."))
            revision = int(motion_result["revision"])
            steps.append({"motion": motion_result})
        return json.dumps({
            "project_id": project_id,
            "revision": revision,
            "steps": steps,
            "message": "프리비즈 계획을 적용했습니다. 앱에서 결과를 확인하고 수동 수정 후에는 get_project로 revision을 다시 읽으세요."
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
                "serverInfo": {"name": "FrisFramePrevisAuthoring", "version": core.APP_VERSION}
            }
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
                "result": {"content": [{"type": "text", "text": result}], "isError": False}
            })
        except Exception as exc:
            core.log_debug(f"MCP previs command failed: {exc}")
            write({
                "jsonrpc": "2.0",
                "id": req_id,
                "result": {"content": [{"type": "text", "text": str(exc)}], "isError": True}
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
