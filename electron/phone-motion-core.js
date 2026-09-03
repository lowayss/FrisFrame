(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.FrisFramePhoneMotionCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function finite(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, finite(value)));
  }

  function wrapDegrees(value) {
    let result = finite(value) % 360;
    if (result > 180) result -= 360;
    if (result <= -180) result += 360;
    return result;
  }

  function shortestAngleDelta(from, to) {
    return wrapDegrees(finite(to) - finite(from));
  }

  function normalizeScreenAngle(value) {
    const angle = ((Math.round(finite(value) / 90) * 90) % 360 + 360) % 360;
    return angle === 270 ? -90 : angle;
  }

  function remapOrientation(sample = {}) {
    const orientation = sample.orientation || sample;
    const screenAngle = normalizeScreenAngle(sample.screenAngle);
    const alpha = clamp(orientation.alpha, -360, 360);
    const beta = clamp(orientation.beta, -180, 180);
    const gamma = clamp(orientation.gamma, -90, 90);
    if (screenAngle === 90) return { yaw: alpha, pitch: -gamma, roll: beta, screenAngle };
    if (screenAngle === -90) return { yaw: alpha, pitch: gamma, roll: -beta, screenAngle };
    if (screenAngle === 180) return { yaw: alpha, pitch: -beta, roll: -gamma, screenAngle };
    return { yaw: alpha, pitch: beta, roll: gamma, screenAngle };
  }

  function normalizeVisual(visual = {}) {
    return {
      x: clamp(visual.x, -8, 8),
      y: clamp(visual.y, -8, 8),
      z: clamp(visual.z, -8, 8),
      confidence: clamp(visual.confidence, 0, 1),
      metric: false,
    };
  }

  function createAnchor(phoneSample = {}, camera = {}) {
    return {
      orientation: remapOrientation(phoneSample),
      visual: normalizeVisual(phoneSample.visual),
      camera: {
        x: finite(camera.x),
        y: finite(camera.y),
        height: finite(camera.height, 1.6),
        panDeg: finite(camera.panDeg),
        tiltDeg: finite(camera.tiltDeg),
        focal: finite(camera.focal, 35),
      },
      calibrationId: Math.max(0, Math.trunc(finite(phoneSample.calibrationId))),
    };
  }

  function derivePose(anchor, phoneSample = {}, context = {}) {
    if (!anchor) return null;
    const orientation = remapOrientation(phoneSample);
    const visual = normalizeVisual(phoneSample.visual);
    const baseVisual = anchor.visual || normalizeVisual();
    const yawDelta = shortestAngleDelta(anchor.orientation.yaw, orientation.yaw);
    const pitchDelta = wrapDegrees(orientation.pitch - anchor.orientation.pitch);
    const rollDelta = wrapDegrees(orientation.roll - anchor.orientation.roll);
    const panSensitivity = clamp(finite(context.panSensitivity, 1), 0.1, 3);
    const tiltSensitivity = clamp(finite(context.tiltSensitivity, 1), 0.1, 3);
    const visualScaleMeters = clamp(finite(context.visualScaleMeters, 1.75), 0.1, 10);
    const confidenceThreshold = clamp(finite(context.confidenceThreshold, 0.2), 0, 1);
    const stageWidth = Math.max(0.01, finite(context.stageWidth, 10));
    const stageDepth = Math.max(0.01, finite(context.stageDepth, 10));
    const forward = context.forward || { x: 1, z: 0 };
    const length = Math.max(0.0001, Math.hypot(finite(forward.x), finite(forward.z)));
    const forwardX = finite(forward.x) / length;
    const forwardY = finite(forward.z) / length;
    const rightX = -forwardY;
    const rightY = forwardX;

    let truck = 0;
    let pedestal = 0;
    let dolly = 0;
    const translationTrusted = visual.confidence >= confidenceThreshold;
    if (translationTrusted) {
      truck = (visual.x - finite(baseVisual.x)) * visualScaleMeters;
      pedestal = (visual.y - finite(baseVisual.y)) * visualScaleMeters;
      dolly = (visual.z - finite(baseVisual.z)) * visualScaleMeters;
    }
    const worldX = rightX * truck + forwardX * dolly;
    const worldY = rightY * truck + forwardY * dolly;

    return {
      x: finite(anchor.camera.x) + worldX / stageWidth,
      y: finite(anchor.camera.y) + worldY / stageDepth,
      height: finite(anchor.camera.height, 1.6) + pedestal,
      panDeg: finite(anchor.camera.panDeg) + yawDelta * panSensitivity,
      tiltDeg: finite(anchor.camera.tiltDeg) - pitchDelta * tiltSensitivity,
      focal: finite(anchor.camera.focal, 35),
      diagnostic: {
        yawDelta: Number(yawDelta.toFixed(3)),
        pitchDelta: Number(pitchDelta.toFixed(3)),
        rollDelta: Number(rollDelta.toFixed(3)),
        translation: { truck, pedestal, dolly, confidence: visual.confidence, metric: false },
        translationTrusted,
      },
    };
  }

  return Object.freeze({
    finite,
    clamp,
    wrapDegrees,
    shortestAngleDelta,
    normalizeScreenAngle,
    remapOrientation,
    normalizeVisual,
    createAnchor,
    derivePose,
  });
});
