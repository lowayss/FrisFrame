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

  function continuityIdentity(item) {
    return String(item?.continuityId || `${item?.type || "item"}:${compact(item?.name).toLowerCase()}`);
  }

  function angleDelta(first, second) {
    return Math.abs((((Number(second || 0) - Number(first || 0)) % 360) + 540) % 360 - 180);
  }

  function rounded(value, digits = 2) {
    const factor = 10 ** digits;
    return Math.round(Number(value || 0) * factor) / factor;
  }

  function continuityFinding(previousCutId, kind, message, subjectIds = [], signatureParts = [], severity = "warning") {
    const ids = [...new Set(subjectIds.map(String).filter(Boolean))].sort();
    return {
      id: `${String(previousCutId || "previous")}:${kind}:${ids.join("|") || "scene"}`,
      signature: signatureParts.map((value) => String(value)).join("|"),
      kind,
      severity,
      message,
      subjectIds: ids,
    };
  }

  function bodyPoseDifference(firstPose, secondPose) {
    const first = firstPose && typeof firstPose === "object" ? firstPose : {};
    const second = secondPose && typeof secondPose === "object" ? secondPose : {};
    let maximum = 0;
    [...new Set([...Object.keys(first), ...Object.keys(second)])].forEach((joint) => {
      const firstJoint = first[joint] && typeof first[joint] === "object" ? first[joint] : {};
      const secondJoint = second[joint] && typeof second[joint] === "object" ? second[joint] : {};
      ["x", "y", "z"].forEach((axis) => {
        maximum = Math.max(maximum, Math.abs(Number(firstJoint[axis] || 0) - Number(secondJoint[axis] || 0)));
      });
    });
    return maximum;
  }

  function normalizedContinuity(value = {}) {
    const source = value && typeof value === "object" ? value : {};
    const overrides = source.overrides && typeof source.overrides === "object" && !Array.isArray(source.overrides)
      ? Object.fromEntries(Object.entries(source.overrides).flatMap(([id, entry]) => {
        if (!entry || typeof entry !== "object" || !String(entry.signature || "")) return [];
        return [[String(id), {
          signature: String(entry.signature),
          note: String(entry.note || "").slice(0, 240),
          updatedAt: String(entry.updatedAt || ""),
        }]];
      }))
      : {};
    return { overrides };
  }

  function findingIsOverridden(finding, continuity) {
    const override = normalizedContinuity(continuity).overrides[finding?.id];
    return Boolean(override && override.signature === finding?.signature);
  }

  function continuityReport(input = {}) {
    const previous = input.previous || {};
    const current = input.current || {};
    const previousCutId = String(input.previousCutId || "previous");
    const world = input.worldSize || { width: 36, depth: 20.25 };
    const findings = [];
    if (previous.aspect && current.aspect && previous.aspect !== current.aspect) {
      findings.push(continuityFinding(previousCutId, "aspect", `연속성: 화면비 ${previous.aspect} → ${current.aspect}`, [], [previous.aspect, current.aspect]));
    }

    const previousItems = new Map((previous.items || []).map((item) => [continuityIdentity(item), item]));
    const currentItems = new Map((current.items || []).map((item) => [continuityIdentity(item), item]));
    const commonActors = [...previousItems.entries()]
      .filter(([identity, item]) => item.type === "actor" && currentItems.get(identity)?.type === "actor")
      .map(([identity, item]) => ({ identity, previous: item, current: currentItems.get(identity) }))
      .filter((entry) => entry.previous.visible !== false && entry.current.visible !== false);

    let axisPair = null;
    for (let first = 0; first < commonActors.length - 1; first += 1) {
      for (let second = first + 1; second < commonActors.length; second += 1) {
        const a = commonActors[first];
        const b = commonActors[second];
        const previousDistance = Math.hypot(b.previous.x - a.previous.x, b.previous.y - a.previous.y);
        const currentDistance = Math.hypot(b.current.x - a.current.x, b.current.y - a.current.y);
        if (Math.min(previousDistance, currentDistance) > 0.08) {
          axisPair = [a, b];
          break;
        }
      }
      if (axisPair) break;
    }
    if (axisPair && previous.camera && current.camera) {
      const side = (camera, first, second) => {
        const dx = second.x - first.x;
        const dy = second.y - first.y;
        const length = Math.max(0.0001, Math.hypot(dx, dy));
        return (dx * (camera.y - first.y) - dy * (camera.x - first.x)) / length;
      };
      const beforeSide = side(previous.camera, axisPair[0].previous, axisPair[1].previous);
      const afterSide = side(current.camera, axisPair[0].current, axisPair[1].current);
      if (Math.abs(beforeSide) > 0.04 && Math.abs(afterSide) > 0.04 && beforeSide * afterSide < 0) {
        const names = axisPair.map((entry) => `@${entry.current.name}`).join("–");
        findings.push(continuityFinding(
          previousCutId,
          "axis-180",
          `연속성: ${names} 연기축을 카메라가 넘어감`,
          axisPair.map((entry) => entry.identity),
          [rounded(beforeSide), rounded(afterSide)],
          "critical",
        ));
      }
    }

    const previousMotion = input.previousMotion || {};
    const currentMotion = input.currentMotion || {};
    commonActors.forEach((entry) => {
      const before = previousMotion[entry.identity];
      const after = currentMotion[entry.identity];
      if (!before || !after) return;
      const screenProjection = (vector, camera) => {
        const angle = Number(camera?.panDeg || 0) * Math.PI / 180;
        return Number(vector.x || 0) * -Math.sin(angle) + Number(vector.y || 0) * Math.cos(angle);
      };
      const beforeScreen = screenProjection(before, previous.camera);
      const afterScreen = screenProjection(after, current.camera);
      if (Math.abs(beforeScreen) > 0.025 && Math.abs(afterScreen) > 0.025 && beforeScreen * afterScreen < 0) {
        findings.push(continuityFinding(
          previousCutId,
          "screen-direction",
          `연속성: @${entry.current.name}의 화면 진행 방향이 반대로 바뀜`,
          [entry.identity],
          [rounded(beforeScreen), rounded(afterScreen)],
        ));
      }
    });

    previousItems.forEach((before, identity) => {
      const after = currentItems.get(identity);
      const label = before.type === "actor" ? `@${before.name}` : before.name;
      if (!after) {
        findings.push(continuityFinding(previousCutId, `${before.type}-presence`, `연속성: ${label}이 다음 컷에서 사라짐`, [identity], ["missing"]));
        return;
      }
      if ((before.visible !== false) !== (after.visible !== false)) {
        findings.push(continuityFinding(previousCutId, `${before.type}-visibility`, `연속성: ${label}의 표시 상태가 바뀜`, [identity], [before.visible !== false, after.visible !== false]));
      }
      const distance = Math.hypot(
        (Number(before.x || 0) - Number(after.x || 0)) * Number(world.width || 36),
        (Number(before.y || 0) - Number(after.y || 0)) * Number(world.depth || 20.25),
      );
      if (distance > (before.type === "actor" ? 0.75 : 1.0)) {
        findings.push(continuityFinding(previousCutId, `${before.type}-position`, `연속성: ${label} 위치가 ${distance.toFixed(1)}m 이동`, [identity], [rounded(distance, 1)]));
      }
      const facing = angleDelta(before.facing, after.facing);
      if (facing > 45) {
        findings.push(continuityFinding(previousCutId, `${before.type}-facing`, `연속성: ${label} 방향이 ${Math.round(facing)}° 바뀜`, [identity], [Math.round(facing)]));
      }
      if (before.type === "actor") {
        const beforeElevation = Number(before.verticalOffset || 0) + Number(before.mountedHeight || 0);
        const afterElevation = Number(after.verticalOffset || 0) + Number(after.mountedHeight || 0);
        if (Math.abs(beforeElevation - afterElevation) > 0.3) {
          findings.push(continuityFinding(previousCutId, "actor-elevation", `연속성: ${label} 높이가 달라짐`, [identity], [rounded(beforeElevation), rounded(afterElevation)]));
        }
        if (angleDelta(before.pitch, after.pitch) > 30) {
          findings.push(continuityFinding(previousCutId, "actor-pitch", `연속성: ${label} 몸 기울기가 크게 바뀜`, [identity], [rounded(before.pitch), rounded(after.pitch)]));
        }
        const poseDelta = bodyPoseDifference(before.bodyPose, after.bodyPose);
        if (poseDelta > 45) {
          findings.push(continuityFinding(previousCutId, "actor-pose", `연속성: ${label} 자세가 크게 바뀜`, [identity], [Math.round(poseDelta)]));
        }
        const beforeMounted = Boolean(before.mountId);
        const afterMounted = Boolean(after.mountId);
        if (beforeMounted !== afterMounted || (beforeMounted && Number(before.seatIndex || 0) !== Number(after.seatIndex || 0))) {
          findings.push(continuityFinding(previousCutId, "actor-mount", `연속성: ${label} 탑승 또는 좌석 상태가 바뀜`, [identity], [beforeMounted, before.seatIndex || 0, afterMounted, after.seatIndex || 0]));
        }
      } else {
        if (before.assetType !== after.assetType) {
          findings.push(continuityFinding(previousCutId, "prop-type", `연속성: ${label} 소품 종류가 바뀜`, [identity], [before.assetType, after.assetType]));
        }
        if (before.color !== after.color) {
          findings.push(continuityFinding(previousCutId, "prop-color", `연속성: ${label} 색상이 바뀜`, [identity], [before.color, after.color]));
        }
        const scaleDelta = Math.max(...["scaleX", "scaleY", "scaleZ"].map((field) => Math.abs(Number(before[field] || 1) - Number(after[field] || 1))));
        if (scaleDelta > 0.15) {
          findings.push(continuityFinding(previousCutId, "prop-scale", `연속성: ${label} 크기 비율이 바뀜`, [identity], [rounded(scaleDelta)]));
        }
      }
    });
    return findings;
  }

  function cutSnapshotDocument(cut = {}) {
    return JSON.parse(JSON.stringify({
      title: String(cut.title || "새 컷"),
      action: String(cut.action || ""),
      dialogue: String(cut.dialogue || ""),
      camera: String(cut.camera || ""),
      intent: String(cut.intent || ""),
      notes: String(cut.notes || ""),
      shotType: String(cut.shotType || "미정"),
      thumbnailTime: Number(cut.thumbnailTime || 0),
      blocking: cut.blocking || {},
    }));
  }

  function compareCutDocuments(first = {}, second = {}) {
    const firstBlocking = first.blocking || {};
    const secondBlocking = second.blocking || {};
    const rows = [
      ["컷 제목", first.title || "", second.title || ""],
      ["샷 크기", first.shotType || "미정", second.shotType || "미정"],
      ["렌즈", `${firstBlocking.camera?.focal || "-"}mm`, `${secondBlocking.camera?.focal || "-"}mm`],
      ["재생 시간", `${firstBlocking.motion?.duration || 0}초`, `${secondBlocking.motion?.duration || 0}초`],
      ["키 수", String(firstBlocking.motion?.keyframes?.length || 0), String(secondBlocking.motion?.keyframes?.length || 0)],
      ["액션", first.action || "없음", second.action || "없음"],
      ["연속성 메모", first.notes || "없음", second.notes || "없음"],
    ];
    return rows.map(([label, a, b]) => ({ label, first: String(a), second: String(b), changed: String(a) !== String(b) }));
  }

  return {
    buildStoryStructure,
    compareCutDocuments,
    continuityIdentity,
    continuityReport,
    cutSnapshotDocument,
    findingIsOverridden,
    inferShotType,
    isSceneHeading,
    parseDuration,
    parseFocal,
    parseScenarioScenes,
    parseStoryboardSections,
    normalizedContinuity,
    wrapLegacyProject,
  };
});
