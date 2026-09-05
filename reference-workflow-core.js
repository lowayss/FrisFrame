(function initReferenceWorkflowCore(root, factory) {
  const motionCore = typeof module === "object" && module.exports
    ? require("./motion-core.js")
    : root?.FrisFrameMotionCore;
  const api = factory(motionCore);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FrisFrameReferenceWorkflowCore = api;

  // Desktop/browser UI installs reference export only.
  // Reference Space validation remains an MCP/headless capability rather than a default
  // user-facing panel. Readiness and final prompt composition live in the external MCP
  // conversation.
  if (root?.document && typeof root.addEventListener === "function") {
    const install = () => {
      api.installBatchReferenceExportUi(root);
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
  const hasFiniteObservation = (value) => value !== null
    && value !== undefined
    && value !== ""
    && Number.isFinite(Number(value));
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
      || typeof spatialCore.horizonFromTilt !== "function"
      || typeof spatialCore.projectWorldPointToFrame !== "function") {
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
    const screenPositionChecks = [];
    let horizonCheck = null;
    const worldPoint = (item) => spatialCore.stageNormalizedToWorld(
      { x: finite(item?.x, 0.5), y: finite(item?.y, 0.5) },
      { width: stage.width, depth: stage.depth },
    );
    const cameraGround = spatialCore.stageNormalizedToWorld(
      { x: finite(camera.x, 0.5), y: finite(camera.y, 0.5) },
      { width: stage.width, depth: stage.depth },
    );
    const cameraPosition = { x: cameraGround.x, y: finite(camera.height, 1.6), z: cameraGround.z };
    const dimensionsFor = (item, anchor) => anchor?.dimensionsM || item?.referenceDimensionsM || (
      item?.type === "actor" && typeof spatialCore.actorDimensions === "function"
        ? spatialCore.actorDimensions({ size: item.size, scaleX: item.scaleX, scaleY: item.scaleY, scaleZ: item.scaleZ })
        : null
    );
    const distanceTo = (item, dimensions) => {
      const targetPoint = worldPoint(item);
      const bottom = finite(item?.verticalOffset ?? item?.mountedHeight, 0);
      const centerHeight = bottom + finite(dimensions?.height, item?.type === "actor" ? 1.78 : 1) / 2;
      return Math.hypot(targetPoint.x - cameraPosition.x, targetPoint.z - cameraPosition.z, centerHeight - cameraPosition.y);
    };
    const relativeError = (actual, expected) => Math.abs(finite(actual) - finite(expected)) / Math.max(Math.abs(finite(expected)), 1e-9);

    for (const anchor of guide.anchors || []) {
      if (!anchor || typeof anchor !== "object") continue;
      const id = String(anchor.id || "");
      const kind = String(anchor.kind || "");
      if (kind === "horizon") {
        if (hasFiniteObservation(anchor.imageY)) {
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
      if (hasFiniteObservation(anchor.worldX) && Math.abs(point.x - Number(anchor.worldX)) > positionToleranceM) {
        issues.push({ code: "anchor-x-mismatch", anchorId: id, actualM: point.x, expectedM: Number(anchor.worldX) });
      }
      if (hasFiniteObservation(anchor.worldZ) && Math.abs(point.z - Number(anchor.worldZ)) > positionToleranceM) {
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

        if (hasFiniteObservation(anchor.imageX) && hasFiniteObservation(anchor.imageY)) {
          const observedX = Number(anchor.imageX);
          const observedY = Number(anchor.imageY);
          const bottom = finite(item.verticalOffset ?? item.mountedHeight, 0);
          const centerHeight = bottom + finite(dimensions?.height, item.type === "actor" ? 1.78 : 1) / 2;
          const screen = spatialCore.projectWorldPointToFrame({
            cameraPosition,
            worldPoint: { x: point.x, y: centerHeight, z: point.z },
            panDeg: finite(camera.panDeg, 180),
            tiltDeg: finite(camera.tiltDeg, 0),
            focalMm,
            sensorWidthMm,
            aspect,
          });
          const predictedX = Number.isFinite(Number(screen.frameX)) ? Number(screen.frameX) : null;
          const predictedY = Number.isFinite(Number(screen.frameY)) ? Number(screen.frameY) : null;
          screenPositionChecks.push({
            anchorId: id,
            itemId,
            observedX,
            observedY,
            predictedX,
            predictedY,
            residualX: predictedX == null ? null : observedX - predictedX,
            residualY: predictedY == null ? null : observedY - predictedY,
            depthM: Number.isFinite(Number(screen.depthM)) ? Number(screen.depthM) : null,
            inFront: Boolean(screen.inFront),
            inFrame: Boolean(screen.inFrame),
          });
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
      screenPositionChecks,
      screenPositionPolicy: "diagnostic-only-no-readiness-impact",
      horizonCheck,
      issues,
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
    const anchorPanel = leftPanel.querySelector("details");
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
          `XY ${result.screenPositionChecks.length}`,
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
    buildReferenceBatchManifest,
    collectReferenceBatchCuts,
    collectSingleReferenceVideo,
    evaluateProjectReferenceReadiness,
    evaluateReferenceReadiness,
    exportReferenceBatchSafely,
    exportReferenceVideoBatch,
    installBatchReferenceExportUi,
    installReferenceValidationUi,
    validateReferenceSpaceBlocking,
    partitionReferenceBatchByReadiness,
    referenceEntryKey,
    safeFileSlug,
  };
});
