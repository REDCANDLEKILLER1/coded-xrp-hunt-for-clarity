/** Isolated Arrival Bay tactics rules. No production quest/save mutation. */
export interface TacticalActor {
  id: string;
  level: number;
  xp: number;
  nextXp: number;
  hp: number;
  maxHp: number;
  attack: number;
}
export type TacticalPhase = 'explore'|'player'|'enemy'|'victory'|'defeat';
export const ACTION_POINTS = 2;
export const MOVE_RANGE_METRES = 6;
export const DOOR_GUARD_TRIGGER_METRES = 7.5;

export function createTacticalActor(id:string, maxHp:number, attack:number):TacticalActor {
  return { id, level:1, xp:0, nextXp:50, hp:maxHp, maxHp, attack };
}

/** Each actor owns its own XP and stats, ready for future recruited teammates. */
export function gainTacticalXp(actor:TacticalActor, amount:number):TacticalActor {
  const next={...actor,xp:actor.xp+Math.max(0,Math.floor(amount))};
  while(next.xp>=next.nextXp){
    next.xp-=next.nextXp;
    next.level++;
    next.nextXp=50*next.level;
    next.maxHp+=12;
    next.hp=Math.min(next.maxHp,next.hp+12);
    next.attack+=3;
  }
  return next;
}
export function canTacticalMove(from:{x:number;z:number},to:{x:number;z:number},ap:number):boolean {
  const distance=Math.hypot(to.x-from.x,to.z-from.z);
  return ap>=1 && distance>.1 && distance<=MOVE_RANGE_METRES+1e-6
    && Math.abs(to.x)<=12 && Math.abs(to.z)<=12;
}
export function tacticalDamage(base:number,covered:boolean):number {
  return Math.max(1,Math.round(base*(covered?.45:1)));
}
export function pinchTacticalCamera(current:number,oldDistance:number,newDistance:number):number {
  if(![current,oldDistance,newDistance].every(Number.isFinite)||oldDistance<12||newDistance<12)return current;
  return Math.max(.62,Math.min(1.65,current*oldDistance/newDistance));
}
