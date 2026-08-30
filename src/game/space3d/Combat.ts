/**
 * What a ship is made of, and what it does about you.
 *
 * Everything here is pure. The AI in Space3DGame calls into it, but none of it
 * touches the camera, the canvas or the clock -- which is the only reason the
 * armour model and the intercept decisions can be checked at all. The
 * inverted-yaw bug in `Projection.toView` shipped because its arithmetic was
 * only reachable through a draw call; combat maths gets the same treatment as
 * projection maths for the same reason.
 *
 * The organising idea: ONE quantity drives all of it. Relative facing -- a dot
 * product between where a ship points and where something is coming from --
 * decides how much damage a hit does, which way an attacker should approach,
 * and (when the angled sprites land) which frame to draw. The armour model,
 * the AI's choice of angle and the player's own shield banks are the same
 * arithmetic wearing different hats.
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Damage multipliers by where a hit lands, interpolated rather than bucketed.
 *
 * Buckets would put a cliff in the middle of a turning fight: a fraction of a
 * degree either side of a boundary would double the damage, and the player
 * would be unable to tell a good angle from a lucky one. Continuous means
 * getting further round costs the target more, smoothly, which is a thing you
 * can learn to fly.
 */
export interface ArmourProfile {
  /** Hit square on the nose. */
  nose: number;
  /** Hit from the side. */
  flank: number;
  /** Hit up the engines. */
  tail: number;
  /**
   * Hit from directly above or below, when the class has a soft back or belly.
   *
   * Optional, and only the gunboat has one: it is the single enemy whose
   * weakness forces the player to use the third dimension rather than turning
   * in a plane. Left undefined, the planar profile applies at every elevation.
   */
  dorsal?: number;
}

export type ShipClassKey = 'chaff' | 'missile_boat' | 'heavy_fighter' | 'interceptor' | 'gunboat';

export interface ShipClass {
  key: ShipClassKey;
  label: string;
  armour: ArmourProfile;
  /**
   * Fraction of its health carried as regenerating shield.
   *
   * Shields come back when it breaks off; hull does not. A wounded enemy that
   * runs away and returns at FULL health is not a smart enemy, it is an
   * irritating one -- every hit you land has to still be on it when it comes
   * back, or there was no point landing it.
   */
  shieldShare: number;
  /** Health fraction below which it disengages to recover its shields. */
  breakOffAt: number;
  /** How many of this class may be in `engage` at once, as a squadron share. */
  aggression: number;
  /**
   * Multiplier on the squadron's authored speed.
   *
   * This is not flavour. A live capture showed 57% of APPROACHING contacts
   * sitting in the player's rear hemisphere no matter where their goal point
   * was put -- because every authored speed (70-110) was below the player's
   * cruise (130), so nothing could ever get in front of you. A ship that
   * cannot out-run you cannot choose its angle, and an enemy that cannot
   * choose its angle has no tactics available to it however good its state
   * machine is.
   *
   * The lane keeps authoring the pacing curve; the class scales it, so the
   * interceptor is genuinely something you have to MEET rather than chase.
   */
  speedScale: number;
}

/**
 * Roles assigned to match how the art actually LOOKS, because a silhouette is
 * much harder to change than a table.
 */
export const SHIP_CLASSES: Record<ShipClassKey, ShipClass> = {
  // Cheap. Its job is to occupy you, which is what makes the others dangerous.
  chaff: {
    key: 'chaff',
    label: 'REGULATOR DRONE',
    armour: { nose: 1, flank: 1, tail: 1 },
    shieldShare: 0,
    breakOffAt: 0,
    aggression: 1,
    // Chaff stays slow. It is not supposed to dictate anything.
    speedScale: 1.0,
  },
  // Narrow, spindly, visible racks. Fragile everywhere, but it kills you from
  // outside your gun range: close now, or beat the seeker geometrically.
  missile_boat: {
    key: 'missile_boat',
    label: 'FOG RAIDER',
    armour: { nose: 1.2, flank: 1.2, tail: 1.2 },
    shieldShare: 0.25,
    breakOffAt: 0.35,
    aggression: 0.5,
    // Enough to reposition, not enough to escape a committed chase.
    speedScale: 1.2,
  },
  // Clawed, swept, plated at the front. Head-on is a losing trade; turn inside
  // it and take the engines and it dies in a third of the time.
  heavy_fighter: {
    key: 'heavy_fighter',
    label: 'RUG FIGHTER',
    armour: { nose: 0.3, flank: 0.9, tail: 2.5 },
    shieldShare: 0.35,
    breakOffAt: 0.3,
    aggression: 0.8,
    // Comfortably faster than cruise: it picks the angle, and that is what makes its armoured nose a problem you have to solve rather than avoid.
    speedScale: 1.5,
  },
  // The fastest thing in the level. Thin everywhere, but you cannot chase it
  // down -- you have to MEET it, which means turning into the merge.
  interceptor: {
    key: 'interceptor',
    label: 'FAST SCOUT',
    armour: { nose: 1.0, flank: 1.0, tail: 1.4 },
    shieldShare: 0.2,
    breakOffAt: 0.4,
    aggression: 1,
    // The fastest thing in the level, and the reason the plan says you cannot chase it -- you have to turn into the merge and MEET it.
    speedScale: 2.0,
  },
  // Slow, blunt, armoured all round the waist -- and soft over the top and
  // under the belly. The one enemy that cannot be beaten by turning in a
  // plane: you have to climb over it or dive under it.
  gunboat: {
    key: 'gunboat',
    label: 'WHALE SCOUT',
    armour: { nose: 0.4, flank: 0.5, tail: 0.6, dorsal: 2.0 },
    shieldShare: 0.4,
    breakOffAt: 0.25,
    aggression: 0.4,
    // Still the slowest. It does not need to get in front of you: it sits at long standoff and shoots, and its answer is that you climb over it.
    speedScale: 1.15,
  },
};

