import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

// Swept proximity collision (PR #122 salvage, piece 2, expanded): the player-hit
// detection now uses segmentWithinRange as a swept proximity check. Existing
// point checks keep working exactly as before; the swept stage only adds hits
// they miss via genuine tunneling between frames.
// The clamp is load-bearing: it ensures the swept stage can never extend the
// effective range of any combat rule (defect fixed: stationary missile/bolt at
// 118.27 units took damage). Heat, seeker arming, and all combat rules are
// preserved. (Expansion: the patch-2 warship hull check is subsumed -- any
// hull hit within the envelope is already a proximity hit.)

async function load(path) {
  const result = await build({entryPoints:[path],bundle:true,format:'esm',write:false,logLevel:'silent'});
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}
const w = await load('src/game/space3d/Warship.ts');

// ---- geometry: forgiving central ellipsoid, swept segments ----
assert.deepEqual(w.WARSHIP_HIT_RADII_METERS, { x: 8, y: 5, z: 30 }, 'hull radii must stay forgiving');
assert.ok(!('BATTERY_PAIRS' in w) && !('batteryShot' in w), 'no battery surface in the collision module');

const camera = {x:500,y:-120,z:900,yaw:0,pitch:0,roll:0,cx:195,cy:422,focal:470};
let attitudes = 0;
for (const yaw of [-Math.PI, -1, 0, 1, Math.PI]) {
  for (const pitch of [-Math.PI/2, -.7, 0, .7, Math.PI/2]) {
    for (const roll of [-1, 0, 1]) {
      const c = {...camera,yaw,pitch,roll};
      const center = w.nodePosition(c,'Ship_Origin');
      const point=(x,y,z)=>{const d=w.shipOffset(c,{x,y,z});return {x:center.x+d.x,y:center.y+d.y,z:center.z+d.z};};
      assert.ok(w.hitsWarship(c,point(0,0,-200),point(0,0,200)), 'fast segment must hit');
      assert.ok(!w.hitsWarship(c,point(25,0,-200),point(25,0,200)), 'outside narrow hull must miss');
      assert.ok(w.hitsWarship(c,point(25,0,-200),point(25,0,200),2), 'padding must expand hull');
      assert.ok(w.hitsWarship(c,center,center), 'stationary overlap must hit');
      assert.ok(!w.hitsWarship(c,point(0,16,0),point(0,16,0)), 'outside vertical hull must miss');
      // A segment that starts inside and leaves still intersects.
      assert.ok(w.hitsWarship(c,center,point(0,0,400)), 'departing segment must hit');
      attitudes++;
    }
  }
}

// ---- envelope clamp unit checks ----
{
  const c0 = {x:0,y:0,z:0,yaw:0,pitch:0,roll:0,cx:390,cy:190,focal:430};
  const at = (d) => ({x:0,y:0,z:d});
  assert.ok(!w.segmentWithinRange(c0, at(118.27), at(118.27), 60), 'stationary point outside range must not pass the clamp');
  assert.ok(w.segmentWithinRange(c0, at(59), at(59), 60), 'stationary point inside range must pass the clamp');
  assert.ok(w.segmentWithinRange(c0, at(70), at(-70), 60), 'segment crossing the threshold sphere must pass the clamp');
  assert.ok(!w.segmentWithinRange(c0, at(70), at(65), 60), 'segment staying outside range must not pass the clamp');
  assert.ok(w.segmentWithinRange(c0, at(46), at(46), 46), 'bolt threshold boundary must pass the clamp');
}

// ---- additive wiring: existing checks untouched, swept proximity stage ----
const src = readFileSync('src/game/space3d/Space3DGame.ts','utf8');
// Seeker arming preserved: the range check still gates, swept is a fallback.
assert.ok(src.includes('if (range > SEEKER_ARM_RANGE) {'), 'seeker arm-range check must remain');
assert.ok(/const SEEKER_ARM_RANGE = 60;/.test(src), 'SEEKER_ARM_RANGE must stay 60');
assert.ok(src.includes('segmentWithinRange(this.camera, from, missile, SEEKER_ARM_RANGE)'), 'seeker swept stage must be envelope-clamped');
// Bolt and contact proximity checks preserved.
assert.ok(src.includes('if (range > 46) {'), 'bolt proximity check must remain');
assert.ok(src.includes('segmentWithinRange(this.camera, from, bolt, 46)'), 'bolt swept stage must be envelope-clamped');
assert.ok(src.includes('if (range > contact.size * 0.5 + 44) {'), 'contact proximity check must remain');
assert.ok(src.includes('segmentWithinRange(this.camera, from, contact, contact.size * 0.5 + 44)'), 'contact swept stage must be envelope-clamped');
// lastStep feeds the swept segments.
assert.ok(src.includes('this.lastStep = dt;'), 'tick must record lastStep');
// Heat untouched by the collision piece.
assert.ok(/const HEAT_MAX_SLOWDOWN = 2\.1;/.test(src), 'heat constants must survive');
assert.ok(src.includes('private gunHeat = 0;'), 'gunHeat state must survive');
// No battery code smuggled in.
assert.ok(!src.includes('BATTERY_PAIRS') && !src.includes('batteryShot'), 'battery must not appear');

