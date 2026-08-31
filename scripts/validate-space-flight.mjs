// The transit leg: the 3D is real, and it is open space rather than a lane.
//
// This is the part of the game with no reference frame to eyeball. A sprite in
// the wrong place is obvious in a screenshot; a rotation composed in the wrong
// order, or a divide by a negative depth, just makes flying feel wrong -- and
// "feels wrong" is not something a screenshot catches. So the maths runs here.
//
// The case worth the most care is BEHIND YOU. In a lane nothing is ever behind
// the camera; out here half the traffic can be, and a perspective divide by a
// negative depth projects a contact back onto the screen mirrored, as a ghost
// in front of you. Several checks below exist only to pin that down.

import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };
const near = (a, b, tol, message) => check(Math.abs(a - b) <= tol, `${message} (got ${a}, expected ~${b})`);

const bundle = await build({
  entryPoints: ['src/game/space3d/Projection.ts'],
  bundle: true,
  format: 'esm',
  write: false,
  logLevel: 'silent',
});
const {
  project, toView, screenSize, depthAlpha, sortByDepth, onScreen,
  bearing, rangeTo, wrapAngle, forward, interceptTime, NEAR_PLANE, FAR_PLANE,
} = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

const base = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, cx: 390, cy: 190, focal: 430 };
const cam = (over = {}) => ({ ...base, ...over });

// ---- the divide -----------------------------------------------------------
const centre = project(cam(), 0, 0, 500);
near(centre.sx, 390, 0.001, 'a point dead ahead must project to the vanishing point');
near(centre.sy, 190, 0.001, 'a point dead ahead must project to the vanishing point');

// Twice as far is half the size: this is the whole illusion, so it is pinned.
near(screenSize(cam(), 100, 800), screenSize(cam(), 100, 400) / 2, 0.001, 'doubling the depth must halve the drawn size');

// A fixed world point must sweep OUT from the vanishing point as it closes.
let previous = 0;
let monotonic = true;
for (let z = FAR_PLANE; z > NEAR_PLANE + 10; z -= 60) {
  const p = project(cam(), 200, 0, z);
  if (p.sx < previous) monotonic = false;
  previous = p.sx;
}
check(monotonic, 'an approaching contact must sweep outward from the vanishing point, not inward');

// ---- the near plane -------------------------------------------------------
for (const z of [NEAR_PLANE, NEAR_PLANE - 1, 0, -50]) {
  check(project(cam(), 0, 0, z).visible === false, `depth ${z} is at or behind the near plane and must not be drawn`);
  check(screenSize(cam(), 100, z) === 0, `depth ${z} must have no drawn size`);
}
check(project(cam(), 0, 0, NEAR_PLANE + 1).visible === true, 'just in front of the near plane must still draw');
check(Number.isFinite(screenSize(cam(), 100, NEAR_PLANE + 1)), 'size at the near plane must stay finite');

// ---- turning: this is what makes it open space ---------------------------
// Face right, and something that was on your right is now dead ahead.
const turned = project(cam({ yaw: Math.PI / 2 }), 500, 0, 0);
near(turned.sx, 390, 0.001, 'yawing right must bring a contact on your right to the nose');
check(turned.visible, 'a contact you have turned to face must be visible');

// Pitch up, and something above you comes to the nose. (Screen y grows down,
// so "above" is negative y.)
const pitched = project(cam({ pitch: Math.PI / 2 }), 0, -500, 0);
near(pitched.sx, 390, 0.001, 'pitching up must bring a contact above you to the nose');
near(pitched.sy, 190, 0.001, 'pitching up must bring a contact above you to the nose');

// Yaw must not change how FAR something is, only where it appears.
near(rangeTo(toView(cam({ yaw: 1.1 }), 300, -120, 640)), rangeTo(toView(cam(), 300, -120, 640)), 0.001,
  'turning must not change a contact\'s range');

// forward() has to agree with the projection, or thrust flies you somewhere
// other than where you are pointing -- which is unplayable and silent.
// The past-vertical cases matter now that elevation wraps: 1.6 and 2.1 rad are
// beyond the old 1.32 clamp, and 3.0 is nearly inverted. They pass because
// toView/forward/project are general trigonometry -- the clamp was policy, not
// arithmetic -- and this is what keeps that true.
for (const [yaw, pitch] of [[0, 0], [1.2, 0], [-2.4, 0.5], [0.7, -0.9], [0, 1.6], [1.1, 2.1], [-0.6, 3.0], [2.0, -2.4]]) {
  const f = forward(cam({ yaw, pitch }));
  near(Math.hypot(f.x, f.y, f.z), 1, 1e-9, `forward(${yaw},${pitch}) must be a unit vector`);
  const ahead = project(cam({ yaw, pitch }), f.x * 900, f.y * 900, f.z * 900);
  check(ahead.visible, `flying at yaw ${yaw} pitch ${pitch} must move toward what is on the nose`);
  near(ahead.sx, 390, 0.02, `the point you are flying at must sit on the reticle (yaw ${yaw})`);
  near(ahead.sy, 190, 0.02, `the point you are flying at must sit on the reticle (pitch ${pitch})`);
}

