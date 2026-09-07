import {EARTH_STORY,CITY_RESTORATION,earthStoryFor,type FlightStoryPort} from '../content/EarthStory';
import type {CampaignSave} from '../definitive/CampaignSave';
import {CommsPanel} from '../definitive/CommsPanel';

/** The existing Canvas game retains its renderer and input; conversations
 * acquire a temporary combat hold and commit only their own dialogue receipt. */
export class EarthCommsRuntime implements FlightStoryPort {
  private readonly root=document.createElement('section');
  private readonly panel:CommsPanel;
  private readonly log=document.createElement('button');
  private enabled=false;
  private checkedAct:string|null=null;
  private seen:readonly string[];
  get districtRestored():boolean{return this.seen.includes(CITY_RESTORATION.id);}
  constructor(parent:HTMLElement,private readonly save:CampaignSave){
    this.seen=save.snapshot.dialogueSeen;
    save.subscribe(result=>{if(result.ok)this.seen=save.snapshot.dialogueSeen;});
    this.root.className='earth-comms';this.root.hidden=true;
    this.panel=new CommsPanel(this.root);this.log.type='button';this.log.textContent='COMMS';this.log.className='earth-comms-log';
    this.log.addEventListener('click',()=>{
      if(!this.enabled||this.panel.active)return;
      const lines=[...Object.values(EARTH_STORY),CITY_RESTORATION].filter(scene=>this.seen.includes(scene.id)).flatMap(scene=>scene.lines);
      if(lines.length)this.panel.open({id:'log.earth',lines},()=>true);
    });
    this.root.appendChild(this.log);parent.appendChild(this.root);
  }
  setActive(value:boolean):void {
    this.enabled=value;this.root.hidden=!value;this.panel.setActive(value);
    if(!value){this.panel.close();this.checkedAct=null;}
  }
  update(dt:number,act:string|null,restorationSafe=false):boolean {
    this.root.hidden=!this.enabled||!act;this.panel.setActive(this.enabled&&!!act);
    if(!this.enabled||!act)return false;
    this.panel.update(dt);
    if(!this.panel.active&&restorationSafe&&!this.districtRestored){
      this.panel.open(CITY_RESTORATION,()=>this.save.update(d=>{
        if(!d.dialogueSeen.includes(CITY_RESTORATION.id))d.dialogueSeen.push(CITY_RESTORATION.id);
        if(!d.quests.includes('earth.district_restored'))d.quests.push('earth.district_restored');
      }).ok);
    }else if(!this.panel.active&&act!==this.checkedAct){
      this.checkedAct=act;
      const scene=earthStoryFor(act,this.seen);
      if(scene)this.panel.open(scene,()=>this.save.update(d=>{if(!d.dialogueSeen.includes(scene.id))d.dialogueSeen.push(scene.id);}).ok);
    }
    this.log.hidden=this.panel.active;
    this.log.disabled=!Object.values(EARTH_STORY).some(scene=>this.seen.includes(scene.id));
    return this.panel.active;
  }
}
