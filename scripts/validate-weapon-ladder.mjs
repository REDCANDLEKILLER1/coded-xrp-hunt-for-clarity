// Nine rungs that are actually a ladder.
//
// The old five-rung ladder was one gun that grew. Every rung fired `bb_shot`
// except the last, pierce was the only new mechanic in it, and CLARITY LANCE
// at the top was measurably a DOWNGRADE -- 11.5 dps against QUAD's 33.3 at
// zero barrels -- granted automatically at rank 12 with no way to decline.
//
// Everything here is measured through the SHIPPED `currentVolley()`, driven on
// a real Game2A. This file does not re-implement the barrel rule: the previous
// generation of this check did, and could therefore not see a change to the
// real one at all.

import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };

const store = new Map();
globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => void store.set(k, String(v)), removeItem: (k) => void store.delete(k) };
const noopCtx = new Proxy({}, { get: (t, k) => (k in t ? t[k] : k === 'measureText' ? () => ({ width: 10 })
  : k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {}),
  set: (t, k, v) => { t[k] = v; return true; } });
const stubCanvas = () => ({ width: 0, height: 0, style: {}, getContext: () => noopCtx, addEventListener() {}, removeEventListener() {},
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 393, height: 793 }), setPointerCapture() {}, releasePointerCapture() {} });
globalThis.CustomEvent = class { constructor(type, init) { this.type = type; this.detail = init?.detail; } };
globalThis.Image = class {};
globalThis.requestAnimationFrame = () => 0;
globalThis.performance = globalThis.performance ?? { now: () => 0 };
globalThis.matchMedia = () => ({ matches: false, addEventListener() {} });
globalThis.screen = { width: 393, height: 793, orientation: { angle: 0 } };
globalThis.devicePixelRatio = 1;
globalThis.document = { addEventListener() {}, removeEventListener() {}, querySelector: () => null, createElement: stubCanvas, body: { appendChild() {} } };
globalThis.innerWidth = 393;
globalThis.innerHeight = 793;
globalThis.window = { addEventListener() {}, removeEventListener() {}, dispatchEvent: () => true,
  setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout: (h) => clearTimeout(h),
  localStorage: globalThis.localStorage, devicePixelRatio: 1, innerWidth: 393, innerHeight: 793 };
globalThis.location = { search: '', pathname: '/' };

const load = async (entry) => {
  const b = await build({ entryPoints: [entry], bundle: true, format: 'esm', write: false, logLevel: 'silent' });
  return import(`data:text/javascript;base64,${Buffer.from(b.outputFiles[0].text).toString('base64')}`);
};
const { Game2A } = await load('src/game/core/Game2A.ts');
const { WEAPONS, PROJECTILES, ENEMIES } = await load('src/game/content/registry.ts');
const { EARTH_ENEMIES } = await load('src/game/content/EarthThreats.ts');

const gameSrc = readFileSync('src/game/core/Game2A.ts', 'utf8');
const code = gameSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const MAX_BARRELS = Number(/const MAX_BARRELS = (\d+);/.exec(code)?.[1]);
check(MAX_BARRELS > 0, 'MAX_BARRELS is missing');
const MAX_VOLLEY = Number(/const MAX_VOLLEY = (\d+)/.exec(code)?.[1]);
check(Number.isFinite(MAX_VOLLEY) && MAX_VOLLEY > 0, 'MAX_VOLLEY could not be read from the source -- never re-type it here');

const ladder = Object.values(WEAPONS).sort((a, b) => a.tier - b.tier);
check(ladder.length >= 9, `the ladder has ${ladder.length} rungs; the plan is nine`);
check(ladder.every((w, i) => w.tier === i + 1), `tiers are not 1..${ladder.length} in order`);

// CLARITY LANCE is retired. Naming it here so a future re-add has to argue.
check(!ladder.some((w) => w.label === 'CLARITY LANCE'),
  'CLARITY LANCE is back; it was a measured downgrade granted with no way to decline');

// ---- drive the real volley ----------------------------------------------
const g = new Game2A(stubCanvas());
g.deployTestMode();
g.reset();
const volleyOf = (tier, barrels) => {
  g.baseWeaponTier = tier;
  g.xpLevel = 1;
  g.barrels = barrels;
  return g.currentVolley();
};
check(volleyOf(1, 0).length > 0, 'the shipped currentVolley returned nothing -- this file would prove nothing');

