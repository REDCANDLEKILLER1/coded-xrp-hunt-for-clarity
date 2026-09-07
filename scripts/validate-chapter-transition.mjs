import assert from 'node:assert/strict';import{build}from'esbuild';
const load=async path=>{const r=await build({entryPoints:[path],bundle:true,write:false,format:'esm',logLevel:'silent'});return import(`data:text/javascript;base64,${Buffer.from(r.outputFiles[0].text).toString('base64')}`);};
const{CampaignSave}=await load('src/game/definitive/CampaignSave.ts');const{enterWarship,savedChapterScene}=await load('src/game/definitive/ChapterTransitions.ts');const{dockFighter}=await load('src/game/definitive/LandingPlan.ts');
const data=new Map();let fail=false;const storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>{if(fail)throw Error('quota');data.set(k,v);}};
for(const fighterShipKey of['player','xrpl_striker','ledger_warden']){
 let save=new CampaignSave(storage,`test:chapter:${fighterShipKey}`);assert.equal(savedChapterScene(save),'earth');
 assert.equal(enterWarship(save,{planetKey:'mars',checkpointKey:'earth.boarding_lock',fighterShipKey}).ok,false);
 fail=true;assert.equal(enterWarship(save,{planetKey:'ledger_prime',checkpointKey:'earth.boarding_lock',fighterShipKey}).ok,false);assert.equal(savedChapterScene(save),'earth');fail=false;
 assert.ok(enterWarship(save,{planetKey:'ledger_prime',checkpointKey:'earth.boarding_lock',fighterShipKey}).ok);assert.equal(savedChapterScene(save),'landing');assert.equal(save.snapshot.fighterShipKey,fighterShipKey);
 const revision=save.snapshot.revision;assert.ok(enterWarship(save,{planetKey:'ledger_prime',checkpointKey:'earth.boarding_lock',fighterShipKey:'player'}).ok);assert.equal(save.snapshot.revision,revision,'repeated aperture event cannot replace selected fighter');
 save=new CampaignSave(storage,`test:chapter:${fighterShipKey}`);assert.equal(savedChapterScene(save),'landing');assert.ok(dockFighter(save).ok);assert.equal(savedChapterScene(save),'boarding');
 save.update(d=>{d.warshipOwned=true;d.location.mode='hub';});assert.equal(savedChapterScene(save),'boarding');
}
assert.ok(!data.has('coded-xrp-definitive-v1:campaign'));
console.log('chapter-transition: OK — real-entry contract, all three selected fighters, interrupted load/retry, idempotent entry, arrival/boarding/hub reload selection and isolated saves.');
