const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const mainEntry = fs.readFileSync(path.join(root, "electron/main-entry.cjs"), "utf8");
const main = fs.readFileSync(path.join(root, "electron/main.cjs"), "utf8");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

const expectedMotionPrelude = [
  "phone-motion-ipc-ux.js",
];
const expectedPrelude = [
  "camera-take-path-core.js",
  "camera-take-replay-ux.js",
];
const expectedMainInjection = [
  "workspace-ux.js",
  "hud-export-ux.js",
  "interaction-ux.js",
  "camera-operator-live-ux.js",
  "camera-operator-inputs-ux.js",
  "phone-motion-core.js",
  "phone-motion-camera-ux.js",
  "camera-take-browser-ux.js",
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
const expectedInjection = [...expectedMotionPrelude, ...expectedPrelude, ...expectedMainInjection];
const expectedUx = expectedInjection.filter((filename) => /-ux\.js$/.test(filename));
const quotedManifest = (source) => [...source.matchAll(/"([^"]+)"/g)].map((match) => match[1]);

const motionPrelude = mainEntry.match(/MOTION_PRELUDE_FILES = Object\.freeze\(\[(.*?)\]\)/s);
assert.ok(motionPrelude, "electron/main-entry.cjs must keep one explicit Physical Camera transport prelude manifest");
const motionPreInjected = quotedManifest(motionPrelude[1]);
const prelude = mainEntry.match(/TAKE_PRELUDE_FILES = Object\.freeze\(\[(.*?)\]\)/s);
assert.ok(prelude, "electron/main-entry.cjs must keep one explicit Take prelude manifest");
const preInjected = quotedManifest(prelude[1]);
const injection = main.match(/for \(const filename of \[(.*?)\]\) \{/s);
assert.ok(injection, "electron/main.cjs must keep one explicit renderer injection manifest");
const mainInjected = quotedManifest(injection[1]);
const injected = [...motionPreInjected, ...preInjected, ...mainInjected];
const packaged = packageJson.build.files
  .filter((filename) => /^electron\/.*-ux\.js$/.test(filename))
  .map((filename) => path.basename(filename));

assert.deepEqual(motionPreInjected, expectedMotionPrelude,
  "Physical Camera IPC transport must load before the existing renderer UX manifests");
assert.deepEqual(preInjected, expectedPrelude,
  "Take path archive/replay must load before the existing renderer UX manifest");
assert.deepEqual(mainInjected, expectedMainInjection,
  "desktop main renderer injection order must stay canonical");
assert.deepEqual(injected, expectedInjection,
  "combined desktop renderer injection order must match the canonical manifest");
assert.deepEqual(packaged, expectedUx,
  "desktop package UX files must match the UX subset of the combined injection manifest and order");
assert.ok(packageJson.build.files.includes("electron/phone-motion-core.js"),
  "phone motion support core must be packaged even though it is not an -ux.js module");
assert.ok(packageJson.build.files.includes("electron/camera-take-path-core.js"),
  "camera Take path support core must be packaged even though it is not an -ux.js module");
assert.equal(new Set(injected).size, injected.length,
  "desktop renderer injection manifests must not contain duplicates");
for (const filename of expectedInjection) {
  assert.ok(fs.existsSync(path.join(root, "electron", filename)), `${filename} must exist on disk`);
}
assert.equal(mainInjected.at(-1), "performance-ux.js",
  "performance wrappers must load after the correctness/cache layers they wrap");
assert.match(mainEntry, /inject\(\)\.finally\(\(\) => listener\(\.\.\.args\)\)/,
  "existing did-finish-load UX injection must wait for the transport and Take preludes");

console.log("desktop-ux-manifest: Physical Camera transport, Take prelude, package and renderer injection manifests are synchronized");