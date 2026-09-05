# FrisFrame 0.6 Reference Space

## Product boundary

FrisFrame does **not** analyze reference images.

Reference-image interpretation belongs to an external model such as GPT, Claude, or Codex. FrisFrame accepts structured spatial observations, reconstructs them in its existing stage coordinate system, and validates the result against camera geometry and scene dimensions.

This preserves the current Camera Operator, keyframe, MP4, and Seedance Video Reference workflow.

## 0.6 priority order

1. Scale Anchor
2. Perspective Calibration
3. Mass Blocking
4. MCP spatial commands

The current implementation keeps deterministic geometry in the shipped spatial/blocking cores and layers MCP commands onto the existing previs server. Do not restore the retired spatial-reference runtime or its old DOM symbols.

## External analysis contract

An external model should return observations, not rendered geometry.

```json
{
  "schema": "frisframe-reference-space",
  "version": 1,
  "source": {
    "widthPx": 1920,
    "heightPx": 1080,
    "label": "reference-01"
  },
  "sourceModel": "external",
  "camera": {
    "focalMm": 35,
    "sensorWidthMm": 36,
    "aspect": 1.7777777778,
    "horizonY": 0.43,
    "distanceM": null
  },
  "anchors": [
    {
      "id": "actor-a",
      "label": "standing actor",
      "axis": "height",
      "physicalSizeM": 1.78,
      "frameFraction": 0.31,
      "confidence": 0.92,
      "source": "external-analysis"
    }
  ],
}
```

`frameFraction` is the measured width or height divided by the full image width or height. Pixel measurements are also accepted when the corresponding image-axis pixel count is supplied.

## Scale Anchor

A Scale Anchor connects a known real-world dimension to its measured image size.

Supported axes in 0.6 are `height` and `width`. Depth is not inferred from a single projected length because rotation can make that result ambiguous.

With a known focal length, an anchor can solve camera-to-anchor distance. With a known distance, an anchor can solve focal length. If the caller explicitly supplies `distance_m`, the MCP calibration path solves focal rather than silently reusing the current FrisFrame lens.

Applied anchors are persisted in the existing `spatialGuide` structure as `scale-height` or `scale-width` anchors. Their measured frame fraction, world position, attached item, confidence, and physical dimensions remain available for later validation.

Screen center `imageX/imageY` is an optional measured observation. Missing X/Y must remain missing; FrisFrame does not synthesize a center or edge value. Explicit normalized `0` is a valid edge-of-frame measurement and must be preserved.

## Multi-anchor perspective consistency

Multiple anchors are useful only when their inputs support a valid comparison. FrisFrame does **not** average unrelated anchors or invent their missing depths.

`check_reference_anchor_consistency` requires at least two Scale Anchors whose real `distance_m` is already known or supplied by the external analysis. For each anchor it independently solves the focal length implied by:

- physical size;
- measured frame fraction;
- real camera-to-anchor distance;
- sensor width and aspect ratio.

It then reports the focal estimate for every anchor, a diagnostic median, maximum deviation, and consistency issues. The median is **diagnostic only** and is never applied automatically (`application_policy: diagnostic-only-no-auto-average`).

This catches common external-analysis errors such as a door depth or actor distance that would imply an 85mm lens while the other anchors imply 50mm.

`apply_reference_space_plan` accepts optional `consistency_anchors`. With the default `require_anchor_consistency=true`, inconsistent anchors stop the plan **before** any project revision is created. The caller can lower or raise `consistency_tolerance_ratio`; the default is 8%.

## Perspective Calibration

The deterministic core supports:

- horizontal/vertical FOV from focal length, sensor width, and aspect ratio;
- focal length from anchor size + frame fraction + distance;
- distance from anchor size + frame fraction + focal length;
- camera tilt from normalized horizon Y;
- horizontal ray angle from normalized image X;
- deterministic 3D world-point → normalized camera-frame X/Y projection using the same FrisFrame pan/tilt convention as the preview camera.

FrisFrame uses negative `tiltDeg` for a downward-looking camera. Therefore a horizon above frame center (`horizonY < 0.5`) produces a negative tilt.

These calculations do not guess scene semantics.

## Applying calibrated camera geometry

`apply_reference_camera_calibration` applies an explicit external Scale Anchor observation to the current cut.

The command can update:

