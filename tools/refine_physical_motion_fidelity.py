from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"stale patch target: {label}")
    return text.replace(old, new, 1)


# 1) Preserve natural timing anchors during Physical Camera key reduction.
p = Path("electron/interaction-ux.js")
s = p.read_text(encoding="utf-8")
marker = '''  function simplifyCameraOperatorSamples(samples, options = {}) {\n'''
insert = '''  function cameraOperatorMotionVector(from, to, thresholds) {\n    return [\n      (Number(to.x || 0) - Number(from.x || 0)) / thresholds.position,\n      (Number(to.y || 0) - Number(from.y || 0)) / thresholds.position,\n      (Number(to.height || 0) - Number(from.height || 0)) / thresholds.height,\n      shortestOperatorAngleDelta(from.panDeg || 0, to.panDeg || 0) / thresholds.angle,\n      (Number(to.tiltDeg || 0) - Number(from.tiltDeg || 0)) / thresholds.angle,\n      (Number(to.focal || 0) - Number(from.focal || 0)) / thresholds.focal,\n    ];\n  }\n\n  function cameraOperatorNaturalMotionAnchors(samples, thresholds) {\n    const anchors = new Set([0, samples.length - 1]);\n    if (!Array.isArray(samples) || samples.length < 3) return anchors;\n\n    const segments = [];\n    for (let index = 0; index < samples.length - 1; index += 1) {\n      const vector = cameraOperatorMotionVector(samples[index], samples[index + 1], thresholds);\n      const magnitude = Math.hypot(...vector);\n      const duration = Math.max(1 / 240, Number(samples[index + 1].time) - Number(samples[index].time));\n      segments.push({ vector, magnitude, rate: magnitude / duration });\n    }\n\n    // Preserve the places where a real handheld move starts, settles, sharply\n    // redirects, or changes speed. Geometry-only reduction can otherwise turn\n    // a human move into a constant-speed robotic glide.\n    const quietMotion = 0.35;\n    const activeMotion = 1.0;\n    for (let index = 1; index < samples.length - 1; index += 1) {\n      const left = segments[index - 1];\n      const right = segments[index];\n      const leavesHold = left.magnitude <= quietMotion && right.magnitude >= activeMotion;\n      const entersHold = left.magnitude >= activeMotion && right.magnitude <= quietMotion;\n      if (leavesHold || entersHold) {\n        anchors.add(index);\n        continue;\n      }\n      if (left.magnitude < activeMotion || right.magnitude < activeMotion) continue;\n\n      const dot = left.vector.reduce((sum, value, component) => sum + value * right.vector[component], 0);\n      const direction = dot / Math.max(0.000001, left.magnitude * right.magnitude);\n      if (direction <= 0.25) {\n        anchors.add(index);\n        continue;\n      }\n\n      const slowRate = Math.max(0.000001, Math.min(left.rate, right.rate));\n      const speedRatio = Math.max(left.rate, right.rate) / slowRate;\n      if (speedRatio >= 2.75) anchors.add(index);\n    }\n    return anchors;\n  }\n\n'''
s = replace_once(s, marker, insert + marker, "interaction natural anchors insert")
s = replace_once(
    s,
    '''    const keep = new Set([0, samples.length - 1]);\n''',
    '''    const keep = options.preserveNaturalMotion === true\n      ? cameraOperatorNaturalMotionAnchors(samples, thresholds)\n      : new Set([0, samples.length - 1]);\n''',
    "interaction preserveNaturalMotion option",
)
s = replace_once(
    s,
    '''    reduce(0, samples.length - 1);\n    return [...keep].sort((left, right) => left - right).map((index) => ({ ...samples[index] }));\n''',
    '''    const naturalAnchors = [...keep].sort((left, right) => left - right);\n    for (let index = 0; index < naturalAnchors.length - 1; index += 1) {\n      reduce(naturalAnchors[index], naturalAnchors[index + 1]);\n    }\n    return [...keep].sort((left, right) => left - right).map((index) => ({ ...samples[index] }));\n''',
    "interaction reduce natural segments",
)
p.write_text(s, encoding="utf-8")


