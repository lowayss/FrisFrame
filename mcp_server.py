#!/usr/bin/env python3
import sys
import json
import os
import sqlite3
import uuid
import math
import re
from datetime import datetime, timezone
from pathlib import Path

from server import (
    SUPPORTED_PROJECT_SCHEMA_VERSION,
    initialize_database,
    project_summary,
    strip_retired_analysis_metadata,
    validate_managed_document,
)


STAGE_COORD_MIN = 0.02
STAGE_COORD_MAX = 0.98
CAMERA_HEIGHT_MIN = 0.4
CAMERA_HEIGHT_MAX = 35.0
CAMERA_TILT_MIN = -90.0
CAMERA_TILT_MAX = 90.0
CAMERA_FOCAL_MIN = 14
CAMERA_FOCAL_MAX = 135
MAX_TIMELINE_DURATION = 60.0
try:
    APP_VERSION = str(json.loads((Path(__file__).resolve().parent / "package.json").read_text())["version"])
except (OSError, KeyError, TypeError, ValueError, json.JSONDecodeError):
    APP_VERSION = "dev"
HEX_COLOR = re.compile(r"^#[0-9a-fA-F]{6}$")
MCP_OWNER_LICENSE_HASH = os.environ.get("FRISFRAME_MCP_OWNER_LICENSE_HASH", "local").strip() or "local"

# Helper function to find the database path
def get_db_path():
    env_path = os.environ.get("PREVIS_DB_PATH")
    if env_path:
        return env_path
    
    # Check electron production database path
    home = Path.home()
    electron_db = home / "Library" / "Application Support" / "FrisFrame" / "data" / "frisframe.db"
    if electron_db.exists():
        return str(electron_db)
    
    # Fallback to local previs_projects.db
    local_db = Path(__file__).resolve().parent / "previs_projects.db"
    return str(local_db)


def connect_db():
    db_path = Path(get_db_path()).expanduser()
    db_path.parent.mkdir(parents=True, exist_ok=True)
    initialize_database(str(db_path))
    conn = sqlite3.connect(str(db_path), timeout=10.0)
    conn.row_factory = sqlite3.Row
    return conn


def utc_now():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def clamp_number(value, minimum, maximum, field_name):
    try:
        number = float(value)
    except (TypeError, ValueError) as error:
        raise ValueError(f"{field_name} 값이 숫자가 아닙니다.") from error
    if not math.isfinite(number):
        raise ValueError(f"{field_name} 값이 유효하지 않습니다.")
    return min(maximum, max(minimum, number))


def project_document(value):
    if isinstance(value, str):
        value = json.loads(value)
    if not isinstance(value, dict):
        raise ValueError("프로젝트 문서는 JSON 객체여야 합니다.")
    if isinstance(value.get("project"), dict):
        document = value
    else:
        document = {
            "schemaVersion": SUPPORTED_PROJECT_SCHEMA_VERSION,
            "savedAt": utc_now(),
            "project": value,
        }
    schema_version = int(document.get("schemaVersion") or SUPPORTED_PROJECT_SCHEMA_VERSION)
    if schema_version > SUPPORTED_PROJECT_SCHEMA_VERSION:
        raise ValueError(
            f"이 MCP 서버보다 새로운 프로젝트 형식(v{schema_version})은 수정할 수 없습니다."
        )
    document["schemaVersion"] = max(1, schema_version)
    strip_retired_analysis_metadata(document)
    validate_managed_document(document)
    return document


def project_id_or_error(value):
    project_id = str(value or "")
    if len(project_id) != 8 or not project_id.isalnum():
        raise ValueError("프로젝트 ID가 올바르지 않습니다.")
    return project_id


def expected_revision_or_error(value):
    if value is None:
        raise ValueError("수정 전 list_projects 또는 get_project에서 확인한 revision이 필요합니다.")
    try:
        revision = int(value)
    except (TypeError, ValueError) as error:
        raise ValueError("revision 값이 올바르지 않습니다.") from error
    if revision < 1:
        raise ValueError("revision은 1 이상이어야 합니다.")
    return revision


def load_project_row(cursor, project_id):
    cursor.execute(
        "SELECT id, title, content, created_at, updated_at, revision, owner_license_hash, kind "
        "FROM projects WHERE id = ? AND owner_license_hash = ? AND kind = 'managed' AND deleted_at IS NULL",
        (project_id, MCP_OWNER_LICENSE_HASH),
    )
    row = cursor.fetchone()
    if not row:
        raise ValueError(f"프로젝트 {project_id}을(를) 찾을 수 없습니다.")
    return row


