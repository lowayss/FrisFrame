const assert = require("node:assert/strict");

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function radToDeg(rad) {
  return rad * 180 / Math.PI;
}

function draftCameraFromText(draft, actorX = 0.32, actorY = 0.46) {
  const combined = [draft.title, draft.action, draft.dialogue, draft.camera, draft.intent]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  // 1. Determine distance & focal preset
  let distance = 0.60;
  let focal = 50;

  if (/익스트림\s*클로즈|extreme\s*close|ecu|초근접/.test(combined)) {
    distance = 0.22;
    focal = 100;
  } else if (/클로즈|close[ -]?up|cu/.test(combined)) {
    distance = 0.35;
    focal = 85;
  } else if (/바스트|medium\s*close|mcu/.test(combined)) {
    distance = 0.50;
    focal = 50;
  } else if (/미디엄|medium|ms/.test(combined)) {
    distance = 0.70;
    focal = 35;
  } else if (/풀\s*샷|full\s*shot|fs/.test(combined)) {
    distance = 1.00;
    focal = 28;
  } else if (/와이드|wide|롱\s*샷|long\s*shot|ws|els|익스트림\s*롱/.test(combined)) {
    distance = 1.40;
    focal = 21;
  }

  // 2. Determine angle direction
  let angleRad = Math.PI; // default: looking left (from right side of actor)
  if (/측면|옆면|profile|lateral|side/.test(combined)) {
    angleRad = -Math.PI / 2; // looking from below (Y+)
  } else if (/후면|뒷모습|뒤쪽|rear|back/.test(combined)) {
    angleRad = 0; // looking from left (X-)
  } else if (/정면|앞모습|front|frontal/.test(combined)) {
    angleRad = Math.PI; // looking from right (X+)
  }

  // 3. Height & Tilt
  let height = 1.6;
  let focusHeight = 1.1;
  let tiltDeg = -6;

  if (/수직|버티컬|vertical|overhead|탑샷/.test(combined)) {
    height = 4.2;
    focusHeight = 0;
    tiltDeg = -88;
  } else if (/하이|high/.test(combined)) {
    height = 3.0;
    focusHeight = 0.8;
    tiltDeg = -25;
  } else if (/로우|낮은|low|바닥|ground/.test(combined)) {
    height = 0.4;
    focusHeight = 1.3;
    tiltDeg = 15;
  }

  const cameraX = actorX + Math.cos(angleRad) * distance;
  const cameraY = actorY + Math.sin(angleRad) * distance;

  return {
    x: Math.min(1.99, Math.max(0.01, cameraX)),
    y: Math.min(1.99, Math.max(0.01, cameraY)),
    aimX: actorX,
    aimY: actorY,
    height,
    focusHeight,
    tiltDeg,
    focal: draft.focal ? clamp(Number(draft.focal), 14, 135) : focal,
    panDeg: Math.round((radToDeg(angleRad + Math.PI) + 360) % 360),
    trackingTargetId: "",
    locks: {
      position: false,
      orientation: false,
      lens: false,
      height: false,
    }
  };
}

// 1. Test ECU and vertical overhead
const cam1 = draftCameraFromText({ camera: "ECU · overhead/vertical · high" }, 0.5, 0.5);
assert.equal(cam1.height, 4.2);
assert.equal(cam1.tiltDeg, -88);
assert.equal(cam1.focal, 100);

// 2. Test CU and profile/side
const cam2 = draftCameraFromText({ camera: "CU · profile/lateral · eye" }, 0.5, 0.5);
assert.equal(cam2.focal, 85);
assert.ok(Math.abs(cam2.x - 0.5) < 0.01); // profile means cos(angle) = 0, so x shouldn't change from actorX
assert.ok(Math.abs(cam2.y - 0.15) < 0.01); // side is -PI/2 (cos=0, sin=-1), so 0.5 + sin(-PI/2)*0.35 = 0.15

// 3. Test low angle and rear
const cam3 = draftCameraFromText({ action: "Giseok is running seen from rear from low ground angle" }, 0.5, 0.5);
assert.equal(cam3.height, 0.4);
assert.equal(cam3.tiltDeg, 15);
assert.equal(cam3.focal, 50); // default fallback focal
assert.ok(cam3.x > 0.5); // rear is 0, cos(0) = 1, so x increases

console.log("camera-drafting unit tests passed successfully!");
