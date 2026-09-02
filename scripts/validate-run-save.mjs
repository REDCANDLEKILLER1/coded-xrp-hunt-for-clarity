// The pause-menu save point, and the thing that stops it rotting.
//
// "in the pause go ahead and add a save point that way people can pause game
// save and then play later" -- keeping, by explicit choice, the exact moment:
// your position, every enemy, every bullet in the air.
//
// A live-state save has one failure mode that matters and it is silent. Add an
// enemy field next year, forget to serialise it, and nothing throws: the save
// still loads, the fight is just subtly not the one that was written. Nobody
// can see that happen. So the centre of this file is not the round trip -- it
// is the FIELD-COVERAGE GUARD, which enumerates the real Game2A instance and
// fails when a live field appears in neither SAVED_GAME_FIELDS nor
// UNSAVED_GAME_FIELDS.
//
// Two habits this repo has learned the hard way and both apply here:
//   - ground truth is never produced by the function under test. The expected
//     values below are a structural clone of the live actors, so a field the
//     capture DROPS shows up as a missing key rather than as agreement.
//   - a check that cannot fail is worse than none. Every actor array is
//     asserted non-empty before it is compared, because "[] round-trips to []"
//     passes whatever the serialiser does.

import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };

// ---- browser stubs ---------------------------------------------------------
// Enough of a DOM to construct the real game. Nothing here fakes game logic.
const store = new Map();
const storage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => void store.set(key, String(value)),
  removeItem: (key) => void store.delete(key),
  clear: () => store.clear(),
};
globalThis.localStorage = storage;

const noopCtx = new Proxy({}, {
  get: (target, prop) => {
    if (prop in target) return target[prop];
    if (prop === 'canvas') return undefined;
    if (prop === 'measureText') return () => ({ width: 10 });
    if (prop === 'createLinearGradient' || prop === 'createRadialGradient') {
      return () => ({ addColorStop: () => {} });
    }
    if (prop === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
    return () => {};
  },
  set: (target, prop, value) => { target[prop] = value; return true; },
});

const makeCanvas = () => ({
  width: 0,
  height: 0,
  style: {},
  getContext: () => noopCtx,
  addEventListener: () => {},
  removeEventListener: () => {},
  getBoundingClientRect: () => ({ x: 0, y: 0, left: 0, top: 0, width: WIDTH, height: HEIGHT }),
  setPointerCapture: () => {},
  releasePointerCapture: () => {},
});

let WIDTH = 411;
let HEIGHT = 790;
globalThis.CustomEvent = class CustomEvent {
  constructor(type, init) { this.type = type; this.detail = init?.detail; }
};
globalThis.Event = globalThis.CustomEvent;
globalThis.Image = class {};
globalThis.requestAnimationFrame = () => 0;
globalThis.cancelAnimationFrame = () => {};
globalThis.performance = globalThis.performance ?? { now: () => 0 };
globalThis.matchMedia = () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} });
globalThis.screen = { width: 411, height: 790, orientation: { angle: 0 } };
globalThis.devicePixelRatio = 1;
globalThis.document = {
  addEventListener: () => {},
  removeEventListener: () => {},
  querySelector: () => null,
  createElement: () => makeCanvas(),
  body: { appendChild: () => {} },
  visibilityState: 'visible',
};
const setViewport = (w, h) => {
  WIDTH = w;
  HEIGHT = h;
  globalThis.innerWidth = w;
  globalThis.innerHeight = h;
};
globalThis.window = {
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => true,
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (handle) => clearTimeout(handle),
  localStorage: storage,
  devicePixelRatio: 1,
  get innerWidth() { return WIDTH; },
  get innerHeight() { return HEIGHT; },
};
setViewport(411, 790);
globalThis.location = { search: '', pathname: '/' };
globalThis.AudioContext = undefined;

const bundleOf = async (entry) => {
  const out = await build({
    entryPoints: [entry],
    bundle: true,
    format: 'esm',
    write: false,
    logLevel: 'silent',
  });
  return import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
};

