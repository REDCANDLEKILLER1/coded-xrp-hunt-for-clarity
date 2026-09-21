import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {build} from 'esbuild';
const load=async path=>{const r=await build({entryPoints:[path],bundle:true,write:false,format:'esm',logLevel:'silent'});return import(`data:text/javascript;base64,${Buffer.from(r.outputFiles[0].text).toString('base64')}`);};
const manifest=JSON.parse(readFileSync('public/assets/manifest.json','utf8')),entry=manifest.models.civic_deck,bytes=readFileSync(`public${entry.src}`),doc=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
const names=new Set(doc.nodes.map(node=>node.name));
for(const name of ['Lift_Boarding','Market_Med','Armory_Capacitor','Bank_Kiosk','Quarters_Save','Casino_Door','Brig_Door','Residential_Door','Hangar_Door'])assert.ok(names.has(name),`physical Civic service anchor: ${name}`);
assert.ok(doc.meshes.length<=16,'Civic draw surfaces remain batched');
const civicSource=readFileSync('src/game/definitive/CivicScene.ts','utf8');
assert.match(civicSource,/cameraDistance=Math\.max\(8,Math\.min\(24,/,'Civic camera zoom remains bounded around the character');
assert.match(civicSource,/addEventListener\('wheel'.*this\.zoom/s,'desktop wheel controls Civic camera zoom');
assert.match(civicSource,/ZOOM −.*ZOOM \+/s,'touch-visible zoom controls remain available');
const {CampaignSave}=await load('src/game/definitive/CampaignSave.ts'),{BoardingQuest}=await load('src/game/definitive/BoardingQuest.ts');
const records=new Map(),storage={getItem:key=>records.get(key)??null,setItem:(key,value)=>records.set(key,value)};
const lockedSave=new CampaignSave(storage,'test:civic-ownership');lockedSave.update(d=>{d.location={mode:'hub',world:'ledger_prime',checkpoint:'boarding.bridge'};});const lockedCivic=new BoardingQuest(lockedSave);assert.equal(lockedCivic.enterCivic().ok,false,'Civic refuses entry until the Warship is captured');assert.equal(lockedSave.snapshot.location.checkpoint,'boarding.bridge');
let save=new CampaignSave(storage,'test:civic-deck');save.update(d=>{d.warshipOwned=true;d.credits=500;d.location={mode:'hub',world:'ledger_prime',checkpoint:'boarding.bridge'};});let civic=new BoardingQuest(save);
assert.equal(civic.tradeMedPack('buy').ok,false,'market transaction requires physical Civic checkpoint');
assert.ok(civic.enterCivic().ok);const before=save.snapshot.revision;assert.ok(civic.tradeMedPack('buy').ok);assert.equal(save.snapshot.credits,465);assert.equal(save.snapshot.inventory.med_pack,1);assert.equal(save.snapshot.revision,before+1,'purchase commits balance and cargo exactly once');
save=new CampaignSave(storage,'test:civic-deck');civic=new BoardingQuest(save);assert.equal(save.snapshot.credits,465);assert.equal(save.snapshot.inventory.med_pack,1,'purchase survives reload');
for(let i=0;i<8;i++)assert.ok(civic.tradeMedPack('buy').ok);assert.equal(civic.tradeMedPack('buy').ok,false,'cargo cap refuses tenth pack');
for(let i=0;i<9;i++)assert.ok(civic.tradeMedPack('sell').ok);assert.equal(save.snapshot.credits,347,'nine buy/sell round trips lose 153 credits and cannot print money');assert.equal(civic.tradeMedPack('sell').ok,false);
assert.ok(civic.restAtQuarters().ok);assert.equal(save.snapshot.location.checkpoint,'civic.quarters');save=new CampaignSave(storage,'test:civic-deck');civic=new BoardingQuest(save);assert.ok(civic.enterCivic().ok);assert.equal(save.snapshot.location.checkpoint,'civic.quarters','quarters checkpoint survives district reload');assert.ok(civic.returnToBridge().ok);assert.equal(save.snapshot.location.checkpoint,'boarding.bridge');
// Drive navigation across the production collision map, including all shop doors.
const {civicBlocked}=await load('src/game/definitive/CivicNavigation.ts');
const layout=JSON.parse(readFileSync('src/game/definitive/civic-layout.json','utf8'));
const queue=[[0,21]],visited=new Set(['0,21']);
for(let i=0;i<queue.length;i++){
  const [x,z]=queue[i];
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
    const nx=x+dx,nz=z+dz,key=`${nx},${nz}`;
    if(!visited.has(key)&&!civicBlocked(nx,nz)){visited.add(key);queue.push([nx,nz]);}
  }
}
for(const [name,,x,z] of layout.services){
  assert.ok(visited.has(`${x},${z}`),`${name} reachable from lift through physical doors`);
  const anchor=doc.nodes.find(n=>n.name===name);
  assert.ok(anchor,`model anchor ${name}`);
  assert.ok(Math.abs(anchor.translation[0]-x)<.01&&Math.abs(anchor.translation[2]-z)<.01,`${name} art and interaction agree`);
}
for(const o of layout.obstacles)assert.ok(civicBlocked(o.x,o.z),`${o.name} blocks movement`);
assert.ok(civic.enterCivic().ok);assert.ok(civic.restAtQuarters().ok);
const restedCredits=save.snapshot.credits;
assert.ok(civic.tradeMedPack('buy').ok,'shopping still works after resting');
assert.equal(save.snapshot.credits,restedCredits-35,'post-rest purchase charged exactly once');
const reloaded=new CampaignSave(storage,'test:civic-deck');
assert.equal(reloaded.snapshot.inventory.med_pack,1,'post-rest purchase survives reload');
assert.equal(reloaded.snapshot.location.checkpoint,'civic.quarters','shopping preserves saved bed');
// Adapted from Claude 7890806: drive production movement rather than source patterns.
const bundle=await build({entryPoints:['src/game/definitive/CivicScene.ts'],bundle:true,write:false,format:'esm',logLevel:'silent',loader:{'.css':'empty'}});
const {CivicScene}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const {Vector3}=await import('three');
const hero={position:new Vector3(0,0,21),rotation:{y:0}},crew={position:new Vector3(-1.3,0,21.6),rotation:{y:0}};
const gaits=new Set();let heroGait='';
const rig={active:true,paused:false,age:0,noticeClock:0,crewTrail:[],notice:{},ui:{querySelector:()=>null},input:{move:{x:0,y:0},clear(){}},host:{hero:{scene:hero},crew:{scene:crew}},mixer:{update(){}},crewMixer:{update(){}},play(name){heroGait=name;},playCrew(name){gaits.add(name);},updateCamera(){},paint(){}};
function drive(x,z,frames){rig.input.move={x,y:z};for(let i=0;i<frames;i++){CivicScene.prototype.update.call(rig,1/60);assert.ok(!civicBlocked(hero.position.x,hero.position.z),'hero cannot cross partitions');assert.ok(!civicBlocked(crew.position.x,crew.position.z),'companion cannot cross partitions');}}
drive(0,-1,104);drive(-1,0,82);drive(0,-1,38);drive(-1,0,135);drive(0,0,300);
assert.ok(hero.position.distanceTo(new Vector3(-20,0,8))<1,'hero reaches medical shop through doorway');
assert.ok(crew.position.distanceTo(hero.position)<3,'companion follows around planter and through shop doorway');
assert.deepEqual([...gaits].sort(),['Idle','Run','Walk']);
drive(.2,0,1);assert.equal(heroGait,'Walk','slow analog movement uses walk');drive(0,0,1);assert.equal(heroGait,'Idle');
hero.position.set(-20,0,6.14);drive(0,-1,3);assert.equal(heroGait,'Idle','blocked hero does not run in place');
for(const model of ['xrpman','mr_zamn']){const bytes=readFileSync(`public/assets/models/${model}.glb`),modelDoc=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));for(const clip of ['Idle','Walk','Run'])assert.ok(modelDoc.animations.some(a=>a.name===clip),`${model} carries ${clip}`);}
assert.ok(civic.tradeMedPack('sell').ok,'selling works after resting');
assert.ok(civic.installMeleeCapacitor().ok,'armory works after resting');
assert.equal(civic.installMeleeCapacitor().ok,false,'permanent upgrade cannot charge twice');
console.log(`civic-deck: OK — ${doc.meshes.length} batched surfaces, 9 physical service/district anchors, ownership and location-gated economy commits once, survives reload, respects cargo cap and cannot loop credits.`);

