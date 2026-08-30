#!/usr/bin/env python3
from pathlib import Path

root = Path(__file__).resolve().parents[1]
index_path = root / "index.html"
styles_path = root / "styles.css"
workflow_path = root / ".github" / "workflows" / "desktop-builds.yml"

index = index_path.read_text(encoding="utf-8")
old_copy = "2D 동선도, 3D 카메라 프레임, 배경시트 레퍼런스를 준비합니다."
new_copy = "현재 프레임, 시작·끝 프레임, 프리비즈 영상을 준비합니다."
if old_copy in index:
    index = index.replace(old_copy, new_copy, 1)
elif new_copy not in index:
    raise SystemExit("export panel copy anchor changed")
index_path.write_text(index, encoding="utf-8")

styles = styles_path.read_text(encoding="utf-8")
marker = "/* Priority product-boundary hotfix: retired surfaces stay hidden on main desktop builds. */"
block = f'''\n\n{marker}\n#blockingPlanBtn,\n#backgroundSheetBtn,\n#productionPackBtn,\n#multiCamPreviewBtn,\n#multiCamVideoBtn,\n#blockingPlanPanelBtn,\n#backgroundSheetPanelBtn,\n#productionPackPanelBtn,\n#multiCamPreviewPanelBtn,\n#multiCamPreviewPanelBtnSecondary,\n#multiCamVideoPanelBtn,\n.spatial-reference-panel {{\n  display: none !important;\n}}\n'''
if marker not in styles:
    styles = styles.rstrip() + block
styles_path.write_text(styles, encoding="utf-8")

workflow = workflow_path.read_text(encoding="utf-8")
anchor = '      - "package-lock.json"\n      - "electron/**"'
replacement = '      - "package-lock.json"\n      - "app.js"\n      - "index.html"\n      - "styles.css"\n      - "electron/**"'
count = workflow.count(anchor)
if count:
    workflow = workflow.replace(anchor, replacement)
elif all(f'      - "{name}"' in workflow for name in ("app.js", "index.html", "styles.css")):
    pass
else:
    raise SystemExit("desktop-builds path filter anchor changed")
workflow_path.write_text(workflow, encoding="utf-8")

print("priority UI hotfix prepared")
