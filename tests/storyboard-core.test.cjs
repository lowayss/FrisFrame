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

test("continuity report detects an axis crossing and screen-direction reversal", () => {
  const actor = (id, name, x) => ({
    id,
    continuityId: id,
    type: "actor",
    name,
    x,
    y: 0.5,
    facing: 90,
    visible: true,
    bodyPose: {},
  });
  const previous = {
    aspect: "16:9",
    camera: { x: 0.5, y: 0.3, panDeg: 180 },
    items: [actor("a", "수아", 0.4), actor("b", "민호", 0.6)],
  };
  const current = {
    aspect: "16:9",
    camera: { x: 0.5, y: 0.7, panDeg: 180 },
    items: [actor("a", "수아", 0.4), actor("b", "민호", 0.6)],
  };
  const report = core.continuityReport({
    previousCutId: "cut-1",
    previous,
    current,
    previousMotion: { a: { x: 0, y: 0.1 } },
    currentMotion: { a: { x: 0, y: -0.1 } },
  });

  assert.ok(report.some((finding) => finding.kind === "axis-180"));
  assert.ok(report.some((finding) => finding.kind === "screen-direction"));
});

test("continuity override only matches the same issue signature", () => {
  const finding = { id: "cut-1:aspect:scene", signature: "16:9|4:3" };
  const continuity = {
    overrides: {
      [finding.id]: { signature: finding.signature, note: "의도된 전환", updatedAt: "2026-07-16" },
    },
  };
  assert.equal(core.findingIsOverridden(finding, continuity), true);
  assert.equal(core.findingIsOverridden({ ...finding, signature: "16:9|1:1" }, continuity), false);
});

test("cut snapshots stay non-recursive and compare creative fields", () => {
  const cut = {
    id: "cut-1",
    title: "A안",
    action: "걷는다",
    notes: "오른손",
    shotType: "MS",
    status: "approved",
    snapshots: { A: { nested: true } },
    continuity: { overrides: {} },
    blocking: { camera: { focal: 35 }, motion: { duration: 4, keyframes: [{ id: "k1" }] } },
  };
  const snapshot = core.cutSnapshotDocument(cut);
  assert.equal("snapshots" in snapshot, false);
  assert.equal("continuity" in snapshot, false);
  assert.equal("status" in snapshot, false);
  const comparison = core.compareCutDocuments(snapshot, {
    ...snapshot,
    title: "B안",
    blocking: { ...snapshot.blocking, camera: { focal: 85 } },
  });
  assert.equal(comparison.find((row) => row.label === "컷 제목").changed, true);
  assert.equal(comparison.find((row) => row.label === "렌즈").changed, true);
});
