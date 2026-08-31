import type { MissionDef } from './types';

/**
 * Level 1 mission spine.
 *
 * Checkpoint boundaries are declared here so persistence can resume the
 * authored mission without serializing live simulation state.
 *
 * THE PACING PROBLEM THIS SHAPE FIXES. A playtester reported "might need a
 * couple more big bosses, or shorten the length to get to Gary Fog", and the
 * authored encounters agree: orbital approach, fog belt, ledger city and the
 * defense grid run about 16.7 minutes end to end, and Gary Fog was the FIRST
 * thing in the level that was not another formation. Two bosses that were
 * already fully authored -- three phases each, with shipped art -- sat in the
 * registry placed in no level at all, because `startBossIfReady` disables the
 * wave-driven boss ladder whenever a mission is active. They are placed here
 * now, at roughly the 6.5 and 11 minute marks. No encounter groups were
 * removed: the level stays long, it just stops being flat.
 *
 * Neither of them touches the capture: that belongs to `regulatory_warship`,
 * and the ship the player takes into the 3D transit is unchanged.
 *
 * THE INTERIOR IS GONE, and this list is the last place that still said
 * otherwise. `warship_interior` and `ledger_defense_core` were declared here as
 * acts 10 and 11 long after `src/main.ts` stopped routing to them -- boarding
 * hands off straight to the 3D cockpit, and the on-foot code is reachable only
 * on `?onfoot`. Their two checkpoints went with them: a checkpoint that resumes
 * into a missing act is rejected by `validateMissions` and by
 * `scripts/validate-content.mjs`, so the pair could not be split. A saved run
 * still pointing at either act resumes safely -- both `startAtAct` call sites
 * check `mission.acts.some(...)` first and fall back to a fresh start.
 */
export const EARTH_LEDGER_PRIME_MISSION: MissionDef = {
  key: 'earth_ledger_prime',
  planetKey: 'ledger_prime',
  label: 'EARTH // LEDGER PRIME',
  acts: [
    { key: 'deployment', label: 'EARTH DEPLOYMENT', objective: 'DEFEND EARTH // BREAK THE BLOCKADE', mode: 'transition' },
    { key: 'orbital_approach', label: 'ORBITAL APPROACH', objective: 'BREAK THE INVASION SCREEN', mode: 'flight' },
    { key: 'fog_belt', label: 'FOG BELT', objective: 'PUNCH THROUGH THE FOG LINE', mode: 'flight' },
    { key: 'regulatory_behemoth', label: 'REGULATORY BEHEMOTH', objective: 'BREAK THE ENFORCEMENT LINE', mode: 'boss' },
    { key: 'ledger_city', label: 'LEDGER CITY', objective: 'DEFEND THE CITY APPROACH', mode: 'flight' },
    { key: 'clarity_destroyer', label: 'CLARITY DESTROYER', objective: 'DESTROY THE CLARITY DESTROYER', mode: 'boss' },
    { key: 'defense_grid', label: 'DEFENSE GRID', objective: 'DISABLE GROUND DEFENSES', mode: 'flight' },
    { key: 'gary_fog', label: 'GUARDIAN // GARY FOG', objective: 'DEFEAT GARY FOG', mode: 'boss' },
    { key: 'final_assault', label: 'FINAL ASSAULT', objective: 'REACH THE ENEMY CAPITAL SHIP', mode: 'flight' },
    { key: 'regulatory_warship', label: 'REGULATORY WARSHIP', objective: 'DISABLE THE WARSHIP // DO NOT DESTROY IT', mode: 'boss' },
    { key: 'boarding', label: 'BOARDING RUN', objective: 'FLY INSIDE THE OPEN HANGAR', mode: 'transition' },
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
    { key: 'earth.behemoth', label: 'ENFORCEMENT LINE', resumeActKey: 'regulatory_behemoth' },
    { key: 'earth.orbital_gate', label: 'ORBITAL GATE', resumeActKey: 'ledger_city' },
    { key: 'earth.destroyer', label: 'CITY APPROACH', resumeActKey: 'clarity_destroyer' },
    { key: 'earth.grid_approach', label: 'GRID APPROACH', resumeActKey: 'defense_grid' },
    { key: 'earth.defense_grid', label: 'DEFENSE GRID', resumeActKey: 'gary_fog' },
    { key: 'earth.fog_breaker', label: 'FOG BREAKER', resumeActKey: 'final_assault' },
    { key: 'earth.capital_approach', label: 'CAPITAL APPROACH', resumeActKey: 'regulatory_warship' },
    { key: 'earth.boarding_lock', label: 'BOARDING LOCK', resumeActKey: 'boarding' },
  ],
};
