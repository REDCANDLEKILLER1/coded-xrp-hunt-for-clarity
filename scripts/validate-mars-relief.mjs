import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import {spawnSync} from 'node:child_process';

async function run(){
const mutation=process.env.CODED_MARS_MUTATION;
const mutant=mutation?{name:'mars-contract-control',setup(build){build.onLoad({filter:/[\\/](MarsRelief|SurfaceInput|MarsSurfaceScene)\.ts$/},args=>{
 let contents=readFileSync(args.path,'utf8');
 if(mutation==='approach'&&args.path.endsWith('MarsRelief.ts'))contents=contents.replace('<=480;','<=50000;');
 if(mutation==='defenders'&&args.path.endsWith('MarsRelief.ts'))contents=contents.replace('remainingGuards!==0','false');
 if(mutation==='held-key'&&args.path.endsWith('SurfaceInput.ts'))contents=contents.replace('this.keys.clear();','');
 if(mutation==='damage'&&args.path.endsWith('MarsSurfaceScene.ts'))contents=contents.replace('hit.hp-=SURFACE_COMBAT.heroDamage','hit.hp-=SURFACE_COMBAT.heroDamage/2');
 return{contents,loader:'ts'};
});}}:null;

// DOM and renderer doubles exercise actual scene logic without granting any
// browser campaign progress. GLB geometry, rig and clips below are real assets.
const ctx=new Proxy({},{get:(t,k)=>t[k]??(()=>{}),set:(t,k,v)=>{t[k]=v;return true;}});
class Element extends EventTarget{
  children=[];style={};dataset={};hidden=false;disabled=false;textContent='';clientWidth=390;clientHeight=844;captures=new Set();
  append(...items){this.children.push(...items);}appendChild(item){this.append(item);return item;}replaceChildren(...items){this.children=items;}
  setAttribute(){}remove(){}getContext(){return ctx;}setPointerCapture(id){this.captures.add(id);}hasPointerCapture(id){return this.captures.has(id);}releasePointerCapture(id){this.captures.delete(id);}click(){if(!this.disabled)this.dispatchEvent(new Event('click'));}
}
globalThis.window=new EventTarget();globalThis.document=new Element();document.createElement=()=>new Element();document.body=new Element();document.hidden=false;
globalThis.self=globalThis;globalThis.createImageBitmap=async()=>({width:1024,height:1024,close(){}});globalThis.localStorage={getItem:()=>null};
const out=await build({stdin:{contents:`
export * from './src/game/definitive/CampaignSave';
export * from './src/game/definitive/MarsRelief';
export * from './src/game/definitive/SurfaceCombat';
export * from './src/game/definitive/ChapterTransitions';
export * from './src/game/definitive/SceneController';
export * from './src/game/definitive/SpaceProgress';
export * from './src/game/definitive/PlanetApproach';
export * from './src/game/definitive/GraphicsQuality';
export * from './src/game/definitive/FighterFootprint';
export * from './src/game/definitive/ConversationFrame';
export {MarsSurfaceScene} from './src/game/definitive/MarsSurfaceScene';
export {Vector3,Box3,AnimationMixer,PerspectiveCamera} from 'three';
export {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
export {clone as cloneRig} from 'three/addons/utils/SkeletonUtils.js';`,loader:'ts',resolveDir:process.cwd()},loader:{'.css':'empty'},plugins:mutant?[mutant]:[],bundle:true,write:false,format:'esm',logLevel:'silent'});
const m=await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
const {CampaignSave,RELIEF_PUMPS,MarsReliefQuest,prepareMarsReliefReview,beginMarsRelief,canDescendToRelief,MARS_APPROACH,surfaceClear,surfaceMove,surfaceSegmentHit,surfaceLineClear,canSurfaceTell,fieldRepair,MarsSurfaceScene,Vector3,Box3,AnimationMixer,GLTFLoader,cloneRig,SceneController,savedChapterScene,startTransit}=m;
// Fit actual world-space actors into the area outside the dialogue, including
// orientation changes and an approach from each side. Framing cannot move them.
for(const [width,height] of [[390,844],[360,740],[844,390],[1024,768]])for(const [x,z] of [[0,3],[3,0],[-3,0],[0,-3],[1.9,1.9]]){
 const camera=new m.PerspectiveCamera(46,1,.1,300),a=new Vector3(x,0,12+z),b=new Vector3(0,0,12),before=[a.toArray(),b.toArray()];
 m.frameConversation(camera,a,b,width,height);
 for(const actor of [a,b])for(const dx of [-.55,.55])for(const dz of [-.45,.45])for(const y of [0,2.25]){
  const p=actor.clone().add(new Vector3(dx,y,dz)).project(camera),sx=(p.x+1)*width/2,sy=(1-p.y)*height/2;
  assert.ok(p.z>-1&&p.z<1);assert.ok(sx>=width*.02&&sx<=width*(width/height>1.25?.5:.98),'actors fit beside landscape dialogue');
  assert.ok(sy>height*.12&&sy<height*(width/height>1.25?.88:.72),'actors stay above portrait dialogue');
 }
 assert.deepEqual([a.toArray(),b.toArray()],before);
}
const qualityRenderer={shadowMap:{enabled:true,needsUpdate:false},ratio:0,setPixelRatio(v){this.ratio=v;}};
m.applyGraphicsQuality(qualityRenderer,'low',3);assert.equal(qualityRenderer.ratio,1);assert.equal(qualityRenderer.shadowMap.enabled,false);m.applyGraphicsQuality(qualityRenderer,'full',3);assert.equal(qualityRenderer.ratio,1.75);assert.equal(qualityRenderer.shadowMap.enabled,true);m.applyGraphicsQuality(qualityRenderer,'low',NaN);assert.equal(qualityRenderer.ratio,1);
let serial=0,fail=false;const records=new Map(),storage={getItem:k=>records.get(k)??null,setItem:(k,v)=>{if(fail)throw Error('quota');records.set(k,v);}};
const fresh=()=>new CampaignSave(storage,'test:relief-'+(++serial));
const empty=fresh(),emptySnapshot=empty.snapshot;assert.equal(beginMarsRelief(empty).ok,false);assert.deepEqual(empty.snapshot,emptySnapshot);assert.equal(prepareMarsReliefReview(new CampaignSave(storage,'campaign')).ok,false);
const travel=fresh();assert.ok(prepareMarsReliefReview(travel).ok);assert.ok(startTransit(travel).ok);assert.ok(canDescendToRelief(travel));
for(const x of [481,8000]){travel.update(d=>{d.transit.position=[MARS_APPROACH.x+x,MARS_APPROACH.y,MARS_APPROACH.z];});assert.equal(beginMarsRelief(travel).ok,false);assert.equal(travel.snapshot.location.mode,'space');}
travel.update(d=>{d.transit.position=MARS_APPROACH.toArray();d.transit.hull=0;});assert.equal(canDescendToRelief(travel),false);
travel.update(d=>{d.transit.hull=100;});fail=true;assert.equal(beginMarsRelief(travel).ok,false);assert.equal(travel.snapshot.location.mode,'space');fail=false;assert.ok(beginMarsRelief(travel).ok);assert.equal(savedChapterScene(travel),'mars');
const quest=new MarsReliefQuest(travel);assert.equal(quest.releasePump('intake',0).ok,false);assert.ok(quest.meetCorn().ok);const fighterBefore=travel.snapshot.fighterUpgrades,capitalBefore=travel.snapshot.capitalUpgrades;
for(const pump of RELIEF_PUMPS){
  assert.equal(quest.releasePump(pump.id,1).ok,false);const before=travel.snapshot;fail=true;assert.equal(quest.releasePump(pump.id,0).ok,false);assert.deepEqual(travel.snapshot,before);fail=false;
  assert.ok(quest.releasePump(pump.id,0).ok);assert.equal(quest.releasePump(pump.id,0).ok,false);
}
const beforeReward=travel.snapshot;fail=true;assert.equal(quest.completeRelief().ok,false);assert.deepEqual(travel.snapshot,beforeReward);fail=false;assert.ok(quest.completeRelief().ok);assert.equal(quest.completeRelief().ok,false);
assert.equal(travel.snapshot.credits,120);assert.deepEqual(travel.snapshot.fighterUpgrades,fighterBefore);assert.deepEqual(travel.snapshot.capitalUpgrades,capitalBefore);assert.equal(travel.snapshot.heroUpgrades.field_repair,1);
assert.equal(travel.snapshot.recruits.filter(x=>x==='corn_xrpl').length,1);travel.reload();assert.ok(quest.restored);startTransit(travel);assert.ok(beginMarsRelief(travel).ok);assert.equal(travel.snapshot.location.checkpoint,'mars.corn');
assert.equal(fieldRepair(40,0,false).used,false);assert.equal(fieldRepair(40,1,true).used,false);assert.equal(fieldRepair(100,0,true).used,false);assert.equal(fieldRepair(0,0,true).used,false);assert.deepEqual(fieldRepair(30,0,true),{life:70,cooldown:20,used:true});assert.equal(fieldRepair(80,0,true).life,100);
assert.equal(surfaceClear({x:0,z:26}),false);assert.equal(surfaceClear({x:5,z:26}),true);assert.equal(surfaceClear({x:0,z:15}),true);
for(const p of RELIEF_PUMPS){assert.equal(surfaceClear(p),false);assert.ok(surfaceClear({x:p.x,z:p.z+5.4}));assert.equal(surfaceLineClear({x:p.x-4,z:p.z},{x:p.x+4,z:p.z}),false);assert.ok(surfaceLineClear({x:p.x-4,z:p.z+4},{x:p.x+4,z:p.z+4}));}
let pos={x:30,z:35};for(let i=0;i<500;i++)pos=surfaceMove(pos,.29,.29);assert.ok(pos.x<=31&&pos.z<=38,'sustained movement stays bounded');
assert.ok(surfaceSegmentHit({x:-20,z:0},{x:20,z:0},{x:0,z:0},.48),'swept shots cannot tunnel');assert.equal(surfaceSegmentHit({x:-20,z:1},{x:20,z:1},{x:0,z:0},.48),false);
assert.ok(canSurfaceTell(8,true,1));assert.equal(canSurfaceTell(8,true,2),false);assert.equal(canSurfaceTell(8,false,0),false);assert.equal(canSurfaceTell(14,true,0),false);

const catalog=JSON.parse(readFileSync('public/assets/manifest.json','utf8')),ids=['xrpman','corn','fighter_ledger_warden','mars_relief','space_regulator_drone'];
const models=[];let sceneBytes=0;
for(const id of ids){const entry=catalog.models[id],bytes=readFileSync('public'+entry.src);sceneBytes+=bytes.length;assert.equal(entry.bytes,bytes.length);assert.equal(entry.sha256,createHash('sha256').update(bytes).digest('hex'));assert.ok(entry.scenes.includes('mars_surface'));models.push(await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length),''));}
assert.ok(sceneBytes+900000<=12*1024*1024,'required relief models plus renderer reserve fit the scene transfer budget');
for(const id of ['fighter_player','fighter_xrpl_striker','fighter_ledger_warden']){
 const bytes=readFileSync('public'+catalog.models[id].src),g=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length),'');g.scene.position.z=26;const hull=m.fighterFootprint(g.scene);assert.ok(hull.length>=3);let samples=0;
 g.scene.traverse(o=>{if(!o.isMesh)return;const a=o.geometry.getAttribute('position');for(let i=0;i<a.count;i++){const v=new Vector3().fromBufferAttribute(a,i).applyMatrix4(o.matrixWorld);assert.ok(m.withinFootprint(v,hull,1e-6),'actual parked vertices lie inside the collision proxy');samples++;}});
 assert.ok(samples>1000);assert.equal(m.withinFootprint({x:5,z:26},hull),false,'pilot route stays clear');assert.equal(m.withinFootprint({x:3,z:23},hull),true,'actual rear wing blocks movement');assert.equal(m.withinFootprint({x:3,z:29},hull),false,'no phantom mirrored wing beside the nose');
}
for(const p of RELIEF_PUMPS){const center=models[3].scene.getObjectByName('Pump_'+p.id+'_Lights').getWorldPosition(new Vector3()),valve=models[3].scene.getObjectByName('Valve_'+p.id).getWorldPosition(new Vector3());assert.ok(Math.abs(center.x-p.x)<.001&&Math.abs(center.z-p.z)<.001,'runtime collider aligns with the actual Blender plant');assert.ok(Math.abs(valve.x-p.x)<.001&&Math.abs(valve.z-p.z-3.25)<.001,'interaction point aligns with the real control');}
const corn=models[1],cornBytes=readFileSync('public'+catalog.models.corn.src),cornDoc=JSON.parse(cornBytes.subarray(20,20+cornBytes.readUInt32LE(12)));
assert.equal(cornDoc.images.length,6);assert.equal(cornDoc.skins.length,1);assert.deepEqual(corn.animations.map(a=>a.name).sort(),['Hit','Idle','Interact']);assert.ok(Math.abs(new Box3().setFromObject(corn.scene).getSize(new Vector3()).y-1.95)<.025);
assert.ok(cornDoc.materials.some(m=>m.name==='Corn golden kernels'));assert.ok(cornDoc.materials.some(m=>m.name==='corn optical lenses'));assert.ok(cornDoc.materials.some(m=>m.name==='Corn fibrous husk'));
const mixer=new AnimationMixer(corn.scene);
for(const clip of corn.animations){mixer.stopAllAction();mixer.clipAction(clip).reset().play();let last,travel=0;for(let i=0;i<12;i++){mixer.update(clip.duration/13);corn.scene.updateMatrixWorld(true);for(const name of ['Hero_Origin','Hand_R','Hand_L'])assert.ok(corn.scene.getObjectByName(name).getWorldPosition(new Vector3()).length()<3);const hand=corn.scene.getObjectByName('Hand_R').getWorldPosition(new Vector3());if(last)travel+=last.distanceTo(hand);last=hand;corn.scene.traverse(o=>{if(!o.isSkinnedMesh)return;for(let j=0;j<o.geometry.attributes.position.count;j+=257){const v=new Vector3().fromBufferAttribute(o.geometry.attributes.position,j);o.applyBoneTransform(j,v);assert.ok(Number.isFinite(v.length())&&v.length()<3);}});}assert.ok(travel>.0001,clip.name+' moves its actual rig');}
mixer.stopAllAction();mixer.uncacheRoot(corn.scene);
const key=(type,code,repeat=false)=>{const e=new Event(type,{cancelable:true});Object.assign(e,{code,repeat});window.dispatchEvent(e);};
const pointer=(element,type,id,x,y,pointerType='touch')=>{const e=new Event(type,{cancelable:true});Object.assign(e,{pointerId:id,clientX:x,clientY:y,pointerType});element.dispatchEvent(e);};
function fixture(){
 const save=fresh();assert.ok(prepareMarsReliefReview(save).ok);const root=new Element(),canvas=new Element(),renderer={domElement:canvas,info:{render:{triangles:0,calls:0},memory:{geometries:0,textures:0}},render(){}};
 const copies=models.map(g=>({...g,scene:cloneRig(g.scene)}));const scene=new MarsSurfaceScene({renderer,root,save,environment:null,models:copies,arrival:false,onOrbit(){},onRetry(){}});scene.setActive(true);scene.togglePause();scene.render();return{save,scene,canvas};
}
// Real scene interaction: distance/defender gating, save-failure hold, no reward
// from replay and input clearing on both sides of the actual dialogue panel.
const f=fixture(),s=f.scene;assert.equal(s.quest.introduced,false);s.interact();assert.equal(s.comms.active,false);s.hero.position.set(0,0,15);key('keydown','KeyD');s.interact();assert.ok(s.comms.active);const held=s.hero.position.clone();s.update(.3);assert.ok(s.hero.position.equals(held));
assert.equal(s.camera.view.enabled,true);s.repairCooldown=8;s.shoot(new Vector3(0,1,16),new Vector3(0,0,-1),true);const heldBolt=s.bolts[0].mesh.position.clone(),heldGuards=s.guards.map(g=>g.clock);
s.update(.5);assert.ok(s.bolts[0].mesh.position.equals(heldBolt));assert.equal(s.repairCooldown,8);assert.deepEqual(s.guards.map(g=>g.clock),heldGuards);assert.equal(s.life,100);
// A click can close the panel between update frames, including after blur.
window.dispatchEvent(new Event('blur'));assert.ok(s.paused);
fail=true;s.comms.dialogue.skip();assert.ok(s.comms.active);assert.equal(s.quest.introduced,false);fail=false;s.comms.dialogue.skip();assert.equal(s.comms.active,false);assert.ok(s.quest.introduced);s.update(.05);assert.ok(s.hero.position.equals(held));
assert.equal(s.camera.view.enabled,false,'gameplay camera restores even if dialogue was closed while paused');s.bolts[0].life=0;s.updateBolts(0);s.repairCooldown=0;s.togglePause();s.update(.05);assert.ok(s.hero.position.equals(held),'held movement must not resume after the dialogue and pause close');key('keyup','KeyD');
s.hero.position.set(-18,0,5.4);s.interact();assert.equal(s.quest.pumpClear('intake'),false,'real remaining defenders block valve');
// The shipping fire/update/collision path kills the actual target, at phone-like
// dt. No hit points or rewards are injected by this simulation after setup.
for(const g of s.guards)if(g!==s.guards[1]){g.hp=0;g.mesh.visible=false;}
s.hero.position.set(-13.2,0,9);s.updateCamera(true);s.render();key('keydown','Space');
for(let i=0;i<150&&s.guards[1].hp>0;i++)s.update(1/60);key('keyup','Space');assert.equal(s.guards[1].hp,0,'real muzzle volleys defeat defender');assert.equal(s.hits,4);assert.ok(s.shots>=4&&s.shots<=6);
s.hero.position.set(-18,0,5.4);fail=true;s.interact();assert.equal(s.quest.pumpClear('intake'),false);fail=false;s.interact();assert.ok(s.quest.pumpClear('intake'));const money=f.save.snapshot.credits;s.interact();assert.equal(f.save.snapshot.credits,money);assert.equal(s.host.models[3].scene.getObjectByName('Pump_intake_Lights').material,s.green);
// Separate pointers coexist, release/cancel/blur/ownership changes clear them.
s.hero.position.set(5,0,15);pointer(f.canvas,'pointerdown',11,80,500);pointer(f.canvas,'pointermove',11,128,500);pointer(s.fire,'pointerdown',12,340,700);assert.equal(s.input.firing,true);assert.equal(s.input.move.x,1);const beforeMove=s.hero.position.x;s.update(.05);assert.ok(s.hero.position.x>beforeMove);pointer(s.fire,'pointercancel',12,340,700);assert.equal(s.input.firing,false);assert.equal(s.input.move.x,1);window.dispatchEvent(new Event('blur'));assert.equal(s.input.move.x,0);assert.equal(s.paused,true);s.togglePause();s.setActive(false);pointer(f.canvas,'pointerdown',13,80,500);key('keydown','Space');assert.equal(s.input.firing,false);s.setActive(true);assert.equal(s.input.move.x,0);
// Incoming swept bolts, shield cost, bounded tells and actual repair consumer.
pointer(f.canvas,'pointerdown',14,80,500);pointer(f.canvas,'pointermove',14,128,500);pointer(s.fire,'pointerdown',15,340,700);window.dispatchEvent(new Event('resize'));assert.equal(s.input.move.x,0);assert.equal(s.input.firing,false,'orientation change clears both pointer owners');
s.hero.position.set(5,0,15);s.life=64;s.shielding=false;s.invulnerable=0;s.shoot(new Vector3(5,1,14),new Vector3(0,0,1),true);s.updateBolts(.2);assert.equal(s.life,56);s.invulnerable=0;s.shielding=true;const charge=s.shieldCharge;s.damage();assert.equal(s.life,56);assert.equal(s.shieldCharge,charge-16);
f.save.update(d=>{d.heroUpgrades.field_repair=1;});s.repair();assert.equal(s.life,96);assert.equal(s.repairCooldown,20);s.repair();assert.equal(s.life,96);s.paused=true;s.update(1);assert.equal(s.repairCooldown,20,'pause holds ability cooldown');s.paused=false;
// Scene load failure retains the actual previous simulation owner and save.
const controller=new SceneController();await controller.change(async()=>s);const state=f.save.snapshot;assert.equal(await controller.change(async()=>{throw Error('missing texture');}),false);assert.equal(s.active,true);assert.deepEqual(f.save.snapshot,state);controller.clear();key('keydown','KeyE');assert.equal(s.active,false);
console.log(`mars-relief: OK — ${sceneBytes} bytes; real Corn GLB/rig; guarded arrival; atomic three-valve/crew/upgrade saves; actual shooting, shield, repair, touch ownership, modal and failure paths.`);
if(!mutation){
 for(const name of ['approach','defenders','held-key','damage']){
   const result=spawnSync(process.execPath,[process.argv[1]],{env:{...process.env,CODED_MARS_MUTATION:name},encoding:'utf8',maxBuffer:2*1024*1024});
   assert.equal(result.status,1,`targeted ${name} control must fail a behavioral assertion`);assert.match(result.stderr,/AssertionError/,`targeted ${name} must reach an assertion, not a loader failure`);
 }
 console.log('mars-relief: guarded approach, live defender lock, held-input clear and actual hit-damage mutations detected.');
}
}
run().catch(error=>{console.error(error.name+': '+error.message);process.exit(1);});
