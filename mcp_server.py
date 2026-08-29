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
MCP_DUMMY_TYPES = {"human", "child", "tall", "wide", "silhouette"}
MCP_PROP_TYPES = {
    "generic", "box", "ball", "cylinder", "cone", "capsule", "panel", "classic-salon",
    "car", "bus", "motorcycle", "bicycle", "tree", "forest", "room",
    "wall_i", "wall_l", "wall_u", "desk", "blackboard", "partition", "wall",
    "corridor-wall", "train-wall", "elevator", "door", "window", "sink", "toilet",
    "bathtub", "train-seat", "stairs", "slope", "sofa", "dining-table", "chair",
    "bed", "cabinet", "refrigerator", "television", "stove", "washing-machine",
}
MCP_POSE_PRESETS = {
    "neutral", "attention", "armsCrossed", "handsBack", "handsPocket",
    "sit", "crossLegs", "leanSit", "lieDown", "faceDown",
    "crouch", "guard", "punch", "kick", "push",
    "wave", "point", "think", "surprise", "sad", "cheer", "bow", "shrug", "stop", "clap",
}
MCP_PATH_MODES = {"straight", "horizontal", "vertical", "arc-left", "arc-right", "free-curve", "drone", "jib-up", "jib-down"}
MCP_TRANSITIONS = {"smooth", "linear", "hold", "cut"}

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
            "exportRange": {"start": 0, "end": 15},
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


def _scene_cut(project_obj, arguments):
    try:
        scene_idx = int(arguments.get("scene_index", 0))
        cut_idx = int(arguments.get("cut_index", 0))
    except (TypeError, ValueError) as error:
        raise ValueError("scene_index와 cut_index는 정수여야 합니다.") from error
    if scene_idx < 0 or scene_idx >= len(project_obj["scenes"]):
        raise ValueError(f"scene_index {scene_idx}가 범위를 벗어났습니다.")
    scene = project_obj["scenes"][scene_idx]
    if cut_idx < 0 or cut_idx >= len(scene["cuts"]):
        raise ValueError(f"cut_index {cut_idx}가 범위를 벗어났습니다.")
    cut = scene["cuts"][cut_idx]
    if not isinstance(cut.get("blocking"), dict):
        raise ValueError("대상 컷에 블로킹 데이터가 없습니다.")
    cut["blocking"].setdefault("items", [])
    return scene_idx, cut_idx, cut


def _command_color(value, fallback="#4287f5"):
    color = str(value or fallback)
    if not HEX_COLOR.fullmatch(color):
        raise ValueError("color는 #RRGGBB 형식이어야 합니다.")
    return color.lower()


def _command_item_id(value):
    candidate = str(value or "").strip()
    if candidate and not re.fullmatch(r"[A-Za-z0-9_-]{1,64}", candidate):
        raise ValueError("dummy_id는 영문, 숫자, _, -만 사용할 수 있습니다.")
    return candidate or str(uuid.uuid4())[:8]


def _stage_dimensions(blocking):
    aspect = str(blocking.get("aspect", "16:9"))
    ratios = {"16:9": 16 / 9, "9:16": 9 / 16, "4:3": 4 / 3, "1:1": 1.0, "3:4": 3 / 4}
    ratio = ratios.get(aspect, 16 / 9)
    return (36.0, 36.0 / ratio) if ratio >= 1 else (36.0 * ratio, 36.0)


def _optional_world_number(value, field_name):
    if value is None or value == "":
        return None
    return clamp_number(value, -1000, 1000, field_name)


def _dimensions_from_payload(payload, *, field_prefix="dimensions"):
    if not isinstance(payload, dict):
        return None
    dimensions = payload.get("physical_dimensions_m") or payload.get("dimensions_m") or payload.get("physicalDimensionsM") or payload.get("dimensionsM")
    source = dimensions if isinstance(dimensions, dict) else payload
    keys = {
        "width": ("width", "w", "physical_width_m"),
        "height": ("height", "h", "physical_height_m"),
        "depth": ("depth", "d", "physical_depth_m"),
    }
    values = {}
    seen = False
    for name, aliases in keys.items():
        for alias in aliases:
            if alias in source:
                seen = True
                values[name] = source[alias]
                break
    if not seen:
        return None
    if set(values) != set(keys):
        raise ValueError(f"{field_prefix}에는 width, height, depth를 모두 넣어 주세요.")
    return {
        name: clamp_number(value, 0.001, 1000, f"{field_prefix}.{name}")
        for name, value in values.items()
    }


