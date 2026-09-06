"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const boot = fs.readFileSync(path.join(root, "boot-errors.js"), "utf8");

function includesAll(source, needles, label) {
  needles.forEach((needle) => assert.ok(source.includes(needle), `${label}: missing ${needle}`));
}

includesAll(boot, [
  "initBirdseyeCadEditFlow",
  "data-cad-axis",
  "data-cad-toggle=\"snap\"",
  "cadSnapStep",
  "0.10",
  "0.25",
  "0.50",
  "1.00",
  "updateThreeEditorDrag",
  "transformGroupItemIds",
  "sourceEditLocked",
  "stageWorldSize",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "KeyQ",
  "KeyE",
], "CAD edit controls");

includesAll(boot, [
  "pollManagedProjectCommands",
  "managedProjectRevision",
  "setMasterPlan",
  "setMode(\"2.5d\")",
  ".fit()",
  "세트 마스터플랜을 2.5D 전체보기로 열었습니다.",
], "MCP master-plan auto-open");

assert.match(boot, /axisMode\s*===\s*"x"/);
assert.match(boot, /axisMode\s*===\s*"z"/);
assert.match(boot, /snapEnabled/);
assert.match(boot, /stepMeters/);
assert.match(boot, /rotateStepDeg/);
assert.match(boot, /stopImmediatePropagation\(\)/);

console.log("2.5D CAD edit flow contract passed");
