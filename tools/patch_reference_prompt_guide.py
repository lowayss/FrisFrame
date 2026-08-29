from pathlib import Path

workflow_path = Path('reference-workflow-core.js')
text = workflow_path.read_text(encoding='utf-8')

install_old = '''    const install = () => {\n      api.installBatchReferenceExportUi(root);\n      api.installReferenceReadinessUi(root);\n    };'''
install_new = '''    const install = () => {\n      api.installBatchReferenceExportUi(root);\n      api.installReferenceReadinessUi(root);\n      api.installReferencePromptGuideUi(root);\n    };'''
if 'api.installReferencePromptGuideUi(root);' not in text:
    if install_old not in text:
        raise SystemExit('install marker not found')
    text = text.replace(install_old, install_new, 1)

insert_marker = '  function readinessStatusText(result) {'
if 'function buildReferencePromptGuide(' not in text:
    block = r'''  function normalizeReferencePromptPlatform(value) {
    const normalized = String(value || "seedance").trim().toLowerCase();
    return ["seedance", "higgsfield", "runway", "prompt-writer"].includes(normalized) ? normalized : "seedance";
  }

  function referencePromptPlatformNote(platform = "seedance") {
    const normalized = normalizeReferencePromptPlatform(platform);
    if (normalized === "higgsfield") return "Higgsfield는 생성 플랫폼입니다. 이 템플릿은 튜토리얼과 가장 가까운 Higgsfield + Seedance Video-to-Video 조합을 기준으로 합니다.";
    if (normalized === "runway") return "Runway는 모델별 레퍼런스 동작이 다릅니다. 이 템플릿은 Aleph/Edit Studio 계열처럼 입력 영상을 보존·변환하는 흐름을 기준으로 짧고 직접적인 지시를 사용합니다.";
    if (normalized === "prompt-writer") return "튜토리얼처럼 Claude/Fable 같은 외부 도구에 FrisFrame MP4와 이미지 레퍼런스를 첨부하고, 초 단위 Seedance 프롬프트를 작성하게 하는 요청문입니다.";
    return "Seedance Video-to-Video 기준입니다. FrisFrame MP4는 카메라·블로킹·타이밍을, 이미지/텍스트 레퍼런스는 인물·장소·스타일을 담당하도록 역할을 분리합니다.";
  }

  function referencePromptValue(value, fallback) {
    const normalized = String(value || "").trim();
    return normalized || fallback;
  }

  function referencePromptCutLabel(entry = {}) {
    return `S${String(entry.sceneNumber || 0).padStart(2, "0")} C${String(entry.cutNumber || 0).padStart(2, "0")} · ${entry.title || "컷"}`;
  }

  function buildReferencePromptGuide(entry = {}, platform = "seedance", options = {}) {
    const normalized = normalizeReferencePromptPlatform(platform);
    const motion = entry?.blocking?.motion || {};
    const duration = Math.max(0.1, Number(entry.duration || motion.duration || 0) || 0.1);
    const fps = Math.max(1, Math.round(Number(entry.fps || motion.fps || 24) || 24));
    const cutLabel = referencePromptCutLabel(entry);
    const story = referencePromptValue(options.story, "[이 컷에서 실제로 일어나는 행동과 사건을 입력하세요]");
    const references = referencePromptValue(options.references, "[예: @char_main = 주인공 외형, @loc_main = 최종 장소/미술 레퍼런스]");
    const style = referencePromptValue(options.style, "[최종 영상의 시대, 장소, 조명, 렌즈 질감, 색감, 의상/미술 스타일을 입력하세요]");
    const audio = referencePromptValue(options.audio, "[선택: 대사, 환경음, Foley, 음악 또는 SFX]");

    if (normalized === "prompt-writer") {
      return [
        `Write a ${duration.toFixed(2)}-second Seedance video-to-video prompt based on the attached FrisFrame blocking MP4.`,
        `The shot is ${cutLabel} at ${fps} FPS. Read the entire input video and write the final generation prompt second-by-second so it matches the authored camera path, framing, lens changes, actor root blocking, spatial relationships, and timing.`,
        "Treat the FrisFrame MP4 as the master structure/motion reference. Treat primitive colors and shapes as blocking markers only, not final design.",
        "Treat character/location/style images as appearance references. Keep natural secondary body motion subtle and compatible with the blocking instead of inventing a different camera or root path.",
        "Return the prompt in these sections: SHOT, ACTIVE REFERENCES, GLOBAL STYLE, SCENE / ACTION, SECOND-BY-SECOND TIMELINE, AUDIO / SFX.",
        "",
        `SCENE / ACTION NOTES: ${story}`,
        `REFERENCE MAP: ${references}`,
        `VISUAL TARGET: ${style}`,
        `AUDIO / SFX: ${audio}`,
      ].join("\n");
    }

    if (normalized === "runway") {
      return [
        `RUNWAY REFERENCE STARTER · ${cutLabel} · ${duration.toFixed(2)}s`,
        "",
        "Transform the FrisFrame previs into the requested final scene while preserving the input video's camera trajectory, timing, framing, subject blocking, and spatial relationships.",
        `Scene/action: ${story}`,
        `Replace placeholder geometry with these final references/subjects: ${references}`,
        `Final visual target: ${style}`,
        `Motion/audio notes: ${audio}`,
        "Keep the requested transformation specific and concise. Add extra motion only when it supports the authored blocking.",
        "",
        "Reference usage: @Video 1 = FrisFrame previs structure. Add image/video references with Runway's @ reference picker when the selected model supports them.",
      ].join("\n");
    }

    const heading = normalized === "higgsfield"
      ? "HIGGSFIELD · SEEDANCE VIDEO-TO-VIDEO"
      : "SEEDANCE VIDEO-TO-VIDEO";
    return [
      `${heading} · ${cutLabel} · ${duration.toFixed(2)}s · ${fps} FPS`,
      "",
      "ACTIVE REFERENCES",
      "@video_1 — FrisFrame previs MP4. Master for camera trajectory, framing, lens progression, camera timing, actor root blocking, spatial relationships, and beat timing. Follow this structure beat-for-beat. Primitive colors/shapes are blocking markers only; final appearance comes from the references and text below.",
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
      "Keep the camera path, framing, timing, and actor root movement tied to @video_1. Use character/location/style references for identity, wardrobe, environment, lighting, materials, and final look. Natural secondary motion may be added only where it supports the authored blocking.",
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
      ["seedance", "Seedance V2V"],
      ["higgsfield", "Higgsfield · Seedance V2V"],
      ["runway", "Runway · Reference / Aleph"],
      ["prompt-writer", "Claude / Fable · 프롬프트 작성 요청"],
    ].forEach(([value, label]) => {
      const option = documentObject.createElement("option");
      option.value = value;
      option.textContent = label;
      platformSelect.appendChild(option);
    });
    const platformNote = documentObject.createElement("div");
    Object.assign(platformNote.style, { color: "#91a69a", fontSize: "11px", lineHeight: "1.45" });

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
      makeLabel("대상", platformSelect),
      platformNote,
      makeLabel("장면 / 행동", story),
      makeLabel("캐릭터 · 장소 · 스타일 레퍼런스 역할", references),
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
      const entry = selectedEntry();
      output.value = entry ? buildReferencePromptGuide(entry, platformSelect.value, {
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

'''
    if insert_marker not in text:
        raise SystemExit('readiness marker not found')
    text = text.replace(insert_marker, block + insert_marker, 1)

