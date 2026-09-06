from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PIPELINE = ROOT / "reference_master_pipeline_mcp.py"
QUALITY = ROOT / "quality_check.py"


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"missing patch anchor: {label}")
    return text.replace(old, new, 1)


def replace_between(text: str, start: str, end: str, replacement: str, label: str) -> str:
    start_index = text.find(start)
    if start_index < 0:
        raise SystemExit(f"missing patch start: {label}")
    end_index = text.find(end, start_index)
    if end_index < 0:
        raise SystemExit(f"missing patch end: {label}")
    return text[:start_index] + replacement.rstrip() + "\n\n" + text[end_index:]


source = PIPELINE.read_text(encoding="utf-8")
source = replace_once(
    source,
    'BASE_ROLES = set(interpretation.ROLE_VALUES)\n',
    '''BASE_ROLES = set(interpretation.ROLE_VALUES)\n\nRECONSTRUCTION_POLICY = "reference-reconstruction-v2"\nSCENE_TYPE_VALUES = {"interior", "exterior", "vehicle", "mixed", "unknown"}\nPREVIS_PRIORITY_VALUES = {"critical", "major", "supporting", "detail"}\nCRITICAL_KINDS = {"wall", "partition", "railing", "door", "window", "column", "stairs"}\nMAJOR_KINDS = {\n    "sofa", "bed", "table", "counter", "cabinet", "refrigerator", "stove",\n    "bathtub", "toilet", "sink", "tree", "vegetation", "pergola", "platform",\n}\n''',
    "reconstruction constants",
)

new_schema = r'''def _extended_interpretation_schema():
    schema = copy.deepcopy(interpretation.INTERPRETATION_SCHEMA)
    object_schema = schema["properties"]["objects"]["items"]
    object_schema["required"] = ["id"]
    object_schema["properties"]["role"] = {"type": "string", "enum": sorted(SET_ROLES | BASE_ROLES)}
    object_schema["properties"].update({
        "kind": {"type": "string", "enum": sorted(set_reconstruction.KIND_VALUES)},
        "collection_id": {"type": "string"},
        "parent_id": {"type": "string"},
        "start_x_m": {"type": "number"},
        "start_z_m": {"type": "number"},
        "end_x_m": {"type": "number"},
        "end_z_m": {"type": "number"},
        "thickness_m": {"type": "number", "exclusiveMinimum": 0},
        "notes": {"type": "string"},
        "locked": {"type": "boolean"},
        "previs_priority": {"type": "string", "enum": sorted(PREVIS_PRIORITY_VALUES)},
        "image_bbox": {
            "type": "object",
            "properties": {
                "x": {"type": "number", "minimum": 0, "maximum": 1},
                "y": {"type": "number", "minimum": 0, "maximum": 1},
                "width": {"type": "number", "exclusiveMinimum": 0, "maximum": 1},
                "height": {"type": "number", "exclusiveMinimum": 0, "maximum": 1},
            },
            "required": ["x", "y", "width", "height"],
        },
        "visible_fraction": {"type": "number", "minimum": 0, "maximum": 1},
        "occluded_by": {"type": "array", "maxItems": 32, "items": {"type": "string"}},
        "evidence_note": {"type": "string"},
    })
    schema["properties"].update({
        "declared_width_m": {"type": "number", "exclusiveMinimum": 0},
        "declared_depth_m": {"type": "number", "exclusiveMinimum": 0},
        "scene_type": {"type": "string", "enum": sorted(SCENE_TYPE_VALUES)},
        "scene_label": {"type": "string"},
        "scene_envelope": {
            "type": "object",
            "properties": {
                "width_m": {"type": "number", "exclusiveMinimum": 0},
                "depth_m": {"type": "number", "exclusiveMinimum": 0},
                "height_m": {"type": "number", "exclusiveMinimum": 0},
                "basis": {"type": "string", "enum": sorted(interpretation.BASIS_VALUES)},
                "confidence": {"type": "number", "minimum": 0, "maximum": 1},
                "notes": {"type": "string"},
            },
        },
    })
    return schema
'''
source = replace_between(
    source,
    "def _extended_interpretation_schema():",
    "REFERENCE_MASTER_INTERPRETATION_SCHEMA = _extended_interpretation_schema()",
    new_schema,
    "extended interpretation schema",
)

