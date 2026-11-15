import {DECK,roomAt,type DeckRoom} from './BoardingLayout';
import type {BoardingRoom} from './BoardingQuest';

/** Concept-scale capital-ship hangar for isolated exploration ONLY.
 * Five 12 m berth columns by four 18 m berth rows fit within this footprint.
 * The ship hull and canonical campaign landing/deck layout are NOT changed. */
export const CAPITAL_HANGAR:DeckRoom={
  ...DECK.find(room=>room.id==='hangar')!,
  title:'01 · CAPITAL HANGAR',
  x:0,z:-65,width:74,depth:92,
};
export const REVIEW_DECK:readonly DeckRoom[]=DECK.map(room=>room.id==='hangar'?CAPITAL_HANGAR:room);
export const reviewDeckRoom=(id:BoardingRoom):DeckRoom=>id==='hangar'?CAPITAL_HANGAR:DECK.find(room=>room.id===id)!;

/** Prefer the adjacent canonical room at a shared door boundary. */
export function reviewRoomAt(x:number,z:number):DeckRoom|undefined {
  const original=roomAt(x,z);
  if(original&&original.id!=='hangar')return original;
  if(Math.abs(x-CAPITAL_HANGAR.x)<=CAPITAL_HANGAR.width/2+.001 &&
     Math.abs(z-CAPITAL_HANGAR.z)<=CAPITAL_HANGAR.depth/2+.001)return CAPITAL_HANGAR;
  return original;
}
