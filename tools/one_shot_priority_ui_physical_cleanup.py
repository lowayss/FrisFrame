#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
APP = ROOT / "app.js"
STYLES = ROOT / "styles.css"
DOM_TEST = ROOT / "tests" / "dom-contract.test.cjs"


def remove_once(text: str, block: str, label: str) -> str:
    if block not in text:
        raise SystemExit(f"missing expected block: {label}")
    return text.replace(block, "", 1)


# --- Shared HTML: physically remove the user-visible retired surfaces.
html = INDEX.read_text(encoding="utf-8")
for block, label in [
    ('              <button id="blockingPlanBtn" class="text-btn"><i data-lucide="map" aria-hidden="true"></i><span>2D 블로킹 이미지</span></button>\n', "top blocking-plan button"),
    ('              <button id="backgroundSheetBtn" class="primary-btn"><i data-lucide="layers-3" aria-hidden="true"></i><span>배경시트 레퍼런스</span></button>\n', "top background-sheet button"),
    ('              <button id="productionPackBtn" class="text-btn"><i data-lucide="package-check" aria-hidden="true"></i><span>촬영 자료 ZIP</span></button>\n', "top production-pack button"),
    ('              <button id="multiCamPreviewBtn" class="text-btn"><i data-lucide="layout-grid" aria-hidden="true"></i><span>멀티캠 프리뷰</span></button>\n', "top multicam-preview button"),
    ('              <button id="multiCamVideoBtn" class="primary-btn"><i data-lucide="clapperboard" aria-hidden="true"></i><span>멀티캠 영상</span></button>\n', "top multicam-video button"),
    ('              <button id="multiCamPreviewPanelBtn" type="button" class="text-btn" aria-label="멀티카메라 프리뷰"><i data-lucide="layout-grid" aria-hidden="true"></i><span>멀티캠</span></button>\n', "camera-panel multicam-preview button"),
    ('            <button id="blockingPlanPanelBtn" type="button" class="text-btn"><i data-lucide="map" aria-hidden="true"></i><span>2D 블로킹</span></button>\n', "side blocking-plan button"),
    ('            <button id="backgroundSheetPanelBtn" type="button" class="primary-btn"><i data-lucide="layers-3" aria-hidden="true"></i><span>배경시트</span></button>\n', "side background-sheet button"),
    ('            <button id="productionPackPanelBtn" type="button" class="text-btn"><i data-lucide="package-check" aria-hidden="true"></i><span>촬영 자료</span></button>\n', "side production-pack button"),
    ('            <button id="multiCamPreviewPanelBtnSecondary" type="button" class="text-btn"><i data-lucide="layout-grid" aria-hidden="true"></i><span>멀티캠</span></button>\n', "side multicam-preview button"),
    ('            <button id="multiCamVideoPanelBtn" type="button" class="primary-btn"><i data-lucide="clapperboard" aria-hidden="true"></i><span>멀티캠 영상</span></button>\n', "side multicam-video button"),
]:
    html = remove_once(html, block, label)

spatial_start = html.find('        <details class="spatial-reference-panel compact-details"')
if spatial_start < 0:
    raise SystemExit("missing spatial-reference panel start")
spatial_end_marker = '        </details>\n\n        <details class="panel-section compact-details mobile-collapsible" data-mobile-collapsible open>'
spatial_end = html.find(spatial_end_marker, spatial_start)
if spatial_end < 0:
    raise SystemExit("missing spatial-reference panel end")
html = html[:spatial_start] + '        <details class="panel-section compact-details mobile-collapsible" data-mobile-collapsible open>' + html[spatial_end + len(spatial_end_marker):]

# The priority hotfix already corrected this copy; keep the supported output wording.
html = html.replace(
    "2D 동선도, 3D 카메라 프레임, 배경시트 레퍼런스를 준비합니다.",
    "현재 프레임, 시작·끝 프레임, 프리비즈 영상을 준비합니다.",
)
INDEX.write_text(html, encoding="utf-8")

# --- app.js: remove direct DOM dependencies for the physically removed controls.
app = APP.read_text(encoding="utf-8")
app = remove_once(app, '  renderSpatialGuideControls();\n', "spatial guide render call")

multi_ready = '''  const multiVideoReady = profiles.length > 1;\n  [$("#multiCamVideoBtn"), $("#multiCamVideoPanelBtn")].forEach((button) => {\n    if (!button) return;\n    button.disabled = !multiVideoReady || mediaExportBusy;\n    button.title = multiVideoReady ? "카메라별 화면을 분할한 H.264 프리뷰 영상" : "카메라를 2대 이상 추가하면 사용할 수 있습니다";\n  });\n'''
app = remove_once(app, multi_ready, "multicam export readiness controls")

