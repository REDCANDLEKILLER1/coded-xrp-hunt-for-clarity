// L1-G retry lifecycle test.
//
// Reproduces the exact soft-lock: after a successful boarding, an on-foot defeat
// restores the flight checkpoint, which clears and rebuilds the disabled warship
// inside ONE synchronous call. No animation frame observes the intermediate null,
// so DirectBoardingRuntime's internal latch never self-clears and boarding can
// never start again. The fix is the explicit resetForRetry() lifecycle call.
//
// This drives the real bundled DirectBoardingRuntime against a stubbed DOM —
// it is a behavioural test, not a source-text grep.

import { build } from 'esbuild';

const result = await build({
  entryPoints: ['src/game/ui/DirectBoardingRuntime.ts'],
  bundle: true,
  format: 'esm',
  write: false,
  logLevel: 'silent',
});

// ---- minimal DOM harness -------------------------------------------------
const rafQueue = [];
const dispatched = [];

function stubCtx() {
  const noop = () => {};
  return new Proxy({}, {
    get: (_t, prop) => {
      if (prop === 'canvas') return { width: 0, height: 0 };
      return noop;
    },
    set: () => true,
  });
}

function stubCanvas() {
  return {
    style: {},
    width: 0,
    height: 0,
    setAttribute: () => {},
    getContext: () => stubCtx(),
  };
}

const shell = { appendChild: () => {} };

globalThis.document = { createElement: () => stubCanvas() };
globalThis.window = { addEventListener: () => {}, dispatchEvent: (e) => dispatched.push(e) };
globalThis.performance = globalThis.performance ?? { now: () => 0 };
globalThis.devicePixelRatio = 1;
globalThis.innerWidth = 900;
globalThis.innerHeight = 500;
globalThis.requestAnimationFrame = (cb) => { rafQueue.push(cb); return rafQueue.length; };
globalThis.CustomEvent = class { constructor(type, init) { this.type = type; this.detail = init?.detail; } };

const mod = await import('data:text/javascript,' + encodeURIComponent(result.outputFiles[0].text));
const { DirectBoardingRuntime } = mod;

// ---- scenario ------------------------------------------------------------
const ENTRY_Y_OFFSET = 28; // EARTH_WARSHIP_BOARDING.entryYOffset

function makeDisabledWarship() {
  return { x: 450, y: 180, w: 150, h: 92, state: 'disabled' };
}

const game = {
  player: { x: 450, y: 208, w: 40, h: 48 },
  warship: makeDisabledWarship(),
  suspendCount: 0,
  suspend() { this.suspendCount += 1; },
};

let clock = 0;
function pump(frames, { holdInside = true } = {}) {
  for (let i = 0; i < frames; i++) {
    const cb = rafQueue.shift();
    if (!cb) break;
    clock += 50; // 0.05s steps (the runtime clamps dt at 0.05)
    if (holdInside && game.warship) {
      // Keep the fighter parked in the aperture as the inert hull drifts down.
      game.player.x = game.warship.x;
      game.player.y = game.warship.y + ENTRY_Y_OFFSET;
    }
    cb(clock);
  }
}

const errors = [];
const boardingEvents = () => dispatched.filter((e) => e.type === 'coded:boarding-complete').length;

const boarding = new DirectBoardingRuntime(game, shell);

// 1. First boarding must complete.
pump(200);
if (boardingEvents() !== 1) {
  errors.push(`boarding-retry: first boarding did not complete (events=${boardingEvents()})`);
}
if (game.suspendCount !== 1) {
  errors.push(`boarding-retry: flight engine was not suspended on first boarding (suspend=${game.suspendCount})`);
}

// 2. Negative control — reproduce the checkpoint restore WITHOUT the explicit
//    reset. The latch must survive, proving this test can catch the regression.
game.warship = null;
game.warship = makeDisabledWarship(); // same synchronous turn, exactly like reset()
pump(200);
if (boardingEvents() !== 1) {
  errors.push('boarding-retry: negative control is not exercising the latch — test would not catch a regression');
}

// 3. The fix — explicit lifecycle reset before the restore, then retry.
if (typeof boarding.resetForRetry !== 'function') {
  errors.push('boarding-retry: DirectBoardingRuntime.resetForRetry() is missing');
} else {
  boarding.resetForRetry();
  game.warship = null;
  game.warship = makeDisabledWarship(); // still one synchronous turn
  pump(200);
  if (boardingEvents() !== 2) {
    errors.push(`boarding-retry: boarding did not become available again after resetForRetry (events=${boardingEvents()})`);
  }
  if (game.suspendCount !== 2) {
    errors.push(`boarding-retry: retry did not suspend the flight engine (suspend=${game.suspendCount})`);
  }
}

if (errors.length > 0) {
  console.error('L1-G boarding retry validation FAILED:');
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}

console.log('L1-G boarding retry validation OK — on-foot defeat restores a boardable warship.');
