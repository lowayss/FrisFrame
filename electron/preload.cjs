"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("frisframeDesktop", Object.freeze({
  isDesktop: true,
  platform: process.platform,
  copyImage: (pngBytes) => ipcRenderer.invoke("clipboard:write-image", pngBytes),
  saveFile: (payload) => ipcRenderer.invoke("file:save", payload),
}));