const gameModule = await bundleOf('src/game/core/Game2A.ts');
const runSave = await bundleOf('src/game/content/RunSave.ts');
const warshipModule = await bundleOf('src/game/content/RegulatoryWarship.ts');
const encounterModule = await bundleOf('src/game/content/EarthFlightEncounters.ts');
const missionsModule = await bundleOf('src/game/content/missions/index.ts');

const { Game2A } = gameModule;
const {
  RUN_SAVE_VERSION,
  RUN_SAVE_STORAGE_KEY,
  SAVED_GAME_FIELDS,
  UNSAVED_GAME_FIELDS,
  currentRunKeys,
  parseRunSave,
  rescaleRunSave,
} = runSave;

check(typeof Game2A === 'function', 'Game2A is not constructible from the bundle');

const MISSION = missionsModule.MISSIONS.find((mission) => mission.planetKey === 'ledger_prime');
check(Boolean(MISSION), 'the ledger_prime mission is missing');

/** A checkpoint that resumes at a named act, so a run can start mid-mission. */
const checkpointFor = (actKey) => ({
  planetKey: 'ledger_prime',
  missionKey: MISSION.key,
  checkpointKey: MISSION.checkpoints.find((item) => item.resumeActKey === actKey)?.key ?? MISSION.checkpoints[0].key,
  checkpointLabel: 'TEST',
  resumeActKey: actKey,
  shipKey: 'xrpl_striker',
  weaponTier: 1,
  bombs: 2,
  score: 1234,
  savedAt: Date.now(),
});

const newGame = () => new Game2A(makeCanvas());
const step = (game, seconds, dt = 1 / 60) => {
  for (let i = 0; i < Math.round(seconds / dt); i += 1) game.frame(dt);
};

// ============================================================================
// 1. The field-coverage guard.
// ============================================================================
// The reason this file exists. Everything else here tests today's code; this
// tests every version of the game that has not been written yet.
{
  const game = newGame();
  game.deployFromMap('ledger_prime', 'EARTH — LEDGER PRIME', checkpointFor('orbital_approach'));

  const saved = new Set(SAVED_GAME_FIELDS);
  const unsaved = new Set(UNSAVED_GAME_FIELDS.map((entry) => entry.field));
  const live = Object.keys(game);

  const unclassified = live.filter((field) => !saved.has(field) && !unsaved.has(field));
  check(
    unclassified.length === 0,
    `Game2A fields are not classified for saving: ${unclassified.join(', ')}. `
    + 'Add each to SAVED_GAME_FIELDS (and to captureRunSave/restoreRunSave) or to '
    + 'UNSAVED_GAME_FIELDS with the reason it is safe to lose.',
  );

  const both = live.filter((field) => saved.has(field) && unsaved.has(field));
  check(both.length === 0, `fields classified as both saved and unsaved: ${both.join(', ')}`);

  // The lists must describe THIS class, not a class it used to be. A stale
  // entry is how a coverage guard quietly stops covering anything.
  const known = new Set(live);
  const ghosts = [...saved, ...unsaved].filter((field) => !known.has(field));
  check(
    ghosts.length === 0,
    `SAVED_GAME_FIELDS / UNSAVED_GAME_FIELDS name fields Game2A no longer has: ${ghosts.join(', ')}`,
  );

  check(
    UNSAVED_GAME_FIELDS.every((entry) => typeof entry.why === 'string' && entry.why.length > 8),
    'every unsaved field needs a written reason, not just a name',
  );
}

