const assert = require("node:assert/strict");

const {
  buildReferencePromptGuide,
  normalizeReferencePromptModel,
  normalizeReferencePromptOutput,
  normalizeReferencePromptPlatform,
  normalizeReferencePromptRole,
  referencePromptModelNote,
  referencePromptPlatformNote,
  referencePromptRoleNote,
} = require("../reference-workflow-core.js");

const entry = {
  sceneNumber: 2,
  cutNumber: 3,
  title: "Roof Push",
  duration: 12,
  fps: 24,
  blocking: { motion: { duration: 12, fps: 24, keyframes: [] } },
};
const options = {
  story: "주인공이 앞으로 걸어가다 마지막에 멈춘다.",
  references: "@char_main = 주인공 / @loc_main = 옥상",
  style: "현대 도쿄 저녁, 사실적 영화 질감",
  audio: "SFX: 바람과 멀리 들리는 도시 소음",
};

assert.equal(normalizeReferencePromptPlatform("RUNWAY"), "runway");
assert.equal(normalizeReferencePromptPlatform("unknown"), "generic");
assert.equal(normalizeReferencePromptModel("SEEDANCE-2.5"), "seedance-2.5");
assert.equal(normalizeReferencePromptModel("unknown"), "seedance-2.5");
assert.equal(normalizeReferencePromptOutput("PROMPT-WRITER"), "prompt-writer");
assert.ok(referencePromptPlatformNote("higgsfield").includes("플랫폼"));
assert.ok(referencePromptPlatformNote("runway").includes("Seedance 2.5"));
assert.ok(referencePromptModelNote("seedance-2.5").includes("ByteDance"));
assert.ok(referencePromptModelNote("aleph-2.0").includes("Runway"));
assert.equal(normalizeReferencePromptRole("MOTION"), "motion");
assert.equal(normalizeReferencePromptRole("unknown"), "previs");
assert.ok(referencePromptRoleNote("previs").includes("공간 구조"));
assert.ok(referencePromptRoleNote("motion").includes("동작 순서"));

const seedance = buildReferencePromptGuide(entry, "higgsfield", { ...options, model: "seedance-2.5", outputMode: "final", referenceRole: "previs" });
assert.ok(seedance.includes("HIGGSFIELD · SEEDANCE 2.5"));
assert.ok(seedance.includes("@video_1"));
assert.ok(seedance.includes("FrisFrame 3D previs MP4"));
assert.ok(seedance.includes("Master for spatial layout"));
assert.ok(seedance.includes(options.story));
assert.ok(seedance.includes(options.references));
assert.ok(seedance.includes("Primitive colors/shapes are blocking markers only"));

const runwaySeedance = buildReferencePromptGuide(entry, "runway", { ...options, model: "seedance-2.5", referenceRole: "motion" });
assert.ok(runwaySeedance.includes("RUNWAY · SEEDANCE 2.5"));
assert.ok(runwaySeedance.includes("FrisFrame motion reference MP4"));

const aleph = buildReferencePromptGuide(entry, "runway", { ...options, model: "aleph-2.0", referenceRole: "motion" });
assert.ok(aleph.includes("RUNWAY · ALEPH 2.0"));
assert.ok(aleph.includes("preserving its motion sequence"));

const writer = buildReferencePromptGuide(entry, "higgsfield", { ...options, model: "seedance-2.5", outputMode: "prompt-writer", referenceRole: "previs" });
assert.ok(writer.includes("PLATFORM: HIGGSFIELD"));
assert.ok(writer.includes("MODEL: SEEDANCE 2.5"));
assert.ok(writer.includes("Write a 12.00-second SEEDANCE 2.5 reference-video prompt"));

const source = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "reference-workflow-core.js"), "utf8");
assert.ok(source.includes('id = "referencePromptGuideBtn"'));
assert.ok(source.includes('button.textContent = "Reference Prompt"'));
assert.ok(source.includes('"Higgsfield"'));
assert.ok(source.includes('"Runway"'));
assert.ok(source.includes('"Seedance 2.5 · ByteDance"'));
assert.ok(source.includes('"Aleph 2.0 · Runway"'));
assert.ok(source.includes('"3D 프리비즈 · 공간/카메라"'));
assert.ok(source.includes('"모션 레퍼런스 · 동작/타이밍"'));
assert.ok(source.includes("FrisFrame은 프롬프트를 AI로 생성하지 않습니다."));

console.log("reference-prompt-guide: deterministic platform prompt guidance passed");
