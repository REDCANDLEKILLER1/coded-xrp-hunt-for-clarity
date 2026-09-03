/**
 * What each ground emplacement actually does, as opposed to what its label says.
 *
 * Every firing hazard in the game -- turret, cannon, laser tower, missile silo,
 * plasma gun -- ran the same three lines: normalise the vector to the player,
 * push one `enemy_missile` at `projectileSpeed`, damage 1. A "laser tower" and
 * a "missile silo" were the same object with different art and a different
 * number, so there was nothing to learn and nothing to play around.
 *
 * The point of ground threats is not extra bullets. It is **forcing movement**:
 * a silo that makes you turn, a beam that makes you leave a lane, a plasma
 * curtain that denies an area. What makes that interesting is that the enemy
 * SHIPS then exploit the movement it forced. So each emplacement here answers
 * "where does this make the player go?", not "how much damage does it do?".
 */

export type GroundAttack =
  /** Fast, leads the player. You cannot simply strafe past it. */
  | 'predictive'
  /** One slow heavy shell, announced first. Big dodge window, big cost. */
  | 'heavy'
  /** Two shells that bracket you, so the gap between them is the answer. */
  | 'bracket'
  /** Telegraphed line, then a real beam along it. Leave the lane. */
  | 'beam'
  /** A missile that turns. Beatable by flying, not by tanking. */
  | 'seeker'
  /** A spread across a band that denies ground rather than aiming at you. */
  | 'curtain';

export interface GroundDoctrine {
  key: string;
  label: string;
  attack: GroundAttack;
  /** Rounds per volley. */
  rounds: number;
  /** Seconds between volleys. */
  interval: number;
  /** Visible wind-up before the attack lands. 0 for none. */
  telegraph: number;
  damage: number;
  /** Multiplies the hazard's authored projectileSpeed. */
  speedScale: number;
  /** Drawn size of a round. */
  size: number;
  projectileKey: string;
  /** Radians a seeker may turn per second. 0 for everything else. */
  turnRate: number;
  /** Seconds a beam stays lethal once it fires. 0 for everything else. */
  beamLife: number;
  /** Width of the band a curtain covers, as a fraction of screen width. */
  curtainSpan: number;
}

export const GROUND_DOCTRINES: Record<string, GroundDoctrine> = {
  // Cheap and quick, but it shoots where you are GOING. The one that punishes
  // holding a straight line.
  basic_turret: {
    key: 'basic_turret',
    label: 'PREDICTIVE',
    attack: 'predictive',
    rounds: 1,
    interval: 1.05,
    telegraph: 0,
    damage: 1,
    speedScale: 1.15,
    size: 8,
    projectileKey: 'enemy_red_bullet',
    turnRate: 0,
    beamLife: 0,
    curtainSpan: 0,
  },
  // One heavy shell, announced. The dodge window is the design.
  cannon_turret: {
    key: 'cannon_turret',
    label: 'SIEGE SHELL',
    attack: 'heavy',
    rounds: 1,
    interval: 2.0,
    telegraph: 0.6,
    damage: 2,
    speedScale: 0.8,
    size: 16,
    projectileKey: 'enemy_missile',
    turnRate: 0,
    beamLife: 0,
    curtainSpan: 0,
  },
  // Two shells that straddle you. Standing still is wrong and so is a small
  // step -- the answer is to commit to one side.
  cannon_tower: {
    key: 'cannon_tower',
    label: 'BRACKETING FIRE',
    attack: 'bracket',
    rounds: 2,
    interval: 2.3,
    telegraph: 0.7,
    damage: 2,
    speedScale: 0.85,
    size: 14,
    projectileKey: 'enemy_missile',
    turnRate: 0,
    beamLife: 0,
    curtainSpan: 0,
  },
  // Draws the line it is about to fire down, then fires down it. Nothing to
  // dodge once it is live: you had to have left the lane already.
  laser_tower: {
    key: 'laser_tower',
    label: 'BEAM',
    attack: 'beam',
    rounds: 1,
    interval: 2.6,
    telegraph: 0.85,
    damage: 2,
    speedScale: 1,
    size: 0,
    projectileKey: 'enemy_red_bullet',
    turnRate: 0,
    beamLife: 0.45,
    curtainSpan: 0,
  },
  // A missile that turns. Bounded, so out-flying it is a real option and
  // tanking it is not.
  missile_silo: {
    key: 'missile_silo',
    label: 'SEEKER',
    attack: 'seeker',
    rounds: 1,
    interval: 2.8,
    telegraph: 0.35,
    damage: 2,
    speedScale: 0.7,
    size: 12,
    projectileKey: 'enemy_missile',
    turnRate: 1.5,
    beamLife: 0,
    curtainSpan: 0,
  },
  // Does not aim at you at all. Denies a band of the screen, which is what
  // makes it combine with ships -- it decides where you are allowed to be.
  plasma_turret: {
    key: 'plasma_turret',
    label: 'PLASMA CURTAIN',
    attack: 'curtain',
    rounds: 4,
    interval: 2.1,
    telegraph: 0.4,
    damage: 1,
    speedScale: 0.75,
    size: 11,
    projectileKey: 'enemy_red_bullet',
    turnRate: 0,
    beamLife: 0,
    curtainSpan: 0.42,
  },
};

