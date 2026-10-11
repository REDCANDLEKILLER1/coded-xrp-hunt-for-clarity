// Moon/Mars descent background wiring.
//
// The PR #136 backgrounds (FOG_PATH / MARS_PATH) were staged and registered
// but consumed by nothing. This validator locks in the wiring:
//  - fogTiles / marsTiles run a one-way descent 01→10, then HOLD on 10
//    (self-tiling) instead of wrapping like SPACE_PATH
//  - tiles never mirror (the sequences are chained, not symmetric)
//  - FOG_PATH / MARS_PATH each hold 10 entries with the expected IDs
//  - STAGES carries fog_moon_descent / mars_descent, excluded from the wave
//    ladder (minWave 99) so free-flight fallback behavior is unchanged
//  - ?stage=fog_moon_descent / ?stage=mars_descent flies the sequences
//    directly for playtesting; unknown ?stage= values fall through
//  - descent travel advances on real frames and resets on stage entry

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

// --- Tile math: one-way descent, clamp on 10, never mirror, never wrap ---
const env = await load('src/game/content/EarthEnvironment.ts');
for (const [name, fn, path] of [['fogTiles', env.fogTiles, env.FOG_PATH], ['marsTiles', env.marsTiles, env.MARS_PATH]]) {
  check(path.length === 10, `${name}: path holds 10 entries`);
  check(path.every((ref, i) => ref.id === `${name === 'fogTiles' ? 'fog_path' : 'mars_path'}_${String(i + 1).padStart(2, '0')}`),
    `${name}: entry IDs are fog/mars_path_01..10 in order`);
  const th = 600, h = 800;
  const idx = (travel) => fn(travel, h, th).map(t => t.index);
  const mir = (travel) => fn(travel, h, th).map(t => t.mirror);
  check(idx(0).every(i => i >= 0 && i <= 1), `${name}: starts at the top of the sequence`);
  check(mir(0).every(m => m === false) && mir(3000).every(m => m === false), `${name}: never mirrors`);
  check(idx(th * 5).some(i => i >= 4 && i <= 6), `${name}: mid-descent shows middle tiles`);
  check(idx(th * 30).every(i => i === 9), `${name}: clamps on tile 10, never wraps`);
  check(idx(th * 100).every(i => i === 9), `${name}: holds tile 10 indefinitely for surface combat`);
}

// --- Stage registry: present, with scroll speeds for the descent roll ---
const { STAGES } = await load('src/game/content/registry.ts');
for (const key of ['fog_moon_descent', 'mars_descent']) {
  check(!!STAGES[key], `STAGES has ${key}`);
  check(STAGES[key].scrollSpeed > 0, `${key}: has a scroll speed`);
}

// --- Mission defs: standalone levels, no Earth ties ---
const { MISSIONS, missionForPlanet } = await load('src/game/content/missions/index.ts');
const fogMission = MISSIONS.find((m) => m.key === 'fog_moon_descent');
const marsMission = MISSIONS.find((m) => m.key === 'mars_descent');
check(!!fogMission && !!marsMission, 'descent missions are registered in MISSIONS');
check(missionForPlanet('fog_moon')?.key === 'fog_moon_descent', 'missionForPlanet(fog_moon) resolves');
check(missionForPlanet('mars')?.key === 'mars_descent', 'missionForPlanet(mars) resolves');
const { EARTH_LEDGER_PRIME_MISSION } = await load('src/game/content/missions/ledgerPrime.ts');
const earthActKeys = new Set(EARTH_LEDGER_PRIME_MISSION.acts.map((a) => a.key));
for (const m of [fogMission, marsMission]) {
  const tag = m.key.startsWith('fog') ? 'fog' : 'mars';
  check(m.acts.length === 5, `${m.key}: five acts`);
  check(m.acts.slice(0, 4).every((a) => a.mode === 'flight'), `${m.key}: first four acts are flight`);
  check(m.acts[4].mode === 'complete', `${m.key}: final act is complete`);
  check(m.acts.every((a) => a.key && a.label && a.objective), `${m.key}: acts carry key/label/objective`);
  check(m.acts.every((a) => a.key.startsWith(`${tag}_`)), `${m.key}: act keys are ${tag}-namespaced`);
  check(m.checkpoints.length === 0, `${m.key}: no checkpoints, so no campaign progression is recorded`);
  const text = JSON.stringify(m).toUpperCase();
  check(!text.includes('EARTH') && !text.includes('LEDGER'), `${m.key}: no Earth text anywhere in the mission def`);
}

