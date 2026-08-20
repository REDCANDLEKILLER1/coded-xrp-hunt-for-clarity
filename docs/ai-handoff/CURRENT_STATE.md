# CODED: XRP — AI Handoff / Current State

**Purpose:** persistent resume point for any future ChatGPT/Claude chat working on this repo. Read this file before planning or coding.

**Last updated:** 2026-08-19
**Repo:** `REDCANDLEKILLER1/coded-xrp-hunt-for-clarity`
**Default branch:** `main`
**Main baseline at last update:** `9b5c52c1f6a4d310aa285b91b9ae379fd19a00c8` (PR #44 mobile campaign-map fit)

---

## 1. Current project doctrine

- XRPMan / RedCandleKiller is the final decision maker.
- Work in small branches and PRs. No mixed scope. No big-bang rewrites.
- Do not merge without XRPMan approval.
- Preserve the current responsive/addictive flight feel unless a playtest identifies a specific problem.
- Difficulty should come from new decisions, enemy combinations, hazards, weak points, telegraphs, and resource pressure — not screen spam.
- Manifest is the source of truth for runtime assets.
- Runtime repo only gets optimized assets actually referenced by the manifest.
- No raw ZIPs, archive dumps, oversized generations, opaque masters, or unused art in runtime.
- Do not touch wallet/payment/blockchain logic, secrets/env, workflows, lockfiles, unrelated UI, or Vercel settings unless explicitly authorized.
- Required build gates before merge approval: `npm ci`, `npm test`, `npm run build`.
- Never claim a gate passed if it did not actually run.

---

## 2. Current game direction

The old short score/wave run was a prototype to prove the combat feel. The game is now becoming a retro hybrid action-RPG adventure.

### Level 1 is the vertical slice

**Planet 1 = EARTH.**

Earth is under direct enemy attack. Cities, infrastructure, defenses, and civilians are threatened. The player begins in fighter combat, progresses through authored encounters and checkpoints, defeats the Guardian, disables the enemy capital ship, flies the fighter directly inside, continues as XRPMan on foot, defeats the interior core/commander, and captures the capital ship.

Target first-clear length: roughly 18–25 minutes. Experienced replay target: roughly 10–15 minutes.

### Three progression tracks

1. **Combat fighter** — weapons, armor, engines, bombs, boss-tech modules, special systems.
2. **XRPMan** — character weapons/abilities, health/energy, shield, traversal, environmental access.
3. **Captured capital ship** — separate persistent interplanetary vessel / mobile base with hull, shields, engines, navigation, hangar, cargo, sensors, weapons, etc.

Full 3D interplanetary flight is future scope. Level 1 only establishes ownership of the captured capital ship.

---

## 3. Level 1 canon locks

Unless XRPMan explicitly changes them:

- Planet 1 = **Earth**.
- Ledger Prime / Ledger City is the primary Earth combat zone / Sector 01 identity.
- Guardian = **Gary Fog**.
- Gary Fog reward = **Fog Breaker Pulse** permanent fighter tech.
- Level 1 exterior final boss ship = **Regulatory Warship**.
- The Regulatory Warship is disabled, not destroyed.
- After disabling it, a hangar/breach opens and the player flies the **same personal combat fighter directly inside**.
- There is **no shuttle boarding sequence**.
- XRPMan exits the fighter inside the warship for on-foot gameplay.
- Interior final objective/boss = **Ledger Defense Core**.
- Ledger Defense Core reward = **Ledger Shield** permanent XRPMan ability.
- After the interior victory, the player captures and keeps the **Regulatory Warship**.
- The captured Regulatory Warship becomes the future interplanetary capital ship.
- The personal combat fighter remains separate and travels in/with the capital ship.
- Checkpoints replace classic arcade lives for the production campaign.
- XRPMan's supplied character sheet is the canonical identity reference for future on-foot sprites.
- Cyber Battleship is reserved for a later sector.
- NFTs/XRPL ownership integration is future scope and must not block the standalone game.

---

## 4. Planned Level 1 phases

- **L1-A — Mission Director Foundation**
- **L1-B — Real Checkpoints + Resume**
- **L1-C — Authored Space Encounters**
- **L1-D1 — Level 1 Asset Bank**
- **L1-D2 — Mixed Air/Ground Threats**
- **L1-E — Gary Fog Guardian + Fog Breaker Reward**
- **L1-F — Final Assault + Regulatory Warship**
- **L1-G — Direct Fighter Boarding Transition**
- **L1-H1 — XRPMan Gameplay Asset Prototype**
- **L1-H2 — On-Foot Core**
- **L1-I — Warship Interior**
- **L1-J — Ledger Defense Core + Ledger Shield**
- **L1-K — Earth Clear + Capital Ship Capture**
- **L1-L — Balance / Polish / Tester Pass**

Do not skip ahead by mixing later-phase systems into an earlier PR.

---

## 5. ACTIVE WORK RIGHT NOW

### PR #45 — `Level 1A: Earth mission director foundation`

**Branch:** `gpt/level1-a-mission-director`
**Base:** `main` at `9b5c52c1f6a4d310aa285b91b9ae379fd19a00c8`
**Current head:** `af1c919c8c8bb08255c8340c6c85d88123465600`
**Status at last update:** OPEN DRAFT — DO NOT MERGE YET.

### L1-A changes already made

- added `src/game/content/missions/types.ts`
- added `src/game/content/missions/ledgerPrime.ts`
- added `src/game/content/missions/index.ts`
- added `src/game/content/MissionDirector.ts`
- updated `src/main.ts` so campaign deployment checks the mission registry while Test Mode still bypasses mission state
- updated `src/game/content/CampaignPlanets.ts` so the first map node is **EARTH** with Ledger Prime / Sector 01 identity
- extended `scripts/validate-content.mjs` with mission registry and MissionDirector tests

### L1-A explicit non-scope

- no checkpoint persistence yet
- no enemy rebalance
- no new assets
- no Gary Fog rework
- no Regulatory Warship runtime logic
- no on-foot XRPMan mode
- no gameplay-physics changes
- no lockfile/workflow/Vercel changes

### Last audited diff

7 changed files total, approximately 219 additions / 5 deletions. No gameplay physics file was edited.

### Verification state

- Existing GitHub workflow runs `npm ci` + `npm run build` on pull requests to `main`.
- The workflow does **not** run `npm test`.
- At the last update, PR #45 had just been opened and no workflow run was yet returned for head `af1c919...`.
- `npm test` has **not** been claimed as passed.

### Exact next action on resume

1. Inspect PR #45 current head and make sure it has not moved unexpectedly.
2. Check GitHub Actions / Vercel status for the exact head SHA.
3. Audit PR #45 diff for scope and TypeScript/build issues.
4. Ensure `npm ci` and `npm run build` are green through the repository workflow.
5. Run/obtain `npm test` evidence before merge approval if possible.
6. Report verdict to XRPMan.
7. **Do not merge until XRPMan says to merge.**
8. After L1-A is merged, begin **L1-B Real Checkpoints + Resume** on a new `gpt/level1-b-checkpoints` branch.

---

## 6. Current repo capabilities before Level 1 expansion

Already on `main` from the earlier C–U playtest stack:

- 10-planet campaign map
- 3 selectable ships
- responsive top-down fighter controls
- automatic weapons
- 3 weapon tiers
- bombs
- Clarity Pulse
- multiple enemy behaviors
- ground hazards/turrets
- hostile projectiles
- stage backgrounds and environment props
- 4 playable boss encounters
- boss phases
- repair / bomb / weapon upgrade pickups
- score / high-score / highest-wave persistence
- localStorage campaign progress data
- campaign destination selection

Important structural limitation before L1 work: planet selection still launched the generic score-driven combat prototype rather than a true authored per-planet mission.

---

## 7. Asset strategy

User supplied:

- a large archive containing 234 PNGs
- a clean v16 asset bundle
- XRPMan canonical character sheet
- several loose gameplay candidates, including Regulatory Warship, Cyber Battleship, Fast Scout, Armored Space Mine, ground turret, shield pickup, pulse weapon pickup, player ships, and city background

Known earlier asset conclusion:

- curated gameplay KEEP set = 63 crops, roughly 1.53 MB optimized
- large archive = reference/future scope, not something to dump into runtime

### Level 1 likely asset candidates

- Fast Scout
- Armored Space Mine
- Regulatory Warship
- selected Fog Breaker Pulse icon/VFX
- existing ground defenses
- existing Ledger City / space-city background
- later XRPMan on-foot sprites derived from the canonical character sheet

### Art-production policy

Plan the full Level 1 asset inventory up front, but generate/process assets **just in time** once camera angle, dimensions, runtime role, and animation requirements are known.

Do not generate a giant XRPMan sprite library before on-foot controller dimensions are locked.

---

## 8. Level 1 mission spine

Current intended act order:

1. Earth Deployment
2. Orbital Approach
3. Fog Belt
4. Ledger City
5. Defense Grid
6. Guardian — Gary Fog
7. Final Assault
8. Regulatory Warship exterior fight
9. Direct fighter boarding run
10. Warship interior
11. Ledger Defense Core
12. Earth Defended / Regulatory Warship Captured

The production mission should use authored encounter blocks rather than relying only on score thresholds/random waves.

---

## 9. Checkpoint intent for L1-B

Planned checkpoint boundaries:

- `earth.orbital_gate`
- `earth.defense_grid`
- `earth.boarding_lock`
- `earth.core_access`

Save coarse mission boundary state, not every live projectile/enemy position.

Resume should reconstruct a safe encounter boundary and offer both:

- `RESUME FROM CHECKPOINT`
- `RESTART MISSION`

Checkpoint reloads must never duplicate permanent boss rewards.

---

## 10. Tester / balance doctrine

There is an active human tester who already finds the current gameplay addictive. Preserve that signal.

Balance questions should focus on:

- where the tester dies
- whether deaths feel fair
- whether threats are readable
- repetition / empty stretches
- boss telegraphs
- checkpoint clarity
- whether permanent upgrades are immediately useful
- whether the tester wants to continue to Planet 2

Do not rebalance solely from one emotional comment; look for repeated friction patterns.

---

## 11. Handoff rule for future chats

When a new chat starts:

1. Read this file first.
2. Inspect the active PR/branch and verify current GitHub state instead of assuming this note is still current.
3. Preserve all canon locks unless XRPMan explicitly changes them.
4. Update this file after each merged phase, major design decision, or branch/PR handoff.
5. Never use this file as a substitute for auditing the actual repo state.

**Resume phrase:** `Read docs/ai-handoff/CURRENT_STATE.md, inspect the active PR, and continue from the Exact next action section.`
