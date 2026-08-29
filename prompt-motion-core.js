(function initPromptMotionCore(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FrisFramePromptMotionCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createPromptMotionCore() {
  const DEFAULT_TRANSLATION_SPEED = 1.2;
  const FAST_TRANSLATION_SPEED = 3.6;
  const MAX_TRANSLATION_SPEED = 6;
  const POSE_RULES = Object.freeze([
    { preset: "faceDown", label: "엎드리기", pattern: /엎드|엎어진|배를\s*대고/ },
    { preset: "lieDown", label: "눕기", pattern: /눕|누워|드러눕|누운/ },
    { preset: "armsCrossed", label: "팔짱", pattern: /팔짱|팔을\s*꼬/ },
    { preset: "handsBack", label: "뒷짐", pattern: /뒷짐|손을\s*뒤로\s*모/ },
    { preset: "handsPocket", label: "주머니", pattern: /주머니에\s*손|손을\s*주머니/ },
    { preset: "crossLegs", label: "다리꼬기", pattern: /다리\s*꼬/ },
    { preset: "leanSit", label: "기대앉기", pattern: /기대\s*앉|기대어\s*앉/ },
    { preset: "sit", label: "앉기", pattern: /앉아|앉는다|앉은|앉아서|앉기/ },
    { preset: "crouch", label: "웅크리기", pattern: /웅크|쪼그려|무릎을\s*굽혀|낮게\s*몸을/ },
    { preset: "bow", label: "고개숙임", pattern: /고개를?\s*숙|허리를?\s*숙|몸을\s*숙|인사/ },
    { preset: "cheer", label: "환호", pattern: /양팔|두\s*팔|팔을\s*들|팔을\s*올|환호/ },
    { preset: "wave", label: "손 인사", pattern: /손을?\s*흔|손\s*인사/ },
    { preset: "point", label: "가리키기", pattern: /가리키|손가락|손을\s*앞으로\s*뻗/ },
    { preset: "stop", label: "정지 제스처", pattern: /손바닥|멈추라는|멈추라고/ },
    { preset: "clap", label: "박수", pattern: /박수|손뼉/ },
    { preset: "think", label: "생각", pattern: /생각에?\s*잠기|고민|턱을?\s*괴/ },
    { preset: "surprise", label: "놀람", pattern: /놀라|깜짝/ },
    { preset: "sad", label: "슬픔", pattern: /슬퍼|축\s*처|고개를?\s*떨/ },
    { preset: "shrug", label: "어깨으쓱", pattern: /어깨를?\s*으쓱/ },
    { preset: "guard", label: "방어", pattern: /방어\s*자세|막을\s*준비|경계\s*자세/ },
    { preset: "punch", label: "주먹지르기", pattern: /주먹을?\s*(내질|지르)|주먹지르/ },
    { preset: "kick", label: "발차기", pattern: /발차|발을?\s*차/ },
    { preset: "push", label: "밀기", pattern: /밀어|미는\s*자세|앞으로\s*밀/ },
    { preset: "attention", label: "차렷", pattern: /차렷|바르게\s*선/ },
    { preset: "neutral", label: "서기", pattern: /일어나|일어난|일어서|일어선|기립|선다|서\s*있는|서서|팔을?\s*내리|자세를?\s*풀|기본\s*자세/ },
  ]);

  function finiteNumber(value, fallback = 0) {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
    const safeFallback = Number(fallback);
    return Number.isFinite(safeFallback) ? safeFallback : 0;
  }

  function clamp(value, min = 0, max = 1) {
    return Math.max(min, Math.min(max, finiteNumber(value, min)));
  }

  function normalizeText(text) {
    return String(text || "").trim().replace(/\s+/g, " ");
  }

  function findExplicitPose(source) {
    let latest = null;
    POSE_RULES.forEach((rule, order) => {
      const match = source.match(rule.pattern);
      if (!match) return;
      const index = source.lastIndexOf(match[0]);
      if (!latest || index > latest.index || (index === latest.index && order < latest.order)) {
        latest = { ...rule, index, order };
      }
    });
    return latest;
  }

  function analyzePromptMotion(text) {
    const source = normalizeText(text);
    const explicitPose = findExplicitPose(source);
    const jump = /점프|도약|뛰어오르|뛰어올라/.test(source) && !/달리|뛰어가|질주/.test(source);
    const locomotion = /걷|걸어|달리|뛰어가|질주|전진|이동|다가가|다가온/.test(source);
    const run = /달리|뛰어가|질주|전력/.test(source);
    const walk = /걷|걸어/.test(source);
    const accelerate = /점점\s*빠르|점차\s*빠르|가속|걷다가.*달리|느리게.*달리/.test(source);
    const decelerate = /점점\s*느려|점차\s*느려|점점\s*느리|감속|달리다가.*걷|멈춰|멈추/.test(source);
    const backward = /뒤로|후진|뒤쪽/.test(source);
    const left = /왼쪽/.test(source);
    const right = /오른쪽/.test(source);
    const turn = /뒤돌|회전|돌아서|돌아선|한 바퀴/.test(source);
    const float = /떠오|부유|둥둥|공중|하늘로/.test(source);
    const rise = float || /상승|올라가|올라선|떠 있는/.test(source);
    const directionAngle = left ? -90 : right ? 90 : 0;
    const direction = backward ? -1 : 1;
    let speedStart = run ? FAST_TRANSLATION_SPEED : walk || locomotion ? DEFAULT_TRANSLATION_SPEED : 0;
    let speedEnd = run ? FAST_TRANSLATION_SPEED : walk || locomotion ? DEFAULT_TRANSLATION_SPEED : 0;
    if (accelerate && locomotion) {
      speedStart = DEFAULT_TRANSLATION_SPEED;
      speedEnd = FAST_TRANSLATION_SPEED;
    } else if (decelerate && locomotion) {
      speedStart = run ? FAST_TRANSLATION_SPEED : DEFAULT_TRANSLATION_SPEED;
      speedEnd = 0;
    }
    if (/천천히/.test(source)) {
      speedStart *= 0.65;
      speedEnd *= 0.65;
    }
    if (/빠르게|신속하게/.test(source) && !run && !accelerate) {
      speedStart *= 1.45;
      speedEnd *= 1.45;
    }
    speedStart = clamp(speedStart, 0, MAX_TRANSLATION_SPEED);
    speedEnd = clamp(speedEnd, 0, MAX_TRANSLATION_SPEED);

    let turnDegrees = 0;
    if (turn) {
      turnDegrees = /한 바퀴/.test(source) ? 360 : /뒤돌/.test(source) ? 180 : left ? -90 : right ? 90 : 90;
    }

    const matched = Boolean(locomotion || jump || rise || turn || explicitPose);
    const summary = [];
    if (locomotion) {
      const directionLabel = backward ? "뒤로" : left ? "왼쪽으로" : right ? "오른쪽으로" : "앞으로";
      const speedLabel = accelerate ? "속도 가속" : decelerate ? "속도 감속" : "일정 속도 이동";
      summary.push(`${directionLabel} 이동 · ${speedLabel}`);
    }
    if (jump) summary.push("수직 이동");
    if (rise) summary.push(float ? "부유·상승" : "상승");
    if (turn) summary.push(`${turnDegrees}° 방향 전환`);
    if (explicitPose) summary.push(`${explicitPose.label} 포즈`);
    else if (matched) summary.push("포즈 고정");

    return {
      text: source,
      matched,
      locomotion,
      jump,
      rise,
      float,
      direction,
      directionAngle,
      speedStart,
      speedEnd,
      accelerate: accelerate && locomotion,
      decelerate: decelerate && locomotion,
      turnDegrees,
      posePreset: explicitPose?.preset || "",
      poseLabel: explicitPose?.label || "",
      poseMode: explicitPose ? "explicit" : "locked",
      translationOnly: !explicitPose,
      summary: summary.length ? summary.join(" · ") : "해석 가능한 변위 없음",
    };
  }

  function evaluatePromptMotion(text, elapsed, duration, baseFacing = 0) {
    const profile = analyzePromptMotion(text);
    const safeDuration = Math.max(0.001, finiteNumber(duration, 1));
    const localTime = clamp(finiteNumber(elapsed, 0), 0, safeDuration);
    const progress = clamp(localTime / safeDuration, 0, 1);
    const speed = profile.speedStart + (profile.speedEnd - profile.speedStart) * progress;
    const distance = profile.locomotion
      ? profile.direction * (profile.speedStart * localTime + 0.5 * (profile.speedEnd - profile.speedStart) * localTime * progress)
      : 0;
    const angle = (finiteNumber(baseFacing, 0) + profile.directionAngle) * Math.PI / 180;
    const vertical = profile.jump
      ? Math.sin(Math.PI * progress) * 0.8
      : profile.rise
        ? 0.85 * progress + (profile.float ? Math.sin(progress * Math.PI * 4) * 0.12 : 0)
        : 0;
    const result = {
      ...profile,
      elapsed: localTime,
      progress,
      speed,
      distanceMeters: distance,
      xMeters: Math.cos(angle) * distance,
      yMeters: Math.sin(angle) * distance,
      verticalMeters: vertical,
      facingDelta: profile.turnDegrees * progress,
      posePreset: profile.posePreset,
      poseLabel: profile.poseLabel,
      poseMode: profile.poseMode,
      translationOnly: profile.translationOnly,
      summary: profile.summary,
    };
    if (profile.posePreset) result.poseMix = progress;
    return result;
  }

  return {
    DEFAULT_TRANSLATION_SPEED,
    FAST_TRANSLATION_SPEED,
    MAX_TRANSLATION_SPEED,
    analyzePromptMotion,
    evaluatePromptMotion,
  };
});
