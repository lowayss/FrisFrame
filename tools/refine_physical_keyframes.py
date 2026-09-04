from pathlib import Path


def replace(path, old, new, count=1):
    p = Path(path)
    text = p.read_text(encoding="utf-8")
    if old not in text:
        raise SystemExit(f"expected block not found: {path}: {old[:120]!r}")
    p.write_text(text.replace(old, new, count), encoding="utf-8")


live = "electron/camera-operator-live-ux.js"
phone = "electron/phone-motion-camera-ux.js"
live_test = "tests/camera-operator-live-contract.test.cjs"
take_test = "tests/physical-camera-take-context.test.cjs"

replace(
    live,
    '  const armOperator = () => {\n',
    '  const armOperator = (options = {}) => {\n    const ensureStartKey = options?.ensureStartKey === true;\n',
)

replace(
    live,
    '''    const cameraKeys = typeof keysForSource === "function" ? keysForSource("camera") : [];
    const canStartAtRequestedTime = requestedTime < maxTimelineTime() - 0.0005;
    const exactKey = canStartAtRequestedTime && cameraKeys.find((keyframe) => (
      typeof timelineTimesMatch === "function"
        ? timelineTimesMatch(keyframe.time, requestedTime)
        : Math.abs(Number(keyframe.time) - Number(requestedTime)) < 0.0005
    ));
    const firstKey = exactKey || [...cameraKeys].sort((left, right) => Number(left.time) - Number(right.time))[0];
    if (!firstKey) {
      notifyApp("먼저 카메라 키프레임을 하나 찍어주세요.");
      return;
    }

    startSnapshot = {
      camera: clone(state.camera),
      keyframes: clone(state.motion.keyframes),
''',
    '''    const originalCamera = clone(state.camera);
    const originalKeyframes = clone(state.motion.keyframes);
    const cameraKeys = typeof keysForSource === "function" ? keysForSource("camera") : [];
    const canStartAtRequestedTime = requestedTime < maxTimelineTime() - 0.0005;
    const exactKey = canStartAtRequestedTime && cameraKeys.find((keyframe) => (
      typeof timelineTimesMatch === "function"
        ? timelineTimesMatch(keyframe.time, requestedTime)
        : Math.abs(Number(keyframe.time) - Number(requestedTime)) < 0.0005
    ));
    let firstKey = exactKey || [...cameraKeys].sort((left, right) => Number(left.time) - Number(right.time))[0];
    if (!firstKey && ensureStartKey && canStartAtRequestedTime && typeof captureSourceKeyframe === "function") {
      const createdStartKey = captureSourceKeyframe("camera", requestedTime, undefined, "straight");
      if (createdStartKey) {
        createdStartKey.transition = "linear";
        createdStartKey.operatorContinuity = true;
        createdStartKey.operatorInput = "phone";
        state.motion.keyframes.push(createdStartKey);
        state.motion.keyframes = typeof sortKeyframes === "function" ? sortKeyframes(state.motion.keyframes) : state.motion.keyframes;
        firstKey = createdStartKey;
      }
    }
    if (!firstKey) {
      notifyApp("먼저 카메라 키프레임을 하나 찍어주세요.");
      return;
    }

    startSnapshot = {
      camera: originalCamera,
      keyframes: originalKeyframes,
''',
)

replace(
    live,
    '''    notifyApp(exactKey
      ? `Camera Operator STBY · ${trackingMessage}`
      : `Camera Operator STBY · ${startTime.toFixed(2)}초에서 ${trackingMessage}`);
  };

  const tickRecording = () => {
''',
    '''    notifyApp(exactKey
      ? `Camera Operator STBY · ${trackingMessage}`
      : `Camera Operator STBY · ${startTime.toFixed(2)}초에서 ${trackingMessage}`);
  };

  const adoptStartPose = (pose, input = "phone") => {
    if (mode !== "armed" || !pose || !state?.camera) return false;
    applyCameraPose(pose, state);
    const startKey = state.motion.keyframes.find((keyframe) => (
      keyframe.source === "camera" && (
        typeof timelineTimesMatch === "function"
          ? timelineTimesMatch(keyframe.time, startTime)
          : Math.abs(Number(keyframe.time) - Number(startTime)) < 0.0005
      )
    ));
    if (startKey) {
      startKey.pose = { ...startKey.pose, ...currentCameraPose() };
      if (state.camera.trackingTargetId) startKey.pose.trackingTargetId = state.camera.trackingTargetId;
      startKey.transition = "linear";
      startKey.operatorContinuity = true;
      startKey.operatorInput = input;
    }
    dirty = true;
    renderLiveFrame(startTime);
    return true;
  };

  const tickRecording = () => {
''',
)