/** Which class a manifest sprite key flies as. */
export const CLASS_BY_SPRITE: Record<string, ShipClassKey> = {
  regulator_drone: 'chaff',
  fog_raider: 'missile_boat',
  rug_fighter: 'heavy_fighter',
  fast_scout: 'interceptor',
  whale_scout: 'gunboat',
};

export function classForSprite(sprite: string): ShipClass {
  return SHIP_CLASSES[CLASS_BY_SPRITE[sprite] ?? 'chaff'];
}

export function normalise(v: Vec3): Vec3 {
  const length = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / length, y: v.y / length, z: v.z / length };
}

export function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/**
 * How much damage a hit does, given where it came from.
 *
 * `shot` is the direction the round is TRAVELLING; `facing` is the unit vector
 * the target points along. Their dot product runs:
 *
 *   -1  the round flies straight into the nose      -> nose
 *    0  it arrives across the beam                  -> flank
 *   +1  it flies up the engines from behind         -> tail
 *
 * so the two halves interpolate separately and the profile can be
 * asymmetric -- which is the whole point, because a heavy fighter is 8x
 * softer from behind than from in front.
 *
 * ELEVATION overrides that, for classes that have a dorsal number. A shot
 * arriving from almost directly above or below is not a nose, flank or tail
 * hit in any useful sense, so it blends toward the dorsal value by how
 * vertical it is. World-up is used as the ship's up: enemies do not roll here,
 * so the two are the same vector, and if enemies ever gain roll this is the
 * line that has to learn about it.
 */
export function armourMultiplier(shot: Vec3, facing: Vec3, profile: ArmourProfile): number {
  const d = normalise(shot);
  const f = normalise(facing);
  // clamp before use: floating drift can push a dot product past 1, and an
  // out-of-range interpolation silently produces a multiplier nobody authored.
  const along = clamp(dot(d, f), -1, 1);
  const planar = along <= 0
    ? profile.nose + (profile.flank - profile.nose) * (along + 1)
    : profile.flank + (profile.tail - profile.flank) * along;

  if (profile.dorsal === undefined) return planar;
  // How vertical the shot is, 0 (level) .. 1 (straight down or straight up).
  const vertical = clamp(Math.abs(d.y), 0, 1);
  return planar + (profile.dorsal - planar) * vertical;
}

/**
 * What an enemy is currently doing.
 *
 * `approach` and `extend` differ from `engage` in one way that matters: an
 * engaged enemy is trying to shoot you, and the squadron only lets a few do
 * that at once. Everything else is manoeuvring for a turn it has not been
 * given yet, which is what stops twenty contacts all flying at your face.
 */
export type AiState = 'approach' | 'engage' | 'extend' | 'evade';

export interface Combatant {
  id: number;
  position: Vec3;
  facing: Vec3;
  state: AiState;
  /** 0..1 of maximum. Drives the break-off decision. */
  health: number;
  shipClass: ShipClass;
}

export interface SquadronView {
  /** Where the player is, and where their nose points. */
  playerPosition: Vec3;
  playerFacing: Vec3;
  /** How many may be engaged at once. */
  slots: number;
}

/**
 * Who gets to attack, and who has to wait their turn.
 *
 * This single rule does more for how a fight FEELS than anything else in the
 * combat model, and it costs one counter. Without it every contact wants the
 * same thing at the same moment and the level is Galaga with a camera: a wall
 * of ships arriving together, none of them making a decision. With it, some
 * press and the rest hold off and reposition, and the fight has a shape.
 *
 * Slots go to the ships that have EARNED them: nearest first, so the enemy
 * bearing down on you is the one that presses, not one three thousand units
 * away that happened to be earlier in the array. Ordering by array index would
 * make the choice depend on spawn order, which is invisible to the player and
 * therefore reads as random.
 *
 * Returns the set of ids allowed to be in `engage` this decision.
 */
