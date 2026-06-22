# CODED: XRP — Phase 2B Asset Inventory / Placement Map

**Author:** GPT  
**Status:** docs-only planning artifact. No runtime asset files, no manifest edit, no gameplay code.

This PR supplies the War Room checkpoint requested in Issue #7:

1. Audit available assets.
2. Map assets to intended game roles and future manifest keys.
3. Define the exact Phase A boundary for Claude's next docs-only implementation ticket.

---

## 1. Inventory totals

| Group | Count | Purpose |
|---|---:|---|
| Player ships | 10 | Future selectable roster; one default live replacement candidate |
| Enemy ships | 10 | Future enemy roster; one current live replacement candidate |
| Projectile / upgrade ladder | 9 | Future tiered player-fire ladder; one current live projectile candidate |
| Pickups / powerups | 9 | Future collection/effect system |
| FX / projectile visuals | 9 | Future impacts, trails, pulses, and animated effects |
| Environments / hazards | 7 | Future stages, scrolling decor, hazards |
| Ground turrets | 5 | Future stationary hazard family |
| Bosses | 4 | Later boss ladder only |
| **Total** | **63** | Enough art to plan the real game; blocker is code structure |

---

## 2. Runtime-ready slots after PR #5

These are the only currently live manifest slots in the existing game loop. They should be the first real-art swap **after** Phase A, not before.

| Live slot | Current role | Recommended asset | Status |
|---|---|---|---|
| `ships.player` | player ship | `player_clarity_interceptor.png` | default replacement candidate |
| `enemies.regulator_drone` | default enemy | `enemy_regulator_drone.png` | default replacement candidate |
| `projectiles.bb_shot` | basic player shot | `weapon_lvl1_bb_shot.png` | default replacement candidate |
| `vfx.burst_ring` | hit / burst ring | `fx_explosion.png` or authored burst sheet | renderer-ready |
| `special.clarity_pulse` | special pulse visual | `pickup_clarity.png` or authored pulse sheet | manifest-ready; confirm use before relying on it |

---

## 3. Placement map — final proposed manifest keys

### Player ships

| Asset | Proposed key | Intended role |
|---|---|---|
| `player_apex_guardian.png` | `ships.apex_guardian` | future roster ship |
| `player_clarity_interceptor.png` | `ships.player` | default live player / first real-art swap |
| `player_clarity_prime.png` | `ships.clarity_prime` | future balanced late-unlock ship |
| `player_flare_rider.png` | `ships.flare_rider` | future roster ship |
| `player_genesis_vanguard.png` | `ships.genesis_vanguard` | future roster ship |
| `player_infinity_warden.png` | `ships.infinity_warden` | future roster ship |
| `player_ledger_hawk.png` | `ships.ledger_hawk` | future roster ship |
| `player_odl_phantom.png` | `ships.odl_phantom` | future roster ship |
| `player_ripple_runner.png` | `ships.ripple_runner` | future roster ship |
| `player_xrpl_striker.png` | `ships.xrpl_striker` | future fast/aggressive ship |

### Enemies

| Asset | Proposed key | Intended role |
|---|---|---|
| `enemy_bear_trapper.png` | `enemies.bear_trapper` | future enemy type |
| `enemy_bull_market_bomber.png` | `enemies.bull_market_bomber` | future enemy type |
| `enemy_court_cruiser.png` | `enemies.court_cruiser` | future enemy type |
| `enemy_fog_raider.png` | `enemies.fog_raider` | future enemy type |
| `enemy_gary_gunship.png` | `enemies.gary_gunship` | future enemy type |
| `enemy_liquidity_leech.png` | `enemies.liquidity_leech` | future enemy type |
| `enemy_regulator_drone.png` | `enemies.regulator_drone` | default live enemy / first real-art swap |
| `enemy_rug_fighter.png` | `enemies.rug_fighter` | future enemy type |
| `enemy_sec_enforcer.png` | `enemies.sec_enforcer` | future enemy type |
| `enemy_whale_scout.png` | `enemies.whale_scout` | future enemy type |

