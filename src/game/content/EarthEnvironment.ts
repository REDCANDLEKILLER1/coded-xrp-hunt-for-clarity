import type {SpriteRef} from './types';

export const EARTH_BACKDROPS:Record<string,SpriteRef>={
  deep_space_lane:{category:'backgrounds',id:'deep_space_lane'},
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

export const SPACE_PATH:SpriteRef[]=[
  {category:'backgrounds',id:'space_path_01'},
  {category:'backgrounds',id:'space_path_02'},
  {category:'backgrounds',id:'space_path_03'},
  {category:'backgrounds',id:'space_path_04'},
  {category:'backgrounds',id:'space_path_05'},
  {category:'backgrounds',id:'space_path_06'},
  {category:'backgrounds',id:'space_path_07'},
  {category:'backgrounds',id:'space_path_08'},
  {category:'backgrounds',id:'space_path_09'},
  {category:'backgrounds',id:'space_path_10'},
];

/** New tiles enter above; the camera proceeds 01 through 10 then 01. */
export function spaceTiles(travel:number,height:number,tileHeight:number){
  return groundTiles(travel,height,tileHeight).map(tile=>({...tile,mirror:false,index:((-tile.id%SPACE_PATH.length)+SPACE_PATH.length)%SPACE_PATH.length}));
}
