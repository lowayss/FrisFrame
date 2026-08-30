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

  function positive(value, fallback = 1) {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
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

  function normalizeStageMetrics(input = {}) {
    return {
      width: positive(input.width ?? input.widthM, 36),
      depth: positive(input.depth ?? input.depthM, 20.25),
    };
  }

  function worldToScenePoint(point = {}, stageInput = {}) {
    const stage = normalizeStageMetrics(stageInput);
    return {
      x: 0.5 + finiteNumber(point.x ?? point.xM, 0) / stage.width,
      y: 0.5 + finiteNumber(point.z ?? point.zM, 0) / stage.depth,
    };
  }

  function scenePointToWorld(point = {}, stageInput = {}) {
    const stage = normalizeStageMetrics(stageInput);
    return {
      x: (finiteNumber(point.x, 0.5) - 0.5) * stage.width,
      z: (finiteNumber(point.y, 0.5) - 0.5) * stage.depth,
    };
  }

  function normalizeMassBlock(input = {}, stageInput = {}) {
    const stage = normalizeStageMetrics(stageInput);
    const center = input.center || input.position || {};
    const worldX = finiteNumber(input.xM ?? center.x, 0);
    const worldZ = finiteNumber(input.zM ?? center.z, 0);
    const scenePoint = worldToScenePoint({ x: worldX, z: worldZ }, stage);
    return {
      id: String(input.id || "").trim().slice(0, 64),
      label: String(input.label || input.name || "Mass").trim().slice(0, 120),
      role: String(input.role || input.category || "space-mass").trim().slice(0, 64),
      xM: worldX,
      zM: worldZ,
      bottomM: finiteNumber(input.bottomM ?? input.elevation, 0),
      widthM: positive(input.widthM ?? input.width, 1),
      heightM: positive(input.heightM ?? input.height, 1),
      depthM: positive(input.depthM ?? input.depth, 1),
      rotationDeg: finiteNumber(input.rotationDeg ?? input.facing, 0),
      x: scenePoint.x,
      y: scenePoint.y,
      confidence: clamp(input.confidence ?? 1, 0, 1),
      source: String(input.source || "external-analysis").trim().slice(0, 64),
    };
  }

  function massBlockFootprintBounds(input = {}, stageInput = {}) {
    const block = normalizeMassBlock(input, stageInput);
    const angle = block.rotationDeg * Math.PI / 180;
    const halfWidth = block.widthM / 2;
    const halfDepth = block.depthM / 2;
    const extentX = Math.abs(Math.cos(angle)) * halfWidth + Math.abs(Math.sin(angle)) * halfDepth;
    const extentZ = Math.abs(Math.sin(angle)) * halfWidth + Math.abs(Math.cos(angle)) * halfDepth;
    return {
      minX: block.xM - extentX,
      maxX: block.xM + extentX,
      minZ: block.zM - extentZ,
      maxZ: block.zM + extentZ,
      width: extentX * 2,
      depth: extentZ * 2,
    };
  }

  function massBlockToSceneObject(input = {}, stageInput = {}) {
    const block = normalizeMassBlock(input, stageInput);
    return {
      x: clamp(block.x, 0.02, 0.98),
      y: clamp(block.y, 0.02, 0.98),
      elevation: clamp(block.bottomM, -1, 5),
      facing: block.rotationDeg,
      size: 1,
      scaleX: 1,
      scaleY: 1,
      scaleZ: 1,
      name: block.label,
      assetType: String(input.assetType || "box"),
      shape: String(input.shape || "square"),
      referenceAnchorId: String(input.referenceAnchorId || block.id || "").trim().slice(0, 64),
      referenceDimensionsM: {
        width: block.widthM,
        height: block.heightM,
        depth: block.depthM,
      },
    };
  }

  function validateMassBlocks(inputs = [], stageInput = {}) {
    const stage = normalizeStageMetrics(stageInput);
    const issues = [];
    const blocks = (Array.isArray(inputs) ? inputs : []).map((input) => normalizeMassBlock(input, stage));
    const halfStageWidth = stage.width / 2;
    const halfStageDepth = stage.depth / 2;

    blocks.forEach((block, index) => {
      const bounds = massBlockFootprintBounds(block, stage);
      if (bounds.minX < -halfStageWidth || bounds.maxX > halfStageWidth || bounds.minZ < -halfStageDepth || bounds.maxZ > halfStageDepth) {
        issues.push({
          code: "mass-outside-stage",
          severity: "review",
          index,
          id: block.id,
          label: block.label,
          bounds,
        });
      }
      if (block.confidence < 0.5) {
        issues.push({
          code: "mass-low-confidence",
          severity: "review",
          index,
          id: block.id,
          label: block.label,
          confidence: block.confidence,
        });
      }
    });

    return { stage, blocks, issues };
  }

  function createMassBlockingPlan(input = {}) {
    const stage = normalizeStageMetrics(input.stage || {});
    const validation = validateMassBlocks(input.masses || input.blocks || [], stage);
    return {
      schema: "frisframe-mass-blocking",
      version: 1,
      stage,
      blocks: validation.blocks,
      sceneObjects: validation.blocks.map((block) => massBlockToSceneObject(block, stage)),
      issues: validation.issues,
    };
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
    normalizeStageMetrics,
    worldToScenePoint,
    scenePointToWorld,
    normalizeMassBlock,
    massBlockFootprintBounds,
    massBlockToSceneObject,
    validateMassBlocks,
    createMassBlockingPlan,
  };
});
