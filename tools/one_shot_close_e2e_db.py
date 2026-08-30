#!/usr/bin/env python3
from pathlib import Path

path = Path(__file__).resolve().parents[1] / "tests" / "mcp-previs-e2e.py"
source = path.read_text(encoding="utf-8")
old = '''                with sqlite3.connect(db_path) as conn:
                    revision = conn.execute("SELECT revision FROM projects WHERE id = ?", (project_id,)).fetchone()[0]
                    versions = [row[0] for row in conn.execute(
                        "SELECT revision FROM project_versions WHERE project_id = ? ORDER BY revision",
                        (project_id,),
                    ).fetchall()]
                assert revision == 4
'''
new = '''                conn = sqlite3.connect(db_path)
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
if old not in source:
    raise SystemExit("MCP E2E final SQLite inspection anchor changed")
path.write_text(source.replace(old, new, 1), encoding="utf-8")
print("Windows-safe MCP E2E DB close prepared")
