from pathlib import Path

core_path = Path('reference-workflow-core.js')
core = core_path.read_text(encoding='utf-8')

marker = '''  function referencePromptValue(value, fallback) {\n'''
insert = '''  function normalizeReferencePromptRole(value) {\n    const normalized = String(value || "previs").trim().toLowerCase();\n    return ["previs", "motion"].includes(normalized) ? normalized : "previs";\n  }\n\n  function referencePromptRoleNote(role = "previs") {\n    const normalized = normalizeReferencePromptRole(role);\n    if (normalized === "motion") return "모션 레퍼런스: 동작 순서, 속도, 타이밍, 배우 Root 경로, 명시한 Pose/카메라 움직임을 기준으로 사용합니다. 외형과 배경은 별도 레퍼런스로 바꿀 수 있습니다.";\n    return "3D 프리비즈 레퍼런스: 공간 구조, 카메라 구도/경로, 피사체 위치, 프레이밍, 렌즈·타이밍을 기준으로 사용합니다. 단순 도형과 색은 최종 디자인이 아닙니다.";\n  }\n\n'''
if 'function normalizeReferencePromptRole' not in core:
    if marker not in core:
        raise SystemExit('role insert marker not found')
    core = core.replace(marker, insert + marker, 1)

old = '''    const normalized = normalizeReferencePromptPlatform(platform);\n    const motion = entry?.blocking?.motion || {};\n'''
new = '''    const normalized = normalizeReferencePromptPlatform(platform);\n    const referenceRole = normalizeReferencePromptRole(options.referenceRole);\n    const motion = entry?.blocking?.motion || {};\n'''
if old not in core:
    raise SystemExit('build role marker not found')
core = core.replace(old, new, 1)

old = '''    const audio = referencePromptValue(options.audio, "[선택: 대사, 환경음, Foley, 음악 또는 SFX]");\n\n    if (normalized === "prompt-writer") {\n'''
new = '''    const audio = referencePromptValue(options.audio, "[선택: 대사, 환경음, Foley, 음악 또는 SFX]");\n    const roleInstruction = referenceRole === "motion"\n      ? "Treat the FrisFrame MP4 as the master motion/timing reference: preserve the authored motion sequence, speed, timing, actor root path, explicit pose changes, and encoded camera motion. Placeholder appearance and background may be replaced by the supplied references."\n      : "Treat the FrisFrame MP4 as the master previs/spatial reference: preserve spatial layout, camera composition and trajectory, subject position, framing, lens progression, camera timing, actor root blocking, and beat timing. Primitive colors/shapes are blocking markers only, not final design.";\n\n    if (normalized === "prompt-writer") {\n'''
if old not in core:
    raise SystemExit('role instruction marker not found')
core = core.replace(old, new, 1)

old = '''        "Treat the FrisFrame MP4 as the master structure/motion reference. Treat primitive colors and shapes as blocking markers only, not final design.",\n        "Treat character/location/style images as appearance references. Keep natural secondary body motion subtle and compatible with the blocking instead of inventing a different camera or root path.",\n'''
new = '''        roleInstruction,\n        "Treat character/location/creative references as appearance references: identity, wardrobe, environment, color palette, lighting, materials, and mood. Keep natural secondary body motion subtle and compatible with the authored blocking instead of inventing a different camera or root path.",\n'''
if old not in core:
    raise SystemExit('writer role marker not found')
core = core.replace(old, new, 1)

old = '''        "Transform the FrisFrame previs into the requested final scene while preserving the input video's camera trajectory, timing, framing, subject blocking, and spatial relationships.",\n'''
new = '''        referenceRole === "motion"\n          ? "Transform the FrisFrame motion reference into the requested final scene while preserving its motion sequence, speed, timing, actor root path, explicit pose changes, and encoded camera motion."\n          : "Transform the FrisFrame previs into the requested final scene while preserving the input video's spatial layout, camera trajectory, timing, framing, subject position/blocking, and spatial relationships.",\n'''
if old not in core:
    raise SystemExit('runway role marker not found')
