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
    cameraRigTransformUpdates: 0,
    cameraRigInvalidations: 0,
    protectedWorldClears: 0,
  };

  let mainRenderDepth = 0;
  let previewRenderDepth = 0;
  let pathCache = null;
  const cameraRigCache = new Map();
  const cameraRigParts = new WeakMap();

  function currentSelectionSignature() {
    return [
      typeof activeSourceId === "function" ? activeSourceId() : "",
      selected?.kind || "",
      selected?.id || "",
      selected?.profileId || "",
    ];
  }

  function motionPathSourceSignature(renderState = state) {
    const items = (renderState.items || [])
      .map((item) => [item.id, item.type, item.color || "", item.visible !== false])
      .sort((first, second) => String(first[0]).localeCompare(String(second[0])));
    const cameras = (renderState.cameras || [])
      .map((profile) => [profile.id || "", profile.color || ""])
      .sort((first, second) => String(first[0]).localeCompare(String(second[0])));
    return [items, cameras];
  }

  function motionPathSignature(renderState = state) {
    return JSON.stringify([
      renderState.aspect || "16:9",
      renderState.motion?.keyframes || [],
      renderState.groups || [],
      motionPathSourceSignature(renderState),
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

  function cameraRigStructureSignature(renderState, profile = null, active = false) {
    const profileId = profile?.id || renderState.activeCameraId || "camera-1";
    return JSON.stringify([
      profile ? { id: profile.id, name: profile.name, color: profile.color } : { id: profileId },
      Boolean(active),
      selected?.kind === "camera" && (selected.profileId || profileId) === profileId,
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
    cameraRigParts.delete(entry.group);
    if (dispose) disposeDetached(entry.group);
    stats.cameraRigInvalidations += 1;
  }

  function identifyCameraRigParts(group) {
    if (!group) return null;
    const cached = cameraRigParts.get(group);
    if (cached) return cached;
    const body = group.children.find((child) => child.name === "camera") || null;
    const supportLines = group.children.filter((child) => child.isLine).slice(0, 4);
    const base = group.children.find((child) => child.isMesh && child.geometry?.type === "TorusGeometry") || null;
    const label = group.children.find((child) => child.isSprite) || null;
    const aimArrow = group.children.find((child) => child.type === "ArrowHelper") || null;
    const cone = group.children.find((child) => (
      child !== body
      && child.isGroup
      && child.userData?.previewHidden
      && child.children?.length === 4
      && child.children[0]?.isMesh
      && child.children.slice(1).every((entry) => entry.isLine)
    )) || null;
    const selectionRing = group.children.find((child) => (
      child !== body
      && child !== cone
      && child.isGroup
      && child.children?.some((entry) => entry.isMesh && entry.geometry?.type === "TorusGeometry")
    )) || null;
    const parts = { body, supportLines, base, label, aimArrow, cone, selectionRing };
    cameraRigParts.set(group, parts);
    return parts;
  }

  function setLinePoints(line, points) {
    if (!line?.geometry?.setFromPoints) return false;
    line.geometry.setFromPoints(points);
    line.geometry.attributes.position.needsUpdate = true;
    if (line.material?.isLineDashedMaterial) line.computeLineDistances?.();
    line.geometry.computeBoundingSphere?.();
    return true;
  }

  function syncCameraCone(cone, origin, angle, fov, length) {
    const THREE = window.THREE;
    if (!THREE || !cone || cone.children?.length < 4) return false;
    const p1 = new THREE.Vector3(
      origin.x + Math.cos(angle - fov / 2) * length,
      0.035,
      origin.z + Math.sin(angle - fov / 2) * length,
    );
    const p2 = new THREE.Vector3(
      origin.x + Math.cos(angle + fov / 2) * length,
      0.035,
      origin.z + Math.sin(angle + fov / 2) * length,
    );
    const center = new THREE.Vector3(
      origin.x + Math.cos(angle) * length,
      0.038,
      origin.z + Math.sin(angle) * length,
    );
    const face = cone.children[0];
    if (!face?.geometry?.setFromPoints) return false;
    face.geometry.setFromPoints([origin, p1, p2]);
    if (!face.geometry.index) face.geometry.setIndex([0, 1, 2]);
    face.geometry.computeVertexNormals();
    face.geometry.computeBoundingSphere?.();
    setLinePoints(cone.children[1], [origin, p1]);
    setLinePoints(cone.children[2], [origin, p2]);
    setLinePoints(cone.children[3], [origin, center]);
    return true;
  }

  function syncCameraRig(group, camera, renderState, profile = null, fieldOffset = { x: 0, y: 0 }) {
    const THREE = window.THREE;
    const parts = identifyCameraRigParts(group);
    if (!THREE || !parts?.body || parts.supportLines.length < 4 || !parts.base || !parts.label || !parts.aimArrow || !parts.cone) {
      return false;
    }

    const displayCamera = cameraWithFieldOffset(camera, fieldOffset);
    const cameraHeight = resolvedCameraRenderHeight(displayCamera);
    const camPos = mapToWorld(displayCamera, renderState, cameraHeight);
    const aimPos = cameraLookTarget(displayCamera, renderState, 10);
    const groundCam = mapToWorld(displayCamera, renderState, 0.04);
    const angle = degToRad(displayCamera.panDeg);
    const fov = degToRad(focalToFov(displayCamera.focal, cameraSensorWidth(renderState)));
    const stageSize = stageWorldSize(renderState);
    const coneLength = Math.max(stageSize.width, stageSize.depth) * 0.9;

    parts.body.position.copy(camPos);
    parts.body.lookAt(aimPos);
    parts.body.rotateY(Math.PI);

    const floorY = 0.05;
    const supportTop = new THREE.Vector3(camPos.x, Math.max(floorY, camPos.y - 0.24), camPos.z);
    const supportCenter = new THREE.Vector3(camPos.x, Math.max(floorY, camPos.y * 0.42), camPos.z);
    setLinePoints(parts.supportLines[0], [supportTop, supportCenter]);
    [[-0.34, -0.28], [0.34, -0.28], [0, 0.4]].forEach(([x, z], index) => {
      setLinePoints(parts.supportLines[index + 1], [
        supportCenter,
        new THREE.Vector3(camPos.x + x, floorY, camPos.z + z),
      ]);
    });

    parts.base.position.set(camPos.x, 0.055, camPos.z);
    parts.label.position.set(camPos.x, camPos.y + 0.72, camPos.z);
    if (parts.selectionRing) parts.selectionRing.position.set(camPos.x, 0.07, camPos.z);
    // The pick pass uses a lightweight screen-space anchor on the cached rig.
    // Keep it in sync with the visible base when a reset, keyframe evaluation,
    // or any other transform-only update reuses the rig. Otherwise the camera
    // can look movable while its old anchor remains at the pre-reset position.
    group.userData.cameraPickPosition = new THREE.Vector3(camPos.x, 0.08, camPos.z);

    const aimDirection = new THREE.Vector3(
      aimPos.x - camPos.x,
      aimPos.y - camPos.y,
      aimPos.z - camPos.z,
    ).normalize();
    parts.aimArrow.position.copy(camPos);
    parts.aimArrow.setDirection(aimDirection);
    parts.aimArrow.setLength(Math.min(3.4, camPos.distanceTo(aimPos)), 0.24, 0.13);
    if (!syncCameraCone(parts.cone, groundCam, angle, fov, coneLength)) return false;

    group.userData.fieldOffset = clone(fieldOffset);
    group.updateMatrixWorld(true);
    stats.cameraRigTransformUpdates += 1;
    return true;
  }

  function expectedCameraRigs(renderState = state) {
    const result = new Map();
    if (typeof cameraFieldRenderEntries !== "function") return result;
    const entries = cameraFieldRenderEntries(renderState);
    const activeCameraId = typeof multiCameraCore !== "undefined"
      ? multiCameraCore.resolveActiveId(renderState.activeCameraId, entries.map((entry) => entry.profile))
      : renderState.activeCameraId;
    entries.forEach(({ profile, profileState }) => {
      const id = profile?.id || profileState?.activeCameraId || "camera-1";
      result.set(id, cameraRigStructureSignature(profileState, profile, id === activeCameraId));
    });
    return result;
  }

  window.FrisFrameCameraPathCacheUxTest = {
    motionPathSourceSignature,
    motionPathSignature,
    cameraRigSignature,
    cameraRigStructureSignature,
    syncCameraRig,
    syncCameraCone,
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
        if (expectedRigs.get(profileId) === entry.structureSignature && entry.group.parent === threeView.world) {
          threeView.world.remove(entry.group);
          protectedCount += 1;
          continue;
        }
        const attached = entry.group.parent === threeView.world;
        cameraRigCache.delete(profileId);
        cameraRigParts.delete(entry.group);
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
      const structureSignature = cameraRigStructureSignature(renderState, profile, active);
      const cached = cameraRigCache.get(profileId);
      if (cached?.structureSignature === structureSignature && syncCameraRig(cached.group, camera, renderState, profile, fieldOffset)) {
        cached.signature = signature;
        stats.cameraRigReuses += 1;
        return cached.group;
      }
      if (cached) invalidateCameraRig(profileId);
      const group = originalMakeThreeCamera(camera, renderState, profile, active, fieldOffset);
      identifyCameraRigParts(group);
      cameraRigCache.set(profileId, { signature, structureSignature, group });
      stats.cameraRigBuilds += 1;
      return group;
    };
  }

  window.addEventListener("beforeunload", () => {
    invalidatePath();
    for (const profileId of [...cameraRigCache.keys()]) invalidateCameraRig(profileId);
  }, { once: true });
})();
