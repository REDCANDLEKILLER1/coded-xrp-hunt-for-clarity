/**
 * The authored content of a space lane, kept out of the renderer.
 *
 * A lane is a run of waves flown into the screen, ending in a boss held at
 * range. Everything here names sprites that already ship in the manifest --
 * this segment adds no art. Depth is what makes it read as 3D, not new assets.
 */

/** How a formation is arranged in the plane it spawns on. */
export type FormationShape = 'line' | 'vee' | 'column' | 'ring' | 'pair';

/** How a squad behaves once it is in the lane. */
export type FlightPattern =
  /** Holds its lane and closes. The reading enemy: teaches the depth cue. */
  | 'straight'
  /** Slides across the lane as it closes, so a held aim misses. */
  | 'weave'
  /** Tracks the player's lateral position. Must be out-turned, not out-waited. */
  | 'chase'
  /** Loops out wide and comes back down the flank. */
  | 'flank';

export interface SpaceWave {
  /** Manifest id under `enemies`. */
  enemyKey: string;
  count: number;
  shape: FormationShape;
  pattern: FlightPattern;
  /** Hits to kill at base firepower. */
  hp: number;
  /** World units per second of closing speed. */
  speed: number;
  /** Seconds between shots; 0 means the squad never fires. */
  fireInterval: number;
  /** Seconds to hold before the next wave spawns. */
  gap: number;
  /** Half-width of the spawn spread, in world units. */
  spread: number;
  score: number;
}

export interface SpaceBossAttack {
  key: 'spread' | 'lance' | 'swarm' | 'wall';
  /** Seconds of telegraph before the shot leaves. A pattern you cannot see coming is not a pattern. */
  windUp: number;
  /** Seconds of recovery, during which the boss is exposed. */
  recovery: number;
  shots: number;
}

export interface SpaceBoss {
  /** Manifest id under `bosses`. */
  spriteKey: string;
  label: string;
  hp: number;
  /** World size of the hull. */
  size: number;
  /** Depth it holds at. */
  holdZ: number;
  /** Fixed attack order, so the fight can be learned rather than survived. */
  attacks: SpaceBossAttack[];
  /** Escorts launched when the boss drops below this fraction of its health. */
  escortAt: number;
  escortKey: string;
  escortCount: number;
}

export interface SpaceLane {
  key: string;
  label: string;
  /** Manifest id under `backgrounds`, drawn as the far plane. */
  backdrop: string;
  waves: SpaceWave[];
  boss: SpaceBoss;
}

/**
 * The first lane: leaving Ledger Prime's orbit for open space.
 *
 * The wave order teaches before it tests. Straight runners first, so the
 * closing-scale cue is learned on something that does not dodge; then weavers,
 * which punish a held aim; then chasers, which punish standing still; then the
 * mix. The boss is last and its attacks run in a fixed order.
 */
export const ORBITAL_LANE: SpaceLane = {
  key: 'orbital_lane',
  label: 'ORBITAL LANE',
  backdrop: 'deep_space_lane',
  waves: [
    { enemyKey: 'regulator_drone', count: 4, shape: 'line', pattern: 'straight', hp: 1, speed: 300, fireInterval: 0, gap: 1.6, spread: 150, score: 40 },
    { enemyKey: 'regulator_drone', count: 5, shape: 'vee', pattern: 'straight', hp: 1, speed: 330, fireInterval: 2.6, gap: 1.5, spread: 175, score: 40 },
    { enemyKey: 'fast_scout', count: 4, shape: 'pair', pattern: 'weave', hp: 1, speed: 400, fireInterval: 2.2, gap: 1.5, spread: 200, score: 60 },
    { enemyKey: 'fog_raider', count: 5, shape: 'line', pattern: 'weave', hp: 2, speed: 340, fireInterval: 2.0, gap: 1.4, spread: 210, score: 70 },
    { enemyKey: 'rug_fighter', count: 4, shape: 'column', pattern: 'chase', hp: 2, speed: 360, fireInterval: 1.9, gap: 1.5, spread: 160, score: 85 },
    { enemyKey: 'fast_scout', count: 6, shape: 'ring', pattern: 'flank', hp: 2, speed: 420, fireInterval: 1.8, gap: 1.4, spread: 230, score: 60 },
    { enemyKey: 'whale_scout', count: 3, shape: 'vee', pattern: 'chase', hp: 4, speed: 300, fireInterval: 1.7, gap: 1.6, spread: 185, score: 120 },
    { enemyKey: 'fog_raider', count: 6, shape: 'ring', pattern: 'weave', hp: 2, speed: 380, fireInterval: 1.6, gap: 1.5, spread: 240, score: 70 },
    { enemyKey: 'rug_fighter', count: 5, shape: 'line', pattern: 'flank', hp: 3, speed: 400, fireInterval: 1.5, gap: 1.4, spread: 220, score: 85 },
    { enemyKey: 'whale_scout', count: 4, shape: 'vee', pattern: 'chase', hp: 5, speed: 330, fireInterval: 1.4, gap: 2.2, spread: 200, score: 120 },
  ],
  boss: {
    spriteKey: 'clarity_destroyer_phase3',
    label: 'REGULATORY DESTROYER',
    hp: 46,
    size: 210,
    holdZ: 620,
    // Fixed order, and every attack costs the boss its guard on the recovery.
    // Recoveries are deliberately shorter than the wind-ups: the guard is a
    // real defence, not a decoration that makes the fight longer on paper.
    attacks: [
      { key: 'spread', windUp: 1.15, recovery: 0.85, shots: 7 },
      { key: 'lance', windUp: 1.4, recovery: 1.0, shots: 3 },
      { key: 'swarm', windUp: 1.25, recovery: 0.9, shots: 5 },
      { key: 'wall', windUp: 1.5, recovery: 1.05, shots: 9 },
    ],
    escortAt: 0.5,
    escortKey: 'fast_scout',
    escortCount: 4,
  },
};

/** Total flight time before the boss, at the authored gaps. */
export function laneRunSeconds(lane: SpaceLane): number {
  return lane.waves.reduce((total, wave) => total + wave.gap, 0);
}
