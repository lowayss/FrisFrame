#!/usr/bin/env python3
"""Atomic MCP -> Master Set command execution for FrisFrame.

The MCP/Codex client owns spatial interpretation. FrisFrame owns deterministic
execution: validate commands, resolve dependencies, build a candidate Master Set,
apply only the changed stage items, and commit exactly once or not at all.

This module intentionally does not classify image content, search dimensions, or
invent missing semantic geometry. Tiny numeric repairs (for example an opening
center clamped inside its parent wall) are allowed and reported as warnings.
"""

from __future__ import annotations

import copy
import json
import math

import mcp_previs_server as base
import mcp_server as core
import reference_space_core as space
import reference_space_mcp as reference
import set_reconstruction_mcp as sets


COMMAND_POLICY = "mcp-spatial-command-engine-v1"
OPENING_KINDS = {"door", "window"}
OPENING_PARENT_KINDS = {"wall", "partition", "railing"}
MAX_COMMANDS = 200
ATTACHMENT_HARD_TOLERANCE = 0.05


OPERATION_SCHEMA = {
    "type": "object",
    "properties": {
        "op": {"type": "string", "enum": ["create", "update", "delete", "attach", "detach"]},
        "id": {"type": "string"},
        "element": {"type": "object"},
        "changes": {"type": "object"},
        "parent_id": {"type": "string"},
        "attachment_t": {"type": "number"},
        "cascade": {"type": "boolean"},
    },
    "required": ["op"],
}

COMMAND_PROPERTIES = {
    **base.COMMON_TARGET_PROPERTIES,
    "transaction_id": {"type": "string"},
    "mode": {"type": "string", "enum": ["patch", "replace"]},
    "source_name": {"type": "string"},
    "operations": {"type": "array", "minItems": 1, "maxItems": MAX_COMMANDS, "items": OPERATION_SCHEMA},
    "collections": {"type": "array", "maxItems": 32, "items": sets.COLLECTION_SCHEMA},
    "allow_outside_stage": {"type": "boolean"},
    "lock_after_apply": {"type": "boolean"},
}

CONTRACT_TOOL = {
    "name": "get_spatial_command_contract",
    "description": (
        "Codex/MCP가 해석한 공간 명령을 FrisFrame Master Set에 결정론적으로 구현하기 위한 계약을 반환합니다. "
        "FrisFrame은 이미지 의미/표준 치수를 추론하지 않고 명령 검증, 의존성 해석, 원자 적용, 결과 보고를 담당합니다."
    ),
    "inputSchema": {"type": "object", "properties": {}},
}

VALIDATE_TOOL = {
    "name": "validate_spatial_set_commands",
    "description": (
        "현재 Master Set을 기준으로 create/update/delete/attach/detach 명령 묶음을 mutation 없이 검증합니다. "
        "부모 의존성, 순환 참조, opening-wall 관계, 치수, ID 충돌과 예상 diff를 반환합니다."
    ),
    "inputSchema": {
        "type": "object",
        "properties": {key: value for key, value in COMMAND_PROPERTIES.items() if key != "revision"},
        "required": ["project_id", "operations"],
    },
}

APPLY_TOOL = {
    "name": "apply_spatial_set_commands",
    "description": (
        "검증된 MCP 공간 명령 묶음을 하나의 atomic revision으로 Master Set에 적용합니다. "
        "변경된 stage item만 갱신하며 실패 시 아무 변경도 남기지 않습니다."
    ),
    "inputSchema": {
        "type": "object",
        "properties": COMMAND_PROPERTIES,
        "required": ["project_id", "revision", "operations"],
    },
}

SNAPSHOT_TOOL = {
    "name": "get_master_set_snapshot",
    "description": "MCP가 직전 명령 결과를 검증할 수 있도록 현재 authoritative Master Set과 collection 요약을 읽기 전용으로 반환합니다.",
    "inputSchema": {
        "type": "object",
        "properties": {
            "project_id": {"type": "string"},
            "scene_index": {"type": "integer", "minimum": 0},
            "cut_index": {"type": "integer", "minimum": 0},
        },
        "required": ["project_id"],
    },
}


def _finite(value, label):
    try:
        number = float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{label} 값이 숫자가 아닙니다.") from exc
    if not math.isfinite(number):
        raise ValueError(f"{label} 값이 유효한 유한수가 아닙니다.")
    return number


