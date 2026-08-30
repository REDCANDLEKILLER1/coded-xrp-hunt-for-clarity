// The combat model: armour that depends on where you hit, classes that differ,
// and an AI that does not all attack at once.
//
// "the enemy ships I want them to have smarts about them this is not the same
// Galaga game" -- and the reference is Wing Commander, where the strategy is
// in HOW you engage rather than in dodging a bullet pattern.
//
// The maths in Combat.ts is pure, so it is checked by running it rather than
// by grepping for it. The wiring into Space3DGame is checked structurally,
// because it needs a canvas and a camera to run.

import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };
const near = (a, b, tol, message) => check(Math.abs(a - b) <= tol, `${message} (got ${a}, expected ~${b})`);

const bundle = await build({
  entryPoints: ['src/game/space3d/Combat.ts'],
  bundle: true, format: 'esm', write: false, logLevel: 'silent',
});
const {
  SHIP_CLASSES, CLASS_BY_SPRITE, classForSprite,
  armourMultiplier, engagementSlots, blindSidePoint, isBeingChased, normalise, dot,
  shouldBreakOff, shouldReAttack,
} = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

const game = readFileSync('src/game/space3d/Space3DGame.ts', 'utf8');
const lane = readFileSync('src/game/space3d/SpaceLane.ts', 'utf8');

/**
 * The source with comments removed, for assertions about CODE.
 *
 * Three separate checks in this repo have now matched prose instead of code:
 * a roll/lock grep that fired on a comment saying the rule deliberately does
 * not exist, a tick-gate check that matched 'arrival' inside the comment
 * explaining why arrival belongs in the gate, and a success-string check that
 * matched the comment explaining why the success string was removed.
 *
 * Both directions bite. A POSITIVE check can pass on a comment while the code
 * does nothing; a NEGATIVE check can fail on correct code because someone
 * documented the thing being forbidden. Anything asserting about behaviour
 * reads this instead of the raw file.
 */
const gameCode = game.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
if (gameCode.length < game.length * 0.4) failures.push('comment stripping ate the source — the scraper is broken');

// ---- armour depends on where the hit lands --------------------------------
//
// A ship flying along +z. A bolt travelling -z flies into its nose; +z flies
// up its engines; across is a flank hit.
{
  const facing = { x: 0, y: 0, z: 1 };
  const heavy = SHIP_CLASSES.heavy_fighter.armour;
  near(armourMultiplier({ x: 0, y: 0, z: -1 }, facing, heavy), heavy.nose, 1e-9, 'head-on must use the nose value');
  near(armourMultiplier({ x: 1, y: 0, z: 0 }, facing, heavy), heavy.flank, 1e-9, 'a beam shot must use the flank value');
  near(armourMultiplier({ x: 0, y: 0, z: 1 }, facing, heavy), heavy.tail, 1e-9, 'a shot up the engines must use the tail value');

  // Continuous, not bucketed. A cliff in the middle of a turning fight would
  // double the damage across a fraction of a degree, and the player could not
  // tell a good angle from a lucky one.
  let previous = -Infinity;
  let monotonic = true;
  for (let i = 0; i <= 40; i += 1) {
    const theta = Math.PI * (i / 40);            // nose -> tail
    const value = armourMultiplier({ x: Math.sin(theta), y: 0, z: -Math.cos(theta) }, facing, heavy);
    if (value < previous - 1e-9) monotonic = false;
    previous = value;
  }
  check(monotonic, 'the heavy fighter must get steadily softer as you get further round it');

  // The whole point of this class: head-on is a losing trade.
  check(
    heavy.tail / heavy.nose >= 4,
    `the heavy fighter is only ${(heavy.tail / heavy.nose).toFixed(1)}x softer from behind — not enough to be worth manoeuvring for`,
  );

  // The multiplier must never leave the authored range, for ANY direction.
  //
  // Feeding an over-unit vector does not test this: normalise() runs first and
  // sanitises it, so the clamp is never reached and the check cannot fail.
  // What the clamp actually guards is drift in the dot of two ALREADY-unit
  // vectors, which cannot be constructed on demand -- so the invariant is
  // asserted across a dense sweep instead, which a broken interpolation would
  // break at once.
  const lo = Math.min(heavy.nose, heavy.flank, heavy.tail);
  const hi = Math.max(heavy.nose, heavy.flank, heavy.tail);
  let outOfRange = 0;
  for (let i = 0; i < 500; i += 1) {
    const shot = normalise({ x: Math.random() * 2 - 1, y: Math.random() * 2 - 1, z: Math.random() * 2 - 1 });
    const value = armourMultiplier(shot, facing, heavy);
    if (!Number.isFinite(value) || value < lo - 1e-9 || value > hi + 1e-9) outOfRange += 1;
  }
  check(outOfRange === 0, `${outOfRange} of 500 directions produced a multiplier outside the authored ${lo}..${hi}`);

  // ...and the clamp itself is pinned structurally, honestly labelled as such:
  // its failure mode is a NaN that would blank the multiplier silently, and
  // there is no input that reaches it through normalise().
  const combatSrc = readFileSync('src/game/space3d/Combat.ts', 'utf8');
  check(/clamp\(dot\(d, f\), -1, 1\)/.test(combatSrc), 'the armour dot product must be clamped before it is interpolated');

  // A zero facing vector must not silently become a nose hit or a NaN.
  const zeroFacing = armourMultiplier({ x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 0 }, heavy);
  check(Number.isFinite(zeroFacing), 'a zero facing vector must not produce NaN');
}

