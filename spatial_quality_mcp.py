#!/usr/bin/env python3
"""Deterministic geometry-quality pass for the reference -> Master Set pipeline.

External vision remains responsible for reading pixels. This extension only
cleans and validates spatial geometry that has already been interpreted:
nearby wall endpoints are canonicalized, openings can attach to a nearby wall,
closed wall loops become derived room zones, and topology is reported before
the Master Set is compiled/applied.
"""

from __future__ import annotations

import copy
import json
import math

import mcp_previs_server as base
import reference_master_pipeline_mcp as pipeline


LINEAR_KINDS = {"wall", "partition", "railing"}
OPENING_KINDS = {"door", "window"}
DEFAULT_ENDPOINT_SNAP_TOLERANCE_M = 0.15
DEFAULT_OPENING_ATTACH_TOLERANCE_M = 0.35
DEFAULT_OPENING_ROTATION_TOLERANCE_DEG = 20.0
MIN_ROOM_AREA_M2 = 0.25

_PREVIOUS_CALL_TOOL = base.call_tool


def _finite(value, fallback=0.0):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return float(fallback)
    return number if math.isfinite(number) else float(fallback)


def _kind(entry):
    if not isinstance(entry, dict):
        return "generic"
    explicit = str(entry.get("kind") or "").strip()
    if explicit:
        return explicit
    return pipeline.ASSET_KIND_MAP.get(str(entry.get("asset_type") or "").strip(), "generic")


def _complete_line(entry):
    if not isinstance(entry, dict):
        return False
    return all(entry.get(key) is not None for key in ("start_x_m", "start_z_m", "end_x_m", "end_z_m"))


def _opening_center(entry):
    if not isinstance(entry, dict):
        return None
    if entry.get("world_x_m") is None or entry.get("world_z_m") is None:
        return None
    x = _finite(entry.get("world_x_m"), float("nan"))
    z = _finite(entry.get("world_z_m"), float("nan"))
    if not math.isfinite(x) or not math.isfinite(z):
        return None
    return (x, z)


def _angle_delta_mod_180(left, right):
    delta = abs((_finite(left) - _finite(right)) % 180.0)
    return min(delta, 180.0 - delta)


def _project_point_to_segment(point, wall):
    px, pz = point
    sx = _finite(wall["start_x_m"])
    sz = _finite(wall["start_z_m"])
    ex = _finite(wall["end_x_m"])
    ez = _finite(wall["end_z_m"])
    dx = ex - sx
    dz = ez - sz
    length_sq = dx * dx + dz * dz
    if length_sq <= 1e-9:
        return None
    t = ((px - sx) * dx + (pz - sz) * dz) / length_sq
    clamped = max(0.0, min(1.0, t))
    qx = sx + dx * clamped
    qz = sz + dz * clamped
    distance = math.hypot(px - qx, pz - qz)
    angle = math.degrees(math.atan2(dz, dx))
    return {"t": t, "x": qx, "z": qz, "distance_m": distance, "rotation_deg": angle}


def _snap_wall_endpoints(objects, tolerance_m):
    refs = []
    for object_index, entry in enumerate(objects):
        if _kind(entry) not in LINEAR_KINDS or not _complete_line(entry):
            continue
        refs.append((object_index, "start", _finite(entry["start_x_m"]), _finite(entry["start_z_m"])))
        refs.append((object_index, "end", _finite(entry["end_x_m"]), _finite(entry["end_z_m"])))

    parent = list(range(len(refs)))

    def find(index):
        while parent[index] != index:
            parent[index] = parent[parent[index]]
            index = parent[index]
        return index

    def union(left, right):
        a, b = find(left), find(right)
        if a != b:
            parent[b] = a

    for left in range(len(refs)):
        for right in range(left + 1, len(refs)):
            if refs[left][0] == refs[right][0]:
                continue
            if math.hypot(refs[left][2] - refs[right][2], refs[left][3] - refs[right][3]) <= tolerance_m:
                union(left, right)

    groups = {}
    for index, ref in enumerate(refs):
        groups.setdefault(find(index), []).append((index, ref))

    snapped_endpoints = 0
    snap_clusters = 0
    for members in groups.values():
        if len(members) < 2:
            continue
        x = sum(ref[2] for _, ref in members) / len(members)
        z = sum(ref[3] for _, ref in members) / len(members)
        changed = False
        for _, (object_index, endpoint, old_x, old_z) in members:
            entry = objects[object_index]
            if math.hypot(old_x - x, old_z - z) > 1e-8:
                snapped_endpoints += 1
                changed = True
            entry[f"{endpoint}_x_m"] = x
            entry[f"{endpoint}_z_m"] = z
        if changed:
            snap_clusters += 1
    return snapped_endpoints, snap_clusters


