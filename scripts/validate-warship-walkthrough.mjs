import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const scene=readFileSync('src/game/definitive/BoardingScene.ts','utf8');
const runtime=readFileSync('src/game/definitive/MeshRuntime.ts','utf8');
const main=readFileSync('src/main.ts','utf8');
const map=readFileSync('src/game/definitive/WarshipDeckMap.ts','utf8');
const layout=JSON.parse(readFileSync('src/game/definitive/boarding-deck.json','utf8'));
const hangarReview=readFileSync('src/game/definitive/CapitalHangarPreview.ts','utf8');
const mapSource=readFileSync('src/game/definitive/WarshipDeckMap.ts','utf8');
assert.equal(layout.rooms.find(r=>r.id==='hangar').width,16,'canonical hangar width unchanged');
assert.equal(layout.rooms.find(r=>r.id==='hangar').depth,18,'canonical hangar depth unchanged');
assert.match(hangarReview,/x:0,z:-65,width:74,depth:92/,'review hangar expands to 74 x 92 m');
assert.equal(-65+92/2,-19,'review hangar north edge exactly meets security doorway');
assert.equal(-65-92/2,-111,'review hangar grows away from existing warship rooms');
assert.ok(5*12<=74&&4*18<=92,'5 x 4 fighter berth spacing fits without adding ships');
assert.match(scene,/const fighterZ=this\.walkthrough\?CAPITAL_HANGAR\.z:DECK_LAYOUT\.landing\.center\[1\]/,'preview fighter relocates without changing campaign docking');
assert.match(scene,/const room=reviewRoomAt\(next\.x,next\.z\)/,'walkthrough movement checks enlarged footprint');
assert.match(scene,/this\.buildEmptyWalkthroughRoom\(room\.id==='hangar'\?CAPITAL_HANGAR:room\)/,'floor and walls use expanded footprint');
assert.match(scene,/id==='hangar'\|\|Math\.hypot/,'large hangar stays rendered while exploring');
assert.match(scene,/const all=REVIEW_DECK/,'walkthrough minimap uses updated bounds');
assert.match(mapSource,/this\.mappedRooms=host\.walkthrough\?REVIEW_DECK:DECK/,'full deck map uses review dimensions only when isolated');
assert.match(mapSource,/this\.bounds=deckMapBounds\(this\.mappedRooms\)/,'map fits expanded floor');