// ============================================================================
// 2. The round trip: capture, store, reload into a fresh game, compare.
// ============================================================================
let capturedJson = null;
{
  const game = newGame();
  game.deployFromMap('ledger_prime', 'EARTH — LEDGER PRIME', checkpointFor('orbital_approach'));

  // Fly the real sim until the authored encounter has put a fight on screen.
  let flown = 0;
  while (flown < 60 && (game.drones.length === 0 || game.bolts.length === 0)) {
    step(game, 0.5);
    flown += 0.5;
  }
  step(game, 6);

  // Everything the arena produces on its own; the rest is placed explicitly so
  // every serialiser branch is exercised rather than skipped as an empty list.
  game.hazards.push({
    x: 120, y: 200, w: 30, h: 30, vx: 3, vy: 40, hp: 4,
    hazardKey: 'asteroid', fireClock: 0.42, side: -1,
  });
  game.hostileShots.push({
    x: 90, y: 310, w: 6, h: 12, vx: 0, vy: 220, hp: 1,
    damage: 1, color: '#ff5c7a', projectileKey: 'enemy_red_bullet',
  });
  game.seekers.push({
    x: 150, y: 400, w: 8, h: 14, vx: 0, vy: -300, hp: 1,
    damage: 2, angle: -1.4, age: 0.31,
  });
  game.pickups.push({ x: 210, y: 120, w: 20, h: 20, vx: 0, vy: 30, hp: 1, pickupKey: 'shield_cell' });
  game.boss = {
    x: 205, y: 150, w: 120, h: 110, vx: 12, vy: 0, hp: 44,
    bossKey: 'gary_fog', state: 'fight', age: 9.5, fireClock: 0.7, contactClock: 0.2,
    phaseIndex: 1, targetX: 260, attackIndex: 2, attackState: 'telegraph',
    attackClock: 0.55, attackAim: 0.31, maxHp: 90,
  };
  game.warship = {
    x: 205, y: 180, w: 208, h: 186, vx: 0, vy: 0, hp: 1,
    state: 'fight', age: 3.25, fireClock: 1.1,
  };
  game.completedBosses.add('regulatory_behemoth');
  game.pendingUpgrades = 2;
  game.upgradeOffer = ['shield', 'bomb'];
  game.shield = 2;
  game.shieldMax = 3;
  // Far enough into the boarding run that the shield relay is uncovered and
  // partly destroyed. Leaving the warship on its opening phase would make
  // `shieldExposed` false whether or not it round-tripped, and a field that is
  // false either way proves nothing about the code that carries it.
  game.warshipDirector.hit('port_battery', 99);
  game.warshipDirector.hit('starboard_battery', 99);
  check(game.warshipDirector.exposeShieldRelay() === true, 'the test needs the shield relay exposed');
  game.warshipDirector.hit('shield_relay', 4);
  check(game.warshipDirector.phase === 'shield', 'the warship should be on its shield phase for this test');
  check(game.warshipDirector.shieldCovered === false, 'the relay should be uncovered for this test');

  // Every remaining saved number and flag gets a value it could not have
  // arrived at by accident. Half of these are zero in a freshly reset game and
  // zero again after a restore that drops them entirely, so without this the
  // round trip silently stops testing them. (It did: two clocks and the
  // warship's shield exposure survived a mutation because of exactly that.)
  const DISTINCT_SKIP = new Set(['selectedShipKey', 'activePlanetKey', 'activePlanetLabel', 'wave', 'bombs']);
  let stamp = 0;
  for (const field of SAVED_GAME_FIELDS) {
    if (DISTINCT_SKIP.has(field)) continue;
    stamp += 1;
    if (typeof game[field] === 'number') game[field] = 0.125 + stamp * 0.0625;
    else if (typeof game[field] === 'boolean') game[field] = !game[field];
  }

  const ARRAYS = ['drones', 'hazards', 'hostileShots', 'bolts', 'seekers', 'pickups'];
  for (const key of ARRAYS) {
    // Without this, every comparison below would pass on empty arrays whatever
    // the serialiser did. That mistake has been made in this repo before.
    check(game[key].length > 0, `the round trip needs live ${key} to compare; the sim produced none`);
  }

  // Ground truth: a structural clone of the live objects, taken WITHOUT going
  // through captureRunSave. A field the capture forgets is therefore a missing
  // key in the restored actor, not a value both sides agree on.
  // Key order is an implementation detail of whichever code built the object,
  // so the comparison is canonicalised. It still fails on a missing key, an
  // extra key, or any changed value -- which is the whole point.
  const stable = (value) => JSON.stringify(value, (_key, item) => (
    item && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.keys(item).sort().map((k) => [k, item[k]]))
      : item
  ));
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const expected = {
    arrays: Object.fromEntries(ARRAYS.map((key) => [key, clone(game[key])])),
    player: clone(game.player),
    boss: clone(game.boss),
    warship: clone(game.warship),
    completedBosses: [...game.completedBosses].sort(),
    scalars: {},
    encounter: game.earthEncounterDirector.snapshot(),
    warshipPhase: game.warshipDirector.phase,
    warshipSystems: clone(game.warshipDirector.allSystems).sort((a, b) => a.key.localeCompare(b.key)),
  };
  const SCALAR_FIELDS = SAVED_GAME_FIELDS.filter((field) => {
    const value = game[field];
    return typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string';
  });
  for (const field of SCALAR_FIELDS) expected.scalars[field] = game[field];
  check(SCALAR_FIELDS.length > 30, `expected the save to carry many scalars, found ${SCALAR_FIELDS.length}`);

  const saved = game.saveRun();
  check(saved === true, 'saveRun() did not report success');
  capturedJson = storage.getItem(RUN_SAVE_STORAGE_KEY);
  check(typeof capturedJson === 'string' && capturedJson.length > 0, 'nothing was written to storage');

  // A different instance entirely: no shared objects, no leftover fields.
  const resumed = newGame();
  resumed.deployFromMap('ledger_prime', 'EARTH — LEDGER PRIME');
  check(resumed.mode === 'play', 'a live save must deploy straight into play, not into ship select');
  check(resumed.resumeHoldClock > 0, 'a restored save must hold frozen before it starts moving');

  for (const key of ARRAYS) {
    check(
      stable(resumed[key]) === stable(expected.arrays[key]),
      `${key} did not survive the round trip intact`,
    );
  }
  check(stable(resumed.player) === stable(expected.player), 'the player did not survive the round trip');
  check(stable(resumed.boss) === stable(expected.boss), 'the boss did not survive the round trip');
  check(stable(resumed.warship) === stable(expected.warship), 'the warship did not survive the round trip');
  check(
    JSON.stringify([...resumed.completedBosses].sort()) === JSON.stringify(expected.completedBosses),
    'defeated bosses did not survive the round trip',
  );

  const drifted = SCALAR_FIELDS.filter((field) => resumed[field] !== expected.scalars[field]);
  check(drifted.length === 0, `these saved fields changed across the round trip: ${drifted.join(', ')}`);

  // Directors: their own state, read through their own API.
  check(
    stable(resumed.earthEncounterDirector.snapshot()) === stable(expected.encounter),
    'the encounter director resumed at the wrong group',
  );
  check(resumed.warshipDirector.phase === expected.warshipPhase, 'the warship resumed in the wrong phase');
  check(
    resumed.warshipDirector.shieldCovered === false,
    'the uncovered shield relay must stay uncovered, or the boarding run repeats a beat it already finished',
  );
  check(
    stable(resumed.warshipDirector.allSystems.sort((a, b) => a.key.localeCompare(b.key)))
      === stable(expected.warshipSystems),
    'warship subsystem damage did not survive the round trip',
  );
  check(
    resumed.missionDirector.currentAct?.key === game.missionDirector.currentAct?.key,
    'the mission resumed at the wrong act',
  );

  // And the frozen world really is frozen: a tick must move nothing.
  const beforeTick = stable(resumed.drones);
  step(resumed, 0.5);
  check(stable(resumed.drones) === beforeTick, 'the resume hold must not let the fight run');
}