return_marker = '''    installBatchReferenceExportUi,\n    installReferenceReadinessUi,\n    partitionReferenceBatchByReadiness,'''
return_replacement = '''    buildReferencePromptGuide,\n    copyReferencePromptText,\n    installBatchReferenceExportUi,\n    installReferencePromptGuideUi,\n    installReferenceReadinessUi,\n    normalizeReferencePromptPlatform,\n    partitionReferenceBatchByReadiness,\n    referencePromptPlatformNote,'''
if '    buildReferencePromptGuide,' not in text:
    if return_marker not in text:
        raise SystemExit('return marker not found')
    text = text.replace(return_marker, return_replacement, 1)

workflow_path.write_text(text, encoding='utf-8')

# Add unit test.
test_path = Path('tests/reference-prompt-guide.test.cjs')
if not test_path.exists():
    test_path.write_text(r'''const assert = require("node:assert/strict");

const {
  buildReferencePromptGuide,
  normalizeReferencePromptPlatform,
  referencePromptPlatformNote,
} = require("../reference-workflow-core.js");

const entry = {
  sceneNumber: 2,
  cutNumber: 3,
  title: "Roof Push",
  duration: 12,
  fps: 24,
  blocking: { motion: { duration: 12, fps: 24, keyframes: [] } },
};
const options = {
  story: "주인공이 앞으로 걸어가다 마지막에 멈춘다.",
  references: "@char_main = 주인공 / @loc_main = 옥상",
  style: "현대 도쿄 저녁, 사실적 영화 질감",
  audio: "SFX: 바람과 멀리 들리는 도시 소음",
};

assert.equal(normalizeReferencePromptPlatform("RUNWAY"), "runway");
assert.equal(normalizeReferencePromptPlatform("unknown"), "seedance");
assert.ok(referencePromptPlatformNote("higgsfield").includes("플랫폼"));
assert.ok(referencePromptPlatformNote("runway").includes("모델별"));

const seedance = buildReferencePromptGuide(entry, "seedance", options);
assert.ok(seedance.includes("SEEDANCE VIDEO-TO-VIDEO"));
assert.ok(seedance.includes("@video_1"));
assert.ok(seedance.includes("Master for camera trajectory"));
assert.ok(seedance.includes(options.story));
assert.ok(seedance.includes(options.references));
assert.ok(seedance.includes("Primitive colors/shapes are blocking markers only"));

const higgsfield = buildReferencePromptGuide(entry, "higgsfield", options);
assert.ok(higgsfield.includes("HIGGSFIELD · SEEDANCE VIDEO-TO-VIDEO"));
assert.ok(higgsfield.includes("@video_1"));

const runway = buildReferencePromptGuide(entry, "runway", options);
assert.ok(runway.includes("RUNWAY REFERENCE STARTER"));
assert.ok(runway.includes("preserving the input video's camera trajectory"));
assert.ok(runway.includes("@Video 1"));

const writer = buildReferencePromptGuide(entry, "prompt-writer", options);
assert.ok(writer.includes("Write a 12.00-second Seedance video-to-video prompt"));
assert.ok(writer.includes("second-by-second"));
assert.ok(writer.includes("attached FrisFrame blocking MP4"));
assert.ok(writer.includes("SECOND-BY-SECOND TIMELINE"));

const source = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "reference-workflow-core.js"), "utf8");
assert.ok(source.includes('id = "referencePromptGuideBtn"'));
assert.ok(source.includes('button.textContent = "Reference Prompt"'));
assert.ok(source.includes("FrisFrame은 프롬프트를 AI로 생성하지 않습니다."));

console.log("reference-prompt-guide: deterministic platform prompt guidance passed");
''', encoding='utf-8')

