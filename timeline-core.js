(function initTimelineCore(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FrisFrameTimelineCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createTimelineCore() {
  const TIME_PRECISION = 4;

  function finiteNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : Number(fallback) || 0;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, finiteNumber(value, min)));
  }

  function roundTime(value) {
    return Number(finiteNumber(value, 0).toFixed(TIME_PRECISION));
  }

  function snapStep(mode = "frame", fps = 24) {
    if (mode === "frame") return 1 / clamp(Math.round(finiteNumber(fps, 24)), 1, 240);
    if (["0.1", "0.5", "1"].includes(String(mode))) return Number(mode);
    return 0.01;
  }

  function snapTime(value, mode = "frame", fps = 24, minimum = 0, maximum = 60) {
    const safe = clamp(value, minimum, maximum);
    if (mode === "off") return roundTime(safe);
    const step = snapStep(mode, fps);
    return roundTime(clamp(Math.round(safe / step) * step, minimum, maximum));
  }

  function sameTime(first, second, epsilon = 0.0005) {
    return Math.abs(finiteNumber(first, 0) - finiteNumber(second, 0)) <= Math.max(0.00001, epsilon);
  }

  function keyIdSet(ids = []) {
    return new Set(Array.from(ids || []).map(String));
  }

  function normalizedSelection(keyframes = [], ids = [], primaryId = "") {
    const existing = new Set(keyframes.map((keyframe) => String(keyframe.id)));
    const selected = Array.from(keyIdSet(ids)).filter((id) => existing.has(id));
    const primary = existing.has(String(primaryId || "")) ? String(primaryId) : selected[0] || "";
    if (primary && !selected.includes(primary)) selected.push(primary);
    return { ids: selected, primaryId: primary };
  }

  function expandSynchronizedCutSelection(keyframes = [], ids = [], epsilon = 0.0005) {
    const selected = keyIdSet(ids);
    const selectedCuts = keyframes.filter((keyframe) => selected.has(String(keyframe.id)) && keyframe.transition === "cut");
    selectedCuts.forEach((cut) => {
      keyframes.forEach((keyframe) => {
        if (keyframe.transition === "cut" && sameTime(keyframe.time, cut.time, epsilon)) selected.add(String(keyframe.id));
      });
    });
    return Array.from(selected);
  }

  function selectionRange(keyframes = [], ids = []) {
    const selected = keyIdSet(ids);
    const times = keyframes
      .filter((keyframe) => selected.has(String(keyframe.id)))
      .map((keyframe) => finiteNumber(keyframe.time, 0));
    if (!times.length) return null;
    const start = Math.min(...times);
    const end = Math.max(...times);
    return { start, end, duration: roundTime(end - start), count: times.length };
  }

  function collisionEpsilon(mode = "frame", fps = 24) {
    return Math.min(0.004, snapStep(mode, fps) / 4);
  }

  function hasTimingCollision(keyframes, selectedIds, candidateTimes, epsilon) {
    const selected = keyIdSet(selectedIds);
    const moved = keyframes.filter((keyframe) => selected.has(String(keyframe.id)));
    const stationary = keyframes.filter((keyframe) => !selected.has(String(keyframe.id)));
    for (let index = 0; index < moved.length; index += 1) {
      const keyframe = moved[index];
      const time = candidateTimes.get(String(keyframe.id));
      if (stationary.some((entry) => entry.source === keyframe.source && sameTime(entry.time, time, epsilon))) return true;
      for (let otherIndex = index + 1; otherIndex < moved.length; otherIndex += 1) {
        const other = moved[otherIndex];
        if (other.source !== keyframe.source) continue;
        if (sameTime(time, candidateTimes.get(String(other.id)), epsilon)) return true;
      }
    }
    return false;
  }

  function preservesSourceOrder(keyframes, selectedIds, candidateTimes, epsilon) {
    const selected = keyIdSet(selectedIds);
    const sources = new Set(keyframes.map((keyframe) => keyframe.source));
    for (const source of sources) {
      const ordered = keyframes
        .filter((keyframe) => keyframe.source === source)
        .sort((first, second) => finiteNumber(first.time, 0) - finiteNumber(second.time, 0));
      for (let index = 1; index < ordered.length; index += 1) {
        const previous = ordered[index - 1];
        const current = ordered[index];
        const previousTime = selected.has(String(previous.id))
          ? candidateTimes.get(String(previous.id))
          : finiteNumber(previous.time, 0);
        const currentTime = selected.has(String(current.id))
          ? candidateTimes.get(String(current.id))
          : finiteNumber(current.time, 0);
        if (currentTime - previousTime <= epsilon) return false;
      }
    }
    return true;
  }

  function candidateMoveTimes(keyframes, selectedIds, primaryId, targetTime, options = {}) {
    const selected = keyIdSet(selectedIds);
    const primary = keyframes.find((keyframe) => String(keyframe.id) === String(primaryId));
    if (!primary || !selected.has(String(primary.id))) return null;
    const delta = targetTime - finiteNumber(primary.time, 0);
    const mode = options.mode || "frame";
    const fps = options.fps || 24;
    const maximum = finiteNumber(options.maximum, 60);
    const candidates = new Map();
    keyframes.forEach((keyframe) => {
      if (selected.has(String(keyframe.id))) {
        candidates.set(String(keyframe.id), snapTime(finiteNumber(keyframe.time, 0) + delta, mode, fps, 0, maximum));
      }
    });
    if ([...candidates.values()].some((time) => time < -0.00001 || time > maximum + 0.00001)) return null;
    return candidates;
  }

  function moveSelection(keyframes = [], ids = [], primaryId = "", requestedTime = 0, options = {}) {
    const mode = options.mode || "frame";
    const fps = options.fps || 24;
    const maximum = finiteNumber(options.maximum, 60);
    const selection = normalizedSelection(keyframes, ids, primaryId);
    if (!selection.ids.length || !selection.primaryId) return { ok: false, reason: "empty", keyframes: [...keyframes] };
    const expandedIds = expandSynchronizedCutSelection(keyframes, selection.ids);
    const primary = keyframes.find((keyframe) => String(keyframe.id) === selection.primaryId);
    const range = selectionRange(keyframes, expandedIds);
    const minimumTarget = finiteNumber(primary.time, 0) - range.start;
    const maximumTarget = maximum - (range.end - finiteNumber(primary.time, 0));
    const snapped = snapTime(requestedTime, mode, fps, minimumTarget, maximumTarget);
    const step = snapStep(mode, fps);
    const epsilon = collisionEpsilon(mode, fps);
    const initialCandidates = candidateMoveTimes(keyframes, expandedIds, selection.primaryId, snapped, { maximum, mode, fps });
    if (!initialCandidates || !preservesSourceOrder(keyframes, expandedIds, initialCandidates, epsilon)) {
      return { ok: false, reason: "order", keyframes: [...keyframes] };
    }
    const maxAttempts = Math.ceil(maximum / Math.max(step, 0.01)) + 2;
    let candidates = null;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const offsets = attempt === 0 ? [0] : [attempt * step, -attempt * step];
      for (const offset of offsets) {
        const candidateTarget = snapTime(snapped + offset, mode, fps, minimumTarget, maximumTarget);
        const next = candidateMoveTimes(keyframes, expandedIds, selection.primaryId, candidateTarget, { maximum, mode, fps });
        if (!next
          || hasTimingCollision(keyframes, expandedIds, next, epsilon)
          || !preservesSourceOrder(keyframes, expandedIds, next, epsilon)) continue;
        candidates = next;
        break;
      }
      if (candidates) break;
    }
    if (!candidates) return { ok: false, reason: "collision", keyframes: [...keyframes] };
    return {
      ok: true,
      ids: expandedIds,
      primaryId: selection.primaryId,
      keyframes: keyframes.map((keyframe) => candidates.has(String(keyframe.id))
        ? { ...keyframe, time: candidates.get(String(keyframe.id)) }
        : { ...keyframe }),
    };
  }

  function scaleSelection(keyframes = [], ids = [], requestedDuration = 0, options = {}) {
    const mode = options.mode || "frame";
    const fps = options.fps || 24;
    const maximum = finiteNumber(options.maximum, 60);
    const expandedIds = expandSynchronizedCutSelection(keyframes, ids);
    const range = selectionRange(keyframes, expandedIds);
    if (!range || range.count < 2 || range.duration <= 0) return { ok: false, reason: "range", keyframes: [...keyframes] };
    const duration = snapTime(requestedDuration, mode, fps, snapStep(mode, fps), maximum - range.start);
    const scale = duration / range.duration;
    const candidates = new Map();
    keyframes.forEach((keyframe) => {
      if (!keyIdSet(expandedIds).has(String(keyframe.id))) return;
      const relative = finiteNumber(keyframe.time, 0) - range.start;
      candidates.set(String(keyframe.id), snapTime(range.start + relative * scale, mode, fps, 0, maximum));
    });
    const epsilon = collisionEpsilon(mode, fps);
    if (!preservesSourceOrder(keyframes, expandedIds, candidates, epsilon)) {
      return { ok: false, reason: "order", keyframes: [...keyframes] };
    }
    if (hasTimingCollision(keyframes, expandedIds, candidates, epsilon)) {
      return { ok: false, reason: "collision", keyframes: [...keyframes] };
    }
    return {
      ok: true,
      ids: expandedIds,
      duration,
      keyframes: keyframes.map((keyframe) => candidates.has(String(keyframe.id))
        ? { ...keyframe, time: candidates.get(String(keyframe.id)) }
        : { ...keyframe }),
    };
  }

  function pasteTimes(keyframes = [], clipboard = [], playhead = 0, options = {}) {
    if (!clipboard.length) return { ok: false, reason: "empty", times: [] };
    const mode = options.mode || "frame";
    const fps = options.fps || 24;
    const maximum = finiteNumber(options.maximum, 60);
    const maxOffset = Math.max(...clipboard.map((entry) => finiteNumber(entry.offset, 0)));
    const base = snapTime(playhead, mode, fps, 0, maximum - maxOffset);
    const step = snapStep(mode, fps);
    const epsilon = collisionEpsilon(mode, fps);
    const occupied = keyframes.map((keyframe) => ({ source: keyframe.source, time: finiteNumber(keyframe.time, 0) }));
    const maxAttempts = Math.ceil(maximum / Math.max(step, 0.01)) + 2;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const offsets = attempt === 0 ? [0] : [attempt * step, -attempt * step];
      for (const shift of offsets) {
        const candidateBase = snapTime(base + shift, mode, fps, 0, maximum - maxOffset);
        const times = clipboard.map((entry) => snapTime(candidateBase + finiteNumber(entry.offset, 0), mode, fps, 0, maximum));
        const collision = clipboard.some((entry, index) => (
          occupied.some((keyframe) => keyframe.source === entry.source && sameTime(keyframe.time, times[index], epsilon))
          || clipboard.some((other, otherIndex) => otherIndex > index && other.source === entry.source && sameTime(times[index], times[otherIndex], epsilon))
        ));
        if (!collision) return { ok: true, baseTime: candidateBase, times };
      }
    }
    return { ok: false, reason: "collision", times: [] };
  }

  return {
    collisionEpsilon,
    expandSynchronizedCutSelection,
    moveSelection,
    normalizedSelection,
    pasteTimes,
    preservesSourceOrder,
    roundTime,
    sameTime,
    scaleSelection,
    selectionRange,
    snapStep,
    snapTime,
  };
});
