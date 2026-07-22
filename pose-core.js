(function poseCoreFactory(root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.FrisFramePoseCore = factory();
}(typeof globalThis !== "undefined" ? globalThis : this, function createPoseCore() {
  "use strict";

  const JOINT_DEFINITIONS = Object.freeze({
    chest: { label: "상체", x: [-45, 45], y: [-55, 55], z: [-40, 40] },
    head: { label: "머리", x: [-45, 45], y: [-75, 75], z: [-40, 40] },
    upperArmL: { label: "왼쪽 위팔", x: [-150, 150], y: [-110, 110], z: [-170, 170] },
    lowerArmL: { label: "왼쪽 아래팔", x: [-10, 150], y: [-90, 90], z: [-110, 110] },
    upperArmR: { label: "오른쪽 위팔", x: [-150, 150], y: [-110, 110], z: [-170, 170] },
    lowerArmR: { label: "오른쪽 아래팔", x: [-10, 150], y: [-90, 90], z: [-110, 110] },
    upperLegL: { label: "왼쪽 허벅지", x: [-125, 105], y: [-60, 60], z: [-55, 55] },
    lowerLegL: { label: "왼쪽 종아리", x: [-5, 155], y: [-30, 30], z: [-25, 25] },
    upperLegR: { label: "오른쪽 허벅지", x: [-125, 105], y: [-60, 60], z: [-55, 55] },
    lowerLegR: { label: "오른쪽 종아리", x: [-5, 155], y: [-30, 30], z: [-25, 25] },
  });

  const PRESET_LABELS = Object.freeze({
    /* 기본 */
    neutral: "기본",
    attention: "차렷",
    armsCrossed: "팔짱",
    handsBack: "뒷짐",
    handsPocket: "주머니",
    /* 이동 */
    walk: "걷기",
    run: "달리기",
    sneak: "살금살금",
    backStep: "뒷걸음",
    kneeWalk: "무릎걷기",
    /* 앉기/눕기 */
    sit: "앉기",
    crossLegs: "다리꼬기",
    leanSit: "기대앉기",
    lieDown: "눕기",
    faceDown: "엎드리기",
    /* 액션 */
    crouch: "웅크리기",
    guard: "방어",
    punch: "주먹지르기",
    kick: "발차기",
    push: "밀기",
    /* 감정/제스처 */
    wave: "손 인사",
    point: "가리키기",
    think: "생각",
    surprise: "놀람",
    sad: "슬픔",
    cheer: "환호",
    bow: "고개숙임",
    shrug: "어깨으쓱",
    stop: "정지",
    clap: "박수",
  });

  const PRESET_CATEGORIES = Object.freeze([
    { id: "basic", label: "기본", emoji: "🧍", presets: ["neutral", "attention", "armsCrossed", "handsBack", "handsPocket"] },
    { id: "locomotion", label: "이동", emoji: "🚶", presets: ["walk", "run", "sneak", "backStep", "kneeWalk"] },
    { id: "seated", label: "앉기/눕기", emoji: "🪑", presets: ["sit", "crossLegs", "leanSit", "lieDown", "faceDown"] },
    { id: "action", label: "액션", emoji: "🤸", presets: ["crouch", "guard", "punch", "kick", "push"] },
    { id: "emotion", label: "감정/제스처", emoji: "💬", presets: ["wave", "point", "think", "surprise", "sad", "cheer", "bow", "shrug", "stop", "clap"] },
  ]);

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function finite(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function defaultBodyPose() {
    const pose = {};
    Object.keys(JOINT_DEFINITIONS).forEach((jointId) => {
      pose[jointId] = { x: 0, y: 0, z: 0 };
    });
    pose.upperArmL.z = -4;
    pose.upperArmR.z = 4;
    return pose;
  }

  function sanitizeBodyPose(input = {}) {
    const fallback = defaultBodyPose();
    const result = {};
    Object.entries(JOINT_DEFINITIONS).forEach(([jointId, definition]) => {
      const source = input?.[jointId] || {};
      result[jointId] = {
        x: clamp(finite(source.x, fallback[jointId].x), definition.x[0], definition.x[1]),
        y: clamp(finite(source.y, fallback[jointId].y), definition.y[0], definition.y[1]),
        z: clamp(finite(source.z, fallback[jointId].z), definition.z[0], definition.z[1]),
      };
    });
    return result;
  }

  function presetBodyPose(presetId = "neutral") {
    const pose = defaultBodyPose();

    /* ── 기본 ── */
    if (presetId === "attention") {
      pose.upperArmL.z = -2;
      pose.upperArmR.z = 2;
      pose.upperArmL.x = 4;
      pose.upperArmR.x = 4;
      pose.lowerArmL.x = 2;
      pose.lowerArmR.x = 2;
    } else if (presetId === "armsCrossed") {
      pose.upperArmL.x = -20;
      pose.upperArmR.x = -20;
      pose.upperArmL.z = -52;
      pose.upperArmR.z = 52;
      pose.lowerArmL.x = 110;
      pose.lowerArmR.x = 110;
      pose.lowerArmL.y = 60;
      pose.lowerArmR.y = -60;
      pose.chest.x = -3;
    } else if (presetId === "handsBack") {
      pose.upperArmL.x = 22;
      pose.upperArmR.x = 22;
      pose.upperArmL.z = 8;
      pose.upperArmR.z = -8;
      pose.lowerArmL.x = 52;
      pose.lowerArmR.x = 52;
      pose.chest.x = -4;
    } else if (presetId === "handsPocket") {
      pose.upperArmL.x = 8;
      pose.upperArmR.x = 8;
      pose.upperArmL.z = -14;
      pose.upperArmR.z = 14;
      pose.lowerArmL.x = 28;
      pose.lowerArmR.x = 28;
      pose.lowerArmL.y = 20;
      pose.lowerArmR.y = -20;
      pose.chest.x = -3;

    /* ── 이동 ── */
    } else if (presetId === "walk") {
      pose.chest.y = -6;
      pose.upperArmL.x = -28;
      pose.upperArmR.x = 28;
      pose.lowerArmL.x = 20;
      pose.lowerArmR.x = 20;
      pose.upperLegL.x = 30;
      pose.upperLegR.x = -30;
      pose.lowerLegL.x = 42;
      pose.lowerLegR.x = 12;
    } else if (presetId === "run") {
      pose.chest.x = 14;
      pose.head.x = -8;
      pose.upperArmL.x = -58;
      pose.upperArmR.x = 58;
      pose.lowerArmL.x = 72;
      pose.lowerArmR.x = 72;
      pose.upperLegL.x = 58;
      pose.upperLegR.x = -52;
      pose.lowerLegL.x = 82;
      pose.lowerLegR.x = 24;
    } else if (presetId === "sneak") {
      pose.chest.x = 18;
      pose.head.x = -12;
      pose.upperArmL.x = 15;
      pose.upperArmR.x = -15;
      pose.upperArmL.z = -22;
      pose.upperArmR.z = 22;
      pose.lowerArmL.x = 58;
      pose.lowerArmR.x = 58;
      pose.upperLegL.x = -35;
      pose.upperLegR.x = 25;
      pose.lowerLegL.x = 35;
      pose.lowerLegR.x = 65;
    } else if (presetId === "backStep") {
      pose.chest.x = -6;
      pose.head.x = 4;
      pose.upperArmL.x = 16;
      pose.upperArmR.x = -16;
      pose.lowerArmL.x = 18;
      pose.lowerArmR.x = 18;
      pose.upperLegL.x = -20;
      pose.upperLegR.x = 30;
      pose.lowerLegL.x = 38;
      pose.lowerLegR.x = 12;
    } else if (presetId === "kneeWalk") {
      pose.chest.x = 6;
      pose.upperLegL.x = -85;
      pose.upperLegR.x = -68;
      pose.lowerLegL.x = 120;
      pose.lowerLegR.x = 110;
      pose.upperArmL.x = -16;
      pose.upperArmR.x = 16;
      pose.lowerArmL.x = 32;
      pose.lowerArmR.x = 32;

    /* ── 앉기/눕기 ── */
    } else if (presetId === "sit") {
      pose.chest.x = -4;
      pose.upperLegL.x = -86;
      pose.upperLegR.x = -86;
      pose.lowerLegL.x = 88;
      pose.lowerLegR.x = 88;
      pose.upperArmL.x = -12;
      pose.upperArmR.x = -12;
      pose.lowerArmL.x = 34;
      pose.lowerArmR.x = 34;
    } else if (presetId === "crossLegs") {
      pose.chest.x = -6;
      pose.upperLegL.x = -86;
      pose.upperLegR.x = -82;
      pose.upperLegL.y = 18;
      pose.upperLegR.y = -6;
      pose.lowerLegL.x = 92;
      pose.lowerLegR.x = 86;
      pose.upperArmL.x = -10;
      pose.upperArmR.x = -10;
      pose.lowerArmL.x = 44;
      pose.lowerArmR.x = 44;
    } else if (presetId === "leanSit") {
      pose.chest.x = -18;
      pose.chest.z = -12;
      pose.head.x = 8;
      pose.upperLegL.x = -86;
      pose.upperLegR.x = -86;
      pose.lowerLegL.x = 88;
      pose.lowerLegR.x = 88;
      pose.upperArmL.x = -20;
      pose.upperArmR.x = 8;
      pose.lowerArmL.x = 48;
      pose.lowerArmR.x = 22;
    } else if (presetId === "lieDown") {
      pose.chest.x = -45;
      pose.head.x = -12;
      pose.upperArmL.x = -14;
      pose.upperArmR.x = -14;
      pose.upperArmL.z = -48;
      pose.upperArmR.z = 48;
      pose.lowerArmL.x = 16;
      pose.lowerArmR.x = 16;
      pose.upperLegL.x = -4;
      pose.upperLegR.x = -4;
      pose.lowerLegL.x = 4;
      pose.lowerLegR.x = 4;
    } else if (presetId === "faceDown") {
      pose.chest.x = 45;
      pose.head.x = 14;
      pose.upperArmL.x = -38;
      pose.upperArmR.x = -38;
      pose.upperArmL.z = -68;
      pose.upperArmR.z = 68;
      pose.lowerArmL.x = 82;
      pose.lowerArmR.x = 82;
      pose.upperLegL.x = -4;
      pose.upperLegR.x = -4;
      pose.lowerLegL.x = 4;
      pose.lowerLegR.x = 4;

    /* ── 액션 ── */
    } else if (presetId === "crouch") {
      pose.chest.x = 24;
      pose.head.x = -10;
      pose.upperLegL.x = -95;
      pose.upperLegR.x = -95;
      pose.lowerLegL.x = 125;
      pose.lowerLegR.x = 125;
      pose.upperArmL.x = -18;
      pose.upperArmR.x = -18;
      pose.upperArmL.z = -24;
      pose.upperArmR.z = 24;
      pose.lowerArmL.x = 42;
      pose.lowerArmR.x = 42;
    } else if (presetId === "guard") {
      pose.chest.x = 6;
      pose.chest.y = -8;
      pose.head.x = -4;
      pose.upperArmL.x = -48;
      pose.upperArmR.x = -48;
      pose.upperArmL.z = -58;
      pose.upperArmR.z = 58;
      pose.lowerArmL.x = 120;
      pose.lowerArmR.x = 120;
      pose.upperLegL.x = -18;
      pose.upperLegR.x = -18;
      pose.lowerLegL.x = 22;
      pose.lowerLegR.x = 22;
      pose.upperLegL.y = -10;
      pose.upperLegR.y = 10;
    } else if (presetId === "punch") {
      pose.chest.y = -24;
      pose.head.y = -12;
      pose.upperArmR.x = -68;
      pose.upperArmR.z = 82;
      pose.upperArmR.y = -14;
      pose.lowerArmR.x = 16;
      pose.upperArmL.x = -32;
      pose.upperArmL.z = -48;
      pose.lowerArmL.x = 98;
      pose.upperLegL.x = -14;
      pose.upperLegR.x = 8;
      pose.lowerLegL.x = 16;
      pose.lowerLegR.x = 12;
    } else if (presetId === "kick") {
      pose.chest.x = -12;
      pose.chest.y = 6;
      pose.head.y = 8;
      pose.upperArmL.z = -38;
      pose.upperArmR.z = 38;
      pose.lowerArmL.x = 48;
      pose.lowerArmR.x = 48;
      pose.upperLegL.x = 18;
      pose.lowerLegL.x = 30;
      pose.upperLegR.x = -72;
      pose.lowerLegR.x = 10;
    } else if (presetId === "push") {
      pose.chest.x = 18;
      pose.head.x = -6;
      pose.upperArmL.x = -62;
      pose.upperArmR.x = -62;
      pose.upperArmL.z = -42;
      pose.upperArmR.z = 42;
      pose.lowerArmL.x = 24;
      pose.lowerArmR.x = 24;
      pose.upperLegL.x = -12;
      pose.upperLegR.x = 18;
      pose.lowerLegL.x = 22;
      pose.lowerLegR.x = 8;

    /* ── 감정/제스처 ── */
    } else if (presetId === "wave") {
      pose.head.y = -12;
      pose.chest.z = -4;
      pose.upperArmR.z = 154;
      pose.upperArmR.y = -12;
      pose.lowerArmR.x = 72;
      pose.lowerArmR.z = -18;
    } else if (presetId === "point") {
      pose.chest.y = -12;
      pose.head.y = -22;
      pose.upperArmR.z = 88;
      pose.upperArmR.y = -10;
      pose.lowerArmR.x = 5;
    } else if (presetId === "think") {
      pose.head.x = -8;
      pose.head.y = 16;
      pose.head.z = 6;
      pose.chest.y = 8;
      pose.upperArmR.x = -36;
      pose.upperArmR.z = 48;
      pose.lowerArmR.x = 118;
      pose.lowerArmR.y = -22;
      pose.upperArmL.x = -12;
      pose.upperArmL.z = -18;
      pose.lowerArmL.x = 44;
      pose.lowerArmL.y = 28;
    } else if (presetId === "surprise") {
      pose.head.x = -10;
      pose.chest.x = -8;
      pose.upperArmL.x = -42;
      pose.upperArmR.x = -42;
      pose.upperArmL.z = -72;
      pose.upperArmR.z = 72;
      pose.lowerArmL.x = 48;
      pose.lowerArmR.x = 48;
      pose.upperLegL.y = -8;
      pose.upperLegR.y = 8;
    } else if (presetId === "sad") {
      pose.chest.x = 18;
      pose.head.x = 22;
      pose.head.z = 8;
      pose.upperArmL.x = 12;
      pose.upperArmR.x = 12;
      pose.upperArmL.z = -6;
      pose.upperArmR.z = 6;
      pose.lowerArmL.x = 8;
      pose.lowerArmR.x = 8;
    } else if (presetId === "cheer") {
      pose.head.x = -14;
      pose.chest.x = -8;
      pose.upperArmL.z = -148;
      pose.upperArmR.z = 148;
      pose.upperArmL.x = -18;
      pose.upperArmR.x = -18;
      pose.lowerArmL.x = 32;
      pose.lowerArmR.x = 32;
      pose.lowerArmL.z = -24;
      pose.lowerArmR.z = 24;
    } else if (presetId === "bow") {
      pose.chest.x = 38;
      pose.head.x = 14;
      pose.upperArmL.x = 14;
      pose.upperArmR.x = 14;
      pose.upperArmL.z = -2;
      pose.upperArmR.z = 2;
      pose.lowerArmL.x = 6;
      pose.lowerArmR.x = 6;
    } else if (presetId === "shrug") {
      pose.head.z = 6;
      pose.upperArmL.z = -52;
      pose.upperArmR.z = 52;
      pose.upperArmL.x = -14;
      pose.upperArmR.x = -14;
      pose.lowerArmL.x = 86;
      pose.lowerArmR.x = 86;
      pose.lowerArmL.z = -28;
      pose.lowerArmR.z = 28;
    } else if (presetId === "stop") {
      pose.upperArmR.z = 88;
      pose.upperArmR.x = -18;
      pose.lowerArmR.x = 92;
      pose.lowerArmR.z = -8;
      pose.head.y = -8;
      pose.chest.y = -4;
    } else if (presetId === "clap") {
      pose.upperArmL.x = -48;
      pose.upperArmR.x = -48;
      pose.upperArmL.z = -38;
      pose.upperArmR.z = 38;
      pose.lowerArmL.x = 98;
      pose.lowerArmR.x = 98;
      pose.lowerArmL.y = 32;
      pose.lowerArmR.y = -32;
      pose.chest.x = -4;
    }
    return sanitizeBodyPose(pose);
  }

  function mirrorBodyPose(input = {}) {
    const pose = sanitizeBodyPose(input);
    const result = defaultBodyPose();
    const paired = [
      ["upperArmL", "upperArmR"],
      ["lowerArmL", "lowerArmR"],
      ["upperLegL", "upperLegR"],
      ["lowerLegL", "lowerLegR"],
    ];
    paired.forEach(([left, right]) => {
      result[left] = { x: pose[right].x, y: -pose[right].y, z: -pose[right].z };
      result[right] = { x: pose[left].x, y: -pose[left].y, z: -pose[left].z };
    });
    ["chest", "head"].forEach((jointId) => {
      result[jointId] = { x: pose[jointId].x, y: -pose[jointId].y, z: -pose[jointId].z };
    });
    return sanitizeBodyPose(result);
  }

  function interpolateBodyPose(start, end, progress) {
    const from = sanitizeBodyPose(start);
    const to = sanitizeBodyPose(end);
    const t = clamp(finite(progress, 0), 0, 1);
    const result = {};
    Object.keys(JOINT_DEFINITIONS).forEach((jointId) => {
      result[jointId] = {};
      ["x", "y", "z"].forEach((axis) => {
        result[jointId][axis] = from[jointId][axis] + (to[jointId][axis] - from[jointId][axis]) * t;
      });
    });
    return sanitizeBodyPose(result);
  }

  function proceduralLocomotion(input, mode = "walk", phase = 0, strength = 1) {
    const pose = sanitizeBodyPose(input);
    const locomotionMode = mode === "run" ? "run" : mode === "walk" ? "walk" : "pose";
    const amount = clamp(finite(strength, 0), 0, 1);
    if (locomotionMode === "pose" || amount <= 0) return { pose, bob: 0 };

    const cycle = finite(phase, 0);
    const swing = Math.sin(cycle);
    const lift = 0.5 - 0.5 * Math.cos(cycle * 2);
    const running = locomotionMode === "run";
    const legSwing = (running ? 52 : 30) * swing * amount;
    const armSwing = (running ? 42 : 24) * swing * amount;
    const kneeBend = (running ? 76 : 38) * amount;

    pose.upperLegL.x += legSwing;
    pose.upperLegR.x -= legSwing;
    pose.lowerLegL.x += (running ? 14 : 4) * amount + Math.max(0, -swing) * kneeBend;
    pose.lowerLegR.x += (running ? 14 : 4) * amount + Math.max(0, swing) * kneeBend;
    pose.upperArmL.x -= armSwing;
    pose.upperArmR.x += armSwing;
    pose.lowerArmL.x += (running ? 58 : 18) * amount;
    pose.lowerArmR.x += (running ? 58 : 18) * amount;
    pose.chest.x += (running ? 10 : 2) * amount;
    pose.chest.y += swing * (running ? 7 : 4) * amount;
    pose.head.y -= swing * (running ? 3 : 1.5) * amount;

    return {
      pose: sanitizeBodyPose(pose),
      bob: lift * (running ? 0.075 : 0.035) * amount,
    };
  }

  return Object.freeze({
    JOINT_DEFINITIONS,
    PRESET_CATEGORIES,
    PRESET_LABELS,
    defaultBodyPose,
    interpolateBodyPose,
    mirrorBodyPose,
    presetBodyPose,
    proceduralLocomotion,
    sanitizeBodyPose,
  });
}));
