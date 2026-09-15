// Four bosses, four fights.
//
// The owner, after playing to the end: "the boss fights in between the capital
// ship and the end, they need to be just more dynamic, more powerful".
//
// Driving the shipped build, two of the four had no `attacks` array at all.
// `clarity_destroyer` and `final_clarity` fell straight through to the flat
// `fireRate` timer -- measured, 100% of a 22.4s and a 35.8s fight -- which
// means no telegraph, no armour, and no punish window, because every one of
// those is gated on the script being there. And the two that DID have scripts
// drew from the same six-move table in the same way: `gary_fog` phase 3 and
// `regulatory_behemoth` phase 3 were set-identical.
//
// So this file does not read the registry and check that arrays are non-empty.
// It plays all four fights and asserts what the player would notice:
//
//   1. nothing falls through to the unscripted timer;
//   2. every authored move actually EXECUTES -- a phase too thin to run its
//      own script is content nobody sees, and behemoth phase 3 measured
//      1.5-4.8s against a 7.80s loop;
//   3. there is a real punish window, and armour that is actually armour;
//   4. the four fights are TACTICALLY DIFFERENT, measured by the moves that
//      ran, not by the arrays that were authored;
//   5. at least one boss throws something the player can shoot down, and the
//      interception is driven to prove it.

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
const { BOSSES } = await load('src/game/content/registry.ts');
const { friendlyGround } = await load('src/game/content/GroundDefense.ts');

/** A fight that runs past this on the STARTER gun is a slog, not a boss. */
const FIGHT_LIMIT = 100;
/** Live hostile projectiles a 393px screen can still be read at. */
const SHOT_CEILING = 48;

function spawn(bossKey, seed = 1) {
  let rng = seed;
  const random = () => { rng = (rng * 1103515245 + 12345) % 2147483648; return rng / 2147483648; };
  const originalRandom = Math.random;
  Math.random = random;
  const g = new Game2A(stubCanvas());
  g.deployTestMode();
  g.reset();
  g.wave = BOSSES[bossKey].triggerWave;
  // Force THIS boss up rather than whichever is next in the ladder.
  g.completedBosses = new Set(Object.keys(BOSSES).filter((key) => key !== bossKey));
  g.startBossIfReady();
  return { g, restore: () => { Math.random = originalRandom; } };
}

/**
 * Play one fight with the player firing and drifting, and record what the
 * boss actually did. Deliberately the STARTER gun: a fight that is a slog with
 * the starter gun is a slog.
 */
function fight(bossKey, seed = 1) {
  const { g, restore } = spawn(bossKey, seed);
  if (!g.boss || g.boss.bossKey !== bossKey) { restore(); return null; }
  const def = BOSSES[bossKey];
  const dt = 1 / 60;
  let t = 0;
  const stateSeconds = { telegraph: 0, active: 0, recover: 0, unscripted: 0 };
  const phaseSeconds = def.phases.map(() => 0);
  const executed = new Map();
  const executedByPhase = def.phases.map(() => new Set());
  let peakShots = 0;
  let interceptible = 0;
  let lastState = null;
  try {
    while (g.boss && t < FIGHT_LIMIT * 2) {
      // A player who is playing: drifting across the lane, always firing.
      g.player.x = 60 + (Math.sin(t * 0.9) * 0.5 + 0.5) * (393 - 120);
      g.player.y = 600 + Math.sin(t * 0.5) * 40;
      // Held on the i-frame clock the game already uses. This measures BOSS
      // behaviour, not player survival.
      g.playerHitClock = 1;
      g.update(dt);
      t += dt;
      if (!g.boss) break;
      peakShots = Math.max(peakShots, g.hostileShots.length);
      interceptible += g.hostileShots.filter((shot) => shot.interceptible).length > 0 ? 1 : 0;
      const phaseIndex = g.boss.phaseIndex;
      phaseSeconds[phaseIndex] += dt;
      const script = def.phases[phaseIndex]?.attacks ?? [];
      if (script.length === 0) { stateSeconds.unscripted += dt; lastState = null; continue; }
      const key = script[g.boss.attackIndex % script.length];
      stateSeconds[g.boss.attackState] += dt;
      // A move counts as EXECUTED the frame its tell ends and it commits.
      if (lastState === 'telegraph' && g.boss.attackState !== 'telegraph') {
        executed.set(key, (executed.get(key) ?? 0) + 1);
        executedByPhase[phaseIndex].add(key);
      }
      lastState = g.boss.attackState;
    }
  } finally { restore(); }
  return { seconds: t, killed: !g.boss, stateSeconds, phaseSeconds, executed, executedByPhase, peakShots, interceptible };
}

