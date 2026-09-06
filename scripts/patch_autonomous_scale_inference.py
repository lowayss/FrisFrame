from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PIPELINE = ROOT / "reference_master_pipeline_mcp.py"
SPATIAL = ROOT / "spatial_quality_mcp.py"
QUALITY = ROOT / "quality_check.py"
V2_TEST = ROOT / "tests" / "reference-reconstruction-v2-mcp.py"


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
    "import set_reconstruction_mcp as set_reconstruction\n",
    "import set_reconstruction_mcp as set_reconstruction\nimport autonomous_scale_core as autonomous_scale\n",
    "autonomous scale import",
)

schema_anchor = '            "parallel_tolerance_deg": {"type": "number", "exclusiveMinimum": 0, "maximum": 45},\n'
schema_insert = schema_anchor + '''            "autonomous_scale": {\n                "type": "boolean",\n                "description": "사용자 실측 입력 없이 object/scene size prior 합의로 전역 미터 스케일을 자동 보정합니다. 기본 true.",\n            },\n            "minimum_autonomous_scale_confidence": {\n                "type": "number", "minimum": 0.25, "maximum": 0.95,\n                "description": "자동 스케일 합의를 blocking-ready로 인정할 최소 confidence. 기본 0.58.",\n            },\n'''
if source.count(schema_anchor) < 2:
    raise SystemExit("expected compile/apply schema anchors")
source = source.replace(schema_anchor, schema_insert, 2)

helper = r'''def _autonomous_scale_raw(raw, args):
    if not isinstance(raw, dict):
        raise ValueError("interpretation은 객체여야 합니다.")
    internal = args.get("_autonomous_scale_report") if isinstance(args, dict) else None
    if isinstance(internal, dict):
        return copy.deepcopy(raw), copy.deepcopy(internal)

    prepared = _prepare_interpretation(raw)
    scaled_prepared, report = autonomous_scale.infer_and_apply(
        prepared,
        minimum_confidence=(args or {}).get(
            "minimum_autonomous_scale_confidence",
            autonomous_scale.DEFAULT_MIN_CONFIDENCE,
        ),
        enabled=bool((args or {}).get("autonomous_scale", True)),
    )

    # _prepare_object maps set roles (opening/furniture/service) into the legacy
    # interpretation role vocabulary. Restore the caller's original role token
    # before Master Plan compilation while keeping the scaled geometry/defaults.
    original_by_id = {
        str(entry.get("id")): entry
        for entry in raw.get("objects", [])
        if isinstance(entry, dict) and entry.get("id")
    }
    for entry in scaled_prepared.get("objects") or []:
        original = original_by_id.get(str(entry.get("id") or ""), {})
        if "role" in original:
            entry["role"] = original["role"]
        else:
            entry.pop("role", None)
    return scaled_prepared, report
'''
source = replace_once(
    source,
    "def _default_collection_id(role):\n",
    helper + "\n\ndef _default_collection_id(role):\n",
    "autonomous scale raw helper",
)

new_normalize = r'''def _normalize_pipeline(args, *, blocking=None):
    raw = args.get("interpretation")
    metric_raw, autonomous_report = _autonomous_scale_raw(raw, args)
    prepared = _prepare_interpretation(metric_raw)
    prepared["_autonomous_scale"] = copy.deepcopy(autonomous_report)
    normalized_interpretation = interpretation.normalize_interpretation(
        prepared,
        relation_tolerance_m=args.get("relation_tolerance_m", 0.75),
        parallel_tolerance_deg=args.get("parallel_tolerance_deg", 12.0),
    )
    raw_master_plan = _compile_raw_master_plan(metric_raw, normalized_interpretation)
    normalized_master_plan = set_reconstruction.normalize_master_plan(
        raw_master_plan,
        blocking=blocking,
        allow_outside_stage=bool(args.get("allow_outside_stage", False)),
        minimum_reliable_confidence=args.get("minimum_reliable_confidence", 0.6),
    )
    return prepared, normalized_interpretation, raw_master_plan, normalized_master_plan
'''
source = replace_between(source, "def _normalize_pipeline(args, *, blocking=None):", "def _camera_observation(camera):", new_normalize, "normalize pipeline")

