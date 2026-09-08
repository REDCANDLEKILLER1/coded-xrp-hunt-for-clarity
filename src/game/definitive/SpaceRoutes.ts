import {Vector3} from 'three';
import type {SpaceCheckpoint,SpaceRouteId} from './SpaceCheckpoint';
import type {FlightPlanet} from './PlanetApproach';
import {EARTH_FLIGHT,MARS_APPROACH,MARS_FLIGHT} from './PlanetApproach';
import type {DialogueScene} from './Dialogue';
import {PORTAL_COMMS} from './CommsPanel';
export type SpaceEnemyKey='regulator_drone'|'fast_scout'|'fog_raider'|'rug_fighter'|'whale_scout';
export interface SpaceWave{at:number;label:string;enemies:readonly SpaceEnemyKey[];doctrine?:'bomber_lanes';capital?:'dreadnought'|'carrier'}
export interface SpaceRoute{
  id:SpaceRouteId;source:'ledger_prime'|'mars'|'fog_moon';destination:'mars'|'fog_moon'|'bullion_reach';label:string;arrivalLabel:string;approachLabel:string;
  sourceModel:string;destinationModel:string;sourcePlanet:FlightPlanet;destinationPlanet:FlightPlanet;approach:Vector3;portal:readonly [number,number,number];waves:readonly SpaceWave[];briefing:DialogueScene;
}
export const FOG_FLIGHT:FlightPlanet={center:[0,-1000,-23000],radius:3000};
export const FOG_APPROACH=new Vector3(0,1000,8000).normalize().multiplyScalar(4000).add(new Vector3(...FOG_FLIGHT.center));
export const EARTH_MARS_ROUTE:SpaceRoute={
  id:'earth_mars',source:'ledger_prime',destination:'mars',label:'EARTH → MARS',arrivalLabel:'MARS ORBIT',approachLabel:'RELIEF APPROACH',sourceModel:'planet_earth',destinationModel:'planet_mars',sourcePlanet:EARTH_FLIGHT,destinationPlanet:MARS_FLIGHT,approach:MARS_APPROACH,portal:[0,0,-24000],briefing:PORTAL_COMMS,
  waves:[{at:700,label:'Departure patrol',enemies:['regulator_drone','regulator_drone']},{at:6500,label:'Interception screen',enemies:['fast_scout','fog_raider']},{at:12500,label:'Red Candle dreadnought',enemies:['fast_scout'],capital:'dreadnought'},{at:19000,label:'Portal missile guard',enemies:['whale_scout','regulator_drone']}],
};
export const MARS_FOG_ROUTE:SpaceRoute={
  id:'mars_fog_moon',source:'mars',destination:'fog_moon',label:'MARS → FOG MOON',arrivalLabel:'FOG MOON ORBIT',approachLabel:'SCOUT SHELTER',sourceModel:'planet_mars',destinationModel:'planet_fog_moon',sourcePlanet:{center:[-600,-6500,4200],radius:4400},destinationPlanet:FOG_FLIGHT,approach:FOG_APPROACH,portal:[0,0,-15000],
  waves:[{at:900,label:'Silent interception',enemies:['fog_raider','fast_scout']},{at:5300,label:'Crossing sensor pickets',enemies:['fast_scout','fast_scout']},{at:11200,label:'Citadel freight guard',enemies:['whale_scout','fog_raider']}],
  briefing:{id:'story.mars.fog_portal',lines:[{speaker:'CORN XRPL · COMMS',text:'The pumps are feeding the settlements again. These freight records go straight through the Fog.'},{speaker:'STONE · COMMS',text:'A scout signal is coming from the moon. Every other return is identical. Someone wants us chasing copies.'},{speaker:'XRPMAN',text:'Keep the real signal. We follow it down.'}]},
};
export const BULLION_FLIGHT:FlightPlanet={center:[0,-1200,-25500],radius:3800};
export const BULLION_APPROACH=new Vector3(0,1200,8000).normalize().multiplyScalar(4900).add(new Vector3(...BULLION_FLIGHT.center));
export const FOG_BULLION_ROUTE:SpaceRoute={
  id:'fog_bullion_reach',source:'fog_moon',destination:'bullion_reach',label:'FOG MOON → BULLION REACH',arrivalLabel:'BULLION REACH ORBIT',approachLabel:'PUBLIC FREIGHT APRON',sourceModel:'planet_fog_moon',destinationModel:'planet_bullion_reach',sourcePlanet:{center:[-400,-5200,3300],radius:3000},destinationPlanet:BULLION_FLIGHT,approach:BULLION_APPROACH,portal:[0,0,-17500],
  waves:[{at:950,label:'Freight-lane bombers',enemies:['rug_fighter','rug_fighter'],doctrine:'bomber_lanes'},{at:6300,label:'Crossing bombardment screen',enemies:['rug_fighter','fast_scout'],doctrine:'bomber_lanes'},{at:12600,label:'Seizure carrier blockade',enemies:['rug_fighter'],capital:'carrier'}],
  briefing:{id:'story.fog.bullion_portal',lines:[{speaker:'BOO · COMMS',text:'The freight signal is real. Two haulers, medical cells, water filters. None of it has moved.'},{speaker:'LEX · TRUFI',text:'If anyone can hear this, do not shoot the green haulers. Shoot the people keeping them here.'},{speaker:'XRPMAN',text:'We heard you. Keep your engines ready.'}]},
};
export const SPACE_ROUTES:Readonly<Record<SpaceRouteId,SpaceRoute>>={earth_mars:EARTH_MARS_ROUTE,mars_fog_moon:MARS_FOG_ROUTE,fog_bullion_reach:FOG_BULLION_ROUTE};
export function spaceRoute(checkpoint:Pick<SpaceCheckpoint,'route'>):SpaceRoute{return SPACE_ROUTES[checkpoint.route??'earth_mars'];}
export function atSpaceDestination(checkpoint:Pick<SpaceCheckpoint,'phase'>):boolean{return checkpoint.phase==='mars'||checkpoint.phase==='arrival';}