def _sanitize_spatial_guide(value):
    if not isinstance(value, dict):
        raise ValueError("spatial_guide는 객체여야 합니다.")
    status = str(value.get("status", "applied")).strip().lower()
    if status not in {"empty", "awaiting-plan", "applied"}:
        status = "applied"
    raw_anchors = value.get("anchors", [])
    if not isinstance(raw_anchors, list):
        raise ValueError("spatial_guide.anchors는 배열이어야 합니다.")
    anchors = []
    for index, raw_anchor in enumerate(raw_anchors[:200]):
        if not isinstance(raw_anchor, dict):
            raise ValueError(f"spatial_guide.anchors[{index}]가 객체가 아닙니다.")
        dimensions = _dimensions_from_payload(raw_anchor, field_prefix=f"spatial_guide.anchors[{index}].dimensions_m")
        anchor_id = str(raw_anchor.get("id") or f"anchor-{index + 1}").strip()[:64]
        anchors.append({
            "id": anchor_id or f"anchor-{index + 1}",
            "label": str(raw_anchor.get("label") or raw_anchor.get("name") or anchor_id or f"공간 앵커 {index + 1}").strip()[:80],
            "kind": str(raw_anchor.get("kind") or "structure").strip()[:32],
            "imageX": clamp_number(raw_anchor.get("image_x", raw_anchor.get("imageX", 0)), 0, 1, f"spatial_guide.anchors[{index}].image_x"),
            "imageY": clamp_number(raw_anchor.get("image_y", raw_anchor.get("imageY", 0)), 0, 1, f"spatial_guide.anchors[{index}].image_y"),
            "imageWidth": clamp_number(raw_anchor.get("image_width", raw_anchor.get("imageWidth", 0)), 0, 1, f"spatial_guide.anchors[{index}].image_width"),
            "imageHeight": clamp_number(raw_anchor.get("image_height", raw_anchor.get("imageHeight", 0)), 0, 1, f"spatial_guide.anchors[{index}].image_height"),
            "worldX": _optional_world_number(raw_anchor.get("world_x_m", raw_anchor.get("worldX")), f"spatial_guide.anchors[{index}].world_x_m"),
            "worldZ": _optional_world_number(raw_anchor.get("world_z_m", raw_anchor.get("worldZ")), f"spatial_guide.anchors[{index}].world_z_m"),
            "dimensionsM": dimensions,
            "depthLayer": str(raw_anchor.get("depth_layer", raw_anchor.get("depthLayer", "")) or "").strip()[:48],
            "confidence": clamp_number(raw_anchor.get("confidence", 0), 0, 1, f"spatial_guide.anchors[{index}].confidence"),
            "attachedItemId": str(raw_anchor.get("attached_item_id", raw_anchor.get("attachedItemId", "")) or "").strip()[:64],
        })
    raw_layers = value.get("depth_layers", value.get("depthLayers", []))
    if not isinstance(raw_layers, list):
        raise ValueError("spatial_guide.depth_layers는 배열이어야 합니다.")
    depth_layers = []
    for index, raw_layer in enumerate(raw_layers[:32]):
        if not isinstance(raw_layer, dict):
            raise ValueError(f"spatial_guide.depth_layers[{index}]가 객체가 아닙니다.")
        depth_layers.append({
            "id": str(raw_layer.get("id") or f"layer-{index + 1}").strip()[:48],
            "label": str(raw_layer.get("label") or raw_layer.get("name") or f"깊이층 {index + 1}").strip()[:80],
            "order": int(clamp_number(raw_layer.get("order", index), -100, 100, f"spatial_guide.depth_layers[{index}].order")),
            "distanceM": clamp_number(raw_layer.get("distance_m", raw_layer.get("distanceM", 0)), 0, 1000, f"spatial_guide.depth_layers[{index}].distance_m"),
        })
    return {
        "schemaVersion": 1,
        "sourceName": str(value.get("source_name", value.get("sourceName", "")) or "").strip()[:160],
        "sourceKind": str(value.get("source_kind", value.get("sourceKind", "image")) or "image").strip()[:32],
        "status": status,
        "opacity": clamp_number(value.get("opacity", 0.22), 0.05, 0.8, "spatial_guide.opacity"),
        "anchors": anchors,
        "depthLayers": depth_layers,
        "appliedAt": utc_now() if status == "applied" else "",
    }


