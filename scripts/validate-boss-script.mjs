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

// ---- the escort screen ---------------------------------------------------
//
// Auto-aim means the player is always on target, so a boss that only shoots
// back is beaten by holding position. The screen makes the answer "clear the
// escorts", which is a different job from reading a telegraph.
const launch = game.split('private launchEscorts(')[1]?.split('\n  }\n')[0] ?? '';
check(launch.length > 0, 'launchEscorts is missing');
check(/escort: true/.test(launch), 'escorts must be tagged, or the shield cannot know they exist');
check(
  /patience: ESCORT_PATIENCE/.test(launch),
  'escorts need a capped patience -- a shield with no timeout can deadlock the fight behind a stray escort',
);
check(/boss\.y/.test(launch), 'escorts should come out of the boss, not drop in from off-screen');

const shielded = game.split('private bossShielded(')[1]?.split('\n  }\n')[0] ?? '';
check(/drone\.escort/.test(shielded), 'the shield must key off live escorts');
check(/!== .fleeing./.test(shielded), 'an escort that has broken off should not keep the shield up');

const scale = game.split('private bossDamageScale(')[1]?.split('\n  }\n')[0] ?? '';
check(/this\.bossShielded\(\)/.test(scale), 'the shield must gate boss damage');
check(/return 0;/.test(scale), 'the shield should block outright -- a percentage is just a slower same fight');

// A blocked hit has to look blocked, or it reads as the game dropping shots.
const damage = game.split('private damageBoss(')[1]?.split('\n  }\n')[0] ?? '';
check(/sfx\.play\(.deny.\)/.test(damage), 'a blocked hit needs a sound');
check(/private drawBossShield\(/.test(game), 'the shield needs to be drawn');
check(/SHIELDED/.test(game), 'the shield should say what to shoot instead');
// It was defined but never called once already -- an aborted edit left the
// renderer orphaned and the bubble simply did not appear.
check(
  /this\.drawBossShield\(this\.boss\)/.test(game),
  'drawBossShield is defined but never called',
);

// Both authored bosses put a screen up, and never as the only move in a phase.
for (const key of ['gary_fog', 'regulatory_behemoth']) {
  const boss = BOSSES[key];
  check(!!boss, `${key} is missing`);
  if (!boss) continue;
  const screens = boss.phases.filter((phase) => phase.attacks?.includes('escort_screen'));
  check(screens.length > 0, `${key} never launches escorts`);
  for (const [index, phase] of boss.phases.entries()) {
    if (!phase.attacks?.includes('escort_screen')) continue;
    check(phase.attacks.length > 1, `${key}.phases.${index}: a phase of nothing but escort screens loops forever`);
  }
  // Not in the opening phase: the player should meet the boss before the
  // boss starts hiding behind other ships.
  check(
    !boss.phases[0].attacks?.includes('escort_screen'),
    `${key}: the first phase should teach the boss, not screen it`,
  );
}

// ---- the arena keeps some pressure on during a boss ---------------------
const pressure = game.split('private bossPressure(')[1]?.split('\n  }\n')[0] ?? '';
check(pressure.length > 0, 'bossPressure is missing -- the arena empties for every boss fight');
check(/BOSS_PRESSURE_CAP/.test(pressure), 'boss-fight spawns need a cap, or the screen becomes a wall');
const cap = Number(/const BOSS_PRESSURE_CAP = (\d+);/.exec(game)?.[1]);
check(cap >= 3 && cap <= 8, `BOSS_PRESSURE_CAP of ${cap} is not a trickle`);
check(/this\.bossPressure\(dt\)/.test(game), 'bossPressure is never called');

// The capital ship scrambles fighters in its back half.
const defenders = game.split('private warshipDefenders(')[1]?.split('\n  }\n')[0] ?? '';
check(defenders.length > 0, 'warshipDefenders is missing');
check(
  /'engines'/.test(defenders) && /'hangar'/.test(defenders),
  'the warship should launch fighters in its late phases',
);
check(/'batteries'/.test(defenders) === false, 'the warship should not scramble fighters from the opening phase');
check(/this\.warshipDefenders\(dt\)/.test(game), 'warshipDefenders is never called');

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
