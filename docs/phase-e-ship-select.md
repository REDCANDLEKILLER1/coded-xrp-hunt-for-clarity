# Phase E — Ship Select and Handling Archetypes

## Goal

Add a real pre-flight choice that changes how the game feels without changing
the renderer, manifest, or asset boundary.

## Runtime changes

- New `select` game mode between title and play.
- Three data-defined ships:
  - Clarity Interceptor — balanced baseline.
  - XRPL Striker — fastest movement and fire cadence, lower HP.
  - Ledger Warden — highest HP, slower movement and fire cadence.
- Selection cards show HP, speed, and fire cadence.
- Selected stats drive movement, hitbox, HP bar, fire timing, draw size, and HUD identity.
- Restart keeps the selected ship while resetting the run.

## Asset boundary

All three archetypes temporarily reuse `ships.player`. Accent colors identify
them in selection and play. Dedicated ship sprites belong in a later asset-only PR.

## Scope guardrails

- No manifest, runtime asset, boss, campaign, wallet, workflow, or lockfile changes.
- Branch stacks on Phase D; no branch in this stack modifies `main`.

## Verification

- Content validation requires ship labels, accents, valid sizes/stats, and valid starting weapons.
- Required repository gates remain `npm ci`, `npm test`, and `npm run build`.
