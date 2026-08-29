(function initPromptBlockCore(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FrisFramePromptBlockCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createPromptBlockCore() {
  const MIN_BLOCK_SECONDS = 0.5;
  const DEFAULT_BLOCK_SECONDS = 2;
  const MAX_BLOCK_SECONDS = 5;
  const MAX_BLOCKS = 32;
  const MAX_TEXT_LENGTH = 500;

  function finiteNumber(value, fallback = 0) {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
    const safeFallback = Number(fallback);
    return Number.isFinite(safeFallback) ? safeFallback : 0;
  }

  function clamp(value, min, max) {
    const lower = finiteNumber(min, 0);
    const upper = Math.max(lower, finiteNumber(max, lower));
    return Math.max(lower, Math.min(upper, finiteNumber(value, lower)));
  }

  function normalizePromptBlock(input = {}, index = 0, maxDuration = 60) {
    const safeDuration = Math.max(MIN_BLOCK_SECONDS, finiteNumber(maxDuration, 60));
    const start = clamp(input.start ?? input.startTime, 0, Math.max(0, safeDuration - MIN_BLOCK_SECONDS));
    const rawEnd = input.end ?? input.endTime ?? (start + finiteNumber(input.duration, DEFAULT_BLOCK_SECONDS));
    const end = clamp(Math.max(start + MIN_BLOCK_SECONDS, finiteNumber(rawEnd, start + DEFAULT_BLOCK_SECONDS)), start + MIN_BLOCK_SECONDS, safeDuration);
    const text = String(input.text ?? input.prompt ?? "").trim().slice(0, MAX_TEXT_LENGTH);
    return {
      id: String(input.id || `prompt-block-${index + 1}`),
      source: String(input.source || ""),
      start: Number(start.toFixed(4)),
      end: Number(end.toFixed(4)),
      text,
    };
  }

  function overlaps(a, b) {
    return a.id !== b.id
      && a.source === b.source
      && a.start < b.end
      && a.end > b.start;
  }

  function normalizePromptBlocks(blocks, maxDuration = 60) {
    if (!Array.isArray(blocks)) return [];
    const seen = new Set();
    const ordered = blocks
      .map((block, index) => normalizePromptBlock(block, index, maxDuration))
      .filter((block) => {
        if (!block.source || seen.has(block.id)) return false;
        seen.add(block.id);
        return true;
      })
      .sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
    const result = [];
    for (const block of ordered) {
      if (result.some((existing) => overlaps(existing, block))) continue;
      result.push(block);
      if (result.length >= MAX_BLOCKS) break;
    }
    return result;
  }

  function createPromptBlock({ id = "", source = "", start = 0, end = null, text = "" } = {}, maxDuration = 60) {
    return normalizePromptBlock({
      id,
      source,
      start,
      end: end == null ? finiteNumber(start, 0) + DEFAULT_BLOCK_SECONDS : end,
      text,
    }, 0, maxDuration);
  }

  function nextFreeStart(blocks, requestedStart, duration, maxDuration = 60, source = "") {
    const safeDuration = Math.max(MIN_BLOCK_SECONDS, finiteNumber(maxDuration, 60));
    const safeLength = clamp(duration, MIN_BLOCK_SECONDS, Math.min(MAX_BLOCK_SECONDS, safeDuration));
    let start = clamp(requestedStart, 0, Math.max(0, safeDuration - safeLength));
    const ordered = normalizePromptBlocks(blocks, safeDuration)
      .filter((block) => !source || block.source === source);
    for (const block of ordered) {
      if (start + safeLength <= block.start || start >= block.end) continue;
      start = block.end;
      if (start + safeLength <= safeDuration) continue;
      return null;
    }
    return Number(start.toFixed(4));
  }

  function addPromptBlock(blocks, input = {}, maxDuration = 60) {
    const current = normalizePromptBlocks(blocks, maxDuration);
    if (current.length >= MAX_BLOCKS) return current;
    const candidate = createPromptBlock(input, maxDuration);
    const start = nextFreeStart(current, candidate.start, candidate.end - candidate.start, maxDuration, candidate.source);
    if (start == null) return current;
    const added = { ...candidate, start, end: Number((start + candidate.end - candidate.start).toFixed(4)) };
    return normalizePromptBlocks([...current, added], maxDuration);
  }

  function movePromptBlock(blocks, id, requestedStart, maxDuration = 60) {
    const current = normalizePromptBlocks(blocks, maxDuration);
    const target = current.find((block) => block.id === id);
    if (!target) return current;
    const length = target.end - target.start;
    const start = clamp(requestedStart, 0, Math.max(0, finiteNumber(maxDuration, 60) - length));
    const moved = { ...target, start: Number(start.toFixed(4)), end: Number((start + length).toFixed(4)) };
    if (current.some((block) => overlaps(block, moved))) return current;
    return current.map((block) => block.id === id ? moved : block).sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
  }

  function resizePromptBlock(blocks, id, edge, requestedTime, maxDuration = 60) {
    const current = normalizePromptBlocks(blocks, maxDuration);
    const target = current.find((block) => block.id === id);
    if (!target || !["start", "end"].includes(edge)) return current;
    const safeDuration = finiteNumber(maxDuration, 60);
    const next = { ...target };
    if (edge === "start") {
      next.start = clamp(requestedTime, 0, target.end - MIN_BLOCK_SECONDS);
    } else {
      next.end = clamp(requestedTime, target.start + MIN_BLOCK_SECONDS, safeDuration);
    }
    if (next.end - next.start > MAX_BLOCK_SECONDS) {
      if (edge === "start") next.start = next.end - MAX_BLOCK_SECONDS;
      else next.end = next.start + MAX_BLOCK_SECONDS;
    }
    next.start = Number(next.start.toFixed(4));
    next.end = Number(next.end.toFixed(4));
    if (current.some((block) => overlaps(block, next))) return current;
    return current.map((block) => block.id === id ? next : block).sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
  }

  function updatePromptBlock(blocks, id, patch = {}, maxDuration = 60) {
    const current = normalizePromptBlocks(blocks, maxDuration);
    const target = current.find((block) => block.id === id);
    if (!target) return current;
    const next = normalizePromptBlock({ ...target, ...patch }, 0, maxDuration);
    if (current.some((block) => overlaps(block, next))) return current;
    return current.map((block) => block.id === id ? next : block).sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
  }

  function removePromptBlock(blocks, id, maxDuration = 60) {
    return normalizePromptBlocks(blocks, maxDuration).filter((block) => block.id !== id);
  }

  function promptBlockAtTime(blocks, time, source = "") {
    const current = finiteNumber(time, 0);
    return normalizePromptBlocks(blocks).find((block) => (!source || block.source === source) && current >= block.start && current < block.end) || null;
  }

  function composePromptSchedule(blocks, duration, fallbackText = "", source = "") {
    const safeDuration = Math.max(MIN_BLOCK_SECONDS, finiteNumber(duration, 60));
    const schedule = [];
    let cursor = 0;
    normalizePromptBlocks(blocks, safeDuration)
      .filter((block) => !source || block.source === source)
      .forEach((block) => {
      if (block.start > cursor && fallbackText.trim()) schedule.push({ start: cursor, end: block.start, text: fallbackText.trim(), source: block.source });
      if (block.end > cursor && block.text) schedule.push({ start: block.start, end: block.end, text: block.text, source: block.source });
      cursor = Math.max(cursor, block.end);
    });
    if (cursor < safeDuration && fallbackText.trim()) schedule.push({ start: cursor, end: safeDuration, text: fallbackText.trim(), source: "" });
    return schedule;
  }

  return {
    DEFAULT_BLOCK_SECONDS,
    MAX_BLOCKS,
    MAX_BLOCK_SECONDS,
    MAX_TEXT_LENGTH,
    MIN_BLOCK_SECONDS,
    addPromptBlock,
    clamp,
    composePromptSchedule,
    createPromptBlock,
    movePromptBlock,
    normalizePromptBlock,
    normalizePromptBlocks,
    nextFreeStart,
    promptBlockAtTime,
    removePromptBlock,
    resizePromptBlock,
    updatePromptBlock,
  };
});
