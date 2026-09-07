import {RELIEF_BOUNDS,RELIEF_CORN,RELIEF_PUMPS} from './MarsRelief';
import {RELIEF_FIGHTER_PROXY,withinFootprint,type GroundPoint} from './FighterFootprint';
export interface SurfacePoint{x:number;z:number}
export const SURFACE_COMBAT={heroSpeed:5.8,heroDamage:12,heroInterval:.22,heroBoltSpeed:28,hostileBoltSpeed:9,hostileDamage:8,guardHP:48,range:13,maximumTells:2,repairAmount:40,repairCooldown:20} as const;
/** The flat navigation substrate and solid machine footprints share metre units. */
export function surfaceClear(p:SurfacePoint,fighter:readonly GroundPoint[]=RELIEF_FIGHTER_PROXY):boolean{
  if(p.x<RELIEF_BOUNDS.minX||p.x>RELIEF_BOUNDS.maxX||p.z<RELIEF_BOUNDS.minZ||p.z>RELIEF_BOUNDS.maxZ)return false;
  if(RELIEF_PUMPS.some(pump=>Math.hypot(p.x-pump.x,p.z-pump.z)<3.1))return false;
  if(withinFootprint(p,fighter))return false;
  if(Math.hypot(p.x-RELIEF_CORN.x,p.z-RELIEF_CORN.z)<.85)return false;
  if([-2.7,2.7].some(x=>Math.abs(p.x-x)<.45&&Math.abs(p.z+46)<.52))return false;
  if(Math.abs(p.x)<4.8&&p.z>6&&p.z<11.7)return false;
  if(Math.abs(Math.abs(p.x)-10)<3.1&&p.z>3.6&&p.z<12.3)return false;
  return true;
}
/** Axis sliding keeps touch movement along obstacles from sticking. */
export function surfaceMove(from:SurfacePoint,dx:number,dz:number,fighter:readonly GroundPoint[]=RELIEF_FIGHTER_PROXY):SurfacePoint{
  return slideSurface(from,dx,dz,p=>surfaceClear(p,fighter));
}
/** Short movement steps preserve thin boundaries during a high-speed dash. */
export function slideSurface(from:SurfacePoint,dx:number,dz:number,clear:(p:SurfacePoint)=>boolean):SurfacePoint{
  const next={x:from.x,z:from.z},distance=Math.hypot(dx,dz);if(!Number.isFinite(distance)||distance>50)return next;
  const steps=Math.max(1,Math.ceil(distance/.25));
  for(let i=0;i<steps;i++){if(clear({x:next.x+dx/steps,z:next.z}))next.x+=dx/steps;if(clear({x:next.x,z:next.z+dz/steps}))next.z+=dz/steps;}
  return next;
}
export function surfaceSegmentHit(a:SurfacePoint,b:SurfacePoint,center:SurfacePoint,radius:number):boolean{
  const x=b.x-a.x,z=b.z-a.z,t=Math.max(0,Math.min(1,((center.x-a.x)*x+(center.z-a.z)*z)/(x*x+z*z||1)));
  return Math.hypot(a.x+x*t-center.x,a.z+z*t-center.z)<=radius;
}
export function surfaceLineClear(a:SurfacePoint,b:SurfacePoint):boolean{
  return !RELIEF_PUMPS.some(p=>surfaceSegmentHit(a,b,p,2.7));
}
export function canSurfaceTell(distance:number,visible:boolean,activeTells:number):boolean{return distance<13&&visible&&activeTells<SURFACE_COMBAT.maximumTells;}
export function fieldRepair(life:number,cooldown:number,unlocked:boolean):{life:number;cooldown:number;used:boolean}{
  if(!unlocked||cooldown>0||life<=0||life>=100)return{life,cooldown,used:false};
  return{life:Math.min(100,life+SURFACE_COMBAT.repairAmount),cooldown:SURFACE_COMBAT.repairCooldown,used:true};
}
