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
