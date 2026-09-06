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
  const ENDPOINT_SNAP_TOLERANCE_M = 0.18;
  const OPENING_REATTACH_TOLERANCE_M = 0.65;
  const runtime = { installed: false, reconciling: false, attempts: 0, endpointDrag: null, lastEndpointSnap: null, tool: "select", toolAnchor: null, mergeFirstWallId: null, measurementsVisible: true };

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
  function closestPointOnLine(x, z, line) {
    const dx = line.ex - line.sx, dz = line.ez - line.sz;
    const d2 = dx * dx + dz * dz;
    if (d2 <= 1e-9) return null;
    const t = clamp(((x - line.sx) * dx + (z - line.sz) * dz) / d2, 0, 1);
    const px = line.sx + dx * t, pz = line.sz + dz * t;
    return { t, x: px, z: pz, distanceM: Math.hypot(x - px, z - pz) };
  }
  function nearestWallForOpening(id, maxDistanceM = OPENING_REATTACH_TOLERANCE_M) {
    const item = itemFor(id), element = elementFor(id);
    if (!item || !element || !isOpening(element, item)) return null;
    const point = worldOf(item), dims = dimensions(item);
    const width = Math.max(0, Number(element.widthM || dims?.width || 0));
    let best = null;
    (plan()?.elements || []).forEach((wall) => {
      const wallItem = itemFor(wall.id);
      if (!wallItem || !isWall(wall, wallItem)) return;
      const line = lineFor(wall, wallItem);
      if (!line || line.length < width + 0.04) return;
      const projection = closestPointOnLine(point.x, point.z, line);
      if (!projection || projection.distanceM > maxDistanceM) return;
      if (!best || projection.distanceM < best.distanceM - 1e-9
          || (Math.abs(projection.distanceM - best.distanceM) <= 1e-9 && String(wall.id) < best.wallId)) {
        best = { wallId: String(wall.id), distanceM: projection.distanceM };
      }
    });
    return best;
  }
  function reattachOpening(id, maxDistanceM = OPENING_REATTACH_TOLERANCE_M) {
    const element = elementFor(id);
    if (!element) return false;
    const candidate = nearestWallForOpening(id, maxDistanceM);
    if (!candidate) return false;
    const changedParent = String(element.parentId || "") !== candidate.wallId;
    element.parentId = candidate.wallId;
    const snapped = snapOpening(id);
    return changedParent || snapped;
  }
  function nearestWallEndpoint(x, z, excludeWallId, toleranceM = ENDPOINT_SNAP_TOLERANCE_M) {
    let best = null;
    (plan()?.elements || []).forEach((entry) => {
      if (String(entry.id) === String(excludeWallId)) return;
      const wallItem = itemFor(entry.id);
      if (!wallItem || !isWall(entry, wallItem)) return;
      const line = lineFor(entry, wallItem);
      if (!line) return;
      [["start", line.sx, line.sz], ["end", line.ex, line.ez]].forEach(([endpoint, px, pz]) => {
        const distanceM = Math.hypot(x - px, z - pz);
        if (distanceM > toleranceM) return;
        if (!best || distanceM < best.distanceM - 1e-9
            || (Math.abs(distanceM - best.distanceM) <= 1e-9 && `${entry.id}:${endpoint}` < `${best.wallId}:${best.endpoint}`)) {
          best = { wallId: String(entry.id), endpoint, x: px, z: pz, distanceM };
        }
      });
    });
    return best;
  }
  function wallInsideNormal(element, line) {
    const length = Math.max(1e-9, Number(line?.length || Math.hypot((line?.ex || 0) - (line?.sx || 0), (line?.ez || 0) - (line?.sz || 0))));
    const left = { x: -(line.ez - line.sz) / length, z: (line.ex - line.sx) / length };
    const room = (plan()?.roomZones || []).find((entry) => (entry.wallIds || []).map(String).includes(String(element?.id)));
    if (!room) return left;
    const center = { x: (line.sx + line.ex) / 2, z: (line.sz + line.ez) / 2 };
    const centroid = roomCentroid(room);
    const dot = (centroid.x - center.x) * left.x + (centroid.z - center.z) * left.z;
    return dot >= 0 ? left : { x: -left.x, z: -left.z };
  }
  function wallRenderOffset(element, line) {
    const alignment = String(element?.thicknessAlignment || "center");
    if (alignment === "center") return { x: 0, z: 0 };
    const normal = wallInsideNormal(element, line);
    const scalar = Number(line?.thickness || element?.depthM || 0.15) * 0.5 * (alignment === "outside" ? -1 : 1);
    return { x: normal.x * scalar, z: normal.z * scalar };
  }
  function wallRenderCenter(element, line) {
    const offset = wallRenderOffset(element, line);
    return { x: (line.sx + line.ex) / 2 + offset.x, z: (line.sz + line.ez) / 2 + offset.z };
  }
  function updateWallItemFromLine(item, element, oldLine, nextLine) {
    const renderCenter = wallRenderCenter(element, nextLine);
    setWorld(item, renderCenter.x, renderCenter.z);
    item.facing = ((nextLine.rotation % 360) + 360) % 360;
    const dims = dimensions(item) || { height: Number(element.heightM || 2.8) };
    item.referenceDimensionsM = {
      width: nextLine.length,
      height: Math.max(0.02, Number(dims.height || element.heightM || 2.8)),
      depth: nextLine.thickness,
    };
    if (item.physicalDimensionsM) item.physicalDimensionsM = { ...item.referenceDimensionsM };
    writeLine(element, nextLine);
    moveChildren(item.id, oldLine, nextLine);
  }
  function setWallEndpoint(itemId, endpoint, worldX, worldZ, options = {}) {
    const item = itemFor(itemId), element = elementFor(itemId);
    if (!item || !element || !isWall(element, item) || !["start", "end"].includes(endpoint)) return false;
    if (locked(item)) {
      if (options.notify !== false && typeof notifyEditLocked === "function") notifyEditLocked(item.name || "벽");
      return false;
    }
    const oldLine = lineFor(element, item);
    if (!oldLine) return false;
    let x = Number(worldX), z = Number(worldZ);
    if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
    runtime.lastEndpointSnap = null;
    if (options.snap !== false) {
      const target = nearestWallEndpoint(x, z, itemId, Number(options.toleranceM || ENDPOINT_SNAP_TOLERANCE_M));
      if (target) {
        x = target.x; z = target.z; runtime.lastEndpointSnap = target;
      }
    }
    const sx = endpoint === "start" ? x : oldLine.sx;
    const sz = endpoint === "start" ? z : oldLine.sz;
    const ex = endpoint === "end" ? x : oldLine.ex;
    const ez = endpoint === "end" ? z : oldLine.ez;
    const length = Math.hypot(ex - sx, ez - sz);
    if (length < 0.1) return false;
    if (typeof materializeEvaluatedViewForEditing === "function") materializeEvaluatedViewForEditing(item.id);
    const rotation = Math.atan2(ez - sz, ex - sx) * 180 / Math.PI;
    const nextLine = { sx, sz, ex, ez, length, thickness: oldLine.thickness, rotation };
    updateWallItemFromLine(item, element, oldLine, nextLine);
    refreshRoomZones();
    if (options.commit !== false) {
      const preserved = [item.id, ...children(item.id).map((entry) => entry.item.id)];
      if (typeof commit === "function") commit({ preserveSourceIds: preserved });
      if (typeof syncUi === "function") syncUi(false);
      if (typeof renderThreeView === "function") renderThreeView(typeof currentInteractionFrame === "function" ? currentInteractionFrame() : currentState(), true);
    }
    return true;
  }
  function snapOpening(id) {
    const item = itemFor(id), element = elementFor(id);
    if (!item || !element || !isOpening(element, item) || !element.parentId) return false;
    const parent = elementFor(element.parentId), parentItem = itemFor(element.parentId);
    if (!parent || !parentItem || !isWall(parent, parentItem)) return false;
    const line = lineFor(parent, parentItem), world = worldOf(item), dims = dimensions(item);
    const point = project(world.x, world.z, line, Number(element.widthM || dims?.width || 0) / 2);
    if (!point) return false;
    const offset = wallRenderOffset(parent, line);
    const renderX = point.x + offset.x, renderZ = point.z + offset.z;
    setWorld(item, renderX, renderZ);
    item.facing = ((line.rotation % 360) + 360) % 360;
    element.worldXM = renderX;
    element.worldZM = renderZ;
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
      const parentElement = elementFor(parentId);
      const offset = parentElement ? wallRenderOffset(parentElement, nextLine) : { x: 0, z: 0 };
      const renderX = x + offset.x, renderZ = z + offset.z;
      setWorld(item, renderX, renderZ);
      item.facing = ((nextLine.rotation % 360) + 360) % 360;
      element.worldXM = renderX;
      element.worldZM = renderZ;
      element.rotationDeg = nextLine.rotation;
      element.attachmentT = t;
    });
  }
  function reconcileWall(item, element) {
    const oldLine = lineFor(element, null) || lineFor(element, item);
    if (!oldLine) return false;
    const renderCenter = worldOf(item), dims = dimensions(item);
    const oldOffset = wallRenderOffset(element, oldLine);
    const center = { x: renderCenter.x - oldOffset.x, z: renderCenter.z - oldOffset.z };
    const length = Math.max(0.1, Number(element.widthM || dims?.width || oldLine.length));
    const thickness = Math.max(0.03, Number(element.depthM || dims?.depth || oldLine.thickness));
    const rotation = Number(item.facing ?? element.rotationDeg ?? oldLine.rotation);
    const angle = rotation * Math.PI / 180;
    const hx = Math.cos(angle) * length / 2, hz = Math.sin(angle) * length / 2;
    const nextLine = { sx: center.x - hx, sz: center.z - hz, ex: center.x + hx, ez: center.z + hz, length, thickness, rotation };
    const changed = Math.hypot(oldLine.sx - nextLine.sx, oldLine.sz - nextLine.sz) + Math.hypot(oldLine.ex - nextLine.ex, oldLine.ez - nextLine.ez) > 1e-7;
    if (!changed) return false;
    applyWallGeometryOnly(item, element, nextLine);
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
  function roomZoneKey(room) {
    return (room?.wallIds || []).map(String).sort().join("|");
  }
  function refreshRoomZones() {
    const current = plan();
    if (!current) return [];
    const previous = Array.isArray(current.roomZones) ? current.roomZones : [];
    if (!current.roomZoneMetadata || typeof current.roomZoneMetadata !== "object") current.roomZoneMetadata = {};
    const next = deriveRoomZones();
    next.forEach((room) => {
      const key = roomZoneKey(room);
      let metadata = current.roomZoneMetadata[key] || null;
      if (!metadata) {
        let best = null;
        previous.forEach((candidate) => {
          const candidateMeta = current.roomZoneMetadata[roomZoneKey(candidate)]
            || (candidate?.metadataBasis === "user_fixed" ? { name: candidate.name, use: candidate.use || "" } : null);
          if (!candidateMeta) return;
          const shared = (candidate.wallIds || []).filter((id) => (room.wallIds || []).map(String).includes(String(id))).length;
          if (!best || shared > best.shared) best = { candidate, metadata: candidateMeta, shared };
        });
        if (best && best.shared >= 2) {
          metadata = { name: String(best.metadata.name || room.name), use: String(best.metadata.use || "") };
          current.roomZoneMetadata[key] = metadata;
        }
      }
      if (metadata) {
        room.name = String(metadata.name || room.name);
        room.use = String(metadata.use || "");
        room.metadataBasis = "user_fixed";
      } else {
        room.use = "";
      }
    });
    current.roomZones = next;
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
  function setWallMetrics(itemId, lengthM, thicknessM, options = {}) {
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
    applyWallGeometryOnly(item, element, nextLine);
    moveChildren(item.id, oldLine, nextLine);
    refreshRoomZones();
    if (options.commit !== false) commitCad([item.id, ...children(item.id).map((entry) => entry.item.id)]);
    else { syncFields(); syncMeasurementOverlay(); }
    return true;
  }
  function ensureCadPlan() {
    const current = currentState();
    if (!current) return null;
    if (!current.setMasterPlan || !Array.isArray(current.setMasterPlan.elements)) {
      current.setMasterPlan = {
        schema: "frisframe-set-master-plan",
        version: 1,
        status: "ready",
        unit: "meter",
        workflowPolicy: "direct-architectural-cad-v1",
        sourceName: "2.5D CAD",
        generatedItemIds: [],
        elements: [],
        roomZones: [],
      };
    }
    if (!Array.isArray(current.setMasterPlan.generatedItemIds)) current.setMasterPlan.generatedItemIds = [];
    if (!Array.isArray(current.items)) current.items = [];
    if (!Array.isArray(current.setCollections)) current.setCollections = [];
    return current.setMasterPlan;
  }
  function nextCadId(prefix) {
    const used = new Set([
      ...(currentState()?.items || []).map((entry) => String(entry.id)),
      ...(plan()?.elements || []).map((entry) => String(entry.id)),
    ]);
    let index = 1;
    let id = `${prefix}-cad-${index}`;
    while (used.has(id)) id = `${prefix}-cad-${++index}`;
    return id;
  }
  function ensureArchitectureMember(id) {
    const current = currentState();
    if (!current) return;
    if (!Array.isArray(current.setCollections)) current.setCollections = [];
    let collection = current.setCollections.find((entry) => String(entry.id) === "architecture");
    if (!collection) {
      collection = {
        id: "architecture",
        name: "Architecture",
        parentId: "",
        memberIds: [],
        locked: false,
        allowPartialUnlock: true,
        unlockedMemberIds: [],
      };
      current.setCollections.push(collection);
    }
    if (!Array.isArray(collection.memberIds)) collection.memberIds = [];
    if (!Array.isArray(collection.unlockedMemberIds)) collection.unlockedMemberIds = [];
    if (!collection.memberIds.includes(id)) collection.memberIds.push(id);
    if (!collection.unlockedMemberIds.includes(id)) collection.unlockedMemberIds.push(id);
  }
  function registerCadEntity(item, element) {
    const currentPlan = ensureCadPlan();
    const current = currentState();
    if (!currentPlan || !current || !item?.id || !element?.id) return false;
    if (itemFor(item.id) || elementFor(element.id)) return false;
    current.items.push(item);
    currentPlan.elements.push(element);
    if (!currentPlan.generatedItemIds.includes(item.id)) currentPlan.generatedItemIds.push(item.id);
    ensureArchitectureMember(item.id);
    return true;
  }
  function removeCadEntity(id) {
    const current = currentState(), currentPlan = plan();
    if (!current || !currentPlan) return false;
    const beforeItems = current.items.length, beforeElements = currentPlan.elements.length;
    current.items = current.items.filter((entry) => String(entry.id) !== String(id));
    currentPlan.elements = currentPlan.elements.filter((entry) => String(entry.id) !== String(id));
    currentPlan.generatedItemIds = (currentPlan.generatedItemIds || []).filter((entry) => String(entry) !== String(id));
    (current.setCollections || []).forEach((collection) => {
      collection.memberIds = (collection.memberIds || []).filter((entry) => String(entry) !== String(id));
      collection.unlockedMemberIds = (collection.unlockedMemberIds || []).filter((entry) => String(entry) !== String(id));
    });
    return current.items.length !== beforeItems || currentPlan.elements.length !== beforeElements;
  }
  function commitCad(ids) {
    const preserved = [...new Set((ids || []).filter(Boolean).map(String))];
    if (typeof commit === "function") commit({ preserveSourceIds: preserved });
    if (typeof syncUi === "function") syncUi(false);
    if (typeof renderThreeView === "function") renderThreeView(typeof currentInteractionFrame === "function" ? currentInteractionFrame() : currentState(), true);
    syncEndpointHandles();
    syncFields();
    syncMeasurementOverlay();
  }
  function applyWallGeometryOnly(item, element, line) {
    const renderCenter = wallRenderCenter(element, line);
    setWorld(item, renderCenter.x, renderCenter.z);
    item.facing = ((line.rotation % 360) + 360) % 360;
    const dims = dimensions(item) || { height: Number(element.heightM || 2.8) };
    item.referenceDimensionsM = {
      width: line.length,
      height: Math.max(0.02, Number(dims.height || element.heightM || 2.8)),
      depth: line.thickness,
    };
    if (item.physicalDimensionsM) item.physicalDimensionsM = { ...item.referenceDimensionsM };
    element.basis = "user_fixed";
    element.confidence = 1;
    writeLine(element, line);
  }
  function createWall(startX, startZ, endX, endZ, options = {}) {
    ensureCadPlan();
    let sx = Number(startX), sz = Number(startZ), ex = Number(endX), ez = Number(endZ);
    if (![sx, sz, ex, ez].every(Number.isFinite)) return false;
    const tolerance = Number(options.toleranceM || ENDPOINT_SNAP_TOLERANCE_M);
    if (options.snap !== false) {
      const startSnap = nearestWallEndpoint(sx, sz, "", tolerance);
      if (startSnap) { sx = startSnap.x; sz = startSnap.z; }
      const endSnap = nearestWallEndpoint(ex, ez, "", tolerance);
      if (endSnap) { ex = endSnap.x; ez = endSnap.z; }
    }
    const length = Math.hypot(ex - sx, ez - sz);
    if (length < 0.1) return false;
    const id = String(options.id || nextCadId("wall"));
    const thickness = clamp(options.thicknessM ?? 0.15, 0.03, 2);
    const height = clamp(options.heightM ?? 2.8, 0.2, 20);
    const rotation = Math.atan2(ez - sz, ex - sx) * 180 / Math.PI;
    const item = {
      id,
      type: "prop",
      assetType: "wall",
      setKind: "wall",
      name: String(options.name || `벽 ${id.split("-").pop()}`),
      x: 0.5,
      y: 0.5,
      facing: ((rotation % 360) + 360) % 360,
      size: 1,
      scaleX: 1,
      scaleY: 1,
      scaleZ: 1,
      mountedHeight: 0,
      referenceDimensionsM: { width: length, height, depth: thickness },
      referenceAnchorId: id,
      motionEnabled: false,
    };
    setWorld(item, (sx + ex) / 2, (sz + ez) / 2);
    const element = {
      id,
      name: item.name,
      kind: "wall",
      role: "structure",
      basis: "user_fixed",
      confidence: 1,
      collectionId: "architecture",
      parentId: "",
      worldXM: (sx + ex) / 2,
      worldZM: (sz + ez) / 2,
      widthM: length,
      heightM: height,
      depthM: thickness,
      rotationDeg: rotation,
      mountedHeightM: 0,
      assetType: "wall",
      thicknessAlignment: ["center", "inside", "outside"].includes(String(options.thicknessAlignment || "center")) ? String(options.thicknessAlignment || "center") : "center",
      line: null,
      notes: "Direct 2.5D CAD wall.",
    };
    writeLine(element, { sx, sz, ex, ez, length, thickness, rotation });
    if (!registerCadEntity(item, element)) return false;
    applyWallGeometryOnly(item, element, lineFor(element, item));
    refreshRoomZones();
    syncMeasurementOverlay();
    if (options.commit !== false) commitCad([id]);
    return id;
  }
  function wallAtPoint(x, z, maxDistanceM = 0.65) {
    let best = null;
    (plan()?.elements || []).forEach((entry) => {
      const item = itemFor(entry.id);
      if (!item || !isWall(entry, item)) return;
      const line = lineFor(entry, item);
      const projection = line ? closestPointOnLine(Number(x), Number(z), line) : null;
      if (!projection || projection.distanceM > maxDistanceM) return;
      if (!best || projection.distanceM < best.distanceM - 1e-9
          || (Math.abs(projection.distanceM - best.distanceM) <= 1e-9 && String(entry.id) < best.wallId)) {
        best = { wallId: String(entry.id), distanceM: projection.distanceM, point: projection };
      }
    });
    return best;
  }
  function splitWall(itemId, worldX, worldZ, options = {}) {
    const item = itemFor(itemId), element = elementFor(itemId);
    if (!item || !element || !isWall(element, item) || locked(item)) return false;
    const oldLine = lineFor(element, item);
    const split = oldLine ? closestPointOnLine(Number(worldX), Number(worldZ), oldLine) : null;
    if (!split || split.distanceM > Number(options.maxDistanceM || 0.65)) return false;
    if (split.t <= 0.02 || split.t >= 0.98) return false;
    const firstLength = oldLine.length * split.t, secondLength = oldLine.length * (1 - split.t);
    if (firstLength < 0.15 || secondLength < 0.15) return false;
    const childSnapshots = children(itemId).map(({ item: childItem, element: childElement }) => {
      const world = worldOf(childItem);
      const projected = closestPointOnLine(world.x, world.z, oldLine);
      const half = Number(childElement.widthM || dimensions(childItem)?.width || 0) / 2;
      return { item: childItem, element: childElement, world, t: projected?.t ?? 0.5, half };
    });
    if (childSnapshots.some((child) => Math.abs(child.t - split.t) * oldLine.length <= child.half + 0.02)) return false;
    const lineA = {
      sx: oldLine.sx, sz: oldLine.sz, ex: split.x, ez: split.z,
      length: firstLength, thickness: oldLine.thickness,
      rotation: Math.atan2(split.z - oldLine.sz, split.x - oldLine.sx) * 180 / Math.PI,
    };
    const newId = createWall(split.x, split.z, oldLine.ex, oldLine.ez, {
      commit: false,
      snap: false,
      thicknessM: oldLine.thickness,
      heightM: Number(element.heightM || dimensions(item)?.height || 2.8),
      name: `${element.name || item.name || "벽"} B`,
    });
    if (!newId) return false;
    applyWallGeometryOnly(item, element, lineA);
    childSnapshots.forEach((child) => {
      child.element.parentId = child.t <= split.t ? String(itemId) : String(newId);
      setWorld(child.item, child.world.x, child.world.z);
      delete child.element.attachmentT;
      snapOpening(child.item.id);
    });
    refreshRoomZones();
    syncMeasurementOverlay();
    if (options.commit !== false) commitCad([itemId, newId, ...childSnapshots.map((entry) => entry.item.id)]);
    return { wallIds: [String(itemId), String(newId)], split: { xM: split.x, zM: split.z } };
  }
  function angleDelta180(left, right) {
    let delta = Math.abs(((Number(left) - Number(right)) % 180 + 180) % 180);
    if (delta > 90) delta = 180 - delta;
    return delta;
  }
  function mergeWalls(firstId, secondId, options = {}) {
    if (String(firstId) === String(secondId)) return false;
    const firstItem = itemFor(firstId), secondItem = itemFor(secondId);
    const first = elementFor(firstId), second = elementFor(secondId);
    if (!firstItem || !secondItem || !first || !second || !isWall(first, firstItem) || !isWall(second, secondItem)) return false;
    if (locked(firstItem) || locked(secondItem)) return false;
    const lineA = lineFor(first, firstItem), lineB = lineFor(second, secondItem);
    if (!lineA || !lineB || angleDelta180(lineA.rotation, lineB.rotation) > Number(options.angleToleranceDeg || 2)) return false;
    const aPoints = [{ endpoint: "start", x: lineA.sx, z: lineA.sz }, { endpoint: "end", x: lineA.ex, z: lineA.ez }];
    const bPoints = [{ endpoint: "start", x: lineB.sx, z: lineB.sz }, { endpoint: "end", x: lineB.ex, z: lineB.ez }];
    let shared = null;
    aPoints.forEach((a) => bPoints.forEach((b) => {
      const distanceM = Math.hypot(a.x - b.x, a.z - b.z);
      if (!shared || distanceM < shared.distanceM) shared = { a, b, distanceM };
    }));
    if (!shared || shared.distanceM > Number(options.toleranceM || ENDPOINT_SNAP_TOLERANCE_M)) return false;
    const farA = aPoints.find((entry) => entry.endpoint !== shared.a.endpoint);
    const farB = bPoints.find((entry) => entry.endpoint !== shared.b.endpoint);
    const length = Math.hypot(farB.x - farA.x, farB.z - farA.z);
    if (length < 0.1) return false;
    const expected = lineA.length + lineB.length;
    if (Math.abs(length - expected) > Math.max(0.4, shared.distanceM * 2 + 0.05)) return false;
    const childSnapshots = [...children(firstId), ...children(secondId)].map(({ item: childItem, element: childElement }) => ({
      item: childItem,
      element: childElement,
      world: worldOf(childItem),
    }));
    const mergedLine = {
      sx: farA.x, sz: farA.z, ex: farB.x, ez: farB.z,
      length,
      thickness: Math.max(lineA.thickness, lineB.thickness),
      rotation: Math.atan2(farB.z - farA.z, farB.x - farA.x) * 180 / Math.PI,
    };
    applyWallGeometryOnly(firstItem, first, mergedLine);
    childSnapshots.forEach((child) => { child.element.parentId = String(firstId); });
    removeCadEntity(secondId);
    childSnapshots.forEach((child) => {
      setWorld(child.item, child.world.x, child.world.z);
      delete child.element.attachmentT;
      snapOpening(child.item.id);
    });
    refreshRoomZones();
    syncMeasurementOverlay();
    if (options.commit !== false) commitCad([firstId, ...childSnapshots.map((entry) => entry.item.id)]);
    return String(firstId);
  }
  function insertOpening(kind, wallId, worldX, worldZ, options = {}) {
    const openingKind = String(kind || "").toLowerCase();
    if (!OPENING_KINDS.has(openingKind)) return false;
    const wallItem = itemFor(wallId), wall = elementFor(wallId);
    if (!wallItem || !wall || !isWall(wall, wallItem) || locked(wallItem)) return false;
    const line = lineFor(wall, wallItem);
    const defaults = openingKind === "door"
      ? { width: 0.9, height: 2.1, depth: 0.12, mountedHeight: 0 }
      : { width: 1.5, height: 1.2, depth: 0.12, mountedHeight: 0.9 };
    const width = clamp(options.widthM ?? defaults.width, 0.2, 6);
    const height = clamp(options.heightM ?? defaults.height, 0.2, 6);
    const depth = clamp(options.depthM ?? defaults.depth, 0.03, 1);
    const mountedHeight = clamp(options.mountedHeightM ?? defaults.mountedHeight, 0, 6);
    if (!line || line.length < width + 0.04) return false;
    const point = project(Number(worldX), Number(worldZ), line, width / 2);
    if (!point) return false;
    const offset = wallRenderOffset(wall, line);
    const renderX = point.x + offset.x, renderZ = point.z + offset.z;
    const id = String(options.id || nextCadId(openingKind));
    const item = {
      id,
      type: "prop",
      assetType: openingKind,
      setKind: openingKind,
      name: String(options.name || (openingKind === "door" ? "문" : "창")),
      x: 0.5,
      y: 0.5,
      facing: ((line.rotation % 360) + 360) % 360,
      size: 1,
      scaleX: 1,
      scaleY: 1,
      scaleZ: 1,
      mountedHeight,
      referenceDimensionsM: { width, height, depth },
      referenceAnchorId: id,
      motionEnabled: false,
      ...(openingKind === "door" ? { doorSwing: { hinge: "left", direction: "in", angleDeg: 90 } } : {}),
    };
    setWorld(item, renderX, renderZ);
    const element = {
      id,
      name: item.name,
      kind: openingKind,
      role: "opening",
      basis: "user_fixed",
      confidence: 1,
      collectionId: "architecture",
      parentId: String(wallId),
      worldXM: renderX,
      worldZM: renderZ,
      widthM: width,
      heightM: height,
      depthM: depth,
      rotationDeg: line.rotation,
      mountedHeightM: mountedHeight,
      attachmentT: point.t,
      assetType: openingKind,
      ...(openingKind === "door" ? { doorSwing: { hinge: "left", direction: "in", angleDeg: 90 } } : {}),
      line: null,
      notes: "Direct 2.5D CAD opening.",
    };
    if (!registerCadEntity(item, element)) return false;
    refreshRoomZones();
    if (options.commit !== false) commitCad([wallId, id]);
    return id;
  }
  function roomCentroid(room) {
    const points = Array.isArray(room?.points) ? room.points : [];
    if (!points.length) return { x: 0, z: 0 };
    const sum = points.reduce((acc, point) => ({ x: acc.x + Number(point.xM || 0), z: acc.z + Number(point.zM || 0) }), { x: 0, z: 0 });
    return { x: sum.x / points.length, z: sum.z / points.length };
  }
  function setRoomMetadata(roomId, values = {}, options = {}) {
    const current = plan(), room = (current?.roomZones || []).find((entry) => String(entry.id) === String(roomId));
    if (!current || !room) return false;
    if (!current.roomZoneMetadata || typeof current.roomZoneMetadata !== "object") current.roomZoneMetadata = {};
    const name = String(values.name ?? room.name ?? "Room").trim().slice(0, 80) || room.name || "Room";
    const use = String(values.use ?? room.use ?? "").trim().slice(0, 80);
    const metadata = { name, use };
    current.roomZoneMetadata[roomZoneKey(room)] = metadata;
    room.name = name;
    room.use = use;
    room.metadataBasis = "user_fixed";
    if (options.commit !== false) commitCad(room.wallIds || []);
    else syncMeasurementOverlay();
    return { ...metadata };
  }
  function setOpeningMetrics(itemId, values = {}, options = {}) {
    const item = itemFor(itemId), element = elementFor(itemId);
    if (!item || !element || !isOpening(element, item) || locked(item)) return false;
    const parent = elementFor(element.parentId), parentItem = itemFor(element.parentId);
    if (!parent || !parentItem || !isWall(parent, parentItem)) return false;
    const line = lineFor(parent, parentItem), dims = dimensions(item) || {};
    const width = clamp(values.widthM ?? element.widthM ?? dims.width ?? 0.9, 0.2, 6);
    if (!line || width > line.length - 0.04) return false;
    const height = clamp(values.heightM ?? element.heightM ?? dims.height ?? 2.1, 0.2, 6);
    const depth = clamp(values.depthM ?? element.depthM ?? dims.depth ?? 0.12, 0.03, 1);
    const parentHeight = Math.max(height, Number(parent.heightM || dimensions(parentItem)?.height || 2.8));
    const mountedHeight = clamp(values.mountedHeightM ?? element.mountedHeightM ?? item.mountedHeight ?? 0, 0, Math.max(0, parentHeight - height));
    item.referenceDimensionsM = { width, height, depth };
    if (item.physicalDimensionsM) item.physicalDimensionsM = { ...item.referenceDimensionsM };
    item.mountedHeight = mountedHeight;
    element.widthM = width;
    element.heightM = height;
    element.depthM = depth;
    element.mountedHeightM = mountedHeight;
    snapOpening(itemId);
    const result = { widthM: width, heightM: height, depthM: depth, mountedHeightM: mountedHeight };
    if (options.commit !== false) commitCad([element.parentId, itemId]);
    else { syncFields(); syncMeasurementOverlay(); }
    return result;
  }
  function setDoorSwing(itemId, hinge, direction, options = {}) {
    const item = itemFor(itemId), element = elementFor(itemId);
    if (!item || !element || kindOf(element, item) !== "door" || locked(item)) return false;
    const nextHinge = String(hinge || element.doorSwing?.hinge || "left");
    const nextDirection = String(direction || element.doorSwing?.direction || "in");
    if (!["left", "right"].includes(nextHinge) || !["in", "out"].includes(nextDirection)) return false;
    const angleDeg = clamp(options.angleDeg ?? element.doorSwing?.angleDeg ?? 90, 15, 180);
    const swing = { hinge: nextHinge, direction: nextDirection, angleDeg };
    item.doorSwing = { ...swing };
    element.doorSwing = { ...swing };
    if (options.commit !== false) commitCad([element.parentId, itemId]);
    else syncMeasurementOverlay();
    return swing;
  }
  function setWallThicknessAlignment(itemId, alignment, options = {}) {
    const item = itemFor(itemId), element = elementFor(itemId);
    const value = String(alignment || "center");
    if (!item || !element || !isWall(element, item) || locked(item) || !["center", "inside", "outside"].includes(value)) return false;
    const line = lineFor(element, item);
    element.thicknessAlignment = value;
    applyWallGeometryOnly(item, element, line);
    moveChildren(itemId, line, line);
    if (options.commit !== false) commitCad([itemId, ...children(itemId).map((entry) => entry.item.id)]);
    else { syncFields(); syncMeasurementOverlay(); }
    return value;
  }
  function setWallLengthFromMeasurement(itemId, lengthM, options = {}) {
    const item = itemFor(itemId), element = elementFor(itemId);
    if (!item || !element || !isWall(element, item)) return false;
    const line = lineFor(element, item);
    return setWallMetrics(itemId, lengthM, line.thickness, options);
  }
  function measurementSummary() {
    const walls = (plan()?.elements || []).filter((entry) => {
      const item = itemFor(entry.id);
      return item && isWall(entry, item);
    }).map((entry) => {
      const line = lineFor(entry, itemFor(entry.id));
      return {
        id: String(entry.id),
        lengthM: Number(line.length.toFixed(4)),
        thicknessM: Number(line.thickness.toFixed(4)),
        thicknessAlignment: String(entry.thicknessAlignment || "center"),
        midpoint: { xM: Number(((line.sx + line.ex) / 2).toFixed(4)), zM: Number(((line.sz + line.ez) / 2).toFixed(4)) },
      };
    });
    const rooms = (plan()?.roomZones || []).map((room) => {
      const points = Array.isArray(room.points) ? room.points : [];
      const sum = points.reduce((acc, point) => ({ x: acc.x + Number(point.xM || 0), z: acc.z + Number(point.zM || 0) }), { x: 0, z: 0 });
      return {
        id: String(room.id),
        name: String(room.name || ""),
        use: String(room.use || ""),
        areaM2: Number(room.areaM2 || 0),
        centroid: { xM: points.length ? sum.x / points.length : 0, zM: points.length ? sum.z / points.length : 0 },
      };
    });
    const openings = (plan()?.elements || []).filter((entry) => {
      const item = itemFor(entry.id);
      return item && isOpening(entry, item);
    }).map((entry) => {
      const item = itemFor(entry.id), dims = dimensions(item) || {};
      const world = worldOf(item);
      return {
        id: String(entry.id),
        kind: kindOf(entry, item),
        parentId: String(entry.parentId || ""),
        widthM: Number(entry.widthM || dims.width || 0),
        heightM: Number(entry.heightM || dims.height || 0),
        mountedHeightM: Number(entry.mountedHeightM ?? item.mountedHeight ?? 0),
        center: { xM: world.x, zM: world.z },
        doorSwing: entry.doorSwing ? { ...entry.doorSwing } : null,
      };
    });
    return { walls, rooms, openings };
  }
  function measurementLayer() { return document.getElementById("architecturalCadMeasurements"); }
  function syncMeasurementOverlay() {
    const layer = measurementLayer();
    if (!layer) return;
    const show = root.FrisFrameBirdseye25D?.mode === "2.5d" && runtime.measurementsVisible;
    layer.hidden = !show;
    layer.style.display = show ? "block" : "none";
    if (!show) return;
    layer.textContent = "";
    while (layer.firstChild) layer.removeChild(layer.firstChild);
    const summary = measurementSummary();
    const beginWallEdit = (label, wall) => {
      label.textContent = "";
      const input = document.createElement("input");
      input.type = "number"; input.min = "0.10"; input.max = "100"; input.step = "0.05"; input.value = wall.lengthM.toFixed(2);
      input.style.width = "58px";
      let cancelled = false;
      const finish = () => {
        if (cancelled) return syncMeasurementOverlay();
        const value = Number(input.value);
        if (Number.isFinite(value) && value >= 0.1) setWallLengthFromMeasurement(wall.id, value, { commit: true });
        else syncMeasurementOverlay();
      };
      input.addEventListener("keydown", (event) => {
        if (event.key === "Escape") { cancelled = true; syncMeasurementOverlay(); }
        if (event.key === "Enter") finish();
        event.stopPropagation?.();
      });
      input.addEventListener("blur", finish);
      label.appendChild(input);
      input.focus?.(); input.select?.();
    };
    const editRoom = (room) => {
      if (typeof root.prompt !== "function") return;
      const name = root.prompt("방 이름", room.name || "Room");
      if (name == null) return;
      const use = root.prompt("방 용도", room.use || "");
      if (use == null) return;
      setRoomMetadata(room.id, { name, use }, { commit: true });
    };
    const add = (text, x, z, kind, id, clickHandler = null) => {
      const screen = worldToCanvasPoint(x, z);
      if (!screen) return;
      const label = document.createElement("span");
      label.dataset.measurementKind = kind;
      label.dataset.measurementId = String(id || "");
      label.textContent = text;
      label.style.cssText = `position:absolute;transform:translate(-50%,-50%);padding:2px 5px;border-radius:4px;background:rgba(10,18,22,.78);color:#e8fbff;font:11px/1.2 sans-serif;white-space:nowrap;pointer-events:${clickHandler ? "auto" : "none"};cursor:${clickHandler ? "pointer" : "default"}`;
      label.style.left = `${screen.left}px`;
      label.style.top = `${screen.top}px`;
      if (clickHandler) label.addEventListener("click", (event) => { event.preventDefault?.(); event.stopPropagation?.(); clickHandler(label); });
      layer.appendChild(label);
    };
    summary.walls.forEach((wall) => add(`${wall.lengthM.toFixed(2)} m`, wall.midpoint.xM, wall.midpoint.zM, "wall-length", wall.id, (label) => beginWallEdit(label, wall)));
    summary.rooms.forEach((room) => add(`${room.name || "Room"} · ${room.areaM2.toFixed(1)} ㎡${room.use ? ` · ${room.use}` : ""}`, room.centroid.xM, room.centroid.zM, "room-area", room.id, () => editRoom(room)));
    summary.openings.forEach((opening) => {
      const swing = opening.kind === "door" && opening.doorSwing
        ? ` ${opening.doorSwing.hinge === "left" ? "↶" : "↷"} ${opening.doorSwing.direction.toUpperCase()}`
        : "";
      const text = opening.kind === "door"
        ? `문 ${opening.widthM.toFixed(2)}m${swing}`
        : `창 ${opening.widthM.toFixed(2)}×${opening.heightM.toFixed(2)}m`;
      add(text, opening.center.xM, opening.center.zM, "opening", opening.id);
    });
  }
  function setMeasurementsVisible(value) {
    runtime.measurementsVisible = Boolean(value);
    syncMeasurementOverlay();
    syncToolUi();
    return runtime.measurementsVisible;
  }
  function sketchLayer() { return document.getElementById("architecturalCadSketchLayer"); }
  function toolbox() { return document.getElementById("architecturalCadToolbox"); }
  function setTool(tool) {
    const value = String(tool || "select");
    if (!["select", "wall", "split", "merge", "door", "window"].includes(value)) return false;
    runtime.tool = value;
    runtime.toolAnchor = null;
    runtime.mergeFirstWallId = null;
    syncToolUi();
    syncEndpointHandles();
    return true;
  }
  function syncToolUi() {
    const bar = toolbox(), layer = sketchLayer();
    const active25d = root.FrisFrameBirdseye25D?.mode === "2.5d";
    if (bar) {
      bar.hidden = !active25d;
      bar.style.display = active25d ? "inline-flex" : "none";
      (bar.children || []).forEach?.((child) => {
        if (child?.dataset?.architecturalTool) child.dataset.active = child.dataset.architecturalTool === runtime.tool ? "true" : "false";
        if (child?.dataset?.measurementToggle) child.dataset.active = runtime.measurementsVisible ? "true" : "false";
      });
    }
    if (layer) {
      const activeTool = active25d && runtime.tool !== "select";
      layer.style.pointerEvents = activeTool ? "auto" : "none";
      layer.style.cursor = activeTool ? "crosshair" : "default";
    }
  }
  function snappedSketchPoint(point) {
    const target = nearestWallEndpoint(point.x, point.z, "", ENDPOINT_SNAP_TOLERANCE_M);
    return target ? { x: target.x, z: target.z } : point;
  }
  function notifyCad(message) {
    if (typeof notifyApp === "function") notifyApp(message);
  }
  function handleSketchPointer(event) {
    if (runtime.tool === "select") return;
    const point = pointerWorldPoint(event);
    if (!point) return;
    if (runtime.tool === "wall") {
      const target = snappedSketchPoint(point);
      if (!runtime.toolAnchor) {
        runtime.toolAnchor = target;
        notifyCad("벽 시작점을 지정했습니다. 끝점을 클릭하세요.");
      } else {
        const id = createWall(runtime.toolAnchor.x, runtime.toolAnchor.z, target.x, target.z, { commit: true, snap: true });
        if (id) {
          const line = lineFor(elementFor(id), itemFor(id));
          runtime.toolAnchor = { x: line.ex, z: line.ez };
          notifyCad("벽을 추가했습니다. 계속 클릭하면 연결해서 그립니다.");
        }
      }
    } else if (runtime.tool === "split") {
      const target = wallAtPoint(point.x, point.z, 0.55);
      if (target && splitWall(target.wallId, target.point.x, target.point.z, { commit: true })) notifyCad("벽을 분할했습니다.");
    } else if (runtime.tool === "merge") {
      const target = wallAtPoint(point.x, point.z, 0.55);
      if (target) {
        if (!runtime.mergeFirstWallId) {
          runtime.mergeFirstWallId = target.wallId;
          notifyCad("합칠 첫 번째 벽을 선택했습니다.");
        } else if (target.wallId !== runtime.mergeFirstWallId) {
          if (mergeWalls(runtime.mergeFirstWallId, target.wallId, { commit: true })) notifyCad("두 벽을 합쳤습니다.");
          else notifyCad("일직선으로 이어진 벽만 합칠 수 있습니다.");
          runtime.mergeFirstWallId = null;
        }
      }
    } else if (runtime.tool === "door" || runtime.tool === "window") {
      const target = wallAtPoint(point.x, point.z, OPENING_REATTACH_TOLERANCE_M);
      if (target && insertOpening(runtime.tool, target.wallId, target.point.x, target.point.z, { commit: true })) {
        notifyCad(runtime.tool === "door" ? "문을 벽에 삽입했습니다." : "창을 벽에 삽입했습니다.");
      }
    }
    syncMeasurementOverlay();
    event.preventDefault?.();
    event.stopPropagation?.();
  }
  function installCadToolbox() {
    const controls = document.getElementById("birdseyeCadControls"), wrap = document.getElementById("threeWrap");
    if (!controls || !wrap) return true;
    if (!toolbox()) {
      const bar = document.createElement("span");
      bar.id = "architecturalCadToolbox";
      bar.style.cssText = "display:inline-flex;align-items:center;gap:4px;white-space:nowrap";
      [["select", "선택"], ["wall", "벽"], ["split", "분할"], ["merge", "합치기"], ["door", "문"], ["window", "창"]].forEach(([tool, label]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.architecturalTool = tool;
        button.textContent = label;
        button.title = `2.5D CAD · ${label}`;
        button.addEventListener("click", () => setTool(tool));
        bar.appendChild(button);
      });
      const measures = document.createElement("button");
      measures.type = "button";
      measures.dataset.measurementToggle = "true";
      measures.textContent = "치수";
      measures.title = "벽 길이와 방 면적 표시";
      measures.addEventListener("click", () => setMeasurementsVisible(!runtime.measurementsVisible));
      bar.appendChild(measures);
      const readout = document.getElementById("birdseyeCadReadout");
      controls.insertBefore(bar, readout || null);
    }
    if (!sketchLayer()) {
      const layer = document.createElement("div");
      layer.id = "architecturalCadSketchLayer";
      layer.style.cssText = "position:absolute;inset:0;z-index:54;pointer-events:none";
      layer.addEventListener("pointerdown", handleSketchPointer);
      wrap.appendChild(layer);
    }
    if (!measurementLayer()) {
      const layer = document.createElement("div");
      layer.id = "architecturalCadMeasurements";
      layer.style.cssText = "position:absolute;inset:0;z-index:53;pointer-events:none";
      wrap.appendChild(layer);
    }
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && runtime.tool !== "select") {
        runtime.toolAnchor = null;
        runtime.mergeFirstWallId = null;
        setTool("select");
      }
    });
    syncToolUi();
    return true;
  }
  function endpointLayer() { return document.getElementById("architecturalEndpointHandles"); }
  function worldToCanvasPoint(x, z) {
    if (typeof threeView === "undefined" || !threeView?.camera || !root.THREE) return null;
    const canvas = document.getElementById("threeCanvas") || threeView.canvas;
    const wrap = document.getElementById("threeWrap") || threeView.wrap;
    if (!canvas || !wrap || typeof wrap.getBoundingClientRect !== "function") return null;
    const rect = wrap.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const point = new root.THREE.Vector3(Number(x), 0.08, Number(z)).project(threeView.camera);
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || point.z < -1.2 || point.z > 1.2) return null;
    return { left: (point.x + 1) * 0.5 * rect.width, top: (1 - point.y) * 0.5 * rect.height };
  }
  function syncEndpointHandles() {
    const layer = endpointLayer();
    if (!layer) return;
    const item = selectedItem(), element = item ? elementFor(item.id) : null;
    const show = root.FrisFrameBirdseye25D?.mode === "2.5d" && runtime.tool === "select" && item && element && isWall(element, item);
    layer.hidden = !show;
    layer.style.display = show ? "block" : "none";
    if (!show) return;
    const line = lineFor(element, item);
    [["start", line.sx, line.sz], ["end", line.ex, line.ez]].forEach(([endpoint, x, z]) => {
      const button = layer.querySelector?.(`button[data-wall-endpoint="${endpoint}"]`);
      const screen = worldToCanvasPoint(x, z);
      if (!button || !screen) {
        if (button) button.hidden = true;
        return;
      }
      button.hidden = false;
      button.style.left = `${screen.left}px`;
      button.style.top = `${screen.top}px`;
      const snap = runtime.lastEndpointSnap;
      const activeSnap = runtime.endpointDrag?.endpoint === endpoint && snap;
      button.dataset.snapTarget = activeSnap ? `${snap.wallId}:${snap.endpoint}` : "";
      button.title = activeSnap ? `코너 스냅 · ${snap.wallId}` : `${endpoint === "start" ? "시작" : "끝"}점 드래그`;
    });
  }
  function pointerWorldPoint(event) {
    if (typeof threeView === "undefined" || !threeView?.camera || !root.THREE) return null;
    const canvas = document.getElementById("threeCanvas") || threeView.canvas;
    if (!canvas || typeof canvas.getBoundingClientRect !== "function") return null;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const mouse = new root.THREE.Vector2(
      ((Number(event.clientX) - rect.left) / rect.width) * 2 - 1,
      -(((Number(event.clientY) - rect.top) / rect.height) * 2 - 1),
    );
    const raycaster = new root.THREE.Raycaster();
    raycaster.setFromCamera(mouse, threeView.camera);
    const target = new root.THREE.Vector3();
    const plane = new root.THREE.Plane(new root.THREE.Vector3(0, 1, 0), 0);
    return raycaster.ray.intersectPlane(plane, target) ? { x: target.x, z: target.z } : null;
  }
  function beginEndpointDrag(event) {
    const button = event.currentTarget || event.target;
    const endpoint = button?.dataset?.wallEndpoint;
    const item = selectedItem(), element = item ? elementFor(item.id) : null;
    if (!item || !element || !isWall(element, item) || !["start", "end"].includes(endpoint) || locked(item)) return;
    if (typeof materializeEvaluatedViewForEditing === "function") materializeEvaluatedViewForEditing(item.id);
    runtime.endpointDrag = { pointerId: event.pointerId, itemId: item.id, endpoint, changed: false };
    runtime.lastEndpointSnap = null;
    button.setPointerCapture?.(event.pointerId);
    event.preventDefault?.(); event.stopPropagation?.();
  }
  function moveEndpointDrag(event) {
    const drag = runtime.endpointDrag;
    if (!drag || (drag.pointerId != null && event.pointerId != null && drag.pointerId !== event.pointerId)) return;
    const point = pointerWorldPoint(event);
    if (!point) return;
    drag.changed = setWallEndpoint(drag.itemId, drag.endpoint, point.x, point.z, { snap: true, commit: false, notify: false }) || drag.changed;
    if (drag.changed && typeof renderThreeView === "function") {
      renderThreeView(typeof currentInteractionFrame === "function" ? currentInteractionFrame() : currentState(), true);
    }
    syncEndpointHandles(); syncFields();
    event.preventDefault?.(); event.stopPropagation?.();
  }
  function finishEndpointDrag(event) {
    const drag = runtime.endpointDrag;
    if (!drag || (drag.pointerId != null && event.pointerId != null && drag.pointerId !== event.pointerId)) return;
    runtime.endpointDrag = null;
    if (drag.changed) {
      const preserved = [drag.itemId, ...children(drag.itemId).map((entry) => entry.item.id)];
      if (typeof commit === "function") commit({ preserveSourceIds: preserved });
      if (typeof syncUi === "function") syncUi(false);
      if (typeof renderThreeView === "function") renderThreeView(typeof currentInteractionFrame === "function" ? currentInteractionFrame() : currentState(), true);
    }
    runtime.lastEndpointSnap = null;
    syncEndpointHandles(); syncFields();
    event.preventDefault?.(); event.stopPropagation?.();
  }
  function installEndpointHandles() {
    const wrap = document.getElementById("threeWrap");
    if (!wrap || endpointLayer()) return true;
    const layer = document.createElement("div");
    layer.id = "architecturalEndpointHandles";
    layer.hidden = true;
    layer.style.cssText = "position:absolute;inset:0;z-index:55;pointer-events:none";
    ["start", "end"].forEach((endpoint) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.wallEndpoint = endpoint;
      button.setAttribute?.("aria-label", endpoint === "start" ? "벽 시작점" : "벽 끝점");
      button.style.cssText = "position:absolute;width:18px;height:18px;padding:0;border:2px solid #dff7ff;border-radius:50%;background:#267fa5;box-shadow:0 0 0 3px rgba(20,42,52,.62);transform:translate(-50%,-50%);cursor:grab;pointer-events:auto";
      button.addEventListener("pointerdown", beginEndpointDrag);
      layer.appendChild(button);
    });
    wrap.appendChild(layer);
    document.addEventListener("pointermove", moveEndpointDrag, true);
    document.addEventListener("pointerup", finishEndpointDrag, true);
    document.addEventListener("pointercancel", finishEndpointDrag, true);
    return true;
  }
  function installFields() {
    const controls = document.getElementById("birdseyeCadControls");
    if (!controls || document.getElementById("architecturalCadFields")) return Boolean(controls);
    const fields = document.createElement("span");
    fields.id = "architecturalCadFields";
    fields.hidden = true;
    fields.style.cssText = "display:inline-flex;align-items:center;gap:5px;white-space:nowrap";
    const lengthInput = document.createElement("input"), thicknessInput = document.createElement("input"), alignmentInput = document.createElement("select"), badge = document.createElement("span");
    lengthInput.id = "wallLengthM"; thicknessInput.id = "wallThicknessM"; alignmentInput.id = "wallThicknessAlignment"; badge.id = "architecturalRoomBadge";
    [[lengthInput, "벽 길이", "0.10", "100", "0.05"], [thicknessInput, "두께", "0.03", "2", "0.01"]].forEach(([input, label, min, max, step]) => {
      const wrap = document.createElement("label");
      wrap.textContent = label; input.type = "number"; input.min = min; input.max = max; input.step = step; input.style.width = "64px"; wrap.appendChild(input); fields.appendChild(wrap);
    });
    [["center", "중심"], ["inside", "안쪽"], ["outside", "바깥쪽"]].forEach(([value, text]) => {
      const option = document.createElement("option"); option.value = value; option.textContent = text; alignmentInput.appendChild(option);
    });
    const alignmentWrap = document.createElement("label"); alignmentWrap.textContent = "두께 기준"; alignmentWrap.appendChild(alignmentInput); fields.appendChild(alignmentWrap);
    fields.appendChild(badge);

    const openingFields = document.createElement("span");
    openingFields.id = "architecturalOpeningFields";
    openingFields.hidden = true;
    openingFields.style.cssText = "display:inline-flex;align-items:center;gap:5px;white-space:nowrap";
    const openingWidth = document.createElement("input"), openingHeight = document.createElement("input"), openingMounted = document.createElement("input"), hinge = document.createElement("select"), direction = document.createElement("select");
    openingWidth.id = "openingWidthM"; openingHeight.id = "openingHeightM"; openingMounted.id = "openingMountedHeightM"; hinge.id = "doorSwingHinge"; direction.id = "doorSwingDirection";
    [[openingWidth, "폭", "0.20", "6", "0.05"], [openingHeight, "높이", "0.20", "6", "0.05"], [openingMounted, "설치높이", "0", "6", "0.05"]].forEach(([input, label, min, max, step]) => {
      const wrap = document.createElement("label"); wrap.textContent = label; input.type = "number"; input.min = min; input.max = max; input.step = step; input.style.width = "58px"; wrap.appendChild(input); openingFields.appendChild(wrap);
    });
    [["left", "좌힌지"], ["right", "우힌지"]].forEach(([value, text]) => { const option = document.createElement("option"); option.value = value; option.textContent = text; hinge.appendChild(option); });
    [["in", "안으로"], ["out", "밖으로"]].forEach(([value, text]) => { const option = document.createElement("option"); option.value = value; option.textContent = text; direction.appendChild(option); });
    const hingeWrap = document.createElement("label"); hingeWrap.id = "doorSwingHingeWrap"; hingeWrap.textContent = "힌지"; hingeWrap.appendChild(hinge); openingFields.appendChild(hingeWrap);
    const directionWrap = document.createElement("label"); directionWrap.id = "doorSwingDirectionWrap"; directionWrap.textContent = "열림"; directionWrap.appendChild(direction); openingFields.appendChild(directionWrap);

    const readout = document.getElementById("birdseyeCadReadout");
    controls.insertBefore(fields, readout || null);
    controls.insertBefore(openingFields, readout || null);
    const applyWall = () => { const item = selectedItem(); if (item) setWallMetrics(item.id, Number(lengthInput.value), Number(thicknessInput.value)); };
    const applyOpening = () => { const item = selectedItem(); if (item) setOpeningMetrics(item.id, { widthM: Number(openingWidth.value), heightM: Number(openingHeight.value), mountedHeightM: Number(openingMounted.value) }); };
    lengthInput.addEventListener("change", applyWall); thicknessInput.addEventListener("change", applyWall);
    alignmentInput.addEventListener("change", () => { const item = selectedItem(); if (item) setWallThicknessAlignment(item.id, alignmentInput.value); });
    openingWidth.addEventListener("change", applyOpening); openingHeight.addEventListener("change", applyOpening); openingMounted.addEventListener("change", applyOpening);
    const applySwing = () => { const item = selectedItem(); if (item) setDoorSwing(item.id, hinge.value, direction.value); };
    hinge.addEventListener("change", applySwing); direction.addEventListener("change", applySwing);
    return true;
  }
  function syncFields() {
    const fields = document.getElementById("architecturalCadFields"), openingFields = document.getElementById("architecturalOpeningFields");
    if (!fields) return;
    const item = selectedItem(), element = item ? elementFor(item.id) : null;
    const active25d = root.FrisFrameBirdseye25D?.mode === "2.5d";
    const showWall = active25d && item && element && isWall(element, item);
    const showOpening = active25d && item && element && isOpening(element, item);
    fields.hidden = !showWall; fields.style.display = showWall ? "inline-flex" : "none";
    if (openingFields) { openingFields.hidden = !showOpening; openingFields.style.display = showOpening ? "inline-flex" : "none"; }
    if (showWall) {
      const line = lineFor(element, item), lengthInput = document.getElementById("wallLengthM"), thicknessInput = document.getElementById("wallThicknessM"), alignmentInput = document.getElementById("wallThicknessAlignment");
      if (document.activeElement !== lengthInput) lengthInput.value = line.length.toFixed(2);
      if (document.activeElement !== thicknessInput) thicknessInput.value = line.thickness.toFixed(2);
      if (alignmentInput) alignmentInput.value = String(element.thicknessAlignment || "center");
      const badge = document.getElementById("architecturalRoomBadge");
      if (badge) badge.textContent = `방 ${plan()?.roomZones?.length || 0}`;
    }
    if (showOpening && openingFields) {
      const dims = dimensions(item) || {};
      const widthInput = document.getElementById("openingWidthM"), heightInput = document.getElementById("openingHeightM"), mountedInput = document.getElementById("openingMountedHeightM");
      if (document.activeElement !== widthInput) widthInput.value = Number(element.widthM || dims.width || 0).toFixed(2);
      if (document.activeElement !== heightInput) heightInput.value = Number(element.heightM || dims.height || 0).toFixed(2);
      if (document.activeElement !== mountedInput) mountedInput.value = Number(element.mountedHeightM ?? item.mountedHeight ?? 0).toFixed(2);
      const isDoor = kindOf(element, item) === "door", hingeWrap = document.getElementById("doorSwingHingeWrap"), directionWrap = document.getElementById("doorSwingDirectionWrap");
      if (hingeWrap) hingeWrap.style.display = isDoor ? "inline" : "none";
      if (directionWrap) directionWrap.style.display = isDoor ? "inline" : "none";
      if (isDoor) {
        const swing = element.doorSwing || { hinge: "left", direction: "in" };
        const hinge = document.getElementById("doorSwingHinge"), direction = document.getElementById("doorSwingDirection");
        if (hinge) hinge.value = swing.hinge;
        if (direction) direction.value = swing.direction;
      }
    }
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
          if (item && element && isOpening(element, item)) reattachOpening(id, OPENING_REATTACH_TOLERANCE_M);
          if (item && element && isWall(element, item)) reconcileWall(item, element);
          refreshRoomZones();
        }
        syncFields(); syncEndpointHandles();
        return result;
      };
    }
    if (typeof syncUi === "function") {
      const originalSync = syncUi;
      syncUi = function architecturalSync(...args) { const result = originalSync(...args); reconcile(); syncFields(); syncEndpointHandles(); return result; };
    }
    if (typeof renderThreeView === "function") {
      const originalRender = renderThreeView;
      renderThreeView = function architecturalRender(...args) {
        const result = originalRender(...args);
        requestAnimationFrame?.(() => { syncEndpointHandles(); syncMeasurementOverlay(); syncToolUi(); });
        return result;
      };
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
    if (!installEndpointHandles()) { if (runtime.attempts < 80) setTimeout(install, 50); return; }
    if (!installCadToolbox()) { if (runtime.attempts < 80) setTimeout(install, 50); return; }
    installHooks(); refreshRoomZones(); syncFields(); syncEndpointHandles(); syncMeasurementOverlay(); syncToolUi();
    document.addEventListener("click", (event) => { if (event.target?.closest?.("#viewButtons,#threeCanvas,#birdseyeCadControls")) requestAnimationFrame(syncFields); });
    runtime.installed = true;
    root.FrisFrameArchitecturalCad = {
      get roomZones() { return plan()?.roomZones || []; },
      deriveRoomZones,
      refreshRoomZones,
      reconcile,
      snapOpeningToParent: snapOpening,
      reattachOpeningToNearestWall: reattachOpening,
      createWall,
      splitWall,
      mergeWalls,
      insertOpening,
      setRoomMetadata,
      setOpeningMetrics,
      setDoorSwing,
      setWallThicknessAlignment,
      setWallLengthFromMeasurement,
      getMeasurementSummary: measurementSummary,
      setMeasurementsVisible,
      setTool,
      get activeTool() { return runtime.tool; },
      setWallEndpoint,
      get lastEndpointSnap() { return runtime.lastEndpointSnap; },
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
