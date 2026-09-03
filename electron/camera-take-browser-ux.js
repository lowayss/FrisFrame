(() => {
  "use strict";

  if (document.documentElement.dataset.frisframeCameraTakeBrowserUx === "1") return;
  document.documentElement.dataset.frisframeCameraTakeBrowserUx = "1";

  const DISPLAY_LIMIT = 5;
  let box = null;
  let body = null;
  let countNode = null;
  let autoButton = null;
  let lastFingerprint = "";

  const cloneValue = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const operator = () => window.FrisFrameCameraOperator;

  function motionState() {
    state.motion = state.motion || {};
    return state.motion;
  }

  function takes() {
    const values = motionState().cameraOperatorTakes;
    if (!Array.isArray(values)) return [];
    return values.filter((entry) => entry && typeof entry === "object" && String(entry.id || "").trim());
  }

  function latestTakeId() {
    return String(motionState().latestCameraOperatorTakeId || "").trim();
  }

  function persistedSelectedTakeId() {
    return String(motionState().selectedCameraOperatorTakeId || "").trim();
  }

  function validTakeId(value) {
    const id = String(value || "").trim();
    return id && takes().some((entry) => String(entry.id) === id) ? id : "";
  }

  function effectiveTakeId() {
    const values = takes();
    const selected = validTakeId(persistedSelectedTakeId());
    if (selected) return selected;
    const latest = validTakeId(latestTakeId());
    if (latest) return latest;
    return values.length ? String(values.at(-1).id) : "";
  }

  function saveSelection(nextId) {
    if (operator()?.mode && operator().mode !== "idle") {
      if (typeof notifyApp === "function") notifyApp("Physical Camera 촬영이 끝난 뒤 AI Take를 선택하세요.");
      return false;
    }
    const motion = motionState();
    const previous = persistedSelectedTakeId();
    const next = String(nextId || "").trim();
    if (next && !validTakeId(next)) return false;
    if (previous === next) return true;

    if (next) motion.selectedCameraOperatorTakeId = next;
    else delete motion.selectedCameraOperatorTakeId;

    if (typeof commit === "function") commit({ preserveSourceIds:["camera"] });
    lastFingerprint = "";
    render();
    return true;
  }

  function selectTake(id) {
    const selected = validTakeId(id);
    if (!selected) return false;
    const changed = saveSelection(selected);
    if (changed && typeof notifyApp === "function") notifyApp(`Physical Camera AI Take 선택 · ${shortId(selected)}`);
    return changed;
  }

  function clearSelection() {
    const changed = saveSelection("");
    if (changed && typeof notifyApp === "function") notifyApp("Physical Camera AI Take · 최신 Take 자동 선택");
    return changed;
  }

  function shortId(value) {
    const id = String(value || "");
    return id.length > 18 ? `${id.slice(0, 10)}…${id.slice(-5)}` : id;
  }

  function percentage(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return "—";
    return `${Math.round(Math.max(0, Math.min(1, numeric)) * 100)}%`;
  }

  function durationText(take) {
    const direct = Number(take?.duration);
    if (Number.isFinite(direct)) return `${Math.max(0, direct).toFixed(2)}s`;
    const start = Number(take?.startTime);
    const end = Number(take?.endTime);
    return Number.isFinite(start) && Number.isFinite(end) ? `${Math.max(0, end - start).toFixed(2)}s` : "—";
  }

  function trackingLabel(take) {
    const tracking = take?.tracking || {};
    if (tracking.metric === true && tracking.mode === "webxr") return "XR · METRIC";
    if (tracking.mode === "mixed") return "MIXED · RELATIVE";
    return "VISUAL · RELATIVE";
  }

  function heldRatio(take) {
    const tracking = take?.tracking || {};
    const samples = Number(tracking.samples || 0);
    const held = Number(tracking.heldTranslationSamples || 0);
    if (!(samples > 0)) return 0;
    return Math.max(0, Math.min(1, held / samples));
  }

  function copyPayload(take) {
    return {
      tool:"get_camera_take_context",
      arguments:{ take_id:String(take?.id || "") },
      source:take?.source || "physical-camera",
      tracking:cloneValue(take?.tracking || null),
      stabilization:take?.stabilization || null,
      prompt_seed:take?.promptSeed || null,
      prompt_policy:cloneValue(take?.promptPolicy || null),
    };
  }

  async function copyTakeInfo(id) {
    const take = takes().find((entry) => String(entry.id) === String(id));
    if (!take || !navigator.clipboard?.writeText) return false;
    try {
      await navigator.clipboard.writeText(JSON.stringify(copyPayload(take), null, 2));
      if (typeof notifyApp === "function") notifyApp(`MCP Take 정보를 복사했습니다 · ${shortId(take.id)}`);
      return true;
    } catch {
      if (typeof notifyApp === "function") notifyApp("클립보드 권한이 없어 MCP Take 정보를 복사하지 못했습니다.");
      return false;
    }
  }

  function createText(className, text) {
    const node = document.createElement("div");
    if (className) node.className = className;
    node.textContent = text;
    return node;
  }

  function makeBadge(text, className = "") {
    const badge = document.createElement("span");
    badge.className = `frisframe-camera-take-badge ${className}`.trim();
    badge.textContent = text;
    return badge;
  }

  function makeTakeCard(take, recordIndex, explicitSelected, effectiveId, latestId, locked) {
    const id = String(take.id);
    const tracking = take.tracking || {};
    const card = document.createElement("div");
    card.className = "frisframe-camera-take-card";
    if (id === effectiveId) card.classList.add("is-effective");
    if (id === explicitSelected) card.classList.add("is-selected");

    const head = document.createElement("div");
    head.className = "frisframe-camera-take-card-head";
    const title = document.createElement("b");
    title.textContent = `TAKE ${recordIndex + 1} · ${shortId(id)}`;
    head.appendChild(title);
    const badges = document.createElement("div");
    badges.className = "frisframe-camera-take-badges";
    if (id === latestId) badges.appendChild(makeBadge("LATEST", "is-latest"));
    if (id === explicitSelected) badges.appendChild(makeBadge("AI SELECTED", "is-selected"));
    else if (!explicitSelected && id === effectiveId) badges.appendChild(makeBadge("AI AUTO", "is-auto"));
    head.appendChild(badges);
    card.appendChild(head);

    card.appendChild(createText(
      "frisframe-camera-take-meta",
      `${trackingLabel(take)} · ${(take.stabilization || "handheld").toUpperCase()} · ${durationText(take)} · CONF ${percentage(tracking.confidence?.average)} · HOLD ${percentage(heldRatio(take))}`,
    ));

    const seed = createText("frisframe-camera-take-seed", take.promptSeed || "Prompt seed 없음");
    seed.title = take.promptSeed || "";
    card.appendChild(seed);

    const actions = document.createElement("div");
    actions.className = "frisframe-camera-take-actions";
    const select = document.createElement("button");
    select.type = "button";
    select.textContent = id === explicitSelected ? "AI 사용 중" : "AI 사용";
    select.disabled = locked || id === explicitSelected;
    select.addEventListener("click", () => selectTake(id));
    actions.appendChild(select);

    const copy = document.createElement("button");
    copy.type = "button";
    copy.textContent = "MCP 정보 복사";
    copy.addEventListener("click", () => copyTakeInfo(id));
    actions.appendChild(copy);
    card.appendChild(actions);
    return card;
  }

  function fingerprint() {
    const motion = motionState();
    const values = takes();
    return JSON.stringify({
      ids:values.map((take) => [take.id, take.createdAt, take.duration, take.stabilization, take.tracking?.mode, take.tracking?.metric, take.tracking?.confidence?.average, take.tracking?.heldTranslationSamples, take.tracking?.samples, take.promptSeed]),
      latest:motion.latestCameraOperatorTakeId || "",
      selected:motion.selectedCameraOperatorTakeId || "",
      operatorMode:operator()?.mode || "idle",
    });
  }

  function ensureUi() {
    const panel = document.querySelector(".frisframe-phone-pairing");
    if (!panel) return false;
    if (box?.isConnected) return true;

    box = document.createElement("div");
    box.dataset.frisframeCameraTakeBrowser = "1";
    box.className = "frisframe-camera-take-browser";
    const head = document.createElement("div");
    head.className = "frisframe-camera-take-browser-head";
    const title = document.createElement("b");
    title.textContent = "🎬 PHYSICAL TAKES";
    countNode = document.createElement("span");
    head.append(title, countNode);
    box.appendChild(head);

    const toolbar = document.createElement("div");
    toolbar.className = "frisframe-camera-take-toolbar";
    toolbar.appendChild(createText("frisframe-camera-take-note", "AI 선택이 없으면 최신 Take를 자동 사용합니다."));
    autoButton = document.createElement("button");
    autoButton.type = "button";
    autoButton.textContent = "최신 자동";
    autoButton.addEventListener("click", clearSelection);
    toolbar.appendChild(autoButton);
    box.appendChild(toolbar);

    body = document.createElement("div");
    body.className = "frisframe-camera-take-list";
    box.appendChild(body);
    panel.appendChild(box);
    return true;
  }

  function render() {
    if (!ensureUi() || !body || !countNode) return;
    const nextFingerprint = fingerprint();
    if (nextFingerprint === lastFingerprint) return;
    lastFingerprint = nextFingerprint;

    const values = takes();
    const explicitSelected = validTakeId(persistedSelectedTakeId());
    const effectiveId = effectiveTakeId();
    const latestId = validTakeId(latestTakeId());
    const locked = Boolean(operator()?.mode && operator().mode !== "idle");
    countNode.textContent = values.length ? `${values.length} TAKE${values.length === 1 ? "" : "S"}` : "EMPTY";
    if (autoButton) {
      autoButton.disabled = locked || !persistedSelectedTakeId();
      autoButton.classList.toggle("is-active", !explicitSelected);
    }
    body.replaceChildren();

    if (!values.length) {
      body.appendChild(createText("frisframe-camera-take-empty", "Physical Camera Take를 촬영하면 여기에 기록됩니다."));
      return;
    }

    const start = Math.max(0, values.length - DISPLAY_LIMIT);
    for (let index = values.length - 1; index >= start; index -= 1) {
      body.appendChild(makeTakeCard(values[index], index, explicitSelected, effectiveId, latestId, locked));
    }
    if (values.length > DISPLAY_LIMIT) {
      body.appendChild(createText("frisframe-camera-take-more", `최근 ${DISPLAY_LIMIT}개 표시 · 전체 ${values.length}개는 MCP list_camera_takes에서 조회`));
    }
  }

  const style = document.createElement("style");
  style.textContent = `
    .frisframe-camera-take-browser{display:grid;gap:6px;padding-top:7px;border-top:1px solid rgba(255,255,255,.07)}
    .frisframe-camera-take-browser-head,.frisframe-camera-take-toolbar,.frisframe-camera-take-card-head,.frisframe-camera-take-actions{display:flex;align-items:center;gap:6px}
    .frisframe-camera-take-browser-head{justify-content:space-between;font-size:9px;color:#d9e1e8}.frisframe-camera-take-browser-head span{font-size:7px;color:#7f8a94}
    .frisframe-camera-take-toolbar{justify-content:space-between}.frisframe-camera-take-note{font-size:7px;color:#7e8993;line-height:1.3}.frisframe-camera-take-toolbar button,.frisframe-camera-take-actions button{min-height:22px;padding:0 6px;border:1px solid rgba(255,255,255,.1);border-radius:5px;background:rgba(255,255,255,.025);color:#9aa5af;font-size:7px;font-weight:850}.frisframe-camera-take-toolbar button.is-active{border-color:rgba(126,217,255,.42);color:#a8e8ff}.frisframe-camera-take-toolbar button:disabled,.frisframe-camera-take-actions button:disabled{opacity:.45}
    .frisframe-camera-take-list{display:grid;gap:5px}.frisframe-camera-take-card{display:grid;gap:4px;padding:6px;border:1px solid rgba(255,255,255,.07);border-radius:6px;background:rgba(255,255,255,.018)}.frisframe-camera-take-card.is-effective{border-color:rgba(126,217,255,.24)}.frisframe-camera-take-card.is-selected{background:rgba(126,217,255,.045);border-color:rgba(126,217,255,.5)}
    .frisframe-camera-take-card-head{justify-content:space-between;min-width:0}.frisframe-camera-take-card-head b{font-size:8px;color:#cdd6dd;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.frisframe-camera-take-badges{display:flex;gap:3px;flex:none}.frisframe-camera-take-badge{font-size:6px;padding:2px 3px;border-radius:3px;border:1px solid rgba(255,255,255,.1);color:#89949e}.frisframe-camera-take-badge.is-latest{color:#9ce3af;border-color:rgba(156,227,175,.35)}.frisframe-camera-take-badge.is-selected{color:#7ed9ff;border-color:rgba(126,217,255,.45)}.frisframe-camera-take-badge.is-auto{color:#ffca88;border-color:rgba(255,202,136,.4)}
    .frisframe-camera-take-meta{font-size:7px;color:#87939d;line-height:1.35}.frisframe-camera-take-seed{font-size:7px;color:#b5bec6;line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.frisframe-camera-take-actions{justify-content:flex-end}.frisframe-camera-take-actions button:first-child:not(:disabled){color:#a8e8ff;border-color:rgba(126,217,255,.35)}
    .frisframe-camera-take-empty,.frisframe-camera-take-more{padding:6px;font-size:7px;color:#77828c;line-height:1.35;text-align:center}
  `;
  document.head.appendChild(style);

  setInterval(render, 500);
  render();

  window.FrisFrameCameraTakeBrowser = Object.freeze({
    get takes() { return cloneValue(takes()); },
    get latestTakeId() { return latestTakeId() || null; },
    get selectedTakeId() { return validTakeId(persistedSelectedTakeId()) || null; },
    get effectiveTakeId() { return effectiveTakeId() || null; },
    selectTake,
    clearSelection,
    copyTakeInfo,
    refresh:render,
  });
})();
