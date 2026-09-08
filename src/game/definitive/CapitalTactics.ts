/** Damage is earned on physical components; armor cannot be ground down to skip the shield puzzle. */
export const CAPITAL_PARTS=['shield_port','shield_starboard','battery_port','battery_starboard','reactor'] as const;
export type CapitalPart=typeof CAPITAL_PARTS[number];
export interface CapitalCheckpoint {wave:number;hp:Record<CapitalPart,number>}
export const CAPITAL_HP:Readonly<Record<CapitalPart,number>>={shield_port:360,shield_starboard:360,battery_port:270,battery_starboard:270,reactor:880};
export function validCapitalCheckpoint(value:unknown,wave:number):value is CapitalCheckpoint {
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const v=value as CapitalCheckpoint;return v.wave===wave&&!!v.hp&&CAPITAL_PARTS.every(key=>typeof v.hp[key]==='number'&&Number.isFinite(v.hp[key])&&v.hp[key]>=0&&v.hp[key]<=CAPITAL_HP[key])&&(v.hp.reactor===CAPITAL_HP.reactor||v.hp.shield_port===0&&v.hp.shield_starboard===0);
}
export class CapitalTactics {
 readonly hp:Record<CapitalPart,number>;
 constructor(readonly wave:number,saved?:CapitalCheckpoint){this.hp=saved&&validCapitalCheckpoint(saved,wave)?{...saved.hp}:{...CAPITAL_HP};}
 get exposed():boolean{return this.hp.shield_port===0&&this.hp.shield_starboard===0;}
 get defeated():boolean{return this.hp.reactor===0;}
 damage(part:CapitalPart,amount:number):boolean {
  if(!Number.isFinite(amount)||amount<=0||this.defeated||part==='reactor'&&!this.exposed||this.hp[part]<=0)return false;
  this.hp[part]=Math.max(0,this.hp[part]-amount);return true;
 }
 snapshot():CapitalCheckpoint{return {wave:this.wave,hp:{...this.hp}};}
}
export type ShieldFocus='balanced'|'fore'|'aft';
/** Redirect existing charge, never manufacture shields by tapping a button. */
export function routeShields(state:{fore:number;aft:number},focus:ShieldFocus,capacity:number,dt:number):void {
 if(!Number.isFinite(dt)||dt<=0||dt>.25||focus==='balanced')return;
 const donor=focus==='fore'?'aft':'fore',amount=Math.max(0,Math.min(12*dt,state[donor],capacity-state[focus]));state[donor]-=amount;state[focus]+=amount;
}