replace(
    live,
    '    if (time - lastSampleTime >= 1 / 30 || time >= maxTimelineTime()) sampleCurrentPose(time);\n',
    '    const sampleInterval = recordInput === "phone" ? 1 / 60 : 1 / 30;\n    if (time - lastSampleTime >= sampleInterval || time >= maxTimelineTime()) sampleCurrentPose(time);\n',
)

replace(
    live,
    '''    if (input === "world") {
      pointerId = pointerToken(event);
      lastClientX = event.clientX;
      lastClientY = event.clientY;
    } else {
      beginPointerControl(event);
    }
  };

  const beginPointerControl = (event) => {
''',
    '''    if (input === "world") {
      pointerId = pointerToken(event);
      lastClientX = event.clientX;
      lastClientY = event.clientY;
    } else if (input === "preview") {
      beginPointerControl(event);
    }
  };

  const startPhysicalRecording = () => {
    if (mode === "idle") armOperator({ ensureStartKey:true });
    if (mode !== "armed") return false;
    const event = { button:0, preventDefault(){}, stopPropagation(){} };
    beginRecording(event, "phone");
    return mode === "recording";
  };

  const beginPointerControl = (event) => {
''',
)

replace(
    live,
    '''    const cleanupStrength = clamp(Number(cleanup.value) / 100, 0, 0.4);
    // Mouse-driven takes need a small amount of stabilization even when the
    // visible jitter control is left at zero. Without this baseline, the first
    // and last sparse pointer samples can create a velocity pop between keys.
    const stabilizationStrength = Math.max(cleanupStrength, 0.16);
    const smoothed = core.smoothSamples(samples, stabilizationStrength);
    const resampled = typeof core.resampleSamples === "function"
      ? core.resampleSamples(smoothed, 1 / 15)
      : smoothed;
    const reduced = core.simplifySamples(resampled, {
      positionTolerance: 0.00135 + cleanupStrength * 0.0025,
      heightTolerance: 0.014 + cleanupStrength * 0.026,
      angleTolerance: 0.13 + cleanupStrength * 0.24,
      focalTolerance: 0.25,
      // Continuous vector tangents carry the curve between keys, so forcing a
      // key every ~0.28s only creates extra micro slowdowns. Keep enough keys to
      // preserve operator timing while allowing each spline segment to breathe.
      maxGap: 0.42 + cleanupStrength * 0.18,
    });
''',
    '''    const cleanupStrength = clamp(Number(cleanup.value) / 100, 0, 0.4);
    const phoneTake = recordInput === "phone";
    // Physical Camera already applies sensor-side stabilization. Avoid a second
    // heavy smoothing pass that would erase intentional handheld acceleration,
    // while retaining the original mouse/gamepad baseline stabilization.
    const stabilizationStrength = phoneTake
      ? Math.min(cleanupStrength, 0.08)
      : Math.max(cleanupStrength, 0.16);
    const smoothed = stabilizationStrength > 0
      ? core.smoothSamples(samples, stabilizationStrength)
      : samples.map((sample) => ({ ...sample }));
    // Capture Physical Camera densely, then write an editable 30 Hz source path.
    // Other operator inputs keep the existing 15 Hz editing cadence.
    const resampleStep = phoneTake ? 1 / 30 : 1 / 15;
    const resampled = typeof core.resampleSamples === "function"
      ? core.resampleSamples(smoothed, resampleStep)
      : smoothed;
    const reductionOptions = phoneTake
      ? {
          positionTolerance: 0.00055 + cleanupStrength * 0.0012,
          heightTolerance: 0.006 + cleanupStrength * 0.012,
          angleTolerance: 0.07 + cleanupStrength * 0.12,
          focalTolerance: 0.18,
          maxGap: 0.22 + cleanupStrength * 0.10,
        }
      : {
          positionTolerance: 0.00135 + cleanupStrength * 0.0025,
          heightTolerance: 0.014 + cleanupStrength * 0.026,
          angleTolerance: 0.13 + cleanupStrength * 0.24,
          focalTolerance: 0.25,
          // Continuous vector tangents carry the curve between keys, so forcing a
          // key every ~0.28s only creates extra micro slowdowns. Keep enough keys to
          // preserve operator timing while allowing each spline segment to breathe.
          maxGap: 0.42 + cleanupStrength * 0.18,
        };
    const reduced = core.simplifySamples(resampled, reductionOptions);
''',
)

