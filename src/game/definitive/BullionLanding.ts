import type {CampaignSave,SaveResult} from './CampaignSave';
import {BULLION_APPROACH} from './SpaceRoutes';
import {bullionPresent} from './BullionReach';
import {prepareFogReview} from './FogMoon';

const add=(items:string[],item:string)=>{if(!items.includes(item))items.push(item);};
export function beginBullionLanding(save:CampaignSave):SaveResult{
  if(bullionPresent(save))return{ok:true,changed:false};const d=save.snapshot,t=d.transit;
  if(!d.warshipOwned||d.location.mode!=='space'||d.location.world!=='bullion_reach'||t?.route!=='fog_bullion_reach'||t.phase!=='arrival'||t.hull<=0||Math.hypot(t.position[0]-BULLION_APPROACH.x,t.position[1]-BULLION_APPROACH.y,t.position[2]-BULLION_APPROACH.z)>=480)return{ok:false,reason:'condition'};
  return save.update(d=>{add(d.quests,'bullion_reach.landed');d.location={mode:'surface',world:'bullion_reach',checkpoint:d.convoy?'bullion_reach.'+d.convoy.stage:'bullion_reach.landing'};});
}
/** Explicit disposable section slot; the campaign never receives fixture grants. */
export function prepareBullionReview(save:CampaignSave):SaveResult{
  if(!save.testSlot)return{ok:false,reason:'condition'};if(save.snapshot.quests.includes('bullion_reach.landed'))return{ok:true,changed:false};const ready=prepareFogReview(save);if(!ready.ok)return ready;
  return save.update(d=>{for(const q of ['fog_moon.boo_met','fog_moon.relay.west','fog_moon.relay.east','fog_moon.restored','bullion_reach.voyage_started','bullion_reach.orbit_reached','bullion_reach.landed'])add(d.quests,q);add(d.recruits,'boo');d.heroUpgrades.spectral_reveal=1;d.transit={route:'fog_bullion_reach',phase:'arrival',position:BULLION_APPROACH.toArray() as [number,number,number],orientation:[0,0,0,1],wave:3,seconds:0,hull:100,fore:100,aft:100};d.location={mode:'surface',world:'bullion_reach',checkpoint:'bullion_reach.landing'};d.earth.currentPlanet='bullion_reach';add(d.earth.discoveredPlanets,'bullion_reach');});
}
