export type GroundRole='turret'|'cannon'|'laser'|'missile'|'plasma'|'relay'|'jammer'|'beacon';
export interface GroundDefense {
  role:GroundRole; group:string; phase:'idle'|'tell'|'active'|'recover'; remaining:number; angle:number;
}
export interface GroundBody {x:number;y:number;w:number;h:number;hp?:number;ground?:GroundDefense}
export interface GroundRound {angle:number;speed:number;damage:number;size:number;key:string;homing?:number;track?:number;interceptible?:boolean}
const ROLES:Record<string,GroundRole>={basic_turret:'turret',cannon_turret:'cannon',cannon_tower:'cannon',laser_tower:'laser',missile_silo:'missile',plasma_turret:'plasma',shield_relay:'relay',signal_jammer:'jammer',clarity_beacon:'beacon'};
const TIMING={turret:{tell:.65,rest:1.5},cannon:{tell:1.15,rest:2.3},laser:{tell:1.25,rest:2.5},missile:{tell:1.1,rest:2.6},plasma:{tell:.95,rest:2.2}};
export const GROUND_LABEL:Record<GroundRole,string>={turret:'BURST',cannon:'CHARGING',laser:'LASER LOCK',missile:'MISSILE LOCK',plasma:'PLASMA',relay:'SHIELD RELAY',jammer:'JAMMER',beacon:'FLY THROUGH · REPAIR'};
/** Measured image-space pivots keep the swivel and real muzzle co-located. */
export const GROUND_ART:Partial<Record<GroundRole,{id:string;size:number;pivotY:number;tipY:number;rotate:boolean}>>={
  turret:{id:'tracking_turret_v1',size:70,pivotY:.64,tipY:.055,rotate:true},
  cannon:{id:'heavy_cannon_v1',size:82,pivotY:.64,tipY:.025,rotate:true},
  laser:{id:'laser_tower_v1',size:82,pivotY:.72,tipY:.025,rotate:true},
  missile:{id:'missile_silo_v1',size:66,pivotY:.5,tipY:.5,rotate:false},
  plasma:{id:'plasma_battery_v1',size:76,pivotY:.65,tipY:.04,rotate:true},
};
export function groundMuzzle(body:GroundBody):{x:number;y:number} {
  const art=body.ground?GROUND_ART[body.ground.role]:undefined;
  const reach=art?art.size*(art.pivotY-art.tipY):0,angle=body.ground?.angle??Math.PI/2;
  return{x:body.x+Math.cos(angle)*reach,y:body.y+Math.sin(angle)*reach};
}
export function groundDefense(key:string,group:string,stagger=0):GroundDefense|undefined {
  const role=ROLES[key];return role?{role,group,phase:'idle',remaining:.65+stagger,angle:Math.PI/2}:undefined;
}
export const friendlyGround=(body:GroundBody):boolean=>body.ground?.role==='beacon';
export function linkedRelay(body:GroundBody,bodies:readonly GroundBody[]):GroundBody|undefined {
  if(!body.ground||['relay','jammer','beacon'].includes(body.ground.role))return;
  return bodies.find(other=>other!==body&&(other.hp??0)>0&&other.ground?.role==='relay'&&other.ground.group===body.ground!.group);
}
export function groundVisible(body:GroundBody,height:number):boolean {return body.y>=Math.max(76,body.h/2+24)&&body.y<=height-70;}
export function groundAttacking(body:GroundBody):boolean {return body.ground?.phase==='tell'||body.ground?.phase==='active';}

/** All shots begin with an on-screen locked tell. Ground and air use the same
 * projectile motion; this module owns only distinct emplacement timing. */
export function tickGround(body:GroundBody,dt:number,player:{x:number;y:number;vx:number;vy:number},height:number,mayStart:boolean):GroundRound[] {
  const state=body.ground;if(!state||!(state.role in TIMING))return [];
  if(!groundVisible(body,height)){state.phase='idle';state.remaining=.65;return [];}
  const timing=TIMING[state.role as keyof typeof TIMING];
  state.remaining=Math.max(0,state.remaining-Math.max(0,dt));
  if(state.remaining>0)return [];
  if(state.phase==='idle'||state.phase==='recover'){
    if(!mayStart)return [];
    const prediction=state.role==='turret'?.18:0;
    state.angle=Math.atan2(player.y+player.vy*prediction-body.y,player.x+player.vx*prediction-body.x);
    state.phase='tell';state.remaining=timing.tell;return [];
  }
  if(state.phase==='active'){state.phase='recover';state.remaining=timing.rest;return [];}
  if(state.role==='laser'){state.phase='active';state.remaining=.32;return [];}
  state.phase='recover';state.remaining=timing.rest;
  const round=(offset:number,speed:number,damage:number,size:number,key:string):GroundRound=>({angle:state.angle+offset,speed,damage,size,key});
  if(state.role==='turret')return [-.065,0,.065].map(offset=>round(offset,250,1,9,'enemy_red_bullet'));
  if(state.role==='cannon')return [round(0,205,2,19,'enemy_red_bullet')];
  if(state.role==='missile')return [{...round(0,185,1,16,'enemy_missile'),homing:1.1,track:1.25,interceptible:true}];
  return [-.28,0,.28].map(offset=>round(offset,170,1,21,'enemy_red_bullet'));
}

/** Same finite segment supplies the warning, beam render and collision. */
export function groundBeam(body:GroundBody,width:number,height:number):{x:number;y:number;x2:number;y2:number} {
  const origin=groundMuzzle(body);
  const angle=body.ground?.angle??Math.PI/2,dx=Math.cos(angle),dy=Math.sin(angle);
  const tx=Math.abs(dx)<1e-6?Infinity:(dx>0?width-origin.x:-origin.x)/dx;
  const ty=Math.abs(dy)<1e-6?Infinity:(dy>0?height-origin.y:-origin.y)/dy;
  const distance=Math.max(0,Math.min(tx,ty));return{...origin,x2:origin.x+dx*distance,y2:origin.y+dy*distance};
}
export function beamHits(body:GroundBody,player:GroundBody,width:number,height:number):boolean {
  if(body.ground?.role!=='laser'||body.ground.phase!=='active'||!groundVisible(body,height))return false;
  const beam=groundBeam(body,width,height),dx=beam.x2-beam.x,dy=beam.y2-beam.y;
  const t=Math.max(0,Math.min(1,((player.x-beam.x)*dx+(player.y-beam.y)*dy)/(dx*dx+dy*dy||1)));
  return Math.hypot(player.x-beam.x-t*dx,player.y-beam.y-t*dy)<8+Math.min(player.w,player.h)*.28;
}
