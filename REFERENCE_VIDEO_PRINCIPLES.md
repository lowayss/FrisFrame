# FrisFrame reference-video principles

FrisFrame's primary motion output is a keyframed previs MP4 that can be used as a video reference for generative video systems such as Seedance.

## Core rule

Only encode motion that the downstream model must follow.

FrisFrame must not invent secondary character motion merely to make the previs look more natural. Unrequested walk cycles, arm swing, body bounce, breathing, cloth motion, or procedural weight shifts can become unwanted constraints in the generated result.

## Motion hierarchy

1. **Camera motion** — preserve position, rotation, lens, tracking, path and timing as accurately as possible.
2. **Actor root motion** — preserve world position, facing, height and timing.
3. **Intentional pose/action** — encode only actions explicitly authored by the user.
4. **Secondary motion** — leave unspecified unless the user explicitly asks for it.

## Runtime invariants

- Preview playback and MP4 export must evaluate the same authored keyframes.
- No procedural walk/run cycle may be inserted implicitly.
- A keyframe without an authored body-pose transition must not gain one automatically.
- Holds and cuts must stay discontinuous by design.
- Camera tracking-target changes must not happen earlier than the authored key boundary.
- Lens values should retain continuous precision during evaluation; rounding belongs in display formatting, not runtime interpolation.
- Reference-video changes should be regression-tested against deterministic frame-state samples before release.

## Product test

A feature belongs in the reference-video path only if it improves downstream adherence to the intended camera/blocking/action. Making the previs itself prettier is not sufficient justification.
