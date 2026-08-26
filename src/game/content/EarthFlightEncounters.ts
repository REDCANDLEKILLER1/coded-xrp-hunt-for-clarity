export type EncounterSpawnDef =
  | { kind: 'enemy'; enemyKey: string; x: number }
  | { kind: 'hazard'; hazardKey: string; x: number; side?: -1 | 1 };

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

const enemy = (enemyKey: string, x: number): EncounterSpawnDef => ({ kind: 'enemy', enemyKey, x });
const hazard = (hazardKey: string, x: number, side?: -1 | 1): EncounterSpawnDef => ({ kind: 'hazard', hazardKey, x, side });

/**
 * Authored Earth flight sequence. New threats are always demonstrated alone
 * before they are combined, so difficulty grows through decisions/readability
 * rather than raw object count.
 */
export const EARTH_FLIGHT_ENCOUNTERS: Record<string, EarthFlightEncounterDef> = {
  orbital_approach: {
    actKey: 'orbital_approach',
    stageKey: 'deep_space_lane',
    groups: [
      { label: 'FIRST CONTACT', restBefore: 0.8, spawns: [enemy('regulator_drone', 0.5)] },
      { label: 'BLOCKADE PAIR', restBefore: 1.05, spawns: [enemy('regulator_drone', 0.32), enemy('regulator_drone', 0.68)] },
      { label: 'CENTER SCREEN', restBefore: 1.15, spawns: [enemy('regulator_drone', 0.22), enemy('regulator_drone', 0.5), enemy('regulator_drone', 0.78)] },
      { label: 'INVASION LINE', restBefore: 1.3, spawns: [enemy('regulator_drone', 0.18), enemy('regulator_drone', 0.38), enemy('regulator_drone', 0.62), enemy('regulator_drone', 0.82)] },
    ],
  },
  fog_belt: {
    actKey: 'fog_belt',
    stageKey: 'deep_space_lane',
    groups: [
      { label: 'FOG CONTACT', restBefore: 1.2, spawns: [enemy('fog_raider', 0.28), enemy('fog_raider', 0.72)] },
      { label: 'FAST SCOUT // FIRST PASS', restBefore: 1.35, spawns: [enemy('fast_scout', 0.5)] },
      { label: 'SCOUT ESCORT', restBefore: 1.2, spawns: [enemy('regulator_drone', 0.2), enemy('fast_scout', 0.5), enemy('regulator_drone', 0.8)] },
      { label: 'CROSSING RAID', restBefore: 1.25, spawns: [enemy('fog_raider', 0.18), enemy('fast_scout', 0.38), enemy('fast_scout', 0.62), enemy('fog_raider', 0.82)] },
      { label: 'ORBITAL GATE', restBefore: 1.4, spawns: [enemy('fog_raider', 0.16), enemy('regulator_drone', 0.34), enemy('fast_scout', 0.5), enemy('regulator_drone', 0.66), enemy('fog_raider', 0.84)] },
    ],
  },
  ledger_city: {
    actKey: 'ledger_city',
    stageKey: 'ledger_city',
    groups: [
      { label: 'ATMOSPHERIC ENTRY', restBefore: 1.5, spawns: [enemy('regulator_drone', 0.3), enemy('regulator_drone', 0.7)] },
      { label: 'GROUND FIRE // BASIC TURRET', restBefore: 1.45, spawns: [hazard('basic_turret', 0.12, -1)] },
      { label: 'CITY APPROACH', restBefore: 1.2, spawns: [enemy('fog_raider', 0.24), enemy('regulator_drone', 0.5), enemy('fog_raider', 0.76)] },
      { label: 'FIRST CROSSFIRE', restBefore: 1.25, spawns: [hazard('basic_turret', 0.88, 1), enemy('regulator_drone', 0.34), enemy('regulator_drone', 0.66)] },
      { label: 'LEDGER CITY SCREEN', restBefore: 1.35, spawns: [hazard('basic_turret', 0.1, -1), enemy('fog_raider', 0.3), enemy('fast_scout', 0.5), enemy('fog_raider', 0.7)] },
    ],
  },
  defense_grid: {
    actKey: 'defense_grid',
    stageKey: 'ledger_city',
    groups: [
      { label: 'MINE WARNING // FIRST CONTACT', restBefore: 1.4, spawns: [hazard('armored_space_mine', 0.5)] },
      { label: 'MINE CORRIDOR', restBefore: 1.3, spawns: [hazard('armored_space_mine', 0.32), hazard('armored_space_mine', 0.68)] },
      { label: 'CANNON TURRET // FIRST CONTACT', restBefore: 1.45, spawns: [hazard('cannon_turret', 0.12, -1)] },
      { label: 'SCOUT CROSSFIRE', restBefore: 1.25, spawns: [hazard('cannon_turret', 0.88, 1), enemy('fast_scout', 0.35), enemy('fast_scout', 0.65)] },
      { label: 'DEFENSE GRID CORE', restBefore: 1.5, spawns: [hazard('basic_turret', 0.1, -1), hazard('cannon_turret', 0.9, 1), hazard('armored_space_mine', 0.34), hazard('armored_space_mine', 0.66), enemy('fog_raider', 0.5)] },
    ],
  },
  final_assault: {
    actKey: 'final_assault',
    stageKey: 'regulatory_outpost',
    groups: [
      { label: 'FORTRESS APPROACH', restBefore: 1.8, spawns: [enemy('fast_scout', 0.3), enemy('fast_scout', 0.7)] },
      { label: 'CANNON SCREEN', restBefore: 1.35, spawns: [hazard('cannon_turret', 0.1, -1), enemy('fog_raider', 0.5), hazard('cannon_turret', 0.9, 1)] },
      { label: 'MINE + SCOUT PRESSURE', restBefore: 1.25, spawns: [hazard('armored_space_mine', 0.3), enemy('fast_scout', 0.5), hazard('armored_space_mine', 0.7)] },
      { label: 'CAPITAL SHIP ESCORT', restBefore: 1.45, spawns: [hazard('cannon_turret', 0.1, -1), enemy('fog_raider', 0.32), enemy('fast_scout', 0.5), enemy('fog_raider', 0.68), hazard('cannon_turret', 0.9, 1)] },
    ],
  },
};

