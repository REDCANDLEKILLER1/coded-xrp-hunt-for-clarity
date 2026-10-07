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
const {FAMILY_INFO,FIGHTER_FAMILIES,fighterWeapon,fighterTwinSeekers,nextFighterFamily,TWIN_SEEKER_INTERVAL,TWIN_SEEKER_MAX_ACTIVE,RAPID_CAP}=await load('src/game/content/FighterWeapons.ts');
const {ENEMIES,PROJECTILES,PICKUPS,HAZARDS}=await load('src/game/content/registry.ts');
const {EARTH_ENEMIES}=await load('src/game/content/EarthThreats.ts');
const narrowestEnemy=Math.min(...[...Object.values(ENEMIES),...Object.values(EARTH_ENEMIES)].map(def=>def.hitbox.w));
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
//
// Both sides are measured ON TARGET. Raw volley dps stopped being comparable
// once the arcade ladder went wide: eleven lanes at 12px spacing read 244 raw
// dps while 66.7 of it lands on one enemy, so a raw comparison would demand
// the armory beat damage that is flying past the target on both sides.
for(let baseTier=1;baseTier<=5;baseTier++)for(let rank=1;rank<=13;rank++)for(let barrels=0;barrels<=3;barrels++){
  const legacy=new Game2A(new Element());legacy.deployTestMode();legacy.reset();legacy.xpLevel=rank;legacy.barrels=barrels;legacy.baseWeaponTier=baseTier;const oldDps=legacy.centredDps();
  legacy.pendingUpgrades=1;legacy.applyUpgrade('barrel');assert.equal(legacy.barrels,Math.min(3,barrels+1),'actual legacy card retains barrel behavior');
  const save=new CampaignSave(storage,`test:migrate-${baseTier}-${rank}-${barrels}`),armory=new FighterArmoryRuntime(new Element(),save);assert.ok(armory.begin(rank,barrels,baseTier,oldDps));
  const reach=narrowestEnemy/2+(PROJECTILES[armory.weapon.projectileKey]?.hitbox.w??5)/2;
  const newDps=armory.weapon.shots.filter(shot=>Math.abs(shot.offsetX)<=reach).length*armory.weapon.damage/armory.weapon.fireRate;
  assert.ok(newDps>=oldDps-1e-6,`migration regresses rank ${rank}/barrels ${barrels}: ${oldDps.toFixed(1)} -> ${newDps.toFixed(1)} dps on target`);
}
console.log('fighter-armory: OK — 20 stages, two viewports, centered TTK, actual rapid cadence, damage/speed, bounded impacts, shield/friendly gates, safe selection, migration and separate durable tracks.');
console.log(JSON.stringify(results));

