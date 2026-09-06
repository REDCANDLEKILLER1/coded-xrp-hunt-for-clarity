// The Ryan detector.
//
// Report: an 87-second Regulatory Behemoth phase-2 fight where the escort
// count climbed 4 -> 10 and the boss health bar barely moved.
//
// The cause was structural, not tuning. `moveDrones` is the only place a
// drone's stance, fire, dodge and patience advance, and it was reached only
// through `updateDrones`, which the boss branch of the update loop skips. So
// escorts froze on spawn, never fled, and ESCORT_PATIENCE -- the constant the
// code cited as proof a deadlock was impossible -- was never decremented.
// Meanwhile every `escort_screen` beat pushed a fresh full set with no check
// for the ones already alive, on a 3.92s cycle, while the shield blocked 100%
// of damage until all of them were dead.
//
// So this file does not check constants. It plays the fight, with the player
// firing, and fails if the boss's health ever stalls for longer than a player
// would tolerate. A test that asserts ESCORT_PATIENCE is mentioned somewhere
// is exactly the test that passed all the way through Ryan's 87 seconds.

import { build } from 'esbuild';

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
const { BOSSES } = await load('src/game/content/registry.ts');

/** How long a player will stare at a bar that is not moving. */
const STALL_LIMIT = 10;
/** A fight that runs past this is the bug, whatever the bar did on the way. */
const FIGHT_LIMIT = 100;

/**
 * Play one boss fight headlessly with the player firing and dodging a little.
 * The gun is deliberately the STARTER, because a slog is a starter-gun problem.
 */
function fight(bossKey, { seed = 1 } = {}) {
  const g = new Game2A(stubCanvas());
  g.deployTestMode();
  g.reset();
  g.wave = BOSSES[bossKey].triggerWave;
  // Force this specific boss up rather than whichever is next in the ladder.
  g.completedBosses = new Set(Object.keys(BOSSES).filter((key) => key !== bossKey));
  g.startBossIfReady();
  if (!g.boss || g.boss.bossKey !== bossKey) return { spawned: false };

  const dt = 1 / 60;
  let t = 0;
  let lastHp = g.boss.hp ?? 0;
  let stallStart = 0;
  let worstStall = 0;
  let peakEscorts = 0;
  let shieldedSeconds = 0;
  const escortTracks = new Map();
  let rng = seed;
  const random = () => { rng = (rng * 1103515245 + 12345) % 2147483648; return rng / 2147483648; };

  try {
  while (g.boss && t < FIGHT_LIMIT * 2) {
    // A player who is playing: drifting across the lane, always firing.
    g.player.x = 60 + (Math.sin(t * 0.9) * 0.5 + 0.5) * (393 - 120);
    g.player.y = 600 + Math.sin(t * 0.5) * 40;
    if (random() < 0.002) g.player.y = 500;
    // Held on the invulnerability timer the game already uses for i-frames.
    // This measures BOSS TEMPO, not player survival: without it the harness
    // dies at ~10s and every fight reads as a permanent stall, which is what
    // the first version of this file actually reported.
    g.playerHitClock = 1;
    g.update(dt);
    t += dt;
    if (!g.boss) break;
    if (g.bossShielded()) shieldedSeconds += dt;
    const escorts = g.drones.filter((d) => d.escort);
    peakEscorts = Math.max(peakEscorts, escorts.length);
    for (const escort of escorts) {
      const seen = escortTracks.get(escort);
      if (!seen) { escortTracks.set(escort, { y: escort.y, x: escort.x, patience: escort.patience, moved: false, aged: false }); continue; }
      if (Math.abs(escort.y - seen.y) > 1 || Math.abs(escort.x - seen.x) > 1) seen.moved = true;
      if (escort.patience < seen.patience - 0.2) seen.aged = true;
    }
    const hp = g.boss.hp ?? 0;
    if (hp < lastHp) { lastHp = hp; stallStart = t; }
    worstStall = Math.max(worstStall, t - stallStart);
  }
  } catch (error) {
    return { spawned: true, escortsMoved: 0, escortsAged: 0, escortsSeen: 0, crashed: String(error && error.message ? error.message : error), seconds: t, worstStall, peakEscorts, shieldedShare: 0, killed: false };
  }
  const tracks = [...escortTracks.values()];
  return { spawned: true, escortsMoved: tracks.filter((v) => v.moved).length, escortsAged: tracks.filter((v) => v.aged).length, escortsSeen: tracks.length, seconds: t, worstStall, peakEscorts, shieldedShare: shieldedSeconds / Math.max(0.001, t), killed: !g.boss };
}

