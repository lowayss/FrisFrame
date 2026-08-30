(() => {
  "use strict";

  if (document.documentElement.dataset.frisframeCameraOperatorInputsUx === "1") return;
  document.documentElement.dataset.frisframeCameraOperatorInputsUx = "1";

  const STORAGE_KEY = "frisframe.cameraOperator.inputMode";
  const MODES = ["keyboard", "gamepad", "phone"];
  const keyState = new Set();
  const phoneState = {
    moveX: 0,
    moveY: 0,
    lookX: 0,
    lookY: 0,
    height: 0,
    focal: 0,
    sensorActive: false,
    sensorYaw: 0,
    sensorPitch: 0,
    receivedAt: 0,
    seq: 0,
  };
  let selectedMode = MODES.includes(localStorage.getItem(STORAGE_KEY))
    ? localStorage.getItem(STORAGE_KEY)
    : "keyboard";
  let frame = 0;
  let lastFrameAt = performance.now();
  let lastGamepadButtons = [];
  let phoneSensorAnchor = null;
  let installed = false;

  const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, Number(value) || 0));
  const normalizeAngle = (value) => {
    const normalized = Number(value) % 360;
    return normalized < 0 ? normalized + 360 : normalized;
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

  function applyPose(pose, targetState = state) {
    targetState.camera.x = Number(pose.x);
    targetState.camera.y = Number(pose.y);
    targetState.camera.height = clamp(pose.height, 0.4, 35);
    targetState.camera.panDeg = normalizeAngle(pose.panDeg);
    targetState.camera.tiltDeg = clamp(pose.tiltDeg, -89, 89);
    targetState.camera.focal = clamp(pose.focal, 8, 300);
    targetState.camera.trackingTargetId = "";
    if (typeof syncCameraDerivedAim === "function") syncCameraDerivedAim(targetState.camera, targetState);
  }

  function renderExternalFrame() {
    const live = cameraPose();
    let renderState = state;
    if (typeof interpolateStateAtTime === "function") {
      try { renderState = interpolateStateAtTime(state.motion.playhead); } catch { renderState = state; }
    }
    if (renderState !== state) {
      renderState.camera = { ...renderState.camera };
      applyPose(live, renderState);
    }
    evaluatedViewState = renderState;
    if (typeof draw === "function") draw(renderState);
  }

  function moveCamera(axes, dt) {
    const op = operator();
    if (!op || op.mode !== "recording") return;
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
    const moveX = clamp(axes.moveX, -1, 1);
    const moveY = clamp(axes.moveY, -1, 1);
    const metersX = (rightX * moveX + forwardX * moveY) * travelSpeed * dt;
    const metersY = (rightY * moveX + forwardY * moveY) * travelSpeed * dt;
    state.camera.x = clamp(Number(state.camera.x || 0) + metersX / Math.max(0.01, Number(size.width || 10)), minimum, maximum);
    state.camera.y = clamp(Number(state.camera.y || 0) + metersY / Math.max(0.01, Number(size.depth || 10)), minimum, maximum);
    state.camera.height = clamp(Number(state.camera.height || 1.6) + clamp(axes.height, -1, 1) * heightSpeed * dt, 0.4, 35);
    state.camera.focal = clamp(Number(state.camera.focal || 35) + clamp(axes.focal, -1, 1) * focalSpeed * dt, 8, 300);

    if (selectedMode === "phone" && phoneState.sensorActive && Date.now() - phoneState.receivedAt < 350) {
      if (!phoneSensorAnchor) {
        phoneSensorAnchor = {
          panDeg: Number(state.camera.panDeg || 0),
          tiltDeg: Number(state.camera.tiltDeg || 0),
          yaw: Number(phoneState.sensorYaw || 0),
          pitch: Number(phoneState.sensorPitch || 0),
        };
      }
      state.camera.panDeg = normalizeAngle(phoneSensorAnchor.panDeg + (Number(phoneState.sensorYaw || 0) - phoneSensorAnchor.yaw));
      state.camera.tiltDeg = clamp(phoneSensorAnchor.tiltDeg + (Number(phoneState.sensorPitch || 0) - phoneSensorAnchor.pitch), -89, 89);
    } else {
      phoneSensorAnchor = null;
      state.camera.panDeg = normalizeAngle(Number(state.camera.panDeg || 0) + clamp(axes.lookX, -1, 1) * lookSpeed * dt);
      state.camera.tiltDeg = clamp(Number(state.camera.tiltDeg || 0) + clamp(axes.lookY, -1, 1) * lookSpeed * dt, -89, 89);
    }
    if (typeof syncCameraDerivedAim === "function") syncCameraDerivedAim(state.camera, state);
    renderExternalFrame();
  }

  function keyboardAxes() {
    const has = (...codes) => codes.some((code) => keyState.has(code));
    return {
      moveX: (has("KeyD") ? 1 : 0) - (has("KeyA") ? 1 : 0),
      moveY: (has("KeyW") ? 1 : 0) - (has("KeyS") ? 1 : 0),
      lookX: (has("ArrowRight") ? 1 : 0) - (has("ArrowLeft") ? 1 : 0),
      lookY: (has("ArrowUp") ? 1 : 0) - (has("ArrowDown") ? 1 : 0),
      height: (has("KeyE") ? 1 : 0) - (has("KeyQ") ? 1 : 0),
      focal: (has("KeyX") ? 1 : 0) - (has("KeyZ") ? 1 : 0),
    };
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

  function tick(now) {
    const dt = clamp((now - lastFrameAt) / 1000, 0, 0.05);
    lastFrameAt = now;
    const pad = firstGamepad();
    updateGamepadButtons(pad);
    if (selectedMode === "keyboard") moveCamera(keyboardAxes(), dt);
    else if (selectedMode === "gamepad") moveCamera(gamepadAxes(pad), dt);
    else moveCamera(phoneAxes(), dt);
    updateStatus(pad);
    frame = requestAnimationFrame(tick);
  }

  let modeButtons = [];
  let statusLine = null;
  let phonePanel = null;
  let phoneUrl = null;

  function setMode(mode) {
    if (!MODES.includes(mode)) return;
    selectedMode = mode;
    localStorage.setItem(STORAGE_KEY, mode);
    phoneSensorAnchor = null;
    modeButtons.forEach((button) => button.classList.toggle("is-active", button.dataset.mode === selectedMode));
    if (phonePanel) phonePanel.hidden = selectedMode !== "phone";
    const cameraFrame = document.getElementById("cameraFrame");
    cameraFrame?.classList.toggle("frisframe-camera-operator-nonmouse", selectedMode !== "keyboard");
    updateStatus(firstGamepad());
  }

  function updateStatus(pad = firstGamepad()) {
    if (!statusLine) return;
    if (selectedMode === "keyboard") {
      statusLine.textContent = "WASD 이동 · 방향키 Pan/Tilt · Q/E 높이 · Z/X 렌즈 · 기존 마우스 드래그/휠 사용";
      return;
    }
    if (selectedMode === "gamepad") {
      statusLine.textContent = pad
        ? `${pad.id || "Gamepad"} 연결됨 · 왼스틱 이동 · 오른스틱 Pan/Tilt · LT/RT 높이 · LB/RB 렌즈 · A REC/STOP · B 취소`
        : "블루투스 패드를 연결하고 아무 버튼이나 눌러 활성화하세요.";
      return;
    }
    const connected = Date.now() - phoneState.receivedAt < 900;
    statusLine.textContent = connected
      ? "폰 연결됨 · 센서 또는 오른쪽 조이스틱 Pan/Tilt · 왼쪽 조이스틱 이동"
      : "폰에서 아래 주소를 열어 연결하세요. 같은 Wi‑Fi가 필요합니다.";
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
      .frisframe-phone-url { user-select:text; overflow-wrap:anywhere; color:#c7d0d9; font-size:8px; line-height:1.35; }
      .frisframe-phone-code { color:#ffbe76; font-weight:900; letter-spacing:.08em; }
      #cameraFrame.frisframe-camera-operator-nonmouse .frisframe-camera-operator-surface { pointer-events:none !important; cursor:default; }
    `;
    document.head.append(style);

    const selector = document.createElement("div");
    selector.className = "frisframe-camera-input-mode";
    selector.innerHTML = `
      <button type="button" data-mode="keyboard">⌨ 키보드</button>
      <button type="button" data-mode="gamepad">🎮 패드</button>
      <button type="button" data-mode="phone">📱 폰</button>
    `;
    statusLine = document.createElement("div");
    statusLine.className = "frisframe-camera-input-status";
    phonePanel = document.createElement("div");
    phonePanel.className = "frisframe-phone-pairing";
    phonePanel.hidden = true;
    const config = window.__FRISFRAME_PHONE_REMOTE__ || null;
    const firstUrl = Array.isArray(config?.urls) ? config.urls[0] : "";
    phonePanel.innerHTML = firstUrl
      ? `<div>페어링 <span class="frisframe-phone-code">${String(config.pairingCode || "")}</span></div><div class="frisframe-phone-url"></div><button type="button" class="text-btn" data-copy-phone-url>주소 복사</button>`
      : `<div class="frisframe-phone-url">LAN 주소를 찾지 못했습니다. 컴퓨터와 폰이 같은 Wi‑Fi인지 확인하세요.</div>`;
    phoneUrl = phonePanel.querySelector(".frisframe-phone-url");
    if (phoneUrl && firstUrl) phoneUrl.textContent = firstUrl;
    phonePanel.querySelector("[data-copy-phone-url]")?.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(firstUrl);
        if (typeof notifyApp === "function") notifyApp("폰 Camera Operator 주소를 복사했습니다.");
      } catch {
        if (typeof notifyApp === "function") notifyApp("주소 복사 권한이 없어 화면의 주소를 직접 복사하세요.");
      }
    });
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
    if (selectedMode === "keyboard" && ["KeyW", "KeyA", "KeyS", "KeyD", "KeyQ", "KeyE", "KeyZ", "KeyX", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code) && operator()?.mode === "recording") {
      event.preventDefault();
    }
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
      sensorActive: detail.sensorActive === true,
      sensorYaw: Number(detail.sensorYaw || 0), sensorPitch: Number(detail.sensorPitch || 0),
      receivedAt: Number(detail.receivedAt || Date.now()), seq: Number(detail.seq || 0),
    });
    if (selectedMode !== "phone") return;
    if (detail.command === "toggle-record") toggleRecording();
    else if (detail.command === "stop" && operator()?.mode === "recording") operator().finish();
    else if (detail.command === "cancel" && operator()?.mode !== "idle") operator().cancel();
    else if (detail.command === "zero") phoneSensorAnchor = null;
    updateStatus(firstGamepad());
  });

  function installWhenReady(attempt = 0) {
    if (installUi()) {
      lastFrameAt = performance.now();
      frame = requestAnimationFrame(tick);
      window.FrisFrameCameraOperatorInputs = {
        get mode() { return selectedMode; },
        setMode,
        get gamepadConnected() { return Boolean(firstGamepad()); },
        get phoneConnected() { return Date.now() - phoneState.receivedAt < 900; },
        multiInput: true,
      };
      return;
    }
    if (attempt < 80) setTimeout(() => installWhenReady(attempt + 1), 50);
  }

  installWhenReady();
})();