def archive_project_version(cursor, row):
    revision = int(row["revision"] or 1)
    cursor.execute(
        "INSERT OR REPLACE INTO project_versions "
        "(project_id, revision, title, content, owner_license_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        (
            row["id"],
            revision,
            row["title"],
            row["content"],
            row["owner_license_hash"],
            row["updated_at"] or row["created_at"] or utc_now(),
        ),
    )
    cursor.execute(
        "DELETE FROM project_versions WHERE project_id = ? AND id NOT IN ("
        "SELECT id FROM project_versions WHERE project_id = ? ORDER BY revision DESC LIMIT 5)",
        (row["id"], row["id"]),
    )


def save_mutated_document(cursor, row, document, expected_revision):
    current_revision = int(row["revision"] or 1)
    if current_revision != expected_revision:
        raise ValueError(
            f"revision_conflict: 현재 revision은 {current_revision}입니다. 프로젝트를 다시 불러와 주세요."
        )
    project_obj = validate_managed_document(document)
    now_str = utc_now()
    project_obj["updatedAt"] = now_str
    document["savedAt"] = now_str
    title = str(project_obj.get("title") or row["title"] or "새 프로젝트").strip()[:200] or "새 프로젝트"
    scene_count, cut_count, duration_seconds = project_summary(project_obj)
    content_str = json.dumps(document, ensure_ascii=False)
    next_revision = current_revision + 1
    archive_project_version(cursor, row)
    cursor.execute(
        "UPDATE projects SET title = ?, content = ?, updated_at = ?, opened_at = ?, size_bytes = ?, "
        "revision = ?, scene_count = ?, cut_count = ?, duration_seconds = ? WHERE id = ?",
        (
            title,
            content_str,
            now_str,
            now_str,
            len(content_str.encode("utf-8")),
            next_revision,
            scene_count,
            cut_count,
            duration_seconds,
            row["id"],
        ),
    )
    return next_revision, now_str


def mutate_project(project_id, revision, mutation):
    project_id = project_id_or_error(project_id)
    expected_revision = expected_revision_or_error(revision)
    conn = connect_db()
    try:
        cursor = conn.cursor()
        cursor.execute("BEGIN IMMEDIATE")
        row = load_project_row(cursor, project_id)
        document = project_document(json.loads(row["content"]))
        detail = mutation(document["project"])
        next_revision, updated_at = save_mutated_document(cursor, row, document, expected_revision)
        conn.commit()
        return json.dumps({
            "project_id": project_id,
            "revision": next_revision,
            "updated_at": updated_at,
            "message": detail,
        }, ensure_ascii=False)
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

# JSON Helper to output logs to stderr safely
def log_debug(message):
    sys.stderr.write(f"[DEBUG] {message}\n")
    sys.stderr.flush()

# Radian <-> Degree helpers
def deg_to_rad(deg):
    return deg * math.pi / 180.0

def rad_to_deg(rad):
    return rad * 180.0 / math.pi

