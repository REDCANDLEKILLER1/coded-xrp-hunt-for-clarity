import {validCapitalCheckpoint,type CapitalCheckpoint} from './CapitalTactics';
export type SpaceRouteId='earth_mars'|'mars_fog_moon'|'fog_bullion_reach';
export interface SpaceCheckpoint {
  /** Missing in established saves means the original Earth-to-Mars route. */
  route?:SpaceRouteId;
  phase:'departure'|'transit'|'mars'|'arrival';
  position:[number,number,number];
  orientation:[number,number,number,number];
  wave:number;
  seconds:number;
  hull:number;
  fore:number;
  aft:number;
  blockade?:CapitalCheckpoint;
}
export function initialSpaceCheckpoint():SpaceCheckpoint {
  return {phase:'departure',position:[0,0,0],orientation:[0,0,0,1],wave:0,seconds:0,hull:100,fore:100,aft:100};
}
export function validSpaceCheckpoint(value:unknown):value is SpaceCheckpoint {
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const v=value as Record<string,unknown>;
  const finite=(n:unknown,min:number,max:number)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
  return (v.route===undefined||typeof v.route==='string'&&['earth_mars','mars_fog_moon','fog_bullion_reach'].includes(v.route))
    &&typeof v.phase==='string'&&['departure','transit','mars','arrival'].includes(v.phase)
    &&(v.phase!=='arrival'||v.route==='mars_fog_moon'||v.route==='fog_bullion_reach')&&(v.phase!=='mars'||v.route===undefined||v.route==='earth_mars')
    &&Array.isArray(v.position)&&v.position.length===3&&v.position.every(n=>finite(n,-500000,500000))
    &&Array.isArray(v.orientation)&&v.orientation.length===4&&v.orientation.every(n=>finite(n,-1,1))&&Math.abs(v.orientation.reduce((a:number,b:number)=>a+b*b,0)-1)<.001
    &&Number.isInteger(v.wave)&&finite(v.wave,0,v.route==='mars_fog_moon'||v.route==='fog_bullion_reach'?3:4)&&finite(v.seconds,0,1e7)
    &&(v.blockade===undefined||validCapitalCheckpoint(v.blockade,v.wave as number))
    &&finite(v.hull,0,100)&&finite(v.fore,0,150)&&finite(v.aft,0,150);
}
