#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PRELOAD = ROOT / "electron" / "preload.cjs"
TEST = ROOT / "tests" / "mcp-first-product-boundary.test.cjs"
README = ROOT / "README.md"
MAINT = ROOT / "MAINTENANCE.md"


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


# 1) Electron preload: remove compatibility shims for source surfaces that no longer exist.
preload = PRELOAD.read_text(encoding="utf-8")
legacy_block = '''    const retiredExportIds = [
      "blockingPlanBtn",
      "backgroundSheetBtn",
      "productionPackBtn",
      "multiCamPreviewBtn",
      "multiCamVideoBtn",
      "blockingPlanPanelBtn",
      "backgroundSheetPanelBtn",
      "productionPackPanelBtn",
      "multiCamPreviewPanelBtnSecondary",
      "multiCamVideoPanelBtn",
    ];
    const retiredExportPattern = /Reference\\s*(Readiness|Prompt)|배경시트|촬영\\s*자료|멀티캠|2D\\s*블로킹/i;

    const removeRetiredExportControls = () => {
      retiredExportIds.forEach((id) => document.getElementById(id)?.remove());
      document.querySelectorAll("#exportMenu button, .export-panel-actions button").forEach((button) => {
        const label = (button.textContent || "").trim();
        if (retiredExportPattern.test(label)) button.remove();
      });
    };

    document.querySelectorAll(".spatial-reference-panel").forEach((panel) => panel.remove());

'''
preload = replace_once(preload, legacy_block, "", "preload legacy removal block")
observer_block = '''    removeRetiredExportControls();
    syncWorkspacePanels();

    const observer = new MutationObserver(() => removeRetiredExportControls());
    const exportMenu = document.getElementById("exportMenu");
    if (exportMenu) observer.observe(exportMenu, { childList: true, subtree: true });
    if (exportActions) observer.observe(exportActions, { childList: true, subtree: true });
'''
preload = replace_once(preload, observer_block, '    syncWorkspacePanels();\n', "preload legacy observer block")
for forbidden in ["retiredExportIds", "removeRetiredExportControls", ".spatial-reference-panel"]:
    if forbidden in preload:
        raise SystemExit(f"preload still contains retired compatibility marker: {forbidden}")
PRELOAD.write_text(preload, encoding="utf-8")


# 2) Product-boundary contract: shared source must itself stay clean; Electron should not hide legacy DOM.
test = TEST.read_text(encoding="utf-8")
test = replace_once(
    test,
    'const preload = fs.readFileSync(path.join(root, "electron/preload.cjs"), "utf8");\n',
    'const preload = fs.readFileSync(path.join(root, "electron/preload.cjs"), "utf8");\n'
    'const app = fs.readFileSync(path.join(root, "app.js"), "utf8");\n'
    'const html = fs.readFileSync(path.join(root, "index.html"), "utf8");\n',
    "test shared source loads",
)
old_contract = '''// Legacy output surfaces may remain in shared app.js/index.html until their bindings are
// safely split, but the Electron product must actively remove them from the user workflow.
for (const retiredId of [
  "blockingPlanBtn",
  "backgroundSheetBtn",
  "productionPackBtn",
  "multiCamPreviewBtn",
  "multiCamVideoBtn",
]) {
  assert.ok(preload.includes(`\\"${retiredId}\\"`),
    `desktop workflow must retire ${retiredId}`);
}
assert.match(preload, /document\\.querySelectorAll\\("\\.spatial-reference-panel"\\)[\\s\\S]*\\.remove\\(\\)/,
  "desktop workflow must remove the in-app spatial/background reference panel");
'''
new_contract = '''// Retired output/reference surfaces are physically absent from the shared browser source.
// Electron must not carry a second hide/remove compatibility layer for them.
for (const retiredId of [
  "blockingPlanBtn",
  "blockingPlanPanelBtn",
  "backgroundSheetBtn",
  "backgroundSheetPanelBtn",
  "productionPackBtn",
  "productionPackPanelBtn",
  "multiCamPreviewBtn",
  "multiCamPreviewPanelBtn",
  "multiCamPreviewPanelBtnSecondary",
  "multiCamVideoBtn",
  "multiCamVideoPanelBtn",
  "spatialReferenceImageInput",
  "clearSpatialReferenceBtn",
]) {
  assert.equal(html.includes(`id="${retiredId}"`), false,
    `${retiredId} must stay physically removed from shared HTML`);
}
for (const retiredFunction of [
  "exportBlockingPlanImage",
  "exportBackgroundSheetReference",
  "exportProductionPack",
  "exportMultiCameraPreview",
  "exportMultiCameraVideo",
  "buildSeedancePrompt",
  "buildAiGenerationBrief",
  "importSpatialReferenceImage",
  "clearSpatialReference",
]) {
  assert.equal(app.includes(`function ${retiredFunction}(`), false,
    `${retiredFunction} must stay physically removed from shared app source`);
}
assert.equal(html.includes("spatial-reference-panel"), false,
  "in-app spatial/background reference panel must stay physically removed");
assert.equal(preload.includes("retiredExportIds"), false,
  "Electron preload must not maintain a retired-export ID shim");
assert.equal(preload.includes("removeRetiredExportControls"), false,
  "Electron preload must not hide source-level legacy export controls");
assert.equal(preload.includes(".spatial-reference-panel"), false,
  "Electron preload must not remove an already-deleted spatial reference panel");
'''
test = replace_once(test, old_contract, new_contract, "product boundary legacy contract")
TEST.write_text(test, encoding="utf-8")