core = core.replace(old, new, 1)

old = '''      "ACTIVE REFERENCES",\n      "@video_1 — FrisFrame previs MP4. Master for camera trajectory, framing, lens progression, camera timing, actor root blocking, spatial relationships, and beat timing. Follow this structure beat-for-beat. Primitive colors/shapes are blocking markers only; final appearance comes from the references and text below.",\n      references,\n'''
new = '''      "ACTIVE REFERENCES",\n      referenceRole === "motion"\n        ? "@video_1 — FrisFrame motion reference MP4. Master for authored motion sequence, speed, timing, actor root path, explicit pose changes, and encoded camera motion. Follow these beats closely. Placeholder appearance/background may be replaced by the references and text below."\n        : "@video_1 — FrisFrame 3D previs MP4. Master for spatial layout, camera composition/trajectory, subject position, framing, lens progression, camera timing, actor root blocking, spatial relationships, and beat timing. Follow this structure beat-for-beat. Primitive colors/shapes are blocking markers only; final appearance comes from the references and text below.",\n      references,\n'''
if old not in core:
    raise SystemExit('seedance role marker not found')
core = core.replace(old, new, 1)

old = '''      "REFERENCE PRIORITY",\n      "Keep the camera path, framing, timing, and actor root movement tied to @video_1. Use character/location/style references for identity, wardrobe, environment, lighting, materials, and final look. Natural secondary motion may be added only where it supports the authored blocking.",\n'''
new = '''      "REFERENCE PRIORITY",\n      referenceRole === "motion"\n        ? "Keep the authored motion sequence, speed, timing, actor root path, explicit pose changes, and encoded camera motion tied to @video_1. Use character/location/creative references for identity, wardrobe, environment, color palette, lighting, materials, mood, and final look. Natural secondary motion may be added only where it supports the authored motion."\n        : "Keep the spatial layout, camera path, framing, timing, and actor root blocking tied to @video_1. Use character/location/creative references for identity, wardrobe, environment, color palette, lighting, materials, mood, and final look. Natural secondary motion may be added only where it supports the authored blocking.",\n'''
if old not in core:
    raise SystemExit('priority marker not found')
core = core.replace(old, new, 1)

old = '''    const platformNote = documentObject.createElement("div");\n    Object.assign(platformNote.style, { color: "#91a69a", fontSize: "11px", lineHeight: "1.45" });\n\n    const makeTextarea = (placeholder, rows = 2) => {\n'''
new = '''    const platformNote = documentObject.createElement("div");\n    Object.assign(platformNote.style, { color: "#91a69a", fontSize: "11px", lineHeight: "1.45" });\n    const roleSelect = documentObject.createElement("select");\n    Object.assign(roleSelect.style, fieldStyle);\n    [\n      ["previs", "3D 프리비즈 · 공간/카메라"],\n      ["motion", "모션 레퍼런스 · 동작/타이밍"],\n    ].forEach(([value, label]) => {\n      const option = documentObject.createElement("option");\n      option.value = value;\n      option.textContent = label;\n      roleSelect.appendChild(option);\n    });\n    const roleNote = documentObject.createElement("div");\n    Object.assign(roleNote.style, { color: "#91a69a", fontSize: "11px", lineHeight: "1.45" });\n\n    const makeTextarea = (placeholder, rows = 2) => {\n'''
if old not in core:
    raise SystemExit('role UI marker not found')
core = core.replace(old, new, 1)

old = '''      makeLabel("대상", platformSelect),\n      platformNote,\n      makeLabel("장면 / 행동", story),\n      makeLabel("캐릭터 · 장소 · 스타일 레퍼런스 역할", references),\n'''
new = '''      makeLabel("대상", platformSelect),\n      platformNote,\n      makeLabel("FrisFrame MP4 역할", roleSelect),\n      roleNote,\n      makeLabel("장면 / 행동", story),\n      makeLabel("외부 레퍼런스 역할 · 캐릭터 / 장소 / 크리에이티브", references),\n'''
if old not in core:
    raise SystemExit('role UI append marker not found')
