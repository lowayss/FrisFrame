(function initPrevisVideoAnalysis(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PrevisVideoAnalysisCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createPrevisVideoAnalysis() {
  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function fitFrameSize(width, height, maxLongEdge) {
    const safeWidth = Math.max(1, Number(width || 16));
    const safeHeight = Math.max(1, Number(height || 9));
    const scale = Math.max(1, Number(maxLongEdge || 1)) / Math.max(safeWidth, safeHeight);
    return {
      width: Math.max(2, Math.round(safeWidth * scale)),
      height: Math.max(2, Math.round(safeHeight * scale)),
    };
  }

  function resolveDraftDuration(draftDuration, keyframes = [], maxDuration = 60) {
    const manualEndTime = (Array.isArray(keyframes) ? keyframes : [])
      .filter((keyframe) => !keyframe?.provenance)
      .reduce((latest, keyframe) => Math.max(latest, Number(keyframe?.time || 0)), 0);
    return clamp(Math.max(1, Number(draftDuration || 0), manualEndTime), 1, Math.max(1, Number(maxDuration || 60)));
  }

  function normalizeTransition(value) {
    return ["smooth", "linear", "hold", "cut"].includes(value) ? value : "smooth";
  }

  function transitionProgress(time, startTime, endTime, transition = "smooth") {
    const span = Math.max(0.000001, Number(endTime) - Number(startTime));
    const raw = clamp((Number(time) - Number(startTime)) / span, 0, 1);
    const mode = normalizeTransition(transition);
    if (mode === "cut" || mode === "hold") return raw >= 1 ? 1 : 0;
    if (mode === "linear") return raw;
    return raw < 0.5 ? 2 * raw * raw : 1 - Math.pow(-2 * raw + 2, 2) / 2;
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
      const delta = Number(start.y ?? next.y ?? 0.5) - Number(next.y ?? start.y ?? 0.5);
      next.y = Number(start.y ?? next.y ?? 0.5);
      if (sourceType === "camera" && next.moveAimWithCamera !== false && Number.isFinite(Number(next.aimY))) {
        next.aimY = Number(next.aimY) + delta;
      }
    }
    if (normalized === "vertical") {
      const delta = Number(start.x ?? next.x ?? 0.5) - Number(next.x ?? start.x ?? 0.5);
      next.x = Number(start.x ?? next.x ?? 0.5);
      if (sourceType === "camera" && next.moveAimWithCamera !== false && Number.isFinite(Number(next.aimX))) {
        next.aimX = Number(next.aimX) + delta;
      }
    }
    return next;
  }

  function circularArcPoint(start = {}, end = {}, progress = 0, side = 1, bulge = 0.32) {
    const t = clamp(Number(progress), 0, 1);
    const x1 = Number(start.x || 0);
    const y1 = Number(start.y || 0);
    const x2 = Number(end.x || 0);
    const y2 = Number(end.y || 0);
    const dx = x2 - x1;
    const dy = y2 - y1;
    const chord = Math.hypot(dx, dy);
    if (chord < 0.000001 || t <= 0) return { x: x1, y: y1 };
    if (t >= 1) return { x: x2, y: y2 };

    const signedSide = Number(side) < 0 ? -1 : 1;
    const sagitta = chord * clamp(Math.abs(Number(bulge) || 0.32), 0.05, 0.49);
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
      x: inverse * inverse * Number(start.x || 0)
        + 2 * inverse * t * Number(control.x || 0)
        + t * t * Number(end.x || 0),
      y: inverse * inverse * Number(start.y || 0)
        + 2 * inverse * t * Number(control.y || 0)
        + t * t * Number(end.y || 0),
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
        x: (Number(start.x || 0) + Number(end.x || 0)) / 2,
        y: (Number(start.y || 0) + Number(end.y || 0)) / 2,
      };
      return quadraticBezierPoint(start, control, end, t);
    }
    if (normalized === "horizontal") {
      return {
        x: Number(start.x || 0) + (Number(end.x || 0) - Number(start.x || 0)) * t,
        y: Number(start.y || 0),
      };
    }
    if (normalized === "vertical") {
      return {
        x: Number(start.x || 0),
        y: Number(start.y || 0) + (Number(end.y || 0) - Number(start.y || 0)) * t,
      };
    }
    return {
      x: Number(start.x || 0) + (Number(end.x || 0) - Number(start.x || 0)) * t,
      y: Number(start.y || 0) + (Number(end.y || 0) - Number(start.y || 0)) * t,
    };
  }

  function accumulateCameraTransforms(motions = []) {
    let scale = 1;
    let tx = 0;
    let ty = 0;
    let shot = 1;
    return motions.map((motion, index) => {
      if (index > 0 && motion?.cut) {
        scale = 1;
        tx = 0;
        ty = 0;
        shot += 1;
      } else if (index > 0 && Number(motion?.confidence ?? 0) > 0.02) {
        const stepScale = clamp(Number(motion?.scale ?? 1), 0.9, 1.1);
        tx = tx * stepScale + Number(motion?.dx || 0);
        ty = ty * stepScale + Number(motion?.dy || 0);
        scale = clamp(scale * stepScale, 0.5, 2);
      }
      return { scale, tx, ty, shot, cut: Boolean(motion?.cut) };
    });
  }

  function stabilizeDetection(point, transform = {}, strength = 1) {
    const amount = clamp(Number(strength), 0, 1);
    const scale = clamp(Number(transform.scale || 1), 0.5, 2);
    const tx = Number(transform.tx || 0);
    const ty = Number(transform.ty || 0);
    const rawX = Number(point.x ?? 0.5);
    const rawY = Number(point.y ?? 0.5);
    const inverseX = 0.5 + (rawX - 0.5 - tx) / scale;
    const inverseY = 0.5 + (rawY - 0.5 - ty) / scale;
    const effectiveScale = 1 + (scale - 1) * amount;
    return {
      ...point,
      rawX,
      rawY,
      x: clamp(rawX + (inverseX - rawX) * amount, 0, 1),
      y: clamp(rawY + (inverseY - rawY) * amount, 0, 1),
      size: point.size == null ? point.size : clamp(Number(point.size) / effectiveScale, 0, 1),
      width: point.width == null ? point.width : clamp(Number(point.width) / effectiveScale, 0, 1),
    };
  }

  function smoothCameraTransforms(transforms = [], strength = 0.75) {
    const amount = clamp(Number(strength), 0, 1);
    if (!transforms.length || amount <= 0) return transforms.map((entry) => ({ ...entry }));
    const radius = amount > 0.66 ? 2 : 1;
    return transforms.map((entry, index) => {
      if (entry.cut) return { ...entry };
      let weightTotal = 0;
      let tx = 0;
      let ty = 0;
      let logScale = 0;
      for (let offset = -radius; offset <= radius; offset += 1) {
        const candidate = transforms[index + offset];
        if (!candidate || candidate.shot !== entry.shot || candidate.cut) continue;
        const weight = radius + 1 - Math.abs(offset);
        weightTotal += weight;
        tx += candidate.tx * weight;
        ty += candidate.ty * weight;
        logScale += Math.log(Math.max(0.001, candidate.scale)) * weight;
      }
      if (!weightTotal) return { ...entry };
      const averageScale = Math.exp(logScale / weightTotal);
      return {
        ...entry,
        tx: entry.tx + (tx / weightTotal - entry.tx) * amount,
        ty: entry.ty + (ty / weightTotal - entry.ty) * amount,
        scale: entry.scale + (averageScale - entry.scale) * amount,
      };
    });
  }

  function classifyCameraMotion(motions = [], localEnergies = []) {
    const usable = motions
      .map((motion, index) => ({ motion, index }))
      .filter(({ motion, index }) => index > 0 && !motion?.cut && Number(motion?.confidence ?? 0) > 0.05);
    if (!usable.length) return { type: "static", pan: 0, zoom: 0, jitter: 0 };
    const pan = usable.reduce((sum, { motion }) => sum + Math.hypot(Number(motion.dx || 0), Number(motion.dy || 0)), 0) / usable.length;
    const zoom = usable.reduce((sum, { motion }) => sum + Math.abs(Math.log(Math.max(0.001, Number(motion.scale || 1)))), 0) / usable.length;
    let reversals = 0;
    let comparable = 0;
    for (let index = 1; index < usable.length; index += 1) {
      const previous = usable[index - 1].motion;
      const current = usable[index].motion;
      const previousLength = Math.hypot(previous.dx || 0, previous.dy || 0);
      const currentLength = Math.hypot(current.dx || 0, current.dy || 0);
      if (previousLength < 0.001 || currentLength < 0.001) continue;
      comparable += 1;
      if ((previous.dx || 0) * (current.dx || 0) + (previous.dy || 0) * (current.dy || 0) < 0) reversals += 1;
    }
    const reversalRatio = comparable ? reversals / comparable : 0;
    const local = usable.reduce((sum, { index }) => sum + Number(localEnergies[index] || 0), 0) / usable.length;
    const jitter = clamp(reversalRatio * 0.75 + Math.min(1, local * 2) * 0.25, 0, 1);
    let type = "static";
    if (pan < 0.0015 && zoom < 0.002) type = "static";
    else if (jitter > 0.48 && pan < 0.025) type = "handheld";
    else if (pan >= 0.0015 && zoom >= 0.0035) type = "mixed";
    else if (zoom >= 0.0035) type = "zoom";
    else type = "pan";
    return { type, pan, zoom, jitter };
  }

  function inferSustainedActorCount(samples = [], fallback = 1, maxActors = 8) {
    const limit = Math.max(1, Math.round(Number(maxActors || 8)));
    const counts = samples.map((sample) => (sample.people || []).filter((person) => Number(person.score || 0) >= 0.35).length);
    if (!counts.length) return clamp(Math.round(Number(fallback || 1)), 1, limit);
    const requiredFrames = Math.max(2, Math.min(4, Math.ceil(counts.length * 0.12)));
    for (let count = limit; count >= 2; count -= 1) {
      let run = 0;
      for (const value of counts) {
        run = value >= count ? run + 1 : 0;
        if (run >= requiredFrames) return count;
      }
    }
    return clamp(Math.round(Number(fallback || 1)), 1, limit);
  }

  function assignTrackCandidates(states = [], candidates = []) {
    if (!candidates.length) return states.map(() => -1);
    let best = { cost: Infinity, assignment: states.map(() => -1) };
    const assignment = states.map(() => -1);
    const used = new Set();

    function visit(trackIndex, cost) {
      if (cost >= best.cost) return;
      if (trackIndex >= states.length) {
        best = { cost, assignment: [...assignment] };
        return;
      }
      const state = states[trackIndex] || {};
      assignment[trackIndex] = -1;
      visit(trackIndex + 1, cost + (state.initialized ? 0.5 : 1.15));
      candidates.forEach((candidate, candidateIndex) => {
        if (used.has(candidateIndex)) return;
        let candidateCost;
        if (!state.initialized) {
          candidateCost = (1 - clamp(Number(candidate.score ?? 0.5), 0, 1)) * 0.28 + candidateIndex * 0.001;
        } else {
          const predictedX = clamp(Number(state.x || 0) + Number(state.vx || 0), 0, 1);
          const predictedY = clamp(Number(state.y || 0) + Number(state.vy || 0), 0, 1);
          const distance = Math.hypot(Number(candidate.x || 0) - predictedX, Number(candidate.y || 0) - predictedY);
          if (distance > 0.48) return;
          const sizeChange = state.size
            ? Math.abs(Math.log(Math.max(0.05, Number(candidate.size || state.size)) / Math.max(0.05, Number(state.size))))
            : 0;
          candidateCost = distance * 1.55 + sizeChange * 0.28 + (1 - clamp(Number(candidate.score ?? 0.5), 0, 1)) * 0.12;
        }
        used.add(candidateIndex);
        assignment[trackIndex] = candidateIndex;
        visit(trackIndex + 1, cost + candidateCost);
        used.delete(candidateIndex);
        assignment[trackIndex] = -1;
      });
    }

    visit(0, 0);
    return best.assignment;
  }

  function mapReferenceDelta(screenX, screenY, sizeDelta = 0, calibration = {}) {
    const rotation = [0, 90, 180, 270].includes(Number(calibration.rotation)) ? Number(calibration.rotation) : 0;
    const lateralScale = clamp(Number(calibration.lateralScale ?? 0.8), 0.3, 1.2);
    const depthScale = clamp(Number(calibration.depthScale ?? 0.65), 0.2, 1.2);
    const sizeDepthWeight = clamp(Number(calibration.sizeDepthWeight ?? 0.1), 0, 0.3);
    const lateral = (calibration.mirrorX ? -screenX : screenX) * lateralScale;
    const depth = screenY * depthScale + sizeDelta * sizeDepthWeight;
    const angle = rotation * Math.PI / 180;
    return {
      x: lateral * Math.cos(angle) - depth * Math.sin(angle),
      y: lateral * Math.sin(angle) + depth * Math.cos(angle),
    };
  }

  function mapActorScreenPose(screenPose, origin, actorAnchor, calibration = {}) {
    const anchorToCurrent = calibration.anchorToCurrent !== false;
    const reference = origin || { x: 0.5, y: 0.5, size: screenPose.size || 0.3 };
    const screenX = anchorToCurrent ? screenPose.x - reference.x : screenPose.x - 0.5;
    const screenY = anchorToCurrent ? screenPose.y - reference.y : screenPose.y - 0.5;
    const scaleRatio = reference.size ? Number(screenPose.size || reference.size) / reference.size : 1;
    const delta = mapReferenceDelta(screenX, screenY, scaleRatio - 1, calibration);
    const base = anchorToCurrent ? actorAnchor : { x: 0.5, y: 0.5 };
    return {
      x: clamp(Number(base?.x ?? 0.5) + delta.x, 0.02, 0.98),
      y: clamp(Number(base?.y ?? 0.5) + delta.y, 0.02, 0.98),
    };
  }

  function projectScreenToStage3D(screenX, screenY, camera = {}, options = {}) {
    const aspect = Math.max(0.2, Number(options.aspect || 16 / 9));
    const stageWidth = Math.max(0.1, Number(options.stageWidth || 12));
    const stageDepth = Math.max(0.1, Number(options.stageDepth || stageWidth / aspect));
    const focal = clamp(Number(camera.focal || 50), 14, 135);
    const cameraPosition = {
      x: (clamp(Number(camera.x ?? 0.5), 0, 1) - 0.5) * stageWidth,
      y: clamp(Number(camera.height ?? 1.6), 0.1, 8),
      z: (clamp(Number(camera.y ?? 0.9), 0, 1) - 0.5) * stageDepth,
    };
    const focus = {
      x: (clamp(Number(camera.aimX ?? 0.5), 0, 1) - 0.5) * stageWidth,
      y: clamp(Number(camera.focusHeight ?? 1.1), 0, 6),
      z: (clamp(Number(camera.aimY ?? 0.5), 0, 1) - 0.5) * stageDepth,
    };
    const forward = normalize3({
      x: focus.x - cameraPosition.x,
      y: focus.y - cameraPosition.y,
      z: focus.z - cameraPosition.z,
    });
    const right = normalize3({ x: -forward.z, y: 0, z: forward.x });
    const up = normalize3(cross3(right, forward));
    const horizontalFov = 2 * Math.atan(36 / (2 * focal));
    const verticalFov = 2 * Math.atan(Math.tan(horizontalFov / 2) / aspect);
    const horizontal = (clamp(Number(screenX), 0, 1) * 2 - 1) * Math.tan(horizontalFov / 2);
    const vertical = (1 - clamp(Number(screenY), 0, 1) * 2) * Math.tan(verticalFov / 2);
    const direction = normalize3({
      x: forward.x + right.x * horizontal + up.x * vertical,
      y: forward.y + right.y * horizontal + up.y * vertical,
      z: forward.z + right.z * horizontal + up.z * vertical,
    });
    const groundY = Number(options.groundY || 0);
    if (direction.y >= -0.0001) return { x: 0.5, y: 0.5, confidence: 0, hit: false };
    const distance = (groundY - cameraPosition.y) / direction.y;
    if (!Number.isFinite(distance) || distance <= 0) return { x: 0.5, y: 0.5, confidence: 0, hit: false };
    const worldX = cameraPosition.x + direction.x * distance;
    const worldZ = cameraPosition.z + direction.z * distance;
    const rawX = worldX / stageWidth + 0.5;
    const rawY = worldZ / stageDepth + 0.5;
    const overshoot = Math.max(0, Math.abs(rawX - 0.5) - 0.5) + Math.max(0, Math.abs(rawY - 0.5) - 0.5);
    return {
      x: clamp(rawX, 0.02, 0.98),
      y: clamp(rawY, 0.02, 0.98),
      confidence: clamp(Math.abs(direction.y) * 3.2 - overshoot * 1.8, 0, 1),
      hit: true,
      worldX,
      worldZ,
    };
  }

  function normalize3(vector) {
    const length = Math.hypot(vector.x, vector.y, vector.z) || 1;
    return { x: vector.x / length, y: vector.y / length, z: vector.z / length };
  }

  function cross3(a, b) {
    return {
      x: a.y * b.z - a.z * b.y,
      y: a.z * b.x - a.x * b.z,
      z: a.x * b.y - a.y * b.x,
    };
  }

  function estimateGlobalFrameMotion(previous, current) {
    const width = current.width;
    const height = current.height;
    const brightnessDelta = current.mean - previous.mean;
    const maxShift = Math.round(clamp(width * 0.05, 4, 8));
    const scales = [0.94, 0.97, 1, 1.03, 1.06];
    const identityError = transformedFrameError(previous.luma, current.luma, width, height, 1, 0, 0, brightnessDelta, 3);
    let best = { error: identityError, dx: 0, dy: 0, scale: 1 };

    scales.forEach((scale) => {
      for (let dy = -maxShift; dy <= maxShift; dy += 2) {
        for (let dx = -maxShift; dx <= maxShift; dx += 2) {
          const error = transformedFrameError(previous.luma, current.luma, width, height, scale, dx, dy, brightnessDelta, 4);
          if (error < best.error) best = { error, dx, dy, scale };
        }
      }
    });

    const coarse = best;
    [...new Set([coarse.scale - 0.015, coarse.scale, coarse.scale + 0.015, 1])].forEach((scale) => {
      for (let dy = coarse.dy - 2; dy <= coarse.dy + 2; dy += 1) {
        for (let dx = coarse.dx - 2; dx <= coarse.dx + 2; dx += 1) {
          const error = transformedFrameError(previous.luma, current.luma, width, height, scale, dx, dy, brightnessDelta, 3);
          if (error < best.error) best = { error, dx, dy, scale };
        }
      }
    });

    const histogramShift = histogramDistance(previous.histogram, current.histogram);
    const fit = clamp(1 - best.error / 52, 0, 1);
    const improvement = clamp((identityError - best.error) / Math.max(8, identityError), 0, 1);
    const identityFit = clamp(1 - identityError / 52, 0, 1);
    const transformSize = Math.hypot(best.dx, best.dy) / Math.max(1, maxShift) + Math.abs(best.scale - 1) * 10;
    const stationaryConfidence = identityFit * clamp(1 - transformSize, 0, 1);
    const cut = histogramShift > 0.58
      || (histogramShift > 0.2 && best.error > 21.5)
      || best.error > 48;
    return {
      dx: best.dx / width,
      dy: best.dy / height,
      scale: clamp(best.scale, 0.9, 1.1),
      confidence: cut ? 0 : clamp(Math.max(stationaryConfidence, fit * 0.72 + improvement * 0.28), 0, 1),
      residual: best.error,
      cut,
    };
  }

  function transformedFrameError(previous, current, width, height, scale, dx, dy, brightnessDelta, step) {
    const centerX = (width - 1) / 2;
    const centerY = (height - 1) / 2;
    const margin = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) + 5);
    let total = 0;
    let count = 0;
    for (let y = margin; y < height - margin; y += step) {
      for (let x = margin; x < width - margin; x += step) {
        const targetX = Math.round(centerX + (x - centerX) * scale + dx);
        const targetY = Math.round(centerY + (y - centerY) * scale + dy);
        if (targetX < 0 || targetX >= width || targetY < 0 || targetY >= height) continue;
        const difference = Math.abs(previous[y * width + x] - (current[targetY * width + targetX] - brightnessDelta));
        total += Math.min(80, difference);
        count += 1;
      }
    }
    return count ? total / count : Infinity;
  }

  function histogramDistance(first, second) {
    if (!first || !second || first.length !== second.length) return 0;
    let distance = 0;
    for (let index = 0; index < first.length; index += 1) distance += Math.abs(first[index] - second[index]);
    return distance / 2;
  }

  function compensatedMotionFeatures(previous, current, cameraMotion) {
    const width = current.width;
    const height = current.height;
    const gridWidth = Math.floor(width / 2);
    const gridHeight = Math.floor(height / 2);
    const weights = new Float32Array(gridWidth * gridHeight);
    const centerX = (width - 1) / 2;
    const centerY = (height - 1) / 2;
    const dx = cameraMotion.dx * width;
    const dy = cameraMotion.dy * height;
    const brightnessDelta = current.mean - previous.mean;
    let total = 0;
    let xTotal = 0;
    let yTotal = 0;

    for (let row = 0; row < gridHeight; row += 1) {
      for (let col = 0; col < gridWidth; col += 1) {
        const sourceX = col * 2;
        const sourceY = row * 2;
        const targetX = Math.round(centerX + (sourceX - centerX) * cameraMotion.scale + dx);
        const targetY = Math.round(centerY + (sourceY - centerY) * cameraMotion.scale + dy);
        if (targetX < 0 || targetX >= width || targetY < 0 || targetY >= height) continue;
        const difference = Math.abs(previous.luma[sourceY * width + sourceX] - (current.luma[targetY * width + targetX] - brightnessDelta));
        const weight = difference > 17 ? difference - 17 : 0;
        weights[row * gridWidth + col] = weight;
        total += weight;
        xTotal += col * weight;
        yTotal += row * weight;
      }
    }

    return {
      x: total ? clamp(xTotal / total / Math.max(1, gridWidth - 1), 0, 1) : 0.5,
      y: total ? clamp(yTotal / total / Math.max(1, gridHeight - 1), 0, 1) : 0.5,
      energy: clamp(total / Math.max(1, gridWidth * gridHeight * 66), 0, 1),
      regions: findMotionRegions(weights, gridWidth, gridHeight),
    };
  }

  function findMotionRegions(weights, width, height) {
    const visited = new Uint8Array(weights.length);
    const regions = [];
    const threshold = 12;
    for (let start = 0; start < weights.length; start += 1) {
      if (visited[start] || weights[start] < threshold) continue;
      const queue = [start];
      visited[start] = 1;
      let weight = 0;
      let x = 0;
      let y = 0;
      let cells = 0;
      for (let cursor = 0; cursor < queue.length; cursor += 1) {
        const index = queue[cursor];
        const row = Math.floor(index / width);
        const col = index % width;
        const cellWeight = weights[index];
        weight += cellWeight;
        x += col * cellWeight;
        y += row * cellWeight;
        cells += 1;
        const neighbors = [index - 1, index + 1, index - width, index + width];
        neighbors.forEach((next) => {
          const nextRow = Math.floor(next / width);
          if (next < 0 || next >= weights.length || nextRow < 0 || nextRow >= height) return;
          if ((next === index - 1 && col === 0) || (next === index + 1 && col === width - 1)) return;
          if (Math.abs(nextRow - row) > 1 || visited[next] || weights[next] < threshold) return;
          visited[next] = 1;
          queue.push(next);
        });
      }
      if (cells < 2 || weight < 45) continue;
      regions.push({
        x: clamp(x / Math.max(1, weight) / Math.max(1, width - 1), 0, 1),
        y: clamp(y / Math.max(1, weight) / Math.max(1, height - 1), 0, 1),
        weight,
        cells,
      });
    }
    return regions.sort((a, b) => b.weight - a.weight).slice(0, 6);
  }

  return {
    assignTrackCandidates,
    compensatedMotionFeatures,
    accumulateCameraTransforms,
    classifyCameraMotion,
    estimateGlobalFrameMotion,
    fitFrameSize,
    findMotionRegions,
    inferSustainedActorCount,
    mapActorScreenPose,
    mapReferenceDelta,
    projectScreenToStage3D,
    resolveDraftDuration,
    circularArcPoint,
    constrainPathEndpoint,
    normalizePathMode,
    normalizeTransition,
    quadraticBezierPoint,
    samplePlanarPath,
    smoothCameraTransforms,
    stabilizeDetection,
    transitionProgress,
  };
});
