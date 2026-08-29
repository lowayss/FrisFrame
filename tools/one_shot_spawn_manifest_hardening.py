#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "app.js"
QUALITY = ROOT / "quality_check.py"
SPAWN_TEST = ROOT / "tests" / "spawn-layout-contract.test.cjs"
MANIFEST_TEST = ROOT / "tests" / "desktop-ux-manifest.test.cjs"

app = APP.read_text(encoding="utf-8")
needle = '''function addItem(type, rawName, assetType = "generic") {
  const base = type === "prop" ? "소품" : "배우";
  const count = state.items.filter((item) => item.type === type).length;
  const safeAssetType = type === "prop" && propCatalog[assetType] ? assetType : "generic";
  const item = {
    id: uid(),
    continuityId: uid(),
    type,
    name: rawName.trim().replace(/^@/, "") || (type === "prop" ? propDefinition(safeAssetType).label : `${base} ${count + 1}`),
    x: type === "prop" ? 0.52 : 0.38 + count * 0.06,
    y: type === "prop" ? 0.58 : 0.36 + count * 0.08,
'''
replacement = '''function nextItemSpawnPosition(type) {
  const actorSlots = [
    [0.38, 0.36], [0.46, 0.36], [0.54, 0.36], [0.62, 0.36],
    [0.38, 0.46], [0.46, 0.46], [0.54, 0.46], [0.62, 0.46],
    [0.38, 0.56], [0.46, 0.56], [0.54, 0.56], [0.62, 0.56],
  ];
  const propSlots = [
    [0.52, 0.58], [0.60, 0.58], [0.44, 0.58], [0.52, 0.68],
    [0.60, 0.68], [0.44, 0.68], [0.68, 0.58], [0.36, 0.58],
    [0.68, 0.68], [0.36, 0.68], [0.52, 0.78], [0.60, 0.78],
    [0.44, 0.78], [0.68, 0.78], [0.36, 0.78],
  ];
  const slots = type === "actor" ? actorSlots : propSlots;
  const existing = state.items.filter((item) => {
    if (item.visible === false) return false;
    if (item.type !== "prop") return true;
    const definition = propDefinition(item.dummyType || "generic");
    return definition.kind !== "architecture";
  });
  const clearance = type === "actor" ? 0.075 : 0.065;
  const start = existing.length % slots.length;
  for (let offset = 0; offset < slots.length; offset += 1) {
    const [x, y] = slots[(start + offset) % slots.length];
    const open = existing.every((item) => {
      const itemX = finiteNumber(item.x, 0.5);
      const itemY = finiteNumber(item.y, 0.5);
      const minimum = item.type === "actor" || type === "actor" ? Math.max(clearance, 0.075) : clearance;
      return Math.hypot(itemX - x, itemY - y) >= minimum;
    });
    if (open) return { x, y };
  }
  const overflowIndex = existing.length - slots.length + 1;
  const column = Math.max(0, overflowIndex) % 7;
  const row = Math.floor(Math.max(0, overflowIndex) / 7) % 5;
  return {
    x: clamp(0.28 + column * 0.075, 0.12, 0.88),
    y: clamp(0.30 + row * 0.10, 0.14, 0.86),
  };
}

function addItem(type, rawName, assetType = "generic") {
  const base = type === "prop" ? "소품" : "배우";
  const count = state.items.filter((item) => item.type === type).length;
  const safeAssetType = type === "prop" && propCatalog[assetType] ? assetType : "generic";
  const spawn = nextItemSpawnPosition(type);
  const item = {
    id: uid(),
    continuityId: uid(),
    type,
    name: rawName.trim().replace(/^@/, "") || (type === "prop" ? propDefinition(safeAssetType).label : `${base} ${count + 1}`),
    x: spawn.x,
    y: spawn.y,
'''
if needle not in app:
    raise SystemExit("addItem spawn block did not match current source")
app = app.replace(needle, replacement, 1)
APP.write_text(app, encoding="utf-8")

