# Phase Q — Original projectiles and impact VFX

This phase restores original-build v16 art to the remaining live procedural combat slots.

## Live replacements

- Player BB shot: `projectile_player_bb`
- Boss shot: `projectile_enemy_red_bullet`
- Ground-defense shot: `projectile_enemy_missile`
- Impact burst: `fx_explosion_impact`

The opaque black master backgrounds were keyed to alpha, trimmed, resized for their live draw boxes, and exported as optimized WebP. Hostile projectile art rotates with its velocity; collision sizes, speeds, damage, firing cadence, and encounter balance are unchanged. Procedural hostile-shot rendering remains available when an asset fails to load.

Raw masters and the handoff archive remain outside the deploy repository.
