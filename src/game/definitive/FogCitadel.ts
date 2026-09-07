import type {SurfacePoint} from './SurfaceCombat';
export const CITADEL={hp:900,cycle:14,openStart:2,openEnd:8,feedY:3.5,feedZ:-44,feedX:[-6,0,6],feedRadius:1.05} as const;
export interface FogHazard{id:number;kind:'lane'|'seeker';x:number;z:number;dx:number;dz:number;tell:number;life:number;hit:boolean}
/** Three real feeds, one current transmitter, finite committed hazards. */
export class FogCitadel{
  hp=CITADEL.hp as number;age=0;identifiedCycle=-1;private nextAttack=3;private serial=0;private attacks=0;readonly hazards:FogHazard[]=[];
  get cycle():number{return Math.floor(this.age/CITADEL.cycle);}
  get open():boolean{const t=this.age%CITADEL.cycle;return this.hp>0&&t>=CITADEL.openStart&&t<CITADEL.openEnd;}
  get trueFeed():number{return [2,0,1][this.cycle%3];}
  get identified():boolean{return this.open&&this.identifiedCycle===this.cycle;}
  identify(inRange:boolean):boolean{if(!inRange||!this.open)return false;this.identifiedCycle=this.cycle;return true;}
  hit(feed:number,damage:number):boolean{if(!this.identified||feed!==this.trueFeed||!Number.isFinite(damage)||damage<=0)return false;this.hp=Math.max(0,this.hp-damage);return true;}
  update(dt:number,hero:SurfacePoint,engaged:boolean):void{
    if(!Number.isFinite(dt)||dt<=0||!engaged||this.hp<=0)return;this.age+=dt;
    for(let i=this.hazards.length-1;i>=0;i--){const h=this.hazards[i];if(h.tell>0){h.tell=Math.max(0,h.tell-dt);continue;}h.life-=dt;if(h.kind==='seeker'){h.x+=h.dx*dt;h.z+=h.dz*dt;}if(h.life<=0)this.hazards.splice(i,1);}
    this.nextAttack-=dt;if(this.nextAttack>0||this.hazards.length>=4)return;
    const lane=this.attacks++%2===0;this.nextAttack=lane?4:5;
    if(lane){this.hazards.push({id:++this.serial,kind:'lane',x:Math.max(-16,Math.min(16,hero.x)),z:-29,dx:0,dz:0,tell:1.3,life:.55,hit:false});}
    else for(const x of [-8,8]){const z=-40,length=Math.hypot(hero.x-x,hero.z-z)||1;this.hazards.push({id:++this.serial,kind:'seeker',x,z,dx:(hero.x-x)/length*8,dz:(hero.z-z)/length*8,tell:1.1,life:3.3,hit:false});}
  }
}
