// Progression.ts — XP, levels, ability upgrades, stem packs, and the
// ship-as-save-point rest mechanic for the turn-based system.
//
// Pure logic: no DOM, no Three.js. Directly testable by
// scripts/validate-turnbased.mjs.
//
// Design:
// - Player starts at level 0. XP comes from turn-based victories,
//   scaled by enemy difficulty rating.
// - Each level grants +1 stat point (attack / defense / speed / maxHp).
// - Ability tiers unlock at levels 2 (tier 2) and 4 (tier 3), bought
//   with credits earned alongside XP.
// - Stem packs: consumable heal, max 3 carried, using one costs a turn.
// - rest(): the diegetic save. Restores HP, refills stem packs, returns
//   a serialized save string.

import { Combatant } from './Actions.ts';

export type StatKey = 'attack' | 'defense' | 'speed' | 'maxHp';

export interface PlayerProgress {
  level: number;
  xp: number;
  credits: number;
  /** Unspent stat points from level-ups. */
  statPoints: number;
  /** actionId -> tier (1..3). Absent = 1. */
  abilityTiers: Record<string, number>;
  stemPacks: number;
}

export const MAX_STEM_PACKS = 3;
export const STEM_PACK_HEAL = 40;
export const STEM_PACK_COST = 25;
/** Credits per tier upgrade. Tier 2 -> 75, tier 3 -> 150. */
export const TIER_COST: Record<number, number> = { 2: 75, 3: 150 };
/** Minimum player level to buy each tier. */
export const TIER_MIN_LEVEL: Record<number, number> = { 2: 2, 3: 4 };

export function freshProgress(): PlayerProgress {
  return {
    level: 0,
    xp: 0,
    credits: 0,
    statPoints: 0,
    abilityTiers: {},
    stemPacks: 1,
  };
}

/** XP to go from `level` to `level + 1`. Fast early curve. */
export function xpToNext(level: number): number {
  return 50 * (level + 1);
}

/** Enemy difficulty rating -> XP and credit reward for defeating it. */
export function victoryRewards(difficulty: number): { xp: number; credits: number } {
  const d = Math.max(1, Math.floor(difficulty));
  return { xp: 40 * d, credits: 20 * d };
}

export interface LevelUpResult {
  levelsGained: number;
  /** Total unspent stat points after applying gains. */
  statPoints: number;
}

/**
 * Award XP. Applies all earned level-ups: +1 level and +1 stat point
 * each. Returns how many levels were gained.
 */
export function gainXp(p: PlayerProgress, amount: number): LevelUpResult {
  let gained = 0;
  p.xp += Math.max(0, Math.floor(amount));
  while (p.xp >= xpToNext(p.level)) {
    p.xp -= xpToNext(p.level);
    p.level += 1;
    p.statPoints += 1;
    gained += 1;
  }
  return { levelsGained: gained, statPoints: p.statPoints };
}

/** Spend one stat point on a stat. Returns false when no points remain. */
export function allocateStatPoint(p: PlayerProgress, c: Combatant, stat: StatKey): boolean {
  if (p.statPoints <= 0) return false;
  p.statPoints -= 1;
  switch (stat) {
    case 'attack':
      c.attack += 2;
      break;
    case 'defense':
      c.defense += 2;
      break;
    case 'speed':
      c.speed += 1;
      break;
    case 'maxHp':
      c.maxHp += 15;
      c.hp = Math.min(c.maxHp, c.hp + 15);
      break;
  }
  return true;
}

export function abilityTier(p: PlayerProgress, actionId: string): number {
  return p.abilityTiers[actionId] ?? 1;
}

export interface UpgradeResult {
  ok: boolean;
  reason?: string;
}

/**
 * Buy the next tier for an ability. Requires the player level gate
 * and enough credits. Tier caps at 3.
 */
export function upgradeAbility(p: PlayerProgress, actionId: string): UpgradeResult {
  const cur = abilityTier(p, actionId);
  if (cur >= 3) return { ok: false, reason: `${actionId} is already at max tier` };
  const next = cur + 1;
  const minLevel = TIER_MIN_LEVEL[next] ?? 99;
  if (p.level < minLevel) {
    return { ok: false, reason: `tier ${next} requires level ${minLevel}` };
  }
  const cost = TIER_COST[next] ?? 0;
  if (p.credits < cost) {
    return { ok: false, reason: `need ${cost} credits (have ${p.credits})` };
  }
  p.credits -= cost;
  p.abilityTiers[actionId] = next;
  return { ok: true };
}

/** Buy a stem pack. Capped at MAX_STEM_PACKS. */
export function buyStemPack(p: PlayerProgress): UpgradeResult {
  if (p.stemPacks >= MAX_STEM_PACKS) {
    return { ok: false, reason: `stem packs full (${MAX_STEM_PACKS})` };
  }
  if (p.credits < STEM_PACK_COST) {
    return { ok: false, reason: `need ${STEM_PACK_COST} credits (have ${p.credits})` };
  }
  p.credits -= STEM_PACK_COST;
  p.stemPacks += 1;
  return { ok: true };
}

/**
 * rest(): the ship-as-save-point mechanic. Restores the combatant to
 * full HP, clears temporary combat state (cooldowns, buffs, bleed),
 * refills stem packs to max, and returns a serialized save string.
 */
export function rest(p: PlayerProgress, c: Combatant): string {
  c.hp = c.maxHp;
  c.alive = true;
  c.cooldowns.clear();
  c.defenseBuff = 0;
  c.defenseBuffTurns = 0;
  c.bleedDamage = 0;
  c.bleedTurns = 0;
  c.reflectPct = 0;
  p.stemPacks = MAX_STEM_PACKS;
  return serializeSave(p, c);
}

export interface SaveData {
  version: 1;
  progress: PlayerProgress;
  combatant: {
    name: string;
    maxHp: number;
    attack: number;
    defense: number;
    speed: number;
  };
}

export function serializeSave(p: PlayerProgress, c: Combatant): string {
  const data: SaveData = {
    version: 1,
    progress: {
      level: p.level,
      xp: p.xp,
      credits: p.credits,
      statPoints: p.statPoints,
      abilityTiers: { ...p.abilityTiers },
      stemPacks: p.stemPacks,
    },
    combatant: {
      name: c.name,
      maxHp: c.maxHp,
      attack: c.attack,
      defense: c.defense,
      speed: c.speed,
    },
  };
  return JSON.stringify(data);
}

export function deserializeSave(json: string): SaveData | null {
  try {
    const data = JSON.parse(json) as SaveData;
    if (data.version !== 1 || !data.progress || !data.combatant) return null;
    return data;
  } catch {
    return null;
  }
}