// ---- BEHIND YOU -----------------------------------------------------------
// The bug this guards: dividing by a negative depth mirrors a contact back
// onto the screen, so something on your tail is drawn as a ghost ahead of you.
const behind = project(cam(), 0, 0, -700);
check(behind.visible === false, 'a contact behind you must never be drawn');
check(behind.depth < 0, 'depth must be signed so callers can tell behind from ahead');
const behindView = toView(cam(), 0, 0, -700);
check(behindView.z < 0, 'view-space z must be negative for a contact behind you');
check(rangeTo(behindView) > 0, 'range must stay positive for a contact behind you');
// Turning 180 degrees must bring it round to the nose.
const aboutFace = project(cam({ yaw: Math.PI }), 0, 0, -700);
check(aboutFace.visible === true, 'turning around must bring a contact behind you into view');
near(aboutFace.sx, 390, 0.001, 'a contact you have turned to face must sit on the reticle');

// ---- the radar ------------------------------------------------------------
near(bearing(toView(cam(), 0, 0, 900)), 0, 1e-9, 'dead ahead must plot at bearing 0');
near(Math.abs(bearing(toView(cam(), 0, 0, -900))), Math.PI, 1e-9, 'directly behind must plot at +/-PI');
near(bearing(toView(cam(), 900, 0, 0)), Math.PI / 2, 1e-9, 'directly to starboard must plot at +PI/2');
near(bearing(toView(cam(), -900, 0, 0)), -Math.PI / 2, 1e-9, 'directly to port must plot at -PI/2');
// The radar must read relative to the NOSE, not to the world, or it points at
// a fixed direction in space and is useless the moment you turn.
near(bearing(toView(cam({ yaw: Math.PI / 2 }), 900, 0, 0)), 0, 1e-9, 'the radar must be relative to your heading');

// ---- roll -----------------------------------------------------------------
const rolled = project(cam({ roll: Math.PI / 2 }), 100, 0, 500);
near(rolled.sx, 390, 0.001, 'a quarter roll must take a point on the horizontal to the vertical');
near(rolled.sy, 190 + 100 * (430 / 500), 0.001, 'a quarter roll must take a point on the horizontal to the vertical');
const radius = (p) => Math.hypot(p.sx - 390, p.sy - 190);
near(radius(project(cam({ roll: 0.9 }), 130, -70, 640)), radius(project(cam(), 130, -70, 640)), 0.001,
  'roll must rotate the frame, not scale it');

// ---- angle wrapping -------------------------------------------------------
for (const [input, expected] of [[0, 0], [Math.PI * 3, Math.PI], [-Math.PI * 3, -Math.PI], [7, 7 - Math.PI * 2]]) {
  near(wrapAngle(input), expected, 1e-9, `wrapAngle(${input})`);
}
check(Math.abs(wrapAngle(1000)) <= Math.PI + 1e-9, 'wrapAngle must terminate and bound any input');

// ---- depth fog and draw order --------------------------------------------
check(depthAlpha(FAR_PLANE) <= 0.001, 'the far plane must be fully faded');
check(depthAlpha(NEAR_PLANE + 40) > 0.8, 'a contact in your face must be solid');
check(depthAlpha(2000) < depthAlpha(400), 'further must be fainter');
const sorted = sortByDepth([{ depth: 100 }, { depth: 900 }, { depth: 400 }]);
check(sorted[0].depth === 900 && sorted[2].depth === 100, 'draw order must be far-to-near');
check(onScreen(cam(), project(cam(), -30000, 0, 500), 40) === false, 'a contact far off the side is not on screen');
check(onScreen(cam(), centre, 40) === true, 'a contact dead ahead is on screen');

// ---- the segment's rules --------------------------------------------------
const codeOfSource = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const game = readFileSync('src/game/space3d/Space3DGame.ts', 'utf8');
const leg = readFileSync('src/game/space3d/SpaceLane.ts', 'utf8');
const cockpit = readFileSync('src/game/space3d/Cockpit.ts', 'utf8');
const main = readFileSync('src/main.ts', 'utf8');
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));

check(Object.keys(pkg.dependencies ?? {}).length === 0, 'the transit must not add a runtime dependency');
check(!/three|babylon|@react-three/i.test(JSON.stringify(pkg)), 'no 3D engine: this is a rotation and a divide over the sprites that already ship');

// Every sprite it names must already exist in the manifest.
const manifest = JSON.parse(readFileSync('public/assets/manifest.json', 'utf8'));
const enemyKeys = [...leg.matchAll(/enemyKey: '([a-z_]+)'/g)].map((m) => m[1]);
const escortKey = leg.match(/escortKey: '([a-z_]+)'/)?.[1];
const bossKey = leg.match(/spriteKey: '([a-z_0-9]+)'/)?.[1];
const backdrop = leg.match(/backdrop: '([a-z_]+)'/)?.[1];
for (const key of new Set([...enemyKeys, escortKey])) {
  check(Boolean(manifest.enemies?.[key]), `the leg flies enemies.${key}, which is not in the manifest`);
}
check(Boolean(manifest.bosses?.[bossKey]), `the leg boss is bosses.${bossKey}, which is not in the manifest`);
check(Boolean(manifest.backgrounds?.[backdrop]), `the leg backdrop is backgrounds.${backdrop}, which is not in the manifest`);
check(enemyKeys.length >= 8, `a leg of ${enemyKeys.length} squadrons is too short for a whole level`);

// The fog curve is tied to the far plane; retuning one without the other
// silently kills the depth cue. Sample across the whole range, not two points.
{
  const samples = [200, 1200, 3000, 6000, 9000].map((d) => depthAlpha(d));
  for (let i = 1; i < samples.length; i += 1) {
    check(samples[i] < samples[i - 1], `depth fog must keep falling: it flattens by ${[200,1200,3000,6000,9000][i]} units`);
  }
  check(samples[0] > 0.85, 'a contact right in front of you must be solid');
  check(samples[samples.length - 1] < 0.35, 'a contact at the edge of the field must be faint');
}

