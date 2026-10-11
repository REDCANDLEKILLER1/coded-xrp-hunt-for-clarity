// Mars gameplay/data slice (reference pack v2).
//
// Airborne Mars units are authored into the Mars descent encounters; ground
// units are defined but intentionally unwired. This validator locks in:
//  - Mars threat defs are valid, use only supported mechanics, keep
//    campaign-only spawnWeight 0, and never collide with existing ids
//  - every Mars sprite reuses an EXISTING manifest id and is tracked in
//    PROVISIONAL_MARS_SPRITES (no nonexistent art is registered)
//  - encounter tables cover exactly the four Mars flight acts, run on the
//    mars_descent stage, and introduce each threat alone before mixing it
//  - the Mars mission actually flies authored encounters (not the ambient
//    trickle), advances acts in order, spawns no bosses, and never spawns
//    ground units or Earth content
//  - the Fog Moon mission is untouched (ambient only, no Mars director)

import { build } from 'esbuild';
import fs from 'node:fs';

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
globalThis.cancelAnimationFrame = () => {};
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

// --- Content validators ---
const { validateMarsThreats, MARS_ENEMIES, MARS_GROUND_UNITS, PROVISIONAL_MARS_SPRITES } = await load('src/game/content/MarsThreats.ts');
const { validateMarsEncounters, MARS_FLIGHT_ENCOUNTERS, marsFlightEncounterFor } = await load('src/game/content/MarsEncounters.ts');
for (const e of validateMarsThreats()) failures.push('threats: ' + e);
for (const e of validateMarsEncounters()) failures.push('encounters: ' + e);
check(Object.keys(MARS_ENEMIES).length === 3, 'three airborne Mars enemies defined');
check(Object.keys(MARS_GROUND_UNITS).length === 3, 'three ground units defined (unwired)');

// --- ID preservation: no collisions with any existing roster ---
const { ENEMIES, BOSSES } = await load('src/game/content/registry.ts');
const { EARTH_ENEMIES } = await load('src/game/content/EarthThreats.ts');
for (const key of [...Object.keys(MARS_ENEMIES), ...Object.keys(MARS_GROUND_UNITS)]) {
  check(!ENEMIES[key] && !EARTH_ENEMIES[key] && !BOSSES[key], `${key}: no id collision with existing rosters`);
}

// --- Provisional sprites reuse existing manifest art only ---
const manifest = JSON.parse(fs.readFileSync('public/assets/manifest.json', 'utf8'));
for (const [key, ref] of Object.entries(PROVISIONAL_MARS_SPRITES)) {
  const entry = manifest?.enemies?.[ref.id];
  check(!!entry && typeof entry.src === 'string', `${key}: provisional sprite enemies:${ref.id} exists in the manifest`);
}
check(Object.keys(PROVISIONAL_MARS_SPRITES).length === 6, 'all six Mars units tracked as provisional sprites');
// No GLBs registered for Mars units.
const src = fs.readFileSync('src/game/core/Game2A.ts', 'utf8') + fs.readFileSync('src/game/content/MarsThreats.ts', 'utf8');
check(!/\.glb/i.test(src), 'no GLB references anywhere in the Mars slice');

// --- Encounter tables: exact act coverage, Mars stage, Mars-only spawns ---
const marsActs = ['mars_orbital_drop', 'mars_dust_storm', 'mars_canyon_run', 'mars_surface_run'];
check(JSON.stringify(Object.keys(MARS_FLIGHT_ENCOUNTERS).sort()) === JSON.stringify([...marsActs].sort()),
  'encounter tables cover exactly the four Mars flight acts');
for (const act of marsActs) {
  check(marsFlightEncounterFor(act)?.stageKey === 'mars_descent', `${act}: runs on the mars_descent stage`);
}
check(marsFlightEncounterFor('mars_touchdown') === undefined, 'touchdown act has no encounter table (free flight)');
check(marsFlightEncounterFor('orbital_approach') === undefined, 'no Earth act resolves a Mars encounter');

