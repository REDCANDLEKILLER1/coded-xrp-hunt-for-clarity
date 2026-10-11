import type { MissionDef } from './types';

/**
 * Fog Moon + Mars descent levels (PR #136).
 *
 * These are standalone LEVELS, not Earth reskins: their own planet keys, act
 * keys, labels and objectives. Nothing here references Earth's acts, bosses,
 * transitions, story or checkpoints, so none of Earth's mission flow can run
 * inside them — the director only advances the acts listed below.
 *
 * The LEVEL is the descent: flight acts advance when the background rolls
 * past their tile boundary (see DESCENT_ACT_END_TILES in Game2A), and the
 * final act holds tile 10's self-tiling loop for open surface combat.
 *
 * Encounters are intentionally UNPOPULATED. Michael is assembling new enemy
 * packages; until those land, the levels fly with a light ambient drone
 * trickle (see Game2A.updateDescentFlight) so combat readability over the
 * backgrounds can be playtested. No checkpoints are recorded — a playtest
 * route must not write campaign progression.
 */
export const FOG_MOON_DESCENT_MISSION: MissionDef = {
  key: 'fog_moon_descent',
  planetKey: 'fog_moon',
  label: 'FOG MOON // DESCENT',
  acts: [
    { key: 'fog_orbital_drop', label: 'FOG MOON // ORBITAL DROP', objective: 'BREACH THE FOG LINE', mode: 'flight' },
    { key: 'fog_storm_belt', label: 'FOG MOON // STORM BELT', objective: 'PUNCH THROUGH THE STORM BELT', mode: 'flight' },
    { key: 'fog_deep_descent', label: 'FOG MOON // DEEP DESCENT', objective: 'RIDE THE DESCENT CORRIDOR', mode: 'flight' },
    { key: 'fog_surface_run', label: 'FOG MOON // SURFACE RUN', objective: 'CLEAR THE SURFACE APPROACH', mode: 'flight' },
    { key: 'fog_touchdown', label: 'FOG MOON // TOUCHDOWN', objective: 'DESCENT COMPLETE // FREE FLIGHT', mode: 'complete' },
  ],
  checkpoints: [],
};

export const MARS_DESCENT_MISSION: MissionDef = {
  key: 'mars_descent',
  planetKey: 'mars',
  label: 'MARS // DESCENT',
  acts: [
    { key: 'mars_orbital_drop', label: 'MARS // ORBITAL DROP', objective: 'BREACH THE DUST LINE', mode: 'flight' },
    { key: 'mars_dust_storm', label: 'MARS // DUST STORM', objective: 'PUNCH THROUGH THE DUST STORM', mode: 'flight' },
    { key: 'mars_canyon_run', label: 'MARS // CANYON RUN', objective: 'RIDE THE CANYON CORRIDOR', mode: 'flight' },
    { key: 'mars_surface_run', label: 'MARS // SURFACE RUN', objective: 'CLEAR THE SURFACE APPROACH', mode: 'flight' },
    { key: 'mars_touchdown', label: 'MARS // TOUCHDOWN', objective: 'DESCENT COMPLETE // FREE FLIGHT', mode: 'complete' },
  ],
  checkpoints: [],
};
