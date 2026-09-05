(() => {
  "use strict";

  if (document.documentElement.dataset.frisframeHelperRaycastUx === "1") return;
  document.documentElement.dataset.frisframeHelperRaycastUx = "1";

  const stats = {
    prunedObjects: 0,
    prunedGroups: 0,
    floorPrunes: 0,
    itemPasses: 0,
    cameraPasses: 0,
    pathPasses: 0,
    stagePasses: 0,
  };

  const noopRaycast = () => {};

  function hasInteractiveMetadata(object, stopAt = null) {
    let current = object;
    while (current && current !== stopAt) {
      const data = current.userData || {};
      if (data.editor || data.poseJoint || data.gizmoAxis || data.isMoveHandle || data.cameraFovGuide || data.freeCurveHandle) return true;
      current = current.parent;
    }
    return false;
  }

  function canRaycast(object) {
    return Boolean(
      object
      && typeof object.raycast === "function"
      && (object.isMesh || object.isLine || object.isLineSegments || object.isPoints || object.isSprite),
    );
  }

  function disableRaycast(object) {
    if (!canRaycast(object)) return false;
    if (object.userData?.frisframeRaycastPruned) return false;
    object.userData = object.userData || {};
    object.userData.frisframeRaycastPruned = true;
    object.raycast = noopRaycast;
    stats.prunedObjects += 1;
    return true;
  }

  function pruneVisualGroup(root) {
    if (!root?.traverse) return root;
    let changed = false;
    root.traverse((object) => {
      if (object === root) return;
      if (hasInteractiveMetadata(object, root.parent)) return;
      changed = disableRaycast(object) || changed;
    });
    if (changed) stats.prunedGroups += 1;
    return root;
  }

  function pruneIncidentalHelpers(root) {
    if (!root?.traverse) return root;
    root.traverse((object) => {
      if (object === root || !canRaycast(object)) return;
      if (hasInteractiveMetadata(object, root.parent)) return;
      disableRaycast(object);
    });
    return root;
  }

  function pruneStageFloor() {
    if (!threeView?.world?.children) return;
    for (const child of threeView.world.children) {
      if (!child?.isMesh || child.geometry?.type !== "PlaneGeometry") continue;
      if (hasInteractiveMetadata(child, threeView.world)) continue;
      if (disableRaycast(child)) stats.floorPrunes += 1;
    }
  }

  window.FrisFrameHelperRaycastUxTest = {
    hasInteractiveMetadata,
    canRaycast,
    stats,
  };

  if (typeof makeStageGrid === "function") {
    const originalMakeStageGrid = makeStageGrid;
    makeStageGrid = function raycastPrunedStageGrid(...args) {
      const group = originalMakeStageGrid(...args);
      stats.stagePasses += 1;
      return pruneVisualGroup(group);
    };
  }

  if (typeof makeStageBorder === "function") {
    const originalMakeStageBorder = makeStageBorder;
    makeStageBorder = function raycastPrunedStageBorder(...args) {
      const group = originalMakeStageBorder(...args);
      stats.stagePasses += 1;
      return pruneVisualGroup(group);
    };
  }

  if (typeof drawThreeMotionPaths === "function") {
    const originalDrawThreeMotionPaths = drawThreeMotionPaths;
    drawThreeMotionPaths = function raycastPrunedMotionPaths(...args) {
      const result = originalDrawThreeMotionPaths(...args);
      stats.pathPasses += 1;
      const world = args[1] || threeView?.world;
      const cached = world?.children?.find?.((child) => child?.name === "frisframe:cached-motion-paths");
      if (cached) pruneVisualGroup(cached);
      return result;
    };
  }

  if (typeof makeThreeItem === "function") {
    const originalMakeThreeItem = makeThreeItem;
    makeThreeItem = function raycastPrunedThreeItem(...args) {
      const group = originalMakeThreeItem(...args);
      stats.itemPasses += 1;
      return pruneIncidentalHelpers(group);
    };
  }

  if (typeof makeThreeCamera === "function") {
    const originalMakeThreeCamera = makeThreeCamera;
    makeThreeCamera = function raycastPrunedThreeCamera(...args) {
      const group = originalMakeThreeCamera(...args);
      stats.cameraPasses += 1;
      return pruneIncidentalHelpers(group);
    };
  }

  if (typeof renderThreeView === "function") {
    const originalRenderThreeView = renderThreeView;
    renderThreeView = function raycastPrunedRender(...args) {
      const result = originalRenderThreeView(...args);
      pruneStageFloor();
      return result;
    };
  }
})();