// ---- the gunboat is the one you have to climb over ------------------------
{
  const facing = { x: 0, y: 0, z: 1 };
  const boat = SHIP_CLASSES.gunboat.armour;
  check(boat.dorsal !== undefined, 'the gunboat needs a dorsal weak spot — it is the class whose whole point is the third dimension');

  const waist = armourMultiplier({ x: 1, y: 0, z: 0 }, facing, boat);
  const above = armourMultiplier({ x: 0, y: 1, z: 0 }, facing, boat);
  const below = armourMultiplier({ x: 0, y: -1, z: 0 }, facing, boat);
  near(above, below, 1e-9, 'over the top and under the belly must be equally soft');
  check(above / waist >= 3, `diving on the gunboat is only ${(above / waist).toFixed(1)}x better than the waist — not a reason to climb`);

  // ...and it is the ONLY class that works that way. If everything had a
  // dorsal weakness, flying over things would be the answer to the whole
  // level and there would be no reason to turn.
  const withDorsal = Object.values(SHIP_CLASSES).filter((c) => c.armour.dorsal !== undefined);
  check(withDorsal.length === 1, `${withDorsal.length} classes have a dorsal weakness — it must be the gunboat's alone`);

  // The other classes must be elevation-INDEPENDENT, or "get above it" would
  // quietly be the answer everywhere.
  for (const shipClass of Object.values(SHIP_CLASSES)) {
    if (shipClass.armour.dorsal !== undefined) continue;
    const level = armourMultiplier({ x: 1, y: 0, z: 0 }, facing, shipClass.armour);
    const steep = armourMultiplier({ x: 0.2, y: 0.98, z: 0 }, facing, shipClass.armour);
    near(level, steep, 1e-9, `${shipClass.key} must not have an accidental elevation weakness`);
  }
}

