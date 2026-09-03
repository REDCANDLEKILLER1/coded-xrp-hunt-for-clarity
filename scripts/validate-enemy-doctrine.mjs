// Enemies you can name from how they shoot at you.
//
// Every regular enemy used to fire through one routine -- aim at the player,
// emit `burst` rounds separated by `spread`, all drawn as `enemy_missile`. A
// drone and a heavy fighter differed by two numbers, so the roster looked
// varied and played identically.
//
// The geometry in EnemyDoctrine is pure, so it is checked by running it. The
// wiring into Game2A is checked structurally, against comment-stripped source.

import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };

const bundle = await build({
  entryPoints: ['src/game/content/EnemyDoctrine.ts'],
  bundle: true, format: 'esm', write: false, logLevel: 'silent',
});
const { DOCTRINES, doctrineFor, volleyRounds, leadAngle, mayFire } =
  await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

const groundBundle = await build({
  entryPoints: ['src/game/content/GroundDoctrine.ts'],
  bundle: true, format: 'esm', write: false, logLevel: 'silent',
});
const { GROUND_DOCTRINES, groundDoctrineFor, groundRounds, steerSeeker, distanceToRay, BEAM_HALF_WIDTH } =
  await import(`data:text/javascript;base64,${Buffer.from(groundBundle.outputFiles[0].text).toString('base64')}`);

const game = readFileSync('src/game/core/Game2A.ts', 'utf8');
// Comments stripped: four checks in this repo have now matched prose instead of
// code, in both directions.
const codeOf = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const gameCode = codeOf(game);
check(gameCode.length > game.length * 0.4, 'comment stripping ate the source — the scraper is broken');

// ---- every class attacks differently --------------------------------------
{
  const keys = Object.keys(DOCTRINES);
  check(keys.length >= 5, `only ${keys.length} doctrines — every live enemy class needs one`);

  // The whole point: no two classes put the same pattern on screen.
  const shapes = new Set(Object.values(DOCTRINES).map((d) => d.shape));
  check(
    shapes.size === keys.length,
    `${keys.length} classes share only ${shapes.size} volley shapes — that is the old "one routine" problem again`,
  );

  for (const [key, d] of Object.entries(DOCTRINES)) {
    check(d.key === key, `DOCTRINES.${key} carries the wrong key`);
    check(d.rounds >= 1, `${key} must fire at least one round`);
    check(d.interval > 0, `${key} needs a positive volley interval`);
    check(d.damage >= 1, `${key} must do damage`);
    check(d.speedScale > 0, `${key} needs a positive speed scale`);
    check(d.size > 0, `${key} rounds need a drawn size`);
    check(d.firstShotDelay >= 0, `${key} cannot have a negative first-shot delay`);
  }

  // An unknown key must still behave rather than crash the fight.
  check(doctrineFor('not_a_ship')?.shape !== undefined, 'an unknown enemy key must fall back to a real doctrine');
}

// ---- nothing fans ----------------------------------------------------------
//
// The player's own ladder was fixed by removing angular spread; the same rule
// binds the enemies. `crossing` is the single exception and it must CONVERGE
// ahead of the player, not spray outward.
{
  const aim = Math.PI / 2;   // straight down
  for (const [key, d] of Object.entries(DOCTRINES)) {
    const rounds = volleyRounds(d, aim, 0);
    check(rounds.length >= 1, `${key} produced no rounds`);
    for (const r of rounds) {
      check(Number.isFinite(r.angle) && Number.isFinite(r.offset), `${key} produced a non-finite round`);
    }
    if (d.shape === 'crossing') continue;
    const spread = Math.max(...rounds.map((r) => Math.abs(r.angle - aim)));
    check(spread < 1e-9, `${key} fans its rounds ${spread.toFixed(3)}rad — only crossing fire may angle`);
  }

  // Crossing fire toes IN: the round offset to the left must aim rightward.
  const cross = Object.values(DOCTRINES).find((d) => d.shape === 'crossing');
  check(Boolean(cross), 'no class uses crossing fire');
  if (cross) {
    const rounds = volleyRounds(cross, aim, 0);
    const left = rounds.find((r) => r.offset < 0);
    const right = rounds.find((r) => r.offset > 0);
    check(Boolean(left && right), 'crossing fire needs a round on each side');
    if (left && right) {
      check(
        left.angle > aim && right.angle < aim,
        'crossing fire diverges — it must converge ahead of the player, not fan outward',
      );
    }
  }
}

