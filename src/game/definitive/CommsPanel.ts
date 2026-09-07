import {Dialogue,type DialogueScene} from './Dialogue';

/** Shared fresh-input conversation panel; the host suspends combat while active. */
export class CommsPanel {
  private readonly dialogue=new Dialogue();
  private readonly panel=document.createElement('section');
  private readonly speaker=document.createElement('strong');
  private readonly text=document.createElement('p');
  private readonly page=document.createElement('span');
  private readonly lifetime=new AbortController();
  private enabled=false;
  get active():boolean{return this.dialogue.active;}
  constructor(root:HTMLElement){
    this.panel.className='boarding-dialogue space-comms';this.panel.setAttribute('role','dialog');this.panel.setAttribute('aria-label','Conversation');this.panel.hidden=true;
    this.panel.append(this.speaker,this.text,this.page);
    for(const [label,action]of[['CONTINUE',()=>this.dialogue.press()],['SKIP',()=>this.dialogue.skip()]] as const){
      const button=document.createElement('button');button.type='button';button.textContent=label;
      button.addEventListener('click',event=>{event.stopPropagation();if(this.enabled){action();this.paint();}},{signal:this.lifetime.signal});this.panel.appendChild(button);
    }
    root.appendChild(this.panel);
    window.addEventListener('keydown',event=>{if(this.enabled&&this.active&&['Space','Enter'].includes(event.code)){event.preventDefault();event.stopImmediatePropagation();if(!event.repeat){this.dialogue.press();this.paint();}}},{signal:this.lifetime.signal});
  }
  open(scene:DialogueScene,commit:()=>boolean):boolean{const result=this.dialogue.open(scene,commit);this.paint();return result;}
  setActive(value:boolean):void{this.enabled=value;this.paint();}
  update(dt:number):void{if(this.enabled){this.dialogue.update(dt);this.paint();}}
  private paint():void{
    this.panel.hidden=!this.enabled||!this.active;this.speaker.textContent=this.dialogue.speaker;this.text.textContent=this.dialogue.text;
    this.page.textContent=this.dialogue.failed?'Save unavailable. Continue to retry.':this.dialogue.page;
  }
  dispose():void{this.dialogue.closeWithoutEffects();this.lifetime.abort();this.panel.remove();}
}

export const PORTAL_COMMS:DialogueScene={id:'story.earth.portal',lines:[
  {speaker:'STONE · COMMS',text:'Portal locked. Mars on the other side.'},
  {speaker:'XRPMAN',text:"Keep Earth's signal open. We follow the drain."},
]};
