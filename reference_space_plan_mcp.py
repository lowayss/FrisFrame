#!/usr/bin/env python3
"""Atomic full-reference plan tool layered over the deterministic Reference Space MCP core."""

from __future__ import annotations

import json

import mcp_previs_server as base
import mcp_server as core
import reference_space_core as space
import reference_space_mcp as reference
import reference_space_consistency_mcp as consistency


CAMERA_PLAN_SCHEMA = {
    "type": "object",
    "properties": {
        **reference.REFERENCE_CAMERA_PROPERTIES,
        "target_id": {"type": "string"},
        "anchor_id": {"type": "string"},
        "horizon_anchor_id": {"type": "string"},
        "label": {"type": "string"},
        "confidence": {"type": "number", "minimum": 0, "maximum": 1},
        "reference_dimensions_m": reference.REFERENCE_DIMENSIONS_SCHEMA,
        "apply_focal": {"type": "boolean"},
        "apply_tilt": {"type": "boolean"},
        "apply_distance": {"type": "boolean"},
        "orient_to_target": {"type": "boolean"},
        "allow_keyframed_base_camera": {"type": "boolean"},
    },
    "required": ["target_id", "physical_size_m"],
}

REFERENCE_SPACE_PLAN_TOOL = {
    "name": "apply_reference_space_plan",
    "description": (
        "외부 GPT/Claude/Codex가 확정한 Scale Anchor/카메라 보정과 큰 공간 Mass Blocking을 "
        "하나의 FrisFrame scene revision으로 원자 적용합니다. FrisFrame은 이미지를 분석하지 않습니다. "
        "선택적으로 여러 Scale Anchor의 shared-focal 일관성을 적용 전에 검사할 수 있습니다."
    ),
    "inputSchema": {
        "type": "object",
        "properties": {
            **base.COMMON_TARGET_PROPERTIES,
            "source_name": {"type": "string"},
            "camera_calibration": CAMERA_PLAN_SCHEMA,
            "masses": {
                "type": "array",
                "maxItems": 100,
                "items": {"type": "object"},
            },
            "consistency_anchors": {
                "type": "array",
                "minItems": 2,
                "maxItems": 32,
                "items": consistency.ANCHOR_SCHEMA,
            },
            "consistency_tolerance_ratio": {"type": "number", "minimum": 0, "maximum": 1},
            "consistency_expected_focal_mm": {"type": "number", "exclusiveMinimum": 0},
            "require_anchor_consistency": {"type": "boolean"},
            "allow_outside_stage": {"type": "boolean"},
            "validate_after_apply": {"type": "boolean"},
        },
        "required": ["project_id", "revision"],
    },
}

_PREVIOUS_CALL_TOOL = base.call_tool


