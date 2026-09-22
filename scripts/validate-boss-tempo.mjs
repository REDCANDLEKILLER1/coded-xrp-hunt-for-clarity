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
const { Game2A } = await load('src/game/core/Game2A.ts');
const { BOSSES } = await load('src/game/content/registry.ts');

const launch = new Game2A(stubCanvas());
launch.deployFromMap('ledger_prime', 'EARTH');
launch.reset();
check(launch.launchClock > 0, 'normal Earth launch uses its real reveal');
check(launch.earthEncounterDirector.stageKey === undefined, 'launch check precedes encounter spawning');
check(launch.currentStage().key === 'deep_space_lane', 'Earth launch uses its orbital environment before the first enemy spawns');

/** How long a player will stare at a bar that is not moving. */
const STALL_LIMIT = 10;
/** A fight that runs past this is the bug, whatever the bar did on the way. */
const FIGHT_LIMIT = 100;

/**
 * Play one boss fight headlessly with the player firing and dodging a little.
 * The gun is deliberately the STARTER, because a slog is a starter-gun problem.
 */
function fight(bossKey, { seed = 1 } = {}) {
  const originalRandom = Math.random;
  let rng = seed;
  const random = () => { rng = (rng * 1103515245 + 12345) % 2147483648; return rng / 2147483648; };
  Math.random = random;
  const g = new Game2A(stubCanvas());
  g.deployTestMode();
  g.reset();
  g.wave = BOSSES[bossKey].triggerWave;
  // Force this specific boss up rather than whichever is next in the ladder.
  g.completedBosses = new Set(Object.keys(BOSSES).filter((key) => key !== bossKey));
  g.startBossIfReady();
  if (!g.boss || g.boss.bossKey !== bossKey) { Math.random = originalRandom; return { spawned: false }; }

  const dt = 1 / 60;
  let t = 0;
  let lastHp = g.boss.hp ?? 0;
  let stallStart = 0;
  let worstStall = 0;
  let peakEscorts = 0;
  let shieldedSeconds = 0;
  const escortTracks = new Map();

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
  } finally {
    Math.random = originalRandom;
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

// Combined campaign behavior: the original contributions were tested separately.
// Run their real entry points together so a correct arcade clock cannot hide a
// frozen campaign escort or a pressure tick that cancels the exposure window.
{
  const { EARTH_LEDGER_PRIME_MISSION: mission } = await load('src/game/content/missions/ledgerPrime.ts');
  const g = new Game2A(stubCanvas());
  g.deployTestMode();
  g.reset();
  g.missionDirector.startAtAct(mission, 'regulatory_behemoth');
  g.updateMission(1 / 60);
  g.boss.state = 'fight';
  g.boss.age = 0;
  g.boss.y = 200;
  g.launchEscorts(g.boss);
  const movingEscort = g.drones.find((d) => d.escort);
  check(!!movingEscort, 'campaign guardian must launch real escorts');
  const beforeY = movingEscort.y;
  g.updateMission(1 / 60);
  check(movingEscort.y !== beforeY, 'campaign update must move escorts as the arcade update does');

  g.registerKill(movingEscort);
  g.drones = g.drones.filter((d) => d !== movingEscort);
  const shortened = g.screenClock;
  g.launchEscorts(g.boss);
  check(g.screenClock === shortened, 'another attack beat must not refill a partially cleared screen clock');
  check(g.drones.filter((d) => d.escort).length === 2, 'a killed escort stays killed for the rest of that screen');
  g.bossSpawnClock = 0;
  g.bossPressure(1 / 60);
  check(g.screenClock === shortened, 'ambient boss pressure must not cancel an active screen');

  for (const d of [...g.drones].filter((d) => d.escort)) {
    g.registerKill(d);
    g.drones = g.drones.filter((other) => other !== d);
  }
  check(!g.bossShielded() && g.screenCooldown >= 12, 'rapid full clear must start the complete exposure cooldown');
  check(g.boss.attackState === 'recover', 'a successful full clear must open a punish window');
  const cooldown = g.screenCooldown;
  g.bossSpawnClock = 0;
  g.bossPressure(1 / 60);
  g.launchEscorts(g.boss);
  check(g.screenCooldown === cooldown && !g.bossShielded(), 'pressure and launch beats must preserve the full-clear cooldown');
  g.updateScreen(g.boss, 11);
  g.launchEscorts(g.boss);
  check(!g.bossShielded(), 'no shield may relaunch before twelve seconds of exposure');
  g.updateScreen(g.boss, 1);
  g.launchEscorts(g.boss);
  check(g.bossShielded(), 'the next screen may launch after its cooldown expires');
}

// A real chapter run exposed a final-hit divergence: seekers disabled the
// director but left the actor fighting. Exercise the actual collision/bomb
// entry points, with hazards already threatening the fighter on that frame.
{
  const { EARTH_LEDGER_PRIME_MISSION: mission } = await load('src/game/content/missions/ledgerPrime.ts');
  const prepare = () => {
    const g = new Game2A(stubCanvas());
    g.deployFromMap('ledger_prime', 'EARTH'); g.reset(); g.launchClock = 0;
    g.missionDirector.startAtAct(mission, 'regulatory_warship');
    g.warship = null;
    g.updateMission(1 / 60); g.warship.state = 'fight'; g.warship.y = 132;
    for (let phase = 0; phase < 5 && g.warshipDirector.phase !== 'hangar'; phase++) {
      if (g.warshipDirector.shieldCovered) g.warshipDirector.exposeShieldRelay();
      for (const s of g.warshipDirector.targetableSystems) g.warshipDirector.hit(s.key, 99);
    }
    if (g.warshipDirector.phase !== 'hangar') throw Error('Warship fixture did not expose the hangar');
    g.warshipDirector.hit('hangar_defense', 17);
    return g;
  };
  for (const weapon of ['bolt', 'seeker', 'bomb']) {
    const g = prepare(), system = g.warshipDirector.targetableSystems[0];
    const point = g.warshipSystemCenter(system);
    g.playerHitClock = 0; g.shield = 0; g.player.hp = 5;
    g.hazards = [{ ...g.player, hazardKey:'basic_turret', hp:5, fireClock:1, side:1 }];
    g.warshipLaunchClock = 0; g.warshipDefenders(.016);
    g.hostileShots = [{ ...g.player, damage:1, color:'#ff0000', projectileKey:'enemy_red_bullet' }];
    const shot = { ...point, w:8, h:8, vx:0, vy:0, damage:1, life:2, pierce:0 };
    if (weapon === 'bolt') g.bolts = [shot];
    if (weapon === 'seeker') g.seekers = [shot];
    if (weapon === 'bomb') { g.bombs = 1; g.useBomb(); }
    g.collisions();
    check(g.warship.state === 'disabled', `${weapon}: final hit must disable the actor on the same frame`);
    check(g.missionDirector.currentAct.key === 'boarding', `${weapon}: final hit must immediately open boarding`);
    check(g.player.hp === 5, `${weapon}: residual fire must not damage the fighter after the encounter ends`);
    check([g.drones,g.hazards,g.hostileShots,g.bolts,g.seekers].every(a => a.length === 0), `${weapon}: boarding approach must be clear of residual combat`);
    check(g.progress.missionCheckpoints.ledger_prime?.resumeActKey === 'boarding', `${weapon}: real boarding checkpoint must be saved`);
    const score = g.score;
    g.completeRegulatoryWarship(); g.collisions();
    check(g.score === score, `${weapon}: repeated completion must not duplicate score`);
    for (let i = 0; i < 120; i++) g.update(1 / 60);
    check(g.player.hp === 5 && g.drones.length === 0 && g.hostileShots.length === 0, `${weapon}: safe approach must stay safe while controls remain live`);
  }
  const g = prepare(); g.warshipLaunchClock = 0; g.warshipDefenders(.016);
  const defender = g.drones[0], before = {x:defender.x,y:defender.y,age:defender.age};
  g.updateMission(.05);
  check(defender.age > before.age && (defender.x !== before.x || defender.y !== before.y), 'capital-ship defenders must actually fly and age in campaign mode');
  console.log('  Warship final hits       bolt / seeker / bomb: safe, saved, one-time boarding; defenders move');
}

// Test the actual background draw selection, not only inherited stage metadata.
{
  const {EARTH_LEDGER_PRIME_MISSION:mission}=await load('src/game/content/missions/ledgerPrime.ts');
  const {groundTiles}=await load('src/game/content/EarthEnvironment.ts');
  for(const [act,expected] of [['regulatory_behemoth','earth_orbit_neon_v2'],['clarity_destroyer','ledger_ground_neon_v2'],['regulatory_warship','ledger_ground_neon_v2']]){
    const g=new Game2A(stubCanvas());g.deployFromMap('ledger_prime','EARTH');g.reset();g.earthEncounterDirector.clear();g.missionDirector.startAtAct(mission,act);
    const refs=[];g.assets.getImage=(category,id)=>{refs.push(id);return{width:1024,height:683};};
    g.drawStageBackdrop(g.currentStage());check(refs.length===1&&refs[0]===expected,`${act}: actual draw must inherit the chapter environment`);
    const travel=g.groundTravel;g.paused=true;g.update(10);check(g.groundTravel===travel,'paused ground does not slide under frozen threats');
  }
  const before=groundTiles(599.9,844,600),after=groundTiles(600.1,844,600);
  for(const tile of before){const next=after.find(t=>t.id===tile.id);if(next){check(Math.abs(next.y-tile.y-.2)<1e-8,'ground tiles must not jump at wrap');check(next.mirror===tile.mirror,'tile identity and orientation survive offset wrap');}}
}

// Exercise the actual frame boundary with real Input, not just dialogue data.
// Comms must own held controls and stop combat/launch clocks until they close.
{
  const g=new Game2A(stubCanvas());let active=false,holding=true,lastAct=null;
  g.setFlightStory({setActive:v=>{active=v;},update:(_dt,act)=>{lastAct=act;return active&&!!act&&holding;}});
  g.deployFromMap('ledger_prime','EARTH');g.reset(undefined,{fresh:true});
  g.render=()=>{};
  const press=(key,code=key)=>g.input.onKeyDown({key,code});
  press('ArrowRight');press(' ','Space');press('b');press('p');
  const before={x:g.player.x,y:g.player.y,launch:g.launchClock,ground:g.groundTravel,bombs:g.bombs,special:g.special};
  for(let i=0;i<120;i++)g.frame(1/60);
  check(lastAct==='orbital_approach','normal Earth launch reaches its opening comms');
  check(g.player.x===before.x&&g.player.y===before.y&&g.launchClock===before.launch&&g.groundTravel===before.ground,'comms freezes flight, launch and ground clocks');
  check(!g.paused&&g.bombs===before.bombs&&g.special===before.special,'comms consumes no gameplay action');
  check(!g.input.enabled&&g.input.axis().x===0,'comms releases held steering');
  holding=false;g.frame(1/60);
  check(g.input.enabled&&g.launchClock<before.launch,'flight resumes when the conversation closes');
  check(!g.paused&&g.bombs===before.bombs&&g.special===before.special,'closing comms cannot replay stale pause/bomb/pulse edges');
  g.launchClock=0;press('ArrowRight');const x=g.player.x;g.frame(.1);
  check(g.player.x>x,'fresh steering works after comms');
  g.suspend();check(!active&&!g.input.enabled,'returning to map disables comms and flight together');
  g.deployTestMode();check(!active&&g.input.enabled,'arcade play remains independent of story comms');
  console.log('  Earth comms              holds simulation, clears stale inputs, resumes flight and suspends safely');
}

// Ground emplacements exercise the shipped motion/collision paths. Cosmetic
// labels alone cannot pass these distinct-attack and restoration checks.
{
  const {groundDefense,tickGround,beamHits,groundBeam,groundVisible}=await load('src/game/content/GroundDefense.ts');
  const {EARTH_LEDGER_PRIME_MISSION:mission}=await load('src/game/content/missions/ledgerPrime.ts');
  // An emplacement must live long enough to USE its telegraph.
  //
  // The owner, on a real phone: "the turrets actually have words written on
  // them, it says charging and laser, and none of them are even shooting, and
  // it's too easy to kill them." Measured on the shipped build, that was
  // literally true -- 88 of 91 guns on a full Earth run never fired, 97% were
  // destroyed at y < 76 with a median death height of 10px, and the whole level
  // produced 4 rounds. They died DURING the tell, which is exactly why the
  // label was the last thing on screen.
  //
  // The obvious fix is a shorter tell, and it is forbidden by the check below
  // this one: a 0.6s minimum visible warning. So this asserts the OUTCOME --
  // a gun spawned by the real campaign path survives to fire -- and leaves the
  // tell alone.
  {
    const roles=['basic_turret','cannon_turret','cannon_tower','laser_tower','missile_silo','plasma_turret'];
    for(const key of roles){
      const g=new Game2A(stubCanvas());
      g.deployFromMap('ledger_prime','EARTH');g.reset(undefined,{fresh:true});g.launchClock=0;
      g.missionDirector.startAtAct(mission,'ledger_city');g.earthEncounterDirector.start('ledger_city');
      g.hazards=[];g.drones=[];g.hostileShots=[];
      // A maxed gun pointed straight at it -- the harshest case, and the one
      // the owner was actually playing. Set BEFORE the spawn, because
      // emplacement health is snapshotted against the loadout at spawn time;
      // raising it afterwards measured a level-1 gun being shot by a level-10
      // player, which is not a state the game can be in.
      g.xpLevel=10;
      g.spawnMissionHazard(key,.5);
      const gun=g.hazards[0];
      check(!!gun,`${key}: did not spawn`);
      if(!gun)continue;
      let attacked=null,alive=0,hurtOffscreen=false;
      for(let i=0;i<60*16;i++){
        g.playerHitClock=1;g.player.x=gun.x;g.player.y=g.h-65;
        const hpBefore=gun.hp,phaseBefore=gun.ground?.phase;
        g.update(1/60);
        // The phase machine, not the shot count. A silo's missile is
        // interceptible and the player parked underneath shoots it down in the
        // same frame, so `hostileShots.length` never grows and the gun looks
        // silent when it actually fired -- which is how this check first
        // reported the silo at 4.08s against a real 2.3s.
        const fired=phaseBefore==='tell'&&gun.ground?.phase!=='tell';
        if((fired||gun.ground?.phase==='active')&&attacked===null)attacked=i/60;
        // A gun that may not aim yet may not be shot yet. Without this the two
        // windows disagree and the player kills guns by spraying the top edge,
        // which is how 88 of 91 died having never left 'idle'.
        if(gun.hp<hpBefore&&!groundVisible(gun,g.h))hurtOffscreen=true;
        if(!g.hazards.includes(gun))break;
        alive=i/60;
      }
      check(attacked!==null,`${key}: destroyed after ${alive.toFixed(2)}s without ever attacking -- a label with no shot behind it`);
      check(!hurtOffscreen,`${key}: took damage while still forbidden from aiming -- the damage window and the action window disagree`);
      // And it must not take half the pass to get there. The flat idle prefix
      // this replaced spent 0.65s of a short on-screen life doing nothing.
      if(attacked!==null)check(attacked<=2.5,`${key}: first attack at ${attacked.toFixed(2)}s from spawn -- too slow to matter on a scrolling screen`);
    }
    // And the bar must not lie about it. A scaled gun whose bar divides by the
    // registry base reads FULL for most of its life and then empties in one
    // volley, which is a new complaint in the same family as the one above.
    const g=new Game2A(stubCanvas());
    g.deployFromMap('ledger_prime','EARTH');g.reset(undefined,{fresh:true});g.launchClock=0;
    g.missionDirector.startAtAct(mission,'ledger_city');g.earthEncounterDirector.start('ledger_city');
    g.hazards=[];g.spawnMissionHazard('basic_turret',.5);
    const gun=g.hazards[0];
    check(gun.hpMax===gun.hp,'a spawned emplacement must record the hp it spawned with');
    check(gun.hpMax>g.hazardDef(gun.hazardKey).hp,
      `a campaign emplacement spawned at ${gun.hpMax}hp against a registry base of ${g.hazardDef(gun.hazardKey).hp} -- it is not tougher than the arcade build it was measured too fragile in`);
    // The friendly repair beacon is the exception and must NOT be hardened:
    // the player flies through it, and its hp is asserted at 1 elsewhere.
    const beaconGame=new Game2A(stubCanvas());
    beaconGame.deployFromMap('ledger_prime','EARTH');beaconGame.reset(undefined,{fresh:true});beaconGame.launchClock=0;
    beaconGame.missionDirector.startAtAct(mission,'ledger_city');beaconGame.earthEncounterDirector.start('ledger_city');
    beaconGame.hazards=[];beaconGame.spawnMissionHazard('clarity_beacon',.5);
    const beacon=beaconGame.hazards[0];
    check(beacon.hp===beaconGame.hazardDef('clarity_beacon').hp,
      `the friendly repair beacon was hardened to ${beacon.hp}hp -- the hp scale must only reach hostile emplacements`);
  }

  const newGround=()=>{const g=new Game2A(stubCanvas());g.deployFromMap('ledger_prime','EARTH');g.reset(undefined,{fresh:true});g.launchClock=0;g.missionDirector.startAtAct(mission,'ledger_city');g.earthEncounterDirector.start('ledger_city');g.hazards=[];g.drones=[];g.hostileShots=[];g.player.y=640;return g;};
  for(const height of [390,844])for(const key of ['basic_turret','cannon_tower','laser_tower','missile_silo','plasma_turret']){
    const body={x:190,y:-40,w:36,h:36,hp:100,ground:groundDefense(key,'test')},player={x:190,y:height-120,vx:0,vy:0,w:24,h:30};
    let shots=[],tellAt=null,firstAttack=null,beam=false;
    for(let i=0;i<240;i++)shots.push(...tickGround(body,1/60,player,height,true));
    check(!shots.length&&body.ground.phase==='idle',`${height}/${key}: offscreen defense must not fire or pre-charge`);
    body.y=110;
    for(let i=0;i<300;i++){
      const output=tickGround(body,1/60,player,height,true);if(body.ground.phase==='tell'&&tellAt===null)tellAt=i/60;
      if((output.length||body.ground.phase==='active')&&firstAttack===null)firstAttack=i/60;
      if(body.ground.phase==='active'){beam=true;check(beamHits(body,player,390,height),'actual locked laser hits its marked lane');check(!beamHits(body,{...player,x:290},390,height),'moving outside the marked laser lane avoids damage');const segment=groundBeam(body,390,height);check(segment.y2<=height+.01,'laser segment clips at the viewport edge');}
      shots.push(...output);
    }
    check(tellAt!==null&&firstAttack-tellAt>=.6,`${height}/${key}: a real visible warning precedes its first damage`);
    if(key==='laser_tower')check(beam&&!shots.length,'laser is an active finite beam, not a renamed missile');
    else check(shots.length>0,`${key}: must actually fire`);
    if(key==='cannon_tower')check(shots[0].damage===2&&shots[0].size>=19,'cannon fires a heavy charged shell');
    if(key==='missile_silo')check(shots[0].track===1.25&&shots[0].interceptible,'silo missile has bounded steering and can be intercepted');
    if(key==='plasma_turret')check(shots.length>=3&&shots[0].angle!==shots[1].angle,'plasma creates a spaced curtain');
  }
  const g=newGround();for(const x of [.2,.5,.8]){g.spawnMissionHazard('laser_tower',x);g.hazards.at(-1).y=110;g.hazards.at(-1).vy=0;}
  for(let i=0;i<300;i++){g.moveHazards(1/60);check(g.hazards.filter(h=>['tell','active'].includes(h.ground.phase)).length<=2,'at most two ground guns may wind up/beam together');}
  for(const weapon of ['bolt','seeker','bomb']){
    const g=newGround();g.spawnMissionHazard('shield_relay',.5);g.spawnMissionHazard('basic_turret',.25);
    const [relay,gun]=g.hazards;relay.y=gun.y=200;const hp=gun.hp;
    const shot=target=>({x:target.x,y:target.y,w:10,h:10,vx:0,vy:0,damage:999,life:2,pierce:0});
    g.bolts=[shot(gun)];g.collisions();check(gun.hp===hp,'linked gun must actually reject damage before its relay falls');
    if(weapon==='bolt')g.bolts=[shot(relay)];if(weapon==='seeker')g.seekers=[shot(relay)];if(weapon==='bomb'){g.bombs=1;g.useBomb();}
    g.collisions();check(relay.hp<=0&&g.groundRestorationPending,`${weapon}: real relay destruction restores the linked district`);
    check(g.hazards.some(h=>h.ground?.role==='beacon'),`${weapon}: power restoration leaves a friendly repair beacon`);
    if(weapon!=='bomb'){g.bolts=[shot(gun)];g.collisions();check(gun.hp<=0,'relay destruction exposes the connected gun');}
  }
  {
    const g=newGround();g.spawnMissionHazard('clarity_beacon',.5);const beacon=g.hazards[0];beacon.y=200;
    const round={x:beacon.x,y:beacon.y,w:10,h:10,vx:0,vy:0,damage:999,life:2,pierce:0};
    g.bolts=[{...round}];g.seekers=[{...round}];g.collisions();g.bombs=1;g.useBomb();
    check(g.hazards.includes(beacon)&&beacon.hp===1,'friendly beacon survives bolts, seekers and bombs');
    check(!g.seekerTargets().includes(beacon),'seekers never target friendly infrastructure');
    g.player.hp=1;g.player.x=beacon.x;g.player.y=beacon.y;const score=g.score;g.collisions();
    check(g.player.hp===2&&!g.hazards.includes(beacon)&&g.score===score,'fly-through repairs once without damage or kill score');
    g.collisions();check(g.player.hp===2,'consumed beacon cannot repair twice');
  }
  {
    const g=newGround();const missile={x:180,y:200,w:16,h:16,vx:30,vy:150,damage:1,color:'#ff3030',projectileKey:'enemy_missile',interceptible:true,track:1.25,homing:1.1};
    g.hostileShots=[missile];for(let i=0;i<80;i++)g.updateHostileShots(1/60);const heading=Math.atan2(missile.vy,missile.vx);
    g.player.x=350;g.updateHostileShots(.1);check(Math.atan2(missile.vy,missile.vx)===heading,'silo rocket commits straight after its bounded turn');
    g.hostileShots=[{...missile,x:180,y:200}];g.bolts=[{x:180,y:200,w:10,h:10,vx:0,vy:0,damage:1,life:2,pierce:0}];g.collisions();
    check(g.hostileShots.length===0&&g.bolts.length===0,'real primary collision intercepts a hostile silo missile');
  }
  console.log('  Ground strategy          visible distinct attacks, two-gun budget, relay shields/restoration, friendly repairs and missile interception');
}

if (failures.length) {
  console.error('boss-tempo: FAIL');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log('boss-tempo: OK — every screened boss stays open, and no health bar stalls past 10s.');
