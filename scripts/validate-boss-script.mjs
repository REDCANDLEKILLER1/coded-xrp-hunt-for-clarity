// Boss attack scripts, and enemy tactics.
//
// The first boss was a single aimed stream on a timer. That is not a pattern:
// there is nothing to read, so it is unlearnable and easy at the same time.
// Each move now telegraphs, fires, and leaves the boss open, in a fixed order.
//
// The armour numbers only mean something read against the timings. The first
// pass used 0.45x armoured / 1.85x exposed with recoveries LONGER than the
// wind-ups, so the boss spent over half of every cycle exposed and the average
// multiplier came out at ~1.0 -- it died faster than before the script
// existed. That is what this file exists to catch.

import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };

const bundle = await build({
  entryPoints: ['src/game/content/registry.ts'],
  bundle: true,
  format: 'esm',
  write: false,
  logLevel: 'silent',
});
const { BOSSES, ENEMIES, BOSS_ATTACK_KEYS } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`
);

const game = readFileSync('src/game/core/Game2A.ts', 'utf8');

// ---- read the tuning out of the source, so the test cannot drift ---------
const table = game.split('const BOSS_ATTACKS:')[1]?.split('};')[0] ?? '';
const timings = {};
for (const m of table.matchAll(/(\w+):\s*\{\s*telegraph:\s*([\d.]+),\s*active:\s*([\d.]+),\s*recover:\s*([\d.]+)/g)) {
  timings[m[1]] = { telegraph: Number(m[2]), active: Number(m[3]), recover: Number(m[4]) };
}
check(Object.keys(timings).length === BOSS_ATTACK_KEYS.length,
  `parsed ${Object.keys(timings).length} attack timings for ${BOSS_ATTACK_KEYS.length} attack keys`);

const armoured = Number(/const BOSS_ARMOURED = ([\d.]+);/.exec(game)?.[1]);
const exposed = Number(/const BOSS_EXPOSED = ([\d.]+);/.exec(game)?.[1]);
check(armoured > 0 && armoured < 1, `BOSS_ARMOURED should reduce damage, got ${armoured}`);
check(exposed > 1, `BOSS_EXPOSED should increase damage, got ${exposed}`);

// A telegraph the player cannot react to is just a delay before an unavoidable
// hit. 0.45s is roughly a slow human reaction plus a small move.
for (const [key, t] of Object.entries(timings)) {
  check(t.telegraph >= 0.45, `${key}: a ${t.telegraph}s telegraph is too short to read`);
  check(t.recover > 0, `${key}: needs a recovery window, or there is nothing to learn the pattern FOR`);
}

// ---- the scripted boss must actually be tougher, not just noisier --------
const scripted = Object.values(BOSSES).filter((boss) => boss.phases.some((p) => p.attacks?.length));
check(scripted.length > 0, 'no boss has an attack script');

for (const boss of scripted) {
  for (const [index, phase] of boss.phases.entries()) {
    if (!phase.attacks?.length) continue;
    let total = 0;
    let recovery = 0;
    for (const key of phase.attacks) {
      const t = timings[key];
      check(!!t, `${boss.key}.phases.${index}: no timing for "${key}"`);
      if (!t) continue;
      total += t.telegraph + t.active + t.recover;
      recovery += t.recover;
    }
    const openFraction = recovery / total;
    const average = (1 - openFraction) * armoured + openFraction * exposed;
    // THE check. Armour that averages out above 1 is not armour.
    check(
      average < 0.95,
      `${boss.key}.phases.${index}: average damage multiplier is ${average.toFixed(2)} -- `
      + `the boss is open ${(openFraction * 100).toFixed(0)}% of the cycle, so "armour" makes it die FASTER`,
    );
    // And the window still has to be worth going for.
    check(
      openFraction >= 0.15,
      `${boss.key}.phases.${index}: open only ${(openFraction * 100).toFixed(0)}% of the cycle -- no punish window`,
    );
  }
}

// Effective health, which is the number that decides whether it feels easy.
const gary = BOSSES.gary_fog;
check(!!gary, 'gary_fog is missing');
if (gary) {
  const first = gary.phases[0];
  let total = 0, recovery = 0;
  for (const key of first.attacks ?? []) {
    const t = timings[key]; total += t.telegraph + t.active + t.recover; recovery += t.recover;
  }
  const average = (1 - recovery / total) * armoured + (recovery / total) * exposed;
  const effective = gary.hp / average;
  check(effective >= 90, `gary_fog effective health is ${effective.toFixed(0)}; the fight is still short`);
  console.log(`  gary_fog: ${gary.hp} hp at ${average.toFixed(2)}x average = ${effective.toFixed(0)} effective`);
}

// Phase 1 teaches, so it must be the simplest script and phase 3 the busiest.
if (gary) {
  const lengths = gary.phases.map((p) => p.attacks?.length ?? 0);
  check(
    lengths.every((n, i) => i === 0 || n >= lengths[i - 1]),
    `gary_fog phases should not get simpler as they go: ${lengths.join(' -> ')}`,
  );
}

// Fixed order is the whole premise -- nothing may shuffle the script.
const runner = game.split('private runBossScript(')[1]?.split('\n  }\n')[0] ?? '';
check(runner.length > 0, 'runBossScript is missing');
check(!/Math\.random\(\)/.test(runner), 'the attack order must be fixed, or there is no pattern to learn');
check(/boss\.attackIndex \+= 1/.test(runner), 'the script must advance one move at a time');

// The fog wall opens its gap where the player already is: standing still is
// always survivable, so the move can never be an unavoidable hit.
const aim = game.split('private aimBossAttack(')[1]?.split('\n  }\n')[0] ?? '';
check(/this\.player\.x/.test(aim), 'the fog wall gap must be placed relative to the player');

// ---- enemy ships need their own tactics ---------------------------------
const tactics = game.split('const ENEMY_TACTICS:')[1]?.split('};')[0] ?? '';
check(tactics.length > 0, 'ENEMY_TACTICS is missing');
const rows = [...tactics.matchAll(/(\w+):\s*\{\s*sway:\s*([\d.]+),\s*swaySpeed:\s*([\d.]+),\s*dive:\s*([\d.]+),\s*burst:\s*(\d+)/g)]
  .map((m) => ({ key: m[1], sway: Number(m[2]), swaySpeed: Number(m[3]), dive: Number(m[4]), burst: Number(m[5]) }));
const behaviors = [...new Set(Object.values(ENEMIES).map((e) => e.behavior))];
check(rows.length >= 4, `expected a tactic per behaviour, parsed ${rows.length}`);
for (const behavior of behaviors) {
  check(rows.some((r) => r.key === behavior), `behaviour "${behavior}" has no entry in ENEMY_TACTICS`);
}
// They must actually differ. The old code varied only the sway width, which is
// why every ship felt the same.
for (const field of ['sway', 'swaySpeed', 'dive', 'burst']) {
  const values = new Set(rows.map((r) => r[field]));
  check(values.size >= 3, `every behaviour shares nearly the same ${field} (${[...values].join(', ')})`);
}
check(/ENEMY_TACTICS\[def\.behavior\]/.test(game.split('private holdStation(')[1]?.split('\n  }\n')[0] ?? ''),
  'holdStation must read the behaviour tactics');
check(/ENEMY_TACTICS\[def\.behavior\]\.dive/.test(game), 'dive chance must be per behaviour, not one global constant');

if (failures.length > 0) {
  console.error('boss-script validation FAILED:');
  for (const line of failures) console.error(`  - ${line}`);
  process.exit(1);
}
console.log('boss-script: OK — telegraphed fixed-order attacks, real armour, four distinct enemy routines.');