def _camera_plan(blocking, camera_args):
    if not isinstance(camera_args, dict):
        return {"operations": [], "anchors": [], "summary": None}

    camera_keys = reference._camera_keyframes(blocking)
    if camera_keys and not bool(camera_args.get("allow_keyframed_base_camera", False)):
        raise ValueError(
            "camera-keyframes-present: 이 컷에는 카메라 키프레임이 있습니다. "
            "Reference Space plan이 베이스 카메라만 바꾸지 않도록 적용을 중단했습니다. "
            "calibrate_reference_camera 후 apply_motion_timeline으로 원하는 카메라 키를 명시적으로 수정하세요."
        )

    target_id = str(camera_args.get("target_id") or "").strip()
    target = base._find_item(blocking, target_id)
    axis = "width" if str(camera_args.get("axis", "height")).lower() == "width" else "height"
    physical_size_m = space.positive(camera_args.get("physical_size_m"), "physical_size_m")
    target_dims = reference._target_dimensions(
        target,
        axis,
        physical_size_m,
        camera_args.get("reference_dimensions_m"),
    )
    calibration = space.calibrate_reference_camera(camera_args, reference._camera_defaults(blocking))

    apply_focal = bool(camera_args.get("apply_focal", True))
    apply_tilt = bool(camera_args.get("apply_tilt", camera_args.get("horizon_y") is not None))
    apply_distance = bool(camera_args.get("apply_distance", True))
    orient_to_target = bool(camera_args.get("orient_to_target", False))

    if apply_focal and not calibration["applicable_to_frisframe_camera"]:
        raise ValueError(
            f"보정 focal {calibration['focal_mm']:.2f}mm가 FrisFrame 허용 범위 "
            f"{core.CAMERA_FOCAL_MIN}~{core.CAMERA_FOCAL_MAX}mm 밖입니다."
        )

    anchor_id = reference._anchor_id(camera_args.get("anchor_id"), f"scale-{target_id}")
    operations = [{
        "op": "update_dummy",
        "id": target_id,
        "anchor_id": anchor_id,
        "physical_dimensions_m": target_dims,
    }]
    camera_operation = {"op": "update_camera"}
    applied = {}

    if apply_focal:
        focal = int(round(calibration["focal_mm"]))
        focal = max(core.CAMERA_FOCAL_MIN, min(core.CAMERA_FOCAL_MAX, focal))
        camera_operation["focal"] = focal
        applied["focal_mm"] = focal

    if apply_tilt:
        if calibration.get("tilt_deg") is None:
            raise ValueError("camera_calibration.apply_tilt=true이면 horizon_y가 필요합니다.")
        camera_operation["tilt_deg"] = calibration["tilt_deg"]
        applied["tilt_deg"] = calibration["tilt_deg"]

    position = None
    if apply_distance:
        position = reference._camera_position_for_distance(
            blocking,
            target,
            target_dims,
            calibration["distance_m"],
        )
        camera_operation["x"] = position["x"]
        camera_operation["y"] = position["y"]
        applied["distance_m"] = calibration["distance_m"]
        applied["x"] = position["x"]
        applied["y"] = position["y"]

    if orient_to_target:
        current_camera = blocking.get("camera") or {}
        camera_x = camera_operation.get("x", current_camera.get("x", 0.5))
        camera_y = camera_operation.get("y", current_camera.get("y", 0.5))
        camera_operation["pan_deg"] = reference._pan_to_target(blocking, camera_x, camera_y, target)
        applied["pan_deg"] = camera_operation["pan_deg"]

    if len(camera_operation) > 1:
        operations.append(camera_operation)

    target_world_x, target_world_z = reference._world_xy(blocking, target)
    fraction = space.frame_fraction(camera_args)
    confidence = min(1.0, max(0.0, float(camera_args.get("confidence", 1.0))))
    anchors = [{
        "id": anchor_id,
        "label": str(camera_args.get("label") or target.get("name") or target_id)[:80],
        "kind": f"scale-{axis}",
        "image_x": float(camera_args.get("image_x", 0.5)),
        "image_y": float(camera_args.get("image_y", 0.5)),
        "image_width": fraction if axis == "width" else 0,
        "image_height": fraction if axis == "height" else 0,
        "world_x_m": target_world_x,
        "world_z_m": target_world_z,
        "physical_dimensions_m": target_dims,
        "confidence": confidence,
        "attached_item_id": target_id,
    }]

    if camera_args.get("horizon_y") is not None:
        anchors.append({
            "id": reference._anchor_id(camera_args.get("horizon_anchor_id"), "reference-horizon"),
            "label": "Reference horizon",
            "kind": "horizon",
            "image_x": 0.5,
            "image_y": float(camera_args["horizon_y"]),
            "confidence": confidence,
        })

    return {
        "operations": operations,
        "anchors": anchors,
        "summary": {
            "anchor_id": anchor_id,
            "target_id": target_id,
            "calibration": calibration,
            "applied": applied,
            "position_solution": position,
            "camera_keyframes_present": len(camera_keys),
            "keyframe_policy": "base-camera-only-explicit" if camera_keys else "base-camera-safe",
        },
    }