def _identifier(value, label):
    candidate = str(value or "").strip()
    if not sets.ID_RE.fullmatch(candidate):
        raise ValueError(f"{label}는 영문/숫자/_/- 64자 이하여야 합니다.")
    return candidate


def _blocking(project_id, scene_index, cut_index):
    return base._load_blocking(project_id, scene_index, cut_index)


def _persisted_element_to_raw(entry, item_map):
    element_id = _identifier(entry.get("id"), "persisted element id")
    item = item_map.get(element_id) or {}
    raw = {
        "id": element_id,
        "name": str(entry.get("name") or element_id),
        "kind": str(entry.get("kind") or "generic"),
        "role": str(entry.get("role") or "prop"),
        "basis": str(entry.get("basis") or "inferred"),
        "confidence": entry.get("confidence", 0.5),
        "collection_id": str(entry.get("collectionId") or "main-set"),
        "world_x_m": entry.get("worldXM"),
        "world_z_m": entry.get("worldZM"),
        "width_m": entry.get("widthM"),
        "height_m": entry.get("heightM"),
        "depth_m": entry.get("depthM"),
        "rotation_deg": entry.get("rotationDeg", 0),
        "mounted_height_m": entry.get("mountedHeightM", 0),
        "asset_type": entry.get("assetType"),
        "visible": bool(item.get("visible", True)),
        "include_in_scene": True,
        "locked": bool(item.get("editLocked", False)),
        "motion_enabled": bool(item.get("motionEnabled", False)),
        "notes": str(entry.get("notes") or ""),
    }
    parent_id = str(entry.get("parentId") or "")
    if parent_id:
        raw["parent_id"] = parent_id
    color = item.get("color")
    if isinstance(color, str) and color.startswith("#"):
        raw["color"] = color
    line = entry.get("line")
    if isinstance(line, dict):
        for key in ("start_x_m", "start_z_m", "end_x_m", "end_z_m", "thickness_m"):
            if line.get(key) is not None:
                raw[key] = line[key]
    return {key: value for key, value in raw.items() if value is not None}


def _current_raw_plan(blocking):
    persisted = blocking.get("setMasterPlan") if isinstance(blocking.get("setMasterPlan"), dict) else {}
    item_map = {str(item.get("id")): item for item in blocking.get("items", [])}
    elements = []
    for entry in persisted.get("elements") or []:
        if isinstance(entry, dict) and entry.get("id"):
            elements.append(_persisted_element_to_raw(entry, item_map))

    collections = []
    for entry in blocking.get("setCollections") or []:
        if not isinstance(entry, dict) or not entry.get("id"):
            continue
        collection = {
            "id": str(entry.get("id")),
            "name": str(entry.get("name") or entry.get("id")),
            "locked": bool(entry.get("locked", False)),
            "allow_partial_unlock": bool(entry.get("allowPartialUnlock", True)),
        }
        if entry.get("parentId"):
            collection["parent_id"] = str(entry.get("parentId"))
        collections.append(collection)
    if not collections:
        used = sorted({str(entry.get("collection_id") or "main-set") for entry in elements})
        collections = [{"id": cid, "name": cid, "locked": False, "allow_partial_unlock": True} for cid in (used or ["main-set"])]

    return {
        "source_name": str(persisted.get("sourceName") or "MCP Spatial Set"),
        "unit": "meter",
        "declared_width_m": persisted.get("declaredWidthM"),
        "declared_depth_m": persisted.get("declaredDepthM"),
        "elements": elements,
        "collections": collections,
        "notes": str(persisted.get("notes") or ""),
    }


def _element_line(element):
    keys = ("start_x_m", "start_z_m", "end_x_m", "end_z_m")
    if all(element.get(key) is not None for key in keys):
        sx = _finite(element["start_x_m"], f"{element.get('id')}.start_x_m")
        sz = _finite(element["start_z_m"], f"{element.get('id')}.start_z_m")
        ex = _finite(element["end_x_m"], f"{element.get('id')}.end_x_m")
        ez = _finite(element["end_z_m"], f"{element.get('id')}.end_z_m")
    else:
        cx = _finite(element.get("world_x_m"), f"{element.get('id')}.world_x_m")
        cz = _finite(element.get("world_z_m"), f"{element.get('id')}.world_z_m")
        length = _finite(element.get("width_m"), f"{element.get('id')}.width_m")
        if length <= 0:
            raise ValueError(f"wall '{element.get('id')}' width_m은 0보다 커야 합니다.")
        radians = math.radians(_finite(element.get("rotation_deg", 0), f"{element.get('id')}.rotation_deg"))
        dx = math.cos(radians) * length * 0.5
        dz = math.sin(radians) * length * 0.5
        sx, sz, ex, ez = cx - dx, cz - dz, cx + dx, cz + dz
    length = math.hypot(ex - sx, ez - sz)
    if length < 0.02:
        raise ValueError(f"wall '{element.get('id')}' 길이가 너무 짧습니다.")
    return sx, sz, ex, ez, length


