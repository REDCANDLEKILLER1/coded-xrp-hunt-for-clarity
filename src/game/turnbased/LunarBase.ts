// LunarBase.ts — the lunar base hub (basic version).
//
// After the base capture (BaseCapture.ts), the lunar base becomes the
// player's second hub alongside the warship. This is the minimal viable hub:
// repair (rest), upgrade (ability tiers), launch (back to campaign map).
//
// Full hub features (shops, crew dialogue, mission board) come later.

import type { Combatant } from './Actions';
import { rest, type PlayerProgress, MAX_STEM_PACKS } from './Progression';

export interface LunarBaseState {
  captured: boolean;
  playerProgress: PlayerProgress;
}

/** Create fresh hub state after a successful base capture. */
export function createLunarBaseState(progress: PlayerProgress): LunarBaseState {
  return { captured: true, playerProgress: progress };
}

/**
 * Repair: rest at the base. Restores HP, clears debuffs, refills stem packs.
 * Returns the save string (same diegetic-save mechanic as the ship).
 */
export function baseRepair(state: LunarBaseState, combatant: Combatant): string {
  if (!state.captured) throw new Error('lunar-base: cannot repair before capture');
  return rest(state.playerProgress, combatant);
}

/**
 * Upgrade: spend credits to raise an ability tier.
 * Delegates to the progression system's upgrade logic.
 */
export function baseUpgradeInfo(state: LunarBaseState): {
  credits: number;
  stemPacks: number;
  maxStemPacks: number;
  level: number;
} {
  return {
    credits: state.playerProgress.credits,
    stemPacks: state.playerProgress.stemPacks,
    maxStemPacks: MAX_STEM_PACKS,
    level: state.playerProgress.level,
  };
}

/** Launch: leave the base, return to the campaign map. */
export function baseLaunchDestination(): string {
  return 'campaign_map';
}
