(function initPrevisRuntimeCore(root, factory) {
  const motionCore = typeof module === "object" && module.exports
    ? require("./motion-core.js")
    : root?.FrisFrameMotionCore;
  const api = factory(motionCore);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FrisFramePrevisRuntimeCore = api;

  if (root?.document && typeof root.addEventListener === "function") {
    const install = () => {
      api.installReferenceFrameSemantics(root);
      api.installCameraMotionPresetUi(root);
      api.installBatchReferenceExportUi(root);
      api.installReferenceReadinessUi(root);
    };
    if (root.document.readyState === "loading") root.addEventListener("DOMContentLoaded", install, { once: true });
    else root.setTimeout?.(install, 0);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createPrevisRuntimeCore(motionCore) {
  "use strict";
  motionCore = motionCore || {};

  const requiredMotionCore = [
    "cameraReferenceProgress",
    "clamp",
    "cloneValue",
    "discreteAtDestination",
    "finiteNumber",
    "heldActorBodyPose",
    "installReferenceFrameSemantics",
    "interpolateFocalLength",
    "smoothReferenceProgress",
  ];
  const missingMotionCore = requiredMotionCore.filter((name) => typeof motionCore?.[name] !== "function");
  if (missingMotionCore.length) {
    throw new Error(`FrisFrameMotionCore reference evaluator is incomplete: ${missingMotionCore.join(", ")}`);
  }

  const CAMERA_FOCAL_MIN = Number(motionCore.CAMERA_FOCAL_MIN || 14);
  const CAMERA_FOCAL_MAX = Number(motionCore.CAMERA_FOCAL_MAX || 135);
  const {
    cameraReferenceProgress,
    clamp,
    cloneValue,
    discreteAtDestination,
    finiteNumber,
    heldActorBodyPose,
    installReferenceFrameSemantics,
    interpolateFocalLength,
    smoothReferenceProgress,
  } = motionCore;

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

  function safeContext(canvas, name) {
    try {
      return canvas?.getContext?.(name) || null;
    } catch {
      return null;
    }
  }

  function detectRenderRuntime({ rendererEngine = "", navigatorObject = typeof navigator !== "undefined" ? navigator : null, documentObject = typeof document !== "undefined" ? document : null } = {}) {
    const platform = String(navigatorObject?.platform || navigatorObject?.userAgent || "");
    const isMac = /Mac|iPhone|iPad/i.test(platform);
    const canvas = documentObject?.createElement?.("canvas");
    if (rendererEngine === "webgpu") return { engine: "webgpu", label: isMac ? "Mac GPU · WebGPU" : "GPU · WebGPU", isMac, hardwareAccelerated: true };
    if (rendererEngine === "webgl") return { engine: "webgl", label: isMac ? "Mac GPU · WebGL" : "GPU · WebGL", isMac, hardwareAccelerated: true };
    const hasWebGpu = Boolean(canvas && ("gpu" in (navigatorObject || {}) || safeContext(canvas, "webgpu")));
    const hasWebGl = Boolean(canvas && (safeContext(canvas, "webgl2") || safeContext(canvas, "webgl")));
    if (hasWebGpu) return { engine: "webgpu", label: isMac ? "Mac GPU · WebGPU" : "GPU · WebGPU", isMac, hardwareAccelerated: true };
    if (hasWebGl) return { engine: "webgl", label: isMac ? "Mac GPU · WebGL" : "GPU · WebGL", isMac, hardwareAccelerated: true };
    return { engine: "cpu", label: "CPU fallback", isMac, hardwareAccelerated: false };
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
    return { ...cloneValue(camera), x: endX, y: endY, aimX: clamp(pivotX / stage.width, 0, 1), aimY: clamp(pivotZ / stage.depth, 0, 1), panDeg };
  }

  function cameraMotionPresetDefinition(presetId) {
    return CAMERA_MOTION_PRESETS[presetId] || CAMERA_MOTION_PRESETS["dolly-in"];
  }

  function buildCameraMotionPreset({ presetId = "dolly-in", camera = {}, stageWidthM = 36, stageDepthM = 20.25, amount, actorId = "", actorStartPose = null, actorEndPose = null, followPathMode = "straight" } = {}) {
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
      if (!actorId || !actorStartPose || !actorEndPose) throw new Error("Follow Actor에는 기준 배우와 다음 배우 키가 필요합니다.");
      const dx = finiteNumber(actorEndPose.x, finiteNumber(actorStartPose.x, 0.5)) - finiteNumber(actorStartPose.x, 0.5);
      const dy = finiteNumber(actorEndPose.y, finiteNumber(actorStartPose.y, 0.5)) - finiteNumber(actorStartPose.y, 0.5);
      const stage = normalizedStage(stageWidthM, stageDepthM);
      endPose = translateCameraPose(startPose, stage.width, stage.depth, dx * stage.width, dy * stage.depth, { translateAim: true });
      startPose.trackingTargetId = actorId;
      endPose.trackingTargetId = actorId;
      pathMode = ["straight", "horizontal", "vertical", "arc-left", "arc-right", "free-curve"].includes(followPathMode) ? followPathMode : "straight";
    }
    return { presetId, label: definition.label, unit: definition.unit, requestedAmount, startPose, endPose, pathMode };
  }

  function cameraPresetActorContext(target, frame, startTime) {
    const items = Array.isArray(frame?.items) ? frame.items : [];
    const selectedId = typeof target.selectedSourceId === "function" ? target.selectedSourceId() : "";
    const selectedActor = items.find((item) => item.id === selectedId && item.type === "actor");
    const trackingActor = items.find((item) => item.id === frame?.camera?.trackingTargetId && item.type === "actor");
    const actor = selectedActor || trackingActor || items.find((item) => item.type === "actor") || null;
    if (!actor || typeof target.keysForSource !== "function") return null;
    const keys = target.keysForSource(actor.id) || [];
    const nextKey = keys.find((keyframe) => finiteNumber(keyframe.time, -1) > startTime + 0.0005);
    if (!nextKey) return { actor, nextKey: null };
    return { actor, nextKey, endPose: { ...cloneValue(actor), ...cloneValue(nextKey.pose || {}) }, pathMode: nextKey.segment?.mode || nextKey.pathMode || "straight" };
  }

  function findKeyAtTime(keys, time, epsilon = 0.0005) {
    return (keys || []).find((keyframe) => Math.abs(finiteNumber(keyframe.time, -999) - time) <= epsilon) || null;
  }

  function applyCameraMotionPreset(target, { presetId = "dolly-in", amount, duration = 2, transition = "smooth" } = {}) {
    const required = ["currentInteractionFrame", "displayPlayhead", "stageWorldSize", "applySourcePose", "createSourceKeyframe", "keysForSource", "commit"];
    const missing = required.filter((name) => typeof target?.[name] !== "function");
    if (missing.length) throw new Error(`카메라 프리셋 연결 함수가 없습니다: ${missing.join(", ")}`);
    const frame = cloneValue(target.currentInteractionFrame());
    const startTime = clamp(finiteNumber(target.displayPlayhead(), frame?.motion?.playhead || 0), 0, 60);
    const stage = target.stageWorldSize(frame) || {};
    let actualDuration = clamp(finiteNumber(duration, 2), 0.25, 20);
    let actorContext = null;
    let planOptions = { presetId, amount, camera: frame.camera, stageWidthM: stage.width, stageDepthM: stage.depth };
    if (presetId === "follow-selected") {
      actorContext = cameraPresetActorContext(target, frame, startTime);
      if (!actorContext?.actor) throw new Error("Follow Actor를 적용할 배우가 없습니다.");
      if (!actorContext.nextKey) throw new Error(`@${actorContext.actor.name || "배우"}의 다음 동작 키가 없습니다.`);
      actualDuration = clamp(finiteNumber(actorContext.nextKey.time, startTime) - startTime, 0.001, 20);
      planOptions = { ...planOptions, actorId: actorContext.actor.id, actorStartPose: actorContext.actor, actorEndPose: actorContext.endPose, followPathMode: actorContext.pathMode };
    }
    const plan = buildCameraMotionPreset(planOptions);
    const requestedEndTime = clamp(startTime + actualDuration, 0, 60);
    if (requestedEndTime <= startTime + 0.0005) throw new Error("프리셋 구간 길이가 너무 짧습니다.");
    if (typeof target.pushHistory === "function") target.pushHistory();
    if (typeof target.setActiveSource === "function") target.setActiveSource("camera");
    const cameraKeysBefore = target.keysForSource("camera") || [];
    let startKey = findKeyAtTime(cameraKeysBefore, startTime);
    target.applySourcePose("camera", plan.startPose);
    if (startKey) startKey.pose = { ...cloneValue(startKey.pose || {}), ...cloneValue(plan.startPose) };
    else startKey = target.createSourceKeyframe("camera", startTime, "straight");
    if (!startKey) throw new Error("프리셋 시작 카메라 키를 만들지 못했습니다.");
    if (typeof target.ensureDurationCovers === "function") target.ensureDurationCovers(requestedEndTime);
    const currentKeys = target.keysForSource("camera") || [];
    let endTime = requestedEndTime;
    if (findKeyAtTime(currentKeys, requestedEndTime)) {
      endTime = typeof target.availableKeyTime === "function" ? target.availableKeyTime(requestedEndTime, "camera", { maxTime: 60 }) : clamp(requestedEndTime + 1 / 24, 0, 60);
    }
    if (endTime <= startTime + 0.0005) throw new Error("도착 카메라 키를 배치할 빈 시간이 없습니다.");
    target.applySourcePose("camera", plan.endPose);
    const endKey = target.createSourceKeyframe("camera", endTime, plan.pathMode);
    if (!endKey) throw new Error("프리셋 도착 카메라 키를 만들지 못했습니다.");
    endKey.transition = ["smooth", "linear"].includes(transition) ? transition : "smooth";
    endKey.note = `Camera preset · ${plan.label}`;
    if (typeof target.applyPathModeToKeyframe === "function") target.applyPathModeToKeyframe(endKey, plan.pathMode);
    target.commit();
    if (typeof target.selectKeyframe === "function") target.selectKeyframe(endKey.id);
    if (typeof target.notifyApp === "function") {
      const followText = actorContext?.actor ? ` · @${actorContext.actor.name || "배우"}` : "";
      target.notifyApp(`${plan.label}${followText} 카메라 키를 ${startTime.toFixed(2)}–${endTime.toFixed(2)}초에 만들었습니다.`);
    }
    return { ...plan, startTime, endTime, duration: endTime - startTime, startKey, endKey, actorId: actorContext?.actor?.id || "" };
  }

  function stylePresetDialog(dialog) {
    Object.assign(dialog.style, { width: "min(460px, calc(100vw - 32px))", border: "1px solid #3d4e58", borderRadius: "14px", background: "#12171b", color: "#eef4ef", padding: "0", boxShadow: "0 24px 80px rgba(0,0,0,.55)" });
  }

  function installCameraMotionPresetUi(target) {
    const documentObject = target?.document;
    if (!documentObject || typeof documentObject.querySelector !== "function" || typeof documentObject.createElement !== "function") return false;
    if (documentObject.querySelector("#cameraMotionPresetBtn")) return true;
    const anchor = documentObject.querySelector("#addKeyBtn");
    if (!anchor?.parentNode) return false;
    const button = documentObject.createElement("button");
    button.type = "button";
    button.id = "cameraMotionPresetBtn";
    button.className = anchor.className;
    button.textContent = "카메라 프리셋";
    button.title = "현재 프레임에서 기존 카메라 키를 빠르게 생성합니다.";
    anchor.insertAdjacentElement?.("afterend", button) || anchor.parentNode.appendChild(button);
    const dialog = documentObject.createElement("dialog");
    dialog.id = "cameraMotionPresetDialog";
    stylePresetDialog(dialog);
    const form = documentObject.createElement("form");
    form.method = "dialog";
    Object.assign(form.style, { padding: "20px", display: "grid", gap: "14px" });
    const title = documentObject.createElement("strong");
    title.textContent = "카메라 모션 프리셋";
    Object.assign(title.style, { fontSize: "18px" });
    const help = documentObject.createElement("div");
    help.textContent = "새 애니메이션을 넣지 않고 현재 카메라 상태를 기준으로 기존 키프레임 2개를 작성합니다. 배우 동작은 변경하지 않습니다.";
    Object.assign(help.style, { color: "#9eaaa4", fontSize: "13px", lineHeight: "1.5" });
    const presetSelect = documentObject.createElement("select");
    presetSelect.id = "cameraMotionPresetSelect";
    Object.entries(CAMERA_MOTION_PRESETS).forEach(([id, definition]) => {
      const option = documentObject.createElement("option");
      option.value = id;
      option.textContent = definition.label;
      presetSelect.appendChild(option);
    });
    const amountLabel = documentObject.createElement("label");
    amountLabel.textContent = "이동량";
    const amountInput = documentObject.createElement("input");
    amountInput.id = "cameraMotionPresetAmount";
    amountInput.type = "number";
    amountInput.step = "0.1";
    amountInput.value = "2";
    amountLabel.appendChild(amountInput);
    const durationLabel = documentObject.createElement("label");
    durationLabel.textContent = "구간 길이 (초)";
    const durationInput = documentObject.createElement("input");
    durationInput.id = "cameraMotionPresetDuration";
    durationInput.type = "number";
    durationInput.min = "0.25";
    durationInput.max = "20";
    durationInput.step = "0.25";
    durationInput.value = "2";
    durationLabel.appendChild(durationInput);
    const transitionLabel = documentObject.createElement("label");
    transitionLabel.textContent = "카메라 속도";
    const transitionSelect = documentObject.createElement("select");
    transitionSelect.id = "cameraMotionPresetTransition";
    [["smooth", "부드럽게"], ["linear", "일정 속도"]].forEach(([value, label]) => {
      const option = documentObject.createElement("option");
      option.value = value;
      option.textContent = label;
      transitionSelect.appendChild(option);
    });
    transitionLabel.appendChild(transitionSelect);
    [presetSelect, amountInput, durationInput, transitionSelect].forEach((input) => {
      Object.assign(input.style, { width: "100%", marginTop: "6px", boxSizing: "border-box", border: "1px solid #3b4b55", borderRadius: "8px", background: "#0b0f12", color: "#eef4ef", padding: "9px 10px" });
    });
    [amountLabel, durationLabel, transitionLabel].forEach((label) => Object.assign(label.style, { fontSize: "13px", color: "#c7d2cc" }));
    const status = documentObject.createElement("div");
    status.id = "cameraMotionPresetStatus";
    Object.assign(status.style, { minHeight: "18px", color: "#ffad8f", fontSize: "12px" });
    const actions = documentObject.createElement("div");
    Object.assign(actions.style, { display: "flex", justifyContent: "flex-end", gap: "8px" });
    const cancel = documentObject.createElement("button");
    cancel.type = "button";
    cancel.textContent = "취소";
    cancel.className = anchor.className;
    const apply = documentObject.createElement("button");
    apply.type = "button";
    apply.textContent = "키 만들기";
    apply.className = anchor.className;
    actions.append(cancel, apply);
    form.append(title, help, presetSelect, amountLabel, durationLabel, transitionLabel, status, actions);
    dialog.appendChild(form);
    documentObject.body?.appendChild(dialog);
    function syncPresetInputs() {
      const definition = cameraMotionPresetDefinition(presetSelect.value);
      amountInput.value = String(definition.defaultAmount);
      amountLabel.firstChild.textContent = definition.unit === "°" ? "회전각 (°)" : definition.unit === "key" ? "이동량 (다음 배우 키에서 자동)" : "이동 거리 (m)";
      amountInput.disabled = definition.unit === "key";
      durationInput.disabled = definition.unit === "key";
      status.textContent = definition.unit === "key" ? "선택한 배우(없으면 현재 Tracking/첫 배우)의 다음 동작 키를 카메라가 따라갑니다." : "";
    }
    presetSelect.addEventListener("change", syncPresetInputs);
    button.addEventListener("click", () => {
      status.textContent = "";
      syncPresetInputs();
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    });
    cancel.addEventListener("click", () => dialog.close?.());
    apply.addEventListener("click", () => {
      status.textContent = "";
      try {
        applyCameraMotionPreset(target, { presetId: presetSelect.value, amount: amountInput.value, duration: durationInput.value, transition: transitionSelect.value });
        dialog.close?.();
      } catch (error) {
        status.textContent = error?.message || "카메라 프리셋을 적용하지 못했습니다.";
      }
    });
    syncPresetInputs();
    return true;
  }

  function safeFileSlug(value, fallback = "cut") {
    const normalized = String(value || "").normalize("NFKC").trim().replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^[.-]+|[.-]+$/g, "").slice(0, 80);
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
        entries.push({ sceneId: scene.id || "", cutId: cut.id || "", sceneNumber, cutNumber, sceneHeading: scene.heading || "", title: cut.title || "", status: cut.status || "", filename: `${base}_reference.mp4`, blocking: cloneValue(blocking), duration, fps: clamp(Math.round(finiteNumber(blocking.motion?.fps, 24)), 12, 60) });
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
    if (Number.isFinite(focal) && (focal < CAMERA_FOCAL_MIN || focal > CAMERA_FOCAL_MAX)) addReadinessIssue(issues, "error", "lens-out-of-range", `렌즈가 지원 범위(${CAMERA_FOCAL_MIN}–${CAMERA_FOCAL_MAX}mm)를 벗어났습니다.`);

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
      stats: { duration, fps, keyCount: keyframes.length, actorCount: actors.length, cameraKeyCount: keyframes.filter((keyframe) => keyframe.source === "camera").length },
      metadata: { sceneNumber: metadata.sceneNumber || 0, cutNumber: metadata.cutNumber || 0, title: metadata.title || "" },
    };
  }

  function evaluateProjectReferenceReadiness(project = {}) {
    return collectReferenceBatchCuts(project).map((entry) => ({ ...entry, readiness: evaluateReferenceReadiness(entry.blocking, entry) }));
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

  async function collectSingleReferenceVideo(target, entry) {
    if (typeof target.exportVideoForDocument !== "function") throw new Error("기존 MP4 내보내기 함수를 찾을 수 없습니다.");
    const originalPresentExport = target.presentExport;
    const originalPresentExportError = target.presentExportError;
    let captured = null;
    target.presentExport = (data, filename, label, preview) => { captured = { data, filename, label, preview }; };
    target.presentExportError = (message) => { throw new Error(String(message || "MP4 내보내기에 실패했습니다.")); };
    try {
      await target.exportVideoForDocument(cloneValue(entry.blocking), { progressOwner: "", filename: entry.filename, exportLabel: "Seedance 레퍼런스 H.264 MP4", cutLabel: `S${String(entry.sceneNumber).padStart(2, "0")} C${String(entry.cutNumber).padStart(2, "0")}` });
      if (!captured?.data) throw new Error(`${entry.filename} 결과를 수집하지 못했습니다.`);
      return captured;
    } finally {
      target.presentExport = originalPresentExport;
      target.presentExportError = originalPresentExportError;
    }
  }

  function buildReferenceBatchManifest(project = {}, entries = []) {
    return {
      app: "FrisFrame",
      type: "seedance-reference-video-batch",
      projectTitle: project.title || "FrisFrame",
      generatedAt: new Date().toISOString(),
      policy: { previewExportEvaluator: "shared", actorSecondaryMotion: "authored-only", cameraPresets: "keyframe-macros-only" },
      cuts: entries.map((entry) => ({
        sceneId: entry.sceneId,
        cutId: entry.cutId,
        sceneNumber: entry.sceneNumber,
        cutNumber: entry.cutNumber,
        sceneHeading: entry.sceneHeading,
        title: entry.title,
        status: entry.status,
        file: `videos/${entry.filename}`,
        durationSeconds: entry.duration,
        fps: entry.fps,
        readiness: evaluateReferenceReadiness(entry.blocking, entry),
      })),
    };
  }

  async function exportReferenceVideoBatch(target, { confirmBeforeStart = true } = {}) {
    const required = ["managedProjectDocument", "exportVideoForDocument", "createZip", "presentExport"];
    const missing = required.filter((name) => typeof target?.[name] !== "function");
    if (missing.length) throw new Error(`일괄 출력 연결 함수가 없습니다: ${missing.join(", ")}`);
    const documentPayload = target.managedProjectDocument();
    const project = cloneValue(documentPayload?.project || {});
    const entries = collectReferenceBatchCuts(project);
    if (!entries.length) throw new Error("MP4로 출력할 컷이 없습니다.");
    const readiness = entries.map((entry) => evaluateReferenceReadiness(entry.blocking, entry));
    if (confirmBeforeStart && typeof target.confirm === "function") {
      const totalSeconds = entries.reduce((sum, entry) => sum + entry.duration, 0);
      const blocked = readiness.filter((result) => result.status === "blocked").length;
      const review = readiness.filter((result) => result.status === "review").length;
      const suffix = blocked || review ? `\nReadiness: 차단 ${blocked} · 검토 ${review}` : "";
      const accepted = target.confirm(`${entries.length}개 컷(${totalSeconds.toFixed(1)}초)을 순서대로 MP4로 만들고 ZIP으로 묶습니다.${suffix}\n계속할까요?`);
      if (!accepted) return { cancelled: true, entries: [] };
    }
    const files = [];
    const completedEntries = [];
    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];
      if (typeof target.notifyApp === "function") target.notifyApp(`레퍼런스 MP4 ${index + 1}/${entries.length} · ${entry.filename}`);
      const captured = await collectSingleReferenceVideo(target, entry);
      files.push({ path: `videos/${entry.filename}`, blob: captured.data });
      completedEntries.push(entry);
    }
    const manifest = buildReferenceBatchManifest(project, completedEntries);
    files.push({ path: "manifest.json", content: JSON.stringify(manifest, null, 2) });
    files.push({ path: "README.md", content: ["# FrisFrame Seedance Reference Video Batch", "", "- `videos/`의 각 MP4는 컷별 키프레임 프리비즈 레퍼런스입니다.", "- 배우의 자동 보행·팔 흔들기·바운스 등 secondary motion은 추가하지 않습니다.", "- 카메라와 배우 root의 관계, 키 타이밍, 렌즈와 Tracking 의도를 레퍼런스로 사용합니다.", "- 컷 순서, FPS/길이, Readiness는 `manifest.json`을 확인합니다.", ""].join("\n") });
    const zip = await target.createZip(files);
    const zipName = `${safeFileSlug(project.title || "frisframe", "frisframe")}_seedance_reference_videos.zip`;
    const summary = `${completedEntries.length}개 컷 · 개별 H.264 MP4 · manifest.json`;
    target.presentExport(zip, zipName, "Seedance 레퍼런스 MP4 ZIP", { type: "text", text: `${summary}\n\n${completedEntries.map((entry) => { const result = evaluateReferenceReadiness(entry.blocking, entry); return `S${String(entry.sceneNumber).padStart(2, "0")} C${String(entry.cutNumber).padStart(2, "0")} · ${entry.title || "컷"} · ${entry.duration.toFixed(2)}초 · ${entry.fps}FPS · ${result.status.toUpperCase()} ${result.score}`; }).join("\n")}` });
    if (typeof target.notifyApp === "function") target.notifyApp(`전체 레퍼런스 MP4 ${completedEntries.length}개를 ZIP으로 준비했습니다.`);
    return { cancelled: false, entries: completedEntries, manifest, zip, filename: zipName };
  }

  async function exportReferenceBatchSafely(target, { confirmBeforeStart = true } = {}) {
    if (!target || typeof target.managedProjectDocument !== "function") throw new Error("프로젝트 문서를 읽을 수 없습니다.");
    if (typeof target.createZip !== "function") throw new Error("ZIP 생성 함수를 찾을 수 없습니다.");

    const documentPayload = cloneValue(target.managedProjectDocument());
    const project = documentPayload?.project || {};
    const partition = partitionReferenceBatchByReadiness(project);
    if (!partition.allowed.length) {
      if (partition.blocked.length) throw new Error(`출력 가능한 컷이 없습니다. BLOCKED ${partition.blocked.length}개를 Reference Readiness에서 먼저 수정하세요.`);
      throw new Error("MP4로 출력할 컷이 없습니다.");
    }

    if (confirmBeforeStart && typeof target.confirm === "function") {
      const reviewCount = partition.allowed.filter((entry) => entry.readiness?.status === "review").length;
      const message = [
        `READY/REVIEW ${partition.allowed.length}개 컷을 MP4 ZIP으로 만듭니다.`,
        reviewCount ? `REVIEW ${reviewCount}개는 경고를 유지한 채 포함됩니다.` : "",
        partition.blocked.length ? `BLOCKED ${partition.blocked.length}개는 자동 제외되고 제외 사유가 ZIP에 기록됩니다.` : "",
        "계속할까요?",
      ].filter(Boolean).join("\n");
      if (!target.confirm(message)) return { cancelled: true, entries: [], skippedBlocked: partition.skippedBlocked };
    }

    const originalManagedProjectDocument = target.managedProjectDocument;
    const originalCreateZip = target.createZip;
    target.managedProjectDocument = () => ({ ...cloneValue(documentPayload), project: cloneValue(partition.filteredProject) });
    target.createZip = async (files) => {
      const nextFiles = (files || []).map((file) => {
        if (file?.path !== "manifest.json" || typeof file.content !== "string") return file;
        try {
          const manifest = JSON.parse(file.content);
          manifest.batchPolicy = { blockedCuts: "skipped-by-default" };
          manifest.skippedBlocked = cloneValue(partition.skippedBlocked);
          return { ...file, content: JSON.stringify(manifest, null, 2) };
        } catch {
          return file;
        }
      });
      if (partition.skippedBlocked.length) {
        nextFiles.push({
          path: "skipped_blocked.json",
          content: JSON.stringify({ skippedBlocked: partition.skippedBlocked }, null, 2),
        });
      }
      return originalCreateZip.call(target, nextFiles);
    };

    try {
      const result = await exportReferenceVideoBatch(target, { confirmBeforeStart: false });
      if (typeof target.notifyApp === "function" && partition.skippedBlocked.length) {
        target.notifyApp(`레퍼런스 ZIP에서 BLOCKED ${partition.skippedBlocked.length}개 컷을 제외했습니다. skipped_blocked.json에서 사유를 확인하세요.`);
      }
      return { ...result, skippedBlocked: partition.skippedBlocked };
    } finally {
      target.managedProjectDocument = originalManagedProjectDocument;
      target.createZip = originalCreateZip;
    }
  }

  function installBatchReferenceExportUi(target) {
    const documentObject = target?.document;
    if (!documentObject || typeof documentObject.querySelector !== "function" || typeof documentObject.createElement !== "function") return false;
    if (documentObject.querySelector("#batchReferenceVideoBtn")) return true;
    const anchor = documentObject.querySelector("#videoPanelBtn") || documentObject.querySelector("#videoBtn");
    if (!anchor?.parentNode) return false;
    const button = documentObject.createElement("button");
    button.type = "button";
    button.id = "batchReferenceVideoBtn";
    button.className = anchor.className;
    button.textContent = "전체 컷 MP4 ZIP";
    button.title = "READY/REVIEW 컷만 개별 Seedance 레퍼런스 MP4로 만들고 BLOCKED 컷은 제외합니다.";
    anchor.insertAdjacentElement?.("afterend", button) || anchor.parentNode.appendChild(button);
    button.addEventListener("click", async () => {
      if (button.disabled) return;
      button.disabled = true;
      const originalText = button.textContent;
      button.textContent = "안전 일괄 출력 중…";
      try { await exportReferenceBatchSafely(target, { confirmBeforeStart: true }); }
      catch (error) { if (typeof target.notifyApp === "function") target.notifyApp(error?.message || "전체 컷 MP4 출력에 실패했습니다."); }
      finally { button.disabled = false; button.textContent = originalText; }
    });
    return true;
  }

  function readinessStatusText(result) {
    if (result.status === "ready") return "READY";
    if (result.status === "review") return "REVIEW";
    return "BLOCKED";
  }

  function installReferenceReadinessUi(target) {
    const documentObject = target?.document;
    if (!documentObject || typeof documentObject.querySelector !== "function" || typeof documentObject.createElement !== "function") return false;
    if (documentObject.querySelector("#referenceReadinessBtn")) return true;
    const anchor = documentObject.querySelector("#batchReferenceVideoBtn") || documentObject.querySelector("#videoPanelBtn") || documentObject.querySelector("#videoBtn");
    if (!anchor?.parentNode) return false;
    const button = documentObject.createElement("button");
    button.type = "button";
    button.id = "referenceReadinessBtn";
    button.className = anchor.className;
    button.textContent = "Reference Readiness";
    button.title = "프로젝트의 컷별 Seedance 레퍼런스 준비 상태를 검사합니다.";
    anchor.insertAdjacentElement?.("afterend", button) || anchor.parentNode.appendChild(button);

    const dialog = documentObject.createElement("dialog");
    dialog.id = "referenceReadinessDialog";
    Object.assign(dialog.style, { width: "min(760px, calc(100vw - 32px))", maxHeight: "80vh", border: "1px solid #3d4e58", borderRadius: "14px", background: "#12171b", color: "#eef4ef", padding: "0", boxShadow: "0 24px 80px rgba(0,0,0,.55)" });
    const shell = documentObject.createElement("div");
    Object.assign(shell.style, { padding: "20px", display: "grid", gap: "14px" });
    const heading = documentObject.createElement("strong");
    heading.textContent = "Seedance Reference Readiness";
    Object.assign(heading.style, { fontSize: "18px" });
    const summary = documentObject.createElement("div");
    Object.assign(summary.style, { color: "#aab5af", fontSize: "13px" });
    const list = documentObject.createElement("div");
    Object.assign(list.style, { display: "grid", gap: "8px", overflow: "auto", maxHeight: "58vh" });
    const close = documentObject.createElement("button");
    close.type = "button";
    close.textContent = "닫기";
    close.className = anchor.className;
    Object.assign(close.style, { justifySelf: "end" });
    close.addEventListener("click", () => dialog.close?.());
    shell.append(heading, summary, list, close);
    dialog.appendChild(shell);
    documentObject.body?.appendChild(dialog);

    function render() {
      list.innerHTML = "";
      let project = {};
      try { project = target.managedProjectDocument?.()?.project || {}; }
      catch (error) { summary.textContent = error?.message || "프로젝트를 읽지 못했습니다."; return; }
      const results = evaluateProjectReferenceReadiness(project);
      const ready = results.filter((entry) => entry.readiness.status === "ready").length;
      const review = results.filter((entry) => entry.readiness.status === "review").length;
      const blocked = results.filter((entry) => entry.readiness.status === "blocked").length;
      summary.textContent = `${results.length}컷 · READY ${ready} · REVIEW ${review} · BLOCKED ${blocked}`;
      results.forEach((entry) => {
        const result = entry.readiness;
        const row = documentObject.createElement("div");
        Object.assign(row.style, { border: "1px solid #2f3d45", borderRadius: "10px", padding: "11px 12px", background: "#0d1215" });
        const title = documentObject.createElement("div");
        Object.assign(title.style, { display: "flex", justifyContent: "space-between", gap: "12px", fontSize: "13px" });
        const name = documentObject.createElement("strong");
        name.textContent = `S${String(entry.sceneNumber).padStart(2, "0")} C${String(entry.cutNumber).padStart(2, "0")} · ${entry.title || "컷"}`;
        const badge = documentObject.createElement("span");
        badge.textContent = `${readinessStatusText(result)} ${result.score}`;
        badge.style.color = result.status === "ready" ? "#79dda0" : result.status === "review" ? "#ffd173" : "#ff8a7c";
        title.append(name, badge);
        row.appendChild(title);
        if (result.issues.length) {
          const issueList = documentObject.createElement("ul");
          Object.assign(issueList.style, { margin: "8px 0 0", paddingLeft: "18px", color: "#b9c4be", fontSize: "12px" });
          result.issues.forEach((issue) => {
            const item = documentObject.createElement("li");
            item.textContent = `${issue.severity === "error" ? "차단" : "검토"} · ${issue.message}`;
            issueList.appendChild(item);
          });
          row.appendChild(issueList);
        } else {
          const ok = documentObject.createElement("div");
          ok.textContent = "현재 레퍼런스 출력 계약에서 확인할 문제가 없습니다.";
          Object.assign(ok.style, { marginTop: "7px", color: "#8f9d96", fontSize: "12px" });
          row.appendChild(ok);
        }
        list.appendChild(row);
      });
    }
    button.addEventListener("click", () => {
      render();
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    });
    return true;
  }

  return {
    CAMERA_FOCAL_MAX,
    CAMERA_FOCAL_MIN,
    CAMERA_MOTION_PRESETS,
    SEEDANCE_REFERENCE_MAX_SECONDS,
    applyCameraMotionPreset,
    buildCameraMotionPreset,
    buildReferenceBatchManifest,
    cameraGroundDirection,
    cameraMotionPresetDefinition,
    cameraReferenceProgress,
    cloneValue,
    collectReferenceBatchCuts,
    collectSingleReferenceVideo,
    detectRenderRuntime,
    discreteAtDestination,
    evaluateProjectReferenceReadiness,
    evaluateReferenceReadiness,
    exportReferenceBatchSafely,
    exportReferenceVideoBatch,
    heldActorBodyPose,
    installBatchReferenceExportUi,
    installCameraMotionPresetUi,
    installReferenceFrameSemantics,
    installReferenceReadinessUi,
    interpolateFocalLength,
    isFrameAligned,
    orbitCameraPose,
    partitionReferenceBatchByReadiness,
    referenceEntryKey,
    safeFileSlug,
    smoothReferenceProgress,
    translateCameraPose,
  };
});
