"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("frisframePhoneRemote", Object.freeze({
  start: () => ipcRenderer.invoke("phone-remote:start"),
  stop: () => ipcRenderer.invoke("phone-remote:stop"),
  status: () => ipcRenderer.invoke("phone-remote:status"),
  onMotionInput: (callback) => {
    if (typeof callback !== "function") return () => {};
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("phone-motion:input", listener);
    return () => ipcRenderer.removeListener("phone-motion:input", listener);
  },
}));