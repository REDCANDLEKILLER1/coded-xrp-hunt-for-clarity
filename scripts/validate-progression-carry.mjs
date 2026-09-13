// What the pilot keeps, and what the music does when the network blinks.
//
// Two defects that share a shape: something is earned or loaded exactly once,
// and if that one moment does not go well there is no second chance.
//
//   1. The campaign armory applies only on `ledger_prime`. Anywhere else
//      `campaignArmory` is null, so the armory weapon stops applying, and
//      `applyLoadout` then sets `xpLevel = 1`. Measured on the shipped build,
//      a rank-10 plasma pilot crossing a planet boundary went 16.69 dps ->
//      7.14 dps, and a maxed one far further.
//
//      HONEST SCOPE: this is latent, not live. Only `ledger_prime` has a 2D
//      mission today, and `campaignNavigation` routes every other world to a
//      3D scene, so no reachable path hits it -- the measured Earth round trip
//      is 1.00x. It is fixed and guarded here because the second 2D mission
//      is the moment it becomes a live bug, silently, in a file nobody is
//      editing at the time.
//
//   2. `MusicDirector.loadManifest` ran once, from the constructor, and its
//      `catch` only logged. `this.manifest` stayed null forever and `play()`
//      then dropped every cue for the rest of the page load. One transient
//      failure at t=0 muted the whole session.
//
// Both are driven rather than read: the carry through real `deployFromMap`
// calls, the retry through a real `MusicDirector` against a stubbed `fetch`.

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
globalThis.cancelAnimationFrame = () => {};
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

const load = async (entry) => {
  const b = await build({ entryPoints: [entry], bundle: true, format: 'esm', write: false, logLevel: 'silent' });
  return import(`data:text/javascript;base64,${Buffer.from(b.outputFiles[0].text).toString('base64')}`);
};
const { Game2A } = await load('src/game/core/Game2A.ts');
const { fighterWeapon } = await load('src/game/content/FighterWeapons.ts');

// ---- 1. the pilot keeps the gun they earned ------------------------------
//
// A stand-in armory that behaves the way the real runtime does: its state is
// campaign save data, so it is readable whether or not the panel is active.
function armory(state) {
  return {
    active: false,
    get state() { return { ...state }; },
    get weapon() { return fighterWeapon(state); },
    begin(rank) { state.rank = Math.max(state.rank, rank); return true; },
    rankUp(rank) { state.rank = Math.max(state.rank, Math.min(20, rank)); return true; },
    upgradeRapid() { state.rapid += 1; return true; },
    setActive() {}, block() {}, update() { return true; },
  };
}

/** Fly Earth with this loadout, then deploy somewhere the armory does not apply. */
function cross(state) {
  const g = new Game2A(stubCanvas());
  g.setFighterArmory(armory({ ...state }));
  g.deployFromMap('ledger_prime', 'EARTH');
  g.reset(undefined, { fresh: true });
  g.xpLevel = state.rank;
  g.fighterReady = true;
  const earth = { level: g.xpLevel, gun: g.currentWeapon().label, dps: g.centredDps() };
  // No planet but Earth has a 2D mission, so this takes the mission-less reset
  // path -- which is exactly the path a second mission would NOT take. Both
  // are covered below.
  g.deployFromMap('mars_relief', 'MARS');
  const after = { level: g.xpLevel, gun: g.currentWeapon().label, dps: g.centredDps(), barrels: g.barrels };
  return { earth, after };
}