// ---- alternating actually alternates ---------------------------------------
{
  const alt = Object.values(DOCTRINES).find((d) => d.shape === 'alternating');
  check(Boolean(alt), 'no class uses alternating guns');
  if (alt) {
    const sides = [0, 1, 2, 3].map((seq) => Math.sign(volleyRounds(alt, 0, seq)[0].offset));
    check(
      sides[0] !== sides[1] && sides[1] !== sides[2] && sides[2] !== sides[3],
      `alternating guns fired from sides ${sides.join(',')} — it must swap barrel every volley`,
    );
  }
}

// ---- a burst is a burst, not a simultaneous clump --------------------------
{
  const burst = Object.values(DOCTRINES).find((d) => d.shape === 'burst');
  check(Boolean(burst), 'no class uses a snap burst');
  if (burst) {
    const delays = volleyRounds(burst, 0, 0).map((r) => r.delay);
    check(burst.rounds >= 2, 'a burst needs more than one round');
    check(new Set(delays).size === delays.length, 'burst rounds must be staggered in time, not fired together');
    check(Math.max(...delays) < 0.4, 'a burst spread over more than 0.4s reads as separate shots');
  }
}

// ---- the heavy round is telegraphed ----------------------------------------
//
// It does double damage. A wind-up the player cannot see is not a telegraph,
// it is just a delay, so the draw call is asserted too.
{
  const heavy = Object.values(DOCTRINES).find((d) => d.shape === 'heavy');
  check(Boolean(heavy), 'no class uses a heavy round');
  if (heavy) {
    check(heavy.telegraph > 0.2, `a ${heavy.telegraph}s wind-up is too short to react to`);
    check(heavy.damage >= 2, 'the telegraphed round should be worth dodging');
    const others = Object.values(DOCTRINES).filter((d) => d.shape !== 'heavy');
    check(
      others.every((d) => d.damage < heavy.damage),
      'the heavy round must hit harder than everything else, or the telegraph buys the player nothing',
    );
  }
  check(/private drawTelegraph\(/.test(gameCode), 'the wind-up must be drawn, or it is a delay rather than a telegraph');
  check(/this\.drawTelegraph\(/.test(gameCode), 'drawTelegraph is defined but never called');
}

// ---- time to first shot ----------------------------------------------------
//
// Enemies previously could not fire until they reached station, then waited
// fireRate * 0.4-1.0 -- 0.68-3.0s of guaranteed safety after arriving.
{
  const delays = Object.values(DOCTRINES).map((d) => d.firstShotDelay);
  check(Math.max(...delays) <= 1.2, `slowest class waits ${Math.max(...delays)}s to open fire — still too safe`);
  check(
    Object.values(DOCTRINES).some((d) => d.firesWhileEntering),
    'no class fires while entering — every arrival still gets a free pass',
  );
  // ...but not everything, or there is no readable approach at all.
  check(
    Object.values(DOCTRINES).some((d) => !d.firesWhileEntering),
    'every class fires while entering — arrivals need to stay readable',
  );

  check(mayFire({ firesWhileEntering: true, requiresRest: false }, 'entering', false), 'an ambush class must fire while entering');
  check(!mayFire({ firesWhileEntering: false, requiresRest: false }, 'entering', false), 'a non-ambush class must not fire while entering');
  check(!mayFire({ firesWhileEntering: true, requiresRest: false }, 'fleeing', true), 'a fleeing enemy must not shoot');
  check(mayFire({ firesWhileEntering: false, requiresRest: false }, 'diving', false), 'a diving enemy must be able to shoot');
  check(!mayFire({ firesWhileEntering: false, requiresRest: true }, 'holding', false), 'a rhythm class must wait for its beat');
}

// ---- crossing fire leads, and degrades safely ------------------------------
{
  const from = { x: 0, y: 0 };
  const still = leadAngle(from, { x: 0, y: 100, vx: 0, vy: 0 }, 200);
  check(Math.abs(still - Math.PI / 2) < 1e-6, 'a stationary target must be aimed at directly');

  // A target moving right must be led to the right of straight-down.
  const moving = leadAngle(from, { x: 0, y: 100, vx: 120, vy: 0 }, 200);
  check(moving < Math.PI / 2, 'crossing fire must lead ahead of a target moving right');
  check(Number.isFinite(moving), 'lead angle must be finite');

  // Unreachable target: fall back to a direct shot rather than not firing.
  const runaway = leadAngle(from, { x: 0, y: 100, vx: 9000, vy: 0 }, 50);
  check(Number.isFinite(runaway), 'an unreachable target must still produce a finite aim');

  // Degenerate speed must not produce NaN.
  for (const speed of [0, -10]) {
    check(Number.isFinite(leadAngle(from, { x: 10, y: 100, vx: 5, vy: 5 }, speed)), `speed ${speed} produced a non-finite aim`);
  }
}

// ---- the wiring ------------------------------------------------------------
{
  check(/doctrineFor\(/.test(gameCode), 'Game2A must resolve a doctrine');
  check(/volleyRounds\(/.test(gameCode), 'Game2A must build its volleys from the doctrine');
  check(/mayFire\(/.test(gameCode), 'the firing gate must come from the doctrine');

  // The old single hardcoded projectile is gone from the regular enemy path.
  const fire = gameCode.split('private launchHostileRound(')[1]?.split('\n  }\n')[0] ?? '';
  check(fire.includes('hostileShots.push'), 'could not find launchHostileRound — the scraper is broken');
  check(
    /projectileKey: doctrine\.projectileKey/.test(fire),
    'regular enemy rounds must take their art from the doctrine, not a hardcoded key',
  );
  check(/damage: doctrine\.damage/.test(fire), 'round damage must come from the doctrine');

  // The stance gate must no longer be hardcoded around enemyFire, or classes
  // that are meant to shoot on the way in cannot.
  check(
    !/if \(drone\.stance === 'holding' \|\| drone\.stance === 'diving'\) \{\s*this\.enemyFire/.test(gameCode),
    'the hardcoded holding/diving gate is back — ambush classes cannot fire while entering',
  );

  // Player velocity has to exist for crossing fire to lead anything.
  check(/private playerVx/.test(gameCode) && /private playerVy/.test(gameCode), 'crossing fire needs player velocity');
  check(/this\.playerVx \+=/.test(gameCode), 'player velocity must actually be measured');
}

// ---- ground emplacements are not all the same turret ----------------------
//
// Every firing hazard ran the same three lines: normalise toward the player,
// push one enemy_missile, damage 1. A "laser tower" and a "missile silo" were
// the same object with different art.
{
  const keys = Object.keys(GROUND_DOCTRINES);
  check(keys.length >= 5, `only ${keys.length} ground doctrines`);
  const attacks = new Set(Object.values(GROUND_DOCTRINES).map((d) => d.attack));
  check(
    attacks.size === keys.length,
    `${keys.length} emplacements share only ${attacks.size} attack types — that is the old one-turret problem`,
  );
  for (const [key, d] of Object.entries(GROUND_DOCTRINES)) {
    check(d.key === key, `GROUND_DOCTRINES.${key} carries the wrong key`);
    check(d.interval > 0 && d.damage >= 1, `${key} needs a positive interval and damage`);
  }
  // An emplacement with no doctrine must keep its old plain shot rather than
  // silently becoming something else.
  check(groundDoctrineFor('not_a_turret') === null, 'an unknown emplacement must fall back to null, not to another doctrine');

  // Bracketing straddles: the gap must be centred on the player, or it is just
  // two shots that both miss.
  const bracket = Object.values(GROUND_DOCTRINES).find((d) => d.attack === 'bracket');
  check(Boolean(bracket), 'no emplacement brackets');
  if (bracket) {
    const r = groundRounds(bracket, Math.PI / 2, 0);
    check(r.length === 2, 'a bracket needs two shells');
    check(Math.abs((r[0].angle + r[1].angle) / 2 - Math.PI / 2) < 1e-9, 'bracketing fire must straddle the aim, not lean to one side');
    check(r[0].angle !== r[1].angle, 'both bracket shells went to the same place');
  }

  // A curtain denies ground: it must NOT aim at the player, or it is just a
  // spread shot and the area-denial idea is lost.
  const curtain = Object.values(GROUND_DOCTRINES).find((d) => d.attack === 'curtain');
  check(Boolean(curtain), 'no emplacement lays a curtain');
  if (curtain) {
    const straight = groundRounds(curtain, Math.PI / 2, 200);
    const skewed = groundRounds(curtain, 0.3, 200);
    check(
      straight.every((r, i) => r.angle === skewed[i].angle),
      'the curtain changes with the aim — it must deny an area regardless of where the player is',
    );
    const spread = Math.max(...straight.map((r) => r.offset)) - Math.min(...straight.map((r) => r.offset));
    check(spread > 0, 'the curtain must actually span a band');
  }

  // The seeker turn must be bounded, or it cannot be out-flown.
  const seeker = Object.values(GROUND_DOCTRINES).find((d) => d.attack === 'seeker');
  check(Boolean(seeker), 'no emplacement fires a seeker');
  if (seeker) {
    check(seeker.turnRate > 0, 'a seeker must be able to turn');
    check(seeker.turnRate < 6, `a seeker turning at ${seeker.turnRate}rad/s cannot be out-flown`);
    // Exactly bounded, over several frames.
    let heading = 0;
    for (let i = 0; i < 4; i += 1) heading = steerSeeker(heading, Math.PI, seeker.turnRate, 0.1);
    check(
      Math.abs(heading - seeker.turnRate * 0.4) < 1e-9,
      `seeker turned ${heading.toFixed(3)}rad in 0.4s at ${seeker.turnRate}rad/s — the bound is not being applied`,
    );
    // Wraps the short way rather than spinning the long way round.
    check(steerSeeker(3.0, -3.0, 10, 1) > 3.0, 'seeker heading must wrap across PI the short way');
    // Only the seeker homes. If every round homed, the silo would mean nothing.
    const homing = Object.values(GROUND_DOCTRINES).filter((d) => d.turnRate > 0);
    check(homing.length === 1, `${homing.length} emplacements fire homing rounds — that should be the silo's alone`);
  }

  // A beam is hit-tested against a RAY: behind the tower must be safe.
  const beam = Object.values(GROUND_DOCTRINES).find((d) => d.attack === 'beam');
  check(Boolean(beam), 'no emplacement fires a beam');
  if (beam) {
    check(beam.beamLife > 0, 'a beam needs a lifetime');
    check(beam.telegraph > beam.beamLife, 'the beam telegraph must outlast the beam, or there is no time to leave the lane');
    const origin = { x: 100, y: 100 };
    check(distanceToRay(origin, Math.PI / 2, { x: 100, y: 200 }) < 1e-9, 'a point on the beam must read as hit');
    check(distanceToRay(origin, Math.PI / 2, { x: 100, y: 0 }) > BEAM_HALF_WIDTH, 'a point BEHIND the tower must be safe');
    check(distanceToRay(origin, Math.PI / 2, { x: 140, y: 200 }) > BEAM_HALF_WIDTH, 'a point beside the beam must be safe');
  }
}

// ---- the ground wiring -----------------------------------------------------
{
  check(/groundDoctrineFor\(/.test(gameCode), 'hazards must resolve a ground doctrine');
  const volley = gameCode.split('private fireGroundVolley(')[1]?.split('\n  }\n')[0] ?? '';
  check(volley.includes('hostileShots.push') || volley.includes('beams.push'), 'could not find fireGroundVolley — the scraper is broken');
  check(/this\.beams\.push/.test(volley), 'the laser tower must emit a beam rather than another bullet');
  check(/seek: doctrine\.turnRate > 0/.test(volley), 'the silo must emit a homing round');
  check(/leadAngle\(/.test(volley), 'predictive emplacements must lead the player');
  // Beams have to be updated and drawn, or they are invisible instant damage.
  check(/private updateBeams\(/.test(gameCode) && /this\.updateBeams\(/.test(gameCode), 'beams must be updated');
  check(/private drawBeam\(/.test(gameCode) && /this\.drawBeam\(/.test(gameCode), 'beams must be drawn');
  check(/private drawGroundTelegraph\(/.test(gameCode) && /this\.drawGroundTelegraph\(/.test(gameCode), 'the ground wind-up must be drawn');
  // Seekers steer in the shot loop.
  const shots = gameCode.split('private updateHostileShots(')[1]?.split('\n  }\n')[0] ?? '';
  check(/steerSeeker\(/.test(shots), 'homing rounds must actually steer');
}

if (failures.length > 0) {
  console.error('enemy doctrine FAILED');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
const fastest = Math.min(...Object.values(DOCTRINES).map((d) => d.firstShotDelay));
console.log(
  `enemy-doctrine: OK — ${Object.keys(DOCTRINES).length} classes, ${new Set(Object.values(DOCTRINES).map((d) => d.shape)).size} distinct volley shapes, `
  + `first shot in ${fastest}s, nothing fans, heavy round telegraphed and drawn.`,
);