// Runtime vendor instances must be drawable, independently animated and released together.
globalThis.self=globalThis;globalThis.createImageBitmap=async()=>({width:1,height:1,close(){}});
const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');
const loadGltf=async id=>{const b=readFileSync(`public/assets/models/${id}.glb`);return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.length),'');};
const [vendorAsset,heroAsset]=await Promise.all([loadGltf('civic_vendor'),loadGltf('xrpman')]);
const {createCivicVendors}=await load('src/game/definitive/CivicVendors.ts');
const vendors=createCivicVendors(vendorAsset,heroAsset.animations);assert.equal(vendors.roots.length,2);
const meshes=vendors.roots.map(root=>{const out=[];root.traverse(o=>{if(o.isSkinnedMesh)out.push(o);});return out;});
assert.equal(meshes[0].length,3);assert.equal(meshes[1].length,3);
for(let i=0;i<3;i++){
 assert.equal(meshes[0][i].geometry,meshes[1][i].geometry,'instances share geometry');
 assert.notEqual(meshes[0][i].skeleton,meshes[1][i].skeleton,'instances own skeletons');
 for(const mesh of [meshes[0][i],meshes[1][i]])assert.ok(!Array.isArray(mesh.material)||mesh.geometry.groups.length>0,'material arrays need drawable geometry groups');
}
const {Box3}=await import('three');
for(const [i,root] of vendors.roots.entries()){
 vendors.mixers[i].update(.5);root.updateMatrixWorld(true);
 const box=new Box3().setFromObject(root);
 assert.ok(box.min.y>-.12&&box.max.y<2.2&&box.max.y>1.5,'vendor remains standing at deck level');
 assert.ok(box.max.x-box.min.x<1.5,'no limbs rotating around world origin');
}
const resources=new Set(),skeletons=new Set();let freed=0;
for(const root of vendors.roots)root.traverse(o=>{if(o.isMesh){resources.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])resources.add(m);if(o.skeleton)skeletons.add(o.skeleton);}});
for(const resource of resources)resource.addEventListener('dispose',()=>freed++);
const {Group}=await import('three');const group=new Group();group.add(...vendors.roots);
const {disposeObject}=await load('src/game/definitive/ModelAssets.ts');disposeObject(group);assert.equal(freed,resources.size,'shared vendor resources disposed once');
// Drive actual rendered shop button handlers through a minimal DOM.
class ShopElement{children=[];listeners={};disabled=false;textContent='';className='';append(...items){this.children.push(...items);}setAttribute(){}addEventListener(name,fn){this.listeners[name]=fn;}click(){if(!this.disabled)this.listeners.click?.({});}}
globalThis.document={createElement:()=>new ShopElement()};
const {createCivicShop}=await load('src/game/definitive/CivicShops.ts');
const shopSave=new CampaignSave(storage,'test:civic-shop-ui');shopSave.update(d=>{d.warshipOwned=true;d.credits=200;d.location={mode:'hub',world:'ledger_prime',checkpoint:'civic.quarters'};});
const shopQuest=new BoardingQuest(shopSave),panel=createCivicShop(shopQuest,'medical',()=>{});
const buttons=panel.children.filter(e=>e.listeners.click&&e.textContent!=='RETURN TO MARKET');assert.equal(buttons[1].disabled,true);
buttons[0].click();assert.equal(shopSave.snapshot.credits,165);assert.equal(buttons[1].disabled,false);
buttons[1].click();assert.equal(shopSave.snapshot.credits,183);assert.equal(buttons[1].disabled,true);
const armory=createCivicShop(shopQuest,'armory',()=>{}),install=armory.children.find(e=>e.listeners.click&&e.textContent!=='RETURN TO MARKET');install.click();assert.equal(shopSave.snapshot.credits,43);assert.equal(install.disabled,true);install.click();assert.equal(shopSave.snapshot.credits,43);
console.log('civic-vendors/shops: OK - independent skeletons, visible materials, standing animated bounds, shared-resource disposal, real shop button transactions.');

