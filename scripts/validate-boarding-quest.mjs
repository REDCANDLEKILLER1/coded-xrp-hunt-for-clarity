import assert from 'node:assert/strict';
import { build } from 'esbuild';
const load=async path=>{
  const result=await build({entryPoints:[path],bundle:true,write:false,format:'esm',logLevel:'silent'});
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
};
const {CampaignSave}=await load('src/game/definitive/CampaignSave.ts');
const {BoardingQuest}=await load('src/game/definitive/BoardingQuest.ts');
const {Dialogue,BOARDING_DIALOGUE}=await load('src/game/definitive/Dialogue.ts');
const {DECK,DECK_DOORS,canCross,roomAt,insideWallMargin}=await load('src/game/definitive/BoardingLayout.ts');
const {boardingObstacleBlocksMove,selectBoardingTarget,coreExposure,companionGait,companionPlan,boardingInteraction,canCrossExitField,boardingWeapon,boardingEnemyHealth,boardingEnemyVolley,boardingPressure,campaignHeroDamage}=await load('src/game/definitive/BoardingCombat.ts');
assert.equal(DECK.length,8);
for(const room of DECK){assert.equal(roomAt(room.x,room.z).id,room.id);assert.ok(insideWallMargin(room,room.x,room.z));}
for(const door of DECK_DOORS){
  assert.ok(canCross(door.a,door.b,door.x,door.z));assert.ok(canCross(door.b,door.a,door.x,door.z));
  assert.equal(canCross(door.a,door.b,door.x+(door.axis==='z'?3:0),door.z+(door.axis==='x'?3:0)),false,'solid jamb blocks passage');
}
assert.equal(canCross('hangar','core',0,0),false,'rooms cannot teleport through unrelated doors');
// Reproduce a jump landing inside the fighter nose from the rendered playtest.
const fighterCover=[{x:0,z:-28,w:1.85,d:8.8}];
const landed={x:.274,z:-23.650};
assert.equal(boardingObstacleBlocksMove(fighterCover,landed,{x:.274,z:-23.60}),false,'jump landing can walk out of the fighter nose');
assert.equal(boardingObstacleBlocksMove(fighterCover,landed,{x:.274,z:-23.70}),true,'overlap escape cannot move deeper into the fighter');
assert.equal(boardingObstacleBlocksMove(fighterCover,{x:1.3,z:-28},{x:1.2,z:-28}),true,'grounded approach still collides with the fighter');
assert.equal(boardingObstacleBlocksMove(fighterCover,{x:.274,z:-23.35},{x:.274,z:-23.25}),false,'last escape step can clear the collision boundary');
assert.equal(boardingObstacleBlocksMove(fighterCover,{x:.4,z:-24.33},{x:.4,z:-24.28}),false,'overlap can escape toward the nose even when the side is nearer');
const pillar=[{x:0,z:0,w:2,d:2}];
assert.equal(boardingObstacleBlocksMove(pillar,{x:0,z:0},{x:.1,z:0},.25),false,'companion can escape a centered placement overlap');
assert.equal(boardingObstacleBlocksMove(pillar,{x:1.3,z:0},{x:1.2,z:0},.25),true,'companion cannot enter solid cover');
const core={kind:'core',hp:650,x:1,z:0},relay={kind:'relay',hp:65,x:9,z:0};
assert.equal(selectBoardingTarget([core,relay],0,0),relay,'farther surviving relay wins over nearer shielded Core');
assert.equal(selectBoardingTarget([core,{...relay,hp:0}],0,0),core);
assert.equal(coreExposure(true,8),false);assert.equal(coreExposure(false,5),false);assert.equal(coreExposure(false,8),true);
assert.deepEqual(companionPlan(13,8,false),{warp:true,advance:true,fire:true});
assert.equal(companionPlan(2,8,true).fire,false,'companion cannot shoot through cover');
assert.equal(companionPlan(2,16,false).fire,false,'companion weapon range stays bounded');
assert.equal(boardingInteraction(2.4,.7,true),'terminal','nearby companion cannot intercept terminal interaction');
assert.equal(boardingInteraction(3,.7,true),'crew');
assert.equal(boardingInteraction(3,.7,false),'none');
assert.equal(canCrossExitField(35.5,36.5,36,false),false,'unshielded hero cannot cross exit field');
assert.equal(canCrossExitField(35.5,36.5,36,true),true,'active Ledger Shield permits crossing');
assert.equal(canCrossExitField(35.5,36.5,36,false,true),true,'captured green bridge stays accessible without Shield');
assert.equal(boardingWeapon(1).label,'ION SIDEARM');assert.equal(boardingWeapon(3).shots,3);assert.equal(boardingWeapon(99).level,4);assert.equal(boardingWeapon('3').level,3);assert.equal(boardingWeapon('corrupt').level,1);
assert.equal(companionGait(.2),'Idle');assert.equal(companionGait(1),'Walk');assert.equal(companionGait(2),'Run');
assert.equal(boardingEnemyHealth('captain'),520);assert.equal(boardingEnemyHealth('warden'),210);assert.equal(boardingEnemyVolley('captain',0).length,5);
assert.deepEqual(boardingPressure('security'),{attackers:4,cadence:.72});assert.deepEqual(boardingPressure('engineering'),{attackers:4,cadence:.8});assert.deepEqual(boardingPressure('bridge'),{attackers:3,cadence:1});
assert.ok(Math.abs(campaignHeroDamage(12,4)-19.8)<1e-9);
assert.equal(campaignHeroDamage(12,'corrupt'),12,'corrupt boarding weapon save falls back to base damage');
assert.ok(DECK.every(room=>room.enemies.length>=3),'every deck room has a combat encounter');
assert.ok(DECK.reduce((sum,room)=>sum+room.enemies.length,0)>=30,'boarding route has sustained enemy pressure');
const data=new Map(); let fail=false;
const storage={getItem:key=>data.get(key)??null,setItem:(key,value)=>{if(fail)throw new Error('quota');data.set(key,value);}};
let save=new CampaignSave(storage,'test:boarding'); let quest=new BoardingQuest(save);
assert.ok(quest.begin('xrpl_striker').ok);
assert.equal(save.snapshot.fighterShipKey,'xrpl_striker');
assert.ok(quest.lockReason('core'));
assert.equal(quest.complete('bridge_secured').ok,false);
assert.equal(quest.complete('hangar_safe').ok,false,'arrival-bay clear required');
assert.ok(quest.clear('hangar').ok);assert.ok(quest.complete('hangar_safe').ok);assert.equal(save.snapshot.heroUpgrades.boarding_weapon,2);
assert.ok(quest.enter('security').ok);
assert.equal(quest.complete('security_relay').ok,false,'enemy clear required');
assert.ok(quest.clear('security').ok); assert.ok(quest.complete('security_relay').ok);
assert.ok(quest.enter('rescue').ok);assert.equal(quest.complete('rescue_junction').ok,false,'hidden detention route and Engineering power required');
assert.ok(quest.clear('rescue').ok);assert.equal(quest.findHiddenRoute().ok,false,'hidden route has no power yet');
assert.ok(quest.enter('engineering').ok);assert.ok(quest.clear('engineering').ok);
assert.ok(quest.complete('engineering_power',BOARDING_DIALOGUE.engineering.id).ok);
assert.ok(quest.enter('rescue').ok);assert.ok(quest.findHiddenRoute().ok);assert.equal(save.snapshot.heroUpgrades.boarding_weapon,3);
const dialogue=new Dialogue();
let effects=0;
const finish=()=>{effects++;return quest.complete('rescue_junction',BOARDING_DIALOGUE.zamn.id).ok;};
dialogue.open(BOARDING_DIALOGUE.zamn,finish);
dialogue.press(); assert.equal(dialogue.text,'','opening combat edge ignored');
dialogue.update(.2); dialogue.press(); assert.equal(dialogue.text,dialogue.fullText,'first press reveals');
assert.equal(dialogue.page,'1 / 4'); dialogue.press(); assert.equal(dialogue.page,'2 / 4');
dialogue.closeWithoutEffects(); assert.equal(effects,0); assert.equal(quest.has('rescue_junction'),false);
// Reload midway through the introduction cannot silently grant or lose its effect.
save=new CampaignSave(storage,'test:boarding'); quest=new BoardingQuest(save);
assert.equal(quest.checkpoint,'rescue'); assert.ok(quest.isClear('security'));
dialogue.open(BOARDING_DIALOGUE.zamn,finish); dialogue.update(.2);
const before=save.snapshot; fail=true; dialogue.skip();
assert.ok(dialogue.active && dialogue.failed); assert.deepEqual(save.snapshot,before);
fail=false; dialogue.skip(); assert.equal(dialogue.active,false);
assert.ok(quest.has('rescue_junction')); assert.ok(save.snapshot.dialogueSeen.includes(BOARDING_DIALOGUE.zamn.id));
assert.equal(quest.cache().ok,false,'shield cache stays optional and ability-gated');
assert.ok(quest.clear('cache').ok);
assert.ok(quest.enter('command').ok); assert.equal(quest.complete('command_access').ok,false,'command clear required');
assert.ok(quest.clear('command').ok); assert.ok(quest.complete('command_access').ok);
assert.ok(quest.enter('core').ok); assert.equal(quest.complete('core_defeated').ok,false);
const beforeCore=save.snapshot;fail=true;assert.equal(quest.defeatCore().ok,false);assert.deepEqual(save.snapshot,beforeCore);fail=false;
assert.ok(quest.defeatCore().ok);assert.ok(quest.isClear('core'));
assert.equal(save.snapshot.heroUpgrades.ledger_shield,1);assert.equal(save.snapshot.heroUpgrades.boarding_weapon,4); assert.equal(save.snapshot.warshipOwned,false);
assert.ok(quest.enter('bridge').ok);assert.equal(quest.complete('bridge_secured').ok,false,'bridge clear required');
assert.ok(quest.clear('bridge').ok);assert.ok(quest.complete('bridge_secured',BOARDING_DIALOGUE.secured.id).ok);
assert.equal(save.snapshot.credits,300); assert.equal(save.snapshot.warshipOwned,true);
assert.deepEqual(save.snapshot.recruits,['mr_zamn']); assert.equal(save.snapshot.fighterShipKey,'xrpl_striker');
assert.equal(quest.complete('bridge_secured').ok,false); assert.equal(save.snapshot.credits,300);
assert.ok(quest.purchase('repair').ok); assert.ok(quest.purchase('shield_module').ok);
assert.equal(save.snapshot.credits,100); assert.equal(quest.purchase('repair').ok,false);
assert.ok(quest.cache().ok); assert.equal(save.snapshot.credits,200); assert.equal(quest.cache().ok,false);
assert.ok(quest.complete('departure_ready',BOARDING_DIALOGUE.outbound.id).ok); assert.equal(quest.step,null);
save=new CampaignSave(storage,'test:boarding'); quest=new BoardingQuest(save);
assert.ok(quest.has('departure_ready')); assert.equal(save.snapshot.credits,200);
assert.ok(quest.begin('player').ok); assert.equal(save.snapshot.fighterShipKey,'xrpl_striker');
// Earth comms follow real mission acts and have no gameplay grants. A failed
// receipt keeps the conversation open; a reload replays only unfinished comms.
const {EARTH_STORY,CITY_RESTORATION,earthStoryFor}=await load('src/game/content/EarthStory.ts');
const {EARTH_LEDGER_PRIME_MISSION:earth}=await load('src/game/content/missions/ledgerPrime.ts');
const earthSave=new CampaignSave(storage,'test:earth-story');
assert.equal(earthStoryFor(null,[]),null);assert.equal(earthStoryFor('not-an-act',[]),null);
assert.equal(new Set(Object.values(EARTH_STORY).map(s=>s.id)).size,7);
for(const [act,scene]of Object.entries(EARTH_STORY)){
  assert.ok(earth.acts.some(a=>a.key===act));
  assert.equal(earthStoryFor(act,earthSave.snapshot.dialogueSeen),scene);
  const pending=earthSave.snapshot;
  const commit=()=>earthSave.update(d=>{if(!d.dialogueSeen.includes(scene.id))d.dialogueSeen.push(scene.id);}).ok;
  dialogue.open(scene,commit);dialogue.update(.2);dialogue.closeWithoutEffects();
  assert.deepEqual(earthSave.snapshot,pending,'interrupted comms grant nothing');
  dialogue.open(scene,commit);dialogue.update(.2);fail=true;dialogue.skip();
  assert.ok(dialogue.active&&dialogue.failed);assert.deepEqual(earthSave.snapshot,pending);
  fail=false;dialogue.skip();assert.equal(dialogue.active,false);
  const reloaded=new CampaignSave(storage,'test:earth-story');
  assert.equal(earthStoryFor(act,reloaded.snapshot.dialogueSeen),null);
  assert.equal(reloaded.snapshot.dialogueSeen.filter(id=>id===scene.id).length,1);
  assert.equal(reloaded.snapshot.credits,0);assert.equal(reloaded.snapshot.warshipOwned,false);
}
for(const scene of [EARTH_STORY.regulatory_behemoth,EARTH_STORY.clarity_destroyer,EARTH_STORY.gary_fog]){
  dialogue.open(scene,()=>true);assert.equal(dialogue.allegiance,'hostile');
  dialogue.update(10);dialogue.press();assert.equal(dialogue.allegiance,'friendly');dialogue.closeWithoutEffects();
}
const replayBefore=earthSave.snapshot;
dialogue.open({id:'log.earth',lines:Object.values(EARTH_STORY).flatMap(s=>s.lines)},()=>true);
dialogue.update(.2);dialogue.skip();assert.deepEqual(earthSave.snapshot,replayBefore);
const restore=()=>earthSave.update(d=>{if(!d.dialogueSeen.includes(CITY_RESTORATION.id))d.dialogueSeen.push(CITY_RESTORATION.id);if(!d.quests.includes('earth.district_restored'))d.quests.push('earth.district_restored');}).ok;
dialogue.open(CITY_RESTORATION,restore);dialogue.update(.2);fail=true;dialogue.skip();
assert.deepEqual(earthSave.snapshot,replayBefore,'failed restoration receipt cannot partly commit the district');
fail=false;dialogue.skip();assert.ok(earthSave.snapshot.quests.includes('earth.district_restored'));
const restored=earthSave.snapshot;assert.ok(restore());assert.deepEqual(earthSave.snapshot,restored,'restoration replay is idempotent');
console.log('boarding-quest: OK — ordered capture, atomic rewards, failed-save retries, Earth act comms/receipts/replay, hostile speakers and preserved progression.');

