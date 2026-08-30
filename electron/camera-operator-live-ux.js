(() => {
  "use strict";

  if (document.documentElement.dataset.frisframeCameraOperatorLiveUx === "1") return;
  document.documentElement.dataset.frisframeCameraOperatorLiveUx = "1";

  const core = window.FrisFrameCameraOperatorCore;
  const originalButton = document.getElementById("cameraOperatorBtn");
  const originalSurface = document.querySelector(".frisframe-camera-operator-surface");
  const cameraFrame = document.getElementById("cameraFrame");
  const status = document.getElementById("cameraOperatorStatus");
  const settings = document.getElementById("cameraOperatorSettings");
  const cleanup = document.getElementById("cameraOperatorCleanup");
  const cleanupValue = document.getElementById("cameraOperatorCleanupValue");
  if (!core || !originalButton || !originalSurface || !cameraFrame || !status || !settings || !cleanup || !cleanupValue) return;

  // interaction-ux.js owns the visual shell and smoothing core. Replace only the
  // two event-owning nodes so the live controller below becomes the single input
  // owner without accumulating duplicate click/pointer handlers.
  const button = originalButton.cloneNode(true);
  originalButton.replaceWith(button);
  const surface = originalSurface.cloneNode(true);
  originalSurface.replaceWith(surface);
  const monitorHud = surface.querySelector("#cameraOperatorMonitorHud");

  const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, Number(value) || 0));
  const normalizeAngle = (value) => {
    const normalized = Number(value) % 360;
    return normalized < 0 ? normalized + 360 : normalized;
  };
  const maxTimelineTime = () => Number.isFinite(Number(MAX_TIMELINE_DURATION)) ? Number(MAX_TIMELINE_DURATION) : 60;

  let mode = "idle";
  let pointerId = null;
  let lastClientX = 0;
  let lastClientY = 0;
  let recordStartedAt = 0;
  let animationFrame = 0;
  let samples = [];
  let startSnapshot = null;
  let startTime = 0;
  let lastSampleTime = -Infinity;
  let dirty = true;

  const pointerToken = (event) => event?.pointerId == null ? "mouse" : event.pointerId;
  const isActivePointer = (event) => (
    pointerId != null && (pointerId === "mouse" || pointerToken(event) === pointerId)
  );

  const currentCameraPose = () => ({
    x: Number(state.camera.x || 0),
    y: Number(state.camera.y || 0),
    height: Number(state.camera.height || 0),
    panDeg: normalizeAngle(state.camera.panDeg || 0),
    tiltDeg: Number(state.camera.tiltDeg || 0),
    focal: Number(state.camera.focal || 35),
  });

  const applyCameraPose = (pose, targetState = state) => {
    targetState.camera.x = Number(pose.x);
    targetState.camera.y = Number(pose.y);
    targetState.camera.height = Number(pose.height);
    targetState.camera.panDeg = normalizeAngle(pose.panDeg);
    targetState.camera.tiltDeg = clamp(pose.tiltDeg, -90, 90);
    targetState.camera.focal = Number(pose.focal || targetState.camera.focal || 35);
    targetState.camera.trackingTargetId = "";
    if (typeof syncCameraDerivedAim === "function") syncCameraDerivedAim(targetState.camera, targetState);
  };

  const operatorTime = () => Math.min(
    maxTimelineTime(),
    startTime + Math.max(0, performance.now() - recordStartedAt) / 1000,
  );

  const sampleCurrentPose = (time) => {
    samples.push({ time: Number(time), ...currentCameraPose() });
    lastSampleTime = Number(time);
  };

  const updateUi = () => {
    button.classList.toggle("is-armed", mode === "armed");
    button.classList.toggle("is-recording", mode === "recording");
    settings.hidden = mode === "idle";
    // Keep the preview surface mounted even before STBY. A user should be able
    // to grab the camera preview and drag immediately; the first pointerdown
    // below arms and starts the take without requiring a separate button click.
    surface.hidden = false;
    surface.classList.toggle("is-recording", mode === "recording");
    cameraFrame.classList.toggle("frisframe-camera-operator-monitor", mode !== "idle");
    cameraFrame.classList.toggle("frisframe-camera-operator-recording", mode === "recording");

    if (mode === "idle") {
      button.textContent = "● 직접 촬영";
      status.textContent = "프리뷰를 드래그하면 REC 시작";
      if (monitorHud) monitorHud.textContent = "STBY";
      return;
    }
    if (mode === "armed") {
      button.textContent = "■ STBY 취소";
      status.textContent = "카메라 프리뷰를 누르면 REC 시작";
      if (monitorHud) monitorHud.textContent = "STBY · 화면을 눌러 시작";
      return;
    }
    const elapsed = Math.max(0, Number(state.motion.playhead || startTime) - startTime);
    button.textContent = "■ 촬영 종료";
    status.textContent = `REC ${elapsed.toFixed(2)}초 · 타임라인/공간 실시간 재생`;
    if (monitorHud) monitorHud.textContent = `REC ${elapsed.toFixed(2)}s`;
  };

  const buildLiveRenderState = (time) => {
    const livePose = currentCameraPose();
    let renderState = state;
    if (typeof interpolateStateAtTime === "function") {
      try {
        renderState = interpolateStateAtTime(time);
      } catch (_error) {
        renderState = state;
      }
    }
    if (renderState !== state) {
      renderState.camera = { ...renderState.camera };
      applyCameraPose(livePose, renderState);
    }
    return renderState;
  };

  const renderLiveFrame = (time) => {
    const renderState = buildLiveRenderState(time);
    if (typeof updatePlayheadDisplay === "function") updatePlayheadDisplay(time);
    evaluatedViewState = renderState;
    if (typeof draw === "function") draw(renderState);
  };

  const restoreStartSnapshot = () => {
    if (!startSnapshot) return;
    state.camera = clone(startSnapshot.camera);
    state.motion.keyframes = clone(startSnapshot.keyframes);
    state.motion.duration = startSnapshot.duration;
    state.motion.playhead = startSnapshot.playhead;
    state.motion.activeSource = startSnapshot.activeSource;
    state.motion.selectedKeyId = startSnapshot.selectedKeyId;
    if (typeof setTimelineSelection === "function") {
      setTimelineSelection(startSnapshot.timelineSelection, startSnapshot.primaryKeyId || "", { updateAnchor: false });
    }
    if (typeof syncUi === "function") syncUi();
    if (typeof interpolateStateAtTime === "function") evaluatedViewState = interpolateStateAtTime(state.motion.playhead);
    if (typeof draw === "function") draw(evaluatedViewState || state);
    if (typeof viewMode !== "undefined" && viewMode === "3d" && typeof renderThreeView === "function") {
      renderThreeView(evaluatedViewState || state, true);
    }
  };

  const releasePointerControl = (event) => {
    if (pointerId == null) return;
    if (event && !isActivePointer(event)) return;
    if (pointerId !== "mouse") {
      try { surface.releasePointerCapture?.(pointerId); } catch { /* already released */ }
    }
    pointerId = null;
  };

  const resetRuntime = () => {
    if (animationFrame) cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    releasePointerControl();
    samples = [];
    startSnapshot = null;
    lastSampleTime = -Infinity;
    dirty = true;
    mode = "idle";
    document.documentElement.classList.remove("frisframe-camera-operator-active");
    updateUi();
  };

  const cancelOperator = (message = "카메라 직접 촬영을 취소했습니다.") => {
    if (mode === "idle") return;
    restoreStartSnapshot();
    resetRuntime();
    if (typeof notifyApp === "function") notifyApp(message);
  };

  const armOperator = () => {
    if (mode !== "idle" || typeof state === "undefined" || !state?.camera || !state?.motion) return;
    if (state.camera.trackingTargetId) {
      notifyApp("Camera Operator는 트래킹을 해제한 자유 카메라에서 사용하세요.");
      return;
    }
    if (["position", "orientation", "height"].some((field) => typeof cameraFieldLocked === "function" && cameraFieldLocked(field))) {
      notifyApp("Camera Operator를 쓰려면 카메라 위치·방향·높이 잠금을 해제하세요.");
      return;
    }
    if (typeof cancelPreview === "function") cancelPreview();
    const requestedTime = typeof readTimelineTimeInput === "function"
      ? readTimelineTimeInput(state.motion.playhead)
      : Number(state.motion.playhead || 0);
    const cameraKeys = typeof keysForSource === "function" ? keysForSource("camera") : [];
    const canStartAtRequestedTime = requestedTime < maxTimelineTime() - 0.0005;
    const exactKey = canStartAtRequestedTime && cameraKeys.find((keyframe) => (
      typeof timelineTimesMatch === "function"
        ? timelineTimesMatch(keyframe.time, requestedTime)
        : Math.abs(Number(keyframe.time) - Number(requestedTime)) < 0.0005
    ));
    const firstKey = exactKey || [...cameraKeys].sort((left, right) => Number(left.time) - Number(right.time))[0];
    if (!firstKey) {
      notifyApp("먼저 카메라 키프레임을 하나 찍어주세요.");
      return;
    }

    startSnapshot = {
      camera: clone(state.camera),
      keyframes: clone(state.motion.keyframes),
      duration: Number(state.motion.duration),
      playhead: Number(state.motion.playhead),
      activeSource: state.motion.activeSource,
      selectedKeyId: state.motion.selectedKeyId,
      timelineSelection: typeof selectedTimelineKeyframes === "function"
        ? selectedTimelineKeyframes().map((keyframe) => keyframe.id)
        : [firstKey.id],
      primaryKeyId: typeof primaryTimelineKeyId === "function" ? primaryTimelineKeyId() : firstKey.id,
    };
    startTime = Number(firstKey.time);
    if (typeof materializeEvaluatedViewForEditing === "function") materializeEvaluatedViewForEditing("camera");
    if (typeof setActiveSource === "function") setActiveSource("camera");
    if (typeof selectSourceOnStage === "function") selectSourceOnStage("camera");
    state.motion.playhead = startTime;
    mode = "armed";
    document.documentElement.classList.add("frisframe-camera-operator-active");
    updateUi();
    renderLiveFrame(startTime);
    notifyApp(exactKey
      ? "Camera Operator STBY · 카메라 프리뷰를 누르면 타임라인과 함께 REC가 시작됩니다."
      : `Camera Operator STBY · ${startTime.toFixed(2)}초 첫 카메라 키에서 시작합니다. 카메라 프리뷰를 누르세요.`);
  };

  const tickRecording = () => {
    if (mode !== "recording") return;
    const time = operatorTime();
    if (typeof ensureDurationCovers === "function") ensureDurationCovers(time);
    state.motion.playhead = time;
    if (time - lastSampleTime >= 1 / 30 || time >= maxTimelineTime()) sampleCurrentPose(time);
    if (dirty) {
      dirty = false;
      renderLiveFrame(time);
    } else if (typeof updatePlayheadDisplay === "function") {
      updatePlayheadDisplay(time);
    }
    updateUi();
    if (time >= maxTimelineTime() - 0.0001) {
      finishOperatorTake();
      return;
    }
    animationFrame = requestAnimationFrame(tickRecording);
  };

  const beginRecording = (event) => {
    if (mode !== "armed" || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    mode = "recording";
    recordStartedAt = performance.now();
    samples = [];
    lastSampleTime = -Infinity;
    dirty = true;
    state.motion.playhead = startTime;
    sampleCurrentPose(startTime);
    updateUi();
    animationFrame = requestAnimationFrame(tickRecording);
    beginPointerControl(event);
  };

  const beginPointerControl = (event) => {
    if (mode === "idle" && event.button === 0) {
      armOperator();
      if (mode === "armed") beginRecording(event);
      return;
    }
    if (mode === "armed") {
      beginRecording(event);
      return;
    }
    if (mode !== "recording" || event.button !== 0 || pointerId != null) return;
    event.preventDefault();
    event.stopPropagation();
    pointerId = pointerToken(event);
    lastClientX = event.clientX;
    lastClientY = event.clientY;
    if (pointerId !== "mouse") {
      try { surface.setPointerCapture?.(pointerId); } catch { /* capture is optional */ }
    }
  };

  const applyOperatorDrag = (event) => {
    if (mode !== "recording" || !isActivePointer(event)) return;
    event.preventDefault();
    event.stopPropagation();
    const dx = event.clientX - lastClientX;
    const dy = event.clientY - lastClientY;
    lastClientX = event.clientX;
    lastClientY = event.clientY;
    const precision = event.ctrlKey || event.metaKey ? 0.35 : 1;

    if (event.shiftKey) {
      const direction = typeof cameraDirection === "function" ? cameraDirection(state.camera) : { x: 1, z: 0 };
      const horizontal = Math.max(0.0001, Math.hypot(Number(direction.x || 0), Number(direction.z || 0)));
      const rightX = -Number(direction.z || 0) / horizontal;
      const rightY = Number(direction.x || 0) / horizontal;
      const size = typeof stageWorldSize === "function" ? stageWorldSize(state) : { width: 10, depth: 10 };
      const frameWidth = Math.max(240, cameraFrame.getBoundingClientRect().width || 480);
      const metersPerPixel = Math.max(0.001, Math.min(Number(size.width || 10), Number(size.depth || 10)) / frameWidth * 0.32) * precision;
      state.camera.x = clamp(
        Number(state.camera.x || 0) + rightX * dx * metersPerPixel / Math.max(0.01, Number(size.width || 10)),
        Number.isFinite(Number(STAGE_COORD_MIN)) ? Number(STAGE_COORD_MIN) : -0.25,
        Number.isFinite(Number(STAGE_COORD_MAX)) ? Number(STAGE_COORD_MAX) : 1.25,
      );
      state.camera.y = clamp(
        Number(state.camera.y || 0) + rightY * dx * metersPerPixel / Math.max(0.01, Number(size.depth || 10)),
        Number.isFinite(Number(STAGE_COORD_MIN)) ? Number(STAGE_COORD_MIN) : -0.25,
        Number.isFinite(Number(STAGE_COORD_MAX)) ? Number(STAGE_COORD_MAX) : 1.25,
      );
      state.camera.height = clamp(Number(state.camera.height || 1.6) - dy * 0.0045 * precision, 0.4, 35);
    } else {
      state.camera.panDeg = normalizeAngle(Number(state.camera.panDeg || 0) + dx * 0.12 * precision);
      state.camera.tiltDeg = clamp(Number(state.camera.tiltDeg || 0) - dy * 0.10 * precision, -89, 89);
    }
    if (typeof syncCameraDerivedAim === "function") syncCameraDerivedAim(state.camera, state);
    dirty = true;
  };

  const applyOperatorWheel = (event) => {
    if (mode !== "recording") return;
    event.preventDefault();
    event.stopPropagation();
    const precision = event.ctrlKey || event.metaKey ? 0.35 : 1;
    if (event.altKey) {
      state.camera.height = clamp(Number(state.camera.height || 1.6) - Number(event.deltaY || 0) * 0.004 * precision, 0.4, 35);
    } else {
      const direction = typeof cameraDirection === "function" ? cameraDirection(state.camera) : { x: 1, z: 0 };
      const horizontal = Math.max(0.0001, Math.hypot(Number(direction.x || 0), Number(direction.z || 0)));
      const size = typeof stageWorldSize === "function" ? stageWorldSize(state) : { width: 10, depth: 10 };
      const meters = -Number(event.deltaY || 0) * 0.0035 * precision;
      state.camera.x = clamp(
        Number(state.camera.x || 0) + Number(direction.x || 0) / horizontal * meters / Math.max(0.01, Number(size.width || 10)),
        Number.isFinite(Number(STAGE_COORD_MIN)) ? Number(STAGE_COORD_MIN) : -0.25,
        Number.isFinite(Number(STAGE_COORD_MAX)) ? Number(STAGE_COORD_MAX) : 1.25,
      );
      state.camera.y = clamp(
        Number(state.camera.y || 0) + Number(direction.z || 0) / horizontal * meters / Math.max(0.01, Number(size.depth || 10)),
        Number.isFinite(Number(STAGE_COORD_MIN)) ? Number(STAGE_COORD_MIN) : -0.25,
        Number.isFinite(Number(STAGE_COORD_MAX)) ? Number(STAGE_COORD_MAX) : 1.25,
      );
    }
    if (typeof syncCameraDerivedAim === "function") syncCameraDerivedAim(state.camera, state);
    dirty = true;
  };

  const finishOperatorTake = () => {
    if (mode !== "recording") return;
    if (animationFrame) cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    releasePointerControl();
    const endTime = operatorTime();
    state.motion.playhead = endTime;
    if (endTime - lastSampleTime > 0.001) sampleCurrentPose(endTime);
    if (samples.length < 2 || endTime - startTime < 0.06) {
      cancelOperator("촬영 시간이 너무 짧아 Take를 만들지 않았습니다.");
      return;
    }

    const cleanupStrength = clamp(Number(cleanup.value) / 100, 0, 0.4);
    const smoothed = core.smoothSamples(samples, cleanupStrength);
    const reduced = core.simplifySamples(smoothed, {
      positionTolerance: 0.00135 + cleanupStrength * 0.0025,
      heightTolerance: 0.014 + cleanupStrength * 0.026,
      angleTolerance: 0.13 + cleanupStrength * 0.24,
      focalTolerance: 0.25,
      maxGap: 0.48 + cleanupStrength * 0.35,
    });
    const rawCount = samples.length;
    const previousCameraKeyCount = state.motion.keyframes.filter((keyframe) => (
      keyframe.source === "camera" && Number(keyframe.time) > startTime + 0.0005 && Number(keyframe.time) <= endTime + 0.0005
    )).length;
    state.motion.keyframes = state.motion.keyframes.filter((keyframe) => !(
      keyframe.source === "camera" && Number(keyframe.time) > startTime + 0.0005 && Number(keyframe.time) <= endTime + 0.0005
    ));

    const addedKeys = [];
    for (const sample of reduced.slice(1)) {
      applyCameraPose(sample, state);
      const keyframe = typeof captureSourceKeyframe === "function"
        ? captureSourceKeyframe("camera", sample.time, undefined, "straight")
        : null;
      if (!keyframe) continue;
      keyframe.transition = "linear";
      state.motion.keyframes.push(keyframe);
      addedKeys.push(keyframe);
    }
    state.motion.keyframes = typeof sortKeyframes === "function" ? sortKeyframes(state.motion.keyframes) : state.motion.keyframes;
    const finalSample = reduced.at(-1) || smoothed.at(-1) || samples.at(-1);
    applyCameraPose(finalSample, state);
    state.motion.playhead = Number(finalSample.time);
    if (addedKeys.length && typeof setTimelineSelection === "function") {
      const lastKey = addedKeys.at(-1);
      setTimelineSelection([lastKey.id], lastKey.id);
    }
    if (typeof clearLiveSourceEdit === "function") clearLiveSourceEdit("camera", state.motion.playhead);
    if (typeof commit === "function") commit({ preserveSourceIds: ["camera"] });
    const duration = Number(finalSample.time) - startTime;
    resetRuntime();
    notifyApp(`Camera Operator Take 완료 · ${duration.toFixed(2)}초 · RAW ${rawCount} → 키 ${addedKeys.length + 1}${previousCameraKeyCount ? ` · 기존 키 ${previousCameraKeyCount}개 교체` : ""}`);
  };

  button.addEventListener("click", () => {
    if (mode === "idle") armOperator();
    else if (mode === "armed") cancelOperator();
    else finishOperatorTake();
  });
  surface.addEventListener("pointerdown", beginPointerControl);
  surface.addEventListener("pointermove", applyOperatorDrag);
  surface.addEventListener("pointerup", (event) => {
    if (mode !== "recording" || !isActivePointer(event)) return;
    event.preventDefault();
    event.stopPropagation();
    releasePointerControl(event);
  });
  surface.addEventListener("pointercancel", (event) => releasePointerControl(event));
  surface.addEventListener("wheel", applyOperatorWheel, { passive: false });
  window.addEventListener("blur", () => {
    if (mode !== "idle") cancelOperator("창 포커스가 바뀌어 Camera Operator Take를 취소했습니다.");
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || mode === "idle") return;
    event.preventDefault();
    event.stopPropagation();
    cancelOperator();
  }, true);

  window.FrisFrameCameraOperator = {
    arm: armOperator,
    cancel: cancelOperator,
    finish: finishOperatorTake,
    liveTimeline: true,
    get mode() { return mode; },
    get controlling() { return pointerId != null; },
  };
  updateUi();
})();
