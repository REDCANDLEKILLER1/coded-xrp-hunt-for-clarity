# Selectable fighter families and durable mastery

The campaign fighter now has five voluntary weapon families with four stages each. The arcade path retains its existing ladder/barrel behavior. Fighter mastery, equipped family and rapid fire are stored in fighterUpgrades; XRPMan powers and capital modules retain their separate fields. Neon #00FF00 identifies friendly fire. TruFi and Blue Umbrella remain allies with their recognizable costume identities.

| Family | First mastery rank | Behavior |
|---|---:|---|
| Liquidity Beam | 1 | Single, twin, tri, quad forward coverage |
| Pulse Lance | 4 | Increasing penetration, paired mastered beams |
| Liquidity Rocket | 7 | Slower physical rockets, bounded splash, paired stage IV |
| Plasma Hammer | 10 | Deliberate heavy impacts, small late-stage splash |
| Ledger Arc | 13 | Up to three secondary hops, 100px per hop / 280px total |

An unlocked family progresses through four stages as mastery rises; it never replaces the equipped style automatically. LOADOUT is available during the launch reveal, pause and an upgrade choice. Its input hold clears stale steering, bomb, pulse and pause input. It closes on map/arcade/scene changes. Locked choices cannot equip. Selection and rapid purchases commit before becoming active. A failed rank save retains the current gun and retries rather than silently downgrading it.

Rapid fire has four ranks, each adding 12% of base firing frequency. Damage, projectile speed and lane geometry are retained. Fractional cadence carries across frames so 30/60FPS does not round away the upgrade. Campaign upgrade offers contain only useful choices; completely full systems bank the owed ranks once and resume. A full bomb rack cannot change the primary weapon.

Each projectile retains its firing-time profile. Piercing shots hit an actor only once even across multiple overlapping frames. Splash and chains use the normal damage gates, respect friendly repair beacons and linked shields, and cannot skip the Warship's system phases. Effect lifetimes and counts are bounded. Original code-rendered energy shapes distinguish the families without adding image bytes.

Legacy migration checks all five base tiers, ranks1–13 and barrel counts0–3. Existing late lances map to mastered Pulse; strong quad/barrel loadouts receive enough Beam mastery to preserve nominal forward DPS. Old checkpoints are left intact. This is conservative upgrade carryover, not an exact reconstruction of every old spread pattern.

## Verification

All49 validators and TypeScript/Vite build pass. The new test drives the actual Game2A firing and collision paths: every stage, centered targets at2/16/60HP, two viewports, grouped targets, 30/60FPS cadence, damage/speed/caps,160 family/stage/heading combinations, repeated-overlap piercing, bounded splash/chains, shield/friendly rules, safe selection, save failure/retry, reload, capped choices and260 migration combinations. It caught a plasma III grouped-target regression at30FPS (3.433s→3.700s); increasing that stage's impact from14 to16 resolves it without changing enemy HP. An extra base-tier migration check also caught and corrected a small old-quad downgrade.

The normal browser launch confirms locked choices, input holds, portrait390×844 and landscape844×390 scrolling, map teardown and reload. An already-earned Gary Fog checkpoint unlocked Pulse IV through the actual panel, emitted the selected live volley and retained it after normal reload. Hero/capital fields were unchanged.

The same earned save then cleared Gary Fog and all20 final-assault groups in148.09s with zero deaths, reaching the Warship checkpoint at mastery9 / rapid2. A separate ordinary checkpoint continuation disabled the Warship at9.90s and reached the actual 3D boarding scene at31.74s, including fighter approach/landing. This is automated mouse-controller evidence, not human pacing or physical-phone acceptance. The older full journey1 save remains intact. Plasma/rocket/ledger screenshots are explicitly controlled renderer studies, not claimed as earned campaign unlocks.

Local evidence: fighter-browser-report.json, fighter-journey-report.json, fighter-warship-journey-report.json, fighter-visual-report.json, fighter-full-gates.log, fighter-build.log and own-game screenshots in the root definitive-authorization folder. No private references or source sheets were uploaded.

Initial JS292.24kB /86.49kB gzip; lazy3D734.06kB /191.88kB gzip. No new runtime asset bytes or dependencies. Flight manifest57/57 loaded with zero missing/errors. Vite's existing lazy3D chunk-size advisory remains. npm ci was already completed for this dependency set; this checkpoint changes only the test script, not dependency versions or lockfile.

## Continue

Continue the real Mars relief-site/Corn handoff, directional environment transitions, modern geometry/material/animation refinement, measured performance and scene soak under PR124. Complete the opening's internal gates before expanding the remaining worlds. Keep PR125 draft; no merge or release.
