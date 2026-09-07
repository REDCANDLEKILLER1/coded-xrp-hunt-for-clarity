export interface GroundPosition{x:number;z:number}
export const WARDEN={hp:960,pylonHP:180,pylonWindow:12,exposure:7.5,position:{x:0,z:-35},core:{x:0,y:2.6,z:-22},left:{x:-5.8,y:6.4,z:-29},right:{x:5.8,y:6.4,z:-29}} as const;
export type WardenTarget='left'|'right'|'core';
export interface MiningHazard{id:number;kind:'laser-x'|'laser-z'|'slam';x:number;z:number;age:number;warning:number;duration:number;radius:number}
export function miningHazardHits(h:MiningHazard,p:GroundPosition):boolean{
  if(h.age<h.warning||h.age>=h.warning+h.duration)return false;
  return h.kind==='slam'?Math.hypot(p.x-h.x,p.z-h.z)<h.radius:h.kind==='laser-x'?Math.abs(p.x-h.x)<h.radius&&p.z>=-19&&p.z<=7:Math.abs(p.z-h.z)<h.radius&&Math.abs(p.x)<=18;
}
/** Deterministic mining cycle; scene-owned real projectiles call damage(). */
export class MarginWarden{
  hp:number=WARDEN.hp;
  readonly pylons={left:{hp:WARDEN.pylonHP as number,restart:0},right:{hp:WARDEN.pylonHP as number,restart:0}};
  readonly hazards:MiningHazard[]=[];
  exposure=0;started=false;private clock=1.3;private sequence=0;private serial=0;
  get defeated():boolean{return this.hp<=0;}
  get exposed():boolean{return this.exposure>0&&!this.defeated;}
  targets():WardenTarget[]{return this.defeated?[]:this.exposed?['core']:(['left','right'] as const).filter(id=>this.pylons[id].hp>0);}
  damage(id:WardenTarget,amount:number):boolean{
    if(!this.started||this.defeated||!Number.isFinite(amount)||amount<=0)return false;
    if(id==='core'){
      if(!this.exposed)return false;this.hp=Math.max(0,this.hp-amount);if(this.defeated)this.hazards.length=0;return true;
    }
    const p=this.pylons[id];if(this.exposed||p.hp<=0)return false;
    p.hp=Math.max(0,p.hp-amount);if(p.hp===0)p.restart=WARDEN.pylonWindow;
    if(this.pylons.left.hp===0&&this.pylons.right.hp===0){this.exposure=WARDEN.exposure;this.pylons.left.restart=this.pylons.right.restart=0;}
    return true;
  }
  update(dt:number,hero:GroundPosition):void{
    if(!this.started||this.defeated||!Number.isFinite(dt)||dt<=0)return;
    for(let i=this.hazards.length-1;i>=0;i--){const h=this.hazards[i];h.age+=dt;if(h.age>=h.warning+h.duration)this.hazards.splice(i,1);}
    if(this.exposure>0){this.exposure=Math.max(0,this.exposure-dt);if(this.exposure===0)for(const p of Object.values(this.pylons))p.hp=WARDEN.pylonHP;}
    else for(const p of Object.values(this.pylons))if(p.hp===0){p.restart=Math.max(0,p.restart-dt);if(p.restart===0)p.hp=WARDEN.pylonHP;}
    this.clock-=dt;
    if(this.clock>0||hero.z>7||this.hazards.length>0)return;
    this.clock=this.hp<WARDEN.hp*.5?3.1:3.8;const attack=this.sequence++%3;
    const x=Math.max(-16.5,Math.min(16.5,hero.x)),z=Math.max(-18.5,Math.min(5.5,hero.z));
    if(attack===1){for(const offset of [-4,0,4])this.hazards.push({id:++this.serial,kind:'slam',x:Math.max(-16,Math.min(16,x+offset)),z,age:0,warning:1.5,duration:.35,radius:1.65});}
    else this.hazards.push({id:++this.serial,kind:attack===0?'laser-x':'laser-z',x,z,age:0,warning:1.25,duration:.65,radius:1.05});
  }
}
