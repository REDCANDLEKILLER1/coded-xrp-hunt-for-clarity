# Phase O — v16 Canon Live-Slot Sync

## Verdict

The v16 LITE archive is a high-value master bundle, not a deploy bundle. It contains 141 organized opaque PNG assets across the full roster, weapons, projectiles, VFX, environments, UI, boss tech, and campaign transitions.

## Scope

- Replaces provisional live ship, enemy, boss, turret, and pickup art with exact named v16 canon masters.
- Keeps every existing manifest key, runtime path, draw size, hitbox, and gameplay rule unchanged.
- Adds no unused v16 assets and does not copy the ZIP or raw PNG masters into the repository.

## Processing

- Edge-key black backgrounds to true alpha.
- Trim and center each silhouette.
- Resize to two-times or four-times live draw dimensions.
- Export optimized WebP with full alpha quality.
- Verify every runtime file reports transparency and visually inspect the full live set on the game background.

## Deferred Gold

The remaining v16 assets are banked outside the deploy repository for future small phases: expanded ten-ship and ten-enemy rosters, nine weapon tiers, projectile families, five backgrounds, six ground defenses, animated VFX, UI screens, campaign-map transitions, boss-intro effects, and boss-tech special weapons.