(() => {
  "use strict";

  if (document.documentElement.dataset.frisframePhoneMotionCameraUx === "1") return;
  document.documentElement.dataset.frisframePhoneMotionCameraUx = "1";

  const STABILIZATION_KEY = "frisframe.phoneMotion.stabilization";
  const STABILIZATION_PRESETS = Object.freeze({
    raw: { label:"RAW", positionHalfLifeMs:0, angleHalfLifeMs:0, focalHalfLifeMs:0 },
    handheld: { label:"HANDHELD", positionHalfLifeMs:55, angleHalfLifeMs:32, focalHalfLifeMs:75 },
    cinema: { label:"CINEMA", positionHalfLifeMs:115, angleHalfLifeMs:82, focalHalfLifeMs:120 },
  });

  let anchor = null;
  let calibrationId = -1;
  let lastMotionAt = 0;
  let diagnostic = null;
  let pairingRefresh = 0;
  let stabilizationPreset = Object.prototype.hasOwnProperty.call(STABILIZATION_PRESETS, localStorage.getItem(STABILIZATION_KEY))
    ? localStorage.getItem(STABILIZATION_KEY)
    : "handheld";
  let stabilizer = null;

  const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, Number(value) || 0));
  const core = () => window.FrisFramePhoneMotionCore;
  const inputs = () => window.FrisFrameCameraOperatorInputs;
  const operator = () => window.FrisFrameCameraOperator;

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

  function renderExternalFrame() {
    let renderState = state;
    if (typeof interpolateStateAtTime === "function") {
      try { renderState = interpolateStateAtTime(state.motion.playhead); } catch { renderState = state; }
    }
    if (renderState !== state) renderState.camera = { ...renderState.camera, ...state.camera };
    evaluatedViewState = renderState;
    if (typeof draw === "function") draw(renderState);
    if (typeof viewMode !== "undefined" && viewMode === "3d" && typeof renderThreeView === "function") {
      renderThreeView(renderState, true);
    }
  }

  function applyPhysicalMotion(detail) {
    const motion = detail?.motion;
    if (!motion?.enabled || inputs()?.mode !== "phone") return;
    const op = operator();
    if (!op || op.mode !== "recording" || !core()) return;
    lastMotionAt = Number(detail.receivedAt || Date.now());
    const nextCalibration = Math.max(0, Math.trunc(Number(motion.calibrationId) || 0));
    if (!anchor || nextCalibration !== calibrationId) {
      calibrationId = nextCalibration;
      anchor = core().createAnchor(motion, currentCamera());
      stabilizer = createStabilizer();
    }

    const size = typeof stageWorldSize === "function" ? stageWorldSize(state) : { width:10,depth:10 };
    const direction = typeof cameraDirection === "function" ? cameraDirection(state.camera) : { x:1,z:0 };
    const rawPose = core().derivePose(anchor, motion, {
      stageWidth:Number(size.width || 10),
      stageDepth:Number(size.depth || 10),
      forward:direction,
      virtualTravelScale:1.75,
      confidenceThreshold:0.2,
    });
    if (!rawPose) return;
    const pose = stabilizer?.update(rawPose, lastMotionAt) || rawPose;
    const minimum = Number.isFinite(Number(globalThis.STAGE_COORD_MIN)) ? Number(globalThis.STAGE_COORD_MIN) : -0.25;
    const maximum = Number.isFinite(Number(globalThis.STAGE_COORD_MAX)) ? Number(globalThis.STAGE_COORD_MAX) : 1.25;
    state.camera.x = clamp(pose.x, minimum, maximum);
    state.camera.y = clamp(pose.y, minimum, maximum);
    state.camera.height = clamp(pose.height, 0.4, 35);
    state.camera.focal = Number(pose.focal || state.camera.focal || 35);
    if (state.camera.trackingTargetId) {
      if (typeof op.maintainTracking === "function") op.maintainTracking(state, state.motion?.playhead);
      else if (typeof applyCameraTracking === "function") applyCameraTracking(state);
    } else {
      const normalizedPan = ((Number(pose.panDeg) % 360) + 360) % 360;
      state.camera.panDeg = normalizedPan;
      state.camera.tiltDeg = clamp(pose.tiltDeg, -89, 89);
      if (typeof syncCameraDerivedAim === "function") syncCameraDerivedAim(state.camera, state);
    }
    diagnostic = pose.diagnostic;
    renderExternalFrame();
    updateDesktopBadge();
  }

  function updateDesktopBadge() {
    const badge = document.querySelector("[data-frisframe-phone-motion-badge]");
    if (!badge) return;
    const live = Date.now() - lastMotionAt < 900;
    const confidence = diagnostic?.translation?.confidence != null
      ? Math.round(diagnostic.translation.confidence * 100)
      : 0;
    const held = diagnostic?.stabilization?.heldTranslation === true;
    badge.textContent = live
      ? (held
        ? `회전 추적 · 이동 HOLD · ${confidence}% visual`
        : `실제 모션 연결 · ${confidence}% visual · ${STABILIZATION_PRESETS[stabilizationPreset].label}`)
      : "실제 모션 대기";
    badge.classList.toggle("is-live", live);
    badge.classList.toggle("is-hold", live && held);
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
    body.innerHTML = `<div class="frisframe-phone-motion-layout">${qr ? `<div class="frisframe-phone-motion-qr">${qr}</div>` : ""}<div class="frisframe-phone-motion-copy"><div class="frisframe-phone-url"></div><div class="frisframe-phone-control-note">QR → 로컬 CA 설치 → HTTPS 모션 카메라. 휴대폰 영상은 폰 안에서만 분석됩니다.</div><button type="button" class="text-btn" data-copy-motion-url>설정 주소 복사</button>${motion?.tls?.available ? `<small>HTTPS 준비됨</small>` : `<small>HTTPS 불가 · ${String(motion?.tls?.error || "OpenSSL unavailable")}</small>`}</div></div><div class="frisframe-phone-motion-stabilization"><span>STABILIZATION</span>${Object.entries(STABILIZATION_PRESETS).map(([key,preset]) => `<button type="button" data-phone-motion-stabilization="${key}" class="${key === stabilizationPreset ? "is-active" : ""}">${preset.label}</button>`).join("")}<button type="button" data-phone-motion-recenter>RECENTER</button></div><small class="frisframe-phone-motion-privacy">Visual Flow는 실제 이동거리 측정값이 아니라 가상 씬 이동 감도입니다. 추적 신뢰도가 낮아지면 위치는 유지하고 Pan/Tilt만 계속 추적합니다.</small>`;
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
    [data-frisframe-phone-motion-badge]{font-size:8px;color:#7f8a94}[data-frisframe-phone-motion-badge].is-live{color:#9ce3af}[data-frisframe-phone-motion-badge].is-hold{color:#ffd18a}
    .frisframe-phone-motion-layout{display:grid;grid-template-columns:86px minmax(0,1fr);gap:9px;align-items:center}.frisframe-phone-motion-copy{display:grid;gap:5px;min-width:0}
    .frisframe-phone-motion-qr{width:86px;height:86px;padding:4px;background:#fff;border-radius:5px;overflow:hidden}.frisframe-phone-motion-qr svg{width:100%;height:100%;display:block}
    .frisframe-phone-motion-copy small,.frisframe-phone-motion-privacy{font-size:7px;color:#7e8993;overflow-wrap:anywhere;line-height:1.35}
    .frisframe-phone-motion-stabilization{display:grid;grid-template-columns:auto repeat(4,minmax(0,1fr));gap:4px;align-items:center}.frisframe-phone-motion-stabilization span{font-size:7px;color:#77828c}.frisframe-phone-motion-stabilization button{min-height:23px;padding:0 4px;border:1px solid rgba(255,255,255,.1);border-radius:5px;background:rgba(255,255,255,.025);color:#8f9aa4;font-size:7px;font-weight:850}.frisframe-phone-motion-stabilization button.is-active{color:#eef4f7;border-color:rgba(255,107,85,.55);background:rgba(255,107,85,.12)}
  `;
  document.head.appendChild(style);

  stabilizer = createStabilizer();
  window.addEventListener("frisframe:phone-remote-input", (event) => applyPhysicalMotion(event.detail || {}));
  setInterval(() => { refreshPairingUi(); updateDesktopBadge(); }, 700);
  window.FrisFramePhoneMotionCamera = Object.freeze({
    get connected() { return Date.now() - lastMotionAt < 900; },
    get diagnostic() { return diagnostic ? JSON.parse(JSON.stringify(diagnostic)) : null; },
    get stabilization() { return stabilizationPreset; },
    setStabilization: setStabilizationPreset,
    recenter: resetTrackingAnchor,
  });
})();
