// Phase A content registry.
//
// Seeded with ONLY the current live content (player, regulator drone, basic
// projectile, burst-ring FX, clarity pulse). Values mirror the pre-Phase-A
// constants in Game2A exactly, so gameplay is unchanged — only the source of
// truth moves here. Future inventory keys (see docs/phase-2b-asset-inventory.md)
// are intentionally NOT wired into live play in Phase A.

import type { BossAttackKey, BossDef, Size, EnemyDef, EnvironmentPropDef, FxDef, HazardDef, PickupDef, ProjectileDef, ShipDef, SpecialDef, StageDef, WeaponDef } from './types';
import { bossPhaseIndex, nextBossKey, orderedBossKeys } from './BossDirector';
import { availableEnemyKeys, selectEnemyKey, spawnInterval } from './WaveDirector';

/**
 * How large everything in the flight game is drawn, as a fraction of its
 * authored size.
 *
 * "If you made the ships even smaller than they are now it would be like micro
 * machines and you could do a lot more" -- and that is right for a reason
 * worth writing down. Every distance in a dogfight is measured in ship widths:
 * the gap you thread, the room you have to dodge, how much of the lane a
 * formation covers. Shrinking the ships widens all of them at once, without
 * touching a single speed or spawn rate.
 *
 * Applied here rather than at each draw call so the hitbox shrinks with the
 * sprite -- scaling one without the other is how you get a ship that is hit by
 * things that visibly miss it.
 */
const COMBAT_SCALE = 0.78;

function scaled(size: Size): Size {
  // Floored, so nothing rounds away to something unhittable.
  return {
    w: Math.max(6, Math.round(size.w * COMBAT_SCALE)),
    h: Math.max(6, Math.round(size.h * COMBAT_SCALE)),
  };
}

/** Shrinks the draw and hitbox of everything that flies or is shot at. */
export function scaleCombatants<T extends { draw: Size; hitbox: Size }>(
  defs: Record<string, T>,
): Record<string, T> {
  return Object.fromEntries(
    Object.entries(defs).map(([key, def]) => [key, { ...def, draw: scaled(def.draw), hitbox: scaled(def.hitbox) }]),
  ) as Record<string, T>;
}

export const SHIPS: Record<string, ShipDef> = scaleCombatants({
  player: {
    key: 'player',
    label: 'CLARITY INTERCEPTOR',
    accent: '#00ff00',
    sprite: { category: 'ships', id: 'player' },
    draw: { w: 25, h: 30 },
    hitbox: { w: 22, h: 25 },
    speed: 340,
    hp: 3,
    fireRate: 0.14,
    weaponKey: 'tier_1_bb',
    // Ordnance hull: launches with a full bomb rack and a wider, faster-charging pulse.
    loadout: { shield: 1, weaponTier: 1, bombs: 2, pulse: 1.4 },
  },
  xrpl_striker: {
    key: 'xrpl_striker',
    label: 'XRPL STRIKER',
    accent: '#36a3ff',
    sprite: { category: 'ships', id: 'xrpl_striker' },
    draw: { w: 23, h: 28 },
    hitbox: { w: 21, h: 24 },
    speed: 405,
    hp: 2,
    fireRate: 0.11,
    weaponKey: 'tier_1_bb',
    // Gunship: skips the first rung of the weapon ladder entirely.
    loadout: { shield: 0, weaponTier: 2, bombs: 0, pulse: 1 },
  },
  ledger_warden: {
    key: 'ledger_warden',
    label: 'LEDGER WARDEN',
    accent: '#ffd24a',
    sprite: { category: 'ships', id: 'ledger_warden' },
    draw: { w: 28, h: 33 },
    hitbox: { w: 25, h: 29 },
    speed: 285,
    hp: 5,
    fireRate: 0.17,
    weaponKey: 'tier_1_bb',
    // Bulwark: the only hull that launches with a shield to lose.
    loadout: { shield: 3, weaponTier: 1, bombs: 0, pulse: 1 },
  },
});

