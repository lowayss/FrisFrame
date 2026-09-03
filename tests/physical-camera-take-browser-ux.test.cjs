"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const ux = fs.readFileSync(path.join(root, "electron", "camera-take-browser-ux.js"), "utf8");

function makeRuntime(mode = "idle") {
  const commits = [];
  const clipboard = [];
  const state = {
    camera:{ x:0.5,y:0.5,height:1.6,panDeg:20,tiltDeg:0,focal:35 },
    motion:{
      latestCameraOperatorTakeId:"take-new",
      keyframes:[{ id:"camera-1",source:"camera",time:0,pose:{x:0.5,y:0.5} }],
      cameraOperatorTakes:[
        {
          id:"take-old",source:"physical-camera",duration:1.2,stabilization:"cinema",
          tracking:{mode:"webxr",metric:true,samples:100,heldTranslationSamples:5,confidence:{average:0.94}},
          promptSeed:"metric take seed",promptPolicy:{metricDistanceAllowed:true},
        },
        {
          id:"take-new",source:"physical-camera",duration:2.1,stabilization:"handheld",
          tracking:{mode:"visual-flow",metric:false,samples:80,heldTranslationSamples:20,confidence:{average:0.72}},
          promptSeed:"visual take seed",promptPolicy:{metricDistanceAllowed:false},
        },
      ],
    },
  };
  const operator = { mode };
  const context = {
    console,
    JSON,
    Object,
    Array,
    Number,
    String,
    Math,
    state,
    setInterval(){ return 1; },
    clearInterval(){},
    commit(options) {
      commits.push({ options:JSON.parse(JSON.stringify(options || {})), state:JSON.parse(JSON.stringify(state)) });
    },
    notifyApp(){},
    navigator:{ clipboard:{ async writeText(value){ clipboard.push(String(value)); } } },
    document:{
      documentElement:{ dataset:{} },
      head:{ appendChild(){} },
      createElement(){ return { textContent:"", className:"", dataset:{}, classList:{ add(){},toggle(){} } }; },
      querySelector(){ return null; },
    },
  };
  context.window = { FrisFrameCameraOperator:operator };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(ux, context, { filename:"camera-take-browser-ux.js" });
  return { context, state, operator, commits, clipboard, api:context.window.FrisFrameCameraTakeBrowser };
}

test("Physical Camera AI selection is separate from chronological latest Take", () => {
  const runtime = makeRuntime();
  const beforeTakes = JSON.stringify(runtime.state.motion.cameraOperatorTakes);
  const beforeKeys = JSON.stringify(runtime.state.motion.keyframes);

  assert.equal(runtime.api.selectedTakeId, null);
  assert.equal(runtime.api.latestTakeId, "take-new");
  assert.equal(runtime.api.effectiveTakeId, "take-new", "latest Take must be the default when no explicit AI selection exists");

  assert.equal(runtime.api.selectTake("take-old"), true);
  assert.equal(runtime.state.motion.selectedCameraOperatorTakeId, "take-old");
  assert.equal(runtime.state.motion.latestCameraOperatorTakeId, "take-new", "AI selection must never rewrite latest chronology");
  assert.equal(JSON.stringify(runtime.state.motion.cameraOperatorTakes), beforeTakes, "AI selection must not rewrite Take history");
  assert.equal(JSON.stringify(runtime.state.motion.keyframes), beforeKeys, "AI selection must not rewrite camera keyframes");
  assert.equal(runtime.api.selectedTakeId, "take-old");
  assert.equal(runtime.api.effectiveTakeId, "take-old");
  assert.equal(runtime.commits.length, 1);
  assert.deepEqual(runtime.commits[0].options, { preserveSourceIds:["camera"] });

  assert.equal(runtime.api.clearSelection(), true);
  assert.equal(runtime.state.motion.selectedCameraOperatorTakeId, undefined);
  assert.equal(runtime.api.selectedTakeId, null);
  assert.equal(runtime.api.effectiveTakeId, "take-new");
  assert.equal(runtime.commits.length, 2);
});

test("Take selection rejects stale IDs and is locked during an active Camera Operator Take", () => {
  const runtime = makeRuntime("recording");
  assert.equal(runtime.api.selectTake("take-old"), false);
  assert.equal(runtime.api.clearSelection(), false);
  assert.equal(runtime.commits.length, 0);
  assert.equal(runtime.state.motion.selectedCameraOperatorTakeId, undefined);

  runtime.operator.mode = "idle";
  assert.equal(runtime.api.selectTake("missing"), false);
  assert.equal(runtime.commits.length, 0);
});

test("MCP copy payload keeps prompt policy and explicit take_id without calling a network API", async () => {
  const runtime = makeRuntime();
  assert.equal(await runtime.api.copyTakeInfo("take-old"), true);
  assert.equal(runtime.clipboard.length, 1);
  const payload = JSON.parse(runtime.clipboard[0]);
  assert.equal(payload.tool, "get_camera_take_context");
  assert.deepEqual(payload.arguments, { take_id:"take-old" });
  assert.equal(payload.tracking.metric, true);
  assert.equal(payload.prompt_seed, "metric take seed");
  assert.equal(payload.prompt_policy.metricDistanceAllowed, true);
  assert.doesNotMatch(ux, /\bfetch\s*\(|XMLHttpRequest|axios\b/, "Take browser must not call an external AI/network API");
});

test("desktop Take Browser exposes explicit AI selection, latest-auto fallback and MCP copy affordances", () => {
  assert.match(ux, /selectedCameraOperatorTakeId/);
  assert.match(ux, /latestCameraOperatorTakeId/);
  assert.match(ux, /AI 사용/);
  assert.match(ux, /AI SELECTED/);
  assert.match(ux, /AI AUTO/);
  assert.match(ux, /최신 자동/);
  assert.match(ux, /MCP 정보 복사/);
  assert.match(ux, /get_camera_take_context/);
  assert.match(ux, /navigator\.clipboard\.writeText/);
  assert.match(ux, /operator\(\)\?\.mode && operator\(\)\.mode !== "idle"/);
  assert.match(ux, /DISPLAY_LIMIT = 5/);
});
