from pathlib import Path
import re

server = Path("server.py")
text = server.read_text(encoding="utf-8")

get_session = '''    def get_session(self):
        if not ENABLE_LICENSE_CHECK:
            return {"token_hash": "local", "license_hash": "local"}
        token = self.get_cookie_value("frisframe_session")
        if not token:
            return None
        token_hash = secret_digest(token)
        conn = None
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
            if not row:
                return None
            return {"token_hash": token_hash, "license_hash": row[0], "expires_at": row[1]}
        except Exception:
            return None
        finally:
            if conn is not None:
                conn.close()

'''
pattern = re.compile(r'    def get_session\(self\):.*?(?=    def get_cookie_value\(self, name\):)', re.S)
text, count = pattern.subn(lambda _match: get_session, text, count=1)
if count != 1:
    raise SystemExit(f"get_session patch count: {count}")

verify_license = '''    def verify_license_key(self, key):
        if not key:
            return None
        key_hash = license_digest(key)
        candidates = [key_hash]
        legacy_hash = legacy_license_digest(key)
        if legacy_hash not in candidates:
            candidates.append(legacy_hash)
        conn = None
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
            return key_hash if row is not None else None
        except Exception:
            return None
        finally:
            if conn is not None:
                conn.close()

'''
pattern = re.compile(r'    def verify_license_key\(self, key\):.*?(?=    def validate_origin\(self\):)', re.S)
text, count = pattern.subn(lambda _match: verify_license, text, count=1)
if count != 1:
    raise SystemExit(f"verify_license_key patch count: {count}")
server.write_text(text, encoding="utf-8")

test = Path("tests/test_server_security.py")
test_text = test.read_text(encoding="utf-8")
marker = '    def test_atomic_frame_write_preserves_previous_file_on_failure(self):\n'
addition = '''    def test_get_session_closes_database_connection_when_query_fails(self):
        handler = object.__new__(server.PrevisHandler)
        handler.get_cookie_value = lambda _name: "session-token"
        connection = mock.MagicMock()
        connection.cursor.return_value.execute.side_effect = sqlite3.OperationalError("simulated session query failure")
        previous_license_check = server.ENABLE_LICENSE_CHECK
        try:
            server.ENABLE_LICENSE_CHECK = True
            with mock.patch.object(server.sqlite3, "connect", return_value=connection):
                self.assertIsNone(handler.get_session())
        finally:
            server.ENABLE_LICENSE_CHECK = previous_license_check
        connection.close.assert_called_once_with()

    def test_verify_license_key_closes_database_connection_when_query_fails(self):
        handler = object.__new__(server.PrevisHandler)
        connection = mock.MagicMock()
        connection.cursor.return_value.execute.side_effect = sqlite3.OperationalError("simulated license query failure")
        with mock.patch.object(server.sqlite3, "connect", return_value=connection):
            self.assertIsNone(handler.verify_license_key("FRIS-TEST-FAIL-0001"))
        connection.close.assert_called_once_with()

'''
if "test_get_session_closes_database_connection_when_query_fails" not in test_text:
    if marker not in test_text:
        raise SystemExit("server security test insertion marker not found")
    test_text = test_text.replace(marker, addition + marker, 1)
test.write_text(test_text, encoding="utf-8")
