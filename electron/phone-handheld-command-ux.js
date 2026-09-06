(() => {
  "use strict";
  if (document.documentElement.dataset.frisframePhoneHandheldCommandUx === "1") return;
  document.documentElement.dataset.frisframePhoneHandheldCommandUx = "1";
  const PROFILE_MAP = Object.freeze({ raw:"raw", handheld:"handheld", heavy:"cinema" });
  let appliedProfile = null;
  window.addEventListener("frisframe:phone-remote-input", (event) => {
    const detail = event?.detail || {};
    if (window.FrisFrameCameraOperatorInputs?.mode !== "phone") return;
    const requested = String(detail.rigProfile || detail.motion?.rigProfile || "");
    const mapped = PROFILE_MAP[requested];
    if (!mapped || mapped === appliedProfile) return;
    const physical = window.FrisFramePhoneMotionCamera;
    if (!physical?.setStabilization) return;
    if (physical.stabilization !== mapped) physical.setStabilization(mapped);
    appliedProfile = mapped;
  }, true);
})();
