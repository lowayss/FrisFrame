#!/usr/bin/env python3
from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected exactly one match, found {count}")
    file.write_text(text.replace(old, new, 1), encoding="utf-8")


motion_anchor = "  function smoothReferenceProgress(progress) {\n"
motion_insert = '''  function composeBaseInterpolatedPose({
    sourceId = "",
    from = {},
    to = {},
    progress = 0,
    spatial = {},
    transformed = null,
  } = {}) {
    const t = clamp(progress, 0, 1);
    const lerpValue = (start, end) => finiteNumber(start, 0) + (finiteNumber(end, finiteNumber(start, 0)) - finiteNumber(start, 0)) * t;
    const lerpAngleDegrees = (start, end) => {
      const fromAngle = finiteNumber(start, 0);
      const toAngle = finiteNumber(end, fromAngle);
      const delta = ((toAngle - fromAngle + 540) % 360) - 180;
      return (fromAngle + delta * t + 360) % 360;
    };

    if (sourceId === "camera") {
      return {
        ...from,
        x: finiteNumber(spatial.x, from.x),
        y: finiteNumber(spatial.y, from.y),
        height: finiteNumber(spatial.height, from.height),
        panDeg: lerpAngleDegrees(from.panDeg, to.panDeg),
        tiltDeg: lerpValue(from.tiltDeg, to.tiltDeg),
        focal: Math.round(lerpValue(from.focal, to.focal)),
        focusDistanceM: lerpValue(from.focusDistanceM, to.focusDistanceM),
        trackingTargetId: t < 0.5 ? from.trackingTargetId : to.trackingTargetId,
      };
    }

    const resolvedTransform = transformed || from;
    const keyedBodyPose = from.type === "actor"
      ? (t >= 0.999 ? to.bodyPose : from.bodyPose)
      : null;
    return {
      ...from,
      x: finiteNumber(spatial.x, from.x),
      y: finiteNumber(spatial.y, from.y),
      size: resolvedTransform.size,
      scaleX: resolvedTransform.scaleX,
      scaleY: resolvedTransform.scaleY,
      scaleZ: resolvedTransform.scaleZ,
      verticalOffset: from.type === "actor" ? finiteNumber(spatial.height, from.verticalOffset) : from.verticalOffset,
      mountedHeight: from.type === "prop" ? finiteNumber(spatial.height, from.mountedHeight) : from.mountedHeight,
      pitch: lerpValue(Number(from.pitch || 0), Number(to.pitch || 0)),
      facing: lerpAngleDegrees(from.facing, to.facing),
      bodyPose: keyedBodyPose,
      color: to.color,
      shape: to.shape,
      assetType: to.assetType,
      mountId: t < 0.5 ? from.mountId : to.mountId,
      seatIndex: t < 0.5 ? from.seatIndex : to.seatIndex,
      name: to.name,
      visible: t < 0.5 ? from.visible !== false : to.visible !== false,
    };
  }

  function smoothReferenceProgress(progress) {
'''
replace_once("motion-core.js", motion_anchor, motion_insert)
replace_once(
    "motion-core.js",
    "    cloneValue,\n    collectReferenceBatchCuts,\n",
    "    cloneValue,\n    collectReferenceBatchCuts,\n    composeBaseInterpolatedPose,\n",
)

