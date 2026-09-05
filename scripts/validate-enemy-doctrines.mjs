// Six ships, six silhouettes, one gun.
//
// Every armed enemy pushed a single aimed `enemy_missile` at its own
// projectileSpeed. The roster differed by cadence and accent colour and
// nothing else, so a bestiary that READS as varied PLAYS as one enemy
// repeated. A player cannot learn a threat that has no signature.
//
// This drives the shipped `enemyFire` for each enemy in the registry and
// inspects the shots that land in `hostileShots`. It does not re-implement the
// doctrine table and check its own copy.

import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };

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
globalThis.window = { addEventListener() {}, removeEventListener() {}, dispatchEvent: () => true,
  setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout: (h) => clearTimeout(h),
  localStorage: globalThis.localStorage, devicePixelRatio: 1, innerWidth: 393, innerHeight: 793 };
globalThis.location = { search: '', pathname: '/' };

const load = async (entry) => {
  const b = await build({ entryPoints: [entry], bundle: true, format: 'esm', write: false, logLevel: 'silent' });
  return import(`data:text/javascript;base64,${Buffer.from(b.outputFiles[0].text).toString('base64')}`);
};
const { Game2A } = await load('src/game/core/Game2A.ts');
const { ENEMIES, PROJECTILES } = await load('src/game/content/registry.ts');
const { EARTH_ENEMIES } = await load('src/game/content/EarthThreats.ts');

const roster = { ...ENEMIES, ...EARTH_ENEMIES };
const armed = Object.values(roster).filter((def) => def.fireRate && def.projectileSpeed);
check(armed.length >= 4, `only ${armed.length} armed enemies -- this check would prove little`);

const g = new Game2A(stubCanvas());
g.deployTestMode();
g.reset();
g.player.x = 196;
g.player.y = 700;

/** Fire one volley from `def` and return what it put on the field. */
const volleyOf = (def) => {
  g.hostileShots.length = 0;
  const drone = {
    x: 196, y: 200, w: def.hitbox.w, h: def.hitbox.h, vx: 0, vy: 0, hp: def.hp,
    enemyKey: def.key, age: 1, anchorX: 196, phase: 0, direction: 1, fireClock: 0,
    stance: 'diving', stationX: 196, stationY: 200, stanceClock: 0, patience: 9,
    dodgeCooldown: 0, atRest: true, escort: false,
  };
  g.enemyFire(drone, def, 0.016);
  return g.hostileShots.map((shot) => ({
    key: shot.projectileKey,
    size: shot.size,
    homing: shot.homing ?? 0,
    speed: Math.round(Math.hypot(shot.vx, shot.vy)),
    angle: Math.atan2(shot.vy, shot.vx),
  }));
};

const signatures = new Map();
for (const def of armed) {
  const shots = volleyOf(def);
  check(shots.length > 0, `${def.key} fired nothing`);
  if (shots.length === 0) continue;
  check(!!def.doctrine, `${def.key} has no doctrine -- it will fall back to the default gun`);
  for (const shot of shots) {
    check(!!PROJECTILES[shot.key], `${def.key} fires '${shot.key}', which is not a projectile in the registry`);
  }
  // A fan is only a fan if the outer rounds actually diverge.
  const spread = Math.max(...shots.map((s) => s.angle)) - Math.min(...shots.map((s) => s.angle));
  check(shots.length === 1 || spread > 0.05, `${def.key} fires ${shots.length} rounds on the same heading -- that is one shot, not a fan`);
  signatures.set(def.key, {
    doctrine: def.doctrine,
    shots: shots.length,
    key: shots[0].key,
    size: shots[0].size,
    homing: shots[0].homing > 0,
    fan: Number(spread.toFixed(2)),
  });
}

// ---- the roster must not collapse back into one gun ---------------------
const shapes = new Set([...signatures.values()].map((s) => `${s.shots}|${s.key}|${s.size}|${s.homing}|${s.fan}`));
check(shapes.size >= 4, `${signatures.size} armed enemies produce only ${shapes.size} distinct volleys -- the roster still plays as one enemy`);

// A wide fan and a tight burst have to be tellably different widths. Counting
// rounds is not enough: the movement tactic contributes spread of its own, so
// zeroing a doctrine's fan still left the dive-bomber's shots diverging and
// the first version of this check waved it through.
const fans = [...signatures.values()].filter((s) => s.shots > 1).map((s) => s.fan);
if (fans.length > 1) {
  const ratio = Math.max(...fans) / Math.min(...fans);
  check(ratio >= 2, `the widest fan is only ${ratio.toFixed(1)}x the tightest (${fans.join(', ')}) -- a broadside and a burst should not be the same shape`);
}

// Exactly one doctrine tracks. A screen where everything homes is not a
// priority target, it is an unavoidable hit.
const homing = [...signatures.entries()].filter(([, s]) => s.homing);
check(homing.length === 1, `${homing.length} enemies fire tracking rounds; exactly one should (found: ${homing.map(([k]) => k).join(', ') || 'none'})`);

// The tracker must stop tracking, or it cannot be broken away from.
const gameSrc = readFileSync('src/game/core/Game2A.ts', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
check(/shot\.track = \(shot\.track \?\? 0\) - dt;/.test(gameSrc), 'a tracking round must burn down its steering time');
check(/shot\.homing && \(shot\.track \?\? 0\) > 0/.test(gameSrc), 'a tracking round must stop steering when its time is spent');

// ---- doctrine damage stays flat -----------------------------------------
// This PR gives the roster different weapons, not more teeth. A doctrine that
// also raised damage would smuggle a balance change in behind a variety change.
for (const def of armed) {
  g.hostileShots.length = 0;
  const shots = volleyOf(def);
  for (const _ of shots) void _;
  check(g.hostileShots.every((shot) => shot.damage === 1), `${def.key} deals more than 1 damage per round`);
}

if (failures.length) {
  console.error('enemy-doctrines: FAIL');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
const lines = [...signatures.entries()].map(([k, s]) => `${k}=${s.doctrine}(${s.shots}x${s.key}${s.homing ? ', tracking' : ''})`);
console.log(`enemy-doctrines: OK — ${shapes.size} distinct volleys across ${signatures.size} armed enemies.\n  ${lines.join('\n  ')}`);
