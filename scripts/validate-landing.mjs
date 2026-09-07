import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import {Box3,DoubleSide,Raycaster,Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const load=async path=>{const result=await build({entryPoints:[path],bundle:true,write:false,format:'esm',logLevel:'silent'});return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);};
const {FIGHTER_MODELS,landingPose,LANDING_DURATION,PARKED_HEIGHT,dockFighter}=await load('src/game/definitive/LandingPlan.ts');
const {CampaignSave}=await load('src/game/definitive/CampaignSave.ts');
const catalog=JSON.parse(readFileSync('public/assets/manifest.json','utf8'));
globalThis.self=globalThis;globalThis.createImageBitmap=async()=>({width:1024,height:1024,close(){}});
const parse=async id=>{
  const entry=catalog.models[id];const bytes=readFileSync(`public${entry.src}`);
  assert.equal(entry.bytes,bytes.length);assert.equal(entry.sha256,createHash('sha256').update(bytes).digest('hex'));
  const doc=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));assert.ok((doc.images??[]).every(image=>!image.uri&&Number.isInteger(image.bufferView)));
  assert.ok(bytes.length<(id==='regulatory_warship_open'?1_500_000:600_000));
  return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length),'');
};
const ship=(await parse('regulatory_warship_open')).scene;ship.updateMatrixWorld(true);
const hull=[];ship.traverse(o=>{if(o.isMesh){o.material.side=DoubleSide;hull.push(o);}});
for(const name of ['Ship_Origin','Muzzle_FL','Muzzle_FR','Muzzle_L','Muzzle_R','Engine_L','Engine_R','Camera_Chase','Camera_Cockpit_Forward'])assert.ok(ship.getObjectByName(name),name);
const ray=new Raycaster();let samples=0;
for(const id of Object.values(FIGHTER_MODELS)){
  const fighter=(await parse(id)).scene;fighter.updateMatrixWorld(true);
  const box=new Box3().setFromObject(fighter),size=box.getSize(new Vector3());
  assert.ok(size.x<7.2&&size.z<9&&size.y<2.1,'all selected fighters fit the measured lift');
  for(const name of ['Fighter_Origin','Canopy_Hinge','Pilot_Seat','Pilot_Exit','Engine_L','Engine_R','Muzzle_L','Muzzle_R'])assert.ok(fighter.getObjectByName(name),name);
  assert.ok(Math.abs(box.min.y+PARKED_HEIGHT)<.03,'parked landing feet meet the deck');
  const exit=fighter.getObjectByName('Pilot_Exit').getWorldPosition(new Vector3());
  assert.ok(exit.x>1.5&&exit.z>2&&Math.abs(exit.y+PARKED_HEIGHT)<.03,'pilot exits in front of the wings on the floor');
  // Sweep the entire fighter bounding volume through both straight trajectory legs.
  for(const [a,b] of [[0,10],[10,17]]){
    const from=landingPose(a).fighter,to=landingPose(b).fighter,delta=to.clone().sub(from);
    for(let i=0;i<=8;i++)for(let j=0;j<=8;j++)for(let k=0;k<=2;k++){
      const local=new Vector3(box.min.x+size.x*i/8,box.min.y+size.y*k/2,box.min.z+size.z*j/8);
      ray.set(from.clone().add(local),delta.clone().normalize());ray.far=delta.length();
      const hits=ray.intersectObjects(hull,false);
      assert.equal(hits.length,0,`${id} swept sample (${i},${j},${k}) intersects actual recovery hull on ${a}-${b}`);samples++;
    }
  }
  const hinge=fighter.getObjectByName('Canopy_Hinge');const canopy=hinge.children.find(c=>c.isMesh);assert.ok(canopy,'actual opening canopy geometry');
  const before=new Box3().setFromObject(canopy).getCenter(new Vector3());hinge.rotation.x=-1.15;fighter.updateMatrixWorld(true);
  assert.ok(new Box3().setFromObject(canopy).getCenter(new Vector3()).y>before.y+.3,'canopy opens upward');
}
assert.equal(landingPose(LANDING_DURATION).stage,'docked');
const data=new Map();let fail=false;const storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>{if(fail)throw Error('quota');data.set(k,v);}};
let save=new CampaignSave(storage,'test:landing');save.update(d=>{d.fighterShipKey='ledger_warden';d.credits=200;});
const before=save.snapshot;fail=true;assert.equal(dockFighter(save).ok,false);assert.deepEqual(save.snapshot,before);
fail=false;assert.ok(dockFighter(save).ok);assert.equal(save.snapshot.warshipOwned,false);assert.equal(save.snapshot.credits,200);assert.equal(save.snapshot.fighterShipKey,'ledger_warden');
const revision=save.snapshot.revision;assert.ok(dockFighter(save).ok);assert.equal(save.snapshot.revision,revision,'repeat docking has no duplicate write or reward');
save=new CampaignSave(storage,'test:landing');assert.ok(save.snapshot.quests.includes('boarding.landed'));assert.equal(save.snapshot.location.checkpoint,'boarding.hangar');
assert.ok(!data.has('coded-xrp-definitive-v1:campaign'));
console.log(`landing: OK — three selected fighters, actual canopy/exit nodes, ${samples} swept hull-clearance samples, atomic docking failure/retry/reload and isolated save.`);
