# Vendor NPC tier — proof of budget

**Prototype. Not production, not enrolled in the manifest, not loaded by any scene.**
It exists to answer one question with measurements instead of estimates: what does
a populated market actually cost?

Built: 2026-09-20. Blender 4.3.2, headless.

```
blender --background --python scripts/build-vendor-npc.py -- --directory <out>
```

Inputs are tracked: the script reads `public/assets/models/xrpman.glb` and nothing
outside the repository. Two bakes into clean directories are **byte-identical**.

## Measured

| | vendor prototype | mr_zamn (cast) |
| --- | --- | --- |
| encoded bytes | **32,232** | 3,253,384 |
| triangles | 156 | 43,654 |
| primitives / materials | 3 / 3 | 9 / 9 |
| images | **0** (no textures) | 3 |
| bones | 36 | 163 |
| animations carried | **none** | 5 |

32 KB is an eighth of the 150–400 KB tier I proposed, because the vendor carries no
textures and no clips of its own — it borrows Idle/Walk/Run from the cast that is
already resident.

## Rig compatibility is derived, not asserted

Matching bone names is not sufficient. The cast's driven bones are separated by
intermediates (`pelvis.L`, `upperleg02.L`, `clavicle.L`, `neck01`–`neck03`), and the
same local rotation applied over a different hierarchy lands somewhere else.

So the skeleton is not rebuilt — it is *pruned from the shipped rig*. The script
imports `xrpman.glb`, discards its mesh, keeps the 16 bones the clips drive plus
every ancestor needed to compose them (36 of 163), and skins original geometry to
what remains. Rest pose, hierarchy and axes are therefore identical by construction.

Verified by driving both skeletons with the **same** `AnimationClip` objects and
comparing world-space joint positions relative to `root`:

| | |
| --- | --- |
| driven bones present | 16 of 16 |
| rest pose worst deviation | **1.676 × 10⁻⁶ m** |
| Idle — worst pose difference | 1.213 × 10⁻⁶ m over 615 samples |
| Walk — worst pose difference | 1.159 × 10⁻⁶ m over 615 samples |
| Run — worst pose difference | 1.166 × 10⁻⁶ m over 615 samples |

Micrometre agreement is float precision, not tolerance.

### Deformation, measured rather than inferred

Bones moving is not skin moving. CPU linear-blend skinning was run over all 312
vertices — the same maths the GPU does:

| clip | channels | peak vertex displacement | vertices displaced >0.1 mm |
| --- | --- | --- | --- |
| Idle | 6 | 23.2 mm | 50.0% |
| Walk | 17 | 858.0 mm | 96.7% |
| Run | 17 | 1456.7 mm | 96.7% |

Idle is subtle by design — 6 channels on head, arms and spine — so a locomotion-sized
threshold reads it as still. It is not: half the vertices move.

### On skin weights

Weights are **not** shared with the cast and do not need to be. The vendor uses rigid
binding, one bone per vertex at weight 1.0. Weights describe how *this* mesh follows
*these* bones; what must agree for a clip to retarget is the skeleton — rest pose,
hierarchy, axes — and that is what was proven above. Rigid binding is also why the
file is small: one influence per vertex instead of four.

## Unique asset payload vs instance cost

These are different and were conflated in my earlier estimate:

- **Unique payload** — 32,232 B, downloaded once, regardless of how many vendors stand
  in the market. Additional instances via a skinned clone download **0 bytes**.
- **Instance cost** — per vendor per frame, and not free:

| | vendor tier | cloned from the cast |
| --- | --- | --- |
| bones per instance | 36 | 163 |
| 6 vendors | 216 bone matrices/frame | 978 |
| triangles per instance | 156 | 43,654 |

A skinned clone of an already-resident cast member is free to *download* — my earlier
"one vendor eats the whole spare" was wrong on that point. The case for a light tier
is per-frame skeleton and draw cost, 4.53× fewer bone matrices and 280× fewer
triangles, not payload.

## Not done, deliberately

No manifest entry, no district registry enrolment, no scene wiring, no residency
accounting. An independently loaded NPC asset must be enrolled before integration;
the existing hero + crew + district calculation does not cover it. The art is a
stand-in — proportions from the rig, three flat materials, no face, no identity.
Making a vendor *recognizable* is a different job from proving one is affordable.
