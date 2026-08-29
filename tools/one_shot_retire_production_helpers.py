#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "app.js"
HTML = ROOT / "index.html"
CSS = ROOT / "styles.css"
DOM_TEST = ROOT / "tests" / "dom-contract.test.cjs"

RETIRED_FUNCTIONS = (
    "buildProductionPack",
    "computePrevisQuality",
    "buildPrevisManifest",
    "buildProductionPackPreview",
    "buildProjectCutListCsv",
    "buildContinuityReportMarkdown",
    "buildCameraPlan",
    "buildMultiCameraPlan",
    "buildShotBibleMarkdown",
    "buildLiveActionBrief",
    "buildAiGenerationBrief",
    "buildOnSetChecklist",
    "buildCameraStoryboardMarkdown",
    "buildFramingAnalysisMarkdown",
    "framingSummaryMarkdown",
    "selectedLayerMarkdown",
    "selectedPresetMarkdown",
    "cameraMarkdown",
    "buildBeatTableMarkdown",
    "buildMotionCsv",
    "buildBlenderPrevisScript",
    "blenderInterpolation",
    "captureCameraFrameBlob",
    "captureStoryboardFrames",
    "withCameraFrameCapture",
    "storyboardTimes",
    "storyboardFrameSummary",
    "renderStoryboardContactSheet",
    "wrapCanvasText",
    "renderTopdownPngBlob",
    "renderBackgroundStageOverviewBlob",
    "renderBackgroundPlanBlob",
    "buildBackgroundSheetManifest",
    "backgroundSheetViewState",
    "buildBackgroundSheetReadme",
    "buildSeedancePrompt",
    "analyzeFraming",
    "framingSampleTimes",
    "framingSubjectsForMode",
    "framingSubjectStatus",
    "angleDeltaRad",
    "framingStatusLabel",
    "buildSeedanceGuideSegments",
    "importSpatialReferenceImage",
    "clearSpatialReference",
    "renderSpatialGuideControls",
)

SPATIAL_IDS = (
    "spatialReferenceStatus",
    "spatialReferenceImageInput",
    "spatialReferencePreview",
    "clearSpatialReferenceBtn",
)

CSS_SELECTORS = (
    ".spatial-reference-panel",
    ".spatial-reference-panel > summary",
    ".spatial-reference-panel[open] > summary",
    ".spatial-reference-panel > summary::after",
    ".spatial-reference-heading",
    ".spatial-reference-heading small",
    ".spatial-reference-file-btn",
    ".spatial-reference-file-btn:hover",
    ".spatial-reference-file-btn svg",
    ".spatial-reference-preview",
    ".spatial-reference-actions",
    ".spatial-reference-actions .text-btn",
    ".spatial-reference-help",
)


def remove_function(source: str, name: str) -> str:
    marker = f"function {name}("
    function_at = source.find(marker)
    if function_at < 0:
        raise RuntimeError(f"expected function is missing before cleanup: {name}")
    start = function_at
    async_prefix = "async "
    if source[max(0, start - len(async_prefix)):start] == async_prefix:
        start -= len(async_prefix)
    brace = source.find("{", function_at)
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
                    while end < len(source) and source[end] in "\r\n":
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


def remove_css_rule(source: str, selector: str) -> str:
    marker = selector + " {"
    start = source.find(marker)
    if start < 0:
        raise RuntimeError(f"expected CSS selector is missing before cleanup: {selector}")
    brace = source.find("{", start)
    depth = 0
    index = brace
    while index < len(source):
        if source[index] == "{":
            depth += 1
        elif source[index] == "}":
            depth -= 1
            if depth == 0:
                end = index + 1
                while end < len(source) and source[end] in "\r\n":
                    end += 1
                return source[:start] + source[end:]
        index += 1
    raise RuntimeError(f"unclosed CSS rule: {selector}")


def remove_spatial_html(html: str) -> str:
    marker = '<details class="spatial-reference-panel compact-details"'
    start = html.find(marker)
    if start < 0:
        raise RuntimeError("spatial reference panel is missing before cleanup")
    end = html.find("</details>", start)
    if end < 0:
        raise RuntimeError("spatial reference panel closing tag is missing")
    end += len("</details>")
    while end < len(html) and html[end] in "\r\n":
        end += 1
    return html[:start] + html[end:]