core = core.replace(old, new, 1)

old = '''    const refreshOutput = () => {\n      platformNote.textContent = referencePromptPlatformNote(platformSelect.value);\n      const entry = selectedEntry();\n      output.value = entry ? buildReferencePromptGuide(entry, platformSelect.value, {\n        story: story.value,\n'''
new = '''    const refreshOutput = () => {\n      platformNote.textContent = referencePromptPlatformNote(platformSelect.value);\n      roleNote.textContent = referencePromptRoleNote(roleSelect.value);\n      const entry = selectedEntry();\n      output.value = entry ? buildReferencePromptGuide(entry, platformSelect.value, {\n        referenceRole: roleSelect.value,\n        story: story.value,\n'''
if old not in core:
    raise SystemExit('refresh role marker not found')
core = core.replace(old, new, 1)

old = '''    platformSelect.addEventListener("change", refreshOutput);\n    copy.addEventListener("click", async () => {\n'''
new = '''    platformSelect.addEventListener("change", refreshOutput);\n    roleSelect.addEventListener("change", refreshOutput);\n    copy.addEventListener("click", async () => {\n'''
if old not in core:
    raise SystemExit('role listener marker not found')
core = core.replace(old, new, 1)

old = '''    normalizeReferencePromptPlatform,\n    partitionReferenceBatchByReadiness,\n    referencePromptPlatformNote,\n'''
new = '''    normalizeReferencePromptPlatform,\n    normalizeReferencePromptRole,\n    partitionReferenceBatchByReadiness,\n    referencePromptPlatformNote,\n    referencePromptRoleNote,\n'''
if old not in core:
    raise SystemExit('exports marker not found')
core = core.replace(old, new, 1)

core_path.write_text(core, encoding='utf-8')

# Tests
test_path = Path('tests/reference-prompt-guide.test.cjs')
test = test_path.read_text(encoding='utf-8')
test = test.replace('''  normalizeReferencePromptPlatform,\n  referencePromptPlatformNote,\n''', '''  normalizeReferencePromptPlatform,\n  normalizeReferencePromptRole,\n  referencePromptPlatformNote,\n  referencePromptRoleNote,\n''')
test = test.replace('''assert.ok(referencePromptPlatformNote("runway").includes("모델별"));\n\nconst seedance = buildReferencePromptGuide(entry, "seedance", options);\n''', '''assert.ok(referencePromptPlatformNote("runway").includes("모델별"));\nassert.equal(normalizeReferencePromptRole("MOTION"), "motion");\nassert.equal(normalizeReferencePromptRole("unknown"), "previs");\nassert.ok(referencePromptRoleNote("previs").includes("공간 구조"));\nassert.ok(referencePromptRoleNote("motion").includes("동작 순서"));\n\nconst seedance = buildReferencePromptGuide(entry, "seedance", { ...options, referenceRole: "previs" });\n''')
test = test.replace('''assert.ok(seedance.includes("Master for camera trajectory"));\n''', '''assert.ok(seedance.includes("FrisFrame 3D previs MP4"));\nassert.ok(seedance.includes("Master for spatial layout"));\n''')
test = test.replace('''const higgsfield = buildReferencePromptGuide(entry, "higgsfield", options);\n''', '''const higgsfield = buildReferencePromptGuide(entry, "higgsfield", { ...options, referenceRole: "motion" });\n''')
test = test.replace('''assert.ok(higgsfield.includes("@video_1"));\n\nconst runway = buildReferencePromptGuide(entry, "runway", options);\n''', '''assert.ok(higgsfield.includes("@video_1"));\nassert.ok(higgsfield.includes("FrisFrame motion reference MP4"));\nassert.ok(higgsfield.includes("motion sequence, speed, timing"));\n\nconst runway = buildReferencePromptGuide(entry, "runway", { ...options, referenceRole: "motion" });\n''')
test = test.replace('''assert.ok(runway.includes("preserving the input video's camera trajectory"));\n''', '''assert.ok(runway.includes("preserving its motion sequence"));\n''')
test = test.replace('''assert.ok(source.includes('button.textContent = "Reference Prompt"'));\n''', '''assert.ok(source.includes('button.textContent = "Reference Prompt"'));\nassert.ok(source.includes('"3D 프리비즈 · 공간/카메라"'));\nassert.ok(source.includes('"모션 레퍼런스 · 동작/타이밍"'));\n''')
test_path.write_text(test, encoding='utf-8')

