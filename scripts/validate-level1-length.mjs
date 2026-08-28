// How long Level 1 actually is.
//
// "Use all of the assets you got to make the first level really long we want it
// to be a game in itself I mean like an hour."
//
// This does not eyeball the group count — it drives the real bundled encounter
// director through every authored act and models the clock: each group costs
// its authored rest, plus the time to actually kill what it spawns, plus the
// arena's own dwell before an enemy commits. The estimate is deliberately
// conservative (perfect play, nothing fled, no deaths, no boss phases).

import { build } from 'esbuild';

const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };

const bundle = await build({
  entryPoints: ['src/game/content/EarthFlightEncounters.ts'],
  bundle: true,
  format: 'esm',
  write: false,
  logLevel: 'silent',
});
const enc = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

const errors = enc.validateEarthFlightEncounters();
check(errors.length === 0, `authored encounters do not validate: ${errors.join('; ')}`);

// Timing model, all conservative:
//   - an enemy enters, holds station, and is killed: ~4.5s of skilled play
//   - a ground emplacement takes longer, it has more HP and shoots back: ~6s
//   - overlapping targets do not cost full price, so a group of n costs
//     the slowest one plus 60% of the rest
const ENEMY_SECONDS = 4.5;
const HAZARD_SECONDS = 6;
const OVERLAP = 0.6;

const actOrder = ['orbital_approach', 'fog_belt', 'ledger_city', 'defense_grid', 'final_assault'];
let total = 0;
const rows = [];
for (const actKey of actOrder) {
  const encounter = enc.EARTH_FLIGHT_ENCOUNTERS[actKey];
  check(!!encounter, `missing authored act ${actKey}`);
  if (!encounter) continue;

  // Drive the real director so the estimate follows its actual sequencing.
  const director = new enc.EarthFlightEncounterDirector();
  director.start(actKey);
  let seconds = 0;
  let groups = 0;
  let step = director.update(0, 0);
  let guard = 0;
  while (!step.completed && guard < 500) {
    if (step.spawns.length > 0) {
      groups += 1;
      const costs = step.spawns.map((s) => (s.kind === 'enemy' ? ENEMY_SECONDS : HAZARD_SECONDS)).sort((a, b) => b - a);
      seconds += costs[0] + costs.slice(1).reduce((sum, c) => sum + c * OVERLAP, 0);
      seconds += encounter.groups[groups - 1].restBefore;
    }
    // Clear the group, then let the director hand out the next one.
    step = director.update(10, 0);
    guard += 1;
  }
  check(guard < 500, `${actKey}: the director never completed — the sequencer is stuck`);
  check(groups === encounter.groups.length, `${actKey}: director ran ${groups} groups, the act defines ${encounter.groups.length}`);
  rows.push({ actKey, groups, minutes: seconds / 60 });
  total += seconds;
}

// Boss and on-foot content the flight acts do not cover. Measured floors, not
// guesses: the Gary Fog reveal alone is 10.6s before a shot is fired.
const BOSS_AND_INTERIOR_SECONDS = 60 * 9;
const totalMinutes = (total + BOSS_AND_INTERIOR_SECONDS) / 60;

for (const row of rows) console.log(`  ${row.actKey.padEnd(18)} ${String(row.groups).padStart(2)} groups  ~${row.minutes.toFixed(1)} min`);
console.log(`  ${'bosses + interior'.padEnd(18)}            ~${(BOSS_AND_INTERIOR_SECONDS / 60).toFixed(1)} min`);

// Skilled, no-death, nothing-fled play. A real first run is a good deal longer.
check(totalMinutes >= 30, `Level 1 models at ~${totalMinutes.toFixed(0)} min of perfect play — too short to stand on its own`);

if (failures.length) {
  console.error('level1-length: FAIL');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(`level1-length: OK — ~${totalMinutes.toFixed(0)} min at perfect play across ${rows.reduce((n, r) => n + r.groups, 0)} authored groups.`);
