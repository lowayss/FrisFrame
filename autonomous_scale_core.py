#!/usr/bin/env python3
"""Autonomous global metric-scale inference for FrisFrame reference reconstruction.

The absolute scale of a single image is underconstrained. FrisFrame therefore
uses a robust consensus of familiar real-world object-size priors instead of
pretending a single visual measurement is exact. The result is an inferred
meters-per-provisional-unit scale with provenance, confidence and per-candidate
residuals. User-fixed metric evidence always outranks these priors.
"""

from __future__ import annotations

import copy
import math


POLICY = "autonomous-object-prior-scale-v1"
DEFAULT_MIN_CONFIDENCE = 0.58

# target meters and a relative trust weight. Only dimensions that are reasonably
# stable across common real spaces are included. Highly style-dependent widths
# are deliberately weak or omitted.
OBJECT_PRIORS = {
    "door": {
        "width_m": (0.90, 1.00),
        "height_m": (2.05, 1.10),
    },
    "window": {
        "height_m": (1.20, 0.42),
    },
    "chair": {
        "height_m": (0.90, 0.48),
        "depth_m": (0.55, 0.42),
    },
    "sofa": {
        "height_m": (0.86, 0.62),
        "depth_m": (0.90, 0.82),
        "width_m": (2.10, 0.34),
    },
    "bed": {
        "depth_m": (2.00, 0.95),
        "height_m": (0.62, 0.34),
    },
    "counter": {
        "height_m": (0.90, 0.95),
        "depth_m": (0.65, 0.60),
    },
    "cabinet": {
        "depth_m": (0.55, 0.46),
    },
    "refrigerator": {
        "height_m": (1.85, 0.92),
        "depth_m": (0.72, 0.58),
    },
    "stove": {
        "height_m": (0.90, 0.80),
        "depth_m": (0.65, 0.52),
    },
    "toilet": {
        "depth_m": (0.70, 0.48),
    },
    "bathtub": {
        "width_m": (1.70, 0.70),
        "depth_m": (0.80, 0.40),
    },
}

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
    "sink": "sink",
    "toilet": "toilet",
    "bathtub": "bathtub",
    "refrigerator": "refrigerator",
    "stove": "stove",
    "television": "television",
}

OBJECT_SCALE_KEYS = (
    "world_x_m", "world_z_m", "width_m", "height_m", "depth_m",
    "mounted_height_m", "start_x_m", "start_z_m", "end_x_m", "end_z_m",
    "thickness_m",
)


def _finite(value, fallback=None):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return fallback
    return number if math.isfinite(number) else fallback


def _kind(entry):
    explicit = str((entry or {}).get("kind") or "").strip()
    if explicit:
        return explicit
    return ASSET_KIND_MAP.get(str((entry or {}).get("asset_type") or "").strip(), "generic")


