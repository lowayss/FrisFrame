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
