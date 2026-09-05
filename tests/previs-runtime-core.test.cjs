const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const motionCore = require("../motion-core.js");
const runtimeCore = require("../previs-runtime-core.js");
const {
  cameraReferenceProgress,
  detectRenderRuntime,
  discreteAtDestination,
  heldActorBodyPose,
  installReferenceFrameSemantics,
  interpolateFocalLength,
  smoothReferenceProgress,
} = runtimeCore;

const root = path.resolve(__dirname, "..");

function fakeDocument(contexts) {
  return { createElement: () => ({ getContext: (name) => contexts.includes(name) ? {} : null }) };
}

function near(actual, expected, epsilon = 0.000001) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} should be near ${expected}`);
}

for (const name of [
  "cameraReferenceProgress",
  "discreteAtDestination",
  "heldActorBodyPose",
  "installReferenceFrameSemantics",
  "interpolateFocalLength",
  "smoothReferenceProgress",
]) {
  assert.equal(runtimeCore[name], motionCore[name], `${name} must be re-exported from motion-core`);
}

assert.equal(
  detectRenderRuntime({ navigatorObject: { platform: "MacIntel" }, documentObject: fakeDocument(["webgl2"]) }).label,
  "Mac GPU · WebGL",
);
assert.equal(
  detectRenderRuntime({ navigatorObject: { platform: "MacIntel", gpu: {} }, documentObject: fakeDocument([]) }).label,
  "Mac GPU · WebGPU",
);
assert.equal(
  detectRenderRuntime({ rendererEngine: "webgl", navigatorObject: { platform: "MacIntel", gpu: {} }, documentObject: fakeDocument([]) }).label,
  "Mac GPU · WebGL",
);
assert.equal(
  detectRenderRuntime({ navigatorObject: { platform: "Linux" }, documentObject: fakeDocument([]) }).label,
  "CPU fallback",
);

assert.equal(discreteAtDestination("actor-a", "actor-b", 0.5), "actor-a");
assert.equal(discreteAtDestination("actor-a", "actor-b", 0.999999), "actor-a");
assert.equal(discreteAtDestination("actor-a", "actor-b", 1), "actor-b");

near(interpolateFocalLength(24, 70, 0.25), 35.5);
near(interpolateFocalLength(24, 70, 0.5), 47);
near(interpolateFocalLength(24, 70, 0.75), 58.5);
const fractionalFocal = interpolateFocalLength(24, 70, 0.01);
assert.notEqual(fractionalFocal, Math.round(fractionalFocal),
  "reference focal evaluation must stay continuous rather than stepping through integer millimeters");

near(smoothReferenceProgress(0), 0);
near(smoothReferenceProgress(0.25), 0.125);
near(smoothReferenceProgress(0.5), 0.5);
near(smoothReferenceProgress(0.75), 0.875);
near(smoothReferenceProgress(1), 1);
near(cameraReferenceProgress(0.25, "smooth"), 0.125);
near(cameraReferenceProgress(0.25, "linear"), 0.25);
near(cameraReferenceProgress(0.25, "hold"), 0.25);

const neutralPose = { torso: { x: 0 }, leftArm: { x: 0, y: 0, z: 0 } };
const raisedPose = { torso: { x: 0 }, leftArm: { x: -40, y: 15, z: 5 } };
assert.deepEqual(heldActorBodyPose(neutralPose, raisedPose, 0.999999), neutralPose,
  "actor body pose must remain held until the destination key");
assert.deepEqual(heldActorBodyPose(neutralPose, raisedPose, 1), raisedPose);
const clonedPose = heldActorBodyPose(neutralPose, raisedPose, 0.5);
clonedPose.leftArm.x = 99;
assert.equal(neutralPose.leftArm.x, 0, "frame evaluation must not mutate source pose data");

const fakeWindow = {
  interpolatePoseFor(_renderState, sourceId, startPose, endPose, t, fallbackPose) {
    if (sourceId === "camera") {
      return {
        ...fallbackPose,
        ...startPose,
        evaluatedProgress: t,
        focal: Math.round(24 + (70 - 24) * t),
        trackingTargetId: t < 0.5 ? startPose.trackingTargetId : endPose.trackingTargetId,
      };
    }
    return {
      ...fallbackPose,
      ...startPose,
      type: "actor",
      evaluatedProgress: t,
      bodyPose: t >= 0.999 ? endPose.bodyPose : startPose.bodyPose,
    };
  },
  mergePoseWithFallbackFor(_renderState, _sourceId, pose, fallbackPose) {
    return { ...fallbackPose, ...pose };
  },
  sanitizeTrackingTargetId(value) {
    return ["actor-a", "actor-b"].includes(value) ? value : "";
  },
};

assert.equal(installReferenceFrameSemantics(fakeWindow), true);
assert.equal(installReferenceFrameSemantics(fakeWindow), true, "runtime patch installation must be idempotent");

const cameraFrom = { focal: 24, trackingTargetId: "actor-a" };
const cameraTo = { focal: 70, trackingTargetId: "actor-b" };
const cameraFallback = { focal: 50, trackingTargetId: "" };
const linearKey = { transition: "linear" };
const smoothKey = { transition: "smooth" };

const cameraQuarter = fakeWindow.interpolatePoseFor({}, "camera", cameraFrom, cameraTo, 0.25, cameraFallback, linearKey);
near(cameraQuarter.evaluatedProgress, 0.25);
near(cameraQuarter.focal, 35.5);
assert.equal(cameraQuarter.trackingTargetId, "actor-a");

const smoothCameraQuarter = fakeWindow.interpolatePoseFor({}, "camera", cameraFrom, cameraTo, 0.25, cameraFallback, smoothKey);
near(smoothCameraQuarter.evaluatedProgress, 0.25);
near(smoothCameraQuarter.focal, 35.5);
assert.equal(smoothCameraQuarter.trackingTargetId, "actor-a");

const smoothCameraLate = fakeWindow.interpolatePoseFor({}, "camera", cameraFrom, cameraTo, 0.75, cameraFallback, smoothKey);
near(smoothCameraLate.evaluatedProgress, 0.75);
assert.equal(smoothCameraLate.trackingTargetId, "actor-a",
  "linear camera travel must not cause a discrete tracking target to switch before destination arrival");

const cameraAlmost = fakeWindow.interpolatePoseFor({}, "camera", cameraFrom, cameraTo, 0.999999, cameraFallback, linearKey);
assert.equal(cameraAlmost.trackingTargetId, "actor-a", "patched runtime must prevent the old halfway tracking switch");
const cameraArrived = fakeWindow.interpolatePoseFor({}, "camera", cameraFrom, cameraTo, 1, cameraFallback, smoothKey);
assert.equal(cameraArrived.trackingTargetId, "actor-b");
near(cameraArrived.focal, 70);

const actorFrom = { type: "actor", bodyPose: neutralPose };
const actorTo = { type: "actor", bodyPose: raisedPose };
const actorQuarter = fakeWindow.interpolatePoseFor({}, "actor-1", actorFrom, actorTo, 0.25, { type: "actor" }, smoothKey);
near(actorQuarter.evaluatedProgress, 0.25);
assert.deepEqual(actorQuarter.bodyPose, neutralPose,
  "camera smooth easing must never be injected into actor root/body motion");
const actorAlmost = fakeWindow.interpolatePoseFor({}, "actor-1", actorFrom, actorTo, 0.9995, { type: "actor" }, smoothKey);
assert.deepEqual(actorAlmost.bodyPose, neutralPose,
  "patched runtime must undo the old 0.999 early pose switch and keep the authored pose held");
const actorArrived = fakeWindow.interpolatePoseFor({}, "actor-1", actorFrom, actorTo, 1, { type: "actor" }, smoothKey);
assert.deepEqual(actorArrived.bodyPose, raisedPose);

const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const motionScriptIndex = html.indexOf("./motion-core.js");
const runtimeScriptIndex = html.indexOf("./previs-runtime-core.js");
const appScriptIndex = html.indexOf("./app.js");
assert.ok(motionScriptIndex >= 0 && runtimeScriptIndex > motionScriptIndex && appScriptIndex > runtimeScriptIndex,
  "motion-core.js must load before previs-runtime-core.js, which must load before app.js");

const motionSource = fs.readFileSync(path.join(root, "motion-core.js"), "utf8");
const runtimeSource = fs.readFileSync(path.join(root, "previs-runtime-core.js"), "utf8");
const listeners = {};
const browserContext = {
  console,
  document: { readyState: "loading" },
  addEventListener(name, callback) { listeners[name] = callback; },
};
vm.createContext(browserContext);
vm.runInContext(motionSource, browserContext, { filename: "motion-core.js" });
vm.runInContext(runtimeSource, browserContext, { filename: "previs-runtime-core.js" });
assert.equal(typeof listeners.DOMContentLoaded, "function", "runtime core must defer installation until app.js has executed");
vm.runInContext(`
  function mergePoseWithFallbackFor(_renderState, _sourceId, pose, fallbackPose) { return { ...fallbackPose, ...pose }; }
  function sanitizeTrackingTargetId(value) { return value; }
  function interpolatePoseFor(_renderState, sourceId, startPose, endPose, t, fallbackPose) {
    if (sourceId === "camera") return { ...fallbackPose, ...startPose, evaluatedProgress: t, focal: Math.round(startPose.focal + (endPose.focal - startPose.focal) * t), trackingTargetId: t < 0.5 ? startPose.trackingTargetId : endPose.trackingTargetId };
    return { ...fallbackPose, ...startPose, type: "actor", evaluatedProgress: t, bodyPose: t >= 0.999 ? endPose.bodyPose : startPose.bodyPose };
  }
`, browserContext);
listeners.DOMContentLoaded();
const browserCamera = browserContext.interpolatePoseFor({}, "camera", cameraFrom, cameraTo, 0.25, cameraFallback, linearKey);
near(browserCamera.evaluatedProgress, 0.25);
near(browserCamera.focal, 35.5);
assert.equal(browserCamera.trackingTargetId, "actor-a", "DOMContentLoaded installation must patch the real global evaluator binding");
const browserSmoothCamera = browserContext.interpolatePoseFor({}, "camera", cameraFrom, cameraTo, 0.25, cameraFallback, smoothKey);
near(browserSmoothCamera.evaluatedProgress, 0.25);
const browserActor = browserContext.interpolatePoseFor({}, "actor-1", actorFrom, actorTo, 0.9995, { type: "actor" }, smoothKey);
near(browserActor.evaluatedProgress, 0.9995);
assert.deepEqual(JSON.parse(JSON.stringify(browserActor.bodyPose)), neutralPose);

console.log("previs-runtime-core: motion-owned evaluator, load order, constant-speed movement, and reference-frame semantics passed");
