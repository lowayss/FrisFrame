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
    };
    if (root.document.readyState === "loading") root.addEventListener("DOMContentLoaded", install, { once: true });
    else root.setTimeout?.(install, 0);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createPrevisRuntimeCore(motionCore) {
  "use strict";
  motionCore = motionCore || {};

  const requiredMotionCore = [
    "buildCameraMotionPreset",
    "cameraGroundDirection",
    "cameraMotionPresetDefinition",
    "cameraReferenceProgress",
    "clamp",
    "cloneValue",
    "discreteAtDestination",
    "finiteNumber",
    "heldActorBodyPose",
    "installReferenceFrameSemantics",
    "interpolateFocalLength",
    "orbitCameraPose",
    "smoothReferenceProgress",
    "translateCameraPose",
  ];
  const missingMotionCore = requiredMotionCore.filter((name) => typeof motionCore?.[name] !== "function");
  if (missingMotionCore.length || !motionCore.CAMERA_MOTION_PRESETS) {
    const missing = [...missingMotionCore];
    if (!motionCore.CAMERA_MOTION_PRESETS) missing.push("CAMERA_MOTION_PRESETS");
    throw new Error(`FrisFrameMotionCore runtime planner is incomplete: ${missing.join(", ")}`);
  }

  const CAMERA_FOCAL_MIN = Number(motionCore.CAMERA_FOCAL_MIN || 14);
  const CAMERA_FOCAL_MAX = Number(motionCore.CAMERA_FOCAL_MAX || 135);
  const CAMERA_MOTION_PRESETS = motionCore.CAMERA_MOTION_PRESETS;
  const {
    buildCameraMotionPreset,
    cameraGroundDirection,
    cameraMotionPresetDefinition,
    cameraReferenceProgress,
    clamp,
    cloneValue,
    discreteAtDestination,
    finiteNumber,
    heldActorBodyPose,
    installReferenceFrameSemantics,
    interpolateFocalLength,
    orbitCameraPose,
    smoothReferenceProgress,
    translateCameraPose,
  } = motionCore;

  function safeContext(canvas, name) {
    try {
      return canvas?.getContext?.(name) || null;
    } catch {
      return null;
    }
  }

  function detectRenderRuntime({
    rendererEngine = "",
    navigatorObject = typeof navigator !== "undefined" ? navigator : null,
    documentObject = typeof document !== "undefined" ? document : null,
  } = {}) {
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
    return {
      actor,
      nextKey,
      endPose: { ...cloneValue(actor), ...cloneValue(nextKey.pose || {}) },
      pathMode: nextKey.segment?.mode || nextKey.pathMode || "straight",
    };
  }

  function findKeyAtTime(keys, time, epsilon = 0.0005) {
    return (keys || []).find((keyframe) => Math.abs(finiteNumber(keyframe.time, -999) - time) <= epsilon) || null;
  }

  function applyCameraMotionPreset(target, { presetId = "dolly-in", amount, duration = 2, transition = "smooth" } = {}) {
    const required = [
      "currentInteractionFrame",
      "displayPlayhead",
      "stageWorldSize",
      "applySourcePose",
      "createSourceKeyframe",
      "keysForSource",
      "commit",
    ];
    const missing = required.filter((name) => typeof target?.[name] !== "function");
    if (missing.length) throw new Error(`카메라 프리셋 연결 함수가 없습니다: ${missing.join(", ")}`);
    const frame = cloneValue(target.currentInteractionFrame());
    const startTime = clamp(finiteNumber(target.displayPlayhead(), frame?.motion?.playhead || 0), 0, 60);
    const stage = target.stageWorldSize(frame) || {};
    let actualDuration = clamp(finiteNumber(duration, 2), 0.25, 20);
    let actorContext = null;
    let planOptions = {
      presetId,
      amount,
      camera: frame.camera,
      stageWidthM: stage.width,
      stageDepthM: stage.depth,
    };
    if (presetId === "follow-selected") {
      actorContext = cameraPresetActorContext(target, frame, startTime);
      if (!actorContext?.actor) throw new Error("Follow Actor를 적용할 배우가 없습니다.");
      if (!actorContext.nextKey) throw new Error(`@${actorContext.actor.name || "배우"}의 다음 동작 키가 없습니다.`);
      actualDuration = clamp(finiteNumber(actorContext.nextKey.time, startTime) - startTime, 0.001, 20);
      planOptions = {
        ...planOptions,
        actorId: actorContext.actor.id,
        actorStartPose: actorContext.actor,
        actorEndPose: actorContext.endPose,
        followPathMode: actorContext.pathMode,
      };
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
      endTime = typeof target.availableKeyTime === "function"
        ? target.availableKeyTime(requestedEndTime, "camera", { maxTime: 60 })
        : clamp(requestedEndTime + 1 / 24, 0, 60);
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
    return {
      ...plan,
      startTime,
      endTime,
      duration: endTime - startTime,
      startKey,
      endKey,
      actorId: actorContext?.actor?.id || "",
    };
  }

  function stylePresetDialog(dialog) {
    Object.assign(dialog.style, {
      width: "min(460px, calc(100vw - 32px))",
      border: "1px solid #3d4e58",
      borderRadius: "14px",
      background: "#12171b",
      color: "#eef4ef",
      padding: "0",
      boxShadow: "0 24px 80px rgba(0,0,0,.55)",
    });
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
      Object.assign(input.style, {
        width: "100%",
        marginTop: "6px",
        boxSizing: "border-box",
        border: "1px solid #3b4b55",
        borderRadius: "8px",
        background: "#0b0f12",
        color: "#eef4ef",
        padding: "9px 10px",
      });
    });
    [amountLabel, durationLabel, transitionLabel].forEach((label) => {
      Object.assign(label.style, { fontSize: "13px", color: "#c7d2cc" });
    });
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
      amountLabel.firstChild.textContent = definition.unit === "°"
        ? "회전각 (°)"
        : definition.unit === "key"
          ? "이동량 (다음 배우 키에서 자동)"
          : "이동 거리 (m)";
      amountInput.disabled = definition.unit === "key";
      durationInput.disabled = definition.unit === "key";
      status.textContent = definition.unit === "key"
        ? "선택한 배우(없으면 현재 Tracking/첫 배우)의 다음 동작 키를 카메라가 따라갑니다."
        : "";
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
        applyCameraMotionPreset(target, {
          presetId: presetSelect.value,
          amount: amountInput.value,
          duration: durationInput.value,
          transition: transitionSelect.value,
        });
        dialog.close?.();
      } catch (error) {
        status.textContent = error?.message || "카메라 프리셋을 적용하지 못했습니다.";
      }
    });
    syncPresetInputs();
    return true;
  }

  return {
    CAMERA_FOCAL_MAX,
    CAMERA_FOCAL_MIN,
    CAMERA_MOTION_PRESETS,
    applyCameraMotionPreset,
    buildCameraMotionPreset,
    cameraGroundDirection,
    cameraMotionPresetDefinition,
    cameraReferenceProgress,
    cloneValue,
    detectRenderRuntime,
    discreteAtDestination,
    heldActorBodyPose,
    installCameraMotionPresetUi,
    installReferenceFrameSemantics,
    interpolateFocalLength,
    orbitCameraPose,
    smoothReferenceProgress,
    translateCameraPose,
  };
});
