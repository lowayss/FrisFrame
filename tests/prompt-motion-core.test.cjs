const assert = require("node:assert/strict");

const {
  analyzePromptMotion,
  evaluatePromptMotion,
} = require("../prompt-motion-core.js");

const analysis = analyzePromptMotion("앞으로 걷다가 점점 빠르게 달린다.");
assert.equal(analysis.matched, true);
assert.equal(analysis.locomotion, true);
assert.equal(analysis.accelerate, true);
assert.equal(analysis.speedStart, 1.2);
assert.equal(analysis.speedEnd, 3.6);
assert.equal(analysis.poseMode, "locked");
assert.equal(analysis.translationOnly, true);
assert.match(analysis.summary, /속도 가속.*포즈 고정/);

const halfway = evaluatePromptMotion("앞으로 걷다가 점점 빠르게 달린다.", 2.5, 5, 0);
const finished = evaluatePromptMotion("앞으로 걷다가 점점 빠르게 달린다.", 5, 5, 0);
assert.ok(halfway.distanceMeters > 0);
assert.ok(finished.distanceMeters > halfway.distanceMeters);
assert.ok(finished.speed > halfway.speed);
assert.equal(halfway.poseMode, "locked");
assert.equal(halfway.translationOnly, true);
assert.equal("gaitPhase" in halfway, false);
assert.equal("poseMix" in halfway, false);
assert.equal(Math.round(finished.distanceMeters * 100) / 100, 12);

const backward = evaluatePromptMotion("뒤로 천천히 걷는다.", 2, 4, 90);
assert.ok(backward.yMeters < 0);
assert.ok(Math.abs(backward.xMeters) < 0.001);

const jump = evaluatePromptMotion("제자리에서 점프한다.", 1, 2, 0);
assert.ok(jump.verticalMeters > 0.7);
assert.equal(jump.poseMode, "locked");

const poseMotion = analyzePromptMotion("팔짱을 끼고 천천히 앞으로 이동한다.");
assert.equal(poseMotion.matched, true);
assert.equal(poseMotion.locomotion, true);
assert.equal(poseMotion.posePreset, "armsCrossed");
assert.equal(poseMotion.poseMode, "explicit");
assert.equal(poseMotion.translationOnly, false);
assert.match(poseMotion.summary, /팔짱 포즈/);
assert.equal(analyzePromptMotion("누워 있다가 천천히 일어난다.").posePreset, "neutral");

const poseHalfway = evaluatePromptMotion("팔짱을 끼고 앞으로 걷는다.", 1, 2, 0);
const poseFinished = evaluatePromptMotion("팔짱을 끼고 앞으로 걷는다.", 2, 2, 0);
assert.equal(poseHalfway.posePreset, "armsCrossed");
assert.equal(poseHalfway.poseMix, 0.5);
assert.equal(poseFinished.poseMix, 1);

const unknown = analyzePromptMotion("카메라를 바라본다.");
assert.equal(unknown.matched, false);

console.log("prompt-motion-core: prompt text drives deterministic local motion passed");
