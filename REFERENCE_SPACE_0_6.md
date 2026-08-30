# FrisFrame 0.6 Reference Space

## Product boundary

FrisFrame does **not** analyze reference images.

Reference-image interpretation belongs to an external model such as GPT, Claude, or Codex. FrisFrame accepts structured spatial observations, reconstructs them in its existing stage coordinate system, and validates the result against camera geometry and scene dimensions.

This preserves the current Camera Operator, keyframe, MP4, and Seedance Video Reference workflow.

## 0.6 priority order

1. Scale Anchor
2. Perspective Calibration
3. Reference Overlay / Ghost View
4. Mass Blocking
5. MCP spatial commands

The first implementation slice keeps all new math inside the already-shipped `spatial-scale-core.js` and `scene-blocking-core.js`. Do not restore the retired spatial-reference runtime or its old DOM symbols.

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
  "overlay": {
    "fit": "contain",
    "opacity": 0.45
  }
}
```

`frameFraction` is the measured width or height divided by the full image width or height. Pixel measurements are also accepted by the core when the corresponding image-axis pixel count is supplied.

## Scale Anchor

A Scale Anchor connects a known real-world dimension to its measured image size.

Supported axes in 0.6 are `height` and `width`. Depth should not be inferred from a single projected length because rotation can make the result ambiguous.

With a known focal length, an anchor can solve camera-to-anchor distance. With a known distance, an anchor can solve focal length.

Multiple anchors should be kept as separate observations. Do not average anchors that are clearly at different depths.

## Perspective Calibration

The core supports:

- horizontal/vertical FOV from focal length, sensor width, and aspect ratio;
- focal length from anchor size + frame fraction + distance;
- distance from anchor size + frame fraction + focal length;
- camera downward tilt from normalized horizon Y;
- horizontal ray angle from normalized image X.

These calculations are deterministic. They do not guess scene semantics.

## Reference Overlay / Ghost View

The first slice exposes deterministic `contain` / `cover` overlay fitting and image-normalized ↔ overlay-pixel coordinate transforms.

The UI layer should use these functions later without introducing a second image-scaling implementation. Overlay state must remain a non-destructive inspection aid and must not alter keyframes or exported MP4 frames unless explicitly enabled for a diagnostic capture mode.

## Mass Blocking

External analysis should describe only the large spatial masses first:

```json
{
  "stage": { "width": 36, "depth": 20.25 },
  "masses": [
    {
      "id": "back-wall",
      "label": "Back wall",
      "xM": 0,
      "zM": -6,
      "widthM": 10,
      "heightM": 4,
      "depthM": 0.4,
      "rotationDeg": 0,
      "confidence": 0.9
    }
  ]
}
```

`scene-blocking-core.js` converts those world-meter values into FrisFrame's existing normalized stage coordinates and emits scene-object descriptors using `referenceDimensionsM`. That field is already honored by the current 3D physical-dimension path.

Mass validation currently flags blocks that extend beyond stage bounds and low-confidence observations.

## MCP direction

MCP should stay an orchestration layer, not an image-analysis engine.

Planned command families:

- `set_reference_space`
- `set_scale_anchor`
- `calibrate_reference_camera`
- `set_reference_overlay`
- `apply_mass_blocking`
- `validate_reference_space`

Each command should accept structured measurements from the external model, call the deterministic core, then update the existing scene document. MCP must not invent missing measurements silently.

## Compatibility rules

- Keep the 36m long-edge stage model unless the user explicitly changes it.
- Keep persisted scene objects flat.
- Keep camera/keyframe ownership unchanged.
- Do not add automatic secondary actor motion.
- Do not change MP4 export semantics.
- Do not reintroduce retired spatial-reference runtime symbols.
- Reference-space metadata should be optional so old projects continue to load.