source = replace_once(
    source,
    '    reliable_scale = int(normalized_interpretation["summary"].get("reliable_scale_anchor_count", 0))\n',
    '    reliable_scale = int(normalized_interpretation["summary"].get("reliable_scale_anchor_count", 0))\n    autonomous_report = copy.deepcopy(prepared.get("_autonomous_scale") or {})\n    autonomous_ready = bool(autonomous_report.get("ready"))\n',
    "reconstruction autonomous report",
)
source = replace_once(
    source,
    '    scale_ready = reliable_scale > 0 or user_fixed_envelope\n    scale_status = "anchored" if scale_ready else "unanchored"\n',
    '''    scale_ready = reliable_scale > 0 or user_fixed_envelope or autonomous_ready\n    if reliable_scale > 0 or user_fixed_envelope:\n        scale_status = "anchored"\n    elif autonomous_ready:\n        scale_status = "autonomous"\n    else:\n        scale_status = "unanchored"\n''',
    "scale ready policy",
)
source = replace_once(
    source,
    '            "message": "촬영 가능한 미터 스케일을 위해 신뢰 가능한 visible scale anchor 또는 user-fixed scene envelope가 필요합니다.",\n',
    '            "message": "자동 object/scene prior 합의로도 안정적인 미터 스케일을 얻지 못했습니다. 이 경우에만 추가 scale evidence가 필요합니다.",\n',
    "scale queue message",
)
source = replace_once(
    source,
    '    ignored_issue_codes = {"missing-camera", "camera-target-not-in-interpretation"}\n',
    '''    ignored_issue_codes = {"missing-camera", "camera-target-not-in-interpretation"}\n    if autonomous_ready:\n        ignored_issue_codes.add("missing-reliable-scale-anchor")\n''',
    "ignore legacy scale issue when autonomous",
)
source = replace_once(
    source,
    '            "user_fixed_scene_envelope": user_fixed_envelope,\n',
    '            "user_fixed_scene_envelope": user_fixed_envelope,\n            "autonomous": autonomous_report,\n',
    "scale report persistence",
)
source = replace_once(
    source,
    '        "correction_policy": "Correct only flagged spatial uncertainties that can change actor blocking, camera placement, framing, or movement clearance.",\n',
    '''        "correction_policy": "Correct only flagged spatial uncertainties that can change actor blocking, camera placement, framing, or movement clearance.",\n        "autonomous_scale": {\n            "default": True,\n            "policy": autonomous_scale.POLICY,\n            "user_metric_input_required": False,\n            "method": "robust consensus of familiar object-size priors + scene-envelope prior + vision spatial geometry",\n            "user_fixed_override": "optional and authoritative when present",\n            "uncertainty": "single-image absolute scale remains probabilistic; confidence and evidence are always retained",\n        },\n''',
    "contract autonomous scale",
)
source = replace_once(
    source,
    '            "scale": "Use one or more plausible visible scale anchors; user-fixed dimensions outrank guesses.",\n',
    '            "scale": "Infer metric scale autonomously from multiple familiar object/scene priors by default; explicit user-fixed dimensions are optional overrides, not prerequisites.",\n',
    "contract scale rule",
)
PIPELINE.write_text(source, encoding="utf-8")