export function earthFlightEncounterFor(actKey: string | undefined): EarthFlightEncounterDef | undefined {
  return actKey ? EARTH_FLIGHT_ENCOUNTERS[actKey] : undefined;
}

export function validateEarthFlightEncounters(): string[] {
  const errors: string[] = [];
  const allowedEnemyKeys = new Set(['regulator_drone', 'fog_raider', 'fast_scout']);
  const allowedHazardKeys = new Set(['basic_turret', 'cannon_turret', 'armored_space_mine']);
  const allowedStageKeys = new Set(['deep_space_lane', 'ledger_city', 'regulatory_outpost']);

  for (const [key, encounter] of Object.entries(EARTH_FLIGHT_ENCOUNTERS)) {
    if (encounter.actKey !== key) errors.push(`earthEncounter.${key}: actKey mismatch`);
    if (!allowedStageKeys.has(encounter.stageKey)) errors.push(`earthEncounter.${key}: unsupported stage ${encounter.stageKey}`);
    if (encounter.groups.length < 4) errors.push(`earthEncounter.${key}: expected at least four authored groups`);
    for (const [index, group] of encounter.groups.entries()) {
      if (!group.label || group.restBefore < 0) errors.push(`earthEncounter.${key}.group${index}: invalid label/rest`);
      if (group.spawns.length === 0) errors.push(`earthEncounter.${key}.group${index}: no spawns`);
      for (const spawn of group.spawns) {
        if (!(spawn.x > 0 && spawn.x < 1)) errors.push(`earthEncounter.${key}: spawn x must be inside 0..1`);
        if (spawn.kind === 'enemy' && !allowedEnemyKeys.has(spawn.enemyKey)) {
          errors.push(`earthEncounter.${key}: enemy ${spawn.enemyKey} is outside Earth scope`);
        }
        if (spawn.kind === 'hazard' && !allowedHazardKeys.has(spawn.hazardKey)) {
          errors.push(`earthEncounter.${key}: hazard ${spawn.hazardKey} is outside Earth scope`);
        }
      }
    }
  }

  const fogGroups = EARTH_FLIGHT_ENCOUNTERS.fog_belt?.groups ?? [];
  const cityGroups = EARTH_FLIGHT_ENCOUNTERS.ledger_city?.groups ?? [];
  const gridGroups = EARTH_FLIGHT_ENCOUNTERS.defense_grid?.groups ?? [];
  if (!fogGroups.some((group) => group.spawns.length === 1 && group.spawns[0].kind === 'enemy' && group.spawns[0].enemyKey === 'fast_scout')) {
    errors.push('earthEncounter.fog_belt: Fast Scout must be introduced alone');
  }
  if (!cityGroups.some((group) => group.spawns.length === 1 && group.spawns[0].kind === 'hazard' && group.spawns[0].hazardKey === 'basic_turret')) {
    errors.push('earthEncounter.ledger_city: Basic Turret must be introduced alone');
  }
  if (!gridGroups.some((group) => group.spawns.length === 1 && group.spawns[0].kind === 'hazard' && group.spawns[0].hazardKey === 'armored_space_mine')) {
    errors.push('earthEncounter.defense_grid: Armored Space Mine must be introduced alone');
  }
  if (!gridGroups.some((group) => group.spawns.length === 1 && group.spawns[0].kind === 'hazard' && group.spawns[0].hazardKey === 'cannon_turret')) {
    errors.push('earthEncounter.defense_grid: Cannon Turret must be introduced alone');
  }
  if (EARTH_FLIGHT_ENCOUNTERS.final_assault?.stageKey !== 'regulatory_outpost') {
    errors.push('earthEncounter.final_assault: final approach must use the Regulatory Outpost stage');
  }

  return errors;
}

/**
 * Pure authored-group sequencer. It never owns actors; the game reports the
 * number of authored air/ground threats still active before the next group.
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

  update(dt: number, activeThreatCount: number): { spawns: EncounterSpawnDef[]; completed: boolean } {
    if (!this.encounter || this.done) return { spawns: [], completed: this.done };

    if (this.groupSpawned && activeThreatCount <= 0) {
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
