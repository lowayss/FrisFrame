"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { app } = require("electron");

const TAKE_PRELUDE_FILES = Object.freeze([
  "phone-motion-ipc-ux.js",
  "camera-take-path-core.js",
  "camera-take-replay-ux.js",
]);

function readPreludeSources() {
  return TAKE_PRELUDE_FILES.map((filename) => ({
    filename,
    source:fs.readFileSync(path.join(__dirname, filename), "utf8"),
  }));
}

function installTakePrelude(webContents) {
  if (!webContents || webContents.isDestroyed?.()) return;
  if (webContents.__frisframeTakePreludeInstalled === true) return;
  webContents.__frisframeTakePreludeInstalled = true;
  const originalOn = webContents.on.bind(webContents);
  const sources = readPreludeSources();
  let loadGeneration = 0;
  let injectedGeneration = -1;
  let injectionPromise = null;

  originalOn("did-start-loading", () => {
    loadGeneration += 1;
    injectionPromise = null;
  });

  const inject = () => {
    if (injectedGeneration === loadGeneration) return Promise.resolve();
    if (injectionPromise) return injectionPromise;
    injectionPromise = (async () => {
      for (const entry of sources) {
        if (webContents.isDestroyed?.()) return;
        await webContents.executeJavaScript(entry.source, true);
      }
      injectedGeneration = loadGeneration;
    })().catch((error) => {
      process.stderr.write(`[FrisFrame] camera take prelude failed: ${error?.stack || error}\n`);
    });
    return injectionPromise;
  };

  webContents.on = function patchedOn(eventName, listener) {
    if (eventName !== "did-finish-load" || typeof listener !== "function") {
      return originalOn(eventName, listener);
    }
    return originalOn(eventName, (...args) => {
      inject().finally(() => listener(...args));
    });
  };
}

app.on("web-contents-created", (_event, webContents) => installTakePrelude(webContents));

// Keep the original module as the stable import path, but replace only the
// Physical Camera bridge implementation before main.cjs loads it. This keeps
// the precision transport isolated to this refinement branch without changing
// the public desktop bootstrap contract.
const legacyPhoneMotionServer = require("./phone-motion-server.cjs");
const precisionPhoneMotionServer = require("./phone-motion-server-v2.cjs");
legacyPhoneMotionServer.createPhoneMotionBridge = precisionPhoneMotionServer.createPhoneMotionBridge;

require("./main.cjs");