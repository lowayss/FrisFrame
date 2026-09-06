(function attachMultiCameraCore(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.FrisFrameMultiCameraCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createMultiCameraCore() {
  const DEFAULT_COLORS = ["#ff5f57", "#4fc3ff", "#ffd24a", "#66e08f", "#c38bff", "#ff9f43"];

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function cleanText(value, fallback, maxLength = 60) {
    const text = String(value ?? "").trim().slice(0, maxLength);
    return text || fallback;
  }

  function validColor(value, fallback) {
    return /^#[0-9a-f]{6}$/i.test(String(value || "")) ? String(value) : fallback;
  }

  function validOffset(value) {
    return value && typeof value === "object"
      && Number.isFinite(Number(value.x))
      && Number.isFinite(Number(value.y))
      ? { x: Number(value.x), y: Number(value.y) }
      : null;
  }

  function profileName(index) {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    return `카메라 ${alphabet[index] || index + 1}`;
  }

  function uniqueId(requested, used, index) {
    const base = cleanText(requested, `camera-${index + 1}`, 80).replace(/[^a-zA-Z0-9_-]/g, "-");
    let id = base || `camera-${index + 1}`;
    let suffix = 2;
    while (used.has(id)) id = `${base}-${suffix++}`;
    used.add(id);
    return id;
  }

  function cameraKeyframes(keyframes) {
    return Array.isArray(keyframes)
      ? keyframes.filter((keyframe) => keyframe && typeof keyframe === "object").map(clone)
      : [];
  }

  function normalizeProfiles(rawProfiles, fallbackCamera = {}, fallbackKeyframes = [], fallbackCameraSetup = {}) {
    const entries = Array.isArray(rawProfiles) ? rawProfiles : [];
    const used = new Set();
    const legacyKeys = cameraKeyframes(fallbackKeyframes);
    const profiles = entries.map((entry, index) => {
      const fallbackKeys = index === 0 && !Array.isArray(entry?.keyframes) ? legacyKeys : [];
      return {
        id: uniqueId(entry?.id, used, index),
        name: cleanText(entry?.name, profileName(index)),
        color: validColor(entry?.color, DEFAULT_COLORS[index % DEFAULT_COLORS.length]),
        camera: clone(entry?.camera && typeof entry.camera === "object" ? entry.camera : fallbackCamera) || {},
        cameraSetup: clone(entry?.cameraSetup && typeof entry.cameraSetup === "object" ? entry.cameraSetup : fallbackCameraSetup) || {},
        keyframes: cameraKeyframes(entry?.keyframes ?? fallbackKeys),
      };
    });
    if (!profiles.length) {
      profiles.push({
        id: "camera-1",
        name: profileName(0),
        color: DEFAULT_COLORS[0],
        camera: clone(fallbackCamera) || {},
        cameraSetup: clone(fallbackCameraSetup) || {},
        keyframes: legacyKeys,
      });
    }
    return profiles;
  }

  function resolveActiveId(activeId, profiles) {
    return profiles.some((profile) => profile.id === activeId) ? activeId : profiles[0]?.id || "camera-1";
  }

  function profileFor(profiles, id) {
    return (profiles || []).find((profile) => profile.id === id) || profiles?.[0] || null;
  }

  function mergeCameraKeyframes(keyframes, profileKeyframes) {
    return [
      ...(Array.isArray(keyframes) ? keyframes.filter((keyframe) => keyframe?.source !== "camera") : []),
      ...cameraKeyframes(profileKeyframes).map((keyframe) => ({ ...keyframe, source: "camera" })),
    ].sort((a, b) => Number(a.time || 0) - Number(b.time || 0));
  }

  function applyProfile(documentState, profileId) {
    const next = clone(documentState) || {};
    const profiles = normalizeProfiles(
      next.cameras,
      next.camera,
      next.motion?.keyframes?.filter((keyframe) => keyframe?.source === "camera"),
      next.cameraSetup,
    );
    const profile = profileFor(profiles, profileId);
    if (!profile) return next;
    next.cameras = profiles;
    next.activeCameraId = profile.id;
    next.camera = clone(profile.camera) || {};
    next.cameraSetup = clone(profile.cameraSetup) || next.cameraSetup || {};
    next.motion = next.motion || {};
    next.motion.keyframes = mergeCameraKeyframes(next.motion.keyframes, profile.keyframes);
    next.motion.selectedKeyId = null;
    return next;
  }

  function createProfile(id, name, color, camera, keyframes, cameraSetup = {}) {
    return {
      id: String(id || "camera-new"),
      name: cleanText(name, "새 카메라"),
      color: validColor(color, DEFAULT_COLORS[0]),
      camera: clone(camera) || {},
      cameraSetup: clone(cameraSetup) || {},
      keyframes: cameraKeyframes(keyframes),
    };
  }

  return {
    DEFAULT_COLORS,
    applyProfile,
    cameraKeyframes,
    clone,
    createProfile,
    mergeCameraKeyframes,
    normalizeProfiles,
    profileFor,
    resolveActiveId,
  };
});

(function initEnvironmentPresetMasterSetUpgrade(root) {
  "use strict";
  if (!root || typeof root.addEventListener !== "function" || typeof document === "undefined") return;

  const VERSION = 2;
  const PRESET_METRICS = {
    living: { width: 7.2, depth: 5.4, height: 2.8, spanX: 0.322, spanZ: 0.396 },
    kitchen: { width: 6.0, depth: 4.5, height: 2.8, spanX: 0.322, spanZ: 0.396 },
    bedroom: { width: 5.4, depth: 4.5, height: 2.7, spanX: 0.322, spanZ: 0.396 },
    forest: { width: 14.0, depth: 10.0, height: 5.0, spanX: 0.50, spanZ: 0.50 },
    car: { width: 5.0, depth: 2.4, height: 1.6, spanX: 0.40, spanZ: 0.40, centerSingle: true },
    office: { width: 7.2, depth: 5.4, height: 2.8, spanX: 0.322, spanZ: 0.396 },
    classroom: { width: 9.0, depth: 7.2, height: 3.0, spanX: 0.322, spanZ: 0.396 },
    corridor: { width: 2.4, depth: 12.0, height: 2.8, spanX: 0.122, spanZ: 0.396 },
    elevator_lobby: { width: 7.2, depth: 5.4, height: 2.8, spanX: 0.322, spanZ: 0.396 },
    bathroom: { width: 4.5, depth: 3.6, height: 2.6, spanX: 0.322, spanZ: 0.396 },
    train_cabin: { width: 3.0, depth: 18.0, height: 2.25, spanX: 0.10, spanZ: 0.68 },
    slope_hill: { width: 12.0, depth: 8.0, height: 4.0, spanX: 0.444, spanZ: 0.50 },
    classic_salon: { width: 10.5, depth: 8.0, height: 5.1, spanX: 0.50, spanZ: 0.50, centerSingle: true },
  };

  const ASSET_METRICS = {
    room: [1, 1, 1],
    television: [1.6, 0.12, 0.95],
    cabinet: [1.2, 0.55, 1.45],
    sofa: [2.3, 0.95, 0.9],
    "dining-table": [1.6, 0.9, 0.75],
    chair: [0.5, 0.55, 0.9],
    refrigerator: [0.9, 0.75, 1.9],
    window: [1.8, 0.1, 1.2],
    door: [0.95, 0.12, 2.1],
    stove: [0.75, 0.7, 0.9],
    sink: [0.8, 0.55, 0.88],
    bed: [1.6, 2.0, 0.65],
    desk: [1.4, 0.7, 0.75],
    forest: [5.0, 3.0, 4.0],
    tree: [1.4, 1.4, 4.0],
    car: [4.6, 1.9, 1.5],
    partition: [2.4, 0.12, 1.6],
    blackboard: [3.6, 0.12, 1.4],
    "corridor-wall": [12.0, 0.15, 2.8],
    elevator: [1.35, 0.25, 2.3],
    bathtub: [1.7, 0.8, 0.6],
    toilet: [0.7, 0.8, 0.8],
    "washing-machine": [0.65, 0.65, 0.9],
    "train-wall": [8.5, 0.08, 2.25],
    "train-seat": [0.85, 0.8, 1.1],
    slope: [6.0, 4.0, 1.0],
    stairs: [2.4, 3.0, 1.2],
    "classic-salon": [10.5, 8.0, 5.1],
  };

  const ASSET_SEMANTICS = {
    room: ["zone", "surface", "architecture"],
    wall: ["wall", "structure", "architecture"],
    wall_i: ["wall", "structure", "architecture"],
    wall_l: ["wall", "structure", "architecture"],
    wall_u: ["wall", "structure", "architecture"],
    "corridor-wall": ["wall", "structure", "architecture"],
    "train-wall": ["wall", "structure", "architecture"],
    partition: ["partition", "structure", "architecture"],
    door: ["door", "opening", "architecture"],
    window: ["window", "opening", "architecture"],
    elevator: ["generic", "structure", "architecture"],
    stairs: ["stairs", "structure", "architecture"],
    slope: ["generic", "surface", "architecture"],
    "classic-salon": ["generic", "structure", "architecture"],
    desk: ["table", "furniture", "furniture"],
    blackboard: ["generic", "prop", "furniture"],
    cabinet: ["cabinet", "furniture", "furniture"],
    "dining-table": ["table", "furniture", "furniture"],
    chair: ["chair", "furniture", "furniture"],
    sofa: ["sofa", "furniture", "furniture"],
    bed: ["bed", "furniture", "furniture"],
    "train-seat": ["chair", "furniture", "furniture"],
    sink: ["sink", "service", "fixtures"],
    toilet: ["toilet", "service", "fixtures"],
    bathtub: ["bathtub", "service", "fixtures"],
    refrigerator: ["refrigerator", "service", "fixtures"],
    stove: ["stove", "service", "fixtures"],
    "washing-machine": ["generic", "service", "fixtures"],
    television: ["television", "prop", "props"],
    tree: ["tree", "vegetation", "environment"],
    forest: ["vegetation", "vegetation", "environment"],
    car: ["generic", "prop", "vehicles"],
  };

  const COLLECTION_NAMES = {
    architecture: "Architecture",
    furniture: "Furniture",
    fixtures: "Fixtures",
    props: "Props",
    environment: "Environment",
    vehicles: "Vehicles",
  };

  function stageSize() {
    try {
      if (typeof stageWorldSize === "function" && typeof state !== "undefined") return stageWorldSize(state);
    } catch {
      // Fall through to the product's default 16:9 stage.
    }
    return { width: 36, depth: 20.25 };
  }

  function worldPosition(rawX, rawY, metric) {
    if (metric.centerSingle) return { x: 0, z: 0 };
    return {
      x: (Number(rawX || 0.5) - 0.5) * metric.width / metric.spanX,
      z: (Number(rawY || 0.5) - 0.5) * metric.depth / metric.spanZ,
    };
  }

  function dimensionsFor(assetType, metric) {
    if (assetType === "room") return { width: metric.width, depth: metric.depth, height: metric.height };
    const values = ASSET_METRICS[assetType] || [1, 1, 1];
    return { width: values[0], depth: values[1], height: values[2] };
  }

  function semanticsFor(assetType) {
    const values = ASSET_SEMANTICS[assetType] || ["generic", "prop", "props"];
    return { kind: values[0], role: values[1], collectionId: values[2] };
  }

  function wallLine(element) {
    if (!["wall", "partition", "railing"].includes(element.kind)) return null;
    const angle = Number(element.rotationDeg || 0) * Math.PI / 180;
    const dx = Math.cos(angle) * element.widthM / 2;
    const dz = Math.sin(angle) * element.widthM / 2;
    return {
      start_x_m: element.worldXM - dx,
      start_z_m: element.worldZM - dz,
      end_x_m: element.worldXM + dx,
      end_z_m: element.worldZM + dz,
      length_m: element.widthM,
      thickness_m: element.depthM,
    };
  }

  function distanceToWall(element, wall) {
    const line = wall.line;
    if (!line) return Infinity;
    const sx = line.start_x_m;
    const sz = line.start_z_m;
    const ex = line.end_x_m;
    const ez = line.end_z_m;
    const dx = ex - sx;
    const dz = ez - sz;
    const lengthSq = dx * dx + dz * dz;
    if (!lengthSq) return Infinity;
    const t = Math.max(0, Math.min(1, ((element.worldXM - sx) * dx + (element.worldZM - sz) * dz) / lengthSq));
    return Math.hypot(element.worldXM - (sx + dx * t), element.worldZM - (sz + dz * t));
  }

  function resolveOpeningParents(elements) {
    const walls = elements.filter((element) => ["wall", "partition"].includes(element.kind));
    const room = elements.find((element) => element.kind === "zone" && element.role === "surface");
    elements.forEach((element) => {
      if (!["door", "window"].includes(element.kind)) return;
      const nearest = walls
        .map((wall) => ({ wall, distance: distanceToWall(element, wall) }))
        .sort((left, right) => left.distance - right.distance)[0];
      if (nearest && nearest.distance <= 0.65) element.parentId = nearest.wall.id;
      else if (room) element.parentId = room.id;
    });
  }

  function auditPresets() {
    const result = { version: VERSION, presetCount: 0, missingMetricPresets: [], unknownAssets: [], missingTupleNames: [] };
    try {
      if (typeof environmentPresets === "undefined") return { ...result, unavailable: true };
      Object.entries(environmentPresets).forEach(([presetId, preset]) => {
        result.presetCount += 1;
        if (!PRESET_METRICS[presetId]) result.missingMetricPresets.push(presetId);
        (preset.items || []).forEach((tuple, index) => {
          if (!ASSET_METRICS[tuple[0]]) result.unknownAssets.push(`${presetId}:${tuple[0]}`);
          if (!String(tuple[1] || "").trim()) result.missingTupleNames.push(`${presetId}:${index}`);
        });
      });
    } catch (error) {
      result.error = String(error?.message || error);
    }
    result.unknownAssets = [...new Set(result.unknownAssets)];
    result.ready = !result.missingMetricPresets.length && !result.unknownAssets.length && !result.missingTupleNames.length;
    return result;
  }

  function buildPresetPlan(presetId, preset, presetItems) {
    const metric = PRESET_METRICS[presetId];
    if (!metric) return null;
    const tuples = new Map((preset.items || []).map((tuple) => [String(tuple[1]), tuple]));
    const size = stageSize();
    const elements = [];
    const warnings = [];

    presetItems.forEach((item) => {
      const tuple = tuples.get(String(item.name));
      if (!tuple) {
        warnings.push(`tuple-not-found:${item.name}`);
        return;
      }
      const assetType = String(item.assetType || tuple[0] || "generic");
      const position = worldPosition(tuple[2], tuple[3], metric);
      const dimensions = dimensionsFor(assetType, metric);
      const semantics = semanticsFor(assetType);
      const facing = Number(tuple[4] || 0);
      const mountedHeight = Number(tuple[6] || 0);

      item.x = Math.max(0.02, Math.min(0.98, 0.5 + position.x / size.width));
      item.y = Math.max(0.02, Math.min(0.98, 0.5 + position.z / size.depth));
      item.facing = ((facing % 360) + 360) % 360;
      item.size = 1;
      item.scaleX = 1;
      item.scaleY = 1;
      item.scaleZ = 1;
      item.mountedHeight = mountedHeight;
      item.referenceDimensionsM = { ...dimensions };
      item.referenceAnchorId = item.id;
      item.motionEnabled = false;

      const element = {
        id: item.id,
        name: item.name,
        kind: semantics.kind,
        role: semantics.role,
        basis: "user_fixed",
        confidence: 1,
        collectionId: semantics.collectionId,
        parentId: "",
        worldXM: position.x,
        worldZM: position.z,
        widthM: dimensions.width,
        heightM: dimensions.height,
        depthM: dimensions.depth,
        rotationDeg: item.facing,
        mountedHeightM: mountedHeight,
        assetType,
        line: null,
        notes: `Curated environment preset v${VERSION}.`,
      };
      element.line = wallLine(element);
      elements.push(element);
    });

    resolveOpeningParents(elements);
    const collectionIds = [...new Set(elements.map((element) => element.collectionId))];
    const collections = collectionIds.map((collectionId) => {
      const memberIds = elements.filter((element) => element.collectionId === collectionId).map((element) => element.id);
      return {
        id: collectionId,
        name: COLLECTION_NAMES[collectionId] || collectionId,
        parentId: "",
        memberIds,
        locked: false,
        allowPartialUnlock: true,
        unlockedMemberIds: [...memberIds],
      };
    });

    return {
      plan: {
        schema: "frisframe-set-master-plan",
        version: 1,
        status: warnings.length ? "review" : "ready",
        sourceName: `Preset · ${preset.label}`,
        unit: "meter",
        workflowPolicy: "curated-preset-master-set-v2",
        declaredWidthM: metric.width,
        declaredDepthM: metric.depth,
        bounds: {
          min_x: -metric.width / 2,
          max_x: metric.width / 2,
          min_z: -metric.depth / 2,
          max_z: metric.depth / 2,
          width_m: metric.width,
          depth_m: metric.depth,
        },
        generatedItemIds: elements.map((element) => element.id),
        elements,
        presetQuality: {
          schema: "frisframe-curated-preset-quality",
          version: VERSION,
          presetId,
          metricLayout: true,
          semanticCollections: true,
          openingParents: true,
          exactItemDimensions: true,
          warnings,
        },
        notes: "Curated FrisFrame environment preset upgraded to a metric Master Set shared by 2D, 2.5D and 3D.",
      },
      collections,
      warnings,
    };
  }

  function upgradePreset(presetId, shouldCommit = true) {
    try {
      if (typeof state === "undefined" || typeof environmentPresets === "undefined") return false;
      const preset = environmentPresets[presetId];
      if (!preset || !PRESET_METRICS[presetId]) return false;
      const active = (state.items || []).filter((item) => item.presetInstanceId);
      if (!active.length) return false;
      const instanceId = active[active.length - 1].presetInstanceId;
      const presetItems = active.filter((item) => item.presetInstanceId === instanceId);
      const built = buildPresetPlan(presetId, preset, presetItems);
      if (!built) return false;
      state.setMasterPlan = built.plan;
      state.setCollections = built.collections;
      if (shouldCommit && typeof commit === "function") {
        commit({ preserveSourceIds: built.plan.generatedItemIds });
      }
      if (typeof syncUi === "function") syncUi(false);
      if (typeof renderThreeView === "function" && typeof viewMode !== "undefined" && viewMode === "3d") {
        renderThreeView(typeof currentInteractionFrame === "function" ? currentInteractionFrame() : state, true);
      }
      return true;
    } catch (error) {
      console.error("[FrisFrame] preset Master Set upgrade failed", error);
      return false;
    }
  }

  function install() {
    const rootNode = document.getElementById("environmentPresetButtons");
    if (!rootNode || root.FrisFrameEnvironmentPresetQuality) return;
    rootNode.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-environment-preset]");
      const presetId = button?.dataset.environmentPreset;
      if (!presetId || !PRESET_METRICS[presetId]) return;
      queueMicrotask(() => {
        if (upgradePreset(presetId, true) && typeof notifyApp === "function") {
          notifyApp("세트 프리셋을 미터 기반 Master Set으로 적용했습니다.");
        }
      });
    });
    root.FrisFrameEnvironmentPresetQuality = {
      version: VERSION,
      presetIds: Object.keys(PRESET_METRICS),
      audit: auditPresets,
      upgradeCurrent() {
        try {
          return typeof state !== "undefined" && state.spacePresetId
            ? upgradePreset(state.spacePresetId, true)
            : false;
        } catch {
          return false;
        }
      },
      getSpec(presetId) {
        const value = PRESET_METRICS[presetId];
        return value ? { ...value } : null;
      },
    };
  }

  root.addEventListener("load", install, { once: true });
})(typeof window !== "undefined" ? window : null);