def _attach_openings(objects, tolerance_m, rotation_tolerance_deg):
    walls = [entry for entry in objects if _kind(entry) in LINEAR_KINDS and _complete_line(entry)]
    inferred = []
    for entry in objects:
        if _kind(entry) not in OPENING_KINDS or entry.get("parent_id"):
            continue
        center = _opening_center(entry)
        if center is None:
            continue
        candidates = []
        for wall in walls:
            projection = _project_point_to_segment(center, wall)
            if not projection:
                continue
            if not (-0.03 <= projection["t"] <= 1.03):
                continue
            if projection["distance_m"] <= tolerance_m:
                candidates.append((projection["distance_m"], str(wall.get("id") or ""), wall, projection))
        if not candidates:
            continue
        candidates.sort(key=lambda candidate: (candidate[0], candidate[1]))
        distance, _, wall, projection = candidates[0]
        wall_id = str(wall.get("id") or "").strip()
        if not wall_id:
            continue
        entry["parent_id"] = wall_id
        raw_rotation = entry.get("rotation_deg")
        if raw_rotation is None or _angle_delta_mod_180(raw_rotation, projection["rotation_deg"]) <= rotation_tolerance_deg:
            entry["rotation_deg"] = projection["rotation_deg"]
        note = str(entry.get("notes") or "").strip()
        attachment_note = f"Spatial quality: inferred attachment to {wall_id} ({distance:.3f}m)."
        entry["notes"] = f"{note} {attachment_note}".strip()[:500]
        inferred.append({
            "opening_id": str(entry.get("id") or ""),
            "wall_id": wall_id,
            "distance_m": round(distance, 4),
        })
    return inferred


def _wall_graph(objects, tolerance_m):
    walls = [entry for entry in objects if _kind(entry) in LINEAR_KINDS and _complete_line(entry)]
    nodes = []
    edges = []

    def node_for(x, z):
        for index, node in enumerate(nodes):
            if math.hypot(node[0] - x, node[1] - z) <= tolerance_m:
                return index
        nodes.append((x, z))
        return len(nodes) - 1

    for wall in walls:
        start = node_for(_finite(wall["start_x_m"]), _finite(wall["start_z_m"]))
        end = node_for(_finite(wall["end_x_m"]), _finite(wall["end_z_m"]))
        if start == end:
            continue
        edges.append({"start": start, "end": end, "wall_id": str(wall.get("id") or "")})
    return walls, nodes, edges


def _topology_report(objects, tolerance_m):
    walls, nodes, edges = _wall_graph(objects, tolerance_m)
    if not walls:
        return {
            "wall_count": 0,
            "endpoint_count": 0,
            "open_endpoint_count": 0,
            "junction_count": 0,
            "connected_component_count": 0,
        }

    adjacency = {index: set() for index in range(len(nodes))}
    degree = {index: 0 for index in range(len(nodes))}
    for edge in edges:
        left, right = edge["start"], edge["end"]
        adjacency[left].add(right)
        adjacency[right].add(left)
        degree[left] += 1
        degree[right] += 1

    visited = set()
    components = 0
    for start in adjacency:
        if start in visited:
            continue
        components += 1
        stack = [start]
        while stack:
            node = stack.pop()
            if node in visited:
                continue
            visited.add(node)
            stack.extend(adjacency[node] - visited)

    return {
        "wall_count": len(walls),
        "endpoint_count": len(nodes),
        "open_endpoint_count": sum(1 for value in degree.values() if value == 1),
        "junction_count": sum(1 for value in degree.values() if value > 2),
        "connected_component_count": components,
    }


def _polygon_area(points):
    area2 = 0.0
    for index, point in enumerate(points):
        next_point = points[(index + 1) % len(points)]
        area2 += point[0] * next_point[1] - next_point[0] * point[1]
    return area2 / 2.0


def _polygon_perimeter(points):
    return sum(
        math.hypot(points[index][0] - points[(index + 1) % len(points)][0],
                   points[index][1] - points[(index + 1) % len(points)][1])
        for index in range(len(points))
    )