{
  // A pilot who has actually played Earth.
  const played = cross({ family: 'plasma', rank: 10, rapid: 2 });
  check(played.after.dps >= played.earth.dps,
    `crossing a planet boundary at armory rank 10 dropped the gun from ${played.earth.dps.toFixed(2)} dps `
    + `(${played.earth.gun}) to ${played.after.dps.toFixed(2)} dps (${played.after.gun}) -- earned mastery has to survive the trip`);
  check(played.after.level > 1,
    `the ladder restarted at level ${played.after.level} after a rank-10 campaign`);
  check(played.after.barrels >= 2,
    `rapid-fire upgrades did not carry: ${played.after.barrels} barrels after two armory rapid ranks`);

  // A pilot at the top. The ladder cannot reach the armory's ceiling, and the
  // right answer is its own top rung -- never rung one.
  const maxed = cross({ family: 'plasma', rank: 20, rapid: 6 });
  check(maxed.after.level >= played.after.level,
    `a maxed pilot (level ${maxed.after.level}) carried less than a rank-10 one (level ${played.after.level})`);
  check(maxed.after.dps > played.after.dps,
    'a maxed campaign and a mid one arrive with the same gun');

  // THE CONTROL. A pilot who has earned nothing must be handed nothing. A
  // carry that just sets a high level would sail through every check above.
  const fresh = cross({ family: 'bb', rank: 1, rapid: 0 });
  check(fresh.after.level === 1,
    `a pilot at armory rank 1 arrived at ladder level ${fresh.after.level} -- the carry is handing out free upgrades`);
  check(fresh.after.barrels === 0,
    `a pilot with no rapid upgrades arrived with ${fresh.after.barrels} barrels`);

  // And the arcade is its own ladder. It has no planet, so campaign mastery
  // must not reach it.
  const arcade = new Game2A(stubCanvas());
  arcade.setFighterArmory(armory({ family: 'plasma', rank: 20, rapid: 6 }));
  arcade.deployTestMode();
  arcade.reset();
  check(arcade.xpLevel === 1 && arcade.barrels === 0,
    `the arcade inherited campaign mastery (level ${arcade.xpLevel}, ${arcade.barrels} barrels) -- it starts at rung one`);

  // The carry must not keep a second copy of the ladder's thresholds. That
  // exact mistake already shipped once in FighterArmoryRuntime.begin: a stale
  // private copy of `[3,6,9,12]` migrated a rank-7 pilot from 53 dps to 11.
  const source = readFileSync('src/game/core/Game2A.ts', 'utf8')
    .split('\n').filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*')).join('\n');
  const carry = source.split('private masteryCarry(')[1]?.split('\n  }\n')[0] ?? '';
  check(carry.length > 0, 'masteryCarry is missing');
  check(/this\.ladderDpsAt\(/.test(carry),
    'the carry must measure the real ladder rather than hold its own table of thresholds');
  check(/armory\.weapon/.test(carry),
    'the carry must read the armory weapon the player actually earned');

  if (!process.env.QUIET) {
    console.log(`  armory rank  1 -> ladder level ${String(fresh.after.level).padStart(2)}  ${fresh.after.dps.toFixed(1)} dps`);
    console.log(`  armory rank 10 -> ladder level ${String(played.after.level).padStart(2)}  ${played.earth.dps.toFixed(1)} -> ${played.after.dps.toFixed(1)} dps`);
    console.log(`  armory rank 20 -> ladder level ${String(maxed.after.level).padStart(2)}  ${maxed.earth.dps.toFixed(1)} -> ${maxed.after.dps.toFixed(1)} dps (the ladder's own ceiling)`);
  }
}

{
  // The reachable trip today: Earth, and back to Earth. It must be lossless,
  // and it is the reason the scope note at the top of this file is honest --
  // without this line the section above would read as a fix to a live bug.
  const g = new Game2A(stubCanvas());
  g.setFighterArmory(armory({ family: 'plasma', rank: 10, rapid: 2 }));
  g.deployFromMap('ledger_prime', 'EARTH');
  g.reset(undefined, { fresh: true });
  g.xpLevel = 10;
  g.fighterReady = true;
  const before = g.centredDps();
  g.deployFromMap('ledger_prime', 'EARTH — LEDGER PRIME');
  check(g.centredDps() >= before,
    `the Earth round trip lost gun: ${before.toFixed(2)} -> ${g.centredDps().toFixed(2)} dps`);
}

// ---- 2. one bad fetch must not mute the session --------------------------
{
  const { MusicDirector } = await load('src/game/audio/MusicDirector.ts');
  const realFetch = globalThis.fetch;
  // Retries sleep on window.setTimeout; run them immediately so the check does
  // not sit through the real 4.6s backoff.
  const realTimeout = globalThis.window.setTimeout;
  globalThis.window.setTimeout = (fn) => { queueMicrotask(fn); return 0; };
  const settle = async () => { for (let i = 0; i < 400; i += 1) await Promise.resolve(); };

  try {
    // (a) A transient failure, then success. The manifest must arrive anyway.
    //     Counted by URL: `loadAssetCatalog` fetches too, and counting every
    //     call would let the catalog's request masquerade as a retry.
    let calls = 0;
    globalThis.fetch = async (url) => {
      if (!String(url).includes('audio/manifest')) return { ok: true, json: async () => ({}) };
      calls += 1;
      if (calls === 1) throw new Error('network blinked');
      return { ok: true, json: async () => ({ cues: {}, tracks: {} }) };
    };
    const recovering = new MusicDirector();
    await settle();
    check(calls > 1, 'the manifest was fetched once and never retried -- one bad fetch still mutes the whole session');
    check(recovering.manifest !== null,
      `the manifest is still null after ${calls} fetches, so every cue for the rest of the page load is dropped`);

    // (b) A manifest that is genuinely gone. It must STOP -- a retry loop with
    //     no bound is a request loop nobody asked for.
    let failures404 = 0;
    globalThis.fetch = async (url) => {
      if (!String(url).includes('audio/manifest')) return { ok: true, json: async () => ({}) };
      failures404 += 1;
      return { ok: false, status: 404, json: async () => ({}) };
    };
    const givingUp = new MusicDirector();
    await settle();
    check(givingUp.manifest === null, 'a 404 manifest somehow resolved');
    check(failures404 >= 2, `a permanently failing manifest was tried ${failures404} time(s) -- that is the shipped one-shot bug`);
    check(failures404 <= 8, `a permanently failing manifest was tried ${failures404} times -- the retry is not bounded`);

    if (!process.env.QUIET) {
      console.log(`  manifest: recovered after ${calls} fetches; a dead manifest stops after ${failures404}`);
    }
  } finally {
    globalThis.fetch = realFetch;
    globalThis.window.setTimeout = realTimeout;
  }
}

if (failures.length) {
  console.error('progression-carry: FAIL');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log('progression-carry: OK — earned mastery survives a planet change, the arcade stays its own ladder, and a blinked fetch no longer mutes the session.');