# Camera auto-drafting algorithm translated to Python
def draft_camera_from_text(draft_data, actor_x=0.32, actor_y=0.46):
    combined = " ".join(filter(None, [
        draft_data.get("title"),
        draft_data.get("action"),
        draft_data.get("dialogue"),
        draft_data.get("camera"),
        draft_data.get("intent")
    ])).lower()

    # 1. Distance & focal length
    distance = 0.60
    focal = 50

    if any(k in combined for k in ["익스트림 클로즈", "extreme close", "ecu", "초근접"]):
        distance = 0.22
        focal = 100
    elif any(k in combined for k in ["클로즈", "close-up", "cu"]):
        distance = 0.35
        focal = 85
    elif any(k in combined for k in ["바스트", "medium close", "mcu"]):
        distance = 0.50
        focal = 50
    elif any(k in combined for k in ["미디엄", "medium", "ms"]):
        distance = 0.70
        focal = 35
    elif any(k in combined for k in ["풀 샷", "full shot", "fs"]):
        distance = 1.00
        focal = 28
    elif any(k in combined for k in ["와이드", "wide", "롱 샷", "long shot", "ws", "els", "익스트림 롱"]):
        distance = 1.40
        focal = 21

    # 2. Angle direction
    angle_rad = math.pi  # default: looking left
    if any(k in combined for k in ["측면", "옆면", "profile", "lateral", "side"]):
        angle_rad = -math.pi / 2.0
    elif any(k in combined for k in ["후면", "뒷모습", "뒤쪽", "rear", "back"]):
        angle_rad = 0.0
    elif any(k in combined for k in ["정면", "앞모습", "front", "frontal"]):
        angle_rad = math.pi

    # 3. Height & Tilt
    height = 1.6
    focus_height = 1.1
    tilt_deg = -6.0

    if any(k in combined for k in ["수직", "버티컬", "vertical", "overhead", "탑샷"]):
        height = 4.2
        focus_height = 0.0
        tilt_deg = -88.0
    elif any(k in combined for k in ["하이", "high"]):
        height = 3.0
        focus_height = 0.8
        tilt_deg = -25.0
    elif any(k in combined for k in ["로우", "낮은", "low", "바닥", "ground"]):
        height = 0.4
        focus_height = 1.3
        tilt_deg = 15.0

    camera_x = actor_x + math.cos(angle_rad) * distance
    camera_y = actor_y + math.sin(angle_rad) * distance

    # FrisFrame stores stage positions as normalized coordinates.
    def clamp(val):
        return min(STAGE_COORD_MAX, max(STAGE_COORD_MIN, val))

    custom_focal = draft_data.get("focal")
    final_focal = int(clamp_number(custom_focal, CAMERA_FOCAL_MIN, CAMERA_FOCAL_MAX, "focal")) \
        if custom_focal is not None else focal

    return {
        "x": clamp(camera_x),
        "y": clamp(camera_y),
        "aimX": actor_x,
        "aimY": actor_y,
        "height": height,
        "focusHeight": focus_height,
        "tiltDeg": tilt_deg,
        "focal": final_focal,
        "focusDistanceM": 5.0,
        "panDeg": int(round((rad_to_deg(angle_rad + math.pi) + 360.0) % 360.0)),
        "trackingTargetId": "",
        "locks": {
            "position": False,
            "orientation": False,
            "lens": False,
            "height": False
        }
    }

# Default previs state document builder
def make_default_state():
    actor_id = str(uuid.uuid4())[:8]
    return {
        "version": 5,
        "sceneTitle": "새 블로킹",
        "sceneIntent": "이 프리비즈는 카메라, 배우, 소품의 관계와 움직임을 설계합니다.",
        "previs": {
            "mode": "full-scene",
            "target": "hybrid",
            "selectedLayers": ["camera", "pose", "depth", "ai-depth", "edges", "masks"],
            "exportPresets": ["seedance", "blender"]
        },
        "aspect": "16:9",
        "spacePresetId": "",
        "showGrid": True,
        "showNames": False,
        "showCamera": True,
        "cleanExport": True,
        "blenderControls": True,
        "cameraSetup": {
            "sensorFormat": "full-frame",
            "sensorWidthMm": 36.0,
            "apertureFStop": 2.8
        },
        "camera": {
            "x": 0.92,
            "y": 0.48,
            "aimX": 0.5,
            "aimY": 0.48,
            "height": 1.6,
            "focusHeight": 1.1,
            "panDeg": 180,
            "tiltDeg": -6,
            "focal": 85,
            "focusDistanceM": 5.0,
            "trackingTargetId": "",
            "locks": {
                "position": False,
                "orientation": False,
                "lens": False,
                "height": False
            }
        },
        "items": [
            {
                "id": actor_id,
                "continuityId": str(uuid.uuid4())[:8],
                "type": "actor",
                "name": "수아",
                "x": 0.32,
                "y": 0.46,
                "size": 1.0,
                "color": "#ff6262",
                "shape": "circle",
                "facing": 0,
                "pitch": 0,
                "verticalOffset": 0,
                "assetType": "generic",
                "scaleX": 1,
                "scaleY": 1,
                "scaleZ": 1,
                "motionEnabled": True,
                "visible": True,
                "bodyPose": {
                    "chest": {"x": 0, "y": 0, "z": 0},
                    "head": {"x": 0, "y": 0, "z": 0},
                    "upperArmL": {"x": 0, "y": 0, "z": 0},
                    "upperArmR": {"x": 0, "y": 0, "z": 0},
                    "lowerArmL": {"x": 0, "y": 0, "z": 0},
                    "lowerArmR": {"x": 0, "y": 0, "z": 0},
                    "upperLegL": {"x": 0, "y": 0, "z": 0},
                    "upperLegR": {"x": 0, "y": 0, "z": 0},
                    "lowerLegL": {"x": 0, "y": 0, "z": 0},
                    "lowerLegR": {"x": 0, "y": 0, "z": 0}
                },
                "placementMode": "manual",
                "mountId": "",
                "seatIndex": 0,
                "editLocked": False
            }
        ],
        "groups": [],
        "motion": {
            "duration": 15,
            "fps": 24,
            "playhead": 0,
            "activeSource": actor_id,
            "timelineView": "combined",
            "selectedKeyId": None,
            "hiddenSources": [],
            "keyframes": []
        }
    }

