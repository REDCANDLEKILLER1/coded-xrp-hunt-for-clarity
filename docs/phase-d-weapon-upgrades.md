# Phase D — Weapon Upgrades and Pickups

## Goal

Add a visible combat-progression loop: destroy enemies, earn an upgrade drop,
collect it, and immediately change the player's firing pattern.

## Runtime changes

- Three data-defined weapon tiers: BB Shot, Twin Beam, and Tri-Spread.
- Volley patterns are pure data: projectile key, cadence, damage, offsets, and angles.
- A weapon-up pickup drops every seven weapon kills until the ladder is complete.
- Pickups drift down the playfield and upgrade on player collision.
- The HUD reports the active weapon tier and name.
- Restart resets weapon progression, pickup actors, kill count, and combat timers.

## Asset boundary

This is a code-only progression phase. Weapon tiers reuse the current optimized
`projectiles.bb_shot` sprite. The upgrade pickup has a neon procedural fallback;
dedicated weapon and pickup art belongs in a later asset-only PR.

## Scope guardrails

- No manifest, runtime asset, boss, ship-select, campaign, wallet, workflow, or lockfile changes.
- Branch stacks on Phase C; neither branch modifies `main`.

## Verification

- Content validation checks contiguous weapon tiers, projectile references,
  finite shot patterns, positive cadence/damage, and pickup metadata.
- Required repository gates remain `npm ci`, `npm test`, and `npm run build`.
