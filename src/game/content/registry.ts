// Phase A content registry.
//
// Seeded with ONLY the current live content (player, regulator drone, basic
// projectile, burst-ring FX, clarity pulse). Values mirror the pre-Phase-A
// constants in Game2A exactly, so gameplay is unchanged — only the source of
// truth moves here. Future inventory keys (see docs/phase-2b-asset-inventory.md)
// are intentionally NOT wired into live play in Phase A.

import type { BossDef, EnemyDef, FxDef, HazardDef, PickupDef, ProjectileDef, ShipDef, SpecialDef, StageDef, WeaponDef } from './types';
import { bossPhaseIndex, nextBossKey, orderedBossKeys } from './BossDirector';
import { availableEnemyKeys, selectEnemyKey, spawnInterval } from './WaveDirector';

export const SHIPS: Record<string, ShipDef> = {
  player: {
    key: 'player',
    label: 'CLARITY INTERCEPTOR',
    accent: '#00ff00',
    sprite: { category: 'ships', id: 'player' },
    draw: { w: 40, h: 48 },
    hitbox: { w: 38, h: 42 },
    speed: 340,
    hp: 3,
    fireRate: 0.14,
    weaponKey: 'tier_1_bb',
  },
  xrpl_striker: {
    key: 'xrpl_striker',
    label: 'XRPL STRIKER',
    accent: '#36a3ff',
    sprite: { category: 'ships', id: 'xrpl_striker' },
    draw: { w: 38, h: 46 },
    hitbox: { w: 35, h: 39 },
    speed: 405,
    hp: 2,
    fireRate: 0.11,
    weaponKey: 'tier_1_bb',
  },
  ledger_warden: {
    key: 'ledger_warden',
    label: 'LEDGER WARDEN',
    accent: '#ffd24a',
    sprite: { category: 'ships', id: 'ledger_warden' },
    draw: { w: 46, h: 54 },
    hitbox: { w: 42, h: 47 },
    speed: 285,
    hp: 5,
    fireRate: 0.17,
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
    sprite: { category: 'enemies', id: 'fog_raider' },
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
    sprite: { category: 'enemies', id: 'whale_scout' },
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
    sprite: { category: 'enemies', id: 'rug_fighter' },
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
  bomb: {
    key: 'bomb',
    label: 'CLARITY BOMB',
    sprite: { category: 'pickups', id: 'bomb' },
    draw: { w: 32, h: 32 },
    hitbox: { w: 25, h: 25 },
    driftSpeed: 84,
    effect: 'bomb',
  },
  repair: {
    key: 'repair',
    label: 'HULL REPAIR',
    sprite: { category: 'pickups', id: 'repair' },
    draw: { w: 30, h: 30 },
    hitbox: { w: 24, h: 24 },
    driftSpeed: 88,
    effect: 'repair',
  },
};

export const STAGES: Record<string, StageDef> = {
  ledger_city: {
    key: 'ledger_city',
    label: 'LEDGER CITY',
    minWave: 1,
    sky: '#02060b',
    accent: '#00ff00',
    structure: '#082316',
    scrollSpeed: 42,
  },
  data_canyon: {
    key: 'data_canyon',
    label: 'DATA CANYON',
    minWave: 4,
    sky: '#030817',
    accent: '#36a3ff',
    structure: '#0a1a36',
    scrollSpeed: 58,
  },
  regulatory_outpost: {
    key: 'regulatory_outpost',
    label: 'REGULATORY OUTPOST',
    minWave: 7,
    sky: '#10050a',
    accent: '#ff3355',
    structure: '#321018',
    scrollSpeed: 72,
  },
};

export const HAZARDS: Record<string, HazardDef> = {
  defense_turret: {
    key: 'defense_turret',
    label: 'DEFENSE TURRET',
    sprite: { category: 'hazards', id: 'defense_turret' },
    draw: { w: 44, h: 44 },
    hitbox: { w: 36, h: 36 },
    hp: 3,
    minWave: 3,
    spawnRate: 7.5,
    fireRate: 1.65,
    projectileSpeed: 235,
    score: 350,
    accent: '#ff8a3d',
  },
};

export const BOSSES: Record<string, BossDef> = {
  gary_fog: {
    key: 'gary_fog',
    label: 'GARY FOG',
    sprite: { category: 'bosses', id: 'gary_fog_phase1' },
    draw: { w: 136, h: 144 },
    hitbox: { w: 104, h: 96 },
    hp: 36,
    triggerWave: 5,
    score: 600,
    phases: [
      { hpThreshold: 1, moveSpeed: 72, fireRate: 1.05, projectileSpeed: 205, projectileCount: 1, spread: 0, pattern: 'aimed', accent: '#b56cff' },
      { hpThreshold: 0.62, moveSpeed: 96, fireRate: 0.82, projectileSpeed: 225, projectileCount: 3, spread: 0.22, pattern: 'spread', accent: '#d06cff' },
      { hpThreshold: 0.28, moveSpeed: 124, fireRate: 0.58, projectileSpeed: 250, projectileCount: 5, spread: 0.19, pattern: 'burst', accent: '#ff5ce1' },
    ],
  },
  regulatory_behemoth: {
    key: 'regulatory_behemoth',
    label: 'REGULATORY BEHEMOTH',
    sprite: { category: 'bosses', id: 'regulatory_behemoth_phase2' },
    draw: { w: 150, h: 158 },
    hitbox: { w: 118, h: 108 },
    hp: 58,
    triggerWave: 9,
    score: 900,
    phases: [
      { hpThreshold: 1, moveSpeed: 58, fireRate: 0.9, projectileSpeed: 220, projectileCount: 3, spread: 0.2, pattern: 'spread', accent: '#ff8a3d' },
      { hpThreshold: 0.58, moveSpeed: 78, fireRate: 0.68, projectileSpeed: 245, projectileCount: 4, spread: 0.18, pattern: 'sweep', accent: '#ff5b3d' },
      { hpThreshold: 0.24, moveSpeed: 105, fireRate: 0.48, projectileSpeed: 270, projectileCount: 6, spread: 0.16, pattern: 'burst', accent: '#ff3355' },
    ],
  },
  clarity_destroyer: {
    key: 'clarity_destroyer',
    label: 'CLARITY DESTROYER',
    sprite: { category: 'bosses', id: 'clarity_destroyer_phase3' },
    draw: { w: 158, h: 168 },
    hitbox: { w: 122, h: 116 },
    hp: 82,
    triggerWave: 13,
    score: 1200,
    phases: [
      { hpThreshold: 1, moveSpeed: 70, fireRate: 0.78, projectileSpeed: 245, projectileCount: 4, spread: 0.2, pattern: 'sweep', accent: '#36a3ff' },
      { hpThreshold: 0.6, moveSpeed: 98, fireRate: 0.56, projectileSpeed: 275, projectileCount: 5, spread: 0.17, pattern: 'spread', accent: '#1ee7ff' },
      { hpThreshold: 0.22, moveSpeed: 132, fireRate: 0.4, projectileSpeed: 305, projectileCount: 7, spread: 0.14, pattern: 'burst', accent: '#00ff88' },
    ],
  },
  final_clarity: {
    key: 'final_clarity',
    label: 'FINAL CLARITY',
    sprite: { category: 'bosses', id: 'final_clarity' },
    draw: { w: 170, h: 180 },
    hitbox: { w: 132, h: 124 },
    hp: 120,
    triggerWave: 17,
    score: 2000,
    phases: [
      { hpThreshold: 1, moveSpeed: 82, fireRate: 0.66, projectileSpeed: 270, projectileCount: 5, spread: 0.17, pattern: 'aimed', accent: '#ffd24a' },
      { hpThreshold: 0.55, moveSpeed: 112, fireRate: 0.46, projectileSpeed: 305, projectileCount: 7, spread: 0.14, pattern: 'sweep', accent: '#ff8a3d' },
      { hpThreshold: 0.2, moveSpeed: 148, fireRate: 0.32, projectileSpeed: 340, projectileCount: 9, spread: 0.12, pattern: 'burst', accent: '#ff3355' },
    ],
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
    if (!def.label) errors.push(`ships.${key}: label is empty`);
    if (!def.accent) errors.push(`ships.${key}: accent is empty`);
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
    if (!['weapon_upgrade', 'bomb', 'repair'].includes(def.effect)) errors.push(`pickups.${key}: unknown effect "${def.effect}"`);
  }

  const stageWaves = Object.values(STAGES).map((stage) => stage.minWave).sort((a, b) => a - b);
  for (const [key, def] of Object.entries(STAGES)) {
    if (def.key !== key) errors.push(`stages.${key}: key mismatch ("${def.key}")`);
    if (!def.label) errors.push(`stages.${key}: label is empty`);
    if (!(Number.isInteger(def.minWave) && def.minWave >= 1)) errors.push(`stages.${key}: minWave must be a positive integer`);
    if (!def.sky || !def.accent || !def.structure) errors.push(`stages.${key}: colors must not be empty`);
    if (!(def.scrollSpeed > 0)) errors.push(`stages.${key}: scrollSpeed must be > 0`);
  }
  if (stageWaves[0] !== 1) errors.push('stages: first stage must unlock at wave 1');

  for (const [key, def] of Object.entries(HAZARDS)) {
    if (def.key !== key) errors.push(`hazards.${key}: key mismatch ("${def.key}")`);
    if (!def.label) errors.push(`hazards.${key}: label is empty`);
    checkSprite(`hazards.${key}`, def.sprite);
    checkSize(`hazards.${key}.draw`, def.draw);
    checkSize(`hazards.${key}.hitbox`, def.hitbox);
    if (!(def.hp > 0)) errors.push(`hazards.${key}: hp must be > 0`);
    if (!(Number.isInteger(def.minWave) && def.minWave >= 1)) errors.push(`hazards.${key}: minWave must be a positive integer`);
    if (!(def.spawnRate > 0 && def.fireRate > 0 && def.projectileSpeed > 0)) errors.push(`hazards.${key}: timing and projectile speed must be > 0`);
    if (!(def.score >= 0)) errors.push(`hazards.${key}: score must be >= 0`);
    if (!def.accent) errors.push(`hazards.${key}: accent is empty`);
  }

  const bossWaves = orderedBossKeys(BOSSES).map((key) => BOSSES[key].triggerWave);
  for (const [key, def] of Object.entries(BOSSES)) {
    if (def.key !== key) errors.push(`bosses.${key}: key mismatch ("${def.key}")`);
    if (!def.label) errors.push(`bosses.${key}: label is empty`);
    checkSprite(`bosses.${key}`, def.sprite);
    checkSize(`bosses.${key}.draw`, def.draw);
    checkSize(`bosses.${key}.hitbox`, def.hitbox);
    if (!(def.hp > 0)) errors.push(`bosses.${key}: hp must be > 0`);
    if (!(Number.isInteger(def.triggerWave) && def.triggerWave >= 1)) errors.push(`bosses.${key}: triggerWave must be a positive integer`);
    if (!(def.score >= 0)) errors.push(`bosses.${key}: score must be >= 0`);
    if (def.phases.length === 0) errors.push(`bosses.${key}: phases must not be empty`);
    let priorThreshold = Number.POSITIVE_INFINITY;
    for (const [index, phase] of def.phases.entries()) {
      if (!(phase.hpThreshold > 0 && phase.hpThreshold <= 1 && phase.hpThreshold < priorThreshold)) errors.push(`bosses.${key}.phases.${index}: thresholds must strictly descend within (0, 1]`);
      if (!(phase.moveSpeed > 0 && phase.fireRate > 0 && phase.projectileSpeed > 0)) errors.push(`bosses.${key}.phases.${index}: movement, fire rate, and projectile speed must be > 0`);
      if (!(Number.isInteger(phase.projectileCount) && phase.projectileCount > 0)) errors.push(`bosses.${key}.phases.${index}: projectileCount must be a positive integer`);
      if (!(phase.spread >= 0) || !phase.accent) errors.push(`bosses.${key}.phases.${index}: spread and accent are invalid`);
      priorThreshold = phase.hpThreshold;
    }
    if (def.phases.length > 0 && bossPhaseIndex(def, def.hp) !== 0) errors.push(`bosses.${key}: full health must resolve to phase 1`);
    if (def.phases.length > 0 && bossPhaseIndex(def, 0) !== def.phases.length - 1) errors.push(`bosses.${key}: zero health must resolve to final phase`);
  }
  if (bossWaves.some((wave, index) => index > 0 && wave <= bossWaves[index - 1])) errors.push('bosses: trigger waves must strictly increase');
  const firstBoss = orderedBossKeys(BOSSES)[0];
  if (nextBossKey(BOSSES, BOSSES[firstBoss].triggerWave - 1, new Set()) !== undefined) errors.push('bossDirector: boss unlocked too early');
  if (nextBossKey(BOSSES, BOSSES[firstBoss].triggerWave, new Set()) !== firstBoss) errors.push('bossDirector: first boss failed to unlock');
  if (nextBossKey(BOSSES, BOSSES[firstBoss].triggerWave, new Set([firstBoss])) !== undefined) errors.push('bossDirector: completed boss repeated');

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
