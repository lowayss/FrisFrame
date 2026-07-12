const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../storyboard-core.js");

test("scenario and storyboard text become matched scenes and cuts", () => {
  const result = core.buildStoryStructure({
    scenarioText: `INT. 카페 - 낮\n수아가 창가에서 기다린다.\n\nEXT. 골목 - 밤\n민호가 골목으로 뛰어든다.`,
    storyboardText: `INT. 카페 - 낮\n컷 1: 와이드\n액션: 수아가 창가에 앉아 있다.\n카메라: 천천히 밀고 들어간다.\n렌즈: 35mm\n길이: 4초\n\n컷 2: 클로즈업\n대사: 오늘은 올 거야.\n\nEXT. 골목 - 밤\n컷 1: 핸드헬드 미디엄\n액션: 민호가 프레임 안으로 달려온다.\n길이: 3.5초`,
  });

  assert.equal(result.scenes.length, 2);
  assert.equal(result.scenes[0].cuts.length, 2);
  assert.equal(result.scenes[0].cuts[0].focal, 35);
  assert.equal(result.scenes[0].cuts[0].duration, 4);
  assert.equal(result.scenes[0].cuts[0].notes, "");
  assert.equal(result.scenes[0].cuts[1].shotType, "클로즈업");
  assert.equal(result.scenes[1].cuts[0].duration, 3.5);
  assert.deepEqual(result.warnings, []);
});

test("plain storyboard paragraphs become editable cuts", () => {
  const result = core.buildStoryStructure({
    scenarioText: "장면 1\n두 사람이 마주 본다.",
    storyboardText: "와이드로 두 사람을 보여준다.\n\n수아의 얼굴로 들어간다.",
  });

  assert.equal(result.scenes[0].cuts.length, 2);
  assert.equal(result.scenes[0].cuts[0].action, "와이드로 두 사람을 보여준다.");
  assert.equal(result.scenes[0].cuts[1].action, "수아의 얼굴로 들어간다.");
});

test("unmatched storyboard sections produce a visible warning", () => {
  const result = core.buildStoryStructure({
    scenarioText: "씬 1\n첫 장면\n\n씬 2\n둘째 장면",
    storyboardText: "장면 9\n컷 1: 인서트\n액션: 시계를 보여준다.",
  });

  assert.equal(result.scenes[0].cuts[0].shotType, "인서트");
  assert.equal(result.warnings.length, 1);
});

test("legacy blocking becomes one project scene and cut without losing timing", () => {
  let id = 0;
  const project = core.wrapLegacyProject({
    version: 4,
    sceneTitle: "기존 작업",
    sceneIntent: "기존 의도",
    motion: { duration: 7, keyframes: [{ id: "key-1" }] },
  }, {
    idFactory: () => `id-${++id}`,
    now: "2026-07-11T00:00:00.000Z",
  });

  assert.equal(project.title, "기존 작업");
  assert.equal(project.scenes.length, 1);
  assert.equal(project.scenes[0].cuts.length, 1);
  assert.equal(project.scenes[0].cuts[0].blocking.motion.duration, 7);
  assert.equal(project.scenes[0].cuts[0].status, "blocking");
});