source = replace_once(
    source,
    "REFERENCE_MASTER_INTERPRETATION_SCHEMA = _extended_interpretation_schema()\n",
    '''REFERENCE_MASTER_INTERPRETATION_SCHEMA = _extended_interpretation_schema()\n\n\ndef _finite_number(value, label):\n    try:\n        number = float(value)\n    except (TypeError, ValueError) as exc:\n        raise ValueError(f"{label} 값이 숫자가 아닙니다.") from exc\n    if not math.isfinite(number):\n        raise ValueError(f"{label} 값이 유효한 유한수가 아닙니다.")\n    return number\n\n\ndef _unit_interval(value, label):\n    number = _finite_number(value, label)\n    if not 0 <= number <= 1:\n        raise ValueError(f"{label} 값은 0~1 사이여야 합니다.")\n    return number\n\n\ndef _positive_number(value, label):\n    number = _finite_number(value, label)\n    if number <= 0:\n        raise ValueError(f"{label} 값은 0보다 커야 합니다.")\n    return number\n\n\ndef _scene_type(value):\n    candidate = str(value or "unknown").strip().lower()\n    if candidate not in SCENE_TYPE_VALUES:\n        raise ValueError(f"scene_type은 {sorted(SCENE_TYPE_VALUES)} 중 하나여야 합니다.")\n    return candidate\n\n\ndef _basis_confidence(basis, confidence):\n    candidate = str(basis or "inferred").strip()\n    if candidate not in interpretation.BASIS_VALUES:\n        raise ValueError(f"basis는 {sorted(interpretation.BASIS_VALUES)} 중 하나여야 합니다.")\n    if confidence is None:\n        confidence = 1.0 if candidate == "user_fixed" else (0.78 if candidate == "observed" else 0.5)\n    return candidate, _unit_interval(confidence, "confidence")\n\n\ndef _normalize_scene_envelope(raw):\n    if raw is None:\n        return None\n    if not isinstance(raw, dict):\n        raise ValueError("scene_envelope는 객체여야 합니다.")\n    result = {}\n    for key in ("width_m", "depth_m", "height_m"):\n        if raw.get(key) is not None:\n            result[key] = _positive_number(raw[key], f"scene_envelope.{key}")\n    if not result:\n        raise ValueError("scene_envelope에는 width_m/depth_m/height_m 중 하나 이상이 필요합니다.")\n    basis, confidence = _basis_confidence(raw.get("basis"), raw.get("confidence"))\n    result["basis"] = basis\n    result["confidence"] = confidence\n    result["notes"] = str(raw.get("notes") or "")[:500]\n    result["source"] = "explicit-scene-envelope"\n    return result\n\n\ndef _normalize_image_bbox(raw, label):\n    if raw is None:\n        return None\n    if not isinstance(raw, dict):\n        raise ValueError(f"{label}는 객체여야 합니다.")\n    bbox = {\n        "x": _unit_interval(raw.get("x"), f"{label}.x"),\n        "y": _unit_interval(raw.get("y"), f"{label}.y"),\n        "width": _positive_number(raw.get("width"), f"{label}.width"),\n        "height": _positive_number(raw.get("height"), f"{label}.height"),\n    }\n    if bbox["width"] > 1 or bbox["height"] > 1:\n        raise ValueError(f"{label}.width/height는 1 이하여야 합니다.")\n    if bbox["x"] + bbox["width"] > 1.000001 or bbox["y"] + bbox["height"] > 1.000001:\n        raise ValueError(f"{label}가 이미지 정규화 범위 0~1을 벗어납니다.")\n    return bbox\n\n\ndef _default_previs_priority(kind, role):\n    if kind in CRITICAL_KINDS or role in {"structure", "opening"}:\n        return "critical"\n    if kind in MAJOR_KINDS or role in {"furniture", "service", "vegetation"}:\n        return "major"\n    if role == "prop" and kind == "generic":\n        return "detail"\n    return "supporting"\n\n\ndef _previs_priority(raw_object, kind, role):\n    requested = str(raw_object.get("previs_priority") or "").strip().lower()\n    if not requested:\n        return _default_previs_priority(kind, role)\n    if requested not in PREVIS_PRIORITY_VALUES:\n        raise ValueError(f"previs_priority는 {sorted(PREVIS_PRIORITY_VALUES)} 중 하나여야 합니다.")\n    return requested\n''',
    "reconstruction evidence helpers",
)