export const ENEMIES: Record<string, EnemyDef> = scaleCombatants({
  regulator_drone: {
    key: 'regulator_drone',
    label: 'REGULATOR',
    sprite: { category: 'enemies', id: 'regulator_drone' },
    draw: { w: 26, h: 26 },
    hitbox: { w: 20, h: 19 },
    hp: 1,
    baseSpeed: 105,
    spawnRate: 0.72,
    score: 100,
    minWave: 1,
    spawnWeight: 8,
    behavior: 'sine',
    fireRate: 2.6,
    projectileSpeed: 210,
    accent: '#ff3355',
  },
  fog_raider: {
    key: 'fog_raider',
    label: 'FOG RAIDER',
    sprite: { category: 'enemies', id: 'fog_raider' },
    draw: { w: 24, h: 24 },
    hitbox: { w: 19, h: 18 },
    hp: 1,
    baseSpeed: 138,
    spawnRate: 0.68,
    score: 125,
    minWave: 2,
    spawnWeight: 5,
    behavior: 'straight',
    fireRate: 2.2,
    projectileSpeed: 240,
    accent: '#b56cff',
  },
  whale_scout: {
    key: 'whale_scout',
    label: 'WHALE SCOUT',
    sprite: { category: 'enemies', id: 'whale_scout' },
    draw: { w: 30, h: 30 },
    hitbox: { w: 24, h: 22 },
    hp: 2,
    baseSpeed: 92,
    spawnRate: 0.78,
    score: 200,
    minWave: 3,
    spawnWeight: 3,
    behavior: 'zigzag',
    fireRate: 3.0,
    projectileSpeed: 195,
    accent: '#36a3ff',
  },
  rug_fighter: {
    key: 'rug_fighter',
    label: 'RUG FIGHTER',
    sprite: { category: 'enemies', id: 'rug_fighter' },
    draw: { w: 27, h: 27 },
    hitbox: { w: 22, h: 20 },
    hp: 2,
    baseSpeed: 118,
    spawnRate: 0.74,
    score: 250,
    minWave: 4,
    spawnWeight: 2,
    behavior: 'dive',
    fireRate: 1.9,
    projectileSpeed: 265,
    accent: '#ffd24a',
  },
});

export const PROJECTILES: Record<string, ProjectileDef> = {
  bb_shot: {
    key: 'bb_shot',
    sprite: { category: 'projectiles', id: 'bb_shot' },
    draw: { w: 7, h: 22 },
    hitbox: { w: 5, h: 14 },
    speed: 720,
  },
  enemy_red_bullet: {
    key: 'enemy_red_bullet',
    sprite: { category: 'projectiles', id: 'enemy_red_bullet' },
    draw: { w: 9, h: 22 },
    hitbox: { w: 7, h: 7 },
    speed: 240,
  },
  enemy_missile: {
    key: 'enemy_missile',
    sprite: { category: 'projectiles', id: 'enemy_missile' },
    draw: { w: 9, h: 30 },
    hitbox: { w: 6, h: 6 },
    speed: 235,
  },
  // The Clarity Lance round. A beam rather than a bolt, which is the visible
  // payoff for reaching the top of the weapon ladder.
  clarity_beam: {
    key: 'clarity_beam',
    sprite: { category: 'projectiles', id: 'clarity_beam' },
    draw: { w: 18, h: 54 },
    hitbox: { w: 9, h: 26 },
    speed: 760,
  },
  // The player's homing rocket. Real art now; drawSeeker's procedural dart
  // stays as the fallback. Drawn 40% smaller than the first pass — at 14x42
  // it read as nearly as big as the fighter that launches it.
  seeker_missile: {
    key: 'seeker_missile',
    sprite: { category: 'projectiles', id: 'seeker_missile' },
    draw: { w: 8, h: 25 },
    hitbox: { w: 7, h: 16 },
    speed: 400,
  },
};

export const WEAPONS: Record<string, WeaponDef> = {
  tier_1_bb: {
    key: 'tier_1_bb',
    label: 'BB SHOT',
    tier: 1,
    projectileKey: 'bb_shot',
    fireRate: 0.14,
    damage: 1,
    shots: [{ offsetX: 0, angle: 0 }],
  },
  tier_2_twin: {
    key: 'tier_2_twin',
    label: 'TWIN BEAM',
    tier: 2,
    projectileKey: 'bb_shot',
    fireRate: 0.13,
    damage: 1,
    shots: [
      { offsetX: -9, angle: 0 },
      { offsetX: 9, angle: 0 },
    ],
  },
  // NOTHING IN THE LADDER FANS.
  //
  // This rung used to be TRI-SPREAD, firing at +/-0.18rad. An angle becomes
  // width over distance, and measured across a portrait playfield (411x790)
  // its three shots were 302px apart by the top of the screen -- 73% of the
  // whole width. Only the middle beam could ever be on the thing you were
  // aiming at, so two thirds of the gun's damage went into empty space and
  // "the enemies at the top don't even get hurt" was a literal description of
  // the geometry. Worse, the ladder GRANTS this gun automatically at XP level
  // 3: the player did not choose the spread and cannot decline it.
  //
  // Every rung now fires parallel columns. The ladder still hands out
  // different guns -- it varies beam COUNT, rate, damage and pierce, which is
  // variety you can aim -- but the volley you fire is always the volley that
  // arrives, at every range.
  tier_3_tri: {
    key: 'tier_3_tri',
    label: 'TRI-BEAM',
    tier: 3,
    projectileKey: 'bb_shot',
    fireRate: 0.16,
    damage: 1,
    shots: [
      { offsetX: -11, angle: 0 },
      { offsetX: 0, angle: 0 },
      { offsetX: 11, angle: 0 },
    ],
  },
  // The ladder is meant to hand out different guns, not the same gun with a
  // bigger number, so the top two rungs change how you have to aim: four
  // columns that bracket a target, then one heavy bolt that must be aimed.
  tier_4_quad: {
    key: 'tier_4_quad',
    label: 'QUAD BEAM',
    tier: 4,
    projectileKey: 'bb_shot',
    fireRate: 0.12,
    damage: 1,
    shots: [
      { offsetX: -17, angle: 0 },
      { offsetX: -6, angle: 0 },
      { offsetX: 6, angle: 0 },
      { offsetX: 17, angle: 0 },
    ],
  },
  // One heavy bolt that punches through a whole column. Slow enough that
  // missing hurts, which keeps it a trade rather than a straight upgrade.
  tier_5_lance: {
    key: 'tier_5_lance',
    label: 'CLARITY LANCE',
    tier: 5,
    projectileKey: 'clarity_beam',
    fireRate: 0.26,
    damage: 3,
    pierce: 3,
    shots: [{ offsetX: 0, angle: 0 }],
  },
};