// ---- the canopy -----------------------------------------------------------
const cockpitEntry = manifest.ui?.regulatory_warship_cockpit;
check(Boolean(cockpitEntry), 'the cockpit overlay must be in the manifest');
check(
  typeof cockpitEntry?.src === 'string' && cockpitEntry.src.endsWith('.webp'),
  'the runtime cockpit must be the optimized WebP, not the multi-megabyte source PNG',
);
const drawFrameBody = cockpit.slice(cockpit.indexOf('drawFrame(frame: CockpitFrame)'), cockpit.indexOf('drawInstruments('));
check(
  /getImage\('ui', 'regulatory_warship_cockpit'\)/.test(drawFrameBody),
  'the canopy must draw the manifest overlay',
);
// Portrait draws only the console band, which needs a source rect -- so the
// nine-argument drawImage is load-bearing, not incidental.
check(
  /drawImage\(\s*image,\s*\n?\s*source\.x, source\.y, source\.w, source\.h/.test(drawFrameBody),
  'the canopy must honour the frame source rect, or portrait draws the whole sheet',
);
check(/mode: 'console'/.test(cockpit) && /mode: 'canopy'/.test(cockpit),
  'the canopy needs a portrait mode: a 1.78 frame cannot cover a 0.49 screen');
// The canopy is composited over the flight. Drawn first, it would be painted
// over by the scene and the aperture would mean nothing.
const renderBody = game.slice(game.indexOf('private render('));
const frameAt = renderBody.indexOf('cockpit.drawFrame');
const sceneAt = renderBody.indexOf('sortByDepth(drawables)');
check(sceneAt >= 0 && frameAt > sceneAt, 'the canopy must be drawn AFTER the scene: it is a frame you look through');
// The view has to be centred on the aperture, not the viewport, or the console
// eats the bottom of the fight.
check(/camera\.cx = frame\.cx/.test(game) && /camera\.cy = frame\.cy/.test(game),
  'the vanishing point must sit at the canopy aperture, not the middle of the screen');
// Instruments are code, not paint.
// drawThreatDish and drawMainScreen are gone on purpose. The console is
// cropped above the corner dishes so a landscape screen gets ~58% sky instead
// of ~29%, and the radar moved onto the big centre screen -- where it also
// absorbed the elevation readout as up/down arrows, so a separate dish would
// now be saying the same thing twice in less space.
for (const [name, needle] of [['radar', 'drawRadar'], ['hull', 'drawHullScreen'], ['target', 'drawTargetScreen']]) {
  check(new RegExp(`private ${needle}\\(`).test(cockpit), `the ${name} instrument is not drawn in code`);
  check(new RegExp(`this\\.${needle}\\(`).test(cockpit), `${needle} is defined but never called`);
}
check(/contact\.bearing/.test(cockpit) && /contact\.range/.test(cockpit), 'the radar must plot real bearings and ranges');
check(/contact\.elevation/.test(cockpit), 'the radar must show which contacts are above and below');
// The radar has to be on the big screen, not a corner dish: at 38px it could
// show that something existed but never where.
check(/this\.drawRadar\(px\(ART\.mainScreen/.test(cockpit), 'the radar belongs on the main screen');
// The crop is the whole point, so check the VALUE, not just that the constant
// exists. Uncropped, a landscape screen drops from ~57% sky back to ~40%.
{
  const bottom = Number(cockpit.match(/const CONSOLE_BOTTOM = ([\d.]+);/)?.[1]);
  const top = Number(cockpit.match(/const CONSOLE_TOP = ([\d.]+);/)?.[1]);
  check(bottom > 0 && bottom <= 0.9, `the console must be cropped above the corner dishes (CONSOLE_BOTTOM=${bottom})`);
  check(bottom - top < 0.35, 'the console band is too deep: landscape needs the sky more than it needs bezel');
  // The band is anchored by its CROPPED edge; anchoring the full art height
  // left the missing slice as a gap and the console floated mid-screen.
  // Anchored by the CROPPED edge, whatever that fraction is called. Pinning
  // the constant's name broke the moment the crop became orientation-
  // dependent, while the behaviour it guards was still correct.
  check(/const artY = h - CONSOLE_LIFT - bottom \* artH;/.test(cockpit),
    'the band must be anchored by its cropped edge, or it floats with sky beneath it');
  check(!/const artY = h - artH - CONSOLE_LIFT;/.test(cockpit),
    'anchoring the full art height leaves the cropped slice as a gap under the console');
}
check(/state\.contacts/.test(cockpit), 'the radar must read live contacts, not a canned animation');

// ---- open space, not a lane ----------------------------------------------
for (const pattern of ['joust', 'orbit', 'tail', 'stand_off']) {
  check(new RegExp(`case '${pattern}'`).test(game), `engage pattern '${pattern}' is declared but never flown`);
}
check(/private desiredPosition\(/.test(game), 'enemies must fly to a position, not run down a rail');
// Squadrons must be able to arrive from ANY bearing, or the radar and the
// turning are both decorative.
check(/Math\.random\(\) \* Math\.PI \* 2/.test(game.slice(game.indexOf('private scramble('))),
  'squadrons must be scrambled on a random bearing all the way around');
check(!/lane grid|drawLaneGrid/.test(game), 'there is no floor in open space: the lane grid must be gone');
// ---- the nose is free, and the world says which way is up -----------------
//
// This used to be `check(/PITCH_LIMIT/.test(game), 'elevation must be
// clamped, ...')`. Two things were wrong with it.
//
// It asserted the REMEDY instead of the rule. The rule is "never invert the
// world with nothing to tell you it happened"; clamping to 76 degrees was one
// way to obey it, and the way a phone test found by flying into the wall. An
// instrument obeys it too, and lets the ship loop.
//
// And it was satisfied by a COMMENT. Deleting the constant while leaving a
// sentence explaining the deletion kept the gate green, because the grep only
// ever wanted the letters. That is the fifth check in this repository to match
// prose instead of code, so everything below reads comment-stripped source.
{
  const code = game.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const cockpitCode = cockpit.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  check(
    /this\.camera\.pitch = wrapAngle\(this\.camera\.pitch \+ this\.pitchRate \* dt\)/.test(code),
    'elevation must WRAP, so the ship can complete a loop instead of stopping at a wall',
  );
  check(
    !/PITCH_LIMIT/.test(code),
    'a pitch clamp is back in the code -- the nose has to come all the way round',
  );

  // The freedom is only allowed BECAUSE the instrument exists. If the horizon
  // ever goes, the clamp has to come back, and this is what says so.
  check(/private drawAttitude\(/.test(cockpitCode), 'unclamped pitch requires an attitude indicator');
  check(/this\.drawAttitude\(frame, state\)/.test(cockpitCode), 'the attitude indicator must actually be drawn');
  // Pinned to the ROTATION, not to the identifier. `/state\.roll/` matched
  // `state.rollReady` -- an unrelated field two functions away -- so removing
  // the bank from the horizon left the gate green. Same shape as the
  // `rollClock` / `lock` collision this repo has already been bitten by once.
  check(
    /ctx\.rotate\(-state\.roll\)/.test(cockpitCode),
    'the horizon must counter-rotate by the ship\'s roll, or it does not stay level with the world',
  );
  check(
    /Math\.sin\(state\.pitch\)/.test(cockpitCode),
    'the horizon must slide with the ship\'s live pitch, or it is decoration',
  );
  check(
    /pitch: this\.camera\.pitch/.test(code) && /roll: this\.camera\.roll/.test(code),
    'cockpitState must feed the horizon the real camera attitude',
  );
  // Drawn from the aperture, which both layouts supply. Keying it to the
  // artwork rect would put it on the panel in canopy and nowhere in console.
  check(
    /drawAttitude\(frame: CockpitFrame/.test(cockpitCode) && /const \{ aperture \} = frame/.test(cockpitCode),
    'the horizon must be placed from frame.aperture, so it exists in BOTH cockpit layouts',
  );
  check(
    /Math\.cos\(state\.pitch\) < 0/.test(cockpitCode),
    'the horizon must show inversion as a distinct state -- that is the whole reason the clamp could go',
  );
}
check(/private drawOffscreenCues\(/.test(game) && /this\.drawOffscreenCues\(/.test(game),
  'threats off the glass need a direction cue, or a tail is invisible until the hull runs out');

// Steering is a rate, not a position: a position-mapped drag runs out of
// screen and can never bring you all the way around.
check(/TURN_RATE/.test(game) && /yawRate/.test(game) && /pitchRate/.test(game), 'steering must set a turn rate');
check(/this\.camera\.yaw = wrapAngle\(/.test(game), 'heading must wrap rather than grow without bound');

// ---- which way the stick points the nose --------------------------------
//
// An inverted pitch axis shipped to a phone because this half of the chain was
// never pinned. `scripts/validate-tilt.mjs` proves the sensor produces a
// positive `y` when the top of the phone dips away; nothing proved that a
// positive `y` then lowers the nose, so a correct sensor and a correct flight
// model could still add up to a ship that climbed when the player pushed.
//
// Both halves are asserted here, because the conclusion needs both and each is
// individually plausible when wrong.
{
  const gameCode = game.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  // 1. Sign convention of the camera itself, measured rather than assumed:
  //    world +y draws BELOW the centre, so a nose that is up has a forward
  //    vector with a negative y.
  check(project(cam({}), 0, 400, 900).sy > base.cy, 'world +y must draw below the centre of the glass');
  check(forward(cam({ pitch: 0.4 })).y < -0.01, 'a POSITIVE camera pitch must point the nose UP');
  check(forward(cam({ pitch: -0.4 })).y > 0.01, 'a NEGATIVE camera pitch must point the nose DOWN');
  check(forward(cam({ yaw: 0.4 })).x > 0.01, 'a POSITIVE camera yaw must turn RIGHT');

  // 2. The integrator must therefore NEGATE the stick on pitch and pass it
  //    through on yaw, which is what makes stick y+ = nose down and x+ = right.
  check(
    /this\.pitchRate \+= \(-stickY \* TURN_RATE - this\.pitchRate\)/.test(gameCode),
    'pitch must negate the stick: stick y+ (top of the phone dipped away, or a drag downward) is NOSE DOWN',
  );
  check(
    /this\.yawRate \+= \(stickX \* TURN_RATE - this\.yawRate\)/.test(gameCode),
    'yaw must pass the stick straight through: stick x+ (right edge dipped, or a drag right) is TURN RIGHT',
  );

  // 3. And the drag fallback has to agree with the tilt, or the level flies
  //    one way on a phone and the other way on a desktop.
  check(
    /this\.stickY = clamp\(dy \/ travel, -1, 1\)/.test(gameCode),
    'the drag fallback must not invert either: dragging DOWN the glass is nose down, same as the tilt',
  );
}
// Firing used to have to be AUTOMATIC, on the reasoning that a fire button
// costs the thumb flying the ship. That was right until tilt started flying
// it. The thumb is free now, so the trigger is the point -- and the rule that
// replaces it is the one that keeps the old reasoning true: a weapon touch
// must never become the steering pointer.
check(/private fireGuns\(/.test(game), 'the guns must be on a held trigger');
check(/private get gunsHeld\(/.test(game), 'held-fire needs a single definition of "the trigger is down"');
check(!/private autoFire\(/.test(game), 'auto-fire must be gone: shooting is a decision now');

// ---- a weapon touch must never steer ------------------------------------
const down = game.slice(game.indexOf("addEventListener('pointerdown'"), game.indexOf("addEventListener('pointermove'"));
check(/const button = this\.buttonAt\(/.test(down), 'pointerdown must test the buttons before claiming the pointer for steering');
check(
  down.indexOf('this.buttonAt(') < down.indexOf('this.pointerId = event.pointerId'),
  'the button test must come BEFORE the steering pointer is claimed, or holding a button disables tilt',
);
check(/this\.weaponPointers\.set\(event\.pointerId, button\);[\s\S]{0,200}?return;/.test(down),
  'a pointer that hits a button must be claimed by the weapon and go no further');
const move = game.slice(game.indexOf("addEventListener('pointermove'"), game.indexOf('const release ='));
check(/if \(this\.weaponPointers\.has\(event\.pointerId\)\) return;/.test(move),
  'a finger sliding on a button must not steer');
check(/this\.tilt\.ready && this\.pointerId === null/.test(game),
  'tilt must yield only to the STEERING pointer, never to a weapon touch');
// setPointerCapture throws when the pointer is already gone -- a real race on
// a fast tap. Called before the state is recorded it would drop the press.
check(/private tryCapture\(/.test(game), 'pointer capture must be best-effort, not able to abort the handler');
// The one legitimate call lives inside tryCapture; anywhere else it can abort
// a handler mid-way and lose the press.
const outsideTryCapture = game.replace(/private tryCapture\([\s\S]*?\n  \}/, '');
check(!/setPointerCapture\(/.test(outsideTryCapture), 'capture must go through tryCapture so a throw cannot lose the press');
check(
  down.indexOf('this.weaponPointers.set(') < down.indexOf('this.tryCapture('),
  'the weapon press must be recorded BEFORE capture is attempted',
);

// Draw geometry and hit rect must come from one place, or the button you can
// see stops being the button you can press after any layout change.
check(/buttons\(frame: CockpitFrame\): CockpitButton\[\]/.test(cockpit), 'button geometry needs a single definition');
check(/this\.buttons\(frame\)/.test(cockpit), 'the painter must use the shared button geometry');
check(/this\.cockpit\.buttons\(this\.cockpit\.layout\(/.test(game), 'the hit test must use the shared button geometry');
// Buttons branch on whether the band is OVERSCANNED, not on the layout mode:
// both orientations render the console band now, so branching on mode sent
// landscape down the portrait path and parked its buttons at the screen edge.
check(/frame\.overscanned/.test(cockpit.slice(cockpit.indexOf('buttons(frame: CockpitFrame)'), cockpit.indexOf('drawButtons('))),
  'portrait must place buttons at thumb-safe positions, and landscape on the artwork shoulders');

// ---- the missile is a decision, not a spam button ------------------------
check(/MISSILE_CHARGE_SECONDS/.test(game), 'the missile must charge');
check(/if \(this\.missileCharge < 1\)/.test(game), 'an uncharged missile must refuse to fire');
check(/MISSILE_TURN_RATE/.test(game), 'the seeker must have a bounded turn rate so it can be out-flown');
// Scoped to CODE, not prose. This grepped the whole file, which meant a
// comment explaining that the rule deliberately does not exist read as the
// rule existing -- the assertion fired on documentation of its own intent.
// Stripping comments first makes it test the behaviour it is actually about:
// a seeker beaten by geometry, never by an animation having played.
const codeOnly = game.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
check(codeOnly.length > game.length * 0.5, 'comment stripping ate the file — the scraper is broken');
check(!/barrel roll.{0,40}lock/i.test(codeOnly), 'a roll must not defeat a seeker by animation');
// Precise, because a substring search cannot work here: "rollClock" itself
// contains the letters "lock", so any proximity grep around it matches itself.
// Assert the actual thing instead -- the roll gesture never writes the lock.
const rollBody = game.split('private startRoll(): void {')[1]?.split('\n  }\n')[0] ?? '';
check(rollBody.includes('rollClock'), 'could not find startRoll — the scraper is broken');
check(!/lockId|lockProgress/.test(rollBody), 'starting a roll must not clear or grant the lock');

// ---- the rescale: space has to be big enough to see something coming -----
{
  const cruise = Number(game.match(/const CRUISE = (\d+);/)?.[1]);
  const despawn = Number(game.match(/const DESPAWN_RANGE = (\d+);/)?.[1]);
  const throttle = 0.72;
  const rows = [...leg.matchAll(/speed: (\d+), standoff: (\d+),[\s\S]{0,80}?entryRange: (\d+)/g)]
    .map((m) => ({ speed: +m[1], standoff: +m[2], entry: +m[3] }));
  check(rows.length >= 8, 'could not read the squadron table');
  const approaches = rows.map((r) => (r.entry - r.standoff) / (cruise * throttle + r.speed));
  const shortest = Math.min(...approaches);
  // The complaint this fixes: "everything's moving too fast you can't ever
  // find any enemies... they don't disappear out of nowhere and fly by".
  check(shortest > 12, `a squadron closes in ${shortest.toFixed(1)}s — too fast to see anything coming`);
  check(Math.max(...approaches) < 90, 'approaches this long are dead air, not tension');
  check(despawn > Math.max(...rows.map((r) => r.entry)) * 1.3,
    'contacts must not evaporate shortly after spawning');
  for (const r of rows) {
    check(r.entry < FAR_PLANE, `a squadron enters at ${r.entry}, beyond the far plane — it would spawn invisible`);
  }
}

// A contact at spawn range projects to a few pixels, so the bracket is the
// only thing making it findable. It must never shrink away.
check(/const BRACKET_MIN_PIXELS = (\d+)/.test(game), 'target brackets need a size floor');
check(Number(game.match(/const BRACKET_MIN_PIXELS = (\d+)/)?.[1]) >= 14, 'the bracket floor is too small to find');
check(/private drawTargetBracket\(/.test(game) && /this\.drawTargetBracket\(/.test(game),
  'the bracket must be defined and drawn');
check(!/p\.depth < 1500/.test(game), 'brackets must not be gated to close range');

// ---- warp -----------------------------------------------------------------
check(/WARP_MULTIPLIER/.test(game) && /WARP_HEAT_PER_SECOND/.test(game), 'warp must exist and must heat');
check(/this\.warpLocked = true/.test(game), 'maxing the coil must lock warp out, or the limit can be feathered');
check(/WARP_RESET_HEAT/.test(game), 'a locked coil must need real cooling before it re-engages');
check(/'warp'/.test(cockpit), 'warp needs a console button');

// ---- shields are directional --------------------------------------------
check(/private takeHitFrom\(/.test(game), 'damage must know which side it came from');
check(/shieldAft/.test(game) && /shieldFore/.test(game), 'shields must be fore and aft');
check(!/this\.takeHit\(\);\s*\n\s*break;/.test(game), 'damage must route through the directional path');

// ---- the roll moved --------------------------------------------------
check(/DOUBLE_TAP_SECONDS/.test(game), 'the roll must be a double tap now that a single tap is ambiguous');
check(/Math\.abs\(dx\) > 6 \|\| Math\.abs\(dy\) > 6/.test(game), 'the stick must engage from where the finger went down');

// Fast bolts must be swept, not sampled, or they tunnel through everything.
check(/function segmentDistance\(/.test(game) && /segmentDistance\(from, to/.test(game),
  'bolt collision must test the segment covered this frame');

// ---- the boss is learnable ------------------------------------------------
check(/bossState === 'windUp'/.test(game), 'the boss guard must gate damage');
const attacks = [...leg.matchAll(/windUp: ([\d.]+), recovery: ([\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
check(attacks.length >= 3, 'a boss with fewer than three attacks has no pattern to learn');
for (const [windUp, recovery] of attacks) {
  check(windUp > recovery, `a recovery (${recovery}s) at least as long as its wind-up (${windUp}s) makes the guard worthless`);
}
const armoured = Number(game.match(/this\.bossHp -= armoured \? ([\d.]+) : ([\d.]+);/)?.[1]);
const exposed = Number(game.match(/this\.bossHp -= armoured \? ([\d.]+) : ([\d.]+);/)?.[2]);
check(armoured < 1 && exposed > 1, 'the guard must reduce damage and the opening must increase it');
const cycle = attacks.reduce((t, [w, r]) => t + w + r, 0);
const guardShare = attacks.reduce((t, [w]) => t + w, 0) / cycle;
const average = guardShare * armoured + (1 - guardShare) * exposed;
check(average < 1, `the guard is up ${Math.round(guardShare * 100)}% of the cycle but averages ${average.toFixed(2)}x damage — that is not armour`);

// Time to kill, computed rather than felt. The first pass gave the Guardian 46
// health and it died in nine seconds of holding the trigger -- the same
// mistake, in the same shape, as the top-down boss dying in three.
const shotInterval = Number(game.match(/const SHOT_INTERVAL = ([\d.]+);/)?.[1]);
const bossHp = Number(leg.match(/hp: (\d+),\n\s+\/\*\*[\s\S]*?size:|hp: (\d+),\s*\n\s*size:/)?.[1] ?? 0)
  || Number(leg.slice(leg.indexOf('boss: {')).match(/hp: (\d+)/)?.[1]);
check(shotInterval > 0, 'could not read the fire interval');
check(bossHp > 0, 'could not read the boss health');
// Two barrels per volley, every hit landing. "Perfect" now also means heat is
// MANAGED -- burst fire keeps the cadence at full rate, and a player who holds
// the trigger down forever is choosing a slower gun. So the ceiling is still
// the un-slowed rate; what changed is that reaching it is a skill.
const perfectDps = (2 / shotInterval) * average;
// And heat must stay a tax, not a wall: a gun that got dramatically slower
// would take the fight away at the moment it is most needed.
const slowdown = Number(game.match(/const HEAT_MAX_SLOWDOWN = ([\d.]+);/)?.[1]);
check(slowdown > 1 && slowdown <= 2.5, `heat slowdown of ${slowdown}x is either no penalty at all or a wall`);
const ttk = bossHp / perfectDps;
check(ttk >= 25, `the boss dies in ${ttk.toFixed(0)}s of PERFECT shooting — a level boss must outlast a held trigger`);
check(ttk <= 45, `the boss takes ${ttk.toFixed(0)}s of perfect shooting — past this it is a sponge, not a fight`);


// ---- the gun lead pipper --------------------------------------------------
//
// A crossing target at 1750 units/s of bolt speed is guesswork without a lead
// marker, and crossing shots are most of a dogfight. The solve is a quadratic,
// so it has the failure modes quadratics have -- no root, a negative root, a
// division by zero -- and each one has to produce "no marker" rather than a
// marker somewhere arbitrary.
{
  const SPEED = 1750;

  // A stationary target: the lead is the target itself, at range/speed.
  const still = interceptTime({ x: 0, y: 0, z: 3500 }, { x: 0, y: 0, z: 0 }, SPEED);
  near(still, 2, 1e-9, 'a stationary target intercepts at range/speed');

  // A crossing target: the lead must be AHEAD of it along its own travel, and
  // the intercept has to actually be an intercept -- both sides of
  // |d + v*t| = speed*t must agree.
  const delta = { x: 0, y: 0, z: 3500 };
  const vel = { x: 600, y: 0, z: 0 };
  const t = interceptTime(delta, vel, SPEED);
  check(t !== null && t > 0, 'a crossing target must have an intercept');
  const meet = { x: delta.x + vel.x * t, y: delta.y + vel.y * t, z: delta.z + vel.z * t };
  near(Math.hypot(meet.x, meet.y, meet.z), SPEED * t, 1e-6, 'the intercept point must satisfy |d+vt| = speed*t');
  check(meet.x > delta.x, 'the lead must be ahead of a right-crossing target, not behind it');

  // Faster than the bolt and running away: there is no intercept, and the
  // honest answer is no marker. A solver that returned the negative root here
  // would draw a pipper BEHIND the player.
  check(
    interceptTime({ x: 0, y: 0, z: 2000 }, { x: 0, y: 0, z: SPEED * 1.4 }, SPEED) === null,
    'a target outrunning the bolt must have no intercept',
  );

  // |v| exactly equal to bolt speed collapses the quadratic to a line, because
  // the t^2 coefficient is |v|^2 - speed^2 = 0 and 2a is a division by zero.
  //
  // The vector matters. A first version used v PERPENDICULAR to d, which also
  // makes b = 0 -- and with both coefficients zero the unguarded quadratic
  // happens to produce NaN, get filtered, and return null, which is the same
  // answer the guard gives. The test passed with the guard deleted: it could
  // not fail. A CLOSING target at exactly bolt speed separates them, because
  // there the correct answer is a real intercept and the unguarded path
  // returns none -- the pipper would silently vanish.
  const closingAtBoltSpeed = interceptTime({ x: 0, y: 0, z: 2000 }, { x: 0, y: 0, z: -SPEED }, SPEED);
  check(
    closingAtBoltSpeed !== null && Number.isFinite(closingAtBoltSpeed) && closingAtBoltSpeed > 0,
    `a target closing at exactly bolt speed must still have an intercept (got ${closingAtBoltSpeed})`,
  );
  near(closingAtBoltSpeed, 2000 / (2 * SPEED), 1e-9, 'the closing-at-bolt-speed intercept is range/(2*speed)');

  // ...and the doubly-degenerate case (a and b both zero) must answer null
  // rather than NaN.
  const bothZero = interceptTime({ x: 0, y: 0, z: 2000 }, { x: SPEED, y: 0, z: 0 }, SPEED);
  check(bothZero === null || Number.isFinite(bothZero), 'the |v| == speed case must never return NaN or Infinity');

  // Every root handed back is finite and strictly future, across a sweep.
  for (const vx of [-2400, -900, -300, 0, 300, 900, 2400]) {
    for (const range of [400, 1500, 6000]) {
      const value = interceptTime({ x: 0, y: 0, z: range }, { x: vx, y: 0, z: 0 }, SPEED);
      check(
        value === null || (Number.isFinite(value) && value > 0),
        `interceptTime returned ${value} for vx=${vx} range=${range} — must be null or a positive finite time`,
      );
    }
  }
}

// ---- ...and it is instrumentation, not auto-aim ---------------------------
//
// The pipper says where to put the nose. It must never move the nose. If the
// firing path ever read the lead, the gun would stop going where it points and
// the skill the pipper exists to reward would evaporate.
{
  const fire = game.split('private fireGuns(dt: number): void {')[1]?.split('\n  }\n')[0] ?? '';
  check(fire.includes('forward(this.camera)'), 'could not find fireGuns — the scraper is broken');
  check(!/leadPoint|lockTarget|lockId/.test(fire), 'fireGuns reads the lock or the lead: the guns must fire where the nose points');
  const bolt = game.split('private fireGuns(dt: number): void {')[1]?.split('sfx.play')[0] ?? '';
  check(/vx: dir\.x \* BOLT_SPEED/.test(bolt), 'bolts must leave along the camera forward vector');
}

// ---- the lock, and the missile that needs it ------------------------------
//
// The lock is what makes the missile a decision rather than a cooldown.
{
  check(/const LOCK_CONE = /.test(game), 'the lock needs an acquisition cone');
  const cone = Number(/const LOCK_CONE = ([\d.]+);/.exec(game)?.[1]);
  const hold = Number(/const LOCK_HOLD_CONE = ([\d.]+);/.exec(game)?.[1]);
  check(Number.isFinite(cone) && Number.isFinite(hold), 'both lock cones must exist');
  // Hysteresis. One cone for both would either strobe through a turn or make
  // it impossible to choose which of two contacts you meant.
  check(hold > cone, `the hold cone (${hold}) must be wider than the acquire cone (${cone}), or the lock strobes`);

  const missile = game.split('private fireMissile(): void {')[1]?.split('\n  }\n')[0] ?? '';
  check(missile.includes('missiles.push'), 'could not find fireMissile — the scraper is broken');
  check(
    /if \(this\.lockId === null\) \{[\s\S]*?return;/.test(missile),
    'the missile must refuse to fire without a lock',
  );
  check(
    missile.indexOf('lockId === null') < missile.indexOf('missiles.push'),
    'the lock is checked after the missile is already away',
  );
  check(/targetId: this\.lockId/.test(missile), 'a missile must carry the lock it was fired with');

  // ...and it must track THAT, not whatever drifts in front of it.
  const seek = game.split('private seekTarget(')[1]?.split('\n  }\n')[0] ?? '';
  check(seek.length > 0, 'could not find seekTarget — the scraper is broken');
  check(/missile\.targetId/.test(seek), 'a seeker must track the target it was locked onto');
  check(
    /cone < Math\.cos\(MISSILE_SEEK_CONE\)/.test(seek),
    'a seeker must still be losable by geometry, or it cannot be beaten by flying',
  );

  // The lock has to be able to go away, or it is not a lock.
  const lock = game.split('private updateLock(dt: number): void {')[1]?.split('\n  }\n')[0] ?? '';
  check(lock.length > 0, 'could not find updateLock — the scraper is broken');
  check(/this\.lockId = null/.test(lock), 'the lock must drop when the target leaves the hold cone');
  check(/clamp\(cos, -1, 1\)/.test(lock), 'acos must be clamped: drift past 1 is NaN and the lock would silently die');
}

// ---- the radar says which one is locked -----------------------------------
{
  const radar = cockpit.split('private drawRadar(')[1]?.split('\n  }\n')[0] ?? '';
  check(radar.includes('state.contacts'), 'could not find drawRadar — the scraper is broken');
  check(/contact\.locked/.test(radar), 'the radar must mark the locked contact');
}

// ---- music ----------------------------------------------------------------
const audio = JSON.parse(readFileSync('public/assets/audio/manifest.json', 'utf8'));
check(Boolean(audio.tracks?.transit), 'the transit needs its own track');
check(audio.cues?.transit === 'transit', 'the transit cue must map to the transit track');
check(Boolean(audio.tracks?.guardian_protocol), 'the transit boss needs its own track');
check(audio.cues?.transit_boss === 'guardian_protocol', 'the boss cue must map to Guardian Protocol');
check(/cueMusic\('transit'\)/.test(game), 'the transit must cue its music on entry');
check(/cueMusic\('transit_boss'\)/.test(game), 'the transit boss must cue its own track');
// Every cue the segment fires has to exist, or the music silently stops.
for (const match of game.matchAll(/cueMusic\('([a-z0-9_]+)'\)/g)) {
  check(match[1] in audio.cues, `the segment fires music cue "${match[1]}" but the audio manifest does not map it`);
}

// ---- it announces, it does not reach into the campaign --------------------
check(/coded:space-complete/.test(game) && /coded:space-defeat/.test(game), 'the segment must announce its outcome');
check(!/CampaignProgress|MissionDirector/.test(game), 'the segment must not wire itself into the campaign');
check(/params\.has\('space'\)/.test(main), 'the playtest route must be reachable');

// ---- the lean into a turn must stay a lean ---------------------------------
// Reported from a handset: "when you try to go left and right it rolls the ship
// instead of turning." The yaw was correct the whole time; a 16-degree scene
// rotation was simply louder than it on a phone-sized screen. The bank is a
// named constant now so it cannot drift back up unnoticed, and it must stay far
// enough below the deliberate barrel roll that the two never read as the same
// move.
const bankCode = codeOfSource(game);
const bankMatch = bankCode.match(/const TURN_BANK = ([\d.]+);/);
check(Boolean(bankMatch), 'the lean into a turn must be a named constant, not a literal buried in the update');
if (bankMatch) {
  const bank = Number(bankMatch[1]);
  check(bank > 0, 'a turn should still lean the ship; zero would be a flat turn');
  check(bank <= 0.12, `the lean must stay small enough that a turn reads as a turn, got ${bank} rad (${(bank * 180 / Math.PI).toFixed(0)} deg)`);
}
check(
  /const bank = clamp\(this\.yawRate \/ TURN_RATE, -1, 1\) \* TURN_BANK;/.test(bankCode),
  'the lean must be driven by the actual yaw rate through TURN_BANK',
);
check(
  /Math\.PI \* 2/.test(bankCode.split('const spin =')[1]?.split('\n')[0] ?? ''),
  'the deliberate barrel roll must stay a full turn, so it is never confused with the lean',
);

if (failures.length > 0) {
  console.error('space flight FAILED');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(
  `space-flight: OK — 360 flight verified (behind, turned, rolled, pitched), radar bearings exact, `
  + `${enemyKeys.length} squadrons + Guardian Protocol, guard averages ${average.toFixed(2)}x, canopy over the scene.`,
);
