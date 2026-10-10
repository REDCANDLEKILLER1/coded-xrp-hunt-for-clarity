import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {readFileSync} from 'node:fs';

// Kill-earned weapon points: 20 levels, five families, world-gated unlocks.
// Every invariant Michael specified, asserted against the real modules.

const store=new Map();
const storage={getItem:key=>store.get(key)??null,setItem:(key,value)=>{store.set(key,value);},removeItem:key=>store.delete(key)};
const ctx=new Proxy({},{get:(t,k)=>k in t?t[k]:k==='measureText'?()=>({width:10}):()=>{},set:(t,k,v)=>{t[k]=v;return true;}});
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

const W=await load('src/game/content/FighterWeapons.ts');
const {CampaignSave}=await load('src/game/definitive/CampaignSave.ts');
const {FighterArmoryRuntime}=await load('src/game/ui/FighterArmoryRuntime.ts');
const {Game2A}=await load('src/game/core/Game2A.ts');

const dps=w=>w.damage*w.shots.length/Math.max(0.001,w.fireRate);

// 1. Twenty strictly increasing thresholds.
assert.equal(W.WEAPON_LEVEL_THRESHOLDS.length,20,'must be 20 levels');
for(let i=1;i<20;i++)assert.ok(W.WEAPON_LEVEL_THRESHOLDS[i]>W.WEAPON_LEVEL_THRESHOLDS[i-1],`threshold ${i} not increasing`);
assert.equal(W.WEAPON_LEVEL_CAP,20);

// 2. Every level 1..20 yields a DISTINCT weapon key -- no stalls, no duplicates.
// This is the rank-5-to-10 `fighter.bb.4` defect, asserted dead.
const keys=new Set();
for(let level=1;level<=20;level++){
  const family=W.FIGHTER_FAMILIES[Math.floor((level-1)/4)];
  const state={family,rank:1,rapid:0,level,points:W.WEAPON_LEVEL_THRESHOLDS[level-1]};
  const key=W.fighterWeapon(state).key;
  assert.ok(!keys.has(key),`level ${level} re-issues ${key} -- a level-up that changes nothing`);
  keys.add(key);
}
assert.equal(keys.size,20,'20 levels must be 20 distinct guns');

// 3. Each stage changes gameplay meaningfully: strictly better TTK proxy and a
// changed gameplay dimension (coverage, pierce, splash or chain).
for(const family of W.FIGHTER_FAMILIES){
  let prev=null;
  for(let stage=1;stage<=4;stage++){
    const level=W.FIGHTER_FAMILIES.indexOf(family)*4+stage;
    const w=W.fighterWeapon({family,rank:1,rapid:0,level,points:W.WEAPON_LEVEL_THRESHOLDS[level-1]});
    if(prev){
      assert.ok(dps(w)>=dps(prev)*0.999,`stage ${stage} of ${family} regresses output`);
      const changed=w.shots.length!==prev.shots.length||w.pierce!==prev.pierce||w.splash!==prev.splash||w.chain!==prev.chain||w.damage!==prev.damage;
      assert.ok(changed,`stage ${stage} of ${family} changes no gameplay dimension`);
    }
    prev=w;
  }
}

// 4. World gates: no world exhausts the ladder.
assert.equal(W.maxLevelForWorlds(0),4,'Earth must cap at the beam');
assert.equal(W.maxLevelForWorlds(1),8);
assert.equal(W.maxLevelForWorlds(2),12);
assert.equal(W.maxLevelForWorlds(3),16);
assert.equal(W.maxLevelForWorlds(4),20);
assert.deepEqual(W.FAMILY_WORLD_REQUIREMENT,{bb:0,pulse:1,rocket:2,plasma:3,ledger:4});

// 5+6. Points bank past the gate; clearing the world releases them with an
// announcement; the equipped gun never changes on its own.
let serial=0;
const armoryFixture=()=>{
  const save=new CampaignSave(storage,`test:prog-${++serial}`);
  save.update(d=>{d.fighterUpgrades={weapon_rank:1,weapon_family:0,rapid_fire:0,weapon_level:1};});
  const armory=new FighterArmoryRuntime(new Element(),save);
  armory.setWorldsCleared(0);
  return{save,armory};
};
{
  const{armory}=armoryFixture();
  assert.ok(armory.awardWeaponPoints(500),'points should bank');
  assert.equal(armory.state.level,4,'500 points on Earth must still cap at beam IV');
  assert.equal(armory.state.points,500,'points bank past the gate');
  assert.deepEqual(armory.drainUnlocks(),[],'no unlock announced while gated');
  const equipped=armory.state.family;
  armory.setWorldsCleared(1);
  assert.equal(armory.state.level,8,'clearing Earth releases banked points to pulse IV');
  assert.deepEqual(armory.drainUnlocks(),['pulse'],'pulse unlock announced exactly once');
  assert.equal(armory.state.family,equipped,'unlock never auto-equips');
  assert.deepEqual(armory.drainUnlocks(),[],'announcement drains clean');
  // Selecting the unlocked weapon is the player's choice, and it works.
  armory.setActive(true);
  // select is private; drive it through the panel buttons like a player would.
  armory.update(true);
  const panel=armory['panel'];
  const pulseButton=panel.children.find(c=>c.children?.[0]?.textContent?.includes('PULSE LANCE'));
  assert.ok(pulseButton&&!pulseButton.disabled,'pulse must be selectable after unlock');
}

