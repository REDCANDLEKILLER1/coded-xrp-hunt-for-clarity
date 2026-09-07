import {Vector3} from 'three';
import type {SpaceCheckpoint,SpaceRouteId} from './SpaceCheckpoint';
import type {FlightPlanet} from './PlanetApproach';
import {EARTH_FLIGHT,MARS_APPROACH,MARS_FLIGHT} from './PlanetApproach';
import type {DialogueScene} from './Dialogue';
import {PORTAL_COMMS} from './CommsPanel';
export type SpaceEnemyKey='regulator_drone'|'fast_scout'|'fog_raider'|'rug_fighter'|'whale_scout';
export interface SpaceWave{at:number;label:string;enemies:readonly SpaceEnemyKey[]}
export interface SpaceRoute{
  id:SpaceRouteId;source:'ledger_prime'|'mars';destination:'mars'|'fog_moon';label:string;arrivalLabel:string;approachLabel:string;
  sourceModel:string;destinationModel:string;sourcePlanet:FlightPlanet;destinationPlanet:FlightPlanet;approach:Vector3;portal:readonly [number,number,number];waves:readonly SpaceWave[];briefing:DialogueScene;
}
export const FOG_FLIGHT:FlightPlanet={center:[0,-1000,-23000],radius:3000};
export const FOG_APPROACH=new Vector3(0,1000,8000).normalize().multiplyScalar(4000).add(new Vector3(...FOG_FLIGHT.center));
export const EARTH_MARS_ROUTE:SpaceRoute={
  id:'earth_mars',source:'ledger_prime',destination:'mars',label:'EARTH → MARS',arrivalLabel:'MARS ORBIT',approachLabel:'RELIEF APPROACH',sourceModel:'planet_earth',destinationModel:'planet_mars',sourcePlanet:EARTH_FLIGHT,destinationPlanet:MARS_FLIGHT,approach:MARS_APPROACH,portal:[0,0,-24000],briefing:PORTAL_COMMS,
  waves:[{at:700,label:'Departure patrol',enemies:['regulator_drone','regulator_drone']},{at:6500,label:'Interception screen',enemies:['fast_scout','fog_raider']},{at:12500,label:'Armored blockade',enemies:['rug_fighter','fast_scout']},{at:19000,label:'Portal missile guard',enemies:['whale_scout','regulator_drone']}],
};
export const MARS_FOG_ROUTE:SpaceRoute={
  id:'mars_fog_moon',source:'mars',destination:'fog_moon',label:'MARS → FOG MOON',arrivalLabel:'FOG MOON ORBIT',approachLabel:'SCOUT SHELTER',sourceModel:'planet_mars',destinationModel:'planet_fog_moon',sourcePlanet:{center:[-600,-6500,4200],radius:4400},destinationPlanet:FOG_FLIGHT,approach:FOG_APPROACH,portal:[0,0,-15000],
  waves:[{at:900,label:'Silent interception',enemies:['fog_raider','fast_scout']},{at:5300,label:'Crossing sensor pickets',enemies:['fast_scout','fast_scout']},{at:11200,label:'Citadel freight guard',enemies:['whale_scout','fog_raider']}],
  briefing:{id:'story.mars.fog_portal',lines:[{speaker:'CORN XRPL · COMMS',text:'The pumps are feeding the settlements again. These freight records go straight through the Fog.'},{speaker:'STONE · COMMS',text:'A scout signal is coming from the moon. Every other return is identical. Someone wants us chasing copies.'},{speaker:'XRPMAN',text:'Keep the real signal. We follow it down.'}]},
};
export function spaceRoute(checkpoint:Pick<SpaceCheckpoint,'route'>):SpaceRoute{return checkpoint.route==='mars_fog_moon'?MARS_FOG_ROUTE:EARTH_MARS_ROUTE;}
export function atSpaceDestination(checkpoint:Pick<SpaceCheckpoint,'phase'>):boolean{return checkpoint.phase==='mars'||checkpoint.phase==='arrival';}
