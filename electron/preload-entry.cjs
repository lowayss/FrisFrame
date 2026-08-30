"use strict";

require("./preload.cjs");

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("frisframePhoneRemote", Object.freeze({
  start: () => ipcRenderer.invoke("phone-remote:start"),
  stop: () => ipcRenderer.invoke("phone-remote:stop"),
  status: () => ipcRenderer.invoke("phone-remote:status"),
}));
