/**
 * How each enemy class actually attacks.
 *
 * Before this, every regular enemy in the top-down game fired through one
 * routine: aim at the player, emit `burst` rounds separated by `spread`, all of
 * them drawn as `enemy_missile`. The only things that differed between a drone
 * and a heavy fighter were a cadence number and a burst count, so the roster
 * looked varied and played identically. A player could not tell what was
 * shooting at them without reading the sprite.
 *
 * The rule here: **you should recognise the threat from the shape of its fire.**
 * Each doctrine puts a different pattern on the screen -- a pair of parallel
 * chips, a snap burst as something crosses your nose, shots led ahead of where
 * you are going, one heavy telegraphed round, or a steady alternating drum.
 *
 * Everything is data, and the geometry is pure functions, so the patterns can
 * be checked without a canvas.
 */

/** How a volley is laid out relative to the aim line. */
export type VolleyShape =
  /** Parallel columns, no angular spread. Chip damage that tracks you. */
  | 'parallel'
  /** Several rounds down one line in quick succession. */
  | 'burst'
  /** Two rounds aimed where the player is GOING, crossing ahead of them. */
  | 'crossing'
  /** One heavy round, telegraphed before it leaves. */
  | 'heavy'
  /** Left gun, then right gun, then left again. Never stops. */
  | 'alternating';

export interface EnemyDoctrine {
  key: string;
  label: string;
  shape: VolleyShape;
  /** Rounds in one volley. */
  rounds: number;
  /** Seconds between rounds WITHIN a volley. 0 fires them on the same frame. */
  roundGap: number;
  /** Seconds between volleys. */
  interval: number;
  /** Lateral offset between parallel/alternating barrels, in pixels. */
  barrelOffset: number;
  /** Angular spread for crossing fire, radians. Never used to fan chip damage. */
  crossAngle: number;
  /** Seconds of visible wind-up before a heavy round leaves. 0 for none. */
  telegraph: number;
  damage: number;
  /** Multiplies the enemy's authored projectileSpeed. */
  speedScale: number;
  /** Manifest projectile art. */
  projectileKey: string;
  /** Drawn size of the round, px. */
  size: number;
  /**
   * May this class shoot while it is still flying in?
   *
   * Enemies previously could not fire until they had reached station, which
   * with the initial timer meant 0.68-3.0s of guaranteed safety after arriving.
   * Classes that are supposed to feel like an ambush now open fire on the way.
   */
  firesWhileEntering: boolean;
  /**
   * Seconds before this ship's FIRST shot, absolute rather than a fraction of
   * its cadence. Held short and explicit so time-to-danger is a tuned number
   * rather than an accident of fire rate.
   */
  firstShotDelay: number;
  /** Holds fire until the end of its movement beat, for rhythm classes. */
  requiresRest: boolean;
}

/**
 * One doctrine per class.
 *
 * Read the `shape` column top to bottom: no two classes put the same pattern on
 * screen, which is the entire point.
 */
export const DOCTRINES: Record<string, EnemyDoctrine> = {
  // Constant, cheap chip pressure from a pair of parallel barrels. It is the
  // first thing that shoots at you and the thing that never quite stops.
  regulator_drone: {
    key: 'regulator_drone',
    label: 'TWIN PULSE',
    shape: 'parallel',
    rounds: 2,
    roundGap: 0,
    interval: 1.5,
    barrelOffset: 7,
    crossAngle: 0,
    telegraph: 0,
    damage: 1,
    speedScale: 1,
    projectileKey: 'enemy_red_bullet',
    size: 7,
    firesWhileEntering: true,
    firstShotDelay: 0.45,
    requiresRest: false,
  },
  // Shoots as it crosses, then is gone. Three rounds down one line, fast
  // enough to read as a single stitch of fire rather than three bullets.
  fast_scout: {
    key: 'fast_scout',
    label: 'SNAP BURST',
    shape: 'burst',
    rounds: 3,
    roundGap: 0.07,
    interval: 2.2,
    barrelOffset: 0,
    crossAngle: 0,
    telegraph: 0,
    damage: 1,
    speedScale: 1.35,
    projectileKey: 'enemy_red_bullet',
    size: 6,
    firesWhileEntering: true,
    firstShotDelay: 0.3,
    requiresRest: false,
  },
  // Shoots where you are GOING, not where you are. Two rounds that cross ahead
  // of your track, so holding a straight line is what gets you hit.
  fog_raider: {
    key: 'fog_raider',
    label: 'CROSSING FIRE',
    shape: 'crossing',
    rounds: 2,
    roundGap: 0,
    interval: 1.9,
    barrelOffset: 10,
    crossAngle: 0.13,
    telegraph: 0,
    damage: 1,
    speedScale: 1.15,
    projectileKey: 'enemy_missile',
    size: 9,
    firesWhileEntering: false,
    firstShotDelay: 0.7,
    requiresRest: false,
  },
  // One heavy round, announced before it leaves. The telegraph is the whole
  // design: this is the shot you are supposed to see coming and move out of,
  // which is only fair because it hurts twice as much as anything else.
  rug_fighter: {
    key: 'rug_fighter',
    label: 'SIEGE CANNON',
    shape: 'heavy',
    rounds: 1,
    roundGap: 0,
    interval: 2.4,
    barrelOffset: 0,
    crossAngle: 0,
    telegraph: 0.55,
    damage: 2,
    speedScale: 0.85,
    projectileKey: 'enemy_missile',
    size: 15,
    firesWhileEntering: false,
    firstShotDelay: 0.9,
    requiresRest: false,
  },
  // Left gun, right gun, left gun. Slow, but it never stops, so leaving one
  // alive on the screen costs you steadily.
  whale_scout: {
    key: 'whale_scout',
    label: 'ALTERNATING GUNS',
    shape: 'alternating',
    rounds: 1,
    roundGap: 0,
    interval: 0.85,
    barrelOffset: 11,
    crossAngle: 0,
    telegraph: 0,
    damage: 1,
    speedScale: 0.95,
    projectileKey: 'enemy_red_bullet',
    size: 8,
    firesWhileEntering: false,
    firstShotDelay: 0.6,
    requiresRest: false,
  },
};

