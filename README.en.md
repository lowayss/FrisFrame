# FrisFrame

[한국어](README.md) | **English**

**Keyframe-driven previs for Seedance video reference.**

FrisFrame is a browser/Electron previsualization tool for creating **reference MP4s for Seedance**. Before the final shot is generated, you can author **camera movement, actor blocking, timing, framing, lens changes, and spatial relationships**, then export that information as a video reference.

FrisFrame is **not** an AI video generator. Its role is straightforward:

```text
Build the previs in FrisFrame
        ↓
Export an MP4 containing camera / actor / timing / spatial information
        ↓
Use that MP4 as a Seedance Video Reference
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
Camera + Actor Keyframes
        ↓
Reference Readiness Check
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

## Desktop builds

FrisFrame is built from the same source for both desktop platforms.

| Platform | Build | Output |
| --- | --- | --- |
| macOS | Apple Silicon | `FrisFrame-0.4.0-arm64.dmg` + ZIP |
| Windows | x64 | `FrisFrame-0.4.0-x64.exe` |

GitHub Actions shows two separate native jobs:

- **macOS · Apple Silicon**
- **Windows · x64**

Successful development builds are uploaded as:

- `FrisFrame-macOS-arm64`
- `FrisFrame-Windows-x64`

Version tags such as `v0.4.0` publish both platforms together through GitHub Releases. Future versions keep the same naming pattern with the version number changed.

Production tagged releases are configured to require:

- **macOS:** Developer ID signing + Hardened Runtime + Apple notarization
- **Windows:** Authenticode code signing

Release signing setup is documented in [`SIGNING.md`](SIGNING.md).

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

### Seedance reference export

- Clean H.264 MP4 previs
- CFR frame sampling at exact `1 / fps` intervals
- H.264 / `yuv420p` / fast-start output
- Selected export range
- Batch reference export for multiple cuts
- ZIP package with per-cut MP4 files and manifest
- Safe filenames even with duplicate cut names or special characters

### Reference Readiness

Before batch export, each cut is classified as:

- **READY** — safe to export
- **REVIEW** — exportable, but worth checking
- **BLOCKED** — excluded from batch encoding until fixed

Checks include invalid tracking targets, duplicate/out-of-range keys, broken export ranges, camera value errors, frame-grid timing, long reference duration, authored discrete events that would otherwise fall after the final CFR sample, and whether the final changed camera framing is directly visible for enough CFR frames.

## Seedance reference philosophy

FrisFrame treats the MP4 as a **camera, spatial, and timing reference for Seedance**, not as a finished animation.

Priority order:

1. **Camera motion** — most precise
2. **Actor root motion** — position, height, facing, speed
3. **Explicit intentional action / pose**
4. **Secondary motion** — normally omitted

This is why a FrisFrame previs can look deliberately simple. What matters more is that the information sent to Seedance is clear and that unnecessary motion signals are minimized.

See [`REFERENCE_VIDEO_PRINCIPLES.md`](REFERENCE_VIDEO_PRINCIPLES.md) for the full contract.

## Preview and export consistency

Preview playback and exported MP4 frames share the same reference evaluation rules.

Regression tests protect:

- camera position / height
- pan / tilt
- focal length
- tracking target timing
- actor root position / facing
- authored pose hold
- 24 / 60 fps timing
- preview ↔ export numerical parity

The goal is simple: **what you author at time `t` should be what the exported Seedance reference frame represents at time `t`.**

## Run locally

FrisFrame can also run as a local browser app with MP4 encoding support.

```bash
python3 server.py --port 8766
```

Open:

```text
http://127.0.0.1:8766/
```

Run the full project validation suite with:

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

The packaged app includes its local Python server runtime and FFmpeg, so users do not need to install them separately.

## Documentation

- [한국어 README](README.md) — Korean project overview
- [`docs/USER_GUIDE.md`](docs/USER_GUIDE.md) — detailed usage guide
- [`REFERENCE_VIDEO_PRINCIPLES.md`](REFERENCE_VIDEO_PRINCIPLES.md) — Seedance reference-video design contract
- [`REFERENCE_PROMPT_GUIDE.md`](REFERENCE_PROMPT_GUIDE.md) — Korean guide for Seedance / Higgsfield / Runway reference prompts
- [`MAINTENANCE.md`](MAINTENANCE.md) — code ownership, runtime boundaries, and maintenance notes
- [`SIGNING.md`](SIGNING.md) — macOS / Windows production signing setup
- [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) — bundled third-party software notices

## Project status

FrisFrame is currently focused on improving the **accuracy and reliability of Seedance reference MP4s** rather than continuously adding new features.

Current priorities include:

- Reference MP4 timing accuracy
- Predictable camera motion
- Actor root-motion transfer accuracy
- Save / recovery reliability
- Batch Export safety
- Windows / macOS desktop stability
- Security and regression-test coverage

External video analysis and arbitrary external 3D asset importing are not part of the current core scope.

## License

MIT License. See [`LICENSE`](LICENSE).
