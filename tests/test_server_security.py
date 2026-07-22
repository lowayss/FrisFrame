import json
import os
import sqlite3
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import server
server.REQUIRE_ORIGIN = False


class ServerSecurityTests(unittest.TestCase):
    def test_retired_analysis_metadata_is_stripped_without_losing_blocking(self):
        document = {
            "reference": {"name": "old.mp4"},
            "motionPrevis": {"imported": True},
            "items": [{
                "id": "actor-1",
                "x": 0.42,
                "provenance": {"type": "reference", "referenceId": "old"},
                "detectionConfidence": 0.9,
            }],
            "motion": {"keyframes": [{
                "id": "key-1",
                "source": "actor-1",
                "time": 2.5,
                "provenance": {"type": "reference"},
            }]},
            "scenario": {"sourceName": "scenario.txt"},
        }

        cleaned = server.strip_retired_analysis_metadata(document)

        self.assertNotIn("reference", cleaned)
        self.assertNotIn("motionPrevis", cleaned)
        self.assertEqual(cleaned["items"][0]["id"], "actor-1")
        self.assertEqual(cleaned["items"][0]["x"], 0.42)
        self.assertNotIn("provenance", cleaned["items"][0])
        self.assertNotIn("detectionConfidence", cleaned["items"][0])
        self.assertEqual(cleaned["motion"]["keyframes"][0]["source"], "actor-1")
        self.assertEqual(cleaned["motion"]["keyframes"][0]["time"], 2.5)
        self.assertNotIn("provenance", cleaned["motion"]["keyframes"][0])
        self.assertEqual(cleaned["scenario"]["sourceName"], "scenario.txt")

    def test_license_pepper_uses_hmac_digest(self):
        previous = server.LICENSE_PEPPER
        try:
            server.LICENSE_PEPPER = "test-pepper-that-is-not-shipped"
            digest = server.license_digest("FRIS-TEST-0000-0001")
        finally:
            server.LICENSE_PEPPER = previous
        self.assertTrue(digest.startswith("hmac-sha256:"))
        self.assertNotEqual(digest, server.legacy_license_digest("FRIS-TEST-0000-0001"))

    def test_plaintext_license_is_migrated_to_hash(self):
        with tempfile.TemporaryDirectory() as directory:
            db_path = Path(directory) / "frisframe.db"
            conn = sqlite3.connect(db_path)
            conn.execute(
                "CREATE TABLE licenses (key TEXT PRIMARY KEY, owner TEXT, is_active INTEGER DEFAULT 1)"
            )
            conn.execute(
                "INSERT INTO licenses (key, owner, is_active) VALUES (?, ?, 1)",
                ("FRIS-TEST-0000-0001", "Tester"),
            )
            conn.commit()
            conn.close()

            server.initialize_database(db_path)

            conn = sqlite3.connect(db_path)
            stored_key = conn.execute("SELECT key FROM licenses").fetchone()[0]
            conn.close()
            self.assertEqual(stored_key, server.license_digest("FRIS-TEST-0000-0001"))
            self.assertNotIn("FRIS-TEST", stored_key)

    def test_empty_database_does_not_seed_demo_license(self):
        with tempfile.TemporaryDirectory() as directory:
            db_path = Path(directory) / "frisframe.db"
            server.initialize_database(db_path)
            conn = sqlite3.connect(db_path)
            count = conn.execute("SELECT COUNT(*) FROM licenses").fetchone()[0]
            conn.close()
            self.assertEqual(count, 0)

    def test_sensitive_repository_files_are_not_static(self):
        self.assertNotIn("/server.py", server.STATIC_FILES)
        self.assertNotIn("/previs_projects.db", server.STATIC_FILES)
        self.assertNotIn("/.git/config", server.STATIC_FILES)
        self.assertIn("/app.js", server.STATIC_FILES)
        self.assertIn("/motion-core.js", server.STATIC_FILES)
        self.assertIn("/project-recovery-core.js", server.STATIC_FILES)
        self.assertIn("/manual-guide-core.js", server.STATIC_FILES)
        self.assertNotIn("/video-analysis-core.js", server.STATIC_FILES)


