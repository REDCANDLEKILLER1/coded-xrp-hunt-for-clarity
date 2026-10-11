import type { EncounterGroupDef, EncounterSpawnDef } from './EarthFlightEncounters';
import { MARS_ENEMIES } from './MarsThreats';

export interface MarsFlightEncounterDef {
  actKey: string;
  stageKey: string;
  groups: EncounterGroupDef[];
}

const enemy = (enemyKey: string, x: number): EncounterSpawnDef => ({ kind: 'enemy', enemyKey, x });

/**
 * Authored Mars descent encounters (reference pack v2).
 *
 * Only AIRBORNE units appear here — every spawn key must exist in
 * MARS_ENEMIES. Ground units (waxguard, furnace_crawler, drain_leech) are
 * defined in MarsThreats but intentionally unwired; see the mechanics gaps
 * documented there.
 *
 * Pacing follows the same rule as Earth's tables: a threat is demonstrated
 * alone before it is ever mixed in. The descent itself is the clock — acts
 * advance on the background tile roll, and whatever is still alive is
 * cleared on the boundary — so groups are sized to fit their act's window.
 */
export const MARS_FLIGHT_ENCOUNTERS: Record<string, MarsFlightEncounterDef> = {
  mars_orbital_drop: {
    actKey: 'mars_orbital_drop',
    stageKey: 'mars_descent',
    groups: [
      { label: 'DUST CONTACT // FIRST CONTACT', restBefore: 1.2, spawns: [enemy('dust_stalker', 0.5)] },
      { label: 'STALKER PAIR', restBefore: 1.4, spawns: [enemy('dust_stalker', 0.32), enemy('dust_stalker', 0.68)] },
      { label: 'STALKER WEAVE', restBefore: 1.5, spawns: [enemy('dust_stalker', 0.24), enemy('dust_stalker', 0.5), enemy('dust_stalker', 0.76)] },
      { label: 'MARS RAIDER // FIRST CONTACT', restBefore: 1.8, spawns: [enemy('mars_raider', 0.5)] },
      { label: 'RAIDER ESCORT', restBefore: 1.6, spawns: [enemy('dust_stalker', 0.28), enemy('mars_raider', 0.55), enemy('dust_stalker', 0.78)] },
    ],
  },
  mars_dust_storm: {
    actKey: 'mars_dust_storm',
    stageKey: 'mars_descent',
    groups: [
      { label: 'STORM SCREEN', restBefore: 1.4, spawns: [enemy('dust_stalker', 0.22), enemy('dust_stalker', 0.5), enemy('dust_stalker', 0.78)] },
      { label: 'CANYON AMBUSHER // FIRST CONTACT', restBefore: 1.8, spawns: [enemy('canyon_ambusher', 0.5)] },
      { label: 'AMBUSH PAIR', restBefore: 1.5, spawns: [enemy('canyon_ambusher', 0.34), enemy('canyon_ambusher', 0.66)] },
      { label: 'DUST AND CLAW', restBefore: 1.5, spawns: [enemy('dust_stalker', 0.24), enemy('canyon_ambusher', 0.52), enemy('dust_stalker', 0.78)] },
      { label: 'RAIDER IN THE STORM', restBefore: 1.6, spawns: [enemy('mars_raider', 0.3), enemy('canyon_ambusher', 0.55), enemy('dust_stalker', 0.76)] },
      { label: 'STORM WALL', restBefore: 1.7, spawns: [enemy('dust_stalker', 0.18), enemy('canyon_ambusher', 0.4), enemy('canyon_ambusher', 0.62), enemy('dust_stalker', 0.84)] },
    ],
  },
  mars_canyon_run: {
    actKey: 'mars_canyon_run',
    stageKey: 'mars_descent',
    groups: [
      { label: 'CANYON PATROL', restBefore: 1.4, spawns: [enemy('canyon_ambusher', 0.28), enemy('canyon_ambusher', 0.72)] },
      { label: 'DIVE PAIR', restBefore: 1.5, spawns: [enemy('canyon_ambusher', 0.3), enemy('dust_stalker', 0.5), enemy('canyon_ambusher', 0.7)] },
      { label: 'RAIDER OVERWATCH', restBefore: 1.6, spawns: [enemy('mars_raider', 0.5), enemy('dust_stalker', 0.26), enemy('dust_stalker', 0.74)] },
      { label: 'AMBUSH LINE', restBefore: 1.5, spawns: [enemy('canyon_ambusher', 0.2), enemy('canyon_ambusher', 0.42), enemy('canyon_ambusher', 0.62), enemy('canyon_ambusher', 0.82)] },
      { label: 'HEAVY ESCORT', restBefore: 1.6, spawns: [enemy('mars_raider', 0.32), enemy('mars_raider', 0.68), enemy('canyon_ambusher', 0.5)] },
      { label: 'CANYON GAUNTLET', restBefore: 1.7, spawns: [enemy('canyon_ambusher', 0.18), enemy('dust_stalker', 0.38), enemy('mars_raider', 0.58), enemy('dust_stalker', 0.8)] },
    ],
  },
  mars_surface_run: {
    actKey: 'mars_surface_run',
    stageKey: 'mars_descent',
    groups: [
      { label: 'SURFACE SCREEN', restBefore: 1.4, spawns: [enemy('dust_stalker', 0.26), enemy('canyon_ambusher', 0.5), enemy('dust_stalker', 0.74)] },
      { label: 'RAIDER PAIR', restBefore: 1.6, spawns: [enemy('mars_raider', 0.34), enemy('mars_raider', 0.66)] },
      { label: 'COMBINED ARMS', restBefore: 1.5, spawns: [enemy('canyon_ambusher', 0.22), enemy('mars_raider', 0.46), enemy('dust_stalker', 0.68)] },
      { label: 'DUST SWARM', restBefore: 1.5, spawns: [enemy('dust_stalker', 0.18), enemy('dust_stalker', 0.4), enemy('dust_stalker', 0.6), enemy('dust_stalker', 0.82)] },
      { label: 'KING\'S VANGUARD', restBefore: 1.7, spawns: [enemy('mars_raider', 0.26), enemy('canyon_ambusher', 0.5), enemy('mars_raider', 0.74)] },
      { label: 'FINAL SCREEN', restBefore: 1.8, spawns: [enemy('canyon_ambusher', 0.16), enemy('mars_raider', 0.38), enemy('mars_raider', 0.62), enemy('dust_stalker', 0.84)] },
    ],
  },
};