(function initArchitecturalCadRuntime(root) {
  "use strict";
  if (!root || typeof root.addEventListener !== "function" || typeof document === "undefined") return;

  const WALL_KINDS = new Set(["wall", "partition", "railing"]);
  const OPENING_KINDS = new Set(["door", "window"]);
  const runtime = { installed: false, reconciling: false, attempts: 0 };

  function currentState() { return typeof state !== "undefined" ? state : null; }
  function plan() {
    const value = currentState()?.setMasterPlan;
    return value && Array.isArray(value.elements) ? value : null;
  }
  function itemFor(id) { return currentState()?.items?.find?.((entry) => String(entry.id) === String(id)) || null; }
  function elementFor(id) { return plan()?.elements?.find?.((entry) => String(entry.id) === String(id)) || null; }
  function kindOf(element, item) { return String(element?.kind || item?.setKind || item?.assetType || "").toLowerCase(); }
  function isWall(element, item) { return WALL_KINDS.has(kindOf(element, item)); }
  function isOpening(element, item) { return OPENING_KINDS.has(kindOf(element, item)); }
  function stageSize() { return typeof stageWorldSize === "function" ? stageWorldSize(currentState()) : { width: 36, depth: 20.25 }; }
  function selectedItem() {
    if (typeof selected === "undefined" || !selected?.id || !["item", "facing"].includes(selected.kind)) return null;
    const id = typeof transformLeaderIdForItem === "function"
      ? (transformLeaderIdForItem(selected.id, currentState()) || selected.id)
      : selected.id;
    return itemFor(id);
  }
  function locked(item) { return typeof sourceEditLocked === "function" ? Boolean(sourceEditLocked(item?.id)) : Boolean(item?.editLocked); }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, Number(value) || 0)); }
  function worldOf(item) {
    const size = stageSize();
    const pose = typeof resolvedItemPose === "function" ? resolvedItemPose(item, currentState()) : item;
    return { x: (Number(pose?.x ?? 0.5) - 0.5) * size.width, z: (Number(pose?.y ?? 0.5) - 0.5) * size.depth };
  }
  function setWorld(item, x, z) {
    const size = stageSize();
    const min = typeof STAGE_COORD_MIN !== "undefined" ? Number(STAGE_COORD_MIN) : 0.02;
    const max = typeof STAGE_COORD_MAX !== "undefined" ? Number(STAGE_COORD_MAX) : 0.98;
    item.x = clamp(0.5 + x / size.width, min, max);
    item.y = clamp(0.5 + z / size.depth, min, max);
  }
  function dimensions(item) {
    const value = item?.referenceDimensionsM || item?.physicalDimensionsM;
    return value ? { width: Number(value.width || 0), height: Number(value.height || 0), depth: Number(value.depth || 0) } : null;
  }
  function lineFor(element, item = itemFor(element?.id)) {
    const raw = element?.line;
    if (raw && [raw.start_x_m, raw.start_z_m, raw.end_x_m, raw.end_z_m].every(Number.isFinite)) {
      const sx = Number(raw.start_x_m), sz = Number(raw.start_z_m), ex = Number(raw.end_x_m), ez = Number(raw.end_z_m);
      const length = Math.hypot(ex - sx, ez - sz);
      if (length > 0.01) return { sx, sz, ex, ez, length, thickness: Number(raw.thickness_m || element.depthM || 0.15), rotation: Math.atan2(ez - sz, ex - sx) * 180 / Math.PI };
    }
    if (!element && !item) return null;
    const center = item ? worldOf(item) : { x: Number(element.worldXM || 0), z: Number(element.worldZM || 0) };
    const dims = dimensions(item);
    const length = Math.max(0.02, Number(element?.widthM || dims?.width || 1));
    const thickness = Math.max(0.01, Number(element?.depthM || dims?.depth || 0.15));
    const rotation = Number(item?.facing ?? element?.rotationDeg ?? 0);
    const angle = rotation * Math.PI / 180;
    const hx = Math.cos(angle) * length / 2, hz = Math.sin(angle) * length / 2;
    return { sx: center.x - hx, sz: center.z - hz, ex: center.x + hx, ez: center.z + hz, length, thickness, rotation };
  }
  function project(x, z, line, halfWidth = 0) {
    const dx = line.ex - line.sx, dz = line.ez - line.sz;
    const d2 = dx * dx + dz * dz;
    if (d2 <= 1e-9) return null;
    const inset = Math.min(0.49, Math.max(0, halfWidth / line.length));
    const t = clamp(((x - line.sx) * dx + (z - line.sz) * dz) / d2, inset, 1 - inset);
    return { t, x: line.sx + dx * t, z: line.sz + dz * t };
  }
  function writeLine(element, line) {
    element.worldXM = (line.sx + line.ex) / 2;
    element.worldZM = (line.sz + line.ez) / 2;
    element.widthM = line.length;
    element.depthM = line.thickness;
    element.rotationDeg = line.rotation;
    element.line = { start_x_m: line.sx, start_z_m: line.sz, end_x_m: line.ex, end_z_m: line.ez, length_m: line.length, thickness_m: line.thickness };
  }
  function snapOpening(id) {
    const item = itemFor(id), element = elementFor(id);
    if (!item || !element || !isOpening(element, item) || !element.parentId) return false;
    const parent = elementFor(element.parentId), parentItem = itemFor(element.parentId);
    if (!parent || !parentItem || !isWall(parent, parentItem)) return false;
    const line = lineFor(parent, parentItem), world = worldOf(item), dims = dimensions(item);
    const point = project(world.x, world.z, line, Number(element.widthM || dims?.width || 0) / 2);
    if (!point) return false;
    setWorld(item, point.x, point.z);
    item.facing = ((line.rotation % 360) + 360) % 360;
    element.worldXM = point.x;
    element.worldZM = point.z;
    element.rotationDeg = line.rotation;
    element.attachmentT = point.t;
    return true;
  }
  function children(parentId) {
    return (plan()?.elements || [])
      .filter((entry) => String(entry.parentId || "") === String(parentId) && OPENING_KINDS.has(String(entry.kind || "")))
      .map((entry) => ({ element: entry, item: itemFor(entry.id) }))
      .filter((entry) => entry.item);
  }
  function moveChildren(parentId, oldLine, nextLine) {
    children(parentId).forEach(({ item, element }) => {
      const half = Number(element.widthM || dimensions(item)?.width || 0) / 2;
      const oldPoint = project(worldOf(item).x, worldOf(item).z, oldLine, half);
      const inset = Math.min(0.49, Math.max(0, half / nextLine.length));
      const t = clamp(Number.isFinite(element.attachmentT) ? element.attachmentT : (oldPoint?.t ?? 0.5), inset, 1 - inset);
      const x = nextLine.sx + (nextLine.ex - nextLine.sx) * t;
      const z = nextLine.sz + (nextLine.ez - nextLine.sz) * t;
      setWorld(item, x, z);
      item.facing = ((nextLine.rotation % 360) + 360) % 360;
      element.worldXM = x;
      element.worldZM = z;
      element.rotationDeg = nextLine.rotation;
      element.attachmentT = t;
    });
  }
  function reconcileWall(item, element) {
    const oldLine = lineFor(element, null) || lineFor(element, item);
    if (!oldLine) return false;
    const center = worldOf(item), dims = dimensions(item);
    const length = Math.max(0.1, Number(element.widthM || dims?.width || oldLine.length));
    const thickness = Math.max(0.03, Number(element.depthM || dims?.depth || oldLine.thickness));
    const rotation = Number(item.facing ?? element.rotationDeg ?? oldLine.rotation);
    const angle = rotation * Math.PI / 180;
    const hx = Math.cos(angle) * length / 2, hz = Math.sin(angle) * length / 2;
    const nextLine = { sx: center.x - hx, sz: center.z - hz, ex: center.x + hx, ez: center.z + hz, length, thickness, rotation };
    const changed = Math.hypot(oldLine.sx - nextLine.sx, oldLine.sz - nextLine.sz) + Math.hypot(oldLine.ex - nextLine.ex, oldLine.ez - nextLine.ez) > 1e-7;
    if (!changed) return false;
    writeLine(element, nextLine);
    moveChildren(item.id, oldLine, nextLine);
    return true;
  }
  function polygonArea(points) {
    let area = 0;
    points.forEach((point, index) => {
      const next = points[(index + 1) % points.length];
      area += point.x * next.z - next.x * point.z;
    });
    return area / 2;
  }
  function deriveRoomZones() {
    const wallEntries = (plan()?.elements || []).filter((entry) => WALL_KINDS.has(String(entry.kind || ""))).map((entry) => ({ entry, line: lineFor(entry) })).filter((value) => value.line);
    if (wallEntries.length < 3) return [];
    const nodes = [], edges = [];
    const nodeFor = (x, z) => {
      const existing = nodes.findIndex((node) => Math.hypot(node.x - x, node.z - z) <= 0.03);
      if (existing >= 0) return existing;
      nodes.push({ x, z });
      return nodes.length - 1;
    };
    wallEntries.forEach(({ entry, line }) => {
      const a = nodeFor(line.sx, line.sz), b = nodeFor(line.ex, line.ez);
      if (a !== b) edges.push({ a, b, wallId: String(entry.id) });
    });
    const neighbors = nodes.map(() => []), wallByPair = new Map();
    edges.forEach((edge) => {
      neighbors[edge.a].push(edge.b); neighbors[edge.b].push(edge.a);
      wallByPair.set(`${Math.min(edge.a, edge.b)}:${Math.max(edge.a, edge.b)}`, edge.wallId);
    });
    neighbors.forEach((list, nodeId) => list.sort((left, right) => Math.atan2(nodes[left].z - nodes[nodeId].z, nodes[left].x - nodes[nodeId].x) - Math.atan2(nodes[right].z - nodes[nodeId].z, nodes[right].x - nodes[nodeId].x)));
    const visited = new Set(), faces = [];
    edges.forEach((edge) => [[edge.a, edge.b], [edge.b, edge.a]].forEach(([sa, sb]) => {
      const start = `${sa}>${sb}`;
      if (visited.has(start)) return;
      const ids = [], wallIds = [];
      let a = sa, b = sb;
      for (let guard = 0; guard < edges.length * 4 + 8; guard += 1) {
        const key = `${a}>${b}`;
        if (visited.has(key) && key !== start) break;
        visited.add(key); ids.push(a); wallIds.push(wallByPair.get(`${Math.min(a, b)}:${Math.max(a, b)}`));
        const options = neighbors[b], reverse = options.indexOf(a);
        if (reverse < 0 || !options.length) break;
        const next = options[(reverse - 1 + options.length) % options.length];
        a = b; b = next;
        if (a === sa && b === sb) {
          const points = ids.map((id) => nodes[id]), area = polygonArea(points);
          if (points.length >= 3 && area > 0.25) faces.push({ points, area, wallIds: [...new Set(wallIds.filter(Boolean))] });
          break;
        }
      }
    }));
    return faces.sort((a, b) => b.area - a.area).map((face, index) => ({
      id: `room-zone-${index + 1}`,
      name: `Room ${index + 1}`,
      points: face.points.map((point) => ({ xM: Number(point.x.toFixed(4)), zM: Number(point.z.toFixed(4)) })),
      areaM2: Number(face.area.toFixed(4)),
      wallIds: face.wallIds,
      basis: "derived-closed-wall-loop",
    }));
  }
  function refreshRoomZones() {
    const current = plan();
    if (!current) return [];
    current.roomZones = deriveRoomZones();
    return current.roomZones;
  }
  function reconcile() {
    if (runtime.reconciling || !plan()) return false;
    runtime.reconciling = true;
    try {
      let changed = false;
      plan().elements.forEach((element) => {
        const item = itemFor(element.id);
        if (item && isWall(element, item)) changed = reconcileWall(item, element) || changed;
      });
      plan().elements.forEach((element) => {
        const item = itemFor(element.id);
        if (item && isOpening(element, item) && element.parentId) changed = snapOpening(item.id) || changed;
      });
      refreshRoomZones();
      return changed;
    } finally { runtime.reconciling = false; }
  }
  function setWallMetrics(itemId, lengthM, thicknessM) {
    const item = itemFor(itemId), element = elementFor(itemId);
    if (!item || !element || !isWall(element, item)) return false;
    if (locked(item)) {
      if (typeof notifyEditLocked === "function") notifyEditLocked(item.name || "벽");
      return false;
    }
    if (typeof materializeEvaluatedViewForEditing === "function") materializeEvaluatedViewForEditing(item.id);
    const oldLine = lineFor(element, item);
    const length = clamp(lengthM ?? oldLine.length, 0.1, 100), thickness = clamp(thicknessM ?? oldLine.thickness, 0.03, 2);
    const cx = (oldLine.sx + oldLine.ex) / 2, cz = (oldLine.sz + oldLine.ez) / 2, angle = oldLine.rotation * Math.PI / 180;
    const hx = Math.cos(angle) * length / 2, hz = Math.sin(angle) * length / 2;
    const nextLine = { sx: cx - hx, sz: cz - hz, ex: cx + hx, ez: cz + hz, length, thickness, rotation: oldLine.rotation };
    const dims = dimensions(item) || { height: Number(element.heightM || 2.8) };
    item.referenceDimensionsM = { width: length, height: Math.max(0.02, Number(dims.height || element.heightM || 2.8)), depth: thickness };
    if (item.physicalDimensionsM) item.physicalDimensionsM = { ...item.referenceDimensionsM };
    writeLine(element, nextLine);
    moveChildren(item.id, oldLine, nextLine);
    refreshRoomZones();
    const preserved = [item.id, ...children(item.id).map((entry) => entry.item.id)];
    if (typeof commit === "function") commit({ preserveSourceIds: preserved });
    if (typeof syncUi === "function") syncUi(false);
    if (typeof renderThreeView === "function") renderThreeView(typeof currentInteractionFrame === "function" ? currentInteractionFrame() : currentState(), true);
    syncFields();
    return true;
  }
  function installFields() {
    const controls = document.getElementById("birdseyeCadControls");
    if (!controls || document.getElementById("architecturalCadFields")) return Boolean(controls);
    const fields = document.createElement("span");
    fields.id = "architecturalCadFields";
    fields.hidden = true;
    fields.style.cssText = "display:inline-flex;align-items:center;gap:5px;white-space:nowrap";
    const lengthInput = document.createElement("input"), thicknessInput = document.createElement("input"), badge = document.createElement("span");
    lengthInput.id = "wallLengthM"; thicknessInput.id = "wallThicknessM"; badge.id = "architecturalRoomBadge";
    [[lengthInput, "벽 길이", "0.10", "100", "0.05"], [thicknessInput, "두께", "0.03", "2", "0.01"]].forEach(([input, label, min, max, step]) => {
      const wrap = document.createElement("label");
      wrap.textContent = label; input.type = "number"; input.min = min; input.max = max; input.step = step; input.style.width = "64px"; wrap.appendChild(input); fields.appendChild(wrap);
    });
    fields.appendChild(badge);
    const readout = document.getElementById("birdseyeCadReadout");
    controls.insertBefore(fields, readout || null);
    const apply = () => {
      const item = selectedItem();
      if (item) setWallMetrics(item.id, Number(lengthInput.value), Number(thicknessInput.value));
    };
    lengthInput.addEventListener("change", apply); thicknessInput.addEventListener("change", apply);
    return true;
  }
  function syncFields() {
    const fields = document.getElementById("architecturalCadFields");
    if (!fields) return;
    const item = selectedItem(), element = item ? elementFor(item.id) : null;
    const show = root.FrisFrameBirdseye25D?.mode === "2.5d" && item && element && isWall(element, item);
    fields.hidden = !show;
    fields.style.display = show ? "inline-flex" : "none";
    if (!show) return;
    const line = lineFor(element, item), lengthInput = document.getElementById("wallLengthM"), thicknessInput = document.getElementById("wallThicknessM");
    if (document.activeElement !== lengthInput) lengthInput.value = line.length.toFixed(2);
    if (document.activeElement !== thicknessInput) thicknessInput.value = line.thickness.toFixed(2);
    const badge = document.getElementById("architecturalRoomBadge");
    if (badge) badge.textContent = `방 ${plan()?.roomZones?.length || 0}`;
  }
  function installHooks() {
    if (typeof commit === "function") {
      const originalCommit = commit;
      commit = function architecturalCommit(...args) { reconcile(); return originalCommit(...args); };
    }
    if (typeof updateThreeEditorDrag === "function") {
      const originalDrag = updateThreeEditorDrag;
      updateThreeEditorDrag = function architecturalDrag(...args) {
        const result = originalDrag(...args);
        if (root.FrisFrameBirdseye25D?.mode === "2.5d" && typeof threeDrag !== "undefined" && threeDrag?.kind === "edit" && !threeDrag.pending) {
          const id = threeDrag.editItemId || threeDrag.editor?.id, item = itemFor(id), element = elementFor(id);
          if (item && element && isOpening(element, item)) snapOpening(id);
          if (item && element && isWall(element, item)) reconcileWall(item, element);
          refreshRoomZones();
        }
        syncFields();
        return result;
      };
    }
    if (typeof syncUi === "function") {
      const originalSync = syncUi;
      syncUi = function architecturalSync(...args) { const result = originalSync(...args); reconcile(); syncFields(); return result; };
    }
  }
  function install() {
    if (runtime.installed) return;
    runtime.attempts += 1;
    if (!root.FrisFrameBirdseyeCad || typeof commit !== "function" || typeof updateThreeEditorDrag !== "function") {
      if (runtime.attempts < 80) setTimeout(install, 50);
      return;
    }
    if (!installFields()) { if (runtime.attempts < 80) setTimeout(install, 50); return; }
    installHooks(); refreshRoomZones(); syncFields();
    document.addEventListener("click", (event) => { if (event.target?.closest?.("#viewButtons,#threeCanvas,#birdseyeCadControls")) requestAnimationFrame(syncFields); });
    runtime.installed = true;
    root.FrisFrameArchitecturalCad = {
      get roomZones() { return plan()?.roomZones || []; },
      deriveRoomZones,
      refreshRoomZones,
      reconcile,
      snapOpeningToParent: snapOpening,
      setWallMetrics,
      getSelectedWallMetrics() {
        const item = selectedItem(), element = item ? elementFor(item.id) : null;
        if (!item || !element || !isWall(element, item)) return null;
        const line = lineFor(element, item);
        return { lengthM: line.length, thicknessM: line.thickness };
      },
    };
  }

  root.addEventListener("load", install, { once: true });
})(typeof window !== "undefined" ? window : null);
