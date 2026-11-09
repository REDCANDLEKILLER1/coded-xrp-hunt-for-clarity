import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const source=readFileSync('src/game/definitive/DeckMapGeometry.ts','utf8');
const javascript=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const geometry=await import('data:text/javascript;base64,'+Buffer.from(javascript).toString('base64'));
const layout=JSON.parse(readFileSync('src/game/definitive/boarding-deck.json','utf8'));
const rooms=layout.rooms;
const {deckMapBounds,projectDeckPoint,unprojectDeckPoint,pickDeckRoom,clampDeckZoom,clampDeckPan}=geometry;
assert.equal(rooms.length,8,'canonical deck count');
assert.equal(layout.doors.length,7,'canonical door count');
const bounds=deckMapBounds(rooms);
assert.ok(bounds.minX<=-25&&bounds.maxX>=25,'side wings mapped');
assert.ok(bounds.minZ<-37&&bounds.maxZ>45,'arrival bay and bridge mapped');
const view={width:320,height:460,zoom:1,panX:0,panY:0};
for(const room of rooms){
  const point=projectDeckPoint(bounds,view,room.x,room.z);
  assert.ok(point.x>0&&point.x<view.width&&point.y>0&&point.y<view.height,room.id+' visible on phone');
  const inverted=unprojectDeckPoint(bounds,view,point.x,point.y);
  assert.ok(Math.abs(inverted.x-room.x)<1e-8&&Math.abs(inverted.z-room.z)<1e-8,room.id+' coordinates round-trip');
  assert.equal(pickDeckRoom(rooms,inverted.x,inverted.z),room.id,room.id+' hit-test');
}
const zoomView={width:400,height:300,zoom:2.3,panX:42,panY:-36};
for(const room of rooms){
  const point=projectDeckPoint(bounds,zoomView,room.x,room.z);
  const round=unprojectDeckPoint(bounds,zoomView,point.x,point.y);
  assert.ok(Math.abs(round.x-room.x)<1e-8&&Math.abs(round.z-room.z)<1e-8,'zoomed projection round-trip');
}
assert.equal(clampDeckZoom(0),1);
assert.equal(clampDeckZoom(99),3.2);
assert.equal(clampDeckZoom(Number.NaN),1);
assert.ok(clampDeckPan(999,400,1)<=14,'pan is bounded when fitted');
assert.equal(pickDeckRoom(rooms,100,100),null,'empty-space selection');
for(const d of layout.doors)assert.ok(rooms.some(r=>r.id===d.a)&&rooms.some(r=>r.id===d.b),'door references real rooms');
const overlay=readFileSync('src/game/definitive/WarshipDeckMap.ts','utf8');
const scene=readFileSync('src/game/definitive/BoardingScene.ts','utf8');
assert.ok(overlay.includes('visitedRooms.includes'), 'fog uses actual visitedRooms flags');
assert.ok(overlay.includes('quest.lockReason'), 'door visibility uses quest lock state');
assert.ok(overlay.includes('quest.isClear'), 'completed rooms are shown as secured');
assert.ok(overlay.includes('pinchDistance'), 'pinch touch handled');
assert.ok(overlay.includes('this.host.position()'), 'live player dot');
assert.ok(overlay.includes('this.panel.setAttribute(\'aria-modal\',\'true\')'), 'modal is labelled');
assert.ok(scene.includes("button('MAP'"), 'map HUD access');
assert.ok(scene.includes('this.deckMap.isOpen||this.paused'), 'simulation held while reading map');
assert.ok(scene.includes('this.deckMap.dispose()'), 'modal cleans up with scene');
assert.ok(!overlay.includes('quest.enter(')&&!overlay.includes('save.update(')&&!overlay.includes('save.claim('),'overlay must not mutate story progress');
console.log('deck-map: eight canonical rooms, seven doors, touch geometry, progression boundaries OK');
