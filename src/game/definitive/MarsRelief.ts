import type {CampaignSave,SaveResult} from './CampaignSave';
import type {DialogueScene} from './Dialogue';
import {MARS_APPROACH} from './PlanetApproach';
import {BOARDING_STEPS} from './BoardingQuest';

export const RELIEF_PUMPS=[
  {id:'intake',label:'INTAKE PUMP',x:-18,z:0,guards:2},
  {id:'filter',label:'FILTRATION PLANT',x:18,z:-12,guards:3},
  {id:'cistern',label:'UPPER CISTERN',x:0,z:-35,guards:3},
] as const;
export type ReliefPump=typeof RELIEF_PUMPS[number]['id'];
export const RELIEF_BOUNDS={minX:-31,maxX:31,minZ:-49,maxZ:38};
export const RELIEF_CORN={x:0,z:12};
export const RELIEF_LANDING={x:0,z:26};
export const MARS_RELIEF_COMMS:Record<'intro'|'restored'|'log',DialogueScene>={
  intro:{id:'story.mars.corn_meeting',lines:[
    {speaker:'CORN XRPL',text:'Good news: the soil still works. Bad news: the machinery thinks it owns the rain.'},
    {speaker:'XRPMAN',text:"Your signal brought us here. Let's open the pumps."},
    {speaker:'CORN XRPL',text:'Three control stations. Clear their seizure drones, then release each valve. Leave the relief equipment intact.'},
    {speaker:'STONE · COMMS',text:'Green marks the safe route. The Warship will hold above us.'},
  ]},
  restored:{id:'story.mars.relief_restored',lines:[
    {speaker:'CORN XRPL',text:'There it is. Water where people need it. Funny how a working valve beats another promise.'},
    {speaker:'XRPMAN',text:'This was one relief site. Where does the rest of the drain go?'},
    {speaker:'CORN XRPL',text:'The Margin Warden owns the extraction route. Take my field repair unit. We keep people standing while we break its circuit.'},
    {speaker:'STONE · COMMS',text:'Relief signal secured. We have a safe foothold on Mars.'},
  ]},
  log:{id:'log.mars.relief',lines:[{speaker:'CORN XRPL',text:'Pumps online. The field repair unit restores your vitals when it has recharged. The excavation route is our next target.'}]},
};
const add=(list:string[],value:string)=>{if(!list.includes(value))list.push(value);};
export function canDescendToRelief(save:CampaignSave):boolean {
  const d=save.snapshot,t=d.transit;
  return d.warshipOwned&&d.location.mode==='space'&&t?.phase==='mars'&&t.hull>0&&d.quests.includes('mars.orbit_reached')
    &&Math.hypot(t.position[0]-MARS_APPROACH.x,t.position[1]-MARS_APPROACH.y,t.position[2]-MARS_APPROACH.z)<=480;
}
export function beginMarsRelief(save:CampaignSave):SaveResult {
  const d=save.snapshot;
  if(d.location.mode==='surface'&&d.location.world==='mars'&&d.quests.includes('mars.relief_landed'))return{ok:true,changed:false};
  if(!canDescendToRelief(save))return{ok:false,reason:'condition'};
  return save.update(d=>{
    add(d.quests,'mars.relief_landed');
    const lastPump=[...RELIEF_PUMPS].reverse().find(p=>d.quests.includes('mars.pump.'+p.id));
    const checkpoint=d.quests.includes('mars.relief_restored')?'mars.corn':lastPump?'mars.pump.'+lastPump.id:d.quests.includes('mars.corn_met')?'mars.corn':'mars.relief_landing';
    d.location={mode:'surface',world:'mars',checkpoint};
  });
}
export class MarsReliefQuest {
  constructor(readonly save:CampaignSave){}
  get introduced():boolean{return this.save.snapshot.quests.includes('mars.corn_met');}
  get restored():boolean{return this.save.snapshot.quests.includes('mars.relief_restored');}
  pumpClear(id:ReliefPump):boolean{return this.save.snapshot.quests.includes(`mars.pump.${id}`);}
  private get present():boolean{const d=this.save.snapshot;return d.warshipOwned&&d.location.mode==='surface'&&d.location.world==='mars'&&d.quests.includes('mars.relief_landed');}
  meetCorn():SaveResult {
    if(!this.present)return{ok:false,reason:'condition'};
    return this.save.update(d=>{add(d.quests,'mars.corn_met');add(d.dialogueSeen,MARS_RELIEF_COMMS.intro.id);d.location.checkpoint='mars.corn';});
  }
  releasePump(id:ReliefPump,remainingGuards:number):SaveResult {
    if(!this.present||!this.introduced||remainingGuards!==0||!RELIEF_PUMPS.some(p=>p.id===id))return{ok:false,reason:'condition'};
    return this.save.claim(`reward.mars.pump.${id}`,d=>{add(d.quests,`mars.pump.${id}`);d.location.checkpoint=`mars.pump.${id}`;d.credits+=40;});
  }
  completeRelief():SaveResult {
    if(!this.present||!RELIEF_PUMPS.every(p=>this.pumpClear(p.id)))return{ok:false,reason:'condition'};
    return this.save.claim('reward.mars.relief',d=>{
      add(d.quests,'mars.relief_restored');add(d.recruits,'corn_xrpl');add(d.dialogueSeen,MARS_RELIEF_COMMS.restored.id);
      d.heroUpgrades.field_repair=1;d.location.checkpoint='mars.corn';
    });
  }
}

/** Explicit direct-section fixture; never grants a campaign save ownership. */
export function prepareMarsReliefReview(save:CampaignSave):SaveResult {
  if(!save.testSlot)return{ok:false,reason:'condition'};
  return save.update(d=>{
    if(d.quests.includes('mars.relief_landed'))return;
    d.warshipOwned=true;for(const step of BOARDING_STEPS)add(d.quests,'boarding.'+step);add(d.recruits,'mr_zamn');add(d.quests,'mars.orbit_reached');add(d.quests,'mars.relief_landed');
    d.transit={phase:'mars',position:MARS_APPROACH.toArray() as [number,number,number],orientation:[0,0,0,1],wave:4,seconds:0,hull:100,fore:100,aft:100};
    d.location={mode:'surface',world:'mars',checkpoint:'mars.relief_landing'};add(d.earth.discoveredPlanets,'mars');d.earth.currentPlanet='mars';d.heroUpgrades.ledger_shield=1;
  });
}