// New family cards must spend one receipt, retain earned output, and survive reload.
{
  const f=fixture();equip(f,'bb',4,2);f.g.pendingUpgrades=1;f.g.openUpgradeChoice();
  assert.equal(f.g.upgradeOffer[0],'weapon','earned family is visible on the upgrade screen');
  const before=f.armory.weapon.damage*f.armory.weapon.shots.length/f.armory.weapon.fireRate;
  const saved=f.save.snapshot;fail=true;f.g.applyUpgrade('weapon');fail=false;
  assert.deepEqual(f.save.snapshot,saved);assert.equal(f.g.pendingUpgrades,1,'failed weapon save cannot spend the choice');
  f.g.applyUpgrade('weapon');assert.equal(f.g.pendingUpgrades,0);assert.equal(f.armory.state.family,'pulse');assert.equal(f.armory.state.rapid,2);
  const after=f.armory.weapon.damage*f.armory.weapon.shots.length/f.armory.weapon.fireRate;
  assert.ok(after>=before&&after<=before*1.14+1e-8,'weapon promotion preserves earned DPS with at most one 14% power tier');
  const reloaded=new FighterArmoryRuntime(new Element(),new CampaignSave(storage,f.save.key.split(':').slice(1).join(':')));
  assert.deepEqual(reloaded.state,f.armory.state,'weapon style, power tier, and rapid rank persist together');
  assert.equal(nextFighterFamily({family:'bb',rank:3,rapid:0}),null,'mastery gates remain intact');
  f.armory.rankUp(20);
  for(const family of ['rocket','plasma','ledger']){
    const prior=f.armory.weapon.damage*f.armory.weapon.shots.length/f.armory.weapon.fireRate;
    assert.ok(f.armory.upgradeWeapon());assert.equal(f.armory.state.family,family);
    assert.ok(f.armory.weapon.damage*f.armory.weapon.shots.length/f.armory.weapon.fireRate>=prior-1e-8,'later weapon is never a direct-fire downgrade');
  }
  assert.equal(f.armory.upgradeWeapon(),false,'final family does not loop and farm power tiers');
}
// The max-rapid laser is a real projectile profile; its rockets are bounded and seek.
for(const width of [390,844])for(const heading of [-Math.PI/2,0,Math.PI/2,Math.PI]){
 globalThis.innerWidth=width;globalThis.innerHeight=width===390?844:390;
 const f=fixture();equip(f,'bb',4,RAPID_CAP);f.g.player.x=width/2;f.g.player.y=150;f.g.playerFacing=heading;
 f.g.hazards=[];f.g.boss=null;f.g.warship=null;f.g.drones=[drone(width/2+50,70,100)];
 assert.equal(f.armory.weapon.laserPulse,true);assert.equal(f.armory.weapon.projectileKey,'clarity_beam');
 const spec=fighterTwinSeekers(f.armory.state);const primary=f.armory.weapon.damage*f.armory.weapon.shots.length/f.armory.weapon.fireRate;
 assert.ok(spec.dps<=primary*.2+1e-8);assert.equal(spec.interval,TWIN_SEEKER_INTERVAL);assert.ok(spec.damage<=18);
 f.g.seekerClock=0;f.g.updateSeekers(0);assert.equal(f.g.seekers.length,2,'both side rockets launch together');
 assert.ok(Math.abs(Math.hypot(f.g.seekers[0].x-f.g.seekers[1].x,f.g.seekers[0].y-f.g.seekers[1].y)-40)<1e-8,'muzzles rotate with the hull');
 assert.ok(f.g.seekers.every(s=>s.damage===spec.damage));const initial=f.g.seekers.map(s=>s.angle);f.g.updateSeekers(.1);
 assert.ok(f.g.seekers.some((s,i)=>s.angle!==initial[i]),'rockets turn toward a target');
 const count=f.g.seekers.length;f.g.seekerClock=0;while(f.g.seekers.length<TWIN_SEEKER_MAX_ACTIVE)f.g.seekers.push({...f.g.seekers[0]});
 f.g.updateSeekers(0);assert.equal(f.g.seekers.length,TWIN_SEEKER_MAX_ACTIVE,'active salvo limit prevents projectile spam');
 f.g.seekers=[];f.g.seekerClock=0;f.g.drones=[];f.g.updateSeekers(0);assert.equal(f.g.seekers.length,0,'no target means no wasteful salvo');
 assert.equal(fighterTwinSeekers({...f.armory.state,rapid:RAPID_CAP-1}),null);
 const scaled=f.g.centredDps();const ordinary=f.g.currentVolley().length*f.g.currentWeapon().damage/f.g.currentWeapon().fireRate;
 assert.ok(Math.abs(scaled-ordinary-spec.dps)<1e-8,'boss firepower measurement includes the full twin salvo budget');
}
// Timed launches use the shipped simulation, not just the authored interval.
globalThis.innerWidth=390;globalThis.innerHeight=844;
{
 const f=fixture();equip(f,'bb',4,RAPID_CAP);f.g.player={...f.g.player,x:195,y:710};f.g.drones=[drone(195,650,1000)];f.g.hazards=[];f.g.boss=null;f.g.warship=null;f.g.seekerClock=0;
 const seen=new WeakSet();const launches=[];
 for(let tick=0;tick<60*13;tick++){
   f.g.updateSeekers(1/60);let fresh=0;for(const seeker of f.g.seekers)if(!seen.has(seeker)){seen.add(seeker);fresh++;}
   if(fresh){assert.equal(fresh,2);launches.push(tick/60);}
 }
 assert.equal(launches.length,3);for(let i=1;i<launches.length;i++)assert.ok(launches[i]-launches[i-1]>=6-1e-8);
}
console.log('fighter weapon upgrade: retained output, persisted choices, laser profile, paired homing, six-second cadence, salvo cap and boss accounting passed');

