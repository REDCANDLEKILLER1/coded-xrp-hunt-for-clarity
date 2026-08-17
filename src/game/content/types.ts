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
}

export interface PickupDef {
  key: string;
  label: string;
  sprite: SpriteRef;
  draw: Size;
  hitbox: Size;
  driftSpeed: number;
  effect: 'weapon_upgrade' | 'bomb';
}

export interface StageDef {
  key: string;
  label: string;
  minWave: number;
  sky: string;
  accent: string;
  structure: string;
  scrollSpeed: number;
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