# Add second tutorial findings to Korean guide.
guide_path = Path('REFERENCE_PROMPT_GUIDE.md')
guide = guide_path.read_text(encoding='utf-8')
section = '''\n## 두 번째 튜토리얼에서 확인한 레퍼런스 역할 구분\n\n첨부 영상 `프롬프트보다 중요합니다. AI 영상 레퍼런스 진짜 잘쓰는 법! (Higgsfield Seedance 2.5 1080)`은 같은 Seedance 2.5에서도 **레퍼런스 종류마다 맡길 역할을 분리해야 한다**는 점을 더 명확하게 보여줍니다.\n\n### 3D 프리비즈 레퍼런스\n\n영상의 예시 프롬프트는 다음 의미를 갖습니다.\n\n- 레퍼런스의 **공간 구조, 카메라 구도, 인물 위치**를 유지\n- 회색 3D 장면을 실사 장면으로 변환\n- 마네킹을 원하는 실제 인물로 교체\n- 프리비즈에서 보이는 카메라/인물 관계를 유지하면서 최종 외형만 바꿈\n\n즉 FrisFrame MP4를 기본적으로 이 역할로 사용하면 됩니다. **공간·카메라·프레이밍·배우 Root Blocking은 FrisFrame MP4가 기준**이고, 얼굴/의상/미술은 외부 레퍼런스가 담당합니다.\n\n### 모션 레퍼런스\n\n영상에서는 별도의 단순 모션 영상을 넣고 다음처럼 사용합니다.\n\n- 모션 레퍼런스의 **동작 순서, 속도, 타이밍**을 따른다.\n- 인물과 배경은 완전히 다른 최종 디자인으로 바꾼다.\n- 움직임의 구조는 유지하되 최종 실사 표현은 자연스럽게 만든다.\n\nFrisFrame에서 `모션 레퍼런스 · 동작/타이밍` 모드를 선택하면 이 역할에 맞는 프롬프트가 만들어집니다. 다만 FrisFrame은 자동 걸음/팔 흔들기 같은 secondary motion을 만들지 않으므로, **Actor Root 경로와 명시적으로 작성한 Pose/카메라 움직임까지만 기준으로 선언**합니다.\n\n### 크리에이티브 레퍼런스\n\n영상의 크리에이티브 레퍼런스 예시는 **전체 look, color palette, lighting, mood**를 영상 전반에 적용하도록 지시합니다.\n\n이 역할은 FrisFrame MP4가 아니라 별도 이미지/영상 레퍼런스가 맡는 것이 좋습니다. 예를 들면:\n\n```text\n@video_1 = FrisFrame previs · 공간/카메라/블로킹\n@char_main = 캐릭터 외형\n@creative_1 = 색감/조명/무드/영상 질감\n@loc_main = 장소/미술\n```\n\n핵심은 **한 레퍼런스에 모든 역할을 몰아넣지 않는 것**입니다. 프롬프트가 길어지는 것보다 각 레퍼런스가 무엇을 담당하는지 명확히 선언하는 편이 중요합니다.\n\n'''
anchor = '## 크레딧을 아끼는 실제 순서\n'
if '## 두 번째 튜토리얼에서 확인한 레퍼런스 역할 구분' not in guide:
    if anchor not in guide:
        raise SystemExit('guide anchor not found')
    guide = guide.replace(anchor, section + anchor, 1)
guide_path.write_text(guide, encoding='utf-8')
