import type { MissionDef } from './types';

/**
 * Mars mission: Part 1, Act 3 (finale).
 *
 * After capturing the lunar base, the player flies to Mars for a 2D surface
 * campaign through dust storms and canyons, then faces the Red Candle King
 * in a turn-based boss fight. Victory ends Part 1 with "To Be Continued."
 *
 * Design notes:
 * - Red dust identity: dust storms obscure enemies (visibility pattern
 *   reused from the cloud-descent work).
 * - Dust stalkers emerge from dust clouds; canyon ambushers strike from cover.
 * - New threats demonstrated alone before combined (authored-encounter
 *   discipline).
 * - kings_gate is the handoff act: final 2D assault, then the turn-based
 *   Red Candle King fight takes over. mars_secured fires after the King falls.
 */
export const MARS_MISSION: MissionDef = {
  key: 'mars_red_candle',
  planetKey: 'mars',
  label: 'MARS // RED CANDLE',
  acts: [
    { key: 'deployment', label: 'MARS DEPLOYMENT', objective: 'ENTER THE RED DUST // ESTABLISH ORBIT', mode: 'transition' },
    { key: 'orbital_approach', label: 'ORBITAL APPROACH', objective: 'BREAK THE MARS PICKET LINE', mode: 'flight' },
    { key: 'dust_storm', label: 'DUST STORM', objective: 'PUSH THROUGH THE DUST STORM', mode: 'flight' },
    { key: 'canyon_run', label: 'CANYON RUN', objective: 'NAVIGATE THE CANYONS // SURVIVE AMBUSHES', mode: 'flight' },
    { key: 'surface_assault', label: 'SURFACE ASSAULT', objective: 'FIGHT TO THE KING\'S LAIR', mode: 'flight' },
    { key: 'kings_gate', label: 'THE KING\'S GATE', objective: 'BREACH THE GATE // FACE THE KING', mode: 'transition' },
    { key: 'mars_secured', label: 'MARS SECURED', objective: 'THE RED CANDLE KING HAS FALLEN', mode: 'complete' },
  ],
  checkpoints: [
    { key: 'mars.launch', label: 'LAUNCH', resumeActKey: 'orbital_approach' },
    { key: 'mars.dust_storm', label: 'DUST STORM', resumeActKey: 'dust_storm' },
    { key: 'mars.canyon_run', label: 'CANYON RUN', resumeActKey: 'canyon_run' },
    { key: 'mars.surface_assault', label: 'SURFACE ASSAULT', resumeActKey: 'surface_assault' },
    { key: 'mars.kings_gate', label: 'THE KING\'S GATE', resumeActKey: 'kings_gate' },
    { key: 'mars.secured', label: 'KING DEFEATED', resumeActKey: 'mars_secured' },
  ],
  encounters: {
    orbital_approach: {
      actKey: 'orbital_approach',
      stageKey: 'mars_orbit',
      groups: [
        {
          label: 'DUST SCREEN',
          restBefore: 1.0,
          spawns: [
            { kind: 'enemy', enemyKey: 'dust_stalker', x: 0.3 },
            { kind: 'enemy', enemyKey: 'dust_stalker', x: 0.7 },
          ],
        },
        {
          label: 'ORBITAL PICKET',
          restBefore: 2.0,
          spawns: [
            { kind: 'enemy', enemyKey: 'dust_stalker', x: 0.2 },
            { kind: 'enemy', enemyKey: 'regulator_drone', x: 0.5 },
            { kind: 'enemy', enemyKey: 'dust_stalker', x: 0.8 },
          ],
        },
      ],
    },
    dust_storm: {
      actKey: 'dust_storm',
      stageKey: 'mars_dust_storm',
      groups: [
        {
          label: 'STORM STALKERS',
          restBefore: 1.0,
          spawns: [
            { kind: 'enemy', enemyKey: 'dust_stalker', x: 0.5 },
          ],
        },
        {
          label: 'DUST AMBUSH',
          restBefore: 2.5,
          spawns: [
            { kind: 'enemy', enemyKey: 'dust_stalker', x: 0.25 },
            { kind: 'enemy', enemyKey: 'dust_stalker', x: 0.5 },
            { kind: 'enemy', enemyKey: 'dust_stalker', x: 0.75 },
          ],
        },
      ],
    },
    canyon_run: {
      actKey: 'canyon_run',
      stageKey: 'mars_canyon',
      groups: [
        {
          label: 'CANYON AMBUSH',
          restBefore: 1.0,
          spawns: [
            { kind: 'enemy', enemyKey: 'canyon_ambusher', x: 0.3 },
            { kind: 'enemy', enemyKey: 'canyon_ambusher', x: 0.7 },
          ],
        },
        {
          label: 'CROSSFIRE',
          restBefore: 2.0,
          spawns: [
            { kind: 'enemy', enemyKey: 'canyon_ambusher', x: 0.2 },
            { kind: 'enemy', enemyKey: 'dust_stalker', x: 0.5 },
            { kind: 'enemy', enemyKey: 'canyon_ambusher', x: 0.8 },
          ],
        },
      ],
    },
    surface_assault: {
      actKey: 'surface_assault',
      stageKey: 'mars_surface',
      groups: [
        {
          label: 'KING\'S GUARD',
          restBefore: 1.0,
          spawns: [
            { kind: 'enemy', enemyKey: 'mars_raider', x: 0.3 },
            { kind: 'enemy', enemyKey: 'mars_raider', x: 0.7 },
          ],
        },
        {
          label: 'FINAL SCREEN',
          restBefore: 2.0,
          spawns: [
            { kind: 'enemy', enemyKey: 'dust_stalker', x: 0.2 },
            { kind: 'enemy', enemyKey: 'mars_raider', x: 0.4 },
            { kind: 'enemy', enemyKey: 'canyon_ambusher', x: 0.6 },
            { kind: 'enemy', enemyKey: 'mars_raider', x: 0.8 },
          ],
        },
      ],
    },
    kings_gate: {
      actKey: 'kings_gate',
      stageKey: 'kings_gate',
      groups: [
        {
          label: 'GATE RUN',
          restBefore: 0.5,
          spawns: [
            { kind: 'enemy', enemyKey: 'canyon_ambusher', x: 0.5 },
          ],
        },
      ],
    },
  },
  musicCues: {
    deployment: 'transit',
    orbital_approach: 'level_one',
    dust_storm: 'guardian_protocol',
    canyon_run: 'level_one',
    surface_assault: 'boss_fight',
    kings_gate: 'boss_fight',
  },
  unlocks: [],
};
