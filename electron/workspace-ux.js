(() => {
  "use strict";

  if (document.documentElement.dataset.frisframeWorkspaceUx === "1") return;
  document.documentElement.dataset.frisframeWorkspaceUx = "1";

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
    /* Workspace shell: storyboard -> blocking -> export. */
    .workspace-nav.frisframe-workspace-nav {
      gap: 7px;
    }
    #storyboardBtn.frisframe-storyboard-entry span {
      font-weight: 850;
    }
    #blockingBtn.frisframe-blocking-entry span {
      font-weight: 850;
    }
    .frisframe-view-dock {
      position: absolute;
      top: 10px;
      left: 10px;
      z-index: 45;
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 5px;
      border: 1px solid rgba(255,255,255,.08);
      border-radius: 9px;
      background: rgba(17,19,22,.84);
      box-shadow: 0 8px 24px rgba(0,0,0,.18);
      backdrop-filter: blur(10px);
    }
    .frisframe-view-dock::before {
      content: "보기";
      padding-left: 4px;
      color: #737a83;
      font-size: 9px;
      font-weight: 800;
      letter-spacing: .04em;
    }
    .frisframe-view-dock #viewButtons {
      display: inline-flex !important;
      margin: 0 !important;
    }
    .frisframe-primary-export > summary {
      border-color: rgba(255,107,85,.34) !important;
      color: #fff !important;
      background: rgba(255,107,85,.14) !important;
      font-weight: 850 !important;
    }
    .frisframe-primary-export > summary:hover {
      background: rgba(255,107,85,.2) !important;
    }
    .frisframe-export-popover #videoBtn {
      width: 100%;
      min-height: 38px;
      justify-content: flex-start;
      margin-bottom: 4px;
    }
    .frisframe-export-popover #videoBtn span {
      font-weight: 900;
    }
    .frisframe-export-advanced,
    .frisframe-project-advanced {
      margin-top: 5px;
      border-top: 1px solid rgba(255,255,255,.07);
      padding-top: 5px;
    }
    .frisframe-export-advanced > summary,
    .frisframe-project-advanced > summary {
      display: flex;
      align-items: center;
      justify-content: space-between;
      min-height: 30px;
      padding: 0 8px;
      border-radius: 6px;
      color: #858c95;
      cursor: pointer;
      list-style: none;
      font-size: 10px;
      font-weight: 800;
    }
    .frisframe-export-advanced > summary::-webkit-details-marker,
    .frisframe-project-advanced > summary::-webkit-details-marker { display: none; }
    .frisframe-export-advanced > summary::after,
    .frisframe-project-advanced > summary::after {
      content: "›";
      font-size: 15px;
      transition: transform .12s ease;
    }
    .frisframe-export-advanced[open] > summary::after,
    .frisframe-project-advanced[open] > summary::after { transform: rotate(90deg); }
    .frisframe-export-advanced-body,
    .frisframe-project-advanced-body {
      display: grid;
      gap: 3px;
      padding-top: 4px;
    }
    .frisframe-export-advanced .export-range-tools {
      margin: 0 !important;
    }

    /* Left rail: common work first, secondary controls on demand. */
    .frisframe-quick-create {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 6px;
      margin: 7px 0 9px;
      padding: 6px;
      border: 1px solid rgba(255,255,255,.07);
      border-radius: 8px;
      background: rgba(255,255,255,.025);
    }
    .frisframe-quick-create button {
      min-height: 30px;
      padding: 0 8px;
      border-color: rgba(255,255,255,.1);
      font-size: 11px;
      font-weight: 850;
    }
    .frisframe-quick-create button:first-child {
      border-color: rgba(255,107,85,.34);
    }
    .frisframe-panel-count {
      margin-left: auto;
      margin-right: 5px;
      color: #777e87;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0;
    }
    .frisframe-secondary-disclosure {
      margin-top: 8px;
      border: 0;
    }
    .frisframe-secondary-disclosure > summary {
      display: flex;
      align-items: center;
      gap: 6px;
      min-height: 28px;
      padding: 0 7px;
      border: 1px solid rgba(255,255,255,.08);
      border-radius: 6px;
      color: #a9b0b8;
      background: rgba(255,255,255,.02);
      cursor: pointer;
      list-style: none;
      font-size: 10px;
      font-weight: 800;
      user-select: none;
    }
    .frisframe-secondary-disclosure > summary::-webkit-details-marker { display: none; }
    .frisframe-secondary-disclosure > summary::before {
      content: "›";
      font-size: 15px;
      line-height: 1;
      transition: transform .12s ease;
    }
    .frisframe-secondary-disclosure[open] > summary::before { transform: rotate(90deg); }
    .frisframe-secondary-disclosure > summary span {
      margin-left: auto;
      color: #686f78;
      font-size: 9px;
      font-weight: 600;
    }
    .frisframe-secondary-body {
      display: grid;
      gap: 8px;
      margin-top: 7px;
      padding: 8px;
      border: 1px solid rgba(255,255,255,.06);
      border-radius: 7px;
      background: rgba(0,0,0,.08);
    }
    .frisframe-secondary-body .camera-rig-panel,
    .frisframe-secondary-body .lock-control-group,
    .frisframe-secondary-body .space-preset-block {
      margin: 0 !important;
    }
    #actorForm.frisframe-compact-add {
      grid-template-columns: minmax(0, 1fr) 34px !important;
      gap: 5px !important;
    }
    #propForm.frisframe-compact-add { gap: 5px !important; }
    #actorForm.frisframe-compact-add button,
    #propForm.frisframe-compact-add button {
      min-width: 34px;
      padding: 0 7px;
    }
    #actorName,
    #propName { min-width: 0; }

    /* Properties: everyday controls first, advanced controls folded. */
    #propertiesPanel > summary .frisframe-selection-kind {
      margin-left: auto;
      margin-right: 5px;
      padding: 2px 6px;
      border: 1px solid rgba(255,255,255,.08);
      border-radius: 999px;
      color: #8d949d;
      background: rgba(255,255,255,.025);
      font-size: 9px;
      font-weight: 800;
    }
    #propertiesForm.frisframe-properties-polished { gap: 7px; }
    .frisframe-properties-polished > .stack-field:first-of-type { margin-top: 1px; }
    .frisframe-properties-polished .frisframe-property-actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 5px;
      margin-top: 2px;
    }
    .frisframe-properties-polished .frisframe-property-actions button { min-height: 30px; }
    .frisframe-properties-polished .frisframe-property-advanced,
    .frisframe-properties-polished .frisframe-pose-disclosure { margin-top: 1px; }
    .frisframe-properties-polished .frisframe-property-advanced .frisframe-secondary-body,
    .frisframe-properties-polished .frisframe-pose-disclosure .frisframe-secondary-body { padding: 7px; }
    .frisframe-properties-polished .frisframe-property-advanced .mini-details,
    .frisframe-properties-polished .frisframe-property-advanced .property-subgroup,
    .frisframe-properties-polished .frisframe-pose-disclosure .actor-pose-editor { margin: 0 !important; }
    .frisframe-properties-polished .frisframe-property-advanced .property-subgroup + .property-subgroup { margin-top: 2px !important; }
    .frisframe-properties-core-hint {
      margin: -2px 1px 1px;
      color: #686f78;
      font-size: 9px;
      line-height: 1.35;
    }
    .frisframe-pose-disclosure[hidden] { display: none !important; }

    @media (max-width: 920px) {
      .frisframe-view-dock::before { display: none; }
    }
    @media (prefers-reduced-motion: reduce) {
      .frisframe-secondary-disclosure > summary::before,
      .frisframe-export-advanced > summary::after,
      .frisframe-project-advanced > summary::after { transition: none !important; }
    }
  `;
  document.head.append(style);

  const rememberDisclosure = (details, key, defaultOpen = false) => {
    if (!details) return;
    const stored = safeStorage.get(key);
    details.open = stored === "1" ? true : stored === "0" ? false : defaultOpen;
    details.addEventListener("toggle", () => safeStorage.set(key, details.open ? "1" : "0"));
  };

  const storyboardBtn = document.getElementById("storyboardBtn");
  const storyboardScreen = document.getElementById("storyboardScreen");
  const workspaceNav = document.querySelector(".workspace-nav");
  const viewButtons = document.getElementById("viewButtons");
  const canvasWrap = document.querySelector(".canvas-wrap");
  let blockingBtn = null;

  const ensureBlockingWorkspace = () => {
    if (!storyboardScreen || storyboardScreen.hidden) return;
    const activeView = viewButtons?.querySelector("button.is-active") || viewButtons?.querySelector('button[data-view="2d"]');
    activeView?.click();
  };

  const syncWorkspaceState = () => {
    const storyboardActive = Boolean(storyboardScreen && !storyboardScreen.hidden);
    document.documentElement.classList.toggle("frisframe-storyboard-active", storyboardActive);
    blockingBtn?.classList.toggle("is-active", !storyboardActive);
    blockingBtn?.setAttribute("aria-current", storyboardActive ? "false" : "page");
  };

  if (workspaceNav && !workspaceNav.querySelector("#blockingBtn")) {
    workspaceNav.classList.add("frisframe-workspace-nav");
    storyboardBtn?.classList.add("frisframe-storyboard-entry");
    const storyboardLabel = document.getElementById("storyboardBtnLabel");
    if (storyboardLabel) storyboardLabel.textContent = "스토리";
    blockingBtn = document.createElement("button");
    blockingBtn.id = "blockingBtn";
    blockingBtn.type = "button";
    blockingBtn.className = "workspace-tab frisframe-blocking-entry";
    blockingBtn.title = "블로킹 작업";
    blockingBtn.innerHTML = "<span>블로킹</span>";
    blockingBtn.addEventListener("click", () => {
      ensureBlockingWorkspace();
      requestAnimationFrame(syncWorkspaceState);
    });
    const divider = workspaceNav.querySelector(".workspace-divider");
    if (divider) divider.replaceWith(blockingBtn);
    else workspaceNav.prepend(blockingBtn);
  }

  if (canvasWrap && viewButtons && !canvasWrap.querySelector(".frisframe-view-dock")) {
    const viewDock = document.createElement("div");
    viewDock.className = "frisframe-view-dock";
    viewDock.setAttribute("aria-label", "무대 보기 방식");
    viewDock.append(viewButtons);
    canvasWrap.prepend(viewDock);
  }

  storyboardBtn?.addEventListener("click", () => requestAnimationFrame(syncWorkspaceState));
  viewButtons?.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => requestAnimationFrame(syncWorkspaceState));
  });
  if (storyboardScreen) {
    new MutationObserver(syncWorkspaceState).observe(storyboardScreen, { attributes: true, attributeFilter: ["hidden"] });
  }
  syncWorkspaceState();

  const exportMenu = document.getElementById("exportMenu");
  const exportPopover = exportMenu?.querySelector(".toolbar-menu-popover");
  const exportSummaryLabel = exportMenu?.querySelector(":scope > summary span");
  const videoBtn = document.getElementById("videoBtn");
  const frameBtn = document.getElementById("frameBtn");
  const framePairBtn = document.getElementById("framePairBtn");
  const exportRangeTools = document.getElementById("exportRangeTools");
  if (exportMenu && exportPopover) {
    exportMenu.classList.add("frisframe-primary-export");
    exportPopover.classList.add("frisframe-export-popover");
    if (exportSummaryLabel) exportSummaryLabel.textContent = "프리비즈 출력";
    const videoLabel = videoBtn?.querySelector("span");
    if (videoLabel) videoLabel.textContent = "프리비즈 MP4 만들기";
    const frameLabel = frameBtn?.querySelector("span");
    if (frameLabel) frameLabel.textContent = "현재 프레임";
    const pairLabel = framePairBtn?.querySelector("span");
    if (pairLabel) pairLabel.textContent = "시작 · 끝 프레임";
    if (videoBtn) exportPopover.prepend(videoBtn);

    if (exportRangeTools && !exportPopover.querySelector(".frisframe-export-advanced")) {
      const advanced = document.createElement("details");
      advanced.className = "frisframe-export-advanced";
      advanced.innerHTML = '<summary>출력 구간 · 고급 설정</summary><div class="frisframe-export-advanced-body"></div>';
      advanced.querySelector(".frisframe-export-advanced-body")?.append(exportRangeTools);
      exportPopover.append(advanced);
      rememberDisclosure(advanced, "frisframe.ui.exportAdvanced", false);
    }
  }

  const projectMenu = document.getElementById("projectMenu");
  const projectPopover = projectMenu?.querySelector(".toolbar-menu-popover");
  const backupBtn = document.getElementById("backupBtn");
  const importBtn = document.getElementById("importBtn");
  const importInput = document.getElementById("importInput");
  const shareBtn = document.getElementById("shareBtn");
  if (projectPopover && !projectPopover.querySelector(".frisframe-project-advanced")) {
    const advanced = document.createElement("details");
    advanced.className = "frisframe-project-advanced";
    advanced.innerHTML = '<summary>백업 · 공유</summary><div class="frisframe-project-advanced-body"></div>';
    const body = advanced.querySelector(".frisframe-project-advanced-body");
    [backupBtn, importBtn, shareBtn, importInput].forEach((node) => {
      if (node) body?.append(node);
    });
    projectPopover.append(advanced);
    rememberDisclosure(advanced, "frisframe.ui.projectAdvanced", false);
  }

  const actorForm = document.getElementById("actorForm");
  const propForm = document.getElementById("propForm");
  const actorPanel = actorForm?.closest("details");
  const propPanel = propForm?.closest("details");
  const actorList = document.getElementById("actorList");
  const propList = document.getElementById("propList");
  const stagePanel = document.querySelector(".left-panel > details:first-of-type");

  actorForm?.classList.add("frisframe-compact-add");
  propForm?.classList.add("frisframe-compact-add");
  const actorName = document.getElementById("actorName");
  const propName = document.getElementById("propName");
  if (actorName) actorName.placeholder = "배우 이름";
  if (propName) propName.placeholder = "소품 이름";

  const installCountBadge = (panel, list, label) => {
    const summary = panel?.querySelector(":scope > summary");
    if (!summary || !list || summary.querySelector(".frisframe-panel-count")) return;
    const badge = document.createElement("small");
    badge.className = "frisframe-panel-count";
    badge.setAttribute("aria-label", `${label} 개수`);
    const update = () => {
      const count = [...list.children].filter((child) => !child.hidden).length;
      badge.textContent = `${count}`;
    };
    summary.append(badge);
    update();
    new MutationObserver(update).observe(list, { childList: true, subtree: false, attributes: true, attributeFilter: ["hidden"] });
  };
  installCountBadge(actorPanel, actorList, "배우");
  installCountBadge(propPanel, propList, "소품");

  if (actorPanel && propPanel && actorForm && propForm && !document.querySelector(".frisframe-quick-create")) {
    const quick = document.createElement("div");
    quick.className = "frisframe-quick-create";
    quick.setAttribute("aria-label", "빠른 오브젝트 추가");

    const actorButton = document.createElement("button");
    actorButton.type = "button";
    actorButton.textContent = "배우 +";
    actorButton.title = "기본 이름으로 배우를 바로 추가";
    actorButton.addEventListener("click", () => actorForm.requestSubmit());

    const propButton = document.createElement("button");
    propButton.type = "button";
    propButton.textContent = "소품 +";
    propButton.title = "현재 선택된 소품 유형을 바로 추가";
    propButton.addEventListener("click", () => propForm.requestSubmit());

    quick.append(actorButton, propButton);
    actorPanel.parentElement?.insertBefore(quick, actorPanel);
  }

  const focalValue = document.getElementById("focalValue");
  const cameraPanel = focalValue?.closest("details");
  const cameraRig = cameraPanel?.querySelector(".camera-rig-panel");
  const cameraLocks = cameraPanel?.querySelector(".lock-control-group");
  if (cameraPanel && (cameraRig || cameraLocks) && !cameraPanel.querySelector(".frisframe-camera-secondary")) {
    const details = document.createElement("details");
    details.className = "frisframe-secondary-disclosure frisframe-camera-secondary";
    details.innerHTML = '<summary>카메라 세부 <span>멀티카메라 · 편집 잠금</span></summary><div class="frisframe-secondary-body"></div>';
    const body = details.querySelector(".frisframe-secondary-body");
    if (cameraRig) body?.append(cameraRig);
    if (cameraLocks) body?.append(cameraLocks);
    cameraPanel.append(details);
    rememberDisclosure(details, "frisframe.ui.cameraSecondary", false);
  }

  rememberDisclosure(stagePanel, "frisframe.ui.stagePanel", true);
  rememberDisclosure(cameraPanel, "frisframe.ui.cameraPanel", true);
  rememberDisclosure(actorPanel, "frisframe.ui.actorPanel", false);
  rememberDisclosure(propPanel, "frisframe.ui.propPanel", false);

  const spacePreset = propPanel?.querySelector(".space-preset-block");
  if (propPanel && spacePreset && !propPanel.querySelector(".frisframe-space-secondary")) {
    const details = document.createElement("details");
    details.className = "frisframe-secondary-disclosure frisframe-space-secondary";
    details.innerHTML = '<summary>공간 프리셋 <span>거실 · 주방 · 차량 등</span></summary><div class="frisframe-secondary-body"></div>';
    details.querySelector(".frisframe-secondary-body")?.append(spacePreset);
    propForm?.insertAdjacentElement("afterend", details);
    rememberDisclosure(details, "frisframe.ui.spacePresets", false);
  }

  const openPanelAndFocus = (panel, field) => {
    if (!panel || !field) return;
    panel.open = true;
    requestAnimationFrame(() => field.focus({ preventScroll: true }));
  };

  actorPanel?.querySelector(":scope > summary")?.addEventListener("dblclick", (event) => {
    event.preventDefault();
    openPanelAndFocus(actorPanel, actorName);
  });
  propPanel?.querySelector(":scope > summary")?.addEventListener("dblclick", (event) => {
    event.preventDefault();
    openPanelAndFocus(propPanel, propName);
  });

  const propertiesPanel = document.getElementById("propertiesPanel");
  const propertiesForm = document.getElementById("propertiesForm");
  if (propertiesPanel && propertiesForm && !propertiesForm.classList.contains("frisframe-properties-polished")) {
    propertiesForm.classList.add("frisframe-properties-polished");

    const summary = propertiesPanel.querySelector(":scope > summary");
    const kindBadge = document.createElement("small");
    kindBadge.className = "frisframe-selection-kind";
    kindBadge.textContent = "대상";
    summary?.append(kindBadge);

    const selectedName = document.getElementById("selectedName");
    const nameField = selectedName?.closest("label");
    const sizeField = document.getElementById("sizeValue")?.closest("label.range-row");
    const scaleReadout = document.getElementById("physicalScaleReadout");
    const actorElevation = document.getElementById("actorElevationField");
    const facingField = document.getElementById("facingValue")?.closest("label.range-row");
    const actorPoseFields = document.getElementById("actorPoseFields");
    const propSpecificFields = document.getElementById("propSpecificFields");
    const actorDummyField = document.getElementById("actorDummyField");
    const actorPlacementFields = document.getElementById("actorPlacementFields");
    const manualGroupFields = document.getElementById("manualGroupFields");
    const actorPitchField = document.getElementById("actorPitchField");
    const miniDetails = [...propertiesForm.querySelectorAll(":scope > details.mini-details")];
    const duplicateBtn = document.getElementById("duplicateBtn");
    const actionRow = duplicateBtn?.closest(".button-row");

    const coreHint = document.createElement("p");
    coreHint.className = "frisframe-properties-core-hint";
    coreHint.textContent = "자주 쓰는 값만 먼저 표시합니다. 나머지는 필요할 때 펼치세요.";
    if (nameField) nameField.insertAdjacentElement("afterend", coreHint);

    const advanced = document.createElement("details");
    advanced.className = "frisframe-secondary-disclosure frisframe-property-advanced";
    advanced.innerHTML = '<summary>세부 속성 <span>형태 · 탑승 · 묶음 · 정밀 이동</span></summary><div class="frisframe-secondary-body"></div>';
    const advancedBody = advanced.querySelector(".frisframe-secondary-body");
    miniDetails.forEach((node) => advancedBody?.append(node));
    [actorDummyField, propSpecificFields, actorPlacementFields, manualGroupFields, actorPitchField].forEach((node) => {
      if (node) advancedBody?.append(node);
    });
    propertiesForm.append(advanced);
    rememberDisclosure(advanced, "frisframe.ui.propertyAdvanced", false);

    const poseDisclosure = document.createElement("details");
    poseDisclosure.className = "frisframe-secondary-disclosure frisframe-pose-disclosure";
    poseDisclosure.innerHTML = '<summary>포즈 편집 <span>관절 · 프리셋 · 포즈 키</span></summary><div class="frisframe-secondary-body"></div>';
    if (actorPoseFields) poseDisclosure.querySelector(".frisframe-secondary-body")?.append(actorPoseFields);
    propertiesForm.append(poseDisclosure);
    rememberDisclosure(poseDisclosure, "frisframe.ui.poseDisclosure", false);

    if (actionRow) {
      actionRow.classList.add("frisframe-property-actions");
      propertiesForm.append(actionRow);
    }

    [nameField, coreHint, sizeField, scaleReadout, actorElevation, facingField].forEach((node) => {
      if (node) propertiesForm.insertBefore(node, advanced);
    });

    const syncPropertyContext = () => {
      const isProp = Boolean(propSpecificFields && !propSpecificFields.hidden);
      const isActor = Boolean(
        (actorDummyField && !actorDummyField.hidden)
        || (actorPoseFields && !actorPoseFields.hidden)
        || (actorPlacementFields && !actorPlacementFields.hidden),
      );
      kindBadge.textContent = isActor ? "배우" : isProp ? "소품" : "대상";
      poseDisclosure.hidden = !actorPoseFields || actorPoseFields.hidden;
      if (poseDisclosure.hidden) poseDisclosure.open = false;
    };
    syncPropertyContext();
    [actorDummyField, actorPoseFields, actorPlacementFields, propSpecificFields].forEach((node) => {
      if (node) new MutationObserver(syncPropertyContext).observe(node, { attributes: true, attributeFilter: ["hidden"] });
    });
  }
})();
