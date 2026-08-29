// Tilt steering for the 3D level: the maths, and the bug that killed it before.
//
// Tilt cannot be tested against a real sensor in a headless browser, which is
// exactly why the module takes its samples through an injected environment.
// The case that has to be proven is the one that broke it last time and is
// invisible in a screenshot: a phone held in LANDSCAPE sits at gamma near
// +/-90 degrees, where beta flips through ~180 and a naive angular delta reads
// 172-177 degrees. The ship pins to full deflection while the player holds it
// perfectly still. Working on the gravity vector instead makes that pose
// continuous, and the test below is what says so.

import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

// The module logs through DebugLog, which publishes itself onto `window` at
// import time for on-device diagnosis. Node has no window, so give it the
// smallest surface that lets the import succeed. Nothing under test touches
// these -- the sensor itself arrives through the injected environment.
globalThis.window = globalThis.window ?? {
  addEventListener: () => {}, removeEventListener: () => {},
  setTimeout: () => 0, clearTimeout: () => {},
};
globalThis.localStorage = globalThis.localStorage ?? {
  getItem: () => null, setItem: () => {}, removeItem: () => {},
};

const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };
const near = (a, b, tol, message) => check(Math.abs(a - b) <= tol, `${message} (got ${a}, expected ~${b})`);

const bundle = await build({
  entryPoints: ['src/game/space3d/Tilt.ts'],
  bundle: true, format: 'esm', write: false, logLevel: 'silent',
});
const { TiltSource, gravityFromOrientation, projectToScreen, normalizeTilt, normalizeScreenAngle } =
  await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

// ---- a fake device -------------------------------------------------------
function fakeDevice({ permissioned = false, angle = 90 } = {}) {
  let handler = null;
  let clock = 0;
  const env = {
    subscribe: (h) => { handler = h; return () => { handler = null; }; },
    screenAngle: () => angle,
    now: () => clock,
  };
  if (permissioned) env.requestPermission = async () => true;
  return {
    env,
    advance: (ms) => { clock += ms; },
    emit: (beta, gamma) => handler?.({ beta, gamma }),
    get bound() { return handler !== null; },
  };
}

/** Drives a source to a calibrated neutral at the given pose. */
async function calibrated(beta, gamma, opts = {}) {
  const dev = fakeDevice(opts);
  const src = new TiltSource(dev.env);
  if (opts.permissioned) await src.requestPermission();
  for (let i = 0; i < 10; i += 1) { dev.emit(beta, gamma); dev.advance(100); }
  dev.emit(beta, gamma);
  return { dev, src };
}

/** Reads the settled stick after holding a pose. */
function settle(dev, src, beta, gamma) {
  for (let i = 0; i < 240; i += 1) { dev.emit(beta, gamma); src.update(1 / 60); }
  return src.read();
}

// ---- gravity is a unit vector, everywhere -------------------------------
for (const [beta, gamma] of [[0, 0], [45, 0], [0, 90], [0, -90], [90, 90], [-30, 175], [12, -88]]) {
  const g = gravityFromOrientation(beta, gamma);
  near(Math.hypot(g.x, g.y, g.z), 1, 1e-9, `gravity at beta=${beta} gamma=${gamma} must be a unit vector`);
}

// ---- THE LANDSCAPE SINGULARITY ------------------------------------------
// Around gamma = +/-90 a small physical movement must stay a small reading.
for (const pivot of [90, -90]) {
  const base = gravityFromOrientation(0, pivot);
  for (const d of [0.5, 1, 2]) {
    const moved = gravityFromOrientation(0, pivot + d);
    const lean = projectToScreen(moved, base, 90);
    const magnitude = Math.hypot(lean.right, lean.down);
    check(
      magnitude < d * 3 + 1,
      `at gamma=${pivot} a ${d} degree move read as ${magnitude.toFixed(1)} degrees of lean — the singularity is back`,
    );
  }
  // And beta flipping across the pole must not read as a huge rotation.
  const flipA = gravityFromOrientation(1, pivot);
  const flipB = gravityFromOrientation(-1, pivot);
  const across = projectToScreen(flipB, flipA, 90);
  check(
    Math.hypot(across.right, across.down) < 12,
    `beta flipping through the gamma=${pivot} pole read as ${Math.hypot(across.right, across.down).toFixed(0)} degrees`,
  );
}

// A held pose produces a still stick, at the pose that used to pin it.
{
  const { dev, src } = await calibrated(0, 90);
  check(src.status === 'ready', 'a steady pose must calibrate');
  const held = settle(dev, src, 0, 90);
  near(Math.hypot(held.x, held.y), 0, 1e-6, 'holding the calibration pose in landscape must read as no input');
}

