# Asset requests — 2D combat cycle

**For the auditor.** This is the complete art list for the cycle designed in
[`docs/2d-combat-cycle.md`](../2d-combat-cycle.md). Everything here is either
already in the curated ledger and needs processing, or is new art to be made.

**How to deliver:** commit the processed files onto the branch of the asset PR
that consumes them, under the path in the *target* column. Do not add anything
to `public/assets/manifest.json` in this branch — the manifest entry lands in
the same PR as its runtime consumer, so no file is ever an orphan.

The design branch itself adds no images. It is documentation only.

---

## Pipeline rules (unchanged, restated so nothing is guessed)

- Edge-key the opaque master to alpha, trim to content, export **WebP with
  alpha**. PNG only where a spritesheet needs it.
- Export at **2× the runtime draw box**, so a 28×14 bolt ships as 56×28.
- No caption strips, no baked ground shadow, no black card behind the subject.
- Ground/hazard art caps at 192px on its long edge; pickups at 44×58.
- Raw masters and archives stay outside the repo.

Note: `validate-asset-integrity.mjs` currently only checks transparency on PNGs
inside `projectiles|pickups|vfx|ships|enemies|bosses|special|characters`. All 49
WebP sprites and the `hazards/` and `environment/` directories are unchecked, so
a sprite shipped on a black card would pass today. PR-A0 extends that check to
`combat/`, `hazards/` and `environment/`.

---

## 1. Player projectiles → `combat/player_weapons/` (consumed by PR4)

| target | source | process to | notes |
| --- | --- | --- | --- |
| `pulse_wave` | ledger KEEP row 47 `fx_pulse_shot.png` (76×110) | 56×28 | cyan-green `#1ee7ff`/`#00ff88`, flat wave, nose-up. Also drawn at 40×18 for HYPER PULSE |
| `rocket` | ledger KEEP row 48 `fx_rocket.png` (76×110) | 18×52 | nose-up, orange. **Must read differently from `projectiles/seeker_missile.png`** (blue-neon, 15×43) |
| `plasma_ball` | ledger KEEP row 45 `fx_plasma_ball.png` (76×110) | 32×32 | round orb, violet `#b56cff` core, white centre. Symmetrical — it rotates to velocity |
| `storm_bolt` | ledger KEEP row 44 `fx_laser.png` (76×110) | 14×44 | nose-up. **Recolour to gold/amber `#ffd24a`** if the master is green, so LEDGER STORM reads apart from bb_shot |

`projectile_player_plasma_ball` as named in the earlier brief exists nowhere in
git — row 45 above is the actual source.

## 2. Weapon icons → `combat/player_weapons/` (consumed by PR4)

Nine icons at **64×114** (2× a 32×57 HUD badge).

| target | source |
| --- | --- |
| `lvl1_bb_shot` … `lvl5_pulse_wave`, `lvl8_ledger_storm`, `lvl9_hyper_pulse` | already processed on the unmerged branch `claude/weapon-ladder` (commit `7e6f512`) — **re-export at 64×114**, which cuts 216 KB to roughly 40 KB |
| `lvl6_rocket_barrage` | ledger KEEP row 79, 70×125 crop — **never processed anywhere in git** |
| `lvl7_plasma_cannon` | ledger KEEP row 80, 70×125 crop — **never processed anywhere in git** |

The seven branch files use keys (`bb_repeater`, `tri_beam`, `quad_beam`,
`ledger_storm`…) that do not match the locked ladder. Renaming to `lvl1`…`lvl9`
is part of this request.

## 3. Pickups → `pickups/` (consumed by PR5)

All at **44×58**, caption strip cropped the way `pickup_shield` was.

| target | source |
| --- | --- |
| `clarity` | **already in the repo** as `special/clarity_pulse.webp` (80×89) — preloaded but never drawn. Re-key it; no new art needed |
| `extra_life` | ledger KEEP row 57 |
| `rapid_fire` | ledger KEEP row 59 |
| `invincibility` | ledger KEEP row 58 |
| `speed_boost` | ledger KEEP row 62 |

## 4. Ground items → `combat/enemy_ships/` or `hazards/` (consumed by PR6)

