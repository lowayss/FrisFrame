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
  wall_i: { label: "ㅡ자 벽체", category: "공간", kind: "architecture", height: 2.8, footprint: 3.8 },
  wall_l: { label: "ㄱ자 벽체", category: "공간", kind: "architecture", height: 2.8, footprint: 3.8 },
  wall_u: { label: "ㄷ자 벽체", category: "공간", kind: "architecture", height: 2.8, footprint: 3.8 },
  desk: { label: "사무용 책상", category: "가구", kind: "furniture", height: 0.78, footprint: 1.1 },
  blackboard: { label: "칠판", category: "가구", kind: "furniture", height: 1.8, footprint: 2.0 },
  partition: { label: "파티션", category: "공간", kind: "architecture", height: 1.6, footprint: 1.0 },
  wall: { label: "가벽 (3m)", category: "공간", kind: "architecture", height: 3.0, footprint: 3.0 },
  "corridor-wall": { label: "복도 벽", category: "공간", kind: "architecture", height: 1.78, footprint: 3.0 },
  "train-wall": { label: "기차 차벽", category: "공간", kind: "architecture", height: 1.78, footprint: 3.0 },
  elevator: { label: "엘리베이터", category: "공간", kind: "architecture", height: 2.8, footprint: 1.6 },
  door: { label: "문", category: "공간", kind: "architecture", height: 2.2, footprint: 1.0 },
  window: { label: "창문", category: "공간", kind: "architecture", height: 1.0, footprint: 1.2 },
  sink: { label: "세면대", category: "가전", kind: "appliance", height: 0.88, footprint: 0.6 },
  toilet: { label: "변기", category: "가전", kind: "appliance", height: 0.8, footprint: 0.65 },
  bathtub: { label: "욕조", category: "가전", kind: "appliance", height: 0.65, footprint: 1.5 },
  "train-seat": { label: "기차 좌석", category: "가구", kind: "furniture", height: 1.1, footprint: 0.85 },
  stairs: { label: "계단", category: "공간", kind: "architecture", height: 1.2, footprint: 1.8 },
  slope: { label: "경사", category: "공간", kind: "architecture", height: 1.0, footprint: 3.0 },
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
      ["room", "거실", 0.5, 0.5, 0, 2.0],
      ["television", "TV", 0.5, 0.302, 180, 1.3],
      ["cabinet", "거실장", 0.5, 0.302, 180, 1.3],
      ["sofa", "메인 소파", 0.5, 0.525, 0, 1.2],
      ["dining-table", "식탁", 0.611, 0.599, 90, 1.1],
      ["chair", "의자 1", 0.583, 0.599, 90, 1.0],
      ["chair", "의자 2", 0.639, 0.599, 270, 1.0],
      ["refrigerator", "냉장고", 0.375, 0.327, 180, 1.1],
      ["window", "거실 창", 0.339, 0.5, 90, 1.4, 0.6],
      ["door", "현관문", 0.339, 0.327, 90, 1.1],
    ],
  },
  kitchen: {
    label: "주방",
    items: [
      ["room", "주방", 0.5, 0.5, 0, 1.8],
      ["refrigerator", "대형 냉장고", 0.375, 0.312, 180, 1.1],
      ["stove", "인덕션 레인지", 0.444, 0.312, 180, 1.1],
      ["sink", "개수대 싱크", 0.542, 0.312, 180, 1.2],
      ["dining-table", "식탁", 0.542, 0.574, 0, 1.1],
      ["chair", "의자 A", 0.514, 0.574, 90, 1.0],
      ["chair", "의자 B", 0.569, 0.574, 270, 1.0],
      ["window", "환기창", 0.542, 0.302, 180, 1.1, 1.1],
      ["door", "주방문", 0.361, 0.599, 90, 1.1],
    ],
  },
  bedroom: {
    label: "침실",
    items: [
      ["room", "침실", 0.5, 0.5, 0, 1.8],
      ["bed", "침대", 0.444, 0.426, 180, 1.2],
      ["cabinet", "협탁 L", 0.375, 0.327, 180, 0.8],
      ["cabinet", "옷장", 0.597, 0.327, 180, 1.3],
      ["television", "벽걸이 TV", 0.444, 0.623, 0, 1.1],
      ["desk", "화장대 책상", 0.597, 0.599, 270, 1.1],
      ["chair", "화장대 의자", 0.561, 0.599, 90, 1.0],
      ["window", "침실 창", 0.361, 0.549, 90, 1.3, 0.7],
      ["door", "방문", 0.389, 0.673, 0, 1.1],
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
  office: {
    label: "사무실",
    items: [
      ["room", "사무실", 0.5, 0.5, 0, 2.0],
      ["desk", "책상 A1", 0.467, 0.475, 90, 1.1],
      ["chair", "의자 A1", 0.439, 0.475, 90, 1.0],
      ["desk", "책상 A2", 0.533, 0.475, 270, 1.1],
      ["chair", "의자 A2", 0.561, 0.475, 270, 1.0],
      ["partition", "파티션", 0.5, 0.475, 0, 1.2],
      ["cabinet", "캐비닛", 0.403, 0.302, 180, 1.2],
      ["refrigerator", "정수기 냉장고", 0.597, 0.302, 180, 1.1],
      ["window", "사무실 창 1", 0.339, 0.451, 90, 1.3, 0.8],
      ["window", "사무실 창 2", 0.339, 0.599, 90, 1.3, 0.8],
      ["door", "사무실 문", 0.661, 0.574, 270, 1.1],
    ],
  },
  classroom: {
    label: "교실",
    items: [
      ["room", "교실", 0.5, 0.5, 0, 2.0],
      ["blackboard", "칠판", 0.5, 0.302, 0, 1.8],
      ["desk", "앞좌석 책상 L", 0.450, 0.451, 0, 1.1],
      ["chair", "앞좌석 의자 L", 0.450, 0.490, 180, 1.0],
      ["desk", "앞좌석 책상 R", 0.550, 0.451, 0, 1.1],
      ["chair", "앞좌석 의자 R", 0.550, 0.490, 180, 1.0],
      ["desk", "뒷좌석 책상 L", 0.450, 0.574, 0, 1.1],
      ["chair", "뒷좌석 의자 L", 0.450, 0.614, 180, 1.0],
      ["desk", "뒷좌석 책상 R", 0.550, 0.574, 0, 1.1],
      ["chair", "뒷좌석 의자 R", 0.550, 0.614, 180, 1.0],
      ["window", "교실 창문", 0.339, 0.5, 90, 1.4, 0.9],
      ["door", "교실 문", 0.661, 0.648, 270, 1.1],
    ],
  },
  corridor: {
    label: "복도",
    items: [
      ["corridor-wall", "왼쪽 벽", 0.439, 0.5, 90, 4.5],
      ["corridor-wall", "오른쪽 벽", 0.561, 0.5, 90, 4.5],
      ["door", "사무실 문", 0.439, 0.401, 90, 1.2],
      ["elevator", "엘리베이터", 0.561, 0.599, 270, 1.3],
    ],
  },
  elevator_lobby: {
    label: "엘리베이터 로비",
    items: [
      ["room", "로비", 0.5, 0.5, 0, 2.0],
      ["elevator", "1호기 엘리베이터", 0.458, 0.302, 0, 1.2],
      ["elevator", "2호기 엘리베이터", 0.542, 0.302, 0, 1.2],
      ["sofa", "대기용 소파 L", 0.394, 0.549, 90, 1.1],
      ["sofa", "대기용 소파 R", 0.606, 0.549, 270, 1.1],
      ["door", "비상문", 0.339, 0.451, 90, 1.1],
    ],
  },
  bathroom: {
    label: "화장실",
    items: [
      ["room", "화장실", 0.5, 0.5, 0, 1.6],
      ["bathtub", "욕조", 0.403, 0.549, 90, 1.2],
      ["toilet", "변기", 0.467, 0.362, 0, 1.1],
      ["sink", "세면대", 0.533, 0.362, 0, 1.2],
      ["washing-machine", "세탁기", 0.597, 0.599, 270, 1.1],
      ["cabinet", "수납장", 0.617, 0.451, 270, 1.2],
      ["window", "환기창", 0.5, 0.327, 0, 1.1, 1.3],
      ["door", "욕실문", 0.617, 0.623, 270, 1.0],
    ],
  },
  train_cabin: {
    label: "기차 객실",
    items: [
      ["train-wall", "좌측 차벽 1", 0.45, 0.33, 90, 3.5],
      ["train-wall", "좌측 차벽 2", 0.45, 0.67, 90, 3.5],
      ["train-wall", "우측 차벽 1", 0.55, 0.33, 90, 3.5],
      ["train-wall", "우측 차벽 2", 0.55, 0.67, 90, 3.5],
      ["train-seat", "좌석 A1", 0.475, 0.377, 180, 1.1],
      ["train-seat", "좌석 A2", 0.475, 0.475, 0, 1.1],
      ["train-seat", "좌석 B1", 0.525, 0.377, 180, 1.1],
      ["train-seat", "좌석 B2", 0.525, 0.475, 0, 1.1],
      ["train-seat", "좌석 A3", 0.475, 0.574, 180, 1.1],
      ["train-seat", "좌석 A4", 0.475, 0.673, 0, 1.1],
      ["train-seat", "좌석 B3", 0.525, 0.574, 180, 1.1],
      ["train-seat", "좌석 B4", 0.525, 0.673, 0, 1.1],
      ["window", "좌측 창문 1", 0.45, 0.426, 90, 1.2, 0.8],
      ["window", "좌측 창문 2", 0.45, 0.623, 90, 1.2, 0.8],
      ["window", "우측 창문 1", 0.55, 0.426, 90, 1.2, 0.8],
      ["window", "우측 창문 2", 0.55, 0.623, 90, 1.2, 0.8],
    ],
  },
  slope_hill: {
    label: "언덕길 (경사/고도)",
    items: [
      ["slope", "오르막길", 0.389, 0.5, 90, 2.5],
      ["stairs", "내리막 계단", 0.611, 0.5, 270, 2.5],
      ["tree", "언덕 위 나무", 0.5, 0.327, 0, 1.8],
    ],
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
const timelineCore = window.FrisFrameTimelineCore;
if (!timelineCore) throw new Error("타임라인 편집 엔진을 불러오지 못했습니다.");
const projectRecoveryCore = window.FrisFrameProjectRecoveryCore;
if (!projectRecoveryCore) throw new Error("프로젝트 복구 엔진을 불러오지 못했습니다.");
const storyboardCore = window.StoryboardCore;
if (!storyboardCore) throw new Error("스토리보드 구성 엔진을 불러오지 못했습니다.");
const poseCore = window.FrisFramePoseCore;
if (!poseCore) throw new Error("배우 포즈 엔진을 불러오지 못했습니다.");
const cameraDraftingCore = window.FrisFrameCameraDraftingCore;
if (!cameraDraftingCore) throw new Error("카메라 초안 엔진을 불러오지 못했습니다.");
const multiCameraCore = window.FrisFrameMultiCameraCore;
if (!multiCameraCore) throw new Error("멀티카메라 엔진을 불러오지 못했습니다.");
const PROJECT_SCHEMA_VERSION = 11;
const SERVICE_NAME = "FrisFrame";
const LAST_MANAGED_PROJECT_KEY = "frisframe:last-managed-project";
const PROJECT_RECOVERY_KEY_PREFIX = "frisframe:project-recovery:v1:";
const {
  activeMotionSegment,
  cameraDirectionVector,
  circularArcPoint,
  constrainPathEndpoint,
  finiteNumber,
  motionSegments,
  normalizePathMode,
  normalizeTransition,
  poseFieldsChanged,
  rescaleKeyframeTimes,
  samplePlanarPath,
  transitionProgress,
} = motionCore;
const {
  collisionEpsilon: timelineCollisionEpsilon,
  expandSynchronizedCutSelection,
  moveSelection: moveTimelineSelection,
  normalizedSelection: normalizeTimelineSelectionIds,
  pasteTimes: resolveTimelinePasteTimes,
  sameTime: sameTimelineTime,
  scaleSelection: scaleTimelineSelection,
  selectionRange: timelineSelectionRange,
  snapStep: timelineSnapStep,
  snapTime: snapTimelineTimeCore,
} = timelineCore;
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
  proceduralLocomotion,
  sanitizeBodyPose,
} = poseCore;
const {
  STAGE_COORD_MIN,
  STAGE_COORD_MAX,
  CAMERA_HEIGHT_MIN,
  CAMERA_HEIGHT_MAX,
  CAMERA_TILT_MIN,
  CAMERA_TILT_MAX,
  CAMERA_FOCAL_MIN,
  CAMERA_FOCAL_MAX,
  draftCameraFromText,
} = cameraDraftingCore;

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
const actorLocomotionModes = {
  auto: "속도에 따라 자동",
  pose: "포즈 유지",
  walk: "걷기",
  run: "달리기",
};
const cameraSensorFormats = {
  "full-frame": { label: "풀프레임", widthMm: 36 },
  "super-35": { label: "Super 35", widthMm: 24.89 },
  "aps-c": { label: "APS-C", widthMm: 23.6 },
  custom: { label: "직접 입력", widthMm: 36 },
};
const CAMERA_SENSOR_WIDTH_MIN = 8;
const CAMERA_SENSOR_WIDTH_MAX = 70;
const CAMERA_APERTURE_MIN = 0.7;
const CAMERA_APERTURE_MAX = 32;
const CAMERA_FOCUS_DISTANCE_MIN = 0.1;
const CAMERA_FOCUS_DISTANCE_MAX = 1000;
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
  cameraSetup: {
    sensorFormat: "full-frame",
    sensorWidthMm: 36,
    apertureFStop: 2.8,
  },
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
    focusDistanceM: 5,
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
      locomotionMode: "auto",
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
let suppressTimelineMarkerClick = false;
let timelineSelectedKeyIds = new Set();
let timelinePrimaryKeyId = null;
let timelineSelectionAnchorId = null;
let timelineClipboard = null;
let timelineSnapMode = loadTimelineSnapMode();
let timelineFocused = false;
let stageRect = { x: 0, y: 0, w: 1, h: 1 };
const STAGE_ZOOM_MIN = 1;
const STAGE_ZOOM_MAX = 4;
const STAGE_WORLD_LONG_EDGE = 36;
const STAGE_GRID_STEP_METERS = 1.5;
const THREE_ORBIT_RADIUS_MIN = 0.15;
const THREE_ORBIT_RADIUS_MAX = 120;
const CAMERA_FRAME_WIDTH_KEY = "frisframe:camera-frame-width";
const CAMERA_FRAME_POSITION_KEY = "frisframe:camera-frame-position";
const CAMERA_FRAME_MIN_WIDTH = 240;
const CAMERA_FRAME_MAX_WIDTH = 760;
let stageZoom = 1;
let stagePanDrag = null;
let stageSpaceHeld = false;
let stageSpacePanUsed = false;
let preview = null;
let viewMode = "2d";
let cameraPreviewMode = "single";
let cameraFrameWidth = loadCameraFrameWidth();
let cameraFramePosition = loadCameraFramePosition();
let cameraFrameResizeDrag = null;
let cameraFrameMoveDrag = null;
let cameraFrameResizeRenderQueued = false;
let threeView = null;
let threeDrag = null;
let threeEditMode = "move";
let selectedPoseActorId = state.items[0].id;
let selectedPoseJoint = "chest";
let selectedPoseCategory = "";
let poseClipboard = null;
const liveSourceEdits = new Map();
const CUSTOM_POSES_KEY = "frisframe:custom-poses";

function clearLiveSourceEdits() {
  liveSourceEdits.clear();
}
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

function focalToFov(focal, sensorWidthMm = 36) {
  const safeFocal = clamp(finiteNumber(focal, 50), CAMERA_FOCAL_MIN, CAMERA_FOCAL_MAX);
  const safeWidth = clamp(finiteNumber(sensorWidthMm, 36), CAMERA_SENSOR_WIDTH_MIN, CAMERA_SENSOR_WIDTH_MAX);
  return (2 * Math.atan(safeWidth / (2 * safeFocal)) * 180) / Math.PI;
}

function sanitizeCameraSetup(setup = {}) {
  const requestedFormat = cameraSensorFormats[setup?.sensorFormat] ? setup.sensorFormat : "full-frame";
  const presetWidth = cameraSensorFormats[requestedFormat].widthMm;
  const width = clamp(finiteNumber(setup?.sensorWidthMm, presetWidth), CAMERA_SENSOR_WIDTH_MIN, CAMERA_SENSOR_WIDTH_MAX);
  const matchingFormat = Object.entries(cameraSensorFormats)
    .find(([id, value]) => id !== "custom" && Math.abs(value.widthMm - width) < 0.01)?.[0];
  return {
    sensorFormat: requestedFormat === "custom" ? "custom" : matchingFormat || "custom",
    sensorWidthMm: Number(width.toFixed(2)),
    apertureFStop: Number(clamp(finiteNumber(setup?.apertureFStop, 2.8), CAMERA_APERTURE_MIN, CAMERA_APERTURE_MAX).toFixed(1)),
  };
}

function cameraSensorWidth(renderState = state) {
  return sanitizeCameraSetup(renderState?.cameraSetup).sensorWidthMm;
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
    tiltDeg: clamp(radToDegSigned(Math.atan2(dy, Math.max(0.0001, horizontal))), -90, 90),
  };
}

function cameraDirection(camera) {
  return cameraDirectionVector(
    normalizePanDeg(camera?.panDeg ?? 180),
    clamp(Number(camera?.tiltDeg ?? 0), CAMERA_TILT_MIN, CAMERA_TILT_MAX),
  );
}

function syncCameraDerivedAim(camera, renderState = state, distanceM = 6) {
  const size = stageWorldSize(renderState);
  const direction = cameraDirection(camera);
  const horizontalScale = Math.max(0.01, Math.hypot(direction.x, direction.z));
  camera.aimX = Number(camera.x) + (direction.x / horizontalScale) * distanceM / size.width;
  camera.aimY = Number(camera.y) + (direction.z / horizontalScale) * distanceM / size.depth;
  camera.focusHeight = clamp(Number(camera.height || 1.6) + Math.tan(degToRad(camera.tiltDeg || 0)) * distanceM, -10, 40);
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
    continuity: { overrides: {} },
    snapshots: { A: null, B: null },
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
  cut.continuity = storyboardCore.normalizedContinuity(metadata.continuity);
  cut.snapshots = sanitizeCutSnapshots(metadata.snapshots);
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

function sanitizeCutSnapshots(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  return {
    A: sanitizeCutSnapshot(source.A, "A"),
    B: sanitizeCutSnapshot(source.B, "B"),
  };
}

function sanitizeCutSnapshot(value, slot) {
  if (!value || typeof value !== "object" || !value.document?.blocking) return null;
  const document = storyboardCore.cutSnapshotDocument({
    ...value.document,
    blocking: sanitizeBlockingDocument(value.document.blocking),
  });
  return {
    name: String(value.name || `${slot}안`).trim().slice(0, 60) || `${slot}안`,
    createdAt: String(value.createdAt || isoNow()),
    document,
  };
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
  syncActiveCameraProfile();
  cut.blocking = state;
  cut.title = String(state.sceneTitle || cut.title || "새 컷");
  cut.intent = String(state.sceneIntent || cut.intent || "");
  if (touch) {
    markCutCreativeChanged(cut);
    cut.updatedAt = isoNow();
    project.updatedAt = cut.updatedAt;
  }
}

function projectCutLocation(cut) {
  for (const scene of project?.scenes || []) {
    const index = scene.cuts.indexOf(cut);
    if (index >= 0) return { scene, index };
  }
  return null;
}

function markCutCreativeChanged(cut) {
  const location = projectCutLocation(cut);
  if (!location) return;
  if (cut.status === "approved") cut.status = "review";
  const following = location.scene.cuts[location.index + 1];
  if (following?.status === "approved") following.status = "review";
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
  clearLiveSourceEdits();
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
  resetTimelineRuntime();
  cut.blocking = state;
  history = [snapshot()];
  setProjectSaveStatus("changed");
  evaluatedViewState = interpolateStateAtTime(state.motion.playhead);
  syncUi();
  draw(evaluatedViewState);
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
    timeline: {
      selectedKeyIds: [...timelineSelectedKeyIds],
      primaryKeyId: primaryTimelineKeyId(),
      rangeAnchorId: timelineSelectionAnchorId,
    },
  });
}

function switchProjectCut(sceneId, cutId, options = {}) {
  const target = findProjectCut(sceneId, cutId);
  if (!target.scene || !target.cut) return false;
  cancelPreview();
  clearLiveSourceEdits();
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
  restoreTimelineRuntime(runtime?.timeline);
  evaluatedViewState = interpolateStateAtTime(state.motion.playhead);
  syncUi();
  draw(evaluatedViewState);
  syncProjectChrome();
  if (options.renderStoryboard !== false && workspaceMode === "storyboard") renderStoryboardWorkspace();
  return true;
}

