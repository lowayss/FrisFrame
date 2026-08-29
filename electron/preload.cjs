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