// Drive the real retry button: the old room-center spawn was inside the parked fighter.
const {BoardingScene}=await load('src/game/definitive/BoardingScene.ts');
const {Vector3,Object3D}=await import('three');
const previousDocument=globalThis.document;
let retryClick;
globalThis.document={createElement:()=>({append(){},appendChild(){},remove(){},addEventListener(type,callback){if(type==='click')retryClick=callback;}})};
try{
  const fighter=new Object3D(),exit=new Object3D();exit.name='Pilot_Exit';exit.position.set(1.7,0,-25.5);fighter.add(exit);fighter.updateMatrixWorld(true);
  let respawned=false,inputCleared=false;
  const retry={room:'hangar',scene:{remove(){}},enemies:[],bolts:[],hero:{position:new Vector3(0,1,-28)},host:{fighter:{scene:fighter}},ui:{appendChild(){}},verticalVelocity:4,dodgeClock:.2,meleeClock:.1,spawnRoom(room){respawned=room==='hangar';},clearInput(){inputCleared=true;}};
  BoardingScene.prototype.retryPanel.call(retry);retryClick();
  assert.deepEqual(retry.hero.position.toArray(),[1.7,0,-25.5],'retry uses the original fighter exit rather than an obstructed room center');
  assert.ok(respawned&&inputCleared);assert.equal(retry.life,100);assert.equal(retry.dead,false);
  assert.equal(retry.verticalVelocity,0);assert.equal(retry.dodgeClock,0);assert.equal(retry.meleeClock,0);
}finally{globalThis.document=previousDocument;}
console.log('boarding retry: original fighter exit restored, stale jump/dodge/melee cleared.');
