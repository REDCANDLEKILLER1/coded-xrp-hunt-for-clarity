import type { CampaignProgress } from './CampaignProgress';
import { hasShipTech, recordGuardianDefeated } from './CampaignProgress';
import { GARY_FOG_REVEAL } from './Level1Cinematics';

export const FOG_BREAKER_TECH_KEY = 'fog_breaker_pulse';

export interface GuardianEncounterPlan {
  actKey: string;
  bossKey: string;
  /**
   * Permanent ship tech this guardian hands over, or null for none.
   *
   * Only Gary Fog grants tech. The two intermediate bosses exist to break up a
   * sixteen-minute run of formations, not to hand out unlocks, and inventing
   * two more permanent abilities to justify them would be a much larger change
   * than the pacing problem asked for. They pay the normal boss reward instead
   * -- score, a free upgrade pick and a hull point -- which `damageBoss`
   * already gives every boss before any plan is consulted.
   */
  rewardTechKey: string | null;
  checkpointKey: string;
  musicCueKey: string;
  musicLeadSeconds: number;
  creepSeconds: number;
  postEntranceHoldSeconds: number;
  /** Shown when the guardian arrives. */
  approachBanner: string;
  /** Shown when it dies. Gary overrides this with his tech-award line. */
  defeatBanner: string;
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
  approachBanner: 'GUARDIAN SIGNAL // GARY FOG APPROACHING',
  defeatBanner: 'GARY FOG DEFEATED',
};

/**
 * The two intermediate guardians, placed to break up the run to Gary Fog.
 *
 * Both use bosses that were already fully authored in the registry -- three
 * escalating phases, shipped manifest art -- and had never been placed in a
 * level, because the wave-driven ladder that their `triggerWave` values belong
 * to is switched off whenever a mission is active.
 *
 * They get the same REVEAL as Gary: music ahead of the entrance, a hull that
 * creeps into frame rather than popping in. That is deliberate. The complaint
 * was that nothing in the first sixteen minutes felt like an event, and a boss
 * that drops in like a wave spawn would not fix it.
 *
 * They do NOT get his reward, and they do not touch the capture: taking the
 * Regulatory Warship stays the property of the `regulatory_warship` act.
 */
export const REGULATORY_BEHEMOTH_GUARDIAN_PLAN: GuardianEncounterPlan = {
  actKey: 'regulatory_behemoth',
  bossKey: 'regulatory_behemoth',
  rewardTechKey: null,
  checkpointKey: 'earth.behemoth',
  musicCueKey: 'boss_fight',
  musicLeadSeconds: GARY_FOG_REVEAL.musicLead,
  creepSeconds: GARY_FOG_REVEAL.entranceDuration,
  postEntranceHoldSeconds: GARY_FOG_REVEAL.combatDelay,
  approachBanner: 'ENFORCEMENT SIGNAL // REGULATORY BEHEMOTH',
  defeatBanner: 'ENFORCEMENT LINE BROKEN',
};

export const CLARITY_DESTROYER_GUARDIAN_PLAN: GuardianEncounterPlan = {
  actKey: 'clarity_destroyer',
  bossKey: 'clarity_destroyer',
  rewardTechKey: null,
  checkpointKey: 'earth.destroyer',
  musicCueKey: 'boss_fight',
  musicLeadSeconds: GARY_FOG_REVEAL.musicLead,
  creepSeconds: GARY_FOG_REVEAL.entranceDuration,
  postEntranceHoldSeconds: GARY_FOG_REVEAL.combatDelay,
  approachBanner: 'CAPITAL SIGNAL // CLARITY DESTROYER',
  defeatBanner: 'CLARITY DESTROYER DOWN',
};

/** Every guardian encounter Level 1 places, in the order it places them. */
export const GUARDIAN_PLANS: GuardianEncounterPlan[] = [
  REGULATORY_BEHEMOTH_GUARDIAN_PLAN,
  CLARITY_DESTROYER_GUARDIAN_PLAN,
  GARY_FOG_GUARDIAN_PLAN,
];

/**
 * The guardian a mission act drives, or null if the act is not a guardian.
 *
 * This is what replaced a hard comparison against GARY_FOG_GUARDIAN_PLAN.actKey
 * in two places. With one guardian a constant was fine; with three, a missed
 * comparison is a boss act that spawns nothing and a level that stalls on it.
 */
export function guardianPlanFor(actKey: string | undefined): GuardianEncounterPlan | null {
  if (!actKey) return null;
  return GUARDIAN_PLANS.find((plan) => plan.actKey === actKey) ?? null;
}

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

  // Every guardian, not just Gary. A plan with a duplicate act key would have
  // guardianPlanFor return the wrong boss for an act, and one that creeps in
  // too fast is the wave spawn this placement exists to avoid.
  const actKeys = new Set<string>();
  const bossKeys = new Set<string>();
  for (const plan of GUARDIAN_PLANS) {
    if (actKeys.has(plan.actKey)) errors.push(`guardian plans: duplicate act ${plan.actKey}`);
    if (bossKeys.has(plan.bossKey)) errors.push(`guardian plans: boss ${plan.bossKey} is placed twice`);
    actKeys.add(plan.actKey);
    bossKeys.add(plan.bossKey);
    if (!plan.approachBanner || !plan.defeatBanner) errors.push(`guardian ${plan.actKey}: needs an approach and a defeat banner`);
    if (plan.musicLeadSeconds < 5) errors.push(`guardian ${plan.actKey}: music must lead the entrance by at least five seconds`);
    if (plan.creepSeconds < 2.5) errors.push(`guardian ${plan.actKey}: entrance must creep into frame rather than pop in`);
  }

  // Only Gary hands over tech. The intermediates are pacing, not progression.
  const withTech = GUARDIAN_PLANS.filter((plan) => plan.rewardTechKey !== null);
  if (withTech.length !== 1 || withTech[0].actKey !== 'gary_fog') {
    errors.push('Fog Breaker must stay the only guardian tech reward');
  }
  return errors;
}
