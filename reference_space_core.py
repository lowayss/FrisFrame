#!/usr/bin/env python3
"""Deterministic Reference Space math shared by FrisFrame MCP integration."""

from __future__ import annotations

import math

CAMERA_FOCAL_MIN = 14.0
CAMERA_FOCAL_MAX = 135.0
DEFAULT_SENSOR_WIDTH_MM = 36.0
STAGE_LONG_EDGE_M = 36.0
ASPECTS = {"16:9": 16 / 9, "9:16": 9 / 16, "4:3": 4 / 3, "1:1": 1.0, "3:4": 3 / 4}


def positive(value, name):
    try:
        number = float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{name} 값이 숫자가 아닙니다.") from exc
    if not math.isfinite(number) or number <= 0:
        raise ValueError(f"{name} 값은 0보다 커야 합니다.")
    return number


def optional_positive(value, name):
    return None if value is None or value == "" else positive(value, name)


def aspect_value(value):
    if isinstance(value, str):
        return ASPECTS.get(value, ASPECTS["16:9"])
    return positive(value, "aspect")


def stage_dimensions(aspect="16:9"):
    ratio = aspect_value(aspect)
    return (STAGE_LONG_EDGE_M, STAGE_LONG_EDGE_M / ratio) if ratio >= 1 else (STAGE_LONG_EDGE_M * ratio, STAGE_LONG_EDGE_M)


def frame_fraction(data):
    direct = optional_positive(data.get("frame_fraction"), "frame_fraction")
    if direct is not None:
        return direct
    measured = optional_positive(data.get("measured_pixels"), "measured_pixels")
    image_axis = optional_positive(data.get("image_axis_pixels"), "image_axis_pixels")
    if measured is None or image_axis is None:
        raise ValueError("frame_fraction 또는 measured_pixels + image_axis_pixels가 필요합니다.")
    return measured / image_axis


def calibrate_reference_camera(data, defaults=None):
    defaults = defaults or {}
    axis = "width" if str(data.get("axis", "height")).lower() == "width" else "height"
    physical_size_m = positive(data.get("physical_size_m"), "physical_size_m")
    fraction = frame_fraction(data)
    focal_mm = optional_positive(data.get("focal_mm", defaults.get("focal_mm")), "focal_mm")
    distance_m = optional_positive(data.get("distance_m"), "distance_m")
    sensor_width_mm = positive(data.get("sensor_width_mm", defaults.get("sensor_width_mm", DEFAULT_SENSOR_WIDTH_MM)), "sensor_width_mm")
    aspect = aspect_value(data.get("aspect", defaults.get("aspect", "16:9")))
    if focal_mm is None and distance_m is None:
        raise ValueError("distance_m 또는 focal_mm 중 하나가 필요합니다.")

    sensor_height_mm = sensor_width_mm / aspect
    sensor_axis_mm = sensor_width_mm if axis == "width" else sensor_height_mm
    if distance_m is None:
        distance_m = physical_size_m * focal_mm / (fraction * sensor_axis_mm)
    if focal_mm is None:
        focal_mm = fraction * distance_m * sensor_axis_mm / physical_size_m

    predicted = physical_size_m * focal_mm / (distance_m * sensor_axis_mm)
    result = {
        "schema": "frisframe-reference-camera-calibration",
        "version": 1,
        "axis": axis,
        "physical_size_m": physical_size_m,
        "frame_fraction": fraction,
        "focal_mm": focal_mm,
        "distance_m": distance_m,
        "sensor_width_mm": sensor_width_mm,
        "aspect": aspect,
        "horizontal_fov_deg": math.degrees(2 * math.atan(sensor_width_mm / (2 * focal_mm))),
        "vertical_fov_deg": math.degrees(2 * math.atan(sensor_height_mm / (2 * focal_mm))),
        "predicted_frame_fraction": predicted,
        "frame_residual": fraction - predicted,
        "applicable_to_frisframe_camera": CAMERA_FOCAL_MIN <= focal_mm <= CAMERA_FOCAL_MAX,
        "warnings": [],
    }
    if not result["applicable_to_frisframe_camera"]:
        result["warnings"].append({"code": "focal-outside-frisframe-range", "value": focal_mm, "allowed": [CAMERA_FOCAL_MIN, CAMERA_FOCAL_MAX]})
    if data.get("horizon_y") is not None:
        horizon_y = min(1.0, max(0.0, float(data["horizon_y"])))
        result["horizon_y"] = horizon_y
        # FrisFrame cameraDirectionVector uses y = sin(tilt): negative tilt looks down.
        # A downward-looking camera moves the horizon above frame center (Y < 0.5).
        result["tilt_deg"] = math.degrees(math.atan(((horizon_y - 0.5) * sensor_height_mm) / focal_mm))
    if data.get("image_x") is not None:
        image_x = min(1.0, max(0.0, float(data["image_x"])))
        result["image_x"] = image_x
        result["horizontal_angle_deg"] = math.degrees(math.atan(((image_x - 0.5) * sensor_width_mm) / focal_mm))
    return result


