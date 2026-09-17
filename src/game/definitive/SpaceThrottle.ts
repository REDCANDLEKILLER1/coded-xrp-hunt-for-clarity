export const MIN_THROTTLE=.3;
export const MAX_THROTTLE=2.2;
export const THROTTLE_STEP=.1;

export const clampThrottle=(value:number):number=>Math.max(MIN_THROTTLE,Math.min(MAX_THROTTLE,Number.isFinite(value)?value:1));

export const stepThrottle=(value:number,direction:number):number=>
  clampThrottle(Math.round((value+Math.sign(direction)*THROTTLE_STEP)*10)/10);

export const commandedSpeed=(cruise:number,throttle:number,braking:boolean,boosting:boolean):number=>
  cruise*(braking?.25:boosting?MAX_THROTTLE:clampThrottle(throttle));

export interface ThrottleUI{root:HTMLElement;update:(value:number)=>void}

/** Owns the real touch controls so the validator can drive the same wiring as the game. */
export function createThrottleUI(doc:Document,onStep:(direction:number)=>void,signal?:AbortSignal):ThrottleUI{
  const root=doc.createElement('div');root.className='space-throttle';
  const button=(text:string,label:string,direction:number)=>{const element=doc.createElement('button');element.type='button';element.textContent=text;element.setAttribute('aria-label',label);element.addEventListener('click',()=>onStep(direction),signal?{signal}:undefined);return element;};
  const down=button('−','Decrease throttle',-1),readout=doc.createElement('b'),up=button('+','Increase throttle',1);readout.dataset.throttle='readout';root.append(down,readout,up);
  return{root,update:value=>{readout.textContent=`${Math.round(clampThrottle(value)*100)}%`;}};
}

/** Desktop wheel binding shares the same signed step contract as the touch controls. */
export function bindThrottleWheel(root:HTMLElement,onStep:(direction:number)=>void,signal?:AbortSignal):void{
  root.addEventListener('wheel',event=>{event.preventDefault();onStep(event.deltaY<0?1:-1);},signal?{signal,passive:false}:{passive:false});
}
