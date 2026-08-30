(() => {
  "use strict";

  if (document.documentElement.dataset.frisframePerformanceUx === "1") return;
  document.documentElement.dataset.frisframePerformanceUx = "1";

  const stats = {
    fastSyncs: 0,
    fastTimelineUpdates: 0,
    fastPlayheadSyncs: 0,
    cachedObjectListSkips: 0,
    cachedSourceSelectSkips: 0,
    fastPoseSyncs: 0,
    coalescedPoseUi: 0,
    fastThreeNavigationRenders: 0,
    coalescedThreeRenders: 0,
    coalescedCameraPreviews: 0,
  };

  let transientWheelNavigation = false;

  function activeThreeNavigation() {
    const kind = typeof threeDrag !== "undefined" ? threeDrag?.kind : "";
    return ["orbit", "pan", "zoom"].includes(kind) || transientWheelNavigation;
  }

  function activeDirectEdit() {
    const stageDrag = typeof drag !== "undefined" && drag && !drag.pending;
    const threeEdit = typeof threeDrag !== "undefined" && threeDrag && !threeDrag.pending;
    const curveEdit = typeof curveHandleDrag !== "undefined" && Boolean(curveHandleDrag);
    const badgeEdit = typeof keyBadgeDrag !== "undefined" && Boolean(keyBadgeDrag);
    return Boolean(stageDrag || threeEdit || curveEdit || badgeEdit);
  }

  function activeTimelineDrag() {
    return typeof timelineDrag !== "undefined" && Boolean(timelineDrag);
  }

  function activePoseDrag() {
    return typeof threeDrag !== "undefined" && threeDrag && threeDrag.kind === "pose";
  }

  window.FrisFramePerformanceUxTest = {
    activeDirectEdit,
    activeTimelineDrag,
    activePoseDrag,
    activeThreeNavigation,
    stats,
  };

  function visibleTimelineKeys() {
    const visibleIds = new Set(visibleSourceDefinitions().map((source) => source.id));
    return sortKeyframes(state.motion.keyframes).filter((keyframe) => visibleIds.has(keyframe.source));
  }

  function timelineRenderSignature() {
    const visibleSources = visibleSourceDefinitions();
    const sourceSignature = visibleSources.map((source) => [
      source.id,
      source.name,
      source.color,
      typeof sourceEditLocked === "function" ? sourceEditLocked(source.id) : false,
    ]);
    const keySignature = visibleTimelineKeys().map((keyframe) => [
      keyframe.id,
      keyframe.source,
      Number(keyframe.time || 0).toFixed(4),
      keyframe.label || "",
      keyframe.transition || "",
      keyframe.note || "",
      keyframe.segment?.mode || keyframe.segment?.plan?.mode || "",
      JSON.stringify(keyframe.pose || {}),
    ]);
    return JSON.stringify([
      state.motion.timelineView,
      Number(state.motion.duration || 0).toFixed(4),
      state.motion.fps,
      state.motion.activeSource,
      [...timelineSelectedKeyIds].sort(),
      primaryTimelineKeyId(),
      sourceSignature,
      keySignature,
    ]);
  }

  function objectListSignature() {
    return JSON.stringify([
      selected?.kind || "",
      selected?.id || "",
      state.motion?.activeSource || "",
      normalizeHiddenSources(state.motion?.hiddenSources || []),
      state.items.map((item) => [
        item.id,
        item.type,
        item.name,
        item.color,
        item.visible !== false,
        item.motionEnabled !== false,
        item.editLocked === true,
        item.groupId || "",
        item.mountId || "",
        item.placementMode || "",
        item.assetType || "",
        item.dummyType || "",
      ]),
    ]);
  }

  function sourceSelectSignature() {
    return JSON.stringify([
      state.motion?.activeSource || "all",
      normalizeHiddenSources(state.motion?.hiddenSources || []),
      sourceDefinitions().map((source) => {
        const item = state.items.find((entry) => entry.id === source.id);
        return [
          source.id,
          source.name,
          item?.type || source.type || "",
          item?.mountId || "",
          item?.motionEnabled !== false,
          typeof sourceEditLocked === "function" ? sourceEditLocked(source.id) : false,
        ];
      }),
    ]);
  }

  function tagCombinedMarkers(keyframes) {
    const root = document.getElementById("timelineMarkers");
    if (!root) return false;
    const markers = [...root.querySelectorAll(":scope > .timeline-marker")];
    if (markers.length !== keyframes.length) return false;
    markers.forEach((marker, index) => {
      marker.dataset.keyId = keyframes[index].id;
    });
    return true;
  }

  function tagSplitMarkers(keyframes) {
    const root = document.getElementById("sourceTimelineList");
    if (!root) return false;
    const sources = visibleSourceDefinitions();
    const lanes = [...root.querySelectorAll(":scope > .source-lane")];
    if (lanes.length !== sources.length) return false;
    for (let index = 0; index < lanes.length; index += 1) {
      const lane = lanes[index];
      const source = sources[index];
      const sourceKeys = keyframes.filter((keyframe) => keyframe.source === source.id);
      const markers = [...lane.querySelectorAll(".source-lane-marker")];
      if (markers.length !== sourceKeys.length) return false;
      lane.dataset.sourceId = source.id;
      markers.forEach((marker, markerIndex) => {
        marker.dataset.keyId = sourceKeys[markerIndex].id;
      });
    }
    return true;
  }

  function updateMarker(marker, keyframe) {
    marker.style.left = `${clamp((keyframe.time / state.motion.duration) * 100, 0, 100)}%`;
    marker.dataset.time = `${keyframe.time.toFixed(2)}초`;
    marker.classList.toggle("is-active", keyframe.id === primaryTimelineKeyId());
    marker.classList.toggle("is-selected", timelineSelectedKeyIds.has(keyframe.id));
    marker.classList.toggle("is-dragging", timelineDrag?.id === keyframe.id);
  }

  function updateCutDividers(root, selector, cutTimes) {
    const dividers = [...root.querySelectorAll(selector)];
    if (dividers.length !== cutTimes.length) return false;
    dividers.forEach((divider, index) => {
      divider.style.left = `${clamp((cutTimes[index] / state.motion.duration) * 100, 0, 100)}%`;
    });
    return true;
  }

  function fastTimelineDragStatus() {
    if (!activeTimelineDrag()) return false;
    const keyframes = visibleTimelineKeys();
    const byId = new Map(keyframes.map((keyframe) => [keyframe.id, keyframe]));
    const combinedRoot = document.getElementById("timelineMarkers");
    if (!combinedRoot) return false;

    let combinedMarkers = [...combinedRoot.querySelectorAll(":scope > .timeline-marker")];
    if (combinedMarkers.length !== keyframes.length) return false;
    if (combinedMarkers.some((marker) => !marker.dataset.keyId)) {
      if (!tagCombinedMarkers(keyframes)) return false;
      combinedMarkers = [...combinedRoot.querySelectorAll(":scope > .timeline-marker")];
    }
    if (combinedMarkers.some((marker) => !byId.has(marker.dataset.keyId))) return false;
    combinedMarkers.forEach((marker) => updateMarker(marker, byId.get(marker.dataset.keyId)));

    const cutTimes = shotCutTimes(keyframes);
    if (!updateCutDividers(combinedRoot, ":scope > .timeline-cut-divider", cutTimes)) return false;

    if (state.motion.timelineView === "split") {
      const splitRoot = document.getElementById("sourceTimelineList");
      if (!splitRoot) return false;
      let lanes = [...splitRoot.querySelectorAll(":scope > .source-lane")];
      if (lanes.some((lane) => !lane.dataset.sourceId)) {
        if (!tagSplitMarkers(keyframes)) return false;
        lanes = [...splitRoot.querySelectorAll(":scope > .source-lane")];
      }
      for (const lane of lanes) {
        const sourceId = lane.dataset.sourceId;
        const sourceKeys = keyframes.filter((keyframe) => keyframe.source === sourceId);
        const markers = [...lane.querySelectorAll(".source-lane-marker")];
        if (markers.length !== sourceKeys.length) return false;
        const sourceMap = new Map(sourceKeys.map((keyframe) => [keyframe.id, keyframe]));
        if (markers.some((marker) => !sourceMap.has(marker.dataset.keyId))) return false;
        markers.forEach((marker) => updateMarker(marker, sourceMap.get(marker.dataset.keyId)));
        if (!updateCutDividers(lane, ".source-cut-divider", cutTimes)) return false;
      }
    }

    const time = displayPlayhead();
    updatePlayheadDisplay(time);
    const timeInput = document.getElementById("keyTimeInput");
    if (timeInput && document.activeElement !== timeInput) timeInput.value = formatTimelineTime(time);
    const hint = document.getElementById("timelineHint");
    if (hint) {
      hint.textContent = state.motion.timelineView === "split"
        ? `대상별 ${visibleSourceDefinitions().length}개 트랙 · 키 ${keyframes.length}개 · ${state.motion.duration}초`
        : `통합 트랙 · 키 ${keyframes.length}개 · 즉시 전환 ${cutTimes.length}개 · ${state.motion.duration}초`;
    }
    if (typeof renderTimelineSelectionTools === "function") {
      renderTimelineSelectionTools(selectedTimelineKeyframes(), false);
    }
    const status = document.getElementById("keyStatus");
    if (status) status.textContent = `키 ${keyframes.length}개 · 시간 조정 ${Number(time || 0).toFixed(2)}초`;
    stats.fastTimelineUpdates += 1;
    return true;
  }

  let cachedTimelineSignature = "";

  if (typeof renderKeyStatus === "function") {
    const originalRenderKeyStatus = renderKeyStatus;
    renderKeyStatus = function optimizedRenderKeyStatus(updateInputs = true) {
      if (activeTimelineDrag() && fastTimelineDragStatus()) return;
      if (activeDirectEdit()) {
        updatePlayheadDisplay(displayPlayhead());
        return;
      }
      const signature = timelineRenderSignature();
      if (!updateInputs && cachedTimelineSignature && signature === cachedTimelineSignature) {
        updatePlayheadDisplay(displayPlayhead());
        stats.fastPlayheadSyncs += 1;
        return;
      }
      const result = originalRenderKeyStatus(updateInputs);
      cachedTimelineSignature = signature;
      const keyframes = visibleTimelineKeys();
      tagCombinedMarkers(keyframes);
      if (state.motion.timelineView === "split") tagSplitMarkers(keyframes);
      return result;
    };
    requestAnimationFrame(() => {
      cachedTimelineSignature = timelineRenderSignature();
      const keyframes = visibleTimelineKeys();
      tagCombinedMarkers(keyframes);
      if (state.motion.timelineView === "split") tagSplitMarkers(keyframes);
    });
  }

  if (typeof renderSourceTimelines === "function") {
    const originalRenderSourceTimelines = renderSourceTimelines;
    renderSourceTimelines = function optimizedRenderSourceTimelines(keyframes, cutTimes) {
      const root = document.getElementById("sourceTimelineList");
      if (root?.hidden) return;
      return originalRenderSourceTimelines(keyframes, cutTimes);
    };
  }

  if (typeof renderObjectLists === "function") {
    const originalRenderObjectLists = renderObjectLists;
    let lastObjectListSignature = "";
    renderObjectLists = function optimizedRenderObjectLists() {
      const signature = objectListSignature();
      if (lastObjectListSignature && signature === lastObjectListSignature) {
        stats.cachedObjectListSkips += 1;
        return;
      }
      lastObjectListSignature = signature;
      return originalRenderObjectLists();
    };
  }

  if (typeof renderSourceSelect === "function") {
    const originalRenderSourceSelect = renderSourceSelect;
    let lastSourceSelectSignature = "";
    renderSourceSelect = function optimizedRenderSourceSelect() {
      const signature = sourceSelectSignature();
      if (lastSourceSelectSignature && signature === lastSourceSelectSignature) {
        stats.cachedSourceSelectSkips += 1;
        const select = document.getElementById("keySourceSelect");
        if (select && select.value !== activeSourceId()) select.value = activeSourceId();
        return;
      }
      lastSourceSelectSignature = signature;
      return originalRenderSourceSelect();
    };
  }

  let poseUiFrame = 0;
  let poseUiNeedsInputRefresh = false;
  let poseSessionActive = false;

  function currentPoseActor() {
    if (typeof selectedPoseActor === "function") {
      const actor = selectedPoseActor();
      if (actor?.type === "actor") return actor;
    }
    const actorId = typeof selectedPoseActorId !== "undefined" ? selectedPoseActorId : selected?.id;
    return state.items.find((item) => item.id === actorId && item.type === "actor") || null;
  }

  function flushFastPoseControls(updateInputs = false) {
    const actor = currentPoseActor();
    if (!actor || typeof selectedPoseJoint === "undefined" || typeof JOINT_DEFINITIONS === "undefined") return false;
    const definition = JOINT_DEFINITIONS[selectedPoseJoint];
    const rotation = actor.bodyPose?.[selectedPoseJoint];
    if (!definition || !rotation) return false;
    const locked = typeof sourceEditLocked === "function" ? sourceEditLocked(actor.id) : false;
    const jointSelect = document.getElementById("actorPoseJointSelect");
    if (jointSelect) {
      if (updateInputs || document.activeElement !== jointSelect) jointSelect.value = selectedPoseJoint;
      jointSelect.disabled = locked;
    }
    ["X", "Y", "Z"].forEach((axisName) => {
      const axis = axisName.toLowerCase();
      const slider = document.getElementById(`actorPoseAxis${axisName}`);
      const value = document.getElementById(`actorPoseAxis${axisName}Value`);
      if (!slider || !value || !definition[axis]) return;
      const [minimum, maximum] = definition[axis];
      if (Number(slider.min) !== Number(minimum)) slider.min = minimum;
      if (Number(slider.max) !== Number(maximum)) slider.max = maximum;
      if (Number(value.min) !== Number(minimum)) value.min = minimum;
      if (Number(value.max) !== Number(maximum)) value.max = maximum;
      if (updateInputs || document.activeElement !== slider) slider.value = rotation[axis];
      if (updateInputs || document.activeElement !== value) value.value = Math.round(rotation[axis]);
      slider.disabled = locked;
      value.disabled = locked;
    });
    stats.fastPoseSyncs += 1;
    return true;
  }

  function scheduleFastPoseControls(updateInputs = false) {
    if (!activePoseDrag() || !currentPoseActor()) return false;
    poseSessionActive = true;
    poseUiNeedsInputRefresh = poseUiNeedsInputRefresh || updateInputs;
    if (poseUiFrame) {
      stats.coalescedPoseUi += 1;
      return true;
    }
    poseUiFrame = requestAnimationFrame(() => {
      poseUiFrame = 0;
      const refreshInputs = poseUiNeedsInputRefresh;
      poseUiNeedsInputRefresh = false;
      flushFastPoseControls(refreshInputs);
    });
    return true;
  }

  if (typeof renderProperties === "function") {
    const originalRenderProperties = renderProperties;
    renderProperties = function optimizedRenderProperties(updateInputs = true) {
      if (activePoseDrag() && scheduleFastPoseControls(updateInputs)) return;
      return originalRenderProperties(updateInputs);
    };

    const finishPoseSession = () => {
      if (!poseSessionActive) return;
      poseSessionActive = false;
      requestAnimationFrame(() => {
        if (!activePoseDrag()) renderProperties(true);
      });
    };
    document.addEventListener("pointerup", finishPoseSession, true);
    document.addEventListener("pointercancel", finishPoseSession, true);
    document.addEventListener("frisframe:drag-cancelled", finishPoseSession);
    window.addEventListener("blur", finishPoseSession);
  }

  if (typeof syncUi === "function") {
    const originalSyncUi = syncUi;
    syncUi = function optimizedSyncUi(updateInputs = true) {
      if (!activeDirectEdit() && !activeTimelineDrag()) return originalSyncUi(updateInputs);

      const originals = {
        renderCameraRigControls,
        renderCameraLockControls,
        renderExportRangeControls,
        renderSpatialGuideControls,
        renderObjectLists,
        renderTrackingTargetSelect,
        renderProperties,
        renderSourceSelect,
        renderThreeEditControls,
        syncProjectChrome,
      };
      const noop = () => {};
      renderCameraRigControls = noop;
      renderCameraLockControls = noop;
      renderExportRangeControls = noop;
      renderSpatialGuideControls = noop;
      renderObjectLists = noop;
      renderTrackingTargetSelect = noop;
      renderSourceSelect = noop;
      renderThreeEditControls = noop;
      syncProjectChrome = noop;
      if (!activePoseDrag()) renderProperties = noop;
      stats.fastSyncs += 1;
      try {
        return originalSyncUi(false);
      } finally {
        renderCameraRigControls = originals.renderCameraRigControls;
        renderCameraLockControls = originals.renderCameraLockControls;
        renderExportRangeControls = originals.renderExportRangeControls;
        renderSpatialGuideControls = originals.renderSpatialGuideControls;
        renderObjectLists = originals.renderObjectLists;
        renderTrackingTargetSelect = originals.renderTrackingTargetSelect;
        renderProperties = originals.renderProperties;
        renderSourceSelect = originals.renderSourceSelect;
        renderThreeEditControls = originals.renderThreeEditControls;
        syncProjectChrome = originals.syncProjectChrome;
      }
    };
  }

  document.addEventListener("wheel", (event) => {
    if (event.target?.closest?.("#threeCanvas")) {
      transientWheelNavigation = true;
      setTimeout(() => { transientWheelNavigation = false; }, 0);
    }
  }, true);

  if (typeof renderThreeView === "function") {
    const originalRenderThreeView = renderThreeView;
    renderThreeView = function optimizedNavigationRender(renderState = state, force = false, frameOptions = {}) {
      if (activeThreeNavigation() && threeView?.ready && (viewMode === "3d" || force)) {
        threeView.lastState = renderState;
        updateThreeCamera(renderState);
        threeView.renderer.render(threeView.scene, threeView.camera);
        if (typeof drawAnnotations === "function") drawAnnotations();
        stats.fastThreeNavigationRenders += 1;
        return;
      }
      return originalRenderThreeView(renderState, force, frameOptions);
    };
  }

  function coalesceDirectRenderer(name, counterKey) {
    if (typeof window[name] !== "function") return;
    const original = window[name];
    let frame = 0;
    let pendingArgs = null;
    window[name] = function optimizedRenderer(...args) {
      if (!activeDirectEdit() && !activeTimelineDrag()) {
        if (frame) cancelAnimationFrame(frame);
        frame = 0;
        pendingArgs = null;
        return original(...args);
      }
      pendingArgs = args;
      if (frame) {
        stats[counterKey] += 1;
        return;
      }
      frame = requestAnimationFrame(() => {
        frame = 0;
        const argsToRender = pendingArgs;
        pendingArgs = null;
        original(...(argsToRender || []));
      });
    };
  }

  coalesceDirectRenderer("renderThreeView", "coalescedThreeRenders");
  coalesceDirectRenderer("renderCameraFramePreview", "coalescedCameraPreviews");
})();
