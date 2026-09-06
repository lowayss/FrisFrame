const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const mainEntry = fs.readFileSync(path.join(root, "electron/main-entry.cjs"), "utf8");
const main = fs.readFileSync(path.join(root, "electron/main.cjs"), "utf8");
const phoneDirector = fs.readFileSync(path.join(root, "electron/phone-director-viewfinder.cjs"), "utf8");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

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
const expectedConditionalPhoneInjection = [
  "phone-handheld-command-ux.js",
];
const expectedInjection = [...expectedPrelude, ...expectedMainInjection];
const expectedAlwaysUx = expectedInjection.filter((filename) => /-ux\.js$/.test(filename));
const phoneCameraIndex = expectedAlwaysUx.indexOf("phone-motion-camera-ux.js");
const expectedPackagedUx = [
  ...expectedAlwaysUx.slice(0, phoneCameraIndex + 1),
  ...expectedConditionalPhoneInjection,
  ...expectedAlwaysUx.slice(phoneCameraIndex + 1),
];
const quotedManifest = (source) => [...source.matchAll(/"([^"]+)"/g)].map((match) => match[1]);

const prelude = mainEntry.match(/TAKE_PRELUDE_FILES = Object\.freeze\(\[(.*?)\]\)/s);
assert.ok(prelude, "electron/main-entry.cjs must keep one explicit Take prelude manifest");
const preInjected = quotedManifest(prelude[1]);
const injection = main.match(/for \(const filename of \[(.*?)\]\) \{/s);
assert.ok(injection, "electron/main.cjs must keep one explicit renderer injection manifest");
const mainInjected = quotedManifest(injection[1]);
const injected = [...preInjected, ...mainInjected];
const packaged = packageJson.build.files
  .filter((filename) => /^electron\/.*-ux\.js$/.test(filename))
  .map((filename) => path.basename(filename));

assert.deepEqual(preInjected, expectedPrelude,
  "Take path archive/replay must load before the existing renderer UX manifest");
assert.deepEqual(mainInjected, expectedMainInjection,
  "desktop main renderer injection order must stay canonical");
assert.deepEqual(injected, expectedInjection,
  "combined desktop renderer injection order must match the canonical manifest");
assert.deepEqual(packaged, expectedPackagedUx,
  "desktop package UX files must preserve always-on order and colocate conditional phone UX after Physical Camera UX");
assert.ok(packageJson.build.files.includes("electron/phone-motion-core.js"),
  "phone motion support core must be packaged even though it is not an -ux.js module");
assert.ok(packageJson.build.files.includes("electron/phone-motion-core-absolute-focal.js"),
  "absolute phone focal compatibility core must be packaged for on-demand Director Viewfinder injection");
assert.ok(packageJson.build.files.includes("electron/camera-take-path-core.js"),
  "camera Take path support core must be packaged even though it is not an -ux.js module");
assert.match(phoneDirector, /ensureRendererPatches/,
  "Director Viewfinder must own one explicit conditional renderer-patch injection path");
for (const filename of ["phone-motion-core-absolute-focal.js", ...expectedConditionalPhoneInjection]) {
  assert.match(phoneDirector, new RegExp(filename.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    `${filename} must be referenced by the conditional phone renderer-patch injector`);
  assert.ok(fs.existsSync(path.join(root, "electron", filename)), `${filename} must exist on disk`);
}
assert.equal(new Set(injected).size, injected.length,
  "desktop renderer injection manifests must not contain duplicates");
for (const filename of expectedInjection) {
  assert.ok(fs.existsSync(path.join(root, "electron", filename)), `${filename} must exist on disk`);
}
assert.equal(mainInjected.at(-1), "performance-ux.js",
  "performance wrappers must load after the correctness/cache layers they wrap");
assert.match(mainEntry, /inject\(\)\.finally\(\(\) => listener\(\.\.\.args\)\)/,
  "existing did-finish-load UX injection must wait for the Take prelude");

console.log("desktop-ux-manifest: always-on and conditional phone renderer manifests are synchronized with packaging");
