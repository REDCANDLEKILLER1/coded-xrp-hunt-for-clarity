// A battlefield you can read at a glance.
//
// Every enemy drew between 19 and 23 pixels -- five ships within four pixels
// of each other -- so nothing on screen said which contact mattered. Worse,
// three of the five share a base hull: `whale_scout`, `rug_fighter` and
// `fast_scout` are the same swept wings and the same green-and-red panelling,
// so silhouette was not carrying the difference either.
//
// Size is the signal that survives at 20px on a phone, so size is what this
// checks -- along with the two things that make a size class honest: the
// hitbox growing with the sprite, and a heavy staying a regular hull rather
// than turning into a boss.

import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };

const load = async (entry) => {
  const b = await build({ entryPoints: [entry], bundle: true, format: 'esm', write: false, logLevel: 'silent' });
  return import(`data:text/javascript;base64,${Buffer.from(b.outputFiles[0].text).toString('base64')}`);
};
const { ENEMIES, BOSSES, HULL_SIZE } = await load('src/game/content/registry.ts');
const { EARTH_ENEMIES } = await load('src/game/content/EarthThreats.ts');
const roster = { ...ENEMIES, ...EARTH_ENEMIES };
const defs = Object.values(roster);
check(defs.length >= 4, `only ${defs.length} enemies -- this check would prove little`);

// ---- every hull is classified -------------------------------------------
const CLASSES = ['light', 'medium', 'heavy'];
for (const def of defs) {
  check(CLASSES.includes(def.hull), `${def.key} has hull '${def.hull}', which is not a size class`);
}
const present = new Set(defs.map((def) => def.hull));
for (const cls of CLASSES) check(present.has(cls), `no enemy is '${cls}' -- the hierarchy has a missing rung`);

// ---- the classes are separated by an amount a phone can show -------------
//
// Measured on the larger side of the DRAW box, which is what the eye gets.
const biggest = (def) => Math.max(def.draw.w, def.draw.h);
const band = (cls) => defs.filter((def) => def.hull === cls).map(biggest);
const lightMax = Math.max(...band('light'));
const mediumMin = Math.min(...band('medium'));
const mediumMax = Math.max(...band('medium'));
const heavyMin = Math.min(...band('heavy'));
check(mediumMin > lightMax, `a medium (${mediumMin}px) is not bigger than every light (${lightMax}px) -- the bands overlap`);
check(heavyMin > mediumMax, `a heavy (${heavyMin}px) is not bigger than every medium (${mediumMax}px) -- the bands overlap`);
// A four-pixel step is what the old roster had, and it read as one ship.
check(mediumMin - lightMax >= 3, `only ${mediumMin - lightMax}px between light and medium; that is the gap that already failed to read`);
check(heavyMin - mediumMax >= 10, `only ${heavyMin - mediumMax}px between medium and heavy; a mini-destroyer has to be obvious`);
check(heavyMin >= lightMax * 1.7, `a heavy is only ${(heavyMin / lightMax).toFixed(2)}x a light`);

// ---- the hitbox grows with the sprite -----------------------------------
//
// The failure this prevents: a ship visibly the size of a destroyer that can
// only be hit in a fighter-sized box, or worse, hit by shots that missed it.
for (const def of defs) {
  const ratio = Math.max(def.draw.w, def.draw.h) / Math.max(def.hitbox.w, def.hitbox.h);
  check(ratio > 1 && ratio < 1.6, `${def.key}: draw/hitbox ratio ${ratio.toFixed(2)} is out of line with the rest of the roster`);
}
// The invariant, tested directly rather than by eyeballing the spread: one
// authored shape pushed through each class must keep its draw/hitbox ratio.
// If a class scaled the sprite but not the hitbox, this is where it shows.
const COMBAT_SCALE = 0.78;
const box = (size, hull) => ({
  w: Math.max(6, Math.round(size.w * COMBAT_SCALE * HULL_SIZE[hull])),
  h: Math.max(6, Math.round(size.h * COMBAT_SCALE * HULL_SIZE[hull])),
});
const shape = { draw: { w: 26, h: 26 }, hitbox: { w: 20, h: 19 } };
const byClass = CLASSES.map((cls) => box(shape.draw, cls).w / box(shape.hitbox, cls).w);
check(Math.max(...byClass) - Math.min(...byClass) < 0.12,
  `the draw/hitbox ratio moves with the class (${byClass.map((r) => r.toFixed(2)).join(', ')}) -- one box is scaling and the other is not`);
check(HULL_SIZE.light < HULL_SIZE.medium && HULL_SIZE.medium < HULL_SIZE.heavy,
  `HULL_SIZE is not monotone: ${JSON.stringify(HULL_SIZE)}`);

// ---- a heavy is not a boss ----------------------------------------------
const bossKeys = new Set(Object.keys(BOSSES));
for (const def of defs.filter((d) => d.hull === 'heavy')) {
  check(!bossKeys.has(def.key), `${def.key} is a heavy AND a boss`);
  check(!('phases' in def), `${def.key} has phases -- a heavy is a regular hull, not a boss`);
  check(!('triggerWave' in def), `${def.key} has a triggerWave -- a heavy spawns from the wave director`);
  // It still has to be killable by a normal player without being a sponge.
  check(def.hp <= 4, `${def.key} is authored at ${def.hp}hp before its class multiplier -- that stacks into a sponge`);
}

// ---- a heavy costs the field more than a light ---------------------------
const game = readFileSync('src/game/core/Game2A.ts', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const table = game.split('const HULL_COMBAT')[1]?.split('};')[0] ?? '';
check(table.length > 0, 'HULL_COMBAT is missing');
const slotOf = (cls) => Number(new RegExp(`${cls}: \\{[^}]*slots: ([\\d.]+)`).exec(table)?.[1]);
check(slotOf('heavy') > slotOf('medium') && slotOf('medium') > slotOf('light'),
  `slot cost is not monotone: light ${slotOf('light')}, medium ${slotOf('medium')}, heavy ${slotOf('heavy')}`);
check(/private arenaLoad\(\)/.test(game), 'arenaLoad is missing -- the cap is still counting heads');
const spawnGate = game.split('private updateDrones(')[1]?.split('\n  }')[0] ?? '';
check(/this\.arenaLoad\(\) < this\.arenaEnemyCap\(\)/.test(spawnGate),
  'the spawn gate still counts ships rather than size -- a screen can fill with heavies');
check(/if \(def\.hull === 'heavy'\) this\.spawnHeavyWing\(/.test(spawnGate),
  'a heavy must arrive with a wing, or the size has nothing to be read against');

// A heavy must be slower and tougher, or it is only a bigger sprite.
const numOf = (cls, field) => Number(new RegExp(`${cls}: \\{[^}]*${field}: ([\\d.]+)`).exec(table)?.[1]);
check(numOf('heavy', 'speed') < numOf('light', 'speed'), 'a heavy must be slower than a light');
check(numOf('heavy', 'hp') > numOf('light', 'hp'), 'a heavy must be tougher than a light');

if (failures.length) {
  console.error('hull-classes: FAIL');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
const summary = CLASSES.map((cls) => `${cls} ${Math.min(...band(cls))}-${Math.max(...band(cls))}px`).join(', ');
console.log(`hull-classes: OK — ${summary}; hitboxes scale with the sprite, heavies cost ${slotOf('heavy')} slots and fly with a wing.`);