def _weighted_median(values):
    if not values:
        return None
    ordered = sorted(values, key=lambda item: item[0])
    total = sum(max(0.0, float(item[1])) for item in ordered)
    if total <= 1e-12:
        return ordered[len(ordered) // 2][0]
    threshold = total / 2.0
    running = 0.0
    for value, weight in ordered:
        running += max(0.0, float(weight))
        if running >= threshold:
            return value
    return ordered[-1][0]


def _explicit_metric_evidence(prepared):
    envelope = prepared.get("scene_envelope") if isinstance(prepared, dict) else None
    if isinstance(envelope, dict) and envelope.get("basis") == "user_fixed":
        if any(_finite(envelope.get(key), 0) > 0 for key in ("width_m", "depth_m", "height_m")):
            return "user-fixed-scene-envelope"

    for anchor in prepared.get("scale_anchors") or []:
        if not isinstance(anchor, dict):
            continue
        confidence = _finite(anchor.get("confidence"), 0.0)
        physical = _finite(anchor.get("physical_size_m"), 0.0)
        if physical > 0 and confidence >= 0.6:
            return "scale-anchor-evidence"

    for entry in prepared.get("objects") or []:
        if not isinstance(entry, dict) or entry.get("basis") != "user_fixed":
            continue
        if any(_finite(entry.get(key), 0) > 0 for key in ("width_m", "height_m", "depth_m")):
            return "user-fixed-object-geometry"
    return None


def _candidate_weight(entry, prior_weight):
    confidence = min(1.0, max(0.0, _finite(entry.get("confidence"), 0.5)))
    basis = str(entry.get("basis") or "inferred")
    basis_factor = 1.0 if basis == "observed" else (0.88 if basis == "inferred" else 1.0)
    visible = entry.get("visible_fraction")
    visibility_factor = 1.0 if visible is None else (0.62 + 0.38 * min(1.0, max(0.0, _finite(visible, 0.5))))
    bbox_factor = 1.06 if entry.get("image_bbox") is not None else 1.0
    return prior_weight * basis_factor * (0.45 + 0.55 * confidence) * visibility_factor * bbox_factor


def _prior_candidates(prepared):
    candidates = []
    for entry in prepared.get("objects") or []:
        if not isinstance(entry, dict) or not entry.get("include_in_scene", True):
            continue
        if entry.get("basis") == "user_fixed":
            continue
        kind = _kind(entry)
        priors = OBJECT_PRIORS.get(kind)
        if not priors:
            continue
        for axis, (target_m, prior_weight) in priors.items():
            current = _finite(entry.get(axis))
            if current is None or current <= 0.04:
                continue
            ratio = target_m / current
            # A wildly different ratio is more likely a classification/axis error
            # than useful scale evidence.
            if not 0.20 <= ratio <= 5.0:
                continue
            weight = _candidate_weight(entry, prior_weight)
            candidates.append({
                "object_id": str(entry.get("id") or ""),
                "kind": kind,
                "axis": axis,
                "current_m": current,
                "prior_m": target_m,
                "ratio": ratio,
                "weight": weight,
            })

    # Interior ceiling height is a useful weak prior when the vision model has
    # already estimated an envelope, but it must not dominate recognizable objects.
    envelope = prepared.get("scene_envelope")
    if str(prepared.get("scene_type") or "unknown") == "interior" and isinstance(envelope, dict):
        current = _finite(envelope.get("height_m"))
        if current and current > 0.2 and envelope.get("basis") != "user_fixed":
            ratio = 2.70 / current
            if 0.20 <= ratio <= 5.0:
                confidence = min(1.0, max(0.0, _finite(envelope.get("confidence"), 0.5)))
                candidates.append({
                    "object_id": "__scene_envelope__",
                    "kind": "scene-envelope",
                    "axis": "height_m",
                    "current_m": current,
                    "prior_m": 2.70,
                    "ratio": ratio,
                    "weight": 0.44 * (0.5 + 0.5 * confidence),
                })
    return candidates


def infer_scale(prepared, *, minimum_confidence=DEFAULT_MIN_CONFIDENCE, enabled=True):
    minimum_confidence = min(0.95, max(0.25, _finite(minimum_confidence, DEFAULT_MIN_CONFIDENCE)))
    if not enabled:
        return {
            "policy": POLICY,
            "status": "disabled",
            "ready": False,
            "applied": False,
            "factor": 1.0,
            "confidence": 0.0,
            "source": "disabled",
            "candidate_count": 0,
            "inlier_count": 0,
            "object_count": 0,
            "evidence": [],
        }

    explicit = _explicit_metric_evidence(prepared)
    if explicit:
        return {
            "policy": POLICY,
            "status": "anchored",
            "ready": True,
            "applied": False,
            "factor": 1.0,
            "confidence": 1.0,
            "source": explicit,
            "candidate_count": 0,
            "inlier_count": 0,
            "object_count": 0,
            "evidence": [],
        }

    candidates = _prior_candidates(prepared)
    if not candidates:
        return {
            "policy": POLICY,
            "status": "unavailable",
            "ready": False,
            "applied": False,
            "factor": 1.0,
            "confidence": 0.0,
            "source": "no-usable-size-priors",
            "candidate_count": 0,
            "inlier_count": 0,
            "object_count": 0,
            "evidence": [],
        }

    initial = _weighted_median([(entry["ratio"], entry["weight"]) for entry in candidates])
    tolerance_log = math.log(1.50)
    inliers = [
        entry for entry in candidates
        if abs(math.log(entry["ratio"] / initial)) <= tolerance_log
    ]
    if not inliers:
        inliers = list(candidates)
    factor = _weighted_median([(entry["ratio"], entry["weight"]) for entry in inliers]) or 1.0

    residuals = [
        (abs(math.log(entry["ratio"] / factor)), entry["weight"])
        for entry in inliers
    ]
    log_mad = _weighted_median(residuals) or 0.0
    consensus = max(0.0, min(1.0, 1.0 - log_mad / max(math.log(1.35), 1e-9)))
    independent_ids = {entry["object_id"] for entry in inliers if entry["object_id"] != "__scene_envelope__"}
    axis_score = min(1.0, len(inliers) / 4.0)
    object_score = min(1.0, len(independent_ids) / 2.0)
    scene_bonus = 0.08 if any(entry["object_id"] == "__scene_envelope__" for entry in inliers) else 0.0
    confidence = min(0.92, 0.36 + 0.18 * axis_score + 0.22 * object_score + 0.16 * consensus + scene_bonus)
    ready = confidence >= minimum_confidence

    evidence = []
    inlier_keys = {(entry["object_id"], entry["axis"], entry["ratio"]) for entry in inliers}
    for entry in candidates:
        item = dict(entry)
        item["ratio"] = round(item["ratio"], 6)
        item["weight"] = round(item["weight"], 6)
        item["residual_ratio"] = round(entry["ratio"] / factor, 6)
        item["inlier"] = (entry["object_id"], entry["axis"], entry["ratio"]) in inlier_keys
        evidence.append(item)

    return {
        "policy": POLICY,
        "status": "ready" if ready else "review",
        "ready": ready,
        "applied": False,
        "factor": round(factor, 8),
        "confidence": round(confidence, 4),
        "source": "object-prior-consensus",
        "candidate_count": len(candidates),
        "inlier_count": len(inliers),
        "object_count": len(independent_ids),
        "consensus": round(consensus, 4),
        "log_mad": round(log_mad, 6),
        "minimum_confidence": minimum_confidence,
        "evidence": evidence,
        "note": "Absolute scale is probabilistically inferred from multiple real-world size priors; it is not treated as exact measurement.",
    }


def _scale_number(container, key, factor):
    if not isinstance(container, dict) or container.get(key) is None:
        return
    value = _finite(container.get(key))
    if value is not None:
        container[key] = value * factor


def apply_scale(prepared, report):
    result = copy.deepcopy(prepared)
    if not report.get("ready") or report.get("source") != "object-prior-consensus":
        return result, dict(report)

    factor = _finite(report.get("factor"), 1.0)
    if factor <= 0:
        return result, dict(report)

    for entry in result.get("objects") or []:
        if not isinstance(entry, dict) or entry.get("basis") == "user_fixed":
            continue
        for key in OBJECT_SCALE_KEYS:
            _scale_number(entry, key, factor)

    envelope = result.get("scene_envelope")
    if isinstance(envelope, dict) and envelope.get("basis") != "user_fixed":
        for key in ("width_m", "depth_m", "height_m"):
            _scale_number(envelope, key, factor)
        envelope["source"] = "autonomous-scale-adjusted"

    for key in ("declared_width_m", "declared_depth_m"):
        _scale_number(result, key, factor)

    for relation in result.get("relationships") or []:
        if not isinstance(relation, dict) or relation.get("basis") == "user_fixed":
            continue
        for key in ("distance_m", "tolerance_m"):
            _scale_number(relation, key, factor)

    for anchor in result.get("scale_anchors") or []:
        if not isinstance(anchor, dict) or anchor.get("basis") == "user_fixed":
            continue
        for key in ("physical_size_m", "distance_m"):
            _scale_number(anchor, key, factor)

    camera = result.get("camera")
    if isinstance(camera, dict) and camera.get("basis") != "user_fixed":
        for key in ("physical_size_m", "distance_m", "height_m", "world_x_m", "world_z_m"):
            _scale_number(camera, key, factor)

    for zone in result.get("derived_room_zones") or []:
        if not isinstance(zone, dict):
            continue
        for point in zone.get("polygon") or []:
            _scale_number(point, "x_m", factor)
            _scale_number(point, "z_m", factor)
        _scale_number(zone, "perimeter_m", factor)
        if zone.get("area_m2") is not None:
            area = _finite(zone.get("area_m2"))
            if area is not None:
                zone["area_m2"] = area * factor * factor

    final_report = dict(report)
    final_report["applied"] = True
    return result, final_report


def infer_and_apply(prepared, *, minimum_confidence=DEFAULT_MIN_CONFIDENCE, enabled=True):
    report = infer_scale(prepared, minimum_confidence=minimum_confidence, enabled=enabled)
    return apply_scale(prepared, report)
