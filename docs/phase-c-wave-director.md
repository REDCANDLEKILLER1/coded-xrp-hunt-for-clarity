# Phase C — Wave Director and Enemy Behaviors

## Goal

Turn the single repeating drone stream into an escalating encounter loop while
keeping the current renderer, manifest, and five runtime assets unchanged.

## Runtime changes

- Four data-defined enemy archetypes unlock across waves 1–4.
- A pure weighted wave director controls which unlocked archetype spawns.
- Movement behaviors: sine, straight drift, edge-bouncing zigzag, and player-tracking dive.
- Stronger archetypes have additional HP and higher score values.
- The HUD reports the unlocked threat count and newest threat.
- Enemy variants temporarily reuse `enemies.regulator_drone`; colored threat rings distinguish them until a separate asset PR supplies dedicated sprites.

## Scope guardrails

- No manifest or asset changes.
- No bosses, weapons, pickups, ship select, campaign, wallet, workflow, or lockfile changes.
- `main` remains untouched; this phase lives on `gpt/phase-c-wave-director`.

## Verification

- Content validation covers enemy metadata, wave-one availability, unlock boundaries, weighted selection, and spawn-pressure escalation.
- Required gates remain `npm ci`, `npm test`, and `npm run build`.
