import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import {Box3,DoubleSide,Euler,Quaternion,Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const load=async path=>{const out=await build({entryPoints:[path],bundle:true,write:false,format:'esm',logLevel:'silent'});return import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);};
const {capitalVolley,flightHull,HullSweep,turnFlight}=await load('src/game/definitive/SpaceGeometry.ts');
const {SpaceInput}=await load('src/game/definitive/SpaceInput.ts');
const {CampaignSave,parseDefinitiveSave}=await load('src/game/definitive/CampaignSave.ts');
const {prepareSpaceReview,startTransit,checkpointTransit,finishDeparture,clearSpaceWave,arriveMars,SPACE_MODELS,SPACE_WAVES}=await load('src/game/definitive/SpaceProgress.ts');
globalThis.self=globalThis;globalThis.createImageBitmap=async()=>({width:1024,height:1024,close(){}});
const catalog=JSON.parse(readFileSync('public/assets/manifest.json','utf8'));let total=0;const parsed=new Map();
for(const id of SPACE_MODELS){
  const asset=catalog.models[id];assert.ok(asset&&asset.scenes.includes('space'),id);const bytes=readFileSync(`public${asset.src}`);total+=bytes.length;
  assert.equal(asset.bytes,bytes.length);assert.equal(asset.sha256,createHash('sha256').update(bytes).digest('hex'));
  const doc=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));assert.ok(doc.images.every(i=>Number.isInteger(i.bufferView)&&!i.uri));
  const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length),'');
  gltf.scene.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])m.side=DoubleSide;});parsed.set(id,gltf.scene);
  if(id.startsWith('space_'))for(const node of ['Enemy_Origin','Engine_L','Engine_R','Muzzle_L','Muzzle_R'])assert.ok(gltf.scene.getObjectByName(node),`${id} ${node}`);
}
assert.ok(total+900000<12*1024*1024,'space bundle fits reserved renderer plus models');
const originalSize=new Box3().setFromObject(parsed.get('regulatory_warship'),true).getSize(new Vector3());
const ship=flightHull(parsed.get('regulatory_warship')),hull=new HullSweep(ship),size=new Box3().setFromObject(ship,true).getSize(new Vector3());
assert.ok(size.distanceTo(originalSize)<.001&&Math.abs(size.z-120)<.01,`single metre adapter preserves actual v03 dimensions: ${size.toArray()}`);
console.log(`v03 precise bounds: ${size.toArray().map(n=>n.toFixed(3)).join(' x ')} metres (X,Y,Z)`);
let orientations=0;
for(const yaw of [-Math.PI,-1.1,0,1.1,Math.PI])for(const pitch of [-1.56,-.6,0,.6,1.56])for(const roll of [-1.2,0,1.2]){
  ship.position.set(1000,-260,590);ship.quaternion.setFromEuler(new Euler(pitch,yaw,roll));ship.updateMatrixWorld(true);
  for(const range of [0,240,800,2000]){
    const volley=capitalVolley(ship,range);assert.equal(new Set(volley.map(v=>v.origin.toArray().join(','))).size,4);
    for(const shot of volley){const end=shot.origin.clone().addScaledVector(shot.direction,shot.origin.distanceTo(shot.target));assert.ok(end.distanceTo(shot.target)<1e-6);assert.equal(hull.hit(shot.origin.clone().addScaledVector(shot.direction,.15),shot.target,.18),false,`own hull clear: ${shot.name}, ${pitch}, ${yaw}, ${roll}, ${range}`);}
  }
  const a=ship.localToWorld(new Vector3(0,100,0)),b=ship.localToWorld(new Vector3(0,-100,0));assert.ok(hull.hit(a,b,1),'fast swept bolt crosses transformed actual hull');
  const c=ship.localToWorld(new Vector3(90,100,0)),d=ship.localToWorld(new Vector3(90,-100,0));assert.equal(hull.hit(c,d,1),false,'outside hull misses');orientations++;
}
const orientation=new Quaternion();turnFlight(orientation,1,0,0,.1);assert.ok(new Vector3(0,0,-1).applyQuaternion(orientation).x>0,'drag right turns right');orientation.identity();turnFlight(orientation,0,-1,0,.1);assert.ok(new Vector3(0,0,-1).applyQuaternion(orientation).y>0,'drag up pitches up');
for(let i=0;i<100000;i++)turnFlight(orientation,.8,.7,.3,.016);assert.ok(Math.abs(orientation.length()-1)<1e-9,'sustained quaternion flight remains normalized');
const scout=new Box3().setFromObject(parsed.get('space_fast_scout')).getSize(new Vector3()),whale=new Box3().setFromObject(parsed.get('space_whale_scout')).getSize(new Vector3());assert.ok(whale.x>scout.x*1.5&&whale.z>scout.z*1.15,'Whale has distinct broad heavy geometry');
const input=new SpaceInput();input.down(1,50,400,'steer',1);input.move(1,100,350,100);input.down(2,300,700,'guns',2);assert.ok(input.firing&&input.x>.4&&input.y<-.4);input.up(2);assert.equal(input.firing,false);assert.ok(input.x>.4,'releasing fire retains steering');input.down(3,300,700,'guns',3);input.up(1);assert.ok(input.firing&&input.x===0,'releasing steering retains weapon finger');input.clear();assert.equal(input.firing,false);input.down(4,10,10,'steer',4);input.up(4);input.down(5,10,10,'steer',4.2);assert.ok(input.firing,'double tap hold');input.up(5);assert.equal(input.firing,false);input.key('Space',true);input.key('KeyD',true);assert.ok(input.firing&&input.x===1);input.clear();assert.equal(input.firing,false);assert.equal(input.x,0);
const data=new Map();let fail=false;const storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>{if(fail)throw Error('quota');data.set(k,v);}};
assert.equal(prepareSpaceReview(new CampaignSave(storage)).ok,false,'cannot grant campaign ownership');
let save=new CampaignSave(storage,'test:space');assert.equal(startTransit(save).ok,false);assert.ok(prepareSpaceReview(save).ok);assert.ok(startTransit(save).ok);let state=save.snapshot.transit;
assert.equal(arriveMars(save,state).ok,false,'no early portal skip');fail=true;assert.equal(finishDeparture(save,state).ok,false);assert.equal(save.snapshot.transit.phase,'departure');fail=false;assert.ok(finishDeparture(save,state).ok);state=save.snapshot.transit;
for(let wave=0;wave<4;wave++){assert.ok(SPACE_WAVES[wave].enemies.length<=3);state.wave=wave;assert.ok(clearSpaceWave(save,state).ok);assert.equal(clearSpaceWave(save,state).ok,false,'reward receipt prevents duplicate salvage');}
state=save.snapshot.transit;assert.equal(arriveMars(save,state).ok,false,'cannot arrive remotely after patrol clear');state.position=[0,0,-23960];state.orientation=[0,0,0,1];assert.equal(arriveMars(save,state).ok,false,'portal briefing precedes entry');save.update(d=>{d.dialogueSeen.push('story.earth.portal');});assert.equal(arriveMars(save,{...state,orientation:[0,1,0,0]}).ok,false,'portal entry preserves forward heading');assert.ok(checkpointTransit(save,state).ok);fail=true;assert.equal(arriveMars(save,state).ok,false);assert.equal(save.snapshot.location.world,'ledger_prime');fail=false;assert.ok(arriveMars(save,state).ok);assert.equal(arriveMars(save,state).ok,false);save=new CampaignSave(storage,'test:space');assert.equal(save.snapshot.location.world,'mars');assert.ok(save.snapshot.earth.discoveredPlanets.includes('mars'));assert.equal(save.snapshot.credits,400);assert.deepEqual(save.snapshot.transit.orientation,state.orientation);assert.equal(save.snapshot.fighterShipKey,'player');
const invalid=save.snapshot;invalid.transit.position[0]=Infinity;assert.equal(parseDefinitiveSave(JSON.stringify(invalid)),null);const legacy=save.snapshot;delete legacy.transit;assert.equal(parseDefinitiveSave(JSON.stringify(legacy)).transit,null,'earlier definitive saves migrate without losing inventory');
assert.ok(!data.has('coded-xrp-definitive-v1:campaign'));
console.log(`mesh-space: OK — ${orientations} orientations, 1,200 four-muzzle paths, rotated hull sweeps, pointer ownership/cancel, distinct enemy models, ${total} bytes, atomic patrol/portal rewards and reload.`);