// ---- four classes, actually different -------------------------------------
{
  const keys = Object.keys(SHIP_CLASSES);
  check(keys.length >= 5, `only ${keys.length} ship classes — the plan calls for four plus chaff`);
  for (const [key, shipClass] of Object.entries(SHIP_CLASSES)) {
    check(shipClass.key === key, `SHIP_CLASSES.${key} carries the wrong key`);
    check(shipClass.label.length > 0, `${key} needs a label for the target block`);
    for (const face of ['nose', 'flank', 'tail']) {
      check(shipClass.armour[face] > 0, `${key}.${face} must be a positive multiplier`);
    }
    check(shipClass.shieldShare >= 0 && shipClass.shieldShare <= 1, `${key}.shieldShare must be a fraction`);
  }

  // Every enemy the leg actually scrambles has to map to a class, or it
  // silently flies as chaff with no armour model at all.
  for (const match of lane.matchAll(/enemyKey: '([a-z_]+)'/g)) {
    check(match[1] in CLASS_BY_SPRITE, `the leg scrambles "${match[1]}" but no ship class claims it`);
  }
  for (const match of lane.matchAll(/escortKey: '([a-z_]+)'/g)) {
    check(match[1] in CLASS_BY_SPRITE, `the boss launches "${match[1]}" but no ship class claims it`);
  }

  // An unknown sprite must fall back to something real rather than undefined.
  check(classForSprite('not_a_ship')?.key === 'chaff', 'an unknown sprite must fall back to chaff, not to undefined');

  // At least one class has to out-run the player, or no enemy can ever choose
  // its angle of attack.
  //
  // A live capture measured 57% of APPROACHING contacts stuck in the player's
  // rear hemisphere however their goal point was computed, because every
  // authored speed was below the player's cruise. A ship that cannot get in
  // front of you has no tactics available to it whatever its state machine
  // says, and the level becomes a stern chase you can never lose.
  const CRUISE = Number(/const CRUISE = (\d+);/.exec(game)?.[1]);
  check(Number.isFinite(CRUISE), 'could not read the player cruise speed');
  const topSpeeds = {};
  for (const match of lane.matchAll(/enemyKey: '(\w+)'[^}]*?speed: (\d+)/g)) {
    const key = CLASS_BY_SPRITE[match[1]];
    const speed = Number(match[2]) * SHIP_CLASSES[key].speedScale;
    topSpeeds[key] = Math.max(topSpeeds[key] ?? 0, speed);
  }
  const faster = Object.entries(topSpeeds).filter(([, speed]) => speed > CRUISE);
  check(
    faster.length > 0,
    `no ship class out-runs the player's cruise of ${CRUISE} — nothing can position in front of you`,
  );
  // ...and the interceptor must be the fastest of them, since "you cannot
  // chase it, you have to meet it" is its whole identity.
  const fastest = Object.entries(topSpeeds).sort((a, b) => b[1] - a[1])[0];
  check(fastest?.[0] === 'interceptor', `the fastest class is ${fastest?.[0]}, not the interceptor`);
  // ...but not everything: a level where every enemy out-runs you is a level
  // you can never disengage from.
  check(faster.length < Object.keys(topSpeeds).length, 'every class out-runs the player — there is no way to break off');
  for (const shipClass of Object.values(SHIP_CLASSES)) {
    check(shipClass.speedScale > 0, `${shipClass.key}.speedScale must be positive`);
  }

  // The classes must not all be the same ship with a different name.
  const profiles = new Set(Object.values(SHIP_CLASSES).map((c) => `${c.armour.nose}/${c.armour.flank}/${c.armour.tail}`));
  check(profiles.size >= 4, `only ${profiles.size} distinct armour profiles across ${keys.length} classes`);
}

// ---- not everyone attacks at once -----------------------------------------
{
  const view = {
    playerPosition: { x: 0, y: 0, z: 0 },
    playerFacing: { x: 0, y: 0, z: 1 },
    slots: 3,
  };
  const make = (id, distance, key = 'interceptor', state = 'approach', health = 1) => ({
    id,
    position: { x: 0, y: 0, z: distance },
    facing: { x: 0, y: 0, z: -1 },
    state,
    health,
    shipClass: SHIP_CLASSES[key],
  });

  const many = [1, 2, 3, 4, 5, 6, 7, 8].map((id) => make(id, id * 500));
  const slots = engagementSlots(many, view);
  check(slots.size === 3, `${slots.size} ships were given engagement slots against a budget of 3`);

  // Nearest first, so the ship bearing down on you is the one that presses --
  // not one three thousand units away that happened to be earlier in the
  // array. Ordering by array index would make the choice depend on spawn
  // order, which is invisible to the player and reads as random.
  const shuffled = [...many].reverse();
  const fromShuffled = engagementSlots(shuffled, view);
  check(
    [...slots].sort().join(',') === [...fromShuffled].sort().join(','),
    'the engagement slots changed when the array was reordered — the choice depends on spawn order, not on the fight',
  );
  check(slots.has(1) && slots.has(2) && slots.has(3), 'the nearest ships must be the ones that press');

  // A ship already hurt past its break-off point does not take a slot: it is
  // leaving, and holding a slot it cannot use would starve a healthy wingman.
  const wounded = [make(1, 400, 'heavy_fighter', 'approach', 0.05), make(2, 900), make(3, 1200), make(4, 1500)];
  const woundedSlots = engagementSlots(wounded, view);
  check(!woundedSlots.has(1), 'a ship below its break-off threshold must not hold an engagement slot');

  // A budget of zero must engage nobody rather than everybody.
  check(engagementSlots(many, { ...view, slots: 0 }).size === 0, 'a budget of zero must engage nobody');
  check(engagementSlots([], view).size === 0, 'an empty fight must not throw');
}