// --- No Earth flow can run inside descent acts ---
const { guardianPlanFor } = await load('src/game/content/EarthBossFlow.ts');
const { earthFlightEncounterFor } = await load('src/game/content/EarthFlightEncounters.ts');
for (const m of [fogMission, marsMission]) {
  for (const act of m.acts) {
    check(!earthActKeys.has(act.key), `${m.key}.${act.key}: not an Earth act key`);
    check(!guardianPlanFor(act.key), `${m.key}.${act.key}: no guardian plan, so no Earth boss can spawn`);
    check(!earthFlightEncounterFor(act.key), `${m.key}.${act.key}: no Earth encounter table`);
  }
}

// --- Wave ladder can never land on a descent stage ---
const { Game2A, STAGE_LADDER } = await load('src/game/core/Game2A.ts');
check(Array.isArray(STAGE_LADDER) && STAGE_LADDER.length > 0, 'STAGE_LADDER is exported and non-empty');
check(!STAGE_LADDER.some((s) => s.key === 'fog_moon_descent' || s.key === 'mars_descent'),
  'descent stages are excluded from the wave ladder at every wave');
// Free-flight fallback at wave 1 must still be ledger_city, not a descent stage.
{
  let fallback = STAGE_LADDER[0];
  for (let i = STAGE_LADDER.length - 1; i >= 0; i--) { if (STAGE_LADDER[i].minWave <= 1) { fallback = STAGE_LADDER[i]; break; } }
  check(fallback.key === 'ledger_city', `wave-1 free-flight fallback is still ledger_city (got ${fallback.key})`);
}

// --- ?stage= debug override still resolves the backgrounds directly ---
const stageVia = (search) => {
  globalThis.location.search = search;
  const g = new Game2A(stubCanvas());
  const key = g.currentStage().key;
  globalThis.location.search = '';
  return key;
};
check(stageVia('?stage=fog_moon_descent') === 'fog_moon_descent', '?stage=fog_moon_descent resolves the fog stage');
check(stageVia('?stage=mars_descent') === 'mars_descent', '?stage=mars_descent resolves the mars stage');
check(stageVia('?stage=bogus_stage') !== 'bogus_stage', 'unknown ?stage= falls through instead of resolving');

