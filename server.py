#!/usr/bin/env python3
import argparse
import hashlib
import hmac
import json
import os
import secrets
import shutil
import sqlite3
import string
import subprocess
import tempfile
import threading
import time
import uuid
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse


MAX_FRAME_BYTES = 3 * 1024 * 1024
MAX_JOB_BYTES = 512 * 1024 * 1024
MAX_GLOBAL_JOBS = 4
JOB_TTL_SECONDS = 15 * 60
SESSION_TTL_SECONDS = 30 * 24 * 60 * 60
JOBS = {}
JOBS_LOCK = threading.Lock()
ENABLE_LICENSE_CHECK = os.environ.get("ENABLE_LICENSE_CHECK", "False").lower() == "true"
REQUIRE_ORIGIN = os.environ.get("FRISFRAME_REQUIRE_ORIGIN", "False").lower() == "true"
SECURE_COOKIES = os.environ.get("FRISFRAME_SECURE_COOKIES", "False").lower() == "true"
LICENSE_PEPPER = os.environ.get("FRISFRAME_LICENSE_PEPPER", "")
ACTIVATION_ATTEMPTS = {}
ACTIVATION_LOCK = threading.Lock()
STATIC_FILES = {
    "/index.html",
    "/styles.css",
    "/app.js",
    "/boot-errors.js",
    "/storyboard-core.js",
    "/motion-core.js",
    "/timeline-core.js",
    "/project-recovery-core.js",
    "/manual-guide-core.js",
    "/pose-core.js",
    "/camera-drafting-core.js",
    "/multi-camera-core.js",
    "/vendor/three.min.js",
    "/vendor/lucide.min.js",
}

SUPPORTED_PROJECT_SCHEMA_VERSION = 6
APP_VERSION = os.environ.get("FRISFRAME_VERSION", "dev")
STARTUP_NONCE = os.environ.get("FRISFRAME_STARTUP_NONCE", "")


def database_path():
    return os.environ.get("PREVIS_DB_PATH", str(Path(__file__).resolve().parent / "previs_projects.db"))


def ffmpeg_executable():
    configured = os.environ.get("FRISFRAME_FFMPEG", "").strip()
    if configured:
        candidate = Path(configured).expanduser()
        if not candidate.is_file():
            raise FileNotFoundError(f"설정된 FFmpeg를 찾을 수 없습니다: {candidate}")
        return str(candidate)
    discovered = shutil.which("ffmpeg")
    if not discovered:
        raise FileNotFoundError("FFmpeg를 찾을 수 없습니다.")
    return discovered


def secret_digest(value):
    return hashlib.sha256(str(value).encode("utf-8")).hexdigest()


def license_digest(value):
    normalized = str(value or "").strip().upper()
    if LICENSE_PEPPER:
        digest = hmac.new(LICENSE_PEPPER.encode("utf-8"), normalized.encode("utf-8"), hashlib.sha256).hexdigest()
        return "hmac-sha256:" + digest
    return legacy_license_digest(normalized)


def legacy_license_digest(value):
    normalized = str(value or "").strip().upper()
    return "sha256:" + secret_digest(normalized)


def ensure_column(cursor, table, column, declaration):
    columns = {row[1] for row in cursor.execute(f"PRAGMA table_info({table})")}
    if column not in columns:
        cursor.execute(f"ALTER TABLE {table} ADD COLUMN {column} {declaration}")


def utc_now():
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def create_project_id(cursor):
    for _ in range(10):
        project_id = "".join(secrets.choice(string.ascii_letters + string.digits) for _ in range(8))
        cursor.execute("SELECT 1 FROM projects WHERE id = ?", (project_id,))
        if not cursor.fetchone():
            return project_id
    raise RuntimeError("프로젝트 ID 생성에 실패했습니다.")


def project_summary(project_data):
    scenes = project_data.get("scenes", []) if isinstance(project_data, dict) else []
    if isinstance(scenes, dict):
        scenes = list(scenes.values())
    scenes = [scene for scene in scenes if isinstance(scene, dict)]
    cuts = []
    for scene in scenes:
        scene_cuts = scene.get("cuts", [])
        if isinstance(scene_cuts, dict):
            scene_cuts = list(scene_cuts.values())
        cuts.extend(cut for cut in scene_cuts if isinstance(cut, dict))
    duration = 0.0
    for cut in cuts:
        try:
            duration += max(0.0, float(cut.get("blocking", {}).get("motion", {}).get("duration", 0)))
        except (TypeError, ValueError):
            continue
    return len(scenes), len(cuts), round(duration, 2)


def validate_managed_document(document):
    if not isinstance(document, dict):
        raise ValueError("프로젝트 문서 형식이 올바르지 않습니다.")
    project_data = document.get("project")
    if not isinstance(project_data, dict):
        raise ValueError("프로젝트 데이터가 없습니다.")
    schema_version = document.get("schemaVersion", 0)
    try:
        schema_version = int(schema_version or 0)
    except (TypeError, ValueError) as error:
        raise ValueError("프로젝트 스키마 버전이 올바르지 않습니다.") from error
    if schema_version > SUPPORTED_PROJECT_SCHEMA_VERSION:
        raise ValueError("이 FrisFrame 버전보다 새로운 프로젝트는 저장할 수 없습니다.")
    scenes = project_data.get("scenes", [])
    if not isinstance(scenes, (list, dict)):
        raise ValueError("프로젝트 씬 목록 형식이 올바르지 않습니다.")
    scene_values = scenes.values() if isinstance(scenes, dict) else scenes
    for scene in scene_values:
        if not isinstance(scene, dict):
            raise ValueError("프로젝트 씬 형식이 올바르지 않습니다.")
        cuts = scene.get("cuts", [])
        if not isinstance(cuts, (list, dict)):
            raise ValueError("프로젝트 컷 목록 형식이 올바르지 않습니다.")
        cut_values = cuts.values() if isinstance(cuts, dict) else cuts
        if any(not isinstance(cut, dict) for cut in cut_values):
            raise ValueError("프로젝트 컷 형식이 올바르지 않습니다.")
    return project_data


def job_is_expired(job, now=None):
    if job.get("status") == "encoding":
        return False
    current_time = time.time() if now is None else now
    return current_time - float(job.get("last_activity", job.get("created_at", 0))) > JOB_TTL_SECONDS


