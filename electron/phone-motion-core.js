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

  function normalizeAngle(value) {
    const normalized = finite(value) % 360;
    return normalized < 0 ? normalized + 360 : normalized;
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

  function normalizeQuaternion(value = {}) {
    const x = clamp(value.x, -1, 1);
    const y = clamp(value.y, -1, 1);
    const z = clamp(value.z, -1, 1);
    const w = clamp(value.w, -1, 1);
    const length = Math.hypot(x, y, z, w);
    if (length < 0.000001) return { x:0,y:0,z:0,w:1 };
    return { x:x/length,y:y/length,z:z/length,w:w/length };
  }

  function inverseQuaternion(value = {}) {
    const q = normalizeQuaternion(value);
    return { x:-q.x, y:-q.y, z:-q.z, w:q.w };
  }

  function rotateVectorByQuaternion(vector = {}, value = {}) {
    const q = normalizeQuaternion(value);
    const vx = finite(vector.x), vy = finite(vector.y), vz = finite(vector.z);
    const tx = 2 * (q.y * vz - q.z * vy);
    const ty = 2 * (q.z * vx - q.x * vz);
    const tz = 2 * (q.x * vy - q.y * vx);
    return {
      x: vx + q.w * tx + (q.y * tz - q.z * ty),
      y: vy + q.w * ty + (q.z * tx - q.x * tz),
      z: vz + q.w * tz + (q.x * ty - q.y * tx),
    };
  }

  function normalizeSpatial(spatial = {}) {
    const metric = spatial?.mode === "webxr" && spatial?.metric === true;
    if (!metric) {
      return {
        mode:"none",
        metric:false,
        position:{x:0,y:0,z:0},
        orientation:{x:0,y:0,z:0,w:1},
        confidence:0,
      };
    }
    return {
      mode:"webxr",
      metric:true,
      position:{
        x:clamp(spatial.position?.x, -50, 50),
        y:clamp(spatial.position?.y, -50, 50),
        z:clamp(spatial.position?.z, -50, 50),
      },
      orientation:normalizeQuaternion(spatial.orientation),
      confidence:clamp(spatial.confidence, 0, 1),
    };
  }

  function quaternionToOrientation(value = {}) {
    const q = normalizeQuaternion(value);
    const yaw = Math.atan2(
      2 * (q.w * q.y + q.x * q.z),
      1 - 2 * (q.x * q.x + q.y * q.y),
    ) * 180 / Math.PI;
    const pitch = Math.asin(clamp(2 * (q.w * q.x - q.y * q.z), -1, 1)) * 180 / Math.PI;
    const roll = Math.atan2(
      2 * (q.w * q.z + q.x * q.y),
      1 - 2 * (q.x * q.x + q.z * q.z),
    ) * 180 / Math.PI;
    return { yaw:wrapDegrees(yaw),pitch:wrapDegrees(pitch),roll:wrapDegrees(roll),screenAngle:0 };
  }

  function sampleOrientation(phoneSample = {}) {
    const spatial = normalizeSpatial(phoneSample.spatial);
    return spatial.metric ? quaternionToOrientation(spatial.orientation) : remapOrientation(phoneSample);
  }

  function createAnchor(phoneSample = {}, camera = {}) {
    return {
      orientation: sampleOrientation(phoneSample),
      visual: normalizeVisual(phoneSample.visual),
      spatial: normalizeSpatial(phoneSample.spatial),
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
    const orientation = sampleOrientation(phoneSample);
    const visual = normalizeVisual(phoneSample.visual);
    const spatial = normalizeSpatial(phoneSample.spatial);
    const baseVisual = anchor.visual || normalizeVisual();
    const baseSpatial = anchor.spatial || normalizeSpatial();
    const yawDelta = shortestAngleDelta(anchor.orientation.yaw, orientation.yaw);
    const pitchDelta = wrapDegrees(orientation.pitch - anchor.orientation.pitch);
    const rollDelta = wrapDegrees(orientation.roll - anchor.orientation.roll);
    const panSensitivity = clamp(finite(context.panSensitivity, 1), 0.1, 3);
    const tiltSensitivity = clamp(finite(context.tiltSensitivity, 1), 0.1, 3);
    const virtualTravelScale = clamp(finite(
      context.virtualTravelScale,
      finite(context.visualScaleMeters, 1.75),
    ), 0.1, 10);
    const confidenceThreshold = clamp(finite(context.confidenceThreshold, 0.2), 0, 1);
    const stageWidth = Math.max(0.01, finite(context.stageWidth, 10));
    const stageDepth = Math.max(0.01, finite(context.stageDepth, 10));
    const fallbackForward = context.forward || { x: 1, z: 0 };

    let truck = 0;
    let pedestal = 0;
    let dolly = 0;
    let translationTrusted = false;
    let translationMetric = false;
    let translationConfidence = visual.confidence;
    let sourceUnits = "relative-optical-flow";
    let outputUnits = "virtual-scene-travel";
    let forward = fallbackForward;

    if (spatial.metric && baseSpatial.metric) {
      translationMetric = true;
      translationConfidence = spatial.confidence;
      translationTrusted = spatial.confidence >= confidenceThreshold;
      sourceUnits = "meters";
      outputUnits = "virtual-scene-meters";
      const panRad = finite(anchor.camera.panDeg) * Math.PI / 180;
      forward = { x:Math.cos(panRad), z:Math.sin(panRad) };
      if (translationTrusted) {
        const worldDelta = {
          x:spatial.position.x - baseSpatial.position.x,
          y:spatial.position.y - baseSpatial.position.y,
          z:spatial.position.z - baseSpatial.position.z,
        };
        const phoneLocal = rotateVectorByQuaternion(worldDelta, inverseQuaternion(baseSpatial.orientation));
        truck = phoneLocal.x;
        pedestal = phoneLocal.y;
        dolly = -phoneLocal.z;
      }
    } else {
      translationTrusted = visual.confidence >= confidenceThreshold;
      if (translationTrusted) {
        truck = (visual.x - finite(baseVisual.x)) * virtualTravelScale;
        pedestal = (visual.y - finite(baseVisual.y)) * virtualTravelScale;
        dolly = (visual.z - finite(baseVisual.z)) * virtualTravelScale;
      }
    }

    const length = Math.max(0.0001, Math.hypot(finite(forward.x), finite(forward.z)));
    const forwardX = finite(forward.x) / length;
    const forwardY = finite(forward.z) / length;
    const rightX = -forwardY;
    const rightY = forwardX;
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
        trackingMode: translationMetric ? "webxr" : "visual-flow",
        yawDelta: Number(yawDelta.toFixed(3)),
        pitchDelta: Number(pitchDelta.toFixed(3)),
        rollDelta: Number(rollDelta.toFixed(3)),
        translation: {
          truck,
          pedestal,
          dolly,
          confidence: translationConfidence,
          metric: translationMetric,
          sourceUnits,
          outputUnits,
          referenceFrame: translationMetric ? "recentered-phone-local" : "screen-relative-flow",
        },
        translationTrusted,
      },
    };
  }

  function smoothingAlpha(deltaMs, halfLifeMs) {
    const halfLife = Math.max(0, finite(halfLifeMs));
    if (halfLife <= 0) return 1;
    const dt = Math.max(0, finite(deltaMs));
    return 1 - Math.pow(0.5, dt / halfLife);
  }

  function createPoseStabilizer(options = {}) {
    const settings = {
      positionHalfLifeMs: Math.max(0, finite(options.positionHalfLifeMs, 55)),
      angleHalfLifeMs: Math.max(0, finite(options.angleHalfLifeMs, 32)),
      focalHalfLifeMs: Math.max(0, finite(options.focalHalfLifeMs, 75)),
      holdTranslationOnLowConfidence: options.holdTranslationOnLowConfidence !== false,
    };
    let lastPose = null;
    let lastAt = 0;
    let status = {
      heldTranslation: false,
      initialized: false,
      positionHalfLifeMs: settings.positionHalfLifeMs,
      angleHalfLifeMs: settings.angleHalfLifeMs,
    };

    function clonePose(pose) {
      if (!pose) return null;
      return {
        ...pose,
        diagnostic: pose.diagnostic ? JSON.parse(JSON.stringify(pose.diagnostic)) : undefined,
      };
    }

    function reset(pose = null, at = 0) {
      lastPose = clonePose(pose);
      lastAt = Math.max(0, finite(at));
      status = {
        heldTranslation: false,
        initialized: Boolean(lastPose),
        positionHalfLifeMs: settings.positionHalfLifeMs,
        angleHalfLifeMs: settings.angleHalfLifeMs,
      };
      return clonePose(lastPose);
    }

    function update(rawPose, at = Date.now()) {
      if (!rawPose) return null;
      const now = Math.max(0, finite(at, Date.now()));
      const trusted = rawPose.diagnostic?.translationTrusted !== false;
      if (!lastPose) {
        lastPose = clonePose(rawPose);
        lastAt = now;
        status = {
          heldTranslation: false,
          initialized: true,
          positionHalfLifeMs: settings.positionHalfLifeMs,
          angleHalfLifeMs: settings.angleHalfLifeMs,
        };
        lastPose.diagnostic = {
          ...(lastPose.diagnostic || {}),
          stabilization: { ...status },
        };
        return clonePose(lastPose);
      }

      const deltaMs = Math.max(1, Math.min(250, now - lastAt || 16));
      const positionAlpha = smoothingAlpha(deltaMs, settings.positionHalfLifeMs);
      const angleAlpha = smoothingAlpha(deltaMs, settings.angleHalfLifeMs);
      const focalAlpha = smoothingAlpha(deltaMs, settings.focalHalfLifeMs);
      const holdTranslation = settings.holdTranslationOnLowConfidence && !trusted;
      const targetX = holdTranslation ? lastPose.x : finite(rawPose.x, lastPose.x);
      const targetY = holdTranslation ? lastPose.y : finite(rawPose.y, lastPose.y);
      const targetHeight = holdTranslation ? lastPose.height : finite(rawPose.height, lastPose.height);
      const panStep = shortestAngleDelta(lastPose.panDeg, rawPose.panDeg);
      const next = {
        ...rawPose,
        x: finite(lastPose.x) + (targetX - finite(lastPose.x)) * positionAlpha,
        y: finite(lastPose.y) + (targetY - finite(lastPose.y)) * positionAlpha,
        height: finite(lastPose.height, 1.6) + (targetHeight - finite(lastPose.height, 1.6)) * positionAlpha,
        panDeg: normalizeAngle(finite(lastPose.panDeg) + panStep * angleAlpha),
        tiltDeg: finite(lastPose.tiltDeg) + (finite(rawPose.tiltDeg) - finite(lastPose.tiltDeg)) * angleAlpha,
        focal: finite(lastPose.focal, 35) + (finite(rawPose.focal, 35) - finite(lastPose.focal, 35)) * focalAlpha,
      };
      status = {
        heldTranslation: holdTranslation,
        initialized: true,
        positionHalfLifeMs: settings.positionHalfLifeMs,
        angleHalfLifeMs: settings.angleHalfLifeMs,
      };
      next.diagnostic = {
        ...(rawPose.diagnostic || {}),
        stabilization: { ...status },
      };
      lastPose = clonePose(next);
      lastAt = now;
      return clonePose(next);
    }

    return Object.freeze({
      update,
      reset,
      get pose() { return clonePose(lastPose); },
      get status() { return { ...status }; },
    });
  }

  return Object.freeze({
    finite,
    clamp,
    wrapDegrees,
    shortestAngleDelta,
    normalizeAngle,
    normalizeScreenAngle,
    remapOrientation,
    normalizeVisual,
    normalizeQuaternion,
    inverseQuaternion,
    rotateVectorByQuaternion,
    normalizeSpatial,
    quaternionToOrientation,
    sampleOrientation,
    createAnchor,
    derivePose,
    smoothingAlpha,
    createPoseStabilizer,
  });
});
