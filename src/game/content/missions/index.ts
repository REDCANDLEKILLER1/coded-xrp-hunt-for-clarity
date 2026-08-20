import { EARTH_LEDGER_PRIME_MISSION } from './ledgerPrime';
import type { MissionDef } from './types';

export const MISSIONS: MissionDef[] = [EARTH_LEDGER_PRIME_MISSION];

export const MISSION_BY_PLANET = Object.fromEntries(
  MISSIONS.map((mission) => [mission.planetKey, mission]),
) as Record<string, MissionDef>;

export function missionForPlanet(planetKey: string): MissionDef | undefined {
  return MISSION_BY_PLANET[planetKey];
}

export function validateMissions(): string[] {
  const errors: string[] = [];
  const missionKeys = new Set<string>();
  const planetKeys = new Set<string>();

  for (const mission of MISSIONS) {
    if (!mission.key) errors.push('mission: key is required');
    if (!mission.planetKey) errors.push(`mission.${mission.key || 'unknown'}: planetKey is required`);
    if (!mission.label) errors.push(`mission.${mission.key || 'unknown'}: label is required`);
    if (missionKeys.has(mission.key)) errors.push(`mission.${mission.key}: duplicate mission key`);
    if (planetKeys.has(mission.planetKey)) errors.push(`mission.${mission.key}: duplicate planet mission for ${mission.planetKey}`);
    missionKeys.add(mission.key);
    planetKeys.add(mission.planetKey);

    if (mission.acts.length === 0) errors.push(`mission.${mission.key}: at least one act is required`);
    const actKeys = new Set<string>();
    for (const act of mission.acts) {
      if (!act.key || !act.label || !act.objective) errors.push(`mission.${mission.key}: act key, label, and objective are required`);
      if (actKeys.has(act.key)) errors.push(`mission.${mission.key}.${act.key}: duplicate act key`);
      actKeys.add(act.key);
    }
  }

  return errors;
}

export { EARTH_LEDGER_PRIME_MISSION } from './ledgerPrime';
export type { MissionActDef, MissionActMode, MissionDef } from './types';
