#!/usr/bin/env python3
from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one anchor, found {count}")
    return text.replace(old, new, 1)


motion_path = Path("motion-core.js")
motion = motion_path.read_text(encoding="utf-8")

old_progress = '''  function cameraReferenceProgress(progress, transition = "smooth", options = {}) {\n    const t = clamp(progress, 0, 1);\n    if (String(transition || "smooth") !== "smooth") return t;\n    const hasSmoothBefore = options?.hasSmoothBefore === true;\n    const hasSmoothAfter = options?.hasSmoothAfter === true;\n    if (hasSmoothBefore && hasSmoothAfter) return t;\n    if (hasSmoothBefore) return smoothReferenceEaseOutProgress(t);\n    if (hasSmoothAfter) return smoothReferenceEaseInProgress(t);\n    return smoothReferenceProgress(t);\n  }\n'''
new_progress = '''  function smoothRunReferenceProgress(progress, transition = "smooth", options = {}) {\n    const t = clamp(progress, 0, 1);\n    if (String(transition || "smooth") !== "smooth") return t;\n    const hasSmoothBefore = options?.hasSmoothBefore === true;\n    const hasSmoothAfter = options?.hasSmoothAfter === true;\n    if (hasSmoothBefore && hasSmoothAfter) return t;\n    if (hasSmoothBefore) return smoothReferenceEaseOutProgress(t);\n    if (hasSmoothAfter) return smoothReferenceEaseInProgress(t);\n    return smoothReferenceProgress(t);\n  }\n\n  function cameraReferenceProgress(progress, transition = "smooth", options = {}) {\n    return smoothRunReferenceProgress(progress, transition, options);\n  }\n'''
motion = replace_once(motion, old_progress, new_progress, "generic smooth-run progress")

old_plan_call = '''    const referenceProgress = transition === "smooth"\n      ? cameraReferenceProgress(rawProgress, transition, { hasSmoothBefore, hasSmoothAfter })\n      : progress;\n'''
new_plan_call = '''    const referenceProgress = transition === "smooth"\n      ? smoothRunReferenceProgress(rawProgress, transition, { hasSmoothBefore, hasSmoothAfter })\n      : progress;\n'''
motion = replace_once(motion, old_plan_call, new_plan_call, "source plan generic smooth progress")

old_comment = '''    // Spatial blocking crosses ordinary keys without braking. Camera reference\n    // easing is planned separately so a run of smooth camera keys does not\n    // decelerate to zero at every interior marker.\n'''
new_comment = '''    // Spatial blocking crosses ordinary keys without braking. Reference\n    // smooth-run timing is planned separately so camera movement and authored\n    // actor root motion can ease at run boundaries without stopping at every\n    // interior marker.\n'''
motion = replace_once(motion, old_comment, new_comment, "source plan comment")

old_export = '''    smoothReferenceProgress,\n    sourceKeyframeEvaluationPlan,\n'''
new_export = '''    smoothReferenceProgress,\n    smoothRunReferenceProgress,\n    sourceKeyframeEvaluationPlan,\n'''
motion = replace_once(motion, old_export, new_export, "motion export")
motion_path.write_text(motion, encoding="utf-8")


app_path = Path("app.js")
app = app_path.read_text(encoding="utf-8")
old_app = '''  const evaluationOptions = sourceId === "camera"\n    ? { referenceProgress: plan.referenceProgress }\n    : null;\n  return interpolatePoseFor(\n    renderState,\n    sourceId,\n    plan.start.pose,\n    plan.end.pose,\n    plan.progress,\n'''
new_app = '''  const interpolationProgress = sourceId !== "camera" && fallbackPose?.type === "actor"\n    ? plan.referenceProgress\n    : plan.progress;\n  const evaluationOptions = sourceId === "camera"\n    ? { referenceProgress: plan.referenceProgress }\n    : null;\n  return interpolatePoseFor(\n    renderState,\n    sourceId,\n    plan.start.pose,\n    plan.end.pose,\n    interpolationProgress,\n'''
app = replace_once(app, old_app, new_app, "actor interpolation progress")
app_path.write_text(app, encoding="utf-8")


motion_test_path = Path("tests/motion-core.test.cjs")
motion_test = motion_test_path.read_text(encoding="utf-8")
old_import = '''  sourceKeyframeEvaluationPlan,\n  transitionProgress,\n'''
new_import = '''  smoothRunReferenceProgress,\n  sourceKeyframeEvaluationPlan,\n  transitionProgress,\n'''
motion_test = replace_once(motion_test, old_import, new_import, "motion test generic progress import")
old_assert = '''near(cameraReferenceProgress(0.25, "smooth"), 0.125, 0.000001);\nnear(cameraReferenceProgress(0.25, "linear", { hasSmoothBefore: true, hasSmoothAfter: true }), 0.25, 0.000001);\n\nconst sourcePlanHold = sourceKeyframeEvaluationPlan(sourcePlanKeys, 3);\n'''
new_assert = '''near(cameraReferenceProgress(0.25, "smooth"), 0.125, 0.000001);\nnear(cameraReferenceProgress(0.25, "linear", { hasSmoothBefore: true, hasSmoothAfter: true }), 0.25, 0.000001);\nnear(smoothRunReferenceProgress(0.25, "smooth"), 0.125, 0.000001);\nnear(smoothRunReferenceProgress(0.25, "linear"), 0.25, 0.000001);\n\nconst actorSmoothPlan = sourceKeyframeEvaluationPlan([\n  { id: "a0", time: 0, pose: { x: 0 } },\n  { id: "a1", time: 2, transition: "smooth", pose: { x: 1 } },\n], 0.5);\nconst actorLinearPlan = sourceKeyframeEvaluationPlan([\n  { id: "l0", time: 0, pose: { x: 0 } },\n  { id: "l1", time: 2, transition: "linear", pose: { x: 1 } },\n], 0.5);\nnear(actorSmoothPlan.referenceProgress, 0.125, 0.000001);\nnear(actorLinearPlan.referenceProgress, 0.25, 0.000001);\n\nconst sourcePlanHold = sourceKeyframeEvaluationPlan(sourcePlanKeys, 3);\n'''
motion_test = replace_once(motion_test, old_assert, new_assert, "actor smooth vs linear planner test")
motion_test_path.write_text(motion_test, encoding="utf-8")