# Tool execution functions
def handle_list_projects():
    conn = connect_db()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, title, updated_at, size_bytes, revision, kind FROM projects "
            "WHERE owner_license_hash = ? AND kind = 'managed' AND deleted_at IS NULL ORDER BY updated_at DESC",
            (MCP_OWNER_LICENSE_HASH,),
        )
        rows = cursor.fetchall()
        projects = [{
            "id": row["id"],
            "title": row["title"],
            "updated_at": row["updated_at"],
            "size_bytes": int(row["size_bytes"] or 0),
            "revision": int(row["revision"] or 1),
            "kind": row["kind"] or "share",
        } for row in rows]
        return json.dumps(projects, ensure_ascii=False, indent=2)
    finally:
        conn.close()

def handle_get_project(project_id):
    project_id = project_id_or_error(project_id)
    conn = connect_db()
    try:
        cursor = conn.cursor()
        row = load_project_row(cursor, project_id)
        return json.dumps({
            "id": row["id"],
            "title": row["title"],
            "revision": int(row["revision"] or 1),
            "updated_at": row["updated_at"],
            "document": project_document(json.loads(row["content"])),
        }, ensure_ascii=False, indent=2)
    finally:
        conn.close()

def handle_create_project(title, logline=""):
    title = str(title or "").strip()[:200]
    if not title:
        raise ValueError("프로젝트 제목을 입력해 주세요.")
    conn = connect_db()
    try:
        cursor = conn.cursor()
        cursor.execute("BEGIN IMMEDIATE")
        for _ in range(10):
            project_id = str(uuid.uuid4()).replace("-", "")[:8]
            cursor.execute("SELECT 1 FROM projects WHERE id = ?", (project_id,))
            if not cursor.fetchone():
                break
        else:
            raise RuntimeError("프로젝트 ID 생성에 실패했습니다.")
        now_str = utc_now()
        
        project_doc = {
            "id": project_id,
            "title": title,
            "logline": logline,
            "createdAt": now_str,
            "updatedAt": now_str,
            "scenario": {
                "sourceType": "manual",
                "sourceName": "",
                "importedAt": now_str,
                "rawText": "",
                "storyboardText": "",
                "warnings": []
            },
            "scenes": [
                {
                    "id": str(uuid.uuid4())[:8],
                    "number": 1,
                    "heading": "장면 1",
                    "synopsis": "",
                    "scriptText": "",
                    "createdAt": now_str,
                    "updatedAt": now_str,
                    "cuts": [
                        {
                            "id": str(uuid.uuid4())[:8],
                            "number": 1,
                            "title": "첫 컷",
                            "action": "",
                            "dialogue": "",
                            "camera": "",
                            "intent": "",
                            "notes": "",
                            "shotType": "미정",
                            "status": "draft",
                            "thumbnailTime": 0,
                            "sourceText": "",
                            "createdAt": now_str,
                            "updatedAt": now_str,
                            "blocking": make_default_state()
                        }
                    ]
                }
            ]
        }
        document = {
            "schemaVersion": SUPPORTED_PROJECT_SCHEMA_VERSION,
            "savedAt": now_str,
            "project": project_doc,
        }
        scene_count, cut_count, duration_seconds = project_summary(project_doc)
        content_str = json.dumps(document, ensure_ascii=False)
        cursor.execute(
            "INSERT INTO projects (id, title, content, updated_at, opened_at, size_bytes, kind, revision, "
            "scene_count, cut_count, duration_seconds, owner_license_hash) "
            "VALUES (?, ?, ?, ?, ?, ?, 'managed', 1, ?, ?, ?, ?)",
            (
                project_id,
                title,
                content_str,
                now_str,
                now_str,
                len(content_str.encode("utf-8")),
                scene_count,
                cut_count,
                duration_seconds,
                MCP_OWNER_LICENSE_HASH,
            ),
        )
        conn.commit()
        return json.dumps({
            "project_id": project_id,
            "revision": 1,
            "title": title,
            "message": "프로젝트를 만들었습니다.",
        }, ensure_ascii=False)
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def handle_save_project(project_id, content_json, revision):
    project_id = project_id_or_error(project_id)
    expected_revision = expected_revision_or_error(revision)
    document = project_document(content_json)
    conn = connect_db()
    try:
        cursor = conn.cursor()
        cursor.execute("BEGIN IMMEDIATE")
        row = load_project_row(cursor, project_id)
        next_revision, updated_at = save_mutated_document(cursor, row, document, expected_revision)
        conn.commit()
        return json.dumps({
            "project_id": project_id,
            "revision": next_revision,
            "updated_at": updated_at,
            "message": "프로젝트를 저장하고 이전 버전을 보관했습니다.",
        }, ensure_ascii=False)
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def handle_create_cut(project_id, arguments):
    def mutation(project_obj):
        scene_idx = arguments.get("scene_index", 0)
        try:
            scene_idx = int(scene_idx)
        except (TypeError, ValueError) as error:
            raise ValueError("scene_index 값이 올바르지 않습니다.") from error
        if scene_idx >= len(project_obj["scenes"]) or scene_idx < 0:
            raise ValueError(f"scene_index {scene_idx}가 범위를 벗어났습니다.")
        scene = project_obj["scenes"][scene_idx]
        now_str = utc_now()
        draft = {
            "title": arguments.get("title", "새 컷"),
            "action": arguments.get("action", ""),
            "dialogue": arguments.get("dialogue", ""),
            "camera": arguments.get("camera", ""),
            "intent": arguments.get("intent", ""),
            "focal": arguments.get("focal")
        }
        blocking = make_default_state()
        blocking["sceneTitle"] = draft["title"]
        blocking["sceneIntent"] = "\n".join(filter(None, [draft["intent"], draft["camera"]]))
        if arguments.get("duration") is not None:
            blocking["motion"]["duration"] = clamp_number(
                arguments["duration"], 1, MAX_TIMELINE_DURATION, "duration"
            )
        first_actor = blocking["items"][0]
        blocking["camera"] = draft_camera_from_text(draft, first_actor["x"], first_actor["y"])
        cut = {
            "id": str(uuid.uuid4())[:8],
            "number": len(scene["cuts"]) + 1,
            "title": draft["title"],
            "action": draft["action"],
            "dialogue": draft["dialogue"],
            "camera": draft["camera"],
            "intent": draft["intent"],
            "notes": arguments.get("notes", ""),
            "shotType": arguments.get("shot_type", "미정"),
            "status": "draft",
            "thumbnailTime": 0,
            "sourceText": f"C{len(scene['cuts']) + 1} · {draft['title']}",
            "createdAt": now_str,
            "updatedAt": now_str,
            "blocking": blocking
        }
        scene["cuts"].append(cut)
        for idx, c in enumerate(scene["cuts"]):
            c["number"] = idx + 1
        return f"장면 {scene_idx + 1}에 '{draft['title']}' 컷을 추가했습니다."

    return mutate_project(project_id, arguments.get("revision"), mutation)

