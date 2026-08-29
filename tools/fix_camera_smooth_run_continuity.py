#!/usr/bin/env python3
from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one anchor, found {count}")
    return text.replace(old, new, 1)


# motion-core.js
motion_path = Path("motion-core.js")
motion = motion_path.read_text(encoding="utf-8")

old_camera_progress = '''  function cameraReferenceProgress(progress, transition = "smooth") {\n    const t = clamp(progress, 0, 1);\n    return String(transition || "smooth") === "smooth" ? smoothReferenceProgress(t) : t;\n  }\n'''
new_camera_progress = '''  function smoothReferenceEaseInProgress(progress) {\n    const t = clamp(progress, 0, 1);\n    return 2 * t * t - t * t * t;\n  }\n\n  function smoothReferenceEaseOutProgress(progress) {\n    const t = clamp(progress, 0, 1);\n    return t + t * t - t * t * t;\n  }\n\n  function cameraReferenceProgress(progress, transition = "smooth", options = {}) {\n    const t = clamp(progress, 0, 1);\n    if (String(transition || "smooth") !== "smooth") return t;\n    const hasSmoothBefore = options?.hasSmoothBefore === true;\n    const hasSmoothAfter = options?.hasSmoothAfter === true;\n    if (hasSmoothBefore && hasSmoothAfter) return t;\n    if (hasSmoothBefore) return smoothReferenceEaseOutProgress(t);\n    if (hasSmoothAfter) return smoothReferenceEaseInProgress(t);\n    return smoothReferenceProgress(t);\n  }\n'''
motion = replace_once(motion, old_camera_progress, new_camera_progress, "cameraReferenceProgress")

old_wrapper_signature = '''      fallbackPose,\n      endKeyframe = null,\n    ) {\n      const inputProgress = clamp(progress, 0, 1);\n      const evaluatedProgress = sourceId === "camera"\n        ? cameraReferenceProgress(inputProgress, endKeyframe?.transition || "smooth")\n        : inputProgress;\n'''
new_wrapper_signature = '''      fallbackPose,\n      endKeyframe = null,\n      evaluationOptions = null,\n    ) {\n      const inputProgress = clamp(progress, 0, 1);\n      const referenceProgressOverride = Number(evaluationOptions?.referenceProgress);\n      const evaluatedProgress = sourceId === "camera"\n        ? (Number.isFinite(referenceProgressOverride)\n          ? clamp(referenceProgressOverride, 0, 1)\n          : cameraReferenceProgress(inputProgress, endKeyframe?.transition || "smooth"))\n        : inputProgress;\n'''
motion = replace_once(motion, old_wrapper_signature, new_wrapper_signature, "reference wrapper signature")

old_original_call_tail = '''        fallbackPose,\n        endKeyframe,\n      );\n'''
new_original_call_tail = '''        fallbackPose,\n        endKeyframe,\n        evaluationOptions,\n      );\n'''
motion = replace_once(motion, old_original_call_tail, new_original_call_tail, "reference wrapper original call")

old_segment_loop = '''    let start = first;\n    let end = last;\n    for (let index = 0; index < keys.length - 1; index += 1) {\n      const candidateStart = keys[index];\n      const candidateEnd = keys[index + 1];\n      const candidateStartTime = finiteNumber(candidateStart?.time, 0);\n      const candidateEndTime = finiteNumber(candidateEnd?.time, candidateStartTime);\n      if (currentTime >= candidateStartTime && currentTime <= candidateEndTime) {\n        start = candidateStart;\n        end = candidateEnd;\n        break;\n      }\n    }\n\n    const transition = normalizeTransition(end?.transition);\n'''
new_segment_loop = '''    let start = first;\n    let end = last;\n    let segmentIndex = 0;\n    for (let index = 0; index < keys.length - 1; index += 1) {\n      const candidateStart = keys[index];\n      const candidateEnd = keys[index + 1];\n      const candidateStartTime = finiteNumber(candidateStart?.time, 0);\n      const candidateEndTime = finiteNumber(candidateEnd?.time, candidateStartTime);\n      if (currentTime >= candidateStartTime && currentTime <= candidateEndTime) {\n        start = candidateStart;\n        end = candidateEnd;\n        segmentIndex = index;\n        break;\n      }\n    }\n\n    const transition = normalizeTransition(end?.transition);\n'''
motion = replace_once(motion, old_segment_loop, new_segment_loop, "source plan segment index")