def _set_dummy_fields(item, command, blocking=None):
    if "name" in command:
        item["name"] = str(command["name"] or item.get("name") or "더미").strip()[:80] or "더미"
    if "x" in command or "left" in command:
        item["x"] = clamp_number(command.get("x", command.get("left")), STAGE_COORD_MIN, STAGE_COORD_MAX, "x")
    if "y" in command or "depth" in command:
        item["y"] = clamp_number(command.get("y", command.get("depth")), STAGE_COORD_MIN, STAGE_COORD_MAX, "y")
    position = command.get("world_position_m") or command.get("position_m") or command.get("worldPositionM")
    world_x = command.get("world_x_m", command.get("worldX"))
    world_z = command.get("world_z_m", command.get("worldZ"))
    if isinstance(position, dict):
        world_x = position.get("x", position.get("world_x_m", world_x))
        world_z = position.get("z", position.get("world_z_m", world_z))
    if blocking is not None and (world_x is not None or world_z is not None):
        stage_width, stage_depth = _stage_dimensions(blocking)
        if world_x is not None:
            item["x"] = clamp_number(0.5 + _optional_world_number(world_x, "world_x_m") / stage_width, STAGE_COORD_MIN, STAGE_COORD_MAX, "world_x_m")
        if world_z is not None:
            item["y"] = clamp_number(0.5 + _optional_world_number(world_z, "world_z_m") / stage_depth, STAGE_COORD_MIN, STAGE_COORD_MAX, "world_z_m")
    if "size" in command:
        item["size"] = clamp_number(command["size"], 0.25, 4, "size")
    if "color" in command:
        item["color"] = _command_color(command["color"], item.get("color", "#4287f5"))
    if "rotation" in command or "facing" in command:
        item["facing"] = clamp_number(command.get("rotation", command.get("facing")), -360000, 360000, "rotation") % 360
    if "pitch" in command:
        item["pitch"] = clamp_number(command["pitch"], -90, 90, "pitch") if item["type"] == "actor" else 0
    if "height" in command:
        field = "verticalOffset" if item["type"] == "actor" else "mountedHeight"
        item[field] = clamp_number(command["height"], -1, 5, "height")
    if "vertical_offset" in command and item["type"] == "actor":
        item["verticalOffset"] = clamp_number(command["vertical_offset"], -1, 5, "vertical_offset")
    if "mounted_height" in command and item["type"] == "prop":
        item["mountedHeight"] = clamp_number(command["mounted_height"], -1, 5, "mounted_height")
    for source, target in (("scale_x", "scaleX"), ("scale_y", "scaleY"), ("scale_z", "scaleZ")):
        if source in command:
            item[target] = clamp_number(command[source], 0.25, 3.5, source)
    if "anchor_id" in command or "reference_anchor_id" in command:
        item["referenceAnchorId"] = str(command.get("anchor_id", command.get("reference_anchor_id")) or "").strip()[:64]
    dimensions = _dimensions_from_payload(command, field_prefix="physical_dimensions_m")
    if dimensions is not None:
        item["referenceDimensionsM"] = dimensions
    if "visible" in command:
        item["visible"] = bool(command["visible"])
    if item["type"] == "prop":
        if "asset_type" in command or "dummy_type" in command:
            asset_type = str(command.get("asset_type", command.get("dummy_type")) or "generic")
            item["assetType"] = asset_type if asset_type in MCP_PROP_TYPES else "generic"
        item["dummyType"] = str(command.get("dummy_type", item.get("dummyType", item.get("assetType", "generic"))))
    else:
        dummy_type = str(command.get("dummy_type", item.get("dummyType", "human")))
        item["dummyType"] = dummy_type if dummy_type in MCP_DUMMY_TYPES else "human"


def _new_command_item(command, index, blocking=None):
    item_type = str(command.get("type", command.get("target", "actor"))).lower()
    item_type = "prop" if item_type in {"prop", "object", "소품", "더미소품"} else "actor"
    dummy_type = str(command.get("dummy_type", command.get("asset_type", "human" if item_type == "actor" else "generic")))
    if item_type == "prop":
        asset_type = dummy_type if dummy_type in MCP_PROP_TYPES else "generic"
        name = str(command.get("name") or asset_type).strip()[:80]
        item = {
            "id": _command_item_id(command.get("id") or command.get("dummy_id")),
            "continuityId": str(uuid.uuid4())[:8],
            "type": "prop",
            "name": name,
            "x": 0.5,
            "y": 0.5,
            "size": 1.0,
            "color": _command_color(command.get("color"), "#82909a"),
            "shape": str(command.get("shape") or "square"),
            "facing": 0,
            "pitch": 0,
            "mountedHeight": 0,
            "assetType": asset_type,
            "dummyType": asset_type,
            "scaleX": 1,
            "scaleY": 1,
            "scaleZ": 1,
            "motionEnabled": False,
            "visible": True,
            "editLocked": False,
            "referenceAnchorId": "",
            "referenceDimensionsM": None,
        }
    else:
        dummy_type = dummy_type if dummy_type in MCP_DUMMY_TYPES else "human"
        item = {
            "id": _command_item_id(command.get("id") or command.get("dummy_id")),
            "continuityId": str(uuid.uuid4())[:8],
            "type": "actor",
            "name": str(command.get("name") or f"더미 {index + 1}").strip()[:80],
            "x": 0.5,
            "y": 0.5,
            "size": 1.0,
            "color": _command_color(command.get("color"), "#4287f5"),
            "shape": "circle",
            "facing": 0,
            "pitch": 0,
            "verticalOffset": 0,
            "dummyType": dummy_type,
            "assetType": "generic",
            "scaleX": 1,
            "scaleY": 1,
            "scaleZ": 1,
            "motionEnabled": True,
            "visible": True,
            "bodyPose": {},
            "placementMode": "manual",
            "mountId": "",
            "seatIndex": 0,
            "editLocked": False,
            "referenceAnchorId": "",
            "referenceDimensionsM": None,
        }
    _set_dummy_fields(item, command, blocking)
    return item


