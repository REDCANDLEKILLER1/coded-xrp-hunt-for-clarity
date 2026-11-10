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
assert.match(scene,/for\(const \{mesh\} of this\.doorPanels\)mesh\.visible=false/,'quest door blockers hidden in walkthrough');
assert.match(scene,/if\(room\.id!==this\.room\)\{this\.room=room\.id;this\.walkthroughVisited\.add\(room\.id\);\}/,'room position changes only in local walkthrough state');
assert.match(map,/if\(this\.host\.walkthrough\)return 'discovered'/,'map previews all sectors, not locked progression');
const block=scene.slice(scene.indexOf('  private updateWalkthrough('),scene.indexOf('  private paintWalkthroughHUD('));
for(const prohibited of ['this.enemy(', 'this.updateEnemies(', 'this.updateBolts(', 'this.host.quest.enter(', 'this.host.quest.complete(', 'this.host.quest.clear(', 'save.update(', 'save.claim(']){
  assert.ok(!block.includes(prohibited),'no gameplay mutation in walkthrough: '+prohibited);
}
console.log('warship-walkthrough: 8 rooms connected, no combat/quest mutation, drag walk and map isolation OK');
