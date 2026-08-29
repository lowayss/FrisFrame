(function initPrevisRuntimeCore(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FrisFramePrevisRuntimeCore = api;

  // This core loads before app.js in the browser. Install the reference-video
  // evaluator guard only after app.js has declared its global frame functions.
  if (root?.document && typeof root.addEventListener === "function") {
    const install = () => api.installReferenceFrameSemantics(root);
    if (root.document.readyState === "loading") root.addEventListener("DOMContentLoaded", install, { once: true });
    else root.setTimeout?.(install, 0);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createPrevisRuntimeCore() {
  "use strict";

  const CAMERA_FOCAL_MIN = 14;
  const CAMERA_FOCAL_MAX = 135;

  function safeContext(canvas, name) {
    try {
      return canvas?.getContext?.(name) || null;
    } catch {
      return null;
    }
  }

  function detectRenderRuntime({ rendererEngine = "", navigatorObject = typeof navigator !== "undefined" ? navigator : null, documentObject = typeof document !== "undefined" ? document : null } = {}) {
    const platform = String(navigatorObject?.platform || navigatorObject?.userAgent || "");
    const isMac = /Mac|iPhone|iPad/i.test(platform);
    const canvas = documentObject?.createElement?.("canvas");
    if (rendererEngine === "webgpu") return { engine: "webgpu", label: isMac ? "Mac GPU · WebGPU" : "GPU · WebGPU", isMac, hardwareAccelerated: true };
    if (rendererEngine === "webgl") return { engine: "webgl", label: isMac ? "Mac GPU · WebGL" : "GPU · WebGL", isMac, hardwareAccelerated: true };
    const hasWebGpu = Boolean(canvas && ("gpu" in (navigatorObject || {}) || safeContext(canvas, "webgpu")));
    const hasWebGl = Boolean(canvas && (safeContext(canvas, "webgl2") || safeContext(canvas, "webgl")));
    if (hasWebGpu) return { engine: "webgpu", label: isMac ? "Mac GPU · WebGPU" : "GPU · WebGPU", isMac, hardwareAccelerated: true };
    if (hasWebGl) return { engine: "webgl", label: isMac ? "Mac GPU · WebGL" : "GPU · WebGL", isMac, hardwareAccelerated: true };
    return { engine: "cpu", label: "CPU fallback", isMac, hardwareAccelerated: false };
  }

  function finiteNumber(value, fallback = 0) {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
    const fallbackNumber = Number(fallback);
    return Number.isFinite(fallbackNumber) ? fallbackNumber : 0;
  }

  function clamp(value, minimum, maximum) {
    const min = finiteNumber(minimum, 0);
    const max = finiteNumber(maximum, min);
    return Math.max(min, Math.min(max, finiteNumber(value, min)));
  }

  function lerp(start, end, progress) {
    const t = clamp(progress, 0, 1);
    const from = finiteNumber(start, 0);
    return from + (finiteNumber(end, from) - from) * t;
  }

  function cloneValue(value) {
    if (value === null || value === undefined || typeof value !== "object") return value;
    if (Array.isArray(value)) return value.map(cloneValue);
    const result = {};
    Object.entries(value).forEach(([key, entry]) => {
      result[key] = cloneValue(entry);
    });
    return result;
  }

  // A tracking target, visibility flag, mount relation, or keyed body pose is
  // discrete reference information. Switching halfway through a segment makes
  // Seedance reproduce an action/camera jump that was never authored.
  function discreteAtDestination(fromValue, toValue, progress) {
    return clamp(progress, 0, 1) >= 1 ? toValue : fromValue;
  }

  // Keep focal length continuous in evaluated frames. Rounding belongs in UI
  // labels, not in the previs video that Seedance follows frame by frame.
  function interpolateFocalLength(fromFocal, toFocal, progress, minimum = CAMERA_FOCAL_MIN, maximum = CAMERA_FOCAL_MAX) {
    return clamp(lerp(fromFocal, toFocal, progress), minimum, maximum);
  }

  function smoothReferenceProgress(progress) {
    const t = clamp(progress, 0, 1);
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  function cameraReferenceProgress(progress, transition = "smooth") {
    const t = clamp(progress, 0, 1);
    return String(transition || "smooth") === "smooth" ? smoothReferenceProgress(t) : t;
  }

  function heldActorBodyPose(fromPose, toPose, progress) {
    return cloneValue(discreteAtDestination(fromPose, toPose, progress));
  }

  function fallbackMergedPose(startPose = {}, fallbackPose = {}) {
    return { ...fallbackPose, ...startPose };
  }

  function installReferenceFrameSemantics(target) {
    if (!target || typeof target.interpolatePoseFor !== "function") return false;
    if (target.interpolatePoseFor.__frisFrameReferenceSemantics === true) return true;

    const original = target.interpolatePoseFor;
    const patched = function patchedInterpolatePoseFor(renderState, sourceId, startPose, endPose, progress, fallbackPose, endKeyframe = null) {
      const inputProgress = clamp(progress, 0, 1);
      // app.js intentionally keeps actor/root blocking linear across ordinary
      // keys. Only camera "smooth" restores the UI-promised ease-in/out so
      // Seedance receives authored camera rhythm without extra actor motion.
      const evaluatedProgress = sourceId === "camera"
        ? cameraReferenceProgress(inputProgress, endKeyframe?.transition || "smooth")
        : inputProgress;
      const result = original.call(
        this,
        renderState,
        sourceId,
        startPose,
        endPose,
        evaluatedProgress,
        fallbackPose,
        endKeyframe,
      );
      if (!result || typeof result !== "object") return result;

      const mergePose = typeof target.mergePoseWithFallbackFor === "function"
        ? (pose) => target.mergePoseWithFallbackFor(renderState, sourceId, pose, fallbackPose)
        : (pose) => fallbackMergedPose(pose, fallbackPose);
      const from = mergePose(startPose);
      const to = mergePose(endPose);

      if (sourceId === "camera") {
        result.focal = interpolateFocalLength(from.focal, to.focal, evaluatedProgress);
        const trackingTargetId = discreteAtDestination(
          from.trackingTargetId || "",
          to.trackingTargetId || "",
          inputProgress,
        );
        result.trackingTargetId = typeof target.sanitizeTrackingTargetId === "function"
          ? target.sanitizeTrackingTargetId(trackingTargetId, renderState)
          : trackingTargetId;
        return result;
      }

      const itemType = from.type || to.type || result.type;
      if (itemType === "actor") {
        result.bodyPose = heldActorBodyPose(from.bodyPose, to.bodyPose, inputProgress);
      }
      return result;
    };
    Object.defineProperty(patched, "__frisFrameReferenceSemantics", { value: true });
    Object.defineProperty(patched, "__frisFrameOriginal", { value: original });
    target.interpolatePoseFor = patched;
    return true;
  }

  return {
    CAMERA_FOCAL_MAX,
    CAMERA_FOCAL_MIN,
    cameraReferenceProgress,
    cloneValue,
    detectRenderRuntime,
    discreteAtDestination,
    heldActorBodyPose,
    installReferenceFrameSemantics,
    interpolateFocalLength,
    smoothReferenceProgress,
  };
});
