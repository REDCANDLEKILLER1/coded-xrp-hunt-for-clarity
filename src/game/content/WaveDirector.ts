import type { EnemyDef } from './types';

/** Returns the enemy keys currently unlocked for a wave, in registry order. */
export function availableEnemyKeys(enemies: Record<string, EnemyDef>, wave: number): string[] {
  const safeWave = Math.max(1, Math.floor(wave));
  return Object.entries(enemies)
    .filter(([, enemy]) => enemy.minWave <= safeWave)
    .map(([key]) => key);
}

/**
 * Deterministic weighted selection when supplied a roll in [0, 1]. Keeping
 * this pure makes wave composition testable without a browser or canvas.
 */
export function selectEnemyKey(enemies: Record<string, EnemyDef>, wave: number, roll: number): string {
  const keys = availableEnemyKeys(enemies, wave);
  if (keys.length === 0) throw new Error(`No enemies are available for wave ${wave}.`);

  const totalWeight = keys.reduce((total, key) => total + enemies[key].spawnWeight, 0);
  const normalizedRoll = Math.max(0, Math.min(0.999999, Number.isFinite(roll) ? roll : 0));
  let cursor = normalizedRoll * totalWeight;

  for (const key of keys) {
    cursor -= enemies[key].spawnWeight;
    if (cursor < 0) return key;
  }

  return keys[keys.length - 1];
}

/** Escalates pressure without allowing an unreadable mobile-screen flood. */
export function spawnInterval(wave: number): number {
  return Math.max(0.28, 0.72 - Math.max(1, wave) * 0.022);
}
