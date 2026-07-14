const canvas = document.querySelector("#stageCanvas");
let ctx = canvas.getContext("2d");
const stageViewport = document.querySelector("#stageViewport");
const stageCanvasHolder = document.querySelector("#stageCanvasHolder");
const stageZoomControls = document.querySelector("#stageZoomControls");

const colors = [
  "#ff6262",
  "#ffac48",
  "#ffd95a",
  "#ff6b55",
  "#65d66f",
  "#36d6b0",
  "#55c7bb",
  "#5a8dff",
  "#7a63ff",
  "#bf68ff",
  "#ff6fc8",
  "#ff74a1",
];

const shapes = [
  ["circle", "●"],
  ["triangle", "▲"],
  ["square", "■"],
  ["diamond", "◆"],
  ["pentagon", "⬟"],
  ["hex", "⬢"],
  ["pill", "●"],
  ["star", "★"],
];

const propCatalog = {
  generic: { label: "기본 소품", category: "기본", kind: "generic", height: 0.55, footprint: 0.7 },
  car: {
    label: "자동차", category: "탈것", kind: "vehicle", height: 1.45, footprint: 2.15,
    seats: [
      { label: "운전석", x: 0.62, y: 0.62, z: -0.42 },
      { label: "조수석", x: 0.62, y: 0.62, z: 0.42 },
      { label: "뒷좌석 왼쪽", x: -0.55, y: 0.62, z: -0.42 },
      { label: "뒷좌석 오른쪽", x: -0.55, y: 0.62, z: 0.42 },
    ],
  },
  bus: {
    label: "버스", category: "탈것", kind: "vehicle", height: 2.75, footprint: 3.25,
    seats: [
      { label: "운전석", x: 2.35, y: 0.72, z: -0.58 },
      { label: "앞좌석", x: 1.35, y: 0.72, z: 0.58 },
      { label: "중간 좌석", x: 0, y: 0.72, z: -0.58 },
      { label: "뒷좌석", x: -2.05, y: 0.72, z: 0.58 },
    ],
  },
  motorcycle: {
    label: "오토바이", category: "탈것", kind: "vehicle", height: 1.2, footprint: 1.25,
    seats: [{ label: "운전석", x: -0.05, y: 0.78, z: 0 }],
  },
  bicycle: {
    label: "자전거", category: "탈것", kind: "vehicle", height: 1.15, footprint: 1.2,
    seats: [{ label: "안장", x: -0.12, y: 0.86, z: 0 }],
  },
  tree: { label: "나무", category: "자연", kind: "nature", height: 3.4, footprint: 1.25 },
  forest: { label: "나무 묶음", category: "자연", kind: "nature", height: 3.8, footprint: 2.8 },
  room: { label: "실내 공간", category: "공간", kind: "architecture", height: 2.8, footprint: 3.8 },
  sofa: { label: "소파", category: "가구", kind: "furniture", height: 0.9, footprint: 1.45 },
  "dining-table": { label: "테이블", category: "가구", kind: "furniture", height: 0.82, footprint: 1.2 },
  chair: { label: "의자", category: "가구", kind: "furniture", height: 1.0, footprint: 0.65 },
  bed: { label: "침대", category: "가구", kind: "furniture", height: 0.75, footprint: 1.5 },
  cabinet: { label: "수납장", category: "가구", kind: "furniture", height: 1.45, footprint: 0.9 },
  refrigerator: { label: "냉장고", category: "가전", kind: "appliance", height: 1.9, footprint: 0.72 },
  television: { label: "TV", category: "가전", kind: "appliance", height: 1.25, footprint: 0.78 },
  stove: { label: "레인지", category: "가전", kind: "appliance", height: 0.92, footprint: 0.72 },
  "washing-machine": { label: "세탁기", category: "가전", kind: "appliance", height: 0.92, footprint: 0.72 },
};

const propCatalogGroups = ["탈것", "자연", "공간", "가구", "가전", "기본"];

const environmentPresets = {
  living: {
    label: "거실",
    items: [
      ["room", "거실", 0.51, 0.51, 0, 1],
      ["sofa", "소파", 0.39, 0.53, 0, 1],
      ["television", "TV", 0.64, 0.48, 180, 1],
      ["dining-table", "거실 테이블", 0.5, 0.62, 0, 0.72],
    ],
  },
  kitchen: {
    label: "주방",
    items: [
      ["room", "주방", 0.51, 0.51, 0, 1],
      ["refrigerator", "냉장고", 0.35, 0.37, 90, 1],
      ["stove", "레인지", 0.47, 0.37, 90, 1],
      ["dining-table", "식탁", 0.54, 0.58, 0, 1],
      ["chair", "의자", 0.54, 0.7, 270, 1],
    ],
  },
  bedroom: {
    label: "침실",
    items: [
      ["room", "침실", 0.51, 0.51, 0, 1],
      ["bed", "침대", 0.46, 0.5, 0, 1],
      ["cabinet", "수납장", 0.69, 0.39, 180, 1],
      ["television", "TV", 0.66, 0.58, 180, 0.72],
    ],
  },
  forest: {
    label: "숲",
    items: [
      ["forest", "숲 왼쪽", 0.34, 0.48, 0, 1],
      ["forest", "숲 오른쪽", 0.68, 0.5, 35, 1],
      ["tree", "전경 나무", 0.5, 0.68, 0, 1.15],
    ],
  },
  car: {
    label: "차 안",
    items: [["car", "자동차", 0.52, 0.52, 0, 1]],
  },
};

const aspectMap = {
  "16:9": 16 / 9,
  "9:16": 9 / 16,
  "4:3": 4 / 3,
  "1:1": 1,
  "3:4": 3 / 4,
};

const MAX_TIMELINE_DURATION = 60;
const MAX_FOCUS_HEIGHT = 4;
const CINEMATIC_FACE_SCREEN_Y = 0.3;
const motionCore = window.FrisFrameMotionCore;
if (!motionCore) throw new Error("동선 계산 엔진을 불러오지 못했습니다.");
const projectRecoveryCore = window.FrisFrameProjectRecoveryCore;
if (!projectRecoveryCore) throw new Error("프로젝트 복구 엔진을 불러오지 못했습니다.");
const storyboardCore = window.StoryboardCore;
if (!storyboardCore) throw new Error("스토리보드 구성 엔진을 불러오지 못했습니다.");
const poseCore = window.FrisFramePoseCore;
if (!poseCore) throw new Error("배우 포즈 엔진을 불러오지 못했습니다.");
const PROJECT_SCHEMA_VERSION = 6;
const SERVICE_NAME = "FrisFrame";
const LAST_MANAGED_PROJECT_KEY = "frisframe:last-managed-project";
const PROJECT_RECOVERY_KEY_PREFIX = "frisframe:project-recovery:v1:";
const {
  activeMotionSegment,
  circularArcPoint,
  constrainPathEndpoint,
  finiteNumber,
  motionSegments,
  normalizePathMode,
  normalizeTransition,
  poseFieldsChanged,
  samplePlanarPath,
  transitionProgress,
} = motionCore;
const {
  classifyRecovery,
  createRecoveryRecord,
  parseRecoveryRecord,
} = projectRecoveryCore;
const {
  JOINT_DEFINITIONS,
  PRESET_CATEGORIES,
  PRESET_LABELS: POSE_PRESET_LABELS,
  defaultBodyPose,
  interpolateBodyPose,
  mirrorBodyPose,
  presetBodyPose,
  sanitizeBodyPose,
} = poseCore;

const keyTransitionLabels = {
  smooth: "부드럽게",
  linear: "일정 속도",
  hold: "직전 유지",
  cut: "즉시 전환",
};

const pathModeLabels = {
  straight: "정확한 직선",
  horizontal: "수평 직선",
  vertical: "수직 직선",
  "arc-left": "원호 왼쪽",
  "arc-right": "원호 오른쪽",
  "free-curve": "자유 곡선",
  drone: "드론 비행",
  "jib-up": "지미집 상승",
  "jib-down": "지미집 하강",
};

const actorPathModes = ["straight", "horizontal", "vertical", "arc-left", "arc-right", "free-curve"];
const cameraPathModes = [...actorPathModes, "drone", "jib-up", "jib-down"];
const CAMERA_GUIDE_FIELDS = ["x", "y", "height", "panDeg", "tiltDeg", "focal", "trackingTargetId"];
const ITEM_GUIDE_FIELDS = ["x", "y", "facing", "size", "scaleX", "scaleY", "scaleZ", "visible"];

const previsModes = {
  "camera-only": {
    label: "카메라만",
    summary: "렌즈, 카메라 위치, 팬·틸트, 샷 타이밍만 보존하고 세계관은 새로 구성합니다.",
  },
  "actor-blocking": {
    label: "배우 동선",
    summary: "배우 위치, 시선 방향, 타이밍, 카메라와의 관계를 보존합니다.",
  },
  "focus-framing": {
    label: "카메라 방향 / 구도",
    summary: "팬·틸트, 화각, 화면 구도를 핵심 제어값으로 보존합니다.",
  },
  "full-scene": {
    label: "전체 장면",
    summary: "카메라, 배우, 소품, 타이밍, 카메라 방향, 공간 배치를 함께 보존합니다.",
  },
};

const previsTargets = {
  hybrid: "AI + 실사",
  "ai-video": "AI 영상",
  "live-action": "실사 촬영",
  blender: "Blender 프리비즈",
};

const controlLayers = {
  camera: "카메라",
  pose: "포즈",
  depth: "깊이",
  "ai-depth": "AI 깊이",
  edges: "윤곽",
  lineart: "라인",
  masks: "마스크",
  normals: "노멀",
  motion: "모션",
};

const exportPresets = {
  seedance: "Seedance",
  comfyui: "ComfyUI",
  blender: "Blender",
  runway: "Runway",
  kling: "Kling",
};

const defaultState = () => {
  const actorId = uid();
  return ({
  version: 4,
  sceneTitle: "새 블로킹",
  sceneIntent:
    "이 프리비즈는 카메라, 배우, 소품의 관계와 움직임을 설계합니다. 최종 결과는 다이어그램이 아니라 영화적인 실사 장면이어야 합니다.",
  previs: {
    mode: "full-scene",
    target: "hybrid",
    selectedLayers: ["camera", "pose", "depth", "ai-depth", "edges", "masks"],
    exportPresets: ["seedance", "blender"],
  },
  aspect: "16:9",
  spacePresetId: "",
  showGrid: true,
  showNames: false,
  showCamera: true,
  cleanExport: true,
  blenderControls: true,
  camera: {
    x: 0.92,
    y: 0.48,
    aimX: 0.5,
    aimY: 0.48,
    height: 1.6,
    focusHeight: 1.1,
    panDeg: 180,
    tiltDeg: -6,
    focal: 85,
    trackingTargetId: "",
    locks: {
      position: false,
      orientation: false,
      lens: false,
      height: false,
    },
  },
  items: [
    {
      id: actorId,
      continuityId: uid(),
      type: "actor",
      name: "수아",
      x: 0.32,
      y: 0.46,
      size: 1,
      color: "#ff6262",
      shape: "circle",
      facing: 0,
      bodyPose: defaultBodyPose(),
      placementMode: "manual",
      mountId: "",
      seatIndex: 0,
      editLocked: false,
    },
  ],
  groups: [],
  motion: {
    duration: 15,
    fps: 24,
    playhead: 0,
    activeSource: actorId,
    timelineView: "combined",
    selectedKeyId: null,
    hiddenSources: [],
    keyframes: [],
  },
  });
};

let state = defaultState();
let selected = { kind: "item", id: state.items[0].id };
let history = [];
let future = [];
let project = null;
let activeSceneId = "";
let activeCutId = "";
let workspaceMode = "blocking";
let storyboardStatusFilter = "all";
const storyboardScope = "project";
let structureDraft = null;
let storyboardThumbnailRun = 0;
let projectSaveStatus = "changed";
let managedProjectId = "";
let managedProjectRevision = 0;
let managedProjectUpdatedAt = "";
let managedSavedFingerprint = "";
let managedAutosaveTimer = null;
let managedRecoveryTimer = null;
let managedRecoveryWarningShown = false;
let managedSaveInFlight = false;
let managedSaveConflict = false;
let suppressManagedAutosave = false;
let projectLibraryTab = "active";
let projectLibraryItems = [];
let pendingProjectRenameId = "";
let projectVersionItems = [];
let pendingProjectCreationMode = "blank";
let appToastTimer = null;
let projectHistory = [];
let projectFuture = [];
let scenarioDialogDraft = null;
let scenarioDialogApplied = false;
let structureReviewMode = false;
const cutRuntime = new Map();
const storyboardThumbnailCache = new Map();
let drag = null;
let keyBadgePress = null;
let keyBadgeDrag = null;
let curveHandleDrag = null;
let pathSnapGuide = null;
let timelineDrag = null;
let stageRect = { x: 0, y: 0, w: 1, h: 1 };
const STAGE_ZOOM_MIN = 1;
const STAGE_ZOOM_MAX = 4;
const STAGE_WORLD_LONG_EDGE = 36;
const STAGE_GRID_STEP_METERS = 1.5;
const THREE_ORBIT_RADIUS_MIN = 1.5;
const THREE_ORBIT_RADIUS_MAX = 39;
let stageZoom = 1;
let stagePanDrag = null;
let stageSpaceHeld = false;
let stageSpacePanUsed = false;
let preview = null;
let viewMode = "2d";
let threeView = null;
let threeDrag = null;
let threeEditMode = "move";
let selectedPoseActorId = state.items[0].id;
let selectedPoseJoint = "chest";
let selectedPoseCategory = "";
let poseClipboard = null;
const CUSTOM_POSES_KEY = "frisframe:custom-poses";
let pendingExport = null;
let evaluatedViewState = null;
let mediaExportBusy = false;
let mediaExportProgress = "";
let tutorialOpen = false;
let tutorialIndex = 0;
let tutorialPositionFrame = null;
let manualActiveSection = "overview";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const mobilePanelQuery = window.matchMedia("(max-width: 760px)");
const TUTORIAL_STORAGE_KEY = "previs-blocking-tutorial-v1";
const manualGuideCore = window.FrisFrameManualGuideCore;
if (!manualGuideCore) throw new Error("매뉴얼 모듈을 불러오지 못했습니다.");
const tutorialSteps = manualGuideCore.buildTutorialSteps(SERVICE_NAME);

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function clone(value) {
  return structuredClone(value);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function degToRad(deg) {
  return (deg * Math.PI) / 180;
}

function radToDeg(rad) {
  return ((rad * 180) / Math.PI + 360) % 360;
}

function radToDegSigned(rad) {
  return (rad * 180) / Math.PI;
}

function focalToFov(focal) {
  return (2 * Math.atan(36 / (2 * focal)) * 180) / Math.PI;
}

function horizontalFovToVerticalFov(horizontalFov, aspect) {
  const safeAspect = Math.max(0.1, Number(aspect) || 1);
  const vertical = 2 * Math.atan(Math.tan(degToRad(horizontalFov) / 2) / safeAspect);
  return radToDeg(vertical);
}

function cameraHeadingDeg(camera) {
  return Math.round(normalizePanDeg(camera?.panDeg ?? 180));
}

function normalizePanDeg(value) {
  return ((Number(value || 0) % 360) + 360) % 360;
}

function cameraOrientationFromLegacy(camera, renderState = state) {
  const size = stageWorldSize(renderState);
  const dx = (Number(camera?.aimX ?? camera?.x ?? 0.5) - Number(camera?.x ?? 0.5)) * size.width;
  const dz = (Number(camera?.aimY ?? camera?.y ?? 0.5) - Number(camera?.y ?? 0.5)) * size.depth;
  const dy = Number(camera?.focusHeight ?? camera?.height ?? 1.6) - Number(camera?.height ?? 1.6);
  const horizontal = Math.hypot(dx, dz);
  return {
    panDeg: horizontal > 0.0001 ? normalizePanDeg(radToDeg(Math.atan2(dz, dx))) : 180,
    tiltDeg: clamp(radToDegSigned(Math.atan2(dy, Math.max(0.0001, horizontal))), -60, 60),
  };
}

function cameraDirection(camera) {
  const pan = degToRad(normalizePanDeg(camera?.panDeg ?? 180));
  const tilt = degToRad(clamp(Number(camera?.tiltDeg ?? 0), -60, 60));
  return {
    x: Math.cos(tilt) * Math.cos(pan),
    y: Math.sin(tilt),
    z: Math.cos(tilt) * Math.sin(pan),
  };
}

function syncCameraDerivedAim(camera, renderState = state, distanceM = 6) {
  const size = stageWorldSize(renderState);
  const direction = cameraDirection(camera);
  const horizontalScale = Math.max(0.01, Math.hypot(direction.x, direction.z));
  camera.aimX = Number(camera.x) + (direction.x / horizontalScale) * distanceM / size.width;
  camera.aimY = Number(camera.y) + (direction.z / horizontalScale) * distanceM / size.depth;
  camera.focusHeight = clamp(Number(camera.height || 1.6) + Math.tan(degToRad(camera.tiltDeg || 0)) * distanceM, -4, 8);
  return camera;
}

function cameraLookTarget(camera, renderState = state, distanceM = 10) {
  const THREE = window.THREE;
  const position = mapToWorld(camera, renderState, Number(camera.height || 1.6));
  const direction = cameraDirection(camera);
  return new THREE.Vector3(
    position.x + direction.x * distanceM,
    position.y + direction.y * distanceM,
    position.z + direction.z * distanceM,
  );
}

function isoNow() {
  return new Date().toISOString();
}

function defaultCutMetadata(blocking = state) {
  return {
    id: uid(),
    number: 1,
    title: String(blocking.sceneTitle || "새 컷"),
    action: "",
    dialogue: "",
    camera: "",
    intent: String(blocking.sceneIntent || ""),
    notes: "",
    shotType: "미정",
    status: blocking.motion?.keyframes?.length ? "blocking" : "draft",
    thumbnailTime: 0,
    sourceText: "",
    createdAt: isoNow(),
    updatedAt: isoNow(),
    blocking,
  };
}

function createCut(blocking = defaultState(), metadata = {}) {
  const documentState = clone(blocking);
  const cut = { ...defaultCutMetadata(documentState), ...metadata, blocking: documentState };
  cut.id = String(metadata.id || cut.id || uid());
  cut.title = String(metadata.title || documentState.sceneTitle || "새 컷");
  cut.action = String(metadata.action || "");
  cut.dialogue = String(metadata.dialogue || "");
  cut.camera = String(metadata.camera || "");
  cut.intent = String(metadata.intent ?? documentState.sceneIntent ?? "");
  cut.notes = String(metadata.notes || "");
  cut.shotType = String(metadata.shotType || "미정");
  cut.status = ["draft", "blocking", "review", "approved"].includes(metadata.status)
    ? metadata.status
    : cut.status;
  cut.thumbnailTime = clamp(finiteNumber(metadata.thumbnailTime, 0), 0, documentState.motion?.duration || 60);
  cut.sourceText = String(metadata.sourceText || "");
  cut.createdAt = String(metadata.createdAt || isoNow());
  cut.updatedAt = String(metadata.updatedAt || cut.createdAt);
  cut.blocking.sceneTitle = cut.title;
  cut.blocking.sceneIntent = cut.intent || cut.camera || "";
  return cut;
}

function createScene(cuts = [createCut()], metadata = {}) {
  return {
    id: String(metadata.id || uid()),
    number: Number(metadata.number || 1),
    heading: String(metadata.heading || "장면 1"),
    synopsis: String(metadata.synopsis || ""),
    scriptText: String(metadata.scriptText || ""),
    createdAt: String(metadata.createdAt || isoNow()),
    updatedAt: String(metadata.updatedAt || isoNow()),
    cuts,
  };
}

function createDefaultProject(blocking = state) {
  const cut = createCut(blocking, { title: blocking.sceneTitle || "첫 컷" });
  const scene = createScene([cut], { heading: "장면 1" });
  return {
    id: uid(),
    title: blocking.sceneTitle && blocking.sceneTitle !== "새 블로킹" ? blocking.sceneTitle : "새 프로젝트",
    logline: "",
    createdAt: isoNow(),
    updatedAt: isoNow(),
    scenario: {
      sourceType: "manual",
      sourceName: "",
      importedAt: "",
      rawText: "",
      storyboardText: "",
      warnings: [],
    },
    scenes: [scene],
  };
}

function currentScene() {
  return project?.scenes?.find((scene) => scene.id === activeSceneId) || null;
}

function currentCut() {
  const scene = currentScene();
  return scene?.cuts?.find((cut) => cut.id === activeCutId) || null;
}

function findProjectCut(sceneId, cutId) {
  const scene = project?.scenes?.find((entry) => entry.id === sceneId) || null;
  return { scene, cut: scene?.cuts?.find((entry) => entry.id === cutId) || null };
}

function syncActiveCutDocument(touch = true) {
  const cut = currentCut();
  if (!cut) return;
  cut.blocking = state;
  cut.title = String(state.sceneTitle || cut.title || "새 컷");
  cut.intent = String(state.sceneIntent || cut.intent || "");
  if (touch) {
    cut.updatedAt = isoNow();
    project.updatedAt = cut.updatedAt;
  }
}

function captureProjectSnapshot() {
  syncActiveCutDocument(false);
  return JSON.stringify({ project, activeSceneId, activeCutId });
}

function pushProjectHistory() {
  projectHistory.push(captureProjectSnapshot());
  if (projectHistory.length > 20) projectHistory.shift();
  projectFuture = [];
  syncHistoryButtons();
}

function restoreProjectSnapshot(json) {
  const saved = JSON.parse(json);
  clearStoryboardThumbnailCache();
  cutRuntime.clear();
  project = sanitizeProjectDocument(saved.project);
  const scene = project.scenes.find((entry) => entry.id === saved.activeSceneId) || project.scenes[0];
  const cut = scene.cuts.find((entry) => entry.id === saved.activeCutId) || scene.cuts[0];
  activeSceneId = scene.id;
  activeCutId = cut.id;
  state = cut.blocking;
  selected = { kind: "camera" };
  history = [];
  future = [];
  sanitizeState();
  cut.blocking = state;
  history = [snapshot()];
  selectKeyForSource(activeSourceId());
  setProjectSaveStatus("changed");
  syncUi();
  draw();
  if (workspaceMode === "storyboard") renderStoryboardWorkspace();
}

function sanitizeBlockingDocument(documentState) {
  const previousState = state;
  const previousSelected = selected;
  state = clone(documentState || defaultState());
  selected = { kind: "camera" };
  sanitizeState();
  const normalized = state;
  state = previousState;
  selected = previousSelected;
  return normalized;
}

function collectionValues(value, order = []) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  const ordered = order.map((id) => value[id]).filter(Boolean);
  const remaining = Object.values(value).filter((entry) => !ordered.includes(entry));
  return [...ordered, ...remaining];
}

function sanitizeProjectDocument(projectData) {
  const source = clone(projectData || {});
  const sceneInputs = collectionValues(source.scenes, source.sceneOrder);
  const scenes = sceneInputs.map((sceneInput, sceneIndex) => {
    const cutInputs = collectionValues(sceneInput?.cuts, sceneInput?.cutOrder);
    const cuts = (cutInputs.length ? cutInputs : [{}]).map((cutInput, cutIndex) => {
      const blocking = sanitizeBlockingDocument(cutInput?.blocking || defaultState());
      return createCut(blocking, {
        ...cutInput,
        id: cutInput?.id || uid(),
        number: cutIndex + 1,
        title: cutInput?.title || blocking.sceneTitle || `컷 ${cutIndex + 1}`,
      });
    });
    return createScene(cuts, {
      ...sceneInput,
      id: sceneInput?.id || uid(),
      number: sceneIndex + 1,
      heading: sceneInput?.heading || `장면 ${sceneIndex + 1}`,
    });
  });
  const normalizedScenes = scenes.length ? scenes : [createScene([createCut(defaultState())])];
  const normalized = {
    id: String(source.id || uid()),
    title: String(source.title || normalizedScenes[0].cuts[0].title || "새 프로젝트"),
    logline: String(source.logline || ""),
    createdAt: String(source.createdAt || isoNow()),
    updatedAt: String(source.updatedAt || isoNow()),
    scenario: {
      sourceType: String(source.scenario?.sourceType || "manual"),
      sourceName: String(source.scenario?.sourceName || ""),
      importedAt: String(source.scenario?.importedAt || ""),
      rawText: String(source.scenario?.rawText || ""),
      storyboardText: String(source.scenario?.storyboardText || ""),
      warnings: Array.isArray(source.scenario?.warnings) ? source.scenario.warnings.map(String).slice(0, 12) : [],
    },
    scenes: normalizedScenes,
  };
  renumberProject(normalized);
  return normalized;
}

function migrateLegacyBlocking(blockingInput) {
  const blocking = sanitizeBlockingDocument(blockingInput || defaultState());
  return sanitizeProjectDocument(storyboardCore.wrapLegacyProject(blocking, {
    idFactory: uid,
    now: isoNow(),
  }));
}

function projectFromPayload(payload) {
  const schemaVersion = Number(payload?.schemaVersion || 0);
  if (schemaVersion > PROJECT_SCHEMA_VERSION) {
    throw new Error(`이 프로젝트는 더 새로운 FrisFrame 형식(v${schemaVersion})입니다. 현재 버전에서는 열 수 없습니다.`);
  }
  if (payload?.project) {
    return sanitizeProjectDocument(payload.project || payload);
  }
  const legacy = payload?.state || payload;
  if (legacy?.version === 4 || legacy?.camera || legacy?.motion) return migrateLegacyBlocking(legacy);
  throw new Error("지원하지 않는 프로젝트 형식입니다.");
}

function renumberProject(targetProject = project) {
  (targetProject?.scenes || []).forEach((scene, sceneIndex) => {
    scene.number = sceneIndex + 1;
    (scene.cuts || []).forEach((cut, cutIndex) => { cut.number = cutIndex + 1; });
  });
}

function clearStoryboardThumbnailCache() {
  storyboardThumbnailRun += 1;
  storyboardThumbnailCache.forEach((entry) => URL.revokeObjectURL(entry.url));
  storyboardThumbnailCache.clear();
}

function saveCurrentCutRuntime() {
  if (!activeCutId) return;
  cutRuntime.set(activeCutId, {
    history: [...history],
    future: [...future],
    selected: clone(selected),
  });
}

function switchProjectCut(sceneId, cutId, options = {}) {
  const target = findProjectCut(sceneId, cutId);
  if (!target.scene || !target.cut) return false;
  cancelPreview();
  syncActiveCutDocument(false);
  saveCurrentCutRuntime();
  drag = null;
  timelineDrag = null;
  keyBadgePress = null;
  keyBadgeDrag = null;
  curveHandleDrag = null;
  activeSceneId = target.scene.id;
  activeCutId = target.cut.id;
  state = target.cut.blocking;
  sanitizeState();
  target.cut.blocking = state;
  const runtime = cutRuntime.get(activeCutId);
  selected = runtime?.selected && selectedExists(runtime.selected) ? runtime.selected : { kind: "camera" };
  history = runtime?.history?.length ? [...runtime.history] : [snapshot()];
  future = runtime?.future?.length ? [...runtime.future] : [];
  selectKeyForSource(selectedSourceId() || activeSourceId());
  syncUi();
  draw();
  syncProjectChrome();
  if (options.renderStoryboard !== false && workspaceMode === "storyboard") renderStoryboardWorkspace();
  return true;
}

function loadProjectDocument(nextProject) {
  clearStoryboardThumbnailCache();
  cutRuntime.clear();
  projectHistory = [];
  projectFuture = [];
  scenarioDialogDraft = null;
  project = sanitizeProjectDocument(nextProject);
  const firstScene = project.scenes[0];
  activeSceneId = firstScene.id;
  activeCutId = firstScene.cuts[0].id;
  state = firstScene.cuts[0].blocking;
  selected = { kind: "camera" };
  history = [];
  future = [];
  sanitizeState();
  firstScene.cuts[0].blocking = state;
  selectKeyForSource(activeSourceId());
  commit();
  syncProjectChrome();
}

function remapBlockingIds(blockingInput) {
  const blocking = clone(blockingInput);
  const itemIds = new Map();
  blocking.items = (blocking.items || []).map((item) => {
    const nextId = uid();
    itemIds.set(item.id, nextId);
    return { ...item, id: nextId };
  });
  blocking.items = blocking.items.map((item) => ({
    ...item,
    mountId: item.mountId ? itemIds.get(item.mountId) || "" : "",
  }));
  blocking.groups = (blocking.groups || []).map((group) => ({
    ...group,
    id: uid(),
    leaderId: itemIds.get(group.leaderId) || "",
    members: (group.members || []).map((member) => ({
      ...member,
      itemId: itemIds.get(member.itemId) || "",
    })).filter((member) => member.itemId),
  })).filter((group) => group.leaderId && group.members.length > 1);
  blocking.camera.trackingTargetId = itemIds.get(blocking.camera?.trackingTargetId) || "";
  blocking.motion.keyframes = (blocking.motion?.keyframes || []).map((keyframe) => ({
    ...keyframe,
    id: uid(),
    source: keyframe.source === "camera" ? "camera" : itemIds.get(keyframe.source) || keyframe.source,
    pose: keyframe.pose ? {
      ...keyframe.pose,
      mountId: keyframe.pose.mountId ? itemIds.get(keyframe.pose.mountId) || "" : "",
    } : keyframe.pose,
  }));
  blocking.motion.hiddenSources = (blocking.motion?.hiddenSources || [])
    .map((sourceId) => sourceId === "camera" ? "camera" : itemIds.get(sourceId))
    .filter(Boolean);
  blocking.motion.selectedKeyId = null;
  return blocking;
}

function createContinuityBlocking(template = state) {
  const fresh = defaultState();
  const duration = template.motion?.duration || 15;
  const endState = interpolateRenderStateAtTime(template, duration);
  fresh.aspect = template.aspect;
  fresh.spacePresetId = template.spacePresetId || "";
  fresh.showGrid = template.showGrid;
  fresh.showNames = template.showNames;
  fresh.showCamera = template.showCamera;
  fresh.cleanExport = template.cleanExport;
  fresh.camera = clone(endState.camera);
  fresh.items = clone(endState.items);
  fresh.groups = clone(template.groups || []);
  fresh.motion.duration = duration;
  fresh.motion.fps = template.motion?.fps || 24;
  fresh.sceneTitle = "새 컷";
  fresh.sceneIntent = "";
  return remapBlockingIds(fresh);
}

function draftCameraFromText(draft, actorX = 0.32, actorY = 0.46) {
  const combined = [draft.title, draft.action, draft.dialogue, draft.camera, draft.intent]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  // 1. Determine distance & focal preset
  let distance = 0.60;
  let focal = 50;

  if (/익스트림\s*클로즈|extreme\s*close|ecu|초근접/.test(combined)) {
    distance = 0.22;
    focal = 100;
  } else if (/클로즈|close[ -]?up|cu/.test(combined)) {
    distance = 0.35;
    focal = 85;
  } else if (/바스트|medium\s*close|mcu/.test(combined)) {
    distance = 0.50;
    focal = 50;
  } else if (/미디엄|medium|ms/.test(combined)) {
    distance = 0.70;
    focal = 35;
  } else if (/풀\s*샷|full\s*shot|fs/.test(combined)) {
    distance = 1.00;
    focal = 28;
  } else if (/와이드|wide|롱\s*샷|long\s*shot|ws|els|익스트림\s*롱/.test(combined)) {
    distance = 1.40;
    focal = 21;
  }

  // 2. Determine angle direction
  let angleRad = Math.PI; // default: looking left (from right side of actor)
  if (/측면|옆면|profile|lateral|side/.test(combined)) {
    angleRad = -Math.PI / 2; // looking from below (Y+)
  } else if (/후면|뒷모습|뒤쪽|rear|back/.test(combined)) {
    angleRad = 0; // looking from left (X-)
  } else if (/정면|앞모습|front|frontal/.test(combined)) {
    angleRad = Math.PI; // looking from right (X+)
  }

  // 3. Height & Tilt
  let height = 1.6;
  let focusHeight = 1.1;
  let tiltDeg = -6;

  if (/수직|버티컬|vertical|overhead|탑샷/.test(combined)) {
    height = 4.2;
    focusHeight = 0;
    tiltDeg = -88;
  } else if (/하이|high/.test(combined)) {
    height = 3.0;
    focusHeight = 0.8;
    tiltDeg = -25;
  } else if (/로우|낮은|low|바닥|ground/.test(combined)) {
    height = 0.4;
    focusHeight = 1.3;
    tiltDeg = 15;
  }

  const cameraX = actorX + Math.cos(angleRad) * distance;
  const cameraY = actorY + Math.sin(angleRad) * distance;

  return {
    x: Math.min(1.99, Math.max(0.01, cameraX)),
    y: Math.min(1.99, Math.max(0.01, cameraY)),
    aimX: actorX,
    aimY: actorY,
    height,
    focusHeight,
    tiltDeg,
    focal: draft.focal ? clamp(Number(draft.focal), 14, 135) : focal,
    panDeg: Math.round((radToDeg(angleRad + Math.PI) + 360) % 360),
    trackingTargetId: "",
    locks: {
      position: false,
      orientation: false,
      lens: false,
      height: false,
    }
  };
}

function createCutFromTextDraft(draft) {
  const blocking = defaultState();
  blocking.sceneTitle = draft.title || "새 컷";
  blocking.sceneIntent = [draft.intent, draft.camera].filter(Boolean).join("\n");
  if (draft.duration) blocking.motion.duration = clamp(Number(draft.duration), 1, MAX_TIMELINE_DURATION);
  
  // Apply visual-guided smart camera layout
  const firstActor = blocking.items.find((item) => item.type === "actor") || { x: 0.32, y: 0.46 };
  blocking.camera = draftCameraFromText(draft, firstActor.x, firstActor.y);

  return createCut(blocking, {
    title: draft.title,
    action: draft.action,
    dialogue: draft.dialogue,
    camera: draft.camera,
    intent: draft.intent || draft.camera,
    notes: draft.notes,
    shotType: draft.shotType,
    status: "draft",
    sourceText: draft.sourceText,
  });
}

function sceneFromTextDraft(draft) {
  return createScene((draft.cuts || []).map(createCutFromTextDraft), {
    heading: draft.heading,
    synopsis: draft.synopsis,
    scriptText: draft.scriptText,
  });
}

function cutIssueList(cut) {
  const issues = [];
  if (!String(cut.title || "").trim()) issues.push("컷 제목 없음");
  if (!String(cut.action || "").trim()) issues.push("액션 설명 없음");
  const keys = cut.blocking?.motion?.keyframes || [];
  if (!keys.length) issues.push("키프레임 없음");
  if (!keys.some((keyframe) => keyframe.source === "camera")) issues.push("카메라 키 없음");
  issues.push(...continuityIssuesForCut(cut));
  return issues;
}

function continuityIssuesForCut(cut) {
  const location = project?.scenes?.map((scene) => ({ scene, index: scene.cuts.indexOf(cut) }))
    .find((entry) => entry.index >= 0);
  if (!location || location.index === 0) return [];
  const previousCut = location.scene.cuts[location.index - 1];
  return continuityIssues(previousCut?.blocking, cut?.blocking);
}

function continuityIssues(previousBlocking, currentBlocking) {
  if (!previousBlocking || !currentBlocking) return [];
  const previous = interpolateRenderStateAtTime(previousBlocking, previousBlocking.motion?.duration || 0);
  const current = interpolateRenderStateAtTime(currentBlocking, 0);
  const issues = [];
  if (previous.aspect !== current.aspect) issues.push(`연속성: 화면비 ${previous.aspect} → ${current.aspect}`);
  const currentByIdentity = new Map(current.items.map((item) => [continuityIdentity(item), item]));
  previous.items.forEach((before) => {
    const after = currentByIdentity.get(continuityIdentity(before));
    if (!after) {
      if (before.type === "actor") issues.push(`연속성: @${before.name}이 다음 컷에서 사라짐`);
      return;
    }
    if (before.type === "prop" && before.assetType !== after.assetType) {
      issues.push(`연속성: ${before.name} 소품 종류가 바뀜`);
    }
    if (before.color !== after.color) issues.push(`연속성: ${before.name} 색상이 바뀜`);
    if (before.type === "actor" && (before.mountId ? "mounted" : "free") !== (after.mountId ? "mounted" : "free")) {
      issues.push(`연속성: @${before.name} 탑승 상태가 바뀜`);
    }
    const beforePose = resolvedItemPose(before, previous);
    const afterPose = resolvedItemPose(after, current);
    const size = stageWorldSize(current);
    const jump = Math.hypot((beforePose.x - afterPose.x) * size.width, (beforePose.y - afterPose.y) * size.depth);
    if (before.type === "actor" && jump > 0.75) issues.push(`연속성: @${before.name} 위치가 ${jump.toFixed(1)}m 이동`);
    const facingChange = Math.abs((((afterPose.facing - beforePose.facing) % 360) + 540) % 360 - 180);
    if (before.type === "actor" && facingChange > 45) issues.push(`연속성: @${before.name} 방향이 ${Math.round(facingChange)}° 바뀜`);
  });
  return issues.slice(0, 8);
}

function continuityIdentity(item) {
  return String(item.continuityId || `${item.type}:${String(item.name || "").trim().toLowerCase()}`);
}

function snapshot() {
  return JSON.stringify(state);
}

function commit() {
  evaluatedViewState = null;
  applyCameraTracking(state);
  history.push(snapshot());
  if (history.length > 80) history.shift();
  future = [];
  syncActiveCutDocument();
  setProjectSaveStatus("changed");
  syncUi();
  draw();
  syncProjectChrome();
}

function restore(json) {
  state = JSON.parse(json);
  evaluatedViewState = null;
  sanitizeState();
  const cut = currentCut();
  if (cut) cut.blocking = state;
  selected = selectedExists(selected) ? selected : { kind: "camera" };
  setProjectSaveStatus("changed");
  syncUi();
  draw();
  syncProjectChrome();
}

function undo() {
  if (workspaceMode === "storyboard" && projectHistory.length) {
    projectFuture.push(captureProjectSnapshot());
    restoreProjectSnapshot(projectHistory.pop());
    notifyApp("프로젝트 구조 변경을 되돌렸습니다.");
    return;
  }
  if (history.length < 2) return;
  future.push(history.pop());
  restore(history[history.length - 1]);
}

function redo() {
  if (workspaceMode === "storyboard" && projectFuture.length) {
    projectHistory.push(captureProjectSnapshot());
    restoreProjectSnapshot(projectFuture.pop());
    notifyApp("프로젝트 구조 변경을 다시 적용했습니다.");
    return;
  }
  if (!future.length) return;
  const next = future.pop();
  history.push(next);
  restore(next);
}

function setupResponsivePanels() {
  applyResponsivePanelDefaults();
  const handleChange = () => applyResponsivePanelDefaults();
  if (mobilePanelQuery.addEventListener) {
    mobilePanelQuery.addEventListener("change", handleChange);
  } else {
    mobilePanelQuery.addListener(handleChange);
  }
}

function applyResponsivePanelDefaults() {
  const isMobile = mobilePanelQuery.matches;
  $$("[data-mobile-collapsible]").forEach((panel) => {
    if (isMobile) {
      panel.open = panel.dataset.mobileDefault === "open";
      return;
    }
    panel.open = panel.dataset.desktopDefault ? panel.dataset.desktopDefault === "open" : true;
  });
}

function sanitizeState() {
  state.version = 5;
  state.spacePresetId = environmentPresets[state.spacePresetId] ? state.spacePresetId : "";
  state.previs = state.previs || {};
  state.previs.mode = previsModes[state.previs.mode] ? state.previs.mode : "full-scene";
  state.previs.target = previsTargets[state.previs.target] ? state.previs.target : "hybrid";
  state.previs.selectedLayers = normalizeSelection(state.previs.selectedLayers, controlLayers, ["camera", "pose", "depth", "ai-depth", "edges", "masks"]);
  state.previs.exportPresets = normalizeSelection(state.previs.exportPresets, exportPresets, ["seedance", "blender"]);
  delete state.reference;
  delete state.motionPrevis;
  state.items = (state.items || []).map((item) => sanitizeItemPose(item));
  sanitizeAutoMountRelationships(state);
  state.groups = sanitizeManualGroups(state.groups, state);
  migrateLegacyMountsToGroups(state);
  state.groups = sanitizeManualGroups(state.groups, state);
  const cameraOrientation = cameraOrientationFromLegacy(state.camera, state);
  state.camera = {
    x: clamp(finiteNumber(state.camera?.x, 0.92), 0.02, 0.98),
    y: clamp(finiteNumber(state.camera?.y, 0.48), 0.02, 0.98),
    height: clamp(finiteNumber(state.camera?.height, 1.6), 0.4, 3),
    panDeg: normalizePanDeg(Number.isFinite(Number(state.camera?.panDeg)) ? state.camera.panDeg : cameraOrientation.panDeg),
    tiltDeg: clamp(Number.isFinite(Number(state.camera?.tiltDeg)) ? Number(state.camera.tiltDeg) : cameraOrientation.tiltDeg, -60, 60),
    focal: clamp(finiteNumber(state.camera?.focal, 85), 14, 135),
    trackingTargetId: sanitizeTrackingTargetId(state.camera?.trackingTargetId, state),
    locks: sanitizeCameraLocks(state.camera?.locks),
  };
  syncCameraDerivedAim(state.camera, state);
  state.motion = state.motion || {};
  state.motion.duration = clamp(finiteNumber(state.motion.duration, 15), 1, MAX_TIMELINE_DURATION);
  state.motion.fps = clamp(finiteNumber(state.motion.fps, 24), 12, 60);
  state.motion.playhead = clamp(finiteNumber(state.motion.playhead, 0), 0, state.motion.duration);
  state.motion.hiddenSources = normalizeHiddenSources(state.motion.hiddenSources);
  state.motion.timelineView = state.motion.timelineView === "split" ? "split" : "combined";
  state.motion.keyframes = normalizeKeyframes(state.motion.keyframes)
    .filter((keyframe) => !isSourceHidden(keyframe.source));
  const groupedFollowerIds = new Set(state.groups
    .flatMap((group) => group.members.filter((member) => member.itemId !== group.leaderId).map((member) => member.itemId)));
  state.motion.keyframes = state.motion.keyframes.filter((keyframe) => !groupedFollowerIds.has(keyframe.source));
  if (!state.motion.keyframes.length) {
    if (state.motion.start) {
      state.motion.keyframes.push(...splitLegacyKeyframe({
        label: "키 1",
        time: 0,
        camera: clone(state.motion.start.camera || state.camera),
        items: clone(state.motion.start.items || state.items),
      }));
    }
    if (state.motion.end) {
      state.motion.keyframes.push(...splitLegacyKeyframe({
        label: `키 ${state.motion.keyframes.length + 1}`,
        time: state.motion.duration,
        camera: clone(state.motion.end.camera || state.camera),
        items: clone(state.motion.end.items || state.items),
      }));
    }
  }
  delete state.motion.start;
  delete state.motion.end;
  state.motion.keyframes = state.motion.keyframes.filter((keyframe) => !isSourceHidden(keyframe.source));
  state.motion.keyframes = sortKeyframes(state.motion.keyframes);
  sourceDefinitions().forEach((source) => reconcileSourcePathConstraints(source.id, { applySelection: false }));
  state.motion.activeSource = sourceExists(state.motion.activeSource) || state.motion.activeSource === "all"
    ? state.motion.activeSource
    : selectedSourceId() || "all";
  state.motion.selectedKeyId = selectedKeyframeExists(state.motion.selectedKeyId)
    ? state.motion.selectedKeyId
    : state.motion.keyframes[0]?.id || null;
  state.aspect = aspectMap[state.aspect] ? state.aspect : "16:9";
}

function sanitizeCameraLocks(locks = {}) {
  return {
    position: locks?.position === true,
    orientation: locks?.orientation === true,
    lens: locks?.lens === true,
    height: locks?.height === true,
  };
}

function cameraFieldLocked(field, renderState = state) {
  return sanitizeCameraLocks(renderState.camera?.locks)[field] === true;
}

function itemEditLocked(itemOrId, renderState = state) {
  const item = typeof itemOrId === "string"
    ? renderState.items?.find((entry) => entry.id === itemOrId)
    : itemOrId;
  return item?.editLocked === true;
}

function affectedTransformItems(itemId, renderState = state) {
  const item = renderState.items?.find((entry) => entry.id === itemId);
  if (!item) return [];
  const ids = new Set([item.id]);
  const group = groupForItem(item.id, renderState);
  group?.members?.forEach((member) => ids.add(member.itemId));
  if (isVehicleProp(item)) {
    renderState.items
      .filter((entry) => entry.type === "actor" && entry.placementMode === "auto" && entry.mountId === item.id)
      .forEach((entry) => ids.add(entry.id));
  }
  return renderState.items.filter((entry) => ids.has(entry.id));
}

function itemTransformLocked(itemId, renderState = state) {
  return affectedTransformItems(itemId, renderState).some((item) => itemEditLocked(item, renderState));
}

function sourceEditLocked(sourceId, renderState = state) {
  return sourceId !== "camera" && itemTransformLocked(sourceId, renderState);
}

function sourceSpatialLocked(sourceId, renderState = state) {
  return sourceId === "camera" ? cameraFieldLocked("position", renderState) : sourceEditLocked(sourceId, renderState);
}

function hasLockedTimelineSources(renderState = state) {
  return (renderState.motion?.keyframes || []).some((keyframe) => sourceEditLocked(keyframe.source, renderState));
}

function mergeLockedCameraPose(nextPose, previousPose = {}) {
  const locks = sanitizeCameraLocks(state.camera?.locks);
  const next = { ...nextPose };
  if (locks.position) {
    next.x = previousPose.x;
    next.y = previousPose.y;
  }
  if (locks.orientation) {
    next.panDeg = previousPose.panDeg;
    next.tiltDeg = previousPose.tiltDeg;
    next.trackingTargetId = previousPose.trackingTargetId;
  }
  if (locks.lens) next.focal = previousPose.focal;
  if (locks.height) next.height = previousPose.height;
  next.locks = locks;
  return sanitizeCameraPose(next);
}

function notifyEditLocked(label = "대상") {
  notifyApp(`${label} 편집 잠금을 해제한 뒤 수정하세요.`);
}

function normalizeSelection(values, catalog, fallback) {
  const selectedValues = Array.isArray(values) ? values : fallback;
  const normalized = selectedValues.filter((value, index, list) => catalog[value] && list.indexOf(value) === index);
  return normalized.length ? normalized : [...fallback];
}

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function selectedExists(selection) {
  if (!selection) return false;
  if (selection.kind === "camera") return true;
  if (selection.kind === "item" || selection.kind === "facing") {
    return state.items.some((item) => item.id === selection.id);
  }
  return false;
}

function selectedItem() {
  if (selected?.kind !== "item" && selected?.kind !== "facing") return null;
  return state.items.find((item) => item.id === selected.id) || null;
}

function sourceDefinitions(renderState = state) {
  return [
    { id: "camera", type: "camera", name: "카메라", color: "#71b8ff" },
    ...renderState.items.map((item) => ({
      id: item.id,
      type: item.type,
      name: item.name,
      color: item.color,
    })),
  ];
}

function visibleSourceDefinitions(renderState = state) {
  return sourceDefinitions(renderState).filter((source) => {
    if (isSourceHidden(source.id, renderState)) return false;
    if (source.id === "camera") return true;
    const item = renderState.items.find((entry) => entry.id === source.id);
    return isIndependentMotionSource(item, renderState);
  });
}

function isIndependentMotionSource(item, renderState = state) {
  return Boolean(item
    && item.motionEnabled !== false
    && !(item.type === "actor" && item.placementMode === "auto" && item.mountId)
    && isGroupLeader(item, renderState));
}

function sourceExists(sourceId, renderState = state) {
  if (sourceId === "camera") return true;
  return renderState.items.some((item) => item.id === sourceId);
}

function normalizeHiddenSources(sources) {
  if (!Array.isArray(sources)) return [];
  return [...new Set(sources)].filter((sourceId) => sourceExists(sourceId));
}

function isSourceHidden(sourceId, renderState = state) {
  return Boolean(renderState.motion?.hiddenSources?.includes(sourceId));
}

function keyframeCountForSources(sourceIds, renderState = state) {
  const sourceSet = new Set(Array.isArray(sourceIds) ? sourceIds : [sourceIds]);
  return (renderState.motion?.keyframes || []).filter((keyframe) => sourceSet.has(keyframe.source)).length;
}

function confirmKeyframeRemoval(sourceIds, actionLabel, detail = "") {
  const count = keyframeCountForSources(sourceIds);
  if (!count) return true;
  const suffix = detail ? `\n${detail}` : "";
  return confirm(`${actionLabel}\n키프레임 ${count}개가 삭제됩니다.${suffix}\n이 작업은 실행 취소할 수 있습니다.`);
}

function showSourceTimeline(sourceId) {
  state.motion.hiddenSources = normalizeHiddenSources(state.motion.hiddenSources)
    .filter((entry) => entry !== sourceId);
}

function hideSourceTimeline(sourceId) {
  if (!sourceExists(sourceId)) return;
  if (sourceEditLocked(sourceId)) {
    notifyEditLocked(sourceLabel(sourceId));
    return false;
  }
  state.motion.hiddenSources = [...new Set([...normalizeHiddenSources(state.motion.hiddenSources), sourceId])];
  state.motion.keyframes = state.motion.keyframes.filter((keyframe) => keyframe.source !== sourceId);
  if (state.motion.activeSource === sourceId) state.motion.activeSource = "all";
  if (!selectedKeyframeExists(state.motion.selectedKeyId)) {
    state.motion.selectedKeyId = state.motion.keyframes[0]?.id || null;
  }
  return true;
}

function sourceDefinition(sourceId, renderState = state) {
  return sourceDefinitions(renderState).find((source) => source.id === sourceId) || null;
}

function sourceLabel(sourceId, renderState = state) {
  return sourceDefinition(sourceId, renderState)?.name || "Unknown";
}

function sourceColor(sourceId, renderState = state) {
  return sourceDefinition(sourceId, renderState)?.color || "#8a949b";
}

function selectedSourceId() {
  if (selected?.kind === "camera") return "camera";
  if ((selected?.kind === "item" || selected?.kind === "facing") && sourceExists(selected.id)) {
    const item = state.items.find((entry) => entry.id === selected.id);
    if (item?.type === "actor" && item.placementMode === "auto" && item.mountId) return item.mountId;
    return groupLeaderIdForItem(selected.id, state);
  }
  return null;
}

function activeSourceId() {
  const sourceId = state.motion.activeSource || selectedSourceId() || "all";
  if (sourceId === "all" || sourceExists(sourceId)) return sourceId;
  return "all";
}

function setActiveSource(sourceId) {
  if (sourceId === "all" || sourceExists(sourceId)) state.motion.activeSource = sourceId;
}

function syncPlayheadFromTimeInput() {
  const input = $("#keyTimeInput");
  if (!input) return;
  const value = Number(input.value);
  if (Number.isFinite(value)) {
    state.motion.playhead = clamp(value, 0, MAX_TIMELINE_DURATION);
    ensureDurationCovers(state.motion.playhead);
  }
}

function readTimelineTimeInput(fallback = state.motion.playhead) {
  const value = Number($("#keyTimeInput")?.value ?? fallback);
  return clamp(Number.isFinite(value) ? value : fallback, 0, MAX_TIMELINE_DURATION);
}

function ensureDurationCovers(time) {
  const nextTime = clamp(Number(time || 0), 0, MAX_TIMELINE_DURATION);
  if (nextTime > state.motion.duration) {
    state.motion.duration = Number(nextTime.toFixed(2));
  }
  return state.motion.duration;
}

function poseForSource(sourceId) {
  if (sourceId === "camera") return clone(state.camera);
  const item = state.items.find((entry) => entry.id === sourceId);
  return item ? clone(item) : null;
}

function captureSourceKeyframe(sourceId, time = state.motion?.playhead ?? 0, label, pathMode = "straight") {
  const duration = state.motion?.duration ?? 15;
  if (sourceId !== "camera") {
    const item = state.items.find((entry) => entry.id === sourceId);
    if (!isIndependentMotionSource(item, state)) return null;
  }
  const pose = poseForSource(sourceId);
  if (!pose) return null;
  return {
    id: uid(),
    source: sourceId,
    label: label || nextSourceKeyLabel(sourceId),
    note: "",
    time: clamp(Number(time), 0, duration),
    transition: "smooth",
    segment: motionSegmentForPathMode(pathMode, sourceId),
    pose,
  };
}

function captureCameraHeightKeyframe() {
  if (cameraFieldLocked("height")) {
    notifyEditLocked("카메라 높이");
    return;
  }
  materializeEvaluatedViewForEditing("camera");
  setActiveSource("camera");
  selectSourceOnStage("camera");
  const requestedTime = readTimelineTimeInput(state.motion.playhead);
  const existing = keysForSource("camera").find((keyframe) => Math.abs(keyframe.time - requestedTime) < 0.05);
  if (existing) {
    existing.pose = sanitizeCameraPose({ ...existing.pose, height: state.camera.height });
    state.motion.selectedKeyId = existing.id;
    state.motion.playhead = existing.time;
    commit();
    notifyApp(`${existing.time.toFixed(1)}초 카메라 키의 높이만 갱신했습니다.`);
    return;
  }
  const time = availableKeyTime(requestedTime, "camera", { maxTime: MAX_TIMELINE_DURATION });
  ensureDurationCovers(time);
  const pathMode = $("#keyPathSelect")?.value || "straight";
  const keyframe = captureSourceKeyframe("camera", time, undefined, pathMode);
  if (!keyframe) return;
  applyPathModeToKeyframe(keyframe, pathMode);
  state.motion.keyframes.push(keyframe);
  state.motion.selectedKeyId = keyframe.id;
  state.motion.playhead = keyframe.time;
  state.motion.keyframes = sortKeyframes(state.motion.keyframes);
  commit();
  notifyApp(`${keyframe.time.toFixed(1)}초에 카메라 높이 키를 추가했습니다.`);
}

function captureAllSourceKeyframes(time = state.motion?.playhead ?? 0) {
  return visibleSourceDefinitions().map((source) => captureSourceKeyframe(source.id, time)).filter(Boolean);
}

function nextSourceKeyLabel(sourceId) {
  const count = state.motion?.keyframes?.filter((keyframe) => keyframe.source === sourceId).length || 0;
  return `키 ${count + 1}`;
}

function normalizeKeyframes(keyframes) {
  if (!Array.isArray(keyframes)) return [];
  return keyframes
    .flatMap((keyframe, index) => {
      if (keyframe.source) return [normalizeSourceKeyframe(keyframe, index)];
      return splitLegacyKeyframe(keyframe, index);
    })
    .filter(Boolean)
    .filter((keyframe) => sourceExists(keyframe.source));
}

function normalizeSourceKeyframe(keyframe, index = 0) {
  if (!sourceExists(keyframe.source)) return null;
  return {
    id: keyframe.id || uid(),
    source: keyframe.source,
    label: keyframe.label || `키 ${index + 1}`,
    note: String(keyframe.note || "").trim().slice(0, 80),
    time: clamp(finiteNumber(keyframe.time, 0), 0, state.motion.duration),
    transition: normalizeTransition(keyframe.transition),
    segment: sanitizeMotionSegment(keyframe.segment || keyframe.path, keyframe.source),
    pose: sanitizeSourcePose(keyframe.source, keyframe.pose || keyframe),
  };
}

function splitLegacyKeyframe(keyframe, index = 0) {
  const time = clamp(finiteNumber(keyframe.time, 0), 0, state.motion.duration);
  const keys = [];
  keys.push({
    id: uid(),
    source: "camera",
    label: keyframe.label || `키 ${index + 1}`,
    note: String(keyframe.note || "").trim().slice(0, 80),
    time,
    transition: normalizeTransition(keyframe.transition),
    segment: motionSegmentForPathMode("straight", "camera"),
    pose: sanitizeCameraPose(keyframe.camera),
  });
  sanitizeItemPoses(keyframe.items).forEach((item) => {
    if (!sourceExists(item.id)) return;
    keys.push({
      id: uid(),
      source: item.id,
      label: keyframe.label || `키 ${index + 1}`,
      note: String(keyframe.note || "").trim().slice(0, 80),
      time,
      transition: normalizeTransition(keyframe.transition),
      segment: motionSegmentForPathMode("straight", item.id),
      pose: item,
    });
  });
  return keys;
}

function motionSegmentForPathMode(value, sourceId = "camera") {
  const sourceType = sourceId === "camera" ? "camera" : "actor";
  const mode = normalizePathMode(value, sourceType);
  const base = {
    plan: { kind: "line" },
    elevation: { kind: "linear" },
    rig: "generic",
  };
  if (mode === "horizontal") base.plan.kind = "axis-x";
  if (mode === "vertical") base.plan.kind = "axis-y";
  if (mode === "arc-left" || mode === "arc-right") {
    base.plan = { kind: "arc", bulge: mode === "arc-left" ? 0.32 : -0.32 };
  }
  if (mode === "free-curve") base.plan = { kind: "bezier", control: null };
  if (mode === "drone") {
    base.rig = "drone";
  }
  if (mode === "jib-up" || mode === "jib-down") {
    base.elevation = { kind: "jib-arc", bulge: mode === "jib-up" ? 0.32 : -0.32 };
    base.rig = "jib";
  }
  return base;
}

function pathModeForSegment(segment, sourceId = "camera") {
  if (typeof segment === "string") return normalizePathMode(segment, sourceId === "camera" ? "camera" : "actor");
  if (segment?.rig === "drone" || segment?.elevation?.kind === "drone") return "drone";
  if (segment?.rig === "jib" || segment?.elevation?.kind === "jib-arc") {
    return Number(segment?.elevation?.bulge ?? 0.32) < 0 ? "jib-down" : "jib-up";
  }
  if (segment?.plan?.kind === "axis-x") return "horizontal";
  if (segment?.plan?.kind === "axis-y") return "vertical";
  if (segment?.plan?.kind === "arc") return Number(segment.plan.bulge ?? 0.32) < 0 ? "arc-right" : "arc-left";
  if (segment?.plan?.kind === "bezier") return "free-curve";
  return "straight";
}

function sanitizeMotionSegment(segment, sourceId = "camera") {
  const normalized = motionSegmentForPathMode(pathModeForSegment(segment, sourceId), sourceId);
  if (normalized.plan.kind === "arc") {
    const fallback = normalized.plan.bulge;
    normalized.plan.bulge = clamp(finiteNumber(segment?.plan?.bulge, fallback), -0.49, 0.49) || fallback;
  }
  if (normalized.plan.kind === "bezier") {
    const control = segment?.plan?.control;
    normalized.plan.control = Number.isFinite(Number(control?.x)) && Number.isFinite(Number(control?.y))
      ? { x: clamp(Number(control.x), -0.5, 1.5), y: clamp(Number(control.y), -0.5, 1.5) }
      : null;
  }
  if (normalized.elevation.kind === "jib-arc") {
    const fallback = normalized.elevation.bulge;
    normalized.elevation.bulge = clamp(finiteNumber(segment?.elevation?.bulge, fallback), -0.49, 0.49) || fallback;
  }
  return normalized;
}

function sanitizeSourcePose(sourceId, pose) {
  if (sourceId === "camera") return sanitizeCameraPose(pose);
  const fallback = state.items.find((item) => item.id === sourceId);
  const sanitized = sanitizeItemPose({ ...fallback, ...pose, id: sourceId });
  return preserveItemStructure(sanitized, fallback);
}

function preserveItemStructure(pose, definition) {
  if (!definition) return pose;
  return {
    ...pose,
    id: definition.id,
    continuityId: definition.continuityId || "",
    type: definition.type,
    name: definition.name,
    assetType: definition.assetType,
    placementMode: definition.placementMode || "manual",
    mountId: definition.mountId || "",
    seatIndex: Number(definition.seatIndex || 0),
    motionEnabled: definition.motionEnabled !== false,
    editLocked: definition.editLocked === true,
  };
}

function sanitizeCameraPose(camera) {
  if (!camera) return clone(state.camera);
  const orientation = cameraOrientationFromLegacy(camera, state);
  const sanitized = {
    x: clamp(finiteNumber(camera.x, state.camera.x), 0.02, 0.98),
    y: clamp(finiteNumber(camera.y, state.camera.y), 0.02, 0.98),
    height: clamp(finiteNumber(camera.height, state.camera.height ?? 1.6), 0.4, 3),
    panDeg: normalizePanDeg(Number.isFinite(Number(camera.panDeg)) ? camera.panDeg : orientation.panDeg),
    tiltDeg: clamp(Number.isFinite(Number(camera.tiltDeg)) ? Number(camera.tiltDeg) : orientation.tiltDeg, -60, 60),
    focal: clamp(finiteNumber(camera.focal, state.camera.focal), 14, 135),
    trackingTargetId: sanitizeTrackingTargetId(camera.trackingTargetId ?? state.camera.trackingTargetId, state),
    locks: sanitizeCameraLocks(camera.locks ?? state.camera.locks),
  };
  return syncCameraDerivedAim(sanitized, state);
}

function sanitizeTrackingTargetId(value, renderState = state) {
  const id = String(value || "");
  return id && renderState.items?.some((item) => item.id === id) ? id : "";
}

function trackingOrientation(item, camera = state.camera, renderState = state) {
  if (!item) return { panDeg: camera.panDeg, tiltDeg: camera.tiltDeg };
  const size = stageWorldSize(renderState);
  const dx = (item.x - camera.x) * size.width;
  const dz = (item.y - camera.y) * size.depth;
  const horizontalDistance = Math.max(0.05, Math.hypot(dx, dz));
  const subjectHeight = item.type === "actor"
    ? 1.78 * Number(item.size || 1)
    : propDefinition(item.assetType).height * Number(item.size || 1) * Number(item.scaleY || 1) * 0.55;
  const aspect = aspectMap[renderState.aspect] || 16 / 9;
  const verticalFov = degToRad(horizontalFovToVerticalFov(focalToFov(camera.focal), aspect));
  const faceAngle = Math.atan2(subjectHeight - Number(camera.height || 1.6), horizontalDistance);
  const framingOffset = Math.atan(
    (0.5 - CINEMATIC_FACE_SCREEN_Y) * 2 * Math.tan(verticalFov / 2),
  );
  return {
    panDeg: normalizePanDeg(radToDeg(Math.atan2(dz, dx))),
    tiltDeg: clamp(radToDegSigned(faceAngle - framingOffset), -60, 60),
  };
}

function applyCameraTracking(renderState) {
  if (cameraFieldLocked("orientation", renderState)) {
    if (renderState.camera) renderState.camera.trackingTargetId = "";
    return renderState;
  }
  const targetId = sanitizeTrackingTargetId(renderState.camera?.trackingTargetId, renderState);
  if (!targetId) {
    if (renderState.camera) renderState.camera.trackingTargetId = "";
    return renderState;
  }
  const targetItem = renderState.items.find((item) => item.id === targetId);
  const target = targetItem ? resolvedItemPose(targetItem, renderState) : null;
  if (!target) return renderState;
  renderState.camera.trackingTargetId = targetId;
  const orientation = trackingOrientation(target, renderState.camera, renderState);
  renderState.camera.panDeg = orientation.panDeg;
  renderState.camera.tiltDeg = orientation.tiltDeg;
  syncCameraDerivedAim(renderState.camera, renderState);
  return renderState;
}

function sanitizeItemPoses(items) {
  if (!Array.isArray(items)) return clone(state.items);
  return items.map((item) => sanitizeItemPose(item));
}

function sanitizeItemPose(item) {
  const type = item.type === "prop" ? "prop" : "actor";
  const assetType = type === "prop" && propCatalog[item.assetType] ? item.assetType : "generic";
  return {
    id: item.id || uid(),
    continuityId: String(item.continuityId || ""),
    type,
    name: item.name || (type === "prop" ? propCatalog[assetType].label : "배우"),
    x: clamp(finiteNumber(item.x, 0.5), 0.02, 0.98),
    y: clamp(finiteNumber(item.y, 0.5), 0.02, 0.98),
    size: clamp(finiteNumber(item.size, 1), 0.25, 4),
    color: item.color || colors[0],
    shape: item.shape || "circle",
    facing: finiteNumber(item.facing, 0) % 360,
    bodyPose: type === "actor" ? sanitizeBodyPose(item.bodyPose) : null,
    assetType,
    scaleX: clamp(finiteNumber(item.scaleX, 1), 0.25, 3.5),
    scaleY: clamp(finiteNumber(item.scaleY, 1), 0.25, 3.5),
    scaleZ: clamp(finiteNumber(item.scaleZ, 1), 0.25, 3.5),
    placementMode: type === "actor" && (item.placementMode === "auto" || item.mountId) ? "auto" : "manual",
    mountId: type === "actor" ? String(item.mountId || "") : "",
    seatIndex: type === "actor" ? Math.max(0, Math.round(finiteNumber(item.seatIndex, 0))) : 0,
    motionEnabled: item.motionEnabled !== false,
    editLocked: item.editLocked === true,
    presetInstanceId: String(item.presetInstanceId || ""),
    visible: item.visible !== false,
  };
}

function propDefinition(assetType) {
  return propCatalog[assetType] || propCatalog.generic;
}

function isVehicleProp(item) {
  return Boolean(item?.type === "prop" && propDefinition(item.assetType).kind === "vehicle");
}

function vehicleProps(renderState = state) {
  return (renderState.items || []).filter(isVehicleProp);
}

function sanitizeAutoMountRelationships(renderState = state) {
  const vehicles = new Map(vehicleProps(renderState).map((item) => [item.id, item]));
  const occupiedByVehicle = new Map();
  renderState.items.forEach((item) => {
    if (item.type !== "actor") return;
    if (item.placementMode !== "auto") {
      item.mountId = "";
      item.seatIndex = 0;
      return;
    }
    const vehicle = vehicles.get(item.mountId);
    if (!vehicle) {
      item.mountId = "";
      item.seatIndex = 0;
      return;
    }
    const seats = propDefinition(vehicle.assetType).seats || [];
    const occupied = occupiedByVehicle.get(vehicle.id) || new Set();
    let seatIndex = clamp(Math.round(Number(item.seatIndex || 0)), 0, Math.max(0, seats.length - 1));
    if (occupied.has(seatIndex)) seatIndex = seats.findIndex((seat, index) => !occupied.has(index));
    if (!seats.length || seatIndex < 0) {
      item.mountId = "";
      item.seatIndex = 0;
      return;
    }
    item.seatIndex = seatIndex;
    occupied.add(seatIndex);
    occupiedByVehicle.set(vehicle.id, occupied);
  });
}

function detachAutoMountedActors(vehicleId, renderState = state) {
  renderState.items
    .filter((item) => item.type === "actor" && item.placementMode === "auto" && item.mountId === vehicleId)
    .forEach((actor) => {
      const pose = resolvedLegacyMountedPose(actor, renderState);
      actor.x = pose.x;
      actor.y = pose.y;
      actor.facing = pose.facing;
      actor.mountId = "";
      actor.seatIndex = 0;
    });
}

function resolvedLegacyMountedPose(item, renderState = state) {
  if (item?.type !== "actor" || !item.mountId) return item;
  const vehicle = renderState.items.find((entry) => entry.id === item.mountId && isVehicleProp(entry));
  if (!vehicle) return item;
  const definition = propDefinition(vehicle.assetType);
  const seat = definition.seats?.[clamp(Math.round(Number(item.seatIndex || 0)), 0, Math.max(0, (definition.seats?.length || 1) - 1))];
  if (!seat) return item;
  const size = stageWorldSize(renderState);
  const angle = degToRad(vehicle.facing || 0);
  const forward = Number(seat.x || 0) * Number(vehicle.size || 1) * Number(vehicle.scaleX || 1);
  const lateral = Number(seat.z || 0) * Number(vehicle.size || 1) * Number(vehicle.scaleZ || 1);
  const worldX = (vehicle.x - 0.5) * size.width + Math.cos(angle) * forward - Math.sin(angle) * lateral;
  const worldZ = (vehicle.y - 0.5) * size.depth + Math.sin(angle) * forward + Math.cos(angle) * lateral;
  return {
    ...item,
    x: clamp(worldX / size.width + 0.5, 0.02, 0.98),
    y: clamp(worldZ / size.depth + 0.5, 0.02, 0.98),
    facing: (Number(vehicle.facing || 0) + Number(seat.facing || 0) + 360) % 360,
    autoMounted: true,
    mountedHeight: Number(seat.y || 0.7) * Number(vehicle.size || 1) * Number(vehicle.scaleY || 1),
  };
}

function sanitizeManualGroups(groups, renderState = state) {
  const itemIds = new Set((renderState.items || []).map((item) => item.id));
  const claimed = new Set();
  return (Array.isArray(groups) ? groups : []).map((group) => {
    const memberIds = [...new Set((group.members || []).map((member) => member.itemId))]
      .filter((itemId) => {
        const item = renderState.items.find((entry) => entry.id === itemId);
        return itemIds.has(itemId) && !claimed.has(itemId) && !(item?.type === "actor" && item.placementMode === "auto");
      });
    if (!memberIds.includes(group.leaderId) && itemIds.has(group.leaderId) && !claimed.has(group.leaderId)) {
      memberIds.unshift(group.leaderId);
    }
    if (memberIds.length < 2 || !memberIds.includes(group.leaderId)) return null;
    const sourceMembers = new Map((group.members || []).map((member) => [member.itemId, member]));
    const members = memberIds.map((itemId) => {
      claimed.add(itemId);
      const member = sourceMembers.get(itemId) || {};
      return {
        itemId,
        offsetX: Number(member.offsetX || 0),
        offsetZ: Number(member.offsetZ || 0),
        facingOffset: Number(member.facingOffset || 0),
      };
    });
    return { id: String(group.id || uid()), leaderId: group.leaderId, members };
  }).filter(Boolean);
}

function groupForItem(itemId, renderState = state) {
  return (renderState.groups || []).find((group) => group.members.some((member) => member.itemId === itemId)) || null;
}

function groupLeaderIdForItem(itemId, renderState = state) {
  return groupForItem(itemId, renderState)?.leaderId || itemId;
}

function transformLeaderIdForItem(itemId, renderState = state) {
  const item = renderState.items.find((entry) => entry.id === itemId);
  if (item?.type === "actor" && item.placementMode === "auto" && item.mountId) return item.mountId;
  return groupLeaderIdForItem(itemId, renderState);
}

function isGroupLeader(item, renderState = state) {
  const group = item ? groupForItem(item.id, renderState) : null;
  return !group || group.leaderId === item.id;
}

function groupMemberRecord(itemId, renderState = state) {
  return groupForItem(itemId, renderState)?.members.find((member) => member.itemId === itemId) || null;
}

function groupMemberFromPose(item, leader, renderState = state) {
  const size = stageWorldSize(renderState);
  const dx = (item.x - leader.x) * size.width;
  const dz = (item.y - leader.y) * size.depth;
  const angle = degToRad(leader.facing || 0);
  return {
    itemId: item.id,
    offsetX: Math.cos(angle) * dx + Math.sin(angle) * dz,
    offsetZ: -Math.sin(angle) * dx + Math.cos(angle) * dz,
    facingOffset: ((Number(item.facing || 0) - Number(leader.facing || 0) + 540) % 360) - 180,
  };
}

function resolvedItemPose(item, renderState = state) {
  if (item?.type === "actor" && item.placementMode === "auto" && item.mountId) {
    return resolvedLegacyMountedPose(item, renderState);
  }
  const group = item ? groupForItem(item.id, renderState) : null;
  if (!group || group.leaderId === item.id) return item;
  const leader = renderState.items.find((entry) => entry.id === group.leaderId);
  const member = group.members.find((entry) => entry.itemId === item.id);
  if (!leader || !member) return item;
  const size = stageWorldSize(renderState);
  const angle = degToRad(leader.facing || 0);
  const dx = Math.cos(angle) * member.offsetX - Math.sin(angle) * member.offsetZ;
  const dz = Math.sin(angle) * member.offsetX + Math.cos(angle) * member.offsetZ;
  return {
    ...item,
    x: clamp(leader.x + dx / size.width, 0.02, 0.98),
    y: clamp(leader.y + dz / size.depth, 0.02, 0.98),
    facing: (Number(leader.facing || 0) + Number(member.facingOffset || 0) + 360) % 360,
    grouped: true,
  };
}

function migrateLegacyMountsToGroups(renderState = state) {
  const legacyActors = renderState.items.filter((item) => item.type === "actor" && item.mountId && item.placementMode !== "auto");
  legacyActors.forEach((actor) => {
    const vehicle = renderState.items.find((item) => item.id === actor.mountId && isVehicleProp(item));
    const pose = resolvedLegacyMountedPose(actor, renderState);
    actor.x = pose.x;
    actor.y = pose.y;
    actor.facing = pose.facing;
    actor.mountId = "";
    actor.seatIndex = 0;
    if (!vehicle) return;
    let group = (renderState.groups || []).find((entry) => entry.leaderId === vehicle.id);
    if (!group) {
      group = {
        id: uid(),
        leaderId: vehicle.id,
        members: [groupMemberFromPose(vehicle, vehicle, renderState)],
      };
      renderState.groups.push(group);
    }
    if (!group.members.some((member) => member.itemId === actor.id)) {
      group.members.push(groupMemberFromPose(actor, vehicle, renderState));
    }
    if (renderState.motion?.keyframes) {
      renderState.motion.keyframes = renderState.motion.keyframes.filter((keyframe) => keyframe.source !== actor.id);
    }
  });
}

function dissolveManualGroup(groupId, renderState = state) {
  const group = (renderState.groups || []).find((entry) => entry.id === groupId);
  if (!group) return;
  group.members.forEach((member) => {
    const item = renderState.items.find((entry) => entry.id === member.itemId);
    if (!item) return;
    const pose = resolvedItemPose(item, renderState);
    item.x = pose.x;
    item.y = pose.y;
    item.facing = pose.facing;
  });
  renderState.groups = renderState.groups.filter((entry) => entry.id !== groupId);
}

function createManualGroup(itemIds, preferredLeaderId = "", renderState = state) {
  const members = [...new Set(itemIds)]
    .map((itemId) => renderState.items.find((item) => item.id === itemId))
    .filter(Boolean)
    .filter((item) => !sourceEditLocked(item.id, renderState))
    .filter((item) => !groupForItem(item.id, renderState));
  if (members.length < 2) return null;
  const leader = members.find((item) => isVehicleProp(item))
    || members.find((item) => item.id === preferredLeaderId)
    || members[0];
  const group = {
    id: uid(),
    leaderId: leader.id,
    members: members.map((item) => groupMemberFromPose(item, leader, renderState)),
  };
  renderState.groups.push(group);
  const followerIds = new Set(members.filter((item) => item.id !== leader.id).map((item) => item.id));
  renderState.motion.keyframes = (renderState.motion.keyframes || []).filter((keyframe) => !followerIds.has(keyframe.source));
  return group;
}

function sortKeyframes(keyframes = state.motion.keyframes) {
  return [...keyframes]
    .sort((a, b) => a.time - b.time || sourceLabel(a.source).localeCompare(sourceLabel(b.source)) || a.label.localeCompare(b.label))
    .map((keyframe, index) => ({
      ...keyframe,
    label: keyframe.label || `키 ${index + 1}`,
    }));
}

function selectedKeyframeExists(id) {
  return Boolean(id && state.motion.keyframes?.some((keyframe) => keyframe.id === id));
}

function selectedKeyframe() {
  return state.motion.keyframes.find((keyframe) => keyframe.id === state.motion.selectedKeyId) || null;
}

function nearestKeyframe(keyframes, time = state.motion.playhead) {
  if (!keyframes.length) return null;
  return keyframes.reduce((best, keyframe) => {
    const bestDistance = Math.abs(best.time - time);
    const nextDistance = Math.abs(keyframe.time - time);
    return nextDistance < bestDistance ? keyframe : best;
  }, keyframes[0]);
}

function selectKeyForSource(sourceId, time = state.motion.playhead) {
  const keyframe = sourceId === "all"
    ? nearestKeyframe(sortKeyframes(state.motion.keyframes), time)
    : nearestKeyframe(keysForSource(sourceId), time);
  state.motion.selectedKeyId = keyframe?.id || null;
  return keyframe;
}

function applyKeyframeToStage(keyframe) {
  if (!keyframe) return;
  applySourcePose(keyframe.source, keyframe.pose);
  state.motion.playhead = keyframe.time;
  state.motion.selectedKeyId = keyframe.id;
}

function applySourcePose(sourceId, pose) {
  if (sourceId === "camera") {
    const trackingTargetId = state.camera.trackingTargetId || "";
    const locks = sanitizeCameraLocks(state.camera.locks);
    state.camera = sanitizeCameraPose(pose);
    state.camera.locks = locks;
    state.camera.trackingTargetId = sanitizeTrackingTargetId(trackingTargetId, state);
    applyCameraTracking(state);
    return;
  }
  const itemIndex = state.items.findIndex((item) => item.id === sourceId);
  if (itemIndex === -1) return;
  state.items[itemIndex] = { ...state.items[itemIndex], ...sanitizeSourcePose(sourceId, pose) };
}

function updateStageZoomControls() {
  const label = $("#stageZoomLabel");
  if (label) label.textContent = `${Math.round(stageZoom * 100)}%`;
  const outButton = $("#stageZoomOutBtn");
  const inButton = $("#stageZoomInBtn");
  if (outButton) outButton.disabled = stageZoom <= STAGE_ZOOM_MIN + 0.001;
  if (inButton) inButton.disabled = stageZoom >= STAGE_ZOOM_MAX - 0.001;
  stageViewport?.classList.toggle("is-zoomed", stageZoom > STAGE_ZOOM_MIN + 0.001);
}

function layoutStageCanvas({ preserveCenter = true } = {}) {
  if (!stageViewport || !stageCanvasHolder || stageViewport.hidden || viewMode !== "2d") return;
  const viewportWidth = stageViewport.clientWidth;
  const viewportHeight = stageViewport.clientHeight;
  if (viewportWidth < 1 || viewportHeight < 1) return;
  const oldScrollWidth = Math.max(1, stageViewport.scrollWidth);
  const oldScrollHeight = Math.max(1, stageViewport.scrollHeight);
  const centerX = (stageViewport.scrollLeft + viewportWidth / 2) / oldScrollWidth;
  const centerY = (stageViewport.scrollTop + viewportHeight / 2) / oldScrollHeight;
  const ratio = aspectMap[state.aspect] || 16 / 9;
  const fitWidth = Math.max(240, Math.min(viewportWidth, viewportHeight * ratio));
  const fitHeight = fitWidth / ratio;
  const canvasWidth = Math.max(240, Math.round(fitWidth * stageZoom));
  const canvasHeight = Math.max(180, Math.round(fitHeight * stageZoom));
  const holderWidth = Math.max(viewportWidth, canvasWidth);
  const holderHeight = Math.max(viewportHeight, canvasHeight);
  stageCanvasHolder.style.width = `${holderWidth}px`;
  stageCanvasHolder.style.height = `${holderHeight}px`;
  canvas.style.width = `${canvasWidth}px`;
  canvas.style.height = `${canvasHeight}px`;
  canvas.style.left = `${Math.round((holderWidth - canvasWidth) / 2)}px`;
  canvas.style.top = `${Math.round((holderHeight - canvasHeight) / 2)}px`;
  if (preserveCenter) {
    stageViewport.scrollLeft = centerX * holderWidth - viewportWidth / 2;
    stageViewport.scrollTop = centerY * holderHeight - viewportHeight / 2;
  }
  updateStageZoomControls();
}

function resizeCanvas(options = {}) {
  if (options.layout !== false) layoutStageCanvas({ preserveCenter: options.preserveCenter !== false });
  const rect = canvas.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) {
    resizeThreeView();
    return;
  }
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  draw();
  resizeThreeView();
}

function setStageZoom(nextZoom, anchor = null) {
  const next = clamp(Number(nextZoom), STAGE_ZOOM_MIN, STAGE_ZOOM_MAX);
  if (Math.abs(next - stageZoom) < 0.001) return;
  const viewportRect = stageViewport.getBoundingClientRect();
  const canvasRect = canvas.getBoundingClientRect();
  const anchorX = anchor ? clamp(anchor.clientX - viewportRect.left, 0, viewportRect.width) : viewportRect.width / 2;
  const anchorY = anchor ? clamp(anchor.clientY - viewportRect.top, 0, viewportRect.height) : viewportRect.height / 2;
  const normalizedX = canvasRect.width
    ? clamp((viewportRect.left + anchorX - canvasRect.left) / canvasRect.width, 0, 1)
    : 0.5;
  const normalizedY = canvasRect.height
    ? clamp((viewportRect.top + anchorY - canvasRect.top) / canvasRect.height, 0, 1)
    : 0.5;
  stageZoom = next;
  layoutStageCanvas({ preserveCenter: false });
  resizeCanvas({ layout: false });
  stageViewport.scrollLeft = canvas.offsetLeft + normalizedX * canvas.clientWidth - anchorX;
  stageViewport.scrollTop = canvas.offsetTop + normalizedY * canvas.clientHeight - anchorY;
}

function centerStageOnContent(renderState = state) {
  if (!stageViewport || stageViewport.hidden || viewMode !== "2d") return;
  const points = [renderState.camera, ...(renderState.items || []).filter((item) => item.visible !== false)];
  if (!points.length) return;
  const xs = points.map((point) => clamp(Number(point.x ?? 0.5), 0, 1));
  const ys = points.map((point) => clamp(Number(point.y ?? 0.5), 0, 1));
  const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
  const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
  stageViewport.scrollLeft = canvas.offsetLeft + centerX * canvas.clientWidth - stageViewport.clientWidth / 2;
  stageViewport.scrollTop = canvas.offsetTop + centerY * canvas.clientHeight - stageViewport.clientHeight / 2;
}

function computeStageRect(width = canvas.clientWidth, height = canvas.clientHeight, aspect = state.aspect) {
  const padding = 9;
  let w = Math.max(200, width - padding * 2);
  let h = Math.max(200, height - padding * 2);
  const target = aspectMap[aspect] || 16 / 9;
  if (w / h > target) {
    w = h * target;
  } else {
    h = w / target;
  }
  return {
    x: (width - w) / 2,
    y: (height - h) / 2,
    w,
    h,
  };
}

function toCanvas(point, rect = stageRect) {
  return {
    x: rect.x + point.x * rect.w,
    y: rect.y + point.y * rect.h,
  };
}

function fromCanvas(point, rect = stageRect) {
  return {
    x: clamp((point.x - rect.x) / rect.w, 0.02, 0.98),
    y: clamp((point.y - rect.y) / rect.h, 0.02, 0.98),
  };
}

function draw(renderState = evaluatedViewState || state, options = {}) {
  const width = canvas.clientWidth || canvas.width;
  const height = canvas.clientHeight || canvas.height;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#101216";
  ctx.fillRect(0, 0, width, height);

  stageRect = computeStageRect(width, height, renderState.aspect);
  drawStage(renderState, stageRect, options);
  renderThreeView(renderState);
}

function drawStage(renderState, rect, options = {}) {
  const clean = options.clean ?? false;
  ctx.save();
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 2);
  ctx.clip();
  ctx.fillStyle = "#0d1116";
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

  if (renderState.showGrid && !(clean && renderState.cleanExport)) drawGrid(rect, renderState);
  if (renderState.showCamera) drawCameraCone(renderState.camera, rect, clean);
  if (!(clean && renderState.cleanExport)) drawMotionPaths(renderState, rect);

  const sorted = [...renderState.items].sort((a, b) => resolvedItemPose(a, renderState).y - resolvedItemPose(b, renderState).y);
  sorted.forEach((item) => drawItem(item, rect, renderState, clean));
  drawCamera(renderState.camera, rect, clean);

  if (!(clean && renderState.cleanExport)) drawFooter(renderState, rect);
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = "#3a3d45";
  ctx.lineWidth = 1.5;
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 2);
  ctx.stroke();
  ctx.restore();
}

function stageWorldSize(renderState = state) {
  const ratio = aspectMap[renderState.aspect] || 16 / 9;
  if (ratio >= 1) return { width: STAGE_WORLD_LONG_EDGE, depth: STAGE_WORLD_LONG_EDGE / ratio };
  return { width: STAGE_WORLD_LONG_EDGE * ratio, depth: STAGE_WORLD_LONG_EDGE };
}

function mapToWorld(point, renderState = state, y = 0) {
  const size = stageWorldSize(renderState);
  return new window.THREE.Vector3(
    (point.x - 0.5) * size.width,
    y,
    (point.y - 0.5) * size.depth,
  );
}

function worldToStage(point, renderState = state) {
  const size = stageWorldSize(renderState);
  return {
    x: clamp(point.x / size.width + 0.5, 0.02, 0.98),
    y: clamp(point.z / size.depth + 0.5, 0.02, 0.98),
  };
}

function initThreeView() {
  if (threeView) return Boolean(threeView.ready);
  const wrap = $("#threeWrap");
  const canvas3d = $("#threeCanvas");
  const hud = $("#threeHud");
  const hudMeta = $("#threeHudMeta");
  const frameWrap = $("#cameraFrame");
  const frameCanvas = $("#cameraFrameCanvas");
  const THREE = window.THREE;
  if (!THREE) {
    if (hudMeta) hudMeta.textContent = "3D 엔진을 불러오지 못했습니다";
    threeView = { ready: false };
    return false;
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#111820");
  scene.fog = new THREE.Fog("#111820", 24, 64);

  const camera3d = new THREE.PerspectiveCamera(48, 1, 0.1, 100);
  const renderer = new THREE.WebGLRenderer({
    canvas: canvas3d,
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const frameCamera = new THREE.PerspectiveCamera(42, 16 / 9, 0.05, 100);
  const frameRenderer = new THREE.WebGLRenderer({
    canvas: frameCanvas,
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true,
  });
  frameRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  frameRenderer.outputColorSpace = THREE.SRGBColorSpace;
  frameRenderer.shadowMap.enabled = true;
  frameRenderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const world = new THREE.Group();
  scene.add(world);
  scene.add(new THREE.HemisphereLight("#dff7ff", "#283038", 1.42));
  const keyLight = new THREE.DirectionalLight("#fff8ed", 1.7);
  keyLight.position.set(5, 8, 4);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.camera.left = -18;
  keyLight.shadow.camera.right = 18;
  keyLight.shadow.camera.top = 18;
  keyLight.shadow.camera.bottom = -18;
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight("#7ec8ff", 0.72);
  fillLight.position.set(-4, 4, -6);
  scene.add(fillLight);

  const raycaster = new THREE.Raycaster();
  raycaster.params.Line.threshold = 0.06;
  raycaster.params.Points.threshold = 0.08;

  threeView = {
    ready: true,
    wrap,
    canvas: canvas3d,
    hud,
    hudMeta,
    scene,
    camera: camera3d,
    renderer,
    world,
    frameWrap,
    frameCanvas,
    frameCamera,
    frameRenderer,
    cameraRigHelper: null,
    raycaster,
    orbit: { theta: -0.62, phi: 0.68, radius: 21.3, target: new THREE.Vector3(0, 1.15, 0) },
    lastState: null,
  };

  canvas3d.addEventListener("pointerdown", beginThreeDrag);
  canvas3d.addEventListener("pointermove", updateThreeDrag);
  canvas3d.addEventListener("pointerup", endThreeDrag);
  canvas3d.addEventListener("pointercancel", cancelThreeDrag);
  canvas3d.addEventListener("wheel", zoomThreeView, { passive: false });
  canvas3d.addEventListener("contextmenu", (event) => {
    event.preventDefault();
  });
  resizeThreeView();
  return true;
}

function disposeThreeObject(object) {
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  object.traverse((child) => {
    if (child.geometry) geometries.add(child.geometry);
    if (child.material) {
      const childMaterials = Array.isArray(child.material) ? child.material : [child.material];
      childMaterials.forEach((material) => {
        materials.add(material);
        if (material.map) textures.add(material.map);
      });
    }
  });
  geometries.forEach((geometry) => geometry.dispose?.());
  textures.forEach((texture) => texture.dispose?.());
  materials.forEach((material) => material.dispose?.());
}

function clearThreeWorld() {
  if (!threeView?.ready) return;
  while (threeView.world.children.length) {
    const child = threeView.world.children.pop();
    disposeThreeObject(child);
  }
  threeView.cameraRigHelper = null;
}

function resizeThreeView() {
  if (!threeView?.ready) return;
  const rect = threeView.wrap.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  threeView.camera.aspect = width / height;
  threeView.camera.updateProjectionMatrix();
  threeView.renderer.setSize(width, height, false);
  threeView.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  if (threeView.frameRenderer && threeView.frameWrap) {
    const frameRect = threeView.frameWrap.getBoundingClientRect();
    const frameWidth = Math.max(1, frameRect.width);
    const frameHeight = Math.max(1, frameRect.height);
    threeView.frameCamera.aspect = frameWidth / frameHeight;
    threeView.frameCamera.updateProjectionMatrix();
    threeView.frameRenderer.setSize(frameWidth, frameHeight, false);
    threeView.frameRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  }
  renderThreeView(threeView.lastState || state, true);
}

function renderThreeView(renderState = state, force = false, frameOptions = {}) {
  if (viewMode !== "3d" && !force) return;
  if (!initThreeView()) return;
  const THREE = window.THREE;
  threeView.lastState = renderState;
  clearThreeWorld();

  const world = threeView.world;
  const size = stageWorldSize(renderState);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(size.width, size.depth),
    new THREE.MeshStandardMaterial({
      color: "#1a2229",
      roughness: 0.88,
      metalness: 0.02,
      side: THREE.DoubleSide,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  world.add(floor);
  world.add(makeStageGrid(size));
  world.add(makeStageBorder(size));
  drawThreeMotionPaths(renderState, world);
  renderState.items.filter((item) => item.visible !== false).forEach((item) => world.add(makeThreeItem(item, renderState)));
  const cameraRig = makeThreeCamera(renderState.camera, renderState);
  threeView.cameraRigHelper = cameraRig;
  world.add(cameraRig);

  updateThreeCamera(renderState);
  if (threeView.hudMeta) {
    const keyCount = renderState.motion?.keyframes?.length || 0;
    const stageSize = stageWorldSize(renderState);
    threeView.hudMeta.textContent = `${renderState.aspect} · 무대 ${Math.round(stageSize.width)}×${Math.round(stageSize.depth)}m · 대상 ${renderState.items.length} · 키 ${keyCount}`;
  }
  threeView.renderer.render(threeView.scene, threeView.camera);
  renderCameraFramePreview(renderState, frameOptions);
}

function makeStageGrid(size) {
  const THREE = window.THREE;
  const group = new THREE.Group();
  group.userData.previewHidden = true;
  const minorMaterial = new THREE.LineBasicMaterial({ color: "#66727d", transparent: true, opacity: 0.2 });
  const majorMaterial = new THREE.LineBasicMaterial({ color: "#91a0ac", transparent: true, opacity: 0.38 });
  const centerMaterial = new THREE.LineBasicMaterial({ color: "#d7e2e8", transparent: true, opacity: 0.46 });
  const xDivisions = Math.max(8, Math.round(size.width / STAGE_GRID_STEP_METERS));
  const zDivisions = Math.max(6, Math.round(size.depth / STAGE_GRID_STEP_METERS));
  const xStep = size.width / xDivisions;
  const zStep = size.depth / zDivisions;
  for (let i = 0; i <= xDivisions; i += 1) {
    const x = -size.width / 2 + xStep * i;
    group.add(lineFromPoints([
      new THREE.Vector3(x, 0.025, -size.depth / 2),
      new THREE.Vector3(x, 0.025, size.depth / 2),
    ], i === Math.round(xDivisions / 2) ? centerMaterial : i % 4 === 0 ? majorMaterial : minorMaterial));
  }
  for (let i = 0; i <= zDivisions; i += 1) {
    const z = -size.depth / 2 + zStep * i;
    group.add(lineFromPoints([
      new THREE.Vector3(-size.width / 2, 0.025, z),
      new THREE.Vector3(size.width / 2, 0.025, z),
    ], i % 3 === 0 ? majorMaterial : minorMaterial));
  }
  return group;
}

function makeStageBorder(size) {
  const THREE = window.THREE;
  const material = new THREE.LineBasicMaterial({ color: "#91a9b7", transparent: true, opacity: 0.68 });
  const y = 0.04;
  const border = lineFromPoints([
    new THREE.Vector3(-size.width / 2, y, -size.depth / 2),
    new THREE.Vector3(size.width / 2, y, -size.depth / 2),
    new THREE.Vector3(size.width / 2, y, size.depth / 2),
    new THREE.Vector3(-size.width / 2, y, size.depth / 2),
    new THREE.Vector3(-size.width / 2, y, -size.depth / 2),
  ], material);
  border.userData.previewHidden = true;
  return border;
}

function lineFromPoints(points, material) {
  const THREE = window.THREE;
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material);
}

function makeThreeItem(item, renderState) {
  const THREE = window.THREE;
  const group = new THREE.Group();
  group.name = "item:" + item.id;
  const itemEditor = { kind: "item", id: item.id };
  const renderItem = resolvedItemPose(item, renderState);
  const pos = mapToWorld(renderItem, renderState, Number(renderItem.mountedHeight || 0));
  group.position.set(pos.x, pos.y, pos.z);
  const color = new THREE.Color(item.color);
  const scale = item.size || 1;

  let body;
  if (item.type === "actor") {
    body = makeThreeActorModel(scale, color, actorBodyPoseForRender(renderItem), {
      showPoseHandles: threeEditMode === "pose" && selected?.kind === "item" && selected.id === item.id,
      selectedJoint: selectedPoseActorId === item.id ? selectedPoseJoint : "",
    });
    if (renderItem.autoMounted) body.position.y = -0.79 * scale;
  } else {
    body = makeThreePropModel(item, color);
    body.scale.set(
      scale * Number(item.scaleX || 1),
      scale * Number(item.scaleY || 1),
      scale * Number(item.scaleZ || 1),
    );
  }
  group.add(body);
  body.traverse((object) => {
    if (object.isMesh) {
      object.castShadow = true;
      object.userData.editor = itemEditor;
      if (item.type === "actor" && object.userData.jointId) {
        object.userData.poseJoint = { actorId: item.id, jointId: object.userData.jointId };
      }
    }
  });

  const roleColor = item.type === "actor" ? "#58d7ca" : "#f2bd62";
  const definition = propDefinition(item.assetType);
  const footprintScale = item.type === "actor"
    ? 1
    : Math.sqrt(definition.footprint || 0.7) * Math.max(Number(item.scaleX || 1), Number(item.scaleZ || 1));
  const baseRadius = (item.type === "actor" ? 0.45 : 0.52 * footprintScale) * scale;
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(baseRadius, baseRadius, 0.045, 36),
    new THREE.MeshBasicMaterial({ color: "#091014", transparent: true, opacity: 0.72 }),
  );
  base.position.y = 0.024;
  base.userData.previewHidden = true;
  base.userData.editor = itemEditor;
  const baseRing = new THREE.Mesh(
    new THREE.TorusGeometry(baseRadius, 0.025, 8, 44),
    new THREE.MeshBasicMaterial({ color: roleColor, transparent: true, opacity: 0.86 }),
  );
  baseRing.rotation.x = Math.PI / 2;
  baseRing.position.y = 0.05;
  baseRing.userData.previewHidden = true;
  baseRing.userData.editor = itemEditor;
  if (!renderItem.autoMounted && definition.kind !== "architecture") group.add(base, baseRing);

  const angle = degToRad(renderItem.facing);
  if (item.type === "actor") body.rotation.y = Math.PI / 2 - angle;
  else body.rotation.y = -angle;
  const direction = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)).normalize();
  const showDirection = item.type === "actor" || !["nature", "architecture"].includes(definition.kind);
  if (showDirection) {
    const arrowHeight = item.type === "actor" ? (renderItem.autoMounted ? 0.9 : 1.48) * scale : Math.min(1.5, definition.height * 0.7) * scale;
    const arrow = new THREE.ArrowHelper(direction, new THREE.Vector3(0, arrowHeight, 0), 0.78 * scale, roleColor, 0.22 * scale, 0.13 * scale);
    arrow.userData.previewHidden = true;
    group.add(arrow);
  }
  const roleLabel = item.type === "actor" ? "배우" : "소품";
  const typeLabel = item.type === "prop" && item.assetType !== "generic" ? definition.label + " · " : "";
  const label = makeThreeWorldLabel(roleLabel + " · " + typeLabel + item.name, roleColor);
  label.position.y = item.type === "actor"
    ? (renderItem.autoMounted ? 1.55 : 2.16) * scale
    : Math.min(4.8, definition.height * Number(item.scaleY || 1) * scale + 0.5);
  if (renderState.showNames && selected?.kind === "item" && selected.id === item.id) group.add(label);
  if (selected?.kind === "item" && selected.id === item.id) {
    group.add(makeThreeSelectionRing(item.type === "actor" ? 0.56 * scale : 0.62 * scale, roleColor));
  }
  return group;
}

function makeThreePropModel(item, color) {
  const THREE = window.THREE;
  const group = new THREE.Group();
  const assetType = item.assetType || "generic";
  const main = new THREE.MeshStandardMaterial({ color, roughness: 0.58, metalness: 0.08 });
  const light = new THREE.MeshStandardMaterial({ color: color.clone().lerp(new THREE.Color("#ffffff"), 0.3), roughness: 0.5, metalness: 0.06 });
  const dark = new THREE.MeshStandardMaterial({ color: "#182128", roughness: 0.72, metalness: 0.12 });
  const glass = new THREE.MeshStandardMaterial({
    color: "#8fd4ed", transparent: true, opacity: 0.42, roughness: 0.18, metalness: 0.05, depthWrite: false,
  });
  const wood = new THREE.MeshStandardMaterial({ color: "#79543b", roughness: 0.88, metalness: 0.01 });
  const leaf = new THREE.MeshStandardMaterial({ color: color.clone().lerp(new THREE.Color("#2e8c57"), 0.45), roughness: 0.9, metalness: 0 });
  const screen = new THREE.MeshStandardMaterial({ color: "#101a22", emissive: "#0b2735", roughness: 0.25, metalness: 0.1 });

  const add = (geometry, material, position = [0, 0, 0], rotation = null) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    if (rotation) mesh.rotation.set(...rotation);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };
  const box = (dimensions, material, position, rotation) => add(new THREE.BoxGeometry(...dimensions), material, position, rotation);
  const cylinder = (radius, height, material, position, rotation, segments = 18) => add(
    new THREE.CylinderGeometry(radius, radius, height, segments), material, position, rotation,
  );
  const wheel = (x, y, z, radius = 0.36, width = 0.22) => cylinder(radius, width, dark, [x, y, z], [Math.PI / 2, 0, 0], 20);

  if (assetType === "car") {
    box([3.8, 0.55, 1.7], main, [0, 0.55, 0]);
    box([1.9, 0.68, 1.5], glass, [-0.18, 1.13, 0]);
    box([0.1, 0.62, 1.53], dark, [-0.18, 1.12, 0]);
    box([0.92, 0.24, 0.52], light, [0.45, 0.74, -0.42]);
    box([0.92, 0.24, 0.52], light, [0.45, 0.74, 0.42]);
    box([0.9, 0.24, 1.1], light, [-0.65, 0.74, 0]);
    [[1.18, -0.83], [1.18, 0.83], [-1.18, -0.83], [-1.18, 0.83]].forEach(([x, z]) => wheel(x, 0.4, z));
    box([0.08, 0.22, 1.25], dark, [1.6, 0.62, 0]);
    return group;
  }

  if (assetType === "bus") {
    box([7.2, 1.15, 2.25], main, [0, 0.9, 0]);
    box([6.7, 1.05, 2.05], glass, [0.05, 1.9, 0]);
    for (let index = -3; index <= 3; index += 1) box([0.09, 0.95, 2.12], dark, [index * 0.92, 1.9, 0]);
    for (let index = -2; index <= 2; index += 1) {
      box([0.52, 0.22, 0.52], light, [index * 1.02, 1.02, -0.62]);
      box([0.52, 0.22, 0.52], light, [index * 1.02, 1.02, 0.62]);
    }
    [[2.45, -1.12], [2.45, 1.12], [-2.45, -1.12], [-2.45, 1.12]].forEach(([x, z]) => wheel(x, 0.52, z, 0.48, 0.28));
    return group;
  }

  if (assetType === "motorcycle" || assetType === "bicycle") {
    const motor = assetType === "motorcycle";
    wheel(-0.82, 0.48, 0, 0.46, 0.12);
    wheel(0.82, 0.48, 0, 0.46, 0.12);
    const frameMaterial = motor ? main : light;
    addCylinderBetween(group, [-0.78, 0.5, 0], [0, 0.86, 0], 0.055, frameMaterial);
    addCylinderBetween(group, [0, 0.86, 0], [0.7, 0.5, 0], 0.055, frameMaterial);
    addCylinderBetween(group, [-0.78, 0.5, 0], [0.2, 0.5, 0], 0.045, frameMaterial);
    addCylinderBetween(group, [0.2, 0.5, 0], [0, 0.86, 0], 0.045, frameMaterial);
    addCylinderBetween(group, [0.67, 0.5, 0], [0.55, 1.04, 0], 0.04, dark);
    box([0.08, 0.08, 0.62], dark, [0.55, 1.06, 0]);
    box([0.42, 0.1, 0.25], dark, [-0.1, 0.92, 0]);
    if (motor) {
      add(new THREE.SphereGeometry(0.34, 18, 12), main, [0.18, 0.82, 0]);
      box([0.52, 0.34, 0.42], dark, [-0.18, 0.58, 0]);
      cylinder(0.12, 0.22, light, [0.64, 0.98, 0], [Math.PI / 2, 0, 0]);
    }
    return group;
  }

  if (assetType === "tree") return makeThreeTreeModel(color, 1);
  if (assetType === "forest") {
    const forest = new THREE.Group();
    [
      [-1.45, 0, -0.85, 0.9], [-0.35, 0, -1.2, 1.15], [1.05, 0, -0.72, 0.82],
      [-1.1, 0, 0.75, 1.08], [0.18, 0, 0.55, 0.92], [1.38, 0, 0.82, 1.18], [0.72, 0, 0.05, 0.72],
    ].forEach(([x, y, z, size]) => {
      const tree = makeThreeTreeModel(color, size);
      tree.position.set(x, y, z);
      forest.add(tree);
    });
    return forest;
  }

  if (assetType === "room") {
    box([6.2, 0.1, 4.6], new THREE.MeshStandardMaterial({ color: "#727d84", roughness: 0.95 }), [0, 0.05, 0]);
    box([6.2, 2.8, 0.12], light, [0, 1.4, -2.25]);
    box([0.12, 2.8, 4.5], light, [-3.05, 1.4, 0]);
    return group;
  }

  if (assetType === "sofa") {
    box([2.2, 0.38, 0.86], main, [0, 0.38, 0]);
    box([2.2, 0.72, 0.24], main, [0, 0.78, -0.34]);
    box([0.26, 0.58, 0.86], light, [-1.08, 0.58, 0]);
    box([0.26, 0.58, 0.86], light, [1.08, 0.58, 0]);
    box([1.0, 0.12, 0.68], light, [-0.52, 0.63, 0.02]);
    box([1.0, 0.12, 0.68], light, [0.52, 0.63, 0.02]);
    return group;
  }
  if (assetType === "dining-table") {
    box([1.8, 0.12, 1.05], main, [0, 0.78, 0]);
    [[-0.72, -0.38], [-0.72, 0.38], [0.72, -0.38], [0.72, 0.38]].forEach(([x, z]) => box([0.12, 0.76, 0.12], dark, [x, 0.38, z]));
    return group;
  }
  if (assetType === "chair") {
    box([0.62, 0.12, 0.62], main, [0, 0.52, 0]);
    box([0.62, 0.72, 0.12], main, [0, 0.84, -0.25]);
    [[-0.24, -0.24], [-0.24, 0.24], [0.24, -0.24], [0.24, 0.24]].forEach(([x, z]) => box([0.08, 0.5, 0.08], dark, [x, 0.25, z]));
    return group;
  }
  if (assetType === "bed") {
    box([2.15, 0.38, 1.55], main, [0, 0.35, 0]);
    box([2.0, 0.25, 1.45], light, [0.06, 0.65, 0]);
    box([0.18, 1.05, 1.58], dark, [-1.02, 0.58, 0]);
    box([0.52, 0.12, 1.3], new THREE.MeshStandardMaterial({ color: "#eef3f2", roughness: 0.92 }), [-0.62, 0.82, 0]);
    return group;
  }
  if (assetType === "cabinet") {
    box([1.25, 1.45, 0.52], main, [0, 0.73, 0]);
    box([0.04, 1.3, 0.04], dark, [0, 0.74, 0.28]);
    box([0.08, 0.08, 0.08], light, [-0.12, 0.76, 0.3]);
    box([0.08, 0.08, 0.08], light, [0.12, 0.76, 0.3]);
    return group;
  }
  if (assetType === "refrigerator") {
    box([0.92, 1.9, 0.78], light, [0, 0.95, 0]);
    box([0.84, 0.045, 0.8], dark, [0, 1.2, 0.01]);
    box([0.035, 0.72, 0.06], dark, [0.31, 1.5, 0.42]);
    box([0.035, 0.42, 0.06], dark, [0.31, 0.7, 0.42]);
    return group;
  }
  if (assetType === "television") {
    box([1.45, 0.84, 0.12], dark, [0, 1.05, 0]);
    box([1.3, 0.7, 0.035], screen, [0, 1.05, 0.08]);
    box([0.12, 0.48, 0.12], dark, [0, 0.48, 0]);
    box([0.72, 0.08, 0.42], dark, [0, 0.22, 0]);
    return group;
  }
  if (assetType === "stove") {
    box([0.88, 0.9, 0.75], light, [0, 0.45, 0]);
    box([0.82, 0.08, 0.7], dark, [0, 0.94, 0]);
    [[-0.23, -0.18], [0.23, -0.18], [-0.23, 0.18], [0.23, 0.18]].forEach(([x, z]) => cylinder(0.12, 0.035, screen, [x, 1, z]));
    box([0.58, 0.46, 0.04], screen, [0, 0.44, 0.39]);
    return group;
  }
  if (assetType === "washing-machine") {
    box([0.88, 0.9, 0.78], light, [0, 0.45, 0]);
    const door = cylinder(0.29, 0.07, dark, [0, 0.45, 0.42], [Math.PI / 2, 0, 0], 28);
    door.material = screen;
    box([0.58, 0.13, 0.04], dark, [0, 0.78, 0.42]);
    return group;
  }

  if (item.shape === "triangle") {
    const body = add(new THREE.ConeGeometry(0.42, 0.72, 3), main, [0, 0.36, 0]);
    body.rotation.y = -Math.PI / 6;
  } else {
    box([0.72, 0.34, 0.72], main, [0, 0.17, 0]);
  }
  return group;
}

function makeThreeTreeModel(color, scale = 1) {
  const THREE = window.THREE;
  const group = new THREE.Group();
  const trunkMaterial = new THREE.MeshStandardMaterial({ color: "#704c32", roughness: 0.92 });
  const leafColor = new THREE.Color(color).lerp(new THREE.Color("#2f9359"), 0.55);
  const leafMaterial = new THREE.MeshStandardMaterial({ color: leafColor, roughness: 0.9 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18 * scale, 0.26 * scale, 2.2 * scale, 12), trunkMaterial);
  trunk.position.y = 1.1 * scale;
  trunk.castShadow = true;
  group.add(trunk);
  [[0, 2.6, 0, 0.78], [-0.38, 2.45, 0.12, 0.58], [0.34, 2.48, -0.18, 0.62], [0.05, 3.05, 0.05, 0.64]].forEach(([x, y, z, radius]) => {
    const crown = new THREE.Mesh(new THREE.SphereGeometry(radius * scale, 16, 11), leafMaterial);
    crown.position.set(x * scale, y * scale, z * scale);
    crown.castShadow = true;
    group.add(crown);
  });
  return group;
}

function addCylinderBetween(group, start, end, radius, material) {
  const THREE = window.THREE;
  const a = new THREE.Vector3(...start);
  const b = new THREE.Vector3(...end);
  const direction = b.clone().sub(a);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, direction.length(), 12), material);
  mesh.position.copy(a.clone().add(b).multiplyScalar(0.5));
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  mesh.castShadow = true;
  group.add(mesh);
  return mesh;
}

function makeThreeSeatedActorModel(scale, color) {
  const THREE = window.THREE;
  const group = new THREE.Group();
  group.name = "humanoid-seated-v1";
  const base = new THREE.Color(color);
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: base, roughness: 0.66 });
  const lightMaterial = new THREE.MeshStandardMaterial({ color: base.clone().lerp(new THREE.Color("#ffffff"), 0.18), roughness: 0.62 });
  const darkMaterial = new THREE.MeshStandardMaterial({ color: base.clone().lerp(new THREE.Color("#101417"), 0.32), roughness: 0.72 });
  const sphere = (radius, position, material = bodyMaterial) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius * scale, 14, 10), material);
    mesh.position.set(position[0] * scale, position[1] * scale, position[2] * scale);
    mesh.castShadow = true;
    group.add(mesh);
  };
  const limb = (start, end, radius, material = bodyMaterial) => addCylinderBetween(
    group,
    start.map((value) => value * scale),
    end.map((value) => value * scale),
    radius * scale,
    material,
  );
  sphere(0.15, [0, 1.12, 0], lightMaterial);
  sphere(0.035, [0, 1.12, 0.145], darkMaterial);
  limb([0, 0.2, 0], [0, 0.9, 0], 0.17, lightMaterial);
  sphere(0.16, [0, 0.05, 0], darkMaterial);
  [-1, 1].forEach((side) => {
    sphere(0.07, [side * 0.22, 0.82, 0]);
    limb([side * 0.22, 0.8, 0], [side * 0.28, 0.48, 0.28], 0.055);
    limb([side * 0.28, 0.48, 0.28], [side * 0.2, 0.4, 0.52], 0.05);
    sphere(0.06, [side * 0.2, 0.4, 0.52], darkMaterial);
    limb([side * 0.1, 0.02, 0], [side * 0.12, -0.08, 0.48], 0.075);
    sphere(0.065, [side * 0.12, -0.08, 0.48], darkMaterial);
    limb([side * 0.12, -0.08, 0.48], [side * 0.12, -0.62, 0.5], 0.062);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.14 * scale, 0.08 * scale, 0.28 * scale), darkMaterial);
    foot.position.set(side * 0.12 * scale, -0.66 * scale, 0.58 * scale);
    foot.castShadow = true;
    group.add(foot);
  });
  return group;
}

function actorBodyPoseForRender(actor) {
  const pose = sanitizeBodyPose(actor?.bodyPose);
  if (!actor?.autoMounted) return pose;
  const seated = presetBodyPose("sit");
  ["chest", "head", "upperArmL", "lowerArmL", "upperArmR", "lowerArmR"].forEach((jointId) => {
    seated[jointId] = pose[jointId];
  });
  return sanitizeBodyPose(seated);
}

function makeThreeActorModel(scale, color, bodyPose = defaultBodyPose(), options = {}) {
  const THREE = window.THREE;
  const model = new THREE.Group();
  model.name = "humanoid-rig-v2";
  const base = new THREE.Color(color);
  const light = base.clone().lerp(new THREE.Color("#ffffff"), 0.16);
  const dark = base.clone().lerp(new THREE.Color("#101417"), 0.28);
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: base, roughness: 0.66, metalness: 0.02 });
  const chestMaterial = new THREE.MeshStandardMaterial({ color: light, roughness: 0.62, metalness: 0.02 });
  const jointMaterial = new THREE.MeshStandardMaterial({ color: dark, roughness: 0.7, metalness: 0.01 });
  const eyeWhiteMaterial = new THREE.MeshStandardMaterial({ color: "#f4eee6", roughness: 0.44, metalness: 0 });
  const pupilMaterial = new THREE.MeshStandardMaterial({ color: "#151a1c", roughness: 0.35, metalness: 0.02 });
  const mouthMaterial = new THREE.MeshStandardMaterial({ color: "#642b35", roughness: 0.68, metalness: 0 });
  const pose = sanitizeBodyPose(bodyPose);

  const addMesh = (parent, geometry, material, position, rotation = null, name = "", jointId = "") => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(position[0] * scale, position[1] * scale, position[2] * scale);
    if (rotation) mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
    mesh.name = name;
    if (jointId) mesh.userData.jointId = jointId;
    parent.add(mesh);
    return mesh;
  };
  const cylinder = (parent, top, bottom, height, material, position, rotation, name, jointId = "") => addMesh(
    parent,
    new THREE.CylinderGeometry(top * scale, bottom * scale, height * scale, 16),
    material,
    position,
    rotation,
    name,
    jointId,
  );
  const joint = (parent, radius, position, name, jointId) => addMesh(
    parent,
    new THREE.SphereGeometry(radius * scale, 14, 10),
    jointMaterial,
    position,
    null,
    name,
    jointId,
  );
  const rotateJoint = (group, jointId) => {
    const rotation = { ...(pose[jointId] || { x: 0, y: 0, z: 0 }) };
    if (jointId === "lowerArmL" || jointId === "lowerArmR") {
      rotation.x = -rotation.x;
    }
    group.rotation.set(degToRad(rotation.x), degToRad(rotation.y), degToRad(rotation.z), "XYZ");
    group.userData.jointId = jointId;
    return group;
  };
  const addPoseHandle = (parent, radius, jointId) => {
    if (!options.showPoseHandles) return;
    const selectedJoint = options.selectedJoint === jointId;
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(radius * scale, 12, 8),
      new THREE.MeshBasicMaterial({
        color: selectedJoint ? "#fff4df" : "#efa857",
        transparent: true,
        opacity: selectedJoint ? 0.82 : 0.42,
        wireframe: true,
        depthTest: false,
      }),
    );
    marker.scale.setScalar(selectedJoint ? 1.55 : 1.28);
    marker.renderOrder = 30;
    marker.userData.previewHidden = true;
    marker.userData.jointId = jointId;
    parent.add(marker);

    // ── NEW: 3D Rotation Gizmo Rings for Selected Joint ──
    if (selectedJoint) {
      const ringRadius = radius * scale * 2.8;
      const tubeRadius = radius * scale * 0.15;

      // X Axis - Red Ring (Rotated around Y so normal is X)
      const xRing = new THREE.Mesh(
        new THREE.TorusGeometry(ringRadius, tubeRadius, 8, 32),
        new THREE.MeshBasicMaterial({ color: "#ff3b30", depthTest: false, transparent: true, opacity: 0.82 })
      );
      xRing.rotation.y = Math.PI / 2;
      xRing.userData.gizmoAxis = "x";
      xRing.userData.jointId = jointId;
      xRing.userData.previewHidden = true;
      xRing.renderOrder = 35;
      marker.add(xRing);

      // Y Axis - Green Ring (Rotated around X so normal is Y)
      const yRing = new THREE.Mesh(
        new THREE.TorusGeometry(ringRadius, tubeRadius, 8, 32),
        new THREE.MeshBasicMaterial({ color: "#34c759", depthTest: false, transparent: true, opacity: 0.82 })
      );
      yRing.rotation.x = Math.PI / 2;
      yRing.userData.gizmoAxis = "y";
      yRing.userData.jointId = jointId;
      yRing.userData.previewHidden = true;
      yRing.renderOrder = 35;
      marker.add(yRing);

      // Z Axis - Blue Ring (Normal is already Z)
      const zRing = new THREE.Mesh(
        new THREE.TorusGeometry(ringRadius, tubeRadius, 8, 32),
        new THREE.MeshBasicMaterial({ color: "#007aff", depthTest: false, transparent: true, opacity: 0.82 })
      );
      zRing.userData.gizmoAxis = "z";
      zRing.userData.jointId = jointId;
      zRing.userData.previewHidden = true;
      zRing.renderOrder = 35;
      marker.add(zRing);
    }
  };
  const addBone = (parent, length, topRadius, bottomRadius, material, name, jointId = "") => {
    cylinder(parent, topRadius, bottomRadius, length, material, [0, -length / 2, 0], null, name, jointId);
  };

  addMesh(model, new THREE.BoxGeometry(0.34 * scale, 0.2 * scale, 0.22 * scale), jointMaterial, [0, 0.84, 0], null, "pelvis");

  const torso = rotateJoint(new THREE.Group(), "chest");
  torso.position.set(0, 0.84 * scale, 0);
  model.add(torso);
  joint(torso, 0.09, [0, 0, 0], "chestJoint", "chest");
  addPoseHandle(torso, 0.09, "chest");
  cylinder(torso, 0.19, 0.17, 0.28, bodyMaterial, [0, 0.2, 0], null, "abdomen", "chest");
  cylinder(torso, 0.24, 0.19, 0.42, chestMaterial, [0, 0.5, 0], null, "chest", "chest");
  cylinder(torso, 0.07, 0.075, 0.1, jointMaterial, [0, 0.77, 0], null, "neck", "chest");

  const head = rotateJoint(new THREE.Group(), "head");
  head.position.set(0, 0.86 * scale, 0);
  torso.add(head);
  joint(head, 0.07, [0, 0, 0], "headJoint", "head");
  addPoseHandle(head, 0.08, "head");
  const skull = addMesh(head, new THREE.SphereGeometry(0.16 * scale, 24, 18), chestMaterial, [0, 0.11, 0], null, "head");
  skull.userData.jointId = "head";
  skull.scale.set(0.92, 1.08, 0.96);
  [-1, 1].forEach((side) => {
    const eyeWhite = addMesh(head, new THREE.SphereGeometry(0.034 * scale, 14, 10), eyeWhiteMaterial, [side * 0.057, 0.145, 0.139], null, `eyeWhite${side}`);
    eyeWhite.userData.jointId = "head";
    const pupil = addMesh(head, new THREE.SphereGeometry(0.015 * scale, 12, 8), pupilMaterial, [side * 0.057, 0.145, 0.168], null, `pupil${side}`);
    pupil.userData.jointId = "head";
  });
  const nose = addMesh(head, new THREE.ConeGeometry(0.026 * scale, 0.07 * scale, 12), chestMaterial, [0, 0.092, 0.17], [Math.PI / 2, 0, 0], "nose");
  nose.userData.jointId = "head";
  const mouth = addMesh(head, new THREE.BoxGeometry(0.075 * scale, 0.012 * scale, 0.012 * scale), mouthMaterial, [0, 0.035, 0.156], null, "mouth");
  mouth.userData.jointId = "head";

  [-1, 1].forEach((side) => {
    const suffix = side < 0 ? "L" : "R";
    const upperArmId = `upperArm${suffix}`;
    const lowerArmId = `lowerArm${suffix}`;
    const shoulder = rotateJoint(new THREE.Group(), upperArmId);
    shoulder.position.set(side * 0.27 * scale, 0.63 * scale, 0);
    torso.add(shoulder);
    joint(shoulder, 0.075, [0, 0, 0], `shoulder${suffix}`, upperArmId);
    addPoseHandle(shoulder, 0.075, upperArmId);
    addBone(shoulder, 0.36, 0.065, 0.075, bodyMaterial, upperArmId, upperArmId);

    const elbow = rotateJoint(new THREE.Group(), lowerArmId);
    elbow.position.set(0, -0.38 * scale, 0);
    shoulder.add(elbow);
    joint(elbow, 0.058, [0, 0, 0], `elbow${suffix}`, lowerArmId);
    addPoseHandle(elbow, 0.06, lowerArmId);
    addBone(elbow, 0.34, 0.052, 0.06, bodyMaterial, lowerArmId, lowerArmId);
    joint(elbow, 0.062, [0, -0.36, 0], `hand${suffix}`, lowerArmId);

    const upperLegId = `upperLeg${suffix}`;
    const lowerLegId = `lowerLeg${suffix}`;
    const hip = rotateJoint(new THREE.Group(), upperLegId);
    hip.position.set(side * 0.105 * scale, 0.76 * scale, 0);
    model.add(hip);
    joint(hip, 0.085, [0, 0, 0], `hip${suffix}`, upperLegId);
    addPoseHandle(hip, 0.085, upperLegId);
    addBone(hip, 0.38, 0.09, 0.105, bodyMaterial, upperLegId, upperLegId);

    const knee = rotateJoint(new THREE.Group(), lowerLegId);
    knee.position.set(0, -0.4 * scale, 0);
    hip.add(knee);
    joint(knee, 0.07, [0, 0, 0], `knee${suffix}`, lowerLegId);
    addPoseHandle(knee, 0.07, lowerLegId);
    addBone(knee, 0.3, 0.065, 0.075, bodyMaterial, lowerLegId, lowerLegId);
    addMesh(knee, new THREE.BoxGeometry(0.15 * scale, 0.09 * scale, 0.26 * scale), jointMaterial, [0, -0.34, 0.07], null, `foot${suffix}`, lowerLegId);
  });
  return model;
}

function makeThreeCamera(camera, renderState) {
  const THREE = window.THREE;
  const group = new THREE.Group();
  group.name = "cameraRigHelper";
  group.userData.previewHidden = true;
  const cameraHeight = resolvedCameraRenderHeight(camera);
  const camPos = mapToWorld(camera, renderState, cameraHeight);
  const aimPos = cameraLookTarget(camera, renderState, 10);
  const groundCam = mapToWorld(camera, renderState, 0.04);
  const angle = degToRad(camera.panDeg);
  const fov = degToRad(focalToFov(camera.focal));
  const coneLength = Math.max(stageWorldSize(renderState).width, stageWorldSize(renderState).depth) * 0.9;

  const body = new THREE.Group();
  body.name = "camera";
  body.userData.editor = { kind: "camera" };
  body.position.copy(camPos);
  body.lookAt(aimPos);
  const housing = new THREE.Mesh(
    new THREE.BoxGeometry(0.58, 0.4, 0.42),
    new THREE.MeshStandardMaterial({ color: "#2b78b6", roughness: 0.42, metalness: 0.18 }),
  );
  housing.castShadow = true;
  body.add(housing);
  const housingEdges = new THREE.LineSegments(
    new THREE.EdgesGeometry(housing.geometry),
    new THREE.LineBasicMaterial({ color: "#c8edff", transparent: true, opacity: 0.8 }),
  );
  body.add(housingEdges);
  const lens = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.19, 0.34, 20),
    new THREE.MeshStandardMaterial({ color: "#9edcff", emissive: "#123c5c", roughness: 0.32, metalness: 0.28 }),
  );
  lens.rotation.x = Math.PI / 2;
  lens.position.z = -0.36;
  lens.castShadow = true;
  body.add(lens);
  const viewfinder = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.12, 0.2),
    new THREE.MeshStandardMaterial({ color: "#d9f2ff", roughness: 0.46, metalness: 0.1 }),
  );
  viewfinder.position.set(0.12, 0.27, 0.02);
  body.add(viewfinder);
  group.add(body);

  const supportMaterial = new THREE.LineBasicMaterial({ color: "#6d8799", transparent: true, opacity: 0.86 });
  const floorY = 0.05;
  const supportTop = new THREE.Vector3(camPos.x, Math.max(floorY, camPos.y - 0.24), camPos.z);
  const supportCenter = new THREE.Vector3(camPos.x, Math.max(floorY, camPos.y * 0.42), camPos.z);
  group.add(lineFromPoints([supportTop, supportCenter], supportMaterial));
  [[-0.34, -0.28], [0.34, -0.28], [0, 0.4]].forEach(([x, z]) => {
    group.add(lineFromPoints([supportCenter, new THREE.Vector3(camPos.x + x, floorY, camPos.z + z)], supportMaterial));
  });
  const cameraBase = makeThreeRoleRing(0.46, "#69c9ff");
  cameraBase.position.set(camPos.x, 0.055, camPos.z);
  group.add(cameraBase);
  const cameraLabel = makeThreeWorldLabel("카메라", "#69c9ff");
  cameraLabel.position.set(camPos.x, camPos.y + 0.72, camPos.z);
  group.add(cameraLabel);
  if (selected?.kind === "camera") {
    const selection = makeThreeSelectionRing(0.62, "#69c9ff", 0.04);
    selection.position.set(camPos.x, 0.07, camPos.z);
    group.add(selection);
  }

  const aimDirection = new THREE.Vector3(aimPos.x - camPos.x, aimPos.y - camPos.y, aimPos.z - camPos.z).normalize();
  const aimArrow = new THREE.ArrowHelper(aimDirection, camPos, Math.min(3.4, camPos.distanceTo(aimPos)), "#8fd7ff", 0.24, 0.13);
  aimArrow.userData.previewHidden = true;
  group.add(aimArrow);
  group.add(makeCameraConeMesh(groundCam, angle, fov, coneLength));
  return group;
}

function makeThreeSelectionRing(radius, color, tube = 0.025) {
  const THREE = window.THREE;
  const group = new THREE.Group();
  const outer = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 1.12, tube, 8, 48),
    new THREE.MeshBasicMaterial({ color: "#f5ffff", transparent: true, opacity: 0.98, depthTest: false }),
  );
  const inner = new THREE.Mesh(
    new THREE.TorusGeometry(radius, tube * 1.3, 8, 48),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, depthTest: false }),
  );
  [outer, inner].forEach((ring) => {
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.035;
    ring.renderOrder = 18;
    group.add(ring);
  });
  group.userData.previewHidden = true;
  return group;
}

function makeThreeRoleRing(radius, color) {
  const THREE = window.THREE;
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(radius, 0.022, 8, 44),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.82 }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.userData.previewHidden = true;
  return ring;
}

function makeThreeWorldLabel(text, color) {
  const THREE = window.THREE;
  const labelCanvas = document.createElement("canvas");
  labelCanvas.width = 512;
  labelCanvas.height = 112;
  const context = labelCanvas.getContext("2d");
  context.clearRect(0, 0, labelCanvas.width, labelCanvas.height);
  context.fillStyle = "rgba(8, 13, 17, 0.9)";
  roundRect(context, 8, 8, 496, 96, 18);
  context.fill();
  context.strokeStyle = color;
  context.lineWidth = 4;
  roundRect(context, 8, 8, 496, 96, 18);
  context.stroke();
  context.beginPath();
  context.arc(42, 56, 12, 0, Math.PI * 2);
  context.fillStyle = color;
  context.fill();
  context.fillStyle = "#f1f6f8";
  context.font = "800 38px system-ui, sans-serif";
  context.textAlign = "left";
  context.textBaseline = "middle";
  context.fillText(text, 70, 57, 420);
  const texture = new THREE.CanvasTexture(labelCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  }));
  sprite.scale.set(2.15, 0.48, 1);
  sprite.renderOrder = 24;
  sprite.userData.previewHidden = true;
  sprite.raycast = () => {};
  return sprite;
}

function makeCameraConeMesh(origin, angle, fov, length) {
  const THREE = window.THREE;
  const group = new THREE.Group();
  group.userData.previewHidden = true;
  const p1 = new THREE.Vector3(origin.x + Math.cos(angle - fov / 2) * length, 0.035, origin.z + Math.sin(angle - fov / 2) * length);
  const p2 = new THREE.Vector3(origin.x + Math.cos(angle + fov / 2) * length, 0.035, origin.z + Math.sin(angle + fov / 2) * length);
  const geometry = new THREE.BufferGeometry().setFromPoints([origin, p1, p2]);
  geometry.setIndex([0, 1, 2]);
  geometry.computeVertexNormals();
  group.add(new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({ color: "#3d9ee8", transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false }),
  ));
  const edgeMaterial = new THREE.LineDashedMaterial({ color: "#76cbff", dashSize: 0.22, gapSize: 0.14, transparent: true, opacity: 0.88 });
  [p1, p2].forEach((point) => {
    const edge = lineFromPoints([origin, point], edgeMaterial);
    edge.computeLineDistances();
    group.add(edge);
  });
  const center = new THREE.Vector3(origin.x + Math.cos(angle) * length, 0.038, origin.z + Math.sin(angle) * length);
  const centerLine = lineFromPoints([origin, center], new THREE.LineDashedMaterial({ color: "#a6ddff", dashSize: 0.1, gapSize: 0.16, transparent: true, opacity: 0.5 }));
  centerLine.computeLineDistances();
  group.add(centerLine);
  return group;
}

function renderCameraFramePreview(renderState = state, options = {}) {
  if (!threeView?.ready || !threeView.frameRenderer || !threeView.frameCamera) return;
  const camera = renderState.camera;
  const cameraPos = mapToWorld(camera, renderState, resolvedCameraRenderHeight(camera));
  const lookTarget = cameraLookTarget(camera, renderState, 10);

  const aspectLabel = renderState.aspect || "16:9";
  if (options.width && options.height) {
    threeView.frameRenderer.setPixelRatio(1);
    threeView.frameRenderer.setSize(options.width, options.height, false);
    threeView.frameCamera.aspect = options.width / options.height;
  } else if (threeView.frameWrap) {
    threeView.frameWrap.style.aspectRatio = aspectLabel.replace(":", " / ");
    const frameRect = threeView.frameWrap.getBoundingClientRect();
    const frameWidth = Math.max(1, frameRect.width);
    const frameHeight = Math.max(1, frameRect.height);
    threeView.frameRenderer.setSize(frameWidth, frameHeight, false);
    threeView.frameRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    threeView.frameCamera.aspect = frameWidth / frameHeight;
  }
  const frameAspect = threeView.frameCamera.aspect || aspectMap[aspectLabel] || 16 / 9;
  const horizontalFov = focalToFov(camera.focal);
  threeView.frameCamera.aspect = frameAspect;
  threeView.frameCamera.fov = horizontalFovToVerticalFov(horizontalFov, frameAspect);
  threeView.frameCamera.position.copy(cameraPos);
  threeView.frameCamera.lookAt(lookTarget);
  threeView.frameCamera.updateProjectionMatrix();

  const hidden = [];
  threeView.world.traverse((object) => {
    if (object.userData?.previewHidden && object.visible) {
      object.visible = false;
      hidden.push(object);
    }
  });
  threeView.frameRenderer.render(threeView.scene, threeView.frameCamera);
  hidden.forEach((object) => {
    object.visible = true;
  });
}

function resolvedCameraRenderHeight(camera) {
  const height = Number(camera?.height ?? 1.6);
  return Number.isFinite(height) ? Math.max(0.05, height) : 1.6;
}

function drawThreeMotionPaths(renderState, world) {
  const THREE = window.THREE;
  const keyframes = sortKeyframes(renderState.motion?.keyframes || []);
  visibleSourceDefinitions(renderState).forEach((source) => {
    const keys = keyframes.filter((keyframe) => keyframe.source === source.id);
    if (!keys.length) return;
    if (keys.length > 1) {
      const poses = sampleMotionPathPoses(renderState, source.id, keys);
      const points = poses.map((pose) => mapToWorld(
        pose,
        renderState,
        source.id === "camera" ? Number(pose.height ?? renderState.camera.height ?? 1.6) : 0.08,
      ));
      const curve = new THREE.CatmullRomCurve3(points, false, "centripetal", 0.5);
      const path = new THREE.Mesh(
        new THREE.TubeGeometry(curve, Math.max(18, points.length - 1), 0.035, 7, false),
        new THREE.MeshBasicMaterial({ color: source.color, transparent: true, opacity: 0.84 }),
      );
      path.userData.previewHidden = true;
      world.add(path);
      [0.28, 0.56, 0.82].forEach((progress) => {
        const marker = makeThreePathDirectionMarker(curve, progress, source.color);
        marker.userData.previewHidden = true;
        world.add(marker);
      });
    }
    keys.forEach((keyframe, index) => {
      const markerHeight = source.id === "camera"
        ? Number(keyframe.pose.height ?? renderState.camera.height ?? 1.6)
        : 0.1;
      const markerPosition = mapToWorld(keyframe.pose, renderState, markerHeight);
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(keyframe.id === renderState.motion?.selectedKeyId ? 0.14 : 0.1, 16, 10),
        new THREE.MeshBasicMaterial({ color: keyframe.id === renderState.motion?.selectedKeyId ? "#ffffff" : source.color }),
      );
      marker.position.copy(markerPosition);
      marker.userData.previewHidden = true;
      world.add(marker);
      const height = markerHeight + (source.id === "camera" ? 0.36 : 0.42);
      const label = makeThreeKeyOrderBadge(index + 1, source.color, keyframe.id === renderState.motion?.selectedKeyId);
      label.position.copy(mapToWorld(keyframe.pose, renderState, height));
      label.userData.previewHidden = true;
      world.add(label);
    });
  });
}

function guideKeysForSource(renderState, sourceId) {
  return sortKeyframes(renderState.motion?.keyframes || []).filter((keyframe) => keyframe.source === sourceId);
}

function guideMotionEntry(renderState, source, time) {
  const fields = source.id === "camera" ? CAMERA_GUIDE_FIELDS : ITEM_GUIDE_FIELDS;
  const keys = guideKeysForSource(renderState, source.id);
  const segments = motionSegments(keys, fields);
  return {
    source,
    keys,
    segments,
    hasMotion: segments.length > 0,
    activeSegment: activeMotionSegment(keys, time, fields),
  };
}

function analyzeBlockingGuide(renderState = state) {
  const time = clamp(Number(renderState.motion?.playhead || 0), 0, renderState.motion?.duration || 0);
  const sources = visibleSourceDefinitions(renderState);
  const cameraEntry = guideMotionEntry(renderState, sources.find((source) => source.id === "camera") || {
    id: "camera", type: "camera", name: "카메라", color: "#69c9ff",
  }, time);
  const itemEntries = sources
    .filter((source) => source.id !== "camera")
    .map((source) => guideMotionEntry(renderState, source, time));
  const trackingTargetId = sanitizeTrackingTargetId(renderState.camera?.trackingTargetId, renderState);
  const trackingEntry = itemEntries.find((entry) => entry.source.id === trackingTargetId);
  const trackingActive = Boolean(
    trackingTargetId
    && trackingEntry?.activeSegment
    && !sanitizeCameraLocks(renderState.camera?.locks).orientation,
  );
  const trackingHasMotion = Boolean(
    trackingTargetId
    && trackingEntry?.hasMotion
    && !sanitizeCameraLocks(renderState.camera?.locks).orientation,
  );
  const activeItems = itemEntries.filter((entry) => entry.activeSegment);
  const cameraActive = Boolean(cameraEntry.activeSegment || trackingActive);
  const cameraHasMotion = Boolean(cameraEntry.hasMotion || trackingHasMotion);
  const itemHasMotion = itemEntries.some((entry) => entry.hasMotion);
  return {
    time,
    cameraEntry,
    itemEntries,
    activeItems,
    cameraActive,
    cameraHasMotion,
    itemHasMotion,
    trackingActive,
    trackingHasMotion,
    mixed: cameraActive && activeItems.length > 0,
    noMotionKeys: !cameraHasMotion && !itemHasMotion,
  };
}

function guideDirectionFromSegment(segment, camera, renderState) {
  if (!segment) return "MOVING";
  const size = stageWorldSize(renderState);
  const dx = (Number(segment.end.pose?.x) - Number(segment.start.pose?.x)) * size.width;
  const dz = (Number(segment.end.pose?.y) - Number(segment.start.pose?.y)) * size.depth;
  if (Math.hypot(dx, dz) < 0.01) return "TURNING";
  const heading = degToRad(camera.panDeg || 0);
  const forward = dx * Math.cos(heading) + dz * Math.sin(heading);
  const right = dx * -Math.sin(heading) + dz * Math.cos(heading);
  if (Math.abs(forward) >= Math.abs(right)) return forward < 0 ? "TOWARD CAMERA" : "AWAY FROM CAMERA";
  return right > 0 ? "MOVE RIGHT" : "MOVE LEFT";
}

function cameraGuideLabel(analysis, renderState) {
  if (analysis.trackingActive) return "CAM: TRACKING";
  const segment = analysis.cameraEntry.activeSegment;
  if (!segment) return analysis.cameraHasMotion ? "CAM: HOLD" : "CAM: LOCKED";
  const from = segment.start.pose || {};
  const to = segment.end.pose || {};
  const size = stageWorldSize(renderState);
  const dx = (Number(to.x) - Number(from.x)) * size.width;
  const dz = (Number(to.y) - Number(from.y)) * size.depth;
  if (Math.hypot(dx, dz) > 0.01) {
    const heading = degToRad(Number(from.panDeg ?? renderState.camera.panDeg ?? 0));
    const forward = dx * Math.cos(heading) + dz * Math.sin(heading);
    const right = dx * -Math.sin(heading) + dz * Math.cos(heading);
    if (Math.abs(forward) >= Math.abs(right)) return forward > 0 ? "CAM: DOLLY IN" : "CAM: DOLLY OUT";
    return right > 0 ? "CAM: TRUCK RIGHT" : "CAM: TRUCK LEFT";
  }
  if (Math.abs(Number(to.height) - Number(from.height)) > 0.01) {
    return Number(to.height) > Number(from.height) ? "CAM: CRANE UP" : "CAM: CRANE DOWN";
  }
  if (Math.abs(Number(to.panDeg) - Number(from.panDeg)) > 0.1) return "CAM: PAN";
  if (Math.abs(Number(to.tiltDeg) - Number(from.tiltDeg)) > 0.1) {
    return Number(to.tiltDeg) > Number(from.tiltDeg) ? "CAM: TILT UP" : "CAM: TILT DOWN";
  }
  if (Math.abs(Number(to.focal) - Number(from.focal)) > 0.1) {
    return Number(to.focal) > Number(from.focal) ? "CAM: ZOOM IN" : "CAM: ZOOM OUT";
  }
  return "CAM: MOVING";
}

function subjectGuideLabel(analysis, renderState) {
  if (!analysis.activeItems.length) return "SUBJ: HOLD";
  if (analysis.activeItems.length > 1) return `SUBJ: ${analysis.activeItems.length} MOVING`;
  const entry = analysis.activeItems[0];
  const name = String(entry.source.name || "SUBJECT").trim().toUpperCase();
  const direction = guideDirectionFromSegment(entry.activeSegment, renderState.camera, renderState);
  return `SUBJ: ${name} · ${direction}`;
}

function guideDirectionInstruction(segment, camera, renderState) {
  const direction = guideDirectionFromSegment(segment, camera, renderState);
  return {
    "TOWARD CAMERA": "카메라 쪽으로 이동",
    "AWAY FROM CAMERA": "카메라에서 멀어짐",
    "MOVE RIGHT": "화면 오른쪽으로 이동",
    "MOVE LEFT": "화면 왼쪽으로 이동",
    TURNING: "제자리에서 방향 전환",
    MOVING: "이동",
  }[direction] || "이동";
}

function cameraGuideInstruction(analysis, renderState) {
  const custom = String(analysis.cameraEntry.activeSegment?.end?.note || "").trim();
  if (custom) return `카메라 · ${custom}`;
  const label = cameraGuideLabel(analysis, renderState);
  return {
    "CAM: TRACKING": "카메라 · 피사체 추적",
    "CAM: DOLLY IN": "카메라 · 달리 인",
    "CAM: DOLLY OUT": "카메라 · 달리 아웃",
    "CAM: TRUCK RIGHT": "카메라 · 오른쪽 트럭",
    "CAM: TRUCK LEFT": "카메라 · 왼쪽 트럭",
    "CAM: CRANE UP": "카메라 · 크레인 업",
    "CAM: CRANE DOWN": "카메라 · 크레인 다운",
    "CAM: PAN": "카메라 · 팬",
    "CAM: TILT UP": "카메라 · 틸트 업",
    "CAM: TILT DOWN": "카메라 · 틸트 다운",
    "CAM: ZOOM IN": "카메라 · 줌 인",
    "CAM: ZOOM OUT": "카메라 · 줌 아웃",
    "CAM: MOVING": "카메라 · 이동",
  }[label] || "카메라 · 고정";
}

function sourceGuideInstruction(entry, renderState) {
  const name = String(entry?.source?.name || "대상").trim();
  const custom = String(entry?.activeSegment?.end?.note || "").trim();
  const action = custom || guideDirectionInstruction(entry?.activeSegment, renderState.camera, renderState);
  return `@${name} · ${action}`;
}

function storyboardNoteLines(context, text, maxWidth) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  words.forEach((word) => {
    const candidate = line ? `${line} ${word}` : word;
    if (line && context.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  });
  if (line) lines.push(line);
  if (lines.length <= 2) return lines;
  return [lines[0], `${lines.slice(1).join(" ").slice(0, 30)}…`];
}

function drawStoryboardNote(context, text, x, y, color, scale, align = "left") {
  const fontSize = Math.round(20 * scale);
  const lineHeight = Math.round(25 * scale);
  context.save();
  context.font = `800 ${fontSize}px "Apple SD Gothic Neo", "Noto Sans KR", system-ui, sans-serif`;
  context.textAlign = align;
  context.textBaseline = "top";
  context.lineJoin = "round";
  const maxWidth = Math.max(150 * scale, 285 * scale);
  const lines = storyboardNoteLines(context, text, maxWidth);
  lines.forEach((line, index) => {
    const lineY = y + index * lineHeight;
    context.strokeStyle = "rgba(2, 7, 9, 0.92)";
    context.lineWidth = Math.max(4, 6 * scale);
    context.strokeText(line, x, lineY);
    context.fillStyle = index === 0 ? "#f4fbfa" : color;
    context.fillText(line, x, lineY);
  });
  const width = Math.max(...lines.map((line) => context.measureText(line).width), 0);
  const left = align === "right" ? x - width : x;
  context.strokeStyle = color;
  context.lineWidth = Math.max(1.5, 2 * scale);
  context.beginPath();
  context.moveTo(left, y + lines.length * lineHeight + 2 * scale);
  context.lineTo(left + Math.min(width, 72 * scale), y + lines.length * lineHeight + 2 * scale);
  context.stroke();
  context.restore();
  return { width, height: lines.length * lineHeight };
}

function makeThreePathDirectionMarker(curve, progress, color) {
  const THREE = window.THREE;
  const point = curve.getPointAt(progress);
  const tangent = curve.getTangentAt(progress).normalize();
  const marker = new THREE.Mesh(
    new THREE.ConeGeometry(0.1, 0.3, 12),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.96 }),
  );
  marker.position.copy(point);
  marker.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
  return marker;
}

function makeThreeKeyOrderBadge(number, color, active = false) {
  const THREE = window.THREE;
  const labelCanvas = document.createElement("canvas");
  labelCanvas.width = 96;
  labelCanvas.height = 96;
  const context = labelCanvas.getContext("2d");
  context.beginPath();
  context.arc(48, 48, 35, 0, Math.PI * 2);
  context.fillStyle = active ? "#ff6b55" : color;
  context.fill();
  context.lineWidth = 8;
  context.strokeStyle = active ? "#fff2ed" : "#11131a";
  context.stroke();
  context.fillStyle = "#121217";
  context.font = "900 46px system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(String(number), 48, 50);
  const texture = new THREE.CanvasTexture(labelCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
  sprite.scale.set(0.5, 0.5, 0.5);
  sprite.renderOrder = 20;
  return sprite;
}

function updateThreeCamera(renderState = state) {
  if (!threeView?.ready) return;
  const orbit = threeView.orbit;
  const radius = orbit.radius;
  const phi = clamp(orbit.phi, -0.85, 1.48);
  const target = orbit.target || new window.THREE.Vector3(0, 1.15, 0);
  const x = target.x + Math.cos(orbit.theta) * Math.cos(phi) * radius;
  const y = Math.max(0.12, target.y + Math.sin(phi) * radius);
  const z = target.z + Math.sin(orbit.theta) * Math.cos(phi) * radius;
  threeView.camera.position.set(x, y, z);
  threeView.camera.lookAt(target.x, target.y, target.z);
}

function beginThreeDrag(event) {
  if (!threeView?.ready) return;
  delete threeView.canvas.dataset.navMode;

  let forceNav = null; // "orbit", "pan", "zoom"

  if (event.button === 1) {
    forceNav = event.shiftKey ? "pan" : (event.ctrlKey ? "zoom" : "orbit");
  } else if (event.button === 2) {
    forceNav = "pan";
  } else if (event.button !== 0) {
    return;
  }

  const editor = forceNav ? null : pickThreeEditor(event);
  if (editor) {
    if (editor.kind === "poseJoint") {
      const actor = state.items.find((item) => item.id === editor.actorId && item.type === "actor");
      if (!actor || sourceEditLocked(actor.id)) {
        if (actor) notifyEditLocked(actor.name);
        return;
      }
      const editStartState = clone(state);
      materializeEvaluatedViewForEditing(actor.id);
      const current = state.items.find((item) => item.id === actor.id);
      current.bodyPose = sanitizeBodyPose(current.bodyPose);
      selected = { kind: "item", id: actor.id };
      selectedPoseActorId = actor.id;
      selectedPoseJoint = editor.jointId;
      setActiveSource(actor.id);
      selectKeyForSource(actor.id);
      threeDrag = {
        kind: "pose",
        pointerId: event.pointerId,
        actorId: actor.id,
        jointId: editor.jointId,
        gizmoAxis: editor.gizmoAxis || null,
        x: event.clientX,
        y: event.clientY,
        startRotation: clone(current.bodyPose[editor.jointId]),
        startState: editStartState,
        changed: false,
      };
      threeView.canvas.setPointerCapture(event.pointerId);
      syncUi(false);
      renderThreeView(state, true);
      return;
    }
    if (threeEditMode === "pose" && editor.kind === "item") {
      const actor = state.items.find((item) => item.id === editor.id && item.type === "actor");
      if (actor) {
        selectActorPoseJoint(actor.id, selectedPoseActorId === actor.id ? selectedPoseJoint : "chest");
      } else {
        notifyApp("포즈 편집은 배우를 선택했을 때 사용할 수 있습니다.");
      }
      return;
    }
    selected = editor;
    const sourceId = selectedSourceId();
    if (sourceId) {
      setActiveSource(sourceId);
      selectKeyForSource(sourceId);
    }
    const editItemId = editor.kind === "item" ? transformLeaderIdForItem(editor.id, state) : editor.id;
    const locked = editor.kind === "camera"
      ? cameraFieldLocked(threeEditMode === "rotate" ? "orientation" : "position")
      : sourceEditLocked(editItemId);
    if (locked) {
      notifyEditLocked(editor.kind === "camera" ? "카메라" : sourceLabel(editItemId));
      syncUi(false);
      renderThreeView(evaluatedViewState || state, true);
      return;
    }
    const editStartState = clone(state);
    materializeEvaluatedViewForEditing(editItemId);
    const pose = editor.kind === "item"
      ? state.items.find((item) => item.id === editItemId)
      : state.camera;
    const planeHeight = editor.kind === "camera" ? state.camera.height : 0;
    const point = projectThreePointerToPlane(event, planeHeight);
    const pointerStage = point ? worldToStage(point) : { x: pose.x, y: pose.y };
    threeDrag = {
      kind: "edit",
      pointerId: event.pointerId,
      editor,
      editItemId,
      startState: editStartState,
      startPoint: pointerStage,
      grabOffset: { x: pose.x - pointerStage.x, y: pose.y - pointerStage.y },
      changed: false,
    };
    threeView.canvas.setPointerCapture(event.pointerId);
    syncUi(false);
    renderThreeView(evaluatedViewState || state, true);
    return;
  }

  // Left-drag edits a picked object; on the floor or empty space it orbits.
  if (!forceNav) forceNav = "orbit";

  const dragKind = forceNav;
  threeDrag = {
    kind: dragKind,
    pointerId: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    theta: threeView.orbit.theta,
    phi: threeView.orbit.phi,
    radius: threeView.orbit.radius,
    targetStart: (threeView.orbit.target || new window.THREE.Vector3(0, 1.15, 0)).clone()
  };
  threeView.canvas.dataset.navMode = dragKind;
  threeView.canvas.setPointerCapture(event.pointerId);
}

function updateThreeDrag(event) {
  if (!threeDrag || event.pointerId !== threeDrag.pointerId || !threeView?.ready) return;
  if (threeDrag.kind === "edit") {
    updateThreeEditorDrag(event);
    return;
  }
  if (threeDrag.kind === "pose") {
    updateThreePoseDrag(event);
    return;
  }
  
  const dx = event.clientX - threeDrag.x;
  const dy = event.clientY - threeDrag.y;
  
  if (threeDrag.kind === "orbit") {
    threeView.orbit.theta = threeDrag.theta - dx * 0.0024;
    threeView.orbit.phi = clamp(threeDrag.phi + dy * 0.0016, -0.85, 1.48);
  } else if (threeDrag.kind === "pan") {
    const factor = (threeDrag.radius / 800) * 1.5;
    const right = new window.THREE.Vector3(1, 0, 0).applyQuaternion(threeView.camera.quaternion);
    const up = new window.THREE.Vector3(0, 1, 0).applyQuaternion(threeView.camera.quaternion);
    
    const newTarget = threeDrag.targetStart.clone();
    newTarget.addScaledVector(right, -dx * factor);
    newTarget.addScaledVector(up, dy * factor);
    
    if (!threeView.orbit.target) {
      threeView.orbit.target = new window.THREE.Vector3(0, 1.15, 0);
    }
    threeView.orbit.target.copy(newTarget);
  } else if (threeDrag.kind === "zoom") {
    const factor = dy * 0.02;
    threeView.orbit.radius = clamp(threeDrag.radius + factor, THREE_ORBIT_RADIUS_MIN, THREE_ORBIT_RADIUS_MAX);
  }
  
  renderThreeView(threeView.lastState || state, true);
}

function endThreeDrag(event) {
  if (!threeDrag || event.pointerId !== threeDrag.pointerId) return;
  const didEdit = ["edit", "pose"].includes(threeDrag.kind) && threeDrag.changed;
  threeView?.canvas.releasePointerCapture?.(event.pointerId);
  if (threeView?.canvas) delete threeView.canvas.dataset.navMode;
  threeDrag = null;
  if (didEdit) commit();
}

function cancelThreeDrag(event) {
  if (!threeDrag || event.pointerId !== threeDrag.pointerId) return;
  const cancelled = threeDrag;
  threeView?.canvas.releasePointerCapture?.(event.pointerId);
  if (threeView?.canvas) delete threeView.canvas.dataset.navMode;
  threeDrag = null;
  if (["edit", "pose"].includes(cancelled.kind) && cancelled.startState) {
    restoreUncommittedState(cancelled.startState);
    renderThreeView(state, true);
  }
}

function zoomThreeView(event) {
  if (!threeView?.ready) return;
  event.preventDefault();
  threeView.orbit.radius = clamp(threeView.orbit.radius + event.deltaY * 0.006, THREE_ORBIT_RADIUS_MIN, THREE_ORBIT_RADIUS_MAX);
  renderThreeView(threeView.lastState || state, true);
}

function pickThreeEditor(event) {
  const pointer = threePointer(event);
  if (!pointer || !threeView?.raycaster) return null;
  threeView.raycaster.setFromCamera(pointer, threeView.camera);
  const hits = threeView.raycaster.intersectObjects(threeView.world.children, true);
  for (const hit of hits) {
    let object = hit.object;

    // ── Check if we directly hit a 3D rotation gizmo ring ──
    if (object.userData && object.userData.gizmoAxis) {
      let temp = object;
      let actorId = null;
      while (temp && temp !== threeView.world) {
        if (temp.userData?.editor?.kind === "item") {
          const itemObj = state.items.find(i => i.id === temp.userData.editor.id);
          if (itemObj && itemObj.type === "actor") {
            actorId = itemObj.id;
            break;
          }
        }
        temp = temp.parent;
      }
      if (actorId) {
        return {
          kind: "poseJoint",
          actorId,
          jointId: object.userData.jointId,
          gizmoAxis: object.userData.gizmoAxis
        };
      }
    }

    let jointId = null;
    let actorId = null;
    while (object && object !== threeView.world) {
      if (object.userData?.poseJoint) {
        return { kind: "poseJoint", ...clone(object.userData.poseJoint) };
      }
      if (object.userData?.jointId) {
        jointId = object.userData.jointId;
      }
      if (object.userData?.editor?.kind === "item") {
        const itemObj = state.items.find(i => i.id === object.userData.editor.id);
        if (itemObj && itemObj.type === "actor") {
          actorId = itemObj.id;
        }
      }
      if (threeEditMode === "pose" && jointId && actorId) {
        return { kind: "poseJoint", actorId, jointId };
      }
      if (object.userData?.editor) return clone(object.userData.editor);
      object = object.parent;
    }
  }
  return null;
}

function updateThreePoseDrag(event) {
  const actor = state.items.find((item) => item.id === threeDrag.actorId && item.type === "actor");
  const definition = JOINT_DEFINITIONS[threeDrag.jointId];
  if (!actor || !definition) return;
  actor.bodyPose = sanitizeBodyPose(actor.bodyPose);
  const rotation = actor.bodyPose[threeDrag.jointId];
  const dx = event.clientX - threeDrag.x;
  const dy = event.clientY - threeDrag.y;
  
  if (threeDrag.gizmoAxis) {
    // ── Dedicated axis dragging from the 3D Gizmo Rings ──
    const sensitivity = event.altKey ? 0.18 : 0.42;
    if (threeDrag.gizmoAxis === "x") {
      rotation.x = clamp(threeDrag.startRotation.x - dy * sensitivity, definition.x[0], definition.x[1]);
    } else if (threeDrag.gizmoAxis === "y") {
      rotation.y = clamp(threeDrag.startRotation.y + dx * sensitivity, definition.y[0], definition.y[1]);
    } else if (threeDrag.gizmoAxis === "z") {
      rotation.z = clamp(threeDrag.startRotation.z + dx * sensitivity, definition.z[0], definition.z[1]);
    }
  } else {
    // ── Fallback general limb dragging ──
    const sensitivity = event.altKey ? 0.18 : 0.42;
    rotation.x = clamp(threeDrag.startRotation.x - dy * sensitivity, definition.x[0], definition.x[1]);
    if (event.shiftKey) {
      rotation.z = clamp(threeDrag.startRotation.z + dx * sensitivity, definition.z[0], definition.z[1]);
    } else {
      rotation.y = clamp(threeDrag.startRotation.y + dx * sensitivity, definition.y[0], definition.y[1]);
    }
  }
  actor.bodyPose = sanitizeBodyPose(actor.bodyPose);
  threeDrag.changed = true;
  syncUi(false);
  renderThreeView(state, true);
}

function threePointer(event) {
  if (!threeView?.canvas) return null;
  const rect = threeView.canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  return {
    x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
    y: -((event.clientY - rect.top) / rect.height) * 2 + 1,
  };
}

function projectThreePointerToPlane(event, height = 0) {
  const pointer = threePointer(event);
  if (!pointer || !threeView?.raycaster) return null;
  const THREE = window.THREE;
  threeView.raycaster.setFromCamera(pointer, threeView.camera);
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -height);
  const target = new THREE.Vector3();
  return threeView.raycaster.ray.intersectPlane(plane, target) ? target : null;
}

function updateThreeEditorDrag(event) {
  const editor = threeDrag.editor;
  const planeHeight = editor.kind === "camera" ? state.camera.height : 0;
  const point = projectThreePointerToPlane(event, planeHeight);
  if (!point) return;
  const pointerStage = worldToStage(point);
  const target = {
    x: clamp(pointerStage.x + threeDrag.grabOffset.x, 0.02, 0.98),
    y: clamp(pointerStage.y + threeDrag.grabOffset.y, 0.02, 0.98),
  };

  if (threeEditMode === "rotate" && editor.kind === "item") {
    const item = state.items.find((entry) => entry.id === threeDrag.editItemId);
    if (!item) return;
    item.facing = Math.round(radToDeg(Math.atan2(pointerStage.y - item.y, pointerStage.x - item.x)));
  } else if (threeEditMode === "rotate" && editor.kind === "camera") {
    const size = stageWorldSize(state);
    state.camera.panDeg = normalizePanDeg(radToDeg(Math.atan2(
      (pointerStage.y - state.camera.y) * size.depth,
      (pointerStage.x - state.camera.x) * size.width,
    )));
    syncCameraDerivedAim(state.camera, state);
  } else if (editor.kind === "item") {
    const item = state.items.find((entry) => entry.id === threeDrag.editItemId);
    if (!item) return;
    item.x = target.x;
    item.y = target.y;
  } else if (editor.kind === "camera") {
    state.camera.x = target.x;
    state.camera.y = target.y;
    syncCameraDerivedAim(state.camera, state);
  }
  applyCameraTracking(state);
  threeDrag.changed = true;
  syncUi(false);
  renderThreeView(state, true);
}

function renderThreeEditControls() {
  $$(".three-editbar button[data-three-mode]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.threeMode === threeEditMode);
  });
  if (threeView?.canvas) threeView.canvas.dataset.editMode = threeEditMode;
  const label = $("#threeSelectionLabel");
  if (!label) return;
  const item = selectedItem();
  if (item) {
    const poseLabel = threeEditMode === "pose" && item.type === "actor"
      ? ` · ${JOINT_DEFINITIONS[selectedPoseJoint]?.label || "관절"}`
      : "";
    label.textContent = "선택: " + item.name + poseLabel;
  } else if (selected?.kind === "camera") {
    label.textContent = "선택: 카메라";
  } else {
    label.textContent = "대상을 선택하세요";
  }
}

function setThreeEditMode(mode, { announce = false } = {}) {
  if (!["move", "rotate", "pose"].includes(mode)) return;
  threeEditMode = mode;
  if (mode === "pose") {
    const actor = selectedItem();
    if (actor?.type === "actor") selectedPoseActorId = actor.id;
  }
  renderThreeEditControls();
  if (viewMode === "3d") renderThreeView(evaluatedViewState || state, true);
  if (announce) {
    const labels = { move: "3D 이동 편집", rotate: "3D 회전 편집", pose: "3D 배우 포즈 편집" };
    notifyApp(labels[mode]);
  }
}

function drawMotionPaths(renderState, rect) {
  const keyframes = sortKeyframes(renderState.motion?.keyframes || []);
  if (!keyframes.length) return;

  ctx.save();
  visibleSourceDefinitions(renderState).forEach((source) => {
    const keys = keyframes.filter((keyframe) => keyframe.source === source.id);
    if (!keys.length) return;
    const guideColor = blockingGuideColor(source);
    if (keys.length > 1) {
      const sampled = sampleMotionPathPoses(renderState, source.id, keys).map((pose) => toCanvas(pose, rect));
      ctx.strokeStyle = hexToRgba(guideColor, source.id === "camera" ? 0.72 : 0.64);
      ctx.lineWidth = source.id === "camera" ? 2.4 : 2.2;
      ctx.setLineDash(source.id === "camera" ? [3, 5] : [5, 6]);
      ctx.beginPath();
      sampled.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      ctx.stroke();
      ctx.setLineDash([]);
      drawPlanPathArrows(sampled, guideColor, rect);
      drawPlanAnchor(toCanvas(keys[0].pose, rect), "start", guideColor, rect);
      drawPlanAnchor(toCanvas(keys[keys.length - 1].pose, rect), "destination", guideColor, rect);
    }

    const motionEntry = guideMotionEntry(renderState, source, Number(renderState.motion?.playhead || 0));
    if (motionEntry.activeSegment) {
      const currentPose = source.id === "camera"
        ? renderState.camera
        : resolvedItemPose(renderState.items.find((item) => item.id === source.id), renderState);
      if (currentPose) {
        drawPlanAnchor(toCanvas(motionEntry.activeSegment.end.pose, rect), "destination", guideColor, rect);
        drawPlanAnchor(toCanvas(currentPose, rect), "current", guideColor, rect);
        drawPlanMotionInstruction(source, motionEntry, currentPose, renderState, rect, guideColor);
      }
    }
    keys.forEach((keyframe, index) => {
      drawPathOrderBadge(
        toCanvas(keyframe.pose, rect),
        index + 1,
        guideColor,
        keyframe.id === renderState.motion?.selectedKeyId,
        rect,
      );
    });
  });
  drawSelectedFreeCurveHandle(renderState, keyframes, rect);
  drawPathSnapGuide(rect);
  ctx.restore();
}

function blockingGuideColor(source) {
  if (source?.id === "camera" || source?.type === "camera") return "#69c9ff";
  if (source?.type === "prop") return "#ffc66d";
  return "#56dfd0";
}

function pointAlongPlanPath(points, progress) {
  if (!Array.isArray(points) || points.length < 2) return null;
  const segments = [];
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    if (length < 0.01) continue;
    segments.push({ start, end, length, from: total });
    total += length;
  }
  if (!segments.length || total < 0.01) return null;
  const target = clamp(Number(progress), 0, 1) * total;
  const segment = segments.find((entry) => target <= entry.from + entry.length) || segments[segments.length - 1];
  const local = clamp((target - segment.from) / segment.length, 0, 1);
  return {
    x: segment.start.x + (segment.end.x - segment.start.x) * local,
    y: segment.start.y + (segment.end.y - segment.start.y) * local,
    angle: Math.atan2(segment.end.y - segment.start.y, segment.end.x - segment.start.x),
    total,
  };
}

function drawPlanPathArrows(points, color, rect) {
  const path = pointAlongPlanPath(points, 0.5);
  if (!path) return;
  const progressPoints = path.total > Math.min(rect.w, rect.h) * 0.42
    ? [0.24, 0.5, 0.76]
    : [0.52];
  const size = clamp(Math.min(rect.w, rect.h) * 0.018, 8, 14);
  progressPoints.forEach((progress) => {
    const marker = pointAlongPlanPath(points, progress);
    if (!marker) return;
    ctx.save();
    ctx.translate(marker.x, marker.y);
    ctx.rotate(marker.angle);
    const trace = () => {
      ctx.beginPath();
      ctx.moveTo(-size * 0.8, 0);
      ctx.lineTo(size * 0.75, 0);
      ctx.moveTo(size * 0.75, 0);
      ctx.lineTo(size * 0.12, -size * 0.56);
      ctx.moveTo(size * 0.75, 0);
      ctx.lineTo(size * 0.12, size * 0.56);
    };
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(5, 9, 12, 0.94)";
    ctx.lineWidth = Math.max(4, size * 0.38);
    trace();
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, size * 0.2);
    trace();
    ctx.stroke();
    ctx.restore();
  });
}

function drawPlanMotionInstruction(source, entry, currentPose, renderState, rect, color) {
  if (!entry?.activeSegment || !currentPose) return;
  const current = toCanvas(currentPose, rect);
  const destination = toCanvas(entry.activeSegment.end.pose, rect);
  const dx = destination.x - current.x;
  const dy = destination.y - current.y;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const normalX = -dy / distance;
  const normalY = dx / distance;
  const x = clamp((current.x + destination.x) / 2 + normalX * 24, rect.x + 26, rect.x + rect.w - 26);
  const y = clamp((current.y + destination.y) / 2 + normalY * 24, rect.y + 82, rect.y + rect.h - 64);
  const text = source.id === "camera"
    ? cameraGuideInstruction({
      cameraEntry: entry,
      trackingActive: false,
      cameraHasMotion: entry.hasMotion,
    }, renderState)
    : sourceGuideInstruction(entry, renderState);
  drawStoryboardNote(ctx, text, x, y, color, clamp(Math.min(rect.w / 1200, rect.h / 680), 0.58, 0.78), x > rect.x + rect.w * 0.72 ? "right" : "left");
}

function drawPlanAnchor(point, kind, color, rect) {
  const radius = clamp(Math.min(rect.w, rect.h) * (kind === "destination" ? 0.015 : 0.012), 7, 12);
  ctx.save();
  ctx.translate(point.x, point.y);
  ctx.lineCap = "round";
  ctx.lineWidth = Math.max(2, radius * 0.26);
  ctx.strokeStyle = "rgba(5, 9, 12, 0.92)";
  ctx.beginPath();
  ctx.arc(0, 0, radius + 3, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  if (kind === "current") {
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#f4ffff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, radius + 3, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();
    if (kind === "destination") {
      const arm = radius + 6;
      ctx.beginPath();
      ctx.moveTo(-arm, 0);
      ctx.lineTo(arm, 0);
      ctx.moveTo(0, -arm);
      ctx.lineTo(0, arm);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawPathOrderBadge(point, number, color, active, rect) {
  const radius = active ? 10 : 9;
  const center = pathOrderBadgeCenter(point, active, rect);
  ctx.strokeStyle = hexToRgba(color, 0.72);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(point.x, point.y);
  ctx.lineTo(center.x, center.y);
  ctx.stroke();
  ctx.fillStyle = active ? "#ff6b55" : color;
  ctx.strokeStyle = active ? "#fff2ed" : "#11131a";
  ctx.lineWidth = active ? 3 : 2;
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#121217";
  ctx.font = "900 11px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(number), center.x, center.y + 0.5);
}

function pathOrderBadgeCenter(point, active, rect = stageRect) {
  const radius = active ? 10 : 9;
  const above = point.y - 17 >= rect.y + radius;
  return {
    x: clamp(point.x + 1, rect.x + radius, rect.x + rect.w - radius),
    y: clamp(point.y + (above ? -17 : 17), rect.y + radius, rect.y + rect.h - radius),
  };
}

function selectedFreeCurveSegment(renderState = state, keyframes = renderState.motion?.keyframes || []) {
  const current = keyframes.find((keyframe) => keyframe.id === renderState.motion?.selectedKeyId);
  if (!current || pathModeForSegment(current.segment, current.source) !== "free-curve") return null;
  const keys = sortKeyframes(keyframes.filter((keyframe) => keyframe.source === current.source));
  const index = keys.findIndex((keyframe) => keyframe.id === current.id);
  if (index <= 0) return null;
  return { keyframe: current, previous: keys[index - 1], control: current.segment?.plan?.control };
}

function drawSelectedFreeCurveHandle(renderState, keyframes, rect) {
  const segment = selectedFreeCurveSegment(renderState, keyframes);
  if (!segment?.control) return;
  const start = toCanvas(segment.previous.pose, rect);
  const end = toCanvas(segment.keyframe.pose, rect);
  const control = toCanvas(segment.control, rect);
  ctx.strokeStyle = "rgba(255, 107, 85, 0.48)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(control.x, control.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#ff6b55";
  ctx.strokeStyle = "#121217";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(control.x, control.y, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#121217";
  ctx.font = "900 10px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("곡", control.x, control.y + 0.5);
}

function drawPathSnapGuide(rect) {
  if (!pathSnapGuide) return;
  ctx.save();
  ctx.strokeStyle = "rgba(255, 107, 85, 0.88)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([7, 5]);
  ctx.beginPath();
  if (pathSnapGuide.x != null) {
    const x = rect.x + pathSnapGuide.x * rect.w;
    ctx.moveTo(x, rect.y);
    ctx.lineTo(x, rect.y + rect.h);
  }
  if (pathSnapGuide.y != null) {
    const y = rect.y + pathSnapGuide.y * rect.h;
    ctx.moveTo(rect.x, y);
    ctx.lineTo(rect.x + rect.w, y);
  }
  ctx.stroke();
  ctx.restore();
}

function hexToRgba(hex, alpha) {
  const clean = hex.replace("#", "");
  const value = parseInt(clean.length === 3 ? clean.replace(/(.)/g, "$1$1") : clean, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function drawGrid(rect, renderState = state) {
  const stageSize = stageWorldSize(renderState);
  const cols = Math.max(8, Math.round(stageSize.width / STAGE_GRID_STEP_METERS));
  const rows = Math.max(6, Math.round(stageSize.depth / STAGE_GRID_STEP_METERS));
  ctx.save();
  ctx.strokeStyle = "rgba(127, 159, 187, 0.18)";
  ctx.lineWidth = 1;
  for (let i = 1; i < cols; i += 1) {
    const x = rect.x + (rect.w * i) / cols;
    ctx.beginPath();
    ctx.moveTo(x, rect.y);
    ctx.lineTo(x, rect.y + rect.h);
    ctx.stroke();
  }
  for (let i = 1; i < rows; i += 1) {
    const y = rect.y + (rect.h * i) / rows;
    ctx.beginPath();
    ctx.moveTo(rect.x, y);
    ctx.lineTo(rect.x + rect.w, y);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(255, 107, 85, 0.13)";
  ctx.beginPath();
  ctx.moveTo(rect.x + rect.w / 2, rect.y);
  ctx.lineTo(rect.x + rect.w / 2, rect.y + rect.h);
  ctx.moveTo(rect.x, rect.y + rect.h / 2);
  ctx.lineTo(rect.x + rect.w, rect.y + rect.h / 2);
  ctx.stroke();
  ctx.restore();
}

function drawCameraCone(camera, rect, clean = false) {
  const cam = toCanvas({ x: camera.x, y: camera.y }, rect);
  const angle = degToRad(camera.panDeg);
  const fov = degToRad(focalToFov(camera.focal));
  const len = Math.max(rect.w, rect.h) * 1.6;
  const p1 = {
    x: cam.x + Math.cos(angle - fov / 2) * len,
    y: cam.y + Math.sin(angle - fov / 2) * len,
  };
  const p2 = {
    x: cam.x + Math.cos(angle + fov / 2) * len,
    y: cam.y + Math.sin(angle + fov / 2) * len,
  };

  ctx.save();
  ctx.fillStyle = "rgba(64, 129, 199, 0.2)";
  ctx.strokeStyle = "rgba(107, 169, 244, 0.76)";
  ctx.lineWidth = 1.3;
  ctx.setLineDash([5, 6]);
  ctx.beginPath();
  ctx.moveTo(cam.x, cam.y);
  ctx.lineTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.setLineDash([1, 7]);
  ctx.strokeStyle = "rgba(107, 169, 244, 0.48)";
  ctx.beginPath();
  ctx.moveTo(cam.x, cam.y);
  ctx.lineTo(cam.x + Math.cos(angle) * len * 0.46, cam.y + Math.sin(angle) * len * 0.46);
  ctx.stroke();

  ctx.restore();
}

function drawCamera(camera, rect, clean = false) {
  const cam = toCanvas({ x: camera.x, y: camera.y }, rect);
  const angle = degToRad(camera.panDeg);
  const active = selected?.kind === "camera" || selected?.kind === "aim";

  ctx.save();
  ctx.translate(cam.x, cam.y);
  ctx.rotate(angle);
  ctx.strokeStyle = active ? "#ff6b55" : "#71b8ff";
  ctx.fillStyle = "#121a24";
  ctx.lineWidth = active ? 2.5 : 2;
  roundRect(ctx, -18, -10, 25, 20, 4);
  ctx.fill();
  ctx.stroke();
  roundRect(ctx, 7, -7, 17, 14, 3);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  drawCameraRotationIndicator(camera, cam, angle, active, clean, rect);
}

function drawCameraRotationIndicator(camera, cam, angle, active, clean = false, rect = stageRect) {
  const radius = active ? 30 : 27;
  const arcStart = angle - 0.82;
  const arcEnd = angle + 0.82;
  const arrow = {
    x: cam.x + Math.cos(arcEnd) * radius,
    y: cam.y + Math.sin(arcEnd) * radius,
  };

  ctx.save();
  ctx.strokeStyle = active ? "rgba(255, 107, 85, 0.98)" : "rgba(130, 191, 255, 0.7)";
  ctx.fillStyle = ctx.strokeStyle;
  ctx.lineWidth = active ? 2.4 : 1.8;
  ctx.beginPath();
  ctx.arc(cam.x, cam.y, radius, arcStart, arcEnd);
  ctx.stroke();

  ctx.translate(arrow.x, arrow.y);
  ctx.rotate(arcEnd);
  ctx.beginPath();
  ctx.moveTo(5, 0);
  ctx.lineTo(-5, -4);
  ctx.lineTo(-5, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  if (!clean && active) {
    const labelX = clamp(cam.x, rect.x + 44, rect.x + rect.w - 44);
    const labelY = clamp(cam.y - radius - 16, rect.y + 18, rect.y + rect.h - 18);
    drawMicroLabel(`P ${cameraHeadingDeg(camera)}° · T ${Math.round(camera.tiltDeg)}°`, labelX, labelY, "#71b8ff");
  }
}

function drawMicroLabel(text, x, y, color = "#dfe5de") {
  ctx.save();
  ctx.font = "800 10px ui-monospace, SFMono-Regular, Menlo, monospace";
  const metrics = ctx.measureText(text);
  const w = metrics.width + 12;
  const h = 18;
  ctx.fillStyle = "rgba(5, 7, 8, 0.72)";
  roundRect(ctx, x - w / 2, y - h / 2, w, h, 5);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 107, 85, 0.35)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y + 0.5);
  ctx.restore();
}

function drawItem(item, rect, renderState, clean) {
  if (item.visible === false) return;
  const renderItem = resolvedItemPose(item, renderState);
  const point = toCanvas(renderItem, rect);
  const radius = itemRadius(renderItem, rect);
  const isSelected =
    selected?.id === item.id && (selected.kind === "item" || selected.kind === "facing");
  const isActive = !clean && isSelected && renderState === state;

  ctx.save();
  if (isActive) {
    ctx.strokeStyle = "#fff2ed";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius + 5, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.translate(point.x, point.y);
  ctx.rotate(degToRad(renderItem.facing));
  if (item.type === "prop" && item.assetType !== "generic") {
    const maxAxis = Math.max(Number(item.scaleX || 1), Number(item.scaleZ || 1), 0.01);
    ctx.save();
    ctx.scale(Number(item.scaleX || 1) / maxAxis, Number(item.scaleZ || 1) / maxAxis);
    drawPropFootprint(item, radius);
    ctx.restore();
  } else {
    drawShapePath(item.shape, radius);
    ctx.fillStyle = item.color;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.82)";
    ctx.lineWidth = Math.max(2, radius * 0.08);
    ctx.stroke();
  }

  const showDirection = item.type === "actor" || !["nature", "architecture"].includes(propDefinition(item.assetType).kind);
  if (showDirection) {
    ctx.strokeStyle = item.color;
    ctx.fillStyle = item.color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(radius * 0.52, 0);
    ctx.lineTo(radius * 1.55, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(radius * 1.74, 0);
    ctx.lineTo(radius * 1.32, -radius * 0.32);
    ctx.lineTo(radius * 1.32, radius * 0.32);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  if (renderState.showNames && (isActive || renderState.planReferenceExport) && !(clean && renderState.cleanExport)) {
    drawLabel(`@${item.name}`, point.x, point.y + radius + 21);
  }

  if (isActive && !renderItem.autoMounted && isGroupLeader(item, renderState)) drawFacingHandle(renderItem, rect, radius);
}

function itemRadius(item, rect = stageRect) {
  const footprint = item.type === "prop" ? propDefinition(item.assetType).footprint || 0.7 : 1;
  const axisScale = item.type === "prop" ? Math.max(Number(item.scaleX || 1), Number(item.scaleZ || 1)) : 1;
  return Math.min(rect.w, rect.h) * 0.035 * item.size * Math.sqrt(footprint) * axisScale;
}

function drawPropFootprint(item, radius) {
  const assetType = item.assetType;
  const fill = item.color;
  const stroke = "rgba(242,248,250,0.88)";
  ctx.lineWidth = Math.max(1.5, radius * 0.07);
  ctx.strokeStyle = stroke;
  ctx.fillStyle = fill;

  if (assetType === "car" || assetType === "bus") {
    const length = radius * (assetType === "bus" ? 3.5 : 2.6);
    const width = radius * (assetType === "bus" ? 1.15 : 1.05);
    roundRect(ctx, -length / 2, -width / 2, length, width, radius * 0.22);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(190,229,245,0.72)";
    const windowCount = assetType === "bus" ? 5 : 2;
    for (let index = 0; index < windowCount; index += 1) {
      const x = -length * 0.28 + index * (length * 0.56 / Math.max(1, windowCount - 1));
      ctx.fillRect(x - radius * 0.18, -width * 0.31, radius * 0.36, width * 0.62);
    }
    ctx.fillStyle = "#12181d";
    [[-0.31, -0.55], [0.31, -0.55], [-0.31, 0.55], [0.31, 0.55]].forEach(([x, y]) => {
      ctx.fillRect(x * length - radius * 0.13, y * width - radius * 0.1, radius * 0.26, radius * 0.2);
    });
    return;
  }
  if (assetType === "motorcycle" || assetType === "bicycle") {
    const span = radius * 1.55;
    ctx.lineWidth = Math.max(2, radius * 0.1);
    ctx.beginPath();
    ctx.arc(-span / 2, 0, radius * 0.42, 0, Math.PI * 2);
    ctx.moveTo(span / 2 + radius * 0.42, 0);
    ctx.arc(span / 2, 0, radius * 0.42, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-span / 2, 0);
    ctx.lineTo(0, -radius * 0.42);
    ctx.lineTo(span / 2, 0);
    ctx.lineTo(0, radius * 0.34);
    ctx.closePath();
    ctx.stroke();
    if (assetType === "motorcycle") {
      ctx.beginPath();
      ctx.ellipse(0, 0, radius * 0.45, radius * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }
  if (assetType === "tree" || assetType === "forest") {
    const clusters = assetType === "forest"
      ? [[-0.55, -0.25, 0.56], [0.35, -0.42, 0.62], [0.52, 0.38, 0.48], [-0.38, 0.48, 0.52], [0, 0, 0.68]]
      : [[0, 0, 0.72]];
    clusters.forEach(([x, y, scale]) => {
      ctx.beginPath();
      ctx.arc(x * radius, y * radius, scale * radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
    ctx.fillStyle = "#5d3f2b";
    ctx.fillRect(-radius * 0.12, -radius * 0.12, radius * 0.24, radius * 0.24);
    return;
  }
  if (assetType === "room") {
    ctx.strokeStyle = "rgba(188,205,214,0.88)";
    ctx.lineWidth = Math.max(4, radius * 0.12);
    ctx.beginPath();
    ctx.moveTo(radius * 1.55, radius * 1.05);
    ctx.lineTo(-radius * 1.55, radius * 1.05);
    ctx.lineTo(-radius * 1.55, -radius * 1.05);
    ctx.lineTo(radius * 1.55, -radius * 1.05);
    ctx.stroke();
    ctx.fillStyle = "rgba(130,144,154,0.12)";
    ctx.fillRect(-radius * 1.5, -radius, radius * 3, radius * 2);
    return;
  }

  const w = radius * (assetType === "sofa" || assetType === "bed" ? 2.3 : 1.35);
  const h = radius * (assetType === "dining-table" || assetType === "bed" ? 1.4 : 1.05);
  roundRect(ctx, -w / 2, -h / 2, w, h, radius * 0.14);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = "rgba(20,28,34,0.62)";
  ctx.lineWidth = Math.max(1.5, radius * 0.06);
  if (assetType === "sofa") {
    ctx.strokeRect(-w * 0.38, -h * 0.28, w * 0.76, h * 0.56);
    ctx.beginPath();
    ctx.moveTo(0, -h * 0.28);
    ctx.lineTo(0, h * 0.28);
    ctx.stroke();
  } else if (assetType === "television") {
    ctx.fillStyle = "#101c24";
    ctx.fillRect(-w * 0.38, -h * 0.3, w * 0.76, h * 0.6);
  } else if (assetType === "washing-machine") {
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.34, 0, Math.PI * 2);
    ctx.stroke();
  } else if (assetType === "stove") {
    [[-0.25, -0.22], [0.25, -0.22], [-0.25, 0.22], [0.25, 0.22]].forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(x * radius, y * radius, radius * 0.12, 0, Math.PI * 2);
      ctx.stroke();
    });
  } else if (assetType === "refrigerator" || assetType === "cabinet") {
    ctx.beginPath();
    ctx.moveTo(0, -h / 2);
    ctx.lineTo(0, h / 2);
    ctx.stroke();
  }
}

function facingHandlePoint(item, rect = stageRect) {
  const center = toCanvas(item, rect);
  const radius = itemRadius(item, rect);
  const angle = degToRad(item.facing);
  return {
    x: center.x + Math.cos(angle) * radius * 2.35,
    y: center.y + Math.sin(angle) * radius * 2.35,
  };
}

function drawFacingHandle(item, rect, radius) {
  const center = toCanvas(item, rect);
  const handle = facingHandlePoint(item, rect);
  ctx.save();
  ctx.strokeStyle = "rgba(244, 255, 232, 0.74)";
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(center.x, center.y);
  ctx.lineTo(handle.x, handle.y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = item.color;
  ctx.strokeStyle = "#fff2ed";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(handle.x, handle.y, Math.max(7, radius * 0.32), 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawShapePath(shape, radius) {
  ctx.beginPath();
  if (shape === "circle" || shape === "pill") {
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    return;
  }
  const sides = shape === "triangle" ? 3 : shape === "square" ? 4 : shape === "pentagon" ? 5 : shape === "hex" ? 6 : 4;
  if (shape === "star") {
    for (let i = 0; i < 10; i += 1) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 === 0 ? radius : radius * 0.48;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    return;
  }
  const rotation = shape === "diamond" ? Math.PI / 4 : shape === "triangle" ? -Math.PI / 2 : -Math.PI / 4;
  for (let i = 0; i < sides; i += 1) {
    const a = rotation + (i * Math.PI * 2) / sides;
    const x = Math.cos(a) * radius;
    const y = Math.sin(a) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function drawLabel(text, x, y) {
  ctx.save();
  ctx.font = "700 12px ui-monospace, SFMono-Regular, Menlo, monospace";
  const metrics = ctx.measureText(text);
  const w = metrics.width + 14;
  const h = 22;
  ctx.fillStyle = "rgba(5, 7, 8, 0.78)";
  roundRect(ctx, x - w / 2, y - h / 2, w, h, 5);
  ctx.fill();
  ctx.fillStyle = "#e7eee7";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y + 0.5);
  ctx.restore();
}

function drawFooter(renderState, rect) {
  ctx.save();
  ctx.fillStyle = "rgba(219, 231, 226, 0.4)";
  ctx.font = "700 11px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  const actors = renderState.items.filter((item) => item.type === "actor").length;
  const props = renderState.items.filter((item) => item.type === "prop").length;
  const size = stageWorldSize(renderState);
  ctx.fillText(
    `${renderState.aspect} · 무대 ${size.width.toFixed(0)}×${size.depth.toFixed(1)}m · 배우 ${actors} · 소품 ${props} · ${renderState.camera.focal}mm · H ${Number(renderState.camera.height ?? 1.6).toFixed(1)}m · P ${Math.round(renderState.camera.panDeg)}° · T ${Math.round(renderState.camera.tiltDeg)}°`,
    rect.x + rect.w / 2,
    rect.y + rect.h - 12,
  );
  ctx.restore();
}

function roundRect(context, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + w, y, x + w, y + h, radius);
  context.arcTo(x + w, y + h, x, y + h, radius);
  context.arcTo(x, y + h, x, y, radius);
  context.arcTo(x, y, x + w, y, radius);
  context.closePath();
}

function pointerPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

function hitTest(point, renderState = evaluatedViewState || state) {
  const item = selected?.id ? renderState.items.find((entry) => entry.id === selected.id) : null;
  if (item && isGroupLeader(item, renderState)) {
    const handle = facingHandlePoint(item);
    if (distance(point, handle) < 18) return { kind: "facing", id: item.id };
  }

  const cam = toCanvas({ x: renderState.camera.x, y: renderState.camera.y });
  if (distance(point, cam) < 24) return { kind: "camera" };

  for (let i = renderState.items.length - 1; i >= 0; i -= 1) {
    const hitItem = renderState.items[i];
    if (hitItem.visible === false) continue;
    const resolved = resolvedItemPose(hitItem, renderState);
    const p = toCanvas(resolved);
    const r = itemRadius(resolved) * 1.28;
    if (distance(point, p) <= r) return { kind: "item", id: hitItem.id };
  }
  return null;
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function hitTestPathBadge(point, renderState = evaluatedViewState || state) {
  const keyframes = sortKeyframes(renderState.motion?.keyframes || []);
  const hits = keyframes.map((keyframe) => {
    const active = keyframe.id === renderState.motion?.selectedKeyId;
    const center = pathOrderBadgeCenter(toCanvas(keyframe.pose), active);
    return { keyframe, center, distance: distance(point, center) };
  }).filter((entry) => entry.distance <= 15);
  return hits.sort((a, b) => Number(b.keyframe.id === renderState.motion?.selectedKeyId)
    - Number(a.keyframe.id === renderState.motion?.selectedKeyId) || a.distance - b.distance)[0] || null;
}

function hitTestFreeCurveHandle(point, renderState = evaluatedViewState || state) {
  const segment = selectedFreeCurveSegment(renderState);
  if (!segment?.control) return null;
  const center = toCanvas(segment.control);
  return distance(point, center) <= 15 ? { keyframeId: segment.keyframe.id, center } : null;
}

function beginKeyBadgePress(event, hit, point) {
  event.preventDefault();
  if (sourceSpatialLocked(hit.keyframe.source)) {
    selectKeyframe(hit.keyframe.id);
    notifyEditLocked(sourceLabel(hit.keyframe.source));
    return;
  }
  const press = {
    keyframeId: hit.keyframe.id,
    pointerId: event.pointerId,
    point,
    startState: clone(state),
    timer: 0,
  };
  press.timer = window.setTimeout(() => activateKeyBadgeDrag(press), 280);
  keyBadgePress = press;
  canvas.setPointerCapture(event.pointerId);
}

function activateKeyBadgeDrag(press) {
  if (keyBadgePress !== press) return;
  const keyframe = state.motion.keyframes.find((entry) => entry.id === press.keyframeId);
  if (!keyframe) return;
  setActiveSource(keyframe.source);
  selectSourceOnStage(keyframe.source);
  state.motion.selectedKeyId = keyframe.id;
  state.motion.playhead = keyframe.time;
  applySourcePose(keyframe.source, keyframe.pose);
  const posePoint = toCanvas(keyframe.pose);
  keyBadgeDrag = {
    keyframeId: keyframe.id,
    pointerId: press.pointerId,
    offset: { x: press.point.x - posePoint.x, y: press.point.y - posePoint.y },
    changed: false,
    startState: press.startState,
  };
  keyBadgePress = null;
  syncUi();
  draw();
}

function magneticSnapKeyPose(keyframe, target) {
  const neighbors = state.motion.keyframes
    .filter((entry) => entry.source === keyframe.source && entry.id !== keyframe.id)
    .map((entry) => entry.pose);
  const threshold = 14;
  let nearestX = null;
  let nearestY = null;
  neighbors.forEach((pose) => {
    const xDistance = Math.abs(target.x - pose.x) * stageRect.w;
    const yDistance = Math.abs(target.y - pose.y) * stageRect.h;
    if (xDistance <= threshold && (!nearestX || xDistance < nearestX.distance)) nearestX = { value: pose.x, distance: xDistance };
    if (yDistance <= threshold && (!nearestY || yDistance < nearestY.distance)) nearestY = { value: pose.y, distance: yDistance };
  });
  pathSnapGuide = {
    x: nearestX?.value ?? null,
    y: nearestY?.value ?? null,
  };
  return {
    x: nearestX?.value ?? target.x,
    y: nearestY?.value ?? target.y,
  };
}

function updateKeyBadgeDrag(point) {
  const keyframe = state.motion.keyframes.find((entry) => entry.id === keyBadgeDrag?.keyframeId);
  if (!keyframe) return;
  const targetCanvas = { x: point.x - keyBadgeDrag.offset.x, y: point.y - keyBadgeDrag.offset.y };
  const target = magneticSnapKeyPose(keyframe, fromCanvas(targetCanvas));
  keyframe.pose.x = target.x;
  keyframe.pose.y = target.y;
  applySourcePose(keyframe.source, keyframe.pose);
  applyCameraTracking(state);
  keyBadgeDrag.changed = true;
  syncUi(false);
  draw();
}

function finishKeyBadgeInteraction(event) {
  if (keyBadgeDrag) {
    const keyframe = state.motion.keyframes.find((entry) => entry.id === keyBadgeDrag.keyframeId);
    const changed = keyBadgeDrag.changed;
    if (keyframe) reconcileSourcePathConstraints(keyframe.source);
    keyBadgeDrag = null;
    keyBadgePress = null;
    pathSnapGuide = null;
    canvas.releasePointerCapture?.(event.pointerId);
    if (changed) commit();
    else draw();
    return true;
  }
  if (!keyBadgePress) return false;
  clearTimeout(keyBadgePress.timer);
  const keyframeId = keyBadgePress.keyframeId;
  keyBadgePress = null;
  canvas.releasePointerCapture?.(event.pointerId);
  selectKeyframe(keyframeId);
  return true;
}

function beginCurveHandleDrag(event, hit) {
  event.preventDefault();
  curveHandleDrag = {
    keyframeId: hit.keyframeId,
    pointerId: event.pointerId,
    changed: false,
    startState: clone(state),
  };
  canvas.setPointerCapture(event.pointerId);
}

function updateCurveHandleDrag(point) {
  const keyframe = state.motion.keyframes.find((entry) => entry.id === curveHandleDrag?.keyframeId);
  if (!keyframe || pathModeForSegment(keyframe.segment, keyframe.source) !== "free-curve") return;
  const target = fromCanvas(point);
  keyframe.segment.plan.control = target;
  curveHandleDrag.changed = true;
  draw();
}

function beginStagePan(event) {
  stagePanDrag = {
    pointerId: event.pointerId,
    clientX: event.clientX,
    clientY: event.clientY,
    scrollLeft: stageViewport.scrollLeft,
    scrollTop: stageViewport.scrollTop,
  };
  if (stageSpaceHeld) stageSpacePanUsed = true;
  stageViewport.classList.add("is-panning");
  stageViewport.setPointerCapture?.(event.pointerId);
  event.preventDefault();
  event.stopPropagation();
}

function updateStagePan(event) {
  if (!stagePanDrag || stagePanDrag.pointerId !== event.pointerId) return;
  stageViewport.scrollLeft = stagePanDrag.scrollLeft - (event.clientX - stagePanDrag.clientX);
  stageViewport.scrollTop = stagePanDrag.scrollTop - (event.clientY - stagePanDrag.clientY);
  event.preventDefault();
}

function endStagePan(event) {
  if (!stagePanDrag || stagePanDrag.pointerId !== event.pointerId) return;
  stageViewport.releasePointerCapture?.(event.pointerId);
  stagePanDrag = null;
  stageViewport.classList.remove("is-panning");
  event.preventDefault();
}

function stagePointHasEditableTarget(event) {
  if (event.target !== canvas) return false;
  const point = pointerPoint(event);
  return Boolean(
    hitTestFreeCurveHandle(point)
    || hitTestPathBadge(point)
    || hitTest(point)
  );
}

stageViewport.addEventListener("pointerdown", (event) => {
  const blankCanvasPan = event.button === 0
    && stageZoom > STAGE_ZOOM_MIN + 0.001
    && event.target === canvas
    && !stagePointHasEditableTarget(event);
  const shouldPan = event.button === 1
    || (event.button === 0 && stageSpaceHeld)
    || blankCanvasPan;
  if (shouldPan) beginStagePan(event);
}, true);
stageViewport.addEventListener("pointermove", updateStagePan);
stageViewport.addEventListener("pointerup", endStagePan);
stageViewport.addEventListener("pointercancel", endStagePan);
stageViewport.addEventListener("auxclick", (event) => {
  if (event.button === 1) event.preventDefault();
});
stageViewport.addEventListener("wheel", (event) => {
  if (viewMode !== "2d") return;
  event.preventDefault();
  const factor = clamp(Math.exp(-event.deltaY * 0.0015), 0.82, 1.22);
  setStageZoom(stageZoom * factor, event);
}, { passive: false });

$("#stageZoomOutBtn").addEventListener("click", () => setStageZoom(stageZoom - 0.25));
$("#stageZoomInBtn").addEventListener("click", () => setStageZoom(stageZoom + 0.25));
$("#stageZoomFitBtn").addEventListener("click", () => {
  setStageZoom(1);
  requestAnimationFrame(() => centerStageOnContent());
});

canvas.addEventListener("pointerdown", (event) => {
  syncPlayheadFromTimeInput();
  const point = pointerPoint(event);
  const curveHandle = hitTestFreeCurveHandle(point);
  if (curveHandle) {
    const curveKey = state.motion.keyframes.find((entry) => entry.id === curveHandle.keyframeId);
    if (curveKey && sourceSpatialLocked(curveKey.source)) {
      notifyEditLocked(sourceLabel(curveKey.source));
      return;
    }
    beginCurveHandleDrag(event, curveHandle);
    return;
  }
  const pathBadge = hitTestPathBadge(point);
  if (pathBadge) {
    beginKeyBadgePress(event, pathBadge, point);
    return;
  }
  const hit = hitTest(point);
  if (hit) {
    selected = hit;
    const sourceId = selectedSourceId();
    if (sourceId) {
      setActiveSource(sourceId);
      selectKeyForSource(sourceId);
    }
    const editItemId = hit.kind === "item" ? transformLeaderIdForItem(hit.id, state) : hit.id;
    const locked = hit.kind === "camera"
      ? cameraFieldLocked("position")
      : sourceEditLocked(editItemId);
    const editStartState = clone(state);
    if (!locked) materializeEvaluatedViewForEditing(editItemId);
    drag = locked ? null : {
      selection: clone(hit),
      editItemId,
      startState: editStartState,
      pointerId: event.pointerId,
    };
    if (drag) canvas.setPointerCapture(event.pointerId);
    else notifyEditLocked(hit.kind === "camera" ? "카메라 위치" : sourceLabel(editItemId));
  } else {
    selected = { kind: "camera" };
  }
  syncUi();
  draw();
});

canvas.addEventListener("pointermove", (event) => {
  const point = pointerPoint(event);
  if (curveHandleDrag && event.pointerId === curveHandleDrag.pointerId) {
    updateCurveHandleDrag(point);
    return;
  }
  if (keyBadgeDrag && event.pointerId === keyBadgeDrag.pointerId) {
    updateKeyBadgeDrag(point);
    return;
  }
  if (keyBadgePress && event.pointerId === keyBadgePress.pointerId) return;
  if (!drag) return;
  const normalized = fromCanvas(point);
  if (drag.selection.kind === "item") {
    const item = state.items.find((entry) => entry.id === drag.editItemId);
    if (item) {
      item.x = normalized.x;
      item.y = normalized.y;
      item.facing = dragFacingIfNeeded(event, item, point);
    }
  } else if (drag.selection.kind === "facing") {
    const item = state.items.find((entry) => entry.id === drag.selection.id);
    if (item) {
      item.facing = faceItemTowardPoint(item, point);
    }
  } else if (drag.selection.kind === "camera") {
    state.camera.x = normalized.x;
    state.camera.y = normalized.y;
    syncCameraDerivedAim(state.camera, state);
  }
  applyCameraTracking(state);
  syncUi(false);
  draw();
});

canvas.addEventListener("pointerup", (event) => {
  if (curveHandleDrag && event.pointerId === curveHandleDrag.pointerId) {
    const changed = curveHandleDrag.changed;
    curveHandleDrag = null;
    canvas.releasePointerCapture?.(event.pointerId);
    if (changed) commit();
    return;
  }
  if ((keyBadgeDrag && event.pointerId === keyBadgeDrag.pointerId)
    || (keyBadgePress && event.pointerId === keyBadgePress.pointerId)) {
    finishKeyBadgeInteraction(event);
    return;
  }
  if (!drag) return;
  canvas.releasePointerCapture(event.pointerId);
  drag = null;
  commit();
});

canvas.addEventListener("pointercancel", (event) => {
  const cancelledState = drag?.startState || keyBadgeDrag?.startState || curveHandleDrag?.startState || null;
  if (keyBadgePress) clearTimeout(keyBadgePress.timer);
  keyBadgePress = null;
  keyBadgeDrag = null;
  curveHandleDrag = null;
  pathSnapGuide = null;
  drag = null;
  canvas.releasePointerCapture?.(event.pointerId);
  if (cancelledState) restoreUncommittedState(cancelledState);
  else draw();
});

function dragFacingIfNeeded(event, item, point) {
  if (!event.shiftKey) return item.facing;
  return faceItemTowardPoint(item, point);
}

function faceItemTowardPoint(item, point) {
  const p = toCanvas(item);
  return Math.round(radToDeg(Math.atan2(point.y - p.y, point.x - p.x)));
}

document.addEventListener("keydown", (event) => {
  if (event.key === "F1") {
    event.preventDefault();
    toggleManual();
    return;
  }
  const command = event.metaKey || event.ctrlKey;
  if (command && event.key.toLowerCase() === "s") {
    if (document.querySelector("dialog[open]")) notifyApp("열린 창을 닫은 뒤 프로젝트를 저장하세요.");
    else saveManagedProject({ interactive: true });
    event.preventDefault();
    return;
  }
  if (event.target.matches("input, textarea, select, [contenteditable='true']")) return;
  if (command && event.key === "1") {
    setWorkspaceMode("storyboard");
    event.preventDefault();
    return;
  }
  if (command && event.key === "2") {
    setWorkspaceMode("blocking");
    setViewMode("2d");
    event.preventDefault();
    return;
  }
  if (command && event.key === "3") {
    setWorkspaceMode("blocking");
    setViewMode("3d");
    event.preventDefault();
    return;
  }
  if (workspaceMode === "blocking" && viewMode === "3d" && !command && ["g", "r", "p"].includes(event.key.toLowerCase())) {
    const shortcutModes = { g: "move", r: "rotate", p: "pose" };
    setThreeEditMode(shortcutModes[event.key.toLowerCase()], { announce: true });
    event.preventDefault();
    return;
  }
  if (workspaceMode === "storyboard" && event.altKey && ["ArrowLeft", "ArrowRight"].includes(event.key)) {
    moveProjectCut(activeCutId, event.key === "ArrowLeft" ? -1 : 1);
    event.preventDefault();
    return;
  }
  if (workspaceMode === "blocking" && event.code === "Space") {
    if (viewMode === "2d") {
      if (!event.repeat) {
        stageSpaceHeld = true;
        stageSpacePanUsed = false;
        stageViewport.classList.add("is-space-ready");
      }
    } else {
      preview ? pausePreview() : playPreview();
    }
    event.preventDefault();
    return;
  }
  if (workspaceMode === "blocking" && event.key.toLowerCase() === "k") {
    event.shiftKey ? updateSelectedKey() : addMotionKey();
    event.preventDefault();
    return;
  }
  if (workspaceMode === "blocking" && ["[", "]"].includes(event.key)) {
    const keys = sortKeyframes(state.motion.keyframes);
    if (keys.length) {
      const currentIndex = Math.max(0, keys.findIndex((keyframe) => keyframe.id === state.motion.selectedKeyId));
      const direction = event.key === "[" ? -1 : 1;
      const next = keys[(currentIndex + direction + keys.length) % keys.length];
      selectKeyframe(next.id);
    }
    event.preventDefault();
    return;
  }
  const item = selectedItem();
  if (event.key === "Delete" || event.key === "Backspace") {
    if (item) {
      deleteSelected();
      event.preventDefault();
    }
  }
  const nudgeKeys = {
    ArrowUp: [0, -1],
    ArrowRight: [1, 0],
    ArrowDown: [0, 1],
    ArrowLeft: [-1, 0],
  };
  if (item && nudgeKeys[event.key]) {
    nudge(item, nudgeKeys[event.key][0], nudgeKeys[event.key][1], event.shiftKey ? 0.025 : 0.008);
    event.preventDefault();
  }
  if (command && event.key.toLowerCase() === "z") {
    event.shiftKey ? redo() : undo();
    event.preventDefault();
  }
});

document.addEventListener("keyup", (event) => {
  if (event.code !== "Space" || !stageSpaceHeld) return;
  stageSpaceHeld = false;
  stageViewport.classList.remove("is-space-ready");
  if (!stageSpacePanUsed && workspaceMode === "blocking" && viewMode === "2d") {
    preview ? pausePreview() : playPreview();
  }
  stageSpacePanUsed = false;
  event.preventDefault();
});

window.addEventListener("blur", () => {
  stageSpaceHeld = false;
  stageSpacePanUsed = false;
  stagePanDrag = null;
  stageViewport.classList.remove("is-space-ready", "is-panning");
});

function syncUi(updateInputs = true) {
  $$("#viewButtons button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === viewMode);
  });
  syncWorkspaceNavigationState();
  syncHistoryButtons();
  syncPlaybackControls();
  $$("#aspectButtons button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.aspect === state.aspect);
  });
  $("#gridToggle").checked = state.showGrid;
  $("#namesToggle").checked = state.showNames;
  $("#cameraToggle").checked = state.showCamera;
  $("#cleanExportToggle").checked = state.cleanExport;
  $("#focalSlider").value = state.camera.focal;
  $("#focalValue").value = state.camera.focal;
  $("#cameraHeightSlider").value = state.camera.height;
  $("#cameraHeightValue").value = Number(state.camera.height).toFixed(2);
  $("#cameraPanSlider").value = state.camera.panDeg;
  $("#cameraPanValue").value = Math.round(state.camera.panDeg);
  $("#cameraTiltSlider").value = state.camera.tiltDeg;
  $("#cameraTiltValue").value = Math.round(state.camera.tiltDeg);
  renderCameraLockControls();
  $("#focalSlider").disabled = cameraFieldLocked("lens");
  $("#focalValue").disabled = cameraFieldLocked("lens");
  $("#cameraHeightSlider").disabled = cameraFieldLocked("height");
  $("#cameraHeightValue").disabled = cameraFieldLocked("height");
  $("#cameraHeightKeyBtn").disabled = cameraFieldLocked("height");
  $("#cameraPanSlider").disabled = Boolean(state.camera.trackingTargetId) || cameraFieldLocked("orientation");
  $("#cameraPanValue").disabled = Boolean(state.camera.trackingTargetId) || cameraFieldLocked("orientation");
  $("#cameraTiltSlider").disabled = Boolean(state.camera.trackingTargetId) || cameraFieldLocked("orientation");
  $("#cameraTiltValue").disabled = Boolean(state.camera.trackingTargetId) || cameraFieldLocked("orientation");
  $("#trackingTargetSelect").disabled = cameraFieldLocked("orientation");
  $$("#focalPresets button").forEach((button) => {
    button.classList.toggle("is-active", Number(button.dataset.focal) === Number(state.camera.focal));
    button.disabled = cameraFieldLocked("lens");
  });
  $("#durationInput").value = state.motion.duration;
  $("#durationInput").disabled = hasLockedTimelineSources();
  $("#fpsInput").value = state.motion.fps;
  $("#keyTimeInput").max = MAX_TIMELINE_DURATION;
  $("#sceneTitle").value = state.sceneTitle;
  $("#sceneIntent").value = state.sceneIntent;
  $$("#timelineMode button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.timelineView === state.motion.timelineView);
  });
  $(".canvas-wrap").style.setProperty("--stage-ratio", aspectMap[state.aspect] || 16 / 9);
  $$("[data-environment-preset]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.environmentPreset === state.spacePresetId);
  });

  renderObjectLists();
  renderTrackingTargetSelect(updateInputs);
  renderProperties(updateInputs);
  renderSourceSelect();
  renderKeyStatus(updateInputs);
  renderThreeEditControls();
  syncProjectChrome();
}

function renderCameraLockControls() {
  const locks = sanitizeCameraLocks(state.camera?.locks);
  const labels = { position: "위치", orientation: "회전", lens: "렌즈", height: "높이" };
  const lockedLabels = Object.keys(labels).filter((field) => locks[field]).map((field) => labels[field]);
  $("#cameraLockStatus").textContent = lockedLabels.length ? `${lockedLabels.join(" · ")} 잠김` : "모두 편집 가능";
  $$("#cameraLockControls [data-camera-lock]").forEach((button) => {
    const locked = locks[button.dataset.cameraLock] === true;
    button.classList.toggle("is-locked", locked);
    button.setAttribute("aria-pressed", String(locked));
    const icon = button.querySelector("i, svg");
    if (icon) icon.setAttribute("data-lucide", locked ? "lock" : cameraLockIcon(button.dataset.cameraLock));
  });
  refreshLucideIcons();
}

function cameraLockIcon(field) {
  if (field === "position") return "move";
  if (field === "orientation") return "rotate-cw";
  if (field === "lens") return "aperture";
  return "arrow-up-down";
}

const storyboardStatusLabels = {
  draft: "초안",
  blocking: "블로킹 중",
  review: "검토 필요",
  approved: "확정",
};

const storyboardStatusColors = {
  draft: "#a4a7ae",
  blocking: "#66c8be",
  review: "#e3b264",
  approved: "#7bd382",
};

function refreshLucideIcons() {
  window.lucide?.createIcons({ attrs: { "stroke-width": 1.8 } });
}

function setProjectSaveStatus(status) {
  const requestedStatus = ["changed", "prepared", "saving", "saved", "conflict", "error"].includes(status) ? status : "changed";
  projectSaveStatus = requestedStatus === "changed" && managedSaveConflict ? "conflict" : requestedStatus;
  if (projectSaveStatus === "saved" && managedProjectId && project) {
    managedSavedFingerprint = captureProjectSnapshot();
  }
  const element = $("#projectSaveState");
  if (!element) return;
  const labels = {
    changed: "변경됨",
    prepared: "백업 준비",
    saving: "저장 중",
    saved: "저장됨",
    conflict: "저장 충돌",
    error: "저장 실패",
  };
  element.dataset.status = projectSaveStatus;
  element.lastChild.textContent = labels[projectSaveStatus];
  if ($("#jsonBtn")) $("#jsonBtn").disabled = projectSaveStatus === "saving";
  if (projectSaveStatus === "changed" && managedProjectId && !suppressManagedAutosave) {
    scheduleManagedAutosave();
    scheduleManagedProjectRecovery();
  } else if (projectSaveStatus === "conflict") {
    cancelManagedAutosave();
    scheduleManagedProjectRecovery();
  } else if (projectSaveStatus !== "changed") {
    cancelManagedAutosave();
  }
}

function cancelManagedAutosave() {
  if (managedAutosaveTimer) clearTimeout(managedAutosaveTimer);
  managedAutosaveTimer = null;
}

function scheduleManagedAutosave() {
  if (managedAutosaveTimer || managedSaveInFlight || !managedProjectId || suppressManagedAutosave) return;
  managedAutosaveTimer = setTimeout(() => {
    managedAutosaveTimer = null;
    saveManagedProject({ interactive: false });
  }, 2600);
}

function clearManagedProjectBinding() {
  cancelManagedAutosave();
  cancelManagedProjectRecovery();
  managedProjectId = "";
  managedProjectRevision = 0;
  managedProjectUpdatedAt = "";
  managedSavedFingerprint = "";
  managedSaveConflict = false;
  try {
    window.localStorage.removeItem(LAST_MANAGED_PROJECT_KEY);
  } catch {
    // Project management still works when browser storage is unavailable.
  }
}

const liveProjectInputIds = new Set([
  "focalSlider", "focalValue", "cameraHeightSlider", "cameraHeightValue",
  "cameraPanSlider", "cameraPanValue", "cameraTiltSlider", "cameraTiltValue",
  "selectedName", "sizeSlider", "sizeValue", "propScaleX", "propScaleXValue",
  "propScaleY", "propScaleYValue", "propScaleZ", "propScaleZValue",
  "facingSlider", "facingValue", "sceneTitle", "sceneIntent",
  "actorPoseAxisX", "actorPoseAxisXValue", "actorPoseAxisY", "actorPoseAxisYValue",
  "actorPoseAxisZ", "actorPoseAxisZValue",
]);

function markLiveProjectInputDirty() {
  syncActiveCutDocument(true);
  setProjectSaveStatus("changed");
}

function finalizeLiveProjectInputEdit() {
  evaluatedViewState = null;
  applyCameraTracking(state);
  history.push(snapshot());
  if (history.length > 80) history.shift();
  future = [];
  syncActiveCutDocument(false);
  if (!managedProjectId || hasUnsavedProjectChanges()) setProjectSaveStatus("changed");
  syncUi();
  draw();
  syncProjectChrome();
}

document.addEventListener("input", (event) => {
  if (liveProjectInputIds.has(event.target?.id)) markLiveProjectInputDirty();
});

function rememberManagedProject(projectId) {
  try {
    window.localStorage.setItem(LAST_MANAGED_PROJECT_KEY, projectId);
  } catch {
    // Recent-project resume is optional when browser storage is unavailable.
  }
}

function notifyApp(message) {
  const toast = $("#appToast");
  if (!toast) return;
  clearTimeout(appToastTimer);
  toast.textContent = String(message || "");
  toast.classList.add("is-visible");
  appToastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2400);
}

function hasSeenTutorial() {
  try {
    return window.localStorage.getItem(TUTORIAL_STORAGE_KEY) === "seen";
  } catch {
    return false;
  }
}

function rememberTutorialSeen() {
  try {
    window.localStorage.setItem(TUTORIAL_STORAGE_KEY, "seen");
  } catch {
    // The tutorial still works when browser storage is unavailable.
  }
}

function prepareTutorialStep(step) {
  const nextWorkspace = step.workspace === "storyboard" ? "storyboard" : "blocking";
  if (workspaceMode !== nextWorkspace) setWorkspaceMode(nextWorkspace);
  if (nextWorkspace === "blocking" && step.view && viewMode !== step.view) setViewMode(step.view);
  if (step.prepare === "actor-properties") {
    const actor = state.items.find((item) => item.type === "actor");
    if (actor) {
      selected = { kind: "item", id: actor.id };
      setActiveSource(transformLeaderIdForItem(actor.id, state));
      syncUi();
      draw();
    }
  }
  const seedTarget = step.selector ? $(step.selector) : null;
  const details = step.openDetails ? seedTarget?.closest("details") : null;
  if (details) details.open = true;
}

function tutorialTarget(step = tutorialSteps[tutorialIndex]) {
  let target = step?.selector ? $(step.selector) : null;
  if ((!target || target.hidden) && step?.fallbackSelector) target = $(step.fallbackSelector);
  if (target && step?.highlightClosest) target = target.closest(step.highlightClosest) || target;
  if (!target || target.hidden) return null;
  return target;
}

function tutorialCardPosition(targetRect, cardRect) {
  const margin = 14;
  const gap = 14;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const cardWidth = cardRect.width || 360;
  const cardHeight = cardRect.height || 300;
  const fitsRight = viewportWidth - targetRect.right >= cardWidth + gap + margin;
  const fitsLeft = targetRect.left >= cardWidth + gap + margin;
  const fitsBelow = viewportHeight - targetRect.bottom >= cardHeight + gap + margin;
  const fitsAbove = targetRect.top >= cardHeight + gap + margin;
  let left;
  let top;

  if (fitsRight) {
    left = targetRect.right + gap;
    top = targetRect.top + targetRect.height / 2 - cardHeight / 2;
  } else if (fitsLeft) {
    left = targetRect.left - cardWidth - gap;
    top = targetRect.top + targetRect.height / 2 - cardHeight / 2;
  } else if (fitsBelow) {
    left = targetRect.left + targetRect.width / 2 - cardWidth / 2;
    top = targetRect.bottom + gap;
  } else if (fitsAbove) {
    left = targetRect.left + targetRect.width / 2 - cardWidth / 2;
    top = targetRect.top - cardHeight - gap;
  } else {
    left = viewportWidth - cardWidth - margin;
    top = Math.max(70, Math.min(targetRect.top, viewportHeight - cardHeight - margin));
  }
  return {
    left: clamp(left, margin, viewportWidth - cardWidth - margin),
    top: clamp(top, margin, viewportHeight - cardHeight - margin),
  };
}

function positionTutorial() {
  if (!tutorialOpen) return;
  const card = $("#tutorialCard");
  const spotlight = $("#tutorialSpotlight");
  const target = tutorialTarget();
  if (!card || !spotlight) return;
  if (!target) {
    spotlight.classList.add("is-hidden");
    const cardRect = card.getBoundingClientRect();
    card.style.left = `${Math.max(14, (window.innerWidth - cardRect.width) / 2)}px`;
    card.style.top = `${Math.max(14, (window.innerHeight - cardRect.height) / 2)}px`;
    return;
  }
  const rect = target.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const padding = 7;
  const left = clamp(rect.left - padding, 5, window.innerWidth - 25);
  const top = clamp(rect.top - padding, 5, window.innerHeight - 25);
  const width = clamp(rect.width + padding * 2, 20, window.innerWidth - left - 5);
  const height = clamp(rect.height + padding * 2, 20, window.innerHeight - top - 5);
  spotlight.classList.remove("is-hidden");
  spotlight.style.left = `${left}px`;
  spotlight.style.top = `${top}px`;
  spotlight.style.width = `${width}px`;
  spotlight.style.height = `${height}px`;
  const cardPosition = tutorialCardPosition({ ...rect, left, top, right: left + width, bottom: top + height, width, height }, card.getBoundingClientRect());
  card.style.left = `${cardPosition.left}px`;
  card.style.top = `${cardPosition.top}px`;
}

function scheduleTutorialPosition() {
  if (!tutorialOpen) return;
  if (tutorialPositionFrame) cancelAnimationFrame(tutorialPositionFrame);
  tutorialPositionFrame = requestAnimationFrame(() => {
    tutorialPositionFrame = null;
    positionTutorial();
  });
}

function renderTutorialStep() {
  const step = tutorialSteps[tutorialIndex];
  if (!step) return;
  prepareTutorialStep(step);
  $("#tutorialStepCount").textContent = `${tutorialIndex + 1} / ${tutorialSteps.length}`;
  $("#tutorialTitle").textContent = step.title;
  $("#tutorialBody").textContent = step.body;
  $("#tutorialTryText").textContent = step.tryText;
  $("#tutorialCard").style.width = `${Number(step.cardWidth || 360)}px`;
  $("#tutorialPrevBtn").disabled = tutorialIndex === 0;
  const nextButton = $("#tutorialNextBtn");
  nextButton.querySelector("span").textContent = tutorialIndex === tutorialSteps.length - 1 ? "완료" : "다음";
  nextButton.querySelector("svg")?.classList.toggle("is-hidden", tutorialIndex === tutorialSteps.length - 1);
  $("#tutorialProgress").innerHTML = tutorialSteps.map((entry, index) => (
    `<span class="${index < tutorialIndex ? "is-complete" : index === tutorialIndex ? "is-current" : ""}"></span>`
  )).join("");
  const target = tutorialTarget(step);
  target?.scrollIntoView({ block: "center", inline: "nearest", behavior: "auto" });
  scheduleTutorialPosition();
  setTimeout(scheduleTutorialPosition, 80);
}

function startTutorial(startIndex = 0) {
  cancelPreview();
  if (workspaceMode !== "blocking") setWorkspaceMode("blocking");
  if (viewMode !== "2d") setViewMode("2d");
  $$(".toolbar-menu[open]").forEach((menu) => { menu.open = false; });
  tutorialIndex = clamp(Number(startIndex) || 0, 0, tutorialSteps.length - 1);
  tutorialOpen = true;
  const overlay = $("#tutorialOverlay");
  overlay.hidden = false;
  overlay.setAttribute("aria-hidden", "false");
  renderTutorialStep();
  $("#tutorialCard").focus({ preventScroll: true });
}

function closeTutorial(completed = false) {
  tutorialOpen = false;
  if (tutorialPositionFrame) cancelAnimationFrame(tutorialPositionFrame);
  tutorialPositionFrame = null;
  const overlay = $("#tutorialOverlay");
  overlay.hidden = true;
  overlay.setAttribute("aria-hidden", "true");
  rememberTutorialSeen();
  if (completed) notifyApp("튜토리얼을 완료했습니다. 상단 도움말에서 다시 볼 수 있습니다.");
  $("#helpMenu > summary")?.focus({ preventScroll: true });
}

function changeTutorialStep(delta) {
  const nextIndex = tutorialIndex + delta;
  if (nextIndex >= tutorialSteps.length) {
    closeTutorial(true);
    return;
  }
  tutorialIndex = clamp(nextIndex, 0, tutorialSteps.length - 1);
  renderTutorialStep();
}

$("#tutorialBtn").addEventListener("click", () => startTutorial(0));
$("#tutorialCloseBtn").addEventListener("click", () => closeTutorial(false));
$("#tutorialSkipBtn").addEventListener("click", () => closeTutorial(false));
$("#tutorialPrevBtn").addEventListener("click", () => changeTutorialStep(-1));
$("#tutorialNextBtn").addEventListener("click", () => changeTutorialStep(1));
window.addEventListener("resize", scheduleTutorialPosition);
document.addEventListener("scroll", scheduleTutorialPosition, true);
document.addEventListener("keydown", (event) => {
  if (!tutorialOpen) return;
  if (event.key === "Escape") closeTutorial(false);
  else if (event.key === "ArrowLeft") changeTutorialStep(-1);
  else if (event.key === "ArrowRight") changeTutorialStep(1);
  else return;
  event.preventDefault();
  event.stopImmediatePropagation();
}, true);

function formatManualCodeTokens() {
  const root = $("#manualContent");
  if (!root || root.dataset.formatted === "true") return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  while (walker.nextNode()) {
    if (walker.currentNode.nodeValue.includes("`")) textNodes.push(walker.currentNode);
  }
  textNodes.forEach((node) => {
    const parts = node.nodeValue.split(/(`[^`]+`)/g);
    if (parts.length < 2) return;
    const fragment = document.createDocumentFragment();
    parts.filter(Boolean).forEach((part) => {
      if (part.startsWith("`") && part.endsWith("`")) {
        const code = document.createElement("code");
        code.textContent = part.slice(1, -1);
        fragment.append(code);
      } else {
        fragment.append(document.createTextNode(part));
      }
    });
    node.replaceWith(fragment);
  });
  root.dataset.formatted = "true";
}

function toggleManual() {
  const dialog = $("#manualDialog");
  if (dialog.open) {
    dialog.close();
    return;
  }
  const otherDialog = document.querySelector("dialog[open]");
  if (otherDialog) {
    notifyApp("열린 창을 닫은 뒤 매뉴얼을 여세요.");
    return;
  }
  if (tutorialOpen) closeTutorial(false);
  formatManualCodeTokens();
  filterManualSections($("#manualSearchInput")?.value || "");
  dialog.showModal();
  $("#manualBtn").classList.add("is-active");
  $("#manualBtn").setAttribute("aria-expanded", "true");
  requestAnimationFrame(() => $("#manualSearchInput")?.focus({ preventScroll: true }));
}

function filterManualSections(query = "") {
  const tokens = String(query).trim().toLocaleLowerCase("ko").split(/\s+/).filter(Boolean);
  const sections = $$("#manualContent [data-manual-section]");
  const searching = tokens.length > 0;
  let visibleCount = 0;
  sections.forEach((section) => {
    const haystack = `${section.textContent} ${section.dataset.manualKeywords || ""}`.toLocaleLowerCase("ko");
    const matches = tokens.every((token) => haystack.includes(token));
    const visible = searching ? matches : section.dataset.manualSection === manualActiveSection;
    section.hidden = !visible;
    const navButton = $(`#manualNav [data-manual-nav="${section.dataset.manualSection}"]`);
    if (navButton) navButton.hidden = searching && !matches;
    if (matches) visibleCount += 1;
  });
  $("#manualSearchSummary").textContent = searching
    ? `“${String(query).trim()}” 검색 결과 ${visibleCount}개`
    : "목차에서 한 항목씩 선택해 확인하세요";
  $("#manualEmptyState").hidden = visibleCount > 0;
  $("#manualContent").scrollTop = 0;
  if (searching) updateManualActiveNav();
  else setManualActiveNav(manualActiveSection);
}

function scrollManualTo(sectionId) {
  const section = $(`#manualContent [data-manual-section="${sectionId}"]`);
  if (!section) return;
  manualActiveSection = sectionId;
  const search = $("#manualSearchInput");
  if (search) search.value = "";
  filterManualSections("");
  $("#manualContent")?.focus({ preventScroll: true });
}

function setManualActiveNav(sectionId) {
  $$("#manualNav [data-manual-nav]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.manualNav === sectionId);
  });
}

function updateManualActiveNav() {
  const content = $("#manualContent");
  if (!content) return;
  if (!String($("#manualSearchInput")?.value || "").trim()) {
    setManualActiveNav(manualActiveSection);
    return;
  }
  const visible = $$("#manualContent [data-manual-section]").filter((section) => !section.hidden);
  if (!visible.length) {
    setManualActiveNav("");
    return;
  }
  const threshold = content.scrollTop + 88;
  const active = visible.reduce((current, section) => section.offsetTop <= threshold ? section : current, visible[0]);
  setManualActiveNav(active.dataset.manualSection);
}

function closeManualAndRun(callback) {
  const dialog = $("#manualDialog");
  if (dialog.open) dialog.close();
  requestAnimationFrame(callback);
}

function revealManualTarget(selector, options = {}) {
  setWorkspaceMode(options.workspace === "storyboard" ? "storyboard" : "blocking");
  if (options.view) setViewMode(options.view);
  const target = $(selector);
  const details = target?.closest("details");
  if (details) details.open = true;
  requestAnimationFrame(() => target?.scrollIntoView({ block: "center", behavior: "smooth" }));
}

function runManualAction(action) {
  if (action === "tutorial") {
    closeManualAndRun(() => startTutorial(0));
    return;
  }
  if (action === "storyboard") {
    closeManualAndRun(() => setWorkspaceMode("storyboard"));
    return;
  }
  if (action === "blocking-2d") {
    closeManualAndRun(() => revealManualTarget("#stageCanvas", { view: "2d" }));
    return;
  }
  if (action === "blocking-3d") {
    closeManualAndRun(() => revealManualTarget("#threeWrap", { view: "3d" }));
    return;
  }
  if (action === "scenario") {
    closeManualAndRun(openScenarioDialog);
    return;
  }
  if (action === "project-menu" || action === "export-menu") {
    closeManualAndRun(() => {
      const menu = $(action === "project-menu" ? "#projectMenu" : "#exportMenu");
      menu.open = true;
      menu.querySelector("summary")?.focus();
    });
    return;
  }
  if (action === "objects") {
    closeManualAndRun(() => revealManualTarget("#actorForm", { view: "2d" }));
    return;
  }
  if (action === "camera") {
    closeManualAndRun(() => revealManualTarget("#cameraLockControls", { view: "2d" }));
    return;
  }
  if (action === "timeline") {
    closeManualAndRun(() => revealManualTarget("#timelineTrack", { view: viewMode }));
    return;
  }
  if (action === "mounting") {
    closeManualAndRun(() => {
      setWorkspaceMode("blocking");
      setViewMode("2d");
      const actor = state.items.find((item) => item.type === "actor");
      if (!actor) {
        notifyApp("배우를 추가한 뒤 탑승 설정을 열 수 있습니다.");
        return;
      }
      selected = { kind: "item", id: actor.id };
      syncUi();
      const panel = $("#actorPlacementFields")?.closest("details");
      if (panel) panel.open = true;
      requestAnimationFrame(() => $("#actorPlacementFields")?.scrollIntoView({ block: "center", behavior: "smooth" }));
    });
  }
}

$("#manualBtn").addEventListener("click", toggleManual);
$("#manualSearchInput").addEventListener("input", (event) => filterManualSections(event.target.value));
$("#manualSearchInput").addEventListener("keydown", (event) => {
  if (event.key === "Enter") event.preventDefault();
});
$("#manualNav").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-manual-nav]");
  if (button) scrollManualTo(button.dataset.manualNav);
});
$("#manualContent").addEventListener("scroll", updateManualActiveNav, { passive: true });
$("#manualContent").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-manual-action]");
  if (button) runManualAction(button.dataset.manualAction);
});
$("#manualDialog").addEventListener("close", () => {
  $("#manualBtn").classList.remove("is-active");
  $("#manualBtn").setAttribute("aria-expanded", "false");
  $("#helpMenu > summary")?.focus({ preventScroll: true });
});

function hasUnsavedProjectChanges() {
  if (managedProjectId && managedSavedFingerprint) {
    return captureProjectSnapshot() !== managedSavedFingerprint;
  }
  return projectSaveStatus !== "saved";
}

function confirmProjectReplacement(actionLabel) {
  const warning = hasUnsavedProjectChanges()
    ? "저장 완료되지 않은 변경이 있습니다. "
    : "";
  return confirm(`${warning}${actionLabel} 현재 프로젝트를 교체할까요?`);
}

function syncWorkspaceNavigationState() {
  const storyboardActive = workspaceMode === "storyboard";
  const storyboardButton = $("#storyboardBtn");
  if (storyboardActive) storyboardButton?.setAttribute("aria-current", "page");
  else storyboardButton?.removeAttribute("aria-current");
  $$("#viewButtons button").forEach((button) => {
    const active = !storyboardActive && button.dataset.view === viewMode;
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
}

function syncHistoryButtons() {
  const undoAvailable = workspaceMode === "storyboard"
    ? projectHistory.length > 0 || history.length > 1
    : history.length > 1;
  const redoAvailable = workspaceMode === "storyboard"
    ? projectFuture.length > 0 || future.length > 0
    : future.length > 0;
  const undoButton = $("#undoBtn");
  const redoButton = $("#redoBtn");
  if (undoButton) undoButton.disabled = !undoAvailable;
  if (redoButton) redoButton.disabled = !redoAvailable;
}

function syncProjectChrome() {
  if (!project) return;
  const scene = currentScene();
  const cut = currentCut();
  const breadcrumb = [
    project.title || "새 프로젝트",
    scene ? `S${String(scene.number).padStart(2, "0")}` : "",
    cut ? `C${String(cut.number).padStart(2, "0")}` : "",
    cut?.title || "",
  ].filter(Boolean).join(" · ");
  if ($("#projectBreadcrumb")) $("#projectBreadcrumb").textContent = breadcrumb;
  if ($("#storyboardBtnLabel")) $("#storyboardBtnLabel").textContent = "스토리보드";
  $("#storyboardBtn")?.classList.toggle("is-active", workspaceMode === "storyboard");
  $(".app")?.classList.toggle("is-storyboard", workspaceMode === "storyboard");
  syncWorkspaceNavigationState();
  syncHistoryButtons();
  setProjectSaveStatus(projectSaveStatus);
}

function setWorkspaceMode(mode) {
  workspaceMode = mode === "storyboard" ? "storyboard" : "blocking";
  $("#storyboardScreen").hidden = workspaceMode !== "storyboard";
  syncProjectChrome();
  if (workspaceMode === "storyboard") {
    cancelPreview();
    syncActiveCutDocument(false);
    renderStoryboardWorkspace();
    return;
  }
  syncUi(false);
  resizeCanvas();
  draw();
}

function openCutInBlocking(sceneId = activeSceneId, cutId = activeCutId) {
  switchProjectCut(sceneId, cutId, { renderStoryboard: false });
  setWorkspaceMode("blocking");
}

function storyboardCutCode(scene, cut) {
  return `S${String(scene.number).padStart(2, "0")} · C${String(cut.number).padStart(2, "0")}`;
}

function renderStoryboardWorkspace() {
  if (!project) return;
  renumberProject();
  const scene = currentScene();
  const cut = currentCut();
  $("#storyboardProjectTitle").textContent = project.title || "새 프로젝트";
  $("#storyboardLogline").textContent = project.logline || "로그라인 없음";
  renderStoryboardSceneList();
  if (!scene || !cut) return;
  const projectView = storyboardScope === "project";
  $("#activeSceneNumber").textContent = projectView ? `전체 시나리오 · ${project.scenes.length}개 씬` : `장면 ${scene.number}`;
  $("#activeSceneHeading").value = projectView ? project.title : scene.heading;
  $("#activeSceneHeading").readOnly = projectView;
  $("#activeSceneSynopsis").value = projectView ? project.logline : scene.synopsis;
  $("#activeSceneSynopsis").readOnly = projectView;
  $("#storyboardStatusFilter").value = storyboardStatusFilter;
  const scopeName = projectView ? "전체 시나리오" : `S${String(scene.number).padStart(2, "0")} ${scene.heading}`;
  const statusName = storyboardStatusFilter === "all" ? "전체 상태" : storyboardStatusLabels[storyboardStatusFilter];
  $("#contactSheetScopeLabel").textContent = `${scopeName} · ${statusName}`;
  renderStoryboardWarnings();
  renderStoryboardCutGrid();
  renderStoryboardInspector();
  queueStoryboardThumbnails(storyboardCutsForScope(true));
}

function storyboardScenesForScope() {
  return storyboardScope === "project" ? project.scenes : [currentScene()].filter(Boolean);
}

function storyboardCutsForScope(respectFilter = true) {
  return storyboardScenesForScope().flatMap((scene) => scene.cuts.filter((cut) => (
    !respectFilter || storyboardStatusFilter === "all" || cut.status === storyboardStatusFilter
  )));
}

function storyboardEntriesForScope(respectFilter = true) {
  return storyboardScenesForScope().flatMap((scene) => scene.cuts
    .filter((cut) => !respectFilter || storyboardStatusFilter === "all" || cut.status === storyboardStatusFilter)
    .map((cut) => ({ scene, cut })));
}

function renderStoryboardSceneList() {
  const list = $("#storyboardSceneList");
  list.innerHTML = "";
  project.scenes.forEach((scene) => {
    const row = document.createElement("div");
    row.className = `storyboard-scene-row${scene.id === activeSceneId ? " is-active" : ""}`;
    const index = document.createElement("span");
    index.className = "storyboard-scene-index";
    index.textContent = `S${String(scene.number).padStart(2, "0")}`;
    const select = document.createElement("button");
    select.type = "button";
    select.className = "storyboard-scene-name";
    select.textContent = scene.heading;
    select.title = scene.heading;
    select.addEventListener("click", () => {
      const targetCut = scene.cuts[0];
      if (targetCut) {
        switchProjectCut(scene.id, targetCut.id);
        if (storyboardScope === "project") {
          requestAnimationFrame(() => {
            $(`.storyboard-scene-band[data-scene-id="${scene.id}"]`)?.scrollIntoView({ block: "start", behavior: "smooth" });
          });
        }
      }
    });
    const count = document.createElement("span");
    count.className = "storyboard-scene-count";
    count.textContent = `${scene.cuts.length}컷`;
    row.append(index, select, count);
    if (project.scenes.length > 1) {
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "icon-btn storyboard-scene-remove";
      remove.innerHTML = '<i data-lucide="x" aria-hidden="true"></i>';
      remove.title = "씬 삭제";
      remove.setAttribute("aria-label", `${scene.heading} 삭제`);
      remove.addEventListener("click", () => deleteProjectScene(scene.id));
      row.append(remove);
    }
    list.append(row);
  });
  refreshLucideIcons();
}

function renderStoryboardWarnings() {
  const element = $("#storyboardWarnings");
  const warnings = project.scenario?.warnings || [];
  element.hidden = !warnings.length;
  element.textContent = warnings.join(" ");
}

function renderStoryboardCutGrid() {
  const root = $("#storyboardCutGrid");
  root.innerHTML = "";
  if (storyboardScope === "project") {
    root.className = "storyboard-project-flow";
    project.scenes.forEach((scene) => {
      const band = document.createElement("section");
      band.className = `storyboard-scene-band${scene.id === activeSceneId ? " is-active" : ""}`;
      band.dataset.sceneId = scene.id;
      const heading = document.createElement("header");
      heading.className = "storyboard-scene-band-head";
      const sceneTitle = document.createElement("button");
      sceneTitle.type = "button";
      sceneTitle.className = "storyboard-scene-band-title";
      const sceneCode = document.createElement("span");
      sceneCode.textContent = `S${String(scene.number).padStart(2, "0")}`;
      const sceneHeading = document.createElement("strong");
      sceneHeading.textContent = scene.heading;
      sceneTitle.append(sceneCode, sceneHeading);
      sceneTitle.addEventListener("click", () => {
        const firstCut = scene.cuts[0];
        if (firstCut) switchProjectCut(scene.id, firstCut.id);
      });
      const sceneMeta = document.createElement("div");
      sceneMeta.className = "storyboard-scene-band-meta";
      sceneMeta.textContent = `${scene.cuts.length}컷${scene.synopsis ? ` · ${scene.synopsis}` : ""}`;
      heading.append(sceneTitle, sceneMeta);
      const cutGrid = document.createElement("div");
      cutGrid.className = "storyboard-cut-grid storyboard-scene-cut-grid";
      const visibleCuts = scene.cuts.filter((cut) => storyboardStatusFilter === "all" || cut.status === storyboardStatusFilter);
      cutGrid.dataset.cutCount = String(visibleCuts.length);
      cutGrid.classList.toggle("is-single-cut", visibleCuts.length === 1);
      cutGrid.classList.toggle("is-multi-cut", visibleCuts.length > 1);
      if (visibleCuts.length) visibleCuts.forEach((cut) => cutGrid.append(createStoryboardCutCard(scene, cut)));
      else cutGrid.append(createStoryboardEmptyState());
      band.append(heading, cutGrid);
      root.append(band);
    });
  } else {
    root.className = "storyboard-cut-grid";
    const scene = currentScene();
    const visibleCuts = scene.cuts.filter((cut) => storyboardStatusFilter === "all" || cut.status === storyboardStatusFilter);
    if (visibleCuts.length) visibleCuts.forEach((cut) => root.append(createStoryboardCutCard(scene, cut)));
    else root.append(createStoryboardEmptyState());
  }
  refreshLucideIcons();
}

function createStoryboardEmptyState() {
  const empty = document.createElement("div");
  empty.className = "storyboard-empty";
  empty.textContent = "이 상태에 해당하는 컷이 없습니다.";
  return empty;
}

function createStoryboardCutCard(scene, cut) {
  const card = document.createElement("article");
  card.className = `storyboard-cut-card${cut.id === activeCutId ? " is-active" : ""}`;
  card.tabIndex = 0;
  card.dataset.cutId = cut.id;
  card.dataset.sceneId = scene.id;
  card.addEventListener("click", () => switchProjectCut(scene.id, cut.id));
  card.addEventListener("dblclick", () => openCutInBlocking(scene.id, cut.id));
  card.addEventListener("keydown", (event) => {
    if (event.target.matches("button, input, textarea, select")) return;
    if (event.key === " ") {
      switchProjectCut(scene.id, cut.id);
      event.preventDefault();
    }
    if (event.key === "Enter") {
      if (cut.id === activeCutId) openCutInBlocking(scene.id, cut.id);
      else switchProjectCut(scene.id, cut.id);
      event.preventDefault();
    }
  });

  const thumb = document.createElement("div");
  thumb.className = "storyboard-thumb";
  thumb.dataset.thumbCut = cut.id;
  const fallback = document.createElement("canvas");
  fallback.width = 480;
  fallback.height = 270;
  renderToCanvas(fallback, cut.blocking, { clean: true });
  const image = document.createElement("img");
  image.alt = `${cut.title} 카메라 대표 프레임`;
  image.hidden = true;
  const cached = storyboardThumbnailCache.get(cut.id);
  if (cached?.stamp === cut.updatedAt) {
    image.src = cached.url;
    image.hidden = false;
    fallback.hidden = true;
  }
  const code = document.createElement("span");
  code.className = "storyboard-card-code";
  code.textContent = storyboardCutCode(scene, cut);
  const status = document.createElement("span");
  status.className = "storyboard-card-status";
  status.style.setProperty("--status-color", storyboardStatusColors[cut.status]);
  status.textContent = storyboardStatusLabels[cut.status];
  thumb.append(fallback, image, code, status);

  const body = document.createElement("div");
  body.className = "storyboard-card-body";
  const title = document.createElement("strong");
  title.className = "storyboard-card-title";
  title.textContent = cut.title || "제목 없는 컷";
  const titleInput = document.createElement("input");
  titleInput.className = "storyboard-card-title-input";
  titleInput.type = "text";
  titleInput.maxLength = 200;
  titleInput.value = cut.title || "";
  titleInput.setAttribute("aria-label", `${storyboardCutCode(scene, cut)} 컷 제목 수정`);
  titleInput.hidden = true;
  const titleWrap = document.createElement("div");
  titleWrap.className = "storyboard-card-title-wrap";
  titleWrap.append(title, titleInput);
  const bodyHead = document.createElement("div");
  bodyHead.className = "storyboard-card-body-head";
  bodyHead.append(titleWrap);
  const action = document.createElement("p");
  action.className = "storyboard-card-action";
  action.textContent = cut.action || "액션 설명 없음";
  const dialogue = document.createElement("p");
  dialogue.className = "storyboard-card-dialogue";
  dialogue.textContent = cut.dialogue ? `“${cut.dialogue.replace(/\n/g, " ")}”` : "대사 없음";
  const actionBlock = document.createElement("div");
  actionBlock.className = "storyboard-card-copy storyboard-card-action-copy";
  const actionLabel = document.createElement("span");
  actionLabel.className = "storyboard-card-copy-label";
  actionLabel.textContent = "액션";
  const actionInput = document.createElement("textarea");
  actionInput.className = "storyboard-card-text-input";
  actionInput.rows = 4;
  actionInput.value = cut.action || "";
  actionInput.placeholder = "인물과 화면에서 일어나는 일";
  actionInput.setAttribute("aria-label", `${storyboardCutCode(scene, cut)} 액션 수정`);
  actionInput.hidden = true;
  actionBlock.append(actionLabel, action, actionInput);
  const dialogueBlock = document.createElement("div");
  dialogueBlock.className = "storyboard-card-copy storyboard-card-dialogue-copy";
  const dialogueLabel = document.createElement("span");
  dialogueLabel.className = "storyboard-card-copy-label";
  dialogueLabel.textContent = "대사";
  const dialogueInput = document.createElement("textarea");
  dialogueInput.className = "storyboard-card-text-input";
  dialogueInput.rows = 2;
  dialogueInput.value = cut.dialogue || "";
  dialogueInput.placeholder = "이 컷에 해당하는 대사";
  dialogueInput.setAttribute("aria-label", `${storyboardCutCode(scene, cut)} 대사 수정`);
  dialogueInput.hidden = true;
  dialogueBlock.append(dialogueLabel, dialogue, dialogueInput);
  const headActions = document.createElement("div");
  headActions.className = "storyboard-card-head-actions";
  const needsExpansion = String(cut.action || "").length > 120
    || String(cut.dialogue || "").length > 80
    || String(cut.title || "").length > 54;
  if (needsExpansion) {
    const expand = document.createElement("button");
    expand.type = "button";
    expand.className = "icon-btn storyboard-card-expand";
    expand.innerHTML = '<i data-lucide="chevron-down" aria-hidden="true"></i>';
    expand.title = "컷 설명 펼치기";
    expand.setAttribute("aria-label", `${cut.title || "컷"} 설명 펼치기`);
    expand.setAttribute("aria-expanded", "false");
    expand.addEventListener("click", (event) => {
      event.stopPropagation();
      const expanded = card.classList.toggle("is-expanded");
      expand.setAttribute("aria-expanded", String(expanded));
      expand.title = expanded ? "컷 설명 접기" : "컷 설명 펼치기";
      expand.setAttribute("aria-label", `${cut.title || "컷"} 설명 ${expanded ? "접기" : "펼치기"}`);
      expand.innerHTML = `<i data-lucide="chevron-${expanded ? "up" : "down"}" aria-hidden="true"></i>`;
      refreshLucideIcons();
    });
    headActions.append(expand);
  }
  const edit = document.createElement("button");
  edit.type = "button";
  edit.className = "text-btn storyboard-card-edit";
  edit.innerHTML = '<i data-lucide="pencil" aria-hidden="true"></i><span>수정</span>';
  edit.setAttribute("aria-label", `${cut.title || "컷"} 내용 수정`);
  const save = document.createElement("button");
  save.type = "button";
  save.className = "primary-btn storyboard-card-save";
  save.innerHTML = '<i data-lucide="save" aria-hidden="true"></i><span>저장</span>';
  save.setAttribute("aria-label", `${cut.title || "컷"} 수정 내용 저장`);
  save.hidden = true;
  const cancelEdit = document.createElement("button");
  cancelEdit.type = "button";
  cancelEdit.className = "icon-btn storyboard-card-cancel";
  cancelEdit.innerHTML = '<i data-lucide="x" aria-hidden="true"></i>';
  cancelEdit.title = "수정 취소";
  cancelEdit.setAttribute("aria-label", `${cut.title || "컷"} 수정 취소`);
  cancelEdit.hidden = true;
  headActions.append(edit, save, cancelEdit);
  bodyHead.append(headActions);

  const setInlineEditing = (editing) => {
    card.classList.toggle("is-editing", editing);
    title.hidden = editing;
    action.hidden = editing;
    dialogue.hidden = editing;
    titleInput.hidden = !editing;
    actionInput.hidden = !editing;
    dialogueInput.hidden = !editing;
    edit.hidden = editing;
    save.hidden = !editing;
    cancelEdit.hidden = !editing;
    if (editing) {
      titleInput.value = cut.title || "";
      actionInput.value = cut.action || "";
      dialogueInput.value = cut.dialogue || "";
      requestAnimationFrame(() => titleInput.focus());
    }
  };
  edit.addEventListener("click", (event) => {
    event.stopPropagation();
    setInlineEditing(true);
  });
  cancelEdit.addEventListener("click", (event) => {
    event.stopPropagation();
    setInlineEditing(false);
  });
  const saveInlineEdit = (event) => {
    event?.stopPropagation();
    const nextTitle = titleInput.value.trim() || "제목 없는 컷";
    const nextAction = actionInput.value.trim();
    const nextDialogue = dialogueInput.value.trim();
    if (nextTitle === cut.title && nextAction === cut.action && nextDialogue === cut.dialogue) {
      setInlineEditing(false);
      return;
    }
    pushProjectHistory();
    cut.title = nextTitle;
    cut.action = nextAction;
    cut.dialogue = nextDialogue;
    cut.blocking.sceneTitle = cut.title;
    if (cut.id === activeCutId) state = cut.blocking;
    touchProjectCut(cut);
    syncProjectChrome();
    renderStoryboardWorkspace();
    notifyApp(`${storyboardCutCode(scene, cut)} 내용을 저장했습니다.`);
  };
  save.addEventListener("click", saveInlineEdit);
  [titleInput, actionInput, dialogueInput].forEach((input) => {
    input.addEventListener("click", (event) => event.stopPropagation());
    input.addEventListener("dblclick", (event) => event.stopPropagation());
    input.addEventListener("keydown", (event) => {
      event.stopPropagation();
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        saveInlineEdit(event);
      } else if (event.key === "Escape") {
        event.preventDefault();
        setInlineEditing(false);
      }
    });
  });
  const meta = document.createElement("div");
  meta.className = "storyboard-card-meta";
  const keyCount = cut.blocking.motion?.keyframes?.length || 0;
  [cut.shotType, `${cut.blocking.camera.focal}mm`, `${cut.blocking.motion.duration}초`, `키 ${keyCount}`]
    .forEach((value) => {
      const item = document.createElement("span");
      item.textContent = value;
      meta.append(item);
    });
  const order = document.createElement("div");
  order.className = "storyboard-order-actions";
  [["arrow-left", -1, "앞으로 이동 (Alt+←)"], ["arrow-right", 1, "뒤로 이동 (Alt+→)"]].forEach(([icon, direction, titleText]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.innerHTML = `<i data-lucide="${icon}" aria-hidden="true"></i>`;
    button.title = titleText;
    button.disabled = direction < 0 ? cut.number === 1 : cut.number === scene.cuts.length;
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      moveProjectCut(cut.id, direction);
    });
    order.append(button);
  });
  meta.append(order);
  body.append(bodyHead, actionBlock, dialogueBlock, meta);
  card.append(thumb, body);
  return card;
}

function renderStoryboardInspector() {
  const scene = currentScene();
  const cut = currentCut();
  if (!scene || !cut) return;
  $("#selectedCutCode").textContent = storyboardCutCode(scene, cut);
  const issues = cutIssueList(cut);
  const issueButton = $("#selectedCutIssueCount");
  const issueList = $("#selectedCutIssueList");
  issueButton.textContent = issues.length ? `${issues.length} 확인` : "준비됨";
  issueButton.title = issues.join(" · ");
  issueButton.disabled = !issues.length;
  issueButton.setAttribute("aria-expanded", "false");
  issueList.innerHTML = "";
  issues.forEach((issue) => {
    const item = document.createElement("div");
    item.textContent = issue;
    issueList.append(item);
  });
  issueList.hidden = true;
  $("#cutStatusInput").value = cut.status;
  $("#cutTitleInput").value = cut.title;
  $("#cutShotTypeInput").value = cut.shotType;
  $("#cutActionInput").value = cut.action;
  $("#cutDialogueInput").value = cut.dialogue;
  $("#cutIntentInput").value = cut.intent || cut.camera;
  $("#cutNotesInput").value = cut.notes;
}

async function queueStoryboardThumbnails(cuts) {
  const run = ++storyboardThumbnailRun;
  for (const cut of cuts) {
    if (run !== storyboardThumbnailRun || workspaceMode !== "storyboard") return;
    const cached = storyboardThumbnailCache.get(cut.id);
    if (cached?.stamp === cut.updatedAt) continue;
    try {
      const blob = await renderCameraFrameBlobAtTime(cut.thumbnailTime || 0, clone(cut.blocking), { width: 640, height: 360 });
      if (run !== storyboardThumbnailRun || workspaceMode !== "storyboard") return;
      if (cached?.url) URL.revokeObjectURL(cached.url);
      const url = URL.createObjectURL(blob);
      storyboardThumbnailCache.set(cut.id, { url, stamp: cut.updatedAt });
      const wrap = $(`[data-thumb-cut="${cut.id}"]`);
      const image = wrap?.querySelector("img");
      const fallback = wrap?.querySelector("canvas");
      if (image) {
        image.src = url;
        image.hidden = false;
      }
      if (fallback) fallback.hidden = true;
    } catch (error) {
      console.warn("storyboard thumbnail failed", cut.id, error);
    }
    await nextFrame();
  }
}

function touchProjectCut(cut) {
  if (!cut) return;
  cut.updatedAt = isoNow();
  project.updatedAt = cut.updatedAt;
  setProjectSaveStatus("changed");
  const cached = storyboardThumbnailCache.get(cut.id);
  if (cached?.url) URL.revokeObjectURL(cached.url);
  storyboardThumbnailCache.delete(cut.id);
}

function updateStoryboardCutFromInspector(render = false) {
  const cut = currentCut();
  if (!cut) return;
  cut.status = $("#cutStatusInput").value;
  cut.title = $("#cutTitleInput").value;
  cut.shotType = $("#cutShotTypeInput").value;
  cut.action = $("#cutActionInput").value;
  cut.dialogue = $("#cutDialogueInput").value;
  cut.intent = $("#cutIntentInput").value;
  cut.notes = $("#cutNotesInput").value;
  cut.blocking.sceneTitle = cut.title;
  cut.blocking.sceneIntent = cut.intent || cut.camera || "";
  if (cut.id === activeCutId) state = cut.blocking;
  touchProjectCut(cut);
  syncProjectChrome();
  if (render) renderStoryboardWorkspace();
}

function addProjectScene() {
  syncActiveCutDocument(false);
  pushProjectHistory();
  const cut = createCut(defaultState(), { title: "첫 컷" });
  const scene = createScene([cut], { heading: `장면 ${project.scenes.length + 1}` });
  project.scenes.push(scene);
  renumberProject();
  project.updatedAt = isoNow();
  setProjectSaveStatus("changed");
  switchProjectCut(scene.id, cut.id);
  notifyApp(`${scene.heading}을 추가했습니다.`);
}

function deleteProjectScene(sceneId) {
  const scene = project.scenes.find((entry) => entry.id === sceneId);
  if (!scene || project.scenes.length <= 1) return;
  if (!confirm(`${scene.heading}과 포함된 ${scene.cuts.length}개 컷을 삭제할까요?`)) return;
  pushProjectHistory();
  const index = project.scenes.indexOf(scene);
  scene.cuts.forEach((cut) => {
    cutRuntime.delete(cut.id);
    const cached = storyboardThumbnailCache.get(cut.id);
    if (cached?.url) URL.revokeObjectURL(cached.url);
    storyboardThumbnailCache.delete(cut.id);
  });
  project.scenes.splice(index, 1);
  setProjectSaveStatus("changed");
  renumberProject();
  const next = project.scenes[Math.min(index, project.scenes.length - 1)];
  switchProjectCut(next.id, next.cuts[0].id);
  notifyApp(`${scene.heading}을 삭제했습니다.`);
}

function addProjectCut() {
  const scene = currentScene();
  if (!scene) return;
  syncActiveCutDocument(false);
  pushProjectHistory();
  const blocking = createContinuityBlocking(currentCut()?.blocking || state);
  const cut = createCut(blocking, { title: `컷 ${scene.cuts.length + 1}`, intent: "" });
  scene.cuts.push(cut);
  renumberProject();
  project.updatedAt = isoNow();
  setProjectSaveStatus("changed");
  switchProjectCut(scene.id, cut.id);
  notifyApp(`${storyboardCutCode(scene, cut)}을 추가했습니다.`);
}

function duplicateProjectCut() {
  const scene = currentScene();
  const source = currentCut();
  if (!scene || !source) return;
  syncActiveCutDocument(false);
  pushProjectHistory();
  const copy = createCut(remapBlockingIds(source.blocking), {
    ...clone(source),
    id: uid(),
    title: `${source.title} 복제`,
    status: "draft",
    createdAt: isoNow(),
    updatedAt: isoNow(),
  });
  const index = scene.cuts.indexOf(source);
  scene.cuts.splice(index + 1, 0, copy);
  renumberProject();
  project.updatedAt = isoNow();
  setProjectSaveStatus("changed");
  switchProjectCut(scene.id, copy.id);
  notifyApp(`${storyboardCutCode(scene, copy)}으로 복제했습니다.`);
}

function deleteProjectCut() {
  const scene = currentScene();
  const cut = currentCut();
  if (!scene || !cut) return;
  if (scene.cuts.length <= 1) {
    alert("씬에는 최소 한 개의 컷이 있어야 합니다.");
    return;
  }
  if (!confirm(`${cut.title || "이 컷"}을 삭제할까요?`)) return;
  pushProjectHistory();
  const index = scene.cuts.indexOf(cut);
  scene.cuts.splice(index, 1);
  setProjectSaveStatus("changed");
  cutRuntime.delete(cut.id);
  const cached = storyboardThumbnailCache.get(cut.id);
  if (cached?.url) URL.revokeObjectURL(cached.url);
  storyboardThumbnailCache.delete(cut.id);
  renumberProject();
  const next = scene.cuts[Math.min(index, scene.cuts.length - 1)];
  switchProjectCut(scene.id, next.id);
  notifyApp("컷을 삭제했습니다.");
}

function moveProjectCut(cutId, direction) {
  const scene = currentScene();
  const index = scene?.cuts.findIndex((cut) => cut.id === cutId) ?? -1;
  const target = index + Number(direction);
  if (index < 0 || target < 0 || target >= scene.cuts.length) return;
  pushProjectHistory();
  [scene.cuts[index], scene.cuts[target]] = [scene.cuts[target], scene.cuts[index]];
  renumberProject();
  project.updatedAt = isoNow();
  setProjectSaveStatus("changed");
  renderStoryboardWorkspace();
  notifyApp("컷 순서를 변경했습니다.");
}

function openScenarioDialog() {
  const draft = scenarioDialogDraft || {
    title: project.title || "",
    logline: project.logline || "",
    scenarioText: project.scenario?.rawText || "",
    storyboardText: project.scenario?.storyboardText || "",
  };
  $("#scenarioProjectTitle").value = draft.title;
  $("#scenarioLogline").value = draft.logline;
  $("#scenarioTextInput").value = draft.scenarioText;
  $("#storyboardTextInput").value = draft.storyboardText;
  scenarioDialogApplied = false;
  structureReviewMode = false;
  $("#scenarioDialog").classList.remove("is-reviewing-structure");
  $("#toggleStructureReviewBtn span").textContent = "검토 확대";
  $("#toggleStructureReviewBtn").disabled = true;
  structureDraft = null;
  $("#applyStructureBtn").disabled = true;
  $("#structurePreviewList").innerHTML = "";
  $("#structurePreviewSummary").textContent = "구조 분석 전";
  $("#structurePreviewWarnings").hidden = true;
  $("#scenarioDialog").showModal();
}

function readScenarioDialogDraft() {
  return {
    title: $("#scenarioProjectTitle").value,
    logline: $("#scenarioLogline").value,
    scenarioText: $("#scenarioTextInput").value,
    storyboardText: $("#storyboardTextInput").value,
  };
}

function scenarioDraftHasChanges(draft = scenarioDialogDraft) {
  if (!draft) return false;
  return draft.title !== (project.title || "")
    || draft.logline !== (project.logline || "")
    || draft.scenarioText !== (project.scenario?.rawText || "")
    || draft.storyboardText !== (project.scenario?.storyboardText || "");
}

function analyzeScenarioStructure() {
  const scenarioText = $("#scenarioTextInput").value.trim();
  const storyboardText = $("#storyboardTextInput").value.trim();
  if (!scenarioText && !storyboardText) {
    structureDraft = null;
    $("#structurePreviewList").innerHTML = "";
    $("#structurePreviewSummary").textContent = "분석할 텍스트 없음";
    $("#structurePreviewWarnings").hidden = false;
    $("#structurePreviewWarnings").textContent = "씬 또는 컷을 구성할 원문이 없습니다.";
    $("#applyStructureBtn").disabled = true;
    $("#toggleStructureReviewBtn").disabled = true;
    return;
  }
  structureDraft = storyboardCore.buildStoryStructure({
    scenarioText,
    storyboardText,
  });
  renderStructurePreview();
  $("#applyStructureBtn").disabled = false;
  $("#toggleStructureReviewBtn").disabled = false;
}

function renderStructurePreview() {
  const list = $("#structurePreviewList");
  list.innerHTML = "";
  const totalCuts = structureDraft.scenes.reduce((sum, scene) => sum + scene.cuts.length, 0);
  $("#structurePreviewSummary").textContent = `${structureDraft.scenes.length}개 씬 · ${totalCuts}개 컷`;
  structureDraft.scenes.forEach((scene, sceneIndex) => {
    const item = document.createElement("div");
    item.className = "structure-preview-scene";
    const heading = document.createElement("strong");
    heading.textContent = `S${String(sceneIndex + 1).padStart(2, "0")} · ${scene.heading}`;
    const cutList = document.createElement("div");
    cutList.className = "structure-preview-cut-list";
    scene.cuts.forEach((cut, cutIndex) => {
      const cutItem = document.createElement("div");
      cutItem.className = "structure-preview-cut";
      const cutTitle = document.createElement("strong");
      cutTitle.textContent = `C${String(cutIndex + 1).padStart(2, "0")} · ${cut.title}`;
      const metadata = document.createElement("span");
      metadata.textContent = [cut.shotType, cut.focal ? `${cut.focal}mm` : "렌즈 미정", cut.duration ? `${cut.duration}초` : "길이 미정"].join(" · ");
      const action = document.createElement("p");
      action.textContent = cut.action?.split("\n")[0] || cut.dialogue?.split("\n")[0] || "액션·대사 없음";
      cutItem.append(cutTitle, metadata, action);
      cutList.append(cutItem);
    });
    item.append(heading, cutList);
    list.append(item);
  });
  const warnings = $("#structurePreviewWarnings");
  warnings.hidden = !structureDraft.warnings.length;
  warnings.textContent = structureDraft.warnings.join(" ");
}

function projectContainsWork() {
  if (!project) return false;
  if (project.scenes.length > 1) return true;
  const cuts = project.scenes.flatMap((scene) => scene.cuts);
  if (cuts.length > 1) return true;
  const only = cuts[0];
  return Boolean(project.scenario?.rawText || project.scenario?.storyboardText || only?.blocking?.motion?.keyframes?.length);
}

function applyScenarioStructure() {
  if (!structureDraft) analyzeScenarioStructure();
  if (!structureDraft) return;
  const mode = $("#scenarioApplyMode").value;
  if (mode === "replace" && projectContainsWork()) {
    const oldCuts = project.scenes.reduce((sum, scene) => sum + scene.cuts.length, 0);
    const nextCuts = structureDraft.scenes.reduce((sum, scene) => sum + scene.cuts.length, 0);
    const impact = `기존 ${project.scenes.length}씬·${oldCuts}컷을 제거하고 새 ${structureDraft.scenes.length}씬·${nextCuts}컷을 만듭니다.`;
    if (!confirm(`${impact}\n현재 구조를 교체할까요?`)) return;
  }
  syncActiveCutDocument(false);
  pushProjectHistory();
  const newScenes = structureDraft.scenes.map(sceneFromTextDraft);
  if (mode === "append") {
    project.scenes.push(...newScenes);
  } else {
    clearStoryboardThumbnailCache();
    cutRuntime.clear();
    project.scenes = newScenes;
  }
  project.title = $("#scenarioProjectTitle").value.trim() || project.title || "새 프로젝트";
  project.logline = $("#scenarioLogline").value.trim();
  project.scenario = {
    sourceType: "manual",
    sourceName: "",
    importedAt: isoNow(),
    rawText: $("#scenarioTextInput").value,
    storyboardText: $("#storyboardTextInput").value,
    warnings: structureDraft.warnings,
  };
  project.updatedAt = isoNow();
  setProjectSaveStatus("changed");
  renumberProject();
  const firstNewScene = newScenes[0];
  switchProjectCut(firstNewScene.id, firstNewScene.cuts[0].id, { renderStoryboard: false });
  scenarioDialogApplied = true;
  scenarioDialogDraft = null;
  $("#scenarioDialog").close();
  setWorkspaceMode("storyboard");
  notifyApp(`${newScenes.length}개 씬 구조를 적용했습니다.`);
}

function renderTrackingTargetSelect(updateInputs = true) {
  const select = $("#trackingTargetSelect");
  if (!select) return;
  const value = sanitizeTrackingTargetId(state.camera.trackingTargetId, state);
  const options = [{ id: "", label: "추적 안 함" }, ...state.items.map((item) => ({
    id: item.id,
    label: `${item.type === "actor" ? "배우" : "소품"} · @${item.name}`,
  }))];
  const signature = options.map((option) => `${option.id}:${option.label}`).join("|");
  if (select.dataset.signature !== signature) {
    select.innerHTML = "";
    options.forEach((option) => {
      const element = document.createElement("option");
      element.value = option.id;
      element.textContent = option.label;
      select.append(element);
    });
    select.dataset.signature = signature;
  }
  if (updateInputs || document.activeElement !== select) select.value = value;
}

function setViewMode(mode) {
  viewMode = mode === "3d" ? "3d" : "2d";
  canvas.hidden = viewMode !== "2d";
  stageViewport.hidden = viewMode !== "2d";
  stageZoomControls.hidden = viewMode !== "2d";
  $("#threeWrap").hidden = viewMode !== "3d";
  if (viewMode === "3d") {
    initThreeView();
    resizeThreeView();
    renderThreeView(state, true);
  } else {
    requestAnimationFrame(() => resizeCanvas());
  }
  syncUi(false);
  draw();
}

function renderToggleGrid(selector, catalog, selectedValues, onToggle) {
  const root = $(selector);
  root.innerHTML = "";
  Object.entries(catalog).forEach(([key, label]) => {
    const item = document.createElement("label");
    item.className = "layer-pill";
    item.classList.toggle("is-active", selectedValues.includes(key));
    item.innerHTML = `<input type="checkbox" ${selectedValues.includes(key) ? "checked" : ""} /> <span>${escapeHtml(label)}</span>`;
    item.addEventListener("change", () => onToggle(key));
    root.append(item);
  });
}

function toggleControlLayer(key) {
  state.previs.selectedLayers = toggleArrayValue(state.previs.selectedLayers, key);
  state.previs.selectedLayers = normalizeSelection(state.previs.selectedLayers, controlLayers, ["camera"]);
  commit();
}

function toggleExportPreset(key) {
  state.previs.exportPresets = toggleArrayValue(state.previs.exportPresets, key);
  state.previs.exportPresets = normalizeSelection(state.previs.exportPresets, exportPresets, ["seedance"]);
  commit();
}

function toggleArrayValue(values, key) {
  return values.includes(key) ? values.filter((value) => value !== key) : [...values, key];
}

function renderObjectLists() {
  renderObjectList("#actorList", "actor");
  renderObjectList("#propList", "prop");
}

function populatePropCatalogControls() {
  const buildOptions = () => propCatalogGroups.map((category) => {
    const options = Object.entries(propCatalog)
      .filter(([, definition]) => definition.category === category)
      .map(([value, definition]) => `<option value="${value}">${escapeHtml(definition.label)}</option>`)
      .join("");
    return options ? `<optgroup label="${escapeHtml(category)}">${options}</optgroup>` : "";
  }).join("");
  [$("#propAssetSelect"), $("#selectedPropAsset")].filter(Boolean).forEach((select) => {
    select.innerHTML = buildOptions();
  });
  if ($("#propAssetSelect")) $("#propAssetSelect").value = "dining-table";
  const presetRoot = $("#environmentPresetButtons");
  if (presetRoot) {
    presetRoot.innerHTML = Object.entries(environmentPresets)
      .map(([value, preset]) => `<button type="button" data-environment-preset="${value}">${escapeHtml(preset.label)}</button>`)
      .join("");
  }
}

function renderObjectList(selector, type) {
  const root = $(selector);
  root.innerHTML = "";
  state.items
    .filter((item) => item.type === type)
    .forEach((item, index) => {
      const row = document.createElement("div");
      row.className = "object-row";
      row.classList.toggle(
        "is-active",
        selected?.id === item.id && (selected.kind === "item" || selected.kind === "facing"),
      );
      row.innerHTML = `
        <span class="dot" style="background:${item.color}"></span>
        <span class="object-row-name">
          <span>${index + 1}. @ ${escapeHtml(item.name)}</span>
          ${item.type === "prop" ? `<small>${escapeHtml(propDefinition(item.assetType).label)}${item.motionEnabled === false ? " · 고정" : ""}${item.editLocked ? " · 잠김" : ""}${groupForItem(item.id) ? " · 묶음" : ""}</small>` : item.placementMode === "auto" && item.mountId ? `<small>자동 탑승${item.editLocked ? " · 잠김" : ""}</small>` : groupForItem(item.id) ? `<small>수동 묶음${item.editLocked ? " · 잠김" : ""}</small>` : item.editLocked ? `<small>편집 잠김</small>` : ""}
        </span>
        <button type="button" aria-label="${escapeHtml(item.name)} 제거">×</button>
      `;
      row.addEventListener("click", () => {
        selected = { kind: "item", id: item.id };
        const sourceId = item.type === "actor" && item.placementMode === "auto" && item.mountId
          ? item.mountId
          : groupLeaderIdForItem(item.id, state);
        setActiveSource(sourceId);
        selectKeyForSource(sourceId);
        syncUi();
        draw();
      });
      row.querySelector("button").addEventListener("click", (event) => {
        event.stopPropagation();
        if (sourceEditLocked(item.id)) {
          notifyEditLocked(item.name);
          return;
        }
        removeItemById(item.id);
        commit();
      });
      root.append(row);
    });
}

function renderProperties(updateInputs) {
  const item = selectedItem();
  const hasItem = Boolean(item);
  $("#selectionEmpty").hidden = hasItem;
  $("#propertiesForm").hidden = !hasItem;
  if (!item) {
    $("#selectionEmpty").textContent =
      selected?.kind === "camera" ? "카메라" : "배우, 소품, 카메라를 선택하세요.";
    return;
  }
  $("#selectionEmpty").textContent = "배우, 소품, 카메라를 선택하세요.";

  const transformItem = state.items.find((entry) => entry.id === transformLeaderIdForItem(item.id, state)) || item;
  const locked = sourceEditLocked(transformItem.id);
  const itemLockButton = $("#itemEditLockBtn");
  itemLockButton.classList.toggle("is-locked", locked);
  itemLockButton.setAttribute("aria-pressed", String(locked));
  itemLockButton.querySelector("i, svg")?.setAttribute("data-lucide", locked ? "lock" : "unlock");
  $("#itemEditLockStatus").textContent = locked ? "잠김" : "편집 가능";
  if (updateInputs) {
    $("#selectedName").value = item.name;
    $("#sizeSlider").value = item.size;
    $("#facingSlider").value = transformItem.facing;
  }
  $("#sizeSlider").max = item.type === "actor" ? "2.2" : "4";
  $("#sizeValue").value = Number(item.size).toFixed(2);
  $("#facingValue").value = Math.round(transformItem.facing);
  $("#sizeSlider").value = item.size;
  $("#facingSlider").value = transformItem.facing;
  ["#selectedName", "#sizeSlider", "#sizeValue", "#selectedPropAsset", "#propMotionToggle",
    "#propScaleX", "#propScaleXValue", "#propScaleY", "#propScaleYValue", "#propScaleZ", "#propScaleZValue",
    "#actorPlacementMode", "#actorMountSelect", "#actorSeatSelect", "#facingSlider", "#facingValue",
    "#groupOverlapBtn", "#ungroupBtn", "#duplicateBtn", "#deleteBtn"].forEach((selector) => {
    const control = $(selector);
    if (control) control.disabled = locked;
  });

  const propFields = $("#propSpecificFields");
  const actorPlacementFields = $("#actorPlacementFields");
  const actorPoseFields = $("#actorPoseFields");
  propFields.hidden = item.type !== "prop";
  actorPlacementFields.hidden = item.type !== "actor";
  actorPoseFields.hidden = item.type !== "actor";
  $("#shapeField").hidden = item.type === "prop" && item.assetType !== "generic";
  if (item.type === "prop") {
    $("#selectedPropAsset").value = item.assetType;
    $("#propMotionToggle").checked = item.motionEnabled !== false;
    [["X", item.scaleX], ["Y", item.scaleY], ["Z", item.scaleZ]].forEach(([axis, value]) => {
      $("#propScale" + axis).value = value;
      $("#propScale" + axis + "Value").value = Number(value).toFixed(2);
    });
  } else {
    $("#actorPlacementMode").value = item.placementMode || "manual";
    renderAutoMountControls(item, updateInputs);
    renderActorPoseControls(item, locked, updateInputs);
  }
  $("#manualGroupFields").hidden = item.type === "actor" && item.placementMode === "auto";
  renderManualGroupControls(item);
  if (locked) {
    $("#groupOverlapBtn").disabled = true;
    $("#ungroupBtn").disabled = true;
  }

  const swatches = $("#colorSwatches");
  swatches.innerHTML = "";
  colors.forEach((color) => {
    const button = document.createElement("button");
    button.className = "swatch";
    button.style.background = color;
    button.classList.toggle("is-active", item.color === color);
    button.disabled = locked;
    button.type = "button";
    button.setAttribute("aria-label", color);
    button.addEventListener("click", () => {
      item.color = color;
      commit();
    });
    swatches.append(button);
  });

  const shapeRoot = $("#shapeButtons");
  shapeRoot.innerHTML = "";
  shapes.forEach(([value, label]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.classList.toggle("is-active", item.shape === value);
    button.disabled = locked;
    button.addEventListener("click", () => {
      item.shape = value;
      commit();
    });
    shapeRoot.append(button);
  });

  $$(".facing-grid button").forEach((button) => {
    const diff = Math.abs((((Number(button.dataset.facing) - transformItem.facing) % 360) + 540) % 360 - 180);
    button.classList.toggle("is-active", diff <= 22.5);
    button.disabled = locked;
  });
  $$(".nudge-grid button").forEach((button) => { button.disabled = locked; });
  refreshLucideIcons();
}

function itemFootprintRadiusWorld(item) {
  if (!item) return 0;
  if (item.type === "actor") return 0.42 * Number(item.size || 1);
  return 0.52
    * Math.sqrt(propDefinition(item.assetType).footprint || 0.7)
    * Number(item.size || 1)
    * Math.max(Number(item.scaleX || 1), Number(item.scaleZ || 1));
}

function overlappingItemsForGroup(item, renderState = state) {
  if (!item || item.motionEnabled === false || sourceEditLocked(item.id, renderState) || groupForItem(item.id, renderState)) return [];
  if (item.type === "actor" && item.placementMode === "auto") return [];
  const size = stageWorldSize(renderState);
  return renderState.items.filter((candidate) => {
    if (candidate.id === item.id || candidate.visible === false || candidate.motionEnabled === false || sourceEditLocked(candidate.id, renderState)) return false;
    if (candidate.type === "actor" && candidate.placementMode === "auto") return false;
    if (groupForItem(candidate.id, renderState)) return false;
    const dx = (candidate.x - item.x) * size.width;
    const dz = (candidate.y - item.y) * size.depth;
    const threshold = Math.max(0.5, (itemFootprintRadiusWorld(item) + itemFootprintRadiusWorld(candidate)) * 0.72);
    return Math.hypot(dx, dz) <= threshold;
  });
}

function renderManualGroupControls(item) {
  const group = groupForItem(item.id, state);
  const leader = group ? state.items.find((entry) => entry.id === group.leaderId) : null;
  const candidates = group ? [] : overlappingItemsForGroup(item, state);
  $("#manualGroupStatus").textContent = group
    ? `${leader?.name || "묶음"} 외 ${Math.max(1, group.members.length - 1)}개`
    : candidates.length ? `겹친 대상 ${candidates.length}개` : "개별 대상";
  $("#groupOverlapBtn").disabled = Boolean(group) || !candidates.length;
  $("#ungroupBtn").disabled = !group;
}

function renderAutoMountControls(actor, updateInputs = true) {
  const root = $("#autoMountFields");
  const mountSelect = $("#actorMountSelect");
  const seatSelect = $("#actorSeatSelect");
  const seatRow = $("#actorSeatRow");
  const isAuto = actor.placementMode === "auto";
  root.hidden = !isAuto;
  if (!isAuto) return;
  const vehicles = vehicleProps();
  mountSelect.innerHTML = [
    `<option value="">차량 선택</option>`,
    ...vehicles.map((vehicle) => `<option value="${vehicle.id}">${escapeHtml(propDefinition(vehicle.assetType).label)} · @${escapeHtml(vehicle.name)}</option>`),
  ].join("");
  if (updateInputs || document.activeElement !== mountSelect) mountSelect.value = actor.mountId || "";
  const vehicle = vehicles.find((entry) => entry.id === actor.mountId);
  const seats = vehicle ? propDefinition(vehicle.assetType).seats || [] : [];
  const occupiedSeats = new Set(state.items
    .filter((item) => item.type === "actor" && item.id !== actor.id && item.placementMode === "auto" && item.mountId === actor.mountId)
    .map((item) => Number(item.seatIndex || 0)));
  seatRow.hidden = !vehicle || !seats.length;
  seatSelect.innerHTML = seats.map((seat, index) => `<option value="${index}" ${occupiedSeats.has(index) ? "disabled" : ""}>${escapeHtml(seat.label)}${occupiedSeats.has(index) ? " · 사용 중" : ""}</option>`).join("");
  if (seats.length && (updateInputs || document.activeElement !== seatSelect)) {
    seatSelect.value = String(clamp(Number(actor.seatIndex || 0), 0, seats.length - 1));
  }
}

function bodyPosesEqual(first, second, epsilon = 0.01) {
  const a = sanitizeBodyPose(first);
  const b = sanitizeBodyPose(second);
  return Object.keys(JOINT_DEFINITIONS).every((jointId) => ["x", "y", "z"].every(
    (axis) => Math.abs(a[jointId][axis] - b[jointId][axis]) <= epsilon,
  ));
}

function renderActorPoseControls(actor, locked, updateInputs = true) {
  if (!actor || actor.type !== "actor") return;
  if (selectedPoseActorId !== actor.id) {
    selectedPoseActorId = actor.id;
    selectedPoseJoint = "chest";
  }
  if (!JOINT_DEFINITIONS[selectedPoseJoint]) selectedPoseJoint = "chest";
  actor.bodyPose = sanitizeBodyPose(actor.bodyPose);

  const jointSelect = $("#actorPoseJointSelect");
  if (!jointSelect.dataset.ready) {
    jointSelect.innerHTML = Object.entries(JOINT_DEFINITIONS)
      .map(([jointId, definition]) => `<option value="${jointId}">${escapeHtml(definition.label)}</option>`)
      .join("");
    jointSelect.dataset.ready = "true";
  }
  if (updateInputs || document.activeElement !== jointSelect) jointSelect.value = selectedPoseJoint;
  jointSelect.disabled = locked;

  const definition = JOINT_DEFINITIONS[selectedPoseJoint];
  const rotation = actor.bodyPose[selectedPoseJoint];
  ["X", "Y", "Z"].forEach((axisName) => {
    const axis = axisName.toLowerCase();
    const slider = $("#actorPoseAxis" + axisName);
    const value = $("#actorPoseAxis" + axisName + "Value");
    slider.min = definition[axis][0];
    slider.max = definition[axis][1];
    value.min = definition[axis][0];
    value.max = definition[axis][1];
    if (updateInputs || document.activeElement !== slider) slider.value = rotation[axis];
    if (updateInputs || document.activeElement !== value) value.value = Math.round(rotation[axis]);
    slider.disabled = locked;
    value.disabled = locked;
  });

  /* ── Category tabs ── */
  const tabRoot = $("#actorPoseCategoryTabs");
  if (!tabRoot.dataset.ready) {
    const allTab = `<button type="button" data-pose-category="">전체</button>`;
    const categoryTabs = PRESET_CATEGORIES.map((category) =>
      `<button type="button" data-pose-category="${category.id}">${category.emoji} ${escapeHtml(category.label)}</button>`
    ).join("");
    const customTab = `<button type="button" data-pose-category="custom">⭐ 내 포즈</button>`;
    tabRoot.innerHTML = allTab + categoryTabs + customTab;
    tabRoot.dataset.ready = "true";
  }
  tabRoot.querySelectorAll("button[data-pose-category]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.poseCategory === selectedPoseCategory);
  });

  /* ── Presets grid (filtered by category) ── */
  const presetRoot = $("#actorPosePresets");
  const customPoses = loadCustomPoses();
  const isCustomTab = selectedPoseCategory === "custom";
  let presetIds = [];
  if (!isCustomTab) {
    if (!selectedPoseCategory) {
      presetIds = Object.keys(POSE_PRESET_LABELS);
    } else {
      const category = PRESET_CATEGORIES.find((category) => category.id === selectedPoseCategory);
      presetIds = category ? category.presets : Object.keys(POSE_PRESET_LABELS);
    }
  }
  let presetsHtml = presetIds.map((presetId) =>
    `<button type="button" data-pose-preset="${presetId}">${escapeHtml(POSE_PRESET_LABELS[presetId] || presetId)}</button>`
  ).join("");
  if (isCustomTab) {
    presetsHtml = customPoses.map((entry) =>
      `<button type="button" data-custom-pose="${escapeHtml(entry.id)}" title="${escapeHtml(entry.name)}">${escapeHtml(entry.name)}<span class="pose-delete-mark">✕</span></button>`
    ).join("");
    if (!customPoses.length) presetsHtml = `<span style="grid-column:1/-1;color:#5a6a72;font-size:10px;text-align:center;padding:8px 0;">저장된 포즈가 없습니다.</span>`;
  }
  presetRoot.innerHTML = presetsHtml;
  presetRoot.querySelectorAll("button[data-pose-preset]").forEach((button) => {
    button.classList.toggle("is-active", bodyPosesEqual(actor.bodyPose, presetBodyPose(button.dataset.posePreset)));
    button.disabled = locked;
  });
  presetRoot.querySelectorAll("button[data-custom-pose]").forEach((button) => {
    const entry = customPoses.find((pose) => pose.id === button.dataset.customPose);
    if (entry) button.classList.toggle("is-active", bodyPosesEqual(actor.bodyPose, sanitizeBodyPose(entry.pose)));
    button.disabled = locked;
  });

  /* ── Custom save ── */
  const customSaveSection = $("#actorPoseCustomSave");
  customSaveSection.hidden = false;
  $("#actorPoseCustomNameInput").disabled = locked;
  $("#actorPoseCustomSaveBtn").disabled = locked;

  /* ── Action buttons ── */
  $("#actorPoseResetBtn").disabled = locked;
  $("#actorPoseMirrorBtn").disabled = locked;
  $("#actorPoseRandomBtn").disabled = locked;
  $("#actorPoseCopyBtn").disabled = locked;
  $("#actorPosePasteBtn").disabled = locked || !poseClipboard;
  const canKeyPose = !locked && isIndependentMotionSource(actor, state);
  const currentTime = readTimelineTimeInput(state.motion.playhead);
  const existing = keysForSource(actor.id).find((keyframe) => Math.abs(keyframe.time - currentTime) < 0.05);
  $("#actorPoseKeyBtn").disabled = !canKeyPose;
  $("#actorPoseKeyBtn").querySelector("span").textContent = existing ? "포즈 키 갱신" : "포즈 키 추가";
  $("#actorPoseHint").textContent = actor.placementMode === "auto" && actor.mountId
    ? "차량 탑승 중에는 포즈를 고정 편집할 수 있지만 독립 포즈 키는 추가되지 않습니다."
    : "현재 포즈는 배우 키프레임에 위치·방향과 함께 저장됩니다.";
}

function loadCustomPoses() {
  try {
    const raw = window.localStorage.getItem(CUSTOM_POSES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function saveCustomPose(name) {
  const actor = selectedItem();
  if (!actor || actor.type !== "actor") return;
  const trimmed = String(name || "").trim();
  if (!trimmed) { notifyApp("포즈 이름을 입력하세요."); return; }
  const poses = loadCustomPoses();
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  poses.push({ id, name: trimmed, pose: sanitizeBodyPose(actor.bodyPose) });
  try { window.localStorage.setItem(CUSTOM_POSES_KEY, JSON.stringify(poses)); } catch { /* quota */ }
  notifyApp(`"${trimmed}" 포즈를 저장했습니다.`);
  $("#actorPoseCustomNameInput").value = "";
  syncUi(false);
}

function deleteCustomPose(poseId) {
  const poses = loadCustomPoses().filter((entry) => entry.id !== poseId);
  try { window.localStorage.setItem(CUSTOM_POSES_KEY, JSON.stringify(poses)); } catch { /* quota */ }
  notifyApp("저장된 포즈를 삭제했습니다.");
  syncUi(false);
}

function applyCustomPose(poseId) {
  const actor = selectedItem();
  if (!actor || actor.type !== "actor" || sourceEditLocked(actor.id)) return;
  const entry = loadCustomPoses().find((pose) => pose.id === poseId);
  if (!entry) return;
  materializeEvaluatedViewForEditing(actor.id);
  const current = state.items.find((item) => item.id === actor.id);
  current.bodyPose = sanitizeBodyPose(entry.pose);
  selectedPoseActorId = current.id;
  commit();
  notifyApp(`"${entry.name}" 포즈를 적용했습니다.`);
}

function copyActorPose() {
  const actor = selectedItem();
  if (!actor || actor.type !== "actor") return;
  poseClipboard = sanitizeBodyPose(actor.bodyPose);
  notifyApp("배우 포즈를 복사했습니다.");
  syncUi(false);
}

function pasteActorPose() {
  const actor = selectedItem();
  if (!actor || actor.type !== "actor" || sourceEditLocked(actor.id) || !poseClipboard) return;
  materializeEvaluatedViewForEditing(actor.id);
  const current = state.items.find((item) => item.id === actor.id);
  current.bodyPose = sanitizeBodyPose(poseClipboard);
  selectedPoseActorId = current.id;
  commit();
  notifyApp("복사한 포즈를 붙여넣었습니다.");
}

function randomizeActorPose() {
  const actor = selectedItem();
  if (!actor || actor.type !== "actor" || sourceEditLocked(actor.id)) return;
  materializeEvaluatedViewForEditing(actor.id);
  const current = state.items.find((item) => item.id === actor.id);
  const pose = defaultBodyPose();
  Object.entries(JOINT_DEFINITIONS).forEach(([jointId, definition]) => {
    ["x", "y", "z"].forEach((axis) => {
      const range = definition[axis][1] - definition[axis][0];
      const center = (definition[axis][0] + definition[axis][1]) / 2;
      pose[jointId][axis] = center + (Math.random() - 0.5) * range * 0.5;
    });
  });
  current.bodyPose = sanitizeBodyPose(pose);
  selectedPoseActorId = current.id;
  commit();
  notifyApp("랜덤 포즈를 적용했습니다.");
}

function selectActorPoseJoint(actorId, jointId, { announce = false } = {}) {
  const actor = state.items.find((item) => item.id === actorId && item.type === "actor");
  if (!actor || !JOINT_DEFINITIONS[jointId]) return false;
  selected = { kind: "item", id: actor.id };
  selectedPoseActorId = actor.id;
  selectedPoseJoint = jointId;
  if (isIndependentMotionSource(actor, state)) {
    setActiveSource(actor.id);
    selectKeyForSource(actor.id);
  }
  syncUi();
  if (viewMode === "3d") renderThreeView(evaluatedViewState || state, true);
  if (announce) notifyApp(`${JOINT_DEFINITIONS[jointId].label} 포즈 편집`);
  return true;
}

function updateActorPoseAxis(axis, rawValue) {
  const actor = state.items.find((item) => item.id === selectedPoseActorId && item.type === "actor");
  const definition = JOINT_DEFINITIONS[selectedPoseJoint];
  if (!actor || !definition || !["x", "y", "z"].includes(axis) || sourceEditLocked(actor.id)) return;
  materializeEvaluatedViewForEditing(actor.id);
  const current = state.items.find((item) => item.id === actor.id);
  current.bodyPose = sanitizeBodyPose(current.bodyPose);
  current.bodyPose[selectedPoseJoint][axis] = clamp(Number(rawValue), definition[axis][0], definition[axis][1]);
  current.bodyPose = sanitizeBodyPose(current.bodyPose);
  draw();
}

function applyActorPosePreset(presetId) {
  const actor = selectedItem();
  if (!actor || actor.type !== "actor" || sourceEditLocked(actor.id)) return;
  materializeEvaluatedViewForEditing(actor.id);
  const current = state.items.find((item) => item.id === actor.id);
  current.bodyPose = presetBodyPose(presetId);
  selectedPoseActorId = current.id;
  commit();
  notifyApp(`${POSE_PRESET_LABELS[presetId] || "기본"} 포즈를 적용했습니다.`);
}

function captureActorPoseKeyframe() {
  const actor = selectedItem();
  if (!actor || actor.type !== "actor" || sourceEditLocked(actor.id)) return;
  if (!isIndependentMotionSource(actor, state)) {
    notifyApp("차량이나 묶음에서 분리한 뒤 배우 포즈 키를 추가하세요.");
    return;
  }
  materializeEvaluatedViewForEditing(actor.id);
  const current = state.items.find((item) => item.id === actor.id);
  const requestedTime = readTimelineTimeInput(state.motion.playhead);
  const existing = keysForSource(actor.id).find((keyframe) => Math.abs(keyframe.time - requestedTime) < 0.05);
  setActiveSource(actor.id);
  if (existing) {
    existing.pose = sanitizeSourcePose(actor.id, { ...existing.pose, bodyPose: current.bodyPose });
    state.motion.selectedKeyId = existing.id;
    state.motion.playhead = existing.time;
    commit();
    notifyApp(`${existing.time.toFixed(1)}초 배우 키의 포즈를 갱신했습니다.`);
    return;
  }
  const time = availableKeyTime(requestedTime, actor.id, { maxTime: MAX_TIMELINE_DURATION });
  ensureDurationCovers(time);
  const keyframe = captureSourceKeyframe(actor.id, time, undefined, $("#keyPathSelect")?.value || "straight");
  if (!keyframe) return;
  state.motion.keyframes.push(keyframe);
  state.motion.selectedKeyId = keyframe.id;
  state.motion.playhead = keyframe.time;
  state.motion.keyframes = sortKeyframes(state.motion.keyframes);
  commit();
  notifyApp(`${keyframe.time.toFixed(1)}초에 배우 포즈 키를 추가했습니다.`);
}

function renderKeyStatus(updateInputs = true) {
  const visibleSourceIds = new Set(visibleSourceDefinitions().map((source) => source.id));
  const keyframes = sortKeyframes(state.motion.keyframes).filter((keyframe) => visibleSourceIds.has(keyframe.source));
  const selectedKey = selectedKeyframe();
  const current = selectedKey && visibleSourceIds.has(selectedKey.source) ? selectedKey : null;
  const currentLocked = Boolean(current && sourceEditLocked(current.source));
  const timeInput = $("#keyTimeInput");
  const transitionSelect = $("#keyTransitionSelect");
  const pathSelect = $("#keyPathSelect");
  const instructionInput = $("#keyInstructionInput");
  if (updateInputs || document.activeElement !== timeInput) {
    timeInput.value = Number(displayPlayhead() ?? current?.time ?? 0).toFixed(1);
  }
  updatePlayheadDisplay(displayPlayhead());
  $("#deleteKeyBtn").disabled = !current || currentLocked;
  $("#updateKeyBtn").disabled = !current || currentLocked;
  $("#addKeyBtn").disabled = activeSourceId() !== "all" && sourceEditLocked(activeSourceId());
  const currentSourceKeys = current ? keysForSource(current.source) : [];
  const isFirstSourceKey = Boolean(current && currentSourceKeys[0]?.id === current.id);
  if (transitionSelect && (updateInputs || document.activeElement !== transitionSelect)) {
    transitionSelect.value = normalizeTransition(current?.transition);
  }
  if (transitionSelect) {
    transitionSelect.disabled = !current || isFirstSourceKey || currentLocked;
    transitionSelect.title = isFirstSourceKey
      ? "첫 키에는 도착 방식이 적용되지 않습니다."
      : "이 키에 도착하는 이동 방식";
  }
  renderPathModeSelect(pathSelect, current, isFirstSourceKey, updateInputs);
  if (instructionInput && (updateInputs || document.activeElement !== instructionInput)) {
    instructionInput.value = current?.note || "";
  }
  if (instructionInput) {
    instructionInput.disabled = !current || currentLocked;
    instructionInput.title = current
      ? "이 키로 이동하는 구간에 표시할 짧은 행동 지문"
      : "먼저 키프레임을 선택하세요.";
  }

  const markers = $("#timelineMarkers");
  markers.innerHTML = "";
  const cutTimes = shotCutTimes(keyframes);
  cutTimes.forEach((time) => {
    const divider = document.createElement("div");
    divider.className = "timeline-cut-divider";
    divider.style.left = `${clamp((time / state.motion.duration) * 100, 0, 100)}%`;
    divider.title = `즉시 전환 · ${time.toFixed(1)}s`;
    markers.append(divider);
  });
  keyframes.forEach((keyframe) => {
    const marker = document.createElement("button");
    marker.type = "button";
    marker.className = "timeline-marker";
    marker.classList.toggle("is-active", keyframe.id === state.motion.selectedKeyId);
    marker.classList.toggle("is-cut-marker", keyframe.transition === "cut");
    marker.classList.toggle("is-dragging", timelineDrag?.id === keyframe.id);
    marker.classList.toggle("is-locked", sourceEditLocked(keyframe.source));
    marker.style.setProperty("--marker-color", sourceColor(keyframe.source));
    marker.style.left = `${clamp((keyframe.time / state.motion.duration) * 100, 0, 100)}%`;
    marker.dataset.time = `${keyframe.time.toFixed(2)}초`;
    marker.innerHTML = `<span>${keySequenceNumber(keyframe, keyframes)}</span>`;
    const transitionText = keyTransitionLabels[normalizeTransition(keyframe.transition)];
    const pathText = pathModeLabels[pathModeForSegment(keyframe.segment, keyframe.source)];
    const summaryText = keyframeSummary(keyframe);
    marker.title = `${sourceLabel(keyframe.source)} · ${keyframe.label} · ${keyframe.time.toFixed(1)}s · ${transitionText} · ${pathText} · ${summaryText}${keyframe.note ? ` · 지문: ${keyframe.note}` : ""}${sourceEditLocked(keyframe.source) ? " · 편집 잠김" : " · 좌우 드래그로 시간 이동"}`;
    marker.addEventListener("pointerdown", (event) => beginTimelineMarkerDrag(event, keyframe.id));
    marker.addEventListener("mousedown", (event) => beginTimelineMarkerDrag(event, keyframe.id));
    marker.addEventListener("click", (event) => {
      event.stopPropagation();
      if (timelineDrag?.moved) return;
      selectKeyframe(keyframe.id);
    });
    markers.append(marker);
  });

  const splitView = state.motion.timelineView === "split";
  $("#timelineTrack").hidden = splitView;
  $("#sourceTimelineList").hidden = !splitView;
  $("#timelineHint").textContent = splitView
    ? `대상별 ${visibleSourceDefinitions().length}개 트랙 · 키 ${keyframes.length}개 · ${state.motion.duration}초`
    : `통합 트랙 · 키 ${keyframes.length}개 · 즉시 전환 ${cutTimes.length}개 · ${state.motion.duration}초 · ${state.motion.fps} FPS`;
  renderSourceTimelines(keyframes, cutTimes);

  const currentText = current
    ? `${sourceLabel(current.source)} · ${current.label} @ ${current.time.toFixed(1)}s · ${isFirstSourceKey ? "첫 키" : `${keyTransitionLabels[normalizeTransition(current.transition)]} · ${pathModeLabels[pathModeForSegment(current.segment, current.source)]}`}${current.note ? ` · 지문: ${current.note}` : ""}${current.source === "camera" ? ` · ${keyframeSummary(current)}` : ""}`
    : "선택된 키 없음";
  const motionText = `키 ${keyframes.length}개`;
  $("#keyStatus").textContent = `${motionText} · ${currentText}`;
}

function renderPathModeSelect(select, current, isFirstSourceKey, updateInputs) {
  if (!select) return;
  const sourceId = current?.source || (activeSourceId() === "all" ? selectedSourceId() : activeSourceId()) || "camera";
  const modes = sourceId === "camera" ? cameraPathModes : actorPathModes;
  const previousValue = select.value;
  const selectedMode = current && !isFirstSourceKey
    ? pathModeForSegment(current.segment, current.source)
    : normalizePathMode(previousValue, sourceId === "camera" ? "camera" : "actor");
  const optionSignature = modes.join(",");
  if (select.dataset.modes !== optionSignature) {
    select.innerHTML = "";
    modes.forEach((mode) => {
      const option = document.createElement("option");
      option.value = mode;
      option.textContent = pathModeLabels[mode];
      select.append(option);
    });
    select.dataset.modes = optionSignature;
  }
  if (updateInputs || document.activeElement !== select) {
    select.value = modes.includes(selectedMode) ? selectedMode : "straight";
  }
  select.title = isFirstSourceKey
    ? "다음 키로 들어가는 경로를 선택하세요. 첫 키 자체에는 경로가 없습니다."
    : "새 키 또는 선택한 키로 들어오는 공간 경로";
}

function keySequenceNumber(keyframe, keyframes = state.motion.keyframes) {
  return sortKeyframes(keyframes.filter((entry) => entry.source === keyframe.source))
    .findIndex((entry) => entry.id === keyframe.id) + 1;
}

function renderSourceSelect() {
  const select = $("#keySourceSelect");
  const currentValue = activeSourceId();
  select.innerHTML = "";
  const allOption = document.createElement("option");
  allOption.value = "all";
  allOption.textContent = "전체 대상 (모두 기록)";
  select.append(allOption);
  sourceDefinitions().filter((source) => {
    if (source.id === "camera") return true;
    const item = state.items.find((entry) => entry.id === source.id);
    return !item || isIndependentMotionSource(item, state) || item.motionEnabled === false || isSourceHidden(source.id);
  }).forEach((source) => {
    const option = document.createElement("option");
    option.value = source.id;
    const item = state.items.find((entry) => entry.id === source.id);
    option.textContent = item?.type === "actor" && item.mountId
      ? `${source.name} (탑승 연동)`
      : sourceEditLocked(source.id) ? `${source.name} (잠김)`
        : item?.motionEnabled === false || isSourceHidden(source.id) ? `${source.name} (고정)` : source.name;
    select.append(option);
  });
  select.value = currentValue;
}

function renderSourceTimelines(keyframes, cutTimes = shotCutTimes(keyframes)) {
  const root = $("#sourceTimelineList");
  root.innerHTML = "";
  visibleSourceDefinitions().forEach((source) => {
    const lane = document.createElement("div");
    lane.className = "source-lane";

    const label = document.createElement("button");
    label.type = "button";
    label.className = "source-lane-label";
    label.style.setProperty("--lane-color", source.color);
    label.innerHTML = `<span class="source-lane-dot"></span><span>${escapeHtml(source.name)}</span>`;
    label.addEventListener("click", () => {
      setActiveSource(source.id);
      selectSourceOnStage(source.id);
      selectKeyForSource(source.id);
      syncUi();
      draw();
    });

    const track = document.createElement("div");
    track.className = "source-lane-track";
    track.style.setProperty("--lane-color", source.color);
    track.addEventListener("click", (event) => {
      const rect = track.getBoundingClientRect();
      scrubToTime(clamp((event.clientX - rect.left) / rect.width, 0, 1) * state.motion.duration);
    });

    cutTimes.forEach((time) => {
      const divider = document.createElement("div");
      divider.className = "source-cut-divider";
      divider.style.left = `${clamp((time / state.motion.duration) * 100, 0, 100)}%`;
      track.append(divider);
    });

    keyframes
      .filter((keyframe) => keyframe.source === source.id)
      .forEach((keyframe) => {
        const marker = document.createElement("button");
        marker.type = "button";
        marker.className = "timeline-marker source-lane-marker";
        marker.classList.toggle("is-active", keyframe.id === state.motion.selectedKeyId);
        marker.classList.toggle("is-cut-marker", keyframe.transition === "cut");
        marker.classList.toggle("is-dragging", timelineDrag?.id === keyframe.id);
        marker.classList.toggle("is-locked", sourceEditLocked(keyframe.source));
        marker.style.setProperty("--marker-color", source.color);
        marker.style.left = `${clamp((keyframe.time / state.motion.duration) * 100, 0, 100)}%`;
        marker.dataset.time = `${keyframe.time.toFixed(2)}초`;
        marker.innerHTML = `<span>${keySequenceNumber(keyframe, keyframes)}</span>`;
        marker.title = `${source.name} · ${keyframe.label} · ${keyframe.time.toFixed(1)}s · ${keyTransitionLabels[normalizeTransition(keyframe.transition)]} · ${pathModeLabels[pathModeForSegment(keyframe.segment, keyframe.source)]} · ${keyframeSummary(keyframe)}${sourceEditLocked(keyframe.source) ? " · 편집 잠김" : ""}`;
        marker.addEventListener("pointerdown", (event) => beginTimelineMarkerDrag(event, keyframe.id));
        marker.addEventListener("mousedown", (event) => beginTimelineMarkerDrag(event, keyframe.id));
        marker.addEventListener("click", (event) => {
          event.stopPropagation();
          selectKeyframe(keyframe.id);
        });
        track.append(marker);
      });

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "source-lane-remove";
    remove.textContent = "×";
    remove.disabled = sourceEditLocked(source.id);
    remove.title = sourceEditLocked(source.id) ? `${source.name} 편집 잠김` : `${source.name} 타임라인 숨기기`;
    remove.setAttribute("aria-label", `${source.name} 타임라인 숨기기`);
    remove.addEventListener("click", (event) => {
      event.stopPropagation();
      if (!confirmKeyframeRemoval(source.id, `${source.name} 타임라인을 제거할까요?`, "대상은 현재 위치에 고정됩니다.")) return;
      if (hideSourceTimeline(source.id)) commit();
    });

    lane.append(label, track, remove);
    root.append(lane);
  });
}

function shotCutTimes(keyframes = state.motion.keyframes) {
  const unique = new Set();
  keyframes.forEach((keyframe) => {
    if (normalizeTransition(keyframe.transition) !== "cut" || keyframe.time <= 0.001) return;
    unique.add(Number(keyframe.time.toFixed(2)));
  });
  return [...unique].sort((a, b) => a - b);
}

function selectSourceOnStage(sourceId) {
  if (sourceId === "camera") {
    selected = { kind: "camera" };
    return;
  }
  if (sourceExists(sourceId)) selected = { kind: "item", id: sourceId };
}

function beginTimelineMarkerDrag(event, keyframeId) {
  if (timelineDrag) return;
  event.preventDefault();
  event.stopPropagation();
  cancelPreview();
  const keyframe = state.motion.keyframes.find((entry) => entry.id === keyframeId);
  if (!keyframe) return;
  if (sourceEditLocked(keyframe.source)) {
    selectKeyframe(keyframe.id);
    notifyEditLocked(sourceLabel(keyframe.source));
    return;
  }
  const track = event.currentTarget.closest(".source-lane-track, .timeline-track") || $("#timelineTrack");
  const trackRect = track.getBoundingClientRect();
  const groupedKeys = keyframe.transition === "cut"
    ? state.motion.keyframes.filter((entry) => (
      entry.transition === "cut"
      && Math.abs(entry.time - keyframe.time) < 0.05
      && !sourceEditLocked(entry.source)
    ))
    : [keyframe];
  timelineDrag = {
    id: keyframeId,
    pointerId: event.pointerId ?? "mouse",
    target: event.currentTarget,
    startDuration: state.motion.duration,
    startTime: keyframe.time,
    startState: clone(state),
    group: groupedKeys.map((entry) => ({ id: entry.id, startTime: entry.time })),
    trackRect: {
      left: trackRect.left,
      width: Math.max(1, trackRect.width),
    },
    moved: false,
  };
  if (event.pointerId != null) event.currentTarget.setPointerCapture?.(event.pointerId);
  setActiveSource(keyframe.source);
  selectSourceOnStage(keyframe.source);
  state.motion.selectedKeyId = keyframeId;
  state.motion.playhead = keyframe.time;
  updatePlayheadDisplay(state.motion.playhead);
  draw();
}

document.addEventListener("pointermove", (event) => {
  if (!timelineDrag || event.pointerId !== timelineDrag.pointerId) return;
  event.preventDefault();
  updateTimelineMarkerDrag(event.clientX);
});

document.addEventListener("pointerup", (event) => {
  if (!timelineDrag || event.pointerId !== timelineDrag.pointerId) return;
  event.preventDefault();
  finishTimelineMarkerDrag();
});

document.addEventListener("pointercancel", (event) => {
  if (!timelineDrag || event.pointerId !== timelineDrag.pointerId) return;
  event.preventDefault();
  cancelTimelineMarkerDrag();
});

document.addEventListener("mousemove", (event) => {
  if (!timelineDrag || timelineDrag.pointerId !== "mouse") return;
  event.preventDefault();
  updateTimelineMarkerDrag(event.clientX);
});

document.addEventListener("mouseup", (event) => {
  if (!timelineDrag || timelineDrag.pointerId !== "mouse") return;
  event.preventDefault();
  finishTimelineMarkerDrag();
});

function updateTimelineMarkerDrag(clientX) {
  const keyframe = state.motion.keyframes.find((entry) => entry.id === timelineDrag.id);
  if (!keyframe) return;
  const rawPercent = clamp((clientX - timelineDrag.trackRect.left) / timelineDrag.trackRect.width, 0, 1);
  const rawTime = rawPercent * timelineDrag.startDuration;
  const draggedEntries = (timelineDrag.group || [])
    .map((grouped) => state.motion.keyframes.find((entry) => entry.id === grouped.id))
    .filter(Boolean);
  const requestedTime = Number(rawTime.toFixed(2));
  const targetTime = draggedEntries.length > 1
    ? availableGroupedKeyTime(requestedTime, draggedEntries, timelineDrag.startDuration)
    : availableKeyTime(requestedTime, keyframe.source, {
      excludeId: keyframe.id,
      maxTime: timelineDrag.startDuration,
    });
  moveTimelineDragGroup(targetTime);
  state.motion.selectedKeyId = keyframe.id;
  state.motion.playhead = keyframe.time;
  state.motion.keyframes = sortKeyframes(state.motion.keyframes);
  timelineDrag.moved = true;
  syncUi(false);
  draw();
}

function finishTimelineMarkerDrag() {
  const completedDrag = timelineDrag;
  if (timelineDrag.pointerId !== "mouse") {
    timelineDrag.target?.releasePointerCapture?.(timelineDrag.pointerId);
  }
  const changedSources = new Set((timelineDrag.group || []).map((grouped) => (
    state.motion.keyframes.find((entry) => entry.id === grouped.id)?.source
  )).filter(Boolean));
  changedSources.forEach(reconcileSourcePathConstraints);
  timelineDrag = null;
  if (completedDrag.moved) commit();
  else {
    syncUi();
    draw();
  }
}

function cancelTimelineMarkerDrag() {
  if (!timelineDrag) return;
  const cancelledDrag = timelineDrag;
  if (cancelledDrag.pointerId !== "mouse") {
    cancelledDrag.target?.releasePointerCapture?.(cancelledDrag.pointerId);
  }
  timelineDrag = null;
  if (cancelledDrag.startState) restoreUncommittedState(cancelledDrag.startState);
}

function moveTimelineDragGroup(targetTime) {
  const delta = targetTime - timelineDrag.startTime;
  (timelineDrag.group || []).forEach((grouped) => {
    const entry = state.motion.keyframes.find((keyframe) => keyframe.id === grouped.id);
    if (entry) entry.time = Number(clamp(grouped.startTime + delta, 0, MAX_TIMELINE_DURATION).toFixed(2));
  });
}

function updatePlayheadDisplay(time) {
  const safeTime = clamp(Number(time || 0), 0, state.motion.duration);
  $("#timelineProgress").style.width = `${(safeTime / state.motion.duration) * 100}%`;
  const timeInput = $("#keyTimeInput");
  if (document.activeElement !== timeInput) timeInput.value = safeTime.toFixed(1);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[char];
  });
}

function resetCurrentStage() {
  const actorCount = state.items.filter((item) => item.type === "actor").length;
  const propCount = state.items.filter((item) => item.type === "prop").length;
  const keyCount = state.motion.keyframes.length;
  const impact = `배우 ${actorCount}명 · 소품 ${propCount}개 · 키 ${keyCount}개`;
  if (!confirm(`현재 컷의 무대를 기본값으로 되돌릴까요?\n${impact}와 카메라 설정이 초기화됩니다.\n컷 제목, 연출 의도, 화면비와 보기 설정은 유지되며 실행 취소할 수 있습니다.`)) return;

  cancelPreview();
  const previous = state;
  const beforeReset = snapshot();
  if (history[history.length - 1] !== beforeReset) {
    history.push(beforeReset);
    if (history.length > 80) history.shift();
  }
  const fresh = defaultState();
  state = {
    ...fresh,
    sceneTitle: previous.sceneTitle,
    sceneIntent: previous.sceneIntent,
    aspect: previous.aspect,
    showGrid: previous.showGrid,
    showNames: previous.showNames,
    showCamera: previous.showCamera,
    cleanExport: previous.cleanExport,
    blenderControls: previous.blenderControls,
    previs: clone(previous.previs || fresh.previs),
  };
  evaluatedViewState = null;
  selected = { kind: "camera" };
  drag = null;
  threeDrag = null;
  timelineDrag = null;
  keyBadgePress = null;
  keyBadgeDrag = null;
  curveHandleDrag = null;
  pathSnapGuide = null;
  commit();
  notifyApp("현재 컷의 무대를 기본값으로 되돌렸습니다.");
}

$("#aspectButtons").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-aspect]");
  if (!button) return;
  state.aspect = button.dataset.aspect;
  commit();
  requestAnimationFrame(() => resizeCanvas());
});

$("#resetStageBtn").addEventListener("click", resetCurrentStage);

$("#gridToggle").addEventListener("change", (event) => {
  state.showGrid = event.target.checked;
  commit();
});

$("#namesToggle").addEventListener("change", (event) => {
  state.showNames = event.target.checked;
  commit();
});

$("#cameraToggle").addEventListener("change", (event) => {
  state.showCamera = event.target.checked;
  commit();
});

$("#cleanExportToggle").addEventListener("change", (event) => {
  state.cleanExport = event.target.checked;
  commit();
});

$("#cameraLockControls").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-camera-lock]");
  if (!button) return;
  const field = button.dataset.cameraLock;
  const locks = sanitizeCameraLocks(state.camera.locks);
  locks[field] = !locks[field];
  state.camera.locks = locks;
  if (field === "orientation" && locks[field]) state.camera.trackingTargetId = "";
  commit();
  notifyApp(`${button.textContent.trim()} ${locks[field] ? "잠금" : "잠금 해제"}`);
});

$("#trackingTargetSelect").addEventListener("change", (event) => {
  if (cameraFieldLocked("orientation")) return;
  state.camera.trackingTargetId = sanitizeTrackingTargetId(event.target.value, state);
  applyCameraTracking(state);
  selected = { kind: "camera" };
  setActiveSource("camera");
  commit();
});

$("#focalSlider").addEventListener("input", (event) => {
  materializeEvaluatedViewForEditing("camera");
  state.camera.focal = Number(event.target.value);
  $("#focalValue").value = state.camera.focal;
  selected = { kind: "camera" };
  setActiveSource("camera");
  selectKeyForSource("camera");
  syncUi(false);
  draw();
});

$("#focalSlider").addEventListener("change", finalizeLiveProjectInputEdit);

$("#focalValue").addEventListener("input", (event) => {
  materializeEvaluatedViewForEditing("camera");
  let val = Number(event.target.value);
  if (!Number.isFinite(val)) return;
  val = clamp(val, 14, 135);
  state.camera.focal = val;
  $("#focalSlider").value = val;
  selected = { kind: "camera" };
  setActiveSource("camera");
  selectKeyForSource("camera");
  draw();
  if (viewMode === "3d") renderThreeView(state, true);
});
$("#focalValue").addEventListener("change", finalizeLiveProjectInputEdit);

$("#cameraHeightSlider").addEventListener("input", (event) => {
  materializeEvaluatedViewForEditing("camera");
  state.camera.height = Number(event.target.value);
  applyCameraTracking(state);
  syncCameraDerivedAim(state.camera, state);
  $("#cameraHeightValue").value = Number(state.camera.height).toFixed(2);
  selected = { kind: "camera" };
  setActiveSource("camera");
  selectKeyForSource("camera");
  draw();
  if (viewMode === "3d") renderThreeView(state, true);
});

$("#cameraHeightSlider").addEventListener("change", finalizeLiveProjectInputEdit);

$("#cameraHeightKeyBtn").addEventListener("click", () => {
  captureCameraHeightKeyframe();
});

$("#cameraHeightValue").addEventListener("input", (event) => {
  materializeEvaluatedViewForEditing("camera");
  let val = Number(event.target.value);
  if (!Number.isFinite(val)) return;
  val = clamp(val, 0.4, 3);
  state.camera.height = val;
  $("#cameraHeightSlider").value = val;
  applyCameraTracking(state);
  syncCameraDerivedAim(state.camera, state);
  selected = { kind: "camera" };
  setActiveSource("camera");
  selectKeyForSource("camera");
  draw();
  if (viewMode === "3d") renderThreeView(state, true);
});
$("#cameraHeightValue").addEventListener("change", finalizeLiveProjectInputEdit);

$("#cameraPanSlider").addEventListener("input", (event) => {
  materializeEvaluatedViewForEditing("camera");
  state.camera.panDeg = normalizePanDeg(event.target.value);
  syncCameraDerivedAim(state.camera, state);
  $("#cameraPanValue").value = Math.round(state.camera.panDeg);
  selected = { kind: "camera" };
  setActiveSource("camera");
  selectKeyForSource("camera");
  draw();
  if (viewMode === "3d") renderThreeView(state, true);
});

$("#cameraPanSlider").addEventListener("change", finalizeLiveProjectInputEdit);

$("#cameraPanValue").addEventListener("input", (event) => {
  materializeEvaluatedViewForEditing("camera");
  let val = Number(event.target.value);
  if (!Number.isFinite(val)) return;
  val = normalizePanDeg(val);
  state.camera.panDeg = val;
  $("#cameraPanSlider").value = val;
  syncCameraDerivedAim(state.camera, state);
  selected = { kind: "camera" };
  setActiveSource("camera");
  selectKeyForSource("camera");
  draw();
  if (viewMode === "3d") renderThreeView(state, true);
});
$("#cameraPanValue").addEventListener("change", finalizeLiveProjectInputEdit);

$("#cameraTiltSlider").addEventListener("input", (event) => {
  materializeEvaluatedViewForEditing("camera");
  state.camera.tiltDeg = clamp(Number(event.target.value), -60, 60);
  syncCameraDerivedAim(state.camera, state);
  $("#cameraTiltValue").value = Math.round(state.camera.tiltDeg);
  selected = { kind: "camera" };
  setActiveSource("camera");
  selectKeyForSource("camera");
  draw();
  if (viewMode === "3d") renderThreeView(state, true);
});

$("#cameraTiltSlider").addEventListener("change", finalizeLiveProjectInputEdit);

$("#cameraTiltValue").addEventListener("input", (event) => {
  materializeEvaluatedViewForEditing("camera");
  let val = Number(event.target.value);
  if (!Number.isFinite(val)) return;
  val = clamp(val, -60, 60);
  state.camera.tiltDeg = val;
  $("#cameraTiltSlider").value = val;
  syncCameraDerivedAim(state.camera, state);
  selected = { kind: "camera" };
  setActiveSource("camera");
  selectKeyForSource("camera");
  draw();
  if (viewMode === "3d") renderThreeView(state, true);
});
$("#cameraTiltValue").addEventListener("change", finalizeLiveProjectInputEdit);

$("#focalPresets").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-focal]");
  if (!button) return;
  if (cameraFieldLocked("lens")) {
    notifyEditLocked("카메라 렌즈");
    return;
  }
  materializeEvaluatedViewForEditing("camera");
  state.camera.focal = Number(button.dataset.focal);
  selected = { kind: "camera" };
  setActiveSource("camera");
  selectKeyForSource("camera");
  commit();
});

$("#actorForm").addEventListener("submit", (event) => {
  event.preventDefault();
  addItem("actor", $("#actorName").value);
  $("#actorName").value = "";
});

$("#propForm").addEventListener("submit", (event) => {
  event.preventDefault();
  addItem("prop", $("#propName").value, $("#propAssetSelect").value);
  $("#propName").value = "";
});

function addItem(type, rawName, assetType = "generic") {
  const base = type === "prop" ? "소품" : "배우";
  const count = state.items.filter((item) => item.type === type).length;
  const safeAssetType = type === "prop" && propCatalog[assetType] ? assetType : "generic";
  const item = {
    id: uid(),
    continuityId: uid(),
    type,
    name: rawName.trim().replace(/^@/, "") || (type === "prop" ? propDefinition(safeAssetType).label : `${base} ${count + 1}`),
    x: type === "prop" ? 0.52 : 0.38 + count * 0.06,
    y: type === "prop" ? 0.58 : 0.36 + count * 0.08,
    size: 1,
    color: colors[(state.items.length + 2) % colors.length],
    shape: type === "prop" ? "square" : "circle",
    facing: 0,
    bodyPose: type === "actor" ? defaultBodyPose() : null,
    assetType: safeAssetType,
    scaleX: 1,
    scaleY: 1,
    scaleZ: 1,
    placementMode: "manual",
    mountId: "",
    seatIndex: 0,
    motionEnabled: true,
    editLocked: false,
  };
  state.items.push(item);
  selected = { kind: "item", id: item.id };
  setActiveSource(item.id);
  commit();
}

$("#environmentPresetButtons").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-environment-preset]");
  const preset = button ? environmentPresets[button.dataset.environmentPreset] : null;
  if (!preset) return;
  state.items
    .filter((item) => item.presetInstanceId)
    .map((item) => item.id)
    .forEach((itemId) => removeItemById(itemId));
  const presetInstanceId = uid();
  const added = preset.items.map(([assetType, name, x, y, facing, size]) => sanitizeItemPose({
    id: uid(),
    type: "prop",
    name,
    x,
    y,
    facing,
    size,
    color: defaultPropColor(assetType),
    shape: "square",
    assetType,
    scaleX: 1,
    scaleY: 1,
    scaleZ: 1,
    motionEnabled: propDefinition(assetType).kind === "vehicle",
    presetInstanceId,
  }));
  state.items.push(...added);
  state.spacePresetId = button.dataset.environmentPreset;
  selected = { kind: "item", id: added[0].id };
  setActiveSource(added[0].id);
  notifyApp(`${preset.label} 공간을 추가했습니다.`);
  commit();
});

function defaultPropColor(assetType) {
  const category = propDefinition(assetType).category;
  if (category === "탈것") return "#5a8dff";
  if (category === "자연") return "#65b96b";
  if (category === "공간") return "#82909a";
  if (category === "가전") return "#b8c3c9";
  if (category === "가구") return "#d39b62";
  return "#65d66f";
}

$("#selectedName").addEventListener("input", (event) => {
  const item = selectedItem();
  if (!item) return;
  item.name = event.target.value.replace(/^@/, "");
  syncUi(false);
  draw();
});

$("#selectedName").addEventListener("change", finalizeLiveProjectInputEdit);

$("#itemEditLockBtn").addEventListener("click", () => {
  const item = selectedItem();
  if (!item) return;
  const target = state.items.find((entry) => entry.id === transformLeaderIdForItem(item.id, state)) || item;
  const affected = affectedTransformItems(target.id);
  const nextLocked = !affected.some((entry) => itemEditLocked(entry));
  affected.forEach((entry) => { entry.editLocked = nextLocked; });
  commit();
  notifyApp(`${target.name}${affected.length > 1 ? ` 외 ${affected.length - 1}개` : ""} ${nextLocked ? "편집 잠금" : "편집 잠금 해제"}`);
});

$("#sizeSlider").addEventListener("input", (event) => {
  materializeEvaluatedViewForEditing();
  const item = selectedItem();
  if (!item) return;
  item.size = Number(event.target.value);
  $("#sizeValue").value = item.size.toFixed(2);
  draw();
});

$("#sizeSlider").addEventListener("change", finalizeLiveProjectInputEdit);

$("#sizeValue").addEventListener("input", (event) => {
  materializeEvaluatedViewForEditing();
  const item = selectedItem();
  if (!item) return;
  let val = Number(event.target.value);
  if (!Number.isFinite(val)) return;
  const maxVal = item.type === "actor" ? 2.2 : 4;
  val = clamp(val, 0.25, maxVal);
  item.size = val;
  $("#sizeSlider").value = val;
  draw();
});
$("#sizeValue").addEventListener("change", finalizeLiveProjectInputEdit);

$("#selectedPropAsset").addEventListener("change", (event) => {
  materializeEvaluatedViewForEditing();
  const item = selectedItem();
  if (!item || item.type !== "prop" || !propCatalog[event.target.value]) return;
  if (isVehicleProp(item) && propDefinition(event.target.value).kind !== "vehicle") {
    detachAutoMountedActors(item.id, state);
  }
  item.assetType = event.target.value;
  sanitizeAutoMountRelationships(state);
  commit();
});

$("#propMotionToggle").addEventListener("change", (event) => {
  const item = selectedItem();
  if (!item || item.type !== "prop") return;
  if (!event.target.checked && !confirmKeyframeRemoval(item.id, `${item.name}의 동선 타임라인을 끌까요?`, "소품은 현재 위치에 고정됩니다.")) {
    event.target.checked = true;
    return;
  }
  materializeEvaluatedViewForEditing();
  item.motionEnabled = event.target.checked;
  if (!item.motionEnabled && state.motion.activeSource === item.id) state.motion.activeSource = "all";
  commit();
});

[["X", "scaleX"], ["Y", "scaleY"], ["Z", "scaleZ"]].forEach(([axis, field]) => {
  $("#propScale" + axis).addEventListener("input", (event) => {
    materializeEvaluatedViewForEditing();
    const item = selectedItem();
    if (!item || item.type !== "prop") return;
    item[field] = Number(event.target.value);
    $("#propScale" + axis + "Value").value = item[field].toFixed(2);
    draw();
  });
  $("#propScale" + axis).addEventListener("change", finalizeLiveProjectInputEdit);

  $("#propScale" + axis + "Value").addEventListener("input", (event) => {
    materializeEvaluatedViewForEditing();
    const item = selectedItem();
    if (!item || item.type !== "prop") return;
    let val = Number(event.target.value);
    if (!Number.isFinite(val)) return;
    val = clamp(val, 0.25, 3.5);
    item[field] = val;
    $("#propScale" + axis).value = val;
    draw();
  });
  $("#propScale" + axis + "Value").addEventListener("change", finalizeLiveProjectInputEdit);
});

$("#actorPlacementMode").addEventListener("change", (event) => {
  const actor = selectedItem();
  if (!actor || actor.type !== "actor") return;
  const nextMode = event.target.value === "auto" ? "auto" : "manual";
  if (actor.placementMode !== nextMode
    && !confirmKeyframeRemoval(actor.id, `${actor.name}의 탑승 방식을 바꿀까요?`, "배우의 독립 동선은 차량 또는 묶음 동선으로 전환됩니다.")) {
    event.target.value = actor.placementMode || "manual";
    return;
  }
  materializeEvaluatedViewForEditing();
  if (actor.placementMode === "auto" && nextMode === "manual") {
    const pose = resolvedItemPose(actor, state);
    actor.x = pose.x;
    actor.y = pose.y;
    actor.facing = pose.facing;
    actor.mountId = "";
    actor.seatIndex = 0;
  }
  if (nextMode === "auto") {
    const group = groupForItem(actor.id, state);
    if (group) dissolveManualGroup(group.id, state);
    actor.mountId = "";
    actor.seatIndex = 0;
  }
  actor.placementMode = nextMode;
  state.motion.keyframes = state.motion.keyframes.filter((keyframe) => keyframe.source !== actor.id);
  setActiveSource(actor.id);
  commit();
});

$("#actorMountSelect").addEventListener("change", (event) => {
  materializeEvaluatedViewForEditing();
  const actor = selectedItem();
  if (!actor || actor.type !== "actor" || actor.placementMode !== "auto") return;
  const vehicle = state.items.find((item) => item.id === event.target.value && isVehicleProp(item));
  const occupied = new Set(state.items
    .filter((item) => item.type === "actor" && item.id !== actor.id && item.placementMode === "auto" && item.mountId === vehicle?.id)
    .map((item) => Number(item.seatIndex || 0)));
  const availableSeat = (propDefinition(vehicle?.assetType).seats || []).findIndex((seat, index) => !occupied.has(index));
  actor.mountId = vehicle && availableSeat >= 0 ? vehicle.id : "";
  actor.seatIndex = Math.max(0, availableSeat);
  sanitizeAutoMountRelationships(state);
  const sourceId = actor.mountId || actor.id;
  setActiveSource(sourceId);
  selectKeyForSource(sourceId);
  commit();
});

$("#actorSeatSelect").addEventListener("change", (event) => {
  materializeEvaluatedViewForEditing();
  const actor = selectedItem();
  if (!actor || actor.type !== "actor" || actor.placementMode !== "auto" || !actor.mountId) return;
  actor.seatIndex = Math.max(0, Number(event.target.value) || 0);
  sanitizeAutoMountRelationships(state);
  commit();
});

$("#actorPoseJointSelect").addEventListener("change", (event) => {
  const actor = selectedItem();
  if (!actor || actor.type !== "actor") return;
  selectActorPoseJoint(actor.id, event.target.value, { announce: viewMode === "3d" });
  if (viewMode === "3d") setThreeEditMode("pose");
});

["X", "Y", "Z"].forEach((axisName) => {
  const axis = axisName.toLowerCase();
  const slider = $("#actorPoseAxis" + axisName);
  const value = $("#actorPoseAxis" + axisName + "Value");
  slider.addEventListener("input", (event) => {
    updateActorPoseAxis(axis, event.target.value);
    value.value = Math.round(Number(event.target.value));
  });
  value.addEventListener("input", (event) => {
    if (!Number.isFinite(Number(event.target.value))) return;
    updateActorPoseAxis(axis, event.target.value);
    slider.value = event.target.value;
  });
  slider.addEventListener("change", finalizeLiveProjectInputEdit);
  value.addEventListener("change", finalizeLiveProjectInputEdit);
});

$("#actorPoseCategoryTabs").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-pose-category]");
  if (!button) return;
  selectedPoseCategory = button.dataset.poseCategory;
  syncUi(false);
});

$("#actorPosePresets").addEventListener("click", (event) => {
  const deleteBtn = event.target.closest(".pose-delete-mark");
  if (deleteBtn) {
    const parent = deleteBtn.closest("button[data-custom-pose]");
    if (parent) { deleteCustomPose(parent.dataset.customPose); return; }
  }
  const customBtn = event.target.closest("button[data-custom-pose]");
  if (customBtn) { applyCustomPose(customBtn.dataset.customPose); return; }
  const button = event.target.closest("button[data-pose-preset]");
  if (!button) return;
  applyActorPosePreset(button.dataset.posePreset);
});

$("#actorPoseCustomSaveBtn").addEventListener("click", () => {
  saveCustomPose($("#actorPoseCustomNameInput").value);
});

$("#actorPoseCustomNameInput").addEventListener("keydown", (event) => {
  if (event.key === "Enter") { event.preventDefault(); saveCustomPose(event.target.value); }
});

$("#actorPoseResetBtn").addEventListener("click", () => applyActorPosePreset("neutral"));

$("#actorPoseMirrorBtn").addEventListener("click", () => {
  const actor = selectedItem();
  if (!actor || actor.type !== "actor" || sourceEditLocked(actor.id)) return;
  materializeEvaluatedViewForEditing(actor.id);
  const current = state.items.find((item) => item.id === actor.id);
  current.bodyPose = mirrorBodyPose(current.bodyPose);
  selectedPoseActorId = current.id;
  commit();
  notifyApp("배우 포즈를 좌우 반전했습니다.");
});

$("#actorPoseCopyBtn").addEventListener("click", copyActorPose);
$("#actorPosePasteBtn").addEventListener("click", pasteActorPose);
$("#actorPoseRandomBtn").addEventListener("click", randomizeActorPose);

$("#actorPoseKeyBtn").addEventListener("click", captureActorPoseKeyframe);

$("#groupOverlapBtn").addEventListener("click", () => {
  const item = selectedItem();
  if (!item) return;
  const candidates = overlappingItemsForGroup(item, state);
  const members = [item, ...candidates];
  const leader = members.find((entry) => isVehicleProp(entry)) || item;
  const followerIds = members.filter((entry) => entry.id !== leader.id).map((entry) => entry.id);
  if (!confirmKeyframeRemoval(followerIds, `${members.length}개 대상을 묶을까요?`, `${leader.name} 동선 하나로 함께 움직입니다.`)) return;
  materializeEvaluatedViewForEditing();
  const group = createManualGroup([item.id, ...candidates.map((candidate) => candidate.id)], item.id, state);
  if (!group) return;
  setActiveSource(group.leaderId);
  selectKeyForSource(group.leaderId);
  notifyApp(`${group.members.length}개 대상을 하나의 묶음으로 만들었습니다.`);
  commit();
});

$("#ungroupBtn").addEventListener("click", () => {
  materializeEvaluatedViewForEditing();
  const item = selectedItem();
  const group = item ? groupForItem(item.id, state) : null;
  if (!group) return;
  dissolveManualGroup(group.id, state);
  setActiveSource(item.id);
  selectKeyForSource(item.id);
  notifyApp("대상 묶음을 해제했습니다.");
  commit();
});

$("#facingSlider").addEventListener("input", (event) => {
  materializeEvaluatedViewForEditing();
  const item = selectedItem();
  if (!item) return;
  const target = state.items.find((entry) => entry.id === transformLeaderIdForItem(item.id, state)) || item;
  target.facing = Number(event.target.value);
  $("#facingValue").value = Math.round(target.facing);
  draw();
});

$("#facingSlider").addEventListener("change", finalizeLiveProjectInputEdit);

$("#facingValue").addEventListener("input", (event) => {
  materializeEvaluatedViewForEditing();
  const item = selectedItem();
  if (!item) return;
  const target = state.items.find((entry) => entry.id === transformLeaderIdForItem(item.id, state)) || item;
  let val = Number(event.target.value);
  if (!Number.isFinite(val)) return;
  val = normalizePanDeg(val);
  target.facing = val;
  $("#facingSlider").value = val;
  draw();
});
$("#facingValue").addEventListener("change", finalizeLiveProjectInputEdit);

$(".facing-grid").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-facing]");
  const item = selectedItem();
  if (!button || !item) return;
  materializeEvaluatedViewForEditing();
  const target = state.items.find((entry) => entry.id === transformLeaderIdForItem(item.id, state)) || item;
  target.facing = Number(button.dataset.facing);
  selected = { kind: "item", id: item.id };
  commit();
});

$("#sceneTitle").addEventListener("input", (event) => {
  state.sceneTitle = event.target.value;
  const cut = currentCut();
  if (cut) cut.title = event.target.value;
  syncProjectChrome();
});

$("#sceneTitle").addEventListener("change", finalizeLiveProjectInputEdit);

$("#sceneIntent").addEventListener("input", (event) => {
  state.sceneIntent = event.target.value;
  const cut = currentCut();
  if (cut) cut.intent = event.target.value;
});

$("#sceneIntent").addEventListener("change", finalizeLiveProjectInputEdit);

$(".nudge-grid").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-nudge]");
  const item = selectedItem();
  if (!button || !item) return;
  const [dx, dy] = button.dataset.nudge.split(",").map(Number);
  nudge(item, dx, dy, 0.015);
});

function nudge(item, dx, dy, amount) {
  const target = state.items.find((entry) => entry.id === transformLeaderIdForItem(item.id, state)) || item;
  if (sourceEditLocked(target.id)) {
    notifyEditLocked(target.name);
    return;
  }
  target.x = clamp(target.x + dx * amount, 0.02, 0.98);
  target.y = clamp(target.y + dy * amount, 0.02, 0.98);
  commit();
}

$("#duplicateBtn").addEventListener("click", () => {
  const item = selectedItem();
  if (!item) return;
  if (sourceEditLocked(item.id)) {
    notifyEditLocked(item.name);
    return;
  }
  const duplicate = {
    ...clone(item),
    id: uid(),
    name: `${item.name} copy`,
    x: clamp(item.x + 0.04, 0.02, 0.98),
    y: clamp(item.y + 0.04, 0.02, 0.98),
    presetInstanceId: "",
  };
  if (duplicate.type === "actor") {
    duplicate.mountId = "";
    duplicate.seatIndex = 0;
  }
  state.items.push(duplicate);
  selected = { kind: "item", id: duplicate.id };
  setActiveSource(duplicate.id);
  commit();
});

$("#deleteBtn").addEventListener("click", deleteSelected);

function deleteSelected() {
  const item = selectedItem();
  if (!item) return;
  if (sourceEditLocked(item.id)) {
    notifyEditLocked(item.name);
    return;
  }
  const keyCount = keyframeCountForSources(item.id);
  if (!confirm(`${item.name}을(를) 무대에서 삭제할까요?${keyCount ? `\n연결된 키프레임 ${keyCount}개도 함께 삭제됩니다.` : ""}\n이 작업은 실행 취소할 수 있습니다.`)) return;
  removeItemById(item.id);
  commit();
}

function removeItemById(itemId) {
  if (state.camera.trackingTargetId === itemId) state.camera.trackingTargetId = "";
  const item = state.items.find((entry) => entry.id === itemId);
  if (isVehicleProp(item)) detachAutoMountedActors(itemId, state);
  const group = groupForItem(itemId, state);
  if (group) dissolveManualGroup(group.id, state);
  state.items = state.items.filter((entry) => entry.id !== itemId);
  state.motion.keyframes = state.motion.keyframes.filter((keyframe) => keyframe.source !== itemId);
  state.motion.hiddenSources = normalizeHiddenSources(state.motion.hiddenSources)
    .filter((sourceId) => sourceId !== itemId);
  if (state.motion.activeSource === itemId) state.motion.activeSource = "all";
  if (selected?.id === itemId) selected = { kind: "camera" };
  if (!selectedKeyframeExists(state.motion.selectedKeyId)) {
    state.motion.selectedKeyId = state.motion.keyframes[0]?.id || null;
  }
}

$("#undoBtn").addEventListener("click", undo);
$("#redoBtn").addEventListener("click", redo);

$("#viewButtons").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-view]");
  if (!button) return;
  if (workspaceMode === "storyboard") setWorkspaceMode("blocking");
  setViewMode(button.dataset.view);
});

$(".three-editbar").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-three-mode]");
  if (!button) return;
  setThreeEditMode(button.dataset.threeMode || "move");
});

function startNewProject() {
  openProjectCreateDialog({ mode: "blank" });
}

function openProjectCreateDialog({ mode = "blank" } = {}) {
  if (mode === "blank" && (managedProjectId || hasUnsavedProjectChanges())) {
    if (!confirmProjectReplacement("새 프로젝트를 만들면")) return;
  }
  pendingProjectCreationMode = mode === "current" ? "current" : "blank";
  const currentTitle = String(project?.title || "").trim();
  $("#projectCreateInput").value = pendingProjectCreationMode === "current" && currentTitle !== "새 프로젝트"
    ? currentTitle
    : "";
  $("#projectCreateError").hidden = true;
  $("#projectCreateError").innerHTML = "";
  $("#projectCreateDialog").showModal();
  requestAnimationFrame(() => $("#projectCreateInput").focus());
}

$("#newBtn").addEventListener("click", startNewProject);

$("#storyboardBtn").addEventListener("click", () => {
  setWorkspaceMode("storyboard");
});

$("#scenarioBtn").addEventListener("click", openScenarioDialog);
$("#editScenarioBtn").addEventListener("click", openScenarioDialog);
$("#analyzeStructureBtn").addEventListener("click", analyzeScenarioStructure);
$("#applyStructureBtn").addEventListener("click", applyScenarioStructure);
$("#toggleStructureReviewBtn").addEventListener("click", () => {
  if (!structureDraft) return;
  structureReviewMode = !structureReviewMode;
  $("#scenarioDialog").classList.toggle("is-reviewing-structure", structureReviewMode);
  $("#toggleStructureReviewBtn span").textContent = structureReviewMode ? "입력 보기" : "검토 확대";
});
[$("#scenarioProjectTitle"), $("#scenarioLogline"), $("#scenarioTextInput"), $("#storyboardTextInput")].forEach((input) => {
  input.addEventListener("input", () => {
    scenarioDialogDraft = readScenarioDialogDraft();
    structureDraft = null;
    $("#applyStructureBtn").disabled = true;
    $("#structurePreviewSummary").textContent = "텍스트 변경됨 · 재분석 필요";
  });
});

$("#scenarioDialog").addEventListener("close", () => {
  if (scenarioDialogApplied) return;
  scenarioDialogDraft = readScenarioDialogDraft();
  if (scenarioDraftHasChanges()) notifyApp("시나리오·콘티 입력 초안을 이 세션에 유지했습니다.");
});

$("#addSceneBtn").addEventListener("click", addProjectScene);
$("#addCutBtn").addEventListener("click", addProjectCut);
$("#openCutBtn").addEventListener("click", () => openCutInBlocking());
$("#duplicateCutBtn").addEventListener("click", duplicateProjectCut);
$("#deleteCutBtn").addEventListener("click", deleteProjectCut);
$("#selectedCutIssueCount").addEventListener("click", () => {
  const button = $("#selectedCutIssueCount");
  const list = $("#selectedCutIssueList");
  if (button.disabled) return;
  const expanded = button.getAttribute("aria-expanded") === "true";
  button.setAttribute("aria-expanded", String(!expanded));
  list.hidden = expanded;
});

$("#storyboardStatusFilter").addEventListener("change", (event) => {
  storyboardStatusFilter = event.target.value;
  renderStoryboardWorkspace();
});

$$('#contactSheetMenu button[data-contact-sheet-size]').forEach((button) => {
  button.addEventListener("click", () => {
    $("#contactSheetMenu").open = false;
    exportStoryboardContactSheets(Number(button.dataset.contactSheetSize));
  });
});

$("#activeSceneHeading").addEventListener("input", (event) => {
  const scene = currentScene();
  if (!scene) return;
  scene.heading = event.target.value;
  scene.updatedAt = isoNow();
  project.updatedAt = scene.updatedAt;
  setProjectSaveStatus("changed");
});

$("#activeSceneHeading").addEventListener("change", renderStoryboardWorkspace);
$("#activeSceneSynopsis").addEventListener("input", (event) => {
  const scene = currentScene();
  if (!scene) return;
  scene.synopsis = event.target.value;
  scene.updatedAt = isoNow();
  project.updatedAt = scene.updatedAt;
  setProjectSaveStatus("changed");
});

const storyboardInspectorInputs = [
  "#cutStatusInput",
  "#cutTitleInput",
  "#cutShotTypeInput",
  "#cutActionInput",
  "#cutDialogueInput",
  "#cutIntentInput",
  "#cutNotesInput",
];
function captureProjectFieldEditStart(event) {
  if (event.currentTarget.dataset.historyCaptured === "true") return;
  pushProjectHistory();
  event.currentTarget.dataset.historyCaptured = "true";
}

function releaseProjectFieldEdit(event) {
  delete event.currentTarget.dataset.historyCaptured;
}

[$("#activeSceneHeading"), $("#activeSceneSynopsis")].forEach((input) => {
  input.addEventListener("focus", captureProjectFieldEditStart);
  input.addEventListener("blur", releaseProjectFieldEdit);
});

storyboardInspectorInputs.forEach((selector) => {
  const input = $(selector);
  input.addEventListener("focus", captureProjectFieldEditStart);
  input.addEventListener("blur", releaseProjectFieldEdit);
  input.addEventListener("input", () => updateStoryboardCutFromInspector(false));
  input.addEventListener("change", () => updateStoryboardCutFromInspector(true));
});

$("#jsonBtn").addEventListener("click", () => saveManagedProject({ interactive: true }));
$("#backupBtn").addEventListener("click", () => exportJson());
$("#projectManagerBtn").addEventListener("click", () => openProjectLibrary(!managedProjectId));
$("#projectVersionsBtn").addEventListener("click", openProjectVersions);
$("#importBtn").addEventListener("click", () => $("#importInput").click());
$("#shareBtn").addEventListener("click", shareProject);
$("#copyShareLinkBtn").addEventListener("click", copyShareLink);
$("#importInput").addEventListener("change", importJson);
$("#projectLibraryNewBtn").addEventListener("click", startNewProject);
$("#projectCreateSaveBtn").addEventListener("click", createManagedProject);
$("#projectCreateInput").addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  createManagedProject();
});
$("#projectCreateDialog").addEventListener("close", () => {
  pendingProjectCreationMode = "blank";
});
$("#projectLibraryDialog").addEventListener("cancel", (event) => {
  if ($("#projectLibraryDialog").classList.contains("is-required")) event.preventDefault();
});
$("#projectLibrarySearch").addEventListener("input", renderProjectLibrary);
$("#projectLibraryTabs").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-project-library-tab]");
  if (!button) return;
  projectLibraryTab = button.dataset.projectLibraryTab === "trash" ? "trash" : "active";
  $$("#projectLibraryTabs [data-project-library-tab]").forEach((entry) => {
    entry.classList.toggle("is-active", entry === button);
  });
  refreshProjectLibrary();
});
$("#projectLibraryList").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-project-action]");
  if (button) runProjectLibraryAction(button.dataset.projectAction, button.dataset.projectId);
});
$("#projectVersionsList").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-version-revision]");
  if (button) restoreProjectVersion(Number(button.dataset.versionRevision));
});
$("#projectLibraryList").addEventListener("dblclick", (event) => {
  if (projectLibraryTab === "trash" || event.target.closest("button")) return;
  const row = event.target.closest("[data-project-row]");
  if (row) openManagedProject(row.dataset.projectRow);
});
$("#projectRenameSaveBtn").addEventListener("click", applyProjectRename);
$("#projectRenameInput").addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  applyProjectRename();
});
$("#projectRenameDialog").addEventListener("close", () => {
  pendingProjectRenameId = "";
});
$("#videoBtn").addEventListener("click", exportVideo);
$("#videoPanelBtn").addEventListener("click", exportVideo);
$("#blockingPlanBtn").addEventListener("click", exportBlockingPlanImage);
$("#blockingPlanPanelBtn").addEventListener("click", exportBlockingPlanImage);
$("#frameBtn").addEventListener("click", exportCurrentCameraFrame);
$("#framePanelBtn").addEventListener("click", exportCurrentCameraFrame);
$("#framePairBtn").addEventListener("click", exportStartEndCameraFrames);
$("#framePairPanelBtn").addEventListener("click", exportStartEndCameraFrames);
$("#addKeyBtn").addEventListener("click", addMotionKey);
$("#updateKeyBtn").addEventListener("click", updateSelectedKey);
$("#deleteKeyBtn").addEventListener("click", deleteSelectedKey);
$("#playBtn").addEventListener("click", playPreview);
$("#pauseBtn").addEventListener("click", pausePreview);
$("#stopBtn").addEventListener("click", stopPreview);

$$('.toolbar-menu-popover button').forEach((button) => {
  button.addEventListener("click", () => {
    const menu = button.closest("details");
    if (menu) menu.open = false;
  });
});

$$('.toolbar-menu').forEach((menu) => {
  menu.querySelector("summary")?.addEventListener("click", () => {
    if (menu.open) return;
    $$('.toolbar-menu[open]').forEach((otherMenu) => {
      if (otherMenu !== menu) otherMenu.open = false;
    });
  });
  menu.addEventListener("toggle", () => {
    if (!menu.open) return;
    $$('.toolbar-menu[open]').forEach((otherMenu) => {
      if (otherMenu !== menu) otherMenu.open = false;
    });
  });
});

document.addEventListener("pointerdown", (event) => {
  if (event.target.closest?.(".toolbar-menu")) return;
  $$('.toolbar-menu[open]').forEach((menu) => { menu.open = false; });
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || tutorialOpen || document.querySelector("dialog[open]")) return;
  const openMenus = $$('.toolbar-menu[open]');
  if (!openMenus.length) return;
  openMenus.forEach((menu) => { menu.open = false; });
  openMenus.at(-1)?.querySelector("summary")?.focus({ preventScroll: true });
  event.preventDefault();
});

$("#keySourceSelect").addEventListener("change", (event) => {
  setActiveSource(event.target.value);
  if (event.target.value !== "all") {
    selectSourceOnStage(event.target.value);
  }
  selectKeyForSource(event.target.value);
  syncUi();
  draw();
});

$("#timelineTrack").addEventListener("click", (event) => {
  const rect = event.currentTarget.getBoundingClientRect();
  const percent = clamp((event.clientX - rect.left) / rect.width, 0, 1);
  scrubToTime(percent * state.motion.duration);
});

$("#timelineMode").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-timeline-view]");
  if (!button) return;
  state.motion.timelineView = button.dataset.timelineView === "split" ? "split" : "combined";
  commit();
});

function scrubFromTimelineTimeInput(event) {
  if (preview) pausePreview();
  const time = clamp(Number(event.target.value), 0, MAX_TIMELINE_DURATION);
  const previousDuration = state.motion.duration;
  ensureDurationCovers(time);
  if (state.motion.duration !== previousDuration) commit();
  scrubToTime(time);
}

$("#keyTimeInput").addEventListener("change", scrubFromTimelineTimeInput);
$("#keyTimeInput").addEventListener("keydown", (event) => {
  event.stopPropagation();
  if (event.key !== "Enter") return;
  event.preventDefault();
  scrubFromTimelineTimeInput(event);
  event.target.blur();
});

$("#keyTransitionSelect").addEventListener("change", (event) => {
  const keyframe = selectedKeyframe();
  if (!keyframe) return;
  if (sourceEditLocked(keyframe.source)) {
    notifyEditLocked(sourceLabel(keyframe.source));
    syncUi();
    return;
  }
  const sourceKeys = keysForSource(keyframe.source);
  if (sourceKeys[0]?.id === keyframe.id) {
    syncUi();
    return;
  }
  const previousMode = normalizeTransition(keyframe.transition);
  const nextMode = normalizeTransition(event.target.value);
  const sameTimeKeys = state.motion.keyframes.filter((entry) => (
    Math.abs(entry.time - keyframe.time) < 0.05 && !sourceEditLocked(entry.source)
  ));
  if (nextMode === "cut") {
    sameTimeKeys.forEach((entry) => {
      if (keysForSource(entry.source)[0]?.id !== entry.id) entry.transition = "cut";
    });
  } else if (previousMode === "cut") {
    sameTimeKeys.forEach((entry) => {
      if (entry.transition === "cut") entry.transition = nextMode;
    });
  } else {
    keyframe.transition = nextMode;
  }
  commit();
});

function saveSelectedKeyInstruction(event) {
  const keyframe = selectedKeyframe();
  if (!keyframe) {
    syncUi();
    return;
  }
  if (sourceEditLocked(keyframe.source)) {
    notifyEditLocked(sourceLabel(keyframe.source));
    syncUi();
    return;
  }
  keyframe.note = String(event.target.value || "").trim().slice(0, 80);
  commit();
}

$("#keyInstructionInput").addEventListener("change", saveSelectedKeyInstruction);
$("#keyInstructionInput").addEventListener("keydown", (event) => {
  event.stopPropagation();
  if (event.key !== "Enter") return;
  event.preventDefault();
  saveSelectedKeyInstruction(event);
  event.target.blur();
});

$("#durationInput").addEventListener("change", (event) => {
  if (hasLockedTimelineSources()) {
    notifyApp("잠긴 대상의 키가 있어 전체 길이를 바꿀 수 없습니다.");
    syncUi();
    return;
  }
  const previousDuration = state.motion.duration || 1;
  const nextDuration = clamp(Number(event.target.value), 1, MAX_TIMELINE_DURATION);
  const scale = nextDuration / previousDuration;
  state.motion.duration = nextDuration;
  state.motion.playhead = clamp(state.motion.playhead * scale, 0, state.motion.duration);
  state.motion.keyframes.forEach((keyframe) => {
    keyframe.time = clamp(Number((keyframe.time * scale).toFixed(2)), 0, state.motion.duration);
  });
  commit();
});

$("#fpsInput").addEventListener("change", (event) => {
  state.motion.fps = clamp(Number(event.target.value), 12, 60);
  commit();
});

function addMotionKey() {
  const requestedTime = readTimelineTimeInput(state.motion.playhead);
  ensureDurationCovers(requestedTime);
  const selectedStageSource = selectedSourceId();
  const requestedSources = activeSourceId() === "all"
    ? visibleSourceDefinitions().map((source) => source.id)
    : [activeSourceId()];
  const sources = requestedSources.filter((sourceId) => !sourceEditLocked(sourceId));
  if (!sources.length) return;
  ensureDurationCovers(requestedTime);
  materializeEvaluatedViewForEditing(activeSourceId());
  const requestedPathMode = $("#keyPathSelect")?.value || "straight";
  const changedKeys = [];
  sources.forEach((sourceId) => {
    const time = availableKeyTime(requestedTime, sourceId, { maxTime: MAX_TIMELINE_DURATION });
    ensureDurationCovers(time);
    const keyframe = createSourceKeyframe(sourceId, time, requestedPathMode);
    if (keyframe) changedKeys.push(keyframe);
  });
  state.motion.keyframes = sortKeyframes(state.motion.keyframes);
  const selectedKey = activeSourceId() === "all"
    ? changedKeys.find((keyframe) => keyframe.source === selectedStageSource) || changedKeys[0]
    : changedKeys[0];
  state.motion.selectedKeyId = selectedKey?.id || state.motion.selectedKeyId;
  state.motion.playhead = selectedKey?.time ?? requestedTime;
  commit();
  const skipped = requestedSources.length - sources.length;
  notifyApp(skipped
    ? `잠긴 대상 ${skipped}개를 제외하고 키 ${changedKeys.length}개를 추가했습니다.`
    : `현재 시간에 키 ${changedKeys.length}개를 추가했습니다.`);
}

function updateSelectedKey() {
  const sourceId = activeSourceId();
  const keyframe = sourceId === "all"
    ? selectedKeyframe()
    : selectedKeyframe()?.source === sourceId
      ? selectedKeyframe()
      : selectKeyForSource(sourceId);
  if (!keyframe) return;
  if (sourceEditLocked(keyframe.source)) {
    notifyEditLocked(sourceLabel(keyframe.source));
    return;
  }
  materializeEvaluatedViewForEditing(keyframe.source);
  const previousPose = clone(keyframe.pose);
  const requestedTime = readTimelineTimeInput(keyframe.time);
  const cutGroup = keyframe.transition === "cut"
    ? state.motion.keyframes.filter((entry) => (
      entry.transition === "cut"
      && Math.abs(entry.time - keyframe.time) < 0.05
      && !sourceEditLocked(entry.source)
    ))
    : [keyframe];
  const time = cutGroup.length > 1
    ? availableGroupedKeyTime(requestedTime, cutGroup, MAX_TIMELINE_DURATION)
    : availableKeyTime(requestedTime, keyframe.source, { excludeId: keyframe.id, maxTime: MAX_TIMELINE_DURATION });
  ensureDurationCovers(time);
  cutGroup.forEach((entry) => {
    entry.time = time;
  });
  const nextPose = poseForSource(keyframe.source);
  keyframe.pose = keyframe.source === "camera"
    ? mergeLockedCameraPose(nextPose, keyframe.pose)
    : nextPose;
  const requestedPathMode = $("#keyPathSelect")?.value || pathModeForSegment(keyframe.segment, keyframe.source);
  applyPathModeToKeyframe(keyframe, requestedPathMode);
  if (keyframe.source === "camera") {
    keyframe.pose = mergeLockedCameraPose(keyframe.pose, previousPose);
    applySourcePose("camera", keyframe.pose);
  }
  state.motion.playhead = time;
  state.motion.keyframes = sortKeyframes(state.motion.keyframes);
  commit();
  notifyApp("선택한 키를 갱신했습니다.");
}

function deleteSelectedKey() {
  const keyframe = selectedKeyframe();
  if (!keyframe) return;
  if (sourceEditLocked(keyframe.source)) {
    notifyEditLocked(sourceLabel(keyframe.source));
    return;
  }
  state.motion.keyframes = state.motion.keyframes.filter((entry) => entry.id !== keyframe.id);
  const next = nearestKeyframe(keysForSource(keyframe.source), keyframe.time)
    || nearestKeyframe(sortKeyframes(state.motion.keyframes), keyframe.time);
  state.motion.selectedKeyId = next?.id || null;
  if (next) {
    setActiveSource(next.source);
    selectSourceOnStage(next.source);
    applyKeyframeToStage(next);
  }
  else state.motion.selectedKeyId = null;
  commit();
  notifyApp("선택한 키를 삭제했습니다.");
}

function createSourceKeyframe(sourceId, time, pathMode = "straight") {
  showSourceTimeline(sourceId);
  const keyframe = captureSourceKeyframe(sourceId, time, undefined, pathMode);
  if (keyframe) {
    applyPathModeToKeyframe(keyframe, pathMode);
    state.motion.keyframes.push(keyframe);
  }
  return keyframe;
}

function applyPathModeToKeyframe(keyframe, pathMode) {
  const sourceType = keyframe.source === "camera" ? "camera" : "actor";
  const mode = normalizePathMode(pathMode, sourceType);
  const previous = sortKeyframes(state.motion.keyframes
    .filter((entry) => entry.source === keyframe.source && entry.id !== keyframe.id && entry.time < keyframe.time - 0.001))
    .at(-1);
  const previousSegment = keyframe.segment;
  keyframe.segment = motionSegmentForPathMode(mode, keyframe.source);
  if (!previous) return;
  if (mode === "free-curve") {
    keyframe.segment.plan.control = pathModeForSegment(previousSegment, keyframe.source) === "free-curve"
      && previousSegment?.plan?.control
      ? clone(previousSegment.plan.control)
      : defaultFreeCurveControl(previous.pose, keyframe.pose);
  }
  const effectiveMode = mode === "straight"
    ? magneticAxisMode(previous.pose, keyframe.pose)
    : mode;
  const constrained = constrainPathEndpoint(previous.pose, keyframe.pose, effectiveMode, sourceType);
  keyframe.pose = sanitizeSourcePose(keyframe.source, constrained);
  applySourcePose(keyframe.source, keyframe.pose);
}

function magneticAxisMode(startPose, endPose, renderState = state) {
  const size = stageWorldSize(renderState);
  const dx = Math.abs(endPose.x - startPose.x) * size.width;
  const dy = Math.abs(endPose.y - startPose.y) * size.depth;
  const thresholdMeters = 0.22;
  if (dy <= thresholdMeters && dy <= dx) return "horizontal";
  if (dx <= thresholdMeters) return "vertical";
  return "straight";
}

function defaultFreeCurveControl(startPose, endPose, renderState = state) {
  const size = stageWorldSize(renderState);
  const start = { x: (startPose.x - 0.5) * size.width, y: (startPose.y - 0.5) * size.depth };
  const end = { x: (endPose.x - 0.5) * size.width, y: (endPose.y - 0.5) * size.depth };
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy) || 1;
  const offset = Math.min(1.6, length * 0.32);
  const control = {
    x: (start.x + end.x) / 2 - dy / length * offset,
    y: (start.y + end.y) / 2 + dx / length * offset,
  };
  return { x: control.x / size.width + 0.5, y: control.y / size.depth + 0.5 };
}

function reconcileSourcePathConstraints(sourceId, options = {}) {
  const keys = state.motion.keyframes
    .filter((entry) => entry.source === sourceId)
    .sort((a, b) => a.time - b.time || a.label.localeCompare(b.label));
  const sourceType = sourceId === "camera" ? "camera" : "actor";
  for (let index = 1; index < keys.length; index += 1) {
    const previous = keys[index - 1];
    const current = keys[index];
    const mode = pathModeForSegment(current.segment, current.source);
    current.pose = sanitizeSourcePose(
      sourceId,
      constrainPathEndpoint(previous.pose, current.pose, mode, sourceType),
    );
  }
  if (options.applySelection !== false) {
    const selectedKey = selectedKeyframe();
    if (selectedKey?.source === sourceId) applySourcePose(sourceId, selectedKey.pose);
  }
}

function keysForSource(sourceId, keyframes = state.motion.keyframes) {
  return sortKeyframes(keyframes.filter((keyframe) => keyframe.source === sourceId));
}

function availableKeyTime(requestedTime, sourceId = activeSourceId(), options = {}) {
  let time = clamp(requestedTime, 0, options.maxTime ?? state.motion.duration);
  const step = 0.1;
  const candidateKeys = (sourceId === "all" ? state.motion.keyframes : keysForSource(sourceId))
    .filter((keyframe) => keyframe.id !== options.excludeId);
  const maxTime = options.maxTime ?? state.motion.duration;
  const hasCollision = () => candidateKeys.some((keyframe) => Math.abs(keyframe.time - time) < 0.05);
  while (hasCollision() && time + step <= maxTime) time = Number((time + step).toFixed(1));
  while (hasCollision() && time - step >= 0) time = Number((time - step).toFixed(1));
  return clamp(time, 0, maxTime);
}

function availableGroupedKeyTime(requestedTime, groupedKeys, maxTime = state.motion.duration) {
  let time = clamp(requestedTime, 0, maxTime);
  const step = 0.1;
  const groupedIds = new Set(groupedKeys.map((keyframe) => keyframe.id));
  const groupedSources = new Set(groupedKeys.map((keyframe) => keyframe.source));
  const hasCollision = () => state.motion.keyframes.some((keyframe) => (
    !groupedIds.has(keyframe.id)
    && groupedSources.has(keyframe.source)
    && Math.abs(keyframe.time - time) < 0.05
  ));
  while (hasCollision() && time + step <= maxTime) time = Number((time + step).toFixed(1));
  while (hasCollision() && time - step >= 0) time = Number((time - step).toFixed(1));
  return clamp(time, 0, maxTime);
}

function selectKeyframe(id) {
  const keyframe = state.motion.keyframes.find((entry) => entry.id === id);
  if (!keyframe) return;
  setActiveSource(keyframe.source);
  selectSourceOnStage(keyframe.source);
  applyKeyframeToStage(keyframe);
  syncUi();
  draw();
}

function scrubToTime(time) {
  if (preview) pausePreview();
  const safeTime = clamp(time, 0, state.motion.duration);
  evaluatedViewState = interpolateStateAtTime(safeTime);
  syncUi();
  draw(evaluatedViewState);
}

function displayPlayhead() {
  return evaluatedViewState?.motion?.playhead ?? state.motion.playhead;
}

function restoreUncommittedState(startState) {
  state = clone(startState);
  evaluatedViewState = null;
  sanitizeState();
  const cut = currentCut();
  if (cut) cut.blocking = state;
  selected = selectedExists(selected) ? selected : { kind: "camera" };
  selectKeyForSource(selectedSourceId() || activeSourceId());
  syncUi();
  draw();
  syncProjectChrome();
}

function materializeEvaluatedViewForEditing(sourceId = selectedSourceId() || activeSourceId()) {
  if (!evaluatedViewState) return;
  state.motion.playhead = evaluatedViewState.motion.playhead;
  if (sourceId === "all") {
    state.camera = clone(evaluatedViewState.camera);
    state.items = clone(evaluatedViewState.items);
  } else if (sourceId === "camera") {
    state.camera = clone(evaluatedViewState.camera);
  } else {
    const evaluatedItem = evaluatedViewState.items.find((item) => item.id === sourceId);
    const itemIndex = state.items.findIndex((item) => item.id === sourceId);
    if (evaluatedItem && itemIndex >= 0) state.items[itemIndex] = clone(evaluatedItem);
  }
  evaluatedViewState = null;
}

function interpolateState(t) {
  return interpolateStateAtTime(clamp(t, 0, 1) * state.motion.duration);
}

function interpolateStateAtTime(time) {
  const safeTime = clamp(time, 0, state.motion.duration);
  const next = clone(state);
  next.camera = interpolateSourceAtTime("camera", safeTime, state.camera);
  next.items = state.items.map((item) => interpolateSourceAtTime(item.id, safeTime, item));
  next.motion.playhead = safeTime;
  return applyCameraTracking(next);
}

function interpolateSourceAtTime(sourceId, time, fallbackPose) {
  return interpolateSourceAtTimeFor(state, sourceId, time, fallbackPose);
}

function lerpAngle(a, b, t) {
  let delta = ((b - a + 540) % 360) - 180;
  return (a + delta * t + 360) % 360;
}

function playPreview() {
  if (preview) return;
  const startTime = displayPlayhead() >= state.motion.duration - 0.001 ? 0 : displayPlayhead();
  const startedAt = performance.now();
  const duration = Math.max(0.001, state.motion.duration);
  preview = requestAnimationFrame(function frame(now) {
    const elapsed = startTime + (now - startedAt) / 1000;
    const time = Math.min(elapsed, duration);
    evaluatedViewState = interpolateStateAtTime(time);
    updatePlayheadDisplay(time);
    draw(evaluatedViewState, { clean: false });
    if (elapsed >= duration) {
      preview = null;
      syncPlaybackControls();
      return;
    }
    preview = requestAnimationFrame(frame);
  });
  syncPlaybackControls();
}

function pausePreview() {
  if (preview) cancelAnimationFrame(preview);
  preview = null;
  if (evaluatedViewState) {
    updatePlayheadDisplay(evaluatedViewState.motion.playhead);
    draw(evaluatedViewState, { clean: false });
  }
  syncPlaybackControls();
}

function stopPreview() {
  if (preview) cancelAnimationFrame(preview);
  preview = null;
  evaluatedViewState = interpolateStateAtTime(0);
  updatePlayheadDisplay(0);
  draw(evaluatedViewState, { clean: false });
  syncPlaybackControls();
}

function cancelPreview() {
  if (preview) cancelAnimationFrame(preview);
  preview = null;
  evaluatedViewState = null;
  updatePlayheadDisplay(state.motion.playhead);
  draw();
  syncPlaybackControls();
}

function syncPlaybackControls() {
  const playing = Boolean(preview);
  const playButton = $("#playBtn");
  const pauseButton = $("#pauseBtn");
  const stopButton = $("#stopBtn");
  if (playButton) playButton.disabled = playing;
  if (pauseButton) pauseButton.disabled = !playing;
  if (stopButton) stopButton.disabled = !playing && displayPlayhead() <= 0.001;
}

function computePrevisQuality(renderState = state) {
  const actors = renderState.items.filter((item) => item.type === "actor");
  const props = renderState.items.filter((item) => item.type === "prop");
  const framing = analyzeFraming(renderState);
  const keyframes = sortKeyframes(renderState.motion.keyframes || []);
  const stageSize = stageWorldSize(renderState);
  const cameraHeading = degToRad(renderState.camera.panDeg);
  const nearestActorAngle = actors.length
    ? Math.min(...actors.map((actor) => {
      const pose = resolvedItemPose(actor, renderState);
      const actorHeading = Math.atan2(
        (pose.y - renderState.camera.y) * stageSize.depth,
        (pose.x - renderState.camera.x) * stageSize.width,
      );
      return Math.abs(Math.atan2(Math.sin(actorHeading - cameraHeading), Math.cos(actorHeading - cameraHeading)));
    }))
    : Math.PI;
  const sourceCounts = sourceDefinitions(renderState).map((source) => ({
    source,
    count: keyframes.filter((keyframe) => keyframe.source === source.id).length,
  }));
  const movingSources = sourceCounts.filter((entry) => entry.count > 1);
  const rightmostTime = keyframes.reduce((max, keyframe) => Math.max(max, keyframe.time), 0);
  const hasCameraKeys = keyframes.some((keyframe) => keyframe.source === "camera");
  const notesReady = String(renderState.sceneIntent || "").trim().length >= 32;
  const checks = [
    {
      id: "actors",
      label: actors.length ? `배우 마크 ${actors.length}개` : "배우 마크를 1개 이상 추가",
      ok: actors.length > 0,
      weight: 12,
    },
    {
      id: "shot_notes",
      label: notesReady ? "샷 의도 작성됨" : "샷 의도를 조금 더 구체화",
      ok: notesReady,
      weight: 10,
    },
    {
      id: "camera_orientation",
      label: "카메라 팬·틸트 설정됨",
      ok: Number.isFinite(renderState.camera.panDeg) && Number.isFinite(renderState.camera.tiltDeg),
      weight: 12,
    },
    {
      id: "camera_subject",
      label: nearestActorAngle < degToRad(22) ? "카메라 방향에 인물이 있음" : "팬을 인물 쪽으로 조정",
      ok: nearestActorAngle < degToRad(22),
      weight: 10,
    },
    {
      id: "framing",
      label: framing.reviewCount
        ? `프레임 점검 ${framing.reviewCount}개`
        : "샘플 지점이 카메라 프레임 안에 있음",
      ok: framing.reviewCount === 0,
      weight: 12,
    },
    {
      id: "lens",
      label: `${renderState.camera.focal}mm / ${Math.round(focalToFov(renderState.camera.focal))}° 화각`,
      ok: renderState.camera.focal >= 14 && renderState.camera.focal <= 135,
      weight: 8,
    },
    {
      id: "duration",
      label: `타임라인 ${renderState.motion.duration.toFixed(1)}초`,
      ok: renderState.motion.duration >= 2 && renderState.motion.duration <= 30,
      weight: 8,
    },
    {
      id: "camera_keys",
      label: hasCameraKeys ? "카메라 키 있음" : "카메라 키프레임 추가",
      ok: hasCameraKeys,
      weight: 8,
    },
    {
      id: "motion_keys",
      label: movingSources.length ? `움직이는 대상 ${movingSources.length}개` : "움직일 대상에 두 번째 키 추가",
      ok: movingSources.length > 0,
      weight: 12,
    },
    {
      id: "timeline_end",
      label: Math.abs(rightmostTime - renderState.motion.duration) <= 0.25 ? "마지막 키가 끝점에 있음" : "마지막 키를 끝 지점으로 이동",
      ok: Math.abs(rightmostTime - renderState.motion.duration) <= 0.25,
      weight: 10,
    },
    {
      id: "props",
      label: props.length ? `소품/공간 앵커 ${props.length}개` : "필요하면 소품이나 공간 앵커 추가",
      ok: props.length > 0 || renderState.previs.mode !== "full-scene",
      weight: 10,
    },
  ];
  const total = checks.reduce((sum, check) => sum + check.weight, 0);
  const earned = checks.reduce((sum, check) => sum + (check.ok ? check.weight : 0), 0);
  const score = Math.round((earned / total) * 100);
  const readiness = score >= 86 ? "준비됨" : score >= 70 ? "점검" : "보완 필요";
  return {
    score,
    readiness,
    target: previsTargets[renderState.previs.target],
    mode: previsModes[renderState.previs.mode].label,
    framing,
    checks,
  };
}

function analyzeFraming(renderState = state) {
  const times = framingSampleTimes(renderState);
  const samples = times.map((time) => {
    const frameState = interpolateRenderStateAtTime(renderState, time);
    const camera = frameState.camera;
    const heading = degToRad(camera.panDeg);
    const halfFov = degToRad(focalToFov(camera.focal)) / 2;
    const subjects = framingSubjectsForMode(frameState)
      .map((item) => resolvedItemPose(item, frameState))
      .map((item) => framingSubjectStatus(item, camera, heading, halfFov));
    return { time, subjects };
  });
  const flat = samples.flatMap((sample) => sample.subjects.map((subject) => ({ ...subject, time: sample.time })));
  const outside = flat.filter((entry) => entry.status === "outside" || entry.status === "behind");
  const edge = flat.filter((entry) => entry.status === "edge");
  const review = [...outside, ...edge];
  return {
    sampleTimes: times,
    reviewCount: review.length,
    outsideCount: outside.length,
    edgeCount: edge.length,
    samples,
    notes: review.slice(0, 8).map((entry) => `${entry.name} at ${entry.time.toFixed(1)}s is ${framingStatusLabel(entry.status)}`),
  };
}

function framingSampleTimes(renderState = state) {
  const duration = renderState.motion?.duration || 0;
  const times = new Set([0, duration]);
  const keyframes = sortKeyframes(renderState.motion?.keyframes || []);
  keyframes.forEach((keyframe) => times.add(Number(keyframe.time.toFixed(2))));
  sourceDefinitions(renderState).forEach((source) => {
    const keys = keyframes.filter((keyframe) => keyframe.source === source.id);
    for (let index = 1; index < keys.length; index += 1) {
      times.add(Number(((keys[index - 1].time + keys[index].time) / 2).toFixed(2)));
    }
  });
  return [...times]
    .filter((time) => Number.isFinite(time))
    .map((time) => clamp(time, 0, duration))
    .sort((a, b) => a - b)
    .filter((time, index, list) => index === 0 || Math.abs(time - list[index - 1]) > 0.05)
    .slice(0, 24);
}

function framingSubjectsForMode(renderState) {
  const mode = renderState.previs?.mode || "full-scene";
  return renderState.items.filter((item) => {
    if (mode === "camera-only") return false;
    if (mode === "focus-framing" || mode === "actor-blocking") return item.type === "actor";
    return item.type === "actor" || (item.type === "prop" && item.motionEnabled !== false);
  });
}

function framingSubjectStatus(item, camera, heading, halfFov) {
  const dx = item.x - camera.x;
  const dy = item.y - camera.y;
  const distanceToCamera = Math.hypot(dx, dy);
  const delta = angleDeltaRad(Math.atan2(dy, dx), heading);
  const forward = Math.cos(delta) * distanceToCamera;
  const normalized = halfFov > 0 ? Math.abs(delta) / halfFov : 99;
  const screenX = 0.5 + Math.tan(delta) / (2 * Math.tan(halfFov));
  let status = "inside";
  if (forward <= 0.01) status = "behind";
  else if (Math.abs(delta) > halfFov * 1.08) status = "outside";
  else if (normalized > 0.78) status = "edge";
  return {
    id: item.id,
    name: `@${item.name}`,
    type: item.type,
    status,
    screenX: round(screenX),
    angleDeg: round(Math.abs((delta * 180) / Math.PI), 1),
    distance: round(distanceToCamera),
    margin: round(1 - normalized),
  };
}

function angleDeltaRad(a, b) {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}

function framingStatusLabel(status) {
  if (status === "edge") return "near the frame edge";
  if (status === "behind") return "behind the camera";
  if (status === "outside") return "outside the frame";
  return "inside the frame";
}

function interpolateRenderStateAtTime(renderState, time) {
  if (renderState === state) return interpolateStateAtTime(time);
  const safeTime = clamp(time, 0, renderState.motion.duration);
  const next = clone(renderState);
  next.camera = interpolateSourceAtTimeFor(renderState, "camera", safeTime, renderState.camera);
  next.items = renderState.items.map((item) => interpolateSourceAtTimeFor(renderState, item.id, safeTime, item));
  next.motion.playhead = safeTime;
  return applyCameraTracking(next);
}

function interpolateSourceAtTimeFor(renderState, sourceId, time, fallbackPose) {
  const keyframes = sortKeyframes(renderState.motion?.keyframes || []).filter((keyframe) => keyframe.source === sourceId);
  if (!keyframes.length) return clone(fallbackPose);
  if (keyframes.length === 1 || time <= keyframes[0].time) return mergePoseWithFallbackFor(renderState, sourceId, keyframes[0].pose, fallbackPose);
  const last = keyframes[keyframes.length - 1];
  if (time >= last.time) return mergePoseWithFallbackFor(renderState, sourceId, last.pose, fallbackPose);

  let start = keyframes[0];
  let end = last;
  for (let i = 0; i < keyframes.length - 1; i += 1) {
    if (time >= keyframes[i].time && time <= keyframes[i + 1].time) {
      start = keyframes[i];
      end = keyframes[i + 1];
      break;
    }
  }
  const progress = transitionProgress(time, start.time, end.time, end.transition);
  return interpolatePoseFor(renderState, sourceId, start.pose, end.pose, progress, fallbackPose, end);
}

function mergePoseWithFallbackFor(renderState, sourceId, pose, fallbackPose) {
  if (sourceId === "camera") {
    return sanitizeCameraPoseFor(renderState, { ...fallbackPose, ...pose });
  }
  return preserveItemStructure(
    sanitizeItemPose({ ...fallbackPose, ...pose, id: sourceId }),
    fallbackPose,
  );
}

function interpolatePoseFor(renderState, sourceId, startPose, endPose, t, fallbackPose, endKeyframe = null) {
  const from = mergePoseWithFallbackFor(renderState, sourceId, startPose, fallbackPose);
  const to = mergePoseWithFallbackFor(renderState, sourceId, endPose, fallbackPose);
  const segment = sanitizeMotionSegment(endKeyframe?.segment, sourceId);
  const spatial = evaluateMotionSegment(renderState, sourceId, from, to, t, segment);
  if (sourceId === "camera") {
    return syncCameraDerivedAim({
      ...from,
      x: spatial.x,
      y: spatial.y,
      height: spatial.height,
      panDeg: lerpAngle(from.panDeg, to.panDeg, t),
      tiltDeg: lerp(from.tiltDeg, to.tiltDeg, t),
      focal: Math.round(lerp(from.focal, to.focal, t)),
      trackingTargetId: sanitizeTrackingTargetId(t < 0.5 ? from.trackingTargetId : to.trackingTargetId, renderState),
    }, renderState);
  }
  return {
    ...from,
    x: spatial.x,
    y: spatial.y,
    size: lerp(from.size, to.size, t),
    scaleX: lerp(from.scaleX, to.scaleX, t),
    scaleY: lerp(from.scaleY, to.scaleY, t),
    scaleZ: lerp(from.scaleZ, to.scaleZ, t),
    facing: lerpAngle(from.facing, to.facing, t),
    bodyPose: from.type === "actor" ? interpolateBodyPose(from.bodyPose, to.bodyPose, t) : null,
    color: to.color,
    shape: to.shape,
    assetType: to.assetType,
    mountId: t < 0.5 ? from.mountId : to.mountId,
    seatIndex: t < 0.5 ? from.seatIndex : to.seatIndex,
    name: to.name,
    visible: t < 0.5 ? from.visible !== false : to.visible !== false,
  };
}

function evaluateMotionSegment(renderState, sourceId, from, to, progress, segment) {
  const t = clamp(Number(progress), 0, 1);
  const size = stageWorldSize(renderState);
  const startWorld = {
    x: (from.x - 0.5) * size.width,
    y: (from.y - 0.5) * size.depth,
  };
  const endWorld = {
    x: (to.x - 0.5) * size.width,
    y: (to.y - 0.5) * size.depth,
  };
  const mode = pathModeForSegment(segment, sourceId);
  let planar = samplePlanarPath(startWorld, endWorld, t, mode, {
    sourceType: sourceId === "camera" ? "camera" : "actor",
    bulge: Math.abs(Number(segment?.plan?.bulge ?? 0.32)),
    control: segment?.plan?.control
      ? {
          x: (segment.plan.control.x - 0.5) * size.width,
          y: (segment.plan.control.y - 0.5) * size.depth,
        }
      : null,
  });
  let height = sourceId === "camera" ? lerp(from.height, to.height, t) : 0;

  if (sourceId === "camera" && segment.elevation.kind === "jib-arc") {
    const planarDistance = Math.hypot(endWorld.x - startWorld.x, endWorld.y - startWorld.y);
    const side = Number(segment.elevation.bulge ?? 0.32) < 0 ? -1 : 1;
    const verticalArc = circularArcPoint(
      { x: 0, y: from.height },
      { x: Math.max(0.0001, planarDistance), y: to.height },
      t,
      side,
      Math.abs(Number(segment.elevation.bulge ?? 0.32)),
    );
    const distanceProgress = planarDistance > 0.0001 ? verticalArc.x / planarDistance : t;
    planar = {
      x: lerp(startWorld.x, endWorld.x, distanceProgress),
      y: lerp(startWorld.y, endWorld.y, distanceProgress),
    };
    height = verticalArc.y;
  }

  return {
    x: planar.x / size.width + 0.5,
    y: planar.y / size.depth + 0.5,
    height: Number.isFinite(height) ? height : lerp(from.height, to.height, t),
  };
}

function sampleMotionPathPoses(renderState, sourceId, keyframes, samplesPerSegment = 24) {
  if (!keyframes.length) return [];
  const fallback = sourceId === "camera"
    ? renderState.camera
    : renderState.items.find((item) => item.id === sourceId) || keyframes[0].pose;
  const samples = [mergePoseWithFallbackFor(renderState, sourceId, keyframes[0].pose, fallback)];
  for (let index = 1; index < keyframes.length; index += 1) {
    const start = keyframes[index - 1];
    const end = keyframes[index];
    for (let step = 1; step <= samplesPerSegment; step += 1) {
      samples.push(interpolatePoseFor(renderState, sourceId, start.pose, end.pose, step / samplesPerSegment, fallback, end));
    }
  }
  return samples;
}

function sanitizeCameraPoseFor(renderState, camera) {
  const orientation = cameraOrientationFromLegacy(camera, renderState);
  const sanitized = {
    x: clamp(Number(camera.x ?? renderState.camera.x), 0.02, 0.98),
    y: clamp(Number(camera.y ?? renderState.camera.y), 0.02, 0.98),
    height: clamp(Number(camera.height ?? renderState.camera.height ?? 1.6), 0.4, 3),
    panDeg: normalizePanDeg(Number.isFinite(Number(camera.panDeg)) ? camera.panDeg : orientation.panDeg),
    tiltDeg: clamp(Number.isFinite(Number(camera.tiltDeg)) ? Number(camera.tiltDeg) : orientation.tiltDeg, -60, 60),
    focal: clamp(Number(camera.focal ?? renderState.camera.focal), 14, 135),
    trackingTargetId: sanitizeTrackingTargetId(camera.trackingTargetId ?? renderState.camera.trackingTargetId, renderState),
    locks: sanitizeCameraLocks(renderState.camera.locks),
  };
  return syncCameraDerivedAim(sanitized, renderState);
}

async function exportProductionPack() {
  syncPlayheadFromTimeInput();
  const pack = await buildProductionPack();
  const zip = await createZip(pack.files);
  presentExport(zip, `${slug(state.sceneTitle)}_previs_pack.zip`, "제작팩 ZIP");
}

async function buildProductionPack() {
  const quality = computePrevisQuality();
  const topdown = await renderTopdownPngBlob();
  const cameraFrame = await captureCameraFrameBlob(state);
  const storyboard = await captureStoryboardFrames();
  const storyboardContactSheet = await renderStoryboardContactSheet(storyboard);
  const manifest = buildPrevisManifest(quality, storyboard);
  const files = [
    { path: "manifest.json", content: JSON.stringify(manifest, null, 2) },
    { path: "project/frisframe.json", content: JSON.stringify({ app: SERVICE_NAME, state }, null, 2) },
    { path: "project/camera_plan.json", content: JSON.stringify(buildCameraPlan(), null, 2) },
    { path: "project/motion_keyframes.csv", content: buildMotionCsv() },
    { path: "project/framing_analysis.json", content: JSON.stringify(quality.framing, null, 2) },
    { path: "docs/shot_bible.md", content: buildShotBibleMarkdown(quality) },
    { path: "docs/live_action_brief.md", content: buildLiveActionBrief(quality) },
    { path: "docs/ai_generation_brief.md", content: buildAiGenerationBrief(quality) },
    { path: "docs/on_set_checklist.md", content: buildOnSetChecklist(quality) },
    { path: "docs/framing_analysis.md", content: buildFramingAnalysisMarkdown(quality.framing) },
    { path: "docs/camera_storyboard.md", content: buildCameraStoryboardMarkdown(storyboard) },
    { path: "docs/seedance_prompt.md", content: buildSeedancePrompt() },
    { path: "docs/quality_report.json", content: JSON.stringify(quality, null, 2) },
    { path: "blender/blender_previs_scene.py", content: buildBlenderPrevisScript() },
    { path: "media/topdown_blocking.png", blob: topdown },
    { path: "media/camera_frame_current.png", blob: cameraFrame },
    { path: "storyboard/contact_sheet.png", blob: storyboardContactSheet },
    ...storyboard.map((frame) => ({ path: frame.path, blob: frame.blob })),
  ];
  return { manifest, files };
}

function buildPrevisManifest(quality, storyboard = []) {
  return {
    app: SERVICE_NAME,
    pipeline: "blocking + 3d-camera-previs production pack",
    exportedAt: new Date().toISOString(),
    scene: state.sceneTitle || "Untitled blocking",
    aspect: state.aspect,
    duration: state.motion.duration,
    fps: state.motion.fps,
    actorCount: state.items.filter((item) => item.type === "actor").length,
    propCount: state.items.filter((item) => item.type === "prop").length,
    keyframeCount: state.motion.keyframes.length,
    quality: {
      score: quality.score,
      readiness: quality.readiness,
      framingReviewCount: quality.framing.reviewCount,
    },
    exports: ["Seedance prompt", "Blender previs", "Top-down blocking", "Camera storyboard"],
    storyboardFrames: storyboard.map((frame) => ({
      time: frame.time,
      path: frame.path,
      label: frame.label,
    })),
    files: [
      "project/frisframe.json",
      "project/camera_plan.json",
      "project/motion_keyframes.csv",
      "project/framing_analysis.json",
      "docs/shot_bible.md",
      "docs/live_action_brief.md",
      "docs/ai_generation_brief.md",
      "docs/on_set_checklist.md",
      "docs/framing_analysis.md",
      "docs/camera_storyboard.md",
      "docs/seedance_prompt.md",
      "docs/quality_report.json",
      "blender/blender_previs_scene.py",
      "media/topdown_blocking.png",
      "media/camera_frame_current.png",
      "storyboard/contact_sheet.png",
      ...storyboard.map((frame) => frame.path),
    ],
  };
}

function buildCameraPlan() {
  const cam = state.camera;
  return {
    lensMm: cam.focal,
    horizontalFovDeg: Math.round(focalToFov(cam.focal)),
    headingDeg: cameraHeadingDeg(cam),
    aspect: state.aspect,
    duration: state.motion.duration,
    fps: state.motion.fps,
    position: { x: round(cam.x), y: round(cam.y), heightM: round(cam.height, 2), label: `(${pct(cam.x)}, ${pct(cam.y)}, ${round(cam.height, 2)}m)` },
    orientation: { panDeg: round(cam.panDeg, 1), tiltDeg: round(cam.tiltDeg, 1) },
    cameraKeyframes: keysForSource("camera").map((keyframe) => ({
      time: keyframe.time,
      transition: normalizeTransition(keyframe.transition),
      pose: sanitizeCameraPose(keyframe.pose),
      headingDeg: cameraHeadingDeg(sanitizeCameraPose(keyframe.pose)),
    })),
  };
}

function buildShotBibleMarkdown(quality) {
  const actors = state.items.filter((item) => item.type === "actor");
  const props = state.items.filter((item) => item.type === "prop");
  return [
    `# ${state.sceneTitle || "Untitled blocking"}`,
    "",
    `Readiness: ${quality.score}/100 · ${quality.readiness}`,
    "",
    "## Intent",
    state.sceneIntent || "No intent written.",
    "",
    "## Camera",
    cameraMarkdown(),
    "",
    "## Framing Analysis",
    framingSummaryMarkdown(quality.framing),
    "",
    "## Actors",
    ...(actors.length ? actors.map((item) => `- @${item.name}: ${positionText(item)}, facing ${Math.round(item.facing)}°.`) : ["- No actor marks yet."]),
    "",
    "## Props / Spatial Anchors",
    ...(props.length ? props.map((item) => `- @${item.name}: ${positionText(item)}, facing ${Math.round(item.facing)}°.`) : ["- No prop anchors."]),
    "",
    "## Timeline Beats",
    buildBeatTableMarkdown(),
    "",
    "## Quality Notes",
    ...quality.checks.map((check) => `- ${check.ok ? "OK" : "Review"}: ${check.label}`),
    "",
  ].join("\n");
}

function buildLiveActionBrief(quality) {
  return [
    `# Live Action Brief · ${state.sceneTitle || "Untitled blocking"}`,
    "",
    `Readiness: ${quality.score}/100 · ${quality.readiness}`,
    "",
    "## Floor Marks",
    ...state.items.map((item) => `- @${item.name}: tape mark at ${pct(item.x)} across / ${pct(item.y)} depth, facing ${Math.round(item.facing)}°.`),
    `- Camera: mark at ${pct(state.camera.x)} across / ${pct(state.camera.y)} depth.`,
    `- Focus: anchor at ${pct(state.camera.aimX)} across / ${pct(state.camera.aimY)} depth.`,
    "",
    "## Camera Setup",
    cameraMarkdown(),
    "",
    "## Framing Review",
    framingSummaryMarkdown(quality.framing),
    "",
    "## Rehearsal Beats",
    buildBeatTableMarkdown(),
    "",
    "## On-Set Checks",
    "- Confirm the practical lens against the preview frame before rolling.",
    "- Mark the camera position and rehearse the planned pan, tilt, and tracking move.",
    "- Keep the relative spacing from the top-down map; scale the whole setup to the real location.",
    "- Shoot one clean rehearsal pass before performance variations.",
    "",
  ].join("\n");
}

function buildAiGenerationBrief(quality) {
  return [
    `# AI Generation Brief · ${state.sceneTitle || "Untitled blocking"}`,
    "",
    `Readiness: ${quality.score}/100 · ${quality.readiness}`,
    "",
    "## Primary Instruction",
    "Use the included top-down blocking map and camera-frame storyboard as composition guides, not as visual style guides.",
    "Generate cinematic live-action footage with realistic scale, lighting, people, props, lens behavior, and camera timing.",
    "",
    "## Preserve",
    "- Camera position, lens feel, pan, tilt, and field-of-view relationship.",
    "- Actor spacing, facing, entrance/exit direction, and keyframe timing.",
    "- Prop and spatial anchor relationships.",
    "- The intended screen composition shown in camera-frame storyboard stills.",
    "- Any framing warnings listed in `docs/framing_analysis.md`.",
    "",
    "## Replace / Do Not Copy",
    "- Do not copy grid lines, colored circles, labels, UI, top-down diagram style, or simple geometric shapes.",
    "- Replace diagram actors with realistic performers or the intended character design.",
    "- Replace prop symbols with believable production design.",
    "",
    "## Seedance Prompt",
    buildSeedancePrompt(),
    "",
  ].join("\n");
}

function buildOnSetChecklist(quality) {
  return [
    `# On-Set Checklist · ${state.sceneTitle || "Untitled blocking"}`,
    "",
    `Readiness: ${quality.score}/100 · ${quality.readiness}`,
    "",
    "## Before Blocking",
    "- Scale the top-down map to the real location and mark camera, focus, actors, and props.",
    "- Confirm the intended lens or closest practical lens against `media/camera_frame_current.png`.",
    "- Review `docs/camera_storyboard.md` with DP, director, actors, and focus puller.",
    "",
    "## Before Rolling",
    "- Rehearse every timeline beat once at camera speed.",
    "- Confirm actors hit the same relative spacing shown in the storyboard.",
    "- Confirm pan, tilt, tracking, and camera-move timing.",
    "- Check that no important subject leaves the intended camera frame.",
    "",
    "## AI Input Capture",
    "- Record one clean wide rehearsal pass of the blocking.",
    "- Record one camera-frame match pass if using this as Seedance or AI video input.",
    "- Keep timing close to the exported duration and keyframe beats.",
    "",
    "## Review Flags",
    ...quality.checks.filter((check) => !check.ok).map((check) => `- ${check.label}`),
    ...quality.framing.notes.map((note) => `- ${note}`),
    ...(quality.checks.every((check) => check.ok) ? ["- No readiness flags."] : []),
    "",
  ].join("\n");
}

function buildCameraStoryboardMarkdown(storyboard) {
  return [
    `# Camera Storyboard · ${state.sceneTitle || "Untitled blocking"}`,
    "",
    "These stills are rendered from the current 3D camera frame preview.",
    "Use them to confirm what the planned camera angle actually sees before AI generation or live-action shooting.",
    "",
    "![Storyboard contact sheet](../storyboard/contact_sheet.png)",
    "",
    "| Time | Frame | Notes |",
    "| ---: | --- | --- |",
    ...storyboard.map((frame) => `| ${frame.time.toFixed(1)}s | ![](${frame.relativePath}) | ${escapeMarkdown(frame.summary)} |`),
    "",
  ].join("\n");
}

function buildFramingAnalysisMarkdown(framing = analyzeFraming()) {
  const rows = framing.samples.flatMap((sample) =>
    sample.subjects.map((subject) => ({
      time: sample.time,
      subject,
    })),
  );
  return [
    `# Framing Analysis · ${state.sceneTitle || "Untitled blocking"}`,
    "",
    framingSummaryMarkdown(framing),
    "",
    "| Time | Source | Status | Screen X | Camera Angle | Distance |",
    "| ---: | --- | --- | ---: | ---: | ---: |",
    ...(rows.length
      ? rows.map(({ time, subject }) => `| ${time.toFixed(1)}s | ${escapeMarkdown(subject.name)} | ${framingStatusLabel(subject.status)} | ${subject.screenX} | ${subject.angleDeg}° | ${subject.distance} |`)
      : ["| - | No sampled subjects for this preview setup. | - | - | - | - |"]),
    "",
    "Use this before AI generation or on-set rehearsal to catch subjects that drift outside the planned camera frame.",
    "",
  ].join("\n");
}

function framingSummaryMarkdown(framing) {
  if (!framing || !framing.samples?.length) return "- No framing samples.";
  const lines = [
    `- Samples checked: ${framing.sampleTimes.map((time) => `${time.toFixed(1)}s`).join(", ")}.`,
    `- Review beats: ${framing.reviewCount}. Outside: ${framing.outsideCount}. Edge: ${framing.edgeCount}.`,
  ];
  if (framing.notes.length) lines.push(...framing.notes.map((note) => `- ${note}.`));
  else lines.push("- All sampled subjects sit inside the planned camera frame.");
  return lines.join("\n");
}

function selectedLayerMarkdown() {
  return state.previs.selectedLayers.map((key) => `- ${controlLayers[key] || key}`).join("\n") || "- No control layers selected.";
}

function selectedPresetMarkdown() {
  return state.previs.exportPresets.map((key) => `- ${exportPresets[key] || key}`).join("\n") || "- No export presets selected.";
}

function cameraMarkdown() {
  const cam = state.camera;
  return [
    `- Lens: ${cam.focal}mm / ${Math.round(focalToFov(cam.focal))}° horizontal FOV.`,
    `- Camera mark: (${pct(cam.x)}, ${pct(cam.y)}), ${round(cam.height, 2)}m high.`,
    `- Pan: ${round(cam.panDeg, 1)}° on the blocking map.`,
    `- Tilt: ${round(cam.tiltDeg, 1)}° vertically.`,
  ].join("\n");
}

function buildBeatTableMarkdown() {
  const keyframes = sortKeyframes(state.motion.keyframes);
  if (!keyframes.length) return "No keyframes.";
  return [
    "| Time | Source | Arrival | Beat |",
    "| ---: | --- | --- | --- |",
    ...keyframes.map((keyframe) => `| ${keyframe.time.toFixed(1)}s | ${escapeMarkdown(sourceLabel(keyframe.source))} | ${escapeMarkdown(keyTransitionLabels[normalizeTransition(keyframe.transition)])} | ${escapeMarkdown(keyframeSummary(keyframe))} |`),
  ].join("\n");
}

function buildMotionCsv() {
  const rows = [["time", "transition", "source", "type", "x", "y", "height", "pan_deg", "tilt_deg", "focal", "facing", "size", "name", "asset_type", "scale_x", "scale_y", "scale_z", "mount_id", "seat_index"]];
  sortKeyframes(state.motion.keyframes).forEach((keyframe) => {
    if (keyframe.source === "camera") {
      const camera = sanitizeCameraPose(keyframe.pose);
      rows.push([
        keyframe.time,
        normalizeTransition(keyframe.transition),
        "Camera",
        "camera",
        camera.x,
        camera.y,
        camera.height,
        camera.panDeg,
        camera.tiltDeg,
        camera.focal,
        "",
        "",
        "Camera",
        "",
        "",
        "",
        "",
        "",
        "",
      ]);
      return;
    }
    const item = sanitizeSourcePose(keyframe.source, keyframe.pose);
    rows.push([keyframe.time, normalizeTransition(keyframe.transition), sourceLabel(keyframe.source), item.type, item.x, item.y, "", "", "", "", item.facing, item.size, item.name, item.assetType, item.scaleX, item.scaleY, item.scaleZ, item.mountId, item.seatIndex]);
  });
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

function buildBlenderPrevisScript() {
  const size = stageWorldSize(state);
  const lines = [
    "import bpy",
    "import math",
    "from mathutils import Vector",
    "",
    "bpy.ops.object.select_all(action='SELECT')",
    "bpy.ops.object.delete()",
    "",
    `scene = bpy.context.scene`,
    `scene.frame_start = 1`,
    `scene.frame_end = ${Math.max(1, Math.round(state.motion.duration * state.motion.fps))}`,
    `scene.render.fps = ${state.motion.fps}`,
    "",
    "def mat(name, color):",
    "    material = bpy.data.materials.new(name)",
    "    material.diffuse_color = color",
    "    return material",
    "",
    "def look_at(obj, target):",
    "    direction = Vector(target) - obj.location",
    "    obj.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()",
    "",
    "def set_interpolation(target, frame, mode):",
    "    animation = getattr(target, 'animation_data', None)",
    "    action = animation.action if animation else None",
    "    if not action:",
    "        return",
    "    for curve in action.fcurves:",
    "        for point in curve.keyframe_points:",
    "            if abs(point.co.x - frame) < 0.01:",
    "                point.interpolation = mode",
    "",
    "actor_mat = mat('actor_red', (1.0, 0.25, 0.25, 1.0))",
    "prop_mat = mat('prop_green', (0.25, 0.9, 0.35, 1.0))",
    "",
    `bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, 0))`,
    "stage = bpy.context.object",
    "stage.name = 'Stage floor'",
    `stage.dimensions = (${round(size.width)}, ${round(size.depth)}, 0)`,
    "stage.location = (0, 0, 0)",
    "",
    "objects = {}",
  ];

  state.items.forEach((item) => {
    const [x, y] = blenderXY(item);
    const safeName = pyString(`@${item.name}`);
    if (item.type === "actor") {
      lines.push(`bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=${round(0.28 * item.size)}, depth=${round(1.35 * item.size)}, location=(${x}, ${y}, ${round(0.675 * item.size)}))`);
      lines.push(`obj = bpy.context.object`);
      lines.push(`obj.name = ${safeName}`);
      lines.push("obj.data.materials.append(actor_mat)");
    } else if (item.shape === "triangle") {
      lines.push(`bpy.ops.mesh.primitive_cone_add(vertices=3, radius1=${round(0.46 * item.size)}, depth=${round(0.7 * item.size)}, location=(${x}, ${y}, ${round(0.35 * item.size)}))`);
      lines.push(`obj = bpy.context.object`);
      lines.push(`obj.name = ${safeName}`);
      lines.push("obj.data.materials.append(prop_mat)");
    } else {
      lines.push(`bpy.ops.mesh.primitive_cube_add(size=1, location=(${x}, ${y}, ${round(0.18 * item.size)}))`);
      lines.push(`obj = bpy.context.object`);
      lines.push(`obj.name = ${safeName}`);
      lines.push(`obj.dimensions = (${round(0.72 * item.size)}, ${round(0.72 * item.size)}, ${round(0.36 * item.size)})`);
      lines.push("obj.data.materials.append(prop_mat)");
    }
    lines.push(`obj.rotation_euler[2] = math.radians(${round(90 - item.facing)})`);
    lines.push(`objects[${pyString(item.id)}] = obj`);
    lines.push("");
  });

  const [targetX, targetY] = blenderXY({ x: state.camera.aimX, y: state.camera.aimY });
  const [camX, camY] = blenderXY(state.camera);
  lines.push(`bpy.ops.object.camera_add(location=(${camX}, ${camY}, ${round(state.camera.height)}))`);
  lines.push("cam = bpy.context.object");
  lines.push("bpy.context.scene.camera = cam");
  lines.push(`cam.data.lens = ${state.camera.focal}`);
  lines.push(`look_at(cam, (${targetX}, ${targetY}, ${round(state.camera.focusHeight)}))`);
  lines.push("");

  const previousBlenderFrames = new Map();
  sortKeyframes(state.motion.keyframes).forEach((keyframe) => {
    const frame = Math.max(1, Math.round(keyframe.time * state.motion.fps) + 1);
    const interpolation = blenderInterpolation(keyframe.transition);
    const previousFrame = previousBlenderFrames.get(keyframe.source);
    if (keyframe.source === "camera") {
      const camera = sanitizeCameraPose(keyframe.pose);
      const [x, y] = blenderXY(camera);
      const [ax, ay] = blenderXY({ x: camera.aimX, y: camera.aimY });
      lines.push(`cam.location = (${x}, ${y}, ${round(camera.height)})`);
      lines.push(`look_at(cam, (${ax}, ${ay}, ${round(camera.focusHeight)}))`);
      lines.push(`cam.data.lens = ${camera.focal}`);
      lines.push(`cam.keyframe_insert(data_path='location', frame=${frame})`);
      lines.push(`cam.keyframe_insert(data_path='rotation_euler', frame=${frame})`);
      lines.push(`cam.data.keyframe_insert(data_path='lens', frame=${frame})`);
      if (previousFrame != null) {
        lines.push(`set_interpolation(cam, ${previousFrame}, '${interpolation}')`);
        lines.push(`set_interpolation(cam.data, ${previousFrame}, '${interpolation}')`);
      }
    } else {
      const item = sanitizeSourcePose(keyframe.source, keyframe.pose);
      const [x, y] = blenderXY(item);
      lines.push(`obj = objects.get(${pyString(keyframe.source)})`);
      lines.push("if obj:");
      lines.push(`    obj.location.x = ${x}`);
      lines.push(`    obj.location.y = ${y}`);
      lines.push(`    obj.rotation_euler[2] = math.radians(${round(90 - item.facing)})`);
      lines.push(`    obj.keyframe_insert(data_path='location', frame=${frame})`);
      lines.push(`    obj.keyframe_insert(data_path='rotation_euler', frame=${frame})`);
      if (previousFrame != null) lines.push(`    set_interpolation(obj, ${previousFrame}, '${interpolation}')`);
    }
    previousBlenderFrames.set(keyframe.source, frame);
  });

  lines.push("");
  lines.push("# Import this script in Blender, then press Play on the timeline.");
  return lines.join("\n");
}

function blenderInterpolation(transition) {
  const mode = normalizeTransition(transition);
  if (mode === "cut" || mode === "hold") return "CONSTANT";
  if (mode === "linear") return "LINEAR";
  return "BEZIER";
}

async function captureCameraFrameBlob(renderState = state) {
  if (!window.THREE || !initThreeView()) throw new Error("3D 카메라 프레임을 준비하지 못했습니다.");
  let blob = null;
  await withCameraFrameCapture(async () => {
    renderThreeView(renderState, true, { guide: false });
    await nextFrame();
    blob = await canvasToBlob(threeView.frameCanvas, "image/png");
  });
  if (!blob) throw new Error("3D 카메라 프레임을 렌더링하지 못했습니다.");
  return blob;
}

async function captureStoryboardFrames() {
  if (!window.THREE) return [];
  const times = storyboardTimes();
  const frames = [];
  await withCameraFrameCapture(async () => {
    for (let index = 0; index < times.length; index += 1) {
      const time = times[index];
      const renderState = interpolateStateAtTime(time);
      renderThreeView(renderState, true, { guide: false });
      await nextFrame();
      const safeTime = String(Math.round(time * 10)).padStart(4, "0");
      const path = `storyboard/frame_${String(index + 1).padStart(2, "0")}_${safeTime}.png`;
      frames.push({
        time,
        path,
        relativePath: `../${path}`,
        label: `${time.toFixed(1)}s`,
        summary: storyboardFrameSummary(renderState, time),
        blob: await canvasToBlob(threeView.frameCanvas, "image/png"),
      });
    }
  });
  return frames;
}

async function withCameraFrameCapture(callback) {
  const wrap = $("#threeWrap");
  if (!wrap) return;
  const previousHidden = wrap.hidden;
  const previousOpacity = wrap.style.opacity;
  const previousPointerEvents = wrap.style.pointerEvents;
  wrap.hidden = false;
  wrap.style.opacity = "0";
  wrap.style.pointerEvents = "none";
  await nextFrame();
  if (!initThreeView()) {
    wrap.hidden = previousHidden;
    wrap.style.opacity = previousOpacity;
    wrap.style.pointerEvents = previousPointerEvents;
    return;
  }
  resizeThreeView();
  try {
    await callback();
  } finally {
    if (threeView?.ready) renderThreeView(state, true);
    wrap.hidden = previousHidden;
    wrap.style.opacity = previousOpacity;
    wrap.style.pointerEvents = previousPointerEvents;
    if (viewMode !== "3d") draw();
  }
}

function storyboardTimes() {
  const times = new Set([0, state.motion.duration]);
  sortKeyframes(state.motion.keyframes).forEach((keyframe) => times.add(Number(keyframe.time.toFixed(2))));
  return [...times]
    .filter((time) => Number.isFinite(time))
    .map((time) => clamp(time, 0, state.motion.duration))
    .sort((a, b) => a - b)
    .filter((time, index, list) => index === 0 || Math.abs(time - list[index - 1]) > 0.05)
    .slice(0, 12);
}

function storyboardFrameSummary(renderState, time) {
  const actors = renderState.items
    .filter((item) => item.type === "actor")
    .map((item) => `@${item.name} ${positionText(item)}`)
    .join("; ");
  return `${renderState.camera.focal}mm, H ${Number(renderState.camera.height ?? 1.6).toFixed(1)}m, focus ${pct(renderState.camera.aimX)}/${pct(renderState.camera.aimY)} at ${Number(renderState.camera.focusHeight ?? 1.1).toFixed(1)}m, beat ${time.toFixed(1)}s${actors ? `, ${actors}` : ""}`;
}

async function renderStoryboardContactSheet(storyboard) {
  if (!storyboard.length) return renderTopdownPngBlob();
  const columns = storyboard.length === 1 ? 1 : 2;
  const tileW = 600;
  const tileH = Math.round(tileW / (aspectMap[state.aspect] || 16 / 9));
  const labelH = 54;
  const gap = 26;
  const margin = 34;
  const rows = Math.ceil(storyboard.length / columns);
  const sheet = document.createElement("canvas");
  sheet.width = margin * 2 + columns * tileW + (columns - 1) * gap;
  sheet.height = margin * 2 + rows * (tileH + labelH) + (rows - 1) * gap;
  const context = sheet.getContext("2d");
  context.fillStyle = "#0b0e12";
  context.fillRect(0, 0, sheet.width, sheet.height);
  context.fillStyle = "#f2f5ef";
  context.font = "700 24px system-ui, sans-serif";
  context.fillText(state.sceneTitle || "Untitled blocking", margin, 24);
  for (let index = 0; index < storyboard.length; index += 1) {
    const frame = storyboard[index];
    const col = index % columns;
    const row = Math.floor(index / columns);
    const x = margin + col * (tileW + gap);
    const y = margin + row * (tileH + labelH + gap);
    const image = await imageFromBlob(frame.blob);
    context.drawImage(image, x, y, tileW, tileH);
    context.strokeStyle = "#3b4b55";
    context.lineWidth = 2;
    context.strokeRect(x, y, tileW, tileH);
    context.fillStyle = "#ff6b55";
    context.font = "800 18px ui-monospace, monospace";
    context.fillText(frame.label, x, y + tileH + 24);
    context.fillStyle = "#b9c4be";
    context.font = "13px system-ui, sans-serif";
    wrapCanvasText(context, frame.summary, x + 72, y + tileH + 24, tileW - 72, 17, 2);
  }
  return canvasToBlob(sheet, "image/png");
}

function imageFromBlob(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not build storyboard contact sheet."));
    };
    image.src = url;
  });
}

function wrapCanvasText(context, text, x, y, maxWidth, lineHeight, maxLines = 2) {
  const words = String(text || "").split(/\s+/);
  let line = "";
  let lines = 0;
  words.forEach((word) => {
    const test = line ? `${line} ${word}` : word;
    if (context.measureText(test).width > maxWidth && line) {
      if (lines < maxLines) context.fillText(line, x, y + lines * lineHeight);
      lines += 1;
      line = word;
    } else {
      line = test;
    }
  });
  if (line && lines < maxLines) context.fillText(line, x, y + lines * lineHeight);
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

async function renderTopdownPngBlob() {
  const size = exportSize();
  const offscreen = document.createElement("canvas");
  offscreen.width = size.width;
  offscreen.height = size.height;
  renderToCanvas(offscreen, state, { clean: true });
  return canvasToBlob(offscreen, "image/png");
}

async function exportBlockingPlanImage() {
  if (!beginMediaExport()) return;
  const exportDocument = clone(state);
  const time = clamp(Number(displayPlayhead() || 0), 0, exportDocument.motion.duration);
  const exportState = interpolateRenderStateAtTime(exportDocument, time);
  exportState.showGrid = true;
  exportState.showCamera = true;
  exportState.showNames = true;
  exportState.cleanExport = false;
  exportState.planReferenceExport = true;
  exportState.motion.selectedKeyId = "";
  const size = exportSize(exportState);
  const offscreen = document.createElement("canvas");
  offscreen.width = size.width;
  offscreen.height = size.height;
  const previousSelection = selected;
  const previousSnapGuide = pathSnapGuide;
  try {
    selected = null;
    pathSnapGuide = null;
    renderToCanvas(offscreen, exportState, { clean: true });
    const blob = await canvasToBlob(offscreen, "image/png");
    presentExport(
      blob,
      `${slug(exportState.sceneTitle)}_blocking_plan_${formatFrameTime(time)}.png`,
      "2D 블로킹 가이드 PNG",
      {
        type: "image",
        blob,
        caption: `@plan · ${time.toFixed(1)}초 배치 · 전체 동선과 키 포함`,
        notes: [
          "3D 가이드 영상과 함께 첨부하면 카메라와 피사체의 월드 공간 이동을 구분하는 데 도움이 됩니다.",
          "최종 영상에는 평면도와 표식을 그리지 않고, 배치와 이동 의미만 적용하도록 사용합니다.",
        ],
      },
    );
  } catch (error) {
    presentExportError(error?.message || "2D 블로킹 이미지를 준비하지 못했습니다.");
  } finally {
    selected = previousSelection;
    pathSnapGuide = previousSnapGuide;
    endMediaExport();
    draw();
  }
}

async function renderCameraFrameBlobAtTime(time, documentState, size = exportSize(documentState)) {
  if (!initThreeView()) throw new Error("3D 카메라 프레임을 준비하지 못했습니다.");
  const renderState = interpolateRenderStateAtTime(
    documentState,
    clamp(Number(time || 0), 0, documentState.motion.duration),
  );
  renderThreeView(renderState, true, { ...size, guide: false });
  await nextFrame();
  const blob = await canvasToBlob(threeView.frameCanvas, "image/png");
  resizeThreeView();
  renderThreeView(interpolateStateAtTime(displayPlayhead()), true);
  return blob;
}

async function exportCurrentCameraFrame() {
  if (!beginMediaExport()) return;
  const exportState = clone(state);
  try {
    const time = clamp(Number(displayPlayhead() || 0), 0, exportState.motion.duration);
    const blob = await renderCameraFrameBlobAtTime(time, exportState);
    presentExport(blob, `${slug(exportState.sceneTitle)}_camera_${formatFrameTime(time)}.png`, "현재 카메라 프레임 PNG", {
      type: "image",
      blob,
      caption: `${time.toFixed(1)}초 카메라 프레임`,
    });
  } catch (error) {
    presentExportError(error?.message || error);
  } finally {
    endMediaExport();
  }
}

async function exportStartEndCameraFrames() {
  if (!beginMediaExport()) return;
  const exportState = clone(state);
  try {
    const startBlob = await renderCameraFrameBlobAtTime(0, exportState);
    const endBlob = await renderCameraFrameBlobAtTime(exportState.motion.duration, exportState);
    const zip = await createZip([
      { path: "start_frame.png", blob: startBlob },
      { path: "end_frame.png", blob: endBlob },
    ]);
    presentExport(zip, `${slug(exportState.sceneTitle)}_start_end_frames.zip`, "시작·끝 카메라 프레임 ZIP", {
      type: "images",
      items: [
        { blob: startBlob, caption: "시작 프레임 · 0.0초" },
        { blob: endBlob, caption: `끝 프레임 · ${exportState.motion.duration.toFixed(1)}초` },
      ],
    });
  } catch (error) {
    presentExportError(error?.message || error);
  } finally {
    endMediaExport();
  }
}

function contactSheetLayout(capacity) {
  if (capacity === 4) return { columns: 2, rows: 2 };
  if (capacity === 6) return { columns: 3, rows: 2 };
  return { columns: 4, rows: 3 };
}

function contactSheetFrameSize(renderState) {
  const ratio = aspectMap[renderState.aspect] || 16 / 9;
  if (ratio >= 1) return { width: 960, height: Math.round(960 / ratio) };
  return { width: Math.round(960 * ratio), height: 960 };
}

function ellipsizeCanvasText(context, value, maxWidth) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (context.measureText(text).width <= maxWidth) return text;
  let result = text;
  while (result.length > 1 && context.measureText(`${result}…`).width > maxWidth) result = result.slice(0, -1);
  return `${result}…`;
}

function drawImageContained(context, image, x, y, width, height) {
  const imageRatio = image.width / image.height;
  const boxRatio = width / height;
  let drawWidth = width;
  let drawHeight = height;
  if (imageRatio > boxRatio) drawHeight = width / imageRatio;
  else drawWidth = height * imageRatio;
  context.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
}

async function renderProjectContactSheetPage(entries, capacity, pageIndex, pageCount, scopeLabel) {
  const { columns, rows } = contactSheetLayout(capacity);
  const canvas = document.createElement("canvas");
  canvas.width = 2400;
  canvas.height = 1600;
  const context = canvas.getContext("2d");
  const margin = 60;
  const headerHeight = 128;
  const bottomMargin = 52;
  const gap = 24;
  const cellWidth = (canvas.width - margin * 2 - gap * (columns - 1)) / columns;
  const cellHeight = (canvas.height - headerHeight - bottomMargin - gap * (rows - 1)) / rows;

  context.fillStyle = "#0b0d10";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#f1f2ed";
  context.font = '800 34px "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
  context.fillText(project.title || "스토리보드", margin, 54);
  context.fillStyle = "#97a0a7";
  context.font = '600 18px "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
  context.fillText(`${scopeLabel} · ${capacity}컷 시트`, margin, 88);
  context.textAlign = "right";
  context.fillText(`${pageIndex + 1} / ${pageCount}`, canvas.width - margin, 54);
  context.textAlign = "left";
  context.strokeStyle = "#30363e";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(margin, 108);
  context.lineTo(canvas.width - margin, 108);
  context.stroke();

  for (let index = 0; index < entries.length; index += 1) {
    const { scene, cut } = entries[index];
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = margin + column * (cellWidth + gap);
    const y = headerHeight + row * (cellHeight + gap);
    const inset = 12;
    const textHeight = capacity === 12 ? 104 : 116;
    const frameHeight = cellHeight - textHeight;
    context.fillStyle = "#15191e";
    context.fillRect(x, y, cellWidth, cellHeight);
    context.strokeStyle = cut.id === activeCutId ? "#55c8bb" : "#38414a";
    context.lineWidth = cut.id === activeCutId ? 4 : 2;
    context.strokeRect(x, y, cellWidth, cellHeight);
    context.fillStyle = "#080a0d";
    context.fillRect(x + inset, y + inset, cellWidth - inset * 2, frameHeight - inset * 1.5);

    const frameBlob = await renderCameraFrameBlobAtTime(
      cut.thumbnailTime || 0,
      clone(cut.blocking),
      contactSheetFrameSize(cut.blocking),
    );
    const image = await imageFromBlob(frameBlob);
    drawImageContained(context, image, x + inset, y + inset, cellWidth - inset * 2, frameHeight - inset * 1.5);

    const textX = x + 15;
    let textY = y + frameHeight + 20;
    context.fillStyle = "#77d2c7";
    context.font = '800 16px ui-monospace, SFMono-Regular, Menlo, monospace';
    context.fillText(storyboardCutCode(scene, cut).replace(" · ", " / "), textX, textY);
    context.textAlign = "right";
    context.fillStyle = storyboardStatusColors[cut.status] || "#a4a7ae";
    context.font = '700 15px "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
    context.fillText(storyboardStatusLabels[cut.status] || "초안", x + cellWidth - 15, textY);
    context.textAlign = "left";

    textY += 26;
    context.fillStyle = "#f1f2ed";
    context.font = '800 21px "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
    context.fillText(ellipsizeCanvasText(context, cut.title || "제목 없는 컷", cellWidth - 30), textX, textY);
    textY += 24;
    context.fillStyle = "#9ba3aa";
    context.font = '600 15px "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
    const meta = `${cut.shotType} · ${cut.blocking.camera.focal}mm · ${cut.blocking.motion.duration}초`;
    context.fillText(ellipsizeCanvasText(context, meta, cellWidth - 30), textX, textY);
    textY += 22;
    context.fillStyle = "#bdc3c2";
    context.font = '500 14px "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
    const summary = cut.action || cut.dialogue || "액션·대사 없음";
    context.fillText(ellipsizeCanvasText(context, summary, cellWidth - 30), textX, Math.min(textY, y + cellHeight - 12));
  }
  return canvasToBlob(canvas, "image/png");
}

async function exportStoryboardContactSheets(capacity) {
  if (![4, 6, 12].includes(capacity)) return;
  const entries = storyboardEntriesForScope(true);
  if (!entries.length) {
    notifyApp("전체 시나리오에서 이 상태에 해당하는 컷이 없습니다.");
    return;
  }
  if (!beginMediaExport()) return;
  const scene = currentScene();
  const scopeLabel = storyboardScope === "project"
    ? `전체 시나리오 · ${project.scenes.length}개 씬`
    : `${storyboardCutCode(scene, scene.cuts[0]).split(" · ")[0]} · ${scene.heading}`;
  const pageCount = Math.ceil(entries.length / capacity);
  const pages = [];
  try {
    notifyApp(`${entries.length}개 컷으로 ${capacity}컷 시트를 준비 중입니다.`);
    for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
      mediaExportProgress = `시트 ${pageIndex + 1}/${pageCount}`;
      renderMediaExportBusy();
      const pageEntries = entries.slice(pageIndex * capacity, (pageIndex + 1) * capacity);
      const blob = await renderProjectContactSheetPage(pageEntries, capacity, pageIndex, pageCount, scopeLabel);
      pages.push({
        blob,
        path: `storyboard_sheet_${String(pageIndex + 1).padStart(2, "0")}.png`,
        caption: `${scopeLabel} · ${capacity}컷 시트 · ${pageIndex + 1}/${pageCount}`,
      });
    }
    const scopeSlug = storyboardScope === "project" ? "all-scenes" : `scene-${String(scene.number).padStart(2, "0")}`;
    const baseName = `${slug(project.title)}_${scopeSlug}_${capacity}-cut-storyboard`;
    if (pages.length === 1) {
      presentExport(pages[0].blob, `${baseName}.png`, `${capacity}컷 스토리보드 PNG`, {
        type: "image",
        blob: pages[0].blob,
        caption: pages[0].caption,
      });
    } else {
      const zip = await createZip(pages.map((page) => ({ path: page.path, blob: page.blob })));
      presentExport(zip, `${baseName}.zip`, `${capacity}컷 스토리보드 PNG ${pages.length}장`, {
        type: "images",
        items: pages.map((page) => ({ blob: page.blob, caption: page.caption })),
      });
    }
    notifyApp(`${capacity}컷 스토리보드 시트 ${pages.length}장을 준비했습니다.`);
  } catch (error) {
    presentExportError(error?.message || error);
  } finally {
    mediaExportProgress = "";
    endMediaExport();
  }
}

function formatFrameTime(time) {
  return `${Number(time || 0).toFixed(2).replace(".", "-")}s`;
}

function managedProjectDocument() {
  syncActiveCutDocument(false);
  return {
    app: SERVICE_NAME,
    schemaVersion: PROJECT_SCHEMA_VERSION,
    savedAt: isoNow(),
    project: clone(project),
  };
}

function managedProjectRecoveryKey(projectId = managedProjectId) {
  return projectId ? `${PROJECT_RECOVERY_KEY_PREFIX}${projectId}` : "";
}

function cancelManagedProjectRecovery() {
  if (managedRecoveryTimer) clearTimeout(managedRecoveryTimer);
  managedRecoveryTimer = null;
}

function scheduleManagedProjectRecovery() {
  if (managedRecoveryTimer || !managedProjectId || suppressManagedAutosave) return;
  managedRecoveryTimer = setTimeout(() => {
    managedRecoveryTimer = null;
    writeManagedProjectRecoveryNow();
  }, 350);
}

function writeManagedProjectRecoveryNow() {
  cancelManagedProjectRecovery();
  if (!managedProjectId || !project || suppressManagedAutosave) return false;
  try {
    const documentPayload = managedProjectDocument();
    const record = createRecoveryRecord({
      projectId: managedProjectId,
      revision: managedProjectRevision,
      document: documentPayload,
    });
    window.localStorage.setItem(managedProjectRecoveryKey(), JSON.stringify(record));
    managedRecoveryWarningShown = false;
    return true;
  } catch {
    if (!managedRecoveryWarningShown) {
      managedRecoveryWarningShown = true;
      notifyApp("브라우저 복구본을 남기지 못했습니다. 프로젝트 저장을 다시 확인하세요.");
    }
    return false;
  }
}

function readManagedProjectRecovery(projectId) {
  const key = managedProjectRecoveryKey(projectId);
  if (!key) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const record = parseRecoveryRecord(raw);
    if (!record) window.localStorage.removeItem(key);
    return record;
  } catch {
    return null;
  }
}

function clearManagedProjectRecovery(projectId = managedProjectId) {
  const key = managedProjectRecoveryKey(projectId);
  if (!key) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Recovery is optional when browser storage is unavailable.
  }
}

async function fetchWithTimeout(resource, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const upstreamSignal = options.signal;
  let timedOut = false;
  const abortFromUpstream = () => controller.abort(upstreamSignal.reason);
  if (upstreamSignal?.aborted) abortFromUpstream();
  else upstreamSignal?.addEventListener("abort", abortFromUpstream, { once: true });
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  try {
    return await fetch(resource, { ...options, signal: controller.signal });
  } catch (error) {
    if (!timedOut) throw error;
    const timeoutError = new Error("서버 응답 시간이 초과되었습니다. 연결을 확인한 뒤 다시 시도하세요.");
    timeoutError.name = "TimeoutError";
    throw timeoutError;
  } finally {
    clearTimeout(timeoutId);
    upstreamSignal?.removeEventListener("abort", abortFromUpstream);
  }
}

async function readApiError(response, fallback) {
  const payload = await response.json().catch(() => ({}));
  const error = new Error(payload.error || fallback);
  error.status = response.status;
  error.code = payload.code || "";
  error.payload = payload;
  return error;
}

function scheduleFirstTutorial() {
  if (!hasSeenTutorial()) setTimeout(() => startTutorial(0), 650);
}

function isProjectConnectionError(error) {
  return error?.name === "TimeoutError"
    || error instanceof TypeError
    || /failed to fetch|networkerror|network request failed/i.test(String(error?.message || error));
}

function projectConnectionHelp(error) {
  if (isProjectConnectionError(error)) {
    return `
      <strong>FrisFrame 프로젝트 서버에 연결할 수 없습니다.</strong>
      <span>Google AI Studio나 파일 미리보기가 아니라 로컬 FrisFrame 주소에서 작업해야 프로젝트를 저장할 수 있습니다.</span>
      <a class="primary-btn" href="${escapeHtml(window.location.origin)}/">로컬 FrisFrame 열기</a>`;
  }
  return `<strong>프로젝트 작업을 완료하지 못했습니다.</strong><span>${escapeHtml(error?.message || error)}</span>`;
}

async function resolveManagedProjectRecovery(payload) {
  const storage = payload?.storage || {};
  const serverDocument = payload?.document;
  const serverProject = projectFromPayload(serverDocument);
  const recovery = readManagedProjectRecovery(storage.id);
  const recoveryState = classifyRecovery(recovery, {
    projectId: storage.id,
    revision: storage.revision,
    document: serverDocument,
  });
  if (recoveryState === "none") return { project: serverProject, storage, recovered: false };
  if (recoveryState === "same") {
    clearManagedProjectRecovery(storage.id);
    return { project: serverProject, storage, recovered: false };
  }
  if (recoveryState === "restore") {
    const restore = confirm("저장 완료 전에 닫힌 편집 내용이 있습니다. 마지막 복구본을 이어서 열까요?");
    if (restore) {
      return { project: projectFromPayload(recovery.document), storage, recovered: true };
    }
    clearManagedProjectRecovery(storage.id);
    return { project: serverProject, storage, recovered: false };
  }

  const preserve = confirm("서버 저장본과 별도로 남은 편집 복구본이 있습니다. 덮어쓰지 않고 새 프로젝트 사본으로 보존할까요?");
  if (!preserve) {
    clearManagedProjectRecovery(storage.id);
    return { project: serverProject, storage, recovered: false };
  }
  const recoveryDocument = clone(recovery.document);
  recoveryDocument.project.title = `${recoveryDocument.project.title || "프로젝트"} (복구본)`;
  recoveryDocument.savedAt = isoNow();
  const response = await fetchWithTimeout("/api/projects/store", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ document: recoveryDocument }),
  });
  if (!response.ok) throw await readApiError(response, "복구 사본을 보존하지 못했습니다.");
  const result = await response.json();
  clearManagedProjectRecovery(storage.id);
  return {
    project: projectFromPayload(recoveryDocument),
    storage: {
      id: result.id,
      revision: Number(result.revision || 1),
      updatedAt: result.updatedAt || recoveryDocument.savedAt,
    },
    recovered: false,
    preservedCopy: true,
  };
}

async function createManagedProject() {
  const title = $("#projectCreateInput").value.trim();
  if (!title) {
    notifyApp("프로젝트 제목을 입력하세요.");
    $("#projectCreateInput").focus();
    return false;
  }
  const nextProject = pendingProjectCreationMode === "current"
    ? (() => {
      syncActiveCutDocument(false);
      return clone(project);
    })()
    : createDefaultProject(defaultState());
  const now = isoNow();
  nextProject.title = title;
  nextProject.updatedAt = now;
  if (pendingProjectCreationMode === "blank") nextProject.createdAt = now;
  const documentPayload = {
    app: SERVICE_NAME,
    schemaVersion: PROJECT_SCHEMA_VERSION,
    savedAt: now,
    project: clone(nextProject),
  };
  const button = $("#projectCreateSaveBtn");
  const originalHtml = button.innerHTML;
  button.disabled = true;
  button.innerHTML = "<span>만드는 중...</span>";
  try {
    const response = await fetchWithTimeout("/api/projects/store", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ document: documentPayload }),
    });
    if (!response.ok) throw await readApiError(response, "프로젝트를 만들지 못했습니다.");
    const result = await response.json();
    suppressManagedAutosave = true;
    clearManagedProjectBinding();
    loadProjectDocument(nextProject);
    managedProjectId = result.id;
    managedProjectRevision = Number(result.revision || 1);
    managedProjectUpdatedAt = result.updatedAt || now;
    rememberManagedProject(managedProjectId);
    clearManagedProjectRecovery(managedProjectId);
    setProjectSaveStatus("saved");
    suppressManagedAutosave = false;
    setWorkspaceMode("blocking");
    $("#projectCreateDialog").close();
    if ($("#projectLibraryDialog").open) $("#projectLibraryDialog").close();
    notifyApp(`‘${title}’ 프로젝트를 만들었습니다.`);
    scheduleFirstTutorial();
    return true;
  } catch (error) {
    suppressManagedAutosave = false;
    const errorBox = $("#projectCreateError");
    errorBox.innerHTML = projectConnectionHelp(error);
    errorBox.hidden = false;
    return false;
  } finally {
    button.disabled = false;
    button.innerHTML = originalHtml;
    refreshLucideIcons();
  }
}

async function saveManagedProject({ interactive = false } = {}) {
  if (managedSaveInFlight) {
    if (interactive) notifyApp("현재 프로젝트를 저장하고 있습니다.");
    return false;
  }
  if (!managedProjectId) {
    if (interactive) openProjectCreateDialog({ mode: "current" });
    return false;
  }
  if (managedSaveConflict) {
    if (!interactive) return false;
    if (confirm("다른 창의 저장본과 충돌한 상태입니다. 현재 편집본을 새 프로젝트로 보존할까요?")) {
      clearManagedProjectBinding();
      setProjectSaveStatus("changed");
      openProjectCreateDialog({ mode: "current" });
    }
    return false;
  }
  const documentPayload = managedProjectDocument();
  const savedFingerprint = captureProjectSnapshot();
  let preserveAsCopy = false;
  managedSaveInFlight = true;
  setProjectSaveStatus("saving");
  try {
    const response = await fetchWithTimeout("/api/projects/store", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: managedProjectId || undefined,
        revision: managedProjectId ? managedProjectRevision : undefined,
        document: documentPayload,
      }),
    });
    if (!response.ok) throw await readApiError(response, "프로젝트를 저장하지 못했습니다.");
    const result = await response.json();
    managedProjectId = result.id;
    managedProjectRevision = Number(result.revision || 1);
    managedProjectUpdatedAt = result.updatedAt || isoNow();
    managedSaveConflict = false;
    rememberManagedProject(managedProjectId);
    const unchangedDuringSave = captureProjectSnapshot() === savedFingerprint;
    if (unchangedDuringSave) clearManagedProjectRecovery(managedProjectId);
    setProjectSaveStatus(unchangedDuringSave ? "saved" : "changed");
    notifyApp(interactive ? "프로젝트를 저장했습니다." : "변경 내용을 자동 저장했습니다.");
    return true;
  } catch (error) {
    if (error.status === 409 || error.code === "revision_conflict") {
      managedSaveConflict = true;
      setProjectSaveStatus("conflict");
      notifyApp("다른 창의 저장본과 충돌해 자동 저장을 멈췄습니다.");
      if (interactive) {
        preserveAsCopy = confirm("다른 창에서 이 프로젝트가 먼저 저장되었습니다. 현재 편집본을 새 프로젝트로 보존할까요?");
      }
    } else {
      setProjectSaveStatus("error");
      if (interactive) alert(`프로젝트를 저장하지 못했습니다. ${error.message}`);
      else notifyApp("자동 저장에 실패했습니다. 상단 저장 버튼으로 다시 시도하세요.");
    }
    return false;
  } finally {
    managedSaveInFlight = false;
    if (projectSaveStatus === "changed" && !managedSaveConflict) scheduleManagedAutosave();
    if (preserveAsCopy) {
      clearManagedProjectBinding();
      setProjectSaveStatus("changed");
      setTimeout(() => saveManagedProject({ interactive: true }), 0);
    }
  }
}

function formatProjectDate(value) {
  if (!value) return "기록 없음";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatProjectDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds || 0)));
  const minutes = Math.floor(total / 60);
  const remainder = total % 60;
  return minutes ? `${minutes}분 ${remainder}초` : `${remainder}초`;
}

function renderProjectVersions() {
  const root = $("#projectVersionsList");
  if (!projectVersionItems.length) {
    root.innerHTML = `
      <div class="project-version-empty">
        <i data-lucide="history" aria-hidden="true"></i>
        <strong>이전 저장본이 아직 없습니다</strong>
        <span>프로젝트를 두 번 이상 저장하면 이곳에 표시됩니다.</span>
      </div>`;
    refreshLucideIcons();
    return;
  }
  root.innerHTML = projectVersionItems.map((version) => `
    <article class="project-version-row">
      <div>
        <strong>${escapeHtml(version.title || project.title || "프로젝트")}</strong>
        <span>${escapeHtml(formatProjectDate(version.savedAt))} · 저장본 ${Number(version.revision)}</span>
      </div>
      <button type="button" class="text-btn" data-version-revision="${Number(version.revision)}">
        <i data-lucide="rotate-ccw" aria-hidden="true"></i><span>복원</span>
      </button>
    </article>`).join("");
  refreshLucideIcons();
}

async function openProjectVersions() {
  $("#projectMenu").open = false;
  if (!managedProjectId) {
    notifyApp("프로젝트를 먼저 저장하면 최근 저장본을 볼 수 있습니다.");
    return;
  }
  const dialog = $("#projectVersionsDialog");
  const root = $("#projectVersionsList");
  root.innerHTML = '<div class="project-version-loading">최근 저장본을 불러오는 중...</div>';
  if (!dialog.open) dialog.showModal();
  try {
    const response = await fetchWithTimeout(`/api/projects/versions?id=${encodeURIComponent(managedProjectId)}`);
    if (!response.ok) throw await readApiError(response, "최근 저장본을 불러오지 못했습니다.");
    const payload = await response.json();
    projectVersionItems = Array.isArray(payload.versions) ? payload.versions : [];
    renderProjectVersions();
  } catch (error) {
    root.innerHTML = `<div class="project-version-empty"><i data-lucide="cloud-off" aria-hidden="true"></i><strong>저장본을 불러오지 못했습니다</strong><span>${escapeHtml(error.message)}</span></div>`;
    refreshLucideIcons();
  }
}

async function restoreProjectVersion(versionRevision) {
  const version = projectVersionItems.find((entry) => Number(entry.revision) === Number(versionRevision));
  if (!version || !managedProjectId || managedSaveInFlight) return;
  const restore = confirm(`${formatProjectDate(version.savedAt)}의 저장본 ${version.revision}로 복원할까요?\n현재 저장본도 복구 이력에 남습니다.`);
  if (!restore) return;
  writeManagedProjectRecoveryNow();
  try {
    const response = await fetchWithTimeout("/api/projects/version/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: managedProjectId,
        revision: managedProjectRevision,
        versionRevision: version.revision,
      }),
    });
    if (!response.ok) throw await readApiError(response, "이전 저장본을 복원하지 못했습니다.");
    const payload = await response.json();
    suppressManagedAutosave = true;
    loadProjectDocument(projectFromPayload(payload.document));
    managedProjectRevision = Number(payload.storage.revision || managedProjectRevision + 1);
    managedProjectUpdatedAt = payload.storage.updatedAt || isoNow();
    clearManagedProjectRecovery(managedProjectId);
    setProjectSaveStatus("saved");
    suppressManagedAutosave = false;
    $("#projectVersionsDialog").close();
    notifyApp(`저장본 ${version.revision}을 복원했습니다.`);
  } catch (error) {
    suppressManagedAutosave = false;
    if (error.status === 409 || error.code === "revision_conflict") {
      managedSaveConflict = true;
      setProjectSaveStatus("conflict");
    }
    alert(`이전 저장본을 복원하지 못했습니다. ${error.message}`);
  }
}

function renderProjectLibrary() {
  const list = $("#projectLibraryList");
  if (!list) return;
  const query = $("#projectLibrarySearch").value.trim().toLocaleLowerCase("ko");
  const filtered = projectLibraryItems.filter((entry) => String(entry.title || "").toLocaleLowerCase("ko").includes(query));
  const trashMode = projectLibraryTab === "trash";
  $("#projectLibrarySummary").textContent = query
    ? `${filtered.length}개 검색됨 · ${trashMode ? "휴지통" : "내 프로젝트"}`
    : `${filtered.length}개 프로젝트 · ${trashMode ? "휴지통" : "최근 작업 순"}`;
  if (!filtered.length) {
    list.innerHTML = `
      <div class="project-library-empty">
        <i data-lucide="${query ? "search-x" : trashMode ? "trash-2" : "folder-plus"}" aria-hidden="true"></i>
        <strong>${query ? "검색 결과가 없습니다" : trashMode ? "휴지통이 비어 있습니다" : "저장된 프로젝트가 없습니다"}</strong>
        <p>${query ? "다른 프로젝트 이름으로 검색해 보세요." : trashMode ? "삭제한 프로젝트가 이곳에 표시됩니다." : "새 프로젝트를 만들면 이 목록에서 관리할 수 있습니다."}</p>
      </div>`;
    refreshLucideIcons();
    return;
  }
  list.innerHTML = filtered.map((entry) => {
    const current = entry.id === managedProjectId;
    const activeActions = `
      <button type="button" class="icon-btn" data-project-action="open" data-project-id="${entry.id}" title="열기" aria-label="${escapeHtml(entry.title)} 열기"><i data-lucide="folder-open"></i></button>
      <button type="button" class="icon-btn" data-project-action="rename" data-project-id="${entry.id}" title="이름 변경" aria-label="${escapeHtml(entry.title)} 이름 변경"><i data-lucide="pencil"></i></button>
      <button type="button" class="icon-btn" data-project-action="duplicate" data-project-id="${entry.id}" title="복제" aria-label="${escapeHtml(entry.title)} 복제"><i data-lucide="copy"></i></button>
      <button type="button" class="icon-btn danger" data-project-action="trash" data-project-id="${entry.id}" title="휴지통으로 이동" aria-label="${escapeHtml(entry.title)} 휴지통으로 이동"><i data-lucide="trash-2"></i></button>`;
    const trashActions = `
      <button type="button" class="icon-btn" data-project-action="restore" data-project-id="${entry.id}" title="복원" aria-label="${escapeHtml(entry.title)} 복원"><i data-lucide="rotate-ccw"></i></button>
      <button type="button" class="icon-btn danger" data-project-action="delete" data-project-id="${entry.id}" title="영구 삭제" aria-label="${escapeHtml(entry.title)} 영구 삭제"><i data-lucide="trash-2"></i></button>`;
    return `
      <article class="project-library-row${current ? " is-current" : ""}" data-project-row="${entry.id}">
        <div class="project-library-title">
          <strong>${escapeHtml(entry.title || "새 프로젝트")}${current ? '<span class="project-library-current">현재 열림</span>' : ""}</strong>
          <span>수정 ${escapeHtml(formatProjectDate(entry.updatedAt))}</span>
        </div>
        <div class="project-library-meta">
          <strong>${Number(entry.sceneCount || 0)}씬 · ${Number(entry.cutCount || 0)}컷</strong>
          <span>${escapeHtml(formatProjectDuration(entry.durationSeconds))}</span>
        </div>
        <div class="project-library-time">${trashMode ? `삭제 ${escapeHtml(formatProjectDate(entry.deletedAt))}` : `최근 열기 ${escapeHtml(formatProjectDate(entry.openedAt || entry.updatedAt))}`}</div>
        <div class="project-library-actions">${trashMode ? trashActions : activeActions}</div>
      </article>`;
  }).join("");
  refreshLucideIcons();
}

async function refreshProjectLibrary() {
  const summary = $("#projectLibrarySummary");
  summary.textContent = "프로젝트를 불러오는 중...";
  $("#projectLibraryList").innerHTML = "";
  try {
    const response = await fetchWithTimeout(`/api/projects?trash=${projectLibraryTab === "trash" ? "1" : "0"}`);
    if (!response.ok) throw await readApiError(response, "프로젝트 목록을 불러오지 못했습니다.");
    const payload = await response.json();
    projectLibraryItems = Array.isArray(payload.projects) ? payload.projects : [];
    renderProjectLibrary();
  } catch (error) {
    projectLibraryItems = [];
    summary.textContent = "프로젝트 목록을 불러오지 못했습니다.";
    $("#projectLibraryList").innerHTML = `<div class="project-library-empty"><i data-lucide="cloud-off"></i>${projectConnectionHelp(error)}</div>`;
    refreshLucideIcons();
  }
}

function setProjectLibraryRequired(required) {
  const dialog = $("#projectLibraryDialog");
  dialog.classList.toggle("is-required", Boolean(required));
  $("#projectLibraryLead").textContent = required
    ? "프로젝트를 새로 만들거나 기존 프로젝트를 열어야 작업을 시작할 수 있습니다."
    : "프로젝트를 선택하거나 새로 만들어 작업을 이어가세요.";
}

async function openProjectLibrary(required = !managedProjectId) {
  const dialog = $("#projectLibraryDialog");
  setProjectLibraryRequired(required);
  projectLibraryTab = "active";
  $("#projectLibrarySearch").value = "";
  $$("#projectLibraryTabs [data-project-library-tab]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.projectLibraryTab === projectLibraryTab);
  });
  if (!dialog.open) dialog.showModal();
  await refreshProjectLibrary();
}

async function postProjectAction(action, body) {
  const response = await fetchWithTimeout(`/api/projects/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw await readApiError(response, "프로젝트 작업을 완료하지 못했습니다.");
  return response.json();
}

async function openManagedProject(projectId) {
  if (projectId === managedProjectId) {
    $("#projectLibraryDialog").close();
    notifyApp("현재 열려 있는 프로젝트입니다.");
    return;
  }
  if ((managedProjectId || hasUnsavedProjectChanges()) && !confirmProjectReplacement("다른 프로젝트를 열면")) return;
  if (hasUnsavedProjectChanges()) writeManagedProjectRecoveryNow();
  try {
    const response = await fetchWithTimeout(`/api/projects/load?id=${encodeURIComponent(projectId)}`);
    if (!response.ok) throw await readApiError(response, "프로젝트를 열지 못했습니다.");
    const payload = await response.json();
    const resolved = await resolveManagedProjectRecovery(payload);
    suppressManagedAutosave = true;
    clearManagedProjectBinding();
    loadProjectDocument(resolved.project);
    managedProjectId = resolved.storage.id;
    managedProjectRevision = Number(resolved.storage.revision || 1);
    managedProjectUpdatedAt = resolved.storage.updatedAt || "";
    rememberManagedProject(managedProjectId);
    suppressManagedAutosave = false;
    setProjectSaveStatus(resolved.recovered ? "changed" : "saved");
    setWorkspaceMode("storyboard");
    $("#projectLibraryDialog").close();
    notifyApp(resolved.recovered ? "마지막 편집 복구본을 열었습니다." : resolved.preservedCopy ? "복구본을 새 프로젝트로 보존했습니다." : "프로젝트를 열었습니다.");
    scheduleFirstTutorial();
  } catch (error) {
    suppressManagedAutosave = false;
    alert(`프로젝트를 열지 못했습니다. ${error.message}`);
  }
}

async function resumeLastManagedProject() {
  let projectId = "";
  try {
    projectId = window.localStorage.getItem(LAST_MANAGED_PROJECT_KEY) || "";
  } catch {
    return false;
  }
  if (!projectId) return false;
  try {
    const response = await fetchWithTimeout(`/api/projects/load?id=${encodeURIComponent(projectId)}`);
    if (!response.ok) throw await readApiError(response, "최근 프로젝트를 열지 못했습니다.");
    const payload = await response.json();
    const resolved = await resolveManagedProjectRecovery(payload);
    suppressManagedAutosave = true;
    loadProjectDocument(resolved.project);
    managedProjectId = resolved.storage.id;
    managedProjectRevision = Number(resolved.storage.revision || 1);
    managedProjectUpdatedAt = resolved.storage.updatedAt || "";
    rememberManagedProject(managedProjectId);
    suppressManagedAutosave = false;
    setProjectSaveStatus(resolved.recovered ? "changed" : "saved");
    notifyApp(resolved.recovered ? "저장 전 마지막 편집을 복구했습니다." : resolved.preservedCopy ? "복구본을 새 프로젝트로 보존했습니다." : "최근 프로젝트를 이어서 열었습니다.");
    return true;
  } catch (error) {
    suppressManagedAutosave = false;
    notifyApp(`최근 프로젝트를 열지 못했습니다. ${error.message}`);
    return false;
  }
}

async function runProjectLibraryAction(action, projectId) {
  const entry = projectLibraryItems.find((item) => item.id === projectId);
  if (!entry) return;
  try {
    if (action === "open") {
      await openManagedProject(projectId);
      return;
    }
    if (action === "rename") {
      pendingProjectRenameId = projectId;
      $("#projectRenameInput").value = entry.title || "새 프로젝트";
      $("#projectRenameDialog").showModal();
      requestAnimationFrame(() => $("#projectRenameInput").select());
      return;
    } else if (action === "duplicate") {
      await postProjectAction("duplicate", { id: projectId });
      notifyApp("프로젝트 복사본을 만들었습니다.");
    } else if (action === "trash") {
      const suffix = projectId === managedProjectId && hasUnsavedProjectChanges() ? " 저장하지 않은 변경은 포함되지 않습니다." : "";
      if (!confirm(`‘${entry.title}’ 프로젝트를 휴지통으로 이동할까요?${suffix}`)) return;
      await postProjectAction("trash", { id: projectId });
      if (projectId === managedProjectId) {
        suppressManagedAutosave = true;
        clearManagedProjectBinding();
        loadProjectDocument(createDefaultProject(defaultState()));
        setProjectSaveStatus("changed");
        suppressManagedAutosave = false;
        setProjectLibraryRequired(true);
      }
      notifyApp("프로젝트를 휴지통으로 이동했습니다.");
    } else if (action === "restore") {
      await postProjectAction("restore", { id: projectId });
      notifyApp("프로젝트를 복원했습니다.");
    } else if (action === "delete") {
      if (!confirm(`‘${entry.title}’ 프로젝트를 영구 삭제할까요? 이 작업은 되돌릴 수 없습니다.`)) return;
      await postProjectAction("delete", { id: projectId });
      notifyApp("프로젝트를 영구 삭제했습니다.");
    }
    await refreshProjectLibrary();
  } catch (error) {
    alert(`프로젝트 작업을 완료하지 못했습니다. ${error.message}`);
  }
}

async function applyProjectRename() {
  const projectId = pendingProjectRenameId;
  const entry = projectLibraryItems.find((item) => item.id === projectId);
  const title = $("#projectRenameInput").value.trim();
  if (!projectId || !entry) return;
  if (!title) {
    notifyApp("프로젝트 이름을 입력하세요.");
    $("#projectRenameInput").focus();
    return;
  }
  if (title === entry.title) {
    $("#projectRenameDialog").close();
    return;
  }
  const button = $("#projectRenameSaveBtn");
  button.disabled = true;
  try {
    if (projectId === managedProjectId) {
      if (managedSaveInFlight) {
        notifyApp("현재 저장이 끝난 뒤 이름을 다시 변경해 주세요.");
        return;
      }
      project.title = title;
      project.updatedAt = isoNow();
      setProjectSaveStatus("changed");
      syncProjectChrome();
      const saved = await saveManagedProject({ interactive: true });
      if (!saved) return;
    } else {
      await postProjectAction("rename", { id: projectId, title, revision: entry.revision });
    }
    $("#projectRenameDialog").close();
    pendingProjectRenameId = "";
    notifyApp("프로젝트 이름을 변경했습니다.");
    await refreshProjectLibrary();
  } catch (error) {
    alert(`프로젝트 이름을 변경하지 못했습니다. ${error.message}`);
  } finally {
    button.disabled = false;
  }
}

function exportJson() {
  syncActiveCutDocument(false);
  const payload = {
    app: SERVICE_NAME,
    schemaVersion: PROJECT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    project: clone(project),
  };
  const text = JSON.stringify(payload, null, 2);
  const blob = new Blob([text], { type: "application/json" });
  presentExport(blob, `${slug(project.title)}_storyboard_project.json`, "스토리보드 프로젝트 JSON", { type: "text", text });
  notifyApp("JSON 백업 프리뷰를 준비했습니다.");
}

async function importJson(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const payload = JSON.parse(text);
    const nextProject = projectFromPayload(payload);
    if (!confirmProjectReplacement("프로젝트를 불러오면")) return;
    suppressManagedAutosave = true;
    clearManagedProjectBinding();
    loadProjectDocument(nextProject);
    setProjectSaveStatus("changed");
    suppressManagedAutosave = false;
    notifyApp("JSON 백업을 불러왔습니다. 프로젝트로 저장할 수 있습니다.");
    setWorkspaceMode("storyboard");
  } catch (error) {
    suppressManagedAutosave = false;
    alert(`프로젝트를 불러오지 못했습니다. ${error?.message || error}`);
  } finally {
    event.target.value = "";
  }
}

async function shareProject() {
  syncActiveCutDocument(false);
  const payload = {
    app: SERVICE_NAME,
    schemaVersion: PROJECT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    project: clone(project),
  };
  const shareBtn = $("#shareBtn");
  const originalHtml = shareBtn.innerHTML;
  shareBtn.disabled = true;
  shareBtn.innerHTML = `<span>공유 중...</span>`;
  try {
    const response = await fetchWithTimeout("/api/project/save", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const errorText = await response.json().then(d => d.error).catch(() => "오류가 발생했습니다.");
      throw new Error(errorText);
    }
    const result = await response.json();
    const shareToken = encodeURIComponent(result.shareToken || "");
    const shareUrl = `${window.location.origin}${window.location.pathname}?project=${result.id}${shareToken ? `#share=${shareToken}` : ""}`;
    const shareDialog = $("#shareDialog");
    const shareLinkInput = $("#shareLinkInput");
    shareLinkInput.value = shareUrl;
    shareDialog.showModal();
    notifyApp("공유 링크가 준비되었습니다.");
  } catch (error) {
    alert(`공유 링크를 생성하지 못했습니다: ${error.message}`);
  } finally {
    shareBtn.disabled = false;
    shareBtn.innerHTML = originalHtml;
    refreshLucideIcons();
  }
}

async function copyShareLink() {
  const shareLinkInput = $("#shareLinkInput");
  try {
    await navigator.clipboard.writeText(shareLinkInput.value);
    notifyApp("링크가 클립보드에 복사되었습니다.");
  } catch (err) {
    shareLinkInput.select();
    document.execCommand("copy");
    notifyApp("링크가 복사되었습니다.");
  }
}

async function loadSharedProject(id, shareToken = "") {
  notifyApp("공유 프로젝트를 불러오는 중...");
  try {
    const response = await fetchWithTimeout(`/api/project/load?id=${encodeURIComponent(id)}`, {
      headers: shareToken ? { "X-FrisFrame-Share": shareToken } : {},
    });
    if (!response.ok) {
      const errorText = await response.json().then(d => d.error).catch(() => "오류가 발생했습니다.");
      throw new Error(errorText);
    }
    const payload = await response.json();
    const nextProject = projectFromPayload(payload);
    suppressManagedAutosave = true;
    clearManagedProjectBinding();
    loadProjectDocument(nextProject);
    setProjectSaveStatus("changed");
    suppressManagedAutosave = false;
    notifyApp("공유 프로젝트를 열었습니다. 저장하면 내 프로젝트 사본이 됩니다.");
    setWorkspaceMode("storyboard");
  } catch (error) {
    suppressManagedAutosave = false;
    alert(`공유 프로젝트를 불러오지 못했습니다: ${error.message}`);
  }
}

function exportSize(renderState = state) {
  const ratio = aspectMap[renderState.aspect] || 16 / 9;
  if (ratio >= 1) {
    return { width: 1920, height: Math.round(1920 / ratio) };
  }
  return { width: Math.round(1920 * ratio), height: 1920 };
}

function renderToCanvas(target, renderState, options = {}) {
  const context = target.getContext("2d");
  const visibleContext = ctx;
  ctx = context;
  try {
    const rect = computeStageRect(target.width, target.height, renderState.aspect);
    ctx.fillStyle = "#101216";
    ctx.fillRect(0, 0, target.width, target.height);
    drawStage(renderState, rect, options);
  } finally {
    ctx = visibleContext;
  }
}

async function exportVideo() {
  const exportState = clone(state);
  const fps = clamp(Math.round(Number(exportState.motion.fps || 24)), 12, 60);
  const frameCount = Math.max(2, Math.round(exportState.motion.duration * fps));
  if (frameCount > 1800 && !confirm(
    `${frameCount.toLocaleString()}프레임을 준비합니다. 시간이 오래 걸리고 저장 공간이 많이 필요할 수 있습니다. 계속할까요?`,
  )) return;
  if (!beginMediaExport()) return;
  if (!initThreeView()) {
    presentExportError("3D 카메라 프레임을 준비하지 못했습니다.");
    endMediaExport();
    return;
  }
  const size = exportVideoSize(exportState);
  const previousSelection = clone(selected);
  let jobId = "";
  try {
    jobId = await startMp4ExportJob({ ...size, fps, frameCount });
    selected = null;

    const uploadQueue = [];
    const maxConcurrency = 6;
    let activeUploads = 0;
    let uploadError = null;

    const runUpload = async (index, blob) => {
      activeUploads += 1;
      try {
        await uploadMp4ExportFrame(jobId, index, blob);
      } catch (err) {
        uploadError = err;
      } finally {
        activeUploads -= 1;
        triggerNext();
      }
    };

    const triggerNext = () => {
      if (uploadError) return;
      while (activeUploads < maxConcurrency && uploadQueue.length > 0) {
        const nextTask = uploadQueue.shift();
        nextTask();
      }
    };

    for (let index = 0; index < frameCount; index += 1) {
      if (uploadError) throw uploadError;

      const progress = frameCount <= 1 ? 0 : index / (frameCount - 1);
      const renderState = interpolateRenderStateAtTime(exportState, progress * exportState.motion.duration);
      renderThreeView(renderState, true, size);
      await nextFrame();
      const frameBlob = await canvasToBlob(threeView.frameCanvas, "image/jpeg", 0.9);

      const task = () => runUpload(index, frameBlob);
      uploadQueue.push(task);
      triggerNext();

      while (uploadQueue.length > 12) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        if (uploadError) throw uploadError;
      }

      if (index === frameCount - 1 || index % Math.max(1, Math.round(fps / 4)) === 0) {
        mediaExportProgress = `MP4 ${index + 1}/${frameCount}`;
        renderMediaExportBusy();
      }
    }

    while (activeUploads > 0 || uploadQueue.length > 0) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      if (uploadError) throw uploadError;
    }

    mediaExportProgress = "MP4 인코딩";
    renderMediaExportBusy();
    const blob = await finishMp4ExportJob(jobId);
    jobId = "";
    const filename = `${slug(exportState.sceneTitle)}_previs_preview.mp4`;
    presentExport(blob, filename, "프리비즈 H.264 MP4", {
      type: "video",
      blob,
      caption: `${exportState.motion.duration.toFixed(1)}초 · ${fps}FPS · ${frameCount}프레임`,
    });
  } catch (error) {
    if (jobId) await cancelMp4ExportJob(jobId);
    presentExportError(error?.message || "MP4 프리비즈 영상을 만들지 못했습니다.");
  } finally {
    selected = previousSelection;
    cancelPreview();
    resizeThreeView();
    renderThreeView(interpolateStateAtTime(displayPlayhead()), true);
    mediaExportProgress = "";
    endMediaExport();
    syncUi();
  }
}

function exportVideoSize(renderState = state) {
  const ratio = aspectMap[renderState.aspect] || 16 / 9;
  if (ratio >= 1) return { width: 1280, height: Math.round(1280 / ratio) };
  return { width: Math.round(1280 * ratio), height: 1280 };
}

async function startMp4ExportJob(settings) {
  const response = await fetchWithTimeout("/api/mp4/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  }, 20000);
  const payload = await readExportResponse(response);
  if (!payload.jobId) throw new Error("MP4 작업을 시작하지 못했습니다.");
  return payload.jobId;
}

async function uploadMp4ExportFrame(jobId, index, blob) {
  const response = await fetchWithTimeout(`/api/mp4/frame?job=${encodeURIComponent(jobId)}&index=${index}`, {
    method: "POST",
    headers: { "Content-Type": "image/jpeg" },
    body: blob,
  }, 45000);
  await readExportResponse(response);
}

async function finishMp4ExportJob(jobId) {
  const response = await fetchWithTimeout(`/api/mp4/finish?job=${encodeURIComponent(jobId)}`, { method: "POST" }, 15 * 60 * 1000);
  if (!response.ok) {
    const payload = await readExportResponse(response);
    throw new Error(payload.error || "MP4 인코딩에 실패했습니다.");
  }
  const blob = await response.blob();
  return blob.type === "video/mp4" ? blob : new Blob([blob], { type: "video/mp4" });
}

async function cancelMp4ExportJob(jobId) {
  try {
    await fetchWithTimeout(`/api/mp4/cancel?job=${encodeURIComponent(jobId)}`, { method: "POST" }, 10000);
  } catch {
    // The server also clears unfinished jobs when it stops.
  }
}

async function readExportResponse(response) {
  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }
  if (!response.ok) throw new Error(payload.error || `MP4 서버 오류 (${response.status})`);
  return payload;
}

function beginMediaExport() {
  if (mediaExportBusy) return false;
  mediaExportBusy = true;
  mediaExportProgress = "";
  renderMediaExportBusy();
  return true;
}

function endMediaExport() {
  mediaExportBusy = false;
  renderMediaExportBusy();
}

function renderMediaExportBusy() {
  const labels = {
    "#blockingPlanBtn": "2D 블로킹 이미지",
    "#blockingPlanPanelBtn": "2D 블로킹",
    "#frameBtn": "현재 프레임",
    "#framePanelBtn": "현재 프레임",
    "#framePairBtn": "시작·끝 프레임",
    "#framePairPanelBtn": "시작·끝",
    "#videoBtn": "프리비즈 영상",
    "#videoPanelBtn": "프리비즈 영상",
  };
  Object.entries(labels).forEach(([selector, label]) => {
    const button = $(selector);
    if (!button) return;
    button.disabled = mediaExportBusy;
    const isVideoButton = selector === "#videoBtn" || selector === "#videoPanelBtn";
    const text = mediaExportBusy && isVideoButton ? mediaExportProgress || "준비 중" : label;
    const textElement = button.querySelector("span");
    if (textElement) textElement.textContent = text;
    else button.textContent = text;
  });
  $$('#contactSheetMenu button[data-contact-sheet-size]').forEach((button) => {
    button.disabled = mediaExportBusy;
  });
}

function buildSeedancePrompt() {
  const cam = state.camera;
  const fov = Math.round(focalToFov(cam.focal));
  const angle = cameraHeadingDeg(cam);
  const actors = state.items.filter((item) => item.type === "actor");
  const props = state.items.filter((item) => item.type === "prop");
  const keyframes = sortKeyframes(state.motion.keyframes);
  const framing = analyzeFraming();
  const motionResponsibility = buildSeedanceGuideSegments(state);
  const lines = [
    `Scene: ${state.sceneTitle || "Untitled blocking"}`,
    "",
    "Use @video as a visual blocking guide. Read the animated anchors and arrows directly from the video.",
    "For each moving subject: the hollow circle is the segment start, the bright dot is the current root position, the crosshair target is the next destination, and the arrow shows the remaining travel direction.",
    "Expanding radial arrows mean the subject moves toward the locked camera; contracting radial arrows mean the subject moves farther away.",
    "CAM labels describe camera responsibility. SUBJ labels and teal guides describe subject root-position movement.",
    "All HUD, paths, anchors, arrows, markers, labels, and guide graphics are annotations only. Use their motion meaning, but do not reproduce the graphics in the final video.",
    "Do not copy the graphic style, colored proxy models, UI, or diagram look.",
    "Final output must be cinematic live-action footage with realistic people, props, space, lighting, and camera behavior.",
    "",
    "Motion responsibility by segment:",
    ...motionResponsibility,
    "",
    `Camera: position (${pct(cam.x)}, ${pct(cam.y)}) at ${round(cam.height, 2)}m height, pan ${round(cam.panDeg, 1)}°, tilt ${round(cam.tiltDeg, 1)}°, approximate ${cam.focal}mm lens / ${fov}° horizontal field of view, facing ${angle}° on the top-down map.`,
    "",
    "Motion keyframes:",
    ...keyframes.map((keyframe) => `- ${sourceLabel(keyframe.source)} · ${keyframe.label} at ${keyframe.time.toFixed(1)}s · ${keyTransitionLabels[normalizeTransition(keyframe.transition)]}: ${keyframeSummary(keyframe)}.`),
    "",
    "Actors:",
    ...actors.map((item) => `- @${item.name}: ${positionText(item)}, facing ${Math.round(item.facing)}°.`),
    "",
    "Props and spatial anchors:",
    ...(props.length
      ? props.map((item) => `- @${item.name}: ${positionText(item)}, facing ${Math.round(item.facing)}°.`)
      : ["- none"]),
    "",
    ...(framing.notes.length ? framing.notes.map((note) => `- Framing review: ${note}.`) : ["- Framing review: all sampled subjects stay inside the planned frame."]),
    "",
    "Blocking intent:",
    state.sceneIntent || "Preserve the broad spatial relationship and timing from the blocking plan.",
    "",
    "Constraints: preserve the broad camera path, actor spacing, facing directions, and prop relationships from the blocking plan. Treat it as previsualization, not final art direction.",
  ].filter((line) => line !== null);
  return lines.join("\n");
}

function buildSeedanceGuideSegments(renderState) {
  const duration = Number(renderState.motion?.duration || 0);
  const times = new Set([0, duration]);
  (renderState.motion?.keyframes || []).forEach((keyframe) => times.add(clamp(Number(keyframe.time), 0, duration)));
  const sortedTimes = [...times].sort((a, b) => a - b);
  if (sortedTimes.length < 2) return ["- Entire shot: CAM: LOCKED; SUBJ: HOLD."];
  const lines = [];
  for (let index = 1; index < sortedTimes.length; index += 1) {
    const start = sortedTimes[index - 1];
    const end = sortedTimes[index];
    if (end - start < 0.001) continue;
    const sample = interpolateRenderStateAtTime(renderState, (start + end) / 2);
    const analysis = analyzeBlockingGuide(sample);
    lines.push(`- ${start.toFixed(1)}-${end.toFixed(1)}s: ${cameraGuideLabel(analysis, sample)}; ${subjectGuideLabel(analysis, sample)}.`);
  }
  return lines.length ? lines : ["- Entire shot: CAM: LOCKED; SUBJ: HOLD."];
}

function keyframeSummary(keyframe) {
  if (keyframe.source === "camera") {
    const camera = sanitizeCameraPose(keyframe.pose);
    return `H ${round(camera.height, 2)}m · camera (${pct(camera.x)}, ${pct(camera.y)}) · pan ${round(camera.panDeg, 1)}° · tilt ${round(camera.tiltDeg, 1)}°`;
  }
  const item = sanitizeSourcePose(keyframe.source, keyframe.pose);
  return `@${item.name} ${positionText(item)} facing ${Math.round(item.facing)}°`;
}

function pct(value) {
  return `${Math.round(value * 100)}%`;
}

function positionText(item) {
  const pose = resolvedItemPose(item, state);
  const horizontal = pose.x < 0.33 ? "left" : pose.x > 0.66 ? "right" : "center";
  const depth = pose.y < 0.33 ? "upper/deeper" : pose.y > 0.66 ? "lower/nearer" : "middle";
  return `${horizontal} ${depth} area at (${pct(pose.x)}, ${pct(pose.y)})`;
}

function presentExport(data, filename, label, preview = null) {
  const blob = data instanceof Blob ? data : new Blob([String(data)], { type: "text/plain;charset=utf-8" });
  revokePendingExportUrls(pendingExport);
  const url = URL.createObjectURL(blob);
  pendingExport = { url, blob, filename, label, previewUrls: [] };
  const body = $("#exportDialogBody");
  body.innerHTML = "";
  const name = document.createElement("div");
  name.className = "export-dialog-filename";
  name.textContent = filename;
  const info = document.createElement("div");
  info.className = "export-dialog-info";
  info.textContent = `${label}입니다. 아래 프리뷰를 확인한 뒤 저장하세요. 자동으로 저장되지 않습니다.`;
  body.append(name, info);
  renderExportPreview(body, preview);
  $("#exportDownloadBtn").hidden = false;
  $("#exportDialog").showModal();
}

function renderExportPreview(body, preview) {
  if (!preview) return;
  const section = document.createElement("section");
  section.className = "export-preview";
  const heading = document.createElement("h3");
  heading.textContent = "저장 전 프리뷰";
  section.append(heading);

  if (preview.type === "image") {
    section.append(createExportPreviewFigure(preview.blob, preview.caption, "image"));
  } else if (preview.type === "images") {
    const grid = document.createElement("div");
    grid.className = "export-preview-grid";
    (preview.items || []).forEach((item) => grid.append(createExportPreviewFigure(item.blob, item.caption, "image")));
    section.append(grid);
  } else if (preview.type === "video") {
    section.append(createExportPreviewFigure(preview.blob, preview.caption, "video"));
  } else if (preview.type === "text") {
    const text = document.createElement("pre");
    text.className = "export-preview-text";
    text.textContent = String(preview.text || "");
    section.append(text);
  }
  if (Array.isArray(preview.notes) && preview.notes.length) {
    const notes = document.createElement("ul");
    notes.className = "export-preview-notes";
    preview.notes.forEach((note) => {
      const item = document.createElement("li");
      item.textContent = note;
      notes.append(item);
    });
    section.append(notes);
  }
  body.append(section);
}

function createExportPreviewFigure(blob, caption, mediaType) {
  const figure = document.createElement("figure");
  figure.className = "export-preview-figure";
  const media = document.createElement(mediaType === "video" ? "video" : "img");
  const previewUrl = blob === pendingExport?.blob ? pendingExport.url : URL.createObjectURL(blob);
  if (previewUrl !== pendingExport?.url) pendingExport?.previewUrls.push(previewUrl);
  media.src = previewUrl;
  media.className = "export-preview-media";
  if (mediaType === "video") {
    media.controls = true;
    media.preload = "metadata";
    media.playsInline = true;
  } else {
    media.alt = caption || "내보내기 이미지 프리뷰";
  }
  figure.append(media);
  if (caption) {
    const label = document.createElement("figcaption");
    label.textContent = caption;
    figure.append(label);
  }
  if (mediaType === "image") {
    const actions = document.createElement("div");
    actions.className = "export-preview-actions";
    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.className = "text-btn export-preview-copy";
    copyButton.textContent = "이미지 복사";
    copyButton.title = "이미지를 클립보드에 복사";
    const status = document.createElement("span");
    status.className = "export-preview-copy-status";
    status.setAttribute("aria-live", "polite");
    copyButton.addEventListener("click", async (event) => {
      if (!event.isTrusted) return;
      copyButton.disabled = true;
      status.textContent = "복사 중";
      try {
        await copyImageBlobToClipboard(blob);
        copyButton.textContent = "복사됨";
        status.textContent = "붙여넣을 수 있습니다";
        setTimeout(() => {
          copyButton.textContent = "이미지 복사";
          status.textContent = "";
        }, 2200);
      } catch (error) {
        console.error("image clipboard copy failed", error);
        status.textContent = window.frisframeDesktop?.isDesktop
          ? "이미지를 복사하지 못했습니다"
          : "이 브라우저에서는 이미지 복사를 사용할 수 없습니다";
      } finally {
        copyButton.disabled = false;
      }
    });
    actions.append(copyButton, status);
    figure.append(actions);
  }
  return figure;
}

async function copyImageBlobToClipboard(blob) {
  const pngBlob = blob.type === "image/png" ? blob : await convertImageBlobToPng(blob);
  if (typeof window.frisframeDesktop?.copyImage === "function") {
    const result = await window.frisframeDesktop.copyImage(new Uint8Array(await pngBlob.arrayBuffer()));
    if (!result?.ok) throw new Error("Desktop image clipboard write failed.");
    return;
  }
  if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
    throw new Error("Image clipboard API is unavailable.");
  }
  await navigator.clipboard.write([new ClipboardItem({ "image/png": pngBlob })]);
}

async function convertImageBlobToPng(blob) {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext("2d").drawImage(bitmap, 0, 0);
  bitmap.close?.();
  return canvasToBlob(canvas, "image/png");
}

function revokePendingExportUrls(exportInfo, delay = 0) {
  if (!exportInfo) return;
  const urls = [...new Set([exportInfo.url, ...(exportInfo.previewUrls || [])].filter(Boolean))];
  const revoke = () => urls.forEach((url) => URL.revokeObjectURL(url));
  if (delay) setTimeout(revoke, delay);
  else revoke();
}

function presentExportError(message) {
  revokePendingExportUrls(pendingExport);
  pendingExport = null;
  const body = $("#exportDialogBody");
  body.innerHTML = "";
  const info = document.createElement("div");
  info.className = "export-dialog-info";
  info.textContent = String(message || "내보내기를 완료하지 못했습니다.");
  body.append(info);
  $("#exportDownloadBtn").hidden = true;
  $("#exportDialog").showModal();
}

$("#exportDownloadBtn").addEventListener("click", (event) => {
  // Keep every export behind a genuine user action. Programmatic clicks must never download files.
  if (!event.isTrusted || !pendingExport) return;
  const exportUrl = pendingExport.url;
  const link = document.createElement("a");
  link.href = exportUrl;
  link.download = pendingExport.filename;
  document.body.append(link);
  link.click();
  link.remove();
  const completedExport = pendingExport;
  pendingExport = null;
  $("#exportDialog").close();
  if (completedExport.filename.endsWith("_storyboard_project.json")) {
    notifyApp("프로젝트 JSON 백업을 저장했습니다.");
  }
  revokePendingExportUrls(completedExport, 2000);
});

$("#exportDialog").addEventListener("close", () => {
  revokePendingExportUrls(pendingExport);
  pendingExport = null;
});

function downloadUrl(url, filename) {
  presentExport(url, filename, "파일");
}

function downloadBlob(blob, filename) {
  presentExport(blob, filename, "파일");
}

function canvasToBlob(sourceCanvas, type = "image/png", quality) {
  return new Promise((resolve, reject) => {
    sourceCanvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Could not render canvas export."));
    }, type, quality);
  });
}

async function createZip(files) {
  const encoder = new TextEncoder();
  const chunks = [];
  const central = [];
  let offset = 0;
  const now = zipDateTime(new Date());

  for (const file of files) {
    const nameBytes = encoder.encode(file.path);
    const data = file.blob
      ? new Uint8Array(await file.blob.arrayBuffer())
      : encoder.encode(file.content || "");
    const crc = crc32(data);
    const local = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, now.time, true);
    localView.setUint16(12, now.date, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, data.length, true);
    localView.setUint32(22, data.length, true);
    localView.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    chunks.push(local, data);

    const entry = new Uint8Array(46 + nameBytes.length);
    const view = new DataView(entry.buffer);
    view.setUint32(0, 0x02014b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 20, true);
    view.setUint16(8, 0x0800, true);
    view.setUint16(10, 0, true);
    view.setUint16(12, now.time, true);
    view.setUint16(14, now.date, true);
    view.setUint32(16, crc, true);
    view.setUint32(20, data.length, true);
    view.setUint32(24, data.length, true);
    view.setUint16(28, nameBytes.length, true);
    view.setUint32(42, offset, true);
    entry.set(nameBytes, 46);
    central.push(entry);
    offset += local.length + data.length;
  }

  const centralSize = central.reduce((sum, entry) => sum + entry.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);
  return new Blob([...chunks, ...central, end], { type: "application/zip" });
}

function zipDateTime(date) {
  const year = Math.max(1980, date.getFullYear());
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc ^= bytes[i];
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function round(value, digits = 4) {
  const factor = 10 ** digits;
  return Math.round(Number(value) * factor) / factor;
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function escapeMarkdown(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function blenderXY(point) {
  const size = stageWorldSize(state);
  return [
    round((point.x - 0.5) * size.width),
    round((point.y - 0.5) * size.depth),
  ];
}

function pyString(value) {
  return JSON.stringify(String(value ?? ""));
}

function slug(value) {
  return (
    String(value || "stage")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9가-힣]+/g, "-")
      .replace(/^-+|-+$/g, "") || "stage"
  );
}

function init() {
  populatePropCatalogControls();
  sanitizeState();
  project = createDefaultProject(state);
  activeSceneId = project.scenes[0].id;
  activeCutId = project.scenes[0].cuts[0].id;
  state = project.scenes[0].cuts[0].blocking;
  setupResponsivePanels();
  selectKeyForSource(selectedSourceId() || activeSourceId());
  commit();
  window.addEventListener("resize", () => {
    resizeCanvas();
  });
  window.addEventListener("beforeunload", (event) => {
    if (!hasUnsavedProjectChanges()) {
      clearManagedProjectRecovery();
      return;
    }
    writeManagedProjectRecoveryNow();
    if (window.frisframeDesktop?.isDesktop) return;
    event.preventDefault();
    event.returnValue = "";
  });
  resizeCanvas();
  requestAnimationFrame(() => centerStageOnContent());
  refreshLucideIcons();
  
  const urlParams = new URLSearchParams(window.location.search);
  const shareId = urlParams.get("project");
  const shareToken = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("share") || "";
  const startupProject = shareId
    ? loadSharedProject(shareId, shareToken)
    : resumeLastManagedProject();
  Promise.resolve(startupProject).then((loaded) => {
    if (!shareId && !loaded) {
      openProjectLibrary(true);
      return;
    }
    requestAnimationFrame(() => {
      resizeCanvas();
      centerStageOnContent();
    });
    scheduleFirstTutorial();
  });
}

init();