### Projectile / upgrade ladder

| Asset | Proposed key | Intended role |
|---|---|---|
| `weapon_lvl1_bb_shot.png` | `projectiles.bb_shot` | default live projectile / tier 1 |
| `weapon_lvl2_twin_beam.png` | `weapons.lvl2_twin_beam` | future tier 2 |
| `weapon_lvl3_tri_shot.png` | `weapons.lvl3_tri_shot` | future tier 3 |
| `weapon_lvl4_wide_spread.png` | `weapons.lvl4_wide_spread` | future tier 4 |
| `weapon_lvl5_pulse_wave.png` | `weapons.lvl5_pulse_wave` | future tier 5 |
| `weapon_lvl6_rocket_barrage.png` | `weapons.lvl6_rocket_barrage` | future tier 6 |
| `weapon_lvl7_plasma_cannon.png` | `weapons.lvl7_plasma_cannon` | future tier 7 |
| `weapon_lvl8_ledger_storm.png` | `weapons.lvl8_ledger_storm` | future tier 8 |
| `weapon_lvl9_hyper_pulse.png` | `weapons.lvl9_hyper_pulse` | future tier 9 |

### Pickups / powerups

| Asset | Proposed key | Intended role |
|---|---|---|
| `pickup_clarity.png` | `pickups.clarity` and/or `special.clarity_pulse` | clarity/special candidate |
| `pickup_critical_chance.png` | `pickups.critical_chance` | future pickup |
| `pickup_extra_life.png` | `pickups.extra_life` | future pickup |
| `pickup_invincibility.png` | `pickups.invincibility` | future pickup |
| `pickup_rapid_fire.png` | `pickups.rapid_fire` | future pickup |
| `pickup_repair.png` | `pickups.repair` | future pickup |
| `pickup_shield.png` | `pickups.shield` | future pickup |
| `pickup_speed_boost.png` | `pickups.speed_boost` | future pickup |
| `pickup_weapon_upgrade.png` | `pickups.weapon_upgrade` | future pickup |

### FX / projectile visuals

| Asset | Proposed key | Intended role |
|---|---|---|
| `fx_enemy_bullet.png` | `vfx.enemy_bullet` | future hostile fire visual |
| `fx_enemy_missile.png` | `vfx.enemy_missile` | future hostile fire visual |
| `fx_explosion.png` | `vfx.explosion` | impact / destruction visual |
| `fx_laser.png` | `vfx.laser` | future beam visual |
| `fx_plasma_ball.png` | `vfx.plasma_ball` | future projectile visual |
| `fx_player_bb.png` | `vfx.player_bb` | future player shot visual |
| `fx_pulse_shot.png` | `vfx.pulse_shot` | future pulse shot visual |
| `fx_rocket.png` | `vfx.rocket` | future rocket visual |
| `fx_twin_beam.png` | `vfx.twin_beam` | future beam visual |

### Environments / hazards

| Asset | Proposed key | Intended role |
|---|---|---|
| `env_asteroid.png` | `environments.asteroid` | future stage/hazard asset |
| `env_data_spire.png` | `environments.data_spire` | future stage asset |
| `env_defense_turret.png` | `environments.defense_turret` | future stage/hazard asset |
| `env_energy_barrier.png` | `environments.energy_barrier` | future hazard asset |
| `env_mega_tower.png` | `environments.mega_tower` | future stage asset |
| `env_regulatory_outpost.png` | `environments.regulatory_outpost` | future stage asset |
| `env_xrp_billboard.png` | `environments.xrp_billboard` | future stage/signage asset |

### Ground turrets

| Asset | Proposed key | Intended role |
|---|---|---|
| `ground_basic_turret.png` | `ground.basic_turret` | future stationary hazard |
| `ground_cannon_tower.png` | `ground.cannon_tower` | future stationary hazard |
| `ground_laser_tower.png` | `ground.laser_tower` | future stationary hazard |
| `ground_missile_silo.png` | `ground.missile_silo` | future stationary hazard |
| `ground_plasma_turret.png` | `ground.plasma_turret` | future stationary hazard |

