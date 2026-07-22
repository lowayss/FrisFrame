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
