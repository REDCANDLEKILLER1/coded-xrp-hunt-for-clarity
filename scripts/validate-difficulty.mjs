// Difficulty that holds up across the weapon ladder.
//
// Three playtest reports, one arithmetic cause behind all of them.
//
// "If you make it to Gary Fog they die way too easy -- corn killed it in like
// 3 seconds." "All the enemies are too easy to kill, especially when you got a
// master full updated weapon." Sustained player damage spans about 11x from
// the starting gun to a maxed one, and health was a flat number. No single
// number is a fight for both ends: whatever it is set to is either impossible
// with BB SHOT or trivial with a maxed Lance.
//
// "Especially on portrait mode the bullet spread almost covers the whole top
// screen so all you have to do is go back and forth." Barrels fanned outward,
// and an angle becomes width over distance -- on a tall screen the fan swept
// most of the width before the shots got anywhere.

import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };

const game = readFileSync('src/game/core/Game2A.ts', 'utf8');
const registrySrc = readFileSync('src/game/content/registry.ts', 'utf8');

const bundle = await build({
  entryPoints: ['src/game/content/registry.ts'],
  bundle: true, format: 'esm', write: false, logLevel: 'silent',
});
const { WEAPONS, SHIPS, ENEMIES, BOSSES } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`
);

const num = (name) => Number(new RegExp(`const ${name} = ([\\d./ ]+);`).exec(game)?.[1]
  ?.split('/').map(Number).reduce((a, b) => (b === undefined ? a : a / b)));
const MAX_VOLLEY = Number(/const MAX_VOLLEY = (\d+);/.exec(game)?.[1]);
const MAX_BARRELS = Number(/const MAX_BARRELS = (\d+);/.exec(game)?.[1]);
const CAP = Number(/const FIREPOWER_CAP = ([\d.]+);/.exec(game)?.[1]);
const BASE = num('BASE_PLAYER_DPS');

// ---- the barrels are parallel ------------------------------------------
//
// This is the whole portrait complaint. A fan's coverage grows with the screen
// it is fired across; a parallel curtain does not.
const volley = game.split('private currentVolley(')[1]?.split('\n  }\n')[0] ?? '';
check(/offsetX: -offset, angle: 0/.test(volley), 'barrel shots must be parallel');
check(!/angle: -angle/.test(volley), 'the fanned barrel angle is back');

const widest = 13; // QUAD BEAM's outermost muzzle
const curtain = widest + 9 * MAX_BARRELS;
for (const height of [274, 780]) {
  // With angle 0 the curtain is the same at any range, which is the point.
  const coverage = (2 * curtain) / 390;
  check(coverage < 0.3, `a maxed gun covers ${(coverage * 100).toFixed(0)}% of a portrait screen at h=${height}`);
}

// ---- health scales with what the player brings -------------------------
check(BASE > 0, 'BASE_PLAYER_DPS is missing');
check(CAP >= 4, `a firepower cap of ${CAP} cannot cover an 11x damage range`);
check(/private firepowerScale\(\): number \{/.test(game), 'firepowerScale is missing');
check(/private playerDps\(\): number \{/.test(game), 'playerDps is missing');

// Model the ladder the way the game does, and require a consistent fight.
const dpsFor = (weapon, barrels) => {
  let shots = weapon.shots.length;
  for (let pair = 1; pair <= barrels; pair += 1) {
    if (shots + 2 > MAX_VOLLEY) break;
    shots += 2;
  }
  return (shots * weapon.damage) / weapon.fireRate;
};
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const times = [];
for (const weapon of Object.values(WEAPONS)) {
  for (const barrels of [0, MAX_BARRELS]) {
    const dps = dpsFor(weapon, barrels);
    const scale = clamp(dps / BASE, 1, CAP);
    // Gary Fog, through his armour.
    const effective = (BOSSES.gary_fog.hp * scale) / 0.73;
    times.push({ label: `${weapon.label} x${barrels}`, dps, scale, seconds: effective / dps });
  }
}
const seconds = times.map((row) => row.seconds);
const spread = Math.max(...seconds) / Math.min(...seconds);
check(
  spread < 1.8,
  `time to kill the first boss still varies ${spread.toFixed(1)}x across the ladder `
  + `(${Math.min(...seconds).toFixed(0)}s to ${Math.max(...seconds).toFixed(0)}s)`,
);
check(Math.min(...seconds) > 8, `the fastest loadout kills the first boss in ${Math.min(...seconds).toFixed(0)}s`);

// The boss must actually use its own scaled maximum, not the tuning number.
check(/maxHp: number;/.test(game), 'BossActor needs its own maximum');
check(/hp: Math\.round\(def\.hp \* this\.firepowerScale\(\)\)/.test(game), 'boss health must scale at spawn');
check(/this\.boss\.hp \?\? 0\) \/ this\.boss\.maxHp/.test(game), 'the health bar must read against the scaled maximum');
check(/bossPhaseIndex\(def, boss\.hp \?\? boss\.maxHp, boss\.maxHp\)/.test(game),
  'phase thresholds must be measured against the scaled maximum, or a scaled boss opens in its last phase');

// ---- trash scales, but only partly -------------------------------------
const share = Number(/const ENEMY_SCALE_SHARE = ([\d.]+);/.exec(game)?.[1]);
check(share > 0 && share < 1, `ENEMY_SCALE_SHARE of ${share} should be a partial share of the curve`);
check(/private enemyHp\(def: EnemyDef\): number \{/.test(game), 'enemyHp is missing');
check(!/hp: def\.hp,\n\s+enemyKey/.test(game), 'a drone spawn still uses unscaled health');
const toughest = Math.max(...Object.values(ENEMIES).map((enemy) => enemy.hp));
const worst = Math.round(toughest * (1 - share + share * CAP));
check(worst <= 14, `the toughest drone reaches ${worst} health at full scale, which is a sponge`);
check(/private enemySpeed\(def: EnemyDef\): number \{/.test(game), 'enemySpeed is missing');
check(/firepowerScale\(\)/.test(game.split('private arenaEnemyCap(')[1]?.split('\n  }\n')[0] ?? ''),
  'a bigger gun should face more enemies, not just tougher ones');

// ---- smaller ships, hitboxes included ----------------------------------
check(/const COMBAT_SCALE = ([\d.]+);/.test(registrySrc), 'COMBAT_SCALE is missing');
const combat = Number(/const COMBAT_SCALE = ([\d.]+);/.exec(registrySrc)?.[1]);
check(combat > 0.5 && combat < 1, `COMBAT_SCALE of ${combat} is not a shrink`);
// Scaling the sprite without the hitbox gives a ship hit by things that miss.
const scaler = registrySrc.split('function scaled(size: Size): Size {')[1]?.split('\n}\n')[0] ?? '';
check(/w:/.test(scaler) && /h:/.test(scaler), 'the scale helper must resize both axes');
check(/draw: scaled\(def\.draw\), hitbox: scaled\(def\.hitbox\)/.test(registrySrc),
  'draw and hitbox must scale together');
for (const [name, defs] of [['SHIPS', SHIPS], ['ENEMIES', ENEMIES], ['BOSSES', BOSSES]]) {
  for (const [key, def] of Object.entries(defs)) {
    check(def.hitbox.w >= 6 && def.hitbox.h >= 6, `${name}.${key} shrank to an unhittable ${def.hitbox.w}x${def.hitbox.h}`);
    check(def.hitbox.w <= def.draw.w, `${name}.${key} has a hitbox wider than its sprite`);
  }
}

if (failures.length > 0) {
  console.error('difficulty validation FAILED:');
  for (const line of failures) console.error(`  - ${line}`);
  process.exit(1);
}
console.log(
  `difficulty: OK — first boss takes ${Math.min(...seconds).toFixed(0)}-${Math.max(...seconds).toFixed(0)}s `
  + `at every loadout, curtain ${((2 * curtain) / 390 * 100).toFixed(0)}% of portrait, ships at ${combat}x.`,
);
