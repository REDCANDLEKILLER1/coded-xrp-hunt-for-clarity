import { scaleCombatants } from './registry';
import type { EnemyDef, HazardDef } from './types';

/**
 * Earth-only threat definitions introduced by the Level 1 vertical slice.
 * They stay out of the global arcade registry so ARCADE TEST RUN preserves
 * the previously validated random bestiary while the campaign is authored.
 */
export const EARTH_ENEMIES: Record<string, EnemyDef> = scaleCombatants({
  fast_scout: {
    key: 'fast_scout',
    label: 'FAST SCOUT',
    sprite: { category: 'enemies', id: 'fast_scout' },
    // Re-authored down into the light band. At 30x40 this scouted bigger than
    // both mediums (31px tall against their 25px), so the size classes said
    // one thing and the content said another -- and size is the only signal
    // that survives at phone scale.
    draw: { w: 22, h: 29 },
    hitbox: { w: 17, h: 23 },
    hp: 1,
    baseSpeed: 205,
    spawnRate: 0.62,
    score: 160,
    minWave: 1,
    spawnWeight: 0,
    behavior: 'zigzag',
    fireRate: 1.7,
    projectileSpeed: 285,
    accent: '#ff5ce1',
    hull: 'light',
  },
});

export const EARTH_HAZARDS: Record<string, HazardDef> = scaleCombatants({
  armored_space_mine: {
    key: 'armored_space_mine',
    label: 'ARMORED SPACE MINE',
    sprite: { category: 'hazards', id: 'armored_space_mine' },
    draw: { w: 46, h: 40 },
    hitbox: { w: 36, h: 32 },
    hp: 3,
    minWave: 1,
    spawnRate: 0,
    fireRate: 0,
    projectileSpeed: 0,
    score: 300,
    accent: '#ff3355',
    spawnWeight: 0,
    placement: 'lane',
    fires: false,
  },
});

export function validateEarthThreats(): string[] {
  const errors: string[] = [];
  const scout = EARTH_ENEMIES.fast_scout;
  const mine = EARTH_HAZARDS.armored_space_mine;

  if (!scout || scout.sprite.category !== 'enemies' || scout.sprite.id !== 'fast_scout') {
    errors.push('earthThreat.fast_scout: manifest sprite mapping is invalid');
  }
  if (!scout || scout.hp < 1 || scout.baseSpeed <= 0 || scout.spawnWeight !== 0) {
    errors.push('earthThreat.fast_scout: campaign-only stats are invalid');
  }
  if (!mine || mine.sprite.category !== 'hazards' || mine.sprite.id !== 'armored_space_mine') {
    errors.push('earthThreat.armored_space_mine: manifest sprite mapping is invalid');
  }
  if (!mine || mine.hp < 1 || mine.fires || mine.placement !== 'lane' || mine.spawnWeight !== 0) {
    errors.push('earthThreat.armored_space_mine: campaign-only stats are invalid');
  }

  return errors;
}
