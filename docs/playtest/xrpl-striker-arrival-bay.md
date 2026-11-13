# CODED — XRPL Striker high-fidelity Arrival Bay review (DRAFT / HOLD)

## Why replaced
XRPMan inspected the prior 1.20 MB / 22,738-triangle GLB on Android and rejected it: severe body deformation, melted-wax appearance, lost original details. **Do not reuse that mobile LOD.** Automated HTTP 200, asset hash and build alone are not visual acceptance.

## Higher-detail asset
- Source: original textured Meshy `XRPL Striker Landed` task `29349f2b-57b5-425f-bbba-b4864e3feeb1`. Raw GLB `Meshy_AI_XRPL_Striker_Landed_1110050339_image-to-3d-texture (1).glb`, 56,853,620 bytes, SHA-256 `1bf34af09f6c52afdedca59c435f6654277ffe76e5bbdef6fbc5778adda9cec3`, 1,033,630 triangles.
- Master original is reported archived in private Google Drive, with matching checksum verified by the upload lane; **GPT has not independently fetched the private archive**. No raw 56.85 MB source in public repo.
- New runtime model: `public/assets/models/xrpl_striker_landed_optimized.glb`; 4,004,112 bytes, SHA-256 `8e7342d021d14fece961d23b92c199c61045998cee0bab51b98f731bc15c6e4e`. 258,404 triangles; 156,084 vertices; 3 embedded PBR WebP maps (albedo, normal, metallic/roughness) kept at up to 2048 px. Built by constrained mesh simplification from original, not voxel clustering, and geometry compressed with Meshopt high-precision 16-bit positions, 12-bit normals, 14-bit UVs. **Triangle reduction ~75%, geometry/UV detail much higher than rejected version**.
- The intermediate 10.46 MB GLB had been rendered via VTK from a 2K PNG/JPEG-map representation, showing cockpit/wings/landing gear details; the Meshopt-compressed 4.00 MB file has independently passed a real Three.js mesh decode and must be visually inspected on the in-game Android walkthrough before acceptance.
- 14 integrity-checked binary fragments in `build-assets/` reconstruct **one** GLB in predev/pretest/prebuild. Fragment inputs stay outside `public/`; generated GLB gitignored. Legacy old fighter remains available invisibly as Pilot_Exit/Canopy_Hinge carrier and rollback.

## Scope and gates
- ONLY `?review=walkthrough`: peaceful eight-room hangar, no enemies, no combat, same deck map, camera, movement, XRPMan Nov08 animations, landing slot and pilot exit.
- `npm ci` / `npm test` / `npm run build` against exact PR head. There is a known inherited npm ci lockfile optional-dependency mismatch; do NOT edit lockfile in this scoped PR. Report it separately.
- Phone acceptance: actual ship silhouette, black hull / green `#00FF00` accents and blue cockpit, wings, underside plating, gear, floor contact, proper size, map/touch/zoom/orbit, load time, both portrait and landscape. Screenshot from at least 2 angles and inspect against the original Meshy reference. Do not merge until XRPMan approves.
- Stacked PR: main → #145 deck map → #146 peaceful walk → #147 Nov08 Sentinel XRPMan → this #150. #148 Clarity prototype superseded. Never merge without user approval.