const {prepareCivicReview}=await load('src/game/definitive/BoardingQuest.ts');
const reviewBefore=shopSave.snapshot;
assert.ok(prepareCivicReview(shopSave).ok);
assert.deepEqual(shopSave.snapshot,reviewBefore,'Civic review reload must preserve earned balance, inventory and quarters');
for(const id of ['med_pack','melee_capacitor']){const entry=manifest.items[id];assert.ok(entry&&entry.bytes<=80000,'shop art encoded budget');assert.equal(readFileSync(`public${entry.src}`).length,entry.bytes);}

// Authored vendor positions and navigation share one source of truth.
for(const [i,v] of layout.vendors.entries()){
 assert.ok(civicBlocked(v.x,v.z),'vendor body blocks movement');
 assert.equal(vendors.roots[i].position.x,v.x);assert.equal(vendors.roots[i].position.z,v.z);
 const counter=layout.obstacles.filter(o=>o.name==='Service counter').sort((a,b)=>Math.hypot(v.x-a.x,v.z-a.z)-Math.hypot(v.x-b.x,v.z-b.z))[0];
 assert.ok(Math.hypot(v.x-counter.x,v.z-counter.z)<1.5,'vendor stands behind own counter');
}
const {CIVIC_ART}=await load('src/game/definitive/CivicArt.ts');
let artBytes=0;for(const [id] of CIVIC_ART){const e=manifest.civic_art[id];assert.ok(e,'every display enrolled');const b=readFileSync('public'+e.src);assert.equal(b.length,e.bytes);artBytes+=b.length;}
assert.ok(artBytes<300000,'Civic signage and posters fit 300KB encoded allowance');
assert.equal(CIVIC_ART.length,6,'six authored art surfaces');

