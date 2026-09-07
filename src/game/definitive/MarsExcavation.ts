import type {CampaignSave,SaveResult} from './CampaignSave';
import type {DialogueScene} from './Dialogue';
import type {GroundPosition} from './MarginWarden';
import {prepareMarsReliefReview,RELIEF_PUMPS} from './MarsRelief';
export const RELIEF_EXIT={x:0,z:-46};
export const EXCAVATION_ENTRY={x:0,z:30};
export const EXCAVATION_GUARDS=[{x:-5,z:18},{x:5,z:18},{x:-4,z:11},{x:4,z:11}] as const;
export const excavationCheckpoint=(checkpoint:string):boolean=>checkpoint.startsWith('mars.excavation_');
const add=(values:string[],id:string)=>{if(!values.includes(id))values.push(id);};
const near=(a:GroundPosition|undefined,b:GroundPosition)=>!!a&&Number.isFinite(a.x)&&Number.isFinite(a.z)&&Math.hypot(a.x-b.x,a.z-b.z)<3;
const ready=(save:CampaignSave)=>{const d=save.snapshot;return d.warshipOwned&&d.location.mode==='surface'&&d.location.world==='mars'&&d.quests.includes('mars.relief_restored')&&d.heroUpgrades.field_repair===1;};
export function beginMarsExcavation(save:CampaignSave,at?:GroundPosition):SaveResult{
  const d=save.snapshot;if(!ready(save))return{ok:false,reason:'condition'};
  if(excavationCheckpoint(d.location.checkpoint)&&d.quests.includes('mars.excavation_entered'))return{ok:true,changed:false};
  if(!near(at,RELIEF_EXIT))return{ok:false,reason:'condition'};
  return save.update(d=>{add(d.quests,'mars.excavation_entered');d.location.checkpoint=d.quests.includes('mars.route_secured')?'mars.excavation_arena':'mars.excavation_entry';});
}
export function returnMarsRelief(save:CampaignSave,at:GroundPosition):SaveResult{
  if(!ready(save)||!excavationCheckpoint(save.snapshot.location.checkpoint)||!near(at,EXCAVATION_ENTRY))return{ok:false,reason:'condition'};
  return save.update(d=>{d.location.checkpoint='mars.north_exit';});
}
export function secureExcavationRoute(save:CampaignSave,remaining:number,at:GroundPosition):SaveResult{
  if(!ready(save)||!excavationCheckpoint(save.snapshot.location.checkpoint)||remaining!==0||!near(at,{x:0,z:9}))return{ok:false,reason:'condition'};
  return save.claim('reward.mars.excavation_route',d=>{add(d.quests,'mars.route_secured');d.location.checkpoint='mars.excavation_arena';d.credits+=60;});
}
export function completeMarginWarden(save:CampaignSave,defeated:boolean):SaveResult{
  if(!defeated||!ready(save)||!excavationCheckpoint(save.snapshot.location.checkpoint)||!save.snapshot.quests.includes('mars.route_secured'))return{ok:false,reason:'condition'};
  return save.claim('reward.mars.margin_warden',d=>{
    add(d.quests,'mars.margin_warden_defeated');add(d.quests,'mars.restored');add(d.dialogueSeen,EXCAVATION_COMMS.restored.id);
    d.heroUpgrades.liquidity_dash=1;d.credits+=320;d.location.checkpoint='mars.excavation_complete';
    add(d.earth.clearedPlanets,'mars');add(d.earth.defeatedSurfaceBosses,'mars');add(d.earth.discoveredPlanets,'fog_moon');
  });
}
/** Separate section save, guarded against campaign use. */
export function prepareExcavationReview(save:CampaignSave):SaveResult{
  if(!save.testSlot)return{ok:false,reason:'condition'};
  if(save.snapshot.quests.includes('mars.excavation_entered'))return{ok:true,changed:false};
  const relief=prepareMarsReliefReview(save);if(!relief.ok)return relief;
  return save.update(d=>{
    for(const p of RELIEF_PUMPS)add(d.quests,'mars.pump.'+p.id);for(const q of ['mars.corn_met','mars.relief_restored','mars.excavation_entered'])add(d.quests,q);
    add(d.recruits,'corn_xrpl');d.heroUpgrades.field_repair=1;d.location={mode:'surface',world:'mars',checkpoint:'mars.excavation_entry'};
  });
}
export const EXCAVATION_COMMS:Record<'approach'|'warden'|'restored',DialogueScene>={
  approach:{id:'story.mars.excavation',lines:[
    {speaker:'CORN XRPL · COMMS',text:'That service road used to carry harvest equipment. Now it carries seizures. Clear it and open the pressure gate.'},
    {speaker:'XRPMAN',text:'We have your repair unit. Keep the relief crews behind us.'},
  ]},
  warden:{id:'story.mars.margin_warden',lines:[
    {speaker:'MARGIN WARDEN',allegiance:'hostile',text:'Unauthorized flow detected. All output remains under extraction authority.'},
    {speaker:'CORN XRPL · COMMS',text:'Two red towers feed its containment. Break both before either restarts, then hit the exposed control ring.'},
    {speaker:'STONE · COMMS',text:'Watch the red ground markings. The mining tools lock their aim before they strike.'},
    {speaker:'XRPMAN',text:'That green core belongs to the people down here. We are opening it.'},
  ]},
  restored:{id:'story.mars.restoration',lines:[
    {speaker:'CORN XRPL · COMMS',text:'Extraction pressure is gone. Every relief pump on the network can draw again.'},
    {speaker:'XRPMAN',text:'Route it back to the settlements. We take only what keeps us moving.'},
    {speaker:'STONE · COMMS',text:'The released field stabilized your thrusters. Liquidity Dash is online: a short burst, then recharge.'},
    {speaker:'CORN XRPL · COMMS',text:'The drain records point to Fog Moon. I am coming aboard. Somebody has to tell you when a machine is lying.'},
  ]},
};
export function excavationClear(p:GroundPosition):boolean{
  if(Math.hypot(p.x,p.z-11.2)<.65)return false;
  if(Math.abs(p.z-8.3)<.95&&[-8.4,8.4].some(x=>Math.abs(p.x-x)<.85))return false;
  return Math.abs(p.x)<=18&&p.z>=-19&&p.z<=10||Math.abs(p.x)<=9&&p.z>=10&&p.z<=22||Math.abs(p.x)<=5&&p.z>=22&&p.z<=34;
}
