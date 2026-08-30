(() => {
  "use strict";

  function operatorClamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, Number(value) || 0));
  }

  function normalizeOperatorAngle(value) {
    const normalized = Number(value) % 360;
    return normalized < 0 ? normalized + 360 : normalized;
  }

  function shortestOperatorAngleDelta(from, to) {
    let delta = normalizeOperatorAngle(to) - normalizeOperatorAngle(from);
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    return delta;
  }

  function interpolateOperatorAngle(from, to, amount) {
    return normalizeOperatorAngle(Number(from) + shortestOperatorAngleDelta(from, to) * amount);
  }

  function smoothCameraOperatorSamples(samples, strength = 0.18) {
    if (!Array.isArray(samples) || samples.length < 3) return Array.isArray(samples) ? samples.map((sample) => ({ ...sample })) : [];
    const amount = operatorClamp(strength, 0, 0.45);
    if (amount <= 0) return samples.map((sample) => ({ ...sample }));

    let working = samples.map((sample) => ({ ...sample }));
    const passes = amount >= 0.3 ? 2 : 1;
    const weight = Math.min(0.32, amount * 0.72);

    for (let pass = 0; pass < passes; pass += 1) {
      const next = working.map((sample) => ({ ...sample }));
      const unwrappedPan = [Number(working[0].panDeg || 0)];
      for (let index = 1; index < working.length; index += 1) {
        unwrappedPan[index] = unwrappedPan[index - 1]
          + shortestOperatorAngleDelta(unwrappedPan[index - 1], working[index].panDeg || 0);
      }
      for (let index = 1; index < working.length - 1; index += 1) {
        for (const field of ["x", "y", "height", "tiltDeg"]) {
          const current = Number(working[index][field] || 0);
          const neighborAverage = (Number(working[index - 1][field] || 0) + Number(working[index + 1][field] || 0)) / 2;
          next[index][field] = current + (neighborAverage - current) * weight;
        }
        const currentPan = unwrappedPan[index];
        const neighborPan = (unwrappedPan[index - 1] + unwrappedPan[index + 1]) / 2;
        next[index].panDeg = normalizeOperatorAngle(currentPan + (neighborPan - currentPan) * weight);
      }
      next[0] = { ...working[0] };
      next[next.length - 1] = { ...working[working.length - 1] };
      working = next;
    }
    return working;
  }

  function cameraOperatorPoseError(sample, start, end, thresholds) {
    const span = Math.max(0.000001, Number(end.time) - Number(start.time));
    const amount = operatorClamp((Number(sample.time) - Number(start.time)) / span, 0, 1);
    const lerp = (field) => Number(start[field] || 0) + (Number(end[field] || 0) - Number(start[field] || 0)) * amount;
    const expectedPan = interpolateOperatorAngle(start.panDeg || 0, end.panDeg || 0, amount);
    return Math.max(
      Math.abs(Number(sample.x || 0) - lerp("x")) / thresholds.position,
      Math.abs(Number(sample.y || 0) - lerp("y")) / thresholds.position,
      Math.abs(Number(sample.height || 0) - lerp("height")) / thresholds.height,
      Math.abs(shortestOperatorAngleDelta(expectedPan, sample.panDeg || 0)) / thresholds.angle,
      Math.abs(Number(sample.tiltDeg || 0) - lerp("tiltDeg")) / thresholds.angle,
      Math.abs(Number(sample.focal || 0) - lerp("focal")) / thresholds.focal,
    );
  }

  function cameraOperatorEndpointMotion(start, end, thresholds) {
    return Math.max(
      Math.abs(Number(end.x || 0) - Number(start.x || 0)) / thresholds.position,
      Math.abs(Number(end.y || 0) - Number(start.y || 0)) / thresholds.position,
      Math.abs(Number(end.height || 0) - Number(start.height || 0)) / thresholds.height,
      Math.abs(shortestOperatorAngleDelta(start.panDeg || 0, end.panDeg || 0)) / thresholds.angle,
      Math.abs(Number(end.tiltDeg || 0) - Number(start.tiltDeg || 0)) / thresholds.angle,
      Math.abs(Number(end.focal || 0) - Number(start.focal || 0)) / thresholds.focal,
    );
  }

  function simplifyCameraOperatorSamples(samples, options = {}) {
    if (!Array.isArray(samples) || samples.length <= 2) return Array.isArray(samples) ? samples.map((sample) => ({ ...sample })) : [];
    const thresholds = {
      position: Math.max(0.00025, Number(options.positionTolerance || 0.0018)),
      height: Math.max(0.002, Number(options.heightTolerance || 0.018)),
      angle: Math.max(0.03, Number(options.angleTolerance || 0.18)),
      focal: Math.max(0.05, Number(options.focalTolerance || 0.25)),
    };
    const maxGap = Number.isFinite(Number(options.maxGap)) ? Math.max(0.05, Number(options.maxGap)) : 0.55;
    const keep = new Set([0, samples.length - 1]);

    function chooseMidpoint(startIndex, endIndex) {
      const midpoint = (Number(samples[startIndex].time) + Number(samples[endIndex].time)) / 2;
      let bestIndex = startIndex + 1;
      let bestDistance = Infinity;
      for (let index = startIndex + 1; index < endIndex; index += 1) {
        const distance = Math.abs(Number(samples[index].time) - midpoint);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = index;
        }
      }
      return bestIndex;
    }

    function reduce(startIndex, endIndex) {
      if (endIndex - startIndex <= 1) return;
      const start = samples[startIndex];
      const end = samples[endIndex];
      let bestIndex = -1;
      let bestError = 0;
      for (let index = startIndex + 1; index < endIndex; index += 1) {
        const error = cameraOperatorPoseError(samples[index], start, end, thresholds);
        if (error > bestError) {
          bestError = error;
          bestIndex = index;
        }
      }
      const duration = Number(end.time) - Number(start.time);
      const moving = cameraOperatorEndpointMotion(start, end, thresholds) > 0.8 || bestError > 0.45;
      if (bestError > 1 || (duration > maxGap && moving)) {
        const splitIndex = bestError > 1 && bestIndex > startIndex && bestIndex < endIndex
          ? bestIndex
          : chooseMidpoint(startIndex, endIndex);
        keep.add(splitIndex);
        reduce(startIndex, splitIndex);
        reduce(splitIndex, endIndex);
      }
    }

    reduce(0, samples.length - 1);
    return [...keep].sort((left, right) => left - right).map((index) => ({ ...samples[index] }));
  }

  function resampleCameraOperatorSamples(samples, step = 1 / 15) {
    if (!Array.isArray(samples) || samples.length <= 2) {
      return Array.isArray(samples) ? samples.map((sample) => ({ ...sample })) : [];
    }
    const ordered = samples
      .filter((sample) => Number.isFinite(Number(sample?.time)))
      .map((sample) => ({ ...sample, time: Number(sample.time) }))
      .sort((left, right) => left.time - right.time);
    if (ordered.length <= 2) return ordered.map((sample) => ({ ...sample }));

    const unique = [];
    ordered.forEach((sample) => {
      const previous = unique.at(-1);
      if (previous && sample.time <= previous.time + 0.000001) unique[unique.length - 1] = sample;
      else unique.push(sample);
    });
    if (unique.length <= 2) return unique.map((sample) => ({ ...sample }));

    const interval = Math.max(1 / 60, Number(step) || 1 / 15);
    const first = unique[0];
    const last = unique.at(-1);
    const output = [{ ...first }];
    let segmentIndex = 0;
    const numberOr = (value, fallback = 0) => {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : fallback;
    };

    const interpolateAt = (time) => {
      while (segmentIndex < unique.length - 2 && time > unique[segmentIndex + 1].time + 0.000001) {
        segmentIndex += 1;
      }
      const from = unique[segmentIndex];
      const to = unique[Math.min(unique.length - 1, segmentIndex + 1)];
      const span = Math.max(0.000001, to.time - from.time);
      const amount = operatorClamp((time - from.time) / span, 0, 1);
      const lerp = (field, fallback = 0) => {
        const start = numberOr(from[field], fallback);
        return start + (numberOr(to[field], start) - start) * amount;
      };
      return {
        time,
        x: lerp("x"),
        y: lerp("y"),
        height: lerp("height"),
        panDeg: normalizeOperatorAngle(
          numberOr(from.panDeg, 0) + shortestOperatorAngleDelta(from.panDeg, to.panDeg) * amount,
        ),
        tiltDeg: lerp("tiltDeg"),
        focal: lerp("focal"),
      };
    };

    for (let time = first.time + interval; time < last.time - 0.000001; time += interval) {
      output.push(interpolateAt(Number(time.toFixed(6))));
    }
    output.push({ ...last });
    return output;
  }

  const cameraOperatorCore = {
    shortestAngleDelta: shortestOperatorAngleDelta,
    smoothSamples: smoothCameraOperatorSamples,
    resampleSamples: resampleCameraOperatorSamples,
    simplifySamples: simplifyCameraOperatorSamples,
  };

  if (typeof module === "object" && module.exports) {
    module.exports = cameraOperatorCore;
    return;
  }

  if (document.documentElement.dataset.frisframeInteractionUx === "1") return;
  document.documentElement.dataset.frisframeInteractionUx = "1";
  window.FrisFrameCameraOperatorCore = cameraOperatorCore;

  const style = document.createElement("style");
  style.textContent = `
    /* Increase the usable target without making timeline markers visually larger. */
    .timeline-marker,
    .source-lane-marker {
      overflow: visible;
    }
    .timeline-marker::after,
    .source-lane-marker::after {
      content: "";
      position: absolute;
      inset: -6px -3px;
      border-radius: 10px;
    }

    /* Selection feedback is transient: useful after a canvas click, invisible during normal work. */
    .frisframe-selection-feedback {
      position: absolute;
      left: 12px;
      top: 12px;
      z-index: 48;
      max-width: min(280px, 45vw);
      padding: 5px 8px;
      border: 1px solid rgba(255,255,255,.11);
      border-radius: 7px;
      color: #cbd2da;
      background: rgba(12,16,20,.82);
      box-shadow: 0 5px 16px rgba(0,0,0,.18);
      font-size: 10px;
      font-weight: 800;
      line-height: 1.2;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      pointer-events: none;
      opacity: 0;
      transform: translateY(-3px);
      transition: opacity .11s ease, transform .11s ease;
      backdrop-filter: blur(8px);
    }
    .frisframe-selection-feedback.is-visible {
      opacity: .92;
      transform: translateY(0);
    }
    .frisframe-selection-feedback::before {
      content: "선택";
      margin-right: 6px;
      color: #737c86;
      font-size: 8px;
      font-weight: 900;
      letter-spacing: .04em;
    }

    /* Keep direct manipulation visually immediate instead of animating chrome while dragging. */
    html.frisframe-direct-manipulation .canvas-wrap,
    html.frisframe-direct-manipulation .timeline {
      user-select: none;
    }
    html.frisframe-direct-manipulation .three-jog-container,
    html.frisframe-direct-manipulation .workspace-panel-toggle,
    html.frisframe-direct-manipulation .frisframe-selection-feedback {
      transition: none !important;
    }
    html.frisframe-direct-manipulation .frisframe-selection-feedback {
      opacity: 0 !important;
    }

    /* Lists remain compact but the whole row is an easier selection target. */
    #actorList > *,
    #propList > *,
    #sourceTimelineList .source-lane-label {
      min-height: 30px;
    }

    .frisframe-camera-operator {
      display: grid;
      gap: 7px;
      margin: 8px 0 10px;
      padding: 8px;
      border: 1px solid rgba(255,255,255,.08);
      border-radius: 9px;
      background: rgba(255,255,255,.025);
    }
    .frisframe-camera-operator-head {
      display: flex;
      align-items: center;
      gap: 7px;
    }
    #cameraOperatorBtn {
      flex: 0 0 auto;
      min-height: 30px;
      padding: 0 10px;
      border-color: rgba(255,255,255,.12);
    }
    #cameraOperatorBtn.is-armed {
      border-color: rgba(255,184,70,.45);
      color: #ffd8a1;
      background: rgba(255,184,70,.08);
    }
    #cameraOperatorBtn.is-recording {
      border-color: rgba(255,89,89,.55);
      color: #ffd0d0;
      background: rgba(255,89,89,.12);
    }
    #cameraOperatorStatus {
      min-width: 0;
      color: #858e98;
      font-size: 9px;
      font-weight: 750;
      line-height: 1.25;
    }
    .frisframe-camera-operator-settings {
      display: grid;
      gap: 5px;
    }
    .frisframe-camera-operator-settings[hidden] { display: none !important; }
    .frisframe-camera-operator-cleanup {
      display: grid;
      grid-template-columns: auto minmax(70px, 1fr) 34px;
      align-items: center;
      gap: 6px;
      color: #9aa3ad;
      font-size: 9px;
    }
    #cameraOperatorCleanupValue {
      text-align: right;
      color: #cbd2da;
      font-variant-numeric: tabular-nums;
    }
    .frisframe-camera-operator-help {
      color: #747e88;
      font-size: 8px;
      line-height: 1.35;
    }
    #cameraFrame.frisframe-camera-operator-monitor {
      box-shadow: 0 0 0 1px rgba(255,184,70,.42), 0 10px 30px rgba(0,0,0,.28) !important;
    }
    #cameraFrame.frisframe-camera-operator-recording {
      box-shadow: 0 0 0 2px rgba(255,82,82,.74), 0 10px 30px rgba(0,0,0,.34) !important;
    }
    .frisframe-camera-operator-surface {
      position: absolute;
      inset: 0;
      z-index: 18;
      display: grid;
      place-items: center;
      border-radius: inherit;
      cursor: crosshair;
      touch-action: none;
      user-select: none;
      background: transparent;
    }
    .frisframe-camera-operator-surface[hidden] { display: none !important; }
    .frisframe-camera-operator-monitor-hud {
      position: absolute;
      left: 10px;
      top: 10px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 7px;
      border-radius: 6px;
      background: rgba(8,11,14,.72);
      color: #e3e7eb;
      font-size: 9px;
      font-weight: 850;
      letter-spacing: .02em;
      pointer-events: none;
    }
    .frisframe-camera-operator-monitor-hud::before {
      content: "";
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #ffb846;
    }
    .frisframe-camera-operator-surface.is-recording .frisframe-camera-operator-monitor-hud::before {
      background: #ff5252;
    }
    .frisframe-camera-operator-crosshair {
      width: 22px;
      height: 22px;
      border: 1px solid rgba(255,255,255,.18);
      border-radius: 50%;
      opacity: .55;
      pointer-events: none;
    }
    .frisframe-camera-operator-surface.is-recording .frisframe-camera-operator-crosshair {
      opacity: .28;
    }

    @media (prefers-reduced-motion: reduce) {
      .frisframe-selection-feedback { transition: none !important; }
    }
  `;
  document.head.append(style);

  const canvasWrap = document.querySelector(".canvas-wrap");
  const keySourceSelect = document.getElementById("keySourceSelect");
  const threeSelectionLabel = document.getElementById("threeSelectionLabel");
  const viewButtons = document.getElementById("viewButtons");

  let feedbackTimer = 0;
  let feedbackFrame = 0;
  let resizeFrame = 0;
  let resizeFollowupFrame = 0;
  let activePointerId = null;
  let selectionBeforePointer = "";

  const cleanSourceLabel = (value) => String(value || "")
    .replace(/\s*\((?:탑승 연동|잠김|고정)\)\s*$/, "")
    .replace(/^@/, "")
    .trim();

  const currentSelectionLabel = () => {
    const threeLabel = cleanSourceLabel(threeSelectionLabel?.textContent);
    if (threeLabel && threeLabel !== "선택 없음") return threeLabel;
    if (!keySourceSelect || keySourceSelect.value === "all") return "";
    return cleanSourceLabel(keySourceSelect.selectedOptions?.[0]?.textContent);
  };

  let feedback = null;
  const ensureFeedback = () => {
    if (!canvasWrap) return null;
    if (feedback?.isConnected) return feedback;
    feedback = document.createElement("div");
    feedback.className = "frisframe-selection-feedback";
    feedback.setAttribute("aria-hidden", "true");
    canvasWrap.append(feedback);
    return feedback;
  };

  const showSelectionFeedback = (force = false) => {
    const label = currentSelectionLabel();
    const element = ensureFeedback();
    if (!element || !label) return;
    if (!force && label === selectionBeforePointer) return;
    window.clearTimeout(feedbackTimer);
    element.textContent = label;
    element.classList.remove("is-visible");
    requestAnimationFrame(() => element.classList.add("is-visible"));
    feedbackTimer = window.setTimeout(() => element.classList.remove("is-visible"), 680);
  };

  const scheduleSelectionFeedback = (force = false) => {
    if (feedbackFrame) cancelAnimationFrame(feedbackFrame);
    feedbackFrame = requestAnimationFrame(() => {
      feedbackFrame = requestAnimationFrame(() => {
        feedbackFrame = 0;
        showSelectionFeedback(force);
      });
    });
  };

  const scheduleViewportResize = () => {
    if (resizeFrame) return;
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = 0;
      if (resizeFollowupFrame) cancelAnimationFrame(resizeFollowupFrame);
      resizeFollowupFrame = requestAnimationFrame(() => {
        resizeFollowupFrame = 0;
        window.dispatchEvent(new Event("resize"));
      });
    });
  };

  const selectionSurfaces = [
    "#stageViewport",
    "#threeWrap",
    "#actorList",
    "#propList",
    "#sourceTimelineList",
    "#timelineMarkers",
  ].join(",");

  document.addEventListener("pointerdown", (event) => {
    if (!event.target.closest?.(selectionSurfaces)) return;
    selectionBeforePointer = currentSelectionLabel();
  }, true);
  document.addEventListener("pointerup", (event) => {
    if (!event.target.closest?.(selectionSurfaces)) return;
    scheduleSelectionFeedback(false);
  }, true);

  keySourceSelect?.addEventListener("change", () => scheduleSelectionFeedback(true));
  if (threeSelectionLabel) {
    new MutationObserver(() => scheduleSelectionFeedback(true)).observe(threeSelectionLabel, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  }

  const directManipulationSelector = [
    "#stageViewport",
    "#threeWrap",
    ".timeline-marker",
    ".source-lane-track",
    ".three-jog-dial",
    "#cameraFrameMoveHandle",
    "#cameraFrameResizeHandle",
    ".frisframe-camera-operator-surface",
  ].join(",");

  const stopDirectManipulation = (event) => {
    if (activePointerId !== null && event?.pointerId != null && event.pointerId !== activePointerId) return;
    activePointerId = null;
    document.documentElement.classList.remove("frisframe-direct-manipulation");
  };

  document.addEventListener("pointerdown", (event) => {
    if (event.button != null && event.button !== 0) return;
    if (!event.target.closest?.(directManipulationSelector)) return;
    activePointerId = event.pointerId ?? "mouse";
    document.documentElement.classList.add("frisframe-direct-manipulation");
  }, true);
  document.addEventListener("pointerup", stopDirectManipulation, true);
  document.addEventListener("pointercancel", stopDirectManipulation, true);
  window.addEventListener("blur", () => stopDirectManipulation());

  /* A view/panel switch can change the available canvas rectangle after the app's own render.
     Coalesce that into one post-layout resize instead of causing several immediate redraws. */
  viewButtons?.addEventListener("click", () => {
    scheduleViewportResize();
    scheduleSelectionFeedback(true);
  }, true);

  document.addEventListener("click", (event) => {
    if (event.target.closest?.(".workspace-panel-toggle, .frisframe-panel-edge-toggle")) {
      scheduleViewportResize();
    }
  }, true);

  document.addEventListener("keydown", (event) => {
    if (event.defaultPrevented || event.key.toLowerCase() !== "v") return;
    const target = event.target;
    if (target?.matches?.("input, textarea, select, [contenteditable='true']") || target?.closest?.("dialog[open]")) return;
    scheduleViewportResize();
    scheduleSelectionFeedback(true);
  }, true);

  function installCameraOperator() {
    const cameraFrame = document.getElementById("cameraFrame");
    const cameraPanSlider = document.getElementById("cameraPanSlider");
    const panRow = cameraPanSlider?.closest("label.range-row");
    const cameraControls = panRow?.parentElement;
    if (!cameraFrame || !cameraControls || document.getElementById("cameraOperatorBtn")) return;

    const panel = document.createElement("div");
    panel.className = "frisframe-camera-operator";
    panel.innerHTML = `
      <div class="frisframe-camera-operator-head">
        <button id="cameraOperatorBtn" type="button" class="text-btn" title="첫 카메라 키에서 실제 촬영하듯 마우스로 카메라를 운전합니다.">● 직접 촬영</button>
        <span id="cameraOperatorStatus">첫 카메라 키를 찍고 시작</span>
      </div>
      <div id="cameraOperatorSettings" class="frisframe-camera-operator-settings" hidden>
        <label class="frisframe-camera-operator-cleanup">
          <span>잔떨림 제거</span>
          <input id="cameraOperatorCleanup" type="range" min="0" max="40" step="1" value="18" />
          <span id="cameraOperatorCleanupValue">18%</span>
        </label>
        <div class="frisframe-camera-operator-help">드래그 Pan/Tilt · Shift+드래그 Truck/Pedestal · 휠 Dolly · Alt/Option+휠 높이 · Ctrl/⌘ 미세 조작</div>
      </div>
    `;
    cameraControls.insertBefore(panel, panRow);

    const surface = document.createElement("div");
    surface.className = "frisframe-camera-operator-surface";
    surface.hidden = true;
    surface.innerHTML = `
      <span id="cameraOperatorMonitorHud" class="frisframe-camera-operator-monitor-hud">STBY</span>
      <span class="frisframe-camera-operator-crosshair" aria-hidden="true"></span>
    `;
    cameraFrame.append(surface);

    const button = panel.querySelector("#cameraOperatorBtn");
    const status = panel.querySelector("#cameraOperatorStatus");
    const settings = panel.querySelector("#cameraOperatorSettings");
    const cleanup = panel.querySelector("#cameraOperatorCleanup");
    const cleanupValue = panel.querySelector("#cameraOperatorCleanupValue");
    const monitorHud = surface.querySelector("#cameraOperatorMonitorHud");
    const operatorHelp = panel.querySelector(".frisframe-camera-operator-help");
    const cleanupStorageKey = "frisframe.cameraOperator.jitterRemoval";
    const savedCleanup = Number(localStorage.getItem(cleanupStorageKey));
    if (Number.isFinite(savedCleanup)) cleanup.value = String(operatorClamp(savedCleanup, 0, 40));
    cleanupValue.textContent = `${cleanup.value}%`;

    let mode = "idle";
    let pointerId = null;
    let lastClientX = 0;
    let lastClientY = 0;
    let recordStartedAt = 0;
    let animationFrame = 0;
    let samples = [];
    let startSnapshot = null;
    let startTime = 0;
    let dirty = false;
    let lastSampleTime = -Infinity;

    const currentCameraPose = () => ({
      x: Number(state.camera.x || 0),
      y: Number(state.camera.y || 0),
      height: Number(state.camera.height || 0),
      panDeg: normalizeOperatorAngle(state.camera.panDeg || 0),
      tiltDeg: Number(state.camera.tiltDeg || 0),
      focal: Number(state.camera.focal || 35),
    });

    const maintainCameraTracking = (targetState = state) => {
      if (targetState?.camera?.trackingTargetId && typeof applyCameraTracking === "function") {
        applyCameraTracking(targetState);
      } else if (typeof syncCameraDerivedAim === "function" && targetState?.camera) {
        syncCameraDerivedAim(targetState.camera, targetState);
      }
    };

    const applyCameraPose = (pose) => {
      state.camera.x = Number(pose.x);
      state.camera.y = Number(pose.y);
      state.camera.height = Number(pose.height);
      state.camera.panDeg = normalizeOperatorAngle(pose.panDeg);
      state.camera.tiltDeg = operatorClamp(pose.tiltDeg, -90, 90);
      state.camera.focal = Number(pose.focal || state.camera.focal || 35);
      maintainCameraTracking(state);
    };

    const operatorTime = () => Math.min(
      Number.isFinite(Number(MAX_TIMELINE_DURATION)) ? Number(MAX_TIMELINE_DURATION) : 60,
      startTime + Math.max(0, performance.now() - recordStartedAt) / 1000,
    );

    const sampleCurrentPose = (time) => {
      const pose = currentCameraPose();
      samples.push({ time: Number(time), ...pose });
      lastSampleTime = Number(time);
    };

    const updateOperatorUi = () => {
      button.classList.toggle("is-armed", mode === "armed");
      button.classList.toggle("is-recording", mode === "recording");
      settings.hidden = mode === "idle";
      surface.hidden = mode === "idle";
      surface.classList.toggle("is-recording", mode === "recording");
      cameraFrame.classList.toggle("frisframe-camera-operator-monitor", mode !== "idle");
      cameraFrame.classList.toggle("frisframe-camera-operator-recording", mode === "recording");
      if (operatorHelp) {
        operatorHelp.textContent = state.camera.trackingTargetId
          ? "트래킹 방향 유지 · 드래그 좌우 Truck · 상하 Dolly(거리) · Shift+드래그 Pedestal · 휠 Dolly · Alt/Option+휠 높이 · Ctrl/⌘ 미세 조작"
          : "드래그 Pan/Tilt · Shift+드래그 Truck/Pedestal · 휠 Dolly · Alt/Option+휠 높이 · Ctrl/⌘ 미세 조작";
      }
      if (mode === "idle") {
        button.textContent = "● 직접 촬영";
        status.textContent = "첫 카메라 키를 찍고 시작";
        monitorHud.textContent = "STBY";
      } else if (mode === "armed") {
        button.textContent = "■ STBY 취소";
        status.textContent = "카메라 프리뷰를 누르고 드래그하면 녹화 시작";
        monitorHud.textContent = "STBY · 화면을 눌러 시작";
      } else {
        const elapsed = Math.max(0, Number(state.motion.playhead || startTime) - startTime);
        button.textContent = "■ 촬영 종료";
        status.textContent = `REC ${elapsed.toFixed(2)}초 · 속도/텐션 기록 중`;
        monitorHud.textContent = `REC ${elapsed.toFixed(2)}s`;
      }
    };

    const renderOperatorFrame = () => {
      if (typeof draw === "function") draw();
      if (typeof viewMode !== "undefined" && viewMode === "3d" && typeof renderThreeView === "function") {
        renderThreeView(state, true);
      }
    };

    const restoreStartSnapshot = () => {
      if (!startSnapshot) return;
      state.camera = clone(startSnapshot.camera);
      state.motion.keyframes = clone(startSnapshot.keyframes);
      state.motion.duration = startSnapshot.duration;
      state.motion.playhead = startSnapshot.playhead;
      state.motion.activeSource = startSnapshot.activeSource;
      state.motion.selectedKeyId = startSnapshot.selectedKeyId;
      if (typeof setTimelineSelection === "function") {
        setTimelineSelection(startSnapshot.timelineSelection, startSnapshot.primaryKeyId || "", { updateAnchor: false });
      }
      if (typeof syncUi === "function") syncUi();
      if (typeof interpolateStateAtTime === "function") evaluatedViewState = interpolateStateAtTime(state.motion.playhead);
      renderOperatorFrame();
    };

    const resetOperatorRuntime = () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      pointerId = null;
      samples = [];
      startSnapshot = null;
      dirty = false;
      lastSampleTime = -Infinity;
      mode = "idle";
      document.documentElement.classList.remove("frisframe-camera-operator-active");
      updateOperatorUi();
    };

    const cancelOperator = (message = "카메라 직접 촬영을 취소했습니다.") => {
      if (mode === "idle") return;
      restoreStartSnapshot();
      resetOperatorRuntime();
      if (typeof notifyApp === "function") notifyApp(message);
    };

    const armOperator = () => {
      if (mode !== "idle") return;
      if (typeof state === "undefined" || !state?.camera || !state?.motion) return;
      if (["position", "orientation", "height"].some((field) => typeof cameraFieldLocked === "function" && cameraFieldLocked(field))) {
        notifyApp("Camera Operator를 쓰려면 카메라 위치·방향·높이 잠금을 해제하세요.");
        return;
      }
      if (typeof cancelPreview === "function") cancelPreview();
      const requestedTime = typeof readTimelineTimeInput === "function"
        ? readTimelineTimeInput(state.motion.playhead)
        : Number(state.motion.playhead || 0);
      const cameraKeys = typeof keysForSource === "function" ? keysForSource("camera") : [];
      const firstKey = cameraKeys.find((keyframe) => (
        typeof timelineTimesMatch === "function"
          ? timelineTimesMatch(keyframe.time, requestedTime)
          : Math.abs(Number(keyframe.time) - Number(requestedTime)) < 0.0005
      ));
      if (!firstKey) {
        notifyApp("먼저 촬영 시작 위치에 카메라 키프레임을 하나 찍어주세요.");
        return;
      }

      startSnapshot = {
        camera: clone(state.camera),
        keyframes: clone(state.motion.keyframes),
        duration: Number(state.motion.duration),
        playhead: Number(state.motion.playhead),
        activeSource: state.motion.activeSource,
        selectedKeyId: state.motion.selectedKeyId,
        timelineSelection: typeof selectedTimelineKeyframes === "function" ? selectedTimelineKeyframes().map((keyframe) => keyframe.id) : [firstKey.id],
        primaryKeyId: typeof primaryTimelineKeyId === "function" ? primaryTimelineKeyId() : firstKey.id,
      };
      startTime = Number(firstKey.time);
      if (typeof materializeEvaluatedViewForEditing === "function") materializeEvaluatedViewForEditing("camera");
      if (typeof setActiveSource === "function") setActiveSource("camera");
      if (typeof selectSourceOnStage === "function") selectSourceOnStage("camera");
      state.motion.playhead = startTime;
      if (state.camera.trackingTargetId && firstKey?.pose) {
        firstKey.pose = { ...firstKey.pose, trackingTargetId: state.camera.trackingTargetId };
        maintainCameraTracking(state);
      }
      mode = "armed";
      document.documentElement.classList.add("frisframe-camera-operator-active");
      updateOperatorUi();
      renderOperatorFrame();
      notifyApp("Camera Operator STBY · 카메라 프리뷰를 누르고 드래그하면 녹화가 시작됩니다.");
    };

    const beginRecording = (event) => {
      if (mode !== "armed" || event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      mode = "recording";
      pointerId = event.pointerId;
      lastClientX = event.clientX;
      lastClientY = event.clientY;
      recordStartedAt = performance.now();
      samples = [];
      lastSampleTime = -Infinity;
      state.motion.playhead = startTime;
      sampleCurrentPose(startTime);
      surface.setPointerCapture?.(pointerId);
      updateOperatorUi();

      const tick = () => {
        if (mode !== "recording") return;
        const time = operatorTime();
        if (typeof ensureDurationCovers === "function") ensureDurationCovers(time);
        state.motion.playhead = time;
        if (state.camera.trackingTargetId) maintainCameraTracking(state);
        if (time - lastSampleTime >= 1 / 30 || time >= (Number(MAX_TIMELINE_DURATION) || 60)) {
          sampleCurrentPose(time);
        }
        if (dirty) {
          dirty = false;
          renderOperatorFrame();
        } else if (typeof updatePlayheadDisplay === "function") {
          updatePlayheadDisplay(time);
        }
        updateOperatorUi();
        if (time >= (Number(MAX_TIMELINE_DURATION) || 60) - 0.0001) {
          finishOperatorTake();
          return;
        }
        animationFrame = requestAnimationFrame(tick);
      };
      animationFrame = requestAnimationFrame(tick);
    };

    const applyOperatorDrag = (event) => {
      if (mode !== "recording" || event.pointerId !== pointerId) return;
      event.preventDefault();
      event.stopPropagation();
      const dx = event.clientX - lastClientX;
      const dy = event.clientY - lastClientY;
      lastClientX = event.clientX;
      lastClientY = event.clientY;
      const precision = event.ctrlKey || event.metaKey ? 0.35 : 1;

      if (state.camera.trackingTargetId && !event.shiftKey) {
        const direction = typeof cameraDirection === "function" ? cameraDirection(state.camera) : { x: 1, z: 0 };
        const horizontal = Math.max(0.0001, Math.hypot(Number(direction.x || 0), Number(direction.z || 0)));
        const forwardX = Number(direction.x || 0) / horizontal;
        const forwardY = Number(direction.z || 0) / horizontal;
        const rightX = -forwardY;
        const rightY = forwardX;
        const size = typeof stageWorldSize === "function" ? stageWorldSize(state) : { width: 10, depth: 10 };
        const frameWidth = Math.max(240, cameraFrame.getBoundingClientRect().width || 480);
        const metersPerPixel = Math.max(0.001, Math.min(Number(size.width || 10), Number(size.depth || 10)) / frameWidth * 0.32) * precision;
        const truckMeters = dx * metersPerPixel;
        const dollyMeters = -dy * metersPerPixel * 1.4;
        state.camera.x = operatorClamp(
          Number(state.camera.x || 0) + (rightX * truckMeters + forwardX * dollyMeters) / Math.max(0.01, Number(size.width || 10)),
          Number.isFinite(Number(STAGE_COORD_MIN)) ? Number(STAGE_COORD_MIN) : -0.25,
          Number.isFinite(Number(STAGE_COORD_MAX)) ? Number(STAGE_COORD_MAX) : 1.25,
        );
        state.camera.y = operatorClamp(
          Number(state.camera.y || 0) + (rightY * truckMeters + forwardY * dollyMeters) / Math.max(0.01, Number(size.depth || 10)),
          Number.isFinite(Number(STAGE_COORD_MIN)) ? Number(STAGE_COORD_MIN) : -0.25,
          Number.isFinite(Number(STAGE_COORD_MAX)) ? Number(STAGE_COORD_MAX) : 1.25,
        );
      } else if (event.shiftKey) {
        const direction = typeof cameraDirection === "function" ? cameraDirection(state.camera) : { x: 1, z: 0 };
        const horizontal = Math.max(0.0001, Math.hypot(Number(direction.x || 0), Number(direction.z || 0)));
        const rightX = -Number(direction.z || 0) / horizontal;
        const rightY = Number(direction.x || 0) / horizontal;
        const size = typeof stageWorldSize === "function" ? stageWorldSize(state) : { width: 10, depth: 10 };
        const frameWidth = Math.max(240, cameraFrame.getBoundingClientRect().width || 480);
        const metersPerPixel = Math.max(0.001, Math.min(Number(size.width || 10), Number(size.depth || 10)) / frameWidth * 0.32) * precision;
        state.camera.x = operatorClamp(
          Number(state.camera.x || 0) + rightX * dx * metersPerPixel / Math.max(0.01, Number(size.width || 10)),
          Number.isFinite(Number(STAGE_COORD_MIN)) ? Number(STAGE_COORD_MIN) : -0.25,
          Number.isFinite(Number(STAGE_COORD_MAX)) ? Number(STAGE_COORD_MAX) : 1.25,
        );
        state.camera.y = operatorClamp(
          Number(state.camera.y || 0) + rightY * dx * metersPerPixel / Math.max(0.01, Number(size.depth || 10)),
          Number.isFinite(Number(STAGE_COORD_MIN)) ? Number(STAGE_COORD_MIN) : -0.25,
          Number.isFinite(Number(STAGE_COORD_MAX)) ? Number(STAGE_COORD_MAX) : 1.25,
        );
        state.camera.height = operatorClamp(Number(state.camera.height || 1.6) - dy * 0.0045 * precision, 0.4, 35);
      } else {
        state.camera.panDeg = normalizeOperatorAngle(Number(state.camera.panDeg || 0) + dx * 0.12 * precision);
        state.camera.tiltDeg = operatorClamp(Number(state.camera.tiltDeg || 0) - dy * 0.10 * precision, -89, 89);
      }
      maintainCameraTracking(state);
      dirty = true;
    };

    const applyOperatorWheel = (event) => {
      if (mode !== "recording") return;
      event.preventDefault();
      event.stopPropagation();
      const precision = event.ctrlKey || event.metaKey ? 0.35 : 1;
      if (event.altKey) {
        state.camera.height = operatorClamp(Number(state.camera.height || 1.6) - Number(event.deltaY || 0) * 0.004 * precision, 0.4, 35);
      } else {
        const direction = typeof cameraDirection === "function" ? cameraDirection(state.camera) : { x: 1, z: 0 };
        const horizontal = Math.max(0.0001, Math.hypot(Number(direction.x || 0), Number(direction.z || 0)));
        const size = typeof stageWorldSize === "function" ? stageWorldSize(state) : { width: 10, depth: 10 };
        const meters = -Number(event.deltaY || 0) * 0.0035 * precision;
        state.camera.x = operatorClamp(
          Number(state.camera.x || 0) + Number(direction.x || 0) / horizontal * meters / Math.max(0.01, Number(size.width || 10)),
          Number.isFinite(Number(STAGE_COORD_MIN)) ? Number(STAGE_COORD_MIN) : -0.25,
          Number.isFinite(Number(STAGE_COORD_MAX)) ? Number(STAGE_COORD_MAX) : 1.25,
        );
        state.camera.y = operatorClamp(
          Number(state.camera.y || 0) + Number(direction.z || 0) / horizontal * meters / Math.max(0.01, Number(size.depth || 10)),
          Number.isFinite(Number(STAGE_COORD_MIN)) ? Number(STAGE_COORD_MIN) : -0.25,
          Number.isFinite(Number(STAGE_COORD_MAX)) ? Number(STAGE_COORD_MAX) : 1.25,
        );
      }
      maintainCameraTracking(state);
      dirty = true;
    };

    const finishOperatorTake = () => {
      if (mode !== "recording") return;
      if (animationFrame) cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      const endTime = operatorTime();
      state.motion.playhead = endTime;
      if (endTime - lastSampleTime > 0.001) sampleCurrentPose(endTime);
      if (samples.length < 2 || endTime - startTime < 0.06) {
        cancelOperator("촬영 시간이 너무 짧아 Take를 만들지 않았습니다.");
        return;
      }

      const cleanupStrength = operatorClamp(Number(cleanup.value) / 100, 0, 0.4);
      const smoothed = cameraOperatorCore.smoothSamples(samples, cleanupStrength);
      const reduced = cameraOperatorCore.simplifySamples(smoothed, {
        positionTolerance: 0.00135 + cleanupStrength * 0.0025,
        heightTolerance: 0.014 + cleanupStrength * 0.026,
        angleTolerance: 0.13 + cleanupStrength * 0.24,
        focalTolerance: 0.25,
        maxGap: 0.48 + cleanupStrength * 0.35,
      });
      const rawCount = samples.length;
      const previousCameraKeyCount = state.motion.keyframes.filter((keyframe) => (
        keyframe.source === "camera" && Number(keyframe.time) > startTime + 0.0005 && Number(keyframe.time) <= endTime + 0.0005
      )).length;
      state.motion.keyframes = state.motion.keyframes.filter((keyframe) => !(
        keyframe.source === "camera" && Number(keyframe.time) > startTime + 0.0005 && Number(keyframe.time) <= endTime + 0.0005
      ));

      const addedKeys = [];
      for (const sample of reduced.slice(1)) {
        applyCameraPose(sample);
        const keyframe = typeof captureSourceKeyframe === "function"
          ? captureSourceKeyframe("camera", sample.time, undefined, "straight")
          : null;
        if (!keyframe) continue;
        keyframe.transition = "linear";
        state.motion.keyframes.push(keyframe);
        addedKeys.push(keyframe);
      }
      state.motion.keyframes = typeof sortKeyframes === "function" ? sortKeyframes(state.motion.keyframes) : state.motion.keyframes;
      const finalSample = reduced.at(-1) || smoothed.at(-1) || samples.at(-1);
      applyCameraPose(finalSample);
      state.motion.playhead = Number(finalSample.time);
      if (addedKeys.length && typeof setTimelineSelection === "function") {
        const lastKey = addedKeys.at(-1);
        setTimelineSelection([lastKey.id], lastKey.id);
      }
      if (typeof clearLiveSourceEdit === "function") clearLiveSourceEdit("camera", state.motion.playhead);
      if (typeof commit === "function") commit({ preserveSourceIds: ["camera"] });
      const duration = Number(finalSample.time) - startTime;
      resetOperatorRuntime();
      notifyApp(`Camera Operator Take 완료 · ${duration.toFixed(2)}초 · RAW ${rawCount} → 키 ${addedKeys.length + 1}${previousCameraKeyCount ? ` · 기존 키 ${previousCameraKeyCount}개 교체` : ""}`);
    };

    cleanup.addEventListener("input", () => {
      cleanupValue.textContent = `${cleanup.value}%`;
      localStorage.setItem(cleanupStorageKey, cleanup.value);
    });
    button.addEventListener("click", () => {
      if (mode === "idle") armOperator();
      else if (mode === "armed") cancelOperator();
      else finishOperatorTake();
    });
    surface.addEventListener("pointerdown", beginRecording);
    surface.addEventListener("pointermove", applyOperatorDrag);
    surface.addEventListener("pointerup", (event) => {
      if (mode !== "recording" || event.pointerId !== pointerId) return;
      event.preventDefault();
      event.stopPropagation();
      surface.releasePointerCapture?.(pointerId);
      finishOperatorTake();
    });
    surface.addEventListener("pointercancel", () => cancelOperator("포인터 입력이 끊겨 Camera Operator Take를 취소했습니다."));
    surface.addEventListener("wheel", applyOperatorWheel, { passive: false });
    window.addEventListener("blur", () => {
      if (mode !== "idle") cancelOperator("창 포커스가 바뀌어 Camera Operator Take를 취소했습니다.");
    });
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || mode === "idle") return;
      event.preventDefault();
      event.stopPropagation();
      cancelOperator();
    }, true);

    window.FrisFrameCameraOperator = {
      arm: armOperator,
      cancel: cancelOperator,
      finish: finishOperatorTake,
      get mode() { return mode; },
    };
    updateOperatorUi();
  }

  installCameraOperator();
})();