def _project_attachment_t(child, parent):
    sx, sz, ex, ez, length = _element_line(parent)
    cx = _finite(child.get("world_x_m"), f"{child.get('id')}.world_x_m")
    cz = _finite(child.get("world_z_m"), f"{child.get('id')}.world_z_m")
    dx, dz = ex - sx, ez - sz
    return ((cx - sx) * dx + (cz - sz) * dz) / (length * length)


def _attachment_snapshot(elements):
    by_id = {str(entry.get("id")): entry for entry in elements if entry.get("id")}
    result = {}
    for child in elements:
        parent_id = str(child.get("parent_id") or "")
        if child.get("kind") not in OPENING_KINDS or not parent_id:
            continue
        parent = by_id.get(parent_id)
        if not parent:
            continue
        try:
            result[child["id"]] = {"parent_id": parent_id, "attachment_t": _project_attachment_t(child, parent)}
        except ValueError:
            continue
    return result


def _collection_map(collections):
    return {str(entry.get("id")): copy.deepcopy(entry) for entry in collections if isinstance(entry, dict) and entry.get("id")}


def _upsert_collections(candidate, requested):
    mapping = _collection_map(candidate.get("collections") or [])
    for index, entry in enumerate(requested or []):
        if not isinstance(entry, dict):
            raise ValueError(f"collections[{index}]가 객체가 아닙니다.")
        cid = _identifier(entry.get("id"), f"collections[{index}].id")
        mapping[cid] = copy.deepcopy(entry)
    if not mapping:
        mapping["main-set"] = {"id": "main-set", "name": "Main Set", "locked": False, "allow_partial_unlock": True}
    candidate["collections"] = list(mapping.values())


def _parse_operations(operations):
    if not isinstance(operations, list) or not operations:
        raise ValueError("operations는 하나 이상 필요합니다.")
    if len(operations) > MAX_COMMANDS:
        raise ValueError(f"operations는 {MAX_COMMANDS}개까지 지원합니다.")
    parsed = []
    seen_exact = set()
    for index, raw in enumerate(operations):
        if not isinstance(raw, dict):
            raise ValueError(f"operations[{index}]가 객체가 아닙니다.")
        op = str(raw.get("op") or "").strip().lower()
        if op not in {"create", "update", "delete", "attach", "detach"}:
            raise ValueError(f"operations[{index}].op가 올바르지 않습니다.")
        if op == "create":
            element = raw.get("element")
            if not isinstance(element, dict):
                raise ValueError(f"operations[{index}].element가 필요합니다.")
            target_id = _identifier(element.get("id"), f"operations[{index}].element.id")
        else:
            target_id = _identifier(raw.get("id"), f"operations[{index}].id")
        exact = (op, target_id)
        if exact in seen_exact:
            raise ValueError(f"같은 transaction에 중복된 {op} 명령이 있습니다: {target_id}")
        seen_exact.add(exact)
        parsed.append((index, op, target_id, copy.deepcopy(raw)))
    return parsed


