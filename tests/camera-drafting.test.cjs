const assert = require("node:assert/strict");

const {
  STAGE_COORD_MIN,
  STAGE_COORD_MAX,
  CAMERA_HEIGHT_MAX,
  draftCameraFromText,
} = require("../camera-drafting-core.js");

const overhead = draftCameraFromText({ camera: "ECU · overhead/vertical · high" }, 0.5, 0.5);
assert.equal(overhead.height, 4.2);
assert.equal(overhead.tiltDeg, -88);
assert.equal(overhead.focal, 100);

const profile = draftCameraFromText({ camera: "CU · profile/lateral · eye" }, 0.5, 0.5);
assert.equal(profile.focal, 85);
assert.equal(profile.focusDistanceM, 5);
assert.ok(Math.abs(profile.x - 0.5) < 0.01);
assert.ok(Math.abs(profile.y - 0.15) < 0.01);

const lowRear = draftCameraFromText({ action: "Giseok is running seen from rear from low ground angle" }, 0.5, 0.5);
assert.equal(lowRear.height, 0.4);
assert.equal(lowRear.tiltDeg, 15);
assert.equal(lowRear.focal, 50);
assert.ok(lowRear.x > 0.5);

const edgeWide = draftCameraFromText({ camera: "ELS wide" }, 0.02, 0.02);
assert.ok(edgeWide.x >= STAGE_COORD_MIN && edgeWide.x <= STAGE_COORD_MAX);
assert.ok(edgeWide.y >= STAGE_COORD_MIN && edgeWide.y <= STAGE_COORD_MAX);
assert.equal(CAMERA_HEIGHT_MAX, 35);

const invalid = draftCameraFromText({ focal: "not-a-number" }, Number.NaN, Number.POSITIVE_INFINITY);
assert.ok(Number.isFinite(invalid.x) && Number.isFinite(invalid.y));
assert.equal(invalid.focal, 50);

console.log("camera-drafting: production module presets and stage bounds passed");
