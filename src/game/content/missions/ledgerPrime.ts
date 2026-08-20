import type { MissionDef } from './types';

/**
 * Level 1 vertical-slice mission spine.
 *
 * Encounter completion, boss rewards, boarding, and on-foot runtime wiring land
 * in later phases. Checkpoint boundaries are declared here so persistence can
 * resume the authored mission without serializing live simulation state.
 */
export const EARTH_LEDGER_PRIME_MISSION: MissionDef = {
  key: 'earth_ledger_prime',
  planetKey: 'ledger_prime',
  label: 'EARTH // LEDGER PRIME',
  acts: [
    { key: 'deployment', label: 'EARTH DEPLOYMENT', objective: 'DEFEND EARTH // BREAK THE BLOCKADE', mode: 'transition' },
    { key: 'orbital_approach', label: 'ORBITAL APPROACH', objective: 'BREAK THE INVASION SCREEN', mode: 'flight' },
    { key: 'fog_belt', label: 'FOG BELT', objective: 'PUNCH THROUGH THE FOG LINE', mode: 'flight' },
    { key: 'ledger_city', label: 'LEDGER CITY', objective: 'DEFEND THE CITY APPROACH', mode: 'flight' },
    { key: 'defense_grid', label: 'DEFENSE GRID', objective: 'DISABLE GROUND DEFENSES', mode: 'flight' },
    { key: 'gary_fog', label: 'GUARDIAN // GARY FOG', objective: 'DEFEAT GARY FOG', mode: 'boss' },
    { key: 'final_assault', label: 'FINAL ASSAULT', objective: 'REACH THE ENEMY CAPITAL SHIP', mode: 'flight' },
    { key: 'regulatory_warship', label: 'REGULATORY WARSHIP', objective: 'DISABLE THE WARSHIP // DO NOT DESTROY IT', mode: 'boss' },
    { key: 'boarding', label: 'BOARDING RUN', objective: 'FLY INSIDE THE OPEN HANGAR', mode: 'transition' },
    { key: 'warship_interior', label: 'WARSHIP INTERIOR', objective: 'REACH THE LEDGER DEFENSE CORE', mode: 'on_foot' },
    { key: 'ledger_defense_core', label: 'LEDGER DEFENSE CORE', objective: 'TAKE CONTROL OF THE WARSHIP', mode: 'boss' },
    { key: 'earth_defended', label: 'EARTH DEFENDED', objective: 'SECURE THE CAPTURED WARSHIP', mode: 'complete' },
  ],
  checkpoints: [
    { key: 'earth.orbital_gate', label: 'ORBITAL GATE', resumeActKey: 'ledger_city' },
    { key: 'earth.defense_grid', label: 'DEFENSE GRID', resumeActKey: 'gary_fog' },
    { key: 'earth.boarding_lock', label: 'BOARDING LOCK', resumeActKey: 'boarding' },
    { key: 'earth.core_access', label: 'CORE ACCESS', resumeActKey: 'ledger_defense_core' },
  ],
};
