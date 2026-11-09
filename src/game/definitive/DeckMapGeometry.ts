/** Deterministic projection of the canonical boarding-deck JSON into a mobile map. */
export interface DeckMapRoomRect {id:string;x:number;z:number;width:number;depth:number}
export interface DeckMapBounds {minX:number;maxX:number;minZ:number;maxZ:number}
export interface DeckMapView {width:number;height:number;zoom:number;panX:number;panY:number}
export const MAP_MIN_ZOOM=1;
export const MAP_MAX_ZOOM=3.2;

export function deckMapBounds(rooms:readonly DeckMapRoomRect[],padding=3):DeckMapBounds {
  if(!rooms.length)throw new Error('Cannot project an empty deck');
  return {
    minX:Math.min(...rooms.map(r=>r.x-r.width/2))-padding,
    maxX:Math.max(...rooms.map(r=>r.x+r.width/2))+padding,
    minZ:Math.min(...rooms.map(r=>r.z-r.depth/2))-padding,
    maxZ:Math.max(...rooms.map(r=>r.z+r.depth/2))+padding
  };
}

export function clampDeckZoom(value:number):number {
  return Number.isFinite(value)?Math.max(MAP_MIN_ZOOM,Math.min(MAP_MAX_ZOOM,value)):MAP_MIN_ZOOM;
}

export function projectDeckPoint(bounds:DeckMapBounds,view:DeckMapView,x:number,z:number):{x:number;y:number} {
  const worldWidth=bounds.maxX-bounds.minX,worldDepth=bounds.maxZ-bounds.minZ;
  const baseScale=Math.min((view.width-22)/Math.max(.1,worldWidth),(view.height-22)/Math.max(.1,worldDepth));
  const scale=baseScale*clampDeckZoom(view.zoom);
  const middleX=(bounds.minX+bounds.maxX)/2,middleZ=(bounds.minZ+bounds.maxZ)/2;
  return {x:view.width/2+(x-middleX)*scale+view.panX,y:view.height/2-(z-middleZ)*scale+view.panY};
}

export function unprojectDeckPoint(bounds:DeckMapBounds,view:DeckMapView,x:number,y:number):{x:number;z:number} {
  const worldWidth=bounds.maxX-bounds.minX,worldDepth=bounds.maxZ-bounds.minZ;
  const baseScale=Math.min((view.width-22)/Math.max(.1,worldWidth),(view.height-22)/Math.max(.1,worldDepth));
  const scale=baseScale*clampDeckZoom(view.zoom);
  return {x:(x-view.width/2-view.panX)/scale+(bounds.minX+bounds.maxX)/2,
    z:(view.height/2+view.panY-y)/scale+(bounds.minZ+bounds.maxZ)/2};
}

export function pickDeckRoom(rooms:readonly DeckMapRoomRect[],x:number,z:number):string|null {
  const found=rooms.find(room=>Math.abs(x-room.x)<=room.width/2&&Math.abs(z-room.z)<=room.depth/2);
  return found?.id??null;
}

export function clampDeckPan(value:number,extent:number,zoom:number):number {
  const max=Math.max(0,(clampDeckZoom(zoom)-1)*extent/2+14);
  return Number.isFinite(value)?Math.max(-max,Math.min(max,value)):0;
}