def _apply_command_phases(candidate, parsed, base_elements):
    elements = {str(entry.get("id")): copy.deepcopy(entry) for entry in candidate.get("elements") or []}
    base_by_id = {str(entry.get("id")): entry for entry in base_elements}
    base_attachment = _attachment_snapshot(base_elements)
    explicit_attachment = {}
    position_touched = set()
    nondelete_targets = set()
    delete_commands = {}

    for _, op, target_id, raw in parsed:
        if op == "delete":
            delete_commands[target_id] = bool(raw.get("cascade", False))
        else:
            nondelete_targets.add(target_id)
    conflict = sorted(set(delete_commands) & nondelete_targets)
    if conflict:
        raise ValueError(f"delete와 다른 명령을 같은 ID에 동시에 사용할 수 없습니다: {', '.join(conflict[:8])}")

    # Phase 1: all creates. This makes input order irrelevant for later dependency commands.
    for index, op, target_id, raw in parsed:
        if op != "create":
            continue
        if target_id in elements:
            raise ValueError(f"create 대상 ID가 이미 존재합니다: {target_id}")
        element = copy.deepcopy(raw["element"])
        element["id"] = target_id
        if element.get("attachment_t") is not None:
            explicit_attachment[target_id] = _finite(element.pop("attachment_t"), f"operations[{index}].element.attachment_t")
        if element.get("world_x_m") is not None or element.get("world_z_m") is not None:
            position_touched.add(target_id)
        elements[target_id] = element

    # Phase 2: partial updates.
    for index, op, target_id, raw in parsed:
        if op != "update":
            continue
        if target_id not in elements:
            raise ValueError(f"update 대상 ID가 존재하지 않습니다: {target_id}")
        changes = raw.get("changes")
        if not isinstance(changes, dict) or not changes:
            raise ValueError(f"operations[{index}].changes가 필요합니다.")
        if "id" in changes:
            raise ValueError("stable identity를 위해 update로 id를 변경할 수 없습니다.")
        if "parent_id" in changes:
            raise ValueError("parent_id 변경은 attach/detach 명령을 사용하세요.")
        changes = copy.deepcopy(changes)
        if changes.get("attachment_t") is not None:
            explicit_attachment[target_id] = _finite(changes.pop("attachment_t"), f"operations[{index}].changes.attachment_t")
        if any(key in changes for key in ("world_x_m", "world_z_m", "start_x_m", "start_z_m", "end_x_m", "end_z_m")):
            position_touched.add(target_id)
        elements[target_id].update(changes)

    # Phase 3: attach/detach after creates and updates, regardless of request order.
    for index, op, target_id, raw in parsed:
        if op not in {"attach", "detach"}:
            continue
        if target_id not in elements:
            raise ValueError(f"{op} 대상 ID가 존재하지 않습니다: {target_id}")
        if op == "detach":
            elements[target_id].pop("parent_id", None)
            explicit_attachment.pop(target_id, None)
            continue
        parent_id = _identifier(raw.get("parent_id"), f"operations[{index}].parent_id")
        elements[target_id]["parent_id"] = parent_id
        if raw.get("attachment_t") is None:
            raise ValueError(f"attach에는 attachment_t가 필요합니다: {target_id}")
        explicit_attachment[target_id] = _finite(raw.get("attachment_t"), f"operations[{index}].attachment_t")

    # Phase 4: deletes. Children must be explicitly deleted or cascade must be requested.
    requested_delete = set(delete_commands)
    if requested_delete:
        missing = sorted(item_id for item_id in requested_delete if item_id not in elements)
        if missing:
            raise ValueError(f"delete 대상 ID가 존재하지 않습니다: {', '.join(missing[:8])}")
        changed = True
        while changed:
            changed = False
            for item_id, element in list(elements.items()):
                parent_id = str(element.get("parent_id") or "")
                if parent_id in requested_delete and item_id not in requested_delete:
                    if delete_commands.get(parent_id, False):
                        requested_delete.add(item_id)
                        delete_commands[item_id] = True
                        changed = True
                    else:
                        raise ValueError(f"'{parent_id}' 삭제 시 child '{item_id}'가 남습니다. child를 먼저 삭제하거나 cascade=true를 사용하세요.")
        for item_id in requested_delete:
            elements.pop(item_id, None)
            explicit_attachment.pop(item_id, None)

    candidate["elements"] = list(elements.values())
    return base_by_id, base_attachment, explicit_attachment, position_touched, requested_delete