def _motion_source(blocking, source_id):
    source_id = str(source_id or "").strip()
    if source_id == "camera":
        return blocking.get("camera"), "camera"
    item = next((entry for entry in blocking.get("items", []) if entry.get("id") == source_id), None)
    if not item:
        raise ValueError(f"동작을 적용할 대상을 찾을 수 없습니다: {source_id}")
    if item.get("motionEnabled") is False:
        raise ValueError(f"동작이 잠긴 대상입니다: {source_id}")
    return item, "actor" if item.get("type") == "actor" else "prop"


def _motion_segment(path_mode, source_type):
    mode = str(path_mode or "straight").lower()
    if mode not in MCP_PATH_MODES:
        raise ValueError(f"지원하지 않는 동선 경로입니다: {mode}")
    if source_type != "camera" and mode in {"drone", "jib-up", "jib-down"}:
        mode = "straight"
    segment = {"plan": {"kind": "line"}, "elevation": {"kind": "linear"}, "rig": "generic"}
    if mode == "horizontal":
        segment["plan"]["kind"] = "axis-x"
    elif mode == "vertical":
        segment["plan"]["kind"] = "axis-y"
    elif mode in {"arc-left", "arc-right"}:
        segment["plan"] = {"kind": "arc", "bulge": 0.32 if mode == "arc-left" else -0.32}
    elif mode == "free-curve":
        segment["plan"] = {"kind": "bezier", "control": None}
    elif mode == "drone":
        segment["rig"] = "drone"
    elif mode in {"jib-up", "jib-down"}:
        segment["elevation"] = {"kind": "jib-arc", "bulge": 0.32 if mode == "jib-up" else -0.32}
        segment["rig"] = "jib"
    return segment


def _sanitize_motion_body_pose(value):
    if value is None:
        return None
    if not isinstance(value, dict):
        raise ValueError("body_pose는 관절별 객체여야 합니다.")
    result = {}
    for joint_id, joint in list(value.items())[:32]:
        if not isinstance(joint, dict):
            raise ValueError(f"body_pose.{joint_id}가 객체가 아닙니다.")
        result[str(joint_id)[:48]] = {
            axis: clamp_number(joint.get(axis, 0), -180, 180, f"body_pose.{joint_id}.{axis}")
            for axis in ("x", "y", "z")
            if axis in joint
        }
    return result


def _motion_pose_at_time(blocking, source_id, time):
    source, source_type = _motion_source(blocking, source_id)
    motion = blocking.setdefault("motion", {})
    keyframes = [
        keyframe for keyframe in motion.setdefault("keyframes", [])
        if keyframe.get("source") == source_id and float(keyframe.get("time", 0)) <= time
    ]
    if keyframes:
        keyframes.sort(key=lambda keyframe: float(keyframe.get("time", 0)))
        return dict(keyframes[-1].get("pose") or source), source_type
    return dict(source), source_type