// ---- real collide() regression: the reported defect and its fix ----
// Drives the ACTUAL compiled Space3DGame.collide() headlessly (DOM shims for
// construction only). Geometry-only tests missed the defect because they never
// ran the integration path; these do.
{
  const fakeCtx = new Proxy({}, { get: () => () => undefined, set: () => true });
  const fakeCanvas = {
    setAttribute() {}, style: {}, addEventListener() {}, removeEventListener() {},
    getContext: () => fakeCtx,
  };
  globalThis.document = {
    createElement: () => fakeCanvas, addEventListener() {}, removeEventListener() {},
  };
  globalThis.window = { addEventListener() {}, removeEventListener() {}, dispatchEvent() {} };

  const game = await load('src/game/space3d/Space3DGame.ts');
  const PLAYER_HP = 8;
  const makeGame = () => {
    const g = new game.Space3DGame({ appendChild() {} });
    g.shieldFore = 0; g.shieldAft = 0; // takeHitFrom must reach hp
    g.graceClock = 0; g.lastStep = 1 / 60;
    g.bolts = []; g.contacts = []; g.missiles = [];
    return g;
  };
  const hostileMissile = (x, y, z, vx = 0, vy = 0, vz = 0) =>
    ({ x, y, z, vx, vy, vz, life: 1, targetId: 0, hostile: true, hp: 3, decoy: null });
  const hostileBolt = (x, y, z, vx = 0, vy = 0, vz = 0) =>
    ({ x, y, z, vx, vy, vz, hostile: true, size: 1, life: 1 });
  // Michael's reported placement: 118.27 units from the camera, inside the hull volume.
  const FAR = { x: 0, y: 39.64715334956429, z: -111.42664013276239 };

  let g = makeGame();
  g.missiles = [hostileMissile(FAR.x, FAR.y, FAR.z)];
  g.collide();
  assert.equal(g.missiles[0]?.life, 1, 'stationary missile @118.27 must not detonate');
  assert.equal(g.hp, PLAYER_HP, 'stationary missile @118.27 must deal no damage');

  g = makeGame();
  g.bolts = [hostileBolt(FAR.x, FAR.y, FAR.z)];
  g.collide();
  assert.equal(g.bolts[0]?.life, 1, 'stationary bolt @118.27 must not be destroyed');
  assert.equal(g.hp, PLAYER_HP, 'stationary bolt @118.27 must deal no damage');

  // Genuine tunneling: fast missile crosses between frames, both
  // endpoints outside 60, segment passes within 45.9 of the camera.
  // (Expansion: this now detonates via swept proximity, not hull contact.)
  g = makeGame();
  g.missiles = [hostileMissile(0, 45.9, -140, 0, 0, -12000)];
  g.collide();
  assert.notEqual(g.missiles[0]?.life, 1, 'tunneling missile must be caught by swept proximity');
  assert.ok(g.hp < PLAYER_HP, 'tunneling missile must deal damage');

  // Proximity tunneling without hull contact (the expansion bug fix):
  // fast bolt passes within 30 units of the camera but both endpoints are
  // outside 46. The old point check missed it; the swept stage catches it.
  g = makeGame();
  // Bolt at (0,30,-50) moving -z at 6000 u/s: from=(0,30,50), to=(0,30,-50).
  // Both endpoints at 58 units (outside 46); segment passes through
  // (0,30,0) at 30 units (inside 46). Must still connect.
  g.bolts = [hostileBolt(0, 30, -50, 0, 0, -6000)];
  g.collide();
  assert.notEqual(g.bolts[0]?.life, 1, 'tunneling bolt within proximity must be caught');
  assert.ok(g.hp < PLAYER_HP, 'tunneling bolt must deal damage');

  // Existing rules unchanged.
  g = makeGame();
  g.missiles = [hostileMissile(0, 0, 59)];
  g.collide();
  assert.notEqual(g.missiles[0]?.life, 1, 'missile inside SEEKER_ARM_RANGE must still detonate');
  assert.ok(g.hp < PLAYER_HP, 'missile inside SEEKER_ARM_RANGE must still damage');

  g = makeGame();
  g.bolts = [hostileBolt(0, 0, 45)];
  g.collide();
  assert.notEqual(g.bolts[0]?.life, 1, 'bolt inside 46 must still connect');
  assert.ok(g.hp < PLAYER_HP, 'bolt inside 46 must still damage');

  g = makeGame();
  g.missiles = [hostileMissile(0, 0, 61)];
  g.collide();
  assert.equal(g.missiles[0]?.life, 1, 'stationary missile @61 outside hull must not detonate');
  assert.equal(g.hp, PLAYER_HP, 'stationary missile @61 must deal no damage');
}

console.log(`warship-swept: OK — ${attitudes} attitudes, swept proximity stage (missile/bolt/contact), real-collide() regression green, arming + heat + combat rules preserved.`);