export function marsFlightEncounterFor(actKey: string | undefined): MarsFlightEncounterDef | undefined {
  return actKey ? MARS_FLIGHT_ENCOUNTERS[actKey] : undefined;
}

/**
 * Every airborne Mars threat is introduced alone before it is ever mixed in.
 */
const MARS_SOLO_INTRODUCTIONS: Array<{ actKey: string; key: string }> = [
  { actKey: 'mars_orbital_drop', key: 'dust_stalker' },
  { actKey: 'mars_orbital_drop', key: 'mars_raider' },
  { actKey: 'mars_dust_storm', key: 'canyon_ambusher' },
];

export function validateMarsEncounters(): string[] {
  const errors: string[] = [];
  const marsActKeys = ['mars_orbital_drop', 'mars_dust_storm', 'mars_canyon_run', 'mars_surface_run'];

  for (const actKey of marsActKeys) {
    const encounter = MARS_FLIGHT_ENCOUNTERS[actKey];
    if (!encounter) { errors.push(`marsEncounter: missing table for act ${actKey}`); continue; }
    if (encounter.actKey !== actKey) errors.push(`marsEncounter.${actKey}: actKey mismatch`);
    if (encounter.stageKey !== 'mars_descent') errors.push(`marsEncounter.${actKey}: stageKey must be mars_descent`);
    if (encounter.groups.length < 4) errors.push(`marsEncounter.${actKey}: expected at least four authored groups`);
    for (const [index, group] of encounter.groups.entries()) {
      if (!group.label || group.restBefore < 0) errors.push(`marsEncounter.${actKey}.group${index}: invalid label/rest`);
      if (group.spawns.length === 0) errors.push(`marsEncounter.${actKey}.group${index}: no spawns`);
      for (const spawn of group.spawns) {
        if (!(spawn.x > 0 && spawn.x < 1)) errors.push(`marsEncounter.${actKey}: spawn x must be inside 0..1`);
        // Airborne only: every spawn key must be a WIRED Mars enemy.
        if (spawn.kind === 'enemy' && !MARS_ENEMIES[spawn.enemyKey]) {
          errors.push(`marsEncounter.${actKey}: ${spawn.enemyKey} is not a wired Mars airborne enemy`);
        }
        if (spawn.kind === 'hazard') errors.push(`marsEncounter.${actKey}: hazards are not authored for Mars flight`);
      }
    }
  }

  // No table may claim an act that isn't a Mars flight act.
  for (const key of Object.keys(MARS_FLIGHT_ENCOUNTERS)) {
    if (!marsActKeys.includes(key)) errors.push(`marsEncounter.${key}: not a Mars flight act`);
  }

  // Solo introductions: alone first, never mixed earlier.
  const spawnKey = (spawn: EncounterSpawnDef): string => (spawn.kind === 'enemy' ? spawn.enemyKey : spawn.hazardKey);
  for (const intro of MARS_SOLO_INTRODUCTIONS) {
    const groups = MARS_FLIGHT_ENCOUNTERS[intro.actKey]?.groups ?? [];
    const soloIndex = groups.findIndex(
      (group) => group.spawns.length === 1 && spawnKey(group.spawns[0]) === intro.key,
    );
    if (soloIndex < 0) { errors.push(`marsEncounter.${intro.actKey}: ${intro.key} must be introduced alone`); continue; }
    const mixedEarlier = groups.slice(0, soloIndex).some(
      (group) => group.spawns.length > 1 && group.spawns.some((spawn) => spawnKey(spawn) === intro.key),
    );
    if (mixedEarlier) errors.push(`marsEncounter.${intro.actKey}: ${intro.key} appears mixed before its solo introduction`);
    for (const earlier of marsActKeys.slice(0, marsActKeys.indexOf(intro.actKey))) {
      const used = (MARS_FLIGHT_ENCOUNTERS[earlier]?.groups ?? []).some(
        (group) => group.spawns.some((spawn) => spawnKey(spawn) === intro.key),
      );
      if (used) errors.push(`marsEncounter.${earlier}: ${intro.key} is used before it is introduced in ${intro.actKey}`);
    }
  }

  return errors;
}