def handle_update_camera(project_id, arguments):
    def mutation(project_obj):
        scene_idx = int(arguments.get("scene_index", 0))
        cut_idx = int(arguments.get("cut_index", 0))
        if scene_idx >= len(project_obj["scenes"]) or scene_idx < 0:
            raise ValueError(f"scene_index {scene_idx}가 범위를 벗어났습니다.")
        scene = project_obj["scenes"][scene_idx]
        if cut_idx >= len(scene["cuts"]) or cut_idx < 0:
            raise ValueError(f"cut_index {cut_idx}가 범위를 벗어났습니다.")
        cut = scene["cuts"][cut_idx]
        blocking = cut["blocking"]
        camera = blocking["camera"]
        if "height" in arguments:
            camera["height"] = clamp_number(
                arguments["height"], CAMERA_HEIGHT_MIN, CAMERA_HEIGHT_MAX, "height"
            )
        if "tilt_deg" in arguments:
            camera["tiltDeg"] = clamp_number(
                arguments["tilt_deg"], CAMERA_TILT_MIN, CAMERA_TILT_MAX, "tilt_deg"
            )
        if "pan_deg" in arguments:
            camera["panDeg"] = clamp_number(arguments["pan_deg"], -360000, 360000, "pan_deg") % 360
        if "focal" in arguments:
            camera["focal"] = int(clamp_number(
                arguments["focal"], CAMERA_FOCAL_MIN, CAMERA_FOCAL_MAX, "focal"
            ))
        if "x" in arguments:
            camera["x"] = clamp_number(arguments["x"], STAGE_COORD_MIN, STAGE_COORD_MAX, "x")
        if "y" in arguments:
            camera["y"] = clamp_number(arguments["y"], STAGE_COORD_MIN, STAGE_COORD_MAX, "y")
        now_str = utc_now()
        cut["updatedAt"] = now_str
        return f"장면 {scene_idx + 1}, 컷 {cut_idx + 1}의 카메라를 수정했습니다."

    return mutate_project(project_id, arguments.get("revision"), mutation)