const keys = Object.keys(BOSSES);
check(keys.length === 4, `expected four bosses, found ${keys.length}`);

const results = new Map();
for (const key of keys) {
  const result = fight(key);
  if (!result) { check(false, `${key} never spawned -- the rest of this file proves nothing about it`); continue; }
  results.set(key, result);
  const total = Math.max(0.001, result.seconds);

  // 1. Nothing may fall through to the flat timer. This is the check the two
  //    unscripted bosses failed at 100%.
  check(result.stateSeconds.unscripted === 0,
    `${key}: ${(100 * result.stateSeconds.unscripted / total).toFixed(0)}% of the fight ran on the unscripted `
    + 'flat-fireRate fallback -- no telegraph, no armour, no punish window');

  // 2. Every authored move has to run. A phase that cannot afford its own
  //    script is authored content the player never sees.
  for (const [index, phase] of BOSSES[key].phases.entries()) {
    for (const move of phase.attacks ?? []) {
      check(result.executedByPhase[index]?.has(move),
        `${key}.phases.${index}: "${move}" never executed in a ${result.seconds.toFixed(0)}s fight `
        + `(phase lasted ${result.phaseSeconds[index].toFixed(1)}s) -- the phase is too thin to run its own script`);
    }
  }

  // 3. A punish window worth going for, measured rather than derived from the
  //    timing table.
  const openShare = result.stateSeconds.recover / total;
  check(openShare >= 0.15,
    `${key}: open only ${(100 * openShare).toFixed(0)}% of the fight -- there is no window to punish`);
  check(openShare <= 0.5,
    `${key}: open ${(100 * openShare).toFixed(0)}% of the fight -- at that share "armour" makes it die faster`);

  // 4. Still a fight a person will sit through, and still readable.
  check(result.killed && result.seconds <= FIGHT_LIMIT,
    `${key}: ${result.killed ? `took ${result.seconds.toFixed(0)}s` : `survived ${result.seconds.toFixed(0)}s`} `
    + `on the starter gun (limit ${FIGHT_LIMIT}s)`);
  check(result.peakShots <= SHOT_CEILING,
    `${key}: ${result.peakShots} live hostile rounds at once -- more shots is not a harder boss, it is an unreadable one`);

  if (!process.env.QUIET) {
    console.log(`  ${key.padEnd(22)} ${result.seconds.toFixed(0).padStart(3)}s  open ${(100 * openShare).toFixed(0)}%  `
      + `peak rounds ${String(result.peakShots).padStart(2)}  moves: ${[...result.executed.keys()].join(', ')}`);
  }
}

// ---- 5. the four fights have to be DIFFERENT ------------------------------
//
// Measured from the moves that ran, not from the arrays that were authored.
// Before this change `gary_fog` and `regulatory_behemoth` ended on
// set-identical scripts, so two of the four fights asked the same questions.
{
  const observed = new Map([...results].map(([key, result]) => [key, new Set(result.executed.keys())]));
  const pairs = [...observed.keys()];
  for (let i = 0; i < pairs.length; i += 1) {
    for (let j = i + 1; j < pairs.length; j += 1) {
      const a = observed.get(pairs[i]);
      const b = observed.get(pairs[j]);
      const same = a.size === b.size && [...a].every((move) => b.has(move));
      check(!same, `${pairs[i]} and ${pairs[j]} fought with identical move sets (${[...a].join(', ')})`);
      const shared = [...a].filter((move) => b.has(move)).length;
      const union = new Set([...a, ...b]).size;
      check(shared / union <= 0.75,
        `${pairs[i]} and ${pairs[j]} share ${shared} of ${union} moves -- that is one fight with two sprites`);
    }
  }
  // And each boss needs something of its own. `final_clarity` is the exam and
  // is allowed to borrow from all three, so it is excluded as a comparator
  // rather than exempted from having a signature.
  for (const [key, moves] of observed) {
    const others = [...observed].filter(([other]) => other !== key && other !== 'final_clarity');
    const signature = [...moves].filter((move) => others.every(([, set]) => !set.has(move)));
    check(signature.length > 0,
      `${key} has no move of its own -- every one of its ${moves.size} moves also shows up in another fight`);
  }
}

