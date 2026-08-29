(() => {
  "use strict";

  if (document.documentElement.dataset.frisframeSceneCacheUx === "1") return;
  document.documentElement.dataset.frisframeSceneCacheUx = "1";

  const stats = {
    staticItemBuilds: 0,
    staticItemReuses: 0,
    staticItemInvalidations: 0,
    protectedWorldClears: 0,
  };

  const staticItems = new Map();
  let mainRenderDepth = 0;
  let previewRenderDepth = 0;

  function sourceHasMotion(sourceId, renderState = state) {
    return Boolean((renderState.motion?.keyframes || []).some((keyframe) => keyframe.source === sourceId));
  }

  function itemInManualGroup(itemId, renderState = state) {
    return Boolean((renderState.groups || []).some((group) =>
      (group.members || []).some((member) => member.itemId === itemId),
    ));
  }

  function staticItemEligible(item, renderState = state) {
    if (!item || item.type !== "prop" || item.visible === false) return false;
    if (selected?.kind === "item" && selected.id === item.id) return false;
    if (sourceHasMotion(item.id, renderState)) return false;
    if (itemInManualGroup(item.id, renderState)) return false;
    return true;
  }

  function staticItemSignature(item, renderState = state) {
    return JSON.stringify([
      renderState.aspect || "16:9",
      item,
    ]);
  }

  function disposeDetached(group) {
    if (!group) return;
    try {
      disposeThreeObject(group);
    } catch {
      // A failed cache cleanup must never block the editor render path.
    }
  }

  function invalidateEntry(itemId, { dispose = true } = {}) {
    const entry = staticItems.get(itemId);
    if (!entry) return;
    staticItems.delete(itemId);
    if (dispose && !entry.group.parent) disposeDetached(entry.group);
    stats.staticItemInvalidations += 1;
  }

  function reusableEntriesFor(renderState = state) {
    const reusable = new Map();
    (renderState.items || []).forEach((item) => {
      if (!staticItemEligible(item, renderState)) return;
      const entry = staticItems.get(item.id);
      if (!entry) return;
      const signature = staticItemSignature(item, renderState);
      if (entry.signature === signature) reusable.set(item.id, entry);
    });
    return reusable;
  }

  window.FrisFrameSceneCacheUxTest = {
    staticItemEligible,
    staticItemSignature,
    stats,
  };

  if (typeof renderThreeView === "function") {
    const originalRenderThreeView = renderThreeView;
    renderThreeView = function cachedStaticSceneRender(...args) {
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
    renderCameraFramePreview = function sceneCacheAwarePreview(...args) {
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
    clearThreeWorld = function preserveStaticItemsDuringClear() {
      if (!threeView?.ready || !mainRenderDepth || previewRenderDepth) {
        return originalClearThreeWorld();
      }

      const renderState = threeView.lastState || state;
      const reusable = reusableEntriesFor(renderState);
      const protectedGroups = new Set();

      for (const [itemId, entry] of staticItems) {
        if (reusable.get(itemId) === entry && entry.group.parent === threeView.world) {
          threeView.world.remove(entry.group);
          protectedGroups.add(entry.group);
          continue;
        }
        // If an old cached object is still attached, let the normal world clear
        // dispose it. Detached stale entries are disposed here.
        const attached = entry.group.parent === threeView.world;
        staticItems.delete(itemId);
        if (!attached) disposeDetached(entry.group);
        stats.staticItemInvalidations += 1;
      }

      originalClearThreeWorld();
      if (protectedGroups.size) stats.protectedWorldClears += 1;
    };
  }

  if (typeof makeThreeItem === "function") {
    const originalMakeThreeItem = makeThreeItem;
    makeThreeItem = function cachedStaticThreeItem(item, renderState = state) {
      // The preview renderer owns a separate scene graph. Never move cached
      // editor-world objects into previewWorld; preview-cache-ux handles that path.
      if (!mainRenderDepth || previewRenderDepth || !staticItemEligible(item, renderState)) {
        return originalMakeThreeItem(item, renderState);
      }

      const signature = staticItemSignature(item, renderState);
      const cached = staticItems.get(item.id);
      if (cached?.signature === signature) {
        stats.staticItemReuses += 1;
        return cached.group;
      }

      if (cached) invalidateEntry(item.id);
      const group = originalMakeThreeItem(item, renderState);
      staticItems.set(item.id, { signature, group });
      stats.staticItemBuilds += 1;
      return group;
    };
  }

  window.addEventListener("beforeunload", () => {
    for (const [itemId, entry] of staticItems) {
      if (!entry.group.parent) disposeDetached(entry.group);
      staticItems.delete(itemId);
    }
  }, { once: true });
})();