# Make quality_check run the new test.
quality_path = Path('quality_check.py')
quality = quality_path.read_text(encoding='utf-8')
quality_marker = '        "tests/reference-readiness.test.cjs",\n'
if 'tests/reference-prompt-guide.test.cjs' not in quality:
    if quality_marker not in quality:
        raise SystemExit('quality test marker not found')
    quality = quality.replace(quality_marker, quality_marker + '        "tests/reference-prompt-guide.test.cjs",\n', 1)
quality_path.write_text(quality, encoding='utf-8')

# Add Korean tutorial/prompt guide.
doc_path = Path('REFERENCE_PROMPT_GUIDE.md')
if not doc_path.exists():
    doc_path.write_text(r'''# FrisFrame Reference Prompt Guide

이 문서는 FrisFrame 프리비즈 MP4를 **Seedance, Higgsfield, Runway 같은 제작 환경에 넣을 때 프롬프트를 어떻게 써야 하는지** 정리합니다.

FrisFrame 자체는 영상 생성 AI가 아닙니다. 역할은 카메라, 배우 블로킹, 타이밍, 프레이밍, 렌즈 변화와 공간 관계를 프리비즈 MP4로 만드는 것입니다.

## 첨부 튜토리얼에서 확인한 핵심

튜토리얼 `How To Save AI Credits With Higgsfield + Blender`의 핵심은 **생성하기 전에 구조를 잠그는 것**입니다.

### 00:00~03:50 — 먼저 프리비즈를 만든다

Blender에서 완성 3D를 만들지 않습니다. 사람은 단순한 기둥/도형, 환경은 단순한 벽과 바닥으로 두고 다음 정보만 먼저 정합니다.

- 카메라 시작/종료 위치
- 카메라 이동 경로와 속도
- 피사체 위치와 진행 방향
- 인물 수와 서로의 거리
- 전경/배경/가림 관계
- 컷 또는 원테이크의 시간 구조

목표는 예쁜 프리비즈가 아니라 **생성 모델이 따라갈 구조를 먼저 검증해서 실패 생성과 재시도를 줄이는 것**입니다.

### 04:00~05:30 — 프리비즈 영상을 읽혀서 Seedance 프롬프트를 만든다

영상에서 Claude/Fable에 프리비즈 MP4와 인물/장소 이미지를 함께 넣고 다음 취지로 요청합니다.

> 프리비즈 영상을 읽고, 카메라와 블로킹에 맞는 30초 Seedance 프롬프트를 초 단위로 작성해 달라.

생성된 최종 프롬프트에서 가장 중요한 부분은 **레퍼런스의 역할 분리**입니다.

- `@video_1` = 프리비즈. 카메라 경로, 프레이밍, 렌즈 느낌, 회전, 타이밍, 공간 배치, 주인공 블로킹의 기준
- 캐릭터 이미지 = 얼굴, 머리, 의상, 정체성
- 장소 이미지 = 최종 환경/미술/조명
- 프리비즈의 단순 색과 도형 = 최종 디자인이 아니라 블로킹 표식

즉, **영상 레퍼런스는 움직임과 구조를 담당하고 이미지 레퍼런스는 외형을 담당**합니다.

### 05:30 전후 — 3D Blockout 유무 비교

튜토리얼은 `WITHOUT 3D BLOCKOUT`과 `WITH 3D BLOCKOUT` 결과를 비교합니다. 핵심 주장은 복잡한 카메라/액션일수록 텍스트만으로 반복 생성하는 것보다, 프리비즈로 구조를 먼저 잠그는 편이 재시도를 줄이기 쉽다는 것입니다.

### 07:00~09:00 — 여러 사람이 있는 장면

6명이 테이블에 앉는 장면을 단순 도형으로 배치합니다. 여기서 프리비즈는 표정이나 연기가 아니라 다음을 확인하는 도구입니다.

- 누가 어느 자리에 앉는지
- 카메라에서 누구의 얼굴이 가려지는지
- 전경 인물이 다른 사람을 얼마나 가리는지
- 카메라 높이와 오버숄더 구도

### 10:30~12:45 — 여러 장소를 연결하는 30초 구조

영상에 실제로 보이는 프롬프트는 대략 다음 구조입니다.

- Blender blocking을 읽는다.
- Seedance V2V 30초 프롬프트를 만든다.
- `@video_1 = blocking`
- `@char_main = main character sheet`
- 첫 장소는 이미지 레퍼런스, 나머지 장소는 텍스트로 정의
- 여러 장소를 지나도 같은 주인공이어야 함
- 각 장소에서 주인공이 무엇을 하는지 명확히 작성

이 예시는 **프리비즈가 카메라/시간 구조를, 텍스트가 사건과 장소 의미를 담당**하는 방식입니다.

### 11:20 전후 — 카메라 움직임도 먼저 프리비즈에서 검증

Claude에 Blender 카메라를 `robot-arm`처럼 움직이게 하고, 지점 사이를 빠르게 이동한 뒤 정확히 멈추며 마지막 위치에서는 정지하도록 지시합니다. 즉 복잡한 카메라 표현을 생성 프롬프트에서 처음 시험하는 것이 아니라 **프리비즈에서 먼저 실제 움직임으로 확인**합니다.

### 13:30~17:00 — 제품 광고 예시

제품 캔, 과일, 얼음, 텍스트를 단순 3D로 배치하고 광고의 장면 순서를 먼저 만듭니다. 영상에는 13개 정도의 장면/비트가 텍스트로 정리되고, 이후 다음과 같은 수정 요청이 나옵니다.

- 각 장면에서 카메라가 빠르게 들어오고 중간에서 느려졌다가 컷 직전에 다시 가속
- 오브젝트끼리 겹치거나 관통하지 않는지 확인
- 마지막 제품/텍스트 구도를 다시 균형 조정

여기서도 제품 재질을 완성하는 것이 목적이 아니라 **카메라와 오브젝트 타이밍을 잠그는 것**이 목적입니다.

## FrisFrame에서 권장하는 프롬프트 역할 분리

```text
FrisFrame MP4
→ 카메라 경로 / 프레이밍 / 렌즈 변화 / 배우 Root Blocking / 타이밍 / 공간 관계

캐릭터 이미지
→ 얼굴 / 헤어 / 의상 / 신체 특징 / 정체성

장소·스타일 이미지
→ 환경 / 미술 / 조명 / 색감 / 재질

텍스트 프롬프트
→ 사건의 의미 / 행동 설명 / 분위기 / 대사 / SFX / 이미지 레퍼런스 역할
```

## Seedance용 기본 구조

```text
ACTIVE REFERENCES
@video_1 — FrisFrame previs MP4. Master for camera trajectory, framing, lens progression,
camera timing, actor root blocking, spatial relationships, and beat timing.
Primitive colors/shapes are blocking markers only.

@char_main — [주인공 외형 레퍼런스]
@loc_main — [장소/미술 레퍼런스]

SCENE / ACTION
[실제로 무슨 일이 일어나는지]

VISUAL TARGET
[시대, 장소, 조명, 영상 질감, 의상, 색감]

AUDIO / SFX
[필요한 경우]

REFERENCE PRIORITY
Keep the camera path, framing, timing, and actor root movement tied to @video_1.
Use the image references for identity, wardrobe, environment, lighting, materials, and final look.
```

핵심은 **프롬프트가 프리비즈에 이미 들어 있는 카메라를 다시 새로 지시하지 않는 것**입니다. MP4가 카메라 구조를 담당하도록 두고 텍스트는 의미와 최종 외형을 보충합니다.

## Higgsfield에서 사용할 때

Higgsfield는 모델 이름이 아니라 여러 생성 모델을 제공하는 **플랫폼**입니다. 첨부 튜토리얼과 가장 가까운 조합은 **Higgsfield에서 Seedance Video-to-Video를 사용하는 경우**입니다.

따라서 FrisFrame의 `Higgsfield · Seedance V2V` 템플릿은 Seedance 템플릿과 같은 역할 분리를 사용합니다.

다른 Higgsfield 모델을 선택하면 해당 모델의 입력 방식과 프롬프트 규칙이 달라질 수 있으므로 템플릿은 출발점으로 사용합니다.

## Runway에서 사용할 때

Runway는 모델별 입력 방식이 다릅니다. Aleph/Edit Studio 계열처럼 기존 영상을 변환하는 작업에서는 공식 가이드도 **짧고 직접적인 변환 지시**를 권장합니다.

예시:

```text
Transform the FrisFrame previs into a cinematic modern Tokyo alley at dusk.
Preserve the input video's camera trajectory, timing, framing, subject blocking,
and spatial relationships. Replace placeholder geometry with the referenced actor
and environment. Add subtle natural secondary body motion that supports the blocking.
```

Runway에서 다른 모델을 사용할 경우 Video Reference 지원 방식이 달라질 수 있으므로 모델에 맞춰 조정합니다.

## Claude / Fable에 프롬프트를 쓰게 할 때

튜토리얼과 가장 가까운 방법입니다.

```text
Write a [DURATION]-second Seedance video-to-video prompt based on the attached
FrisFrame blocking MP4. Read the entire input video and write the final prompt
second-by-second so it matches the authored camera path, framing, lens changes,
actor root blocking, spatial relationships, and timing.

Treat the FrisFrame MP4 as the master structure/motion reference.
Treat primitive colors and shapes as blocking markers only.
Treat character/location/style images as appearance references.

Return sections:
SHOT
ACTIVE REFERENCES
GLOBAL STYLE
SCENE / ACTION
SECOND-BY-SECOND TIMELINE
AUDIO / SFX
```

FrisFrame의 `Reference Prompt` 창에서 이 요청문도 바로 만들 수 있습니다.

## 크레딧을 아끼는 실제 순서

1. FrisFrame에서 카메라와 배우 Root Blocking을 만든다.
2. Preview를 보고 카메라/가림/타이밍 문제를 먼저 수정한다.
3. Reference Readiness를 확인한다.
4. 낮은 비용의 테스트용 레퍼런스 출력으로 구조를 확인한다.
5. `Reference Prompt`에서 플랫폼용 프롬프트를 만든다.
6. 생성 플랫폼에서는 **프리비즈와 프롬프트를 동시에 바꾸지 말고 한 번에 한 요소만 수정**한다.
7. 구조가 맞은 뒤 최종 해상도/오디오/세부 스타일에 비용을 쓴다.

## 중요한 원칙

> **Block it. Lock it. Then let the generation model execute the final look.**

FrisFrame이 맡는 것은 `Block`과 `Lock`입니다. 최종 렌더링과 자연스러운 세부 움직임은 Seedance/Runway 등 실제 생성 모델이 담당합니다.
''', encoding='utf-8')

