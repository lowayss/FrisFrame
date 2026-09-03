const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const ux = fs.readFileSync(path.join(root, "electron", "phone-motion-camera-ux.js"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const mcp = fs.readFileSync(path.join(root, "mcp_previs_server.py"), "utf8");

test("Physical Camera persists successful take context in the same Camera Operator commit", () => {
  assert.match(ux, /function finalizeTakeContextBeforeCommit\(\)/);
  assert.match(ux, /cameraOperatorTakes/);
  assert.match(ux, /latestCameraOperatorTakeId/);
  assert.match(ux, /TAKE_HISTORY_LIMIT = 20/);
  assert.match(ux, /finalizeTakeContextBeforeCommit\(\);\s*\n\s*return originalCommit/);
  assert.match(ux, /commit = wrappedCommit/);
  assert.match(ux, /if \(activeTake && operator\(\)\?\.mode === "idle"\) activeTake = null/);
});

test("runtime commit contains metric Physical Camera context before the original commit executes", () => {
  const listeners = [];
  const committed = [];
  const operator = { mode:"recording", maintainTracking(){} };
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
    localStorage: { getItem() { return "handheld"; }, setItem() {} },
    document: {
      documentElement: { dataset:{} },
      head: { appendChild() {} },
      createElement() { return { textContent:"" }; },
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

  const event = { detail:{ receivedAt:1000, motion:{ enabled:true,calibrationId:1 } }, stopImmediatePropagation(){} };
  listeners.forEach((listener) => listener(event));
  context.state.motion.playhead = 3.25;
  context.commit({ preserveSourceIds:["camera"] });

  assert.equal(committed.length, 1);
  const motion = committed[0].motion;
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

test("project normalization does not retire the new take-context fields", () => {
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
