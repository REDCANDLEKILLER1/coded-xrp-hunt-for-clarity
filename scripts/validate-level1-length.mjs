// How long Level 1 MODELS at. Nobody has played it with a stopwatch.
//
// "Use all of the assets you got to make the first level really long we want it
// to be a game in itself I mean like an hour."
//
// This does not eyeball the group count — it drives the real bundled encounter
// director through every authored act and models the clock: each group costs
// its authored rest, plus the time to actually kill what it spawns, plus the
// arena's own dwell before an enemy commits. The estimate is deliberately
// conservative (perfect play, nothing fled, no deaths, no boss phases).
//
// IT IS STILL A MODEL, AND THE TITLE SAYS SO ON PURPOSE. The number this
// prints is derived from authored encounter data and boss health, not from a
// human finishing the level once and reading a clock. The distinction earned
// its own line because this file previously carried a flat nine-minute
// constant under a comment claiming "Measured floors, not guesses" — a figure
// that was neither measured nor a floor, and that went unquestioned for as
// long as it sounded like it had been. A modelled number that says it is
// modelled can be argued with; one wearing the word "measured" cannot.
//
// An end-to-end human playthrough is the thing that would settle it, and this
// is not that.

import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

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

// ---- what the bosses cost, computed rather than assumed --------------------
//
// This was `const BOSS_AND_INTERIOR_SECONDS = 60 * 9`, under a comment claiming
// "Measured floors, not guesses". It was neither: a flat nine minutes, never
// decomposed, covering "bosses + interior" — and the interior has not been in
// the mission flow for some time. `src/main.ts` sends boarding straight to the
// 3D cockpit and the on-foot code is reachable only on `?onfoot`, so a third of
// the modelled length of Level 1 was a section the player never reaches.
//
// Each boss act is now priced from its own authored numbers: the reveal it
// actually plays, plus the fight its health implies against the ladder, using
// the same firepower model the game and validate-difficulty use. Adding or
// removing a boss updates the estimate on its own.
const bossBundle = await build({
  entryPoints: ['src/game/content/missions/index.ts', 'src/game/content/EarthBossFlow.ts'],
  bundle: true, format: 'esm', write: false, logLevel: 'silent', outdir: 'out-boss',
});
const pickBoss = async (name) => import(`data:text/javascript;base64,${Buffer.from(
  bossBundle.outputFiles.find((f) => f.path.endsWith(`${name}.js`)).text).toString('base64')}`);
const { EARTH_LEDGER_PRIME_MISSION } = await pickBoss('index');
const { guardianPlanFor } = await pickBoss('EarthBossFlow');

const game = readFileSync('src/game/core/Game2A.ts', 'utf8');
const numOf = (name) => Number(new RegExp(`const ${name} = ([\\d.]+);`).exec(game)?.[1]);
const BASE = numOf('BASE_PLAYER_DPS') || 1 / 0.14;
const CAP = numOf('FIREPOWER_CAP');
const MAX_VOLLEY = numOf('MAX_VOLLEY');
const MAX_BARRELS = numOf('MAX_BARRELS');

const regBundle = await build({
  entryPoints: ['src/game/content/registry.ts'],
  bundle: true, format: 'esm', write: false, logLevel: 'silent',
});
const { BOSSES, WEAPONS } = await import(
  `data:text/javascript;base64,${Buffer.from(regBundle.outputFiles[0].text).toString('base64')}`);

// Mid-ladder loadout: the gun a player actually holds when they reach a boss,
// not the best or worst case. Boss health scales with firepower, so the fight
// length is close to flat across the ladder by design — that is what
// validate-difficulty pins — and any rung gives a representative number.
const ladder = Object.values(WEAPONS).sort((a, b) => a.tier - b.tier);
const mid = ladder[Math.floor(ladder.length / 2)];
let shots = mid.shots.length;
for (let pair = 1; pair <= Math.floor(MAX_BARRELS / 2); pair += 1) {
  if (shots + 2 > MAX_VOLLEY) break;
  shots += 2;
}
const playerDps = (shots * mid.damage) / mid.fireRate;
const firepower = Math.min(CAP, Math.max(1, playerDps / BASE));

// The interior is gone. Anything after boarding is the 3D transit, which is a
// separate segment with its own length and is not Level 1's to claim.
const INTERIOR_ACTS = ['warship_interior', 'ledger_defense_core'];
for (const dead of INTERIOR_ACTS) {
  check(
    !EARTH_LEDGER_PRIME_MISSION.acts.some((act) => act.key === dead),
    `"${dead}" is back in the mission spine — the on-foot interior is superseded and must not be counted`,
  );
}

