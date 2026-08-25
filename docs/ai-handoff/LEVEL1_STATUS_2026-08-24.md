# CODED: XRP — Level 1 Status — 2026-08-24

This file supersedes the stale implementation-status sections in `CURRENT_STATE.md` and `ACTIVE_LEVEL1_STACK.md` until those files are consolidated.

Repo: `REDCANDLEKILLER1/coded-xrp-hunt-for-clarity`

## Authority / workflow

- XRPMan is final decision maker.
- GPT is auditor/planner/asset strategist.
- Claude is primary repo builder.
- Work in small branches and PRs; no mixed scope or big-bang rewrites.
- Do not merge gameplay without XRPMan approval.
- Required gates: `npm ci`, `npm test`, `npm run build`.
- Manifest is runtime asset source of truth.
- Do not place raw/master/reference archives in the deploy repo.

## Stable main / safety

- `main` remains the safe production baseline at `9b5c52c1f6a4d310aa285b91b9ae379fd19a00c8` unless independently verified otherwise.
- Safety snapshot PR #59 is a freeze marker and is not intended for merge.
- The Level 1 work is still an unmerged stacked development line.

## Level 1 canon — unchanged

- Planet 1 is Earth / Ledger Prime.
- Gary Fog is the Guardian; reward is permanent fighter tech `Fog Breaker Pulse`.
- Exterior final ship is the Regulatory Warship.
- The Regulatory Warship is disabled, not destroyed.
- The player flies the same personal fighter directly through the opened hangar/breach; no shuttle.
- XRPMan exits the fighter and continues on foot inside the ship.
- Interior final objective/boss is the Ledger Defense Core.
- Ledger Defense Core reward is the permanent XRPMan ability `Ledger Shield`.
- After interior victory, Earth is cleared and the Regulatory Warship is captured intact.
- The captured Regulatory Warship becomes the persistent capital ship / mobile base for later interplanetary progression.
- The personal fighter remains a separate vehicle carried by/with the capital ship.
- NFTs/XRPL ownership integration remains future scope and must not block the standalone game.

## Planned Level 1 phases

1. L1-A — Mission Director Foundation
2. L1-B — Real Checkpoints + Resume
3. L1-C — Authored Space Encounters
4. L1-D1 — Level 1 Asset Bank
5. L1-D2 — Mixed Air/Ground Threats
6. L1-E — Gary Fog Guardian + Fog Breaker Reward
7. L1-F — Final Assault + Regulatory Warship
8. L1-G — Direct Fighter Boarding Transition
9. L1-H1 — XRPMan Gameplay Asset Prototype
10. L1-H2 — On-Foot Core
11. L1-I — Warship Interior
12. L1-J — Ledger Defense Core + Ledger Shield
13. L1-K — Earth Clear + Capital Ship Capture
14. L1-L — Balance / Polish / Tester Pass

## Accurate implementation status

Do **not** summarize the stack as "9 of 12 gameplay phases complete" and do not call L1-I complete.

### Built in the unmerged stack

- L1-A through L1-H2 are implemented in the stacked PR line.
- These include authored Earth mission flow, checkpoints, progressive encounters, Gary Fog, Fog Breaker, Regulatory Warship exterior encounter, direct fighter boarding, XRPMan prototype asset work, and the accepted side-view on-foot movement/jump/shooting core.

### L1-I — PARTIAL ONLY

PR #57 is explicitly the **first authored Regulatory Warship interior slice**.

Built:
- Docking Bay
- Security Checkpoint
- room traversal / combat handoff
- final Security clear emits `access_corridor` handoff

Not built yet:
- Access Corridor
- Maintenance Shaft
- Field Control Chamber
- Defense Systems Deck
- Core Access

Therefore current runtime reaches the first interior slice and then stops before the rest of the critical path.

### Not built

- L1-J — Ledger Defense Core boss + Ledger Shield reward
- L1-K — Earth Clear + Regulatory Warship capture/persistence handoff
- L1-L — balance / polish / tester pass

## Required next gameplay sequence

Do not jump directly from the current Security Checkpoint dead-end to the Ledger Defense Core.

After the blocker/integration work is resolved and audited, finish the interior in small slices:

1. Access Corridor
2. Maintenance Shaft
3. Field Control Chamber
4. Defense Systems Deck
5. Core Access
6. L1-J — Ledger Defense Core boss + Ledger Shield
7. L1-K — Earth Clear + Regulatory Warship capture
8. L1-L — balance / polish / human tester pass

Each slice should remain narrowly scoped and preserve the accepted H2 gameplay constants unless a tested issue justifies a change.

## Accepted H2 on-foot constants

- gravity: 1900
- moveSpeed: 270
- jumpSpeed: 690
- maxFallSpeed: 980
- playerWidth: 42
- playerHeight: 64
- blastSpeed: 660
- blastCost: 10
- blastCooldown: 0.18
- coyoteSeconds: 0.10
- jumpBufferSeconds: 0.12

Landscape/mobile work changes presentation/camera behavior, not these physics values.

## Current blocker PR

PR #60: `claude/fix-level1-stack-blockers`

Verified blocker set:

1. Boarding retry latch after on-foot defeat — real; fix implemented with explicit `resetForRetry()` lifecycle reset.
2. Regulatory Warship interior WebPs — original repo copies were truncated to 7,506 bytes each; complete originals exist outside the stale repo copies and are subject to byte/hash acceptance before commit.
3. Portrait landscape gate — real failure mode when fullscreen/orientation lock is unavailable or denied; explicit fallback/continue path implemented.

PR #60 remains draft / do-not-merge until its own gates and asset replacement are complete and GPT audits the final head.

## Complete interior WebP acceptance values

`regulatory_docking_bay.webp`
- 87,056 bytes
- 1024x576
- SHA-256 `c177eef4b45cc7060ae5ac786c93ef085e95fadf05ebff64b0b9d2affaa37ef0`

`regulatory_security_checkpoint.webp`
- 70,976 bytes
- 1024x576
- SHA-256 `2aaa7baf890048cd936381a70b735c76f0802a31d86a5b902b6aa61f43bfa4dc`

Do not accept re-encoded substitutes under these filenames.

## XRPMan production-art direction

The accepted on-foot gameplay prototype is not the final character presentation.

Canonical identity:
- Caucasian adult male
- brown hair
- glowing green eyes
- athletic heroic build
- black/dark gunmetal armor
- neon green `#00FF00` illuminated channels
- glowing X/circular chest emblem
- green Liquidity energy signature
- electric-blue secondary tech accent

Canonical production source set consists of the supplied reference plus five production sheets:
1. Core Movement
2. Traversal
3. Combat
4. Flight
5. Response / Special

Do not regenerate them merely to normalize scale. Runtime atlas extraction/normalization is separate from the Level 1 interior-content slices.

## Asset policy / continuity

A master source archive and critical continuity pack were created on 2026-08-24 for Project Sources. They are source/master archives, not runtime-deploy bundles.

Current Batch 0 live-slot asset scope remains limited to:
- `ships.player`
- `enemies.regulator_drone`
- `projectiles.bb_shot`
- `vfx.burst_ring`
- `special.clarity_pulse`

Do not mix bosses, ship-select/roster expansion, pickup systems, weapon ladder, world builder, menus, or other future assets into Batch 0.

## Resume rule

On a fresh chat:

1. Read this file first.
2. Inspect actual remote `main`, PR #60, and the active stack heads before assuming this document is current.
3. Preserve canon and accepted gameplay constants.
4. Finish blockers/integration before starting the next interior slice.
5. Update this handoff after every major merge or design change.