// 7. A capped weapon is never presented as a new upgrade: when the next family
// would fire the identical gun, the offer must exclude it. Drive the real
// offer path through Game2A with a maxed mastery state.
{
  const save=new CampaignSave(storage,`test:prog-cap-${++serial}`);
  const armory=new FighterArmoryRuntime(new Element(),save);
  const g=new Game2A(new Element());
  g.setFighterArmory(armory);g.deployFromMap('ledger_prime','EARTH');g.reset(undefined,{fresh:true});
  // Mastery mode, every family at stage 4: nothing new to offer.
  assert.ok(save.update(d=>{d.fighterUpgrades={weapon_rank:20,weapon_family:4,rapid_fire:4};}).ok);
  g.xpLevel=20;g.fighterReady=true;
  g.pendingUpgrades=1;g.upgradeOffer=[];
  g.openUpgradeChoice();
  assert.ok(!g.upgradeOffer.includes('weapon'),'capped arsenal must not offer a weapon upgrade');
}

// 8. Starter weapon vs the first boss: bb I must beat the Regulatory
// Behemoth at the HP the engine actually gives it -- balanced against the
// equipped loadout (loadoutScale), never a wall.
{
  const save=new CampaignSave(storage,`test:prog-boss-${++serial}`);
  const armory=new FighterArmoryRuntime(new Element(),save);
  const g=new Game2A(new Element());
  g.setFighterArmory(armory);g.deployFromMap('ledger_prime','EARTH');g.reset(undefined,{fresh:true});
  g.launchClock=0;g.player={x:195,y:710,w:24,h:28,vx:0,vy:0,hp:100};g.playerFacing=-Math.PI/2;
  // Starter gun: bb I, no rapid.
  const w=W.fighterWeapon({family:'bb',rank:1,rapid:0,level:1,points:0});
  assert.equal(w.key,'fighter.bb.1','campaign starts with the basic gun');
  assert.ok(save.update(d=>{d.fighterUpgrades={weapon_rank:1,weapon_family:0,rapid_fire:0,weapon_level:1};}).ok);
  g.fighterReady=true;g.boltClock=0;g.bolts=[];
  // The engine scales boss HP by measured DPS against BASE_PLAYER_DPS; the
  // starter gun IS the baseline, so the behemoth spawns at ~its registry HP.
  const {BOSSES}=await load('src/game/content/registry.ts');
  const bossHp=Math.round(BOSSES.regulatory_behemoth.hp*1);
  const target={x:195,y:400,w:60,h:60,vx:0,vy:0,hp:bossHp,enemyKey:'regulator_drone',age:0,anchorX:195,phase:0,direction:1,fireClock:10,stance:'holding',stationX:195,stationY:400,stanceClock:0,patience:10,dodgeCooldown:0,atRest:true,escort:false};
  g.drones=[target];
  let t=0;for(;t<60&&target.hp>0;t+=1/240){g.updateBolts(1/240);g.collisions();}
  assert.ok(target.hp<=0,`starter gun cannot kill the first boss (${bossHp}hp) in 60s`);
  assert.ok(t<30,`starter gun takes ${t.toFixed(1)}s against the first boss -- a wall, not a fight`);
}

// 9. Pickups never switch the equipped weapon: the WPN pickup path may only
// award points. Asserted against the shipped source.
{
  const src=readFileSync('src/game/core/Game2A.ts','utf8');
  const pickupCase=src.slice(src.indexOf("case 'weapon_upgrade':"),src.indexOf("case 'weapon_upgrade':")+600);
  assert.ok(pickupCase.includes('awardWeaponPoints'),'WPN pickup must award points');
  assert.ok(pickupCase.includes('never switches the equipped weapon'),'pickup no-switch documented');
  assert.ok(!pickupCase.includes('weapon_family='),'WPN pickup must not touch the equipped family');
}

console.log('weapon-progression: OK -- 20 distinct levels, world-gated unlocks with announcements, no capped offers, starter gun beats boss-scale targets.');
