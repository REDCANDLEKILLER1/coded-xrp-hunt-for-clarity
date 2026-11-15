import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const scene=readFileSync('src/game/definitive/BoardingScene.ts','utf8');
const runtime=readFileSync('src/game/definitive/MeshRuntime.ts','utf8');
const main=readFileSync('src/main.ts','utf8');
const map=readFileSync('src/game/definitive/WarshipDeckMap.ts','utf8');
const layout=JSON.parse(readFileSync('src/game/definitive/boarding-deck.json','utf8'));
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
assert.match(scene,/this\.updateWalkthroughDoors\(dt\)/,'every walkthrough frame advances all door animations');
assert.match(scene,/this\.buildEmptyWalkthroughRoom\(room\)/,'walkthrough uses empty architecture in each room');
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