old_app = '''function interpolatePoseFor(renderState, sourceId, startPose, endPose, t, fallbackPose, endKeyframe = null) {
  const from = mergePoseWithFallbackFor(renderState, sourceId, startPose, fallbackPose);
  const to = mergePoseWithFallbackFor(renderState, sourceId, endPose, fallbackPose);
  const segment = sanitizeMotionSegment(endKeyframe?.segment, sourceId);
  const spatial = evaluateMotionSegment(renderState, sourceId, from, to, t, segment);
  if (sourceId === "camera") {
    return syncCameraDerivedAim({
      ...from,
      x: spatial.x,
      y: spatial.y,
      height: spatial.height,
      panDeg: lerpAngle(from.panDeg, to.panDeg, t),
      tiltDeg: lerp(from.tiltDeg, to.tiltDeg, t),
      focal: Math.round(lerp(from.focal, to.focal, t)),
      focusDistanceM: lerp(from.focusDistanceM, to.focusDistanceM, t),
      trackingTargetId: sanitizeTrackingTargetId(t < 0.5 ? from.trackingTargetId : to.trackingTargetId, renderState),
    }, renderState);
  }
  // Actor blocking is a position/orientation guide, not a walk-cycle
  // generator. Hold the keyed pose throughout the move and apply the next
  // pose only when the actor reaches the destination key.
  const keyedBodyPose = from.type === "actor"
    ? (t >= 0.999 ? to.bodyPose : from.bodyPose)
    : null;
  const heightField = from.type === "prop" ? "mountedHeight" : "verticalOffset";
  const transformed = sceneBlockingCore.interpolateSceneObject(
    { ...from, elevation: Number(from[heightField] || 0) },
    { ...to, elevation: Number(to[heightField] || 0) },
    t,
  );

  return {
    ...from,
    x: spatial.x,
    y: spatial.y,
    size: transformed.size,
    scaleX: transformed.scaleX,
    scaleY: transformed.scaleY,
    scaleZ: transformed.scaleZ,
    verticalOffset: from.type === "actor" ? spatial.height : from.verticalOffset,
    mountedHeight: from.type === "prop" ? spatial.height : from.mountedHeight,
    pitch: lerp(Number(from.pitch || 0), Number(to.pitch || 0), t),
    facing: lerpAngle(from.facing, to.facing, t),
    bodyPose: keyedBodyPose,
    color: to.color,
    shape: to.shape,
    assetType: to.assetType,
    mountId: t < 0.5 ? from.mountId : to.mountId,
    seatIndex: t < 0.5 ? from.seatIndex : to.seatIndex,
    name: to.name,
    visible: t < 0.5 ? from.visible !== false : to.visible !== false,
  };
}
'''
new_app = '''function interpolatePoseFor(renderState, sourceId, startPose, endPose, t, fallbackPose, endKeyframe = null) {
  const from = mergePoseWithFallbackFor(renderState, sourceId, startPose, fallbackPose);
  const to = mergePoseWithFallbackFor(renderState, sourceId, endPose, fallbackPose);
  const segment = sanitizeMotionSegment(endKeyframe?.segment, sourceId);
  const spatial = evaluateMotionSegment(renderState, sourceId, from, to, t, segment);
  const heightField = from.type === "prop" ? "mountedHeight" : "verticalOffset";
  const transformed = sourceId === "camera" ? null : sceneBlockingCore.interpolateSceneObject(
    { ...from, elevation: Number(from[heightField] || 0) },
    { ...to, elevation: Number(to[heightField] || 0) },
    t,
  );
  const composeBaseInterpolatedPose = window.FrisFrameMotionCore?.composeBaseInterpolatedPose;
  if (typeof composeBaseInterpolatedPose !== "function") {
    throw new Error("모션 코어의 기본 포즈 평가기를 불러오지 못했습니다.");
  }
  const result = composeBaseInterpolatedPose({
    sourceId,
    from,
    to,
    progress: t,
    spatial,
    transformed,
  });
  if (sourceId === "camera") {
    result.trackingTargetId = sanitizeTrackingTargetId(result.trackingTargetId, renderState);
    return syncCameraDerivedAim(result, renderState);
  }
  return result;
}
'''
replace_once("app.js", old_app, new_app)

