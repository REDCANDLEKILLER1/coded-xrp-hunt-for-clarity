// Double-tap bomb, and the seeker's unlimited supply.
//
// On a phone the bomb button costs you the fighter: reaching it means lifting
// the thumb that is steering. A double-tap anywhere fires the same bomb
// without letting go. The button stays -- this is an addition, not a swap.
//
// The seeker half is a regression guard. Rockets have always reloaded on a
// timer with no ammo pool, and nothing may quietly turn them into a
// consumable; the HUD now says so out loud.

import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };

// ---- behavioural: the gesture is real, and it is a gesture ---------------
const bundle = await build({
  entryPoints: ['src/game/core/Input.ts'],
  bundle: true,
  format: 'esm',
  write: false,
  logLevel: 'silent',
});

const { Input } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`
);

// A canvas stub: Input only needs listener registration and a bounding rect.
const listeners = new Map();
const canvas = {
  addEventListener: (type, fn) => listeners.set(type, fn),
  getBoundingClientRect: () => ({ left: 0, top: 0 }),
};
globalThis.window ??= { addEventListener: () => {} };
let now = 0;
globalThis.performance = { now: () => now };

const input = new Input(canvas);
const down = (x, y, at) => {
  now = at;
  listeners.get('pointerdown')({ preventDefault() {}, clientX: x, clientY: y });
};

// Two quick taps in the same spot are a double.
down(200, 200, 0);
check(input.consumeDoubleTap() === null, 'a single tap must not fire a bomb');
down(203, 198, 120);
const fired = input.consumeDoubleTap();
check(fired !== null, 'two taps 120ms apart in the same spot should register a double-tap');
check(input.consumeDoubleTap() === null, 'a double-tap must be reported exactly once');

// Too slow is two singles.
down(200, 200, 1000);
down(200, 200, 1600);
check(input.consumeDoubleTap() === null, 'taps 600ms apart must not register as a double-tap');

// Too far apart is two singles -- otherwise steering across the screen and
// tapping again would throw a bomb the player never asked for.
down(100, 100, 2000);
down(400, 240, 2100);
check(input.consumeDoubleTap() === null, 'taps 300px apart must not register as a double-tap');

// A triple tap is one double plus one single, not two overlapping doubles.
down(300, 150, 3000);
down(300, 150, 3100);
check(input.consumeDoubleTap() !== null, 'triple tap: the first pair should fire');
down(300, 150, 3200);
check(input.consumeDoubleTap() === null, 'triple tap: the third tap must not fire a second bomb');

// The steering contract still holds: a double-tap is also a pointer-down, so
// the finger that fired keeps flying the ship.
check(input.pointerOrigin !== null, 'a double-tap must still begin a steering gesture');
check(input.consumeTap() !== null, 'a double-tap must still deliver its ordinary tap');

// ---- source: routing, guards, and the on-screen teaching ----------------
const game = readFileSync('src/game/core/Game2A.ts', 'utf8');
const actions = game.split('private actions(): void {')[1]?.split('\n  }\n')[0] ?? '';

check(/consumeDoubleTap\(\)/.test(actions), 'actions() must consume the double-tap');
check(
  /const doubleTap = this\.input\.consumeDoubleTap\(\);/.test(actions),
  'the double-tap must be drained unconditionally, or one made in a menu fires later',
);

// Scope the guard checks to the double-tap block itself. Testing the whole of
// actions() looked fine but proved nothing: `!this.paused` and `mode === 'play'`
// both appear in the pause handler a few lines above, so every guard passed
// even with the guard deleted.
const gate = actions
  .split('const doubleTap = this.input.consumeDoubleTap();')[1]
  ?.split('this.useBomb();')[0] ?? '';
check(gate.length > 0, 'could not isolate the double-tap guard block');

for (const [guard, why] of [
  ["this.mode === 'play'", 'outside a flight'],
  ['!this.paused', 'while paused'],
  ['this.launchClock <= 0', 'during the launch cinematic'],
  ['this.upgradeOffer.length === 0', 'while an upgrade card is up'],
  ['!this.inControls(doubleTap.x, doubleTap.y)', 'when it lands on a button'],
]) {
  check(gate.includes(guard), `a double-tap must not drop a bomb ${why} (missing guard: ${guard})`);
}
check(/this\.useBomb\(\);/.test(actions), 'the double-tap must call useBomb()');

// The button stays. The user asked to keep it, and it is where the teaching
// lives.
check(/this\.padButton\(this\.zone\.bomb,/.test(game), 'the BOMB button must stay on screen');
check(/caption: '2× TAP'/.test(game), 'the BOMB button should say that a double-tap does the same thing');
check(/DOUBLE-TAP ANYWHERE TO DROP A BOMB/.test(game), 'the first flight should spell the gesture out');
check(/private drawBombHint\(\): void \{/.test(game), 'drawBombHint() is missing');
check(
  /this\.bombHintShown = true;/.test(game.split('private useBomb(): void {')[1]?.split('\n  }\n')[0] ?? ''),
  'using a bomb must retire the nudge -- a taught player should not be nagged',
);

// ---- the seeker is not, and must not become, a consumable ---------------
const fire = game.split('private updateSeekers(')[0];
check(
  /this\.seekerClock -= dt;/.test(game) && /this\.seekerClock = SEEKER_INTERVAL;/.test(game),
  'seekers must reload on a timer',
);
check(
  !/seekerAmmo|seekerStock|seekerCount\s*-=|this\.seekers\w*Left/.test(game),
  'seekers must have no ammo pool -- they are part of the weapon, not a pickup',
);
const launch = game.split('if (this.xpLevel >= SEEKER_UNLOCK_LEVEL) {')[1]?.split('\n    }')[0] ?? '';
check(launch.length > 0, 'the seeker launch gate should key off the unlocked level alone');
check(
  !/bombs|pickup|ammo/i.test(launch),
  'nothing but the level gate and the reload timer may stand between the player and a rocket',
);
check(/SEEKER \\u221e|SEEKER ∞/.test(game), 'the HUD should mark the seeker as unlimited');

if (failures.length > 0) {
  console.error('double-tap-bomb validation FAILED:');
  for (const line of failures) console.error(`  - ${line}`);
  process.exit(1);
}
console.log('double-tap-bomb: OK — gesture fires a bomb without dropping the stick, seekers stay unlimited.');
