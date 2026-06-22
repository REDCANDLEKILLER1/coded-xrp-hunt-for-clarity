# CODED: XRP — The Hunt for Clarity — Master Plan

**Status:** Planning / audit only. No gameplay, asset, manifest, lockfile, or workflow changes are made by this document.
**Branch:** `claude/master-plan-audit`
**Baseline:** `main` after PR #5 (sprite-sheet renderer support).

---

## 0. Working-model target

CODED should grow into a **full vertical arcade shooter**:

> **Choose ship → fight waves → collect clarity / power-ups → upgrade weapons → survive bosses → restore clarity.**

This document maps the gap between the current engine and that target, then proposes a phased path that reuses the asset inventory GPT has audited locally — without committing to code yet.

---

## 1. Current engine state after PR #5

- **Stack:** Vite 5 + TypeScript 5 (strict) + HTML Canvas 2D. No runtime dependencies.
- **Entry:** `index.html` mounts a single `#game` canvas → `src/main.ts` → `Game2A`.
- **Build gate:** `npm ci` + `npm run build` (`tsc && vite build`); GitHub Actions `Build Check` runs on PRs to `main`; Vercel deploys `dist/`.
- **Reproducible installs:** `package-lock.json` (lockfileVersion 3) + `npm ci` (PR #3).
- **Clean source tree (PR #4):**
  ```
  src/main.ts
  src/style.css
  src/game/core/AssetLoader.ts
  src/game/core/Game2A.ts
  src/game/core/Input.ts
  src/game/core/Loop.ts
  src/game/core/Sprite.ts
  src/game/core/Types.ts
  ```
- **Renderer-ready (PR #5):** `SpriteRenderer` + `drawSprite()` support static images and time-based multi-frame sheet animation, with graceful fallback to procedural art.

The engine is a single self-contained class (`Game2A`). There is no scene graph, entity component system, or data-driven content layer yet — content (the one ship, one enemy, one bolt) is **hardcoded** against specific manifest keys.

---

## 2. What the live `Game2A` engine currently supports

**Game flow**
- Three modes: `title` → `play` → `results`, with tap/Enter to start and restart.

**Player**
- One hardcoded player actor; drag-to-fly (pointer) with keyboard (WASD / arrows) fallback; clamped to the lower play field.
- Auto-fire single bolt at a fixed rate (`BOLT_RATE = 0.14s`).
- 3 HP; loses 1 HP on enemy collision or when an enemy passes the bottom edge.

**Enemies**
- One enemy type ("regulator drone"): spawns from the top, descends with a sine wobble, spawn rate and speed scale mildly with wave.

**Combat & scoring**
- AABB collisions: bolt↔drone and drone↔player.
- Score: +100 per bolt kill, +25 per pulse kill. `wave = 1 + floor(score / 500)`.

**Special**
- A "clarity pulse" meter that regenerates over time and on kills; when full, fires a radial pulse that clears drones within ~165px.

**Rendering & FX**
- Procedural neon-grid background; vector fallback art for player/drone/bolt; expanding ring VFX (procedural or `vfx/burst_ring` via the sprite renderer).

**HUD / UI**
- Score, wave, HP bar, special bar; on-screen PAUSE / PULSE / D (diagnostics) zones; pause overlay.

**Input**
- Pointer + keyboard; `Space` = pulse, `P` = pause, `D` = diagnostics, `Enter`/tap = start/restart.

**Asset system**
- `AssetLoader`: fetches `/assets/manifest.json`, preloads every entry, records per-asset diagnostics (`loaded` / `missing` / `error`), and exposes `getImage()` / `getSheet()`.
- Graceful degradation: any missing/broken asset falls back to procedural art; the game never hard-fails on assets.
- On-canvas diagnostics panel summarizing load state.
- DPR-aware resize and mobile-friendly control zones.

**What it does NOT support yet** (the gap to the target):
- Ship selection / multiple player ships (one is hardcoded).
- Multiple enemy types / behaviors (one drone).
- Weapon ladder, upgrades, or weapon levels (one bolt pattern).
- Pickups / power-ups (none).
- Bosses (none).
- Backgrounds, environments, hazards, ground/turret entities (procedural grid only).
- Levels / campaign / progression / persistence.
- Audio.
- Animated multi-frame content actually used in play (renderer is ready, but no multi-frame assets ship today).

---

## 3. What the asset inventory implies the game can become

GPT's local audit (not yet committed to the repo) reports **63 assets**:

| Category | Count | Implication for the game |
|---|---|---|
| Player ships | 10 | A selectable **ship roster** with distinct stats/feel. |
| Enemy ships | 10 | A varied **enemy roster** with per-type behaviors. |
| Weapon / projectile levels | 9 | A **weapon ladder** (upgrade tiers) rather than one bolt. |
| Pickups / power-ups | 9 | A **pickup/power-up system** (clarity, weapon-up, shields, etc.). |
| FX assets | 9 | A real **VFX layer** (impacts, explosions, pulses, trails). |
| Environment / map | 7 | **Backgrounds / level themes** for stages. |
| Ground / turret | 5 | **Stationary hazards/turrets** — a new entity class. |
| Bosses | 4 | A **boss ladder** — staged encounters / act finales. |

This is enough content for a multi-stage arcade shooter with ship choice, escalating weapons, power-ups, environmental variety, and four boss encounters — i.e., the full working-model target. The constraint is **code**, not art: the engine must become data-driven to consume this inventory.

---

## 4. Proposed game structure

> Names below are structural placeholders; final IDs come from GPT's manifest, which remains the source of truth.

### 4.1 Ship roster (10)
- A **ship select** step before `play`. Each ship = a data record: sprite key, speed, fire-rate, hitbox, starting weapon tier, special variant.
- Start with 2–3 distinct archetypes wired through data, then scale to all 10 by adding records (no new code per ship).

### 4.2 Enemy roster (10)
- Each enemy = a data record: sprite key, HP, movement pattern (straight, sine, diver, drifter), fire behavior, score value.
- A small set of reusable **movement/behavior functions** that records reference by name keeps this data-driven.

### 4.3 Weapon ladder (9)
- Weapon **tiers 1–9**: each tier = projectile sprite key, damage, fire-rate, spread/pattern.
- Player advances tiers via pickups; capped at 9. Define as an ordered table so progression is pure data.

### 4.4 Pickup system (9)
- Pickups = data records: sprite key, type (clarity/score, weapon-up, shield, heal, special-charge, etc.), effect, drop weight.
- Drops triggered by enemy kills / wave clears; collected on player overlap.

### 4.5 Boss ladder (4)
- Four staged bosses gating act transitions. Boss = sprite key (likely multi-frame → uses the PR #5 renderer), multi-phase HP, attack patterns, telegraphs.
- Bosses are the highest-complexity new system; sequence them last.

### 4.6 Environment / hazard system
- 7 environment/background assets → **stage themes** swapped per act (replacing the procedural grid, or layered behind it for parallax).
- 5 ground/turret assets → a **stationary hazard/turret** entity class (fixed or scrolling) that can fire at the player.

### 4.7 HUD / UI system
- Extend the current HUD with: selected-ship indicator, current weapon tier, active power-up timers, boss health bar, stage/act label.
- The 1 reserved `ui` manifest slot (and incoming UI assets) back a real UI skin instead of pure canvas primitives.

### 4.8 VFX system
- Promote the ad-hoc ring into a small **FX manager** that spawns short-lived effects (impacts, explosions, pickups, pulses) by sprite key — ideal home for multi-frame animated sheets via `drawSprite()`.

---

## 5. What can be implemented now with existing code

These need **no new engine systems** — only data wiring and modest additions:

- **Swap in real art for the existing 4 entities** (player, drone, bolt, ring) by updating manifest keys + sizes. The loader and renderer already support this; the only code touch is the hardcoded category/id strings in `Game2A`.
- **Animated VFX** for the existing ring/impacts using multi-frame sheets — the PR #5 renderer path is ready and tested.
- **More enemy *spawns*** (difficulty curve tuning) within the current single enemy type.
- **Minor HUD additions** (e.g., stage label) using existing canvas-draw helpers.

Everything above fits the "renderer-ready" state without architectural change.

## 6. What needs new code

In rough order of increasing effort:

1. **Data-driven content layer** — registries/tables for ships, enemies, weapons, pickups (replaces hardcoded constants). *Foundational; unlocks most of section 4.*
2. **Ship-select screen** — a new mode between `title` and `play`, plus selected-ship state.
3. **Weapon-tier system** — ordered weapon table + upgrade/downgrade rules + projectile patterns.
4. **Pickup/power-up system** — spawn, drift, collect, apply/expire effects.
5. **Enemy behavior functions** — named movement/fire patterns referenced by enemy records.
6. **FX manager** — generic timed sprite effects.
7. **Environment/stage system** — background/theme swap + parallax.
8. **Ground/turret entity class** — stationary hazards with targeting.
9. **Boss system** — multi-phase HP, attack patterns, boss HUD, act gating.
10. **Progression/flow** — acts/stages, win condition ("restore clarity"), and optional persistence.
11. **(Optional) Audio layer** — not in inventory; flagged as missing.

A light refactor of `Game2A` into an entity list + per-type update/draw (still Canvas 2D, no framework) is the enabling step for items 1–9.

## 7. What assets are missing / not yet in-repo

- **Not yet committed:** all 63 inventory assets live in GPT's local audit + a paused branch; only 5 vector placeholders exist in `public/assets/` today. The manifest currently references only those 5.
- **UI kit:** the `ui` category is effectively empty in-repo (1 reserved slot); a HUD/menu skin set will be needed for section 4.7.
- **Audio:** no sound assets are in the inventory (music, SFX, UI clicks). Out of scope for art, but required for "arcade feel" — flag for a later audio pass.
- **Fonts/branding:** title/results currently use system fonts; a branded font/logo treatment is not inventoried.
- **Boss frame data:** if bosses are multi-frame sheets, each needs `sheet` metadata (`frameWidth/Height/frames/fps`) in the manifest — the renderer consumes this, but the values must be authored.

> Asset count/coverage is GPT's domain. This section only flags gaps relevant to code planning.

## 8. Recommended development phases (in order)

Each phase = one focused, build-gated PR. Asset integration stays **separate** from logic, per the agreed working model.

- **Phase A — Data-driven foundation (code).** Introduce content registries + a light entity-list refactor of `Game2A`. No new art; behavior identical. *Unblocks everything.*
- **Phase B — Real art for current entities (assets, GPT-led).** Manifest swap for player/drone/bolt/ring; Claude validates load + render.
- **Phase C — Enemy roster + behaviors (code).** Multiple enemy types via data + named patterns.
- **Phase D — Weapon ladder + pickups (code).** Tiered weapons and the power-up system.
- **Phase E — Ship select (code).** New mode + ship roster wiring.
- **Phase F — VFX manager + animated FX (code + assets).** Generic timed effects; first real multi-frame sheets.
- **Phase G — Environments + ground/turret hazards (code + assets).** Stage themes and stationary hazards.
- **Phase H — Boss ladder (code + assets).** Four staged bosses, boss HUD, act gating.
- **Phase I — Progression & win condition (code).** Acts, "restore clarity" ending, optional persistence.
- **Phase J — Audio & polish (assets + code, optional).** SFX/music, juice, balancing.

Ordering rationale: the data foundation (A) must precede content phases; art swaps (B/F/G/H) ride on top of code that already consumes the categories; bosses (H) are last because they depend on enemies, weapons, FX, and HUD being in place.

## 9. Risk list

- **Hardcoded coupling.** `Game2A` references fixed manifest keys and constants; scaling content without Phase A first will create brittle, copy-pasted code. *Mitigation: do A first.*
- **Scope creep / mixing concerns.** Combining asset drops with logic changes makes review and rollback hard. *Mitigation: keep asset PRs separate from code PRs (already the agreed model).*
- **Repo bloat.** 63 assets + future audio risk large binaries. *Mitigation: optimized web assets only; honor `.gitignore` (no zips/archives/raw art); consider sizes before commit.*
- **IPFS / external hosting.** If any large media is referenced off-repo (e.g., video), gateway availability affects runtime. *Mitigation: decide hosting per-asset; prefer optimized in-repo for small UI/sprites.*
- **Performance on mobile.** Many entities + large sprites + DPR scaling can drop frame rate. *Mitigation: budget entity counts, cap DPR (already 2), profile during Phases C/H.*
- **Boss complexity.** Multi-phase patterns are the most bug-prone area. *Mitigation: sequence last, build on proven systems, add tests around state transitions.*
- **Manifest drift.** Code and manifest can fall out of sync as keys grow. *Mitigation: manifest stays source of truth; diagnostics panel + a possible key-validation step catch misses.*
- **No automated test harness yet.** The repo currently relies on the build gate only. *Mitigation: introduce lightweight unit tests alongside the Phase A refactor.*
- **Renderer assumptions.** `drawSprite` derives columns from `image.width / frameWidth`; mis-authored sheet metadata animates wrong. *Mitigation: validate `sheet` values during asset integration.*

## 10. "Do not build yet" guardrails

Until each gated phase is explicitly assigned:

- **Do not** add blockchain, wallet, payments, signing, secrets, or environment variables.
- **Do not** mix asset drops and gameplay logic in the same PR.
- **Do not** start the boss system (Phase H) before enemies/weapons/FX/HUD exist.
- **Do not** refactor `Game2A` ahead of an approved Phase A ticket.
- **Do not** commit raw zips, archives, raw art (`*.psd/*.clip/*.kra/*.aseprite`), or large media dumps.
- **Do not** edit the lockfile or CI workflow except in a dedicated hygiene PR.
- **Do not** treat this document as an implementation green light — it is a map, not a build order to execute unprompted.
- **Manifest remains the source of truth**; code consumes it, not the reverse.

---

## Appendix — current manifest categories (in-repo)

`ships`, `enemies`, `bosses`, `weapons`, `projectiles`, `vfx`, `ui`, `backgrounds`, `hazards`, `objectives`, `special`, `base`, `campaign`.

Populated today: `ships.player`, `enemies.regulator_drone`, `projectiles.bb_shot`, `vfx.burst_ring` (spritesheet, 1 frame), `special.clarity_pulse`. All others are empty and reserved for the inventory above.