def _derive_room_zones(objects, tolerance_m):
    """Return bounded planar faces from existing wall edges only.

    No wall is created here. Near endpoints have already been canonicalized by
    the snap pass. The half-edge walk keeps each bounded face on the left and
    naturally supports adjacent rooms that share walls.
    """
    _, nodes, edges = _wall_graph(objects, tolerance_m)
    if len(edges) < 3:
        return []

    neighbors = {index: [] for index in range(len(nodes))}
    wall_by_pair = {}
    for edge in edges:
        left, right = edge["start"], edge["end"]
        neighbors[left].append(right)
        neighbors[right].append(left)
        wall_by_pair[(min(left, right), max(left, right))] = edge["wall_id"]

    for node_id, values in neighbors.items():
        values.sort(key=lambda other: math.atan2(nodes[other][1] - nodes[node_id][1], nodes[other][0] - nodes[node_id][0]))

    visited = set()
    faces = []
    directed = []
    for edge in edges:
        directed.append((edge["start"], edge["end"]))
        directed.append((edge["end"], edge["start"]))

    for start_a, start_b in directed:
        start_key = (start_a, start_b)
        if start_key in visited:
            continue
        polygon_nodes = []
        wall_ids = []
        a, b = start_a, start_b
        for _ in range(len(edges) * 4 + 8):
            key = (a, b)
            if key in visited and key != start_key:
                break
            visited.add(key)
            polygon_nodes.append(a)
            wall_ids.append(wall_by_pair.get((min(a, b), max(a, b)), ""))
            options = neighbors.get(b) or []
            if not options or a not in options:
                break
            reverse_index = options.index(a)
            next_node = options[(reverse_index - 1) % len(options)]
            a, b = b, next_node
            if (a, b) == start_key:
                points = [nodes[node_id] for node_id in polygon_nodes]
                area = _polygon_area(points)
                if len(points) >= 3 and area > MIN_ROOM_AREA_M2:
                    faces.append({
                        "points": points,
                        "area_m2": area,
                        "perimeter_m": _polygon_perimeter(points),
                        "wall_ids": list(dict.fromkeys(item for item in wall_ids if item)),
                    })
                break

    faces.sort(key=lambda face: face["area_m2"], reverse=True)
    zones = []
    for index, face in enumerate(faces):
        zones.append({
            "id": f"room-zone-{index + 1}",
            "name": f"Room {index + 1}",
            "polygon": [
                {"x_m": round(point[0], 4), "z_m": round(point[1], 4)}
                for point in face["points"]
            ],
            "area_m2": round(face["area_m2"], 4),
            "perimeter_m": round(face["perimeter_m"], 4),
            "wall_ids": face["wall_ids"],
            "basis": "derived-closed-wall-loop",
        })
    return zones


