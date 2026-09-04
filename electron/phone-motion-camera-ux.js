(() => {
  "use strict";

  if (document.documentElement.dataset.frisframePhoneMotionCameraUx === "1") return;
  document.documentElement.dataset.frisframePhoneMotionCameraUx = "1";

  const STABILIZATION_KEY = "frisframe.phoneMotion.stabilization";
  const STABILIZATION_PRESETS = Object.freeze({
    raw: { label:"RAW", positionHalfLifeMs:0, angleHalfLifeMs:0, focalHalfLifeMs:0 },
    direct: { label:"DIRECT", positionHalfLifeMs:12, angleHalfLifeMs:8, focalHalfLifeMs:24 },
    handheld: { label:"HANDHELD", positionHalfLifeMs:55, angleHalfLifeMs:32, focalHalfLifeMs:75 },
    cinema: { label:"CINEMA", positionHalfLifeMs:115, angleHalfLifeMs:82, focalHalfLifeMs:120 },
  });
  const TAKE_HISTORY_LIMIT = 20;

  let anchor = null;
  let calibrationId = -1;
  let lastMotionAt = 0;
  let diagnostic = null;
  let pairingRefresh = 0;
  let stabilizationPreset = Object.prototype.hasOwnProperty.call(STABILIZATION_PRESETS, localStorage.getItem(STABILIZATION_KEY))
    ? localStorage.getItem(STABILIZATION_KEY)
    : "direct";
  let stabilizer = null;
  let activeTake = null;
  let pendingStart = null;
  let pendingFinish = false;
  let livePreviewPose = null;
  let lastOperatorMode = "idle";

  const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, Number(value) || 0));
  const core = () => window.FrisFramePhoneMotionCore;
  const inputs = () => window.FrisFrameCameraOperatorInputs;
  const operator = () => window.FrisFrameCameraOperator;
  const cloneValue = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const round = (value, digits = 3) => Number(Number(value || 0).toFixed(digits));
  const angleDelta = (from, to) => {
    let delta = ((Number(to || 0) - Number(from || 0)) % 360 + 360) % 360;
    if (delta > 180) delta -= 360;
    return delta;
  };

  function currentCamera() {
    return {
      x:Number(state.camera.x || 0),
      y:Number(state.camera.y || 0),
      height:Number(state.camera.height || 1.6),
      panDeg:Number(state.camera.panDeg || 0),
      tiltDeg:Number(state.camera.tiltDeg || 0),
      focal:Number(state.camera.focal || 35),
    };
  }

  function effectiveCamera() {
    const base = currentCamera();
    if (operator()?.mode !== "idle" || !livePreviewPose) return base;
    return {
      ...base,
      x:Number(livePreviewPose.x),
      y:Number(livePreviewPose.y),
      height:Number(livePreviewPose.height),
      panDeg:Number(livePreviewPose.panDeg),
      tiltDeg:Number(livePreviewPose.tiltDeg),
      focal:Number(livePreviewPose.focal || base.focal),
    };
  }

  function snapshotTakeStart() {
    return {
      startedAt:new Date().toISOString(),
      startTime:Number(state.motion?.playhead || 0),
      startPose:currentCamera(),
    };
  }

  function markTakeStart() {
    if (inputs()?.mode !== "phone") return;
    pendingFinish = false;
    pendingStart = snapshotTakeStart();
  }

  function markTakeFinish() {
    if (inputs()?.mode !== "phone" || operator()?.mode !== "recording") return;
    pendingFinish = true;
  }

  function movementPhrase(value, positive, negative, metric) {
    const amount = Math.abs(Number(value || 0));
    const epsilon = metric ? 0.015 : 0.04;
    if (amount < epsilon) return "";
    const direction = Number(value) >= 0 ? positive : negative;
    return metric ? `${direction} ${amount.toFixed(2)} m` : direction;
  }

  function rotationPhrase(value, positive, negative) {
    const amount = Math.abs(Number(value || 0));
    if (amount < 0.5) return "";
    return `${Number(value) >= 0 ? positive : negative} ${amount.toFixed(1)}°`;
  }

  function beginTakeTelemetry() {
    if (activeTake || operator()?.mode !== "recording") return activeTake;
    const start = pendingStart || snapshotTakeStart();
    pendingStart = null;
    activeTake = {
      schemaVersion:1,
      id:`physical_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`,
      source:"physical-camera",
      startedAt:start.startedAt,
      startTime:Number(start.startTime),
      startPose:cloneValue(start.startPose),
      stabilization:stabilizationPreset,
      samples:0,
      metricSamples:0,
      visualSamples:0,
      heldTranslationSamples:0,
      confidenceSum:0,
      confidenceMin:1,
      confidenceMax:0,
      confidenceLast:0,
      lastDiagnostic:null,
    };
    return activeTake;
  }

  function recordTakeDiagnostic(value) {
    if (!activeTake || !value?.translation) return;
    const confidence = clamp(value.translation.confidence, 0, 1);
    activeTake.samples += 1;
    if (value.translation.metric === true && value.trackingMode === "webxr") activeTake.metricSamples += 1;
    else activeTake.visualSamples += 1;
    if (value.stabilization?.heldTranslation === true) activeTake.heldTranslationSamples += 1;
    activeTake.confidenceSum += confidence;
    activeTake.confidenceMin = Math.min(activeTake.confidenceMin, confidence);
    activeTake.confidenceMax = Math.max(activeTake.confidenceMax, confidence);
    activeTake.confidenceLast = confidence;
    activeTake.lastDiagnostic = cloneValue(value);
  }

  function buildTakeContext() {
    if (!activeTake || activeTake.samples < 1) return null;
    const endPose = currentCamera();
    const endTime = Number(state.motion?.playhead || activeTake.startTime);
    const allMetric = activeTake.metricSamples === activeTake.samples && activeTake.visualSamples === 0;
    const mixed = activeTake.metricSamples > 0 && activeTake.visualSamples > 0;
    const trackingMode = mixed ? "mixed" : (allMetric ? "webxr" : "visual-flow");
    const translation = activeTake.lastDiagnostic?.translation || {};
    const confidenceAverage = activeTake.samples ? activeTake.confidenceSum / activeTake.samples : 0;
    const moves = [
      movementPhrase(translation.dolly, "dolly in", "dolly out", allMetric),
      movementPhrase(translation.truck, "truck right", "truck left", allMetric),
      movementPhrase(translation.pedestal, "pedestal up", "pedestal down", allMetric),
    ].filter(Boolean);
    const rotations = [
      rotationPhrase(angleDelta(activeTake.startPose.panDeg, endPose.panDeg), "pan right", "pan left"),
      rotationPhrase(Number(endPose.tiltDeg) - Number(activeTake.startPose.tiltDeg), "tilt up", "tilt down"),
    ].filter(Boolean);
    const modeCopy = allMetric ? "WebXR 6DoF metric tracking" : (mixed ? "mixed WebXR / Visual Flow non-metric tracking" : "Visual Flow non-metric tracking");
    const movementCopy = moves.length
      ? (allMetric ? `Measured local-space camera movement: ${moves.join(", ")}.` : `Relative camera movement intent: ${moves.join(", ")}.`)
      : "Camera translation remained nearly locked.";
    const rotationCopy = rotations.length ? ` Camera rotation: ${rotations.join(", ")}.` : "";
    const guard = allMetric
      ? " Preserve this measured relative camera trajectory; distances are local-space displacement from the recentered take origin, not absolute world coordinates."
      : " Use movement direction, rhythm, and framing intent only; do not infer or state an exact physical travel distance.";
    const promptSeed = `Physical Camera Take: ${modeCopy}, ${STABILIZATION_PRESETS[activeTake.stabilization]?.label || activeTake.stabilization} stabilization. ${movementCopy}${rotationCopy} Average tracking confidence ${Math.round(confidenceAverage * 100)}%.${guard}`;

    return {
      schemaVersion:1,
      id:activeTake.id,
      source:"physical-camera",
      createdAt:new Date().toISOString(),
      startTime:round(activeTake.startTime),
      endTime:round(endTime),
      duration:round(Math.max(0, endTime - activeTake.startTime)),
      stabilization:activeTake.stabilization,
      tracking:{
        mode:trackingMode,
        metric:allMetric,
        samples:activeTake.samples,
        metricSamples:activeTake.metricSamples,
        visualSamples:activeTake.visualSamples,
        heldTranslationSamples:activeTake.heldTranslationSamples,
        confidence:{
          average:round(confidenceAverage),
          minimum:round(activeTake.confidenceMin),
          maximum:round(activeTake.confidenceMax),
          last:round(activeTake.confidenceLast),
        },
        translation:{
          truck:round(translation.truck),
          pedestal:round(translation.pedestal),
          dolly:round(translation.dolly),
          units:allMetric ? "meters-local-space" : "relative-virtual-travel",
        },
      },
      camera:{
        start:cloneValue(activeTake.startPose),
        end:cloneValue(endPose),
        panDelta:round(angleDelta(activeTake.startPose.panDeg, endPose.panDeg)),
        tiltDelta:round(Number(endPose.tiltDeg) - Number(activeTake.startPose.tiltDeg)),
      },
      promptSeed,
      promptPolicy:{
        finalPromptOwner:"mcp-client",
        metricDistanceAllowed:allMetric,
        distanceGuard:allMetric
          ? "WebXR values are measured local-space displacement relative to the recentered take origin."
          : "Use direction and relative movement intent only; do not infer or state an exact physical travel distance.",
      },
    };
  }

  function finalizeTakeContextBeforeCommit() {
    if (!activeTake || operator()?.mode !== "recording") return null;
    const take = buildTakeContext();
    if (!take) return null;
    state.motion = state.motion || {};
    const previous = Array.isArray(state.motion.cameraOperatorTakes)
      ? state.motion.cameraOperatorTakes.filter((entry) => entry && typeof entry === "object")
      : [];
    state.motion.cameraOperatorTakes = [...previous, take].slice(-TAKE_HISTORY_LIMIT);
    state.motion.latestCameraOperatorTakeId = take.id;
    activeTake = null;
    pendingStart = null;
    return take;
  }

  function isFinalOperatorCommit(args) {
    const options = args?.[0];
    const preservesCamera = Array.isArray(options?.preserveSourceIds) && options.preserveSourceIds.includes("camera");
    const maximum = Number.isFinite(Number(globalThis.MAX_TIMELINE_DURATION)) ? Number(globalThis.MAX_TIMELINE_DURATION) : 60;
    const timelineEnded = Number(state.motion?.playhead || 0) >= maximum - 0.001;
    return preservesCamera && (pendingFinish || timelineEnded);
  }

  function installCommitHook() {
    if (typeof commit !== "function" || commit.__frisframePhysicalTakeHook === true) return;
    const originalCommit = commit;
    const wrappedCommit = function (...args) {
      if (isFinalOperatorCommit(args)) finalizeTakeContextBeforeCommit();
      const result = originalCommit.apply(this, args);
      if (isFinalOperatorCommit(args)) pendingFinish = false;
      return result;
    };
    wrappedCommit.__frisframePhysicalTakeHook = true;
    commit = wrappedCommit;
  }

  function installOperatorFinishHook() {
    const op = operator();
    if (!op || typeof op.finish !== "function" || op.finish.__frisframePhysicalTakeHook === true) return;
    const originalFinish = op.finish;
    const wrappedFinish = function (...args) {
      markTakeFinish();
      return originalFinish.apply(this, args);
    };
    wrappedFinish.__frisframePhysicalTakeHook = true;
    op.finish = wrappedFinish;
  }

  function installDesktopLifecycleCapture() {
    document.getElementById("cameraOperatorBtn")?.addEventListener("click", () => {
      if (operator()?.mode === "recording") markTakeFinish();
    }, true);
    const captureStart = () => {
      const op = operator();
      if (inputs()?.mode !== "phone" || !op) return;
      if (op.mode === "armed") markTakeStart();
      else if (op.mode === "idle") {
        requestAnimationFrame(() => {
          if (operator()?.mode === "recording" && !activeTake && !pendingStart) markTakeStart();
        });
      }
    };
    document.getElementById("cameraFrame")?.addEventListener("pointerdown", captureStart, true);
  }

  function createStabilizer() {
    const motionCore = core();
    if (!motionCore?.createPoseStabilizer) return null;
    return motionCore.createPoseStabilizer({
      ...STABILIZATION_PRESETS[stabilizationPreset],
      holdTranslationOnLowConfidence:true,
    });
  }

  function resetTrackingAnchor() {
    anchor = null;
    calibrationId = -1;
    stabilizer = createStabilizer();
    diagnostic = null;
  }

  function setStabilizationPreset(value) {
    if (!Object.prototype.hasOwnProperty.call(STABILIZATION_PRESETS, value)) return;
    stabilizationPreset = value;
    localStorage.setItem(STABILIZATION_KEY, value);
    resetTrackingAnchor();
    updatePresetButtons();
    if (typeof notifyApp === "function") {
      notifyApp(`Physical Camera 안정화 · ${STABILIZATION_PRESETS[value].label} · 현재 자세에서 재센터`);
    }
  }

  function applyPoseToState(pose, targetState = state) {
    if (!pose || !targetState?.camera) return;
    const op = operator();
    const minimum = Number.isFinite(Number(globalThis.STAGE_COORD_MIN)) ? Number(globalThis.STAGE_COORD_MIN) : -0.25;
    const maximum = Number.isFinite(Number(globalThis.STAGE_COORD_MAX)) ? Number(globalThis.STAGE_COORD_MAX) : 1.25;
    targetState.camera.x = clamp(pose.x, minimum, maximum);
    targetState.camera.y = clamp(pose.y, minimum, maximum);
    targetState.camera.height = clamp(pose.height, 0.4, 35);
    targetState.camera.focal = Number(pose.focal || targetState.camera.focal || 35);
    if (targetState.camera.trackingTargetId) {
      if (typeof op?.maintainTracking === "function") op.maintainTracking(targetState, targetState.motion?.playhead);
      else if (typeof applyCameraTracking === "function") applyCameraTracking(targetState);
    } else {
      targetState.camera.panDeg = ((Number(pose.panDeg) % 360) + 360) % 360;
      targetState.camera.tiltDeg = clamp(pose.tiltDeg, -89, 89);
      if (typeof syncCameraDerivedAim === "function") syncCameraDerivedAim(targetState.camera, targetState);
    }
  }

  function renderExternalFrame(previewPose = null) {
    let renderState = state;
    if (typeof interpolateStateAtTime === "function") {
      try { renderState = interpolateStateAtTime(state.motion.playhead); } catch { renderState = state; }
    }
    const previewing = Boolean(previewPose) && operator()?.mode === "idle";
    if (renderState === state && previewing) {
      renderState = { ...state, camera:{ ...state.camera } };
    } else if (renderState !== state) {
      renderState.camera = { ...renderState.camera, ...state.camera };
    }
    if (previewing) applyPoseToState(previewPose, renderState);
    evaluatedViewState = renderState;
    if (typeof draw === "function") draw(renderState);
    if (typeof viewMode !== "undefined" && viewMode === "3d" && typeof renderThreeView === "function") {
      renderThreeView(renderState, true);
    }
  }

  function clearLivePreview({ render = true, resetAnchor = true } = {}) {
    const hadPreview = Boolean(livePreviewPose);
    livePreviewPose = null;
    if (resetAnchor) resetTrackingAnchor();
    if (render && hadPreview) renderExternalFrame();
  }

  function adoptLivePreviewIntoOperator() {
    const op = operator();
    if (!livePreviewPose || op?.mode !== "armed") return false;
    const pose = cloneValue(livePreviewPose);
    livePreviewPose = null;
    if (typeof op.adoptStartPose === "function") op.adoptStartPose(pose, "phone");
    else {
      applyPoseToState(pose, state);
      renderExternalFrame();
    }
    return true;
  }

  function physicalCommandCapture(event) {
    const detail = event?.detail || {};
    const physical = detail.motion && typeof detail.motion === "object";
    if (!physical || inputs()?.mode !== "phone") return;
    const op = operator();
    if (!op) return;

    if (detail.command === "toggle-record" && op.mode === "idle") {
      event.stopImmediatePropagation();
      activeTake = null;
      pendingStart = null;
      pendingFinish = false;
      op.arm({ ensureStartKey:true });
      if (op.mode === "armed") {
        const adoptedPreview = adoptLivePreviewIntoOperator();
        markTakeStart();
        if (typeof op?.startPhysical === "function") op.startPhysical();
        else {
          const starter = inputs()?.startRecording;
          if (typeof starter === "function") starter();
        }
        if (typeof notifyApp === "function") {
          notifyApp(adoptedPreview
            ? "Physical Camera REC · LIVE 프리뷰 구도에서 바로 촬영을 시작합니다."
            : "Physical Camera REC · 현재 카메라 구도에서 촬영을 시작합니다.");
        }
      }
      updateDesktopBadge();
      return;
    }

    if (detail.command === "toggle-record" && op.mode === "armed") {
      markTakeStart();
      return;
    }

    if ((detail.command === "toggle-record" || detail.command === "stop") && op.mode === "recording") {
      markTakeFinish();
      return;
    }

    if (detail.command === "stop" && op.mode === "armed") {
      event.stopImmediatePropagation();
      activeTake = null;
      pendingStart = null;
      pendingFinish = false;
      op.cancel?.("Physical Camera STBY를 취소했습니다.");
      resetTrackingAnchor();
      updateDesktopBadge();
    }
  }

  function applyPhysicalMotion(detail) {
    const motion = detail?.motion;
    if (!motion?.enabled || inputs()?.mode !== "phone") return;
    const op = operator();
    if (!op || !["idle", "armed", "recording"].includes(op.mode) || !core()) return;
    lastMotionAt = Number(detail.receivedAt || Date.now());
    if (op.mode === "recording") beginTakeTelemetry();
    const nextCalibration = Math.max(0, Math.trunc(Number(motion.calibrationId) || 0));
    if (!anchor || nextCalibration !== calibrationId) {
      calibrationId = nextCalibration;
      anchor = core().createAnchor(motion, effectiveCamera());
      stabilizer = createStabilizer();
    }

    const size = typeof stageWorldSize === "function" ? stageWorldSize(state) : { width:10,depth:10 };
    const directionCamera = op.mode === "idle" && livePreviewPose
      ? { ...state.camera, ...livePreviewPose }
      : state.camera;
    const direction = typeof cameraDirection === "function" ? cameraDirection(directionCamera) : { x:1,z:0 };
    const rawPose = core().derivePose(anchor, motion, {
      stageWidth:Number(size.width || 10),
      stageDepth:Number(size.depth || 10),
      forward:direction,
      virtualTravelScale:1.75,
      confidenceThreshold:0.2,
    });
    if (!rawPose) return;
    const pose = stabilizer?.update(rawPose, lastMotionAt) || rawPose;
    diagnostic = pose.diagnostic;

    if (op.mode === "idle") {
      livePreviewPose = cloneValue(pose);
      renderExternalFrame(livePreviewPose);
      updateDesktopBadge();
      return;
    }

    livePreviewPose = null;
    applyPoseToState(pose, state);
    if (op.mode === "recording") recordTakeDiagnostic(diagnostic);
    renderExternalFrame();
    updateDesktopBadge();
  }

  function updateDesktopBadge() {
    const badge = document.querySelector("[data-frisframe-phone-motion-badge]");
    if (!badge) return;
    const opMode = operator()?.mode || "idle";
    const standby = opMode === "armed";
    const recording = opMode === "recording";
    const live = Date.now() - lastMotionAt < 900;
    const confidence = diagnostic?.translation?.confidence != null
      ? Math.round(diagnostic.translation.confidence * 100)
      : 0;
    const held = diagnostic?.stabilization?.heldTranslation === true;
    const metric = diagnostic?.translation?.metric === true;
    const previewing = opMode === "idle" && Boolean(livePreviewPose) && live;
    const targetLocked = Boolean(state?.camera?.trackingTargetId);
    const phase = previewing ? "LIVE · " : (standby ? "STBY · " : (recording ? "REC · " : ""));
    badge.textContent = live
      ? (targetLocked
        ? `${phase}TRACK TARGET · Pan/Tilt 타깃 고정`
        : (held
          ? `${phase}회전 추적 · 이동 HOLD · ${confidence}% ${metric ? "XR" : "visual"}`
          : (metric
            ? `${phase}WebXR 6DoF · METRIC · ${STABILIZATION_PRESETS[stabilizationPreset].label}`
            : `${phase}실제 모션 연결 · ${confidence}% visual · ${STABILIZATION_PRESETS[stabilizationPreset].label}`)))
      : (standby ? "STBY · 실제 모션 대기" : "실제 모션 대기");
    badge.classList.toggle("is-live", live);
    badge.classList.toggle("is-hold", live && held);
    badge.classList.toggle("is-metric", live && metric);
    badge.classList.toggle("is-standby", standby);
    badge.classList.toggle("is-preview", previewing);
  }

  function updatePresetButtons() {
    document.querySelectorAll("[data-phone-motion-stabilization]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.phoneMotionStabilization === stabilizationPreset);
    });
  }

  function motionQr(url) {
    if (!url || typeof window.qrcode !== "function") return "";
    try {
      const qr = window.qrcode(0, "M");
      qr.addData(url, "Byte");
      qr.make();
      return qr.createSvgTag({cellSize:4,margin:4,scalable:true,alt:"FrisFrame 실제 모션 카메라 QR",title:"FrisFrame Physical Camera"});
    } catch { return ""; }
  }

  async function refreshPairingUi() {
    const panel = document.querySelector(".frisframe-phone-pairing");
    if (!panel || panel.hidden || !window.frisframePhoneRemote?.status) return;
    const now = Date.now();
    if (now - pairingRefresh < 900) return;
    pairingRefresh = now;
    let config = null;
    try { config = await window.frisframePhoneRemote.status(); } catch { return; }
    const motion = config?.motion;
    const url = motion?.bootstrapUrls?.[0] || "";
    let box = panel.querySelector("[data-frisframe-phone-motion-box]");
    if (!box) {
      box = document.createElement("div");
      box.dataset.frisframePhoneMotionBox = "1";
      box.innerHTML = `<div class="frisframe-phone-motion-head"><b>📱 실제 모션 카메라</b><span data-frisframe-phone-motion-badge>실제 모션 대기</span></div><div class="frisframe-phone-motion-body"></div>`;
      panel.appendChild(box);
    }
    const body = box.querySelector(".frisframe-phone-motion-body");
    if (!body) return;
    if (!url) {
      body.innerHTML = `<div class="frisframe-phone-url">Physical Camera 브리지가 준비되지 않았습니다.</div>`;
      return;
    }
    const qr = motionQr(url);
    body.innerHTML = `<div class="frisframe-phone-motion-layout">${qr ? `<div class="frisframe-phone-motion-qr">${qr}</div>` : ""}<div class="frisframe-phone-motion-copy"><div class="frisframe-phone-url"></div><div class="frisframe-phone-control-note">QR → 로컬 CA 설치 → HTTPS 모션 카메라. 연결되면 REC 전에도 LIVE 3D 프리뷰가 움직입니다. 휴대폰 REC를 누르면 현재 LIVE 구도를 Take 시작점으로 채택해 바로 촬영합니다.</div><button type="button" class="text-btn" data-copy-motion-url>설정 주소 복사</button>${motion?.tls?.available ? `<small>HTTPS 준비됨</small>` : `<small>HTTPS 불가 · ${String(motion?.tls?.error || "OpenSSL unavailable")}</small>`}</div></div><div class="frisframe-phone-motion-stabilization"><span>STABILIZATION</span>${Object.entries(STABILIZATION_PRESETS).map(([key,preset]) => `<button type="button" data-phone-motion-stabilization="${key}" class="${key === stabilizationPreset ? "is-active" : ""}">${preset.label}</button>`).join("")}<button type="button" data-phone-motion-recenter>RECENTER</button></div><small class="frisframe-phone-motion-privacy">WebXR 모드만 물리적 local-space 위치를 meter로 사용합니다. DIRECT는 짧은 안정화만 적용해 조작 지연을 최소화하고, RAW는 필터 없이 센서값을 따릅니다. Visual Flow는 실제 이동거리 측정값이 아닙니다. Tracking Target이 활성화된 카메라는 Pan/Tilt가 타깃 추적으로 고정됩니다.</small>`;
    const urlNode = body.querySelector(".frisframe-phone-url");
    if (urlNode) urlNode.textContent = url;
    body.querySelector("[data-copy-motion-url]")?.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(url); if (typeof notifyApp === "function") notifyApp("실제 모션 카메라 설정 주소를 복사했습니다."); } catch {}
    });
    body.querySelectorAll("[data-phone-motion-stabilization]").forEach((button) => {
      button.addEventListener("click", () => setStabilizationPreset(button.dataset.phoneMotionStabilization));
    });
    body.querySelector("[data-phone-motion-recenter]")?.addEventListener("click", () => {
      resetTrackingAnchor();
      if (typeof notifyApp === "function") notifyApp("Physical Camera를 현재 카메라 위치에 재센터했습니다.");
    });
    updatePresetButtons();
    updateDesktopBadge();
  }

  const style = document.createElement("style");
  style.textContent = `
    [data-frisframe-phone-motion-box]{display:grid;gap:6px;padding-top:7px;border-top:1px solid rgba(255,255,255,.07)}
    .frisframe-phone-motion-head{display:flex;justify-content:space-between;gap:8px;align-items:center;font-size:9px;color:#d9e1e8}
    [data-frisframe-phone-motion-badge]{font-size:8px;color:#7f8a94}[data-frisframe-phone-motion-badge].is-live{color:#9ce3af}[data-frisframe-phone-motion-badge].is-hold{color:#ffd18a}[data-frisframe-phone-motion-badge].is-metric{color:#7ed9ff}[data-frisframe-phone-motion-badge].is-standby{color:#ffca88}[data-frisframe-phone-motion-badge].is-preview{color:#a8e8ff}
    .frisframe-phone-motion-layout{display:grid;grid-template-columns:86px minmax(0,1fr);gap:9px;align-items:center}.frisframe-phone-motion-copy{display:grid;gap:5px;min-width:0}
    .frisframe-phone-motion-qr{width:86px;height:86px;padding:4px;background:#fff;border-radius:5px;overflow:hidden}.frisframe-phone-motion-qr svg{width:100%;height:100%;display:block}
    .frisframe-phone-motion-copy small,.frisframe-phone-motion-privacy{font-size:7px;color:#7e8993;overflow-wrap:anywhere;line-height:1.35}
    .frisframe-phone-motion-stabilization{display:grid;grid-template-columns:auto repeat(5,minmax(0,1fr));gap:4px;align-items:center}.frisframe-phone-motion-stabilization span{font-size:7px;color:#77828c}.frisframe-phone-motion-stabilization button{min-height:23px;padding:0 4px;border:1px solid rgba(255,255,255,.1);border-radius:5px;background:rgba(255,255,255,.025);color:#8f9aa4;font-size:7px;font-weight:850}.frisframe-phone-motion-stabilization button.is-active{color:#eef4f7;border-color:rgba(255,107,85,.55);background:rgba(255,107,85,.12)}
  `;
  document.head.appendChild(style);

  stabilizer = createStabilizer();
  installCommitHook();
  installOperatorFinishHook();
  installDesktopLifecycleCapture();
  window.addEventListener("frisframe:phone-remote-input", physicalCommandCapture, true);
  window.addEventListener("frisframe:phone-remote-input", (event) => applyPhysicalMotion(event.detail || {}));
  setInterval(() => {
    const opMode = operator()?.mode || "idle";
    if (opMode === "idle") {
      activeTake = null;
      pendingStart = null;
      pendingFinish = false;
    }
    if (lastOperatorMode !== "idle" && opMode === "idle") {
      livePreviewPose = null;
      resetTrackingAnchor();
    }
    lastOperatorMode = opMode;
    const previewStale = livePreviewPose && Date.now() - lastMotionAt >= 1200;
    const wrongInput = livePreviewPose && inputs()?.mode !== "phone";
    if (opMode === "idle" && (previewStale || wrongInput)) clearLivePreview();
    refreshPairingUi();
    updateDesktopBadge();
  }, 700);
  window.FrisFramePhoneMotionCamera = Object.freeze({
    get connected() { return Date.now() - lastMotionAt < 900; },
    get diagnostic() { return diagnostic ? cloneValue(diagnostic) : null; },
    get stabilization() { return stabilizationPreset; },
    get livePreview() { return livePreviewPose ? cloneValue(livePreviewPose) : null; },
    get standby() { return operator()?.mode === "armed"; },
    get recordingTake() { return activeTake ? cloneValue(activeTake) : null; },
    get latestTakeContext() {
      const takes = Array.isArray(state?.motion?.cameraOperatorTakes) ? state.motion.cameraOperatorTakes : [];
      const id = state?.motion?.latestCameraOperatorTakeId;
      const take = takes.find((entry) => entry?.id === id) || takes.at(-1) || null;
      return take ? cloneValue(take) : null;
    },
    setStabilization: setStabilizationPreset,
    recenter: resetTrackingAnchor,
  });
})();