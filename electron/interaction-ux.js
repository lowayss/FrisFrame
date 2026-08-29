(() => {
  "use strict";

  if (document.documentElement.dataset.frisframeInteractionUx === "1") return;
  document.documentElement.dataset.frisframeInteractionUx = "1";

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
})();
