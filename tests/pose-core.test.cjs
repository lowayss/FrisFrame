const assert = require("node:assert/strict");
const {
  JOINT_DEFINITIONS,
  PRESET_CATEGORIES,
  PRESET_LABELS,
  defaultBodyPose,
  interpolateBodyPose,
  mirrorBodyPose,
  presetBodyPose,
  sanitizeBodyPose,
} = require("../pose-core.js");

const neutral = defaultBodyPose();
assert.deepEqual(Object.keys(neutral), Object.keys(JOINT_DEFINITIONS));
assert.equal(neutral.upperArmL.z, -4);
assert.equal(neutral.upperArmR.z, 4);

const clamped = sanitizeBodyPose({ head: { x: 999, y: "-20", z: null } });
assert.equal(clamped.head.x, 45);
assert.equal(clamped.head.y, -20);
assert.equal(clamped.head.z, 0);

const walk = presetBodyPose("walk");
assert.notEqual(walk.upperLegL.x, walk.upperLegR.x);
const midpoint = interpolateBodyPose(neutral, walk, 0.5);
assert.equal(midpoint.upperLegL.x, walk.upperLegL.x / 2);

const mirrored = mirrorBodyPose({
  upperArmL: { x: 20, y: 15, z: -30 },
  upperArmR: { x: -10, y: -5, z: 40 },
});
assert.deepEqual(mirrored.upperArmL, { x: -10, y: 5, z: -40 });
assert.deepEqual(mirrored.upperArmR, { x: 20, y: -15, z: 30 });

// Verify PRESET_CATEGORIES covers all presets in PRESET_LABELS
const allCategoryPresetIds = PRESET_CATEGORIES.flatMap((category) => category.presets);
const allLabelIds = Object.keys(PRESET_LABELS);
allLabelIds.forEach((presetId) => {
  assert.ok(
    allCategoryPresetIds.includes(presetId),
    `PRESET_LABELS key "${presetId}" is missing from PRESET_CATEGORIES`,
  );
});
allCategoryPresetIds.forEach((presetId) => {
  assert.ok(
    PRESET_LABELS[presetId],
    `PRESET_CATEGORIES preset "${presetId}" is missing from PRESET_LABELS`,
  );
});

// Verify every preset returns a valid body pose with values within joint ranges
allLabelIds.forEach((presetId) => {
  const pose = presetBodyPose(presetId);
  Object.entries(JOINT_DEFINITIONS).forEach(([jointId, definition]) => {
    ["x", "y", "z"].forEach((axis) => {
      const value = pose[jointId][axis];
      assert.ok(
        typeof value === "number" && Number.isFinite(value),
        `preset "${presetId}" joint "${jointId}.${axis}" is not a finite number: ${value}`,
      );
      assert.ok(
        value >= definition[axis][0] && value <= definition[axis][1],
        `preset "${presetId}" joint "${jointId}.${axis}" = ${value} out of range [${definition[axis][0]}, ${definition[axis][1]}]`,
      );
    });
  });
});

// Verify PRESET_CATEGORIES structure
assert.ok(PRESET_CATEGORIES.length >= 5, "should have at least 5 categories");
PRESET_CATEGORIES.forEach((category) => {
  assert.ok(category.id, "category must have id");
  assert.ok(category.label, "category must have label");
  assert.ok(category.emoji, "category must have emoji");
  assert.ok(Array.isArray(category.presets) && category.presets.length > 0, "category must have presets");
});

// Verify no duplicate preset IDs across categories
const seen = new Set();
allCategoryPresetIds.forEach((presetId) => {
  assert.ok(!seen.has(presetId), `duplicate preset "${presetId}" in categories`);
  seen.add(presetId);
});

console.log(`pose-core: ${allLabelIds.length} presets, ${PRESET_CATEGORIES.length} categories, limits, mirroring, and interpolation passed`);
