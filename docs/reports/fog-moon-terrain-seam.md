# Fog Moon terrain seam — reproducible report

A hard horizontal line runs across the Fog Moon surface scene. This is what I
could measure about it, what I ruled out, and the one question left that needs
someone with the Blender file.

**It is reproducible, it is not a software-rendering artifact, and I could not
prove a cause.** Two likely explanations are eliminated below with the
measurement that eliminated them; the remaining candidate is authored geometry,
which would make it a model question rather than a code one — and possibly
intended.

## Reproducing it

```
npm ci && npm run build
# serve dist/ on any static server, then open:
#   ?review=fog&run=seam
```

Wait for the scene to finish loading — the review route opens paused, so the
frame is deterministic once it has drawn. The line is visible without
instrumentation, roughly a third of the way down a portrait screen.

To measure it rather than eyeball it, take the luminance mean of each row
across a band clear of the HUD panels (x from 38% to 72% of the width, y from
28% to 66% of the height) and look for a row-to-row step.

## What the measurement says

| viewport | row | step in mean luminance (0-255) | above | below |
| --- | --- | --- | --- | --- |
| 393×793 portrait | y=373 | **+7.19** | 143.1 | 150.3 |
| 393×793 portrait | y=377 | **−11.68** | 154.7 | 143.0 |
| 793×393 landscape | y=184 | **+7.55** | 142.2 | 149.8 |
| 793×393 landscape | y=186 | **−14.34** | 152.2 | 137.8 |

A bright 4px band, then a step down to terrain darker than what was above it.
The same feature appears at the corresponding place in both orientations, so it
is fixed in **world space**, not an artifact of the screen aspect.

For scale: the step is 4-6% of full range, which is small in numbers and very
visible in practice, because it is a straight horizontal edge across an
otherwise soft, foggy surface.

## Ruled out: the shadow-map frustum

`FogMoonScene.ts:43` sets the sun's shadow camera to a 38×38 unit box:

```ts
Object.assign(this.sun.shadow.camera,{left:-19,right:19,top:19,bottom:-19,near:1,far:100});
```

The terrain is 480×560 units and `FogMoonScene.ts:51` sets `receiveShadow` on
every mesh, so ground beyond ±19 can never be shadowed. A hard rectangular
boundary is exactly what that produces, and it was my first candidate.

It is not the cause:

- Widening the frustum to ±70 left the line in the same place and reduced the
  step from −11.68 to −7.16 — a contribution, not the cause.
- Rendering with **DETAIL: LOW**, which disables the shadow map outright
  (`GraphicsQuality.ts:8`), left the step at −10.52. Essentially unchanged.

The detail setting has to be applied *before the first frame* to test this. The
scene renders paused, so clicking the DETAIL button after load never produces a
new frame and the screenshot silently shows the old one. Setting
`coded-definitive-graphics-quality` to `low` in `localStorage` ahead of the load
is what actually tests it. I got a false "shadows are irrelevant" result from
the post-load click first.

`BullionReachScene.ts:60` has the same ±23 shadow box over a similarly large
surface, so if the frustum ever does become the visible cause somewhere, that
scene is where to look next.

## Ruled out: z-fighting against the landing apron

`fog_canyon.glb` has a large flat pad, `Cube.001` / "Fog brushed titanium",
whose top face sits at **y = 0.000** across X ±21.9 and Z −43.9..+37.9. Both it
and the terrain are `doubleSided`. Two co-planar double-sided surfaces over
44×82 metres is textbook z-fighting.

It is not the cause, twice over:

- Moving the pad 60mm down (its node translation from −0.07 to −0.13, patched
  in place so the file size and the manifest byte check stay valid) left the
  measured step unchanged.
- The surfaces were never actually co-planar. Decoding the terrain accessor,
  the basalt corridor's flat top is at **y = 0.011**, so the pad's top face is
  already 11mm below it.

## Also ruled out: a step in the terrain itself

Decoding `Grid` (23,217 vertices, with normals), the centre corridor is flat at
y ≈ 0.011 continuously from z=18 to z=38 — straight through where the line
appears. The `yMin` values in that range belong to the canyon walls either
side, not to the floor. So the floor has no height change at the seam.

## What is left, and the question

Three stacked rectangles in `fog_canyon.glb` all end within about 11 metres of
each other, right where the line falls:

| node | material | world Y | world Z extent |
| --- | --- | --- | --- |
| `Cube.001` | Fog brushed titanium | −0.140 .. −0.000 | −43.9 .. **+37.9** |
| `Cube.172` | Fog ceramic edge | 0.000 .. 1.250 | −14.0 .. **+27.1** |
| `Cube.173` | Fog safe #00FF00 | 0.015 .. 0.065 | −12.8 .. **+34.8** |

The remaining candidate is a material or normal boundary where this apron
assembly meets the open basalt — authored geometry, not renderer state, which
is consistent with the line surviving every renderer change I made.

**The question for Astra:** is the apron edge in the Fog Moon canyon meant to
read as a hard line? If it is intended, this report closes as "working as
designed" and the only change worth making is softening it. If it is not, the
fix is in the Blender file, not in the scene code, and the numbers above give a
before/after measurement to check it against.

I did not change the model or the scene to "fix" this. Every experiment above
was reverted; `fog_canyon.glb` and `FogMoonScene.ts` are untouched by this
branch.

## Not a sandbox artifact

Worth stating explicitly, because I have got this wrong here before. This
environment renders WebGL through SwiftShader with no GPU, which makes frame
rate, heat and anything timed off frame rate unmeasurable — I retracted a
"dialogue truncation" finding for exactly that reason. A static shading
discontinuity at a fixed world position is not in that category: it is present
in a deterministic paused frame, at two viewports, at both detail levels.

Real-phone download size, memory, frame rate and heat remain open acceptance
checks that nothing in this environment can settle.
