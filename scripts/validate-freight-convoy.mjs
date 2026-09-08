import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {writeFileSync} from 'node:fs';
const out=await build({stdin:{contents:"export * from './src/game/definitive/FreightConvoy'; export * from './src/game/definitive/ConvoyCheckpoint';",resolveDir:process.cwd()},bundle:true,write:false,format:'esm'});
const m=await import('data:text/javascript;base64,'+Buffer.from(out.outputFiles[0].text).toString('base64'));
let count=0;
function run(first,second){
 const convoy=new m.FreightConvoy(), initial=convoy.poses;
 assert.equal(convoy.start(false),false);convoy.update(.1,{x:0,z:30},()=>false,false);assert.deepEqual(convoy.poses,initial);
 assert.equal(convoy.start(true),true);
 const before=convoy.poses;convoy.update(.1,{x:200,z:30},()=>false,false);assert.deepEqual(convoy.poses,before);
 convoy.update(.1,{x:0,z:30},()=>true,false);assert.deepEqual(convoy.poses,before);
 function drive(boss=false){for(let i=0;i<3000&&!convoy.waitingForCommit;i++){convoy.update(.1,convoy.poses[0],()=>false,boss);assert.ok(Math.hypot(convoy.poses[0].x-convoy.poses[1].x,convoy.poses[0].z-convoy.poses[1].z)>=4.6,'haulers stay separate');}assert.ok(convoy.waitingForCommit);count++;}
 drive();let c=convoy.boundary(['apron']);assert.ok(c);convoy.accept(c);assert.equal(convoy.stage,'junction_one');assert.equal(convoy.choose('east'),null);
 let parked=convoy.poses; c=convoy.choose(first);assert.ok(c);assert.deepEqual(convoy.poses,parked,'offering a choice does not commit it');convoy.accept(c);assert.deepEqual(convoy.poses,parked,'choice retains both real parking positions');
 drive();c=convoy.boundary([]);assert.equal(c,null,'cleared blockade is required');c=convoy.boundary([first]);assert.ok(c);parked=convoy.poses;convoy.accept(c);assert.ok(Math.hypot(convoy.poses[1].x-parked[1].x,convoy.poses[1].z-parked[1].z)<.001,'checkpoint keeps trailing position');
 c=convoy.choose(second);assert.ok(c);convoy.accept(c);drive();c=convoy.boundary([second]);assert.ok(c);convoy.accept(c);parked=convoy.poses;convoy.update(.1,parked[0],()=>false,false);assert.deepEqual(convoy.poses,parked,'siege must fall before actual delivery');drive(true);c=convoy.boundary(['siege']);assert.ok(c);assert.equal(c.stage,'delivered');assert.ok(m.validConvoyCheckpoint(c));
 const restored=new m.FreightConvoy(c);assert.equal(restored.stage,'delivered');assert.ok(Math.hypot(restored.poses[0].x-restored.poses[1].x,restored.poses[0].z-restored.poses[1].z)>5.9);
}
for(const a of ['express','covered'])for(const b of ['east','west'])run(a,b);
const ship=new m.FreightConvoy();assert.equal(ship.hit({x:-10,y:8,z:36},{x:10,y:8,z:36},30),null);assert.equal(ship.hit({x:-10,y:1,z:36},{x:10,y:1,z:36},50),0);assert.equal(ship.poses[0].hull,90);assert.equal(ship.repair(0,{x:0,z:36},false),false);assert.equal(ship.repair(0,{x:0,z:36},true),true);assert.equal(ship.poses[0].hull,125);assert.equal(ship.repair(0,{x:0,z:36},true),false);
ship.hit({x:-10,y:1,z:36},{x:10,y:1,z:36},200);assert.ok(ship.failed);assert.equal(ship.repair(0,{x:0,z:36},true),false);assert.equal(ship.boundary(['apron']),null);
const c=m.initialConvoyCheckpoint();assert.equal(m.validConvoyCheckpoint({...c,stage:'delivered'}),false);assert.equal(m.validConvoyCheckpoint({...c,hull:[NaN,140]}),false);assert.equal(m.validConvoyCheckpoint({...c,first:'express'}),false);
console.log('Convoy foundation: four lane combinations, 16 real travel legs, physical separation, gate holds, real-height swept hits, bounded repair, checkpoint reconstruction and delivery guards PASS.');