// ---- effectiveness against ONE CENTRED target ---------------------------
//
// Centred and single on purpose. Pierce and splash are multi-target bonuses,
// so requiring the ladder to be monotone WITHOUT them means no rung is carried
// by a bonus a lone enemy never sees.
const narrowest = Math.min(...[...Object.values(ENEMIES), ...Object.values(EARTH_ENEMIES)].map((d) => d.hitbox.w));
check(narrowest > 0, 'could not read an enemy hitbox');
const centred = (weapon, barrels) => {
  const lanes = volleyOf(weapon.tier, barrels);
  const boltHalf = (PROJECTILES[weapon.projectileKey]?.hitbox.w ?? 5) / 2;
  const reach = narrowest / 2 + boltHalf;
  let damage = 0;
  for (const lane of lanes) {
    const off = Math.abs(lane.offsetX);
    if (off <= reach) damage += weapon.damage;
    else if (weapon.splash && off <= weapon.splash) damage += weapon.splashDamage ?? 0;
  }
  return damage / weapon.fireRate;
};

const barrelCounts = Array.from({ length: MAX_BARRELS + 1 }, (_, i) => i);
for (const barrels of barrelCounts) {
  for (let i = 1; i < ladder.length; i += 1) {
    const below = centred(ladder[i - 1], barrels);
    const above = centred(ladder[i], barrels);
    check(above > below,
      `at ${barrels} barrels ${ladder[i].label} (${above.toFixed(1)}) is not better than ${ladder[i - 1].label} (${below.toFixed(1)})`);
  }
}
// Stronger, and the reason the above holds: a rung at its WORST must beat the
// rung below at its BEST, so no barrel count can invert the order.
for (let i = 1; i < ladder.length; i += 1) {
  const belowBest = Math.max(...barrelCounts.map((b) => centred(ladder[i - 1], b)));
  const aboveWorst = Math.min(...barrelCounts.map((b) => centred(ladder[i], b)));
  check(aboveWorst > belowBest,
    `${ladder[i].label} at its worst (${aboveWorst.toFixed(1)}) does not beat ${ladder[i - 1].label} at its best (${belowBest.toFixed(1)})`);
}

// ---- every barrel buys a lane -------------------------------------------
for (const weapon of ladder) {
  for (const barrels of barrelCounts.slice(1)) {
    const before = volleyOf(weapon.tier, barrels - 1).length;
    const after = volleyOf(weapon.tier, barrels).length;
    check(after > before, `${weapon.label}: barrel ${barrels} adds no lane (${before} -> ${after})`);
  }
}

// ---- a lane width has to fit in its window ------------------------------
//
// Two independent rules squeeze laneStep from both sides, and neither is
// obvious from the number alone:
//
//   wider than the gun's own hit REACH, or an added lane lands on the target
//     the gun is already hitting -- measured, PLASMA CANNON at a step of 11
//     went from 63.6 to 190.9 dps against ONE centred enemy, which is not a
//     barrel, it is a third of a gun;
//   narrower than the smallest enemy, or the pattern has a hole a ship can
//     sit in, which is the #113 report in a different place.
//
// Asserted rather than trusted, because the window moves whenever an enemy is
// resized: it was comfortable until the size classes took fast_scout down to
// 13px, and it will close entirely if anything gets smaller.
for (const weapon of ladder) {
  const boltHalf = (PROJECTILES[weapon.projectileKey]?.hitbox.w ?? 5) / 2;
  const reach = narrowest / 2 + boltHalf;
  check(weapon.laneStep > reach,
    `${weapon.label}: a ${weapon.laneStep}px lane step is inside its own ${reach.toFixed(1)}px reach, so a barrel stacks a second beam on a single centred target instead of widening the pattern`);
  check(weapon.laneStep < narrowest,
    `${weapon.label}: a ${weapon.laneStep}px lane step is wider than the ${narrowest}px narrowest enemy, so barrels open a hole a ship can sit in`);
}

// ---- no hole across the aim point ---------------------------------------
for (const weapon of ladder) {
  for (const barrels of barrelCounts) {
    const offsets = volleyOf(weapon.tier, barrels).map((s) => s.offsetX).sort((a, b) => a - b);
    for (let i = 1; i < offsets.length; i += 1) {
      if (offsets[i - 1] >= 0 || offsets[i] <= 0) continue;
      const gap = offsets[i] - offsets[i - 1];
      check(gap <= narrowest,
        `${weapon.label} x${barrels}: a ${gap}px hole sits across the aim point, wider than a ${narrowest}px enemy`);
    }
  }
}