export const PICKUPS: Record<string, PickupDef> = {
  // Art from the Images_for_coded pack (pickup_shield), with its baked-in
  // caption cropped away and the emblem boxed square. drawPickup's procedural
  // hexagon remains the fallback if the file ever goes missing.
  shield_cell: {
    key: 'shield_cell',
    label: 'SHIELD CELL',
    sprite: { category: 'pickups', id: 'shield_cell' },
    draw: { w: 22, h: 22 },
    hitbox: { w: 17, h: 17 },
    driftSpeed: 88,
    effect: 'shield',
    tint: '#36a3ff',
    tag: 'SHLD',
  },
  weapon_upgrade: {
    key: 'weapon_upgrade',
    label: 'UPGRADE CRATE',
    sprite: { category: 'pickups', id: 'weapon_upgrade' },
    draw: { w: 22, h: 22 },
    hitbox: { w: 17, h: 17 },
    driftSpeed: 92,
    effect: 'weapon_upgrade',
    tint: '#00ff6a',
    tag: 'UP',
  },
  bomb: {
    key: 'bomb',
    label: 'CLARITY BOMB',
    sprite: { category: 'pickups', id: 'bomb' },
    draw: { w: 23, h: 23 },
    hitbox: { w: 18, h: 18 },
    driftSpeed: 84,
    effect: 'bomb',
    tint: '#ffb020',
    tag: 'BOMB',
  },
  repair: {
    key: 'repair',
    label: 'HULL REPAIR',
    sprite: { category: 'pickups', id: 'repair' },
    draw: { w: 22, h: 22 },
    hitbox: { w: 17, h: 17 },
    driftSpeed: 88,
    effect: 'repair',
    tint: '#ff4d7a',
    tag: 'HULL',
  },
};

export const STAGES: Record<string, StageDef> = {
  ledger_city: {
    key: 'ledger_city',
    label: 'LEDGER CITY',
    background: { category: 'backgrounds', id: 'ledger_city' },
    minWave: 1,
    sky: '#02060b',
    accent: '#00ff00',
    structure: '#082316',
    scrollSpeed: 42,
  },
  data_canyon: {
    key: 'data_canyon',
    label: 'DATA CANYON',
    background: { category: 'backgrounds', id: 'data_canyon' },
    minWave: 4,
    sky: '#030817',
    accent: '#36a3ff',
    structure: '#0a1a36',
    scrollSpeed: 58,
  },
  regulatory_outpost: {
    key: 'regulatory_outpost',
    label: 'REGULATORY OUTPOST',
    background: { category: 'backgrounds', id: 'regulatory_outpost' },
    minWave: 7,
    sky: '#10050a',
    accent: '#ff3355',
    structure: '#321018',
    scrollSpeed: 72,
  },
  deep_space_lane: {
    key: 'deep_space_lane',
    label: 'DEEP SPACE LANE',
    background: { category: 'backgrounds', id: 'deep_space_lane' },
    minWave: 11,
    sky: '#01030a',
    accent: '#7d7cff',
    structure: '#0b0b24',
    scrollSpeed: 86,
  },
};