// ============================================================================
// 2b. A run that has not begun cannot be saved.
// ============================================================================
{
  const game = newGame();
  // A fresh deploy runs the launch reveal, which parks the fighter off the
  // bottom of the screen. Saving there and resuming would leave it there.
  game.deployFromMap('ledger_prime', 'EARTH — LEDGER PRIME');
  game.reset(undefined, { fresh: true });
  check(game.launchClock > 0, 'a fresh mission run should open on the launch cinematic');
  check(game.player.y > innerHeight, 'the launch cinematic should start with the fighter off screen');
  check(game.canSaveRun() === false, 'the pause menu must refuse to save during the launch cinematic');
  check(game.saveRun() === false, 'saving during the launch cinematic must fail rather than write a bad save');
  step(game, 12);
  check(game.launchClock === 0, 'the launch cinematic should have finished by now');
  check(game.canSaveRun() === true, 'saving must be available once the fight has actually started');
}

// ============================================================================
// 3. The parser rejects damaged, stale and hostile saves.
// ============================================================================
{
  const keys = currentRunKeys();
  const good = JSON.parse(capturedJson ?? '{}');
  check(parseRunSave(JSON.stringify(good), keys) !== null, 'a save this build wrote must parse');

  const rejects = [
    ['null input', null],
    ['not json', '{{{'],
    ['not an object', '42'],
    ['a future version', JSON.stringify({ ...good, version: RUN_SAVE_VERSION + 1 })],
    ['a past version', JSON.stringify({ ...good, version: RUN_SAVE_VERSION - 1 })],
    ['a missing clock', JSON.stringify({ ...good, clocks: { ...good.clocks, bossSpawnClock: undefined } })],
    ['a NaN position', JSON.stringify({ ...good, player: { ...good.player, x: 'NaN' } })],
    ['a null viewport', JSON.stringify({ ...good, viewport: null })],
    ['a zero viewport', JSON.stringify({ ...good, viewport: { w: 0, h: 0 } })],
    ['an unknown enemy', JSON.stringify({
      ...good,
      drones: good.drones.map((drone, i) => (i === 0 ? { ...drone, enemyKey: 'enemy_that_was_renamed' } : drone)),
    })],
    ['an unknown boss', JSON.stringify({ ...good, boss: { ...good.boss, bossKey: 'boss_that_left' } })],
    ['an unknown ship', JSON.stringify({ ...good, shipKey: 'ship_that_left' })],
    ['an unknown act', JSON.stringify({ ...good, actKey: 'act_that_was_cut' })],
    ['an unknown pickup', JSON.stringify({
      ...good,
      pickups: good.pickups.map((pickup) => ({ ...pickup, pickupKey: 'pickup_that_left' })),
    })],
    ['an unknown warship system', JSON.stringify({
      ...good,
      warshipSystems: good.warshipSystems.map((system) => ({ ...system, key: 'system_that_left' })),
    })],
    ['an invalid enemy stance', JSON.stringify({
      ...good,
      drones: good.drones.map((drone, i) => (i === 0 ? { ...drone, stance: 'loitering' } : drone)),
    })],
    ['an implausible actor count', JSON.stringify({
      ...good,
      hostileShots: Array.from({ length: 5000 }, () => good.hostileShots[0]),
    })],
    ['a string where a boolean belongs', JSON.stringify({ ...good, fogGateActive: 'yes' })],
  ];
  for (const [label, raw] of rejects) {
    check(parseRunSave(raw, keys) === null, `the parser accepted ${label}`);
  }

  // A rejected save must leave the checkpoint path intact, not break the deploy.
  storage.setItem(RUN_SAVE_STORAGE_KEY, JSON.stringify({ ...good, version: 999 }));
  const game = newGame();
  game.deployFromMap('ledger_prime', 'EARTH — LEDGER PRIME', checkpointFor('fog_belt'));
  check(game.mode === 'play', 'an unparseable save must fall back to the act checkpoint, not stall the deploy');
  check(
    game.missionDirector.currentAct?.key === 'fog_belt',
    'the fallback must resume the checkpoint act, not the act the bad save named',
  );
  storage.removeItem(RUN_SAVE_STORAGE_KEY);
}

