from pathlib import Path


def replace(path, old, new, count=1):
    p = Path(path)
    text = p.read_text(encoding="utf-8")
    if old not in text:
        raise SystemExit(f"expected test block not found: {path}: {old[:120]!r}")
    p.write_text(text.replace(old, new, count), encoding="utf-8")


replace(
    "tests/phone-motion-core.test.cjs",
    '  assert.match(phoneMotionUx, /op\\.arm\\(\\)/);\n',
    '  assert.match(phoneMotionUx, /op\\.arm\\(\\{ ensureStartKey:true \\}\\)/);\n'
    '  assert.match(phoneMotionUx, /op\\?\\.startPhysical/);\n'
    '  assert.match(phoneMotionUx, /op\\.adoptStartPose\\(pose, "phone"\\)/);\n',
)

replace(
    "tests/physical-camera-take-context.test.cjs",
    '''  assert.match(cameraOperatorUx, /if \\(time - lastSampleTime >= 1 \\/ 30 \\|\\| time >= maxTimelineTime\\(\\)\\) sampleCurrentPose\\(time\\)/,
    "Camera Operator must continuously sample the live Physical Camera pose");
  assert.match(cameraOperatorUx, /core\\.resampleSamples\\(smoothed, 1 \\/ 15\\)/,
    "recorded pose samples must be converted into an editable timeline path");
''',
    '''  assert.match(cameraOperatorUx, /sampleInterval = recordInput === "phone" \\? 1 \\/ 60 : 1 \\/ 30/,
    "Physical Camera must sample the live phone pose at display-class cadence");
  assert.match(cameraOperatorUx, /resampleStep = phoneTake \\? 1 \\/ 30 : 1 \\/ 15/,
    "Physical Camera samples must become a dense but editable 30 Hz timeline path");
''',
)

print("Physical Camera recording contracts refreshed")
