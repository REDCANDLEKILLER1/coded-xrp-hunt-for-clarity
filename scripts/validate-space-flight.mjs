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
  bearing, rangeTo, wrapAngle, forward, NEAR_PLANE, FAR_PLANE,
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
for (const [yaw, pitch] of [[0, 0], [1.2, 0], [-2.4, 0.5], [0.7, -0.9]]) {
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
for (const [name, needle] of [['radar', 'drawRadar'], ['elevation dish', 'drawThreatDish'], ['hull', 'drawHullScreen'], ['nav', 'drawMainScreen']]) {
  check(new RegExp(`private ${needle}\\(`).test(cockpit), `the ${name} instrument is not drawn in code`);
  check(new RegExp(`this\\.${needle}\\(`).test(cockpit), `${needle} is defined but never called`);
}
check(/contact\.bearing/.test(cockpit) && /contact\.range/.test(cockpit), 'the radar must plot real bearings and ranges');
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
check(/PITCH_LIMIT/.test(game), 'elevation must be clamped, or pitching past vertical silently inverts the world');
check(/private drawOffscreenCues\(/.test(game) && /this\.drawOffscreenCues\(/.test(game),
  'threats off the glass need a direction cue, or a tail is invisible until the hull runs out');

// Steering is a rate, not a position: a position-mapped drag runs out of
// screen and can never bring you all the way around.
check(/TURN_RATE/.test(game) && /yawRate/.test(game) && /pitchRate/.test(game), 'steering must set a turn rate');
check(/this\.camera\.yaw = wrapAngle\(/.test(game), 'heading must wrap rather than grow without bound');
check(/private autoFire\(/.test(game), 'firing must be automatic: a fire button costs the thumb that is flying');
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

// ---- music ----------------------------------------------------------------
const audio = JSON.parse(readFileSync('public/assets/audio/manifest.json', 'utf8'));
check(Boolean(audio.tracks?.transit), 'the transit needs its own track');
check(audio.cues?.transit === 'transit', 'the transit cue must map to the transit track');
check(Boolean(audio.tracks?.guardian_protocol), 'the interdictor needs its own track');
check(audio.cues?.transit_boss === 'guardian_protocol', 'the boss cue must map to Guardian Protocol');
check(/cueMusic\('transit'\)/.test(game), 'the transit must cue its music on entry');
check(/cueMusic\('transit_boss'\)/.test(game), 'the interdictor must cue its own track');
// Every cue the segment fires has to exist, or the music silently stops.
for (const match of game.matchAll(/cueMusic\('([a-z0-9_]+)'\)/g)) {
  check(match[1] in audio.cues, `the segment fires music cue "${match[1]}" but the audio manifest does not map it`);
}

// ---- it announces, it does not reach into the campaign --------------------
check(/coded:space-complete/.test(game) && /coded:space-defeat/.test(game), 'the segment must announce its outcome');
check(!/CampaignProgress|MissionDirector/.test(game), 'the segment must not wire itself into the campaign');
check(/params\.has\('space'\)/.test(main), 'the playtest route must be reachable');

if (failures.length > 0) {
  console.error('space flight FAILED');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(
  `space-flight: OK — 360 flight verified (behind, turned, rolled, pitched), radar bearings exact, `
  + `${enemyKeys.length} squadrons + interdictor, guard averages ${average.toFixed(2)}x, canopy over the scene.`,
);