export const HAZARDS: Record<string, HazardDef> = scaleCombatants({
  basic_turret: {
    key: 'basic_turret',
    label: 'BASIC TURRET',
    sprite: { category: 'hazards', id: 'basic_turret' },
    draw: { w: 32, h: 32 },
    hitbox: { w: 26, h: 26 },
    hp: 3,
    minWave: 1,
    spawnRate: 4.6,
    fireRate: 1.05,
    projectileSpeed: 235,
    score: 350,
    accent: '#ff8a3d',
    spawnWeight: 8,
    placement: 'edge',
    fires: true,
  },
  cannon_turret: {
    key: 'cannon_turret', label: 'CANNON TURRET', sprite: { category: 'hazards', id: 'cannon_turret' },
    draw: { w: 36, h: 36 }, hitbox: { w: 29, h: 29 }, hp: 4, minWave: 4,
    spawnRate: 4.4, fireRate: 1.35, projectileSpeed: 220, score: 425, accent: '#ff6b3d',
    spawnWeight: 6, placement: 'edge', fires: true,
  },
  asteroid: {
    key: 'asteroid', label: 'CLARITY ASTEROID', sprite: { category: 'environment', id: 'asteroid' },
    draw: { w: 42, h: 42 }, hitbox: { w: 32, h: 32 }, hp: 4, minWave: 5,
    spawnRate: 8.5, fireRate: 0, projectileSpeed: 0, score: 300, accent: '#36a3ff',
    spawnWeight: 5, placement: 'lane', fires: false,
  },
  cannon_tower: {
    key: 'cannon_tower', label: 'CANNON TOWER', sprite: { category: 'hazards', id: 'cannon_tower' },
    draw: { w: 36, h: 45 }, hitbox: { w: 27, h: 36 }, hp: 5, minWave: 6,
    spawnRate: 4.3, fireRate: 0.95, projectileSpeed: 245, score: 500, accent: '#ff3d3d',
    spawnWeight: 5, placement: 'edge', fires: true,
  },
  laser_tower: {
    key: 'laser_tower', label: 'LASER TOWER', sprite: { category: 'hazards', id: 'laser_tower' },
    draw: { w: 32, h: 46 }, hitbox: { w: 24, h: 36 }, hp: 4, minWave: 7,
    spawnRate: 4.2, fireRate: 0.62, projectileSpeed: 310, score: 550, accent: '#ff3355',
    spawnWeight: 4, placement: 'edge', fires: true,
  },
  missile_silo: {
    key: 'missile_silo', label: 'MISSILE SILO', sprite: { category: 'hazards', id: 'missile_silo' },
    draw: { w: 42, h: 46 }, hitbox: { w: 33, h: 36 }, hp: 7, minWave: 9,
    spawnRate: 4.8, fireRate: 1.8, projectileSpeed: 190, score: 700, accent: '#ffd24a',
    spawnWeight: 3, placement: 'edge', fires: true,
  },
  plasma_turret: {
    key: 'plasma_turret', label: 'PLASMA TURRET', sprite: { category: 'hazards', id: 'plasma_turret' },
    draw: { w: 40, h: 40 }, hitbox: { w: 32, h: 32 }, hp: 6, minWave: 11,
    spawnRate: 4.0, fireRate: 0.78, projectileSpeed: 270, score: 800, accent: '#b56cff',
    spawnWeight: 3, placement: 'edge', fires: true,
  },
});

export const ENVIRONMENT_PROPS: Record<string, EnvironmentPropDef> = {
  mega_tower: { key: 'mega_tower', label: 'MEGA TOWER', sprite: { category: 'environment', id: 'mega_tower' }, draw: { w: 42, h: 95 }, stages: ['ledger_city', 'regulatory_outpost'] },
  data_spire: { key: 'data_spire', label: 'DATA SPIRE', sprite: { category: 'environment', id: 'data_spire' }, draw: { w: 35, h: 94 }, stages: ['ledger_city', 'data_canyon'] },
  energy_barrier: { key: 'energy_barrier', label: 'ENERGY BARRIER', sprite: { category: 'environment', id: 'energy_barrier' }, draw: { w: 52, h: 69 }, stages: ['data_canyon', 'regulatory_outpost'] },
  regulatory_outpost: { key: 'regulatory_outpost', label: 'REGULATORY OUTPOST', sprite: { category: 'environment', id: 'regulatory_outpost' }, draw: { w: 56, h: 88 }, stages: ['regulatory_outpost'] },
  xrp_billboard: { key: 'xrp_billboard', label: 'XRP BILLBOARD', sprite: { category: 'environment', id: 'xrp_billboard' }, draw: { w: 55, h: 81 }, stages: ['ledger_city'] },
  defense_turret: { key: 'defense_turret', label: 'DEFENSE PLATFORM', sprite: { category: 'environment', id: 'defense_turret' }, draw: { w: 55, h: 63 }, stages: ['data_canyon', 'regulatory_outpost'] },
};

export function availableHazardKeys(wave: number): string[] {
  return Object.values(HAZARDS).filter((hazard) => wave >= hazard.minWave).map((hazard) => hazard.key);
}

export function selectHazardKey(wave: number, roll = Math.random()): string {
  const available = availableHazardKeys(wave);
  if (available.length === 0) return 'basic_turret';
  const total = available.reduce((sum, key) => sum + HAZARDS[key].spawnWeight, 0);
  let cursor = Math.max(0, Math.min(0.999999, roll)) * total;
  for (const key of available) {
    cursor -= HAZARDS[key].spawnWeight;
    if (cursor < 0) return key;
  }
  return available[available.length - 1];
}

/** Every move the boss script runner knows how to execute. */
export const BOSS_ATTACK_KEYS: readonly BossAttackKey[] = [
  'aimed_volley',
  'fog_wall',
  'radial',
  'charge',
  'sweep_beam',
  'escort_screen',
];

