(function initBootErrorConsole() {
  "use strict";

  function appendError(message) {
    const consoleElement = document.getElementById("debugConsole");
    const errors = document.getElementById("debugErrors");
    if (!consoleElement || !errors) return;
    consoleElement.style.display = "block";
    const row = document.createElement("div");
    row.textContent = message;
    errors.appendChild(row);
  }

  window.addEventListener("error", (event) => {
    appendError(`${event.message} at ${event.filename}:${event.lineno}:${event.colno}`);
  });
  window.addEventListener("unhandledrejection", (event) => {
    appendError(`Promise rejected: ${event.reason?.message || event.reason}`);
  });
})();

(function initBirdseye25DBootstrap() {
  "use strict";

  const MODE_2D = "2d";
  const MODE_25D = "2.5d";
  const MODE_3D = "3d";
  const MODE_CAMERA = "camera";
  const MODES = new Set([MODE_2D, MODE_25D, MODE_3D, MODE_CAMERA]);
  const ROOF_RE = /(^|[\s_\-/])(roof|rooftop|ceiling|천장|지붕)(?=$|[\s_\-/])/i;

  const birdseye = {
    installed: false,
    mode: MODE_2D,
    preset: "left",
    orthoZoom: 1,
    hideRoof: true,
    outline: true,
    perspectiveCamera: null,
    orthographicCamera: null,
    authoredCamera: null,
    originalSetViewMode: null,
    originalUpdateThreeCamera: null,
    originalSyncUi: null,
    originalSyncWorkspaceNavigationState: null,
    originalRenderThreeView: null,
    cameraFrameRestoreHidden: null,
  };

  function normalizeMode(mode) {
    const value = String(mode || "").toLowerCase();
    return MODES.has(value) ? value : MODE_2D;
  }

  function currentRenderState() {
    if (typeof evaluatedViewState !== "undefined" && evaluatedViewState) return evaluatedViewState;
    if (typeof state !== "undefined") return state;
    return null;
  }

  function injectBirdseyeStyles() {
    if (document.getElementById("frisframeBirdseyeStyles")) return;
    const style = document.createElement("style");
    style.id = "frisframeBirdseyeStyles";
    style.textContent = `
      #birdseyeControls {
        position: absolute;
        top: 12px;
        left: 50%;
        z-index: 48;
        display: flex;
        align-items: center;
        gap: 6px;
        transform: translateX(-50%);
        padding: 6px;
        border: 1px solid rgba(150, 171, 183, 0.34);
        border-radius: 10px;
        background: rgba(13, 19, 24, 0.9);
        box-shadow: 0 8px 22px rgba(0, 0, 0, 0.24);
        backdrop-filter: blur(10px);
      }
      #birdseyeControls[hidden] { display: none !important; }
      #birdseyeControls button {
        min-height: 30px;
        padding: 0 10px;
        border: 1px solid rgba(150, 171, 183, 0.24);
        border-radius: 7px;
        background: rgba(31, 42, 49, 0.92);
        color: #dce7ec;
        font: 800 11px/1 system-ui, sans-serif;
        cursor: pointer;
      }
      #birdseyeControls button:hover { border-color: rgba(141, 208, 236, 0.64); }
      #birdseyeControls button.is-active,
      #birdseyeControls button[aria-pressed="true"] {
        border-color: rgba(129, 207, 240, 0.82);
        background: rgba(47, 89, 108, 0.9);
        color: #effbff;
      }
      #threeWrap[data-fris-view="2.5d"] #threeCanvas { cursor: default; }
      #threeWrap[data-fris-view="camera"] #threeCanvas { cursor: crosshair; }
      #viewButtons button[data-view="2.5d"] span,
      #viewButtons button[data-view="camera"] span { white-space: nowrap; }
    `;
    document.head.appendChild(style);
  }

  function makeViewButton(mode, label, icon, title) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.view = mode;
    button.title = title;
    const iconNode = document.createElement("i");
    iconNode.setAttribute("data-lucide", icon);
    iconNode.setAttribute("aria-hidden", "true");
    const text = document.createElement("span");
    text.textContent = label;
    button.append(iconNode, text);
    return button;
  }

  function installViewButtons() {
    const switcher = document.getElementById("viewButtons");
    if (!switcher) return;
    const existing25D = switcher.querySelector('button[data-view="2.5d"]');
    const existingCamera = switcher.querySelector('button[data-view="camera"]');
    const button3D = switcher.querySelector('button[data-view="3d"]');
    if (!existing25D) {
      const button25D = makeViewButton(MODE_25D, "2.5D", "layers-3", "2.5D 조감도");
      switcher.insertBefore(button25D, button3D || null);
    }
    if (!existingCamera) {
      const cameraButton = makeViewButton(MODE_CAMERA, "CAMERA", "camera", "현재 카메라 뷰");
      if (button3D?.nextSibling) switcher.insertBefore(cameraButton, button3D.nextSibling);
      else switcher.appendChild(cameraButton);
    }
    window.lucide?.createIcons?.();
  }

  function makeControlButton(label, attributes = {}) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    Object.entries(attributes).forEach(([key, value]) => button.setAttribute(key, value));
    return button;
  }

  function installBirdseyeControls() {
    const wrap = document.getElementById("threeWrap");
    if (!wrap || document.getElementById("birdseyeControls")) return;
    const controls = document.createElement("div");
    controls.id = "birdseyeControls";
    controls.hidden = true;
    controls.setAttribute("aria-label", "2.5D 조감도 보기");
    controls.append(
      makeControlButton("좌 조감", { "data-birdseye-preset": "left" }),
      makeControlButton("우 조감", { "data-birdseye-preset": "right" }),
      makeControlButton("전체보기", { "data-birdseye-action": "fit" }),
      makeControlButton("지붕/천장 숨김", { "data-birdseye-toggle": "roof", "aria-pressed": "true" }),
      makeControlButton("아웃라인", { "data-birdseye-toggle": "outline", "aria-pressed": "true" }),
    );
    controls.addEventListener("click", handleBirdseyeControl);
    wrap.appendChild(controls);
  }

  function setControlState() {
    const controls = document.getElementById("birdseyeControls");
    if (controls) controls.hidden = birdseye.mode !== MODE_25D;
    document.querySelectorAll("#birdseyeControls [data-birdseye-preset]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.birdseyePreset === birdseye.preset);
    });
    const roof = document.querySelector('#birdseyeControls [data-birdseye-toggle="roof"]');
    const outline = document.querySelector('#birdseyeControls [data-birdseye-toggle="outline"]');
    roof?.setAttribute("aria-pressed", String(birdseye.hideRoof));
    outline?.setAttribute("aria-pressed", String(birdseye.outline));
  }

  function syncModeButtons() {
    const storyboardActive = typeof workspaceMode !== "undefined" && workspaceMode === "storyboard";
    document.querySelectorAll("#viewButtons button[data-view]").forEach((button) => {
      const active = !storyboardActive && button.dataset.view === birdseye.mode;
      button.classList.toggle("is-active", active);
      if (active) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    const wrap = document.getElementById("threeWrap");
    if (wrap) wrap.dataset.frisView = birdseye.mode;
    setControlState();
  }

  function ensureThreeCameras() {
    if (typeof threeView === "undefined" || !threeView?.ready || !window.THREE) return false;
    const THREE = window.THREE;
    if (!birdseye.perspectiveCamera && threeView.camera?.isPerspectiveCamera) {
      birdseye.perspectiveCamera = threeView.camera;
    }
    if (!birdseye.orthographicCamera) {
      birdseye.orthographicCamera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.05, 1000);
      birdseye.orthographicCamera.up.set(0, 1, 0);
    }
    if (!birdseye.authoredCamera) {
      birdseye.authoredCamera = new THREE.PerspectiveCamera(42, 16 / 9, 0.05, 500);
      birdseye.authoredCamera.up.set(0, 1, 0);
    }
    return true;
  }

  function roofElementMap(renderState) {
    const map = new Map();
    const elements = renderState?.setMasterPlan?.elements;
    if (Array.isArray(elements)) {
      elements.forEach((element) => {
        if (element?.id) map.set(String(element.id), element);
      });
    }
    return map;
  }

  function roofCollectionMembers(renderState) {
    const ids = new Set();
    const collections = renderState?.setCollections;
    if (!Array.isArray(collections)) return ids;
    collections.forEach((collection) => {
      const label = `${collection?.id || ""} ${collection?.name || ""}`;
      if (!ROOF_RE.test(label)) return;
      (collection?.memberIds || []).forEach((id) => ids.add(String(id)));
    });
    return ids;
  }

  function isRoofOrCeiling(item, renderState, elementMap, collectionMembers) {
    if (!item) return false;
    if (collectionMembers.has(String(item.id))) return true;
    const element = elementMap.get(String(item.id));
    const text = [
      item.name,
      item.assetType,
      item.kind,
      item.setKind,
      element?.name,
      element?.kind,
      element?.role,
      element?.notes,
      element?.collectionId,
    ].filter(Boolean).join(" ");
    return ROOF_RE.test(text);
  }

  function itemGroupId(group) {
    const name = String(group?.name || "");
    return name.startsWith("item:") ? name.slice(5) : "";
  }

  function removeBirdseyeOutlines(world) {
    const outlines = [];
    world?.traverse?.((object) => {
      if (object.userData?.birdseyeOutline) outlines.push(object);
    });
    outlines.forEach((outline) => {
      outline.parent?.remove(outline);
      outline.geometry?.dispose?.();
      const materials = Array.isArray(outline.material) ? outline.material : [outline.material];
      materials.forEach((material) => material?.dispose?.());
    });
  }

  function addBirdseyeOutlines(world) {
    if (!world || !window.THREE) return;
    const THREE = window.THREE;
    const meshes = [];
    world.children.forEach((group) => {
      if (!group.visible || !itemGroupId(group)) return;
      group.traverse((object) => {
        if (object.isMesh && !object.userData?.previewHidden && !object.userData?.birdseyeOutline) meshes.push(object);
      });
    });
    meshes.forEach((mesh) => {
      if (!mesh.geometry) return;
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(mesh.geometry, 28),
        new THREE.LineBasicMaterial({
          color: "#d9e6eb",
          transparent: true,
          opacity: 0.72,
          depthTest: true,
          depthWrite: false,
        }),
      );
      edges.userData.birdseyeOutline = true;
      edges.userData.previewHidden = true;
      edges.renderOrder = 12;
      edges.raycast = () => {};
      mesh.add(edges);
    });
  }

  function applyBirdseyeDisplayPolicy(renderState) {
    if (typeof threeView === "undefined" || !threeView?.world) return;
    const world = threeView.world;
    const elementMap = roofElementMap(renderState);
    const collectionMembers = roofCollectionMembers(renderState);

    world.children.forEach((group) => {
      const id = itemGroupId(group);
      if (id) {
        const item = renderState?.items?.find?.((candidate) => String(candidate.id) === id);
        group.visible = !(birdseye.mode === MODE_25D && birdseye.hideRoof
          && isRoofOrCeiling(item, renderState, elementMap, collectionMembers));
      } else if (group.name === "cameraRigHelper") {
        group.visible = birdseye.mode !== MODE_CAMERA;
      }
    });

    removeBirdseyeOutlines(world);
    if (birdseye.mode === MODE_25D && birdseye.outline) addBirdseyeOutlines(world);
  }

  function stageAndContentBounds(renderState) {
    const THREE = window.THREE;
    const size = typeof stageWorldSize === "function"
      ? stageWorldSize(renderState)
      : { width: 36, depth: 20.25 };
    const box = new THREE.Box3(
      new THREE.Vector3(-size.width / 2, 0, -size.depth / 2),
      new THREE.Vector3(size.width / 2, 0.1, size.depth / 2),
    );
    threeView.world.children.forEach((group) => {
      if (!group.visible || !itemGroupId(group)) return;
      const itemBox = new THREE.Box3().setFromObject(group);
      if (!itemBox.isEmpty()) box.union(itemBox);
    });
    return box;
  }

  function fitOrthographicCamera(renderState) {
    if (!ensureThreeCameras()) return;
    applyBirdseyeDisplayPolicy(renderState);
    const THREE = window.THREE;
    const camera = birdseye.orthographicCamera;
    const box = stageAndContentBounds(renderState);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    center.y = Math.max(0.6, center.y * 0.78);

    const direction = new THREE.Vector3(
      birdseye.preset === "left" ? 1.0 : -1.0,
      1.22,
      1.0,
    ).normalize();
    const distance = Math.max(80, Math.hypot(size.x, size.y, size.z) * 4.5);
    camera.position.copy(center).addScaledVector(direction, distance);
    camera.near = 0.05;
    camera.far = Math.max(500, distance * 3);
    camera.zoom = birdseye.orthoZoom;
    camera.lookAt(center);
    camera.updateMatrixWorld(true);

    const rect = threeView.wrap.getBoundingClientRect();
    const aspect = Math.max(0.1, rect.width / Math.max(1, rect.height));
    const corners = [];
    [box.min.x, box.max.x].forEach((x) => {
      [box.min.y, box.max.y].forEach((y) => {
        [box.min.z, box.max.z].forEach((z) => corners.push(new THREE.Vector3(x, y, z)));
      });
    });
    let halfX = 1;
    let halfY = 1;
    corners.forEach((corner) => {
      const view = corner.clone().applyMatrix4(camera.matrixWorldInverse);
      halfX = Math.max(halfX, Math.abs(view.x));
      halfY = Math.max(halfY, Math.abs(view.y));
    });
    const halfHeight = Math.max(halfY, halfX / aspect) * 1.12;
    camera.left = -halfHeight * aspect;
    camera.right = halfHeight * aspect;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
    camera.updateProjectionMatrix();
    threeView.camera = camera;
  }

  function updateAuthoredCamera(renderState) {
    if (!ensureThreeCameras()) return;
    applyBirdseyeDisplayPolicy(renderState);
    const camera = birdseye.authoredCamera;
    const source = renderState?.camera;
    if (!source || typeof mapToWorld !== "function" || typeof cameraLookTarget !== "function") {
      threeView.camera = birdseye.perspectiveCamera || threeView.camera;
      birdseye.originalUpdateThreeCamera?.(renderState);
      return;
    }
    const rect = threeView.wrap.getBoundingClientRect();
    camera.aspect = Math.max(0.1, rect.width / Math.max(1, rect.height));
    if (typeof focalToFov === "function" && typeof cameraSensorWidth === "function") {
      camera.fov = focalToFov(source.focal, cameraSensorWidth(renderState));
    }
    const height = typeof resolvedCameraRenderHeight === "function"
      ? resolvedCameraRenderHeight(source)
      : Number(source.height || 1.6);
    const position = mapToWorld(source, renderState, height);
    const target = cameraLookTarget(source, renderState, 10);
    camera.position.copy(position);
    camera.near = 0.05;
    camera.far = 500;
    camera.lookAt(target);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    threeView.camera = camera;
  }

  function restorePerspectiveCamera(renderState) {
    if (!ensureThreeCameras()) return;
    applyBirdseyeDisplayPolicy(renderState);
    if (birdseye.perspectiveCamera) threeView.camera = birdseye.perspectiveCamera;
    birdseye.originalUpdateThreeCamera?.(renderState);
  }

  function updateThreeCameraForMode(renderState) {
    if (birdseye.mode === MODE_25D) {
      fitOrthographicCamera(renderState);
      return;
    }
    if (birdseye.mode === MODE_CAMERA) {
      updateAuthoredCamera(renderState);
      return;
    }
    restorePerspectiveCamera(renderState);
  }

  function syncCameraFrameVisibility() {
    const frame = document.getElementById("cameraFrame");
    if (!frame) return;
    if (birdseye.mode === MODE_CAMERA) {
      if (birdseye.cameraFrameRestoreHidden == null) birdseye.cameraFrameRestoreHidden = frame.hidden;
      frame.hidden = true;
    } else if (birdseye.cameraFrameRestoreHidden != null) {
      frame.hidden = birdseye.cameraFrameRestoreHidden;
      birdseye.cameraFrameRestoreHidden = null;
    }
  }

  function decorateHud() {
    const meta = document.getElementById("threeHudMeta");
    if (!meta || birdseye.mode === MODE_2D || birdseye.mode === MODE_3D) return;
    const suffix = birdseye.mode === MODE_25D
      ? ` · 2.5D ORTHO · ${birdseye.preset === "left" ? "좌 조감" : "우 조감"}`
      : " · CAMERA";
    if (!meta.textContent.endsWith(suffix)) meta.textContent += suffix;
  }

  function requestBirdseyeRender() {
    const renderState = currentRenderState();
    if (!renderState || typeof renderThreeView !== "function") return;
    renderThreeView(renderState, true);
  }

  function handleBirdseyeControl(event) {
    const preset = event.target.closest("button[data-birdseye-preset]");
    if (preset) {
      birdseye.preset = preset.dataset.birdseyePreset === "right" ? "right" : "left";
      birdseye.orthoZoom = 1;
      setControlState();
      requestBirdseyeRender();
      return;
    }
    const action = event.target.closest("button[data-birdseye-action]");
    if (action?.dataset.birdseyeAction === "fit") {
      birdseye.orthoZoom = 1;
      requestBirdseyeRender();
      return;
    }
    const toggle = event.target.closest("button[data-birdseye-toggle]");
    if (!toggle) return;
    if (toggle.dataset.birdseyeToggle === "roof") birdseye.hideRoof = !birdseye.hideRoof;
    if (toggle.dataset.birdseyeToggle === "outline") birdseye.outline = !birdseye.outline;
    setControlState();
    requestBirdseyeRender();
  }

  function handleBirdseyeWheel(event) {
    if (birdseye.mode !== MODE_25D) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const factor = Math.exp(-event.deltaY * 0.0012);
    birdseye.orthoZoom = Math.max(0.35, Math.min(4, birdseye.orthoZoom * factor));
    requestBirdseyeRender();
  }

  function activateMode(mode) {
    const normalized = normalizeMode(mode);
    birdseye.mode = normalized;
    const renderState = currentRenderState();

    if (normalized === MODE_2D) {
      if (typeof threeView !== "undefined" && threeView?.ready && birdseye.perspectiveCamera) {
        threeView.camera = birdseye.perspectiveCamera;
      }
      const result = birdseye.originalSetViewMode(MODE_2D);
      syncCameraFrameVisibility();
      syncModeButtons();
      return result;
    }

    const result = birdseye.originalSetViewMode(MODE_3D);
    if (typeof initThreeView === "function") initThreeView();
    ensureThreeCameras();
    syncCameraFrameVisibility();
    syncModeButtons();
    if (renderState) requestBirdseyeRender();
    return result;
  }

  function installFunctionHooks() {
    if (typeof setViewMode !== "function" || typeof updateThreeCamera !== "function") return false;
    birdseye.originalSetViewMode = setViewMode;
    birdseye.originalUpdateThreeCamera = updateThreeCamera;
    birdseye.originalSyncUi = typeof syncUi === "function" ? syncUi : null;
    birdseye.originalSyncWorkspaceNavigationState = typeof syncWorkspaceNavigationState === "function"
      ? syncWorkspaceNavigationState
      : null;
    birdseye.originalRenderThreeView = typeof renderThreeView === "function" ? renderThreeView : null;

    setViewMode = function setExtendedViewMode(mode) {
      return activateMode(mode);
    };
    updateThreeCamera = function updateExtendedThreeCamera(renderState) {
      return updateThreeCameraForMode(renderState);
    };
    if (birdseye.originalSyncUi) {
      syncUi = function syncExtendedUi(...args) {
        const result = birdseye.originalSyncUi(...args);
        syncModeButtons();
        return result;
      };
    }
    if (birdseye.originalSyncWorkspaceNavigationState) {
      syncWorkspaceNavigationState = function syncExtendedWorkspaceNavigationState(...args) {
        const result = birdseye.originalSyncWorkspaceNavigationState(...args);
        syncModeButtons();
        return result;
      };
    }
    if (birdseye.originalRenderThreeView) {
      renderThreeView = function renderExtendedThreeView(...args) {
        const result = birdseye.originalRenderThreeView(...args);
        syncModeButtons();
        decorateHud();
        return result;
      };
    }
    return true;
  }

  function installBirdseye25D() {
    if (birdseye.installed) return;
    injectBirdseyeStyles();
    installViewButtons();
    installBirdseyeControls();
    if (!installFunctionHooks()) return;
    const canvas3d = document.getElementById("threeCanvas");
    canvas3d?.addEventListener("wheel", handleBirdseyeWheel, { capture: true, passive: false });
    birdseye.mode = typeof viewMode !== "undefined" && viewMode === MODE_3D ? MODE_3D : MODE_2D;
    syncModeButtons();
    birdseye.installed = true;
    window.FrisFrameBirdseye25D = {
      get mode() { return birdseye.mode; },
      get preset() { return birdseye.preset; },
      get hideRoof() { return birdseye.hideRoof; },
      get outline() { return birdseye.outline; },
      setMode: activateMode,
      fit() {
        birdseye.orthoZoom = 1;
        requestBirdseyeRender();
      },
      setPreset(value) {
        birdseye.preset = value === "right" ? "right" : "left";
        birdseye.orthoZoom = 1;
        requestBirdseyeRender();
      },
    };
  }

  window.addEventListener("load", installBirdseye25D, { once: true });
})();

