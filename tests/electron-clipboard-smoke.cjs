"use strict";

const { app, BrowserWindow, clipboard, ipcMain, nativeImage } = require("electron");
const http = require("node:http");
const path = require("node:path");
const { registerClipboardImageHandler } = require("../electron/clipboard.cjs");

let server;
let window;

function listen() {
  return new Promise((resolve) => {
    server = http.createServer((_request, response) => {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end("<!doctype html><title>Clipboard smoke test</title>");
    });
    server.listen(0, "127.0.0.1", () => resolve(server.address().port));
  });
}

async function run() {
  await app.whenReady();
  const previousImage = clipboard.readImage();
  const previousPng = previousImage.isEmpty() ? null : previousImage.toPNG();
  const previousText = clipboard.readText();
  const port = await listen();
  const origin = `http://127.0.0.1:${port}`;
  registerClipboardImageHandler({ ipcMain, clipboard, nativeImage, getAllowedOrigin: () => origin });
  window = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "../electron/preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  try {
    await window.loadURL(`${origin}/`);
    const result = await window.webContents.executeJavaScript(`(async () => {
      const canvas = document.createElement("canvas");
      canvas.width = 2;
      canvas.height = 1;
      const context = canvas.getContext("2d");
      context.fillStyle = "#ff3355";
      context.fillRect(0, 0, 2, 1);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      const bytes = new Uint8Array(await blob.arrayBuffer());
      return window.frisframeDesktop.copyImage(bytes);
    })()`);
    const copied = clipboard.readImage();
    if (!result?.ok || copied.isEmpty()) throw new Error("Electron image clipboard result was empty.");
    const size = copied.getSize();
    if (size.width !== 2 || size.height !== 1) throw new Error(`Unexpected clipboard size: ${size.width}x${size.height}`);
    process.stdout.write(`electron-clipboard-smoke: copied ${size.width}x${size.height} PNG\n`);
  } finally {
    if (previousPng) clipboard.writeImage(nativeImage.createFromBuffer(previousPng));
    else if (previousText) clipboard.writeText(previousText);
    else clipboard.clear();
    window?.destroy();
    await new Promise((resolve) => server?.close(resolve));
    app.quit();
  }
}

run().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  app.exit(1);
});
