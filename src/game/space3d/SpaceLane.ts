/**
 * The authored content of a transit leg, kept out of the renderer.
 *
 * A leg is the crossing between two planets, flown in the Regulatory Warship
 * the player takes at the end of the previous level. It is a whole level in
 * itself, not a corridor: squadrons are scrambled to intercept, they arrive
 * from any bearing, and the leg ends at whatever is waiting in orbit.
 *
 * Everything here names sprites that already ship in the manifest -- this
 * segment adds no art beyond the canopy. Depth and motion are what make it
 * read as 3D, not new assets.
 */

/** How a squadron behaves once it has closed. */
export type EngagePattern =
  /** Comes straight in, breaks off late, comes back around. The reading enemy. */
  | 'joust'
  /** Circles at fighting range, never committing. Must be turned onto. */
  | 'orbit'
  /** Sits off your tail and stays there. The reason the radar exists. */
  | 'tail'
  /** Holds at long range and shoots. Has to be chased down. */
  | 'stand_off';

export interface SpaceSquadron {
  /** Manifest id under `enemies`. */
  enemyKey: string;
  count: number;
  pattern: EngagePattern;
  /** Hits to kill. */
  hp: number;
  /** Cruise speed, world units per second. */
  speed: number;
  /** Range it tries to hold, in world units. */
  standoff: number;
  /** Seconds between shots. */
  fireInterval: number;
  /**
   * Seconds between homing missile launches, or absent for a squadron that
   * only has guns.
   *
   * Authored rather than derived from the pattern, so which squadrons carry
   * ordnance is a level-design decision that can be read off this table. It is
   * on the stand-off classes because they are the ones that hold at a range
   * their guns barely reach: a seeker is what gives them a reason to be feared
   * from out there, and a reason to be chased down.
   */
  missileInterval?: number;
  /** Seconds after the previous squadron before this one is scrambled. */
  delay: number;
  /** How far out it enters, in world units. */
  entryRange: number;
  score: number;
}

export interface SpaceBossAttack {
  key: 'spread' | 'lance' | 'swarm' | 'wall' | 'seekers';
  /** Seconds of telegraph before the shot leaves. A pattern you cannot see coming is not a pattern. */
  windUp: number;
  /** Seconds of recovery, during which the guard is down. */
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
  /** Range it manoeuvres to hold. */
  standoff: number;
  speed: number;
  /** Fixed attack order, so the fight can be learned rather than survived. */
  attacks: SpaceBossAttack[];
  /** Escorts launched when it drops below this fraction of its health. */
  escortAt: number;
  escortKey: string;
  escortCount: number;
}

export interface SpaceLeg {
  key: string;
  label: string;
  /** Where you are going. Shown on the nav screen. */
  destination: string;
  /** Manifest id under `backgrounds`, drawn as the deep field. */
  backdrop: string;
  squadrons: SpaceSquadron[];
  boss: SpaceBoss;
}

/**
 * The first transit: out of Ledger Prime's orbit in the captured warship.
 *
 * The order teaches before it tests. Jousters first, because a target that
 * comes to you is how you learn that closing size is distance; then orbiters,
 * which have to be turned onto rather than waited for; then a tail, which is
 * the first time the radar is the only thing that can save you; then stand-off
 * shooters that must be chased. The boss manoeuvres rather than parking.
 */
export const LEDGER_TRANSIT: SpaceLeg = {
  key: 'ledger_transit',
  label: 'TRANSIT — OUTBOUND',
  destination: 'XRPL CORE',
  backdrop: 'deep_space_lane',
  squadrons: [
    { enemyKey: 'regulator_drone', count: 3, pattern: 'joust', hp: 1, speed: 80, standoff: 840, fireInterval: 0, delay: 2.5, entryRange: 5400, score: 40 },
    { enemyKey: 'regulator_drone', count: 4, pattern: 'joust', hp: 1, speed: 85, standoff: 800, fireInterval: 3.0, delay: 14, entryRange: 5800, score: 40 },
    { enemyKey: 'fast_scout', count: 3, pattern: 'orbit', hp: 2, speed: 100, standoff: 1040, fireInterval: 2.6, delay: 15, entryRange: 6100, score: 60 },
    { enemyKey: 'fog_raider', count: 4, pattern: 'orbit', hp: 2, speed: 90, standoff: 960, fireInterval: 2.4, delay: 16, entryRange: 6100, score: 70 },
    { enemyKey: 'rug_fighter', count: 3, pattern: 'tail', hp: 3, speed: 100, standoff: 720, fireInterval: 2.2, delay: 16, entryRange: 5100, score: 85 },
    { enemyKey: 'whale_scout', count: 3, pattern: 'stand_off', hp: 4, speed: 70, standoff: 1800, fireInterval: 2.0, missileInterval: 9.0, delay: 17, entryRange: 6700, score: 120 },
    { enemyKey: 'fast_scout', count: 5, pattern: 'orbit', hp: 2, speed: 110, standoff: 1000, fireInterval: 2.1, delay: 16, entryRange: 6400, score: 60 },
    { enemyKey: 'rug_fighter', count: 4, pattern: 'tail', hp: 3, speed: 105, standoff: 680, fireInterval: 2.0, delay: 17, entryRange: 5400, score: 85 },
    { enemyKey: 'whale_scout', count: 4, pattern: 'stand_off', hp: 5, speed: 75, standoff: 1700, fireInterval: 1.9, missileInterval: 7.5, delay: 18, entryRange: 7000, score: 120 },
    { enemyKey: 'fog_raider', count: 6, pattern: 'joust', hp: 3, speed: 100, standoff: 840, fireInterval: 1.9, delay: 18, entryRange: 6400, score: 70 },
  ],
  boss: {
    spriteKey: 'cyber_battleship',
    label: 'GUARDIAN PROTOCOL',
    /**
     * Health, sized against the guns rather than guessed.
     *
     * The first number was 46, and holding the trigger on it killed it in nine
     * seconds -- the same way the top-down boss died in three. The guns fire
     * two rounds every 0.17s, so perfect aim is 11.8 hits/s; at the 0.85x the
     * guard averages, that is 10 points a second. A capital ship has to stand
     * up to about half a minute of PERFECT shooting, which with manoeuvring
     * and escorts is a real fight rather than a speed bump.
     */
    hp: 300,
    size: 320,
    standoff: 1900,
    speed: 52,
    // Fixed order, and every attack costs it its guard on the recovery.
    // Recoveries are deliberately shorter than the wind-ups: the guard is a
    // real defence, not a decoration that makes the fight longer on paper.
    attacks: [
      { key: 'spread', windUp: 1.25, recovery: 0.85, shots: 7 },
      { key: 'lance', windUp: 1.5, recovery: 1.0, shots: 3 },
      { key: 'swarm', windUp: 1.35, recovery: 0.9, shots: 5 },
      { key: 'wall', windUp: 1.6, recovery: 1.05, shots: 9 },
      // Ordnance. The long wind-up is the tell: it is the attack you are meant
      // to see coming and get your nose onto, because the seekers can be shot.
      { key: 'seekers', windUp: 2.1, recovery: 1.4, shots: 2 },
    ],
    escortAt: 0.5,
    escortKey: 'fast_scout',
    escortCount: 4,
  },
};

/** Rough flight time before the Guardian, at the authored delays. */
export function legRunSeconds(leg: SpaceLeg): number {
  return leg.squadrons.reduce((total, squadron) => total + squadron.delay, 0);
}
