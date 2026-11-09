import {DECK,DECK_DOORS} from './BoardingLayout';
import type {BoardingRoom,BoardingQuest} from './BoardingQuest';
import {
  deckMapBounds,projectDeckPoint,unprojectDeckPoint,pickDeckRoom,clampDeckZoom,clampDeckPan,
  type DeckMapView
} from './DeckMapGeometry';

interface Position {x:number;z:number}
interface MapHost {
  root:HTMLElement;
  quest:BoardingQuest;
  position:()=>Position;
  current:()=>BoardingRoom;
  walkthrough?:boolean;
}

const BOUNDS=deckMapBounds(DECK);
const COLORS={bg:'#07111b',line:'#254555',visited:'#164a3c',current:'#00ff00',
  secure:'#1c7762',locked:'#8e3942',unknown:'#1c2a35',door:'#719b9e',text:'#e0fff0'};

/** Read-only, phone-first map. Its only state changes are local zoom/pan/selection. */
export class WarshipDeckMap {
  private readonly panel=document.createElement('section');
  private readonly canvas=document.createElement('canvas');
  private readonly info=document.createElement('div');
  private readonly rooms=document.createElement('div');
  private readonly title=document.createElement('strong');
  private readonly instruction=document.createElement('p');
  private readonly closeButton=document.createElement('button');
  private readonly lifetime=new AbortController();
  private readonly pointers=new Map<number,Position>();
  private readonly origins=new Map<number,Position>();
  private readonly view:DeckMapView={width:320,height:440,zoom:1,panX:0,panY:0};
  private selected:BoardingRoom|null=null;
  private pinchDistance:number|null=null;
  private moved=false;
  isOpen=false;

  constructor(private readonly host:MapHost){
    this.panel.className='boarding-deck-overlay';
    this.panel.setAttribute('role','dialog');this.panel.setAttribute('aria-modal','true');
    this.panel.setAttribute('aria-label','Regulatory Warship deck map');
    this.panel.hidden=true;
    const header=document.createElement('header');header.className='boarding-deck-header';
    const heading=document.createElement('div');
    const kicker=document.createElement('span');kicker.textContent='CODED // REGULATORY WARSHIP';
    this.title.textContent='DECK A · OPERATIONS MAP';
    heading.append(kicker,this.title);
    this.closeButton.type='button';this.closeButton.textContent='CLOSE ×';this.closeButton.className='boarding-deck-close';
    this.closeButton.addEventListener('click',()=>this.close(),{signal:this.lifetime.signal});
    header.append(heading,this.closeButton);
    const layout=document.createElement('div');layout.className='boarding-deck-layout';
    const visual=document.createElement('div');visual.className='boarding-deck-visual';
    this.canvas.className='boarding-deck-canvas';
    this.canvas.setAttribute('aria-label','Interactive deck overview; drag to pan, pinch to zoom, tap room for details');
    this.canvas.setAttribute('role','img');
    this.instruction.textContent='DRAG TO PAN · PINCH TO ZOOM · TAP A ROOM TO INSPECT';
    const zoomControls=document.createElement('div');zoomControls.className='boarding-deck-zoom';
    for(const [label,delta] of [['−',-.4],['+',.4]] as const){
      const btn=document.createElement('button');btn.type='button';
      btn.textContent=label;btn.setAttribute('aria-label',delta>0?'Zoom in on deck':'Zoom out on deck');
      btn.addEventListener('click',()=>{
        this.view.zoom=clampDeckZoom(this.view.zoom+delta);
        this.limitPan();this.render();
      },{signal:this.lifetime.signal});
      zoomControls.append(btn);
    }
    const reset=document.createElement('button');reset.type='button';reset.textContent='FIT';
    reset.addEventListener('click',()=>{this.view.zoom=1;this.view.panX=0;this.view.panY=0;this.render();},{signal:this.lifetime.signal});
    zoomControls.append(reset);
    visual.append(this.canvas,this.instruction,zoomControls);
    const sidebar=document.createElement('aside');sidebar.className='boarding-deck-sidebar';
    const listHeading=document.createElement('strong');listHeading.textContent='SHIP SECTORS';
    this.rooms.className='boarding-deck-room-list';
    this.info.className='boarding-deck-room-info';this.info.setAttribute('aria-live','polite');
    const legend=document.createElement('p');legend.className='boarding-deck-legend';
    legend.textContent='● GREEN: YOU   ■ TEAL: DISCOVERED   ■ RED: LOCKED   ■ GREY: UNKNOWN';
    sidebar.append(listHeading,this.rooms,this.info,legend);
    layout.append(visual,sidebar);
    this.panel.append(header,layout);
    this.host.root.appendChild(this.panel);
    this.bind();
  }