old_plan_return = '''    // Spatial blocking crosses ordinary keys without braking. Smooth\n    // reference easing is applied later by the camera-only reference guard.\n    const progress = transition === "smooth" || transition === "linear" ? rawProgress : easedProgress;\n    return { kind: "segment", start, end, transition, rawProgress, easedProgress, progress };\n  }\n'''
new_plan_return = '''    // Spatial blocking crosses ordinary keys without braking. Camera reference\n    // easing is planned separately so a run of smooth camera keys does not\n    // decelerate to zero at every interior marker.\n    const progress = transition === "smooth" || transition === "linear" ? rawProgress : easedProgress;\n    const hasSmoothBefore = transition === "smooth"\n      && segmentIndex > 0\n      && normalizeTransition(start?.transition) === "smooth";\n    const hasSmoothAfter = transition === "smooth"\n      && segmentIndex + 2 < keys.length\n      && normalizeTransition(keys[segmentIndex + 2]?.transition) === "smooth";\n    const referenceProgress = transition === "smooth"\n      ? cameraReferenceProgress(rawProgress, transition, { hasSmoothBefore, hasSmoothAfter })\n      : progress;\n    return {\n      kind: "segment",\n      start,\n      end,\n      transition,\n      rawProgress,\n      easedProgress,\n      progress,\n      referenceProgress,\n      hasSmoothBefore,\n      hasSmoothAfter,\n    };\n  }\n'''
motion = replace_once(motion, old_plan_return, new_plan_return, "source plan reference progress")

motion_path.write_text(motion, encoding="utf-8")


# app.js
app_path = Path("app.js")
app = app_path.read_text(encoding="utf-8")
old_app_call = '''  if (plan.kind === "fallback") return clone(fallbackPose);\n  if (plan.kind === "key") return mergePoseWithFallbackFor(renderState, sourceId, plan.keyframe.pose, fallbackPose);\n  return interpolatePoseFor(renderState, sourceId, plan.start.pose, plan.end.pose, plan.progress, fallbackPose, plan.end);\n}\n'''
new_app_call = '''  if (plan.kind === "fallback") return clone(fallbackPose);\n  if (plan.kind === "key") return mergePoseWithFallbackFor(renderState, sourceId, plan.keyframe.pose, fallbackPose);\n  const evaluationOptions = sourceId === "camera"\n    ? { referenceProgress: plan.referenceProgress }\n    : null;\n  return interpolatePoseFor(\n    renderState,\n    sourceId,\n    plan.start.pose,\n    plan.end.pose,\n    plan.progress,\n    fallbackPose,\n    plan.end,\n    evaluationOptions,\n  );\n}\n'''
app = replace_once(app, old_app_call, new_app_call, "app source evaluator call")
app_path.write_text(app, encoding="utf-8")


# tests/motion-core.test.cjs
motion_test_path = Path("tests/motion-core.test.cjs")
motion_test = motion_test_path.read_text(encoding="utf-8")
old_import = '''  cameraDirectionVector,\n  circularArcPoint,\n'''
new_import = '''  cameraDirectionVector,\n  cameraReferenceProgress,\n  circularArcPoint,\n'''
motion_test = replace_once(motion_test, old_import, new_import, "motion test import")

