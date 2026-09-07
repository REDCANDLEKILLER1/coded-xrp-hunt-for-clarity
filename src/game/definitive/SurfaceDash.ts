import type {SurfacePoint} from './SurfaceCombat';
export const LIQUIDITY_DASH={duration:.18,speed:20,cooldown:5} as const;
/** Scene ownership decides when time advances; pause/dialogue cannot spend it. */
export class SurfaceDash{
  cooldown=0;remaining=0;private direction:SurfacePoint={x:0,z:1};
  get active():boolean{return this.remaining>0;}
  request(unlocked:boolean,direction:SurfacePoint):boolean{
    const length=Math.hypot(direction.x,direction.z);
    if(!unlocked||this.cooldown>0||!Number.isFinite(length)||length<.01)return false;
    this.direction={x:direction.x/length,z:direction.z/length};this.remaining=LIQUIDITY_DASH.duration;this.cooldown=LIQUIDITY_DASH.cooldown;return true;
  }
  update(dt:number):SurfacePoint{
    if(!Number.isFinite(dt)||dt<=0)return{x:0,z:0};
    this.cooldown=Math.max(0,this.cooldown-dt);const elapsed=Math.min(dt,this.remaining);this.remaining=Math.max(0,this.remaining-dt);
    return{x:this.direction.x*elapsed*LIQUIDITY_DASH.speed,z:this.direction.z*elapsed*LIQUIDITY_DASH.speed};
  }
}
