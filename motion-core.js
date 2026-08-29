(function initMotionCore(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FrisFrameMotionCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createMotionCore() {
  const CAMERA_FOCAL_MIN = 14;
  const CAMERA_FOCAL_MAX = 135;
  const CAMERA_PRESET_MIN_COORD = 0.01;
  const CAMERA_PRESET_MAX_COORD = 0.99;
  const SEEDANCE_REFERENCE_MAX_SECONDS = 30;
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

  function composeBaseInterpolatedPose({
    sourceId = "",
    from = {},
    to = {},
    progress = 0,
    spatial = {},
    transformed = null,
  } = {}) {
    const t = clamp(progress, 0, 1);
    const lerpValue = (start, end) => finiteNumber(start, 0) + (finiteNumber(end, finiteNumber(start, 0)) - finiteNumber(start, 0)) * t;
    const lerpAngleDegrees = (start, end) => {
      const fromAngle = finiteNumber(start, 0);
      const toAngle = finiteNumber(end, fromAngle);
      const delta = ((toAngle - fromAngle + 540) % 360) - 180;
      return (fromAngle + delta * t + 360) % 360;
    };

    if (sourceId === "camera") {
      return {
        ...from,
        x: finiteNumber(spatial.x, from.x),
        y: finiteNumber(spatial.y, from.y),
        height: finiteNumber(spatial.height, from.height),
        panDeg: lerpAngleDegrees(from.panDeg, to.panDeg),
        tiltDeg: lerpValue(from.tiltDeg, to.tiltDeg),
        focal: Math.round(lerpValue(from.focal, to.focal)),
        focusDistanceM: lerpValue(from.focusDistanceM, to.focusDistanceM),
        trackingTargetId: t < 0.5 ? from.trackingTargetId : to.trackingTargetId,
      };
    }

    const resolvedTransform = transformed || from;
    const keyedBodyPose = from.type === "actor"
      ? (t >= 0.999 ? to.bodyPose : from.bodyPose)
      : null;
    return {
      ...from,
      x: finiteNumber(spatial.x, from.x),
      y: finiteNumber(spatial.y, from.y),
      size: resolvedTransform.size,
      scaleX: resolvedTransform.scaleX,
      scaleY: resolvedTransform.scaleY,
      scaleZ: resolvedTransform.scaleZ,
      verticalOffset: from.type === "actor" ? finiteNumber(spatial.height, from.verticalOffset) : from.verticalOffset,
      mountedHeight: from.type === "prop" ? finiteNumber(spatial.height, from.mountedHeight) : from.mountedHeight,
      pitch: lerpValue(Number(from.pitch || 0), Number(to.pitch || 0)),
      facing: lerpAngleDegrees(from.facing, to.facing),
      bodyPose: keyedBodyPose,
      color: to.color,
      shape: to.shape,
      assetType: to.assetType,
      mountId: t < 0.5 ? from.mountId : to.mountId,
      seatIndex: t < 0.5 ? from.seatIndex : to.seatIndex,
      name: to.name,
      visible: t < 0.5 ? from.visible !== false : to.visible !== false,
    };
  }

  function smoothReferenceProgress(progress) {
    const t = clamp(progress, 0, 1);
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  function smoothReferenceEaseInProgress(progress) {
    const t = clamp(progress, 0, 1);
    return 2 * t * t - t * t * t;
  }

  function smoothReferenceEaseOutProgress(progress) {
    const t = clamp(progress, 0, 1);
    return t + t * t - t * t * t;
  }

  function cameraReferenceProgress(progress, transition = "smooth", options = {}) {
    const t = clamp(progress, 0, 1);
    if (String(transition || "smooth") !== "smooth") return t;
    const hasSmoothBefore = options?.hasSmoothBefore === true;
    const hasSmoothAfter = options?.hasSmoothAfter === true;
    if (hasSmoothBefore && hasSmoothAfter) return t;
    if (hasSmoothBefore) return smoothReferenceEaseOutProgress(t);
    if (hasSmoothAfter) return smoothReferenceEaseInProgress(t);
    return smoothReferenceProgress(t);
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
      evaluationOptions = null,
    ) {
      const inputProgress = clamp(progress, 0, 1);
      const referenceProgressOverride = Number(evaluationOptions?.referenceProgress);
      const evaluatedProgress = sourceId === "camera"
        ? (Number.isFinite(referenceProgressOverride)
          ? clamp(referenceProgressOverride, 0, 1)
          : cameraReferenceProgress(inputProgress, endKeyframe?.transition || "smooth"))
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
        evaluationOptions,
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

  function safeFileSlug(value, fallback = "cut") {
    const normalized = String(value || "")
      .normalize("NFKC")
      .trim()
      .replace(/[\\/:*?"<>|]+/g, "-")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^[.-]+|[.-]+$/g, "")
      .slice(0, 80);
    return normalized || fallback;
  }

  function collectReferenceBatchCuts(project = {}) {
    const entries = [];
    (project.scenes || []).forEach((scene, sceneIndex) => {
      (scene.cuts || []).forEach((cut, cutIndex) => {
        const blocking = cut?.blocking;
        const duration = finiteNumber(blocking?.motion?.duration, 0);
        if (!blocking || duration <= 0) return;
        const sceneNumber = Number(scene.number || sceneIndex + 1);
        const cutNumber = Number(cut.number || cutIndex + 1);
        const base = `S${String(sceneNumber).padStart(2, "0")}_C${String(cutNumber).padStart(2, "0")}_${safeFileSlug(cut.title || "cut")}`;
        entries.push({
          sceneId: scene.id || "",
          cutId: cut.id || "",
          sceneNumber,
          cutNumber,
          sceneHeading: scene.heading || "",
          title: cut.title || "",
          status: cut.status || "",
          filename: `${base}_reference.mp4`,
          blocking: cloneValue(blocking),
          duration,
          fps: clamp(Math.round(finiteNumber(blocking.motion?.fps, 24)), 12, 60),
        });
      });
    });
    return entries;
  }

  function addReadinessIssue(issues, severity, code, message) {
    issues.push({ severity, code, message });
  }

  function isFrameAligned(time, fps, toleranceSeconds = 0.001) {
    const safeFps = Math.max(1, finiteNumber(fps, 24));
    const safeTime = finiteNumber(time, 0);
    const frame = Math.round(safeTime * safeFps);
    return Math.abs(safeTime - frame / safeFps) <= Math.max(0.000001, toleranceSeconds);
  }

  function referenceTailDiscreteEvents(blocking = {}, exportRange = {}, fps = 24) {
    const motion = blocking?.motion || {};
    const duration = Math.max(0, finiteNumber(motion.duration, 0));
    const rangeStart = clamp(finiteNumber(exportRange.start, 0), 0, duration);
    const rangeEnd = clamp(finiteNumber(exportRange.end, duration), 0, duration);
    if (!(rangeEnd > rangeStart)) return { lastSampleTime: rangeStart, events: [] };

    const schedule = referenceExportFrameSchedule({ start: rangeStart, end: rangeEnd, fps });
    const lastSampleTime = schedule.times.length ? schedule.times[schedule.times.length - 1] : rangeStart;
    if (lastSampleTime >= rangeEnd - 0.0000005) return { lastSampleTime, events: [] };

    const keyframes = [...(Array.isArray(motion.keyframes) ? motion.keyframes : [])]
      .filter((keyframe) => Number.isFinite(Number(keyframe?.time)))
      .sort((a, b) => Number(a.time) - Number(b.time));
    const items = Array.isArray(blocking?.items) ? blocking.items : [];
    const camera = blocking?.camera || {};
    const events = [];

    keyframes.forEach((keyframe, index) => {
      const time = finiteNumber(keyframe?.time, -1);
      if (time <= lastSampleTime + 0.0000005 || time > rangeEnd + 0.0000005 || time < rangeStart - 0.0000005) return;
      const source = keyframe?.source || "";
      const fallbackPose = source === "camera"
        ? camera
        : (items.find((item) => item?.id === source) || {});
      let previousPose = { ...fallbackPose };
      for (let previousIndex = index - 1; previousIndex >= 0; previousIndex -= 1) {
        const candidate = keyframes[previousIndex];
        if (candidate?.source !== source) continue;
        if (finiteNumber(candidate?.time, time) >= time - 0.0000005) continue;
        previousPose = { ...fallbackPose, ...(candidate?.pose || {}) };
        break;
      }
      const currentPose = { ...fallbackPose, ...(keyframe?.pose || {}) };
      const reasons = [];
      const transition = normalizeTransition(keyframe?.transition);
      if (transition === "hold" || transition === "cut") reasons.push(transition);
      if (source === "camera") {
        if (String(previousPose.trackingTargetId || "") !== String(currentPose.trackingTargetId || "")) {
          reasons.push("tracking");
        }
      } else if (fallbackPose?.type === "actor") {
        const previousBodyPose = JSON.stringify(previousPose.bodyPose ?? null);
        const currentBodyPose = JSON.stringify(currentPose.bodyPose ?? null);
        if (previousBodyPose !== currentBodyPose) reasons.push("actor-pose");
      }
      if (!reasons.length) return;
      events.push({
        id: keyframe?.id || "",
        source,
        time,
        reasons,
      });
    });

    return { lastSampleTime, events };
  }

  function evaluateReferenceReadiness(blocking = {}, metadata = {}) {
    const issues = [];
    const motion = blocking?.motion || {};
    const duration = finiteNumber(motion.duration, 0);
    const fps = finiteNumber(motion.fps, 24);
    const keyframes = Array.isArray(motion.keyframes) ? motion.keyframes : [];
    const items = Array.isArray(blocking.items) ? blocking.items : [];
    const actors = items.filter((item) => item?.type === "actor");
    const itemIds = new Set(items.map((item) => item?.id).filter(Boolean));
    const camera = blocking.camera || {};

    if (!(duration > 0)) addReadinessIssue(issues, "error", "duration-invalid", "컷 길이가 0초이거나 올바르지 않습니다.");
    else if (duration > SEEDANCE_REFERENCE_MAX_SECONDS) addReadinessIssue(issues, "warning", "duration-long", `컷 길이가 ${SEEDANCE_REFERENCE_MAX_SECONDS}초를 넘습니다. Seedance 입력용으로 구간 분할을 검토하세요.`);
    if (!Number.isFinite(Number(fps)) || fps < 12 || fps > 60) addReadinessIssue(issues, "error", "fps-invalid", "FPS는 12–60 범위여야 합니다.");

    const exportRange = motion.exportRange || { start: 0, end: duration };
    const rangeStart = finiteNumber(exportRange.start, 0);
    const rangeEnd = finiteNumber(exportRange.end, duration);
    if (rangeStart < 0 || rangeEnd > duration + 0.0005 || rangeEnd <= rangeStart) {
      addReadinessIssue(issues, "error", "export-range-invalid", "MP4 출력 구간이 컷 길이 안에서 올바르게 설정되지 않았습니다.");
    } else if (rangeEnd - rangeStart > SEEDANCE_REFERENCE_MAX_SECONDS) {
      addReadinessIssue(issues, "warning", "export-range-long", `실제 MP4 출력 구간이 ${SEEDANCE_REFERENCE_MAX_SECONDS}초를 넘습니다.`);
    }

    const cameraFields = ["x", "y", "height", "panDeg", "tiltDeg", "focal"];
    const invalidCameraFields = cameraFields.filter((field) => !Number.isFinite(Number(camera[field])));
    if (invalidCameraFields.length) addReadinessIssue(issues, "error", "camera-invalid", `카메라 값이 올바르지 않습니다: ${invalidCameraFields.join(", ")}`);
    const focal = Number(camera.focal);
    if (Number.isFinite(focal) && (focal < CAMERA_FOCAL_MIN || focal > CAMERA_FOCAL_MAX)) {
      addReadinessIssue(issues, "error", "lens-out-of-range", `렌즈가 지원 범위(${CAMERA_FOCAL_MIN}–${CAMERA_FOCAL_MAX}mm)를 벗어났습니다.`);
    }

    function trackingExists(trackingTargetId) {
      return !trackingTargetId || actors.some((actor) => actor.id === trackingTargetId);
    }
    if (!trackingExists(camera.trackingTargetId)) addReadinessIssue(issues, "error", "tracking-missing", "카메라 Tracking 대상이 현재 컷의 배우 목록에 없습니다.");

    let offFrameGrid = 0;
    let invalidPoseCount = 0;
    const seenSourceTimes = [];
    keyframes.forEach((keyframe) => {
      const time = Number(keyframe?.time);
      if (!Number.isFinite(time) || time < -0.0005 || time > duration + 0.0005) {
        addReadinessIssue(issues, "error", "key-time-out-of-range", `${keyframe?.label || keyframe?.id || "키"} 시간이 컷 길이 밖에 있습니다.`);
        return;
      }
      if (!isFrameAligned(time, fps)) offFrameGrid += 1;
      const source = keyframe?.source || "";
      if (source !== "camera" && !itemIds.has(source)) addReadinessIssue(issues, "error", "key-source-missing", `${keyframe?.label || keyframe?.id || "키"}의 대상이 현재 컷에 없습니다.`);
      const duplicate = seenSourceTimes.some((entry) => entry.source === source && Math.abs(entry.time - time) <= 0.0000005);
      if (duplicate) addReadinessIssue(issues, "error", "duplicate-key-time", `${source || "대상"}에 같은 시점의 키가 중복되어 있습니다.`);
      else seenSourceTimes.push({ source, time });
      const pose = keyframe?.pose || {};
      const numericFields = source === "camera" ? ["x", "y", "height", "panDeg", "tiltDeg", "focal"] : ["x", "y", "facing"];
      if (numericFields.some((field) => pose[field] !== undefined && !Number.isFinite(Number(pose[field])))) invalidPoseCount += 1;
      if (source === "camera" && !trackingExists(pose.trackingTargetId)) addReadinessIssue(issues, "error", "tracking-key-missing", `${keyframe?.label || keyframe?.id || "카메라 키"}의 Tracking 대상이 없습니다.`);
    });
    if (invalidPoseCount) addReadinessIssue(issues, "error", "key-pose-invalid", `숫자 값이 깨진 키가 ${invalidPoseCount}개 있습니다.`);
    if (offFrameGrid) addReadinessIssue(issues, "warning", "keys-off-frame-grid", `${offFrameGrid}개 키가 ${Math.round(fps)}FPS 프레임 틱에서 벗어나 있습니다.`);

    let tailDiscrete = { lastSampleTime: rangeStart, events: [] };
    const validRangeForSampling = rangeStart >= 0
      && rangeEnd <= duration + 0.0005
      && rangeEnd > rangeStart;
    const validFpsForSampling = Number.isFinite(Number(fps)) && fps >= 12 && fps <= 60;
    if (validRangeForSampling && validFpsForSampling) {
      tailDiscrete = referenceTailDiscreteEvents(blocking, { start: rangeStart, end: rangeEnd }, fps);
      if (tailDiscrete.events.length) {
        addReadinessIssue(
          issues,
          "warning",
          "tail-discrete-event-unsampled",
          `${tailDiscrete.events.length}개 도착 전환이 마지막 CFR 샘플(${tailDiscrete.lastSampleTime.toFixed(3)}초) 뒤에 있어 MP4에 직접 나타나지 않습니다. 키를 최소 1프레임 앞당기거나 출력 구간을 늘리세요.`,
        );
      }
    }

    const errorCount = issues.filter((issue) => issue.severity === "error").length;
    const warningCount = issues.filter((issue) => issue.severity === "warning").length;
    const score = clamp(100 - errorCount * 25 - warningCount * 8, 0, 100);
    const status = errorCount ? "blocked" : warningCount ? "review" : "ready";
    return {
      status,
      score,
      errorCount,
      warningCount,
      issues,
      stats: {
        duration,
        fps,
        keyCount: keyframes.length,
        actorCount: actors.length,
        cameraKeyCount: keyframes.filter((keyframe) => keyframe.source === "camera").length,
        tailDiscreteEventCount: tailDiscrete.events.length,
      },
      metadata: {
        sceneNumber: metadata.sceneNumber || 0,
        cutNumber: metadata.cutNumber || 0,
        title: metadata.title || "",
      },
    };
  }

  function evaluateProjectReferenceReadiness(project = {}) {
    return collectReferenceBatchCuts(project).map((entry) => ({
      ...entry,
      readiness: evaluateReferenceReadiness(entry.blocking, entry),
    }));
  }

  function referenceEntryKey(entry = {}) {
    if (entry.sceneId || entry.cutId) return `${entry.sceneId || ""}::${entry.cutId || ""}`;
    return `n:${Number(entry.sceneNumber || 0)}:${Number(entry.cutNumber || 0)}`;
  }

  function cutReferenceKey(scene = {}, cut = {}, sceneIndex = 0, cutIndex = 0) {
    if (scene.id || cut.id) return `${scene.id || ""}::${cut.id || ""}`;
    return `n:${Number(scene.number || sceneIndex + 1)}:${Number(cut.number || cutIndex + 1)}`;
  }

  function partitionReferenceBatchByReadiness(project = {}) {
    const results = evaluateProjectReferenceReadiness(project) || [];
    const allowed = results.filter((entry) => entry?.readiness?.status !== "blocked");
    const blocked = results.filter((entry) => entry?.readiness?.status === "blocked");
    const allowedKeys = new Set(allowed.map(referenceEntryKey));
    const filteredProject = cloneValue(project);
    filteredProject.scenes = (filteredProject.scenes || []).map((scene, sceneIndex) => ({
      ...scene,
      cuts: (scene.cuts || []).filter((cut, cutIndex) => allowedKeys.has(cutReferenceKey(scene, cut, sceneIndex, cutIndex))),
    }));
    const skippedBlocked = blocked.map((entry) => ({
      sceneId: entry.sceneId || "",
      cutId: entry.cutId || "",
      sceneNumber: Number(entry.sceneNumber || 0),
      cutNumber: Number(entry.cutNumber || 0),
      title: entry.title || "",
      readiness: {
        status: "blocked",
        score: Number(entry.readiness?.score || 0),
        issues: cloneValue(entry.readiness?.issues || []),
      },
    }));
    return { results, allowed, blocked, filteredProject, skippedBlocked };
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

  function sourceKeyframeEvaluationPlan(keyframes = [], time = 0) {
    const keys = Array.isArray(keyframes) ? keyframes : [];
    if (!keys.length) return { kind: "fallback" };
    const currentTime = finiteNumber(time, 0);
    const first = keys[0];
    if (keys.length === 1 || currentTime <= finiteNumber(first?.time, 0)) {
      return { kind: "key", keyframe: first };
    }
    const last = keys[keys.length - 1];
    if (currentTime >= finiteNumber(last?.time, currentTime)) {
      return { kind: "key", keyframe: last };
    }

    let start = first;
    let end = last;
    let segmentIndex = 0;
    for (let index = 0; index < keys.length - 1; index += 1) {
      const candidateStart = keys[index];
      const candidateEnd = keys[index + 1];
      const candidateStartTime = finiteNumber(candidateStart?.time, 0);
      const candidateEndTime = finiteNumber(candidateEnd?.time, candidateStartTime);
      if (currentTime >= candidateStartTime && currentTime <= candidateEndTime) {
        start = candidateStart;
        end = candidateEnd;
        segmentIndex = index;
        break;
      }
    }

    const transition = normalizeTransition(end?.transition);
    const startTime = finiteNumber(start?.time, 0);
    const endTime = finiteNumber(end?.time, startTime);
    const easedProgress = transitionProgress(currentTime, startTime, endTime, transition);
    const rawProgress = clamp((currentTime - startTime) / Math.max(0.000001, endTime - startTime), 0, 1);
    // Spatial blocking crosses ordinary keys without braking. Camera reference
    // easing is planned separately so a run of smooth camera keys does not
    // decelerate to zero at every interior marker.
    const progress = transition === "smooth" || transition === "linear" ? rawProgress : easedProgress;
    const hasSmoothBefore = transition === "smooth"
      && segmentIndex > 0
      && normalizeTransition(start?.transition) === "smooth";
    const hasSmoothAfter = transition === "smooth"
      && segmentIndex + 2 < keys.length
      && normalizeTransition(keys[segmentIndex + 2]?.transition) === "smooth";
    const referenceProgress = transition === "smooth"
      ? cameraReferenceProgress(rawProgress, transition, { hasSmoothBefore, hasSmoothAfter })
      : progress;
    return {
      kind: "segment",
      start,
      end,
      transition,
      rawProgress,
      easedProgress,
      progress,
      referenceProgress,
      hasSmoothBefore,
      hasSmoothAfter,
    };
  }

  function composeEvaluatedFrameBase(renderState = {}, time = 0, evaluateSource = null) {
    if (typeof evaluateSource !== "function") {
      throw new TypeError("composeEvaluatedFrameBase requires a source evaluator");
    }
    const duration = Math.max(0, finiteNumber(renderState?.motion?.duration, 0));
    const safeTime = clamp(time, 0, duration);
    const next = cloneValue(renderState);
    next.camera = evaluateSource("camera", safeTime, renderState?.camera || {});
    next.items = (Array.isArray(renderState?.items) ? renderState.items : []).map((item) => (
      evaluateSource(item.id, safeTime, item)
    ));
    next.motion = { ...(next.motion || {}), playhead: safeTime };
    return next;
  }

  function referenceExportFrameSchedule({ start = 0, end = 0, fps = 24, minFrameCount = 2 } = {}) {
    const safeStart = finiteNumber(start, 0);
    const safeEnd = Math.max(safeStart, finiteNumber(end, safeStart));
    const safeFps = Math.max(1, Math.round(clamp(finiteNumber(fps, 24), 1, 60)));
    const minimum = Math.max(2, Math.round(finiteNumber(minFrameCount, 2)));
    const duration = Math.max(0.01, safeEnd - safeStart);
    const frameCount = Math.max(minimum, Math.round(duration * safeFps));
    const times = Array.from({ length: frameCount }, (_entry, index) => (
      Math.min(safeEnd, safeStart + index / safeFps)
    ));
    return { start: safeStart, end: safeEnd, duration, fps: safeFps, frameCount, times };
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
    SEEDANCE_REFERENCE_MAX_SECONDS,
    activeMotionSegment,
    buildCameraMotionPreset,
    cameraDirectionVector,
    cameraGroundDirection,
    cameraMotionPresetDefinition,
    cameraReferenceProgress,
    circularArcPoint,
    clamp,
    cloneValue,
    collectReferenceBatchCuts,
    composeEvaluatedFrameBase,
    composeBaseInterpolatedPose,
    constrainPathEndpoint,
    discreteAtDestination,
    evaluateProjectReferenceReadiness,
    evaluateReferenceReadiness,
    finiteNumber,
    heldActorBodyPose,
    installReferenceFrameSemantics,
    interpolateFocalLength,
    isFrameAligned,
    motionSegments,
    normalizePathMode,
    normalizeTransition,
    orbitCameraPose,
    partitionReferenceBatchByReadiness,
    pointDistance,
    poseFieldsChanged,
    quadraticBezierArcLengthPoint,
    quadraticBezierPoint,
    referenceEntryKey,
    referenceExportFrameSchedule,
    referenceTailDiscreteEvents,
    rescaleKeyframeTimes,
    safeFileSlug,
    samplePlanarPath,
    smoothReferenceProgress,
    sourceKeyframeEvaluationPlan,
    transitionProgress,
    translateCameraPose,
  };
});
