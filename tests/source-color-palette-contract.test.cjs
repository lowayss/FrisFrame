const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const multiCamera = fs.readFileSync(path.join(root, "multi-camera-core.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "styles.css"), "utf8");

function appPalette(role) {
  const match = app.match(new RegExp(`${role}: Object\\.freeze\\(\\[([^\\]]+)\\]\\)`));
  assert.ok(match, `${role} source palette must exist`);
  return [...match[1].matchAll(/"(#[0-9a-f]{6})"/gi)].map((entry) => entry[1].toLowerCase());
}

const palettes = Object.fromEntries(["camera", "actor", "prop", "background"].map((role) => [role, appPalette(role)]));
for (const [role, palette] of Object.entries(palettes)) {
  assert.ok(palette.length >= 4, `${role} needs enough variants to distinguish multiple sources`);
  assert.equal(new Set(palette).size, palette.length, `${role} palette must not repeat a color`);
}

function rgbDistance(left, right) {
  const rgb = (color) => [1, 3, 5].map((offset) => parseInt(color.slice(offset, offset + 2), 16));
  const a = rgb(left);
  const b = rgb(right);
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

for (let left = 0; left < palettes.actor.length; left += 1) {
  for (let right = left + 1; right < palettes.actor.length; right += 1) {
    assert.ok(rgbDistance(palettes.actor[left], palettes.actor[right]) >= 90,
      `actor colors must be visually separated: ${palettes.actor[left]} vs ${palettes.actor[right]}`);
  }
}

const roles = Object.keys(palettes);
for (let left = 0; left < roles.length; left += 1) {
  for (let right = left + 1; right < roles.length; right += 1) {
    const overlap = palettes[roles[left]].filter((color) => palettes[roles[right]].includes(color));
    assert.deepEqual(overlap, [], `${roles[left]} and ${roles[right]} palettes must not overlap`);
  }
}

const corePaletteMatch = multiCamera.match(/const DEFAULT_COLORS = \[([^\]]+)\]/);
assert.ok(corePaletteMatch, "multi-camera core needs a camera palette");
const coreCameraPalette = [...corePaletteMatch[1].matchAll(/"(#[0-9a-f]{6})"/gi)].map((entry) => entry[1].toLowerCase());
assert.deepEqual(coreCameraPalette, palettes.camera, "app and multi-camera camera palettes must stay identical");

assert.match(app, /version: 12,/, "new blocking documents must start on explicit-seat schema v12");
assert.match(app, /state\.version = 12;/, "loaded blocking documents must normalize to explicit-seat schema v12");
assert.match(app, /if \(previousStateVersion < 11\) migrateDistinctSourceColors\(state\);/,
  "legacy projects need a one-time role-color migration");
assert.match(app, /function sourceColorRoleForItem\([\s\S]*?definition\.kind === "architecture"[\s\S]*?definition\.kind === "nature"/,
  "set, architecture, and nature items must resolve to the background role");
assert.match(app, /sourceColorPaletteForItem\(item\)\.forEach\(\(color\) =>/,
  "the item color picker must expose only colors from the selected item's role");
assert.match(app, /function blockingGuideColor\(source\) \{\s*if \(\/\^#\[0-9a-f\]\{6\}\$\/i\.test\(String\(source\?\.color \|\| ""\)\)\) return source\.color;/,
  "2D stage paths must use the same source color as the timeline and 3D stage");
assert.match(app, /function makeThreeKeyOrderBadge\([\s\S]*?context\.fillStyle = color;/,
  "selected 3D key badges must preserve their source color");
assert.match(app, /function drawPathOrderBadge\([\s\S]*?ctx\.fillStyle = color;/,
  "selected 2D key badges must preserve their source color");

assert.match(styles, /\.timeline-marker\.is-active \{\s*background: var\(--marker-color, var\(--accent-2\)\);/,
  "active timeline keys must preserve their source color");
assert.match(styles, /\.timeline-marker\.is-camera \{\s*background: var\(--marker-color, #38bdf8\) !important;/,
  "camera timeline keys must use the camera profile color instead of a separate hard-coded value");
assert.match(styles, /\.timeline-marker\.is-cut-marker \{[\s\S]*?background: var\(--marker-color, var\(--danger\)\);/,
  "cut markers must preserve source color while using shape to communicate the cut");

console.log("source-color-palette-contract: role palettes, migration, stage paths, and timeline colors passed");
