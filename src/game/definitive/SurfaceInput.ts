/** A secondary touch does not necessarily produce a browser click. Accept its
 * down edge directly, plus detail-zero keyboard/accessibility activation. */
export function bindSurfaceButton(button:HTMLButtonElement,action:()=>void,signal:AbortSignal):void{
  button.addEventListener('pointerdown',event=>{if(button.disabled||event.button!==0)return;event.preventDefault();event.stopPropagation();action();},{signal});
  button.addEventListener('click',event=>{event.stopPropagation();if(!button.disabled&&event.detail===0)action();},{signal});
}

/** On-foot ownership stays separate from both flight controllers. Native
 * movement and weapon pointers can coexist and are cleared at modal edges. */
export class SurfaceInput {
  private readonly lifetime=new AbortController();
  private readonly keys=new Set<string>();
  private owned=false;
  private movementPointer:number|null=null;
  private weaponPointer:number|null=null;
  private origin={x:0,y:0};
  private stick={x:0,y:0};
  constructor(private readonly canvas:HTMLCanvasElement,private readonly fire:HTMLButtonElement,private readonly canAct:()=>boolean,actions:{interact:()=>void;pause:()=>void;repair:()=>void;shield:()=>void;dash?:()=>void;reveal?:()=>void}){
    const options={signal:this.lifetime.signal};
    const usable=()=>this.owned&&this.canAct();
    canvas.addEventListener('pointerdown',event=>{
      if(!usable())return;event.preventDefault();
      if(event.pointerType==='mouse')this.weaponPointer=event.pointerId;
      else if(this.movementPointer===null){this.movementPointer=event.pointerId;this.origin={x:event.clientX,y:event.clientY};this.stick={x:0,y:0};}
      canvas.setPointerCapture(event.pointerId);
    },options);
    canvas.addEventListener('pointermove',event=>{
      if(!usable()||event.pointerId!==this.movementPointer)return;
      const x=(event.clientX-this.origin.x)/48,y=(event.clientY-this.origin.y)/48,scale=Math.max(1,Math.hypot(x,y));this.stick={x:x/scale,y:y/scale};
    },options);
    fire.addEventListener('pointerdown',event=>{if(!usable())return;event.preventDefault();event.stopPropagation();this.weaponPointer=event.pointerId;fire.setPointerCapture(event.pointerId);},options);
    const release=(event:PointerEvent)=>{if(event.pointerId===this.movementPointer){this.movementPointer=null;this.stick={x:0,y:0};}if(event.pointerId===this.weaponPointer)this.weaponPointer=null;};
    for(const element of [canvas,fire])for(const type of ['pointerup','pointercancel','lostpointercapture'])element.addEventListener(type,release as EventListener,options);
    window.addEventListener('keydown',event=>{
      if(!this.owned)return;
      if(event.code==='KeyP'&&!event.repeat){actions.pause();return;}
      if(!usable())return;
      if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.code))event.preventDefault();
      this.keys.add(event.code);
      if(!event.repeat){if(event.code==='KeyE')actions.interact();if(event.code==='KeyR')actions.repair();if(event.code==='KeyQ')actions.shield();if(event.code==='KeyF')actions.reveal?.();if(event.code==='ShiftLeft'||event.code==='ShiftRight')actions.dash?.();}
    },options);
    window.addEventListener('keyup',event=>this.keys.delete(event.code),options);
    window.addEventListener('resize',()=>this.clear(),options);
  }
  get firing():boolean{return this.owned&&this.canAct()&&(this.weaponPointer!==null||this.keys.has('Space'));}
  get move():{x:number;y:number}{
    if(!this.owned||!this.canAct())return{x:0,y:0};
    const x=this.stick.x+Number(this.keys.has('KeyD')||this.keys.has('ArrowRight'))-Number(this.keys.has('KeyA')||this.keys.has('ArrowLeft'));
    const y=this.stick.y+Number(this.keys.has('KeyS')||this.keys.has('ArrowDown'))-Number(this.keys.has('KeyW')||this.keys.has('ArrowUp'));
    const scale=Math.max(1,Math.hypot(x,y));return{x:x/scale,y:y/scale};
  }
  setActive(value:boolean):void{this.owned=value;this.clear();}
  clear():void{
    const ids=[this.movementPointer,this.weaponPointer];this.movementPointer=this.weaponPointer=null;this.stick={x:0,y:0};this.keys.clear();
    for(const id of ids)if(id!==null)for(const element of [this.canvas,this.fire])if(element.hasPointerCapture(id))element.releasePointerCapture(id);
  }
  dispose():void{this.owned=false;this.clear();this.lifetime.abort();}
}