def _build_motion_keyframe(blocking, command, index, existing=None):
    source_id = str(command.get("source_id", command.get("source", "")) or "").strip()
    if not source_id:
        raise ValueError(f"operations[{index}].source_id가 필요합니다.")
    try:
        time_value = float(command.get("time"))
    except (TypeError, ValueError) as error:
        raise ValueError(f"operations[{index}].time은 숫자여야 합니다.") from error
    if not math.isfinite(time_value) or time_value < 0 or time_value > MAX_TIMELINE_DURATION:
        raise ValueError(f"operations[{index}].time이 허용 범위를 벗어났습니다.")
    base_pose, source_type = _motion_pose_at_time(blocking, source_id, time_value)
    pose_input = command.get("pose")
    if pose_input is not None:
        if not isinstance(pose_input, dict):
            raise ValueError(f"operations[{index}].pose는 객체여야 합니다.")
        base_pose.update(pose_input)
    aliases = {
        "x": "x", "y": "y", "facing": "facing", "pitch": "pitch",
        "height": "height", "vertical_offset": "verticalOffset", "mounted_height": "mountedHeight",
        "scale_x": "scaleX", "scale_y": "scaleY", "scale_z": "scaleZ",
        "pan_deg": "panDeg", "tilt_deg": "tiltDeg", "focal": "focal", "focus_distance_m": "focusDistanceM",
    }
    for source_key, target_key in aliases.items():
        if source_key in command:
            base_pose[target_key] = command[source_key]
    if "world_x_m" in command or "world_z_m" in command:
        stage_width, stage_depth = _stage_dimensions(blocking)
        if "world_x_m" in command:
            base_pose["x"] = clamp_number(0.5 + _optional_world_number(command["world_x_m"], "world_x_m") / stage_width, STAGE_COORD_MIN, STAGE_COORD_MAX, "world_x_m")
        if "world_z_m" in command:
            base_pose["y"] = clamp_number(0.5 + _optional_world_number(command["world_z_m"], "world_z_m") / stage_depth, STAGE_COORD_MIN, STAGE_COORD_MAX, "world_z_m")
    body_pose = _sanitize_motion_body_pose(command.get("body_pose"))
    if body_pose is not None:
        merged_body_pose = dict(base_pose.get("bodyPose") or {})
        merged_body_pose.update(body_pose)
        base_pose["bodyPose"] = merged_body_pose
    if source_type == "camera":
        if "height" in base_pose:
            base_pose["height"] = clamp_number(base_pose["height"], CAMERA_HEIGHT_MIN, CAMERA_HEIGHT_MAX, "height")
        if "panDeg" in base_pose:
            base_pose["panDeg"] = clamp_number(base_pose["panDeg"], -360000, 360000, "pan_deg") % 360
        if "tiltDeg" in base_pose:
            base_pose["tiltDeg"] = clamp_number(base_pose["tiltDeg"], CAMERA_TILT_MIN, CAMERA_TILT_MAX, "tilt_deg")
        if "focal" in base_pose:
            base_pose["focal"] = int(clamp_number(base_pose["focal"], CAMERA_FOCAL_MIN, CAMERA_FOCAL_MAX, "focal"))
    else:
        for field in ("verticalOffset", "mountedHeight"):
            if field in base_pose:
                base_pose[field] = clamp_number(base_pose[field], -1, 5, field)
    if "x" in base_pose:
        base_pose["x"] = clamp_number(base_pose["x"], STAGE_COORD_MIN, STAGE_COORD_MAX, "x")
    if "y" in base_pose:
        base_pose["y"] = clamp_number(base_pose["y"], STAGE_COORD_MIN, STAGE_COORD_MAX, "y")
    if "facing" in base_pose:
        base_pose["facing"] = clamp_number(base_pose["facing"], -360000, 360000, "facing") % 360
    transition = str(command.get("transition", existing.get("transition", "smooth") if existing else "smooth")).lower()
    if transition not in MCP_TRANSITIONS:
        raise ValueError(f"지원하지 않는 전환 방식입니다: {transition}")
    pose_preset = str(command.get("pose_preset", existing.get("posePreset", "") if existing else "") or "")
    if pose_preset and (source_type != "actor" or pose_preset not in MCP_POSE_PRESETS):
        raise ValueError(f"지원하지 않는 배우 포즈 프리셋입니다: {pose_preset}")
    previous_path_mode = existing.get("pathMode") if existing else None
    path_mode = str(command.get("path_mode", previous_path_mode or "straight") or "straight").lower()
    result = {
        "id": str(existing.get("id") if existing else command.get("id") or uuid.uuid4().hex[:8]),
        "source": source_id,
        "label": str(command.get("label", existing.get("label", f"키 {index + 1}") if existing else f"키 {index + 1}") or f"키 {index + 1}").strip()[:80],
        "note": str(command.get("note", existing.get("note", "") if existing else "") or "").strip()[:80],
        "time": round(time_value, 4),
        "transition": transition,
        "pathMode": path_mode,
        "segment": _motion_segment(path_mode, source_type),
        "pose": base_pose,
    }
    if pose_preset:
        result["posePreset"] = pose_preset
    return result


