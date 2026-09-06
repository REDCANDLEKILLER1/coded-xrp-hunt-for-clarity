export interface BoardingTarget { kind: 'guard' | 'relay' | 'core'; hp: number; x: number; z: number }

/** A nearer protected Core must not steal assisted aim from its remaining relay. */
export function selectBoardingTarget<T extends BoardingTarget>(targets: readonly T[], x: number, z: number): T | undefined {
  const alive = targets.filter(target => target.hp > 0);
  const relaysAlive = alive.some(target => target.kind === 'relay');
  return alive.sort((a, b) =>
    (Number(relaysAlive && a.kind === 'core') - Number(relaysAlive && b.kind === 'core'))
    || ((a.x-x)**2 + (a.z-z)**2) - ((b.x-x)**2 + (b.z-z)**2))[0];
}

export function coreExposure(relaysAlive: boolean, clock: number): boolean {
  return !relaysAlive && clock % 10 > 6;
}
