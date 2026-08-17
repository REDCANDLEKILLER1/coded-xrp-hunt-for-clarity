# Phase H — Ground Turrets and Hostile Fire

## Scope

- Adds `HazardDef` and a validated `HAZARDS` registry for stage-bound threats.
- Introduces defense turrets from wave 3 onward, with spawn pressure that rises gradually.
- Turrets enter along either roadside, track the player, and fire aimed hostile projectiles.
- Player bolts can destroy turrets for score and special charge; contact and hostile shots damage the ship.
- Clarity Bombs clear turrets and hostile projectiles while awarding reduced hazard score.
- Uses a procedural turret fallback until an approved `hazards:defense_turret` runtime asset is added.

## Gameplay Notes

- Defense turret: 3 HP, 350 weapon-kill score, 75 bomb-clear score.
- Initial hazard interval: 7.5 seconds, with a 4.2-second floor at higher waves.
- Hostile projectile speed: 235 px/s; each hit deals 1 HP.
- Turrets only fire while visible and above the lower control area.

## Verification

- Run `npm test` when dependencies are available.
- Run `npm run build` for TypeScript and Vite production verification.
- Confirm a wave-3 turret can aim, fire, take bolt damage, collide with the player, and be cleared by a bomb.
