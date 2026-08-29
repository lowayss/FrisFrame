(() => {
  "use strict";

  if (document.documentElement.dataset.frisframePreviewCacheUx === "1") return;
  document.documentElement.dataset.frisframePreviewCacheUx = "1";

  const stats = {
    previewWorldRebuilds: 0,
    previewWorldReuses: 0,
    previewLabelSkips: 0,
  };

  let cachedWorldSignature = "";
  let cachedLabelSignature = "";

  function previewWorldSignature(renderState = state) {
    return JSON.stringify([
      renderState.aspect || "16:9",
      renderState.groups || [],
      renderState.items || [],
    ]);
  }

  function previewLabelSignature(profiles, multi, layout) {
    return JSON.stringify([
      Boolean(multi),
      layout.columns,
      layout.rows,
      profiles.map((profile) => [profile.id, profile.name, profile.color]),
    ]);
  }

  function previewWorldReady() {
    return Boolean(
      threeView?.ready
      && threeView.previewScene
      && threeView.previewWorld
      && threeView.previewWorld.children.length > 0
      && threeView.frameRenderer
      && threeView.frameCamera
      && threeView.frameCanvas,
    );
  }

  function sizePreviewRenderer(renderState, options = {}) {
    const aspectLabel = renderState.aspect || "16:9";
    if (options.width && options.height) {
      if (threeView.frameRenderer.getPixelRatio?.() !== 1) threeView.frameRenderer.setPixelRatio(1);
      const width = Math.max(1, Number(options.width));
      const height = Math.max(1, Number(options.height));
      if (threeView.frameCanvas.width !== Math.round(width) || threeView.frameCanvas.height !== Math.round(height)) {
        threeView.frameRenderer.setSize(width, height, false);
      }
      threeView.frameCamera.aspect = width / height;
      return;
    }
    if (!threeView.frameWrap) return;
    threeView.frameWrap.style.aspectRatio = aspectLabel.replace(":", " / ");
    const frameRect = threeView.frameWrap.getBoundingClientRect();
    const width = Math.max(1, frameRect.width);
    const height = Math.max(1, frameRect.height);
    if (threeView.frameRenderer.getPixelRatio?.() !== 1) threeView.frameRenderer.setPixelRatio(1);
    if (threeView.frameCanvas.width !== Math.round(width) || threeView.frameCanvas.height !== Math.round(height)) {
      threeView.frameRenderer.setSize(width, height, false);
    }
    threeView.frameCamera.aspect = width / height;
  }

  function fastRenderCameraPreview(renderState = state, options = {}) {
    if (!previewWorldReady()) return false;
    threeView.lastState = renderState;

    const multi = options.multiCamera === true
      || (options.multiCamera == null && cameraPreviewMode === "multi" && cameraProfileCount(renderState) > 1);
    const profiles = multi
      ? cameraPreviewProfiles(renderState)
      : [cameraPreviewProfile(renderState)].filter(Boolean);
    const visibleProfiles = profiles.filter(Boolean).slice(0, multi ? 4 : 1);
    if (!visibleProfiles.length) return false;

    threeView.frameCanvas.dataset.multiCamera = String(multi);
    sizePreviewRenderer(renderState, options);

    const canvasWidth = Math.max(1, threeView.frameCanvas.width);
    const canvasHeight = Math.max(1, threeView.frameCanvas.height);
    const layout = multi ? cameraPreviewGridLayout(visibleProfiles.length) : { columns: 1, rows: 1 };
    threeView.frameRenderer.setScissorTest(multi);
    if (multi) threeView.frameRenderer.clear(true, true, true);

    visibleProfiles.forEach((profile, index) => {
      const profileState = cameraPreviewDocument(renderState, profile.id);
      const camera = profileState.camera;
      const column = index % layout.columns;
      const row = Math.floor(index / layout.columns);
      const cellWidth = canvasWidth / layout.columns;
      const cellHeight = canvasHeight / layout.rows;
      const viewportX = column * cellWidth;
      const viewportY = canvasHeight - (row + 1) * cellHeight;
      const frameAspect = cellWidth / cellHeight;
      const horizontalFov = focalToFov(camera.focal, cameraSensorWidth(profileState));
      threeView.frameCamera.aspect = frameAspect;
      threeView.frameCamera.fov = horizontalFovToVerticalFov(horizontalFov, frameAspect);
      threeView.frameCamera.position.copy(mapToWorld(camera, profileState, resolvedCameraRenderHeight(camera)));
      threeView.frameCamera.lookAt(cameraLookTarget(camera, profileState, 10));
      threeView.frameCamera.updateProjectionMatrix();
      threeView.frameCamera.updateMatrixWorld(true);
      if (multi) {
        threeView.frameRenderer.setViewport(viewportX, viewportY, cellWidth, cellHeight);
        threeView.frameRenderer.setScissor(viewportX, viewportY, cellWidth, cellHeight);
      } else {
        threeView.frameRenderer.setViewport(0, 0, canvasWidth, canvasHeight);
      }
      threeView.frameRenderer.render(threeView.previewScene, threeView.frameCamera);
    });

    threeView.frameRenderer.setScissorTest(false);
    threeView.frameRenderer.setViewport(0, 0, canvasWidth, canvasHeight);

    const labelSignature = previewLabelSignature(visibleProfiles, multi, layout);
    if (labelSignature !== cachedLabelSignature) {
      renderCameraFrameLabels(visibleProfiles, multi, layout);
      cachedLabelSignature = labelSignature;
    } else {
      stats.previewLabelSkips += 1;
    }
    updateCameraFrameModeButton();
    stats.previewWorldReuses += 1;
    return true;
  }

  window.FrisFramePreviewCacheUxTest = {
    previewWorldSignature,
    previewWorldReady,
    stats,
  };

  if (typeof renderCameraFramePreview === "function") {
    const originalRenderCameraFramePreview = renderCameraFramePreview;
    renderCameraFramePreview = function cachedRenderCameraFramePreview(renderState = state, options = {}) {
      const signature = previewWorldSignature(renderState);
      if (cachedWorldSignature && signature === cachedWorldSignature && fastRenderCameraPreview(renderState, options)) {
        return;
      }
      const result = originalRenderCameraFramePreview(renderState, options);
      cachedWorldSignature = signature;
      cachedLabelSignature = "";
      stats.previewWorldRebuilds += 1;
      return result;
    };
  }
})();