// ---- 5b. the arena is not sterile ----------------------------------------
//
// `startGuardian` clears `this.hazards`, which is right -- nobody wants the
// previous act's clutter scrolling into a duel. But `updateHazards` was then
// never reached again while a boss was up, in EITHER the arcade branch or the
// campaign guardian branch, so a gun placed there could not move, could not
// aim and could not be hit. Same shape as the escort bug: the only call site
// lived behind a branch the boss path skips.
//
// Driven, not read: play a fight and watch for a hostile gun that actually
// travels down the screen.
{
  const source = await (await import('node:fs/promises')).readFile('src/game/core/Game2A.ts', 'utf8');
  const { g, restore } = spawn('gary_fog');
  try {
    check(!!g.boss, 'could not spawn a boss for the ground-pressure check');
    const seen = new Map();
    let peakGround = 0;
    for (let i = 0; i < 60 * 90 && g.boss; i += 1) {
      g.player.x = 60 + (Math.sin(i / 90) * 0.5 + 0.5) * (393 - 120);
      g.player.y = 600;
      g.playerHitClock = 1;
      g.update(1 / 60);
      const ground = g.hazards.filter((hazard) => hazard.ground && !friendlyGround(hazard));
      peakGround = Math.max(peakGround, ground.length);
      for (const hazard of ground) {
        const first = seen.get(hazard);
        if (!first) { seen.set(hazard, { y: hazard.y, moved: false }); continue; }
        if (hazard.y - first.y > 30) first.moved = true;
      }
    }
    const tracked = [...seen.values()];
    check(tracked.length > 0,
      'no hostile ground gun ever appeared during a boss fight -- the arena is still sterile');
    check(tracked.some((entry) => entry.moved),
      `${tracked.length} ground gun(s) appeared during the boss fight but none travelled -- `
      + 'they are frozen, which is the bug this check exists for');
    // And it stays a duel with something happening in it, not a second fight.
    check(peakGround <= 3,
      `${peakGround} ground guns at once during a boss fight -- that is a crowd, not a second axis`);
    // The line above is not enough on its own: the spawner is on a 7.5s clock,
    // so a fight is only long enough for a handful of chances and the observed
    // peak never approaches a raised cap. Raising BOSS_GROUND_CAP to 9 survived
    // that check. This ceiling is absolute and it is about the SCREEN -- a boss
    // already owns most of the round budget, so the ground may add a threat to
    // watch, never a second fight.
    const cap = Number(/const BOSS_GROUND_CAP = (\d+)/.exec(source)?.[1]);
    check(Number.isFinite(cap), 'BOSS_GROUND_CAP could not be read from the source');
    check(cap >= 1 && cap <= 3,
      `BOSS_GROUND_CAP is ${cap}; past 3 the duel stops being a duel`);
    if (!process.env.QUIET) console.log(`  boss arena: ${tracked.length} ground gun(s) over the fight, peak ${peakGround} alive at once`);
  } finally { restore(); }
}

// ---- 6. something the player can shoot down ------------------------------
//
// Every boss round in the shipped build was un-interceptible, so the
// interception path -- which ground silos have used since they shipped -- was
// unreachable from a boss fight. Every other move is answered by moving; this
// is the one answered by the gun.
{
  const throwing = [...results].filter(([, result]) => result.interceptible > 0).map(([key]) => key);
  check(throwing.length > 0,
    'no boss fires anything the player can shoot down -- every answer in the game is still "dodge"');

  // Drive the interception rather than trusting the flag. The control is the
  // point: an identical round WITHOUT the flag must survive the same bolt.
  const { g, restore } = spawn('clarity_destroyer');
  try {
    check(!!g.boss, 'could not spawn clarity_destroyer for the interception check');
    const bolt = () => ({ x: 100, y: 300, w: 10, h: 10, vx: 0, vy: -600, damage: 4, projectileKey: 'bb_shot', pierce: 0, life: 1, hitTargets: new Set() });
    const round = (interceptible) => ({ x: 100, y: 300, w: 14, h: 14, vx: 0, vy: 120, damage: 1, color: '#ff3030', projectileKey: 'enemy_missile', interceptible, life: 1 });

    // `collisions()` prunes spent rounds on its way out, so a destroyed round
    // is an EMPTY list rather than a dead entry.
    g.bolts = [bolt()];
    g.hostileShots = [round(true)];
    g.collisions();
    check(g.hostileShots.length === 0, 'an interceptible boss round survived a direct hit from a player bolt');

    g.bolts = [bolt()];
    g.hostileShots = [round(false)];
    g.collisions();
    check(g.hostileShots.length === 1,
      'a round with interceptible unset was destroyed anyway -- the flag is not what decides it, so setting it proves nothing');
  } finally { restore(); }
}

if (failures.length) {
  console.error('boss-tactics: FAIL');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log('boss-tactics: OK — four scripted fights, every authored move executes, real punish windows, and rounds you can shoot down.');
