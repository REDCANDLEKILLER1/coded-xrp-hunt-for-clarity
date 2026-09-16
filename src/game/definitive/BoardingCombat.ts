export interface BoardingTarget { kind: BoardingEnemyKind; hp: number; x: number; z: number }

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
export function companionGait(followDistance:number):'Idle'|'Walk'|'Run' {
  return followDistance<=.25?'Idle':followDistance<=1.5?'Walk':'Run';
}
export type BoardingInteraction = 'terminal' | 'crew' | 'none';
/** Room terminals win when the companion is standing beside the player. */
export function boardingInteraction(terminalDistance:number,crewDistance:number,crewVisible:boolean):BoardingInteraction {
  if(terminalDistance<=2.5)return 'terminal';
  if(crewVisible&&crewDistance<2.6)return 'crew';
  return 'none';
}

/** The hostile bridge field requires Ledger Shield; capture makes it safe to revisit. */
export function canCrossExitField(fromZ:number,toZ:number,fieldZ:number,shieldOn:boolean,captured=false):boolean {
  return captured||shieldOn||fromZ>fieldZ||toZ<=fieldZ;
}

export interface BoardingWeapon {
  level:number;
  label:string;
  damage:number;
  cooldown:number;
  shots:number;
  spread:number;
}
export const BOARDING_WEAPONS:readonly BoardingWeapon[]=[
  {level:1,label:'ION SIDEARM',damage:14,cooldown:.23,shots:1,spread:0},
  {level:2,label:'PULSE REPEATER',damage:12,cooldown:.13,shots:1,spread:0},
  {level:3,label:'ARC SCATTERGUN',damage:10,cooldown:.34,shots:3,spread:.19},
  {level:4,label:'LEDGER CANNON',damage:22,cooldown:.22,shots:2,spread:.075},
];
export function boardingWeapon(level:unknown):BoardingWeapon {
  const parsed=Number(level??1);const safeLevel=Number.isFinite(parsed)?parsed:1;
  return BOARDING_WEAPONS[Math.max(0,Math.min(BOARDING_WEAPONS.length-1,Math.floor(safeLevel)-1))];
}
export type BoardingEnemyKind='guard'|'rifle'|'breacher'|'technician'|'ceiling'|'relay'|'core'|'warden'|'captain';
export function boardingEnemyHealth(kind:BoardingEnemyKind):number {
  return kind==='captain'?520:kind==='core'?650:kind==='warden'?210:kind==='breacher'?140:kind==='technician'?70:kind==='rifle'?55:kind==='ceiling'?50:kind==='relay'?65:42;
}
export function boardingEnemyVolley(kind:BoardingEnemyKind,tactic:number):readonly number[] {
  if(kind==='captain')return [-.48,-.24,0,.24,.48];
  if(kind==='core')return [-.28,0,.28];
  if(kind==='warden')return tactic%2?[-.2,0,.2]:[-.1,.1];
  if(kind==='breacher')return [-.16,0,.16];
  if(kind==='ceiling')return [-.1,.1];
  return [0];
}
export interface BoardingPressure { attackers:number; cadence:number }
export function boardingPressure(room:string):BoardingPressure {
  if(room==='security')return {attackers:4,cadence:.72};
  if(room==='rescue')return {attackers:4,cadence:.74};
  if(room==='engineering')return {attackers:4,cadence:.8};
  if(room==='command')return {attackers:4,cadence:.85};
  return {attackers:3,cadence:1};
}
/** The breacher's visible forward shield rewards movement and melee instead of extra health. */
export function boardingEnemyDamage(kind:BoardingEnemyKind,damage:number,frontHit=false,melee=false):number {
  if(kind==='breacher'&&frontHit&&!melee)return damage*.35;
  if(kind==='ceiling'&&melee)return damage*.5;
  return damage;
}
/** Boarding weapon mastery remains useful on every later on-foot world. */
export function campaignHeroDamage(base:number,boardingLevel:unknown):number {
  const multiplier=[1,1.15,1.35,1.65][boardingWeapon(boardingLevel).level-1];
  return base*multiplier;
}

export interface BoardingObstacle { x:number; z:number; w:number; d:number }
/** A landing or checkpoint overlap may retreat out of cover, but never move deeper. */
export function boardingObstacleBlocksMove(obstacles:readonly BoardingObstacle[],from:{x:number;z:number},to:{x:number;z:number},radius=.3):boolean {
  return obstacles.some(obstacle=>{
    const depth=(point:{x:number;z:number})=>Math.min(obstacle.w/2+radius-Math.abs(point.x-obstacle.x),obstacle.d/2+radius-Math.abs(point.z-obstacle.z));
    const next=depth(to);
    if(next<=0)return false;
    const current=depth(from);
    if(current<=0)return true;
    const outwardX=Math.abs(to.x-obstacle.x)-Math.abs(from.x-obstacle.x);
    const outwardZ=Math.abs(to.z-obstacle.z)-Math.abs(from.z-obstacle.z);
    return outwardX<0||outwardZ<0||(outwardX<=1e-6&&outwardZ<=1e-6);
  });
}