new_prepare_object = r'''def _prepare_object(raw_object, index):
    if not isinstance(raw_object, dict):
        raise ValueError(f"objects[{index}]가 객체가 아닙니다.")
    prepared = copy.deepcopy(raw_object)
    kind = _set_kind(raw_object)
    defaults = set_reconstruction.DEFAULT_KIND[kind]
    requested_role = str(raw_object.get("role") or defaults["role"])
    set_role = requested_role if requested_role in SET_ROLES else defaults["role"]
    prepared["role"] = BASE_ROLE_BY_SET_ROLE.get(requested_role, requested_role if requested_role in BASE_ROLES else "prop")
    prepared["previs_priority"] = _previs_priority(raw_object, kind, set_role)

    bbox = _normalize_image_bbox(raw_object.get("image_bbox"), f"objects[{index}].image_bbox")
    if bbox is not None:
        prepared["image_bbox"] = bbox
    if raw_object.get("visible_fraction") is not None:
        prepared["visible_fraction"] = _unit_interval(raw_object["visible_fraction"], f"objects[{index}].visible_fraction")
    occluded_by = raw_object.get("occluded_by") or []
    if not isinstance(occluded_by, list) or len(occluded_by) > 32:
        raise ValueError(f"objects[{index}].occluded_by는 32개 이하 배열이어야 합니다.")
    prepared["occluded_by"] = [str(value).strip() for value in occluded_by if str(value).strip()]
    prepared["evidence_note"] = str(raw_object.get("evidence_note") or "")[:500]

    line_keys = ("start_x_m", "start_z_m", "end_x_m", "end_z_m")
    present = [key for key in line_keys if raw_object.get(key) is not None]
    if present and len(present) != len(line_keys):
        raise ValueError(f"objects[{index}] 선분은 start/end x/z를 모두 제공해야 합니다.")

    if len(present) == len(line_keys):
        sx = float(raw_object["start_x_m"])
        sz = float(raw_object["start_z_m"])
        ex = float(raw_object["end_x_m"])
        ez = float(raw_object["end_z_m"])
        length = math.hypot(ex - sx, ez - sz)
        if not math.isfinite(length) or length < 0.02:
            raise ValueError(f"objects[{index}] 선분 길이가 너무 짧습니다.")
        thickness = raw_object.get("thickness_m", defaults.get("thickness_m", raw_object.get("depth_m", 0.12)))
        prepared["world_x_m"] = (sx + ex) / 2
        prepared["world_z_m"] = (sz + ez) / 2
        prepared["width_m"] = length
        prepared["depth_m"] = float(thickness)
        prepared["rotation_deg"] = math.degrees(math.atan2(ez - sz, ex - sx))
    else:
        for key in ("world_x_m", "world_z_m", "width_m"):
            if prepared.get(key) is None:
                raise ValueError(f"objects[{index}].{key}가 필요합니다.")
        if prepared.get("depth_m") is None:
            if defaults.get("depth_m") is not None:
                prepared["depth_m"] = defaults["depth_m"]
            elif kind in {"wall", "partition", "railing"}:
                prepared["depth_m"] = defaults.get("thickness_m", 0.12)
            elif kind == "column":
                prepared["depth_m"] = prepared["width_m"]
            else:
                raise ValueError(f"objects[{index}].depth_m가 필요합니다.")

    if prepared.get("height_m") is None:
        prepared["height_m"] = defaults["height_m"]
    if not prepared.get("asset_type"):
        prepared["asset_type"] = defaults["asset_type"]
    return prepared
'''
source = replace_between(source, "def _prepare_object(raw_object, index):", "def _prepare_interpretation(raw):", new_prepare_object, "prepare object")

new_prepare_interpretation = r'''def _prepare_interpretation(raw):
    if not isinstance(raw, dict):
        raise ValueError("interpretation은 객체여야 합니다.")
    prepared = copy.deepcopy(raw)
    prepared["scene_type"] = _scene_type(raw.get("scene_type"))
    prepared["scene_label"] = str(raw.get("scene_label") or "")[:160]
    envelope = _normalize_scene_envelope(raw.get("scene_envelope"))
    if envelope is not None:
        prepared["scene_envelope"] = envelope
    objects = raw.get("objects") or []
    if not isinstance(objects, list) or not objects:
        raise ValueError("interpretation.objects는 하나 이상 필요합니다.")
    prepared["objects"] = [_prepare_object(entry, index) for index, entry in enumerate(objects)]
    ids = {str(entry.get("id") or "") for entry in prepared["objects"]}
    for index, entry in enumerate(prepared["objects"]):
        object_id = str(entry.get("id") or "")
        for reference_id in entry.get("occluded_by") or []:
            if reference_id == object_id:
                raise ValueError(f"objects[{index}].occluded_by가 자기 자신을 참조합니다.")
            if reference_id not in ids:
                raise ValueError(f"objects[{index}].occluded_by '{reference_id}'가 objects에 없습니다.")
    return prepared
'''
source = replace_between(source, "def _prepare_interpretation(raw):", "def _default_collection_id(role):", new_prepare_interpretation, "prepare interpretation")

