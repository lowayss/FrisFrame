const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const ux = fs.readFileSync(path.join(root, "electron", "phone-motion-camera-ux.js"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const mcp = fs.readFileSync(path.join(root, "mcp_previs_server.py"), "utf8");

function makeRuntime(initialMode = "recording") {
  const listeners = [];
  const committed = [];
  const operator = { mode:initialMode, maintainTracking(){}, finish(){} };
  const context = {
    console,
    Math,
    Date,
    JSON,
    Object,
    Number,
    String,
    Array,
    setInterval() { return 1; },
    clearInterval() {},
    requestAnimationFrame(callback) { callback?.(); return 1; },
    localStorage: { getItem() { return "handheld"; }, setItem() {} },
    document: {
      documentElement: { dataset:{} },
      head: { appendChild() {} },
      createElement() { return { textContent:"" }; },
      getElementById() { return null; },
      querySelector() { return null; },
      querySelectorAll() { return []; },
    },
    state: {
      camera: { x:0.5,y:0.5,height:1.6,panDeg:20,tiltDeg:0,focal:35,trackingTargetId:"" },
      motion: { playhead:2,keyframes:[] },
    },
    evaluatedViewState: null,
    commit() { committed.push(JSON.parse(JSON.stringify(context.state))); },
  };
  context.window = {
    FrisFrameCameraOperator: operator,
    FrisFrameCameraOperatorInputs: { mode:"phone" },
    FrisFramePhoneMotionCore: {
      createAnchor() { return {}; },
      createPoseStabilizer() { return { update(value) { return value; } }; },
      derivePose() {
        return {
          x:0.54,y:0.49,height:1.72,panDeg:31,tiltDeg:3,focal:35,
          diagnostic:{
            trackingMode:"webxr",
            translationTrusted:true,
            translation:{truck:0.4,pedestal:0.12,dolly:0.8,confidence:0.92,metric:true,sourceUnits:"meters",outputUnits:"virtual-scene-meters"},
            stabilization:{heldTranslation:false},
          },
        };
      },
    },
    addEventListener(name, callback) { if (name === "frisframe:phone-remote-input") listeners.push(callback); },
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(ux, context, { filename:"phone-motion-camera-ux.js" });
  return { context, operator, listeners, committed };
}

function dispatchMotion(runtime, detail = {}) {
  const event = {
    detail:{ receivedAt:1000, motion:{ enabled:true,calibrationId:1 }, ...detail },
    stopImmediatePropagation(){},
  };
  runtime.listeners.forEach((listener) => listener(event));
}

test("Physical Camera metadata is gated to an actual Camera Operator finish commit", () => {
  assert.match(ux, /function isFinalOperatorCommit\(args\)/);
  assert.match(ux, /preservesCamera && \(pendingFinish \|\| timelineEnded\)/);
  assert.match(ux, /if \(isFinalOperatorCommit\(args\)\) finalizeTakeContextBeforeCommit\(\)/);
  assert.match(ux, /function installOperatorFinishHook\(\)/);
  assert.match(ux, /markTakeFinish\(\);\s*\n\s*return originalFinish/);
  assert.match(ux, /TAKE_HISTORY_LIMIT = 20/);
  assert.match(ux, /cameraOperatorTakes/);
  assert.match(ux, /latestCameraOperatorTakeId/);
});

test("unrelated camera commit during REC cannot finalize Physical Camera metadata", () => {
  const runtime = makeRuntime("recording");
  dispatchMotion(runtime);
  runtime.context.state.motion.playhead = 2.5;
  runtime.context.commit({ preserveSourceIds:["camera"] });

  assert.equal(runtime.committed.length, 1);
  assert.equal(runtime.committed[0].motion.cameraOperatorTakes, undefined);

  runtime.operator.finish();
  runtime.context.state.motion.playhead = 3.25;
  runtime.context.commit({ preserveSourceIds:["camera"] });

  assert.equal(runtime.committed.length, 2);
  const motion = runtime.committed[1].motion;
  assert.equal(motion.cameraOperatorTakes.length, 1);
  assert.equal(motion.latestCameraOperatorTakeId, motion.cameraOperatorTakes[0].id);
  const take = motion.cameraOperatorTakes[0];
  assert.equal(take.source, "physical-camera");
  assert.equal(take.tracking.mode, "webxr");
  assert.equal(take.tracking.metric, true);
  assert.equal(take.tracking.translation.units, "meters-local-space");
  assert.equal(take.tracking.confidence.average, 0.92);
  assert.equal(take.promptPolicy.metricDistanceAllowed, true);
  assert.match(take.promptSeed, /dolly in 0\.80 m/);
  assert.match(take.promptSeed, /Average tracking confidence 92%/);
});

test("phone REC transition preserves the real REC start time instead of first sensor packet time", () => {
  const runtime = makeRuntime("armed");
  runtime.context.state.motion.playhead = 1.5;
  dispatchMotion(runtime, { command:"toggle-record" });

  runtime.operator.mode = "recording";
  runtime.context.state.motion.playhead = 2.0;
  dispatchMotion(runtime);
  runtime.context.state.motion.playhead = 2.75;
  runtime.operator.finish();
  runtime.context.commit({ preserveSourceIds:["camera"] });

  const take = runtime.committed[0].motion.cameraOperatorTakes[0];
  assert.equal(take.startTime, 1.5);
  assert.equal(take.endTime, 2.75);
  assert.equal(take.duration, 1.25);
  assert.equal(take.camera.start.x, 0.5);
  assert.equal(take.camera.start.panDeg, 20);
});

test("take context records tracking semantics needed by downstream generation", () => {
  assert.match(ux, /source:"physical-camera"/);
  assert.match(ux, /stabilization:activeTake\.stabilization/);
  assert.match(ux, /heldTranslationSamples/);
  assert.match(ux, /metricSamples/);
  assert.match(ux, /visualSamples/);
  assert.match(ux, /confidence:\{/);
  assert.match(ux, /units:allMetric \? "meters-local-space" : "relative-virtual-travel"/);
  assert.match(ux, /promptSeed/);
  assert.match(ux, /finalPromptOwner:"mcp-client"/);
});

test("non-metric and mixed tracking cannot claim exact travel distance", () => {
  assert.match(ux, /mixed WebXR \/ Visual Flow non-metric tracking/);
  assert.match(ux, /Visual Flow non-metric tracking/);
  assert.match(ux, /metricDistanceAllowed:allMetric/);
  assert.match(ux, /do not infer or state an exact physical travel distance/);
  assert.match(ux, /WebXR values are measured local-space displacement relative to the recentered take origin/);
});

test("project normalization does not retire the take-context fields", () => {
  assert.doesNotMatch(app, /delete state\.motion\.cameraOperatorTakes/);
  assert.doesNotMatch(app, /delete state\.motion\.latestCameraOperatorTakeId/);
  assert.match(app, /state\.motion = state\.motion \|\| \{\}/);
});

test("existing MCP get_project remains the deterministic handoff for final prompt composition", () => {
  assert.match(mcp, /"name": "get_project"/);
  assert.match(mcp, /프로젝트 전체 상태와 revision을 읽습니다/);
  assert.match(mcp, /FrisFrame itself never calls\s*\n?an AI API/);
  assert.match(mcp, /if name == "get_project":\s*\n\s*return core\.handle_get_project/);
});