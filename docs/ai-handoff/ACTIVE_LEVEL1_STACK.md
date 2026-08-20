# CODED Level 1 Active Stack

**Updated:** 2026-08-19

This file is the compact live resume note. Read `CURRENT_STATE.md` and `LEVEL1_CANON_LOCKS.md`, then verify the actual PRs/branches before changing code.

## Active stack

### PR #45 — L1-A Mission Director Foundation
- Branch: `gpt/level1-a-mission-director`
- Base: `main`
- Head: `af1c919c8c8bb08255c8340c6c85d88123465600`
- Status: open draft, mergeable when last checked
- GitHub Build Check: success on exact head
- Vercel: success on exact head
- `npm test`: not independently executed/claimed
- Scope: Earth first campaign node, explicit 12-act mission data, MissionDirector, mission registry/validation, Test Mode preserved
- No merge without XRPMan approval

### PR #47 — L1-B Local Mission Checkpoint Foundation
- Branch: `gpt/level1-b-checkpoints`
- Base: `gpt/level1-a-mission-director`
- Head: `c1b140a1012e7a28c20d417ffdcd6a243d75110e`
- Status: open draft, stacked on PR #45
- Vercel: success on exact head
- GitHub Build Check does not run while PR base is a feature branch
- `npm test`: not independently executed/claimed
- Scope: v3 local save migration, coarse checkpoint snapshots, resume/restart UI, deterministic mission-act resume, four Earth checkpoint declarations
- No merge before L1-A and no merge without XRPMan approval

### PR #48 — L1-C Authored Earth Opening Encounters
- Branch: `gpt/level1-c-space-encounters`
- Base: `gpt/level1-b-checkpoints`
- Head: `efd863a82b6507037ea8bb0e80f103b812c9e3d2`
- Status: open draft, stacked on PR #47
- Vercel: success on exact head
- GitHub Build Check does not run while PR base is a feature branch
- `npm test`: not independently executed/claimed
- Scope:
  - authored Orbital Approach, Fog Belt, Ledger City, and Defense Grid air formations
  - deterministic formation sequencing instead of score/random progression for Earth campaign
  - mission HUD objective/formation progress
  - Deep Space Lane -> Ledger City stage transition
  - earns `earth.orbital_gate` after Fog Belt
  - earns `earth.defense_grid` after current air-only Defense Grid skeleton
  - mission state now owned by runtime
  - Arcade Test Run preserves original random score/wave system
- Intentional stop: campaign waits at `gary_fog`; no Guardian implementation/reward yet
- No merge before L1-A/L1-B and no merge without XRPMan approval

## Exact next build step

Start **L1-D1 — immediate Level 1 asset bank** from PR #48 head.

Keep it just-in-time and asset-only:
- inspect current manifest first to prevent duplicates
- bank **Fast Scout** and **Armored Space Mine** only if they are not already present under usable manifest IDs
- technically trim/alpha-clean/resize/optimize for runtime as needed
- update manifest in same PR
- no gameplay logic in D1
- do not bank Regulatory Warship or Fog Breaker yet; they belong with their later gameplay phases unless a manifest dependency requires otherwise

Then **L1-D2 — Mixed Air/Ground Threats** will:
- introduce Fast Scout alone before mixed formations
- introduce Armored Space Mine alone before mixed formations
- introduce Basic Turret alone before combining with air threats
- add Cannon Turret later in the act
- move `earth.defense_grid` checkpoint earning to the end of the completed mixed-threat grid
- preserve flight movement/fire/collision feel

## Audio lane

Audio is planned but does not block these phases. Add SFX just-in-time after each behavior is stable. See `AUDIO_PLAN.md` and `ASSET_AUDIO_ROADMAP.md`.

After each new stacked PR, update this note.
