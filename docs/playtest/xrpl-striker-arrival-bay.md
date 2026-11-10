# CODED — XRPL Striker Landed: Arrival Bay review only (DRAFT HOLD)

This change is NOT TESTABLE until the optimized GLB is committed in the branch at the exact path below. Do not merge an incomplete branch.

## Approved scope
In isolated `?review=walkthrough`, hide the old parked fighter geometry and attach the original textured **Meshy XRPL Striker Landed** visual at the same landed position beside XRPMan. The old fighter hierarchy is retained invisibly for `Pilot_Exit` and `Canopy_Hinge`. This is not a global fighter roster swap. No enemies, attacks, quest mutations, or altered free-roam/map controls.

## Verified provenance
- Meshy task: `29349f2b-57b5-425f-bbba-b4864e3feeb1` (textured SUCCEEDED).
- Source: `Meshy_AI_XRPL_Striker_Landed_1110050339_image-to-3d-texture (1).glb`, 56,853,620 bytes, SHA-256 `1bf34af09f6c52afdedca59c435f6654277ffe76e5bbdef6fbc5778adda9cec3`, 550,192 vertices, 1,033,630 triangles; original source stays private.
- Runtime: `public/assets/models/xrpl_striker_landed_optimized.glb`, 7,337,756 bytes, SHA-256 `a665158b695c3795d3e7cf13b154fdeb6df05fa03294542f09f4929870ded923`, 106,942 vertices, 187,731 triangles, embedded 2K albedo, 1K metallic-roughness and 2K normal maps.
- The runtime geometry was reduced using position-plus-UV voxel clustering; therefore texture seams/wing shape and small details **must be visually reviewed** before approval.

## Required asset handoff
Download the optimized review GLB attachment from the ChatGPT conversation and commit the file to `public/assets/models/xrpl_striker_landed_optimized.glb` on branch `gpt/striker-hangar-replacement-20261110`. Keep the exact bytes and filename. It is below GitHub's normal browser upload limit; no raw Meshy original, JPEG reference or source zips should be committed. Check hash before approval.

## Test gates
After GLB lands: `npm ci`, `npm test`, `npm run build`. Confirm one GLB request with no 404, missing images, external URIs or white texture.

On branch Vercel preview use `?review=walkthrough`; no enemies or combat. Orbit/zoom in portrait and landscape to inspect real 3D hull, blue canopy, green accent, wings, legs, nose orientation, scale, floor contact, and reasonable load time. Walk XRPMan around the ship, stop, and open DECK MAP. The old ship must not appear. Check the normal `?review=boarding` route still uses the legacy fighter and that the pilot spawn is unaffected. Do not merge without XRPMan approval.

## Stack
Main -> #145 deck map -> #146 peaceful walkthrough -> #147 XRPMan Run/Idle -> this draft replacement. #148 Clarity Interceptor is superseded/HOLD.
