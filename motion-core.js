(function initMotionCore(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FrisFrameMotionCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createMotionCore() {
  const CAMERA_FOCAL_MIN = 14;
  const CAMERA_FOCAL_MAX = 135;
  const CAMERA_PRESET_MIN_COORD = 0.01;
  const CAMERA_PRESET_MAX_COORD = 0.99;
  const CAMERA_MOTION_PRESETS = Object.freeze({
    "dolly-in": { label: "Dolly In", unit: "m", defaultAmount: 2, pathMode: "straight" },
    "dolly-out": { label: "Dolly Out", unit: "m", defaultAmount: 2, pathMode: "straight" },
    "truck-left": { label: "Truck Left", unit: "m", defaultAmount: 2, pathMode: "straight" },
    "truck-right": { label: "Truck Right", unit: "m", defaultAmount: 2, pathMode: "straight" },
    "pedestal-up": { label: "Pedestal Up", unit: "m", defaultAmount: 1, pathMode: "straight" },
    "pedestal-down": { label: "Pedestal Down", unit: "m", defaultAmount: 1, pathMode: "straight" },
    "arc-left": { label: "Arc Left", unit: "°", defaultAmount: 30, pathMode: "arc-left" },
    "arc-right": { label: "Arc Right", unit: "°", defaultAmount: 30, pathMode: "arc-right" },
    "follow-selected": { label: "Follow Actor", unit: "key", defaultAmount: 0, pathMode: "straight" },
  });

  function finiteNumber(value, fallback = 0) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
    const fallbackNumeric = Number(fallback);
    return Number.isFinite(fallbackNumeric) ? fallbackNumeric : 0;
  }

  function clamp(value, min, max) {
    const lower = finiteNumber(min, 0);
    const upper = finiteNumber(max, lower);
    return Math.max(lower, Math.min(upper, finiteNumber(value, lower)));
  }

  function cloneValue(value) {
    if (value === null || value === undefined || typeof value !== "object") return value;
    if (Array.isArray(value)) return value.map(cloneValue);
    const result = {};
    Object.entries(value).forEach(([key, entry]) => {
      result[key] = cloneValue(entry);
    });
    return result;
  }

  function discreteAtDestination(fromValue, toValue, progress) {
    return clamp(progress, 0, 1) >= 1 ? toValue : fromValue;
  }

  function interpolateFocalLength(fromFocal, toFocal, progress, minimum = CAMERA_FOCAL_MIN, maximum = CAMERA_FOCAL_MAX) {
    const t = clamp(progress, 0, 1);
    const from = finiteNumber(fromFocal, 0);
    return clamp(from + (finiteNumber(toFocal, from) - from) * t, minimum, maximum);
  }

  function smoothReferenceProgress(progress) {
    const t = clamp(progress, 0, 1);
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  function cameraReferenceProgress(progress, transition = "smooth") {
    const t = clamp(progress, 0, 1);
    return String(transition || "smooth") === "smooth" ? smoothReferenceProgress(t) : t;
  }

  function heldActorBodyPose(fromPose, toPose, progress) {
    return cloneValue(discreteAtDestination(fromPose, toPose, progress));
  }

  function fallbackMergedPose(startPose = {}, fallbackPose = {}) {
    return { ...fallbackPose, ...startPose };
  }

  function installReferenceFrameSemantics(target) {
    if (!target || typeof target.interpolatePoseFor !== "function") return false;
    if (target.interpolatePoseFor.__frisFrameReferenceSemantics === true) return true;

    const original = target.interpolatePoseFor;
    const patched = function patchedInterpolatePoseFor(
      renderState,
      sourceId,
      startPose,
      endPose,
      progress,
      fallbackPose,
      endKeyframe = null,
    ) {
      const inputProgress = clamp(progress, 0, 1);
      const evaluatedProgress = sourceId === "camera"
        ? cameraReferenceProgress(inputProgress, endKeyframe?.transition || "smooth")
        : inputProgress;
      const result = original.call(
        this,
        renderState,
        sourceId,
        startPose,
        endPose,
        evaluatedProgress,
        fallbackPose,
        endKeyframe,
      );
      if (!result || typeof result !== "object") return result;

      const mergePose = typeof target.mergePoseWithFallbackFor === "function"
        ? (pose) => target.mergePoseWithFallbackFor(renderState, sourceId, pose, fallbackPose)
        : (pose) => fallbackMergedPose(pose, fallbackPose);
      const from = mergePose(startPose);
      const to = mergePose(endPose);

      if (sourceId === "camera") {
        result.focal = interpolateFocalLength(from.focal, to.focal, evaluatedProgress);
        const trackingTargetId = discreteAtDestination(
          from.trackingTargetId || "",
          to.trackingTargetId || "",
          inputProgress,
        );
        result.trackingTargetId = typeof target.sanitizeTrackingTargetId === "function"
          ? target.sanitizeTrackingTargetId(trackingTargetId, renderState)
          : trackingTargetId;
        return result;
      }

      const itemType = from.type || to.type || result.type;
      if (itemType === "actor") {
        result.bodyPose = heldActorBodyPose(from.bodyPose, to.bodyPose, inputProgress);
      }
      return result;
    };
    Object.defineProperty(patched, "__frisFrameReferenceSemantics", { value: true });
    Object.defineProperty(patched, "__frisFrameOriginal", { value: original });
    target.interpolatePoseFor = patched;
    return true;
  }

  function normalizeTransition(value) {
    return ["smooth", "linear", "hold", "cut"].includes(value) ? value : "smooth";
  }

  function cameraDirectionVector(panDeg = 180, tiltDeg = 0) {
    const pan = finiteNumber(panDeg, 180) * Math.PI / 180;
    const tilt = clamp(finiteNumber(tiltDeg, 0), -90, 90) * Math.PI / 180;
    return {
      x: Math.cos(tilt) * Math.cos(pan),
      y: Math.sin(tilt),
      z: Math.cos(tilt) * Math.sin(pan),
    };
  }

  function normalizedStage(stageWidthM, stageDepthM) {
    return {
      width: Math.max(0.001, Math.abs(finiteNumber(stageWidthM, 36))),
      depth: Math.max(0.001, Math.abs(finiteNumber(stageDepthM, 20.25))),
    };
  }

  function cameraGroundDirection(panDeg) {
    const radians = finiteNumber(panDeg, 180) * Math.PI / 180;
    return { x: Math.cos(radians), z: Math.sin(radians) };
  }

  function translateCameraPose(camera = {}, stageWidthM, stageDepthM, worldDx = 0, worldDz = 0, { translateAim = true } = {}) {
    const stage = normalizedStage(stageWidthM, stageDepthM);
    const startX = finiteNumber(camera.x, 0.5);
    const startY = finiteNumber(camera.y, 0.5);
    const endX = clamp(startX + finiteNumber(worldDx, 0) / stage.width, CAMERA_PRESET_MIN_COORD, CAMERA_PRESET_MAX_COORD);
    const endY = clamp(startY + finiteNumber(worldDz, 0) / stage.depth, CAMERA_PRESET_MIN_COORD, CAMERA_PRESET_MAX_COORD);
    const normalizedDx = endX - startX;
    const normalizedDy = endY - startY;
    const end = { ...cloneValue(camera), x: endX, y: endY };
    if (translateAim) {
      if (Number.isFinite(Number(camera.aimX))) end.aimX = clamp(finiteNumber(camera.aimX) + normalizedDx, 0, 1);
      if (Number.isFinite(Number(camera.aimY))) end.aimY = clamp(finiteNumber(camera.aimY) + normalizedDy, 0, 1);
    }
    return end;
  }

  function orbitCameraPose(camera = {}, stageWidthM, stageDepthM, angleDeg = 30) {
    const stage = normalizedStage(stageWidthM, stageDepthM);
    const cameraX = finiteNumber(camera.x, 0.5) * stage.width;
    const cameraZ = finiteNumber(camera.y, 0.5) * stage.depth;
    const direction = cameraGroundDirection(camera.panDeg);
    let pivotX = finiteNumber(camera.aimX, NaN) * stage.width;
    let pivotZ = finiteNumber(camera.aimY, NaN) * stage.depth;
    if (!Number.isFinite(pivotX) || !Number.isFinite(pivotZ) || Math.hypot(cameraX - pivotX, cameraZ - pivotZ) < 0.25) {
      pivotX = cameraX + direction.x * 4;
      pivotZ = cameraZ + direction.z * 4;
    }
    const radians = finiteNumber(angleDeg, 30) * Math.PI / 180;
    const relativeX = cameraX - pivotX;
    const relativeZ = cameraZ - pivotZ;
    const rotatedX = relativeX * Math.cos(radians) - relativeZ * Math.sin(radians);
    const rotatedZ = relativeX * Math.sin(radians) + relativeZ * Math.cos(radians);
    const endX = clamp((pivotX + rotatedX) / stage.width, CAMERA_PRESET_MIN_COORD, CAMERA_PRESET_MAX_COORD);
    const endY = clamp((pivotZ + rotatedZ) / stage.depth, CAMERA_PRESET_MIN_COORD, CAMERA_PRESET_MAX_COORD);
    const worldEndX = endX * stage.width;
    const worldEndZ = endY * stage.depth;
    const panDeg = ((Math.atan2(pivotZ - worldEndZ, pivotX - worldEndX) * 180 / Math.PI) % 360 + 360) % 360;
    return {
      ...cloneValue(camera),
      x: endX,
      y: endY,
      aimX: clamp(pivotX / stage.width, 0, 1),
      aimY: clamp(pivotZ / stage.depth, 0, 1),
      panDeg,
    };
  }

  function cameraMotionPresetDefinition(presetId) {
    return CAMERA_MOTION_PRESETS[presetId] || CAMERA_MOTION_PRESETS["dolly-in"];
  }

  function buildCameraMotionPreset({
    presetId = "dolly-in",
    camera = {},
    stageWidthM = 36,
    stageDepthM = 20.25,
    amount,
    actorId = "",
    actorStartPose = null,
    actorEndPose = null,
    followPathMode = "straight",
  } = {}) {
    const definition = cameraMotionPresetDefinition(presetId);
    const startPose = cloneValue(camera);
    const requestedAmount = finiteNumber(amount, definition.defaultAmount);
    let endPose = cloneValue(startPose);
    let pathMode = definition.pathMode;

    if (presetId === "dolly-in" || presetId === "dolly-out") {
      const direction = cameraGroundDirection(startPose.panDeg);
      const signed = Math.abs(requestedAmount) * (presetId === "dolly-in" ? 1 : -1);
      endPose = translateCameraPose(startPose, stageWidthM, stageDepthM, direction.x * signed, direction.z * signed, { translateAim: false });
    } else if (presetId === "truck-left" || presetId === "truck-right") {
      const direction = cameraGroundDirection(startPose.panDeg);
      const right = { x: -direction.z, z: direction.x };
      const signed = Math.abs(requestedAmount) * (presetId === "truck-right" ? 1 : -1);
      endPose = translateCameraPose(startPose, stageWidthM, stageDepthM, right.x * signed, right.z * signed, { translateAim: true });
    } else if (presetId === "pedestal-up" || presetId === "pedestal-down") {
      const signed = Math.abs(requestedAmount) * (presetId === "pedestal-up" ? 1 : -1);
      endPose.height = clamp(finiteNumber(startPose.height, 1.6) + signed, 0.15, 20);
    } else if (presetId === "arc-left" || presetId === "arc-right") {
      const angle = clamp(Math.abs(requestedAmount), 5, 90) * (presetId === "arc-left" ? 1 : -1);
      endPose = orbitCameraPose(startPose, stageWidthM, stageDepthM, angle);
    } else if (presetId === "follow-selected") {
      if (!actorId || !actorStartPose || !actorEndPose) {
        throw new Error("Follow Actor에는 기준 배우와 다음 배우 키가 필요합니다.");
      }
      const dx = finiteNumber(actorEndPose.x, finiteNumber(actorStartPose.x, 0.5)) - finiteNumber(actorStartPose.x, 0.5);
      const dy = finiteNumber(actorEndPose.y, finiteNumber(actorStartPose.y, 0.5)) - finiteNumber(actorStartPose.y, 0.5);
      const stage = normalizedStage(stageWidthM, stageDepthM);
      endPose = translateCameraPose(startPose, stage.width, stage.depth, dx * stage.width, dy * stage.depth, { translateAim: true });
      startPose.trackingTargetId = actorId;
      endPose.trackingTargetId = actorId;
      pathMode = ["straight", "horizontal", "vertical", "arc-left", "arc-right", "free-curve"].includes(followPathMode)
        ? followPathMode
        : "straight";
    }

    return {
      presetId,
      label: definition.label,
      unit: definition.unit,
      requestedAmount,
      startPose,
      endPose,
      pathMode,
    };
  }

  function transitionProgress(time, startTime, endTime, transition = "smooth") {
    const start = finiteNumber(startTime, 0);
    const end = finiteNumber(endTime, start + 1);
    const span = Math.max(0.000001, end - start);
    const raw = clamp((finiteNumber(time, start) - start) / span, 0, 1);
    const mode = normalizeTransition(transition);
    if (mode === "cut" || mode === "hold") return raw >= 1 ? 1 : 0;
    if (mode === "linear") return raw;
    return raw < 0.5 ? 2 * raw * raw : 1 - Math.pow(-2 * raw + 2, 2) / 2;
  }

  function poseFieldsChanged(startPose = {}, endPose = {}, fields = ["x", "y"], epsilon = 0.0001) {
    const threshold = Math.max(0, finiteNumber(epsilon, 0.0001));
    return fields.some((field) => {
      const startValue = startPose?.[field];
      const endValue = endPose?.[field];
      if (typeof startValue === "number" || typeof endValue === "number") {
        return Math.abs(finiteNumber(endValue, finiteNumber(startValue, 0)) - finiteNumber(startValue, 0)) > threshold;
      }
      return String(startValue ?? "") !== String(endValue ?? "");
    });
  }

  function motionSegments(keyframes = [], fields = ["x", "y"], epsilon = 0.0001) {
    const sorted = [...keyframes]
      .filter((keyframe) => Number.isFinite(Number(keyframe?.time)))
      .sort((a, b) => Number(a.time) - Number(b.time));
    const segments = [];
    for (let index = 1; index < sorted.length; index += 1) {
      const start = sorted[index - 1];
      const end = sorted[index];
      if (!poseFieldsChanged(start.pose || start, end.pose || end, fields, epsilon)) continue;
      segments.push({ start, end });
    }
    return segments;
  }

  function activeMotionSegment(keyframes = [], time = 0, fields = ["x", "y"], epsilon = 0.0001) {
    const currentTime = finiteNumber(time, 0);
    return motionSegments(keyframes, fields, epsilon).find(({ start, end }) => {
      if (["hold", "cut"].includes(normalizeTransition(end.transition))) return false;
      return currentTime >= Number(start.time) - epsilon && currentTime < Number(end.time) - epsilon;
    }) || null;
  }

  function rescaleKeyframeTimes(keyframes = [], previousDuration = 1, nextDuration = 1, maximumDuration = 60) {
    const previous = finiteNumber(previousDuration, 0);
    const next = finiteNumber(nextDuration, previous);
    const maximum = Math.max(1, finiteNumber(maximumDuration, 60));
    if (!Array.isArray(keyframes) || previous <= 0 || next <= 0 || Math.abs(previous - next) < 0.000001) {
      return Array.isArray(keyframes) ? keyframes.map((keyframe) => ({ ...keyframe })) : [];
    }
    const scale = next / previous;
    return keyframes.map((keyframe) => ({
      ...keyframe,
      time: Number(clamp(finiteNumber(keyframe?.time, 0) * scale, 0, maximum).toFixed(6)),
    }));
  }

  const pathModes = ["straight", "horizontal", "vertical", "arc-left", "arc-right", "free-curve", "drone", "jib-up", "jib-down"];

  function normalizePathMode(value, sourceType = "actor") {
    const mode = pathModes.includes(value) ? value : "straight";
    if (sourceType !== "camera" && ["drone", "jib-up", "jib-down"].includes(mode)) return "straight";
    return mode;
  }

  function constrainPathEndpoint(start = {}, end = {}, mode = "straight", sourceType = "actor") {
    const normalized = normalizePathMode(mode, sourceType);
    const next = { ...end };
    if (normalized === "horizontal") {
      const startY = finiteNumber(start.y, finiteNumber(next.y, 0.5));
      const delta = startY - finiteNumber(next.y, startY);
      next.y = startY;
      if (sourceType === "camera" && next.moveAimWithCamera !== false && Number.isFinite(Number(next.aimY))) {
        next.aimY = finiteNumber(next.aimY) + delta;
      }
    }
    if (normalized === "vertical") {
      const startX = finiteNumber(start.x, finiteNumber(next.x, 0.5));
      const delta = startX - finiteNumber(next.x, startX);
      next.x = startX;
      if (sourceType === "camera" && next.moveAimWithCamera !== false && Number.isFinite(Number(next.aimX))) {
        next.aimX = finiteNumber(next.aimX) + delta;
      }
    }
    return next;
  }

  function circularArcPoint(start = {}, end = {}, progress = 0, side = 1, bulge = 0.32) {
    const t = clamp(Number(progress), 0, 1);
    const x1 = finiteNumber(start.x, 0);
    const y1 = finiteNumber(start.y, 0);
    const x2 = finiteNumber(end.x, x1);
    const y2 = finiteNumber(end.y, y1);
    const dx = x2 - x1;
    const dy = y2 - y1;
    const chord = Math.hypot(dx, dy);
    if (chord < 0.000001 || t <= 0) return { x: x1, y: y1 };
    if (t >= 1) return { x: x2, y: y2 };

    const signedSide = finiteNumber(side, 1) < 0 ? -1 : 1;
    const sagitta = chord * clamp(Math.abs(finiteNumber(bulge, 0.32)), 0.05, 0.49);
    const radius = chord * chord / (8 * sagitta) + sagitta / 2;
    const midpointX = (x1 + x2) / 2;
    const midpointY = (y1 + y2) / 2;
    const perpendicularX = -dy / chord;
    const perpendicularY = dx / chord;
    const centerOffset = radius - sagitta;
    const centerX = midpointX - perpendicularX * signedSide * centerOffset;
    const centerY = midpointY - perpendicularY * signedSide * centerOffset;
    const startAngle = Math.atan2(y1 - centerY, x1 - centerX);
    const endAngle = Math.atan2(y2 - centerY, x2 - centerX);
    let delta = ((endAngle - startAngle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    if (signedSide > 0 && delta > 0) delta -= Math.PI * 2;
    if (signedSide < 0 && delta < 0) delta += Math.PI * 2;
    const angle = startAngle + delta * t;
    return {
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius,
    };
  }

  function quadraticBezierPoint(start = {}, control = {}, end = {}, progress = 0) {
    const t = clamp(Number(progress), 0, 1);
    const inverse = 1 - t;
    return {
      x: inverse * inverse * finiteNumber(start.x, 0)
        + 2 * inverse * t * finiteNumber(control.x, 0)
        + t * t * finiteNumber(end.x, 0),
      y: inverse * inverse * finiteNumber(start.y, 0)
        + 2 * inverse * t * finiteNumber(control.y, 0)
        + t * t * finiteNumber(end.y, 0),
    };
  }

  function pointDistance(start = {}, end = {}) {
    return Math.hypot(
      finiteNumber(end.x, 0) - finiteNumber(start.x, 0),
      finiteNumber(end.y, 0) - finiteNumber(start.y, 0),
    );
  }

  function quadraticBezierArcLengthPoint(start = {}, control = {}, end = {}, progress = 0, sampleCount = 48) {
    const targetProgress = clamp(Number(progress), 0, 1);
    if (targetProgress <= 0) return quadraticBezierPoint(start, control, end, 0);
    if (targetProgress >= 1) return quadraticBezierPoint(start, control, end, 1);

    const steps = Math.round(clamp(finiteNumber(sampleCount, 48), 12, 128));
    const samples = [];
    let previous = quadraticBezierPoint(start, control, end, 0);
    let totalDistance = 0;
    samples.push({ t: 0, point: previous, distance: 0 });

    for (let index = 1; index <= steps; index += 1) {
      const t = index / steps;
      const point = quadraticBezierPoint(start, control, end, t);
      totalDistance += pointDistance(previous, point);
      samples.push({ t, point, distance: totalDistance });
      previous = point;
    }

    if (totalDistance <= 0.000001) return quadraticBezierPoint(start, control, end, targetProgress);
    const targetDistance = totalDistance * targetProgress;
    for (let index = 1; index < samples.length; index += 1) {
      const current = samples[index];
      if (current.distance < targetDistance) continue;
      const before = samples[index - 1];
      const span = Math.max(0.000001, current.distance - before.distance);
      const localProgress = clamp((targetDistance - before.distance) / span, 0, 1);
      const remappedT = before.t + (current.t - before.t) * localProgress;
      return quadraticBezierPoint(start, control, end, remappedT);
    }
    return quadraticBezierPoint(start, control, end, 1);
  }

  function samplePlanarPath(start = {}, end = {}, progress = 0, mode = "straight", options = {}) {
    const t = clamp(Number(progress), 0, 1);
    const sourceType = options.sourceType || "camera";
    const normalized = normalizePathMode(mode, sourceType);
    if (normalized === "arc-left" || normalized === "arc-right") {
      return circularArcPoint(start, end, t, normalized === "arc-left" ? 1 : -1, options.bulge);
    }
    if (normalized === "free-curve") {
      const control = options.control || {
        x: (finiteNumber(start.x, 0) + finiteNumber(end.x, 0)) / 2,
        y: (finiteNumber(start.y, 0) + finiteNumber(end.y, 0)) / 2,
      };
      if (sourceType === "camera" && options.constantSpeed !== false) {
        return quadraticBezierArcLengthPoint(start, control, end, t, options.arcLengthSamples);
      }
      return quadraticBezierPoint(start, control, end, t);
    }
    if (normalized === "horizontal") {
      return {
        x: finiteNumber(start.x, 0) + (finiteNumber(end.x, 0) - finiteNumber(start.x, 0)) * t,
        y: finiteNumber(start.y, 0),
      };
    }
    if (normalized === "vertical") {
      return {
        x: finiteNumber(start.x, 0),
        y: finiteNumber(start.y, 0) + (finiteNumber(end.y, 0) - finiteNumber(start.y, 0)) * t,
      };
    }
    return {
      x: finiteNumber(start.x, 0) + (finiteNumber(end.x, 0) - finiteNumber(start.x, 0)) * t,
      y: finiteNumber(start.y, 0) + (finiteNumber(end.y, 0) - finiteNumber(start.y, 0)) * t,
    };
  }

  return {
    CAMERA_FOCAL_MAX,
    CAMERA_FOCAL_MIN,
    CAMERA_MOTION_PRESETS,
    CAMERA_PRESET_MAX_COORD,
    CAMERA_PRESET_MIN_COORD,
    activeMotionSegment,
    buildCameraMotionPreset,
    cameraDirectionVector,
    cameraGroundDirection,
    cameraMotionPresetDefinition,
    cameraReferenceProgress,
    circularArcPoint,
    clamp,
    cloneValue,
    constrainPathEndpoint,
    discreteAtDestination,
    finiteNumber,
    heldActorBodyPose,
    installReferenceFrameSemantics,
    interpolateFocalLength,
    motionSegments,
    normalizePathMode,
    normalizeTransition,
    orbitCameraPose,
    pointDistance,
    poseFieldsChanged,
    quadraticBezierArcLengthPoint,
    quadraticBezierPoint,
    rescaleKeyframeTimes,
    samplePlanarPath,
    smoothReferenceProgress,
    transitionProgress,
    translateCameraPose,
  };
});