// ---- from the first barrel, every gun puts a lane on the aim point ------
//
// The #113 report, in the player's words: "when you get 5 the sixth makes the
// auto cannon split into 2 rows of 3 ... it doesn't hit anything in the middle
// of the fire pattern." Raising MAX_VOLLEY alone lets an even gun spend its
// barrels without ever filling the centre, so removing the centre-first rule
// passed every other check in this file. This is the promise itself.
for (const weapon of ladder) {
  for (const barrels of barrelCounts.slice(1)) {
    const offsets = volleyOf(weapon.tier, barrels).map((s) => s.offsetX);
    check(offsets.includes(0),
      `${weapon.label} x${barrels} has no lane on the centreline: ${offsets.join(',')}`);
  }
}

// ---- lanes are parallel, always -----------------------------------------
for (const weapon of ladder) {
  for (const barrels of barrelCounts) {
    check(volleyOf(weapon.tier, barrels).every((s) => s.angle === 0),
      `${weapon.label} x${barrels} fans its shots; an angle becomes width over distance and there is nothing to aim`);
  }
}

// ---- the campaign armory is NOT on this ladder --------------------------
//
// Chapter One's Earth fighter progresses through families and stages in its
// own armory and never bolts on barrels. This ladder must not reach into it:
// running an armory pattern through barrel expansion would silently rewrite a
// shipped progression system from inside an arcade change.
{
  const { FIGHTER_FAMILIES, FAMILY_INFO, fighterWeapon } = await load('src/game/content/FighterWeapons.ts');
  check(FIGHTER_FAMILIES.length >= 5, `the armory has only ${FIGHTER_FAMILIES.length} families -- it is not the system this check thinks it is`);

  const game = new Game2A(stubCanvas());
  game.deployTestMode();
  game.reset();
  // A stand-in armory: the port the engine actually talks to.
  let armed = fighterWeapon({ family: 'bb', rank: 4, rapid: 0 });
  game.setFighterArmory({
    active: true, get state() { return { family: 'bb', rank: 4, rapid: 0 }; }, get weapon() { return armed; },
    begin: () => true, rankUp: () => true, upgradeRapid: () => true, setActive() {}, block() {}, update: () => false,
  });
  game.deployFromMap('ledger_prime', 'EARTH');
  game.fighterReady = true;
  game.barrels = MAX_BARRELS;
  for (const family of FIGHTER_FAMILIES) {
    for (let stage = 1; stage <= 4; stage += 1) {
      armed = fighterWeapon({ family, rank: FAMILY_INFO[family].unlock + stage - 1, rapid: 0 });
      const fired = game.currentVolley();
      check(fired.length === armed.shots.length,
        `${armed.label}: the armory pattern fired ${fired.length} lanes instead of its authored ${armed.shots.length} -- barrel expansion has leaked into the campaign`);
      check(fired.every((lane, i) => lane.offsetX === armed.shots[i].offsetX && lane.angle === armed.shots[i].angle),
        `${armed.label}: the fired pattern is not the authored pattern`);
    }
  }
  // Every armory stage still has to cover a centred target -- the twin and
  // quad stages have no lane ON the centreline, so the rule they satisfy is
  // COVERAGE, not a centre lane, and it has to be measured rather than assumed.
  for (const family of FIGHTER_FAMILIES) {
    for (let stage = 1; stage <= 4; stage += 1) {
      const weapon = fighterWeapon({ family, rank: FAMILY_INFO[family].unlock + stage - 1, rapid: 0 });
      const boltHalf = (PROJECTILES[weapon.projectileKey]?.hitbox.w ?? 5) / 2;
      const covered = weapon.shots.some((shot) => Math.abs(shot.offsetX) <= narrowest / 2 + boltHalf);
      check(covered, `${weapon.label} cannot hit a ${narrowest}px enemy dead ahead: lanes at ${weapon.shots.map((s) => s.offsetX).join(',')}`);
    }
  }
}

