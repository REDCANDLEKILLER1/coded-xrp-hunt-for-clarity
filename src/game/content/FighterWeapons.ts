import type {WeaponDef} from './types';

export const FIGHTER_FAMILIES=['bb','pulse','rocket','plasma','ledger'] as const;
export type FighterFamily=typeof FIGHTER_FAMILIES[number];
export interface FighterWeapon extends WeaponDef {family:FighterFamily;stage:number;speed:number;splash:number;chain:number}
export interface FighterWeaponState {family:FighterFamily;rank:number;rapid:number}
export const FAMILY_INFO:Record<FighterFamily,{label:string;unlock:number;description:string}>={
  bb:{label:'LIQUIDITY BEAM',unlock:1,description:'Single, twin, tri and quad forward coverage.'},
  pulse:{label:'PULSE LANCE',unlock:4,description:'Penetrates a line of enemies.'},
  rocket:{label:'LIQUIDITY ROCKET',unlock:7,description:'Physical rockets burst against nearby targets.'},
  plasma:{label:'PLASMA HAMMER',unlock:10,description:'Slower, deliberate heavy impacts.'},
  ledger:{label:'LEDGER ARC',unlock:13,description:'Energy chains to a bounded number of nearby enemies.'},
};
export const RAPID_CAP=4;
export const ROMAN=['I','II','III','IV'];
export function fighterStage(family:FighterFamily,rank:number):number {return Math.max(0,Math.min(4,Math.floor(rank)-FAMILY_INFO[family].unlock+1));}
/** How many marks a family can earn past its fourth stage. */
export const MARK_CAP=6;
/** Damage added per mark, and the cadence multiplier applied per mark. */
const MARK_DAMAGE=.06;
const MARK_CADENCE=.95;
/**
 * Ranks earned PAST a family's terminal stage.
 *
 * `fighterStage` clamps at 4, and bb unlocks at rank 1, so bb reached its last
 * stage at rank 4 and then froze for ranks 5..20. On the owner's device that is
 * exactly what happened: LIQUIDITY BEAM II, III and IV arrived at levels 2, 3
 * and 4, and then levels 5, 6, 7, 8, 9 and 10 each handed over the identical
 * `fighter.bb.4`. The level-up banner compares weapon KEYS, so it never fired
 * again and the player's reasonable read was "it does not update your weapons".
 *
 * The escape hatch was worse than useless. Switching family is reachable -- the
 * LOADOUT panel is measurably on screen during the level-up card -- but every
 * family enters at ITS OWN stage 1, so at rank 4 the choice was 64.51 dps to
 * 12.73 dps, a 5.07x downgrade. The correct play was to never open it.
 *
 * A mark is the fix, and it is deliberately additive: stages 1..4 keep their
 * authored numbers EXACTLY, because a global rank multiplier was tried and
 * measured to flatten every family's four-stage curve -- against
 * validate-fighter-armory's own 16hp group all four plasma stages collapsed to
 * one-shot kills and its monotonic TTK check went red at every coefficient
 * between 0.05 and 0.30. Marks apply only above stage 4, where there is no
 * authored curve left to flatten.
 */
export function fighterMark(family:FighterFamily,rank:number):number {
  return Math.max(0,Math.min(MARK_CAP,Math.floor(rank)-(FAMILY_INFO[family].unlock+3)));
}
const lanes=(offsets:number[])=>offsets.map(offsetX=>({offsetX,angle:0}));
/** All stages preserve forward center coverage. Family switching is voluntary;
 * each family progresses independently through four non-decreasing stages. */
export function fighterWeapon(state:FighterWeaponState):FighterWeapon {
  const family=fighterStage(state.family,state.rank)?state.family:'bb';
  const stage=Math.max(1,fighterStage(family,state.rank)),i=stage-1;
  const mark=fighterMark(family,state.rank);
  // The key carries the mark so the level-up banner, which compares keys, fires
  // on every rank that actually changed the gun.
  const base={family,stage,key:`fighter.${family}.${stage}${mark?`+${mark}`:''}`,label:`${FAMILY_INFO[family].label} ${ROMAN[i]}${mark?`+${mark}`:''}`,tier:stage,projectileKey:'bb_shot',splash:0,chain:0,pierce:0,speed:720};
  let weapon:FighterWeapon;
  if(family==='bb')weapon={...base,damage:[1,1.15,1.4,1.8][i],fireRate:[.14,.135,.13,.125][i],shots:lanes([[0],[-3,3],[-5,0,5],[-6,-2,2,6]][i])};
  else if(family==='pulse')weapon={...base,damage:[2.5,3.5,4.5,6][i],fireRate:[.22,.21,.2,.19][i],shots:lanes(i<2?[0]:[-3,3]),pierce:[1,2,3,4][i],speed:760,projectileKey:'clarity_beam'};
  else if(family==='rocket')weapon={...base,damage:[5,7,10,14][i],fireRate:[.45,.43,.4,.37][i],shots:lanes(i===3?[-3,3]:[0]),speed:520,splash:[44,54,64,76][i]};
  else if(family==='plasma')weapon={...base,damage:[7,10,16,19][i],fireRate:[.52,.49,.46,.42][i],shots:lanes([0]),speed:570,splash:[0,16,22,30][i]};
  else weapon={...base,damage:[5,7,9,12][i],fireRate:[.3,.28,.26,.24][i],shots:lanes([0]),speed:840,chain:[1,2,2,3][i],projectileKey:'clarity_beam'};
  // A mark is worth a little damage and a little cadence. Both are bounded and
  // both are zero at stage <= 4, so every authored stage ships its exact
  // shipped numbers and the per-family stage curve is untouched.
  const marked={...weapon,damage:weapon.damage*(1+mark*MARK_DAMAGE),fireRate:weapon.fireRate*Math.pow(MARK_CADENCE,mark)};
  return{...marked,fireRate:marked.fireRate/(1+Math.max(0,Math.min(RAPID_CAP,Math.floor(state.rapid)))*.12)};
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
  setActive(value:boolean):void;
  block():void;
  update(safe:boolean):boolean;
}