| target | source | process to | notes |
| --- | --- | --- | --- |
| `fog_generator` | MAYBE row 308 `futuristic_radar_scanner_with_glowing_crystal.png` (1254²) | ≤192px | recolour the crystal fog-violet `#b56cff` |
| `watch_tower` | MAYBE row 322 `futuristic_scanning_tower_with_neon_accents.png` (1254²) | ≤192px | red `#ff3355` accent — regulator surveillance |
| `ledger_node` | MAYBE row 167 `futuristic_cybernetic_lock_on_dark_backdrop.png` (1254²) | ≤128px | gold `#ffd24a` accent |
| `bear_trap` | MAYBE row 316 `futuristic_robotic_mine_with_glowing_accents.png` (1254²) | ≤128px | **jaws closed** — the open-jaw tell is drawn procedurally |
| `clarity_beacon` | **none — new art** | 48×64 | see brief below |

### New art brief: `clarity_beacon`

> A small pedestal lantern or beacon, seen from a top-down three-quarter angle.
> White core with a green-cyan glow (`#00ff88` fading to `#1ee7ff`). Single
> frame, no animation. Transparent background, no caption, no ground shadow.
> Master around 96×128; export 48×64 WebP with alpha.
>
> It reads as *friendly* — the one thing on the ground the player wants to fly
> into rather than shoot. It should not look like a turret or a mine.

## 5. Enemy ships → `combat/enemy_ships/` (consumed by PR3)

Six curated crops, none currently in the repo. Process each at 2× its size-class
draw box, same pipeline as `enemies/regulator_drone.webp`.

| target | ledger row | class | export |
| --- | ---: | --- | --- |
| `bear_trapper` | 24 | Medium | 60px |
| `bull_market_bomber` | 25 | Heavy | 72px |
| `court_cruiser` | 26 | Medium | 60px |
| `gary_gunship` | 28 | Heavy | 72px |
| `liquidity_leech` | 29 | Medium | 60px |
| `sec_enforcer` | 32 | Light | 52px |

## 6. Effect sheets → `combat/effects/` (consumed by PR7)

| target | source | format |
| --- | --- | --- |
| `shield_break` | MAYBE row 127 `energy_shield_break_sequence.png` (2172×724 strip) | 6 frames cut to a **576×96 row-major PNG RGBA** sheet, transparent borders, declared like `hit_spark` (frames 6, 96×96, fps 13). Blue-white |
| `boss_death` *(optional)* | MAYBE row 454 or row 119 | 8 frames, **1024×128 PNG RGBA**. Only if drawn fire is preferred — the death sequence ships procedural first |

---

## 7. One deletion

`public/assets/hazards/defense_turret.webp` (88×88, 5,358 B) and its manifest
entry are an **orphan**: no consumer anywhere in `src/` since commit `233266a`,
and it duplicates the `ground_basic_turret` master already shipped as
`hazards/basic_turret`. It is still preloaded on every launch. PR-A0 deletes
both. No replacement.

While we are here, two related findings for the auditor:

- `special/clarity_pulse.webp` is preloaded and **never drawn** — the pulse is
  rendered procedurally. Section 3 above turns it into a consumed pickup rather
  than deleting it.
- The discontinued on-foot section still owns **11 manifest entries and 785 KB,
  31.6% of all image bytes** (`characters.*` ×5, `interior.*` ×6). They are also
  fetched twice, once by `AssetLoader` and once by hard-coded paths. Removing
  them is a separate decision the owner has not made yet, so nothing in this
  cycle touches them.

---

## Summary

| category | already curated, needs processing | new art needed |
| --- | ---: | ---: |
| player projectiles | 4 | 0 |
| weapon icons | 9 | 0 |
| pickups | 4 (+1 re-key, already in repo) | 0 |
| ground items | 4 | **1** (`clarity_beacon`) |
| enemy ships | 6 | 0 |
| effect sheets | 1 (+1 optional) | 0 |
| **total** | **28** | **1** |

Twenty-eight of twenty-nine assets already exist as curated crops. The only
genuinely new piece of art this whole cycle needs is the clarity beacon.
