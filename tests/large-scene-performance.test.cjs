const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { performance } = require("node:perf_hooks");

const source = fs.readFileSync(path.resolve(__dirname, "../electron/performance-ux.js"), "utf8");

const ITEM_COUNT = 320;
const KEY_COUNT = 8000;
const items = Array.from({ length: ITEM_COUNT }, (_, index) => ({
  id: `item-${index}`,
  type: index % 4 === 0 ? "actor" : "prop",
  name: `대상 ${index}`,
  color: index % 2 ? "#55c7bb" : "#ffac48",
  visible: true,
  motionEnabled: true,
  editLocked: false,
  groupId: "",
  mountId: "",
  placementMode: "floor",
  assetType: index % 4 === 0 ? "" : "chair",
  dummyType: index % 4 === 0 ? "human" : "",
}));

const sources = items.map((item) => ({
  id: item.id,
  name: item.name,
  color: item.color,
  type: item.type,
}));

const keyframes = Array.from({ length: KEY_COUNT }, (_, index) => ({
  id: `key-${index}`,
  source: sources[index % sources.length].id,
  time: (index % 1800) / 30,
  label: "",
  transition: "linear",
  note: "",
  pose: index % 9 === 0 ? { head: { x: 0, y: 0, z: 0 } } : null,
}));

const state = {
  items,
  motion: {
    timelineView: "combined",
    duration: 60,
    fps: 30,
    activeSource: "all",
    hiddenSources: [],
    keyframes,
  },
};

const counters = {
  objectLists: 0,
  sourceSelect: 0,
  keyStatus: 0,
  playhead: 0,
};

const elements = new Map();
function element(id) {
  if (!elements.has(id)) {
    elements.set(id, {
      id,
      value: "",
      hidden: id === "sourceTimelineList",
      textContent: "",
      querySelectorAll() { return []; },
    });
  }
  return elements.get(id);
}

const context = {
  console,
  performance,
  state,
  selected: null,
  timelineSelectedKeyIds: new Set(),
  document: {
    documentElement: { dataset: {} },
    activeElement: null,
    getElementById(id) {
      if (["timelineMarkers", "sourceTimelineList"].includes(id)) return null;
      return element(id);
    },
    addEventListener() {},
  },
  window: {
    addEventListener() {},
  },
  requestAnimationFrame() { return 1; },
  setTimeout,
  clearTimeout,
  normalizeHiddenSources(value) { return [...value].sort(); },
  sourceEditLocked() { return false; },
  visibleSourceDefinitions() { return sources; },
  sourceDefinitions() {
    return state.items.map((item) => ({ id: item.id, name: item.name, color: item.color, type: item.type }));
  },
  sortKeyframes(value) {
    return [...value].sort((a, b) => a.time - b.time || a.id.localeCompare(b.id));
  },
  primaryTimelineKeyId() { return ""; },
  activeSourceId() { return state.motion.activeSource; },
  displayPlayhead() { return 12.34; },
  updatePlayheadDisplay() { counters.playhead += 1; },
  renderObjectLists() { counters.objectLists += 1; },
  renderSourceSelect() { counters.sourceSelect += 1; },
  renderKeyStatus() { counters.keyStatus += 1; },
};
context.window.window = context.window;

vm.createContext(context);
vm.runInContext(source, context, { filename: "performance-ux.js" });

// First pass must build each expensive UI surface once.
context.renderObjectLists();
context.renderSourceSelect();
context.renderKeyStatus(false);
assert.equal(counters.objectLists, 1);
assert.equal(counters.sourceSelect, 1);
assert.equal(counters.keyStatus, 1);

// An unchanged large scene must reuse the existing DOM rather than rebuild it.
context.renderObjectLists();
context.renderSourceSelect();
context.renderKeyStatus(false);
assert.equal(counters.objectLists, 1, "unchanged 320-item object list should be cached");
assert.equal(counters.sourceSelect, 1, "unchanged 320-source selector should be cached");
assert.equal(counters.keyStatus, 1, "unchanged 8k-key timeline should keep its marker DOM");
assert.ok(context.window.FrisFramePerformanceUxTest.stats.cachedObjectListSkips >= 1);
assert.ok(context.window.FrisFramePerformanceUxTest.stats.cachedSourceSelectSkips >= 1);
assert.ok(context.window.FrisFramePerformanceUxTest.stats.fastPlayheadSyncs >= 1);

// Relevant authoring changes must still invalidate the corresponding cache.
state.items[0].name = "변경된 배우";
context.renderObjectLists();
context.renderSourceSelect();
assert.equal(counters.objectLists, 2, "item metadata changes must invalidate object-list cache");
assert.equal(counters.sourceSelect, 2, "source label changes must invalidate source-select cache");

state.motion.keyframes[0].time += 0.25;
context.renderKeyStatus(false);
assert.equal(counters.keyStatus, 2, "keyframe timing changes must invalidate timeline cache");

// Settle the new signatures, then simulate many playback-only UI refreshes.
context.renderObjectLists();
context.renderSourceSelect();
context.renderKeyStatus(false);
const settled = { ...counters };
const startedAt = performance.now();
for (let index = 0; index < 20; index += 1) {
  context.renderObjectLists();
  context.renderSourceSelect();
  context.renderKeyStatus(false);
}
const elapsedMs = performance.now() - startedAt;

assert.equal(counters.objectLists, settled.objectLists,
  "playback-only refreshes must not rebuild the large object list");
assert.equal(counters.sourceSelect, settled.sourceSelect,
  "playback-only refreshes must not rebuild the large source selector");
assert.equal(counters.keyStatus, settled.keyStatus,
  "playback-only refreshes must not rebuild 8k timeline markers");
assert.ok(elapsedMs < 2500,
  `20 unchanged large-scene cache checks should stay lightweight (observed ${elapsedMs.toFixed(1)}ms)`);

console.log(`large-scene-performance: ${ITEM_COUNT} items / ${KEY_COUNT} keys / 20 cached refreshes in ${elapsedMs.toFixed(1)}ms`);