def cleanup_expired_job_storage():
    now = time.time()
    with JOBS_LOCK:
        expired = [job_id for job_id, job in JOBS.items() if job_is_expired(job, now)]
    for job_id in expired:
        with JOBS_LOCK:
            job = JOBS.pop(job_id, None)
        if job:
            shutil.rmtree(job["directory"], ignore_errors=True)


def sweep_expired_jobs(stop_event):
    while not stop_event.wait(60):
        cleanup_expired_job_storage()


def watch_parent_process(server, stop_event):
    try:
        parent_pid = int(os.environ.get("FRISFRAME_PARENT_PID", "0") or 0)
    except ValueError:
        parent_pid = 0
    if parent_pid <= 1:
        return
    while not stop_event.wait(2):
        try:
            os.kill(parent_pid, 0)
        except ProcessLookupError:
            server.shutdown()
            return
        except PermissionError:
            continue


def strip_retired_analysis_metadata(value):
    if isinstance(value, list):
        for entry in value:
            strip_retired_analysis_metadata(entry)
        return value
    if not isinstance(value, dict):
        return value

    value.pop("reference", None)
    value.pop("motionPrevis", None)
    provenance = value.get("provenance")
    if isinstance(provenance, dict) and provenance.get("type") == "reference":
        value.pop("provenance", None)
    value.pop("detectionConfidence", None)
    for entry in value.values():
        strip_retired_analysis_metadata(entry)
    return value


