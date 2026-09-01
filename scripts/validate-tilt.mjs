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
// This block previously named its own motions backwards, and that is what put
// an inverted pitch axis on a phone: it added a vector along the screen's DOWN
// axis to gravity and called the result "tipping the top away", when gravity
// leaning toward the bottom of the screen means the bottom edge is the lower
// one -- the top pulled BACK. The assertion and the code agreed with each
// other and both disagreed with the handset.
//
// So the physical motions are no longer asserted by eye. Each is a real
// rotation of the device about one of the screen's own axes, and the sign
// convention is ANCHORED below against beta, where the meaning is not a matter
// of opinion: beta is 0 with the phone flat and screen up and 90 with it
// upright facing the player, so dipping the top away DECREASES beta. Anchoring
// first and generalising second is the whole point -- reasoning directly from
// beta/gamma at an arbitrary screen angle is what gives the wrong sense in half
// the cases.

/** Rodrigues: rotate `v` about unit axis `a` by `t` radians. */
const rotateAbout = (v, a, t) => {
  const c = Math.cos(t);
  const s = Math.sin(t);
  const d = a.x * v.x + a.y * v.y + a.z * v.z;
  return {
    x: v.x * c + (a.y * v.z - a.z * v.y) * s + a.x * d * (1 - c),
    y: v.y * c + (a.z * v.x - a.x * v.z) * s + a.y * d * (1 - c),
    z: v.z * c + (a.x * v.y - a.y * v.x) * s + a.z * d * (1 - c),
  };
};
/**
 * The screen's axes in device coordinates, derived WITHOUT the code under test.
 *
 * This file used to keep a copy of `projectToScreen`'s own basis expression and
 * build its "physical" gestures from it -- rotating gravity about the code's
 * assumed screen-right, then asserting the code reported rotation about
 * screen-right. It agreed with itself for ANY basis, right or wrong, and passed
 * all the way to a handset with landscape steering inverted. That is the fourth
 * time in this repository a test has generated its inputs with the function
 * under test, and the third time in this file.
 *
 * Ground truth is two things stated separately from any of our source:
 *   1. In natural portrait, device +x is screen-right and device +y is
 *      screen-up. Anchored below against the spec (+gamma dips the RIGHT edge).
 *   2. `screen.orientation.angle` is how far the CONTENT was rotated to stay
 *      upright, so the DEVICE turned the other way: the screen axes in device
 *      coordinates are the portrait axes rotated by -angle about +z.
 */
const PORTRAIT_RIGHT = { x: 1, y: 0, z: 0 };
const PORTRAIT_DOWN = { x: 0, y: -1, z: 0 };
const SCREEN_NORMAL = { x: 0, y: 0, z: 1 };
const screenBasis = (angle) => ({
  right: rotateAbout(PORTRAIT_RIGHT, SCREEN_NORMAL, -angle * Math.PI / 180),
  down: rotateAbout(PORTRAIT_DOWN, SCREEN_NORMAL, -angle * Math.PI / 180),
});

// ---- THE ANCHOR MUST NOT COME FROM THE FUNCTION UNDER TEST ---------------
//
// This block used to build its ground truth by calling gravityFromOrientation
// and comparing it against itself. That is not an anchor, it is a tautology,
// and it is exactly how a mirrored device frame shipped to a phone: the module
// negated the x term, every test generated its inputs with the same negation,
// and test and code agreed with each other while disagreeing with the handset.
// The report that broke the tie was "left and right are backwards".
//
// Ground truth is now built from the specification itself. DeviceOrientation
// defines the device-to-earth rotation as the intrinsic Z-X'-Y'' sequence
// R = Rz(alpha) . Rx(beta) . Ry(gamma); gravity in device coordinates is
// R-transpose applied to earth-down, (0, 0, -1). Nothing below calls the module
// to decide what the right answer is.
const matmul = (A, B) => A.map((row, i) => B[0].map((_, j) => row.reduce((sum, _v, k) => sum + A[i][k] * B[k][j], 0)));
const rotX = (b) => [[1, 0, 0], [0, Math.cos(b), -Math.sin(b)], [0, Math.sin(b), Math.cos(b)]];
const rotY = (g) => [[Math.cos(g), 0, Math.sin(g)], [0, 1, 0], [-Math.sin(g), 0, Math.cos(g)]];
/** Gravity in device coordinates, straight from the spec's rotation sequence. */
const gravityFromSpec = (betaDeg, gammaDeg) => {
  const R = matmul(rotX(betaDeg * Math.PI / 180), rotY(gammaDeg * Math.PI / 180));
  return { x: -R[2][0], y: -R[2][1], z: -R[2][2] };
};

{
  const same = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) < 1e-6;
  const D = Math.PI / 180;

  // THE CHECK THAT WOULD HAVE CAUGHT IT. The module has to agree with the
  // spec across the whole range, not merely at the poses where a mirrored
  // frame happens to look identical (anything with gamma = 0).
  for (const [beta, gamma] of [[0, 0], [30, 0], [0, 45], [0, -45], [30, 20], [30, -20], [45, 60], [10, 88], [-25, -70]]) {
    check(
      same(gravityFromOrientation(beta, gamma), gravityFromSpec(beta, gamma)),
      `gravityFromOrientation(${beta}, ${gamma}) disagrees with the Z-X'-Y'' spec rotation`,
    );
  }
  // Stated as a physical fact as well, because a sign is easier to argue with
  // than a matrix: MDN gives gamma positive values "when the device is tilted
  // to the right", and device x is screen-right, so a flat phone at +gamma
  // must have gravity pulling toward its right edge.
  check(gravityFromSpec(0, 30).x > 0, 'spec: a POSITIVE gamma dips the screen right edge');
  check(gravityFromOrientation(0, 30).x > 0, 'the module must agree: +gamma dips the RIGHT edge, not the left');

  const { right: sRight, down: sDown } = screenBasis(0);
  const neutral = gravityFromSpec(30, 0);
  check(
    same(rotateAbout(neutral, sRight, 15 * D), gravityFromSpec(15, 0)),
    'anchor: +theta about screenRight must be the top tipping AWAY (beta 30 -> 15, toward flat)',
  );
  check(
    same(rotateAbout(neutral, sDown, 15 * D), gravityFromSpec(30, 15)),
    'anchor: +theta about screenDown must be the RIGHT edge dipping (gamma 0 -> +15)',
  );
}

