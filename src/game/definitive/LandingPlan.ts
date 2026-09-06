import { Vector3 } from 'three';
import deck from './boarding-deck.json';
import type { CampaignSave, SaveResult } from './CampaignSave';

export const FIGHTER_MODELS = {player:'fighter_player',xrpl_striker:'fighter_xrpl_striker',ledger_warden:'fighter_ledger_warden'} as const;
export function fighterModel(key:string):string {return FIGHTER_MODELS[key as keyof typeof FIGHTER_MODELS]??FIGHTER_MODELS.player;}
export const LANDING_DURATION=18;
export const PARKED_HEIGHT=.505;
export function dockFighter(save:CampaignSave):SaveResult {
  return save.update(draft=>{
    if(draft.warshipOwned)return false;
    if(!draft.quests.includes('boarding.landed'))draft.quests.push('boarding.landed');
    draft.location={mode:'boarding',world:'ledger_prime',checkpoint:'boarding.hangar'};
    if(!draft.visitedRooms.includes('boarding.hangar'))draft.visitedRooms.push('boarding.hangar');
  });
}
const smooth=(t:number):number=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};

/** One measured trajectory is shared by the cinematic and shell-clearance test. */
export function landingPose(seconds:number):{fighter:Vector3;camera:Vector3;target:Vector3;lift:number;stage:'approach'|'recovery'|'docked'} {
  const approach=smooth(seconds/10),lift=smooth((seconds-10)/7);
  const fighter=new Vector3(0,-18+(deck.frame.floorInShip+PARKED_HEIGHT+18)*lift,-90+62*approach);
  const camera=new Vector3(72,-52,-132).lerp(new Vector3(10,-13,-46),smooth(seconds/13));
  const target=new Vector3(0,-2,-16).lerp(fighter,smooth(seconds/8)*.7);
  return {fighter,camera,target,lift,stage:seconds<10?'approach':seconds<17?'recovery':'docked'};
}
