# CODED Level 1 Active Stack

**Updated:** 2026-08-19

This file is a compact live resume note. Read `docs/ai-handoff/CURRENT_STATE.md` for full doctrine, then verify the actual PRs/branches before changing code.

## Active stack

### PR #45 — L1-A Mission Director Foundation
- Branch: `gpt/level1-a-mission-director`
- Base: `main`
- Head: `af1c919c8c8bb08255c8340c6c85d88123465600`
- Status: open draft, mergeable
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
- No authored encounter triggers yet
- No merge before L1-A and no merge without XRPMan approval

## Exact next build step

Create `gpt/level1-c-space-encounters` from PR #47 head and implement **authored Earth flight encounters only**:
- orbital approach
- fog belt
- Ledger City approach
- defense-grid pacing skeleton
- mission-act advancement based on encounter completion rather than score
- earn/checkpoint `earth.orbital_gate` and `earth.defense_grid`
- preserve current movement/fire/collision feel
- no Fast Scout art import yet
- no new assets
- no Gary Fog redesign
- no Regulatory Warship implementation
- no on-foot mode

After each new stacked PR, update this note or `CURRENT_STATE.md`.
