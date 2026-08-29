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
})();
