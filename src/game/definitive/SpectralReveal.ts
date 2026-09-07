export const REVEAL={duration:5,cooldown:12,radius:15} as const;
/** Owned-scene clock: pauses and conversations do not spend either timer. */
export class SpectralReveal{
  remaining=0;cooldown=0;
  request(unlocked:boolean):boolean{if(!unlocked||this.cooldown>0)return false;this.remaining=REVEAL.duration;this.cooldown=REVEAL.cooldown;return true;}
  update(dt:number):void{if(!Number.isFinite(dt)||dt<=0)return;this.remaining=Math.max(0,this.remaining-dt);this.cooldown=Math.max(0,this.cooldown-dt);}
  reaches(a:{x:number;z:number},b:{x:number;z:number}):boolean{return this.remaining>0&&Math.hypot(a.x-b.x,a.z-b.z)<=REVEAL.radius;}
}
