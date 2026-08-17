# Phase G — Scrolling Stage Environments

## Goal

Replace the static grid-only backdrop with a sense of travel through distinct
world spaces and visible structures.

## Runtime changes

- Three data-defined environments unlock with progression:
  - Wave 1: Ledger City.
  - Wave 4: Data Canyon.
  - Wave 7: Regulatory Outpost.
- Each stage controls sky, accent, structure color, and scroll speed.
- Scrolling grid perspective now follows stage speed and palette.
- Procedural buildings line both sides of the flight path with illuminated windows.
- The active stage name appears in the HUD.

## Asset boundary

This phase builds the stage code and procedural fallback only. Dedicated city,
building, outpost, and environmental art belongs in a later asset-only PR.

## Scope guardrails

- Decorative structures do not add collision or turret logic in this phase.
- No manifest, runtime asset, boss, wallet, workflow, or lockfile changes.
- Branch stacks on Phase F; no branch in this stack modifies `main`.

## Verification

- Content validation checks stage ordering, colors, labels, and scroll speeds.
- Required repository gates remain `npm ci`, `npm test`, and `npm run build`.
