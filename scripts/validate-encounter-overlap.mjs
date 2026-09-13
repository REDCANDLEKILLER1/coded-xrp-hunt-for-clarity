// The sky is never empty for long, and it never becomes a wall.
//
// The owner, after playing the whole level on a phone: "it needs a lot more
// enemies after you defend the earth ... the enemies need to be swarming".
//
// Measured on the shipped build, that was one line of sequencing. The Earth
// encounter director advanced only when `activeThreatCount <= 0`, so the next
// group was withheld until every threat on screen was dead and peak
// concurrency could never exceed the largest single authored group -- exactly
// 5. Worse, 28 of the 102 authored groups contain no air enemies at all and
// they are clustered: `ledger_city` groups 2-6 and `defense_grid` groups 1-5
// are each five consecutive all-hazard groups, and a ground emplacement holds
// the gate for its entire scroll. Those two acts measured 92-93% empty sky.
//
// Three things have to hold together, and each is checked by driving the real
// Game2A rather than by reading the director:
//
//   1. groups OVERLAP -- a group arrives while the one before it is still
//      alive, or nothing has changed;
//   2. the screen is CAPPED in slots, so overlap cannot become a wall of
//      heavies on a 360x644 phone;
//   3. the act still ends on an EMPTY screen, and an oversized group can still
//      always get in, so nothing deadlocks.

import { build } from 'esbuild';

const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };

const store = new Map();
globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => void store.set(k, String(v)), removeItem: (k) => void store.delete(k) };
const noopCtx = new Proxy({}, { get: (t, k) => (k in t ? t[k] : k === 'measureText' ? () => ({ width: 10 })
  : k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {}),
  set: (t, k, v) => { t[k] = v; return true; } });
const stubCanvas = () => ({ width: 0, height: 0, style: {}, getContext: () => noopCtx, addEventListener() {}, removeEventListener() {},
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 360, height: 644 }), setPointerCapture() {}, releasePointerCapture() {} });
globalThis.CustomEvent = class { constructor(type, init) { this.type = type; this.detail = init?.detail; } };
globalThis.Image = class {};
globalThis.requestAnimationFrame = () => 0;
globalThis.cancelAnimationFrame = () => {};
globalThis.performance = globalThis.performance ?? { now: () => 0 };
globalThis.matchMedia = () => ({ matches: false, addEventListener() {} });
globalThis.screen = { width: 360, height: 644, orientation: { angle: 0 } };
globalThis.devicePixelRatio = 3;
globalThis.document = { addEventListener() {}, removeEventListener() {}, querySelector: () => null, createElement: stubCanvas, body: { appendChild() {} } };
globalThis.innerWidth = 360;
globalThis.innerHeight = 644;
globalThis.window = { addEventListener() {}, removeEventListener() {}, dispatchEvent: () => true, setTimeout, clearTimeout,
  localStorage: globalThis.localStorage, devicePixelRatio: 3, innerWidth: 360, innerHeight: 644 };
globalThis.location = { search: '', pathname: '/' };

