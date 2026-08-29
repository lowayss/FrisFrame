const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (filename) => fs.readFileSync(path.join(root, filename), "utf8");

const app = read("app.js");
const html = read("index.html");
const motion = read("motion-core.js");
const runtime = read("previs-runtime-core.js");
const timeline = read("timeline-core.js");
const server = read("server.py");
const maintenance = read("MAINTENANCE.md");

// motion-core owns reference frame semantics. The runtime adapter must load
// after it and before app.js, then patch the shared app evaluator only after
// app.js has declared that evaluator. Preview and export therefore inherit the
// same semantics without maintaining two motion engines.
const motionIndex = html.indexOf("./motion-core.js");
const runtimeIndex = html.indexOf("./previs-runtime-core.js");
const appIndex = html.indexOf("./app.js");
assert.ok(motionIndex >= 0 && runtimeIndex > motionIndex && appIndex > runtimeIndex,
  "motion core must own reference semantics before the runtime adapter and app load");
assert.ok(runtime.includes("DOMContentLoaded"),
  "reference runtime must defer evaluator installation until app.js exists");
assert.ok(runtime.includes('require("./motion-core.js")'),
  "Node runtime must import the single reference evaluator owner");
assert.ok(runtime.includes("root?.FrisFrameMotionCore"),
  "browser runtime must reuse the already-loaded motion core");
assert.ok(runtime.includes("installReferenceFrameSemantics(root)"));

// Camera reference motion is deliberately more constrained than actor motion.
assert.ok(motion.includes('sourceType === "camera" && options.constantSpeed !== false'),
  "free-curve arc-length remapping must stay camera-only");
assert.ok(motion.includes("cameraReferenceProgress"),
  "camera smooth timing must remain an explicit reference-video rule");
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
assert.ok(app.includes("return interpolatePoseFor(renderState, sourceId, start.pose, end.pose, progress, fallbackPose, end);"),
  "render-state interpolation must reach the guarded pose evaluator");

// Keep exact-frame timeline storage precise enough for 24/60 FPS workflows.
assert.match(timeline, /const TIME_PRECISION = 6;/,
  "timeline storage precision must remain at six decimal places");

// Export intentionally includes both authored endpoints in the requested frame
// count. If this policy changes, it needs a deliberate reference-video review.
assert.ok(app.includes("const frameCount = Math.max(2, Math.round(exportDuration * fps));"));
assert.ok(app.includes("const progress = frameCount <= 1 ? 0 : index / (frameCount - 1);"));
assert.ok(app.includes("const renderTime = exportRange.start + progress * exportDuration;"));

// Seedance receives a broadly compatible CFR H.264 MP4 rather than a browser-
// specific codec/container variant.
assert.ok(server.includes('"-framerate"'));
assert.ok(server.includes('"libx264"'));
assert.ok(server.includes('"yuv420p"'));
assert.ok(server.includes('"+faststart"'));

console.log("reference-video-contract: motion-owned evaluator, actor restraint, timing, and MP4 pipeline passed");
