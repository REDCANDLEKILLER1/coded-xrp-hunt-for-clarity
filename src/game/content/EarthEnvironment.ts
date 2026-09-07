import type {SpriteRef} from './types';

export const EARTH_BACKDROPS:Record<string,SpriteRef>={
  deep_space_lane:{category:'backgrounds',id:'earth_orbit_neon_v2'},
  ledger_city:{category:'backgrounds',id:'ledger_ground_neon_v2'},
  regulatory_outpost:{category:'backgrounds',id:'ledger_ground_neon_v2'},
};

/** Alternate the direction of a word-free ground plate so adjoining edges
 * match. World tile IDs remain stable when the scrolling offset wraps. */
export function groundTiles(travel:number,height:number,tileHeight:number):{id:number;y:number;mirror:boolean}[]{
  const base=Math.floor(travel/tileHeight),offset=travel-base*tileHeight;
  return Array.from({length:Math.ceil(height/tileHeight)+2},(_,i)=>{
    const row=i-1,id=row-base;return{id,y:row*tileHeight+offset,mirror:Math.abs(id%2)===1};
  });
}