def _validate_parent_graph(elements):
    by_id = {str(entry.get("id")): entry for entry in elements}
    for element in elements:
        parent_id = str(element.get("parent_id") or "")
        if not parent_id:
            continue
        if parent_id == element["id"]:
            raise ValueError(f"element '{element['id']}'가 자기 자신을 parent로 참조합니다.")
        if parent_id not in by_id:
            raise ValueError(f"element '{element['id']}' parent_id가 존재하지 않습니다: {parent_id}")

    state = {}
    order = []

    def visit(item_id):
        marker = state.get(item_id, 0)
        if marker == 1:
            raise ValueError(f"parent dependency cycle이 감지되었습니다: {item_id}")
        if marker == 2:
            return
        state[item_id] = 1
        parent_id = str(by_id[item_id].get("parent_id") or "")
        if parent_id:
            visit(parent_id)
        state[item_id] = 2
        order.append(item_id)

    for item_id in sorted(by_id):
        visit(item_id)
    return order


def _resolve_openings(elements, base_attachment, explicit_attachment, position_touched, warnings):
    by_id = {str(entry.get("id")): entry for entry in elements}
    for child in elements:
        if child.get("kind") not in OPENING_KINDS:
            continue
        parent_id = str(child.get("parent_id") or "")
        if not parent_id:
            continue
        parent = by_id[parent_id]
        if parent.get("kind") not in OPENING_PARENT_KINDS:
            raise ValueError(f"opening '{child['id']}' parent는 wall/partition/railing이어야 합니다: {parent_id}")
        sx, sz, ex, ez, parent_length = _element_line(parent)
        width = _finite(child.get("width_m"), f"opening '{child['id']}'.width_m")
        if width <= 0:
            raise ValueError(f"opening '{child['id']}' width_m은 0보다 커야 합니다.")
        if width > parent_length + 1e-6:
            raise ValueError(
                f"opening-too-wide: '{child['id']}' width {width:.3f}m > parent '{parent_id}' length {parent_length:.3f}m"
            )

        if child["id"] in explicit_attachment:
            raw_t = explicit_attachment[child["id"]]
        elif child["id"] in position_touched:
            raw_t = _project_attachment_t(child, parent)
        elif child["id"] in base_attachment and base_attachment[child["id"]]["parent_id"] == parent_id:
            raw_t = base_attachment[child["id"]]["attachment_t"]
        elif child.get("world_x_m") is not None and child.get("world_z_m") is not None:
            raw_t = _project_attachment_t(child, parent)
        else:
            raise ValueError(f"opening '{child['id']}' 위치를 결정하려면 attachment_t 또는 world_x_m/world_z_m가 필요합니다.")

        raw_t = _finite(raw_t, f"opening '{child['id']}'.attachment_t")
        if raw_t < -ATTACHMENT_HARD_TOLERANCE or raw_t > 1 + ATTACHMENT_HARD_TOLERANCE:
            raise ValueError(f"opening '{child['id']}' attachment_t={raw_t:.4f}가 wall 범위를 크게 벗어났습니다.")
        half_fraction = min(0.5, width / (2 * parent_length))
        min_t, max_t = half_fraction, 1.0 - half_fraction
        clamped_t = min(max(raw_t, min_t), max_t)
        if abs(clamped_t - raw_t) > 1e-9:
            warnings.append({
                "code": "opening-attachment-clamped",
                "id": child["id"],
                "parent_id": parent_id,
                "requested_t": round(raw_t, 6),
                "applied_t": round(clamped_t, 6),
                "message": "opening 중심을 parent wall 내부 유효 범위로 clamp했습니다.",
            })
        dx, dz = ex - sx, ez - sz
        child["world_x_m"] = sx + dx * clamped_t
        child["world_z_m"] = sz + dz * clamped_t
        child["rotation_deg"] = math.degrees(math.atan2(dz, dx))


def _actor_id_conflicts(blocking, candidate_elements):
    persisted = blocking.get("setMasterPlan") if isinstance(blocking.get("setMasterPlan"), dict) else {}
    generated = {str(value) for value in persisted.get("generatedItemIds") or []}
    nonset_ids = {
        str(item.get("id")) for item in blocking.get("items", [])
        if item.get("id") and str(item.get("id")) not in generated
    }
    conflicts = sorted(str(entry.get("id")) for entry in candidate_elements if str(entry.get("id")) in nonset_ids)
    if conflicts:
        raise ValueError(f"Master Set ID가 기존 actor/non-set item과 충돌합니다: {', '.join(conflicts[:8])}")


