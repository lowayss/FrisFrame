const assert = require("node:assert/strict");
const test = require("node:test");

const {
  COMPLETE_SENTINEL,
  STALE_SENTINEL,
  createRendererInjector,
  normalizeEntries,
} = require("../electron/renderer-injection-core.cjs");

const tick = () => new Promise((resolve) => setImmediate(resolve));

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

test("renderer entries reject duplicate or incomplete manifests before injection", () => {
  assert.throws(() => normalizeEntries([]), /non-empty array/);
  assert.throws(() => normalizeEntries([{ filename: "a.js", source: "" }]), /filename and source/);
  assert.throws(() => normalizeEntries([
    { filename: "a.js", source: "one" },
    { filename: "a.js", source: "two" },
  ]), /duplicate renderer injection entry/);
});

test("renderer scripts execute strictly in manifest order", async () => {
  const first = deferred();
  const calls = [];
  const webContents = {
    isDestroyed: () => false,
    executeJavaScript(source) {
      if (source.startsWith("globalThis[")) {
        calls.push("guard");
        return Promise.resolve();
      }
      if (source.includes("FIRST_MARKER")) {
        calls.push("first");
        return first.promise;
      }
      if (source.includes("SECOND_MARKER")) {
        calls.push("second");
        return Promise.resolve(COMPLETE_SENTINEL);
      }
      throw new Error("unexpected source");
    },
  };
  const injector = createRendererInjector({
    webContents,
    entries: [
      { filename: "first.js", source: "void 'FIRST_MARKER';" },
      { filename: "second.js", source: "void 'SECOND_MARKER';" },
    ],
  });
  injector.markLoadStarted();
  const injection = injector.injectCurrent();
  await tick();
  assert.deepEqual(calls, ["guard", "first"], "second module must wait for the first module to finish");
  first.resolve(COMPLETE_SENTINEL);
  const result = await injection;
  assert.equal(result.status, "injected");
  assert.deepEqual(calls, ["guard", "first", "second"]);
});

test("concurrent requests for the same load generation coalesce", async () => {
  const pending = deferred();
  let entryCalls = 0;
  const webContents = {
    isDestroyed: () => false,
    executeJavaScript(source) {
      if (source.startsWith("globalThis[")) return Promise.resolve();
      entryCalls += 1;
      return pending.promise;
    },
  };
  const injector = createRendererInjector({
    webContents,
    entries: [{ filename: "only.js", source: "void 'ONLY';" }],
  });
  injector.markLoadStarted();
  const first = injector.injectCurrent();
  const second = injector.injectCurrent();
  assert.equal(first, second, "same-generation callers must share one injection promise");
  await tick();
  assert.equal(entryCalls, 1);
  pending.resolve(COMPLETE_SENTINEL);
  await first;
  const already = await injector.injectCurrent();
  assert.equal(already.status, "already-injected");
  assert.equal(entryCalls, 1);
});

test("a navigation generation change stops the old bundle before later modules", async () => {
  const first = deferred();
  const calls = [];
  let nextGeneration = false;
  const webContents = {
    isDestroyed: () => false,
    executeJavaScript(source) {
      if (source.startsWith("globalThis[")) {
        calls.push(nextGeneration ? "guard-2" : "guard-1");
        return Promise.resolve();
      }
      if (source.includes("FIRST_MARKER")) {
        calls.push(nextGeneration ? "first-2" : "first-1");
        return nextGeneration ? Promise.resolve(COMPLETE_SENTINEL) : first.promise;
      }
      if (source.includes("SECOND_MARKER")) {
        calls.push(nextGeneration ? "second-2" : "second-1");
        return Promise.resolve(COMPLETE_SENTINEL);
      }
      throw new Error("unexpected source");
    },
  };
  const injector = createRendererInjector({
    webContents,
    entries: [
      { filename: "first.js", source: "void 'FIRST_MARKER';" },
      { filename: "second.js", source: "void 'SECOND_MARKER';" },
    ],
  });
  injector.markLoadStarted();
  const oldRun = injector.injectCurrent();
  await tick();
  nextGeneration = true;
  injector.markLoadStarted();
  first.resolve(COMPLETE_SENTINEL);
  const stale = await oldRun;
  assert.equal(stale.status, "stale");
  assert.equal(calls.includes("second-1"), false, "old generation must not continue into dependent modules");

  const fresh = await injector.injectCurrent();
  assert.equal(fresh.status, "injected");
  assert.deepEqual(calls.slice(-3), ["guard-2", "first-2", "second-2"]);
});

test("a failed generation is fail-closed until the next page load", async () => {
  let attempts = 0;
  let fail = true;
  const observed = [];
  const webContents = {
    isDestroyed: () => false,
    executeJavaScript(source) {
      if (source.startsWith("globalThis[")) return Promise.resolve();
      attempts += 1;
      if (fail) return Promise.reject(new Error("boom"));
      return Promise.resolve(COMPLETE_SENTINEL);
    },
  };
  const injector = createRendererInjector({
    webContents,
    entries: [{ filename: "fragile.js", source: "void 'FRAGILE';" }],
    onError: (error) => observed.push(error.filename),
  });
  injector.markLoadStarted();
  await assert.rejects(injector.injectCurrent(), (error) => {
    assert.equal(error.code, "renderer_injection_failed");
    assert.equal(error.filename, "fragile.js");
    return true;
  });
  await assert.rejects(injector.injectCurrent(), /fragile\.js injection failed/);
  assert.equal(attempts, 1, "same failed generation must not retry a partially initialized module");
  assert.deepEqual(observed, ["fragile.js"]);

  fail = false;
  injector.markLoadStarted();
  const result = await injector.injectCurrent();
  assert.equal(result.status, "injected");
  assert.equal(attempts, 2, "a fresh renderer generation may retry from a clean document");
});

test("guarded stale execution does not count as a successful injection", async () => {
  const webContents = {
    isDestroyed: () => false,
    executeJavaScript(source) {
      if (source.startsWith("globalThis[")) return Promise.resolve();
      return Promise.resolve(STALE_SENTINEL);
    },
  };
  const injector = createRendererInjector({
    webContents,
    entries: [{ filename: "stale.js", source: "void 'STALE';" }],
  });
  injector.markLoadStarted();
  const result = await injector.injectCurrent();
  assert.equal(result.status, "stale");
  assert.equal(injector.getState().injectedGeneration, -1);
});

test("a hung renderer module is bounded and reported once", async () => {
  const observed = [];
  const webContents = {
    isDestroyed: () => false,
    executeJavaScript(source) {
      if (source.startsWith("globalThis[")) return Promise.resolve();
      return new Promise(() => {});
    },
  };
  const injector = createRendererInjector({
    webContents,
    entries: [{ filename: "hung.js", source: "void 'HUNG';" }],
    timeoutMs: 12,
    onError: (error) => observed.push(error.filename),
  });
  injector.markLoadStarted();
  await assert.rejects(injector.injectCurrent(), /hung\.js injection failed: .*timed out/);
  assert.deepEqual(observed, ["hung.js"]);
});

test("destroyed web contents short-circuits without executing renderer code", async () => {
  let calls = 0;
  const injector = createRendererInjector({
    webContents: {
      isDestroyed: () => true,
      executeJavaScript() {
        calls += 1;
        return Promise.resolve();
      },
    },
    entries: [{ filename: "never.js", source: "void 'NEVER';" }],
  });
  injector.markLoadStarted();
  const result = await injector.injectCurrent();
  assert.equal(result.status, "destroyed");
  assert.equal(calls, 0);
});
