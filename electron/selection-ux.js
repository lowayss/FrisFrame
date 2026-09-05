(() => {
  "use strict";

  if (document.documentElement.dataset.frisframeSelectionUx === "1") return;
  document.documentElement.dataset.frisframeSelectionUx = "1";

  if (typeof isPointInItem !== "function" || typeof hitTest !== "function" || typeof pickThreeEditor !== "function") {
    console.warn("FrisFrame selection UX could not attach to the editor hit-test functions.");
    return;
  }

  const originalPickThreeEditor = pickThreeEditor;
  const cycleState = {
    mode: "",
    x: 0,
    y: 0,
    signature: "",
    index: -1,
    at: 0,
  };
  let cycleBadge = null;
  let cycleBadgeTimer = 0;

  const style = document.createElement("style");
  style.textContent = `
    .frisframe-cycle-badge {
      position: absolute;
      left: 50%;
      top: 14px;
      z-index: 60;
      transform: translate(-50%, -4px);
      max-width: min(420px, 72vw);
      padding: 6px 9px;
      border: 1px solid rgba(255,255,255,.12);
      border-radius: 8px;
      background: rgba(10,14,18,.86);
      color: #dce3ea;
      box-shadow: 0 7px 20px rgba(0,0,0,.22);
      backdrop-filter: blur(8px);
      font-size: 10px;
      font-weight: 800;
      line-height: 1.2;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      pointer-events: none;
      opacity: 0;
      transition: opacity .1s ease, transform .1s ease;
    }
    .frisframe-cycle-badge.is-visible {
      opacity: .94;
      transform: translate(-50%, 0);
    }
    @media (prefers-reduced-motion: reduce) {
      .frisframe-cycle-badge { transition: none !important; }
    }
  `;
  document.head.append(style);

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

  function editorKey(editor) {
    if (!editor) return "";
    if (editor.kind === "item" || editor.kind === "facing") return `item:${editor.id || ""}`;
    if (editor.kind === "camera") return `camera:${editor.profileId || state.activeCameraId || "active"}`;
    return `${editor.kind || "unknown"}:${editor.id || ""}`;
  }

  function selectedEditorKey() {
    if (!selected) return "";
    return editorKey(selected);
  }

  function resolveCycleIndex(length, currentIndex, previousIndex, continueCycle) {
    if (!Number.isInteger(length) || length <= 0) return -1;
    if (continueCycle) return (Math.max(-1, previousIndex) + 1) % length;
    return currentIndex >= 0 ? (currentIndex + 1) % length : 0;
  }

  window.FrisFrameSelectionUxTest = {
    resolveCycleIndex,
  };

  function ensureCycleBadge() {
    const wrap = document.querySelector(".canvas-wrap");
    if (!wrap) return null;
    if (cycleBadge?.isConnected) return cycleBadge;
    cycleBadge = document.createElement("div");
    cycleBadge.className = "frisframe-cycle-badge";
    cycleBadge.setAttribute("aria-hidden", "true");
    wrap.append(cycleBadge);
    return cycleBadge;
  }

  function showCycleBadge(candidate, index, total) {
    if (total < 2) return;
    const badge = ensureCycleBadge();
    if (!badge) return;
    const label = candidate.label || (candidate.editor?.kind === "camera" ? "카메라" : "대상");
    badge.textContent = `겹친 대상 ${index + 1}/${total} · ${label}`;
    window.clearTimeout(cycleBadgeTimer);
    badge.classList.add("is-visible");
    cycleBadgeTimer = window.setTimeout(() => badge.classList.remove("is-visible"), 850);
  }

  function uniqueCandidates(candidates) {
    const seen = new Set();
    return candidates.filter((candidate) => {
      const key = editorKey(candidate.editor);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      candidate.key = key;
      return true;
    });
  }

  function chooseCycleCandidate(candidates, mode, clientX, clientY) {
    const unique = uniqueCandidates(candidates);
    if (!unique.length) return null;
    const signature = unique.map((candidate) => candidate.key).join("|");
    const now = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
    const sameSpot = Math.hypot(clientX - cycleState.x, clientY - cycleState.y) <= 18;
    const continueCycle = cycleState.mode === mode
      && sameSpot
      && cycleState.signature === signature
      && now - cycleState.at <= 2200;
    const currentIndex = unique.findIndex((candidate) => candidate.key === selectedEditorKey());
    const index = resolveCycleIndex(unique.length, currentIndex, cycleState.index, continueCycle);
    cycleState.mode = mode;
    cycleState.x = clientX;
    cycleState.y = clientY;
    cycleState.signature = signature;
    cycleState.index = index;
    cycleState.at = now;
    return { candidate: unique[index], index, total: unique.length };
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

  isPointInItem = function adaptiveIsPointInItem(point, item, renderState, rect = stageRect) {
    return itemHitMetrics(point, item, renderState, rect).inside;
  };

  function scored2DItemCandidates(point, renderState) {
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
        editor: { kind: "item", id: item.id },
        label: `@${item.name || (item.type === "actor" ? "배우" : "소품")}`,
        score,
        centerDistance: metrics.centerDistance,
        renderIndex: index,
      });
    }
    candidates.sort((a, b) => a.score - b.score
      || a.centerDistance - b.centerDistance
      || b.renderIndex - a.renderIndex);
    return candidates;
  }

  function camera2DCandidates(point, renderState) {
    return cameraFieldRenderEntries(renderState)
      .map((entry) => {
        const center = toCanvas({ x: entry.profileState.camera.x, y: entry.profileState.camera.y });
        const pixelDistance = distance(point, center);
        return {
          editor: {
            kind: "camera",
            profileId: entry.profile.id,
            fieldOffset: clone(entry.fieldOffset),
          },
          label: entry.profile.name || "카메라",
          score: pixelDistance / 24 - (entry.active ? 0.02 : 0),
          pixelDistance,
        };
      })
      .filter((entry) => entry.pixelDistance < 24)
      .sort((a, b) => a.score - b.score || a.pixelDistance - b.pixelDistance);
  }

  function twoDCycleCandidates(point, renderState) {
    return [...camera2DCandidates(point, renderState), ...scored2DItemCandidates(point, renderState)]
      .sort((a, b) => a.score - b.score || (a.centerDistance || a.pixelDistance || 0) - (b.centerDistance || b.pixelDistance || 0));
  }

  hitTest = function adaptiveHitTest(point, renderState = evaluatedViewState || state) {
    const selectedItemForHandle = selected?.id
      ? renderState.items.find((entry) => entry.id === selected.id)
      : null;
    if (selectedItemForHandle && isGroupLeader(selectedItemForHandle, renderState)) {
      const handle = facingHandlePoint(selectedItemForHandle);
      if (distance(point, handle) < 18) return { kind: "facing", id: selectedItemForHandle.id };
    }

    const cameraHits = camera2DCandidates(point, renderState);
    if (cameraHits.length) return cameraHits[0].editor;

    const candidates = scored2DItemCandidates(point, renderState);
    return candidates[0]?.editor || null;
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

  function fallbackThreeCandidates(event) {
    if (!threeView?.ready || !threeView.world || !threeView.camera || !threeView.canvas) return [];
    const rect = threeView.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return [];
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
        label: `@${item.name || (item.type === "actor" ? "배우" : "소품")}`,
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
      const key = editorKey(editor);
      const previous = cameraCandidates.get(key);
      if (!previous || pixelDistance < previous.pixelDistance) {
        cameraCandidates.set(key, {
          editor: clone(editor),
          label: "카메라",
          pixelDistance,
          score: pixelDistance + 0.4,
        });
      }
    });
    candidates.push(...cameraCandidates.values());

    candidates.sort((a, b) => a.score - b.score || a.pixelDistance - b.pixelDistance);
    return candidates;
  }

  function editorFromThreeObject(object) {
    let current = object;
    while (current && current !== threeView.world) {
      if (current.userData?.cameraFovGuide) return null;
      if (current.userData?.editor) return clone(current.userData.editor);
      current = current.parent;
    }
    return null;
  }

  function rayThreeCandidates(event) {
    if (!threeView?.ready || !threeView.raycaster || !threeView.camera || !threeView.world) return [];
    const pointer = threePointer(event);
    if (!pointer) return [];
    threeView.raycaster.setFromCamera(pointer, threeView.camera);
    const hits = threeView.raycaster.intersectObjects(threeView.world.children, true);
    const result = [];
    const seen = new Set();
    hits.forEach((hit, index) => {
      const editor = editorFromThreeObject(hit.object);
      if (!editor || !["item", "camera"].includes(editor.kind)) return;
      const key = editorKey(editor);
      if (seen.has(key)) return;
      seen.add(key);
      const item = editorItem(editor, threeView.lastState || state);
      result.push({
        editor,
        label: editor.kind === "camera" ? "카메라" : `@${item?.name || "대상"}`,
        rayDistance: Number(hit.distance || 0),
        rayIndex: index,
        architecture: itemIsArchitecture(item),
      });
    });
    return result;
  }

  function threeCycleCandidates(event) {
    const ray = rayThreeCandidates(event);
    const fallback = fallbackThreeCandidates(event);
    return uniqueCandidates([
      ...ray,
      ...fallback,
    ]);
  }

  pickThreeEditor = function adaptivePickThreeEditor(event) {
    const exact = originalPickThreeEditor(event);
    if (exact?.kind === "poseJoint" || exact?.forceMode === "move") return exact;

    const fallback = fallbackThreeCandidates(event)[0] || null;
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

  function currentRenderState() {
    try {
      if (typeof currentInteractionFrame === "function") return currentInteractionFrame();
    } catch (_error) {
      // Fall back to the latest evaluated/authored state.
    }
    return evaluatedViewState || state;
  }

  function applyCycleSelection(editor, renderState, mode) {
    if (!editor) return;
    if (editor.kind === "camera" && editor.profileId && editor.profileId !== state.activeCameraId) {
      switchActiveCamera(editor.profileId);
    }
    selected = clone(editor);
    const sourceId = typeof selectedSourceId === "function" ? selectedSourceId() : editor.kind === "item" ? editor.id : "camera";
    if (sourceId) {
      setActiveSource(sourceId);
      selectKeyForSource(sourceId);
    }
    evaluatedViewState = renderState;
    syncUi(false);
    if (mode === "3d" && threeView?.ready) renderThreeView(renderState, true);
    else draw(renderState);
  }

  document.addEventListener("pointerdown", (event) => {
    if (!event.altKey || event.button !== 0) return;
    const stageCanvas = document.getElementById("stageCanvas");
    const threeCanvas = document.getElementById("threeCanvas");

    if (event.target === stageCanvas) {
      const renderState = currentRenderState();
      const point = pointerPoint(event);
      const candidates = twoDCycleCandidates(point, renderState);
      if (candidates.length < 2) return;
      const choice = chooseCycleCandidate(candidates, "2d", event.clientX, event.clientY);
      if (!choice) return;
      event.preventDefault();
      event.stopPropagation();
      applyCycleSelection(choice.candidate.editor, renderState, "2d");
      showCycleBadge(choice.candidate, choice.index, choice.total);
      return;
    }

    if (event.target === threeCanvas && threeView?.ready) {
      const candidates = threeCycleCandidates(event);
      if (candidates.length < 2) return;
      const choice = chooseCycleCandidate(candidates, "3d", event.clientX, event.clientY);
      if (!choice) return;
      event.preventDefault();
      event.stopPropagation();
      const renderState = threeView.lastState || currentRenderState();
      applyCycleSelection(choice.candidate.editor, renderState, "3d");
      showCycleBadge(choice.candidate, choice.index, choice.total);
    }
  }, true);

  const tuneRaycaster = () => {
    if (typeof threeView === "undefined" || !threeView?.raycaster) return;
    threeView.raycaster.params.Line.threshold = Math.max(0.09, Number(threeView.raycaster.params.Line.threshold || 0));
    threeView.raycaster.params.Points.threshold = Math.max(0.11, Number(threeView.raycaster.params.Points.threshold || 0));
  };
  tuneRaycaster();
  document.getElementById("viewButtons")?.addEventListener("click", () => requestAnimationFrame(tuneRaycaster), true);
})();