// ============================================================================
// 4. Rotating the phone between saving and loading.
// ============================================================================
{
  const good = parseRunSave(capturedJson, currentRunKeys());
  check(Boolean(good), 'the captured save should still parse');
  const landscape = rescaleRunSave(good, 890, 411);

  check(landscape.viewport.w === 890 && landscape.viewport.h === 411, 'a rescaled save must record its new viewport');
  const groups = ['drones', 'hazards', 'hostileShots', 'bolts', 'seekers', 'pickups'];
  const flatten = (save) => [save.player, ...groups.flatMap((key) => save[key])];
  const wasOn = (item) => item.x >= 0 && item.x <= good.viewport.w && item.y >= 0 && item.y <= good.viewport.h;
  const isOn = (item) => item.x >= 0 && item.x <= 890 && item.y >= 0 && item.y <= 411;
  // Only actors that were ON the old screen. A bolt already past the top edge
  // is legitimately at a negative y and must stay there rather than be dragged
  // back into the fight.
  const originals = flatten(good);
  const kept = flatten(landscape).filter((_item, index) => wasOn(originals[index]));
  check(kept.length > 1, 'the rescale test needs actors that were on screen to mean anything');
  check(kept.every(isOn), 'a rescaled save put on-screen actors outside the new screen');

  // Proportional, not merely clamped: a clamp would also land "in bounds".
  const before = good.drones[0];
  const after = landscape.drones[0];
  const near = (a, b) => Math.abs(a - b) < 1e-6;
  check(near(after.x / 890, before.x / good.viewport.w), 'rescaling must keep an actor at the same relative x');
  check(near(after.y / 411, before.y / good.viewport.h), 'rescaling must keep an actor at the same relative y');
  check(near(after.stationX / 890, before.stationX / good.viewport.w), 'an enemy station must rescale with its enemy');
  check(after.w === before.w && after.h === before.h, 'rescaling must not resize actors');
  check(after.vx === before.vx && after.vy === before.vy, 'rescaling must not change velocities');

  // Control: the same screen is a no-op, so a test that "passes" by rescaling
  // everything to nothing is caught.
  const same = rescaleRunSave(good, good.viewport.w, good.viewport.h);
  check(JSON.stringify(same) === JSON.stringify(good), 'rescaling to the same viewport must change nothing');

  // And end to end, through the game, on a landscape screen.
  storage.setItem(RUN_SAVE_STORAGE_KEY, capturedJson);
  setViewport(890, 411);
  const rotated = newGame();
  rotated.deployFromMap('ledger_prime', 'EARTH — LEDGER PRIME');
  check(rotated.mode === 'play', 'a save must still load after the phone is rotated');
  check(
    rotated.drones.every((drone) => drone.x >= 0 && drone.x <= 890 && drone.y >= 0 && drone.y <= 411),
    'enemies restored off-screen after a rotation',
  );
  setViewport(411, 790);
}

