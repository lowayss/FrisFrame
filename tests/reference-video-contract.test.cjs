const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (filename) => fs.readFileSync(path.join(root, filename), "utf8");

const app = read("app.js");
const html = read("index.html");
const motion = read("motion-core.js");
const runtime = read("previs-runtime-core.js");
const workflow = read("reference-workflow-core.js");
const timeline = read("timeline-core.js");
const server = read("server.py");
const maintenance = read("MAINTENANCE.md");

// motion-core owns reference frame semantics. The runtime adapter must load
// after it and before app.js, then patch the shared app evaluator only after
// app.js has declared that evaluator. Preview and export therefore inherit the
// same semantics without maintaining two motion engines.
const motionIndex = html.indexOf("./motion-core.js");
const runtimeIndex = html.indexOf("./previs-runtime-core.js");
const workflowIndex = html.indexOf("./reference-workflow-core.js");
const appIndex = html.indexOf("./app.js");
assert.ok(motionIndex >= 0 && runtimeIndex > motionIndex && workflowIndex > runtimeIndex && appIndex > workflowIndex,
  "motion core, runtime adapter, reference workflow, and app must load in dependency order");
assert.ok(runtime.includes("DOMContentLoaded"),
  "reference runtime must defer evaluator installation until app.js exists");
assert.ok(runtime.includes('require("./motion-core.js")'),
  "Node runtime must import the single reference evaluator owner");
assert.ok(runtime.includes("root?.FrisFrameMotionCore"),
  "browser runtime must reuse the already-loaded motion core");
assert.ok(runtime.includes("installReferenceFrameSemantics(root)"));
assert.ok(workflow.includes('require("./motion-core.js")'),
  "Node reference workflow must import the pure planning owner");
assert.ok(workflow.includes("root?.FrisFrameMotionCore"),
  "browser reference workflow must reuse the already-loaded motion core");
assert.ok(workflow.includes("installBatchReferenceExportUi(root)"),
  "supported multi-cut MP4 ZIP export must remain installed");
assert.equal(workflow.includes("installReferenceReadinessUi(root)"), false,
  "reference readiness must remain an internal MP4 safety policy, not a user-facing workflow step");
assert.equal(workflow.includes("installReferencePromptGuideUi(root)"), false,
  "final prompt composition must stay outside FrisFrame");
assert.equal(runtime.includes("exportReferenceVideoBatch"), false,
  "runtime adapter must not own reference batch export anymore");

// Every moving source receives arc-length remapping for free curves so the
// timeline does not accelerate near a control point.
assert.ok(motion.includes('options.constantSpeed !== false'),
  "free-curve arc-length remapping must be available to every moving source");
assert.ok(motion.includes("cameraReferenceProgress"),
  "camera smooth timing must remain an explicit reference-video rule");
assert.ok(motion.includes("hasSmoothBefore") && motion.includes("hasSmoothAfter"),
  "camera smooth timing must distinguish run boundaries from interior keys");
assert.ok(motion.includes("interpolateFocalLength"),
  "camera focal evaluation must remain continuous");
assert.ok(motion.includes("trackingTargetId = discreteAtDestination"),
  "tracking targets must switch only at authored destination keys");
assert.ok(motion.includes("heldActorBodyPose"),
  "actor body pose must remain held rather than gaining implicit secondary motion");
assert.ok(maintenance.includes("secondary motion은 자동 생성하지 않습니다"),
  "the no-implicit-actor-motion invariant must stay documented");

// Both interactive preview and MP4 export must flow through the shared pose
// evaluator that the motion-owned reference guard wraps.
assert.ok(app.includes("return interpolateSourceAtTimeFor(state, sourceId, time, fallbackPose);"),
  "interactive preview must use the shared source evaluator");
assert.ok(app.includes("const renderState = interpolateRenderStateAtTime(exportState, renderTime);"),
  "MP4 export must evaluate authored state at each render time");
assert.ok(app.includes("return interpolateRenderStateAtTime(state, time);"),
  "interactive preview must use the same render-state frame evaluator as MP4 export");
assert.ok(app.includes("window.FrisFrameMotionCore?.composeEvaluatedFrameBase"),
  "shared preview/export frame evaluation must delegate base assembly to motion-core");
assert.ok(motion.includes("function composeEvaluatedFrameBase"),
  "motion-core must own base frame assembly");
assert.ok(app.includes("referenceProgress: plan.referenceProgress"),
  "camera render-state interpolation must pass the motion-core smooth-run reference progress into the guarded evaluator");
assert.match(app, /const interpolationProgress = plan\.progress;/,
  "all moving sources must consume the authored linear motion progress");
assert.ok(app.includes("movementProgress: plan.progress"),
  "camera movement must stay linear even when reference semantics retain a separate fraction");
assert.ok(motion.includes("smoothRunReferenceProgress"),
  "motion-core must own smooth-run timing shared by camera and authored actor root motion");
assert.match(app, /interpolatePoseFor\([\s\S]*?interpolationProgress,[\s\S]*?plan\.end,[\s\S]*?evaluationOptions/,
  "render-state interpolation must reach the guarded pose evaluator through authored actor timing and camera reference options");
assert.ok(app.includes("window.FrisFrameMotionCore?.sourceKeyframeEvaluationPlan"),
  "the app source evaluator must delegate keyframe timing to motion-core");
assert.ok(motion.includes("function sourceKeyframeEvaluationPlan"),
  "motion-core must own source keyframe segment and progress planning");
assert.ok(app.includes("window.FrisFrameMotionCore?.composeBaseInterpolatedPose"),
  "the app evaluator must delegate base pose composition to motion-core");
assert.ok(motion.includes("function composeBaseInterpolatedPose"),
  "motion-core must own base pose composition");
assert.ok(app.includes("function drawThreeFreeCurveHandle("),
  "3D view must expose the selected free-curve control handle");
assert.ok(app.includes('kind: "freeCurveHandle"') && app.includes('kind: "freeCurve"'),
  "3D free-curve handles must have a dedicated drag interaction");
assert.ok(app.includes("function updateThreeFreeCurveDrag("),
  "3D free-curve dragging must update the authored control point");

// Keep exact-frame timeline storage precise enough for 24/60 FPS workflows.
assert.match(timeline, /const TIME_PRECISION = 6;/,
  "timeline storage precision must remain at six decimal places");

// CFR export samples authored state on the encoded FPS grid. The final frame
// occupies the final presentation interval; it must not be time-stretched to
// the exact range endpoint via frameCount - 1 interpolation.
assert.ok(app.includes("window.FrisFrameMotionCore?.referenceExportFrameSchedule"));
assert.ok(app.includes("const frameCount = frameSchedule.frameCount;"));
assert.ok(app.includes("const renderTime = frameSchedule.times[index];"));
assert.equal(app.includes("index / (frameCount - 1)"), false,
  "CFR reference export must not stretch sample spacing to force endpoint inclusion");
assert.ok(motion.includes("safeStart + index / safeFps"),
  "motion-core must schedule MP4 evaluation at exact CFR frame times");

// Seedance receives a broadly compatible CFR H.264 MP4 rather than a browser-
// specific codec/container variant.
assert.ok(server.includes('"-framerate"'));
assert.ok(server.includes('"libx264"'));
assert.ok(server.includes('"yuv420p"'));
assert.ok(server.includes('"+faststart"'));

console.log("reference-video-contract: motion-owned evaluator, internal readiness, actor restraint, timing, and MP4 pipeline passed");
