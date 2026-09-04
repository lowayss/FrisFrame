(() => {
  "use strict";

  if (document.documentElement.dataset.frisframePhoneMotionIpcUx === "1") return;
  document.documentElement.dataset.frisframePhoneMotionIpcUx = "1";

  const MAX_RENDER_AGE_MS = 100;
  let lastSessionId = "";
  let lastSeq = -1;
  let lastMetric = null;
  let modeEpoch = 0;
  let pending = null;
  let frame = 0;
  const stats = {
    received:0,
    dispatched:0,
    droppedStaleSequence:0,
    droppedRendererAge:0,
    coalesced:0,
    lastRttMs:0,
    lastMainQueueMs:0,
    lastDispatchLagMs:0,
    lastSeq:-1,
  };

  function resetSequence(sessionId) {
    lastSessionId = sessionId;
    lastSeq = -1;
    pending = null;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  }

  function normalizedDetail(input) {
    const detail = input && typeof input === "object" ? input : {};
    const sessionId = String(detail.sessionId || "");
    if (sessionId && sessionId !== lastSessionId) resetSequence(sessionId);
    const seq = Math.max(0, Math.trunc(Number(detail.seq) || 0));
    if (seq <= lastSeq) {
      stats.droppedStaleSequence += 1;
      return null;
    }
    lastSeq = seq;
    stats.lastSeq = seq;

    const now = Date.now();
    const receivedAt = Number(detail.receivedAt || now);
    const rendererAgeMs = Math.max(0, now - receivedAt);
    if (!detail.command && rendererAgeMs > MAX_RENDER_AGE_MS) {
      stats.droppedRendererAge += 1;
      return null;
    }

    const motion = detail.motion && typeof detail.motion === "object" ? detail.motion : null;
    let nextMotion = motion;
    if (motion) {
      const metric = motion.spatial?.mode === "webxr" && motion.spatial?.metric === true;
      if (lastMetric == null) lastMetric = metric;
      else if (metric !== lastMetric) {
        modeEpoch += 1;
        lastMetric = metric;
      }
      const calibrationId = Math.max(0, Math.trunc(Number(motion.calibrationId) || 0));
      nextMotion = {
        ...motion,
        calibrationId:calibrationId * 1024 + modeEpoch,
      };
    }

    stats.lastRttMs = Math.max(0, Number(detail.clientRttMs) || 0);
    stats.lastMainQueueMs = rendererAgeMs;
    stats.lastDispatchLagMs = Math.max(0, Number(detail.dispatchLagMs) || 0);
    return {
      ...detail,
      motion:nextMotion,
      transport:{
        rendererAgeMs,
        clientRttMs:stats.lastRttMs,
        dispatchLagMs:stats.lastDispatchLagMs,
        sessionId,
        seq,
      },
    };
  }

  function dispatch(detail) {
    stats.dispatched += 1;
    window.dispatchEvent(new CustomEvent("frisframe:phone-remote-input", { detail }));
  }

  function flush() {
    frame = 0;
    if (!pending) return;
    const detail = pending;
    pending = null;
    dispatch(detail);
  }

  function receive(input) {
    stats.received += 1;
    const detail = normalizedDetail(input);
    if (!detail) return;
    if (detail.command) {
      pending = null;
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      dispatch(detail);
      return;
    }
    if (pending) stats.coalesced += 1;
    pending = detail;
    if (!frame) frame = requestAnimationFrame(flush);
  }

  const api = window.frisframePhoneRemote;
  if (typeof api?.onMotionInput === "function") api.onMotionInput(receive);

  window.FrisFramePhoneMotionTransport = Object.freeze({
    get stats() { return { ...stats }; },
    get maxRendererAgeMs() { return MAX_RENDER_AGE_MS; },
  });
})();
