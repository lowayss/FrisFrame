const canvas = document.querySelector("#stageCanvas");
let ctx = canvas.getContext("2d");

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
const analysisCore = window.PrevisVideoAnalysisCore;
if (!analysisCore) throw new Error("영상 분석 엔진을 불러오지 못했습니다.");
const storyboardCore = window.StoryboardCore;
if (!storyboardCore) throw new Error("스토리보드 구성 엔진을 불러오지 못했습니다.");
const PROJECT_SCHEMA_VERSION = 5;
const SERVICE_NAME = "FrisFrame";
const {
  assignTrackCandidates,
  accumulateCameraTransforms,
  classifyCameraMotion,
  compensatedMotionFeatures,
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
  samplePlanarPath,
  smoothCameraTransforms,
  stabilizeDetection,
  transitionProgress,
} = analysisCore;

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

const cameraMotionLabels = {
  static: "고정",
  pan: "팬/틸트",
  zoom: "줌/돌리",
  handheld: "핸드헬드",
  mixed: "복합 이동",
};

const cameraInterpretationMix = {
  rotation: 0.12,
  balanced: 0.45,
  movement: 0.85,
};

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

const defaultState = () => ({
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
  motionPrevis: {
    imported: false,
    importedAt: "",
    sourceName: "",
    frameCount: 0,
    cameraMoveFrames: 0,
    sampleFps: 0,
    qualityReport: null,
    poseDiagnostics: [],
    files: {},
    shotBible: [],
    analysisSettings: null,
  },
  reference: {
    id: "",
    kind: "none",
    name: "",
    url: "",
    type: "",
    size: 0,
    duration: 0,
    start: 0,
    end: 0,
    precision: "detailed",
    showOverlay: true,
    calibration: {
      anchorToCurrent: true,
      mirrorX: false,
      rotation: 0,
      lateralScale: 0.8,
      depthScale: 0.65,
      sizeDepthWeight: 0.1,
      cameraGain: 1.1,
      cameraInterpretation: "balanced",
      stabilizationStrength: 0.75,
    },
    notes: "",
    analysis: {
      status: "idle",
      keyCount: 0,
      actorCount: 1,
      motionScore: 0,
      tracking: "motion",
      detectedFrames: 0,
      sampleCount: 0,
      cameraConfidence: 0,
      cameraMotionType: "static",
      cameraPan: 0,
      cameraZoom: 0,
      cameraJitter: 0,
      actorConfidence: 0,
      mappingConfidence: 0,
      detectedActorCount: 0,
      detectedObjectCount: 0,
      sceneCuts: 0,
      cutTimes: [],
    },
  },
  aspect: "16:9",
  spacePresetId: "",
  showGrid: true,
  showNames: false,
  showCamera: true,
  cleanExport: true,
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
  },
  items: [
    {
      id: uid(),
      type: "actor",
      name: "수아",
      x: 0.32,
      y: 0.46,
      size: 1,
      color: "#ff6262",
      shape: "circle",
      facing: 0,
      placementMode: "manual",
      mountId: "",
      seatIndex: 0,
    },
    {
      id: uid(),
      type: "prop",
      name: "테이블",
      x: 0.5,
      y: 0.62,
      size: 1.05,
      color: "#65d66f",
      shape: "triangle",
      facing: 270,
      assetType: "dining-table",
      scaleX: 1,
      scaleY: 1,
      scaleZ: 1,
    },
  ],
  groups: [],
  motion: {
    duration: 15,
    fps: 24,
    playhead: 0,
    activeSource: "all",
    timelineView: "combined",
    selectedKeyId: null,
    hiddenSources: [],
    keyframes: [],
  },
});

let state = defaultState();
let selected = { kind: "item", id: state.items[0].id };
let history = [];
let future = [];
let project = null;
let activeSceneId = "";
let activeCutId = "";
let workspaceMode = "blocking";
let storyboardStatusFilter = "all";
let storyboardScope = "scene";
let structureDraft = null;
let storyboardThumbnailRun = 0;
let projectSaveStatus = "changed";
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
let preview = null;
let viewMode = "2d";
let threeView = null;
let threeDrag = null;
let threeEditMode = "move";
let referenceClipBlob = null;
let referenceClipUrl = "";
let referenceAnalysisBusy = false;
let referenceAnalysisMessage = "";
let referenceAnalysisStage = "";
let referenceAnalysisCache = null;
let referenceAnalysisGeneration = 0;
const personDetectors = {};
const personDetectorPromises = {};
let pendingExport = null;
let evaluatedViewState = null;
let mediaExportBusy = false;
let mediaExportProgress = "";
let tutorialOpen = false;
let tutorialIndex = 0;
let tutorialPositionFrame = null;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const mobilePanelQuery = window.matchMedia("(max-width: 760px)");
const TUTORIAL_STORAGE_KEY = "previs-blocking-tutorial-v1";
const tutorialSteps = [
  {
    title: `${SERVICE_NAME} 시작하기`,
    body: "이 도구는 컷마다 배우·소품·카메라의 위치와 움직임을 설계하고, 2D 평면도와 3D 프리비즈로 확인하는 작업 공간입니다. 안내를 따라가면 한 컷을 만드는 전체 순서를 익힐 수 있습니다.",
    tryText: "프로젝트 내용은 바뀌지 않습니다. 다음을 눌러 주요 작업 영역을 차례로 살펴보세요.",
  },
  {
    selector: "#storyboardBtn",
    title: "1. 씬과 컷 정리",
    body: "스토리보드에서는 시나리오를 씬과 컷으로 나누고, 각 컷의 액션·대사·샷 크기·연출 의도를 기록합니다. 원하는 컷에서 ‘블로킹 열기’를 누르면 지금 보는 무대 편집 화면으로 들어옵니다.",
    tryText: "여러 컷을 만들 때는 먼저 스토리보드에서 순서를 정한 뒤 각 컷의 블로킹을 작업하세요.",
  },
  {
    selector: "#aspectButtons",
    highlightClosest: "details",
    openDetails: true,
    title: "2. 무대와 화면비",
    body: "무대에서 최종 영상의 화면비를 정합니다. 격자는 거리와 정렬을 판단할 때 쓰고, 이름 표시는 복잡할 때 끌 수 있습니다. ‘깨끗한 출력’을 켜면 편집용 표시가 결과 이미지에서 빠집니다.",
    tryText: "일반 영화·광고는 16:9, 세로 숏폼은 9:16부터 시작하면 편합니다.",
  },
  {
    selector: "#actorForm",
    highlightClosest: "details",
    openDetails: true,
    title: "3. 배우 추가",
    body: "배우 이름을 입력하고 추가하면 무대와 목록에 배우가 생깁니다. 배우를 선택한 뒤 오른쪽 속성에서 색, 크기, 바라보는 방향과 미세 위치를 조절할 수 있습니다.",
    tryText: "배우 목록의 항목을 누른 다음 무대 위 마크를 드래그해 첫 위치를 잡아보세요.",
  },
  {
    selector: "#propForm",
    highlightClosest: "details",
    openDetails: true,
    title: "4. 소품과 공간 추가",
    body: "자동차·가구·가전·나무 같은 소품을 직접 추가하거나, 거실·주방·침실 같은 공간 프리셋을 한 번에 배치할 수 있습니다. 소품마다 길이·높이·너비를 따로 바꿀 수 있습니다.",
    tryText: "빠르게 시작하려면 공간 프리셋을 넣고 필요 없는 요소만 삭제하세요.",
  },
  {
    selector: "#stageCanvas",
    cardWidth: 280,
    title: "5. 2D 평면도에서 블로킹",
    body: "가운데 무대는 위에서 내려다본 평면도입니다. 배우·소품·카메라를 드래그해 위치를 정하고, 선택 대상의 방향 핸들이나 오른쪽 방향 슬라이더로 시선을 조절합니다. 카메라의 부채꼴은 현재 화각입니다.",
    tryText: "먼저 인물 간 거리와 시선축을 잡고, 그다음 카메라 위치를 정하면 구도가 덜 꼬입니다.",
  },
  {
    selector: "#cameraHeightSlider",
    highlightClosest: "details",
    openDetails: true,
    title: "6. 카메라와 피사체 추적",
    body: "렌즈는 화각, 높이는 카메라의 수직 위치, 팬은 좌우 회전, 틸트는 위아래 각도입니다. 피사체 추적을 선택하면 배우의 얼굴·머리 위치를 기준으로 팬과 틸트가 자동 조정됩니다.",
    tryText: "카메라 높이를 바꾼 뒤 3D 카메라 프레임에서 헤드룸과 내려다보는 각도를 확인하세요.",
  },
  {
    selector: "#actorPlacementFields",
    fallbackSelector: "#propertiesPanel",
    prepare: "actor-properties",
    title: "7. 차량 탑승",
    body: "배우를 선택하면 ‘탑승 방식’이 나타납니다. 자동 탑승은 차량과 좌석을 고르면 바로 결합됩니다. 수동 탑승은 배우를 차량 위에 겹친 뒤 ‘겹친 대상 묶기’를 누릅니다. 두 방식 모두 차량 트랙 하나로 함께 움직입니다.",
    tryText: "자동은 좌석이 정확할 때, 수동은 자유로운 자세나 특수한 배치가 필요할 때 사용하세요.",
  },
  {
    selector: ".timeline",
    title: "8. 키프레임으로 동선 만들기",
    body: "대상을 고르고 현재 시간 0초에 첫 키를 추가합니다. 대상을 새 위치로 옮긴 뒤 현재 시간을 바꾸고 두 번째 키를 추가하면 동선이 만들어집니다. ‘현재 시간’은 키가 놓일 순간이고 ‘전체 시간’은 컷 전체 길이입니다.",
    tryText: "타임라인의 점은 좌우로 드래그해 시간을 바꿀 수 있습니다. 도착 방식과 경로도 선택한 키에서 조정하세요.",
  },
  {
    selector: "#viewButtons",
    title: "9. 3D 프리비즈 확인",
    body: "3D에서는 배우·소품·카메라의 높이와 방향을 입체적으로 확인합니다. 이동·방향 모드로 대상을 편집하고, 오른쪽 아래 카메라 프레임에서 실제 렌즈에 들어오는 구도를 확인합니다.",
    tryText: "2D에서 동선을 만든 뒤 3D로 전환해 충돌, 높이, 헤드룸을 점검하세요.",
  },
  {
    selector: "#exportMenu",
    title: "10. 저장과 내보내기",
    body: "저장은 편집 가능한 프로젝트 파일을 준비합니다. 내보내기에서는 현재 프레임, 시작·끝 프레임, 카메라 영상을 먼저 프리뷰로 확인한 뒤 직접 내보냅니다. 작업 중 자동 다운로드는 발생하지 않습니다.",
    tryText: "결과를 만들기 전 2D 동선 재생과 3D 카메라 프레임을 한 번씩 확인하세요.",
  },
  {
    title: "기본 작업 순서",
    body: "컷 선택 → 화면비 설정 → 배우·소품 배치 → 카메라 구도 → 첫 키 추가 → 위치와 시간을 바꿔 다음 키 추가 → 동선 재생 → 3D 확인 → 프리뷰 검토 → 저장·내보내기 순서로 작업하면 됩니다.",
    tryText: "상단의 물음표 버튼을 누르면 이 튜토리얼을 언제든 다시 볼 수 있습니다.",
  },
];

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
    tiltDeg: clamp(radToDeg(Math.atan2(dy, Math.max(0.0001, horizontal))), -60, 60),
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
  cut.thumbnailTime = clamp(Number(metadata.thumbnailTime || 0), 0, documentState.motion?.duration || 60);
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
  if (payload?.schemaVersion === PROJECT_SCHEMA_VERSION || payload?.project) {
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
  stopPreview();
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
  clearReferenceClipRuntime();
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
  fresh.aspect = template.aspect;
  fresh.showGrid = template.showGrid;
  fresh.showNames = template.showNames;
  fresh.showCamera = template.showCamera;
  fresh.cleanExport = template.cleanExport;
  fresh.camera = clone(template.camera);
  fresh.items = clone(template.items);
  fresh.motion.duration = template.motion?.duration || 15;
  fresh.motion.fps = template.motion?.fps || 24;
  fresh.sceneTitle = "새 컷";
  fresh.sceneIntent = "";
  return remapBlockingIds(fresh);
}

function createCutFromTextDraft(draft) {
  const blocking = defaultState();
  blocking.sceneTitle = draft.title || "새 컷";
  blocking.sceneIntent = [draft.intent, draft.camera].filter(Boolean).join("\n");
  if (draft.duration) blocking.motion.duration = clamp(Number(draft.duration), 1, MAX_TIMELINE_DURATION);
  if (draft.focal) blocking.camera.focal = clamp(Number(draft.focal), 14, 135);
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
  return issues;
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
  state.version = 4;
  state.spacePresetId = environmentPresets[state.spacePresetId] ? state.spacePresetId : "";
  state.previs = state.previs || {};
  state.previs.mode = previsModes[state.previs.mode] ? state.previs.mode : "full-scene";
  state.previs.target = previsTargets[state.previs.target] ? state.previs.target : "hybrid";
  state.previs.selectedLayers = normalizeSelection(state.previs.selectedLayers, controlLayers, ["camera", "pose", "depth", "ai-depth", "edges", "masks"]);
  state.previs.exportPresets = normalizeSelection(state.previs.exportPresets, exportPresets, ["seedance", "blender"]);
  state.reference = sanitizeReference(state.reference);
  state.motionPrevis = sanitizeMotionPrevis(state.motionPrevis);
  state.items = (state.items || []).map((item) => sanitizeItemPose(item));
  sanitizeAutoMountRelationships(state);
  state.groups = sanitizeManualGroups(state.groups, state);
  migrateLegacyMountsToGroups(state);
  state.groups = sanitizeManualGroups(state.groups, state);
  const cameraOrientation = cameraOrientationFromLegacy(state.camera, state);
  state.camera = {
    x: clamp(Number(state.camera?.x ?? 0.92), 0.02, 0.98),
    y: clamp(Number(state.camera?.y ?? 0.48), 0.02, 0.98),
    height: clamp(Number(state.camera?.height ?? 1.6), 0.4, 3),
    panDeg: normalizePanDeg(Number.isFinite(Number(state.camera?.panDeg)) ? state.camera.panDeg : cameraOrientation.panDeg),
    tiltDeg: clamp(Number.isFinite(Number(state.camera?.tiltDeg)) ? Number(state.camera.tiltDeg) : cameraOrientation.tiltDeg, -60, 60),
    focal: clamp(Number(state.camera?.focal ?? 85), 14, 135),
    trackingTargetId: sanitizeTrackingTargetId(state.camera?.trackingTargetId, state),
  };
  syncCameraDerivedAim(state.camera, state);
  state.motion = state.motion || {};
  state.motion.duration = clamp(Number(state.motion.duration ?? 15), 1, MAX_TIMELINE_DURATION);
  state.motion.fps = clamp(Number(state.motion.fps ?? 24), 12, 60);
  state.motion.playhead = clamp(Number(state.motion.playhead ?? 0), 0, state.motion.duration);
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

function normalizeSelection(values, catalog, fallback) {
  const selectedValues = Array.isArray(values) ? values : fallback;
  const normalized = selectedValues.filter((value, index, list) => catalog[value] && list.indexOf(value) === index);
  return normalized.length ? normalized : [...fallback];
}

function sanitizeReference(reference = {}) {
  const duration = Math.max(0, Number(reference.duration || 0));
  const start = clamp(Number(reference.start || 0), 0, duration || 600);
  const endRaw = Number(reference.end || 0);
  const end = endRaw > 0 ? clamp(endRaw, start, duration || 600) : duration;
  return {
    id: String(reference.id || ""),
    kind: ["video", "image"].includes(reference.kind)
      ? reference.kind
      : String(reference.type || "").startsWith("image/")
        ? "image"
        : reference.name
          ? "video"
          : "none",
    name: String(reference.name || ""),
    url: String(reference.url || ""),
    type: String(reference.type || ""),
    size: Math.max(0, Number(reference.size || 0)),
    duration,
    start,
    end,
    precision: reference.precision === "fast" ? "fast" : "detailed",
    showOverlay: reference.showOverlay !== false,
    calibration: sanitizeReferenceCalibration(reference.calibration),
    notes: String(reference.notes || ""),
    analysis: {
      status: ["idle", "ready", "working", "review"].includes(reference.analysis?.status)
        ? reference.analysis.status
        : "idle",
      keyCount: clamp(Number(reference.analysis?.keyCount ?? 0), 0, 40),
      actorCount: clamp(Number(reference.analysis?.actorCount ?? 1), 1, 8),
      motionScore: clamp(Number(reference.analysis?.motionScore ?? 0), 0, 100),
      tracking: reference.analysis?.tracking === "vision" ? "vision" : "motion",
      detectedFrames: clamp(Number(reference.analysis?.detectedFrames ?? 0), 0, 80),
      sampleCount: clamp(Number(reference.analysis?.sampleCount ?? 0), 0, 80),
      cameraConfidence: clamp(Number(reference.analysis?.cameraConfidence ?? 0), 0, 100),
      cameraMotionType: cameraMotionLabels[reference.analysis?.cameraMotionType] ? reference.analysis.cameraMotionType : "static",
      cameraPan: clamp(Number(reference.analysis?.cameraPan ?? 0), 0, 1),
      cameraZoom: clamp(Number(reference.analysis?.cameraZoom ?? 0), 0, 1),
      cameraJitter: clamp(Number(reference.analysis?.cameraJitter ?? 0), 0, 1),
      actorConfidence: clamp(Number(reference.analysis?.actorConfidence ?? 0), 0, 100),
      mappingConfidence: clamp(Number(reference.analysis?.mappingConfidence ?? 0), 0, 100),
      detectedActorCount: clamp(Number(reference.analysis?.detectedActorCount ?? 0), 0, 8),
      detectedObjectCount: clamp(Number(reference.analysis?.detectedObjectCount ?? 0), 0, 24),
      sceneCuts: clamp(Number(reference.analysis?.sceneCuts ?? 0), 0, 20),
      cutTimes: Array.isArray(reference.analysis?.cutTimes)
        ? reference.analysis.cutTimes.map(Number).filter(Number.isFinite).map((time) => clamp(time, 0, MAX_TIMELINE_DURATION)).slice(0, 20)
        : [],
    },
  };
}

function sanitizeProvenance(provenance) {
  if (!isPlainObject(provenance) || provenance.type !== "reference") return null;
  return {
    type: "reference",
    referenceId: String(provenance.referenceId || ""),
    detectionId: String(provenance.detectionId || ""),
  };
}

function sanitizeReferenceCalibration(calibration = {}) {
  const rotation = [0, 90, 180, 270].includes(Number(calibration.rotation))
    ? Number(calibration.rotation)
    : 0;
  return {
    anchorToCurrent: calibration.anchorToCurrent !== false,
    mirrorX: Boolean(calibration.mirrorX),
    rotation,
    lateralScale: clamp(Number(calibration.lateralScale ?? 0.8), 0.3, 1.2),
    depthScale: clamp(Number(calibration.depthScale ?? 0.65), 0.2, 1.2),
    sizeDepthWeight: clamp(Number(calibration.sizeDepthWeight ?? 0.1), 0, 0.3),
    cameraGain: clamp(Number(calibration.cameraGain ?? 1.1), 0.25, 2),
    cameraInterpretation: cameraInterpretationMix[calibration.cameraInterpretation] != null
      ? calibration.cameraInterpretation
      : "balanced",
    stabilizationStrength: clamp(Number(calibration.stabilizationStrength ?? 0.75), 0, 1),
  };
}

function sanitizeMotionPrevis(importData = {}) {
  const files = isPlainObject(importData.files) ? importData.files : {};
  return {
    imported: Boolean(importData.imported),
    importedAt: String(importData.importedAt || ""),
    sourceName: String(importData.sourceName || ""),
    frameCount: Math.max(0, Number(importData.frameCount || 0)),
    cameraMoveFrames: Math.max(0, Number(importData.cameraMoveFrames || 0)),
    sampleFps: Math.max(0, Number(importData.sampleFps || 0)),
    qualityReport: isPlainObject(importData.qualityReport) ? importData.qualityReport : null,
    poseDiagnostics: Array.isArray(importData.poseDiagnostics) ? importData.poseDiagnostics.map(String).slice(0, 24) : [],
    files,
    shotBible: Array.isArray(importData.shotBible) ? importData.shotBible.slice(0, 24) : [],
    analysisSettings: isPlainObject(importData.analysisSettings) ? importData.analysisSettings : null,
  };
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

function showSourceTimeline(sourceId) {
  state.motion.hiddenSources = normalizeHiddenSources(state.motion.hiddenSources)
    .filter((entry) => entry !== sourceId);
}

function hideSourceTimeline(sourceId) {
  if (!sourceExists(sourceId)) return;
  state.motion.hiddenSources = [...new Set([...normalizeHiddenSources(state.motion.hiddenSources), sourceId])];
  state.motion.keyframes = state.motion.keyframes.filter((keyframe) => keyframe.source !== sourceId);
  if (state.motion.activeSource === sourceId) state.motion.activeSource = "all";
  if (!selectedKeyframeExists(state.motion.selectedKeyId)) {
    state.motion.selectedKeyId = state.motion.keyframes[0]?.id || null;
  }
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
    time: clamp(Number(time), 0, duration),
    transition: "smooth",
    segment: motionSegmentForPathMode(pathMode, sourceId),
    pose,
  };
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
    time: clamp(Number(keyframe.time ?? 0), 0, state.motion.duration),
    transition: normalizeTransition(keyframe.transition),
    segment: sanitizeMotionSegment(keyframe.segment || keyframe.path, keyframe.source),
    pose: sanitizeSourcePose(keyframe.source, keyframe.pose || keyframe),
    provenance: sanitizeProvenance(keyframe.provenance),
  };
}