replace(
    live,
    '      keyframe.operatorContinuity = true;\n      state.motion.keyframes.push(keyframe);\n',
    '      keyframe.operatorContinuity = true;\n      keyframe.operatorInput = recordInput;\n      state.motion.keyframes.push(keyframe);\n',
)

replace(
    live,
    '''  window.FrisFrameCameraOperator = {
    arm: armOperator,
    cancel: cancelOperator,
    finish: finishOperatorTake,
''',
    '''  window.FrisFrameCameraOperator = {
    arm: armOperator,
    startPhysical: startPhysicalRecording,
    adoptStartPose,
    cancel: cancelOperator,
    finish: finishOperatorTake,
''',
)

replace(
    phone,
    '''  function adoptLivePreviewIntoOperator() {
    if (!livePreviewPose || operator()?.mode !== "armed") return false;
    const pose = cloneValue(livePreviewPose);
    livePreviewPose = null;
    applyPoseToState(pose, state);
    renderExternalFrame();
    return true;
  }
''',
    '''  function adoptLivePreviewIntoOperator() {
    const op = operator();
    if (!livePreviewPose || op?.mode !== "armed") return false;
    const pose = cloneValue(livePreviewPose);
    livePreviewPose = null;
    if (typeof op.adoptStartPose === "function") op.adoptStartPose(pose, "phone");
    else {
      applyPoseToState(pose, state);
      renderExternalFrame();
    }
    return true;
  }
''',
)

replace(phone, '      op.arm();\n', '      op.arm({ ensureStartKey:true });\n')

replace(
    phone,
    '''        const starter = inputs()?.startRecording;
        if (typeof starter === "function") starter();
''',
    '''        if (typeof op?.startPhysical === "function") op.startPhysical();
        else {
          const starter = inputs()?.startRecording;
          if (typeof starter === "function") starter();
        }
''',
)

replace(
    live_test,
    'assert.match(controller, /const stabilizationStrength = Math\\.max\\(cleanupStrength, 0\\.16\\)/, "mouse-driven takes must have a baseline stabilization pass");\nassert.match(controller, /core\\.resampleSamples\\(smoothed, 1 \\/ 15\\)/, "mouse-driven takes must use a stable sample clock before key reduction");\n',
    'assert.match(controller, /: Math\\.max\\(cleanupStrength, 0\\.16\\)/, "mouse-driven takes must retain a baseline stabilization pass");\nassert.match(controller, /resampleStep = phoneTake \\? 1 \\/ 30 : 1 \\/ 15/, "physical takes must preserve a denser editable sample clock than mouse takes");\nassert.match(controller, /sampleInterval = recordInput === "phone" \\? 1 \\/ 60 : 1 \\/ 30/, "Physical Camera must sample live motion at display-class cadence before reduction");\nassert.match(controller, /positionTolerance: 0\\.00055/, "Physical Camera key reduction must retain small intentional position moves");\nassert.match(controller, /angleTolerance: 0\\.07/, "Physical Camera key reduction must retain fine pan and tilt changes");\nassert.match(controller, /maxGap: 0\\.22 \\+ cleanupStrength \\* 0\\.10/, "Physical Camera must not leave long gaps between editable keys");\nassert.match(controller, /startPhysical: startPhysicalRecording/, "Physical Camera must enter a dedicated recording path instead of masquerading as mouse input");\nassert.match(controller, /adoptStartPose/, "Physical Camera must rewrite the take start key to the adopted LIVE phone pose");\n',
)

replace(
    take_test,
    '''  assert.match(ux, /get livePreview\\(\\)/);
});
''',
    '''  assert.match(ux, /get livePreview\\(\\)/);
  assert.match(ux, /op\\.arm\\(\\{ ensureStartKey:true \\}\\)/, "phone REC must auto-create a start camera key when the timeline has none");
  assert.match(ux, /op\\.adoptStartPose\\(pose, "phone"\\)/, "the LIVE phone pose must become the actual first recorded camera key");
  assert.match(ux, /op\\?\\.startPhysical/, "physical motion must use the dedicated high-fidelity recording path");
});
''',
)

print("Physical Camera keyframe fidelity patches applied")