// ---- they come for your blind side ----------------------------------------
{
  const view = {
    playerPosition: { x: 0, y: 0, z: 0 },
    playerFacing: { x: 0, y: 0, z: 1 },
    slots: 3,
  };
  for (const phase of [0, 1, 2, 3, 4, 5]) {
    const point = blindSidePoint(view, 900, phase);
    const towards = normalise(point);
    check(
      dot(towards, view.playerFacing) < 0,
      `the attack point at phase ${phase} is in FRONT of the player — that is not a blind side`,
    );
    near(Math.hypot(point.x, point.y, point.z), 900, 1e-6, `the attack point at phase ${phase} must sit at the standoff range`);
  }

  // Different phases must give different points, or a flight of four stacks
  // into one place on your six and reads as a single ship.
  const spread = new Set([0, 1.5, 3, 4.5].map((p) => {
    const q = blindSidePoint(view, 900, p);
    return `${q.x.toFixed(1)},${q.y.toFixed(1)},${q.z.toFixed(1)}`;
  }));
  check(spread.size === 4, 'ships with different phases must attack from different points');

  // THE SINGULARITY. Pointing straight up or down collapses a naive
  // cross-product basis to zero, and the attack point jumps to the nose --
  // an enemy that "suddenly appeared in front of me" whenever the player
  // climbed. Same shape as the gamma ~ +/-90 bug that broke tilt.
  for (const facing of [{ x: 0, y: 1, z: 0 }, { x: 0, y: -1, z: 0 }, { x: 0, y: 0.999, z: 0.001 }]) {
    const straight = { ...view, playerFacing: facing };
    const point = blindSidePoint(straight, 900, 1.2);
    check(Number.isFinite(point.x + point.y + point.z), `pointing at ${JSON.stringify(facing)} produced a non-finite attack point`);
    near(Math.hypot(point.x, point.y, point.z), 900, 1e-6, `pointing at ${JSON.stringify(facing)} must still place the point at standoff`);
    check(dot(normalise(point), normalise(facing)) < 0, `pointing at ${JSON.stringify(facing)} must still attack from behind`);

    // ...and crucially it must still SPREAD. A collapsed basis still puts the
    // point behind the player -- directly behind, every time, for every phase
    // -- so a direction check alone passes while the whole flight stacks into
    // one spot on your six. The spread is the thing that actually breaks.
    const points = new Set([0, 1.5, 3, 4.5].map((phase) => {
      const q = blindSidePoint(straight, 900, phase);
      return `${q.x.toFixed(2)},${q.y.toFixed(2)},${q.z.toFixed(2)}`;
    }));
    check(
      points.size === 4,
      `pointing at ${JSON.stringify(facing)} collapsed ${4 - points.size + 1} attack points into one — the basis has degenerated`,
    );
  }
}

