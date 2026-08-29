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
motion_insert = '''  function composeEvaluatedFrameBase(renderState = {}, time = 0, evaluateSource = null) {
    if (typeof evaluateSource !== "function") {
      throw new TypeError("composeEvaluatedFrameBase requires a source evaluator");
    }
    const duration = Math.max(0, finiteNumber(renderState?.motion?.duration, 0));
    const safeTime = clamp(time, 0, duration);
    const next = cloneValue(renderState);
    next.camera = evaluateSource("camera", safeTime, renderState?.camera || {});
    next.items = (Array.isArray(renderState?.items) ? renderState.items : []).map((item) => (
      evaluateSource(item.id, safeTime, item)
    ));
    next.motion = { ...(next.motion || {}), playhead: safeTime };
    return next;
  }

  function poseFieldsChanged(startPose = {}, endPose = {}, fields = ["x", "y"], epsilon = 0.0001) {
'''
replace_once("motion-core.js", motion_anchor, motion_insert)
replace_once(
    "motion-core.js",
    "    cloneValue,\n    collectReferenceBatchCuts,\n",
    "    cloneValue,\n    collectReferenceBatchCuts,\n    composeEvaluatedFrameBase,\n",
)

old_state = '''function interpolateStateAtTime(time) {
  const safeTime = clamp(time, 0, state.motion.duration);
  const next = clone(state);
  next.camera = interpolateSourceAtTime("camera", safeTime, state.camera);
  next.items = state.items.map((item) => interpolateSourceAtTime(item.id, safeTime, item));
  next.motion.playhead = safeTime;
  return applyLiveSourceEdits(applyActiveCameraTracking(next, state), safeTime);
}
'''
new_state = '''function interpolateStateAtTime(time) {
  return interpolateRenderStateAtTime(state, time);
}
'''
replace_once("app.js", old_state, new_state)

old_render = '''function interpolateRenderStateAtTime(renderState, time) {
  if (renderState === state) return interpolateStateAtTime(time);
  const safeTime = clamp(time, 0, renderState.motion.duration);
  const next = clone(renderState);
  next.camera = interpolateSourceAtTimeFor(renderState, "camera", safeTime, renderState.camera);
  next.items = renderState.items.map((item) => interpolateSourceAtTimeFor(renderState, item.id, safeTime, item));
  next.motion.playhead = safeTime;
  return applyLiveSourceEdits(applyActiveCameraTracking(next, renderState), safeTime);
}
'''
new_render = '''function interpolateRenderStateAtTime(renderState, time) {
  const composeEvaluatedFrameBase = window.FrisFrameMotionCore?.composeEvaluatedFrameBase;
  if (typeof composeEvaluatedFrameBase !== "function") {
    throw new Error("모션 코어의 프레임 조립기를 불러오지 못했습니다.");
  }
  const next = composeEvaluatedFrameBase(
    renderState,
    time,
    (sourceId, safeTime, fallbackPose) => interpolateSourceAtTimeFor(renderState, sourceId, safeTime, fallbackPose),
  );
  const safeTime = Number(next.motion?.playhead || 0);
  return applyLiveSourceEdits(applyActiveCameraTracking(next, renderState), safeTime);
}
'''
replace_once("app.js", old_render, new_render)

replace_once(
    "tests/motion-core.test.cjs",
    "  composeBaseInterpolatedPose,\n  finiteNumber,\n",
    "  composeBaseInterpolatedPose,\n  composeEvaluatedFrameBase,\n  finiteNumber,\n",
)

