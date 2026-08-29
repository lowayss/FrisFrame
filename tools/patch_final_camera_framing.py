from pathlib import Path
import re

motion_path = Path("motion-core.js")
text = motion_path.read_text(encoding="utf-8")

helper = r'''
  function referenceFinalCameraExposure(blocking = {}, exportRange = {}, fps = 24, minimumFrames = 2) {
    const motion = blocking?.motion || {};
    const duration = Math.max(0, finiteNumber(motion.duration, 0));
    const rangeStart = clamp(finiteNumber(exportRange.start, 0), 0, duration);
    const rangeEnd = clamp(finiteNumber(exportRange.end, duration), 0, duration);
    const minimum = Math.max(1, Math.round(finiteNumber(minimumFrames, 2)));
    const empty = {
      changed: false,
      exposureFrames: 0,
      minimumFrames: minimum,
      finalKeyTime: null,
      lastSampleTime: rangeStart,
    };
    if (!(rangeEnd > rangeStart)) return empty;

    const schedule = referenceExportFrameSchedule({ start: rangeStart, end: rangeEnd, fps, minFrameCount: 2 });
    const lastSampleTime = schedule.times.length ? schedule.times[schedule.times.length - 1] : rangeStart;
    const cameraKeys = (Array.isArray(motion.keyframes) ? motion.keyframes : [])
      .filter((keyframe) => keyframe?.source === "camera" && Number.isFinite(Number(keyframe?.time)))
      .filter((keyframe) => finiteNumber(keyframe.time, 0) <= rangeEnd + 0.000001)
      .sort((a, b) => finiteNumber(a.time, 0) - finiteNumber(b.time, 0));
    if (cameraKeys.length < 2) return { ...empty, lastSampleTime };

    let finalIndex = -1;
    for (let index = cameraKeys.length - 1; index >= 0; index -= 1) {
      const time = finiteNumber(cameraKeys[index]?.time, -1);
      if (time >= rangeStart - 0.000001 && time <= rangeEnd + 0.000001) {
        finalIndex = index;
        break;
      }
    }
    if (finalIndex <= 0) return { ...empty, lastSampleTime };

    const previousKey = cameraKeys[finalIndex - 1];
    const finalKey = cameraKeys[finalIndex];
    const finalKeyTime = finiteNumber(finalKey.time, rangeEnd);
    const fallbackCamera = blocking?.camera || {};
    const fromPose = { ...fallbackCamera, ...(previousKey?.pose || {}) };
    const toPose = { ...fallbackCamera, ...(finalKey?.pose || {}) };
    const changed = poseFieldsChanged(
      fromPose,
      toPose,
      ["x", "y", "height", "panDeg", "tiltDeg", "focal", "aimX", "aimY"],
      0.0001,
    );
    const exposureFrames = schedule.times.reduce(
      (count, sampleTime) => count + (sampleTime + 0.000001 >= finalKeyTime ? 1 : 0),
      0,
    );
    return { changed, exposureFrames, minimumFrames: minimum, finalKeyTime, lastSampleTime };
  }

'''
marker = "  function referenceTailDiscreteEvents(blocking = {}, exportRange = {}, fps = 24) {"
if "function referenceFinalCameraExposure(" not in text:
    if text.count(marker) != 1:
        raise SystemExit(f"tail helper marker count: {text.count(marker)}")
    text = text.replace(marker, helper + marker, 1)

old_init = '''    let tailDiscrete = { lastSampleTime: rangeStart, events: [] };
    const validRangeForSampling = rangeStart >= 0
'''
new_init = '''    let tailDiscrete = { lastSampleTime: rangeStart, events: [] };
    let finalCameraExposure = {
      changed: false,
      exposureFrames: 0,
      minimumFrames: 2,
      finalKeyTime: null,
      lastSampleTime: rangeStart,
    };
    const validRangeForSampling = rangeStart >= 0
'''
if "let finalCameraExposure =" not in text:
    if text.count(old_init) != 1:
        raise SystemExit(f"readiness init marker count: {text.count(old_init)}")
    text = text.replace(old_init, new_init, 1)

if '"camera-final-framing-short"' not in text:
    pattern = re.compile(
        r'(      tailDiscrete = referenceTailDiscreteEvents\(blocking, \{ start: rangeStart, end: rangeEnd \}, fps\);\n'
        r'      if \(tailDiscrete\.events\.length\) \{\n'
        r'.*?'
        r'      \}\n)',
        re.S,
    )
    match = pattern.search(text)
    if not match:
        raise SystemExit("tail readiness warning block not found")
    addition = '''      finalCameraExposure = referenceFinalCameraExposure(
        blocking,
        { start: rangeStart, end: rangeEnd },
        fps,
        2,
      );
      if (finalCameraExposure.changed && finalCameraExposure.exposureFrames < finalCameraExposure.minimumFrames) {
        addReadinessIssue(
          issues,
          "warning",
          "camera-final-framing-short",
          `마지막 카메라 도착 구도가 MP4에서 ${finalCameraExposure.exposureFrames}프레임만 직접 보입니다. Seedance가 최종 프레이밍을 읽을 수 있도록 마지막 카메라 키를 앞당기거나 출력 구간을 늘려 최소 ${finalCameraExposure.minimumFrames}프레임 이상 유지하세요.`,
        );
      }
'''
    text = text[:match.end()] + addition + text[match.end():]