def _element_fingerprint(element):
    keys = (
        "id", "name", "kind", "role", "basis", "confidence", "collection_id", "parent_id",
        "world_x_m", "world_z_m", "width_m", "height_m", "depth_m", "rotation_deg",
        "mounted_height_m", "asset_type", "color", "visible", "include_in_scene", "locked",
        "motion_enabled", "notes", "start_x_m", "start_z_m", "end_x_m", "end_z_m", "thickness_m",
    )
    payload = {key: element.get(key) for key in keys if element.get(key) is not None}
    return json.dumps(payload, sort_keys=True, ensure_ascii=False, separators=(",", ":"))


def _diff(base_elements, candidate_elements):
    before = {str(entry.get("id")): entry for entry in base_elements}
    after = {str(entry.get("id")): entry for entry in candidate_elements}
    created = sorted(set(after) - set(before))
    deleted = sorted(set(before) - set(after))
    updated = sorted(item_id for item_id in set(before) & set(after) if _element_fingerprint(before[item_id]) != _element_fingerprint(after[item_id]))
    return {"created": created, "updated": updated, "deleted": deleted}


def _prepare_transaction(args, blocking):
    mode = str(args.get("mode") or "patch").strip().lower()
    if mode not in {"patch", "replace"}:
        raise ValueError("mode는 patch 또는 replace여야 합니다.")
    base_plan = _current_raw_plan(blocking)
    base_elements = copy.deepcopy(base_plan.get("elements") or [])
    candidate = copy.deepcopy(base_plan if mode == "patch" else {
        "source_name": "MCP Spatial Set",
        "unit": "meter",
        "elements": [],
        "collections": [],
        "notes": "",
    })
    if args.get("source_name"):
        candidate["source_name"] = str(args.get("source_name"))[:160]
    _upsert_collections(candidate, args.get("collections"))
    parsed = _parse_operations(args.get("operations"))
    _, base_attachment, explicit_attachment, position_touched, _ = _apply_command_phases(candidate, parsed, base_elements)
    if not candidate.get("elements"):
        raise ValueError("Master Set은 하나 이상의 element가 필요합니다. 전체 비우기는 별도 clear 명령으로 처리해야 합니다.")

    dependency_order = _validate_parent_graph(candidate["elements"])
    warnings = []
    _resolve_openings(candidate["elements"], base_attachment, explicit_attachment, position_touched, warnings)
    _actor_id_conflicts(blocking, candidate["elements"])
    normalized = sets.normalize_master_plan(
        candidate,
        blocking=blocking,
        allow_outside_stage=bool(args.get("allow_outside_stage", False)),
        minimum_reliable_confidence=0.0,
    )
    diff = _diff(base_elements, candidate["elements"])
    return {
        "mode": mode,
        "candidate": candidate,
        "normalized": normalized,
        "diff": diff,
        "warnings": warnings,
        "dependency_order": dependency_order,
        "base_elements": base_elements,
        "collection_metadata_requested": bool(args.get("collections")),
    }


def _operation_for_element(element, current_ids):
    return {
        "op": "update_dummy" if element["id"] in current_ids else "add_dummy",
        "id": element["id"],
        "type": "prop",
        "name": element["name"],
        "asset_type": element["asset_type"],
        "world_x_m": element["world_x_m"],
        "world_z_m": element["world_z_m"],
        "facing": element["rotation_deg"],
        "mounted_height": element["mounted_height_m"],
        "color": element["color"],
        "visible": element["visible"],
        "anchor_id": element["id"],
        "physical_dimensions_m": {
            "width": element["width_m"],
            "height": element["height_m"],
            "depth": element["depth_m"],
        },
    }


def _compile_delta_operations(prepared, blocking):
    normalized = prepared["normalized"]
    diff = prepared["diff"]
    current_ids = {str(item.get("id")) for item in blocking.get("items", [])}
    changed_ids = set(diff["created"]) | set(diff["updated"])
    operations = [{"op": "remove_dummy", "id": item_id} for item_id in diff["deleted"] if item_id in current_ids]
    by_id = {entry["id"]: entry for entry in normalized["elements"] if entry["include_in_scene"]}
    for item_id in prepared["dependency_order"]:
        if item_id not in changed_ids or item_id not in by_id:
            continue
        element = by_id[item_id]
        bounds = sets._element_bounds(element)
        stage_width, stage_depth = space.stage_dimensions(blocking.get("aspect", "16:9"))
        half_w, half_d = stage_width / 2, stage_depth / 2
        if (
            bounds["min_x"] < -half_w or bounds["max_x"] > half_w
            or bounds["min_z"] < -half_d or bounds["max_z"] > half_d
        ):
            raise ValueError(f"set-element-outside-stage: '{item_id}'가 현재 {stage_width:.2f}m × {stage_depth:.2f}m 무대 밖입니다.")
        operations.append(_operation_for_element(element, current_ids))
    if len(operations) > MAX_COMMANDS:
        raise ValueError(f"실행 stage operation이 {MAX_COMMANDS}개를 초과했습니다.")
    return operations