def handle_apply_motion_commands(project_id, arguments):
    operations = arguments.get("operations", [])
    if not isinstance(operations, list) or not operations:
        raise ValueError("동작 operations 배열을 하나 이상 넣어 주세요.")
    if len(operations) > 200:
        raise ValueError("한 번에 적용할 수 있는 동작 명령은 200개까지입니다.")

    def mutation(project_obj):
        scene_idx, cut_idx, cut = _scene_cut(project_obj, arguments)
        blocking = cut["blocking"]
        motion = blocking.setdefault("motion", {})
        motion.setdefault("keyframes", [])
        changed = []
        for index, command in enumerate(operations):
            if not isinstance(command, dict):
                raise ValueError(f"operations[{index}]가 객체가 아닙니다.")
            operation = str(command.get("op", "")).lower()
            if operation in {"add_keyframe", "set_pose_key", "set_motion_key"}:
                keyframe = _build_motion_keyframe(blocking, command, index)
                if any(entry.get("id") == keyframe["id"] for entry in motion["keyframes"]):
                    raise ValueError(f"동작 키 ID가 이미 존재합니다: {keyframe['id']}")
                motion["keyframes"].append(keyframe)
                changed.append({"op": "add_keyframe", "id": keyframe["id"], "source": keyframe["source"], "time": keyframe["time"]})
            elif operation in {"update_keyframe", "update_pose_key"}:
                key_id = str(command.get("id") or "")
                existing = next((entry for entry in motion["keyframes"] if entry.get("id") == key_id), None)
                if not existing:
                    raise ValueError(f"수정할 동작 키를 찾을 수 없습니다: {key_id}")
                updated = _build_motion_keyframe(blocking, {**existing, **command}, index, existing=existing)
                existing.clear()
                existing.update(updated)
                changed.append({"op": "update_keyframe", "id": key_id, "source": existing["source"], "time": existing["time"]})
            elif operation == "remove_keyframe":
                key_id = str(command.get("id") or "")
                before = len(motion["keyframes"])
                motion["keyframes"] = [entry for entry in motion["keyframes"] if entry.get("id") != key_id]
                if len(motion["keyframes"]) == before:
                    raise ValueError(f"삭제할 동작 키를 찾을 수 없습니다: {key_id}")
                if motion.get("selectedKeyId") == key_id:
                    motion["selectedKeyId"] = None
                changed.append({"op": operation, "id": key_id})
            elif operation == "clear_source_keys":
                source_id = str(command.get("source_id", command.get("source", "")) or "")
                _motion_source(blocking, source_id)
                before = len(motion["keyframes"])
                motion["keyframes"] = [entry for entry in motion["keyframes"] if entry.get("source") != source_id]
                changed.append({"op": operation, "source": source_id, "removed": before - len(motion["keyframes"])})
            elif operation == "set_duration":
                duration = clamp_number(command.get("duration"), 1, MAX_TIMELINE_DURATION, "duration")
                motion["duration"] = duration
                motion["playhead"] = min(clamp_number(motion.get("playhead", 0), 0, MAX_TIMELINE_DURATION, "playhead"), duration)
                for keyframe in motion["keyframes"]:
                    keyframe["time"] = round(clamp_number(keyframe.get("time", 0), 0, duration, "keyframe.time"), 4)
                export_range = motion.get("exportRange") if isinstance(motion.get("exportRange"), dict) else {}
                start = min(clamp_number(export_range.get("start", 0), 0, duration, "exportRange.start"), duration)
                end = min(clamp_number(export_range.get("end", duration), 0, duration, "exportRange.end"), duration)
                motion["exportRange"] = {"start": start, "end": end if end > start else duration}
                changed.append({"op": operation, "duration": duration})
            elif operation == "set_export_range":
                duration = clamp_number(motion.get("duration", 15), 1, MAX_TIMELINE_DURATION, "duration")
                start = clamp_number(command.get("start", 0), 0, duration, "export_range.start")
                end = clamp_number(command.get("end", duration), 0, duration, "export_range.end")
                if end <= start:
                    raise ValueError("export_range.end는 start보다 커야 합니다.")
                motion["exportRange"] = {"start": round(start, 4), "end": round(end, 4)}
                changed.append({"op": operation, "start": start, "end": end})
            else:
                raise ValueError(f"지원하지 않는 동작 명령입니다: {operation}")
        motion["keyframes"] = sorted(motion["keyframes"], key=lambda entry: (float(entry.get("time", 0)), str(entry.get("source", "")), str(entry.get("id", ""))))
        cut["updatedAt"] = utc_now()
        return json.dumps({
            "scene_index": scene_idx,
            "cut_index": cut_idx,
            "changed": changed,
            "message": f"MCP 동작 명령 {len(changed)}개를 적용했습니다. 키프레임에 지정한 포즈·변위만 재생합니다.",
        }, ensure_ascii=False)

    return mutate_project(project_id, arguments.get("revision"), mutation)


