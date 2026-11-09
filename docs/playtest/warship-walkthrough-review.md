# CODED Warship — free-roam walkthrough preview

This is a **planning-mode preview**, not a campaign combat change. It depends on the interactive deck-map draft branch `gpt/boarding-deck-map-hud-20261109` (PR #145), which remains unmerged.

## What this changes
- New isolated query route `?review=walkthrough` loads the current eight-room Regulatory Warship deck with **zero enemies** and no auto-attacks.
- No onboarding dialogue, damage, combat, objective completions, or production save mutation; no generated battle actors.
- In walkthrough mode, the only visible controls are **DECK MAP** and **RESET VIEW**, plus a tappable minimap.
- Touch and **hold/drag over the floor** to steer XRPMan toward the point under your finger; release to stop. No fixed thumbstick.
- Two fingers on the 3D scene: pinch in/out to zoom, drag horizontally to orbit. Desktop: right-mouse drag orbit, wheel zoom, WASD/arrow movement. Map remains touch/pinch accessible.
- The character **walks or idles** only in this mode. The current grasshopper-like jump is unavailable.
- Doors are open for level scouting; all eight rooms are reachable, without awarding quest progress. The deck map displays all room names for planning.
- The **current legacy XRPMan GLB remains** in this isolated preview. This change does not falsely claim integration of the corrected November 8 Meshy model, which requires a separate verified rig/socket/clip integration.

## Review checklist on phone
1. Open the **branch-specific** preview `?review=walkthrough`. No one should shoot you.
2. Touch and drag on the ground. XRPMan should walk and **stop on release**. No joystick, shooting, jumping, attack or dodge buttons.
3. Two-finger pinch and drag for close-up zoom / orbit; use RESET VIEW.
4. Open DECK MAP. Inspect all 8 rooms. Walk through the seven physical doors and verify the room title and position update.
5. Confirm you can explore Engineering, Shield Cache, Core and Bridge with no combat or locks.
6. Reload into a fresh walkthrough. No campaign rewards or progression should have been granted.
7. Test portrait and landscape. Check tap interception, 2-finger gestures, graphics/frame rate, camera clipping.
8. Verify existing normal `?review=boarding` still spawns its normal roster and uses current combat input. This is **not** a campaign replacement.

## Follow-on decisions (not in this PR)
- Integrate and optimize verified 2026-11-08 Meshy XRPMan GLB with rig, correct walk/idle and attached hand sockets; keep existing GLB for rollback.
- Replace placeholder enemies **only after** user-directed placement during walkthrough and one approved Meshy guard sample.
- Implement encounter trigger and turn-based battle transition in a separate RPG prototype; no forced combat while wandering.
- Extend same exploration/encounter contract to Mars later, preserving Mars progression until separately approved.

## Gate
`npm ci && npm test && npm run build`, Vercel test build, physical phone acceptance, then XRPMan merge approval. No unrelated changes.
