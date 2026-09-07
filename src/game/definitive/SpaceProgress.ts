import type { CampaignSave, SaveResult } from './CampaignSave';
import { initialSpaceCheckpoint, type SpaceCheckpoint } from './SpaceCheckpoint';
export const SPACE_ENEMIES=['regulator_drone','fast_scout','fog_raider','rug_fighter','whale_scout'] as const;
export type SpaceEnemyKey=typeof SPACE_ENEMIES[number];
export const SPACE_MODELS=['regulatory_warship',...SPACE_ENEMIES.map(key=>`space_${key}`),'planet_earth','planet_mars'] as const;
export const PORTAL_POSITION=[0,0,-24000] as const;
export function insidePortal(checkpoint:SpaceCheckpoint):boolean{
  const [x,y,z]=checkpoint.position,[qx,qy]=checkpoint.orientation;
  return Math.hypot(x-PORTAL_POSITION[0],y-PORTAL_POSITION[1],z-PORTAL_POSITION[2])<140&&-(1-2*(qx*qx+qy*qy))<-.35;
}
export const SPACE_WAVES:readonly {at:number;label:string;enemies:readonly SpaceEnemyKey[]}[]=[
  {at:700,label:'Departure patrol',enemies:['regulator_drone','regulator_drone']},
  {at:6500,label:'Interception screen',enemies:['fast_scout','fog_raider']},
  {at:12500,label:'Armored blockade',enemies:['rug_fighter','fast_scout']},
  {at:19000,label:'Portal missile guard',enemies:['whale_scout','regulator_drone']},
];
/** Explicit section fixture; never grants ownership to the campaign save. */
export function prepareSpaceReview(save:CampaignSave):SaveResult {
  if(!save.testSlot)return {ok:false,reason:'condition'};
  return save.update(d=>{
    if(d.transit)return;
    d.warshipOwned=true;d.quests.push(...['boarding.bridge_secured','boarding.departure_ready'].filter(k=>!d.quests.includes(k)));
    if(!d.recruits.includes('mr_zamn'))d.recruits.push('mr_zamn');
  });
}
export function startTransit(save:CampaignSave):SaveResult {
  return save.update(d=>{
    if(!d.warshipOwned||!d.quests.includes('boarding.departure_ready'))return false;
    d.transit??=initialSpaceCheckpoint();
    d.location={mode:'space',world:d.transit.phase==='mars'?'mars':'ledger_prime',checkpoint:d.transit.phase==='mars'?'space.mars_orbit':'space.earth_departure'};
  });
}
export function checkpointTransit(save:CampaignSave,checkpoint:SpaceCheckpoint):SaveResult {
  return save.update(d=>{
    if(!d.warshipOwned||!d.transit||d.location.mode!=='space'||checkpoint.wave!==d.transit.wave||checkpoint.phase!==d.transit.phase)return false;
    d.transit=structuredClone(checkpoint);
  });
}
export function finishDeparture(save:CampaignSave,checkpoint:SpaceCheckpoint):SaveResult {
  return save.update(d=>{
    if(!d.warshipOwned||d.transit?.phase!=='departure')return false;
    d.transit={...structuredClone(checkpoint),phase:'transit'};d.location.checkpoint='space.patrol';
  });
}
export function clearSpaceWave(save:CampaignSave,checkpoint:SpaceCheckpoint):SaveResult {
  return save.claim(`reward.space.wave.${checkpoint.wave}`,d=>{
    if(!d.warshipOwned||d.transit?.phase!=='transit'||checkpoint.wave!==d.transit.wave||checkpoint.wave>=SPACE_WAVES.length)return false;
    d.transit={...structuredClone(checkpoint),wave:checkpoint.wave+1};d.credits+=100;
    d.location.checkpoint=`space.wave.${checkpoint.wave+1}`;
  });
}
export function arriveMars(save:CampaignSave,checkpoint:SpaceCheckpoint):SaveResult {
  return save.claim('reward.space.mars_arrival',d=>{
    if(!d.warshipOwned||d.transit?.phase!=='transit'||d.transit.wave!==SPACE_WAVES.length||checkpoint.wave!==SPACE_WAVES.length||!insidePortal(checkpoint)||!d.dialogueSeen.includes('story.earth.portal'))return false;
    d.transit={...structuredClone(checkpoint),phase:'mars'};
    d.location={mode:'space',world:'mars',checkpoint:'space.mars_orbit'};
    d.quests.push('mars.orbit_reached');
    d.earth.currentPlanet='mars';if(!d.earth.discoveredPlanets.includes('mars'))d.earth.discoveredPlanets.push('mars');
  });
}