def _consistency_preflight(args, blocking, camera_plan):
    anchors = args.get("consistency_anchors") or []
    if not anchors:
        return None
    if not isinstance(anchors, list):
        raise ValueError("consistency_anchors는 배열이어야 합니다.")

    defaults = reference._camera_defaults(blocking)
    expected_focal = args.get("consistency_expected_focal_mm")
    if expected_focal is None and camera_plan.get("summary"):
        expected_focal = camera_plan["summary"]["calibration"].get("focal_mm")

    result = space.evaluate_scale_anchor_consistency(
        anchors,
        sensor_width_mm=defaults.get("sensor_width_mm", space.DEFAULT_SENSOR_WIDTH_MM),
        aspect=defaults.get("aspect", "16:9"),
        tolerance_ratio=args.get("consistency_tolerance_ratio", 0.08),
        expected_focal_mm=expected_focal,
    )
    if bool(args.get("require_anchor_consistency", True)) and not result["consistent"]:
        issue_ids = ", ".join(str(issue.get("id") or issue.get("code")) for issue in result["issues"][:5])
        raise ValueError(
            "reference-anchor-inconsistent: 여러 Scale Anchor가 같은 카메라 focal을 지지하지 않습니다. "
            f"적용 전 외부 분석의 크기/거리/화면 점유율을 다시 확인하세요. issues={issue_ids}"
        )
    return result


def _apply_reference_space_plan(args):
    blocking = reference._blocking(args)
    camera_args = args.get("camera_calibration")
    masses = args.get("masses") or []
    consistency_anchors = args.get("consistency_anchors") or []
    if camera_args is None and not masses:
        raise ValueError("camera_calibration 또는 masses 중 하나 이상이 필요합니다.")
    if camera_args is not None and not isinstance(camera_args, dict):
        raise ValueError("camera_calibration은 객체여야 합니다.")
    if not isinstance(masses, list):
        raise ValueError("masses는 배열이어야 합니다.")
    if consistency_anchors and not isinstance(consistency_anchors, list):
        raise ValueError("consistency_anchors는 배열이어야 합니다.")

    camera_plan = _camera_plan(blocking, camera_args)
    consistency_result = _consistency_preflight(args, blocking, camera_plan)

    mass_plan = {
        "stage": None,
        "operations": [],
        "anchors": [],
        "issues": [],
    }
    if masses:
        mass_plan = space.mass_block_plan(
            blocking,
            masses,
            bool(args.get("allow_outside_stage", False)),
        )

    camera_target_id = camera_plan.get("summary", {}).get("target_id") if camera_plan.get("summary") else None
    mass_ids = {str(anchor.get("id")) for anchor in mass_plan.get("anchors", [])}
    if camera_target_id and camera_target_id in mass_ids:
        raise ValueError(
            "camera_calibration.target_id와 masses.id가 같습니다. 한 대상에 Scale Anchor와 Mass 치수를 동시에 덮어쓰지 말고 입력을 하나로 정리하세요."
        )

    operations = list(camera_plan["operations"]) + list(mass_plan["operations"])
    anchors = list(camera_plan["anchors"]) + list(mass_plan["anchors"])
    if len(operations) > 200:
        raise ValueError("Reference Space plan 명령이 200개를 초과했습니다.")

    payload = base._target_args(args)
    payload["operations"] = operations
    payload["spatial_guide"] = reference._merge_guide(blocking, args.get("source_name"), anchors)
    result = base._json_result(core.handle_apply_scene_commands(args.get("project_id"), payload))
    if "revision" not in result:
        raise ValueError(result.get("raw", "Reference Space plan 적용 결과를 읽지 못했습니다."))

    result["reference_space_plan"] = {
        "camera": camera_plan["summary"],
        "anchor_consistency": consistency_result,
        "masses": [anchor["id"] for anchor in mass_plan.get("anchors", [])],
        "stage": mass_plan.get("stage"),
        "issues": mass_plan.get("issues", []),
        "operation_count": len(operations),
        "anchor_count": len(anchors),
        "atomic_revision": True,
    }

    if bool(args.get("validate_after_apply", True)):
        result["validation"] = reference._validate({
            "project_id": args.get("project_id"),
            "scene_index": int(args.get("scene_index", 0)),
            "cut_index": int(args.get("cut_index", 0)),
        })
    return result


def call_tool(name, args):
    if name == "apply_reference_space_plan":
        return json.dumps(_apply_reference_space_plan(args), ensure_ascii=False)
    return _PREVIOUS_CALL_TOOL(name, args)


def install():
    if getattr(base, "_reference_space_plan_extension_installed", False):
        return
    names = {tool.get("name") for tool in base.TOOLS}
    if REFERENCE_SPACE_PLAN_TOOL["name"] not in names:
        base.TOOLS.append(REFERENCE_SPACE_PLAN_TOOL)
    base.call_tool = call_tool
    base._reference_space_plan_extension_installed = True


install()