# Link the guide from both README files.
for readme_name in ('README.md', 'README.en.md'):
    readme_path = Path(readme_name)
    readme = readme_path.read_text(encoding='utf-8')
    if 'REFERENCE_PROMPT_GUIDE.md' not in readme:
        if readme_name == 'README.md':
            marker = '- [`REFERENCE_VIDEO_PRINCIPLES.md`](REFERENCE_VIDEO_PRINCIPLES.md) — Seedance 레퍼런스 영상 설계 원칙\n'
            addition = marker + '- [`REFERENCE_PROMPT_GUIDE.md`](REFERENCE_PROMPT_GUIDE.md) — Seedance / Higgsfield / Runway 레퍼런스 프롬프트 가이드\n'
        else:
            marker = '- [`REFERENCE_VIDEO_PRINCIPLES.md`](REFERENCE_VIDEO_PRINCIPLES.md) — Seedance reference-video design contract\n'
            addition = marker + '- [`REFERENCE_PROMPT_GUIDE.md`](REFERENCE_PROMPT_GUIDE.md) — Korean guide for Seedance / Higgsfield / Runway reference prompts\n'
        if marker not in readme:
            raise SystemExit(f'README marker not found: {readme_name}')
        readme = readme.replace(marker, addition, 1)
        readme_path.write_text(readme, encoding='utf-8')