// ============================================================================
// 5. Director state in isolation.
// ============================================================================
{
  const director = new warshipModule.RegulatoryWarshipDirector();
  director.hit('port_battery', 4);
  director.hit('starboard_battery', 99);
  const before = director.snapshot();
  const restored = new warshipModule.RegulatoryWarshipDirector();
  restored.restore(before);
  check(JSON.stringify(restored.snapshot()) === JSON.stringify(before), 'warship damage did not round trip');
  check(restored.phase === director.phase, 'warship phase did not round trip');
  check(
    JSON.stringify(restored.targetableSystems) === JSON.stringify(director.targetableSystems),
    'restored exposure must be re-derived, and must match',
  );

  // A partly damaged battery must stay partly damaged, not snap to full or dead.
  const port = restored.allSystems.find((system) => system.key === 'port_battery');
  check(port.remainingHp > 0 && port.remainingHp < port.hp, `port battery restored at ${port.remainingHp}, expected partial damage`);

  const encounter = new encounterModule.EarthFlightEncounterDirector();
  encounter.start('fog_belt');
  for (let i = 0; i < 6; i += 1) encounter.update(10, 0);
  const encounterState = encounter.snapshot();
  check(encounterState.groupIndex > 0, 'the encounter test needs to be past the first group to mean anything');
  const encounterCopy = new encounterModule.EarthFlightEncounterDirector();
  check(encounterCopy.restore(encounterState) === true, 'restoring a real act must succeed');
  check(JSON.stringify(encounterCopy.snapshot()) === JSON.stringify(encounterState), 'encounter position did not round trip');
  check(
    encounterCopy.restore({ ...encounterState, actKey: 'act_that_was_cut' }) === false,
    'restoring an act that no longer exists must report failure so the caller can fall back',
  );
  check(encounter.snapshot() !== null && new encounterModule.EarthFlightEncounterDirector().snapshot() === null,
    'an idle encounter director must snapshot as null');
}

