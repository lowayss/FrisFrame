(() => {
  "use strict";

  if (document.documentElement.dataset.frisframeSceneCacheUx === "1") return;
  document.documentElement.dataset.frisframeSceneCacheUx = "1";

  const stats = {
    staticItemBuilds: 0,
    staticItemReuses: 0,
    staticItemInvalidations: 0,
    staticEligibilityIndexBuilds: 0,
    staticEligibilityIndexReuses: 0,
    staticEligibilityMotionKeysIndexed: 0,
    staticEligibilityGroupMembersIndexed: 0,
    actorRigBuilds: 0,
    actorRigReuses: 0,
    actorRigTransformUpdates: 0,
    actorJointTransformSkips: 0,
    actorScaleSkips: 0,
    actorGroundingReuses: 0,
    actorGroundingRecomputes: 0,
    actorRigInvalidations: 0,
    protectedWorldClears: 0,
  };

  const staticItems = new Map();
  const actorRigs = new Map();
  const actorRigRuntime = new WeakMap();
  let mainRenderDepth = 0;
  let previewRenderDepth = 0;
  let eligibilityIndex = null;

  function buildStaticEligibilityIndex(renderState = state) {
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

    stats.staticEligibilityIndexBuilds += 1;
    stats.staticEligibilityMotionKeysIndexed += keyframes.length;
    stats.staticEligibilityGroupMembersIndexed += groupMemberCount;
    return { renderState, motionSources, groupedItemIds };
  }

  function activeStaticEligibilityIndex(renderState) {
    if (!eligibilityIndex || eligibilityIndex.renderState !== renderState) return null;
    stats.staticEligibilityIndexReuses += 1;
    return eligibilityIndex;
  }

  function sourceHasMotion(sourceId, renderState = state) {
    const index = activeStaticEligibilityIndex(renderState);
    if (index) return index.motionSources.has(sourceId);
    return Boolean((renderState.motion?.keyframes || []).some((keyframe) => keyframe.source === sourceId));
  }

  function itemInManualGroup(itemId, renderState = state) {
    const index = activeStaticEligibilityIndex(renderState);
    if (index) return index.groupedItemIds.has(itemId);
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

  function actorRigEligible(item) {
    if (!item || item.type !== "actor" || item.visible === false) return false;
    const poseEditingSelectedActor = typeof threeEditMode !== "undefined"
      && threeEditMode === "pose"
      && selected?.kind === "item"
      && selected.id === item.id;
    return !poseEditingSelectedActor;
  }

  function actorRigSignature(item, renderState = state) {
    const structural = { ...item };
    // These values can be updated on the existing rig without recreating any
    // geometry/materials or selection helpers.
    delete structural.x;
    delete structural.y;
    delete structural.facing;
    delete structural.pitch;
    delete structural.verticalOffset;
    delete structural.mountedHeight;
    delete structural.bodyPose;
    return JSON.stringify([
      structural,
      selected?.kind === "item" && selected.id === item.id,
      Boolean(renderState.showNames),
    ]);
  }

  function actorPoseTransformSignature(renderItem, renderState = state) {
    return JSON.stringify(actorBodyPoseForRender(renderItem, renderState));
  }

  function actorScaleSignature(dimensions) {
    return JSON.stringify([
      Number(dimensions.width || 0),
      Number(dimensions.height || 0),
      Number(dimensions.depth || 0),
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

  function invalidateStaticEntry(itemId, { dispose = true } = {}) {
    const entry = staticItems.get(itemId);
    if (!entry) return;
    staticItems.delete(itemId);
    if (dispose && !entry.group.parent) disposeDetached(entry.group);
    stats.staticItemInvalidations += 1;
  }

  function invalidateActorEntry(itemId, { dispose = true } = {}) {
    const entry = actorRigs.get(itemId);
    if (!entry) return;
    actorRigs.delete(itemId);
    actorRigRuntime.delete(entry.group);
    if (dispose && !entry.group.parent) disposeDetached(entry.group);
    stats.actorRigInvalidations += 1;
  }

  function reusableStaticEntriesFor(renderState = state) {
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

  function reusableActorEntriesFor(renderState = state) {
    const reusable = new Map();
    (renderState.items || []).forEach((item) => {
      if (!actorRigEligible(item)) return;
      const entry = actorRigs.get(item.id);
      if (!entry) return;
      const signature = actorRigSignature(item, renderState);
      if (entry.signature === signature) reusable.set(item.id, entry);
    });
    return reusable;
  }

  function clearCacheMapForHardWorldClear(cache, invalidationStat) {
    for (const [itemId, entry] of cache) {
      const attached = entry.group.parent === threeView?.world;
      cache.delete(itemId);
      if (cache === actorRigs) actorRigRuntime.delete(entry.group);
      if (!attached) disposeDetached(entry.group);
      stats[invalidationStat] += 1;
    }
  }

  function actorModelFor(group) {
    return group?.children?.find((child) => child.name === "humanoid-rig-v2") || null;
  }

  function applyActorJointTransforms(body, pose) {
    body.traverse((object) => {
      if (!object.isGroup || !object.userData?.jointId) return;
      const jointId = object.userData.jointId;
      const rotation = { ...(pose[jointId] || { x: 0, y: 0, z: 0 }) };
      if (jointId === "lowerArmL" || jointId === "lowerArmR") rotation.x = -Number(rotation.x || 0);
      object.rotation.set(
        degToRad(Number(rotation.x || 0)),
        degToRad(Number(rotation.y || 0)),
        degToRad(Number(rotation.z || 0)),
        "XYZ",
      );
    });
  }

  function syncActorRig(group, item, renderState = state) {
    const THREE = window.THREE;
    const body = actorModelFor(group);
    if (!THREE || !body) return false;

    const renderItem = resolvedItemPose(item, renderState);
    const dimensions = actorPhysicalDimensions(renderItem);
    const rigScale = dimensions.height / spatialScaleCore.ACTOR_RIG_MODEL_HEIGHT_M;
    const pose = actorBodyPoseForRender(renderItem, renderState);
    const poseSignature = JSON.stringify(pose);
    const scaleSignature = actorScaleSignature(dimensions);
    const runtime = actorRigRuntime.get(group) || {};

    if (runtime.poseSignature !== poseSignature) {
      applyActorJointTransforms(body, pose);
      runtime.poseSignature = poseSignature;
    } else {
      stats.actorJointTransformSkips += 1;
    }

    if (runtime.scaleSignature !== scaleSignature) {
      body.scale.set(
        dimensions.width / spatialScaleCore.ACTOR_RIG_WIDTH_M,
        dimensions.height / spatialScaleCore.ACTOR_RIG_MODEL_HEIGHT_M,
        dimensions.depth / spatialScaleCore.ACTOR_RIG_DEPTH_M,
      );
      runtime.scaleSignature = scaleSignature;
    } else {
      stats.actorScaleSkips += 1;
    }

    const groundingSignature = JSON.stringify([
      poseSignature,
      scaleSignature,
      Boolean(renderItem.autoMounted),
    ]);
    if (renderItem.autoMounted) {
      runtime.groundY = -0.79 * rigScale;
      runtime.groundingSignature = groundingSignature;
      body.position.y = runtime.groundY;
      stats.actorGroundingReuses += 1;
    } else if (runtime.groundingSignature !== groundingSignature || !Number.isFinite(runtime.groundY)) {
      // Match makeThreeItem's grounding behavior. Bounds only need to be
      // recalculated when pose/physical scale changes, not while the actor is
      // simply translating or rotating across the stage.
      group.position.set(0, 0, 0);
      body.position.y = 0;
      body.rotation.set(0, 0, 0);
      group.updateMatrixWorld(true);
      const actorBounds = new THREE.Box3().setFromObject(body);
      runtime.groundY = Math.max(0, -actorBounds.min.y);
      runtime.groundingSignature = groundingSignature;
      body.position.y = runtime.groundY;
      stats.actorGroundingRecomputes += 1;
    } else {
      body.position.y = runtime.groundY;
      stats.actorGroundingReuses += 1;
    }

    const angle = degToRad(Number(renderItem.facing || 0));
    const pitch = degToRad(Number(renderItem.pitch || 0));
    body.rotation.set(pitch, Math.PI / 2 - angle, 0, "YXZ");

    const verticalY = Number(renderItem.verticalOffset || 0) + Number(renderItem.mountedHeight || 0);
    const position = mapToWorld(renderItem, renderState, verticalY);
    group.position.set(position.x, position.y, position.z);

    const arrow = group.children.find((child) => child.type === "ArrowHelper");
    if (arrow) {
      const direction = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)).normalize();
      const arrowHeight = renderItem.autoMounted
        ? Math.max(1.05, dimensions.height * 0.84)
        : dimensions.height * 0.84;
      const arrowLength = Math.max(0.3, 0.78 * rigScale);
      arrow.position.set(0, arrowHeight, 0);
      arrow.setDirection(direction);
      arrow.setLength(arrowLength, arrowLength * 0.28, arrowLength * 0.17);
    }

    actorRigRuntime.set(group, runtime);
    group.updateMatrixWorld(true);
    stats.actorRigTransformUpdates += 1;
    return true;
  }

  window.FrisFrameSceneCacheUxTest = {
    buildStaticEligibilityIndex,
    sourceHasMotion,
    itemInManualGroup,
    staticItemEligible,
    staticItemSignature,
    actorRigEligible,
    actorRigSignature,
    actorPoseTransformSignature,
    actorScaleSignature,
    syncActorRig,
    stats,
  };

  if (typeof renderThreeView === "function") {
    const originalRenderThreeView = renderThreeView;
    renderThreeView = function cachedSceneRender(...args) {
      const previousEligibilityIndex = eligibilityIndex;
      const renderState = args[0] || state;
      mainRenderDepth += 1;
      eligibilityIndex = buildStaticEligibilityIndex(renderState);
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
    clearThreeWorld = function preserveCachedItemsDuringClear() {
      if (!threeView?.ready || !mainRenderDepth || previewRenderDepth) {
        if (threeView?.ready) {
          clearCacheMapForHardWorldClear(staticItems, "staticItemInvalidations");
          clearCacheMapForHardWorldClear(actorRigs, "actorRigInvalidations");
        }
        return originalClearThreeWorld();
      }

      const renderState = threeView.lastState || state;
      const reusableStatic = reusableStaticEntriesFor(renderState);
      const reusableActors = reusableActorEntriesFor(renderState);
      let protectedCount = 0;

      for (const [itemId, entry] of staticItems) {
        if (reusableStatic.get(itemId) === entry && entry.group.parent === threeView.world) {
          threeView.world.remove(entry.group);
          protectedCount += 1;
          continue;
        }
        const attached = entry.group.parent === threeView.world;
        staticItems.delete(itemId);
        if (!attached) disposeDetached(entry.group);
        stats.staticItemInvalidations += 1;
      }

      for (const [itemId, entry] of actorRigs) {
        if (reusableActors.get(itemId) === entry && entry.group.parent === threeView.world) {
          threeView.world.remove(entry.group);
          protectedCount += 1;
          continue;
        }
        const attached = entry.group.parent === threeView.world;
        actorRigs.delete(itemId);
        actorRigRuntime.delete(entry.group);
        if (!attached) disposeDetached(entry.group);
        stats.actorRigInvalidations += 1;
      }

      originalClearThreeWorld();
      if (protectedCount) stats.protectedWorldClears += 1;
    };
  }

  if (typeof makeThreeItem === "function") {
    const originalMakeThreeItem = makeThreeItem;
    makeThreeItem = function cachedThreeItem(item, renderState = state) {
      // The preview renderer owns a separate scene graph. Never move cached
      // editor-world objects into previewWorld; preview-cache-ux handles it.
      if (!mainRenderDepth || previewRenderDepth) return originalMakeThreeItem(item, renderState);

      if (item?.type === "actor" && actorRigEligible(item)) {
        const signature = actorRigSignature(item, renderState);
        const cached = actorRigs.get(item.id);
        if (cached?.signature === signature && syncActorRig(cached.group, item, renderState)) {
          stats.actorRigReuses += 1;
          return cached.group;
        }
        if (cached) invalidateActorEntry(item.id);
        const group = originalMakeThreeItem(item, renderState);
        actorRigs.set(item.id, { signature, group });
        stats.actorRigBuilds += 1;
        return group;
      }

      if (staticItemEligible(item, renderState)) {
        const signature = staticItemSignature(item, renderState);
        const cached = staticItems.get(item.id);
        if (cached?.signature === signature) {
          stats.staticItemReuses += 1;
          return cached.group;
        }
        if (cached) invalidateStaticEntry(item.id);
        const group = originalMakeThreeItem(item, renderState);
        staticItems.set(item.id, { signature, group });
        stats.staticItemBuilds += 1;
        return group;
      }

      return originalMakeThreeItem(item, renderState);
    };
  }

  window.addEventListener("beforeunload", () => {
    for (const cache of [staticItems, actorRigs]) {
      for (const [itemId, entry] of cache) {
        if (cache === actorRigs) actorRigRuntime.delete(entry.group);
        if (!entry.group.parent) disposeDetached(entry.group);
        cache.delete(itemId);
      }
    }
  }, { once: true });
})();
