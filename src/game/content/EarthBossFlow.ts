import type { CampaignProgress } from './CampaignProgress';
import { hasShipTech, recordGuardianDefeated } from './CampaignProgress';
import { GARY_FOG_REVEAL } from './Level1Cinematics';

export const FOG_BREAKER_TECH_KEY = 'fog_breaker_pulse';

export interface GuardianEncounterPlan {
  actKey: string;
  bossKey: string;
  rewardTechKey: string;
  checkpointKey: string;
  musicCueKey: string;
  musicLeadSeconds: number;
  creepSeconds: number;
  postEntranceHoldSeconds: number;
}

export const GARY_FOG_GUARDIAN_PLAN: GuardianEncounterPlan = {
  actKey: 'gary_fog',
  bossKey: 'gary_fog',
  rewardTechKey: FOG_BREAKER_TECH_KEY,
  checkpointKey: 'earth.defense_grid',
  musicCueKey: 'boss_gary_fog',
  musicLeadSeconds: GARY_FOG_REVEAL.musicLead,
  creepSeconds: GARY_FOG_REVEAL.entranceDuration,
  postEntranceHoldSeconds: GARY_FOG_REVEAL.combatDelay,
};

/** Applies the first Guardian reward without allowing checkpoint reload farming. */
export function awardGaryFogVictory(current: CampaignProgress): CampaignProgress {
  return recordGuardianDefeated(current, 'ledger_prime', FOG_BREAKER_TECH_KEY);
}

export function hasFogBreaker(current: CampaignProgress): boolean {
  return hasShipTech(current, FOG_BREAKER_TECH_KEY);
}

export function validateGaryFogGuardianPlan(): string[] {
  const errors: string[] = [];
  if (GARY_FOG_GUARDIAN_PLAN.actKey !== 'gary_fog') errors.push('Gary Fog plan must own the gary_fog mission act');
  if (GARY_FOG_GUARDIAN_PLAN.bossKey !== 'gary_fog') errors.push('Gary Fog plan must use the Gary Fog boss definition');
  if (GARY_FOG_GUARDIAN_PLAN.rewardTechKey !== FOG_BREAKER_TECH_KEY) errors.push('Gary Fog reward must be Fog Breaker Pulse');
  if (GARY_FOG_GUARDIAN_PLAN.musicLeadSeconds < 5) errors.push('Gary Fog reveal must give boss music at least five seconds before the visual entrance');
  if (GARY_FOG_GUARDIAN_PLAN.creepSeconds < 2.5) errors.push('Gary Fog entrance must creep into frame rather than pop in');
  return errors;
}