spatial = SPATIAL.read_text(encoding="utf-8")
new_quality_args = r'''def _quality_args(args):
    args = dict(args or {})
    metric_raw, autonomous_report = pipeline._autonomous_scale_raw(args.get("interpretation"), args)
    enhanced, report = enhance_interpretation(
        metric_raw,
        endpoint_snap_tolerance_m=args.get("endpoint_snap_tolerance_m", DEFAULT_ENDPOINT_SNAP_TOLERANCE_M),
        opening_attach_tolerance_m=args.get("opening_attach_tolerance_m", DEFAULT_OPENING_ATTACH_TOLERANCE_M),
        opening_rotation_tolerance_deg=args.get("opening_rotation_tolerance_deg", DEFAULT_OPENING_ROTATION_TOLERANCE_DEG),
    )
    args["interpretation"] = enhanced
    args["_autonomous_scale_report"] = copy.deepcopy(autonomous_report)
    report["autonomous_scale"] = copy.deepcopy(autonomous_report)
    return args, report
'''
spatial = replace_between(spatial, "def _quality_args(args):", "def _add_quality_schema(tool):", new_quality_args, "spatial quality ordering")
SPATIAL.write_text(spatial, encoding="utf-8")

quality = QUALITY.read_text(encoding="utf-8")
quality = replace_once(
    quality,
    '        ROOT / "reference_master_pipeline_mcp.py",\n',
    '        ROOT / "reference_master_pipeline_mcp.py",\n        ROOT / "autonomous_scale_core.py",\n',
    "quality syntax core",
)
quality = replace_once(
    quality,
    '        ROOT / "tests/reference-reconstruction-v2-mcp.py",\n',
    '        ROOT / "tests/reference-reconstruction-v2-mcp.py",\n        ROOT / "tests/autonomous-scale-inference-mcp.py",\n',
    "quality syntax test",
)
quality = replace_once(
    quality,
    '    run("Reference Reconstruction v2", [sys.executable, "tests/reference-reconstruction-v2-mcp.py"])\n',
    '    run("Reference Reconstruction v2", [sys.executable, "tests/reference-reconstruction-v2-mcp.py"])\n    run("Autonomous Scale Inference", [sys.executable, "tests/autonomous-scale-inference-mcp.py"])\n',
    "quality run autonomous test",
)
QUALITY.write_text(quality, encoding="utf-8")

v2 = V2_TEST.read_text(encoding="utf-8")
old_block = '''        # Remove all reliable metric scale evidence: this must no longer be\n        # considered shootable, even though the geometry can still be compiled.\n        unscaled = reference_interpretation()\n        unscaled["scale_anchors"] = []\n        unscaled["scene_envelope"]["basis"] = "inferred"\n        unscaled["scene_envelope"]["confidence"] = 0.45\n        review = json.loads(base.call_tool("compile_reference_master_plan", {\n            "interpretation": unscaled,\n        }))\n        assert review["status"] == "review"\n        assert review["reference_reconstruction"]["blocking_viable"] is False\n        assert review["reference_reconstruction"]["scale"]["status"] == "unanchored"\n        assert review["reference_reconstruction"]["correction_queue"][0]["code"] == "scale-anchor-needed"\n'''
new_block = '''        # User-supplied dimensions are optional. With explicit anchors removed,\n        # the same image interpretation must autonomously recover a usable scale\n        # from familiar object/scene priors rather than blocking the workflow.\n        unscaled = reference_interpretation()\n        unscaled["scale_anchors"] = []\n        unscaled["scene_envelope"]["basis"] = "inferred"\n        unscaled["scene_envelope"]["confidence"] = 0.45\n        automatic = json.loads(base.call_tool("compile_reference_master_plan", {\n            "interpretation": unscaled,\n        }))\n        assert automatic["status"] == "ready", automatic\n        assert automatic["reference_reconstruction"]["blocking_viable"] is True\n        assert automatic["reference_reconstruction"]["scale"]["status"] == "autonomous"\n        auto_scale = automatic["reference_reconstruction"]["scale"]["autonomous"]\n        assert auto_scale["ready"] is True\n        assert auto_scale["source"] == "object-prior-consensus"\n        assert not any(entry["code"] == "scale-anchor-needed" for entry in automatic["reference_reconstruction"]["correction_queue"])\n'''
if old_block not in v2:
    raise SystemExit("missing v2 obsolete scale requirement block")
v2 = v2.replace(old_block, new_block, 1)
V2_TEST.write_text(v2, encoding="utf-8")
