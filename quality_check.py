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
    for path in (ROOT / "server.py", ROOT / "mcp_server.py", ROOT / "add_license.py"):
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
        "timeline-core.js",
        "project-recovery-core.js",
        "manual-guide-core.js",
        "pose-core.js",
        "camera-drafting-core.js",
        "multi-camera-core.js",
    ):
        run(f"JavaScript 문법 · {filename}", [node, "--check", filename])

    for filename in (
        "tests/motion-core.test.cjs",
        "tests/timeline-core.test.cjs",
        "tests/project-recovery-core.test.cjs",
        "tests/manual-guide-core.test.cjs",
        "tests/pose-core.test.cjs",
        "tests/camera-drafting.test.cjs",
        "tests/multi-camera-core.test.cjs",
        "tests/dom-contract.test.cjs",
        "tests/electron-contract.test.cjs",
    ):
        run(f"단위 검사 · {filename}", [node, filename])

    run("스토리보드 코어", [node, "--test", "tests/storyboard-core.test.cjs"])
    run("프로젝트·보안·MP4 서버", [sys.executable, "-m", "unittest", "tests.test_server_security"])
    run("MCP 서버", [sys.executable, "tests/mcp-server-smoke.py"])

    ffmpeg = shutil.which("ffmpeg")
    if ffmpeg:
        print(f"\n[확인] MP4 인코더: {ffmpeg}")
    else:
        print("\n[주의] FFmpeg가 없어 MP4 프리뷰를 만들 수 없습니다.")
    print("\nFrisFrame 전체 검사가 통과했습니다.")


if __name__ == "__main__":
    main()
