"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("frisframeDesktop", Object.freeze({
  isDesktop: true,
  platform: process.platform,
  copyImage: (pngBytes) => ipcRenderer.invoke("clipboard:write-image", pngBytes),
  saveFile: (payload) => ipcRenderer.invoke("file:save", payload),
}));

function installMcpFirstWorkflowUi() {
  window.addEventListener("DOMContentLoaded", () => {
    const style = document.createElement("style");
    style.textContent = `
      #focalPresets.frisframe-focal-compact {
        display: flex !important;
        flex-wrap: wrap;
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
    `;
    document.head.append(style);

    const hideById = [
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

    const hideUnneededExportControls = () => {
      hideById.forEach((id) => {
        const element = document.getElementById(id);
        if (element) element.hidden = true;
      });

      document.querySelectorAll("#exportMenu button, .export-panel-actions button").forEach((button) => {
        const label = (button.textContent || "").trim();
        if (/Reference\s*(Readiness|Prompt)|배경시트|촬영\s*자료|멀티캠|2D\s*블로킹/i.test(label)) {
          button.hidden = true;
        }
      });
    };

    document.querySelectorAll(".spatial-reference-panel").forEach((panel) => {
      panel.hidden = true;
    });

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
        button.title = `${focal}mm 화각`;
        button.setAttribute("aria-label", `${focal}mm 화각`);
      });
    }

    const exportCopy = document.querySelector(".export-panel-copy");
    if (exportCopy) {
      exportCopy.textContent = "Seedance 비디오 레퍼런스용 프리비즈 영상과 필요한 기준 프레임만 출력합니다.";
    }

    hideUnneededExportControls();

    const observer = new MutationObserver(() => hideUnneededExportControls());
    const exportMenu = document.getElementById("exportMenu");
    if (exportMenu) observer.observe(exportMenu, { childList: true, subtree: true });
    const exportPanel = document.querySelector(".export-panel-actions");
    if (exportPanel) observer.observe(exportPanel, { childList: true, subtree: true });
  }, { once: true });
}

installMcpFirstWorkflowUi();