export const BOSSES: Record<string, BossDef> = scaleCombatants({
  gary_fog: {
    key: 'gary_fog',
    label: 'GARY FOG',
    sprite: { category: 'bosses', id: 'gary_fog_phase1' },
    draw: { w: 98, h: 104 },
    hitbox: { w: 75, h: 69 },
    // Gary Fog is the first real boss, so his script is a teacher. Phase 1 is
    // two moves you can count -- aimed, then a wall with a gap -- and nothing
    // else, until you can do both in your sleep. Phase 2 adds the dive. Phase 3
    // is all of it with the ring on the front, and by then the order is the
    // only thing keeping you alive.
    hp: 88,
    triggerWave: 5,
    score: 600,
    phases: [
      {
        hpThreshold: 1, moveSpeed: 72, fireRate: 1.05, projectileSpeed: 205, projectileCount: 3, spread: 0.2,
        pattern: 'spread', accent: '#b56cff', attacks: ['aimed_volley', 'fog_wall'],
      },
      {
        hpThreshold: 0.62, moveSpeed: 96, fireRate: 0.82, projectileSpeed: 225, projectileCount: 4, spread: 0.22,
        pattern: 'spread', accent: '#d06cff', attacks: ['aimed_volley', 'fog_wall', 'charge'],
      },
      {
        // The screen opens the last phase: he hides behind his escorts before
        // he shows you anything else, so the phase starts as a fight you
        // cannot win by holding fire on him.
        hpThreshold: 0.28, moveSpeed: 124, fireRate: 0.58, projectileSpeed: 250, projectileCount: 5, spread: 0.19,
        pattern: 'burst', accent: '#ff5ce1',
        attacks: ['escort_screen', 'radial', 'charge', 'fog_wall', 'sweep_beam'],
      },
    ],
  },
  regulatory_behemoth: {
    key: 'regulatory_behemoth',
    label: 'REGULATORY BEHEMOTH',
    sprite: { category: 'bosses', id: 'regulatory_behemoth_phase2' },
    draw: { w: 108, h: 114 },
    hitbox: { w: 85, h: 78 },
    hp: 58,
    triggerWave: 9,
    score: 900,
    phases: [
      {
        hpThreshold: 1, moveSpeed: 58, fireRate: 0.9, projectileSpeed: 220, projectileCount: 3, spread: 0.2,
        pattern: 'spread', accent: '#ff8a3d', attacks: ['aimed_volley', 'sweep_beam'],
      },
      {
        // Halfway down it starts launching fighters to defend it.
        hpThreshold: 0.58, moveSpeed: 78, fireRate: 0.68, projectileSpeed: 245, projectileCount: 4, spread: 0.18,
        pattern: 'sweep', accent: '#ff5b3d', attacks: ['escort_screen', 'fog_wall', 'aimed_volley'],
      },
      {
        hpThreshold: 0.24, moveSpeed: 105, fireRate: 0.48, projectileSpeed: 270, projectileCount: 6, spread: 0.16,
        pattern: 'burst', accent: '#ff3355',
        attacks: ['escort_screen', 'radial', 'charge', 'sweep_beam'],
      },
    ],
  },
  clarity_destroyer: {
    key: 'clarity_destroyer',
    label: 'CLARITY DESTROYER',
    sprite: { category: 'bosses', id: 'clarity_destroyer_phase3' },
    draw: { w: 114, h: 121 },
    hitbox: { w: 88, h: 84 },
    hp: 82,
    triggerWave: 13,
    score: 1200,
    phases: [
      { hpThreshold: 1, moveSpeed: 70, fireRate: 0.78, projectileSpeed: 245, projectileCount: 4, spread: 0.2, pattern: 'sweep', accent: '#36a3ff' },
      { hpThreshold: 0.6, moveSpeed: 98, fireRate: 0.56, projectileSpeed: 275, projectileCount: 5, spread: 0.17, pattern: 'spread', accent: '#1ee7ff' },
      { hpThreshold: 0.22, moveSpeed: 132, fireRate: 0.4, projectileSpeed: 305, projectileCount: 7, spread: 0.14, pattern: 'burst', accent: '#00ff88' },
    ],
  },
  final_clarity: {
    key: 'final_clarity',
    label: 'FINAL CLARITY',
    sprite: { category: 'bosses', id: 'final_clarity' },
    draw: { w: 122, h: 130 },
    hitbox: { w: 95, h: 89 },
    hp: 120,
    triggerWave: 17,
    score: 2000,
    phases: [
      { hpThreshold: 1, moveSpeed: 82, fireRate: 0.66, projectileSpeed: 270, projectileCount: 5, spread: 0.17, pattern: 'aimed', accent: '#ffd24a' },
      { hpThreshold: 0.55, moveSpeed: 112, fireRate: 0.46, projectileSpeed: 305, projectileCount: 7, spread: 0.14, pattern: 'sweep', accent: '#ff8a3d' },
      { hpThreshold: 0.2, moveSpeed: 148, fireRate: 0.32, projectileSpeed: 340, projectileCount: 9, spread: 0.12, pattern: 'burst', accent: '#ff3355' },
    ],
  },
});