// ============================================================================
// 6. Wiring, read from source with comments stripped.
// ============================================================================
// Five checks in this repo have matched an explanatory comment instead of the
// code it explained. Strip them first, every time.
const codeOf = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const gameSrc = codeOf(readFileSync('src/game/core/Game2A.ts', 'utf8'));
const mainSrc = codeOf(readFileSync('src/main.ts', 'utf8'));
const mapSrc = codeOf(readFileSync('src/game/ui/CampaignMap.ts', 'utf8'));

check(/private pauseButtons\(\)/.test(gameSrc), 'the pause menu needs button geometry');
check(
  /private canSaveRun\(\): boolean \{[\s\S]{0,220}?this\.launchClock <= 0/.test(gameSrc),
  'saving during the launch cinematic would restore the fighter below the screen; it must be refused',
);
check(/this\.button\(buttons\.resume, 'RESUME'/.test(gameSrc), 'the pause menu must offer RESUME');
check(/this\.button\(buttons\.save, 'SAVE'/.test(gameSrc), 'the pause menu must offer SAVE');
check(/this\.button\(buttons\.saveQuit, 'SAVE & QUIT'/.test(gameSrc), 'the pause menu must offer SAVE & QUIT');
check(/if \(this\.paused\) return this\.tapPauseMenu\(/.test(gameSrc), 'taps must reach the pause menu while it is up');
check(
  /inside\(buttons\.saveQuit, x, y\) && this\.saveRun\(\)\) this\.quitToMap\(\)/.test(gameSrc),
  'SAVE & QUIT must only leave the fight once the save is actually written',
);
// Pinned to the exact call, not the substring: `coded:quit-to-map-anything`
// contains `coded:quit-to-map`, and a loose match here passed a rename that
// disconnected the listener entirely.
check(
  /new CustomEvent\('coded:quit-to-map'\)/.test(gameSrc),
  'the game must ask the shell to return to the map',
);
check(
  /addEventListener\('coded:quit-to-map', \(\) => \{/.test(mainSrc),
  'nothing in the shell listens for the quit request',
);
check(/this\.resumeHoldClock = Math\.max\(0, this\.resumeHoldClock - dt\)/.test(gameSrc), 'the resume hold must tick down');
check(
  /if \(this\.resumeHoldClock > 0\) \{[\s\S]{0,240}?return;/.test(gameSrc),
  'the resume hold must return before the world updates, or it is not a hold',
);
check(/if \(victory\) clearRunSave\(\)/.test(gameSrc), 'finishing the mission must retire its save');
check(
  /clearRunSave\(\);\n\s+return this\.reset\(undefined, \{ fresh: true \}\)/.test(gameSrc),
  'RESTART on the game-over screen must drop the live save',
);
check(/clearRunSave\(\)/.test(mapSrc), 'RESTART MISSION on the map must drop the live save too');
check(/this\.runSave = loadRunSave\(currentRunKeys\(\)\)/.test(mapSrc), 'the map must re-read the save when it is shown');
check(/const resumable = runSave \?\? checkpoint/.test(mapSrc), 'a save with no checkpoint behind it must still offer RESUME');
check(
  /const live = loadRunSave\(currentRunKeys\(\)\);\n\s+if \(live && live\.planetKey === planetKey && this\.restoreRunSave\(live\)\) return;/.test(gameSrc),
  'deploying must try the live save before the act checkpoint',
);

// ---- report ----------------------------------------------------------------
if (failures.length > 0) {
  console.error('run-save validation failed:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(`run-save OK — ${SAVED_GAME_FIELDS.length} saved fields, ${UNSAVED_GAME_FIELDS.length} classified as skippable`);
