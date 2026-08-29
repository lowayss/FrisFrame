const assert = require("node:assert/strict");

const {
  buildReferencePromptGuide,
  normalizeReferencePromptPlatform,
  normalizeReferencePromptRole,
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
assert.equal(normalizeReferencePromptPlatform("unknown"), "seedance");
assert.ok(referencePromptPlatformNote("higgsfield").includes("플랫폼"));
assert.ok(referencePromptPlatformNote("runway").includes("모델별"));
assert.equal(normalizeReferencePromptRole("MOTION"), "motion");
assert.equal(normalizeReferencePromptRole("unknown"), "previs");
assert.ok(referencePromptRoleNote("previs").includes("공간 구조"));
assert.ok(referencePromptRoleNote("motion").includes("동작 순서"));

const seedance = buildReferencePromptGuide(entry, "seedance", { ...options, referenceRole: "previs" });
assert.ok(seedance.includes("SEEDANCE VIDEO-TO-VIDEO"));
assert.ok(seedance.includes("@video_1"));
assert.ok(seedance.includes("FrisFrame 3D previs MP4"));
assert.ok(seedance.includes("Master for spatial layout"));
assert.ok(seedance.includes(options.story));
assert.ok(seedance.includes(options.references));
assert.ok(seedance.includes("Primitive colors/shapes are blocking markers only"));

const higgsfield = buildReferencePromptGuide(entry, "higgsfield", { ...options, referenceRole: "motion" });
assert.ok(higgsfield.includes("HIGGSFIELD · SEEDANCE VIDEO-TO-VIDEO"));
assert.ok(higgsfield.includes("@video_1"));
assert.ok(higgsfield.includes("FrisFrame motion reference MP4"));
assert.ok(higgsfield.includes("motion sequence, speed, timing"));

const runway = buildReferencePromptGuide(entry, "runway", { ...options, referenceRole: "motion" });
assert.ok(runway.includes("RUNWAY REFERENCE STARTER"));
assert.ok(runway.includes("preserving its motion sequence"));
assert.ok(runway.includes("@Video 1"));

const writer = buildReferencePromptGuide(entry, "prompt-writer", options);
assert.ok(writer.includes("Write a 12.00-second Seedance video-to-video prompt"));
assert.ok(writer.includes("second-by-second"));
assert.ok(writer.includes("attached FrisFrame blocking MP4"));
assert.ok(writer.includes("SECOND-BY-SECOND TIMELINE"));

const source = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "reference-workflow-core.js"), "utf8");
assert.ok(source.includes('id = "referencePromptGuideBtn"'));
assert.ok(source.includes('button.textContent = "Reference Prompt"'));
assert.ok(source.includes('"3D 프리비즈 · 공간/카메라"'));
assert.ok(source.includes('"모션 레퍼런스 · 동작/타이밍"'));
assert.ok(source.includes("FrisFrame은 프롬프트를 AI로 생성하지 않습니다."));

console.log("reference-prompt-guide: deterministic platform prompt guidance passed");
