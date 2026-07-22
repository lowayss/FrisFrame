"use strict";

const fs = require("node:fs");
const path = require("node:path");

const MAX_SAVE_BYTES = 1024 * 1024 * 1024;

function senderOrigin(event) {
  const senderUrl = event.senderFrame?.url || event.sender?.getURL?.() || "";
  try {
    return new URL(senderUrl).origin;
  } catch {
    return "";
  }
}

function safeFilename(value) {
  const name = path.basename(String(value || "").replaceAll("\0", "")).trim();
  if (!name || name === "." || name === "..") throw new TypeError("저장할 파일 이름이 필요합니다.");
  return name.slice(0, 240);
}

function saveDialogFilters(filename) {
  const extension = path.extname(filename).slice(1).toLowerCase();
  const labels = {
    png: "PNG 이미지",
    mp4: "MP4 영상",
    zip: "ZIP 압축 파일",
    json: "JSON 프로젝트",
    csv: "CSV 문서",
  };
  if (!extension) return [];
  return [{ name: labels[extension] || `${extension.toUpperCase()} 파일`, extensions: [extension] }];
}

function registerFileSaveHandler({ ipcMain, dialog, getAllowedOrigin, getDefaultDirectory, getOwnerWindow }) {
  ipcMain.handle("file:save", async (event, payload = {}) => {
    const allowedOrigin = getAllowedOrigin();
    if (!allowedOrigin || senderOrigin(event) !== allowedOrigin) {
      throw new Error("허용되지 않은 화면의 파일 저장 요청입니다.");
    }
    const filename = safeFilename(payload.filename);
    const bytes = payload.bytes;
    if (!(bytes instanceof Uint8Array)) throw new TypeError("저장할 파일 데이터가 필요합니다.");
    if (!bytes.byteLength || bytes.byteLength > MAX_SAVE_BYTES) {
      throw new RangeError("저장할 파일 크기가 올바르지 않습니다.");
    }
    const ownerWindow = getOwnerWindow?.(event.sender) || undefined;
    const defaultDirectory = getDefaultDirectory();
    const options = {
      title: "FrisFrame 내보내기 저장",
      buttonLabel: "저장",
      defaultPath: path.join(defaultDirectory, filename),
      filters: saveDialogFilters(filename),
    };
    const result = ownerWindow
      ? await dialog.showSaveDialog(ownerWindow, options)
      : await dialog.showSaveDialog(options);
    if (result.canceled || !result.filePath) return { ok: false, canceled: true };
    await fs.promises.writeFile(result.filePath, Buffer.from(bytes));
    return { ok: true, canceled: false, filename: path.basename(result.filePath) };
  });
}

module.exports = { MAX_SAVE_BYTES, registerFileSaveHandler, safeFilename, saveDialogFilters };
