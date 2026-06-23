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
  /** ProjectileDef key this ship fires. */
  weaponKey: string;
}

export interface EnemyDef {
  key: string;
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
}

export interface ProjectileDef {
  key: string;
  sprite: SpriteRef;
  draw: Size;
  hitbox: Size;
  /** Travel speed magnitude (px/s). */
  speed: number;
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
