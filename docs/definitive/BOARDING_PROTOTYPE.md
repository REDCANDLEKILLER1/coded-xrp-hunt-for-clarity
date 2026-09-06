# Boarding prototype checkpoint

Direct review: `?review=boarding`, isolated section save, starts paused. This is a playable mechanics checkpoint, not the connected opening chapter or final environment art.

Eight adjacent measured deck spaces support actual skinned XRPMan movement, ranged fire from Hand_R, dodge, two finite guard encounters, a two-relay Core with exposure windows, atomic Ledger Shield reward, bridge ownership, crew recruitment, first shop and an optional ability-gated cache. Saved steps are ordered. Dialogue reveals a page before advancing it, guards against the opening input edge and retries failed save effects without closing. A room retry preserves completed rooms and upgrades.

## Played through ordinary controls

The local browser was driven with held keyboard input and actual UI clicks, without changing game state through a console. It was played from the bay through security, Mr Zamn's introduction, engineering, command access, the Core, bridge capture and both initial purchases. The successful Core attempt took about 33 seconds of active fighting after earlier attempts exposed targeting/framing defects. The retry button restored health and the uncleared encounter while retaining earlier room clears. Ledger Shield crossed the low-power bridge field without health loss. Reload retained ownership, crew, shield, purchases and departure readiness.

The return route from bridge through the cleared deck to the optional cache was walked. The first cache interaction granted 100 salvage credits; the second reported it already collected. Transaction tests independently check the balance and receipt.

Native emulated touch sequences passed at 390×844 and 844×390: movement continues with a second finger firing; releasing only the firing finger stops new shots while steering continues; cancelling the remaining pointer stops movement. Landscape sample: shots 34→39 while held, then stayed at 39 after release; position continued from x−4.398 to x−6.504, then stopped after cancellation. This is desktop touch emulation, not a physical phone test.

## Checks and costs

All 41 validator scripts and the TypeScript/Vite build pass. The new validator exercises ordered doors/room transitions, relay target priority, Core exposure, interrupted/retried conversations, save failure rollback, capture/crew/shield transactions, purchases, duplicate rewards and reload. Existing validators are retained.

No new model or texture downloads in this checkpoint: it consumes the already registered 3,597,232-byte XRPMan. The graybox deck and security machinery use shared geometry and instancing. Brief cleared-bridge observations were 27–32 draw calls and about 50,200–52,200 visible triangles, with 12 geometries and 6 textures. These are not a soak or peak combat measurements.

Build output: initial JS 251.60 KB (74.04 KB gzip); lazy mesh chunk 692.75 KB (179.97 KB gzip); CSS 19.71 KB (4.98 KB gzip). The deferred chunk still produces Vite's advisory 500 KB warning.

## Remaining before chapter completion

Actual personal-fighter landing, physical canonical Mr Zamn, environment/material detail, refined character animation, integrated normal 2D-to-boarding transition, true mesh-space departure and Earth/portal/Mars continuity. PREPARE DEPARTURE currently saves the outbound briefing; it does not yet launch the new space scene. The normal game still uses its existing handoff. No final art or connected-chapter completion is claimed.