class ProjectManagementApiTests(unittest.TestCase):
    def setUp(self):
        self.temp_directory = tempfile.TemporaryDirectory()
        self.previous_db_path = os.environ.get("PREVIS_DB_PATH")
        self.db_path = str(Path(self.temp_directory.name) / "frisframe.db")
        os.environ["PREVIS_DB_PATH"] = self.db_path
        server.initialize_database(self.db_path)
        self.httpd = server.ThreadingHTTPServer(("127.0.0.1", 0), server.PrevisHandler)
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)
        self.thread.start()
        self.base_url = f"http://127.0.0.1:{self.httpd.server_address[1]}"

    def tearDown(self):
        self.httpd.shutdown()
        self.httpd.server_close()
        self.thread.join(timeout=2)
        if self.previous_db_path is None:
            os.environ.pop("PREVIS_DB_PATH", None)
        else:
            os.environ["PREVIS_DB_PATH"] = self.previous_db_path
        self.temp_directory.cleanup()

    def request_json(self, path, payload=None):
        data = None if payload is None else json.dumps(payload).encode("utf-8")
        request = urllib.request.Request(
            self.base_url + path,
            data=data,
            headers={"Content-Type": "application/json"} if data else {},
            method="POST" if data else "GET",
        )
        with urllib.request.urlopen(request, timeout=3) as response:
            return response.status, json.loads(response.read().decode("utf-8"))

    def project_document(self, title="테스트 프로젝트"):
        return {
            "app": "FrisFrame",
            "schemaVersion": 6,
            "project": {
                "id": "document-id",
                "title": title,
                "scenes": [{"id": "scene-1", "cuts": [{
                    "id": "cut-1",
                    "blocking": {"motion": {"duration": 12}},
                }]}],
            },
        }

    def test_managed_project_lifecycle_and_revision_conflict(self):
        _, stored = self.request_json("/api/projects/store", {"document": self.project_document()})
        project_id = stored["id"]
        self.assertEqual(stored["revision"], 1)

        _, listing = self.request_json("/api/projects")
        self.assertEqual([entry["id"] for entry in listing["projects"]], [project_id])
        self.assertEqual(listing["projects"][0]["sceneCount"], 1)
        self.assertEqual(listing["projects"][0]["cutCount"], 1)
        self.assertEqual(listing["projects"][0]["durationSeconds"], 12)

        _, loaded = self.request_json(f"/api/projects/load?id={project_id}")
        self.assertEqual(loaded["document"]["project"]["title"], "테스트 프로젝트")
        self.assertEqual(loaded["storage"]["revision"], 1)

        _, updated = self.request_json("/api/projects/store", {
            "id": project_id,
            "revision": 1,
            "document": self.project_document("수정된 프로젝트"),
        })
        self.assertEqual(updated["revision"], 2)

        with self.assertRaises(urllib.error.HTTPError) as conflict:
            self.request_json("/api/projects/store", {
                "id": project_id,
                "revision": 1,
                "document": self.project_document("뒤늦은 저장"),
            })
        self.assertEqual(conflict.exception.code, 409)
        conflict_payload = json.loads(conflict.exception.read().decode("utf-8"))
        conflict.exception.close()
        self.assertEqual(conflict_payload["code"], "revision_conflict")

        self.request_json("/api/projects/trash", {"id": project_id})
        _, active = self.request_json("/api/projects")
        _, trash = self.request_json("/api/projects?trash=1")
        self.assertEqual(active["projects"], [])
        self.assertEqual(trash["projects"][0]["id"], project_id)

        self.request_json("/api/projects/restore", {"id": project_id})
        _, active = self.request_json("/api/projects")
        self.assertEqual(active["projects"][0]["id"], project_id)

        self.request_json("/api/projects/trash", {"id": project_id})
        self.request_json("/api/projects/delete", {"id": project_id})
        _, trash = self.request_json("/api/projects?trash=1")
        self.assertEqual(trash["projects"], [])

    def test_share_snapshot_remains_loadable_and_is_not_listed(self):
        _, shared = self.request_json("/api/project/save", self.project_document("공유본"))
        _, listing = self.request_json("/api/projects")
        self.assertEqual(listing["projects"], [])
        _, loaded = self.request_json(f"/api/project/load?id={shared['id']}")
        self.assertEqual(loaded["project"]["title"], "공유본")

    def test_managed_store_removes_retired_analysis_metadata(self):
        document = self.project_document("이전 분석 프로젝트")
        blocking = document["project"]["scenes"][0]["cuts"][0]["blocking"]
        blocking.update({
            "reference": {"name": "old.mp4"},
            "motionPrevis": {"imported": True},
            "items": [{
                "id": "actor-1",
                "type": "actor",
                "x": 0.4,
                "provenance": {"type": "reference"},
                "detectionConfidence": 0.85,
            }],
        })
        blocking["motion"]["keyframes"] = [{
            "id": "key-1",
            "source": "actor-1",
            "time": 3,
            "provenance": {"type": "reference"},
        }]

        _, stored = self.request_json("/api/projects/store", {"document": document})
        _, loaded = self.request_json(f"/api/projects/load?id={stored['id']}")
        cleaned = loaded["document"]["project"]["scenes"][0]["cuts"][0]["blocking"]

        self.assertNotIn("reference", cleaned)
        self.assertNotIn("motionPrevis", cleaned)
        self.assertEqual(cleaned["items"][0]["id"], "actor-1")
        self.assertNotIn("provenance", cleaned["items"][0])
        self.assertEqual(cleaned["motion"]["keyframes"][0]["source"], "actor-1")
        self.assertNotIn("provenance", cleaned["motion"]["keyframes"][0])

    def test_simultaneous_saves_allow_only_one_revision_winner(self):
        _, stored = self.request_json("/api/projects/store", {"document": self.project_document()})
        project_id = stored["id"]

        def save_title(title):
            try:
                status, _ = self.request_json("/api/projects/store", {
                    "id": project_id,
                    "revision": 1,
                    "document": self.project_document(title),
                })
                return status
            except urllib.error.HTTPError as error:
                status = error.code
                error.close()
                return status

        with ThreadPoolExecutor(max_workers=2) as executor:
            statuses = list(executor.map(save_title, ["동시 저장 A", "동시 저장 B"]))
        self.assertEqual(sorted(statuses), [200, 409])

    def test_existing_project_update_requires_revision(self):
        _, stored = self.request_json("/api/projects/store", {"document": self.project_document()})
        with self.assertRaises(urllib.error.HTTPError) as missing_revision:
            self.request_json("/api/projects/store", {
                "id": stored["id"],
                "document": self.project_document("revision 없는 저장"),
            })
        self.assertEqual(missing_revision.exception.code, 400)
        missing_revision.exception.close()

    def test_invalid_document_cannot_overwrite_existing_project(self):
        _, stored = self.request_json("/api/projects/store", {"document": self.project_document("안전한 원본")})
        project_id = stored["id"]
        for invalid_document in (None, {}, {"project": None}, {"schemaVersion": 999, "project": {"scenes": []}}):
            with self.assertRaises(urllib.error.HTTPError) as invalid_save:
                self.request_json("/api/projects/store", {
                    "id": project_id,
                    "revision": 1,
                    "document": invalid_document,
                })
            self.assertEqual(invalid_save.exception.code, 400)
            invalid_save.exception.close()

        _, loaded = self.request_json(f"/api/projects/load?id={project_id}")
        self.assertEqual(loaded["document"]["project"]["title"], "안전한 원본")
        self.assertEqual(loaded["storage"]["revision"], 1)

    def test_mp4_job_expiry_uses_last_activity_and_skips_encoding(self):
        now = 1_000_000
        self.assertFalse(server.job_is_expired({
            "created_at": now - server.JOB_TTL_SECONDS - 30,
            "last_activity": now - 5,
            "status": "uploading",
        }, now))
        self.assertTrue(server.job_is_expired({
            "created_at": now - 5,
            "last_activity": now - server.JOB_TTL_SECONDS - 1,
            "status": "uploading",
        }, now))
        self.assertFalse(server.job_is_expired({
            "created_at": 0,
            "last_activity": 0,
            "status": "encoding",
        }, now))

    def test_rename_uses_revision_and_preserves_newer_content(self):
        _, stored = self.request_json("/api/projects/store", {"document": self.project_document("원본")})
        project_id = stored["id"]
        _, updated = self.request_json("/api/projects/store", {
            "id": project_id,
            "revision": 1,
            "document": self.project_document("다른 창의 본문"),
        })
        self.assertEqual(updated["revision"], 2)

        with self.assertRaises(urllib.error.HTTPError) as stale_rename:
            self.request_json("/api/projects/rename", {
                "id": project_id,
                "revision": 1,
                "title": "오래된 창의 이름",
            })
        self.assertEqual(stale_rename.exception.code, 409)
        stale_payload = json.loads(stale_rename.exception.read().decode("utf-8"))
        stale_rename.exception.close()
        self.assertEqual(stale_payload["code"], "revision_conflict")

        _, loaded = self.request_json(f"/api/projects/load?id={project_id}")
        self.assertEqual(loaded["document"]["project"]["title"], "다른 창의 본문")
        self.assertEqual(loaded["storage"]["revision"], 2)

    def test_recent_versions_can_restore_an_older_saved_document(self):
        _, stored = self.request_json("/api/projects/store", {"document": self.project_document("저장본 1")})
        project_id = stored["id"]
        _, second = self.request_json("/api/projects/store", {
            "id": project_id,
            "revision": 1,
            "document": self.project_document("저장본 2"),
        })
        _, third = self.request_json("/api/projects/store", {
            "id": project_id,
            "revision": second["revision"],
            "document": self.project_document("저장본 3"),
        })

        _, versions = self.request_json(f"/api/projects/versions?id={project_id}")
        self.assertEqual([entry["revision"] for entry in versions["versions"]], [2, 1])

        _, restored = self.request_json("/api/projects/version/restore", {
            "id": project_id,
            "revision": third["revision"],
            "versionRevision": 1,
        })
        self.assertEqual(restored["storage"]["revision"], 4)
        self.assertEqual(restored["document"]["project"]["title"], "저장본 1")

        _, reloaded = self.request_json(f"/api/projects/load?id={project_id}")
        self.assertEqual(reloaded["document"]["project"]["title"], "저장본 1")
        self.assertEqual(reloaded["storage"]["revision"], 4)


if __name__ == "__main__":
    unittest.main()
