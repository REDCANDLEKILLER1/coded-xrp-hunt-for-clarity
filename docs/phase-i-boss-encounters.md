# Phase I — Boss Encounter Infrastructure

## Scope

- Adds a pure `BossDirector` for encounter ordering, unlock selection, and HP-phase resolution.
- Defines the four planned campaign bosses as validated data records at waves 5, 9, 13, and 17.
- Adds reusable boss intro, movement, multi-phase attacks, hostile projectiles, collision, health, scoring, and defeat flow.
- Pauses normal drone and turret spawns during encounters and clears the field when a boss arrives.
- Adds boss HUD health/phase display, warning and clear banners, bomb damage, and one-hit Clarity Pulse damage.
- Uses procedural boss silhouettes until approved runtime boss assets are integrated in a separate asset PR.

## Encounter Ladder

| Wave | Boss | HP | Attack progression |
| --- | --- | ---: | --- |
| 5 | Gary Fog | 36 | aimed → spread → burst |
| 9 | Regulatory Behemoth | 58 | spread → sweep → burst |
| 13 | Clarity Destroyer | 82 | sweep → spread → burst |
| 17 | Final Clarity | 120 | aimed → sweep → burst |

Boss score rewards are deliberately bounded so defeating a boss does not immediately skip to the next encounter in the score-driven wave model.

## Verification

- Pure content validation checks boss ordering, unlocks, completion gating, descending phase thresholds, phase resolution, and combat tuning values.
- Production build must pass TypeScript and Vite checks.
- Manual pass: trigger a wave-5 intro, confirm normal spawns pause, phase label changes with HP, bombs damage without clearing the boss, pulse damages once, and defeat resumes waves without repeating the encounter.
