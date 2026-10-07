import type {WeaponDef} from './types';

export const FIGHTER_FAMILIES=['bb','pulse','rocket','plasma','ledger'] as const;
export type FighterFamily=typeof FIGHTER_FAMILIES[number];
export interface FighterWeapon extends WeaponDef {family:FighterFamily;stage:number;speed:number;splash:number;chain:number;laserPulse?:boolean}
export interface FighterWeaponState {family:FighterFamily;rank:number;rapid:number;level?:number;power?:number}
export const FAMILY_INFO:Record<FighterFamily,{label:string;unlock:number;description:string}>={
  bb:{label:'LIQUIDITY BEAM',unlock:1,description:'Single, twin, tri and quad forward coverage.'},
  pulse:{label:'PULSE LANCE',unlock:4,description:'Penetrates a line of enemies.'},
  rocket:{label:'LIQUIDITY ROCKET',unlock:7,description:'Physical rockets burst against nearby targets.'},
  plasma:{label:'PLASMA HAMMER',unlock:10,description:'Slower, deliberate heavy impacts.'},
  ledger:{label:'LEDGER ARC',unlock:13,description:'Energy chains to a bounded number of nearby enemies.'},
};
export const RAPID_CAP=4;
/** Compact earned firepower tier fits the existing 0..20 upgrade save format. */
const POWER_BASE=1/.14,POWER_STEP=1.14;
export function retainedWeaponPower(state:FighterWeaponState):number {
  const weapon=fighterWeapon({...state,rapid:0});
  const dps=weapon.damage*weapon.shots.length/weapon.fireRate;
  return Math.max(state.power??0,Math.min(20,Math.ceil(Math.log(dps/POWER_BASE)/Math.log(POWER_STEP)-1e-9)));
}
/** Next earned family; selecting it never skips its mastery unlock. */
export function nextFighterFamily(state:FighterWeaponState):FighterFamily|null {
  if(state.level!==undefined)return state.level<20?fighterFamilyAtLevel(state.level+1):null;
  const next=FIGHTER_FAMILIES[FIGHTER_FAMILIES.indexOf(state.family)+1];
  return next&&fighterStage(next,state.rank)>0?next:null;
}
export const TWIN_SEEKER_INTERVAL=6;
export const TWIN_SEEKER_MAX_ACTIVE=4;
export const ROMAN=['I','II','III','IV'];
export function fighterStage(family:FighterFamily,rank:number):number {return Math.max(0,Math.min(4,Math.floor(rank)-FAMILY_INFO[family].unlock+1));}
export function fighterFamilyAtLevel(level:number):FighterFamily {return FIGHTER_FAMILIES[Math.floor((Math.max(1,Math.min(20,level))-1)/4)];}
export function fighterStageForState(state:FighterWeaponState,family:FighterFamily):number {
  return state.level===undefined?fighterStage(family,state.rank):Math.max(0,Math.min(4,state.level-FIGHTER_FAMILIES.indexOf(family)*4));
}
const lanes=(offsets:number[])=>offsets.map(offsetX=>({offsetX,angle:0}));
/** All stages preserve forward center coverage. Family switching is voluntary;
 * each family progresses independently through four non-decreasing stages. */
export function fighterWeapon(state:FighterWeaponState):FighterWeapon {
  const family=fighterStageForState(state,state.family)?state.family:'bb';
  const stage=Math.max(1,fighterStageForState(state,family)),i=stage-1;
  const base={family,stage,key:`fighter.${family}.${stage}`,label:`${FAMILY_INFO[family].label} ${ROMAN[i]}`,tier:stage,projectileKey:'bb_shot',splash:0,chain:0,pierce:0,speed:720};
  let weapon:FighterWeapon;
  if(family==='bb')weapon={...base,damage:[1,1.15,1.4,1.8][i],fireRate:[.14,.135,.13,.125][i],shots:lanes([[0],[-3,3],[-5,0,5],[-6,-2,2,6]][i])};
  else if(family==='pulse')weapon={...base,damage:[2.5,3.5,4.5,6][i],fireRate:[.22,.21,.2,.19][i],shots:lanes(i<2?[0]:[-3,3]),pierce:[1,2,3,4][i],speed:760,projectileKey:'clarity_beam'};
  else if(family==='rocket')weapon={...base,damage:[5,7,10,14][i],fireRate:[.45,.43,.4,.37][i],shots:lanes(i===3?[-3,3]:[0]),speed:520,splash:[44,54,64,76][i]};
  else if(family==='plasma')weapon={...base,damage:[7,10,16,19][i],fireRate:[.52,.49,.46,.42][i],shots:lanes([0]),speed:570,splash:[0,16,22,30][i]};
  else weapon={...base,damage:[5,7,9,12][i],fireRate:[.3,.28,.26,.24][i],shots:lanes([0]),speed:840,chain:[1,2,2,3][i],projectileKey:'clarity_beam'};
  const floor=state.power?POWER_BASE*Math.pow(POWER_STEP,Math.min(20,state.power)):0;
  weapon.damage=Math.max(weapon.damage,floor*weapon.fireRate/weapon.shots.length);
  const rapid=Math.max(0,Math.min(RAPID_CAP,Math.floor(state.rapid)));
  const laserPulse=rapid===RAPID_CAP&&(family==='bb'||family==='pulse');
  return{...weapon,fireRate:weapon.fireRate/(1+rapid*.12),laserPulse,
    ...(laserPulse?{label:`LASER PULSE ${ROMAN[i]}`,projectileKey:'clarity_beam',speed:860}:{}),
  };
}

/** Each rocket is worth up to ten baseline rounds, while the PAIR adds at
 * most 20% sustained primary DPS. No splash or pierce multiplies this budget. */
export function fighterTwinSeekers(state:FighterWeaponState,cadenceScale=1):{damage:number;interval:number;dps:number}|null {
  if(state.rapid<RAPID_CAP)return null;
  const weapon=fighterWeapon(state);
  const primaryDps=weapon.damage*weapon.shots.length/(weapon.fireRate*Math.max(.1,cadenceScale));
  const baselineRound=[1,1.15,1.4,1.8][Math.max(0,fighterStage('bb',state.rank)-1)];
  const damage=Math.min(baselineRound*10,primaryDps*TWIN_SEEKER_INTERVAL*.1);
  return{damage,interval:TWIN_SEEKER_INTERVAL,dps:damage*2/TWIN_SEEKER_INTERVAL};
}

export interface FighterArmoryPort {
  readonly active:boolean;
  readonly state:FighterWeaponState;
  readonly weapon:FighterWeapon;
  /**
   * Migrate an arcade checkpoint in. `legacyDps` is the sustained damage the
   * player was ACTUALLY putting out, measured by the engine through its own
   * volley, so the mapping never has to model the arcade ladder itself.
   */
  begin(rank:number,barrels:number,baseTier:number,legacyDps?:number):boolean;
  rankUp(rank:number):boolean;
  upgradeRapid():boolean;
  upgradeWeapon():boolean;
  setActive(value:boolean):void;
  block():void;
  update(safe:boolean):boolean;
}