const scripted = Object.values(BOSSES).filter((boss) => boss.phases.some((phase) => (phase.attacks ?? []).includes('escort_screen')));
check(scripted.length > 0, 'no boss launches escorts -- this check would prove nothing');

for (const boss of scripted) {
  const result = fight(boss.key);
  if (!result.spawned) { check(false, `${boss.key} never spawned`); continue; }
  check(result.worstStall <= STALL_LIMIT,
    `${boss.key}: the health bar stalled ${result.worstStall.toFixed(0)}s with the player firing (limit ${STALL_LIMIT}s) -- that is the reported bug`);
  check(result.peakEscorts <= 3,
    `${boss.key}: ${result.peakEscorts} escorts alive at once; the screen must refill to a cap, not stack launches`);
  // The frozen-escort bug, asserted directly rather than left to the tempo
  // metric: with the screen clock in place the fight stays bounded even when
  // escorts never move, so four of five mutations sailed past the first
  // version of this file. An escort has to actually fly, and its patience has
  // to actually burn down, or ESCORT_PATIENCE is dead code again.
  check(result.escortsSeen > 0, `${boss.key}: no escorts were ever launched`);
  check(result.escortsMoved === result.escortsSeen,
    `${boss.key}: ${result.escortsSeen - result.escortsMoved} of ${result.escortsSeen} escorts never moved -- moveDrones is not reaching them`);
  // Not "every": patience only burns once an escort has settled, so one shot
  // down during its entry legitimately never ages. Zero is the bug.
  check(result.escortsAged > 0,
    `${boss.key}: none of ${result.escortsSeen} escorts burned any patience -- ESCORT_PATIENCE is dead code again`);
  check(result.shieldedShare <= 0.4,
    `${boss.key}: shielded for ${(result.shieldedShare * 100).toFixed(0)}% of the fight -- the boss has to be open most of the time`);
  check(result.killed && result.seconds <= FIGHT_LIMIT,
    `${boss.key}: ${result.killed ? `took ${result.seconds.toFixed(0)}s` : `was still alive after ${result.seconds.toFixed(0)}s`} on the starter gun (limit ${FIGHT_LIMIT}s)`);
  if (!failures.length || true) {
    console.log(`  ${boss.key.padEnd(22)} ${result.seconds.toFixed(0).padStart(3)}s  worst stall ${result.worstStall.toFixed(1).padStart(4)}s  peak escorts ${result.peakEscorts}  shielded ${(result.shieldedShare * 100).toFixed(0)}%`);
  }
}

