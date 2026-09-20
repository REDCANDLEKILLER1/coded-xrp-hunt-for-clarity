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

/**
 * Companion locomotion in the Civic district.
 *
 * mr_zamn now ships Walk and Run, and BoardingScene picks between them with
 * companionGait. Civic did not: it chose Run above a single 2.4 m threshold and
 * Idle below it, so the companion had exactly two states and the Walk clip was
 * unreachable. Driven, that produced Idle/Run only across 260 frames.
 *
 * These drive the real CivicScene.update with a stub host, so the gait comes out
 * of production movement code rather than a re-implementation of it.
 */
const civicBundle=await build({entryPoints:['src/game/definitive/CivicScene.ts'],bundle:true,write:false,format:'esm',logLevel:'silent',loader:{'.css':'empty'}});
const stubNode=()=>({dataset:{},hidden:true,textContent:'',className:'',style:{},appendChild(){},append(){},addEventListener(){},removeEventListener(){},remove(){},querySelector:()=>null,getBoundingClientRect:()=>({left:0,top:0,width:390,height:844})});
globalThis.document={createElement:stubNode,body:stubNode()};
globalThis.window={addEventListener(){},removeEventListener(){},devicePixelRatio:3,innerWidth:390,innerHeight:844};
const {CivicScene}=await import(`data:text/javascript;base64,${Buffer.from(civicBundle.outputFiles[0].text).toString('base64')}`);
const {Vector3}=await import('three');

/** One driven frame with the hero parked `gap` metres ahead; returns the chosen clip. */
const gaitAtGap=gap=>{
  const hero={position:new Vector3(0,0,gap),rotation:{y:0}},crew={position:new Vector3(0,0,0),rotation:{y:0}};
  let chosen='';
  const rig={active:true,paused:false,age:0,noticeClock:0,cameraDistance:17,clip:'',crewClip:'',
    notice:stubNode(),ui:{querySelector:()=>null},input:{move:{x:0,y:0},clear(){}},
    host:{hero:{scene:hero,animations:[]},crew:{scene:crew,animations:[]},quest:{save:{snapshot:{credits:0,inventory:{}}}}},
    mixer:{update(){}},crewMixer:{update(){}},play(){},playCrew(name){chosen=name;},updateCamera(){},paint(){},say(){}};
  CivicScene.prototype.update.call(rig,1/60);
  return chosen;
};

const gaits=[0.5,1.5,2.4,2.5,2.7,3.0,3.9,4.0,6.0,10].map(gap=>({gap,clip:gaitAtGap(gap)}));
assert.equal(new Set(gaits.map(g=>g.clip)).size,3,`the Civic companion must use all three gaits, saw ${[...new Set(gaits.map(g=>g.clip))].join('/')}`);
for(const {gap,clip} of gaits){
  const expected=gap<=2.65?'Idle':gap<=3.9?'Walk':'Run';
  assert.equal(clip,expected,`companion at ${gap} m should be ${expected}, played ${clip}`);
}

// The companion must never run on the spot: standing still is Idle, at any distance
// inside the stop radius. This is the defect class, not one threshold.
for(const gap of [0,.1,1,2,2.4])assert.equal(gaitAtGap(gap),'Idle',`stationary companion at ${gap} m must be Idle`);

// A gait the crew model cannot play is a silent no-op at runtime, so require the clips to exist.
const crewDoc=(()=>{const b=readFileSync('public/assets/models/mr_zamn.glb');return JSON.parse(b.subarray(20,20+b.readUInt32LE(12)));})();
const crewClips=new Set(crewDoc.animations.map(clip=>clip.name));
for(const clip of new Set(gaits.map(g=>g.clip)))assert.ok(crewClips.has(clip),`CivicScene selects ${clip} but mr_zamn.glb has no such clip`);

// Negative control: re-resolve the same driven gaps through the pre-fix rule
// (binary Run above the stop distance) and require the band check to reject it.
// Mutates the rule under test, never the assertion.
const legacyGait=gap=>gap>2.4?'Run':'Idle';
assert.throws(()=>{for(const {gap} of gaits){const expected=gap<=2.65?'Idle':gap<=3.9?'Walk':'Run';assert.equal(legacyGait(gap),expected);}},
  'the band check must reject the single-threshold gait it replaced');

console.log(`civic-deck: OK — ${doc.meshes.length} batched surfaces, 9 physical service/district anchors, ownership and location-gated economy commits once, survives reload, respects cargo cap and cannot loop credits; companion gait Idle/Walk/Run driven through real CivicScene movement across ${gaits.length} distances, all clips present in mr_zamn.glb, negative control rejects the single-threshold rule.`);