def handle_add_actor(project_id, arguments):
    def mutation(project_obj):
        scene_idx = int(arguments.get("scene_index", 0))
        cut_idx = int(arguments.get("cut_index", 0))
        if scene_idx >= len(project_obj["scenes"]) or scene_idx < 0:
            raise ValueError(f"scene_index {scene_idx}가 범위를 벗어났습니다.")
        scene = project_obj["scenes"][scene_idx]
        if cut_idx >= len(scene["cuts"]) or cut_idx < 0:
            raise ValueError(f"cut_index {cut_idx}가 범위를 벗어났습니다.")
        cut = scene["cuts"][cut_idx]
        blocking = cut["blocking"]
        color = str(arguments.get("color", "#4287f5"))
        if not HEX_COLOR.fullmatch(color):
            raise ValueError("color는 #RRGGBB 형식이어야 합니다.")
        actor_id = str(uuid.uuid4())[:8]
        new_actor = {
            "id": actor_id,
            "continuityId": str(uuid.uuid4())[:8],
            "type": "actor",
            "name": arguments.get("name", "배우"),
            "x": clamp_number(arguments.get("x", 0.5), STAGE_COORD_MIN, STAGE_COORD_MAX, "x"),
            "y": clamp_number(arguments.get("y", 0.5), STAGE_COORD_MIN, STAGE_COORD_MAX, "y"),
            "size": 1.0,
            "color": color,
            "shape": "circle",
            "facing": clamp_number(arguments.get("facing", 0), -360000, 360000, "facing") % 360,
            "pitch": 0,
            "verticalOffset": 0,
            "assetType": "generic",
            "scaleX": 1,
            "scaleY": 1,
            "scaleZ": 1,
            "motionEnabled": True,
            "visible": True,
            "bodyPose": {
                "chest": {"x": 0, "y": 0, "z": 0},
                "head": {"x": 0, "y": 0, "z": 0},
                "upperArmL": {"x": 0, "y": 0, "z": 0},
                "upperArmR": {"x": 0, "y": 0, "z": 0},
                "lowerArmL": {"x": 0, "y": 0, "z": 0},
                "lowerArmR": {"x": 0, "y": 0, "z": 0},
                "upperLegL": {"x": 0, "y": 0, "z": 0},
                "upperLegR": {"x": 0, "y": 0, "z": 0},
                "lowerLegL": {"x": 0, "y": 0, "z": 0},
                "lowerLegR": {"x": 0, "y": 0, "z": 0}
            },
            "placementMode": "manual",
            "mountId": "",
            "seatIndex": 0,
            "editLocked": False
        }
        blocking["items"].append(new_actor)
        now_str = utc_now()
        cut["updatedAt"] = now_str
        return f"장면 {scene_idx + 1}, 컷 {cut_idx + 1}에 '{new_actor['name']}' 배우를 추가했습니다."

    return mutate_project(project_id, arguments.get("revision"), mutation)