const load = async (entry) => {
  const bundled = await build({ entryPoints: [entry], bundle: true, format: 'esm', write: false, logLevel: 'silent' });
  return import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
};
const { Game2A } = await load('src/game/core/Game2A.ts');
const { EarthFlightEncounterDirector, EARTH_FLIGHT_ENCOUNTERS } = await load('src/game/content/EarthFlightEncounters.ts');
const { EARTH_LEDGER_PRIME_MISSION } = await load('src/game/content/missions/ledgerPrime.ts');
// ---- 1 & 2. drive a real act: overlap happens, and the cap holds ----------
//
// `ledger_city` on purpose -- it is one of the two acts the owner watched stay
// empty, and it is where the five consecutive all-hazard groups live.
{
  const source = await (await import('node:fs/promises')).readFile('src/game/core/Game2A.ts', 'utf8');
  const cap = Number(/const CAMPAIGN_SLOT_CAP = (\d+)/.exec(source)?.[1]);
  check(Number.isFinite(cap) && cap > 0, 'CAMPAIGN_SLOT_CAP could not be read from the source -- never re-type it here');

  const g = new Game2A(stubCanvas());
  g.deployFromMap('ledger_prime', 'EARTH');
  g.reset(undefined, { fresh: true });
  g.launchClock = 0;
  g.missionDirector.startAtAct(EARTH_LEDGER_PRIME_MISSION, 'ledger_city');
  g.earthEncounterDirector.start('ledger_city');
  g.drones = [];
  g.hazards = [];

  let frames = 0;
  let emptyFrames = 0;
  let peakLoad = 0;
  let peakBodies = 0;
  let overlapped = 0;
  let previousGroup = g.earthEncounterDirector.currentGroupNumber;
  for (let i = 0; i < 60 * 240; i += 1) {
    g.playerHitClock = 1;
    const liveBefore = g.drones.length + g.hazards.length;
    g.update(1 / 60);
    const group = g.earthEncounterDirector.currentGroupNumber;
    // A release that lands while the previous group is still on screen IS the
    // overlap. With the shipped serial gate this counter stays at zero.
    if (group !== previousGroup && liveBefore > 0) overlapped += 1;
    previousGroup = group;

    const bodies = g.drones.length + g.hazards.length;
    frames += 1;
    if (bodies === 0) emptyFrames += 1;
    peakBodies = Math.max(peakBodies, bodies);
    peakLoad = Math.max(peakLoad, g.campaignLoad());
    if (g.missionDirector.currentAct?.key !== 'ledger_city') break;
  }

  check(overlapped > 0,
    'no group ever arrived while the previous one was still alive -- the sequencing is still serial and the sky still empties between every group');
  check(peakLoad <= cap,
    `the campaign screen reached ${peakLoad} slots against a cap of ${cap} -- overlap has become a wall`);
  // And the cap itself has to stay a cap. Reading CAMPAIGN_SLOT_CAP from source
  // and then only comparing against it is a tautology: raising the constant
  // would satisfy the line above while the screen filled with ships. The
  // ceiling below is absolute, and it is about the PHONE -- 360x644 at DPR 3,
  // where a light costs 1 slot and a heavy 4, so 16 is already three heavies
  // and four escorts.
  check(cap <= 16, `CAMPAIGN_SLOT_CAP is ${cap}; past 16 a phone screen stops being countable`);
  check(peakBodies <= 14, `${peakBodies} bodies on screen at once -- readable on a desktop, not on a 360px phone`);
  check(peakBodies > 5,
    `peak was ${peakBodies} bodies; the shipped serial gate already reached 5, so this is not more enemies`);
  const emptyShare = 100 * emptyFrames / Math.max(1, frames);
  check(emptyShare < 40,
    `ledger_city is empty ${emptyShare.toFixed(0)}% of the time; it measured 92-93% before and the point of this change is that the sky refills`);
}

// ---- 3. nothing deadlocks -------------------------------------------------
//
// Two ways overlap could hang an act, both checked against the director
// directly because they are sequencing rules, not combat.
{
  // (a) A group larger than the cap must still get in. `hasRoomFor` says no
  //     forever; an empty screen has to override it, or an act whose next
  //     group exceeds the cap never advances and the level stops there.
  const director = new EarthFlightEncounterDirector();
  director.start('ledger_city');
  const groups = EARTH_FLIGHT_ENCOUNTERS.ledger_city.groups.length;
  check(groups > 1, 'ledger_city has too few groups to prove sequencing');
  let released = 0;
  for (let i = 0; i < 60 * 600 && released <= groups; i += 1) {
    const step = director.update(1 / 60, 0, () => false);
    if (step.spawns.length) released += 1;
    if (step.completed) break;
  }
  check(released >= groups,
    `with no room ever available only ${released} of ${groups} groups were released -- an oversized group can deadlock the act`);

  // (b) The act must still end on an empty screen. The director may report
  //     `completed` while threats remain; it is the caller that waits. If
  //     `completed` ever stopped latching, the act would end mid-fight.
  const latch = new EarthFlightEncounterDirector();
  latch.start('ledger_city');
  let sawCompleted = false;
  for (let i = 0; i < 60 * 600; i += 1) {
    const step = latch.update(1 / 60, 0);
    if (step.completed) { sawCompleted = true; break; }
  }
  check(sawCompleted, 'the director never reports completion for ledger_city');
  const after = latch.update(1 / 60, 0);
  check(after.completed, 'completion does not latch -- the act would un-finish itself on the next frame');
}

if (failures.length) {
  console.error('encounter-overlap: FAIL');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log('encounter-overlap: OK — groups overlap, the screen is capped in slots, and nothing deadlocks.');
