# CODED — XRPMan corrected Nov08 model and running clip (walkthrough review)

## Intent
Use the **corrected November 8 Meshy Neon Sentinel model** for **Warship free-roam preview only**. Run while holding/dragging touch; return to a stationary pose on release. No new attacks, enemies, campaign unlocks, or normal boarding behavior. This stacks on PR #146, which stacks on PR #145.

## Provenance / fidelity
- Source: `Meshy_AI_Neon_Sentinel_20261108_animated_mixamo_All_animation.glb`
- Source SHA-256: `d2e38c81dcf3bf4a9c44bb1dd759c4cbf9d473264d9ee4e8bed1911dc51b0ad5` (15,160,552 bytes).
- **Not** the older October 30 four-clip candidate.
- New runtime GLB: `xrpman_sentinel_nov08.glb` (3,920,284 bytes, SHA-256 `de9143986d77a5b9671c748f4ee16d59f5e1d33d0b95da0f372a95118ef06944`).
- Preserved original skinned mesh bytes and 66-joint skeleton, repacked 1K albedo/normal/metallic-roughness PBR maps, retained full **Running** and **Walking** animation tracks.
- Added `Idle` as a *sampled stationary frame from Walking* (0.533 seconds), not misrepresented as a newly motion-captured animation. More natural idle is future animation scope.
- Seven integrity-checked Git source fragments under `build-assets/` exist solely because the GitHub integration rejected a single 3.9 MB upload. `npm run build` reconstructs and verifies **one** GLB in public/assets; Vite serves one GLB URL to the browser. Segments are never public runtime assets.
- Original `models.xrpman` remains unchanged as rollback for campaign boarding, hub, Mars, and Bullion.

## Functional scope
- Isolated entry `?review=walkthrough` now requests `models.xrpman_sentinel_nov08`; main/campaign continues loading `models.xrpman`.
- Native 1.70m Meshy height is scaled to approximately 1.93m for existing floor/camera.
- Walking gesture navigates at 4.2 m/s with the **Running** animation; stopping plays `Idle`. No jump / attacks / combat UI.
- All eight existing Warship rooms, deck map, orbit/zoom, peaceful inspection remain as implemented in #146.

## Gates
- `npm ci`, `npm test`, `npm run build`.
- `pretest`, `prebuild`, `predev` verify source fragments before writing the generated GLB. Both build and test run `validate-sentinel-nov08.mjs`, checking hash, embedded images, 66 joints, animations, actual GLTFLoader decode, and nonzero hip movement.
- **Phone acceptance** required before any merge: no white/invisible model, good material rendering, human proportions, aligned feet, smooth run/stop transition, natural camera tracking, no stutter in portrait or landscape.
- Keep this **draft** until real device feedback. No claims of completed phone visual validation.

## Deferred
- Animation retarget and real hand muzzle sockets for combat, movement speeds/slow walk toggle, attacks and enemy encounters, new 3D terrain, Mars adaptation.
- **Do not globally replace** the original model until every boarding/hub/Mars/Bullion gameplay contract passes an independent audit.
- Rollback: review `gpt/warship-free-roam-20261109` or set the walkthrough model choice back to `xrpman`; current production model unaffected.
