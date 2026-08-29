from pathlib import Path


def replace_once(path, old, new):
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected exactly one match, found {count}")
    file.write_text(text.replace(old, new, 1), encoding="utf-8")


motion_anchor = '''  function poseFieldsChanged(startPose = {}, endPose = {}, fields = ["x", "y"], epsilon = 0.0001) {
'''
motion_insert = '''  function referenceExportFrameSchedule({ start = 0, end = 0, fps = 24, minFrameCount = 2 } = {}) {
    const safeStart = finiteNumber(start, 0);
    const safeEnd = Math.max(safeStart, finiteNumber(end, safeStart));
    const safeFps = Math.max(1, Math.round(clamp(finiteNumber(fps, 24), 1, 60)));
    const minimum = Math.max(2, Math.round(finiteNumber(minFrameCount, 2)));
    const duration = Math.max(0.01, safeEnd - safeStart);
    const frameCount = Math.max(minimum, Math.round(duration * safeFps));
    const times = Array.from({ length: frameCount }, (_entry, index) => (
      Math.min(safeEnd, safeStart + index / safeFps)
    ));
    return { start: safeStart, end: safeEnd, duration, fps: safeFps, frameCount, times };
  }

  function poseFieldsChanged(startPose = {}, endPose = {}, fields = ["x", "y"], epsilon = 0.0001) {
'''
replace_once("motion-core.js", motion_anchor, motion_insert)
replace_once(
    "motion-core.js",
    "    referenceEntryKey,\n    rescaleKeyframeTimes,\n",
    "    referenceEntryKey,\n    referenceExportFrameSchedule,\n    rescaleKeyframeTimes,\n",
)

old_export_setup = '''  const exportDuration = Math.max(0.01, exportRange.end - exportRange.start);
  const frameCount = Math.max(2, Math.round(exportDuration * fps));
'''
new_export_setup = '''  const exportDuration = Math.max(0.01, exportRange.end - exportRange.start);
  const referenceExportFrameSchedule = window.FrisFrameMotionCore?.referenceExportFrameSchedule;
  if (typeof referenceExportFrameSchedule !== "function") {
    notifyApp("모션 코어의 MP4 프레임 스케줄을 불러오지 못했습니다.");
    return;
  }
  const frameSchedule = referenceExportFrameSchedule({
    start: exportRange.start,
    end: exportRange.end,
    fps,
    minFrameCount: 2,
  });
  const frameCount = frameSchedule.frameCount;
'''
replace_once("app.js", old_export_setup, new_export_setup)
replace_once(
    "app.js",
    '''      const progress = frameCount <= 1 ? 0 : index / (frameCount - 1);
      const renderTime = exportRange.start + progress * exportDuration;
''',
    '''      const renderTime = frameSchedule.times[index];
''',
)

replace_once(
    "tests/motion-core.test.cjs",
    "  quadraticBezierArcLengthPoint,\n  rescaleKeyframeTimes,\n",
    "  quadraticBezierArcLengthPoint,\n  referenceExportFrameSchedule,\n  rescaleKeyframeTimes,\n",
)

schedule_test_anchor = '''const frameDocument = {
'''
schedule_tests = '''const schedule24 = referenceExportFrameSchedule({ start: 0, end: 2, fps: 24 });
assert.equal(schedule24.frameCount, 48);
assert.equal(schedule24.fps, 24);
near(schedule24.times[0], 0);
near(schedule24.times[1] - schedule24.times[0], 1 / 24, 0.000000001);
near(schedule24.times.at(-1), 47 / 24, 0.000000001);
assert.ok(schedule24.times.at(-1) < 2, "CFR sampling must not stretch the last evaluated frame to the range endpoint");
near(schedule24.frameCount / schedule24.fps, 2, 0.000000001);
for (let index = 1; index < schedule24.times.length; index += 1) {
  near(schedule24.times[index] - schedule24.times[index - 1], 1 / 24, 0.000000001);
}

const schedule60 = referenceExportFrameSchedule({ start: 5, end: 7, fps: 60 });
assert.equal(schedule60.frameCount, 120);
near(schedule60.times[0], 5);
near(schedule60.times[1] - schedule60.times[0], 1 / 60, 0.000000001);
near(schedule60.times.at(-1), 5 + 119 / 60, 0.000000001);
for (let index = 1; index < schedule60.times.length; index += 1) {
  near(schedule60.times[index] - schedule60.times[index - 1], 1 / 60, 0.000000001);
}
const minimumSchedule = referenceExportFrameSchedule({ start: 1, end: 1.01, fps: 24 });
assert.equal(minimumSchedule.frameCount, 2, "MP4 server compatibility requires at least two frames");

const frameDocument = {
'''
replace_once("tests/motion-core.test.cjs", schedule_test_anchor, schedule_tests)
replace_once(
    "tests/motion-core.test.cjs",
    'console.log("motion-core: frame assembly, source timing, transitions, path constraints, camera reference speed, and base pose composition passed");\n',
    'console.log("motion-core: CFR export scheduling, frame assembly, source timing, transitions, path constraints, camera reference speed, and base pose composition passed");\n',
)

replace_once(
    "tests/dom-contract.test.cjs",
    'assert.match(app, /const renderTime = exportRange\\.start \\+ progress \\* exportDuration;[\\s\\S]*?interpolateRenderStateAtTime\\(exportState, renderTime\\)/, "MP4 export must render frames from the selected start time");\n',
    'assert.match(app, /const renderTime = frameSchedule\\.times\\[index\\];[\\s\\S]*?interpolateRenderStateAtTime\\(exportState, renderTime\\)/, "MP4 export must render frames from the CFR schedule");\n'
    'assert.ok(app.includes("window.FrisFrameMotionCore?.referenceExportFrameSchedule"), "MP4 export timing must come from motion-core");\n'
    'assert.equal(app.includes("index / (frameCount - 1)"), false, "MP4 evaluation must not stretch authored time across frameCount - 1 intervals");\n',
)

old_contract = '''// Export intentionally includes both authored endpoints in the requested frame
// count. If this policy changes, it needs a deliberate reference-video review.
assert.ok(app.includes("const frameCount = Math.max(2, Math.round(exportDuration * fps));"));
assert.ok(app.includes("const progress = frameCount <= 1 ? 0 : index / (frameCount - 1);"));
assert.ok(app.includes("const renderTime = exportRange.start + progress * exportDuration;"));
'''
new_contract = '''// CFR export samples authored state on the encoded FPS grid. The final frame
// occupies the final presentation interval; it must not be time-stretched to
// the exact range endpoint via frameCount - 1 interpolation.
assert.ok(app.includes("window.FrisFrameMotionCore?.referenceExportFrameSchedule"));
assert.ok(app.includes("const frameCount = frameSchedule.frameCount;"));
assert.ok(app.includes("const renderTime = frameSchedule.times[index];"));
assert.equal(app.includes("index / (frameCount - 1)"), false,
  "CFR reference export must not stretch sample spacing to force endpoint inclusion");
assert.ok(motion.includes("safeStart + index / safeFps"),
  "motion-core must schedule MP4 evaluation at exact CFR frame times");
'''
replace_once("tests/reference-video-contract.test.cjs", old_contract, new_contract)

print("frame-accurate reference export schedule patch applied")
