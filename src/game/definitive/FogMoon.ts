import {Vector3} from 'three';
import type {CampaignSave,SaveResult} from './CampaignSave';
import type {DialogueScene} from './Dialogue';
import type {SurfacePoint} from './SurfaceCombat';
import {FOG_APPROACH} from './SpaceRoutes';
import {prepareExcavationReview} from './MarsExcavation';
export const FOG_LANDING={x:5,z:29},BOO_POSITION={x:-3,z:23};
export const FOG_RELAYS=[{id:'west',x:-16,z:6,trueFeed:2,label:'WEST ARCHIVE'},{id:'east',x:16,z:-2,trueFeed:0,label:'EAST UPLINK'}] as const;
export const FEED_NAMES=['A · TRIANGLE','B · SQUARE','C · DIAMOND'] as const;
export const FOG_GUARDS=[{x:-4,z:20,sector:'shelter'},{x:5,z:19,sector:'shelter'},{x:-17,z:12,sector:'west'},{x:-13,z:-3,sector:'west'},{x:15,z:10,sector:'east'},{x:18,z:-8,sector:'east'}] as const;
const add=(array:string[],id:string)=>{if(!array.includes(id))array.push(id);};
export const fogPresent=(save:CampaignSave)=>{const d=save.snapshot;return d.warshipOwned&&d.location.mode==='surface'&&d.location.world==='fog_moon'&&d.quests.includes('fog_moon.landed');};
export const nearFog=(a:SurfacePoint,b:SurfacePoint,r=3)=>Number.isFinite(a.x)&&Number.isFinite(a.z)&&Math.hypot(a.x-b.x,a.z-b.z)<r;
export function beginFogLanding(save:CampaignSave):SaveResult{
  if(fogPresent(save))return{ok:true,changed:false};const d=save.snapshot,t=d.transit;
  if(!d.warshipOwned||d.location.mode!=='space'||d.location.world!=='fog_moon'||t?.route!=='mars_fog_moon'||t.phase!=='arrival'||t.hull<=0||new Vector3(...t.position).distanceTo(FOG_APPROACH)>=480)return{ok:false,reason:'condition'};
  return save.update(d=>{add(d.quests,'fog_moon.landed');d.location={mode:'surface',world:'fog_moon',checkpoint:'fog_moon.landing'};});
}
export function meetBoo(save:CampaignSave,at:SurfacePoint,guards:number):SaveResult{
  if(!fogPresent(save)||!nearFog(at,BOO_POSITION)||guards!==0)return{ok:false,reason:'condition'};
  return save.update(d=>{add(d.quests,'fog_moon.boo_met');add(d.dialogueSeen,FOG_COMMS.boo.id);d.heroUpgrades.spectral_reveal=1;d.location.checkpoint='fog_moon.shelter';});
}
export function resolveFogRelay(save:CampaignSave,index:number,feed:number,at:SurfacePoint,guards:number,revealed:boolean):SaveResult{
  const relay=FOG_RELAYS[index],d=save.snapshot;
  if(!relay||!fogPresent(save)||!d.heroUpgrades.spectral_reveal||!nearFog(at,{x:relay.x,z:relay.z+3})||guards!==0||!revealed||feed!==relay.trueFeed||(index===1&&!d.quests.includes('fog_moon.relay.west')))return{ok:false,reason:'condition'};
  return save.claim('reward.fog_moon.relay.'+relay.id,d=>{add(d.quests,'fog_moon.relay.'+relay.id);d.location.checkpoint='fog_moon.relay.'+relay.id;d.credits+=70;});
}
export function completeFogCitadel(save:CampaignSave,defeated:boolean):SaveResult{
  if(!defeated||!fogPresent(save)||!FOG_RELAYS.every(r=>save.snapshot.quests.includes('fog_moon.relay.'+r.id)))return{ok:false,reason:'condition'};
  return save.claim('reward.fog_moon.citadel',d=>{add(d.quests,'fog_moon.restored');add(d.recruits,'boo');add(d.dialogueSeen,FOG_COMMS.restored.id);add(d.earth.clearedPlanets,'fog_moon');add(d.earth.defeatedSurfaceBosses,'fog_moon');add(d.earth.discoveredPlanets,'bullion_reach');d.location.checkpoint='fog_moon.citadel_complete';d.credits+=300;});
}
/** Real walkway footprint. The empty canyon is not traversable ground. */
export function fogClear(p:SurfacePoint):boolean{
  const inside=Math.abs(p.x)<=8&&p.z>=20&&p.z<=38||Math.abs(p.x)<=22&&p.z>=18&&p.z<=26||Math.abs(p.x)>=10&&Math.abs(p.x)<=22&&p.z>=-12&&p.z<=26||Math.abs(p.x)<=22&&p.z>=-16&&p.z<=-4||Math.abs(p.x)<=18&&p.z>=-38&&p.z<=-16;
  return inside&&!FOG_RELAYS.some(r=>Math.abs(p.x-r.x)<3.2&&Math.abs(p.z-r.z)<1.1)&&!nearFog(p,BOO_POSITION,.7);
}
export function fogSpawn(save:CampaignSave):SurfacePoint{
  const c=save.snapshot.location.checkpoint;if(c==='fog_moon.citadel_complete')return{x:0,z:-26};if(c==='fog_moon.relay.east')return{x:16,z:1};if(c==='fog_moon.relay.west')return{x:-16,z:9};if(c==='fog_moon.shelter')return{x:0,z:23};return FOG_LANDING;
}
/** Isolated direct-section fixture only. */
export function prepareFogReview(save:CampaignSave):SaveResult{
  if(!save.testSlot)return{ok:false,reason:'condition'};if(save.snapshot.quests.includes('fog_moon.landed'))return{ok:true,changed:false};const ready=prepareExcavationReview(save);if(!ready.ok)return ready;
  return save.update(d=>{for(const q of ['mars.route_secured','mars.margin_warden_defeated','mars.restored','fog_moon.voyage_started','fog_moon.orbit_reached','fog_moon.landed'])add(d.quests,q);d.heroUpgrades.liquidity_dash=1;d.transit={route:'mars_fog_moon',phase:'arrival',position:FOG_APPROACH.toArray() as [number,number,number],orientation:[0,0,0,1],wave:3,seconds:0,hull:100,fore:100,aft:100};d.location={mode:'surface',world:'fog_moon',checkpoint:'fog_moon.landing'};d.earth.currentPlanet='fog_moon';add(d.earth.discoveredPlanets,'fog_moon');});
}
export const FOG_COMMS:Record<'boo'|'citadel'|'restored',DialogueScene>={
  boo:{id:'story.fog.boo',lines:[{speaker:'BOO',text:'Six distress calls. Same scream, same breath, same little mistake. I was starting to feel copied.'},{speaker:'XRPMAN',text:'You are the real scout?'},{speaker:'BOO',text:'The real ghost. Different paperwork. My Reveal pulse traces a signal back to its source. Try it at the west archive; the genuine feed keeps its shape.'},{speaker:'STONE · COMMS',text:'Five seconds of clarity, twelve to recharge. Saved relay clues stay in your log.'}]},
  citadel:{id:'story.fog.citadel',lines:[{speaker:'FOG RELAY CITADEL',allegiance:'hostile',text:'Public signals have been replaced for your protection. Trust the majority return.'},{speaker:'BOO',text:'Three voices, one throat. Reveal the real feed when the reflectors open. The others are noise.'},{speaker:'XRPMAN',text:'We will give everyone their own voice back.'}]},
  restored:{id:'story.fog.restored',lines:[{speaker:'STONE · COMMS',text:'Separate signals. People, ships, whole settlements. The copies are gone.'},{speaker:'BOO',text:'Much better. I like a crowd with different screams. I am coming with you.'},{speaker:'XRPMAN',text:'Keep the relay public. Where was the false feed coming from?'},{speaker:'BOO',text:'Bullion Reach. Somebody paid a lot to make truth look cheap.'}]},
};
