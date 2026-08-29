# FrisFrame

[한국어](README.md) | **English**

**Keyframe-driven previs for Seedance Video Reference.**

FrisFrame is a browser/Electron previsualization tool for creating **reference MP4s for Seedance**. Before the final shot is generated, you can author **camera movement, actor blocking, timing, framing, lens changes, and spatial relationships**, then export that information as a video reference.

FrisFrame is **not** an AI image/video generator, image-understanding service, or final Seedance prompt generator.

```text
Build the previs in FrisFrame
        ↓
Export reference/current + first/end frames and the previs MP4
        ↓
Create any final image assets in external generation tools
        ↓
Use the previs MP4 as Seedance Video Reference
        ↓
Seedance generates the final shot
```

The goal is not to make the previs itself look natural or cinematic. The goal is to produce a **clean, controllable reference MP4 containing only the motion and spatial information Seedance needs**.

[![Quality and security](https://github.com/lowayss/FrisFrame/actions/workflows/quality-security.yml/badge.svg)](https://github.com/lowayss/FrisFrame/actions/workflows/quality-security.yml)
[![Desktop builds](https://github.com/lowayss/FrisFrame/actions/workflows/desktop-builds.yml/badge.svg)](https://github.com/lowayss/FrisFrame/actions/workflows/desktop-builds.yml)

## What FrisFrame is for

```text
Storyboard / Shot Plan
        ↓
2D + 3D Blocking
        ↓
Camera + Actor + Prop Keyframes
        ↓
Frame-accurate H.264 MP4 Previs
        ↓
Seedance Video Reference
        ↓
Final Seedance-generated Shot
```

FrisFrame is built around a simple principle:

> **Show only the motion Seedance needs to reference. Leave natural secondary motion and final visual expression to Seedance.**

That means camera motion can be authored precisely, while actor movement stays intentionally sparse. FrisFrame does **not** automatically add walk cycles, arm swing, body bounce, breathing, or other secondary animation unless that motion is explicitly authored.

## Two authoring paths

### Manual

Build the stage, actors, props, cameras, lenses, and keyframes directly in FrisFrame. The same project can move between 2D/3D blocking and timeline editing before exporting the previs MP4.

### MCP-assisted

An external MCP client may interpret a reference image and natural-language direction, then send **explicit stage/camera/keyframe commands** to FrisFrame. Vision/language reasoning belongs to the MCP client; FrisFrame itself never calls an AI API.

MCP output is ordinary FrisFrame project data and ordinary keyframes, so the result can be refined manually in the desktop UI. Manual and MCP edits share the same project revision contract to avoid silently overwriting newer work.

The deterministic MCP surface supports project reads, stage layout operations, explicit motion timelines, motion macros, and a combined previs-plan operation. Macros such as orbit, dolly+zoom, jib, actor follow, two-actor approach, and subject movement expand into editable ordinary keyframes.

## Desktop builds

FrisFrame is built from the same source for both desktop platforms.

| Platform | Build | Output |
| --- | --- | --- |
| macOS | Apple Silicon | `FrisFrame-0.4.0-arm64.dmg` + ZIP |
| Windows | x64 | `FrisFrame-0.4.0-x64.exe` |

GitHub Actions runs separate native jobs for **macOS · Apple Silicon** and **Windows · x64**. Successful development builds are uploaded as `FrisFrame-macOS-arm64` and `FrisFrame-Windows-x64`.

Production tagged releases are configured to require Developer ID signing + Hardened Runtime + Apple notarization on macOS and Authenticode signing on Windows. See [`SIGNING.md`](SIGNING.md).

### Packaged MCP executable

Desktop packages include a dedicated **stdio MCP executable** alongside the local editor server and FFmpeg. Users do not need a separate Python installation.

- macOS app bundle: `Contents/Resources/runtime/mcp/frisframe-mcp`
- Windows app: `resources/runtime/mcp/frisframe-mcp.exe`

The MCP process resolves the same FrisFrame managed-project database used by the Electron application. Register that executable as a stdio MCP server command in the external MCP client.

## Core features

### Storyboard and shot planning

- Scene and cut organization
- Action, dialogue, directing notes, and review state
- A/B shot versions
- Continuity checks between cuts

### 2D / 3D blocking

- Camera, actor, prop, and environment placement
- Metric world scale
- 3D camera framing preview
- Multi-camera setup and comparison
- Actor / camera spatial relationship checks

### Keyframe timeline

- Camera, actor, and prop tracks
- Frame / 0.1s / 0.5s / 1s snapping
- Copy / paste / multi-select / range retiming
- `Smooth`, `Linear`, `Hold`, and `Cut` transitions
- Frame-accurate timestamp precision

### Camera reference control

- Dolly In / Out
- Truck Left / Right
- Pedestal Up / Down
- Arc Left / Right
- Follow Actor
- Free-curve camera paths with near-constant travel speed
- Continuous focal-length interpolation
- Destination-boundary tracking target changes
- Smooth multi-key camera runs without braking at every internal key

Camera presets are **keyframe macros**, not a separate animation system. The generated keys behave exactly like manually authored camera keys.

### Actor reference control

- Root position, height, facing, and timing
- Explicit authored pose states
- Smooth or linear root-motion timing
- Pose hold until the authored destination key

FrisFrame intentionally avoids inventing secondary body motion. Seedance can follow unnecessary motion in a reference too literally, which may make the result look stiff or robotic.

### Core outputs

The desktop UI is focused on the outputs needed by the actual Seedance previs workflow:

- reference/current frame
- first + end frames
- H.264 previs MP4
- exact `1 / fps` CFR sampling
- H.264 / `yuv420p` / fast-start output
- optional advanced MP4 range settings

Legacy internal batch/safety infrastructure may remain for compatibility, but **background-sheet, Production Pack, Reference Prompt, or in-app generative-AI features are not presented as the final workflow**.

### Internal export safety

The MP4/export infrastructure keeps deterministic checks for invalid tracking targets, duplicate/out-of-range keys, invalid export ranges, camera-value errors, frame-grid timing, and overly long references. These checks protect output correctness; they are not a separate user-facing AI/prompt step.

## Seedance reference philosophy

FrisFrame treats the MP4 as a **camera, spatial, and timing reference for Seedance**, not as a finished animation.

Priority order:

1. **Camera motion** — most precise
2. **Actor root motion** — position, height, facing, speed
3. **Explicit intentional action / pose**
4. **Secondary motion** — normally omitted

This is why a FrisFrame previs can look deliberately simple. What matters more is that the information sent to Seedance is clear and unnecessary motion signals are minimized.

See [`REFERENCE_VIDEO_PRINCIPLES.md`](REFERENCE_VIDEO_PRINCIPLES.md) for the full contract.

## Preview and export consistency

Preview playback and exported MP4 frames share the same reference evaluation rules. Regression tests protect camera position/height, pan/tilt, focal length, tracking timing, actor root position/facing, authored pose hold, 24/60 fps timing, and preview/export numerical parity.

The goal is simple: **what you author at time `t` should be what the exported Seedance reference frame represents at time `t`.**

## Desktop performance policy

To keep large scenes responsive, the desktop editor conditionally reuses expensive scene objects instead of rebuilding them every pointer/playback frame:

- static set/furniture and moving prop rigs
- moving actor humanoid rigs and grounding results
- stage grid / border
- camera rig / FOV cone
- authored 3D motion-path geometry and key markers
- camera-preview 3D world
- unchanged timeline/list DOM

Noninteractive floor, grid, path, and decorative helper geometry is pruned from exact 3D Raycaster work while actor/prop/camera bodies, pose joints, gizmos, and move handles remain selectable.

## Run locally

```bash
python3 server.py --port 8766
```

Open `http://127.0.0.1:8766/`.

Run the deterministic MCP server directly from source with:

```bash
python3 mcp_previs_server.py
```

Run the full validation suite with:

```bash
python3 quality_check.py
```

## Build the desktop app

```bash
npm install
npm run check
```

macOS Apple Silicon:

```bash
npm run desktop:build:mac
```

Windows x64:

```bash
npm run desktop:build:win
```

The packaged app includes its local Python editor server, deterministic stdio MCP runtime, and FFmpeg.

## Documentation

- [한국어 README](README.md) — Korean project overview
- [`docs/USER_GUIDE.md`](docs/USER_GUIDE.md) — detailed usage guide
- [`MCP_FIRST_WORKFLOW.md`](MCP_FIRST_WORKFLOW.md) — shared manual/MCP previs workflow
- [`REFERENCE_VIDEO_PRINCIPLES.md`](REFERENCE_VIDEO_PRINCIPLES.md) — Seedance reference-video design contract
- [`MAINTENANCE.md`](MAINTENANCE.md) — code ownership, runtime boundaries, and maintenance notes
- [`SIGNING.md`](SIGNING.md) — macOS / Windows production signing setup
- [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) — bundled third-party software notices

## Project status

FrisFrame is focused on becoming a **fast, deterministic previs authoring tool for Seedance Video Reference**, not on adding in-app generative AI.

Current priorities include reference MP4 timing accuracy, predictable camera motion, actor root-motion transfer accuracy, save/recovery reliability, large-scene 2D/3D performance, manual/MCP project compatibility, desktop stability, security, and regression-test coverage.

External video analysis, in-app generative image/video APIs, and final Seedance prompt generation are outside FrisFrame's core scope.

## License

MIT License. See [`LICENSE`](LICENSE).
