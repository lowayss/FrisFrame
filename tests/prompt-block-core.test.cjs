const assert = require("node:assert/strict");

const {
  addPromptBlock,
  composePromptSchedule,
  createPromptBlock,
  movePromptBlock,
  normalizePromptBlocks,
  resizePromptBlock,
  updatePromptBlock,
} = require("../prompt-block-core.js");

const first = createPromptBlock({ id: "one", source: "actor", start: 0, text: "손을 든다." }, 10);
assert.deepEqual(first, { id: "one", source: "actor", start: 0, end: 2, text: "손을 든다." });

const blocks = normalizePromptBlocks([
  { id: "late", source: "actor", start: 4, end: 6, text: "달린다." },
  { id: "early", source: "actor", start: 0, end: 2, text: "일어선다." },
  { id: "overlap", source: "actor", start: 1, end: 3, text: "겹치면 버린다." },
], 10);
assert.deepEqual(blocks.map((block) => block.id), ["early", "late"]);

const parallelActorBlocks = normalizePromptBlocks([
  { id: "actor-a", source: "actor-a", start: 0, end: 2, text: "왼쪽을 본다." },
  { id: "actor-b", source: "actor-b", start: 0, end: 2, text: "오른쪽을 본다." },
], 10);
assert.deepEqual(parallelActorBlocks.map((block) => block.id).sort(), ["actor-a", "actor-b"]);

const added = addPromptBlock(blocks, { id: "middle", source: "actor", start: 1, end: 3, text: "걷는다." }, 10);
assert.deepEqual(added.map((block) => [block.id, block.start, block.end]), [
  ["early", 0, 2],
  ["middle", 2, 4],
  ["late", 4, 6],
].sort((a, b) => a[1] - b[1]));

const moved = movePromptBlock(added, "middle", 8, 10);
assert.equal(moved.find((block) => block.id === "middle").start, 8);
const rejectedMove = movePromptBlock(moved, "middle", 3, 10);
assert.equal(rejectedMove.find((block) => block.id === "middle").start, 8);

const resized = resizePromptBlock(moved, "middle", "end", 10, 10);
assert.deepEqual(resized.find((block) => block.id === "middle"), {
  id: "middle", source: "actor", start: 8, end: 10, text: "걷는다.",
});

const updated = updatePromptBlock(resized, "middle", { text: "멈춘다." }, 10);
assert.equal(updated.find((block) => block.id === "middle").text, "멈춘다.");

assert.deepEqual(composePromptSchedule([
  { id: "actor-a", source: "actor-a", start: 0, end: 2, text: "왼쪽을 본다." },
  { id: "actor-b", source: "actor-b", start: 0, end: 2, text: "오른쪽을 본다." },
], 3, "기본 동작.", "actor-b"), [
  { start: 0, end: 2, text: "오른쪽을 본다.", source: "actor-b" },
  { start: 2, end: 3, text: "기본 동작.", source: "" },
]);

assert.deepEqual(composePromptSchedule([
  { id: "a", source: "actor", start: 1, end: 3, text: "점프한다." },
], 5, "기본 동작."), [
  { start: 0, end: 1, text: "기본 동작.", source: "actor" },
  { start: 1, end: 3, text: "점프한다.", source: "actor" },
  { start: 3, end: 5, text: "기본 동작.", source: "" },
]);

console.log("prompt-block-core: CozyClay-style prompt timeline passed");