for block, label in [
    ('$("#spatialReferenceImageInput").addEventListener("change", (event) => {\n  importSpatialReferenceImage(event.currentTarget.files?.[0]);\n});\n$("#clearSpatialReferenceBtn").addEventListener("click", clearSpatialReference);\n', "spatial-reference event bindings"),
    ('$("#multiCamVideoBtn").addEventListener("click", exportMultiCameraVideo);\n$("#multiCamVideoPanelBtn").addEventListener("click", exportMultiCameraVideo);\n$("#multiCamPreviewBtn").addEventListener("click", exportMultiCameraPreview);\n$("#multiCamPreviewPanelBtn").addEventListener("click", exportMultiCameraPreview);\n$("#multiCamPreviewPanelBtnSecondary").addEventListener("click", exportMultiCameraPreview);\n', "multicam export event bindings"),
    ('$("#blockingPlanBtn").addEventListener("click", exportBlockingPlanImage);\n$("#blockingPlanPanelBtn").addEventListener("click", exportBlockingPlanImage);\n', "blocking-plan event bindings"),
    ('$("#backgroundSheetBtn").addEventListener("click", exportBackgroundSheetReference);\n$("#backgroundSheetPanelBtn").addEventListener("click", exportBackgroundSheetReference);\n', "background-sheet event bindings"),
    ('$("#productionPackBtn").addEventListener("click", exportProductionPack);\n$("#productionPackPanelBtn").addEventListener("click", exportProductionPack);\n', "production-pack event bindings"),
]:
    app = remove_once(app, block, label)

spatial_function_start = app.find("async function importSpatialReferenceImage(file) {")
spatial_function_end = app.find("function wrapCanvasText(", spatial_function_start)
if spatial_function_start < 0 or spatial_function_end < 0:
    raise SystemExit("spatial-reference helper block anchors changed")
app = app[:spatial_function_start] + app[spatial_function_end:]
APP.write_text(app, encoding="utf-8")

# --- CSS: the temporary hide shim is no longer needed after physical DOM removal.
styles = STYLES.read_text(encoding="utf-8")
marker = "/* Priority product-boundary hotfix: retired surfaces stay hidden on main desktop builds. */"
marker_index = styles.find(marker)
if marker_index < 0:
    raise SystemExit("priority hide shim marker missing")
styles = styles[:marker_index].rstrip() + "\n"
STYLES.write_text(styles, encoding="utf-8")

# --- DOM contract: enforce absence while keeping multicamera editing behavior intact.
test = DOM_TEST.read_text(encoding="utf-8")
old_multi = 'assert.ok(ids.has("multiCamVideoBtn") && ids.has("multiCamVideoPanelBtn"), "multi-camera video needs toolbar and panel actions");\n'
new_multi = '''for (const retiredId of [\n  "multiCamPreviewBtn",\n  "multiCamPreviewPanelBtn",\n  "multiCamPreviewPanelBtnSecondary",\n  "multiCamVideoBtn",\n  "multiCamVideoPanelBtn",\n]) {\n  assert.equal(ids.has(retiredId), false, `${retiredId} must stay physically removed from shared HTML`);\n}\n'''
if old_multi not in test:
    raise SystemExit("multicam DOM contract anchor changed")
test = test.replace(old_multi, new_multi, 1)

old_blocking = 'assert.ok(ids.has("blockingPlanBtn") && ids.has("blockingPlanPanelBtn"), "2D blocking export needs toolbar and panel actions");\n'
new_blocking = '''for (const retiredId of [\n  "blockingPlanBtn",\n  "blockingPlanPanelBtn",\n]) {\n  assert.equal(ids.has(retiredId), false, `${retiredId} must stay physically removed from shared HTML`);\n}\n'''
if old_blocking not in test:
    raise SystemExit("blocking DOM contract anchor changed")
test = test.replace(old_blocking, new_blocking, 1)

old_production = 'assert.ok(ids.has("productionPackBtn") && ids.has("productionPackPanelBtn"), "production data needs toolbar and panel actions");\n'
new_production = '''for (const retiredId of [\n  "productionPackBtn",\n  "productionPackPanelBtn",\n]) {\n  assert.equal(ids.has(retiredId), false, `${retiredId} must stay physically removed from shared HTML`);\n}\n'''
if old_production not in test:
    raise SystemExit("production DOM contract anchor changed")
test = test.replace(old_production, new_production, 1)

old_background = 'assert.ok(ids.has("backgroundSheetBtn") && ids.has("backgroundSheetPanelBtn"), "background-sheet export needs toolbar and panel actions");\n'
new_background = '''for (const retiredId of [\n  "backgroundSheetBtn",\n  "backgroundSheetPanelBtn",\n]) {\n  assert.equal(ids.has(retiredId), false, `${retiredId} must stay physically removed from shared HTML`);\n}\nfor (const retiredSpatialId of [\n  "spatialReferenceStatus",\n  "spatialReferenceImageInput",\n  "spatialReferencePreview",\n  "clearSpatialReferenceBtn",\n]) {\n  assert.equal(ids.has(retiredSpatialId), false, `${retiredSpatialId} must stay physically removed from shared HTML`);\n}\nassert.equal(html.includes("spatial-reference-panel"), false,\n  "in-app background-image reference panel must stay physically removed");\n'''
if old_background not in test:
    raise SystemExit("background-sheet DOM contract anchor changed")
test = test.replace(old_background, new_background, 1)
DOM_TEST.write_text(test, encoding="utf-8")

print("priority UI surfaces physically removed")