for (const angle of [0, 90, 180, 270]) {
  const D = Math.PI / 180;
  const { right: sRight, down: sDown } = screenBasis(angle);
  // Two neutrals, because they prove different things.
  //
  // FLAT (beta 0, gamma 0) puts gravity down the screen normal, so both screen
  // axes are perpendicular to it and a rotation of 15 degrees about either one
  // moves gravity by exactly 15 degrees of minimal rotation. That makes the
  // magnitude an exact number and pins the axes down completely.
  //
  // HELD (beta 30) is how a phone is actually carried. There gravity already
  // leans along one screen axis, so a 15-degree roll sweeps a narrower cone and
  // legitimately reads as less than 15 -- which is why the magnitude is only
  // asserted on the flat pose, and the held pose carries sign and cross-talk.
  const flat = gravityFromOrientation(0, 0);
  const held = gravityFromOrientation(30, 0);
  const from = (n) => (axis, degrees) => projectToScreen(rotateAbout(n, axis, degrees * D), n, angle);
  const moveFlat = from(flat);
  const move = from(held);

  const dipRight = moveFlat(sDown, 15);
  const dipLeft = moveFlat(sDown, -15);
  const topAway = moveFlat(sRight, 15);
  const topBack = moveFlat(sRight, -15);
  for (const [label, lean] of [
    ['dipping the right edge', [move(sDown, 15).right, +1]],
    ['dipping the left edge', [move(sDown, -15).right, -1]],
    ['tipping the top away', [move(sRight, 15).down, +1]],
    ['pulling the top back', [move(sRight, -15).down, -1]],
  ]) {
    check(lean[0] * lean[1] > 5, `angle ${angle}: held upright, ${label} must lean the right way (got ${lean[0].toFixed(1)})`);
  }

  // Sign AND magnitude. A 15-degree roll about the screen's true down axis has
  // to come back as ~15 degrees of right lean: sign alone would still pass a
  // basis rotated 90 degrees, and "> 5" would still pass one badly skewed.
  // The shipped basis was 180 degrees out at 90 and 270, which sign catches --
  // but the magnitude is what pins the axis down for every future change.
  const near15 = (value) => Math.abs(value - 15) < 0.5;
  check(near15(dipRight.right), `angle ${angle}: dipping the right edge 15deg must read as ~15deg of right lean, got ${dipRight.right.toFixed(1)}`);
  check(near15(-dipLeft.right), `angle ${angle}: dipping the left edge 15deg must read as ~15deg of left lean, got ${dipLeft.right.toFixed(1)}`);
  check(near15(topAway.down), `angle ${angle}: tipping the top away 15deg must read as ~15deg of nose-down, got ${topAway.down.toFixed(1)}`);
  check(near15(-topBack.down), `angle ${angle}: pulling the top back 15deg must read as ~15deg of nose-up, got ${topBack.down.toFixed(1)}`);
  // The axes must stay separate, or rolling would also pitch.
  check(Math.abs(dipRight.down) < 1, `angle ${angle}: a pure roll must not pitch`);
  check(Math.abs(topAway.right) < 1, `angle ${angle}: a pure pitch must not roll`);
}

// And end to end through the source, at a pose someone would actually hold.
// A phone balanced exactly on its edge is deliberately NOT used: gravity
// cannot see rotation about gravity, so that pose genuinely has one live axis.
{
  const { dev, src } = await calibrated(30, 0, { angle: 0 });
  // At screen angle 0 a POSITIVE gamma dips the screen's right edge: gravity
  // gains +x, which is screen-right. This block asserted the opposite for as
  // long as the module mirrored its own x axis, and passed the whole time.
  // Asserting the direction and not merely that the two are opposite is the
  // point -- a flipped sign passes an opposite-signs check while sending every
  // turn the wrong way.
  const dipRight = settle(dev, src, 30, 15);
  const dipLeft = settle(dev, src, 30, -15);
  check(dipRight.x > 0.2, `dipping the right edge must turn RIGHT (got ${dipRight.x.toFixed(2)})`);
  check(dipLeft.x < -0.2, `dipping the left edge must turn LEFT (got ${dipLeft.x.toFixed(2)})`);

  // Beta DECREASES as the top of the phone dips away, because beta 0 is flat
  // with the screen up and beta 90 is upright. Reading it the other way round
  // is exactly the mistake that shipped an inverted pitch axis.
  const away = settle(dev, src, 15, 0);
  const back = settle(dev, src, 45, 0);
  check(away.y > 0.2, `tipping the top away (beta 30 -> 15) must pitch the nose DOWN (got ${away.y.toFixed(2)})`);
  check(back.y < -0.2, `pulling the top back (beta 30 -> 45) must pitch the nose UP (got ${back.y.toFixed(2)})`);
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
