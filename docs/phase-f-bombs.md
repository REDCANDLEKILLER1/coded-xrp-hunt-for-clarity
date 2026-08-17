# Phase F — Clarity Bombs

## Goal

Add a limited-use emergency weapon that creates a meaningful tactical choice
and works on both desktop and mobile.

## Runtime changes

- Runs start with two bombs and hold a maximum of three.
- `B` activates a bomb on desktop; a dedicated bottom HUD button handles touch.
- Bombs clear all active enemies, award reduced clear-score, and trigger the existing burst/debris effects.
- A full-screen gold shockwave communicates the blast.
- Bomb pickups drop every twelve weapon kills when inventory is not full.
- Bomb pickups use the generic pickup pipeline and a distinct procedural fallback.
- Restart restores the starting bomb inventory and clears bomb effects.

## Scope guardrails

- No manifest, runtime asset, boss, campaign, wallet, workflow, or lockfile changes.
- Branch stacks on Phase E; no branch in this stack modifies `main`.

## Verification

- Existing content validation covers both pickup definitions and all prior systems.
- Required repository gates remain `npm ci`, `npm test`, and `npm run build`.
