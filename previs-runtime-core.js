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
    "buildCameraMotionPreset",
    "cameraGroundDirection",
    "cameraMotionPresetDefinition",
    "cameraReferenceProgress",
    "clamp",
    "cloneValue",
    "collectReferenceBatchCuts",
    "discreteAtDestination",
    "evaluateProjectReferenceReadiness",
    "evaluateReferenceReadiness",
    "finiteNumber",
    "heldActorBodyPose",
    "installReferenceFrameSemantics",
    "interpolateFocalLength",
    "isFrameAligned",
    "orbitCameraPose",
    "partitionReferenceBatchByReadiness",
    "referenceEntryKey",
    "safeFileSlug",
    "smoothReferenceProgress",
    "translateCameraPose",
  ];
  const missingMotionCore = requiredMotionCore.filter((name) => typeof motionCore?.[name] !== "function");
  if (missingMotionCore.length || !motionCore.CAMERA_MOTION_PRESETS) {
    const missing = [...missingMotionCore];
    if (!motionCore.CAMERA_MOTION_PRESETS) missing.push("CAMERA_MOTION_PRESETS");
    throw new Error(`FrisFrameMotionCore reference planner is incomplete: ${missing.join(", ")}`);
  }

  const CAMERA_FOCAL_MIN = Number(motionCore.CAMERA_FOCAL_MIN || 14);
  const CAMERA_FOCAL_MAX = Number(motionCore.CAMERA_FOCAL_MAX || 135);
  const CAMERA_MOTION_PRESETS = motionCore.CAMERA_MOTION_PRESETS;
  const SEEDANCE_REFERENCE_MAX_SECONDS = Number(motionCore.SEEDANCE_REFERENCE_MAX_SECONDS || 30);
  const {
    buildCameraMotionPreset,
    cameraGroundDirection,
    cameraMotionPresetDefinition,
    cameraReferenceProgress,
    clamp,
    cloneValue,
    collectReferenceBatchCuts,
    discreteAtDestination,
    evaluateProjectReferenceReadiness,
    evaluateReferenceReadiness,
    finiteNumber,
    heldActorBodyPose,
    installReferenceFrameSemantics,
    interpolateFocalLength,
    isFrameAligned,
    orbitCameraPose,
    partitionReferenceBatchByReadiness,
    referenceEntryKey,
    safeFileSlug,
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