ownership_path = Path("tests/reference-frame-ownership.test.cjs")
ownership = ownership_path.read_text(encoding="utf-8")
old_fixture = '''  return fixtureWindow.interpolatePoseFor(\n    renderState,\n    sourceId,\n    plan.start.pose,\n    plan.end.pose,\n    plan.progress,\n    fallbackPose,\n    plan.end,\n    sourceId === "camera" ? { referenceProgress: plan.referenceProgress } : null,\n  );\n}\n'''
new_fixture = '''  const interpolationProgress = sourceId !== "camera" && fallbackPose?.type === "actor"\n    ? plan.referenceProgress\n    : plan.progress;\n  return fixtureWindow.interpolatePoseFor(\n    renderState,\n    sourceId,\n    plan.start.pose,\n    plan.end.pose,\n    interpolationProgress,\n    fallbackPose,\n    plan.end,\n    sourceId === "camera" ? { referenceProgress: plan.referenceProgress } : null,\n  );\n}\n'''
ownership = replace_once(ownership, old_fixture, new_fixture, "ownership fixture actor smooth timing")

old_expected = '''near(quarterFrame.items[0].x, 0.3);\nnear(quarterFrame.items[0].y, 0.55);\nnear(quarterFrame.items[0].verticalOffset, 0.25);\nnear(quarterFrame.items[0].facing, 22.5);\nassert.deepEqual(quarterFrame.items[0].bodyPose, neutralPose, "actor pose must stay held during root motion");\n'''
new_expected = '''near(quarterFrame.items[0].x, 0.25);\nnear(quarterFrame.items[0].y, 0.525);\nnear(quarterFrame.items[0].verticalOffset, 0.125);\nnear(quarterFrame.items[0].facing, 11.25);\nassert.deepEqual(quarterFrame.items[0].bodyPose, neutralPose, "actor pose must stay held during eased root motion");\n'''
ownership = replace_once(ownership, old_expected, new_expected, "ownership actor quarter expectations")

old_prearrival = '''assert.deepEqual(preArrivalFrame.items[0].bodyPose, neutralPose, "actor pose must not switch before the destination key");\nconst destinationFrame = fixtureFrame(2);\n'''
new_prearrival = '''assert.deepEqual(preArrivalFrame.items[0].bodyPose, neutralPose, "actor pose must not switch before the destination key");\n\nconst actorRunKeys = [\n  { id: "actor-run-0", time: 0, pose: { x: 0, bodyPose: neutralPose } },\n  { id: "actor-run-1", time: 1, transition: "smooth", pose: { x: 1, bodyPose: neutralPose } },\n  { id: "actor-run-2", time: 2, transition: "smooth", pose: { x: 2, bodyPose: raisedPose } },\n];\nconst actorRunFirst = motionCore.sourceKeyframeEvaluationPlan(actorRunKeys, 0.5);\nconst actorRunSecond = motionCore.sourceKeyframeEvaluationPlan(actorRunKeys, 1.5);\nnear(actorRunFirst.referenceProgress, 0.375);\nnear(actorRunSecond.referenceProgress, 0.625);\nconst heldDuringSecondRun = fakeWindow.interpolatePoseFor(\n  {},\n  "actor-1",\n  actorRunSecond.start.pose,\n  actorRunSecond.end.pose,\n  actorRunSecond.referenceProgress,\n  { type: "actor" },\n  actorRunSecond.end,\n);\nassert.deepEqual(heldDuringSecondRun.bodyPose, neutralPose, "actor smooth root timing must not blend or synthesize body motion");\n\nconst destinationFrame = fixtureFrame(2);\n'''
ownership = replace_once(ownership, old_prearrival, new_prearrival, "ownership actor run hold test")
ownership_path.write_text(ownership, encoding="utf-8")


contract_path = Path("tests/reference-video-contract.test.cjs")
contract = contract_path.read_text(encoding="utf-8")
old_contract = '''assert.ok(app.includes("referenceProgress: plan.referenceProgress"),\n  "camera render-state interpolation must pass the motion-core smooth-run reference progress into the guarded evaluator");\n'''
new_contract = '''assert.ok(app.includes("referenceProgress: plan.referenceProgress"),\n  "camera render-state interpolation must pass the motion-core smooth-run reference progress into the guarded evaluator");\nassert.ok(app.includes('fallbackPose?.type === "actor"') && app.includes("? plan.referenceProgress"),\n  "authored actor root motion must consume smooth-run timing without adding secondary motion");\nassert.ok(motion.includes("smoothRunReferenceProgress"),\n  "motion-core must own smooth-run timing shared by camera and authored actor root motion");\n'''
contract = replace_once(contract, old_contract, new_contract, "actor smooth reference contract")
contract_path.write_text(contract, encoding="utf-8")

print("actor smooth root timing patch applied")