- the target item's `referenceDimensionsM` and `referenceAnchorId`;
- camera focal length;
- camera tilt from a measured horizon;
- camera position along its current radial relationship to the target so the solved 3D distance is respected;
- optional pan to face the target;
- the persisted Scale Anchor and Horizon anchors in `spatialGuide`.

Target dimensions and camera changes are sent through the existing scene-command mutation in one project revision.

### Camera-keyframe safety

If the cut already has camera keyframes, `apply_reference_camera_calibration` is blocked by default. Changing only the base camera under an existing keyed camera path can change the intended previs result.

For a keyed cut, first use `calibrate_reference_camera`, then apply the solved values to explicit camera keyframes with the existing `apply_motion_timeline` tool. `allow_keyframed_base_camera=true` exists only as an explicit override.

A solved distance that would move the camera outside the current stage is rejected instead of silently clamping the camera position.

## Explicit screen-orientation solve/apply

Screen-center X/Y remains a diagnostic observation by default. FrisFrame never rotates the camera automatically just because an X/Y residual exists.

When exact screen placement is intentionally requested, use the separate opt-in path:

1. `solve_reference_camera_orientation` — read-only deterministic inverse solve from target world center + measured `image_x/image_y` to camera pan/tilt. It creates no project revision.
2. Inspect the solved pan/tilt delta and persisted-Horizon consistency.
3. `apply_reference_camera_orientation` — explicitly apply the solved pan/tilt in one project revision.

The orientation solve keeps the current camera position, focal length, sensor width, aspect ratio, and FrisFrame's zero-roll convention. The solution is reprojected through the same camera projection math before it is returned.

Safety rules:

- a cut with camera keyframes blocks base-camera orientation apply by default (`camera-keyframes-present`);
- read-only orientation solve remains available on a keyed cut and must not change revision;
- `allow_keyframed_base_camera=true` is an explicit override only;
- a solved tilt that conflicts with a persisted Horizon observation blocks apply by default (`reference-horizon-conflict`) before a revision is created;
- `allow_horizon_mismatch=true` is an explicit override only;
- after a Horizon override, normal Reference Space validation is expected to report `REVIEW` with `horizon-mismatch` because Horizon remains a blocking observation.

Exact screen reframing intentionally remains separate from `apply_reference_space_plan`. The atomic plan owns camera calibration + mass application; screen orientation follows the explicit solve → inspect → apply workflow.

## Reference Space validation UI

Reference Space validation remains available to explicit MCP/headless callers and is not installed as a default user-facing panel. No second spatial runtime or extra static loader is used.

The panel re-checks the current cut against persisted `spatialGuide` data:

- attached anchor target exists;
- anchor world X/Z still matches the item;
- physical dimensions still match;
- Scale Anchor observed frame fraction vs current camera projection;
- optional Scale Anchor screen X/Y observed vs projected target center as diagnostic-only checks;
- persisted Horizon Y vs current camera focal/tilt;
- number of existing camera keyframes.

The panel reports `READY` when blocking Reference Space observations match the current cut and `REVIEW` when they have drifted. Screen X/Y diagnostics do not independently change that status.

MCP `validate_reference_space` performs the same class of deterministic checks for external clients and automatically reuses persisted `scale-*` and `horizon` anchors when explicit observations are not supplied again.

## Mass Blocking

External analysis should describe the large spatial masses first:

```json
{
  "masses": [
    {
      "id": "back-wall",
      "name": "Back wall",
      "world_x_m": 0,
      "world_z_m": -6,
      "width_m": 10,
      "height_m": 4,
      "depth_m": 0.4,
      "rotation_deg": 0,
      "confidence": 0.9
    }
  ]
}
```

The current 36m long-edge stage is used for world-meter mapping. Masses are converted to existing scene objects, keep their actual W/H/D through `referenceDimensionsM`, and are linked back to `spatialGuide` anchors.

Masses extending outside the current stage are rejected by default. The MCP command exposes an explicit `allow_outside_stage` override for deliberate exceptions.

## Atomic full-reference plan

`apply_reference_space_plan` is the preferred MCP entry point when the external model has already finished analyzing one reference image.

It accepts an optional `camera_calibration` object and an optional `masses` array, computes all requested geometry first, then submits the combined operations and anchors through **one** existing `apply_scene_commands` mutation. This means camera calibration, target physical dimensions, horizon/scale anchors, and large spatial masses share one project revision.