/** Emplacements with no doctrine keep the plain aimed shot. */
export function groundDoctrineFor(key: string): GroundDoctrine | null {
  return GROUND_DOCTRINES[key] ?? null;
}

export interface GroundRound {
  /** Absolute firing angle, radians. */
  angle: number;
  /** Lateral offset from the emplacement, px. */
  offset: number;
}

/**
 * The rounds one volley puts out.
 *
 * `aim` is already led for `predictive` and `seeker`; the caller does that so
 * this stays pure. `spanPx` is the screen width a curtain spreads across.
 *
 * A curtain is the only shape that ignores the aim entirely -- it is area
 * denial, so pointing it at the player would defeat the purpose.
 */
export function groundRounds(doctrine: GroundDoctrine, aim: number, spanPx: number): GroundRound[] {
  switch (doctrine.attack) {
    case 'bracket': {
      // Straddle: equal and opposite, so the gap is dead centre on the player
      // and the answer is to pick a side rather than to freeze.
      const half = 0.22;
      return [{ angle: aim - half, offset: 0 }, { angle: aim + half, offset: 0 }];
    }
    case 'curtain': {
      // Fixed fan downward across a band, independent of where the player is.
      const rounds: GroundRound[] = [];
      const middle = (doctrine.rounds - 1) / 2;
      for (let i = 0; i < doctrine.rounds; i += 1) {
        rounds.push({ angle: Math.PI / 2, offset: ((i - middle) / Math.max(1, middle)) * (spanPx / 2) });
      }
      return rounds;
    }
    case 'predictive':
    case 'heavy':
    case 'seeker':
    case 'beam':
    default:
      return [{ angle: aim, offset: 0 }];
  }
}

/**
 * Turn a seeker toward its target, by at most `turnRate` radians this frame.
 *
 * Bounded on purpose. A missile that snaps to its target cannot be beaten by
 * flying, and beating it by flying is the only reason it is more interesting
 * than a faster bullet. Returns the new heading.
 */
export function steerSeeker(heading: number, toTarget: number, turnRate: number, dt: number): number {
  let delta = toTarget - heading;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  const limit = turnRate * dt;
  const step = Math.max(-limit, Math.min(limit, delta));
  return heading + step;
}

/** How close to a beam's line counts as being hit, in px. */
export const BEAM_HALF_WIDTH = 7;

/**
 * Distance from a point to an infinite ray, for beam hit tests.
 *
 * A ray rather than a segment: the beam leaves the emplacement and continues
 * off the screen, so anything in front of it is hit and anything behind it is
 * not. Using a plain line would let the tower kill things standing behind it.
 */
export function distanceToRay(
  origin: { x: number; y: number },
  angle: number,
  point: { x: number; y: number },
): number {
  const dx = point.x - origin.x;
  const dy = point.y - origin.y;
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  const along = dx * ux + dy * uy;
  if (along <= 0) return Math.hypot(dx, dy);
  return Math.abs(dx * uy - dy * ux);
}
