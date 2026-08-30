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
      api.installReferenceValidationUi(root);
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

  function validateReferenceSpaceBlocking(blocking = {}, options = {}) {
    const spatialCore = options.spatialCore;
    if (!spatialCore
      || typeof spatialCore.stageWorldSize !== "function"
      || typeof spatialCore.stageNormalizedToWorld !== "function"
      || typeof spatialCore.frameFractionForDistance !== "function"
      || typeof spatialCore.horizonFromTilt !== "function") {
      throw new Error("FrisFrameSpatialScaleCore validation functions are required.");
    }
    const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
    const aspectMap = { "16:9": 16 / 9, "9:16": 9 / 16, "4:3": 4 / 3, "1:1": 1, "3:4": 3 / 4 };
    const aspect = aspectMap[blocking.aspect] || 16 / 9;
    const stage = spatialCore.stageWorldSize({ aspect });
    const camera = blocking.camera || {};
    const sensorWidthMm = Math.max(1, finite(blocking.cameraSetup?.sensorWidthMm, 36));
    const focalMm = Math.max(1, finite(camera.focal, 50));
    const positionToleranceM = Math.max(0.001, finite(options.positionToleranceM, 0.05));
    const dimensionToleranceRatio = Math.max(0, finite(options.dimensionToleranceRatio, 0.02));
    const frameTolerance = Math.max(0, finite(options.frameTolerance, 0.03));
    const guide = blocking.spatialGuide && typeof blocking.spatialGuide === "object" ? blocking.spatialGuide : {};
    const items = new Map((blocking.items || []).map((item) => [String(item?.id || ""), item]));
    const issues = [];
    const anchorsChecked = [];
    const projectionChecks = [];
    let horizonCheck = null;
    const worldPoint = (item) => spatialCore.stageNormalizedToWorld(
      { x: finite(item?.x, 0.5), y: finite(item?.y, 0.5) },
      { width: stage.width, depth: stage.depth },
    );
    const dimensionsFor = (item, anchor) => anchor?.dimensionsM || item?.referenceDimensionsM || (
      item?.type === "actor" && typeof spatialCore.actorDimensions === "function"
        ? spatialCore.actorDimensions({ size: item.size, scaleX: item.scaleX, scaleY: item.scaleY, scaleZ: item.scaleZ })
        : null
    );
    const distanceTo = (item, dimensions) => {
      const targetPoint = worldPoint(item);
      const cameraPoint = spatialCore.stageNormalizedToWorld(
        { x: finite(camera.x, 0.5), y: finite(camera.y, 0.5) },
        { width: stage.width, depth: stage.depth },
      );
      const bottom = finite(item?.verticalOffset ?? item?.mountedHeight, 0);
      const centerHeight = bottom + finite(dimensions?.height, item?.type === "actor" ? 1.78 : 1) / 2;
      return Math.hypot(targetPoint.x - cameraPoint.x, targetPoint.z - cameraPoint.z, centerHeight - finite(camera.height, 1.6));
    };
    const relativeError = (actual, expected) => Math.abs(finite(actual) - finite(expected)) / Math.max(Math.abs(finite(expected)), 1e-9);

    for (const anchor of guide.anchors || []) {
      if (!anchor || typeof anchor !== "object") continue;
      const id = String(anchor.id || "");
      const kind = String(anchor.kind || "");
      if (kind === "horizon") {
        if (Number.isFinite(Number(anchor.imageY))) {
          const observed = Number(anchor.imageY);
          const predicted = spatialCore.horizonFromTilt({ tiltDeg: finite(camera.tiltDeg, 0), focalMm, sensorWidthMm, aspect });
          horizonCheck = { observed, predicted, residual: observed - predicted };
          if (Math.abs(horizonCheck.residual) > frameTolerance) issues.push({ code: "horizon-mismatch", anchorId: id, ...horizonCheck });
        }
        continue;
      }
      const itemId = String(anchor.attachedItemId || id);
      const item = items.get(itemId);
      if (!item) {
        issues.push({ code: "anchor-item-missing", anchorId: id, itemId });
        continue;
      }
      const point = worldPoint(item);
      const dimensions = dimensionsFor(item, anchor);
      if (Number.isFinite(Number(anchor.worldX)) && Math.abs(point.x - Number(anchor.worldX)) > positionToleranceM) {
        issues.push({ code: "anchor-x-mismatch", anchorId: id, actualM: point.x, expectedM: Number(anchor.worldX) });
      }
      if (Number.isFinite(Number(anchor.worldZ)) && Math.abs(point.z - Number(anchor.worldZ)) > positionToleranceM) {
        issues.push({ code: "anchor-z-mismatch", anchorId: id, actualM: point.z, expectedM: Number(anchor.worldZ) });
      }
      if (anchor.dimensionsM && item.referenceDimensionsM) {
        for (const key of ["width", "height", "depth"]) {
          if (relativeError(item.referenceDimensionsM[key], anchor.dimensionsM[key]) > dimensionToleranceRatio) {
            issues.push({ code: "anchor-dimension-mismatch", anchorId: id, dimension: key });
          }
        }
      }
      if (kind === "scale-height" || kind === "scale-width") {
        const axis = kind === "scale-width" ? "width" : "height";
        const observed = Number(axis === "width" ? anchor.imageWidth : anchor.imageHeight);
        const physicalSizeM = Number(dimensions?.[axis]);
        if (Number.isFinite(observed) && observed > 0 && Number.isFinite(physicalSizeM) && physicalSizeM > 0) {
          const distanceM = distanceTo(item, dimensions);
          const predicted = spatialCore.frameFractionForDistance({ axis, subjectSizeM: physicalSizeM, distanceM, focalMm, sensorWidthMm, aspect });
          const entry = { id, itemId, axis, observed, predicted, residual: observed - predicted, distanceM };
          projectionChecks.push(entry);
          if (Math.abs(entry.residual) > frameTolerance) issues.push({ code: "scale-anchor-frame-mismatch", ...entry });
        } else {
          issues.push({ code: "scale-anchor-observation-incomplete", anchorId: id, itemId });
        }
      }
      anchorsChecked.push({ id, itemId, kind, worldX: point.x, worldZ: point.z });
    }
    return {
      schema: "frisframe-reference-space-validation",
      version: 1,
      status: issues.length ? "review" : "ready",
      stage,
      camera: {
        focalMm,
        tiltDeg: finite(camera.tiltDeg, 0),
        keyframes: (blocking.motion?.keyframes || []).filter((key) => key?.source === "camera").length,
      },
      anchorsChecked,
      projectionChecks,
      horizonCheck,
      issues,
    };
  }

  function buildReferenceGhostObservationModel(blocking = {}, options = {}) {
    const spatialCore = options.spatialCore;
    if (!spatialCore || typeof spatialCore.normalizedToOverlayPoint !== "function") {
      throw new Error("FrisFrameSpatialScaleCore overlay coordinate functions are required.");
    }
    const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
    const clamp01 = (value, fallback = 0.5) => Math.max(0, Math.min(1, finite(value, fallback)));
    const sourceRect = options.overlayRect || {};
    const overlayRect = {
      x: finite(sourceRect.x, 0),
      y: finite(sourceRect.y, 0),
      width: Math.max(1, finite(sourceRect.width, 1)),
      height: Math.max(1, finite(sourceRect.height, 1)),
    };
    const validation = validateReferenceSpaceBlocking(blocking, {
      spatialCore,
      positionToleranceM: options.positionToleranceM,
      dimensionToleranceRatio: options.dimensionToleranceRatio,
      frameTolerance: options.frameTolerance,
    });
    const projectionById = new Map(validation.projectionChecks.map((entry) => [String(entry.id || ""), entry]));
    const guide = blocking.spatialGuide && typeof blocking.spatialGuide === "object" ? blocking.spatialGuide : {};
    const scales = [];
    const horizons = [];

    for (const anchor of guide.anchors || []) {
      if (!anchor || typeof anchor !== "object") continue;
      const id = String(anchor.id || "");
      const kind = String(anchor.kind || "");
      const label = String(anchor.label || id || "Reference").slice(0, 80);
      if (kind === "horizon") {
        const observedY = Number(anchor.imageY);
        if (!Number.isFinite(observedY)) continue;
        const observedPoint = spatialCore.normalizedToOverlayPoint({ x: 0.5, y: clamp01(observedY, 0.5) }, overlayRect);
        const predictedY = Number(validation.horizonCheck?.predicted);
        const predictedPoint = Number.isFinite(predictedY)
          ? spatialCore.normalizedToOverlayPoint({ x: 0.5, y: clamp01(predictedY, 0.5) }, overlayRect)
          : null;
        horizons.push({
          id,
          label,
          observedY: clamp01(observedY, 0.5),
          predictedY: Number.isFinite(predictedY) ? predictedY : null,
          observedYPx: observedPoint.y,
          predictedYPx: predictedPoint?.y ?? null,
          residual: Number.isFinite(predictedY) ? observedY - predictedY : null,
          xPx: overlayRect.x,
          widthPx: overlayRect.width,
        });
        continue;
      }
      if (kind !== "scale-height" && kind !== "scale-width") continue;
      const axis = kind === "scale-width" ? "width" : "height";
      const observedFraction = Number(axis === "width" ? anchor.imageWidth : anchor.imageHeight);
      if (!(Number.isFinite(observedFraction) && observedFraction > 0)) continue;
      const center = spatialCore.normalizedToOverlayPoint({
        x: clamp01(anchor.imageX, 0.5),
        y: clamp01(anchor.imageY, 0.5),
      }, overlayRect);
      const projection = projectionById.get(id);
      const predictedFraction = Number(projection?.predicted);
      const axisPixels = axis === "width" ? overlayRect.width : overlayRect.height;
      scales.push({
        id,
        label,
        axis,
        center,
        observedFraction,
        predictedFraction: Number.isFinite(predictedFraction) && predictedFraction > 0 ? predictedFraction : null,
        observedLengthPx: observedFraction * axisPixels,
        predictedLengthPx: Number.isFinite(predictedFraction) && predictedFraction > 0 ? predictedFraction * axisPixels : null,
        residual: Number.isFinite(predictedFraction) ? observedFraction - predictedFraction : null,
      });
    }

    return {
      schema: "frisframe-reference-ghost-observations",
      version: 1,
      status: validation.status,
      overlayRect,
      scales,
      horizons,
      issues: validation.issues,
      legend: { observed: "reference", predicted: "current-camera" },
    };
  }

  function installReferenceValidationUi(target) {
    const documentObject = target?.document;
    if (!documentObject || typeof documentObject.querySelector !== "function" || typeof documentObject.createElement !== "function") return false;
    if (documentObject.querySelector("#referenceSpaceValidationPanel")) return true;
    const leftPanel = documentObject.querySelector(".left-panel");
    const spatialCore = target.FrisFrameSpatialScaleCore;
    if (!leftPanel || !spatialCore) return false;
    const issueLabels = {
      "anchor-item-missing": "앵커에 연결된 대상을 찾을 수 없음",
      "anchor-x-mismatch": "앵커 X 위치 불일치",
      "anchor-z-mismatch": "앵커 Z 위치 불일치",
      "anchor-dimension-mismatch": "실측 치수 불일치",
      "scale-anchor-frame-mismatch": "Scale Anchor 화면 비율 불일치",
      "scale-anchor-observation-incomplete": "Scale Anchor 측정 정보 부족",
      "horizon-mismatch": "수평선과 카메라 Tilt 불일치",
    };
    const style = documentObject.createElement("style");
    style.dataset.frisframeReferenceValidation = "1";
    style.textContent = `
      .reference-space-validation-panel .reference-validation-actions { display:grid; grid-template-columns:1fr auto; gap:6px; margin-top:7px; }
      .reference-space-validation-panel .reference-validation-badge { display:inline-flex; align-items:center; justify-content:center; min-width:48px; padding:3px 6px; border:1px solid currentColor; border-radius:999px; font-size:8px; font-weight:700; letter-spacing:.05em; }
      .reference-space-validation-panel .reference-validation-badge[data-status="ready"] { color:#62c487; }
      .reference-space-validation-panel .reference-validation-badge[data-status="review"] { color:#e0a25a; }
      .reference-space-validation-panel .reference-validation-summary { display:block; margin-top:7px; color:#9aa6b1; font-size:9px; line-height:1.45; }
      .reference-space-validation-panel .reference-validation-list { margin:7px 0 0; padding-left:15px; color:#d8dde2; font-size:8px; line-height:1.45; }
      .reference-space-validation-panel .reference-validation-empty { color:#8f9aa5; }
    `;
    documentObject.head?.appendChild(style);
    const panel = documentObject.createElement("details");
    panel.id = "referenceSpaceValidationPanel";
    panel.className = "panel-section compact-details mobile-collapsible reference-space-validation-panel";
    panel.dataset.mobileCollapsible = "";
    panel.dataset.desktopDefault = "closed";
    panel.innerHTML = `
      <summary>Reference Space</summary>
      <div class="reference-validation-actions">
        <button id="referenceSpaceValidateBtn" type="button" class="text-btn"><span>현재 컷 검증</span></button>
        <span id="referenceSpaceValidationBadge" class="reference-validation-badge" data-status="review">CHECK</span>
      </div>
      <small id="referenceSpaceValidationSummary" class="reference-validation-summary">Scale Anchor, 실측 치수, 카메라 원근을 현재 컷과 비교합니다.</small>
      <ul id="referenceSpaceValidationList" class="reference-validation-list"><li class="reference-validation-empty">검증 전</li></ul>
    `;
    const anchorPanel = documentObject.querySelector("#referenceGhostPanel") || leftPanel.querySelector("details");
    if (anchorPanel?.insertAdjacentElement) anchorPanel.insertAdjacentElement("afterend", panel);
    else leftPanel.insertBefore(panel, leftPanel.firstChild || null);
    const button = panel.querySelector("#referenceSpaceValidateBtn");
    const badge = panel.querySelector("#referenceSpaceValidationBadge");
    const summary = panel.querySelector("#referenceSpaceValidationSummary");
    const list = panel.querySelector("#referenceSpaceValidationList");
    const render = () => {
      const cut = typeof target.currentCut === "function" ? target.currentCut() : null;
      const blocking = cut?.blocking;
      if (!blocking) {
        badge.dataset.status = "review";
        badge.textContent = "N/A";
        summary.textContent = "현재 블로킹 컷을 찾을 수 없습니다.";
        list.innerHTML = '<li class="reference-validation-empty">블로킹 컷을 연 뒤 다시 검증하세요.</li>';
        return null;
      }
      try {
        const result = validateReferenceSpaceBlocking(blocking, { spatialCore });
        badge.dataset.status = result.status;
        badge.textContent = result.status.toUpperCase();
        summary.textContent = [
          `앵커 ${result.anchorsChecked.length}`,
          `Scale ${result.projectionChecks.length}`,
          `Horizon ${result.horizonCheck ? "1" : "0"}`,
          `카메라 ${result.camera.focalMm}mm / ${result.camera.tiltDeg.toFixed(1)}°`,
          result.camera.keyframes ? `카메라 키 ${result.camera.keyframes}` : "카메라 키 없음",
        ].join(" · ");
        list.innerHTML = "";
        if (!result.issues.length) {
          const item = documentObject.createElement("li");
          item.className = "reference-validation-empty";
          item.textContent = "현재 저장된 Reference Space 기준과 일치합니다.";
          list.appendChild(item);
        } else {
          result.issues.slice(0, 10).forEach((issue) => {
            const item = documentObject.createElement("li");
            item.textContent = issueLabels[issue.code] || issue.code;
            list.appendChild(item);
          });
        }
        return result;
      } catch (error) {
        badge.dataset.status = "review";
        badge.textContent = "ERROR";
        summary.textContent = error?.message || "Reference Space 검증에 실패했습니다.";
        list.innerHTML = '<li class="reference-validation-empty">검증 데이터를 확인하세요.</li>';
        return null;
      }
    };
    button?.addEventListener("click", render);
    panel.addEventListener("toggle", () => { if (panel.open) render(); });
    return true;
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
    if (!spatialCore || typeof spatialCore.fitOverlayRect !== "function" || typeof spatialCore.normalizedToOverlayPoint !== "function") return false;

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
      .reference-ghost-layer[hidden], .reference-ghost-observation-layer[hidden] { display:none !important; }
      .reference-ghost-observation-layer { position:absolute; z-index:2; pointer-events:none; user-select:none; overflow:hidden; }
      .reference-ghost-observation-line { position:absolute; box-sizing:border-box; opacity:.95; }
      .reference-ghost-observation-line.width { height:0; border-top:1.5px solid #5de1ff; }
      .reference-ghost-observation-line.height { width:0; border-left:1.5px solid #5de1ff; }
      .reference-ghost-observation-line.predicted.width { border-top-color:#ffb65f; border-top-style:dashed; }
      .reference-ghost-observation-line.predicted.height { border-left-color:#ffb65f; border-left-style:dashed; }
      .reference-ghost-observation-line.horizon { border-top-width:1px; }
      .reference-ghost-observation-dot { position:absolute; width:7px; height:7px; border:1.5px solid #5de1ff; border-radius:50%; background:rgba(10,16,22,.72); transform:translate(-50%,-50%); box-sizing:border-box; }
      .reference-ghost-observation-label { position:absolute; max-width:180px; padding:2px 4px; border-radius:3px; background:rgba(8,12,18,.72); color:#e7f8ff; font-size:8px; line-height:1.25; white-space:nowrap; text-shadow:0 1px 2px #000; }
      .reference-ghost-observation-label.horizon { color:#b8efff; }
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
      <label class="toggle-row">
        <span>Scale / Horizon 가이드</span>
        <input id="referenceGhostObservationsEnabled" type="checkbox" checked />
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
      <small id="referenceGhostObservationStatus" class="reference-ghost-status">실선은 레퍼런스 관측, 점선은 현재 카메라 예측입니다.</small>
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

    const observationLayer = documentObject.createElement("div");
    observationLayer.id = "referenceGhostObservationLayer";
    observationLayer.className = "reference-ghost-observation-layer";
    observationLayer.setAttribute("aria-hidden", "true");
    observationLayer.hidden = true;
    ghostLayer.insertAdjacentElement?.("afterend", observationLayer) || cameraFrame.appendChild(observationLayer);

    const enabledInput = panel.querySelector("#referenceGhostEnabled");
    const observationsInput = panel.querySelector("#referenceGhostObservationsEnabled");
    const chooseButton = panel.querySelector("#referenceGhostChooseBtn");
    const clearButton = panel.querySelector("#referenceGhostClearBtn");
    const fileInput = panel.querySelector("#referenceGhostFileInput");
    const opacityInput = panel.querySelector("#referenceGhostOpacity");
    const opacityValue = panel.querySelector("#referenceGhostOpacityValue");
    const fitInput = panel.querySelector("#referenceGhostFit");
    const status = panel.querySelector("#referenceGhostStatus");
    const observationStatus = panel.querySelector("#referenceGhostObservationStatus");
    const ghostState = {
      dataUrl: "",
      filename: "",
      width: 0,
      height: 0,
      enabled: true,
      observationsEnabled: true,
      opacity: 0.35,
      fit: "contain",
    };
    let observationSignature = "";

    function setStatus(message) {
      if (status) status.textContent = String(message || "");
    }

    function setObservationStatus(message) {
      if (observationStatus) observationStatus.textContent = String(message || "");
    }

    function clearObservationLayer(message = "실선은 레퍼런스 관측, 점선은 현재 카메라 예측입니다.") {
      observationLayer.innerHTML = "";
      observationLayer.hidden = true;
      observationSignature = "";
      setObservationStatus(message);
    }

    function addObservationLine({ axis, x, y, length, predicted = false, horizon = false }) {
      const safeLength = Math.max(1, Number(length) || 1);
      const line = documentObject.createElement("div");
      line.className = `reference-ghost-observation-line ${axis}${predicted ? " predicted" : " observed"}${horizon ? " horizon" : ""}`;
      if (axis === "width") {
        line.style.left = `${x - safeLength / 2}px`;
        line.style.top = `${y}px`;
        line.style.width = `${safeLength}px`;
      } else {
        line.style.left = `${x}px`;
        line.style.top = `${y - safeLength / 2}px`;
        line.style.height = `${safeLength}px`;
      }
      observationLayer.appendChild(line);
      return line;
    }

    function renderObservationOverlay(rect, canvasRect, frameRect, targetWidth, targetHeight) {
      const hasImage = Boolean(ghostState.dataUrl && ghostState.width > 0 && ghostState.height > 0);
      if (!hasImage || !ghostState.observationsEnabled) {
        clearObservationLayer(hasImage ? "Scale / Horizon 가이드를 껐습니다." : "Ghost 이미지를 선택하면 저장된 관측을 같은 이미지 좌표로 표시합니다.");
        return;
      }
      const cut = typeof target.currentCut === "function" ? target.currentCut() : null;
      const blocking = cut?.blocking;
      if (!blocking) {
        clearObservationLayer("현재 컷의 Reference Space 데이터를 찾을 수 없습니다.");
        return;
      }
      let model;
      try {
        model = buildReferenceGhostObservationModel(blocking, { spatialCore, overlayRect: rect });
      } catch (error) {
        clearObservationLayer(error?.message || "Reference 관측 가이드를 만들지 못했습니다.");
        return;
      }
      observationLayer.style.left = `${canvasRect.left - frameRect.left}px`;
      observationLayer.style.top = `${canvasRect.top - frameRect.top}px`;
      observationLayer.style.width = `${targetWidth}px`;
      observationLayer.style.height = `${targetHeight}px`;
      const signature = JSON.stringify({
        rect: [rect.x, rect.y, rect.width, rect.height],
        status: model.status,
        scales: model.scales.map((entry) => [entry.id, entry.axis, entry.center.x, entry.center.y, entry.observedLengthPx, entry.predictedLengthPx]),
        horizons: model.horizons.map((entry) => [entry.id, entry.observedYPx, entry.predictedYPx]),
      });
      observationLayer.hidden = false;
      if (signature === observationSignature) return;
      observationSignature = signature;
      observationLayer.innerHTML = "";

      model.horizons.forEach((entry) => {
        const centerX = entry.xPx + entry.widthPx / 2;
        addObservationLine({ axis: "width", x: centerX, y: entry.observedYPx, length: entry.widthPx, horizon: true });
        if (Number.isFinite(Number(entry.predictedYPx))) {
          addObservationLine({ axis: "width", x: centerX, y: Number(entry.predictedYPx), length: entry.widthPx, predicted: true, horizon: true });
        }
        const label = documentObject.createElement("span");
        label.className = "reference-ghost-observation-label horizon";
        label.style.left = `${Math.max(2, entry.xPx + 4)}px`;
        label.style.top = `${entry.observedYPx + 3}px`;
        label.textContent = `HORIZON ${(entry.observedY * 100).toFixed(1)}%${Number.isFinite(Number(entry.predictedY)) ? ` / CUR ${(Number(entry.predictedY) * 100).toFixed(1)}%` : ""}`;
        observationLayer.appendChild(label);
      });

      model.scales.forEach((entry) => {
        addObservationLine({ axis: entry.axis, x: entry.center.x, y: entry.center.y, length: entry.observedLengthPx });
        if (Number.isFinite(Number(entry.predictedLengthPx))) {
          addObservationLine({ axis: entry.axis, x: entry.center.x, y: entry.center.y, length: Number(entry.predictedLengthPx), predicted: true });
        }
        const dot = documentObject.createElement("span");
        dot.className = "reference-ghost-observation-dot";
        dot.style.left = `${entry.center.x}px`;
        dot.style.top = `${entry.center.y}px`;
        observationLayer.appendChild(dot);
        const label = documentObject.createElement("span");
        label.className = "reference-ghost-observation-label";
        label.style.left = `${entry.center.x + 5}px`;
        label.style.top = `${entry.center.y + 5}px`;
        const axisLabel = entry.axis === "width" ? "W" : "H";
        label.textContent = `${entry.label} · ${axisLabel} ${(entry.observedFraction * 100).toFixed(1)}%${Number.isFinite(Number(entry.predictedFraction)) ? ` / CUR ${(Number(entry.predictedFraction) * 100).toFixed(1)}%` : ""}`;
        observationLayer.appendChild(label);
      });

      const count = model.scales.length + model.horizons.length;
      setObservationStatus(count
        ? `관측 ${count} · ${model.status.toUpperCase()} · 실선=Reference / 점선=현재 카메라`
        : "현재 컷에 표시할 Scale / Horizon 관측이 없습니다.");
    }

    function syncGhostOverlay() {
      const hasImage = Boolean(ghostState.dataUrl && ghostState.width > 0 && ghostState.height > 0);
      ghostLayer.hidden = !(hasImage && ghostState.enabled);
      if (!hasImage) {
        clearObservationLayer("Ghost 이미지를 선택하면 저장된 관측을 같은 이미지 좌표로 표시합니다.");
        return;
      }
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
      if (!ghostLayer.hidden) {
        ghostLayer.style.left = `${canvasRect.left - frameRect.left + rect.x}px`;
        ghostLayer.style.top = `${canvasRect.top - frameRect.top + rect.y}px`;
        ghostLayer.style.width = `${rect.width}px`;
        ghostLayer.style.height = `${rect.height}px`;
        ghostLayer.style.opacity = String(ghostState.opacity);
      }
      renderObservationOverlay(rect, canvasRect, frameRect, targetWidth, targetHeight);
    }

    function clearGhost() {
      ghostState.dataUrl = "";
      ghostState.filename = "";
      ghostState.width = 0;
      ghostState.height = 0;
      ghostLayer.removeAttribute("src");
      ghostLayer.hidden = true;
      clearObservationLayer("Ghost 이미지를 선택하면 저장된 관측을 같은 이미지 좌표로 표시합니다.");
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
    observationsInput?.addEventListener("change", () => {
      ghostState.observationsEnabled = observationsInput.checked;
      observationSignature = "";
      syncGhostOverlay();
    });
    opacityInput?.addEventListener("input", () => {
      ghostState.opacity = Math.max(0.05, Math.min(0.8, Number(opacityInput.value || 35) / 100));
      if (opacityValue) opacityValue.textContent = `${Math.round(ghostState.opacity * 100)}%`;
      syncGhostOverlay();
    });
    fitInput?.addEventListener("change", () => {
      ghostState.fit = fitInput.value === "cover" ? "cover" : "contain";
      observationSignature = "";
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
        observationSignature = "";
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

    panel.addEventListener("toggle", () => { if (panel.open) syncGhostOverlay(); });
    if (typeof target.ResizeObserver === "function") {
      const observer = new target.ResizeObserver(syncGhostOverlay);
      observer.observe(cameraFrame);
      observer.observe(cameraCanvas);
    }
    target.addEventListener?.("resize", syncGhostOverlay);
    target.addEventListener?.("frisframe:camera-frame-layout", syncGhostOverlay);
    target.setInterval?.(() => {
      if (ghostState.dataUrl && ghostState.observationsEnabled) syncGhostOverlay();
    }, 1200);
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
    buildReferenceGhostObservationModel,
    collectReferenceBatchCuts,
    collectSingleReferenceVideo,
    evaluateProjectReferenceReadiness,
    evaluateReferenceReadiness,
    exportReferenceBatchSafely,
    exportReferenceVideoBatch,
    installBatchReferenceExportUi,
    installReferenceGhostUi,
    installReferenceValidationUi,
    validateReferenceSpaceBlocking,
    partitionReferenceBatchByReadiness,
    referenceEntryKey,
    safeFileSlug,
  };
});
