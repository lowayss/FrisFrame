(function initReferenceWorkflowCore(root, factory) {
  const motionCore = typeof module === "object" && module.exports
    ? require("./motion-core.js")
    : root?.FrisFrameMotionCore;
  const api = factory(motionCore);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FrisFrameReferenceWorkflowCore = api;

  if (root?.document && typeof root.addEventListener === "function") {
    const install = () => {
      api.installBatchReferenceExportUi(root);
      api.installReferenceReadinessUi(root);
      api.installReferencePromptGuideUi(root);
    };
    if (root.document.readyState === "loading") root.addEventListener("DOMContentLoaded", install, { once: true });
    else root.setTimeout?.(install, 0);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createReferenceWorkflowCore(motionCore) {
  "use strict";
  motionCore = motionCore || {};

  const requiredMotionCore = [
    "cloneValue",
    "collectReferenceBatchCuts",
    "evaluateProjectReferenceReadiness",
    "evaluateReferenceReadiness",
    "partitionReferenceBatchByReadiness",
    "referenceEntryKey",
    "safeFileSlug",
  ];
  const missingMotionCore = requiredMotionCore.filter((name) => typeof motionCore?.[name] !== "function");
  if (missingMotionCore.length) {
    throw new Error(`FrisFrameMotionCore reference workflow planner is incomplete: ${missingMotionCore.join(", ")}`);
  }

  const SEEDANCE_REFERENCE_MAX_SECONDS = Number(motionCore.SEEDANCE_REFERENCE_MAX_SECONDS || 30);
  const {
    cloneValue,
    collectReferenceBatchCuts,
    evaluateProjectReferenceReadiness,
    evaluateReferenceReadiness,
    partitionReferenceBatchByReadiness,
    referenceEntryKey,
    safeFileSlug,
  } = motionCore;

  async function collectSingleReferenceVideo(target, entry) {
    if (typeof target.exportVideoForDocument !== "function") throw new Error("기존 MP4 내보내기 함수를 찾을 수 없습니다.");
    const originalPresentExport = target.presentExport;
    const originalPresentExportError = target.presentExportError;
    let captured = null;
    target.presentExport = (data, filename, label, preview) => { captured = { data, filename, label, preview }; };
    target.presentExportError = (message) => { throw new Error(String(message || "MP4 내보내기에 실패했습니다.")); };
    try {
      await target.exportVideoForDocument(cloneValue(entry.blocking), {
        progressOwner: "",
        filename: entry.filename,
        exportLabel: "Seedance 레퍼런스 H.264 MP4",
        cutLabel: `S${String(entry.sceneNumber).padStart(2, "0")} C${String(entry.cutNumber).padStart(2, "0")}`,
      });
      if (!captured?.data) throw new Error(`${entry.filename} 결과를 수집하지 못했습니다.`);
      return captured;
    } finally {
      target.presentExport = originalPresentExport;
      target.presentExportError = originalPresentExportError;
    }
  }

  function buildReferenceBatchManifest(project = {}, entries = []) {
    return {
      app: "FrisFrame",
      type: "seedance-reference-video-batch",
      projectTitle: project.title || "FrisFrame",
      generatedAt: new Date().toISOString(),
      policy: {
        previewExportEvaluator: "shared",
        actorSecondaryMotion: "authored-only",
        cameraPresets: "keyframe-macros-only",
      },
      cuts: entries.map((entry) => ({
        sceneId: entry.sceneId,
        cutId: entry.cutId,
        sceneNumber: entry.sceneNumber,
        cutNumber: entry.cutNumber,
        sceneHeading: entry.sceneHeading,
        title: entry.title,
        status: entry.status,
        file: `videos/${entry.filename}`,
        durationSeconds: entry.duration,
        fps: entry.fps,
        readiness: evaluateReferenceReadiness(entry.blocking, entry),
      })),
    };
  }

  async function exportReferenceVideoBatch(target, { confirmBeforeStart = true } = {}) {
    const required = ["managedProjectDocument", "exportVideoForDocument", "createZip", "presentExport"];
    const missing = required.filter((name) => typeof target?.[name] !== "function");
    if (missing.length) throw new Error(`일괄 출력 연결 함수가 없습니다: ${missing.join(", ")}`);
    const documentPayload = target.managedProjectDocument();
    const project = cloneValue(documentPayload?.project || {});
    const entries = collectReferenceBatchCuts(project);
    if (!entries.length) throw new Error("MP4로 출력할 컷이 없습니다.");
    const readiness = entries.map((entry) => evaluateReferenceReadiness(entry.blocking, entry));
    if (confirmBeforeStart && typeof target.confirm === "function") {
      const totalSeconds = entries.reduce((sum, entry) => sum + entry.duration, 0);
      const blocked = readiness.filter((result) => result.status === "blocked").length;
      const review = readiness.filter((result) => result.status === "review").length;
      const suffix = blocked || review ? `\nReadiness: 차단 ${blocked} · 검토 ${review}` : "";
      const accepted = target.confirm(`${entries.length}개 컷(${totalSeconds.toFixed(1)}초)을 순서대로 MP4로 만들고 ZIP으로 묶습니다.${suffix}\n계속할까요?`);
      if (!accepted) return { cancelled: true, entries: [] };
    }
    const files = [];
    const completedEntries = [];
    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];
      if (typeof target.notifyApp === "function") target.notifyApp(`레퍼런스 MP4 ${index + 1}/${entries.length} · ${entry.filename}`);
      const captured = await collectSingleReferenceVideo(target, entry);
      files.push({ path: `videos/${entry.filename}`, blob: captured.data });
      completedEntries.push(entry);
    }
    const manifest = buildReferenceBatchManifest(project, completedEntries);
    files.push({ path: "manifest.json", content: JSON.stringify(manifest, null, 2) });
    files.push({
      path: "README.md",
      content: [
        "# FrisFrame Seedance Reference Video Batch",
        "",
        "- `videos/`의 각 MP4는 컷별 키프레임 프리비즈 레퍼런스입니다.",
        "- 배우의 자동 보행·팔 흔들기·바운스 등 secondary motion은 추가하지 않습니다.",
        "- 카메라와 배우 root의 관계, 키 타이밍, 렌즈와 Tracking 의도를 레퍼런스로 사용합니다.",
        "- 컷 순서, FPS/길이, Readiness는 `manifest.json`을 확인합니다.",
        "",
      ].join("\n"),
    });
    const zip = await target.createZip(files);
    const zipName = `${safeFileSlug(project.title || "frisframe", "frisframe")}_seedance_reference_videos.zip`;
    const summary = `${completedEntries.length}개 컷 · 개별 H.264 MP4 · manifest.json`;
    target.presentExport(zip, zipName, "Seedance 레퍼런스 MP4 ZIP", {
      type: "text",
      text: `${summary}\n\n${completedEntries.map((entry) => {
        const result = evaluateReferenceReadiness(entry.blocking, entry);
        return `S${String(entry.sceneNumber).padStart(2, "0")} C${String(entry.cutNumber).padStart(2, "0")} · ${entry.title || "컷"} · ${entry.duration.toFixed(2)}초 · ${entry.fps}FPS · ${result.status.toUpperCase()} ${result.score}`;
      }).join("\n")}`,
    });
    if (typeof target.notifyApp === "function") target.notifyApp(`전체 레퍼런스 MP4 ${completedEntries.length}개를 ZIP으로 준비했습니다.`);
    return { cancelled: false, entries: completedEntries, manifest, zip, filename: zipName };
  }

  async function exportReferenceBatchSafely(target, { confirmBeforeStart = true } = {}) {
    if (!target || typeof target.managedProjectDocument !== "function") throw new Error("프로젝트 문서를 읽을 수 없습니다.");
    if (typeof target.createZip !== "function") throw new Error("ZIP 생성 함수를 찾을 수 없습니다.");

    const documentPayload = cloneValue(target.managedProjectDocument());
    const project = documentPayload?.project || {};
    const partition = partitionReferenceBatchByReadiness(project);
    if (!partition.allowed.length) {
      if (partition.blocked.length) throw new Error(`출력 가능한 컷이 없습니다. BLOCKED ${partition.blocked.length}개를 Reference Readiness에서 먼저 수정하세요.`);
      throw new Error("MP4로 출력할 컷이 없습니다.");
    }

    if (confirmBeforeStart && typeof target.confirm === "function") {
      const reviewCount = partition.allowed.filter((entry) => entry.readiness?.status === "review").length;
      const message = [
        `READY/REVIEW ${partition.allowed.length}개 컷을 MP4 ZIP으로 만듭니다.`,
        reviewCount ? `REVIEW ${reviewCount}개는 경고를 유지한 채 포함됩니다.` : "",
        partition.blocked.length ? `BLOCKED ${partition.blocked.length}개는 자동 제외되고 제외 사유가 ZIP에 기록됩니다.` : "",
        "계속할까요?",
      ].filter(Boolean).join("\n");
      if (!target.confirm(message)) return { cancelled: true, entries: [], skippedBlocked: partition.skippedBlocked };
    }

    const originalManagedProjectDocument = target.managedProjectDocument;
    const originalCreateZip = target.createZip;
    target.managedProjectDocument = () => ({
      ...cloneValue(documentPayload),
      project: cloneValue(partition.filteredProject),
    });
    target.createZip = async (files) => {
      const nextFiles = (files || []).map((file) => {
        if (file?.path !== "manifest.json" || typeof file.content !== "string") return file;
        try {
          const manifest = JSON.parse(file.content);
          manifest.batchPolicy = { blockedCuts: "skipped-by-default" };
          manifest.skippedBlocked = cloneValue(partition.skippedBlocked);
          return { ...file, content: JSON.stringify(manifest, null, 2) };
        } catch {
          return file;
        }
      });
      if (partition.skippedBlocked.length) {
        nextFiles.push({
          path: "skipped_blocked.json",
          content: JSON.stringify({ skippedBlocked: partition.skippedBlocked }, null, 2),
        });
      }
      return originalCreateZip.call(target, nextFiles);
    };

    try {
      const result = await exportReferenceVideoBatch(target, { confirmBeforeStart: false });
      if (typeof target.notifyApp === "function" && partition.skippedBlocked.length) {
        target.notifyApp(`레퍼런스 ZIP에서 BLOCKED ${partition.skippedBlocked.length}개 컷을 제외했습니다. skipped_blocked.json에서 사유를 확인하세요.`);
      }
      return { ...result, skippedBlocked: partition.skippedBlocked };
    } finally {
      target.managedProjectDocument = originalManagedProjectDocument;
      target.createZip = originalCreateZip;
    }
  }

  function installBatchReferenceExportUi(target) {
    const documentObject = target?.document;
    if (!documentObject || typeof documentObject.querySelector !== "function" || typeof documentObject.createElement !== "function") return false;
    if (documentObject.querySelector("#batchReferenceVideoBtn")) return true;
    const anchor = documentObject.querySelector("#videoPanelBtn") || documentObject.querySelector("#videoBtn");
    if (!anchor?.parentNode) return false;
    const button = documentObject.createElement("button");
    button.type = "button";
    button.id = "batchReferenceVideoBtn";
    button.className = anchor.className;
    button.textContent = "전체 컷 MP4 ZIP";
    button.title = "READY/REVIEW 컷만 개별 Seedance 레퍼런스 MP4로 만들고 BLOCKED 컷은 제외합니다.";
    anchor.insertAdjacentElement?.("afterend", button) || anchor.parentNode.appendChild(button);
    button.addEventListener("click", async () => {
      if (button.disabled) return;
      button.disabled = true;
      const originalText = button.textContent;
      button.textContent = "안전 일괄 출력 중…";
      try {
        await exportReferenceBatchSafely(target, { confirmBeforeStart: true });
      } catch (error) {
        if (typeof target.notifyApp === "function") target.notifyApp(error?.message || "전체 컷 MP4 출력에 실패했습니다.");
      } finally {
        button.disabled = false;
        button.textContent = originalText;
      }
    });
    return true;
  }

  function normalizeReferencePromptPlatform(value) {
    const normalized = String(value || "generic").trim().toLowerCase();
    return ["generic", "higgsfield", "runway"].includes(normalized) ? normalized : "generic";
  }

  function normalizeReferencePromptModel(value) {
    const normalized = String(value || "seedance-2.5").trim().toLowerCase();
    return ["seedance-2.5", "seedance-2.0", "aleph-2.0", "generic"].includes(normalized) ? normalized : "seedance-2.5";
  }

  function normalizeReferencePromptOutput(value) {
    const normalized = String(value || "final").trim().toLowerCase();
    return ["final", "prompt-writer"].includes(normalized) ? normalized : "final";
  }

  function referencePromptPlatformNote(platform = "generic") {
    const normalized = normalizeReferencePromptPlatform(platform);
    if (normalized === "higgsfield") return "Higgsfield는 여러 생성 모델을 선택해 사용하는 제작 플랫폼입니다. 아래 모델 선택과는 별개입니다.";
    if (normalized === "runway") return "Runway는 여러 생성/편집 모델을 사용하는 제작 플랫폼입니다. Seedance 2.5 같은 외부 모델과 Aleph 2.0 같은 Runway 모델을 구분해 선택합니다.";
    return "직접 API·다른 제작 플랫폼·모델 제공사 UI에서 사용할 때 선택합니다. 플랫폼과 생성 모델은 서로 다른 개념입니다.";
  }

  function referencePromptModelNote(model = "seedance-2.5") {
    const normalized = normalizeReferencePromptModel(model);
    if (normalized === "seedance-2.5") return "Seedance 2.5는 ByteDance의 비디오 생성 모델입니다. 텍스트·이미지·비디오·오디오 레퍼런스를 역할별로 사용할 수 있습니다.";
    if (normalized === "seedance-2.0") return "Seedance 2.0은 ByteDance의 멀티모달 비디오 생성 모델입니다. 플랫폼과 무관하게 레퍼런스 역할을 명확히 지정하는 템플릿을 사용합니다.";
    if (normalized === "aleph-2.0") return "Aleph 2.0은 Runway의 비디오 편집 모델입니다. 기존 영상의 구조를 유지하면서 무엇을 바꿀지 짧고 직접적으로 지시하는 방식이 적합합니다.";
    return "기타 레퍼런스 지원 모델용 일반 템플릿입니다. 실제 입력 규칙은 선택한 모델 문서를 확인하세요.";
  }

  function normalizeReferencePromptRole(value) {
    const normalized = String(value || "previs").trim().toLowerCase();
    return ["previs", "motion"].includes(normalized) ? normalized : "previs";
  }

  function referencePromptRoleNote(role = "previs") {
    const normalized = normalizeReferencePromptRole(role);
    if (normalized === "motion") return "모션 레퍼런스: 동작 순서, 속도, 타이밍, 배우 Root 경로, 명시한 Pose/카메라 움직임을 기준으로 사용합니다. 외형과 배경은 별도 레퍼런스로 바꿀 수 있습니다.";
    return "3D 프리비즈 레퍼런스: 공간 구조, 카메라 구도/경로, 피사체 위치, 프레이밍, 렌즈·타이밍을 기준으로 사용합니다. 단순 도형과 색은 최종 디자인이 아닙니다.";
  }

  function referencePromptValue(value, fallback) {
    const normalized = String(value || "").trim();
    return normalized || fallback;
  }

  function referencePromptCutLabel(entry = {}) {
    return `S${String(entry.sceneNumber || 0).padStart(2, "0")} C${String(entry.cutNumber || 0).padStart(2, "0")} · ${entry.title || "컷"}`;
  }

  function buildReferencePromptGuide(entry = {}, platform = "generic", options = {}) {
    const normalized = normalizeReferencePromptPlatform(platform);
    const model = normalizeReferencePromptModel(options.model);
    const outputMode = normalizeReferencePromptOutput(options.outputMode);
    const referenceRole = normalizeReferencePromptRole(options.referenceRole);
    const motion = entry?.blocking?.motion || {};
    const duration = Math.max(0.1, Number(entry.duration || motion.duration || 0) || 0.1);
    const fps = Math.max(1, Math.round(Number(entry.fps || motion.fps || 24) || 24));
    const cutLabel = referencePromptCutLabel(entry);
    const story = referencePromptValue(options.story, "[이 컷에서 실제로 일어나는 행동과 사건을 입력하세요]");
    const references = referencePromptValue(options.references, "[예: @char_main = 주인공 외형, @loc_main = 최종 장소/미술 레퍼런스]");
    const style = referencePromptValue(options.style, "[최종 영상의 시대, 장소, 조명, 렌즈 질감, 색감, 의상/미술 스타일을 입력하세요]");
    const audio = referencePromptValue(options.audio, "[선택: 대사, 환경음, Foley, 음악 또는 SFX]");
    const roleInstruction = referenceRole === "motion"
      ? "Treat the FrisFrame MP4 as the master motion/timing reference: preserve the authored motion sequence, speed, timing, actor root path, explicit pose changes, and encoded camera motion. Placeholder appearance and background may be replaced by the supplied references."
      : "Treat the FrisFrame MP4 as the master previs/spatial reference: preserve spatial layout, camera composition and trajectory, subject position, framing, lens progression, camera timing, actor root blocking, and beat timing. Primitive colors/shapes are blocking markers only, not final design.";

    const platformLabel = normalized === "higgsfield" ? "HIGGSFIELD" : normalized === "runway" ? "RUNWAY" : "DIRECT / OTHER PLATFORM";
    const modelLabel = model === "seedance-2.5" ? "SEEDANCE 2.5" : model === "seedance-2.0" ? "SEEDANCE 2.0" : model === "aleph-2.0" ? "ALEPH 2.0" : "GENERIC REFERENCE MODEL";

    if (outputMode === "prompt-writer") {
      const targetInstruction = model === "aleph-2.0"
        ? `Write a concise Runway Aleph 2.0 transformation prompt for the attached ${duration.toFixed(2)}-second FrisFrame MP4.`
        : model.startsWith("seedance-")
          ? `Write a ${duration.toFixed(2)}-second ${modelLabel} reference-video prompt based on the attached FrisFrame MP4.`
          : `Write a ${duration.toFixed(2)}-second reference-video generation prompt for the selected model based on the attached FrisFrame MP4.`;
      return [
        `PLATFORM: ${platformLabel}`,
        `MODEL: ${modelLabel}`,
        targetInstruction,
        `The shot is ${cutLabel} at ${fps} FPS. Read the entire input video before writing the prompt.`,
        roleInstruction,
        "Treat character/location/creative references as appearance references: identity, wardrobe, environment, color palette, lighting, materials, and mood.",
        model === "aleph-2.0"
          ? "For Aleph 2.0, keep the final transformation prompt short, precise, and limited to what should change while preserving the source structure."
          : "For Seedance/reference generation, describe scene meaning and reference roles without re-inventing camera/root motion already encoded in the FrisFrame MP4.",
        "",
        `SCENE / ACTION NOTES: ${story}`,
        `REFERENCE MAP: ${references}`,
        `VISUAL TARGET: ${style}`,
        `AUDIO / SFX: ${audio}`,
      ].join("\n");
    }

    if (model === "aleph-2.0") {
      return [
        `${platformLabel} · ALEPH 2.0 · ${cutLabel} · ${duration.toFixed(2)}s`,
        "",
        referenceRole === "motion"
          ? "Transform the FrisFrame motion reference into the requested final scene while preserving its motion sequence, speed, timing, actor root path, explicit pose changes, and encoded camera motion."
          : "Transform the FrisFrame previs into the requested final scene while preserving the input video's spatial layout, camera trajectory, timing, framing, subject position/blocking, and spatial relationships.",
        `Change/replace: ${story}`,
        `Use these appearance references: ${references}`,
        `Final visual target: ${style}`,
        `Audio notes: ${audio}`,
        "Keep the instruction concise and change only what is requested. Preserve the rest of the source structure.",
      ].join("\n");
    }

    const heading = `${platformLabel} · ${modelLabel}`;
    return [
      `${heading} · ${cutLabel} · ${duration.toFixed(2)}s · ${fps} FPS`,
      "",
      "ACTIVE REFERENCES",
      referenceRole === "motion"
        ? "@video_1 — FrisFrame motion reference MP4. Master for authored motion sequence, speed, timing, actor root path, explicit pose changes, and encoded camera motion. Follow these beats closely. Placeholder appearance/background may be replaced by the references and text below."
        : "@video_1 — FrisFrame 3D previs MP4. Master for spatial layout, camera composition/trajectory, subject position, framing, lens progression, camera timing, actor root blocking, spatial relationships, and beat timing. Follow this structure beat-for-beat. Primitive colors/shapes are blocking markers only; final appearance comes from the references and text below.",
      references,
      "",
      "SCENE / ACTION",
      story,
      "",
      "VISUAL TARGET",
      style,
      "",
      "AUDIO / SFX",
      audio,
      "",
      "REFERENCE PRIORITY",
      referenceRole === "motion"
        ? "Keep the authored motion sequence, speed, timing, actor root path, explicit pose changes, and encoded camera motion tied to @video_1. Use character/location/creative references for identity, wardrobe, environment, color palette, lighting, materials, mood, and final look. Natural secondary motion may be added only where it supports the authored motion."
        : "Keep the spatial layout, camera path, framing, timing, and actor root blocking tied to @video_1. Use character/location/creative references for identity, wardrobe, environment, color palette, lighting, materials, mood, and final look. Natural secondary motion may be added only where it supports the authored blocking.",
    ].join("\n");
  }

  async function copyReferencePromptText(target, text, documentObject) {
    const payload = String(text || "");
    if (!payload) return false;
    if (typeof target?.copyTextToClipboard === "function") {
      await target.copyTextToClipboard(payload);
      return true;
    }
    if (target?.navigator?.clipboard?.writeText) {
      try {
        await target.navigator.clipboard.writeText(payload);
        return true;
      } catch {
        // Fall through to the DOM copy path.
      }
    }
    if (!documentObject?.createElement || typeof documentObject.execCommand !== "function") return false;
    const textarea = documentObject.createElement("textarea");
    textarea.value = payload;
    textarea.setAttribute("readonly", "");
    Object.assign(textarea.style, { position: "fixed", opacity: "0", pointerEvents: "none" });
    documentObject.body?.appendChild(textarea);
    textarea.select?.();
    const copied = documentObject.execCommand("copy") === true;
    textarea.remove?.();
    return copied;
  }

  function installReferencePromptGuideUi(target) {
    const documentObject = target?.document;
    if (!documentObject || typeof documentObject.querySelector !== "function" || typeof documentObject.createElement !== "function") return false;
    if (documentObject.querySelector("#referencePromptGuideBtn")) return true;
    const anchor = documentObject.querySelector("#referenceReadinessBtn") || documentObject.querySelector("#batchReferenceVideoBtn") || documentObject.querySelector("#videoPanelBtn") || documentObject.querySelector("#videoBtn");
    if (!anchor?.parentNode) return false;

    const button = documentObject.createElement("button");
    button.type = "button";
    button.id = "referencePromptGuideBtn";
    button.className = anchor.className;
    button.textContent = "Reference Prompt";
    button.title = "FrisFrame 레퍼런스 MP4와 함께 사용할 Seedance/Higgsfield/Runway 프롬프트 틀을 만듭니다. AI 호출은 하지 않습니다.";
    anchor.insertAdjacentElement?.("afterend", button) || anchor.parentNode.appendChild(button);

    const dialog = documentObject.createElement("dialog");
    dialog.id = "referencePromptGuideDialog";
    Object.assign(dialog.style, {
      width: "min(860px, calc(100vw - 32px))",
      maxHeight: "88vh",
      border: "1px solid #3d4e58",
      borderRadius: "14px",
      background: "#12171b",
      color: "#eef4ef",
      padding: "0",
      boxShadow: "0 24px 80px rgba(0,0,0,.55)",
    });
    const shell = documentObject.createElement("div");
    Object.assign(shell.style, { padding: "20px", display: "grid", gap: "12px" });
    const heading = documentObject.createElement("strong");
    heading.textContent = "Reference Prompt Guide";
    Object.assign(heading.style, { fontSize: "18px" });
    const intro = documentObject.createElement("div");
    intro.textContent = "FrisFrame은 프롬프트를 AI로 생성하지 않습니다. 현재 프리비즈와 함께 복사해 쓸 수 있는 플랫폼별 안내 문구를 만듭니다.";
    Object.assign(intro.style, { color: "#aab5af", fontSize: "12px" });

    const fieldStyle = { width: "100%", boxSizing: "border-box", border: "1px solid #34434c", borderRadius: "8px", background: "#0d1215", color: "#eef4ef", padding: "9px" };
    const labelStyle = { display: "grid", gap: "5px", color: "#cbd5cf", fontSize: "12px" };
    const makeLabel = (title, control) => {
      const label = documentObject.createElement("label");
      Object.assign(label.style, labelStyle);
      const caption = documentObject.createElement("span");
      caption.textContent = title;
      label.append(caption, control);
      return label;
    };
    const cutSelect = documentObject.createElement("select");
    Object.assign(cutSelect.style, fieldStyle);
    const platformSelect = documentObject.createElement("select");
    Object.assign(platformSelect.style, fieldStyle);
    [
      ["generic", "직접 / 기타 플랫폼"],
      ["higgsfield", "Higgsfield"],
      ["runway", "Runway"],
    ].forEach(([value, label]) => {
      const option = documentObject.createElement("option");
      option.value = value;
      option.textContent = label;
      platformSelect.appendChild(option);
    });
    const platformNote = documentObject.createElement("div");
    Object.assign(platformNote.style, { color: "#91a69a", fontSize: "11px", lineHeight: "1.45" });
    const modelSelect = documentObject.createElement("select");
    Object.assign(modelSelect.style, fieldStyle);
    [
      ["seedance-2.5", "Seedance 2.5 · ByteDance"],
      ["seedance-2.0", "Seedance 2.0 · ByteDance"],
      ["aleph-2.0", "Aleph 2.0 · Runway"],
      ["generic", "기타 Reference 지원 모델"],
    ].forEach(([value, label]) => {
      const option = documentObject.createElement("option");
      option.value = value;
      option.textContent = label;
      modelSelect.appendChild(option);
    });
    const modelNote = documentObject.createElement("div");
    Object.assign(modelNote.style, { color: "#91a69a", fontSize: "11px", lineHeight: "1.45" });
    const outputModeSelect = documentObject.createElement("select");
    Object.assign(outputModeSelect.style, fieldStyle);
    [
      ["final", "최종 생성 프롬프트"],
      ["prompt-writer", "Claude / Fable 등에 프롬프트 작성 요청"],
    ].forEach(([value, label]) => {
      const option = documentObject.createElement("option");
      option.value = value;
      option.textContent = label;
      outputModeSelect.appendChild(option);
    });
    const roleSelect = documentObject.createElement("select");
    Object.assign(roleSelect.style, fieldStyle);
    [
      ["previs", "3D 프리비즈 · 공간/카메라"],
      ["motion", "모션 레퍼런스 · 동작/타이밍"],
    ].forEach(([value, label]) => {
      const option = documentObject.createElement("option");
      option.value = value;
      option.textContent = label;
      roleSelect.appendChild(option);
    });
    const roleNote = documentObject.createElement("div");
    Object.assign(roleNote.style, { color: "#91a69a", fontSize: "11px", lineHeight: "1.45" });

    const makeTextarea = (placeholder, rows = 2) => {
      const textarea = documentObject.createElement("textarea");
      textarea.rows = rows;
      textarea.placeholder = placeholder;
      Object.assign(textarea.style, { ...fieldStyle, resize: "vertical", minHeight: `${rows * 24 + 18}px` });
      return textarea;
    };
    const story = makeTextarea("예: 주인공이 골목을 걸어가며 전화한다. 끝에서 차가 멈추고 주인공이 고개를 든다.", 3);
    const references = makeTextarea("예: @char_main = 주인공 외형 / @loc_main = 최종 골목 미술 / @style_1 = 조명·색감", 2);
    const style = makeTextarea("예: 현대 도쿄 저녁, 사실적 장편영화 질감, 젖은 아스팔트, 부드러운 네온 반사", 2);
    const audio = makeTextarea("예: SFX: 약한 도심 앰비언스, 발소리. 대사 없음.", 2);
    const output = makeTextarea("", 14);
    output.readOnly = true;
    Object.assign(output.style, { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: "11px", lineHeight: "1.45" });

    const controls = documentObject.createElement("div");
    Object.assign(controls.style, { display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "flex-end" });
    const build = documentObject.createElement("button");
    const copy = documentObject.createElement("button");
    const close = documentObject.createElement("button");
    [build, copy, close].forEach((entryButton) => {
      entryButton.type = "button";
      entryButton.className = anchor.className;
    });
    build.textContent = "프롬프트 만들기";
    copy.textContent = "복사";
    close.textContent = "닫기";
    controls.append(build, copy, close);

    shell.append(
      heading,
      intro,
      makeLabel("컷", cutSelect),
      makeLabel("사용 플랫폼", platformSelect),
      platformNote,
      makeLabel("생성 / 편집 모델", modelSelect),
      modelNote,
      makeLabel("출력 방식", outputModeSelect),
      makeLabel("FrisFrame MP4 역할", roleSelect),
      roleNote,
      makeLabel("장면 / 행동", story),
      makeLabel("외부 레퍼런스 역할 · 캐릭터 / 장소 / 크리에이티브", references),
      makeLabel("최종 비주얼", style),
      makeLabel("오디오 / SFX (선택)", audio),
      makeLabel("복사용 프롬프트", output),
      controls,
    );
    dialog.appendChild(shell);
    documentObject.body?.appendChild(dialog);

    let entries = [];
    const selectedEntry = () => entries[Number(cutSelect.value) || 0] || entries[0] || null;
    const refreshOutput = () => {
      platformNote.textContent = referencePromptPlatformNote(platformSelect.value);
      modelNote.textContent = referencePromptModelNote(modelSelect.value);
      roleNote.textContent = referencePromptRoleNote(roleSelect.value);
      const entry = selectedEntry();
      output.value = entry ? buildReferencePromptGuide(entry, platformSelect.value, {
        model: modelSelect.value,
        outputMode: outputModeSelect.value,
        referenceRole: roleSelect.value,
        story: story.value,
        references: references.value,
        style: style.value,
        audio: audio.value,
      }) : "프로젝트에서 레퍼런스 MP4로 사용할 컷을 찾지 못했습니다.";
    };
    const refreshEntries = () => {
      cutSelect.innerHTML = "";
      let project = {};
      try {
        project = target.managedProjectDocument?.()?.project || {};
      } catch {
        project = {};
      }
      entries = collectReferenceBatchCuts(project);
      entries.forEach((entry, index) => {
        const option = documentObject.createElement("option");
        option.value = String(index);
        option.textContent = `${referencePromptCutLabel(entry)} · ${entry.duration.toFixed(2)}s`;
        cutSelect.appendChild(option);
      });
      refreshOutput();
    };

    build.addEventListener("click", refreshOutput);
    cutSelect.addEventListener("change", refreshOutput);
    platformSelect.addEventListener("change", refreshOutput);
    modelSelect.addEventListener("change", refreshOutput);
    outputModeSelect.addEventListener("change", refreshOutput);
    roleSelect.addEventListener("change", refreshOutput);
    copy.addEventListener("click", async () => {
      refreshOutput();
      const copied = await copyReferencePromptText(target, output.value, documentObject);
      if (typeof target.notifyApp === "function") target.notifyApp(copied ? "Reference Prompt를 복사했습니다." : "프롬프트를 복사하지 못했습니다. 텍스트 영역에서 직접 복사하세요.");
    });
    close.addEventListener("click", () => dialog.close?.());
    button.addEventListener("click", () => {
      refreshEntries();
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    });
    return true;
  }

  function readinessStatusText(result) {
    if (result.status === "ready") return "READY";
    if (result.status === "review") return "REVIEW";
    return "BLOCKED";
  }

  function installReferenceReadinessUi(target) {
    const documentObject = target?.document;
    if (!documentObject || typeof documentObject.querySelector !== "function" || typeof documentObject.createElement !== "function") return false;
    if (documentObject.querySelector("#referenceReadinessBtn")) return true;
    const anchor = documentObject.querySelector("#batchReferenceVideoBtn") || documentObject.querySelector("#videoPanelBtn") || documentObject.querySelector("#videoBtn");
    if (!anchor?.parentNode) return false;
    const button = documentObject.createElement("button");
    button.type = "button";
    button.id = "referenceReadinessBtn";
    button.className = anchor.className;
    button.textContent = "Reference Readiness";
    button.title = "프로젝트의 컷별 Seedance 레퍼런스 준비 상태를 검사합니다.";
    anchor.insertAdjacentElement?.("afterend", button) || anchor.parentNode.appendChild(button);

    const dialog = documentObject.createElement("dialog");
    dialog.id = "referenceReadinessDialog";
    Object.assign(dialog.style, {
      width: "min(760px, calc(100vw - 32px))",
      maxHeight: "80vh",
      border: "1px solid #3d4e58",
      borderRadius: "14px",
      background: "#12171b",
      color: "#eef4ef",
      padding: "0",
      boxShadow: "0 24px 80px rgba(0,0,0,.55)",
    });
    const shell = documentObject.createElement("div");
    Object.assign(shell.style, { padding: "20px", display: "grid", gap: "14px" });
    const heading = documentObject.createElement("strong");
    heading.textContent = "Seedance Reference Readiness";
    Object.assign(heading.style, { fontSize: "18px" });
    const summary = documentObject.createElement("div");
    Object.assign(summary.style, { color: "#aab5af", fontSize: "13px" });
    const list = documentObject.createElement("div");
    Object.assign(list.style, { display: "grid", gap: "8px", overflow: "auto", maxHeight: "58vh" });
    const close = documentObject.createElement("button");
    close.type = "button";
    close.textContent = "닫기";
    close.className = anchor.className;
    Object.assign(close.style, { justifySelf: "end" });
    close.addEventListener("click", () => dialog.close?.());
    shell.append(heading, summary, list, close);
    dialog.appendChild(shell);
    documentObject.body?.appendChild(dialog);

    function render() {
      list.innerHTML = "";
      let project = {};
      try {
        project = target.managedProjectDocument?.()?.project || {};
      } catch (error) {
        summary.textContent = error?.message || "프로젝트를 읽지 못했습니다.";
        return;
      }
      const results = evaluateProjectReferenceReadiness(project);
      const ready = results.filter((entry) => entry.readiness.status === "ready").length;
      const review = results.filter((entry) => entry.readiness.status === "review").length;
      const blocked = results.filter((entry) => entry.readiness.status === "blocked").length;
      summary.textContent = `${results.length}컷 · READY ${ready} · REVIEW ${review} · BLOCKED ${blocked}`;
      results.forEach((entry) => {
        const result = entry.readiness;
        const row = documentObject.createElement("div");
        Object.assign(row.style, {
          border: "1px solid #2f3d45",
          borderRadius: "10px",
          padding: "11px 12px",
          background: "#0d1215",
        });
        const title = documentObject.createElement("div");
        Object.assign(title.style, {
          display: "flex",
          justifyContent: "space-between",
          gap: "12px",
          fontSize: "13px",
        });
        const name = documentObject.createElement("strong");
        name.textContent = `S${String(entry.sceneNumber).padStart(2, "0")} C${String(entry.cutNumber).padStart(2, "0")} · ${entry.title || "컷"}`;
        const badge = documentObject.createElement("span");
        badge.textContent = `${readinessStatusText(result)} ${result.score}`;
        badge.style.color = result.status === "ready" ? "#79dda0" : result.status === "review" ? "#ffd173" : "#ff8a7c";
        title.append(name, badge);
        row.appendChild(title);
        if (result.issues.length) {
          const issueList = documentObject.createElement("ul");
          Object.assign(issueList.style, {
            margin: "8px 0 0",
            paddingLeft: "18px",
            color: "#b9c4be",
            fontSize: "12px",
          });
          result.issues.forEach((issue) => {
            const item = documentObject.createElement("li");
            item.textContent = `${issue.severity === "error" ? "차단" : "검토"} · ${issue.message}`;
            issueList.appendChild(item);
          });
          row.appendChild(issueList);
        } else {
          const ok = documentObject.createElement("div");
          ok.textContent = "현재 레퍼런스 출력 계약에서 확인할 문제가 없습니다.";
          Object.assign(ok.style, { marginTop: "7px", color: "#8f9d96", fontSize: "12px" });
          row.appendChild(ok);
        }
        list.appendChild(row);
      });
    }

    button.addEventListener("click", () => {
      render();
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    });
    return true;
  }

  return {
    SEEDANCE_REFERENCE_MAX_SECONDS,
    buildReferenceBatchManifest,
    collectReferenceBatchCuts,
    collectSingleReferenceVideo,
    evaluateProjectReferenceReadiness,
    evaluateReferenceReadiness,
    exportReferenceBatchSafely,
    exportReferenceVideoBatch,
    buildReferencePromptGuide,
    copyReferencePromptText,
    installBatchReferenceExportUi,
    installReferencePromptGuideUi,
    installReferenceReadinessUi,
    normalizeReferencePromptModel,
    normalizeReferencePromptOutput,
    normalizeReferencePromptPlatform,
    normalizeReferencePromptRole,
    partitionReferenceBatchByReadiness,
    referencePromptModelNote,
    referencePromptPlatformNote,
    referencePromptRoleNote,
    readinessStatusText,
    referenceEntryKey,
    safeFileSlug,
  };
});
