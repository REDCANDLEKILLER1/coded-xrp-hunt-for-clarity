import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {build} from 'esbuild';
async function run(){
const mutation=process.env.CODED_EXCAVATION_MUTATION;
const plugin=mutation?{name:'excavation-control',setup(b){b.onLoad({filter:/[\\/](MarginWarden|MarsExcavation|MarsExcavationScene|SurfaceCombat|SurfaceInput|SurfaceOcclusion)\.ts$/},args=>{
 let contents=readFileSync(args.path,'utf8');
 if(mutation==='core-shield'&&args.path.endsWith('MarginWarden.ts'))contents=contents.replace('if(!this.exposed)return false;','');
 if(mutation==='tell'&&args.path.endsWith('MarginWarden.ts'))contents=contents.replace('h.age<h.warning||','');
 if(mutation==='route-guard'&&args.path.endsWith('MarsExcavation.ts'))contents=contents.replace('remaining!==0','false');
 if(mutation==='dash-wall'&&args.path.endsWith('SurfaceCombat.ts'))contents=contents.replace('Math.max(1,Math.ceil(distance/.25))','1');
 if(mutation==='height-hit'&&args.path.endsWith('MarsExcavationScene.ts'))contents=contents.replace('if(segmentSphere(before,b.mesh.position,this.targetPosition(id),','if(surfaceSegmentHit(before,b.mesh.position,this.targetPosition(id),');
 if(mutation==='touch-action'&&args.path.endsWith('SurfaceInput.ts'))contents=contents.replace('event.button!==0','true');
 if(mutation==='gate-occlusion'&&args.path.endsWith('SurfaceOcclusion.ts'))contents=contents.replace('const blocked=enabled&&','const blocked=false&&');
 if(mutation==='victory-save'&&args.path.endsWith('MarsExcavationScene.ts'))contents=contents.replace('if(!result.ok)return false;this.restored=true','this.restored=true');
 return{contents,loader:'ts'};
});}}:null;
const ctx=new Proxy({},{get:(t,k)=>t[k]??(()=>{}),set:(t,k,v)=>{t[k]=v;return true;}});
class Element extends EventTarget{children=[];style={};dataset={};hidden=false;disabled=false;textContent='';clientWidth=390;clientHeight=844;captures=new Set();append(...items){this.children.push(...items);}appendChild(i){this.append(i);return i;}replaceChildren(...items){this.children=items;}setAttribute(){}remove(){}getContext(){return ctx;}setPointerCapture(i){this.captures.add(i);}hasPointerCapture(i){return this.captures.has(i);}releasePointerCapture(i){this.captures.delete(i);}}
globalThis.window=new EventTarget();globalThis.document=new Element();document.createElement=()=>new Element();document.body=new Element();document.hidden=false;globalThis.self=globalThis;globalThis.createImageBitmap=async()=>({width:1024,height:1024,close(){}});globalThis.localStorage={getItem:()=>null};
const out=await build({stdin:{contents:`
export * from './src/game/definitive/MarsExcavation';
export * from './src/game/definitive/MarginWarden';
export * from './src/game/definitive/MarsRelief';
export * from './src/game/definitive/SurfaceCombat';
export * from './src/game/definitive/SurfaceDash';
export * from './src/game/definitive/SurfaceInput';
export * from './src/game/definitive/CampaignSave';
export * from './src/game/definitive/MarsExcavationScene';
export * from './src/game/definitive/SceneController';
export * from './src/game/definitive/WardenFrame';
export {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
export {clone as cloneRig} from 'three/addons/utils/SkeletonUtils.js';
export {Vector3,Box3,PerspectiveCamera} from 'three';`,resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'esm',loader:{'.css':'empty'},plugins:plugin?[plugin]:[],logLevel:'silent'});
const m=await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
let serial=0,fail=false;const records=new Map(),storage={getItem:k=>records.get(k)??null,setItem:(k,v)=>{if(fail)throw Error('quota');records.set(k,v);}},fresh=()=>new m.CampaignSave(storage,'test:excavation'+(++serial));
const save=fresh(),empty=save.snapshot;assert.equal(m.beginMarsExcavation(save,m.RELIEF_EXIT).ok,false);assert.deepEqual(save.snapshot,empty);assert.equal(m.prepareExcavationReview(new m.CampaignSave(storage,'campaign')).ok,false);
assert.ok(m.prepareExcavationReview(save).ok);assert.ok(m.returnMarsRelief(save,m.EXCAVATION_ENTRY).ok);const reliefState=save.snapshot;
for(const at of [undefined,{x:0,z:12},{x:NaN,z:-46},{x:0,z:-42}]){assert.equal(m.beginMarsExcavation(save,at).ok,false);assert.deepEqual(save.snapshot,reliefState);}
fail=true;assert.equal(m.beginMarsExcavation(save,m.RELIEF_EXIT).ok,false);assert.deepEqual(save.snapshot,reliefState);fail=false;assert.ok(m.beginMarsExcavation(save,m.RELIEF_EXIT).ok);assert.equal(m.beginMarsExcavation(save).changed,false);
assert.equal(m.secureExcavationRoute(save,1,{x:0,z:9}).ok,false);assert.equal(m.secureExcavationRoute(save,0,{x:0,z:30}).ok,false);assert.equal(m.completeMarginWarden(save,true).ok,false);
fail=true;const beforeRoute=save.snapshot;assert.equal(m.secureExcavationRoute(save,0,{x:0,z:9}).ok,false);assert.deepEqual(save.snapshot,beforeRoute);fail=false;assert.ok(m.secureExcavationRoute(save,0,{x:0,z:9}).ok);assert.equal(m.secureExcavationRoute(save,0,{x:0,z:9}).ok,false);
assert.equal(m.completeMarginWarden(save,false).ok,false);const beforeWin=save.snapshot;fail=true;assert.equal(m.completeMarginWarden(save,true).ok,false);assert.deepEqual(save.snapshot,beforeWin);fail=false;assert.ok(m.completeMarginWarden(save,true).ok);const won=save.snapshot;assert.equal(won.heroUpgrades.liquidity_dash,1);assert.equal(won.heroUpgrades.field_repair,1);assert.ok(won.earth.clearedPlanets.includes('mars'));assert.ok(won.earth.discoveredPlanets.includes('fog_moon'));assert.equal(m.completeMarginWarden(save,true).ok,false);assert.deepEqual(save.snapshot,won);save.reload();assert.deepEqual(save.snapshot,won);assert.deepEqual(won.fighterUpgrades,beforeWin.fighterUpgrades);assert.deepEqual(won.capitalUpgrades,beforeWin.capitalUpgrades);
// Genuine protected core, independent restart window, exposure and defeat.
const boss=new m.MarginWarden();assert.equal(boss.damage('left',12),false);boss.started=true;assert.equal(boss.damage('core',12),false);assert.equal(boss.hp,m.WARDEN.hp);boss.damage('left',m.WARDEN.pylonHP);boss.update(12.01,{x:0,z:30});assert.equal(boss.pylons.left.hp,m.WARDEN.pylonHP);
boss.damage('left',180);boss.update(1,{x:0,z:30});boss.damage('right',180);assert.equal(boss.exposed,true);assert.ok(boss.damage('core',12));assert.equal(boss.hp,m.WARDEN.hp-12);boss.update(m.WARDEN.exposure+.01,{x:0,z:30});assert.equal(boss.exposed,false);assert.equal(boss.pylons.right.hp,180);assert.equal(boss.damage('core',12),false);
let shots=1;while(!boss.defeated){boss.damage('left',180);boss.damage('right',180);for(let i=0;i<20&&!boss.defeated;i++){assert.ok(boss.damage('core',12));shots++;}boss.update(8,{x:0,z:30});}assert.equal(shots,80);assert.deepEqual(boss.targets(),[]);assert.deepEqual(boss.hazards,[]);
const mine=new m.MarginWarden();mine.started=true;mine.update(1.4,{x:2,z:-18.5});assert.equal(mine.hazards.length,1);const laser=mine.hazards[0],locked={x:laser.x,z:laser.z};assert.equal(m.miningHazardHits(laser,{x:2,z:-18.5}),false);mine.update(1.26,{x:12,z:-5});assert.deepEqual({x:laser.x,z:laser.z},locked);assert.ok(m.miningHazardHits(laser,{x:2,z:-18.5}));assert.equal(m.miningHazardHits(laser,{x:4,z:-18.5}),false);
const kinds=new Set();for(let i=0;i<1200;i++){mine.update(.05,{x:0,z:-18});for(const h of mine.hazards){kinds.add(h.kind);assert.ok(h.warning>=1.25);assert.ok(mine.hazards.length<=3);assert.equal(m.miningHazardHits({...h,age:0},{x:h.x,z:h.z}),false);}}assert.deepEqual([...kinds].sort(),['laser-x','laser-z','slam']);
const dash=new m.SurfaceDash();assert.equal(dash.request(false,{x:1,z:0}),false);assert.ok(dash.request(true,{x:3,z:0}));assert.equal(dash.request(true,{x:1,z:0}),false);const burst=dash.update(.5);assert.ok(Math.abs(burst.x-3.6)<1e-9);assert.equal(dash.active,false);assert.equal(dash.cooldown,4.5);const stopped=m.slideSurface({x:0,z:0},burst.x,0,p=>!(p.x>1&&p.x<1.5));assert.ok(stopped.x<=1,'dash cannot skip a thin wall');dash.update(4.5);assert.ok(dash.request(true,{x:0,z:-1}));assert.equal(m.excavationClear({x:6,z:30}),false);assert.equal(m.excavationClear({x:0,z:11.2}),false);
// Actual model dimensions/nodes, images and scene bytes, not source regexes.
const catalog=JSON.parse(readFileSync('public/assets/manifest.json','utf8')),ids=['xrpman','margin_warden','mars_excavation','space_regulator_drone'];let bytes=0;
const models=await Promise.all(ids.map(async id=>{const entry=catalog.models[id],data=readFileSync('public'+entry.src);bytes+=data.length;assert.equal(entry.bytes,data.length);assert.equal(entry.sha256,createHash('sha256').update(data).digest('hex'));return new m.GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'');}));
assert.ok(bytes+900000<12*1024*1024);models[1].scene.position.set(0,0,-35);models[1].scene.updateMatrixWorld(true);
for(const [name,pos] of [['Pylon_Left',m.WARDEN.left],['Pylon_Right',m.WARDEN.right],['Core_Target',m.WARDEN.core]])assert.ok(models[1].scene.getObjectByName(name).getWorldPosition(new m.Vector3()).distanceTo(new m.Vector3(pos.x,pos.y,pos.z))<.001,name+' matches physical target');models[1].scene.position.set(0,0,0);
for(const [name,pos] of [['Entry',[0,0,30]],['RouteCheckpoint',[0,0,9]],['BossAnchor',[0,0,-35]]])assert.ok(models[2].scene.getObjectByName(name).getWorldPosition(new m.Vector3()).distanceTo(new m.Vector3(...pos))<.001);
const bounds=new m.Box3().setFromObject(models[1].scene);
for(const [width,height] of [[390,844],[844,390],[360,740],[1024,768]]){
 const camera=new m.PerspectiveCamera(46,1,.1,300);m.frameWarden(camera,bounds,width,height);
 for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){const p=new m.Vector3(x,y,z).project(camera),sx=(p.x+1)/2,sy=(1-p.y)/2;assert.ok(p.z>-1&&p.z<1);assert.ok(sx>.01&&sx<(width/height>1.25?.5:.99));assert.ok(sy>.09&&sy<(width/height>1.25?.9:.73),'physical model clears the conversation panel');}
}
const key=(type,code,repeat=false)=>{const e=new Event(type,{cancelable:true});Object.assign(e,{code,repeat});window.dispatchEvent(e);};
function fixture(saved,callbacks={}){const save=saved??fresh();if(!saved)assert.ok(m.prepareExcavationReview(save).ok);const root=new Element(),canvas=new Element(),renderer={domElement:canvas,render(){},info:{render:{calls:0,triangles:0},memory:{geometries:0,textures:0}}};const scene=new m.MarsExcavationScene({root,renderer,environment:null,save,models:models.map(g=>({...g,scene:m.cloneRig(g.scene)})),onRelief(){},onRetry(){},...callbacks});scene.setActive(true);scene.togglePause();return{save,scene,canvas};}
const f=fixture(),s=f.scene;s.update(.05);assert.ok(s.comms.active);key('keydown','KeyW');s.update(.3);assert.equal(s.hero.position.z,30);s.comms.dialogue.skip();s.update(.05);assert.equal(s.hero.position.z,30);key('keyup','KeyW');
// Selected physical architecture fades only when it obscures the hero.
const frame=s.host.models[2].scene.getObjectByName('Gate_Frame');assert.ok(frame);s.hero.position.set(8.35,0,6.5);s.updateCamera(true);frame.traverse(o=>{if(o.isMesh)assert.equal(o.material.opacity,.14);});s.hero.position.set(0,0,-7);s.updateCamera(true);frame.traverse(o=>{if(o.isMesh)assert.equal(o.material.opacity,1);});
for(const x of [-8.4,8.4])assert.equal(m.excavationClear({x,z:8.3}),false,'physical gate supports are solid');assert.ok(m.excavationClear({x:0,z:8.3}),'gate opening remains traversable');
// A non-primary touch edge invokes an action without waiting for a click;
// a later compatibility click cannot toggle it twice. Keyboard activation works.
const button=new Element(),buttonLife=new AbortController();let presses=0;m.bindSurfaceButton(button,()=>presses++,buttonLife.signal);const event=(type,detail=0)=>{const e=new Event(type,{cancelable:true});Object.assign(e,{button:0,isPrimary:false,pointerType:'touch',detail});button.dispatchEvent(e);};event('pointerdown');assert.equal(presses,1);event('click',1);assert.equal(presses,1);event('click',0);assert.equal(presses,2);button.disabled=true;event('pointerdown');assert.equal(presses,2);buttonLife.abort();button.disabled=false;event('pointerdown');assert.equal(presses,2);
// Real flying shots must reach the elevated sphere, not just its XZ projection.
s.route=true;s.battle.started=true;s.introShown=true;s.hero.position.set(-5.8,0,-18.3);s.scene.updateMatrixWorld(true);const left=s.targetPosition('left');s.shoot(new m.Vector3(left.x,0,left.z+2),new m.Vector3(left.x,0,left.z-2),false);s.updateShots(.15);assert.equal(s.battle.pylons.left.hp,180,'a shot below the tower cannot damage it');for(const b of s.shots)b.life=0;s.updateShots(0);
s.updateCamera(true);s.render();key('keydown','Space');for(let i=0;i<400&&s.battle.pylons.left.hp>0;i++)s.update(1/60);key('keyup','Space');assert.equal(s.battle.pylons.left.hp,0,'actual AimFire palm projectiles disable the physical left tower');assert.ok(s.hits>=15);assert.ok(s.shotsFired>=16);
// Hold simulation and preserve ability cooldown while a real panel is open.
s.talk('warden',()=>true);s.repairCooldown=10;const held={position:s.hero.position.clone(),hp:s.battle.hp,pylon:s.battle.pylons.left.restart};s.update(.6);assert.ok(s.hero.position.equals(held.position));assert.equal(s.battle.hp,held.hp);assert.equal(s.battle.pylons.left.restart,held.pylon);assert.equal(s.repairCooldown,10);window.dispatchEvent(new Event('blur'));s.comms.dialogue.skip();s.update(.05);assert.equal(s.paused,true);assert.equal(s.camera.view.enabled,false);s.togglePause();
s.shielding=false;s.invulnerable=0;s.life=60;s.repairCooldown=0;s.repair();assert.equal(s.life,100);assert.equal(s.repairCooldown,20);f.save.update(d=>{d.heroUpgrades.liquidity_dash=1;});s.hero.position.set(4.7,0,30);s.hero.rotation.y=Math.PI/2;s.startDash();s.update(.05);assert.ok(s.hero.position.x<=5,'real dash respects the service bridge edge');assert.ok(s.dash.cooldown>0);
const controller=new m.SceneController();await controller.change(async()=>s);const snapshot=f.save.snapshot;assert.equal(await controller.change(async()=>{throw Error('missing model');}),false);assert.equal(s.active,true);assert.deepEqual(f.save.snapshot,snapshot);controller.clear();
// Actual death panel, fresh checkpoint construction and victory-save retry.
// These are controlled scene fixtures; the separate browser run earns its hits.
const checkpoint=fresh();assert.ok(m.prepareExcavationReview(checkpoint).ok);assert.ok(m.secureExcavationRoute(checkpoint,0,{x:0,z:9}).ok);const secured=checkpoint.snapshot;let retries=0;
const death=fixture(checkpoint,{onRetry(){retries++;}}).scene;death.update(.05);death.update(.2);death.comms.dialogue.skip();death.hero.position.set(0,0,-5);death.life=8;death.shielding=false;death.invulnerable=0;
death.shoot(new m.Vector3(0,1,-6),new m.Vector3(0,1,-4),true);death.updateShots(.2);assert.equal(death.dead,true);assert.equal(death.life,0);assert.equal(death.canAct(),false);assert.deepEqual(checkpoint.snapshot,secured);
const deathPosition=death.hero.position.clone();key('keydown','KeyD');key('keydown','Space');death.update(.4);assert.ok(death.hero.position.equals(deathPosition));assert.equal(death.input.firing,false);key('keyup','KeyD');key('keyup','Space');
const descendants=e=>[e,...e.children.flatMap(descendants)];const retry=descendants(death.ui).find(e=>e.textContent==='RETRY EXCAVATION');assert.ok(retry);retry.dispatchEvent(new Event('click'));assert.equal(retries,1);death.setActive(false);retry.dispatchEvent(new Event('click'));assert.equal(retries,1);death.dispose();checkpoint.reload();
const recovered=fixture(checkpoint).scene;assert.equal(recovered.guards.length,0);assert.equal(recovered.life,100);assert.equal(recovered.battle.hp,960);assert.equal(recovered.hero.position.z,6.5);assert.deepEqual(checkpoint.snapshot,secured);recovered.update(.05);recovered.update(.2);recovered.comms.dialogue.skip();
recovered.battle.hp=0;recovered.update(.05);assert.ok(recovered.victoryPending);assert.equal(recovered.saveBeforeLeave(),false);recovered.update(.2);fail=true;recovered.comms.dialogue.skip();assert.ok(recovered.comms.active);assert.equal(recovered.comms.dialogue.failed,true);assert.equal(recovered.saveBeforeLeave(),false);assert.deepEqual(checkpoint.snapshot,secured);fail=false;
recovered.comms.dialogue.skip();assert.equal(recovered.comms.active,false);assert.ok(recovered.restored);assert.equal(recovered.saveBeforeLeave(),true);assert.equal(checkpoint.snapshot.heroUpgrades.liquidity_dash,1);assert.equal(checkpoint.snapshot.credits,secured.credits+320);
for(const name of ['Pylon_Left_Lights','Pylon_Right_Lights'])recovered.boss.getObjectByName(name).traverse(o=>{if(o.isMesh)assert.equal(o.material.color.getHex(),0x00ff00);});
const final=checkpoint.snapshot;recovered.update(.4);checkpoint.reload();assert.deepEqual(checkpoint.snapshot,final);recovered.dispose();const revisit=fixture(checkpoint).scene;assert.ok(revisit.restored);assert.equal(revisit.guards.length,0);revisit.dispose();
console.log(`mars-excavation: OK — ${bytes} model bytes; actual elevated target hits, shield/exposure/restart, mining tells, route/return/atomic rewards, real repair/dash and modal/failure paths.`);
if(!mutation)for(const name of ['core-shield','tell','route-guard','dash-wall','height-hit','touch-action','gate-occlusion','victory-save']){const result=spawnSync(process.execPath,[process.argv[1]],{env:{...process.env,CODED_EXCAVATION_MUTATION:name},encoding:'utf8',maxBuffer:2*1024*1024});assert.equal(result.status,1,name+' must fail');assert.match(result.stderr,/AssertionError/,name+' reaches a behavioral assertion');}
}
run().catch(e=>{console.error(e.name+': '+e.message);process.exit(1);});
