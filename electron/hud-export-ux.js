(() => {
  "use strict";

  if (document.documentElement.dataset.frisframeHudExportUx === "1") return;
  document.documentElement.dataset.frisframeHudExportUx = "1";

  const safeStorage = {
    get(key) {
      try { return window.localStorage.getItem(key); } catch { return null; }
    },
    set(key, value) {
      try { window.localStorage.setItem(key, value); } catch { /* UI preference only. */ }
    },
  };

  const style = document.createElement("style");
  style.textContent = `
    /* 3D HUD: keep edit mode visible, hide instructions until requested. */
    .three-hud.frisframe-hud-polished {
      gap: 6px;
    }
    .three-hud.frisframe-hud-polished .three-hud-controls {
      gap: 6px;
    }
    .three-hud.frisframe-hud-polished .three-editbar {
      min-height: 30px;
    }
    .frisframe-3d-help {
      position: relative;
      margin: 0;
      border: 0;
    }
    .frisframe-3d-help > summary {
      min-height: 29px;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 0 8px;
      border: 1px solid rgba(255,255,255,.09);
      border-radius: 7px;
      color: #a8b0b9;
      background: rgba(12,16,20,.64);
      cursor: pointer;
      list-style: none;
      font-size: 10px;
      font-weight: 800;
      user-select: none;
      backdrop-filter: blur(8px);
    }
    .frisframe-3d-help > summary::-webkit-details-marker { display: none; }
    .frisframe-3d-help > summary::before {
      content: "?";
      display: inline-grid;
      place-items: center;
      width: 16px;
      height: 16px;
      border: 1px solid rgba(255,255,255,.14);
      border-radius: 999px;
      color: #858e98;
      font-size: 9px;
    }
    .frisframe-3d-help[open] > summary {
      color: #d7dde5;
      border-color: rgba(255,255,255,.18);
      background: rgba(28,34,40,.94);
    }
    .frisframe-3d-help .three-shortcuts {
      position: absolute;
      right: 0;
      top: calc(100% + 6px);
      z-index: 42;
      min-width: 310px;
      max-width: min(520px, 58vw);
      display: flex !important;
      flex-wrap: wrap;
      gap: 5px 9px;
      padding: 9px 10px;
      border: 1px solid rgba(255,255,255,.11);
      border-radius: 8px;
      background: rgba(16,20,24,.96);
      box-shadow: 0 10px 28px rgba(0,0,0,.28);
      backdrop-filter: blur(10px);
    }
    .frisframe-3d-help:not([open]) .three-shortcuts {
      display: none !important;
    }
    .frisframe-3d-help .three-shortcuts span {
      white-space: nowrap;
      font-size: 9px;
    }
    .three-wrap .three-jog-container {
      transition: opacity .14s ease, transform .14s ease;
    }
    .three-wrap:not(:hover) .three-jog-container {
      opacity: .28;
    }
    .three-wrap:hover .three-jog-container,
    .three-jog-container:focus-within {
      opacity: 1;
    }

    /* Export: range is MP4 detail, not the first thing users should manage. */
    #exportMenu .frisframe-export-range-details {
      margin: 1px 0 4px;
      border: 0;
    }
    #exportMenu .frisframe-export-range-details > summary {
      min-height: 30px;
      display: flex;
      align-items: center;
      gap: 7px;
      padding: 0 9px;
      border: 1px solid rgba(255,255,255,.08);
      border-radius: 7px;
      color: #aeb5be;
      background: rgba(255,255,255,.025);
      cursor: pointer;
      list-style: none;
      font-size: 10px;
      font-weight: 800;
      user-select: none;
    }
    #exportMenu .frisframe-export-range-details > summary::-webkit-details-marker { display: none; }
    #exportMenu .frisframe-export-range-details > summary::before {
      content: "›";
      font-size: 15px;
      line-height: 1;
      transition: transform .12s ease;
    }
    #exportMenu .frisframe-export-range-details[open] > summary::before {
      transform: rotate(90deg);
    }
    #exportMenu .frisframe-export-range-details > summary small {
      margin-left: auto;
      color: #727a84;
      font-size: 9px;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }
    #exportMenu .frisframe-export-range-details #exportRangeTools {
      margin-top: 6px;
      padding: 8px !important;
      border-radius: 7px;
      background: rgba(0,0,0,.08);
    }
    #exportMenu .toolbar-menu-popover > #frameBtn,
    #exportMenu .toolbar-menu-popover > #framePairBtn,
    #exportMenu .toolbar-menu-popover > #videoBtn {
      min-height: 34px;
    }
    #exportMenu .toolbar-menu-popover > #videoBtn {
      margin-top: 2px;
    }
    .frisframe-export-workflow-note {
      margin: 3px 2px 1px;
      color: #727983;
      font-size: 9px;
      line-height: 1.4;
    }

    /* Repeated editing loop: fewer pointer trips around the timeline. */
    .frisframe-key-nav {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      margin-left: 2px;
      padding-left: 5px;
      border-left: 1px solid rgba(255,255,255,.07);
    }
    .frisframe-key-nav button {
      min-width: 30px !important;
      height: 28px;
      min-height: 28px !important;
      padding: 0 7px !important;
      color: #aeb5be;
      font-size: 10px !important;
      font-weight: 800;
    }
    .frisframe-key-nav kbd {
      margin-left: 4px;
      color: #6f7780;
      font-size: 8px;
      font-weight: 700;
    }
    .frisframe-time-stepper {
      display: grid;
      grid-template-columns: 26px minmax(0, 1fr) 26px;
      gap: 3px;
      align-items: center;
      width: 100%;
    }
    .frisframe-time-stepper > button {
      width: 26px;
      min-width: 26px !important;
      height: 28px;
      min-height: 28px !important;
      padding: 0 !important;
      border: 1px solid rgba(255,255,255,.08);
      border-radius: 6px;
      background: rgba(255,255,255,.025);
      color: #8f98a2;
      font-size: 13px;
      font-weight: 800;
      cursor: pointer;
    }
    .frisframe-time-stepper > button:hover,
    .frisframe-time-stepper > button:focus-visible {
      color: #d8dee6;
      border-color: rgba(255,255,255,.18);
      background: rgba(255,255,255,.06);
    }
    .frisframe-time-stepper #keyTimeInput {
      width: 100%;
      min-width: 0;
    }
    #viewButtons [data-view]::after {
      content: "";
    }

    @media (prefers-reduced-motion: reduce) {
      .frisframe-export-range-details > summary::before,
      .three-wrap .three-jog-container {
        transition: none !important;
      }
    }
  `;
  document.head.append(style);

  const rememberDetails = (details, key, defaultOpen = false) => {
    if (!details) return;
    const stored = safeStorage.get(key);
    details.open = stored === "1" ? true : stored === "0" ? false : defaultOpen;
    details.addEventListener("toggle", () => safeStorage.set(key, details.open ? "1" : "0"));
  };

  const threeHud = document.getElementById("threeHud");
  const threeControls = threeHud?.querySelector(".three-hud-controls");
  const threeShortcuts = threeHud?.querySelector(".three-shortcuts");
  if (threeHud && threeControls && threeShortcuts && !threeHud.querySelector(".frisframe-3d-help")) {
    threeHud.classList.add("frisframe-hud-polished");
    const details = document.createElement("details");
    details.className = "frisframe-3d-help";
    details.innerHTML = '<summary>조작 도움말</summary>';
    details.append(threeShortcuts);
    threeControls.append(details);
    rememberDetails(details, "frisframe.ui.threeHelp", false);

    document.addEventListener("pointerdown", (event) => {
      if (!details.open || details.contains(event.target)) return;
      details.open = false;
    }, true);
  }

  const exportMenu = document.getElementById("exportMenu");
  const exportPopover = exportMenu?.querySelector(".toolbar-menu-popover");
  const exportRangeTools = document.getElementById("exportRangeTools");
  const exportRangeSummary = document.getElementById("exportRangeSummary");
  const frameButton = document.getElementById("frameBtn");
  if (exportMenu && exportPopover && exportRangeTools && !exportMenu.querySelector(".frisframe-export-range-details")) {
    const details = document.createElement("details");
    details.className = "frisframe-export-range-details";
    details.innerHTML = '<summary><span>MP4 구간 설정</span><small></small></summary>';
    const summaryValue = details.querySelector("summary small");
    const updateSummary = () => {
      summaryValue.textContent = (exportRangeSummary?.textContent || "전체 구간").replace(/\s*·\s*/, " · ");
    };
    updateSummary();
    if (exportRangeSummary) {
      new MutationObserver(updateSummary).observe(exportRangeSummary, { childList: true, characterData: true, subtree: true });
    }
    details.append(exportRangeTools);
    exportPopover.insertBefore(details, frameButton || exportPopover.firstChild);
    rememberDetails(details, "frisframe.ui.exportRange", false);

    const note = document.createElement("p");
    note.className = "frisframe-export-workflow-note";
    note.textContent = "기준 프레임은 생성형 이미지 구조 참고용, MP4는 Seedance Video Reference용입니다.";
    details.insertAdjacentElement("afterend", note);
  }

  const keyTimeInput = document.getElementById("keyTimeInput");
  const keyTimeField = keyTimeInput?.closest("label.compact-field");
  if (keyTimeInput && keyTimeField && !keyTimeField.querySelector(".frisframe-time-stepper")) {
    const stepper = document.createElement("div");
    stepper.className = "frisframe-time-stepper";
    const back = document.createElement("button");
    back.type = "button";
    back.textContent = "−";
    back.title = "0.1초 뒤로 · Shift 클릭은 1초";
    back.setAttribute("aria-label", "현재 시간을 뒤로 이동");
    const forward = document.createElement("button");
    forward.type = "button";
    forward.textContent = "+";
    forward.title = "0.1초 앞으로 · Shift 클릭은 1초";
    forward.setAttribute("aria-label", "현재 시간을 앞으로 이동");
    keyTimeInput.replaceWith(stepper);
    stepper.append(back, keyTimeInput, forward);

    const nudgeTime = (direction, event) => {
      const increment = event.shiftKey ? 1 : 0.1;
      const minimum = Number.isFinite(Number(keyTimeInput.min)) ? Number(keyTimeInput.min) : 0;
      const maximum = Number.isFinite(Number(keyTimeInput.max)) ? Number(keyTimeInput.max) : 60;
      const current = Number.isFinite(Number(keyTimeInput.value)) ? Number(keyTimeInput.value) : 0;
      const next = Math.min(maximum, Math.max(minimum, current + increment * direction));
      keyTimeInput.value = String(Number(next.toFixed(2)));
      keyTimeInput.dispatchEvent(new Event("change", { bubbles: true }));
    };
    back.addEventListener("click", (event) => nudgeTime(-1, event));
    forward.addEventListener("click", (event) => nudgeTime(1, event));
  }

  const timelineMain = document.querySelector(".timeline-main");
  const rewindButton = document.getElementById("rewindBtn");
  const keySourceSelect = document.getElementById("keySourceSelect");

  const markerTime = (marker) => {
    const raw = String(marker?.dataset?.time || "").replace(/[^0-9.+-]/g, "");
    const value = Number.parseFloat(raw);
    return Number.isFinite(value) ? value : null;
  };

  const normalizedSourceLabel = () => String(keySourceSelect?.selectedOptions?.[0]?.textContent || "")
    .replace(/\s*\([^)]*\)\s*$/, "")
    .trim();

  const markersForActiveSource = () => {
    if (!keySourceSelect || keySourceSelect.value === "all") {
      const combined = [...document.querySelectorAll("#timelineMarkers .timeline-marker")];
      return combined.length ? combined : [...document.querySelectorAll("#sourceTimelineList .timeline-marker")];
    }
    const label = normalizedSourceLabel();
    const lanes = [...document.querySelectorAll("#sourceTimelineList .source-lane")];
    const lane = lanes.find((entry) => {
      const text = entry.querySelector(".source-lane-label")?.textContent?.trim() || "";
      return text === label || text.startsWith(label);
    });
    const scoped = lane ? [...lane.querySelectorAll(".timeline-marker")] : [];
    return scoped.length ? scoped : [...document.querySelectorAll("#timelineMarkers .timeline-marker")];
  };

  const jumpAdjacentKey = (direction) => {
    const current = Number.isFinite(Number(keyTimeInput?.value)) ? Number(keyTimeInput.value) : 0;
    const markers = markersForActiveSource()
      .map((marker) => ({ marker, time: markerTime(marker) }))
      .filter((entry) => entry.time !== null)
      .sort((a, b) => a.time - b.time);
    if (!markers.length) return;
    const epsilon = 0.0005;
    const candidate = direction < 0
      ? markers.filter((entry) => entry.time < current - epsilon).at(-1)
      : markers.find((entry) => entry.time > current + epsilon);
    const target = candidate || (direction < 0 ? markers[0] : markers.at(-1));
    target?.marker?.click();
  };

  if (timelineMain && rewindButton && !timelineMain.querySelector(".frisframe-key-nav")) {
    const nav = document.createElement("div");
    nav.className = "frisframe-key-nav";
    nav.setAttribute("aria-label", "키프레임 빠른 이동");
    const previous = document.createElement("button");
    previous.type = "button";
    previous.className = "text-btn";
    previous.innerHTML = '<span>‹ 키</span><kbd>[</kbd>';
    previous.title = "현재 대상의 이전 키로 이동 ([)";
    const next = document.createElement("button");
    next.type = "button";
    next.className = "text-btn";
    next.innerHTML = '<span>키 ›</span><kbd>]</kbd>';
    next.title = "현재 대상의 다음 키로 이동 (])";
    previous.addEventListener("click", () => jumpAdjacentKey(-1));
    next.addEventListener("click", () => jumpAdjacentKey(1));
    nav.append(previous, next);
    timelineMain.insertBefore(nav, rewindButton);
  }

  const viewButtons = [...document.querySelectorAll("#viewButtons button[data-view]")];
  const storyboardScreen = document.getElementById("storyboardScreen");
  viewButtons.forEach((button) => {
    button.addEventListener("click", () => safeStorage.set("frisframe.ui.lastBlockingView", button.dataset.view || "2d"));
    const shortcut = button.dataset.view === "2d" ? "⌘2" : "⌘3 · V 전환";
    button.title = `${button.dataset.view.toUpperCase()} 보기 (${shortcut})`;
  });

  const rememberedView = safeStorage.get("frisframe.ui.lastBlockingView");
  if ((rememberedView === "2d" || rememberedView === "3d") && storyboardScreen?.hidden !== false) {
    const target = viewButtons.find((button) => button.dataset.view === rememberedView);
    const active = viewButtons.find((button) => button.classList.contains("is-active"));
    if (target && active !== target) requestAnimationFrame(() => target.click());
  }

  const isTypingContext = (target) => Boolean(target?.closest?.("input, textarea, select, [contenteditable='true'], dialog[open]"));
  document.addEventListener("keydown", (event) => {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || isTypingContext(event.target)) return;
    if (event.key === "[") {
      event.preventDefault();
      jumpAdjacentKey(-1);
      return;
    }
    if (event.key === "]") {
      event.preventDefault();
      jumpAdjacentKey(1);
      return;
    }
    if (event.key.toLowerCase() === "v") {
      if (storyboardScreen?.hidden === false) return;
      const active = viewButtons.find((button) => button.classList.contains("is-active"));
      const targetView = active?.dataset.view === "3d" ? "2d" : "3d";
      const target = viewButtons.find((button) => button.dataset.view === targetView);
      if (!target) return;
      event.preventDefault();
      target.click();
    }
  });
})();
