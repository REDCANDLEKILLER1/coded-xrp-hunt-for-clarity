// Phase A content type definitions.
//
// These describe game content as data so the engine can read it from records
// instead of scattered constants and inline manifest keys. Phase A only seeds
// the current live content; later phases add more records of the same shape.

/** Points at a manifest entry resolved through AssetLoader / SpriteRenderer. */
export interface SpriteRef {
  category: string;
  id: string;
}

export interface Size {
  w: number;
  h: number;
}

export interface ShipDef {
  key: string;
  label: string;
  accent: string;
  sprite: SpriteRef;
  /** On-screen draw size. */
  draw: Size;
  /** Collision box size. */
  hitbox: Size;
  /** Keyboard movement speed (px/s). */
  speed: number;
  hp: number;
  /** Seconds between auto-fire shots. */
  fireRate: number;
  /** WeaponDef key this ship starts with. */
  weaponKey: string;
  /** What makes this hull worth picking. */
  loadout: ShipLoadout;
}

/**
 * Each hull leans one way so the ship-select screen is a real decision rather
 * than three colours of the same fighter.
 */
export interface ShipLoadout {
  /** Shield segments carried from launch, and the base maximum. */
  shield: number;
  /** Weapon-ladder rung this hull launches on (1-based). */
  weaponTier: number;
  /** Bombs carried from launch, on top of the shared starting stock. */
  bombs: number;
  /** Multiplier on clarity-pulse radius and charge rate. */
  pulse: number;
}

export interface EnemyDef {
  key: string;
  /** Short HUD/debug name. */
  label: string;
  sprite: SpriteRef;
  draw: Size;
  hitbox: Size;
  hp: number;
  /** Base downward speed (px/s) before per-wave scaling. */
  baseSpeed: number;
  /** Base seconds between spawns before per-wave scaling. */
  spawnRate: number;
  /** Score awarded when destroyed. */
  score: number;
  /** First wave where the director may spawn this enemy. */
  minWave: number;
  /** Relative selection weight once the enemy is unlocked. */
  spawnWeight: number;
  /** Named movement routine handled by the wave combat loop. */
  behavior: 'straight' | 'sine' | 'zigzag' | 'dive';
  /** Seconds between shots while holding station. Omit for an unarmed enemy. */
  fireRate?: number;
  /** Travel speed of this enemy's shots (px/s). */
  projectileSpeed?: number;
  /** Visual identifier used while enemy variants share a temporary sprite. */
  accent: string;
  /**
   * How this ship fights.
   *
   * Every armed enemy used to fire the same thing: one aimed `enemy_missile`,
   * differing only in cadence and accent colour, so a roster that reads as six
   * ships played as one. The doctrine names the weapon; the table that gives
   * it shots, spread, speed and a projectile lives in the engine beside the
   * movement tactics it has to agree with.
   *
   * Omit for an unarmed hull.
   */
  doctrine?: EnemyDoctrine;
  /**
   * How big this ship is, and therefore how much punishment it carries.
   *
   * Every enemy drew at 19-23px -- within four pixels of each other -- so a
   * roster of five ships had no battlefield hierarchy at all: nothing on
   * screen told you which contact was the dangerous one.
   *
   * The class scales the DRAW BOX AND THE HITBOX TOGETHER, in `scaleCombatants`,
   * which is the only place either is computed, so they cannot drift apart and
   * leave a ship hit by shots that visibly missed it.
   *
   * A heavy is NOT a boss. No health bar, no phases, no attack script, no
   * capture logic -- a regular hull that happens to be big.
   */
  hull: HullClass;
}

/**
 * The five things an enemy can be holding.
 *
 * - `pressure`  fast single shots that make you keep moving.
 * - `burst`     a tight three-round fan; accurate, forces a dodge.
 * - `salvo`     one slow tracking missile. Priority target.
 * - `broadside` a wide five-round fan for area denial.
 */
export type EnemyDoctrine = 'pressure' | 'burst' | 'salvo' | 'broadside';

/**
 * Size class for a regular 2D enemy hull.
 *
 * Deliberately not the same vocabulary as the 3D leg's `ShipClassKey`
 * (chaff / missile_boat / heavy_fighter / interceptor / gunboat), which
 * describes a ROLE. This describes a SIZE: a light can be a missile boat.
 */
export type HullClass = 'light' | 'medium' | 'heavy';

export interface ProjectileDef {
  key: string;
  sprite: SpriteRef;
  draw: Size;
  hitbox: Size;
  /** Travel speed magnitude (px/s). */
  speed: number;
}

export interface WeaponShotDef {
  /** Horizontal spawn offset from the ship center. */
  offsetX: number;
  /** Direction in radians from straight up; negative is left. */
  angle: number;
}

