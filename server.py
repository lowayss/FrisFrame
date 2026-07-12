#!/usr/bin/env python3
import argparse
import json
import os
import secrets
import shutil
import sqlite3
import string
import subprocess
import tempfile
import threading
import uuid
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse


MAX_FRAME_BYTES = 12 * 1024 * 1024
JOBS = {}
JOBS_LOCK = threading.Lock()
ENABLE_LICENSE_CHECK = os.environ.get("ENABLE_LICENSE_CHECK", "False").lower() == "true"


def json_bytes(payload):
    return json.dumps(payload, ensure_ascii=False).encode("utf-8")


class PrevisHandler(SimpleHTTPRequestHandler):
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
        if not ENABLE_LICENSE_CHECK:
            return True
        auth_key = self.get_cookie_value("license_auth")
        return self.verify_license_key(auth_key)

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
            return False
        db_path = os.environ.get("PREVIS_DB_PATH", str(Path(__file__).resolve().parent / "previs_projects.db"))
        try:
            conn = sqlite3.connect(db_path, timeout=10.0)
            cursor = conn.cursor()
            cursor.execute("SELECT is_active FROM licenses WHERE key = ? AND is_active = 1", (key,))
            row = cursor.fetchone()
            conn.close()
            return row is not None
        except Exception:
            return False

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
        payload = json.loads(self.read_body(64 * 1024).decode("utf-8"))
        license_key = str(payload.get("licenseKey", "")).strip()
        if not license_key:
            raise ValueError("라이센스 키를 입력해 주세요.")
        
        if self.verify_license_key(license_key):
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Set-Cookie", f"license_auth={license_key}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Strict")
            body = json_bytes({"success": True, "message": "라이센스가 성공적으로 활성화되었습니다."})
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "유효하지 않거나 비활성화된 라이센스 키입니다."})

    def deactivate_license(self):
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Set-Cookie", "license_auth=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict")
        body = json_bytes({"success": True, "message": "로그아웃되었습니다."})
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/project/load":
            if not self.is_authenticated():
                self.send_json(HTTPStatus.UNAUTHORIZED, {"error": "인증이 필요합니다."})
                return
            try:
                self.load_project(parse_qs(parsed.query))
            except ValueError as error:
                self.send_json(HTTPStatus.BAD_REQUEST, {"error": str(error)})
            except Exception as error:
                self.send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": str(error)})
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

        super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/license/activate":
            try:
                self.activate_license()
            except ValueError as error:
                self.send_json(HTTPStatus.BAD_REQUEST, {"error": str(error)})
            except Exception as error:
                self.send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": str(error)})
            return
        elif parsed.path == "/api/license/deactivate":
            try:
                self.deactivate_license()
            except ValueError as error:
                self.send_json(HTTPStatus.BAD_REQUEST, {"error": str(error)})
            except Exception as error:
                self.send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": str(error)})
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
            else:
                self.send_error(HTTPStatus.NOT_FOUND)
        except ValueError as error:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": str(error)})
        except Exception as error:
            self.send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": str(error)})

    def start_mp4_job(self):
        payload = json.loads(self.read_body(64 * 1024).decode("utf-8"))
        width = int(payload.get("width", 0))
        height = int(payload.get("height", 0))
        fps = int(payload.get("fps", 0))
        frame_count = int(payload.get("frameCount", 0))
        if not 64 <= width <= 3840 or not 64 <= height <= 3840:
            raise ValueError("MP4 해상도가 지원 범위를 벗어났습니다.")
        if not 1 <= fps <= 60 or not 2 <= frame_count <= 7200:
            raise ValueError("MP4 프레임 설정이 올바르지 않습니다.")
        job_id = uuid.uuid4().hex
        directory = Path(tempfile.mkdtemp(prefix="previs-mp4-"))
        with JOBS_LOCK:
            JOBS[job_id] = {
                "directory": directory,
                "width": width,
                "height": height,
                "fps": fps,
                "frame_count": frame_count,
                "received": set(),
            }
        self.send_json(HTTPStatus.OK, {"jobId": job_id})

    def get_job(self, query):
        job_id = (query.get("job") or [""])[0]
        with JOBS_LOCK:
            job = JOBS.get(job_id)
        if not job:
            raise ValueError("만료되었거나 존재하지 않는 MP4 작업입니다.")
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
        frame_path.write_bytes(data)
        with JOBS_LOCK:
            current = JOBS.get(job_id)
            if current:
                current["received"].add(index)
        self.send_json(HTTPStatus.OK, {"received": index})

    def finish_mp4_job(self, query):
        job_id, job = self.get_job(query)
        missing = sorted(set(range(job["frame_count"])) - job["received"])
        if missing:
            raise ValueError(f"MP4 프레임 {len(missing)}개가 누락되었습니다.")
        output_path = job["directory"] / "preview.mp4"
        command = [
            "ffmpeg",
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
            "medium",
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
        result = subprocess.run(command, capture_output=True, text=True, timeout=900)
        if result.returncode != 0 or not output_path.exists():
            detail = result.stderr.strip() or "FFmpeg가 MP4를 만들지 못했습니다."
            raise RuntimeError(detail)
        data = output_path.read_bytes()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "video/mp4")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)
        self.remove_job(job_id)

    def cancel_mp4_job(self, query):
        job_id = (query.get("job") or [""])[0]
        self.remove_job(job_id)
        self.send_json(HTTPStatus.OK, {"cancelled": True})

    def save_project(self):
        payload_bytes = self.read_body(16 * 1024 * 1024)
        payload = json.loads(payload_bytes.decode("utf-8"))
        project_data = payload.get("project", {})
        title = project_data.get("title", "Untitled Project")
        db_path = os.environ.get("PREVIS_DB_PATH", str(Path(__file__).resolve().parent / "previs_projects.db"))
        conn = sqlite3.connect(db_path, timeout=10.0)
        cursor = conn.cursor()
        for _ in range(10):
            proj_id = "".join(secrets.choice(string.ascii_letters + string.digits) for _ in range(8))
            cursor.execute("SELECT 1 FROM projects WHERE id = ?", (proj_id,))
            if not cursor.fetchone():
                break
        else:
            conn.close()
            raise RuntimeError("공유 ID 생성에 실패했습니다.")
        cursor.execute(
            "INSERT INTO projects (id, title, content) VALUES (?, ?, ?)",
            (proj_id, title, payload_bytes.decode("utf-8"))
        )
        conn.commit()
        conn.close()
        self.send_json(HTTPStatus.OK, {"id": proj_id})

    def load_project(self, query):
        proj_id = (query.get("id") or [""])[0]
        if not proj_id:
            raise ValueError("공유 ID가 제공되지 않았습니다.")
        db_path = os.environ.get("PREVIS_DB_PATH", str(Path(__file__).resolve().parent / "previs_projects.db"))
        conn = sqlite3.connect(db_path, timeout=10.0)
        cursor = conn.cursor()
        cursor.execute("SELECT content FROM projects WHERE id = ?", (proj_id,))
        row = cursor.fetchone()
        conn.close()
        if not row:
            self.send_json(HTTPStatus.NOT_FOUND, {"error": "존재하지 않거나 만료된 프로젝트입니다."})
            return
        content = row[0]
        body = content.encode("utf-8")
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