function loadProjectDocument(nextProject) {
  clearLiveSourceEdits();
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
  resetTimelineRuntime();
  firstScene.cuts[0].blocking = state;
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
  blocking.cameras = (blocking.cameras || []).map((profile) => ({
    ...profile,
    keyframes: (profile.keyframes || []).map((keyframe) => ({
      ...keyframe,
      id: uid(),
      source: "camera",
    })),
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

function cutIssueFindings(cut) {
  const findings = [];
  if (!String(cut.title || "").trim()) findings.push({ id: "required:title", kind: "required", severity: "warning", message: "컷 제목 없음" });
  if (!String(cut.action || "").trim()) findings.push({ id: "required:action", kind: "required", severity: "warning", message: "액션 설명 없음" });
  const keys = cut.blocking?.motion?.keyframes || [];
  if (!keys.length) findings.push({ id: "required:keyframes", kind: "required", severity: "warning", message: "키프레임 없음" });
  if (!keys.some((keyframe) => keyframe.source === "camera")) findings.push({ id: "required:camera-key", kind: "required", severity: "warning", message: "카메라 키 없음" });
  const continuity = storyboardCore.normalizedContinuity(cut.continuity);
  continuityFindingsForCut(cut).forEach((finding) => {
    findings.push({
      ...finding,
      overridden: storyboardCore.findingIsOverridden(finding, continuity),
      override: continuity.overrides[finding.id] || null,
    });
  });
  return findings;
}

function cutIssueList(cut) {
  return cutIssueFindings(cut).filter((finding) => !finding.overridden).map((finding) => finding.message);
}

function continuityFindingsForCut(cut) {
  const location = project?.scenes?.map((scene) => ({ scene, index: scene.cuts.indexOf(cut) }))
    .find((entry) => entry.index >= 0);
  if (!location || location.index === 0) return [];
  const previousCut = location.scene.cuts[location.index - 1];
  return continuityFindings(previousCut, cut);
}

function continuityFindings(previousCut, currentCut) {
  const previousBlocking = previousCut?.blocking;
  const currentBlocking = currentCut?.blocking;
  if (!previousBlocking || !currentBlocking) return [];
  const previousDuration = Number(previousBlocking.motion?.duration || 0);
  const currentDuration = Number(currentBlocking.motion?.duration || 0);
  const previous = resolvedContinuityState(previousBlocking, previousDuration);
  const current = resolvedContinuityState(currentBlocking, 0);
  return storyboardCore.continuityReport({
    previousCutId: previousCut.id,
    previous,
    current,
    previousMotion: continuityBoundaryMotion(previousBlocking, Math.max(0, previousDuration - 0.5), previousDuration),
    currentMotion: continuityBoundaryMotion(currentBlocking, 0, Math.min(currentDuration, 0.5)),
    worldSize: stageWorldSize(currentBlocking),
  });
}

function continuityIdentity(item) {
  return storyboardCore.continuityIdentity(item);
}

function resolvedContinuityState(blocking, time) {
  const evaluated = interpolateRenderStateAtTime(blocking, time);
  return {
    ...evaluated,
    items: evaluated.items.map((item) => resolvedItemPose(item, evaluated)),
  };
}

function continuityBoundaryMotion(blocking, startTime, endTime) {
  if (endTime - startTime < 0.05) return {};
  const start = resolvedContinuityState(blocking, startTime);
  const end = resolvedContinuityState(blocking, endTime);
  const endByIdentity = new Map(end.items.map((item) => [continuityIdentity(item), item]));
  return Object.fromEntries(start.items.flatMap((item) => {
    if (item.type !== "actor") return [];
    const identity = continuityIdentity(item);
    const next = endByIdentity.get(identity);
    if (!next) return [];
    return [[identity, { x: next.x - item.x, y: next.y - item.y }]];
  }));
}

function snapshot() {
  return JSON.stringify(state);
}

function commit({ preserveSourceIds = [] } = {}) {
  evaluatedViewState = interpolateStateAtTime(state.motion.playhead);
  preserveLiveSourcePreview(evaluatedViewState, preserveSourceIds);
  applyActiveCameraTracking(evaluatedViewState, state);
  applyCameraTracking(state);
  syncActiveCameraProfile();
  history.push(snapshot());
  if (history.length > 80) history.shift();
  future = [];
  syncActiveCutDocument();
  setProjectSaveStatus("changed");
  syncUi();
  draw(evaluatedViewState);
  syncProjectChrome();
}

function restore(json) {
  clearLiveSourceEdits();
  state = JSON.parse(json);
  sanitizeState();
  evaluatedViewState = interpolateStateAtTime(state.motion.playhead);
  const cut = currentCut();
  if (cut) cut.blocking = state;
  selected = selectedExists(selected) ? selected : { kind: "camera" };
  setProjectSaveStatus("changed");
  syncUi();
  draw(evaluatedViewState);
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
  const previousStateVersion = Math.max(0, finiteNumber(state.version, 0));
  state.version = 7;
  state.spacePresetId = environmentPresets[state.spacePresetId] ? state.spacePresetId : "";
  state.previs = state.previs || {};
  state.previs.mode = previsModes[state.previs.mode] ? state.previs.mode : "full-scene";
  state.previs.target = previsTargets[state.previs.target] ? state.previs.target : "hybrid";
  state.previs.selectedLayers = normalizeSelection(state.previs.selectedLayers, controlLayers, ["camera", "pose", "depth", "ai-depth", "edges", "masks"]);
  state.previs.exportPresets = normalizeSelection(state.previs.exportPresets, exportPresets, ["seedance", "blender"]);
  delete state.reference;
  delete state.motionPrevis;
  state.cameraSetup = sanitizeCameraSetup(state.cameraSetup);
  state.items = (state.items || []).map((item) => sanitizeItemPose(item));
  sanitizeAutoMountRelationships(state);
  state.groups = sanitizeManualGroups(state.groups, state);
  migrateLegacyMountsToGroups(state);
  state.groups = sanitizeManualGroups(state.groups, state);
  const legacyCameraKeyframes = Array.isArray(state.motion?.keyframes)
    ? state.motion.keyframes.filter((keyframe) => keyframe?.source === "camera")
    : [];
  state.cameras = multiCameraCore.normalizeProfiles(state.cameras, state.camera, legacyCameraKeyframes, state.cameraSetup);
  state.cameras = state.cameras.slice(0, 4);
  if (previousStateVersion < 7) {
    state.cameras.forEach((profile) => {
      profile.keyframes = removeLegacyImplicitInitialKeys(profile.keyframes);
    });
  }
  state.activeCameraId = multiCameraCore.resolveActiveId(state.activeCameraId, state.cameras);
  const activeCameraProfile = multiCameraCore.profileFor(state.cameras, state.activeCameraId);
  const cameraInput = activeCameraProfile?.camera || state.camera;
  state.cameraSetup = sanitizeCameraSetup(activeCameraProfile?.cameraSetup || state.cameraSetup);
  const cameraOrientation = cameraOrientationFromLegacy(cameraInput, state);
  state.camera = {
    x: clamp(finiteNumber(cameraInput?.x, 0.92), STAGE_COORD_MIN, STAGE_COORD_MAX),
    y: clamp(finiteNumber(cameraInput?.y, 0.48), STAGE_COORD_MIN, STAGE_COORD_MAX),
    height: clamp(finiteNumber(cameraInput?.height, 1.6), CAMERA_HEIGHT_MIN, CAMERA_HEIGHT_MAX),
    panDeg: normalizePanDeg(Number.isFinite(Number(cameraInput?.panDeg)) ? cameraInput.panDeg : cameraOrientation.panDeg),
    tiltDeg: clamp(Number.isFinite(Number(cameraInput?.tiltDeg)) ? Number(cameraInput.tiltDeg) : cameraOrientation.tiltDeg, CAMERA_TILT_MIN, CAMERA_TILT_MAX),
    focal: clamp(finiteNumber(cameraInput?.focal, 85), CAMERA_FOCAL_MIN, CAMERA_FOCAL_MAX),
    focusDistanceM: clamp(finiteNumber(cameraInput?.focusDistanceM, 5), CAMERA_FOCUS_DISTANCE_MIN, CAMERA_FOCUS_DISTANCE_MAX),
    trackingTargetId: sanitizeTrackingTargetId(cameraInput?.trackingTargetId, state),
    locks: sanitizeCameraLocks(cameraInput?.locks),
  };
  syncCameraDerivedAim(state.camera, state);
  state.motion = state.motion || {};
  state.motion.duration = clamp(finiteNumber(state.motion.duration, 15), 1, MAX_TIMELINE_DURATION);
  state.motion.fps = clamp(finiteNumber(state.motion.fps, 24), 12, 60);
  state.motion.playhead = clamp(finiteNumber(state.motion.playhead, 0), 0, state.motion.duration);
  state.motion.hiddenSources = normalizeHiddenSources(state.motion.hiddenSources);
  state.motion.timelineView = state.motion.timelineView === "split" ? "split" : "combined";
  const activeProfileKeyframes = multiCameraCore.cameraKeyframes(activeCameraProfile?.keyframes);
  state.motion.keyframes = normalizeKeyframes(state.motion.keyframes)
    .filter((keyframe) => !isSourceHidden(keyframe.source));
  if (previousStateVersion < 7) {
    state.motion.keyframes = removeLegacyImplicitInitialKeys(state.motion.keyframes);
  }
  const normalizedCameraKeyframes = normalizeKeyframes(activeProfileKeyframes);
  state.motion.keyframes = [
    ...state.motion.keyframes.filter((keyframe) => keyframe.source !== "camera"),
    ...normalizedCameraKeyframes,
  ];
  const groupedFollowerIds = new Set(state.groups
    .flatMap((group) => group.members.filter((member) => member.itemId !== group.leaderId).map((member) => member.itemId)));
  state.motion.keyframes = state.motion.keyframes.filter((keyframe) => !groupedFollowerIds.has(keyframe.source));
  // Legacy start/end poses are no longer promoted to timeline keys. A key is
  // created only by an explicit keyframe action from the user.
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
  state.annotations = Array.isArray(state.annotations) ? state.annotations : [];
}

function removeLegacyImplicitInitialKeys(keyframes) {
  const keys = Array.isArray(keyframes) ? keyframes : [];
  const counts = new Map();
  keys.forEach((keyframe) => {
    const source = String(keyframe?.source || "camera");
    counts.set(source, (counts.get(source) || 0) + 1);
  });
  return keys.filter((keyframe) => {
    const source = String(keyframe?.source || "camera");
    const isImplicitInitialKey = counts.get(source) === 1
      && Math.abs(finiteNumber(keyframe?.time, 0)) < 0.001
      && String(keyframe?.label || "키 1").trim() === "키 1"
      && !String(keyframe?.note || "").trim();
    return !isImplicitInitialKey;
  });
}

function activeCameraProfile(renderState = state) {
  const profiles = multiCameraCore.normalizeProfiles(
    renderState?.cameras,
    renderState?.camera,
    renderState?.motion?.keyframes?.filter((keyframe) => keyframe?.source === "camera"),
    renderState?.cameraSetup,
  );
  const id = multiCameraCore.resolveActiveId(renderState?.activeCameraId, profiles);
  return multiCameraCore.profileFor(profiles, id);
}

function cameraPreviewProfiles(renderState = state) {
  return multiCameraCore.normalizeProfiles(
    renderState?.cameras,
    renderState?.camera,
    renderState?.motion?.keyframes?.filter((keyframe) => keyframe?.source === "camera"),
    renderState?.cameraSetup,
  );
}

function cameraPreviewProfile(renderState = state, profileId = null) {
  const profiles = cameraPreviewProfiles(renderState);
  const activeId = multiCameraCore.resolveActiveId(renderState?.activeCameraId, profiles);
  const profile = multiCameraCore.profileFor(profiles, profileId || activeId);
  if (!profile) return null;

  // The active camera object is the live source of truth. Its profile can lag
  // behind while a keyframe is being evaluated or a control is being dragged.
  if (profile.id !== activeId) return profile;
  return {
    ...profile,
    camera: clone(renderState.camera),
    cameraSetup: clone(renderState.cameraSetup),
    keyframes: clone(renderState.motion?.keyframes?.filter((keyframe) => keyframe?.source === "camera")) || [],
  };
}

function cameraPreviewDocument(renderState = state, profileId = null) {
  const profiles = cameraPreviewProfiles(renderState);
  const activeId = multiCameraCore.resolveActiveId(renderState?.activeCameraId, profiles);
  const profile = multiCameraCore.profileFor(profiles, profileId || activeId);
  if (!profile) return clone(renderState);

  const previewState = multiCameraCore.applyProfile(renderState, profile.id);
  if (profile.id === activeId) {
    previewState.camera = clone(renderState.camera);
    previewState.cameraSetup = clone(renderState.cameraSetup);
    previewState.motion.keyframes = multiCameraCore.mergeCameraKeyframes(
      previewState.motion.keyframes,
      renderState.motion?.keyframes?.filter((keyframe) => keyframe?.source === "camera") || [],
    );
  }
  return applyCameraTracking(previewState);
}

function syncActiveCameraProfile(renderState = state) {
  if (!renderState || !Array.isArray(renderState.cameras)) return;
  const profile = renderState.cameras.find((entry) => entry.id === renderState.activeCameraId)
    || renderState.cameras[0];
  if (!profile) return;
  profile.camera = clone(renderState.camera);
  profile.cameraSetup = clone(renderState.cameraSetup);
  profile.keyframes = clone((renderState.motion?.keyframes || [])
    .filter((keyframe) => keyframe.source === "camera"));
}

function cameraDocumentForProfile(documentState, profileId) {
  if (documentState === state) syncActiveCameraProfile(documentState);
  return multiCameraCore.applyProfile(documentState, profileId);
}

function cameraProfileName(renderState = state) {
  return activeCameraProfile(renderState)?.name || "카메라";
}

function cameraProfileCount(renderState = state) {
  return multiCameraCore.normalizeProfiles(renderState?.cameras, renderState?.camera, [], renderState?.cameraSetup).length;
}

function switchActiveCamera(profileId) {
  const current = activeCameraProfile();
  if (!current || current.id === profileId) return;
  const nextProfile = state.cameras.find((profile) => profile.id === profileId);
  if (!nextProfile) return;
  syncActiveCameraProfile();
  // Unkeyed camera edits are preview-only and use the generic "camera" source.
  // Never carry that preview pose into another camera rig when changing the
  // active profile; the outgoing rig has already been persisted above.
  liveSourceEdits.delete("camera");
  // Camera selection is a read-only operation for every rig transform. Keep an
  // authoritative snapshot so normalization or preview evaluation cannot move
  // any camera merely because another camera became active.
  const preservedCameraTransforms = new Map(state.cameras.map((profile) => [
    profile.id,
    clone(profile.camera),
  ]));
  state.activeCameraId = nextProfile.id;
  state.camera = clone(nextProfile.camera) || {};
  state.cameraSetup = sanitizeCameraSetup(nextProfile.cameraSetup || state.cameraSetup);
  applyCameraTracking(state);
  selected = { kind: "camera" };
  sanitizeState();
  state.cameras.forEach((profile) => {
    const preserved = preservedCameraTransforms.get(profile.id);
    if (preserved) profile.camera = clone(preserved);
  });
  const preservedActive = state.cameras.find((profile) => profile.id === state.activeCameraId);
  if (preservedActive?.camera) {
    state.camera = clone(preservedActive.camera);
    applyCameraTracking(state);
  }
  evaluatedViewState = interpolateStateAtTime(state.motion.playhead);
  syncActiveCutDocument(false);
  setProjectSaveStatus("changed");
  syncUi();
  draw(evaluatedViewState);
  syncProjectChrome();
  notifyApp(`${nextProfile.name}을(를) 편집합니다.`);
}

function duplicateCameraProfile(profileId = state.activeCameraId) {
  syncActiveCameraProfile();
  const source = state.cameras.find((profile) => profile.id === profileId) || activeCameraProfile();
  if (!source) return;
  const index = state.cameras.length;
  const duplicateCamera = clone(source.camera);
  // A duplicated camera should be immediately visible on the field. Keep the
  // framing settings, but place the new rig in a nearby slot instead of
  // stacking it exactly under the source camera.
  const displayOffsets = [
    { x: 0.06, y: 0.06 },
    { x: -0.06, y: 0.06 },
    { x: 0.06, y: -0.06 },
    { x: -0.06, y: -0.06 },
  ];
  const offset = displayOffsets[index % displayOffsets.length];
  duplicateCamera.x = clamp(finiteNumber(duplicateCamera.x, state.camera.x) + offset.x, STAGE_COORD_MIN, STAGE_COORD_MAX);
  duplicateCamera.y = clamp(finiteNumber(duplicateCamera.y, state.camera.y) + offset.y, STAGE_COORD_MIN, STAGE_COORD_MAX);
  const copy = multiCameraCore.createProfile(
    uid(),
    `카메라 ${String.fromCharCode(65 + Math.min(index, 25))}`,
    multiCameraCore.DEFAULT_COLORS[index % multiCameraCore.DEFAULT_COLORS.length],
    duplicateCamera,
    (source.keyframes || []).map((keyframe) => ({ ...clone(keyframe), id: uid(), source: "camera" })),
    source.cameraSetup,
  );
  state.cameras.push(copy);
  state = cameraDocumentForProfile(state, copy.id);
  selected = { kind: "camera" };
  sanitizeState();
  commit();
  revealCameraRigRow(copy.id);
  notifyApp(`${copy.name}을(를) 추가했습니다.`);
}

function addCameraProfile() {
  if (state.cameras.length >= 4) {
    notifyApp("멀티카메라는 최대 4대까지 사용할 수 있습니다.");
    return;
  }
  duplicateCameraProfile(state.activeCameraId);
}

function deleteCameraProfile(profileId = state.activeCameraId) {
  if (state.cameras.length <= 1) {
    notifyApp("카메라는 최소 1대가 필요합니다.");
    return;
  }
  const target = state.cameras.find((profile) => profile.id === profileId);
  if (!target || !confirm(`${target.name}을(를) 삭제할까요?\n이 카메라의 구도와 키프레임이 삭제됩니다.`)) return;
  syncActiveCameraProfile();
  state.cameras = state.cameras.filter((profile) => profile.id !== profileId);
  const next = state.cameras[0];
  state = cameraDocumentForProfile(state, next.id);
  selected = { kind: "camera" };
  sanitizeState();
  commit();
  notifyApp(`${target.name}을(를) 삭제했습니다.`);
}

function revealCameraRigRow(profileId) {
  const row = [...document.querySelectorAll(".camera-rig-row")]
    .find((entry) => entry.dataset.cameraId === profileId);
  if (!row) return;
  row.scrollIntoView({ block: "nearest", inline: "nearest" });
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
  if (locks.lens) {
    next.focal = previousPose.focal;
    next.focusDistanceM = previousPose.focusDistanceM;
  }
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

function selectedPoseActor() {
  const current = selectedItem();
  if (current?.type === "actor") return current;
  const remembered = state.items.find((item) => item.id === selectedPoseActorId && item.type === "actor");
  if (remembered) {
    selected = { kind: "item", id: remembered.id };
    return remembered;
  }
  const firstActor = state.items.find((item) => item.type === "actor" && item.visible !== false);
  if (firstActor) {
    selected = { kind: "item", id: firstActor.id };
    selectedPoseActorId = firstActor.id;
  }
  return firstActor || null;
}

function sourceDefinitions(renderState = state) {
  const cameraProfile = activeCameraProfile(renderState);
  return [
    { id: "camera", type: "camera", name: cameraProfile?.name || "카메라", color: cameraProfile?.color || "#71b8ff" },
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

function advancePlayheadAfterKeyframe(time = state.motion.playhead) {
  const requestedTime = Number((clamp(Number(time) || 0, 0, MAX_TIMELINE_DURATION) + 3).toFixed(2));
  const nextTime = Math.min(requestedTime, MAX_TIMELINE_DURATION);
  ensureDurationCovers(nextTime);
  state.motion.playhead = nextTime;
  return nextTime;
}

function poseForSource(sourceId) {
  if (sourceId === "camera") return clone(state.camera);
  const item = state.items.find((entry) => entry.id === sourceId);
  return item ? clone(item) : null;
}

function liveKeyframeForSource(sourceId, time = state.motion.playhead) {
  return keysForSource(sourceId).find((entry) => timelineTimesMatch(entry.time, time)) || null;
}

function rememberLiveSourceEdit(sourceId) {
  if (!sourceId) return;
  const currentPose = poseForSource(sourceId);
  if (!currentPose) return;
  const time = state.motion.playhead;
  // Scene edits and timeline keys are independent. Even when a key exists at
  // this time, keep the edited scene pose as a preview without rewriting it.
  liveSourceEdits.set(sourceId, { time, pose: currentPose });
}

function clearLiveSourceEdit(sourceId, time = state.motion.playhead) {
  const pending = liveSourceEdits.get(sourceId);
  if (!pending || timelineTimesMatch(pending.time, time)) liveSourceEdits.delete(sourceId);
}

function applyLiveSourceEdits(renderState, time) {
  liveSourceEdits.forEach((entry, sourceId) => {
    if (!timelineTimesMatch(entry.time, time)) return;
    if (sourceId === "camera") {
      renderState.camera = syncCameraDerivedAim(
        sanitizeCameraPoseFor(renderState, entry.pose),
        renderState,
      );
      return;
    }
    const itemIndex = renderState.items.findIndex((item) => item.id === sourceId);
    if (itemIndex < 0) return;
    const fallback = renderState.items[itemIndex];
    renderState.items[itemIndex] = preserveItemStructure(
      sanitizeItemPose({ ...fallback, ...entry.pose, id: sourceId }),
      fallback,
    );
  });
  return renderState;
}

function updateExistingSourceKeyframe(sourceId, time = state.motion.playhead) {
  const keyframe = keysForSource(sourceId)
    .find((entry) => timelineTimesMatch(entry.time, time));
  const currentPose = poseForSource(sourceId);
  if (!keyframe || !currentPose) return false;
  keyframe.pose = sourceId === "camera"
    ? mergeLockedCameraPose(currentPose, keyframe.pose)
    : sanitizeSourcePose(sourceId, currentPose);
  clearLiveSourceEdit(sourceId, time);
  return true;
}

function preserveLiveSourcePreview(renderState, sourceIds = []) {
  if (!renderState || !Array.isArray(sourceIds)) return renderState;
  sourceIds.filter(Boolean).forEach((sourceId) => {
    rememberLiveSourceEdit(sourceId);
    const currentPose = poseForSource(sourceId);
    if (!currentPose) return;
    if (sourceId === "camera") {
      renderState.camera = currentPose;
      return;
    }
    const itemIndex = renderState.items.findIndex((item) => item.id === sourceId);
    if (itemIndex >= 0) renderState.items[itemIndex] = currentPose;
  });
  renderState.motion.playhead = state.motion.playhead;
  return renderState;
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
  const existing = keysForSource("camera").find((keyframe) => timelineTimesMatch(keyframe.time, requestedTime));
  if (existing) {
    existing.pose = sanitizeCameraPose({ ...existing.pose, height: state.camera.height });
    setTimelineSelection([existing.id], existing.id);
    advancePlayheadAfterKeyframe(existing.time);
    commit();
    notifyApp(`${existing.time.toFixed(1)}초 카메라 키의 높이를 갱신했습니다.`);
    return;
  }
  const time = availableKeyTime(requestedTime, "camera", { maxTime: MAX_TIMELINE_DURATION });
  ensureDurationCovers(time);
  const pathMode = $("#keyPathSelect")?.value || "straight";
  const keyframe = captureSourceKeyframe("camera", time, undefined, pathMode);
  if (!keyframe) return;
  applyPathModeToKeyframe(keyframe, pathMode);
  state.motion.keyframes.push(keyframe);
  setTimelineSelection([keyframe.id], keyframe.id);
  state.motion.playhead = keyframe.time;
  state.motion.keyframes = sortKeyframes(state.motion.keyframes);
  clearLiveSourceEdit("camera", keyframe.time);
  advancePlayheadAfterKeyframe(keyframe.time);
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
    locomotionMode: definition.type === "actor" && actorLocomotionModes[definition.locomotionMode]
      ? definition.locomotionMode
      : "auto",
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
    x: clamp(finiteNumber(camera.x, state.camera.x), STAGE_COORD_MIN, STAGE_COORD_MAX),
    y: clamp(finiteNumber(camera.y, state.camera.y), STAGE_COORD_MIN, STAGE_COORD_MAX),
    height: clamp(finiteNumber(camera.height, state.camera.height ?? 1.6), CAMERA_HEIGHT_MIN, CAMERA_HEIGHT_MAX),
    panDeg: normalizePanDeg(Number.isFinite(Number(camera.panDeg)) ? camera.panDeg : orientation.panDeg),
    tiltDeg: clamp(Number.isFinite(Number(camera.tiltDeg)) ? Number(camera.tiltDeg) : orientation.tiltDeg, CAMERA_TILT_MIN, CAMERA_TILT_MAX),
    focal: clamp(finiteNumber(camera.focal, state.camera.focal), CAMERA_FOCAL_MIN, CAMERA_FOCAL_MAX),
    focusDistanceM: clamp(finiteNumber(camera.focusDistanceM, state.camera.focusDistanceM ?? 5), CAMERA_FOCUS_DISTANCE_MIN, CAMERA_FOCUS_DISTANCE_MAX),
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
    ? actorFocusHeight(item)
    : Number(item.mountedHeight || 0)
      + propDefinition(item.assetType).height * Number(item.size || 1) * Number(item.scaleY || 1) * 0.55;
  const aspect = aspectMap[renderState.aspect] || 16 / 9;
  const verticalFov = degToRad(horizontalFovToVerticalFov(focalToFov(camera.focal, cameraSensorWidth(renderState)), aspect));
  const faceAngle = Math.atan2(subjectHeight - Number(camera.height || 1.6), horizontalDistance);
  const framingOffset = Math.atan(
    (0.5 - CINEMATIC_FACE_SCREEN_Y) * 2 * Math.tan(verticalFov / 2),
  );
  return {
    panDeg: normalizePanDeg(radToDeg(Math.atan2(dz, dx))),
    tiltDeg: clamp(radToDegSigned(faceAngle - framingOffset), -90, 90),
  };
}

function actorFocusHeight(item) {
  const scale = Number(item?.size || 1);
  const base = Number(item?.verticalOffset || 0) + Number(item?.mountedHeight || 0);
  const pitchAmount = clamp(Math.abs(Number(item?.pitch || 0)) / 90, 0, 1);
  return base + lerp(1.78, 0.45, pitchAmount) * scale;
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

function applyActiveCameraTracking(renderState, sourceState = renderState) {
  if (!renderState?.camera) return renderState;
  // Tracking is a camera-level setting. A keyed framing pose must not erase
  // the target selected in the camera panel during interpolation.
  renderState.camera.trackingTargetId = sanitizeTrackingTargetId(
    sourceState?.camera?.trackingTargetId,
    renderState,
  );
  return applyCameraTracking(renderState);
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
    locomotionMode: type === "actor" && actorLocomotionModes[item.locomotionMode] ? item.locomotionMode : "auto",
    assetType,
    scaleX: clamp(finiteNumber(item.scaleX, 1), 0.25, 3.5),
    scaleY: clamp(finiteNumber(item.scaleY, 1), 0.25, 3.5),
    scaleZ: clamp(finiteNumber(item.scaleZ, 1), 0.25, 3.5),
    verticalOffset: type === "actor" ? clamp(finiteNumber(item.verticalOffset, 0), -1, 5) : 0,
    pitch: type === "actor" ? clamp(finiteNumber(item.pitch, 0), -90, 90) : 0,
    mountedHeight: type === "prop" ? clamp(finiteNumber(item.mountedHeight, 0), -1, 5) : 0,
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

function loadTimelineSnapMode() {
  try {
    const value = localStorage.getItem("frisframe:timeline-snap");
    return ["frame", "0.1", "0.5", "1", "off"].includes(value) ? value : "frame";
  } catch {
    return "frame";
  }
}

function saveTimelineSnapMode() {
  try {
    localStorage.setItem("frisframe:timeline-snap", timelineSnapMode);
  } catch {
    // The editor still works when browser storage is unavailable.
  }
}

function timelineTimesMatch(first, second) {
  return sameTimelineTime(first, second, timelineCollisionEpsilon(timelineSnapMode, state.motion?.fps || 24));
}

function snapTimelineTime(value, minimum = 0, maximum = state.motion?.duration ?? MAX_TIMELINE_DURATION) {
  return snapTimelineTimeCore(value, timelineSnapMode, state.motion?.fps || 24, minimum, maximum);
}

function formatTimelineTime(value) {
  const digits = timelineSnapMode === "frame" ? 4 : timelineSnapMode === "off" ? 2 : String(timelineSnapMode).includes(".") ? 1 : 0;
  return Number(value || 0).toFixed(digits);
}

function resetTimelineRuntime(preferredKeyId = state.motion?.selectedKeyId) {
  const preferred = selectedKeyframeExists(preferredKeyId) ? preferredKeyId : null;
  timelineSelectedKeyIds = new Set(preferred ? [preferred] : []);
  timelinePrimaryKeyId = preferred;
  timelineSelectionAnchorId = preferred;
}

function restoreTimelineRuntime(runtime) {
  const normalized = normalizeTimelineSelectionIds(
    state.motion.keyframes,
    runtime?.selectedKeyIds || [],
    runtime?.primaryKeyId || "",
  );
  if (!normalized.ids.length) {
    resetTimelineRuntime();
    return;
  }
  timelineSelectedKeyIds = new Set(normalized.ids);
  timelinePrimaryKeyId = normalized.primaryId || null;
  timelineSelectionAnchorId = selectedKeyframeExists(runtime?.rangeAnchorId)
    ? runtime.rangeAnchorId
    : timelinePrimaryKeyId;
}

function normalizeTimelineRuntime() {
  const normalized = normalizeTimelineSelectionIds(
    state.motion.keyframes,
    timelineSelectedKeyIds,
    timelinePrimaryKeyId || "",
  );
  timelineSelectedKeyIds = new Set(normalized.ids);
  timelinePrimaryKeyId = normalized.primaryId || null;
  if (!selectedKeyframeExists(timelineSelectionAnchorId)) timelineSelectionAnchorId = timelinePrimaryKeyId;
  return normalized;
}

function setTimelineSelection(ids, primaryKeyId = "", options = {}) {
  const expandedIds = options.expandCuts === false
    ? Array.from(ids || [])
    : expandSynchronizedCutSelection(state.motion.keyframes, ids || []);
  const normalized = normalizeTimelineSelectionIds(state.motion.keyframes, expandedIds, primaryKeyId);
  timelineSelectedKeyIds = new Set(normalized.ids);
  timelinePrimaryKeyId = normalized.primaryId || null;
  if (options.updateAnchor !== false) timelineSelectionAnchorId = timelinePrimaryKeyId;
  return normalized;
}

function primaryTimelineKeyId() {
  normalizeTimelineRuntime();
  return timelinePrimaryKeyId;
}

function selectedTimelineKeyframes(options = {}) {
  normalizeTimelineRuntime();
  const ids = options.expandCuts === false
    ? [...timelineSelectedKeyIds]
    : expandSynchronizedCutSelection(state.motion.keyframes, timelineSelectedKeyIds);
  const selectedIds = new Set(ids);
  return sortKeyframes(state.motion.keyframes).filter((keyframe) => selectedIds.has(keyframe.id));
}

function selectedKeyIdForRender(renderState = state) {
  if (renderState === state || renderState === evaluatedViewState) return primaryTimelineKeyId();
  return renderState.motion?.selectedKeyId || null;
}

function selectedKeyframe() {
  const id = primaryTimelineKeyId();
  return state.motion.keyframes.find((keyframe) => keyframe.id === id) || null;
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
  setTimelineSelection(keyframe ? [keyframe.id] : [], keyframe?.id || "");
  return keyframe;
}

function previewKeyframeOnStage(keyframe) {
  if (!keyframe) return;
  evaluatedViewState = interpolateStateAtTime(keyframe.time);
  evaluatedViewState.motion.playhead = keyframe.time;
  setTimelineSelection([keyframe.id], keyframe.id);
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
    if (viewMode === "3d") resizeThreeView();
    else if (threeView?.ready) {
      clampSavedCameraFramePosition();
      renderCameraFramePreview(evaluatedViewState || state);
    }
    return;
  }
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  draw();
  if (viewMode === "3d") resizeThreeView();
  else if (threeView?.ready) {
    clampSavedCameraFramePosition();
    renderCameraFramePreview(evaluatedViewState || state);
  }
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
  if (viewMode === "3d") {
    renderThreeView(renderState);
  } else if (initThreeView()) {
    // The camera-frame renderer is shared by both tabs; the 2D tab only hides
    // the editable 3D viewport, not the live camera preview.
    renderCameraFramePreview(renderState);
  }
  if (typeof drawAnnotations === "function") drawAnnotations();
}

function drawStage(renderState, rect, options = {}) {
  const clean = options.clean ?? false;
  ctx.save();
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 2);
  ctx.clip();
  ctx.fillStyle = "#0d1116";
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

  if (renderState.showGrid && !(clean && renderState.cleanExport)) drawGrid(rect, renderState);
  const cameraEntries = cameraFieldRenderEntries(renderState);
  if (renderState.showCamera) {
    cameraEntries.forEach((entry) => {
      drawCameraCone(entry.profileState.camera, rect, clean, renderState, entry.profile.color, entry.active);
    });
  }
  if (!(clean && renderState.cleanExport)) drawMotionPaths(renderState, rect);

  const sorted = [...renderState.items].sort((a, b) => resolvedItemPose(a, renderState).y - resolvedItemPose(b, renderState).y);
  sorted.forEach((item) => drawItem(item, rect, renderState, clean));
  cameraEntries.forEach((entry) => {
    drawCamera(entry.profileState.camera, rect, clean, entry.profile.color, entry.active, entry.profile.name);
  });

  if (!(clean && renderState.cleanExport)) drawFooter(renderState, rect);
  if (!(clean && renderState.cleanExport)) drawStageAnnotations(renderState, rect);
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

function loadCameraFrameWidth() {
  try {
    const value = Number(window.localStorage.getItem(CAMERA_FRAME_WIDTH_KEY));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

function loadCameraFramePosition() {
  try {
    const value = JSON.parse(window.localStorage.getItem(CAMERA_FRAME_POSITION_KEY) || "null");
    return Number.isFinite(value?.x) && Number.isFinite(value?.y)
      ? { x: value.x, y: value.y }
      : null;
  } catch {
    return null;
  }
}

function cameraFrameWidthBounds() {
  const frame = $("#cameraFrame");
  const parentWidth = frame?.parentElement?.clientWidth || window.innerWidth || CAMERA_FRAME_MAX_WIDTH;
  const max = Math.max(160, Math.min(CAMERA_FRAME_MAX_WIDTH, parentWidth - 28));
  return {
    min: Math.min(CAMERA_FRAME_MIN_WIDTH, max),
    max,
  };
}

function updateCameraFrameResizeHandle() {
  const frame = $("#cameraFrame");
  const handle = $("#cameraFrameResizeHandle");
  if (!frame || !handle) return;
  const width = Math.round(frame.getBoundingClientRect().width);
  const bounds = cameraFrameWidthBounds();
  handle.setAttribute("aria-valuemin", String(Math.round(bounds.min)));
  handle.setAttribute("aria-valuemax", String(Math.round(bounds.max)));
  handle.setAttribute("aria-valuenow", String(width));
}

function scheduleCameraFrameResizeRender() {
  if (cameraFrameResizeRenderQueued) return;
  cameraFrameResizeRenderQueued = true;
  requestAnimationFrame(() => {
    cameraFrameResizeRenderQueued = false;
    if (threeView?.ready) renderCameraFramePreview(evaluatedViewState || threeView.lastState || state);
  });
}

function setCameraFrameWidth(width, { persist = true, render = true } = {}) {
  const frame = $("#cameraFrame");
  if (!frame) return;
  if (!Number.isFinite(Number(width))) {
    cameraFrameWidth = null;
    frame.style.removeProperty("--camera-frame-width");
  } else {
    const bounds = cameraFrameWidthBounds();
    cameraFrameWidth = Math.round(clamp(Number(width), bounds.min, bounds.max));
    frame.style.setProperty("--camera-frame-width", `${cameraFrameWidth}px`);
    if (persist) {
      try {
        window.localStorage.setItem(CAMERA_FRAME_WIDTH_KEY, String(cameraFrameWidth));
      } catch {
        // A private or restricted storage context should not block resizing.
      }
    }
  }
  updateCameraFrameResizeHandle();
  if (render) scheduleCameraFrameResizeRender();
}

function applyCameraFramePositionStyle() {
  const frame = $("#cameraFrame");
  if (!frame || !cameraFramePosition) return;
  frame.style.left = String(cameraFramePosition.x) + "px";
  frame.style.top = String(cameraFramePosition.y) + "px";
  frame.style.right = "auto";
  frame.style.bottom = "auto";
}

function setCameraFramePosition(x, y, { persist = true } = {}) {
  const frame = $("#cameraFrame");
  const parent = frame?.parentElement;
  if (!frame || !parent) return;
  const frameRect = frame.getBoundingClientRect();
  const parentWidth = parent.clientWidth;
  const parentHeight = parent.clientHeight;
  if (frameRect.width < 1 || frameRect.height < 1 || parentWidth < 1 || parentHeight < 1) return;
  const inset = 10;
  const maxX = Math.max(inset, parentWidth - frameRect.width - inset);
  const maxY = Math.max(inset, parentHeight - frameRect.height - inset);
  cameraFramePosition = {
    x: Math.round(clamp(Number(x), inset, maxX)),
    y: Math.round(clamp(Number(y), inset, maxY)),
  };
  applyCameraFramePositionStyle();
  if (persist) {
    try {
      window.localStorage.setItem(CAMERA_FRAME_POSITION_KEY, JSON.stringify(cameraFramePosition));
    } catch {
      // A private or restricted storage context should not block moving the frame.
    }
  }
}

function clampSavedCameraFramePosition() {
  if (!cameraFramePosition) return;
  setCameraFramePosition(cameraFramePosition.x, cameraFramePosition.y);
}

function setupCameraFrameResize() {
  const handle = $("#cameraFrameResizeHandle");
  const moveHandle = $("#cameraFrameMoveHandle");
  if (!handle || handle.dataset.ready === "true") return;
  handle.dataset.ready = "true";
  handle.setAttribute("role", "slider");
  handle.setAttribute("aria-orientation", "horizontal");
  if (cameraFrameWidth != null) {
    // Apply the saved preference before layout. It will be clamped on the
    // first user drag, after the shared canvas wrapper has a real width.
    const frame = $("#cameraFrame");
    frame?.style.setProperty("--camera-frame-width", `${cameraFrameWidth}px`);
  }
  updateCameraFrameResizeHandle();
  applyCameraFramePositionStyle();

  if (moveHandle) {
    moveHandle.addEventListener("pointerdown", (event) => {
      if (event.button != null && event.button !== 0) return;
      const frame = $("#cameraFrame");
      if (!frame) return;
      event.preventDefault();
      event.stopPropagation();
      const rect = frame.getBoundingClientRect();
      moveHandle.setPointerCapture?.(event.pointerId);
      cameraFrameMoveDrag = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startLeft: rect.left - frame.parentElement.getBoundingClientRect().left,
        startTop: rect.top - frame.parentElement.getBoundingClientRect().top,
      };
      moveHandle.classList.add("is-dragging");
    });

    moveHandle.addEventListener("pointermove", (event) => {
      if (!cameraFrameMoveDrag || event.pointerId !== cameraFrameMoveDrag.pointerId) return;
      event.preventDefault();
      event.stopPropagation();
      setCameraFramePosition(
        cameraFrameMoveDrag.startLeft + (event.clientX - cameraFrameMoveDrag.startX),
        cameraFrameMoveDrag.startTop + (event.clientY - cameraFrameMoveDrag.startY),
      );
    });

    const finishMove = (event) => {
      if (!cameraFrameMoveDrag || event.pointerId !== cameraFrameMoveDrag.pointerId) return;
      moveHandle.releasePointerCapture?.(event.pointerId);
      cameraFrameMoveDrag = null;
      moveHandle.classList.remove("is-dragging");
    };
    moveHandle.addEventListener("pointerup", finishMove);
    moveHandle.addEventListener("pointercancel", finishMove);
  }

  handle.addEventListener("pointerdown", (event) => {
    if (event.button != null && event.button !== 0) return;
    const frame = $("#cameraFrame");
    if (!frame) return;
    event.preventDefault();
    event.stopPropagation();
    cameraFrameResizeDrag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth: frame.getBoundingClientRect().width,
    };
    handle.setPointerCapture?.(event.pointerId);
    handle.classList.add("is-dragging");
  });

  handle.addEventListener("pointermove", (event) => {
    if (!cameraFrameResizeDrag || event.pointerId !== cameraFrameResizeDrag.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    // The handle is anchored to the lower-left corner, so dragging left grows
    // the frame while dragging right makes it smaller.
    setCameraFrameWidth(
      cameraFrameResizeDrag.startWidth - (event.clientX - cameraFrameResizeDrag.startX),
    );
  });

  const finishResize = (event) => {
    if (!cameraFrameResizeDrag || event.pointerId !== cameraFrameResizeDrag.pointerId) return;
    handle.releasePointerCapture?.(event.pointerId);
    cameraFrameResizeDrag = null;
    handle.classList.remove("is-dragging");
    updateCameraFrameResizeHandle();
  };
  handle.addEventListener("pointerup", finishResize);
  handle.addEventListener("pointercancel", finishResize);
  handle.addEventListener("keydown", (event) => {
    const step = event.shiftKey ? 80 : 24;
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const current = $("#cameraFrame")?.getBoundingClientRect().width || CAMERA_FRAME_MIN_WIDTH;
    setCameraFrameWidth(current + (event.key === "ArrowLeft" ? step : -step));
  });
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
  scene.fog = new THREE.Fog("#111820", 120, 300);

  const previewScene = new THREE.Scene();
  previewScene.background = new THREE.Color("#111820");
  previewScene.fog = null;
  const previewWorld = new THREE.Group();
  previewScene.add(previewWorld);

  const camera3d = new THREE.PerspectiveCamera(48, 1, 0.1, 500);
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

  const frameCamera = new THREE.PerspectiveCamera(42, 16 / 9, 0.05, 500);
  const frameRenderer = new THREE.WebGLRenderer({
    canvas: frameCanvas,
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true,
  });
  frameRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  frameRenderer.outputColorSpace = THREE.SRGBColorSpace;
  frameRenderer.setClearColor("#111820", 1);
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

  previewScene.add(new THREE.HemisphereLight("#dff7ff", "#283038", 1.42));
  const previewKeyLight = new THREE.DirectionalLight("#fff8ed", 1.7);
  previewKeyLight.position.set(5, 8, 4);
  previewKeyLight.castShadow = true;
  previewKeyLight.shadow.mapSize.set(1024, 1024);
  previewKeyLight.shadow.camera.left = -18;
  previewKeyLight.shadow.camera.right = 18;
  previewKeyLight.shadow.camera.top = 18;
  previewKeyLight.shadow.camera.bottom = -18;
  previewScene.add(previewKeyLight);
  const previewFillLight = new THREE.DirectionalLight("#7ec8ff", 0.72);
  previewFillLight.position.set(-4, 4, -6);
  previewScene.add(previewFillLight);

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
    previewScene,
    camera: camera3d,
    renderer,
    world,
    previewWorld,
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
  frameCanvas.addEventListener("click", selectCameraPreviewSlot);
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

function clearThreePreviewWorld() {
  if (!threeView?.previewWorld) return;
  while (threeView.previewWorld.children.length) {
    const child = threeView.previewWorld.children.pop();
    disposeThreeObject(child);
  }
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
    clampSavedCameraFramePosition();
    const frameRect = threeView.frameWrap.getBoundingClientRect();
    const frameWidth = Math.max(1, frameRect.width);
    const frameHeight = Math.max(1, frameRect.height);
    threeView.frameCamera.aspect = frameWidth / frameHeight;
    threeView.frameCamera.updateProjectionMatrix();
    threeView.frameRenderer.setSize(frameWidth, frameHeight, false);
    threeView.frameRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  }
  if (viewMode === "3d") renderThreeView(threeView.lastState || state, true);
  else renderCameraFramePreview(threeView.lastState || evaluatedViewState || state);
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
  const cameraEntries = cameraFieldRenderEntries(renderState);
  const activeCameraId = multiCameraCore.resolveActiveId(
    renderState.activeCameraId,
    cameraEntries.map((entry) => entry.profile),
  );
  const cameraRigs = cameraEntries.map(({ profile, profileState, fieldOffset }) => {
    const cameraRig = makeThreeCamera(
      profileState.camera,
      profileState,
      profile,
      profile.id === activeCameraId,
      fieldOffset,
    );
    world.add(cameraRig);
    return cameraRig;
  });
  threeView.cameraRigHelper = cameraRigs.find((rig) => rig.userData.cameraProfileId === activeCameraId)
    || cameraRigs[0]
    || null;

  updateThreeCamera(renderState);
  if (threeView.hudMeta) {
    const keyCount = renderState.motion?.keyframes?.length || 0;
    const stageSize = stageWorldSize(renderState);
    threeView.hudMeta.textContent = `${renderState.aspect} · 무대 ${Math.round(stageSize.width)}×${Math.round(stageSize.depth)}m · 대상 ${renderState.items.length} · 키 ${keyCount}`;
  }
  threeView.renderer.render(threeView.scene, threeView.camera);
  renderCameraFramePreview(renderState, frameOptions);
  if (typeof drawAnnotations === "function") drawAnnotations();
}

function cameraFieldRenderEntries(renderState = state) {
  const profiles = cameraPreviewProfiles(renderState);
  const activeCameraId = multiCameraCore.resolveActiveId(renderState.activeCameraId, profiles);
  return profiles.map((profile) => {
    const profileState = cameraPreviewDocument(renderState, profile.id);
    return {
      profile,
      profileState,
      fieldOffset: { x: 0, y: 0 },
      active: profile.id === activeCameraId,
    };
  });
}

function cameraWithFieldOffset(camera, fieldOffset = { x: 0, y: 0 }) {
  if (!fieldOffset || (!fieldOffset.x && !fieldOffset.y)) return camera;
  return {
    ...camera,
    x: clamp(finiteNumber(camera?.x, 0.5) + finiteNumber(fieldOffset?.x, 0), STAGE_COORD_MIN, STAGE_COORD_MAX),
    y: clamp(finiteNumber(camera?.y, 0.5) + finiteNumber(fieldOffset?.y, 0), STAGE_COORD_MIN, STAGE_COORD_MAX),
  };
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
  const verticalY = (item.type === "actor" ? Number(renderItem.verticalOffset || 0) : 0) + Number(renderItem.mountedHeight || 0);
  const pos = mapToWorld(renderItem, renderState, verticalY);
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
  base.userData.isMoveHandle = true;
  const baseRing = new THREE.Mesh(
    new THREE.TorusGeometry(baseRadius, 0.025, 8, 44),
    new THREE.MeshBasicMaterial({ color: roleColor, transparent: true, opacity: 0.86 }),
  );
  baseRing.rotation.x = Math.PI / 2;
  baseRing.position.y = 0.05;
  baseRing.userData.previewHidden = true;
  baseRing.userData.editor = itemEditor;
  baseRing.userData.isMoveHandle = true;
  if (!renderItem.autoMounted && definition.kind !== "architecture") group.add(base, baseRing);

  const angle = degToRad(renderItem.facing);
  const pitchRad = degToRad(Number(renderItem.pitch || 0));
  if (item.type === "actor") {
    body.rotation.set(pitchRad, Math.PI / 2 - angle, 0, "YXZ");
  } else {
    body.rotation.y = -angle;
  }
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
    ? (renderItem.autoMounted ? 1.55 : lerp(2.16, 0.65, Math.abs(pitchRad) / (Math.PI / 2))) * scale
    : Math.min(4.8, definition.height * Number(item.scaleY || 1) * scale + 0.5);
  if (renderState.showNames && selected?.kind === "item" && selected.id === item.id) group.add(label);
  if (selected?.kind === "item" && selected.id === item.id) {
    const sRing = makeThreeSelectionRing(item.type === "actor" ? 0.56 * scale : 0.62 * scale, roleColor);
    sRing.traverse((child) => {
      if (child.isMesh) {
        child.userData.editor = itemEditor;
        child.userData.isMoveHandle = true;
      }
    });
    group.add(sRing);
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

  if (assetType === "room" || assetType === "wall_l") {
    box([6.2, 2.8, 0.02], light, [0, 1.4, -2.29]);
    box([0.02, 2.8, 4.6], light, [-3.09, 1.4, 0]);
    return group;
  }
  if (assetType === "wall_i") {
    box([6.2, 2.8, 0.02], light, [0, 1.4, -2.29]);
    return group;
  }
  if (assetType === "wall_u") {
    box([6.2, 2.8, 0.02], light, [0, 1.4, -2.29]);
    box([0.02, 2.8, 4.6], light, [-3.09, 1.4, 0]);
    box([0.02, 2.8, 4.6], light, [3.09, 1.4, 0]);
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
  if (assetType === "desk") {
    // Top
    box([1.4, 0.06, 0.8], wood, [0, 0.75, 0]);
    // Legs
    [[-0.64, -0.34], [-0.64, 0.34], [0.64, -0.34], [0.64, 0.34]].forEach(([x, z]) => {
      box([0.06, 0.72, 0.06], dark, [x, 0.36, z]);
    });
    // Drawer cabinet
    box([0.34, 0.52, 0.72], light, [0.42, 0.46, 0]);
    return group;
  }
  if (assetType === "blackboard") {
    // Frame
    box([2.0, 1.2, 0.06], wood, [0, 1.2, 0]);
    // Board surface
    box([1.92, 1.12, 0.02], new THREE.MeshStandardMaterial({ color: "#173b22", roughness: 0.85 }), [0, 1.2, 0.03]);
    // Stands
    box([0.06, 1.8, 0.06], dark, [-0.92, 0.9, 0]);
    box([0.06, 1.8, 0.06], dark, [0.92, 0.9, 0]);
    box([0.48, 0.06, 0.62], dark, [-0.92, 0.03, 0]);
    box([0.48, 0.06, 0.62], dark, [0.92, 0.03, 0]);
    return group;
  }
  if (assetType === "partition") {
    // Frame border
    box([1.0, 1.6, 0.06], dark, [0, 0.8, 0]);
    // Colorful fabric body inside
    box([0.94, 1.54, 0.07], main, [0, 0.8, 0]);
    // Base feet
    box([0.08, 0.05, 0.48], dark, [-0.42, 0.025, 0]);
    box([0.08, 0.05, 0.48], dark, [0.42, 0.025, 0]);
    return group;
  }
  if (assetType === "wall") {
    // A 3m-high scenic wall for building depth and visual separation.
    box([3.0, 3.0, 0.02], light, [0, 1.5, 0]);
    box([3.0, 0.14, 0.03], dark, [0, 0.07, 0]);
    box([0.05, 2.88, 0.02], main, [-1.45, 1.5, 0.02]);
    box([0.05, 2.88, 0.02], main, [1.45, 1.5, 0.02]);
    return group;
  }
  if (assetType === "corridor-wall" || assetType === "train-wall") {
    const itemScale = Number(item?.size || 1);
    const wallH = 1.78 / itemScale;
    box([3.0, wallH, 0.02], light, [0, wallH / 2, 0]);
    box([3.0, 0.14 / itemScale, 0.03], dark, [0, 0.07 / itemScale, 0]);
    return group;
  }
  if (assetType === "elevator") {
    // Back wall
    box([1.6, 2.8, 0.08], dark, [0, 1.4, -0.76]);
    // Side walls
    box([0.08, 2.8, 1.6], dark, [-0.76, 1.4, 0]);
    box([0.08, 2.8, 1.6], dark, [0.76, 1.4, 0]);
    // Front headers
    box([1.6, 0.6, 0.08], dark, [0, 2.5, 0.76]);
    box([0.3, 2.2, 0.08], dark, [-0.65, 1.1, 0.76]);
    box([0.3, 2.2, 0.08], dark, [0.65, 1.1, 0.76]);
    // Doors (slightly open)
    box([0.52, 2.18, 0.04], light, [-0.28, 1.09, 0.72]);
    box([0.52, 2.18, 0.04], light, [0.28, 1.09, 0.72]);
    return group;
  }
  if (assetType === "window") {
    box([1.2, 0.08, 0.12], dark, [0, 0.04, 0]);
    box([1.2, 0.08, 0.12], dark, [0, 0.96, 0]);
    box([0.08, 0.84, 0.12], dark, [-0.56, 0.5, 0]);
    box([0.08, 0.84, 0.12], dark, [0.56, 0.5, 0]);
    box([0.05, 0.84, 0.08], dark, [0, 0.5, 0]);
    box([1.04, 0.04, 0.08], dark, [0, 0.5, 0]);
    box([1.04, 0.84, 0.02], glass, [0, 0.5, 0]);
    return group;
  }
  if (assetType === "door") {
    // Frame
    box([1.0, 2.2, 0.08], dark, [0, 1.1, 0]);
    // Open door leaf (rotated 45 degrees relative to frame)
    box([0.04, 2.14, 0.9], wood, [0.32, 1.07, 0.32], [0, Math.PI / 4, 0]);
    // Faucet knob details
    const knob = new THREE.MeshStandardMaterial({ color: "#e5c158", metalness: 0.85, roughness: 0.15 });
    add(new THREE.SphereGeometry(0.03, 12, 12), knob, [0.8 * Math.sin(Math.PI / 4) + 0.32, 1.0, 0.8 * Math.cos(Math.PI / 4) + 0.32]);
    return group;
  }
  if (assetType === "sink") {
    // Under sink cabinet stand
    box([0.58, 0.72, 0.48], wood, [0, 0.36, 0]);
    // Sink basin top
    box([0.62, 0.16, 0.52], new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.15 }), [0, 0.8, 0]);
    // Faucet
    box([0.04, 0.14, 0.14], dark, [0, 0.95, -0.16]);
    return group;
  }
  if (assetType === "toilet") {
    const white = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.12 });
    // Bowl base
    cylinder(0.18, 0.42, white, [0, 0.21, 0.12], null, 16);
    // Lid seat
    box([0.42, 0.04, 0.48], dark, [0, 0.44, 0.14]);
    // Water tank
    box([0.48, 0.38, 0.2], white, [0, 0.61, -0.2]);
    return group;
  }
  if (assetType === "bathtub") {
    const white = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.1 });
    // Tub outer shell
    box([1.5, 0.6, 0.75], white, [0, 0.3, 0]);
    // Water surface inside
    box([1.4, 0.02, 0.65], glass, [0, 0.48, 0]);
    return group;
  }
  if (assetType === "train-seat") {
    // Stand/legs
    cylinder(0.04, 0.34, dark, [0, 0.17, 0]);
    // Base cushion
    box([0.85, 0.16, 0.52], main, [0, 0.42, 0.08]);
    // Backrest
    box([0.85, 0.68, 0.14], main, [0, 0.76, -0.22]);
    // Headrest strip
    box([0.8, 0.18, 0.16], dark, [0, 1.1, -0.22]);
    return group;
  }
  if (assetType === "stairs") {
    // Step levels
    const totalSteps = 4;
    for (let i = 0; i < totalSteps; i++) {
      const stepH = 0.3;
      const stepW = 1.8;
      const stepD = 1.8 * ((totalSteps - i) / totalSteps);
      const mat = i % 2 === 0 ? main : light;
      box([stepW, stepH, stepD], mat, [0, stepH * i + stepH / 2, -1.8 * 0.5 * (i / totalSteps)]);
    }
    return group;
  }
  if (assetType === "slope") {
    // Wedge ramp
    box([3.0, 0.08, 1.5], dark, [0, 0.5, 0], [0, 0, Math.atan2(1.0, 3.0)]);
    // Base floor support
    box([3.0, 0.02, 1.5], light, [0, 0.01, 0]);
    return group;
  }

  const nameLower = String(item.name || "").toLowerCase();

  if (nameLower.includes("바닥")) {
    box([0.72, 0.34, 0.72], main, [0, 0.17, 0]);
    const seamMat = new THREE.MeshStandardMaterial({ color: "#1b2126", roughness: 0.9 });
    box([0.73, 0.005, 0.005], seamMat, [0, 0.341, -0.24]);
    box([0.73, 0.005, 0.005], seamMat, [0, 0.341, -0.08]);
    box([0.73, 0.005, 0.005], seamMat, [0, 0.341, 0.08]);
    box([0.73, 0.005, 0.005], seamMat, [0, 0.341, 0.24]);
    box([0.005, 0.005, 0.73], seamMat, [-0.24, 0.341, 0]);
    box([0.005, 0.005, 0.73], seamMat, [-0.08, 0.341, 0]);
    box([0.005, 0.005, 0.73], seamMat, [0.08, 0.341, 0]);
    box([0.005, 0.005, 0.73], seamMat, [0.24, 0.341, 0]);
    return group;
  }

  if (nameLower.includes("옥탑문") || nameLower.includes("문")) {
    box([0.64, 0.34, 0.64], main, [0, 0.17, 0]);
    const frameMat = new THREE.MeshStandardMaterial({ color: "#3a4650", roughness: 0.5, metalness: 0.5 });
    box([0.04, 0.34, 0.72], frameMat, [-0.34, 0.17, 0]);
    box([0.04, 0.34, 0.72], frameMat, [0.34, 0.17, 0]);
    box([0.72, 0.04, 0.72], frameMat, [0, 0.34, 0]);
    const knobMat = new THREE.MeshStandardMaterial({ color: "#b5a642", roughness: 0.1, metalness: 0.9 });
    add(new THREE.SphereGeometry(0.035, 12, 12), knobMat, [-0.24, 0.17, 0.08]);
    add(new THREE.CylinderGeometry(0.012, 0.012, 0.06, 8), knobMat, [-0.24, 0.17, 0.04], [Math.PI/2, 0, 0]);
    return group;
  }

  if (nameLower.includes("난간")) {
    box([0.72, 0.32, 0.72], main, [0, 0.16, 0]);
    box([0.78, 0.03, 0.78], light, [0, 0.335, 0]);
    const jointMat = new THREE.MeshStandardMaterial({ color: "#252b30", roughness: 0.9 });
    box([0.015, 0.36, 0.74], jointMat, [-0.24, 0.17, 0]);
    box([0.015, 0.36, 0.74], jointMat, [0.24, 0.17, 0]);
    return group;
  }

  if (nameLower.includes("물탱크")) {
    box([0.62, 0.34, 0.62], main, [0, 0.17, 0]);
    const ribMat = new THREE.MeshStandardMaterial({ color: color.clone().lerp(new THREE.Color("#000000"), 0.15), roughness: 0.7 });
    box([0.64, 0.03, 0.64], ribMat, [0, 0.08, 0]);
    box([0.64, 0.03, 0.64], ribMat, [0, 0.17, 0]);
    box([0.64, 0.03, 0.64], ribMat, [0, 0.26, 0]);
    cylinder(0.18, 0.025, dark, [0, 0.352, 0]);
    cylinder(0.03, 0.08, dark, [0.22, 0.02, 0.32], [Math.PI/2, 0, 0]);
    return group;
  }

  if (nameLower.includes("실외기")) {
    box([0.72, 0.34, 0.72], main, [0, 0.17, 0]);
    cylinder(0.15, 0.01, dark, [-0.14, 0.17, 0.362], [Math.PI/2, 0, 0], 24);
    cylinder(0.04, 0.015, light, [-0.14, 0.17, 0.363], [Math.PI/2, 0, 0], 8);
    const bladeMat = new THREE.MeshStandardMaterial({ color: "#222", roughness: 0.8 });
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 2) {
      const blade = add(new THREE.BoxGeometry(0.12, 0.025, 0.005), bladeMat, [-0.14, 0.17, 0.361]);
      blade.rotation.set(0, 0, angle + 0.3);
    }
    for (let y = 0.08; y <= 0.28; y += 0.05) {
      box([0.22, 0.008, 0.005], dark, [0.2, y, 0.362]);
    }
    return group;
  }

  if (nameLower.includes("빨랫줄") || nameLower.includes("줄")) {
    cylinder(0.015, 0.34, dark, [0, 0.17, -0.34]);
    box([0.03, 0.03, 0.32], dark, [0, 0.34, -0.34]);
    cylinder(0.015, 0.34, dark, [0, 0.17, 0.34]);
    box([0.03, 0.03, 0.32], dark, [0, 0.34, 0.34]);
    addCylinderBetween(group, [0, 0.34, -0.48], [0, 0.34, 0.48], 0.002, dark);
    addCylinderBetween(group, [0, 0.34, -0.2], [0, 0.34, 0.2], 0.002, dark);
    const laundryMat1 = new THREE.MeshStandardMaterial({ color: "#f2f2e8", roughness: 0.95, side: THREE.DoubleSide });
    const laundryMat2 = new THREE.MeshStandardMaterial({ color: "#f7d2cb", roughness: 0.95, side: THREE.DoubleSide });
    const sheet1 = add(new THREE.BoxGeometry(0.005, 0.18, 0.16), laundryMat1, [0, 0.23, -0.15]);
    sheet1.rotation.z = 0.08;
    const sheet2 = add(new THREE.BoxGeometry(0.005, 0.16, 0.18), laundryMat2, [0, 0.24, 0.15]);
    sheet2.rotation.z = -0.06;
    return group;
  }

  if (nameLower.includes("화분")) {
    const potMat = new THREE.MeshStandardMaterial({ color: "#aa5b3b", roughness: 0.85 });
    cylinder(0.18, 0.16, potMat, [0, 0.08, 0], null, 12);
    cylinder(0.17, 0.02, dark, [0, 0.155, 0]);
    const plantColor = new THREE.Color("#4ca64c");
    const stemMat = new THREE.MeshStandardMaterial({ color: plantColor.clone().lerp(new THREE.Color("#556b2f"), 0.2), roughness: 0.9 });
    cylinder(0.008, 0.18, stemMat, [0, 0.24, 0], [0.1, 0, 0.05]);
    const leafMat = new THREE.MeshStandardMaterial({ color: plantColor, roughness: 0.9 });
    add(new THREE.SphereGeometry(0.08, 8, 8), leafMat, [0.01, 0.32, 0.01]);
    add(new THREE.SphereGeometry(0.06, 8, 8), leafMat, [-0.04, 0.28, -0.02]);
    add(new THREE.SphereGeometry(0.065, 8, 8), leafMat, [0.05, 0.29, 0.04]);
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

function makeThreeCamera(camera, renderState, profile = null, active = false, fieldOffset = { x: 0, y: 0 }) {
  const THREE = window.THREE;
  const group = new THREE.Group();
  group.name = "cameraRigHelper";
  group.userData.previewHidden = true;
  group.userData.cameraProfileId = profile?.id || renderState.activeCameraId || "camera-1";
  group.userData.fieldOffset = clone(fieldOffset);
  const profileColor = profile?.color || "#69c9ff";
  const displayCamera = cameraWithFieldOffset(camera, fieldOffset);
  const cameraHeight = resolvedCameraRenderHeight(displayCamera);
  const camPos = mapToWorld(displayCamera, renderState, cameraHeight);
  const aimPos = cameraLookTarget(displayCamera, renderState, 10);
  const groundCam = mapToWorld(displayCamera, renderState, 0.04);
  const angle = degToRad(displayCamera.panDeg);
  const fov = degToRad(focalToFov(displayCamera.focal, cameraSensorWidth(renderState)));
  const coneLength = Math.max(stageWorldSize(renderState).width, stageWorldSize(renderState).depth) * 0.9;

  const body = new THREE.Group();
  body.name = "camera";
  body.userData.editor = {
    kind: "camera",
    profileId: group.userData.cameraProfileId,
    fieldOffset: { x: 0, y: 0 },
  };
  body.position.copy(camPos);
  body.lookAt(aimPos);
  // The camera prop is modeled with its lens on the opposite local-facing
  // side from Three.js's lookAt forward axis. Flip the display rig so the
  // physical lens points along the same direction as the view cone.
  body.rotateY(Math.PI);
  const housing = new THREE.Mesh(
    new THREE.BoxGeometry(0.58, 0.4, 0.42),
    new THREE.MeshStandardMaterial({ color: profileColor, roughness: 0.42, metalness: 0.18 }),
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
  const cameraBase = makeThreeRoleRing(0.46, profileColor);
  cameraBase.position.set(camPos.x, 0.055, camPos.z);
  group.add(cameraBase);
  const cameraLabel = makeThreeWorldLabel(profile?.name || "카메라", profileColor);
  cameraLabel.position.set(camPos.x, camPos.y + 0.72, camPos.z);
  group.add(cameraLabel);
  if (active || (selected?.kind === "camera" && selected.profileId === group.userData.cameraProfileId)) {
    const selection = makeThreeSelectionRing(0.62, profileColor, 0.04);
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
  threeView.lastState = renderState;
  const aspectLabel = renderState.aspect || "16:9";
  const multi = options.multiCamera === true
    || (options.multiCamera == null && cameraPreviewMode === "multi" && cameraProfileCount(renderState) > 1);
  const profiles = multi
    ? cameraPreviewProfiles(renderState)
    : [cameraPreviewProfile(renderState)].filter(Boolean);
  const visibleProfiles = profiles.filter(Boolean).slice(0, multi ? 4 : 1);
  threeView.frameCanvas.dataset.multiCamera = String(multi);
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
    // Viewport coordinates below are CSS pixels. Keep the preview buffer in the
    // same coordinate space so high-DPI screens do not shift the frame off-canvas.
    threeView.frameRenderer.setPixelRatio(1);
    threeView.frameCamera.aspect = frameWidth / frameHeight;
  }
  const canvasWidth = Math.max(1, threeView.frameCanvas.width);
  const canvasHeight = Math.max(1, threeView.frameCanvas.height);

  // Keep the camera frame independent from editor guides, handles, and the viewport camera.
  clearThreePreviewWorld();
  const previewSize = stageWorldSize(renderState);
  const previewFloor = new window.THREE.Mesh(
    new window.THREE.PlaneGeometry(previewSize.width, previewSize.depth),
    new window.THREE.MeshStandardMaterial({
      color: "#1a2229",
      roughness: 0.88,
      metalness: 0.02,
      side: window.THREE.DoubleSide,
    }),
  );
  previewFloor.rotation.x = -Math.PI / 2;
  previewFloor.receiveShadow = true;
  threeView.previewWorld.add(previewFloor);
  renderState.items
    .filter((item) => item.visible !== false)
    .forEach((item) => {
      const previewItem = makeThreeItem(item, renderState);
      previewItem.traverse((object) => {
        if (object.userData?.previewHidden) object.visible = false;
        if (object.isMesh) object.frustumCulled = false;
      });
      threeView.previewWorld.add(previewItem);
    });
  threeView.previewWorld.updateMatrixWorld(true);
  threeView.previewScene.updateMatrixWorld(true);
  const layout = multi ? cameraPreviewGridLayout(visibleProfiles.length) : { columns: 1, rows: 1 };
  threeView.frameRenderer.setScissorTest(multi);
  if (multi) threeView.frameRenderer.clear(true, true, true);
  visibleProfiles.forEach((profile, index) => {
    const profileState = cameraPreviewDocument(renderState, profile.id);
    const camera = profileState.camera;
    const column = index % layout.columns;
    const row = Math.floor(index / layout.columns);
    const cellWidth = canvasWidth / layout.columns;
    const cellHeight = canvasHeight / layout.rows;
    const viewportX = column * cellWidth;
    const viewportY = canvasHeight - (row + 1) * cellHeight;
    const frameAspect = cellWidth / cellHeight;
    const horizontalFov = focalToFov(camera.focal, cameraSensorWidth(profileState));
    threeView.frameCamera.aspect = frameAspect;
    threeView.frameCamera.fov = horizontalFovToVerticalFov(horizontalFov, frameAspect);
    threeView.frameCamera.position.copy(mapToWorld(camera, profileState, resolvedCameraRenderHeight(camera)));
    threeView.frameCamera.lookAt(cameraLookTarget(camera, profileState, 10));
    threeView.frameCamera.updateProjectionMatrix();
    threeView.frameCamera.updateMatrixWorld(true);
    if (multi) {
      threeView.frameRenderer.setViewport(viewportX, viewportY, cellWidth, cellHeight);
      threeView.frameRenderer.setScissor(viewportX, viewportY, cellWidth, cellHeight);
    } else {
      threeView.frameRenderer.setViewport(0, 0, canvasWidth, canvasHeight);
    }
    threeView.frameRenderer.render(threeView.previewScene, threeView.frameCamera);
  });
  threeView.frameRenderer.setScissorTest(false);
  threeView.frameRenderer.setViewport(0, 0, canvasWidth, canvasHeight);
  renderCameraFrameLabels(visibleProfiles, multi, layout);
  updateCameraFrameModeButton();
}

function cameraPreviewGridLayout(count) {
  if (count <= 1) return { columns: 1, rows: 1 };
  if (count === 2) return { columns: 2, rows: 1 };
  return { columns: 2, rows: 2 };
}

function renderCameraFrameLabels(profiles, multi, layout) {
  const root = $("#cameraFrameLabels");
  if (!root) return;
  root.innerHTML = "";
  root.hidden = !multi;
  if (!multi) return;
  profiles.forEach((profile, index) => {
    const label = document.createElement("span");
    label.className = "camera-frame-label";
    label.style.setProperty("--camera-color", profile.color);
    label.style.left = `${(index % layout.columns) * (100 / layout.columns) + 1}%`;
    label.style.top = `${Math.floor(index / layout.columns) * (100 / layout.rows) + 1}%`;
    label.textContent = profile.name;
    root.append(label);
  });
}

function selectCameraPreviewSlot(event) {
  if (cameraPreviewMode !== "multi" || cameraProfileCount() < 2) return;
  const canvas = event.currentTarget;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const profiles = multiCameraCore.normalizeProfiles(
    state.cameras,
    state.camera,
    state.motion?.keyframes?.filter((keyframe) => keyframe?.source === "camera"),
    state.cameraSetup,
  ).slice(0, 4);
  const layout = cameraPreviewGridLayout(profiles.length);
  const column = clamp(Math.floor(((event.clientX - rect.left) / rect.width) * layout.columns), 0, layout.columns - 1);
  const row = clamp(Math.floor(((event.clientY - rect.top) / rect.height) * layout.rows), 0, layout.rows - 1);
  const profile = profiles[row * layout.columns + column];
  if (!profile) return;
  switchActiveCamera(profile.id);
}

function updateCameraFrameModeButton() {
  const button = $("#cameraFrameModeBtn");
  if (!button) return;
  const multi = cameraPreviewMode === "multi" && cameraProfileCount() > 1;
  button.setAttribute("aria-pressed", String(multi));
  button.title = multi ? "단일 카메라 보기" : "멀티캠 보기";
  const text = button.querySelector("span");
  if (text) text.textContent = multi ? "단일" : "멀티캠";
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
        new THREE.SphereGeometry(keyframe.id === selectedKeyIdForRender(renderState) ? 0.14 : 0.1, 16, 10),
        new THREE.MeshBasicMaterial({ color: keyframe.id === selectedKeyIdForRender(renderState) ? "#ffffff" : source.color }),
      );
      marker.position.copy(markerPosition);
      marker.userData.previewHidden = true;
      world.add(marker);
      const height = markerHeight + (source.id === "camera" ? 0.36 : 0.42);
      const label = makeThreeKeyOrderBadge(index + 1, source.color, keyframe.id === selectedKeyIdForRender(renderState));
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
  const fontSize = Math.round(18 * scale);
  const lineHeight = Math.round(23 * scale);
  context.save();
  context.font = `800 ${fontSize}px "Apple SD Gothic Neo", "Noto Sans KR", system-ui, sans-serif`;
  context.textAlign = align;
  context.textBaseline = "top";

  const maxWidth = Math.max(150 * scale, 285 * scale);
  const lines = storyboardNoteLines(context, text, maxWidth);

  // Calculate text dimensions
  const widths = lines.map((line) => context.measureText(line).width);
  const width = Math.max(...widths, 0);
  const padX = 10 * scale;
  const padY = 6 * scale;
  const cardW = width + padX * 2;
  const cardH = lines.length * lineHeight + padY * 2 - 2 * scale;

  // Background card positioning
  const left = align === "right" ? x - cardW + padX : x - padX;
  const top = y - padY;

  // Draw card background with solid dark fill for absolute legibility
  context.fillStyle = "rgba(10, 14, 18, 0.92)";
  roundRect(context, left, top, cardW, cardH, 5 * scale);
  context.fill();

  // Draw card border matching theme color
  context.strokeStyle = typeof hexToRgba === "function" ? hexToRgba(color, 0.72) : color;
  context.lineWidth = Math.max(1.5, 2 * scale);
  roundRect(context, left, top, cardW, cardH, 5 * scale);
  context.stroke();

  // Draw text lines
  lines.forEach((line, index) => {
    const lineY = y + index * lineHeight;
    context.fillStyle = index === 0 ? "#f4fbfa" : color;
    context.fillText(line, x, lineY);
  });

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
  const phi = clamp(orbit.phi, -0.85, 1.55);
  const target = orbit.target || new window.THREE.Vector3(0, 1.15, 0);
  const x = target.x + Math.cos(orbit.theta) * Math.cos(phi) * radius;
  const y = Math.max(0.05, target.y + Math.sin(phi) * radius);
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

  let editor = forceNav ? null : pickThreeEditor(event);
  if (editor) {
    if (editor.kind === "camera" && editor.profileId && editor.profileId !== state.activeCameraId) {
      switchActiveCamera(editor.profileId);
      // Selecting another rig must not also begin a drag from the same pointer
      // gesture. A small pointer movement during the click otherwise rewrites
      // the newly selected camera's saved position.
      return;
    }
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
    if (threeEditMode === "pose" && editor.kind === "item" && editor.forceMode !== "move") {
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
    const editItemId = editor.kind === "item" ? transformLeaderIdForItem(editor.id, state) : null;
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
    materializeEvaluatedViewForEditing(editor.kind === "camera" ? "camera" : editItemId);
    const pose = editor.kind === "item"
      ? state.items.find((item) => item.id === editItemId)
      : state.camera;
    const planeHeight = editor.kind === "camera" ? state.camera.height : 0;
    const point = projectThreePointerToPlane(event, planeHeight);
    const pointerStage = point ? worldToStage(point) : { x: pose.x, y: pose.y };
    const cameraOffset = editor.kind === "camera"
      ? editor.fieldOffset || { x: 0, y: 0 }
      : { x: 0, y: 0 };
    const logicalPointerStage = {
      x: pointerStage.x - finiteNumber(cameraOffset.x, 0),
      y: pointerStage.y - finiteNumber(cameraOffset.y, 0),
    };
    threeDrag = {
      kind: "edit",
      pointerId: event.pointerId,
      editor,
      editItemId,
      startState: editStartState,
      startPoint: pointerStage,
      grabOffset: { x: pose.x - logicalPointerStage.x, y: pose.y - logicalPointerStage.y },
      cameraOffset: clone(cameraOffset),
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

  const dragKind = threeDrag.kind;
  const dragEditor = threeDrag.editor;
  const editItemId = threeDrag.editItemId;
  const actorId = threeDrag.actorId;
  threeDrag = null;

  if (didEdit) {
    const preservedSourceIds = dragKind === "edit" && dragEditor
      ? [dragEditor.kind === "camera" ? "camera" : editItemId || dragEditor.id].filter(Boolean)
      : dragKind === "pose" && actorId ? [actorId] : [];
    commit({ preserveSourceIds: preservedSourceIds });
  }
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
    let hasMoveHandle = false;
    let tempObj = object;
    while (tempObj && tempObj !== threeView.world) {
      if (tempObj.userData?.isMoveHandle) {
        hasMoveHandle = true;
      }
      if (tempObj.userData?.jointId) {
        jointId = tempObj.userData.jointId;
      }
      if (tempObj.userData?.editor?.kind === "item") {
        const itemObj = state.items.find(i => i.id === tempObj.userData.editor.id);
        if (itemObj && itemObj.type === "actor") {
          actorId = itemObj.id;
        }
      }
      tempObj = tempObj.parent;
    }

    if (hasMoveHandle) {
      let editorObj = object;
      while (editorObj && editorObj !== threeView.world) {
        if (editorObj.userData?.editor) {
          return { ...clone(editorObj.userData.editor), forceMode: "move" };
        }
        editorObj = editorObj.parent;
      }
    }

    if (threeEditMode === "pose" && jointId && actorId) {
      return { kind: "poseJoint", actorId, jointId };
    }

    let editorObj = object;
    while (editorObj && editorObj !== threeView.world) {
      if (editorObj.userData?.editor) return clone(editorObj.userData.editor);
      editorObj = editorObj.parent;
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
  const cameraOffset = editor.kind === "camera"
    ? threeDrag.cameraOffset || { x: 0, y: 0 }
    : { x: 0, y: 0 };
  const logicalPointerStage = {
    x: pointerStage.x - finiteNumber(cameraOffset.x, 0),
    y: pointerStage.y - finiteNumber(cameraOffset.y, 0),
  };
  const target = {
    x: clamp(logicalPointerStage.x + threeDrag.grabOffset.x, 0.02, 0.98),
    y: clamp(logicalPointerStage.y + threeDrag.grabOffset.y, 0.02, 0.98),
  };

  if (threeEditMode === "rotate" && editor.kind === "item" && editor.forceMode !== "move") {
    const item = state.items.find((entry) => entry.id === threeDrag.editItemId);
    if (!item) return;
    item.facing = Math.round(radToDeg(Math.atan2(pointerStage.y - item.y, pointerStage.x - item.x)));
  } else if (threeEditMode === "rotate" && editor.kind === "camera" && editor.forceMode !== "move") {
    const size = stageWorldSize(state);
    state.camera.panDeg = normalizePanDeg(radToDeg(Math.atan2(
      (logicalPointerStage.y - state.camera.y) * size.depth,
      (logicalPointerStage.x - state.camera.x) * size.width,
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
    const current = selectedItem();
    const actor = current?.type === "actor"
      ? current
      : state.items.find((item) => item.type === "actor" && item.visible !== false);
    if (actor) {
      selected = { kind: "item", id: actor.id };
      selectedPoseActorId = actor.id;
      if (isIndependentMotionSource(actor, state)) {
        setActiveSource(actor.id);
        selectKeyForSource(actor.id);
      }
    }
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
      ctx.strokeStyle = hexToRgba(guideColor, source.id === "camera" ? 0.82 : 0.75);
      ctx.lineWidth = source.id === "camera" ? 4.5 : 4.0;
      ctx.setLineDash(source.id === "camera" ? [6, 8] : [8, 9]);
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
      drawMotionPathLabel(source, keys, sampled, guideColor, renderState, rect);
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
        keyframe.id === selectedKeyIdForRender(renderState),
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
  const size = clamp(Math.min(rect.w, rect.h) * 0.028, 14, 24);
  progressPoints.forEach((progress) => {
    const marker = pointAlongPlanPath(points, progress);
    if (!marker) return;
    ctx.save();
    ctx.translate(marker.x, marker.y);
    ctx.rotate(marker.angle);
    const trace = () => {
      ctx.beginPath();
      ctx.moveTo(-size * 0.9, 0);
      ctx.lineTo(size * 0.85, 0);
      ctx.moveTo(size * 0.85, 0);
      ctx.lineTo(size * 0.1, -size * 0.6);
      ctx.moveTo(size * 0.85, 0);
      ctx.lineTo(size * 0.1, size * 0.6);
    };
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(5, 9, 12, 0.94)";
    ctx.lineWidth = Math.max(7, size * 0.5);
    trace();
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(3.5, size * 0.3);
    trace();
    ctx.stroke();
    ctx.restore();
  });
}

function motionPathEnglishLabel(source, keys, renderState) {
  if (source.id === "camera") {
    const from = keys[0].pose || {};
    const to = keys[keys.length - 1].pose || {};
    const size = stageWorldSize(renderState);
    const dx = (Number(to.x) - Number(from.x)) * size.width;
    const dz = (Number(to.y) - Number(from.y)) * size.depth;
    const dh = Number(to.height || 0) - Number(from.height || 0);
    const parts = [];
    if (Math.hypot(dx, dz) > 0.01) {
      const heading = degToRad(Number(from.panDeg ?? renderState.camera.panDeg ?? 0));
      const forward = dx * Math.cos(heading) + dz * Math.sin(heading);
      const right = dx * -Math.sin(heading) + dz * Math.cos(heading);
      if (Math.abs(forward) >= Math.abs(right)) parts.push(forward > 0 ? "dolly in" : "dolly out");
      else parts.push(right > 0 ? "truck R" : "truck L");
    }
    if (Math.abs(dh) > 0.01) parts.push(dh > 0 ? "crane up" : "crane down");
    if (Math.abs(Number(to.panDeg || 0) - Number(from.panDeg || 0)) > 0.1) parts.push("pan");
    if (Math.abs(Number(to.focal || 0) - Number(from.focal || 0)) > 0.1) {
      parts.push(Number(to.focal) > Number(from.focal) ? "zoom in" : "zoom out");
    }
    return `CAM → ${parts.join(" + ") || "move"}`;
  }
  const name = String(source.name || "actor").trim();
  const from = keys[0].pose || {};
  const to = keys[keys.length - 1].pose || {};
  const size = stageWorldSize(renderState);
  const dx = (Number(to.x) - Number(from.x)) * size.width;
  const dz = (Number(to.y) - Number(from.y)) * size.depth;
  if (Math.hypot(dx, dz) < 0.01) return `${name} → turn`;
  const heading = degToRad(renderState.camera.panDeg || 0);
  const forward = dx * Math.cos(heading) + dz * Math.sin(heading);
  const right = dx * -Math.sin(heading) + dz * Math.cos(heading);
  let dir;
  if (Math.abs(forward) >= Math.abs(right)) dir = forward < 0 ? "toward cam" : "away from cam";
  else dir = right > 0 ? "screen R" : "screen L";
  return `${name} → ${dir}`;
}

function drawMotionPathLabel(source, keys, sampled, color, renderState, rect) {
  const mid = pointAlongPlanPath(sampled, 0.45);
  if (!mid) return;
  const label = motionPathEnglishLabel(source, keys, renderState);
  const normalX = -Math.sin(mid.angle);
  const normalY = Math.cos(mid.angle);
  const offset = source.id === "camera" ? -32 : 32;
  const x = clamp(mid.x + normalX * offset, rect.x + 30, rect.x + rect.w - 30);
  const y = clamp(mid.y + normalY * offset, rect.y + 20, rect.y + rect.h - 20);
  const scale = clamp(Math.min(rect.w / 1000, rect.h / 600), 0.62, 0.92);
  const fontSize = Math.round(18 * scale);
  ctx.save();
  ctx.font = `800 ${fontSize}px "SF Pro Text", "Helvetica Neue", "Inter", system-ui, sans-serif`;
  ctx.textBaseline = "middle";
  const measured = ctx.measureText(label);
  const textW = measured.width;
  const padX = 8 * scale;
  const padY = 5 * scale;
  const align = x > rect.x + rect.w * 0.65 ? "right" : "left";
  ctx.textAlign = align;
  const boxX = align === "right" ? x - textW - padX : x - padX;
  ctx.fillStyle = "rgba(10, 14, 18, 0.92)";
  roundRect(ctx, boxX, y - fontSize / 2 - padY, textW + padX * 2, fontSize + padY * 2, 5 * scale);
  ctx.fill();
  ctx.strokeStyle = hexToRgba(color, 0.72);
  ctx.lineWidth = Math.max(1.5, 2 * scale);
  roundRect(ctx, boxX, y - fontSize / 2 - padY, textW + padX * 2, fontSize + padY * 2, 5 * scale);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.fillText(label, x, y + 1);
  ctx.restore();
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

  // Position it at 72% along the active segment path (rather than 50% midpoint) to prevent overlapping other path labels
  // Use positive offset (32) for actor/props and negative offset (-32) for camera to keep them on opposite sides of the path
  const offsetSide = source.id === "camera" ? -32 : 32;
  const x = clamp(current.x + dx * 0.72 + normalX * offsetSide, rect.x + 26, rect.x + rect.w - 26);
  const y = clamp(current.y + dy * 0.72 + normalY * offsetSide, rect.y + 82, rect.y + rect.h - 64);

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
  const current = keyframes.find((keyframe) => keyframe.id === selectedKeyIdForRender(renderState));
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

function drawCameraCone(camera, rect, clean = false, renderState = state, color = "#6ba9f4", active = false) {
  const cam = toCanvas({ x: camera.x, y: camera.y }, rect);
  const angle = degToRad(camera.panDeg);
  const fov = degToRad(focalToFov(camera.focal, cameraSensorWidth(renderState)));
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
  ctx.fillStyle = hexToRgba(color, active ? 0.24 : 0.1);
  ctx.strokeStyle = hexToRgba(color, active ? 0.96 : 0.58);
  ctx.lineWidth = active ? 1.8 : 1.15;
  ctx.setLineDash([5, 6]);
  ctx.beginPath();
  ctx.moveTo(cam.x, cam.y);
  ctx.lineTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.setLineDash([1, 7]);
  ctx.strokeStyle = hexToRgba(color, active ? 0.55 : 0.34);
  ctx.beginPath();
  ctx.moveTo(cam.x, cam.y);
  ctx.lineTo(cam.x + Math.cos(angle) * len * 0.46, cam.y + Math.sin(angle) * len * 0.46);
  ctx.stroke();

  ctx.restore();
}

function drawCamera(camera, rect, clean = false, color = "#71b8ff", active = false, label = "카메라") {
  const cam = toCanvas({ x: camera.x, y: camera.y }, rect);
  const angle = degToRad(camera.panDeg);

  ctx.save();
  ctx.translate(cam.x, cam.y);
  ctx.rotate(angle);
  ctx.strokeStyle = color;
  ctx.fillStyle = "#121a24";
  ctx.lineWidth = active ? 3 : 2;
  roundRect(ctx, -18, -10, 25, 20, 4);
  ctx.fill();
  ctx.stroke();
  if (active) {
    ctx.strokeStyle = "#f7fbff";
    ctx.lineWidth = 1.2;
    roundRect(ctx, -20, -12, 29, 24, 5);
    ctx.stroke();
  }
  roundRect(ctx, 7, -7, 17, 14, 3);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  drawCameraRotationIndicator(camera, cam, angle, active, clean, rect, color, label);
}

function drawCameraRotationIndicator(
  camera,
  cam,
  angle,
  active,
  clean = false,
  rect = stageRect,
  color = "#71b8ff",
  label = "카메라",
) {
  const radius = active ? 30 : 27;
  const arcStart = angle - 0.82;
  const arcEnd = angle + 0.82;
  const arrow = {
    x: cam.x + Math.cos(arcEnd) * radius,
    y: cam.y + Math.sin(arcEnd) * radius,
  };

  ctx.save();
  ctx.strokeStyle = hexToRgba(color, active ? 0.98 : 0.82);
  ctx.fillStyle = ctx.strokeStyle;
  ctx.lineWidth = active ? 2.6 : 1.8;
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

  if (!clean) {
    const labelX = clamp(cam.x, rect.x + 44, rect.x + rect.w - 44);
    const labelY = clamp(cam.y - radius - 16, rect.y + 18, rect.y + rect.h - 18);
    const text = active
      ? `${label} · P ${cameraHeadingDeg(camera)}° · T ${Math.round(camera.tiltDeg)}°`
      : label;
    drawMicroLabel(text, labelX, labelY, color);
  }
}

function drawMicroLabel(text, x, y, color = "#dfe5de") {
  ctx.save();
  ctx.font = "800 10px ui-monospace, SFMono-Regular, Menlo, monospace";
  const metrics = ctx.measureText(text);
  const w = metrics.width + 12;
  const h = 18;
  ctx.fillStyle = "rgba(10, 14, 18, 0.92)";
  roundRect(ctx, x - w / 2, y - h / 2, w, h, 5);
  ctx.fill();
  ctx.strokeStyle = typeof hexToRgba === "function" ? hexToRgba(color, 0.45) : "rgba(255, 255, 255, 0.2)";
  ctx.lineWidth = 1;
  roundRect(ctx, x - w / 2, y - h / 2, w, h, 5);
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
    const sizeM = stageWorldSize(renderState);
    const px_per_meter_x = rect.w / sizeM.width;
    const px_per_meter_y = rect.h / sizeM.depth;
    const size = item.size || 1;
    const dims = getPropPhysicalDimensions(item.assetType);
    const w = dims[0] * size * Number(item.scaleX || 1) * px_per_meter_x;
    const h = dims[1] * size * Number(item.scaleZ || 1) * px_per_meter_y;

    ctx.save();
    drawPropFootprint(item, w, h);
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
    const labelText = item.type === "actor" && Number(renderItem.verticalOffset || 0) !== 0
      ? `@${item.name} (${Number(renderItem.verticalOffset) >= 0 ? "+" : ""}${Number(renderItem.verticalOffset).toFixed(2)}m)`
      : `@${item.name}`;
    drawLabel(labelText, point.x, point.y + radius + 21);
  }

  if (isActive && !renderItem.autoMounted && isGroupLeader(item, renderState)) drawFacingHandle(renderItem, rect, radius);
}

function itemRadius(item, rect = stageRect) {
  const footprint = item.type === "prop" ? propDefinition(item.assetType).footprint || 0.7 : 1;
  const axisScale = item.type === "prop" ? Math.max(Number(item.scaleX || 1), Number(item.scaleZ || 1)) : 1;
  return Math.min(rect.w, rect.h) * 0.035 * item.size * Math.sqrt(footprint) * axisScale;
}

function getPropPhysicalDimensions(assetType) {
  switch (assetType) {
    case "room":
    case "wall_i":
    case "wall_l":
    case "wall_u": return [6.2, 4.6];
    case "sofa": return [2.2, 0.86];
    case "dining-table": return [1.8, 1.05];
    case "chair": return [0.62, 0.62];
    case "bed": return [2.15, 1.55];
    case "cabinet": return [1.25, 0.52];
    case "refrigerator": return [0.92, 0.78];
    case "television": return [1.45, 0.12];
    case "stove": return [0.88, 0.75];
    case "washing-machine": return [0.88, 0.78];
    case "car": return [3.8, 1.7];
    case "bus": return [7.2, 2.25];
    case "motorcycle": return [1.64, 0.4];
    case "bicycle": return [1.64, 0.3];
    case "tree": return [1.5, 1.5];
    case "forest": return [3.2, 3.2];
    case "desk": return [1.4, 0.8];
    case "blackboard": return [2.0, 0.3];
    case "partition": return [1.0, 0.08];
    case "wall": return [3.0, 0.02];
    case "corridor-wall":
    case "train-wall": return [3.0, 0.02];
    case "elevator": return [1.6, 1.6];
    case "door": return [1.0, 0.08];
    case "sink": return [0.62, 0.52];
    case "toilet": return [0.5, 0.65];
    case "bathtub": return [1.5, 0.75];
    case "train-seat": return [0.85, 0.65];
    case "stairs": return [1.8, 1.8];
    case "slope": return [3.0, 1.5];
    default: return [1.0, 1.0];
  }
}

function drawPropFootprint(item, w, h) {
  const assetType = item.assetType;
  const fill = item.color;
  const stroke = "rgba(242,248,250,0.88)";
  const radius = Math.min(w, h) / 2;
  ctx.lineWidth = Math.max(1.5, radius * 0.1);
  ctx.strokeStyle = stroke;
  ctx.fillStyle = fill;

  if (assetType === "car" || assetType === "bus") {
    roundRect(ctx, -w / 2, -h / 2, w, h, radius * 0.22);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(190,229,245,0.72)";
    const windowCount = assetType === "bus" ? 5 : 2;
    for (let index = 0; index < windowCount; index += 1) {
      const x = -w * 0.28 + index * (w * 0.56 / Math.max(1, windowCount - 1));
      ctx.fillRect(x - radius * 0.18, -h * 0.31, radius * 0.36, h * 0.62);
    }
    ctx.fillStyle = "#12181d";
    [[-0.31, -0.55], [0.31, -0.55], [-0.31, 0.55], [0.31, 0.55]].forEach(([x, y]) => {
      ctx.fillRect(x * w - radius * 0.13, y * h - radius * 0.1, radius * 0.26, radius * 0.2);
    });
    return;
  }
  if (assetType === "motorcycle" || assetType === "bicycle") {
    const span = w;
    const r = h * 0.4;
    ctx.lineWidth = Math.max(2, h * 0.1);
    ctx.beginPath();
    ctx.arc(-span / 2, 0, r, 0, Math.PI * 2);
    ctx.moveTo(span / 2 + r, 0);
    ctx.arc(span / 2, 0, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-span / 2, 0);
    ctx.lineTo(0, -r);
    ctx.lineTo(span / 2, 0);
    ctx.lineTo(0, r * 0.8);
    ctx.closePath();
    ctx.stroke();
    if (assetType === "motorcycle") {
      ctx.beginPath();
      ctx.ellipse(0, 0, w * 0.25, h * 0.35, 0, 0, Math.PI * 2);
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
  if (assetType === "room" || assetType === "wall_l") {
    ctx.strokeStyle = "rgba(188,205,214,0.88)";
    ctx.lineWidth = Math.max(3, w * 0.02);
    ctx.beginPath();
    ctx.moveTo(w / 2, -h / 2);
    ctx.lineTo(-w / 2, -h / 2);
    ctx.lineTo(-w / 2, h / 2);
    ctx.stroke();
    return;
  }
  if (assetType === "wall_i") {
    ctx.strokeStyle = "rgba(188,205,214,0.88)";
    ctx.lineWidth = Math.max(3, w * 0.02);
    ctx.beginPath();
    ctx.moveTo(-w / 2, -h / 2);
    ctx.lineTo(w / 2, -h / 2);
    ctx.stroke();
    return;
  }
  if (assetType === "wall_u") {
    ctx.strokeStyle = "rgba(188,205,214,0.88)";
    ctx.lineWidth = Math.max(3, w * 0.02);
    ctx.beginPath();
    ctx.moveTo(-w / 2, h / 2);
    ctx.lineTo(-w / 2, -h / 2);
    ctx.lineTo(w / 2, -h / 2);
    ctx.lineTo(w / 2, h / 2);
    ctx.stroke();
    return;
  }

  roundRect(ctx, -w / 2, -h / 2, w, h, Math.min(w, h) * 0.14);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = "rgba(20,28,34,0.62)";
  ctx.lineWidth = Math.max(1.5, Math.min(w, h) * 0.06);
  if (assetType === "sofa") {
    const backrestThickness = h * (0.24 / 0.86);
    ctx.strokeRect(-w * 0.38, -h * 0.5 + backrestThickness, w * 0.76, h * 0.5);
    const armrestWidth = w * (0.26 / 2.2);
    ctx.beginPath();
    ctx.moveTo(-w/2 + armrestWidth, -h/2 + backrestThickness);
    ctx.lineTo(-w/2 + armrestWidth, h/2);
    ctx.moveTo(w/2 - armrestWidth, -h/2 + backrestThickness);
    ctx.lineTo(w/2 - armrestWidth, h/2);
    ctx.moveTo(0, -h/2 + backrestThickness);
    ctx.lineTo(0, h/2);
    ctx.stroke();
  } else if (assetType === "television") {
    ctx.fillStyle = "#101c24";
    ctx.fillRect(-w * 0.45, -h * 0.5, w * 0.9, h);
  } else if (assetType === "washing-machine") {
    ctx.beginPath();
    ctx.arc(0, 0, Math.min(w, h) * 0.34, 0, Math.PI * 2);
    ctx.stroke();
  } else if (assetType === "stove") {
    [[-0.25, -0.22], [0.25, -0.22], [-0.25, 0.22], [0.25, 0.22]].forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(x * w, y * h, Math.min(w, h) * 0.12, 0, Math.PI * 2);
      ctx.stroke();
    });
  } else if (assetType === "refrigerator" || assetType === "cabinet") {
    ctx.beginPath();
    ctx.moveTo(0, -h / 2);
    ctx.lineTo(0, h / 2);
    ctx.stroke();
  } else if (assetType === "desk") {
    // Drawer panel on the side
    ctx.strokeRect(-w * 0.45, -h * 0.4, w * 0.25, h * 0.8);
    // Keyboard tray line
    ctx.beginPath();
    ctx.moveTo(-w * 0.2, h * 0.35);
    ctx.lineTo(w * 0.2, h * 0.35);
    ctx.stroke();
  } else if (assetType === "blackboard") {
    ctx.fillStyle = "#1b3527";
    ctx.fillRect(-w * 0.48, -h * 0.4, w * 0.96, h * 0.8);
    ctx.strokeRect(-w * 0.48, -h * 0.4, w * 0.96, h * 0.8);
  } else if (assetType === "partition") {
    ctx.beginPath();
    ctx.moveTo(-w * 0.5, 0);
    ctx.lineTo(w * 0.5, 0);
    ctx.stroke();
    // End ticks
    ctx.moveTo(-w * 0.5, -h * 0.5);
    ctx.lineTo(-w * 0.5, h * 0.5);
    ctx.moveTo(w * 0.5, -h * 0.5);
    ctx.lineTo(w * 0.5, h * 0.5);
    ctx.stroke();
  } else if (assetType === "wall" || assetType === "corridor-wall" || assetType === "train-wall") {
    ctx.fillStyle = "rgba(110,130,145,0.48)";
    ctx.fillRect(-w * 0.5, -h * 0.5, w, h);
    ctx.strokeRect(-w * 0.5, -h * 0.5, w, h);
  } else if (assetType === "elevator") {
    // Front opening U-shape
    ctx.beginPath();
    ctx.moveTo(-w * 0.5, h * 0.5);
    ctx.lineTo(-w * 0.5, -h * 0.5);
    ctx.lineTo(w * 0.5, -h * 0.5);
    ctx.lineTo(w * 0.5, h * 0.5);
    ctx.stroke();
    // Sliding door lines
    ctx.beginPath();
    ctx.moveTo(-w * 0.4, h * 0.48);
    ctx.lineTo(-w * 0.05, h * 0.48);
    ctx.moveTo(w * 0.4, h * 0.48);
    ctx.lineTo(w * 0.05, h * 0.48);
    ctx.stroke();
  } else if (assetType === "door") {
    // Frame ticks
    ctx.beginPath();
    ctx.moveTo(-w * 0.5, -h * 0.5);
    ctx.lineTo(-w * 0.5, h * 0.5);
    ctx.moveTo(w * 0.5, -h * 0.5);
    ctx.lineTo(w * 0.5, h * 0.5);
    ctx.stroke();
    // Swing arc (open 90 degrees)
    ctx.beginPath();
    ctx.arc(-w * 0.5, h * 0.5, w, -Math.PI / 2, 0, false);
    ctx.stroke();
    // Door panel open
    ctx.beginPath();
    ctx.moveTo(-w * 0.5, h * 0.5);
    ctx.lineTo(-w * 0.5, h * 0.5 - w);
    ctx.stroke();
  } else if (assetType === "window") {
    ctx.fillStyle = "rgba(143,212,237,0.36)";
    ctx.fillRect(-w * 0.5, -h * 0.5, w, h);
    ctx.strokeRect(-w * 0.5, -h * 0.5, w, h);
    ctx.beginPath();
    ctx.moveTo(-w * 0.5, -h * 0.16);
    ctx.lineTo(w * 0.5, -h * 0.16);
    ctx.moveTo(-w * 0.5, h * 0.16);
    ctx.lineTo(w * 0.5, h * 0.16);
    ctx.stroke();
  } else if (assetType === "sink") {
    ctx.beginPath();
    ctx.ellipse(0, 0, w * 0.38, h * 0.38, 0, 0, Math.PI * 2);
    ctx.stroke();
    // Faucet dot
    ctx.beginPath();
    ctx.arc(0, -h * 0.38, 3, 0, Math.PI * 2);
    ctx.fill();
  } else if (assetType === "toilet") {
    // Bowl oval
    ctx.beginPath();
    ctx.ellipse(0, h * 0.12, w * 0.35, h * 0.35, 0, 0, Math.PI * 2);
    ctx.stroke();
    // Water tank behind
    ctx.strokeRect(-w * 0.48, -h * 0.5, w * 0.96, h * 0.28);
  } else if (assetType === "bathtub") {
    ctx.strokeRect(-w * 0.42, -h * 0.4, w * 0.84, h * 0.8);
    // Drain circle
    ctx.beginPath();
    ctx.arc(w * 0.3, 0, 4, 0, Math.PI * 2);
    ctx.stroke();
  } else if (assetType === "train-seat") {
    // Seat cushion
    ctx.strokeRect(-w * 0.46, -h * 0.35, w * 0.92, h * 0.7);
    // Headrest / backrest line
    ctx.beginPath();
    ctx.moveTo(-w * 0.46, -h * 0.35);
    ctx.lineTo(w * 0.46, -h * 0.35);
    ctx.stroke();
  } else if (assetType === "stairs") {
    // Horizontal step lines
    const stepCount = 5;
    for (let i = 1; i < stepCount; i++) {
      const y = -h * 0.5 + (i * h) / stepCount;
      ctx.beginPath();
      ctx.moveTo(-w * 0.5, y);
      ctx.lineTo(w * 0.5, y);
      ctx.stroke();
    }
    // Arrow pointing up
    ctx.beginPath();
    ctx.moveTo(0, h * 0.38);
    ctx.lineTo(0, -h * 0.38);
    ctx.lineTo(-w * 0.1, -h * 0.28);
    ctx.moveTo(0, -h * 0.38);
    ctx.lineTo(w * 0.1, -h * 0.28);
    ctx.stroke();
  } else if (assetType === "slope") {
    // Slanted hatch lines or simple arrow
    ctx.beginPath();
    ctx.moveTo(-w * 0.4, 0);
    ctx.lineTo(w * 0.4, 0);
    ctx.lineTo(w * 0.2, -h * 0.25);
    ctx.moveTo(w * 0.4, 0);
    ctx.lineTo(w * 0.2, h * 0.25);
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

function isPointInItem(point, item, renderState, rect = stageRect) {
  const resolved = resolvedItemPose(item, renderState);
  const p = toCanvas(resolved, rect);

  if (item.type === "actor") {
    const r = itemRadius(resolved, rect) * 1.28;
    return distance(point, p) <= r;
  }

  const assetType = item.assetType;
  if (assetType === "tree" || assetType === "forest") {
    const r = itemRadius(resolved, rect) * 1.28;
    return distance(point, p) <= r;
  }

  const sizeM = stageWorldSize(renderState);
  const px_per_meter_x = rect.w / sizeM.width;
  const px_per_meter_y = rect.h / sizeM.depth;
  const size = item.size || 1;
  const dims = getPropPhysicalDimensions(item.assetType);
  const w = dims[0] * size * Number(resolved.scaleX || 1) * px_per_meter_x;
  const h = dims[1] * size * Number(resolved.scaleZ || 1) * px_per_meter_y;

  const angle = degToRad(resolved.facing);
  const dx = point.x - p.x;
  const dy = point.y - p.y;

  const cos = Math.cos(-angle);
  const sin = Math.sin(-angle);
  const rx = dx * cos - dy * sin;
  const ry = dx * sin + dy * cos;

  const isCurrentlySelected = selected?.kind === "item" && selected.id === item.id;
  const pad = isCurrentlySelected ? 20 : 6;
  return Math.abs(rx) <= w / 2 + pad && Math.abs(ry) <= h / 2 + pad;
}

function hitTest(point, renderState = evaluatedViewState || state) {
  const item = selected?.id ? renderState.items.find((entry) => entry.id === selected.id) : null;
  if (item && isGroupLeader(item, renderState)) {
    const handle = facingHandlePoint(item);
    if (distance(point, handle) < 18) return { kind: "facing", id: item.id };
  }

  const cameraHits = cameraFieldRenderEntries(renderState)
    .map((entry) => {
      return {
        entry,
        center: toCanvas({ x: entry.profileState.camera.x, y: entry.profileState.camera.y }),
        distance: distance(point, toCanvas({ x: entry.profileState.camera.x, y: entry.profileState.camera.y })),
      };
    })
    .filter((entry) => entry.distance < 24)
    // Pick the rig actually under the pointer. Active-camera priority used to
    // steal clicks from a nearby visible rig whenever camera icons overlapped.
    .sort((a, b) => a.distance - b.distance || Number(b.entry.active) - Number(a.entry.active));
  if (cameraHits.length) {
    const hit = cameraHits[0];
    return {
      kind: "camera",
      profileId: hit.entry.profile.id,
      fieldOffset: clone(hit.entry.fieldOffset),
    };
  }

  const candidates = [];
  for (let i = renderState.items.length - 1; i >= 0; i -= 1) {
    const hitItem = renderState.items[i];
    if (hitItem.visible === false) continue;
    if (isPointInItem(point, hitItem, renderState)) {
      const resolved = resolvedItemPose(hitItem, renderState);
      const p = toCanvas(resolved);
      const d = distance(point, p);
      candidates.push({ kind: "item", id: hitItem.id, type: hitItem.type, dist: d });
    }
  }
  if (!candidates.length) return null;
  if (candidates.length === 1) return { kind: candidates[0].kind, id: candidates[0].id };
  candidates.sort((a, b) => {
    const aPri = a.type === "actor" ? 0 : 1;
    const bPri = b.type === "actor" ? 0 : 1;
    if (aPri !== bPri) return aPri - bPri;
    return a.dist - b.dist;
  });
  return { kind: candidates[0].kind, id: candidates[0].id };
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function hitTestPathBadge(point, renderState = evaluatedViewState || state) {
  const keyframes = sortKeyframes(renderState.motion?.keyframes || []);
  const hits = keyframes.map((keyframe) => {
    const active = keyframe.id === selectedKeyIdForRender(renderState);
    const center = pathOrderBadgeCenter(toCanvas(keyframe.pose), active);
    return { keyframe, center, distance: distance(point, center) };
  }).filter((entry) => entry.distance <= 15);
  return hits.sort((a, b) => Number(b.keyframe.id === selectedKeyIdForRender(renderState))
    - Number(a.keyframe.id === selectedKeyIdForRender(renderState)) || a.distance - b.distance)[0] || null;
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
  setTimelineSelection([keyframe.id], keyframe.id);
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
  let hit = hitTest(point);
  if (hit) {
    if (hit.kind === "camera" && hit.profileId && hit.profileId !== state.activeCameraId) {
      switchActiveCamera(hit.profileId);
      // Keep the same pointer gesture alive: grabbing an inactive rig should
      // select and move that rig without requiring a second drag.
    }
    selected = hit;
    const sourceId = selectedSourceId();
    if (sourceId) {
      setActiveSource(sourceId);
      selectKeyForSource(sourceId);
    }
    const editItemId = hit.kind === "item" ? transformLeaderIdForItem(hit.id, state) : null;
    const locked = hit.kind === "camera"
      ? cameraFieldLocked("position")
      : sourceEditLocked(editItemId);
    const editStartState = clone(state);
    if (!locked) materializeEvaluatedViewForEditing(hit.kind === "camera" ? "camera" : editItemId);
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
    const fieldOffset = drag.selection.fieldOffset || { x: 0, y: 0 };
    state.camera.x = clamp(normalized.x - finiteNumber(fieldOffset.x, 0), STAGE_COORD_MIN, STAGE_COORD_MAX);
    state.camera.y = clamp(normalized.y - finiteNumber(fieldOffset.y, 0), STAGE_COORD_MIN, STAGE_COORD_MAX);
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

  const dragSelection = drag.selection;
  const editItemId = drag.editItemId;
  drag = null;
  const preservedSourceIds = [];

  // Dragging edits only the scene pose. Timeline keys and their paths change
  // exclusively through the explicit add/update timeline actions.
  if (dragSelection.kind === "camera") {
    preservedSourceIds.push("camera");
  } else if (dragSelection.kind === "item" && editItemId) {
    preservedSourceIds.push(editItemId);
  } else if (dragSelection.kind === "facing" && dragSelection.id) {
    preservedSourceIds.push(dragSelection.id);
  }

  commit({ preserveSourceIds: preservedSourceIds });
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
  if (workspaceMode === "blocking" && timelineFocused && command && event.key.toLowerCase() === "a") {
    selectAllVisibleTimelineKeys();
    event.preventDefault();
    return;
  }
  if (workspaceMode === "blocking" && timelineFocused && command && event.key.toLowerCase() === "c") {
    copySelectedTimelineKeys();
    event.preventDefault();
    return;
  }
  if (workspaceMode === "blocking" && timelineFocused && command && event.key.toLowerCase() === "v") {
    pasteTimelineKeys();
    event.preventDefault();
    return;
  }
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
  if (workspaceMode === "blocking" && !event.metaKey && !event.ctrlKey && !event.altKey) {
    if (event.key === "Home") {
      stopPreview();
      event.preventDefault();
      return;
    }
    if (event.key === "End") {
      if (preview) pausePreview();
      scrubToTime(state.motion.duration);
      event.preventDefault();
      return;
    }
    if (event.key === "ArrowLeft") {
      if (preview) pausePreview();
      const step = event.shiftKey ? (10 / (state.motion.fps || 24)) : (1 / (state.motion.fps || 24));
      scrubToTime(Math.max(0, displayPlayhead() - step));
      event.preventDefault();
      return;
    }
    if (event.key === "ArrowRight") {
      if (preview) pausePreview();
      const step = event.shiftKey ? (10 / (state.motion.fps || 24)) : (1 / (state.motion.fps || 24));
      scrubToTime(Math.min(state.motion.duration, displayPlayhead() + step));
      event.preventDefault();
      return;
    }
     if (event.key === "Escape" && !tutorialOpen && !document.querySelector("dialog[open]")) {
      if (typeof currentAnnoTool !== "undefined" && currentAnnoTool !== "none") {
        if (typeof selectAnnoTool === "function") selectAnnoTool("none");
        event.preventDefault();
        return;
      }
      stopPreview();
      event.preventDefault();
      return;
    }
    if (event.key.toLowerCase() === "s") {
      if (typeof selectAnnoTool === "function") selectAnnoTool(currentAnnoTool === "select" ? "none" : "select");
      event.preventDefault();
      return;
    }
    if (event.key.toLowerCase() === "d") {
      if (typeof selectAnnoTool === "function") selectAnnoTool(currentAnnoTool === "pen" ? "none" : "pen");
      event.preventDefault();
      return;
    }
    if (event.key.toLowerCase() === "a") {
      if (typeof selectAnnoTool === "function") selectAnnoTool(currentAnnoTool === "arrow" ? "none" : "arrow");
      event.preventDefault();
      return;
    }
    if (event.key.toLowerCase() === "t") {
      if (typeof selectAnnoTool === "function") selectAnnoTool(currentAnnoTool === "text" ? "none" : "text");
      event.preventDefault();
      return;
    }
    if (event.key.toLowerCase() === "e") {
      if (typeof selectAnnoTool === "function") selectAnnoTool(currentAnnoTool === "eraser" ? "none" : "eraser");
      event.preventDefault();
      return;
    }
    if (event.key === "Backspace" || event.key === "Delete") {
      if (typeof selectedAnnoId !== "undefined" && selectedAnnoId) {
        if (activeSourceId() !== "all" && sourceEditLocked(activeSourceId())) {
          notifyApp("편집이 잠긴 대상 상태에서는 주석을 수정할 수 없습니다.");
        } else {
          state.annotations = state.annotations.filter(anno => anno.id !== selectedAnnoId);
          selectedAnnoId = null;
          commit();
          notifyApp("선택한 주석을 삭제했습니다.");
          if (typeof drawAnnotations === "function") drawAnnotations();
          if (typeof draw === "function") draw();
        }
        event.preventDefault();
        return;
      }
    }
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
      const currentIndex = Math.max(0, keys.findIndex((keyframe) => keyframe.id === primaryTimelineKeyId()));
      const direction = event.key === "[" ? -1 : 1;
      const next = keys[(currentIndex + direction + keys.length) % keys.length];
      selectKeyframe(next.id);
    }
    event.preventDefault();
    return;
  }
  const item = selectedItem();
  if (event.key === "Delete" || event.key === "Backspace") {
    if (workspaceMode === "blocking" && timelineFocused && selectedTimelineKeyframes().length) {
      deleteSelectedKey();
      event.preventDefault();
    } else if (item) {
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
  if (threeView?.ready) {
    const degH = Math.round(threeView.orbit.theta * (180 / Math.PI));
    const knobH = $("#jogDialKnobH");
    if (knobH) knobH.style.transform = `rotate(${degH}deg)`;

    const degV = Math.round(threeView.orbit.phi * (180 / Math.PI));
    const knobV = $("#jogDialKnobV");
    if (knobV) knobV.style.transform = `rotate(${degV}deg)`;
  }
  // Camera controls should reflect the active rig's saved state, not the
  // transient evaluated frame, so switching rigs does not look like a reset.
  const displayCamera = state.camera;
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
  $("#focalSlider").value = displayCamera.focal;
  $("#focalValue").value = displayCamera.focal;
  $("#cameraHeightSlider").value = displayCamera.height;
  $("#cameraHeightValue").value = Number(displayCamera.height).toFixed(2);
  $("#cameraPanSlider").value = displayCamera.panDeg;
  $("#cameraPanValue").value = Math.round(displayCamera.panDeg);
  $("#cameraTiltSlider").value = displayCamera.tiltDeg;
  $("#cameraTiltValue").value = Math.round(displayCamera.tiltDeg);
  renderCameraRigControls();
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
    button.classList.toggle("is-active", Number(button.dataset.focal) === Number(displayCamera.focal));
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

function renderCameraRigControls() {
  const root = $("#cameraRigList");
  if (!root) return;
  const profiles = state.cameras || [];
  root.innerHTML = "";
  profiles.forEach((profile) => {
    const row = document.createElement("div");
    row.className = `camera-rig-row${profile.id === state.activeCameraId ? " is-active" : ""}`;
    row.dataset.cameraId = profile.id;

    const select = document.createElement("button");
    select.type = "button";
    select.className = "camera-rig-select";
    select.title = `${profile.name} 선택`;
    select.setAttribute("aria-pressed", String(profile.id === state.activeCameraId));
    const swatch = document.createElement("span");
    swatch.className = "camera-rig-swatch";
    swatch.style.background = profile.color;
    const keyCount = (profile.keyframes || []).length;
    select.append(swatch, document.createTextNode(profile.name), document.createElement("small"));
    select.lastChild.textContent = `키 ${keyCount}`;
    select.addEventListener("click", () => switchActiveCamera(profile.id));

    const rename = document.createElement("input");
    rename.type = "text";
    rename.className = "camera-rig-name";
    rename.value = profile.name;
    rename.maxLength = 40;
    rename.setAttribute("aria-label", `${profile.name} 이름`);
    rename.addEventListener("click", (event) => event.stopPropagation());
    rename.addEventListener("change", () => {
      const nextName = rename.value.trim().slice(0, 40) || profile.name;
      rename.value = nextName;
      if (nextName === profile.name) return;
      profile.name = nextName;
      commit();
    });

    const duplicate = document.createElement("button");
    duplicate.type = "button";
    duplicate.className = "icon-btn camera-rig-action";
    duplicate.innerHTML = '<i data-lucide="copy" aria-hidden="true"></i>';
    duplicate.title = "카메라 복제";
    duplicate.setAttribute("aria-label", `${profile.name} 복제`);
    duplicate.disabled = profiles.length >= 4;
    duplicate.addEventListener("click", (event) => {
      event.stopPropagation();
      duplicateCameraProfile(profile.id);
    });

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "icon-btn camera-rig-action";
    remove.innerHTML = '<i data-lucide="trash-2" aria-hidden="true"></i>';
    remove.title = "카메라 삭제";
    remove.setAttribute("aria-label", `${profile.name} 삭제`);
    remove.disabled = profiles.length <= 1;
    remove.addEventListener("click", (event) => {
      event.stopPropagation();
      deleteCameraProfile(profile.id);
    });

    row.append(select, rename, duplicate, remove);
    root.append(row);
  });
  const count = $("#cameraRigCount");
  if (count) count.textContent = `${profiles.length}/4대`;
  const add = $("#addCameraBtn");
  if (add) add.disabled = profiles.length >= 4;
  const multiVideoReady = profiles.length > 1;
  [$("#multiCamVideoBtn"), $("#multiCamVideoPanelBtn")].forEach((button) => {
    if (!button) return;
    button.disabled = !multiVideoReady || mediaExportBusy;
    button.title = multiVideoReady ? "카메라별 화면을 분할한 H.264 프리뷰 영상" : "카메라를 2대 이상 추가하면 사용할 수 있습니다";
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
  "selectedName", "sizeSlider", "sizeValue", "actorElevationSlider", "actorElevationValue",
  "actorPitchSlider", "actorPitchValue",
  "propScaleX", "propScaleXValue",
  "propScaleY", "propScaleYValue", "propScaleZ", "propScaleZValue",
  "propElevationSlider", "propElevationValue",
  "facingSlider", "facingValue", "sceneTitle", "sceneIntent",
  "actorPoseAxisX", "actorPoseAxisXValue", "actorPoseAxisY", "actorPoseAxisYValue",
  "actorPoseAxisZ", "actorPoseAxisZValue",
]);

function markLiveProjectInputDirty() {
  syncActiveCutDocument(true);
  setProjectSaveStatus("changed");
}

function finalizeLiveProjectInputEdit() {
  const sourceId = activeSourceId() === "all" ? selectedSourceId() : activeSourceId();
  evaluatedViewState = interpolateStateAtTime(state.motion.playhead);
  preserveLiveSourcePreview(evaluatedViewState, sourceId ? [sourceId] : []);
  applyCameraTracking(state);
  history.push(snapshot());
  if (history.length > 80) history.shift();
  future = [];
  syncActiveCutDocument(false);
  if (!managedProjectId || hasUnsavedProjectChanges()) setProjectSaveStatus("changed");
  syncUi();
  draw(evaluatedViewState);
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
  const unresolvedCount = cutIssueFindings(cut).filter((finding) => !finding.overridden).length;
  const issueBadge = document.createElement("span");
  issueBadge.className = "storyboard-card-issues";
  issueBadge.textContent = `${unresolvedCount}`;
  issueBadge.title = `${unresolvedCount}개 확인 항목`;
  issueBadge.hidden = unresolvedCount === 0;
  thumb.append(fallback, image, code, status, issueBadge);

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
    markCutCreativeChanged(cut);
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
  const findings = cutIssueFindings(cut);
  const issues = findings.filter((finding) => !finding.overridden);
  const overridden = findings.filter((finding) => finding.overridden);
  const issueButton = $("#selectedCutIssueCount");
  const issueList = $("#selectedCutIssueList");
  issueButton.textContent = issues.length ? `${issues.length} 확인` : overridden.length ? `${overridden.length} 예외` : "준비됨";
  issueButton.title = issues.map((finding) => finding.message).join(" · ");
  issueButton.disabled = !findings.length;
  issueButton.setAttribute("aria-expanded", "false");
  issueList.innerHTML = "";
  findings.slice(0, 16).forEach((finding) => {
    const item = document.createElement("div");
    item.className = `selected-cut-issue-row severity-${finding.severity || "warning"}${finding.overridden ? " is-overridden" : ""}`;
    const message = document.createElement("span");
    message.textContent = finding.message;
    item.append(message);
    if (finding.kind !== "required") {
      if (finding.overridden) {
        const note = document.createElement("small");
        note.textContent = finding.override?.note || "의도된 연출";
        const restore = document.createElement("button");
        restore.type = "button";
        restore.className = "text-btn";
        restore.dataset.continuityAction = "restore";
        restore.dataset.issueId = finding.id;
        restore.textContent = "예외 해제";
        item.append(note, restore);
      } else {
        const note = document.createElement("input");
        note.type = "text";
        note.maxLength = 240;
        note.placeholder = "의도된 변경 이유";
        note.dataset.continuityNote = finding.id;
        const ignore = document.createElement("button");
        ignore.type = "button";
        ignore.className = "text-btn";
        ignore.dataset.continuityAction = "override";
        ignore.dataset.issueId = finding.id;
        ignore.dataset.issueSignature = finding.signature;
        ignore.textContent = "예외 처리";
        item.append(note, ignore);
      }
    }
    issueList.append(item);
  });
  issueList.hidden = true;
  $("#cutStatusInput").value = cut.status;
  $("#cutTitleInput").value = cut.title;
  $("#cutShotTypeInput").value = cut.shotType;
  $("#cutFocalInput").value = cut.blocking?.camera?.focal || 50;
  $("#cutDurationInput").value = cut.blocking?.motion?.duration || 3;
  $("#cutActionInput").value = cut.action;
  $("#cutDialogueInput").value = cut.dialogue;
  $("#cutIntentInput").value = cut.intent || cut.camera;
  $("#cutNotesInput").value = cut.notes;
  ["A", "B"].forEach((slot) => {
    const snapshot = cut.snapshots?.[slot] || null;
    const nameInput = document.getElementById(`cutVersionName${slot}`);
    const meta = document.getElementById(`cutVersionMeta${slot}`);
    const capture = $(`[data-cut-version-action="capture"][data-slot="${slot}"]`);
    const restore = $(`[data-cut-version-action="restore"][data-slot="${slot}"]`);
    nameInput.value = snapshot?.name || `${slot}안`;
    meta.textContent = snapshot ? formatProjectDate(snapshot.createdAt) : "저장 안 됨";
    capture.textContent = snapshot ? "교체" : "저장";
    restore.disabled = !snapshot;
  });
  $("#compareCutVersionsBtn").disabled = !(cut.snapshots?.A && cut.snapshots?.B);
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

function captureCutVersion(slot) {
  const cut = currentCut();
  if (!cut || !["A", "B"].includes(slot)) return;
  syncActiveCutDocument(false);
  const existing = cut.snapshots?.[slot] || null;
  if (existing && !confirm(`${slot} 버전을 현재 컷으로 교체할까요?`)) return;
  const name = document.getElementById(`cutVersionName${slot}`).value.trim().slice(0, 60) || `${slot}안`;
  pushProjectHistory();
  cut.snapshots = sanitizeCutSnapshots(cut.snapshots);
  const previous = cut.snapshots[slot];
  cut.snapshots[slot] = {
    name,
    createdAt: isoNow(),
    document: storyboardCore.cutSnapshotDocument(cut),
  };
  if (JSON.stringify({ project }).length > 12 * 1024 * 1024) {
    cut.snapshots[slot] = previous;
    projectHistory.pop();
    syncHistoryButtons();
    notifyApp("프로젝트 크기가 커서 컷 버전을 저장하지 못했습니다.");
    return;
  }
  touchProjectCut(cut);
  renderStoryboardWorkspace();
  notifyApp(`${slot} 버전을 저장했습니다.`);
}

function restoreCutVersion(slot) {
  const cut = currentCut();
  const saved = cut?.snapshots?.[slot];
  if (!cut || !saved || !confirm(`${saved.name}으로 현재 컷을 복원할까요?`)) return;
  pushProjectHistory();
  const identity = {
    id: cut.id,
    number: cut.number,
    createdAt: cut.createdAt,
    snapshots: cut.snapshots,
    continuity: cut.continuity,
  };
  const cutDocument = storyboardCore.cutSnapshotDocument(saved.document);
  Object.assign(cut, cutDocument, identity, {
    status: "review",
    updatedAt: isoNow(),
    blocking: sanitizeBlockingDocument(cutDocument.blocking),
  });
  cut.blocking.sceneTitle = cut.title;
  cut.blocking.sceneIntent = cut.intent || cut.camera || "";
  markCutCreativeChanged(cut);
  cutRuntime.delete(cut.id);
  state = cut.blocking;
  selected = { kind: "camera" };
  history = [snapshot()];
  future = [];
  resetTimelineRuntime();
  touchProjectCut(cut);
  syncUi();
  draw();
  renderStoryboardWorkspace();
  notifyApp(`${saved.name}을 복원했습니다. 검토 필요 상태로 전환했습니다.`);
}

function cutVersionPreviewDataUrl(cutDocument) {
  const canvas = documentNodeCanvas(640, 360);
  renderToCanvas(canvas, cutDocument.blocking, { clean: true });
  return canvas.toDataURL("image/png");
}

function documentNodeCanvas(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function showCutVersionComparison() {
  const cut = currentCut();
  const first = cut?.snapshots?.A;
  const second = cut?.snapshots?.B;
  if (!cut || !first || !second) return;
  const frames = $("#cutVersionCompareFrames");
  frames.innerHTML = "";
  [["A", first], ["B", second]].forEach(([slot, version]) => {
    const figure = document.createElement("figure");
    const image = document.createElement("img");
    image.src = cutVersionPreviewDataUrl(version.document);
    image.alt = `${slot} ${version.name} 2D 블로킹 프리뷰`;
    const caption = document.createElement("figcaption");
    caption.innerHTML = `<b>${slot} · ${escapeHtml(version.name)}</b><span>${escapeHtml(formatProjectDate(version.createdAt))}</span>`;
    figure.append(image, caption);
    frames.append(figure);
  });
  const differences = storyboardCore.compareCutDocuments(first.document, second.document);
  const diffList = $("#cutVersionDiffList");
  diffList.innerHTML = "";
  differences.forEach((difference) => {
    const row = document.createElement("div");
    row.className = difference.changed ? "is-changed" : "";
    [difference.label, difference.first, difference.second].forEach((value) => {
      const cell = document.createElement("span");
      cell.textContent = value;
      row.append(cell);
    });
    diffList.append(row);
  });
  $("#cutVersionCompareTitle").textContent = `${storyboardCutCode(currentScene(), cut)} · A/B 비교`;
  $("#cutVersionCompareDialog").showModal();
}

function updateStoryboardCutFromInspector(fieldId, render = false) {
  const cut = currentCut();
  if (!cut) return;
  if (fieldId === "cutStatusInput") {
    const requested = $("#cutStatusInput").value;
    if (requested === "approved") {
      const unresolved = cutIssueFindings(cut).filter((finding) => !finding.overridden);
      if (unresolved.length) {
        cut.status = "review";
        $("#cutStatusInput").value = "review";
        notifyApp(`확정 전 ${unresolved.length}개 항목을 확인하세요.`);
      } else {
        cut.status = "approved";
      }
    } else {
      cut.status = requested;
    }
  }
  if (fieldId === "cutTitleInput") {
    cut.title = $("#cutTitleInput").value;
    cut.blocking.sceneTitle = cut.title;
  }
  if (fieldId === "cutShotTypeInput") cut.shotType = $("#cutShotTypeInput").value;
  if (fieldId === "cutFocalInput" && cut.blocking?.camera) {
    const focal = Number($("#cutFocalInput").value);
    if (Number.isFinite(focal)) {
      cut.blocking.camera.focal = clamp(focal, CAMERA_FOCAL_MIN, CAMERA_FOCAL_MAX);
    }
  }
  if (fieldId === "cutDurationInput" && cut.blocking?.motion) {
    const previousDuration = clamp(finiteNumber(cut.blocking.motion.duration, 3), 1, MAX_TIMELINE_DURATION);
    const rawDuration = Number($("#cutDurationInput").value);
    if (Number.isFinite(rawDuration) && rawDuration >= 1) {
      const nextDuration = clamp(rawDuration, 1, MAX_TIMELINE_DURATION);
      if (Math.abs(previousDuration - nextDuration) > 0.000001) {
        cut.blocking.motion.keyframes = rescaleKeyframeTimes(
          cut.blocking.motion.keyframes || [],
          previousDuration,
          nextDuration,
          MAX_TIMELINE_DURATION,
        );
        cut.blocking.motion.playhead = clamp(
          finiteNumber(cut.blocking.motion.playhead, 0) * nextDuration / previousDuration,
          0,
          nextDuration,
        );
        cut.blocking.motion.duration = nextDuration;
      }
    }
  }
  if (fieldId === "cutActionInput") cut.action = $("#cutActionInput").value;
  if (fieldId === "cutDialogueInput") cut.dialogue = $("#cutDialogueInput").value;
  if (fieldId === "cutIntentInput") {
    cut.intent = $("#cutIntentInput").value;
    cut.blocking.sceneIntent = cut.intent || cut.camera || "";
  }
  if (fieldId === "cutNotesInput") cut.notes = $("#cutNotesInput").value;
  if (fieldId !== "cutStatusInput") markCutCreativeChanged(cut);
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
  const threeHud = $("#threeHud");
  if (threeHud) threeHud.hidden = viewMode !== "3d";
  if (viewMode === "3d") {
    initThreeView();
    resizeThreeView();
    renderThreeView(state, true);
  } else {
    requestAnimationFrame(() => {
      resizeCanvas();
      if (threeView?.ready) renderCameraFramePreview(evaluatedViewState || state);
    });
  }
  syncUi(false);
  draw();
  if (typeof resizeAnnotationOverlay === "function") resizeAnnotationOverlay();
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
  window.lucide?.createIcons({ attrs: { "stroke-width": 1.8 } });
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
      const isVisible = item.visible !== false;
      row.innerHTML = `
        <span class="dot" style="background:${item.color}; opacity: ${isVisible ? 1.0 : 0.35}"></span>
        <span class="object-row-name" style="opacity: ${isVisible ? 1.0 : 0.35}">
          <span>${index + 1}. @ ${escapeHtml(item.name)}</span>
          ${item.type === "prop" ? `<small>${escapeHtml(propDefinition(item.assetType).label)}${item.motionEnabled === false ? " · 고정" : ""}${item.editLocked ? " · 잠김" : ""}${groupForItem(item.id) ? " · 묶음" : ""}</small>` : item.placementMode === "auto" && item.mountId ? `<small>자동 탑승${item.editLocked ? " · 잠김" : ""}</small>` : groupForItem(item.id) ? `<small>수동 묶음${item.editLocked ? " · 잠김" : ""}</small>` : item.editLocked ? `<small>편집 잠김</small>` : ""}
        </span>
        <button type="button" class="visibility-toggle-btn" aria-label="${escapeHtml(item.name)} ${isVisible ? "감추기" : "보이기"}" title="${isVisible ? "감추기" : "보이기"}" style="display: inline-flex; align-items: center; justify-content: center; opacity: ${isVisible ? 1.0 : 0.55}">
          <i data-lucide="${isVisible ? "eye" : "eye-off"}" aria-hidden="true" style="width: 14px; height: 14px;"></i>
        </button>
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
      row.querySelector(".visibility-toggle-btn").addEventListener("click", (event) => {
        event.stopPropagation();
        if (sourceEditLocked(item.id)) {
          notifyEditLocked(item.name);
          return;
        }
        item.visible = item.visible === false ? true : false;
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
    "#propElevationSlider", "#propElevationValue",
    "#actorPlacementMode", "#actorMountSelect", "#actorSeatSelect", "#actorLocomotionMode", "#actorElevationSlider", "#actorElevationValue",
    "#actorPitchSlider", "#actorPitchValue",
    "#facingSlider", "#facingValue",
    "#groupOverlapBtn", "#ungroupBtn", "#duplicateBtn", "#deleteBtn"].forEach((selector) => {
    const control = $(selector);
    if (control) control.disabled = locked;
  });

  const propFields = $("#propSpecificFields");
  const actorPlacementFields = $("#actorPlacementFields");
  const actorMotionFields = $("#actorMotionFields");
  const actorPoseFields = $("#actorPoseFields");
  propFields.hidden = item.type !== "prop";
  actorPlacementFields.hidden = item.type !== "actor";
  actorMotionFields.hidden = item.type !== "actor";
  actorPoseFields.hidden = item.type !== "actor";
  $("#actorElevationField").hidden = item.type !== "actor";
  $("#actorPitchField").hidden = item.type !== "actor";
  if (item.type === "actor") {
    $("#actorLocomotionMode").value = item.locomotionMode || "auto";
    $("#actorLocomotionMode").disabled = locked || (item.placementMode === "auto" && Boolean(item.mountId));
    $("#actorLocomotionHint").textContent = item.placementMode === "auto" && item.mountId
      ? "차량에 탑승한 배우는 좌석 포즈를 유지합니다."
      : item.locomotionMode === "pose"
        ? "동선 재생 중에도 저장한 포즈를 그대로 유지합니다."
        : "동선 거리와 속도에 맞춰 팔·다리 보행을 프리뷰에 합성합니다.";
    const elev = Number(item.verticalOffset || 0);
    $("#actorElevationSlider").value = elev;
    $("#actorElevationValue").value = elev.toFixed(2);
    const pitch = Math.round(Number(item.pitch || 0));
    $("#actorPitchSlider").value = pitch;
    $("#actorPitchValue").value = pitch;
  }
  $("#shapeField").hidden = item.type === "prop" && item.assetType !== "generic";
  if (item.type === "prop") {
    $("#selectedPropAsset").value = item.assetType;
    $("#propMotionToggle").checked = item.motionEnabled !== false;
    [["X", item.scaleX], ["Y", item.scaleY], ["Z", item.scaleZ]].forEach(([axis, value]) => {
      $("#propScale" + axis).value = value;
      $("#propScale" + axis + "Value").value = Number(value).toFixed(2);
    });
    const elev = Number(item.mountedHeight || 0);
    $("#propElevationSlider").value = elev;
    $("#propElevationValue").value = elev.toFixed(2);
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
  const existing = keysForSource(actor.id).find((keyframe) => timelineTimesMatch(keyframe.time, currentTime));
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
  const actor = selectedPoseActor();
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
  const actor = selectedPoseActor();
  if (!actor || actor.type !== "actor" || sourceEditLocked(actor.id)) return;
  const entry = loadCustomPoses().find((pose) => pose.id === poseId);
  if (!entry) return;
  materializeEvaluatedViewForEditing(actor.id);
  const current = state.items.find((item) => item.id === actor.id);
  current.bodyPose = sanitizeBodyPose(entry.pose);
  selectedPoseActorId = current.id;
  updateExistingSourceKeyframe(current.id);
  commit({ preserveSourceIds: [current.id] });
  notifyApp(`"${entry.name}" 포즈를 적용했습니다.`);
}

function copyActorPose() {
  const actor = selectedPoseActor();
  if (!actor || actor.type !== "actor") return;
  poseClipboard = sanitizeBodyPose(actor.bodyPose);
  notifyApp("배우 포즈를 복사했습니다.");
  syncUi(false);
}

function pasteActorPose() {
  const actor = selectedPoseActor();
  if (!actor || actor.type !== "actor" || sourceEditLocked(actor.id) || !poseClipboard) return;
  materializeEvaluatedViewForEditing(actor.id);
  const current = state.items.find((item) => item.id === actor.id);
  current.bodyPose = sanitizeBodyPose(poseClipboard);
  selectedPoseActorId = current.id;
  updateExistingSourceKeyframe(current.id);
  commit({ preserveSourceIds: [current.id] });
  notifyApp("복사한 포즈를 붙여넣었습니다.");
}

function randomizeActorPose() {
  const actor = selectedPoseActor();
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
  updateExistingSourceKeyframe(current.id);
  commit({ preserveSourceIds: [current.id] });
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
  const actor = selectedPoseActor();
  if (!actor || actor.type !== "actor" || sourceEditLocked(actor.id)) return;
  materializeEvaluatedViewForEditing(actor.id);
  const current = state.items.find((item) => item.id === actor.id);
  current.bodyPose = presetBodyPose(presetId);
  if (presetId === "lieDown") {
    current.pitch = -90;
    current.verticalOffset = 0.1;
  } else if (presetId === "faceDown") {
    current.pitch = 90;
    current.verticalOffset = 0.15;
  } else {
    current.pitch = 0;
    current.verticalOffset = 0;
  }
  selectedPoseActorId = current.id;
  updateExistingSourceKeyframe(current.id);
  commit({ preserveSourceIds: [current.id] });
  notifyApp(`${POSE_PRESET_LABELS[presetId] || "기본"} 포즈를 적용했습니다.`);
}

function captureActorPoseKeyframe() {
  const actor = selectedPoseActor();
  if (!actor || actor.type !== "actor" || sourceEditLocked(actor.id)) return;
  if (!isIndependentMotionSource(actor, state)) {
    notifyApp("차량이나 묶음에서 분리한 뒤 배우 포즈 키를 추가하세요.");
    return;
  }
  materializeEvaluatedViewForEditing(actor.id);
  const current = state.items.find((item) => item.id === actor.id);
  const requestedTime = readTimelineTimeInput(state.motion.playhead);
  const existing = keysForSource(actor.id).find((keyframe) => timelineTimesMatch(keyframe.time, requestedTime));
  setActiveSource(actor.id);
  if (existing) {
    existing.pose = sanitizeSourcePose(actor.id, {
      ...existing.pose,
      bodyPose: current.bodyPose,
      pitch: current.pitch,
      verticalOffset: current.verticalOffset,
    });
    setTimelineSelection([existing.id], existing.id);
    advancePlayheadAfterKeyframe(existing.time);
    commit();
    notifyApp(`${existing.time.toFixed(1)}초 배우 키의 포즈를 갱신했습니다.`);
    return;
  }
  const time = availableKeyTime(requestedTime, actor.id, { maxTime: MAX_TIMELINE_DURATION });
  ensureDurationCovers(time);
  const keyframe = captureSourceKeyframe(actor.id, time, undefined, $("#keyPathSelect")?.value || "straight");
  if (!keyframe) return;
  state.motion.keyframes.push(keyframe);
  setTimelineSelection([keyframe.id], keyframe.id);
  state.motion.playhead = keyframe.time;
  state.motion.keyframes = sortKeyframes(state.motion.keyframes);
  clearLiveSourceEdit(actor.id, keyframe.time);
  advancePlayheadAfterKeyframe(keyframe.time);
  commit();
  notifyApp(`${keyframe.time.toFixed(1)}초에 배우 포즈 키를 추가했습니다.`);
}

function renderKeyStatus(updateInputs = true) {
  normalizeTimelineRuntime();
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
    timeInput.value = formatTimelineTime(displayPlayhead() ?? current?.time ?? 0);
  }
  updatePlayheadDisplay(displayPlayhead());
  const selectedKeys = selectedTimelineKeyframes();
  const selectionLocked = selectedKeys.some((keyframe) => sourceEditLocked(keyframe.source));
  $("#deleteKeyBtn").disabled = !selectedKeys.length || selectionLocked;
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
    marker.classList.toggle("is-active", keyframe.id === primaryTimelineKeyId());
    marker.classList.toggle("is-selected", timelineSelectedKeyIds.has(keyframe.id));
    marker.classList.toggle("is-cut-marker", keyframe.transition === "cut");
    marker.classList.toggle("is-dragging", timelineDrag?.id === keyframe.id);
    marker.classList.toggle("is-locked", sourceEditLocked(keyframe.source));
    marker.classList.toggle("is-camera", keyframe.source === "camera");
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
      if (suppressTimelineMarkerClick) return;
      selectTimelineMarker(keyframe.id, event);
    });
    markers.append(marker);
  });

  const splitView = state.motion.timelineView === "split";
  $("#timelineTrack").hidden = splitView;
  $("#sourceTimelineList").hidden = !splitView;
  $("#timelineHint").textContent = splitView
    ? `대상별 ${visibleSourceDefinitions().length}개 트랙 · 키 ${keyframes.length}개 · ${state.motion.duration}초`
    : `통합 트랙 · 키 ${keyframes.length}개 · 즉시 전환 ${cutTimes.length}개 · ${state.motion.duration}초`;
  renderSourceTimelines(keyframes, cutTimes);
  renderTimelineSelectionTools(selectedKeys, updateInputs);

  const currentText = current
    ? `${sourceLabel(current.source)} · ${current.label} @ ${current.time.toFixed(1)}s · ${isFirstSourceKey ? "첫 키" : `${keyTransitionLabels[normalizeTransition(current.transition)]} · ${pathModeLabels[pathModeForSegment(current.segment, current.source)]}`}${current.note ? ` · 지문: ${current.note}` : ""}${current.source === "camera" ? ` · ${keyframeSummary(current)}` : ""}`
    : "선택된 키 없음";
  const motionText = `키 ${keyframes.length}개`;
  $("#keyStatus").textContent = `${motionText} · ${currentText}`;
}

function renderTimelineSelectionTools(selectedKeys = selectedTimelineKeyframes(), updateInputs = true) {
  const visibleIds = new Set(visibleSourceDefinitions().map((source) => source.id));
  const visibleKeys = state.motion.keyframes.filter((keyframe) => visibleIds.has(keyframe.source));
  const range = timelineSelectionRange(state.motion.keyframes, selectedKeys.map((keyframe) => keyframe.id));
  const tools = $("#timelineSelectionTools");
  const durationInput = $("#selectionDurationInput");
  const locked = selectedKeys.some((keyframe) => sourceEditLocked(keyframe.source));
  $("#timelineSnapSelect").value = timelineSnapMode;
  $("#keyTimeInput").step = timelineSnapMode === "frame"
    ? timelineSnapStep(timelineSnapMode, state.motion.fps).toFixed(4)
    : String(timelineSnapStep(timelineSnapMode, state.motion.fps));
  $("#selectAllKeysBtn").disabled = !visibleKeys.length;
  $("#copyKeysBtn").disabled = !selectedKeys.length;
  $("#pasteKeysBtn").disabled = !timelineClipboard?.entries?.length;
  tools.hidden = selectedKeys.length < 2;
  if (tools.hidden) return;
  const sourceCount = new Set(selectedKeys.map((keyframe) => keyframe.source)).size;
  $("#timelineSelectionSummary").textContent = range
    ? `선택 ${selectedKeys.length}개 · ${sourceCount}개 대상 · ${range.start.toFixed(2)}–${range.end.toFixed(2)}초`
    : `선택 ${selectedKeys.length}개`;
  const step = timelineSnapStep(timelineSnapMode, state.motion.fps);
  durationInput.min = Math.max(0.01, step).toFixed(4);
  durationInput.step = timelineSnapMode === "frame" ? step.toFixed(4) : String(step);
  if (updateInputs || document.activeElement !== durationInput) {
    durationInput.value = Number(range?.duration || step).toFixed(timelineSnapMode === "frame" ? 4 : 2);
  }
  durationInput.disabled = locked || !range || range.duration <= 0;
  $("#retimeSelectionBtn").disabled = durationInput.disabled;
}

function selectTimelineMarker(keyframeId, event = {}, sourceScope = "") {
  const keyframe = state.motion.keyframes.find((entry) => entry.id === keyframeId);
  if (!keyframe) return;
  normalizeTimelineRuntime();
  const additive = Boolean(event.metaKey || event.ctrlKey);
  const rangeSelect = Boolean(event.shiftKey && timelineSelectionAnchorId);
  let nextIds = new Set(timelineSelectedKeyIds);
  let primaryId = keyframe.id;

  if (rangeSelect) {
    const visibleIds = new Set(visibleSourceDefinitions().map((source) => source.id));
    const ordered = sortKeyframes(state.motion.keyframes).filter((entry) => (
      visibleIds.has(entry.source) && (!sourceScope || entry.source === sourceScope)
    ));
    const anchorIndex = ordered.findIndex((entry) => entry.id === timelineSelectionAnchorId);
    const targetIndex = ordered.findIndex((entry) => entry.id === keyframe.id);
    if (anchorIndex >= 0 && targetIndex >= 0) {
      if (!additive) nextIds = new Set();
      const start = Math.min(anchorIndex, targetIndex);
      const end = Math.max(anchorIndex, targetIndex);
      ordered.slice(start, end + 1).forEach((entry) => nextIds.add(entry.id));
    } else {
      nextIds = new Set([keyframe.id]);
    }
  } else if (additive) {
    if (nextIds.has(keyframe.id)) nextIds.delete(keyframe.id);
    else nextIds.add(keyframe.id);
    primaryId = nextIds.has(keyframe.id) ? keyframe.id : [...nextIds].at(-1) || "";
    timelineSelectionAnchorId = keyframe.id;
  } else {
    nextIds = new Set([keyframe.id]);
    timelineSelectionAnchorId = keyframe.id;
  }

  setTimelineSelection(nextIds, primaryId, { updateAnchor: !rangeSelect });
  const primary = state.motion.keyframes.find((entry) => entry.id === timelinePrimaryKeyId);
  if (primary) {
    setActiveSource(primary.source);
    selectSourceOnStage(primary.source);
    previewKeyframeOnStage(primary);
    setTimelineSelection(nextIds, primary.id, { updateAnchor: false });
  } else {
    evaluatedViewState = interpolateStateAtTime(state.motion.playhead);
  }
  syncUi();
  draw(evaluatedViewState || state);
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

    const laneProgress = document.createElement("div");
    laneProgress.className = "timeline-progress source-lane-progress";
    track.append(laneProgress);

    setupScrubDragging(track);

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
        marker.classList.toggle("is-active", keyframe.id === primaryTimelineKeyId());
        marker.classList.toggle("is-selected", timelineSelectedKeyIds.has(keyframe.id));
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
          if (suppressTimelineMarkerClick) return;
          selectTimelineMarker(keyframe.id, event, source.id);
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
    unique.add(Number(keyframe.time.toFixed(4)));
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
  if (event.button != null && event.button !== 0) return;
  const keyframe = state.motion.keyframes.find((entry) => entry.id === keyframeId);
  if (!keyframe) return;
  if ((event.metaKey || event.ctrlKey || event.shiftKey) && !timelineSelectedKeyIds.has(keyframe.id)) return;
  event.stopPropagation();
  cancelPreview();
  const selectedIds = timelineSelectedKeyIds.has(keyframe.id) && timelineSelectedKeyIds.size > 1
    ? [...timelineSelectedKeyIds]
    : [keyframe.id];
  const groupedIds = expandSynchronizedCutSelection(state.motion.keyframes, selectedIds);
  const groupedKeys = state.motion.keyframes.filter((entry) => groupedIds.includes(entry.id));
  if (groupedKeys.some((entry) => sourceEditLocked(entry.source))) {
    selectKeyframe(keyframe.id);
    notifyApp("선택한 키 또는 같은 시점의 즉시 전환 키가 잠겨 있어 이동할 수 없습니다.");
    return;
  }
  const track = event.currentTarget.closest(".source-lane-track, .timeline-track") || $("#timelineTrack");
  const trackRect = track.getBoundingClientRect();
  const selectionBefore = [...timelineSelectedKeyIds];
  setTimelineSelection(groupedIds, keyframe.id);
  timelineDrag = {
    id: keyframeId,
    pointerId: event.pointerId ?? "mouse",
    target: event.currentTarget,
    startDuration: state.motion.duration,
    startTime: keyframe.time,
    startState: clone(state),
    startKeyframes: clone(state.motion.keyframes),
    selectedIds: groupedIds,
    selectionBefore,
    group: groupedKeys.map((entry) => ({ id: entry.id, startTime: entry.time })),
    trackRect: {
      left: trackRect.left,
      width: Math.max(1, trackRect.width),
    },
    moved: false,
    lastReason: "",
  };
  if (event.pointerId != null) event.currentTarget.setPointerCapture?.(event.pointerId);
  setActiveSource(keyframe.source);
  selectSourceOnStage(keyframe.source);
  evaluatedViewState = interpolateStateAtTime(keyframe.time);
  updatePlayheadDisplay(keyframe.time);
  syncUi(false);
  draw(evaluatedViewState);
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
  const rawPercent = clamp((clientX - timelineDrag.trackRect.left) / timelineDrag.trackRect.width, 0, 1);
  const rawTime = rawPercent * timelineDrag.startDuration;
  const result = moveTimelineSelection(
    timelineDrag.startKeyframes,
    timelineDrag.selectedIds,
    timelineDrag.id,
    rawTime,
    { mode: timelineSnapMode, fps: state.motion.fps, maximum: timelineDrag.startDuration },
  );
  if (!result.ok) {
    timelineDrag.lastReason = result.reason;
    return;
  }
  state.motion.keyframes = sortKeyframes(result.keyframes);
  setTimelineSelection(result.ids, result.primaryId, { updateAnchor: false });
  const primary = selectedKeyframe();
  state.motion.playhead = primary?.time ?? state.motion.playhead;
  evaluatedViewState = null;
  timelineDrag.moved = result.keyframes.some((keyframe) => {
    const original = timelineDrag.startKeyframes.find((entry) => entry.id === keyframe.id);
    return original && !sameTimelineTime(original.time, keyframe.time, 0.00005);
  });
  timelineDrag.lastReason = "";
  syncUi(false);
  draw();
}

function finishTimelineMarkerDrag() {
  const completedDrag = timelineDrag;
  if (timelineDrag.pointerId !== "mouse") {
    timelineDrag.target?.releasePointerCapture?.(timelineDrag.pointerId);
  }
  suppressTimelineMarkerClick = completedDrag.moved;
  if (suppressTimelineMarkerClick) window.setTimeout(() => { suppressTimelineMarkerClick = false; }, 0);
  timelineDrag = null;
  if (completedDrag.moved) commit();
  else {
    if (completedDrag.lastReason === "order") notifyApp("같은 대상의 다른 키를 넘어 이동할 수 없습니다.");
    syncUi();
    draw(evaluatedViewState || state);
  }
}

function cancelTimelineMarkerDrag() {
  if (!timelineDrag) return;
  const cancelledDrag = timelineDrag;
  if (cancelledDrag.pointerId !== "mouse") {
    cancelledDrag.target?.releasePointerCapture?.(cancelledDrag.pointerId);
  }
  timelineDrag = null;
  if (cancelledDrag.startState) {
    restoreUncommittedState(cancelledDrag.startState);
    setTimelineSelection(cancelledDrag.selectionBefore, cancelledDrag.id, { updateAnchor: false });
    syncUi();
    draw(evaluatedViewState || state);
  }
}

function updatePlayheadDisplay(time) {
  const safeTime = clamp(Number(time || 0), 0, state.motion.duration);
  const percent = (safeTime / state.motion.duration) * 100;
  document.querySelectorAll(".timeline-progress").forEach((progress) => {
    progress.style.width = `${percent}%`;
  });
  const timeInput = $("#keyTimeInput");
  if (document.activeElement !== timeInput) timeInput.value = formatTimelineTime(safeTime);
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
  val = clamp(val, 0.4, 35);
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
  state.camera.tiltDeg = clamp(Number(event.target.value), -90, 90);
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
  val = clamp(val, -90, 90);
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
    locomotionMode: type === "actor" ? "auto" : "pose",
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
  const added = preset.items.map(([assetType, name, x, y, facing, size, mountedHeight = 0]) => sanitizeItemPose({
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
    mountedHeight,
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

$("#actorElevationSlider").addEventListener("input", (event) => {
  materializeEvaluatedViewForEditing();
  const item = selectedItem();
  if (!item || item.type !== "actor") return;
  item.verticalOffset = clamp(Number(event.target.value), -1, 5);
  $("#actorElevationValue").value = item.verticalOffset.toFixed(2);
  draw();
  if (viewMode === "3d") renderThreeView(state, true);
});
$("#actorElevationSlider").addEventListener("change", finalizeLiveProjectInputEdit);

$("#actorElevationValue").addEventListener("input", (event) => {
  materializeEvaluatedViewForEditing();
  const item = selectedItem();
  if (!item || item.type !== "actor") return;
  let val = Number(event.target.value);
  if (!Number.isFinite(val)) return;
  val = clamp(val, -1, 5);
  item.verticalOffset = val;
  $("#actorElevationSlider").value = val;
  draw();
  if (viewMode === "3d") renderThreeView(state, true);
});
$("#actorElevationValue").addEventListener("change", finalizeLiveProjectInputEdit);

$("#propElevationSlider").addEventListener("input", (event) => {
  materializeEvaluatedViewForEditing();
  const item = selectedItem();
  if (!item || item.type !== "prop") return;
  item.mountedHeight = clamp(Number(event.target.value), -1, 5);
  $("#propElevationValue").value = item.mountedHeight.toFixed(2);
  draw();
  if (viewMode === "3d") renderThreeView(state, true);
});
$("#propElevationSlider").addEventListener("change", finalizeLiveProjectInputEdit);

$("#propElevationValue").addEventListener("input", (event) => {
  materializeEvaluatedViewForEditing();
  const item = selectedItem();
  if (!item || item.type !== "prop") return;
  let val = Number(event.target.value);
  if (!Number.isFinite(val)) return;
  val = clamp(val, -1, 5);
  item.mountedHeight = val;
  $("#propElevationSlider").value = val;
  draw();
  if (viewMode === "3d") renderThreeView(state, true);
});
$("#propElevationValue").addEventListener("change", finalizeLiveProjectInputEdit);

$("#actorPitchSlider").addEventListener("input", (event) => {
  materializeEvaluatedViewForEditing();
  const item = selectedItem();
  if (!item || item.type !== "actor") return;
  item.pitch = clamp(Number(event.target.value), -90, 90);
  $("#actorPitchValue").value = Math.round(item.pitch);
  draw();
  if (viewMode === "3d") renderThreeView(state, true);
});
$("#actorPitchSlider").addEventListener("change", finalizeLiveProjectInputEdit);

$("#actorPitchValue").addEventListener("input", (event) => {
  materializeEvaluatedViewForEditing();
  const item = selectedItem();
  if (!item || item.type !== "actor") return;
  let val = Number(event.target.value);
  if (!Number.isFinite(val)) return;
  val = clamp(val, -90, 90);
  item.pitch = val;
  $("#actorPitchSlider").value = val;
  draw();
  if (viewMode === "3d") renderThreeView(state, true);
});
$("#actorPitchValue").addEventListener("change", finalizeLiveProjectInputEdit);

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

$("#actorLocomotionMode").addEventListener("change", (event) => {
  const actor = selectedItem();
  if (!actor || actor.type !== "actor" || sourceEditLocked(actor.id)) return;
  actor.locomotionMode = actorLocomotionModes[event.target.value] ? event.target.value : "auto";
  commit();
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
  const actor = selectedPoseActor();
  if (!actor || actor.type !== "actor" || sourceEditLocked(actor.id)) return;
  materializeEvaluatedViewForEditing(actor.id);
  const current = state.items.find((item) => item.id === actor.id);
  current.bodyPose = mirrorBodyPose(current.bodyPose);
  selectedPoseActorId = current.id;
  updateExistingSourceKeyframe(current.id);
  commit({ preserveSourceIds: [current.id] });
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
$(".cut-version-panel").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-cut-version-action]");
  if (!button) return;
  if (button.dataset.cutVersionAction === "capture") captureCutVersion(button.dataset.slot);
  if (button.dataset.cutVersionAction === "restore") restoreCutVersion(button.dataset.slot);
});
$("#compareCutVersionsBtn").addEventListener("click", showCutVersionComparison);
$("#selectedCutIssueCount").addEventListener("click", () => {
  const button = $("#selectedCutIssueCount");
  const list = $("#selectedCutIssueList");
  if (button.disabled) return;
  const expanded = button.getAttribute("aria-expanded") === "true";
  button.setAttribute("aria-expanded", String(!expanded));
  list.hidden = expanded;
});

$("#selectedCutIssueList").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-continuity-action]");
  const cut = currentCut();
  if (!button || !cut) return;
  const finding = continuityFindingsForCut(cut).find((entry) => entry.id === button.dataset.issueId);
  if (!finding) return;
  pushProjectHistory();
  cut.continuity = storyboardCore.normalizedContinuity(cut.continuity);
  if (button.dataset.continuityAction === "restore") {
    delete cut.continuity.overrides[finding.id];
    notifyApp("연속성 예외를 해제했습니다.");
  } else {
    const note = $("#selectedCutIssueList").querySelector(`[data-continuity-note="${CSS.escape(finding.id)}"]`)?.value.trim();
    if (!note) {
      notifyApp("예외 처리 이유를 먼저 적어주세요.");
      projectHistory.pop();
      syncHistoryButtons();
      return;
    }
    cut.continuity.overrides[finding.id] = {
      signature: finding.signature,
      note,
      updatedAt: isoNow(),
    };
    notifyApp("의도된 연속성 변경으로 표시했습니다.");
  }
  touchProjectCut(cut);
  renderStoryboardWorkspace();
  $("#selectedCutIssueCount").click();
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
  "#cutFocalInput",
  "#cutDurationInput",
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
  input.addEventListener("input", (event) => updateStoryboardCutFromInspector(event.currentTarget.id, false));
  input.addEventListener("change", (event) => updateStoryboardCutFromInspector(event.currentTarget.id, true));
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
$("#multiCamVideoBtn").addEventListener("click", exportMultiCameraVideo);
$("#multiCamVideoPanelBtn").addEventListener("click", exportMultiCameraVideo);
$("#multiCamPreviewBtn").addEventListener("click", exportMultiCameraPreview);
$("#multiCamPreviewPanelBtn").addEventListener("click", exportMultiCameraPreview);
$("#multiCamPreviewPanelBtnSecondary").addEventListener("click", exportMultiCameraPreview);
$("#addCameraBtn").addEventListener("click", addCameraProfile);
$("#cameraFrameModeBtn").addEventListener("click", () => {
  cameraPreviewMode = cameraPreviewMode === "single" ? "multi" : "single";
  updateCameraFrameModeButton();
  if (viewMode === "3d") renderThreeView(threeView?.lastState || state, true);
  else renderCameraFramePreview(threeView?.lastState || evaluatedViewState || state);
});
$("#selectedCutFrameBtn").addEventListener("click", exportSelectedCutFrame);
$("#selectedCutVideoBtn").addEventListener("click", exportSelectedCutVideo);
$("#blockingPlanBtn").addEventListener("click", exportBlockingPlanImage);
$("#blockingPlanPanelBtn").addEventListener("click", exportBlockingPlanImage);
$("#frameBtn").addEventListener("click", exportCurrentCameraFrame);
$("#framePanelBtn").addEventListener("click", exportCurrentCameraFrame);
$("#framePairBtn").addEventListener("click", exportStartEndCameraFrames);
$("#framePairPanelBtn").addEventListener("click", exportStartEndCameraFrames);
$("#productionPackBtn").addEventListener("click", exportProductionPack);
$("#productionPackPanelBtn").addEventListener("click", exportProductionPack);
$("#addKeyBtn").addEventListener("click", addMotionKey);
$("#updateKeyBtn").addEventListener("click", updateSelectedKey);
$("#deleteKeyBtn").addEventListener("click", deleteSelectedKey);
$("#selectAllKeysBtn").addEventListener("click", selectAllVisibleTimelineKeys);
$("#copyKeysBtn").addEventListener("click", copySelectedTimelineKeys);
$("#pasteKeysBtn").addEventListener("click", pasteTimelineKeys);
$("#retimeSelectionBtn").addEventListener("click", retimeSelectedTimelineKeys);
$("#selectionDurationInput").addEventListener("keydown", (event) => {
  event.stopPropagation();
  if (event.key !== "Enter") return;
  event.preventDefault();
  retimeSelectedTimelineKeys();
  event.target.blur();
});
$("#timelineSnapSelect").addEventListener("change", (event) => {
  timelineSnapMode = ["frame", "0.1", "0.5", "1", "off"].includes(event.target.value)
    ? event.target.value
    : "frame";
  saveTimelineSnapMode();
  syncUi(false);
  notifyApp(`타임라인 스냅: ${event.target.selectedOptions[0]?.textContent || "프레임"}`);
});
$(".timeline").addEventListener("pointerdown", () => { timelineFocused = true; });
stageViewport.addEventListener("pointerdown", () => { timelineFocused = false; });
$("#playBtn").addEventListener("click", playPreview);
$("#pauseBtn").addEventListener("click", pausePreview);
$("#stopBtn").addEventListener("click", stopPreview);
$("#rewindBtn").addEventListener("click", stopPreview);

$("#timelineTrack").addEventListener("dblclick", (event) => {
  event.preventDefault();
  event.stopPropagation();
  stopPreview();
});

$("#sourceTimelineList").addEventListener("dblclick", (event) => {
  if (event.target.closest(".source-lane-track")) {
    event.preventDefault();
    event.stopPropagation();
    stopPreview();
  }
});

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

setupScrubDragging($("#timelineTrack"));

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
  const sameTimeKeys = state.motion.keyframes.filter((entry) => timelineTimesMatch(entry.time, keyframe.time));
  if (sameTimeKeys.some((entry) => sourceEditLocked(entry.source))) {
    notifyApp("같은 시점의 키가 잠겨 있어 도착 방식을 함께 바꿀 수 없습니다.");
    syncUi();
    return;
  }
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
    keyframe.time = clamp(Number((keyframe.time * scale).toFixed(4)), 0, state.motion.duration);
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
  setTimelineSelection(changedKeys.map((keyframe) => keyframe.id), selectedKey?.id || "");
  const baseTime = selectedKey?.time ?? requestedTime;
  advancePlayheadAfterKeyframe(baseTime);
  commit();
  const skipped = requestedSources.length - sources.length;
  notifyApp(skipped
    ? `잠긴 대상 ${skipped}개를 제외하고 키 ${changedKeys.length}개를 추가했습니다.`
    : `현재 시간에 키 ${changedKeys.length}개를 추가했습니다.`);
}

function updateSelectedKey() {
  const sourceId = activeSourceId();
  let keyframe = sourceId === "all"
    ? selectedKeyframe()
    : selectedKeyframe()?.source === sourceId
      ? selectedKeyframe()
      : selectKeyForSource(sourceId);
  if (!keyframe) return;
  if (sourceEditLocked(keyframe.source)) {
    notifyEditLocked(sourceLabel(keyframe.source));
    return;
  }
  const requestedTime = readTimelineTimeInput(keyframe.time);
  const cutGroupIds = expandSynchronizedCutSelection(state.motion.keyframes, [keyframe.id]);
  const cutGroup = state.motion.keyframes.filter((entry) => cutGroupIds.includes(entry.id));
  if (cutGroup.some((entry) => sourceEditLocked(entry.source))) {
    notifyApp("같은 시점의 즉시 전환 키가 잠겨 있어 키를 갱신할 수 없습니다.");
    return;
  }
  const timing = moveTimelineSelection(
    state.motion.keyframes,
    cutGroupIds,
    keyframe.id,
    requestedTime,
    { mode: timelineSnapMode, fps: state.motion.fps, maximum: MAX_TIMELINE_DURATION },
  );
  if (!timing.ok) {
    notifyApp(timing.reason === "order"
      ? "같은 대상의 다른 키를 넘어 갱신할 수 없습니다."
      : "요청한 시간에 다른 키가 있어 갱신하지 않았습니다.");
    syncUi();
    return;
  }
  materializeEvaluatedViewForEditing(keyframe.source);
  const previousPose = clone(keyframe.pose);
  state.motion.keyframes = sortKeyframes(timing.keyframes);
  keyframe = state.motion.keyframes.find((entry) => entry.id === keyframe.id);
  const time = keyframe.time;
  ensureDurationCovers(Math.max(...timing.ids.map((id) => state.motion.keyframes.find((entry) => entry.id === id)?.time || 0)));
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
  setTimelineSelection(timing.ids, keyframe.id);
  commit();
  notifyApp("선택한 키를 갱신했습니다.");
}

function deleteSelectedKey() {
  const selectedKeys = selectedTimelineKeyframes();
  const primary = selectedKeyframe() || selectedKeys[0];
  if (!selectedKeys.length || !primary) return;
  if (selectedKeys.some((keyframe) => sourceEditLocked(keyframe.source))) {
    notifyApp("선택한 키 중 잠긴 대상이 있어 삭제하지 않았습니다.");
    return;
  }
  const ids = new Set(selectedKeys.map((keyframe) => keyframe.id));
  state.motion.keyframes = state.motion.keyframes.filter((entry) => !ids.has(entry.id));
  const next = nearestKeyframe(keysForSource(primary.source), primary.time)
    || nearestKeyframe(sortKeyframes(state.motion.keyframes), primary.time);
  if (next) {
    setActiveSource(next.source);
    selectSourceOnStage(next.source);
    setTimelineSelection([next.id], next.id);
  }
  else setTimelineSelection([], "");
  commit();
  if (next) {
    evaluatedViewState = interpolateStateAtTime(next.time);
    syncUi();
    draw(evaluatedViewState);
  }
  notifyApp(`키 ${selectedKeys.length}개를 삭제했습니다.`);
}

function selectAllVisibleTimelineKeys() {
  const visibleSourceIds = new Set(visibleSourceDefinitions().map((source) => source.id));
  const keys = sortKeyframes(state.motion.keyframes).filter((keyframe) => visibleSourceIds.has(keyframe.source));
  if (!keys.length) return;
  const currentId = primaryTimelineKeyId();
  setTimelineSelection(keys.map((keyframe) => keyframe.id), keys.some((keyframe) => keyframe.id === currentId) ? currentId : keys[0].id);
  syncUi();
  draw(evaluatedViewState || state);
  notifyApp(`보이는 키 ${keys.length}개를 선택했습니다.`);
}

function copySelectedTimelineKeys() {
  const keys = selectedTimelineKeyframes();
  if (!keys.length) return;
  const baseTime = Math.min(...keys.map((keyframe) => keyframe.time));
  const primaryId = primaryTimelineKeyId();
  timelineClipboard = {
    version: 1,
    entries: keys.map((keyframe) => ({
      source: keyframe.source,
      offset: Number((keyframe.time - baseTime).toFixed(4)),
      keyframe: clone(keyframe),
    })),
    primaryIndex: Math.max(0, keys.findIndex((keyframe) => keyframe.id === primaryId)),
  };
  syncUi(false);
  notifyApp(`키 ${keys.length}개를 복사했습니다. 현재 시간에 붙여넣을 수 있습니다.`);
}

function timelineSourceCanReceivePaste(sourceId) {
  if (sourceId === "camera") return true;
  const item = state.items.find((entry) => entry.id === sourceId);
  return Boolean(item && isIndependentMotionSource(item, state));
}

function pasteTimelineKeys() {
  const entries = timelineClipboard?.entries || [];
  if (!entries.length) return;
  const invalid = entries.find((entry) => !timelineSourceCanReceivePaste(entry.source));
  if (invalid) {
    notifyApp(`${sourceLabel(invalid.source)}은(는) 현재 독립 동선 대상이 아니어서 붙여넣지 않았습니다.`);
    return;
  }
  const locked = entries.find((entry) => sourceEditLocked(entry.source));
  if (locked) {
    notifyApp(`${sourceLabel(locked.source)} 편집 잠금을 해제한 뒤 붙여넣으세요.`);
    return;
  }
  const plan = resolveTimelinePasteTimes(
    state.motion.keyframes,
    entries.map((entry) => ({ source: entry.source, offset: entry.offset })),
    displayPlayhead(),
    { mode: timelineSnapMode, fps: state.motion.fps, maximum: MAX_TIMELINE_DURATION },
  );
  if (!plan.ok) {
    notifyApp("선택한 구간을 넣을 빈 시간이 없습니다. 현재 시간을 옮겨 다시 시도하세요.");
    return;
  }
  ensureDurationCovers(Math.max(...plan.times));
  const created = entries.map((entry, index) => ({
    ...clone(entry.keyframe),
    id: uid(),
    time: plan.times[index],
  }));
  created.forEach((keyframe) => showSourceTimeline(keyframe.source));
  state.motion.keyframes = sortKeyframes([...state.motion.keyframes, ...created]);
  const primary = created[timelineClipboard.primaryIndex] || created[0];
  setTimelineSelection(created.map((keyframe) => keyframe.id), primary.id);
  state.motion.playhead = primary.time;
  commit();
  notifyApp(`현재 시간부터 키 ${created.length}개를 붙여넣었습니다.`);
}

function retimeSelectedTimelineKeys() {
  const keys = selectedTimelineKeyframes();
  if (keys.length < 2) return;
  if (keys.some((keyframe) => sourceEditLocked(keyframe.source))) {
    notifyApp("선택한 키 중 잠긴 대상이 있어 구간을 바꾸지 않았습니다.");
    return;
  }
  const requestedDuration = Number($("#selectionDurationInput").value);
  const result = scaleTimelineSelection(
    state.motion.keyframes,
    keys.map((keyframe) => keyframe.id),
    requestedDuration,
    { mode: timelineSnapMode, fps: state.motion.fps, maximum: MAX_TIMELINE_DURATION },
  );
  if (!result.ok) {
    notifyApp(result.reason === "order"
      ? "같은 대상의 다른 키를 넘어설 수 없습니다. 구간 길이를 조정하세요."
      : "선택 구간에 다른 키가 겹쳐 시간을 바꾸지 않았습니다.");
    syncUi();
    return;
  }
  const primaryId = primaryTimelineKeyId();
  state.motion.keyframes = sortKeyframes(result.keyframes);
  setTimelineSelection(result.ids, primaryId);
  const primary = selectedKeyframe();
  if (primary) state.motion.playhead = primary.time;
  commit();
  notifyApp(`선택 구간을 ${result.duration.toFixed(2)}초로 맞췄습니다.`);
}

function createSourceKeyframe(sourceId, time, pathMode = "straight") {
  showSourceTimeline(sourceId);
  const keyframe = captureSourceKeyframe(sourceId, time, undefined, pathMode);
  if (keyframe) {
    applyPathModeToKeyframe(keyframe, pathMode);
    state.motion.keyframes.push(keyframe);
    clearLiveSourceEdit(sourceId, time);
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
  const candidateKeys = (sourceId === "all" ? state.motion.keyframes : keysForSource(sourceId))
    .filter((keyframe) => keyframe.id !== options.excludeId);
  const maxTime = options.maxTime ?? state.motion.duration;
  const plan = resolveTimelinePasteTimes(
    candidateKeys,
    [{ source: sourceId, offset: 0 }],
    requestedTime,
    { mode: timelineSnapMode, fps: state.motion.fps, maximum: maxTime },
  );
  return plan.ok ? plan.times[0] : snapTimelineTime(requestedTime, 0, maxTime);
}

function selectKeyframe(id) {
  const keyframe = state.motion.keyframes.find((entry) => entry.id === id);
  if (!keyframe) return;
  setActiveSource(keyframe.source);
  selectSourceOnStage(keyframe.source);
  previewKeyframeOnStage(keyframe);
  syncUi();
  draw(evaluatedViewState);
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
  clearLiveSourceEdits();
  state = clone(startState);
  sanitizeState();
  evaluatedViewState = interpolateStateAtTime(state.motion.playhead);
  const cut = currentCut();
  if (cut) cut.blocking = state;
  selected = selectedExists(selected) ? selected : { kind: "camera" };
  selectKeyForSource(selectedSourceId() || activeSourceId());
  syncUi();
  draw(evaluatedViewState);
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
  return applyLiveSourceEdits(applyActiveCameraTracking(next, state), safeTime);
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
  evaluatedViewState = interpolateStateAtTime(state.motion.playhead);
  updatePlayheadDisplay(state.motion.playhead);
  draw(evaluatedViewState);
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
      label: `${renderState.camera.focal}mm / ${Math.round(focalToFov(renderState.camera.focal, cameraSensorWidth(renderState)))}° 화각`,
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
    const halfFov = degToRad(focalToFov(camera.focal, cameraSensorWidth(frameState))) / 2;
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
    .filter((time, index, list) => index === 0 || !sameTimelineTime(time, list[index - 1], 0.0005))
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
  return applyLiveSourceEdits(applyActiveCameraTracking(next, renderState), safeTime);
}

function interpolateSourceAtTimeFor(renderState, sourceId, time, fallbackPose) {
  const keyframes = sortKeyframes(renderState.motion?.keyframes || []).filter((keyframe) => keyframe.source === sourceId);
  if (!keyframes.length) return clone(fallbackPose);
  if (keyframes.length === 1 || time <= keyframes[0].time) return mergePoseWithFallbackFor(renderState, sourceId, keyframes[0].pose, fallbackPose);
  const last = keyframes[keyframes.length - 1];
  if (time >= last.time) return mergePoseWithFallbackFor(renderState, sourceId, last.pose, fallbackPose);

  let start = keyframes[0];
  let end = last;
  let segmentIndex = 0;
  for (let i = 0; i < keyframes.length - 1; i += 1) {
    if (time >= keyframes[i].time && time <= keyframes[i + 1].time) {
      start = keyframes[i];
      end = keyframes[i + 1];
      segmentIndex = i;
      break;
    }
  }
  const transition = normalizeTransition(end.transition);
  const easedProgress = transitionProgress(time, start.time, end.time, transition);
  const rawProgress = clamp((time - start.time) / Math.max(0.000001, end.time - start.time), 0, 1);
  // Spatial blocking must cross ordinary key boundaries without braking at
  // every marker. Holds and cuts retain their explicit discontinuous behavior.
  const progress = transition === "smooth" || transition === "linear" ? rawProgress : easedProgress;
  const routeMotion = sourceRouteMotionStats(renderState, sourceId, keyframes, segmentIndex);
  return interpolatePoseFor(renderState, sourceId, start.pose, end.pose, progress, fallbackPose, end, {
    startTime: start.time,
    endTime: end.time,
    currentTime: time,
    ...routeMotion,
  });
}

function sourceRouteMotionStats(renderState, sourceId, keyframes, activeSegmentIndex) {
  if (sourceId === "camera") return {};
  const size = stageWorldSize(renderState);
  let distanceBefore = 0;
  let movingDistance = 0;
  let movingDuration = 0;
  keyframes.slice(1).forEach((end, index) => {
    const start = keyframes[index];
    const transition = normalizeTransition(end.transition);
    if (transition === "hold" || transition === "cut") return;
    const distance = Math.hypot(
      (Number(end.pose?.x || 0) - Number(start.pose?.x || 0)) * size.width,
      (Number(end.pose?.y || 0) - Number(start.pose?.y || 0)) * size.depth,
    );
    if (index < activeSegmentIndex) distanceBefore += distance;
    movingDistance += distance;
    movingDuration += Math.max(0, Number(end.time) - Number(start.time));
  });
  return {
    routeDistanceBefore: distanceBefore,
    routeAverageSpeed: movingDuration > 0 ? movingDistance / movingDuration : 0,
  };
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

function interpolatePoseFor(renderState, sourceId, startPose, endPose, t, fallbackPose, endKeyframe = null, timing = null) {
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
      focusDistanceM: lerp(from.focusDistanceM, to.focusDistanceM, t),
      trackingTargetId: sanitizeTrackingTargetId(t < 0.5 ? from.trackingTargetId : to.trackingTargetId, renderState),
    }, renderState);
  }
  const keyedBodyPose = from.type === "actor" ? interpolateBodyPose(from.bodyPose, to.bodyPose, t) : null;
  const locomotion = from.type === "actor"
    ? actorLocomotionForSegment(renderState, from, to, t, endKeyframe, timing, keyedBodyPose)
    : { pose: null, bob: 0 };

  let interpolatedFacing = lerpAngle(from.facing, to.facing, t);
  if (from.type === "actor") {
    const requestedMode = actorLocomotionModes[to.locomotionMode] ? to.locomotionMode : "auto";
    const transition = normalizeTransition(endKeyframe?.transition);
    const isMovingSegment = requestedMode !== "pose" && transition !== "hold" && transition !== "cut";

    if (isMovingSegment) {
      const size = stageWorldSize(renderState);
      const totalDistance = Math.hypot((to.x - from.x) * size.width, (to.y - from.y) * size.depth);
      if (totalDistance > 0.05) {
        const dt = 0.005;
        const t1 = Math.max(0, t - dt);
        const t2 = Math.min(1, t + dt);

        const p1 = evaluateMotionSegment(renderState, sourceId, from, to, t1, segment);
        const p2 = evaluateMotionSegment(renderState, sourceId, from, to, t2, segment);

        const dx = (p2.x - p1.x) * size.width;
        const dy = (p2.y - p1.y) * size.depth;

        if (Math.hypot(dx, dy) > 0.001) {
          const tangentAngle = radToDeg(Math.atan2(dy, dx));

          // Tangent at start (t=0)
          const posS1 = evaluateMotionSegment(renderState, sourceId, from, to, 0, segment);
          const posS2 = evaluateMotionSegment(renderState, sourceId, from, to, dt, segment);
          const tangentStart = radToDeg(Math.atan2((posS2.y - posS1.y) * size.depth, (posS2.x - posS1.x) * size.width));

          // Tangent at end (t=1)
          const posE1 = evaluateMotionSegment(renderState, sourceId, from, to, 1 - dt, segment);
          const posE2 = evaluateMotionSegment(renderState, sourceId, from, to, 1, segment);
          const tangentEnd = radToDeg(Math.atan2((posE2.y - posE1.y) * size.depth, (posE2.x - posE1.x) * size.width));

          // Compute user offset relative to path tangent at start and end
          const offsetStart = ((from.facing - tangentStart + 540) % 360) - 180;
          const offsetEnd = ((to.facing - tangentEnd + 540) % 360) - 180;

          // Interpolate the offset angle
          const offset = lerpAngle(offsetStart, offsetEnd, t);

          // Final facing is tangent angle plus the interpolated offset
          interpolatedFacing = (tangentAngle + offset + 360) % 360;
        }
      }
    }
  }

  return {
    ...from,
    x: spatial.x,
    y: spatial.y,
    size: lerp(from.size, to.size, t),
    scaleX: lerp(from.scaleX, to.scaleX, t),
    scaleY: lerp(from.scaleY, to.scaleY, t),
    scaleZ: lerp(from.scaleZ, to.scaleZ, t),
    verticalOffset: lerp(Number(from.verticalOffset || 0), Number(to.verticalOffset || 0), t) + locomotion.bob,
    pitch: lerp(Number(from.pitch || 0), Number(to.pitch || 0), t),
    facing: interpolatedFacing,
    bodyPose: locomotion.pose,
    color: to.color,
    shape: to.shape,
    assetType: to.assetType,
    mountId: t < 0.5 ? from.mountId : to.mountId,
    seatIndex: t < 0.5 ? from.seatIndex : to.seatIndex,
    name: to.name,
    visible: t < 0.5 ? from.visible !== false : to.visible !== false,
  };
}

function actorLocomotionForSegment(renderState, from, to, progress, endKeyframe, timing, keyedPose) {
  const pose = sanitizeBodyPose(keyedPose);
  const requestedMode = actorLocomotionModes[to.locomotionMode] ? to.locomotionMode : "auto";
  const transition = normalizeTransition(endKeyframe?.transition);
  if (requestedMode === "pose"
    || transition === "hold"
    || transition === "cut"
    || (to.placementMode === "auto" && to.mountId)
    || Math.abs(Number(to.pitch || 0)) > 25) {
    return { pose, bob: 0 };
  }

  const size = stageWorldSize(renderState);
  const distance = Math.hypot((to.x - from.x) * size.width, (to.y - from.y) * size.depth);
  if (distance < 0.05) return { pose, bob: 0 };
  const duration = Math.max(0.001, Number(timing?.endTime || 0) - Number(timing?.startTime || 0));
  const speed = Math.max(0, Number(timing?.routeAverageSpeed ?? (distance / duration)));
  const mode = requestedMode === "auto" ? (speed >= 2.4 ? "run" : "walk") : requestedMode;
  const strideLength = mode === "run" ? 1.9 : 1.35;
  const travelled = Math.max(0, Number(timing?.routeDistanceBefore || 0)) + distance * clamp(progress, 0, 1);
  const phase = (travelled / strideLength) * Math.PI * 2;
  return proceduralLocomotion(pose, mode, phase, 1);
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
      const progress = step / samplesPerSegment;
      samples.push(interpolatePoseFor(renderState, sourceId, start.pose, end.pose, progress, fallback, end, {
        startTime: start.time,
        endTime: end.time,
        currentTime: lerp(start.time, end.time, progress),
      }));
    }
  }
  return samples;
}

function sanitizeCameraPoseFor(renderState, camera) {
  const orientation = cameraOrientationFromLegacy(camera, renderState);
  const sanitized = {
    x: clamp(Number(camera.x ?? renderState.camera.x), 0.02, 0.98),
    y: clamp(Number(camera.y ?? renderState.camera.y), 0.02, 0.98),
    height: clamp(Number(camera.height ?? renderState.camera.height ?? 1.6), 0.4, 35),
    panDeg: normalizePanDeg(Number.isFinite(Number(camera.panDeg)) ? camera.panDeg : orientation.panDeg),
    tiltDeg: clamp(Number.isFinite(Number(camera.tiltDeg)) ? Number(camera.tiltDeg) : orientation.tiltDeg, -90, 90),
    focal: clamp(Number(camera.focal ?? renderState.camera.focal), 14, 135),
    focusDistanceM: clamp(
      finiteNumber(camera.focusDistanceM, renderState.camera.focusDistanceM ?? 5),
      CAMERA_FOCUS_DISTANCE_MIN,
      CAMERA_FOCUS_DISTANCE_MAX,
    ),
    trackingTargetId: sanitizeTrackingTargetId(camera.trackingTargetId ?? renderState.camera.trackingTargetId, renderState),
    locks: sanitizeCameraLocks(renderState.camera.locks),
  };
  return syncCameraDerivedAim(sanitized, renderState);
}

async function exportProductionPack() {
  if (!beginMediaExport()) return;
  try {
    syncPlayheadFromTimeInput();
    notifyApp("촬영 자료 프리뷰를 준비하고 있습니다.");
    const pack = await buildProductionPack();
    const zip = await createZip(pack.files);
    presentExport(zip, `${slug(project?.title || state.sceneTitle)}_production_pack.zip`, "촬영 자료 ZIP", buildProductionPackPreview(pack));
  } catch (error) {
    console.error("production pack export failed", error);
    presentExportError("촬영 자료를 준비하지 못했습니다. 3D 프리뷰가 정상적으로 보이는지 확인한 뒤 다시 시도하세요.");
  } finally {
    mediaExportProgress = "";
    endMediaExport();
  }
}

async function buildProductionPack() {
  syncActiveCutDocument(false);
  syncActiveCameraProfile();
  const quality = computePrevisQuality();
  const topdown = await renderTopdownPngBlob();
  const cameraFrame = await captureCameraFrameBlob(state);
  const storyboard = await captureStoryboardFrames();
  const storyboardContactSheet = await renderStoryboardContactSheet(storyboard);
  const manifest = buildPrevisManifest(quality, storyboard);
  const files = [
    { path: "manifest.json", content: JSON.stringify(manifest, null, 2) },
    { path: "project/frisframe.json", content: JSON.stringify({ app: SERVICE_NAME, state }, null, 2) },
    { path: "project/storyboard_project.json", content: JSON.stringify({ app: SERVICE_NAME, schemaVersion: PROJECT_SCHEMA_VERSION, project }, null, 2) },
    { path: "project/cut_list.csv", content: buildProjectCutListCsv() },
    { path: "project/camera_plan.json", content: JSON.stringify(buildCameraPlan(), null, 2) },
    { path: "project/multi_camera_plan.json", content: JSON.stringify(buildMultiCameraPlan(), null, 2) },
    { path: "project/motion_keyframes.csv", content: buildMotionCsv() },
    { path: "project/framing_analysis.json", content: JSON.stringify(quality.framing, null, 2) },
    { path: "docs/shot_bible.md", content: buildShotBibleMarkdown(quality) },
    { path: "docs/live_action_brief.md", content: buildLiveActionBrief(quality) },
    { path: "docs/ai_generation_brief.md", content: buildAiGenerationBrief(quality) },
    { path: "docs/on_set_checklist.md", content: buildOnSetChecklist(quality) },
    { path: "docs/framing_analysis.md", content: buildFramingAnalysisMarkdown(quality.framing) },
    { path: "docs/camera_storyboard.md", content: buildCameraStoryboardMarkdown(storyboard) },
    { path: "docs/continuity_report.md", content: buildContinuityReportMarkdown() },
    { path: "docs/seedance_prompt.md", content: buildSeedancePrompt() },
    { path: "docs/quality_report.json", content: JSON.stringify(quality, null, 2) },
    { path: "blender/blender_previs_scene.py", content: buildBlenderPrevisScript() },
    { path: "media/topdown_blocking.png", blob: topdown },
    { path: "media/camera_frame_current.png", blob: cameraFrame },
    { path: "storyboard/contact_sheet.png", blob: storyboardContactSheet },
    ...storyboard.map((frame) => ({ path: frame.path, blob: frame.blob })),
  ];
  return {
    manifest,
    files,
    previews: {
      topdown,
      cameraFrame,
      storyboardContactSheet,
    },
  };
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
    cameraCount: cameraProfileCount(state),
    cameraNames: multiCameraCore.normalizeProfiles(
      state.cameras,
      state.camera,
      state.motion.keyframes.filter((keyframe) => keyframe.source === "camera"),
      state.cameraSetup,
    ).slice(0, 4).map((profile) => profile.name),
    quality: {
      score: quality.score,
      readiness: quality.readiness,
      framingReviewCount: quality.framing.reviewCount,
    },
    exports: ["Project cut list", "Continuity report", "Blender previs", "Top-down blocking", "Camera storyboard", "Multi-camera plan"],
    storyboardFrames: storyboard.map((frame) => ({
      time: frame.time,
      path: frame.path,
      label: frame.label,
    })),
    files: [
      "project/frisframe.json",
      "project/storyboard_project.json",
      "project/cut_list.csv",
      "project/camera_plan.json",
      "project/multi_camera_plan.json",
      "project/motion_keyframes.csv",
      "project/framing_analysis.json",
      "docs/shot_bible.md",
      "docs/live_action_brief.md",
      "docs/ai_generation_brief.md",
      "docs/on_set_checklist.md",
      "docs/framing_analysis.md",
      "docs/camera_storyboard.md",
      "docs/continuity_report.md",
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

function buildProductionPackPreview(pack) {
  const cuts = project?.scenes?.flatMap((scene) => scene.cuts || []) || [];
  const unresolved = cuts.flatMap((cut) => cutIssueFindings(cut).filter((finding) => !finding.overridden));
  const warnings = unresolved.length
    ? [`미해결 확인 항목 ${unresolved.length}개가 보고서에 포함됩니다.`]
    : ["미해결 확인 항목이 없습니다."];
  return {
    type: "images",
    summary: [
      `프로젝트: ${project?.title || state.sceneTitle || "제목 없음"}`,
      `현재 컷: ${storyboardCutCode(currentScene(), currentCut())}`,
      `준비 상태: ${pack.manifest.quality.score}/100 · ${pack.manifest.quality.readiness}`,
      `파일 수: ${pack.files.length}`,
      "",
      "포함 내용",
      "- 전체 프로젝트 컷 리스트 CSV",
      "- 연속성 및 검토 보고서",
      `- ${pack.manifest.cameraCount}대 카메라별 설정·키프레임 데이터`,
      "- Blender 프리비즈 스크립트",
      "- 2D 동선도와 3D 카메라 프레임",
      "- 카메라 스토리보드와 촬영 체크리스트",
    ].join("\n"),
    items: [
      { blob: pack.previews.topdown, caption: "현재 컷 2D 동선도" },
      { blob: pack.previews.cameraFrame, caption: "현재 재생 위치 카메라 프레임" },
      { blob: pack.previews.storyboardContactSheet, caption: "카메라 키·시작·끝 스토리보드" },
    ],
    notes: [
      ...warnings,
      "프리비즈 MP4는 용량과 제작 시간을 줄이기 위해 별도의 ‘프리비즈 영상’에서 확인하고 저장합니다.",
      "이 창을 닫으면 아무 파일도 저장되지 않습니다.",
    ],
  };
}

function buildProjectCutListCsv() {
  const rows = [[
    "scene", "cut", "title", "status", "shot_type", "focal_mm", "sensor_format", "sensor_width_mm",
    "aperture_f", "focus_distance_m", "duration_seconds", "fps", "key_count", "action", "dialogue",
    "camera_count", "camera_names", "continuity_notes", "unresolved_issue_count",
  ]];
  (project?.scenes || []).forEach((scene) => {
    (scene.cuts || []).forEach((cut) => {
      const blocking = cut.blocking || {};
      const setup = sanitizeCameraSetup(blocking.cameraSetup);
      const camera = blocking.camera || {};
      const cameraProfiles = multiCameraCore.normalizeProfiles(
        blocking.cameras,
        blocking.camera,
        blocking.motion?.keyframes?.filter((keyframe) => keyframe.source === "camera"),
        blocking.cameraSetup,
      ).slice(0, 4);
      rows.push([
        `S${String(scene.number || 1).padStart(2, "0")}`,
        `C${String(cut.number || 1).padStart(2, "0")}`,
        cut.title,
        storyboardStatusLabels[cut.status] || cut.status,
        cut.shotType,
        camera.focal || "",
        setup.sensorFormat,
        setup.sensorWidthMm,
        setup.apertureFStop,
        round(finiteNumber(camera.focusDistanceM, 5), 2),
        blocking.motion?.duration || 0,
        blocking.motion?.fps || 24,
        blocking.motion?.keyframes?.length || 0,
        cameraProfiles.length,
        cameraProfiles.map((profile) => profile.name).join(" | "),
        cut.action,
        cut.dialogue,
        cut.notes,
        cutIssueFindings(cut).filter((finding) => !finding.overridden).length,
      ]);
    });
  });
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

function buildContinuityReportMarkdown() {
  const lines = [
    `# 연속성·검토 보고서 · ${project?.title || state.sceneTitle || "제목 없음"}`,
    "",
    `생성 시각: ${new Date().toLocaleString("ko-KR")}`,
    "",
  ];
  let findingCount = 0;
  (project?.scenes || []).forEach((scene) => {
    lines.push(`## S${String(scene.number || 1).padStart(2, "0")} · ${scene.heading || "장면"}`, "");
    (scene.cuts || []).forEach((cut) => {
      const findings = cutIssueFindings(cut);
      const active = findings.filter((finding) => !finding.overridden);
      findingCount += active.length;
      lines.push(`### ${storyboardCutCode(scene, cut)} · ${cut.title || "새 컷"}`);
      lines.push(`- 상태: ${storyboardStatusLabels[cut.status] || cut.status}`);
      lines.push(`- 미해결 항목: ${active.length}`);
      if (!findings.length) lines.push("- 확인된 문제가 없습니다.");
      findings.forEach((finding) => {
        const overrideNote = finding.overridden ? ` · 의도된 변경: ${finding.override?.note || "사유 없음"}` : "";
        lines.push(`- [${finding.overridden ? "예외" : "확인"}] ${finding.message}${overrideNote}`);
      });
      lines.push("");
    });
  });
  if (!findingCount) lines.splice(3, 0, "현재 미해결 항목이 없습니다.", "");
  return lines.join("\n");
}

function buildCameraPlan() {
  const cam = state.camera;
  const setup = sanitizeCameraSetup(state.cameraSetup);
  const multiCamera = buildMultiCameraPlan();
  return {
    activeCameraId: multiCamera.activeCameraId,
    cameraCount: multiCamera.cameraCount,
    cameras: multiCamera.cameras,
    lensMm: cam.focal,
    sensorFormat: setup.sensorFormat,
    sensorWidthMm: setup.sensorWidthMm,
    apertureFStop: setup.apertureFStop,
    focusDistanceM: round(cam.focusDistanceM, 2),
    horizontalFovDeg: Math.round(focalToFov(cam.focal, setup.sensorWidthMm)),
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

function buildMultiCameraPlan(renderState = state) {
  const profiles = multiCameraCore.normalizeProfiles(
    renderState.cameras,
    renderState.camera,
    renderState.motion?.keyframes?.filter((keyframe) => keyframe.source === "camera"),
    renderState.cameraSetup,
  ).slice(0, 4);
  const activeId = multiCameraCore.resolveActiveId(renderState.activeCameraId, profiles);
  return {
    activeCameraId: activeId,
    cameraCount: profiles.length,
    cameras: profiles.map((profile) => {
      const profileState = cameraDocumentForProfile(clone(renderState), profile.id);
      const camera = sanitizeCameraPoseFor(profileState, profileState.camera);
      const setup = sanitizeCameraSetup(profileState.cameraSetup);
      return {
        id: profile.id,
        name: profile.name,
        color: profile.color,
        lensMm: camera.focal,
        sensorFormat: setup.sensorFormat,
        sensorWidthMm: setup.sensorWidthMm,
        apertureFStop: setup.apertureFStop,
        focusDistanceM: round(camera.focusDistanceM, 2),
        horizontalFovDeg: Math.round(focalToFov(camera.focal, setup.sensorWidthMm)),
        position: { x: round(camera.x), y: round(camera.y), heightM: round(camera.height, 2) },
        orientation: { panDeg: round(camera.panDeg, 1), tiltDeg: round(camera.tiltDeg, 1) },
        trackingTargetId: camera.trackingTargetId || null,
        keyframes: keysForSource("camera", profileState.motion.keyframes).map((keyframe) => ({
          id: keyframe.id,
          time: keyframe.time,
          transition: normalizeTransition(keyframe.transition),
          pose: sanitizeCameraPoseFor(profileState, keyframe.pose),
        })),
      };
    }),
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
  const setup = sanitizeCameraSetup(state.cameraSetup);
  return [
    `- Lens: ${cam.focal}mm on ${cameraSensorFormats[setup.sensorFormat]?.label || "custom"} ${setup.sensorWidthMm}mm / ${Math.round(focalToFov(cam.focal, setup.sensorWidthMm))}° horizontal FOV.`,
    `- Exposure metadata: f/${setup.apertureFStop}; focus distance ${round(cam.focusDistanceM, 2)}m.`,
    "- FrisFrame previews sensor-aware framing without depth-of-field blur; Blender output carries the optical metadata.",
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
  const rows = [["time", "transition", "source", "type", "x", "y", "height", "pan_deg", "tilt_deg", "focal", "sensor_format", "sensor_width_mm", "aperture_f", "focus_distance_m", "facing", "size", "name", "asset_type", "scale_x", "scale_y", "scale_z", "mount_id", "seat_index", "vertical_offset", "pitch_deg", "locomotion_mode", "camera_id"]];
  const profiles = multiCameraCore.normalizeProfiles(
    state.cameras,
    state.camera,
    state.motion.keyframes.filter((keyframe) => keyframe.source === "camera"),
    state.cameraSetup,
  ).slice(0, 4);
  const cameraEntries = profiles.flatMap((profile) => profile.keyframes.map((keyframe) => ({ keyframe, profile })));
  const entries = [
    ...state.motion.keyframes
      .filter((keyframe) => keyframe.source !== "camera")
      .map((keyframe) => ({ keyframe, profile: null })),
    ...cameraEntries,
  ].sort((a, b) => Number(a.keyframe.time || 0) - Number(b.keyframe.time || 0));
  entries.forEach(({ keyframe, profile }) => {
    if (keyframe.source === "camera") {
      const profileState = profile ? cameraDocumentForProfile(clone(state), profile.id) : state;
      const camera = sanitizeCameraPoseFor(profileState, keyframe.pose);
      const setup = sanitizeCameraSetup(profileState.cameraSetup);
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
        setup.sensorFormat,
        setup.sensorWidthMm,
        setup.apertureFStop,
        camera.focusDistanceM,
        "",
        "",
        "Camera",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        profile?.id || activeCameraProfile(state)?.id || "camera-1",
      ]);
      return;
    }
    const item = sanitizeSourcePose(keyframe.source, keyframe.pose);
    rows.push([keyframe.time, normalizeTransition(keyframe.transition), sourceLabel(keyframe.source), item.type, item.x, item.y, "", "", "", "", "", "", "", "", item.facing, item.size, item.name, item.assetType, item.scaleX, item.scaleY, item.scaleZ, item.mountId, item.seatIndex, item.verticalOffset, item.pitch, item.type === "actor" ? item.locomotionMode : "", ""]);
  });
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

function buildBlenderPrevisScript() {
  const size = stageWorldSize(state);
  const setup = sanitizeCameraSetup(state.cameraSetup);
  const renderAspect = aspectMap[state.aspect] || 16 / 9;
  const renderWidth = renderAspect >= 1 ? 1920 : Math.round(1920 * renderAspect);
  const renderHeight = renderAspect >= 1 ? Math.round(1920 / renderAspect) : 1920;
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
    `scene.render.resolution_x = ${renderWidth}`,
    `scene.render.resolution_y = ${renderHeight}`,
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
      const actorZ = Number(item.verticalOffset || 0) + Number(item.mountedHeight || 0) + 0.675 * Number(item.size || 1);
      lines.push(`bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=${round(0.28 * item.size)}, depth=${round(1.35 * item.size)}, location=(${x}, ${y}, ${round(actorZ)}))`);
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
    if (item.type === "actor") lines.push(`obj.rotation_euler[0] = math.radians(${round(item.pitch || 0)})`);
    lines.push(`obj.rotation_euler[2] = math.radians(${round(90 - item.facing)})`);
    lines.push(`objects[${pyString(item.id)}] = obj`);
    lines.push("");
  });

  const [camX, camY] = blenderXY(state.camera);
  const [targetX, targetY, targetZ] = blenderCameraTarget(state.camera);
  lines.push(`bpy.ops.object.camera_add(location=(${camX}, ${camY}, ${round(state.camera.height)}))`);
  lines.push("cam = bpy.context.object");
  lines.push("bpy.context.scene.camera = cam");
  lines.push(`cam.data.lens = ${state.camera.focal}`);
  lines.push("cam.data.sensor_fit = 'HORIZONTAL'");
  lines.push(`cam.data.sensor_width = ${setup.sensorWidthMm}`);
  lines.push("cam.data.dof.use_dof = True");
  lines.push(`cam.data.dof.aperture_fstop = ${setup.apertureFStop}`);
  lines.push(`cam.data.dof.focus_distance = ${round(state.camera.focusDistanceM, 3)}`);
  lines.push(`look_at(cam, (${targetX}, ${targetY}, ${targetZ}))`);
  lines.push("");

  const previousBlenderFrames = new Map();
  sortKeyframes(state.motion.keyframes).forEach((keyframe) => {
    const frame = Math.max(1, Math.round(keyframe.time * state.motion.fps) + 1);
    const interpolation = blenderInterpolation(keyframe.transition);
    const previousFrame = previousBlenderFrames.get(keyframe.source);
    if (keyframe.source === "camera") {
      const camera = sanitizeCameraPose(keyframe.pose);
      const [x, y] = blenderXY(camera);
      const [ax, ay, az] = blenderCameraTarget(camera);
      lines.push(`cam.location = (${x}, ${y}, ${round(camera.height)})`);
      lines.push(`look_at(cam, (${ax}, ${ay}, ${az}))`);
      lines.push(`cam.data.lens = ${camera.focal}`);
      lines.push(`cam.data.dof.focus_distance = ${round(camera.focusDistanceM, 3)}`);
      lines.push(`cam.keyframe_insert(data_path='location', frame=${frame})`);
      lines.push(`cam.keyframe_insert(data_path='rotation_euler', frame=${frame})`);
      lines.push(`cam.data.keyframe_insert(data_path='lens', frame=${frame})`);
      lines.push(`cam.data.keyframe_insert(data_path='dof.focus_distance', frame=${frame})`);
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
      if (item.type === "actor") {
        lines.push(`    obj.location.z = ${round(Number(item.verticalOffset || 0) + Number(item.mountedHeight || 0) + 0.675 * Number(item.size || 1))}`);
        lines.push(`    obj.rotation_euler[0] = math.radians(${round(item.pitch || 0)})`);
      }
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
    renderThreeView(renderState, true, { guide: false, multiCamera: false });
    await nextFrame();
    const compCanvas = getCompositedFrameCanvas(renderState) || threeView.frameCanvas;
    blob = await canvasToBlob(compCanvas, "image/png");
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
      renderThreeView(renderState, true, { guide: false, multiCamera: false });
      await nextFrame();
      const safeTime = String(Math.round(time * 10)).padStart(4, "0");
      const path = `storyboard/frame_${String(index + 1).padStart(2, "0")}_${safeTime}.png`;
      const compCanvas = getCompositedFrameCanvas(renderState) || threeView.frameCanvas;
      frames.push({
        time,
        path,
        relativePath: `../${path}`,
        label: `${time.toFixed(1)}s`,
        summary: storyboardFrameSummary(renderState, time),
        blob: await canvasToBlob(compCanvas, "image/png"),
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
    .filter((time, index, list) => index === 0 || !sameTimelineTime(time, list[index - 1], 0.0005))
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
  renderThreeView(renderState, true, { ...size, guide: false, multiCamera: false });
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

async function exportMultiCameraPreview() {
  if (!beginMediaExport()) return;
  syncActiveCutDocument(false);
  syncActiveCameraProfile();
  const exportState = clone(state);
  const time = clamp(Number(displayPlayhead() || 0), 0, exportState.motion.duration);
  const profiles = multiCameraCore.normalizeProfiles(
    exportState.cameras,
    exportState.camera,
    exportState.motion.keyframes.filter((keyframe) => keyframe.source === "camera"),
    exportState.cameraSetup,
  ).slice(0, 4);
  try {
    notifyApp(`${profiles.length}대 멀티캠 프리뷰를 준비하고 있습니다.`);
    const items = [];
    for (const profile of profiles) {
      const profileState = cameraDocumentForProfile(exportState, profile.id);
      const blob = await renderCameraFrameBlobAtTime(time, profileState, exportSize(profileState));
      items.push({ blob, caption: `${profile.name} · ${time.toFixed(1)}초` });
    }
    const sheet = await renderMultiCameraContactSheet(items, exportState, time);
    presentExport(
      sheet,
      `${slug(exportState.sceneTitle)}_multicam_${formatFrameTime(time)}.png`,
      "멀티카메라 프리뷰 PNG",
      {
        type: "images",
        summary: `${profiles.length}대 카메라 · ${time.toFixed(1)}초 · 각 화면의 이미지 복사 가능`,
        items,
        notes: [
          "저장 버튼은 전체 멀티캠 시트를 저장합니다.",
          "개별 카메라 이미지는 각 화면의 이미지 복사 버튼으로 클립보드에 넣을 수 있습니다.",
        ],
      },
    );
  } catch (error) {
    console.error("multi-camera preview failed", error);
    presentExportError(error?.message || "멀티캠 프리뷰를 준비하지 못했습니다.");
  } finally {
    endMediaExport();
  }
}

async function renderMultiCameraContactSheet(items, renderState, time) {
  const columns = items.length <= 1 ? 1 : 2;
  const rows = Math.ceil(items.length / columns);
  const tileWidth = 960;
  const tileHeight = Math.round(tileWidth / (aspectMap[renderState.aspect] || 16 / 9));
  const labelHeight = 58;
  const gap = 24;
  const margin = 44;
  const sheet = document.createElement("canvas");
  sheet.width = margin * 2 + columns * tileWidth + (columns - 1) * gap;
  sheet.height = margin * 2 + rows * (tileHeight + labelHeight) + (rows - 1) * gap;
  const context = sheet.getContext("2d");
  context.fillStyle = "#0b0e12";
  context.fillRect(0, 0, sheet.width, sheet.height);
  context.fillStyle = "#f1f5ef";
  context.font = '800 28px "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
  context.fillText(`${renderState.sceneTitle || "FrisFrame"} · 멀티카메라`, margin, 32);
  context.fillStyle = "#8e9aa1";
  context.font = '600 16px "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
  context.fillText(`${time.toFixed(1)}초 · ${items.length}대`, margin, 58);
  for (let index = 0; index < items.length; index += 1) {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = margin + column * (tileWidth + gap);
    const y = margin + row * (tileHeight + labelHeight + gap) + 24;
    const image = await imageFromBlob(items[index].blob);
    context.drawImage(image, x, y, tileWidth, tileHeight);
    context.strokeStyle = "#3d4e58";
    context.lineWidth = 2;
    context.strokeRect(x, y, tileWidth, tileHeight);
    context.fillStyle = "#c7d6d2";
    context.font = '700 18px "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
    context.fillText(items[index].caption, x, y + tileHeight + 34);
  }
  return canvasToBlob(sheet, "image/png");
}

async function exportSelectedCutFrame() {
  const cut = currentCut();
  const scene = currentScene();
  if (!cut || !scene) return;
  if (!beginMediaExport()) return;
  try {
    syncActiveCutDocument(false);
    const exportState = clone(cut.blocking);
    const time = clamp(Number(cut.thumbnailTime || 0), 0, exportState.motion.duration);
    const profile = activeCameraProfile(exportState);
    const blob = await renderCameraFrameBlobAtTime(time, exportState, exportSize(exportState));
    presentExport(
      blob,
      `${slug(`S${scene.number}_C${cut.number}_${cut.title}`)}_${slug(profile?.name || "camera")}.png`,
      "선택 컷 카메라 프레임 PNG",
      {
        type: "image",
        blob,
        caption: `${storyboardCutCode(scene, cut)} · ${profile?.name || "카메라"} · ${time.toFixed(1)}초`,
        notes: ["이미지 복사 버튼으로 현재 컷 프레임을 클립보드에 넣을 수 있습니다."],
      },
    );
  } catch (error) {
    presentExportError(error?.message || "선택 컷 이미지를 준비하지 못했습니다.");
  } finally {
    endMediaExport();
  }
}

async function exportSelectedCutVideo() {
  const cut = currentCut();
  const scene = currentScene();
  if (!cut || !scene) return;
  syncActiveCutDocument(false);
  const profile = activeCameraProfile(cut.blocking);
  await exportVideoForDocument(clone(cut.blocking), {
    filename: `${slug(`S${scene.number}_C${cut.number}_${cut.title}`)}_${slug(profile?.name || "camera")}_previs.mp4`,
    exportLabel: "선택 컷 프리비즈 H.264 MP4",
    cutLabel: `${storyboardCutCode(scene, cut)} · ${profile?.name || "카메라"}`,
  });
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
  syncActiveCameraProfile();
  return exportVideoForDocument(clone(state));
}

async function exportMultiCameraVideo() {
  syncActiveCutDocument(false);
  syncActiveCameraProfile();
  const exportState = clone(state);
  const profiles = multiCameraCore.normalizeProfiles(
    exportState.cameras,
    exportState.camera,
    exportState.motion.keyframes.filter((keyframe) => keyframe.source === "camera"),
    exportState.cameraSetup,
  ).slice(0, 4);
  if (profiles.length < 2) {
    notifyApp("멀티캠 영상을 만들려면 카메라를 2대 이상 추가하세요.");
    return;
  }
  return exportVideoForDocument(exportState, {
    multiCamera: true,
    cameraCount: profiles.length,
    filename: `${slug(exportState.sceneTitle)}_multicam_previs.mp4`,
    exportLabel: "멀티카메라 프리비즈 H.264 MP4",
    cutLabel: `${profiles.length}대 멀티캠 · 카메라 순서대로 분할 표시`,
  });
}

async function exportVideoForDocument(documentState, options = {}) {
  const exportState = clone(documentState || state);
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
  const size = exportVideoSize(exportState, options);
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
      renderThreeView(renderState, true, { ...size, multiCamera: options.multiCamera === true });
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
    const filename = options.filename || `${slug(exportState.sceneTitle)}_previs_preview.mp4`;
    const label = options.exportLabel || "프리비즈 H.264 MP4";
    presentExport(blob, filename, label, {
      type: "video",
      blob,
      caption: `${options.cutLabel ? `${options.cutLabel} · ` : ""}${exportState.motion.duration.toFixed(1)}초 · ${fps}FPS · ${frameCount}프레임${options.multiCamera ? ` · ${options.cameraCount || cameraProfileCount(exportState)}대` : ""}`,
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

function exportVideoSize(renderState = state, options = {}) {
  const ratio = aspectMap[renderState.aspect] || 16 / 9;
  if (options.multiCamera) {
    const count = Math.max(1, Math.min(4, Number(options.cameraCount || cameraProfileCount(renderState))));
    const layout = cameraPreviewGridLayout(count);
    const tileWidth = ratio >= 1 ? 960 : Math.round(960 * ratio);
    const tileHeight = ratio >= 1 ? Math.round(960 / ratio) : 960;
    return { width: tileWidth * layout.columns, height: tileHeight * layout.rows };
  }
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
    "#productionPackBtn": "촬영 자료 ZIP",
    "#productionPackPanelBtn": "촬영 자료",
    "#multiCamPreviewBtn": "멀티캠 프리뷰",
    "#multiCamPreviewPanelBtn": "멀티캠 보기",
    "#multiCamPreviewPanelBtnSecondary": "멀티캠",
    "#multiCamVideoBtn": "멀티캠 영상",
    "#multiCamVideoPanelBtn": "멀티캠 영상",
    "#selectedCutFrameBtn": "이 컷 이미지",
    "#selectedCutVideoBtn": "이 컷 영상",
    "#videoBtn": "프리비즈 영상",
    "#videoPanelBtn": "프리비즈 영상",
  };
  Object.entries(labels).forEach(([selector, label]) => {
    const button = $(selector);
    if (!button) return;
    button.disabled = mediaExportBusy;
    const isVideoButton = ["#videoBtn", "#videoPanelBtn", "#multiCamVideoBtn", "#multiCamVideoPanelBtn", "#selectedCutVideoBtn"].includes(selector);
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
  const setup = sanitizeCameraSetup(state.cameraSetup);
  const fov = Math.round(focalToFov(cam.focal, setup.sensorWidthMm));
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
    `Camera: position (${pct(cam.x)}, ${pct(cam.y)}) at ${round(cam.height, 2)}m height, pan ${round(cam.panDeg, 1)}°, tilt ${round(cam.tiltDeg, 1)}°, ${cam.focal}mm lens on ${setup.sensorWidthMm}mm sensor / ${fov}° horizontal field of view, f/${setup.apertureFStop}, focus ${round(cam.focusDistanceM, 2)}m, facing ${angle}° on the top-down map.`,
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
    return `H ${round(camera.height, 2)}m · camera (${pct(camera.x)}, ${pct(camera.y)}) · pan ${round(camera.panDeg, 1)}° · tilt ${round(camera.tiltDeg, 1)}° · focus ${round(camera.focusDistanceM, 2)}m`;
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

function presentExport(data, filename, label, preview) {
  if (!preview || !["image", "images", "video", "text"].includes(preview.type)) {
    presentExportError("저장 전에 확인할 프리뷰가 없어 내보내기를 중단했습니다.");
    return;
  }
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
  $("#exportSaveStatus").textContent = "자동 저장 안 함";
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

  if (preview.summary) {
    const summary = document.createElement("pre");
    summary.className = "export-preview-text";
    summary.textContent = String(preview.summary);
    section.append(summary);
  }

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

$("#exportDownloadBtn").addEventListener("click", async (event) => {
  // Keep every export behind a genuine user action. Programmatic clicks must never download files.
  if (!event.isTrusted || !pendingExport) return;
  const saveButton = event.currentTarget;
  const status = $("#exportSaveStatus");
  const exportInfo = pendingExport;
  saveButton.disabled = true;
  status.textContent = "저장 위치를 선택하세요";
  try {
    if (typeof window.frisframeDesktop?.saveFile === "function") {
      const result = await window.frisframeDesktop.saveFile({
        filename: exportInfo.filename,
        bytes: new Uint8Array(await exportInfo.blob.arrayBuffer()),
      });
      if (result?.canceled) {
        status.textContent = "저장이 취소되었습니다. 프리뷰는 유지됩니다";
        return;
      }
      if (!result?.ok) throw new Error("Desktop file save failed.");
    } else {
      const link = document.createElement("a");
      link.href = exportInfo.url;
      link.download = exportInfo.filename;
      document.body.append(link);
      link.click();
      link.remove();
    }
    pendingExport = null;
    $("#exportDialog").close();
    if (exportInfo.filename.endsWith("_storyboard_project.json")) {
      notifyApp("프로젝트 JSON 백업을 저장했습니다.");
    }
    revokePendingExportUrls(exportInfo, 2000);
  } catch (error) {
    console.error("export save failed", error);
    status.textContent = "파일을 저장하지 못했습니다. 다시 시도하세요";
  } finally {
    saveButton.disabled = false;
  }
});

$("#exportDialog").addEventListener("close", () => {
  revokePendingExportUrls(pendingExport);
  pendingExport = null;
});

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

let draggedAnnoId = null;
let draggedAnnoStartPos = null;
let dragStartPointer = null;
let selectedAnnoId = null;
const ERASER_RADIUS = 20; // px — Photoshop-style partial erase radius

function findAnnotationAt(clientX, clientY) {
  const currentTab = viewMode === "2d" ? "2d" : "3d";
  const items = state.annotations || [];
  
  let w, h, offsetX = 0, offsetY = 0;
  let rect = null;
  
  if (currentTab === "2d") {
    rect = stageRect;
    const stageCanvasRect = canvas.getBoundingClientRect();
    const clickX = clientX - stageCanvasRect.left;
    const clickY = clientY - stageCanvasRect.top;
    
    for (let i = items.length - 1; i >= 0; i--) {
      const item = items[i];
      if (item.tab !== "2d") continue;
      
      if (item.type === "text" && item.text) {
        const px = rect.x + item.x * rect.w;
        const py = rect.y + item.y * rect.h;
        
        ctx.save();
        ctx.font = "bold 15px sans-serif";
        const textWidth = ctx.measureText(item.text).width;
        ctx.restore();
        
        const textPadding = 8;
        const textHeight = 26;
        
        const x1 = px - textPadding;
        const x2 = px + textWidth + textPadding;
        const y1 = py - 20;
        const y2 = py - 20 + textHeight;
        
        if (clickX >= x1 && clickX <= x2 && clickY >= y1 && clickY <= y2) {
          return item;
        }
      } else if (item.type === "pen" && item.points) {
        for (let pt of item.points) {
          const px = rect.x + pt.x * rect.w;
          const py = rect.y + pt.y * rect.h;
          if (Math.hypot(clickX - px, clickY - py) < 15) {
            return item;
          }
        }
      } else if (item.type === "arrow" && item.start && item.end) {
        const px1 = rect.x + item.start.x * rect.w;
        const py1 = rect.y + item.start.y * rect.h;
        const px2 = rect.x + item.end.x * rect.w;
        const py2 = rect.y + item.end.y * rect.h;
        const midX = (px1 + px2) / 2;
        const midY = (py1 + py2) / 2;
        if (Math.hypot(clickX - px1, clickY - py1) < 15 || 
            Math.hypot(clickX - px2, clickY - py2) < 15 ||
            Math.hypot(clickX - midX, clickY - midY) < 15) {
          return item;
        }
      }
    }
  } else {
    const threeWrap = document.getElementById("threeWrap");
    if (!threeWrap || threeWrap.hidden) return null;
    const wrapRect = threeWrap.getBoundingClientRect();
    const parentRect = threeWrap.parentElement.getBoundingClientRect();
    offsetX = wrapRect.left - parentRect.left;
    offsetY = wrapRect.top - parentRect.top;
    w = wrapRect.width;
    h = wrapRect.height;
    
    const overlay = document.getElementById("annotationOverlay");
    const overlayRect = overlay.getBoundingClientRect();
    const clickX = clientX - overlayRect.left;
    const clickY = clientY - overlayRect.top;
    
    for (let i = items.length - 1; i >= 0; i--) {
      const item = items[i];
      if (item.tab !== "3d") continue;
      
      if (item.type === "text" && item.text) {
        const px = offsetX + item.x * w;
        const py = offsetY + item.y * h;
        
        const overlayCtx = overlay.getContext("2d");
        overlayCtx.save();
        overlayCtx.font = "bold 15px sans-serif";
        const textWidth = overlayCtx.measureText(item.text).width;
        overlayCtx.restore();
        
        const textPadding = 8;
        const textHeight = 26;
        
        const x1 = px - textPadding;
        const x2 = px + textWidth + textPadding;
        const y1 = py - 20;
        const y2 = py - 20 + textHeight;
        
        if (clickX >= x1 && clickX <= x2 && clickY >= y1 && clickY <= y2) {
          return item;
        }
      } else if (item.type === "pen" && item.points) {
        for (let pt of item.points) {
          const px = offsetX + pt.x * w;
          const py = offsetY + pt.y * h;
          if (Math.hypot(clickX - px, clickY - py) < 15) {
            return item;
          }
        }
      } else if (item.type === "arrow" && item.start && item.end) {
        const px1 = offsetX + item.start.x * w;
        const py1 = offsetY + item.start.y * h;
        const px2 = offsetX + item.end.x * w;
        const py2 = offsetY + item.end.y * h;
        const midX = (px1 + px2) / 2;
        const midY = (py1 + py2) / 2;
        if (Math.hypot(clickX - px1, clickY - py1) < 15 || 
            Math.hypot(clickX - px2, clickY - py2) < 15 ||
            Math.hypot(clickX - midX, clickY - midY) < 15) {
          return item;
        }
      }
    }
  }
  return null;
}

function selectAnnoTool(tool) {
  const overlay = document.getElementById("annotationOverlay");
  if (!overlay) return;

  const toolButtons = {
    select: document.getElementById("annoToolSelect"),
    pen: document.getElementById("annoToolPen"),
    arrow: document.getElementById("annoToolArrow"),
    text: document.getElementById("annoToolText"),
    eraser: document.getElementById("annoToolEraser")
  };

  // Toggle: clicking the active tool turns it off
  if (currentAnnoTool === tool) {
    currentAnnoTool = "none";
  } else {
    currentAnnoTool = tool;
  }

  Object.keys(toolButtons).forEach(key => {
    if (toolButtons[key]) {
      toolButtons[key].classList.toggle("active", key === currentAnnoTool);
    }
  });

  if (currentAnnoTool !== "none") {
    overlay.classList.add("active");
    if (currentAnnoTool === "eraser") {
      // None custom cursor — we draw the eraser circle on the overlay canvas
      overlay.style.cursor = "none";
    } else if (currentAnnoTool === "select") {
      overlay.style.cursor = "default";
    } else {
      overlay.style.cursor = "crosshair";
    }
  } else {
    overlay.classList.remove("active");
    overlay.style.cursor = "default";
    // Clear drag state when fully deactivating
    draggedAnnoId = null;
    draggedAnnoStartPos = null;
    dragStartPointer = null;
  }
  // NOTE: selectedAnnoId is intentionally NOT cleared here so
  // delete-selected still works after switching away from select tool.

  drawAnnotations();
}

/**
 * Photoshop-style eraser applied at (clientX, clientY).
 *  - Pen strokes: removes points within ERASER_RADIUS px; splits into sub-strokes.
 *  - Arrows: removes if the eraser circle overlaps the line.
 *  - Text: removes if the eraser center is inside the bounding box.
 * Returns true when any annotation changed.
 */
function applyEraserAt(clientX, clientY) {
  const currentTab = viewMode === "2d" ? "2d" : "3d";
  const r = ERASER_RADIUS;
  let changed = false;

  // Coordinate helpers -------------------------------------------------------
  function screenToCanvas(item) {
    // Returns screen-space pixel coords for a normalised annotation coordinate.
    // Returns {x, y} in overlay-canvas CSS-pixel space.
    if (currentTab === "2d") {
      const stageCanvasRect = canvas.getBoundingClientRect();
      const overlayRect = document.getElementById("annotationOverlay").getBoundingClientRect();
      const ox = stageCanvasRect.left - overlayRect.left;
      const oy = stageCanvasRect.top - overlayRect.top;
      return {
        x: ox + stageRect.x + item.x * stageRect.w,
        y: oy + stageRect.y + item.y * stageRect.h
      };
    } else {
      const threeWrap = document.getElementById("threeWrap");
      if (!threeWrap) return { x: 0, y: 0 };
      const wr = threeWrap.getBoundingClientRect();
      const pr = threeWrap.parentElement.getBoundingClientRect();
      return {
        x: (wr.left - pr.left) + item.x * wr.width,
        y: (wr.top - pr.top) + item.y * wr.height
      };
    }
  }

  function ptScreenPos(pt) { return screenToCanvas(pt); }

  function lineSegDistSq(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return (px - ax) ** 2 + (py - ay) ** 2;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
    return (px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2;
  }

  // Eraser screen position (CSS-pixel relative to overlay)
  const overlayEl = document.getElementById("annotationOverlay");
  const overlayRect = overlayEl ? overlayEl.getBoundingClientRect() : { left: 0, top: 0 };
  const ex = clientX - overlayRect.left;
  const ey = clientY - overlayRect.top;

  const surviving = [];

  for (const anno of state.annotations) {
    if (anno.tab !== currentTab) {
      surviving.push(anno);
      continue;
    }

    if (anno.type === "pen" && anno.points && anno.points.length > 0) {
      // Filter out points within radius
      const kept = anno.points.map(pt => {
        const s = ptScreenPos(pt);
        return Math.hypot(ex - s.x, ey - s.y) > r;
      });

      // Split into continuous sub-strokes
      const segments = [];
      let seg = null;
      for (let i = 0; i < anno.points.length; i++) {
        if (kept[i]) {
          if (!seg) seg = [];
          seg.push(anno.points[i]);
        } else {
          if (seg && seg.length >= 2) segments.push(seg);
          seg = null;
        }
      }
      if (seg && seg.length >= 2) segments.push(seg);

      if (segments.length === 0) {
        // Entire stroke erased
        if (selectedAnnoId === anno.id) selectedAnnoId = null;
        changed = true;
      } else if (segments.length === 1 && segments[0].length === anno.points.length) {
        // Unchanged
        surviving.push(anno);
      } else {
        // Replaced by sub-strokes
        changed = true;
        if (selectedAnnoId === anno.id) selectedAnnoId = null;
        for (const s of segments) {
          surviving.push({ id: uid(), type: "pen", tab: anno.tab, color: anno.color, points: s });
        }
      }

    } else if (anno.type === "arrow" && anno.start && anno.end) {
      const s1 = screenToCanvas(anno.start);
      const s2 = screenToCanvas(anno.end);
      const distSq = lineSegDistSq(ex, ey, s1.x, s1.y, s2.x, s2.y);
      if (distSq <= r * r) {
        if (selectedAnnoId === anno.id) selectedAnnoId = null;
        changed = true;
      } else {
        surviving.push(anno);
      }

    } else if (anno.type === "text" && anno.text) {
      // Use the text bounding box (same calc as drawing)
      const sp = screenToCanvas({ x: anno.x, y: anno.y });
      const overlayCtxTemp = overlayEl ? overlayEl.getContext("2d") : null;
      let tw = 80;
      if (overlayCtxTemp) {
        overlayCtxTemp.save();
        overlayCtxTemp.font = "bold 15px sans-serif";
        tw = overlayCtxTemp.measureText(anno.text).width;
        overlayCtxTemp.restore();
      }
      const pad = 8, th = 26;
      const x1 = sp.x - pad - r * 0.5, y1 = sp.y - 20 - r * 0.5;
      const x2 = sp.x + tw + pad + r * 0.5, y2 = sp.y - 20 + th + r * 0.5;
      if (ex >= x1 && ex <= x2 && ey >= y1 && ey <= y2) {
        if (selectedAnnoId === anno.id) selectedAnnoId = null;
        changed = true;
      } else {
        surviving.push(anno);
      }

    } else {
      surviving.push(anno);
    }
  }

  if (changed) {
    state.annotations = surviving;
  }
  return changed;
}

/** Draws the eraser circle preview on the annotation overlay at the given client position */
function drawEraserCursor(clientX, clientY) {
  const overlayEl = document.getElementById("annotationOverlay");
  if (!overlayEl) return;
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const overlayRect = overlayEl.getBoundingClientRect();
  const ex = clientX - overlayRect.left;
  const ey = clientY - overlayRect.top;
  const ctxAnno = overlayEl.getContext("2d");
  // Draw eraser preview circle on top of existing annotation canvas content
  ctxAnno.save();
  ctxAnno.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctxAnno.beginPath();
  ctxAnno.arc(ex, ey, ERASER_RADIUS, 0, Math.PI * 2);
  ctxAnno.strokeStyle = "rgba(255,255,255,0.8)";
  ctxAnno.lineWidth = 1.5;
  ctxAnno.setLineDash([3, 3]);
  ctxAnno.stroke();
  ctxAnno.beginPath();
  ctxAnno.arc(ex, ey, 2, 0, Math.PI * 2);
  ctxAnno.fillStyle = "rgba(255,100,100,0.9)";
  ctxAnno.fill();
  ctxAnno.restore();
}

function onAnnoPointerDown(e) {
  if (currentAnnoTool === "none") return;
  const overlay = document.getElementById("annotationOverlay");
  if (!overlay) return;
  try {
    overlay.setPointerCapture(e.pointerId);
  } catch (err) {}

  if (activeSourceId() !== "all" && sourceEditLocked(activeSourceId())) {
    notifyApp("편집이 잠긴 대상 상태에서는 주석을 편집할 수 없습니다.");
    return;
  }

  if (currentAnnoTool === "select") {
    const item = findAnnotationAt(e.clientX, e.clientY);
    if (item) {
      draggedAnnoId = item.id;
      selectedAnnoId = item.id;
      if (item.size && typeof window.updateAnnoSizeUI === "function") {
        window.updateAnnoSizeUI(item.size);
      }
      dragStartPointer = { x: e.clientX, y: e.clientY };
      if (item.type === "text") {
        draggedAnnoStartPos = { x: item.x, y: item.y };
      } else if (item.type === "arrow") {
        draggedAnnoStartPos = {
          start: { x: item.start.x, y: item.start.y },
          end: { x: item.end.x, y: item.end.y }
        };
      } else if (item.type === "pen") {
        draggedAnnoStartPos = item.points.map(pt => ({ x: pt.x, y: pt.y }));
      }
    } else {
      selectedAnnoId = null;
    }
    drawAnnotations();
    draw();
    return;
  }

  if (currentAnnoTool === "eraser") {
    isAnnoDrawing = true;
    if (applyEraserAt(e.clientX, e.clientY)) {
      commit();
      drawAnnotations();
      drawEraserCursor(e.clientX, e.clientY);
      draw();
    } else {
      drawAnnotations();
      drawEraserCursor(e.clientX, e.clientY);
    }
    return;
  }

  isAnnoDrawing = true;

  const canvasWrap = document.querySelector(".canvas-wrap");
  const wrapRect = canvasWrap.getBoundingClientRect();
  const clickX = e.clientX - wrapRect.left;
  const clickY = e.clientY - wrapRect.top;

  annoStartPoint = { x: clickX, y: clickY, clientX: e.clientX, clientY: e.clientY };

  if (currentAnnoTool === "pen") {
    annoPoints = [{ x: clickX, y: clickY, clientX: e.clientX, clientY: e.clientY }];
  } else if (currentAnnoTool === "text") {
    // Create inline text input immediately at the click position (no dialog)
    const currentTab = viewMode === "2d" ? "2d" : "3d";
    const existingInput = document.querySelector(".annotation-text-input");
    if (existingInput) existingInput.blur(); // Commit any pending text first

    const input = document.createElement("input");
    input.type = "text";
    input.className = "annotation-text-input";
    input.style.left = `${clickX - 8}px`;
    input.style.top = `${clickY - 16}px`;
    const fSize = (currentAnnoSize || 3) * 5;
    input.style.fontSize = `${fSize}px`;
    input.style.lineHeight = `${fSize + 4}px`;
    input.style.height = `${fSize + 12}px`;
    input.style.width = `${Math.max(160, fSize * 10)}px`;
    input.placeholder = "텍스트 입력 후 Enter...";
    canvasWrap.appendChild(input);

    // Normalise click position now (before state changes)
    function normalizeTextCoord(cx, cy) {
      if (currentTab === "2d") {
        const stageCanvasRect = canvas.getBoundingClientRect();
        const canvasX = cx - stageCanvasRect.left;
        const canvasY = cy - stageCanvasRect.top;
        return fromCanvas({ x: canvasX, y: canvasY });
      } else {
        const threeCanvasRect = document.getElementById("threeCanvas").getBoundingClientRect();
        return {
          x: clamp((cx - threeCanvasRect.left) / threeCanvasRect.width, 0, 1),
          y: clamp((cy - threeCanvasRect.top) / threeCanvasRect.height, 0, 1)
        };
      }
    }
    const mappedPos = normalizeTextCoord(e.clientX, e.clientY);

    let handled = false;
    function finalizeText() {
      if (handled) return;
      handled = true;
      const val = input.value.trim();
      if (val) {
        state.annotations.push({
          id: uid(), type: "text", tab: currentTab,
          color: currentAnnoColor,
          size: currentAnnoSize,
          x: mappedPos.x, y: mappedPos.y,
          text: val
        });
        commit();
      }
      input.remove();
      drawAnnotations();
    }

    input.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") { ev.preventDefault(); finalizeText(); }
      else if (ev.key === "Escape") { handled = true; input.remove(); drawAnnotations(); }
      ev.stopPropagation();
    });
    input.addEventListener("blur", () => setTimeout(finalizeText, 80));

    // Delay focus slightly so the pointerdown doesn't immediately blur it
    requestAnimationFrame(() => input.focus());
    isAnnoDrawing = false;
  }
}

function onAnnoPointerMove(e) {
  const overlay = document.getElementById("annotationOverlay");
  if (!overlay) return;

  if (currentAnnoTool === "eraser") {
    // Always show the eraser circle cursor (even when not drawing)
    drawAnnotations();
    drawEraserCursor(e.clientX, e.clientY);
    if (isAnnoDrawing) {
      if (applyEraserAt(e.clientX, e.clientY)) {
        commit();
        drawAnnotations();
        drawEraserCursor(e.clientX, e.clientY);
        draw();
      }
    }
    return;
  }

  if (currentAnnoTool === "select") {
    if (draggedAnnoId) {
      const item = state.annotations.find(anno => anno.id === draggedAnnoId);
      if (item) {
        const dxRaw = e.clientX - dragStartPointer.x;
        const dyRaw = e.clientY - dragStartPointer.y;
        
        const currentTab = viewMode === "2d" ? "2d" : "3d";
        let dx = 0, dy = 0;
        
        if (currentTab === "2d") {
          dx = dxRaw / stageRect.w;
          dy = dyRaw / stageRect.h;
        } else {
          const threeWrap = document.getElementById("threeWrap");
          if (threeWrap) {
            const wrapRect = threeWrap.getBoundingClientRect();
            dx = dxRaw / wrapRect.width;
            dy = dyRaw / wrapRect.height;
          }
        }
        
        if (item.type === "text") {
          item.x = draggedAnnoStartPos.x + dx;
          item.y = draggedAnnoStartPos.y + dy;
        } else if (item.type === "arrow") {
          item.start.x = draggedAnnoStartPos.start.x + dx;
          item.start.y = draggedAnnoStartPos.start.y + dy;
          item.end.x = draggedAnnoStartPos.end.x + dx;
          item.end.y = draggedAnnoStartPos.end.y + dy;
        } else if (item.type === "pen") {
          item.points.forEach((pt, idx) => {
            pt.x = draggedAnnoStartPos[idx].x + dx;
            pt.y = draggedAnnoStartPos[idx].y + dy;
          });
        }
        
        if (currentTab === "2d") {
          draw();
        } else {
          drawAnnotations();
        }
      }
    } else {
      const item = findAnnotationAt(e.clientX, e.clientY);
      if (item) {
        overlay.style.cursor = "move";
      } else {
        overlay.style.cursor = "default";
      }
    }
    return;
  }

  if (!isAnnoDrawing) return;
  const canvasWrap = document.querySelector(".canvas-wrap");
  const wrapRect = canvasWrap.getBoundingClientRect();
  const currentX = e.clientX - wrapRect.left;
  const currentY = e.clientY - wrapRect.top;

  if (currentAnnoTool === "pen") {
    annoPoints.push({ x: currentX, y: currentY, clientX: e.clientX, clientY: e.clientY });
    drawAnnotations({
      type: "pen",
      color: currentAnnoColor,
      size: currentAnnoSize,
      points: annoPoints
    });
  } else if (currentAnnoTool === "arrow") {
    drawAnnotations({
      type: "arrow",
      color: currentAnnoColor,
      size: currentAnnoSize,
      start: annoStartPoint,
      end: { x: currentX, y: currentY }
    });
  }
}

function onAnnoPointerUp(e) {
  if (currentAnnoTool === "select") {
    if (draggedAnnoId) {
      draggedAnnoId = null;
      draggedAnnoStartPos = null;
      dragStartPointer = null;
      commit();
    }
    return;
  }

  if (currentAnnoTool === "eraser") {
    if (isAnnoDrawing) {
      isAnnoDrawing = false;
      const overlay = document.getElementById("annotationOverlay");
      if (overlay) {
        try {
          overlay.releasePointerCapture(e.pointerId);
        } catch (err) {}
      }
    }
    return;
  }

  if (!isAnnoDrawing) return;
  isAnnoDrawing = false;
  const overlay = document.getElementById("annotationOverlay");
  if (!overlay) return;
  try {
    overlay.releasePointerCapture(e.pointerId);
  } catch (err) {}

  const canvasWrap = document.querySelector(".canvas-wrap");
  const wrapRect = canvasWrap.getBoundingClientRect();
  const currentX = e.clientX - wrapRect.left;
  const currentY = e.clientY - wrapRect.top;

  const currentTab = viewMode === "2d" ? "2d" : "3d";

  function normalizeCoord(clientX, clientY) {
    if (currentTab === "2d") {
      const stageCanvasRect = canvas.getBoundingClientRect();
      const canvasX = clientX - stageCanvasRect.left;
      const canvasY = clientY - stageCanvasRect.top;
      return fromCanvas({ x: canvasX, y: canvasY });
    } else {
      const threeCanvasRect = document.getElementById("threeCanvas").getBoundingClientRect();
      return {
        x: clamp((clientX - threeCanvasRect.left) / threeCanvasRect.width, 0, 1),
        y: clamp((clientY - threeCanvasRect.top) / threeCanvasRect.height, 0, 1)
      };
    }
  }

  if (currentAnnoTool === "pen") {
    if (annoPoints.length >= 2) {
      const mappedPoints = annoPoints.map(pt => normalizeCoord(pt.clientX, pt.clientY));
      state.annotations.push({
        id: uid(),
        type: "pen",
        tab: currentTab,
        color: currentAnnoColor,
        size: currentAnnoSize,
        points: mappedPoints
      });
      commit();
    }
    annoPoints = [];
  } else if (currentAnnoTool === "arrow") {
    const startMapped = normalizeCoord(annoStartPoint.clientX, annoStartPoint.clientY);
    const endMapped = normalizeCoord(e.clientX, e.clientY);
    const dist = Math.hypot(e.clientX - annoStartPoint.clientX, e.clientY - annoStartPoint.clientY);
    if (dist > 5) {
      state.annotations.push({
        id: uid(),
        type: "arrow",
        tab: currentTab,
        color: currentAnnoColor,
        size: currentAnnoSize,
        start: startMapped,
        end: endMapped
      });
      commit();
    }
  } else if (currentAnnoTool === "text") {
    // Text input is created in onAnnoPointerDown; nothing to do here.
  }

  drawAnnotations();
}

function onAnnoPointerCancel(e) {
  isAnnoDrawing = false;
  annoPoints = [];
  drawAnnotations();
}

function setupAnnotations() {
  const overlay = document.getElementById("annotationOverlay");
  const toolbar = document.getElementById("annotationToolbar");
  if (!overlay || !toolbar) return;

  resizeAnnotationOverlay();
  window.addEventListener("resize", resizeAnnotationOverlay);

  const toolButtons = {
    select: document.getElementById("annoToolSelect"),
    pen: document.getElementById("annoToolPen"),
    arrow: document.getElementById("annoToolArrow"),
    text: document.getElementById("annoToolText"),
    eraser: document.getElementById("annoToolEraser")
  };

  if (toolButtons.select) toolButtons.select.addEventListener("click", () => selectAnnoTool("select"));
  if (toolButtons.pen) toolButtons.pen.addEventListener("click", () => selectAnnoTool("pen"));
  if (toolButtons.arrow) toolButtons.arrow.addEventListener("click", () => selectAnnoTool("arrow"));
  if (toolButtons.text) toolButtons.text.addEventListener("click", () => selectAnnoTool("text"));
  if (toolButtons.eraser) toolButtons.eraser.addEventListener("click", () => selectAnnoTool("eraser"));

  // Toolbar drag movement logic
  const handle = document.getElementById("annoToolbarHandle");
  if (handle) {
    let isDragging = false;
    let startX, startY;
    let initialLeft, initialTop;

    const onPointerMove = (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      toolbar.style.right = "auto";
      toolbar.style.left = `${initialLeft + dx}px`;
      toolbar.style.top = `${initialTop + dy}px`;
      e.stopPropagation();
    };

    const onPointerUp = (e) => {
      if (!isDragging) return;
      isDragging = false;
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      try {
        handle.releasePointerCapture(e.pointerId);
      } catch (err) {}
      e.stopPropagation();
    };

    handle.addEventListener("pointerdown", (e) => {
      isDragging = true;
      try {
        handle.setPointerCapture(e.pointerId);
      } catch (err) {}
      const rect = toolbar.getBoundingClientRect();
      const wrapRect = toolbar.parentElement.getBoundingClientRect();
      initialLeft = rect.left - wrapRect.left;
      initialTop = rect.top - wrapRect.top;
      startX = e.clientX;
      startY = e.clientY;

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);

      e.stopPropagation();
      e.preventDefault();
    });
  }

  const colorButtons = toolbar.querySelectorAll(".annotation-color-btn");
  colorButtons.forEach(btn => {
    btn.addEventListener("click", (e) => {
      colorButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentAnnoColor = btn.dataset.color;
    });
  });

  const sizeBtn = document.getElementById("annoSizeBtn");
  const sizePopover = document.getElementById("annoSizePopover");
  const sizeSlider = document.getElementById("annoToolSize");
  const sizeBadge = document.getElementById("annoSizeBadge");
  const sizeVal = document.getElementById("annoSizeValue");

  if (sizeBtn && sizePopover) {
    sizeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      sizePopover.classList.toggle("hidden");
    });
    document.addEventListener("click", (e) => {
      if (sizePopover && !sizePopover.contains(e.target) && !sizeBtn.contains(e.target)) {
        sizePopover.classList.add("hidden");
      }
    });
  }

  function updateAnnoSizeUI(val) {
    currentAnnoSize = val;
    if (sizeSlider) sizeSlider.value = val;
    if (sizeBadge) sizeBadge.textContent = val;
    if (sizeVal) sizeVal.textContent = val;
  }
  window.updateAnnoSizeUI = updateAnnoSizeUI;

  if (sizeSlider) {
    sizeSlider.addEventListener("input", (e) => {
      const val = parseInt(e.target.value, 10);
      updateAnnoSizeUI(val);
      if (selectedAnnoId) {
        const item = state.annotations.find(a => a.id === selectedAnnoId);
        if (item) {
          item.size = val;
          commit();
          drawAnnotations();
          draw();
        }
      }
    });
  }

  const undoBtn = document.getElementById("annoUndoBtn");
  if (undoBtn) {
    undoBtn.addEventListener("click", () => {
      if (activeSourceId() !== "all" && sourceEditLocked(activeSourceId())) {
        notifyApp("편집이 잠긴 대상 상태에서는 주석을 수정할 수 없습니다.");
        return;
      }
      const currentTab = viewMode === "2d" ? "2d" : "3d";
      const indices = [];
      state.annotations.forEach((anno, index) => {
        if (anno.tab === currentTab) indices.push(index);
      });
      if (indices.length > 0) {
        const lastIndex = indices[indices.length - 1];
        state.annotations.splice(lastIndex, 1);
        commit();
        notifyApp("마지막 주석을 되돌렸습니다.");
      }
    });
  }

  const clearBtn = document.getElementById("annoClearBtn");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      if (activeSourceId() !== "all" && sourceEditLocked(activeSourceId())) {
        notifyApp("편집이 잠긴 대상 상태에서는 주석을 수정할 수 없습니다.");
        return;
      }
      const currentTab = viewMode === "2d" ? "2d" : "3d";
      const initialCount = state.annotations.length;
      state.annotations = state.annotations.filter(anno => anno.tab !== currentTab);
      if (state.annotations.length !== initialCount) {
        commit();
        notifyApp("현재 화면의 모든 주석을 지웠습니다.");
      }
    });
  }

  const deleteSelectedBtn = document.getElementById("annoDeleteSelectedBtn");
  if (deleteSelectedBtn) {
    deleteSelectedBtn.addEventListener("click", () => {
      if (!selectedAnnoId) {
        notifyApp("선택 도구(S)로 주석을 먼저 선택하세요.");
        return;
      }
      if (activeSourceId() !== "all" && sourceEditLocked(activeSourceId())) {
        notifyApp("편집이 잠긴 대상 상태에서는 주석을 수정할 수 없습니다.");
        return;
      }
      state.annotations = state.annotations.filter(anno => anno.id !== selectedAnnoId);
      selectedAnnoId = null;
      commit();
      notifyApp("선택한 주석을 삭제했습니다.");
      drawAnnotations();
      draw();
    });
  }

  overlay.addEventListener("pointerdown", onAnnoPointerDown);
  overlay.addEventListener("pointermove", onAnnoPointerMove);
  overlay.addEventListener("pointerup", onAnnoPointerUp);
  overlay.addEventListener("pointercancel", onAnnoPointerCancel);
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

function blenderCameraTarget(camera, distanceM = 10) {
  const [x, y] = blenderXY(camera);
  const direction = cameraDirection(camera);
  return [
    round(x + direction.x * distanceM),
    round(y + direction.z * distanceM),
    round(Number(camera.height || 1.6) + direction.y * distanceM),
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

let jogDragH = null;
let jogDragV = null;

function setupThreeJogDial() {
  const dialH = $("#threeJogDialH");
  const dialV = $("#threeJogDialV");

  if (dialH) {
    dialH.addEventListener("pointerdown", (event) => {
      if (!threeView?.ready) return;
      event.stopPropagation();
      dialH.setPointerCapture(event.pointerId);

      const rect = dialH.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const startAngle = Math.atan2(event.clientY - cy, event.clientX - cx);
      const startTheta = threeView.orbit.theta;

      jogDragH = {
        pointerId: event.pointerId,
        cx,
        cy,
        startAngle,
        startTheta,
      };
    });

    dialH.addEventListener("pointermove", (event) => {
      if (!jogDragH || event.pointerId !== jogDragH.pointerId) return;
      event.stopPropagation();

      const angle = Math.atan2(event.clientY - jogDragH.cy, event.clientX - jogDragH.cx);
      const deltaAngle = angle - jogDragH.startAngle;

      // Update theta
      threeView.orbit.theta = jogDragH.startTheta + deltaAngle * 1.25;

      const deg = Math.round(threeView.orbit.theta * (180 / Math.PI));
      const knob = $("#jogDialKnobH");
      if (knob) knob.style.transform = `rotate(${deg}deg)`;

      renderThreeView(threeView.lastState || state, true);
    });

    const endDragH = (event) => {
      if (!jogDragH || event.pointerId !== jogDragH.pointerId) return;
      event.stopPropagation();
      dialH.releasePointerCapture(event.pointerId);
      jogDragH = null;
    };

    dialH.addEventListener("pointerup", endDragH);
    dialH.addEventListener("pointercancel", endDragH);

    dialH.addEventListener("dblclick", (event) => {
      event.stopPropagation();
      if (!threeView?.ready) return;
      threeView.orbit.theta = -0.62;
      const deg = Math.round(threeView.orbit.theta * (180 / Math.PI));
      const knob = $("#jogDialKnobH");
      if (knob) knob.style.transform = `rotate(${deg}deg)`;
      renderThreeView(threeView.lastState || state, true);
    });
  }

  if (dialV) {
    dialV.addEventListener("pointerdown", (event) => {
      if (!threeView?.ready) return;
      event.stopPropagation();
      dialV.setPointerCapture(event.pointerId);

      const rect = dialV.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const startAngle = Math.atan2(event.clientY - cy, event.clientX - cx);
      const startPhi = threeView.orbit.phi;

      jogDragV = {
        pointerId: event.pointerId,
        cx,
        cy,
        startAngle,
        startPhi,
      };
    });

    dialV.addEventListener("pointermove", (event) => {
      if (!jogDragV || event.pointerId !== jogDragV.pointerId) return;
      event.stopPropagation();

      const angle = Math.atan2(event.clientY - jogDragV.cy, event.clientX - jogDragV.cx);
      const deltaAngle = angle - jogDragV.startAngle;

      // Update phi, clamp to avoid inversion
      const newPhi = jogDragV.startPhi + deltaAngle * 1.25;
      threeView.orbit.phi = Math.max(-0.85, Math.min(1.48, newPhi));

      const deg = Math.round(threeView.orbit.phi * (180 / Math.PI));
      const knob = $("#jogDialKnobV");
      if (knob) knob.style.transform = `rotate(${deg}deg)`;

      renderThreeView(threeView.lastState || state, true);
    });

    const endDragV = (event) => {
      if (!jogDragV || event.pointerId !== jogDragV.pointerId) return;
      event.stopPropagation();
      dialV.releasePointerCapture(event.pointerId);
      jogDragV = null;
    };

    dialV.addEventListener("pointerup", endDragV);
    dialV.addEventListener("pointercancel", endDragV);

    dialV.addEventListener("dblclick", (event) => {
      event.stopPropagation();
      if (!threeView?.ready) return;
      threeView.orbit.phi = 0.68;
      const deg = Math.round(threeView.orbit.phi * (180 / Math.PI));
      const knob = $("#jogDialKnobV");
      if (knob) knob.style.transform = `rotate(${deg}deg)`;
      renderThreeView(threeView.lastState || state, true);
    });
  }
}

function setupScrubDragging(element) {
  let isScrubbing = false;

  element.addEventListener("pointerdown", (event) => {
    if (event.button != null && event.button !== 0) return;
    if (event.target.closest(".timeline-marker")) return;

    isScrubbing = true;
    element.setPointerCapture(event.pointerId);

    const handleMove = (clientX) => {
      const rect = element.getBoundingClientRect();
      const percent = clamp((clientX - rect.left) / rect.width, 0, 1);
      let targetTime = percent * state.motion.duration;

      // Snap to closest keyframe within 80ms
      const snapThreshold = 0.08;
      let closestSnap = null;
      let minDiff = snapThreshold;
      state.motion.keyframes.forEach(kf => {
        const diff = Math.abs(kf.time - targetTime);
        if (diff < minDiff) {
          minDiff = diff;
          closestSnap = kf.time;
        }
      });

      if (closestSnap !== null) {
        targetTime = closestSnap;
      }

      scrubToTime(targetTime);
    };

    handleMove(event.clientX);

    const onPointerMove = (e) => {
      if (!isScrubbing) return;
      handleMove(e.clientX);
    };

    const onPointerUp = (e) => {
      if (!isScrubbing) return;
      isScrubbing = false;
      element.releasePointerCapture(e.pointerId);
      element.removeEventListener("pointermove", onPointerMove);
      element.removeEventListener("pointerup", onPointerUp);
      element.removeEventListener("pointercancel", onPointerUp);
    };

    element.addEventListener("pointermove", onPointerMove);
    element.addEventListener("pointerup", onPointerUp);
    element.addEventListener("pointercancel", onPointerUp);
  });
}

// --- Direct Annotations & Screen Pencil Logic ---
let currentAnnoTool = "none";
let currentAnnoColor = "#ff4d4f";
let currentAnnoSize = 3;
let isAnnoDrawing = false;
let annoPoints = [];
let annoStartPoint = null;

function resizeAnnotationOverlay() {
  const overlay = document.getElementById("annotationOverlay");
  const wrap = document.querySelector(".canvas-wrap");
  if (!overlay || !wrap) return;
  const rect = wrap.getBoundingClientRect();
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  overlay.width = Math.floor(rect.width * dpr);
  overlay.height = Math.floor(rect.height * dpr);
  drawAnnotations();
}

function drawArrow(context, fromX, fromY, toX, toY, color, size = 3) {
  context.save();
  context.strokeStyle = color;
  context.fillStyle = color;
  context.lineWidth = size;
  context.lineCap = "round";
  
  context.beginPath();
  context.moveTo(fromX, fromY);
  context.lineTo(toX, toY);
  context.stroke();
  
  const angle = Math.atan2(toY - fromY, toX - fromX);
  const headLen = Math.max(10, size * 5);
  context.beginPath();
  context.moveTo(toX, toY);
  context.lineTo(toX - headLen * Math.cos(angle - Math.PI / 6), toY - headLen * Math.sin(angle - Math.PI / 6));
  context.lineTo(toX - headLen * Math.cos(angle + Math.PI / 6), toY - headLen * Math.sin(angle + Math.PI / 6));
  context.closePath();
  context.fill();
  context.restore();
}

function drawStageAnnotations(renderState, rect) {
  const items = renderState.annotations || [];
  items.forEach((item) => {
    if (item.tab !== "2d") return;
    ctx.save();
    ctx.strokeStyle = item.color;
    ctx.fillStyle = item.color;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    let pxVal, pyVal, textW, textH, textPad;

    if (item.type === "pen" && item.points && item.points.length > 0) {
      ctx.lineWidth = item.size || 3;
      ctx.beginPath();
      const mappedPts = item.points.map(pt => ({ x: rect.x + pt.x * rect.w, y: rect.y + pt.y * rect.h }));
      ctx.moveTo(mappedPts[0].x, mappedPts[0].y);
      for (let i = 1; i < mappedPts.length - 1; i++) {
        const xc = (mappedPts[i].x + mappedPts[i + 1].x) / 2;
        const yc = (mappedPts[i].y + mappedPts[i + 1].y) / 2;
        ctx.quadraticCurveTo(mappedPts[i].x, mappedPts[i].y, xc, yc);
      }
      if (mappedPts.length > 1) {
        ctx.lineTo(mappedPts[mappedPts.length - 1].x, mappedPts[mappedPts.length - 1].y);
      }
      ctx.stroke();

      if (item.id === selectedAnnoId) {
        ctx.restore();
        ctx.save();
        ctx.strokeStyle = "#38bdf8";
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        item.points.forEach((pt) => {
          const px = rect.x + pt.x * rect.w;
          const py = rect.y + pt.y * rect.h;
          if (px < minX) minX = px;
          if (px > maxX) maxX = px;
          if (py < minY) minY = py;
          if (py > maxY) maxY = py;
        });
        roundRect(ctx, minX - 8, minY - 8, maxX - minX + 16, maxY - minY + 16, 4);
        ctx.stroke();
      }
    } else if (item.type === "arrow" && item.start && item.end) {
      const fromX = rect.x + item.start.x * rect.w;
      const fromY = rect.y + item.start.y * rect.h;
      const toX = rect.x + item.end.x * rect.w;
      const toY = rect.y + item.end.y * rect.h;
      drawArrow(ctx, fromX, fromY, toX, toY, item.color, item.size || 3);

      if (item.id === selectedAnnoId) {
        ctx.restore();
        ctx.save();
        ctx.strokeStyle = "#38bdf8";
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        const minX = Math.min(fromX, toX) - 8;
        const minY = Math.min(fromY, toY) - 8;
        const maxX = Math.max(fromX, toX) + 8;
        const maxY = Math.max(fromY, toY) + 8;
        roundRect(ctx, minX, minY, maxX - minX, maxY - minY, 4);
        ctx.stroke();
      }
    } else if (item.type === "text" && item.text) {
      const px = rect.x + item.x * rect.w;
      const py = rect.y + item.y * rect.h;
      const fSize = (item.size || 3) * 5;
      ctx.font = `bold ${fSize}px sans-serif`;
      ctx.textBaseline = "middle";
      
      const textWidth = ctx.measureText(item.text).width;
      const textHeight = fSize + 11;
      const textPadding = Math.max(8, fSize / 2);
      const boxOffset = fSize + 5;
      
      ctx.fillStyle = "rgba(12, 16, 22, 0.95)";
      ctx.strokeStyle = item.color;
      ctx.lineWidth = 2;
      roundRect(ctx, px - textPadding, py - boxOffset, textWidth + textPadding * 2, textHeight, 6);
      ctx.fill();
      ctx.stroke();
      
      ctx.fillStyle = "#ffffff";
      ctx.fillText(item.text, px, py - boxOffset + textHeight / 2);

      if (item.id === selectedAnnoId) {
        ctx.restore();
        ctx.save();
        ctx.strokeStyle = "#38bdf8";
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        roundRect(ctx, px - textPadding - 3, py - boxOffset - 3, textWidth + textPadding * 2 + 6, textHeight + 6, 8);
        ctx.stroke();
      }
    }
    ctx.restore();
  });
}

function draw3DAnnotationsOnContext(ctxTarget, width, height, offsetX = 0, offsetY = 0, targetState = state, showSelection = false) {
  const items = targetState.annotations || [];
  items.forEach((item) => {
    if (item.tab !== "3d") return;
    ctxTarget.save();
    ctxTarget.strokeStyle = item.color;
    ctxTarget.fillStyle = item.color;
    ctxTarget.lineWidth = item.size || 3;
    ctxTarget.lineCap = "round";
    ctxTarget.lineJoin = "round";

    if (item.type === "pen" && item.points && item.points.length > 0) {
      ctxTarget.lineWidth = item.size || 3;
      ctxTarget.beginPath();
      const mappedPts = item.points.map(pt => ({ x: offsetX + pt.x * width, y: offsetY + pt.y * height }));
      ctxTarget.moveTo(mappedPts[0].x, mappedPts[0].y);
      for (let i = 1; i < mappedPts.length - 1; i++) {
        const xc = (mappedPts[i].x + mappedPts[i + 1].x) / 2;
        const yc = (mappedPts[i].y + mappedPts[i + 1].y) / 2;
        ctxTarget.quadraticCurveTo(mappedPts[i].x, mappedPts[i].y, xc, yc);
      }
      if (mappedPts.length > 1) {
        ctxTarget.lineTo(mappedPts[mappedPts.length - 1].x, mappedPts[mappedPts.length - 1].y);
      }
      ctxTarget.stroke();

      if (showSelection && item.id === selectedAnnoId) {
        ctxTarget.restore();
        ctxTarget.save();
        ctxTarget.strokeStyle = "#38bdf8";
        ctxTarget.lineWidth = 2;
        ctxTarget.setLineDash([4, 4]);
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        item.points.forEach((pt) => {
          const px = offsetX + pt.x * width;
          const py = offsetY + pt.y * height;
          if (px < minX) minX = px;
          if (px > maxX) maxX = px;
          if (py < minY) minY = py;
          if (py > maxY) maxY = py;
        });
        roundRect(ctxTarget, minX - 8, minY - 8, maxX - minX + 16, maxY - minY + 16, 4);
        ctxTarget.stroke();
      }
    } else if (item.type === "arrow" && item.start && item.end) {
      const fromX = offsetX + item.start.x * width;
      const fromY = offsetY + item.start.y * height;
      const toX = offsetX + item.end.x * width;
      const toY = offsetY + item.end.y * height;
      drawArrow(ctxTarget, fromX, fromY, toX, toY, item.color, item.size || 3);

      if (showSelection && item.id === selectedAnnoId) {
        ctxTarget.restore();
        ctxTarget.save();
        ctxTarget.strokeStyle = "#38bdf8";
        ctxTarget.lineWidth = 2;
        ctxTarget.setLineDash([4, 4]);
        const minX = Math.min(fromX, toX) - 8;
        const minY = Math.min(fromY, toY) - 8;
        const maxX = Math.max(fromX, toX) + 8;
        const maxY = Math.max(fromY, toY) + 8;
        roundRect(ctxTarget, minX, minY, maxX - minX, maxY - minY, 4);
        ctxTarget.stroke();
      }
    } else if (item.type === "text" && item.text) {
      const px = offsetX + item.x * width;
      const py = offsetY + item.y * height;
      const fSize = (item.size || 3) * 5;
      ctxTarget.font = `bold ${fSize}px sans-serif`;
      ctxTarget.textBaseline = "middle";
      
      const textWidth = ctxTarget.measureText(item.text).width;
      const textHeight = fSize + 11;
      const textPadding = Math.max(8, fSize / 2);
      const boxOffset = fSize + 5;
      
      ctxTarget.fillStyle = "rgba(12, 16, 22, 0.95)";
      ctxTarget.strokeStyle = item.color;
      ctxTarget.lineWidth = 2;
      roundRect(ctxTarget, px - textPadding, py - boxOffset, textWidth + textPadding * 2, textHeight, 6);
      ctxTarget.fill();
      ctxTarget.stroke();
      
      ctxTarget.fillStyle = "#ffffff";
      ctxTarget.fillText(item.text, px, py - boxOffset + textHeight / 2);

      if (showSelection && item.id === selectedAnnoId) {
        ctxTarget.restore();
        ctxTarget.save();
        ctxTarget.strokeStyle = "#38bdf8";
        ctxTarget.lineWidth = 2;
        ctxTarget.setLineDash([4, 4]);
        roundRect(ctxTarget, px - textPadding - 3, py - boxOffset - 3, textWidth + textPadding * 2 + 6, textHeight + 6, 8);
        ctxTarget.stroke();
      }
    }
    ctxTarget.restore();
  });
}

function getCompositedFrameCanvas(targetState = state) {
  if (!threeView?.frameCanvas) return null;
  const src = threeView.frameCanvas;
  const offscreen = document.createElement("canvas");
  offscreen.width = src.width;
  offscreen.height = src.height;
  const ctxOff = offscreen.getContext("2d");
  ctxOff.drawImage(src, 0, 0);
  draw3DAnnotationsOnContext(ctxOff, offscreen.width, offscreen.height, 0, 0, targetState, false);
  return offscreen;
}

function drawAnnotations(tempAnno = null) {
  const overlay = document.getElementById("annotationOverlay");
  if (!overlay) return;
  const ctxAnno = overlay.getContext("2d");
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  ctxAnno.clearRect(0, 0, overlay.width, overlay.height);

  ctxAnno.save();
  ctxAnno.setTransform(dpr, 0, 0, dpr, 0, 0);

  if (viewMode === "3d" && workspaceMode === "blocking") {
    const threeWrap = document.getElementById("threeWrap");
    if (threeWrap && !threeWrap.hidden) {
      const wrapRect = threeWrap.getBoundingClientRect();
      const parentRect = threeWrap.parentElement.getBoundingClientRect();
      const offsetX = wrapRect.left - parentRect.left;
      const offsetY = wrapRect.top - parentRect.top;
      const width = wrapRect.width;
      const height = wrapRect.height;
      draw3DAnnotationsOnContext(ctxAnno, width, height, offsetX, offsetY, state, true);
    }
  }

  if (tempAnno) {
    ctxAnno.save();
    ctxAnno.strokeStyle = tempAnno.color;
    ctxAnno.fillStyle = tempAnno.color;
    ctxAnno.lineWidth = 3;
    ctxAnno.lineCap = "round";
    ctxAnno.lineJoin = "round";

    if (tempAnno.type === "pen" && tempAnno.points && tempAnno.points.length > 0) {
      ctxAnno.lineWidth = currentAnnoSize;
      ctxAnno.beginPath();
      ctxAnno.moveTo(tempAnno.points[0].x, tempAnno.points[0].y);
      for (let i = 1; i < tempAnno.points.length - 1; i++) {
        const xc = (tempAnno.points[i].x + tempAnno.points[i + 1].x) / 2;
        const yc = (tempAnno.points[i].y + tempAnno.points[i + 1].y) / 2;
        ctxAnno.quadraticCurveTo(tempAnno.points[i].x, tempAnno.points[i].y, xc, yc);
      }
      if (tempAnno.points.length > 1) {
        ctxAnno.lineTo(tempAnno.points[tempAnno.points.length - 1].x, tempAnno.points[tempAnno.points.length - 1].y);
      }
      ctxAnno.stroke();
    } else if (tempAnno.type === "arrow" && tempAnno.start && tempAnno.end) {
      drawArrow(ctxAnno, tempAnno.start.x, tempAnno.start.y, tempAnno.end.x, tempAnno.end.y, tempAnno.color, currentAnnoSize);
    }
    ctxAnno.restore();
  }

  ctxAnno.restore();
}

function init() {
  clearLiveSourceEdits();
  populatePropCatalogControls();
  sanitizeState();
  project = createDefaultProject(state);
  activeSceneId = project.scenes[0].id;
  activeCutId = project.scenes[0].cuts[0].id;
  state = project.scenes[0].cuts[0].blocking;
  setupCameraFrameResize();
  setupThreeJogDial();
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
  setupAnnotations();

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