// ---- break off, recover, come back -- without thrashing -------------------
//
// Hull damage is permanent, which creates a trap: if the break-off is gated on
// hull alone, a ship whose hull sits below its threshold re-triggers it on
// every decision forever. A live capture caught exactly that -- a wounded
// interceptor flipping extend -> approach -> extend at 2.5Hz, never fighting
// again. The two predicates are kept separate so the invariant can be asserted
// rather than hoped for.
{
  const make = (state, health, key = 'interceptor') => ({
    id: 1, position: { x: 0, y: 0, z: 900 }, facing: { x: 0, y: 0, z: 1 },
    state, health, shipClass: SHIP_CLASSES[key],
  });
  const max = SHIP_CLASSES.interceptor.shieldShare * 2;

  check(shouldBreakOff(make('engage', 0.1), 0), 'a stripped, thin-hulled ship must break off');
  check(!shouldBreakOff(make('engage', 0.1), max), 'a ship with its bank back must not break off on hull alone');
  check(!shouldBreakOff(make('engage', 1), 0), 'a healthy ship must not break off just because its shield is down');
  check(!shouldBreakOff(make('extend', 0.1), 0), 'a ship already extending must not re-trigger the break-off');
  check(!shouldBreakOff(make('engage', 0, 'chaff'), 0), 'chaff has no bank to recover and must never break off');

  check(shouldReAttack(make('extend', 0.1), max, max, 9000, 2000), 'a recovered ship with room must come back in');
  check(!shouldReAttack(make('extend', 0.1), 0, max, 9000, 2000), 'a ship that has not recovered must not come back in');
  check(!shouldReAttack(make('extend', 0.1), max, max, 500, 2000), 'a ship still close must keep extending');
  check(!shouldReAttack(make('engage', 0.1), max, max, 9000, 2000), 'only an extending ship re-attacks');

  // THE INVARIANT. Across every combination of state, health and shield, the
  // two predicates must never both fire -- that is the oscillation, stated
  // directly. Sweeping it is what makes reintroducing the bug impossible
  // rather than merely unlikely.
  let thrash = 0;
  for (const state of ['approach', 'engage', 'extend', 'evade']) {
    for (let h = 0; h <= 1.0001; h += 0.05) {
      for (const shield of [0, max * 0.5, max]) {
        const c = make(state, h);
        if (shouldBreakOff(c, shield) && shouldReAttack(c, shield, max, 9000, 2000)) thrash += 1;
      }
    }
  }
  check(thrash === 0, `${thrash} states satisfy BOTH break-off and re-attack — a ship there would thrash between them`);

  // ...and a recovered ship must be able to leave `extend` at all, or the
  // break-off is a one-way door and the enemy simply removes itself.
  const recovered = make('extend', 0.05);
  check(
    !shouldBreakOff(recovered, max) && shouldReAttack(recovered, max, max, 9000, 2000),
    'a ship with permanent hull damage but a full bank must still be able to re-attack',
  );
}

// ---- a wingman notices you are on someone's tail --------------------------
{
  const view = { playerPosition: { x: 0, y: 0, z: 0 }, playerFacing: { x: 0, y: 0, z: 1 }, slots: 3 };
  const victim = (position, facing) => ({
    id: 9, position, facing, state: 'engage', health: 1, shipClass: SHIP_CLASSES.interceptor,
  });

  check(
    isBeingChased(victim({ x: 0, y: 0, z: 800 }, { x: 0, y: 0, z: 1 }), view, 2600),
    'a ship running directly away with the player behind it must read as being chased',
  );
  check(
    !isBeingChased(victim({ x: 0, y: 0, z: -800 }, { x: 0, y: 0, z: 1 }), view, 2600),
    'a ship behind the player is not being chased by them',
  );
  check(
    !isBeingChased(victim({ x: 0, y: 0, z: 800 }, { x: 0, y: 0, z: -1 }), view, 2600),
    'a ship flying head-on at the player is merging, not being chased',
  );
  check(
    !isBeingChased(victim({ x: 0, y: 0, z: 9000 }, { x: 0, y: 0, z: 1 }), view, 2600),
    'a ship outside support range must not summon help',
  );
  check(
    !isBeingChased(victim({ x: 2000, y: 0, z: 800 }, { x: 0, y: 0, z: 1 }), view, 2600),
    'a ship well off the player nose is not being chased',
  );
}