def initialize_database(db_path):
    conn = sqlite3.connect(db_path, timeout=10.0)
    try:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                title TEXT,
                content TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS licenses (
                key TEXT PRIMARY KEY,
                owner TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_active INTEGER DEFAULT 1
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                token_hash TEXT PRIMARY KEY,
                license_hash TEXT NOT NULL,
                expires_at INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS project_versions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id TEXT NOT NULL,
                revision INTEGER NOT NULL,
                title TEXT,
                content TEXT NOT NULL,
                owner_license_hash TEXT,
                created_at TEXT NOT NULL,
                UNIQUE(project_id, revision)
            )
        """)
        ensure_column(cursor, "projects", "owner_license_hash", "TEXT")
        ensure_column(cursor, "projects", "share_token_hash", "TEXT")
        ensure_column(cursor, "projects", "size_bytes", "INTEGER DEFAULT 0")
        ensure_column(cursor, "projects", "kind", "TEXT DEFAULT 'share'")
        ensure_column(cursor, "projects", "updated_at", "TEXT")
        ensure_column(cursor, "projects", "opened_at", "TEXT")
        ensure_column(cursor, "projects", "deleted_at", "TEXT")
        ensure_column(cursor, "projects", "revision", "INTEGER DEFAULT 1")
        ensure_column(cursor, "projects", "scene_count", "INTEGER DEFAULT 0")
        ensure_column(cursor, "projects", "cut_count", "INTEGER DEFAULT 0")
        ensure_column(cursor, "projects", "duration_seconds", "REAL DEFAULT 0")
        cursor.execute("UPDATE projects SET kind = 'share' WHERE kind IS NULL OR kind = ''")
        cursor.execute("UPDATE projects SET revision = 1 WHERE revision IS NULL OR revision < 1")
        cursor.execute("UPDATE projects SET updated_at = created_at WHERE updated_at IS NULL")
        cursor.execute(
            "CREATE INDEX IF NOT EXISTS idx_projects_owner_kind_deleted_updated "
            "ON projects (owner_license_hash, kind, deleted_at, updated_at)"
        )
        cursor.execute(
            "CREATE INDEX IF NOT EXISTS idx_project_versions_project_revision "
            "ON project_versions (project_id, revision DESC)"
        )
        for (stored_key,) in cursor.execute("SELECT key FROM licenses").fetchall():
            if not str(stored_key).startswith(("sha256:", "hmac-sha256:")):
                cursor.execute("UPDATE licenses SET key = ? WHERE key = ?", (license_digest(stored_key), stored_key))
        cursor.execute("DELETE FROM sessions WHERE expires_at <= ?", (int(time.time()),))
        conn.commit()
    finally:
        conn.close()


def json_bytes(payload):
    return json.dumps(payload, ensure_ascii=False).encode("utf-8")


class PrevisHandler(SimpleHTTPRequestHandler):
    server_version = "FrisFrame"
    sys_version = ""
    extensions_map = SimpleHTTPRequestHandler.extensions_map.copy()
    extensions_map.update({
        ".css": "text/css",
        ".js": "application/javascript",
        ".json": "application/json",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".svg": "image/svg+xml",
        ".mp4": "video/mp4",
    })

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header(
            "Content-Security-Policy",
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; "
            "font-src 'self' data:; worker-src 'self' blob:; object-src 'none'; "
            "base-uri 'none'; frame-ancestors 'none'",
        )
        super().end_headers()

    def send_json(self, status, payload):
        body = json_bytes(payload)
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_body(self, limit):
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0 or length > limit:
            raise ValueError("요청 크기가 올바르지 않습니다.")
        return self.rfile.read(length)

    def is_authenticated(self):
        return self.get_session() is not None

    def get_session(self):
        if not ENABLE_LICENSE_CHECK:
            return {"token_hash": "local", "license_hash": "local"}
        token = self.get_cookie_value("frisframe_session")
        if not token:
            return None
        token_hash = secret_digest(token)
        try:
            conn = sqlite3.connect(database_path(), timeout=10.0)
            cursor = conn.cursor()
            cursor.execute(
                "SELECT sessions.license_hash, sessions.expires_at "
                "FROM sessions JOIN licenses ON licenses.key = sessions.license_hash "
                "WHERE sessions.token_hash = ? AND sessions.expires_at > ? AND licenses.is_active = 1",
                (token_hash, int(time.time())),
            )
            row = cursor.fetchone()
            conn.close()
            if not row:
                return None
            return {"token_hash": token_hash, "license_hash": row[0], "expires_at": row[1]}
        except Exception:
            return None

    def get_cookie_value(self, name):
        cookie_header = self.headers.get("Cookie")
        if not cookie_header:
            return None
        import http.cookies
        try:
            cookie = http.cookies.SimpleCookie()
            cookie.load(cookie_header)
            morsel = cookie.get(name)
            return morsel.value if morsel else None
        except Exception:
            return None

    def verify_license_key(self, key):
        if not key:
            return None
        key_hash = license_digest(key)
        candidates = [key_hash]
        legacy_hash = legacy_license_digest(key)
        if legacy_hash not in candidates:
            candidates.append(legacy_hash)
        try:
            conn = sqlite3.connect(database_path(), timeout=10.0)
            cursor = conn.cursor()
            placeholders = ",".join("?" for _ in candidates)
            cursor.execute(
                f"SELECT key FROM licenses WHERE key IN ({placeholders}) AND is_active = 1",
                candidates,
            )
            row = cursor.fetchone()
            if row and row[0] != key_hash:
                previous_hash = row[0]
                cursor.execute("UPDATE licenses SET key = ? WHERE key = ?", (key_hash, previous_hash))
                cursor.execute("UPDATE sessions SET license_hash = ? WHERE license_hash = ?", (key_hash, previous_hash))
                cursor.execute("UPDATE projects SET owner_license_hash = ? WHERE owner_license_hash = ?", (key_hash, previous_hash))
                conn.commit()
            conn.close()
            return key_hash if row is not None else None
        except Exception:
            return None

    def validate_origin(self):
        origin = self.headers.get("Origin")
        if not origin:
            return not REQUIRE_ORIGIN
        parsed = urlparse(origin)
        return parsed.netloc == self.headers.get("Host") and parsed.scheme in ("http", "https")

    def activation_rate_limited(self):
        now = time.time()
        address = self.client_address[0]
        with ACTIVATION_LOCK:
            recent = [stamp for stamp in ACTIVATION_ATTEMPTS.get(address, []) if now - stamp < 600]
            recent.append(now)
            ACTIVATION_ATTEMPTS[address] = recent
            return len(recent) > 8

    def session_cookie(self, token, max_age=SESSION_TTL_SECONDS):
        secure = "; Secure" if SECURE_COOKIES or self.headers.get("X-Forwarded-Proto") == "https" else ""
        return f"frisframe_session={token}; Path=/; Max-Age={max_age}; HttpOnly; SameSite=Strict{secure}"

    def is_https_request(self):
        return self.headers.get("X-Forwarded-Proto") == "https"

    def serve_license_activation_page(self):
        root = Path(__file__).resolve().parent
        activation_file = root / "license_activation.html"
        if activation_file.exists():
            content = activation_file.read_bytes()
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            self.wfile.write(content)
        else:
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            fallback = b"<!DOCTYPE html><html><head><title>FrisFrame License</title></head><body style='background:#111;color:#fff;font-family:sans-serif;padding:50px;text-align:center;'><h2>FrisFrame License Activation Page Not Found</h2><p>Please upload license_activation.html.</p></body></html>"
            self.send_header("Content-Length", str(len(fallback)))
            self.end_headers()
            self.wfile.write(fallback)

    def activate_license(self):
        if SECURE_COOKIES and not self.is_https_request():
            self.send_json(HTTPStatus.UPGRADE_REQUIRED, {"error": "이 서버의 라이선스 인증은 HTTPS 연결이 필요합니다."})
            return
        if self.activation_rate_limited():
            self.send_json(HTTPStatus.TOO_MANY_REQUESTS, {"error": "인증 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요."})
            return
        payload = json.loads(self.read_body(64 * 1024).decode("utf-8"))
        license_key = str(payload.get("licenseKey", "")).strip()
        if not license_key:
            raise ValueError("라이센스 키를 입력해 주세요.")
        
        license_hash = self.verify_license_key(license_key)
        if license_hash:
            token = secrets.token_urlsafe(32)
            token_hash = secret_digest(token)
            expires_at = int(time.time()) + SESSION_TTL_SECONDS
            conn = sqlite3.connect(database_path(), timeout=10.0)
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO sessions (token_hash, license_hash, expires_at) VALUES (?, ?, ?)",
                (token_hash, license_hash, expires_at),
            )
            conn.commit()
            conn.close()
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Set-Cookie", self.session_cookie(token))
            body = json_bytes({"success": True, "message": "라이센스가 성공적으로 활성화되었습니다."})
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "유효하지 않거나 비활성화된 라이센스 키입니다."})

    def deactivate_license(self):
        token = self.get_cookie_value("frisframe_session")
        if token:
            conn = sqlite3.connect(database_path(), timeout=10.0)
            conn.execute("DELETE FROM sessions WHERE token_hash = ?", (secret_digest(token),))
            conn.commit()
            conn.close()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Set-Cookie", self.session_cookie("", 0))
        body = json_bytes({"success": True, "message": "로그아웃되었습니다."})
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/health":
            self.send_json(HTTPStatus.OK, {
                "app": "FrisFrame",
                "version": APP_VERSION,
                "nonce": STARTUP_NONCE,
                "ffmpeg": bool(os.environ.get("FRISFRAME_FFMPEG") or shutil.which("ffmpeg")),
            })
            return
        if parsed.path in ("/api/project/load", "/api/projects", "/api/projects/load", "/api/projects/versions"):
            if not self.is_authenticated():
                self.send_json(HTTPStatus.UNAUTHORIZED, {"error": "인증이 필요합니다."})
                return
            try:
                query = parse_qs(parsed.query)
                if parsed.path == "/api/project/load":
                    self.load_project(query)
                elif parsed.path == "/api/projects":
                    self.list_managed_projects(query)
                elif parsed.path == "/api/projects/versions":
                    self.list_managed_project_versions(query)
                else:
                    self.load_managed_project(query)
            except PermissionError as error:
                self.send_json(HTTPStatus.FORBIDDEN, {"error": str(error)})
            except ValueError as error:
                self.send_json(HTTPStatus.BAD_REQUEST, {"error": str(error)})
            except Exception as error:
                request_id = uuid.uuid4().hex[:12]
                print(f"[{request_id}] project load failed: {error}", flush=True)
                self.send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": f"서버 오류가 발생했습니다. 요청 ID: {request_id}"})
            return
        
        # Static asset handling
        authenticated = self.is_authenticated()
        if not authenticated:
            normalized_path = parsed.path.lower().rstrip("/")
            if normalized_path in ("", "/index.html", "/index.htm"):
                self.serve_license_activation_page()
                return
            else:
                self.send_response(HTTPStatus.UNAUTHORIZED)
                self.send_header("Content-Type", "text/plain; charset=utf-8")
                self.end_headers()
                self.wfile.write(b"Unauthorized. Please activate your license key first.")
                return
        static_path = parsed.path.rstrip("/") or "/index.html"
        if static_path not in STATIC_FILES:
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        self.path = static_path + (f"?{parsed.query}" if parsed.query else "")
        super().do_GET()

    def do_HEAD(self):
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/"):
            self.send_error(HTTPStatus.METHOD_NOT_ALLOWED)
            return
        if not self.is_authenticated():
            normalized_path = parsed.path.lower().rstrip("/")
            if normalized_path not in ("", "/index.html", "/index.htm"):
                self.send_error(HTTPStatus.UNAUTHORIZED)
                return
            activation_file = Path(__file__).resolve().parent / "license_activation.html"
            size = activation_file.stat().st_size if activation_file.exists() else 0
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(size))
            self.end_headers()
            return
        static_path = parsed.path.rstrip("/") or "/index.html"
        if static_path not in STATIC_FILES:
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        self.path = static_path + (f"?{parsed.query}" if parsed.query else "")
        super().do_HEAD()

    def do_POST(self):
        parsed = urlparse(self.path)
        if not self.validate_origin():
            self.send_json(HTTPStatus.FORBIDDEN, {"error": "허용되지 않은 요청 출처입니다."})
            return
        if parsed.path == "/api/license/activate":
            try:
                self.activate_license()
            except ValueError as error:
                self.send_json(HTTPStatus.BAD_REQUEST, {"error": str(error)})
            except Exception as error:
                request_id = uuid.uuid4().hex[:12]
                print(f"[{request_id}] license activation failed: {error}", flush=True)
                self.send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": f"서버 오류가 발생했습니다. 요청 ID: {request_id}"})
            return
        elif parsed.path == "/api/license/deactivate":
            try:
                self.deactivate_license()
            except ValueError as error:
                self.send_json(HTTPStatus.BAD_REQUEST, {"error": str(error)})
            except Exception as error:
                request_id = uuid.uuid4().hex[:12]
                print(f"[{request_id}] license deactivation failed: {error}", flush=True)
                self.send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": f"서버 오류가 발생했습니다. 요청 ID: {request_id}"})
            return

        # Protect all other POST endpoints
        if not self.is_authenticated():
            self.send_json(HTTPStatus.UNAUTHORIZED, {"error": "인증이 필요합니다."})
            return

        try:
            if parsed.path == "/api/mp4/start":
                self.start_mp4_job()
            elif parsed.path == "/api/mp4/frame":
                self.accept_mp4_frame(parse_qs(parsed.query))
            elif parsed.path == "/api/mp4/finish":
                self.finish_mp4_job(parse_qs(parsed.query))
            elif parsed.path == "/api/mp4/cancel":
                self.cancel_mp4_job(parse_qs(parsed.query))
            elif parsed.path == "/api/project/save":
                self.save_project()
            elif parsed.path == "/api/projects/store":
                self.store_managed_project()
            elif parsed.path == "/api/projects/rename":
                self.rename_managed_project()
            elif parsed.path == "/api/projects/duplicate":
                self.duplicate_managed_project()
            elif parsed.path == "/api/projects/trash":
                self.set_managed_project_trashed(True)
            elif parsed.path == "/api/projects/restore":
                self.set_managed_project_trashed(False)
            elif parsed.path == "/api/projects/delete":
                self.delete_managed_project()
            elif parsed.path == "/api/projects/version/restore":
                self.restore_managed_project_version()
            else:
                self.send_error(HTTPStatus.NOT_FOUND)
        except PermissionError as error:
            self.send_json(HTTPStatus.FORBIDDEN, {"error": str(error)})
        except ValueError as error:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": str(error)})
        except Exception as error:
            request_id = uuid.uuid4().hex[:12]
            print(f"[{request_id}] POST {parsed.path} failed: {error}", flush=True)
            self.send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": f"서버 오류가 발생했습니다. 요청 ID: {request_id}"})

    def start_mp4_job(self):
        payload = json.loads(self.read_body(64 * 1024).decode("utf-8"))
        width = int(payload.get("width", 0))
        height = int(payload.get("height", 0))
        fps = int(payload.get("fps", 0))
        frame_count = int(payload.get("frameCount", 0))
        if not 64 <= width <= 3840 or not 64 <= height <= 3840:
            raise ValueError("MP4 해상도가 지원 범위를 벗어났습니다.")
        if not 1 <= fps <= 60 or not 2 <= frame_count <= 3600:
            raise ValueError("MP4 프레임 설정이 올바르지 않습니다.")
        session = self.get_session()
        if not session:
            raise ValueError("인증 세션이 만료되었습니다.")
        self.cleanup_expired_jobs()
        job_id = uuid.uuid4().hex
        with JOBS_LOCK:
            if len(JOBS) >= MAX_GLOBAL_JOBS:
                raise ValueError("동시에 처리할 수 있는 영상 작업 수를 초과했습니다.")
            if any(job.get("owner") == session["token_hash"] for job in JOBS.values()):
                raise ValueError("현재 세션에서 이미 영상 작업을 처리 중입니다.")
            directory = Path(tempfile.mkdtemp(prefix="frisframe-mp4-"))
            JOBS[job_id] = {
                "directory": directory,
                "width": width,
                "height": height,
                "fps": fps,
                "frame_count": frame_count,
                "received": set(),
                "owner": session["token_hash"],
                "created_at": time.time(),
                "last_activity": time.time(),
                "status": "uploading",
                "bytes": 0,
                "frame_sizes": {},
                "uploading": set(),
            }
        self.send_json(HTTPStatus.OK, {"jobId": job_id})

    def get_job(self, query):
        job_id = (query.get("job") or [""])[0]
        with JOBS_LOCK:
            job = JOBS.get(job_id)
        if not job:
            raise ValueError("만료되었거나 존재하지 않는 MP4 작업입니다.")
        session = self.get_session()
        if not session or job.get("owner") != session["token_hash"]:
            raise PermissionError("이 영상 작업에 접근할 권한이 없습니다.")
        if job_is_expired(job):
            self.remove_job(job_id)
            raise ValueError("영상 작업이 만료되었습니다.")
        with JOBS_LOCK:
            current = JOBS.get(job_id)
            if current:
                current["last_activity"] = time.time()
        return job_id, job

    def accept_mp4_frame(self, query):
        job_id, job = self.get_job(query)
        index = int((query.get("index") or ["-1"])[0])
        if not 0 <= index < job["frame_count"]:
            raise ValueError("MP4 프레임 번호가 올바르지 않습니다.")
        content_type = self.headers.get("Content-Type", "")
        if "image/jpeg" not in content_type:
            raise ValueError("MP4 프레임은 JPEG 형식이어야 합니다.")
        data = self.read_body(MAX_FRAME_BYTES)
        frame_path = job["directory"] / f"frame_{index:06d}.jpg"
        with JOBS_LOCK:
            current = JOBS.get(job_id)
            if not current:
                raise ValueError("영상 작업이 만료되었습니다.")
            if index in current["uploading"]:
                raise ValueError("같은 프레임을 동시에 전송할 수 없습니다.")
            previous_size = current["frame_sizes"].get(index, 0)
            projected_total = current["bytes"] - previous_size + len(data)
            over_limit = projected_total > MAX_JOB_BYTES
            if not over_limit:
                current["bytes"] = projected_total
                current["frame_sizes"][index] = len(data)
                current["uploading"].add(index)
        if over_limit:
            self.remove_job(job_id)
            raise ValueError("영상 작업의 최대 용량을 초과했습니다.")
        try:
            frame_path.write_bytes(data)
            with JOBS_LOCK:
                current = JOBS.get(job_id)
                if current:
                    current["uploading"].discard(index)
                    current["received"].add(index)
                    current["last_activity"] = time.time()
        except Exception:
            with JOBS_LOCK:
                current = JOBS.get(job_id)
                if current:
                    current["uploading"].discard(index)
                    current["bytes"] = max(0, current["bytes"] - len(data) + previous_size)
                    if previous_size:
                        current["frame_sizes"][index] = previous_size
                    else:
                        current["frame_sizes"].pop(index, None)
            raise
        self.send_json(HTTPStatus.OK, {"received": index})

    def finish_mp4_job(self, query):
        job_id, job = self.get_job(query)
        missing = sorted(set(range(job["frame_count"])) - job["received"])
        if missing:
            raise ValueError(f"MP4 프레임 {len(missing)}개가 누락되었습니다.")
        output_path = job["directory"] / "preview.mp4"
        with JOBS_LOCK:
            current = JOBS.get(job_id)
            if current:
                current["status"] = "encoding"
                current["last_activity"] = time.time()
        command = [
            ffmpeg_executable(),
            "-y",
            "-v",
            "error",
            "-framerate",
            str(job["fps"]),
            "-i",
            str(job["directory"] / "frame_%06d.jpg"),
            "-vf",
            "scale=trunc(iw/2)*2:trunc(ih/2)*2",
            "-c:v",
            "libx264",
            "-preset",
            "superfast",
            "-crf",
            "18",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            "-frames:v",
            str(job["frame_count"]),
            str(output_path),
        ]
        try:
            result = subprocess.run(command, capture_output=True, text=True, timeout=900)
            if result.returncode != 0 or not output_path.exists():
                detail = result.stderr.strip() or "FFmpeg가 MP4를 만들지 못했습니다."
                raise RuntimeError(detail)
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "video/mp4")
            self.send_header("Content-Length", str(output_path.stat().st_size))
            self.end_headers()
            with output_path.open("rb") as source:
                while True:
                    chunk = source.read(1024 * 1024)
                    if not chunk:
                        break
                    self.wfile.write(chunk)
        finally:
            self.remove_job(job_id)

    def cancel_mp4_job(self, query):
        job_id, _ = self.get_job(query)
        self.remove_job(job_id)
        self.send_json(HTTPStatus.OK, {"cancelled": True})

    def save_project(self):
        payload_bytes = self.read_body(16 * 1024 * 1024)
        payload = json.loads(payload_bytes.decode("utf-8"))
        strip_retired_analysis_metadata(payload)
        project_data = payload.get("project", {})
        if not isinstance(project_data, dict):
            raise ValueError("프로젝트 데이터 형식이 올바르지 않습니다.")
        title = str(project_data.get("title", "Untitled Project"))[:200]
        session = self.get_session()
        if not session:
            raise PermissionError("인증 세션이 만료되었습니다.")
        share_token = secrets.token_urlsafe(24)
        conn = sqlite3.connect(database_path(), timeout=10.0)
        cursor = conn.cursor()
        proj_id = create_project_id(cursor)
        content = json.dumps(payload, ensure_ascii=False)
        cursor.execute(
            "INSERT INTO projects (id, title, content, owner_license_hash, share_token_hash, size_bytes, kind, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?, 'share', ?)",
            (
                proj_id,
                title,
                content,
                session["license_hash"],
                secret_digest(share_token),
                len(content.encode("utf-8")),
                utc_now(),
            ),
        )
        conn.commit()
        conn.close()
        self.send_json(HTTPStatus.OK, {"id": proj_id, "shareToken": share_token})

    def managed_project_row(self, cursor, project_id, include_deleted=True):
        cursor.execute(
            "SELECT id, title, content, created_at, updated_at, opened_at, deleted_at, revision, "
            "scene_count, cut_count, duration_seconds, owner_license_hash, kind "
            "FROM projects WHERE id = ?",
            (project_id,),
        )
        row = cursor.fetchone()
        if not row or row[12] != "managed":
            return None
        session = self.get_session()
        if not session or not row[11] or not secrets.compare_digest(str(row[11]), str(session["license_hash"])):
            raise PermissionError("이 프로젝트를 관리할 권한이 없습니다.")
        if not include_deleted and row[6]:
            return None
        return row

    def read_project_action(self, limit=64 * 1024):
        payload = json.loads(self.read_body(limit).decode("utf-8"))
        project_id = str(payload.get("id", ""))
        if len(project_id) != 8 or not project_id.isalnum():
            raise ValueError("프로젝트 ID가 올바르지 않습니다.")
        return payload, project_id

    def project_metadata(self, row):
        return {
            "id": row[0],
            "title": row[1] or "새 프로젝트",
            "createdAt": row[3],
            "updatedAt": row[4] or row[3],
            "openedAt": row[5],
            "deletedAt": row[6],
            "revision": int(row[7] or 1),
            "sceneCount": int(row[8] or 0),
            "cutCount": int(row[9] or 0),
            "durationSeconds": float(row[10] or 0),
        }

    def archive_managed_project_version(self, cursor, row):
        cursor.execute(
            "INSERT OR REPLACE INTO project_versions "
            "(project_id, revision, title, content, owner_license_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (row[0], int(row[7] or 1), row[1], row[2], row[11], row[4] or row[3] or utc_now()),
        )
        cursor.execute(
            "DELETE FROM project_versions WHERE project_id = ? AND id NOT IN ("
            "SELECT id FROM project_versions WHERE project_id = ? ORDER BY revision DESC LIMIT 5)",
            (row[0], row[0]),
        )

    def list_managed_projects(self, query):
        session = self.get_session()
        if not session:
            raise PermissionError("인증 세션이 만료되었습니다.")
        trashed = (query.get("trash") or [""])[0] == "1"
        deleted_clause = "deleted_at IS NOT NULL" if trashed else "deleted_at IS NULL"
        conn = sqlite3.connect(database_path(), timeout=10.0)
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, title, content, created_at, updated_at, opened_at, deleted_at, revision, "
            "scene_count, cut_count, duration_seconds, owner_license_hash, kind "
            f"FROM projects WHERE owner_license_hash = ? AND kind = 'managed' AND {deleted_clause} "
            "ORDER BY COALESCE(opened_at, updated_at, created_at) DESC LIMIT 250",
            (session["license_hash"],),
        )
        rows = cursor.fetchall()
        conn.close()
        self.send_json(HTTPStatus.OK, {"projects": [self.project_metadata(row) for row in rows]})

    def load_managed_project(self, query):
        project_id = (query.get("id") or [""])[0]
        if len(project_id) != 8 or not project_id.isalnum():
            raise ValueError("프로젝트 ID가 올바르지 않습니다.")
        conn = sqlite3.connect(database_path(), timeout=10.0)
        cursor = conn.cursor()
        row = self.managed_project_row(cursor, project_id, include_deleted=False)
        if not row:
            conn.close()
            self.send_json(HTTPStatus.NOT_FOUND, {"error": "프로젝트를 찾을 수 없습니다."})
            return
        opened_at = utc_now()
        cursor.execute("UPDATE projects SET opened_at = ? WHERE id = ?", (opened_at, project_id))
        conn.commit()
        content = strip_retired_analysis_metadata(json.loads(row[2]))
        metadata = self.project_metadata(row)
        metadata["openedAt"] = opened_at
        conn.close()
        self.send_json(HTTPStatus.OK, {"document": content, "storage": metadata})

    def store_managed_project(self):
        payload_bytes = self.read_body(16 * 1024 * 1024)
        payload = json.loads(payload_bytes.decode("utf-8"))
        document = strip_retired_analysis_metadata(payload.get("document"))
        project_data = validate_managed_document(document)
        session = self.get_session()
        if not session:
            raise PermissionError("인증 세션이 만료되었습니다.")
        title = str(project_data.get("title", "새 프로젝트")).strip()[:200] or "새 프로젝트"
        scene_count, cut_count, duration_seconds = project_summary(project_data)
        content = json.dumps(document, ensure_ascii=False)
        now = utc_now()
        project_id = str(payload.get("id", ""))
        expected_revision = payload.get("revision")
        conn = sqlite3.connect(database_path(), timeout=10.0)
        cursor = conn.cursor()
        cursor.execute("BEGIN IMMEDIATE")
        if project_id:
            if len(project_id) != 8 or not project_id.isalnum():
                conn.close()
                raise ValueError("프로젝트 ID가 올바르지 않습니다.")
            row = self.managed_project_row(cursor, project_id, include_deleted=False)
            if not row:
                conn.close()
                self.send_json(HTTPStatus.NOT_FOUND, {"error": "저장할 프로젝트를 찾을 수 없습니다."})
                return
            current_revision = int(row[7] or 1)
            if expected_revision is None:
                conn.close()
                raise ValueError("기존 프로젝트를 저장할 때 revision이 필요합니다.")
            if int(expected_revision) != current_revision:
                conn.close()
                self.send_json(HTTPStatus.CONFLICT, {
                    "error": "다른 창에서 프로젝트가 변경되었습니다.",
                    "code": "revision_conflict",
                    "revision": current_revision,
                    "updatedAt": row[4],
                })
                return
            revision = current_revision + 1
            self.archive_managed_project_version(cursor, row)
            cursor.execute(
                "UPDATE projects SET title = ?, content = ?, size_bytes = ?, updated_at = ?, opened_at = ?, "
                "revision = ?, scene_count = ?, cut_count = ?, duration_seconds = ? WHERE id = ?",
                (title, content, len(content.encode("utf-8")), now, now, revision,
                 scene_count, cut_count, duration_seconds, project_id),
            )
        else:
            project_id = create_project_id(cursor)
            revision = 1
            cursor.execute(
                "INSERT INTO projects (id, title, content, owner_license_hash, size_bytes, kind, created_at, "
                "updated_at, opened_at, revision, scene_count, cut_count, duration_seconds) "
                "VALUES (?, ?, ?, ?, ?, 'managed', ?, ?, ?, ?, ?, ?, ?)",
                (project_id, title, content, session["license_hash"], len(content.encode("utf-8")),
                 now, now, now, revision, scene_count, cut_count, duration_seconds),
            )
        conn.commit()
        conn.close()
        self.send_json(HTTPStatus.OK, {"id": project_id, "title": title, "revision": revision, "updatedAt": now})

    def rename_managed_project(self):
        payload, project_id = self.read_project_action()
        title = str(payload.get("title", "")).strip()[:200]
        if not title:
            raise ValueError("프로젝트 이름을 입력해 주세요.")
        conn = sqlite3.connect(database_path(), timeout=10.0)
        cursor = conn.cursor()
        cursor.execute("BEGIN IMMEDIATE")
        row = self.managed_project_row(cursor, project_id, include_deleted=False)
        if not row:
            conn.close()
            self.send_json(HTTPStatus.NOT_FOUND, {"error": "프로젝트를 찾을 수 없습니다."})
            return
        expected_revision = payload.get("revision")
        if expected_revision is None:
            conn.close()
            raise ValueError("프로젝트 이름을 변경할 때 revision이 필요합니다.")
        current_revision = int(row[7] or 1)
        if int(expected_revision) != current_revision:
            conn.close()
            self.send_json(HTTPStatus.CONFLICT, {
                "error": "다른 창에서 프로젝트가 변경되었습니다.",
                "code": "revision_conflict",
                "revision": current_revision,
                "updatedAt": row[4],
            })
            return
        document = strip_retired_analysis_metadata(json.loads(row[2]))
        if isinstance(document.get("project"), dict):
            document["project"]["title"] = title
            document["project"]["updatedAt"] = utc_now()
        now = utc_now()
        revision = current_revision + 1
        content = json.dumps(document, ensure_ascii=False)
        self.archive_managed_project_version(cursor, row)
        cursor.execute(
            "UPDATE projects SET title = ?, content = ?, size_bytes = ?, updated_at = ?, revision = ? WHERE id = ?",
            (title, content, len(content.encode("utf-8")), now, revision, project_id),
        )
        conn.commit()
        conn.close()
        self.send_json(HTTPStatus.OK, {"id": project_id, "title": title, "revision": revision, "updatedAt": now})

    def duplicate_managed_project(self):
        payload, project_id = self.read_project_action()
        conn = sqlite3.connect(database_path(), timeout=10.0)
        cursor = conn.cursor()
        cursor.execute("BEGIN IMMEDIATE")
        row = self.managed_project_row(cursor, project_id, include_deleted=False)
        if not row:
            conn.close()
            self.send_json(HTTPStatus.NOT_FOUND, {"error": "복제할 프로젝트를 찾을 수 없습니다."})
            return
        document = strip_retired_analysis_metadata(json.loads(row[2]))
        title = str(payload.get("title", "")).strip()[:200] or f"{row[1]} 복사본"
        now = utc_now()
        if isinstance(document.get("project"), dict):
            document["project"]["id"] = uuid.uuid4().hex
            document["project"]["title"] = title
            document["project"]["createdAt"] = now
            document["project"]["updatedAt"] = now
        content = json.dumps(document, ensure_ascii=False)
        next_id = create_project_id(cursor)
        cursor.execute(
            "INSERT INTO projects (id, title, content, owner_license_hash, size_bytes, kind, created_at, "
            "updated_at, revision, scene_count, cut_count, duration_seconds) "
            "VALUES (?, ?, ?, ?, ?, 'managed', ?, ?, 1, ?, ?, ?)",
            (next_id, title, content, row[11], len(content.encode("utf-8")), now, now, row[8], row[9], row[10]),
        )
        conn.commit()
        conn.close()
        self.send_json(HTTPStatus.OK, {"id": next_id, "title": title, "revision": 1, "updatedAt": now})

    def set_managed_project_trashed(self, trashed):
        _, project_id = self.read_project_action()
        conn = sqlite3.connect(database_path(), timeout=10.0)
        cursor = conn.cursor()
        cursor.execute("BEGIN IMMEDIATE")
        row = self.managed_project_row(cursor, project_id, include_deleted=True)
        if not row:
            conn.close()
            self.send_json(HTTPStatus.NOT_FOUND, {"error": "프로젝트를 찾을 수 없습니다."})
            return
        deleted_at = utc_now() if trashed else None
        cursor.execute("UPDATE projects SET deleted_at = ? WHERE id = ?", (deleted_at, project_id))
        conn.commit()
        conn.close()
        self.send_json(HTTPStatus.OK, {"id": project_id, "deletedAt": deleted_at})

    def delete_managed_project(self):
        _, project_id = self.read_project_action()
        conn = sqlite3.connect(database_path(), timeout=10.0)
        cursor = conn.cursor()
        cursor.execute("BEGIN IMMEDIATE")
        row = self.managed_project_row(cursor, project_id, include_deleted=True)
        if not row:
            conn.close()
            self.send_json(HTTPStatus.NOT_FOUND, {"error": "프로젝트를 찾을 수 없습니다."})
            return
        if not row[6]:
            conn.close()
            raise ValueError("휴지통에 있는 프로젝트만 영구 삭제할 수 있습니다.")
        cursor.execute("DELETE FROM project_versions WHERE project_id = ?", (project_id,))
        cursor.execute("DELETE FROM projects WHERE id = ?", (project_id,))
        conn.commit()
        conn.close()
        self.send_json(HTTPStatus.OK, {"id": project_id, "deleted": True})

    def list_managed_project_versions(self, query):
        project_id = (query.get("id") or [""])[0]
        if len(project_id) != 8 or not project_id.isalnum():
            raise ValueError("프로젝트 ID가 올바르지 않습니다.")
        conn = sqlite3.connect(database_path(), timeout=10.0)
        cursor = conn.cursor()
        row = self.managed_project_row(cursor, project_id, include_deleted=False)
        if not row:
            conn.close()
            self.send_json(HTTPStatus.NOT_FOUND, {"error": "프로젝트를 찾을 수 없습니다."})
            return
        cursor.execute(
            "SELECT revision, title, created_at FROM project_versions WHERE project_id = ? "
            "ORDER BY revision DESC LIMIT 5",
            (project_id,),
        )
        versions = [
            {"revision": int(version[0]), "title": version[1] or "새 프로젝트", "savedAt": version[2]}
            for version in cursor.fetchall()
        ]
        conn.close()
        self.send_json(HTTPStatus.OK, {"id": project_id, "currentRevision": int(row[7] or 1), "versions": versions})

    def restore_managed_project_version(self):
        payload, project_id = self.read_project_action()
        expected_revision = payload.get("revision")
        target_revision = payload.get("versionRevision")
        if expected_revision is None or target_revision is None:
            raise ValueError("현재 revision과 복원할 revision이 필요합니다.")
        conn = sqlite3.connect(database_path(), timeout=10.0)
        cursor = conn.cursor()
        cursor.execute("BEGIN IMMEDIATE")
        row = self.managed_project_row(cursor, project_id, include_deleted=False)
        if not row:
            conn.close()
            self.send_json(HTTPStatus.NOT_FOUND, {"error": "프로젝트를 찾을 수 없습니다."})
            return
        current_revision = int(row[7] or 1)
        if int(expected_revision) != current_revision:
            conn.close()
            self.send_json(HTTPStatus.CONFLICT, {
                "error": "다른 창에서 프로젝트가 변경되었습니다.",
                "code": "revision_conflict",
                "revision": current_revision,
                "updatedAt": row[4],
            })
            return
        cursor.execute(
            "SELECT title, content FROM project_versions WHERE project_id = ? AND revision = ?",
            (project_id, int(target_revision)),
        )
        version = cursor.fetchone()
        if not version:
            conn.close()
            self.send_json(HTTPStatus.NOT_FOUND, {"error": "복원할 저장본을 찾을 수 없습니다."})
            return
        document = strip_retired_analysis_metadata(json.loads(version[1]))
        project_data = document.get("project", {}) if isinstance(document, dict) else {}
        title = str(project_data.get("title", version[0] or "새 프로젝트")).strip()[:200] or "새 프로젝트"
        scene_count, cut_count, duration_seconds = project_summary(project_data)
        content = json.dumps(document, ensure_ascii=False)
        now = utc_now()
        next_revision = current_revision + 1
        self.archive_managed_project_version(cursor, row)
        cursor.execute(
            "UPDATE projects SET title = ?, content = ?, size_bytes = ?, updated_at = ?, opened_at = ?, "
            "revision = ?, scene_count = ?, cut_count = ?, duration_seconds = ? WHERE id = ?",
            (title, content, len(content.encode("utf-8")), now, now, next_revision,
             scene_count, cut_count, duration_seconds, project_id),
        )
        conn.commit()
        conn.close()
        self.send_json(HTTPStatus.OK, {
            "document": document,
            "storage": {
                "id": project_id,
                "title": title,
                "revision": next_revision,
                "updatedAt": now,
            },
        })

    def load_project(self, query):
        proj_id = (query.get("id") or [""])[0]
        if len(proj_id) != 8 or not proj_id.isalnum():
            raise ValueError("공유 ID가 제공되지 않았습니다.")
        session = self.get_session()
        if not session:
            raise PermissionError("인증 세션이 만료되었습니다.")
        conn = sqlite3.connect(database_path(), timeout=10.0)
        cursor = conn.cursor()
        cursor.execute("SELECT content, owner_license_hash, share_token_hash FROM projects WHERE id = ?", (proj_id,))
        row = cursor.fetchone()
        conn.close()
        if not row:
            self.send_json(HTTPStatus.NOT_FOUND, {"error": "존재하지 않거나 만료된 프로젝트입니다."})
            return
        share_token = self.headers.get("X-FrisFrame-Share", "")
        is_legacy_local = not ENABLE_LICENSE_CHECK and not row[1] and not row[2]
        is_owner = is_legacy_local or (row[1] and secrets.compare_digest(str(row[1]), str(session["license_hash"])))
        has_share = row[2] and share_token and secrets.compare_digest(str(row[2]), secret_digest(share_token))
        if not is_owner and not has_share:
            raise PermissionError("프로젝트 소유자 또는 유효한 공유 링크만 열 수 있습니다.")
        content = strip_retired_analysis_metadata(json.loads(row[0]))
        body = json_bytes(content)
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def remove_job(self, job_id):
        with JOBS_LOCK:
            job = JOBS.pop(job_id, None)
        if job:
            shutil.rmtree(job["directory"], ignore_errors=True)

    def cleanup_expired_jobs(self):
        cleanup_expired_job_storage()


def main():
    parser = argparse.ArgumentParser(description="FrisFrame local server")
    default_host = os.environ.get("HOST", "127.0.0.1")
    default_port = int(os.environ.get("PORT", 8766))
    parser.add_argument("--host", default=default_host)
    parser.add_argument("--port", type=int, default=default_port)
    args = parser.parse_args()
    root = Path(__file__).resolve().parent
    if args.host not in ("127.0.0.1", "localhost", "::1") and not ENABLE_LICENSE_CHECK:
        raise SystemExit("외부 주소로 서버를 열 때는 ENABLE_LICENSE_CHECK=true가 필요합니다.")
    if args.host not in ("127.0.0.1", "localhost", "::1") and not LICENSE_PEPPER:
        raise SystemExit("외부 주소로 서버를 열 때는 FRISFRAME_LICENSE_PEPPER가 필요합니다.")
    db_path = database_path()
    try:
        initialize_database(db_path)
        print(f"Database initialized: {db_path}", flush=True)
    except Exception as error:
        raise SystemExit(f"Failed to initialize database: {error}") from error
    handler = lambda *handler_args, **handler_kwargs: PrevisHandler(
        *handler_args, directory=str(root), **handler_kwargs
    )
    server = ThreadingHTTPServer((args.host, args.port), handler)
    sweeper_stop = threading.Event()
    sweeper = threading.Thread(target=sweep_expired_jobs, args=(sweeper_stop,), daemon=True)
    sweeper.start()
    actual_port = int(server.server_address[1])
    print("FRISFRAME_READY " + json.dumps({"port": actual_port, "pid": os.getpid()}), flush=True)
    print(f"FrisFrame: http://{args.host}:{actual_port}/", flush=True)
    parent_watchdog_stop = threading.Event()
    parent_watchdog = threading.Thread(target=watch_parent_process, args=(server, parent_watchdog_stop), daemon=True)
    parent_watchdog.start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        sweeper_stop.set()
        sweeper.join(timeout=2)
        parent_watchdog_stop.set()
        parent_watchdog.join(timeout=2)
        server.server_close()
        with JOBS_LOCK:
            jobs = list(JOBS.values())
            JOBS.clear()
        for job in jobs:
            shutil.rmtree(job["directory"], ignore_errors=True)


if __name__ == "__main__":
    main()
