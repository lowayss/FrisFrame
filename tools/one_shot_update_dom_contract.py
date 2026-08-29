#!/usr/bin/env python3
from pathlib import Path

path = Path(__file__).resolve().parents[1] / "tests" / "dom-contract.test.cjs"
source = path.read_text(encoding="utf-8")
old = '''assert.ok(ids.has("blockingPlanBtn") && ids.has("blockingPlanPanelBtn"), "2D blocking export needs toolbar and panel actions");
assert.ok(app.includes("function exportBlockingPlanImage("), "2D blocking export needs a preview-first renderer");
assert.ok(ids.has("productionPackBtn") && ids.has("productionPackPanelBtn"), "production data needs toolbar and panel actions");
assert.ok(app.includes('presentExport(zip, `${slug(project?.title || state.sceneTitle)}_production_pack.zip`'), "production data must use the preview-first export dialog");
assert.ok(app.includes('"project/cut_list.csv"') && app.includes('"docs/continuity_report.md"'), "production data must include cut and continuity reports");
assert.ok(app.includes('"project/multi_camera_plan.json"') && app.includes("function buildMultiCameraPlan("), "production data must include per-camera plans");
assert.ok(app.includes('"camera_id"'), "motion CSV must identify the camera that owns each camera key");
assert.ok(app.includes('"#productionPackBtn": "촬영 자료 ZIP"'), "production data must participate in the single-flight export lock");
assert.ok(app.includes('caption: "현재 컷 2D 동선도"') && app.includes('caption: "현재 재생 위치 카메라 프레임"'), "production preview must show actual rendered media");
assert.ok(ids.has("backgroundSheetBtn") && ids.has("backgroundSheetPanelBtn"), "background-sheet export needs toolbar and panel actions");
assert.ok(app.includes("function exportBackgroundSheetReference("), "background-sheet export needs a preview-first renderer");
assert.ok(app.includes('handoff: "codex-background-sheet"') && app.includes('path: "scene_manifest.json"'), "background-sheet export must include Codex handoff metadata");
assert.ok(app.includes('path: "media/background_hero.png"') && app.includes('path: "media/topdown_plan.png"'), "background-sheet export must include clean reference views");
assert.ok(app.includes('filter((item) => item.type !== "actor")'), "background-sheet reference must filter actor dummies from stage views");
'''
new = '''for (const retiredId of [
  "blockingPlanBtn",
  "blockingPlanPanelBtn",
  "backgroundSheetBtn",
  "backgroundSheetPanelBtn",
  "productionPackBtn",
  "productionPackPanelBtn",
]) {
  assert.equal(ids.has(retiredId), false, `${retiredId} must stay physically removed from shared HTML`);
}
for (const retiredFunction of [
  "exportBlockingPlanImage",
  "exportBackgroundSheetReference",
  "exportProductionPack",
]) {
  assert.equal(app.includes(`function ${retiredFunction}(`), false,
    `${retiredFunction} must stay physically removed from shared app source`);
}
assert.ok(app.includes('"camera_id"'), "motion CSV must identify the camera that owns each camera key");
'''
if old not in source:
    raise SystemExit("expected legacy DOM contract block was not found")
path.write_text(source.replace(old, new, 1), encoding="utf-8")