// ---- the wiring ------------------------------------------------------------
{
  // Only a ship holding a slot may shoot. Without this the budget would change
  // where ships fly but not how much fire is coming at you, which is most of
  // what "everyone at once" actually feels like.
  const contacts = game.split('private updateContacts(dt: number): void {')[1]?.split('\n  }\n')[0] ?? '';
  check(contacts.includes('desiredPosition'), 'could not find updateContacts — the scraper is broken');
  check(
    /contact\.state === 'engage'[^\n]*\n?[^\n]*fireClock|fireInterval > 0 && contact\.state === 'engage'/.test(contacts),
    'contacts must only fire while they hold an engagement slot',
  );

  // Hull damage is permanent. A wounded enemy that runs and returns at full
  // health makes every hit you landed retroactively pointless.
  check(
    /contact\.state === 'extend' && contact\.shieldMax > 0/.test(contacts),
    'shields must regenerate only while a ship is broken off',
  );
  check(
    !/contact\.hp = Math\.min|contact\.hp \+=/.test(gameCode),
    'nothing may restore enemy hull: hull damage is permanent for the encounter',
  );

  // Damage has to go through the armour model, or the profiles are decoration.
  check(/armourMultiplier\(/.test(gameCode), 'bolt damage must be resolved through the armour model');
  const damage = game.split('private damage(contact: Contact, amount: number): void {')[1]?.split('\n  }\n')[0] ?? '';
  check(damage.includes('contact.hp'), 'could not find the damage router — the scraper is broken');
  check(/contact\.shield/.test(damage), 'damage must spend the shield before the hull');

  // Decisions are staggered. Re-deciding every frame is both wasteful and
  // worse: a ship that reconsiders sixty times a second oscillates instead of
  // committing.
  check(/const DECIDE_INTERVAL = /.test(gameCode), 'AI decisions must run on an interval, not every frame');
  const decide = game.split('private decide(dt: number): void {')[1]?.split('\n  }\n')[0] ?? '';
  check(decide.includes('engagementSlots'), 'could not find the decision layer — the scraper is broken');
  check(/decideClock/.test(decide), 'each ship must carry its own decision countdown');
  check(/isBeingChased/.test(decide), 'mutual support must be part of the decision');

  // Squadrons arrive where you can see them.
  //
  // A uniform bearing put half of every squadron behind the player at birth,
  // and most classes are slower than cruise so they could never come round:
  // a live capture measured 70% of approaching contacts permanently in the
  // rear hemisphere, with nothing to fly toward. Spawning into a cone off the
  // nose took that to 0%, and left something in the forward 45 degrees for
  // 96% of frames.
  const scramble = game.split('private scramble(squadron: SpaceSquadron): void {')[1]?.split('\n  }\n')[0] ?? '';
  check(scramble.includes('entryRange'), 'could not find scramble — the scraper is broken');
  check(
    !/const yaw = Math\.random\(\) \* Math\.PI \* 2/.test(scramble),
    'squadrons must not scramble to a uniform bearing: half of every squadron would be born behind the player',
  );
  check(/SPAWN_CONE/.test(scramble), 'squadrons must scramble into a cone ahead of the player');
  const cone = Number(/const SPAWN_CONE = ([\d.]+);/.exec(game)?.[1]);
  check(Number.isFinite(cone) && cone > 0, 'SPAWN_CONE must exist and be positive');
  check(cone < Math.PI, `a spawn cone of ${cone}rad is the whole forward hemisphere or more — that is not a cone`);

  // The holding pattern must bias toward the player's front, and the weight
  // has to EXCEED 1 to do it. Below 1 a contact sitting directly behind blends
  // to itself and stays there -- measured, at 0.85 the rear share went UP.
  const desired = game.split('private desiredPosition(')[1]?.split('\n  }\n')[0] ?? '';
  check(desired.includes('perch'), 'the approach must aim at a perch the player can see');
  const weight = Number(/x: towards\.x \+ dir\.x \* ([\d.]+),/.exec(desired)?.[1]);
  check(Number.isFinite(weight), 'could not read the perch blend weight');
  check(weight > 1, `a perch blend of ${weight} cannot move a contact that is directly behind the player`);

  const slots = Number(/const ENGAGEMENT_SLOTS = (\d+);/.exec(game)?.[1]);
  check(Number.isFinite(slots) && slots > 0, 'ENGAGEMENT_SLOTS must exist and be positive');
  // A budget as large as a squadron is not a budget.
  const biggest = Math.max(...[...lane.matchAll(/count: (\d+)/g)].map((m) => Number(m[1])));
  check(slots < biggest, `a budget of ${slots} against squadrons of up to ${biggest} lets everyone attack at once`);
}

if (failures.length > 0) {
  console.error('combat model FAILED');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

const heavy = SHIP_CLASSES.heavy_fighter.armour;
const boat = SHIP_CLASSES.gunboat.armour;
console.log(
  `combat-model: OK — ${Object.keys(SHIP_CLASSES).length} classes, heavy fighter `
  + `${(heavy.tail / heavy.nose).toFixed(1)}x softer from behind, gunboat `
  + `${(boat.dorsal / boat.flank).toFixed(1)}x softer from above, `
  + `${/const ENGAGEMENT_SLOTS = (\d+);/.exec(game)[1]} engagement slots.`,
);
