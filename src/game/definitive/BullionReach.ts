import type { CampaignSave, SaveResult } from './CampaignSave';
import type { DialogueScene } from './Dialogue';
import { initialConvoyCheckpoint, type FirstFreightLane, type SecondFreightLane, type ConvoyCheckpoint } from './ConvoyCheckpoint';
import { FreightConvoy, FREIGHT_JUNCTIONS, type FreightPoint } from './FreightConvoy';
import layout from './data/bullion-layout.json';

export const BULLION_LAYOUT = layout;
const add = (items: string[], item: string) => { if (!items.includes(item)) items.push(item); };
export const nearFreight = (a: FreightPoint, b: FreightPoint, radius=3.3) => Number.isFinite(a.x) && Number.isFinite(a.z) && Math.hypot(a.x-b.x,a.z-b.z)<radius;
export function bullionPresent(save: CampaignSave): boolean {
  const d=save.snapshot;return d.warshipOwned && d.location.mode==='surface' && d.location.world==='bullion_reach' && d.quests.includes('bullion_reach.landed');
}
function currentConvoy(save: CampaignSave, convoy: FreightConvoy): boolean {
  return bullionPresent(save) && !convoy.failed && JSON.stringify(save.snapshot.convoy ?? initialConvoyCheckpoint())===JSON.stringify(convoy.checkpoint);
}
function commit(save: CampaignSave, convoy: FreightConvoy, candidate: ConvoyCheckpoint, checkpoint: string): SaveResult {
  if(!currentConvoy(save,convoy))return{ok:false,reason:'condition'};
  const result=save.update(d=>{d.convoy=structuredClone(candidate);d.location.checkpoint=checkpoint;});
  if(result.ok)convoy.accept(candidate);return result;
}
export function meetLex(save: CampaignSave, convoy: FreightConvoy, at: FreightPoint, guards: number): SaveResult {
  if(!currentConvoy(save,convoy) || convoy.stage!=='apron' || !nearFreight(at,layout.lex) || guards!==0 || save.snapshot.quests.includes('bullion_reach.lex_met'))return{ok:false,reason:'condition'};
  const candidate=convoy.checkpoint;candidate.cleared=['apron'];candidate.hull=convoy.poses.map(p=>p.hull) as [number,number];
  const result=save.update(d=>{add(d.quests,'bullion_reach.lex_met');add(d.dialogueSeen,BULLION_COMMS.lex.id);d.convoy=candidate;d.location.checkpoint='bullion_reach.apron';});
  if(result.ok){convoy.accept(candidate);convoy.start(true);}return result;
}
export function chooseFreightLane(save: CampaignSave, convoy: FreightConvoy, lane: FirstFreightLane|SecondFreightLane, at: FreightPoint): SaveResult {
  const junction=convoy.stage==='junction_one'?FREIGHT_JUNCTIONS[0]:FREIGHT_JUNCTIONS[1];
  if(!currentConvoy(save,convoy) || !save.snapshot.quests.includes('bullion_reach.lex_met') || !nearFreight(at,junction))return{ok:false,reason:'condition'};
  const candidate=convoy.choose(lane);return candidate?commit(save,convoy,candidate,'bullion_reach.'+convoy.stage):{ok:false,reason:'condition'};
}
/** Clearing artillery opens the route but never awards an undelivered convoy. */
export function markMarketSiegeDown(save: CampaignSave, convoy: FreightConvoy, defeated: boolean): SaveResult {
  if(!defeated || !currentConvoy(save,convoy) || convoy.stage!=='siege' || save.snapshot.quests.includes('bullion_reach.siege_defeated'))return{ok:false,reason:'condition'};
  const candidate=convoy.checkpoint;add(candidate.cleared,'siege');candidate.hull=convoy.poses.map(p=>p.hull) as [number,number];
  const result=save.update(d=>{d.convoy=candidate;add(d.quests,'bullion_reach.siege_defeated');d.location.checkpoint='bullion_reach.siege_clear';});
  if(result.ok)convoy.accept(candidate);return result;
}
/** Candidates come from actual vehicle arrival, and commit before local state.
 * A quota/conflict failure leaves the physical convoy held for an honest Retry. */