stats_marker = '''        cameraKeyCount: keyframes.filter((keyframe) => keyframe.source === "camera").length,
        tailDiscreteEventCount: tailDiscrete.events.length,
'''
stats_replacement = '''        cameraKeyCount: keyframes.filter((keyframe) => keyframe.source === "camera").length,
        tailDiscreteEventCount: tailDiscrete.events.length,
        finalCameraExposureFrames: finalCameraExposure.exposureFrames,
'''
if "finalCameraExposureFrames:" not in text:
    if text.count(stats_marker) != 1:
        raise SystemExit(f"stats marker count: {text.count(stats_marker)}")
    text = text.replace(stats_marker, stats_replacement, 1)

export_marker = '''    referenceExportFrameSchedule,
    referenceTailDiscreteEvents,
'''
export_replacement = '''    referenceExportFrameSchedule,
    referenceFinalCameraExposure,
    referenceTailDiscreteEvents,
'''
if "    referenceFinalCameraExposure," not in text:
    if text.count(export_marker) != 1:
        raise SystemExit(f"export marker count: {text.count(export_marker)}")
    text = text.replace(export_marker, export_replacement, 1)

motion_path.write_text(text, encoding="utf-8")

test_path = Path("tests/reference-readiness.test.cjs")
test = test_path.read_text(encoding="utf-8")

import_marker = '''  isFrameAligned,
  referenceTailDiscreteEvents,
'''
import_replacement = '''  isFrameAligned,
  referenceFinalCameraExposure,
  referenceTailDiscreteEvents,
'''
if "  referenceFinalCameraExposure," not in test:
    if test.count(import_marker) != 1:
        raise SystemExit(f"test import marker count: {test.count(import_marker)}")
    test = test.replace(import_marker, import_replacement, 1)

old_smooth = '''const smoothEndResult = evaluateReferenceReadiness(smoothEnd);
assert.equal(smoothEndResult.status, "ready", "ordinary smooth endpoint keys must not become false-positive reviews");
assert.equal(smoothEndResult.stats.tailDiscreteEventCount, 0);
'''
new_smooth = '''const smoothEndResult = evaluateReferenceReadiness(smoothEnd);
assert.equal(smoothEndResult.status, "review", "a changed final camera framing with zero CFR samples should be reviewed");
assert.ok(smoothEndResult.issues.some((issue) => issue.code === "camera-final-framing-short"));
assert.equal(smoothEndResult.stats.tailDiscreteEventCount, 0, "smooth framing warning must not be misclassified as a discrete event");
assert.equal(smoothEndResult.stats.finalCameraExposureFrames, 0);
const smoothEndExposure = referenceFinalCameraExposure(smoothEnd, { start: 0, end: 5 }, 24, 2);
assert.equal(smoothEndExposure.changed, true);
assert.equal(smoothEndExposure.exposureFrames, 0);

const oneFrameCameraEnd = baseBlocking();
oneFrameCameraEnd.motion.keyframes.push({
  id: "cam-end-one-frame",
  source: "camera",
  time: 119 / 24,
  transition: "smooth",
  pose: { x: 0.6, y: 0.5, height: 1.6, panDeg: 180, tiltDeg: -4, focal: 50, trackingTargetId: "actor-1" },
});
const oneFrameCameraEndResult = evaluateReferenceReadiness(oneFrameCameraEnd);
assert.equal(oneFrameCameraEndResult.status, "review");
assert.ok(oneFrameCameraEndResult.issues.some((issue) => issue.code === "camera-final-framing-short"));
assert.equal(oneFrameCameraEndResult.stats.finalCameraExposureFrames, 1);

const twoFrameCameraEnd = baseBlocking();
twoFrameCameraEnd.motion.keyframes.push({
  id: "cam-end-two-frames",
  source: "camera",
  time: 118 / 24,
  transition: "smooth",
  pose: { x: 0.6, y: 0.5, height: 1.6, panDeg: 180, tiltDeg: -4, focal: 50, trackingTargetId: "actor-1" },
});
const twoFrameCameraEndResult = evaluateReferenceReadiness(twoFrameCameraEnd);
assert.equal(twoFrameCameraEndResult.status, "ready", "two directly sampled destination frames should be enough for readiness");
assert.equal(twoFrameCameraEndResult.stats.finalCameraExposureFrames, 2);

const redundantCameraEnd = baseBlocking();
redundantCameraEnd.motion.keyframes.push({
  id: "cam-end-redundant",
  source: "camera",
  time: 5,
  transition: "smooth",
  pose: { x: 0.7, y: 0.5, height: 1.6, panDeg: 180, tiltDeg: -4, focal: 50, trackingTargetId: "actor-1" },
});
const redundantCameraEndResult = evaluateReferenceReadiness(redundantCameraEnd);
assert.equal(redundantCameraEndResult.status, "ready", "a redundant final camera key must not trigger a framing warning");
assert.ok(!redundantCameraEndResult.issues.some((issue) => issue.code === "camera-final-framing-short"));
'''
if "oneFrameCameraEnd" not in test:
    if test.count(old_smooth) != 1:
        raise SystemExit(f"smooth endpoint test marker count: {test.count(old_smooth)}")
    test = test.replace(old_smooth, new_smooth, 1)

test_path.write_text(test, encoding="utf-8")
