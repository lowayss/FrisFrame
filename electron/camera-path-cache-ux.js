(() => {
  "use strict";

  if (document.documentElement.dataset.frisframeCameraPathCacheUx === "1") return;
  document.documentElement.dataset.frisframeCameraPathCacheUx = "1";

  const stats = {
    pathBuilds: 0,
    pathReuses: 0,
    pathInvalidations: 0,
    cameraRigBuilds: 0,
    cameraRigReuses: 0,
    cameraRigInvalidations: 0,
    protectedWorldClears: 0,
  };

  let mainRenderDepth = 0;
  let previewRenderDepth = 0;
  let pathCache = null;
  const cameraRigCache = new Map();

  function currentSelectionSignature() {
    return [
      typeof activeSourceId === "function" ? activeSourceId() : "",
      selected?.kind || "",
      selected?.id || "",
      selected?.profileId || "",
    ];
  }

  function motionPathSignature(renderState = state) {
    return JSON.stringify([
      renderState.aspect || "16:9",
      renderState.motion?.keyframes || [],
      renderState.groups || [],
      typeof selectedKeyIdForRender === "function" ? selectedKeyIdForRender(renderState) : renderState.motion?.selectedKeyId || "",
      currentSelectionSignature(),
    ]);
  }

  function cameraRigSignature(camera, renderState, profile = null, active = false, fieldOffset = { x: 0, y: 0 }) {
    return JSON.stringify([
      renderState.aspect || "16:9",
      camera,
      renderState.cameraSetup || {},
      profile ? { id: profile.id, name: profile.name, color: profile.color } : null,
      Boolean(active),
      fieldOffset || { x: 0, y: 0 },
      selected?.kind === "camera" ? (selected.profileId || renderState.activeCameraId || "camera-1") : "",
    ]);
  }

  function disposeDetached(group) {
    if (!group || group.parent) return;
    try {
      disposeThreeObject(group);
    } catch {
      // Cache cleanup must never block the editor render path.
    }
  }

  function invalidatePath({ dispose = true } = {}) {
    if (!pathCache) return;
    const entry = pathCache;
    pathCache = null;
    if (dispose) disposeDetached(entry.group);
    stats.pathInvalidations += 1;
  }

  function invalidateCameraRig(profileId, { dispose = true } = {}) {
    const entry = cameraRigCache.get(profileId);
    if (!entry) return;
    cameraRigCache.delete(profileId);
    if (dispose) disposeDetached(entry.group);
    stats.cameraRigInvalidations += 1;
  }

  function expectedCameraRigs(renderState = state) {
    const result = new Map();
    if (typeof cameraFieldRenderEntries !== "function") return result;
    const entries = cameraFieldRenderEntries(renderState);
    const activeCameraId = typeof multiCameraCore !== "undefined"
      ? multiCameraCore.resolveActiveId(renderState.activeCameraId, entries.map((entry) => entry.profile))
      : renderState.activeCameraId;
    entries.forEach(({ profile, profileState, fieldOffset }) => {
      const id = profile?.id || profileState?.activeCameraId || "camera-1";
      result.set(id, cameraRigSignature(
        profileState.camera,
        profileState,
        profile,
        id === activeCameraId,
        fieldOffset,
      ));
    });
    return result;
  }

  window.FrisFrameCameraPathCacheUxTest = {
    motionPathSignature,
    cameraRigSignature,
    stats,
  };

  if (typeof renderThreeView === "function") {
    const originalRenderThreeView = renderThreeView;
    renderThreeView = function cameraPathCachedRender(...args) {
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
    renderCameraFramePreview = function cameraPathCacheAwarePreview(...args) {
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
    clearThreeWorld = function preserveCameraAndPathCachesDuringClear() {
      if (!threeView?.ready || !mainRenderDepth || previewRenderDepth) {
        invalidatePath();
        for (const profileId of [...cameraRigCache.keys()]) invalidateCameraRig(profileId);
        return originalClearThreeWorld();
      }

      const renderState = threeView.lastState || state;
      let protectedCount = 0;
      const expectedPathSignature = motionPathSignature(renderState);
      if (pathCache) {
        if (pathCache.signature === expectedPathSignature && pathCache.group.parent === threeView.world) {
          threeView.world.remove(pathCache.group);
          protectedCount += 1;
        } else {
          const attached = pathCache.group.parent === threeView.world;
          if (!attached) disposeDetached(pathCache.group);
          pathCache = null;
          stats.pathInvalidations += 1;
        }
      }

      const expectedRigs = expectedCameraRigs(renderState);
      for (const [profileId, entry] of cameraRigCache) {
        if (expectedRigs.get(profileId) === entry.signature && entry.group.parent === threeView.world) {
          threeView.world.remove(entry.group);
          protectedCount += 1;
          continue;
        }
        const attached = entry.group.parent === threeView.world;
        cameraRigCache.delete(profileId);
        if (!attached) disposeDetached(entry.group);
        stats.cameraRigInvalidations += 1;
      }

      originalClearThreeWorld();
      if (protectedCount) stats.protectedWorldClears += 1;
    };
  }

  if (typeof drawThreeMotionPaths === "function") {
    const originalDrawThreeMotionPaths = drawThreeMotionPaths;
    drawThreeMotionPaths = function cachedThreeMotionPaths(renderState = state, world = threeView?.world) {
      if (!mainRenderDepth || previewRenderDepth || !world || !window.THREE) {
        return originalDrawThreeMotionPaths(renderState, world);
      }
      const signature = motionPathSignature(renderState);
      if (pathCache?.signature === signature) {
        world.add(pathCache.group);
        stats.pathReuses += 1;
        return;
      }
      if (pathCache) invalidatePath();
      const group = new window.THREE.Group();
      group.name = "frisframe:cached-motion-paths";
      group.userData.previewHidden = true;
      originalDrawThreeMotionPaths(renderState, group);
      world.add(group);
      pathCache = { signature, group };
      stats.pathBuilds += 1;
    };
  }

  if (typeof makeThreeCamera === "function") {
    const originalMakeThreeCamera = makeThreeCamera;
    makeThreeCamera = function cachedThreeCamera(camera, renderState, profile = null, active = false, fieldOffset = { x: 0, y: 0 }) {
      if (!mainRenderDepth || previewRenderDepth) {
        return originalMakeThreeCamera(camera, renderState, profile, active, fieldOffset);
      }
      const profileId = profile?.id || renderState.activeCameraId || "camera-1";
      const signature = cameraRigSignature(camera, renderState, profile, active, fieldOffset);
      const cached = cameraRigCache.get(profileId);
      if (cached?.signature === signature) {
        stats.cameraRigReuses += 1;
        return cached.group;
      }
      if (cached) invalidateCameraRig(profileId);
      const group = originalMakeThreeCamera(camera, renderState, profile, active, fieldOffset);
      cameraRigCache.set(profileId, { signature, group });
      stats.cameraRigBuilds += 1;
      return group;
    };
  }

  window.addEventListener("beforeunload", () => {
    invalidatePath();
    for (const profileId of [...cameraRigCache.keys()]) invalidateCameraRig(profileId);
  }, { once: true });
})();
