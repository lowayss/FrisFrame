(() => {
  "use strict";

  if (document.documentElement.dataset.frisframeDynamicPropCacheUx === "1") return;
  document.documentElement.dataset.frisframeDynamicPropCacheUx = "1";

  const stats = {
    builds: 0,
    reuses: 0,
    transformUpdates: 0,
    invalidations: 0,
    protectedWorldClears: 0,
    eligibilityIndexBuilds: 0,
    eligibilityIndexReuses: 0,
    eligibilityMotionKeysIndexed: 0,
    eligibilityGroupMembersIndexed: 0,
  };

  const propRigs = new Map();
  let mainRenderDepth = 0;
  let previewRenderDepth = 0;
  let eligibilityIndex = null;

  function buildDynamicEligibilityIndex(renderState = state) {
    const motionSources = new Set();
    const groupedItemIds = new Set();
    const keyframes = renderState.motion?.keyframes || [];
    const groups = renderState.groups || [];
    let groupMemberCount = 0;

    keyframes.forEach((keyframe) => {
      if (keyframe?.source) motionSources.add(keyframe.source);
    });
    groups.forEach((group) => {
      (group.members || []).forEach((member) => {
        if (!member?.itemId) return;
        groupedItemIds.add(member.itemId);
        groupMemberCount += 1;
      });
    });

    stats.eligibilityIndexBuilds += 1;
    stats.eligibilityMotionKeysIndexed += keyframes.length;
    stats.eligibilityGroupMembersIndexed += groupMemberCount;
    return { renderState, motionSources, groupedItemIds };
  }

  function activeDynamicEligibilityIndex(renderState) {
    if (!eligibilityIndex || eligibilityIndex.renderState !== renderState) return null;
    stats.eligibilityIndexReuses += 1;
    return eligibilityIndex;
  }

  function sourceHasMotion(sourceId, renderState = state) {
    const index = activeDynamicEligibilityIndex(renderState);
    if (index) return index.motionSources.has(sourceId);
    return Boolean((renderState.motion?.keyframes || []).some((keyframe) => keyframe.source === sourceId));
  }

  function itemInManualGroup(itemId, renderState = state) {
    const index = activeDynamicEligibilityIndex(renderState);
    if (index) return index.groupedItemIds.has(itemId);
    return Boolean((renderState.groups || []).some((group) =>
      (group.members || []).some((member) => member.itemId === itemId),
    ));
  }

  function dynamicPropEligible(item, renderState = state) {
    if (!item || item.type !== "prop" || item.visible === false) return false;
    if (selected?.kind === "item" && selected.id === item.id) return true;
    if (sourceHasMotion(item.id, renderState)) return true;
    if (itemInManualGroup(item.id, renderState)) return true;
    return false;
  }

  function propRigSignature(item, renderState = state) {
    const renderItem = typeof resolvedItemPose === "function"
      ? resolvedItemPose(item, renderState)
      : item;
    const structural = { ...renderItem };
    delete structural.x;
    delete structural.y;
    delete structural.facing;
    delete structural.mountedHeight;
    delete structural.grouped;
    return JSON.stringify([
      structural,
      selected?.kind === "item" && selected.id === item.id,
      Boolean(renderState.showNames),
    ]);
  }

  function disposeDetached(group) {
    if (!group || group.parent) return;
    try {
      disposeThreeObject(group);
    } catch {
      // Dynamic-prop cleanup must never block editor rendering.
    }
  }

  function invalidateProp(itemId, { dispose = true } = {}) {
    const entry = propRigs.get(itemId);
    if (!entry) return;
    propRigs.delete(itemId);
    if (dispose) disposeDetached(entry.group);
    stats.invalidations += 1;
  }

  function reusableEntriesFor(renderState = state) {
    const reusable = new Map();
    (renderState.items || []).forEach((item) => {
      if (!dynamicPropEligible(item, renderState)) return;
      const entry = propRigs.get(item.id);
      if (!entry) return;
      if (entry.signature === propRigSignature(item, renderState)) reusable.set(item.id, entry);
    });
    return reusable;
  }

  function propBodyFor(group) {
    return group?.children?.[0] || null;
  }

  function syncPropRig(group, item, renderState = state) {
    const THREE = window.THREE;
    const body = propBodyFor(group);
    if (!THREE || !body) return false;
    const renderItem = resolvedItemPose(item, renderState);
    const verticalY = Number(renderItem.mountedHeight || 0);
    const position = mapToWorld(renderItem, renderState, verticalY);
    const angle = degToRad(Number(renderItem.facing || 0));

    group.position.set(position.x, position.y, position.z);
    body.rotation.y = -angle;

    const arrow = group.children.find((child) => child.type === "ArrowHelper");
    if (arrow) {
      const direction = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)).normalize();
      arrow.setDirection(direction);
    }

    group.updateMatrixWorld(true);
    stats.transformUpdates += 1;
    return true;
  }

  window.FrisFrameDynamicPropCacheUxTest = {
    buildDynamicEligibilityIndex,
    sourceHasMotion,
    itemInManualGroup,
    dynamicPropEligible,
    propRigSignature,
    stats,
  };

  if (typeof renderThreeView === "function") {
    const originalRenderThreeView = renderThreeView;
    renderThreeView = function dynamicPropCachedRender(...args) {
      const previousEligibilityIndex = eligibilityIndex;
      const renderState = args[0] || state;
      mainRenderDepth += 1;
      eligibilityIndex = buildDynamicEligibilityIndex(renderState);
      try {
        return originalRenderThreeView(...args);
      } finally {
        eligibilityIndex = previousEligibilityIndex;
        mainRenderDepth = Math.max(0, mainRenderDepth - 1);
      }
    };
  }

  if (typeof renderCameraFramePreview === "function") {
    const originalRenderCameraFramePreview = renderCameraFramePreview;
    renderCameraFramePreview = function dynamicPropCacheAwarePreview(...args) {
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
    clearThreeWorld = function preserveDynamicPropsDuringClear() {
      if (!threeView?.ready || !mainRenderDepth || previewRenderDepth) {
        for (const itemId of [...propRigs.keys()]) invalidateProp(itemId);
        return originalClearThreeWorld();
      }

      const renderState = threeView.lastState || state;
      const reusable = reusableEntriesFor(renderState);
      let protectedCount = 0;
      for (const [itemId, entry] of propRigs) {
        if (reusable.get(itemId) === entry && entry.group.parent === threeView.world) {
          threeView.world.remove(entry.group);
          protectedCount += 1;
          continue;
        }
        const attached = entry.group.parent === threeView.world;
        propRigs.delete(itemId);
        if (!attached) disposeDetached(entry.group);
        stats.invalidations += 1;
      }
      originalClearThreeWorld();
      if (protectedCount) stats.protectedWorldClears += 1;
    };
  }

  if (typeof makeThreeItem === "function") {
    const originalMakeThreeItem = makeThreeItem;
    makeThreeItem = function cachedDynamicProp(item, renderState = state) {
      if (!mainRenderDepth || previewRenderDepth || !dynamicPropEligible(item, renderState)) {
        return originalMakeThreeItem(item, renderState);
      }
      const signature = propRigSignature(item, renderState);
      const cached = propRigs.get(item.id);
      if (cached?.signature === signature && syncPropRig(cached.group, item, renderState)) {
        stats.reuses += 1;
        return cached.group;
      }
      if (cached) invalidateProp(item.id);
      const group = originalMakeThreeItem(item, renderState);
      propRigs.set(item.id, { signature, group });
      stats.builds += 1;
      return group;
    };
  }

  window.addEventListener("beforeunload", () => {
    for (const itemId of [...propRigs.keys()]) invalidateProp(itemId);
  }, { once: true });
})();