// --- Behavioral: fog descent rolls acts 01→10 with no Earth flow (portrait) ---
{
  globalThis.location.search = '?stage=fog_moon_descent';
  const g = new Game2A(stubCanvas());
  g.deployFromMap('fog_moon', 'FOG MOON — DESCENT');
  g.render = () => {};
  g.player.hp = 99999; // survive the long roll; ambient combat is placeholder
  const seenActs = [];
  let bossSeen = false, earthActSeen = false, stageDrift = false, frames = 0;
  const t0 = g.fogDescentTravel;
  const pump = () => {
    // Ambient kills level the fighter: upgrade offers pause update() until a
    // card is picked, so the harness picks one (a real player taps).
    if (g.upgradeOffer.length > 0) g.applyUpgrade(g.upgradeOffer[0]);
    if (frames % 600 === 0) g.player.hp = 99999;
  };
  while (g.missionDirector.currentAct?.key !== 'fog_touchdown' && frames < 30000) {
    g.frame(1 / 60);
    frames += 1;
    pump();
    const actKey = g.missionDirector.currentAct?.key;
    if (actKey && seenActs[seenActs.length - 1] !== actKey) seenActs.push(actKey);
    if (g.boss) bossSeen = true;
    if (earthActKeys.has(actKey)) earthActSeen = true;
    if (g.currentStage().key !== 'fog_moon_descent') stageDrift = true;
  }
  check(frames < 30000, `fog descent reaches touchdown (took ${frames} frames)`);
  check(JSON.stringify(seenActs) === JSON.stringify(['fog_orbital_drop', 'fog_storm_belt', 'fog_deep_descent', 'fog_surface_run', 'fog_touchdown']),
    `fog acts advance in order (${seenActs.join(' > ')})`);
  check(!bossSeen, 'no boss spawns during the fog descent');
  check(!earthActSeen, 'no Earth act runs during the fog descent');
  check(!stageDrift, 'stage stays fog_moon_descent for the whole descent');
  check(g.fogDescentTravel > t0, 'fog descent travel advances on real frames');
  // Tile-10 loop: keep flying after touchdown; every visible tile stays 10.
  for (let i = 0; i < 900; i++) { g.frame(1 / 60); pump(); if (g.boss) bossSeen = true; }
  const held = env.fogTiles(g.fogDescentTravel, 793, 393 * 1.5).map((t) => t.index);
  check(held.every((i) => i === 9), 'tile 10 holds its loop after touchdown');
  check(!bossSeen, 'no boss spawns during the tile-10 hold either');
  globalThis.location.search = '';
}

// --- Behavioral: mars descent (landscape) ---
{
  globalThis.innerWidth = 900; globalThis.innerHeight = 420;
  globalThis.location.search = '?stage=mars_descent';
  const g = new Game2A(stubCanvas());
  g.deployFromMap('mars', 'MARS — DESCENT');
  g.render = () => {};
  g.player.hp = 99999;
  let bossSeen = false, ok = true;
  for (let i = 0; i < 1200; i++) {
    g.frame(1 / 60);
    if (g.upgradeOffer.length > 0) g.applyUpgrade(g.upgradeOffer[0]);
    if (i % 600 === 0) g.player.hp = 99999;
    if (g.boss) bossSeen = true;
    if (g.currentStage().key !== 'mars_descent') ok = false;
    if (!g.missionDirector.currentAct?.key.startsWith('mars_')) ok = false;
  }
  check(g.missionDirector.activeMission?.key === 'mars_descent', 'mars mission stays active in landscape');
  check(ok, 'stage and mars acts hold in landscape with no drift');
  check(!bossSeen, 'no boss spawns during the mars descent');
  check(g.marsDescentTravel > 0, 'mars descent travel advances in landscape');
  globalThis.innerWidth = 393; globalThis.innerHeight = 793;
  globalThis.location.search = '';
}

// --- Static routing: drawStageBackdrop handles both new stage keys ---
const src = fs.readFileSync('src/game/core/Game2A.ts', 'utf8');
check(src.includes("stage.key==='fog_moon_descent'&&this.drawFogPath()"), 'drawStageBackdrop routes fog_moon_descent');
check(src.includes("stage.key==='mars_descent'&&this.drawMarsPath()"), 'drawStageBackdrop routes mars_descent');

// --- Seam fix: true crossfades, no fade-to-solid bands ---
check(src.includes('private drawDescentPath('), 'shared drawDescentPath crossfade renderer exists');
check(!src.includes('rgba(4,7,13,0)') && !src.includes('rgba(13,5,3,0)'),
  'fade-to-solid seam bands are gone from the descent renderers');

// --- main.ts: ?stage= deploys the descent missions, not just the background ---
const mainSrc = fs.readFileSync('src/main.ts', 'utf8');
check(mainSrc.includes("deployFromMap(") && mainSrc.includes("'fog_moon'") && mainSrc.includes("'mars'"),
  '?stage=fog_moon_descent / ?stage=mars_descent deploys the descent missions');

if (failures.length) { for (const f of failures) console.error('FAIL: ' + f); process.exit(1); }
console.log('descent-backgrounds: PASS — one-way fog/mars tile sequences, standalone descent missions, no Earth flow, crossfade seams, ?stage= mission routes, travel advance and tile-10 hold');
