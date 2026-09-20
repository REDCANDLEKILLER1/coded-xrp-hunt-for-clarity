import {AmbientLight,AnimationMixer,Color,DirectionalLight,Fog,Mesh,MeshStandardMaterial,PerspectiveCamera,PointLight,Scene,Vector3,type Texture,type WebGLRenderer} from 'three';
import type {GLTF} from 'three/addons/loaders/GLTFLoader.js';
import type {ManagedScene} from './SceneController';
import {disposeObject} from './ModelAssets';
import {SurfaceInput,bindSurfaceButton} from './SurfaceInput';
import {BoardingQuest} from './BoardingQuest';
import {bindFocusPolicy} from './FocusPolicy';
import layout from './civic-layout.json';
import {civicBlocked} from './CivicNavigation';
import './surface.css';import './civic.css';

interface Host{renderer:WebGLRenderer;environment:Texture;root:HTMLElement;quest:BoardingQuest;hero:GLTF;crew:GLTF;deck:GLTF;onBridge:()=>void}
const services=layout.services as [string,string,number,number][];
const blocked=civicBlocked;

export class CivicScene implements ManagedScene{
  private readonly scene=new Scene();private readonly camera=new PerspectiveCamera(46,1,.1,180);private readonly ui=document.createElement('section');private readonly status=document.createElement('p');private readonly hint=document.createElement('p');private readonly notice=document.createElement('p');private readonly interactButton=document.createElement('button');private readonly fire=document.createElement('button');private readonly lifetime=new AbortController();private readonly input:SurfaceInput;private readonly mixer:AnimationMixer;private readonly crewMixer:AnimationMixer;private active=false;private paused=false;private age=0;private noticeClock=0;private clip='';private crewClip='';private cameraDistance=14;private readonly crewTrail:Vector3[]=[];
  constructor(private readonly host:Host){
    for(const [name] of services)if(!host.deck.scene.getObjectByName(name))throw new Error('Missing Civic service anchor: '+name);
    const hero=host.hero.scene,crew=host.crew.scene,rested=host.quest.save.snapshot.location.checkpoint==='civic.quarters';hero.position.set(rested?20:0,0,rested?8:21);crew.position.copy(hero.position).add(new Vector3(-1.3,0,.6));crew.scale.setScalar(.96);this.mixer=new AnimationMixer(hero);this.crewMixer=new AnimationMixer(crew);
    this.scene.background=new Color(0x06111c);this.scene.fog=new Fog(0x06111c,65,115);this.scene.environment=host.environment;this.scene.environmentIntensity=.65;this.scene.add(host.deck.scene,hero,crew,new AmbientLight(0x8fb7ca,.72));
    const sun=new DirectionalLight(0xd9f2ff,2.8);sun.position.set(-12,25,14);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-35,right:35,top:32,bottom:-32,near:1,far:70});sun.shadow.camera.updateProjectionMatrix();this.scene.add(sun);
    for(const [color,x,z] of [[0x00ff66,0,6],[0x00aaff,-11,-2],[0xff9a22,11,-3],[0x9b55ff,11,7]] as const){const l=new PointLight(color,7,10,2);l.position.set(x,2.3,z);this.scene.add(l);}
    this.scene.traverse(o=>{if(o instanceof Mesh){o.castShadow=true;o.receiveShadow=true;for(const m of Array.isArray(o.material)?o.material:[o.material])if(m instanceof MeshStandardMaterial&&/green|cyan|amber|violet|blue|red|light/i.test(m.name))m.toneMapped=false;}});
    this.ui.className='surface-ui civic-ui';this.status.className='surface-status';this.hint.className='surface-hint';this.notice.className='surface-message';const actions=document.createElement('div');actions.className='surface-actions';this.fire.hidden=true;
    this.interactButton.textContent='INTERACT';bindSurfaceButton(this.interactButton,()=>this.interact(),this.lifetime.signal);actions.append(this.interactButton);const pause=document.createElement('button');pause.textContent='PAUSE';bindSurfaceButton(pause,()=>{this.paused=!this.paused;pause.textContent=this.paused?'RESUME':'PAUSE';},this.lifetime.signal);const top=document.createElement('div');top.className='surface-top';const zoomOut=document.createElement('button');zoomOut.textContent='ZOOM −';bindSurfaceButton(zoomOut,()=>this.zoom(1),this.lifetime.signal);const zoomIn=document.createElement('button');zoomIn.textContent='ZOOM +';bindSurfaceButton(zoomIn,()=>this.zoom(-1),this.lifetime.signal);top.append(zoomOut,zoomIn,pause);this.ui.append(this.status,this.hint,top,this.notice,actions);this.ui.hidden=true;host.root.appendChild(this.ui);
    this.input=new SurfaceInput(host.renderer.domElement,this.fire,()=>this.active&&!this.paused&&!this.ui.querySelector('.boarding-shop'),{interact:()=>this.interact(),pause:()=>{this.paused=true;},repair:()=>{},shield:()=>{}});bindFocusPolicy(this.lifetime.signal,()=>this.input.clear(),()=>{if(this.active){this.paused=true;this.input.clear();this.paint();}});host.root.addEventListener('wheel',e=>{if(!this.active)return;e.preventDefault();this.zoom(Math.sign(e.deltaY));},{signal:this.lifetime.signal,passive:false});this.play('Idle');this.playCrew('Idle');this.updateCamera(true);this.paint();
  }
  private play(name:string):void{if(name===this.clip)return;const clip=this.host.hero.animations.find(a=>a.name===name);if(clip){if(this.clip){const old=this.host.hero.animations.find(a=>a.name===this.clip);if(old)this.mixer.existingAction(old)?.fadeOut(.18);}this.mixer.clipAction(clip).reset().fadeIn(.18).play();this.clip=name;}}
  private playCrew(name:string):void{
    if(name===this.crewClip)return;
    const clip=this.host.crew.animations.find(a=>a.name===name);if(!clip)return;
    const previous=this.host.crew.animations.find(a=>a.name===this.crewClip);
    const action=this.crewMixer.clipAction(clip).reset().play();
    if(previous)action.crossFadeFrom(this.crewMixer.clipAction(previous),.1,false);
    this.crewClip=name;
  }
  private nearest(){const p=this.host.hero.scene.position;return services.map(s=>({service:s,d:Math.hypot(p.x-s[2],p.z-s[3])})).sort((a,b)=>a.d-b.d)[0];}
  private say(text:string):void{this.notice.textContent=text;this.noticeClock=5;}
  private zoom(direction:number):void{this.cameraDistance=Math.max(8,Math.min(24,this.cameraDistance+direction*1.5));this.say(`CAMERA ${Math.round((24-this.cameraDistance)/16*100)}% · Mouse wheel or ZOOM buttons.`);this.updateCamera(true);}
  private panel(titleText:string,build:(panel:HTMLElement,paint:()=>void)=>void):void{const panel=document.createElement('section');panel.className='boarding-shop';const title=document.createElement('h2');title.textContent=titleText;const balance=document.createElement('p');const paint=()=>{const s=this.host.quest.save.snapshot;balance.textContent=`${s.credits} SALVAGE CREDITS · ${s.inventory.med_pack??0} MED PACKS`;};paint();panel.append(title,balance);build(panel,paint);const close=document.createElement('button');close.textContent='BACK';close.addEventListener('click',()=>panel.remove(),{signal:this.lifetime.signal});panel.append(close);this.ui.append(panel);}
  private interact():void{
    if(!this.active||this.paused||this.ui.querySelector('.boarding-shop'))return;const near=this.nearest();if(near.d>2.4){this.say('Follow the luminous route to a marked service counter.');return;}const [id,label]=near.service;
    if(id==='Lift_Boarding'){if(this.host.quest.returnToBridge().ok)this.host.onBridge();return;}
    if(id==='Market_Med'){this.panel('CIVIC MARKET · MEDICAL', (p,paint)=>{const info=document.createElement('p');info.textContent='Field supplies for boarding combat. Cargo holds nine packs. Buy for 35 credits; sell for 18.';p.append(info);for(const [text,action] of [['BUY MED PACK · 35','buy'],['SELL MED PACK · 18','sell']] as const){const b=document.createElement('button');b.textContent=text;b.addEventListener('click',()=>{const r=this.host.quest.tradeMedPack(action);this.say(r.ok?action==='buy'?'Med pack secured.':'Cargo sold.':action==='buy'?'Need 35 credits or cargo is full.':'No med packs in cargo.');paint();},{signal:this.lifetime.signal});p.append(b);}});return;}
    if(id==='Armory_Capacitor'){this.panel('CAPACITOR WORKSHOP', (p,paint)=>{const info=document.createElement('p');info.textContent='Permanent hero upgrade � A reinforced melee capacitor adds 8 damage to close strikes. One installation carries with your save.';p.append(info);const b=document.createElement('button');b.textContent='MELEE CAPACITOR · 140';b.disabled=!!this.host.quest.save.snapshot.heroUpgrades.melee_capacitor;b.addEventListener('click',()=>{const r=this.host.quest.installMeleeCapacitor();if(r.ok)b.disabled=true;this.say(r.ok?'Capacitor installed. Close strikes gain +8 damage.':'Already installed or insufficient salvage.');paint();},{signal:this.lifetime.signal});p.append(b);});return;}
    if(id==='Quarters_Save'){const r=this.host.quest.restAtQuarters();this.say(r.ok?'REST COMPLETE · Progress saved and vitals restored.':'Quarters could not save. Retry.');return;}
    if(id==='Bank_Kiosk'){this.say('BANK ONLINE · Shared salvage balance verified. Vault and contracts unlock after Mars.');return;}
    this.say(`${label} SEALED · Restore more of the Warship city to open this route.`);
  }
  setActive(v:boolean):void{this.active=v;this.ui.hidden=!v;this.input.setActive(v);window.dispatchEvent(new CustomEvent('coded:music-cue',{detail:{cue:v?'warship_home':'silence'}}));}
  update(dt:number):void{if(!this.active)return;this.age+=dt;if(this.noticeClock>0&&(this.noticeClock-=dt)<=0)this.notice.textContent='';if(this.paused||this.ui.querySelector('.boarding-shop')){this.input.clear();this.paint();return;}const move=this.input.move,hero=this.host.hero.scene,previousPosition=hero.position.clone(),dx=move.x*5.5*dt,dz=move.y*5.5*dt;let nx=hero.position.x+dx,nz=hero.position.z;if(!blocked(nx,nz))hero.position.x=nx;nx=hero.position.x;nz=hero.position.z+dz;if(!blocked(nx,nz))hero.position.z=nz;if(Math.hypot(move.x,move.y)>.1)hero.rotation.y=Math.atan2(move.x,move.y);const actualSpeed=hero.position.distanceTo(previousPosition)/Math.max(dt,.001);this.play(actualSpeed<.1?'Idle':actualSpeed<3?'Walk':'Run');const crew=this.host.crew.scene;
const last=this.crewTrail[this.crewTrail.length-1];
if(!last||last.distanceTo(hero.position)>.6)this.crewTrail.push(hero.position.clone());
if(this.crewTrail.length>200)this.crewTrail.shift();
const target=this.crewTrail[0];
if(target&&this.crewTrail.length>3){
 const delta=target.clone().sub(crew.position),distance=delta.length();
 if(distance<.25)this.crewTrail.shift();
 else{delta.normalize();const step=Math.min((this.crewTrail.length>7?6:2.8)*dt,distance);const cx=crew.position.x+delta.x*step,cz=crew.position.z+delta.z*step;if(!blocked(cx,crew.position.z))crew.position.x=cx;if(!blocked(crew.position.x,cz))crew.position.z=cz;crew.rotation.y=Math.atan2(delta.x,delta.z);}
 this.playCrew(this.crewTrail.length>7?'Run':'Walk');
}else this.playCrew('Idle');
this.mixer.update(dt);this.crewMixer.update(dt);this.updateCamera();this.paint();}
  private updateCamera(snap=false):void{const hero=this.host.hero.scene.position,aspect=this.host.root.clientWidth/Math.max(1,this.host.root.clientHeight),distance=this.cameraDistance*(aspect<1?1.1:1),goal=hero.clone().add(new Vector3(0,distance,distance));if(snap)this.camera.position.copy(goal);else this.camera.position.lerp(goal,.13);this.camera.lookAt(hero.x,0,hero.z-2);this.camera.aspect=aspect;this.camera.updateProjectionMatrix();}
  private paint():void{const s=this.host.quest.save.snapshot,n=this.nearest();this.status.textContent=`CAPTURED WARSHIP · CIVIC DECK\n${s.credits} SALVAGE · ${s.inventory.med_pack??0}/9 MED PACKS\nHERO ${s.heroUpgrades.boarding_weapon??1} · FIGHTER ${Object.values(s.fighterUpgrades).reduce((a,b)=>a+b,0)} · WARSHIP ${Object.keys(s.capitalUpgrades).length}`;this.hint.textContent=n.d<2.4?`${n.service[1]} · INTERACT`:'WEST: Medical exchange / Armory � EAST: Bank / Quarters � SOUTH: Boarding lift';this.interactButton.textContent=n.d<2.4?n.service[1]:'INTERACT';if(this.host.quest.save.testSlot)Object.assign(this.ui.dataset,{position:JSON.stringify(this.host.hero.scene.position.toArray()),nearest:n.service[0],distance:n.d.toFixed(2),credits:String(s.credits),medPacks:String(s.inventory.med_pack??0),paused:String(this.paused)});}
  render():void{this.host.renderer.render(this.scene,this.camera);}
  dispose():void{this.active=false;this.input.dispose();this.lifetime.abort();this.mixer.stopAllAction();this.crewMixer.stopAllAction();this.mixer.uncacheRoot(this.host.hero.scene);this.crewMixer.uncacheRoot(this.host.crew.scene);disposeObject(this.scene);this.ui.remove();}
}