// ---- refill to the cap, and cool down after -----------------------------
// Both asserted by calling the real launcher, because the emergent tempo
// cannot see them: the screen clock bounds the fight either way.
{
  const g = new Game2A(stubCanvas());
  g.deployTestMode();
  g.reset();
  const key = scripted[0].key;
  g.wave = BOSSES[key].triggerWave;
  g.completedBosses = new Set(Object.keys(BOSSES).filter((k) => k !== key));
  g.startBossIfReady();
  check(!!g.boss, 'could not spawn a boss for the launcher checks');
  if (g.boss) {
    g.launchEscorts(g.boss);
    const first = g.drones.filter((d) => d.escort).length;
    check(first > 0 && first <= 3, `a first screen put up ${first} escorts; the cap is 3`);
    // A second launch while the screen is up must top up, never stack.
    g.launchEscorts(g.boss);
    const second = g.drones.filter((d) => d.escort).length;
    check(second <= 3, `a second launch stacked to ${second} escorts instead of refilling to the cap of 3`);

    // Killing SOME of the screen has to buy time off it. Killing ALL of it
    // ends the screen through the "none left" exit whatever the cut is worth,
    // so the partial case is the only one that can see SCREEN_KILL_CUT -- and
    // deleting the cut entirely survived every other check in this file.
    g.drones = g.drones.filter((drone) => !drone.escort);
    g.screenClock = 0;
    g.screenCooldown = 0;
    g.launchEscorts(g.boss);
    const escorts = g.drones.filter((d) => d.escort);
    check(escorts.length >= 2, `need at least two escorts to test a partial clear; got ${escorts.length}`);
    if (escorts.length >= 2) {
      const before = g.screenClock;
      g.registerKill(escorts[0]);
      const cut = before - g.screenClock;
      check(cut > 0.5,
        `killing one of ${escorts.length} escorts cut ${cut.toFixed(2)}s off the screen -- clearing part of it has to shorten it`);
      check(g.screenClock > 0,
        'one kill out of several should shorten the screen, not end it outright');
    }

    // Clear the screen, then try to relaunch inside the cooldown.
    for (const drone of g.drones) if (drone.escort) drone.hp = 0;
    g.drones = g.drones.filter((drone) => (drone.hp ?? 0) > 0);
    g.updateScreen(g.boss, 1 / 60);
    check(g.screenCooldown > 0, 'clearing a screen must start its cooldown');
    g.launchEscorts(g.boss);
    check(g.drones.filter((d) => d.escort).length === 0,
      'a screen relaunched inside its cooldown -- the beat can outrun the player again');
  }
}

// ---- the overload: a screen the player CANNOT clear ---------------------
//
// This is the branch the played-fight metric cannot reach. In a real fight the
// player kills the escorts, so the screen ends through the "all dead" exit and
// the clock's length never matters -- which is exactly why a mutation setting
// SCREEN_SECONDS to 600 sailed past every other check in this file.
//
// The promise the design makes is that a screen ALWAYS ends in a punish
// window, including for the player who could not clear it. That promise only
// exists if the clock expires on its own, so it is asserted on its own.
{
  const g = new Game2A(stubCanvas());
  g.deployTestMode();
  g.reset();
  const key = scripted[0].key;
  g.wave = BOSSES[key].triggerWave;
  g.completedBosses = new Set(Object.keys(BOSSES).filter((k) => k !== key));
  g.startBossIfReady();
  check(!!g.boss, 'could not spawn a boss for the overload check');
  if (g.boss) {
    g.launchEscorts(g.boss);
    const launched = g.drones.filter((d) => d.escort).length;
    check(launched > 0, 'no escorts launched, so there is no screen to overload');
    // The shield must actually be up first, or "it opened" proves nothing.
    check(g.bossShielded(), 'the screen did not raise a shield');

    const dt = 1 / 60;
    // Generous against SCREEN_SECONDS (6) and far short of a mutated 600.
    const patience = 20;
    let waited = 0;
    let openedAt = -1;
    while (waited < patience) {
      g.updateScreen(g.boss, dt);
      waited += dt;
      // Nothing is killed: the escorts sit there and the player is not clearing.
      if (openedAt < 0 && !g.bossShielded()) { openedAt = waited; break; }
    }
    check(openedAt >= 0,
      `the screen never expired on its own after ${patience}s with every escort still alive -- a player who cannot clear it is stuck behind it forever`);
    if (openedAt >= 0) {
      check(g.drones.every((drone) => !drone.escort),
        'overload must stop the survivors screening; they still carry the escort flag');
      check(g.boss.attackState === 'recover',
        `overload must force a punish window; the boss is in '${g.boss.attackState}'`);
      check(g.boss.attackClock > 0,
        'the forced punish window has no time on it');
      check(g.screenCooldown > 0,
        'an overloaded screen must start its cooldown, or it can relaunch immediately');
      console.log(`  overload                fired at ${openedAt.toFixed(1)}s with ${launched} escorts still alive`);
    }
  }
}

if (failures.length) {
  console.error('boss-tempo: FAIL');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log('boss-tempo: OK — every screened boss stays open, and no health bar stalls past 10s.');