old_source_plan_assertion = '''near(sourcePlanSmooth.easedProgress, 0.125);\nnear(sourcePlanSmooth.progress, 0.25, 0.000001);\nconst sourcePlanHold = sourceKeyframeEvaluationPlan(sourcePlanKeys, 3);\n'''
new_source_plan_assertion = '''near(sourcePlanSmooth.easedProgress, 0.125);\nnear(sourcePlanSmooth.progress, 0.25, 0.000001);\nnear(sourcePlanSmooth.referenceProgress, 0.125, 0.000001);\n\n// A smooth camera run eases only at the run boundaries. Interior keys must\n// retain non-zero travel speed instead of receiving a fresh ease-in/out.\nconst twoSegmentSmoothRun = [\n  { id: "s0", time: 0, pose: { x: 0 } },\n  { id: "s1", time: 1, transition: "smooth", pose: { x: 1 } },\n  { id: "s2", time: 2, transition: "smooth", pose: { x: 2 } },\n];\nconst smoothRunFirstHalf = sourceKeyframeEvaluationPlan(twoSegmentSmoothRun, 0.5);\nconst smoothRunSecondHalf = sourceKeyframeEvaluationPlan(twoSegmentSmoothRun, 1.5);\nnear(smoothRunFirstHalf.referenceProgress, 0.375, 0.000001);\nnear(smoothRunSecondHalf.referenceProgress, 0.625, 0.000001);\nassert.equal(smoothRunFirstHalf.hasSmoothBefore, false);\nassert.equal(smoothRunFirstHalf.hasSmoothAfter, true);\nassert.equal(smoothRunSecondHalf.hasSmoothBefore, true);\nassert.equal(smoothRunSecondHalf.hasSmoothAfter, false);\nnear(cameraReferenceProgress(0.5, "smooth", { hasSmoothAfter: true }), 0.375);\nnear(cameraReferenceProgress(0.5, "smooth", { hasSmoothBefore: true }), 0.625);\n\nconst threeSegmentSmoothRun = [\n  { id: "m0", time: 0, pose: { x: 0 } },\n  { id: "m1", time: 1, transition: "smooth", pose: { x: 1 } },\n  { id: "m2", time: 2, transition: "smooth", pose: { x: 2 } },\n  { id: "m3", time: 3, transition: "smooth", pose: { x: 3 } },\n];\nconst smoothRunMiddle = sourceKeyframeEvaluationPlan(threeSegmentSmoothRun, 1.5);\nnear(smoothRunMiddle.referenceProgress, 0.5, 0.000001);\nassert.equal(smoothRunMiddle.hasSmoothBefore, true);\nassert.equal(smoothRunMiddle.hasSmoothAfter, true);\nnear(cameraReferenceProgress(0.5, "smooth", { hasSmoothBefore: true, hasSmoothAfter: true }), 0.5);\nnear(cameraReferenceProgress(0.25, "smooth"), 0.125, 0.000001);\nnear(cameraReferenceProgress(0.25, "linear", { hasSmoothBefore: true, hasSmoothAfter: true }), 0.25, 0.000001);\n\nconst sourcePlanHold = sourceKeyframeEvaluationPlan(sourcePlanKeys, 3);\n'''
motion_test = replace_once(motion_test, old_source_plan_assertion, new_source_plan_assertion, "motion smooth-run tests")
motion_test_path.write_text(motion_test, encoding="utf-8")


# tests/reference-frame-ownership.test.cjs
ownership_path = Path("tests/reference-frame-ownership.test.cjs")
ownership = ownership_path.read_text(encoding="utf-8")
old_fixture_call = '''    plan.progress,\n    fallbackPose,\n    plan.end,\n  );\n}\n'''
new_fixture_call = '''    plan.progress,\n    fallbackPose,\n    plan.end,\n    sourceId === "camera" ? { referenceProgress: plan.referenceProgress } : null,\n  );\n}\n'''
ownership = replace_once(ownership, old_fixture_call, new_fixture_call, "fixture camera reference progress")

