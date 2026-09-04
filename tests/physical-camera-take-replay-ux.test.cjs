"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const ux = fs.readFileSync(path.join(root, "electron", "camera-take-replay-ux.js"), "utf8");
const pathCore = require("../electron/camera-take-path-core.js");

function makeRuntime({withPath = true} = {}) {
  const commits = [];
  const draws = [];
  const raf = new Map();
  let rafId = 0;
  const archivedPath = pathCore.capturePath([
    {source:"camera",time:1,pose:{x:0.2,y:0.3,height:1.5,panDeg:10,tiltDeg:0,focal:35}},
    {source:"camera",time:2,pose:{x:0.5,y:0.6,height:1.8,panDeg:30,tiltDeg:6,focal:50}},
  ],1,2);
  const take = {
    id:"take-a",source:"physical-camera",startTime:1,endTime:2,duration:1,
    camera:{
      start:{x:0.2,y:0.3,height:1.5,panDeg:10,tiltDeg:0,focal:35},
      end:{x:0.5,y:0.6,height:1.8,panDeg:30,tiltDeg:6,focal:50},
    },
    ...(withPath ? {cameraPath:archivedPath} : {}),
  };
  const state = {
    camera:{x:0.9,y:0.9,height:2.2,panDeg:80,tiltDeg:12,focal:70,trackingTargetId:""},
    motion:{
      playhead:0.5,
      latestCameraOperatorTakeId:"take-a",
      selectedCameraOperatorTakeId:"take-a",
      cameraOperatorTakes:[take],
      keyframes:[
        {id:"before",source:"camera",time:0.5,pose:{x:0.1,y:0.1,height:1.4,panDeg:0,tiltDeg:0,focal:35}},
        {id:"old-a",source:"camera",time:1,pose:{x:0.7,y:0.7,height:2,panDeg:70,tiltDeg:5,focal:60}},
        {id:"actor",source:"actor",time:1.5,pose:{x:0.4,y:0.4}},
        {id:"old-b",source:"camera",time:2,pose:{x:0.8,y:0.8,height:2.1,panDeg:75,tiltDeg:8,focal:65}},
        {id:"after",source:"camera",time:3,pose:{x:0.9,y:0.9,height:2.2,panDeg:80,tiltDeg:12,focal:70}},
      ],
    },
  };
  const operator = {mode:"idle",maintainTracking(){}};
  const context = {
    console,JSON,Object,Array,Number,String,Math,Date,
    state,
    performance:{now(){return 0;}},
    setInterval(){return 1;},clearInterval(){},setTimeout(){return 1;},clearTimeout(){},
    requestAnimationFrame(callback){const id=++rafId;raf.set(id,callback);return id;},
    cancelAnimationFrame(id){raf.delete(id);},
    commit(options){commits.push({options:JSON.parse(JSON.stringify(options||{})),state:JSON.parse(JSON.stringify(state))});},
    captureSourceKeyframe(source,time){return {id:`new-${time}`,source,time,pose:JSON.parse(JSON.stringify(state.camera))};},
    sortKeyframes(values){return [...values].sort((a,b)=>Number(a.time)-Number(b.time));},
    syncCameraDerivedAim(){},
    clearLiveSourceEdit(){},
    setTimelineSelection(){},
    draw(value){draws.push(JSON.parse(JSON.stringify(value)));},
    interpolateStateAtTime(){return {camera:JSON.parse(JSON.stringify(state.camera)),motion:{playhead:state.motion.playhead}};},
    evaluatedViewState:null,
    viewMode:"2d",
    document:{
      documentElement:{dataset:{}},
      head:{appendChild(){}},
      querySelector(){return null;},
      createElement(){return {dataset:{},className:"",textContent:"",innerHTML:"",isConnected:false,classList:{toggle(){}},appendChild(){},append(){},addEventListener(){},insertAdjacentElement(){}};},
    },
    notifyApp(){},
  };
  context.window = {
    FrisFrameCameraTakePathCore:pathCore,
    FrisFrameCameraTakeBrowser:{effectiveTakeId:"take-a"},
    FrisFrameCameraOperator:operator,
    FrisFrameCameraOperatorVectorSplineCore:null,
  };
  context.globalThis=context;
  vm.createContext(context);
  vm.runInContext(ux, context, {filename:"camera-take-replay-ux.js"});
  return {context,state,take,operator,commits,draws,raf,api:context.window.FrisFrameCameraTakeReplay};
}

