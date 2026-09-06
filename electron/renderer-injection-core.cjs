"use strict";

const DEFAULT_SCRIPT_TIMEOUT_MS = 8000;
const COMPLETE_SENTINEL = "__FRISFRAME_RENDERER_SCRIPT_COMPLETE__";
const STALE_SENTINEL = "__FRISFRAME_RENDERER_SCRIPT_STALE__";
let injectorSequence = 0;

function normalizeEntries(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new TypeError("renderer injection entries must be a non-empty array");
  }
  const seen = new Set();
  return Object.freeze(entries.map((entry) => {
    const filename = String(entry?.filename || "").trim();
    const source = String(entry?.source ?? "");
    if (!filename || !source.trim()) {
      throw new TypeError("renderer injection entries require filename and source");
    }
    if (seen.has(filename)) {
      throw new Error(`duplicate renderer injection entry: ${filename}`);
    }
    seen.add(filename);
    return Object.freeze({ filename, source });
  }));
}

function withTimeout(promise, timeoutMs, message) {
  const milliseconds = Number.isFinite(Number(timeoutMs))
    ? Math.max(1, Math.trunc(Number(timeoutMs)))
    : DEFAULT_SCRIPT_TIMEOUT_MS;
  let timer = null;
  const timeout = new Promise((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(`${message} (${milliseconds}ms)`)), milliseconds);
  });
  return Promise.race([Promise.resolve(promise), timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function createRendererInjector({
  webContents,
  entries,
  label = "renderer bundle",
  timeoutMs = DEFAULT_SCRIPT_TIMEOUT_MS,
  onError = () => {},
} = {}) {
  if (!webContents || typeof webContents.executeJavaScript !== "function") {
    throw new TypeError("renderer injector requires webContents.executeJavaScript");
  }
  if (typeof onError !== "function") throw new TypeError("renderer injector onError must be a function");

  const normalizedEntries = normalizeEntries(entries);
  const injectorId = `__frisframeRendererInjector${++injectorSequence}`;
  let generation = 0;
  let injectedGeneration = -1;
  let failedGeneration = -1;
  let failedError = null;
  let inFlight = null;

  const currentGeneration = () => generation;

  function markLoadStarted() {
    generation += 1;
    failedGeneration = -1;
    failedError = null;
    return generation;
  }

  function getState() {
    return Object.freeze({
      generation,
      injectedGeneration,
      failedGeneration,
      injectingGeneration: inFlight?.generation ?? null,
    });
  }

  function destroyed() {
    return Boolean(webContents.isDestroyed?.());
  }

  async function run(targetGeneration) {
    if (targetGeneration !== generation) {
      return { status: "stale", generation: targetGeneration };
    }
    if (destroyed()) {
      return { status: "destroyed", generation: targetGeneration };
    }

    const token = `${injectorId}:${targetGeneration}`;
    await withTimeout(
      webContents.executeJavaScript(
        `globalThis[${JSON.stringify(injectorId)}]=${JSON.stringify(token)};`,
        true,
      ),
      timeoutMs,
      `${label} generation guard timed out`,
    );

    for (const entry of normalizedEntries) {
      if (targetGeneration !== generation) {
        return { status: "stale", generation: targetGeneration };
      }
      if (destroyed()) {
        return { status: "destroyed", generation: targetGeneration };
      }
      const guardedSource = `(()=>{\nif(globalThis[${JSON.stringify(injectorId)}]!==${JSON.stringify(token)})return ${JSON.stringify(STALE_SENTINEL)};\n${entry.source}\nreturn ${JSON.stringify(COMPLETE_SENTINEL)};\n})()`;
      let result;
      try {
        result = await withTimeout(
          webContents.executeJavaScript(guardedSource, true),
          timeoutMs,
          `${label} · ${entry.filename} timed out`,
        );
      } catch (cause) {
        const error = new Error(`${label} · ${entry.filename} injection failed: ${cause?.message || cause}`);
        error.code = "renderer_injection_failed";
        error.filename = entry.filename;
        error.generation = targetGeneration;
        error.cause = cause;
        throw error;
      }
      if (result === STALE_SENTINEL || targetGeneration !== generation) {
        return { status: "stale", generation: targetGeneration, filename: entry.filename };
      }
      if (result !== COMPLETE_SENTINEL) {
        const error = new Error(`${label} · ${entry.filename} did not complete its guarded injection`);
        error.code = "renderer_injection_incomplete";
        error.filename = entry.filename;
        error.generation = targetGeneration;
        throw error;
      }
    }

    if (targetGeneration !== generation) {
      return { status: "stale", generation: targetGeneration };
    }
    injectedGeneration = targetGeneration;
    return { status: "injected", generation: targetGeneration, count: normalizedEntries.length };
  }

  function inject(targetGeneration = generation) {
    if (targetGeneration !== generation) {
      return Promise.resolve({ status: "stale", generation: targetGeneration });
    }
    if (destroyed()) {
      return Promise.resolve({ status: "destroyed", generation: targetGeneration });
    }
    if (injectedGeneration === targetGeneration) {
      return Promise.resolve({ status: "already-injected", generation: targetGeneration, count: normalizedEntries.length });
    }
    if (failedGeneration === targetGeneration && failedError) {
      return Promise.reject(failedError);
    }
    if (inFlight?.generation === targetGeneration) return inFlight.promise;

    const promise = run(targetGeneration).catch((error) => {
      if (targetGeneration === generation) {
        failedGeneration = targetGeneration;
        failedError = error;
      }
      try {
        onError(error, { label, generation: targetGeneration });
      } catch {
        // Error reporting must never replace the original injection failure.
      }
      throw error;
    }).finally(() => {
      if (inFlight?.promise === promise) inFlight = null;
    });
    inFlight = { generation: targetGeneration, promise };
    return promise;
  }

  return Object.freeze({
    currentGeneration,
    getState,
    inject,
    injectCurrent: () => inject(generation),
    markLoadStarted,
  });
}

module.exports = Object.freeze({
  COMPLETE_SENTINEL,
  DEFAULT_SCRIPT_TIMEOUT_MS,
  STALE_SENTINEL,
  createRendererInjector,
  normalizeEntries,
  withTimeout,
});
