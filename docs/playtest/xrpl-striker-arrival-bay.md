# CODED — XRPL Striker parked fighter correction (DRAFT, NO MERGE)

## User-reported defects
- Phone screenshot 2026-11-14: parked fighter faces the wrong direction relative to positive-Z boarding approach; wings look malformed / asymmetric.
- Previous 1.20 MB / 22,738-triangle LOD was rejected. Later 4.00 MB / 258,404-triangle LOD still displayed visibly wrong wings.
- Direct inspection of the untouched Meshy GLB confirmed **wing asymmetry exists in the original single-view 3D reconstruction**, before optimization.

## Review-only repair
- Rotated the new Striker from -PI/2 to +PI/2, mapping its native nose -X to the docking approach's +Z. Normal landing/board routes are untouched.
- Reconstructed a **symmetrical wing candidate** by mirroring the more faithful +Z half of the original model about its central longitudinal axis. Centerline triangles are clipped, vertices stitched, normals mirrored and UVs retained. This is a geometry revision and requires user approval after phone inspection.
- New runtime GLB: 8248980 bytes (8.25 MB), sha256 `d305c217eddfe314c17c84f4de65634f0573b6c4329924a1b088cb8c31763aff`, 1067330 triangles, 566879 vertices, 3 embedded WebP PBR texture images up to 2K, Meshopt + quantization. **No polygon simplification** was applied to the mirrored geometry.
- 27 verified Git binary fragments in `build-assets` reconstruct one runtime GLB in `public/assets/models` during predev/pretest/prebuild. The original 56.85MB unoptimized master remains untouched outside the deploy repo.
- Old fighter stays as invisible `Pilot_Exit` / canopy anchor for rollback. No changes to enemies, combat, walking controls, map, scene graph outside walkthrough, or live campaign.

## Acceptance test
Run `npm ci`, `npm test`, `npm run build`; note inherited npm ci optional dependency baseline defect separately. Inspect the exact PR preview `?review=walkthrough` on Android: ship facing inward with nose toward +Z, symmetrical wings from top and rear, landing gear resting on deck, green/blue PBR, free roaming and map working, **no enemies**. If the reconstructed shape differs from concept, reject and iterate on a genuine multi-view reference before merging. The historical concept picture is NOT itself a 3D GLB.

## Scope
PR #150 stacked on #147/#146/#145; draft, **HOLD** pending XRPMan approval. Main unchanged.