test("archive hook persists a matching Physical Camera path before the project commit", () => {
  const runtime = makeRuntime({withPath:false});
  runtime.state.motion.keyframes = [
    {source:"camera",time:1,pose:{x:0.2,y:0.3,height:1.5,panDeg:10,tiltDeg:0,focal:35}},
    {source:"camera",time:2,pose:{x:0.5,y:0.6,height:1.8,panDeg:30,tiltDeg:6,focal:50}},
  ];
  runtime.context.commit({preserveSourceIds:["camera"]});
  assert.equal(runtime.commits.length,1);
  const take = runtime.commits[0].state.motion.cameraOperatorTakes[0];
  assert.equal(take.cameraPath.keyframeCount,2);
  assert.equal(take.cameraPath.startTime,1);
  assert.equal(take.cameraPath.endTime,2);
  assert.ok(/^fnv1a-/.test(take.cameraPath.fingerprint));
});

test("archive hook refuses to attach a mismatched current timeline to a legacy Take", () => {
  const runtime = makeRuntime({withPath:false});
  assert.equal(runtime.api.archiveLatest(), false);
  assert.equal(runtime.take.cameraPath, undefined);
});

test("archived Take preview is render-only and never mutates authored camera or keyframes", () => {
  const runtime = makeRuntime();
  const beforeCamera = JSON.stringify(runtime.state.camera);
  const beforeKeys = JSON.stringify(runtime.state.motion.keyframes);
  assert.equal(runtime.api.previewTake("take-a"), true);
  const first = [...runtime.raf.entries()][0];
  runtime.raf.delete(first[0]);
  first[1](0);
  const second = [...runtime.raf.entries()][0];
  runtime.raf.delete(second[0]);
  second[1](500);
  assert.equal(JSON.stringify(runtime.state.camera), beforeCamera);
  assert.equal(JSON.stringify(runtime.state.motion.keyframes), beforeKeys);
  assert.equal(runtime.commits.length,0);
  assert.ok(runtime.draws.length >= 2);
  assert.equal(runtime.draws.at(-1).camera.x,0.35);
  assert.equal(runtime.draws.at(-1).camera.panDeg,20);
});

test("timeline apply replaces only camera keys inside the archived range and becomes a fingerprint match", () => {
  const runtime = makeRuntime();
  assert.equal(runtime.api.timelineMatchesTake("take-a"), false);
  assert.equal(runtime.api.applyTakePath("take-a"), true);
  assert.equal(runtime.commits.length,1);
  assert.deepEqual(runtime.commits[0].options,{preserveSourceIds:["camera"]});
  const ids = runtime.state.motion.keyframes.map((key)=>key.id);
  assert.ok(ids.includes("before"));
  assert.ok(ids.includes("actor"));
  assert.ok(ids.includes("after"));
  assert.ok(!ids.includes("old-a"));
  assert.ok(!ids.includes("old-b"));
  assert.ok(ids.includes("new-1"));
  assert.ok(ids.includes("new-2"));
  assert.equal(runtime.state.motion.playhead,2);
  assert.equal(runtime.state.camera.x,0.5);
  assert.equal(runtime.state.camera.panDeg,30);
  assert.equal(runtime.api.timelineMatchesTake("take-a"),true);
});

test("legacy Take without archived path remains selectable but replay and apply stay disabled at API level", () => {
  const runtime = makeRuntime({withPath:false});
  assert.equal(runtime.api.previewTake("take-a"),false);
  assert.equal(runtime.api.applyTakePath("take-a"),false);
  assert.equal(runtime.api.timelineMatchesTake("take-a"),false);
  assert.equal(runtime.commits.length,0);
});

test("replay UX states explicitly that preview is non-destructive and apply is explicit", () => {
  assert.match(ux,/미리보기는 비파괴/);
  assert.match(ux,/타임라인 적용/);
  assert.match(ux,/TIMELINE MATCH/);
  assert.match(ux,/TIMELINE DIFF/);
  assert.match(ux,/cameraPath/);
  assert.doesNotMatch(ux,/\bfetch\s*\(|XMLHttpRequest|axios\b/);
});
