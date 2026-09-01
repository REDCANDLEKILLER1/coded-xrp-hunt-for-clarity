// Touch controls and the action pad.
//
// Playtest report: "the ship thinks that the buttons on the right are
// obstacles ... we can't put our fingers through the buttons without touching
// them". Steering asked whether the pointer was over a button RIGHT NOW, so
// dragging the fighter across the pad stopped it dead -- and on a phone you
// cannot lift a thumb over an obstacle mid-drag.
//
// What a gesture is for must be decided once, at pointer-down.

import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };

// ---- behavioural: Input tracks where the gesture began --------------------
const bundle = await build({
  entryPoints: ['src/game/core/Input.ts'],
  bundle: true,
  format: 'esm',
  write: false,
  logLevel: 'silent',
});

const listeners = new Map();
const stubCanvas = {
  addEventListener: (type, fn) => listeners.set(type, fn),
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 700, height: 274 }),
};
globalThis.window = { addEventListener: () => {}, innerWidth: 700, innerHeight: 274 };

const { Input } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`
);

const input = new Input(stubCanvas);
const send = (type, x, y) => listeners.get(type)?.({ clientX: x, clientY: y, preventDefault() {} });

check(input.pointerOrigin === null, 'no gesture in flight should mean no origin');

send('pointerdown', 120, 214);
check(input.pointerOrigin?.x === 120 && input.pointerOrigin?.y === 214, 'pointerdown must record where the gesture began');

// Drag right across where the action pad sits. The ORIGIN must not move --
// that is the whole point: the gesture keeps the meaning it started with.
send('pointermove', 660, 214);
check(input.pointer?.x === 660, 'pointermove must update the live pointer');
check(input.pointerOrigin?.x === 120, 'the origin must not follow the finger, or the pad becomes a wall again');

send('pointerup');
check(input.pointerOrigin === null, 'pointerup must clear the origin');

// A gesture that begins on the pad keeps ITS origin, so it stays a button press.
send('pointerdown', 651, 228);
send('pointermove', 300, 214);
check(input.pointerOrigin?.x === 651, 'a gesture starting on the pad must keep its origin');
// ...but it is a DRAG now, and a drag steers whatever it started on. Reported
// from a phone: thumb planted on the pad in the bottom-right -- where a thumb
// rests, and where you put it to pull the fighter down -- moved the ship not at
// all, for the whole gesture.
check(input.dragged === true, 'a gesture that has crossed the screen must report as a drag');
send('pointerup');
check(input.consumeTap() === null, 'a drag must not also press the button it began on');

// A press that stays put is still a button, and it fires when the finger lifts.
send('pointerdown', 651, 228);
send('pointermove', 655, 231);
check(input.dragged === false, 'a few pixels of thumb wobble is not a drag');
check(input.consumeTap() === null, 'a press must not fire until the finger lifts');
send('pointerup');
check(input.consumeTap() !== null, 'a press that never moved must fire its button on release');

// A cancelled gesture is the browser taking the finger away, not a tap.
send('pointerdown', 400, 200);
send('pointercancel');
check(input.consumeTap() === null, 'a cancelled gesture must not fire a button');

// ---- source: the game asks the origin, not the live pointer ---------------
// Comments stripped first: five checks in this repo have matched an
// explanatory comment instead of the code it explained.
const codeOf = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const game = codeOf(readFileSync('src/game/core/Game2A.ts', 'utf8'));

check(/this\.inControls\(origin\.x, origin\.y\)/.test(game), 'steering must test where the gesture STARTED, not where the finger is now');
check(!/!this\.inControls\(pointer\.x, pointer\.y\)/.test(game), 'steering must not test the live pointer position — that is the bug');
check(
  /!this\.inControls\(origin\.x, origin\.y\) \|\| this\.input\.dragged/.test(game),
  'a drag that began on a control must take over steering, or the thumb rest is a dead zone',
);

// ---- the fighter can reach the top of the screen --------------------------
// "I can't move my ship up or down." Portrait reserved the top 34%: a hard,
// invisible wall at y=270 on a 393x793 phone, with the ship stopping dead under
// the finger. Landscape had been cut to 12% years earlier, so the same game
// rotated obeyed a different rule.
const laneFractions = [...game.matchAll(/const FLIGHT_LANE_TOP = ([\d.]+);|const DUEL_LANE_TOP = ([\d.]+);|const ENEMY_STATION_TOP = ([\d.]+);/g)];
const constOf = (name) => {
  const match = game.match(new RegExp(`const ${name} = ([\\d.]+);`));
  return match ? Number(match[1]) : NaN;
};
const flightTop = constOf('FLIGHT_LANE_TOP');
const duelTop = constOf('DUEL_LANE_TOP');
const stationTop = constOf('ENEMY_STATION_TOP');
check(laneFractions.length >= 3, 'the lane and station fractions must all be named constants');
check(Number.isFinite(flightTop), 'ordinary flight needs a named lane top');
// The relationship, not the number: retuning either constant keeps this honest.
check(
  flightTop <= stationTop,
  `the fighter must reach the top of the enemy formation: lane top ${flightTop} vs station top ${stationTop}`,
);
check(duelTop <= flightTop, 'a duel must open the arena at least as far as ordinary flight');

// One rule for both orientations. This is the check that would have caught the
// original divergence: portrait and landscape reading different numbers.
const lane = game.slice(game.indexOf('private playerLane()'), game.indexOf('private duelling()'));
check(
  !/landscape/.test(lane),
  'the flight lane must not depend on orientation — the same game rotated had a wall in a different place',
);
check(
  /this\.h \* \(this\.duelling\(\) \? DUEL_LANE_TOP : FLIGHT_LANE_TOP\)/.test(lane),
  'the lane top must come from the two named constants',
);

// ---- the pad is round, cornered, and out of the flight path ---------------
check(/function inCircle\(/.test(game), 'round buttons need a circular hit test');
check(/Math\.hypot\(x - circle\.cx, y - circle\.cy\) <= circle\.r \+ 6/.test(game), 'circular hit test needs thumb forgiveness past the drawn edge');
check(/private padButton\(/.test(game), 'the action pad must use the round button renderer');
for (const zone of ['special', 'bomb', 'pause', 'assets']) {
  const pattern = new RegExp(`${zone}: \\{ cx: [^}]*r: `);
  check(pattern.test(game), `zone.${zone} must be a circle (cx/cy/r), not a rectangle`);
}
// Everything on the right edge, so the left of the screen is free to fly in.
check(/special: \{ cx: this\.w - edge - big/.test(game), 'the special button must hug the right edge');
check(/pause: \{ cx: this\.w - edge - tiny/.test(game), 'PAUSE must move off the bottom-left, which used to cost the whole left edge');

// ---- the HUD gave the playfield its room back -----------------------------
// The old readout ran down the left edge to y=128 at 10-13px on a 274px screen.
const hud = game.slice(game.indexOf('private hud(): void {'), game.indexOf('private button(rect: Rect'));
const ys = [...hud.matchAll(/fillText\([^;]*?,\s*(?:14|this\.w \/ 2),\s*(\d+)\)/g)].map((m) => Number(m[1]));
check(ys.length > 0, 'could not read any HUD text baselines — the scraper is broken');
check(Math.max(...ys) <= 50, `HUD text must stay in the top strip; lowest baseline is y=${Math.max(...ys)}`);
check(!/font = '[^']*1[3-9]px/.test(hud), 'HUD text must stay small — nothing 13px or larger');

if (failures.length) {
  console.error('touch-controls: FAIL');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log('touch-controls: OK — gesture intent is fixed at pointer-down, pad is round and cornered, HUD is a top strip.');
