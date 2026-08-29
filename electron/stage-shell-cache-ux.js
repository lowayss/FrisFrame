(() => {
  "use strict";

  if (document.documentElement.dataset.frisframeStageShellCacheUx === "1") return;
  document.documentElement.dataset.frisframeStageShellCacheUx = "1";

  const stats = {
    gridBuilds: 0,
    gridReuses: 0,
    gridInvalidations: 0,
    borderBuilds: 0,
    borderReuses: 0,
    borderInvalidations: 0,
    protectedWorldClears: 0,
  };

  let mainRenderDepth = 0;
  let previewRenderDepth = 0;
  let gridCache = null;
  let borderCache = null;

  function stageShellSignature(size) {
    const width = Number(size?.width || 0);
    const depth = Number(size?.depth || 0);
    const gridStep = typeof STAGE_GRID_STEP_METERS !== "undefined"
      ? Number(STAGE_GRID_STEP_METERS)
      : null;
    return JSON.stringify([
      Number.isFinite(width) ? Number(width.toFixed(6)) : 0,
      Number.isFinite(depth) ? Number(depth.toFixed(6)) : 0,
      Number.isFinite(gridStep) ? Number(gridStep.toFixed(6)) : null,
    ]);
  }

  function expectedStageShellSignature(renderState = state) {
    if (typeof stageWorldSize !== "function") return "";
    return stageShellSignature(stageWorldSize(renderState));
  }

  function disposeDetached(object) {
    if (!object || object.parent) return;
    try {
      disposeThreeObject(object);
    } catch {
      // Stage-shell cleanup must never block the editor render path.
    }
  }

  function invalidateGrid({ dispose = true } = {}) {
    if (!gridCache) return;
    const entry = gridCache;
    gridCache = null;
    if (dispose) disposeDetached(entry.group);
    stats.gridInvalidations += 1;
  }

  function invalidateBorder({ dispose = true } = {}) {
    if (!borderCache) return;
    const entry = borderCache;
    borderCache = null;
    if (dispose) disposeDetached(entry.group);
    stats.borderInvalidations += 1;
  }

  function preserveEntry(entry, expectedSignature) {
    return Boolean(
      entry
      && entry.signature === expectedSignature
      && entry.group?.parent === threeView?.world,
    );
  }

  window.FrisFrameStageShellCacheUxTest = {
    stageShellSignature,
    stats,
  };

  if (typeof renderThreeView === "function") {
    const originalRenderThreeView = renderThreeView;
    renderThreeView = function stageShellCachedRender(...args) {
      mainRenderDepth += 1;
      try {
        return originalRenderThreeView(...args);
      } finally {
        mainRenderDepth = Math.max(0, mainRenderDepth - 1);
      }
    };
  }

  if (typeof renderCameraFramePreview === "function") {
    const originalRenderCameraFramePreview = renderCameraFramePreview;
    renderCameraFramePreview = function stageShellCacheAwarePreview(...args) {
      previewRenderDepth += 1;
      try {
        return originalRenderCameraFramePreview(...args);
      } finally {
        previewRenderDepth = Math.max(0, previewRenderDepth - 1);
      }
    };
  }

  if (typeof clearThreeWorld === "function") {
    const originalClearThreeWorld = clearThreeWorld;
    clearThreeWorld = function preserveStageShellDuringClear() {
      if (!threeView?.ready || !mainRenderDepth || previewRenderDepth) {
        invalidateGrid();
        invalidateBorder();
        return originalClearThreeWorld();
      }

      const renderState = threeView.lastState || state;
      const expectedSignature = expectedStageShellSignature(renderState);
      let protectedCount = 0;

      if (gridCache) {
        if (preserveEntry(gridCache, expectedSignature)) {
          threeView.world.remove(gridCache.group);
          protectedCount += 1;
        } else {
          const attached = gridCache.group?.parent === threeView.world;
          const stale = gridCache;
          gridCache = null;
          if (!attached) disposeDetached(stale.group);
          stats.gridInvalidations += 1;
        }
      }

      if (borderCache) {
        if (preserveEntry(borderCache, expectedSignature)) {
          threeView.world.remove(borderCache.group);
          protectedCount += 1;
        } else {
          const attached = borderCache.group?.parent === threeView.world;
          const stale = borderCache;
          borderCache = null;
          if (!attached) disposeDetached(stale.group);
          stats.borderInvalidations += 1;
        }
      }

      originalClearThreeWorld();
      if (protectedCount) stats.protectedWorldClears += 1;
    };
  }

  if (typeof makeStageGrid === "function") {
    const originalMakeStageGrid = makeStageGrid;
    makeStageGrid = function cachedStageGrid(size) {
      if (!mainRenderDepth || previewRenderDepth) return originalMakeStageGrid(size);
      const signature = stageShellSignature(size);
      if (gridCache?.signature === signature && !gridCache.group.parent) {
        stats.gridReuses += 1;
        return gridCache.group;
      }
      if (gridCache) invalidateGrid();
      const group = originalMakeStageGrid(size);
      gridCache = { signature, group };
      stats.gridBuilds += 1;
      return group;
    };
  }

  if (typeof makeStageBorder === "function") {
    const originalMakeStageBorder = makeStageBorder;
    makeStageBorder = function cachedStageBorder(size) {
      if (!mainRenderDepth || previewRenderDepth) return originalMakeStageBorder(size);
      const signature = stageShellSignature(size);
      if (borderCache?.signature === signature && !borderCache.group.parent) {
        stats.borderReuses += 1;
        return borderCache.group;
      }
      if (borderCache) invalidateBorder();
      const group = originalMakeStageBorder(size);
      borderCache = { signature, group };
      stats.borderBuilds += 1;
      return group;
    };
  }

  window.addEventListener("beforeunload", () => {
    invalidateGrid();
    invalidateBorder();
  }, { once: true });
})();
