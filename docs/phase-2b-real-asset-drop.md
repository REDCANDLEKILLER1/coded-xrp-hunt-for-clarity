# Phase 2B Real Asset Drop

## Goal

Replace the Phase 2A placeholder asset paths with a small, safe, optimized asset set that proves the CODED engine can load real game assets without committing raw archive bundles.

## Added / Wired

- Player ship: `player_clarity_interceptor.real.svg`
- Enemy ship: `regulator_drone.real.svg`
- Player projectile: `bb_shot.real.svg`
- Impact burst: `burst_real.svg`
- Special pulse ring: `pulse_real.svg`
- HUD panel accent: `hud_real.svg`

## Source Strategy

The first drop uses selected game-ready visual roles from the curated CODED asset direction:

- player_clarity_interceptor
- enemy_regulator_drone
- weapon_lvl1_bb_shot
- burst / pulse VFX language
- neon HUD panel system

## Safety Rules

- No giant zip archives were committed.
- No 782 MB monster archive was committed.
- No raw art dump was committed.
- Asset payload remains small and web-safe.
- Manifest remains the source of truth.

## Next

Phase 2C should add the actual sprite frame renderer for animated sprite sheets and begin using the VFX and special assets in the runtime draw path.
