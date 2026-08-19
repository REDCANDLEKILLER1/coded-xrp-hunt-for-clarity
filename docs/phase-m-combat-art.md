# Phase M — Runtime Combat Art

## Scope

- Replaces the remaining live procedural combat placeholders with optimized runtime WebP assets.
- Gives all four enemy archetypes distinct silhouettes.
- Adds the live defense turret and all three collectible pickup sprites.
- Changes only manifest entries and the three enemy sprite mappings required to consume the new art.

## Runtime Slots

| Category | Keys |
| --- | --- |
| Enemies | `regulator_drone`, `fog_raider`, `whale_scout`, `rug_fighter` |
| Hazard | `defense_turret` |
| Pickups | `weapon_upgrade`, `bomb`, `repair` |

## Handoff Use

The uploaded Opus handoff ZIP was audited outside the repository. It contains 17 opaque full-size masters, not deploy-ready assets. The turret, rocket-upgrade, and pulse-core masters were selected, edge-keyed, trimmed, resized, alpha-checked, and optimized. The ZIP and unused masters remain outside the deploy repository.

## Verification

- All eight runtime files retain transparency and use two-times draw resolution.
- Combined runtime weight is below 25 KB.
- Run `npm ci`, `npm test`, and `npm run build` in the clean deployment environment.
- Manually verify all enemy unlock waves, turret fire, and pickup collection on desktop and mobile.