# 2) Record Physical Camera packets at arrival time instead of relying only on RAF snapshots.
p = Path("electron/camera-operator-live-ux.js")
s = p.read_text(encoding="utf-8")
s = replace_once(
    s,
    '''  const sampleCurrentPose = (time) => {\n    samples.push({ time: Number(time), ...currentCameraPose() });\n    lastSampleTime = Number(time);\n  };\n''',
    '''  const samplePose = (time, pose = currentCameraPose()) => {\n    const numericTime = Number(time);\n    const fallback = currentCameraPose();\n    samples.push({\n      time: numericTime,\n      x: Number.isFinite(Number(pose?.x)) ? Number(pose.x) : fallback.x,\n      y: Number.isFinite(Number(pose?.y)) ? Number(pose.y) : fallback.y,\n      height: Number.isFinite(Number(pose?.height)) ? Number(pose.height) : fallback.height,\n      panDeg: normalizeAngle(Number.isFinite(Number(pose?.panDeg)) ? Number(pose.panDeg) : fallback.panDeg),\n      tiltDeg: Number.isFinite(Number(pose?.tiltDeg)) ? Number(pose.tiltDeg) : fallback.tiltDeg,\n      focal: Number.isFinite(Number(pose?.focal)) ? Number(pose.focal) : fallback.focal,\n    });\n    lastSampleTime = numericTime;\n  };\n\n  const sampleCurrentPose = (time) => samplePose(time, currentCameraPose());\n''',
    "operator samplePose",
)
s = replace_once(
    s,
    '''  const tickRecording = () => {\n    if (mode !== "recording") return;\n    const time = operatorTime();\n    if (typeof ensureDurationCovers === "function") ensureDurationCovers(time);\n    state.motion.playhead = time;\n    if (state.camera.trackingTargetId) maintainCameraTracking(state, time);\n    const sampleInterval = recordInput === "phone" ? 1 / 60 : 1 / 30;\n    if (time - lastSampleTime >= sampleInterval || time >= maxTimelineTime()) sampleCurrentPose(time);\n''',
    '''  const recordPhysicalPose = (pose) => {\n    if (mode !== "recording" || recordInput !== "phone" || !pose) return false;\n    const time = operatorTime();\n    if (typeof ensureDurationCovers === "function") ensureDurationCovers(time);\n    state.motion.playhead = time;\n    applyCameraPose(pose, state);\n    // Phone packets already arrive on a latest-only transport. Capture their actual\n    // arrival timing (up to ~60 Hz) instead of quantizing every move to RAF timing.\n    if (time - lastSampleTime >= 1 / 90) samplePose(time, currentCameraPose());\n    dirty = true;\n    return true;\n  };\n\n  const tickRecording = () => {\n    if (mode !== "recording") return;\n    const time = operatorTime();\n    if (typeof ensureDurationCovers === "function") ensureDurationCovers(time);\n    state.motion.playhead = time;\n    if (state.camera.trackingTargetId) maintainCameraTracking(state, time);\n    if (recordInput === "phone") {\n      // If transport pauses briefly, keep a hold sample so the reconstructed path\n      // does not drift through a genuine stationary beat.\n      if (time - lastSampleTime >= 0.10 || time >= maxTimelineTime()) sampleCurrentPose(time);\n    } else if (time - lastSampleTime >= 1 / 30 || time >= maxTimelineTime()) {\n      sampleCurrentPose(time);\n    }\n''',
    "operator physical packet capture",
)
s = replace_once(
    s,
    '''          maxGap: 0.22 + cleanupStrength * 0.10,\n        }\n''',
    '''          maxGap: 0.22 + cleanupStrength * 0.10,\n          preserveNaturalMotion: true,\n        }\n''',
    "operator preserve timing option",
)
s = replace_once(
    s,
    '''    startPhysical: startPhysicalRecording,\n    adoptStartPose,\n''',
    '''    startPhysical: startPhysicalRecording,\n    recordPhysicalPose,\n    adoptStartPose,\n''',
    "operator expose packet recorder",
)
p.write_text(s, encoding="utf-8")


# 3) Feed every stabilized Physical Camera packet into the dedicated recorder.
p = Path("electron/phone-motion-camera-ux.js")
s = p.read_text(encoding="utf-8")
s = replace_once(
    s,
    '''    livePreviewPose = null;\n    applyPoseToState(pose, state);\n    if (op.mode === "recording") recordTakeDiagnostic(diagnostic);\n    renderExternalFrame();\n''',
    '''    livePreviewPose = null;\n    applyPoseToState(pose, state);\n    if (op.mode === "recording") {\n      op.recordPhysicalPose?.(pose);\n      recordTakeDiagnostic(diagnostic);\n    }\n    renderExternalFrame();\n''',
    "phone feed packet recorder",
)
p.write_text(s, encoding="utf-8")


