const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const main = fs.readFileSync(path.join(root, "electron/main.cjs"), "utf8");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

const expected = [
  "workspace-ux.js",
  "hud-export-ux.js",
  "interaction-ux.js",
  "camera-operator-live-ux.js",
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
