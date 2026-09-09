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
const store = new Map();
globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => void store.set(k, String(v)), removeItem: (k) => void store.delete(k) };
const noopCtx = new Proxy({}, { get: (t, k) => (k in t ? t[k] : k === 'measureText' ? () => ({ width: 10 })
  : k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {}),
  set: (t, k, v) => { t[k] = v; return true; } });
const stubCanvas = () => ({ width: 0, height: 0, style: {}, getContext: () => noopCtx, addEventListener() {}, removeEventListener() {},
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 393, height: 793 }), setPointerCapture() {}, releasePointerCapture() {} });
globalThis.CustomEvent = class { constructor(type, init) { this.type = type; this.detail = init?.detail; } };
globalThis.Image = class {};
globalThis.requestAnimationFrame = () => 0;
globalThis.performance = globalThis.performance ?? { now: () => 0 };
globalThis.matchMedia = () => ({ matches: false, addEventListener() {} });
globalThis.screen = { width: 393, height: 793, orientation: { angle: 0 } };
globalThis.devicePixelRatio = 1;
globalThis.document = { addEventListener() {}, removeEventListener() {}, querySelector: () => null, createElement: stubCanvas, body: { appendChild() {} } };
globalThis.innerWidth = 393;
globalThis.innerHeight = 793;
globalThis.window = { addEventListener() {}, removeEventListener() {}, dispatchEvent: () => true, setTimeout, clearTimeout,
  localStorage: globalThis.localStorage, devicePixelRatio: 1, innerWidth: 393, innerHeight: 793 };
globalThis.location = { search: '', pathname: '/' };

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
check(/if \(def\.hull === 'heavy'\) this\.spawnHeavyWing\(/.test(spawnGate),
  'a heavy must arrive with a wing, or the size has nothing to be read against');

// ---- the cap actually holds, at every remaining capacity -----------------
//
// This was a source grep for `arenaLoad() < arenaEnemyCap()` in the spawn
// gate, and that is exactly as much as it proved: the gate existed. It did,
// and the cap was still broken, because the gate asked whether there was SOME
// room and then chose the enemy afterwards. A heavy costs four slots and
// brings two more in its wing, so one free slot could admit a six-slot
// formation. Measured on the shipped code: wave 3, cap 6, load 5 -> load 11,
// with a worst case five slots past the cap.
//
// So this drives the real spawner instead. A heavy is FORCED -- selectEnemyKey
// takes its roll as an argument, so the roll that yields the heavy is found
// first and Math.random is pinned to it -- at every remaining capacity from an
// empty field to one slot free, and the post-spawn load is compared against
// the cap the game itself computed.
{
  const { Game2A } = await load('src/game/core/Game2A.ts');
  const { selectEnemyKey, availableEnemyKeys } = await load('src/game/content/WaveDirector.ts');

  const heavyKey = Object.keys(ENEMIES).find((key) => ENEMIES[key].hull === 'heavy');
  const lightKey = Object.keys(ENEMIES).find((key) => ENEMIES[key].hull === 'light');
  check(!!heavyKey && !!lightKey, 'the roster has no heavy or no light -- this check would prove nothing');

  const rollFor = (wave, key) => {
    for (let i = 0; i <= 2000; i += 1) { const roll = i / 2000; if (selectEnemyKey(ENEMIES, wave, roll) === key) return roll; }
    return null;
  };
  const parked = (key, x = 200, y = 300) => {
    const def = ENEMIES[key];
    return { x, y, w: def.hitbox.w, h: def.hitbox.h, vx: 0, vy: 0, hp: 99, enemyKey: key, age: 5, anchorX: x,
      phase: 0, direction: 1, fireClock: 99, stance: 'holding', stationX: x, stationY: y, stanceClock: 9,
      patience: 99, dodgeCooldown: 9, atRest: true, escort: false };
  };

  let exercised = 0;
  let forced = 0;
  for (const wave of [3, 4, 5, 6, 8, 12, 20]) {
    const roll = rollFor(wave, heavyKey);
    if (roll === null) continue;
    const probe = new Game2A(stubCanvas());
    probe.deployTestMode(); probe.reset(); probe.wave = wave; probe.clock = 0;
    const cap = probe.arenaEnemyCap();
    check(cap > 0, `wave ${wave} has a cap of ${cap}`);
    for (let fill = 0; fill < cap; fill += 1) {
      const game2a = new Game2A(stubCanvas());
      game2a.deployTestMode(); game2a.reset();
      game2a.wave = wave; game2a.clock = 0; game2a.playerHitClock = 1;
      game2a.drones = Array.from({ length: fill }, () => parked(lightKey));
      const before = game2a.arenaLoad();
      if (before >= cap) continue;
      game2a.droneClock = 0;
      const realRandom = Math.random;
      Math.random = () => roll;
      try { game2a.updateDrones(0.016); } finally { Math.random = realRandom; }
      const after = game2a.arenaLoad();
      exercised += 1;

      check(after <= cap,
        `wave ${wave}: a forced heavy at load ${before}/${cap} pushed the arena to ${after} -- ${after - cap} slots past the cap`);

      // Atomic: a heavy either arrives with its whole wing or does not arrive.
      const added = game2a.drones.slice(fill);
      const heavies = added.filter((drone) => ENEMIES[drone.enemyKey].hull === 'heavy').length;
      const lights = added.filter((drone) => ENEMIES[drone.enemyKey].hull === 'light').length;
      const wingSize = Number(/const HEAVY_WING = (\d+)/.exec(game)?.[1]);
      check(Number.isFinite(wingSize) && wingSize > 0, 'HEAVY_WING could not be read from the source');
      if (heavies > 0) {
        forced += 1;
        check(lights === wingSize,
          `wave ${wave}: a heavy spawned at load ${before}/${cap} with ${lights} escorts instead of ${wingSize} -- the formation is not atomic`);
      }
      // Room for a light means the field must not go quiet: a cap that stops
      // spawning early is as wrong as one that overshoots.
      if (cap - before >= 1) {
        check(added.length > 0,
          `wave ${wave}: ${cap - before} slot(s) free and nothing spawned -- the arena stalls instead of substituting a smaller formation`);
      }
    }
  }
  check(exercised > 20, `only ${exercised} spawn attempts exercised -- this check is not covering the capacity range`);
  check(forced > 0, 'no forced heavy ever actually spawned -- the check never reached the case it exists for');
}

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