// --- Behavioral: Mars mission flies authored encounters ---
const { Game2A } = await load('src/game/core/Game2A.ts');
const { EARTH_LEDGER_PRIME_MISSION } = await load('src/game/content/missions/ledgerPrime.ts');
const earthActKeys = new Set(EARTH_LEDGER_PRIME_MISSION.acts.map((a) => a.key));
{
  globalThis.location.search = '?stage=mars_descent';
  const g = new Game2A(stubCanvas());
  g.deployFromMap('mars', 'MARS — DESCENT');
  g.render = () => {};
  g.player.hp = 99999;
  const seenActs = [];
  const spawnedKeys = new Set();
  let bossSeen = false, earthActSeen = false, stageDrift = false, frames = 0;
  let encounterActiveSeen = false;
  const pump = () => {
    if (g.upgradeOffer.length > 0) g.applyUpgrade(g.upgradeOffer[0]);
    if (frames % 600 === 0) g.player.hp = 99999;
  };
  while (g.missionDirector.currentAct?.key !== 'mars_touchdown' && frames < 30000) {
    g.frame(1 / 60);
    frames += 1;
    pump();
    const actKey = g.missionDirector.currentAct?.key;
    if (actKey && seenActs[seenActs.length - 1] !== actKey) seenActs.push(actKey);
    if (g.marsEncounterDirector.active) encounterActiveSeen = true;
    for (const d of g.drones) spawnedKeys.add(d.enemyKey);
    if (g.boss) bossSeen = true;
    if (earthActKeys.has(actKey)) earthActSeen = true;
    if (g.currentStage().key !== 'mars_descent') stageDrift = true;
  }
  check(frames < 30000, `mars descent reaches touchdown (took ${frames} frames)`);
  check(JSON.stringify(seenActs) === JSON.stringify([...marsActs, 'mars_touchdown']),
    `mars acts advance in order (${seenActs.join(' > ')})`);
  check(encounterActiveSeen, 'Mars encounter director drives the descent (not the ambient trickle)');
  check(!bossSeen, 'no boss spawns during the Mars descent');
  check(!earthActSeen, 'no Earth act runs during the Mars descent');
  check(!stageDrift, 'stage stays mars_descent for the whole descent');
  const marsKeys = new Set(Object.keys(MARS_ENEMIES));
  const nonMars = [...spawnedKeys].filter((k) => !marsKeys.has(k));
  check(nonMars.length === 0, `only Mars airborne enemies spawn (saw: ${[...spawnedKeys].join(', ') || 'none'})`);
  check(![...spawnedKeys].some((k) => k in MARS_GROUND_UNITS), 'ground units never spawn in flight');
  globalThis.location.search = '';
}

// --- Behavioral: Fog Moon mission is untouched (ambient only) ---
{
  globalThis.location.search = '?stage=fog_moon_descent';
  const g = new Game2A(stubCanvas());
  g.deployFromMap('fog_moon', 'FOG MOON — DESCENT');
  g.render = () => {};
  g.player.hp = 99999;
  for (let i = 0; i < 1200; i++) {
    g.frame(1 / 60);
    if (g.upgradeOffer.length > 0) g.applyUpgrade(g.upgradeOffer[0]);
    if (i % 600 === 0) g.player.hp = 99999;
  }
  check(!g.marsEncounterDirector.active, 'Fog Moon does not run the Mars encounter director');
  check(g.missionDirector.activeMission?.key === 'fog_moon_descent', 'Fog Moon mission unaffected');
  globalThis.location.search = '';
}

if (failures.length) { for (const f of failures) console.error('FAIL: ' + f); process.exit(1); }
console.log('mars-encounters: PASS — Mars threat defs, provisional sprites, authored encounters, mission wiring, Fog Moon untouched');