def _anchors(normalized):
    result = []
    for element in normalized["elements"]:
        if not element["include_in_scene"]:
            continue
        result.append({
            "id": element["id"],
            "label": element["name"],
            "kind": f"set-{element['kind']}",
            "world_x_m": element["world_x_m"],
            "world_z_m": element["world_z_m"],
            "physical_dimensions_m": {
                "width": element["width_m"],
                "height": element["height_m"],
                "depth": element["depth_m"],
            },
            "confidence": element["confidence"],
            "attached_item_id": element["id"],
        })
    return result


def _validation_report(args, prepared):
    normalized = prepared["normalized"]
    diff = prepared["diff"]
    return {
        "schema": "frisframe-spatial-command-validation",
        "version": 1,
        "policy": COMMAND_POLICY,
        "valid": True,
        "status": "review" if normalized.get("issues") else "ready",
        "transaction_id": str(args.get("transaction_id") or "")[:120],
        "mode": prepared["mode"],
        "command_count": len(args.get("operations") or []),
        "dependency_order": prepared["dependency_order"],
        "diff": {
            **diff,
            "created_count": len(diff["created"]),
            "updated_count": len(diff["updated"]),
            "deleted_count": len(diff["deleted"]),
        },
        "warnings": prepared["warnings"],
        "review_issues": copy.deepcopy(normalized.get("issues") or []),
        "candidate": {
            "element_count": normalized["summary"]["element_count"],
            "collection_count": normalized["summary"]["collection_count"],
            "bounds": copy.deepcopy(normalized.get("bounds") or {}),
        },
        "atomic_policy": "validate-all-then-single-commit-or-zero-change",
        "semantic_inference": False,
    }


def validate_commands(args):
    scene_index = int(args.get("scene_index", 0))
    cut_index = int(args.get("cut_index", 0))
    blocking = _blocking(args.get("project_id"), scene_index, cut_index)
    prepared = _prepare_transaction(args, blocking)
    _compile_delta_operations(prepared, blocking)
    return _validation_report(args, prepared)


def apply_commands(args):
    project_id = args.get("project_id")
    revision = int(args["revision"])
    scene_index = int(args.get("scene_index", 0))
    cut_index = int(args.get("cut_index", 0))
    blocking = _blocking(project_id, scene_index, cut_index)
    prepared = _prepare_transaction(args, blocking)
    operations = _compile_delta_operations(prepared, blocking)
    report = _validation_report(args, prepared)

    if not operations and not prepared["collection_metadata_requested"]:
        return {
            "project_id": project_id,
            "revision": revision,
            "applied": False,
            "no_op": True,
            "command_result": report,
        }

    normalized = prepared["normalized"]
    spatial_guide = reference._merge_guide(blocking, normalized["source_name"], _anchors(normalized))
    applied_elements = [entry for entry in normalized["elements"] if entry["include_in_scene"]]

    def apply_atomic(project_obj):
        payload = base._target_args(args, revision)
        payload["operations"] = operations
        payload["spatial_guide"] = spatial_guide
        if operations:
            stage_result = base._json_result(core.handle_apply_scene_commands(project_id, payload))
            stage_detail = base._json_result(stage_result.get("message", ""))
            if not isinstance(stage_detail, dict):
                raise ValueError("spatial command stage 결과를 읽지 못했습니다.")
        else:
            stage_detail = {"operation_count": 0}
        current_blocking = sets._blocking_from_project(project_obj, scene_index, cut_index)
        collections = sets._persist_plan(
            current_blocking,
            normalized,
            applied_elements,
            bool(args.get("lock_after_apply", False)),
        )
        return {"stage": stage_detail, "collections": collections}

    committed = base._json_result(core.mutate_project_atomic(project_id, revision, apply_atomic))
    detail = committed.get("message")
    if not isinstance(detail, dict):
        detail = base._json_result(detail)
    return {
        "project_id": project_id,
        "revision": committed["revision"],
        "updated_at": committed.get("updated_at"),
        "applied": True,
        "no_op": False,
        "command_result": {
            **report,
            "atomic_revision": True,
            "stage_operation_count": len(operations),
        },
        "stage": detail.get("stage") if isinstance(detail, dict) else detail,
        "collections": detail.get("collections") if isinstance(detail, dict) else None,
    }


