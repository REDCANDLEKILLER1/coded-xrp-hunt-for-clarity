// An upgrade is a reward, not a tax.
//
// The owner's rule, verbatim: "player upgrade = small difficulty adjustment
// after time/waves, NOT immediate weapon pickup. A player upgrade must feel
// like a reward."
//
// It was the other way round. `firepowerScale()` read the CURRENT gun --
// volley length * damage / fireRate -- and drone health, hazard health, enemy
// speed and the arena cap all called it every frame. Catching an UPGRADE CRATE
// mid-wave turned every regulator already on screen from 1hp to 3hp in the
// same frame, before a shot was fired with the new gun.
//
// This file drives the real Game2A and asks the question directly: give the
// player a better gun, and does anything on the field get tougher?
//
// It does NOT re-implement the scaling rule and then check its own copy. That
// mistake has been made four times in this repo. Every number below comes out
// of the running game.

import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };

const game = readFileSync('src/game/core/Game2A.ts', 'utf8');
// Comments stripped: this repo has matched prose for code repeatedly, and the
// method below is deliberately commented with the very words it must not use.
const code = game.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

// ---- the continuous curve may not consult the gun ------------------------
const body = code.split('private pressureScale(): number {')[1]?.split('\n  }')[0] ?? '';
check(body.length > 0, 'pressureScale is missing');
for (const forbidden of ['playerDps', 'currentWeapon', 'currentVolley', 'barrels', 'weaponTier', 'loadoutScale']) {
  check(!new RegExp(`\\b${forbidden}\\b`).test(body), `pressureScale reads ${forbidden} -- that is the coupling this replaced`);
}
check(/this\.wave/.test(body), 'pressureScale must read the wave');
check(/this\.clock/.test(body), 'pressureScale must read the run clock');

// ---- the boss snapshot is a snapshot, and only bosses take it ------------
const loadoutCalls = [...code.matchAll(/this\.loadoutScale\(\)/g)].length;
check(loadoutCalls > 0, 'loadoutScale is never called');
for (const method of ['enemyHp', 'hazardHp', 'enemySpeed', 'arenaEnemyCap']) {
  const region = code.split(`private ${method}(`)[1]?.split('\n  }')[0] ?? '';
  check(region.length > 0, `${method} is missing`);
  check(!/loadoutScale/.test(region), `${method} reads loadoutScale -- per-frame, that is the pickup coupling again`);
}

// ---- behavioural: a better gun makes nothing on the field tougher --------
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

const bundle = await build({ entryPoints: ['src/game/core/Game2A.ts'], bundle: true, format: 'esm', write: false, logLevel: 'silent' });
const { Game2A } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const registryBundle = await build({ entryPoints: ['src/game/content/registry.ts'], bundle: true, format: 'esm', write: false, logLevel: 'silent' });
const { ENEMIES, HAZARDS } = await import(`data:text/javascript;base64,${Buffer.from(registryBundle.outputFiles[0].text).toString('base64')}`);

const g = new Game2A(stubCanvas());
g.deployTestMode();
g.reset();
g.wave = 5;
g.clock = 120;

const sample = () => ({
  enemies: Object.values(ENEMIES).map((def) => g.enemyHp(def)),
  hazards: Object.values(HAZARDS).map((def) => g.hazardHp(def)),
  speeds: Object.values(ENEMIES).map((def) => Math.round(g.enemySpeed(def))),
  cap: g.arenaEnemyCap(),
  pressure: Number(g.pressureScale().toFixed(4)),
});

const before = sample();
check(before.enemies.some((hp) => hp > 0), 'no enemy health sampled -- this check would pass vacuously');

// The strongest gun in the game, granted the way the game grants it.
g.baseWeaponTier = 5;
g.xpLevel = 20;
g.barrels = 3;
const after = sample();

check(JSON.stringify(before.enemies) === JSON.stringify(after.enemies),
  `a better gun changed drone health: ${before.enemies} -> ${after.enemies}`);
check(JSON.stringify(before.hazards) === JSON.stringify(after.hazards),
  `a better gun changed hazard health: ${before.hazards} -> ${after.hazards}`);
check(JSON.stringify(before.speeds) === JSON.stringify(after.speeds),
  `a better gun changed enemy speed: ${before.speeds} -> ${after.speeds}`);
check(before.cap === after.cap, `a better gun changed the arena cap: ${before.cap} -> ${after.cap}`);
check(before.pressure === after.pressure, `a better gun moved the pressure curve: ${before.pressure} -> ${after.pressure}`);

// ---- but the run itself must still raise it -----------------------------
const early = new Game2A(stubCanvas());
early.deployTestMode();
early.reset();
early.wave = 1;
early.clock = 0;
const late = new Game2A(stubCanvas());
late.deployTestMode();
late.reset();
late.wave = 9;
late.clock = 600;
check(late.pressureScale() > early.pressureScale() + 0.5,
  `the run must raise pressure: wave 1 at 0s is ${early.pressureScale().toFixed(2)}, wave 9 at 10min is ${late.pressureScale().toFixed(2)}`);
// The sponge check has to probe the CAP, not a point below it. Sampled at
// wave 9 / 10 minutes the curve is nowhere near the ceiling, so raising
// PRESSURE_CAP to 12 sailed straight through the first version of this line.
const capped = new Game2A(stubCanvas());
capped.deployTestMode();
capped.reset();
capped.wave = 40;
capped.clock = 3600;
const toughest = Object.values(ENEMIES).reduce((worst, def) => Math.max(worst, capped.enemyHp(def)), 0);
check(toughest <= 6, `the toughest drone reaches ${toughest} health at the pressure cap, which is a sponge`);
const cappedHazard = Object.values(HAZARDS).reduce((worst, def) => Math.max(worst, capped.hazardHp(def)), 0);
check(cappedHazard <= 16, `the toughest hazard reaches ${cappedHazard} health at the pressure cap`);
check(late.enemyHp(ENEMIES.regulator_drone) > early.enemyHp(ENEMIES.regulator_drone)
  || late.enemySpeed(ENEMIES.regulator_drone) > early.enemySpeed(ENEMIES.regulator_drone),
  'a long run must get harder somehow');

if (failures.length) {
  console.error('progression-scaling: FAIL');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(`progression-scaling: OK — the gun moves nothing on the field; the run raises pressure ${early.pressureScale().toFixed(2)} -> ${late.pressureScale().toFixed(2)}.`);