export function commitFreightBoundary(save: CampaignSave, convoy: FreightConvoy, cleared: readonly string[]): SaveResult {
  if(!currentConvoy(save,convoy) || !save.snapshot.quests.includes('bullion_reach.lex_met'))return{ok:false,reason:'condition'};
  const candidate=convoy.boundary(cleared);if(!candidate)return{ok:false,reason:'condition'};
  if(candidate.stage!=='delivered')return commit(save,convoy,candidate,'bullion_reach.'+candidate.stage);
  if(!save.snapshot.quests.includes('bullion_reach.siege_defeated'))return{ok:false,reason:'condition'};
  const result=save.claim('reward.bullion_reach.delivery',d=>{
    d.convoy=candidate;add(d.quests,'bullion_reach.restored');add(d.recruits,'lex');add(d.dialogueSeen,BULLION_COMMS.delivered.id);
    add(d.earth.clearedPlanets,'bullion_reach');add(d.earth.defeatedSurfaceBosses,'bullion_reach');
    add(d.earth.discoveredPlanets,'rugfall');add(d.earth.discoveredPlanets,'sec_outpost');
    d.location.checkpoint='bullion_reach.delivered';d.credits+=420;
  });
  if(result.ok)convoy.accept(candidate);return result;
}
export function freightSector(convoy: FreightConvoy): string|null {
  const c=convoy.checkpoint;
  return c.stage==='apron'?'apron':c.stage==='junction_one'?c.first:c.stage==='junction_two'?c.second:c.stage==='siege'?'siege':null;
}
export function bullionSpawn(save: CampaignSave): FreightPoint {
  const c=save.snapshot.convoy;
  if(!c)return layout.heroStart;
  const poses=new FreightConvoy(c).poses;
  return {x:poses[0].x+3.2,z:poses[0].z+2};
}
export const BULLION_COMMS: Record<'lex'|'firstJunction'|'secondJunction'|'siege'|'delivered',DialogueScene> = {
  lex:{id:'story.bullion.lex',lines:[
    {speaker:'LEX · TRUFI',text:'The cargo is here. The people are waiting. Every route between them has a seizure stamp.'},
    {speaker:'XRPMAN',text:'Then we take the route back with the cargo on it.'},
    {speaker:'LEX · TRUFI',text:'I can move these haulers. You keep their guns looking somewhere else. Stay nearby; I will hold at both junctions for your choice.'},
    {speaker:'CORN XRPL · COMMS',text:'Your Field Repair can reach their hulls. Walk up to a damaged hauler and use INTERACT. Let the tools recharge between repairs.'},
  ]},
  firstJunction:{id:'story.bullion.junction_one',lines:[
    {speaker:'LEX · TRUFI',text:'Express is short and exposed. The service lane has cover, but a longer haul. Your call.'},
    {speaker:'XRPMAN',text:'We stay with the cargo. No supplies left behind.'},
  ]},
  secondJunction:{id:'story.bullion.junction_two',lines:[
    {speaker:'BOO · COMMS',text:'A bombardment scanner is sweeping the east line. The west line runs close to its control post.'},
    {speaker:'LEX · TRUFI',text:'Pick a lane and I will commit. Clear the red barricade before we drive through.'},
  ]},
  siege:{id:'story.bullion.siege',lines:[
    {speaker:'MARKET SIEGE ENGINE',allegiance:'hostile',text:'Unscheduled delivery detected. Public distribution is suspended.'},
    {speaker:'LEX · TRUFI',text:'That thing moves its broadside across the whole exit. I am holding the cargo here.'},
    {speaker:'BOO · COMMS',text:'Look behind it when the mortar cycle vents. The red routing control is above the treads. Reveal can mark its position; fire from the rear.'},
    {speaker:'XRPMAN',text:'Dash between the warnings. Keep a repair ready for the haulers.'},
  ]},
  delivered:{id:'story.bullion.delivered',lines:[
    {speaker:'LEX · TRUFI',text:'There. Repairs, food, power cells. A balance sheet that actually reaches somebody.'},
    {speaker:'XRPMAN',text:'The route stays public. Come help us keep the ship running.'},
    {speaker:'LEX · TRUFI',text:'I will set up logistics at your bridge. A faster service module will let Field Repair cycle sooner around the haulers.'},
    {speaker:'BOO · COMMS',text:'Two more signatures. Rugfall is hiding evidence. SEC Outpost is hiding the people who can broadcast it.'},
    {speaker:'XRPMAN',text:'Keep both coordinates. We are coming for them.'},
  ]},
};
