import assert from 'node:assert/strict';
import { build } from 'esbuild';

/**
 * District handoff contract. Two warship districts must never both own live GPU
 * resources once a handoff has committed, and a failed handoff must leave the
 * outgoing district resident, active and driveable so the player keeps playing.
 *
 * Every property here is driven against the real SceneController with placeholder
 * managed scenes that record their own residency, activation and disposal, so the
 * checks fail on a behaviour change rather than on a rewritten source string.
 */
const load=async path=>{
  const result=await build({entryPoints:[path],bundle:true,write:false,format:'esm',logLevel:'silent'});
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
};
const {SceneController}=await load('src/game/definitive/SceneController.ts');

/** A district stand-in that holds "live resources" until it is actually disposed. */
function rig(){
  const live=new Set(),order=[];
  const mount=(name,district=true)=>{
    const scene={name,district,active:false,disposals:0,updates:0,renders:0,
      setActive(active){scene.active=active;order.push(`${name}:active=${active}`);},
      update(){scene.updates++;},
      render(){scene.renders++;},
      dispose(){scene.disposals++;live.delete(scene);order.push(`${name}:dispose#${scene.disposals}`);}};
    live.add(scene);return scene;
  };
  return {live,order,mount,resident:()=>[...live].map(scene=>scene.name).sort().join('+')||'(none)',districts:()=>[...live].filter(scene=>scene.district).map(scene=>scene.name)};
}
const settle=()=>new Promise(resolve=>setTimeout(resolve,5));

// --- P1: a successful handoff activates the arrival and releases the departure exactly once.
{
  const g=rig(),controller=new SceneController(),boarding=g.mount('boarding');
  await controller.change(async()=>boarding);
  g.order.length=0;
  let civic;
  const committed=await controller.change(async()=>{civic=g.mount('civic');return civic;});
  assert.equal(committed,true,'a successful district load commits');
  assert.equal(civic.active,true,'the arriving district is activated');
  assert.equal(boarding.disposals,1,'the departing district is disposed exactly once');
  assert.equal(g.resident(),'civic','only the arriving district still owns live resources');
  assert.deepEqual(g.order,['boarding:active=false','civic:active=true','boarding:dispose#1'],
    'the departure is silenced before the arrival takes the screen, and released only after');
}

// --- P2: a failed load keeps the departure resident, active and driveable.
{
  const g=rig(),controller=new SceneController(),boarding=g.mount('boarding');
  await controller.change(async()=>boarding);
  const committed=await controller.change(async()=>{throw new Error('civic bake missing');});
  assert.equal(committed,false,'a failed district load does not commit');
  assert.equal(boarding.disposals,0,'a failed load never releases the district the player is standing in');
  assert.equal(boarding.active,true,'the resident district is reactivated after a failed load');
  assert.equal(g.resident(),'boarding','the failed arrival owns nothing');
  assert.equal(controller.lastError,'civic bake missing','the failure reason reaches the retry path');
  controller.frame(.016);
  assert.ok(boarding.updates>0&&boarding.renders>0,'the resident district is still simulated and drawn after a failed load');
}

// --- P2b: the same holds when the load aborts rather than throwing a plain error.
{
  const g=rig(),controller=new SceneController(),boarding=g.mount('boarding');
  await controller.change(async()=>boarding);
  const committed=await controller.change(async signal=>{
    await settle();
    throw new DOMException(signal.aborted?'aborted':'cancelled','AbortError');
  });
  assert.equal(committed,false,'an aborted district load does not commit');
  assert.equal(boarding.disposals,0,'an aborted load never releases the resident district');
  assert.equal(boarding.active,true,'the resident district survives an aborted load');
}

// --- P3: a superseded load releases its own late result and never takes the screen.
{
  const g=rig(),controller=new SceneController(),boarding=g.mount('boarding');
  await controller.change(async()=>boarding);
  let release;const slow=new Promise(resolve=>{release=resolve;});
  let late;
  const first=controller.change(async()=>{await slow;late=g.mount('civic-late');return late;});
  const second=await controller.change(async()=>g.mount('cargo'));
  release();
  const firstCommitted=await first;
  await settle();
  assert.equal(second,true,'the newer district load wins');
  assert.equal(firstCommitted,false,'the superseded load reports that it did not commit');
  assert.equal(late.disposals,1,'the stale result is released exactly once');
  assert.equal(late.active,false,'the stale result never takes the screen');
  assert.equal(boarding.disposals,1,'the departing district is released exactly once even when a load was superseded');
  assert.equal(g.resident(),'cargo','only the winning district owns live resources');
}

// --- P4: the lightweight connector preserves retry without two district GLBs co-resident.
{
  const g=rig(),controller=new SceneController(),boarding=g.mount('boarding');
  await controller.change(async()=>boarding);
  const connector=g.mount('civic-lift',false);
  await controller.change(async()=>connector);
  assert.deepEqual(g.districts(),[],'entering the connector releases the departing district before the next district loads');
  let districtPeak=0;
  await controller.change(async()=>{const civic=g.mount('civic');districtPeak=g.districts().length;return civic;});
  assert.equal(districtPeak,1,'only the arriving district GLB is resident during its load');
  assert.deepEqual(g.districts(),['civic'],'exactly one district owns live resources once the handoff commits');
  const cargoConnector=g.mount('cargo-lift',false);
  await controller.change(async()=>cargoConnector);
  assert.deepEqual(g.districts(),[],'the next connector releases Civic before Cargo loads');
  await controller.change(async()=>g.mount('cargo'));
  assert.deepEqual(g.districts(),['cargo'],'single district residency survives repeated connector handoffs');
  controller.clear();
  assert.equal(g.live.size,0,'tearing down the controller releases the last district');
}

// --- P5: a departure that fails to release must not take the arrival down with it.
{
  const g=rig(),controller=new SceneController(),boarding=g.mount('boarding');
  boarding.dispose=()=>{throw new Error('GPU context lost during release');};
  await controller.change(async()=>boarding);
  let civic;
  const committed=await controller.change(async()=>{civic=g.mount('civic');return civic;});
  assert.equal(committed,true,'a handoff that already took the screen still reports as committed');
  assert.equal(civic.disposals,0,'a failing departure must never release the district that now owns the screen');
  assert.equal(civic.active,true,'the arrival stays active when the departure fails to release');
  assert.equal(controller.lastError,'GPU context lost during release','the failed release is recorded rather than swallowed');
  controller.frame(.016);
  assert.ok(civic.updates>0&&civic.renders>0,'the arrival is still simulated and drawn after a failed departure release');
}

// --- P5b: the same protection applies when the controller is torn down.
{
  const g=rig(),controller=new SceneController(),boarding=g.mount('boarding');
  boarding.dispose=()=>{throw new Error('GPU context lost during release');};
  await controller.change(async()=>boarding);
  controller.clear();
  assert.equal(controller.loading,false,'teardown completes even when the resident district fails to release');
  controller.frame(.016);
  assert.equal(boarding.updates,0,'a torn-down controller drives nothing');
}

console.log('scene-residency: OK — connector handoffs keep heavy districts singly resident, failed and aborted loads keep the player on a live retry surface, stale results are released once, and a departure that fails to release cannot strand the arrival.');
