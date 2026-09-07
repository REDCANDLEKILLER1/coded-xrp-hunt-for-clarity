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
    draw: { w: 30, h: 40 },
    hitbox: { w: 22, h: 30 },
    hp: 1,
    baseSpeed: 205,
    spawnRate: 0.62,
    score: 160,
    minWave: 1,
    spawnWeight: 0,
    behavior: 'zigzag',
    fireRate: 1.7,
    projectileSpeed: 285,
    accent: '#ff3030',
    doctrine: 'pressure',
  },
});

export const EARTH_HAZARDS: Record<string, HazardDef> = scaleCombatants({
  shield_relay: {
    key:'shield_relay',label:'SHIELD RELAY',sprite:{category:'hazards',id:'shield_relay_v1'},
    draw:{w:62,h:62},hitbox:{w:40,h:40},hp:5,minWave:1,spawnRate:0,fireRate:0,projectileSpeed:0,
    score:550,accent:'#ff3030',spawnWeight:0,placement:'lane',fires:false,
  },
  signal_jammer: {
    key:'signal_jammer',label:'SIGNAL JAMMER',sprite:{category:'hazards',id:'signal_jammer_v2'},
    draw:{w:68,h:68},hitbox:{w:48,h:36},hp:4,minWave:1,spawnRate:0,fireRate:0,projectileSpeed:0,
    score:450,accent:'#ff3030',spawnWeight:0,placement:'lane',fires:false,
  },
  clarity_beacon: {
    key:'clarity_beacon',label:'CLARITY BEACON',sprite:{category:'hazards',id:'clarity_beacon_v1'},
    draw:{w:54,h:54},hitbox:{w:54,h:54},hp:1,minWave:1,spawnRate:0,fireRate:0,projectileSpeed:0,
    score:0,accent:'#00ff00',spawnWeight:0,placement:'lane',fires:false,
  },
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
