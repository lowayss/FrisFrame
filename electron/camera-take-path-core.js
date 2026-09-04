(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.FrisFrameCameraTakePathCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const EPSILON = 0.0005;
  const MAX_KEYS = 360;

  function finite(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function normalizeAngle(value) {
    const normalized = finite(value) % 360;
    return normalized < 0 ? normalized + 360 : normalized;
  }

  function shortestAngleDelta(from, to) {
    let delta = normalizeAngle(to) - normalizeAngle(from);
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    return delta;
  }

  function normalizePose(pose = {}) {
    const normalized = {
      x:finite(pose.x),
      y:finite(pose.y),
      height:finite(pose.height, 1.6),
      panDeg:normalizeAngle(pose.panDeg),
      tiltDeg:finite(pose.tiltDeg),
      focal:finite(pose.focal, 35),
    };
    for (const field of ["trackingTargetId", "focusDistanceM", "aimX", "aimY", "focusHeight"]) {
      if (pose[field] != null) normalized[field] = clone(pose[field]);
    }
    return normalized;
  }

  function normalizeFrame(frame = {}) {
    return {
      time:finite(frame.time),
      pose:normalizePose(frame.pose || frame),
      transition:String(frame.transition || "linear"),
      operatorContinuity:frame.operatorContinuity !== false,
    };
  }

  function dedupeSortedFrames(frames) {
    const sorted = [...frames].sort((left, right) => left.time - right.time);
    const output = [];
    for (const frame of sorted) {
      const previous = output.at(-1);
      if (previous && Math.abs(previous.time - frame.time) <= EPSILON) output[output.length - 1] = frame;
      else output.push(frame);
    }
    return output.slice(-MAX_KEYS);
  }

  function makeFingerprint(frames) {
    const compact = frames.map((frame) => [
      Number(frame.time.toFixed(6)),
      Number(frame.pose.x.toFixed(6)),
      Number(frame.pose.y.toFixed(6)),
      Number(frame.pose.height.toFixed(4)),
      Number(frame.pose.panDeg.toFixed(4)),
      Number(frame.pose.tiltDeg.toFixed(4)),
      Number(frame.pose.focal.toFixed(3)),
    ]);
    let hash = 2166136261;
    const text = JSON.stringify(compact);
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
  }

  function capturePath(keyframes = [], startTime, endTime) {
    const start = finite(startTime);
    const end = Math.max(start, finite(endTime, start));
    const frames = dedupeSortedFrames(
      (Array.isArray(keyframes) ? keyframes : [])
        .filter((keyframe) => keyframe && keyframe.source === "camera")
        .filter((keyframe) => finite(keyframe.time) >= start - EPSILON && finite(keyframe.time) <= end + EPSILON)
        .map(normalizeFrame),
    );
    if (!frames.length) return null;
    return {
      schemaVersion:1,
      startTime:Number(frames[0].time.toFixed(6)),
      endTime:Number(frames.at(-1).time.toFixed(6)),
      duration:Number(Math.max(0, frames.at(-1).time - frames[0].time).toFixed(6)),
      keyframeCount:frames.length,
      fingerprint:makeFingerprint(frames),
      keyframes:frames,
    };
  }

  function normalizePath(path) {
    if (!path || typeof path !== "object" || !Array.isArray(path.keyframes)) return null;
    const frames = dedupeSortedFrames(path.keyframes.map(normalizeFrame));
    if (!frames.length) return null;
    return {
      schemaVersion:1,
      startTime:Number(frames[0].time.toFixed(6)),
      endTime:Number(frames.at(-1).time.toFixed(6)),
      duration:Number(Math.max(0, frames.at(-1).time - frames[0].time).toFixed(6)),
      keyframeCount:frames.length,
      fingerprint:makeFingerprint(frames),
      keyframes:frames,
    };
  }

  function linearPose(from, to, progress) {
    const t = Math.min(1, Math.max(0, finite(progress)));
    const lerp = (left, right) => finite(left) + (finite(right) - finite(left)) * t;
    return {
      x:lerp(from.x, to.x),
      y:lerp(from.y, to.y),
      height:lerp(from.height, to.height),
      panDeg:normalizeAngle(finite(from.panDeg) + shortestAngleDelta(from.panDeg, to.panDeg) * t),
      tiltDeg:lerp(from.tiltDeg, to.tiltDeg),
      focal:lerp(from.focal, to.focal),
      ...(from.trackingTargetId != null ? {trackingTargetId:clone(from.trackingTargetId)} : {}),
    };
  }

  function samplePath(path, time, interpolatePose) {
    const normalized = normalizePath(path);
    if (!normalized) return null;
    const frames = normalized.keyframes;
    const target = finite(time, normalized.startTime);
    if (target <= frames[0].time + EPSILON) return clone(frames[0].pose);
    if (target >= frames.at(-1).time - EPSILON) return clone(frames.at(-1).pose);
    let rightIndex = frames.findIndex((frame) => frame.time >= target);
    if (rightIndex <= 0) rightIndex = 1;
    const leftIndex = rightIndex - 1;
    const left = frames[leftIndex];
    const right = frames[rightIndex];
    const span = Math.max(0.000001, right.time - left.time);
    const progress = (target - left.time) / span;
    if (typeof interpolatePose === "function") {
      const previous = frames[Math.max(0, leftIndex - 1)];
      const next = frames[Math.min(frames.length - 1, rightIndex + 1)];
      const sampled = interpolatePose(left.pose, right.pose, progress, {
        previous:previous.pose,
        next:next.pose,
        previousTime:previous.time,
        startTime:left.time,
        endTime:right.time,
        nextTime:next.time,
      });
      if (sampled) return normalizePose(sampled);
    }
    return linearPose(left.pose, right.pose, progress);
  }

  function removeCameraRange(keyframes = [], path) {
    const normalized = normalizePath(path);
    if (!normalized) return Array.isArray(keyframes) ? [...keyframes] : [];
    return (Array.isArray(keyframes) ? keyframes : []).filter((keyframe) => !(
      keyframe?.source === "camera"
      && finite(keyframe.time) >= normalized.startTime - EPSILON
      && finite(keyframe.time) <= normalized.endTime + EPSILON
    ));
  }

  return Object.freeze({
    EPSILON,
    MAX_KEYS,
    normalizePose,
    normalizePath,
    capturePath,
    samplePath,
    removeCameraRange,
    makeFingerprint,
  });
});