# Stdio JSON-RPC protocol processor
def write_rpc(payload):
    sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def write_rpc_error(request_id, code, message):
    write_rpc({
        "jsonrpc": "2.0",
        "id": request_id,
        "error": {"code": code, "message": message},
    })


def process_mcp_message(msg_str):
    try:
        req = json.loads(msg_str)
    except json.JSONDecodeError:
        write_rpc_error(None, -32700, "Parse error")
        return

    if not isinstance(req, dict) or req.get("jsonrpc") != "2.0" or not isinstance(req.get("method"), str):
        request_id = req.get("id") if isinstance(req, dict) else None
        write_rpc_error(request_id, -32600, "Invalid Request")
        return

    req_id = req.get("id")
    method = req.get("method")
    if req_id is None:
        return
    
    if method == "initialize":
        response = {
            "jsonrpc": "2.0",
            "id": req_id,
            "result": {
                "protocolVersion": "2024-11-05",
                "capabilities": {
                    "tools": {}
                },
                "serverInfo": {
                    "name": "FrisFramePrevisServer",
                    "version": APP_VERSION
                }
            }
        }
        write_rpc(response)
        return
        
    if method == "tools/list":
        tools_list = [
            {
                "name": "list_projects",
                "description": "FrisFrame 데이터베이스의 프로젝트 목록과 충돌 방지용 revision을 반환합니다.",
                "inputSchema": {
                    "type": "object",
                    "properties": {}
                }
            },
            {
                "name": "get_project",
                "description": "지정된 프로젝트의 전체 JSON 문서와 현재 revision을 반환합니다.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "project_id": {"type": "string", "description": "불러올 프로젝트의 고유 ID"}
                    },
                    "required": ["project_id"]
                }
            },
            {
                "name": "create_project",
                "description": "데이터베이스 내에 지정된 제목과 로그라인으로 새로운 프리비즈 프로젝트를 생성합니다.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "title": {"type": "string", "description": "신규 프로젝트의 제목"},
                        "logline": {"type": "string", "description": "신규 프로젝트의 한 줄 로그라인(기획)"}
                    },
                    "required": ["title"]
                }
            },
            {
                "name": "save_project",
                "description": "특정 프로젝트의 업데이트된 전체 JSON 구조를 덮어쓰고 새로운 히스토리 리비전을 생성합니다.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "project_id": {"type": "string", "description": "수정할 프로젝트 ID"},
                        "content": {"type": "object", "description": "수정된 전체 프로젝트 JSON 문서 객체"},
                        "revision": {"type": "integer", "minimum": 1, "description": "get_project에서 확인한 현재 revision"}
                    },
                    "required": ["project_id", "content", "revision"]
                }
            },
            {
                "name": "create_cut",
                "description": "특정 프로젝트의 씬 내에 새로운 스토리보드 컷을 추가합니다. 대본 본문 내의 연출 지시어를 파싱해 카메라 구도를 지능적으로 가배치합니다.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "project_id": {"type": "string", "description": "컷을 추가할 프로젝트 ID"},
                        "revision": {"type": "integer", "minimum": 1, "description": "get_project에서 확인한 현재 revision"},
                        "scene_index": {"type": "integer", "description": "씬 번호 (0부터 시작)"},
                        "title": {"type": "string", "description": "새로운 컷의 타이틀"},
                        "action": {"type": "string", "description": "지문 / 배우 행동 묘사"},
                        "dialogue": {"type": "string", "description": "배우의 대사"},
                        "camera": {"type": "string", "description": "카메라 구도/거리 지시 (예: 'CU · 하이앵글')"},
                        "intent": {"type": "string", "description": "연출 의도"},
                        "notes": {"type": "string", "description": "메모 / 연속성 비고"},
                        "shot_type": {"type": "string", "description": "샷 크기 (예: CU, MCU, FS, ELS)"},
                        "duration": {"type": "number", "description": "컷 길이 (초 단위)"},
                        "focal": {"type": "integer", "description": "렌즈 초점 거리 (14~135mm)"}
                    },
                    "required": ["project_id", "revision", "title"]
                }
            },
            {
                "name": "update_camera_blocking",
                "description": "지정된 씬 및 컷 내의 3D 프리비즈 카메라 매개변수(좌표, 높이, 각도, 화각)를 미세 조정합니다.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "project_id": {"type": "string", "description": "프로젝트 ID"},
                        "revision": {"type": "integer", "minimum": 1, "description": "get_project에서 확인한 현재 revision"},
                        "scene_index": {"type": "integer", "description": "씬 인덱스 (0-based)"},
                        "cut_index": {"type": "integer", "description": "컷 인덱스 (0-based)"},
                        "height": {"type": "number", "minimum": 0.4, "maximum": 35, "description": "카메라 높이 (m 단위)"},
                        "tilt_deg": {"type": "number", "description": "틸트 각도 (위아래 회전, -90~90)"},
                        "pan_deg": {"type": "number", "description": "팬 각도 (좌우 회전, 0~360)"},
                        "focal": {"type": "integer", "description": "렌즈 초점 거리 (14~135)"},
                        "x": {"type": "number", "minimum": 0.02, "maximum": 0.98, "description": "카메라 X 무대 좌표"},
                        "y": {"type": "number", "minimum": 0.02, "maximum": 0.98, "description": "카메라 Y 무대 좌표"}
                    },
                    "required": ["project_id", "revision"]
                }
            },
            {
                "name": "add_actor_to_cut",
                "description": "특정 컷의 3D 프리비즈 씬 내에 새로운 배우 캐릭터를 2D 평면 좌표계에 배치하여 삽입합니다.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "project_id": {"type": "string", "description": "프로젝트 ID"},
                        "revision": {"type": "integer", "minimum": 1, "description": "get_project에서 확인한 현재 revision"},
                        "scene_index": {"type": "integer", "description": "씬 인덱스 (0-based)"},
                        "cut_index": {"type": "integer", "description": "컷 인덱스 (0-based)"},
                        "name": {"type": "string", "description": "배우 캐릭터 이름"},
                        "x": {"type": "number", "minimum": 0.02, "maximum": 0.98, "description": "무대 X 좌표"},
                        "y": {"type": "number", "minimum": 0.02, "maximum": 0.98, "description": "무대 Y 좌표"},
                        "facing": {"type": "number", "description": "바라보는 정면 각도 (0~360)"},
                        "color": {"type": "string", "description": "배우의 역할 대표 색상 헥스코드"}
                    },
                    "required": ["project_id", "revision", "name", "x", "y"]
                }
            }
        ]
        
        response = {
            "jsonrpc": "2.0",
            "id": req_id,
            "result": {
                "tools": tools_list
            }
        }
        write_rpc(response)
        return

    if method == "tools/call":
        params = req.get("params", {})
        tool_name = params.get("name")
        args = params.get("arguments", {})
        
        argument_keys = sorted(args) if isinstance(args, dict) else []
        log_debug(f"Calling tool: {tool_name}; argument keys: {', '.join(argument_keys)}")
        
        is_error = False
        try:
            if tool_name == "list_projects":
                result_text = handle_list_projects()
            elif tool_name == "get_project":
                result_text = handle_get_project(args.get("project_id"))
            elif tool_name == "create_project":
                result_text = handle_create_project(args.get("title"), args.get("logline", ""))
            elif tool_name == "save_project":
                result_text = handle_save_project(args.get("project_id"), args.get("content"), args.get("revision"))
            elif tool_name == "create_cut":
                result_text = handle_create_cut(args.get("project_id"), args)
            elif tool_name == "update_camera_blocking":
                result_text = handle_update_camera(args.get("project_id"), args)
            elif tool_name == "add_actor_to_cut":
                result_text = handle_add_actor(args.get("project_id"), args)
            else:
                raise ValueError(f"Tool '{tool_name}' is not recognized.")
        except Exception as e:
            result_text = f"Error executing tool '{tool_name}': {str(e)}"
            is_error = True
            log_debug(f"Exception during tool run: {str(e)}")
            
        response = {
            "jsonrpc": "2.0",
            "id": req_id,
            "result": {
                "content": [
                    {
                        "type": "text",
                        "text": result_text
                    }
                ],
                "isError": is_error,
            }
        }
        write_rpc(response)
        return

    write_rpc_error(req_id, -32601, "Method not found")

def main():
    log_debug("FrisFrame MCP Server started using stdio channel.")
    log_debug(f"Active DB path resolved to: {get_db_path()}")
    
    # Process line-by-line stdio stream
    for line in sys.stdin:
        line_str = line.strip()
        if line_str:
            process_mcp_message(line_str)

if __name__ == "__main__":
    main()
