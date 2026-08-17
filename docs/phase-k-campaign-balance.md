# Phase K — Campaign Reachability and Mobile Boss HUD

## Scope

- Adds a validated `HULL REPAIR` pickup with a procedural cyan fallback.
- Drops a repair every 10 weapon kills only when the selected ship is below maximum HP.
- Restores 1 HP after each boss gate, capped by the selected ship's own maximum.
- Replaces the secondary threat/weapon text stack with the boss label and health bar during encounters, so compact phone layouts stay readable without overlapping score or player health.

## Balance Intent

Damage still matters, but an early mistake no longer permanently compounds across a 17-wave run. Repairs are conditional and capped, and bombs do not count as weapon kills, so recovery remains earned rather than automatic.

## Verification

- Content validation checks the repair record and pickup effect allowlist.
- Production build must pass TypeScript and Vite checks.
- Manual pass: take damage, reach kill 10, collect the cyan repair, verify HP cannot exceed the selected ship maximum, and inspect boss HUD placement on a narrow viewport.
