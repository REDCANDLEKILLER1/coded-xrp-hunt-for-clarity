import {recordPlaytest,samplePlaytest} from './PlaytestTelemetry';
import {AmbientLight,AnimationMixer,Box3,BoxGeometry,Color,CylinderGeometry,DirectionalLight,Fog,Group,Mesh,MeshBasicMaterial,PerspectiveCamera,PointLight,Scene,SphereGeometry,TorusGeometry,Vector3,type Texture,type WebGLRenderer} from 'three';
import type {GLTF} from 'three/addons/loaders/GLTFLoader.js';
import type {CampaignSave} from './CampaignSave';
import type {ManagedScene} from './SceneController';
import {disposeObject} from './ModelAssets';
import {BULLION_LAYOUT as L,BULLION_COMMS,bullionSpawn,chooseFreightLane,commitFreightBoundary,freightSector,markMarketSiegeDown,meetLex,nearFreight} from './BullionReach';
import {FreightConvoy,FREIGHT_JUNCTIONS,type FreightPoint,type FreightPoint3} from './FreightConvoy';
import {MarketSiegeEngine,MARKET_SIEGE,siegeHazardHit,siegeShellPosition,type SiegeHazard} from './MarketSiegeEngine';
import {FreightScanner} from './FreightScanner';
import {freightBoxContains,freightBoxHit,freightSphereHit,freightPushOut} from './FreightGeometry';
import {CommsPanel} from './CommsPanel';
import {SurfaceInput,bindSurfaceButton} from './SurfaceInput';
import {SurfaceDash} from './SurfaceDash';
import {SpectralReveal} from './SpectralReveal';
import {fieldRepair,slideSurface} from './SurfaceCombat';
import {fighterFootprint,withinFootprint,type GroundPoint} from './FighterFootprint';
import {PARKED_HEIGHT} from './LandingPlan';
import {frameConversation} from './ConversationFrame';
import {frameWarden} from './WardenFrame';
import {sfx} from '../audio/Sfx';
import './surface.css';

interface Host{renderer:WebGLRenderer;environment:Texture;root:HTMLElement;save:CampaignSave;models:GLTF[];arrival:boolean;onOrbit:()=>void;onRetry:()=>void}
interface Guard{mesh:Group;sector:string;hp:number;wait:number;charge:number;target:Vector3;tell:Mesh}
interface Shot{mesh:Mesh;origin:Vector3;velocity:Vector3;hostile:boolean;life:number}
interface HazardView{tell:Mesh;shell:Mesh}

/** A connected physical convoy encounter. Safe-boundary transactions own progress;
 * the rendered haulers, gun anchors and cover own collision in metre units. */
export class BullionReachScene implements ManagedScene{
  private readonly scene=new Scene();private readonly camera=new PerspectiveCamera(46,1,.1,400);private readonly sun=new DirectionalLight(0xffe9c0,3.1);
  private readonly ui=document.createElement('section');private readonly status=document.createElement('p');private readonly hint=document.createElement('p');private readonly notice=document.createElement('p');private readonly beacon=document.createElement('span');
  private readonly fire=document.createElement('button');private readonly pauseButton=document.createElement('button');private readonly repairButton=document.createElement('button');private readonly shieldButton=document.createElement('button');private readonly dashButton=document.createElement('button');private readonly revealButton=document.createElement('button');private readonly interactButton=document.createElement('button');
  private readonly lifeTime=new AbortController();private readonly input:SurfaceInput;private readonly comms:CommsPanel;private readonly hero:Group;private readonly lex:Group;private readonly fighter:Group;private readonly terrain:Group;private readonly boss:Group;private readonly haulers:Group[]=[];
  private readonly mixer:AnimationMixer;private readonly lexMixer:AnimationMixer;private readonly convoy:FreightConvoy;private readonly battle:MarketSiegeEngine;private readonly scanner:FreightScanner;private readonly fighterOutline:readonly GroundPoint[];
  private readonly dash=new SurfaceDash();private readonly reveal=new SpectralReveal();private readonly guards:Guard[]=[];private readonly shots:Shot[]=[];private readonly hazardViews=new Map<number,HazardView>();private readonly labels:HTMLSpanElement[]=[];
  private readonly green=new MeshBasicMaterial({color:0x00ff00,toneMapped:false});private readonly red=new MeshBasicMaterial({color:0xff1600,toneMapped:false});private readonly box=new BoxGeometry(1,1,1);private readonly ball=new SphereGeometry(.085,8,6);private readonly circle=new CylinderGeometry(1,1,.025,32);
  private readonly revealRing=new Mesh(new TorusGeometry(1,.025,6,64),this.green);private readonly rearRing=new Mesh(new TorusGeometry(.95,.04,6,32),this.green);private readonly scannerRing=new Mesh(new TorusGeometry(.8,.035,6,32),this.green);
  private readonly shield=new Mesh(new SphereGeometry(1,16,10),new MeshBasicMaterial({color:0x00ff00,wireframe:true,transparent:true,opacity:.17,toneMapped:false}));
  private panel:HTMLElement|null=null;private active=false;private paused=false;private pending=false;private dead=false;private met=false;private restored=false;private bossStarted=false;private aboard=false;private boarding=0;private arrival=0;private talked=false;private talkKind:keyof typeof BULLION_COMMS='lex';
  private life=100;private charge=100;private shielding=false;private repairCooldown=0;private invulnerable=0;private fireClock=0;private noticeClock=0;private age=0;private hudClock=0;private heroClip='';private lexClip='';private dashing=false;private shotsFired=0;private hits=0;private injuries=0;

