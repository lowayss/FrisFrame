const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const manualGuideCore = require("../manual-guide-core.js");
const { buildTutorialSteps } = manualGuideCore;

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const manualSource = fs.readFileSync(path.join(root, "manual-guide-core.js"), "utf8");
const steps = buildTutorialSteps("FrisFrame Test");

assert.deepEqual(Object.keys(manualGuideCore), ["buildTutorialSteps"],
  "manual guide core must not own reference export/readiness policy");
assert.equal(manualSource.includes("exportReferenceBatchSafely"), false);
assert.equal(manualSource.includes("partitionReferenceBatchByReadiness"), false);

assert.equal(steps.length, 12);
assert.equal(steps[0].title, "FrisFrame Test 시작하기");
assert.match(steps.at(-1).body, /프리비즈 검토/);

for (const step of steps) {
  assert.ok(step.title && step.body && step.tryText, `incomplete tutorial step: ${step.title || "unknown"}`);
  for (const selectorKey of ["selector", "fallbackSelector"]) {
    const selector = step[selectorKey];
    if (!selector?.startsWith("#")) continue;
    assert.match(html, new RegExp(`id=["']${selector.slice(1)}["']`), `missing tutorial target ${selector}`);
  }
}

const joined = JSON.stringify(steps);
assert.equal(joined.includes("에펙식"), false);
assert.equal(joined.includes("포커스 100%"), false);
assert.match(joined, /이동·회전·포즈 모드/,
  "3D tutorial must match the current move/rotate/pose editor modes");
assert.match(joined, /V로 2D·3D/,
  "tutorial must surface the fast blocking-view toggle");
assert.match(joined, /Esc로 취소/,
  "tutorial must surface direct-edit cancellation");
assert.match(joined, /L로 선택 대상을 잠가/,
  "tutorial must surface contextual locking");
assert.match(joined, /Seedance Video Reference/,
  "export tutorial must explain the supported downstream previs-video role");
assert.equal(joined.includes("카메라 영상을 먼저 프리뷰"), false,
  "tutorial must not use the retired ambiguous camera-video export wording");

console.log("manual-guide-core: current tutorial workflow and target contract passed");
