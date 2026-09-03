const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const main = fs.readFileSync(path.join(root, "electron/main.cjs"), "utf8");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

const expectedInjection = [
  "workspace-ux.js",
  "hud-export-ux.js",
  "interaction-ux.js",
  "camera-operator-live-ux.js",
  "camera-operator-inputs-ux.js",
  "phone-motion-core.js",
  "phone-motion-camera-ux.js",
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
const expectedUx = expectedInjection.filter((filename) => /-ux\.js$/.test(filename));

const injection = main.match(/for \(const filename of \[(.*?)\]\) \{/s);
assert.ok(injection, "electron/main.cjs must keep one explicit renderer injection manifest");
const injected = JSON.parse(`[${injection[1]}]`);
const packaged = packageJson.build.files
  .filter((filename) => /^electron\/.*-ux\.js$/.test(filename))
  .map((filename) => path.basename(filename));

assert.deepEqual(injected, expectedInjection,
  "desktop renderer injection order must match the canonical manifest, including support cores");
assert.deepEqual(packaged, expectedUx,
  "desktop package UX files must match the UX subset of the canonical injection manifest and order");
assert.ok(packageJson.build.files.includes("electron/phone-motion-core.js"),
  "phone motion support core must be packaged even though it is not an -ux.js module");
assert.equal(new Set(injected).size, injected.length,
  "desktop renderer injection manifest must not contain duplicates");
for (const filename of expectedInjection) {
  assert.ok(fs.existsSync(path.join(root, "electron", filename)), `${filename} must exist on disk`);
}
assert.equal(injected.at(-1), "performance-ux.js",
  "performance wrappers must load after the correctness/cache layers they wrap");

console.log("desktop-ux-manifest: package and renderer injection manifests are synchronized");