def master_set_snapshot(args):
    scene_index = int(args.get("scene_index", 0))
    cut_index = int(args.get("cut_index", 0))
    blocking = _blocking(args.get("project_id"), scene_index, cut_index)
    plan = blocking.get("setMasterPlan") if isinstance(blocking.get("setMasterPlan"), dict) else None
    collections = blocking.get("setCollections") if isinstance(blocking.get("setCollections"), list) else []
    generated_ids = [] if plan is None else [str(value) for value in plan.get("generatedItemIds") or []]
    item_map = {str(item.get("id")): item for item in blocking.get("items", [])}
    return {
        "schema": "frisframe-master-set-snapshot",
        "version": 1,
        "policy": COMMAND_POLICY,
        "present": plan is not None,
        "master_set": copy.deepcopy(plan),
        "collections": copy.deepcopy(collections),
        "generated_items": [copy.deepcopy(item_map[item_id]) for item_id in generated_ids if item_id in item_map],
        "generated_item_count": len(generated_ids),
        "camera_untouched_by_snapshot": True,
    }


def command_contract():
    return {
        "schema": "frisframe-spatial-command-contract",
        "version": 1,
        "policy": COMMAND_POLICY,
        "product_boundary": {
            "codex_mcp": [
                "interpret reference images",
                "choose real-world dimensions and spatial meaning",
                "send metric spatial commands with stable ids",
            ],
            "frisframe": [
                "validate commands",
                "resolve parent dependencies",
                "execute exact metric geometry",
                "maintain authoritative Master Set",
                "commit atomically",
                "report exact results",
            ],
            "frisframe_semantic_guessing": False,
        },
        "commands": {
            "create": "Create a stable-id Master Set element. Input order does not matter.",
            "update": "Patch fields on an existing stable id; id changes are forbidden.",
            "delete": "Delete an element; parent deletion requires child deletion or cascade=true.",
            "attach": "Attach an opening to a parent wall using attachment_t.",
            "detach": "Remove the parent relation while retaining current world geometry.",
        },
        "execution": [
            "load authoritative Master Set",
            "apply commands to an in-memory candidate",
            "resolve parent dependency graph",
            "resolve opening placement from parent wall",
            "validate dimensions/ids/collections/stage bounds",
            "compile only changed stage operations",
            "single atomic commit or zero change",
            "return diff, warnings, revision, and snapshot-readable stable ids",
        ],
        "deterministic_repairs": {
            "allowed": ["tiny opening attachment clamp", "parent-based opening rotation/position"],
            "forbidden": ["invent missing wall", "change object semantic kind automatically", "guess a parent that MCP did not specify"],
        },
        "authoritative_state": "setMasterPlan -> same blocking items/referenceDimensionsM -> 2D/2.5D/3D",
        "partial_updates": True,
        "stable_identity": True,
        "rollback_on_failure": True,
    }


_PREVIOUS_CALL_TOOL = base.call_tool


def call_tool(name, args):
    if name == "get_spatial_command_contract":
        return json.dumps(command_contract(), ensure_ascii=False)
    if name == "validate_spatial_set_commands":
        return json.dumps(validate_commands(args), ensure_ascii=False)
    if name == "apply_spatial_set_commands":
        return json.dumps(apply_commands(args), ensure_ascii=False)
    if name == "get_master_set_snapshot":
        return json.dumps(master_set_snapshot(args), ensure_ascii=False)
    return _PREVIOUS_CALL_TOOL(name, args)


def install():
    if getattr(base, "_spatial_command_extension_installed", False):
        return
    existing = {tool.get("name") for tool in base.TOOLS}
    for tool in (CONTRACT_TOOL, VALIDATE_TOOL, APPLY_TOOL, SNAPSHOT_TOOL):
        if tool["name"] not in existing:
            base.TOOLS.append(tool)
    base.call_tool = call_tool
    base._spatial_command_extension_installed = True


install()