def enhance_interpretation(raw, *, endpoint_snap_tolerance_m=DEFAULT_ENDPOINT_SNAP_TOLERANCE_M,
                           opening_attach_tolerance_m=DEFAULT_OPENING_ATTACH_TOLERANCE_M,
                           opening_rotation_tolerance_deg=DEFAULT_OPENING_ROTATION_TOLERANCE_DEG):
    if not isinstance(raw, dict):
        raise ValueError("interpretation은 객체여야 합니다.")
    result = copy.deepcopy(raw)
    objects = result.get("objects")
    if not isinstance(objects, list):
        raise ValueError("interpretation.objects는 배열이어야 합니다.")

    endpoint_snap_tolerance_m = max(0.01, min(0.5, _finite(endpoint_snap_tolerance_m, DEFAULT_ENDPOINT_SNAP_TOLERANCE_M)))
    opening_attach_tolerance_m = max(0.05, min(1.0, _finite(opening_attach_tolerance_m, DEFAULT_OPENING_ATTACH_TOLERANCE_M)))
    opening_rotation_tolerance_deg = max(0.0, min(45.0, _finite(opening_rotation_tolerance_deg, DEFAULT_OPENING_ROTATION_TOLERANCE_DEG)))

    snapped_endpoints, snap_clusters = _snap_wall_endpoints(objects, endpoint_snap_tolerance_m)
    attachments = _attach_openings(objects, opening_attach_tolerance_m, opening_rotation_tolerance_deg)
    topology_tolerance = endpoint_snap_tolerance_m * 0.5
    topology = _topology_report(objects, topology_tolerance)
    room_zones = _derive_room_zones(objects, topology_tolerance)
    result["derived_room_zones"] = copy.deepcopy(room_zones)

    warnings = []
    if topology["open_endpoint_count"]:
        warnings.append({
            "code": "open-wall-endpoints",
            "severity": "review",
            "count": topology["open_endpoint_count"],
            "message": "닫히지 않은 벽 끝점이 있습니다. 보이지 않는 벽을 임의 생성하지 않고 검토 대상으로 남겼습니다.",
        })
    if topology["connected_component_count"] > 1:
        warnings.append({
            "code": "disconnected-wall-components",
            "severity": "review",
            "count": topology["connected_component_count"],
            "message": "벽 구조가 둘 이상의 연결 컴포넌트로 나뉩니다.",
        })
    if topology["junction_count"]:
        warnings.append({
            "code": "wall-junctions",
            "severity": "info",
            "count": topology["junction_count"],
            "message": "T/X 형태 벽 접합부가 감지되었습니다.",
        })

    report = {
        "policy": "deterministic-spatial-quality-v2",
        "status": "review" if any(item["severity"] == "review" for item in warnings) else "ready",
        "endpoint_snap_tolerance_m": endpoint_snap_tolerance_m,
        "opening_attach_tolerance_m": opening_attach_tolerance_m,
        "opening_rotation_tolerance_deg": opening_rotation_tolerance_deg,
        "snapped_endpoint_count": snapped_endpoints,
        "snap_cluster_count": snap_clusters,
        "inferred_attachment_count": len(attachments),
        "inferred_attachments": attachments,
        "room_zone_count": len(room_zones),
        "room_zones": room_zones,
        "topology": topology,
        "warnings": warnings,
        "guardrail": "Room zones are derived only from closed existing wall loops; no missing wall is synthesized.",
    }
    return result, report


def _quality_args(args):
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

def _add_quality_schema(tool):
    schema = tool.get("inputSchema") if isinstance(tool, dict) else None
    properties = schema.get("properties") if isinstance(schema, dict) else None
    if not isinstance(properties, dict):
        return
    properties.setdefault("endpoint_snap_tolerance_m", {
        "type": "number", "minimum": 0.01, "maximum": 0.5,
        "description": "서로 같은 코너로 보이는 벽 끝점을 합칠 최대 거리. 기본 0.15m.",
    })
    properties.setdefault("opening_attach_tolerance_m", {
        "type": "number", "minimum": 0.05, "maximum": 1.0,
        "description": "문/창을 가까운 벽에 추론 부착할 최대 거리. 기본 0.35m.",
    })
    properties.setdefault("opening_rotation_tolerance_deg", {
        "type": "number", "minimum": 0, "maximum": 45,
        "description": "문/창 방향을 벽 방향으로 정렬할 허용 각도. 기본 20도.",
    })


def call_tool(name, args):
    if name in {"compile_reference_master_plan", "apply_reference_master_set"}:
        enhanced_args, report = _quality_args(args)
        payload = json.loads(_PREVIOUS_CALL_TOOL(name, enhanced_args))
        if isinstance(payload, dict):
            payload["spatial_quality"] = report
        return json.dumps(payload, ensure_ascii=False)
    if name == "get_reference_master_set_contract":
        payload = json.loads(_PREVIOUS_CALL_TOOL(name, args))
        if isinstance(payload, dict):
            payload["spatial_quality"] = {
                "policy": "deterministic-spatial-quality-v2",
                "wall_endpoint_snap": True,
                "opening_to_wall_inference": True,
                "room_topology_diagnostics": True,
                "closed_wall_loop_room_zones": True,
                "synthesize_missing_walls": False,
                "defaults": {
                    "endpoint_snap_tolerance_m": DEFAULT_ENDPOINT_SNAP_TOLERANCE_M,
                    "opening_attach_tolerance_m": DEFAULT_OPENING_ATTACH_TOLERANCE_M,
                    "opening_rotation_tolerance_deg": DEFAULT_OPENING_ROTATION_TOLERANCE_DEG,
                },
            }
        return json.dumps(payload, ensure_ascii=False)
    return _PREVIOUS_CALL_TOOL(name, args)


def install():
    if getattr(base, "_spatial_quality_extension_installed", False):
        return
    for tool in base.TOOLS:
        if tool.get("name") in {"compile_reference_master_plan", "apply_reference_master_set"}:
            _add_quality_schema(tool)
    base.call_tool = call_tool
    base._spatial_quality_extension_installed = True


install()
