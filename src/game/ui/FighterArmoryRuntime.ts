import type {CampaignSave} from '../definitive/CampaignSave';
import {FIGHTER_FAMILIES,FAMILY_INFO,ROMAN,RAPID_CAP,EARTH_WEAPON_CAP,EARTH_WEAPON_THRESHOLDS,earthWeaponLevel,weaponPointsLabel,retainedWeaponPower,nextFighterFamily,fighterStageForState,fighterStage,fighterWeapon,type FighterFamily,type FighterWeaponState,type FighterArmoryPort} from '../content/FighterWeapons';

/** Only the fighter track is written. Hero powers and capital modules are
 * separate save fields and cannot be spent/equipped through this panel. */
export class FighterArmoryRuntime implements FighterArmoryPort {
  private readonly root=document.createElement('section');
  private readonly button=document.createElement('button');
  private readonly panel=document.createElement('section');
  private current:FighterWeaponState={family:'bb',rank:1,rapid:0};
  private enabled=false;
  private opened=false;
  private safe=false;
  private initialized=false;
  private milestone:string|null=null;
  private profile=fighterWeapon(this.current);
  get active():boolean{return this.opened;}
  get state():FighterWeaponState{return{...this.current};}
  get weapon(){return this.profile;}
  constructor(parent:HTMLElement,private readonly save:CampaignSave){
    const read=()=>{
      const previous=this.current;
      const upgrades=save.snapshot.fighterUpgrades;
      this.initialized=!!upgrades.weapon_rank;
      this.current={family:FIGHTER_FAMILIES[upgrades.weapon_family??0]??'bb',rank:Math.max(1,Math.min(20,upgrades.weapon_rank??1)),rapid:Math.min(RAPID_CAP,upgrades.rapid_fire??0),power:upgrades.weapon_power??0,...(upgrades.weapon_level?{level:upgrades.weapon_level,points:save.snapshot.fighterWeaponPoints}:{})};
      this.profile=fighterWeapon(this.current);
      if(this.enabled&&previous.level!==undefined&&this.current.level!>previous.level){
        this.milestone=this.current.level===5?'NEW WEAPON UNLOCKED · PULSE LANCE I':`BEAM UPGRADED · ${ROMAN[this.current.level!-1]}`;
        this.opened=true;
      }
      this.button.textContent=this.current.level===undefined?'WEAPONS':`WEAPONS · ${(this.current.level??1)>=EARTH_WEAPON_CAP?'EARTH MAX':(this.current.points??0)+'/'+EARTH_WEAPON_THRESHOLDS[this.current.level??1]}`;
      if(this.opened)this.paint();
    };read();save.subscribe(result=>{if(result.ok)read();});
    this.root.className='fighter-armory';this.root.hidden=true;this.button.type='button';this.button.className='fighter-armory-toggle';this.button.textContent=this.current.level===undefined?'WEAPONS':`WEAPONS · ${(this.current.level??1)>=EARTH_WEAPON_CAP?'EARTH MAX':(this.current.points??0)+'/'+EARTH_WEAPON_THRESHOLDS[this.current.level??1]}`;
    this.panel.className='fighter-armory-panel';this.panel.hidden=true;this.panel.setAttribute('role','dialog');this.panel.setAttribute('aria-label','Fighter loadout');
    this.button.addEventListener('click',()=>{if(this.enabled&&this.safe){this.opened=true;this.paint();}});
    this.root.append(this.button,this.panel);parent.appendChild(this.root);
  }
  begin(rank:number,barrels:number,baseTier:number,legacyDps=0):boolean {
    if(this.initialized)return this.rankUp(Math.max(rank,baseTier));
    // Carry forward earned fighter mastery and bolt-on hardware from older
    // checkpoints, and never hand back less gun than the player walked in
    // with.
    //
    // This used to re-derive the arcade tier here, from a copy of the arcade's
    // own numbers -- `[3,6,9,12]` and a five-rung ceiling. When the ladder
    // became nine rungs on different thresholds, this copy went stale in
    // silence and a rank-7 pilot migrated from 53 dps down to 11. The engine
    // now MEASURES what the player was firing and passes it in, so there is no
    // second model of the ladder to fall out of date.
    const rapid=Math.min(RAPID_CAP,Math.max(0,barrels));
    let mastered=Math.min(20,Math.max(1,rank,baseTier));
    let family:FighterFamily='bb';
    const output=(candidate:FighterFamily,at:number)=>{
      if(!fighterStage(candidate,at))return 0;
      const weapon=fighterWeapon({family:candidate,rank:at,rapid});
      return weapon.damage*weapon.shots.length/weapon.fireRate;
    };
    // The cheapest rank that covers the incoming loadout, and the family at
    // that rank that covers it best. Walking up rather than solving keeps this
    // honest about the armory's real ceiling: if nothing reaches, the pilot
    // gets the strongest thing that exists instead of a silent downgrade.
    for(let at=mastered;at<=20;at++){
      const best=FIGHTER_FAMILIES.reduce((pick,candidate)=>output(candidate,at)>output(pick,at)?candidate:pick,'bb' as FighterFamily);
      mastered=at;family=best;
      if(output(best,at)>=legacyDps)break;
    }
    return this.save.update(d=>{d.fighterUpgrades.weapon_rank=mastered;d.fighterUpgrades.weapon_family=Math.max(0,FIGHTER_FAMILIES.indexOf(family));d.fighterUpgrades.rapid_fire=rapid;}).ok;
  }
  rankUp(rank:number):boolean {
    const next=Math.max(this.current.rank,Math.min(20,rank));if(next===this.current.rank)return true;
    return this.save.update(d=>{d.fighterUpgrades.weapon_rank=next;}).ok;
  }
  upgradeWeapon():boolean {
    if(this.current.level!==undefined)return false; // Points are the only milestone source.
    const next=nextFighterFamily(this.current);if(!next)return false;
    const power=retainedWeaponPower(this.current);
    return this.save.update(d=>{d.fighterUpgrades.weapon_family=FIGHTER_FAMILIES.indexOf(next);d.fighterUpgrades.weapon_power=power;}).ok;
  }
  awardWeaponPoints(amount:number):boolean {
    if(this.current.level===undefined||!Number.isSafeInteger(amount)||amount<=0)return false;
    if(this.current.level>=EARTH_WEAPON_CAP)return true;
    const points=Math.min(EARTH_WEAPON_THRESHOLDS[EARTH_WEAPON_CAP-1],(this.current.points??0)+amount);
    const level=Math.max(this.current.level,earthWeaponLevel(points));
    return this.save.update(d=>{
      d.fighterWeaponPoints=points;
      d.fighterUpgrades.weapon_level=level;
      // Keep the equipped family. A milestone refines it or unlocks a choice;
      // no pickup can silently replace the player's selected gun.
    }).ok;
  }
  upgradeRapid():boolean {
    if(this.current.rapid>=RAPID_CAP)return false;
    return this.save.update(d=>{d.fighterUpgrades.rapid_fire=this.current.rapid+1;}).ok;
  }
  private select(family:FighterFamily):boolean {
    if(!this.enabled||!this.safe||!fighterStageForState(this.current,family))return false;
    return this.save.update(d=>{d.fighterUpgrades.weapon_family=FIGHTER_FAMILIES.indexOf(family);}).ok;
  }
  setActive(value:boolean):void {this.enabled=value;if(!value)this.block();}
  block():void {this.safe=false;this.opened=false;this.root.hidden=true;this.panel.hidden=true;}
  update(safe:boolean):boolean {
    if(this.enabled&&safe&&this.milestone)this.opened=true;
    this.safe=safe;this.root.hidden=!this.enabled||!safe;
    if(!this.enabled||!safe)this.opened=false;
    this.panel.hidden=!this.opened;this.button.hidden=this.opened;return this.opened;
  }
  private paint():void {
    this.panel.replaceChildren();this.panel.hidden=!this.opened;this.button.hidden=this.opened;
    const heading=document.createElement('strong');heading.textContent=this.milestone?'LEVEL UP — '+this.milestone:'FIGHTER LOADOUT';
    const intro=document.createElement('p');intro.textContent=`${this.current.level===undefined?'MASTERY '+this.current.rank:'WEAPON LEVEL '+this.current.level+'/'+EARTH_WEAPON_CAP+' · '+weaponPointsLabel(this.current)} · RAPID FIRE ${this.current.rapid}/${RAPID_CAP}. Kills earn weapon points; WPN pickups add 4 bonus points. Earth offers four milestones. New weapons unlock without replacing your equipped gun. Select an unlocked weapon below. Max rapid fire adds twin homing rockets; beam weapons become laser pulses.`;
    this.panel.append(heading,intro);
    for(const family of FIGHTER_FAMILIES){
      const info=FAMILY_INFO[family],stage=fighterStageForState(this.current,family),button=document.createElement('button');button.type='button';button.disabled=!stage;
      const name=document.createElement('b'),detail=document.createElement('span');name.textContent=stage?`${info.label} ${ROMAN[stage-1]}${family===this.current.family?' · EQUIPPED':''}`:`${info.label} · ${this.current.level===undefined?'RANK '+info.unlock:(family==='pulse'?'UNLOCK AT 200 WPN POINTS':'LATER WORLDS')}`;detail.textContent=info.description;button.append(name,detail);
      button.addEventListener('click',()=>{if(!this.select(family)){intro.textContent='Loadout could not be saved. Try again.';}});this.panel.appendChild(button);
    }
    const close=document.createElement('button');close.type='button';close.textContent=this.milestone?'CONTINUE':'RETURN';close.addEventListener('click',()=>{this.milestone=null;this.opened=false;this.panel.hidden=true;this.button.hidden=false;});this.panel.appendChild(close);
  }
}
