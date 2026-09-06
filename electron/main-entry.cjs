"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { app } = require("electron");
const { createRendererInjector } = require("./renderer-injection-core.cjs");

const TAKE_PRELUDE_FILES = Object.freeze([
  "camera-take-path-core.js",
  "camera-take-replay-ux.js",
]);

function readPreludeSources() {
  return TAKE_PRELUDE_FILES.map((filename) => ({
    filename,
    source: fs.readFileSync(path.join(__dirname, filename), "utf8"),
  }));
}

function installTakePrelude(webContents) {
  if (!webContents || webContents.isDestroyed?.()) return;
  if (webContents.__frisframeTakePreludeInstalled === true) return;
  webContents.__frisframeTakePreludeInstalled = true;
  const originalOn = webContents.on.bind(webContents);
  const injector = createRendererInjector({
    webContents,
    entries: readPreludeSources(),
    label: "camera take prelude",
    onError: (error) => {
      process.stderr.write(`[FrisFrame] camera take prelude failed: ${error?.stack || error}\n`);
    },
  });
  webContents.__frisframeTakePreludeInjector = injector;

  originalOn("did-start-loading", () => injector.markLoadStarted());

  webContents.on = function patchedOn(eventName, listener) {
    if (eventName !== "did-finish-load" || typeof listener !== "function") {
      return originalOn(eventName, listener);
    }
    return originalOn(eventName, (...args) => {
      injector.injectCurrent().then((result) => {
        if (result.status === "stale" || result.status === "destroyed") return;
        listener(...args);
      }).catch(() => {
        // Fail closed: dependent renderer UX must not run after a partial prelude.
      });
    });
  };
}

app.on("web-contents-created", (_event, webContents) => installTakePrelude(webContents));

require("./main.cjs");