function splitLegacyKeyframe(keyframe, index = 0) {
  const time = clamp(Number(keyframe.time ?? 0), 0, state.motion.duration);
  const keys = [];
  keys.push({
    id: uid(),
    source: "camera",
    label: keyframe.label || `키 ${index + 1}`,
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
    normalized.plan.bulge = clamp(Number(segment?.plan?.bulge ?? fallback), -0.49, 0.49) || fallback;
  }
  if (normalized.plan.kind === "bezier") {
    const control = segment?.plan?.control;
    normalized.plan.control = Number.isFinite(Number(control?.x)) && Number.isFinite(Number(control?.y))
      ? { x: clamp(Number(control.x), -0.5, 1.5), y: clamp(Number(control.y), -0.5, 1.5) }
      : null;
  }
  if (normalized.elevation.kind === "jib-arc") {
    const fallback = normalized.elevation.bulge;
    normalized.elevation.bulge = clamp(Number(segment?.elevation?.bulge ?? fallback), -0.49, 0.49) || fallback;
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
    type: definition.type,
    name: definition.name,
    assetType: definition.assetType,
    placementMode: definition.placementMode || "manual",
    mountId: definition.mountId || "",
    seatIndex: Number(definition.seatIndex || 0),
    motionEnabled: definition.motionEnabled !== false,
  };
}

function sanitizeCameraPose(camera) {
  if (!camera) return clone(state.camera);
  const orientation = cameraOrientationFromLegacy(camera, state);
  const sanitized = {
    x: clamp(Number(camera.x ?? state.camera.x), 0.02, 0.98),
    y: clamp(Number(camera.y ?? state.camera.y), 0.02, 0.98),
    height: clamp(Number(camera.height ?? state.camera.height ?? 1.6), 0.4, 3),
    panDeg: normalizePanDeg(Number.isFinite(Number(camera.panDeg)) ? camera.panDeg : orientation.panDeg),
    tiltDeg: clamp(Number.isFinite(Number(camera.tiltDeg)) ? Number(camera.tiltDeg) : orientation.tiltDeg, -60, 60),
    focal: clamp(Number(camera.focal ?? state.camera.focal), 14, 135),
    trackingTargetId: sanitizeTrackingTargetId(camera.trackingTargetId ?? state.camera.trackingTargetId, state),
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
    tiltDeg: clamp(radToDeg(faceAngle - framingOffset), -60, 60),
  };
}

function applyCameraTracking(renderState) {
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
    type,
    name: item.name || (type === "prop" ? propCatalog[assetType].label : "배우"),
    x: clamp(Number(item.x ?? 0.5), 0.02, 0.98),
    y: clamp(Number(item.y ?? 0.5), 0.02, 0.98),
    size: clamp(Number(item.size ?? 1), 0.25, 4),
    color: item.color || colors[0],
    shape: item.shape || "circle",
    facing: Number(item.facing ?? 0) % 360,
    assetType,
    scaleX: clamp(Number(item.scaleX ?? 1), 0.25, 3.5),
    scaleY: clamp(Number(item.scaleY ?? 1), 0.25, 3.5),
    scaleZ: clamp(Number(item.scaleZ ?? 1), 0.25, 3.5),
    placementMode: type === "actor" && (item.placementMode === "auto" || item.mountId) ? "auto" : "manual",
    mountId: type === "actor" ? String(item.mountId || "") : "",
    seatIndex: type === "actor" ? Math.max(0, Math.round(Number(item.seatIndex || 0))) : 0,
    motionEnabled: item.motionEnabled !== false,
    presetInstanceId: String(item.presetInstanceId || ""),
    visible: item.visible !== false,
    provenance: sanitizeProvenance(item.provenance),
    detectionConfidence: item.detectionConfidence == null ? null : clamp(Number(item.detectionConfidence), 0, 1),
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
    state.camera = sanitizeCameraPose(pose);
    state.camera.trackingTargetId = sanitizeTrackingTargetId(trackingTargetId, state);
    applyCameraTracking(state);
    return;
  }
  const itemIndex = state.items.findIndex((item) => item.id === sourceId);
  if (itemIndex === -1) return;
  state.items[itemIndex] = { ...state.items[itemIndex], ...sanitizeSourcePose(sourceId, pose) };
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  draw();
  resizeThreeView();
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

  if (renderState.showGrid && !(clean && renderState.cleanExport)) drawGrid(rect);
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
  if (ratio >= 1) return { width: 12, depth: 12 / ratio };
  return { width: 12 * ratio, depth: 12 };
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
  const frameMeta = $("#cameraFrameMeta");
  const THREE = window.THREE;
  if (!THREE) {
    if (hudMeta) hudMeta.textContent = "3D 엔진을 불러오지 못했습니다";
    threeView = { ready: false };
    return false;
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#111820");
  scene.fog = new THREE.Fog("#111820", 18, 42);

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
  keyLight.shadow.camera.left = -10;
  keyLight.shadow.camera.right = 10;
  keyLight.shadow.camera.top = 10;
  keyLight.shadow.camera.bottom = -10;
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
    frameMeta,
    frameCamera,
    frameRenderer,
    cameraRigHelper: null,
    raycaster,
    orbit: { theta: -0.62, phi: 0.68, radius: 14.2 },
    lastState: null,
  };

  canvas3d.addEventListener("pointerdown", beginThreeDrag);
  canvas3d.addEventListener("pointermove", updateThreeDrag);
  canvas3d.addEventListener("pointerup", endThreeDrag);
  canvas3d.addEventListener("pointercancel", endThreeDrag);
  canvas3d.addEventListener("wheel", zoomThreeView, { passive: false });
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
    const modeLabel = threeEditMode === "rotate"
      ? "방향 편집"
      : threeEditMode === "view"
        ? "시점 탐색"
        : "위치 편집";
    threeView.hudMeta.textContent = renderState.aspect + " · 대상 " + renderState.items.length + " · 키 " + keyCount + " · " + modeLabel;
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
  const xStep = size.width / 16;
  const zStep = size.depth / 9;
  for (let i = 0; i <= 16; i += 1) {
    const x = -size.width / 2 + xStep * i;
    group.add(lineFromPoints([
      new THREE.Vector3(x, 0.025, -size.depth / 2),
      new THREE.Vector3(x, 0.025, size.depth / 2),
    ], i === 8 ? centerMaterial : i % 4 === 0 ? majorMaterial : minorMaterial));
  }
  for (let i = 0; i <= 9; i += 1) {
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
    body = renderItem.autoMounted ? makeThreeSeatedActorModel(scale, color) : makeThreeActorModel(scale, color);
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

function makeThreeActorModel(scale, color) {
  const THREE = window.THREE;
  const model = new THREE.Group();
  model.name = "humanoid-v1";
  const base = new THREE.Color(color);
  const light = base.clone().lerp(new THREE.Color("#ffffff"), 0.16);
  const dark = base.clone().lerp(new THREE.Color("#101417"), 0.28);
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: base, roughness: 0.66, metalness: 0.02 });
  const chestMaterial = new THREE.MeshStandardMaterial({ color: light, roughness: 0.62, metalness: 0.02 });
  const jointMaterial = new THREE.MeshStandardMaterial({ color: dark, roughness: 0.7, metalness: 0.01 });

  const addMesh = (geometry, material, position, rotation = null, name = "") => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(position[0] * scale, position[1] * scale, position[2] * scale);
    if (rotation) mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
    mesh.name = name;
    model.add(mesh);
    return mesh;
  };
  const cylinder = (top, bottom, height, material, position, rotation, name) => addMesh(
    new THREE.CylinderGeometry(top * scale, bottom * scale, height * scale, 16),
    material,
    position,
    rotation,
    name,
  );
  const joint = (radius, position, name) => addMesh(
    new THREE.SphereGeometry(radius * scale, 14, 10),
    jointMaterial,
    position,
    null,
    name,
  );

  addMesh(new THREE.BoxGeometry(0.34 * scale, 0.2 * scale, 0.22 * scale), jointMaterial, [0, 0.84, 0], null, "pelvis");
  cylinder(0.19, 0.17, 0.28, bodyMaterial, [0, 1.05, 0], null, "abdomen");
  cylinder(0.24, 0.19, 0.42, chestMaterial, [0, 1.36, 0], null, "chest");
  cylinder(0.07, 0.075, 0.1, jointMaterial, [0, 1.62, 0], null, "neck");
  addMesh(new THREE.SphereGeometry(0.16 * scale, 20, 14), chestMaterial, [0, 1.78, 0], null, "head");
  addMesh(new THREE.SphereGeometry(0.035 * scale, 10, 8), jointMaterial, [0, 1.78, 0.153], null, "face-direction");

  [-1, 1].forEach((side) => {
    const suffix = side < 0 ? "L" : "R";
    joint(0.075, [side * 0.27, 1.48, 0], `shoulder${suffix}`);
    cylinder(0.065, 0.075, 0.36, bodyMaterial, [side * 0.29, 1.27, 0], [0, 0, side * -0.08], `upperArm${suffix}`);
    joint(0.058, [side * 0.31, 1.07, 0], `elbow${suffix}`);
    cylinder(0.052, 0.06, 0.34, bodyMaterial, [side * 0.33, 0.87, 0], [0, 0, side * -0.05], `lowerArm${suffix}`);
    joint(0.062, [side * 0.35, 0.67, 0], `hand${suffix}`);

    joint(0.085, [side * 0.105, 0.76, 0], `hip${suffix}`);
    cylinder(0.09, 0.105, 0.38, bodyMaterial, [side * 0.105, 0.56, 0], null, `upperLeg${suffix}`);
    joint(0.07, [side * 0.105, 0.35, 0], `knee${suffix}`);
    cylinder(0.065, 0.075, 0.3, bodyMaterial, [side * 0.105, 0.18, 0], null, `lowerLeg${suffix}`);
    addMesh(new THREE.BoxGeometry(0.15 * scale, 0.09 * scale, 0.26 * scale), jointMaterial, [side * 0.105, 0.045, 0.07], null, `foot${suffix}`);
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

  if (threeView.frameMeta) {
    const trackingTarget = renderState.items.find((item) => item.id === camera.trackingTargetId);
    const trackingLabel = trackingTarget ? ` · @${trackingTarget.name} 추적` : "";
    threeView.frameMeta.textContent = `${camera.focal}mm · H ${Number(camera.height ?? 1.6).toFixed(1)}m · P ${Math.round(camera.panDeg)}° · T ${Math.round(camera.tiltDeg)}°${trackingLabel}`;
  }

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
  const phi = clamp(orbit.phi, 0.28, 1.32);
  const x = Math.cos(orbit.theta) * Math.cos(phi) * radius;
  const y = Math.sin(phi) * radius + 2.4;
  const z = Math.sin(orbit.theta) * Math.cos(phi) * radius;
  threeView.camera.position.set(x, y, z);
  threeView.camera.lookAt(0, 0.15, 0);
}

function beginThreeDrag(event) {
  if (!threeView?.ready) return;
  const editor = threeEditMode === "view" ? null : pickThreeEditor(event);
  if (editor) {
    materializeEvaluatedViewForEditing();
    selected = editor;
    const sourceId = selectedSourceId();
    if (sourceId) {
      setActiveSource(sourceId);
      selectKeyForSource(sourceId);
    }
    const editItemId = editor.kind === "item" ? transformLeaderIdForItem(editor.id, state) : editor.id;
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
      startState: clone(state),
      startPoint: pointerStage,
      grabOffset: { x: pose.x - pointerStage.x, y: pose.y - pointerStage.y },
      changed: false,
    };
    threeView.canvas.setPointerCapture(event.pointerId);
    syncUi(false);
    renderThreeView(evaluatedViewState || state, true);
    return;
  }
  threeDrag = {
    kind: "orbit",
    pointerId: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    theta: threeView.orbit.theta,
    phi: threeView.orbit.phi,
  };
  threeView.canvas.setPointerCapture(event.pointerId);
}

function updateThreeDrag(event) {
  if (!threeDrag || event.pointerId !== threeDrag.pointerId || !threeView?.ready) return;
  if (threeDrag.kind === "edit") {
    updateThreeEditorDrag(event);
    return;
  }
  const dx = event.clientX - threeDrag.x;
  const dy = event.clientY - threeDrag.y;
  threeView.orbit.theta = threeDrag.theta - dx * 0.0024;
  threeView.orbit.phi = clamp(threeDrag.phi + dy * 0.0016, 0.3, 1.18);
  renderThreeView(threeView.lastState || state, true);
}

function endThreeDrag(event) {
  if (!threeDrag || event.pointerId !== threeDrag.pointerId) return;
  const didEdit = threeDrag.kind === "edit" && threeDrag.changed;
  threeView?.canvas.releasePointerCapture?.(event.pointerId);
  threeDrag = null;
  if (didEdit) commit();
}

function zoomThreeView(event) {
  if (!threeView?.ready) return;
  event.preventDefault();
  threeView.orbit.radius = clamp(threeView.orbit.radius + event.deltaY * 0.004, 8, 26);
  renderThreeView(threeView.lastState || state, true);
}

function pickThreeEditor(event) {
  const pointer = threePointer(event);
  if (!pointer || !threeView?.raycaster) return null;
  threeView.raycaster.setFromCamera(pointer, threeView.camera);
  const hits = threeView.raycaster.intersectObjects(threeView.world.children, true);
  for (const hit of hits) {
    let object = hit.object;
    while (object && object !== threeView.world) {
      if (object.userData?.editor) return clone(object.userData.editor);
      object = object.parent;
    }
  }
  return null;
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
    label.textContent = "선택: " + item.name;
  } else if (selected?.kind === "camera") {
    label.textContent = "선택: 카메라";
  } else {
    label.textContent = "대상을 선택하세요";
  }
}

