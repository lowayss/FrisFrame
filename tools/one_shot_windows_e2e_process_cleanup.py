#!/usr/bin/env python3
from pathlib import Path

path = Path(__file__).resolve().parents[1] / "tests" / "mcp-previs-e2e.py"
source = path.read_text(encoding="utf-8")

# Apply explicit SQLite close as well if the earlier one-shot has not committed it yet.
old_db = '''                with sqlite3.connect(db_path) as conn:
                    revision = conn.execute("SELECT revision FROM projects WHERE id = ?", (project_id,)).fetchone()[0]
                    versions = [row[0] for row in conn.execute(
                        "SELECT revision FROM project_versions WHERE project_id = ? ORDER BY revision",
                        (project_id,),
                    ).fetchall()]
                assert revision == 4
'''
new_db = '''                conn = sqlite3.connect(db_path)
                try:
                    revision = conn.execute("SELECT revision FROM projects WHERE id = ?", (project_id,)).fetchone()[0]
                    versions = [row[0] for row in conn.execute(
                        "SELECT revision FROM project_versions WHERE project_id = ? ORDER BY revision",
                        (project_id,),
                    ).fetchall()]
                finally:
                    conn.close()
                assert revision == 4
'''
if old_db in source:
    source = source.replace(old_db, new_db, 1)
elif new_db not in source:
    raise SystemExit("MCP E2E DB close block not recognized")

old_process = '''            finally:
                process.stdin.close()
                process.wait(timeout=5)
                stderr = process.stderr.read()
                assert "Traceback" not in stderr
'''
new_process = '''            finally:
                try:
                    _stdout_tail, stderr = process.communicate(timeout=5)
                except subprocess.TimeoutExpired as error:
                    process.kill()
                    _stdout_tail, stderr = process.communicate(timeout=5)
                    raise AssertionError("MCP stdio process did not exit after stdin EOF") from error
                assert process.returncode == 0, stderr
                assert "Traceback" not in stderr
'''
if old_process not in source:
    if new_process not in source:
        raise SystemExit("MCP E2E subprocess cleanup block not recognized")
else:
    source = source.replace(old_process, new_process, 1)

path.write_text(source, encoding="utf-8")
print("robust Windows MCP E2E resource cleanup prepared")
