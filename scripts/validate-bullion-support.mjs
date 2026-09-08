import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {build} from 'esbuild';

async function load(mutation){
 const plugins=mutation?[{name:'support-failure-control',setup(b){b.onLoad({filter:/[\\/](BomberLanes|FreightScanner)\.ts$/},args=>({contents:readFileSync(args.path,'utf8').replace(mutation[0],mutation[1]),loader:'ts'}));}}]:[];
 const result=await build({stdin:{contents:"export * from './src/game/definitive/BomberLanes';export * from './src/game/definitive/FreightScanner';export * from './src/game/definitive/SpaceRoutes';export * from './src/game/definitive/BullionLanding';export * from './src/game/definitive/CampaignSave';export {Vector3,Quaternion,Euler} from 'three';",resolveDir:process.cwd()},bundle:true,write:false,format:'esm',plugins,logLevel:'silent'});
 return import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
}
function hazards(m){
 let orientations=0;
 for(const yaw of [-2.4,-1.2,0,1.2,2.4])for(const pitch of [-.8,0,.8])for(const roll of [-1.5,0,1.5]){
  const pos=new m.Vector3(320,-75,-4300),q=new m.Quaternion().setFromEuler(new m.Euler(pitch,yaw,roll)),before=pos.clone(),lanes=m.commitBomberLanes(pos,q,420);
  assert.ok(Math.abs(lanes[0].distanceTo(lanes[1])-110)<1e-8);assert.ok(Math.abs(lanes[0].distanceTo(lanes[2])-220)<1e-8);
  assert.ok(lanes[1].clone().sub(before).normalize().dot(new m.Vector3(0,0,-1).applyQuaternion(q))>.999999);
  assert.ok(Math.abs(lanes[1].distanceTo(before)-1050)<1e-8);
  const saved=lanes.map(v=>v.clone());pos.set(900,500,400);q.set(0,0,0,1);assert.deepEqual(lanes,saved,'a committed warning cannot home after steering');
  const origins=[new m.Vector3(-17,3,10),new m.Vector3(17,3,10)],shots=m.bomberVolley(origins,lanes);assert.equal(shots.length,6);
  shots.forEach((shot,i)=>{const origin=origins[i%2],target=lanes[Math.floor(i/2)];assert.ok(shot.origin.equals(origin));assert.notEqual(shot.origin,origin);assert.ok(Math.abs(shot.direction.length()-1)<1e-10);assert.ok(shot.direction.dot(target.clone().sub(origin).normalize())>.999999);});
  orientations++;
 }
 assert.throws(()=>m.commitBomberLanes(new m.Vector3(NaN,0,0),new m.Quaternion(),2));assert.throws(()=>m.bomberVolley([],[]));
 for(const sector of ['covered','express','east','west']){
  const scanner=new m.FreightScanner({x:0,y:7,z:2});let saw=false;
  for(let i=0;i<40;i++){scanner.update(.1,sector,true);if(scanner.hazards.length){saw=true;break;}}
  assert.equal(saw,sector!=='covered','covered road avoids the scanner');if(!saw)continue;
  const h=scanner.hazards[0],frozen=structuredClone({from:h.from,target:h.target});assert.ok(h.tell>1.7);assert.equal(h.age,0);
  scanner.update(NaN,sector,true);scanner.update(.5,sector,true);scanner.update(0,sector,true);assert.equal(h.age,0);assert.ok(h.tell>1.7);
  for(let i=0;i<17;i++){scanner.update(.1,'covered',true);assert.equal(h.age,0,'warning cannot damage during its tell');}
  assert.deepEqual({from:h.from,target:h.target},frozen,'the scanner lane stays committed after a sector change');
  scanner.update(.2,sector,true);assert.ok(h.age>0&&h.age<.2);for(let i=0;i<6;i++)scanner.update(.1,sector,true);assert.equal(scanner.hazards.length,0,'expired hazard is removed');
  for(let i=0;i<70;i++){scanner.update(.1,sector,true);assert.ok(scanner.hazards.length<=1,'one committed strip at a time');}
  scanner.update(.1,sector,false);assert.equal(scanner.hazards.length,0,'deactivation clears the hazard');
 }
 return orientations;
}
const m=await load();const orientations=hazards(m);
for(const mutation of [["[-110,0,110]","[-10,0,10]"],["tell:1.8","tell:0"],["['express','east','west']","['covered','express','east','west']"]]){
 const changed=await load(mutation);assert.throws(()=>hazards(changed),'support failure control must be detected');
}
const records=new Map();let fail=false;const storage={getItem:k=>records.get(k)??null,setItem:(k,v)=>{if(fail)throw Error('quota');records.set(k,v);}};
const save=new m.CampaignSave(storage,'test:bullion-landing-support');assert.ok(m.prepareBullionReview(save).ok);
save.update(d=>{d.quests=d.quests.filter(q=>q!=='bullion_reach.landed');d.location={mode:'space',world:'bullion_reach',checkpoint:'bullion_reach.orbit'};d.fighterShipKey='xrpl_striker';d.transit.position=[m.BULLION_APPROACH.x+480,m.BULLION_APPROACH.y,m.BULLION_APPROACH.z];});
assert.equal(m.beginBullionLanding(save).ok,false,'480 m is outside the landing boundary');save.update(d=>{d.transit.position[0]-=.01;});const before=save.snapshot;
fail=true;assert.equal(m.beginBullionLanding(save).ok,false);assert.deepEqual(save.snapshot,before,'failed landing save does not discard orbit');fail=false;
assert.ok(m.beginBullionLanding(save).ok);assert.equal(save.snapshot.fighterShipKey,'xrpl_striker');assert.equal(save.snapshot.location.mode,'surface');assert.equal(m.beginBullionLanding(save).changed,false,'repeat landing is idempotent');
const normal=new m.CampaignSave(storage,'coded-xrp-definitive-v1');assert.equal(m.prepareBullionReview(normal).ok,false,'test grants cannot enter the normal campaign slot');
assert.equal(m.FOG_BULLION_ROUTE.waves.length,3);assert.equal(m.FOG_BULLION_ROUTE.destinationModel,'planet_bullion_reach');
assert.ok(m.BULLION_APPROACH.distanceTo(new m.Vector3(...m.BULLION_FLIGHT.center))>m.BULLION_FLIGHT.radius+480,'landing trigger remains outside the planet collider');
console.log(`bullion-support: OK — ${orientations} bomber orientations, six fixed shots, scanner timing/cover/pause, failed-save landing and three detected failure controls.`);
