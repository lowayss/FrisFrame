"use strict";

const MAX_CLIPBOARD_IMAGE_BYTES = 64 * 1024 * 1024;
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function registerClipboardImageHandler({ ipcMain, clipboard, nativeImage, getAllowedOrigin }) {
  ipcMain.handle("clipboard:write-image", (event, pngBytes) => {
    const allowedOrigin = getAllowedOrigin();
    const senderUrl = event.senderFrame?.url || event.sender?.getURL?.() || "";
    let senderOrigin = "";
    try {
      senderOrigin = new URL(senderUrl).origin;
    } catch {
      // An invalid sender URL is never trusted.
    }
    if (!allowedOrigin || senderOrigin !== allowedOrigin) {
      throw new Error("허용되지 않은 화면의 클립보드 요청입니다.");
    }
    if (!(pngBytes instanceof Uint8Array)) throw new TypeError("PNG 이미지 데이터가 필요합니다.");
    if (!pngBytes.byteLength || pngBytes.byteLength > MAX_CLIPBOARD_IMAGE_BYTES) {
      throw new RangeError("복사할 이미지 크기가 올바르지 않습니다.");
    }
    if (!PNG_SIGNATURE.every((value, index) => pngBytes[index] === value)) {
      throw new TypeError("PNG 형식의 이미지만 복사할 수 있습니다.");
    }
    const image = nativeImage.createFromBuffer(Buffer.from(pngBytes));
    if (image.isEmpty()) throw new Error("PNG 이미지를 읽지 못했습니다.");
    clipboard.writeImage(image);
    const copiedImage = clipboard.readImage();
    if (copiedImage.isEmpty()) throw new Error("시스템 클립보드에 이미지를 기록하지 못했습니다.");
    return { ok: true, size: copiedImage.getSize() };
  });
}

module.exports = { registerClipboardImageHandler };
