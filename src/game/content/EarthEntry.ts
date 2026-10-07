import type {SpriteRef} from './types';

export const EARTH_ENTRY_BACKGROUND:SpriteRef={category:'backgrounds',id:'earth_entry_globe_v1'};
export const EARTH_ENTRY_FALLBACK:SpriteRef={category:'backgrounds',id:'earth_orbit_neon_v2'};
export const EARTH_ENTRY_DURATION=7;
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
const smooth=(n:number)=>{const t=clamp(n);return t*t*(3-2*t);};
/** Coordinates are normalized so resizing never restarts or clips the flight. */
export function earthEntryPose(elapsed:number,fromX:number,fromY:number){
  const flight=smooth((elapsed-1.6)/4.2);
  return {
    x:fromX+(.5-fromX)*flight,y:fromY+(.22-fromY)*flight,
    shipScale:1-.98*flight,shipAlpha:1-smooth((elapsed-4.7)/1.1),
    planetAlpha:smooth((elapsed-.8)/1.5),planetZoom:1+Math.max(0,elapsed)*.24,
    fade:smooth((elapsed-6)/1),complete:elapsed>=EARTH_ENTRY_DURATION,
  };
}