/** Falls back to the drone's doctrine so an unknown key still behaves. */
export function doctrineFor(enemyKey: string): EnemyDoctrine {
  return DOCTRINES[enemyKey] ?? DOCTRINES.regulator_drone;
}

export interface Round {
  /** Offset from the muzzle, perpendicular to the aim line. */
  offset: number;
  /** Firing angle, radians. */
  angle: number;
  /** Seconds after the volley starts that this round leaves. */
  delay: number;
}

/**
 * Where a target will be when a round reaches it.
 *
 * Used only by `crossing`. This is the same intercept idea as the 3D lead
 * pipper, flattened to two dimensions: solve for the time the round and the
 * target arrive together, then aim there.
 *
 * Returns the ORIGINAL aim when there is no solution -- a target outrunning the
 * round, or a degenerate speed. Leading is an enhancement, and an enemy that
 * simply stopped shooting when the maths ran out would read as broken.
 */
export function leadAngle(
  from: { x: number; y: number },
  target: { x: number; y: number; vx: number; vy: number },
  speed: number,
): number {
  const dx = target.x - from.x;
  const dy = target.y - from.y;
  const direct = Math.atan2(dy, dx);
  const a = target.vx * target.vx + target.vy * target.vy - speed * speed;
  const b = 2 * (dx * target.vx + dy * target.vy);
  const c = dx * dx + dy * dy;
  let t: number | null = null;
  if (Math.abs(a) < 1e-6) {
    if (Math.abs(b) > 1e-6) {
      const linear = -c / b;
      if (linear > 0) t = linear;
    }
  } else {
    const disc = b * b - 4 * a * c;
    if (disc >= 0) {
      const root = Math.sqrt(disc);
      const t1 = (-b + root) / (2 * a);
      const t2 = (-b - root) / (2 * a);
      const positive = [t1, t2].filter((v) => v > 0);
      if (positive.length > 0) t = Math.min(...positive);
    }
  }
  if (t === null || !Number.isFinite(t) || t > 3) return direct;
  return Math.atan2(dy + target.vy * t, dx + target.vx * t);
}

/**
 * The rounds a volley puts on the screen.
 *
 * `sequence` counts volleys fired by this ship, which is what lets
 * `alternating` swap barrels between volleys rather than within one.
 *
 * NOTHING HERE FANS. `crossing` is the only shape with an angle, and it
 * converges ahead of the player rather than spraying outward -- the same
 * lesson as the player's own weapon ladder, applied to the enemies.
 */
export function volleyRounds(doctrine: EnemyDoctrine, aim: number, sequence: number): Round[] {
  const rounds: Round[] = [];
  switch (doctrine.shape) {
    case 'parallel': {
      const middle = (doctrine.rounds - 1) / 2;
      for (let i = 0; i < doctrine.rounds; i += 1) {
        rounds.push({ offset: (i - middle) * doctrine.barrelOffset, angle: aim, delay: i * doctrine.roundGap });
      }
      return rounds;
    }
    case 'burst': {
      for (let i = 0; i < doctrine.rounds; i += 1) {
        rounds.push({ offset: 0, angle: aim, delay: i * doctrine.roundGap });
      }
      return rounds;
    }
    case 'crossing': {
      // Two rounds toed IN, so they converge on the lead point rather than
      // spreading away from it. A pair that diverges is the fan mistake.
      const middle = (doctrine.rounds - 1) / 2;
      for (let i = 0; i < doctrine.rounds; i += 1) {
        const side = i - middle;
        rounds.push({
          offset: side * doctrine.barrelOffset,
          angle: aim - side * doctrine.crossAngle,
          delay: i * doctrine.roundGap,
        });
      }
      return rounds;
    }
    case 'heavy':
      return [{ offset: 0, angle: aim, delay: 0 }];
    case 'alternating':
    default: {
      const side = sequence % 2 === 0 ? -1 : 1;
      return [{ offset: side * doctrine.barrelOffset, angle: aim, delay: 0 }];
    }
  }
}

/** True when this class may shoot from its current stance. */
export function mayFire(doctrine: EnemyDoctrine, stance: string, atRest: boolean): boolean {
  if (stance === 'fleeing') return false;
  if (stance === 'entering') return doctrine.firesWhileEntering;
  if (doctrine.requiresRest && stance === 'holding' && !atRest) return false;
  return stance === 'holding' || stance === 'diving';
}
