(function initCameraDraftingCore(globalScope) {
  "use strict";

  const STAGE_COORD_MIN = 0.02;
  const STAGE_COORD_MAX = 0.98;
  const CAMERA_HEIGHT_MIN = 0.4;
  const CAMERA_HEIGHT_MAX = 35;
  const CAMERA_TILT_MIN = -90;
  const CAMERA_TILT_MAX = 90;
  const CAMERA_FOCAL_MIN = 14;
  const CAMERA_FOCAL_MAX = 135;

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function finiteNumber(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function radToDeg(rad) {
    return (rad * 180) / Math.PI;
  }

  function draftCameraFromText(draft = {}, actorX = 0.32, actorY = 0.46) {
    const combined = [draft.title, draft.action, draft.dialogue, draft.camera, draft.intent]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

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

    let angleRad = Math.PI;
    if (/측면|옆면|profile|lateral|side/.test(combined)) {
      angleRad = -Math.PI / 2;
    } else if (/후면|뒷모습|뒤쪽|rear|back/.test(combined)) {
      angleRad = 0;
    } else if (/정면|앞모습|front|frontal/.test(combined)) {
      angleRad = Math.PI;
    }

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
      height = CAMERA_HEIGHT_MIN;
      focusHeight = 1.3;
      tiltDeg = 15;
    }

    const targetX = clamp(finiteNumber(actorX, 0.32), STAGE_COORD_MIN, STAGE_COORD_MAX);
    const targetY = clamp(finiteNumber(actorY, 0.46), STAGE_COORD_MIN, STAGE_COORD_MAX);
    const requestedFocal = Number(draft.focal);

    return {
      x: clamp(targetX + Math.cos(angleRad) * distance, STAGE_COORD_MIN, STAGE_COORD_MAX),
      y: clamp(targetY + Math.sin(angleRad) * distance, STAGE_COORD_MIN, STAGE_COORD_MAX),
      aimX: targetX,
      aimY: targetY,
      height,
      focusHeight,
      tiltDeg,
      focal: Number.isFinite(requestedFocal)
        ? clamp(requestedFocal, CAMERA_FOCAL_MIN, CAMERA_FOCAL_MAX)
        : focal,
      focusDistanceM: 5,
      panDeg: Math.round((radToDeg(angleRad + Math.PI) + 360) % 360),
      trackingTargetId: "",
      locks: {
        position: false,
        orientation: false,
        lens: false,
        height: false,
      },
    };
  }

  const api = {
    STAGE_COORD_MIN,
    STAGE_COORD_MAX,
    CAMERA_HEIGHT_MIN,
    CAMERA_HEIGHT_MAX,
    CAMERA_TILT_MIN,
    CAMERA_TILT_MAX,
    CAMERA_FOCAL_MIN,
    CAMERA_FOCAL_MAX,
    draftCameraFromText,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (globalScope) globalScope.FrisFrameCameraDraftingCore = api;
})(typeof window !== "undefined" ? window : globalThis);