for(const family of FIGHTER_FAMILIES)for(let stage=1;stage<=4;stage++)for(const cadenceScale of [.8,1,1.4]){
 const state={family,rank:FAMILY_INFO[family].unlock+stage-1,rapid:RAPID_CAP};
 const weapon=fighterWeapon(state),spec=fighterTwinSeekers(state,cadenceScale);
 assert.ok(spec.dps<=weapon.damage*weapon.shots.length/(weapon.fireRate*cadenceScale)*.2+1e-8,'rocket budget respects each hull firing cadence');
}
// Homing collision keeps friendly and relay immunity; one rocket spends one hit.
{
 const f=fixture();equip(f,'bb',4,RAPID_CAP);f.g.bolts=[];f.g.drones=[];f.g.boss=null;f.g.warship=null;
 const relay=hazard('shield_relay',245,400),gun=hazard('basic_turret',195,400),beacon=hazard('clarity_beacon',195,500);
 f.g.hazards=[relay,gun,beacon];const missile=(y)=>({x:195,y,w:10,h:22,vx:0,vy:0,damage:18,angle:-Math.PI/2,age:0});
 f.g.seekers=[missile(400),missile(500)];f.g.collisions();
 assert.equal(gun.hp,100,'homing does not bypass linked relay shields');assert.equal(beacon.hp,100,'homing cannot damage friendlies');
 const target=drone(195,600,100);f.g.hazards=[];f.g.drones=[target];f.g.seekers=[missile(600)];f.g.collisions();
 assert.equal(target.hp,82);assert.equal(f.g.seekers.length,0);f.g.collisions();assert.equal(target.hp,82,'spent rocket cannot hit twice');
}
// Observe the real draw path so weapon variety is not just a different label.
{
 const signatures=[];let commands=[];
 for(const method of ['moveTo','lineTo','ellipse','stroke','fill'])ctx[method]=(...args)=>commands.push([method,...args]);
 for(const family of FIGHTER_FAMILIES){const f=fixture();equip(f,family,4);f.g.updateBolts(0);commands=[];f.g.drawBolt(f.g.bolts[0]);signatures.push(JSON.stringify(commands));}
 assert.equal(new Set(signatures).size,5,'five weapon families have five drawing silhouettes');
 const f=fixture();equip(f,'bb',4,RAPID_CAP);f.g.updateBolts(0);commands=[];f.g.drawBolt(f.g.bolts[0]);
 assert.ok(!signatures.includes(JSON.stringify(commands)),'max-rapid laser has its own longer beam silhouette');
}