def main():
    parser = argparse.ArgumentParser(description="FrisFrame local server")
    default_host = os.environ.get("HOST", "127.0.0.1")
    default_port = int(os.environ.get("PORT", 8766))
    parser.add_argument("--host", default=default_host)
    parser.add_argument("--port", type=int, default=default_port)
    args = parser.parse_args()
    root = Path(__file__).resolve().parent
    db_path = os.environ.get("PREVIS_DB_PATH", str(root / "previs_projects.db"))
    try:
        conn = sqlite3.connect(db_path, timeout=10.0)
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
        # Seed default test license if not present
        cursor.execute("SELECT 1 FROM licenses WHERE key = 'FRIS-DEMO-2026'")
        if not cursor.fetchone():
            cursor.execute("INSERT INTO licenses (key, owner, is_active) VALUES ('FRIS-DEMO-2026', 'Demo User', 1)")
        conn.commit()
        conn.close()
        print(f"Database initialized: {db_path}", flush=True)
    except Exception as e:
        print(f"Failed to initialize database: {e}", flush=True)
    handler = lambda *handler_args, **handler_kwargs: PrevisHandler(
        *handler_args, directory=str(root), **handler_kwargs
    )
    server = ThreadingHTTPServer((args.host, args.port), handler)
    print(f"FrisFrame: http://{args.host}:{args.port}/", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        with JOBS_LOCK:
            jobs = list(JOBS.values())
            JOBS.clear()
        for job in jobs:
            shutil.rmtree(job["directory"], ignore_errors=True)


if __name__ == "__main__":
    main()