def mass_bounds(mass):
    width = positive(mass.get("width_m"), "width_m")
    depth = positive(mass.get("depth_m"), "depth_m")
    x = float(mass.get("world_x_m"))
    z = float(mass.get("world_z_m"))
    rotation = math.radians(float(mass.get("rotation_deg", 0)))
    extent_x = abs(math.cos(rotation)) * width / 2 + abs(math.sin(rotation)) * depth / 2
    extent_z = abs(math.sin(rotation)) * width / 2 + abs(math.cos(rotation)) * depth / 2
    return {"min_x": x - extent_x, "max_x": x + extent_x, "min_z": z - extent_z, "max_z": z + extent_z}


def mass_block_plan(blocking, masses, allow_outside_stage=False):
    if not isinstance(masses, list) or not masses:
        raise ValueError("masses 배열을 하나 이상 넣어 주세요.")
    if len(masses) > 100:
        raise ValueError("한 번에 적용할 수 있는 mass는 100개까지입니다.")
    stage_width, stage_depth = stage_dimensions(blocking.get("aspect", "16:9"))
    half_width, half_depth = stage_width / 2, stage_depth / 2
    existing = {str(item.get("id")): item for item in blocking.get("items", [])}
    operations, anchors, issues = [], [], []
    for index, mass in enumerate(masses):
        if not isinstance(mass, dict):
            raise ValueError(f"masses[{index}]가 객체가 아닙니다.")
        mass_id = str(mass.get("id") or "").strip()
        if not mass_id or len(mass_id) > 64 or any(not (ch.isalnum() or ch in "_-") for ch in mass_id):
            raise ValueError(f"masses[{index}].id는 영문/숫자/_/- 64자 이하여야 합니다.")
        x, z = float(mass.get("world_x_m")), float(mass.get("world_z_m"))
        if not math.isfinite(x) or not math.isfinite(z):
            raise ValueError(f"masses[{index}] world 좌표가 유효하지 않습니다.")
        dims = {
            "width": positive(mass.get("width_m"), f"masses[{index}].width_m"),
            "height": positive(mass.get("height_m"), f"masses[{index}].height_m"),
            "depth": positive(mass.get("depth_m"), f"masses[{index}].depth_m"),
        }
        bounds = mass_bounds(mass)
        outside = bounds["min_x"] < -half_width or bounds["max_x"] > half_width or bounds["min_z"] < -half_depth or bounds["max_z"] > half_depth
        if outside:
            issues.append({"code": "mass-outside-stage", "id": mass_id, "bounds": bounds})
            if not allow_outside_stage:
                raise ValueError(f"mass '{mass_id}'가 현재 {stage_width:.2f}m × {stage_depth:.2f}m 무대 밖으로 나갑니다.")
        if mass_id in existing and existing[mass_id].get("type") != "prop":
            raise ValueError(f"mass id '{mass_id}'가 기존 배우 ID와 충돌합니다.")
        operations.append({
            "op": "update_dummy" if mass_id in existing else "add_dummy",
            "id": mass_id,
            "type": "prop",
            "name": str(mass.get("name") or mass.get("role") or mass_id)[:80],
            "asset_type": str(mass.get("asset_type") or "box"),
            "world_x_m": x,
            "world_z_m": z,
            "facing": float(mass.get("rotation_deg", 0)),
            "mounted_height": float(mass.get("mounted_height_m", 0)),
            "anchor_id": mass_id,
            "physical_dimensions_m": dims,
            "visible": True,
        })
        anchors.append({
            "id": mass_id,
            "label": str(mass.get("name") or mass.get("role") or mass_id)[:80],
            "kind": "structure",
            "world_x_m": x,
            "world_z_m": z,
            "physical_dimensions_m": dims,
            "depth_layer": str(mass.get("depth_layer") or "")[:48],
            "confidence": min(1.0, max(0.0, float(mass.get("confidence", 1.0)))),
            "attached_item_id": mass_id,
        })
    return {"stage": {"width": stage_width, "depth": stage_depth}, "operations": operations, "anchors": anchors, "issues": issues}


def predicted_frame_fraction(physical_size_m, distance_m, focal_mm, sensor_width_mm, aspect, axis="height"):
    sensor_axis = sensor_width_mm if axis == "width" else sensor_width_mm / aspect
    return positive(physical_size_m, "physical_size_m") * positive(focal_mm, "focal_mm") / (positive(distance_m, "distance_m") * positive(sensor_axis, "sensor_axis_mm"))


def horizon_from_tilt(tilt_deg, focal_mm, sensor_width_mm, aspect):
    sensor_height = positive(sensor_width_mm, "sensor_width_mm") / aspect_value(aspect)
    return 0.5 + math.tan(math.radians(float(tilt_deg))) * positive(focal_mm, "focal_mm") / sensor_height