SPAWN_TEST.write_text(r'''const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const match = app.match(/function nextItemSpawnPosition\(type\) \{[\s\S]*?\n\}/);
assert.ok(match, "app.js must expose deterministic non-overlapping spawn placement");

const sandbox = {
  state: { items: [] },
  clamp: (value, min, max) => Math.min(max, Math.max(min, Number(value))),
  finiteNumber: (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback,
  propDefinition: (id) => ({ kind: id === "room" ? "architecture" : "generic" }),
};
vm.createContext(sandbox);
vm.runInContext(`${match[0]}; this.nextItemSpawnPosition = nextItemSpawnPosition;`, sandbox);
const spawn = sandbox.nextItemSpawnPosition;

assert.deepEqual({ ...spawn("actor") }, { x: 0.38, y: 0.36 }, "first actor keeps the familiar default slot");
assert.deepEqual({ ...spawn("prop") }, { x: 0.52, y: 0.58 }, "first prop keeps the familiar default slot");

const addAtSpawn = (type, dummyType = "generic") => {
  const point = spawn(type);
  sandbox.state.items.push({ type, dummyType, visible: true, x: point.x, y: point.y });
  return point;
};

const propPoints = [];
for (let index = 0; index < 10; index += 1) propPoints.push(addAtSpawn("prop"));
assert.equal(new Set(propPoints.map(({ x, y }) => `${x}:${y}`)).size, propPoints.length,
  "repeated prop quick-add must not stack new props on the same slot");
for (const point of propPoints) {
  assert.ok(point.x >= 0.12 && point.x <= 0.88 && point.y >= 0.14 && point.y <= 0.86,
    "spawn points must stay inside the editable stage area");
}

sandbox.state.items = [{ type: "prop", dummyType: "room", visible: true, x: 0.52, y: 0.58 }];
assert.deepEqual({ ...spawn("prop") }, { x: 0.52, y: 0.58 },
  "architecture shells must not block useful object spawn slots");

sandbox.state.items = [{ type: "actor", visible: true, x: 0.38, y: 0.36 }];
assert.notDeepEqual({ ...spawn("actor") }, { x: 0.38, y: 0.36 },
  "a second actor must move to a free slot");

console.log("spawn-layout-contract: deterministic free-slot placement passed");
''', encoding="utf-8")

MANIFEST_TEST.write_text(r'''const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const main = fs.readFileSync(path.join(root, "electron/main.cjs"), "utf8");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

const expected = [
  "workspace-ux.js",
  "hud-export-ux.js",
  "interaction-ux.js",
  "selection-ux.js",
  "alignment-ux.js",
  "history-safety-ux.js",
  "scene-cache-ux.js",
  "dynamic-prop-cache-ux.js",
  "stage-shell-cache-ux.js",
  "camera-path-cache-ux.js",
  "helper-raycast-ux.js",
  "preview-cache-ux.js",
  "performance-ux.js",
];

const injection = main.match(/for \(const filename of \[(.*?)\]\) \{/s);
assert.ok(injection, "electron/main.cjs must keep one explicit UX injection manifest");
const injected = JSON.parse(`[${injection[1]}]`);
const packaged = packageJson.build.files
  .filter((filename) => /^electron\/.*-ux\.js$/.test(filename))
  .map((filename) => path.basename(filename));

assert.deepEqual(injected, expected,
  "desktop UX injection order must match the canonical manifest");
assert.deepEqual(packaged, expected,
  "desktop package UX files must match the canonical manifest and order");
assert.equal(new Set(injected).size, injected.length,
  "desktop UX injection manifest must not contain duplicates");
for (const filename of expected) {
  assert.ok(fs.existsSync(path.join(root, "electron", filename)), `${filename} must exist on disk`);
}
assert.equal(injected.at(-1), "performance-ux.js",
  "performance wrappers must load after the correctness/cache layers they wrap");

console.log("desktop-ux-manifest: package and injection manifests are synchronized");
''', encoding="utf-8")

quality = QUALITY.read_text(encoding="utf-8")
anchor = '        "tests/large-scene-performance.test.cjs",\n'
addition = '        "tests/large-scene-performance.test.cjs",\n        "tests/spawn-layout-contract.test.cjs",\n        "tests/desktop-ux-manifest.test.cjs",\n'
if anchor not in quality:
    raise SystemExit("quality test anchor did not match current source")
quality = quality.replace(anchor, addition, 1)
QUALITY.write_text(quality, encoding="utf-8")

print("spawn layout and desktop UX manifest hardening prepared")
