import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {readFileSync} from 'node:fs';

async function load(mutation){
 const built=await build({stdin:{contents:"export * from './src/game/definitive/BullionReach'; export * from './src/game/definitive/CampaignSave'; export * from './src/game/definitive/FreightConvoy'; export * from './src/game/definitive/ConvoyCheckpoint';",resolveDir:process.cwd()},bundle:true,write:false,format:'esm',logLevel:'silent',plugins:mutation?[{name:'failure-control',setup(b){b.onLoad({filter:/BullionReach\.ts$/},async args=>({contents:readFileSync(args.path,'utf8').replace(mutation[0],mutation[1]),loader:'ts'}));}}]:[]});
 return import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
}
function prove(m){
 const {CampaignSave:Save,FreightConvoy:Convoy,meetLex,chooseFreightLane,commitFreightBoundary,markMarketSiegeDown,parseDefinitiveSave,initialConvoyCheckpoint}=m;
 let fail=false;const records=new Map(),storage={getItem:k=>records.get(k)??null,setItem:(k,v)=>{if(fail)throw Error('quota');records.set(k,v);}};
 let save=new Save(storage,'test:bullion-contract');const absent=save.snapshot;delete absent.convoy;assert.equal(parseDefinitiveSave(JSON.stringify(absent)).convoy,null,'established saves migrate without losing progress');
 const fresh=new Convoy();assert.equal(meetLex(save,fresh,{x:-4,z:35},0).ok,false);
 save.update(d=>{d.warshipOwned=true;d.location={mode:'surface',world:'bullion_reach',checkpoint:'bullion_reach.landing'};d.quests.push('bullion_reach.landed');d.heroUpgrades.field_repair=1;d.heroUpgrades.spectral_reveal=1;d.fighterShipKey='ledger_warden';d.fighterUpgrades.pulse=3;d.capitalUpgrades.shield_module=1;d.credits=1700;d.recruits.push('mr_zamn','corn','boo');});
 let convoy=new Convoy();const start=save.snapshot;
 assert.equal(meetLex(save,convoy,{x:30,z:35},0).ok,false);assert.equal(meetLex(save,convoy,{x:-4,z:35},1).ok,false);
 fail=true;assert.equal(meetLex(save,convoy,{x:-4,z:35},0).ok,false);assert.deepEqual(save.snapshot,start);assert.deepEqual(convoy.checkpoint,initialConvoyCheckpoint());fail=false;
 assert.ok(meetLex(save,convoy,{x:-4,z:35},0).ok);assert.equal(meetLex(save,convoy,{x:-4,z:35},0).ok,false);
 const drive=()=>{for(let i=0;i<4000&&!convoy.waitingForCommit;i++)convoy.update(.1,convoy.poses[0],()=>false,save.snapshot.quests.includes('bullion_reach.siege_defeated'));assert.ok(convoy.waitingForCommit);};
 assert.equal(commitFreightBoundary(save,convoy,['apron']).ok,false,'cannot save a boundary before physical arrival');drive();
 const before=save.snapshot,positions=convoy.poses;fail=true;assert.equal(commitFreightBoundary(save,convoy,['apron']).ok,false);assert.deepEqual(save.snapshot,before);assert.deepEqual(convoy.poses,positions,'failed storage never advances vehicles');fail=false;
 assert.ok(commitFreightBoundary(save,convoy,['apron']).ok);save=new Save(storage,'test:bullion-contract');convoy=new Convoy(save.snapshot.convoy);assert.equal(convoy.stage,'junction_one');
 assert.equal(chooseFreightLane(save,convoy,'covered',{x:9,z:18}).ok,false);assert.ok(chooseFreightLane(save,convoy,'covered',{x:0,z:18}).ok);assert.equal(chooseFreightLane(save,convoy,'express',{x:0,z:18}).ok,false);
 // Damage after a safe choice is local to that leg. A wreck retries that exact
 // selected lane and saved hull, while rewards and previous sector clears stay.
 const safe=convoy.checkpoint;convoy.hit({x:-10,y:1,z:18},{x:10,y:1,z:18},400);assert.ok(convoy.failed);assert.equal(commitFreightBoundary(save,convoy,['covered']).ok,false);convoy=new Convoy(save.snapshot.convoy);assert.deepEqual(convoy.checkpoint,safe);
 drive();assert.equal(commitFreightBoundary(save,convoy,[]).ok,false);assert.ok(commitFreightBoundary(save,convoy,['covered']).ok);
 assert.ok(chooseFreightLane(save,convoy,'west',{x:0,z:-10}).ok);drive();assert.ok(commitFreightBoundary(save,convoy,['west']).ok);
 assert.equal(markMarketSiegeDown(save,convoy,false).ok,false);const preBoss=save.snapshot;fail=true;assert.equal(markMarketSiegeDown(save,convoy,true).ok,false);assert.deepEqual(save.snapshot,preBoss);fail=false;
 assert.ok(markMarketSiegeDown(save,convoy,true).ok);assert.equal(save.snapshot.credits,1700,'boss alone pays no undelivered reward');assert.equal(save.snapshot.recruits.includes('lex'),false);assert.equal(save.snapshot.quests.includes('bullion_reach.restored'),false);
 save=new Save(storage,'test:bullion-contract');convoy=new Convoy(save.snapshot.convoy);assert.equal(save.snapshot.quests.includes('bullion_reach.siege_defeated'),true,'boss clear survives reload with convoy state');
 drive();const preDelivery=save.snapshot,arrived=convoy.poses;fail=true;assert.equal(commitFreightBoundary(save,convoy,['siege']).ok,false);assert.deepEqual(save.snapshot,preDelivery);assert.deepEqual(convoy.poses,arrived);fail=false;
 assert.ok(commitFreightBoundary(save,convoy,['siege']).ok);assert.equal(save.snapshot.credits,2120);assert.ok(save.snapshot.recruits.includes('lex'));assert.ok(save.snapshot.earth.discoveredPlanets.includes('rugfall'));assert.ok(save.snapshot.earth.discoveredPlanets.includes('sec_outpost'));assert.equal(save.snapshot.fighterShipKey,'ledger_warden');assert.equal(save.snapshot.heroUpgrades.spectral_reveal,1);assert.equal(save.snapshot.fighterUpgrades.pulse,3);assert.equal(save.snapshot.capitalUpgrades.shield_module,1);
 assert.equal(commitFreightBoundary(save,convoy,['siege']).ok,false);save=new Save(storage,'test:bullion-contract');assert.equal(save.snapshot.credits,2120);assert.equal(new Set(save.snapshot.recruits).size,save.snapshot.recruits.length);
 const forged={...initialConvoyCheckpoint(),cleared:['apron','siege']};assert.equal(m.validConvoyCheckpoint(forged),false,'future clears cannot be smuggled into an apron checkpoint');
 const hostile=new Save(storage,'test:bullion-contract');hostile.update(d=>{d.credits+=1;});assert.equal(save.update(d=>{d.credits+=1;}).ok,false,'cross-tab conflicts retain the current record');
}
prove(await load());
const source=readFileSync('src/game/definitive/BullionReach.ts','utf8');
for(const [name,from,to] of [
 ['remote_choice','|| !nearFreight(at,junction)',''],
 ['early_recruit',"add(d.quests,'bullion_reach.siege_defeated');","add(d.quests,'bullion_reach.siege_defeated'); add(d.recruits,'lex');"],
 ['lost_branch',"add(d.earth.discoveredPlanets,'sec_outpost');",''],
 ['failed_commit_advance','if(result.ok)convoy.accept(candidate);return result;','convoy.accept(candidate);return result;'],
 ['reward_before_cargo',"d.location.checkpoint='bullion_reach.siege_clear';","d.location.checkpoint='bullion_reach.siege_clear'; d.credits+=420;"],
]){assert.ok(source.includes(from),name);let caught=false;try{prove(await load([from,to]));}catch{caught=true;}assert.ok(caught,name+' must be caught');}
console.log('Bullion progress foundation PASS: legacy migration, proximity/patrol gates, actual boundary arrival, storage failure/retry, lane reconstruction, local wreck recovery, boss/save/delivery separation, one atomic payoff, both branch discoveries and five caught failure controls.');
