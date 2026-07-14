#!/usr/bin/env python3
import sys
import json
import os
import sqlite3
import uuid
import math
from datetime import datetime
from pathlib import Path

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

    # Clamp coordinates to valid range [0.01, 1.99]
    def clamp(val):
        return min(1.99, max(0.01, val))

    custom_focal = draft_data.get("focal")
    final_focal = min(135, max(14, int(custom_focal))) if custom_focal else focal

    return {
        "x": clamp(camera_x),
        "y": clamp(camera_y),
        "aimX": actor_x,
        "aimY": actor_y,
        "height": height,
        "focusHeight": focus_height,
        "tiltDeg": tilt_deg,
        "focal": final_focal,
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
        "version": 4,
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
    db_path = get_db_path()
    if not os.path.exists(db_path):
        return f"Database file not found at: {db_path}"
    
    conn = sqlite3.connect(db_path)
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id, title, updated_at, size_bytes FROM projects ORDER BY updated_at DESC")
        rows = cursor.fetchall()
        projects = []
        for r in rows:
            projects.append({
                "id": r[0],
                "title": r[1],
                "updated_at": r[2],
                "size_bytes": r[3]
            })
        return json.dumps(projects, ensure_ascii=False, indent=2)
    finally:
        conn.close()

def handle_get_project(project_id):
    db_path = get_db_path()
    if not os.path.exists(db_path):
        return f"Database file not found at: {db_path}"
    
    conn = sqlite3.connect(db_path)
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT content FROM projects WHERE id = ?", (project_id,))
        row = cursor.fetchone()
        if not row:
            return f"Project with ID {project_id} not found."
        return row[0]
    finally:
        conn.close()

def handle_create_project(title, logline=""):
    db_path = get_db_path()
    conn = sqlite3.connect(db_path)
    try:
        cursor = conn.cursor()
        project_id = str(uuid.uuid4())[:8]
        now_str = datetime.utcnow().isoformat() + "Z"
        
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
        
        content_str = json.dumps(project_doc, ensure_ascii=False)
        cursor.execute(
            "INSERT INTO projects (id, title, content, updated_at, size_bytes) VALUES (?, ?, ?, ?, ?)",
            (project_id, title, content_str, now_str, len(content_str.encode("utf-8")))
        )
        conn.commit()
        return f"Successfully created project '{title}' with ID: {project_id}"
    finally:
        conn.close()

def handle_save_project(project_id, content_json):
    db_path = get_db_path()
    conn = sqlite3.connect(db_path)
    try:
        cursor = conn.cursor()
        now_str = datetime.utcnow().isoformat() + "Z"
        
        # Verify project exists
        cursor.execute("SELECT content FROM projects WHERE id = ?", (project_id,))
        row = cursor.fetchone()
        if not row:
            return f"Project with ID {project_id} not found."
            
        # Parse content_json if string, otherwise use directly
        if isinstance(content_json, str):
            doc = json.loads(content_json)
        else:
            doc = content_json
            
        doc["updatedAt"] = now_str
        content_str = json.dumps(doc, ensure_ascii=False)
        
        # Update project record
        cursor.execute(
            "UPDATE projects SET title = ?, content = ?, updated_at = ?, size_bytes = ? WHERE id = ?",
            (doc.get("title", "무제"), content_str, now_str, len(content_str.encode("utf-8")), project_id)
        )
        
        # Insert a version backup
        cursor.execute("SELECT MAX(revision) FROM project_versions WHERE project_id = ?", (project_id,))
        max_rev = cursor.fetchone()[0]
        next_rev = 1 if max_rev is None else max_rev + 1
        cursor.execute(
            "INSERT INTO project_versions (project_id, revision, title, content, created_at) VALUES (?, ?, ?, ?, ?)",
            (project_id, next_rev, doc.get("title"), content_str, now_str)
        )
        
        conn.commit()
        return f"Successfully updated and backup version {next_rev} for project: {project_id}"
    finally:
        conn.close()

def handle_create_cut(project_id, arguments):
    db_path = get_db_path()
    conn = sqlite3.connect(db_path)
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT content FROM projects WHERE id = ?", (project_id,))
        row = cursor.fetchone()
        if not row:
            return f"Project {project_id} not found."
            
        project_doc = json.loads(row[0])
        scene_idx = arguments.get("scene_index", 0)
        
        if scene_idx >= len(project_doc["scenes"]) or scene_idx < 0:
            return f"Invalid scene_index {scene_idx}. Total scenes: {len(project_doc['scenes'])}"
            
        scene = project_doc["scenes"][scene_idx]
        now_str = datetime.utcnow().isoformat() + "Z"
        
        # Build raw draft representation for auto-drafting camera
        draft = {
            "title": arguments.get("title", "새 컷"),
            "action": arguments.get("action", ""),
            "dialogue": arguments.get("dialogue", ""),
            "camera": arguments.get("camera", ""),
            "intent": arguments.get("intent", ""),
            "focal": arguments.get("focal")
        }
        
        # Create blocking state
        blocking = make_default_state()
        blocking["sceneTitle"] = draft["title"]
        blocking["sceneIntent"] = "\n".join(filter(None, [draft["intent"], draft["camera"]]))
        if arguments.get("duration"):
            blocking["motion"]["duration"] = min(60, max(1, float(arguments["duration"])))
            
        # Apply camera layout
        first_actor = blocking["items"][0]
        blocking["camera"] = draft_camera_from_text(draft, first_actor["x"], first_actor["y"])
        
        # Create cut item
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
        project_doc["updatedAt"] = now_str
        
        # Re-number cuts
        for idx, c in enumerate(scene["cuts"]):
            c["number"] = idx + 1
            
        content_str = json.dumps(project_doc, ensure_ascii=False)
        cursor.execute(
            "UPDATE projects SET content = ?, updated_at = ?, size_bytes = ? WHERE id = ?",
            (content_str, now_str, len(content_str.encode("utf-8")), project_id)
        )
        conn.commit()
        return f"Successfully added cut '{draft['title']}' to scene {scene_idx + 1}."
    finally:
        conn.close()

def handle_update_camera(project_id, arguments):
    db_path = get_db_path()
    conn = sqlite3.connect(db_path)
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT content FROM projects WHERE id = ?", (project_id,))
        row = cursor.fetchone()
        if not row:
            return f"Project {project_id} not found."
            
        project_doc = json.loads(row[0])
        scene_idx = arguments.get("scene_index", 0)
        cut_idx = arguments.get("cut_index", 0)
        
        if scene_idx >= len(project_doc["scenes"]) or scene_idx < 0:
            return f"Invalid scene_index {scene_idx}."
        scene = project_doc["scenes"][scene_idx]
        
        if cut_idx >= len(scene["cuts"]) or cut_idx < 0:
            return f"Invalid cut_index {cut_idx} in scene {scene_idx}."
            
        cut = scene["cuts"][cut_idx]
        blocking = cut["blocking"]
        camera = blocking["camera"]
        
        # Apply edits
        if "height" in arguments:
            camera["height"] = float(arguments["height"])
        if "tilt_deg" in arguments:
            camera["tiltDeg"] = float(arguments["tilt_deg"])
        if "pan_deg" in arguments:
            camera["panDeg"] = float(arguments["pan_deg"])
        if "focal" in arguments:
            camera["focal"] = int(arguments["focal"])
        if "x" in arguments:
            camera["x"] = float(arguments["x"])
        if "y" in arguments:
            camera["y"] = float(arguments["y"])
            
        now_str = datetime.utcnow().isoformat() + "Z"
        cut["updatedAt"] = now_str
        project_doc["updatedAt"] = now_str
        
        content_str = json.dumps(project_doc, ensure_ascii=False)
        cursor.execute(
            "UPDATE projects SET content = ?, updated_at = ?, size_bytes = ? WHERE id = ?",
            (content_str, now_str, len(content_str.encode("utf-8")), project_id)
        )
        conn.commit()
        return f"Successfully updated camera in scene {scene_idx + 1}, cut {cut_idx + 1}."
    finally:
        conn.close()

def handle_add_actor(project_id, arguments):
    db_path = get_db_path()
    conn = sqlite3.connect(db_path)
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT content FROM projects WHERE id = ?", (project_id,))
        row = cursor.fetchone()
        if not row:
            return f"Project {project_id} not found."
            
        project_doc = json.loads(row[0])
        scene_idx = arguments.get("scene_index", 0)
        cut_idx = arguments.get("cut_index", 0)
        
        if scene_idx >= len(project_doc["scenes"]) or scene_idx < 0:
            return f"Invalid scene_index {scene_idx}."
        scene = project_doc["scenes"][scene_idx]
        
        if cut_idx >= len(scene["cuts"]) or cut_idx < 0:
            return f"Invalid cut_index {cut_idx}."
            
        cut = scene["cuts"][cut_idx]
        blocking = cut["blocking"]
        
        # Build new actor object
        actor_id = str(uuid.uuid4())[:8]
        new_actor = {
            "id": actor_id,
            "continuityId": str(uuid.uuid4())[:8],
            "type": "actor",
            "name": arguments.get("name", "배우"),
            "x": float(arguments.get("x", 0.5)),
            "y": float(arguments.get("y", 0.5)),
            "size": 1.0,
            "color": arguments.get("color", "#4287f5"),
            "shape": "circle",
            "facing": float(arguments.get("facing", 0)),
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
        now_str = datetime.utcnow().isoformat() + "Z"
        cut["updatedAt"] = now_str
        project_doc["updatedAt"] = now_str
        
        content_str = json.dumps(project_doc, ensure_ascii=False)
        cursor.execute(
            "UPDATE projects SET content = ?, updated_at = ?, size_bytes = ? WHERE id = ?",
            (content_str, now_str, len(content_str.encode("utf-8")), project_id)
        )
        conn.commit()
        return f"Successfully added actor '{new_actor['name']}' to scene {scene_idx + 1}, cut {cut_idx + 1}."
    finally:
        conn.close()

# Stdio JSON-RPC protocol processor
def process_mcp_message(msg_str):
    try:
        req = json.loads(msg_str)
    except json.JSONDecodeError:
        log_debug("Invalid JSON received.")
        return
        
    req_id = req.get("id")
    method = req.get("method")
    
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
                    "version": "0.2.3"
                }
            }
        }
        sys.stdout.write(json.dumps(response, ensure_ascii=False) + "\n")
        sys.stdout.flush()
        return
        
    if method == "tools/list":
        tools_list = [
            {
                "name": "list_projects",
                "description": "FrisFrame 데이터베이스 내의 모든 프리비즈 프로젝트 목록(ID, 제목, 수정시각, 크기)을 나열합니다.",
                "inputSchema": {
                    "type": "object",
                    "properties": {}
                }
            },
            {
                "name": "get_project",
                "description": "지정된 project_id에 해당하는 전체 프리비즈 프로젝트 JSON 데이터 문서를 반환합니다.",
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
                        "content": {"type": "object", "description": "수정된 전체 프로젝트 JSON 문서 객체"}
                    },
                    "required": ["project_id", "content"]
                }
            },
            {
                "name": "create_cut",
                "description": "특정 프로젝트의 씬 내에 새로운 스토리보드 컷을 추가합니다. 대본 본문 내의 연출 지시어를 파싱해 카메라 구도를 지능적으로 가배치합니다.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "project_id": {"type": "string", "description": "컷을 추가할 프로젝트 ID"},
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
                    "required": ["project_id", "title"]
                }
            },
            {
                "name": "update_camera_blocking",
                "description": "지정된 씬 및 컷 내의 3D 프리비즈 카메라 매개변수(좌표, 높이, 각도, 화각)를 미세 조정합니다.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "project_id": {"type": "string", "description": "프로젝트 ID"},
                        "scene_index": {"type": "integer", "description": "씬 인덱스 (0-based)"},
                        "cut_index": {"type": "integer", "description": "컷 인덱스 (0-based)"},
                        "height": {"type": "number", "description": "카메라 높이 (m 단위, 0.4~3.0)"},
                        "tilt_deg": {"type": "number", "description": "틸트 각도 (위아래 회전, -90~90)"},
                        "pan_deg": {"type": "number", "description": "팬 각도 (좌우 회전, 0~360)"},
                        "focal": {"type": "integer", "description": "렌즈 초점 거리 (14~135)"},
                        "x": {"type": "number", "description": "카메라 X 월드 좌표 (0.01~1.99)"},
                        "y": {"type": "number", "description": "카메라 Y 월드 좌표 (0.01~1.99)"}
                    },
                    "required": ["project_id"]
                }
            },
            {
                "name": "add_actor_to_cut",
                "description": "특정 컷의 3D 프리비즈 씬 내에 새로운 배우 캐릭터를 2D 평면 좌표계에 배치하여 삽입합니다.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "project_id": {"type": "string", "description": "프로젝트 ID"},
                        "scene_index": {"type": "integer", "description": "씬 인덱스 (0-based)"},
                        "cut_index": {"type": "integer", "description": "컷 인덱스 (0-based)"},
                        "name": {"type": "string", "description": "배우 캐릭터 이름"},
                        "x": {"type": "number", "description": "월드 X 좌표 (0.01~1.99)"},
                        "y": {"type": "number", "description": "월드 Y 좌표 (0.01~1.99)"},
                        "facing": {"type": "number", "description": "바라보는 정면 각도 (0~360)"},
                        "color": {"type": "string", "description": "배우의 역할 대표 색상 헥스코드"}
                    },
                    "required": ["project_id", "name", "x", "y"]
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
        sys.stdout.write(json.dumps(response, ensure_ascii=False) + "\n")
        sys.stdout.flush()
        return

    if method == "tools/call":
        params = req.get("params", {})
        tool_name = params.get("name")
        args = params.get("arguments", {})
        
        log_debug(f"Calling tool: {tool_name} with arguments: {json.dumps(args, ensure_ascii=False)}")
        
        try:
            if tool_name == "list_projects":
                result_text = handle_list_projects()
            elif tool_name == "get_project":
                result_text = handle_get_project(args.get("project_id"))
            elif tool_name == "create_project":
                result_text = handle_create_project(args.get("title"), args.get("logline", ""))
            elif tool_name == "save_project":
                result_text = handle_save_project(args.get("project_id"), args.get("content"))
            elif tool_name == "create_cut":
                result_text = handle_create_cut(args.get("project_id"), args)
            elif tool_name == "update_camera_blocking":
                result_text = handle_update_camera(args.get("project_id"), args)
            elif tool_name == "add_actor_to_cut":
                result_text = handle_add_actor(args.get("project_id"), args)
            else:
                result_text = f"Tool '{tool_name}' is not recognized."
        except Exception as e:
            result_text = f"Error executing tool '{tool_name}': {str(e)}"
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
                ]
            }
        }
        sys.stdout.write(json.dumps(response, ensure_ascii=False) + "\n")
        sys.stdout.flush()
        return

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
