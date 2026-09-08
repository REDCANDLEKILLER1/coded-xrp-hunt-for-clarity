import {CapitalTactics} from './CapitalTactics';
import type { CampaignSave, SaveResult } from './CampaignSave';
import { initialSpaceCheckpoint, type SpaceCheckpoint } from './SpaceCheckpoint';
import {EARTH_MARS_ROUTE,atSpaceDestination,spaceRoute} from './SpaceRoutes';
import {canStartFogVoyage,canStartBullionVoyage} from './CampaignNavigation';
export type {SpaceEnemyKey} from './SpaceRoutes';
export const SPACE_ENEMIES=['regulator_drone','fast_scout','fog_raider','rug_fighter','whale_scout'] as const;
export const SPACE_MODELS=['regulatory_warship',...SPACE_ENEMIES.map(key=>`space_${key}`),'planet_earth','planet_mars','capital_blockade'] as const;
export const PORTAL_POSITION=EARTH_MARS_ROUTE.portal;
export function spaceModels(checkpoint:SpaceCheckpoint):string[]{const route=spaceRoute(checkpoint);return ['regulatory_warship',...SPACE_ENEMIES.map(key=>`space_${key}`),route.sourceModel,route.destinationModel,'capital_blockade'];}
const sameRoute=(a:SpaceCheckpoint,b:SpaceCheckpoint)=>(a.route??'earth_mars')===(b.route??'earth_mars');
export function insidePortal(checkpoint:SpaceCheckpoint):boolean{
  const [x,y,z]=checkpoint.position,[qx,qy]=checkpoint.orientation,portal=spaceRoute(checkpoint).portal;
  return Math.hypot(x-portal[0],y-portal[1],z-portal[2])<140&&-(1-2*(qx*qx+qy*qy))<-.35;
}
export const SPACE_WAVES=EARTH_MARS_ROUTE.waves;
export function canPlotFogMoon(save:CampaignSave):boolean{return canStartFogVoyage(save.snapshot);}
export function fogVoyageCheckpoint(save:CampaignSave):SpaceCheckpoint|null{if(!canPlotFogMoon(save))return null;const t=save.snapshot.transit!;return {...initialSpaceCheckpoint(),route:'mars_fog_moon',hull:t.hull,fore:t.fore,aft:t.aft};}
export function beginFogVoyage(save:CampaignSave):SaveResult{const next=fogVoyageCheckpoint(save);if(!next)return{ok:false,reason:'condition'};return save.update(d=>{d.transit=next;d.location={mode:'space',world:'mars',checkpoint:'space.mars_fog_moon.departure'};if(!d.quests.includes('fog_moon.voyage_started'))d.quests.push('fog_moon.voyage_started');});}
export function canPlotBullionReach(save:CampaignSave):boolean{return canStartBullionVoyage(save.snapshot);}
export function bullionVoyageCheckpoint(save:CampaignSave):SpaceCheckpoint|null{if(!canPlotBullionReach(save))return null;const t=save.snapshot.transit!;return {...initialSpaceCheckpoint(),route:'fog_bullion_reach',hull:t.hull,fore:t.fore,aft:t.aft};}
export function beginBullionVoyage(save:CampaignSave):SaveResult{const next=bullionVoyageCheckpoint(save);if(!next)return{ok:false,reason:'condition'};return save.update(d=>{d.transit=next;d.location={mode:'space',world:'fog_moon',checkpoint:'space.fog_bullion_reach.departure'};if(!d.quests.includes('bullion_reach.voyage_started'))d.quests.push('bullion_reach.voyage_started');});}
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
    const route=spaceRoute(d.transit),arrived=atSpaceDestination(d.transit);
    d.location={mode:'space',world:arrived?route.destination:route.source,checkpoint:route.id==='earth_mars'?(arrived?'space.mars_orbit':'space.earth_departure'):`space.${route.id}.${arrived?'orbit':'departure'}`};
  });
}
export function checkpointTransit(save:CampaignSave,checkpoint:SpaceCheckpoint):SaveResult {
  return save.update(d=>{
    if(!d.warshipOwned||!d.transit||d.location.mode!=='space'||checkpoint.wave!==d.transit.wave||checkpoint.phase!==d.transit.phase||!sameRoute(checkpoint,d.transit))return false;
    d.transit=structuredClone(checkpoint);
  });
}
export function finishDeparture(save:CampaignSave,checkpoint:SpaceCheckpoint):SaveResult {
  return save.update(d=>{
    if(!d.warshipOwned||d.location.mode!=='space'||checkpoint.phase!=='departure'||checkpoint.hull<=0||d.transit?.phase!=='departure'||!sameRoute(checkpoint,d.transit))return false;
    d.transit={...structuredClone(checkpoint),phase:'transit'};d.location.checkpoint='space.patrol';
  });
}
export function clearSpaceWave(save:CampaignSave,checkpoint:SpaceCheckpoint):SaveResult {
  const route=spaceRoute(checkpoint);
  if(route.waves[checkpoint.wave]?.capital&&(!checkpoint.blockade||!new CapitalTactics(checkpoint.wave,checkpoint.blockade).defeated))return {ok:false,reason:'condition'};
  return save.claim(route.id==='earth_mars'?`reward.space.wave.${checkpoint.wave}`:`reward.space.${route.id}.wave.${checkpoint.wave}`,d=>{
    if(!d.warshipOwned||d.location.mode!=='space'||checkpoint.phase!=='transit'||checkpoint.hull<=0||d.transit?.phase!=='transit'||!sameRoute(checkpoint,d.transit)||checkpoint.wave!==d.transit.wave||checkpoint.wave>=route.waves.length)return false;
    d.transit={...structuredClone(checkpoint),wave:checkpoint.wave+1};delete d.transit.blockade;d.credits+=100;
    d.location.checkpoint=`space.wave.${checkpoint.wave+1}`;
  });
}
export function arriveMars(save:CampaignSave,checkpoint:SpaceCheckpoint):SaveResult {
  return save.claim('reward.space.mars_arrival',d=>{
    if(!d.warshipOwned||d.location.mode!=='space'||checkpoint.phase!=='transit'||checkpoint.hull<=0||d.transit?.phase!=='transit'||spaceRoute(checkpoint).id!=='earth_mars'||!sameRoute(checkpoint,d.transit)||d.transit.wave!==SPACE_WAVES.length||checkpoint.wave!==SPACE_WAVES.length||!insidePortal(checkpoint)||!d.dialogueSeen.includes('story.earth.portal'))return false;
    d.transit={...structuredClone(checkpoint),phase:'mars'};
    d.location={mode:'space',world:'mars',checkpoint:'space.mars_orbit'};
    d.quests.push('mars.orbit_reached');
    d.earth.currentPlanet='mars';if(!d.earth.discoveredPlanets.includes('mars'))d.earth.discoveredPlanets.push('mars');
  });
}
export function arriveSpaceDestination(save:CampaignSave,checkpoint:SpaceCheckpoint):SaveResult{
  const route=spaceRoute(checkpoint);if(route.id==='earth_mars')return arriveMars(save,checkpoint);
  return save.claim(`reward.space.${route.destination}_arrival`,d=>{
    if(!d.warshipOwned||d.location.mode!=='space'||checkpoint.phase!=='transit'||checkpoint.hull<=0||d.transit?.phase!=='transit'||!sameRoute(checkpoint,d.transit)||d.transit.wave!==route.waves.length||checkpoint.wave!==route.waves.length||!insidePortal(checkpoint)||!d.dialogueSeen.includes(route.briefing.id))return false;
    d.transit={...structuredClone(checkpoint),phase:'arrival'};d.location={mode:'space',world:route.destination,checkpoint:`space.${route.destination}_orbit`};
    if(!d.quests.includes(`${route.destination}.orbit_reached`))d.quests.push(`${route.destination}.orbit_reached`);d.earth.currentPlanet=route.destination;if(!d.earth.discoveredPlanets.includes(route.destination))d.earth.discoveredPlanets.push(route.destination);
  });
}
