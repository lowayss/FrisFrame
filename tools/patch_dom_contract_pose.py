#!/usr/bin/env python3
from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected exactly one match, found {count}")
    file.write_text(text.replace(old, new, 1), encoding="utf-8")


replace_once(
    "tests/dom-contract.test.cjs",
    'assert.match(app, /bodyPose: keyedBodyPose/, "actor playback must use only authored pose keys");\n',
    'assert.match(motion, /bodyPose: keyedBodyPose/, "motion-core actor playback must use only authored pose keys");\n',
)
replace_once(
    "tests/dom-contract.test.cjs",
    'assert.match(app, /facing: lerpAngle\\(from\\.facing, to\\.facing, t\\)/, "actor rotation must interpolate only keyed facing values");\n',
    'assert.match(motion, /facing: lerpAngleDegrees\\(from\\.facing, to\\.facing\\)/, "motion-core actor rotation must interpolate only keyed facing values");\n',
)

print("DOM pose ownership contract migrated to motion-core")