// Earned weapon milestones: kills + sparse point caches, never auto-equipping.
function coreFixture(){const f=fixture();f.save.update(d=>{d.fighterUpgrades={weapon_rank:1,weapon_family:0,weapon_level:1,rapid_fire:0};d.fighterWeaponPoints=0;});f.g.fighterReady=true;return f;}
function closeArmory(f){if(f.armory.active)f.parent.children[0].children[1].children.at(-1).click();}
{
 const f=coreFixture();assert.equal(f.armory.weapon.shots.length,1);assert.equal(f.armory.weapon.laserPulse,false);
 f.armory.rankUp(20);assert.equal(f.armory.weapon.stage,1);assert.equal(f.g.upgradeAvailable('weapon'),false);
 f.g.applyPickup('weapon_upgrade');assert.equal(f.armory.state.points,4);assert.equal(f.armory.state.level,1);assert.equal(f.armory.state.family,'bb');assert.equal(f.armory.active,false);
 let milestones=0,priorDps=f.g.centredDps();
 for(let points=5;points<=200;points++){
  const before=f.armory.state.level;f.g.registerKill(drone());
  assert.equal(f.armory.state.points,points);assert.equal(f.armory.state.family,'bb','kill cannot replace equipped gun');assert.equal(f.armory.state.rapid,0);
  if(f.armory.state.level>before){
   milestones++;assert.ok([24,64,120,200].includes(points));assert.equal(f.armory.active,true);
   const panel=f.parent.children[0].children[1];assert.ok(panel.children[0].textContent.startsWith('LEVEL UP'));
   let updates=0;const real=f.g.update;f.g.update=()=>updates++;const clock=f.g.clock;f.g.frame(.1);assert.equal(updates,0);assert.equal(f.g.clock,clock);f.g.update=real;
   assert.ok(f.g.centredDps()>=priorDps);priorDps=f.g.centredDps();
   if(points===200){assert.ok(panel.children[0].textContent.includes('NEW WEAPON'));assert.equal(panel.children[3].disabled,false);assert.equal(panel.children[4].disabled,true);}
   closeArmory(f);
  }
 }
 assert.equal(milestones,4);assert.equal(f.armory.state.level,5);assert.equal(f.armory.weapon.stage,4);assert.equal(f.armory.upgradeWeapon(),false);
 f.g.frame(.01);const root=f.parent.children[0];root.children[0].click();const panel=root.children[1];
 panel.children[3].click();assert.equal(f.armory.state.family,'pulse');const threat=f.g.campaignThreatScale();
 f.g.applyPickup('weapon_upgrade');assert.equal(f.armory.state.family,'pulse','pickup cannot switch selected weapon');assert.equal(f.armory.state.points,200);
 panel.children[2].click();assert.equal(f.armory.state.family,'bb');assert.equal(f.g.campaignThreatScale(),threat,'loadout switching cannot weaken enemies');closeArmory(f);
}
{
 const f=coreFixture();f.g.barrels=4;f.g.shieldMax=99;f.g.bombPower=99;f.g.pulsePower=99;
 for(let i=0;i<4;i++)f.armory.upgradeRapid();assert.equal(f.g.allUpgradesMaxed(),true);
 f.g.kills=5;f.g.registerKill(drone());assert.ok(!f.g.pickups.some(p=>p.pickupKey==='weapon_upgrade'),'six-kill drop spam removed');
 f.g.kills=23;f.g.registerKill(drone());assert.ok(f.g.pickups.some(p=>p.pickupKey==='weapon_upgrade'),'general caps cannot suppress points');
 const core=f.g.pickups.find(p=>p.pickupKey==='weapon_upgrade');core.x=f.g.player.x;core.y=f.g.player.y;const points=f.armory.state.points;
 f.g.collisions();assert.equal(f.armory.state.points,points+4);assert.ok(!f.g.pickups.includes(core));
 f.armory.awardWeaponPoints(200);closeArmory(f);f.g.pickups=[];f.g.kills=47;f.g.registerKill(drone());assert.ok(!f.g.pickups.some(p=>p.pickupKey==='weapon_upgrade'));
}
{
 const f=coreFixture();f.g.paused=false;f.g.frame(.01);const root=f.parent.children[0];assert.equal(root.hidden,false);
 root.children[0].click();const panel=root.children[1];panel.children[3].click();assert.equal(f.armory.state.family,'bb','pulse remains locked before 200 points');
 let updates=0;const clock=f.g.clock;f.g.update=()=>updates++;f.g.frame(.1);assert.equal(f.g.clock,clock);assert.equal(updates,0);assert.equal(f.g.storyCapturedInput,true);
 closeArmory(f);f.g.frame(.1);assert.equal(updates,1);assert.equal(f.g.storyCapturedInput,false);
 f.armory.awardWeaponPoints(24);f.armory.block();f.armory.update(true);assert.equal(f.armory.active,true,'story interruption cannot discard pending level-up');closeArmory(f);
}
{
 const f=coreFixture();f.g.dropPickup(PICKUPS.weapon_upgrade,f.g.player.x,f.g.player.y);const core=f.g.pickups[0];
 fail=true;f.g.collisions();assert.equal(f.armory.state.points,0);assert.ok(f.g.pickups.includes(core));
 fail=false;f.g.collisions();assert.equal(f.armory.state.points,4);assert.equal(f.g.pickups.length,0);
 const reloaded=new FighterArmoryRuntime(new Element(),new CampaignSave(storage,f.save.key.split(':').slice(1).join(':')));assert.equal(reloaded.state.points,4);
 const snapshot=f.save.snapshot;assert.equal(f.armory.awardWeaponPoints(-1),false);assert.equal(f.armory.awardWeaponPoints(NaN),false);assert.deepEqual(f.save.snapshot,snapshot);
}
// Bounded DPS improvements versus stronger future enemy and turret spawns.
{
 const f=coreFixture();const def=ENEMIES.regulator_drone;const startHp=f.g.enemyHp(def);const startDps=f.g.centredDps();const ratios=[];
 for(const points of [0,24,64,120,200]){
  f.armory.awardWeaponPoints(Math.max(1,points-(f.armory.state.points??0)));closeArmory(f);
  const ratio=f.g.centredDps()/startDps;ratios.push(ratio);assert.ok(ratio<=2.51,'Earth beam output cannot balloon');
  assert.ok(f.g.enemyHp(def)>=startHp);assert.ok(f.g.campaignThreatScale()<=2.21);
 }
 assert.ok(f.g.enemyHp(def)>startHp,'later enemies are stronger');assert.equal(f.g.campaignThreatScale(),2.2);
 const turret=HAZARDS.basic_turret;assert.ok(f.g.hazardHp(turret)>turret.hp,'ground defenses follow milestone curve');
 assert.ok(ratios[3]>ratios[0],'upgrades retain a real damage advantage');
}
console.log('weapon points: four spaced Earth milestones, no pickup/kill auto-equip, clear paused unlocks, capped balanced output, stronger future enemies, manual loadout, sparse drops and save retry passed');