// ---- a save written against the OLD ladder still loads ------------------
//
// The retired ladder had five rungs and CLARITY LANCE at the top. A save
// carrying a tier from it, or a barrel count from a build with a different
// cap, must land somewhere real -- a stored tier that falls out of range is
// how a player who climbed the ladder ends up holding BB SHOT with no way to
// tell a bug from a rule.
{
  const game = new Game2A(stubCanvas());
  game.deployTestMode();
  game.reset();
  for (const tier of [-3, 0, 1, 5, 9, 12, 99]) {
    game.baseWeaponTier = tier;
    game.xpLevel = 1;
    for (const barrels of [0, MAX_BARRELS, MAX_BARRELS + 4]) {
      game.barrels = barrels;
      const lanes = game.currentVolley();
      check(lanes.length > 0 && lanes.length <= MAX_VOLLEY,
        `a save at tier ${tier} with ${barrels} barrels fires ${lanes.length} lanes`);
      check(lanes.some((lane) => Math.abs(lane.offsetX) <= narrowest / 2 + 3),
        `a save at tier ${tier} with ${barrels} barrels cannot hit what it is aimed at`);
    }
  }
  // Out of range must clamp, and clamp in the right DIRECTION.
  //
  // The lookup ends in `?? WEAPON_LADDER[0]`, so an unclamped tier does not
  // crash -- it silently hands back BB SHOT. That is the exact failure the
  // code comment describes: a player who climbed the ladder sees the first gun
  // again with no way to tell a bug from a rule. Asserting only that "a save
  // still fires" cannot see it, and the mutation that removed the clamp
  // SURVIVED this file until this check existed.
  game.barrels = 0;
  const top = ladder[ladder.length - 1];
  for (const [tier, expected] of [[99, top], [ladder.length + 1, top], [0, ladder[0]], [-3, ladder[0]]]) {
    game.baseWeaponTier = tier;
    game.xpLevel = 1;
    const held = game.currentWeapon();
    check(held.label === expected.label,
      `a save at tier ${tier} resolves to ${held.label}, not ${expected.label} -- an out-of-range tier is falling back instead of clamping`);
  }
}

// ---- families are mechanically different, not numerically ---------------
const families = new Set(ladder.map((w) => w.family));
check(families.size >= 4, `only ${families.size} weapon families; the ladder is one gun with different numbers`);
const withPierce = ladder.filter((w) => (w.pierce ?? 0) > 0);
const withSplash = ladder.filter((w) => (w.splash ?? 0) > 0);
const withClear = ladder.filter((w) => w.clearsShots);
check(withPierce.length > 0, 'no rung pierces');
check(withSplash.length > 0, 'no rung splashes');
check(withClear.length > 0, 'no rung clears hostile shots');
// And each of those has to be IMPLEMENTED, not just declared in data.
//
// These three used to be source greps for the names of the methods that did
// the work. That is the mistake this repo keeps making: the greps passed for
// as long as the names existed and said nothing about behaviour, and when
// Chapter One's better-gated `secondaryImpact` replaced the splash path the
// greps failed while the feature was working perfectly. Each one now drives
// the shipped combat loop and looks at what happened on the field.
const boltAt = (x, y, over) => ({ x, y, w: 6, h: 12, vx: 0, vy: -600, damage: 1, projectileKey: 'bb_shot', pierce: 0, life: 1, ...over });
const droneAt = (x, y, hp = 50) => ({ x, y, w: 15, h: 24, vx: 0, vy: 0, hp, enemyKey: 'regulator_drone', age: 0, anchorX: x,
  phase: 0, direction: 1, fireClock: 99, stance: 'holding', stationX: x, stationY: y, stanceClock: 0, patience: 99,
  dodgeCooldown: 99, atRest: true, escort: false });
const arena = () => { const game = new Game2A(stubCanvas()); game.deployTestMode(); game.reset(); game.playerHitClock = 1; return game; };

{ // pierce: one bolt, two stacked targets, both hurt.
  const game = arena();
  const front = droneAt(200, 300), back = droneAt(200, 300);
  game.drones = [front, back];
  game.bolts = [boltAt(200, 300, { pierce: 2 })];
  game.update(0.016);
  check(front.hp < 50 && back.hp < 50, `pierce is data only -- a piercing bolt hit ${[front, back].filter((d) => d.hp < 50).length} of 2 stacked targets`);
}