source = replace_once(
    source,
    '    raw_master_plan = _compile_raw_master_plan(raw, normalized_interpretation)\n',
    '    raw_master_plan = _compile_raw_master_plan(prepared, normalized_interpretation)\n',
    "compile prepared interpretation",
)

source = replace_once(
    source,
    '''        "cameraObservation": _camera_observation(normalized_interpretation.get("camera")),\n        "cameraApplied": False,\n        "pipelinePolicy": PIPELINE_POLICY,\n''',
    '''        "cameraObservation": _camera_observation(normalized_interpretation.get("camera")),\n        "cameraApplied": False,\n        "pipelinePolicy": PIPELINE_POLICY,\n''',
    "reference evidence anchor",
)

new_camera_and_report = r'''def _camera_observation(camera):
    if not isinstance(camera, dict):
        return None
    keys = (
        "target_id", "anchor_id", "axis", "physical_size_m", "frame_fraction",
        "focal_mm", "distance_m", "sensor_width_mm", "aspect", "horizon_y",
        "image_x", "image_y", "height_m", "world_x_m", "world_z_m",
        "pan_deg", "tilt_deg", "basis", "confidence",
    )
    return {key: camera.get(key) for key in keys if camera.get(key) is not None}


def _report_scene_envelope(prepared):
    explicit = prepared.get("scene_envelope")
    if isinstance(explicit, dict):
        return copy.deepcopy(explicit)
    declared = {}
    if prepared.get("declared_width_m") is not None:
        declared["width_m"] = _positive_number(prepared["declared_width_m"], "declared_width_m")
    if prepared.get("declared_depth_m") is not None:
        declared["depth_m"] = _positive_number(prepared["declared_depth_m"], "declared_depth_m")
    if not declared:
        return None
    declared.update({
        "basis": "inferred",
        "confidence": 0.55,
        "notes": "Legacy declared dimensions retained as coarse scene-envelope evidence.",
        "source": "declared-dimensions",
    })
    return declared


def _object_evidence(prepared_object, normalized_object):
    kind = _set_kind(prepared_object)
    role = _set_role(prepared_object, kind, normalized_object)
    priority = _previs_priority(prepared_object, kind, role)
    result = {
        "id": normalized_object["id"],
        "name": normalized_object["name"],
        "kind": kind,
        "role": role,
        "basis": normalized_object["basis"],
        "confidence": normalized_object["confidence"],
        "previs_priority": priority,
        "include_in_scene": normalized_object["include_in_scene"],
        "visible_fraction": prepared_object.get("visible_fraction"),
        "occluded_by": list(prepared_object.get("occluded_by") or []),
        "evidence_note": str(prepared_object.get("evidence_note") or "")[:500],
    }
    if prepared_object.get("image_bbox") is not None:
        result["image_bbox"] = copy.deepcopy(prepared_object["image_bbox"])
    else:
        result["image_bbox"] = None
    result["hidden_inference"] = bool(
        result["basis"] == "inferred"
        and result["visible_fraction"] is not None
        and float(result["visible_fraction"]) < 0.35
    )
    return result


def _reconstruction_report(prepared, normalized_interpretation, normalized_master_plan):
    prepared_by_id = {
        str(entry.get("id")): entry
        for entry in prepared.get("objects", [])
        if isinstance(entry, dict) and entry.get("id")
    }
    object_evidence = [
        _object_evidence(prepared_by_id.get(entry["id"], {}), entry)
        for entry in normalized_interpretation["objects"]
    ]
    important = [entry for entry in object_evidence if entry["previs_priority"] in {"critical", "major"} and entry["include_in_scene"]]
    critical = [entry for entry in important if entry["previs_priority"] == "critical"]
    major = [entry for entry in important if entry["previs_priority"] == "major"]
    details = [entry for entry in object_evidence if entry["previs_priority"] == "detail" and entry["include_in_scene"]]
    scene_type = _scene_type(prepared.get("scene_type"))
    envelope = _report_scene_envelope(prepared)
    reliable_scale = int(normalized_interpretation["summary"].get("reliable_scale_anchor_count", 0))
    user_fixed_envelope = bool(
        envelope
        and envelope.get("basis") == "user_fixed"
        and float(envelope.get("confidence", 0)) >= 0.8
        and any(envelope.get(key) is not None for key in ("width_m", "depth_m"))
    )
    scale_ready = reliable_scale > 0 or user_fixed_envelope
    scale_status = "anchored" if scale_ready else "unanchored"

    queue = []
    if not scale_ready:
        queue.append({
            "code": "scale-anchor-needed",
            "rank": 0,
            "severity": "blocking",
            "message": "촬영 가능한 미터 스케일을 위해 신뢰 가능한 visible scale anchor 또는 user-fixed scene envelope가 필요합니다.",
        })

    if scene_type == "interior":
        if envelope is None:
            queue.append({
                "code": "scene-envelope-needed",
                "rank": 1,
                "severity": "review",
                "message": "실내 공간의 대략적인 폭/깊이/높이 envelope가 아직 없습니다.",
            })
        elif float(envelope.get("confidence", 0)) < 0.6:
            queue.append({
                "code": "scene-envelope-low-confidence",
                "rank": 1,
                "severity": "review",
                "confidence": envelope.get("confidence"),
                "message": "실내 공간 envelope 신뢰도가 낮습니다. 전체 도면 정밀화가 아니라 방 규모만 먼저 확인하세요.",
            })

    for entry in critical:
        threshold = 0.7 if entry["basis"] == "inferred" else 0.58
        if float(entry["confidence"]) < threshold:
            queue.append({
                "code": "critical-spatial-uncertainty",
                "rank": 2,
                "severity": "review",
                "object_id": entry["id"],
                "kind": entry["kind"],
                "basis": entry["basis"],
                "confidence": entry["confidence"],
                "hidden_inference": entry["hidden_inference"],
                "message": "배우/카메라 배치에 영향을 주는 핵심 공간 요소의 위치·크기·방향을 확인하세요.",
            })
        if entry["kind"] in {"door", "window"}:
            raw = prepared_by_id.get(entry["id"], {})
            if not raw.get("parent_id"):
                queue.append({
                    "code": "opening-parent-unresolved",
                    "rank": 2,
                    "severity": "review",
                    "object_id": entry["id"],
                    "kind": entry["kind"],
                    "message": "문/창이 어느 벽에 속하는지 확인하세요.",
                })

    for entry in major:
        if float(entry["confidence"]) < 0.5:
            queue.append({
                "code": "major-blocking-object-uncertain",
                "rank": 5,
                "severity": "review",
                "object_id": entry["id"],
                "kind": entry["kind"],
                "confidence": entry["confidence"],
                "message": "블로킹에 영향을 주는 주요 가구/환경 오브젝트를 확인하세요.",
            })

    ignored_issue_codes = {"missing-camera", "camera-target-not-in-interpretation"}
    for issue in normalized_interpretation.get("issues", []):
        if issue.get("code") in ignored_issue_codes:
            continue
        queue.append({
            "code": f"interpretation-{issue.get('code', 'review')}",
            "rank": 1,
            "severity": "review",
            "message": issue.get("message") or "Reference interpretation consistency needs review.",
        })

    room_zones = prepared.get("derived_room_zones") or []
    wall_count = sum(1 for entry in object_evidence if entry["kind"] in {"wall", "partition", "railing"} and entry["include_in_scene"])
    if scene_type == "interior" and wall_count >= 3 and not room_zones:
        queue.append({
            "code": "room-envelope-open",
            "rank": 4,
            "severity": "review",
            "message": "보이는 벽만으로 닫힌 방이 확인되지 않습니다. 보이지 않는 벽을 자동 생성하지 말고 필요할 때만 inferred로 확인하세요.",
        })

    deduped = []
    seen = set()
    for entry in sorted(queue, key=lambda item: (item.get("rank", 99), str(item.get("object_id") or ""), str(item.get("code") or ""))):
        key = (entry.get("code"), entry.get("object_id"))
        if key in seen:
            continue
        seen.add(key)
        clean = dict(entry)
        clean.pop("rank", None)
        deduped.append(clean)

    structure_count = sum(
        1 for entry in object_evidence
        if entry["include_in_scene"] and entry["role"] in {"structure", "surface"}
    )
    meaningful_count = len(important) + sum(
        1 for entry in object_evidence
        if entry["include_in_scene"] and entry["previs_priority"] == "supporting"
    )
    structure_ready = structure_count > 0 if scene_type == "interior" else meaningful_count > 0
    geometry_ready = normalized_master_plan.get("status") == "ready"
    blocking_viable = bool(scale_ready and structure_ready and geometry_ready and meaningful_count > 0)
    evidence_count = sum(
        1 for entry in important
        if entry.get("image_bbox") is not None
        or entry.get("visible_fraction") is not None
        or entry.get("evidence_note")
    )
    evidence_coverage = 1.0 if not important else evidence_count / len(important)
    camera = normalized_interpretation.get("camera")

    return {
        "policy": RECONSTRUCTION_POLICY,
        "goal": "shootable-set-first",
        "status": "review" if deduped else "ready",
        "blocking_viable": blocking_viable,
        "scene": {
            "type": scene_type,
            "label": str(prepared.get("scene_label") or "")[:160],
            "envelope": envelope,
            "occupied_bounds": copy.deepcopy(normalized_master_plan.get("bounds") or {}),
            "derived_room_zone_count": len(room_zones),
        },
        "scale": {
            "status": scale_status,
            "reliable_anchor_count": reliable_scale,
            "user_fixed_scene_envelope": user_fixed_envelope,
        },
        "camera_evidence": {
            "present": camera is not None,
            "confidence": None if camera is None else camera.get("confidence"),
            "target_id": None if camera is None else camera.get("target_id"),
            "blocks_master_set": False,
            "applied_during_set_build": False,
        },
        "coverage": {
            "critical_count": len(critical),
            "major_count": len(major),
            "supporting_count": sum(1 for entry in object_evidence if entry["previs_priority"] == "supporting" and entry["include_in_scene"]),
            "detail_count": len(details),
            "important_evidence_coverage": round(evidence_coverage, 4),
            "observed_count": sum(1 for entry in object_evidence if entry["basis"] == "observed"),
            "inferred_count": sum(1 for entry in object_evidence if entry["basis"] == "inferred"),
            "user_fixed_count": sum(1 for entry in object_evidence if entry["basis"] == "user_fixed"),
        },
        "focus_object_ids": [entry["id"] for entry in important],
        "ignored_detail_ids": [entry["id"] for entry in details],
        "object_evidence": object_evidence,
        "correction_queue": deduped,
        "next_action": "correct-flagged-spatial-uncertainties" if deduped else "actor-blocking-and-camera-design",
        "guardrails": [
            "Do not synthesize unseen walls or objects silently; hidden geometry must remain explicit inferred evidence.",
            "Decorative detail never blocks first-pass shootable-set readiness.",
            "Reference-camera evidence is retained but never moves the authored previs camera during set build.",
            "Correct only spatial uncertainties that can change blocking, camera placement, framing, or movement clearance.",
        ],
    }


def _reference_evidence(normalized_interpretation, prepared=None, reconstruction=None):
    prepared = prepared or {}
    reconstruction = reconstruction or {}
    return {
        "schema": normalized_interpretation["schema"],
        "version": normalized_interpretation["version"],
        "sourceName": normalized_interpretation["source_name"],
        "image": copy.deepcopy(normalized_interpretation.get("image") or {}),
        "statusAtCompile": normalized_interpretation["status"],
        "summary": copy.deepcopy(normalized_interpretation["summary"]),
        "scaleAnchors": copy.deepcopy(normalized_interpretation["scale_anchors"]),
        "relationships": copy.deepcopy(normalized_interpretation["relationships"]),
        "cameraObservation": _camera_observation(normalized_interpretation.get("camera")),
        "cameraApplied": False,
        "pipelinePolicy": PIPELINE_POLICY,
        "reconstructionPolicy": RECONSTRUCTION_POLICY,
        "sceneType": _scene_type(prepared.get("scene_type")),
        "sceneLabel": str(prepared.get("scene_label") or "")[:160],
        "sceneEnvelope": copy.deepcopy(reconstruction.get("scene", {}).get("envelope")),
        "objectEvidence": copy.deepcopy(reconstruction.get("object_evidence") or []),
        "derivedRoomZones": copy.deepcopy(prepared.get("derived_room_zones") or []),
        "reconstruction": copy.deepcopy(reconstruction),
    }
'''
source = replace_between(source, "def _camera_observation(camera):", "def pipeline_contract():", new_camera_and_report, "camera/reconstruction report")

