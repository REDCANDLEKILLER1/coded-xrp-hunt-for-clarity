import { scaleCombatants } from './registry';
import type { EnemyDef } from './types';

/**
 * Mars threat definitions (reference pack v2).
 *
 * AIRBORNE units are wired into the Mars descent encounters. GROUND units are
 * defined here as data but NOT wired into any encounter — see the mechanics
 * gaps documented below; they need engine work or hazard-style placement
 * before they can fight.
 *
 * PROVISIONAL SPRITES: Codex owns the model-generation pipeline. Until real
 * Mars art lands, every def below reuses an EXISTING sprite id, clearly
 * marked. Nothing here is final art, and no nonexistent asset is registered.
 */

/** Sprite stand-ins, keyed by Mars unit. Delete this map when real art lands. */
export const PROVISIONAL_MARS_SPRITES: Record<string, { category: string; id: string }> = {
  dust_stalker: { category: 'enemies', id: 'fast_scout' },
  canyon_ambusher: { category: 'enemies', id: 'rug_fighter' },
  mars_raider: { category: 'enemies', id: 'whale_scout' },
  waxguard: { category: 'enemies', id: 'whale_scout' },
  furnace_crawler: { category: 'enemies', id: 'rug_fighter' },
  drain_leech: { category: 'enemies', id: 'fog_raider' },
};

export const MARS_ENEMIES: Record<string, EnemyDef> = scaleCombatants({
  dust_stalker: {
    key: 'dust_stalker',
    label: 'DUST STALKER',
    // PROVISIONAL sprite — replaced by Codex's pipeline.
    sprite: PROVISIONAL_MARS_SPRITES.dust_stalker,
    // Small, fast hunter of the dust storm. Darts across the lane.
    draw: { w: 24, h: 26 },
    hitbox: { w: 19, h: 21 },
    hp: 1,
    baseSpeed: 165,
    spawnRate: 0.7,
    score: 150,
    minWave: 1,
    spawnWeight: 0, // campaign-only: never enters the arcade wave director
    behavior: 'zigzag',
    fireRate: 2.0,
    projectileSpeed: 250,
    accent: '#ffb84d',
    doctrine: 'burst',
    hull: 'light',
  },
  canyon_ambusher: {
    key: 'canyon_ambusher',
    label: 'CANYON AMBUSHER',
    // PROVISIONAL sprite — replaced by Codex's pipeline.
    sprite: PROVISIONAL_MARS_SPRITES.canyon_ambusher,
    // Ambush predator: dives from the canyon walls, broadside guns.
    draw: { w: 30, h: 32 },
    hitbox: { w: 24, h: 26 },
    hp: 2,
    baseSpeed: 120,
    spawnRate: 0.74,
    score: 275,
    minWave: 1,
    spawnWeight: 0, // campaign-only
    behavior: 'dive',
    fireRate: 1.8,
    projectileSpeed: 260,
    accent: '#ff6b3d',
    doctrine: 'broadside',
    hull: 'medium',
  },
  mars_raider: {
    key: 'mars_raider',
    label: 'MARS RAIDER',
    // PROVISIONAL sprite — replaced by Codex's pipeline.
    sprite: PROVISIONAL_MARS_SPRITES.mars_raider,
    // Heavy gunship. Slow, ponderous, throws salvos — the one you respect.
    draw: { w: 40, h: 42 },
    hitbox: { w: 32, h: 34 },
    hp: 3,
    baseSpeed: 85,
    spawnRate: 0.8,
    score: 350,
    minWave: 1,
    spawnWeight: 0, // campaign-only
    behavior: 'sine',
    fireRate: 2.4,
    projectileSpeed: 230,
    accent: '#ff3a2a',
    doctrine: 'salvo',
    hull: 'heavy',
  },
});

/**
 * Ground units — DEFINED, NOT WIRED. None of these appear in any encounter.
 *
 * Mechanics gaps (engine work required before wiring):
 * - waxguard (ROYAL SENTINEL): a melee ground sentinel. The engine has no
 *   melee enemy behavior — enemies are ranged fliers, hazards are static
 *   guns. Needs either a melee behavior or a hazard-style placement.
 * - furnace_crawler (SIEGE MACHINE): a slow siege engine. Could map to
 *   hazard placement ('lane') later, but slow area-denial attacks have no
 *   engine support today.
 * - drain_leech (PARASITIC UNIT): attaches to the player and drains. No
 *   attach/drain mechanic exists in the engine. New work, flagged before
 *   anything is added.
 */