{ // splash: the neighbour the bolt never touched still takes damage.
  const game = arena();
  const hit = droneAt(200, 300), near = droneAt(224, 300), far = droneAt(200, 30);
  game.drones = [hit, near, far];
  const rocket = ladder.find((w) => (w.splash ?? 0) > 0);
  game.bolts = [boltAt(200, 300, { weapon: rocket, damage: 3 })];
  game.update(0.016);
  check(near.hp < 50, `splash is data only -- a ${rocket.label} landing 24px away left the neighbour on ${near.hp}`);
  check(far.hp === 50, `splash reached a target ${Math.hypot(0, 270).toFixed(0)}px away -- the blast has no radius`);
}

{ // clearsShots: a plasma lane deletes a shot NOTHING else can intercept,
  // and unlike an ordinary bolt it survives to clear the next one.
  const plasma = ladder.find((w) => w.clearsShots);
  // Both held still. Everything MOVES before collisions run, so a bolt and a
  // shot started on the same pixel are 11px apart by the time they are tested
  // -- which is how the first version of this check "proved" plasma was
  // broken when it was working.
  const shotAt = () => ({ x: 200, y: 300, w: 8, h: 8, vx: 0, vy: 0, damage: 1, color: '#f00', projectileKey: 'enemy_red_bullet', life: 1, interceptible: false });
  const game = arena();
  const wall = [shotAt(), { ...shotAt(), x: 210 }];
  game.hostileShots = wall;
  const lane = boltAt(200, 300, { weapon: plasma, clearsShots: true, vy: 0 });
  game.bolts = [lane];
  game.update(0.016);
  check(wall[0].life === 0, `clearsShots is data only -- ${plasma.label} passed through a hostile shot nothing else can intercept`);
  check(lane.life > 0, `${plasma.label} died clearing a shot -- a plasma lane is a moving hole in a wall, not a one-shot interceptor`);

  // The control. Without it this would pass just as well if EVERY gun cleared
  // every shot, and clearsShots would not be a family identity at all.
  const plain = arena();
  const survivor = shotAt();
  plain.hostileShots = [survivor];
  plain.bolts = [boltAt(200, 300, { weapon: ladder[0], vy: 0 })];
  plain.update(0.016);
  check(survivor.life > 0, 'an ordinary rung deletes uninterceptible fire too -- clearsShots is not an identity, it is the default');
}
// More than one projectile, or every family looks the same in flight.
check(new Set(ladder.map((w) => w.projectileKey)).size >= 3,
  'the whole ladder fires the same projectile art');

// ---- the primary gun does not reach into other systems ------------------
for (const weapon of ladder) {
  for (const forbidden of ['bombs', 'bombPower', 'shield', 'shieldMax', 'pulsePower']) {
    check(!(forbidden in weapon), `${weapon.label} carries ${forbidden}; the gun must not own bomb, shield or pulse state`);
  }
}

// ---- every weapon's assets exist and are consumed ------------------------
const manifest = JSON.parse(readFileSync('public/assets/manifest.json', 'utf8'));
for (const weapon of ladder) {
  const projectile = PROJECTILES[weapon.projectileKey];
  check(!!projectile, `${weapon.label} fires '${weapon.projectileKey}', which is not in PROJECTILES`);
  if (!projectile) continue;
  const entry = manifest[projectile.sprite.category]?.[projectile.sprite.id];
  check(!!entry, `${weapon.label}'s projectile has no manifest entry (${projectile.sprite.category}/${projectile.sprite.id})`);
}
// No weapon icon may ship before something draws it.
const icons = Object.keys(manifest.weapons ?? {});
check(icons.length === 0 || /manifest\.weapons|'weapons'/.test(gameSrc),
  `${icons.length} weapon icons are in the manifest with nothing drawing them`);

if (failures.length) {
  console.error('weapon-ladder: FAIL');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
const rows = ladder.map((w) => `${w.tier} ${w.label.padEnd(15)} ${w.family.padEnd(8)} ${barrelCounts.map((b) => centred(w, b).toFixed(1).padStart(6)).join('')}`);
console.log(`weapon-ladder: OK — ${ladder.length} rungs, ${families.size} families, monotone at every barrel count.`);
console.log(`  tier label           family    ${barrelCounts.map((b) => ('x' + b).padStart(6)).join('')}`);
for (const row of rows) console.log(`  ${row}`);