If any deterministic solve or validation needed before mutation fails, no partial Reference Space state is written. Camera-keyframe safety remains identical to `apply_reference_camera_calibration`.

Example shape:

```json
{
  "project_id": "abcd1234",
  "revision": 7,
  "scene_index": 0,
  "cut_index": 0,
  "source_name": "reference-01",
  "camera_calibration": {
    "target_id": "actor-a",
    "anchor_id": "actor-scale",
    "axis": "height",
    "physical_size_m": 1.78,
    "frame_fraction": 0.31,
    "horizon_y": 0.43
  },
  "consistency_anchors": [
    {
      "id": "actor-check",
      "axis": "height",
      "physical_size_m": 1.78,
      "frame_fraction": 0.31,
      "distance_m": 14.2
    },
    {
      "id": "door-check",
      "axis": "height",
      "physical_size_m": 2.0,
      "frame_fraction": 0.27,
      "distance_m": 15.8
    }
  ],
  "require_anchor_consistency": true,
  "masses": [
    {
      "id": "back-wall",
      "world_x_m": 0,
      "world_z_m": -6,
      "width_m": 10,
      "height_m": 4,
      "depth_m": 0.4
    }
  ],
  "validate_after_apply": true
}
```

By default the tool performs `validate_reference_space` after the commit and returns that validation result without creating another revision.

Screen orientation is not implicitly folded into this atomic plan. If exact `image_x/image_y` placement is desired, run the separate orientation solve/apply path after inspecting the plan result.

## Implemented MCP tools

Reference Space is an orchestration layer, not an image-analysis engine. The desktop MCP currently exposes:

- `calibrate_reference_camera` — solve distance/focal/FOV/tilt from explicit measurements;
- `apply_reference_camera_calibration` — safely apply the solved camera + Scale Anchor to a cut;
- `apply_reference_mass_blocks` — upsert large spatial masses in world meters and persist their anchors;
- `check_reference_anchor_consistency` — independently compare focal estimates from multiple known-depth anchors without auto-averaging;
- `apply_reference_space_plan` — preferred atomic application of camera calibration + large masses, with optional multi-anchor preflight, in one revision;
- `validate_reference_space` — validate persisted or caller-supplied Reference Space observations against the current cut;
- `solve_reference_camera_orientation` — read-only exact screen X/Y orientation solve;
- `apply_reference_camera_orientation` — explicit one-revision pan/tilt application with keyframe/Horizon guards.

The existing `apply_stage_layout`, `apply_motion_timeline`, `apply_motion_macros`, and `apply_previs_plan` remain unchanged and continue to own general scene/motion authoring.

## Packaged desktop verification

The desktop package verifier exercises the real bundled `frisframe-mcp` executable on both macOS Apple Silicon and Windows x64. It uses isolated managed-project fixtures and verifies:

- orientation tools are present in the packaged `tools/list` manifest;
- read-only orientation solve has near-zero projection residual and does not change revision;
- explicit orientation apply creates exactly one revision and re-solving leaves near-zero pan/tilt delta;
- persisted Horizon conflict returns `reference-horizon-conflict` and does not change revision;
- explicit `allow_horizon_mismatch=true` applies one revision and returns normal `REVIEW` / `horizon-mismatch` diagnostics;
- camera-keyframed cuts return `camera-keyframes-present` and do not change revision;
- read-only solve remains safe on keyed cuts;
- explicit `allow_keyframed_base_camera=true` remains available as the deliberate override path.

This protects against a source-only success where PyInstaller packaging, extension loading, or platform-specific stdio behavior would silently remove the safety contract.

## Compatibility rules

- Keep the 36m long-edge stage model unless the product intentionally introduces a stage-size feature.
- Keep persisted scene objects flat.
- Keep camera/keyframe ownership unchanged.
- Do not add automatic secondary actor motion.
- Do not change MP4 export semantics.
- Do not reintroduce retired spatial-reference runtime symbols.
- Keep Reference Space metadata optional so old projects continue to load.
- Do not silently clamp or invent missing spatial measurements when a deterministic solve cannot be performed.
- Do not auto-average multiple anchor focal estimates into an applied camera value; inconsistent measurements must be surfaced for external review.
- Keep screen-position X/Y diagnostic-only by default; camera orientation changes require the explicit solve/apply path.
- Any Horizon or camera-keyframe override must remain explicit and revision-safe.
