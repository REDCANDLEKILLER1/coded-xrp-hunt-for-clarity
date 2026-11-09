# CODED — Regulatory Warship interactive deck map (review build)

## Scope
Add a **read-only, phone-first full-deck map** to the existing 3D boarding HUD. The canonical source stays `src/game/definitive/boarding-deck.json`: eight rooms, seven doors, +Z north toward the Bridge, +X toward Shield Cache. No room coordinates, quest flags, combat rules, saves, asset manifests, or Mars code changed.

## Controls
- Open from **MAP** in boarding top controls or tap the existing minimap. Desktop shortcut **M**.
- Tap a numbered room or its list row for details; unknown sectors stay **UNEXPLORED** until visited.
- Drag to pan, two-finger pinch or scroll wheel to zoom, plus/minus buttons for accessible zoom, FIT resets.
- Close with **CLOSE ×**, **M**, or **Escape**. Closing returns to the exact same 3D position and prior paused state; map **cannot teleport**.
- Opening the map blocks normal boarding input and holds the simulation; opening is disabled while another modal conversation/shop or capture cinematic is active.

## HUD data sources
- Positions and door connections: `BoardingLayout` from `boarding-deck.json`.
- Current position: the live actor transform.
- Discovered: `CampaignSave.snapshot.visitedRooms`.
- Locked: `BoardingQuest.lockReason`.
- Cleared: `BoardingQuest.isClear`.
- Current objective: `BoardingQuest.objective`.

## Playtest checklist
1. Visit a PR-specific Vercel preview with `/?review=boarding`. Complete or dismiss the opening dialogue.
2. Open MAP and check the current Arrival Bay highlight. Verify all 8 **room shapes and 7 connectors** are represented, but inaccessible sectors are unnamed.
3. Pinch in/out, drag, select an unknown sector, use +/− and FIT. On phone, verify portrait/landscape text and touch targets.
4. Close. Verify XRPMan remains at the same position and the previous pause state is preserved.
5. Clear a room and progress to Security Relay; open map and verify discovery and lock indicators updated without granting progress.
6. Verify MAP cannot open over dialogue or the shop, and navigating away disposes its listeners.
7. Execute `npm ci && npm test && npm run build`; verify `validate-deck-map.mjs`.

## Deferred
- No replacement of PR #144 isolated Arrival Bay tactics prototype.
- No room resizing, guard or model change, encounter transition, 3D ship floor expansion, NPCs, travel automation, or Mars map implementation.
- Mars should **reuse the map presentation interface**, but must have a distinct canonical Mars surface-zone definition and mission/fog logic in a separately approved PR. Do not reuse ship-world coordinates for Mars.
- The proposed multi-deck Warship expansion remains unapproved; this slice reflects only **current playable Deck A**.

## Acceptance
Draft PR only; no merge without XRPMan approval and independent mobile testing.
