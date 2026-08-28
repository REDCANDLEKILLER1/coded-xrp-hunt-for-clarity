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
}

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
}

export interface PickupDef {
  key: string;
  label: string;
  sprite: SpriteRef;
  draw: Size;
  hitbox: Size;
  driftSpeed: number;
  effect: 'weapon_upgrade' | 'bomb' | 'repair' | 'shield';
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
  | 'sweep_beam';

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
