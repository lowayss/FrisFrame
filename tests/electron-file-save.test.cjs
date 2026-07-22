"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { registerFileSaveHandler, safeFilename } = require("../electron/file-save.cjs");

async function run() {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "frisframe-save-"));
  const destination = path.join(temporary, "preview.png");
  let handler;
  registerFileSaveHandler({
    ipcMain: { handle: (channel, callback) => {
      assert.equal(channel, "file:save");
      handler = callback;
    } },
    dialog: { showSaveDialog: async () => ({ canceled: false, filePath: destination }) },
    getAllowedOrigin: () => "http://127.0.0.1:8766",
    getDefaultDirectory: () => temporary,
    getOwnerWindow: () => undefined,
  });
  const event = { senderFrame: { url: "http://127.0.0.1:8766/editor" } };
  const result = await handler(event, { filename: "../preview.png", bytes: new Uint8Array([1, 2, 3]) });
  assert.deepEqual(result, { ok: true, canceled: false, filename: "preview.png" });
  assert.deepEqual([...fs.readFileSync(destination)], [1, 2, 3]);
  assert.equal(safeFilename("../../shot.mp4"), "shot.mp4");
  await assert.rejects(
    () => handler({ senderFrame: { url: "http://evil.invalid/" } }, { filename: "x.png", bytes: new Uint8Array([1]) }),
    /허용되지 않은 화면/,
  );
  fs.rmSync(temporary, { recursive: true, force: true });
  console.log("electron-file-save: native dialog save and origin validation passed");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