// Subsystem health of the warship disable sequence, read from its own source
// rather than restated, so re-tuning a battery moves this estimate too.
const warshipSource = readFileSync('src/game/content/RegulatoryWarship.ts', 'utf8');
const WARSHIP_SYSTEM_HP = [...warshipSource.matchAll(/label: '[^']+', hp: (\d+),/g)].map((m) => Number(m[1]));
check(WARSHIP_SYSTEM_HP.length >= 5, `read ${WARSHIP_SYSTEM_HP.length} warship subsystems — the scraper is broken`);

const bossRows = [];
let bossSeconds = 0;
for (const act of EARTH_LEDGER_PRIME_MISSION.acts) {
  if (act.mode !== 'boss') continue;
  const plan = guardianPlanFor(act.key);
  const def = BOSSES[act.key];
  // The reveal a guardian actually plays before a shot is fired.
  const reveal = plan ? plan.musicLeadSeconds + plan.creepSeconds + plan.postEntranceHoldSeconds : 2;

  // The Regulatory Warship is not a BOSSES entry — it is its own system, a
  // disable sequence over six destructible subsystems rather than one health
  // bar. Priced from those subsystems so it is not silently credited with a
  // zero-second fight, which is what a plain BOSSES lookup gave it.
  let fight;
  if (def) {
    // Health scales with the loadout, so the fight does not collapse as you
    // climb. 0.73 is the armour multiplier validate-difficulty models through.
    fight = ((def.hp * firepower) / 0.73) / playerDps;
  } else if (act.key === 'regulatory_warship') {
    const systemHp = WARSHIP_SYSTEM_HP.reduce((sum, hp) => sum + hp, 0);
    // Phases gate which systems are exposed, so a good deal of the fight is
    // spent unable to damage anything. The multiplier is that dead time.
    fight = ((systemHp * firepower) / playerDps) * 1.8;
  } else {
    fight = 0;
  }
  check(def || !plan, `boss act "${act.key}" has no boss definition`);
  check(fight > 0, `boss act "${act.key}" is modelled as a zero-second fight — it is not being priced`);
  bossRows.push({ key: act.key, reveal, fight });
  bossSeconds += reveal + fight;
}
check(bossRows.length >= 3, `Level 1 models ${bossRows.length} boss acts — the run to the first one was the whole complaint`);

const totalMinutes = (total + bossSeconds) / 60;

for (const row of rows) console.log(`  ${row.actKey.padEnd(20)} ${String(row.groups).padStart(2)} groups  ~${row.minutes.toFixed(1)} min`);
for (const row of bossRows) {
  console.log(`  ${row.key.padEnd(20)} boss      ~${((row.reveal + row.fight) / 60).toFixed(1)} min`
    + `   (reveal ${row.reveal.toFixed(1)}s + fight ${row.fight.toFixed(0)}s)`);
}

// ---- the pacing complaint, as an assertion --------------------------------
//
// "In the first level, might need a couple more big bosses, or shorten the
// length to get to Gary Fog." Modelled, that was 16.7 minutes of formations
// before anything that was not another formation. The fix was to place two
// bosses that were already fully authored and had never been put in a level.
// This pins the gap so it cannot silently reopen.
let elapsed = 0;
let firstBossAt = null;
const actMinutes = new Map(rows.map((r) => [r.actKey, r.minutes]));
for (const act of EARTH_LEDGER_PRIME_MISSION.acts) {
  if (act.mode === 'boss' && firstBossAt === null) firstBossAt = elapsed;
  elapsed += actMinutes.get(act.key) ?? 0;
}
check(firstBossAt !== null, 'Level 1 has no boss act at all');
check(
  firstBossAt !== null && firstBossAt < 9,
  `the first boss arrives ${firstBossAt?.toFixed(1)} min in — too long a run of formations before anything is an event`,
);
console.log(`  first boss at ~${firstBossAt?.toFixed(1)} min, ${bossRows.length} boss acts total`);

// ---- a boss act must END, and must arrive like an event -------------------
//
// Both of these were found by mutation: the gate passed with each of them
// broken, and each is worse than the pacing problem this PR set out to fix.
{
  const code = game.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const damage = code.split('private damageBoss(')[1]?.split('\n  }\n')[0] ?? '';
  check(damage.length > 0, 'could not find damageBoss — the scraper is broken');

  // THE STALL. A guardian act is finished by killing the boss, and nothing
  // else finishes it. Before the intermediate bosses there was one guardian
  // and it advanced the mission by hand; every other boss fell through to a
  // clear-timer, which is correct for the wave ladder and fatal for an act.
  // Drop the advance and the Behemoth dies, the sky empties, and Level 1 sits
  // on a completed act with nothing left to kill and no way forward.
  const guardianBranch = damage.split('if (missionGuardian)')[1]?.split('\n    }')[0] ?? '';
  check(guardianBranch.length > 0, 'damageBoss has no guardian branch — a boss act would never complete');
  check(
    /this\.missionDirector\.advance\(\)/.test(guardianBranch),
    'killing a guardian must advance the mission, or the level stalls on that act forever',
  );
  check(
    /this\.recordCheckpointForCurrentAct\(\)/.test(guardianBranch),
    'a guardian must bank the act it moves into, or dying after one replays the boss',
  );

  // THE SNAP-IN. The creeping entrance is what makes a guardian read as an
  // event rather than as another spawn, and being an event is the entire
  // reason these two were placed. Gating it on one boss key gives the new
  // pair the 1.45s wave-boss arrival instead.
  const intro = code.split("if (boss.state === 'intro')")[1]?.split('boss.y += (this.bossRestY()')[0] ?? '';
  check(intro.length > 0, 'could not find the boss intro branch');
  check(
    /guardianPlanFor\(/.test(intro),
    'the creeping entrance must be driven by the guardian plan, not by a hard-coded act',
  );
  for (const key of ['gary_fog', 'regulatory_behemoth', 'clarity_destroyer']) {
    check(
      !intro.includes(`'${key}'`),
      `the boss entrance is keyed to '${key}' by hand — every guardian creeps in, or the others land as wave spawns`,
    );
  }
}

// Skilled, no-death, nothing-fled play. A real first run is a good deal longer.
// The floor dropped from 30 when the phantom interior stopped being counted:
// nothing was removed from the level, the model simply stopped crediting it
// with nine minutes of a section that is not in the flow.
check(totalMinutes >= 22, `Level 1 models at ~${totalMinutes.toFixed(0)} min of perfect play — too short to stand on its own`);

if (failures.length) {
  console.error('level1-length: FAIL');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(
  `level1-length: OK — modelled at ~${totalMinutes.toFixed(0)} min of perfect play across `
  + `${rows.reduce((n, r) => n + r.groups, 0)} authored groups (estimate, not a stopwatch playthrough).`,
);
