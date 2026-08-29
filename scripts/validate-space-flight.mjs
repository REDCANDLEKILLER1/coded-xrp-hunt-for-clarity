// The space flight segment: the projection is real, and the lane is flyable.
//
// This is the part of the game with no reference frame to eyeball. A top-down
// sprite in the wrong place is obvious in a screenshot; a perspective divide
// that is subtly wrong just makes the lane feel bad, and "feels bad" is not
// something a screenshot catches. So the maths is exercised directly.
//
// The behavioural half runs Projection.ts in-process. The structural half
// holds the rules the segment was built under: it adds no dependency, it adds
// no art, and it does not reach into the campaign on its own.

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
const { project, screenSize, depthAlpha, sortByDepth, onScreen, NEAR_PLANE, FAR_PLANE } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`
);

const camera = { x: 0, y: 0, cx: 390, cy: 190, focal: 430, roll: 0 };

// ---- the divide -----------------------------------------------------------
const centre = project(camera, 0, 0, 500);
near(centre.sx, 390, 0.001, 'a point on the lane axis must project to the centre of the frame');
near(centre.sy, 190, 0.001, 'a point on the lane axis must project to the centre of the frame');

// Twice as far is half the size: this is the whole illusion, so it is pinned.
const nearSize = screenSize(camera, 100, 400);
const farSize = screenSize(camera, 100, 800);
near(farSize, nearSize / 2, 0.001, 'doubling the depth must halve the drawn size');

// A fixed world point must move OUT from the centre as it closes, never in.
let previous = 0;
let monotonic = true;
for (let z = FAR_PLANE; z > NEAR_PLANE + 10; z -= 60) {
  const p = project(camera, 200, 0, z);
  if (p.sx < previous) monotonic = false;
  previous = p.sx;
}
check(monotonic, 'an approaching contact must sweep outward from the vanishing point, not inward');

// ---- the near plane -------------------------------------------------------
// Without a near plane the divide runs to infinity and a sprite fills the
// screen for one frame before it is culled. That flash is the bug this guards.
for (const z of [NEAR_PLANE, NEAR_PLANE - 1, 0, -50]) {
  check(project(camera, 0, 0, z).visible === false, `depth ${z} is at or behind the near plane and must not be drawn`);
  check(screenSize(camera, 100, z) === 0, `depth ${z} must have no drawn size`);
}
check(project(camera, 0, 0, NEAR_PLANE + 1).visible === true, 'just in front of the near plane must still draw');
check(Number.isFinite(screenSize(camera, 100, NEAR_PLANE + 1)), 'size at the near plane must stay finite');

// ---- roll -----------------------------------------------------------------
const rolled = project({ ...camera, roll: Math.PI / 2 }, 100, 0, 500);
near(rolled.sx, 390, 0.001, 'a quarter roll must take a point on the horizontal to the vertical');
near(rolled.sy, 190 + 100 * (430 / 500), 0.001, 'a quarter roll must take a point on the horizontal to the vertical');
// Roll must not change how far from centre a point sits, only where.
const flat = project(camera, 130, -70, 640);
const spun = project({ ...camera, roll: 0.9 }, 130, -70, 640);
const radius = (p) => Math.hypot(p.sx - camera.cx, p.sy - camera.cy);
near(radius(spun), radius(flat), 0.001, 'roll must rotate the frame, not scale it');

// ---- depth fog ------------------------------------------------------------
check(depthAlpha(FAR_PLANE) <= 0.001, 'the far plane must be fully faded');
check(depthAlpha(NEAR_PLANE + 40) > 0.8, 'a contact in your face must be solid');
check(depthAlpha(600) < depthAlpha(200), 'further must be fainter');

// ---- painter's algorithm --------------------------------------------------
const sorted = sortByDepth([{ z: 100 }, { z: 900 }, { z: 400 }]);
check(
  sorted[0].z === 900 && sorted[1].z === 400 && sorted[2].z === 100,
  'draw order must be far-to-near or a distant fighter paints over the boss',
);
check(sortByDepth([{ z: 1 }]).length === 1, 'sortByDepth must not drop items');

// ---- culling keeps flankers alive ----------------------------------------
const offLeft = project(camera, -3000, 0, 500);
check(onScreen(camera, offLeft, 40) === false, 'a contact far off the side is not on screen');
check(onScreen(camera, centre, 40) === true, 'a contact dead ahead is on screen');

// ---- the segment's rules --------------------------------------------------
const game = readFileSync('src/game/space3d/Space3DGame.ts', 'utf8');
const lane = readFileSync('src/game/space3d/SpaceLane.ts', 'utf8');
const main = readFileSync('src/main.ts', 'utf8');
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));

check(Object.keys(pkg.dependencies ?? {}).length === 0, 'the space segment must not add a runtime dependency');
check(
  !/three|babylon|@react-three/i.test(JSON.stringify(pkg)),
  'no 3D engine: this segment is a perspective divide over the sprites that already ship',
);

// Every sprite it names must already exist in the manifest. The segment was
// built on the promise that it needs no new art; this is that promise, checked.
const manifest = JSON.parse(readFileSync('public/assets/manifest.json', 'utf8'));
const laneKeys = [...lane.matchAll(/enemyKey: '([a-z_]+)'/g)].map((m) => m[1]);
const escortKey = lane.match(/escortKey: '([a-z_]+)'/)?.[1];
const bossKey = lane.match(/spriteKey: '([a-z_0-9]+)'/)?.[1];
const backdrop = lane.match(/backdrop: '([a-z_]+)'/)?.[1];
for (const key of new Set([...laneKeys, escortKey])) {
  check(Boolean(manifest.enemies?.[key]), `lane flies enemies.${key}, which is not in the manifest`);
}
check(Boolean(manifest.bosses?.[bossKey]), `lane boss is bosses.${bossKey}, which is not in the manifest`);
check(Boolean(manifest.backgrounds?.[backdrop]), `lane backdrop is backgrounds.${backdrop}, which is not in the manifest`);
check(laneKeys.length >= 8, `a lane of ${laneKeys.length} waves is too short to teach anything`);

// Enemy behaviour: four distinct routines, each actually implemented.
for (const pattern of ['straight', 'weave', 'chase', 'flank']) {
  check(new RegExp(`case '${pattern}':`).test(game), `flight pattern '${pattern}' is declared but never flown`);
}

// The boss is learnable: fixed order, telegraphed, and soft only on recovery.
check(/bossState === 'windUp'/.test(game), 'the boss guard must gate damage');
const attacks = [...lane.matchAll(/windUp: ([\d.]+), recovery: ([\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
check(attacks.length >= 3, 'a boss with fewer than three attacks has no pattern to learn');
for (const [windUp, recovery] of attacks) {
  check(windUp > recovery, `a recovery (${recovery}s) at least as long as its wind-up (${windUp}s) makes the guard worthless`);
}
// The armour has to actually be armour on average, which is the mistake the
// top-down boss made first: guard multipliers that worked out FASTER to kill.
const armoured = Number(game.match(/this\.bossHp -= armoured \? ([\d.]+) : ([\d.]+);/)?.[1]);
const exposed = Number(game.match(/this\.bossHp -= armoured \? ([\d.]+) : ([\d.]+);/)?.[2]);
check(armoured < 1 && exposed > 1, 'the guard must reduce damage and the opening must increase it');
const cycle = attacks.reduce((total, [w, r]) => total + w + r, 0);
const guardShare = attacks.reduce((total, [w]) => total + w, 0) / cycle;
const average = guardShare * armoured + (1 - guardShare) * exposed;
check(average < 1, `the guard is up ${Math.round(guardShare * 100)}% of the cycle but averages ${average.toFixed(2)}x damage — that is not armour`);

// Touch: one gesture flies it, and there is no fire button to steal the thumb.
check(/pointerdown/.test(game) && /pointermove/.test(game), 'the segment must be flyable by drag');
check(/private autoFire\(/.test(game), 'firing must be automatic: a fire button costs the thumb that is flying');
check(
  /Math\.abs\(dx\) > 6 \|\| Math\.abs\(dy\) > 6/.test(game),
  'the drag must move relative to where the finger went down, not jump the ship to it',
);
check(/startRoll\(\)/.test(game), 'the roll is the only defensive move and must exist');

// It announces rather than reaching into the campaign.
check(/coded:space-complete/.test(game) && /coded:space-defeat/.test(game), 'the segment must announce its outcome');
check(
  !/CampaignProgress|MissionDirector/.test(game),
  'the segment must not wire itself into the campaign: that is a separate, reviewable change',
);
check(/params\.has\('space'\)/.test(main), 'the playtest route must be reachable');

// The hull is drawn where it is hit, and both come from the same place.
check(/private shipWorldY\(\)/.test(game), 'the hull needs one world position shared by drawing and collision');
check(!/this\.shipY\b(?!.*shipDrop)/.test(game.split('shipWorldY()')[1] ?? ''), 'collisions must use shipWorldY(), not the raw aim position');

if (failures.length > 0) {
  console.error('space flight FAILED');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(
  `space-flight: OK — perspective verified at the near plane and under roll, `
  + `${laneKeys.length} waves + boss, guard averages ${average.toFixed(2)}x, drag-only controls, no new deps or art.`,
);
