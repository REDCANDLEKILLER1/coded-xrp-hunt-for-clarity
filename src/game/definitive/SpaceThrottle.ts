export const MIN_THROTTLE=.25;
export const MAX_THROTTLE=2.2;
export const THROTTLE_STEP=.1;

export const clampThrottle=(value:number):number=>Math.max(MIN_THROTTLE,Math.min(MAX_THROTTLE,Number.isFinite(value)?value:1));

export const stepThrottle=(value:number,direction:number):number=>
  clampThrottle(Math.round((value+Math.sign(direction)*THROTTLE_STEP)*10)/10);

export const commandedSpeed=(cruise:number,throttle:number,braking:boolean,boosting:boolean):number=>
  cruise*(braking?.25:boosting?MAX_THROTTLE:clampThrottle(throttle));
