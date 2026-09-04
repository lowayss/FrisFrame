(() => {
  "use strict";

  function splineClamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, Number(value) || 0));
  }

  function splineNormalizeAngle(value) {
    const normalized = Number(value) % 360;
    return normalized < 0 ? normalized + 360 : normalized;
  }

  function splineShortestAngleDelta(from, to) {
    let delta = splineNormalizeAngle(to) - splineNormalizeAngle(from);
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    return delta;
  }

  function splineHermite(start, end, startVelocity, endVelocity, progress, span) {
    const t = splineClamp(progress, 0, 1);
    const t2 = t * t;
    const t3 = t2 * t;
    const h00 = 2 * t3 - 3 * t2 + 1;
    const h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2;
    const h11 = t3 - t2;
    return h00 * start
      + h10 * startVelocity * span
      + h01 * end
      + h11 * endVelocity * span;
  }

  function splineScalarJoinTangent(previous, current, next, previousTime, currentTime, nextTime) {
    const leftSpan = Number(currentTime) - Number(previousTime);
    const rightSpan = Number(nextTime) - Number(currentTime);
    const hasLeft = leftSpan > 0.000001;
    const hasRight = rightSpan > 0.000001;
    if (!hasLeft && !hasRight) return 0;
    if (!hasLeft) return (Number(next) - Number(current)) / Math.max(0.000001, rightSpan);
    if (!hasRight) return (Number(current) - Number(previous)) / Math.max(0.000001, leftSpan);

    const incoming = (Number(current) - Number(previous)) / leftSpan;
    const outgoing = (Number(next) - Number(current)) / rightSpan;
    const incomingAbs = Math.abs(incoming);
    const outgoingAbs = Math.abs(outgoing);
    // A real hold or a real reversal should still be allowed to come to rest.
    if (incomingAbs < 0.000001 || outgoingAbs < 0.000001 || incoming * outgoing < 0) return 0;

    let tangent = (Number(next) - Number(previous)) / Math.max(0.000001, Number(nextTime) - Number(previousTime));
    const limit = Math.max(0.000001, Math.min(
      Math.max(incomingAbs, outgoingAbs) * 1.35,
      (incomingAbs + outgoingAbs) * 0.9,
    ));
    if (Math.abs(tangent) > limit) tangent = Math.sign(tangent) * limit;
    return tangent;
  }

  function splineVectorJoinTangent(previous, current, next, previousTime, currentTime, nextTime) {
    const leftSpan = Number(currentTime) - Number(previousTime);
    const rightSpan = Number(nextTime) - Number(currentTime);
    const hasLeft = leftSpan > 0.000001;
    const hasRight = rightSpan > 0.000001;
    const velocity = (from, to, span) => ({
      x: (Number(to?.x || 0) - Number(from?.x || 0)) / Math.max(0.000001, span),
      y: (Number(to?.y || 0) - Number(from?.y || 0)) / Math.max(0.000001, span),
    });
    if (!hasLeft && !hasRight) return { x: 0, y: 0 };
    if (!hasLeft) return velocity(current, next, rightSpan);
    if (!hasRight) return velocity(previous, current, leftSpan);

    const incoming = velocity(previous, current, leftSpan);
    const outgoing = velocity(current, next, rightSpan);
    const incomingSpeed = Math.hypot(incoming.x, incoming.y);
    const outgoingSpeed = Math.hypot(outgoing.x, outgoing.y);
    // Preserve an authored stop, and only stop a true turn-around. Unlike scalar
    // PCHIP, an x-axis sign change during a normal curved move must not zero the
    // whole camera velocity at the key.
    if (incomingSpeed < 0.000001 || outgoingSpeed < 0.000001) return { x: 0, y: 0 };
    const directionDot = (incoming.x * outgoing.x + incoming.y * outgoing.y)
      / Math.max(0.000001, incomingSpeed * outgoingSpeed);
    if (directionDot < -0.5) return { x: 0, y: 0 };

    const fullSpan = Math.max(0.000001, Number(nextTime) - Number(previousTime));
    let tangent = {
      x: (Number(next?.x || 0) - Number(previous?.x || 0)) / fullSpan,
      y: (Number(next?.y || 0) - Number(previous?.y || 0)) / fullSpan,
    };
    const tangentSpeed = Math.hypot(tangent.x, tangent.y);
    const limit = Math.max(0.000001, Math.min(
      Math.max(incomingSpeed, outgoingSpeed) * 1.35,
      (incomingSpeed + outgoingSpeed) * 0.9,
    ));
    if (tangentSpeed > limit) {
      const scale = limit / tangentSpeed;
      tangent = { x: tangent.x * scale, y: tangent.y * scale };
    }
    return tangent;
  }

  function interpolateOperatorVectorPose(from, to, progress, continuity) {
    if (!continuity) return null;
    const previous = continuity.previous || from;
    const next = continuity.next || to;
    const previousTime = Number.isFinite(Number(continuity.previousTime))
      ? Number(continuity.previousTime)
      : Number(continuity.startTime);
    const startTime = Number(continuity.startTime);
    const endTime = Number(continuity.endTime);
    const nextTime = Number.isFinite(Number(continuity.nextTime))
      ? Number(continuity.nextTime)
      : endTime;
    const span = Math.max(0.000001, endTime - startTime);
    const t = splineClamp(progress, 0, 1);

    const startPlanarVelocity = splineVectorJoinTangent(
      previous,
      from,
      to,
      previousTime,
      startTime,
      endTime,
    );
    const endPlanarVelocity = splineVectorJoinTangent(
      from,
      to,
      next,
      startTime,
      endTime,
      nextTime,
    );
    const scalar = (field) => {
      const startVelocity = splineScalarJoinTangent(
        previous[field],
        from[field],
        to[field],
        previousTime,
        startTime,
        endTime,
      );
      const endVelocity = splineScalarJoinTangent(
        from[field],
        to[field],
        next[field],
        startTime,
        endTime,
        nextTime,
      );
      return splineHermite(
        Number(from[field] || 0),
        Number(to[field] || 0),
        startVelocity,
        endVelocity,
        t,
        span,
      );
    };

    const fromPan = splineNormalizeAngle(from.panDeg);
    const toPan = fromPan + splineShortestAngleDelta(fromPan, to.panDeg);
    const previousPan = fromPan + splineShortestAngleDelta(fromPan, previous.panDeg);
    const nextPan = toPan + splineShortestAngleDelta(toPan, next.panDeg);
    const startPanVelocity = splineScalarJoinTangent(
      previousPan,
      fromPan,
      toPan,
      previousTime,
      startTime,
      endTime,
    );
    const endPanVelocity = splineScalarJoinTangent(
      fromPan,
      toPan,
      nextPan,
      startTime,
      endTime,
      nextTime,
    );

    return {
      x: splineHermite(Number(from.x || 0), Number(to.x || 0), startPlanarVelocity.x, endPlanarVelocity.x, t, span),
      y: splineHermite(Number(from.y || 0), Number(to.y || 0), startPlanarVelocity.y, endPlanarVelocity.y, t, span),
      height: scalar("height"),
      panDeg: splineNormalizeAngle(splineHermite(fromPan, toPan, startPanVelocity, endPanVelocity, t, span)),
      tiltDeg: scalar("tiltDeg"),
      focal: scalar("focal"),
    };
  }

  const cameraOperatorVectorSplineCore = {
    interpolatePose: interpolateOperatorVectorPose,
    scalarJoinTangent: splineScalarJoinTangent,
    vectorJoinTangent: splineVectorJoinTangent,
  };

  if (typeof module === "object" && module.exports) {
    module.exports = cameraOperatorVectorSplineCore;
    return;
  }

  if (typeof interpolateCameraOperatorPose === "function") {
    // app.js owns the evaluator call site; Camera Operator replaces only the
    // operator-specific interpolation policy after the app has loaded.
    interpolateCameraOperatorPose = interpolateOperatorVectorPose;
  }
  window.FrisFrameCameraOperatorVectorSplineCore = cameraOperatorVectorSplineCore;

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
  const operatorHelp = settings.querySelector(".frisframe-camera-operator-help");

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
  let mouseFallbackActive = false;
  let recordInput = "preview";

  const pointerToken = (event) => event?.pointerId == null ? "mouse" : event.pointerId;
  const isActivePointer = (event) => (
    pointerId != null && (pointerId === "mouse" || pointerToken(event) === pointerId)
  );
  const isCameraFrameControlTarget = (target) => Boolean(target?.closest?.(
    "#cameraFrameMoveHandle, #cameraFrameResizeHandle, #cameraFrameModeBtn",
  ));

  const currentCameraPose = () => ({
    x: Number(state.camera.x || 0),
    y: Number(state.camera.y || 0),
    height: Number(state.camera.height || 0),
    panDeg: normalizeAngle(state.camera.panDeg || 0),
    tiltDeg: Number(state.camera.tiltDeg || 0),
    focal: Number(state.camera.focal || 35),
  });

  const maintainCameraTracking = (targetState = state, time = targetState?.motion?.playhead) => {
    const trackingTargetId = targetState?.camera?.trackingTargetId;
    if (!trackingTargetId || typeof applyCameraTracking !== "function") {
      if (typeof syncCameraDerivedAim === "function" && targetState?.camera) {
        syncCameraDerivedAim(targetState.camera, targetState);
      }
      return;
    }

    // When the target itself is animated, resolve its position at the live
    // playhead. Keep the operator's authored camera position/distance, but
    // borrow only the evaluated target orientation for this frame.
    if (targetState === state && typeof interpolateStateAtTime === "function") {
      try {
        const trackingFrame = interpolateStateAtTime(Number(time));
        if (trackingFrame?.camera) {
          trackingFrame.camera = {
            ...trackingFrame.camera,
            x: targetState.camera.x,
            y: targetState.camera.y,
            height: targetState.camera.height,
            focal: targetState.camera.focal,
            trackingTargetId,
          };
          applyCameraTracking(trackingFrame);
          targetState.camera.panDeg = trackingFrame.camera.panDeg;
          targetState.camera.tiltDeg = trackingFrame.camera.tiltDeg;
          targetState.camera.aimX = trackingFrame.camera.aimX;
          targetState.camera.aimY = trackingFrame.camera.aimY;
          targetState.camera.focusHeight = trackingFrame.camera.focusHeight;
          return;
        }
      } catch (_error) {
        // Fall through to the current authored frame if interpolation is not
        // available during startup or teardown.
      }
    }
    applyCameraTracking(targetState);
  };

  const applyCameraPose = (pose, targetState = state) => {
    targetState.camera.x = Number(pose.x);
    targetState.camera.y = Number(pose.y);
    targetState.camera.height = Number(pose.height);
    targetState.camera.panDeg = normalizeAngle(pose.panDeg);
    targetState.camera.tiltDeg = clamp(pose.tiltDeg, -90, 90);
    targetState.camera.focal = Number(pose.focal || targetState.camera.focal || 35);
    maintainCameraTracking(targetState, targetState?.motion?.playhead);
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
    if (operatorHelp) {
      operatorHelp.textContent = state.camera.trackingTargetId
        ? "트래킹 방향 유지 · 드래그 좌우 Truck · 상하 Dolly(거리) · Shift+드래그 Pedestal · 휠 Dolly · Alt/Option+휠 높이 · Ctrl/⌘ 미세 조작"
        : "드래그 Pan/Tilt · Shift+드래그 Truck/Pedestal · 휠 Dolly · Alt/Option+휠 높이 · Ctrl/⌘ 미세 조작";
    }

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
    const trackingSuffix = state.camera.trackingTargetId
      ? " · 트래킹 방향 유지 · 드래그 이동/거리"
      : " · 타임라인/공간 실시간 재생";
    button.textContent = "■ 촬영 종료";
    status.textContent = `REC ${elapsed.toFixed(2)}초${trackingSuffix}`;
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
    mouseFallbackActive = false;
    recordInput = "preview";
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

  const armOperator = (options = {}) => {
    const ensureStartKey = options?.ensureStartKey === true;
    if (mode !== "idle" || typeof state === "undefined" || !state?.camera || !state?.motion) return;
    if (["position", "orientation", "height"].some((field) => typeof cameraFieldLocked === "function" && cameraFieldLocked(field))) {
      notifyApp("Camera Operator를 쓰려면 카메라 위치·방향·높이 잠금을 해제하세요.");
      return;
    }
    if (typeof cancelPreview === "function") cancelPreview();
    const requestedTime = typeof readTimelineTimeInput === "function"
      ? readTimelineTimeInput(state.motion.playhead)
      : Number(state.motion.playhead || 0);
    const originalCamera = clone(state.camera);
    const originalKeyframes = clone(state.motion.keyframes);
    const cameraKeys = typeof keysForSource === "function" ? keysForSource("camera") : [];
    const canStartAtRequestedTime = requestedTime < maxTimelineTime() - 0.0005;
    const exactKey = canStartAtRequestedTime && cameraKeys.find((keyframe) => (
      typeof timelineTimesMatch === "function"
        ? timelineTimesMatch(keyframe.time, requestedTime)
        : Math.abs(Number(keyframe.time) - Number(requestedTime)) < 0.0005
    ));
    let firstKey = exactKey || (ensureStartKey ? null : [...cameraKeys].sort((left, right) => Number(left.time) - Number(right.time))[0]);
    if (!firstKey && ensureStartKey && canStartAtRequestedTime && typeof captureSourceKeyframe === "function") {
      const createdStartKey = captureSourceKeyframe("camera", requestedTime, undefined, "straight");
      if (createdStartKey) {
        createdStartKey.transition = "linear";
        createdStartKey.operatorContinuity = true;
        createdStartKey.operatorInput = "phone";
        state.motion.keyframes.push(createdStartKey);
        state.motion.keyframes = typeof sortKeyframes === "function" ? sortKeyframes(state.motion.keyframes) : state.motion.keyframes;
        firstKey = createdStartKey;
      }
    }
    if (!firstKey) {
      notifyApp("먼저 카메라 키프레임을 하나 찍어주세요.");
      return;
    }

    startSnapshot = {
      camera: originalCamera,
      keyframes: originalKeyframes,
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
    if (state.camera.trackingTargetId && firstKey?.pose) {
      firstKey.pose = { ...firstKey.pose, trackingTargetId: state.camera.trackingTargetId };
      maintainCameraTracking(state, startTime);
    }
    mode = "armed";
    document.documentElement.classList.add("frisframe-camera-operator-active");
    updateUi();
    renderLiveFrame(startTime);
    const trackingMessage = state.camera.trackingTargetId
      ? "트래킹 방향을 유지하고 카메라 위치·거리를 움직입니다."
      : "카메라 프리뷰를 누르면 타임라인과 함께 REC가 시작됩니다.";
    notifyApp(exactKey
      ? `Camera Operator STBY · ${trackingMessage}`
      : `Camera Operator STBY · ${startTime.toFixed(2)}초에서 ${trackingMessage}`);
  };

  const adoptStartPose = (pose, input = "phone") => {
    if (mode !== "armed" || !pose || !state?.camera) return false;
    applyCameraPose(pose, state);
    const startKey = state.motion.keyframes.find((keyframe) => (
      keyframe.source === "camera" && (
        typeof timelineTimesMatch === "function"
          ? timelineTimesMatch(keyframe.time, startTime)
          : Math.abs(Number(keyframe.time) - Number(startTime)) < 0.0005
      )
    ));
    if (startKey) {
      startKey.pose = { ...startKey.pose, ...currentCameraPose() };
      if (state.camera.trackingTargetId) startKey.pose.trackingTargetId = state.camera.trackingTargetId;
      startKey.transition = "linear";
      startKey.operatorContinuity = true;
      startKey.operatorInput = input;
    }
    dirty = true;
    renderLiveFrame(startTime);
    return true;
  };

  const tickRecording = () => {
    if (mode !== "recording") return;
    const time = operatorTime();
    if (typeof ensureDurationCovers === "function") ensureDurationCovers(time);
    state.motion.playhead = time;
    if (state.camera.trackingTargetId) maintainCameraTracking(state, time);
    const sampleInterval = recordInput === "phone" ? 1 / 60 : 1 / 30;
    if (time - lastSampleTime >= sampleInterval || time >= maxTimelineTime()) sampleCurrentPose(time);
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

  const beginRecording = (event, input = "preview") => {
    if (mode !== "armed" || event.button !== 0) return;
    event.preventDefault();
    if (input !== "world") event.stopPropagation();
    mode = "recording";
    recordInput = input;
    recordStartedAt = performance.now();
    samples = [];
    lastSampleTime = -Infinity;
    dirty = true;
    state.motion.playhead = startTime;
    sampleCurrentPose(startTime);
    updateUi();
    animationFrame = requestAnimationFrame(tickRecording);
    if (input === "world") {
      pointerId = pointerToken(event);
      lastClientX = event.clientX;
      lastClientY = event.clientY;
    } else if (input === "preview") {
      beginPointerControl(event);
    }
  };

  const startPhysicalRecording = () => {
    if (mode === "idle") armOperator({ ensureStartKey:true });
    if (mode !== "armed") return false;
    const event = { button:0, preventDefault(){}, stopPropagation(){} };
    beginRecording(event, "phone");
    return mode === "recording";
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
    if (recordInput !== "preview" || mode !== "recording" || !isActivePointer(event)) return;
    event.preventDefault();
    event.stopPropagation();
    const dx = event.clientX - lastClientX;
    const dy = event.clientY - lastClientY;
    lastClientX = event.clientX;
    lastClientY = event.clientY;
    const precision = event.ctrlKey || event.metaKey ? 0.35 : 1;

    if (state.camera.trackingTargetId && !event.shiftKey) {
      const direction = typeof cameraDirection === "function" ? cameraDirection(state.camera) : { x: 1, z: 0 };
      const horizontal = Math.max(0.0001, Math.hypot(Number(direction.x || 0), Number(direction.z || 0)));
      const forwardX = Number(direction.x || 0) / horizontal;
      const forwardY = Number(direction.z || 0) / horizontal;
      const rightX = -forwardY;
      const rightY = forwardX;
      const size = typeof stageWorldSize === "function" ? stageWorldSize(state) : { width: 10, depth: 10 };
      const frameWidth = Math.max(240, cameraFrame.getBoundingClientRect().width || 480);
      const metersPerPixel = Math.max(0.001, Math.min(Number(size.width || 10), Number(size.depth || 10)) / frameWidth * 0.32) * precision;
      const truckMeters = dx * metersPerPixel;
      const dollyMeters = -dy * metersPerPixel * 1.4;
      state.camera.x = clamp(
        Number(state.camera.x || 0) + (rightX * truckMeters + forwardX * dollyMeters) / Math.max(0.01, Number(size.width || 10)),
        Number.isFinite(Number(STAGE_COORD_MIN)) ? Number(STAGE_COORD_MIN) : -0.25,
        Number.isFinite(Number(STAGE_COORD_MAX)) ? Number(STAGE_COORD_MAX) : 1.25,
      );
      state.camera.y = clamp(
        Number(state.camera.y || 0) + (rightY * truckMeters + forwardY * dollyMeters) / Math.max(0.01, Number(size.depth || 10)),
        Number.isFinite(Number(STAGE_COORD_MIN)) ? Number(STAGE_COORD_MIN) : -0.25,
        Number.isFinite(Number(STAGE_COORD_MAX)) ? Number(STAGE_COORD_MAX) : 1.25,
      );
    } else if (event.shiftKey) {
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
    maintainCameraTracking(state);
    dirty = true;
  };

  const beginWorldCameraRecording = (event) => {
    if (mode !== "armed" || event.button !== 0) return;
    const editor = typeof pickThreeEditor === "function" ? pickThreeEditor(event) : null;
    if (!editor || editor.kind !== "camera") return;
    beginRecording(event, "world");
  };
  const releaseWorldCameraRecording = (event) => {
    if (recordInput !== "world" || !isActivePointer(event)) return;
    releasePointerControl(event);
  };

  // Capture at the frame parent too. On some macOS/Electron input paths the
  // native mouse sequence can miss the transparent preview overlay entirely.
  const beginCameraFramePointerControl = (event) => {
    if (isCameraFrameControlTarget(event.target)) return;
    beginPointerControl(event);
  };
  const applyCameraFramePointerDrag = (event) => {
    if (isCameraFrameControlTarget(event.target)) return;
    applyOperatorDrag(event);
  };
  const releaseCameraFramePointerControl = (event) => {
    if (isCameraFrameControlTarget(event.target)) return;
    if (!isActivePointer(event)) return;
    releasePointerControl(event);
  };
  const beginMouseFallback = (event) => {
    if (event.button !== 0 || isCameraFrameControlTarget(event.target) || pointerId != null) return;
    mouseFallbackActive = true;
    beginPointerControl(event);
  };
  const applyMouseFallback = (event) => {
    if (!mouseFallbackActive || pointerId !== "mouse" || mode !== "recording") return;
    applyOperatorDrag(event);
  };
  const releaseMouseFallback = (event) => {
    if (!mouseFallbackActive) return;
    mouseFallbackActive = false;
    if (pointerId === "mouse") releasePointerControl(event);
  };

  const applyOperatorWheel = (event) => {
    if (recordInput !== "preview" || mode !== "recording") return;
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
    maintainCameraTracking(state);
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
    const phoneTake = recordInput === "phone";
    // Physical Camera already applies sensor-side stabilization. Avoid a second
    // heavy smoothing pass that would erase intentional handheld acceleration,
    // while retaining the original mouse/gamepad baseline stabilization.
    const stabilizationStrength = phoneTake
      ? Math.min(cleanupStrength, 0.08)
      : Math.max(cleanupStrength, 0.16);
    const smoothed = stabilizationStrength > 0
      ? core.smoothSamples(samples, stabilizationStrength)
      : samples.map((sample) => ({ ...sample }));
    // Capture Physical Camera densely, then write an editable 30 Hz source path.
    // Other operator inputs keep the existing 15 Hz editing cadence.
    const resampleStep = phoneTake ? 1 / 30 : 1 / 15;
    const resampled = typeof core.resampleSamples === "function"
      ? core.resampleSamples(smoothed, resampleStep)
      : smoothed;
    const reductionOptions = phoneTake
      ? {
          positionTolerance: 0.00055 + cleanupStrength * 0.0012,
          heightTolerance: 0.006 + cleanupStrength * 0.012,
          angleTolerance: 0.07 + cleanupStrength * 0.12,
          focalTolerance: 0.18,
          maxGap: 0.22 + cleanupStrength * 0.10,
        }
      : {
          positionTolerance: 0.00135 + cleanupStrength * 0.0025,
          heightTolerance: 0.014 + cleanupStrength * 0.026,
          angleTolerance: 0.13 + cleanupStrength * 0.24,
          focalTolerance: 0.25,
          // Continuous vector tangents carry the curve between keys, so forcing a
          // key every ~0.28s only creates extra micro slowdowns. Keep enough keys to
          // preserve operator timing while allowing each spline segment to breathe.
          maxGap: 0.42 + cleanupStrength * 0.18,
        };
    const reduced = core.simplifySamples(resampled, reductionOptions);
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
      keyframe.operatorContinuity = true;
      keyframe.operatorInput = recordInput;
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
  cameraFrame.addEventListener("pointerdown", beginCameraFramePointerControl, true);
  cameraFrame.addEventListener("pointermove", applyCameraFramePointerDrag, true);
  cameraFrame.addEventListener("pointerup", releaseCameraFramePointerControl, true);
  cameraFrame.addEventListener("pointercancel", releaseCameraFramePointerControl, true);
  cameraFrame.addEventListener("mousedown", beginMouseFallback, true);
  window.addEventListener("mousemove", applyMouseFallback, true);
  window.addEventListener("mouseup", releaseMouseFallback, true);
  const threeCanvas = document.getElementById("threeCanvas");
  threeCanvas?.addEventListener("pointerdown", beginWorldCameraRecording, true);
  threeCanvas?.addEventListener("pointerup", releaseWorldCameraRecording, true);
  threeCanvas?.addEventListener("pointercancel", releaseWorldCameraRecording, true);
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
    startPhysical: startPhysicalRecording,
    adoptStartPose,
    cancel: cancelOperator,
    finish: finishOperatorTake,
    liveTimeline: true,
    vectorSpline: true,
    maintainTracking: maintainCameraTracking,
    get mode() { return mode; },
    get controlling() { return pointerId != null; },
  };
  updateUi();
})();