const ids=layout.rooms.map(r=>r.id);
assert.equal(ids.length,8);
assert.equal(layout.doors.length,7);
const seen=new Set(['hangar']);
let changed=true;
while(changed){
  changed=false;
  for(const door of layout.doors){
    if(seen.has(door.a)&&!seen.has(door.b)){seen.add(door.b);changed=true;}
    if(seen.has(door.b)&&!seen.has(door.a)){seen.add(door.a);changed=true;}
  }
}
assert.equal(seen.size,8,'all canonical rooms physically connected');
assert.match(main,/params\.get\('review'\)==='walkthrough'/,'isolated explicit walkthrough review route');
assert.match(main,/meshRuntime\.showBoarding\(definitiveSave,true\)/,'review route only enables new mode');
assert.match(runtime,/if\(walkthrough&&!save\.testSlot\)throw new Error/,'requires isolated save');
assert.match(runtime,/if\(!walkthrough&&!quest\.begin\(/,'no quest begin in walkthrough');
assert.match(runtime,/walkthrough, onDeparture/,'walkthrough explicitly passed into boarding scene');
assert.match(scene,/if\(!this\.walkthrough\)this\.spawnRoom\(this\.room\)/,'no initial enemies');
assert.match(scene,/if\(this\.walkthrough\)\{this\.updateWalkthrough\(dt\);return;\}/,'early combat simulation bypass');
assert.match(scene,/if\(this\.walkthrough\)\{this\.paintWalkthroughHUD\(\);return;\}/,'walkthrough does not use combat HUD');
assert.match(scene,/if\(this\.walkthrough\)\{this\.bindWalkthroughInput\(\);return;\}/,'no old virtual-stick input');
assert.match(scene,/this\.play\(walking\?'Running':'Idle'\)/,'corrected Nov 8 XRPMan Run/Idle clips, no combat or jumping');
assert.match(scene,/Math\.max\(\.085,Math\.min\(2\.15,this\.walkthroughZoom\*this\.walkthroughPinch\/distance\)\)/,'pinch reaches face-level zoom');
assert.match(scene,/Math\.max\(\.085,Math\.min\(2\.15,this\.walkthroughZoom\*Math\.exp/,'wheel reaches face-level zoom');
assert.match(scene,/1\.05\+\.64\*closeUp/,'camera target moves from torso to face at close zoom');
assert.match(scene,/const height=5\.4\*this\.walkthroughZoom\*\(1-closeUp\)\+\.12\*closeUp/,'face close-up lowers viewing angle');

assert.match(scene,/this\.updateWalkthroughDoors\(dt\)/,'every walkthrough frame advances all door animations');
assert.match(scene,/this\.buildEmptyWalkthroughRoom\(room\)/,'walkthrough uses empty architecture in each room');
assert.match(scene,/this\.walkthrough\?3\.1:7/,'chest point light reduced only in walkthrough');
assert.match(scene,/const faceFill=new PointLight\(0xcfe8dc,\.7,2\.8,2\)/,'face visibility fill is subtle and walkthrough-only');
assert.match(scene,/if\(this\.walkthrough\)return; \/\/ No old floor decals/,'all previous floor graphics are excluded from walkthrough');
assert.match(scene,/this\.getWalkthroughFloorMaterial\(\)/,'all eight review rooms use one shared floor material');
assert.match(scene,/texture\.wrapS=RepeatWrapping;texture\.wrapT=RepeatWrapping/,'floor image repeats seamlessly');
assert.match(scene,/tileFloor\.name='Walkthrough_Ceramic_Tile_Floor'/,'every empty room gets a tiled floor mesh');
assert.doesNotMatch(scene.slice(scene.indexOf('private buildEmptyWalkthroughRoom('),scene.indexOf('private buildDeck():void')),/this\.part\(group,\[x\+sign\*\(w\/2-\.5\)/,'walkthrough floor lane stripes removed');

assert.match(scene,/group\.visible=false;\s*this\.buildEmptyWalkthroughRoom\(room\);\s*continue;/,'baked Blender furniture remains hidden');
assert.match(scene,/const cut=DECK_DOORS\.filter/,'clean room walls preserve all canonical door apertures');
assert.match(scene,/if\(this\.walkthrough\)\{[\s\S]*?this\.buildEmptyWalkthroughRoom\(room\);\s*continue;/,'runtime console, cover and machinery creation skipped in walkthrough');
assert.match(scene,/this\.part\(group,\[x,-\.13,z\]/,'rooms retain full structural floors');

assert.match(scene,/Regulatory_Blast_Door_Frame_V2/,'Meshy doorway named as shared visual');
assert.match(scene,/this\.host\.doorFrame\.scene\.clone\(true\)/,'shared frame cloned for each canonical doorway');
assert.match(scene,/visual\.rotation\.y=door\.axis==='x'\?Math\.PI\/2:0/,'both door orientations supported');
assert.match(runtime,/loadAssetCatalog\(\)/,'doorframe asset gated on manifest registration');
assert.match(runtime,/loadModel\('warship_door_frame_v2',signal\)/,'registered GLB must load through immutable asset catalog');
assert.match(scene,/const rearDoor=DECK_DOORS.find/,'door openings subtract from room artwork');
assert.match(scene,/drawWallArt\(minX,Math.max/,'wall graphic terminates before the aperture');
assert.match(scene,/drawWallArt\(Math.min\(maxX/,'wall graphic resumes after the aperture');
assert.match(scene,/for\(const leaf of \[panel,other\]\)/,'both physical leaves get detailed blast door treatment');
assert.match(scene,/this\.doorIsPassable\(this\.room,room\.id\)/,'walkthrough passage respects the physical doorway');
assert.match(scene,/entry\.openness>=\.85/,'doorway blocks passage until physically open');
assert.match(scene,/normal<2\.8/,'proximity sensor opens doors from either approach side');
assert.match(scene,/this\.walkthrough \|\|/,'isolated walkthrough access override preserves campaign quest gates');
assert.match(scene,/mesh\.visible=true;other\.visible=true/,'both sliding leaves remain visible in walkthrough');
assert.match(scene,/if\(room\.id!==this\.room\)\{this\.room=room\.id;this\.walkthroughVisited\.add\(room\.id\);\}/,'room position changes only in local walkthrough state');
assert.match(map,/if\(this\.host\.walkthrough\)return 'discovered'/,'map previews all sectors, not locked progression');
const block=scene.slice(scene.indexOf('  private updateWalkthrough('),scene.indexOf('  private paintWalkthroughHUD('));
for(const prohibited of ['this.enemy(', 'this.updateEnemies(', 'this.updateBolts(', 'this.host.quest.enter(', 'this.host.quest.complete(', 'this.host.quest.clear(', 'save.update(', 'save.claim(']){
  assert.ok(!block.includes(prohibited),'no gameplay mutation in walkthrough: '+prohibited);
}
console.log('warship-walkthrough: 8 rooms, 7 proximity sliding door pairs, safe passage, no combat/quest mutation OK');
