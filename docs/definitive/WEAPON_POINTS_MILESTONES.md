# Weapon points and milestones — October 7, 2026

Replaces the six-kill, auto-equipped weapon core ladder. Keeps the fresh-opening test policy from commit 290b4afac84536dbb63c74eb5ae6d12d7386235f.

## Current Earth behavior

Enemy fighter kills and destroyed hostile ground defenses earn one weapon point. A WPN cache drops every 24 fighter kills, while Earth milestones remain available, and adds four bonus points when collected. Point caches do not change the equipped family or rapid-fire rank. General upgrades remain independent.

| Total weapon points | Milestone | Equipped weapon behavior |
| --- | --- | --- |
| 0 | Liquidity Beam I | Fresh starting gun |
| 24 | Liquidity Beam II | Beam refines to twin coverage |
| 64 | Liquidity Beam III | Beam refines to three-lane coverage |
| 120 | Liquidity Beam IV | Beam refines to quad coverage |
| 200 | Pulse Lance I unlocked | Current gun stays equipped; select Lance in Weapons |

There are four earned milestones on Earth. Each opens a paused Level Up loadout screen with Continue and selectable unlocked families. Point progress appears on the Weapons button and in the loadout. A story interruption retains the pending milestone; returning to combat shows it. Switching families is explicit. Further Earth kills do not unlock the entire future arsenal. Rockets, plasma and ledger weapons remain later-world options; later-world point progression is not implemented in this change.

## Balance

For the new campaign state, the starting beam's stages increase sustained primary DPS to 1, 1.45, 1.95 and 2.5 times baseline; extra lanes also add coverage. The unlocked Pulse Lance has the same primary DPS as the quad beam with piercing utility. Rapid fire and the existing capped twin-seeker contribution are separate. Existing boss firepower accounting remains active.

Future enemy and ground-defense spawns receive a milestone multiplier from 1.0 through 2.2, on top of existing run pressure and hull-class tuning. This reads earned progress, so selecting another unlocked family cannot lower enemy strength. Enemies already on screen are not healed or rewritten by a milestone. Arcade tuning remains unchanged.

## Evidence and limits

Runtime checks exercise ordinary point pickups, 196 actual kill registrations through all four thresholds, paused unlock announcements, input and difficulty-clock freeze, manual Lance selection, no family change on subsequent pickups, sparse drops after other upgrade caps, failed-write collection retry, point reload/default/validation, fresh-opening reset, bounded DPS and increasing enemy/ground-defense health. Existing legacy armory, weapon silhouettes, twin seekers, boss accounting and both viewport tests remain.

Full npm test (68 scripts), TypeScript/Vite build and git diff --check are release gates. Manual phone playtesting is still required to judge pacing and difficulty; automated tests do not establish that the whole mission is fun or perfectly balanced.

Rollback baseline: 290b4afac84536dbb63c74eb5ae6d12d7386235f. Revert this scoped change to restore the preceding core ladder. No wallet, asset, dependency, lockfile, workflow or deployment-configuration changes.