(function initBirdseyeCadEditFlow() {
  "use strict";

  const CAD_STEP_METERS = [0.10, 0.25, 0.50, 1.00];
  const cad = {
    installed: false,
    axisMode: "free",
    snapEnabled: true,
    stepMeters: 0.25,
    rotateStepDeg: 15,
    originalUpdateThreeEditorDrag: null,
    originalPollManagedProjectCommands: null,
    originalSyncUi: null,
    originalRenderThreeView: null,
    lastAutoOpenedPlan: "",
    installAttempts: 0,
  };

  function birdseyeApi() {
    return window.FrisFrameBirdseye25D || null;
  }

  function currentState() {
    return typeof state !== "undefined" ? state : null;
  }

  function isBirdseye25D() {
    return birdseyeApi()?.mode === "2.5d";
  }

  function clampStage(value) {
    const min = typeof STAGE_COORD_MIN !== "undefined" ? Number(STAGE_COORD_MIN) : 0.02;
    const max = typeof STAGE_COORD_MAX !== "undefined" ? Number(STAGE_COORD_MAX) : 0.98;
    return Math.max(min, Math.min(max, Number(value) || 0));
  }

  function stageSize(renderState = currentState()) {
    if (typeof stageWorldSize === "function" && renderState) return stageWorldSize(renderState);
    return { width: 36, depth: 20.25 };
  }

  function leaderIdFor(itemId) {
    if (!itemId) return "";
    if (typeof transformLeaderIdForItem === "function" && currentState()) {
      return transformLeaderIdForItem(itemId, currentState()) || itemId;
    }
    return itemId;
  }

  function groupItemIds(itemId) {
    const leaderId = leaderIdFor(itemId);
    if (!leaderId) return [];
    if (typeof transformGroupItemIds === "function" && currentState()) {
      const ids = transformGroupItemIds(leaderId, currentState());
      if (Array.isArray(ids) && ids.length) return [...new Set(ids.map(String))];
    }
    return [String(leaderId)];
  }

  function selectedItem() {
    const renderState = currentState();
    if (!renderState || typeof selected === "undefined" || !selected?.id) return null;
    if (!["item", "facing"].includes(selected.kind)) return null;
    const leaderId = leaderIdFor(selected.id);
    return renderState.items?.find?.((item) => String(item.id) === String(leaderId)) || null;
  }

  function itemLocked(item) {
    if (!item) return true;
    if (typeof sourceEditLocked === "function") return Boolean(sourceEditLocked(item.id));
    return Boolean(item.editLocked);
  }

  function notifyLocked(item) {
    if (!item) return;
    if (typeof notifyEditLocked === "function") notifyEditLocked(item.name || "대상");
    else if (typeof notifyApp === "function") notifyApp(`${item.name || "대상"}은(는) 잠겨 있습니다.`);
  }

  function injectCadStyles() {
    if (document.getElementById("frisframeBirdseyeCadStyles")) return;
    const style = document.createElement("style");
    style.id = "frisframeBirdseyeCadStyles";
    style.textContent = `
      #birdseyeCadControls {
        position: absolute;
        top: 58px;
        left: 50%;
        z-index: 47;
        display: flex;
        align-items: center;
        gap: 5px;
        max-width: calc(100% - 28px);
        min-height: 34px;
        transform: translateX(-50%);
        padding: 5px 7px;
        border: 1px solid rgba(150, 171, 183, 0.28);
        border-radius: 9px;
        background: rgba(10, 16, 21, 0.88);
        box-shadow: 0 7px 20px rgba(0, 0, 0, 0.2);
        backdrop-filter: blur(10px);
        color: #d9e5ea;
        font: 800 10px/1 system-ui, sans-serif;
      }
      #birdseyeCadControls[hidden] { display: none !important; }
      #birdseyeCadControls button,
      #birdseyeCadControls select {
        min-height: 27px;
        border: 1px solid rgba(150, 171, 183, 0.24);
        border-radius: 6px;
        background: rgba(28, 39, 46, 0.94);
        color: #dce7ec;
        font: 800 10px/1 system-ui, sans-serif;
      }
      #birdseyeCadControls button { padding: 0 9px; cursor: pointer; }
      #birdseyeCadControls select { padding: 0 5px; cursor: pointer; }
      #birdseyeCadControls button.is-active,
      #birdseyeCadControls button[aria-pressed="true"] {
        border-color: rgba(129, 207, 240, 0.86);
        background: rgba(42, 91, 112, 0.94);
        color: #f1fbff;
      }
      #birdseyeCadControls .cad-divider {
        width: 1px;
        height: 19px;
        margin: 0 2px;
        background: rgba(159, 180, 190, 0.22);
      }
      #birdseyeCadControls .cad-label { color: #94a8b2; white-space: nowrap; }
      #birdseyeCadReadout {
        max-width: 430px;
        min-width: 180px;
        overflow: hidden;
        padding: 0 4px;
        color: #b9cbd3;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-weight: 700;
      }
      #birdseyeCadReadout[data-locked="true"] { color: #f2b56d; }
      @media (max-width: 1080px) {
        #birdseyeCadReadout { display: none; }
        #birdseyeCadControls { left: 12px; right: 12px; transform: none; justify-content: center; }
      }
    `;
    document.head.appendChild(style);
  }

  function makeCadButton(label, attributes = {}) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    Object.entries(attributes).forEach(([key, value]) => button.setAttribute(key, value));
    return button;
  }

  function installCadControls() {
    const wrap = document.getElementById("threeWrap");
    if (!wrap || document.getElementById("birdseyeCadControls")) return Boolean(wrap);
    const controls = document.createElement("div");
    controls.id = "birdseyeCadControls";
    controls.hidden = true;
    controls.setAttribute("aria-label", "2.5D CAD 편집 보조");

    const axisLabel = document.createElement("span");
    axisLabel.className = "cad-label";
    axisLabel.textContent = "축";
    const dividerA = document.createElement("span");
    dividerA.className = "cad-divider";
    const dividerB = document.createElement("span");
    dividerB.className = "cad-divider";
    const dividerC = document.createElement("span");
    dividerC.className = "cad-divider";
    const stepLabel = document.createElement("span");
    stepLabel.className = "cad-label";
    stepLabel.textContent = "간격";

    const stepSelect = document.createElement("select");
    stepSelect.id = "cadSnapStep";
    stepSelect.setAttribute("aria-label", "CAD 스냅 및 이동 간격");
    CAD_STEP_METERS.forEach((step) => {
      const option = document.createElement("option");
      option.value = step.toFixed(2);
      option.textContent = `${step.toFixed(2)}m`;
      stepSelect.appendChild(option);
    });
    stepSelect.value = cad.stepMeters.toFixed(2);

    const readout = document.createElement("span");
    readout.id = "birdseyeCadReadout";
    readout.textContent = "대상을 선택하세요";

    controls.append(
      axisLabel,
      makeCadButton("자유", { "data-cad-axis": "free", title: "축 고정 해제 (Esc)" }),
      makeCadButton("X", { "data-cad-axis": "x", title: "X축만 이동 (X)" }),
      makeCadButton("Z", { "data-cad-axis": "z", title: "Z축만 이동 (Z)" }),
      dividerA,
      makeCadButton("스냅", { "data-cad-toggle": "snap", "aria-pressed": "true", title: "미터 그리드 스냅" }),
      stepLabel,
      stepSelect,
      dividerB,
      makeCadButton("-15°", { "data-cad-action": "rotate-left", title: "선택 대상 -15° (Q)" }),
      makeCadButton("+15°", { "data-cad-action": "rotate-right", title: "선택 대상 +15° (E)" }),
      dividerC,
      readout,
    );
    controls.addEventListener("click", handleCadControlClick);
    stepSelect.addEventListener("change", () => {
      const next = Number(stepSelect.value);
      if (CAD_STEP_METERS.includes(next)) cad.stepMeters = next;
      syncCadUi();
    });
    wrap.appendChild(controls);
    return true;
  }

  function itemDimensions(item) {
    if (!item) return null;
    try {
      if (item.type === "actor" && typeof actorPhysicalDimensions === "function") return actorPhysicalDimensions(item);
      if (typeof propPhysicalDimensions === "function") return propPhysicalDimensions(item);
    } catch {
      // Fall back to the persisted metric dimensions below.
    }
    const dims = item.referenceDimensionsM || item.physicalDimensionsM;
    if (!dims) return null;
    return {
      width: Number(dims.width || 0),
      height: Number(dims.height || 0),
      depth: Number(dims.depth || 0),
    };
  }

  function selectedReadout() {
    const item = selectedItem();
    if (!item) return { text: `선택 없음 · 이동 ${cad.stepMeters.toFixed(2)}m · Q/E ${cad.rotateStepDeg}°`, locked: false };
    const renderState = currentState();
    const size = stageSize(renderState);
    const pose = typeof resolvedItemPose === "function" ? resolvedItemPose(item, renderState) : item;
    const worldX = (Number(pose.x || 0.5) - 0.5) * size.width;
    const worldZ = (Number(pose.y || 0.5) - 0.5) * size.depth;
    const dims = itemDimensions(item);
    const dimensionText = dims
      ? ` · ${Number(dims.width).toFixed(2)}×${Number(dims.depth).toFixed(2)}×${Number(dims.height).toFixed(2)}m`
      : "";
    const locked = itemLocked(item);
    return {
      text: `${item.name || item.id} · X ${worldX.toFixed(2)}m · Z ${worldZ.toFixed(2)}m${dimensionText} · ${locked ? "잠금" : "편집 가능"}`,
      locked,
    };
  }

  function syncCadUi() {
    const controls = document.getElementById("birdseyeCadControls");
    if (!controls) return;
    controls.hidden = !isBirdseye25D();
    controls.querySelectorAll("button[data-cad-axis]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.cadAxis === cad.axisMode);
    });
    const snap = controls.querySelector('button[data-cad-toggle="snap"]');
    snap?.setAttribute("aria-pressed", String(cad.snapEnabled));
    const stepSelect = document.getElementById("cadSnapStep");
    if (stepSelect && stepSelect.value !== cad.stepMeters.toFixed(2)) stepSelect.value = cad.stepMeters.toFixed(2);
    const readout = document.getElementById("birdseyeCadReadout");
    if (readout) {
      const value = selectedReadout();
      readout.textContent = value.text;
      readout.dataset.locked = String(value.locked);
    }
  }

  function setAxisMode(mode) {
    cad.axisMode = ["x", "z"].includes(mode) ? mode : "free";
    syncCadUi();
  }

  function toggleAxisMode(mode) {
    setAxisMode(cad.axisMode === mode ? "free" : mode);
  }

  function snapCoordinate(normalized, axisName, renderState = currentState()) {
    if (!cad.snapEnabled) return normalized;
    const size = stageSize(renderState);
    const span = axisName === "x" ? size.width : size.depth;
    const world = (Number(normalized) - 0.5) * span;
    const snappedWorld = Math.round(world / cad.stepMeters) * cad.stepMeters;
    return clampStage(0.5 + snappedWorld / span);
  }

  function constrainedDragTarget(item, drag) {
    let x = Number(item.x);
    let y = Number(item.y);
    const startItem = drag?.startState?.items?.find?.((entry) => String(entry.id) === String(item.id));
    if (cad.axisMode === "x" && startItem) y = Number(startItem.y);
    if (cad.axisMode === "z" && startItem) x = Number(startItem.x);
    if (cad.snapEnabled) {
      if (cad.axisMode !== "z") x = snapCoordinate(x, "x");
      if (cad.axisMode !== "x") y = snapCoordinate(y, "z");
    }
    return { x: clampStage(x), y: clampStage(y) };
  }

  function applyDragCorrection() {
    if (!isBirdseye25D() || typeof threeDrag === "undefined" || !threeDrag) return false;
    if (threeDrag.kind !== "edit" || threeDrag.pending || threeDrag.editor?.kind !== "item") return false;
    if (typeof threeEditMode !== "undefined" && threeEditMode !== "move") return false;
    if (cad.axisMode === "free" && !cad.snapEnabled) return false;
    const renderState = currentState();
    const leaderId = leaderIdFor(threeDrag.editItemId || threeDrag.editor.id);
    const leader = renderState?.items?.find?.((item) => String(item.id) === String(leaderId));
    if (!leader || itemLocked(leader)) return false;
    const target = constrainedDragTarget(leader, threeDrag);
    const correctionX = target.x - Number(leader.x);
    const correctionY = target.y - Number(leader.y);
    if (Math.abs(correctionX) < 1e-9 && Math.abs(correctionY) < 1e-9) return false;

    groupItemIds(leaderId).forEach((id) => {
      const item = renderState.items.find((entry) => String(entry.id) === String(id));
      if (!item || itemLocked(item)) return;
      item.x = clampStage(Number(item.x) + correctionX);
      item.y = clampStage(Number(item.y) + correctionY);
    });
    threeDrag.changed = true;
    return true;
  }

  function installDragHook() {
    if (typeof updateThreeEditorDrag !== "function") return false;
    cad.originalUpdateThreeEditorDrag = updateThreeEditorDrag;
    updateThreeEditorDrag = function updateCadAwareThreeEditorDrag(...args) {
      const result = cad.originalUpdateThreeEditorDrag(...args);
      if (applyDragCorrection() && typeof renderThreeView === "function") {
        const frame = typeof currentInteractionFrame === "function" ? currentInteractionFrame() : currentState();
        renderThreeView(frame, true);
      }
      syncCadUi();
      return result;
    };
    return true;
  }

  function nudgeSelectedMeters(dx, dz, multiplier = 1) {
    const item = selectedItem();
    if (!item) {
      if (typeof notifyApp === "function") notifyApp("2.5D에서 이동할 대상을 먼저 선택하세요.");
      return false;
    }
    if (itemLocked(item)) {
      notifyLocked(item);
      return false;
    }
    if (cad.axisMode === "x" && dz) return false;
    if (cad.axisMode === "z" && dx) return false;
    if (typeof nudge !== "function") return false;
    const size = stageSize(currentState());
    const step = cad.stepMeters * multiplier;
    const amount = dx ? step / size.width : step / size.depth;
    nudge(item, dx, dz, amount);
    requestAnimationFrame(syncCadUi);
    return true;
  }

  function rotateSelected(deltaDegrees) {
    const item = selectedItem();
    if (!item) {
      if (typeof notifyApp === "function") notifyApp("2.5D에서 회전할 대상을 먼저 선택하세요.");
      return false;
    }
    if (itemLocked(item)) {
      notifyLocked(item);
      return false;
    }
    const renderState = currentState();
    const leaderId = leaderIdFor(item.id);
    if (typeof materializeEvaluatedViewForEditing === "function") materializeEvaluatedViewForEditing(leaderId);
    const leader = renderState?.items?.find?.((entry) => String(entry.id) === String(leaderId));
    if (!leader) return false;
    leader.facing = ((Number(leader.facing || 0) + Number(deltaDegrees || 0)) % 360 + 360) % 360;
    const preserved = groupItemIds(leaderId);
    if (typeof commit === "function") commit({ preserveSourceIds: preserved });
    if (typeof syncUi === "function") syncUi(false);
    if (typeof renderThreeView === "function") {
      const frame = typeof currentInteractionFrame === "function" ? currentInteractionFrame() : renderState;
      renderThreeView(frame, true);
    }
    syncCadUi();
    return true;
  }

  function handleCadControlClick(event) {
    const axis = event.target.closest("button[data-cad-axis]");
    if (axis) {
      setAxisMode(axis.dataset.cadAxis);
      return;
    }
    const toggle = event.target.closest("button[data-cad-toggle]");
    if (toggle?.dataset.cadToggle === "snap") {
      cad.snapEnabled = !cad.snapEnabled;
      syncCadUi();
      return;
    }
    const action = event.target.closest("button[data-cad-action]");
    if (action?.dataset.cadAction === "rotate-left") rotateSelected(-cad.rotateStepDeg);
    if (action?.dataset.cadAction === "rotate-right") rotateSelected(cad.rotateStepDeg);
  }

  function isTextEntryTarget(target) {
    if (!(target instanceof Element)) return false;
    return Boolean(target.closest("input, textarea, select, [contenteditable='true'], [contenteditable='plaintext-only']"));
  }

  function handleCadKeyboard(event) {
    if (!isBirdseye25D() || isTextEntryTarget(event.target)) return;
    if (document.querySelector("dialog[open]")) return;
    if (event.metaKey || event.ctrlKey) return;

    if (!event.altKey && ["KeyX", "KeyZ", "Escape"].includes(event.code)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.code === "KeyX") toggleAxisMode("x");
      else if (event.code === "KeyZ") toggleAxisMode("z");
      else setAxisMode("free");
      return;
    }

    if (!event.altKey && ["KeyQ", "KeyE"].includes(event.code)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      rotateSelected(event.code === "KeyQ" ? -cad.rotateStepDeg : cad.rotateStepDeg);
      return;
    }

    const direction = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    }[event.key];
    if (!direction) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const multiplier = event.shiftKey ? 4 : (event.altKey ? 0.1 : 1);
    nudgeSelectedMeters(direction[0], direction[1], multiplier);
  }

  function masterPlanSignature(renderState = currentState()) {
    const plan = renderState?.setMasterPlan;
    if (!plan || !Array.isArray(plan.elements)) return "";
    return JSON.stringify({
      schema: plan.schema || "",
      version: plan.version || 0,
      sourceName: plan.sourceName || "",
      generatedItemIds: Array.isArray(plan.generatedItemIds) ? plan.generatedItemIds : [],
      elements: plan.elements.map((element) => [
        element.id,
        element.worldXM,
        element.worldZM,
        element.widthM,
        element.depthM,
        element.heightM,
        element.rotationDeg,
        element.collectionId,
      ]),
    });
  }

  function openMasterPlanInBirdseye(signature) {
    const birdseye = birdseyeApi();
    if (!birdseye || !signature || cad.lastAutoOpenedPlan === signature) return;
    cad.lastAutoOpenedPlan = signature;
    if (typeof workspaceMode !== "undefined" && workspaceMode === "storyboard" && typeof setWorkspaceMode === "function") {
      setWorkspaceMode("blocking");
    }
    birdseye.setMode("2.5d");
    requestAnimationFrame(() => {
      birdseye.fit();
      syncCadUi();
    });
    if (typeof notifyApp === "function") notifyApp("세트 마스터플랜을 2.5D 전체보기로 열었습니다.");
  }

  function installManagedProjectAutoOpenHook() {
    if (typeof pollManagedProjectCommands !== "function") return false;
    cad.originalPollManagedProjectCommands = pollManagedProjectCommands;
    pollManagedProjectCommands = async function pollManagedProjectCommandsWithBirdseye(...args) {
      const beforeRevision = typeof managedProjectRevision !== "undefined" ? Number(managedProjectRevision || 0) : 0;
      const beforeSignature = masterPlanSignature();
      const result = await cad.originalPollManagedProjectCommands(...args);
      const afterRevision = typeof managedProjectRevision !== "undefined" ? Number(managedProjectRevision || 0) : beforeRevision;
      const afterSignature = masterPlanSignature();
      if (afterRevision > beforeRevision && afterSignature && afterSignature !== beforeSignature) {
        openMasterPlanInBirdseye(afterSignature);
      }
      return result;
    };
    return true;
  }

  function installUiSyncHooks() {
    if (typeof syncUi === "function") {
      cad.originalSyncUi = syncUi;
      syncUi = function syncCadAwareUi(...args) {
        const result = cad.originalSyncUi(...args);
        syncCadUi();
        return result;
      };
    }
    if (typeof renderThreeView === "function") {
      cad.originalRenderThreeView = renderThreeView;
      renderThreeView = function renderCadAwareThreeView(...args) {
        const result = cad.originalRenderThreeView(...args);
        syncCadUi();
        return result;
      };
    }
  }

  function installCadEditFlow() {
    if (cad.installed) return;
    cad.installAttempts += 1;
    if (!birdseyeApi() || typeof updateThreeEditorDrag !== "function" || typeof pollManagedProjectCommands !== "function") {
      if (cad.installAttempts < 80) setTimeout(installCadEditFlow, 50);
      return;
    }
    injectCadStyles();
    if (!installCadControls()) return;
    if (!installDragHook()) return;
    installManagedProjectAutoOpenHook();
    installUiSyncHooks();
    document.addEventListener("keydown", handleCadKeyboard, true);
    document.addEventListener("click", (event) => {
      if (event.target.closest("#viewButtons, #threeCanvas, #birdseyeControls")) requestAnimationFrame(syncCadUi);
    });
    cad.installed = true;
    syncCadUi();
    window.FrisFrameBirdseyeCad = {
      get axisMode() { return cad.axisMode; },
      get snapEnabled() { return cad.snapEnabled; },
      get stepMeters() { return cad.stepMeters; },
      get rotateStepDeg() { return cad.rotateStepDeg; },
      setAxisMode,
      setSnapEnabled(value) {
        cad.snapEnabled = Boolean(value);
        syncCadUi();
      },
      setStepMeters(value) {
        const next = Number(value);
        if (CAD_STEP_METERS.includes(next)) cad.stepMeters = next;
        syncCadUi();
      },
      nudgeSelectedMeters,
      rotateSelected,
      openLatestSetPlan() {
        openMasterPlanInBirdseye(masterPlanSignature());
      },
    };
  }

  window.addEventListener("load", installCadEditFlow, { once: true });
})();
