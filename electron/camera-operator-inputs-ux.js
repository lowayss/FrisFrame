(() => {
  "use strict";

  if (document.documentElement.dataset.frisframeCameraOperatorInputsUx === "1") return;
  document.documentElement.dataset.frisframeCameraOperatorInputsUx = "1";

  const STORAGE_KEY = "frisframe.cameraOperator.inputMode";
  const MODES = ["mouse", "gamepad", "phone"];
  const PHONE_PREVIEW_INTERVAL_MS = 50;
  const PHONE_PREVIEW_MAX_WIDTH = 640;
  const PHONE_PREVIEW_JPEG_QUALITY = 0.62;
  const keyState = new Set();
  const phoneState = {
    moveX: 0,
    moveY: 0,
    lookX: 0,
    lookY: 0,
    height: 0,
    focal: 0,
    motionActive: false,
    sensorYaw: 0,
    sensorPitch: 0,
    sensorRoll: 0,
    receivedAt: 0,
    seq: 0,
  };
  const storedMode = localStorage.getItem(STORAGE_KEY);
  let selectedMode = storedMode === "keyboard"
    ? "mouse"
    : (MODES.includes(storedMode) ? storedMode : "mouse");
  let frame = 0;
  let lastFrameAt = performance.now();
  let lastGamepadButtons = [];
  let installed = false;
  let phoneConfig = null;
  let phoneStartPromise = null;
  let phoneSensorAnchor = null;
  let phoneMotionTrim = { panDeg: 0, tiltDeg: 0 };
  let operatorAimTrim = { panDeg: 0, tiltDeg: 0 };
  let phonePreviewTimer = 0;
  let phonePreviewBusy = false;
  let phonePreviewCanvas = null;

  const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, Number(value) || 0));
  const normalizeAngle = (value) => {
    const normalized = Number(value) % 360;
    return normalized < 0 ? normalized + 360 : normalized;
  };
  const shortestAngleDelta = (from, to) => {
    let delta = normalizeAngle(to) - normalizeAngle(from);
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    return delta;
  };
  const deadzone = (value, amount = 0.13) => {
    const numeric = clamp(value, -1, 1);
    const magnitude = Math.abs(numeric);
    if (magnitude <= amount) return 0;
    const normalized = (magnitude - amount) / (1 - amount);
    return Math.sign(numeric) * normalized * normalized;
  };
  const editableTarget = (target) => Boolean(target?.matches?.("input,textarea,select,[contenteditable='true']"));

  function operator() {
    return window.FrisFrameCameraOperator;
  }

  function maintainTracking(targetState = state, time = targetState?.motion?.playhead) {
    const op = operator();
    if (typeof op?.maintainTracking === "function") {
      op.maintainTracking(targetState, time);
      return;
    }
    if (targetState?.camera?.trackingTargetId && typeof applyCameraTracking === "function") {
      applyCameraTracking(targetState);
    } else if (typeof syncCameraDerivedAim === "function" && targetState?.camera) {
      syncCameraDerivedAim(targetState.camera, targetState);
    }
  }

  function cameraPose() {
    return {
      x: Number(state.camera.x || 0),
      y: Number(state.camera.y || 0),
      height: Number(state.camera.height || 0),
      panDeg: normalizeAngle(state.camera.panDeg || 0),
      tiltDeg: Number(state.camera.tiltDeg || 0),
      focal: Number(state.camera.focal || 35),
    };
  }

  function focalRange() {
    return {
      minimum: Number.isFinite(Number(globalThis.CAMERA_FOCAL_MIN)) ? Number(globalThis.CAMERA_FOCAL_MIN) : 8,
      maximum: Number.isFinite(Number(globalThis.CAMERA_FOCAL_MAX)) ? Number(globalThis.CAMERA_FOCAL_MAX) : 300,
    };
  }

  function applyPose(pose, targetState = state, { maintainTarget = true } = {}) {
    const focal = focalRange();
    targetState.camera.x = Number(pose.x);
    targetState.camera.y = Number(pose.y);
    targetState.camera.height = clamp(pose.height, 0.4, 35);
    targetState.camera.panDeg = normalizeAngle(pose.panDeg);
    targetState.camera.tiltDeg = clamp(pose.tiltDeg, -89, 89);
    targetState.camera.focal = clamp(pose.focal, focal.minimum, focal.maximum);
    if (maintainTarget) maintainTracking(targetState, targetState?.motion?.playhead);
  }

  function renderExternalFrame() {
    const live = cameraPose();
    let renderState = state;
    if (typeof interpolateStateAtTime === "function") {
      try { renderState = interpolateStateAtTime(state.motion.playhead); } catch { renderState = state; }
    }
    if (renderState !== state) {
      renderState.camera = { ...renderState.camera };
      // The live state already contains the phone's tracking offset. Re-running
      // tracking on the copied preview frame would erase that offset immediately.
      applyPose(live, renderState, { maintainTarget: false });
      renderState.camera.__preserveLiveCameraOrientation = true;
    }
    evaluatedViewState = renderState;
    if (typeof draw === "function") draw(renderState);
  }

  function resetOperatorAimTrim() {
    operatorAimTrim = { panDeg: 0, tiltDeg: 0 };
  }

  function capturePhonePreviewFrame() {
    const source = document.getElementById("cameraFrameCanvas");
    if (!(source instanceof HTMLCanvasElement) || !source.width || !source.height) return "";
    const maximumWidth = PHONE_PREVIEW_MAX_WIDTH;
    const scale = Math.min(1, maximumWidth / source.width);
    const width = Math.max(1, Math.round(source.width * scale));
    const height = Math.max(1, Math.round(source.height * scale));
    if (!phonePreviewCanvas) phonePreviewCanvas = document.createElement("canvas");
    if (phonePreviewCanvas.width !== width || phonePreviewCanvas.height !== height) {
      phonePreviewCanvas.width = width;
      phonePreviewCanvas.height = height;
    }
    const context = phonePreviewCanvas.getContext("2d");
    if (!context) return "";
    context.fillStyle = "#101820";
    context.fillRect(0, 0, width, height);
    context.drawImage(source, 0, 0, width, height);
    try { return phonePreviewCanvas.toDataURL("image/jpeg", PHONE_PREVIEW_JPEG_QUALITY); } catch { return ""; }
  }

  function sendPhonePreviewFrame() {
    if (!phoneConfig || phonePreviewBusy || !window.frisframePhoneRemote?.setPreview) return;
    const dataUrl = capturePhonePreviewFrame();
    if (!dataUrl) return;
    phonePreviewBusy = true;
    Promise.resolve(window.frisframePhoneRemote.setPreview(dataUrl))
      .catch(() => {})
      .finally(() => { phonePreviewBusy = false; });
  }

  function startPhonePreviewStream() {
    if (phonePreviewTimer) clearInterval(phonePreviewTimer);
    phonePreviewTimer = 0;
    sendPhonePreviewFrame();
    phonePreviewTimer = window.setInterval(sendPhonePreviewFrame, PHONE_PREVIEW_INTERVAL_MS);
  }

  function stopPhonePreviewStream() {
    if (phonePreviewTimer) clearInterval(phonePreviewTimer);
    phonePreviewTimer = 0;
  }

  function moveCamera(axes, dt) {
    const op = operator();
    // Remote controls are live camera controls in idle/STBY as well. The
    // Camera Operator runtime samples them into keys only while recording.
    if (!op || !["idle", "armed", "recording"].includes(op.mode)) return;
    const trackingActive = Boolean(state.camera.trackingTargetId);
    const axisMagnitude = Math.max(
      Math.abs(Number(axes.moveX || 0)),
      Math.abs(Number(axes.moveY || 0)),
      Math.abs(Number(axes.lookX || 0)),
      Math.abs(Number(axes.lookY || 0)),
      Math.abs(Number(axes.height || 0)),
      Math.abs(Number(axes.focal || 0)),
    );
    if (axisMagnitude < 0.0001) return;

    const precision = keyState.has("ControlLeft") || keyState.has("ControlRight") || keyState.has("MetaLeft") || keyState.has("MetaRight") ? 0.35 : 1;
    const boost = keyState.has("ShiftLeft") || keyState.has("ShiftRight") ? 1.8 : 1;
    const speed = boost * precision;
    const lookSpeed = 68 * speed;
    const travelSpeed = 2.5 * speed;
    const heightSpeed = 1.6 * speed;
    const focalSpeed = 38 * speed;
    const direction = typeof cameraDirection === "function" ? cameraDirection(state.camera) : { x: 1, z: 0 };
    const horizontal = Math.max(0.0001, Math.hypot(Number(direction.x || 0), Number(direction.z || 0)));
    const forwardX = Number(direction.x || 0) / horizontal;
    const forwardY = Number(direction.z || 0) / horizontal;
    const rightX = -forwardY;
    const rightY = forwardX;
    const size = typeof stageWorldSize === "function" ? stageWorldSize(state) : { width: 10, depth: 10 };
    const minimum = Number.isFinite(Number(STAGE_COORD_MIN)) ? Number(STAGE_COORD_MIN) : -0.25;
    const maximum = Number.isFinite(Number(STAGE_COORD_MAX)) ? Number(STAGE_COORD_MAX) : 1.25;
    const focalRangeValue = focalRange();
    const moveX = clamp(axes.moveX, -1, 1);
    const moveY = clamp(axes.moveY, -1, 1);
    const metersX = (rightX * moveX + forwardX * moveY) * travelSpeed * dt;
    const metersY = (rightY * moveX + forwardY * moveY) * travelSpeed * dt;
    state.camera.x = clamp(Number(state.camera.x || 0) + metersX / Math.max(0.01, Number(size.width || 10)), minimum, maximum);
    state.camera.y = clamp(Number(state.camera.y || 0) + metersY / Math.max(0.01, Number(size.depth || 10)), minimum, maximum);
    state.camera.height = clamp(Number(state.camera.height || 1.6) + clamp(axes.height, -1, 1) * heightSpeed * dt, 0.4, 35);
    state.camera.focal = clamp(
      Number(state.camera.focal || 35) + clamp(axes.focal, -1, 1) * focalSpeed * dt,
      focalRangeValue.minimum,
      focalRangeValue.maximum,
    );

    if (trackingActive) {
      operatorAimTrim.panDeg += clamp(axes.lookX, -1, 1) * lookSpeed * dt;
      operatorAimTrim.tiltDeg += clamp(axes.lookY, -1, 1) * lookSpeed * dt;
      maintainTracking(state, state.motion?.playhead);
    } else {
      state.camera.panDeg = normalizeAngle(Number(state.camera.panDeg || 0) + clamp(axes.lookX, -1, 1) * lookSpeed * dt);
      state.camera.tiltDeg = clamp(Number(state.camera.tiltDeg || 0) + clamp(axes.lookY, -1, 1) * lookSpeed * dt, -89, 89);
    }
    if (!trackingActive && typeof syncCameraDerivedAim === "function") syncCameraDerivedAim(state.camera, state);
    renderExternalFrame();
  }

  function firstGamepad() {
    const pads = typeof navigator.getGamepads === "function" ? navigator.getGamepads() : [];
    return [...pads].find((pad) => pad?.connected) || null;
  }

  function gamepadAxes(pad) {
    if (!pad) return { moveX: 0, moveY: 0, lookX: 0, lookY: 0, height: 0, focal: 0 };
    return {
      moveX: deadzone(pad.axes?.[0] || 0),
      moveY: -deadzone(pad.axes?.[1] || 0),
      lookX: deadzone(pad.axes?.[2] || 0),
      lookY: -deadzone(pad.axes?.[3] || 0),
      height: clamp(Number(pad.buttons?.[7]?.value || 0) - Number(pad.buttons?.[6]?.value || 0), -1, 1),
      focal: clamp(Number(pad.buttons?.[5]?.value || 0) - Number(pad.buttons?.[4]?.value || 0), -1, 1),
    };
  }

  function syntheticStart() {
    const op = operator();
    if (!op) return;
    const surface = document.querySelector(".frisframe-camera-operator-surface");
    if (!surface) return;
    const dispatch = () => {
      if (op.mode !== "armed") return;
      const rect = surface.getBoundingClientRect();
      const options = {
        bubbles: true,
        cancelable: true,
        button: 0,
        buttons: 1,
        pointerId: 9090,
        pointerType: "mouse",
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
      };
      surface.dispatchEvent(new PointerEvent("pointerdown", options));
      surface.dispatchEvent(new PointerEvent("pointerup", { ...options, buttons: 0 }));
    };
    if (op.mode === "idle") {
      op.arm();
      requestAnimationFrame(dispatch);
    } else if (op.mode === "armed") {
      dispatch();
    }
  }

  function toggleRecording() {
    const op = operator();
    if (!op) return;
    if (op.mode === "recording") op.finish();
    else syntheticStart();
  }

  function updateGamepadButtons(pad) {
    const current = (pad?.buttons || []).map((button) => Boolean(button?.pressed));
    const pressed = (index) => current[index] && !lastGamepadButtons[index];
    if (selectedMode === "gamepad") {
      if (pressed(0)) toggleRecording();
      if (pressed(1) && operator()?.mode !== "idle") operator().cancel();
    }
    lastGamepadButtons = current;
  }

  function phoneAxes() {
    if (Date.now() - phoneState.receivedAt > 350) {
      return { moveX: 0, moveY: 0, lookX: 0, lookY: 0, height: 0, focal: 0 };
    }
    return {
      moveX: phoneState.moveX,
      moveY: phoneState.moveY,
      lookX: phoneState.lookX,
      lookY: phoneState.lookY,
      height: phoneState.height,
      focal: phoneState.focal,
    };
  }

  function phoneMotionPose() {
    if (!phoneState.motionActive || Date.now() - phoneState.receivedAt > 900) return null;
    if (!phoneSensorAnchor) {
      const current = cameraPose();
      phoneSensorAnchor = {
        sensorYaw: Number(phoneState.sensorYaw || 0),
        sensorPitch: Number(phoneState.sensorPitch || 0),
        panDeg: current.panDeg,
        tiltDeg: current.tiltDeg,
      };
      phoneMotionTrim = { panDeg: 0, tiltDeg: 0 };
    }
    const yawDelta = shortestAngleDelta(phoneSensorAnchor.sensorYaw, phoneState.sensorYaw);
    const pitchDelta = Number(phoneState.sensorPitch || 0) - phoneSensorAnchor.sensorPitch;
    return {
      panDeg: normalizeAngle(phoneSensorAnchor.panDeg + yawDelta + phoneMotionTrim.panDeg),
      tiltDeg: clamp(phoneSensorAnchor.tiltDeg - pitchDelta + phoneMotionTrim.tiltDeg, -89, 89),
    };
  }

  function phoneAimOffset() {
    if (!phoneState.motionActive || Date.now() - phoneState.receivedAt > 900 || !phoneSensorAnchor) return null;
    return {
      panDeg: shortestAngleDelta(phoneSensorAnchor.sensorYaw, phoneState.sensorYaw) + phoneMotionTrim.panDeg,
      tiltDeg: -(Number(phoneState.sensorPitch || 0) - phoneSensorAnchor.sensorPitch) + phoneMotionTrim.tiltDeg,
    };
  }

  function applyPhoneMotion(axes, dt) {
    const op = operator();
    // Phone orientation is a live camera control even before STBY. The Camera
    // Operator session still owns movement sampling, so only REC commits keys.
    if (!op || !["idle", "armed", "recording"].includes(op.mode)) return;
    const pose = phoneMotionPose();
    if (!pose) return;
    // Tracking remains authoritative for the base aim. The live controller
    // applies phoneAimOffset() after tracking so the phone can pan/tilt around
    // a moving actor without releasing the tracking target.
    if (state.camera.trackingTargetId) {
      maintainTracking(state, state.motion?.playhead);
      renderExternalFrame();
      return;
    }
    const precision = keyState.has("ControlLeft") || keyState.has("ControlRight") || keyState.has("MetaLeft") || keyState.has("MetaRight") ? 0.35 : 1;
    phoneMotionTrim.panDeg += clamp(axes.lookX, -1, 1) * 68 * precision * dt;
    phoneMotionTrim.tiltDeg += clamp(axes.lookY, -1, 1) * 68 * precision * dt;
    const adjustedPose = phoneMotionPose();
    state.camera.panDeg = adjustedPose.panDeg;
    state.camera.tiltDeg = adjustedPose.tiltDeg;
    if (typeof syncCameraDerivedAim === "function") syncCameraDerivedAim(state.camera, state);
    renderExternalFrame();
  }

  function tick(now) {
    const dt = clamp((now - lastFrameAt) / 1000, 0, 0.05);
    lastFrameAt = now;
    const pad = firstGamepad();
    updateGamepadButtons(pad);
    if (selectedMode === "gamepad") moveCamera(gamepadAxes(pad), dt);
    else if (selectedMode === "phone") {
      const axes = phoneAxes();
      moveCamera(axes, dt);
      applyPhoneMotion(axes, dt);
    }
    updateStatus(pad);
    frame = requestAnimationFrame(tick);
  }

  let modeButtons = [];
  let statusLine = null;
  let phonePanel = null;

  function renderPhonePanel(message = "") {
    if (!phonePanel) return;
    if (message) {
      phonePanel.innerHTML = `<div class="frisframe-phone-url">${message}</div>`;
      return;
    }
    const firstUrl = Array.isArray(phoneConfig?.urls) ? phoneConfig.urls[0] : "";
    if (!firstUrl) {
      phonePanel.innerHTML = '<div class="frisframe-phone-url">LAN 주소를 찾지 못했습니다. 컴퓨터와 폰이 같은 Wi‑Fi인지 확인하세요.</div>';
      return;
    }
    let qrMarkup = "";
    if (typeof window.qrcode === "function") {
      try {
        const qr = window.qrcode(0, "M");
        qr.addData(firstUrl, "Byte");
        qr.make();
        qrMarkup = `<div class="frisframe-phone-qr" aria-label="폰 Camera Remote 접속용 QR 코드">${qr.createSvgTag({
          cellSize: 4,
          margin: 4,
          scalable: true,
          alt: "폰 Camera Remote 접속용 QR 코드",
          title: "FrisFrame Phone Camera Remote",
        })}</div>`;
      } catch {
        qrMarkup = "";
      }
    }
    phonePanel.innerHTML = `<div class="frisframe-phone-pairing-layout">${qrMarkup}<div class="frisframe-phone-pairing-copy"><div>페어링 <span class="frisframe-phone-code"></span></div><div class="frisframe-phone-url"></div><button type="button" class="text-btn" data-copy-phone-url>주소 복사</button></div></div>`;
    const codeElement = phonePanel.querySelector(".frisframe-phone-code");
    if (codeElement) codeElement.textContent = String(phoneConfig.pairingCode || "");
    const urlElement = phonePanel.querySelector(".frisframe-phone-url");
    if (urlElement) urlElement.textContent = firstUrl;
    const controlNote = document.createElement("div");
    controlNote.className = "frisframe-phone-control-note";
    controlNote.textContent = "왼쪽 조이스틱: 좌우·전후 이동 · 오른쪽 조이스틱: 팬·틸트 · 높이: L1/R1 · 스마트폰 실물 움직임: Physical Camera 연결";
    phonePanel.querySelector(".frisframe-phone-pairing-copy")?.append(controlNote);
    phonePanel.querySelector("[data-copy-phone-url]")?.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(firstUrl);
        if (typeof notifyApp === "function") notifyApp("폰 Camera Operator 주소를 복사했습니다.");
      } catch {
        if (typeof notifyApp === "function") notifyApp("주소 복사 권한이 없어 화면의 주소를 직접 복사하세요.");
      }
    });
  }

  async function startPhoneBridge() {
    if (phoneConfig) return phoneConfig;
    if (phoneStartPromise) return phoneStartPromise;
    const api = window.frisframePhoneRemote;
    if (!api?.start) {
      renderPhonePanel("이 빌드에는 Phone Camera Remote 브리지가 없습니다.");
      return null;
    }
    renderPhonePanel("Phone Camera Remote 여는 중…");
    phoneStartPromise = api.start()
      .then((config) => {
        phoneConfig = config || null;
        renderPhonePanel();
        startPhonePreviewStream();
        return phoneConfig;
      })
      .catch((error) => {
        phoneConfig = null;
        stopPhonePreviewStream();
        renderPhonePanel(`Phone Camera Remote를 열지 못했습니다: ${String(error?.message || error)}`);
        return null;
      })
      .finally(() => { phoneStartPromise = null; });
    return phoneStartPromise;
  }

  async function stopPhoneBridge() {
    stopPhonePreviewStream();
    phoneConfig = null;
    phoneStartPromise = null;
    if (window.frisframePhoneRemote?.stop) {
      try { await window.frisframePhoneRemote.stop(); } catch { /* app may already be closing */ }
    }
  }

  function setMode(mode) {
    if (!MODES.includes(mode)) return;
    const previousMode = selectedMode;
    selectedMode = mode;
    localStorage.setItem(STORAGE_KEY, mode);
    keyState.clear();
    modeButtons.forEach((button) => button.classList.toggle("is-active", button.dataset.mode === selectedMode));
    if (phonePanel) phonePanel.hidden = selectedMode !== "phone";
    const cameraFrame = document.getElementById("cameraFrame");
    cameraFrame?.classList.toggle("frisframe-camera-operator-nonmouse", selectedMode !== "mouse");
    if (selectedMode === "phone") startPhoneBridge();
    else if (previousMode === "phone" || phoneConfig || phoneStartPromise) stopPhoneBridge();
    if (selectedMode !== "phone") phoneSensorAnchor = null;
    updateStatus(firstGamepad());
  }

  function updateStatus(pad = firstGamepad()) {
    if (!statusLine) return;
    if (selectedMode === "mouse") {
      statusLine.textContent = state.camera.trackingTargetId
        ? "마우스 드래그 이동/거리 · 트래킹 방향 유지 · 휠 렌즈"
        : "마우스 드래그 Pan/Tilt·이동/거리 · 휠 렌즈 · 직접 촬영";
      return;
    }
    if (selectedMode === "gamepad") {
      statusLine.textContent = pad
        ? (state.camera.trackingTargetId
          ? `${pad.id || "Gamepad"} 연결됨 · 왼스틱 이동/거리 · 오른스틱 무시(트래킹 방향 유지) · LT/RT 높이 · LB/RB 렌즈 · A REC/STOP · B 취소`
          : `${pad.id || "Gamepad"} 연결됨 · 왼스틱 이동 · 오른스틱 Pan/Tilt · LT/RT 높이 · LB/RB 렌즈 · A REC/STOP · B 취소`)
        : "블루투스 패드를 연결하고 아무 버튼이나 눌러 활성화하세요.";
      return;
    }
    const connected = Date.now() - phoneState.receivedAt < 900;
    statusLine.textContent = connected
      ? (state.camera.trackingTargetId
        ? "폰 연결됨 · 조이스틱 무빙 · 모션 앵글 · 트래킹 방향 유지 · 높이/렌즈"
        : "폰 연결됨 · 조이스틱 무빙 · 모션 앵글 또는 오른쪽 조이스틱 · 높이/렌즈")
      : (state.camera.trackingTargetId
        ? "트래킹 방향 유지 · 폰에서 아래 주소를 열어 연결하세요."
        : "폰에서 아래 주소를 열어 연결하세요. 같은 Wi‑Fi가 필요합니다.");
  }

  function installUi() {
    if (installed) return true;
    const panel = document.querySelector(".frisframe-camera-operator");
    const head = panel?.querySelector(".frisframe-camera-operator-head");
    if (!panel || !head || !operator()) return false;
    installed = true;

    const style = document.createElement("style");
    style.textContent = `
      .frisframe-camera-input-mode { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:5px; }
      .frisframe-camera-input-mode button { min-height:28px; padding:0 6px; border:1px solid rgba(255,255,255,.1); border-radius:7px; background:rgba(255,255,255,.025); color:#98a3ad; font-size:9px; font-weight:850; }
      .frisframe-camera-input-mode button.is-active { color:#edf3f8; border-color:rgba(255,107,85,.55); background:rgba(255,107,85,.12); }
      .frisframe-camera-input-status { color:#75808b; font-size:8px; line-height:1.35; }
      .frisframe-phone-pairing { display:grid; gap:5px; padding:7px; border:1px solid rgba(255,255,255,.07); border-radius:7px; background:rgba(0,0,0,.09); }
      .frisframe-phone-pairing[hidden] { display:none !important; }
      .frisframe-phone-pairing-layout { display:grid; grid-template-columns:86px minmax(0,1fr); gap:9px; align-items:center; }
      .frisframe-phone-pairing-copy { display:grid; gap:5px; min-width:0; }
      .frisframe-phone-qr { width:86px; height:86px; padding:4px; display:grid; place-items:center; border-radius:5px; background:#fff; overflow:hidden; }
      .frisframe-phone-qr svg { display:block; width:100%; height:100%; shape-rendering:crispEdges; }
      .frisframe-phone-url { user-select:text; overflow-wrap:anywhere; color:#c7d0d9; font-size:8px; line-height:1.35; }
      .frisframe-phone-control-note { color:#ffca88; font-size:8px; line-height:1.35; }
      .frisframe-phone-code { color:#ffbe76; font-weight:900; letter-spacing:.08em; }
      #cameraFrame.frisframe-camera-operator-nonmouse { pointer-events:none !important; }
      #cameraFrame.frisframe-camera-operator-nonmouse :is(#cameraFrameMoveHandle,#cameraFrameResizeHandle,#cameraFrameModeBtn) { pointer-events:auto !important; }
    `;
    document.head.append(style);

    const selector = document.createElement("div");
    selector.className = "frisframe-camera-input-mode";
    selector.innerHTML = `
      <button type="button" data-mode="mouse">🖱 마우스</button>
      <button type="button" data-mode="gamepad">🎮 패드</button>
      <button type="button" data-mode="phone">📱 폰</button>
    `;
    statusLine = document.createElement("div");
    statusLine.className = "frisframe-camera-input-status";
    phonePanel = document.createElement("div");
    phonePanel.className = "frisframe-phone-pairing";
    phonePanel.hidden = true;
    renderPhonePanel("Phone Camera Remote 대기");
    head.insertAdjacentElement("afterend", selector);
    selector.insertAdjacentElement("afterend", statusLine);
    statusLine.insertAdjacentElement("afterend", phonePanel);
    modeButtons = [...selector.querySelectorAll("button[data-mode]")];
    modeButtons.forEach((button) => button.addEventListener("click", () => setMode(button.dataset.mode)));
    setMode(selectedMode);
    return true;
  }

  document.addEventListener("keydown", (event) => {
    if (editableTarget(event.target)) return;
    keyState.add(event.code);
  }, true);
  document.addEventListener("keyup", (event) => keyState.delete(event.code), true);
  window.addEventListener("blur", () => keyState.clear());
  window.addEventListener("gamepadconnected", () => updateStatus(firstGamepad()));
  window.addEventListener("gamepaddisconnected", () => updateStatus(firstGamepad()));
  window.addEventListener("frisframe:phone-remote-input", (event) => {
    const detail = event.detail || {};
    if (Number(detail.seq || 0) < phoneState.seq) return;
    Object.assign(phoneState, {
      moveX: clamp(detail.moveX, -1, 1), moveY: clamp(detail.moveY, -1, 1),
      lookX: clamp(detail.lookX, -1, 1), lookY: clamp(detail.lookY, -1, 1),
      height: clamp(detail.height, -1, 1), focal: clamp(detail.focal, -1, 1),
      motionActive: detail.motionActive === true,
      sensorYaw: clamp(detail.sensorYaw, -180, 180),
      sensorPitch: clamp(detail.sensorPitch, -180, 180),
      sensorRoll: clamp(detail.sensorRoll, -180, 180),
      receivedAt: Number(detail.receivedAt || Date.now()), seq: Number(detail.seq || 0),
    });
    if (!phoneState.motionActive || detail.command === "motion-zero") {
      phoneSensorAnchor = null;
      phoneMotionTrim = { panDeg: 0, tiltDeg: 0 };
    }
    if (phoneState.motionActive && !phoneSensorAnchor) phoneMotionPose();
    if (selectedMode !== "phone") return;
    if (detail.command === "toggle-record") toggleRecording();
    else if (detail.command === "stop" && operator()?.mode === "recording") operator().finish();
    else if (detail.command === "cancel" && operator()?.mode !== "idle") operator().cancel();
    else if (detail.command === "motion-zero") {
      phoneSensorAnchor = null;
      phoneMotionTrim = { panDeg: 0, tiltDeg: 0 };
      resetOperatorAimTrim();
    }
    updateStatus(firstGamepad());
  });
  window.addEventListener("beforeunload", () => {
    stopPhonePreviewStream();
    if (selectedMode === "phone" || phoneConfig) window.frisframePhoneRemote?.stop?.();
  });

  function installWhenReady(attempt = 0) {
    if (installUi()) {
      lastFrameAt = performance.now();
      frame = requestAnimationFrame(tick);
      window.FrisFrameCameraOperatorInputs = {
        get mode() { return selectedMode; },
        setMode,
        startRecording: syntheticStart,
        get gamepadConnected() { return Boolean(firstGamepad()); },
        get phoneConnected() { return Date.now() - phoneState.receivedAt < 900; },
      get phoneMotionActive() { return phoneState.motionActive && Date.now() - phoneState.receivedAt < 900; },
        get phoneMotionCalibrated() { return Boolean(phoneSensorAnchor); },
        get phoneAimOffset() { return phoneAimOffset(); },
        get operatorAimOffset() { return { ...operatorAimTrim }; },
        resetAimOffset: resetOperatorAimTrim,
        get phoneRemoteOpen() { return Boolean(phoneConfig); },
        multiInput: true,
      };
      return;
    }
    if (attempt < 80) setTimeout(() => installWhenReady(attempt + 1), 50);
  }

  installWhenReady();
})();
