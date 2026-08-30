#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CORE = ROOT / "mcp_server.py"
E2E = ROOT / "tests" / "mcp-previs-e2e.py"

core = CORE.read_text(encoding="utf-8")
old_save = '''def save_mutated_document(cursor, row, document, expected_revision):
    current_revision = int(row["revision"] or 1)
    if current_revision != expected_revision:
        raise ValueError(
            f"revision_conflict: 현재 revision은 {current_revision}입니다. 프로젝트를 다시 불러와 주세요."
        )
    project_obj = validate_managed_document(document)
'''
new_save = '''def ensure_expected_revision(row, expected_revision):
    current_revision = int(row["revision"] or 1)
    if current_revision != expected_revision:
        raise ValueError(
            f"revision_conflict: 현재 revision은 {current_revision}입니다. 프로젝트를 다시 불러와 주세요."
        )
    return current_revision


def save_mutated_document(cursor, row, document, expected_revision):
    current_revision = ensure_expected_revision(row, expected_revision)
    project_obj = validate_managed_document(document)
'''
if old_save not in core:
    raise SystemExit("save_mutated_document revision guard anchor changed")
core = core.replace(old_save, new_save, 1)

old_row = '''        row = load_project_row(cursor, project_id)
        document = project_document(json.loads(row["content"]))
        detail = mutation(document["project"])
'''
new_row = '''        row = load_project_row(cursor, project_id)
        # Reject stale clients before running mutation-specific validation. This
        # guarantees the caller sees revision_conflict instead of a misleading
        # "target/key not found" error caused by a newer UI/MCP edit.
        ensure_expected_revision(row, expected_revision)
        document = project_document(json.loads(row["content"]))
        detail = mutation(document["project"])
'''
if old_row not in core:
    raise SystemExit("mutate_project row anchor changed")
core = core.replace(old_row, new_row, 1)
CORE.write_text(core, encoding="utf-8")

# Strengthen the E2E so a stale request references a key that the newer UI save
# has removed. Correct behavior is still revision_conflict, not "key missing".
e2e = E2E.read_text(encoding="utf-8")
old_manual = '''                manual_document = after_failure["document"]
                manual_document["project"]["title"] = "UI에서 수정한 제목"
                manual_document["project"]["scenes"][0]["cuts"][0]["blocking"]["camera"]["focal"] = 50
                manual_saved = json.loads(core.handle_save_project(project_id, manual_document, 2))
                assert manual_saved["revision"] == 3

                # A stale MCP plan must not overwrite the UI save or leak its stage mutation.
                stale_result, stale_text = call_tool("apply_previs_plan", {
                    "project_id": project_id,
                    "revision": 2,
                    "stage_operations": [
                        {"op": "add_dummy", "id": "stale-probe", "type": "actor", "name": "오래된 revision", "x": 0.5, "y": 0.5},
                    ],
                })
                assert stale_result["isError"] is True
                assert "revision_conflict" in stale_text

                _, fresh_text = call_tool("get_project", {"project_id": project_id})
                fresh = json.loads(fresh_text)
                assert fresh["revision"] == 3
                assert fresh["document"]["project"]["title"] == "UI에서 수정한 제목"
                fresh_blocking = fresh["document"]["project"]["scenes"][0]["cuts"][0]["blocking"]
                assert fresh_blocking["camera"]["focal"] == 50
                assert all(item["id"] != "stale-probe" for item in fresh_blocking["items"])
'''
new_manual = '''                manual_document = after_failure["document"]
                manual_document["project"]["title"] = "UI에서 수정한 제목"
                manual_blocking = manual_document["project"]["scenes"][0]["cuts"][0]["blocking"]
                manual_blocking["camera"]["focal"] = 50
                stale_key_id = next(
                    key["id"] for key in manual_blocking["motion"]["keyframes"]
                    if key["source"] == "e2e-actor"
                )
                manual_blocking["motion"]["keyframes"] = [
                    key for key in manual_blocking["motion"]["keyframes"] if key["id"] != stale_key_id
                ]
                manual_saved = json.loads(core.handle_save_project(project_id, manual_document, 2))
                assert manual_saved["revision"] == 3

                # A stale MCP plan references a key deleted by the newer UI save.
                # Revision conflict must win over mutation-specific "key missing" errors.
                stale_result, stale_text = call_tool("apply_previs_plan", {
                    "project_id": project_id,
                    "revision": 2,
                    "motion_operations": [
                        {"op": "update_keyframe", "id": stale_key_id, "source_id": "e2e-actor", "time": 1.0, "x": 0.44},
                    ],
                })
                assert stale_result["isError"] is True
                assert "revision_conflict" in stale_text
                assert "수정할 동작 키를 찾을 수 없습니다" not in stale_text

                _, fresh_text = call_tool("get_project", {"project_id": project_id})
                fresh = json.loads(fresh_text)
                assert fresh["revision"] == 3
                assert fresh["document"]["project"]["title"] == "UI에서 수정한 제목"
                fresh_blocking = fresh["document"]["project"]["scenes"][0]["cuts"][0]["blocking"]
                assert fresh_blocking["camera"]["focal"] == 50
                assert all(key["id"] != stale_key_id for key in fresh_blocking["motion"]["keyframes"])
'''
if old_manual not in e2e:
    raise SystemExit("E2E stale revision anchor changed")
e2e = e2e.replace(old_manual, new_manual, 1)
E2E.write_text(e2e, encoding="utf-8")

print("revision guard hardening prepared")
