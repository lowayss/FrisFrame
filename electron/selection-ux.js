(() => {
  "use strict";

  if (document.documentElement.dataset.frisframeSelectionUx === "1") return;
  document.documentElement.dataset.frisframeSelectionUx = "1";

  if (typeof isPointInItem !== "function" || typeof hitTest !== "function" || typeof pickThreeEditor !== "function") {
    console.warn("FrisFrame selection UX could not attach to the editor hit-test functions.");
    return;
  }

  const originalPickThreeEditor = pickThreeEditor;

  function editorItem(editor, renderState = state) {
    if (!editor || editor.kind !== "item") return null;
    return renderState.items.find((item) => item.id === editor.id) || state.items.find((item) => item.id === editor.id) || null;
  }

  function itemIsArchitecture(item) {
    if (!item || item.type !== "prop") return false;
    try {
      return propDefinition(item.assetType)?.kind === "architecture";
    } catch (_error) {
      return false;
    }
  }

  function itemHitMetrics(point, item, renderState, rect = stageRect) {
    const resolved = resolvedItemPose(item, renderState);
    const center = toCanvas(resolved, rect);
    const selectedNow = selected?.id === item.id && ["item", "facing"].includes(selected?.kind);
    const centerDistance = distance(point, center);

    if (item.type === "actor") {
      const visualRadius = itemRadius(resolved, rect) * 1.28;
      const radius = Math.max(visualRadius, selectedNow ? 20 : 16);
      return {
        inside: centerDistance <= radius,
        center,
        centerDistance,
        normalizedDistance: centerDistance / Math.max(1, radius),
        shortSide: radius * 2,
      };
    }

    if (item.assetType === "tree" || item.assetType === "forest") {
      const visualRadius = itemRadius(resolved, rect) * 1.28;
      const radius = Math.max(visualRadius, selectedNow ? 18 : 13);
      return {
        inside: centerDistance <= radius,
        center,
        centerDistance,
        normalizedDistance: centerDistance / Math.max(1, radius),
        shortSide: radius * 2,
      };
    }

    const sizeM = stageWorldSize(renderState);
    const pxPerMeterX = rect.w / sizeM.width;
    const pxPerMeterY = rect.h / sizeM.depth;
    const size = item.size || 1;
    const dims = getPropPhysicalDimensions(item.assetType);
    const width = dims[0] * size * Number(resolved.scaleX || 1) * pxPerMeterX;
    const height = dims[1] * size * Number(resolved.scaleZ || 1) * pxPerMeterY;
    const shortSide = Math.max(1, Math.min(width, height));
    const architecture = itemIsArchitecture(item);

    // Small/thin props get a larger invisible target, while room-scale set pieces
    // stay close to their visible footprint and therefore do not steal nearby clicks.
    let pad = architecture ? 4 : Math.max(7, Math.min(13, 14.5 - shortSide * 0.12));
    if (selectedNow) pad = Math.max(pad, architecture ? 7 : 12);

    const angle = degToRad(resolved.facing);
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    const cos = Math.cos(-angle);
    const sin = Math.sin(-angle);
    const rx = dx * cos - dy * sin;
    const ry = dx * sin + dy * cos;
    const halfWidth = Math.max(1, width / 2 + pad);
    const halfHeight = Math.max(1, height / 2 + pad);

    return {
      inside: Math.abs(rx) <= halfWidth && Math.abs(ry) <= halfHeight,
      center,
      centerDistance,
      normalizedDistance: Math.hypot(rx / halfWidth, ry / halfHeight),
      shortSide,
    };
  }

  // Replace the 2D hit region only. Drawing geometry remains untouched.
  isPointInItem = function adaptiveIsPointInItem(point, item, renderState, rect = stageRect) {
    return itemHitMetrics(point, item, renderState, rect).inside;
  };

  // Resolve overlaps by pointer proximity instead of the old absolute actor-first
  // rule. Large room/wall/set pieces get a mild penalty, while the currently
  // selected object gets only a small amount of stickiness.
  hitTest = function adaptiveHitTest(point, renderState = evaluatedViewState || state) {
    const selectedItemForHandle = selected?.id
      ? renderState.items.find((entry) => entry.id === selected.id)
      : null;
    if (selectedItemForHandle && isGroupLeader(selectedItemForHandle, renderState)) {
      const handle = facingHandlePoint(selectedItemForHandle);
      if (distance(point, handle) < 18) return { kind: "facing", id: selectedItemForHandle.id };
    }

    const cameraHits = cameraFieldRenderEntries(renderState)
      .map((entry) => {
        const center = toCanvas({ x: entry.profileState.camera.x, y: entry.profileState.camera.y });
        return { entry, center, distance: distance(point, center) };
      })
      .filter((entry) => entry.distance < 24)
      .sort((a, b) => a.distance - b.distance || Number(b.entry.active) - Number(a.entry.active));
    if (cameraHits.length) {
      const cameraHit = cameraHits[0];
      return {
        kind: "camera",
        profileId: cameraHit.entry.profile.id,
        fieldOffset: clone(cameraHit.entry.fieldOffset),
      };
    }

    const candidates = [];
    for (let index = renderState.items.length - 1; index >= 0; index -= 1) {
      const item = renderState.items[index];
      if (item.visible === false) continue;
      const metrics = itemHitMetrics(point, item, renderState);
      if (!metrics.inside) continue;

      const architecture = itemIsArchitecture(item);
      const selectedNow = selected?.id === item.id && ["item", "facing"].includes(selected?.kind);
      let score = metrics.normalizedDistance;
      if (architecture) score += 0.34;
      if (item.type === "actor") score -= 0.045;
      if (item.type === "prop" && !architecture && metrics.shortSide < 28) score -= 0.035;
      if (selectedNow) score -= 0.08;

      candidates.push({
        kind: "item",
        id: item.id,
        score,
        centerDistance: metrics.centerDistance,
        renderIndex: index,
      });
    }

    if (!candidates.length) return null;
    candidates.sort((a, b) => a.score - b.score
      || a.centerDistance - b.centerDistance
      || b.renderIndex - a.renderIndex);
    return { kind: "item", id: candidates[0].id };
  };

  function projectWorldPointToCanvas(point, canvasRect) {
    const projected = point.clone().project(threeView.camera);
    if (!Number.isFinite(projected.x) || !Number.isFinite(projected.y) || !Number.isFinite(projected.z)) return null;
    if (projected.z < -1.05 || projected.z > 1.05) return null;
    return {
      x: canvasRect.left + (projected.x * 0.5 + 0.5) * canvasRect.width,
      y: canvasRect.top + (-projected.y * 0.5 + 0.5) * canvasRect.height,
      z: projected.z,
    };
  }

  function objectScreenCenter(object, canvasRect) {
    const THREE = window.THREE;
    if (!THREE || !object) return null;
    try {
      const box = new THREE.Box3().setFromObject(object);
      const center = new THREE.Vector3();
      if (!box.isEmpty()) box.getCenter(center);
      else object.getWorldPosition(center);
      return projectWorldPointToCanvas(center, canvasRect);
    } catch (_error) {
      return null;
    }
  }

  function fallbackThreeItemCandidate(event) {
    if (!threeView?.ready || !threeView.world || !threeView.camera || !threeView.canvas) return null;
    const rect = threeView.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const renderState = threeView.lastState || evaluatedViewState || state;
    const pointer = { x: event.clientX, y: event.clientY };
    const touchBonus = event.pointerType === "touch" ? 6 : 0;
    const candidates = [];

    renderState.items.forEach((item) => {
      if (item.visible === false || itemIsArchitecture(item)) return;
      const root = threeView.world.getObjectByName?.(`item:${item.id}`);
      if (!root || root.visible === false) return;
      const screen = objectScreenCenter(root, rect);
      if (!screen) return;
      const pixelDistance = Math.hypot(pointer.x - screen.x, pointer.y - screen.y);
      const selectedNow = selected?.id === item.id && ["item", "facing"].includes(selected?.kind);
      const baseThreshold = item.type === "actor" ? 20 : 17;
      const threshold = baseThreshold + touchBonus + (selectedNow ? 5 : 0);
      if (pixelDistance > threshold) return;
      candidates.push({
        editor: { kind: "item", id: item.id },
        pixelDistance,
        score: pixelDistance - (selectedNow ? 2.5 : 0) - (item.type === "actor" ? 0.8 : 0),
      });
    });

    const cameraCandidates = new Map();
    threeView.world.traverse((object) => {
      const editor = object.userData?.editor;
      if (!editor || editor.kind !== "camera" || object.visible === false) return;
      const screen = objectScreenCenter(object, rect);
      if (!screen) return;
      const pixelDistance = Math.hypot(pointer.x - screen.x, pointer.y - screen.y);
      const threshold = 19 + touchBonus + (editor.profileId === state.activeCameraId ? 3 : 0);
      if (pixelDistance > threshold) return;
      const key = `${editor.profileId || "camera"}:${Number(editor.fieldOffset?.x || 0).toFixed(4)}:${Number(editor.fieldOffset?.y || 0).toFixed(4)}`;
      const previous = cameraCandidates.get(key);
      if (!previous || pixelDistance < previous.pixelDistance) {
        cameraCandidates.set(key, { editor: clone(editor), pixelDistance, score: pixelDistance + 0.4 });
      }
    });
    candidates.push(...cameraCandidates.values());

    candidates.sort((a, b) => a.score - b.score || a.pixelDistance - b.pixelDistance);
    return candidates[0] || null;
  }

  // Keep precise mesh hits for actors, props, cameras, pose joints, and move
  // handles. Screen-space proximity is only a fallback, or a way for a nearby
  // small object to beat a broad architecture surface behind it.
  pickThreeEditor = function adaptivePickThreeEditor(event) {
    const exact = originalPickThreeEditor(event);
    if (exact?.kind === "poseJoint" || exact?.forceMode === "move") return exact;

    const fallback = fallbackThreeItemCandidate(event);
    if (!fallback) return exact;
    if (!exact) return fallback.editor;
    if (exact.kind === "camera") return exact;
    if (exact.kind !== "item") return exact;
    if (exact.id === fallback.editor.id) return exact;

    const exactItem = editorItem(exact, threeView.lastState || state);
    if (itemIsArchitecture(exactItem) && fallback.pixelDistance <= 20 + (event.pointerType === "touch" ? 6 : 0)) {
      return fallback.editor;
    }
    return exact;
  };

  const tuneRaycaster = () => {
    if (typeof threeView === "undefined" || !threeView?.raycaster) return;
    threeView.raycaster.params.Line.threshold = Math.max(0.09, Number(threeView.raycaster.params.Line.threshold || 0));
    threeView.raycaster.params.Points.threshold = Math.max(0.11, Number(threeView.raycaster.params.Points.threshold || 0));
  };
  tuneRaycaster();
  document.getElementById("viewButtons")?.addEventListener("click", () => requestAnimationFrame(tuneRaycaster), true);
})();