# 3) README: replace staged-cleanup wording with the completed shared-source boundary.
readme = README.read_text(encoding="utf-8")
old_readme = '''## 현재 남은 소스 정리

Electron 사용자 경로에서는 구형 Production Pack/배경시트/Reference Prompt/Readiness UI가 제거되어 있습니다. `reference-workflow-core.js`에서도 Prompt/Readiness 사용자 UI 구현은 물리적으로 삭제했습니다.

공용 `app.js/index.html`에는 브라우저 호환성을 위해 과거 export 버튼/함수 일부가 아직 남아 있습니다. 이 부분은 직접 `#id` 이벤트 바인딩이 얽혀 있으므로 대형 파일을 한 번에 잘라내지 않고, 이벤트 연결을 먼저 선택적/모듈형으로 분리한 다음 작은 커밋으로 HTML과 dead function을 제거하는 것이 안전합니다. 구체적인 삭제 순서는 [`MAINTENANCE.md`](MAINTENANCE.md)에 기록되어 있습니다.'''
new_readme = '''## 제품 경계 정리 상태

구형 Production Pack, 배경시트, 별도 멀티캠 export, Reference Prompt/Readiness 사용자 UI와 인앱 세트·배경 이미지 입력 경로는 공용 `index.html/app.js`에서 물리적으로 제거했습니다. Electron `preload.cjs`도 더 이상 이런 요소를 찾아 숨기거나 삭제하지 않습니다. 브라우저와 데스크톱은 같은 가시적 제품 경계를 공유합니다.

멀티카메라 **편집**은 계속 지원합니다. 제거한 것은 별도 멀티캠 프리뷰/영상 export 표면이며, 최종 출력은 현재/첫·끝 기준 프레임, 프리비즈 MP4, 필요 시 여러 컷 MP4 ZIP에 집중합니다. 내부 Reference Readiness 계산은 사용자 단계가 아니라 MP4 안전 정책과 BLOCKED 컷 guard로만 남습니다.'''
readme = replace_once(readme, old_readme, new_readme, "README cleanup status")
README.write_text(readme, encoding="utf-8")


# 4) Maintenance: remove the obsolete staged-deletion plan.
maint = MAINT.read_text(encoding="utf-8")
old_maint = '''현재 `app.js/index.html`에는 브라우저 호환성을 위해 과거 export 버튼/함수 일부가 아직 남아 있습니다. Electron에서는 preload가 해당 표면을 제거하며 제품 경계 테스트가 재노출을 막습니다. 이 코드를 물리적으로 삭제할 때는 먼저 직접 `#id` 이벤트 바인딩을 선택적/모듈형 연결로 분리한 뒤 HTML → 이벤트 연결 → 함수 순으로 작은 커밋에서 제거합니다. 대형 파일을 한 번에 잘라내지 않습니다.'''
new_maint = '''구형 Production Pack·배경시트·별도 멀티캠 export·인앱 세트/배경 이미지 입력·최종 Seedance Prompt helper는 공용 `app.js/index.html`에서 물리적으로 제거되어 있습니다. Electron preload는 이 표면을 숨기는 호환 shim을 가지지 않습니다. 제품 경계 테스트는 shared source 자체에 retired ID/function이 다시 생기면 실패해야 합니다. 멀티카메라 편집 모델과 카메라 프로필 전환은 지원 기능이므로 export 표면 제거와 혼동하지 않습니다.'''
maint = replace_once(maint, old_maint, new_maint, "MAINTENANCE stale staged cleanup")
MAINT.write_text(maint, encoding="utf-8")

print("final product-boundary cleanup applied")
