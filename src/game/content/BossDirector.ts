import type { BossDef } from './types';

/** Boss keys ordered by their campaign trigger wave. */
export function orderedBossKeys(bosses: Record<string, BossDef>): string[] {
  return Object.values(bosses)
    .sort((a, b) => a.triggerWave - b.triggerWave)
    .map((boss) => boss.key);
}

/** Returns the next unlocked, unbeaten boss, or undefined when no encounter is due. */
export function nextBossKey(
  bosses: Record<string, BossDef>,
  wave: number,
  completed: ReadonlySet<string>,
): string | undefined {
  return orderedBossKeys(bosses).find((key) => bosses[key].triggerWave <= wave && !completed.has(key));
}

/** Resolves the active phase from remaining health. Phases must be stored high threshold to low. */
export function bossPhaseIndex(boss: BossDef, hp: number): number {
  const ratio = Math.max(0, hp) / boss.hp;
  let active = 0;
  for (let index = 0; index < boss.phases.length; index += 1) {
    if (ratio <= boss.phases[index].hpThreshold) active = index;
  }
  return active;
}
