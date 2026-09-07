/** Pointer ownership is independent: steering never steals a held weapon finger. */
export class SpaceInput {
  private steering:number|null=null;
  private origin={x:0,y:0};
  private pointerX=0;
  private pointerY=0;
  private readonly guns=new Set<number>();
  private readonly boosts=new Set<number>();
  private readonly keys=new Set<string>();
  private lastTap=-Infinity;
  get x():number{return Math.max(-1,Math.min(1,this.pointerX+Number(this.keys.has('KeyD')||this.keys.has('ArrowRight'))-Number(this.keys.has('KeyA')||this.keys.has('ArrowLeft'))));}
  get y():number{return Math.max(-1,Math.min(1,this.pointerY+Number(this.keys.has('KeyS')||this.keys.has('ArrowDown'))-Number(this.keys.has('KeyW')||this.keys.has('ArrowUp'))));}
  get roll():number{return Number(this.keys.has('KeyE'))-Number(this.keys.has('KeyQ'));}
  get firing():boolean{return this.guns.size>0||this.keys.has('Space');}
  get boosting():boolean{return this.boosts.size>0||this.keys.has('ShiftLeft')||this.keys.has('ShiftRight');}
  get braking():boolean{return this.keys.has('KeyX');}
  down(id:number,x:number,y:number,action:'steer'|'guns'|'boost',time:number):void {
    if(action==='guns'){this.guns.add(id);return;}
    if(action==='boost'){this.boosts.add(id);return;}
    if(this.steering!==null)return;
    this.steering=id;this.origin={x,y};this.pointerX=this.pointerY=0;
    if(time-this.lastTap<.32)this.guns.add(id);
    this.lastTap=time;
  }
  move(id:number,x:number,y:number,travel:number):void {
    if(id!==this.steering)return;
    this.pointerX=(x-this.origin.x)/Math.max(1,travel);this.pointerY=(y-this.origin.y)/Math.max(1,travel);
    const length=Math.hypot(this.pointerX,this.pointerY);if(length>1){this.pointerX/=length;this.pointerY/=length;}
  }
  up(id:number):void {this.guns.delete(id);this.boosts.delete(id);if(id===this.steering){this.steering=null;this.pointerX=this.pointerY=0;}}
  key(code:string,down:boolean):void {if(down)this.keys.add(code);else this.keys.delete(code);}
  clear():void {this.steering=null;this.pointerX=this.pointerY=0;this.guns.clear();this.boosts.clear();this.keys.clear();this.lastTap=-Infinity;}
}
