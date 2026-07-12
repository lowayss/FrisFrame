(function initStoryboardCore(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.StoryboardCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createStoryboardCore() {
  const SCENE_HEADING = /^(?:(?:INT|EXT|INT\.\/EXT|I\/E)\.?\s+|(?:씬|장면|SCENE)\s*[#.]?\s*\d+)/i;
  const CUT_HEADING = /^(?:(?:컷|CUT|SHOT)\s*[#.]?\s*(\d+)?\s*[:.)\-]?\s*)(.*)$/i;
  const FIELD_LINE = /^(액션|행동|내용|대사|카메라|촬영|의도|연출|메모|비고|샷|구도|길이|시간|렌즈)\s*[:：]\s*(.*)$/i;

  function cleanText(value) {
    return String(value || "").replace(/\r\n?/g, "\n").trim();
  }

  function compact(value) {
    return cleanText(value).replace(/\s+/g, " ").trim();
  }

  function isSceneHeading(line) {
    return SCENE_HEADING.test(compact(line));
  }

  function splitSceneSections(text) {
    const lines = cleanText(text).split("\n");
    const sections = [];
    let current = { heading: "", lines: [], explicitHeading: false };

    lines.forEach((rawLine) => {
      const line = rawLine.trim();
      if (isSceneHeading(line)) {
        if (current.heading || current.lines.some(Boolean)) sections.push(current);
        current = { heading: line, lines: [], explicitHeading: true };
      } else {
        current.lines.push(rawLine);
      }
    });
    if (current.heading || current.lines.some(Boolean)) sections.push(current);
    return sections.length ? sections : [{ heading: "", lines: [], explicitHeading: false }];
  }

  function firstParagraph(text) {
    return cleanText(text).split(/\n\s*\n/).map(compact).find(Boolean) || "";
  }

  function parseScenarioScenes(text) {
    if (!cleanText(text)) return [];
    return splitSceneSections(text).map((section, index) => {
      const scriptText = cleanText(section.lines.join("\n"));
      return {
        number: index + 1,
        heading: section.heading || `장면 ${index + 1}`,
        synopsis: firstParagraph(scriptText).slice(0, 240),
        scriptText,
        explicitHeading: section.explicitHeading,
      };
    });
  }

  function parseDuration(text) {
    const match = compact(text).match(/(?:길이|시간)?\s*[:：]?\s*(\d+(?:\.\d+)?)\s*(?:초|s|sec)/i);
    return match ? Math.max(1, Math.min(60, Number(match[1]))) : null;
  }

  function parseFocal(text) {
    const match = compact(text).match(/(?:렌즈\s*[:：]?\s*)?(14|18|21|24|28|32|35|40|50|65|75|85|100|135)\s*mm/i);
    return match ? Number(match[1]) : null;
  }

  function inferShotType(text) {
    const value = compact(text).toLowerCase();
    if (/익스트림\s*클로즈|extreme\s*close|ecu/.test(value)) return "익스트림 클로즈업";
    if (/클로즈|close[ -]?up|\bcu\b/.test(value)) return "클로즈업";
    if (/바스트|medium\s*close|\bmcu\b/.test(value)) return "바스트숏";
    if (/미디엄|medium|\bms\b/.test(value)) return "미디엄숏";
    if (/풀\s*샷|full\s*shot|\bfs\b/.test(value)) return "풀숏";
    if (/와이드|wide|롱\s*샷|long\s*shot|\bws\b/.test(value)) return "와이드숏";
    if (/오버\s*더\s*숄더|over[ -]?the[ -]?shoulder|\bots\b/.test(value)) return "오버숄더";
    if (/투\s*샷|two[ -]?shot/.test(value)) return "투숏";
    if (/인서트|insert/.test(value)) return "인서트";
    if (/pov|시점/.test(value)) return "POV";
    return "미정";
  }

  function appendField(target, key, value) {
    const next = cleanText(value);
    if (!next) return;
    target[key] = target[key] ? `${target[key]}\n${next}` : next;
  }

  function parseCutBlock(block, index) {
    const rawText = cleanText(block.lines.join("\n"));
    const fields = { action: "", dialogue: "", camera: "", intent: "", notes: "" };
    let activeField = "action";

    block.lines.forEach((rawLine) => {
      const line = rawLine.trim();
      if (!line) return;
      const match = line.match(FIELD_LINE);
      if (!match) {
        appendField(fields, activeField, line);
        return;
      }
      const label = match[1].toLowerCase();
      if (/대사/.test(label)) activeField = "dialogue";
      else if (/카메라|촬영|샷|구도/.test(label)) activeField = "camera";
      else if (/의도|연출/.test(label)) activeField = "intent";
      else if (/메모|비고/.test(label)) activeField = "notes";
      else if (/길이|시간|렌즈/.test(label)) return;
      else activeField = "action";
      appendField(fields, activeField, match[2] || line);
    });

    const title = compact(block.title) || `컷 ${index + 1}`;
    const combined = `${title}\n${rawText}`;
    return {
      number: Number(block.number) || index + 1,
      title,
      action: cleanText(fields.action),
      dialogue: cleanText(fields.dialogue),
      camera: cleanText(fields.camera),
      intent: cleanText(fields.intent),
      notes: cleanText(fields.notes),
      shotType: inferShotType(combined),
      duration: parseDuration(combined),
      focal: parseFocal(combined),
      sourceText: rawText,
    };
  }

  function parseCuts(lines) {
    const blocks = [];
    let current = null;
    lines.forEach((rawLine) => {
      const line = rawLine.trim();
      const match = line.match(CUT_HEADING);
      if (match) {
        if (current) blocks.push(current);
        current = { number: match[1] || "", title: match[2] || "", lines: [] };
      } else {
        if (!current) current = { number: "", title: "", lines: [] };
        current.lines.push(rawLine);
      }
    });
    if (current) blocks.push(current);

    const hasExplicitCuts = lines.some((line) => CUT_HEADING.test(line.trim()));
    if (!hasExplicitCuts) {
      const paragraphs = cleanText(lines.join("\n")).split(/\n\s*\n/).map(cleanText).filter(Boolean);
      if (paragraphs.length > 1) {
        return paragraphs.map((paragraph, index) => parseCutBlock({
          number: index + 1,
          title: `컷 ${index + 1}`,
          lines: paragraph.split("\n"),
        }, index));
      }
    }
    return blocks.filter((block) => block.title || block.lines.some((line) => line.trim()))
      .map(parseCutBlock);
  }

  function parseStoryboardSections(text) {
    if (!cleanText(text)) return [];
    return splitSceneSections(text).map((section, index) => ({
      number: index + 1,
      heading: section.heading || "",
      explicitHeading: section.explicitHeading,
      cuts: parseCuts(section.lines),
    }));
  }

  function headingKey(value) {
    return compact(value).toLowerCase().replace(/[^a-z0-9가-힣]/g, "");
  }

  function buildStoryStructure(input = {}) {
    const scenarioScenes = parseScenarioScenes(input.scenarioText);
    const boardSections = parseStoryboardSections(input.storyboardText);
    const warnings = [];
    let scenes = scenarioScenes.map((scene) => ({ ...scene, cuts: [] }));

    if (!scenes.length && boardSections.length) {
      scenes = boardSections.map((section, index) => ({
        number: index + 1,
        heading: section.heading || `장면 ${index + 1}`,
        synopsis: "",
        scriptText: "",
        explicitHeading: section.explicitHeading,
        cuts: [],
      }));
    }
    if (!scenes.length) {
      scenes = [{ number: 1, heading: "장면 1", synopsis: "", scriptText: "", explicitHeading: false, cuts: [] }];
    }

    boardSections.forEach((section, index) => {
      let targetIndex = -1;
      if (section.explicitHeading) {
        const key = headingKey(section.heading);
        targetIndex = scenes.findIndex((scene) => headingKey(scene.heading) === key);
      }
      if (targetIndex < 0 && boardSections.length === scenes.length) targetIndex = index;
      if (targetIndex < 0 && scenes.length === 1) targetIndex = 0;
      if (targetIndex < 0) {
        targetIndex = 0;
        warnings.push("콘티의 일부 컷은 대응하는 씬 헤딩이 없어 첫 번째 씬에 배치되었습니다.");
      }
      scenes[targetIndex].cuts.push(...section.cuts);
    });

    scenes.forEach((scene, index) => {
      scene.number = index + 1;
      if (!scene.cuts.length) {
        scene.cuts.push({
          number: 1,
          title: "첫 컷",
          action: scene.synopsis || "",
          dialogue: "",
          camera: "",
          intent: "",
          notes: "",
          shotType: "미정",
          duration: null,
          focal: null,
          sourceText: "",
        });
      }
      scene.cuts.forEach((cut, cutIndex) => { cut.number = cutIndex + 1; });
    });

    return { scenes, warnings: [...new Set(warnings)] };
  }

  function wrapLegacyProject(blockingInput, options = {}) {
    const blocking = JSON.parse(JSON.stringify(blockingInput || {}));
    const makeId = typeof options.idFactory === "function"
      ? options.idFactory
      : (() => Math.random().toString(36).slice(2, 10));
    const now = String(options.now || new Date().toISOString());
    const title = String(blocking.sceneTitle || "기존 블로킹");
    const intent = String(blocking.sceneIntent || "");
    return {
      id: makeId(),
      title,
      logline: "",
      createdAt: now,
      updatedAt: now,
      scenario: {
        sourceType: "legacy-v4",
        sourceName: "",
        importedAt: now,
        rawText: "",
        storyboardText: "",
        warnings: [],
      },
      scenes: [{
        id: makeId(),
        number: 1,
        heading: "장면 1",
        synopsis: "",
        scriptText: "",
        createdAt: now,
        updatedAt: now,
        cuts: [{
          id: makeId(),
          number: 1,
          title,
          action: "",
          dialogue: "",
          camera: "",
          intent,
          notes: "",
          shotType: "미정",
          status: blocking.motion?.keyframes?.length ? "blocking" : "draft",
          thumbnailTime: 0,
          sourceText: "",
          createdAt: now,
          updatedAt: now,
          blocking,
        }],
      }],
    };
  }

  return {
    buildStoryStructure,
    inferShotType,
    isSceneHeading,
    parseDuration,
    parseFocal,
    parseScenarioScenes,
    parseStoryboardSections,
    wrapLegacyProject,
  };
});
