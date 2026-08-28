// Boss lock-step duel.
//
// "make it to where the balls can move around the screen and our character
// stays pointed towards him ... you're always facing him but you can try to
// sneak around beside him so let's say you get next to him you're not still
// shooting up, you're shooting towards him ... but the boss is also doing the
// same thing to you".
//
// The turning maths is tested for real; the wiring is checked in source,
// because a rotation only exists as pixels.

import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };

// Game2A pulls in the debug log and the sound engine, both of which touch
// browser globals the moment they are imported. Stub the few they need; nothing
// here constructs the game itself.
const noopStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
globalThis.localStorage = noopStorage;
globalThis.window = {
  addEventListener: () => {},
  removeEventListener: () => {},
  innerWidth: 700,
  innerHeight: 274,
  localStorage: noopStorage,
};
globalThis.document = { addEventListener: () => {}, removeEventListener: () => {} };
globalThis.matchMedia = () => ({ matches: false, addEventListener: () => {} });
globalThis.screen = { width: 700, height: 274 };
globalThis.Image = class {};
globalThis.innerWidth = 700;
globalThis.innerHeight = 274;

const bundle = await build({
  entryPoints: ['src/game/core/Game2A.ts'],
  bundle: true,
  format: 'esm',
  write: false,
  logLevel: 'silent',
});
const { turnToward } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`
);

const norm = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const near = (a, b, tol = 1e-9) => Math.abs(norm(a - b)) <= tol;

check(typeof turnToward === 'function', 'turnToward is not exported');

// A step larger than the gap lands exactly on target, never past it.
check(near(turnToward(0, 1, 5), 1), 'an oversized step must land on the target, not overshoot');
check(near(turnToward(1, 0, 5), 0), 'an oversized step must land on the target turning the other way');

// A step smaller than the gap moves by exactly the step.
check(near(turnToward(0, 2, 0.5), 0.5), 'a limited turn must move by exactly the step');
check(near(turnToward(2, 0, 0.5), 1.5), 'a limited turn must move by exactly the step, reversed');

// The wrap: turning from just under +PI to just over -PI is a SHORT hop across
// the seam, not most of a circle the other way. This is the bug worth testing.
const from = Math.PI - 0.05;
const to = -Math.PI + 0.05;
const stepped = turnToward(from, to, 0.2);
check(near(stepped, to), `crossing the -PI/+PI seam should finish the 0.1rad turn, got ${stepped.toFixed(3)}`);
check(Math.abs(norm(stepped - from)) < 0.2, 'the seam crossing took the long way round');

// Repeated small steps must converge, not oscillate or spin.
let angle = 0;
for (let i = 0; i < 400; i++) angle = turnToward(angle, -2.5, 0.05);
check(near(angle, -2.5, 1e-6), `repeated turns did not converge, ended at ${angle.toFixed(3)}`);

// Already on target is a no-op.
check(near(turnToward(1.2, 1.2, 0.3), 1.2), 'turning toward the current heading must not move');

// ---- wiring ----------------------------------------------------------------
const game = readFileSync('src/game/core/Game2A.ts', 'utf8');

check(/private duelling\(\): boolean/.test(game), 'there must be a duel state');
check(/return this\.boss\?\.state === 'fight';/.test(game), 'the duel is exactly a boss actually fighting');

// Both noses track, and the player turns faster than the boss so flanking works.
check(/private updateFacing\(dt: number\)/.test(game), 'nothing updates the facing');
check(/this\.updateFacing\(dt\);/.test(game), 'updateFacing is never called');
const duelTurn = Number((game.match(/^const DUEL_TURN = ([\d.]+);/m) ?? [])[1]);
const bossTurn = Number((game.match(/^const BOSS_TURN = ([\d.]+);/m) ?? [])[1]);
check(duelTurn > bossTurn, `the fighter turns at ${duelTurn} and the boss at ${bossTurn} — flanking is impossible unless the fighter is quicker`);
check(bossTurn > 0, 'the boss must track the player too');

// Outside a duel the fighter points up, which the rest of the game assumes.
check(/: -Math\.PI \/ 2;/.test(game), 'the fighter must return to pointing up outside a duel');

// The arena opens so you can get ABOVE the boss.
check(/this\.duelling\(\) \? DUEL_LANE_TOP/.test(game), 'the flight lane must open during a duel');
check(/const DUEL_LANE_TOP = 0\.06;/.test(game), 'the duel lane must reach near the top of the screen');

// Guns fire along the nose: the whole point of flanking.
check(/const heading = this\.playerFacing \+ Math\.PI \/ 2;/.test(game), 'the volley must be rotated by the heading');
check(/Math\.sin\(shot\.angle \+ heading\) \* projectile\.speed/.test(game), 'shot angles must be offset by the heading');
check(/muzzleX \* cos - muzzleY \* sin/.test(game), 'muzzle offsets must rotate with the ship, or wide barrels fire from the wrong place');
// A rotated volley can leave by any edge, not just the top.
check(/bolt\.y < this\.h \+ 40 && bolt\.x > -40/.test(game), 'bolts must be culled on every edge once they can fly sideways');

// Both sprites rotate.
check(/private drawFacing\(/.test(game), 'sprites need a rotated draw');
check(/this\.drawFacing\(def\.sprite, this\.player\.x/.test(game), 'the fighter sprite must rotate');
check(/this\.drawFacing\(def\.sprite, boss\.x/.test(game), 'the boss sprite must rotate');

// The boss roams instead of holding one altitude.
check(/Math\.sin\(boss\.age \* 0\.43\) \* roam/.test(game), 'the boss must roam the screen during a duel');

// Facing must not survive a run.
check(/this\.playerFacing = -Math\.PI \/ 2;\n    this\.bossFacing = Math\.PI \/ 2;/.test(game), 'facing must reset with the run');

if (failures.length) {
  console.error('boss-duel: FAIL');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(`boss-duel: OK — turning verified across the -PI/+PI seam, fighter turns at ${duelTurn} vs the boss at ${bossTurn}.`);
