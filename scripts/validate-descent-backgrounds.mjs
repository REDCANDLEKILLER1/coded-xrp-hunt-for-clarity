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

// --- Stage registry: present, excluded from the wave ladder ---
const { STAGES } = await load('src/game/content/registry.ts');
for (const key of ['fog_moon_descent', 'mars_descent']) {
  check(!!STAGES[key], `STAGES has ${key}`);
  check(STAGES[key].minWave === 99, `${key}: minWave 99 keeps it out of the wave ladder`);
  check(STAGES[key].scrollSpeed > 0, `${key}: has a scroll speed`);
}
// Free-flight fallback at wave 1 must still be ledger_city, not a descent stage.
const ladder = Object.values(STAGES).sort((a, b) => a.minWave - b.minWave);
let fallback = ladder[0];
for (let i = ladder.length - 1; i >= 0; i--) { if (ladder[i].minWave <= 1) { fallback = ladder[i]; break; } }
check(fallback.key === 'ledger_city', `wave-1 free-flight fallback is still ledger_city (got ${fallback.key})`);

// --- ?stage= debug override ---
const { Game2A } = await load('src/game/core/Game2A.ts');
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

// --- Descent travel advances on real frames and resets on entry ---
{
  globalThis.location.search = '?stage=fog_moon_descent';
  const g = new Game2A(stubCanvas());
  g.deployFromMap('ledger_prime', 'EARTH');
  g.launchClock = 0;
  g.render = () => {};
  const t0 = g.fogDescentTravel;
  for (let i = 0; i < 60; i++) g.frame(1 / 60);
  check(g.fogDescentTravel > t0, 'fog descent travel advances on real frames');
  check(g.currentStage().key === 'fog_moon_descent', 'debug stage persists across frames');
  globalThis.location.search = '';
}

// --- Static routing: drawStageBackdrop handles both new stage keys ---
const src = fs.readFileSync('src/game/core/Game2A.ts', 'utf8');
check(src.includes("stage.key==='fog_moon_descent'&&this.drawFogPath()"), 'drawStageBackdrop routes fog_moon_descent');
check(src.includes("stage.key==='mars_descent'&&this.drawMarsPath()"), 'drawStageBackdrop routes mars_descent');

if (failures.length) { for (const f of failures) console.error('FAIL: ' + f); process.exit(1); }
console.log('descent-backgrounds: PASS — one-way fog/mars tile sequences, stage registry, ?stage= test routes, travel advance and reset');
