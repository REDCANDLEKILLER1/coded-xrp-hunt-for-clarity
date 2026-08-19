# Phase U — Planet Campaign Map Foundation

## Scope

- Opens on a responsive Clarity System map instead of immediately entering the short arcade run.
- Registers ten planets, ten orbital guardians, ten future surface bosses, and branching routes as validated data.
- Implements locked, available, selected, and cleared node presentation with fogged future destinations.
- Preserves the existing short 17-wave campaign as `ARCADE TEST RUN` for combat balancing.
- Lets an available planet enter the existing ship-select and combat loop while Phase V builds Planet 1's complete mission.
- Adds a persistent `STAR MAP` return control without forcing a page reload.

## Persistence

Device-local progress moves to `coded-xrp-campaign-progress-v2` and falls back to the previous v1 record when necessary. The new schema reserves sanitized fields for:

- current and discovered planets;
- cleared planets;
- defeated orbital guardians and surface bosses;
- per-planet checkpoints;
- upgrade points;
- existing high score, highest wave, and victory records.

No wallet, network, token, signing, or payout capability is present.

## Phase Boundary

Phase U is the campaign spine, not a claim that all ten missions are playable. Only Ledger Prime is initially available. Phase V supplies its extended space approach, orbital guardian gate, descent, surface assault, and surface boss.

## Verification

- `npm test` validates ten unique routed planets plus the existing content and progress contracts.
- `npm run build` must pass TypeScript and Vite production checks.
- Manual desktop/mobile pass: select Ledger Prime, confirm its briefing, deploy to ship select, return to the map, and enter Arcade Test Run.
