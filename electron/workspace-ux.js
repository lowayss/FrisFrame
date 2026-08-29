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
    .frisframe-quick-create {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 6px;
      margin: 8px 0 10px;
      padding: 7px;
      border: 1px solid rgba(255,255,255,.07);
      border-radius: 8px;
      background: rgba(255,255,255,.025);
    }
    .frisframe-quick-create button {
      min-height: 30px;
      padding: 0 8px;
      border-color: rgba(255,255,255,.1);
      font-size: 11px;
      font-weight: 800;
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
    #propForm.frisframe-compact-add {
      gap: 5px !important;
    }
    #actorForm.frisframe-compact-add button,
    #propForm.frisframe-compact-add button {
      min-width: 34px;
      padding: 0 7px;
    }
    #actorName,
    #propName {
      min-width: 0;
    }
    .frisframe-quick-create-help {
      grid-column: 1 / -1;
      margin: -1px 2px 0;
      color: #686f78;
      font-size: 9px;
      line-height: 1.35;
    }

    /* Properties: show the controls used on nearly every edit first. */
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
    #propertiesForm.frisframe-properties-polished {
      gap: 7px;
    }
    .frisframe-properties-polished > .stack-field:first-of-type {
      margin-top: 1px;
    }
    .frisframe-properties-polished .frisframe-property-actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 5px;
      margin-top: 2px;
    }
    .frisframe-properties-polished .frisframe-property-actions button {
      min-height: 30px;
    }
    .frisframe-properties-polished .frisframe-property-advanced,
    .frisframe-properties-polished .frisframe-pose-disclosure {
      margin-top: 1px;
    }
    .frisframe-properties-polished .frisframe-property-advanced .frisframe-secondary-body,
    .frisframe-properties-polished .frisframe-pose-disclosure .frisframe-secondary-body {
      padding: 7px;
    }
    .frisframe-properties-polished .frisframe-property-advanced .mini-details,
    .frisframe-properties-polished .frisframe-property-advanced .property-subgroup,
    .frisframe-properties-polished .frisframe-pose-disclosure .actor-pose-editor {
      margin: 0 !important;
    }
    .frisframe-properties-polished .frisframe-property-advanced .property-subgroup + .property-subgroup {
      margin-top: 2px !important;
    }
    .frisframe-properties-core-hint {
      margin: -2px 1px 1px;
      color: #686f78;
      font-size: 9px;
      line-height: 1.35;
    }
    .frisframe-pose-disclosure[hidden] { display: none !important; }

    @media (prefers-reduced-motion: reduce) {
      .frisframe-secondary-disclosure > summary::before { transition: none !important; }
    }
  `;
  document.head.append(style);

  const rememberDisclosure = (details, key, defaultOpen = false) => {
    if (!details) return;
    const stored = safeStorage.get(key);
    details.open = stored === "1" ? true : stored === "0" ? false : defaultOpen;
    details.addEventListener("toggle", () => safeStorage.set(key, details.open ? "1" : "0"));
  };

  const actorForm = document.getElementById("actorForm");
  const propForm = document.getElementById("propForm");
  const actorPanel = actorForm?.closest("details");
  const propPanel = propForm?.closest("details");
  const actorList = document.getElementById("actorList");
  const propList = document.getElementById("propList");

  actorForm?.classList.add("frisframe-compact-add");
  propForm?.classList.add("frisframe-compact-add");
  const actorName = document.getElementById("actorName");
  const propName = document.getElementById("propName");
  if (actorName) actorName.placeholder = "배우 이름 · 비우면 자동";
  if (propName) propName.placeholder = "소품 이름 · 비우면 자동";

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

    const help = document.createElement("div");
    help.className = "frisframe-quick-create-help";
    help.textContent = "빠르게 추가한 뒤 오른쪽 속성에서 이름·위치·크기를 바로 조정할 수 있습니다.";

    quick.append(actorButton, propButton, help);
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
    if (cameraRig) body.append(cameraRig);
    if (cameraLocks) body.append(cameraLocks);
    cameraPanel.append(details);
    rememberDisclosure(details, "frisframe.ui.cameraSecondary", false);
  }

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
    const deleteBtn = document.getElementById("deleteBtn");
    const actionRow = duplicateBtn?.closest(".button-row");

    const coreHint = document.createElement("p");
    coreHint.className = "frisframe-properties-core-hint";
    coreHint.textContent = "이름 · 크기 · 높이 · 방향은 바로 조정하고, 나머지는 세부 속성에서 엽니다.";
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

    // Keep the everyday controls before the disclosures even if the original DOM changes later.
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
