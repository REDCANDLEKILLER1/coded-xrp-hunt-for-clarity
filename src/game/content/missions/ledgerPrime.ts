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
  /*
   * One checkpoint per act boundary.
   *
   * There used to be four across twelve acts, which left a ten-minute gap
   * between the orbital gate and Gary Fog: dying to the guardian threw away
   * Ledger City and the whole Defense Grid. Every act except the opening
   * cinematic and the closing beat is resumable now, so the most a death can
   * cost is one act.
   *
   * The four original keys keep the acts they already resumed into. A saved
   * run carries its checkpoint KEY, so repointing one would silently move a
   * player who saved before this change.
   */
  checkpoints: [
    { key: 'earth.launch', label: 'LAUNCH', resumeActKey: 'orbital_approach' },
    { key: 'earth.fog_belt', label: 'FOG BELT', resumeActKey: 'fog_belt' },
    { key: 'earth.orbital_gate', label: 'ORBITAL GATE', resumeActKey: 'ledger_city' },
    { key: 'earth.grid_approach', label: 'GRID APPROACH', resumeActKey: 'defense_grid' },
    { key: 'earth.defense_grid', label: 'DEFENSE GRID', resumeActKey: 'gary_fog' },
    { key: 'earth.fog_breaker', label: 'FOG BREAKER', resumeActKey: 'final_assault' },
    { key: 'earth.capital_approach', label: 'CAPITAL APPROACH', resumeActKey: 'regulatory_warship' },
    { key: 'earth.boarding_lock', label: 'BOARDING LOCK', resumeActKey: 'boarding' },
    { key: 'earth.hangar_deck', label: 'HANGAR DECK', resumeActKey: 'warship_interior' },
    { key: 'earth.core_access', label: 'CORE ACCESS', resumeActKey: 'ledger_defense_core' },
  ],
};
