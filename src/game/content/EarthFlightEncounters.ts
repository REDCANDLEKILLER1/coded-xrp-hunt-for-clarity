export interface EncounterSpawnDef {
  enemyKey: string;
  x: number;
}

export interface EncounterGroupDef {
  label: string;
  restBefore: number;
  spawns: EncounterSpawnDef[];
}

export interface EarthFlightEncounterDef {
  actKey: string;
  stageKey: string;
  groups: EncounterGroupDef[];
}

/**
 * Authored Level 1 air encounters. L1-C deliberately uses only enemies whose
 * runtime art is already live. Fast Scout, mines, and mixed ground threats land
 * in the later asset/defense-grid phases.
 */
export const EARTH_FLIGHT_ENCOUNTERS: Record<string, EarthFlightEncounterDef> = {
  orbital_approach: {
    actKey: 'orbital_approach',
    stageKey: 'deep_space_lane',
    groups: [
      { label: 'FIRST CONTACT', restBefore: 0.8, spawns: [
        { enemyKey: 'regulator_drone', x: 0.5 },
      ] },
      { label: 'BLOCKADE PAIR', restBefore: 1.05, spawns: [
        { enemyKey: 'regulator_drone', x: 0.32 },
        { enemyKey: 'regulator_drone', x: 0.68 },
      ] },
      { label: 'CENTER SCREEN', restBefore: 1.15, spawns: [
        { enemyKey: 'regulator_drone', x: 0.22 },
        { enemyKey: 'regulator_drone', x: 0.5 },
        { enemyKey: 'regulator_drone', x: 0.78 },
      ] },
      { label: 'INVASION LINE', restBefore: 1.3, spawns: [
        { enemyKey: 'regulator_drone', x: 0.18 },
        { enemyKey: 'regulator_drone', x: 0.38 },
        { enemyKey: 'regulator_drone', x: 0.62 },
        { enemyKey: 'regulator_drone', x: 0.82 },
      ] },
    ],
  },
  fog_belt: {
    actKey: 'fog_belt',
    stageKey: 'deep_space_lane',
    groups: [
      { label: 'FOG CONTACT', restBefore: 1.2, spawns: [
        { enemyKey: 'fog_raider', x: 0.28 },
        { enemyKey: 'fog_raider', x: 0.72 },
      ] },
      { label: 'ESCORT SCREEN', restBefore: 1.15, spawns: [
        { enemyKey: 'regulator_drone', x: 0.2 },
        { enemyKey: 'fog_raider', x: 0.5 },
        { enemyKey: 'regulator_drone', x: 0.8 },
      ] },
      { label: 'CROSSING RAID', restBefore: 1.25, spawns: [
        { enemyKey: 'fog_raider', x: 0.18 },
        { enemyKey: 'regulator_drone', x: 0.38 },
        { enemyKey: 'regulator_drone', x: 0.62 },
        { enemyKey: 'fog_raider', x: 0.82 },
      ] },
      { label: 'ORBITAL GATE', restBefore: 1.4, spawns: [
        { enemyKey: 'fog_raider', x: 0.15 },
        { enemyKey: 'regulator_drone', x: 0.32 },
        { enemyKey: 'fog_raider', x: 0.5 },
        { enemyKey: 'regulator_drone', x: 0.68 },
        { enemyKey: 'fog_raider', x: 0.85 },
      ] },
    ],
  },
  ledger_city: {
    actKey: 'ledger_city',
    stageKey: 'ledger_city',
    groups: [
      { label: 'ATMOSPHERIC ENTRY', restBefore: 1.5, spawns: [
        { enemyKey: 'regulator_drone', x: 0.3 },
        { enemyKey: 'regulator_drone', x: 0.7 },
      ] },
      { label: 'CITY APPROACH', restBefore: 1.1, spawns: [
        { enemyKey: 'fog_raider', x: 0.24 },
        { enemyKey: 'regulator_drone', x: 0.5 },
        { enemyKey: 'fog_raider', x: 0.76 },
      ] },
      { label: 'CIVILIAN CORRIDOR', restBefore: 1.25, spawns: [
        { enemyKey: 'regulator_drone', x: 0.16 },
        { enemyKey: 'regulator_drone', x: 0.38 },
        { enemyKey: 'regulator_drone', x: 0.62 },
        { enemyKey: 'regulator_drone', x: 0.84 },
      ] },
      { label: 'LEDGER CITY SCREEN', restBefore: 1.35, spawns: [
        { enemyKey: 'fog_raider', x: 0.18 },
        { enemyKey: 'regulator_drone', x: 0.34 },
        { enemyKey: 'fog_raider', x: 0.5 },
        { enemyKey: 'regulator_drone', x: 0.66 },
        { enemyKey: 'fog_raider', x: 0.82 },
      ] },
    ],
  },
  defense_grid: {
    actKey: 'defense_grid',
    stageKey: 'ledger_city',
    groups: [
      { label: 'GRID OUTER RING', restBefore: 1.25, spawns: [
        { enemyKey: 'regulator_drone', x: 0.25 },
        { enemyKey: 'fog_raider', x: 0.5 },
        { enemyKey: 'regulator_drone', x: 0.75 },
      ] },
      { label: 'GRID CROSSING', restBefore: 1.1, spawns: [
        { enemyKey: 'fog_raider', x: 0.15 },
        { enemyKey: 'fog_raider', x: 0.35 },
        { enemyKey: 'fog_raider', x: 0.65 },
        { enemyKey: 'fog_raider', x: 0.85 },
      ] },
      { label: 'GUARDIAN ESCORT', restBefore: 1.25, spawns: [
        { enemyKey: 'regulator_drone', x: 0.14 },
        { enemyKey: 'fog_raider', x: 0.32 },
        { enemyKey: 'regulator_drone', x: 0.5 },
        { enemyKey: 'fog_raider', x: 0.68 },
        { enemyKey: 'regulator_drone', x: 0.86 },
      ] },
      { label: 'DEFENSE GRID CORE', restBefore: 1.5, spawns: [
        { enemyKey: 'fog_raider', x: 0.12 },
        { enemyKey: 'regulator_drone', x: 0.28 },
        { enemyKey: 'fog_raider', x: 0.42 },
        { enemyKey: 'fog_raider', x: 0.58 },
        { enemyKey: 'regulator_drone', x: 0.72 },
        { enemyKey: 'fog_raider', x: 0.88 },
      ] },
    ],
  },
};

