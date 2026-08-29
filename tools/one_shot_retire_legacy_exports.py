#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "app.js"
HTML = ROOT / "index.html"

RETIRED_IDS = (
    "blockingPlanBtn",
    "blockingPlanPanelBtn",
    "backgroundSheetBtn",
    "backgroundSheetPanelBtn",
    "productionPackBtn",
    "productionPackPanelBtn",
)
RETIRED_FUNCTIONS = (
    "exportBlockingPlanImage",
    "exportBackgroundSheetReference",
    "exportProductionPack",
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

    for item_id in RETIRED_IDS:
        if item_id not in app:
            raise RuntimeError(f"expected app binding/label is missing before cleanup: {item_id}")
        if f'id="{item_id}"' not in html:
            raise RuntimeError(f"expected HTML control is missing before cleanup: {item_id}")

    # Direct bindings and media-export labels are line-oriented in the current source.
    app = "".join(
        line for line in app.splitlines(keepends=True)
        if not any(item_id in line for item_id in RETIRED_IDS)
    )
    for function_name in RETIRED_FUNCTIONS:
        app = remove_async_function(app, function_name)

    # Retired controls are one-line button elements in the current HTML.
    html_lines = html.splitlines(keepends=True)
    html = "".join(
        line for line in html_lines
        if not any(f'id="{item_id}"' in line for item_id in RETIRED_IDS)
    )

    for item_id in RETIRED_IDS:
        if item_id in app or f'id="{item_id}"' in html:
            raise RuntimeError(f"retired control survived cleanup: {item_id}")
    for function_name in RETIRED_FUNCTIONS:
        if function_name in app:
            raise RuntimeError(f"retired function survived cleanup: {function_name}")

    APP.write_text(app, encoding="utf-8")
    HTML.write_text(html, encoding="utf-8")


if __name__ == "__main__":
    main()
