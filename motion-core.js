(function initMotionCore(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FrisFrameMotionCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createMotionCore() {
  function finiteNumber(value, fallback = 0) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
    const fallbackNumeric = Number(fallback);
    return Number.isFinite(fallbackNumeric) ? fallbackNumeric : 0;
  }

  function clamp(value, min, max) {
    const lower = finiteNumber(min, 0);
    const upper = finiteNumber(max, lower);
    return Math.max(lower, Math.min(upper, finiteNumber(value, lower)));
  }

  function normalizeTransition(value) {
    return ["smooth", "linear", "hold", "cut"].includes(value) ? value : "smooth";
  }

  function transitionProgress(time, startTime, endTime, transition = "smooth") {
    const start = finiteNumber(startTime, 0);
    const end = finiteNumber(endTime, start + 1);
    const span = Math.max(0.000001, end - start);
    const raw = clamp((finiteNumber(time, start) - start) / span, 0, 1);
    const mode = normalizeTransition(transition);
    if (mode === "cut" || mode === "hold") return raw >= 1 ? 1 : 0;
    if (mode === "linear") return raw;
    return raw < 0.5 ? 2 * raw * raw : 1 - Math.pow(-2 * raw + 2, 2) / 2;
  }

  function poseFieldsChanged(startPose = {}, endPose = {}, fields = ["x", "y"], epsilon = 0.0001) {
    const threshold = Math.max(0, finiteNumber(epsilon, 0.0001));
    return fields.some((field) => {
      const startValue = startPose?.[field];
      const endValue = endPose?.[field];
      if (typeof startValue === "number" || typeof endValue === "number") {
        return Math.abs(finiteNumber(endValue, finiteNumber(startValue, 0)) - finiteNumber(startValue, 0)) > threshold;
      }
      return String(startValue ?? "") !== String(endValue ?? "");
    });
  }

  function motionSegments(keyframes = [], fields = ["x", "y"], epsilon = 0.0001) {
    const sorted = [...keyframes]
      .filter((keyframe) => Number.isFinite(Number(keyframe?.time)))
      .sort((a, b) => Number(a.time) - Number(b.time));
    const segments = [];
    for (let index = 1; index < sorted.length; index += 1) {
      const start = sorted[index - 1];
      const end = sorted[index];
      if (!poseFieldsChanged(start.pose || start, end.pose || end, fields, epsilon)) continue;
      segments.push({ start, end });
    }
    return segments;
  }

  function activeMotionSegment(keyframes = [], time = 0, fields = ["x", "y"], epsilon = 0.0001) {
    const currentTime = finiteNumber(time, 0);
    return motionSegments(keyframes, fields, epsilon).find(({ start, end }) => {
      if (["hold", "cut"].includes(normalizeTransition(end.transition))) return false;
      return currentTime >= Number(start.time) - epsilon && currentTime < Number(end.time) - epsilon;
    }) || null;
  }

  const pathModes = ["straight", "horizontal", "vertical", "arc-left", "arc-right", "free-curve", "drone", "jib-up", "jib-down"];

  function normalizePathMode(value, sourceType = "actor") {
    const mode = pathModes.includes(value) ? value : "straight";
    if (sourceType !== "camera" && ["drone", "jib-up", "jib-down"].includes(mode)) return "straight";
    return mode;
  }

  function constrainPathEndpoint(start = {}, end = {}, mode = "straight", sourceType = "actor") {
    const normalized = normalizePathMode(mode, sourceType);
    const next = { ...end };
    if (normalized === "horizontal") {
      const startY = finiteNumber(start.y, finiteNumber(next.y, 0.5));
      const delta = startY - finiteNumber(next.y, startY);
      next.y = startY;
      if (sourceType === "camera" && next.moveAimWithCamera !== false && Number.isFinite(Number(next.aimY))) {
        next.aimY = finiteNumber(next.aimY) + delta;
      }
    }
    if (normalized === "vertical") {
      const startX = finiteNumber(start.x, finiteNumber(next.x, 0.5));
      const delta = startX - finiteNumber(next.x, startX);
      next.x = startX;
      if (sourceType === "camera" && next.moveAimWithCamera !== false && Number.isFinite(Number(next.aimX))) {
        next.aimX = finiteNumber(next.aimX) + delta;
      }
    }
    return next;
  }

  function circularArcPoint(start = {}, end = {}, progress = 0, side = 1, bulge = 0.32) {
    const t = clamp(Number(progress), 0, 1);
    const x1 = finiteNumber(start.x, 0);
    const y1 = finiteNumber(start.y, 0);
    const x2 = finiteNumber(end.x, x1);
    const y2 = finiteNumber(end.y, y1);
    const dx = x2 - x1;
    const dy = y2 - y1;
    const chord = Math.hypot(dx, dy);
    if (chord < 0.000001 || t <= 0) return { x: x1, y: y1 };
    if (t >= 1) return { x: x2, y: y2 };

    const signedSide = finiteNumber(side, 1) < 0 ? -1 : 1;
    const sagitta = chord * clamp(Math.abs(finiteNumber(bulge, 0.32)), 0.05, 0.49);
    const radius = chord * chord / (8 * sagitta) + sagitta / 2;
    const midpointX = (x1 + x2) / 2;
    const midpointY = (y1 + y2) / 2;
    const perpendicularX = -dy / chord;
    const perpendicularY = dx / chord;
    const centerOffset = radius - sagitta;
    const centerX = midpointX - perpendicularX * signedSide * centerOffset;
    const centerY = midpointY - perpendicularY * signedSide * centerOffset;
    const startAngle = Math.atan2(y1 - centerY, x1 - centerX);
    const endAngle = Math.atan2(y2 - centerY, x2 - centerX);
    let delta = ((endAngle - startAngle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    if (signedSide > 0 && delta > 0) delta -= Math.PI * 2;
    if (signedSide < 0 && delta < 0) delta += Math.PI * 2;
    const angle = startAngle + delta * t;
    return {
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius,
    };
  }

  function quadraticBezierPoint(start = {}, control = {}, end = {}, progress = 0) {
    const t = clamp(Number(progress), 0, 1);
    const inverse = 1 - t;
    return {
      x: inverse * inverse * finiteNumber(start.x, 0)
        + 2 * inverse * t * finiteNumber(control.x, 0)
        + t * t * finiteNumber(end.x, 0),
      y: inverse * inverse * finiteNumber(start.y, 0)
        + 2 * inverse * t * finiteNumber(control.y, 0)
        + t * t * finiteNumber(end.y, 0),
    };
  }

  function samplePlanarPath(start = {}, end = {}, progress = 0, mode = "straight", options = {}) {
    const t = clamp(Number(progress), 0, 1);
    const normalized = normalizePathMode(mode, options.sourceType || "camera");
    if (normalized === "arc-left" || normalized === "arc-right") {
      return circularArcPoint(start, end, t, normalized === "arc-left" ? 1 : -1, options.bulge);
    }
    if (normalized === "free-curve") {
      const control = options.control || {
        x: (finiteNumber(start.x, 0) + finiteNumber(end.x, 0)) / 2,
        y: (finiteNumber(start.y, 0) + finiteNumber(end.y, 0)) / 2,
      };
      return quadraticBezierPoint(start, control, end, t);
    }
    if (normalized === "horizontal") {
      return {
        x: finiteNumber(start.x, 0) + (finiteNumber(end.x, 0) - finiteNumber(start.x, 0)) * t,
        y: finiteNumber(start.y, 0),
      };
    }
    if (normalized === "vertical") {
      return {
        x: finiteNumber(start.x, 0),
        y: finiteNumber(start.y, 0) + (finiteNumber(end.y, 0) - finiteNumber(start.y, 0)) * t,
      };
    }
    return {
      x: finiteNumber(start.x, 0) + (finiteNumber(end.x, 0) - finiteNumber(start.x, 0)) * t,
      y: finiteNumber(start.y, 0) + (finiteNumber(end.y, 0) - finiteNumber(start.y, 0)) * t,
    };
  }

  return {
    activeMotionSegment,
    circularArcPoint,
    constrainPathEndpoint,
    finiteNumber,
    motionSegments,
    normalizePathMode,
    normalizeTransition,
    poseFieldsChanged,
    quadraticBezierPoint,
    samplePlanarPath,
    transitionProgress,
  };
});
