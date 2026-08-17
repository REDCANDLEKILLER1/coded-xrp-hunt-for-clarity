// Phase A content registry.
//
// Seeded with ONLY the current live content (player, regulator drone, basic
// projectile, burst-ring FX, clarity pulse). Values mirror the pre-Phase-A
// constants in Game2A exactly, so gameplay is unchanged — only the source of
// truth moves here. Future inventory keys (see docs/phase-2b-asset-inventory.md)
// are intentionally NOT wired into live play in Phase A.

import type { EnemyDef, FxDef, PickupDef, ProjectileDef, ShipDef, SpecialDef, WeaponDef } from './types';
import { availableEnemyKeys, selectEnemyKey, spawnInterval } from './WaveDirector';

export const SHIPS: Record<string, ShipDef> = {
  player: {
    key: 'player',
    sprite: { category: 'ships', id: 'player' },
    draw: { w: 40, h: 48 },
    hitbox: { w: 38, h: 42 },
    speed: 340,
    hp: 3,
    fireRate: 0.14,
    weaponKey: 'tier_1_bb',
  },
};

export const ENEMIES: Record<string, EnemyDef> = {
  regulator_drone: {
    key: 'regulator_drone',
    label: 'REGULATOR',
    sprite: { category: 'enemies', id: 'regulator_drone' },
    draw: { w: 36, h: 36 },
    hitbox: { w: 28, h: 26 },
    hp: 1,
    baseSpeed: 105,
    spawnRate: 0.72,
    score: 100,
    minWave: 1,
    spawnWeight: 8,
    behavior: 'sine',
    accent: '#ff3355',
  },
  fog_raider: {
    key: 'fog_raider',
    label: 'FOG RAIDER',
    sprite: { category: 'enemies', id: 'regulator_drone' },
    draw: { w: 34, h: 34 },
    hitbox: { w: 27, h: 25 },
    hp: 1,
    baseSpeed: 138,
    spawnRate: 0.68,
    score: 125,
    minWave: 2,
    spawnWeight: 5,
    behavior: 'straight',
    accent: '#b56cff',
  },
  whale_scout: {
    key: 'whale_scout',
    label: 'WHALE SCOUT',
    sprite: { category: 'enemies', id: 'regulator_drone' },
    draw: { w: 42, h: 42 },
    hitbox: { w: 34, h: 30 },
    hp: 2,
    baseSpeed: 92,
    spawnRate: 0.78,
    score: 200,
    minWave: 3,
    spawnWeight: 3,
    behavior: 'zigzag',
    accent: '#36a3ff',
  },
  rug_fighter: {
    key: 'rug_fighter',
    label: 'RUG FIGHTER',
    sprite: { category: 'enemies', id: 'regulator_drone' },
    draw: { w: 38, h: 38 },
    hitbox: { w: 30, h: 28 },
    hp: 2,
    baseSpeed: 118,
    spawnRate: 0.74,
    score: 250,
    minWave: 4,
    spawnWeight: 2,
    behavior: 'dive',
    accent: '#ffd24a',
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

export const WEAPONS: Record<string, WeaponDef> = {
  tier_1_bb: {
    key: 'tier_1_bb',
    label: 'BB SHOT',
    tier: 1,
    projectileKey: 'bb_shot',
    fireRate: 0.14,
    damage: 1,
    shots: [{ offsetX: 0, angle: 0 }],
  },
  tier_2_twin: {
    key: 'tier_2_twin',
    label: 'TWIN BEAM',
    tier: 2,
    projectileKey: 'bb_shot',
    fireRate: 0.13,
    damage: 1,
    shots: [
      { offsetX: -9, angle: 0 },
      { offsetX: 9, angle: 0 },
    ],
  },
  tier_3_spread: {
    key: 'tier_3_spread',
    label: 'TRI-SPREAD',
    tier: 3,
    projectileKey: 'bb_shot',
    fireRate: 0.16,
    damage: 1,
    shots: [
      { offsetX: -7, angle: -0.18 },
      { offsetX: 0, angle: 0 },
      { offsetX: 7, angle: 0.18 },
    ],
  },
};

export const PICKUPS: Record<string, PickupDef> = {
  weapon_upgrade: {
    key: 'weapon_upgrade',
    label: 'WEAPON UP',
    sprite: { category: 'pickups', id: 'weapon_upgrade' },
    draw: { w: 30, h: 30 },
    hitbox: { w: 24, h: 24 },
    driftSpeed: 92,
    effect: 'weapon_upgrade',
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
    if (!WEAPONS[def.weaponKey]) errors.push(`ships.${key}: weaponKey "${def.weaponKey}" has no WeaponDef`);
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
    if (!def.label) errors.push(`enemies.${key}: label is empty`);
    if (!(Number.isInteger(def.minWave) && def.minWave >= 1)) errors.push(`enemies.${key}: minWave must be a positive integer`);
    if (!(def.spawnWeight > 0)) errors.push(`enemies.${key}: spawnWeight must be > 0`);
    if (!['straight', 'sine', 'zigzag', 'dive'].includes(def.behavior)) errors.push(`enemies.${key}: unknown behavior "${def.behavior}"`);
    if (!def.accent) errors.push(`enemies.${key}: accent is empty`);
  }

  for (const [key, def] of Object.entries(PROJECTILES)) {
    if (def.key !== key) errors.push(`projectiles.${key}: key mismatch ("${def.key}")`);
    checkSprite(`projectiles.${key}`, def.sprite);
    checkSize(`projectiles.${key}.draw`, def.draw);
    checkSize(`projectiles.${key}.hitbox`, def.hitbox);
    if (!(def.speed > 0)) errors.push(`projectiles.${key}: speed must be > 0`);
  }

  const weaponTiers = Object.values(WEAPONS).map((weapon) => weapon.tier).sort((a, b) => a - b);
  for (const [key, def] of Object.entries(WEAPONS)) {
    if (def.key !== key) errors.push(`weapons.${key}: key mismatch ("${def.key}")`);
    if (!def.label) errors.push(`weapons.${key}: label is empty`);
    if (!(Number.isInteger(def.tier) && def.tier >= 1)) errors.push(`weapons.${key}: tier must be a positive integer`);
    if (!PROJECTILES[def.projectileKey]) errors.push(`weapons.${key}: projectileKey "${def.projectileKey}" has no ProjectileDef`);
    if (!(def.fireRate > 0)) errors.push(`weapons.${key}: fireRate must be > 0`);
    if (!(def.damage > 0)) errors.push(`weapons.${key}: damage must be > 0`);
    if (def.shots.length === 0) errors.push(`weapons.${key}: shots must not be empty`);
    for (const shot of def.shots) {
      if (!Number.isFinite(shot.offsetX) || !Number.isFinite(shot.angle)) errors.push(`weapons.${key}: shot values must be finite`);
    }
  }
  if (weaponTiers.some((tier, index) => tier !== index + 1)) errors.push('weapons: tiers must be contiguous starting at 1');

  for (const [key, def] of Object.entries(PICKUPS)) {
    if (def.key !== key) errors.push(`pickups.${key}: key mismatch ("${def.key}")`);
    if (!def.label) errors.push(`pickups.${key}: label is empty`);
    checkSprite(`pickups.${key}`, def.sprite);
    checkSize(`pickups.${key}.draw`, def.draw);
    checkSize(`pickups.${key}.hitbox`, def.hitbox);
    if (!(def.driftSpeed > 0)) errors.push(`pickups.${key}: driftSpeed must be > 0`);
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

  const waveOne = availableEnemyKeys(ENEMIES, 1);
  if (waveOne.length === 0) errors.push('waveDirector: wave 1 has no available enemy');
  if (!waveOne.includes('regulator_drone')) errors.push('waveDirector: regulator_drone must be available in wave 1');
  if (availableEnemyKeys(ENEMIES, 3).some((key) => ENEMIES[key].minWave > 3)) errors.push('waveDirector: locked enemy leaked into wave 3');
  if (!ENEMIES[selectEnemyKey(ENEMIES, 4, 0.999999)]) errors.push('waveDirector: weighted selection returned an unknown key');
  if (!(spawnInterval(8) < spawnInterval(1))) errors.push('waveDirector: spawn pressure must increase over time');

  return errors;
}
