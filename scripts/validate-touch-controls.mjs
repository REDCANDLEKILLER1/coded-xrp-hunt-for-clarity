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

// ---- source: the game asks the origin, not the live pointer ---------------
const game = readFileSync('src/game/core/Game2A.ts', 'utf8');

check(/this\.inControls\(origin\.x, origin\.y\)/.test(game), 'steering must test where the gesture STARTED, not where the finger is now');
check(!/!this\.inControls\(pointer\.x, pointer\.y\)/.test(game), 'steering must not test the live pointer position — that is the bug');

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