// ---- direction, in screen space, for every orientation -----------------
//
// Tested by constructing the gravity change a physical movement produces,
// rather than by picking beta/gamma values: which way those Euler axes point
// depends on the orientation being held, so reasoning from them gives the
// wrong sense in half the cases. Screen space is the frame the player is
// actually in.
{
  const norm = (v) => { const l = Math.hypot(v.x, v.y, v.z) || 1; return { x: v.x / l, y: v.y / l, z: v.z / l }; };
  const D = Math.PI / 180;
  for (const angle of [0, 90, 180, 270]) {
    const a = angle * D;
    const sRight = { x: Math.cos(a), y: Math.sin(a), z: 0 };
    const sDown = { x: Math.sin(a), y: -Math.cos(a), z: 0 };
    const n = norm({ x: 0, y: -0.5, z: -0.866 });        // leaned back 30 degrees
    const lean = (basis, amount) => projectToScreen(
      norm({ x: n.x + amount * basis.x, y: n.y + amount * basis.y, z: n.z + amount * basis.z }), n, angle,
    );
    const dipRight = lean(sRight, 0.26);
    const dipLeft = lean(sRight, -0.26);
    const topAway = lean(sDown, 0.26);
    const topBack = lean(sDown, -0.26);

    check(dipRight.right > 5, `angle ${angle}: dipping the right edge must read as a right lean`);
    check(dipLeft.right < -5, `angle ${angle}: dipping the left edge must read as a left lean`);
    check(topAway.down > 5, `angle ${angle}: tipping the top away must read as nose-down`);
    check(topBack.down < -5, `angle ${angle}: pulling the top back must read as nose-up`);
    // The axes must stay separate, or rolling would also pitch.
    check(Math.abs(dipRight.down) < 1, `angle ${angle}: a pure roll must not pitch`);
    check(Math.abs(topAway.right) < 1, `angle ${angle}: a pure pitch must not roll`);
  }
}

// And end to end through the source, at a pose someone would actually hold.
// A phone balanced exactly on its edge is deliberately NOT used: gravity
// cannot see rotation about gravity, so that pose genuinely has one live axis.
{
  const { dev, src } = await calibrated(30, 0, { angle: 0 });
  // At screen angle 0 a NEGATIVE gamma dips the screen's right edge: gravity
  // gains +x, which is screen-right. Asserting the direction and not merely
  // that the two are opposite is the point -- a flipped sign passes an
  // opposite-signs check while sending every turn the wrong way.
  const dipRight = settle(dev, src, 30, -15);
  const dipLeft = settle(dev, src, 30, 15);
  check(dipRight.x > 0.2, `dipping the right edge must turn RIGHT (got ${dipRight.x.toFixed(2)})`);
  check(dipLeft.x < -0.2, `dipping the left edge must turn LEFT (got ${dipLeft.x.toFixed(2)})`);

  const away = settle(dev, src, 45, 0);
  const back = settle(dev, src, 15, 0);
  check(away.y > 0.2, `tipping the top away must pitch the nose DOWN (got ${away.y.toFixed(2)})`);
  check(back.y < -0.2, `pulling the top back must pitch the nose UP (got ${back.y.toFixed(2)})`);
}

// Rotating about gravity itself is invisible to an accelerometer. That is
// physics, not a defect, and it is pinned so nobody "fixes" it later.
{
  const { dev, src } = await calibrated(0, 0, { angle: 0 });
  const still = settle(dev, src, 0, 0);
  near(Math.hypot(still.x, still.y), 0, 1e-6, 'a flat phone spun about the vertical must not steer');
}

// ---- deadzone and saturation -------------------------------------------
near(normalizeTilt(0, 12), 0, 1e-9, 'no tilt is no input');
near(normalizeTilt(1.0, 12), 0, 1e-9, 'inside the deadzone is no input');
check(normalizeTilt(200, 12) === 1, 'the stick must saturate at 1, not run away');
check(normalizeTilt(-200, 12) === -1, 'the stick must saturate at -1');
check(normalizeTilt(6, 12) > 0 && normalizeTilt(6, 12) < 1, 'between deadzone and full scale must be proportional');

// ---- screen rotation ----------------------------------------------------
for (const [input, expected] of [[0, 0], [89, 90], [90, 90], [180, 180], [270, 270], [-90, 270], [359, 0]]) {
  check(normalizeScreenAngle(input) === expected, `screen angle ${input} must snap to ${expected}`);
}
// Twisting the phone in its own plane must not steer.
{
  const g = gravityFromOrientation(10, 80);
  const flat = projectToScreen(g, g, 0);
  near(Math.hypot(flat.right, flat.down), 0, 1e-9, 'the neutral pose itself must read as zero at any screen angle');
}