def main() -> None:
    app = APP.read_text(encoding="utf-8")
    html = HTML.read_text(encoding="utf-8")
    css = CSS.read_text(encoding="utf-8")
    dom = DOM_TEST.read_text(encoding="utf-8")

    spatial_binding = '''$("#spatialReferenceImageInput").addEventListener("change", (event) => {\n  importSpatialReferenceImage(event.currentTarget.files?.[0]);\n});\n$("#clearSpatialReferenceBtn").addEventListener("click", clearSpatialReference);\n'''
    if spatial_binding not in app:
        raise RuntimeError("expected spatial image UI binding block was not found")
    app = app.replace(spatial_binding, "", 1)
    if "  renderSpatialGuideControls();\n" not in app:
        raise RuntimeError("expected spatial image UI sync call was not found")
    app = app.replace("  renderSpatialGuideControls();\n", "", 1)

    for function_name in RETIRED_FUNCTIONS:
        app = remove_function(app, function_name)

    # Any surviving mention means a caller outside the retired chain still exists.
    for function_name in RETIRED_FUNCTIONS:
        if function_name in app:
            raise RuntimeError(f"retired helper still has an external reference: {function_name}")

    html = remove_spatial_html(html)
    for spatial_id in SPATIAL_IDS:
        if spatial_id in html or spatial_id in app:
            raise RuntimeError(f"retired spatial image UI survived cleanup: {spatial_id}")

    # Remove only the source-image panel styling; deterministic spatial-guide rendering stays intact.
    for selector in sorted(CSS_SELECTORS, key=len, reverse=True):
        css = remove_css_rule(css, selector)
    if ".spatial-reference-" in css:
        raise RuntimeError("retired spatial reference CSS survived cleanup")

    replacements = {
        'assert.ok(app.includes("function cameraPerspectiveForSubject(") && app.includes("Perspective scale check:"), "AI handoff must preserve metric perspective checks");\n':
            'assert.ok(app.includes("function cameraPerspectiveForSubject("), "metric perspective checks must remain available to the editor");\n',
        'assert.ok(app.includes(\'"vertical_offset", "pitch_deg"\'), "CSV export must preserve actor elevation and pitch");\n': "",
        'assert.ok(app.includes("function blenderCameraTarget("), "Blender export must use camera pan and tilt directly");\n': "",
        'assert.ok(app.includes("obj.rotation_euler[0] = math.radians"), "Blender export must preserve actor pitch");\n': "",
        'assert.ok(app.includes(\'"camera_id"\'), "motion CSV must identify the camera that owns each camera key");\n': "",
    }
    for old, new in replacements.items():
        if old not in dom:
            raise RuntimeError(f"expected legacy DOM assertion was not found: {old.strip()}")
        dom = dom.replace(old, new, 1)

    guard_marker = 'assert.equal(app.includes("function downloadUrl("), false, "exports must not bypass the preview dialog");\n'
    if guard_marker not in dom:
        raise RuntimeError("DOM contract insertion marker was not found")
    guard = '''for (const retiredFunction of [\n  "buildProductionPack",\n  "buildProductionPackPreview",\n  "buildAiGenerationBrief",\n  "buildSeedancePrompt",\n  "buildMotionCsv",\n  "buildBlenderPrevisScript",\n  "buildBackgroundSheetManifest",\n  "buildBackgroundSheetReadme",\n  "renderBackgroundStageOverviewBlob",\n  "renderBackgroundPlanBlob",\n]) {\n  assert.equal(app.includes(`function ${retiredFunction}(`), false,\n    `${retiredFunction} must stay physically removed from shared app source`);\n}\nfor (const retiredSpatialId of [\n  "spatialReferenceStatus",\n  "spatialReferenceImageInput",\n  "spatialReferencePreview",\n  "clearSpatialReferenceBtn",\n]) {\n  assert.equal(ids.has(retiredSpatialId), false,\n    `${retiredSpatialId} must stay physically removed from shared HTML`);\n}\nassert.equal(html.includes("spatial-reference-panel"), false,\n  "in-app background-image reference panel must stay removed");\n'''
    dom = dom.replace(guard_marker, guard + guard_marker, 1)

    APP.write_text(app, encoding="utf-8")
    HTML.write_text(html, encoding="utf-8")
    CSS.write_text(css, encoding="utf-8")
    DOM_TEST.write_text(dom, encoding="utf-8")


if __name__ == "__main__":
    main()
