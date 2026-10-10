export type GroundRole='turret'|'cannon'|'laser'|'missile'|'plasma'|'relay'|'jammer'|'beacon';
export interface GroundDefense {
  role:GroundRole; group:string; phase:'idle'|'tell'|'active'|'recover'; remaining:number; angle:number;
  /** Per-gun desync, so a row of guns does not telegraph in unison. */ stagger:number;
}
export interface GroundBody {x:number;y:number;w:number;h:number;hp?:number;ground?:GroundDefense}
export interface GroundRound {angle:number;speed:number;damage:number;size:number;key:string;homing?:number;track?:number;interceptible?:boolean}
const ROLES:Record<string,GroundRole>={basic_turret:'turret',cannon_turret:'cannon',cannon_tower:'cannon',laser_tower:'laser',missile_silo:'missile',plasma_turret:'plasma',shield_relay:'relay',signal_jammer:'jammer',clarity_beacon:'beacon'};
/**
 * Emplacement cadence.
 *
 * REST is what was retuned here, never TELL. An emplacement scrolls into its
 * firing window and then owes idle + tell before its first round, and measured
 * on the shipped build that put the first shot 3.68-4.55 s after spawn while
 * player bolts start landing at 0.73 s. 88 of 91 guns on a full Earth run died
 * without ever firing, and they died DURING the tell -- which is exactly why
 * the owner saw CHARGING and LASER LOCK on screen and never saw a shot.
 *
 * Shortening the tell is the obvious fix and it is forbidden:
 * scripts/validate-boss-tempo.mjs requires a 0.6 s minimum visible warning
 * before any first damage, for every role, at both heights. A gun that shoots
 * sooner by warning less is a different bug. Cutting REST instead keeps every
 * telegraph legible and buys back the volume.
 */
const TIMING={turret:{tell:.65,rest:.7},cannon:{tell:.62,rest:.95},laser:{tell:.62,rest:1},missile:{tell:.62,rest:1.05},plasma:{tell:.62,rest:.9}};
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
  const role=ROLES[key];return role?{role,group,phase:'idle',remaining:stagger,angle:Math.PI/2,stagger}:undefined;
}
export const friendlyGround=(body:GroundBody):boolean=>body.ground?.role==='beacon';
export function linkedRelay(body:GroundBody,bodies:readonly GroundBody[]):GroundBody|undefined {
  if(!body.ground||['relay','jammer','beacon'].includes(body.ground.role))return;
  return bodies.find(other=>other!==body&&(other.hp??0)>0&&other.ground?.role==='relay'&&other.ground.group===body.ground!.group);
}
/**
 * When an emplacement may start aiming.
 *
 * The floor was a literal 76px. An emplacement spawns at y = -draw.h, is drawn
 * every frame with no cull and is damageable from the moment it exists -- but
 * could not begin its telegraph until it had scrolled 76px plus its own height
 * onto the screen, and `tickGround` re-armed its idle timer every frame until
 * then. Measured, that put the first round 3.68-4.55s after spawn while player
 * bolts start landing at 0.73s, so the guns were shot dead during a telegraph
 * they were not yet allowed to finish: 88 of 91 silent across a full Earth run.
 *
 * The floor is now the gun's own silhouette plus a small margin, so it starts
 * aiming once it is genuinely on screen rather than a third of the way down it.
 * It still must be fully visible -- a gun that fires while it is a sliver at
 * the top edge is an unfair shot, and validate-boss-tempo asserts that an
 * offscreen emplacement neither fires nor pre-charges.
 */
export function groundVisible(body:GroundBody,height:number):boolean {return body.y>=Math.max(GROUND_ARM_Y,body.h/2+8)&&body.y<=height-70;}
const GROUND_ARM_Y=30;
export function groundAttacking(body:GroundBody):boolean {return body.ground?.phase==='tell'||body.ground?.phase==='active';}

/** All shots begin with an on-screen locked tell. Ground and air use the same
 * projectile motion; this module owns only distinct emplacement timing. */
export function tickGround(body:GroundBody,dt:number,player:{x:number;y:number;vx:number;vy:number},height:number,mayStart:boolean):GroundRound[] {
  const state=body.ground;if(!state||!(state.role in TIMING))return [];
  // Re-armed to this gun's OWN stagger, not a flat 0.65.
  //
  // The flat value was written to desynchronise a row of guns and measurably
  // did the opposite: it overwrote the seeded stagger on every off-window
  // frame, so every emplacement arrived at its firing line with exactly 0.65s
  // left and they armed in lockstep anyway. It also spent 0.65s of a gun's
  // short on-screen life doing nothing before the telegraph could even begin --
  // traced, a turret died with 0.10s still on this timer, having never left
  // 'idle'. Keeping the per-gun stagger gives the desync this was supposed to
  // provide and gives the telegraph the time it was eating.
  if(!groundVisible(body,height)){state.phase='idle';state.remaining=state.stagger;return [];}
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
