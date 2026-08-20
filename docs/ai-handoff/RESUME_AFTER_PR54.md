# CODED Level 1 Resume — after PR #54

**Date:** 2026-08-20 UTC

Read this file first if resuming in a new chat. Then verify actual PR heads/statuses before writing code.

## Locked canon

- Planet 1 is Earth and Earth is under direct enemy attack.
- Protect the existing responsive fighter controls/fire feel.
- Gary Fog is the first Guardian and rewards permanent fighter tech `fog_breaker_pulse`.
- The Regulatory Warship is the Level 1 exterior capital-ship boss.
- Disable the Regulatory Warship by destroying systems; do not explode it.
- No shuttle. Player flies the existing combat fighter directly into the opened hangar/breach.
- XRPMan exits the fighter later and fights through the interior.
- Interior final objective is Ledger Defense Core.
- After interior victory, player captures/keeps Regulatory Warship as the future interplanetary capital ship.
- Progression tracks: combat fighter / XRPMan / capital ship.
- No NFT/wallet/payment/blockchain work in Level 1.
- No merge without XRPMan approval.

## Current stacked PRs

- PR #45 — L1-A Mission Director Foundation.
- PR #47 — L1-B Local Mission Checkpoints.
- PR #48 — L1-C Authored Earth Opening Encounters.
- PR #49 — L1-D1 Fast Scout + Armored Space Mine asset bank.
- PR #50 — L1-D2 Progressive mixed Earth threats.
- PR #51 — L1-E Gary Fog + permanent Fog Breaker + music-led cinematic buildup.
- PR #52 — L1-F1 Regulatory Warship runtime asset bank.
- PR #53 — L1-F Final Assault + subsystem-based Regulatory Warship fight.
- PR #54 — L1-G Direct Fighter Boarding Transition.

All are draft/open/stacked. Do not merge without XRPMan approval.

## PR #53 behavior

Branch: `gpt/level1-f-warship`

- Final Assault runs through Regulatory Outpost authored encounters.
- Gary reward must be used to clear the post-Gary fog lock.
- Regulatory Warship has six targets:
  1. port gun battery
  2. starboard gun battery
  3. protected shield relay
  4. port engine node
  5. starboard engine node
  6. hangar/command defense
- Required order: batteries -> Fog Breaker exposes relay -> relay -> engines -> hangar defense -> disabled.
- Warship is disabled, remains visible, saves `earth.boarding_lock`, then mission advances to boarding.
- Exact L1-F runtime head at PR creation: `6164eac93c8034a0682f0167f01021dd8a4ddbc4`.
- Exact-head Vercel/TypeScript+Vite build was green before PR creation.
- `npm test` was not independently executed/claimed in this environment.

## PR #54 behavior

Branch: `gpt/level1-g-boarding`

- Adds `DirectBoardingDirector` with deterministic opening/capture timing.
- Hangar/breach opens over 2.4 seconds.
- Player must fly the live fighter into the aperture and remain there for 0.65 seconds.
- Leaving the aperture cancels capture safely.
- Disabled warship drifts only into reachable boarding range; fighter movement/clamp/fire constants are untouched.
- Uses a procedural transparent hangar overlay because the source bundle currently has no dedicated hangar/breach runtime image.
- On successful entry, flight engine suspends and emits `coded:boarding-complete` for the future on-foot engine.
- Boarding checkpoint resume reconstructs the disabled warship and same boarding sequence.
- L1-G does not pretend the on-foot engine exists yet.
- Verify final PR #54 Vercel status before merge consideration.
- `npm test` is not independently claimed as executed in this environment.

## Music canon

### Level 1
- Track: `Neon Horizon Defense`
- Artist metadata: redcandlekiller
- Source duration: 157.008 seconds / 2:37.008
- Treat as canonical Level 1 music.
- Game already emits `coded:music-cue` for `level1`.

### Gary / boss music
- User says a separate first-boss track was added to project sources.
- At last reliable inspection only duplicate copies of `Neon Horizon Defense` were visible; do not mislabel that duplicate as boss music.
- Recheck sources later for the distinct boss file.
- Game already emits music cues for `boss_gary_fog`, `boss_regulatory_warship`, `warship_disabled`, and `silence`.
- AudioDirector/audio binary import remains a separate small phase.

## Exact next build step

Next phase is **L1-H1 / H2 — XRPMan on-foot prototype and core**.

Before generating a large sprite library:
1. lock the on-foot base scale and camera geometry;
2. use the supplied XRPMan character sheet as canonical identity reference;
3. create only the minimum top-down and side-view runtime sprites needed for the controller prototype;
4. prove responsive movement, Liquidity Blast, one test enemy, collisions, room transition, and defeat->boarding checkpoint behavior;
5. keep the full 6-8 room warship interior for L1-I after the controller feels good.

Do not build the full interior or large sprite library before the on-foot controller is proven.