new_contract = r'''def pipeline_contract():
    return {
        "schema": "frisframe-reference-master-set-contract",
        "version": 2,
        "product_definition": (
            "A reference image is spatial evidence. FrisFrame reconstructs a shootable virtual set for blocking and camera design, "
            "not a pixel-identical 3D copy and not a precision CAD drawing."
        ),
        "reconstruction_policy": RECONSTRUCTION_POLICY,
        "first_pass_goal": "shootable-spatial-set",
        "detail_policy": "decorative-detail-never-blocks-first-pass-readiness",
        "correction_policy": "Correct only flagged spatial uncertainties that can change actor blocking, camera placement, framing, or movement clearance.",
        "ownership": {
            "image_pixel_reasoning": "external-vision-mcp-client",
            "metric_validation_master_set_and_views": "FrisFrame",
            "frisframe_calls_ai_api": False,
        },
        "authoritative_flow": [
            "reference image",
            "spatial interpretation",
            "metric scale + provenance review",
            "2D Master Set",
            "2.5D layout review",
            "3D proxy set",
            "actor blocking",
            "camera placement and shot design",
        ],
        "first_pass_priority": [
            "scene envelope and usable metric scale",
            "walls/boundaries/openings that affect movement and framing",
            "major furniture and obstacles that affect blocking",
            "reference-camera evidence for later calibration",
            "decorative detail only when it matters to a shot",
        ],
        "source_of_truth": {
            "data": "blocking.setMasterPlan + shared blocking items",
            "views": ["2D", "2.5D", "3D"],
            "policy": "same-items-same-referenceDimensionsM",
        },
        "interpretation_rules": {
            "linear_architecture": "Prefer kind + start_x_m/start_z_m/end_x_m/end_z_m + thickness_m for walls/partitions/railings.",
            "rectangular_elements": "Use world_x_m/world_z_m + width_m/depth_m; height can use kind defaults when omitted.",
            "provenance": "Every blocking-relevant object should be observed, inferred, or user_fixed with confidence.",
            "visual_evidence": "For important objects, retain normalized image_bbox, visible_fraction, occlusion references, and a short evidence note when available.",
            "priority": "Mark spatially decisive architecture/openings as critical, large blocking objects as major, and nonessential decoration as detail.",
            "hidden_geometry": "Never silently close a room. Hidden boundaries must be explicitly supplied as inferred geometry with confidence/evidence.",
            "scale": "Use one or more plausible visible scale anchors; user-fixed dimensions outrank guesses.",
            "camera": "Reference camera observation is evidence for later shot calibration and never moves the authored FrisFrame camera while building the set.",
        },
        "preferred_tools": [
            "get_reference_master_set_contract",
            "validate_reference_interpretation",
            "compile_reference_master_plan",
            "apply_reference_master_set",
            "set_set_collection_lock",
        ],
        "legacy_note": "apply_reference_interpretation remains available for compatibility; new set reconstruction should prefer apply_reference_master_set.",
        "schema_hint": REFERENCE_MASTER_INTERPRETATION_SCHEMA,
    }
'''
source = replace_between(source, "def pipeline_contract():", "def _compile(args):", new_contract, "pipeline contract")

