import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {build} from 'esbuild';
const bundle=await build({stdin:{contents:"export * from './src/game/definitive/CapitalTactics';export * from './src/game/definitive/CapitalEncounter';export * from './src/game/definitive/SpaceInput';export * from './src/game/definitive/CampaignSave';export * from './src/game/definitive/SpaceProgress';export * from 'three';export {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';",resolveDir:process.cwd()},bundle:true,write:false,format:'esm',logLevel:'silent'});
const m=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
globalThis.self=globalThis;globalThis.createImageBitmap=async()=>({width:1024,height:1024,close(){}});
const raw=readFileSync('public/assets/models/capital_blockade.glb'),doc=JSON.parse(raw.subarray(20,20+raw.readUInt32LE(12)));
assert.ok(raw.length<800000,'large silhouette stays inexpensive');let tris=0;for(const mesh of doc.meshes)for(const p of mesh.primitives)tris+=doc.accessors[p.indices].count/3;assert.ok(tris<22000,'capital hull geometry budget');
const gltf=await new m.GLTFLoader().parseAsync(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.length),'');
const size=new m.Box3().setFromObject(gltf.scene).getSize(new m.Vector3());assert.ok(size.z>=710&&size.z<740,'actual 720 m vessel');
const create=()=>new m.CapitalEncounter(gltf.scene.clone(true),'TEST BLOCKADE',2);
const cap=create();assert.equal(cap.hit(cap.point('reactor').add(new m.Vector3(0,200,0)),cap.point('reactor'),1000),'armor','shielded reactor absorbs an actual ray');assert.equal(cap.tactics.hp.reactor,m.CAPITAL_HP.reactor);
for(const key of ['shield_port','shield_starboard']){
 const point=cap.point(key);assert.equal(cap.hit(point.clone().add(new m.Vector3(0,300,0)),point,22),'component','emitter top remains closed after optimization');for(let i=0;i<20;i++)cap.hit(point.clone().add(new m.Vector3(0,0,300)),point,22);
 assert.equal(cap.tactics.hp[key],0,'visible physical emitter can be destroyed');
}
assert.ok(cap.tactics.exposed);let shot=cap.hit(cap.point('reactor').add(new m.Vector3(0,200,0)),cap.point('reactor'),1000);assert.equal(shot,'component');assert.ok(cap.tactics.defeated);
const restored=new m.CapitalTactics(2,cap.tactics.snapshot());assert.ok(restored.defeated);assert.equal(new m.CapitalTactics(1,cap.tactics.snapshot()).defeated,false,'damage cannot leak into another patrol');
const invalid=cap.tactics.snapshot();invalid.hp.reactor=NaN;assert.equal(m.validCapitalCheckpoint(invalid,2),false);
const live=create(),player=new m.Vector3(1100,120,900),still=player.clone(),zero=new m.Vector3();
for(let i=0;i<14;i++)live.update(.1,player,still,zero);assert.equal(live.lanes.length,3);assert.ok(live.attackOrigin.x>0,'opposite broadside cannot fire through its own hull');const locked=live.lanes.map(l=>l.to.toArray());
for(let i=0;i<12;i++)assert.equal(live.update(.1,player,still,zero),false,'no damage during tell');assert.deepEqual(live.lanes.map(l=>l.to.toArray()),locked);
assert.equal(live.update(0,player,still,zero),false);let hits=0;for(let i=0;i<15;i++)hits+=Number(live.update(.1,player,still,zero));assert.equal(hits,1,'standing in live broadside hurts once per volley');
const dodged=create();for(let i=0;i<14;i++)dodged.update(.1,player,still,zero);const clear=player.clone().add(new m.Vector3(0,450,0));let dodgedHits=0;for(let i=0;i<26;i++)dodgedHits+=Number(dodged.update(.1,clear,clear,zero));assert.equal(dodgedHits,0,'changing height avoids committed fire');
const silenced=create();for(let i=0;i<14;i++)silenced.update(.1,player,still,zero);silenced.tactics.damage('battery_port',1000);silenced.tactics.damage('battery_starboard',1000);for(let i=0;i<150;i++)assert.equal(silenced.update(.1,player,still,zero),false);assert.equal(silenced.lanes.length,0);
const shield={fore:25,aft:90};for(let i=0;i<50;i++)m.routeShields(shield,'fore',100,.1);assert.ok(Math.abs(shield.fore+shield.aft-115)<1e-9);assert.ok(shield.fore>80&&shield.aft<35);const snapshot={...shield};m.routeShields(shield,'fore',100,NaN);assert.deepEqual(shield,snapshot);
const input=new m.SpaceInput();input.down(1,10,10,'steer',1);input.move(1,70,0,100);input.down(2,100,100,'guns',1);input.down(3,200,100,'brake',1);assert.ok(input.firing&&input.braking&&input.x>.5);input.up(3);assert.ok(input.firing&&!input.braking&&input.x>.5);input.clear();assert.equal(input.firing||input.braking,false);
const data=new Map();let fail=false;const storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>{if(fail)throw Error('full');data.set(k,v);}};let save=new m.CampaignSave(storage,'test:capital');m.prepareSpaceReview(save);m.startTransit(save);m.finishDeparture(save,save.snapshot.transit);save.update(d=>{d.transit.wave=2;});let state=save.snapshot.transit;assert.equal(m.clearSpaceWave(save,state).ok,false);state.blockade=cap.tactics.snapshot();fail=true;assert.equal(m.checkpointTransit(save,state).ok,false);assert.equal(save.snapshot.transit.blockade,undefined);fail=false;assert.ok(m.checkpointTransit(save,state).ok);save=new m.CampaignSave(storage,'test:capital');assert.ok(new m.CapitalTactics(2,save.snapshot.transit.blockade).defeated);assert.ok(m.clearSpaceWave(save,save.snapshot.transit).ok);assert.equal(save.snapshot.transit.blockade,undefined);assert.equal(save.snapshot.credits,100);
console.log(`capital-tactics: OK — ${size.z.toFixed(0)} m, ${tris} triangles, ${raw.length} bytes; actual component rays, reactor lock, three committed lanes, dodge/silence strategies, conserved shield charge, touch ownership and atomic saved defeat.`);