def handle_apply_scene_commands(project_id, arguments):
    operations = arguments.get("operations", [])
    spatial_guide = arguments.get("spatial_guide")
    if not isinstance(operations, list):
        raise ValueError("operations는 배열이어야 합니다.")
    if not operations and spatial_guide is None:
        raise ValueError("spatial_guide 또는 operations 중 하나는 넣어 주세요.")
    if len(operations) > 200:
        raise ValueError("한 번에 적용할 수 있는 장면 명령은 200개까지입니다.")

    def mutation(project_obj):
        scene_idx, cut_idx, cut = _scene_cut(project_obj, arguments)
        blocking = cut["blocking"]
        changed = []
        if spatial_guide is not None:
            existing_guide = blocking.get("spatialGuide") if isinstance(blocking.get("spatialGuide"), dict) else {}
            blocking["spatialGuide"] = _sanitize_spatial_guide(spatial_guide)
            for key in ("imageDataUrl", "imageWidthPx", "imageHeightPx", "importedAt"):
                if key in existing_guide and key not in blocking["spatialGuide"]:
                    blocking["spatialGuide"][key] = existing_guide[key]
            changed.append({"op": "set_spatial_guide", "anchors": len(blocking["spatialGuide"]["anchors"])})
        for index, command in enumerate(operations):
            if not isinstance(command, dict):
                raise ValueError(f"operations[{index}]가 객체가 아닙니다.")
            operation = str(command.get("op", "")).lower()
            if operation == "add_dummy":
                item = _new_command_item(command, index, blocking)
                if any(existing.get("id") == item["id"] for existing in blocking["items"]):
                    raise ValueError(f"더미 ID가 이미 존재합니다: {item['id']}")
                blocking["items"].append(item)
                changed.append({"op": operation, "id": item["id"], "type": item["type"]})
            elif operation == "update_dummy":
                item_id = str(command.get("id") or command.get("dummy_id") or "")
                item = next((entry for entry in blocking["items"] if entry.get("id") == item_id), None)
                if not item:
                    raise ValueError(f"수정할 더미를 찾을 수 없습니다: {item_id}")
                _set_dummy_fields(item, command, blocking)
                changed.append({"op": operation, "id": item_id, "type": item.get("type")})
            elif operation == "remove_dummy":
                item_id = str(command.get("id") or command.get("dummy_id") or "")
                before = len(blocking["items"])
                blocking["items"] = [entry for entry in blocking["items"] if entry.get("id") != item_id]
                if len(blocking["items"]) == before:
                    raise ValueError(f"삭제할 더미를 찾을 수 없습니다: {item_id}")
                if blocking.get("camera", {}).get("trackingTargetId") == item_id:
                    blocking["camera"]["trackingTargetId"] = ""
                changed.append({"op": operation, "id": item_id})
            elif operation in {"set_camera", "update_camera"}:
                camera = blocking["camera"]
                for key, minimum, maximum, label in (
                    ("x", STAGE_COORD_MIN, STAGE_COORD_MAX, "camera.x"),
                    ("y", STAGE_COORD_MIN, STAGE_COORD_MAX, "camera.y"),
                    ("height", CAMERA_HEIGHT_MIN, CAMERA_HEIGHT_MAX, "camera.height"),
                    ("tilt_deg", CAMERA_TILT_MIN, CAMERA_TILT_MAX, "camera.tilt_deg"),
                    ("focal", CAMERA_FOCAL_MIN, CAMERA_FOCAL_MAX, "camera.focal"),
                ):
                    if key in command:
                        value = clamp_number(command[key], minimum, maximum, label)
                        camera[{"tilt_deg": "tiltDeg", "focal": "focal"}.get(key, key)] = int(value) if key == "focal" else value
                if "pan_deg" in command:
                    camera["panDeg"] = clamp_number(command["pan_deg"], -360000, 360000, "camera.pan_deg") % 360
                changed.append({"op": operation, "id": "camera"})
            elif operation == "set_spatial_guide":
                guide = command.get("guide", command.get("spatial_guide"))
                existing_guide = blocking.get("spatialGuide") if isinstance(blocking.get("spatialGuide"), dict) else {}
                blocking["spatialGuide"] = _sanitize_spatial_guide(guide)
                for key in ("imageDataUrl", "imageWidthPx", "imageHeightPx", "importedAt"):
                    if key in existing_guide and key not in blocking["spatialGuide"]:
                        blocking["spatialGuide"][key] = existing_guide[key]
                changed.append({"op": operation, "anchors": len(blocking["spatialGuide"]["anchors"])})
            else:
                raise ValueError(f"지원하지 않는 장면 명령입니다: {operation}")
        now_str = utc_now()
        cut["updatedAt"] = now_str
        return json.dumps({
            "scene_index": scene_idx,
            "cut_index": cut_idx,
            "changed": changed,
            "message": f"이미지 기반 장면 명령 {len(changed)}개를 적용했습니다.",
        }, ensure_ascii=False)

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
            },
            {
                "name": "apply_scene_commands",
                "description": "레퍼런스 이미지에서 확정한 세트·인물·소품의 덩어리, 미터 기준 비례, 월드 위치, 깊이층과 카메라 관계를 현재 컷에 적용합니다. 외형이나 자연어 동작은 처리하지 않습니다.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "project_id": {"type": "string", "description": "프로젝트 ID"},
                        "revision": {"type": "integer", "minimum": 1, "description": "get_project에서 확인한 현재 revision"},
                        "scene_index": {"type": "integer", "minimum": 0, "description": "씬 인덱스 (0-based)"},
                        "cut_index": {"type": "integer", "minimum": 0, "description": "컷 인덱스 (0-based)"},
                        "operations": {
                            "type": "array",
                            "maxItems": 200,
                            "description": "add_dummy, update_dummy, remove_dummy, set_camera, set_spatial_guide 명령 배열. world_x_m/world_z_m은 무대 중심 기준 미터 좌표이고 physical_dimensions_m은 width/height/depth 실측 치수입니다.",
                            "items": {"type": "object"}
                        },
                        "spatial_guide": {
                            "type": "object",
                            "description": "Codex/Claude 같은 비전 호출자가 레퍼런스 이미지에서 추출한 구조 계획. 이미지 자체를 자동 분석하지 않고 앵커의 화면 위치, 월드 위치(m), W/H/D, 깊이층을 저장합니다.",
                            "properties": {
                                "source_name": {"type": "string"},
                                "status": {"type": "string", "enum": ["awaiting-plan", "applied"]},
                                "anchors": {"type": "array", "maxItems": 200, "items": {"type": "object"}},
                                "depth_layers": {"type": "array", "maxItems": 32, "items": {"type": "object"}}
                            }
                        }
                    },
                    "required": ["project_id", "revision"]
                }
            },
            {
                "name": "apply_motion_commands",
                "description": "자연어 프롬프트를 저장하지 않고, MCP가 확정한 시간별 위치·방향·높이·카메라·포즈 키프레임을 현재 컷에 적용합니다. 타임라인은 이 키프레임 사이만 보간하며 걷기·뛰기 팔다리 동작을 자동 생성하지 않습니다.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "project_id": {"type": "string", "description": "프로젝트 ID"},
                        "revision": {"type": "integer", "minimum": 1, "description": "get_project에서 확인한 현재 revision"},
                        "scene_index": {"type": "integer", "minimum": 0, "description": "씬 인덱스 (0-based)"},
                        "cut_index": {"type": "integer", "minimum": 0, "description": "컷 인덱스 (0-based)"},
                        "operations": {
                            "type": "array",
                            "maxItems": 200,
                            "description": "add_keyframe/set_pose_key, update_keyframe, remove_keyframe, clear_source_keys, set_duration, set_export_range 명령 배열. source_id는 camera 또는 대상 ID입니다.",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "op": {"type": "string"},
                                    "source_id": {"type": "string"},
                                    "id": {"type": "string"},
                                    "time": {"type": "number", "minimum": 0, "maximum": 60},
                                    "transition": {"type": "string", "enum": ["smooth", "linear", "hold", "cut"]},
                                    "path_mode": {"type": "string", "enum": ["straight", "horizontal", "vertical", "arc-left", "arc-right", "free-curve", "drone", "jib-up", "jib-down"]},
                                    "pose_preset": {"type": "string", "enum": sorted(MCP_POSE_PRESETS)},
                                    "body_pose": {"type": "object"}
                                }
                            }
                        }
                    },
                    "required": ["project_id", "revision", "operations"]
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
            elif tool_name == "apply_scene_commands":
                result_text = handle_apply_scene_commands(args.get("project_id"), args)
            elif tool_name == "apply_motion_commands":
                result_text = handle_apply_motion_commands(args.get("project_id"), args)
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
