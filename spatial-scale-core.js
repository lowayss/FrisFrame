(function attachSpatialScaleCore(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }
  root.FrisFrameSpatialScaleCore = factory();
}(typeof globalThis !== "undefined" ? globalThis : this, function createSpatialScaleCore() {
  const DEFAULT_ACTOR_HEIGHT_M = 1.78;
  const ACTOR_RIG_MODEL_HEIGHT_M = 1.98;
  const ACTOR_RIG_WIDTH_M = 0.54;
  const ACTOR_RIG_DEPTH_M = 0.36;

  function positive(value, fallback = 1) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : fallback;
  }

  function axis(value) {
    return positive(value, 1);
  }

  function actorDimensions(options = {}) {
    const profile = options.dummyScale || {};
    const size = positive(options.size, 1);
    const scaleX = axis(options.scaleX);
    const scaleY = axis(options.scaleY);
    const scaleZ = axis(options.scaleZ);
    return {
      width: ACTOR_RIG_WIDTH_M * size * scaleX * axis(profile.scaleX),
      height: DEFAULT_ACTOR_HEIGHT_M * size * scaleY * axis(profile.scaleY),
      depth: ACTOR_RIG_DEPTH_M * size * scaleZ * axis(profile.scaleZ),
    };
  }

  function actorRigScale(size = 1) {
    return positive(size, 1) * DEFAULT_ACTOR_HEIGHT_M / ACTOR_RIG_MODEL_HEIGHT_M;
  }

  function propDimensions(options = {}) {
    return {
      width: positive(options.width, 1) * positive(options.size, 1) * axis(options.scaleX),
      height: positive(options.height, 1) * positive(options.size, 1) * axis(options.scaleY),
      depth: positive(options.depth, 1) * positive(options.size, 1) * axis(options.scaleZ),
    };
  }

  function fitBounds(bounds, target) {
    const sourceWidth = Math.max(0.0001, Number(bounds?.width) || 0);
    const sourceHeight = Math.max(0.0001, Number(bounds?.height) || 0);
    const sourceDepth = Math.max(0.0001, Number(bounds?.depth) || 0);
    const scale = {
      x: positive(target?.width, 1) / sourceWidth,
      y: positive(target?.height, 1) / sourceHeight,
      z: positive(target?.depth, 1) / sourceDepth,
    };
    return {
      scale,
      groundOffsetY: -(Number(bounds?.minY) || 0) * scale.y,
    };
  }

  function perspectiveMetrics(options = {}) {
    const focalMm = positive(options.focalMm, 50);
    const sensorWidthMm = positive(options.sensorWidthMm, 36);
    const aspect = positive(options.aspect, 16 / 9);
    const distanceM = Math.max(0.01, positive(options.distanceM, 10));
    const subjectHeightM = Math.max(0, Number(options.subjectHeightM) || 0);
    const horizontalFovDeg = 2 * Math.atan(sensorWidthMm / (2 * focalMm)) * 180 / Math.PI;
    const verticalFovDeg = 2 * Math.atan(Math.tan((horizontalFovDeg * Math.PI / 180) / 2) / aspect) * 180 / Math.PI;
    const normalizedFrameHeight = subjectHeightM / (2 * distanceM * Math.tan((verticalFovDeg * Math.PI / 180) / 2));
    return {
      horizontalFovDeg,
      verticalFovDeg,
      normalizedFrameHeight,
      subjectHeightM,
      distanceM,
    };
  }

  return Object.freeze({
    DEFAULT_ACTOR_HEIGHT_M,
    ACTOR_RIG_MODEL_HEIGHT_M,
    ACTOR_RIG_WIDTH_M,
    ACTOR_RIG_DEPTH_M,
    actorDimensions,
    actorRigScale,
    propDimensions,
    fitBounds,
    perspectiveMetrics,
  });
}));