export interface WeaponDef {
  key: string;
  label: string;
  tier: number;
  projectileKey: string;
  /** Seconds between volleys. */
  fireRate: number;
  damage: number;
  shots: WeaponShotDef[];
  /** Extra targets a single bolt punches through before it dies. */
  pierce?: number;
  /**
   * Blast radius in pixels. A rocket damages what it lands near, so a shell
   * that misses down a lane still contributes -- which is what makes the
   * family an answer to spread-out targets rather than a worse single lane.
   */
  splash?: number;
  /** Damage dealt inside `splash` to everything that was not hit directly. */
  splashDamage?: number;
  /** How many further targets an arc jumps to after the one it hit. */
  chain?: number;
  /**
   * Family name, used only to pick how a bolt is DRAWN.
   *
   * Deliberately a loose string: the arcade ladder and the campaign armory
   * have different family vocabularies that overlap but are not the same set,
   * and the renderer only asks whether this bolt is a rocket or a plasma.
   * LadderWeaponDef narrows it to the ladder's own union, where it is a real
   * design field rather than a drawing hint.
   */
  family?: string;
  /**
   * Deletes hostile shots it touches, INCLUDING the ones no other gun can
   * intercept. A plasma lane is a moving hole in a fog wall, which is a
   * defensive answer no other family offers.
   */
  clearsShots?: boolean;
}

/**
 * A rung of the arcade weapon ladder.
 *
 * Separate from WeaponDef because Chapter One's campaign armory also produces
 * WeaponDefs, and the two have DIFFERENT and incompatible ideas of a family:
 * the ladder's is starter/pulse/rocket/plasma/elite, the armory's is
 * bb/pulse/rocket/plasma/ledger, indexed by position in a saved game. Putting
 * both on one interface made a saved armory family unassignable to a ladder
 * family, which is TypeScript correctly reporting that they are not the same
 * concept. `laneStep` is here for the same reason: the armory bypasses barrel
 * expansion entirely, so a lane width would be a field it must never read.
 */
export interface LadderWeaponDef extends WeaponDef {
  family: WeaponFamily;
  /**
   * Pixels between lanes when a barrel adds one.
   *
   * Per family, because a family's identity is partly its pattern width: a
   * storm wants tight overlapping lanes, a pulse wants reach.
   */
  laneStep: number;
}

/**
 * The five weapon families.
 *
 * `starter` is plain parallel lanes -- coverage. `pulse` pierces. `rocket`
 * splashes. `plasma` eats incoming fire. `elite` combines.
 */
export type WeaponFamily = 'starter' | 'pulse' | 'rocket' | 'plasma' | 'elite';

export interface PickupDef {
  key: string;
  label: string;
  sprite: SpriteRef;
  draw: Size;
  hitbox: Size;
  driftSpeed: number;
  effect: 'weapon_upgrade' | 'bomb' | 'repair' | 'shield';
  /**
   * The colour a pickup is READ by, not the colour of its art.
   *
   * The four pickup icons were all drawn as a green glyph inside the same blue
   * ring, so in flight at 22px they are one indistinguishable object and every
   * effect looks like the wrong one. The renderer paints this aura around the
   * sprite so the effect is legible before you touch it. Must be unique.
   */
  tint: string;
  /** Two or three characters stamped under the aura. Must be unique. */
  tag: string;
}

export interface StageDef {
  key: string;
  label: string;
  background: SpriteRef;
  minWave: number;
  sky: string;
  accent: string;
  structure: string;
  scrollSpeed: number;
}

export interface HazardDef {
  key: string;
  label: string;
  sprite: SpriteRef;
  draw: Size;
  hitbox: Size;
  hp: number;
  minWave: number;
  spawnRate: number;
  fireRate: number;
  projectileSpeed: number;
  score: number;
  accent: string;
  spawnWeight: number;
  placement: 'edge' | 'lane';
  fires: boolean;
}

export interface EnvironmentPropDef {
  key: string;
  label: string;
  sprite: SpriteRef;
  draw: Size;
  stages: string[];
}

export type BossAttackPattern = 'aimed' | 'spread' | 'sweep' | 'burst';

/**
 * One move in a boss's attack script.
 *
 * The fight used to be a single aimed stream on a timer, which is not a
 * pattern -- there is nothing to read and nothing to learn, so it is both
 * easy and unfair at once. Each of these telegraphs, fires, then leaves the
 * boss open, and a phase runs them in a fixed order so the order can be
 * learned.
 */
export type BossAttackKey =
  | 'aimed_volley'
  | 'fog_wall'
  | 'radial'
  | 'charge'
  | 'sweep_beam'
  /**
   * Launches escorts and raises a shield behind them. The boss cannot be hurt
   * while any escort is alive, so the answer is to clear the screen rather
   * than to keep holding fire on a target that auto-aim was hitting anyway.
   */
  | 'escort_screen';

export interface BossPhaseDef {
  /** Remaining-health ratio at or below which this phase becomes active. */
  hpThreshold: number;
  moveSpeed: number;
  fireRate: number;
  projectileSpeed: number;
  projectileCount: number;
  spread: number;
  pattern: BossAttackPattern;
  accent: string;
  /**
   * Ordered attack script for this phase. A phase without one falls back to
   * the old timed volley, so bosses that have not been authored yet are
   * unchanged.
   */
  attacks?: BossAttackKey[];
}

export interface BossDef {
  key: string;
  label: string;
  sprite: SpriteRef;
  draw: Size;
  hitbox: Size;
  hp: number;
  triggerWave: number;
  score: number;
  phases: BossPhaseDef[];
}

export interface FxDef {
  key: string;
  sprite: SpriteRef;
}

export interface SpecialDef {
  key: string;
  /** Effect radius (px). */
  radius: number;
  /** Manifest slot recorded for later use; not drawn in Phase A. */
  sprite?: SpriteRef;
}
