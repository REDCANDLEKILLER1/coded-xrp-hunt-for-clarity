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
      { label: 'WHALE SCOUT // FIRST CONTACT', restBefore: 1.4, spawns: [enemy('whale_scout', 0.5)] },
      { label: 'ESCORTED WHALE', restBefore: 1.2, spawns: [enemy('regulator_drone', 0.25), enemy('whale_scout', 0.5), enemy('regulator_drone', 0.75)] },
      { label: 'CLARITY ASTEROID // FIRST CONTACT', restBefore: 1.45, spawns: [hazard('asteroid', 0.5)] },
      { label: 'ROCK CORRIDOR', restBefore: 1.25, spawns: [hazard('asteroid', 0.3), hazard('asteroid', 0.7)] },
      { label: 'DRIFTING BLOCKADE', restBefore: 1.3, spawns: [hazard('asteroid', 0.26), enemy('regulator_drone', 0.5), hazard('asteroid', 0.74)] },
      { label: 'INVASION LINE', restBefore: 1.35, spawns: [enemy('regulator_drone', 0.18), enemy('regulator_drone', 0.38), enemy('regulator_drone', 0.62), enemy('regulator_drone', 0.82)] },
      { label: 'DRONE WEDGE', restBefore: 1.25, spawns: [enemy('regulator_drone', 0.28), enemy('regulator_drone', 0.5), enemy('regulator_drone', 0.72), enemy('whale_scout', 0.5)] },
      { label: 'ROCK AND SCREEN', restBefore: 1.3, spawns: [hazard('asteroid', 0.18), enemy('regulator_drone', 0.4), enemy('regulator_drone', 0.6), hazard('asteroid', 0.82)] },
      { label: 'WHALE PAIR', restBefore: 1.35, spawns: [enemy('whale_scout', 0.34), enemy('whale_scout', 0.66)] },
      { label: 'DEBRIS FIELD', restBefore: 1.3, spawns: [hazard('asteroid', 0.2), hazard('asteroid', 0.4), hazard('asteroid', 0.6), hazard('asteroid', 0.8)] },
      { label: 'ORBITAL SCREEN', restBefore: 1.5, spawns: [hazard('asteroid', 0.16), enemy('regulator_drone', 0.34), enemy('whale_scout', 0.5), enemy('regulator_drone', 0.66), hazard('asteroid', 0.84)] },
    ],
  },
  fog_belt: {
    actKey: 'fog_belt',
    stageKey: 'deep_space_lane',
    groups: [
      { label: 'FOG CONTACT', restBefore: 1.2, spawns: [enemy('fog_raider', 0.28), enemy('fog_raider', 0.72)] },
      { label: 'FAST SCOUT // FIRST PASS', restBefore: 1.35, spawns: [enemy('fast_scout', 0.5)] },
      { label: 'SCOUT ESCORT', restBefore: 1.2, spawns: [enemy('regulator_drone', 0.2), enemy('fast_scout', 0.5), enemy('regulator_drone', 0.8)] },
      { label: 'FOG WALL', restBefore: 1.3, spawns: [enemy('fog_raider', 0.18), enemy('fog_raider', 0.4), enemy('fog_raider', 0.6), enemy('fog_raider', 0.82)] },
      { label: 'CROSSING RAID', restBefore: 1.25, spawns: [enemy('fog_raider', 0.18), enemy('fast_scout', 0.38), enemy('fast_scout', 0.62), enemy('fog_raider', 0.82)] },
      { label: 'RUG FIGHTER // FIRST CONTACT', restBefore: 1.45, spawns: [enemy('rug_fighter', 0.5)] },
      { label: 'RUG PAIR', restBefore: 1.25, spawns: [enemy('rug_fighter', 0.34), enemy('rug_fighter', 0.66)] },
      { label: 'RUG AND SCOUT', restBefore: 1.2, spawns: [enemy('rug_fighter', 0.24), enemy('fast_scout', 0.5), enemy('rug_fighter', 0.76)] },
      { label: 'FOG AND ROCK', restBefore: 1.3, spawns: [hazard('asteroid', 0.22), enemy('fog_raider', 0.42), enemy('fog_raider', 0.58), hazard('asteroid', 0.78)] },
      { label: 'SCOUT SWARM', restBefore: 1.35, spawns: [enemy('fast_scout', 0.2), enemy('fast_scout', 0.4), enemy('fast_scout', 0.6), enemy('fast_scout', 0.8)] },
      { label: 'WHALE IN THE FOG', restBefore: 1.3, spawns: [enemy('fog_raider', 0.26), enemy('whale_scout', 0.5), enemy('fog_raider', 0.74)] },
      { label: 'RAIDER WEDGE', restBefore: 1.3, spawns: [enemy('fog_raider', 0.24), enemy('fog_raider', 0.42), enemy('fog_raider', 0.58), enemy('fog_raider', 0.76), enemy('fast_scout', 0.5)] },
      { label: 'RUG AND ROCK', restBefore: 1.35, spawns: [hazard('asteroid', 0.2), enemy('rug_fighter', 0.44), enemy('rug_fighter', 0.66), hazard('asteroid', 0.82)] },
      { label: 'SCOUT INTERCEPT', restBefore: 1.25, spawns: [enemy('fast_scout', 0.24), enemy('whale_scout', 0.5), enemy('fast_scout', 0.76)] },
      { label: 'DEEP FOG', restBefore: 1.35, spawns: [enemy('fog_raider', 0.18), enemy('rug_fighter', 0.36), enemy('fast_scout', 0.5), enemy('rug_fighter', 0.64), enemy('fog_raider', 0.82)] },
      { label: 'HEAVY DRIFT', restBefore: 1.4, spawns: [hazard('asteroid', 0.3), enemy('whale_scout', 0.5), hazard('asteroid', 0.7), enemy('rug_fighter', 0.5)] },
      { label: 'BELT PATROL', restBefore: 1.3, spawns: [enemy('rug_fighter', 0.22), enemy('fast_scout', 0.4), enemy('fast_scout', 0.6), enemy('whale_scout', 0.78)] },
      { label: 'ORBITAL GATE', restBefore: 1.5, spawns: [enemy('fog_raider', 0.16), enemy('regulator_drone', 0.34), enemy('fast_scout', 0.5), enemy('regulator_drone', 0.66), enemy('fog_raider', 0.84)] },
    ],
  },
  ledger_city: {
    actKey: 'ledger_city',
    stageKey: 'ledger_city',
    groups: [
      { label: 'ATMOSPHERIC ENTRY', restBefore: 1.5, spawns: [enemy('regulator_drone', 0.3), enemy('regulator_drone', 0.7)] },
      { label: 'GROUND FIRE // BASIC TURRET', restBefore: 1.45, spawns: [hazard('basic_turret', 0.12, -1)] },
      { label: 'TURRET PAIR', restBefore: 1.3, spawns: [hazard('basic_turret', 0.12, -1), hazard('basic_turret', 0.88, 1)] },
      { label: 'CITY APPROACH', restBefore: 1.2, spawns: [enemy('fog_raider', 0.24), enemy('regulator_drone', 0.5), enemy('fog_raider', 0.76)] },
      { label: 'FIRST CROSSFIRE', restBefore: 1.25, spawns: [hazard('basic_turret', 0.88, 1), enemy('regulator_drone', 0.34), enemy('regulator_drone', 0.66)] },
      { label: 'CANNON TOWER // FIRST CONTACT', restBefore: 1.5, spawns: [hazard('cannon_tower', 0.5, -1)] },
      { label: 'TOWER AND SCREEN', restBefore: 1.3, spawns: [hazard('cannon_tower', 0.14, -1), enemy('fog_raider', 0.44), enemy('fog_raider', 0.68)] },
      { label: 'TOWER CROSSFIRE', restBefore: 1.3, spawns: [hazard('cannon_tower', 0.12, -1), enemy('fast_scout', 0.5), hazard('cannon_tower', 0.88, 1)] },
      { label: 'RUG PATROL', restBefore: 1.25, spawns: [enemy('rug_fighter', 0.28), enemy('regulator_drone', 0.5), enemy('rug_fighter', 0.72)] },
      { label: 'LOW PASS', restBefore: 1.3, spawns: [hazard('basic_turret', 0.1, -1), enemy('fast_scout', 0.38), enemy('fast_scout', 0.62), hazard('cannon_tower', 0.9, 1)] },
      { label: 'WHALE OVER THE CITY', restBefore: 1.35, spawns: [enemy('rug_fighter', 0.26), enemy('whale_scout', 0.5), enemy('rug_fighter', 0.74)] },
      { label: 'ROOFTOP GUNS', restBefore: 1.3, spawns: [hazard('basic_turret', 0.1, -1), hazard('cannon_tower', 0.5, 1), hazard('basic_turret', 0.9, 1), enemy('fog_raider', 0.32)] },
      { label: 'CITY SIEGE', restBefore: 1.4, spawns: [hazard('cannon_tower', 0.12, -1), hazard('basic_turret', 0.88, 1), enemy('rug_fighter', 0.4), enemy('fast_scout', 0.6)] },
      { label: 'SKYLINE GUNS', restBefore: 1.3, spawns: [hazard('basic_turret', 0.08, -1), hazard('basic_turret', 0.28, -1), hazard('basic_turret', 0.92, 1), enemy('regulator_drone', 0.6)] },
      { label: 'TOWER AND RUG', restBefore: 1.35, spawns: [hazard('cannon_tower', 0.14, -1), enemy('rug_fighter', 0.42), enemy('rug_fighter', 0.66)] },
      { label: 'SCOUT DIVE', restBefore: 1.25, spawns: [enemy('fast_scout', 0.2), enemy('fast_scout', 0.4), enemy('fast_scout', 0.6), enemy('fast_scout', 0.8)] },
      { label: 'DOWNTOWN CROSSFIRE', restBefore: 1.35, spawns: [hazard('cannon_tower', 0.1, -1), hazard('basic_turret', 0.3, -1), hazard('basic_turret', 0.7, 1), hazard('cannon_tower', 0.9, 1)] },
      { label: 'CITY WHALES', restBefore: 1.35, spawns: [enemy('whale_scout', 0.3), enemy('whale_scout', 0.7), enemy('fog_raider', 0.5)] },
      { label: 'STREET LEVEL', restBefore: 1.3, spawns: [hazard('basic_turret', 0.12, -1), enemy('rug_fighter', 0.36), enemy('fast_scout', 0.5), enemy('rug_fighter', 0.64), hazard('cannon_tower', 0.88, 1)] },
      { label: 'LEDGER CITY SCREEN', restBefore: 1.5, spawns: [hazard('basic_turret', 0.1, -1), enemy('fog_raider', 0.3), enemy('fast_scout', 0.5), enemy('fog_raider', 0.7)] },
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
      { label: 'LASER TOWER // FIRST CONTACT', restBefore: 1.5, spawns: [hazard('laser_tower', 0.5, -1)] },
      { label: 'LASER LANE', restBefore: 1.35, spawns: [hazard('laser_tower', 0.12, -1), hazard('laser_tower', 0.88, 1)] },
      { label: 'LASER AND MINES', restBefore: 1.3, spawns: [hazard('laser_tower', 0.14, -1), hazard('armored_space_mine', 0.4), hazard('armored_space_mine', 0.64)] },
      { label: 'MISSILE SILO // FIRST CONTACT', restBefore: 1.55, spawns: [hazard('missile_silo', 0.5, -1)] },
      { label: 'SILO SCREEN', restBefore: 1.35, spawns: [hazard('missile_silo', 0.14, -1), enemy('fog_raider', 0.44), enemy('fog_raider', 0.7)] },
      { label: 'GRID PATROL', restBefore: 1.3, spawns: [enemy('rug_fighter', 0.26), enemy('whale_scout', 0.5), enemy('rug_fighter', 0.74)] },
      { label: 'CROSSFIRE GRID', restBefore: 1.3, spawns: [hazard('cannon_turret', 0.1, -1), hazard('laser_tower', 0.9, 1), enemy('fast_scout', 0.5)] },
      { label: 'MINEFIELD RUN', restBefore: 1.4, spawns: [hazard('armored_space_mine', 0.2), hazard('armored_space_mine', 0.4), hazard('armored_space_mine', 0.6), hazard('armored_space_mine', 0.8)] },
      { label: 'HEAVY LINE', restBefore: 1.35, spawns: [hazard('missile_silo', 0.12, -1), hazard('cannon_tower', 0.88, 1), enemy('rug_fighter', 0.5)] },
      { label: 'FULL GRID', restBefore: 1.4, spawns: [hazard('laser_tower', 0.1, -1), hazard('cannon_turret', 0.9, 1), hazard('armored_space_mine', 0.36), hazard('armored_space_mine', 0.64), enemy('fog_raider', 0.5)] },
      { label: 'GRID COMMAND', restBefore: 1.45, spawns: [hazard('missile_silo', 0.12, -1), hazard('laser_tower', 0.88, 1), enemy('whale_scout', 0.42), enemy('fast_scout', 0.62)] },
      { label: 'LASER CROSSFIRE', restBefore: 1.35, spawns: [hazard('laser_tower', 0.08, -1), hazard('laser_tower', 0.92, 1), enemy('fast_scout', 0.36), enemy('fast_scout', 0.64)] },
      { label: 'SILO AND MINES', restBefore: 1.35, spawns: [hazard('missile_silo', 0.12, -1), hazard('armored_space_mine', 0.4), hazard('armored_space_mine', 0.62), hazard('missile_silo', 0.88, 1)] },
      { label: 'RUG WING', restBefore: 1.3, spawns: [enemy('rug_fighter', 0.2), enemy('rug_fighter', 0.4), enemy('rug_fighter', 0.6), enemy('rug_fighter', 0.8)] },
      { label: 'BATTERY ROW', restBefore: 1.4, spawns: [hazard('cannon_tower', 0.1, -1), hazard('cannon_turret', 0.3, -1), hazard('cannon_turret', 0.7, 1), hazard('cannon_tower', 0.9, 1)] },
      { label: 'WHALE ESCORT', restBefore: 1.35, spawns: [enemy('whale_scout', 0.28), enemy('whale_scout', 0.5), enemy('whale_scout', 0.72)] },
      { label: 'GRID GAUNTLET', restBefore: 1.4, spawns: [hazard('laser_tower', 0.1, -1), hazard('armored_space_mine', 0.32), enemy('rug_fighter', 0.5), hazard('armored_space_mine', 0.68), hazard('missile_silo', 0.9, 1)] },
      { label: 'SATURATION', restBefore: 1.45, spawns: [hazard('armored_space_mine', 0.18), hazard('armored_space_mine', 0.38), enemy('fast_scout', 0.5), hazard('armored_space_mine', 0.62), hazard('armored_space_mine', 0.82)] },
      { label: 'DEEP GRID', restBefore: 1.4, spawns: [hazard('missile_silo', 0.1, -1), hazard('laser_tower', 0.9, 1), enemy('rug_fighter', 0.34), enemy('whale_scout', 0.5), enemy('fog_raider', 0.66)] },
      { label: 'DEFENSE GRID CORE', restBefore: 1.6, spawns: [hazard('basic_turret', 0.1, -1), hazard('cannon_turret', 0.9, 1), hazard('armored_space_mine', 0.34), hazard('armored_space_mine', 0.66), enemy('fog_raider', 0.5)] },
    ],
  },
  final_assault: {
    actKey: 'final_assault',
    stageKey: 'regulatory_outpost',
    groups: [
      { label: 'FORTRESS APPROACH', restBefore: 1.8, spawns: [enemy('fast_scout', 0.3), enemy('fast_scout', 0.7)] },
      { label: 'PLASMA TURRET // FIRST CONTACT', restBefore: 1.55, spawns: [hazard('plasma_turret', 0.5, -1)] },
      { label: 'PLASMA SCREEN', restBefore: 1.35, spawns: [hazard('plasma_turret', 0.14, -1), enemy('fog_raider', 0.44), enemy('fog_raider', 0.7)] },
      { label: 'CANNON SCREEN', restBefore: 1.35, spawns: [hazard('cannon_turret', 0.1, -1), enemy('fog_raider', 0.5), hazard('cannon_turret', 0.9, 1)] },
      { label: 'MINE + SCOUT PRESSURE', restBefore: 1.25, spawns: [hazard('armored_space_mine', 0.3), enemy('fast_scout', 0.5), hazard('armored_space_mine', 0.7)] },
      { label: 'HEAVY ESCORT', restBefore: 1.35, spawns: [enemy('rug_fighter', 0.26), enemy('whale_scout', 0.5), enemy('rug_fighter', 0.74)] },
      { label: 'OUTPOST GUNS', restBefore: 1.35, spawns: [hazard('plasma_turret', 0.1, -1), hazard('laser_tower', 0.9, 1), enemy('fast_scout', 0.5)] },
      { label: 'SILO BATTERY', restBefore: 1.4, spawns: [hazard('missile_silo', 0.12, -1), hazard('missile_silo', 0.88, 1), enemy('fog_raider', 0.5)] },
      { label: 'GAUNTLET', restBefore: 1.35, spawns: [hazard('armored_space_mine', 0.22), hazard('laser_tower', 0.5, -1), hazard('armored_space_mine', 0.78), enemy('fast_scout', 0.62)] },
      { label: 'WALL OF FIRE', restBefore: 1.4, spawns: [hazard('plasma_turret', 0.1, -1), hazard('cannon_tower', 0.5, 1), hazard('plasma_turret', 0.9, 1)] },
      { label: 'ELITE PATROL', restBefore: 1.4, spawns: [enemy('rug_fighter', 0.22), enemy('whale_scout', 0.42), enemy('whale_scout', 0.6), enemy('rug_fighter', 0.8)] },
      { label: 'CAPITAL SHIP ESCORT', restBefore: 1.45, spawns: [hazard('cannon_turret', 0.1, -1), enemy('fog_raider', 0.32), enemy('fast_scout', 0.5), enemy('fog_raider', 0.68), hazard('cannon_turret', 0.9, 1)] },
      { label: 'LAST SCREEN', restBefore: 1.45, spawns: [hazard('plasma_turret', 0.12, -1), hazard('missile_silo', 0.88, 1), enemy('rug_fighter', 0.4), enemy('whale_scout', 0.62)] },
      { label: 'PLASMA CROSSFIRE', restBefore: 1.4, spawns: [hazard('plasma_turret', 0.08, -1), hazard('plasma_turret', 0.92, 1), enemy('fast_scout', 0.36), enemy('fast_scout', 0.64)] },
      { label: 'OUTPOST PATROL', restBefore: 1.35, spawns: [enemy('rug_fighter', 0.24), enemy('rug_fighter', 0.44), enemy('whale_scout', 0.62), enemy('fog_raider', 0.8)] },
      { label: 'SILO GAUNTLET', restBefore: 1.4, spawns: [hazard('missile_silo', 0.1, -1), hazard('armored_space_mine', 0.34), hazard('armored_space_mine', 0.66), hazard('missile_silo', 0.9, 1)] },
      { label: 'LASER WALL', restBefore: 1.4, spawns: [hazard('laser_tower', 0.1, -1), hazard('laser_tower', 0.32, -1), hazard('laser_tower', 0.68, 1), hazard('laser_tower', 0.9, 1)] },
      { label: 'HEAVY WING', restBefore: 1.4, spawns: [enemy('whale_scout', 0.22), enemy('rug_fighter', 0.42), enemy('rug_fighter', 0.58), enemy('whale_scout', 0.78)] },
      { label: 'FORTRESS BATTERY', restBefore: 1.45, spawns: [hazard('plasma_turret', 0.1, -1), hazard('cannon_tower', 0.32, -1), hazard('cannon_tower', 0.68, 1), hazard('plasma_turret', 0.9, 1)] },
      { label: 'CAPITAL SHIP GATE', restBefore: 1.6, spawns: [hazard('laser_tower', 0.1, -1), hazard('plasma_turret', 0.9, 1), enemy('rug_fighter', 0.34), enemy('fast_scout', 0.5), enemy('fog_raider', 0.66)] },
    ],
  },
};