export function earthFlightEncounterFor(actKey: string | undefined): EarthFlightEncounterDef | undefined {
  return actKey ? EARTH_FLIGHT_ENCOUNTERS[actKey] : undefined;
}

export function validateEarthFlightEncounters(): string[] {
  const errors: string[] = [];
  const allowedEnemyKeys = new Set(['regulator_drone', 'fog_raider']);
  const allowedStageKeys = new Set(['deep_space_lane', 'ledger_city']);

  for (const [key, encounter] of Object.entries(EARTH_FLIGHT_ENCOUNTERS)) {
    if (encounter.actKey !== key) errors.push(`earthEncounter.${key}: actKey mismatch`);
    if (!allowedStageKeys.has(encounter.stageKey)) errors.push(`earthEncounter.${key}: unsupported stage ${encounter.stageKey}`);
    if (encounter.groups.length < 3) errors.push(`earthEncounter.${key}: expected at least three authored groups`);
    for (const [index, group] of encounter.groups.entries()) {
      if (!group.label || group.restBefore < 0) errors.push(`earthEncounter.${key}.group${index}: invalid label/rest`);
      if (group.spawns.length === 0) errors.push(`earthEncounter.${key}.group${index}: no spawns`);
      for (const spawn of group.spawns) {
        if (!allowedEnemyKeys.has(spawn.enemyKey)) errors.push(`earthEncounter.${key}: enemy ${spawn.enemyKey} is not in L1-C scope`);
        if (!(spawn.x > 0 && spawn.x < 1)) errors.push(`earthEncounter.${key}: spawn x must be inside 0..1`);
      }
    }
  }

  return errors;
}

/**
 * Pure authored-group sequencer. It never owns actors; the game reports how
 * many authored enemies are still active and consumes spawn groups from here.
 */
export class EarthFlightEncounterDirector {
  private encounter: EarthFlightEncounterDef | null = null;
  private groupIndex = 0;
  private wait = 0;
  private groupSpawned = false;
  private done = false;

  start(actKey: string): void {
    this.encounter = earthFlightEncounterFor(actKey) ?? null;
    this.groupIndex = 0;
    this.wait = this.encounter?.groups[0]?.restBefore ?? 0;
    this.groupSpawned = false;
    this.done = false;
  }

  clear(): void {
    this.encounter = null;
    this.groupIndex = 0;
    this.wait = 0;
    this.groupSpawned = false;
    this.done = false;
  }

  update(dt: number, activeEnemyCount: number): { spawns: EncounterSpawnDef[]; completed: boolean } {
    if (!this.encounter || this.done) return { spawns: [], completed: this.done };

    if (this.groupSpawned && activeEnemyCount <= 0) {
      this.groupIndex += 1;
      this.groupSpawned = false;
      if (this.groupIndex >= this.encounter.groups.length) {
        this.done = true;
        return { spawns: [], completed: true };
      }
      this.wait = this.encounter.groups[this.groupIndex].restBefore;
    }

    if (this.groupSpawned) return { spawns: [], completed: false };
    this.wait = Math.max(0, this.wait - Math.max(0, dt));
    if (this.wait > 0) return { spawns: [], completed: false };

    this.groupSpawned = true;
    return { spawns: this.encounter.groups[this.groupIndex].spawns, completed: false };
  }

  get active(): boolean { return this.encounter !== null; }
  get currentGroupNumber(): number { return this.encounter ? Math.min(this.groupIndex + 1, this.encounter.groups.length) : 0; }
  get totalGroups(): number { return this.encounter?.groups.length ?? 0; }
  get currentGroupLabel(): string | undefined { return this.encounter?.groups[this.groupIndex]?.label; }
  get stageKey(): string | undefined { return this.encounter?.stageKey; }
}