### Bosses

| Asset | Proposed key | Intended role |
|---|---|---|
| `boss_gary_fog_phase1.png` | `bosses.gary_fog_phase1` | later boss phase 1 |
| `boss_regulatory_behemoth_phase2.png` | `bosses.regulatory_behemoth_phase2` | later boss phase 2 |
| `boss_clarity_destroyer_phase3.png` | `bosses.clarity_destroyer_phase3` | later boss phase 3 |
| `boss_final_clarity.png` | `bosses.final_clarity` | later final boss / victory gate |

---

## 4. Static vs spritesheet status

- Current audited 63-asset set is treated as **static PNG planning inventory**.
- PR #5 already made the renderer ready for future multi-frame sheets.
- Current placeholder manifest has `vfx.burst_ring` as a one-frame spritesheet (`frameWidth: 64`, `frameHeight: 64`, `frames: 1`, `fps: 12`).
- Future multi-frame candidates: burst/explosion, pulse effects, boss phase frames, shield effects, portal-style effects.
- Do not mark an asset as `type: "spritesheet"` until exact `frameWidth`, `frameHeight`, `frames`, and `fps` are authored.

Example future sheet metadata:

```json
{
  "type": "spritesheet",
  "sheet": { "frameWidth": 64, "frameHeight": 64, "frames": 4, "fps": 12 }
}
```

---

## 5. Missing / needs-authoring list

- Audio/music/SFX are not present in the current inventory.
- UI kit is thin compared with the gameplay roster; HUD can stay minimal, but menu/pause/upgrade/ship-select screens will need more art later.
- Boss art exists, but boss behavior, attack patterns, phase logic, health bars, and sheet metadata are later-phase work.
- Automated tests are not present yet; current gate is build + runtime sanity.
- Manifest validation should be considered once content registries exist.

---

## 6. Exact Phase A boundary

Phase A is **foundation only**. It must make the current single-ship / single-enemy / single-projectile game data-driven without expanding gameplay.

### Phase A may add/change later

- Content registry definitions for ships, enemies, projectiles/weapons, pickups, VFX, environments, ground/turrets, and bosses.
- Manifest/content mapping helpers so registry IDs resolve to manifest category/id keys.
- Entity-list structures for current player, enemy, projectile, and FX instances.
- A light `Game2A` refactor that replaces scattered constants and direct manifest keys with data records.
- Small validation helpers if low-risk.

### Phase A must preserve

- Current title/play/results flow.
- Current default player behavior.
- Current default regulator-drone behavior.
- Current basic projectile behavior.
- Current clarity pulse behavior.
- Current procedural fallback behavior.
- Current `npm ci` + `npm run build` gate.

### Phase A must not include

- No asset dump or bulk public asset import.
- No ship select.
- No boss fights.
- No new enemy roster in live waves.
- No upgrade ladder in live gameplay.
- No pickup system in live gameplay.
- No new game mode, secrets, env vars, lockfile changes, or workflow changes.

### Phase A acceptance criteria

- Game looks and plays the same as post-PR-#6 `main`.
- Current live slots resolve through data records rather than scattered hardcoded keys.
- Existing manifest entries still load through `AssetLoader` and render through `SpriteRenderer`.
- Procedural fallback still works if manifest assets are missing.
- New data definitions make it obvious how the 63-asset inventory maps in later phases.
- `npm ci` and `npm run build` pass.

---

## 7. Recommended sequence after this PR

1. Merge this inventory PR as the planning source of truth.
2. → Claude: draft a docs-only Phase A implementation ticket.
3. XRPMan approves the ticket.
4. Claude implements Phase A only.
5. After Phase A, run a small real-art PR mapped to current live slots.
6. Expand roster categories only after the data layer is stable.

---

## 8. Handoff

→ Claude: draft Phase A ticket after reviewing this inventory and Phase A boundary. The ticket should be docs-only and must not implement code.
