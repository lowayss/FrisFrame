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
  const DEFAULT_STAGE_LONG_EDGE_M = 36;
  const DEFAULT_SENSOR_WIDTH_MM = 36;

  function finiteNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function positive(value, fallback = 1) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : fallback;
  }

  function clamp(value, min = 0, max = 1) {
    return Math.max(min, Math.min(max, finiteNumber(value, min)));
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

  function fieldOfView(options = {}) {
    const focalMm = positive(options.focalMm, 50);
    const sensorWidthMm = positive(options.sensorWidthMm, DEFAULT_SENSOR_WIDTH_MM);
    const aspect = positive(options.aspect, 16 / 9);
    const sensorHeightMm = sensorWidthMm / aspect;
    const horizontalFovDeg = 2 * Math.atan(sensorWidthMm / (2 * focalMm)) * 180 / Math.PI;
    const verticalFovDeg = 2 * Math.atan(sensorHeightMm / (2 * focalMm)) * 180 / Math.PI;
    return {
      focalMm,
      sensorWidthMm,
      sensorHeightMm,
      aspect,
      horizontalFovDeg,
      verticalFovDeg,
    };
  }

  function perspectiveMetrics(options = {}) {
    const view = fieldOfView(options);
    const distanceM = Math.max(0.01, positive(options.distanceM, 10));
    const subjectHeightM = Math.max(0, Number(options.subjectHeightM) || 0);
    const normalizedFrameHeight = subjectHeightM * view.focalMm / (distanceM * view.sensorHeightMm);
    return {
      horizontalFovDeg: view.horizontalFovDeg,
      verticalFovDeg: view.verticalFovDeg,
      normalizedFrameHeight,
      subjectHeightM,
      distanceM,
    };
  }

  function stageWorldSize(options = {}) {
    const aspect = positive(options.aspect, 16 / 9);
    const longEdgeM = positive(options.longEdgeM, DEFAULT_STAGE_LONG_EDGE_M);
    if (aspect >= 1) return { width: longEdgeM, depth: longEdgeM / aspect, aspect, longEdgeM };
    return { width: longEdgeM * aspect, depth: longEdgeM, aspect, longEdgeM };
  }

  function stageNormalizedToWorld(point = {}, options = {}) {
    const size = options.width && options.depth
      ? { width: positive(options.width, DEFAULT_STAGE_LONG_EDGE_M), depth: positive(options.depth, DEFAULT_STAGE_LONG_EDGE_M) }
      : stageWorldSize(options);
    return {
      x: (finiteNumber(point.x, 0.5) - 0.5) * size.width,
      z: (finiteNumber(point.y ?? point.z, 0.5) - 0.5) * size.depth,
      y: finiteNumber(point.elevation ?? point.height, 0),
    };
  }

  function worldToStageNormalized(point = {}, options = {}) {
    const size = options.width && options.depth
      ? { width: positive(options.width, DEFAULT_STAGE_LONG_EDGE_M), depth: positive(options.depth, DEFAULT_STAGE_LONG_EDGE_M) }
      : stageWorldSize(options);
    return {
      x: 0.5 + finiteNumber(point.x, 0) / size.width,
      y: 0.5 + finiteNumber(point.z ?? point.y, 0) / size.depth,
    };
  }

  function normalizeFrameFraction(value, fallback = 0) {
    const fraction = finiteNumber(value, fallback);
    return fraction > 0 ? fraction : fallback;
  }

  function axisSensorSizeMm(axisName, options = {}) {
    const view = fieldOfView(options);
    return axisName === "width" ? view.sensorWidthMm : view.sensorHeightMm;
  }

  function frameFractionForDistance(options = {}) {
    const axisName = options.axis === "width" ? "width" : "height";
    const subjectSizeM = positive(options.subjectSizeM ?? options.physicalSizeM, 1);
    const distanceM = Math.max(0.001, positive(options.distanceM, 1));
    const focalMm = positive(options.focalMm, 50);
    const sensorSizeMm = axisSensorSizeMm(axisName, options);
    return subjectSizeM * focalMm / (distanceM * sensorSizeMm);
  }

  function distanceForFrameFraction(options = {}) {
    const axisName = options.axis === "width" ? "width" : "height";
    const subjectSizeM = positive(options.subjectSizeM ?? options.physicalSizeM, 1);
    const frameFraction = normalizeFrameFraction(options.frameFraction ?? options.normalizedFrameSize, 0);
    if (!(frameFraction > 0)) return null;
    const focalMm = positive(options.focalMm, 50);
    const sensorSizeMm = axisSensorSizeMm(axisName, options);
    return subjectSizeM * focalMm / (frameFraction * sensorSizeMm);
  }

  function focalForFrameFraction(options = {}) {
    const axisName = options.axis === "width" ? "width" : "height";
    const subjectSizeM = positive(options.subjectSizeM ?? options.physicalSizeM, 1);
    const frameFraction = normalizeFrameFraction(options.frameFraction ?? options.normalizedFrameSize, 0);
    const distanceM = positive(options.distanceM, 0);
    if (!(frameFraction > 0) || !(distanceM > 0)) return null;
    const sensorSizeMm = axisSensorSizeMm(axisName, options);
    return frameFraction * distanceM * sensorSizeMm / subjectSizeM;
  }

  function normalizeScaleAnchor(input = {}) {
    const axisName = input.axis === "width" ? "width" : "height";
    const imageAxisPixels = axisName === "width"
      ? positive(input.imageWidthPx ?? input.imagePixels, 0)
      : positive(input.imageHeightPx ?? input.imagePixels, 0);
    const measuredPixels = positive(input.pixelSize ?? input.measuredPixels, 0);
    const pixelFraction = imageAxisPixels > 0 && measuredPixels > 0 ? measuredPixels / imageAxisPixels : 0;
    const frameFraction = normalizeFrameFraction(
      input.frameFraction ?? input.normalizedFrameSize ?? input.frameSizeNormalized,
      pixelFraction,
    );
    return {
      id: String(input.id || "").trim().slice(0, 64),
      label: String(input.label || input.name || "").trim().slice(0, 120),
      axis: axisName,
      physicalSizeM: positive(input.physicalSizeM ?? input.sizeM, 1),
      frameFraction,
      imagePixels: imageAxisPixels || null,
      measuredPixels: measuredPixels || null,
      distanceM: positive(input.distanceM, 0) || null,
      confidence: clamp(input.confidence ?? 1, 0, 1),
      source: String(input.source || "external-analysis").trim().slice(0, 64),
    };
  }

  function solveScaleAnchor(input = {}, camera = {}) {
    const anchor = normalizeScaleAnchor(input);
    const sensorWidthMm = positive(camera.sensorWidthMm, DEFAULT_SENSOR_WIDTH_MM);
    const aspect = positive(camera.aspect, 16 / 9);
    const knownFocalMm = positive(camera.focalMm, 0);
    const knownDistanceM = positive(anchor.distanceM ?? camera.distanceM, 0);
    let inferredDistanceM = null;
    let inferredFocalMm = null;

    if (anchor.frameFraction > 0 && knownFocalMm > 0) {
      inferredDistanceM = distanceForFrameFraction({
        axis: anchor.axis,
        subjectSizeM: anchor.physicalSizeM,
        frameFraction: anchor.frameFraction,
        focalMm: knownFocalMm,
        sensorWidthMm,
        aspect,
      });
    }

    if (anchor.frameFraction > 0 && knownDistanceM > 0) {
      inferredFocalMm = focalForFrameFraction({
        axis: anchor.axis,
        subjectSizeM: anchor.physicalSizeM,
        frameFraction: anchor.frameFraction,
        distanceM: knownDistanceM,
        sensorWidthMm,
        aspect,
      });
    }

    const predictedFrameFraction = knownFocalMm > 0 && knownDistanceM > 0
      ? frameFractionForDistance({
        axis: anchor.axis,
        subjectSizeM: anchor.physicalSizeM,
        distanceM: knownDistanceM,
        focalMm: knownFocalMm,
        sensorWidthMm,
        aspect,
      })
      : null;

    return {
      anchor,
      sensorWidthMm,
      aspect,
      inferredDistanceM,
      inferredFocalMm,
      predictedFrameFraction,
      frameResidual: predictedFrameFraction == null ? null : anchor.frameFraction - predictedFrameFraction,
    };
  }

  function horizontalAngleFromFrameX(options = {}) {
    const view = fieldOfView(options);
    const x = clamp(options.frameX ?? options.normalizedX ?? 0.5, 0, 1);
    const sensorOffsetMm = (x - 0.5) * view.sensorWidthMm;
    return Math.atan(sensorOffsetMm / view.focalMm) * 180 / Math.PI;
  }

  function frameXFromHorizontalAngle(options = {}) {
    const view = fieldOfView(options);
    const angleRad = finiteNumber(options.angleDeg, 0) * Math.PI / 180;
    const sensorOffsetMm = Math.tan(angleRad) * view.focalMm;
    return 0.5 + sensorOffsetMm / view.sensorWidthMm;
  }

  function tiltFromHorizon(options = {}) {
    const view = fieldOfView(options);
    const horizonY = clamp(options.horizonY ?? options.horizonYNormalized ?? 0.5, 0, 1);
    const sensorOffsetMm = (0.5 - horizonY) * view.sensorHeightMm;
    return Math.atan(sensorOffsetMm / view.focalMm) * 180 / Math.PI;
  }

  function horizonFromTilt(options = {}) {
    const view = fieldOfView(options);
    const tiltDeg = finiteNumber(options.tiltDeg ?? options.tiltDownDeg, 0);
    const sensorOffsetMm = Math.tan(tiltDeg * Math.PI / 180) * view.focalMm;
    return 0.5 - sensorOffsetMm / view.sensorHeightMm;
  }

  function calibratePerspective(options = {}) {
    const anchor = options.anchor ? normalizeScaleAnchor(options.anchor) : null;
    const sensorWidthMm = positive(options.sensorWidthMm, DEFAULT_SENSOR_WIDTH_MM);
    const aspect = positive(options.aspect, 16 / 9);
    let focalMm = positive(options.focalMm, 0) || null;
    let distanceM = positive(options.distanceM ?? anchor?.distanceM, 0) || null;
    const frameFraction = normalizeFrameFraction(
      options.frameFraction ?? options.normalizedFrameSize ?? anchor?.frameFraction,
      0,
    );
    const subjectSizeM = positive(options.subjectSizeM ?? options.physicalSizeM ?? anchor?.physicalSizeM, 0);
    const axisName = options.axis === "width" || anchor?.axis === "width" ? "width" : "height";

    if (!distanceM && focalMm && frameFraction > 0 && subjectSizeM > 0) {
      distanceM = distanceForFrameFraction({
        axis: axisName,
        subjectSizeM,
        frameFraction,
        focalMm,
        sensorWidthMm,
        aspect,
      });
    }
    if (!focalMm && distanceM && frameFraction > 0 && subjectSizeM > 0) {
      focalMm = focalForFrameFraction({
        axis: axisName,
        subjectSizeM,
        frameFraction,
        distanceM,
        sensorWidthMm,
        aspect,
      });
    }

    const view = fieldOfView({
      focalMm: focalMm || 50,
      sensorWidthMm,
      aspect,
    });
    const predictedFrameFraction = focalMm && distanceM && subjectSizeM > 0
      ? frameFractionForDistance({
        axis: axisName,
        subjectSizeM,
        frameFraction,
        distanceM,
        focalMm,
        sensorWidthMm,
        aspect,
      })
      : null;
    const horizonY = Number.isFinite(Number(options.horizonY ?? options.horizonYNormalized))
      ? clamp(options.horizonY ?? options.horizonYNormalized, 0, 1)
      : null;
    const tiltDeg = horizonY == null ? null : tiltFromHorizon({
      horizonY,
      focalMm: focalMm || 50,
      sensorWidthMm,
      aspect,
    });

    return {
      focalMm,
      distanceM,
      sensorWidthMm,
      aspect,
      horizontalFovDeg: view.horizontalFovDeg,
      verticalFovDeg: view.verticalFovDeg,
      horizonY,
      tiltDeg,
      axis: axisName,
      subjectSizeM: subjectSizeM || null,
      frameFraction: frameFraction || null,
      predictedFrameFraction,
      frameResidual: predictedFrameFraction == null || !(frameFraction > 0)
        ? null
        : frameFraction - predictedFrameFraction,
    };
  }

  function fitOverlayRect(options = {}) {
    const sourceWidth = positive(options.sourceWidth ?? options.imageWidth, 1);
    const sourceHeight = positive(options.sourceHeight ?? options.imageHeight, 1);
    const targetWidth = positive(options.targetWidth ?? options.viewportWidth, sourceWidth);
    const targetHeight = positive(options.targetHeight ?? options.viewportHeight, sourceHeight);
    const fit = options.fit === "cover" ? "cover" : "contain";
    const scale = fit === "cover"
      ? Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight)
      : Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);
    const width = sourceWidth * scale;
    const height = sourceHeight * scale;
    return {
      x: (targetWidth - width) / 2,
      y: (targetHeight - height) / 2,
      width,
      height,
      scale,
      fit,
      sourceWidth,
      sourceHeight,
      targetWidth,
      targetHeight,
    };
  }

  function normalizedToOverlayPoint(point = {}, rect = {}) {
    return {
      x: finiteNumber(rect.x, 0) + clamp(point.x, 0, 1) * positive(rect.width, 1),
      y: finiteNumber(rect.y, 0) + clamp(point.y, 0, 1) * positive(rect.height, 1),
    };
  }

  function overlayPointToNormalized(point = {}, rect = {}) {
    return {
      x: (finiteNumber(point.x, 0) - finiteNumber(rect.x, 0)) / positive(rect.width, 1),
      y: (finiteNumber(point.y, 0) - finiteNumber(rect.y, 0)) / positive(rect.height, 1),
    };
  }

  function normalizeReferenceSpaceSpec(input = {}) {
    const source = input.source || input.image || {};
    const camera = input.camera || input.perspective || {};
    const anchors = Array.isArray(input.anchors) ? input.anchors.map(normalizeScaleAnchor) : [];
    return {
      schema: "frisframe-reference-space",
      version: 1,
      source: {
        widthPx: Math.max(0, Math.round(finiteNumber(source.widthPx ?? source.width, 0))),
        heightPx: Math.max(0, Math.round(finiteNumber(source.heightPx ?? source.height, 0))),
        label: String(source.label || source.name || "").trim().slice(0, 160),
      },
      camera: {
        focalMm: positive(camera.focalMm, 0) || null,
        sensorWidthMm: positive(camera.sensorWidthMm, DEFAULT_SENSOR_WIDTH_MM),
        aspect: positive(camera.aspect, 16 / 9),
        horizonY: Number.isFinite(Number(camera.horizonY ?? camera.horizonYNormalized))
          ? clamp(camera.horizonY ?? camera.horizonYNormalized, 0, 1)
          : null,
        distanceM: positive(camera.distanceM, 0) || null,
      },
      anchors,
      overlay: {
        fit: input.overlay?.fit === "cover" ? "cover" : "contain",
        opacity: clamp(input.overlay?.opacity ?? 0.45, 0, 1),
      },
      sourceModel: String(input.sourceModel || input.analysisModel || "external").trim().slice(0, 80),
    };
  }

  return Object.freeze({
    DEFAULT_ACTOR_HEIGHT_M,
    ACTOR_RIG_MODEL_HEIGHT_M,
    ACTOR_RIG_WIDTH_M,
    ACTOR_RIG_DEPTH_M,
    DEFAULT_STAGE_LONG_EDGE_M,
    DEFAULT_SENSOR_WIDTH_MM,
    actorDimensions,
    actorRigScale,
    propDimensions,
    fitBounds,
    fieldOfView,
    perspectiveMetrics,
    stageWorldSize,
    stageNormalizedToWorld,
    worldToStageNormalized,
    frameFractionForDistance,
    distanceForFrameFraction,
    focalForFrameFraction,
    normalizeScaleAnchor,
    solveScaleAnchor,
    horizontalAngleFromFrameX,
    frameXFromHorizontalAngle,
    tiltFromHorizon,
    horizonFromTilt,
    calibratePerspective,
    fitOverlayRect,
    normalizedToOverlayPoint,
    overlayPointToNormalized,
    normalizeReferenceSpaceSpec,
  });
}));
