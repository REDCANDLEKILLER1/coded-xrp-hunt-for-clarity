import type { MissionDef } from './types';

/**
 * Moon mission: Part 1, Act 2.
 *
 * After capturing the warship on Earth, the player flies to the Moon for a
 * long 2D lunar campaign, then breaches the lunar base for a turn-based
 * capture mission. Victory grants the player their second hub (lunar base)
 * and unlocks Mars.
 *
 * Design notes:
 * - Low-gravity identity: enemies drift (slower, floatier movement).
 * - Dark side act: reduced visibility, no Earth-shine.
 * - New threats demonstrated alone before combined (same authored-encounter
 *   discipline as Earth).
 * - base_breach is the handoff act: final 2D assault, then the turn-based
 *   base capture takes over. moon_secured fires after the base is captured.
 */
export const MOON_MISSION: MissionDef = {
  key: 'moon_lunar_campaign',
  planetKey: 'moon',
  label: 'MOON // LUNAR CAMPAIGN',
  acts: [
    { key: 'deployment', label: 'LUNAR DEPLOYMENT', objective: 'APPROACH THE MOON // ESTABLISH ORBIT', mode: 'transition' },
    { key: 'orbital_approach', label: 'ORBITAL APPROACH', objective: 'BREAK THE LUNAR PICKET LINE', mode: 'flight' },
    { key: 'crater_field', label: 'CRATER FIELD', objective: 'NAVIGATE THE CRATERS // CLEAR AMBUSHERS', mode: 'flight' },
    { key: 'dark_side', label: 'DARK SIDE', objective: 'PUSH THROUGH THE DARK SIDE', mode: 'flight' },
    { key: 'base_approach', label: 'BASE APPROACH', objective: 'FIGHT TO THE LUNAR BASE', mode: 'flight' },
    { key: 'base_breach', label: 'BASE BREACH', objective: 'BREACH THE BASE // GO IN ON FOOT', mode: 'transition' },
    { key: 'moon_secured', label: 'MOON SECURED', objective: 'LUNAR BASE CAPTURED', mode: 'complete' },
  ],
  checkpoints: [
    { key: 'moon.launch', label: 'LAUNCH', resumeActKey: 'orbital_approach' },
    { key: 'moon.crater_field', label: 'CRATER FIELD', resumeActKey: 'crater_field' },
    { key: 'moon.dark_side', label: 'DARK SIDE', resumeActKey: 'dark_side' },
    { key: 'moon.base_approach', label: 'BASE APPROACH', resumeActKey: 'base_approach' },
    { key: 'moon.base_breach', label: 'BASE BREACH', resumeActKey: 'base_breach' },
    { key: 'moon.captured', label: 'BASE CAPTURED', resumeActKey: 'moon_secured' },
  ],
  encounters: {
    orbital_approach: {
      actKey: 'orbital_approach',
      stageKey: 'lunar_orbit',
      groups: [
        {
          label: 'DRIFTER SCREEN',
          restBefore: 1.0,
          spawns: [
            { kind: 'enemy', enemyKey: 'lunar_drifter', x: 0.3 },
            { kind: 'enemy', enemyKey: 'lunar_drifter', x: 0.7 },
          ],
        },
        {
          label: 'PICKET LINE',
          restBefore: 2.0,
          spawns: [
            { kind: 'enemy', enemyKey: 'lunar_drifter', x: 0.2 },
            { kind: 'enemy', enemyKey: 'regulator_drone', x: 0.5 },
            { kind: 'enemy', enemyKey: 'lunar_drifter', x: 0.8 },
          ],
        },
      ],
    },
    crater_field: {
      actKey: 'crater_field',
      stageKey: 'crater_field',
      groups: [
        {
          label: 'AMBUSHERS',
          restBefore: 1.0,
          spawns: [
            { kind: 'enemy', enemyKey: 'crater_ambusher', x: 0.25 },
            { kind: 'enemy', enemyKey: 'crater_ambusher', x: 0.75 },
          ],
        },
        {
          label: 'CRATER CROSSFIRE',
          restBefore: 2.0,
          spawns: [
            { kind: 'enemy', enemyKey: 'crater_ambusher', x: 0.2 },
            { kind: 'enemy', enemyKey: 'lunar_drifter', x: 0.5 },
            { kind: 'enemy', enemyKey: 'crater_ambusher', x: 0.8 },
          ],
        },
      ],
    },
    dark_side: {
      actKey: 'dark_side',
      stageKey: 'lunar_dark_side',
      groups: [
        {
          label: 'DARK PATROL',
          restBefore: 1.0,
          spawns: [
            { kind: 'enemy', enemyKey: 'lunar_raider', x: 0.5 },
          ],
        },
        {
          label: 'DARK SWARM',
          restBefore: 2.5,
          spawns: [
            { kind: 'enemy', enemyKey: 'lunar_raider', x: 0.3 },
            { kind: 'enemy', enemyKey: 'crater_ambusher', x: 0.5 },
            { kind: 'enemy', enemyKey: 'lunar_raider', x: 0.7 },
          ],
        },
      ],
    },
    base_approach: {
      actKey: 'base_approach',
      stageKey: 'lunar_base_approach',
      groups: [
        {
          label: 'BASE DEFENSES',
          restBefore: 1.0,
          spawns: [
            { kind: 'enemy', enemyKey: 'lunar_raider', x: 0.3 },
            { kind: 'enemy', enemyKey: 'lunar_raider', x: 0.7 },
          ],
        },
        {
          label: 'FINAL SCREEN',
          restBefore: 2.0,
          spawns: [
            { kind: 'enemy', enemyKey: 'lunar_drifter', x: 0.2 },
            { kind: 'enemy', enemyKey: 'lunar_raider', x: 0.4 },
            { kind: 'enemy', enemyKey: 'crater_ambusher', x: 0.6 },
            { kind: 'enemy', enemyKey: 'lunar_raider', x: 0.8 },
          ],
        },
      ],
    },
    base_breach: {
      actKey: 'base_breach',
      stageKey: 'lunar_base_breach',
      groups: [
        {
          label: 'BREACH RUN',
          restBefore: 0.5,
          spawns: [
            { kind: 'enemy', enemyKey: 'crater_ambusher', x: 0.5 },
          ],
        },
      ],
    },
  },
  musicCues: {
    deployment: 'transit',
    orbital_approach: 'level_one',
    crater_field: 'level_one',
    dark_side: 'guardian_protocol',
    base_approach: 'level_one',
    base_breach: 'boss_fight',
  },
  unlocks: ['mars'],
};
