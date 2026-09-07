import assert from 'node:assert/strict';
import {build} from 'esbuild';

const store=new Map();let fail=false;
const storage={getItem:key=>store.get(key)??null,setItem:(key,value)=>{if(fail)throw Error('quota');store.set(key,value);},removeItem:key=>store.delete(key)};
const ctx=new Proxy({},{get:(t,k)=>k in t?t[k]:k==='measureText'?()=>({width:10}):['createLinearGradient','createRadialGradient'].includes(k)?()=>({addColorStop(){}}):()=>{},set:(t,k,v)=>{t[k]=v;return true;}});
class Element {
  children=[];events={};style={};dataset={};hidden=false;disabled=false;width=0;height=0;textContent='';
  append(...items){this.children.push(...items);}appendChild(item){this.append(item);return item;}replaceChildren(...items){this.children=items;}
  setAttribute(){}addEventListener(type,fn){(this.events[type]??=[]).push(fn);}removeEventListener(){}
  click(){if(!this.disabled)for(const fn of this.events.click??[])fn({});}
  getContext(){return ctx;}getBoundingClientRect(){return{left:0,top:0,width:innerWidth,height:innerHeight};}setPointerCapture(){}releasePointerCapture(){}
}
globalThis.localStorage=storage;globalThis.Image=class{};globalThis.requestAnimationFrame=()=>0;globalThis.cancelAnimationFrame=()=>{};
globalThis.CustomEvent=class{constructor(type,init){this.type=type;this.detail=init?.detail;}};
globalThis.matchMedia=()=>({matches:false,addEventListener(){}});globalThis.screen={width:390,height:844,orientation:{angle:0}};
globalThis.innerWidth=390;globalThis.innerHeight=844;globalThis.devicePixelRatio=1;
globalThis.document={addEventListener(){},removeEventListener(){},querySelector:()=>null,createElement:()=>new Element(),body:new Element()};
globalThis.window={addEventListener(){},removeEventListener(){},dispatchEvent:()=>true,setTimeout,clearTimeout,localStorage:storage,devicePixelRatio:1,innerWidth:390,innerHeight:844};
globalThis.location={search:'',pathname:'/'};
const load=async path=>{const result=await build({entryPoints:[path],bundle:true,write:false,format:'esm',logLevel:'silent'});return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);};
const {Game2A}=await load('src/game/core/Game2A.ts');
const {CampaignSave}=await load('src/game/definitive/CampaignSave.ts');
const {FighterArmoryRuntime}=await load('src/game/ui/FighterArmoryRuntime.ts');
const {FAMILY_INFO,FIGHTER_FAMILIES,fighterWeapon,RAPID_CAP}=await load('src/game/content/FighterWeapons.ts');
const {ENEMIES}=await load('src/game/content/registry.ts');
const {groundDefense}=await load('src/game/content/GroundDefense.ts');
let serial=0;
function fixture(){
  const save=new CampaignSave(storage,`test:armory-${++serial}`),parent=new Element(),armory=new FighterArmoryRuntime(parent,save),g=new Game2A(new Element());
  g.setFighterArmory(armory);g.deployFromMap('ledger_prime','EARTH');g.reset(undefined,{fresh:true});g.launchClock=0;g.player={x:195,y:710,w:24,h:28,vx:0,vy:0,hp:100};g.playerFacing=-Math.PI/2;
  return{g,save,armory,parent};
}
function equip(f,family,stage,rapid=0){const rank=FAMILY_INFO[family].unlock+stage-1;assert.ok(f.save.update(d=>{d.fighterUpgrades={weapon_rank:rank,weapon_family:FIGHTER_FAMILIES.indexOf(family),rapid_fire:rapid};}).ok);f.g.xpLevel=rank;f.g.fighterReady=true;f.g.boltClock=0;f.g.bolts=[];f.g.upgradeOffer=[];f.g.pendingUpgrades=0;}
const drone=(x=195,y=400,hp=100)=>({x,y,w:15,h:24,vx:0,vy:0,hp,enemyKey:'regulator_drone',age:0,anchorX:x,phase:0,direction:1,fireClock:10,stance:'holding',stationX:x,stationY:y,stanceClock:0,patience:10,dodgeCooldown:0,atRest:true,escort:false});
const hazard=(key,x,y,role,group='one')=>({x,y,w:30,h:30,vx:0,vy:0,hp:100,hazardKey:key,fireClock:0,side:1,ground:groundDefense(key,group,0)});

