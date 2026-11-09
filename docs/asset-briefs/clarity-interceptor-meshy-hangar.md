# CODED — Clarity Interceptor canonical starter + Meshy hangar asset

**Decision approved 2026-11-09:** only the **Clarity Interceptor** is presented as XRPMan's starting ship. The gameplay key remains `player`. No three-ship selection screen in the public opening. Alternate `xrpl_striker` and `ledger_warden` records/files remain for save compatibility, review rollback and potential future separately approved use; do not delete their references in this slice.

## Source of truth

- 2D source: `public/assets/ships/player.webp`, manifest `ships.player` notes **player_clarity_interceptor**.
- Private high-resolution canon master: `02_BATCH0_CURRENT_SCOPE/ships.player/archive_player_clarity_interceptor.png` from the active-canon asset archive, SHA-256 **60175b29eb14a59d78e79cd3292f14de8ceb9a05259cd3edc325370e2ba4715b** (1,285,762 bytes). This **raw reference image must not be added** to the deploy repo.
- Distinct from `player_clarity_interceptor_alt_source.png` (crescent-wing variant); do not silently replace canon silhouette with that.
- 3D derivatives already in the game include `models.fighter_player`, including `Pilot_Exit` and `Canopy_Hinge` sockets used for pilot transition. These cannot be discarded when substituting an external Meshy render.

## Meshy production job — created

- Meshy task: `01a1c156-cee6-76eb-b446-c96e4a328394`, `image-to-3d`, SUCCEEDED. The generated asset can be inspected and downloaded in the user's connected Meshy 3D studio.
- Reference: exact high-resolution **canonical** Clarity Interceptor image above.
- Generation: geometry `meshy-7.1`, PBR texture `meshy-7`, triangular mesh, target polycount 28,000.
- Raw output downloaded and inspected in a **temporary** Vercel sandbox (not added to repository): 14,776,148 bytes, SHA-256 **338617b404ac6d5f8e94fd4316b27bb261c8b7165a2f08b2cb290eb15abba5df**; one mesh, 27,542 triangles, 3 embedded textures and no animation.
- Mobile optimization recipe demonstrated in sandbox:
  ```sh
  gltf-transform resize clarity_meshy_original.glb clarity_meshy_resized.glb --width 1024 --height 1024
  gltf-transform webp clarity_meshy_resized.glb clarity_meshy_mobile.glb --quality 84
  ```
- That derivative measured **2,214,300 bytes**, SHA-256 **12623993d001c35dc2ec327da00932041d838a7aab0e1fb0f0dc9d9ff313cb65**. The temporary sandbox stopped before this binary was imported into GitHub. It **is not a shipped asset or a game integration**. Regenerate and validate byte integrity before writing a manifest entry.

## Required isolated hangar integration (not yet implemented)

1. Retrieve the Meshy succeeded task's GLB, reproduce and hash the 2.21 MB optimized derivative. Preserve the Meshy master separately from the runtime output.
2. Commit only the verified optimized runtime GLB as `/assets/models/fighter_clarity_meshy.glb` with `models.fighter_clarity_meshy` (type `model`, `bytes`, `sha256`, scenes `['boarding']`).
3. **Use only in `?review=walkthrough`** (stacks on free-roam #146 / character #147). Original `fighter_player` stays loaded for canopy hinge, seat, pilot exit and fallback, but is invisible while Meshy visual is used.
4. Meshy raw coordinates are a top-down art plane with bounding coordinates approximately X ±0.806, Y ±0.952, Z ±0.144. Rotate ~+90° around X to map source long Y to game forward +Z; fit to the measured legacy fighter dimensions, and vertically lift above hangar floor. Verify winding and front orientation visually, don't treat this transform as final until phone review.
5. Preserve `PARKED_HEIGHT`, all current room blockers, hero spawn and deck collision; **no** changes to flight physics, quest/mission saves, weapons, model attachment APIs, Mars, music or normal boarding combat.
6. Verify `npm ci && npm test && npm run build`, real texture decode on mobile WebGL, phone portrait camera, proper landing-foot clearance, no z-fighting/old duplicate hull, and no runtime fetching from Meshy's expiring signed download URL.
7. After user accepts the 3D hangar visual, separately plan replacing the landing cinematic and in-flight hero render. Do **not** assume a generated Meshy visual has authored weapon muzzles, canopy pivot or working animations.

## Status / checkpoint

**Canonical ship: LOCKED by user.** Meshy first model: **GENERATED, visual/3D QA pending**. Hangar integration: **NOT DONE / no preview**. Branch under development; never merge without XRPMan approval. Old `fighter_player` is the reliable rollback.
