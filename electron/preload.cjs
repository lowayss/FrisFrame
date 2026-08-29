"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("frisframeDesktop", Object.freeze({
  isDesktop: true,
  platform: process.platform,
  copyImage: (pngBytes) => ipcRenderer.invoke("clipboard:write-image", pngBytes),
  saveFile: (payload) => ipcRenderer.invoke("file:save", payload),
}));

/*
 * FrisFrame's desktop UI is intentionally kept focused on deterministic previs.
 * AI image generation and final Seedance prompt composition live outside the app
 * and are handled through the user's MCP conversation/workflow.
 */
function installMcpFirstWorkflowUi() {
  window.addEventListener("DOMContentLoaded", () => {
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
        height: 28px !important;
        padding: 0 9px !important;
        border-radius: 7px !important;
        font-size: 12px !important;
        line-height: 26px !important;
        flex: 0 0 auto !important;
      }
      #focalPresets.frisframe-focal-compact::before {
        content: "화각";
        display: inline-flex;
        align-items: center;
        min-width: 34px;
        color: var(--muted, #9aa0a8);
        font-size: 11px;
        font-weight: 700;
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

      /* Annotation is an optional helper, not part of the core previs workflow. */
      #annotationToolbar[hidden] {
        display: none !important;
      }
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
        background: rgba(24, 29, 34, .92);
        color: #d8dee7;
        box-shadow: 0 5px 14px rgba(0,0,0,.22);
        font-size: 16px;
        line-height: 1;
        cursor: pointer;
      }
      .frisframe-annotation-toggle:hover,
      .frisframe-annotation-toggle[aria-pressed="true"] {
        border-color: rgba(255,255,255,.36);
        background: rgba(42, 49, 56, .98);
      }
      .app.is-storyboard .frisframe-annotation-toggle {
        display: none;
      }
    `;
    document.head.append(style);

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

    // A local image picker cannot understand or reconstruct a reference image.
    // Reference-image interpretation belongs to the external vision-capable MCP caller.
    document.querySelectorAll(".spatial-reference-panel").forEach((panel) => panel.remove());

    // Keep lens and focal presets together. These are direct camera controls, not
    // AI helpers, so they remain editable manually and through the same project data.
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

    // The vertical annotation toolbar is optional. Start with it hidden so the
    // canvas stays clean, and expose one compact toggle when the user needs it.
    const annotationToolbar = document.getElementById("annotationToolbar");
    const canvasWrap = document.querySelector(".canvas-wrap");
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

      annotationToggle.addEventListener("click", () => {
        setAnnotationVisible(annotationToolbar.hidden);
      });

      window.addEventListener("keydown", (event) => {
        if (!event.shiftKey || event.altKey || event.ctrlKey || event.metaKey || event.key.toLowerCase() !== "a") return;
        const target = event.target;
        if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable) return;
        event.preventDefault();
        setAnnotationVisible(annotationToolbar.hidden);
      });
    }

    removeRetiredExportControls();

    // Some export controls are rendered again after workspace changes. Keep the
    // deterministic reduced surface stable without touching the underlying data.
    const observer = new MutationObserver(() => removeRetiredExportControls());
    const exportMenu = document.getElementById("exportMenu");
    if (exportMenu) observer.observe(exportMenu, { childList: true, subtree: true });
    if (exportActions) observer.observe(exportActions, { childList: true, subtree: true });
  }, { once: true });
}

installMcpFirstWorkflowUi();
