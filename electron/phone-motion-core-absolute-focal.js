(() => {
  "use strict";
  if (document.documentElement.dataset.frisframePhoneAbsoluteFocal === "1") return;
  document.documentElement.dataset.frisframePhoneAbsoluteFocal = "1";
  const base = window.FrisFramePhoneMotionCore;
  if (!base?.derivePose) return;
  const clamp = typeof base.clamp === "function"
    ? base.clamp
    : (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, Number(value) || 0));
  const wrapped = {
    ...base,
    derivePose(anchor, phoneSample = {}, context = {}) {
      const pose = base.derivePose(anchor, phoneSample, context);
      const focalMm = Number(phoneSample?.focalMm);
      if (pose && Number.isFinite(focalMm)) pose.focal = clamp(focalMm, 8, 300);
      return pose;
    },
  };
  window.FrisFramePhoneMotionCore = Object.freeze(wrapped);
})();