// ---- calibration will not latch a moving phone --------------------------
{
  const dev = fakeDevice();
  const src = new TiltSource(dev.env);
  for (let i = 0; i < 12; i += 1) { dev.emit(i * 9, 90 + i * 9); dev.advance(80); }
  check(src.status === 'calibrating', 'a phone still being moved must not latch a neutral pose');
  // ...but it must never strand the player, either.
  for (let i = 0; i < 20; i += 1) { dev.emit(i * 9, 90 + i * 9); dev.advance(200); }
  check(src.status === 'ready', 'calibration must fall back rather than leaving the ship unsteerable');
}

// ---- permission ---------------------------------------------------------
{
  const dev = fakeDevice({ permissioned: true });
  const src = new TiltSource(dev.env);
  check(src.status === 'needs_permission', 'iOS-style devices must wait for a grant');
  check(!dev.bound, 'nothing may bind before permission is granted');
  await src.requestPermission();
  check(dev.bound, 'a granted permission must bind the listener');
}
{
  const denied = { subscribe: () => () => {}, requestPermission: async () => false, screenAngle: () => 0, now: () => 0 };
  const src = new TiltSource(denied);
  await src.requestPermission();
  check(src.status === 'denied', 'a refused grant must be recorded as denied');
  check(src.ready === false, 'a denied source must never claim to be steering');
}
{
  const src = new TiltSource({ subscribe: undefined, screenAngle: () => 0, now: () => 0 });
  check(src.status === 'unavailable', 'a device with no sensor must report unavailable');
}

// ---- recalibration ------------------------------------------------------
{
  const { dev, src } = await calibrated(0, 90);
  settle(dev, src, 15, 90);
  src.recalibrate('test');
  check(src.status === 'calibrating', 'recalibrating must drop the old neutral');
  const zeroed = src.read();
  near(Math.hypot(zeroed.x, zeroed.y), 0, 1e-9, 'the stick must centre while recalibrating');
}

// ---- the wiring, and the boundary that must not move --------------------
const game = readFileSync('src/game/space3d/Space3DGame.ts', 'utf8');
const input = readFileSync('src/game/core/Input.ts', 'utf8');

check(/new TiltSource\(\)/.test(game), 'the segment must own a tilt source');
check(/this\.tilt\.update\(dt\)/.test(game), 'tilt must be advanced with the frame delta, not per-frame constants');
check(/this\.tilt\.ready && this\.pointerId === null/.test(game), 'a finger on the glass must override tilt');
check(/orientationchange/.test(game), 'rotating the handset must recalibrate');
check(/tilt\.requestPermission\(\)/.test(game), 'the iOS grant must be taken from a gesture');
// The canvas handler alone is not enough: a player told the game is flown by
// tilting will pick the phone up and tilt it without ever touching the glass,
// and then the prompt never appears and tilt silently never starts.
check(/private armTiltPermission\(/.test(game), 'the grant must be armed from the first gesture anywhere on the page');
// Defined AND called. A method that exists but is never invoked is the exact
// shape of the orphaned-renderer bug that shipped once already.
check(/this\.armTiltPermission\(\);/.test(game), 'armTiltPermission is defined but never called');
check(
  /document\.addEventListener\(type, grab/.test(game),
  'the first-gesture hook must be document-level, not canvas-only',
);
// A silent sensor and a sensor still settling are different faults and must
// not present identically to whoever is testing on a real phone.
check(/'waiting'/.test(readFileSync('src/game/space3d/Tilt.ts', 'utf8')),
  'a bound-but-silent sensor needs its own state');
check(/private tiltReadout\(/.test(game), 'tilt state must be readable in the cockpit');
check(/TAP TO ALLOW/.test(game) && /SILENT/.test(game) && /DENIED/.test(game),
  'the readout must distinguish the failure modes it exists to tell apart');
// The fallback is not optional: without it a denied prompt is an unplayable level.
check(/const travel = Math\.min\(this\.viewW, this\.viewH\) \* STICK_TRAVEL/.test(game), 'the drag fallback must survive');
check(/Math\.abs\(dx\) > 6 \|\| Math\.abs\(dy\) > 6/.test(game), 'the drag fallback must keep its gesture-intent guard');

// The top-down game stays finger-only. This is the whole reason tilt lives in
// its own module rather than in Input.ts.
for (const banned of ['deviceorientation', 'DeviceOrientationEvent', 'TILT_FULL_SCALE', 'calibrateTilt', 'gravityFromOrientation']) {
  check(!input.includes(banned), `tilt leaked into the top-down game's input (${banned})`);
}

if (failures.length > 0) {
  console.error('tilt FAILED');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('tilt: OK — gravity-vector steering survives the landscape singularity, calibration will not latch a moving phone, drag fallback intact, Input.ts still tilt-free.');
