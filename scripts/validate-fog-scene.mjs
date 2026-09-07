import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {build} from 'esbuild';
async function run(){
const mutation=process.env.CODED_FOG_MUTATION;
const plugin=mutation?{name:'fog-controls',setup(b){b.onLoad({filter:/[\\/](FogCitadel|FogMoon|FogMoonScene|SpectralReveal)\.ts$/},args=>{
 let contents=readFileSync(args.path,'utf8');
 if(mutation==='decoy'&&args.path.endsWith('FogCitadel.ts'))contents=contents.replace('feed!==this.trueFeed','false');
 if(mutation==='reveal'&&args.path.endsWith('SpectralReveal.ts'))contents=contents.replace('this.cooldown=REVEAL.cooldown','this.cooldown=0');
 if(mutation==='relay-guard'&&args.path.endsWith('FogMoon.ts'))contents=contents.replace('guards!==0||!revealed','false||!revealed');
 if(mutation==='height-hit'&&args.path.endsWith('FogMoonScene.ts'))contents=contents.replace('segmentSphere(before,b.mesh.position,this.feed(feed),','surfaceSegmentHit(before,b.mesh.position,this.feed(feed),');
 if(mutation==='tell'&&args.path.endsWith('FogMoonScene.ts'))contents=contents.replace('if(hot&&!h.hit&&','if(!h.hit&&');
 if(mutation==='modal-clock'&&args.path.endsWith('FogMoonScene.ts'))contents=contents.replace('if(this.comms.active){this.mixer.update(dt);','if(this.comms.active){this.reveal.update(dt);this.mixer.update(dt);');
 if(mutation==='victory-save'&&args.path.endsWith('FogMoonScene.ts'))contents=contents.replace('if(!r.ok)return false;this.restored=true','this.restored=true');
 return{contents,loader:'ts'};
});}}:null;
class Element extends EventTarget{children=[];style={};dataset={};hidden=false;disabled=false;textContent='';clientWidth=390;clientHeight=844;captures=new Set();append(...items){this.children.push(...items);}appendChild(i){this.append(i);return i;}replaceChildren(...items){this.children=items;}setAttribute(){}remove(){}setPointerCapture(i){this.captures.add(i);}hasPointerCapture(i){return this.captures.has(i);}releasePointerCapture(i){this.captures.delete(i);}}
globalThis.window=new EventTarget();globalThis.document=new Element();document.createElement=()=>new Element();document.body=new Element();document.hidden=false;globalThis.self=globalThis;globalThis.createImageBitmap=async()=>({width:1024,height:1024,close(){}});globalThis.localStorage={getItem:()=>null};
const out=await build({stdin:{contents:`
export * from './src/game/definitive/FogMoon';
export * from './src/game/definitive/FogCitadel';
export * from './src/game/definitive/FogMoonScene';
export * from './src/game/definitive/SpectralReveal';
export * from './src/game/definitive/CampaignSave';
export * from './src/game/definitive/SceneController';
export {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
export {clone as cloneRig} from 'three/addons/utils/SkeletonUtils.js';
export {Vector3} from 'three';`,resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'esm',loader:{'.css':'empty'},plugins:plugin?[plugin]:[],logLevel:'silent'});
const m=await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);let fail=false,serial=0;const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>{if(fail)throw Error('quota');data.set(k,v);}},fresh=()=>new m.CampaignSave(storage,'test:fog-scene'+(++serial));
const catalog=JSON.parse(readFileSync('public/assets/manifest.json','utf8')),ids=['xrpman','boo','fighter_player','fog_canyon','fog_citadel','space_regulator_drone'];const models=await Promise.all(ids.map(async id=>{const b=readFileSync('public'+catalog.models[id].src);return new m.GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.length),'');}));
const key=(type,code)=>{const e=new Event(type,{cancelable:true});Object.assign(e,{code,repeat:false});window.dispatchEvent(e);};
const pointer=(element,type,id,x=0,y=0)=>{const e=new Event(type,{cancelable:true});Object.assign(e,{button:0,isPrimary:id===1,pointerType:'touch',pointerId:id,clientX:x,clientY:y,detail:0});element.dispatchEvent(e);};
function fixture(saved,callbacks={}){const save=saved??fresh();if(!saved)assert.ok(m.prepareFogReview(save).ok);const root=new Element(),canvas=new Element(),renderer={domElement:canvas,render(){},info:{render:{calls:0,triangles:0},memory:{geometries:0,textures:0}}};const scene=new m.FogMoonScene({root,renderer,environment:null,save,models:models.map(g=>({...g,scene:m.cloneRig(g.scene)})),arrival:false,onOrbit(){},onRetry(){},...callbacks});scene.setActive(true);scene.togglePause();return{scene,save,canvas};}
const f=fixture(),s=f.scene;assert.ok(m.meetBoo(f.save,m.BOO_POSITION,0).ok);s.met=true;s.hero.position.set(-16,0,9);s.pulse();assert.equal(s.reveal.remaining,5);assert.equal(s.reveal.request(true),false,'cooldown prevents pulse spam');
assert.equal(m.resolveFogRelay(f.save,0,2,{x:-16,z:9},1,true).ok,false,'guards actually gate relay transaction');
// A third native pointer activates Reveal while movement and fire remain owned.
s.reveal.cooldown=0;pointer(f.canvas,'pointerdown',1,50,400);pointer(f.canvas,'pointermove',1,90,400);pointer(s.fire,'pointerdown',2,300,760);pointer(s.revealButton,'pointerdown',3,300,690);assert.ok(s.input.firing&&s.input.move.x>.5);assert.equal(s.reveal.remaining,5);pointer(s.revealButton,'pointerup',3);assert.ok(s.input.firing);pointer(s.fire,'pointercancel',2);assert.equal(s.input.firing,false);pointer(f.canvas,'pointercancel',1);assert.equal(s.input.move.x,0);
// Actual conversation consumer freezes projectiles, abilities and hostile clocks.
s.talk('boo',()=>true);const savedTime={reveal:s.reveal.remaining,cool:s.reveal.cooldown,boss:s.battle.age};s.update(.5);assert.equal(s.reveal.remaining,savedTime.reveal);assert.equal(s.reveal.cooldown,savedTime.cool);assert.equal(s.battle.age,savedTime.boss);window.dispatchEvent(new Event('blur'));s.comms.dialogue.skip();s.update(.05);assert.equal(s.paused,true);assert.equal(s.camera.view?.enabled,false);s.togglePause();
// Ignore ground-plane shots below the elevated feed; physical palm shots hit it.
for(const g of s.guards){g.hp=0;g.mesh.visible=false;}s.started=true;s.hero.position.set(6,0,-34);s.battle.age=2.2;s.battle.identify(true);s.scene.updateMatrixWorld(true);const target=s.feed(2);s.shoot(new m.Vector3(target.x,0,target.z+3),new m.Vector3(target.x,0,target.z-3),false);s.updateShots(.2);assert.equal(s.battle.hp,900,'XZ overlap below a feed is not a hit');for(const b of s.shots)b.life=0;s.updateShots(0);
s.shoot(s.hero.getObjectByName('Hand_R').getWorldPosition(new m.Vector3()),target,false);for(let i=0;i<40;i++)s.updateShots(.02);assert.equal(s.battle.hp,888,'real palm-origin shot reaches physical feed');assert.equal(s.battle.hit(0,12),false,'false feed remains protected');
// Warning lane cannot damage before its committed tell has elapsed.
s.life=100;s.shielding=false;s.invulnerable=0;s.battle.hazards.push({id:900,kind:'lane',x:6,z:-29,dx:0,dz:0,tell:1,life:.55,hit:false});s.updateHazards(.02);assert.equal(s.life,100,'tell remains non-damaging');s.battle.hazards[0].tell=0;s.updateHazards(.02);assert.equal(s.life,82);
const controller=new m.SceneController();await controller.change(async()=>s);const snapshot=f.save.snapshot;assert.equal(await controller.change(async()=>{throw Error('missing next scene');}),false);assert.ok(s.active);assert.deepEqual(f.save.snapshot,snapshot);controller.clear();
// Fresh secured checkpoint, actual death panel/retry, atomic victory failure.
const secured=fresh();assert.ok(m.prepareFogReview(secured).ok);assert.ok(m.meetBoo(secured,m.BOO_POSITION,0).ok);for(let i=0;i<2;i++){const r=m.FOG_RELAYS[i];assert.ok(m.resolveFogRelay(secured,i,r.trueFeed,{x:r.x,z:r.z+3},0,true).ok);}const checkpoint=secured.snapshot;let retries=0;const d=fixture(secured,{onRetry(){retries++;}}).scene;assert.equal(d.guards.length,0);d.life=8;d.shielding=false;d.invulnerable=0;d.shoot(d.hero.position.clone().add(new m.Vector3(0,1,-1)),d.hero.position.clone().add(new m.Vector3(0,1,1)),true);d.updateShots(.2);assert.ok(d.dead);assert.equal(d.life,0);assert.deepEqual(secured.snapshot,checkpoint);
const elements=e=>[e,...e.children.flatMap(elements)];const retry=elements(d.ui).find(e=>e.textContent==='RETRY FOG MOON');assert.ok(retry);pointer(retry,'pointerdown',1);assert.equal(retries,1);d.setActive(false);pointer(retry,'pointerdown',1);assert.equal(retries,1);d.dispose();
const v=fixture(secured).scene;assert.equal(v.life,100);assert.equal(v.hero.position.x,16);assert.equal(v.hero.position.z,1);v.started=true;v.battle.hp=0;v.update(.05);assert.ok(v.pending);assert.equal(v.saveBeforeLeave(),false);v.update(.2);fail=true;v.comms.dialogue.skip();assert.ok(v.comms.active);assert.equal(v.restored,false);assert.equal(v.saveBeforeLeave(),false);assert.deepEqual(secured.snapshot,checkpoint);fail=false;v.comms.dialogue.skip();assert.ok(v.restored);assert.equal(v.saveBeforeLeave(),true);assert.ok(secured.snapshot.recruits.includes('boo'));const final=secured.snapshot;v.update(.5);assert.deepEqual(secured.snapshot,final);v.dispose();
console.log('fog-scene: OK — real three-touch ability ownership, modal clock hold, elevated palm/feed hits, non-damaging tells, load failure ownership, death/retry and failed victory transaction.');
if(!mutation)for(const name of ['decoy','reveal','relay-guard','height-hit','tell','modal-clock','victory-save']){const r=spawnSync(process.execPath,[process.argv[1]],{env:{...process.env,CODED_FOG_MUTATION:name},encoding:'utf8',maxBuffer:2*1024*1024});assert.equal(r.status,1,name+' must fail');assert.match(r.stderr,/AssertionError/,name+' reaches a behavioral assertion');}
}
run().catch(e=>{console.error(e.name+': '+e.message);process.exit(1);});
