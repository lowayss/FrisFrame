"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("frisframeDesktop", Object.freeze({
  isDesktop: true,
  platform: process.platform,
  copyImage: (pngBytes) => ipcRenderer.invoke("clipboard:write-image", pngBytes),
  saveFile: (payload) => ipcRenderer.invoke("file:save", payload),
}));

/*
 * Desktop-only workflow polish.
 * FrisFrame stays a deterministic previs editor. AI image generation and final
 * Seedance prompt composition remain outside the app in the MCP conversation.
 */
function installMcpFirstWorkflowUi() {
  window.addEventListener("DOMContentLoaded", () => {
    const app = document.querySelector(".app");
    const canvasWrap = document.querySelector(".canvas-wrap");
    const toolbar = document.querySelector(".toolbar");
    const leftPanel = document.querySelector(".left-panel");
    const rightPanel = document.querySelector(".right-panel");
    if (!app) return;
    if (leftPanel && !leftPanel.id) leftPanel.id = "frisframeLeftPanel";
    if (rightPanel && !rightPanel.id) rightPanel.id = "frisframeRightPanel";

    const style = document.createElement("style");
    style.textContent = `
      #focalPresets.frisframe-focal-compact {
        display: flex !important;
        flex-wrap: wrap;
        align-items: center;
        gap: 5px !important;
        margin: 2px 0 8px 0 !important;
      }
      #focalPresets.frisframe-focal-compact button {
        min-width: 0 !important;
        width: auto !important;
        height: 27px !important;
        min-height: 27px !important;
        padding: 0 8px !important;
        border-radius: 7px !important;
        font-size: 11px !important;
        line-height: 25px !important;
        flex: 0 0 auto !important;
      }
      #focalPresets.frisframe-focal-compact::before {
        content: "화각";
        display: inline-flex;
        align-items: center;
        min-width: 32px;
        color: var(--muted, #9aa0a8);
        font-size: 10px;
        font-weight: 800;
      }

      .compact-details > summary::after {
        content: "›" !important;
        display: inline-grid;
        place-items: center;
        width: 18px;
        height: 18px;
        color: #858b94 !important;
        font-size: 18px !important;
        font-weight: 500 !important;
        line-height: 1 !important;
        transform: rotate(0deg);
        transition: transform .14s ease, color .14s ease;
      }
      .compact-details[open] > summary::after {
        content: "›" !important;
        transform: rotate(90deg);
        color: #cbd2db !important;
      }
      .left-panel,
      .right-panel {
        scrollbar-gutter: stable;
      }

      .frisframe-export-note {
        grid-column: 1 / -1;
        margin: 2px 0 4px;
        padding: 9px 10px;
        border: 1px solid rgba(255,255,255,.08);
        border-radius: 8px;
        color: var(--muted, #9aa0a8);
        font-size: 11px;
        line-height: 1.45;
      }

      .app.frisframe-left-collapsed {
        grid-template-columns: 0 minmax(620px, 1fr) 272px;
      }
      .app.frisframe-right-collapsed {
        grid-template-columns: 208px minmax(620px, 1fr) 0;
      }
      .app.frisframe-left-collapsed.frisframe-right-collapsed,
      .app.frisframe-focus-mode {
        grid-template-columns: 0 minmax(620px, 1fr) 0;
      }
      .app.frisframe-left-collapsed > .left-panel,
      .app.frisframe-focus-mode > .left-panel,
      .app.frisframe-right-collapsed > .right-panel,
      .app.frisframe-focus-mode > .right-panel {
        display: none !important;
      }

      .frisframe-panel-edge-toggle {
        position: absolute;
        top: 50%;
        z-index: 34;
        width: 24px;
        min-width: 24px;
        height: 44px;
        min-height: 44px;
        padding: 0;
        border: 1px solid rgba(255,255,255,.13);
        border-radius: 8px;
        background: rgba(20, 24, 29, .76);
        color: #aeb7c2;
        box-shadow: 0 4px 14px rgba(0,0,0,.18);
        opacity: .58;
        transform: translateY(-50%);
        transition: opacity .14s ease, background .14s ease, border-color .14s ease;
        backdrop-filter: blur(8px);
      }
      .frisframe-panel-edge-toggle:hover,
      .frisframe-panel-edge-toggle:focus-visible {
        opacity: 1;
        background: rgba(33, 39, 46, .96);
        border-color: rgba(255,255,255,.28);
      }
      .frisframe-panel-edge-toggle.is-left { left: 7px; }
      .frisframe-panel-edge-toggle.is-right { right: 7px; }
      .frisframe-panel-edge-toggle span {
        display: block;
        font-size: 18px;
        line-height: 1;
        transition: transform .14s ease;
      }
      .app.frisframe-left-collapsed .frisframe-panel-edge-toggle.is-left span,
      .app.frisframe-focus-mode .frisframe-panel-edge-toggle.is-left span {
        transform: rotate(180deg);
      }
      .app.frisframe-right-collapsed .frisframe-panel-edge-toggle.is-right span,
      .app.frisframe-focus-mode .frisframe-panel-edge-toggle.is-right span {
        transform: rotate(180deg);
      }

      .frisframe-focus-toggle {
        width: 32px;
        min-width: 32px;
        padding: 0 !important;
      }
      .frisframe-focus-toggle[aria-pressed="true"] {
        border-color: #c75644 !important;
        background: #ff6b55 !important;
        color: #fff8f5 !important;
      }

      #annotationToolbar[hidden] { display: none !important; }
      .frisframe-annotation-toggle {
        position: absolute;
        left: 12px;
        top: 12px;
        z-index: 36;
        min-width: 0;
        width: 32px;
        height: 32px;
        padding: 0;
        display: inline-grid;
        place-items: center;
        border: 1px solid rgba(255,255,255,.18);
        border-radius: 9px;
        background: rgba(24, 29, 34, .88);
        color: #d8dee7;
        box-shadow: 0 5px 14px rgba(0,0,0,.18);
        font-size: 16px;
        line-height: 1;
        cursor: pointer;
        opacity: .78;
      }
      .frisframe-annotation-toggle:hover,
      .frisframe-annotation-toggle[aria-pressed="true"] {
        opacity: 1;
        border-color: rgba(255,255,255,.36);
        background: rgba(42, 49, 56, .98);
      }
      .app.is-storyboard .frisframe-annotation-toggle,
      .app.is-storyboard .frisframe-panel-edge-toggle {
        display: none;
      }

      .canvas-wrap { isolation: isolate; }
      .stage-zoom-controls,
      .camera-frame-mode-btn,
      .three-jog-container { transition: opacity .14s ease; }
      .canvas-wrap:not(:hover) .stage-zoom-controls { opacity: .72; }

      /* Timeline: keep everyday keyframing visible and move secondary controls away. */
      .timeline.frisframe-timeline-polished {
        padding-top: 8px;
      }
      .frisframe-timeline-polished .timeline-main {
        gap: 5px !important;
        align-items: center;
        flex-wrap: wrap;
      }
      .frisframe-timeline-polished #addKeyBtn {
        border-color: #d95440;
        background: var(--accent, #ff6b55);
        color: #fff8f5;
      }
      .frisframe-timeline-polished #addKeyBtn:hover {
        background: #f75f49;
      }
      .frisframe-timeline-polished #updateKeyBtn,
      .frisframe-timeline-polished #deleteKeyBtn {
        min-width: 0;
        padding: 0 8px;
      }
      .frisframe-timeline-polished .timeline-edit-tools {
        gap: 3px;
        margin-left: 2px;
      }
      .frisframe-timeline-polished .timeline-fields {
        display: grid !important;
        grid-template-columns: minmax(140px, 1.6fr) minmax(92px, .65fr) !important;
        gap: 7px !important;
        align-items: end;
      }
      .frisframe-timeline-polished .timeline-fields > label {
        min-width: 0;
      }
      .frisframe-timeline-polished #keyTimeInput {
        font-variant-numeric: tabular-nums;
        text-align: right;
      }
      .frisframe-timeline-advanced {
        margin: 6px 0 4px;
        border: 0;
      }
      .frisframe-timeline-advanced > summary {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-height: 25px;
        padding: 0 8px;
        border: 1px solid rgba(255,255,255,.09);
        border-radius: 6px;
        color: #aeb5be;
        background: rgba(255,255,255,.025);
        cursor: pointer;
        font-size: 10px;
        font-weight: 800;
        user-select: none;
        list-style: none;
      }
      .frisframe-timeline-advanced > summary::-webkit-details-marker { display: none; }
      .frisframe-timeline-advanced > summary::before {
        content: "›";
        font-size: 15px;
        line-height: 1;
        transition: transform .12s ease;
      }
      .frisframe-timeline-advanced[open] > summary::before { transform: rotate(90deg); }
      .frisframe-timeline-advanced-copy {
        color: #707781;
        font-weight: 600;
      }
      .frisframe-timeline-advanced-body {
        display: flex;
        flex-wrap: wrap;
        align-items: end;
        gap: 7px;
        margin-top: 7px;
        padding: 8px;
        border: 1px solid rgba(255,255,255,.07);
        border-radius: 7px;
        background: rgba(0,0,0,.08);
      }
      .frisframe-timeline-advanced-body > label {
        min-width: 118px;
        flex: 1 1 140px;
      }
      .frisframe-timeline-advanced-body #timelineMode {
        flex: 0 0 auto;
        align-self: center;
      }
      .frisframe-timeline-advanced-body #cameraHeightKeyBtn {
        align-self: end;
      }
      .frisframe-timeline-polished .timeline-hint,
      .frisframe-timeline-polished #keyStatus {
        font-size: 10px;
        opacity: .8;
      }
      .frisframe-timeline-polished .source-timeline-list:empty {
        display: none;
      }

      @media (prefers-reduced-motion: reduce) {
        .frisframe-panel-edge-toggle,
        .compact-details > summary::after,
        .frisframe-timeline-advanced > summary::before {
          transition: none !important;
        }
      }
    `;
    document.head.append(style);

    const safeStorage = {
      get(key) {
        try { return window.localStorage.getItem(key); } catch { return null; }
      },
      set(key, value) {
        try { window.localStorage.setItem(key, value); } catch { /* optional UI state */ }
      },
    };

    let resizeFrame = 0;
    const scheduleResize = () => {
      if (resizeFrame) cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => {
        resizeFrame = 0;
        window.dispatchEvent(new Event("resize"));
      });
    };

    const retiredExportIds = [
      "blockingPlanBtn",
      "backgroundSheetBtn",
      "productionPackBtn",
      "multiCamPreviewBtn",
      "multiCamVideoBtn",
      "blockingPlanPanelBtn",
      "backgroundSheetPanelBtn",
      "productionPackPanelBtn",
      "multiCamPreviewPanelBtnSecondary",
      "multiCamVideoPanelBtn",
    ];
    const retiredExportPattern = /Reference\s*(Readiness|Prompt)|배경시트|촬영\s*자료|멀티캠|2D\s*블로킹/i;

    const removeRetiredExportControls = () => {
      retiredExportIds.forEach((id) => document.getElementById(id)?.remove());
      document.querySelectorAll("#exportMenu button, .export-panel-actions button").forEach((button) => {
        const label = (button.textContent || "").trim();
        if (retiredExportPattern.test(label)) button.remove();
      });
    };

    document.querySelectorAll(".spatial-reference-panel").forEach((panel) => panel.remove());

    const focalInput = document.getElementById("focalValue");
    const focalRow = focalInput?.closest("label.range-row");
    const focalPresets = document.getElementById("focalPresets");
    if (focalRow && focalPresets && focalRow.parentElement) {
      focalRow.parentElement.insertBefore(focalPresets, focalRow.nextSibling);
      focalPresets.classList.add("frisframe-focal-compact");
      const label = focalRow.querySelector(":scope > span:first-child");
      if (label) label.textContent = "렌즈";
      focalPresets.querySelectorAll("button[data-focal]").forEach((button) => {
        const focal = button.getAttribute("data-focal");
        button.textContent = focal;
        button.title = `${focal}mm`;
        button.setAttribute("aria-label", `${focal}mm 렌즈`);
      });
    }

    const relabel = (id, label) => {
      const button = document.getElementById(id);
      const span = button?.querySelector("span");
      if (span) span.textContent = label;
    };
    relabel("frameBtn", "기준 프레임");
    relabel("framePanelBtn", "기준 프레임");
    relabel("framePairBtn", "첫·끝 프레임");
    relabel("framePairPanelBtn", "첫·끝 프레임");
    relabel("videoBtn", "프리비즈 MP4");
    relabel("videoPanelBtn", "프리비즈 MP4");
    relabel("addKeyBtn", "키 +");
    relabel("updateKeyBtn", "갱신");

    const exportCopy = document.querySelector(".export-panel-copy");
    if (exportCopy) {
      exportCopy.textContent = "Seedance Video Reference에 넣을 프리비즈 MP4와 생성형 이미지 작업에 필요한 기준 프레임만 출력합니다.";
    }
    const exportActions = document.querySelector(".export-panel-actions");
    if (exportActions && !exportActions.querySelector(".frisframe-export-note")) {
      const note = document.createElement("p");
      note.className = "frisframe-export-note";
      note.textContent = "배경·인물·소품 이미지는 외부 생성형 이미지 도구에서 만들고, 최종 영상 설명과 프롬프트 조립은 MCP 대화에서 처리합니다.";
      exportActions.prepend(note);
    }

    const timeline = document.querySelector(".timeline");
    const timelineFields = timeline?.querySelector(".timeline-fields");
    if (timeline && timelineFields && !timeline.classList.contains("frisframe-timeline-polished")) {
      timeline.classList.add("frisframe-timeline-polished");
      const advanced = document.createElement("details");
      advanced.className = "frisframe-timeline-advanced";
      advanced.open = safeStorage.get("frisframe.ui.timelineAdvanced") === "1";
      advanced.innerHTML = '<summary>세부 설정 <span class="frisframe-timeline-advanced-copy">도착 · 경로 · 보기 · 전체 시간</span></summary><div class="frisframe-timeline-advanced-body"></div>';
      const body = advanced.querySelector(".frisframe-timeline-advanced-body");
      const moveIntoAdvanced = (element) => {
        if (!element || !body) return;
        const movable = element.closest("label") || element;
        body.append(movable);
      };
      moveIntoAdvanced(document.getElementById("keyTransitionSelect"));
      moveIntoAdvanced(document.getElementById("keyPathSelect"));
      moveIntoAdvanced(document.getElementById("durationInput"));
      moveIntoAdvanced(document.getElementById("timelineMode"));
      moveIntoAdvanced(document.getElementById("cameraHeightKeyBtn"));
      timelineFields.insertAdjacentElement("afterend", advanced);
      advanced.addEventListener("toggle", () => safeStorage.set("frisframe.ui.timelineAdvanced", advanced.open ? "1" : "0"));

      const timeInput = document.getElementById("keyTimeInput");
      if (timeInput) {
        timeInput.title = "현재 시간 · Alt+←/→ 0.1초 이동 · Shift+Alt+←/→ 1초 이동";
      }
    }

    const detailsKey = (details, index) => {
      const id = details.id || details.querySelector(":scope > summary")?.textContent?.trim() || `section-${index}`;
      return `frisframe.ui.details.${id}`;
    };
    const defaultOpenByLabel = new Map([
      ["무대", true],
      ["카메라", true],
      ["배우", false],
      ["소품", false],
      ["속성", true],
      ["컷 노트", false],
      ["내보내기", false],
    ]);
    const rememberDetailsState = () => {
      document.querySelectorAll(".left-panel details.compact-details, .right-panel details.compact-details").forEach((details, index) => {
        const key = detailsKey(details, index);
        const stored = safeStorage.get(key);
        const label = details.querySelector(":scope > summary")?.textContent?.trim() || "";
        if (stored === "open" || stored === "closed") {
          details.open = stored === "open";
        } else if (defaultOpenByLabel.has(label)) {
          details.open = defaultOpenByLabel.get(label);
        }
        details.addEventListener("toggle", () => safeStorage.set(key, details.open ? "open" : "closed"));
      });
    };
    requestAnimationFrame(rememberDetailsState);

    let leftHidden = safeStorage.get("frisframe.ui.leftPanelHidden") === "1";
    let rightHidden = safeStorage.get("frisframe.ui.rightPanelHidden") === "1";
    let focusMode = false;
    let preFocusState = { leftHidden, rightHidden };

    const syncWorkspacePanels = () => {
      app.classList.toggle("frisframe-left-collapsed", leftHidden);
      app.classList.toggle("frisframe-right-collapsed", rightHidden);
      app.classList.toggle("frisframe-focus-mode", focusMode);
      const persistedState = focusMode ? preFocusState : { leftHidden, rightHidden };
      safeStorage.set("frisframe.ui.leftPanelHidden", persistedState.leftHidden ? "1" : "0");
      safeStorage.set("frisframe.ui.rightPanelHidden", persistedState.rightHidden ? "1" : "0");
      document.querySelector(".frisframe-panel-edge-toggle.is-left")?.setAttribute("aria-expanded", String(!leftHidden && !focusMode));
      document.querySelector(".frisframe-panel-edge-toggle.is-right")?.setAttribute("aria-expanded", String(!rightHidden && !focusMode));
      const focusButton = document.querySelector(".frisframe-focus-toggle");
      if (focusButton) {
        focusButton.setAttribute("aria-pressed", String(focusMode));
        focusButton.title = focusMode ? "집중 모드 끝내기 (Shift+F)" : "캔버스 집중 모드 (Shift+F)";
      }
      scheduleResize();
    };

    const setFocusMode = (next) => {
      const enabled = Boolean(next);
      if (enabled === focusMode) return;
      if (enabled) {
        preFocusState = { leftHidden, rightHidden };
        leftHidden = true;
        rightHidden = true;
        focusMode = true;
      } else {
        focusMode = false;
        leftHidden = preFocusState.leftHidden;
        rightHidden = preFocusState.rightHidden;
      }
      syncWorkspacePanels();
    };

    const propertiesPanel = document.getElementById("propertiesPanel");
    const propertiesForm = document.getElementById("propertiesForm");
    if (propertiesPanel && propertiesForm) {
      const revealProperties = () => {
        if (propertiesForm.hidden) return;
        propertiesPanel.open = true;
        if (focusMode) setFocusMode(false);
        if (rightHidden) {
          rightHidden = false;
          syncWorkspacePanels();
        }
      };
      new MutationObserver(revealProperties).observe(propertiesForm, { attributes: true, attributeFilter: ["hidden"] });
    }

    if (canvasWrap) {
      const createEdgeToggle = (side) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `frisframe-panel-edge-toggle is-${side}`;
        button.innerHTML = `<span>${side === "left" ? "‹" : "›"}</span>`;
        button.title = side === "left" ? "왼쪽 도구 패널 열기/숨기기" : "오른쪽 속성 패널 열기/숨기기";
        button.setAttribute("aria-label", button.title);
        const controlledPanel = side === "left" ? leftPanel : rightPanel;
        if (controlledPanel?.id) button.setAttribute("aria-controls", controlledPanel.id);
        button.addEventListener("click", () => {
          if (focusMode) {
            setFocusMode(false);
            if (side === "left") leftHidden = false;
            else rightHidden = false;
          } else if (side === "left") {
            leftHidden = !leftHidden;
          } else {
            rightHidden = !rightHidden;
          }
          syncWorkspacePanels();
        });
        canvasWrap.append(button);
      };
      createEdgeToggle("left");
      createEdgeToggle("right");
    }

    if (toolbar) {
      const focusButton = document.createElement("button");
      focusButton.type = "button";
      focusButton.className = "icon-btn frisframe-focus-toggle";
      focusButton.textContent = "⛶";
      focusButton.title = "캔버스 집중 모드 (Shift+F)";
      focusButton.setAttribute("aria-label", "캔버스 집중 모드");
      focusButton.setAttribute("aria-pressed", "false");
      focusButton.addEventListener("click", () => setFocusMode(!focusMode));
      toolbar.prepend(focusButton);

      const toolbarMenus = [...toolbar.querySelectorAll("details.toolbar-menu")];
      toolbarMenus.forEach((menu) => {
        menu.addEventListener("toggle", () => {
          if (!menu.open) return;
          toolbarMenus.forEach((other) => {
            if (other !== menu) other.open = false;
          });
        });
        menu.addEventListener("click", (event) => {
          if (event.target.closest("button")) requestAnimationFrame(() => { menu.open = false; });
        });
      });
    }

    const annotationToolbar = document.getElementById("annotationToolbar");
    if (annotationToolbar && canvasWrap) {
      annotationToolbar.hidden = true;
      annotationToolbar.setAttribute("aria-hidden", "true");

      const annotationToggle = document.createElement("button");
      annotationToggle.type = "button";
      annotationToggle.className = "frisframe-annotation-toggle";
      annotationToggle.textContent = "✎";
      annotationToggle.title = "주석 도구 열기 (Shift+A)";
      annotationToggle.setAttribute("aria-label", "주석 도구 열기");
      annotationToggle.setAttribute("aria-controls", "annotationToolbar");
      annotationToggle.setAttribute("aria-pressed", "false");
      canvasWrap.append(annotationToggle);

      const setAnnotationVisible = (visible) => {
        annotationToolbar.hidden = !visible;
        annotationToolbar.setAttribute("aria-hidden", visible ? "false" : "true");
        annotationToggle.setAttribute("aria-pressed", visible ? "true" : "false");
        annotationToggle.title = visible ? "주석 도구 숨기기 (Shift+A)" : "주석 도구 열기 (Shift+A)";
        annotationToggle.setAttribute("aria-label", visible ? "주석 도구 숨기기" : "주석 도구 열기");
      };
      annotationToggle.addEventListener("click", () => setAnnotationVisible(annotationToolbar.hidden));

      window.addEventListener("keydown", (event) => {
        if (!event.shiftKey || event.altKey || event.ctrlKey || event.metaKey || event.key.toLowerCase() !== "a") return;
        const target = event.target;
        if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target?.isContentEditable) return;
        event.preventDefault();
        setAnnotationVisible(annotationToolbar.hidden);
      });
    }

    window.addEventListener("keydown", (event) => {
      const target = event.target;
      const typing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target?.isContentEditable;

      if (event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey && event.key.toLowerCase() === "f" && !typing) {
        event.preventDefault();
        setFocusMode(!focusMode);
        return;
      }

      if (event.altKey && !event.ctrlKey && !event.metaKey && (event.key === "ArrowLeft" || event.key === "ArrowRight") && !typing) {
        const timeInput = document.getElementById("keyTimeInput");
        const durationInput = document.getElementById("durationInput");
        if (!timeInput) return;
        event.preventDefault();
        const step = event.shiftKey ? 1 : 0.1;
        const direction = event.key === "ArrowRight" ? 1 : -1;
        const maximum = Number(durationInput?.value || timeInput.max || 60);
        const next = Math.min(maximum, Math.max(0, Number(timeInput.value || 0) + step * direction));
        timeInput.value = String(Math.round(next * 1000) / 1000);
        timeInput.dispatchEvent(new Event("input", { bubbles: true }));
        timeInput.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });

    removeRetiredExportControls();
    syncWorkspacePanels();

    const observer = new MutationObserver(() => removeRetiredExportControls());
    const exportMenu = document.getElementById("exportMenu");
    if (exportMenu) observer.observe(exportMenu, { childList: true, subtree: true });
    if (exportActions) observer.observe(exportActions, { childList: true, subtree: true });
  }, { once: true });
}

installMcpFirstWorkflowUi();