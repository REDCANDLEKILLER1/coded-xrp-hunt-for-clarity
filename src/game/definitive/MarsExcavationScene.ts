import {AmbientLight,AnimationMixer,Box3,BoxGeometry,Color,CylinderGeometry,DirectionalLight,Fog,Group,Mesh,MeshBasicMaterial,PerspectiveCamera,PointLight,Scene,SphereGeometry,Vector3,type Texture,type WebGLRenderer} from 'three';
import type {GLTF} from 'three/addons/loaders/GLTFLoader.js';
import type {CampaignSave} from './CampaignSave';
import type {ManagedScene} from './SceneController';
import {CommsPanel} from './CommsPanel';
import {disposeObject} from './ModelAssets';
import {EXCAVATION_COMMS,EXCAVATION_CONTROL,EXCAVATION_ENTRY,EXCAVATION_GUARDS,completeMarginWarden,excavationClear,secureExcavationRoute} from './MarsExcavation';
import {MarginWarden,WARDEN,miningHazardHits,type GroundPosition,type WardenTarget} from './MarginWarden';
import {SurfaceInput,bindSurfaceButton} from './SurfaceInput';
import {SurfaceDash} from './SurfaceDash';
import {fieldRepair,slideSurface,surfaceSegmentHit} from './SurfaceCombat';
import {segmentSphere} from './SpaceGeometry';
import {frameWarden} from './WardenFrame';
import {SurfaceOcclusion} from './SurfaceOcclusion';
import {sfx} from '../audio/Sfx';
import './surface.css';
interface Host{renderer:WebGLRenderer;environment:Texture;root:HTMLElement;save:CampaignSave;models:GLTF[];onRelief:(at:GroundPosition)=>void;onRetry:()=>void}
interface Patrol{mesh:Group;hp:number;clock:number;charge:number;target:Vector3;tell:Mesh}
interface Shot{mesh:Mesh;velocity:Vector3;hostile:boolean;life:number}
/** The mining service route and physical carrier share the on-foot input model. */
export class MarsExcavationScene implements ManagedScene{
  private readonly scene=new Scene();private readonly camera=new PerspectiveCamera(46,1,.1,300);
  private readonly sun=new DirectionalLight(0xffdeb8,2.7);private readonly ui=document.createElement('section');private readonly status=document.createElement('p');private readonly hint=document.createElement('p');private readonly notice=document.createElement('p');
  private readonly fire=document.createElement('button');private readonly pauseButton=document.createElement('button');private readonly repairButton=document.createElement('button');private readonly dashButton=document.createElement('button');private readonly interactButton=document.createElement('button');private readonly shieldButton=document.createElement('button');
  private readonly lifetime=new AbortController();private readonly input:SurfaceInput;private readonly comms:CommsPanel;private readonly hero:Group;private readonly boss:Group;private readonly mixer:AnimationMixer;
  private readonly battle=new MarginWarden();private readonly dash=new SurfaceDash();private readonly guards:Patrol[]=[];private readonly shots:Shot[]=[];private readonly hazardMeshes=new Map<number,Mesh>();
  private readonly bossBounds:Box3;private readonly gateOcclusion:SurfaceOcclusion;
  private readonly red=new MeshBasicMaterial({color:0xff2200,toneMapped:false});private readonly green=new MeshBasicMaterial({color:0x00ff00,toneMapped:false});private readonly dark=new MeshBasicMaterial({color:0x27110d});
  private readonly sphere=new SphereGeometry(.085,8,6);private readonly hazardBox=new BoxGeometry(1,1,1);private readonly hazardCircle=new CylinderGeometry(1,1,.02,32);
  private readonly shield=new Mesh(new SphereGeometry(1,16,10),new MeshBasicMaterial({color:0x00ff00,wireframe:true,transparent:true,opacity:.2,toneMapped:false}));
  private active=false;private paused=false;private dead=false;private life=100;private charge=100;private shielding=false;private repairCooldown=0;private invulnerable=0;private fireClock=0;private clip='';private age=0;private hudClock=0;private noticeClock=0;private intro=false;private victoryPending=false;private dashing=false;
  private route=false;private restored=false;private gateLit=false;private restoredLit=false;private roundtripTalking=false;private introShown=false;private shotsFired=0;private hits=0;private injuries=0;
  constructor(private readonly host:Host){
    const [hero,boss,terrain,drone]=host.models;this.hero=hero.scene;this.boss=boss.scene;this.mixer=new AnimationMixer(this.hero);this.paused=host.save.testSlot;
    for(const name of ['Core_Target','Core_Containment','Pylon_Left','Pylon_Right','Pylon_Left_Lights','Pylon_Right_Lights','Laser_Muzzle','Cutter_Axis'])if(!this.boss.getObjectByName(name))throw Error('Missing Warden node: '+name);
    for(const name of ['Route_Gate','Gate_Frame','Entry','RouteCheckpoint','BossAnchor','Excavation_Service'])if(!terrain.scene.getObjectByName(name))throw Error('Missing excavation node: '+name);
    this.route=host.save.snapshot.quests.includes('mars.route_secured');this.restored=host.save.snapshot.quests.includes('mars.margin_warden_defeated');if(this.restored)this.battle.hp=0;
    this.hero.position.set(0,0,this.route?6.5:EXCAVATION_ENTRY.z);this.boss.position.set(WARDEN.position.x,0,WARDEN.position.z);
    this.bossBounds=new Box3().setFromObject(this.boss);
    this.scene.background=new Color(0x30241e);this.scene.fog=new Fog(0x30241e,70,190);this.scene.environment=host.environment;this.scene.environmentIntensity=.45;
    this.scene.add(this.hero,this.boss,terrain.scene,new AmbientLight(0xb8a18b,.55));
    const light=new PointLight(0x00ff00,4,6,2);light.position.y=1;this.hero.add(light);
    this.sun.castShadow=true;this.sun.shadow.mapSize.set(1024,1024);Object.assign(this.sun.shadow.camera,{left:-18,right:18,top:18,bottom:-18,near:1,far:90});this.sun.shadow.camera.updateProjectionMatrix();this.sun.shadow.bias=-.0003;this.sun.shadow.normalBias=.035;this.scene.add(this.sun,this.sun.target);
    const library=new Group();library.visible=false;library.add(drone.scene,new Mesh(this.sphere,this.red),new Mesh(this.hazardBox,this.dark),new Mesh(this.hazardCircle,this.green));
    // Keep source materials owned until scene disposal, even after restoration
    // replaces their last visible mesh with a friendly control light.
    const sourceMaterials=new Set<import('three').Material>();for(const model of host.models)model.scene.traverse(o=>{if(o instanceof Mesh)for(const mat of Array.isArray(o.material)?o.material:[o.material])sourceMaterials.add(mat);});
    for(const mat of sourceMaterials)library.add(new Mesh(this.sphere,mat));this.scene.add(library);this.gateOcclusion=new SurfaceOcclusion(terrain.scene.getObjectByName('Gate_Frame')!);
    if(!this.route)for(const [i,pose] of EXCAVATION_GUARDS.entries()){
      const mesh=drone.scene.clone(true);mesh.scale.setScalar(.11);mesh.position.set(pose.x,1.1,pose.z);this.scene.add(mesh);
      const tell=new Mesh(this.hazardCircle,new MeshBasicMaterial({color:0xff2200,transparent:true,opacity:.35,toneMapped:false,depthWrite:false}));tell.visible=false;tell.scale.set(.8,1,.8);this.scene.add(tell);
      this.guards.push({mesh,hp:60,clock:1.4+i*.7,charge:0,target:new Vector3(),tell});
    }
    this.shield.scale.set(.8,1.05,.8);this.shield.visible=false;this.scene.add(this.shield);
    this.scene.traverse(o=>{if(o instanceof Mesh){o.receiveShadow=true;o.castShadow=true;for(const mat of Array.isArray(o.material)?o.material:[o.material])if(/Liquidity|liquidity|#00FF00|#FF2200/.test(mat.name))mat.toneMapped=false;}});
    this.ui.className='surface-ui excavation-ui';this.comms=new CommsPanel(this.ui);this.buildUI();
    this.input=new SurfaceInput(host.renderer.domElement,this.fire,()=>this.canAct(),{interact:()=>this.interact(),pause:()=>this.togglePause(),repair:()=>this.repair(),shield:()=>this.toggleShield(),dash:()=>this.startDash()});
    window.addEventListener('blur',this.pause,{signal:this.lifetime.signal});document.addEventListener('visibilitychange',()=>{if(document.hidden)this.pause();},{signal:this.lifetime.signal});
    this.play('Idle');this.mixer.update(0);this.refreshMachine();this.updateCamera(true);this.paint();
  }
  private buildUI():void{
    this.status.className='surface-status';this.hint.className='surface-hint';this.notice.className='surface-message';const top=document.createElement('div');top.className='surface-top';const bottom=document.createElement('div');bottom.className='surface-actions';
    const action=(button:HTMLButtonElement,label:string,run:()=>void,parent:HTMLElement)=>{button.type='button';button.textContent=label;bindSurfaceButton(button,()=>{if(this.active)run();},this.lifetime.signal);parent.appendChild(button);};
    action(this.pauseButton,'PAUSE',()=>this.togglePause(),top);const back=document.createElement('button');action(back,'RELIEF',()=>this.returnRelief(),top);
    action(this.shieldButton,'SHIELD',()=>this.toggleShield(),bottom);action(this.repairButton,'REPAIR',()=>this.repair(),bottom);action(this.dashButton,'DASH',()=>this.startDash(),bottom);action(this.interactButton,'INTERACT',()=>this.interact(),bottom);action(this.fire,'BLAST',()=>{},bottom);this.fire.className='surface-fire';
    this.ui.append(this.status,this.hint,top,this.notice,bottom);this.ui.hidden=true;this.host.root.appendChild(this.ui);
  }
  private canAct():boolean{return this.active&&!this.paused&&!this.dead&&!this.comms.active&&!this.victoryPending;}
  setActive(value:boolean):void{this.active=value;this.ui.hidden=!value;this.input.setActive(value);this.comms.setActive(value);window.dispatchEvent(new CustomEvent('coded:music-cue',{detail:{cue:value?'transit':'silence'}}));}
  saveBeforeLeave():boolean{return !this.victoryPending;}
  private readonly pause=():void=>{if(this.active){this.paused=true;this.input.clear();this.paint();}};
  private togglePause():void{if(!this.active||this.dead||this.comms.active||this.victoryPending)return;this.paused=!this.paused;this.input.clear();this.paint();}
  private say(text:string):void{this.notice.textContent=text;this.noticeClock=7;}
  private talk(kind:keyof typeof EXCAVATION_COMMS,commit:()=>boolean):void{
    this.input.clear();this.play('Idle');this.intro=kind==='warden';this.comms.open(EXCAVATION_COMMS[kind],()=>{const ok=commit();this.input.clear();if(ok){this.intro=false;this.refreshMachine();this.paint();}return ok;});
  }
  private returnRelief():void{
    if(!this.canAct())return;if(this.hero.position.distanceTo(new Vector3(0,0,30))>=3){this.say('Follow the service road south to the relief exit.');return;}this.input.clear();this.host.onRelief({x:this.hero.position.x,z:this.hero.position.z});
  }
  private interact():void{
    if(!this.canAct())return;
    if(this.hero.position.distanceTo(new Vector3(0,0,30))<3){this.returnRelief();return;}
    if(!this.route&&this.hero.position.distanceTo(new Vector3(EXCAVATION_CONTROL.x,0,EXCAVATION_CONTROL.z))<3){
      const remaining=this.guards.filter(g=>g.hp>0).length;if(remaining){this.say(`${remaining} seizure drones still hold the pressure gate.`);return;}
      const result=secureExcavationRoute(this.host.save,remaining,this.hero.position);if(!result.ok){this.say('The gate checkpoint could not save. Interact to retry.');return;}
      this.route=true;this.refreshMachine();this.say('PRESSURE GATE OPEN · Safe checkpoint secured.');return;
    }
    this.say(this.restored?'MARS RESTORED · Try Liquidity Dash, then return south to Corn.':'Advance to the pressure-gate control.');
  }
  private toggleShield():void{if(this.canAct()&&this.host.save.snapshot.heroUpgrades.ledger_shield)this.shielding=!this.shielding;}
  private repair():void{
    if(!this.canAct())return;const result=fieldRepair(this.life,this.repairCooldown,!!this.host.save.snapshot.heroUpgrades.field_repair);if(result.used){this.life=result.life;this.repairCooldown=result.cooldown;sfx.play('pulse',.6);this.say('FIELD REPAIR · Vitals restored.');}
  }
  private startDash():void{
    if(!this.canAct())return;const move=this.input.move,dir=Math.hypot(move.x,move.y)>.1?{x:move.x,z:move.y}:{x:Math.sin(this.hero.rotation.y),z:Math.cos(this.hero.rotation.y)};
    if(this.dash.request(!!this.host.save.snapshot.heroUpgrades.liquidity_dash,dir))sfx.play('pulse',.5);
  }
  private play(name:string):void{
    if(name===this.clip)return;const clip=this.host.models[0].animations.find(a=>a.name===name);if(!clip)return;const next=this.mixer.clipAction(clip).reset().play(),old=this.host.models[0].animations.find(a=>a.name===this.clip);if(old)this.mixer.clipAction(old).crossFadeTo(next,.14,false);this.clip=name;
  }
  private visible(position:Vector3):boolean{const p=position.clone().project(this.camera);return p.z>-1&&p.z<1&&Math.abs(p.x)<.94&&Math.abs(p.y)<.88;}
  private shoot(position:Vector3,target:Vector3,hostile:boolean):void{
    if(this.shots.length>=64)return;const mesh=new Mesh(this.sphere,hostile?this.red:this.green);mesh.position.copy(position);mesh.scale.set(1,1,hostile?1:2.5);this.scene.add(mesh);this.shots.push({mesh,velocity:target.clone().sub(position).normalize().multiplyScalar(hostile?9:28),hostile,life:hostile?2.2:1.2});if(!hostile)this.shotsFired++;sfx.play(hostile?'enemyShoot':'shoot',.3);
  }
  private hurt(amount:number):void{
    if(this.invulnerable>0||this.dead||this.dashing)return;this.invulnerable=.55;this.injuries++;
    if(this.shielding&&this.charge>0){this.charge=Math.max(0,this.charge-amount*1.8);sfx.play('pulse',.35);return;}
    this.life=Math.max(0,this.life-amount);sfx.play('hurt',.4);if(this.life===0){this.dead=true;this.input.clear();this.play('KnockdownRecover');const panel=document.createElement('section');panel.className='boarding-shop';const text=document.createElement('p');text.textContent='The extraction route is still there. Secured checkpoints and relief work remain saved.';const retry=document.createElement('button');retry.textContent='RETRY EXCAVATION';retry.addEventListener('click',()=>{if(this.active)this.host.onRetry();},{signal:this.lifetime.signal});panel.append(text,retry);this.ui.appendChild(panel);}
  }
  private updatePatrol(dt:number):void{
    let tells=this.guards.filter(g=>g.hp>0&&g.charge>0).length;
    for(const g of this.guards){if(g.hp<=0)continue;g.mesh.position.y=1.1+Math.sin(this.age*2+g.mesh.position.x)*.1;g.mesh.rotation.y=Math.atan2(this.hero.position.x-g.mesh.position.x,this.hero.position.z-g.mesh.position.z);
      if(g.charge>0){g.charge-=dt;g.tell.position.copy(g.target);g.tell.position.y=.025;if(g.charge<=0){g.tell.visible=false;tells--;if(this.visible(g.mesh.position)&&g.mesh.position.distanceTo(this.hero.position)<15)this.shoot(g.mesh.position,g.target,true);g.clock=2.8;}}
      else if((g.clock-=dt)<=0&&tells<2&&g.mesh.position.distanceTo(this.hero.position)<13&&this.visible(g.mesh.position)){g.charge=.9;g.target.copy(this.hero.position).y=1;g.tell.visible=true;tells++;}
    }
  }
  private targetPosition(id:WardenTarget):Vector3{return this.boss.getObjectByName(id==='core'?'Core_Target':id==='left'?'Pylon_Left':'Pylon_Right')!.getWorldPosition(new Vector3());}
  private updateShots(dt:number):void{
    for(let i=this.shots.length-1;i>=0;i--){const b=this.shots[i],before=b.mesh.position.clone();b.life-=dt;b.mesh.position.addScaledVector(b.velocity,dt);
      if(b.hostile&&surfaceSegmentHit(before,b.mesh.position,this.hero.position,.48)){this.hurt(8);b.life=0;}
      else if(!b.hostile){
        const g=this.guards.find(g=>g.hp>0&&surfaceSegmentHit(before,b.mesh.position,g.mesh.position,.7));
        if(g){g.hp=Math.max(0,g.hp-12);b.life=0;this.hits++;sfx.play('hit',.3);if(g.hp===0){g.mesh.visible=false;g.tell.visible=false;sfx.play('explode',.4);}}
        else for(const id of this.battle.targets())if(segmentSphere(before,b.mesh.position,this.targetPosition(id),id==='core'?1.35:1.1)){if(this.battle.damage(id,12)){this.hits++;sfx.play('hit',.3);}b.life=0;break;}
      }
      if(b.life<=0){this.scene.remove(b.mesh);this.shots.splice(i,1);}
    }
  }
  private refreshMachine():void{
    this.host.models[2].scene.getObjectByName('Route_Gate')!.position.y=this.route?6.8:2.2;
    for(const side of ['left','right'] as const){const node=this.boss.getObjectByName(side==='left'?'Pylon_Left_Lights':'Pylon_Right_Lights')!;node.traverse(o=>{if(o instanceof Mesh)o.material=this.restored?this.green:this.battle.pylons[side].hp>0?this.red:this.dark;});}
    this.boss.getObjectByName('Core_Containment')!.visible=!this.restored&&!this.battle.exposed;
    if(this.restored)this.host.models[2].scene.getObjectByName('Excavation_Service')!.traverse(o=>{if(o instanceof Mesh)o.material=this.green;});
    if(this.route&&!this.gateLit){this.gateLit=true;this.host.models[2].scene.getObjectByName('Route_Gate')!.traverse(o=>{if(o instanceof Mesh&&!Array.isArray(o.material)&&o.material.name.includes('hostile #FF2200'))o.material=this.green;});}
    if(this.restored&&!this.restoredLit){this.restoredLit=true;for(const root of [this.boss,this.host.models[2].scene])root.traverse(o=>{if(o instanceof Mesh){const recolor=(mat:import('three').Material)=>mat.name.includes('hostile #FF2200')?this.green:mat;o.material=Array.isArray(o.material)?o.material.map(recolor):recolor(o.material);}});}
  }
  private updateHazards():void{
    const ids=new Set(this.battle.hazards.map(h=>h.id));for(const [id,mesh] of this.hazardMeshes)if(!ids.has(id)){this.scene.remove(mesh);(mesh.material as MeshBasicMaterial).dispose();this.hazardMeshes.delete(id);}
    for(const h of this.battle.hazards){let mesh=this.hazardMeshes.get(h.id);if(!mesh){mesh=new Mesh(h.kind==='slam'?this.hazardCircle:this.hazardBox,new MeshBasicMaterial({color:0xff2200,transparent:true,opacity:.25,toneMapped:false,depthWrite:false}));this.scene.add(mesh);this.hazardMeshes.set(h.id,mesh);}
      const hot=h.age>=h.warning;mesh.position.set(h.kind==='laser-z'?0:h.x,hot?.45:.03,h.kind==='laser-x'?-6:h.z);mesh.scale.set(h.kind==='slam'?h.radius:h.kind==='laser-x'?h.radius*2:36,h.kind==='slam'?1:hot?.9:.03,h.kind==='slam'?h.radius:h.kind==='laser-x'?26:h.radius*2);(mesh.material as MeshBasicMaterial).opacity=hot?.8:.22+.12*Math.sin(h.age*15);
      if(miningHazardHits(h,this.hero.position))this.hurt(h.kind==='slam'?24:18);
    }
  }
  private finish():void{
    this.victoryPending=true;this.input.clear();this.shots.forEach(b=>this.scene.remove(b.mesh));this.shots.length=0;
    this.talk('restored',()=>{const result=completeMarginWarden(this.host.save,this.battle.defeated);if(!result.ok)return false;this.restored=true;this.victoryPending=false;this.say('MARS RESTORED · Liquidity Dash acquired. Fog Moon route discovered.');return true;});
  }
  update(dt:number):void{
    if(!this.active)return;this.comms.update(dt);const talking=this.comms.active;if(this.roundtripTalking&&!talking){this.input.clear();this.updateCamera(true);}this.roundtripTalking=talking;
    if(talking){this.mixer.update(dt);this.updateCamera();this.paint();return;}if(this.paused||this.dead||this.victoryPending){this.paint();return;}
    if(!this.introShown){this.introShown=true;if(!this.route){this.talk('approach',()=>true);return;}}
    if(this.route&&!this.restored&&!this.battle.started&&this.hero.position.z<7){this.talk('warden',()=>{this.battle.started=true;return true;});return;}
    this.age+=dt;this.invulnerable=Math.max(0,this.invulnerable-dt);this.repairCooldown=Math.max(0,this.repairCooldown-dt);this.fireClock-=dt;if(this.noticeClock>0&&(this.noticeClock-=dt)<=0)this.notice.textContent='';
    const move=this.input.move;this.dashing=this.dash.active;const burst=this.dash.update(dt);const next=slideSurface(this.hero.position,this.dashing?burst.x:move.x*5.8*dt,this.dashing?burst.z:move.y*5.8*dt,p=>excavationClear(p)&&(this.route||p.z>=8.9));this.hero.position.x=next.x;this.hero.position.z=next.z;if(Math.hypot(move.x,move.y)>.1)this.hero.rotation.y=Math.atan2(move.x,move.y);
    this.scene.updateMatrixWorld(true);
    const targets=[...this.guards.filter(g=>g.hp>0).map(g=>g.mesh.position),...this.battle.targets().map(id=>this.targetPosition(id))].filter(p=>p.distanceTo(this.hero.position)<13&&this.visible(p)).sort((a,b)=>a.distanceToSquared(this.hero.position)-b.distanceToSquared(this.hero.position));
    const target=targets[0];if(this.input.firing&&target){this.hero.rotation.y=Math.atan2(target.x-this.hero.position.x,target.z-this.hero.position.z);if(this.fireClock<=0){this.hero.updateMatrixWorld(true);this.shoot(this.hero.getObjectByName('Hand_R')!.getWorldPosition(new Vector3()),target,false);this.fireClock=.22+Math.max(-.05,this.fireClock);}}
    this.play(this.dashing?'Dodge':this.input.firing&&target?'AimFire':Math.hypot(move.x,move.y)>.1?'Run':'Idle');this.mixer.update(dt);this.updatePatrol(dt);this.battle.update(dt,this.hero.position);this.updateShots(dt);this.updateHazards();this.refreshMachine();
    this.charge=Math.max(0,Math.min(100,this.charge+(this.shielding?-14:18)*dt));if(this.charge===0)this.shielding=false;this.shield.visible=this.shielding||this.dashing;this.shield.position.copy(this.hero.position).y+=1;this.boss.getObjectByName('Cutter_Axis')!.rotation.x=this.restored?0:this.age*2;
    if(this.dead){this.paint();return;}if(this.battle.defeated&&!this.restored){this.finish();return;}this.updateCamera();if((this.hudClock+=dt)>.1){this.hudClock=0;this.paint();}
  }
  private updateCamera(snap=false):void{
    const aspect=this.host.root.clientWidth/Math.max(1,this.host.root.clientHeight);this.camera.aspect=aspect;this.camera.clearViewOffset();
    if(this.intro)frameWarden(this.camera,this.bossBounds,this.host.root.clientWidth,this.host.root.clientHeight);
    else{const scale=aspect<1?1.12:1,goal=this.hero.position.clone().add(new Vector3(0,16*scale,17*scale));if(snap)this.camera.position.copy(goal);else this.camera.position.lerp(goal,.16);this.camera.lookAt(this.hero.position.x,0,this.hero.position.z-2.0);}
    this.camera.updateProjectionMatrix();this.camera.updateMatrixWorld(true);this.gateOcclusion.update(this.camera,this.hero,!this.intro);const shadowFocus=this.intro?new Vector3(0,0,-35):this.hero.position;this.sun.position.copy(shadowFocus).add(new Vector3(-16,30,10));this.sun.target.position.copy(shadowFocus);this.sun.target.updateMatrixWorld(true);
  }
  private paint():void{
    const deadGuards=this.guards.filter(g=>g.hp>0).length;this.ui.dataset.conversation=String(this.comms.active);this.pauseButton.textContent=this.paused?'RESUME':'PAUSE';this.shieldButton.textContent=this.shielding?'SHIELD ON':'SHIELD';this.repairButton.textContent=this.repairCooldown>0?`REPAIR ${Math.ceil(this.repairCooldown)}s`:'REPAIR';this.repairButton.disabled=this.life>=100||this.repairCooldown>0;this.dashButton.hidden=!this.host.save.snapshot.heroUpgrades.liquidity_dash;this.dashButton.textContent=this.dash.cooldown>0?`DASH ${Math.ceil(this.dash.cooldown)}s`:'DASH';this.dashButton.disabled=this.dash.cooldown>0;
    this.status.textContent=`MARS · EXTRACTION ROUTE\nVITALS ${Math.ceil(this.life)} · SHIELD ${Math.ceil(this.charge)}${this.paused?' · PAUSED':''}\n${this.restored?'PUBLIC FLOW RESTORED':this.route?`WARDEN ${Math.ceil(this.battle.hp)}/${WARDEN.hp} · ${this.battle.exposed?'CORE EXPOSED '+this.battle.exposure.toFixed(1)+'s':'TOWERS '+this.battle.pylons.left.hp+' / '+this.battle.pylons.right.hp}`:`SEIZURE DRONES ${deadGuards}`}`;
    this.hint.textContent=this.restored?'Liquidity Dash unlocked. Follow the south road back to Corn.':!this.route?deadGuards?'Clear the seizure patrol. Reach the pressure-gate control.':'Interact at the pressure-gate pedestal.':this.battle.exposed?'RED CONTROL EXPOSED · Hold BLAST.':`Break both red towers before either restarts.${this.battle.pylons.left.restart>0||this.battle.pylons.right.restart>0?' '+Math.ceil(Math.max(this.battle.pylons.left.restart,this.battle.pylons.right.restart))+'s remaining.':''}`;
    this.interactButton.textContent=this.hero.position.distanceTo(new Vector3(0,0,30))<3?'RELIEF':!this.route&&this.hero.position.distanceTo(new Vector3(EXCAVATION_CONTROL.x,0,EXCAVATION_CONTROL.z))<3?'OPEN GATE':'INTERACT';
    if(this.host.save.testSlot)Object.assign(this.ui.dataset,{position:JSON.stringify(this.hero.position.toArray()),life:String(this.life),shield:String(this.charge),paused:String(this.paused),dialogue:String(this.comms.active),route:String(this.route),restored:String(this.restored),bossHP:String(this.battle.hp),exposure:String(this.battle.exposure),pylons:JSON.stringify(this.battle.pylons),guards:JSON.stringify(this.guards.filter(g=>g.hp>0).map(g=>({hp:g.hp,position:g.mesh.position.toArray()}))),hazards:JSON.stringify(this.battle.hazards),shots:String(this.shotsFired),hits:String(this.hits),injuries:String(this.injuries),firing:String(this.input.firing),repairCooldown:String(this.repairCooldown),dashCooldown:String(this.dash.cooldown),dashing:String(this.dashing),victoryPending:String(this.victoryPending)});
  }
  render():void{this.camera.aspect=this.host.root.clientWidth/Math.max(1,this.host.root.clientHeight);this.camera.updateProjectionMatrix();this.host.renderer.render(this.scene,this.camera);if(this.host.save.testSlot)Object.assign(this.ui.dataset,{triangles:String(this.host.renderer.info.render.triangles),calls:String(this.host.renderer.info.render.calls),geometries:String(this.host.renderer.info.memory.geometries),textures:String(this.host.renderer.info.memory.textures)});}
  dispose():void{this.active=false;this.input.dispose();this.comms.dispose();this.lifetime.abort();this.mixer.stopAllAction();this.mixer.uncacheRoot(this.hero);disposeObject(this.scene);this.ui.remove();}
}