// The shipping update/collision paths determine centered-target kill time,
// not a copy of the weapon formula. Test two widths/heights, all 20 stages,
// every rapid rank, and several hull strengths rather than only nominal DPS.
const results=[];
for(const [width,height]of [[390,844],[844,390]]){
  globalThis.innerWidth=width;globalThis.innerHeight=height;
  for(const family of FIGHTER_FAMILIES){
    let prior=null;
    for(let stage=1;stage<=4;stage++){
      const times=[];
      for(const hp of [2,16,60]){
        const f=fixture();equip(f,family,stage);f.g.player.x=width/2;f.g.player.y=height-65;
        const target=drone(width/2,Math.max(60,height-265),hp);target.w=Math.min(...Object.values(ENEMIES).map(e=>e.hitbox.w));f.g.drones=[target];
        let t=0;for(;t<16&&target.hp>0;t+=1/240){f.g.updateBolts(1/240);f.g.collisions();}
        assert.ok(target.hp<=0,`${family}${stage} cannot kill centered ${hp}HP target at ${width}`);times.push(t);
      }
      if(prior)times.forEach((t,i)=>assert.ok(t<=prior[i]+1/240+.0001,`${family}${stage} regresses ${width}px centered TTK: ${prior[i]} -> ${t}`));
      prior=times;results.push({width,family,stage,times:times.map(t=>+t.toFixed(3))});
      let previousCount=0;
      for(let rapid=0;rapid<=RAPID_CAP;rapid++){
        const f=fixture();equip(f,family,stage,rapid);f.g.player.x=width/2;f.g.player.y=height-65;
        const profile=f.armory.weapon;let count=0;let first;
        for(let i=0;i<480;i++){f.g.bolts=[];f.g.updateBolts(1/240);count+=f.g.bolts.length;if(!first&&f.g.bolts.length)first=f.g.bolts[0];}
        assert.ok(count>=previousCount,`${family}${stage} rapid ${rapid} lowers actual frequency`);previousCount=count;
        assert.equal(first.damage,fighterWeapon({family,rank:FAMILY_INFO[family].unlock+stage-1,rapid:0}).damage);
        assert.ok(Math.abs(Math.hypot(first.vx,first.vy)-profile.speed)<1e-6,'actual projectile speed retained');
        assert.equal(f.g.currentVolley().length,profile.shots.length,'legacy barrel pairs cannot inflate new family');
      }
    }
  }
}
globalThis.innerWidth=390;globalThis.innerHeight=844;
// Cadence remains useful at phone-like frame rates; retain fractional firing
// time instead of rounding every interval up to the next rendered frame.
for(const fps of [30,60])for(const family of FIGHTER_FAMILIES){
  let previous=0;
  for(let rapid=0;rapid<=RAPID_CAP;rapid++){
    const f=fixture();equip(f,family,4,rapid);let volleys=0;
    for(let tick=0;tick<fps*12;tick++){f.g.bolts=[];f.g.updateBolts(1/fps);if(f.g.bolts.length)volleys++;}
    assert.ok(volleys>previous,`${family} rapid ${rapid} must increase real ${fps}FPS cadence`);previous=volleys;
    const expected=12/f.armory.weapon.fireRate;assert.ok(Math.abs(volleys-expected)<=1.1,`${family} cadence drift at ${fps}FPS`);
  }
  let previousTtk=Infinity;
  for(let stage=1;stage<=4;stage++){
    const f=fixture();equip(f,family,stage);const targets=[drone(170,400,16),drone(195,400,16),drone(220,400,16)];f.g.drones=targets;
    let t=0;for(;t<25&&targets.some(d=>d.hp>0);t+=1/fps){f.g.player.x=targets.find(d=>d.hp>0).x;f.g.updateBolts(1/fps);f.g.collisions();}
    assert.ok(targets.every(d=>d.hp<=0),'authored three-target group is killable');assert.ok(t<=previousTtk+2/fps,`${family}${stage} group TTK regresses at ${fps}FPS: ${previousTtk.toFixed(3)} -> ${t.toFixed(3)}`);previousTtk=t;
  }
}
for(const family of FIGHTER_FAMILIES)for(let stage=1;stage<=4;stage++)for(let angle=-Math.PI;angle<Math.PI;angle+=Math.PI/4){
  const f=fixture();equip(f,family,stage);f.g.playerFacing=angle;f.g.updateBolts(0);
  for(const [i,bolt]of f.g.bolts.entries()){
    assert.ok(Math.abs(bolt.vx-Math.cos(angle)*f.armory.weapon.speed)<1e-6);assert.ok(Math.abs(bolt.vy-Math.sin(angle)*f.armory.weapon.speed)<1e-6);
    const offset=f.armory.weapon.shots[i].offsetX,heading=angle+Math.PI/2;
    assert.ok(Math.abs(bolt.x-f.g.player.x-offset*Math.cos(heading)-24*Math.sin(heading))<1e-6);
    assert.ok(Math.abs(bolt.y-f.g.player.y-offset*Math.sin(heading)+24*Math.cos(heading))<1e-6);
  }
}
// A lance overlapped on repeated frames hits each actor only once; IV
// penetrates five targets total and then retires, including the direct one.
{
  const f=fixture();equip(f,'pulse',4);f.g.updateBolts(0);const bolt=f.g.bolts[0];f.g.bolts=[bolt];bolt.x=195;bolt.y=400;
  const target=drone();f.g.drones=[target];for(let i=0;i<8;i++)f.g.collisions();assert.equal(target.hp,94);
  for(let i=0;i<4;i++){const next=drone();f.g.drones=[next];f.g.collisions();assert.equal(next.hp,94);}
  assert.equal(f.g.bolts.length,0,'pierce budget really expires');
}
for(const family of ['rocket','plasma','ledger']){
  const f=fixture();equip(f,family,4);f.g.updateBolts(0);const bolt=f.g.bolts[0];f.g.bolts=[bolt];bolt.x=195;bolt.y=400;
  const direct=drone(),near=drone(220),far=drone(375);f.g.drones=[direct,near,far];f.g.collisions();
  assert.equal(direct.hp,100-bolt.damage);assert.ok(near.hp<100,`${family} secondary effect actually damages a neighbor`);assert.equal(far.hp,100,`${family} cannot hit outside its radius`);
  assert.ok(f.g.weaponEffects.length>0);f.g.updateDebris(1);assert.equal(f.g.weaponEffects.length,0,'effects expire');
}
{
  const f=fixture();equip(f,'ledger',4);f.g.updateBolts(0);const bolt=f.g.bolts[0];f.g.bolts=[bolt];bolt.x=150;bolt.y=250;
  f.g.drones=[0,1,2,3,4,5].map(i=>drone(150+i*25,250));f.g.collisions();assert.equal(f.g.drones.filter(d=>d.hp<100).length,4,'arc has exactly three secondary hops');
}
// Shields and friendly systems remain authoritative for all area families.
for(const family of ['rocket','plasma','ledger']){
  const f=fixture();equip(f,family,4);f.g.updateBolts(0);const bolt=f.g.bolts[0];f.g.bolts=[bolt];bolt.x=195;bolt.y=400;
  const direct=drone(),relay=hazard('shield_relay',245,400),gun=hazard('basic_turret',220,400),beacon=hazard('clarity_beacon',215,400);
  assert.equal(relay.ground?.role,'relay');assert.equal(beacon.ground?.role,'beacon');f.g.drones=[direct];f.g.hazards=[relay,gun,beacon];f.g.collisions();
  assert.equal(beacon.hp,100,'friendly immunity');assert.equal(gun.hp,100,'linked shield immunity');
}
// Actual panel selection, persistence failure and reload. Hero/capital state
// is seeded only in this isolated test to detect accidental cross-track writes.
{
  const f=fixture();f.save.update(d=>{d.heroUpgrades={ledger_shield:1};d.capitalUpgrades={shield_module:1};});
  const before=f.save.snapshot;f.armory.update(true);const root=f.parent.children[0];root.children[0].click();assert.ok(f.armory.active);
  const panel=root.children[1];panel.children[3].click();assert.equal(f.armory.state.family,'bb','locked pulse button cannot equip');
  f.armory.rankUp(13);panel.children[6].click();assert.equal(f.armory.state.family,'ledger');assert.ok(f.armory.active);
  fail=true;const saved=f.save.snapshot;panel.children[4].click();assert.deepEqual(f.save.snapshot,saved,'failed equip atomic');assert.equal(f.armory.state.family,'ledger');fail=false;
  panel.children[4].click();assert.equal(f.armory.state.family,'rocket');f.armory.update(false);assert.equal(f.armory.active,false);
  const state=f.save.snapshot;panel.children[5].click();assert.deepEqual(f.save.snapshot,state,'unsafe stale DOM cannot equip');
  assert.deepEqual(state.heroUpgrades,before.heroUpgrades);assert.deepEqual(state.capitalUpgrades,before.capitalUpgrades);
  const reloaded=new FighterArmoryRuntime(new Element(),new CampaignSave(storage,f.save.key.split(':').slice(1).join(':')));assert.equal(reloaded.state.family,'rocket');assert.equal(reloaded.state.rank,13);
  for(let i=0;i<4;i++)assert.ok(f.armory.upgradeRapid());const capped=f.save.snapshot;assert.equal(f.armory.upgradeRapid(),false);assert.deepEqual(f.save.snapshot,capped);
  // A failed rank receipt retains the equipped gun, then the real frame loop retries.
  f.g.xpLevel=14;fail=true;f.g.syncFighterMastery();assert.equal(f.g.currentWeapon().family,'rocket');assert.equal(f.armory.state.rank,13);fail=false;
  f.g.paused=true;f.g.frame(2.1);assert.equal(f.armory.state.rank,14);
}
{
  const f=fixture();f.g.pendingUpgrades=1;f.g.upgradeOffer=['barrel'];const before=f.save.snapshot;
  fail=true;f.g.applyUpgrade('barrel');assert.equal(f.g.pendingUpgrades,1);assert.deepEqual(f.save.snapshot,before);assert.deepEqual(f.g.upgradeOffer,['barrel']);fail=false;
  f.g.applyUpgrade('barrel');assert.equal(f.g.pendingUpgrades,0);assert.equal(f.armory.state.rapid,1);assert.deepEqual(f.g.upgradeOffer,[]);
  f.g.bombs=f.g.maxBombs();const gun=f.g.currentWeapon();f.g.applyPickup('bomb');assert.deepEqual(f.g.currentWeapon(),gun,'full bomb rack cannot change the primary');
  f.g.shieldMax=6;f.g.bombPower=20;f.g.pulsePower=20;for(let i=0;i<3;i++)f.armory.upgradeRapid();f.g.pendingUpgrades=2;const score=f.g.score;f.g.openUpgradeChoice();assert.equal(f.g.pendingUpgrades,0);assert.deepEqual(f.g.upgradeOffer,[]);assert.equal(f.g.score,score+500,'maxed ranks bank once without trapping player');
}
// Shipping frame acquires/releases input without ticking live combat while
// the loadout is open, and map/arcade transitions relinquish the panel.
{
  const f=fixture();f.g.paused=true;f.g.frame(.01);f.parent.children[0].children[0].click();
  let updates=0;const update=f.g.update.bind(f.g);f.g.update=dt=>{updates++;update(dt);};f.g.frame(.1);assert.equal(updates,0);assert.equal(f.g.storyCapturedInput,true);
  f.parent.children[0].children[1].children.at(-1).click();f.g.frame(.1);assert.equal(updates,1);assert.equal(f.g.storyCapturedInput,false);
  f.parent.children[0].children[0].click();f.g.suspend();assert.equal(f.armory.active,false);assert.ok(f.parent.children[0].hidden);
  f.g.deployTestMode();f.g.reset();assert.equal(f.g.currentWeapon().key.startsWith('fighter.'),false,'arcade keeps original behavior');
}
// Every legacy tier/barrel combination retains at least its old centered DPS
// on migration, and never destroys or edits the stored legacy checkpoint.
for(let baseTier=1;baseTier<=5;baseTier++)for(let rank=1;rank<=13;rank++)for(let barrels=0;barrels<=3;barrels++){
  const legacy=new Game2A(new Element());legacy.deployTestMode();legacy.reset();legacy.xpLevel=rank;legacy.barrels=barrels;legacy.baseWeaponTier=baseTier;const oldDps=legacy.playerDps();
  legacy.pendingUpgrades=1;legacy.applyUpgrade('barrel');assert.equal(legacy.barrels,Math.min(3,barrels+1),'actual legacy card retains barrel behavior');
  const save=new CampaignSave(storage,`test:migrate-${baseTier}-${rank}-${barrels}`),armory=new FighterArmoryRuntime(new Element(),save);assert.ok(armory.begin(rank,barrels,baseTier));
  assert.ok(armory.weapon.damage*armory.weapon.shots.length/armory.weapon.fireRate>=oldDps-1e-6,`migration regresses rank ${rank}/barrels ${barrels}`);
}
console.log('fighter-armory: OK — 20 stages, two viewports, centered TTK, actual rapid cadence, damage/speed, bounded impacts, shield/friendly gates, safe selection, migration and separate durable tracks.');
console.log(JSON.stringify(results));
