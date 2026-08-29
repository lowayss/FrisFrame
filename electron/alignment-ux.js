(() => {
  "use strict";

  if (document.documentElement.dataset.frisframeAlignmentUx === "1") return;
  document.documentElement.dataset.frisframeAlignmentUx = "1";

  const stageCanvas = document.getElementById("stageCanvas");
  const threeCanvas = document.getElementById("threeCanvas");
  const canvasWrap = document.querySelector(".canvas-wrap");
  if (!stageCanvas || !threeCanvas || !canvasWrap) return;

  const style = document.createElement("style");
  style.textContent = `
    .frisframe-align-overlay {
      position: absolute;
      inset: 0;
      z-index: 43;
      pointer-events: none;
      overflow: hidden;
    }
    .frisframe-align-guide {
      position: absolute;
      height: 1px;
      transform-origin: 0 50%;
      background: rgba(239,168,87,.78);
      box-shadow: 0 0 0 1px rgba(20,24,28,.22);
      opacity: 0;
    }
    .frisframe-align-guide.is-visible { opacity: .9; }
    .frisframe-align-badge {
      position: absolute;
      left: 50%;
      bottom: 14px;
      transform: translateX(-50%);
      padding: 4px 7px;
      border: 1px solid rgba(255,255,255,.10);
      border-radius: 7px;
      background: rgba(10,14,18,.78);
      color: #cfd6dd;
      font-size: 9px;
      font-weight: 800;
      letter-spacing: .01em;
      opacity: 0;
      backdrop-filter: blur(7px);
      white-space: nowrap;
    }
    .frisframe-align-badge.is-visible { opacity: .9; }
  `;
  document.head.append(style);

  const overlay = document.createElement("div");
  overlay.className = "frisframe-align-overlay";
  const guideX = document.createElement("div");
  guideX.className = "frisframe-align-guide frisframe-align-guide-x";
  const guideY = document.createElement("div");
  guideY.className = "frisframe-align-guide frisframe-align-guide-y";
  const badge = document.createElement("div");
  badge.className = "frisframe-align-badge";
  overlay.append(guideX, guideY, badge);
  canvasWrap.append(overlay);

  let renderFrame = 0;
  let pendingRenderMode = "2d";
  let targetCache = null;

  function itemIsArchitecture(item) {
    if (!item || item.type !== "prop") return false;
    try {
      return propDefinition(item.assetType)?.kind === "architecture";
    } catch (_error) {
      return false;
    }
  }

  function nearestAxisSnap(value, targets, threshold) {
    let nearest = null;
    targets.forEach((target) => {
      const delta = Math.abs(Number(value) - Number(target.value));
      if (delta > threshold) return;
      if (!nearest || delta < nearest.delta) nearest = { ...target, delta };
    });
    return nearest;
  }

  window.FrisFrameAlignmentUxTest = {
    nearestAxisSnap,
  };

  function sameTransformOwner(itemId, activeId) {
    try {
      if (typeof transformLeaderIdForItem !== "function") return itemId === activeId;
      return transformLeaderIdForItem(itemId, state) === transformLeaderIdForItem(activeId, state);
    } catch (_error) {
      return itemId === activeId;
    }
  }

  function alignmentTargets(activeId, renderState = state) {
    const x = [{ value: 0.5, label: "무대 중앙" }];
    const y = [{ value: 0.5, label: "무대 중앙" }];
    renderState.items.forEach((item) => {
      if (item.visible === false || itemIsArchitecture(item) || sameTransformOwner(item.id, activeId)) return;
      const resolved = resolvedItemPose(item, renderState);
      const label = `@${item.name || (item.type === "actor" ? "배우" : "소품")}`;
      x.push({ value: Number(resolved.x), label });
      y.push({ value: Number(resolved.y), label });
    });
    return { x, y };
  }

  function cachedAlignmentTargets(activeId, mode, renderState = state) {
    const size = stageWorldSize(renderState);
    const signature = `${mode}:${activeId}:${renderState.items.length}:${size.width}:${size.depth}`;
    if (targetCache?.signature === signature) return targetCache.targets;
    const targets = alignmentTargets(activeId, renderState);
    targetCache = { signature, targets };
    return targets;
  }

  function clearTargetCache() {
    targetCache = null;
  }

  function snapItem(activeId, mode, event) {
    if (event.altKey) return null;
    const item = state.items.find((entry) => entry.id === activeId);
    if (!item) return null;
    const targets = cachedAlignmentTargets(activeId, mode, state);
    const size = stageWorldSize(state);
    const thresholdMeters = Math.max(0.08, Math.min(0.18, Math.min(size.width, size.depth) * 0.015));
    const thresholdX = mode === "2d"
      ? 8 / Math.max(1, stageRect.w)
      : thresholdMeters / Math.max(0.01, size.width);
    const thresholdY = mode === "2d"
      ? 8 / Math.max(1, stageRect.h)
      : thresholdMeters / Math.max(0.01, size.depth);
    const snapX = nearestAxisSnap(item.x, targets.x, thresholdX);
    const snapY = nearestAxisSnap(item.y, targets.y, thresholdY);
    if (!snapX && !snapY) return null;
    if (snapX) item.x = snapX.value;
    if (snapY) item.y = snapY.value;
    return { x: snapX, y: snapY };
  }

  function placeLine(element, start, end) {
    if (!start || !end) {
      element.classList.remove("is-visible");
      return;
    }
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy);
    element.style.left = `${start.x}px`;
    element.style.top = `${start.y}px`;
    element.style.width = `${length}px`;
    element.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
    element.classList.add("is-visible");
  }

  function wrapPoint(clientX, clientY) {
    const rect = canvasWrap.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function twoDStagePoint(x, y) {
    const canvasRect = stageCanvas.getBoundingClientRect();
    const local = toCanvas({ x, y }, stageRect);
    return wrapPoint(canvasRect.left + local.x, canvasRect.top + local.y);
  }

  function threeDStagePoint(x, y) {
    if (!threeView?.ready || !threeView.camera) return null;
    try {
      const world = mapToWorld({ x, y }, state, 0.04);
      const projected = world.clone().project(threeView.camera);
      if (!Number.isFinite(projected.x) || !Number.isFinite(projected.y) || projected.z < -1.05 || projected.z > 1.05) return null;
      const rect = threeCanvas.getBoundingClientRect();
      return wrapPoint(
        rect.left + (projected.x * 0.5 + 0.5) * rect.width,
        rect.top + (-projected.y * 0.5 + 0.5) * rect.height,
      );
    } catch (_error) {
      return null;
    }
  }

  function showGuides(snap, mode) {
    if (!snap) {
      clearGuides();
      return;
    }
    const pointFor = mode === "3d" ? threeDStagePoint : twoDStagePoint;
    if (snap.x) placeLine(guideX, pointFor(snap.x.value, 0.02), pointFor(snap.x.value, 0.98));
    else guideX.classList.remove("is-visible");
    if (snap.y) placeLine(guideY, pointFor(0.02, snap.y.value), pointFor(0.98, snap.y.value));
    else guideY.classList.remove("is-visible");
    const parts = [];
    if (snap.x) parts.push(`X · ${snap.x.label}`);
    if (snap.y) parts.push(`Y · ${snap.y.label}`);
    badge.textContent = `정렬 ${parts.join(" / ")} · Alt로 해제`;
    badge.classList.toggle("is-visible", parts.length > 0);
  }

  function clearGuides() {
    guideX.classList.remove("is-visible");
    guideY.classList.remove("is-visible");
    badge.classList.remove("is-visible");
  }

  function scheduleRender(mode) {
    pendingRenderMode = mode;
    if (renderFrame) return;
    renderFrame = requestAnimationFrame(() => {
      renderFrame = 0;
      applyCameraTracking(state);
      // The core direct-manipulation handler already synchronizes controls.
      // Alignment only changes the final snapped X/Y, so avoid a second full UI
      // sync and repaint the working viewport directly.
      if (pendingRenderMode === "3d" && threeView?.ready) renderThreeView(state, true);
      else draw();
    });
  }

  stageCanvas.addEventListener("pointermove", (event) => {
    if (typeof drag === "undefined" || !drag || drag.pending || drag.pointerId !== event.pointerId || drag.selection?.kind !== "item") {
      if (!event.buttons) {
        clearGuides();
        clearTargetCache();
      }
      return;
    }
    const activeId = drag.editItemId || drag.selection.id;
    const snap = snapItem(activeId, "2d", event);
    if (!snap) {
      clearGuides();
      return;
    }
    drag.transaction?.apply(state);
    showGuides(snap, "2d");
    scheduleRender("2d");
  });

  threeCanvas.addEventListener("pointermove", (event) => {
    if (typeof threeDrag === "undefined"
      || !threeDrag
      || threeDrag.kind !== "edit"
      || threeDrag.pending
      || threeDrag.pointerId !== event.pointerId
      || threeDrag.editor?.kind !== "item"
      || threeEditMode !== "move") {
      if (!event.buttons) {
        clearGuides();
        clearTargetCache();
      }
      return;
    }
    const activeId = threeDrag.editItemId || threeDrag.editor.id;
    const snap = snapItem(activeId, "3d", event);
    if (!snap) {
      clearGuides();
      return;
    }
    threeDrag.changed = true;
    showGuides(snap, "3d");
    scheduleRender("3d");
  });

  function endAlignmentInteraction() {
    clearGuides();
    clearTargetCache();
  }

  [stageCanvas, threeCanvas].forEach((target) => {
    target.addEventListener("pointerup", endAlignmentInteraction);
    target.addEventListener("pointercancel", endAlignmentInteraction);
    target.addEventListener("pointerleave", (event) => {
      if (!event.buttons) endAlignmentInteraction();
    });
  });
  document.addEventListener("frisframe:drag-cancelled", endAlignmentInteraction);
  window.addEventListener("blur", endAlignmentInteraction);
})();