export const MARS_GROUND_UNITS: Record<string, EnemyDef> = scaleCombatants({
  waxguard: {
    key: 'waxguard',
    label: 'WAXGUARD',
    // PROVISIONAL sprite — replaced by Codex's pipeline. NOT WIRED.
    sprite: PROVISIONAL_MARS_SPRITES.waxguard,
    draw: { w: 38, h: 44 },
    hitbox: { w: 30, h: 36 },
    hp: 6,
    baseSpeed: 40,
    spawnRate: 0,
    score: 400,
    minWave: 1,
    spawnWeight: 0,
    behavior: 'straight',
    // No fireRate: melee sentinel. Engine has no melee support (see gaps).
    accent: '#ff3a2a',
    hull: 'heavy',
  },
  furnace_crawler: {
    key: 'furnace_crawler',
    label: 'FURNACE CRAWLER',
    // PROVISIONAL sprite — replaced by Codex's pipeline. NOT WIRED.
    sprite: PROVISIONAL_MARS_SPRITES.furnace_crawler,
    draw: { w: 44, h: 38 },
    hitbox: { w: 36, h: 30 },
    hp: 8,
    baseSpeed: 30,
    spawnRate: 0,
    score: 500,
    minWave: 1,
    spawnWeight: 0,
    behavior: 'straight',
    fireRate: 3.2,
    projectileSpeed: 200,
    accent: '#ff8a3d',
    doctrine: 'salvo',
    hull: 'heavy',
  },
  drain_leech: {
    key: 'drain_leech',
    label: 'DRAIN LEECH',
    // PROVISIONAL sprite — replaced by Codex's pipeline. NOT WIRED.
    sprite: PROVISIONAL_MARS_SPRITES.drain_leech,
    draw: { w: 26, h: 24 },
    hitbox: { w: 21, h: 19 },
    hp: 2,
    baseSpeed: 150,
    spawnRate: 0,
    score: 300,
    minWave: 1,
    spawnWeight: 0,
    behavior: 'dive',
    // No doctrine: parasitic drain has no engine support (see gaps).
    accent: '#ffb84d',
    hull: 'light',
  },
});

const SUPPORTED_BEHAVIORS = new Set(['straight', 'sine', 'zigzag', 'dive']);
const SUPPORTED_DOCTRINES = new Set(['pressure', 'burst', 'salvo', 'broadside']);

export function validateMarsThreats(): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();

  for (const [key, def] of Object.entries({ ...MARS_ENEMIES, ...MARS_GROUND_UNITS })) {
    if (def.key !== key) errors.push(`marsThreat.${key}: key mismatch ("${def.key}")`);
    if (seen.has(key)) errors.push(`marsThreat.${key}: duplicate key`);
    seen.add(key);
    // New units must not collide with any existing roster id.
    if (['regulator_drone', 'fog_raider', 'fast_scout', 'whale_scout', 'rug_fighter'].includes(key)) {
      errors.push(`marsThreat.${key}: collides with an existing enemy id`);
    }
    if (!(def.hp >= 1)) errors.push(`marsThreat.${key}: hp must be >= 1`);
    if (!(def.baseSpeed > 0)) errors.push(`marsThreat.${key}: baseSpeed must be > 0`);
    if (!SUPPORTED_BEHAVIORS.has(def.behavior)) errors.push(`marsThreat.${key}: unsupported behavior ${def.behavior}`);
    if (def.doctrine && !SUPPORTED_DOCTRINES.has(def.doctrine)) errors.push(`marsThreat.${key}: unsupported doctrine ${def.doctrine}`);
    if (def.spawnWeight !== 0) errors.push(`marsThreat.${key}: campaign-only units must not enter the wave director (spawnWeight 0)`);
    // Provisional sprites must reuse EXISTING art — never a nonexistent asset.
    const provisional = PROVISIONAL_MARS_SPRITES[key];
    if (!provisional) errors.push(`marsThreat.${key}: missing provisional sprite mapping`);
    else if (def.sprite.category !== provisional.category || def.sprite.id !== provisional.id) {
      errors.push(`marsThreat.${key}: sprite must match its provisional mapping`);
    }
  }

  // Ground units stay out of the airborne roster and out of encounters.
  for (const key of Object.keys(MARS_GROUND_UNITS)) {
    if (key in MARS_ENEMIES) errors.push(`marsThreat.${key}: ground unit leaked into the airborne roster`);
  }

  return errors;
}
