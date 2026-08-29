(function initSceneBlockingCore(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FrisFrameSceneBlockingCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createSceneBlockingCore() {
  const TRANSFORM_FIELDS = ["x", "y", "elevation", "size", "scaleX", "scaleY", "scaleZ"];

  function finiteNumber(value, fallback = 0) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
    const fallbackNumeric = Number(fallback);
    return Number.isFinite(fallbackNumeric) ? fallbackNumeric : 0;
  }

  function clamp(value, min, max) {
    return Math.max(finiteNumber(min, 0), Math.min(finiteNumber(max, min), finiteNumber(value, min)));
  }

  function lerp(start, end, t) {
    return finiteNumber(start, 0) + (finiteNumber(end, start) - finiteNumber(start, 0)) * clamp(t, 0, 1);
  }

  function lerpAngle(start, end, t) {
    const a = finiteNumber(start, 0);
    const b = finiteNumber(end, a);
    const delta = ((b - a + 540) % 360) - 180;
    return a + delta * clamp(t, 0, 1);
  }

  // FrisFrame's persisted scene object is intentionally flat so that it can
  // be serialized into the existing blocking document and exported to CSV,
  // Blender, and the 3D preview without adapters.
  function normalizeSceneObject(input = {}, defaults = {}) {
    const source = { ...defaults, ...input };
    return {
      x: clamp(source.x ?? 0.5, 0.02, 0.98),
      y: clamp(source.y ?? 0.5, 0.02, 0.98),
      elevation: clamp(source.elevation ?? 0, -1, 5),
      facing: finiteNumber(source.facing, 0),
      size: clamp(source.size ?? 1, 0.25, 4),
      scaleX: clamp(source.scaleX ?? 1, 0.25, 3.5),
      scaleY: clamp(source.scaleY ?? 1, 0.25, 3.5),
      scaleZ: clamp(source.scaleZ ?? 1, 0.25, 3.5),
    };
  }

  function interpolateSceneObject(start = {}, end = {}, progress = 0) {
    const t = clamp(progress, 0, 1);
    const pose = { ...start };
    TRANSFORM_FIELDS.forEach((field) => { pose[field] = lerp(start[field], end[field], t); });
    pose.facing = lerpAngle(start.facing, end.facing, t);
    ["color", "shape", "assetType", "dummyType", "name", "mountId", "seatIndex", "visible"].forEach((field) => {
      if (field in start || field in end) pose[field] = t < 0.5 ? start[field] : end[field];
    });
    return pose;
  }

  function sample3DWaypoint(start = {}, end = {}, progress = 0, planarPoint = null) {
    const t = clamp(progress, 0, 1);
    const planar = planarPoint || {
      x: lerp(start.x, end.x, t),
      y: lerp(start.y, end.y, t),
    };
    return {
      x: finiteNumber(planar.x, start.x),
      y: finiteNumber(planar.y, start.y),
      elevation: lerp(start.elevation, end.elevation, t),
    };
  }

  // Camera rail points are derived from camera keys. This keeps the rail
  // inspectable and editable without introducing a second source of truth.
  function buildCameraRail(keyframes = []) {
    return [...keyframes]
      .filter((keyframe) => keyframe?.pose && Number.isFinite(Number(keyframe.time)))
      .sort((a, b) => Number(a.time) - Number(b.time))
      .map((keyframe) => ({
        id: String(keyframe.id || ""),
        time: finiteNumber(keyframe.time, 0),
        x: finiteNumber(keyframe.pose.x, 0.5),
        y: finiteNumber(keyframe.pose.y, 0.5),
        height: finiteNumber(keyframe.pose.height, 1.6),
      }));
  }

  function createTargetTransaction({ owner = "scene", targetIds = [], before = null, clone = (value) => value } = {}) {
    let start = clone(before);
    let current = clone(before);
    let committed = false;
    return {
      owner,
      targetIds: [...new Set(targetIds.filter(Boolean).map(String))],
      begin(nextBefore) {
        start = clone(nextBefore);
        current = clone(nextBefore);
        committed = false;
        return this;
      },
      apply(nextState) {
        current = clone(nextState);
        return current;
      },
      commit(nextState = current) {
        current = clone(nextState);
        committed = true;
        return { owner, targetIds: this.targetIds, before: clone(start), after: clone(current) };
      },
      cancel() {
        committed = false;
        return clone(start);
      },
      get changed() {
        return JSON.stringify(start) !== JSON.stringify(current);
      },
      get isCommitted() {
        return committed;
      },
    };
  }

  return {
    TRANSFORM_FIELDS,
    buildCameraRail,
    createTargetTransaction,
    interpolateSceneObject,
    normalizeSceneObject,
    sample3DWaypoint,
  };
});