function drawMotionPaths(renderState, rect) {
  const keyframes = sortKeyframes(renderState.motion?.keyframes || []);
  if (!keyframes.length) return;

  ctx.save();
  visibleSourceDefinitions(renderState).forEach((source) => {
    const keys = keyframes.filter((keyframe) => keyframe.source === source.id);
    if (!keys.length) return;
    if (keys.length > 1) {
      const sampled = sampleMotionPathPoses(renderState, source.id, keys).map((pose) => toCanvas(pose, rect));
      ctx.strokeStyle = hexToRgba(source.color, source.id === "camera" ? 0.58 : 0.48);
      ctx.lineWidth = 2;
      ctx.setLineDash(source.id === "camera" ? [3, 5] : [5, 6]);
      ctx.beginPath();
      sampled.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      ctx.stroke();
      ctx.setLineDash([]);
    }
    keys.forEach((keyframe, index) => {
      drawPathOrderBadge(
        toCanvas(keyframe.pose, rect),
        index + 1,
        source.color,
        keyframe.id === renderState.motion?.selectedKeyId,
        rect,
      );
    });
  });
  drawSelectedFreeCurveHandle(renderState, keyframes, rect);
  drawPathSnapGuide(rect);
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

function drawGrid(rect) {
  const cols = 16;
  const rows = 9;
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

  if (renderState.showNames && isActive && !(clean && renderState.cleanExport)) {
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
  ctx.fillText(
    `${renderState.aspect} · 배우 ${actors} · 소품 ${props} · ${renderState.camera.focal}mm · H ${Number(renderState.camera.height ?? 1.6).toFixed(1)}m · P ${Math.round(renderState.camera.panDeg)}° · T ${Math.round(renderState.camera.tiltDeg)}°`,
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
  const press = {
    keyframeId: hit.keyframe.id,
    pointerId: event.pointerId,
    point,
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
  curveHandleDrag = { keyframeId: hit.keyframeId, pointerId: event.pointerId, changed: false };
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

canvas.addEventListener("pointerdown", (event) => {
  syncPlayheadFromTimeInput();
  const point = pointerPoint(event);
  const curveHandle = hitTestFreeCurveHandle(point);
  if (curveHandle) {
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
    materializeEvaluatedViewForEditing();
    selected = hit;
    const sourceId = selectedSourceId();
    if (sourceId) {
      setActiveSource(sourceId);
      selectKeyForSource(sourceId);
    }
    drag = {
      selection: clone(hit),
      editItemId: hit.kind === "item" ? transformLeaderIdForItem(hit.id, state) : hit.id,
      startState: clone(state),
      pointerId: event.pointerId,
    };
    canvas.setPointerCapture(event.pointerId);
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

canvas.addEventListener("pointercancel", () => {
  if (keyBadgePress) clearTimeout(keyBadgePress.timer);
  keyBadgePress = null;
  keyBadgeDrag = null;
  curveHandleDrag = null;
  pathSnapGuide = null;
  drag = null;
  draw();
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
  const command = event.metaKey || event.ctrlKey;
  if (command && event.key.toLowerCase() === "s") {
    if (document.querySelector("dialog[open]")) notifyApp("열린 창을 닫은 뒤 프로젝트 저장을 준비하세요.");
    else exportJson();
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
  if (workspaceMode === "storyboard" && event.altKey && ["ArrowLeft", "ArrowRight"].includes(event.key)) {
    moveProjectCut(activeCutId, event.key === "ArrowLeft" ? -1 : 1);
    event.preventDefault();
    return;
  }
  if (workspaceMode === "blocking" && event.code === "Space") {
    preview ? stopPreview() : playPreview();
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

function syncUi(updateInputs = true) {
  $$("#viewButtons button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === viewMode);
  });
  $$("#aspectButtons button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.aspect === state.aspect);
  });
  $("#gridToggle").checked = state.showGrid;
  $("#namesToggle").checked = state.showNames;
  $("#cameraToggle").checked = state.showCamera;
  $("#cleanExportToggle").checked = state.cleanExport;
  $("#focalSlider").value = state.camera.focal;
  $("#focalValue").textContent = `${state.camera.focal}mm`;
  $("#cameraHeightSlider").value = state.camera.height;
  $("#cameraHeightValue").textContent = `${Number(state.camera.height).toFixed(1)}m`;
  $("#cameraPanSlider").value = state.camera.panDeg;
  $("#cameraPanValue").textContent = `${Math.round(state.camera.panDeg)}°`;
  $("#cameraTiltSlider").value = state.camera.tiltDeg;
  $("#cameraTiltValue").textContent = `${Math.round(state.camera.tiltDeg)}°`;
  $("#cameraPanSlider").disabled = Boolean(state.camera.trackingTargetId);
  $("#cameraTiltSlider").disabled = Boolean(state.camera.trackingTargetId);
  $$("#focalPresets button").forEach((button) => {
    button.classList.toggle("is-active", Number(button.dataset.focal) === Number(state.camera.focal));
  });
  $("#durationInput").value = state.motion.duration;
  $("#fpsInput").value = state.motion.fps;
  $("#keyTimeInput").max = MAX_TIMELINE_DURATION;
  $("#sceneTitle").value = state.sceneTitle;
  $("#sceneIntent").value = state.sceneIntent;
  $$("#timelineMode button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.timelineView === state.motion.timelineView);
  });
  $(".canvas-wrap").style.setProperty("--stage-ratio", aspectMap[state.aspect] || 16 / 9);
  renderReferenceControls(updateInputs);
  $$("[data-environment-preset]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.environmentPreset === state.spacePresetId);
  });

  renderObjectLists();
  renderTrackingTargetSelect(updateInputs);
  renderProperties(updateInputs);
  renderSourceSelect();
  renderKeyStatus(updateInputs);
  renderPrevisQuality();
  renderPipelineSteps();
  renderThreeEditControls();
  syncProjectChrome();
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
  projectSaveStatus = ["changed", "prepared", "saved"].includes(status) ? status : "changed";
  const element = $("#projectSaveState");
  if (!element) return;
  const labels = { changed: "변경됨", prepared: "저장 준비", saved: "저장 완료" };
  element.dataset.status = projectSaveStatus;
  element.lastChild.textContent = labels[projectSaveStatus];
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
  if (workspaceMode !== "blocking") setWorkspaceMode("blocking");
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
  stopPreview();
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

function hasUnsavedProjectChanges() {
  return projectSaveStatus !== "saved"
    && (history.length > 1 || projectContainsWork() || scenarioDraftHasChanges());
}

function confirmProjectReplacement(actionLabel) {
  const warning = hasUnsavedProjectChanges()
    ? "저장 완료되지 않은 변경이 있습니다. "
    : "";
  return confirm(`${warning}${actionLabel} 현재 프로젝트를 교체할까요?`);
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
  setProjectSaveStatus(projectSaveStatus);
}

function setWorkspaceMode(mode) {
  workspaceMode = mode === "storyboard" ? "storyboard" : "blocking";
  $("#storyboardScreen").hidden = workspaceMode !== "storyboard";
  syncProjectChrome();
  if (workspaceMode === "storyboard") {
    stopPreview();
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
  $$("#storyboardScopeSwitch button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.storyboardScope === storyboardScope);
  });
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
  const action = document.createElement("p");
  action.className = "storyboard-card-action";
  action.textContent = cut.action || "액션 설명 없음";
  const dialogue = document.createElement("p");
  dialogue.className = "storyboard-card-dialogue";
  dialogue.textContent = cut.dialogue ? `“${cut.dialogue.replace(/\n/g, " ")}”` : "대사 없음";
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
  body.append(title, action, dialogue, meta);
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
  $("#threeWrap").hidden = viewMode !== "3d";
  if (viewMode === "3d") {
    initThreeView();
    resizeThreeView();
    renderThreeView(state, true);
  }
  syncUi(false);
  draw();
}

function renderReferenceControls(updateInputs = true) {
  const reference = state.reference || sanitizeReference();
  const fileLabel = $("#videoFileLabel");
  const status = $("#referenceStatus");
  const actorCount = $("#traceActorCount");
  const precision = $("#analysisPrecision");
  const analyzeButton = $("#analyzeReferenceBtn");
  const clearButton = $("#clearReferenceBtn");
  const sourceInput = $("#referenceFile");
  const videoPreview = $("#referencePreview");
  const imagePreview = $("#referenceImagePreview");
  const previewWrap = $("#referencePreviewWrap");
  const overlayCanvas = $("#referenceOverlayCanvas");
  const frameBar = $("#referenceFrameBar");
  const range = $("#referenceRange");
  const rangeText = $("#referenceRangeText");
  const startButton = $("#setReferenceStartBtn");
  const endButton = $("#setReferenceEndBtn");
  const useFrameTimeButton = $("#useReferenceTimeBtn");
  const summary = $("#referenceAnalysisSummary");

  if (fileLabel) fileLabel.textContent = reference.name || "파일 선택";
  const isImage = reference.kind === "image";
  if (videoPreview) videoPreview.hidden = isImage;
  if (imagePreview) imagePreview.hidden = !isImage;
  if (actorCount && (updateInputs || document.activeElement !== actorCount)) {
    actorCount.value = String(reference.analysis?.actorCount || 1);
  }
  if (precision && (updateInputs || document.activeElement !== precision)) {
    precision.value = reference.precision || "detailed";
  }
  if (actorCount) actorCount.disabled = referenceAnalysisBusy;
  if (precision) precision.disabled = referenceAnalysisBusy;
  if (sourceInput) sourceInput.disabled = referenceAnalysisBusy;
  if (previewWrap) previewWrap.hidden = !referenceClipBlob;
  if (overlayCanvas) overlayCanvas.hidden = isImage || !referenceClipBlob || !reference.showOverlay || !referenceAnalysisCache || reference.analysis?.status !== "ready";
  if (frameBar) frameBar.hidden = !referenceClipBlob || isImage;
  if (range) range.hidden = !referenceClipBlob || isImage;
  if (rangeText) rangeText.textContent = reference.start.toFixed(1) + "s - " + reference.end.toFixed(1) + "s";
  if (startButton) startButton.disabled = !referenceClipBlob || referenceAnalysisBusy;
  if (endButton) endButton.disabled = !referenceClipBlob || referenceAnalysisBusy;
  if (useFrameTimeButton) useFrameTimeButton.disabled = !referenceClipBlob || referenceAnalysisBusy;
  updateReferenceFrameTime();
  if (analyzeButton) {
    analyzeButton.disabled = !referenceClipBlob || referenceAnalysisBusy;
    analyzeButton.textContent = referenceAnalysisBusy ? "읽는 중..." : isImage ? "3D 배치 초안 만들기" : "동선 초안 만들기";
  }
  if (clearButton) clearButton.disabled = referenceAnalysisBusy || (!referenceClipBlob && !reference.name);
  renderReferenceCalibrationControls(reference, updateInputs);

  if (status) {
    if (referenceAnalysisBusy) {
      status.textContent = referenceAnalysisStage || "장면의 움직임과 시간 리듬을 읽고 있습니다...";
    } else if (!reference.name) {
      status.textContent = "영상은 동선 키를, 이미지는 3D 배치 초안을 만듭니다.";
    } else if (reference.analysis?.status === "ready") {
      const trackingLabel = reference.analysis.tracking === "vision"
        ? "인물 추적 " + reference.analysis.detectedFrames + "프레임"
        : "움직임 추정";
      const readyMessage = isImage
        ? reference.name + " · 배우 " + reference.analysis.detectedActorCount + "명 · 오브젝트 " + reference.analysis.detectedObjectCount + "개 배치됨 · 3D에서 검토하세요."
        : reference.name + " · " + reference.duration.toFixed(1) + "초 · " + trackingLabel + " · 키 " + reference.analysis.keyCount + "개 생성됨 · 2D/3D에서 검토하세요.";
      status.textContent = referenceAnalysisMessage ? `${readyMessage} ${referenceAnalysisMessage}` : readyMessage;
    } else if (referenceAnalysisMessage) {
      status.textContent = referenceAnalysisMessage;
    } else if (!referenceClipBlob) {
      status.textContent = reference.name + " · 원본 영상을 다시 선택하면 새 초안을 만들 수 있습니다.";
    } else {
      status.textContent = isImage ? reference.name + " · 이미지 준비됨" : reference.name + " · " + reference.duration.toFixed(1) + "초 · 준비됨";
    }
  }

  if (summary) {
    const ready = reference.analysis?.status === "ready";
    summary.hidden = !ready;
    if (ready) {
      $("#cameraMotionLabel").textContent = isImage ? "3D 배치" : cameraMotionLabels[reference.analysis.cameraMotionType] || "카메라";
      $("#cameraConfidenceValue").textContent = Math.round(isImage ? reference.analysis.mappingConfidence : reference.analysis.cameraConfidence) + "%";
      $("#actorAnalysisScore").textContent = Math.round(reference.analysis.actorConfidence) + "%";
      $("#sceneCutCount").textContent = Math.round(reference.analysis.sceneCuts) + "회";
      const notes = [];
      if (reference.analysis.sceneCuts) {
        const cutList = (reference.analysis.cutTimes || []).map((time) => Number(time).toFixed(1) + "s").join(", ");
        notes.push(`샷 ${reference.analysis.sceneCuts + 1}개${cutList ? ` · 컷 ${cutList}` : ""}.`);
      }
      if (reference.analysis.cameraConfidence < 55) notes.push("카메라 경로는 수동 보정이 필요할 수 있습니다.");
      if (reference.analysis.cameraJitter > 0.48) notes.push("핸드헬드 흔들림이 감지되어 정리 강도를 조절할 수 있습니다.");
      if (reference.analysis.actorConfidence < 55) notes.push("가려진 배우의 위치를 2D 또는 3D에서 확인하세요.");
      if (reference.analysis.mappingConfidence < 45) notes.push("3D 깊이 추정 신뢰도가 낮아 위치 보정이 필요할 수 있습니다.");
      if (!notes.length) notes.push(reference.analysis.sampleCount + "개 프레임을 비교해 안정적인 초안을 만들었습니다.");
      $("#referenceAnalysisNote").textContent = notes.join(" ");
    }
  }
  drawReferenceOverlay();
}

function renderReferenceCalibrationControls(reference, updateInputs = true) {
  const calibration = reference.calibration || sanitizeReferenceCalibration();
  const controls = [
    ["#calibrationLateralSlider", calibration.lateralScale],
    ["#calibrationDepthSlider", calibration.depthScale],
    ["#calibrationSizeDepthSlider", calibration.sizeDepthWeight],
    ["#calibrationCameraGainSlider", calibration.cameraGain],
    ["#calibrationStabilizationSlider", calibration.stabilizationStrength],
  ];
  controls.forEach(([selector, value]) => {
    const input = $(selector);
    if (input && (updateInputs || document.activeElement !== input)) input.value = String(value);
    if (input) input.disabled = referenceAnalysisBusy;
  });
  $("#referenceOverlayToggle").checked = reference.showOverlay !== false;
  $("#calibrationAnchorToggle").checked = calibration.anchorToCurrent !== false;
  $("#calibrationMirrorToggle").checked = calibration.mirrorX;
  $("#calibrationCameraInterpretation").value = calibration.cameraInterpretation;
  $("#referenceOverlayToggle").disabled = referenceAnalysisBusy;
  $("#calibrationAnchorToggle").disabled = referenceAnalysisBusy;
  $("#calibrationMirrorToggle").disabled = referenceAnalysisBusy;
  $("#calibrationCameraInterpretation").disabled = referenceAnalysisBusy;
  $("#resetReferenceCalibrationBtn").disabled = referenceAnalysisBusy;
  $("#calibrationLateralValue").textContent = Math.round(calibration.lateralScale * 100) + "%";
  $("#calibrationDepthValue").textContent = Math.round(calibration.depthScale * 100) + "%";
  $("#calibrationSizeDepthValue").textContent = Math.round(calibration.sizeDepthWeight * 100) + "%";
  $("#calibrationCameraGainValue").textContent = Math.round(calibration.cameraGain * 100) + "%";
  $("#calibrationStabilizationValue").textContent = Math.round(calibration.stabilizationStrength * 100) + "%";
  $$("#calibrationRotation button").forEach((button) => {
    button.disabled = referenceAnalysisBusy;
    button.classList.toggle("is-active", Number(button.dataset.calibrationRotation) === calibration.rotation);
  });
}

function updateReferenceFrameTime() {
  const video = $("#referencePreview");
  const label = $("#referenceFrameTime");
  if (!video || !label) return;
  const current = Number.isFinite(video.currentTime) ? video.currentTime : 0;
  const duration = Number.isFinite(video.duration) ? video.duration : 0;
  label.textContent = current.toFixed(1) + "s" + (duration ? " / " + duration.toFixed(1) + "s" : "");
}

function drawReferenceOverlay() {
  const canvas = $("#referenceOverlayCanvas");
  const video = $("#referencePreview");
  const cache = referenceAnalysisCache;
  if (!canvas || !video) return;
  if (!cache || state.reference.showOverlay === false || !referenceClipBlob || state.reference.analysis?.status !== "ready") {
    canvas.hidden = true;
    return;
  }
  const width = video.clientWidth;
  const height = video.clientHeight;
  if (width < 2 || height < 2) return;
  canvas.hidden = false;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const pixelWidth = Math.max(1, Math.round(width * ratio));
  const pixelHeight = Math.max(1, Math.round(height * ratio));
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  const context = canvas.getContext("2d");
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);
  const samples = cache.samples || [];
  if (!samples.length) return;
  const currentTime = Number.isFinite(video.currentTime) ? video.currentTime : samples[0].sourceTime;
  const sampleIndex = samples.reduce((bestIndex, sample, index) => (
    Math.abs(sample.sourceTime - currentTime) < Math.abs(samples[bestIndex].sourceTime - currentTime) ? index : bestIndex
  ), 0);
  const sample = samples[sampleIndex];

  (cache.screenTracks || []).forEach((track, actorIndex) => {
    const actor = cache.actors?.[actorIndex] || {};
    const color = actor.color || colors[actorIndex % colors.length];
    const pose = track[sampleIndex];
    if (!pose) return;
    let start = Math.max(0, sampleIndex - 18);
    while (start < sampleIndex && track[start]?.shot !== pose.shot) start += 1;
    context.save();
    context.strokeStyle = color;
    context.lineWidth = 2;
    context.globalAlpha = 0.78;
    context.beginPath();
    for (let index = start; index <= sampleIndex; index += 1) {
      const pose = track[index];
      if (!pose) continue;
      const x = pose.x * width;
      const y = pose.y * height;
      if (index === start) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.stroke();
    context.restore();

    const footX = pose.x * width;
    const footY = pose.y * height;
    const boxHeight = clamp(Number(pose.size || 0.24) * height, 18, height * 0.9);
    const boxWidth = clamp(Number(pose.width || pose.size * 0.42 || 0.12) * width, 12, width * 0.55);
    const left = clamp(footX - boxWidth / 2, 1, Math.max(1, width - boxWidth - 1));
    const top = clamp(footY - boxHeight, 1, Math.max(1, height - boxHeight - 1));
    context.save();
    context.strokeStyle = color;
    context.fillStyle = color;
    context.lineWidth = pose.observed ? 2 : 1;
    if (!pose.observed) context.setLineDash([5, 4]);
    context.strokeRect(left, top, boxWidth, boxHeight);
    context.setLineDash([]);
    context.beginPath();
    context.arc(footX, footY, 4, 0, Math.PI * 2);
    context.fill();
    const confidence = pose.observed && pose.source === "vision" ? " " + Math.round((pose.score || 0) * 100) + "%" : " 추정";
    const rawLabel = (actor.name || "배우 " + (actorIndex + 1)) + confidence;
    context.font = "700 11px system-ui, sans-serif";
    const label = fitReferenceOverlayText(context, rawLabel, Math.max(20, width - left - 12));
    const labelWidth = context.measureText(label).width + 10;
    context.fillStyle = "rgba(7, 10, 11, 0.82)";
    context.fillRect(left, Math.max(1, top - 19), labelWidth, 17);
    context.fillStyle = color;
    context.fillText(label, left + 5, Math.max(13, top - 6));
    context.restore();
  });

  const movement = sample.cameraMotion || {};
  const centerX = width * 0.5;
  const centerY = height * 0.18;
  const cameraX = centerX - Number(movement.dx || 0) * width * 5;
  const cameraY = centerY - Number(movement.dy || 0) * height * 5;
  drawReferenceArrow(context, centerX, centerY, cameraX, cameraY, "#71b8ff");
  const rawMovementLabel = movement.cut
    ? "장면 전환"
    : (cameraMotionLabels[cache.cameraProfile?.type] || "카메라") + " · " + Math.round(Math.hypot(movement.dx || 0, movement.dy || 0) * 1000) / 10 + "% · " + Math.round((movement.confidence || 0) * 100) + "%";
  context.font = "700 11px system-ui, sans-serif";
  const currentIsKey = cache.selectedIndexes?.includes(sampleIndex);
  const movementLabel = fitReferenceOverlayText(context, rawMovementLabel, Math.max(40, currentIsKey ? width * 0.44 : width - 26));
  const tagWidth = context.measureText(movementLabel).width + 12;
  context.fillStyle = movement.cut ? "rgba(255, 98, 98, 0.92)" : "rgba(8, 15, 19, 0.8)";
  context.fillRect(7, 7, tagWidth, 20);
  context.fillStyle = movement.cut ? "#111" : "#b9dfff";
  context.fillText(movementLabel, 13, 21);

  if (currentIsKey) {
    context.font = "800 11px system-ui, sans-serif";
    const keyLabel = fitReferenceOverlayText(context, "생성 키 · " + sample.sourceTime.toFixed(1) + "s", Math.max(40, width * 0.5));
    const keyWidth = context.measureText(keyLabel).width + 12;
    context.fillStyle = "rgba(255, 107, 85, 0.9)";
    context.fillRect(width - keyWidth - 7, 7, keyWidth, 20);
    context.fillStyle = "#111";
    context.fillText(keyLabel, width - keyWidth - 1, 21);
  }
}

function fitReferenceOverlayText(context, text, maxWidth) {
  if (context.measureText(text).width <= maxWidth) return text;
  let fitted = String(text);
  while (fitted.length > 1 && context.measureText(fitted + "...").width > maxWidth) fitted = fitted.slice(0, -1);
  return fitted + "...";
}

function drawReferenceArrow(context, fromX, fromY, toX, toY, color) {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const length = Math.hypot(dx, dy);
  context.save();
  context.strokeStyle = color;
  context.fillStyle = color;
  context.lineWidth = 2;
  if (length < 3) {
    context.beginPath();
    context.arc(fromX, fromY, 3, 0, Math.PI * 2);
    context.fill();
    context.restore();
    return;
  }
  const angle = Math.atan2(dy, dx);
  context.beginPath();
  context.moveTo(fromX, fromY);
  context.lineTo(toX, toY);
  context.stroke();
  context.beginPath();
  context.moveTo(toX, toY);
  context.lineTo(toX - Math.cos(angle - 0.55) * 8, toY - Math.sin(angle - 0.55) * 8);
  context.lineTo(toX - Math.cos(angle + 0.55) * 8, toY - Math.sin(angle + 0.55) * 8);
  context.closePath();
  context.fill();
  context.restore();
}

function motionPrevisStatusText() {
  const imported = state.motionPrevis;
  if (!imported?.imported) return "모션 프리비즈 없음";
  const parts = ["모션 프리비즈 연결됨"];
  if (imported.sourceName) parts.push(imported.sourceName);
  if (imported.frameCount) parts.push(`포즈 ${imported.frameCount}프레임`);
  if (imported.cameraMoveFrames) parts.push(`카메라 ${imported.cameraMoveFrames}프레임`);
  if (imported.qualityReport?.score != null) parts.push(`점수 ${imported.qualityReport.score}`);
  return parts.join(" · ");
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

function setReferenceClip(file) {
  referenceAnalysisGeneration += 1;
  const previousReferenceId = state.reference?.id;
  if (previousReferenceId) removeReferenceGeneratedData(previousReferenceId);
  if (referenceClipUrl) URL.revokeObjectURL(referenceClipUrl);
  referenceClipBlob = file;
  referenceClipUrl = file ? URL.createObjectURL(file) : "";
  referenceAnalysisMessage = "";
  referenceAnalysisStage = "";
  referenceAnalysisCache = null;

  const video = $("#referencePreview");
  const image = $("#referenceImagePreview");
  $("#referencePreviewWrap").hidden = !file;
  video.pause();
  video.removeAttribute("src");
  video.load();
  image.removeAttribute("src");

  if (!file) {
    state.reference = sanitizeReference({
      ...state.reference,
      name: "",
      id: "",
      kind: "none",
      type: "",
      size: 0,
      duration: 0,
      start: 0,
      end: 0,
      analysis: { status: "idle", keyCount: 0, actorCount: state.reference.analysis?.actorCount || 1, motionScore: 0 },
    });
    commit();
    return;
  }

  state.reference = sanitizeReference({
    ...state.reference,
    id: uid(),
    kind: file.type.startsWith("image/") ? "image" : "video",
    name: file.name,
    type: file.type,
    size: file.size,
    analysis: {
      status: "idle",
      keyCount: 0,
      actorCount: state.reference.analysis?.actorCount || 1,
      motionScore: 0,
    },
  });
  if (state.reference.kind === "image") {
    image.src = referenceClipUrl;
    image.onload = () => {
      state.reference = sanitizeReference({
        ...state.reference,
        duration: 0,
        start: 0,
        end: 0,
        analysis: { ...state.reference.analysis, status: "idle", keyCount: 0, motionScore: 0 },
      });
      commit();
    };
    commit();
    return;
  }
  video.src = referenceClipUrl;
  video.onloadedmetadata = () => {
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    state.reference = sanitizeReference({
      ...state.reference,
      duration,
      start: 0,
      end: duration,
      analysis: { ...state.reference.analysis, status: "idle", keyCount: 0, motionScore: 0 },
    });
    commit();
  };
  commit();
}

function clearReferenceClipRuntime() {
  referenceAnalysisGeneration += 1;
  if (referenceClipUrl) URL.revokeObjectURL(referenceClipUrl);
  referenceClipBlob = null;
  referenceClipUrl = "";
  referenceAnalysisCache = null;
  referenceAnalysisMessage = "";
  referenceAnalysisStage = "";
  const video = $("#referencePreview");
  const image = $("#referenceImagePreview");
  video.pause();
  video.removeAttribute("src");
  video.load();
  image?.removeAttribute("src");
  $("#referencePreviewWrap").hidden = true;
  $("#referenceOverlayCanvas").hidden = true;
}

async function createVideoDraft() {
  const video = $("#referencePreview");
  if (referenceAnalysisBusy || !referenceClipBlob || !video) return;
  if (!Number.isFinite(video.duration) || video.duration <= 0) {
    referenceAnalysisMessage = "영상을 읽은 뒤 다시 초안 만들기를 눌러주세요.";
    syncUi(false);
    return;
  }
  const beforeDraft = snapshot();
  const analysisReferenceId = state.reference.id;
  const analysisGeneration = referenceAnalysisGeneration;
  let buildStarted = false;

  referenceAnalysisBusy = true;
  referenceAnalysisMessage = "";
  referenceAnalysisStage = "영상 프레임을 읽고 있습니다...";
  referenceAnalysisCache = null;
  state.reference.analysis = {
    ...state.reference.analysis,
    status: "working",
  };
  syncUi(false);

  try {
    const requestedActorCount = clamp(Number($("#traceActorCount")?.value || 1), 1, 8);
    const samples = await sampleReferenceVideo(video, (completed, total) => {
      referenceAnalysisStage = "영상 프레임을 읽고 있습니다... " + completed + "/" + total;
      syncUi(false);
    });
    assertReferenceAnalysisCurrent(analysisReferenceId, analysisGeneration, "video");
    if (samples.length < 2) throw new Error("영상에서 충분한 장면을 읽지 못했습니다.");
    referenceAnalysisStage = "영상 안에서 인물을 찾고 있습니다...";
    syncUi(false);
    const tracking = await attachPersonDetections(samples, (completed, total) => {
      referenceAnalysisStage = "인물 위치를 읽고 있습니다... " + completed + "/" + total;
      syncUi(false);
    });
    assertReferenceAnalysisCurrent(analysisReferenceId, analysisGeneration, "video");

    const actorCount = Math.max(requestedActorCount, inferSustainedActorCount(samples, 1));
    tracking.detectedActorCount = actorCount;
    if ($("#traceActorCount")) $("#traceActorCount").value = String(Math.min(actorCount, 8));

    buildStarted = true;
    const draft = buildVideoDraft(samples, actorCount, tracking);
    if (!draft.entries.length) throw new Error("움직임 초안을 만들지 못했습니다.");

    const appliedDraft = applyVideoDraft(draft, actorCount);
    referenceAnalysisCache = draft.preview;
    state.reference = sanitizeReference({
      ...state.reference,
      analysis: {
        status: "ready",
        keyCount: appliedDraft.temporalKeyCount,
        actorCount,
        motionScore: draft.motionScore,
        tracking: tracking.mode,
        detectedFrames: tracking.detectedFrames,
        sampleCount: samples.length,
        cameraConfidence: draft.cameraConfidence,
        cameraMotionType: draft.cameraProfile.type,
        cameraPan: draft.cameraProfile.pan,
        cameraZoom: draft.cameraProfile.zoom,
        cameraJitter: draft.cameraProfile.jitter,
        actorConfidence: draft.actorConfidence,
        mappingConfidence: draft.mappingConfidence,
        detectedActorCount: actorCount,
        sceneCuts: draft.sceneCuts,
        cutTimes: draft.cutTimes,
      },
    });
    const minimumVisionFrames = Math.max(2, Math.ceil(samples.length * 0.12));
    const analysisMessages = [];
    if (tracking.warning) analysisMessages.push(tracking.warning);
    else if (tracking.detectedFrames < minimumVisionFrames) {
      analysisMessages.push("인물 감지가 충분하지 않아 화면 움직임을 함께 사용했습니다. 배우 동선을 2D/3D에서 확인하세요.");
    }
    if (appliedDraft.collisionCount) {
      analysisMessages.push(`기존 수동 키와 겹친 ${appliedDraft.collisionCount}개 위치는 수동 키를 보존했습니다.`);
    }
    referenceAnalysisMessage = analysisMessages.join(" ");
    commit();
    scrubToTime(0);
  } catch (error) {
    if (error?.code === "STALE_REFERENCE") return;
    if (buildStarted) {
      state = JSON.parse(beforeDraft);
      sanitizeState();
    }
    state.reference.analysis = {
      ...state.reference.analysis,
      status: "review",
    };
    referenceAnalysisMessage = error instanceof Error ? error.message : "영상 초안을 만들지 못했습니다.";
    syncUi(false);
  } finally {
    referenceAnalysisBusy = false;
    referenceAnalysisStage = "";
    syncUi(false);
    draw();
  }
}

async function createReferenceDraft() {
  if (state.reference.kind === "image") {
    await createImageReferenceDraft();
    return;
  }
  await createVideoDraft();
}

async function createImageReferenceDraft() {
  const image = $("#referenceImagePreview");
  if (referenceAnalysisBusy || !referenceClipBlob || !image?.naturalWidth) return;
  referenceAnalysisBusy = true;
  const analysisReferenceId = state.reference.id;
  const analysisGeneration = referenceAnalysisGeneration;
  referenceAnalysisMessage = "";
  referenceAnalysisStage = "이미지에서 인물과 오브젝트를 찾고 있습니다...";
  state.reference.analysis = { ...state.reference.analysis, status: "working" };
  syncUi(false);

  try {
    const detector = await getPersonDetector();
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 960 / Math.max(image.naturalWidth, image.naturalHeight));
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
    const predictions = await detector.detect(canvas, 30, 0.3);
    assertReferenceAnalysisCurrent(analysisReferenceId, analysisGeneration, "image");
    const people = predictions
      .filter((prediction) => prediction.class === "person" && prediction.score >= 0.35)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
    const objects = predictions
      .filter((prediction) => referenceObjectLabels[prediction.class] && prediction.score >= 0.38)
      .sort((a, b) => b.score - a.score)
      .slice(0, 16);
    const referenceId = state.reference.id || (state.reference.id = uid());
    removeReferenceGeneratedItems(referenceId);
    const placements = [];
    people.forEach((prediction, index) => {
      const placement = predictionToStagePlacement(prediction, canvas.width, canvas.height);
      placements.push(placement);
      state.items.push({
        id: uid(),
        type: "actor",
        name: `배우 ${index + 1}`,
        x: placement.x,
        y: placement.y,
        size: clamp(0.72 + prediction.bbox[3] / canvas.height, 0.72, 1.55),
        color: colors[index % colors.length],
        shape: "circle",
        facing: cameraHeadingDeg(state.camera),
        provenance: { type: "reference", referenceId, detectionId: `image-person-${index}` },
        detectionConfidence: prediction.score,
      });
    });
    objects.forEach((prediction, index) => {
      const placement = predictionToStagePlacement(prediction, canvas.width, canvas.height);
      placements.push(placement);
      state.items.push({
        id: uid(),
        type: "prop",
        name: referenceObjectLabels[prediction.class],
        x: placement.x,
        y: placement.y,
        size: clamp(0.65 + Math.max(prediction.bbox[2] / canvas.width, prediction.bbox[3] / canvas.height) * 1.8, 0.65, 1.8),
        color: colors[(people.length + index + 3) % colors.length],
        shape: referenceObjectShape(prediction.class),
        facing: 0,
        provenance: { type: "reference", referenceId, detectionId: `image-${prediction.class}-${index}` },
        detectionConfidence: prediction.score,
      });
    });
    const mappingConfidence = placements.length
      ? Math.round(placements.reduce((sum, entry) => sum + entry.confidence, 0) / placements.length * 100)
      : 0;
    state.reference.analysis = {
      ...state.reference.analysis,
      status: "ready",
      keyCount: 0,
      actorCount: Math.max(1, people.length),
      detectedActorCount: people.length,
      detectedObjectCount: objects.length,
      mappingConfidence,
      tracking: people.length ? "vision" : "motion",
      detectedFrames: people.length ? 1 : 0,
      sampleCount: 1,
      actorConfidence: people.length
        ? Math.round(people.reduce((sum, prediction) => sum + prediction.score, 0) / people.length * 100)
        : 0,
      cameraConfidence: 0,
      sceneCuts: 0,
      cutTimes: [],
    };
    state.motion.selectedKeyId = selectedKeyframeExists(state.motion.selectedKeyId) ? state.motion.selectedKeyId : null;
    referenceAnalysisMessage = placements.length
      ? "이미지 배치 초안이 만들어졌습니다. 단안 추정이므로 3D에서 깊이와 크기를 확인하세요."
      : "인물이나 지원되는 주요 오브젝트를 찾지 못했습니다.";
    commit();
  } catch (error) {
    if (error?.code === "STALE_REFERENCE") return;
    state.reference.analysis = { ...state.reference.analysis, status: "review" };
    referenceAnalysisMessage = error instanceof Error ? error.message : "이미지 배치 초안을 만들지 못했습니다.";
    syncUi(false);
  } finally {
    referenceAnalysisBusy = false;
    referenceAnalysisStage = "";
    syncUi(false);
    draw();
  }
}

function assertReferenceAnalysisCurrent(referenceId, generation, kind) {
  if (
    referenceAnalysisGeneration !== generation
    || state.reference.id !== referenceId
    || state.reference.kind !== kind
    || !referenceClipBlob
  ) {
    const error = new Error("취소된 레퍼런스 분석입니다.");
    error.code = "STALE_REFERENCE";
    throw error;
  }
}

const referenceObjectLabels = {
  chair: "의자",
  couch: "소파",
  "dining table": "테이블",
  bed: "침대",
  tv: "TV",
  laptop: "노트북",
  suitcase: "가방",
  backpack: "백팩",
  handbag: "핸드백",
  bottle: "병",
  cup: "컵",
  book: "책",
  "potted plant": "화분",
  car: "자동차",
  truck: "트럭",
  bus: "버스",
  bicycle: "자전거",
  motorcycle: "오토바이",
};

function predictionToStagePlacement(prediction, width, height) {
  const [left, top, boxWidth, boxHeight] = prediction.bbox || [0, 0, 0, 0];
  const screenX = clamp((left + boxWidth / 2) / Math.max(1, width), 0, 1);
  const screenY = clamp((top + boxHeight) / Math.max(1, height), 0, 1);
  const stageSize = stageWorldSize(state);
  const projected = projectScreenToStage3D(screenX, screenY, state.camera, {
    aspect: width / Math.max(1, height),
    stageWidth: stageSize.width,
    stageDepth: stageSize.depth,
  });
  if (projected.hit && projected.confidence > 0.08) return projected;
  return {
    x: clamp(0.08 + screenX * 0.84, 0.02, 0.98),
    y: clamp(0.12 + screenY * 0.72, 0.02, 0.98),
    confidence: 0.12,
    hit: false,
  };
}

function referenceObjectShape(className) {
  if (["bottle", "cup", "potted plant"].includes(className)) return "circle";
  if (className === "dining table") return "square";
  if (["car", "truck", "bus"].includes(className)) return "pill";
  return "diamond";
}

function removeReferenceGeneratedItems(referenceId) {
  const generatedIds = new Set(state.items
    .filter((item) => item.provenance?.type === "reference" && item.provenance.referenceId === referenceId)
    .map((item) => item.id));
  state.items = state.items.filter((item) => !generatedIds.has(item.id));
  state.motion.keyframes = state.motion.keyframes.filter((keyframe) => !generatedIds.has(keyframe.source));
}

function removeReferenceGeneratedData(referenceId) {
  removeReferenceGeneratedItems(referenceId);
  state.motion.keyframes = state.motion.keyframes.filter((keyframe) => !(
    keyframe.provenance?.type === "reference"
    && keyframe.provenance.referenceId === referenceId
  ));
}

async function sampleReferenceVideo(video, onProgress) {
  video.pause();
  const originalTime = Number.isFinite(video.currentTime) ? video.currentTime : 0;
  const sourceDuration = Math.max(0, Number(video.duration || state.reference.duration || 0));
  const rangeStart = clamp(Number(state.reference.start || 0), 0, sourceDuration);
  const rangeEnd = clamp(Number(state.reference.end || sourceDuration), rangeStart, sourceDuration);
  const rangeDuration = Math.max(0.25, rangeEnd - rangeStart);
  const detailed = state.reference.precision !== "fast";
  const sampleRate = detailed ? 4 : 1.15;
  const sampleCount = clamp(Math.round(rangeDuration * sampleRate) + 2, detailed ? 16 : 8, detailed ? 80 : 20);
  const sourceWidth = Math.max(1, Number(video.videoWidth || 16));
  const sourceHeight = Math.max(1, Number(video.videoHeight || 9));
  const sampleSize = fitFrameSize(sourceWidth, sourceHeight, detailed ? 240 : 112);
  const visionSize = fitFrameSize(sourceWidth, sourceHeight, detailed ? 512 : 320);
  const sampleCanvas = document.createElement("canvas");
  sampleCanvas.width = sampleSize.width;
  sampleCanvas.height = sampleSize.height;
  const sampleContext = sampleCanvas.getContext("2d", { willReadFrequently: true });
  const samples = [];

  for (let index = 0; index < sampleCount; index += 1) {
    const progress = sampleCount === 1 ? 0 : index / (sampleCount - 1);
    const time = Math.min(rangeEnd, rangeStart + progress * rangeDuration);
    await seekReferenceVideo(video, time);
    sampleContext.drawImage(video, 0, 0, sampleCanvas.width, sampleCanvas.height);
    const image = sampleContext.getImageData(0, 0, sampleCanvas.width, sampleCanvas.height);
    const visionFrame = document.createElement("canvas");
    visionFrame.width = visionSize.width;
    visionFrame.height = visionSize.height;
    const visionContext = visionFrame.getContext("2d", { willReadFrequently: false });
    if (visionContext) visionContext.drawImage(video, 0, 0, visionFrame.width, visionFrame.height);
    samples.push({
      sourceTime: time,
      progress,
      luma: frameLuminance(image.data),
      width: sampleCanvas.width,
      height: sampleCanvas.height,
      mean: meanLuminance(image.data),
      histogram: lumaHistogram(image.data),
      visionFrame,
      people: [],
    });
    onProgress?.(index + 1, sampleCount);
  }

  samples.forEach((sample, index) => {
    const previous = samples[index - 1] || null;
    sample.visual = visualCenter(sample.luma, sample.width, sample.height);
    sample.cameraMotion = previous
      ? estimateGlobalFrameMotion(previous, sample)
      : { dx: 0, dy: 0, scale: 1, confidence: 1, residual: 0, cut: false };
    sample.motion = previous
      ? compensatedMotionFeatures(previous, sample, sample.cameraMotion)
      : { x: 0.5, y: 0.5, energy: 0, regions: [] };
  });
  const stabilization = accumulateCameraTransforms(samples.map((sample) => sample.cameraMotion));
  samples.forEach((sample, index) => {
    sample.stabilization = stabilization[index];
  });
  await seekReferenceVideo(video, originalTime);
  return samples;
}

async function attachPersonDetections(samples, onProgress) {
  try {
    const detector = await getPersonDetector();
    const detailed = state.reference.precision !== "fast";
    const scoreThreshold = detailed ? 0.35 : 0.44;
    let detectedFrames = 0;
    for (let index = 0; index < samples.length; index += 1) {
      const sample = samples[index];
      const predictions = await detector.detect(sample.visionFrame, detailed ? 20 : 12, scoreThreshold);
      sample.people = predictions
        .filter((prediction) => prediction.class === "person" && prediction.score >= scoreThreshold)
        .map((prediction) => predictionToPerson(prediction, sample.visionFrame.width, sample.visionFrame.height))
        .filter(Boolean)
        .sort((a, b) => b.score - a.score)
        .slice(0, 8);
      if (sample.people.length) detectedFrames += 1;
      sample.visionFrame.width = 1;
      sample.visionFrame.height = 1;
      sample.visionFrame = null;
      onProgress?.(index + 1, samples.length);
    }
    const minimumVisionFrames = Math.max(2, Math.ceil(samples.length * 0.12));
    return {
      mode: detectedFrames >= minimumVisionFrames ? "vision" : "motion",
      detectedFrames,
      warning: detectedFrames && detectedFrames < minimumVisionFrames
        ? `인물을 ${samples.length}개 중 ${detectedFrames}개 프레임에서만 찾았습니다.`
        : "",
    };
  } catch (error) {
    samples.forEach((sample) => {
      if (sample.visionFrame) {
        sample.visionFrame.width = 1;
        sample.visionFrame.height = 1;
        sample.visionFrame = null;
      }
      sample.people = [];
    });
    return {
      mode: "motion",
      detectedFrames: 0,
      warning: `인물 추적을 사용할 수 없어 움직임 분석으로 전환했습니다${error?.message ? `: ${error.message}` : "."}`,
    };
  }
}

function predictionToPerson(prediction, width, height) {
  const box = Array.isArray(prediction.bbox) ? prediction.bbox : [];
  if (box.length !== 4 || !width || !height) return null;
  const [left, top, boxWidth, boxHeight] = box;
  return {
    x: clamp((left + boxWidth / 2) / width, 0, 1),
    y: clamp((top + boxHeight / 2) / height, 0, 1),
    footY: clamp((top + boxHeight) / height, 0, 1),
    width: clamp(boxWidth / width, 0, 1),
    size: clamp(boxHeight / height, 0, 1),
    score: clamp(Number(prediction.score || 0), 0, 1),
  };
}

async function getPersonDetector() {
  const base = state.reference.precision === "fast" ? "lite_mobilenet_v2" : "mobilenet_v2";
  if (personDetectors[base]) return personDetectors[base];
  if (!personDetectorPromises[base]) {
    personDetectorPromises[base] = (async () => {
      await loadScriptOnce("https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js", "tf");
      await loadScriptOnce("https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js", "cocoSsd");
      if (!window.cocoSsd?.load) throw new Error("인물 추적 모듈을 불러오지 못했습니다.");
      personDetectors[base] = await window.cocoSsd.load({ base });
      return personDetectors[base];
    })().catch((error) => {
      personDetectorPromises[base] = null;
      throw error;
    });
  }
  return personDetectorPromises[base];
}

function loadScriptOnce(src, globalName) {
  if (window[globalName]) return Promise.resolve(window[globalName]);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-previs-library="' + globalName + '"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(window[globalName]), { once: true });
      existing.addEventListener("error", () => reject(new Error("인물 추적 모듈을 불러오지 못했습니다.")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.previsLibrary = globalName;
    script.onload = () => window[globalName]
      ? resolve(window[globalName])
      : reject(new Error("인물 추적 모듈을 불러오지 못했습니다."));
    script.onerror = () => {
      script.remove();
      reject(new Error("인물 추적 모듈을 불러오지 못했습니다."));
    };
    document.head.append(script);
  });
}

function seekReferenceVideo(video, time) {
  return new Promise((resolve, reject) => {
    const target = clamp(Number(time || 0), 0, Number(video.duration || time || 0));
    let settled = false;
    let presentationRequested = false;
    let frameFallback = null;
    const finish = () => {
      if (settled || presentationRequested) return;
      presentationRequested = true;
      video.removeEventListener("seeked", finish);
      const presented = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        clearTimeout(frameFallback);
        resolve();
      };
      if (typeof video.requestVideoFrameCallback === "function") {
        video.requestVideoFrameCallback(presented);
        frameFallback = setTimeout(presented, 120);
      } else {
        requestAnimationFrame(() => requestAnimationFrame(presented));
      }
    };
    const fail = () => {
      if (settled) return;
      settled = true;
      video.removeEventListener("seeked", finish);
      clearTimeout(frameFallback);
      reject(new Error("영상 프레임을 불러오는 시간이 초과되었습니다."));
    };
    const timeout = setTimeout(fail, 5000);
    video.addEventListener("seeked", finish, { once: true });
    if (Math.abs(video.currentTime - target) < 0.01 && video.readyState >= 2) {
      requestAnimationFrame(finish);
      return;
    }
    video.currentTime = target;
  });
}

function frameLuminance(data) {
  const luma = new Float32Array(data.length / 4);
  for (let index = 0; index < luma.length; index += 1) {
    const offset = index * 4;
    luma[index] = data[offset] * 0.2126 + data[offset + 1] * 0.7152 + data[offset + 2] * 0.0722;
  }
  return luma;
}

function meanLuminance(data) {
  let total = 0;
  const pixels = Math.max(1, data.length / 4);
  for (let offset = 0; offset < data.length; offset += 4) {
    total += data[offset] * 0.2126 + data[offset + 1] * 0.7152 + data[offset + 2] * 0.0722;
  }
  return total / pixels;
}

function lumaHistogram(data) {
  const bins = new Float32Array(16);
  const pixels = Math.max(1, data.length / 4);
  for (let offset = 0; offset < data.length; offset += 4) {
    const value = data[offset] * 0.2126 + data[offset + 1] * 0.7152 + data[offset + 2] * 0.0722;
    bins[Math.min(15, Math.floor(value / 16))] += 1 / pixels;
  }
  return bins;
}

function visualCenter(luma, width, height) {
  let total = 0;
  let x = 0;
  let y = 0;
  for (let row = 0; row < height; row += 2) {
    for (let col = 0; col < width; col += 2) {
      const weight = Math.max(6, luma[row * width + col]);
      total += weight;
      x += col * weight;
      y += row * weight;
    }
  }
  return total
    ? { x: clamp(x / total / Math.max(1, width - 1), 0, 1), y: clamp(y / total / Math.max(1, height - 1), 0, 1) }
    : { x: 0.5, y: 0.5 };
}

function motionFeatures(previous, current, width, height) {
  const gridWidth = Math.floor(width / 2);
  const gridHeight = Math.floor(height / 2);
  const weights = new Float32Array(gridWidth * gridHeight);
  let total = 0;
  let x = 0;
  let y = 0;
  for (let row = 0; row < gridHeight; row += 1) {
    for (let col = 0; col < gridWidth; col += 1) {
      const sourceIndex = (row * 2) * width + col * 2;
      const difference = Math.abs(current[sourceIndex] - previous[sourceIndex]);
      const weight = difference > 18 ? difference - 18 : 0;
      weights[row * gridWidth + col] = weight;
      total += weight;
      x += col * weight;
      y += row * weight;
    }
  }
  const regions = findMotionRegions(weights, gridWidth, gridHeight);
  return {
    x: total ? clamp(x / total / Math.max(1, gridWidth - 1), 0, 1) : 0.5,
    y: total ? clamp(y / total / Math.max(1, gridHeight - 1), 0, 1) : 0.5,
    energy: clamp(total / Math.max(1, gridWidth * gridHeight * 72), 0, 1),
    regions,
  };
}

function buildVideoDraft(samples, actorCount, tracking = { mode: "motion", detectedFrames: 0 }, baseline = null) {
  if (samples.some((sample) => !sample.stabilization)) {
    const transforms = accumulateCameraTransforms(samples.map((sample) => sample.cameraMotion));
    samples.forEach((sample, index) => {
      sample.stabilization = transforms[index];
    });
  }
  const referenceId = state.reference.id || (state.reference.id = uid());
  const activeActors = ensureTraceActors(actorCount, { type: "reference", referenceId, detectionId: "video-actor" });
  const resolvedBaseline = {
    camera: clone(baseline?.camera || state.camera),
    actors: activeActors.map((actor, index) => {
      const saved = baseline?.actors?.find((entry) => entry.id === actor.id) || baseline?.actors?.[index];
      return saved ? { ...actor, ...clone(saved), id: actor.id } : clone(actor);
    }),
  };
  const planningActors = activeActors.map((actor, index) => {
    const saved = resolvedBaseline.actors?.find((entry) => entry.id === actor.id) || resolvedBaseline.actors?.[index];
    return saved ? { ...actor, ...clone(saved), id: actor.id } : clone(actor);
  });
  const actorTracking = buildActorTracks(samples, planningActors, tracking);
  const actorTracks = actorTracking.tracks;
  const startCamera = clone(resolvedBaseline.camera || state.camera);
  const cameraTrack = buildCameraTrack(samples, actorTracks, startCamera);
  const selectedIndexes = selectVideoDraftSamples(samples, cameraTrack, actorTracks);
  const rangeDuration = Math.max(0.25, Number(state.reference.end || state.reference.duration || 0) - Number(state.reference.start || 0));
  const duration = clamp(rangeDuration, 1, MAX_TIMELINE_DURATION);
  let shot = 1;
  const entries = selectedIndexes.map((sampleIndex, entryIndex) => {
    const sample = samples[sampleIndex];
    if (entryIndex && sample.cameraMotion?.cut) shot += 1;
    const actorPoses = actorTracks.map((track) => clone(track[sampleIndex]));
    return {
      time: Number((sample.progress * duration).toFixed(2)),
      camera: clone(cameraTrack[sampleIndex]),
      actorPoses,
      label: sample.cameraMotion?.cut ? "장면 " + shot + " 시작" : "영상 " + (entryIndex + 1),
      transition: sample.cameraMotion?.cut ? "cut" : "smooth",
    };
  });
  if (entries.length) entries[entries.length - 1].time = duration;
  const transitionSamples = samples.slice(1).filter((sample) => !sample.cameraMotion?.cut);
  const cameraConfidence = transitionSamples.length
    ? Math.round(transitionSamples.reduce((sum, sample) => sum + sample.cameraMotion.confidence, 0) / transitionSamples.length * 100)
    : 100;
  const cutTimes = entries.filter((entry) => entry.transition === "cut").map((entry) => entry.time);
  const sceneCuts = cutTimes.length;
  const cameraProfile = classifyCameraMotion(
    samples.map((sample) => sample.cameraMotion),
    samples.map((sample) => sample.motion?.energy || 0),
  );
  const motionSignal = samples.reduce((sum, sample) => {
    const cameraEnergy = Math.hypot(sample.cameraMotion?.dx || 0, sample.cameraMotion?.dy || 0) * 5;
    const zoomEnergy = Math.abs((sample.cameraMotion?.scale || 1) - 1) * 3;
    return sum + sample.motion.energy + cameraEnergy + zoomEnergy;
  }, 0) / Math.max(1, samples.length);
  return {
    duration,
    entries,
    motionScore: Math.round(clamp(motionSignal, 0, 1) * 100),
    cameraConfidence,
    cameraProfile,
    actorConfidence: actorTracking.confidence,
    mappingConfidence: actorTracking.mappingConfidence,
    sceneCuts,
    cutTimes,
    tracking,
    preview: {
      samples: samples.map(stripReferenceAnalysisSample),
      screenTracks: clone(actorTracking.screenTracks),
      cameraTrack: clone(cameraTrack),
      selectedIndexes: [...selectedIndexes],
      actors: activeActors.map((actor) => ({ id: actor.id, name: actor.name, color: actor.color })),
      baseline: clone(resolvedBaseline),
      actorCount,
      tracking: clone(tracking),
      cameraProfile: clone(cameraProfile),
    },
  };
}

function stripReferenceAnalysisSample(sample) {
  return {
    sourceTime: sample.sourceTime,
    progress: sample.progress,
    width: sample.width,
    height: sample.height,
    people: clone(sample.people || []),
    visual: clone(sample.visual || { x: 0.5, y: 0.5 }),
    cameraMotion: clone(sample.cameraMotion || { dx: 0, dy: 0, scale: 1, confidence: 0, cut: false }),
    stabilization: clone(sample.stabilization || { scale: 1, tx: 0, ty: 0, shot: 1, cut: false }),
    cameraSolve: clone(sample.cameraSolve || sample.stabilization || { scale: 1, tx: 0, ty: 0, shot: 1, cut: false }),
    motion: clone(sample.motion || { x: 0.5, y: 0.5, energy: 0, regions: [] }),
  };
}

function buildCameraTrack(samples, actorTracks, startCamera) {
  const calibration = state.reference.calibration || sanitizeReferenceCalibration();
  const rawTransforms = samples.map((sample) => sample.stabilization)
    .map((transform) => transform || { scale: 1, tx: 0, ty: 0, shot: 1, cut: false });
  const transforms = smoothCameraTransforms(rawTransforms, calibration.stabilizationStrength);
  const shotCompositions = buildShotCompositions(samples, transforms);
  const movementMix = cameraInterpretationMix[calibration.cameraInterpretation] ?? cameraInterpretationMix.balanced;
  const zoomMovementMix = calibration.cameraInterpretation === "movement"
    ? 0.7
    : calibration.cameraInterpretation === "rotation"
      ? 0.15
      : 0.4;
  let activeShot = transforms[0]?.shot || 1;
  let shotOffset = { x: 0, y: 0 };
  let shotAimOffset = { x: 0, y: 0 };
  let shotFocal = clamp(Number(startCamera.focal || 50), 24, 135);

  return samples.map((sample, index) => {
    const transform = transforms[index] || { scale: 1, tx: 0, ty: 0, shot: 1, cut: false };
    sample.cameraSolve = clone(transform);
    if (index === 0 || transform.shot !== activeShot) {
      activeShot = transform.shot;
      const composition = shotCompositions.get(activeShot) || { x: 0.5, footY: 0.7, size: 0.28 };
      shotOffset = calibratedReferenceDelta(
        (0.5 - composition.x) * 0.32,
        (composition.footY - 0.7) * 0.16,
        0,
        calibration,
      );
      shotAimOffset = calibratedReferenceDelta((0.5 - composition.x) * 0.2, 0, 0, calibration);
      shotFocal = clamp(Math.round(24 + composition.size * 112), 24, 135);
    }
    const actorPoses = actorTracks.map((track) => track[index]).filter(Boolean);
    const focus = averageActorPosition(actorPoses, startCamera);
    const zoomSignal = clamp((transform.scale - 1) * 0.82, -0.28, 0.35);
    const panDelta = calibratedReferenceDelta(-transform.tx, -transform.ty, 0, calibration);
    const solvedDelta = {
      x: panDelta.x + shotOffset.x,
      y: panDelta.y + shotOffset.y,
    };
    const focusDistance = Math.hypot(focus.x - startCamera.x, focus.y - startCamera.y) || 1;
    const dolly = zoomSignal * 0.18 * calibration.cameraGain * zoomMovementMix;
    const cameraX = startCamera.x
      + solvedDelta.x * calibration.cameraGain * movementMix
      + (focus.x - startCamera.x) / focusDistance * dolly;
    const cameraY = startCamera.y
      + solvedDelta.y * calibration.cameraGain * movementMix
      + (focus.y - startCamera.y) / focusDistance * dolly;
    const aimGain = calibration.cameraGain * (1 - movementMix) * 1.1;
    const targetX = focus.x + solvedDelta.x * aimGain + shotAimOffset.x;
    const targetY = focus.y + solvedDelta.y * aimGain + shotAimOffset.y;
    const actorSize = actorPoses.length
      ? actorPoses.reduce((sum, actor) => sum + Number(actor.size || 1), 0) / actorPoses.length
      : 1;
    const orientation = trackingOrientation(
      { type: "actor", x: targetX, y: targetY, size: actorSize },
      { ...startCamera, x: cameraX, y: cameraY },
      state,
    );
    const pose = sanitizeCameraPose({
      ...startCamera,
      x: cameraX,
      y: cameraY,
      panDeg: orientation.panDeg,
      tiltDeg: orientation.tiltDeg,
      focal: clamp(Math.round(shotFocal * (1 + zoomSignal * (1 - zoomMovementMix) * 0.9)), 18, 135),
      trackingTargetId: "",
    });
    return pose;
  });
}

function buildShotCompositions(samples, transforms) {
  const groups = new Map();
  samples.forEach((sample, index) => {
    const shot = transforms[index]?.shot || 1;
    if (!groups.has(shot)) {
      groups.set(shot, { people: 0, x: 0, footY: 0, size: 0, visuals: 0, visualX: 0, visualY: 0 });
    }
    const group = groups.get(shot);
    const people = sample.people || [];
    people.forEach((person) => {
      group.people += 1;
      group.x += Number(person.x ?? 0.5);
      group.footY += Number(person.footY ?? person.y ?? 0.7);
      group.size += Number(person.size || 0.28);
    });
    const visual = sample.visual || { x: 0.5, y: 0.6 };
    group.visuals += 1;
    group.visualX += Number(visual.x ?? 0.5);
    group.visualY += Number(visual.y ?? 0.6);
  });
  return new Map([...groups].map(([shot, group]) => [shot, group.people
    ? {
      x: group.x / group.people,
      footY: group.footY / group.people,
      size: group.size / group.people,
      hasPeople: true,
    }
    : {
      x: group.visualX / Math.max(1, group.visuals),
      footY: group.visualY / Math.max(1, group.visuals),
      size: 0.28,
      hasPeople: false,
    }]));
}

function calibratedReferenceDelta(screenX, screenY, sizeDelta = 0, calibration = state.reference.calibration) {
  return mapReferenceDelta(screenX, screenY, sizeDelta, sanitizeReferenceCalibration(calibration));
}

function selectVideoDraftSamples(samples, cameraTrack, actorTracks) {
  const baseMaxKeys = Math.min(samples.length, state.reference.precision === "fast" ? 9 : 20);
  const minKeys = Math.min(samples.length, state.reference.precision === "fast" ? 5 : 8);
  const selected = new Set([0, samples.length - 1]);
  samples.forEach((sample, index) => {
    if (!sample.cameraMotion?.cut) return;
    if (index > 0) selected.add(index - 1);
    selected.add(index);
  });
  const maxKeys = Math.max(baseMaxKeys, selected.size);

  while (selected.size < maxKeys) {
    const ordered = [...selected].sort((a, b) => a - b);
    let best = null;
    for (let segment = 0; segment < ordered.length - 1; segment += 1) {
      const start = ordered[segment];
      const end = ordered[segment + 1];
      for (let index = start + 1; index < end; index += 1) {
        const error = videoDraftDeviation(index, start, end, samples, cameraTrack, actorTracks);
        if (!best || error > best.error) best = { index, error };
      }
    }
    if (!best) break;
    if (selected.size >= minKeys && best.error < 0.075) break;
    selected.add(best.index);
  }

  while (selected.size < minKeys) {
    const ordered = [...selected].sort((a, b) => a - b);
    let largest = null;
    for (let index = 0; index < ordered.length - 1; index += 1) {
      const gap = ordered[index + 1] - ordered[index];
      if (gap > 1 && (!largest || gap > largest.gap)) largest = { start: ordered[index], gap };
    }
    if (!largest) break;
    selected.add(largest.start + Math.round(largest.gap / 2));
  }
  return [...selected].sort((a, b) => a - b);
}

function videoDraftDeviation(index, start, end, samples, cameraTrack, actorTracks) {
  const span = Math.max(0.001, samples[end].sourceTime - samples[start].sourceTime);
  const t = clamp((samples[index].sourceTime - samples[start].sourceTime) / span, 0, 1);
  const camera = cameraTrack[index];
  const expectedCamera = {
    x: lerp(cameraTrack[start].x, cameraTrack[end].x, t),
    y: lerp(cameraTrack[start].y, cameraTrack[end].y, t),
    aimX: lerp(cameraTrack[start].aimX, cameraTrack[end].aimX, t),
    aimY: lerp(cameraTrack[start].aimY, cameraTrack[end].aimY, t),
    focal: lerp(cameraTrack[start].focal, cameraTrack[end].focal, t),
  };
  let error = Math.hypot(camera.x - expectedCamera.x, camera.y - expectedCamera.y) * 2.8;
  error += Math.hypot(camera.aimX - expectedCamera.aimX, camera.aimY - expectedCamera.aimY) * 1.9;
  error += Math.abs(camera.focal - expectedCamera.focal) / 120;
  actorTracks.forEach((track) => {
    const expectedX = lerp(track[start].x, track[end].x, t);
    const expectedY = lerp(track[start].y, track[end].y, t);
    error += Math.hypot(track[index].x - expectedX, track[index].y - expectedY) * 1.8 / Math.max(1, actorTracks.length);
  });
  error += samples[index].motion.energy * 0.14;
  if (samples[index].cameraMotion?.cut) error += 5;
  return error;
}

function ensureTraceActors(actorCount, provenance = null) {
  const actors = state.items.filter((item) => item.type === "actor");
  while (actors.length < actorCount) {
    const index = actors.length;
    const actor = {
      id: uid(),
      type: "actor",
      name: "배우 " + (index + 1),
      x: 0.32 + index * 0.12,
      y: 0.46 + (index % 2) * 0.12,
      size: 1,
      color: colors[(state.items.length + 1) % colors.length],
      shape: "circle",
      facing: 0,
      provenance: sanitizeProvenance(provenance),
      detectionConfidence: null,
    };
    state.items.push(actor);
    actors.push(actor);
  }
  return actors.slice(0, actorCount);
}

function buildActorTracks(samples, actors, tracking = { mode: "motion" }) {
  const tracks = actors.map(() => []);
  const screenTracks = actors.map(() => []);
  const trackOrigins = actors.map(() => null);
  let actorAnchors = actors.map((actor) => clone(actor));
  let states = actors.map((actor) => ({
    x: clamp((actor.x - 0.1) / 0.8, 0, 1),
    y: clamp((actor.y - 0.1) / 0.68, 0, 1),
    rawX: 0.5,
    rawY: 0.5,
    size: 0.3,
    width: 0.14,
    rawSize: 0.3,
    rawWidth: 0.14,
    baseSize: 0,
    vx: 0,
    vy: 0,
    rawVx: 0,
    rawVy: 0,
    initialized: false,
    misses: 0,
    observed: false,
    source: "none",
    score: 0,
    shot: 1,
  }));
  let visionObservations = 0;
  let motionObservations = 0;
  let scoreTotal = 0;
  let mappingConfidenceTotal = 0;
  let mappingConfidenceCount = 0;

  samples.forEach((sample) => {
    if (sample.cameraMotion?.cut) {
      actorAnchors = actorAnchors.map((anchor, index) => clone(tracks[index][tracks[index].length - 1] || anchor));
      trackOrigins.fill(null);
      states = states.map((last) => ({
        ...last,
        initialized: false,
        vx: 0,
        vy: 0,
        rawVx: 0,
        rawVy: 0,
        baseSize: last.size,
        misses: 0,
        shot: sample.stabilization?.shot || last.shot + 1,
      }));
    }
    const allowMotionOnly = tracking.mode !== "vision" || (!sample.cameraMotion?.cut && states.some((entry) => entry.initialized));
    const candidates = videoCandidatesForSample(sample, { allowMotionOnly });
    const assignments = assignTrackCandidates(states, candidates);
    const nextStates = states.map((last, actorIndex) => {
      const target = assignments[actorIndex] >= 0 ? candidates[assignments[actorIndex]] : null;
      if (!target) {
        return {
          ...last,
          x: clamp(last.x + last.vx * 0.35, 0, 1),
          y: clamp(last.y + last.vy * 0.35, 0, 1),
          rawX: clamp(last.rawX + last.rawVx * 0.35, 0, 1),
          rawY: clamp(last.rawY + last.rawVy * 0.35, 0, 1),
          vx: last.vx * 0.55,
          vy: last.vy * 0.55,
          rawVx: last.rawVx * 0.55,
          rawVy: last.rawVy * 0.55,
          misses: last.misses + 1,
          observed: false,
        };
      }
      const alpha = last.initialized ? (target.source === "vision" ? 0.7 : 0.5) : 1;
      const rawAlpha = last.initialized ? (target.source === "vision" ? 0.82 : 0.58) : 1;
      const x = lerp(last.x, target.x, alpha);
      const y = lerp(last.y, target.y, alpha);
      const rawX = lerp(last.rawX, target.rawX, rawAlpha);
      const rawY = lerp(last.rawY, target.rawY, rawAlpha);
      if (target.source === "vision") {
        visionObservations += 1;
        scoreTotal += target.score;
      } else {
        motionObservations += 1;
      }
      return {
        ...last,
        x,
        y,
        rawX,
        rawY,
        size: target.size || last.size,
        width: target.width || last.width,
        rawSize: target.rawSize || last.rawSize,
        rawWidth: target.rawWidth || last.rawWidth,
        baseSize: last.baseSize || target.size || last.size,
        vx: lerp(last.vx, x - last.x, 0.72),
        vy: lerp(last.vy, y - last.y, 0.72),
        rawVx: lerp(last.rawVx, rawX - last.rawX, 0.72),
        rawVy: lerp(last.rawVy, rawY - last.rawY, 0.72),
        initialized: true,
        misses: 0,
        observed: true,
        source: target.source,
        score: target.score,
        shot: sample.stabilization?.shot || last.shot,
      };
    });

    nextStates.forEach((screenPose, index) => {
      const lastPose = tracks[index][tracks[index].length - 1] || actors[index];
      if (!trackOrigins[index] && screenPose.initialized) {
        trackOrigins[index] = { x: screenPose.x, y: screenPose.y, size: screenPose.size || 0.3 };
      }
      const origin = trackOrigins[index] || { x: 0.5, y: 0.5, size: screenPose.baseSize || 0.3 };
      const calibration = state.reference.calibration || sanitizeReferenceCalibration();
      let mappedPose = mapActorScreenPose(screenPose, origin, actorAnchors[index], calibration);
      const stageSize = stageWorldSize(state);
      const projectionOptions = {
        aspect: sample.width && sample.height ? sample.width / sample.height : aspectMap[state.aspect],
        stageWidth: stageSize.width,
        stageDepth: stageSize.depth,
      };
      const projected = projectScreenToStage3D(screenPose.x, screenPose.y, state.camera, projectionOptions);
      const projectedOrigin = projectScreenToStage3D(origin.x, origin.y, state.camera, projectionOptions);
      if (projected.hit && projectedOrigin.hit && projected.confidence > 0.12) {
        const projectedPose = calibration.anchorToCurrent !== false
          ? {
            x: clamp(actorAnchors[index].x + projected.x - projectedOrigin.x, 0.02, 0.98),
            y: clamp(actorAnchors[index].y + projected.y - projectedOrigin.y, 0.02, 0.98),
          }
          : { x: projected.x, y: projected.y };
        const projectionBlend = clamp(projected.confidence * 0.45, 0.12, 0.45);
        mappedPose = {
          x: lerp(mappedPose.x, projectedPose.x, projectionBlend),
          y: lerp(mappedPose.y, projectedPose.y, projectionBlend),
        };
        mappingConfidenceTotal += projected.confidence;
        mappingConfidenceCount += 1;
      }
      const targetX = mappedPose.x;
      const targetY = mappedPose.y;
      const x = lerp(lastPose.x, targetX, screenPose.initialized ? 0.76 : 0);
      const y = lerp(lastPose.y, targetY, screenPose.initialized ? 0.76 : 0);
      const moved = Math.hypot(x - lastPose.x, y - lastPose.y);
      const facing = moved > 0.006
        ? Math.round(radToDeg(Math.atan2(y - lastPose.y, x - lastPose.x)))
        : lastPose.facing;
      tracks[index].push({
        ...lastPose,
        x,
        y,
        facing,
        visible: screenPose.initialized && (screenPose.observed || screenPose.misses <= 2),
      });
      screenTracks[index].push({
        x: screenPose.rawX,
        y: screenPose.rawY,
        size: screenPose.rawSize,
        width: screenPose.rawWidth,
        observed: screenPose.observed,
        source: screenPose.source,
        score: screenPose.score,
        shot: screenPose.shot,
      });
    });
    states = nextStates;
  });

  const totalSlots = Math.max(1, samples.length * actors.length);
  const confidence = visionObservations
    ? Math.round(clamp(visionObservations / totalSlots * 0.65 + scoreTotal / visionObservations * 0.35, 0, 1) * 100)
    : Math.round(clamp(motionObservations / totalSlots * 0.42, 0, 0.42) * 100);
  const mappingConfidence = mappingConfidenceCount
    ? Math.round(clamp(mappingConfidenceTotal / mappingConfidenceCount, 0, 1) * 100)
    : 0;
  return { tracks, screenTracks, confidence, mappingConfidence };
}

function videoCandidatesForSample(sample, options = {}) {
  const people = sample.people || [];
  const visionCandidates = people.map((person) => {
    const rawY = person.footY ?? person.y;
    const stabilized = stabilizeDetection({
      x: person.x,
      y: rawY,
      size: person.size,
      width: person.width,
    }, sample.stabilization, 1);
    return {
      x: stabilized.x,
      y: stabilized.y,
      size: stabilized.size,
      width: stabilized.width,
      rawX: person.x,
      rawY,
      rawSize: person.size,
      rawWidth: person.width,
      score: person.score,
      weight: Math.round(person.score * 1000),
      source: "vision",
    };
  });
  const motionCandidates = (sample.motion?.regions || []).map((region) => {
    const stabilized = stabilizeDetection({ x: region.x, y: region.y, size: 0.24, width: 0.16 }, sample.stabilization, 1);
    return {
      x: stabilized.x,
      y: stabilized.y,
      size: stabilized.size,
      width: stabilized.width,
      rawX: region.x,
      rawY: region.y,
      rawSize: 0.24,
      rawWidth: 0.16,
      score: clamp(region.weight / 1200, 0.2, 0.72),
      weight: region.weight,
      source: "motion",
    };
  });
  if (!visionCandidates.length) return options.allowMotionOnly === false ? [] : motionCandidates;
  const supplementalMotion = motionCandidates.filter((motion) => visionCandidates.every((vision) => {
    const exclusionRadius = Math.max(0.1, Number(vision.width || 0.12) * 0.75);
    return Math.hypot(motion.rawX - vision.rawX, motion.rawY - vision.rawY) > exclusionRadius;
  }));
  return [...visionCandidates, ...supplementalMotion].slice(0, 8);
}

function averageActorPosition(poses, fallbackCamera) {
  if (!poses.length) return { x: fallbackCamera.aimX, y: fallbackCamera.aimY };
  return {
    x: poses.reduce((sum, pose) => sum + pose.x, 0) / poses.length,
    y: poses.reduce((sum, pose) => sum + pose.y, 0) / poses.length,
  };
}

function applyVideoDraft(draft, actorCount) {
  const referenceId = state.reference.id || (state.reference.id = uid());
  const actors = ensureTraceActors(actorCount, { type: "reference", referenceId, detectionId: "video-actor" });
  const actorIds = actors.map((actor) => actor.id);
  state.motion.playhead = 0;
  state.motion.hiddenSources = normalizeHiddenSources(state.motion.hiddenSources)
    .filter((sourceId) => sourceId !== "camera" && !actorIds.includes(sourceId));
  state.motion.keyframes = state.motion.keyframes.filter((keyframe) => !(
    keyframe.provenance?.type === "reference"
    && keyframe.provenance.referenceId === referenceId
  ));
  state.motion.duration = resolveDraftDuration(draft.duration, state.motion.keyframes, MAX_TIMELINE_DURATION);

  const appliedTimes = new Set();
  let collisionCount = 0;
  draft.entries.forEach((entry) => {
    let insertedAtTime = false;
    if (pushReferenceKeyframe({
      id: uid(),
      source: "camera",
      label: entry.label,
      time: entry.time,
      transition: normalizeTransition(entry.transition),
      pose: clone(entry.camera),
      provenance: { type: "reference", referenceId, detectionId: `camera-${entry.time}` },
    })) insertedAtTime = true;
    else collisionCount += 1;
    actors.forEach((actor, index) => {
      if (pushReferenceKeyframe({
        id: uid(),
        source: actor.id,
        label: entry.label,
        time: entry.time,
        transition: normalizeTransition(entry.transition),
        pose: clone(entry.actorPoses[index]),
        provenance: { type: "reference", referenceId, detectionId: `actor-${index}-${entry.time}` },
      })) insertedAtTime = true;
      else collisionCount += 1;
    });
    if (insertedAtTime) appliedTimes.add(Number(entry.time).toFixed(2));
  });
  const unusedGeneratedActors = new Set(state.items
    .filter((item) => (
      item.type === "actor"
      && item.provenance?.type === "reference"
      && item.provenance.referenceId === referenceId
      && !actorIds.includes(item.id)
    ))
    .map((item) => item.id));
  if (unusedGeneratedActors.size) {
    state.items = state.items.filter((item) => !unusedGeneratedActors.has(item.id));
    state.motion.keyframes = state.motion.keyframes.filter((keyframe) => !unusedGeneratedActors.has(keyframe.source));
  }
  state.motion.keyframes = sortKeyframes(state.motion.keyframes);
  state.motion.activeSource = "all";
  state.motion.selectedKeyId = state.motion.keyframes.find((keyframe) => keyframe.source === "camera")?.id || null;
  selected = { kind: "camera" };
  return { temporalKeyCount: appliedTimes.size, collisionCount };
}

function pushReferenceKeyframe(keyframe) {
  const manualCollision = state.motion.keyframes.some((entry) => (
    entry.source === keyframe.source
    && !entry.provenance
    && Math.abs(entry.time - keyframe.time) < 0.05
  ));
  if (!manualCollision) {
    keyframe.segment = sanitizeMotionSegment(keyframe.segment, keyframe.source);
    state.motion.keyframes.push(keyframe);
    return true;
  }
  return false;
}

async function importMotionPrevisFiles(fileList) {
  const files = [...(fileList || [])];
  if (!files.length) return;
  const loaded = [];
  for (const file of files) {
    try {
      loaded.push({
        name: file.name,
        data: JSON.parse(await file.text()),
      });
    } catch (error) {
      console.warn(`Could not import ${file.name}: ${error.message}`);
    }
  }
  if (!loaded.length) return;
  applyMotionPrevisImports(loaded);
  const input = $("#mpsImportInput");
  if (input) input.value = "";
  commit();
}

function applyMotionPrevisImports(loadedFiles) {
  const bundle = findMotionPrevisFile(loadedFiles, isBundleManifest)?.data || null;
  const analysis = findMotionPrevisFile(loadedFiles, isAnalysisManifest)?.data || null;
  const quality = findMotionPrevisFile(loadedFiles, isQualityReport)?.data || bundle?.planning?.qualityReport || null;
  const controlManifest = findMotionPrevisFile(loadedFiles, isControlLayerManifest)?.data || null;
  const shotBible = findMotionPrevisFile(loadedFiles, (data) => Array.isArray(data))?.data || bundle?.planning?.shotBible || [];
  const cameraMotion = findMotionPrevisFile(loadedFiles, isCameraMotionData)?.data || null;
  const planning = bundle?.planning || {};
  const primaryShot = Array.isArray(shotBible) ? shotBible.find((entry) => entry?.selected) || shotBible[0] : null;
  const sourceName = bundle?.sourceName || analysis?.sourceName || state.reference.name || "";
  const range = bundle?.range || analysis?.range || {};
  const importedFiles = {
    ...(analysis ? pickMotionPrevisFileRefs(analysis) : {}),
    ...(bundle?.files || {}),
  };

  state.motionPrevis = sanitizeMotionPrevis({
    imported: true,
    importedAt: new Date().toISOString(),
    sourceName,
    frameCount: bundle?.frameCount || 0,
    cameraMoveFrames: bundle?.cameraMoveFrames || cameraMotion?.frames?.length || 0,
    sampleFps: bundle?.sampleFps || analysis?.sampleFps || cameraMotion?.fps || 0,
    qualityReport: quality,
    poseDiagnostics: bundle?.poseDiagnostics || [],
    files: importedFiles,
    shotBible: Array.isArray(shotBible) ? shotBible : [],
    analysisSettings: bundle?.analysisSettings || planning.analysisSettings || null,
  });

  if (planning.sceneTitle || primaryShot?.scene) state.sceneTitle = planning.sceneTitle || primaryShot.scene;
  if (planning.creativeIntent || primaryShot?.description) state.sceneIntent = planning.creativeIntent || primaryShot.description;
  state.previs.mode = mapMotionPrevisMode(planning.subjectMode || primaryShot?.subjectMode || state.previs.mode);
  state.previs.selectedLayers = normalizeSelection(
    controlManifest?.selectedLayers || planning.selectedLayers || state.previs.selectedLayers,
    controlLayers,
    state.previs.selectedLayers,
  );
  state.previs.exportPresets = normalizeSelection(planning.exportPresets || state.previs.exportPresets, exportPresets, state.previs.exportPresets);

  state.reference = sanitizeReference({
    ...state.reference,
    name: sourceName || state.reference.name,
    url: analysis?.referenceUrl || state.reference.url,
    duration: Math.max(Number(range.end || 0), Number(range.duration || 0), Number(state.reference.duration || 0)),
    start: range.start ?? state.reference.start,
    end: range.end ?? (range.duration ? (range.start || 0) + range.duration : state.reference.end),
    notes: buildImportedReferenceNotes(planning, quality, cameraMotion),
  });

  if (cameraMotion?.summary) applyCameraMotionSummary(cameraMotion);
}

function findMotionPrevisFile(files, predicate) {
  return files.find((file) => {
    try {
      return predicate(file.data, file.name);
    } catch {
      return false;
    }
  });
}

function isBundleManifest(data, name = "") {
  return Boolean(name === "bundle_manifest.json" || (data?.app && data?.files && data?.planning));
}

function isAnalysisManifest(data, name = "") {
  return Boolean(name === "analysis_manifest.json" || (data?.analysisId && data?.referenceUrl && data?.range));
}

function isQualityReport(data, name = "") {
  return Boolean(name === "quality_report.json" || (data?.score != null && data?.readiness && (data?.tracking || data?.camera || data?.layers)));
}

function isControlLayerManifest(data, name = "") {
  return Boolean(name === "control_layers_manifest.json" || (Array.isArray(data?.selectedLayers) && Array.isArray(data?.layers)));
}

function isCameraMotionData(data, name = "") {
  return Boolean(name === "camera_motion.json" || (Array.isArray(data?.frames) && data?.summary && data?.fps));
}

function pickMotionPrevisFileRefs(analysis) {
  return {
    reference: analysis.referencePath || "",
    depth: analysis.depthPath || "",
    edges: analysis.edgesPath || "",
    lineart: analysis.lineartPath || "",
    motionMask: analysis.motionMaskPath || "",
    normalsProxy: analysis.normalsPath || "",
    contactSheet: analysis.contactSheetPath || "",
    animatic: analysis.animaticPath || "",
  };
}

function mapMotionPrevisMode(mode) {
  if (mode === "camera-only") return "camera-only";
  if (mode === "actor-motion") return "actor-blocking";
  if (mode === "object-motion") return "full-scene";
  if (mode === "full-scene") return "full-scene";
  return previsModes[mode] ? mode : state.previs.mode;
}

function buildImportedReferenceNotes(planning = {}, quality = null, cameraMotion = null) {
  const notes = [];
  if (planning.creativeIntent) notes.push(planning.creativeIntent);
  if (planning.visualStyle) notes.push(`스타일 목표: ${planning.visualStyle}`);
  if (quality?.score != null) notes.push(`모션 프리비즈 준비도: ${quality.score}/100 · ${quality.readiness}`);
  if (cameraMotion?.summary) {
    const summary = cameraMotion.summary;
    notes.push(`카메라 추적: 좌우 ${round(summary.panPixels || 0, 1)}px, 상하 ${round(summary.tiltPixels || 0, 1)}px, 줌 ${round(summary.zoomRatio || 1, 2)}x, 롤 ${round(summary.rollDegrees || 0, 1)}°.`);
  }
  return notes.join("\n");
}

function applyCameraMotionSummary(cameraMotion) {
  const summary = cameraMotion.summary || {};
  const confidence = Number(summary.averageConfidence || 0);
  if (!Number.isFinite(confidence) || confidence < 0.18) return;
  const horizontalFov = focalToFov(state.camera.focal);
  const verticalFov = horizontalFovToVerticalFov(horizontalFov, aspectMap[state.aspect] || 16 / 9);
  const panDelta = clamp(
    -(Number(summary.panPixels || 0) / Math.max(1, cameraMotion.width || 1920)) * horizontalFov,
    -30,
    30,
  );
  const tiltDelta = clamp(
    (Number(summary.tiltPixels || 0) / Math.max(1, cameraMotion.height || 1080)) * verticalFov,
    -20,
    20,
  );
  const zoom = clamp(Number(summary.zoomRatio || 1), 0.75, 1.35);
  const endTime = clamp(Number(cameraMotion.duration || state.motion.duration), 1, 60);
  state.motion.duration = Math.max(state.motion.duration, endTime);
  const endCamera = sanitizeCameraPose({
    ...state.camera,
    panDeg: state.camera.panDeg + panDelta,
    tiltDeg: state.camera.tiltDeg + tiltDelta,
    focal: state.camera.focal * zoom,
  });
  state.motion.keyframes = state.motion.keyframes.filter((keyframe) => !(keyframe.source === "camera" && (keyframe.label === "MPS Camera" || keyframe.label === "MPS 카메라")));
  state.motion.keyframes.push({
    id: uid(),
    source: "camera",
    label: "MPS 카메라",
    time: endTime,
    transition: "smooth",
    segment: motionSegmentForPathMode("straight", "camera"),
    pose: endCamera,
  });
  state.motion.keyframes = sortKeyframes(state.motion.keyframes);
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
          ${item.type === "prop" ? `<small>${escapeHtml(propDefinition(item.assetType).label)}${item.motionEnabled === false ? " · 고정" : ""}${groupForItem(item.id) ? " · 묶음" : ""}</small>` : item.placementMode === "auto" && item.mountId ? `<small>자동 탑승</small>` : groupForItem(item.id) ? `<small>수동 묶음</small>` : ""}
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
  if (updateInputs) {
    $("#selectedName").value = item.name;
    $("#sizeSlider").value = item.size;
    $("#facingSlider").value = transformItem.facing;
  }
  $("#sizeSlider").max = item.type === "actor" ? "2.2" : "4";
  $("#sizeValue").textContent = `${Number(item.size).toFixed(2)}x`;
  $("#facingValue").textContent = `${Math.round(transformItem.facing)}°`;
  $("#sizeSlider").value = item.size;
  $("#facingSlider").value = transformItem.facing;

  const propFields = $("#propSpecificFields");
  const actorPlacementFields = $("#actorPlacementFields");
  propFields.hidden = item.type !== "prop";
  actorPlacementFields.hidden = item.type !== "actor";
  $("#shapeField").hidden = item.type === "prop" && item.assetType !== "generic";
  if (item.type === "prop") {
    $("#selectedPropAsset").value = item.assetType;
    $("#propMotionToggle").checked = item.motionEnabled !== false;
    [["X", item.scaleX], ["Y", item.scaleY], ["Z", item.scaleZ]].forEach(([axis, value]) => {
      $("#propScale" + axis).value = value;
      $("#propScale" + axis + "Value").textContent = `${Number(value).toFixed(2)}x`;
    });
  } else {
    $("#actorPlacementMode").value = item.placementMode || "manual";
    renderAutoMountControls(item, updateInputs);
  }
  $("#manualGroupFields").hidden = item.type === "actor" && item.placementMode === "auto";
  renderManualGroupControls(item);

  const swatches = $("#colorSwatches");
  swatches.innerHTML = "";
  colors.forEach((color) => {
    const button = document.createElement("button");
    button.className = "swatch";
    button.style.background = color;
    button.classList.toggle("is-active", item.color === color);
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
    button.addEventListener("click", () => {
      item.shape = value;
      commit();
    });
    shapeRoot.append(button);
  });

  $$(".facing-grid button").forEach((button) => {
    const diff = Math.abs((((Number(button.dataset.facing) - transformItem.facing) % 360) + 540) % 360 - 180);
    button.classList.toggle("is-active", diff <= 22.5);
  });
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
  if (!item || item.motionEnabled === false || groupForItem(item.id, renderState)) return [];
  if (item.type === "actor" && item.placementMode === "auto") return [];
  const size = stageWorldSize(renderState);
  return renderState.items.filter((candidate) => {
    if (candidate.id === item.id || candidate.visible === false || candidate.motionEnabled === false) return false;
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

function renderKeyStatus(updateInputs = true) {
  const visibleSourceIds = new Set(visibleSourceDefinitions().map((source) => source.id));
  const keyframes = sortKeyframes(state.motion.keyframes).filter((keyframe) => visibleSourceIds.has(keyframe.source));
  const selectedKey = selectedKeyframe();
  const current = selectedKey && visibleSourceIds.has(selectedKey.source) ? selectedKey : null;
  const timeInput = $("#keyTimeInput");
  const transitionSelect = $("#keyTransitionSelect");
  const pathSelect = $("#keyPathSelect");
  if (updateInputs || document.activeElement !== timeInput) {
    timeInput.value = Number(displayPlayhead() ?? current?.time ?? 0).toFixed(1);
  }
  updatePlayheadDisplay(displayPlayhead());
  $("#deleteKeyBtn").disabled = !current;
  $("#updateKeyBtn").disabled = !current;
  const currentSourceKeys = current ? keysForSource(current.source) : [];
  const isFirstSourceKey = Boolean(current && currentSourceKeys[0]?.id === current.id);
  if (transitionSelect && (updateInputs || document.activeElement !== transitionSelect)) {
    transitionSelect.value = normalizeTransition(current?.transition);
  }
  if (transitionSelect) {
    transitionSelect.disabled = !current || isFirstSourceKey;
    transitionSelect.title = isFirstSourceKey
      ? "첫 키에는 도착 방식이 적용되지 않습니다."
      : "이 키에 도착하는 이동 방식";
  }
  renderPathModeSelect(pathSelect, current, isFirstSourceKey, updateInputs);

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
    marker.style.setProperty("--marker-color", sourceColor(keyframe.source));
    marker.style.left = `${clamp((keyframe.time / state.motion.duration) * 100, 0, 100)}%`;
    marker.dataset.time = `${keyframe.time.toFixed(2)}초`;
    marker.innerHTML = `<span>${keySequenceNumber(keyframe, keyframes)}</span>`;
    const transitionText = keyTransitionLabels[normalizeTransition(keyframe.transition)];
    const pathText = pathModeLabels[pathModeForSegment(keyframe.segment, keyframe.source)];
    marker.title = `${sourceLabel(keyframe.source)} · ${keyframe.label} · ${keyframe.time.toFixed(1)}s · ${transitionText} · ${pathText} · 좌우 드래그로 시간 이동`;
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
    ? `${sourceLabel(current.source)} · ${current.label} @ ${current.time.toFixed(1)}s · ${isFirstSourceKey ? "첫 키" : `${keyTransitionLabels[normalizeTransition(current.transition)]} · ${pathModeLabels[pathModeForSegment(current.segment, current.source)]}`}`
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
  allOption.textContent = "전체";
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
        marker.style.setProperty("--marker-color", source.color);
        marker.style.left = `${clamp((keyframe.time / state.motion.duration) * 100, 0, 100)}%`;
        marker.dataset.time = `${keyframe.time.toFixed(2)}초`;
        marker.innerHTML = `<span>${keySequenceNumber(keyframe, keyframes)}</span>`;
        marker.title = `${source.name} · ${keyframe.label} · ${keyframe.time.toFixed(1)}s · ${keyTransitionLabels[normalizeTransition(keyframe.transition)]} · ${pathModeLabels[pathModeForSegment(keyframe.segment, keyframe.source)]}`;
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
    remove.title = `${source.name} 타임라인 숨기기`;
    remove.setAttribute("aria-label", `${source.name} 타임라인 숨기기`);
    remove.addEventListener("click", (event) => {
      event.stopPropagation();
      hideSourceTimeline(source.id);
      commit();
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
  stopPreview();
  const keyframe = state.motion.keyframes.find((entry) => entry.id === keyframeId);
  if (!keyframe) return;
  const track = event.currentTarget.closest(".source-lane-track, .timeline-track") || $("#timelineTrack");
  const trackRect = track.getBoundingClientRect();
  const groupedKeys = keyframe.transition === "cut"
    ? state.motion.keyframes.filter((entry) => entry.transition === "cut" && Math.abs(entry.time - keyframe.time) < 0.05)
    : [keyframe];
  timelineDrag = {
    id: keyframeId,
    pointerId: event.pointerId ?? "mouse",
    target: event.currentTarget,
    startDuration: state.motion.duration,
    startTime: keyframe.time,
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
  if (timelineDrag.pointerId !== "mouse") {
    timelineDrag.target?.releasePointerCapture?.(timelineDrag.pointerId);
  }
  const changedSources = new Set((timelineDrag.group || []).map((grouped) => (
    state.motion.keyframes.find((entry) => entry.id === grouped.id)?.source
  )).filter(Boolean));
  changedSources.forEach(reconcileSourcePathConstraints);
  state.reference.analysis.cutTimes = shotCutTimes();
  state.reference.analysis.sceneCuts = state.reference.analysis.cutTimes.length;
  timelineDrag = null;
  commit();
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

$("#aspectButtons").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-aspect]");
  if (!button) return;
  state.aspect = button.dataset.aspect;
  commit();
});

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

$("#trackingTargetSelect").addEventListener("change", (event) => {
  state.camera.trackingTargetId = sanitizeTrackingTargetId(event.target.value, state);
  applyCameraTracking(state);
  selected = { kind: "camera" };
  setActiveSource("camera");
  commit();
});

$("#focalSlider").addEventListener("input", (event) => {
  state.camera.focal = Number(event.target.value);
  selected = { kind: "camera" };
  setActiveSource("camera");
  selectKeyForSource("camera");
  syncUi(false);
  draw();
});

$("#focalSlider").addEventListener("change", commit);

$("#cameraHeightSlider").addEventListener("input", (event) => {
  state.camera.height = Number(event.target.value);
  applyCameraTracking(state);
  syncCameraDerivedAim(state.camera, state);
  $("#cameraHeightValue").textContent = `${state.camera.height.toFixed(1)}m`;
  selected = { kind: "camera" };
  setActiveSource("camera");
  selectKeyForSource("camera");
  draw();
  if (viewMode === "3d") renderThreeView(state, true);
});

$("#cameraHeightSlider").addEventListener("change", commit);

$("#cameraPanSlider").addEventListener("input", (event) => {
  state.camera.panDeg = normalizePanDeg(event.target.value);
  syncCameraDerivedAim(state.camera, state);
  $("#cameraPanValue").textContent = `${Math.round(state.camera.panDeg)}°`;
  selected = { kind: "camera" };
  setActiveSource("camera");
  selectKeyForSource("camera");
  draw();
  if (viewMode === "3d") renderThreeView(state, true);
});

$("#cameraPanSlider").addEventListener("change", commit);

$("#cameraTiltSlider").addEventListener("input", (event) => {
  state.camera.tiltDeg = clamp(Number(event.target.value), -60, 60);
  syncCameraDerivedAim(state.camera, state);
  $("#cameraTiltValue").textContent = `${Math.round(state.camera.tiltDeg)}°`;
  selected = { kind: "camera" };
  setActiveSource("camera");
  selectKeyForSource("camera");
  draw();
  if (viewMode === "3d") renderThreeView(state, true);
});

$("#cameraTiltSlider").addEventListener("change", commit);

$("#focalPresets").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-focal]");
  if (!button) return;
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
    type,
    name: rawName.trim().replace(/^@/, "") || (type === "prop" ? propDefinition(safeAssetType).label : `${base} ${count + 1}`),
    x: type === "prop" ? 0.52 : 0.38 + count * 0.06,
    y: type === "prop" ? 0.58 : 0.36 + count * 0.08,
    size: 1,
    color: colors[(state.items.length + 2) % colors.length],
    shape: type === "prop" ? "square" : "circle",
    facing: 0,
    assetType: safeAssetType,
    scaleX: 1,
    scaleY: 1,
    scaleZ: 1,
    placementMode: "manual",
    mountId: "",
    seatIndex: 0,
    motionEnabled: true,
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

$("#selectedName").addEventListener("change", commit);

$("#sizeSlider").addEventListener("input", (event) => {
  const item = selectedItem();
  if (!item) return;
  item.size = Number(event.target.value);
  $("#sizeValue").textContent = `${item.size.toFixed(2)}x`;
  draw();
});

$("#sizeSlider").addEventListener("change", commit);

$("#selectedPropAsset").addEventListener("change", (event) => {
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
  item.motionEnabled = event.target.checked;
  if (!item.motionEnabled && state.motion.activeSource === item.id) state.motion.activeSource = "all";
  commit();
});

[["X", "scaleX"], ["Y", "scaleY"], ["Z", "scaleZ"]].forEach(([axis, field]) => {
  $("#propScale" + axis).addEventListener("input", (event) => {
    const item = selectedItem();
    if (!item || item.type !== "prop") return;
    item[field] = Number(event.target.value);
    $("#propScale" + axis + "Value").textContent = `${item[field].toFixed(2)}x`;
    draw();
  });
  $("#propScale" + axis).addEventListener("change", commit);
});

$("#actorPlacementMode").addEventListener("change", (event) => {
  const actor = selectedItem();
  if (!actor || actor.type !== "actor") return;
  const nextMode = event.target.value === "auto" ? "auto" : "manual";
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
  const actor = selectedItem();
  if (!actor || actor.type !== "actor" || actor.placementMode !== "auto" || !actor.mountId) return;
  actor.seatIndex = Math.max(0, Number(event.target.value) || 0);
  sanitizeAutoMountRelationships(state);
  commit();
});

$("#groupOverlapBtn").addEventListener("click", () => {
  const item = selectedItem();
  if (!item) return;
  const candidates = overlappingItemsForGroup(item, state);
  const group = createManualGroup([item.id, ...candidates.map((candidate) => candidate.id)], item.id, state);
  if (!group) return;
  setActiveSource(group.leaderId);
  selectKeyForSource(group.leaderId);
  notifyApp(`${group.members.length}개 대상을 하나의 묶음으로 만들었습니다.`);
  commit();
});

$("#ungroupBtn").addEventListener("click", () => {
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
  const item = selectedItem();
  if (!item) return;
  const target = state.items.find((entry) => entry.id === transformLeaderIdForItem(item.id, state)) || item;
  target.facing = Number(event.target.value);
  $("#facingValue").textContent = `${Math.round(target.facing)}°`;
  draw();
});

$("#facingSlider").addEventListener("change", commit);

$(".facing-grid").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-facing]");
  const item = selectedItem();
  if (!button || !item) return;
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

$("#sceneTitle").addEventListener("change", commit);

$("#sceneIntent").addEventListener("input", (event) => {
  state.sceneIntent = event.target.value;
  const cut = currentCut();
  if (cut) cut.intent = event.target.value;
});

$("#sceneIntent").addEventListener("change", commit);

$("#referenceFile").addEventListener("change", (event) => {
  const file = event.target.files?.[0] || null;
  setReferenceClip(file);
});

$("#referencePreview").addEventListener("loadedmetadata", () => {
  updateReferenceFrameTime();
  drawReferenceOverlay();
});
$("#referencePreview").addEventListener("loadeddata", drawReferenceOverlay);
$("#referencePreview").addEventListener("timeupdate", () => {
  updateReferenceFrameTime();
  drawReferenceOverlay();
});
$("#referencePreview").addEventListener("seeked", drawReferenceOverlay);

$("#useReferenceTimeBtn").addEventListener("click", () => {
  const video = $("#referencePreview");
  const sourceDuration = Number(video?.duration || state.reference.duration || 0);
  if (!referenceClipBlob || !sourceDuration) return;
  const sourceTime = clamp(Number(video.currentTime || 0), 0, sourceDuration);
  const timelineTime = clamp((sourceTime / sourceDuration) * state.motion.duration, 0, state.motion.duration);
  $("#keyTimeInput").value = timelineTime.toFixed(1);
  scrubToTime(timelineTime);
});

$("#traceActorCount").addEventListener("change", (event) => {
  const actorCount = clamp(Number(event.target.value || 1), 1, 8);
  state.reference.analysis = {
    ...state.reference.analysis,
    actorCount,
  };
  if (referenceAnalysisCache) rebuildReferenceDraftFromCache(actorCount);
  else {
    referenceAnalysisMessage = "추적 인원수가 바뀌었습니다. 초안을 만들면 적용됩니다.";
    commit();
  }
});

$("#analysisPrecision").addEventListener("change", (event) => {
  state.reference.precision = event.target.value === "fast" ? "fast" : "detailed";
  if (state.reference.analysis?.status === "ready") state.reference.analysis.status = "review";
  referenceAnalysisCache = null;
  referenceAnalysisMessage = "분석 정밀도가 바뀌었습니다. 초안을 다시 만들면 적용됩니다.";
  commit();
});

$("#referenceOverlayToggle").addEventListener("change", (event) => {
  state.reference.showOverlay = event.target.checked;
  commit();
  drawReferenceOverlay();
});

$("#calibrationAnchorToggle").addEventListener("change", (event) => {
  state.reference.calibration.anchorToCurrent = event.target.checked;
  applyReferenceCalibrationChange();
});

$("#calibrationMirrorToggle").addEventListener("change", (event) => {
  state.reference.calibration.mirrorX = event.target.checked;
  applyReferenceCalibrationChange();
});

$("#calibrationCameraInterpretation").addEventListener("change", (event) => {
  state.reference.calibration.cameraInterpretation = cameraInterpretationMix[event.target.value] != null
    ? event.target.value
    : "balanced";
  applyReferenceCalibrationChange();
});

$("#calibrationRotation").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-calibration-rotation]");
  if (!button) return;
  state.reference.calibration.rotation = Number(button.dataset.calibrationRotation);
  applyReferenceCalibrationChange();
});

[
  ["#calibrationLateralSlider", "lateralScale"],
  ["#calibrationDepthSlider", "depthScale"],
  ["#calibrationSizeDepthSlider", "sizeDepthWeight"],
  ["#calibrationCameraGainSlider", "cameraGain"],
  ["#calibrationStabilizationSlider", "stabilizationStrength"],
].forEach(([selector, key]) => {
  const input = $(selector);
  input.addEventListener("input", (event) => {
    state.reference.calibration[key] = Number(event.target.value);
    renderReferenceCalibrationControls(state.reference, false);
  });
  input.addEventListener("change", applyReferenceCalibrationChange);
});

$("#resetReferenceCalibrationBtn").addEventListener("click", () => {
  state.reference.calibration = sanitizeReferenceCalibration();
  applyReferenceCalibrationChange();
});

$("#setReferenceStartBtn").addEventListener("click", () => setReferenceRangeBoundary("start"));
$("#setReferenceEndBtn").addEventListener("click", () => setReferenceRangeBoundary("end"));

$("#analyzeReferenceBtn").addEventListener("click", createReferenceDraft);

$("#clearReferenceBtn").addEventListener("click", () => {
  $("#referenceFile").value = "";
  setReferenceClip(null);
});

function setReferenceRangeBoundary(boundary) {
  const video = $("#referencePreview");
  const duration = Number(video?.duration || state.reference.duration || 0);
  if (!referenceClipBlob || !duration) return;
  const current = clamp(Number(video.currentTime || 0), 0, duration);
  if (boundary === "start") {
    state.reference.start = clamp(current, 0, Math.max(0, state.reference.end - 0.25));
  } else {
    state.reference.end = clamp(current, Math.min(duration, state.reference.start + 0.25), duration);
  }
  state.reference.analysis = { ...state.reference.analysis, status: "review" };
  referenceAnalysisCache = null;
  referenceAnalysisMessage = "분석 구간이 바뀌었습니다. 초안을 다시 만들어 적용하세요.";
  commit();
}

function applyReferenceCalibrationChange() {
  state.reference.calibration = sanitizeReferenceCalibration(state.reference.calibration);
  if (referenceAnalysisCache) {
    rebuildReferenceDraftFromCache(referenceAnalysisCache.actorCount);
    return;
  }
  referenceAnalysisMessage = referenceClipBlob ? "보정값이 바뀌었습니다. 초안을 만들면 적용됩니다." : "";
  commit();
}

function rebuildReferenceDraftFromCache(actorCount = state.reference.analysis?.actorCount || 1) {
  if (!referenceAnalysisCache?.samples?.length) {
    commit();
    return;
  }
  const draft = buildVideoDraft(
    referenceAnalysisCache.samples,
    actorCount,
    referenceAnalysisCache.tracking,
    referenceAnalysisCache.baseline,
  );
  applyVideoDraft(draft, actorCount);
  referenceAnalysisCache = draft.preview;
  state.reference.analysis = {
    ...state.reference.analysis,
    status: "ready",
    keyCount: draft.entries.length,
    actorCount,
    motionScore: draft.motionScore,
    cameraConfidence: draft.cameraConfidence,
    cameraMotionType: draft.cameraProfile.type,
    cameraPan: draft.cameraProfile.pan,
    cameraZoom: draft.cameraProfile.zoom,
    cameraJitter: draft.cameraProfile.jitter,
    actorConfidence: draft.actorConfidence,
    mappingConfidence: draft.mappingConfidence,
    sceneCuts: draft.sceneCuts,
    cutTimes: draft.cutTimes,
  };
  referenceAnalysisMessage = "";
  commit();
  scrubToTime(0);
  drawReferenceOverlay();
}

$(".nudge-grid").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-nudge]");
  const item = selectedItem();
  if (!button || !item) return;
  const [dx, dy] = button.dataset.nudge.split(",").map(Number);
  nudge(item, dx, dy, 0.015);
});

function nudge(item, dx, dy, amount) {
  const target = state.items.find((entry) => entry.id === transformLeaderIdForItem(item.id, state)) || item;
  target.x = clamp(target.x + dx * amount, 0.02, 0.98);
  target.y = clamp(target.y + dy * amount, 0.02, 0.98);
  commit();
}

$("#duplicateBtn").addEventListener("click", () => {
  const item = selectedItem();
  if (!item) return;
  const duplicate = {
    ...clone(item),
    id: uid(),
    name: `${item.name} copy`,
    x: clamp(item.x + 0.04, 0.02, 0.98),
    y: clamp(item.y + 0.04, 0.02, 0.98),
    provenance: null,
    detectionConfidence: null,
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
  threeEditMode = button.dataset.threeMode || "move";
  syncUi(false);
  if (viewMode === "3d") renderThreeView(state, true);
});

$("#newBtn").addEventListener("click", () => {
  if (!confirmProjectReplacement("새 프로젝트를 시작하면")) return;
  loadProjectDocument(createDefaultProject(defaultState()));
  setWorkspaceMode("blocking");
});

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

$("#storyboardScopeSwitch").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-storyboard-scope]");
  if (!button) return;
  storyboardScope = button.dataset.storyboardScope === "project" ? "project" : "scene";
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
storyboardInspectorInputs.forEach((selector) => {
  $(selector).addEventListener("input", () => updateStoryboardCutFromInspector(false));
  $(selector).addEventListener("change", () => updateStoryboardCutFromInspector(true));
});

$("#sourceVideoBtn").addEventListener("click", () => {
  const panel = $("#videoDraftPanel");
  $("#propertiesPanel").open = false;
  $("#cameraProperties").open = false;
  panel.open = true;
  panel.scrollIntoView({ block: "nearest", behavior: "smooth" });
});

$("#jsonBtn").addEventListener("click", () => exportJson());
$("#importBtn").addEventListener("click", () => $("#importInput").click());
$("#shareBtn").addEventListener("click", shareProject);
$("#copyShareLinkBtn").addEventListener("click", copyShareLink);
$("#importInput").addEventListener("change", importJson);
$("#videoBtn").addEventListener("click", exportVideo);
$("#videoPanelBtn").addEventListener("click", exportVideo);
$("#frameBtn").addEventListener("click", exportCurrentCameraFrame);
$("#framePanelBtn").addEventListener("click", exportCurrentCameraFrame);
$("#framePairBtn").addEventListener("click", exportStartEndCameraFrames);
$("#framePairPanelBtn").addEventListener("click", exportStartEndCameraFrames);
$("#addKeyBtn").addEventListener("click", addMotionKey);
$("#updateKeyBtn").addEventListener("click", updateSelectedKey);
$("#deleteKeyBtn").addEventListener("click", deleteSelectedKey);
$("#playBtn").addEventListener("click", playPreview);
$("#stopBtn").addEventListener("click", stopPreview);

$$('.toolbar-menu-popover button').forEach((button) => {
  button.addEventListener("click", () => {
    const menu = button.closest("details");
    if (menu) menu.open = false;
  });
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

$("#keyTimeInput").addEventListener("change", (event) => {
  const time = clamp(Number(event.target.value), 0, MAX_TIMELINE_DURATION);
  ensureDurationCovers(time);
  state.motion.playhead = time;
  commit();
});

$("#keyTransitionSelect").addEventListener("change", (event) => {
  const keyframe = selectedKeyframe();
  if (!keyframe) return;
  const sourceKeys = keysForSource(keyframe.source);
  if (sourceKeys[0]?.id === keyframe.id) {
    syncUi();
    return;
  }
  const previousMode = normalizeTransition(keyframe.transition);
  const nextMode = normalizeTransition(event.target.value);
  const sameTimeKeys = state.motion.keyframes.filter((entry) => Math.abs(entry.time - keyframe.time) < 0.05);
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
  state.reference.analysis.cutTimes = shotCutTimes();
  state.reference.analysis.sceneCuts = state.reference.analysis.cutTimes.length;
  commit();
});

$("#durationInput").addEventListener("change", (event) => {
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
  materializeEvaluatedViewForEditing();
  const requestedTime = readTimelineTimeInput(state.motion.playhead);
  ensureDurationCovers(requestedTime);
  const selectedStageSource = selectedSourceId();
  const sources = activeSourceId() === "all"
    ? visibleSourceDefinitions().map((source) => source.id)
    : [activeSourceId()];
  if (!sources.length) return;
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
  notifyApp(`현재 시간에 키 ${changedKeys.length}개를 추가했습니다.`);
}

function updateSelectedKey() {
  materializeEvaluatedViewForEditing();
  const sourceId = activeSourceId();
  const keyframe = sourceId === "all"
    ? selectedKeyframe()
    : selectedKeyframe()?.source === sourceId
      ? selectedKeyframe()
      : selectKeyForSource(sourceId);
  if (!keyframe) return;
  const requestedTime = readTimelineTimeInput(keyframe.time);
  const cutGroup = keyframe.transition === "cut"
    ? state.motion.keyframes.filter((entry) => entry.transition === "cut" && Math.abs(entry.time - keyframe.time) < 0.05)
    : [keyframe];
  const time = cutGroup.length > 1
    ? availableGroupedKeyTime(requestedTime, cutGroup, MAX_TIMELINE_DURATION)
    : availableKeyTime(requestedTime, keyframe.source, { excludeId: keyframe.id, maxTime: MAX_TIMELINE_DURATION });
  ensureDurationCovers(time);
  cutGroup.forEach((entry) => {
    entry.time = time;
  });
  keyframe.pose = poseForSource(keyframe.source);
  const requestedPathMode = $("#keyPathSelect")?.value || pathModeForSegment(keyframe.segment, keyframe.source);
  applyPathModeToKeyframe(keyframe, requestedPathMode);
  state.motion.playhead = time;
  state.motion.keyframes = sortKeyframes(state.motion.keyframes);
  state.reference.analysis.cutTimes = shotCutTimes();
  state.reference.analysis.sceneCuts = state.reference.analysis.cutTimes.length;
  commit();
  notifyApp("선택한 키를 갱신했습니다.");
}

function deleteSelectedKey() {
  const keyframe = selectedKeyframe();
  if (!keyframe) return;
  state.motion.keyframes = state.motion.keyframes.filter((entry) => entry.id !== keyframe.id);
  const next = nearestKeyframe(keysForSource(keyframe.source), keyframe.time)
    || nearestKeyframe(sortKeyframes(state.motion.keyframes), keyframe.time);
  state.motion.selectedKeyId = next?.id || null;
  if (next) applyKeyframeToStage(next);
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
  const safeTime = clamp(time, 0, state.motion.duration);
  evaluatedViewState = interpolateStateAtTime(safeTime);
  syncUi();
  draw(evaluatedViewState);
}

function displayPlayhead() {
  return evaluatedViewState?.motion?.playhead ?? state.motion.playhead;
}

function materializeEvaluatedViewForEditing() {
  if (!evaluatedViewState) return;
  state.motion.playhead = evaluatedViewState.motion.playhead;
  state.camera = clone(evaluatedViewState.camera);
  state.items = clone(evaluatedViewState.items);
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
  stopPreview();
  const startedAt = performance.now();
  const duration = state.motion.duration * 1000;
  preview = requestAnimationFrame(function frame(now) {
    const t = ((now - startedAt) % duration) / duration;
    updatePlayheadDisplay(t * state.motion.duration);
    draw(interpolateState(t), { clean: false });
    preview = requestAnimationFrame(frame);
  });
}

function stopPreview() {
  if (preview) cancelAnimationFrame(preview);
  preview = null;
  draw();
}

function renderPrevisQuality() {
  const report = computePrevisQuality();
  const score = $("#qualityScore");
  const notes = $("#qualityNotes");
  if (!score || !notes) return;
  score.textContent = `${report.score}/100`;
  score.title = report.readiness;
  notes.innerHTML = [...report.checks]
    .sort((a, b) => Number(a.ok) - Number(b.ok))
    .slice(0, 4)
    .map((check) => `<span>${check.ok ? "확인" : "점검"} · ${escapeHtml(check.label)}</span>`)
    .join("");
}

function renderPipelineSteps() {
  const root = $("#pipelineSteps");
  if (!root) return;
  const report = computePrevisQuality();
  const keyframes = sortKeyframes(state.motion.keyframes || []);
  const movingSources = sourceDefinitions()
    .filter((source) => keyframes.filter((keyframe) => keyframe.source === source.id).length > 1)
    .map((source) => source.name);
  const video = state.reference || {};
  const videoLabel = video.analysis?.status === "ready"
    ? "키 " + video.analysis.keyCount + "개"
    : video.name
      ? "준비됨"
      : "없음";
  const steps = [
    {
      label: "블로킹",
      value: "키 " + keyframes.length + "개 · " + state.motion.duration.toFixed(1) + "초",
      state: keyframes.length > sourceDefinitions().length ? "ready" : "warn",
    },
    {
      label: "동선",
      value: movingSources.length ? movingSources.join(", ") : "고정",
      state: movingSources.length ? "ready" : "warn",
    },
    {
      label: "소스 영상",
      value: videoLabel,
      state: videoLabel === "없음" ? "idle" : "ready",
    },
    {
      label: "검수",
      value: report.score + "/100 · " + report.readiness,
      state: report.score >= 86 ? "ready" : report.score >= 70 ? "warn" : "idle",
    },
  ];
  root.innerHTML = steps
    .map((step) => `
      <div class="pipeline-step is-${step.state}">
        <span>${escapeHtml(step.label)}</span>
        <strong>${escapeHtml(step.value)}</strong>
      </div>
    `)
    .join("");
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
  const hasSourceVideo = Boolean(renderState.reference?.name);
  const hasVideoDraft = renderState.reference?.analysis?.status === "ready";
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
      id: "source_video",
      label: hasVideoDraft ? "영상 초안 생성됨" : hasSourceVideo ? "영상 초안 만들기" : "영상 초안은 선택 사항",
      ok: true,
      weight: 0,
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
  const sourceVideoContactSheet = await captureReferenceContactSheet();
  const manifest = buildPrevisManifest(quality, storyboard, sourceVideoContactSheet);
  const files = [
    { path: "manifest.json", content: JSON.stringify(manifest, null, 2) },
    { path: "project/frisframe.json", content: JSON.stringify({ app: SERVICE_NAME, state }, null, 2) },
    { path: "project/camera_plan.json", content: JSON.stringify(buildCameraPlan(), null, 2) },
    { path: "project/motion_keyframes.csv", content: buildMotionCsv() },
    { path: "project/framing_analysis.json", content: JSON.stringify(quality.framing, null, 2) },
    { path: "project/source_video.json", content: JSON.stringify(buildSourceVideoManifest(), null, 2) },
    { path: "docs/shot_bible.md", content: buildShotBibleMarkdown(quality) },
    { path: "docs/live_action_brief.md", content: buildLiveActionBrief(quality) },
    { path: "docs/ai_generation_brief.md", content: buildAiGenerationBrief(quality) },
    { path: "docs/on_set_checklist.md", content: buildOnSetChecklist(quality) },
    { path: "docs/framing_analysis.md", content: buildFramingAnalysisMarkdown(quality.framing) },
    { path: "docs/source_video_draft.md", content: buildSourceVideoDraftMarkdown() },
    { path: "docs/camera_storyboard.md", content: buildCameraStoryboardMarkdown(storyboard) },
    { path: "docs/seedance_prompt.md", content: buildSeedancePrompt() },
    { path: "docs/quality_report.json", content: JSON.stringify(quality, null, 2) },
    { path: "blender/blender_previs_scene.py", content: buildBlenderPrevisScript() },
    { path: "media/topdown_blocking.png", blob: topdown },
    { path: "media/camera_frame_current.png", blob: cameraFrame },
    { path: "storyboard/contact_sheet.png", blob: storyboardContactSheet },
    ...storyboard.map((frame) => ({ path: frame.path, blob: frame.blob })),
  ];
  if (referenceClipBlob) files.push({ path: "source-video/source_video" + referenceExtension(state.reference.name, state.reference.type), blob: referenceClipBlob });
  if (sourceVideoContactSheet) files.push({ path: "source-video/contact_sheet.png", blob: sourceVideoContactSheet });
  return { manifest, files };
}

function buildPrevisManifest(quality, storyboard = [], sourceVideoContactSheet = null) {
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
    sourceVideo: buildSourceVideoManifest(),
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
      "project/source_video.json",
      "docs/shot_bible.md",
      "docs/live_action_brief.md",
      "docs/ai_generation_brief.md",
      "docs/on_set_checklist.md",
      "docs/framing_analysis.md",
      "docs/source_video_draft.md",
      "docs/camera_storyboard.md",
      "docs/seedance_prompt.md",
      "docs/quality_report.json",
      "blender/blender_previs_scene.py",
      "media/topdown_blocking.png",
      "media/camera_frame_current.png",
      "storyboard/contact_sheet.png",
      ...(referenceClipBlob ? ["source-video/source_video" + referenceExtension(state.reference.name, state.reference.type)] : []),
      ...(sourceVideoContactSheet ? ["source-video/contact_sheet.png"] : []),
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
    sourceVideoSolve: {
      motionType: state.reference.analysis?.cameraMotionType || "static",
      interpretation: state.reference.calibration?.cameraInterpretation || "balanced",
      stabilizationStrength: state.reference.calibration?.stabilizationStrength ?? 0.75,
    },
    cameraKeyframes: keysForSource("camera").map((keyframe) => ({
      time: keyframe.time,
      transition: normalizeTransition(keyframe.transition),
      pose: sanitizeCameraPose(keyframe.pose),
      headingDeg: cameraHeadingDeg(sanitizeCameraPose(keyframe.pose)),
    })),
  };
}

function buildSourceVideoManifest() {
  const reference = state.reference || sanitizeReference();
  return {
    sourceName: reference.name || "",
    sourceType: reference.type || "",
    sourceSizeBytes: reference.size || 0,
    duration: round(reference.duration || 0, 2),
    analysisRange: {
      start: round(reference.start || 0, 2),
      end: round(reference.end || reference.duration || 0, 2),
    },
    precision: reference.precision || "detailed",
    showOverlay: reference.showOverlay !== false,
    calibration: clone(reference.calibration || sanitizeReferenceCalibration()),
    hasBundledClip: Boolean(referenceClipBlob),
    draft: {
      status: reference.analysis?.status || "idle",
      keyCount: reference.analysis?.keyCount || 0,
      actorCount: reference.analysis?.actorCount || 0,
      motionScore: reference.analysis?.motionScore || 0,
      tracking: reference.analysis?.tracking || "motion",
      detectedFrames: reference.analysis?.detectedFrames || 0,
      sampleCount: reference.analysis?.sampleCount || 0,
      cameraConfidence: reference.analysis?.cameraConfidence || 0,
      cameraMotionType: reference.analysis?.cameraMotionType || "static",
      cameraPan: reference.analysis?.cameraPan || 0,
      cameraZoom: reference.analysis?.cameraZoom || 0,
      cameraJitter: reference.analysis?.cameraJitter || 0,
      actorConfidence: reference.analysis?.actorConfidence || 0,
      sceneCuts: reference.analysis?.sceneCuts || 0,
      cutTimes: clone(reference.analysis?.cutTimes || []),
    },
  };
}

function buildMotionPrevisCompatibilityManifest(quality) {
  return {
    app: SERVICE_NAME,
    compatibleWith: "motion-previs-studio production bundle concepts",
    subjectMode: state.previs.mode,
    motionPrevisImported: Boolean(state.motionPrevis.imported),
    motionPrevisSource: state.motionPrevis.sourceName || "",
    exportPresets: state.previs.exportPresets,
    selectedLayers: state.previs.selectedLayers,
    shotRange: { start: 0, end: state.motion.duration, duration: state.motion.duration },
    qualityReport: {
      score: quality.score,
      readiness: motionPrevisReadiness(quality.score),
      tracking: "Manual blocking",
      camera: "Manual camera plan",
      layers: state.previs.selectedLayers.length >= 6 ? "Excellent" : state.previs.selectedLayers.length >= 4 ? "Good" : "Review",
      notes: quality.checks.map((check) => `${check.ok ? "OK" : "Review"}: ${check.label}`),
    },
    outputs: {
      topdownMap: "media/topdown_blocking.png",
      cameraFrame: "media/camera_frame_current.png",
      storyboard: "storyboard/contact_sheet.png",
      blenderScript: "blender/blender_previs_scene.py",
      seedancePrompt: "docs/seedance_prompt.md",
    },
  };
}

function motionPrevisReadiness(score) {
  if (score >= 80) return "Ready";
  if (score >= 58) return "Review";
  return "Blocked";
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
    "## Source Video",
    sourceVideoSummaryMarkdown(),
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
    "- Shoot one clean reference pass before performance variations.",
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
    "Use the included top-down blocking map and camera-frame storyboard as control references, not as visual style references.",
    "Generate cinematic live-action footage with realistic scale, lighting, people, props, lens behavior, and camera timing.",
    "",
    "## Source Video",
    sourceVideoSummaryMarkdown(),
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
    "- Record one clean wide reference pass of the blocking.",
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

function buildReferenceAnalysisBrief(quality) {
  return [
    `# Reference Analysis Brief · ${state.sceneTitle || "Untitled blocking"}`,
    "",
    "This combines the manual blocking map with Motion Previs-style source planning.",
    "",
    "## Source",
    referenceSummaryMarkdown(),
    "",
    "## Control Layers",
    selectedLayerMarkdown(),
    "",
    "## Motion Previs Import",
    motionPrevisSummaryMarkdown(),
    "",
    "## Export Presets",
    selectedPresetMarkdown(),
    "",
    "## Readiness",
    `- Score: ${quality.score}/100 · ${quality.readiness}`,
    ...quality.checks.map((check) => `- ${check.ok ? "OK" : "Review"}: ${check.label}`),
    "",
  ].join("\n");
}

function buildMotionPrevisBridgeMarkdown(quality) {
  return [
    `# Motion Previs Bridge · ${state.sceneTitle || "Untitled blocking"}`,
    "",
    "This file explains how the imported Motion Previs analysis is being used inside the manual blocking plan.",
    "",
    "## Imported Analysis",
    motionPrevisSummaryMarkdown(),
    "",
    "## Current Blocking Translation",
    `- Reference mode: ${previsModes[state.previs.mode].label}.`,
    `- Target: ${previsTargets[state.previs.target]}.`,
    `- Timeline duration: ${state.motion.duration.toFixed(1)}s at ${state.motion.fps}fps.`,
    `- Camera keys: ${keysForSource("camera").length}.`,
    "",
    "## Readiness",
    `- ${SERVICE_NAME}: ${quality.score}/100 · ${quality.readiness}.`,
    `- Motion Previs bridge: ${state.motionPrevis.imported ? "linked" : "not linked"}.`,
    "",
    "## Hand-off",
    "- Use the Motion Previs files for extracted pose, depth, masks, camera solve, and control-layer guidance.",
    "- Use this app's top-down map, camera storyboard, and framing analysis for spatial blocking and on-set marks.",
    "- Resolve any framing warnings before using the reference video in Seedance or before taping the real location.",
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

function motionPrevisSummaryMarkdown() {
  const imported = state.motionPrevis || {};
  if (!imported.imported) return "- No Motion Previs analysis imported yet.";
  const lines = [
    `- Source: ${imported.sourceName || "Unknown source"}.`,
    `- Pose frames: ${imported.frameCount || 0}. Camera frames: ${imported.cameraMoveFrames || 0}. Sample FPS: ${imported.sampleFps || 0}.`,
  ];
  if (imported.qualityReport?.score != null) lines.push(`- Imported quality: ${imported.qualityReport.score}/100 · ${imported.qualityReport.readiness}.`);
  if (imported.poseDiagnostics?.length) lines.push(...imported.poseDiagnostics.slice(0, 4).map((note) => `- Diagnostic: ${note}`));
  if (imported.shotBible?.length) lines.push(`- Shot bible entries: ${imported.shotBible.length}.`);
  const availableFiles = Object.entries(imported.files || {}).filter(([, value]) => value).map(([key]) => key);
  if (availableFiles.length) lines.push(`- Available bundle files: ${availableFiles.slice(0, 12).join(", ")}.`);
  return lines.join("\n");
}

function sourceVideoSummaryMarkdown() {
  const reference = state.reference || sanitizeReference();
  const lines = [];
  if (reference.name) lines.push(`- Source clip: ${reference.name}${reference.size ? ` (${formatBytes(reference.size)})` : ""}.`);
  if (reference.duration) lines.push(`- Duration: ${reference.duration.toFixed(1)}s.`);
  if (reference.analysis?.status === "ready") {
    const calibration = reference.calibration || sanitizeReferenceCalibration();
    const direction = { 0: "right", 90: "down", 180: "left", 270: "up" }[calibration.rotation] || "right";
    lines.push(`- Analysis range: ${reference.start.toFixed(1)}s-${reference.end.toFixed(1)}s · ${reference.precision === "fast" ? "fast" : "detailed"} pass · ${reference.analysis.sampleCount} samples.`);
    lines.push(`- Draft: ${reference.analysis.keyCount} timing beats from ${reference.analysis.actorCount} actor track(s).`);
    lines.push(reference.analysis.tracking === "vision"
      ? `- Person tracking: detected in ${reference.analysis.detectedFrames} sampled frame(s).`
      : "- Person tracking: motion-based fallback.");
    const cutTimes = (reference.analysis.cutTimes || []).map((time) => `${Number(time).toFixed(1)}s`).join(", ");
    lines.push(`- Solve confidence: camera ${reference.analysis.cameraConfidence}/100 (${cameraMotionLabels[reference.analysis.cameraMotionType] || reference.analysis.cameraMotionType}) · actors ${reference.analysis.actorConfidence}/100 · scene cuts ${reference.analysis.sceneCuts}${cutTimes ? ` at ${cutTimes}` : ""}.`);
    lines.push(`- Camera signal: pan ${round(reference.analysis.cameraPan, 4)} · zoom ${round(reference.analysis.cameraZoom, 4)} · jitter ${round(reference.analysis.cameraJitter, 3)}.`);
    lines.push(`- Floor-map calibration: ${calibration.anchorToCurrent ? "anchored to the current actor marks" : "centered automatically"}; video-right maps ${direction}; lateral ${Math.round(calibration.lateralScale * 100)}%; depth ${Math.round(calibration.depthScale * 100)}%; camera gain ${Math.round(calibration.cameraGain * 100)}%; interpretation ${calibration.cameraInterpretation}; stabilization ${Math.round(calibration.stabilizationStrength * 100)}%.`);
    lines.push(`- Motion signal: ${reference.analysis.motionScore}/100. Review camera and actor placement in 2D or 3D.`);
  }
  if (!lines.length) lines.push("- No source video attached. This was built directly from blocking.");
  return lines.join("\n");
}

function referenceSummaryMarkdown() {
  return sourceVideoSummaryMarkdown();
}

function buildSourceVideoDraftMarkdown() {
  return [
    `# Source Video Draft · ${state.sceneTitle || "Untitled blocking"}`,
    "",
    "The source video is translated into editable timing, camera, and actor blocking keys. It is a starting point for previs, not a locked camera solve.",
    "",
    "## Source",
    sourceVideoSummaryMarkdown(),
    "",
    "## Result",
    `- Timeline: ${state.motion.duration.toFixed(1)}s at ${state.motion.fps}fps.`,
    `- Camera keys: ${keysForSource("camera").length}.`,
    `- Actor marks: ${state.items.filter((item) => item.type === "actor").length}.`,
    "",
    "## Next Pass",
    "- Verify actor positions against the source shot in 2D or 3D.",
    "- Adjust camera height, lens, pan, tilt, and timing before handoff.",
    "",
  ].join("\n");
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
    renderThreeView(renderState, true);
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
      renderThreeView(renderState, true);
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

async function captureReferenceContactSheet() {
  if (!referenceClipBlob) return null;
  const video = $("#referencePreview");
  if (!video || !video.src) return null;
  await ensureVideoMetadata(video);
  const duration = Number.isFinite(video.duration) ? video.duration : 0;
  if (!duration) return null;

  const start = clamp(state.reference.start || 0, 0, duration);
  const end = clamp(state.reference.end || duration, start, duration);
  const span = Math.max(0.1, end - start);
  const times = [start, start + span * 0.5, end].map((time) => clamp(time, 0, duration));
  const tileW = 420;
  const tileH = Math.round(tileW / (aspectMap[state.aspect] || 16 / 9));
  const labelH = 34;
  const gap = 18;
  const margin = 24;
  const sheet = document.createElement("canvas");
  sheet.width = margin * 2 + times.length * tileW + (times.length - 1) * gap;
  sheet.height = margin * 2 + tileH + labelH;
  const context = sheet.getContext("2d");
  context.fillStyle = "#0b0e12";
  context.fillRect(0, 0, sheet.width, sheet.height);
  context.fillStyle = "#f2f5ef";
  context.font = "800 18px system-ui, sans-serif";
  context.fillText(state.reference.name || "Reference clip", margin, 22);

  for (let index = 0; index < times.length; index += 1) {
    await seekVideo(video, times[index]);
    const x = margin + index * (tileW + gap);
    const y = margin;
    context.drawImage(video, x, y, tileW, tileH);
    context.strokeStyle = "#3b4b55";
    context.lineWidth = 2;
    context.strokeRect(x, y, tileW, tileH);
    context.fillStyle = "#ff6b55";
    context.font = "800 14px ui-monospace, monospace";
    context.fillText(`${times[index].toFixed(1)}s`, x, y + tileH + 24);
  }

  return canvasToBlob(sheet, "image/png");
}

function ensureVideoMetadata(video) {
  if (video.readyState >= 1) return Promise.resolve();
  return new Promise((resolve) => {
    video.addEventListener("loadedmetadata", resolve, { once: true });
  });
}

function seekVideo(video, time) {
  return new Promise((resolve) => {
    const done = () => resolve();
    video.addEventListener("seeked", done, { once: true });
    video.currentTime = clamp(time, 0, video.duration || time);
  });
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

function referenceExtension(name, type) {
  const match = String(name || "").match(/\.[a-z0-9]{2,6}$/i);
  if (match) return match[0].toLowerCase();
  if (type === "video/mp4") return ".mp4";
  if (type === "video/webm") return ".webm";
  if (type === "video/quicktime") return ".mov";
  return ".video";
}

function referenceRangeDuration() {
  const reference = state.reference || {};
  const end = Number(reference.end || reference.duration || 0);
  const start = Number(reference.start || 0);
  return Math.max(0, end - start);
}

function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
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

async function exportPng() {
  const size = exportSize();
  const offscreen = document.createElement("canvas");
  offscreen.width = size.width;
  offscreen.height = size.height;
  renderToCanvas(offscreen, state, { clean: true });
  const blob = await canvasToBlob(offscreen, "image/png");
  presentExport(blob, `${slug(state.sceneTitle)}_blocking.png`, "PNG 이미지", { type: "image", blob });
}

async function renderCameraFrameBlobAtTime(time, documentState, size = exportSize(documentState)) {
  if (!initThreeView()) throw new Error("3D 카메라 프레임을 준비하지 못했습니다.");
  const renderState = interpolateRenderStateAtTime(
    documentState,
    clamp(Number(time || 0), 0, documentState.motion.duration),
  );
  renderThreeView(renderState, true, size);
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
    notifyApp("현재 범위와 상태에 해당하는 컷이 없습니다.");
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
  setProjectSaveStatus("prepared");
  notifyApp("프로젝트 저장 프리뷰를 준비했습니다.");
}

async function importJson(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const payload = JSON.parse(text);
    const nextProject = projectFromPayload(payload);
    if (!confirmProjectReplacement("프로젝트를 불러오면")) return;
    loadProjectDocument(nextProject);
    setProjectSaveStatus("saved");
    notifyApp("프로젝트를 불러왔습니다.");
    setWorkspaceMode("storyboard");
  } catch (error) {
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
    const response = await fetch("/api/project/save", {
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
    const shareUrl = `${window.location.origin}${window.location.pathname}?project=${result.id}`;
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

async function loadSharedProject(id) {
  notifyApp("공유 프로젝트를 불러오는 중...");
  try {
    const response = await fetch(`/api/project/load?id=${encodeURIComponent(id)}`);
    if (!response.ok) {
      const errorText = await response.json().then(d => d.error).catch(() => "오류가 발생했습니다.");
      throw new Error(errorText);
    }
    const payload = await response.json();
    const nextProject = projectFromPayload(payload);
    loadProjectDocument(nextProject);
    setProjectSaveStatus("saved");
    notifyApp("공유 프로젝트를 불러왔습니다.");
    setWorkspaceMode("storyboard");
  } catch (error) {
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
  if (!beginMediaExport()) return;
  const exportState = clone(state);
  if (!initThreeView()) {
    presentExportError("3D 카메라 프레임을 준비하지 못했습니다.");
    endMediaExport();
    return;
  }
  const size = exportVideoSize(exportState);
  const fps = clamp(Math.round(Number(exportState.motion.fps || 24)), 12, 60);
  const frameCount = Math.max(2, Math.round(exportState.motion.duration * fps));
  const previousSelection = clone(selected);
  let jobId = "";
  try {
    jobId = await startMp4ExportJob({ ...size, fps, frameCount });
    selected = null;
    for (let index = 0; index < frameCount; index += 1) {
      const progress = frameCount <= 1 ? 0 : index / (frameCount - 1);
      const renderState = interpolateRenderStateAtTime(exportState, progress * exportState.motion.duration);
      renderThreeView(renderState, true, size);
      await nextFrame();
      const frameBlob = await canvasToBlob(threeView.frameCanvas, "image/jpeg", 0.9);
      await uploadMp4ExportFrame(jobId, index, frameBlob);
      if (index === frameCount - 1 || index % Math.max(1, Math.round(fps / 4)) === 0) {
        mediaExportProgress = `MP4 ${index + 1}/${frameCount}`;
        renderMediaExportBusy();
      }
    }
    mediaExportProgress = "MP4 인코딩";
    renderMediaExportBusy();
    const blob = await finishMp4ExportJob(jobId);
    jobId = "";
    presentExport(blob, `${slug(exportState.sceneTitle)}_camera_preview.mp4`, "3D 카메라 영상 H.264 MP4", {
      type: "video",
      blob,
      caption: `${exportState.motion.duration.toFixed(1)}초 · ${fps}FPS · ${frameCount}프레임`,
    });
  } catch (error) {
    if (jobId) await cancelMp4ExportJob(jobId);
    presentExportError(error?.message || "MP4 카메라 영상을 만들지 못했습니다.");
  } finally {
    selected = previousSelection;
    stopPreview();
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
  const response = await fetch("/api/mp4/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });
  const payload = await readExportResponse(response);
  if (!payload.jobId) throw new Error("MP4 작업을 시작하지 못했습니다.");
  return payload.jobId;
}

async function uploadMp4ExportFrame(jobId, index, blob) {
  const response = await fetch(`/api/mp4/frame?job=${encodeURIComponent(jobId)}&index=${index}`, {
    method: "POST",
    headers: { "Content-Type": "image/jpeg" },
    body: blob,
  });
  await readExportResponse(response);
}

async function finishMp4ExportJob(jobId) {
  const response = await fetch(`/api/mp4/finish?job=${encodeURIComponent(jobId)}`, { method: "POST" });
  if (!response.ok) {
    const payload = await readExportResponse(response);
    throw new Error(payload.error || "MP4 인코딩에 실패했습니다.");
  }
  const blob = await response.blob();
  return blob.type === "video/mp4" ? blob : new Blob([blob], { type: "video/mp4" });
}

async function cancelMp4ExportJob(jobId) {
  try {
    await fetch(`/api/mp4/cancel?job=${encodeURIComponent(jobId)}`, { method: "POST" });
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
    "#frameBtn": "현재 프레임",
    "#framePanelBtn": "현재 프레임",
    "#framePairBtn": "시작·끝 프레임",
    "#framePairPanelBtn": "시작·끝",
    "#videoBtn": "카메라 영상",
    "#videoPanelBtn": "카메라 영상",
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
  const lines = [
    `Scene: ${state.sceneTitle || "Untitled blocking"}`,
    "",
    "Use @video_1 as the blocking and camera-plan reference.",
    state.reference?.name ? "The attached source clip was translated into editable timing and movement beats. Preserve its motion rhythm, then refine the placement in this plan." : null,
    "Do not copy the graphic style, grid, colored icons, labels, UI, or diagram look.",
    "Final output must be cinematic live-action footage with realistic people, props, space, lighting, and camera behavior.",
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
    "Source video:",
    state.reference?.name ? `- Attached source: ${state.reference.name}.` : "- No source video attached; use the blocking plan directly.",
    state.reference?.analysis?.status === "ready" ? `- Generated draft: ${state.reference.analysis.keyCount} beats, ${state.reference.analysis.actorCount} tracked actor(s).` : null,
    ...(framing.notes.length ? framing.notes.map((note) => `- Framing review: ${note}.`) : ["- Framing review: all sampled subjects stay inside the planned frame."]),
    "",
    "Blocking intent:",
    state.sceneIntent || "Preserve the broad spatial relationship and timing from the reference.",
    "",
    "Constraints: preserve the broad camera path, actor spacing, facing directions, and prop relationships from the reference video. Treat it as previsualization, not final art direction.",
  ].filter((line) => line !== null);
  return lines.join("\n");
}

function keyframeSummary(keyframe) {
  if (keyframe.source === "camera") {
    const camera = sanitizeCameraPose(keyframe.pose);
    return `camera (${pct(camera.x)}, ${pct(camera.y)}) at pan ${round(camera.panDeg, 1)}° and tilt ${round(camera.tiltDeg, 1)}°`;
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
        status.textContent = "이 브라우저에서는 이미지 복사를 사용할 수 없습니다";
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
  if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
    throw new Error("Image clipboard API is unavailable.");
  }
  const pngBlob = blob.type === "image/png" ? blob : await convertImageBlobToPng(blob);
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
    setProjectSaveStatus("saved");
    notifyApp("프로젝트 파일을 저장했습니다.");
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
    drawReferenceOverlay();
  });
  window.addEventListener("beforeunload", (event) => {
    if (!hasUnsavedProjectChanges()) return;
    event.preventDefault();
    event.returnValue = "";
  });
  resizeCanvas();
  refreshLucideIcons();
  
  const urlParams = new URLSearchParams(window.location.search);
  const shareId = urlParams.get("project");
  if (shareId) {
    loadSharedProject(shareId);
  }
  
  if (!hasSeenTutorial()) setTimeout(() => startTutorial(0), 650);
}

init();