replace_once(
    "tests/motion-core.test.cjs",
    "  constrainPathEndpoint,\n  finiteNumber,\n",
    "  constrainPathEndpoint,\n  composeBaseInterpolatedPose,\n  finiteNumber,\n",
)
replace_once(
    "tests/motion-core.test.cjs",
    'console.log("motion-core: transitions, path constraints, and camera reference speed passed");\n',
    '''const baseCameraPose = composeBaseInterpolatedPose({
  sourceId: "camera",
  from: { x: 0.2, y: 0.3, height: 1.5, panDeg: 350, tiltDeg: -10, focal: 24, focusDistanceM: 3, trackingTargetId: "actor-a" },
  to: { x: 0.8, y: 0.7, height: 2.5, panDeg: 10, tiltDeg: 10, focal: 70, focusDistanceM: 7, trackingTargetId: "actor-b" },
  progress: 0.25,
  spatial: { x: 0.35, y: 0.4, height: 1.75 },
});
near(baseCameraPose.x, 0.35);
near(baseCameraPose.height, 1.75);
near(baseCameraPose.panDeg, 355);
near(baseCameraPose.tiltDeg, -5);
assert.equal(baseCameraPose.focal, 36, "base app-compatible focal composition remains rounded before reference semantics correct it");
assert.equal(baseCameraPose.trackingTargetId, "actor-a");
const baseCameraLate = composeBaseInterpolatedPose({
  sourceId: "camera",
  from: { trackingTargetId: "actor-a" },
  to: { trackingTargetId: "actor-b" },
  progress: 0.75,
  spatial: {},
});
assert.equal(baseCameraLate.trackingTargetId, "actor-b", "base compatibility layer keeps the old midpoint switch that the reference guard overrides");

const neutralBodyPose = { torso: { x: 0 } };
const destinationBodyPose = { torso: { x: 20 } };
const baseActorBefore = composeBaseInterpolatedPose({
  sourceId: "actor-1",
  from: { type: "actor", x: 0.2, y: 0.3, verticalOffset: 0, pitch: 0, facing: 350, bodyPose: neutralBodyPose, visible: true },
  to: { type: "actor", x: 0.8, y: 0.7, verticalOffset: 1, pitch: 20, facing: 10, bodyPose: destinationBodyPose, visible: false },
  progress: 0.998,
  spatial: { x: 0.5, y: 0.5, height: 0.5 },
  transformed: { size: 1.2, scaleX: 1, scaleY: 1.1, scaleZ: 0.9 },
});
assert.equal(baseActorBefore.bodyPose, neutralBodyPose);
near(baseActorBefore.facing, 9.96, 0.001);
near(baseActorBefore.verticalOffset, 0.5);
const baseActorAtLegacyThreshold = composeBaseInterpolatedPose({
  sourceId: "actor-1",
  from: { type: "actor", bodyPose: neutralBodyPose },
  to: { type: "actor", bodyPose: destinationBodyPose },
  progress: 0.999,
  spatial: {},
  transformed: {},
});
assert.equal(baseActorAtLegacyThreshold.bodyPose, destinationBodyPose,
  "base compatibility layer keeps the old 0.999 switch while the reference guard holds until the authored destination");

console.log("motion-core: transitions, path constraints, camera reference speed, and base pose composition passed");
''',
)

replace_once(
    "tests/reference-video-contract.test.cjs",
    'assert.ok(app.includes("return interpolatePoseFor(renderState, sourceId, start.pose, end.pose, progress, fallbackPose, end);"),\n  "render-state interpolation must reach the guarded pose evaluator");\n',
    'assert.ok(app.includes("return interpolatePoseFor(renderState, sourceId, start.pose, end.pose, progress, fallbackPose, end);"),\n'
    '  "render-state interpolation must reach the guarded pose evaluator");\n'
    'assert.ok(app.includes("window.FrisFrameMotionCore?.composeBaseInterpolatedPose"),\n'
    '  "the app evaluator must delegate base pose composition to motion-core");\n'
    'assert.ok(motion.includes("function composeBaseInterpolatedPose"),\n'
    '  "motion-core must own base pose composition");\n',
)

replace_once(
    "tests/dom-contract.test.cjs",
    'const app = fs.readFileSync(path.join(root, "app.js"), "utf8");\n',
    'const app = fs.readFileSync(path.join(root, "app.js"), "utf8");\n'
    'const motion = fs.readFileSync(path.join(root, "motion-core.js"), "utf8");\n',
)
replace_once(
    "tests/dom-contract.test.cjs",
    'assert.ok(app.includes("focusDistanceM: lerp("), "camera focus distance must interpolate between keys");\n',
    'assert.ok(motion.includes("focusDistanceM: lerpValue("), "motion-core must interpolate camera focus distance between keys");\n'
    'assert.ok(app.includes("window.FrisFrameMotionCore?.composeBaseInterpolatedPose"), "app must delegate base camera pose composition to motion-core");\n',
)

print("app base pose extraction patch applied")