  constructor(private readonly host:Host){
    const [hero,lex,fighter,yard,boss,hauler,drone]=host.models;
    this.hero=hero.scene;this.lex=lex.scene;this.fighter=fighter.scene;this.terrain=yard.scene;this.boss=boss.scene;this.mixer=new AnimationMixer(this.hero);this.lexMixer=new AnimationMixer(this.lex);
    for(const name of ['Hero_Origin','Hand_R','Hand_L'])if(!this.hero.getObjectByName(name)||!this.lex.getObjectByName(name))throw Error('Missing character attachment: '+name);
    for(const name of ['Siege_Origin','Rear_Control','Rear_Shutter_L','Rear_Shutter_R','Mortar_L0','Mortar_L1','Mortar_R0','Mortar_R1'])if(!this.boss.getObjectByName(name))throw Error('Missing siege attachment: '+name);
    for(const name of ['Hauler_Origin','Repair_Port','Cargo_Focus'])if(!hauler.scene.getObjectByName(name))throw Error('Missing freight attachment: '+name);
    if(!this.terrain.getObjectByName('Scanner_Origin'))throw Error('Missing freight scanner attachment');
    this.convoy=new FreightConvoy(host.save.snapshot.convoy??undefined);this.met=host.save.snapshot.quests.includes('bullion_reach.lex_met');this.restored=host.save.snapshot.quests.includes('bullion_reach.restored');this.aboard=this.met&&!this.restored;
    this.battle=new MarketSiegeEngine(()=>({muzzles:['Mortar_L0','Mortar_R0','Mortar_L1','Mortar_R1'].map(name=>this.boss.getObjectByName(name)!.getWorldPosition(new Vector3())),rear:this.rear()}));
    if(host.save.snapshot.quests.includes('bullion_reach.siege_defeated')){this.battle.hp=0;this.bossStarted=true;}
    this.scanner=new FreightScanner(this.terrain.getObjectByName('Scanner_Origin')!.getWorldPosition(new Vector3()));
    if(this.met&&this.convoy.stage==='apron')this.convoy.start(true);
    const spawn=bullionSpawn(host.save);this.hero.position.set(spawn.x,0,spawn.z);this.lex.position.set(L.lex.x,0,L.lex.z);this.lex.visible=!this.aboard;
    this.fighter.position.set(L.landing.x,PARKED_HEIGHT,L.landing.z);this.fighterOutline=fighterFootprint(this.fighter);const canopy=this.fighter.getObjectByName('Canopy_Hinge');if(canopy)canopy.rotation.x=-1.15;
    this.arrival=host.arrival?4:0;this.fighter.position.y+=this.arrival?8:0;this.hero.visible=!this.arrival;this.paused=host.save.testSlot;
    this.scene.background=new Color(0x1c1b16);this.scene.fog=new Fog(0x474035,65,180);this.scene.environment=host.environment;this.scene.environmentIntensity=.6;this.scene.add(this.hero,this.lex,this.fighter,this.terrain,this.boss,new AmbientLight(0xdfd9c2,.75));
    this.sun.castShadow=true;this.sun.shadow.mapSize.set(1024,1024);Object.assign(this.sun.shadow.camera,{left:-23,right:23,top:23,bottom:-23,near:1,far:100});this.sun.shadow.camera.updateProjectionMatrix();this.sun.shadow.bias=-.0003;this.sun.shadow.normalBias=.035;this.scene.add(this.sun,this.sun.target);
    for(let i=0;i<2;i++){const truck=hauler.scene.clone(true);this.scene.add(truck);this.haulers.push(truck);const label=document.createElement('span');label.className='freight-hull-label';this.ui.appendChild(label);this.labels.push(label);}
    const library=new Group();library.visible=false;library.add(hauler.scene,drone.scene,new Mesh(this.ball,this.green),new Mesh(this.box,this.red),new Mesh(this.circle,this.red));this.scene.add(library);
    for(const [i,g] of L.guards.entries()){
      const mesh=drone.scene.clone(true);mesh.scale.setScalar(.11);mesh.position.set(g.x,1.15,g.z);this.scene.add(mesh);
      const tell=new Mesh(this.circle,new MeshBasicMaterial({color:0xff1600,transparent:true,opacity:.32,toneMapped:false,depthWrite:false}));tell.visible=false;this.scene.add(tell);
      this.guards.push({mesh,sector:g.sector,hp:this.convoy.checkpoint.cleared.includes(g.sector)?0:60,wait:1.5+i*.2,charge:0,target:new Vector3(),tell});
    }
    const halo=new PointLight(0x00ff00,4,6,2);halo.position.y=1;this.hero.add(halo);this.revealRing.rotation.x=Math.PI/2;this.revealRing.visible=false;this.rearRing.visible=false;this.scannerRing.visible=false;this.shield.visible=false;this.shield.scale.set(.8,1.05,.8);this.scene.add(this.revealRing,this.rearRing,this.scannerRing,this.shield);
    this.scene.traverse(o=>{if(o instanceof Mesh){o.castShadow=true;o.receiveShadow=true;for(const m of Array.isArray(o.material)?o.material:[o.material])if(/#00FF00|#FF1600/.test(m.name))m.toneMapped=false;}});
    this.syncActors(0);if(!this.clear(this.hero.position)){const origin=this.hero.position.clone();let found=false;for(let radius=1;radius<=12&&!found;radius++)for(let i=0;i<16;i++){const p={x:origin.x+Math.cos(i*Math.PI/8)*radius,z:origin.z+Math.sin(i*Math.PI/8)*radius};if(this.clear(p)){this.hero.position.set(p.x,0,p.z);found=true;break;}}if(!found)throw Error('No valid freight checkpoint spawn');}
    this.ui.className='surface-ui fog-ui bullion-ui';this.comms=new CommsPanel(this.ui);this.buildUI();this.input=new SurfaceInput(host.renderer.domElement,this.fire,()=>this.canAct(),{interact:()=>this.interact(),pause:()=>this.togglePause(),repair:()=>this.repair(),shield:()=>this.toggleShield(),dash:()=>this.startDash(),reveal:()=>this.pulse()});
    window.addEventListener('blur',this.pause,{signal:this.lifeTime.signal});document.addEventListener('visibilitychange',()=>{if(document.hidden)this.pause();},{signal:this.lifeTime.signal});this.play('Idle');this.playLex('Idle');this.refresh();this.updateCamera(true);this.paint();
  }
  private buildUI():void{
    this.status.className='surface-status';this.hint.className='surface-hint';this.notice.className='surface-message';this.beacon.className='freight-route-beacon';const top=document.createElement('div');top.className='surface-top';const bottom=document.createElement('div');bottom.className='surface-actions';
    const action=(b:HTMLButtonElement,label:string,run:()=>void,parent:HTMLElement)=>{b.type='button';b.textContent=label;bindSurfaceButton(b,()=>{if(this.active)run();},this.lifeTime.signal);parent.appendChild(b);};
    action(this.pauseButton,'PAUSE',()=>this.togglePause(),top);const ship=document.createElement('button');action(ship,'WARSHIP',()=>this.returnShip(),top);
    action(this.shieldButton,'SHIELD',()=>this.toggleShield(),bottom);action(this.repairButton,'REPAIR',()=>this.repair(),bottom);action(this.dashButton,'DASH',()=>this.startDash(),bottom);action(this.revealButton,'REVEAL',()=>this.pulse(),bottom);action(this.interactButton,'INTERACT',()=>this.interact(),bottom);action(this.fire,'BLAST',()=>{},bottom);this.fire.className='surface-fire';
    this.ui.append(this.status,this.hint,top,this.notice,bottom,this.beacon);this.ui.hidden=true;this.host.root.appendChild(this.ui);
  }
  private canAct():boolean{return this.active&&!this.paused&&!this.dead&&!this.pending&&!this.panel&&!this.comms.active&&this.arrival===0;}
  setActive(value:boolean):void{if(value)recordPlaytest('mission','Bullion convoy active',{stage:this.convoy.stage,first:this.convoy.checkpoint.first,second:this.convoy.checkpoint.second});this.active=value;this.ui.hidden=!value;this.input.setActive(value);this.comms.setActive(value);window.dispatchEvent(new CustomEvent('coded:music-cue',{detail:{cue:value?'transit':'silence'}}));}
  saveBeforeLeave():boolean{return !this.pending;}
  private readonly pause=():void=>{if(this.active){this.paused=true;this.input.clear();this.paint();}};
  private togglePause():void{if(!this.active||this.dead||this.pending||this.comms.active)return;this.paused=!this.paused;this.input.clear();this.paint();}
  private say(text:string):void{this.notice.textContent=text;this.noticeClock=8;}
  private talk(kind:keyof typeof BULLION_COMMS,commit:()=>boolean):void{this.talkKind=kind;this.input.clear();this.play('Idle');this.playLex('Interact');this.comms.open(BULLION_COMMS[kind],()=>{const ok=commit();this.input.clear();if(ok){this.playLex('Idle');this.refresh();this.paint();}return ok;});}
  private returnPoint():FreightPoint{return L.returnPoint;}
  private returnShip():void{if(!this.canAct())return;if(!nearFreight(this.hero.position,this.returnPoint())){this.say('Return to the south landing apron beside your fighter.');return;}this.input.clear();this.host.onOrbit();}
  private remaining(sector:string):number{return this.guards.filter(g=>g.hp>0&&g.sector===sector).length;}
  private rear():Vector3{return this.boss.getObjectByName('Rear_Control')!.getWorldPosition(new Vector3());}
  private clear(p:FreightPoint):boolean{
    const b=L.bounds;if(p.x<b.minX+.5||p.x>b.maxX-.5||p.z<b.minZ+.5||p.z>b.maxZ-.5||withinFootprint(p,this.fighterOutline))return false;
    if(L.cover.some(c=>freightBoxContains(p,{...c,heading:0},c.w/2+.45,c.d/2+.45)))return false;
    if(L.blockades.some(b=>!this.convoy.checkpoint.cleared.includes(b.sector)&&this.remaining(b.sector)>0&&freightBoxContains(p,{...b,heading:0},3.1,.8)))return false;
    if(this.convoy.poses.some(h=>freightBoxContains(p,h,1.55,2.7)))return false;
    if(freightBoxContains(p,this.battle.pose,3.85,5.5))return false;
    return true;
  }
  private coverHit(a:FreightPoint3,b:FreightPoint3):number|null{
    const hits=L.cover.map(c=>freightBoxHit(a,b,{...c,heading:0},c.w/2,0,c.h,c.d/2));
    for(const gate of L.blockades)if(this.remaining(gate.sector)>0&&!this.convoy.checkpoint.cleared.includes(gate.sector))hits.push(freightBoxHit(a,b,{...gate,heading:0},2.7,0,1.4,.34));
    const valid=hits.filter((n):n is number=>n!==null);return valid.length?Math.min(...valid):null;
  }
  private interact():void{
    if(!this.canAct())return;
    if(nearFreight(this.hero.position,this.returnPoint())){this.returnShip();return;}
    if(!this.met&&nearFreight(this.hero.position,L.lex)){
      if(this.remaining('apron')){this.say('Clear the red patrol pinning LEX and the haulers.');return;}
      this.talk('lex',()=>{const r=meetLex(this.host.save,this.convoy,this.hero.position,0);if(r.ok){this.met=true;this.boarding=2.2;this.aboard=false;}return r.ok;});return;
    }
    if(this.convoy.waitingForChoice&&nearFreight(this.hero.position,FREIGHT_JUNCTIONS[this.convoy.stage==='junction_one'?0:1])){this.openJunction();return;}
    const nearby=this.convoy.poses.findIndex(h=>nearFreight(this.hero.position,h));
    if(nearby>=0){const upgraded=!!this.host.save.snapshot.heroUpgrades.logistics_service;if(this.convoy.repair(nearby,this.hero.position,!!this.host.save.snapshot.heroUpgrades.field_repair,upgraded)){sfx.play('pulse',.5);this.say(`HAULER ${nearby+1} · 35 hull restored.`);}else this.say(this.convoy.repairCooldown>0?`Convoy repair recharges in ${Math.ceil(this.convoy.repairCooldown)} seconds.`:'This hauler is already sound. Field Repair is required for damage.');return;}
    if(this.restored&&nearFreight(this.hero.position,this.lex.position)){this.talk('delivered',()=>true);return;}
    this.say(!this.met?'Meet LEX beside the two green relief haulers.':this.convoy.waitingForChoice?'Walk to the lead hauler at the junction and use INTERACT.':'Stay with the haulers. Clear red barricades; repair nearby damaged cargo.');
  }
  private openJunction():void{
    const first=this.convoy.stage==='junction_one',kind=first?'firstJunction':'secondJunction';
    if(!this.host.save.snapshot.dialogueSeen.includes(BULLION_COMMS[kind].id)){this.talk(kind,()=>this.host.save.update(d=>{if(!d.dialogueSeen.includes(BULLION_COMMS[kind].id))d.dialogueSeen.push(BULLION_COMMS[kind].id);}).ok);return;}
    this.input.clear();const panel=document.createElement('section');panel.className='boarding-shop freight-choice';const text=document.createElement('p');text.textContent=first?'Choose the physical freight lane. Express is shorter; service has cover.':'Choose the next freight lane. East faces a lengthwise sweep; west faces crossing fire.';panel.appendChild(text);
    const choices=first?[['EXPRESS LANE','express'],['COVERED SERVICE LANE','covered']] as const:[['EAST FREIGHT LINE','east'],['WEST CONTROL ROAD','west']] as const;
    for(const [label,lane] of choices){const b=document.createElement('button');b.textContent=label;bindSurfaceButton(b,()=>{if(!this.active||this.paused)return;const r=chooseFreightLane(this.host.save,this.convoy,lane,this.hero.position);if(!r.ok){text.textContent='The route choice could not save. The haulers are holding here. Retry your choice.';return;}panel.remove();this.panel=null;this.input.clear();this.refresh();},this.lifeTime.signal);panel.appendChild(b);}
    const close=document.createElement('button');close.textContent='BACK';bindSurfaceButton(close,()=>{panel.remove();this.panel=null;this.input.clear();},this.lifeTime.signal);panel.appendChild(close);this.panel=panel;this.ui.appendChild(panel);
  }
  private retryCommit(action:()=>boolean,text:string):void{
    this.pending=true;this.input.clear();const panel=document.createElement('section');panel.className='boarding-shop freight-choice';const p=document.createElement('p');p.textContent=text;const retry=document.createElement('button');retry.textContent='RETRY SAVE';bindSurfaceButton(retry,()=>{if(!this.active)return;if(action()){panel.remove();this.panel=null;this.pending=false;this.input.clear();this.refresh();}else p.textContent='The checkpoint is still waiting for storage. The encounter remains held.';},this.lifeTime.signal);panel.append(p,retry);this.panel=panel;this.ui.appendChild(panel);
  }
  private pulse():void{if(this.canAct()&&this.reveal.request(!!this.host.save.snapshot.heroUpgrades.spectral_reveal)){sfx.play('pulse',.5);this.say(this.bossStarted?'REVEAL · Green ring marks the rear routing control while it vents.':'REVEAL · Green ring traces the actual lane scanner. Red strips remain dangerous.');}}
  private toggleShield():void{if(this.canAct()&&this.host.save.snapshot.heroUpgrades.ledger_shield)this.shielding=!this.shielding;}
  private repair():void{if(!this.canAct())return;const r=fieldRepair(this.life,this.repairCooldown,!!this.host.save.snapshot.heroUpgrades.field_repair);if(r.used){this.life=r.life;this.repairCooldown=r.cooldown;sfx.play('pulse',.5);}}
  private startDash():void{if(!this.canAct())return;const m=this.input.move;this.dash.request(!!this.host.save.snapshot.heroUpgrades.liquidity_dash,Math.hypot(m.x,m.y)>.1?{x:m.x,z:m.y}:{x:Math.sin(this.hero.rotation.y),z:Math.cos(this.hero.rotation.y)});}
  private play(name:string):void{if(name===this.heroClip)return;const clip=this.host.models[0].animations.find(a=>a.name===name);if(!clip)return;const next=this.mixer.clipAction(clip).reset().play(),old=this.host.models[0].animations.find(a=>a.name===this.heroClip);if(old)this.mixer.clipAction(old).crossFadeTo(next,.15,false);this.heroClip=name;}
  private playLex(name:string):void{if(name===this.lexClip)return;const clip=this.host.models[1].animations.find(a=>a.name===name);if(!clip)return;this.lexMixer.stopAllAction();this.lexMixer.clipAction(clip).play();this.lexClip=name;}
  private visible(v:Vector3):boolean{const p=v.clone().project(this.camera);return p.z>-1&&p.z<1&&Math.abs(p.x)<.95&&Math.abs(p.y)<.9;}
  private shoot(origin:Vector3,target:Vector3,hostile:boolean):void{if(this.shots.length>=64)return;const mesh=new Mesh(this.ball,hostile?this.red:this.green);mesh.position.copy(origin);this.scene.add(mesh);this.shots.push({mesh,origin:origin.clone(),velocity:target.clone().sub(origin).normalize().multiplyScalar(hostile?9:28),hostile,life:hostile?2.4:1.1});if(!hostile)this.shotsFired++;sfx.play(hostile?'enemyShoot':'shoot',.2);}
  private fail(convoy=false):void{if(this.dead)return;recordPlaytest('combat','convoy checkpoint retry',{cargoDisabled:convoy,stage:this.convoy.stage,life:this.life,haulers:this.convoy.poses.map(h=>h.hull)});this.dead=true;this.input.clear();this.play('KnockdownRecover');const panel=document.createElement('section');panel.className='boarding-shop freight-choice';const text=document.createElement('p');text.textContent=convoy?'A relief hauler is disabled. Retry this saved leg with its route choice and cargo checkpoint intact.':'LEX will regroup at the last safe junction. Your earlier clears and upgrades remain saved.';const retry=document.createElement('button');retry.textContent='RETRY CONVOY CHECKPOINT';bindSurfaceButton(retry,()=>{if(this.active)this.host.onRetry();},this.lifeTime.signal);panel.append(text,retry);this.ui.appendChild(panel);}
  private hurt(amount:number):void{if(this.dead||this.invulnerable>0||this.dashing)return;this.invulnerable=.55;this.injuries++;if(this.shielding&&this.charge>0){this.charge=Math.max(0,this.charge-amount*1.8);return;}this.life=Math.max(0,this.life-amount);sfx.play('hurt',.35);if(this.life===0)this.fail();}
  private patrol(dt:number):void{
    const sector=freightSector(this.convoy);let tells=this.guards.filter(g=>g.hp>0&&g.charge>0).length;
    for(const g of this.guards){if(g.hp<=0||g.sector!==sector)continue;g.mesh.position.y=1.15+Math.sin(this.age*2+g.mesh.position.x)*.1;g.mesh.rotation.y=Math.atan2(this.hero.position.x-g.mesh.position.x,this.hero.position.z-g.mesh.position.z);
      if(g.charge>0){g.charge-=dt;if(g.charge<=0){g.tell.visible=false;tells--;if(this.coverHit(g.mesh.position,g.target)===null)this.shoot(g.mesh.position,g.target,true);g.wait=2.8;}}
      else if((g.wait-=dt)<=0&&tells<2){const cargo=this.convoy.poses.filter(h=>h.hull>0).map(h=>new Vector3(h.x,1.2,h.z));const targets=[this.hero.position.clone().add(new Vector3(0,1,0)),...cargo].filter(t=>t.distanceTo(g.mesh.position)<13&&this.coverHit(g.mesh.position,t)===null);if(targets.length){g.target.copy(targets[Math.floor(this.age)%targets.length]);g.charge=1.1;g.tell.position.copy(g.target).y=.03;g.tell.scale.set(.85,1,.85);g.tell.visible=true;tells++;}}
    }
  }
  private updateShots(dt:number):void{
    for(let i=this.shots.length-1;i>=0;i--){const b=this.shots[i],before=b.mesh.position.clone();b.life-=dt;b.mesh.position.addScaledVector(b.velocity,dt);const end=b.mesh.position,cover=this.coverHit(before,end)??Infinity;
      if(b.hostile){const hero=freightSphereHit(before,end,this.hero.position.clone().add(new Vector3(0,1,0)),.5)??Infinity,cargo=this.convoy.firstHit(before,end);const t=Math.min(cover,hero,cargo?.t??Infinity);if(t<Infinity){if(hero===t)this.hurt(8);else if(cargo&&cargo.t===t)this.convoy.hit(before,end,8);b.life=0;}}
      else{const contacts=this.guards.filter(g=>g.hp>0&&g.mesh.visible).map(g=>({g,t:freightSphereHit(before,end,g.mesh.position,.72)})).filter((v):v is {g:Guard;t:number}=>v.t!==null).sort((a,b)=>a.t-b.t);const guard=contacts[0];const weak=this.bossStarted&&this.battle.hp>0?freightSphereHit(before,end,this.rear(),MARKET_SIEGE.rearRadius):null;
        if(guard&&guard.t<=cover&&(weak===null||guard.t<=weak)){guard.g.hp=Math.max(0,guard.g.hp-12);this.hits++;b.life=0;if(!guard.g.hp){guard.g.mesh.visible=false;guard.g.tell.visible=false;this.refresh();sfx.play('explode',.25);}}
        else if(weak!==null&&weak<=cover){if(this.battle.hitRear(b.origin,end,12))this.hits++;b.life=0;}
        else if(cover<Infinity||freightBoxHit(before,end,this.battle.pose,3.5,.2,3.6,5.2)!==null)b.life=0;
      }
      if(b.life<=0){this.scene.remove(b.mesh);this.shots.splice(i,1);}
    }
  }
  private currentHazards():SiegeHazard[]{return [...this.battle.hazards,...this.scanner.hazards];}
  private updateHazards():void{
    const hazards=this.currentHazards(),ids=new Set(hazards.map(h=>h.id));
    for(const [id,v] of this.hazardViews)if(!ids.has(id)){this.scene.remove(v.tell,v.shell);(v.tell.material as MeshBasicMaterial).dispose();this.hazardViews.delete(id);}
    for(const h of hazards){let v=this.hazardViews.get(h.id);if(!v){v={tell:new Mesh(h.kind==='strip'?this.box:this.circle,new MeshBasicMaterial({color:0xff1600,transparent:true,opacity:.3,toneMapped:false,depthWrite:false})),shell:new Mesh(this.ball,this.red)};this.hazardViews.set(h.id,v);this.scene.add(v.tell,v.shell);}
      const hot=h.tell===0&&h.age>=h.travel,dx=h.target.x-h.from.x,dz=h.target.z-h.from.z;
      v.tell.position.set(h.kind==='strip'?(h.from.x+h.target.x)/2:h.target.x,hot?.11:.04,h.kind==='strip'?(h.from.z+h.target.z)/2:h.target.z);
      v.tell.rotation.y=h.kind==='strip'?Math.atan2(dx,dz):0;v.tell.scale.set(h.kind==='strip'?h.radius*2:h.radius,h.kind==='strip'?.035:1,h.kind==='strip'?Math.hypot(dx,dz):h.radius);(v.tell.material as MeshBasicMaterial).opacity=hot?.85:.24+.10*Math.sin(this.age*12);
      v.shell.visible=h.kind==='mortar'&&h.tell===0&&h.age<h.travel;const shell=siegeShellPosition(h);v.shell.position.set(shell.x,shell.y,shell.z);v.shell.scale.setScalar(3);
      const impact=h.kind==='mortar'?{...h.target,y:.5}:{x:this.hero.position.x,y:.5,z:this.hero.position.z};
      if(siegeHazardHit(h,'hero',this.hero.position)&&this.coverHit(impact,this.hero.position.clone().add(new Vector3(0,1,0)))===null)this.hurt(h.kind==='mortar'?18:16);
      for(const [index,hauler] of this.convoy.poses.entries())if(siegeHazardHit(h,'hauler'+index,hauler,1.2))this.convoy.blast(index,h.kind==='mortar'?16:12);
    }
  }
  private refresh():void{
    const sector=freightSector(this.convoy);for(const g of this.guards){g.mesh.visible=g.hp>0&&g.sector===sector&&!this.restored;if(!g.mesh.visible){g.tell.visible=false;g.charge=0;}}
    for(const b of L.blockades){const node=this.terrain.getObjectByName('Blockade_'+b.sector);if(node)node.visible=this.remaining(b.sector)>0&&!this.convoy.checkpoint.cleared.includes(b.sector)&&!this.restored;}
    const light=this.terrain.getObjectByName('Public_Delivery_Light');if(light)light.visible=this.restored;
  }
  private syncActors(dt:number):void{
    const pose=this.battle.pose;this.boss.position.set(pose.x,0,pose.z);this.boss.rotation.y=pose.heading;
    for(const side of ['L','R']){const shutter=this.boss.getObjectByName('Rear_Shutter_'+side)!;shutter.position.x=(side==='L'?-1:1)*(this.battle.open||this.battle.hp===0?1.8:.53);}
    for(const [i,h] of this.convoy.poses.entries()){const truck=this.haulers[i];if(!truck)continue;const moved=Math.hypot(truck.position.x-h.x,truck.position.z-h.z);truck.position.set(h.x,0,h.z);truck.rotation.y=h.heading;if(dt>0&&moved<1)for(const side of ['L','R'])for(let w=0;w<3;w++){const wheel=truck.getObjectByName('Wheel_'+side+w);if(wheel)wheel.rotation.x+=moved/.45;}}
    if(this.restored){this.lex.visible=true;this.lex.position.set(-3,0,-64);this.lex.rotation.y=Math.PI/2;}
    else if(this.boarding>0){this.boarding=Math.max(0,this.boarding-dt);const target=new Vector3(-1.5,0,35.5),delta=target.clone().sub(this.lex.position);this.lex.rotation.y=Math.atan2(delta.x,delta.z);this.lex.position.addScaledVector(delta,Math.min(1,dt*2));this.playLex('Walk');if(!this.boarding){this.aboard=true;this.lex.visible=false;this.playLex('Idle');}}
    this.scene.updateMatrixWorld(true);
  }
  private finishDelivery():void{recordPlaytest('mission','Bullion relief delivered',{first:this.convoy.checkpoint.first,second:this.convoy.checkpoint.second,haulers:this.convoy.poses.map(h=>h.hull),credits:this.host.save.snapshot.credits,lex:this.host.save.snapshot.recruits.includes('lex')});this.restored=true;this.pending=false;this.battle.hazards.length=0;this.scanner.hazards.length=0;for(const b of this.shots)this.scene.remove(b.mesh);this.shots.length=0;this.syncActors(0);this.refresh();this.talk('delivered',()=>true);this.say('RELIEF DELIVERED · LEX recruited. Rugfall and SEC Outpost coordinates retained.');}
  update(dt:number):void{
    if(!this.active||!Number.isFinite(dt)||dt<=0||dt>.25)return;this.comms.update(dt);if(this.talked&&!this.comms.active){this.input.clear();this.updateCamera(true);}this.talked=this.comms.active;
    if(this.comms.active){this.mixer.update(dt);this.lexMixer.update(dt);this.updateCamera();this.paint();return;}if(this.paused||this.dead||this.pending||this.panel){this.paint();return;}
    if(this.arrival>0){this.arrival=Math.max(0,this.arrival-dt);this.fighter.position.y=PARKED_HEIGHT+8*(this.arrival/4)**2;if(!this.arrival){this.hero.visible=true;this.input.clear();}this.updateCamera();this.paint();return;}
    if(this.convoy.failed){this.fail(true);this.paint();return;}
    if(this.convoy.stage==='siege'&&!this.bossStarted&&this.hero.position.z<-29){this.talk('siege',()=>{this.bossStarted=true;return true;});return;}
    this.age+=dt;this.invulnerable=Math.max(0,this.invulnerable-dt);this.repairCooldown=Math.max(0,this.repairCooldown-dt);this.fireClock-=dt;if(this.noticeClock>0&&(this.noticeClock-=dt)<=0)this.notice.textContent='';
    const move=this.input.move;this.dashing=this.dash.active;const burst=this.dash.update(dt);this.reveal.update(dt);const next=slideSurface(this.hero.position,this.dashing?burst.x:move.x*5.8*dt,this.dashing?burst.z:move.y*5.8*dt,p=>this.clear(p));this.hero.position.x=next.x;this.hero.position.z=next.z;if(Math.hypot(move.x,move.y)>.1)this.hero.rotation.y=Math.atan2(move.x,move.y);
    this.battle.update(dt,this.hero.position.clone().add(new Vector3(0,1,0)),this.convoy.poses.map(p=>({...p,y:1.2})),this.bossStarted&&this.hero.position.z<-25);
    const sector=freightSector(this.convoy);this.scanner.update(dt,sector,this.met&&!this.restored&&this.remaining(sector??'')>0);
    this.convoy.update(dt,this.hero.position,p=>!this.aboard||this.guards.some(g=>g.hp>0&&g.sector===sector&&Math.hypot(g.mesh.position.x-p.x,g.mesh.position.z-p.z)<7)||nearFreight(this.hero.position,p,2.8),this.host.save.snapshot.quests.includes('bullion_reach.siege_defeated'));
    this.syncActors(dt);
    for(const hauler of this.convoy.poses){const pushed=freightPushOut(this.hero.position,hauler,1.55,2.7,p=>this.clear(p));if(pushed){this.hero.position.x=pushed.x;this.hero.position.z=pushed.z;}}
    // Moving armor displaces a player at its edge, instead of sweeping through.
    if(freightBoxContains(this.hero.position,this.battle.pose,3.85,5.5)){const pushed=freightPushOut(this.hero.position,this.battle.pose,3.85,5.5,p=>this.clear(p));if(pushed){this.hero.position.x=pushed.x;this.hero.position.z=pushed.z;}this.hurt(10);}
    const targets=this.guards.filter(g=>g.hp>0&&g.mesh.visible).map(g=>g.mesh.position);if(this.bossStarted&&this.battle.hp>0)targets.push(this.rear());const target=targets.filter(p=>p.distanceTo(this.hero.position)<15&&this.visible(p)).sort((a,b)=>a.distanceToSquared(this.hero.position)-b.distanceToSquared(this.hero.position))[0];
    if(this.input.firing&&target){this.hero.rotation.y=Math.atan2(target.x-this.hero.position.x,target.z-this.hero.position.z);if(this.fireClock<=0){this.hero.updateMatrixWorld(true);this.shoot(this.hero.getObjectByName('Hand_R')!.getWorldPosition(new Vector3()),target,false);this.fireClock=.22+Math.max(-.05,this.fireClock);}}
    this.play(this.dashing?'Dodge':this.input.firing&&target?'AimFire':Math.hypot(move.x,move.y)>.1?'Run':'Idle');this.mixer.update(dt);this.lexMixer.update(dt);this.patrol(dt);this.updateShots(dt);this.updateHazards();
    this.charge=Math.max(0,Math.min(100,this.charge+(this.shielding?-14:18)*dt));if(this.charge===0)this.shielding=false;this.shield.visible=this.shielding||this.dashing;this.shield.position.copy(this.hero.position).y+=1;
    this.revealRing.visible=this.reveal.remaining>0;this.revealRing.position.copy(this.hero.position).y=.04;this.revealRing.scale.setScalar(15*(1-this.reveal.remaining/5));this.rearRing.visible=this.battle.open&&this.reveal.reaches(this.hero.position,this.rear());this.rearRing.position.copy(this.rear());this.rearRing.rotation.y=this.battle.pose.heading;this.scannerRing.visible=!this.bossStarted&&this.reveal.reaches(this.hero.position,this.scanner.source);this.scannerRing.position.set(this.scanner.source.x,this.scanner.source.y,this.scanner.source.z);this.scannerRing.lookAt(this.camera.position);
    if(this.convoy.failed)this.fail(true);if(this.dead){this.paint();return;}
    if(this.bossStarted&&this.battle.hp===0&&!this.host.save.snapshot.quests.includes('bullion_reach.siege_defeated')){const commit=()=>markMarketSiegeDown(this.host.save,this.convoy,true).ok;if(!commit()){this.retryCommit(commit,'The siege engine is down. Save its clearance before the convoy continues.');return;}this.say('EXIT OPEN · Escort the actual cargo through the receiving gate.');}
    if(this.convoy.waitingForCommit){const cleared=this.guards.filter(g=>g.hp===0).map(g=>g.sector).filter((s,i,a)=>a.indexOf(s)===i&&this.remaining(s)===0);if(this.battle.hp===0)cleared.push('siege');const commit=()=>{const r=commitFreightBoundary(this.host.save,this.convoy,cleared);if(r.ok&&this.convoy.stage==='delivered')this.finishDelivery();return r.ok;};if(!commit()){this.retryCommit(commit,'The haulers reached the safe boundary. Save this checkpoint before continuing.');return;}this.refresh();}
    this.updateCamera();if((this.hudClock+=dt)>.1){this.hudClock=0;this.paint();}
  }
  private updateCamera(snap=false):void{const width=this.host.root.clientWidth,height=this.host.root.clientHeight,aspect=width/Math.max(1,height);this.camera.aspect=aspect;this.camera.clearViewOffset();if(this.comms.active&&(this.talkKind==='lex'||this.talkKind==='delivered'))frameConversation(this.camera,this.hero.position,this.lex.position,width,height);else if(this.comms.active&&this.talkKind==='siege')frameWarden(this.camera,new Box3().setFromObject(this.boss),width,height);else{const scale=aspect<1?1.12:1,goal=this.hero.position.clone().add(new Vector3(0,18*scale,18*scale));if(snap)this.camera.position.copy(goal);else this.camera.position.lerp(goal,.16);this.camera.lookAt(this.hero.position.x,0,this.hero.position.z-2);}this.camera.updateProjectionMatrix();this.camera.updateMatrixWorld(true);this.sun.position.copy(this.hero.position).add(new Vector3(-18,32,12));this.sun.target.position.copy(this.hero.position);this.sun.target.updateMatrixWorld(true);}
  private place(label:HTMLElement,at:Vector3,clamp=false):void{const p=at.clone().project(this.camera);label.hidden=this.comms.active||this.paused||!!this.panel||p.z>1||!clamp&&(Math.abs(p.x)>1||Math.abs(p.y)>1);label.style.left=((clamp?Math.max(-.85,Math.min(.85,p.x)):p.x)*.5+.5)*100+'%';label.style.top=(-(clamp?Math.max(-.5,Math.min(.5,p.y)):p.y)*.5+.5)*100+'%';}
  private paint():void{
    const d=this.host.save.snapshot;samplePlaytest('bullion-convoy','convoy sample',{stage:this.convoy.stage,life:this.life,haulers:this.convoy.poses.map(h=>h.hull),first:this.convoy.checkpoint.first,second:this.convoy.checkpoint.second,siege:this.battle.hp,position:this.hero.position.toArray(),calls:this.host.renderer.info.render.calls,triangles:this.host.renderer.info.render.triangles});this.ui.dataset.conversation=String(this.comms.active);this.pauseButton.textContent=this.paused?'RESUME':'PAUSE';this.shieldButton.textContent=this.shielding?'SHIELD ON':'SHIELD';this.repairButton.textContent=this.repairCooldown>0?`REPAIR ${Math.ceil(this.repairCooldown)}s`:'REPAIR';this.repairButton.disabled=this.life>=100||this.repairCooldown>0;this.dashButton.textContent=this.dash.cooldown>0?`DASH ${Math.ceil(this.dash.cooldown)}s`:'DASH';this.dashButton.disabled=this.dash.cooldown>0;this.revealButton.textContent=this.reveal.cooldown>0?`REVEAL ${Math.ceil(this.reveal.cooldown)}s`:'REVEAL';this.revealButton.disabled=this.reveal.cooldown>0;
    const hull=this.convoy.poses.map(h=>Math.ceil(h.hull));this.status.textContent=`BULLION REACH · RELIEF CONVOY\nVITALS ${Math.ceil(this.life)} · SHIELD ${Math.ceil(this.charge)}${this.paused?' · PAUSED':''}\nHAULERS ${hull[0]} / ${hull[1]}${this.bossStarted&&this.battle.hp>0?`\nSIEGE ${this.battle.hp} · ${this.battle.open?'REAR CONTROL OPEN':'ARMORED'}`:''}`;
    this.hint.textContent=this.restored?'Relief delivered. LEX joins your crew. Return south to the fighter.':!this.met?'Clear the apron patrol. Meet LEX beside the green haulers.':this.convoy.waitingForChoice?'Lead hauler holding. Walk to the junction and INTERACT to choose a lane.':this.bossStarted&&this.battle.hp>0?'Flank the moving artillery. Blast its elevated rear control while it vents.':this.battle.hp===0?'Escort both haulers through the north receiving gate.':'Escort the cargo. Clear red barricades and repair nearby haulers with INTERACT.';
    const nearby=this.convoy.poses.findIndex(h=>nearFreight(this.hero.position,h));this.interactButton.textContent=nearFreight(this.hero.position,this.returnPoint())?'WARSHIP':!this.met&&nearFreight(this.hero.position,L.lex)?'LEX':this.convoy.waitingForChoice?'CHOOSE LANE':nearby>=0?this.convoy.repairCooldown>0?`CARGO ${Math.ceil(this.convoy.repairCooldown)}s`:'REPAIR CARGO':'INTERACT';
    for(const [i,h] of this.convoy.poses.entries()){this.labels[i].textContent=`RELIEF ${i+1} · ${Math.ceil(h.hull)}`;this.labels[i].dataset.damaged=String(h.hull<70);this.place(this.labels[i],new Vector3(h.x,3,h.z));}
    const goal=this.restored?this.returnPoint():!this.met?L.lex:this.convoy.poses[0];this.beacon.textContent=this.restored?'◇ FIGHTER':!this.met?'◇ LEX':'◇ CONVOY';this.place(this.beacon,new Vector3(goal.x,1,goal.z),true);
    if(this.host.save.testSlot)Object.assign(this.ui.dataset,{position:JSON.stringify(this.hero.position.toArray()),life:String(this.life),shield:String(this.charge),paused:String(this.paused),dialogue:String(this.comms.active),met:String(this.met),aboard:String(this.aboard),convoy:JSON.stringify(this.convoy.poses),stage:this.convoy.stage,first:this.convoy.checkpoint.first??'',second:this.convoy.checkpoint.second??'',waitingChoice:String(this.convoy.waitingForChoice),waitingCommit:String(this.convoy.waitingForCommit),bossHP:String(this.battle.hp),bossAge:String(this.battle.age),bossOpen:String(this.battle.open),bossPose:JSON.stringify(this.battle.pose),rear:JSON.stringify(this.rear().toArray()),guards:JSON.stringify(this.guards.filter(g=>g.hp>0&&g.mesh.visible).map(g=>({sector:g.sector,hp:g.hp,position:g.mesh.position.toArray()}))),hazards:JSON.stringify(this.currentHazards().map(({damaged,...h})=>h)),shots:String(this.shotsFired),hits:String(this.hits),injuries:String(this.injuries),firing:String(this.input.firing),repairCooldown:String(this.repairCooldown),cargoRepairCooldown:String(this.convoy.repairCooldown),revealCooldown:String(this.reveal.cooldown),revealRemaining:String(this.reveal.remaining),dashCooldown:String(this.dash.cooldown),dashing:String(this.dashing),restored:String(this.restored),pending:String(this.pending),dead:String(this.dead),arrival:String(this.arrival)});
  }
  render():void{this.camera.aspect=this.host.root.clientWidth/Math.max(1,this.host.root.clientHeight);this.camera.updateProjectionMatrix();this.host.renderer.render(this.scene,this.camera);if(this.host.save.testSlot)Object.assign(this.ui.dataset,{triangles:String(this.host.renderer.info.render.triangles),calls:String(this.host.renderer.info.render.calls),geometries:String(this.host.renderer.info.memory.geometries),textures:String(this.host.renderer.info.memory.textures)});}
  dispose():void{this.active=false;this.input.dispose();this.comms.dispose();this.lifeTime.abort();this.mixer.stopAllAction();this.mixer.uncacheRoot(this.hero);this.lexMixer.stopAllAction();this.lexMixer.uncacheRoot(this.lex);disposeObject(this.scene);this.ui.remove();}
}
