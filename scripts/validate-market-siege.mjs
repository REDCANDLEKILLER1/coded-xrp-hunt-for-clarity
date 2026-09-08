import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

const file='src/game/definitive/MarketSiegeEngine.ts';
async function load(source=readFileSync(file,'utf8')) {
  const built=await build({stdin:{contents:source,resolveDir:process.cwd()+'/src/game/definitive',loader:'ts'},bundle:true,write:false,format:'esm',logLevel:'silent'});
  return import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
}
function prove(m) {
  const {MarketSiegeEngine:Engine,MARKET_SIEGE:C,siegeShellPosition,siegeHazardHit}=m;
  let boss;
  const anchors=()=>{
    const p=boss.pose,s=Math.sin(p.heading),c=Math.cos(p.heading);
    const world=(x,y,z)=>({x:p.x+x*c+z*s,y,z:p.z-x*s+z*c});
    return {muzzles:[world(-3,2.8,-2),world(3,2.8,-2),world(-3,2.8,2),world(3,2.8,2)],rear:world(0,C.rearY,C.rearZ)};
  };
  boss=new Engine(anchors);
  const hero={x:-19,y:1.1,z:-44},cargo=[{x:0,y:1,z:-38}];
  const advance=seconds=>{for(let time=0;time<seconds-.00001;time+=.05)boss.update(Math.min(.05,seconds-time),hero,cargo,true);};
  const rear=anchors().rear,from={x:-24,y:2.55,z:-46};
  assert.equal(boss.hitRear(from,rear,12),false,'armor closed');
  boss.update(.1,hero,cargo,false);assert.equal(boss.age,0,'modal pause');
  for(const dt of [NaN,-1,1,Infinity])boss.update(dt,hero,cargo,true);
  assert.equal(boss.age,0,'invalid frame rejected');
  advance(1.05);assert.equal(boss.hazards.length,2);
  const first=boss.hazards[0],initial=structuredClone(first.target),sources=anchors().muzzles;
  assert.deepEqual(first.from,sources[0],'physical barrel origin');
  assert.deepEqual(boss.hazards[1].from,sources[1],'second distinct barrel');
  assert.deepEqual(siegeShellPosition(first),first.from);
  assert.equal(siegeHazardHit(first,'hero',first.target),false,'warning cannot hurt');
  hero.x=40;advance(.4);assert.deepEqual(first.target,initial,'committed target does not home after tell');
  first.tell=0;first.age=first.travel/2;const arc=siegeShellPosition(first);
  assert.ok(arc.y>first.from.y+3,'visible parabolic flight');
  assert.equal(siegeHazardHit(first,'hero',first.target),false,'flying shell cannot apply ground damage');
  first.age=first.travel;assert.equal(siegeHazardHit(first,'hero',first.target),true);
  assert.equal(siegeHazardHit(first,'hero',first.target),false,'one impact per actor');
  assert.equal(siegeHazardHit(first,'hauler0',first.target),true,'separate actor can take same blast');
  assert.equal(siegeHazardHit(first,'outside',{x:first.target.x+10,z:first.target.z}),false);
  advance(3.8);assert.ok(boss.open);
  assert.equal(boss.hitRear({x:0,y:2.55,z:-46},anchors().rear,12),false,'front armor blocks through-shot');
  assert.equal(boss.hitRear({x:-24,y:0,z:-46},{x:-9,y:0,z:-46},12),false,'ground XZ overlap misses elevated control');
  assert.equal(boss.hitRear({x:-24,y:2.55,z:-35},{x:-9,y:2.55,z:-35},12),false,'lateral miss');
  assert.equal(boss.hitRear(from,anchors().rear,12),true,'real elevated rear segment');
  assert.equal(boss.hp,C.hp-12);
  const before=boss.age,hp=boss.hp,hazards=boss.hazards.length;
  boss.update(.1,hero,cargo,false);assert.equal(boss.age,before);assert.equal(boss.hp,hp);assert.equal(boss.hazards.length,hazards);
  advance(6.4);assert.equal(boss.open,false);
  const left=boss.pose;advance(4.2);assert.ok(boss.pose.x-left.x>15,'machine actually relocates across arena');
  const beforeBoundary=boss.pose;advance(.1);assert.ok(Math.abs(boss.pose.x-beforeBoundary.x)<.6,'movement remains continuous');
  let max=0,origins=new Set(),last=boss.pose;
  for(let i=0;i<24000;i++){
    boss.update(.025,hero,cargo,true);max=Math.max(max,boss.hazards.length);
    assert.ok(Math.hypot(boss.pose.x-last.x,boss.pose.z-last.z)<.2,'no position teleport at cycle seam');last=boss.pose;
    for(const h of boss.hazards)if(h.kind==='mortar')origins.add(Math.round(h.from.z));
  }
  assert.ok(max<=8,'bounded 600-second encounter pool');assert.equal(origins.size,2,'both broadside banks used');
  while(!boss.open)boss.update(.05,hero,cargo,true);
  const target=anchors().rear,p=boss.pose,origin={x:p.x-Math.sin(p.heading)*15,y:2.55,z:p.z-Math.cos(p.heading)*15};
  assert.equal(boss.hitRear(origin,target,2000),true);assert.equal(boss.hp,0);assert.equal(boss.hazards.length,0);
  const stopped=boss.age;advance(2);assert.equal(boss.age,stopped);assert.equal(boss.hitRear(origin,target,12),false);
  const bad=new Engine(()=>({muzzles:[{x:0,y:2,z:0}],rear:{x:0,y:2,z:0}}));
  assert.throws(()=>{for(let i=0;i<25;i++)bad.update(.05,hero,cargo,true);},/four actual/);
}
prove(await load());
const source=readFileSync(file,'utf8');
const mutants=[
 ['warning_damage','h.tell > 0 || h.age < h.travel ||',''],
 ['repeated_blast','|| h.damaged.has(actor)',''],
 ['ground_weakpoint','origin.y + dy * t - target.y','0'],
 ['front_armor','if (rear < 3) return false;',''],
 ['fake_origin','from: { ...sources[(ordinal * 2 + i) % 4] }','from: { x:0, y:0, z:0 }'],
 ['unpaused','if (!engaged || this.hp <= 0','if (this.hp <= 0'],
 ['no_relocation','x: base * (1 - 2 * moved)','x: base'],
];
for(const [label,from,to] of mutants){assert.ok(source.includes(from),label+' mutation applies');let caught=false;try{prove(await load(source.replace(from,to)));}catch{caught=true;}assert.ok(caught,label+' must fail the behavioral checks');}
console.log('Market Siege foundation PASS: actual elevated rear hits, armor, committed four-barrel attacks, impact timing/deduplication, continuous moving broadside, pause/death, finite 600-second pool and seven caught failure controls.');
