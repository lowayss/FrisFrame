#!/usr/bin/env python3
"""Run the FrisFrame pre-release checks with one command."""

from __future__ import annotations

import ast
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def run(label: str, command: list[str]) -> None:
    print(f"\n[검사] {label}")
    environment = os.environ.copy()
    environment.pop("FRISFRAME_REQUIRE_ORIGIN", None)
    environment["PYTHONDONTWRITEBYTECODE"] = "1"
    result = subprocess.run(command, cwd=ROOT, env=environment, check=False)
    if result.returncode:
        raise SystemExit(result.returncode)


def check_python_syntax() -> None:
    print("\n[검사] Python 문법")
    for path in (
        ROOT / "server.py",
        ROOT / "mcp_server.py",
        ROOT / "mcp_previs_server.py",
        ROOT / "mcp_desktop_entry.py",
        ROOT / "reference_space_core.py",
        ROOT / "reference_space_mcp.py",
        ROOT / "reference_space_consistency_mcp.py",
        ROOT / "reference_space_plan_mcp.py",
        ROOT / "reference_space_orientation_mcp.py",
        ROOT / "tests/seed-packaged-reference-project.py",
        ROOT / "add_license.py",
    ):
        ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        print(f"  확인: {path.name}")


def main() -> None:
    node = shutil.which("node")
    if not node:
        raise SystemExit("Node.js를 찾을 수 없습니다.")

    check_python_syntax()
    for filename in (
        "app.js",
        "storyboard-core.js",
        "motion-core.js",
        "scene-blocking-core.js",
        "previs-runtime-core.js",
        "reference-workflow-core.js",
        "timeline-core.js",
        "project-recovery-core.js",
        "manual-guide-core.js",
        "pose-core.js",
        "camera-drafting-core.js",
        "multi-camera-core.js",
        "spatial-scale-core.js",
        "electron/preload.cjs",
        "electron/phone-remote-preload.cjs",
        "electron/main.cjs",
        "electron/workspace-ux.js",
        "electron/hud-export-ux.js",
        "electron/interaction-ux.js",
        "electron/camera-operator-live-ux.js",
        "electron/camera-operator-inputs-ux.js",
        "electron/phone-remote.cjs",
        "electron/phone-remote-tls.cjs",
        "electron/phone-motion-server.cjs",
        "electron/phone-motion-core.js",
        "electron/phone-motion-camera-ux.js",
        "electron/selection-ux.js",
        "electron/alignment-ux.js",
        "electron/history-safety-ux.js",
        "electron/scene-cache-ux.js",
        "electron/dynamic-prop-cache-ux.js",
        "electron/stage-shell-cache-ux.js",
        "electron/camera-path-cache-ux.js",
        "electron/helper-raycast-ux.js",
        "electron/preview-cache-ux.js",
        "electron/performance-ux.js",
        "electron/scripts/smoke-package.cjs",
        "electron/scripts/verify-runtime-source-parity.cjs",
        "electron/scripts/verify-package.cjs",
        "electron/scripts/verify-orientation-revision.cjs",
        "electron/scripts/build-python-runtime.cjs",
    ):
        run(f"JavaScript 문법 · {filename}", [node, "--check", filename])

    for filename in (
        "tests/motion-core.test.cjs",
        "tests/retime-precision.test.cjs",
        "tests/reference-frame-ownership.test.cjs",
        "tests/reference-video-contract.test.cjs",
        "tests/camera-motion-presets.test.cjs",
        "tests/reference-batch-export.test.cjs",
        "tests/reference-batch-policy.test.cjs",
        "tests/reference-readiness.test.cjs",
        "tests/reference-ghost-ui-contract.test.cjs",
        "tests/reference-validation-ui.test.cjs",
        "tests/scene-blocking-core.test.cjs",
        "tests/previs-runtime-core.test.cjs",
        "tests/timeline-core.test.cjs",
        "tests/project-recovery-core.test.cjs",
        "tests/manual-guide-core.test.cjs",
        "tests/pose-core.test.cjs",
        "tests/camera-drafting.test.cjs",
        "tests/multi-camera-core.test.cjs",
        "tests/spatial-scale-core.test.cjs",
        "tests/selection-ux.test.cjs",
        "tests/alignment-ux.test.cjs",
        "tests/camera-operator-core.test.cjs",
        "tests/camera-operator-ux-contract.test.cjs",
        "tests/camera-operator-live-contract.test.cjs",
        "tests/camera-operator-inputs-contract.test.cjs",
        "tests/phone-motion-core.test.cjs",
        "tests/phone-motion-server.test.cjs",
        "tests/history-safety-contract.test.cjs",
        "tests/scene-cache-ux-contract.test.cjs",
        "tests/dynamic-prop-cache-ux-contract.test.cjs",
        "tests/stage-shell-cache-ux-contract.test.cjs",
        "tests/camera-path-cache-ux-contract.test.cjs",
        "tests/helper-raycast-ux-contract.test.cjs",
        "tests/preview-cache-ux-contract.test.cjs",
        "tests/performance-ux-contract.test.cjs",
        "tests/large-scene-performance.test.cjs",
        "tests/spawn-layout-contract.test.cjs",
        "tests/desktop-ux-manifest.test.cjs",
        "tests/workflow-shell-ux-contract.test.cjs",
        "tests/mcp-desktop-runtime-contract.test.cjs",
        "tests/mcp-first-product-boundary.test.cjs",
        "tests/mcp-live-sync-contract.test.cjs",
        "tests/retired-spatial-runtime-contract.test.cjs",
        "tests/dom-contract.test.cjs",
        "tests/electron-contract.test.cjs",
    ):
        run(f"단위 검사 · {filename}", [node, filename])

    run("스토리보드 코어", [node, "--test", "tests/storyboard-core.test.cjs"])
    run("프로젝트·보안·MP4 서버", [sys.executable, "-m", "unittest", "tests.test_server_security"])
    run("Reference Space Python projection", [sys.executable, "tests/reference-space-projection.py"])
    run("Reference Space MCP", [sys.executable, "tests/reference-space-mcp.py"])
    run("Reference Space 원자 계획", [sys.executable, "tests/reference-space-plan-mcp.py"])
    run("Reference Space 화면 방향", [sys.executable, "tests/reference-space-orientation-mcp.py"])
    run("MCP 서버", [sys.executable, "tests/mcp-server-smoke.py"])
    run("MCP 프리비즈 매크로", [sys.executable, "tests/mcp-previs-macros.py"])
    run("MCP 프리비즈 E2E", [sys.executable, "tests/mcp-previs-e2e.py"])

    ffmpeg = shutil.which("ffmpeg")
    if ffmpeg:
        print(f"\n[확인] MP4 인코더: {ffmpeg}")
    else:
        print("\n[주의] FFmpeg가 없어 MP4 프리뷰를 만들 수 없습니다.")
    print("\nFrisFrame 전체 검사가 통과했습니다.")


if __name__ == "__main__":
    main()