test_anchor = '''const baseCameraPose = composeBaseInterpolatedPose({
'''
frame_tests = '''const frameDocument = {
  sceneTitle: "frame-base-test",
  camera: { x: 0.1, focal: 35 },
  items: [
    { id: "actor-a", type: "actor", x: 0.2 },
    { id: "prop-a", type: "prop", x: 0.8 },
  ],
  motion: { duration: 5, playhead: 1 },
};
const frameCalls = [];
const evaluatedFrameBase = composeEvaluatedFrameBase(frameDocument, 9, (sourceId, safeTime, fallbackPose) => {
  frameCalls.push([sourceId, safeTime]);
  return { ...fallbackPose, evaluatedAt: safeTime };
});
assert.notEqual(evaluatedFrameBase, frameDocument, "frame assembly must clone the document");
assert.equal(frameDocument.motion.playhead, 1, "frame assembly must not mutate authored playhead");
assert.equal(evaluatedFrameBase.motion.playhead, 5, "frame time must clamp to duration");
assert.deepEqual(frameCalls, [["camera", 5], ["actor-a", 5], ["prop-a", 5]]);
assert.equal(evaluatedFrameBase.camera.evaluatedAt, 5);
assert.equal(evaluatedFrameBase.items[0].evaluatedAt, 5);
const evaluatedFrameStart = composeEvaluatedFrameBase(frameDocument, -3, (_sourceId, safeTime, fallbackPose) => ({ ...fallbackPose, evaluatedAt: safeTime }));
assert.equal(evaluatedFrameStart.motion.playhead, 0, "negative frame time must clamp to zero");
assert.throws(
  () => composeEvaluatedFrameBase(frameDocument, 1),
  /source evaluator/,
  "frame assembly must not silently skip source evaluation",
);

const baseCameraPose = composeBaseInterpolatedPose({
'''
replace_once("tests/motion-core.test.cjs", test_anchor, frame_tests)
replace_once(
    "tests/motion-core.test.cjs",
    'console.log("motion-core: source timing, transitions, path constraints, camera reference speed, and base pose composition passed");\n',
    'console.log("motion-core: frame assembly, source timing, transitions, path constraints, camera reference speed, and base pose composition passed");\n',
)

replace_once(
    "tests/dom-contract.test.cjs",
    'assert.match(app, /function materializeEvaluatedViewForEditing\\([\\s\\S]*?const baseFrame = interpolateStateAtTime\\(evaluatedViewState\\.motion\\.playhead\\);[\\s\\S]*?else if \\(sourceId === "camera"\\) \\{[\\s\\S]*?state\\.camera = clone\\(baseFrame\\.camera\\);[\\s\\S]*?state\\.items = clone\\(visibleFrame\\.items\\);/, "camera editing must restore the camera without baking actor motion into authored state");\n',
    'assert.match(app, /function materializeEvaluatedViewForEditing\\([\\s\\S]*?const baseFrame = interpolateStateAtTime\\(evaluatedViewState\\.motion\\.playhead\\);[\\s\\S]*?else if \\(sourceId === "camera"\\) \\{[\\s\\S]*?state\\.camera = clone\\(baseFrame\\.camera\\);[\\s\\S]*?state\\.items = clone\\(visibleFrame\\.items\\);/, "camera editing must restore the camera without baking actor motion into authored state");\n'
    'assert.match(app, /function interpolateStateAtTime\\(time\\) \\{\\s*return interpolateRenderStateAtTime\\(state, time\\);\\s*\\}/, "interactive preview must share the render-state frame evaluator");\n'
    'assert.ok(app.includes("window.FrisFrameMotionCore?.composeEvaluatedFrameBase"), "app frame evaluation must delegate base frame assembly to motion-core");\n'
    'assert.ok(motion.includes("function composeEvaluatedFrameBase"), "motion-core must own base frame assembly");\n',
)

replace_once(
    "tests/reference-video-contract.test.cjs",
    'assert.ok(app.includes("const renderState = interpolateRenderStateAtTime(exportState, renderTime);"),\n  "MP4 export must evaluate authored state at each render time");\n',
    'assert.ok(app.includes("const renderState = interpolateRenderStateAtTime(exportState, renderTime);"),\n'
    '  "MP4 export must evaluate authored state at each render time");\n'
    'assert.ok(app.includes("return interpolateRenderStateAtTime(state, time);"),\n'
    '  "interactive preview must use the same render-state frame evaluator as MP4 export");\n'
    'assert.ok(app.includes("window.FrisFrameMotionCore?.composeEvaluatedFrameBase"),\n'
    '  "shared preview/export frame evaluation must delegate base assembly to motion-core");\n'
    'assert.ok(motion.includes("function composeEvaluatedFrameBase"),\n'
    '  "motion-core must own base frame assembly");\n',
)

print("frame base composition patch applied")