old_actor_test_tail = '''assert.deepEqual(actorAlmost.bodyPose, neutralPose, "actor pose must remain authored/held until destination");\n\n// Numerical fixture for the full authored-frame semantics used by both preview\n'''
new_actor_test_tail = '''assert.deepEqual(actorAlmost.bodyPose, neutralPose, "actor pose must remain authored/held until destination");\n\nconst smoothRunKeys = [\n  { id: "cam-run-0", time: 0, pose: { focal: 24, trackingTargetId: "actor-a" } },\n  { id: "cam-run-1", time: 1, transition: "smooth", pose: { focal: 47, trackingTargetId: "actor-a" } },\n  { id: "cam-run-2", time: 2, transition: "smooth", pose: { focal: 70, trackingTargetId: "actor-a" } },\n];\nconst firstRunPlan = motionCore.sourceKeyframeEvaluationPlan(smoothRunKeys, 0.5);\nconst secondRunPlan = motionCore.sourceKeyframeEvaluationPlan(smoothRunKeys, 1.5);\nconst firstRunFrame = fakeWindow.interpolatePoseFor(\n  {}, "camera", firstRunPlan.start.pose, firstRunPlan.end.pose, firstRunPlan.progress, {}, firstRunPlan.end,\n  { referenceProgress: firstRunPlan.referenceProgress },\n);\nconst secondRunFrame = fakeWindow.interpolatePoseFor(\n  {}, "camera", secondRunPlan.start.pose, secondRunPlan.end.pose, secondRunPlan.progress, {}, secondRunPlan.end,\n  { referenceProgress: secondRunPlan.referenceProgress },\n);\nassert.equal(firstRunFrame.evaluatedProgress, 0.375, "smooth run must ease in only at its outer start");\nassert.equal(secondRunFrame.evaluatedProgress, 0.625, "smooth run must ease out only at its outer end");\n\n// Numerical fixture for the full authored-frame semantics used by both preview\n'''
ownership = replace_once(ownership, old_actor_test_tail, new_actor_test_tail, "ownership smooth-run test")
ownership_path.write_text(ownership, encoding="utf-8")


# tests/reference-video-contract.test.cjs
contract_path = Path("tests/reference-video-contract.test.cjs")
contract = contract_path.read_text(encoding="utf-8")
old_contract = '''assert.ok(app.includes("return interpolatePoseFor(renderState, sourceId, plan.start.pose, plan.end.pose, plan.progress, fallbackPose, plan.end);"),\n  "render-state interpolation must reach the guarded pose evaluator through the core timing plan");\n'''
new_contract = '''assert.ok(app.includes("referenceProgress: plan.referenceProgress"),\n  "camera render-state interpolation must pass the motion-core smooth-run reference progress into the guarded evaluator");\nassert.match(app, /interpolatePoseFor\([\\s\\S]*?plan\\.progress,[\\s\\S]*?plan\\.end,[\\s\\S]*?evaluationOptions/,\n  "render-state interpolation must reach the guarded pose evaluator through the core timing plan and camera reference options");\n'''
contract = replace_once(contract, old_contract, new_contract, "reference video contract app call")

old_camera_contract = '''assert.ok(motion.includes("cameraReferenceProgress"),\n  "camera smooth timing must remain an explicit reference-video rule");\n'''
new_camera_contract = '''assert.ok(motion.includes("cameraReferenceProgress"),\n  "camera smooth timing must remain an explicit reference-video rule");\nassert.ok(motion.includes("hasSmoothBefore") && motion.includes("hasSmoothAfter"),\n  "camera smooth timing must distinguish run boundaries from interior keys");\n'''
contract = replace_once(contract, old_camera_contract, new_camera_contract, "reference smooth-run contract")
contract_path.write_text(contract, encoding="utf-8")

print("camera smooth-run continuity patch applied")
