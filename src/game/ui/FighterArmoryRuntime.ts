import type {CampaignSave} from '../definitive/CampaignSave';
import {FIGHTER_FAMILIES,FAMILY_INFO,ROMAN,RAPID_CAP,fighterStage,fighterWeapon,type FighterFamily,type FighterWeaponState,type FighterArmoryPort} from '../content/FighterWeapons';

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
  private profile=fighterWeapon(this.current);
  get active():boolean{return this.opened;}
  get state():FighterWeaponState{return{...this.current};}
  get weapon(){return this.profile;}
  constructor(parent:HTMLElement,private readonly save:CampaignSave){
    const read=()=>{
      const upgrades=save.snapshot.fighterUpgrades;
      this.initialized=!!upgrades.weapon_rank;
      this.current={family:FIGHTER_FAMILIES[upgrades.weapon_family??0]??'bb',rank:Math.max(1,Math.min(20,upgrades.weapon_rank??1)),rapid:Math.min(RAPID_CAP,upgrades.rapid_fire??0)};
      this.profile=fighterWeapon(this.current);if(this.opened)this.paint();
    };read();save.subscribe(result=>{if(result.ok)read();});
    this.root.className='fighter-armory';this.root.hidden=true;this.button.type='button';this.button.className='fighter-armory-toggle';this.button.textContent='LOADOUT';
    this.panel.className='fighter-armory-panel';this.panel.hidden=true;this.panel.setAttribute('role','dialog');this.panel.setAttribute('aria-label','Fighter loadout');
    this.button.addEventListener('click',()=>{if(this.enabled&&this.safe){this.opened=true;this.paint();}});
    this.root.append(this.button,this.panel);parent.appendChild(this.root);
  }
  begin(rank:number,barrels:number,baseTier:number):boolean {
    if(this.initialized)return this.rankUp(Math.max(rank,baseTier));
    // Carry forward earned fighter mastery and bolt-on hardware from older
    // checkpoints. New hulls retain the Striker's stronger starting weapon.
    const oldTier=Math.min(5,baseTier+[3,6,9,12].filter(at=>rank>=at).length);
    const mastered=Math.min(20,Math.max(rank,baseTier,barrels>0||oldTier>=4?4:1,oldTier===5?7:1));
    return this.save.update(d=>{d.fighterUpgrades.weapon_rank=mastered;d.fighterUpgrades.weapon_family=oldTier===5?1:0;d.fighterUpgrades.rapid_fire=Math.min(RAPID_CAP,Math.max(0,barrels));}).ok;
  }
  rankUp(rank:number):boolean {
    const next=Math.max(this.current.rank,Math.min(20,rank));if(next===this.current.rank)return true;
    return this.save.update(d=>{d.fighterUpgrades.weapon_rank=next;}).ok;
  }
  upgradeRapid():boolean {
    if(this.current.rapid>=RAPID_CAP)return false;
    return this.save.update(d=>{d.fighterUpgrades.rapid_fire=this.current.rapid+1;}).ok;
  }
  private select(family:FighterFamily):boolean {
    if(!this.enabled||!this.safe||!fighterStage(family,this.current.rank))return false;
    return this.save.update(d=>{d.fighterUpgrades.weapon_family=FIGHTER_FAMILIES.indexOf(family);}).ok;
  }
  setActive(value:boolean):void {this.enabled=value;if(!value)this.block();}
  block():void {this.safe=false;this.opened=false;this.root.hidden=true;this.panel.hidden=true;}
  update(safe:boolean):boolean {
    this.safe=safe;this.root.hidden=!this.enabled||!safe;
    if(!this.enabled||!safe)this.opened=false;
    this.panel.hidden=!this.opened;this.button.hidden=this.opened;return this.opened;
  }
  private paint():void {
    this.panel.replaceChildren();this.panel.hidden=!this.opened;this.button.hidden=this.opened;
    const heading=document.createElement('strong');heading.textContent='FIGHTER LOADOUT';
    const intro=document.createElement('p');intro.textContent=`MASTERY ${this.current.rank} · RAPID FIRE ${this.current.rapid}/${RAPID_CAP}. Choose your style. Each family grows through four stages.`;
    this.panel.append(heading,intro);
    for(const family of FIGHTER_FAMILIES){
      const info=FAMILY_INFO[family],stage=fighterStage(family,this.current.rank),button=document.createElement('button');button.type='button';button.disabled=!stage;
      const name=document.createElement('b'),detail=document.createElement('span');name.textContent=stage?`${info.label} ${ROMAN[stage-1]}${family===this.current.family?' · EQUIPPED':''}`:`${info.label} · RANK ${info.unlock}`;detail.textContent=info.description;button.append(name,detail);
      button.addEventListener('click',()=>{if(!this.select(family)){intro.textContent='Loadout could not be saved. Try again.';}});this.panel.appendChild(button);
    }
    const close=document.createElement('button');close.type='button';close.textContent='RETURN';close.addEventListener('click',()=>{this.opened=false;this.panel.hidden=true;this.button.hidden=false;});this.panel.appendChild(close);
  }
}
