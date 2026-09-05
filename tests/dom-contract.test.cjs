const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const manualGuide = fs.readFileSync(path.join(root, "manual-guide-core.js"), "utf8");
const motion = fs.readFileSync(path.join(root, "motion-core.js"), "utf8");
const ids = new Set([...html.matchAll(/\bid=["']([^"']+)["']/g)].map((match) => match[1]));
const selectors = [...app.matchAll(/\$\(\s*["'`]([^"'`]+)["'`]\s*\)/g)].map((match) => match[1]);
const referencedIds = new Set(selectors.flatMap((selector) => (
  [...selector.matchAll(/#([A-Za-z][\w-]*)/g)].map((match) => match[1])
)));
const missingIds = [...referencedIds].filter((id) => !ids.has(id)).sort();

assert.deepEqual(missingIds, [], `app.js references missing HTML ids: ${missingIds.join(", ")}`);

const motionIndex = html.indexOf("./motion-core.js");
const sceneBlockingIndex = html.indexOf("./scene-blocking-core.js");
const timelineIndex = html.indexOf("./timeline-core.js");
const recoveryIndex = html.indexOf("./project-recovery-core.js");
const storyboardIndex = html.indexOf("./storyboard-core.js");
const manualGuideIndex = html.indexOf("./manual-guide-core.js");
const poseIndex = html.indexOf("./pose-core.js");
const cameraDraftingIndex = html.indexOf("./camera-drafting-core.js");
const multiCameraIndex = html.indexOf("./multi-camera-core.js");
const spatialScaleIndex = html.indexOf("./spatial-scale-core.js");
const appIndex = html.indexOf("./app.js");
assert.ok(motionIndex >= 0 && sceneBlockingIndex > motionIndex && timelineIndex > sceneBlockingIndex && recoveryIndex > timelineIndex && storyboardIndex > recoveryIndex && manualGuideIndex > storyboardIndex && poseIndex > manualGuideIndex && cameraDraftingIndex > poseIndex && multiCameraIndex > cameraDraftingIndex && spatialScaleIndex > multiCameraIndex && appIndex > spatialScaleIndex);
assert.ok(html.includes("./boot-errors.js"));
assert.ok(html.includes("./vendor/three.min.js"));
assert.ok(html.includes("./vendor/lucide.min.js"));
assert.equal(html.includes("cdn.jsdelivr.net"), false);
assert.equal(html.includes("unpkg.com"), false);
assert.equal(ids.has("focalPresets"), false, "camera focal preset buttons must stay removed");
assert.equal(app.includes("focalPresets"), false, "camera focal preset behavior must stay removed");
for (const source of [html, app, manualGuide]) {
  assert.equal(source.includes("수동 탑승"), false, "boarding mode must not expose manual boarding");
  assert.equal(source.includes("자동 탑승"), false, "boarding mode must not expose automatic boarding as a choice");
}
assert.equal(ids.has("actorPlacementMode"), false, "actors must not expose a boarding-mode selector");
assert.ok(ids.has("actorMountSelect"), "actors need an explicit seat-object selector");
assert.ok(ids.has("actorInteractionSelect"), "actors need an explicit interaction selector");
assert.ok(ids.has("actorSeatSelect"), "actors need an explicit seat selector");
assert.ok(ids.has("actorMountStatus"), "actors need a read-only automatic seat-match status");
assert.ok(ids.has("actorMountApplyBtn"), "actors need an explicit boarding action");
assert.ok(ids.has("actorDetachMountBtn"), "mounted actors need an explicit detach action");
assert.ok(app.includes("function isSeatProp("), "seat-capable props need a shared predicate");
assert.ok(app.includes("function propInteractionDefinitions("), "props need extensible interaction definitions");
assert.ok(app.includes("function attachActorToInteraction("), "actors need an explicit interaction-application path");
assert.ok(app.includes('id: \"lie\"'), "lying interactions need a dedicated action id");
assert.ok(app.includes('posePreset: \"lieDown\"'), "lying interactions need the lie-down pose preset");
assert.ok(app.includes('label: \"작업하기\"'), "desks need a work interaction");
assert.ok(app.includes('label: \"칠판에 쓰기\"'), "blackboards need a write interaction");
assert.ok(app.includes('label: \"창밖 보기\"'), "windows need a look interaction");
assert.ok(app.includes('label: \"시청하기\"'), "televisions need a watch interaction");
assert.match(app, /chair:[\s\S]{0,260}facing: 90/, "chair anchors need to face the chair front");
assert.match(app, /sofa:[\s\S]{0,700}facing: 90/, "sofa anchors need to face the sofa front");
assert.ok(app.includes("function mountActorToSeat("), "actors need an explicit seat-application path");
assert.ok(app.includes("function detachAutoMountedActor("), "mounted actors need a separate detach path");
assert.ok(app.includes("function prepareActorForDirectManipulation("), "direct actor dragging must detach mounted actors before editing");
assert.doesNotMatch(app, /commit\([\s\S]{0,500}autoMatchActorsToSeats/, "commits must not auto-board actors");
assert.doesNotMatch(app, /function sanitizeState\([\s\S]{0,1200}autoMatchActorsToSeats/, "loading a project must not auto-board actors");
assert.match(app, /drag\.detachableActorId[\s\S]*?prepareActorForDirectManipulation/, "2D direct manipulation must detach a mounted actor");
assert.match(app, /threeDrag\.detachableActorId[\s\S]*?prepareActorForDirectManipulation/, "3D direct manipulation must detach a mounted actor");

assert.ok(html.includes("class=\"manual-example\""), "manual needs a visual walkthrough example");
assert.ok(html.includes("class=\"manual-storage-map\""), "manual needs a project storage comparison");
assert.ok(html.includes("class=\"manual-camera-compare\""), "manual needs a framing comparison");
assert.ok(html.includes("class=\"manual-key-example\""), "manual needs a keyframe timing example");
assert.ok(html.includes("class=\"manual-preview-compare\""), "manual needs a preview workflow comparison");
assert.ok(ids.has("keyInstructionInput"), "timeline needs a per-key storyboard instruction field");
assert.ok(ids.has("exportRangeTools") && ids.has("exportStartInput") && ids.has("exportEndInput") && ids.has("exportRangeResetBtn"), "MP4 export needs user-controlled start and end fields");
assert.ok(html.indexOf('id="exportMenu"') < html.indexOf('id="exportRangeTools"') && html.indexOf('id="exportRangeTools"') < html.indexOf('class="timeline panel"'), "MP4 export range belongs in the export menu, not the editing timeline");
assert.ok(app.includes("function normalizeExportRange("), "MP4 export range needs a normalized time window");
assert.match(app, /function exportVideoForDocument\([\s\S]*?const exportRange = normalizeExportRange\([\s\S]*?const exportDuration = Math\.max\(0\.01, exportRange\.end - exportRange\.start\)/, "MP4 export must derive frame duration from the selected range");
assert.match(app, /const renderTime = frameSchedule\.times\[index\];[\s\S]*?interpolateRenderStateAtTime\(exportState, renderTime\)/, "MP4 export must render frames from the CFR schedule");
assert.ok(app.includes("window.FrisFrameMotionCore?.referenceExportFrameSchedule"), "MP4 export timing must come from motion-core");
assert.equal(app.includes("index / (frameCount - 1)"), false, "MP4 evaluation must not stretch authored time across frameCount - 1 intervals");
assert.match(app, /exportRangeResetBtn[\s\S]*?state\.motion\.exportRange = \{ start: 0, end: state\.motion\.duration \}/, "MP4 export needs a one-click full-range reset");
assert.match(app, /const \{\s*collisionEpsilon: timelineCollisionEpsilon,[\s\S]*?\} = timelineCore;/, "timeline collision helpers must come from the timeline core");
assert.ok(app.includes("const PROJECT_SCHEMA_VERSION = 11;"), "continuity and cut snapshots require project schema v11");
for (const retiredId of [
  "multiCamPreviewBtn",
  "multiCamPreviewPanelBtn",
  "multiCamPreviewPanelBtnSecondary",
  "multiCamVideoBtn",
  "multiCamVideoPanelBtn",
]) {
  assert.equal(ids.has(retiredId), false, `${retiredId} must stay physically removed from shared HTML`);
}
assert.equal(app.includes("function exportMultiCameraPreview("), false,
  "retired multi-camera contact-sheet export must stay removed");
assert.equal(app.includes("function renderMultiCameraContactSheet("), false,
  "retired multi-camera contact-sheet renderer must stay removed");
assert.equal(app.includes("function exportMultiCameraVideo("), false,
  "retired multi-camera video export must stay removed");
assert.ok(app.includes("function exportSelectedCutFrame("), "selected cut needs a still-frame export action");
assert.ok(app.includes("function exportSelectedCutVideo("), "selected cut needs an MP4 export action");
assert.equal(app.includes("maxConcurrency = 6"), false, "MP4 frame uploads must not fan out concurrently");
assert.equal(app.includes("const uploadQueue = []"), false, "MP4 export must not retain a parallel upload queue");
assert.ok(app.includes("await uploadMp4ExportFrame(jobId, index, frameBlob);"), "MP4 frames must upload sequentially");
assert.ok(app.includes('mediaExportProgress = "MP4 인코딩 대기/진행";'), "MP4 export must explain queued single-flight encoding");
assert.ok(app.includes("let mediaExportOwner = \"\";"), "media export progress needs one visible owner");
assert.match(app, /selector === mediaExportOwner/, "MP4 progress must render only on the initiating button");
assert.ok(app.includes("function selectCameraPreviewSlot("), "multi-camera preview slots need direct activation");
assert.ok(ids.has("cameraRigList") && ids.has("cameraFrameModeBtn"), "multi-camera controls need a rig list and preview mode control");
assert.ok(app.includes("function cameraFieldRenderEntries("), "2D and 3D fields must render every camera profile");
assert.ok(app.includes("cameraProfileId"), "3D camera rigs need a profile identity for selection");
assert.ok(app.includes('else if (initThreeView()) {') && app.includes("renderCameraFramePreview(renderState);"), "2D tab must render the shared camera preview");
assert.ok(app.includes("else renderCameraFramePreview(threeView.lastState || evaluatedViewState || state);"), "shared camera preview must resize in the 2D tab");
assert.ok(ids.has("cameraFrameResizeHandle"), "camera preview needs a shared resize handle");
assert.ok(ids.has("cameraFrameMoveHandle"), "camera preview needs a shared move handle");
assert.ok(app.includes("function setupCameraFrameResize(") && app.includes("function setCameraFrameWidth("), "camera preview resizing needs pointer and keyboard controls");
assert.ok(app.includes("function setCameraFramePosition(") && app.includes("function clampSavedCameraFramePosition("), "camera preview position needs bounded shared movement");
assert.ok(app.includes("--camera-frame-width"), "camera preview width must be applied through a shared layout value");
const threeWrapStart = html.indexOf('id="threeWrap"');
const cameraFrameStart = html.indexOf('id="cameraFrame"');
assert.ok(threeWrapStart >= 0 && cameraFrameStart > threeWrapStart, "camera preview must remain in the shared canvas wrapper");
assert.equal(html.slice(cameraFrameStart).includes('id="threeCanvas"'), false, "camera preview must not be nested inside the 3D viewport markup");
assert.equal(ids.has("cameraSensorFormat"), false, "advanced physical camera controls should stay out of the blocking sidebar");
assert.equal(ids.has("cameraSensorWidth"), false, "sensor width control should stay out of the blocking sidebar");
assert.equal(ids.has("cameraAperture"), false, "aperture control should stay out of the blocking sidebar");
assert.equal(ids.has("cameraFocusDistance"), false, "focus distance control should stay out of the blocking sidebar");
assert.ok(motion.includes("focusDistanceM: lerpValue("), "motion-core must interpolate camera focus distance between keys");
assert.ok(app.includes("window.FrisFrameMotionCore?.composeBaseInterpolatedPose"), "app must delegate base camera pose composition to motion-core");
assert.ok(html.includes('id="compareCutVersionsBtn"'), "storyboard inspector needs A/B cut comparison");
assert.ok(html.includes('id="cutVersionCompareDialog"'), "cut version comparison needs a dedicated dialog");
assert.ok(app.includes("function continuityFindings("), "structured continuity analysis adapter is required");
assert.ok(app.includes("function captureCutVersion("), "cut snapshot capture command is required");
assert.equal(ids.has("actorMotionFields"), false, "procedural actor motion controls must stay removed");
assert.equal(ids.has("actorLocomotionMode"), false, "walking and running mode controls must stay removed");
assert.equal(app.includes("function actorLocomotionForSegment("), false, "procedural actor locomotion must stay removed");
assert.ok(html.includes('id="cutFocalInput" type="number" min="14" max="135"'), "storyboard lens input must preserve every supported focal length");
assert.ok(ids.has("actorPoseFields") && ids.has("actorPoseJointSelect") && ids.has("actorPoseKeyBtn"), "3D actors need pose controls and a pose key action");
assert.ok(html.includes('data-three-mode="pose"'), "3D toolbar needs a dedicated pose mode");
assert.ok(app.includes('model.name = "humanoid-rig-v2"'), "3D actors need the articulated mannequin rig");
assert.ok(/,\s*"nose"\);/.test(app), "3D actor face needs a nose mesh");
assert.ok(/,\s*"mouth"\);/.test(app), "3D actor face needs a mouth mesh");
assert.ok(app.includes("function captureActorPoseKeyframe("), "actor poses need timeline keyframe capture");
assert.ok(app.includes("function actorFocusHeight("), "camera tracking must include actor elevation and pitch");
assert.ok(app.includes("const spatialScaleCore = window.FrisFrameSpatialScaleCore;"), "3D blocking must use the shared metric scale core");
assert.ok(app.includes("function actorPhysicalDimensions("), "actor framing must use physical dimensions");
assert.match(app, /function actorFocusHeight\(item, renderState = state\)[\s\S]*?const trackingItem = item\?\.type === "actor"[\s\S]*?actorBodyPoseForRender\(trackingItem, renderState\)/,
  "subject tracking must resolve the actor's evaluated pose before choosing the focus height");
assert.match(app, /const mountedRootOffset = trackingItem\?\.autoMounted \? -0\.79 \* rigScale : 0;/,
  "mounted seated tracking must use the same lowered rig root as the renderer");
assert.match(app, /function actorInteractionPosePreset\(actor, renderState = state\)/,
  "actor tracking and rendering must share the interaction pose preset");
assert.ok(app.includes("fitThreeBodyToPhysicalBounds"), "prop meshes must be fitted to physical catalog dimensions");
assert.ok(ids.has("physicalScaleReadout") && app.includes("실측 스케일"), "properties must expose the resolved metric dimensions");
assert.ok(app.includes("function cameraPerspectiveForSubject("), "metric perspective checks must remain available to the editor");
assert.ok(app.includes("function updateThreePoseDrag("), "3D actors need direct joint dragging");
assert.ok(app.includes("function focusThreeViewOnCamera("), "stage reset needs a visible 3D camera framing");
assert.match(app, /focusThreeViewOnNextRender = true;[\s\S]{0,240}evaluatedViewState = null;/,
  "stage reset must request a 3D camera refocus before the next render");
assert.match(app, /state = \{[\s\S]{0,500}previs: clone\(previous\.previs \|\| fresh\.previs\),[\s\S]{0,180}\};\s*\/\/[\s\S]{0,120}Normalize[\s\S]{0,180}sanitizeState\(\);/,
  "stage reset must normalize camera profiles before committing the fresh document");
assert.equal(app.includes('return { kind: "camera", profileId: state.activeCameraId || "camera-1", fieldOffset: { x: 0, y: 0 }, forceMode: "move" };'), false,
  "camera picking must not use an unconditional diagnostic bypass");
assert.match(styles, /\.camera-frame\s*\{[\s\S]*?pointer-events:\s*none;/,
  "floating camera preview must let stage picks pass through when it covers a rig");
assert.match(styles, /#cameraFrameCanvas\s*\{[\s\S]*?pointer-events:\s*none;/,
  "camera preview canvas must not block 3D camera dragging");
assert.match(styles, /\.camera-frame-resize-handle\s*\{[\s\S]*?pointer-events:\s*auto;/,
  "camera preview resize handle must remain interactive while the preview shell passes stage picks through");
assert.match(app, /function makeCameraConeMesh\([\s\S]*?cameraFovGuide\s*=\s*true[\s\S]*?group\.traverse\(markGuide\);/,
  "camera FOV floor overlay must remain a guarded visual guide");
assert.match(app, /if \(editor\?\.kind === "cameraFovGuide"\)[\s\S]*?event\.preventDefault\(\);[\s\S]*?return;/,
  "camera FOV floor overlay must consume pointer gestures without orbiting or editing the camera");
assert.match(app, /const firstHit = hits\[0\]\?\.object;[\s\S]*?cameraFovGuide[\s\S]*?return \{ kind: "cameraFovGuide" \};/,
  "3D picking must recognize the FOV guide before the camera screen-anchor fallback");
assert.ok(app.includes("function makeCameraPreviewFloor("), "camera preview must provide a neutral floor for vertical and horizontal composition");
assert.match(app, /threeView\.previewWorld\.add\(makeCameraPreviewFloor\(renderState\)\);[\s\S]{0,180}renderState\.items/,
  "camera preview floor must render beneath authored subjects without restoring the full editor stage shell");
assert.ok(app.includes("function updateExistingSourceKeyframe(sourceId, time"), "pose edits should update an existing key without creating an implicit one");
assert.equal(app.includes("function autoSaveDraggedPose(sourceId)"), false, "drag edits must not expose an implicit keyframe save path");
assert.equal(app.includes("const newKey = captureSourceKeyframe(sourceId, time, undefined, \"straight\");"), false, "drag edits must never create a new keyframe");
assert.ok(app.includes("function advancePlayheadAfterKeyframe("), "explicit key actions must advance the playhead");
assert.ok(app.includes("ensureDurationCovers(nextTime)"), "keyframe follow-up time must remain three seconds ahead at the timeline edge");
assert.match(app, /function advancePlayheadAfterKeyframe\([\s\S]*?state\.motion\.playhead = nextTime;[\s\S]*?updatePlayheadDisplay\(nextTime\);/, "key actions must visibly advance the playhead");
assert.match(app, /renderSourceTimelines\(keyframes, cutTimes\);[\s\S]*?updatePlayheadDisplay\(displayPlayhead\(\)\);/, "split timeline lanes must receive the current playhead after they are rebuilt");
assert.match(app, /function materializeEvaluatedViewForEditing\([\s\S]*?const baseFrame = interpolateStateAtTime\(evaluatedViewState\.motion\.playhead\);[\s\S]*?else if \(sourceId === "camera"\) \{[\s\S]*?state\.camera = clone\(baseFrame\.camera\);[\s\S]*?state\.items = clone\(visibleFrame\.items\);/, "camera editing must restore the camera without baking actor motion into authored state");
assert.match(app, /function interpolateStateAtTime\(time\) \{\s*return interpolateRenderStateAtTime\(state, time\);\s*\}/, "interactive preview must share the render-state frame evaluator");
assert.ok(app.includes("window.FrisFrameMotionCore?.composeEvaluatedFrameBase"), "app frame evaluation must delegate base frame assembly to motion-core");
assert.ok(motion.includes("function composeEvaluatedFrameBase"), "motion-core must own base frame assembly");
assert.match(app, /const DIRECT_MANIPULATION_THRESHOLD_PX = 5/, "stage selection and direct manipulation need a click threshold");
assert.match(app, /function beginThreeDrag\([\s\S]*?const planeHeight = 0;/,
  "3D camera grabs must project stage position edits onto the ground plane");
assert.match(app, /function updateThreeEditorDrag\([\s\S]*?const planeHeight = 0;/,
  "3D camera movement must keep using the stage ground plane while dragging");
assert.match(app, /if \(drag\.pending\)[\s\S]{0,500}materializeEvaluatedViewForEditing/, "2D click selection must not materialize evaluated poses");
assert.match(app, /if \(threeDrag\.pending\)[\s\S]{0,500}materializeEvaluatedViewForEditing/, "3D click selection must not materialize evaluated poses");
assert.match(app, /else if \(sourceId === "camera"\) \{[\s\S]*?state\.camera = clone\(baseFrame\.camera\);[\s\S]*?state\.items = clone\(visibleFrame\.items\);/, "camera editing must preserve the visible actor frame");
assert.match(app, /function prepareCameraDragPreview\([\s\S]*?state\.camera = clone\(visibleFrame\.camera\);[\s\S]*?dragState\.renderState = visibleFrame;/, "camera dragging must keep evaluated actor motion out of authored item state");
assert.match(app, /if \(drag\.selection\.kind === "camera"\) prepareCameraDragPreview\(drag\)/, "2D camera dragging must use an isolated camera preview");
assert.match(app, /if \(threeDrag\.editor\.kind === "camera"\) prepareCameraDragPreview\(threeDrag\)/, "3D camera dragging must use an isolated camera preview");
assert.match(app, /const visibleState = currentInteractionFrame\(\);[\s\S]*?evaluatedViewState = visibleState;[\s\S]*?renderThreeView\(visibleState, true\);/, "3D camera selection must preserve the evaluated frame already on screen");
assert.match(app, /drag\.renderState\.camera = clone\(state\.camera\);[\s\S]*?draw\(drag\.renderState\);/, "2D camera dragging must render visible actors from the interaction frame");
assert.match(app, /const renderState = threeDrag\.renderState \|\| state;[\s\S]*?renderState\.camera = clone\(state\.camera\);[\s\S]*?renderThreeView\(renderState, true\);/, "3D camera dragging must render visible actors from the interaction frame");
assert.match(app, /function updateActorPoseAxis\([\s\S]*?evaluatedViewState = interpolateStateAtTime\(state\.motion\.playhead\);[\s\S]*?draw\(evaluatedViewState\);/, "live actor pose edits must redraw the current evaluated camera frame");
assert.ok(app.includes("function preserveLiveSourcePreview("), "unkeyed edits must remain visible until the user adds a key");
assert.ok(app.includes("function applyLiveSourceEdits("), "unkeyed edits must survive scrubbing until they are keyed");
assert.match(app, /function preserveItemStructure\([\s\S]*?color: definition\.color \?\? pose\.color,[\s\S]*?shape: definition\.shape \?\? pose\.shape,[\s\S]*?dummyType: definition\.type === "actor"/,
  "keyframe evaluation must preserve current inspector color, shape, and actor dummy type");
assert.match(app, /\.facing-grid"\)\.addEventListener\("click",[\s\S]*?const sourceId = transformLeaderIdForItem\([\s\S]*?materializeEvaluatedViewForEditing\(sourceId\)[\s\S]*?commit\(\{ preserveSourceIds: \[sourceId\] \}\)/,
  "direction presets must edit the visible selected source and keep the result on screen");
assert.match(app, /function nudge\(item, dx, dy, amount\)[\s\S]*?const sourceId = transformLeaderIdForItem\([\s\S]*?materializeEvaluatedViewForEditing\(sourceId\)[\s\S]*?commit\(\{ preserveSourceIds: \[sourceId\] \}\)/,
  "nudge buttons must move the visible selected source instead of an unevaluated base pose");
assert.match(app, /function switchActiveCamera\(profileId\)[\s\S]*?syncActiveCameraProfile\(\);[\s\S]*?liveSourceEdits\.delete\("camera"\);/, "switching cameras must not transfer an unkeyed preview pose between rigs");
assert.doesNotMatch(app, /if \(hit\.kind === "camera"[\s\S]{0,220}switchActiveCamera\(hit\.profileId\);[\s\S]{0,220}return;/, "grabbing an inactive camera must select and drag it in one gesture");
assert.match(app, /\.sort\(\(a, b\) => a\.distance - b\.distance \|\| Number\(b\.entry\.active\) - Number\(a\.entry\.active\)\)/, "overlapping camera rigs must select the closest visible icon before the active rig");
assert.doesNotMatch(app, /autoSaveDraggedPose/, "scene dragging must never auto-update timeline keyframes");
assert.match(motion, /const progress = transition === "smooth" \|\| transition === "linear" \? rawProgress : easedProgress;/, "motion-core source planning must not brake continuous motion at ordinary keyframe boundaries");
assert.ok(app.includes("window.FrisFrameMotionCore?.sourceKeyframeEvaluationPlan"), "app source evaluation must delegate keyframe timing to motion-core");
assert.match(app, /const interpolationProgress = plan\.progress;/, "all moving sources must use the authored linear motion progress");
assert.ok(app.includes("movementProgress: plan.progress"), "camera movement must stay linear while reference-only easing remains separate");
assert.ok(app.includes('$("#keyPathSelect").addEventListener("change", applySelectedPathMode)'), "path selection must immediately update the selected incoming segment");
assert.doesNotMatch(html, /<option value="(?:horizontal|vertical|drone|jib-up|jib-down)">/, "removed camera path types must stay out of the timeline picker");
assert.match(app, /const cameraPathModes = \[\.\.\.actorPathModes\];/, "camera and actor path pickers must use the same reduced path vocabulary");
assert.match(app, /function applySelectedPathMode\([\s\S]*?첫 키에는 진입 경로가 없습니다\.[\s\S]*?reconcileSourcePathConstraints/, "path editing must distinguish the first key and reconcile the selected source");
assert.match(app, /const constrained = constrainPathEndpoint\(previous\.pose, keyframe\.pose, mode, sourceType\);/, "explicit path modes must constrain their authored endpoint");
assert.ok(app.includes("function makeThreeExactPath("), "3D path guides must use the authored sampled path");
assert.equal(app.includes("new THREE.CatmullRomCurve3(points"), false, "3D path guides must not distort authored paths through Catmull-Rom");
assert.match(app, /function cameraOperatorHermiteValue\(/, "camera operator playback must have a continuous pose interpolator");
assert.match(app, /function interpolatePoseFor\([\s\S]*evaluationOptions = null\)/, "camera pose interpolation must receive operator continuity options");
assert.match(app, /plan\.end\?\.operatorContinuity === true/, "only recorded camera operator keys may enable continuous pose interpolation");
assert.match(app, /const authoredPathMode = pathModeForSegment\(segment, "camera"\);[\s\S]*?operatorPose && authoredPathMode === "straight"/, "explicit camera arc/free-curve paths must override direct-shoot spline continuity");
assert.equal(app.includes("proceduralLocomotion"), false, "preview playback must not synthesize walking or running");
assert.ok(app.includes("keyframe.posePreset"), "MCP pose presets must remain attached to authored keyframes");
assert.ok(app.includes("bodyPose: presetBodyPose(posePreset)"), "MCP pose presets must resolve through the existing pose core");
assert.match(motion, /bodyPose: keyedBodyPose/, "motion-core actor playback must use only authored pose keys");
assert.match(motion, /facing: lerpAngleDegrees\(from\.facing, to\.facing\)/, "motion-core actor rotation must interpolate only keyed facing values");
assert.match(app, /function rememberLiveSourceEdit\(sourceId\)[\s\S]*?liveSourceEdits\.set\(sourceId, \{ time, pose: currentPose \}\)/, "scene edits must remain independent even when a key exists at the playhead");
assert.ok(app.includes("function selectedPoseActor("), "pose actions must resolve an actor even after 3D selection changes");
assert.ok(app.includes("function applyActiveCameraTracking("), "camera tracking must survive keyed interpolation");
assert.ok(app.includes("applyActiveCameraTracking(next, renderState)"), "active camera tracking must be restored after shared render-state interpolation");
assert.match(app, /function interpolateStateAtTime\(time\) \{\s*return interpolateRenderStateAtTime\(state, time\);\s*\}/, "state interpolation must enter the shared render-state evaluator before tracking");
assert.ok(app.includes("const actor = current?.type === \"actor\""), "pose mode must select an actor before showing pose controls");
assert.ok(app.includes("function drawStoryboardNote("), "2D plan needs readable local instructions");
assert.ok(app.includes("function drawPlanPathArrows("), "2D plan needs repeated direction arrows");
assert.equal(app.includes("function drawBlockingGuideLegend("), false, "2D plan should not use a detached technical legend");
assert.equal(ids.has("cameraGuideCanvas"), false, "camera preview should not include a guide overlay canvas");
assert.equal(ids.has("cameraFrameMeta"), false, "camera preview should not include technical metadata");
assert.equal(ids.has("videoExportMode"), false, "video export should only create a clean preview");
for (const retiredId of [
  "blockingPlanBtn",
  "blockingPlanPanelBtn",
  "backgroundSheetBtn",
  "backgroundSheetPanelBtn",
  "productionPackBtn",
  "productionPackPanelBtn",
]) {
  assert.equal(ids.has(retiredId), false, `${retiredId} must stay physically removed from shared HTML`);
}
for (const retiredFunction of [
  "exportBlockingPlanImage",
  "exportBackgroundSheetReference",
  "exportProductionPack",
]) {
  assert.equal(app.includes(`function ${retiredFunction}(`), false,
    `${retiredFunction} must stay physically removed from shared app source`);
}
for (const retiredFunction of [
  "buildProductionPack",
  "buildProductionPackPreview",
  "buildAiGenerationBrief",
  "buildSeedancePrompt",
  "buildMotionCsv",
  "buildBlenderPrevisScript",
  "buildBackgroundSheetManifest",
  "buildBackgroundSheetReadme",
  "renderBackgroundStageOverviewBlob",
  "renderBackgroundPlanBlob",
]) {
  assert.equal(app.includes(`function ${retiredFunction}(`), false,
    `${retiredFunction} must stay physically removed from shared app source`);
}
for (const retiredSpatialId of [
  "spatialReferenceStatus",
  "spatialReferenceImageInput",
  "spatialReferencePreview",
  "clearSpatialReferenceBtn",
]) {
  assert.equal(ids.has(retiredSpatialId), false,
    `${retiredSpatialId} must stay physically removed from shared HTML`);
}
assert.equal(html.includes("spatial-reference-panel"), false,
  "in-app background-image reference panel must stay removed");
assert.equal(app.includes("function downloadUrl("), false, "exports must not bypass the preview dialog");
assert.equal(app.includes("function downloadBlob("), false, "blob exports must not bypass the preview dialog");
const retiredMotionPanelId = ["prompt", "Block", "Panel"].join("");
const retiredMotionRuntime = ["prompt", "block", "core.js"].join("-");
assert.equal(ids.has(retiredMotionPanelId), false, "retired motion UI must not be present");
assert.equal(html.includes(retiredMotionRuntime), false, "retired motion runtime must not be loaded");

assert.equal(html.includes("video-analysis-core.js"), false);
assert.equal(app.includes("referenceMedia"), false);
assert.equal([...app.matchAll(/\bfetch\(/g)].length, 1, "network requests must use fetchWithTimeout");

console.log("dom-contract: selectors, script order, retired UI, and request guard passed");