export function engagementSlots(combatants: Combatant[], view: SquadronView): Set<number> {
  const eligible = combatants
    .filter((c) => c.state !== 'evade' && c.health > c.shipClass.breakOffAt)
    .map((c) => ({
      id: c.id,
      // Weighted by aggression, so a gunboat does not take the slot a
      // heavy fighter would use better.
      cost: Math.hypot(
        c.position.x - view.playerPosition.x,
        c.position.y - view.playerPosition.y,
        c.position.z - view.playerPosition.z,
      ) / Math.max(0.05, c.shipClass.aggression),
    }))
    .sort((a, b) => a.cost - b.cost);
  return new Set(eligible.slice(0, Math.max(0, view.slots)).map((item) => item.id));
}

/**
 * Where an attacker wants to be: your blind side.
 *
 * An engaging enemy steers for the REAR hemisphere rather than flying at your
 * face, because that is where your aft shield is and where you cannot shoot.
 * It is also the situation the radar and the edge chevrons exist to warn you
 * about, so this is what makes those instruments worth reading.
 *
 * The offset is around the player's own axis, so "behind" means behind
 * relative to where you are pointing NOW -- turn and the attacker has to
 * re-solve, which is what a defensive turn is for.
 */
export function blindSidePoint(view: SquadronView, standoff: number, phase: number): Vec3 {
  const f = normalise(view.playerFacing);
  // A basis across the player's facing. Using world-up as the seed fails when
  // the player is pointing straight up or down -- the cross product collapses
  // to zero and the attack point jumps to the nose. Pick a different seed
  // there, which costs one comparison and removes a whole class of "the enemy
  // suddenly appeared in front of me" bug.
  const seed = Math.abs(f.y) > 0.9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
  const right = normalise({
    x: f.y * seed.z - f.z * seed.y,
    y: f.z * seed.x - f.x * seed.z,
    z: f.x * seed.y - f.y * seed.x,
  });
  const up = {
    x: f.y * right.z - f.z * right.y,
    y: f.z * right.x - f.x * right.z,
    z: f.x * right.y - f.y * right.x,
  };
  // Behind, and off to one side by the ship's own phase, so a flight of four
  // does not stack into a single point on your six.
  const back = -0.72;
  const side = Math.cos(phase) * 0.62;
  const lift = Math.sin(phase) * 0.44;
  const direction = normalise({
    x: f.x * back + right.x * side + up.x * lift,
    y: f.y * back + right.y * side + up.y * lift,
    z: f.z * back + right.z * side + up.z * lift,
  });
  return {
    x: view.playerPosition.x + direction.x * standoff,
    y: view.playerPosition.y + direction.y * standoff,
    z: view.playerPosition.z + direction.z * standoff,
  };
}

/**
 * True when the player is on this ship's tail.
 *
 * Used for mutual support: a wingman that sees this go true breaks off what it
 * was doing and comes for the player's own six. It is measured from the
 * PLAYER's facing, not the victim's -- being chased means someone is pointing
 * at you from behind, and a ship fleeing nose-first from a threat it cannot
 * see is exactly the case a facing-of-the-victim test would miss.
 */
export function isBeingChased(target: Combatant, view: SquadronView, range: number): boolean {
  const toTarget = {
    x: target.position.x - view.playerPosition.x,
    y: target.position.y - view.playerPosition.y,
    z: target.position.z - view.playerPosition.z,
  };
  const distance = Math.hypot(toTarget.x, toTarget.y, toTarget.z);
  if (distance > range || distance < 1) return false;
  // Player pointing at it...
  const onNose = dot(normalise(toTarget), normalise(view.playerFacing));
  if (onNose < 0.82) return false;
  // ...from behind it.
  return dot(normalise(toTarget), normalise(target.facing)) > 0.3;
}

/**
 * Whether a ship should disengage to recover.
 *
 * Gated on the SHIELD being gone as well as the hull being thin, and that
 * second condition is load-bearing rather than flavour.
 *
 * A live capture caught the version without it: hull damage is permanent, so a
 * ship whose hull sat below its threshold re-triggered the break-off on every
 * decision tick forever. It flipped extend -> approach -> extend at 2.5Hz and
 * never fought again -- the exact "oscillates on the boundary instead of
 * committing" failure the decision stagger exists to prevent, reintroduced one
 * level up.
 *
 * With the shield in the condition the cycle closes properly: break off with a
 * stripped bank, recover it, come back, get stripped again, break off again.
 * The hull damage still never heals, so each cycle starts from a worse place.
 */
export function shouldBreakOff(combatant: Combatant, shield: number): boolean {
  if (combatant.state === 'extend') return false;
  if (combatant.shipClass.shieldShare <= 0) return false;
  return combatant.health <= combatant.shipClass.breakOffAt && shield <= 0;
}

/**
 * Whether a broken-off ship has the room and the bank to come back in.
 *
 * Deliberately NOT the negation of shouldBreakOff: the two must never both be
 * true for the same ship in the same state, or it thrashes. They are kept as
 * separate predicates so that invariant can be asserted directly rather than
 * hoped for.
 */
export function shouldReAttack(combatant: Combatant, shield: number, shieldMax: number, range: number, reattackRange: number): boolean {
  if (combatant.state !== 'extend') return false;
  const recovered = shieldMax <= 0 || shield >= shieldMax * 0.9;
  return recovered && range > reattackRange;
}
