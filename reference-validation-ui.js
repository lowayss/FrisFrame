(function attachReferenceValidationUi(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FrisFrameReferenceValidationUi = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createReferenceValidationUi() {
  "use strict";

  const ASPECTS = Object.freeze({
    "16:9": 16 / 9,
    "9:16": 9 / 16,
    "4:3": 4 / 3,
    "1:1": 1,
    "3:4": 3 / 4,
  });

  function finite(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function ratio(value) {
    if (typeof value === "string") return ASPECTS[value] || ASPECTS["16:9"];
    return finite(value, ASPECTS["16:9"]) > 0 ? finite(value, ASPECTS["16:9"]) : ASPECTS["16:9"];
  }

  function relativeError(actual, expected) {
    return Math.abs(finite(actual) - finite(expected)) / Math.max(Math.abs(finite(expected)), 1e-9);
  }

  function dimensionsFor(item, anchor, spatialCore) {
    if (anchor?.dimensionsM && typeof anchor.dimensionsM === "object") return anchor.dimensionsM;
    if (item?.referenceDimensionsM && typeof item.referenceDimensionsM === "object") return item.referenceDimensionsM;
    if (item?.type === "actor" && typeof spatialCore?.actorDimensions === "function") {
      return spatialCore.actorDimensions({
        size: item.size,
        scaleX: item.scaleX,
        scaleY: item.scaleY,
        scaleZ: item.scaleZ,
      });
    }
    return null;
  }

  function stageWorldPoint(item, stage, spatialCore) {
    return spatialCore.stageNormalizedToWorld(
      { x: finite(item?.x, 0.5), y: finite(item?.y, 0.5) },
      { width: stage.width, depth: stage.depth },
    );
  }

  function targetCenterHeight(item, dimensions) {
    const height = finite(dimensions?.height, item?.type === "actor" ? 1.78 : 1);
    const bottom = finite(item?.verticalOffset ?? item?.mountedHeight, 0);
    return bottom + height / 2;
  }

  function targetDistance(blocking, item, dimensions, stage, spatialCore) {
    const camera = blocking?.camera || {};
    const target = stageWorldPoint(item, stage, spatialCore);
    const cameraWorld = spatialCore.stageNormalizedToWorld(
      { x: finite(camera.x, 0.5), y: finite(camera.y, 0.5) },
      { width: stage.width, depth: stage.depth },
    );
    const dx = target.x - cameraWorld.x;
    const dz = target.z - cameraWorld.z;
    const dy = targetCenterHeight(item, dimensions) - finite(camera.height, 1.6);
    return Math.hypot(dx, dz, dy);
  }

  function footprintOutsideStage(item, dimensions, stage, spatialCore) {
    if (!dimensions) return false;
    const point = stageWorldPoint(item, stage, spatialCore);
    const radians = finite(item?.facing, 0) * Math.PI / 180;
    const width = Math.max(0, finite(dimensions.width, 0));
    const depth = Math.max(0, finite(dimensions.depth, 0));
    const extentX = Math.abs(Math.cos(radians)) * width / 2 + Math.abs(Math.sin(radians)) * depth / 2;
    const extentZ = Math.abs(Math.sin(radians)) * width / 2 + Math.abs(Math.cos(radians)) * depth / 2;
    return point.x - extentX < -stage.width / 2
      || point.x + extentX > stage.width / 2
      || point.z - extentZ < -stage.depth / 2
      || point.z + extentZ > stage.depth / 2;
  }

  function validateBlocking(blocking = {}, options = {}) {
    const spatialCore = options.spatialCore;
    if (!spatialCore
      || typeof spatialCore.stageWorldSize !== "function"
      || typeof spatialCore.stageNormalizedToWorld !== "function"
      || typeof spatialCore.frameFractionForDistance !== "function"
      || typeof spatialCore.horizonFromTilt !== "function") {
      throw new Error("FrisFrameSpatialScaleCore validation functions are required.");
    }

    const positionToleranceM = Math.max(0.001, finite(options.positionToleranceM, 0.05));
    const dimensionToleranceRatio = Math.max(0, finite(options.dimensionToleranceRatio, 0.02));
    const frameTolerance = Math.max(0, finite(options.frameTolerance, 0.03));
    const aspect = ratio(blocking.aspect);
    const stage = spatialCore.stageWorldSize({ aspect });
    const camera = blocking.camera || {};
    const sensorWidthMm = Math.max(1, finite(blocking.cameraSetup?.sensorWidthMm, 36));
    const focalMm = Math.max(1, finite(camera.focal, 50));
    const guide = blocking.spatialGuide && typeof blocking.spatialGuide === "object" ? blocking.spatialGuide : {};
    const items = new Map((blocking.items || []).map((item) => [String(item?.id || ""), item]));
    const issues = [];
    const anchorsChecked = [];
    const projectionChecks = [];
    let horizonCheck = null;

    for (const anchor of guide.anchors || []) {
      if (!anchor || typeof anchor !== "object") continue;
      const id = String(anchor.id || "");
      const kind = String(anchor.kind || "");

      if (kind === "horizon") {
        const observed = finite(anchor.imageY, NaN);
        if (Number.isFinite(observed)) {
          const predicted = spatialCore.horizonFromTilt({
            tiltDeg: finite(camera.tiltDeg, 0),
            focalMm,
            sensorWidthMm,
            aspect,
          });
          horizonCheck = { observed, predicted, residual: observed - predicted };
          if (Math.abs(horizonCheck.residual) > frameTolerance) {
            issues.push({ code: "horizon-mismatch", anchorId: id, ...horizonCheck });
          }
        }
        continue;
      }

      const itemId = String(anchor.attachedItemId || id);
      const item = items.get(itemId);
      if (!item) {
        issues.push({ code: "anchor-item-missing", anchorId: id, itemId });
        continue;
      }
      const point = stageWorldPoint(item, stage, spatialCore);
      const dimensions = dimensionsFor(item, anchor, spatialCore);
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
      if (dimensions && footprintOutsideStage(item, dimensions, stage, spatialCore)) {
        issues.push({ code: "mass-outside-stage", anchorId: id, itemId });
      }

      if (kind === "scale-height" || kind === "scale-width") {
        const axis = kind === "scale-width" ? "width" : "height";
        const observed = finite(axis === "width" ? anchor.imageWidth : anchor.imageHeight, NaN);
        const physicalSizeM = finite(dimensions?.[axis], NaN);
        if (Number.isFinite(observed) && observed > 0 && Number.isFinite(physicalSizeM) && physicalSizeM > 0) {
          const distanceM = targetDistance(blocking, item, dimensions, stage, spatialCore);
          const predicted = spatialCore.frameFractionForDistance({
            axis,
            subjectSizeM: physicalSizeM,
            distanceM,
            focalMm,
            sensorWidthMm,
            aspect,
          });
          const entry = { id, itemId, axis, observed, predicted, residual: observed - predicted, distanceM };
          projectionChecks.push(entry);
          if (Math.abs(entry.residual) > frameTolerance) {
            issues.push({ code: "scale-anchor-frame-mismatch", ...entry });
          }
        } else {
          issues.push({ code: "scale-anchor-observation-incomplete", anchorId: id, itemId });
        }
      }

      anchorsChecked.push({ id, itemId, kind, worldX: point.x, worldZ: point.z });
    }

    const cameraKeyframes = (blocking.motion?.keyframes || []).filter((key) => key?.source === "camera").length;
    return {
      schema: "frisframe-reference-space-validation",
      version: 1,
      status: issues.length ? "review" : "ready",
      stage,
      camera: { focalMm, tiltDeg: finite(camera.tiltDeg, 0), keyframes: cameraKeyframes },
      anchorsChecked,
      projectionChecks,
      horizonCheck,
      issues,
    };
  }

  const ISSUE_LABELS = Object.freeze({
    "anchor-item-missing": "앵커에 연결된 대상을 찾을 수 없음",
    "anchor-x-mismatch": "앵커 X 위치 불일치",
    "anchor-z-mismatch": "앵커 Z 위치 불일치",
    "anchor-dimension-mismatch": "실측 치수 불일치",
    "mass-outside-stage": "큰 공간 덩어리가 무대 밖으로 나감",
    "scale-anchor-frame-mismatch": "Scale Anchor 화면 비율 불일치",
    "scale-anchor-observation-incomplete": "Scale Anchor 측정 정보 부족",
    "horizon-mismatch": "수평선과 카메라 Tilt 불일치",
  });

  function install(target) {
    const documentObject = target?.document;
    if (!documentObject || typeof documentObject.querySelector !== "function" || typeof documentObject.createElement !== "function") return false;
    if (documentObject.querySelector("#referenceSpaceValidationPanel")) return true;
    const leftPanel = documentObject.querySelector(".left-panel");
    const spatialCore = target.FrisFrameSpatialScaleCore;
    if (!leftPanel || !spatialCore) return false;

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
      <small id="referenceSpaceValidationSummary" class="reference-validation-summary">MCP가 적용한 Scale Anchor, 공간 치수, 카메라 원근을 현재 컷 상태와 비교합니다.</small>
      <ul id="referenceSpaceValidationList" class="reference-validation-list"><li class="reference-validation-empty">검증 전</li></ul>
    `;
    const ghostPanel = documentObject.querySelector("#referenceGhostPanel");
    const stagePanel = leftPanel.querySelector("details");
    const anchor = ghostPanel || stagePanel;
    if (anchor?.insertAdjacentElement) anchor.insertAdjacentElement("afterend", panel);
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
        const result = validateBlocking(blocking, { spatialCore });
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
            item.textContent = ISSUE_LABELS[issue.code] || issue.code;
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
    target.addEventListener?.("frisframe:reference-space-changed", render);
    return true;
  }

  return Object.freeze({
    ISSUE_LABELS,
    install,
    validateBlocking,
  });
});
