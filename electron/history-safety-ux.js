(() => {
  "use strict";

  if (document.documentElement.dataset.frisframeHistorySafetyUx === "1") return;
  document.documentElement.dataset.frisframeHistorySafetyUx = "1";

  const undoButton = document.getElementById("undoBtn");
  const redoButton = document.getElementById("redoBtn");
  const projectSaveStateElement = document.getElementById("projectSaveState");
  const projectSummary = projectSaveStateElement?.closest("summary");
  const viewButtons = document.getElementById("viewButtons");
  const workspaceNav = viewButtons?.closest(".workspace-nav");
  const stageCanvas = document.getElementById("stageCanvas");
  const threeCanvas = document.getElementById("threeCanvas");

  const style = document.createElement("style");
  style.textContent = `
    .frisframe-save-detail {
      margin-left: 4px;
      color: #707984;
      font-size: 9px;
      font-weight: 750;
      line-height: 1;
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
      opacity: .88;
    }
    .frisframe-save-detail[data-status="saving"] { color: #9cb9d4; }
    .frisframe-save-detail[data-status="conflict"],
    .frisframe-save-detail[data-status="error"] { color: #e2a16f; }

    .frisframe-quick-lock {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      height: 29px;
      min-height: 29px;
      padding: 0 8px;
      margin-left: 3px;
      border: 1px solid rgba(255,255,255,.08);
      border-radius: 7px;
      background: rgba(255,255,255,.025);
      color: #98a1ab;
      font-size: 9px;
      font-weight: 800;
      cursor: pointer;
      user-select: none;
    }
    .frisframe-quick-lock:hover,
    .frisframe-quick-lock:focus-visible {
      color: #d7dde4;
      border-color: rgba(255,255,255,.17);
      background: rgba(255,255,255,.055);
    }
    .frisframe-quick-lock.is-locked {
      color: #e3b278;
      border-color: rgba(227,178,120,.26);
      background: rgba(227,178,120,.07);
    }
    .frisframe-quick-lock .frisframe-quick-lock-icon {
      width: 14px;
      text-align: center;
      font-size: 11px;
      line-height: 1;
    }
    .frisframe-quick-lock kbd {
      margin-left: 1px;
      color: #69717b;
      font-size: 8px;
      font-weight: 800;
    }
    .app.is-storyboard .frisframe-quick-lock { display: none !important; }

    @media (max-width: 1320px) {
      .frisframe-save-detail { display: none; }
      .frisframe-quick-lock {
        width: 29px;
        min-width: 29px;
        padding: 0;
        margin-left: 2px;
        justify-content: center;
        gap: 0;
      }
      .frisframe-quick-lock .frisframe-quick-lock-label,
      .frisframe-quick-lock kbd { display: none; }
    }

    .frisframe-drag-cancel-hint {
      position: absolute;
      left: 50%;
      bottom: 43px;
      z-index: 59;
      transform: translateX(-50%);
      padding: 4px 7px;
      border: 1px solid rgba(255,255,255,.09);
      border-radius: 7px;
      background: rgba(10,14,18,.74);
      color: #8f98a2;
      font-size: 9px;
      font-weight: 800;
      pointer-events: none;
      opacity: 0;
      transition: opacity .1s ease;
    }
    .canvas-wrap.is-direct-editing .frisframe-drag-cancel-hint { opacity: .82; }

    @media (prefers-reduced-motion: reduce) {
      .frisframe-drag-cancel-hint { transition: none !important; }
    }
  `;
  document.head.append(style);

  const canvasWrap = document.querySelector(".canvas-wrap");
  let dragCancelHint = null;
  if (canvasWrap) {
    dragCancelHint = document.createElement("div");
    dragCancelHint.className = "frisframe-drag-cancel-hint";
    dragCancelHint.textContent = "Esc · 현재 드래그 취소";
    canvasWrap.append(dragCancelHint);
  }

  let saveDetail = null;
  if (projectSummary && projectSaveStateElement) {
    saveDetail = document.createElement("small");
    saveDetail.className = "frisframe-save-detail";
    saveDetail.setAttribute("aria-live", "polite");
    projectSaveStateElement.insertAdjacentElement("afterend", saveDetail);
  }

  let quickLockButton = null;
  if (workspaceNav) {
    quickLockButton = document.createElement("button");
    quickLockButton.type = "button";
    quickLockButton.className = "frisframe-quick-lock";
    quickLockButton.hidden = true;
    quickLockButton.innerHTML = '<span class="frisframe-quick-lock-icon" aria-hidden="true">◫</span><span class="frisframe-quick-lock-label">잠금</span><kbd>L</kbd>';
    workspaceNav.append(quickLockButton);
  }

  const threeShortcuts = document.querySelector(".three-shortcuts");
  if (threeShortcuts && threeShortcuts.dataset.frisframeSafetyHelp !== "1") {
    threeShortcuts.dataset.frisframeSafetyHelp = "1";
    const cancelHelp = document.createElement("span");
    cancelHelp.innerHTML = '<kbd>Esc</kbd> 드래그 취소';
    const lockHelp = document.createElement("span");
    lockHelp.innerHTML = '<kbd>L</kbd> 선택 대상 잠금';
    threeShortcuts.append(cancelHelp, lockHelp);
  }

  let dirtyAt = 0;
  let lastSavedAt = 0;
  let latestObservedStatus = typeof projectSaveStatus !== "undefined" ? projectSaveStatus : "changed";

  function saveDetailText(status, hasManagedProject, elapsedSavedMs = 0, dirtyElapsedMs = 0) {
    if (!hasManagedProject && ["changed", "prepared"].includes(status)) return "저장 필요";
    if (status === "changed") {
      const remaining = Math.max(0, 2600 - Math.max(0, dirtyElapsedMs));
      return remaining > 150 ? `자동저장 ${(remaining / 1000).toFixed(1)}초` : "자동저장 준비";
    }
    if (status === "prepared") return "저장 준비";
    if (status === "saving") return "서버에 기록 중";
    if (status === "conflict") return "확인 필요";
    if (status === "error") return "재시도 필요";
    if (status === "saved") {
      if (!lastSavedAt || elapsedSavedMs < 5000) return "방금 저장";
      if (elapsedSavedMs < 60000) return `${Math.max(5, Math.floor(elapsedSavedMs / 1000))}초 전`;
      return `${Math.max(1, Math.floor(elapsedSavedMs / 60000))}분 전`;
    }
    return "";
  }

  window.FrisFrameHistorySafetyUxTest = {
    saveDetailText,
  };

  function updateSaveDetail() {
    if (!saveDetail) return;
    const status = typeof projectSaveStatus !== "undefined" ? projectSaveStatus : latestObservedStatus;
    const hasManagedProject = typeof managedProjectId !== "undefined" && Boolean(managedProjectId);
    const now = Date.now();
    saveDetail.dataset.status = status;
    saveDetail.textContent = saveDetailText(
      status,
      hasManagedProject,
      lastSavedAt ? now - lastSavedAt : 0,
      dirtyAt ? now - dirtyAt : 0,
    );
    if (projectSaveStateElement) {
      const descriptions = {
        changed: hasManagedProject ? "변경 사항이 있으며 자동 저장을 기다리는 중" : "변경 사항이 있으며 프로젝트 저장이 필요함",
        prepared: "프로젝트 저장 준비 중",
        saving: "프로젝트를 로컬 서버에 저장하는 중",
        saved: "프로젝트 저장 완료",
        conflict: "다른 변경과 충돌하여 저장 확인이 필요함",
        error: "프로젝트 저장 실패",
      };
      projectSaveStateElement.title = descriptions[status] || "프로젝트 저장 상태";
    }
  }

  if (typeof setProjectSaveStatus === "function") {
    const originalSetProjectSaveStatus = setProjectSaveStatus;
    setProjectSaveStatus = function polishedProjectSaveStatus(status) {
      const before = typeof projectSaveStatus !== "undefined" ? projectSaveStatus : latestObservedStatus;
      const result = originalSetProjectSaveStatus(status);
      latestObservedStatus = typeof projectSaveStatus !== "undefined" ? projectSaveStatus : status;
      if (latestObservedStatus === "changed" && before !== "changed") dirtyAt = Date.now();
      if (latestObservedStatus === "saved") {
        lastSavedAt = Date.now();
        dirtyAt = 0;
      }
      updateSaveDetail();
      return result;
    };
  }

  if (latestObservedStatus === "changed") dirtyAt = Date.now();
  if (latestObservedStatus === "saved") lastSavedAt = Date.now();
  updateSaveDetail();
  const saveTicker = window.setInterval(updateSaveDetail, 500);
  window.addEventListener("beforeunload", () => window.clearInterval(saveTicker), { once: true });

  function historyCounts() {
    try {
      const normalUndo = typeof history !== "undefined" && Array.isArray(history) ? Math.max(0, history.length - 1) : 0;
      const normalRedo = typeof future !== "undefined" && Array.isArray(future) ? future.length : 0;
      const projectUndo = typeof projectHistory !== "undefined" && Array.isArray(projectHistory) ? projectHistory.length : 0;
      const projectRedo = typeof projectFuture !== "undefined" && Array.isArray(projectFuture) ? projectFuture.length : 0;
      const storyboard = typeof workspaceMode !== "undefined" && workspaceMode === "storyboard";
      return {
        undo: storyboard ? projectUndo + normalUndo : normalUndo,
        redo: storyboard ? projectRedo + normalRedo : normalRedo,
      };
    } catch (_error) {
      return { undo: 0, redo: 0 };
    }
  }

  function updateHistoryTooltips() {
    const counts = historyCounts();
    const mod = /Mac|iPhone|iPad/.test(navigator.platform || "") ? "⌘" : "Ctrl+";
    if (undoButton) {
      undoButton.title = `실행 취소 (${mod}Z)${counts.undo ? ` · ${counts.undo}단계` : ""}`;
      undoButton.setAttribute("aria-label", counts.undo ? `실행 취소, ${counts.undo}단계 가능` : "실행 취소할 내용 없음");
    }
    if (redoButton) {
      const redoShortcut = /Mac|iPhone|iPad/.test(navigator.platform || "") ? "⌘⇧Z" : "Ctrl+Y / Ctrl+Shift+Z";
      redoButton.title = `다시 실행 (${redoShortcut})${counts.redo ? ` · ${counts.redo}단계` : ""}`;
      redoButton.setAttribute("aria-label", counts.redo ? `다시 실행, ${counts.redo}단계 가능` : "다시 실행할 내용 없음");
    }
  }

  if (undoButton) new MutationObserver(updateHistoryTooltips).observe(undoButton, { attributes: true, attributeFilter: ["disabled"] });
  if (redoButton) new MutationObserver(updateHistoryTooltips).observe(redoButton, { attributes: true, attributeFilter: ["disabled"] });
  document.addEventListener("pointerup", () => requestAnimationFrame(updateHistoryTooltips), true);
  document.addEventListener("keyup", () => requestAnimationFrame(updateHistoryTooltips), true);
  updateHistoryTooltips();

  function isTypingTarget(target) {
    return target instanceof Element && Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
  }

  function selectedLockTarget() {
    if (typeof workspaceMode !== "undefined" && workspaceMode !== "blocking") return null;
    if (typeof selected === "undefined" || !selected) return null;
    if (["item", "facing"].includes(selected.kind)) {
      const item = typeof selectedItem === "function" ? selectedItem() : null;
      if (!item) return null;
      let target = item;
      try {
        const leaderId = transformLeaderIdForItem(item.id, state);
        target = state.items.find((entry) => entry.id === leaderId) || item;
      } catch (_error) {
        target = item;
      }
      const locked = typeof sourceEditLocked === "function" ? sourceEditLocked(target.id) : Boolean(target.editLocked);
      return {
        kind: "item",
        label: target.name || (target.type === "actor" ? "배우" : "소품"),
        locked,
      };
    }
    if (selected.kind === "camera") {
      const locked = typeof cameraFieldLocked === "function" ? cameraFieldLocked("position") : false;
      return { kind: "camera", label: "카메라 위치", locked };
    }
    return null;
  }

  function updateQuickLock() {
    if (!quickLockButton) return;
    const target = selectedLockTarget();
    quickLockButton.hidden = !target;
    if (!target) return;
    quickLockButton.classList.toggle("is-locked", target.locked);
    quickLockButton.setAttribute("aria-pressed", String(target.locked));
    quickLockButton.querySelector(".frisframe-quick-lock-icon").textContent = target.locked ? "▣" : "◫";
    quickLockButton.querySelector(".frisframe-quick-lock-label").textContent = target.locked ? "잠금 해제" : "잠금";
    quickLockButton.title = `${target.label} ${target.locked ? "편집 잠금 해제" : "편집 잠금"} (L)`;
    quickLockButton.setAttribute("aria-label", quickLockButton.title);
  }

  function toggleSelectedLock() {
    const target = selectedLockTarget();
    if (!target) return false;
    if (target.kind === "item") {
      const button = document.getElementById("itemEditLockBtn");
      if (!button) return false;
      button.click();
    } else {
      const button = document.querySelector('#cameraLockControls [data-camera-lock="position"]');
      if (!button) return false;
      button.click();
      if (typeof notifyApp === "function") notifyApp(`카메라 위치 ${target.locked ? "잠금 해제" : "잠금"}`);
    }
    requestAnimationFrame(updateQuickLock);
    return true;
  }

  quickLockButton?.addEventListener("click", () => toggleSelectedLock());
  document.addEventListener("pointerdown", () => requestAnimationFrame(updateQuickLock), true);
  document.getElementById("itemEditLockBtn")?.addEventListener("click", () => requestAnimationFrame(updateQuickLock));
  document.getElementById("cameraLockControls")?.addEventListener("click", () => requestAnimationFrame(updateQuickLock));
  viewButtons?.addEventListener("click", () => requestAnimationFrame(updateQuickLock));
  updateQuickLock();

  function dispatchDragCancelled() {
    document.dispatchEvent(new CustomEvent("frisframe:drag-cancelled"));
  }

  function restoreEditSnapshot(snapshot, label, releaseTarget, pointerId) {
    try { releaseTarget?.releasePointerCapture?.(pointerId); } catch { /* Pointer may already be released. */ }
    if (snapshot && typeof restoreUncommittedState === "function") restoreUncommittedState(snapshot);
    else {
      if (typeof syncUi === "function") syncUi();
      if (typeof draw === "function") draw();
      if (typeof renderThreeView === "function" && typeof threeView !== "undefined" && threeView?.ready) renderThreeView(state, true);
    }
    dispatchDragCancelled();
    if (typeof notifyApp === "function") notifyApp(`${label} 취소`);
  }

  function cancelActiveDirectEdit() {
    if (typeof keyBadgeDrag !== "undefined" && keyBadgeDrag) {
      const active = keyBadgeDrag;
      keyBadgeDrag = null;
      if (typeof keyBadgePress !== "undefined" && keyBadgePress?.timer) window.clearTimeout(keyBadgePress.timer);
      if (typeof keyBadgePress !== "undefined") keyBadgePress = null;
      if (typeof pathSnapGuide !== "undefined") pathSnapGuide = null;
      restoreEditSnapshot(active.startState, "키프레임 이동", stageCanvas, active.pointerId);
      return true;
    }
    if (typeof keyBadgePress !== "undefined" && keyBadgePress) {
      const active = keyBadgePress;
      if (active.timer) window.clearTimeout(active.timer);
      keyBadgePress = null;
      try { stageCanvas?.releasePointerCapture?.(active.pointerId); } catch { /* No capture. */ }
      dispatchDragCancelled();
      return true;
    }
    if (typeof curveHandleDrag !== "undefined" && curveHandleDrag) {
      const active = curveHandleDrag;
      curveHandleDrag = null;
      if (typeof pathSnapGuide !== "undefined") pathSnapGuide = null;
      restoreEditSnapshot(active.startState, "곡선 핸들 이동", stageCanvas, active.pointerId);
      return true;
    }
    if (typeof drag !== "undefined" && drag) {
      const active = drag;
      drag = null;
      restoreEditSnapshot(active.startState, active.selection?.kind === "camera" ? "카메라 이동" : "대상 이동", stageCanvas, active.pointerId);
      return true;
    }
    if (typeof threeDrag !== "undefined" && threeDrag && ["edit", "pose"].includes(threeDrag.kind)) {
      const active = threeDrag;
      threeDrag = null;
      restoreEditSnapshot(active.startState, active.kind === "pose" ? "포즈 편집" : "3D 이동", threeCanvas, active.pointerId);
      return true;
    }
    return false;
  }

  function activeDirectEditExists() {
    return Boolean(
      (typeof drag !== "undefined" && drag && !drag.pending)
      || (typeof threeDrag !== "undefined" && threeDrag && ["edit", "pose"].includes(threeDrag.kind) && !threeDrag.pending)
      || (typeof keyBadgeDrag !== "undefined" && keyBadgeDrag)
      || (typeof curveHandleDrag !== "undefined" && curveHandleDrag)
    );
  }

  const updateDragHint = () => canvasWrap?.classList.toggle("is-direct-editing", activeDirectEditExists());
  [stageCanvas, threeCanvas].filter(Boolean).forEach((target) => {
    target.addEventListener("pointermove", updateDragHint);
    target.addEventListener("pointerup", () => requestAnimationFrame(updateDragHint));
    target.addEventListener("pointercancel", () => requestAnimationFrame(updateDragHint));
  });
  document.addEventListener("frisframe:drag-cancelled", updateDragHint);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && cancelActiveDirectEdit()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      updateDragHint();
      return;
    }
    if (isTypingTarget(event.target) || document.querySelector("dialog[open]")) return;

    if (event.ctrlKey && !event.metaKey && !event.altKey && event.key.toLowerCase() === "y") {
      if (typeof redo === "function") redo();
      event.preventDefault();
      event.stopImmediatePropagation();
      requestAnimationFrame(updateHistoryTooltips);
      return;
    }

    if (!event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "l") {
      if (toggleSelectedLock()) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }
  }, true);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "hidden") return;
    try {
      if (typeof projectSaveStatus !== "undefined"
        && projectSaveStatus === "changed"
        && typeof managedProjectId !== "undefined"
        && managedProjectId
        && typeof managedSaveInFlight !== "undefined"
        && !managedSaveInFlight
        && typeof managedSaveConflict !== "undefined"
        && !managedSaveConflict
        && typeof saveManagedProject === "function") {
        saveManagedProject({ interactive: false });
      }
    } catch (_error) {
      // Normal autosave/recovery remains the fallback.
    }
  });
})();