# 4) Numeric regression tests for natural hold/reversal anchors.
p = Path("tests/camera-operator-core.test.cjs")
s = p.read_text(encoding="utf-8")
marker = '''console.log("camera-operator-core: jitter cleanup, angle wrap, and time-aware key reduction passed");\n'''
addition = '''// Physical Camera reduction must preserve both edges of a real hold so playback\n// can settle, stay still, and then leave the hold without spline drift.\n{\n  const input = [\n    sample(0.0, { x: 0.20 }),\n    sample(0.1, { x: 0.20 }),\n    sample(0.2, { x: 0.20 }),\n    sample(0.3, { x: 0.23 }),\n    sample(0.4, { x: 0.26 }),\n    sample(0.5, { x: 0.26 }),\n    sample(0.6, { x: 0.26 }),\n  ];\n  const output = core.simplifySamples(input, {\n    positionTolerance: 0.001,\n    heightTolerance: 0.01,\n    angleTolerance: 0.1,\n    focalTolerance: 0.2,\n    maxGap: 99,\n    preserveNaturalMotion: true,\n  });\n  const times = output.map((entry) => Number(entry.time.toFixed(1)));\n  assert.ok(times.includes(0.2), "the release edge of an opening hold must survive");\n  assert.ok(times.includes(0.5), "the settle edge of a closing hold must survive");\n}\n\n// A deliberate handheld reversal is an authored beat, not jitter.\n{\n  const input = [\n    sample(0.0, { x: 0.20 }),\n    sample(0.1, { x: 0.23 }),\n    sample(0.2, { x: 0.26 }),\n    sample(0.3, { x: 0.23 }),\n    sample(0.4, { x: 0.20 }),\n  ];\n  const output = core.simplifySamples(input, {\n    positionTolerance: 0.001,\n    heightTolerance: 0.01,\n    angleTolerance: 0.1,\n    focalTolerance: 0.2,\n    maxGap: 99,\n    preserveNaturalMotion: true,\n  });\n  assert.ok(output.some((entry) => Math.abs(entry.time - 0.2) < 0.000001),\n    "the direction-change apex must survive Physical Camera key reduction");\n}\n\n'''
s = replace_once(s, marker, addition + marker, "core natural motion tests")
p.write_text(s, encoding="utf-8")


# 5) Contract coverage for packet-timed capture and natural-motion retention.
p = Path("tests/camera-operator-live-contract.test.cjs")
s = p.read_text(encoding="utf-8")
s = replace_once(
    s,
    '''assert.match(controller, /sampleInterval = recordInput === "phone" \\? 1 \\/ 60 : 1 \\/ 30/, "Physical Camera must sample live motion at display-class cadence before reduction");\n''',
    '''assert.match(controller, /const recordPhysicalPose = \\(pose\\) =>/, "Physical Camera must record stabilized packets on their real arrival timing");\nassert.match(controller, /time - lastSampleTime >= 1 \\/ 90/, "Physical Camera packet capture must retain display-class motion without duplicate bursts");\nassert.match(controller, /time - lastSampleTime >= 0\\.10/, "Physical Camera must write hold samples when packet flow briefly pauses");\n''',
    "live contract packet timing",
)
s = replace_once(
    s,
    '''assert.match(controller, /maxGap: 0\\.22 \\+ cleanupStrength \\* 0\\.10/, "Physical Camera must not leave long gaps between editable keys");\n''',
    '''assert.match(controller, /maxGap: 0\\.22 \\+ cleanupStrength \\* 0\\.10/, "Physical Camera must not leave long gaps between editable keys");\nassert.match(controller, /preserveNaturalMotion: true/, "Physical Camera must preserve human timing anchors while reducing keys");\nassert.match(controller, /recordPhysicalPose,/, "Physical Camera runtime must expose its packet-timed recorder");\n''',
    "live contract natural motion",
)
p.write_text(s, encoding="utf-8")


# 6) Physical Camera integration contract: stabilized motion packets must enter recorder.
p = Path("tests/physical-camera-take-context.test.cjs")
s = p.read_text(encoding="utf-8")
needle = '''  assert.match(cameraOperatorUx, /captureSourceKeyframe\\("camera", sample\\.time, undefined, "straight"\\)/,\n    "the finished Physical Camera take must materialize as camera keyframes");\n'''
replacement = '''  assert.match(cameraOperatorUx, /captureSourceKeyframe\\("camera", sample\\.time, undefined, "straight"\\)/,\n    "the finished Physical Camera take must materialize as camera keyframes");\n  assert.match(cameraOperatorUx, /recordPhysicalPose/,\n    "Camera Operator must expose packet-timed Physical Camera capture");\n  assert.match(ux, /op\\.recordPhysicalPose\\?\\.\\(pose\\)/,\n    "stabilized Physical Camera packets must feed the packet-timed recorder");\n'''
s = replace_once(s, needle, replacement, "take context packet recorder contract")
p.write_text(s, encoding="utf-8")

print("Physical Camera motion fidelity reinforcement applied")
