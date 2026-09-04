(() => {
  "use strict";

  if (document.documentElement.dataset.frisframeCameraTakeReplayUx === "1") return;
  document.documentElement.dataset.frisframeCameraTakeReplayUx = "1";

  const core = () => window.FrisFrameCameraTakePathCore;
  const browser = () => window.FrisFrameCameraTakeBrowser;
  const operator = () => window.FrisFrameCameraOperator;
  const cloneValue = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const angleDelta = (from, to) => {
    let delta = ((Number(to || 0) - Number(from || 0)) % 360 + 360) % 360;
    if (delta > 180) delta -= 360;
    return delta;
  };

  let preview = null;
  let previewFrame = 0;
  let panel = null;
  let statusNode = null;
  let previewButton = null;
  let stopButton = null;
  let applyButton = null;
  let lastFingerprint = "";

  function motionState() {
    state.motion = state.motion || {};
    return state.motion;
  }

  function takes() {
    const values = motionState().cameraOperatorTakes;
    return Array.isArray(values) ? values.filter((take) => take && typeof take === "object" && String(take.id || "")) : [];
  }

  function takeById(id) {
    const value = String(id || "");
    return takes().find((take) => String(take.id) === value) || null;
  }

  function effectiveTakeId() {
    const api = browser();
    if (api?.effectiveTakeId) return String(api.effectiveTakeId);
    const motion = motionState();
    const selected = String(motion.selectedCameraOperatorTakeId || "");
    if (selected && takeById(selected)) return selected;
    const latest = String(motion.latestCameraOperatorTakeId || "");
    if (latest && takeById(latest)) return latest;
    return String(takes().at(-1)?.id || "");
  }

  function takePath(take) {
    return core()?.normalizePath?.(take?.cameraPath) || null;
  }

  function endpointClose(left, right) {
    if (!left || !right) return false;
    return Math.abs(Number(left.x || 0) - Number(right.x || 0)) <= 0.012
      && Math.abs(Number(left.y || 0) - Number(right.y || 0)) <= 0.012
      && Math.abs(Number(left.height || 0) - Number(right.height || 0)) <= 0.06
      && Math.abs(angleDelta(left.panDeg, right.panDeg)) <= 2.5
      && Math.abs(Number(left.tiltDeg || 0) - Number(right.tiltDeg || 0)) <= 2.5
      && Math.abs(Number(left.focal || 35) - Number(right.focal || 35)) <= 1.5;
  }

  function maybeArchiveLatestTakePath() {
    const pathCore = core();
    if (!pathCore?.capturePath) return false;
    const motion = motionState();
    const latestId = String(motion.latestCameraOperatorTakeId || "");
    const take = latestId ? takeById(latestId) : null;
    if (!take || take.source !== "physical-camera" || takePath(take)) return false;
    const startTime = Number(take.startTime);
    const endTime = Number(take.endTime);
    if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime < startTime) return false;
    const path = pathCore.capturePath(motion.keyframes, startTime, endTime);
    if (!path || !path.keyframes?.length) return false;
    const first = path.keyframes[0]?.pose;
    const last = path.keyframes.at(-1)?.pose;
    if (!endpointClose(first, take.camera?.start) || !endpointClose(last, take.camera?.end)) return false;
    take.cameraPath = path;
    return true;
  }

  function installCommitArchiveHook() {
    if (typeof commit !== "function" || commit.__frisframeCameraTakeArchiveHook === true) return false;
    const originalCommit = commit;
    const wrappedCommit = function (...args) {
      maybeArchiveLatestTakePath();
      return originalCommit.apply(this, args);
    };
    Object.assign(wrappedCommit, originalCommit);
    wrappedCommit.__frisframeCameraTakeArchiveHook = true;
    commit = wrappedCommit;
    return true;
  }

  function applyPose(targetCamera, pose) {
    if (!targetCamera || !pose) return;
    for (const field of ["x", "y", "height", "panDeg", "tiltDeg", "focal", "trackingTargetId", "focusDistanceM", "aimX", "aimY", "focusHeight"]) {
      if (pose[field] != null) targetCamera[field] = cloneValue(pose[field]);
    }
  }

  function restoreCurrentRender() {
    let renderState = state;
    if (typeof interpolateStateAtTime === "function") {
      try { renderState = interpolateStateAtTime(Number(state.motion?.playhead || 0)); } catch { renderState = state; }
    }
    evaluatedViewState = renderState;
    if (typeof draw === "function") draw(renderState);
    if (typeof viewMode !== "undefined" && viewMode === "3d" && typeof renderThreeView === "function") renderThreeView(renderState, true);
  }

  function stopPreview({restore = true} = {}) {
    if (previewFrame && typeof cancelAnimationFrame === "function") cancelAnimationFrame(previewFrame);
    previewFrame = 0;
    preview = null;
    if (restore) restoreCurrentRender();
    lastFingerprint = "";
    renderPanel();
    return true;
  }

  function renderPreviewPose(take, time) {
    const path = takePath(take);
    if (!path) return false;
    const interpolate = window.FrisFrameCameraOperatorVectorSplineCore?.interpolatePose;
    const pose = core().samplePath(path, time, interpolate);
    if (!pose) return false;
    let renderState = state;
    if (typeof interpolateStateAtTime === "function") {
      try { renderState = interpolateStateAtTime(time); } catch { renderState = state; }
    }
    if (renderState === state) renderState = { ...state, camera:{ ...state.camera } };
    else renderState.camera = { ...renderState.camera };
    applyPose(renderState.camera, pose);
    evaluatedViewState = renderState;
    if (typeof draw === "function") draw(renderState);
    if (typeof viewMode !== "undefined" && viewMode === "3d" && typeof renderThreeView === "function") renderThreeView(renderState, true);
    if (typeof updatePlayheadDisplay === "function") updatePlayheadDisplay(time);
    return true;
  }

  function previewTake(id) {
    if (operator()?.mode && operator().mode !== "idle") return false;
    const take = takeById(id);
    const path = takePath(take);
    if (!take || !path || typeof requestAnimationFrame !== "function") return false;
    stopPreview({restore:false});
    preview = {takeId:String(take.id),startedAt:performance.now(),path};
    const step = (now) => {
      if (!preview || preview.takeId !== String(take.id)) return;
      const elapsed = Math.max(0, Number(now) - Number(preview.startedAt)) / 1000;
      const time = Math.min(path.endTime, path.startTime + elapsed);
      renderPreviewPose(take, time);
      if (time >= path.endTime - 0.0005) {
        previewFrame = 0;
        preview = null;
        setTimeout(() => stopPreview(), 220);
        return;
      }
      previewFrame = requestAnimationFrame(step);
    };
    previewFrame = requestAnimationFrame(step);
    lastFingerprint = "";
    renderPanel();
    return true;
  }

  function timelineMatchesTake(id) {
    const take = takeById(id);
    const path = takePath(take);
    if (!path || !core()?.capturePath) return false;
    const current = core().capturePath(motionState().keyframes, path.startTime, path.endTime);
    return Boolean(current && current.fingerprint === path.fingerprint);
  }

  function applyTakePath(id) {
    if (operator()?.mode && operator().mode !== "idle") return false;
    const take = takeById(id);
    const path = takePath(take);
    if (!take || !path || typeof captureSourceKeyframe !== "function") return false;
    stopPreview({restore:false});
    const motion = motionState();
    const previousKeys = cloneValue(motion.keyframes || []);
    const previousCamera = cloneValue(state.camera);
    const previousPlayhead = Number(motion.playhead || 0);
    try {
      motion.keyframes = core().removeCameraRange(motion.keyframes, path);
      const created = [];
      for (const frame of path.keyframes) {
        applyPose(state.camera, frame.pose);
        if (state.camera.trackingTargetId && typeof operator()?.maintainTracking === "function") {
          operator().maintainTracking(state, frame.time);
        } else if (typeof syncCameraDerivedAim === "function") {
          syncCameraDerivedAim(state.camera, state);
        }
        const keyframe = captureSourceKeyframe("camera", frame.time, undefined, "straight");
        if (!keyframe) throw new Error("camera_key_capture_failed");
        keyframe.transition = frame.transition || "linear";
        keyframe.operatorContinuity = frame.operatorContinuity !== false;
        motion.keyframes.push(keyframe);
        created.push(keyframe);
      }
      motion.keyframes = typeof sortKeyframes === "function" ? sortKeyframes(motion.keyframes) : motion.keyframes.sort((a,b) => Number(a.time)-Number(b.time));
      const finalFrame = path.keyframes.at(-1);
      applyPose(state.camera, finalFrame.pose);
      motion.playhead = path.endTime;
      if (created.length && typeof setTimelineSelection === "function") {
        const last = created.at(-1);
        setTimelineSelection([last.id], last.id);
      }
      if (typeof clearLiveSourceEdit === "function") clearLiveSourceEdit("camera", motion.playhead);
      if (typeof commit === "function") commit({preserveSourceIds:["camera"]});
      if (typeof notifyApp === "function") notifyApp(`Physical Camera Take 타임라인 적용 · ${path.keyframeCount}키 · ${path.duration.toFixed(2)}초`);
      restoreCurrentRender();
      lastFingerprint = "";
      renderPanel();
      return true;
    } catch (error) {
      motion.keyframes = previousKeys;
      state.camera = previousCamera;
      motion.playhead = previousPlayhead;
      restoreCurrentRender();
      if (typeof notifyApp === "function") notifyApp("Physical Camera Take 적용에 실패해 기존 타임라인을 유지했습니다.");
      return false;
    }
  }

  function shortId(value) {
    const id = String(value || "");
    return id.length > 18 ? `${id.slice(0,10)}…${id.slice(-5)}` : id;
  }

  function ensurePanel() {
    const takeBrowser = document.querySelector(".frisframe-camera-take-browser");
    if (!takeBrowser) return false;
    if (panel?.isConnected) return true;
    panel = document.createElement("div");
    panel.className = "frisframe-camera-take-replay";
    panel.dataset.frisframeCameraTakeReplay = "1";
    const head = document.createElement("div");
    head.className = "frisframe-camera-take-replay-head";
    head.innerHTML = "<b>▶ TAKE REPLAY</b>";
    statusNode = document.createElement("span");
    head.appendChild(statusNode);
    panel.appendChild(head);
    const note = document.createElement("div");
    note.className = "frisframe-camera-take-replay-note";
    note.textContent = "AI Take 선택과 실제 카메라 타임라인은 별개입니다. 미리보기는 비파괴이며 ‘타임라인 적용’에서만 카메라 키가 바뀝니다.";
    panel.appendChild(note);
    const actions = document.createElement("div");
    actions.className = "frisframe-camera-take-replay-actions";
    previewButton = document.createElement("button");
    previewButton.type = "button";
    previewButton.textContent = "선택 Take 미리보기";
    previewButton.addEventListener("click", () => previewTake(effectiveTakeId()));
    stopButton = document.createElement("button");
    stopButton.type = "button";
    stopButton.textContent = "정지";
    stopButton.addEventListener("click", () => stopPreview());
    applyButton = document.createElement("button");
    applyButton.type = "button";
    applyButton.textContent = "타임라인 적용";
    applyButton.addEventListener("click", () => applyTakePath(effectiveTakeId()));
    actions.append(previewButton, stopButton, applyButton);
    panel.appendChild(actions);
    takeBrowser.insertAdjacentElement("afterend", panel);
    return true;
  }

  function panelFingerprint() {
    const id = effectiveTakeId();
    const take = takeById(id);
    const path = takePath(take);
    return JSON.stringify({id,path:path?.fingerprint || "",mode:operator()?.mode || "idle",preview:preview?.takeId || "",match:path ? timelineMatchesTake(id) : false});
  }

  function renderPanel() {
    if (!ensurePanel() || !statusNode) return;
    const fingerprint = panelFingerprint();
    if (fingerprint === lastFingerprint) return;
    lastFingerprint = fingerprint;
    const id = effectiveTakeId();
    const take = takeById(id);
    const path = takePath(take);
    const locked = Boolean(operator()?.mode && operator().mode !== "idle");
    const matching = Boolean(path && timelineMatchesTake(id));
    if (!take) statusNode.textContent = "NO TAKE";
    else if (!path) statusNode.textContent = `${shortId(id)} · LEGACY / PATH 없음`;
    else statusNode.textContent = `${shortId(id)} · ${path.keyframeCount} KEY · ${path.duration.toFixed(2)}s · ${matching ? "TIMELINE MATCH" : "TIMELINE DIFF"}`;
    if (previewButton) previewButton.disabled = locked || !path || Boolean(preview);
    if (stopButton) stopButton.disabled = !preview;
    if (applyButton) applyButton.disabled = locked || !path || matching;
    panel.classList.toggle("is-match", matching);
    panel.classList.toggle("is-previewing", Boolean(preview));
  }

  const style = document.createElement("style");
  style.textContent = `
    .frisframe-camera-take-replay{display:grid;gap:6px;padding-top:7px;border-top:1px solid rgba(255,255,255,.07)}
    .frisframe-camera-take-replay-head,.frisframe-camera-take-replay-actions{display:flex;align-items:center;justify-content:space-between;gap:6px}.frisframe-camera-take-replay-head{font-size:9px;color:#d9e1e8}.frisframe-camera-take-replay-head span{font-size:7px;color:#ffca88}.frisframe-camera-take-replay.is-match .frisframe-camera-take-replay-head span{color:#9ce3af}.frisframe-camera-take-replay.is-previewing .frisframe-camera-take-replay-head span{color:#7ed9ff}
    .frisframe-camera-take-replay-note{font-size:7px;color:#7e8993;line-height:1.35}.frisframe-camera-take-replay-actions button{flex:1;min-height:24px;padding:0 5px;border:1px solid rgba(255,255,255,.1);border-radius:5px;background:rgba(255,255,255,.025);color:#9aa5af;font-size:7px;font-weight:850}.frisframe-camera-take-replay-actions button:last-child:not(:disabled){color:#a8e8ff;border-color:rgba(126,217,255,.35)}.frisframe-camera-take-replay-actions button:disabled{opacity:.4}
  `;
  document.head.appendChild(style);

  installCommitArchiveHook();
  setInterval(() => {
    if (!commit?.__frisframeCameraTakeArchiveHook) installCommitArchiveHook();
    renderPanel();
  }, 500);

  window.FrisFrameCameraTakeReplay = Object.freeze({
    get effectiveTakeId() { return effectiveTakeId() || null; },
    get previewingTakeId() { return preview?.takeId || null; },
    archiveLatest:maybeArchiveLatestTakePath,
    previewTake,
    stopPreview,
    applyTakePath,
    timelineMatchesTake,
  });
})();
