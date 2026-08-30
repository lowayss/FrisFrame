(function initReferenceWorkflowCore(root, factory) {
  const motionCore = typeof module === "object" && module.exports
    ? require("./motion-core.js")
    : root?.FrisFrameMotionCore;
  const api = factory(motionCore);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FrisFrameReferenceWorkflowCore = api;

  // Desktop/browser UI installs reference export plus non-destructive inspection aids.
  // Readiness remains an internal safety policy and final prompt composition lives
  // in the external MCP conversation.
  if (root?.document && typeof root.addEventListener === "function") {
    const install = () => {
      api.installBatchReferenceExportUi(root);
      api.installReferenceGhostUi(root);
    };
    if (root.document.readyState === "loading") root.addEventListener("DOMContentLoaded", install, { once: true });
    else root.setTimeout?.(install, 0);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createReferenceWorkflowCore(motionCore) {
  "use strict";
  motionCore = motionCore || {};

  const requiredMotionCore = [
    "cloneValue",
    "collectReferenceBatchCuts",
    "evaluateProjectReferenceReadiness",
    "evaluateReferenceReadiness",
    "partitionReferenceBatchByReadiness",
    "referenceEntryKey",
    "safeFileSlug",
  ];
  const missingMotionCore = requiredMotionCore.filter((name) => typeof motionCore?.[name] !== "function");
  if (missingMotionCore.length) {
    throw new Error(`FrisFrameMotionCore reference workflow planner is incomplete: ${missingMotionCore.join(", ")}`);
  }

  const SEEDANCE_REFERENCE_MAX_SECONDS = Number(motionCore.SEEDANCE_REFERENCE_MAX_SECONDS || 30);
  const REFERENCE_GHOST_MAX_FILE_BYTES = 5_500_000;
  const {
    cloneValue,
    collectReferenceBatchCuts,
    evaluateProjectReferenceReadiness,
    evaluateReferenceReadiness,
    partitionReferenceBatchByReadiness,
    referenceEntryKey,
    safeFileSlug,
  } = motionCore;

  async function collectSingleReferenceVideo(target, entry) {
    if (typeof target.exportVideoForDocument !== "function") throw new Error("기존 MP4 내보내기 함수를 찾을 수 없습니다.");
    const originalPresentExport = target.presentExport;
    const originalPresentExportError = target.presentExportError;
    let captured = null;
    target.presentExport = (data, filename, label, preview) => { captured = { data, filename, label, preview }; };
    target.presentExportError = (message) => { throw new Error(String(message || "MP4 내보내기에 실패했습니다.")); };
    try {
      await target.exportVideoForDocument(cloneValue(entry.blocking), {
        progressOwner: "",
        filename: entry.filename,
        exportLabel: "Seedance 레퍼런스 H.264 MP4",
        cutLabel: `S${String(entry.sceneNumber).padStart(2, "0")} C${String(entry.cutNumber).padStart(2, "0")}`,
      });
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
      policy: {
        previewExportEvaluator: "shared",
        actorSecondaryMotion: "authored-only",
        cameraPresets: "keyframe-macros-only",
      },
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
      const suffix = blocked || review ? `\n안전 검사: 차단 ${blocked} · 검토 ${review}` : "";
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
    files.push({
      path: "README.md",
      content: [
        "# FrisFrame Seedance Reference Video Batch",
        "",
        "- `videos/`의 각 MP4는 컷별 키프레임 프리비즈 레퍼런스입니다.",
        "- 배우의 자동 보행·팔 흔들기·바운스 등 secondary motion은 추가하지 않습니다.",
        "- 카메라와 배우 root의 관계, 키 타이밍, 렌즈와 Tracking 의도를 레퍼런스로 사용합니다.",
        "- 컷 순서, FPS/길이, 내부 안전 검사 결과는 `manifest.json`을 확인합니다.",
        "",
      ].join("\n"),
    });
    const zip = await target.createZip(files);
    const zipName = `${safeFileSlug(project.title || "frisframe", "frisframe")}_seedance_reference_videos.zip`;
    const summary = `${completedEntries.length}개 컷 · 개별 H.264 MP4 · manifest.json`;
    target.presentExport(zip, zipName, "Seedance 레퍼런스 MP4 ZIP", {
      type: "text",
      text: `${summary}\n\n${completedEntries.map((entry) => {
        const result = evaluateReferenceReadiness(entry.blocking, entry);
        return `S${String(entry.sceneNumber).padStart(2, "0")} C${String(entry.cutNumber).padStart(2, "0")} · ${entry.title || "컷"} · ${entry.duration.toFixed(2)}초 · ${entry.fps}FPS · ${result.status.toUpperCase()} ${result.score}`;
      }).join("\n")}`,
    });
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
      if (partition.blocked.length) throw new Error(`출력 가능한 컷이 없습니다. BLOCKED ${partition.blocked.length}개를 먼저 수정하세요.`);
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
    target.managedProjectDocument = () => ({
      ...cloneValue(documentPayload),
      project: cloneValue(partition.filteredProject),
    });
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

  function installReferenceGhostUi(target) {
    const documentObject = target?.document;
    if (!documentObject || typeof documentObject.querySelector !== "function" || typeof documentObject.createElement !== "function") return false;
    if (documentObject.querySelector("#referenceGhostPanel")) return true;

    const cameraFrame = documentObject.querySelector("#cameraFrame");
    const cameraCanvas = documentObject.querySelector("#cameraFrameCanvas");
    const leftPanel = documentObject.querySelector(".left-panel");
    if (!cameraFrame || !cameraCanvas || !leftPanel) return false;
    const spatialCore = target.FrisFrameSpatialScaleCore;
    if (!spatialCore || typeof spatialCore.fitOverlayRect !== "function") return false;

    const style = documentObject.createElement("style");
    style.dataset.frisframeReferenceGhost = "1";
    style.textContent = `
      .reference-ghost-panel .reference-ghost-actions { display:grid; grid-template-columns:1fr auto; gap:6px; margin-top:7px; }
      .reference-ghost-panel .reference-ghost-actions button { min-width:0; }
      .reference-ghost-panel .reference-ghost-status { display:block; margin-top:7px; color:#8f9aa5; font-size:9px; line-height:1.35; overflow-wrap:anywhere; }
      .reference-ghost-panel .reference-ghost-note { display:block; margin-top:6px; color:#d6a95c; font-size:8px; line-height:1.35; }
      .reference-ghost-panel .reference-ghost-inline { display:grid; grid-template-columns:minmax(0,1fr) 72px; gap:7px; align-items:center; margin-top:7px; }
      .reference-ghost-panel .reference-ghost-inline select { width:100%; min-width:0; }
      .reference-ghost-panel .reference-ghost-opacity { display:grid; grid-template-columns:52px 1fr 34px; gap:6px; align-items:center; margin-top:7px; font-size:9px; }
      .reference-ghost-layer { position:absolute; z-index:1; pointer-events:none; user-select:none; max-width:none; max-height:none; object-fit:fill; transform:none; }
      .reference-ghost-layer[hidden] { display:none !important; }
    `;
    documentObject.head?.appendChild(style);

    const panel = documentObject.createElement("details");
    panel.id = "referenceGhostPanel";
    panel.className = "panel-section compact-details mobile-collapsible reference-ghost-panel";
    panel.dataset.mobileCollapsible = "";
    panel.dataset.desktopDefault = "closed";
    panel.innerHTML = `
      <summary>Reference Ghost</summary>
      <label class="toggle-row">
        <span>Ghost 표시</span>
        <input id="referenceGhostEnabled" type="checkbox" checked />
      </label>
      <div class="reference-ghost-actions">
        <button id="referenceGhostChooseBtn" type="button" class="text-btn"><span>레퍼런스 이미지 선택</span></button>
        <button id="referenceGhostClearBtn" type="button" class="icon-btn" title="Ghost 이미지 지우기" aria-label="Ghost 이미지 지우기">×</button>
      </div>
      <input id="referenceGhostFileInput" type="file" accept="image/png,image/jpeg,image/webp" hidden />
      <div class="reference-ghost-opacity">
        <span>투명도</span>
        <input id="referenceGhostOpacity" type="range" min="5" max="80" step="1" value="35" />
        <output id="referenceGhostOpacityValue">35%</output>
      </div>
      <div class="reference-ghost-inline">
        <label for="referenceGhostFit">화면 맞춤</label>
        <select id="referenceGhostFit">
          <option value="contain">Contain</option>
          <option value="cover">Cover</option>
        </select>
      </div>
      <small id="referenceGhostStatus" class="reference-ghost-status">이미지를 선택하면 카메라 프리뷰 위에만 겹쳐 표시합니다.</small>
      <small class="reference-ghost-note">검사용 오버레이이며 프리비즈 렌더와 MP4에는 포함되지 않습니다.</small>
    `;
    const stagePanel = leftPanel.querySelector("details");
    if (stagePanel?.insertAdjacentElement) stagePanel.insertAdjacentElement("afterend", panel);
    else leftPanel.insertBefore(panel, leftPanel.firstChild || null);

    const ghostLayer = documentObject.createElement("img");
    ghostLayer.id = "referenceGhostLayer";
    ghostLayer.className = "reference-ghost-layer";
    ghostLayer.alt = "";
    ghostLayer.setAttribute("aria-hidden", "true");
    ghostLayer.hidden = true;
    cameraCanvas.insertAdjacentElement?.("afterend", ghostLayer) || cameraFrame.appendChild(ghostLayer);

    const enabledInput = panel.querySelector("#referenceGhostEnabled");
    const chooseButton = panel.querySelector("#referenceGhostChooseBtn");
    const clearButton = panel.querySelector("#referenceGhostClearBtn");
    const fileInput = panel.querySelector("#referenceGhostFileInput");
    const opacityInput = panel.querySelector("#referenceGhostOpacity");
    const opacityValue = panel.querySelector("#referenceGhostOpacityValue");
    const fitInput = panel.querySelector("#referenceGhostFit");
    const status = panel.querySelector("#referenceGhostStatus");
    const ghostState = {
      dataUrl: "",
      filename: "",
      width: 0,
      height: 0,
      enabled: true,
      opacity: 0.35,
      fit: "contain",
    };

    function setStatus(message) {
      if (status) status.textContent = String(message || "");
    }

    function syncGhostOverlay() {
      const hasImage = Boolean(ghostState.dataUrl && ghostState.width > 0 && ghostState.height > 0);
      ghostLayer.hidden = !(hasImage && ghostState.enabled);
      if (ghostLayer.hidden) return;
      const frameRect = cameraFrame.getBoundingClientRect();
      const canvasRect = cameraCanvas.getBoundingClientRect();
      const targetWidth = Math.max(1, canvasRect.width || cameraCanvas.clientWidth || cameraCanvas.width || 1);
      const targetHeight = Math.max(1, canvasRect.height || cameraCanvas.clientHeight || cameraCanvas.height || 1);
      const rect = spatialCore.fitOverlayRect({
        sourceWidth: ghostState.width,
        sourceHeight: ghostState.height,
        targetWidth,
        targetHeight,
        fit: ghostState.fit,
      });
      ghostLayer.style.left = `${canvasRect.left - frameRect.left + rect.x}px`;
      ghostLayer.style.top = `${canvasRect.top - frameRect.top + rect.y}px`;
      ghostLayer.style.width = `${rect.width}px`;
      ghostLayer.style.height = `${rect.height}px`;
      ghostLayer.style.opacity = String(ghostState.opacity);
    }

    function clearGhost() {
      ghostState.dataUrl = "";
      ghostState.filename = "";
      ghostState.width = 0;
      ghostState.height = 0;
      ghostLayer.removeAttribute("src");
      ghostLayer.hidden = true;
      if (fileInput) fileInput.value = "";
      setStatus("이미지를 선택하면 카메라 프리뷰 위에만 겹쳐 표시합니다.");
    }

    function readFileAsDataUrl(file) {
      return new Promise((resolve, reject) => {
        if (typeof target.FileReader !== "function") {
          reject(new Error("이 환경에서는 이미지 파일을 읽을 수 없습니다."));
          return;
        }
        const reader = new target.FileReader();
        reader.onerror = () => reject(new Error("레퍼런스 이미지를 읽지 못했습니다."));
        reader.onload = () => resolve(String(reader.result || ""));
        reader.readAsDataURL(file);
      });
    }

    function measureImage(dataUrl) {
      return new Promise((resolve, reject) => {
        if (typeof target.Image !== "function") {
          reject(new Error("이 환경에서는 이미지 크기를 확인할 수 없습니다."));
          return;
        }
        const image = new target.Image();
        image.onerror = () => reject(new Error("지원되지 않거나 손상된 이미지입니다."));
        image.onload = () => resolve({ width: image.naturalWidth || image.width, height: image.naturalHeight || image.height });
        image.src = dataUrl;
      });
    }

    chooseButton?.addEventListener("click", () => fileInput?.click());
    clearButton?.addEventListener("click", clearGhost);
    enabledInput?.addEventListener("change", () => {
      ghostState.enabled = enabledInput.checked;
      syncGhostOverlay();
    });
    opacityInput?.addEventListener("input", () => {
      ghostState.opacity = Math.max(0.05, Math.min(0.8, Number(opacityInput.value || 35) / 100));
      if (opacityValue) opacityValue.textContent = `${Math.round(ghostState.opacity * 100)}%`;
      syncGhostOverlay();
    });
    fitInput?.addEventListener("change", () => {
      ghostState.fit = fitInput.value === "cover" ? "cover" : "contain";
      syncGhostOverlay();
    });
    fileInput?.addEventListener("change", async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      if (!/^image\/(?:png|jpeg|webp)$/.test(String(file.type || ""))) {
        setStatus("PNG, JPEG, WEBP 이미지만 사용할 수 있습니다.");
        fileInput.value = "";
        return;
      }
      if (Number(file.size || 0) > REFERENCE_GHOST_MAX_FILE_BYTES) {
        setStatus("이미지가 너무 큽니다. 5.5MB 이하 파일을 사용해 주세요.");
        fileInput.value = "";
        return;
      }
      chooseButton.disabled = true;
      setStatus("레퍼런스 이미지를 준비하는 중…");
      try {
        const dataUrl = await readFileAsDataUrl(file);
        const dimensions = await measureImage(dataUrl);
        if (!(dimensions.width > 0 && dimensions.height > 0)) throw new Error("이미지 크기를 확인하지 못했습니다.");
        ghostState.dataUrl = dataUrl;
        ghostState.filename = String(file.name || "reference").slice(0, 160);
        ghostState.width = dimensions.width;
        ghostState.height = dimensions.height;
        ghostLayer.src = dataUrl;
        ghostLayer.onload = syncGhostOverlay;
        setStatus(`${ghostState.filename} · ${ghostState.width}×${ghostState.height}px · 프리뷰 검증용`);
        syncGhostOverlay();
      } catch (error) {
        clearGhost();
        setStatus(error?.message || "레퍼런스 이미지를 준비하지 못했습니다.");
      } finally {
        chooseButton.disabled = false;
      }
    });

    if (typeof target.ResizeObserver === "function") {
      const observer = new target.ResizeObserver(syncGhostOverlay);
      observer.observe(cameraFrame);
      observer.observe(cameraCanvas);
    }
    target.addEventListener?.("resize", syncGhostOverlay);
    target.addEventListener?.("frisframe:camera-frame-layout", syncGhostOverlay);
    return true;
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
    button.title = "내부 안전 검사에서 허용된 컷을 개별 Seedance 레퍼런스 MP4로 만들고 BLOCKED 컷은 제외합니다.";
    anchor.insertAdjacentElement?.("afterend", button) || anchor.parentNode.appendChild(button);
    button.addEventListener("click", async () => {
      if (button.disabled) return;
      button.disabled = true;
      const originalText = button.textContent;
      button.textContent = "안전 일괄 출력 중…";
      try {
        await exportReferenceBatchSafely(target, { confirmBeforeStart: true });
      } catch (error) {
        if (typeof target.notifyApp === "function") target.notifyApp(error?.message || "전체 컷 MP4 출력에 실패했습니다.");
      } finally {
        button.disabled = false;
        button.textContent = originalText;
      }
    });
    return true;
  }

  return {
    SEEDANCE_REFERENCE_MAX_SECONDS,
    REFERENCE_GHOST_MAX_FILE_BYTES,
    buildReferenceBatchManifest,
    collectReferenceBatchCuts,
    collectSingleReferenceVideo,
    evaluateProjectReferenceReadiness,
    evaluateReferenceReadiness,
    exportReferenceBatchSafely,
    exportReferenceVideoBatch,
    installBatchReferenceExportUi,
    installReferenceGhostUi,
    partitionReferenceBatchByReadiness,
    referenceEntryKey,
    safeFileSlug,
  };
});
