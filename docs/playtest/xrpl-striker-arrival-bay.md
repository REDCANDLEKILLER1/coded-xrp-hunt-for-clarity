# CODED — XRPL Striker Landed: Arrival Bay review (DRAFT / DO NOT MERGE)

## Approved scope
In isolated `?review=walkthrough`, hide the old parked fighter geometry and display the **actual textured Meshy XRPL Striker Landed 3D model** in the same hangar position beside XRPMan. The old fighter hierarchy remains invisibly for `Pilot_Exit` and `Canopy_Hinge`. No changes to normal campaign ships, landing scene, fights, enemies, roster, save writes, free-roam controls, or deck map.

## Asset provenance and integrity
- Meshy task: `29349f2b-57b5-425f-bbba-b4864e3feeb1`, source `Meshy_AI_XRPL_Striker_Landed_1110050339_image-to-3d-texture (1).glb`.
- Original full-detail source: **56,853,620 bytes**, SHA-256 `1bf34af09f6c52afdedca59c435f6654277ffe76e5bbdef6fbc5778adda9cec3`, 550,192 vertices / 1,033,630 triangles; retained privately, **not** committed.
- Mobile runtime variant recovered from the prior project Vercel sandbox: **1,198,600 bytes**, SHA-256 `2f87a54b827c7041f2a0d72b78ab1163959583f0de09458200c031f7971b20ef`; 20,051 vertices / 22,738 triangles, three embedded WebP PBR maps, WebP GLTFLoader texture extension. File: `public/assets/models/xrpl_striker_landed_optimized.glb`.
- The four `build-assets/xrpl_striker_landed_optimized.glb.part*` files are **source transport fragments only** (307200, 307200, 307200, 277000 bytes). `predev`/`pretest`/`prebuild` reassemble one checked GLB into `public/assets/models/`. They are not served to browser, and the generated GLB is gitignored to avoid a redundant committed copy.
- A distinct 7.34 MB offline optimized candidate was generated earlier but **is not the asset in this PR**. Do not compare this PR to its previous hash. This branch uses the verified 1.20 MB mobile LOD, requiring visual acceptance for any lost hull detail.

## Verify on the PR preview
1. After `npm ci`, `npm test`, `npm run build`, open the **PR preview host** plus `?review=walkthrough`.
2. See the Meshy Striker, not the old fighter or a 2D image. Inspect blue cockpit, black metallic wings, neon green details, landing gear, nose orientation, floor contact and clear walkable space.
3. Walk around it with touch-and-drag, release to stop, orbit/pinch zoom, open DECK MAP. Confirm no enemy, bolts, weapons or forced combat; XRPMan's existing Run/Idle animation works.
4. Verify portrait and landscape performance, texture decode, loading time, no console 404. Confirm legacy `?review=boarding` still uses original fighter and `Pilot_Exit` is correct.

## Stack / rollback
Main → #145 deck map → #146 peaceful walkthrough → #147 running XRPMan → this draft (#150). PR #148 Clarity is superseded. Rollback: choose base #147 or toggle off the walkthrough-only Striker loader. **No merge without XRPMan approval and real device visual acceptance.**
