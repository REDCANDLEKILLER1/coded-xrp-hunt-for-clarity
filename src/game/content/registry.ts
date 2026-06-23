// Phase A content registry.
//
// Seeded with ONLY the current live content (player, regulator drone, basic
// projectile, burst-ring FX, clarity pulse). Values mirror the pre-Phase-A
// constants in Game2A exactly, so gameplay is unchanged — only the source of
// truth moves here. Future inventory keys (see docs/phase-2b-asset-inventory.md)
// are intentionally NOT wired into live play in Phase A.

import type { EnemyDef, FxDef, ProjectileDef, ShipDef, SpecialDef } from './types';

export const SHIPS: Record<string, ShipDef> = {
  player: {
    key: 'player',
    sprite: { category: 'ships', id: 'player' },
    draw: { w: 40, h: 48 },
    hitbox: { w: 38, h: 42 },
    speed: 340,
    hp: 3,
    fireRate: 0.14,
    weaponKey: 'bb_shot',
  },
};

export const ENEMIES: Record<string, EnemyDef> = {
  regulator_drone: {
    key: 'regulator_drone',
    sprite: { category: 'enemies', id: 'regulator_drone' },
    draw: { w: 36, h: 36 },
    hitbox: { w: 28, h: 26 },
    hp: 1,
    baseSpeed: 105,
    spawnRate: 0.72,
    score: 100,
  },
};

export const PROJECTILES: Record<string, ProjectileDef> = {
  bb_shot: {
    key: 'bb_shot',
    sprite: { category: 'projectiles', id: 'bb_shot' },
    draw: { w: 8, h: 24 },
    hitbox: { w: 5, h: 20 },
    speed: 720,
  },
};

export const FX: Record<string, FxDef> = {
  burst_ring: {
    key: 'burst_ring',
    sprite: { category: 'vfx', id: 'burst_ring' },
  },
};

export const SPECIALS: Record<string, SpecialDef> = {
  clarity_pulse: {
    key: 'clarity_pulse',
    radius: 165,
    // Manifest slot recorded for later; Phase A keeps the pulse procedural.
    sprite: { category: 'special', id: 'clarity_pulse' },
  },
};

/**
 * Pure data-validation used by the Phase A smoke test (scripts/validate-content.mjs).
 * Returns a list of human-readable problems; empty array means the registry is well-formed.
 * No DOM, no engine state — safe to run in plain Node.
 */
export function validateContent(): string[] {
  const errors: string[] = [];

  const checkSprite = (label: string, ref: { category: string; id: string }): void => {
    if (!ref.category) errors.push(`${label}: sprite.category is empty`);
    if (!ref.id) errors.push(`${label}: sprite.id is empty`);
  };
  const checkSize = (label: string, size: { w: number; h: number }): void => {
    if (!(size.w > 0)) errors.push(`${label}: draw/hitbox width must be > 0`);
    if (!(size.h > 0)) errors.push(`${label}: draw/hitbox height must be > 0`);
  };

  for (const [key, def] of Object.entries(SHIPS)) {
    if (def.key !== key) errors.push(`ships.${key}: key mismatch ("${def.key}")`);
    checkSprite(`ships.${key}`, def.sprite);
    checkSize(`ships.${key}.draw`, def.draw);
    checkSize(`ships.${key}.hitbox`, def.hitbox);
    if (!(def.speed > 0)) errors.push(`ships.${key}: speed must be > 0`);
    if (!(def.hp > 0)) errors.push(`ships.${key}: hp must be > 0`);
    if (!(def.fireRate > 0)) errors.push(`ships.${key}: fireRate must be > 0`);
    if (!PROJECTILES[def.weaponKey]) errors.push(`ships.${key}: weaponKey "${def.weaponKey}" has no ProjectileDef`);
  }

  for (const [key, def] of Object.entries(ENEMIES)) {
    if (def.key !== key) errors.push(`enemies.${key}: key mismatch ("${def.key}")`);
    checkSprite(`enemies.${key}`, def.sprite);
    checkSize(`enemies.${key}.draw`, def.draw);
    checkSize(`enemies.${key}.hitbox`, def.hitbox);
    if (!(def.hp > 0)) errors.push(`enemies.${key}: hp must be > 0`);
    if (!(def.baseSpeed > 0)) errors.push(`enemies.${key}: baseSpeed must be > 0`);
    if (!(def.spawnRate > 0)) errors.push(`enemies.${key}: spawnRate must be > 0`);
    if (!(def.score >= 0)) errors.push(`enemies.${key}: score must be >= 0`);
  }

  for (const [key, def] of Object.entries(PROJECTILES)) {
    if (def.key !== key) errors.push(`projectiles.${key}: key mismatch ("${def.key}")`);
    checkSprite(`projectiles.${key}`, def.sprite);
    checkSize(`projectiles.${key}.draw`, def.draw);
    checkSize(`projectiles.${key}.hitbox`, def.hitbox);
    if (!(def.speed > 0)) errors.push(`projectiles.${key}: speed must be > 0`);
  }

  for (const [key, def] of Object.entries(FX)) {
    if (def.key !== key) errors.push(`fx.${key}: key mismatch ("${def.key}")`);
    checkSprite(`fx.${key}`, def.sprite);
  }

  for (const [key, def] of Object.entries(SPECIALS)) {
    if (def.key !== key) errors.push(`specials.${key}: key mismatch ("${def.key}")`);
    if (!(def.radius > 0)) errors.push(`specials.${key}: radius must be > 0`);
    if (def.sprite) checkSprite(`specials.${key}`, def.sprite);
  }

  return errors;
}