export function earthFlightEncounterFor(actKey: string | undefined): EarthFlightEncounterDef | undefined {
  return actKey ? EARTH_FLIGHT_ENCOUNTERS[actKey] : undefined;
}

/**
 * Every threat that has to be shown on its own before it is ever mixed in,
 * and the act that owes the player that introduction. This is the rule that
 * keeps a long level from turning into an undifferentiated soup: by the time
 * four things are on screen at once, the player has met each of them alone.
 */
const SOLO_INTRODUCTIONS: Array<{ actKey: string; kind: 'enemy' | 'hazard'; key: string }> = [
  { actKey: 'orbital_approach', kind: 'enemy', key: 'whale_scout' },
  { actKey: 'orbital_approach', kind: 'hazard', key: 'asteroid' },
  { actKey: 'fog_belt', kind: 'enemy', key: 'fast_scout' },
  { actKey: 'fog_belt', kind: 'enemy', key: 'rug_fighter' },
  { actKey: 'ledger_city', kind: 'hazard', key: 'basic_turret' },
  { actKey: 'ledger_city', kind: 'hazard', key: 'cannon_tower' },
  { actKey: 'defense_grid', kind: 'hazard', key: 'armored_space_mine' },
  { actKey: 'defense_grid', kind: 'hazard', key: 'cannon_turret' },
  { actKey: 'defense_grid', kind: 'hazard', key: 'laser_tower' },
  { actKey: 'defense_grid', kind: 'hazard', key: 'missile_silo' },
  { actKey: 'final_assault', kind: 'hazard', key: 'plasma_turret' },
];

