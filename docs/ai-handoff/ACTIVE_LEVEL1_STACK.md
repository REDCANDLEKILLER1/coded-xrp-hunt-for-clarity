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
- Assets: Fast Scout 95×128 WebP; Armored Space Mine 128×109 WebP
- Manifest entries: `enemies.fast_scout`, `hazards.armored_space_mine`
- No gameplay logic, no orphan files, no raw masters
- No merge before earlier stack and no merge without XRPMan approval

### PR #50 — L1-D2 Progressive Mixed Earth Threats
- Branch: `gpt/level1-d2-defense-grid`
- Base: `gpt/level1-d1-assets`
- Head: `d98e186c5de0d95085108ca8a355a8d2306f5c20`
- Status: open draft, stacked on PR #49
- Vercel: queued/pending at last update; verify exact head
- Diff from D1: exactly 4 files
- Scope:
  - campaign-only Fast Scout and Armored Space Mine definitions
  - authored air/hazard encounter groups
  - Fast Scout, Basic Turret, Armored Space Mine, and Cannon Turret each taught before mixed pressure
  - final Defense Grid group mixes air + ground threats
  - existing hazard movement/fire/collision system reused
  - Defense Grid checkpoint earned after full mixed-threat act
  - Arcade Test Run random bestiary remains unchanged
  - fighter movement/fire/pointer/collision constants preserved
- Intentional stop: mission waits at `gary_fog`
- No merge before earlier stack and no merge without XRPMan approval

## Current L1-E preparation

- Next gameplay phase: **L1-E — Gary Fog Guardian + Fog Breaker reward** from PR #50 head.
- Keep L1-E limited to Gary, boss reward persistence, telegraphs/readability, and immediate Fog Breaker use.
- Do not mix Regulatory Warship into L1-E.
- Source assets already identified for this phase: Fog Breaker icon, 8-frame Fog Breaker pulse, boss weak-point marker.
- Runtime asset optimization work began, but no L1-E asset PR is complete yet. Verify branch state before continuing.
- Preserve Gary's readable three-phase identity: aimed pressure -> spread/fog pressure -> fast burst/finish.
- Permanent boss reward must be idempotent and cannot be farmed by checkpoint reload.

## Canonical Level 1 music

User supplied the Level 1 track in project sources:
- title: **Neon Horizon Defense**
- artist metadata: **redcandlekiller**
- source file: `Neon Horizon Defense.mp3`
- measured duration: **157.008 seconds (2:37.008)**
- source size inspected: **3,652,031 bytes**
- integrated loudness measured: approximately **-12.3 LUFS**
- true peak measured: approximately **-1.4 dBFS**

Treat this as the **canonical Level 1 background music source**. Do not replace it with stock music. Create a separate small audio-runtime PR after gameplay timing is stable. The runtime treatment may use an optimized encode and/or controlled loop/crossfade; keep the supplied master/source outside the deploy repo unless the user explicitly wants it committed. Weapon/explosion/boss SFX remain a separate just-in-time lane so music and effects can be mixed independently.

## Exact next action

1. Re-check Vercel exact-head state for PR #49/#50.
2. Continue L1-E from PR #50 head.
3. Add permanent fighter-tech persistence for `fog_breaker_pulse` without breaking v2/v3 save migration.
4. Start Gary deterministically when the mission reaches `gary_fog`; do not fall back to the generic four-boss campaign loop.
5. On Gary defeat: save the unlock, prevent repeat reward farming, give a clear reward beat, and require/immediately demonstrate Fog Breaker before the final-assault path.
6. Keep fighter controls/fire cadence untouched.
7. After Gary timings stabilize, add Gary/Fog Breaker SFX in a dedicated audio phase; Level 1 music source is already locked above.

After each new stacked PR, update this note.