const civicModelBytes=['xrpman','mr_zamn','civic_deck','civic_vendor'].reduce((n,id)=>n+manifest.models[id].bytes,0);
assert.ok(civicModelBytes+artBytes+900000<=12582912,'Civic models AND new artwork fit resident encoded ceiling');

const {createCivicService}=await load('src/game/definitive/CivicServices.ts');
const beforeBank=shopSave.snapshot;createCivicService(shopQuest,'bank',()=>{});assert.deepEqual(shopSave.snapshot,beforeBank,'account overview cannot move funds');
const quarters=createCivicService(shopQuest,'quarters',()=>{});quarters.children.find(e=>e.textContent==='REST & SAVE · FREE').click();
assert.equal(shopSave.snapshot.location.checkpoint,'civic.quarters');assert.equal(shopSave.snapshot.credits,beforeBank.credits,'rest is free');
const failedQuarters=createCivicService({save:shopSave,restAtQuarters:()=>({ok:false})},'quarters',()=>{});failedQuarters.children.find(e=>e.textContent==='REST & SAVE · FREE').click();assert.ok(failedQuarters.children.some(e=>e.textContent.startsWith('Save failed.')),'failed save never reports success');

let portraitBytes=0;for(const id of ['sera_vale_v1','ivo_rook_v1']){const entry=manifest.portraits[id];assert.ok(entry.bytes<60000,'compact shop portrait');assert.equal(readFileSync('public'+entry.src).length,entry.bytes);portraitBytes+=entry.bytes;}
assert.ok(civicModelBytes+artBytes+portraitBytes+manifest.items.med_pack.bytes+manifest.items.melee_capacitor.bytes+900000<=12582912,'Civic plus both shop inventories remains below encoded ceiling');
