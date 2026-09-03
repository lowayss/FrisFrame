(() => {
  "use strict";

  if (document.documentElement.dataset.frisframePhoneMotionCameraUx === "1") return;
  document.documentElement.dataset.frisframePhoneMotionCameraUx = "1";

  let anchor = null;
  let calibrationId = -1;
  let lastMotionAt = 0;
  let diagnostic = null;
  let pairingRefresh = 0;

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

  function renderExternalFrame() {
    let renderState = state;
    if (typeof interpolateStateAtTime === "function") {
      try { renderState = interpolateStateAtTime(state.motion.playhead); } catch { renderState = state; }
    }
    if (renderState !== state) renderState.camera = { ...renderState.camera, ...state.camera };
    evaluatedViewState = renderState;
    if (typeof draw === "function") draw(renderState);
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
    }

    const size = typeof stageWorldSize === "function" ? stageWorldSize(state) : { width:10,depth:10 };
    const direction = typeof cameraDirection === "function" ? cameraDirection(state.camera) : { x:1,z:0 };
    const pose = core().derivePose(anchor, motion, {
      stageWidth:Number(size.width || 10),
      stageDepth:Number(size.depth || 10),
      forward:direction,
      visualScaleMeters:1.75,
      confidenceThreshold:0.2,
    });
    if (!pose) return;
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
    badge.textContent = live
      ? `실제 모션 연결 · ${diagnostic?.translation?.confidence != null ? Math.round(diagnostic.translation.confidence * 100) : 0}% visual`
      : "실제 모션 대기";
    badge.classList.toggle("is-live", live);
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
    body.innerHTML = `<div class="frisframe-phone-motion-layout">${qr ? `<div class="frisframe-phone-motion-qr">${qr}</div>` : ""}<div class="frisframe-phone-motion-copy"><div class="frisframe-phone-url"></div><div class="frisframe-phone-control-note">QR → 로컬 CA 설치 → HTTPS 모션 카메라. 휴대폰 영상은 폰 안에서만 분석됩니다.</div><button type="button" class="text-btn" data-copy-motion-url>설정 주소 복사</button>${motion?.tls?.available ? `<small>HTTPS 준비됨</small>` : `<small>HTTPS 불가 · ${String(motion?.tls?.error || "OpenSSL unavailable")}</small>`}</div></div>`;
    const urlNode = body.querySelector(".frisframe-phone-url");
    if (urlNode) urlNode.textContent = url;
    body.querySelector("[data-copy-motion-url]")?.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(url); if (typeof notifyApp === "function") notifyApp("실제 모션 카메라 설정 주소를 복사했습니다."); } catch {}
    });
    updateDesktopBadge();
  }

  const style = document.createElement("style");
  style.textContent = `
    [data-frisframe-phone-motion-box]{display:grid;gap:6px;padding-top:7px;border-top:1px solid rgba(255,255,255,.07)}
    .frisframe-phone-motion-head{display:flex;justify-content:space-between;gap:8px;align-items:center;font-size:9px;color:#d9e1e8}
    [data-frisframe-phone-motion-badge]{font-size:8px;color:#7f8a94}[data-frisframe-phone-motion-badge].is-live{color:#9ce3af}
    .frisframe-phone-motion-layout{display:grid;grid-template-columns:86px minmax(0,1fr);gap:9px;align-items:center}.frisframe-phone-motion-copy{display:grid;gap:5px;min-width:0}
    .frisframe-phone-motion-qr{width:86px;height:86px;padding:4px;background:#fff;border-radius:5px;overflow:hidden}.frisframe-phone-motion-qr svg{width:100%;height:100%;display:block}
    .frisframe-phone-motion-copy small{font-size:7px;color:#7e8993;overflow-wrap:anywhere}
  `;
  document.head.appendChild(style);

  window.addEventListener("frisframe:phone-remote-input", (event) => applyPhysicalMotion(event.detail || {}));
  setInterval(() => { refreshPairingUi(); updateDesktopBadge(); }, 700);
  window.FrisFramePhoneMotionCamera = Object.freeze({
    get connected() { return Date.now() - lastMotionAt < 900; },
    get diagnostic() { return diagnostic ? JSON.parse(JSON.stringify(diagnostic)) : null; },
    recenter() { anchor = null; calibrationId = -1; },
  });
})();
