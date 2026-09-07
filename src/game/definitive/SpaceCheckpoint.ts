export interface SpaceCheckpoint {
  phase:'departure'|'transit'|'mars';
  position:[number,number,number];
  orientation:[number,number,number,number];
  wave:number;
  seconds:number;
  hull:number;
  fore:number;
  aft:number;
}
export function initialSpaceCheckpoint():SpaceCheckpoint {
  return {phase:'departure',position:[0,0,0],orientation:[0,0,0,1],wave:0,seconds:0,hull:100,fore:100,aft:100};
}
export function validSpaceCheckpoint(value:unknown):value is SpaceCheckpoint {
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const v=value as Record<string,unknown>;
  const finite=(n:unknown,min:number,max:number)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
  return ['departure','transit','mars'].includes(String(v.phase))
    &&Array.isArray(v.position)&&v.position.length===3&&v.position.every(n=>finite(n,-500000,500000))
    &&Array.isArray(v.orientation)&&v.orientation.length===4&&v.orientation.every(n=>finite(n,-1,1))&&Math.abs(v.orientation.reduce((a:number,b:number)=>a+b*b,0)-1)<.001
    &&Number.isInteger(v.wave)&&finite(v.wave,0,4)&&finite(v.seconds,0,1e7)
    &&finite(v.hull,0,100)&&finite(v.fore,0,150)&&finite(v.aft,0,150);
}
