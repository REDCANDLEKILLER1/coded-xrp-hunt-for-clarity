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
export interface CompanionPlan { warp: boolean; advance: boolean; fire: boolean }
/** Keeps a recruited ally close without letting it shoot through authored cover. */
export function companionPlan(heroDistance:number,targetDistance:number,coverBlocked:boolean):CompanionPlan {
  return {warp:heroDistance>12,advance:heroDistance>2.25,fire:targetDistance<=15&&!coverBlocked};
}
export type BoardingInteraction = 'terminal' | 'crew' | 'none';
/** Room terminals win when the companion is standing beside the player. */
export function boardingInteraction(terminalDistance:number,crewDistance:number,crewVisible:boolean):BoardingInteraction {
  if(terminalDistance<=2.5)return 'terminal';
  if(crewVisible&&crewDistance<2.6)return 'crew';
  return 'none';
}

/** The bridge exit field is a hard traversal gate until Ledger Shield is active. */
export function canCrossExitField(fromZ:number,toZ:number,fieldZ:number,shieldOn:boolean):boolean {
  return shieldOn||fromZ>fieldZ||toZ<=fieldZ;
}
