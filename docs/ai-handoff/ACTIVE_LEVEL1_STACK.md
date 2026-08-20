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
- Scope: authored Orbital Approach/Fog Belt/Ledger City/Defense Grid skeleton, mission HUD, stage transitions, checkpoint earning, Arcade Test Run preserved
- No merge before L1-A/L1-B and no merge without XRPMan approval

### PR #49 — L1-D1 Immediate Threat Asset Bank
- Branch: `gpt/level1-d1-assets`
- Base: `gpt/level1-c-space-encounters`
- Head: `8e3bb3845f28e60c345f45dbf2dbd59b2949d22f`
- Status: open draft, stacked on PR #48
- Vercel: pending at last update; verify exact head before continuing/merging
- Diff: exactly 3 files
- Runtime binary payload: 23,550 bytes total
- Assets:
  - Fast Scout: 95×128 transparent WebP, 9,932 bytes
  - Armored Space Mine: 128×109 transparent WebP, 13,618 bytes
- Manifest entries: `enemies.fast_scout`, `hazards.armored_space_mine`
- No gameplay logic, no orphan files, no raw masters
- No merge before earlier stack and no merge without XRPMan approval

### PR #50 — L1-D2 Progressive Mixed Earth Threats
- Branch: `gpt/level1-d2-defense-grid`
- Base: `gpt/level1-d1-assets`
- Head: `d98e186c5de0d95085108ca8a355a8d2306f5c20`
- Status: open draft, stacked on PR #49
- Vercel: pending at last update; verify exact head
- Diff from D1: exactly 4 files
- Scope:
  - campaign-only Fast Scout and Armored Space Mine definitions
  - authored threat groups can spawn air enemies or hazards
  - Fast Scout taught alone in Fog Belt
  - Basic Turret taught alone in Ledger City
  - Armored Space Mine taught alone in Defense Grid
  - Cannon Turret taught alone before crossfire
  - final Defense Grid group mixes air + ground threats
  - existing hazard movement/fire/collision system reused
  - Defense Grid checkpoint is earned after the full mixed-threat act
  - Arcade Test Run global random bestiary remains unchanged
  - fighter movement/fire/pointer/collision constants preserved
- Intentional stop: after the Defense Grid checkpoint the mission waits at `gary_fog`
- No merge before earlier stack and no merge without XRPMan approval

## Exact next action

1. Verify Vercel status on exact heads of PR #49 and PR #50.
2. If PR #50 compile is green, begin **L1-E — Gary Fog Guardian + Fog Breaker reward** from PR #50 head.
3. Keep L1-E scoped to Gary Fog, reward persistence, and immediate Fog Breaker use. Do not mix Regulatory Warship.
4. Inspect the v16/source assets for the already-planned Fog Breaker icon/VFX before generating anything new.
5. Preserve Gary's readable three-phase identity: aimed pressure -> spread/fog pressure -> fast burst/weak-point finish.
6. Fog Breaker must be a permanent fighter ability, not a numeric-only stat boost, and must matter immediately in the post-Gary final-assault phase later.
7. Audio remains just-in-time; once Gary telegraph timings stabilize, his attack cues/Fog Breaker activation can receive SFX in a dedicated small audio lane.

## Audio lane

Audio is planned but does not block gameplay phases. Add SFX just-in-time after each behavior is stable. See `AUDIO_PLAN.md` and `ASSET_AUDIO_ROADMAP.md`.

After each new stacked PR, update this note.