/** How many authored groups Level 1's flight acts must carry between them. */
export const MIN_TOTAL_FLIGHT_GROUPS = 60;

export function validateEarthFlightEncounters(): string[] {
  const errors: string[] = [];
  // The Earth roster started at three enemies and three hazards while five and
  // eight were defined, so most of the authored content was never reachable.
  const allowedEnemyKeys = new Set(['regulator_drone', 'fog_raider', 'fast_scout', 'whale_scout', 'rug_fighter']);
  const allowedHazardKeys = new Set([
    'basic_turret', 'cannon_turret', 'cannon_tower', 'laser_tower',
    'missile_silo', 'plasma_turret', 'armored_space_mine', 'asteroid',
  ]);
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

  const spawnKey = (spawn: EncounterSpawnDef): string => (spawn.kind === 'enemy' ? spawn.enemyKey : spawn.hazardKey);
  const actOrder = ['orbital_approach', 'fog_belt', 'ledger_city', 'defense_grid', 'final_assault'];

  for (const intro of SOLO_INTRODUCTIONS) {
    const groups = EARTH_FLIGHT_ENCOUNTERS[intro.actKey]?.groups ?? [];
    const soloIndex = groups.findIndex(
      (group) => group.spawns.length === 1 && group.spawns[0].kind === intro.kind && spawnKey(group.spawns[0]) === intro.key,
    );
    if (soloIndex < 0) {
      errors.push(`earthEncounter.${intro.actKey}: ${intro.key} must be introduced alone`);
      continue;
    }
    // The introduction has to come before the first time it is mixed in --
    // both inside its own act and across every earlier act.
    const mixedEarlier = groups.slice(0, soloIndex).some((group) => group.spawns.length > 1 && group.spawns.some((spawn) => spawnKey(spawn) === intro.key));
    if (mixedEarlier) errors.push(`earthEncounter.${intro.actKey}: ${intro.key} appears in a mixed group before its solo introduction`);

    for (const earlier of actOrder.slice(0, actOrder.indexOf(intro.actKey))) {
      const used = (EARTH_FLIGHT_ENCOUNTERS[earlier]?.groups ?? []).some((group) => group.spawns.some((spawn) => spawnKey(spawn) === intro.key));
      if (used) errors.push(`earthEncounter.${earlier}: ${intro.key} is used before it is introduced in ${intro.actKey}`);
    }
  }

  // Anything that shows up in play owes the player an introduction somewhere.
  const introduced = new Set(SOLO_INTRODUCTIONS.map((intro) => intro.key));
  introduced.add('regulator_drone');  // the opening group, alone, by definition
  introduced.add('fog_raider');       // the opening group of the fog belt
  for (const [actKey, encounter] of Object.entries(EARTH_FLIGHT_ENCOUNTERS)) {
    for (const group of encounter.groups) {
      for (const spawn of group.spawns) {
        if (!introduced.has(spawnKey(spawn))) {
          errors.push(`earthEncounter.${actKey}: ${spawnKey(spawn)} is never introduced on its own`);
        }
      }
    }
  }

  // Level 1 is meant to be a game in itself, not a fifteen-minute prologue.
  const totalGroups = Object.values(EARTH_FLIGHT_ENCOUNTERS).reduce((sum, encounter) => sum + encounter.groups.length, 0);
  if (totalGroups < MIN_TOTAL_FLIGHT_GROUPS) {
    errors.push(`earthEncounter: Level 1 carries ${totalGroups} authored groups, below the ${MIN_TOTAL_FLIGHT_GROUPS} it needs to be a full level`);
  }

  // Difficulty must climb: each act needs at least as much authored content as
  // the one before it, apart from the final approach which ends on a boss.
  for (let i = 1; i < actOrder.length - 1; i++) {
    const prev = EARTH_FLIGHT_ENCOUNTERS[actOrder[i - 1]]?.groups.length ?? 0;
    const current = EARTH_FLIGHT_ENCOUNTERS[actOrder[i]]?.groups.length ?? 0;
    if (current < prev) errors.push(`earthEncounter.${actOrder[i]}: fewer groups (${current}) than ${actOrder[i - 1]} (${prev})`);
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