new_compile = r'''def _compile(args):
    blocking = None
    if args.get("project_id"):
        blocking = base._load_blocking(
            args.get("project_id"),
            int(args.get("scene_index", 0)),
            int(args.get("cut_index", 0)),
        )
    prepared, normalized_interpretation, _, normalized_master_plan = _normalize_pipeline(args, blocking=blocking)
    reconstruction = _reconstruction_report(prepared, normalized_interpretation, normalized_master_plan)
    return {
        "schema": "frisframe-reference-master-set-compile",
        "version": 2,
        "status": "ready" if reconstruction["blocking_viable"] else "review",
        "pipeline_policy": PIPELINE_POLICY,
        "reconstruction_policy": RECONSTRUCTION_POLICY,
        "reference_interpretation": {
            "status": normalized_interpretation["status"],
            "summary": normalized_interpretation["summary"],
            "issues": normalized_interpretation["issues"],
            "relation_checks": normalized_interpretation["relation_checks"],
        },
        "reference_reconstruction": reconstruction,
        "master_plan": normalized_master_plan,
        "camera_policy": "observation-retained-not-applied-during-master-set",
    }
'''
source = replace_between(source, "def _compile(args):", "def _apply(args):", new_compile, "compile")

source = replace_once(
    source,
    '    _, normalized_interpretation, _, normalized_master_plan = _normalize_pipeline(args, blocking=blocking)\n\n    if bool(args.get("require_interpretation_ready", True)) and normalized_interpretation["status"] != "ready":\n        codes = ", ".join(issue["code"] for issue in normalized_interpretation["issues"][:8])\n        raise ValueError(f"reference-interpretation-review-required: {codes}")\n',
    '    prepared, normalized_interpretation, _, normalized_master_plan = _normalize_pipeline(args, blocking=blocking)\n    reconstruction = _reconstruction_report(prepared, normalized_interpretation, normalized_master_plan)\n\n    if bool(args.get("require_interpretation_ready", True)) and not reconstruction["blocking_viable"]:\n        codes = ", ".join(item["code"] for item in reconstruction["correction_queue"][:8]) or "blocking-not-viable"\n        raise ValueError(f"reference-reconstruction-review-required: {codes}")\n',
    "apply readiness",
)
source = replace_once(
    source,
    '    evidence = _reference_evidence(normalized_interpretation)\n',
    '    evidence = _reference_evidence(normalized_interpretation, prepared, reconstruction)\n',
    "apply evidence",
)
source = replace_once(
    source,
    '        current_blocking["setMasterPlan"]["pipelinePolicy"] = PIPELINE_POLICY\n        current_blocking["setMasterPlan"]["cameraAppliedDuringSetBuild"] = False\n',
    '        current_blocking["setMasterPlan"]["pipelinePolicy"] = PIPELINE_POLICY\n        current_blocking["setMasterPlan"]["reconstructionPolicy"] = RECONSTRUCTION_POLICY\n        current_blocking["setMasterPlan"]["referenceReconstruction"] = copy.deepcopy(reconstruction)\n        current_blocking["setMasterPlan"]["cameraAppliedDuringSetBuild"] = False\n',
    "persist reconstruction",
)
source = replace_once(
    source,
    '            "status": "ready",\n            "pipeline_policy": PIPELINE_POLICY,\n            "reference_status": normalized_interpretation["status"],\n            "master_plan_status": normalized_master_plan["status"],\n',
    '            "status": "ready" if reconstruction["blocking_viable"] else "review",\n            "pipeline_policy": PIPELINE_POLICY,\n            "reconstruction_policy": RECONSTRUCTION_POLICY,\n            "reference_status": normalized_interpretation["status"],\n            "reconstruction_status": reconstruction["status"],\n            "blocking_viable": reconstruction["blocking_viable"],\n            "master_plan_status": normalized_master_plan["status"],\n',
    "apply summary status",
)
source = replace_once(
    source,
    '            "next_step": "Review the auto-opened 2.5D Master Set, correct dimensions/layout, then block actors and calibrate/place camera.",\n',
    '            "next_step": (\n                "Correct only flagged spatial uncertainties, then block actors and place/calibrate cameras."\n                if reconstruction["correction_queue"]\n                else "Block actors and place/calibrate cameras; the first-pass set is spatially ready."\n            ),\n            "correction_queue": copy.deepcopy(reconstruction["correction_queue"]),\n',
    "apply next step",
)
source = replace_once(
    source,
    '        "set_master_plan": {\n',
    '        "reference_reconstruction": reconstruction,\n        "set_master_plan": {\n',
    "apply response reconstruction",
)

PIPELINE.write_text(source, encoding="utf-8")

quality = QUALITY.read_text(encoding="utf-8")
quality = replace_once(
    quality,
    '        ROOT / "tests/reference-master-pipeline-mcp.py",\n        ROOT / "tests/spatial-quality-mcp.py",\n',
    '        ROOT / "tests/reference-master-pipeline-mcp.py",\n        ROOT / "tests/reference-reconstruction-v2-mcp.py",\n        ROOT / "tests/spatial-quality-mcp.py",\n',
    "quality python syntax",
)
quality = replace_once(
    quality,
    '    run("Reference → Master Set 파이프라인", [sys.executable, "tests/reference-master-pipeline-mcp.py"])\n    run("공간 해석 품질", [sys.executable, "tests/spatial-quality-mcp.py"])\n',
    '    run("Reference → Master Set 파이프라인", [sys.executable, "tests/reference-master-pipeline-mcp.py"])\n    run("Reference Reconstruction v2", [sys.executable, "tests/reference-reconstruction-v2-mcp.py"])\n    run("공간 해석 품질", [sys.executable, "tests/spatial-quality-mcp.py"])\n',
    "quality run",
)
QUALITY.write_text(quality, encoding="utf-8")
