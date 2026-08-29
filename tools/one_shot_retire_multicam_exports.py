#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "app.js"
HTML = ROOT / "index.html"
DOM_TEST = ROOT / "tests" / "dom-contract.test.cjs"

RETIRED_IDS = (
    "multiCamPreviewBtn",
    "multiCamPreviewPanelBtn",
    "multiCamPreviewPanelBtnSecondary",
    "multiCamVideoBtn",
    "multiCamVideoPanelBtn",
)
RETIRED_FUNCTIONS = (
    "exportMultiCameraPreview",
    "renderMultiCameraContactSheet",
    "exportMultiCameraVideo",
)


def remove_async_function(source: str, name: str) -> str:
    marker = f"async function {name}("
    start = source.find(marker)
    if start < 0:
        raise RuntimeError(f"expected function is missing before cleanup: {name}")
    brace = source.find("{", start)
    if brace < 0:
        raise RuntimeError(f"function body is missing: {name}")
    depth = 0
    state = "code"
    quote = ""
    escaped = False
    index = brace
    while index < len(source):
        char = source[index]
        nxt = source[index + 1] if index + 1 < len(source) else ""
        if state == "code":
            if char in ('"', "'", "`"):
                state = "string"
                quote = char
                escaped = False
            elif char == "/" and nxt == "/":
                state = "line-comment"
                index += 1
            elif char == "/" and nxt == "*":
                state = "block-comment"
                index += 1
            elif char == "{":
                depth += 1
            elif char == "}":
                depth -= 1
                if depth == 0:
                    end = index + 1
                    while end < len(source) and source[end] in " \t":
                        end += 1
                    if end < len(source) and source[end] == "\r":
                        end += 1
                    if end < len(source) and source[end] == "\n":
                        end += 1
                    if end < len(source) and source[end] == "\r":
                        end += 1
                    if end < len(source) and source[end] == "\n":
                        end += 1
                    return source[:start] + source[end:]
        elif state == "string":
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == quote:
                state = "code"
        elif state == "line-comment":
            if char == "\n":
                state = "code"
        elif state == "block-comment":
            if char == "*" and nxt == "/":
                state = "code"
                index += 1
        index += 1
    raise RuntimeError(f"unclosed function body: {name}")


def main() -> None:
    app = APP.read_text(encoding="utf-8")
    html = HTML.read_text(encoding="utf-8")
    dom = DOM_TEST.read_text(encoding="utf-8")

    readiness_block = '''  const multiVideoReady = profiles.length > 1;\n  [$("#multiCamVideoBtn"), $("#multiCamVideoPanelBtn")].forEach((button) => {\n    if (!button) return;\n    button.disabled = !multiVideoReady || mediaExportBusy;\n    button.title = multiVideoReady ? "카메라별 화면을 분할한 H.264 프리뷰 영상" : "카메라를 2대 이상 추가하면 사용할 수 있습니다";\n  });\n'''
    if readiness_block not in app:
        raise RuntimeError("expected multicam export readiness block was not found")
    app = app.replace(readiness_block, "", 1)

    # Direct click bindings and the media-export label table are single-line entries.
    app = "".join(
        line for line in app.splitlines(keepends=True)
        if not any(item_id in line for item_id in RETIRED_IDS)
    )
    old_video_lock = '    const isVideoButton = ["#videoBtn", "#videoPanelBtn", "#selectedCutVideoBtn"].includes(selector);\n'
    # The line filter above removes the old selector list because it contained retired IDs.
    marker = '    const text = mediaExportBusy && isVideoButton && selector === mediaExportOwner\n'
    if marker not in app:
        raise RuntimeError("media export busy marker was not found")
    app = app.replace(marker, old_video_lock + marker, 1)

    for function_name in RETIRED_FUNCTIONS:
        app = remove_async_function(app, function_name)

    html = "".join(
        line for line in html.splitlines(keepends=True)
        if not any(f'id="{item_id}"' in line for item_id in RETIRED_IDS)
    )

    old_contract = '''assert.ok(app.includes("function exportMultiCameraPreview("), "multi-camera preview needs a preview-first export action");\nassert.ok(app.includes("function exportMultiCameraVideo("), "multi-camera needs a preview-first MP4 export action");\nassert.ok(ids.has("multiCamVideoBtn") && ids.has("multiCamVideoPanelBtn"), "multi-camera video needs toolbar and panel actions");\n'''
    new_contract = '''for (const retiredId of [\n  "multiCamPreviewBtn",\n  "multiCamPreviewPanelBtn",\n  "multiCamPreviewPanelBtnSecondary",\n  "multiCamVideoBtn",\n  "multiCamVideoPanelBtn",\n]) {\n  assert.equal(ids.has(retiredId), false, `${retiredId} must stay physically removed from shared HTML`);\n}\nassert.equal(app.includes("function exportMultiCameraPreview("), false,\n  "retired multi-camera contact-sheet export must stay removed");\nassert.equal(app.includes("function renderMultiCameraContactSheet("), false,\n  "retired multi-camera contact-sheet renderer must stay removed");\nassert.equal(app.includes("function exportMultiCameraVideo("), false,\n  "retired multi-camera video export must stay removed");\n'''
    if old_contract not in dom:
        raise RuntimeError("expected multicam DOM contract block was not found")
    dom = dom.replace(old_contract, new_contract, 1)

    for item_id in RETIRED_IDS:
        if item_id in app or f'id="{item_id}"' in html:
            raise RuntimeError(f"retired multicam export control survived: {item_id}")
    for function_name in RETIRED_FUNCTIONS:
        if function_name in app:
            raise RuntimeError(f"retired multicam export function survived: {function_name}")

    # Editing/runtime multicamera controls must remain.
    for required in ("cameraRigList", "cameraFrameModeBtn", "addCameraBtn"):
        if f'id="{required}"' not in html:
            raise RuntimeError(f"multicamera editing control was accidentally removed: {required}")

    APP.write_text(app, encoding="utf-8")
    HTML.write_text(html, encoding="utf-8")
    DOM_TEST.write_text(dom, encoding="utf-8")


if __name__ == "__main__":
    main()