  private visible(id:BoardingRoom):boolean{
    const s=this.host.quest.save.snapshot;
    return !!this.host.walkthrough||s.warshipOwned||id===this.host.current()||s.visitedRooms.includes('boarding.'+id);
  }
  private status(id:BoardingRoom):'current'|'unseen'|'locked'|'clear'|'discovered'{
    if(id===this.host.current())return 'current';
    if(!this.visible(id))return 'unseen';
    if(this.host.walkthrough)return 'discovered';
    if(this.host.quest.lockReason(id))return 'locked';
    if(this.host.quest.isClear(id))return 'clear';
    return 'discovered';
  }
  open():void{
    this.selected=this.host.current();
    this.isOpen=true;this.panel.hidden=false;this.moved=false;
    this.paintDetails();this.render();this.closeButton.focus();
  }
  close():void{
    this.isOpen=false;this.panel.hidden=true;this.pointers.clear();this.origins.clear();this.pinchDistance=null;
  }
  dispose():void{this.close();this.lifetime.abort();this.panel.remove();}

  private limitPan():void{
    this.view.panX=clampDeckPan(this.view.panX,this.view.width,this.view.zoom);
    this.view.panY=clampDeckPan(this.view.panY,this.view.height,this.view.zoom);
  }
  private fingerDistance():number|null {
    const pair=[...this.pointers.values()];
    return pair.length===2?Math.hypot(pair[0].x-pair[1].x,pair[0].z-pair[1].z):null;
  }
  private bind():void{
    const signal=this.lifetime.signal;
    this.canvas.addEventListener('pointerdown',event=>{
      if(!this.isOpen)return;
      this.pointers.set(event.pointerId,{x:event.clientX,z:event.clientY});
      this.origins.set(event.pointerId,{x:event.clientX,z:event.clientY});
      if(this.pointers.size===2){this.pinchDistance=this.fingerDistance();this.moved=true;}
      this.canvas.setPointerCapture(event.pointerId);
      event.preventDefault();
    },{signal});
    this.canvas.addEventListener('pointermove',event=>{
      const before=this.pointers.get(event.pointerId);if(!before)return;
      this.pointers.set(event.pointerId,{x:event.clientX,z:event.clientY});
      const distance=this.fingerDistance();
      if(distance!==null){
        if(this.pinchDistance!==null&&this.pinchDistance>8){
          this.view.zoom=clampDeckZoom(this.view.zoom*(distance/this.pinchDistance));
          this.limitPan();this.render();
        }
        this.pinchDistance=distance;
      }else{
        const dx=event.clientX-before.x,dy=event.clientY-before.z;
        if(Math.abs(dx)+Math.abs(dy)>0){
          this.view.panX+=dx;this.view.panY+=dy;
          this.limitPan();this.render();
        }
      }
      const origin=this.origins.get(event.pointerId);
      if(origin&&Math.hypot(origin.x-event.clientX,origin.z-event.clientY)>9)this.moved=true;
      event.preventDefault();
    },{signal});
    const end=(event:PointerEvent)=>{
      const origin=this.origins.get(event.pointerId);
      const wasOnly=this.pointers.size===1;
      this.pointers.delete(event.pointerId);this.origins.delete(event.pointerId);
      if(this.pointers.size<2)this.pinchDistance=null;
      if(this.pointers.size===0){
        if(wasOnly&&!this.moved&&origin&&Math.hypot(origin.x-event.clientX,origin.z-event.clientY)<9&&event.type==='pointerup'){
          const rect=this.canvas.getBoundingClientRect();
          const point=unprojectDeckPoint(BOUNDS,this.view,event.clientX-rect.left,event.clientY-rect.top);
          const chosen=pickDeckRoom(DECK,point.x,point.z);
          if(chosen)this.select(chosen as BoardingRoom);
        }
        this.moved=false;
      }
    };
    this.canvas.addEventListener('pointerup',end,{signal});
    this.canvas.addEventListener('pointercancel',end,{signal});
    this.canvas.addEventListener('lostpointercapture',end,{signal});
    this.canvas.addEventListener('wheel',event=>{
      if(!this.isOpen)return;
      this.view.zoom=clampDeckZoom(this.view.zoom*Math.exp(-event.deltaY*.002));
      this.limitPan();this.render();event.preventDefault();
    },{signal,passive:false});
    window.addEventListener('keydown',event=>{
      if(this.isOpen&&['Escape','KeyM'].includes(event.code)){
        event.preventDefault();event.stopPropagation();this.close();
      }
    },{signal,capture:true});
    window.addEventListener('resize',()=>{if(this.isOpen)this.render();},{signal});
  }
  private select(id:BoardingRoom):void {this.selected=id;this.paintDetails();this.render();}
  private paintDetails():void {
    if(!this.isOpen)return;
    const quest=this.host.quest;
    this.rooms.replaceChildren();
    for(const [index,room] of DECK.entries()){
      const known=this.visible(room.id);
      const button=document.createElement('button');button.type='button';
      button.className='boarding-deck-room-option';
      const label=known?room.title:`${String(index+1).padStart(2,'0')} · UNEXPLORED`;
      const flag=this.status(room.id);
      button.textContent=label+'  ·  '+(flag==='current'?'HERE':flag==='clear'?'SECURED':flag==='locked'?'LOCKED':flag==='unseen'?'UNKNOWN':'VISITED');
      button.setAttribute('aria-pressed',String(this.selected===room.id));
      button.addEventListener('click',()=>this.select(room.id),{signal:this.lifetime.signal});
      this.rooms.append(button);
    }
    const target=this.selected??this.host.current();
    const room=DECK.find(r=>r.id===target)!;
    const known=this.visible(target);
    const status=this.status(target);
    const title=document.createElement('strong');
    title.textContent=known?room.title:'UNEXPLORED SECTOR';
    const text=document.createElement('p');
    if(!known)text.textContent='Sector coordinates are uncharted. Explore connected corridors to reveal this area.';
    else if(target===this.host.current())text.textContent='CURRENT LOCATION · '+quest.objective;
    else if(this.host.walkthrough)text.textContent='WALKTHROUGH · Enemies and combat disabled. Visit this room through the ship doors to plan future encounters.';
    else if(status==='locked')text.textContent='ACCESS LOCKED · '+(quest.lockReason(target)??'Continue the boarding operation.');
    else if(status==='clear')text.textContent='SECURED · Previously cleared. This map does not teleport XRPMan.';
    else text.textContent='DISCOVERED · Travel through the physical doors to reach this sector.';
    this.info.replaceChildren(title,text);
  }
  /** Read-only redraw from source-of-truth quest flags and position. */
  render():void {
    if(!this.isOpen)return;
    const rect=this.canvas.getBoundingClientRect();
    const width=Math.max(80,Math.round(rect.width)),height=Math.max(130,Math.round(rect.height));
    this.view.width=width;this.view.height=height;this.limitPan();
    const density=Math.min(2,window.devicePixelRatio||1);
    if(this.canvas.width!==Math.round(width*density)||this.canvas.height!==Math.round(height*density)){
      this.canvas.width=Math.round(width*density);this.canvas.height=Math.round(height*density);
    }
    const ctx=this.canvas.getContext('2d');if(!ctx)return;
    ctx.setTransform(density,0,0,density,0,0);ctx.clearRect(0,0,width,height);
    ctx.fillStyle=COLORS.bg;ctx.fillRect(0,0,width,height);
    ctx.lineWidth=1;ctx.strokeStyle='#142837';
    for(let x=0;x<width;x+=28){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,height);ctx.stroke();}
    for(let y=0;y<height;y+=28){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(width,y);ctx.stroke();}
    const pt=(x:number,z:number)=>projectDeckPoint(BOUNDS,this.view,x,z);
    for(const door of DECK_DOORS){
      const from=pt(DECK.find(r=>r.id===door.a)!.x,DECK.find(r=>r.id===door.a)!.z);
      const to=pt(DECK.find(r=>r.id===door.b)!.x,DECK.find(r=>r.id===door.b)!.z);
      const locked=!this.host.walkthrough&&!!this.host.quest.lockReason(door.b);
      const found=this.visible(door.a)&&this.visible(door.b);
      ctx.strokeStyle=locked?'#b74149':found?'#25a879':'#294255';
      ctx.lineWidth=found?6:4;ctx.setLineDash(found?[]:[7,6]);
      ctx.beginPath();ctx.moveTo(from.x,from.y);ctx.lineTo(to.x,to.y);ctx.stroke();ctx.setLineDash([]);
    }
    for(const room of DECK){
      const center=pt(room.x,room.z);
      const topLeft=pt(room.x-room.width/2,room.z+room.depth/2);
      const bottomRight=pt(room.x+room.width/2,room.z-room.depth/2);
      const rw=bottomRight.x-topLeft.x,rh=bottomRight.y-topLeft.y;
      const known=this.visible(room.id),state=this.status(room.id);
      ctx.fillStyle=state==='current'?'#0c4530':state==='locked'?'#381b25':state==='clear'?COLORS.secure:state==='unseen'?COLORS.unknown:COLORS.visited;
      ctx.fillRect(topLeft.x,topLeft.y,rw,rh);
      ctx.strokeStyle=state==='current'?COLORS.current:state==='locked'?COLORS.locked:known?'#438d83':'#3e5260';
      ctx.lineWidth=state==='current'?3:1.5;
      ctx.strokeRect(topLeft.x,topLeft.y,rw,rh);
      if(this.selected===room.id){
        ctx.strokeStyle='#d6fbe6';ctx.lineWidth=1;
        ctx.strokeRect(topLeft.x-4,topLeft.y-4,rw+8,rh+8);
      }
      const number=room.title.slice(0,2);
      ctx.textAlign='center';ctx.textBaseline='middle';
      const fontSize=Math.max(10,Math.min(18,rh*.35,rw*.5));
      ctx.font=`700 ${fontSize}px system-ui`;ctx.fillStyle=known?COLORS.text:'#7691a0';
      ctx.fillText(known?number:'?',center.x,center.y,Math.max(12,rw-3));
    }
    // Only the current door positions are drawn; no paths are unlocked by the map.
    for(const door of DECK_DOORS){
      const p=pt(door.x,door.z);
      ctx.fillStyle=!this.host.walkthrough&&this.host.quest.lockReason(door.b)?'#ff4b53':COLORS.door;
      ctx.fillRect(p.x-3,p.y-3,6,6);
    }
    const position=this.host.position(),player=pt(position.x,position.z);
    ctx.beginPath();ctx.arc(player.x,player.y,7,0,Math.PI*2);
    ctx.fillStyle='#00ff00';ctx.shadowColor='#00ff00';ctx.shadowBlur=14;ctx.fill();
    ctx.shadowBlur=0;ctx.strokeStyle='#f1fff4';ctx.lineWidth=2;ctx.stroke();
    ctx.fillStyle='#9db9ad';ctx.font='600 10px system-ui';ctx.textAlign='left';ctx.textBaseline='top';
    ctx.fillText('BRIDGE  ↑  +Z',10,11);ctx.fillText('BAY  ↓  −Z',10,height-19);
  }
}