export const FX: Record<string, FxDef> = {
  burst_ring: {
    key: 'burst_ring',
    sprite: { category: 'vfx', id: 'burst_ring' },
  },
  // Animated kill burst. burst_ring stays as the fallback, so it is still a
  // referenced asset rather than an orphan.
  hit_spark: {
    key: 'hit_spark',
    sprite: { category: 'vfx', id: 'hit_spark' },
  },
};

export const SPECIALS: Record<string, SpecialDef> = {
  clarity_pulse: {
    key: 'clarity_pulse',
    radius: 165,
    // Manifest slot recorded for later; Phase A keeps the pulse procedural.
    sprite: { category: 'special', id: 'clarity_pulse' },
  },
};

/**
 * Pure data-validation used by the Phase A smoke test (scripts/validate-content.mjs).
 * Returns a list of human-readable problems; empty array means the registry is well-formed.
 * No DOM, no engine state — safe to run in plain Node.
 */
export function validateContent(): string[] {
  const errors: string[] = [];

  const checkSprite = (label: string, ref: { category: string; id: string }): void => {
    if (!ref.category) errors.push(`${label}: sprite.category is empty`);
    if (!ref.id) errors.push(`${label}: sprite.id is empty`);
  };
  const checkSize = (label: string, size: { w: number; h: number }): void => {
    if (!(size.w > 0)) errors.push(`${label}: draw/hitbox width must be > 0`);
    if (!(size.h > 0)) errors.push(`${label}: draw/hitbox height must be > 0`);
  };

  for (const [key, def] of Object.entries(SHIPS)) {
    if (def.key !== key) errors.push(`ships.${key}: key mismatch ("${def.key}")`);
    if (!def.label) errors.push(`ships.${key}: label is empty`);
    if (!def.accent) errors.push(`ships.${key}: accent is empty`);
    checkSprite(`ships.${key}`, def.sprite);
    checkSize(`ships.${key}.draw`, def.draw);
    checkSize(`ships.${key}.hitbox`, def.hitbox);
    if (!(def.speed > 0)) errors.push(`ships.${key}: speed must be > 0`);
    if (!(def.hp > 0)) errors.push(`ships.${key}: hp must be > 0`);
    if (!(def.fireRate > 0)) errors.push(`ships.${key}: fireRate must be > 0`);
    if (!WEAPONS[def.weaponKey]) errors.push(`ships.${key}: weaponKey "${def.weaponKey}" has no WeaponDef`);
  }

  for (const [key, def] of Object.entries(ENEMIES)) {
    if (def.key !== key) errors.push(`enemies.${key}: key mismatch ("${def.key}")`);
    checkSprite(`enemies.${key}`, def.sprite);
    checkSize(`enemies.${key}.draw`, def.draw);
    checkSize(`enemies.${key}.hitbox`, def.hitbox);
    if (!(def.hp > 0)) errors.push(`enemies.${key}: hp must be > 0`);
    if (!(def.baseSpeed > 0)) errors.push(`enemies.${key}: baseSpeed must be > 0`);
    if (!(def.spawnRate > 0)) errors.push(`enemies.${key}: spawnRate must be > 0`);
    if (!(def.score >= 0)) errors.push(`enemies.${key}: score must be >= 0`);
    if (!def.label) errors.push(`enemies.${key}: label is empty`);
    if (!(Number.isInteger(def.minWave) && def.minWave >= 1)) errors.push(`enemies.${key}: minWave must be a positive integer`);
    if (!(def.spawnWeight > 0)) errors.push(`enemies.${key}: spawnWeight must be > 0`);
    if (!['straight', 'sine', 'zigzag', 'dive'].includes(def.behavior)) errors.push(`enemies.${key}: unknown behavior "${def.behavior}"`);
    if (!def.accent) errors.push(`enemies.${key}: accent is empty`);
  }

  for (const [key, def] of Object.entries(PROJECTILES)) {
    if (def.key !== key) errors.push(`projectiles.${key}: key mismatch ("${def.key}")`);
    checkSprite(`projectiles.${key}`, def.sprite);
    checkSize(`projectiles.${key}.draw`, def.draw);
    checkSize(`projectiles.${key}.hitbox`, def.hitbox);
    if (!(def.speed > 0)) errors.push(`projectiles.${key}: speed must be > 0`);
  }

  const weaponTiers = Object.values(WEAPONS).map((weapon) => weapon.tier).sort((a, b) => a - b);
  for (const [key, def] of Object.entries(WEAPONS)) {
    if (def.key !== key) errors.push(`weapons.${key}: key mismatch ("${def.key}")`);
    if (!def.label) errors.push(`weapons.${key}: label is empty`);
    if (!(Number.isInteger(def.tier) && def.tier >= 1)) errors.push(`weapons.${key}: tier must be a positive integer`);
    if (!PROJECTILES[def.projectileKey]) errors.push(`weapons.${key}: projectileKey "${def.projectileKey}" has no ProjectileDef`);
    if (!(def.fireRate > 0)) errors.push(`weapons.${key}: fireRate must be > 0`);
    if (!(def.damage > 0)) errors.push(`weapons.${key}: damage must be > 0`);
    if (def.shots.length === 0) errors.push(`weapons.${key}: shots must not be empty`);
    for (const shot of def.shots) {
      if (!Number.isFinite(shot.offsetX) || !Number.isFinite(shot.angle)) errors.push(`weapons.${key}: shot values must be finite`);
    }
  }
  if (weaponTiers.some((tier, index) => tier !== index + 1)) errors.push('weapons: tiers must be contiguous starting at 1');

  for (const [key, def] of Object.entries(PICKUPS)) {
    if (def.key !== key) errors.push(`pickups.${key}: key mismatch ("${def.key}")`);
    if (!def.label) errors.push(`pickups.${key}: label is empty`);
    checkSprite(`pickups.${key}`, def.sprite);
    checkSize(`pickups.${key}.draw`, def.draw);
    checkSize(`pickups.${key}.hitbox`, def.hitbox);
    if (!(def.driftSpeed > 0)) errors.push(`pickups.${key}: driftSpeed must be > 0`);
    if (!['weapon_upgrade', 'bomb', 'repair', 'shield'].includes(def.effect)) errors.push(`pickups.${key}: unknown effect "${def.effect}"`);
    if (!/^#[0-9a-f]{6}$/i.test(def.tint)) errors.push(`pickups.${key}: tint must be a #rrggbb colour`);
    if (!/^[A-Z]{2,4}$/.test(def.tag)) errors.push(`pickups.${key}: tag must be 2-4 upper-case letters`);
  }
  // Two pickups that read the same are the bug this data exists to prevent.
  const pickupTints = Object.values(PICKUPS).map((def) => def.tint.toLowerCase());
  const pickupTags = Object.values(PICKUPS).map((def) => def.tag);
  if (new Set(pickupTints).size !== pickupTints.length) errors.push('pickups: every tint must be unique');
  if (new Set(pickupTags).size !== pickupTags.length) errors.push('pickups: every tag must be unique');

  const stageWaves = Object.values(STAGES).map((stage) => stage.minWave).sort((a, b) => a - b);
  for (const [key, def] of Object.entries(STAGES)) {
    if (def.key !== key) errors.push(`stages.${key}: key mismatch ("${def.key}")`);
    if (!def.label) errors.push(`stages.${key}: label is empty`);
    checkSprite(`stages.${key}`, def.background);
    if (!(Number.isInteger(def.minWave) && def.minWave >= 1)) errors.push(`stages.${key}: minWave must be a positive integer`);
    if (!def.sky || !def.accent || !def.structure) errors.push(`stages.${key}: colors must not be empty`);
    if (!(def.scrollSpeed > 0)) errors.push(`stages.${key}: scrollSpeed must be > 0`);
  }
  if (stageWaves[0] !== 1) errors.push('stages: first stage must unlock at wave 1');

  for (const [key, def] of Object.entries(HAZARDS)) {
    if (def.key !== key) errors.push(`hazards.${key}: key mismatch ("${def.key}")`);
    if (!def.label) errors.push(`hazards.${key}: label is empty`);
    checkSprite(`hazards.${key}`, def.sprite);
    checkSize(`hazards.${key}.draw`, def.draw);
    checkSize(`hazards.${key}.hitbox`, def.hitbox);
    if (!(def.hp > 0)) errors.push(`hazards.${key}: hp must be > 0`);
    if (!(Number.isInteger(def.minWave) && def.minWave >= 1)) errors.push(`hazards.${key}: minWave must be a positive integer`);
    if (!(def.spawnRate > 0)) errors.push(`hazards.${key}: spawnRate must be > 0`);
    if (def.fires && !(def.fireRate > 0 && def.projectileSpeed > 0)) errors.push(`hazards.${key}: firing hazards need positive timing and projectile speed`);
    if (!(def.spawnWeight > 0)) errors.push(`hazards.${key}: spawnWeight must be > 0`);
    if (!['edge', 'lane'].includes(def.placement)) errors.push(`hazards.${key}: invalid placement`);
    if (!(def.score >= 0)) errors.push(`hazards.${key}: score must be >= 0`);
    if (!def.accent) errors.push(`hazards.${key}: accent is empty`);
  }

  for (const [key, def] of Object.entries(ENVIRONMENT_PROPS)) {
    if (def.key !== key) errors.push(`environment.${key}: key mismatch ("${def.key}")`);
    if (!def.label || def.stages.length === 0) errors.push(`environment.${key}: label and stages are required`);
    checkSprite(`environment.${key}`, def.sprite);
    checkSize(`environment.${key}.draw`, def.draw);
    for (const stage of def.stages) if (!STAGES[stage]) errors.push(`environment.${key}: unknown stage "${stage}"`);
  }
  if (selectHazardKey(3, 0) !== 'basic_turret') errors.push('hazards: first unlock must select basic turret');

  const bossWaves = orderedBossKeys(BOSSES).map((key) => BOSSES[key].triggerWave);
  for (const [key, def] of Object.entries(BOSSES)) {
    if (def.key !== key) errors.push(`bosses.${key}: key mismatch ("${def.key}")`);
    if (!def.label) errors.push(`bosses.${key}: label is empty`);
    checkSprite(`bosses.${key}`, def.sprite);
    checkSize(`bosses.${key}.draw`, def.draw);
    checkSize(`bosses.${key}.hitbox`, def.hitbox);
    if (!(def.hp > 0)) errors.push(`bosses.${key}: hp must be > 0`);
    if (!(Number.isInteger(def.triggerWave) && def.triggerWave >= 1)) errors.push(`bosses.${key}: triggerWave must be a positive integer`);
    if (!(def.score >= 0)) errors.push(`bosses.${key}: score must be >= 0`);
    if (def.phases.length === 0) errors.push(`bosses.${key}: phases must not be empty`);
    let priorThreshold = Number.POSITIVE_INFINITY;
    for (const [index, phase] of def.phases.entries()) {
      if (!(phase.hpThreshold > 0 && phase.hpThreshold <= 1 && phase.hpThreshold < priorThreshold)) errors.push(`bosses.${key}.phases.${index}: thresholds must strictly descend within (0, 1]`);
      if (!(phase.moveSpeed > 0 && phase.fireRate > 0 && phase.projectileSpeed > 0)) errors.push(`bosses.${key}.phases.${index}: movement, fire rate, and projectile speed must be > 0`);
      if (!(Number.isInteger(phase.projectileCount) && phase.projectileCount > 0)) errors.push(`bosses.${key}.phases.${index}: projectileCount must be a positive integer`);
      if (!(phase.spread >= 0) || !phase.accent) errors.push(`bosses.${key}.phases.${index}: spread and accent are invalid`);
      // An attack script must name real moves, and a phase with an empty one
      // would silently fall back to the old timed volley.
      if (phase.attacks !== undefined) {
        if (phase.attacks.length === 0) errors.push(`bosses.${key}.phases.${index}: attacks must not be empty`);
        for (const attack of phase.attacks) {
          if (!BOSS_ATTACK_KEYS.includes(attack)) errors.push(`bosses.${key}.phases.${index}: unknown attack "${attack}"`);
        }
      }
      priorThreshold = phase.hpThreshold;
    }
    if (def.phases.length > 0 && bossPhaseIndex(def, def.hp) !== 0) errors.push(`bosses.${key}: full health must resolve to phase 1`);
    if (def.phases.length > 0 && bossPhaseIndex(def, 0) !== def.phases.length - 1) errors.push(`bosses.${key}: zero health must resolve to final phase`);
  }
  if (bossWaves.some((wave, index) => index > 0 && wave <= bossWaves[index - 1])) errors.push('bosses: trigger waves must strictly increase');
  const firstBoss = orderedBossKeys(BOSSES)[0];
  if (nextBossKey(BOSSES, BOSSES[firstBoss].triggerWave - 1, new Set()) !== undefined) errors.push('bossDirector: boss unlocked too early');
  if (nextBossKey(BOSSES, BOSSES[firstBoss].triggerWave, new Set()) !== firstBoss) errors.push('bossDirector: first boss failed to unlock');
  if (nextBossKey(BOSSES, BOSSES[firstBoss].triggerWave, new Set([firstBoss])) !== undefined) errors.push('bossDirector: completed boss repeated');

  for (const [key, def] of Object.entries(FX)) {
    if (def.key !== key) errors.push(`fx.${key}: key mismatch ("${def.key}")`);
    checkSprite(`fx.${key}`, def.sprite);
  }

  for (const [key, def] of Object.entries(SPECIALS)) {
    if (def.key !== key) errors.push(`specials.${key}: key mismatch ("${def.key}")`);
    if (!(def.radius > 0)) errors.push(`specials.${key}: radius must be > 0`);
    if (def.sprite) checkSprite(`specials.${key}`, def.sprite);
  }

  const waveOne = availableEnemyKeys(ENEMIES, 1);
  if (waveOne.length === 0) errors.push('waveDirector: wave 1 has no available enemy');
  if (!waveOne.includes('regulator_drone')) errors.push('waveDirector: regulator_drone must be available in wave 1');
  if (availableEnemyKeys(ENEMIES, 3).some((key) => ENEMIES[key].minWave > 3)) errors.push('waveDirector: locked enemy leaked into wave 3');
  if (!ENEMIES[selectEnemyKey(ENEMIES, 4, 0.999999)]) errors.push('waveDirector: weighted selection returned an unknown key');
  if (!(spawnInterval(8) < spawnInterval(1))) errors.push('waveDirector: spawn pressure must increase over time');

  return errors;
}
