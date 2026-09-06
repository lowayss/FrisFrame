"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const bootPath = path.join(ROOT, "boot-errors.js");
const appPath = path.join(ROOT, "app.js");
const boot = fs.readFileSync(bootPath, "utf8");
const app = fs.readFileSync(appPath, "utf8");

execFileSync(process.execPath, ["--check", bootPath], { stdio: "pipe" });

assert.match(boot, /MODE_25D\s*=\s*"2\.5d"/, "2.5D view mode must be registered");
assert.match(boot, /MODE_CAMERA\s*=\s*"camera"/, "CAMERA view mode must be registered");
assert.match(boot, /new THREE\.OrthographicCamera/, "2.5D must use a Three.js orthographic camera");
assert.match(boot, /new THREE\.PerspectiveCamera\(42/, "CAMERA mode must use an authored perspective camera");
assert.match(boot, /data-birdseye-preset/, "left/right birdseye preset controls must exist");
assert.match(boot, /"전체보기"/, "fit-all control must exist");
assert.match(boot, /지붕\/천장 숨김/, "roof/ceiling visibility control must exist");
assert.match(boot, /ROOF_RE/, "roof/ceiling classification must be explicit");
assert.match(boot, /setMasterPlan\?\.elements/, "roof/ceiling policy must consume persisted set master-plan metadata");
assert.match(boot, /setCollections/, "roof/ceiling policy must consume semantic set collections");
assert.match(boot, /new THREE\.EdgesGeometry/, "2.5D outline rendering must use geometry edges");
assert.match(boot, /threeView\.camera\s*=\s*camera/, "2.5D/CAMERA must drive the shared Three.js editor camera");
assert.match(boot, /originalSetViewMode\(MODE_3D\)/, "2.5D/CAMERA must reuse the existing shared 3D world instead of duplicating scene state");
assert.match(boot, /renderThreeView\(renderState, true\)/, "2.5D changes must render the current evaluated scene state");

assert.match(app, /threeView\.raycaster\.setFromCamera\(pointer, threeView\.camera\)/,
  "shared 3D picking must raycast through the active camera, including OrthographicCamera");
assert.match(app, /sourceEditLocked\(editItemId\)/,
  "shared 3D editor must enforce item/set editLocked state");
assert.match(app, /commit\(\{ preserveSourceIds:/,
  "shared 3D direct manipulation must commit back to the authoritative blocking state");

console.log("birdseye-2-5d-mode-contract: orthographic view, camera mode, fit/presets, roof hide, outlines, shared editing and locks passed");
