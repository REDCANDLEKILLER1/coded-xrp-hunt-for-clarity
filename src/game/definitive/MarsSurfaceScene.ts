import {AmbientLight,AnimationMixer,Color,CylinderGeometry,DirectionalLight,Fog,Group,Mesh,MeshBasicMaterial,MeshStandardMaterial,PerspectiveCamera,PointLight,Scene,SphereGeometry,Texture,Vector3,WebGLRenderer} from 'three';
import type {GLTF} from 'three/addons/loaders/GLTFLoader.js';
import type {CampaignSave} from './CampaignSave';
import type {ManagedScene} from './SceneController';
import {CommsPanel} from './CommsPanel';
import {disposeObject} from './ModelAssets';
import {MarsReliefQuest,MARS_RELIEF_COMMS,RELIEF_CORN,RELIEF_LANDING,RELIEF_PUMPS,type ReliefPump} from './MarsRelief';
import {SurfaceInput} from './SurfaceInput';
import {SURFACE_COMBAT,canSurfaceTell,fieldRepair,surfaceLineClear,surfaceMove,surfaceSegmentHit} from './SurfaceCombat';
import {PARKED_HEIGHT} from './LandingPlan';
import {fighterFootprint,type GroundPoint} from './FighterFootprint';
import {sfx} from '../audio/Sfx';
import './surface.css';

interface Host{renderer:WebGLRenderer;environment:Texture;root:HTMLElement;save:CampaignSave;models:GLTF[];arrival:boolean;onOrbit:()=>void;onRetry:()=>void}
interface Guard{mesh:Group;tell:Mesh;pump:ReliefPump;hp:number;base:Vector3;clock:number;charge:number;target:Vector3;age:number}
interface Bolt{mesh:Mesh;velocity:Vector3;hostile:boolean;life:number}

/** Physical relief-site opening: finite defenders, non-destructive valve capture,
 * a real crew meeting and one persistent hero upgrade. Mars's boss is later. */
export class MarsSurfaceScene implements ManagedScene{
  private readonly scene=new Scene();
  private readonly camera=new PerspectiveCamera(46,1,.1,300);
  private readonly sun=new DirectionalLight(0xffe3c0,2.8);
  private readonly ui=document.createElement('section');
  private readonly status=document.createElement('p');
  private readonly hint=document.createElement('p');
  private readonly message=document.createElement('p');
  private readonly pauseButton=document.createElement('button');
  private readonly repairButton=document.createElement('button');
  private readonly shieldButton=document.createElement('button');
  private readonly fire=document.createElement('button');
  private readonly interactButton=document.createElement('button');
  private readonly map=document.createElement('canvas');
  private readonly lifetime=new AbortController();
  private readonly quest:MarsReliefQuest;
  private readonly input:SurfaceInput;
  private readonly comms:CommsPanel;
  private readonly hero:Group;
  private readonly corn:Group;
  private readonly fighter:Group;
  private readonly fighterOutline:readonly GroundPoint[];
  private readonly mixer:AnimationMixer;
  private readonly cornMixer:AnimationMixer;
  private readonly guards:Guard[]=[];
  private readonly bolts:Bolt[]=[];
  private readonly green=new MeshBasicMaterial({color:0x00ff00,toneMapped:false});
  private readonly red=new MeshBasicMaterial({color:0xff2200,toneMapped:false});
  private readonly boltGeometry=new SphereGeometry(.085,8,6);
  private readonly marker:Mesh;
  private readonly shield=new Mesh(new SphereGeometry(1,16,10),new MeshBasicMaterial({color:0x00ff00,wireframe:true,transparent:true,opacity:.18,toneMapped:false}));
  private active=false;
  private paused=false;
  private dead=false;
  private life=100;
  private shieldCharge=100;
  private shielding=false;
  private repairCooldown=0;
  private invulnerable=0;
  private fireClock=0;
  private elapsed=0;
  private arrival=0;
  private notice=0;
  private clip='';
  private hudClock=0;
  private factionRevision=-1;
  private shots=0;
  private hits=0;
  private injuries=0;

  constructor(private readonly host:Host){
    this.quest=new MarsReliefQuest(host.save);this.paused=host.save.testSlot;this.arrival=host.arrival?4:0;
    const [hero,corn,fighter,terrain,drone]=host.models;
    for(const pump of RELIEF_PUMPS)for(const prefix of ['Pump_','Valve_','Conduit_']){
      const name=prefix+pump.id+(prefix==='Pump_'?'_Lights':'');if(!terrain.scene.getObjectByName(name))throw new Error('Missing Mars architecture node: '+name);
    }
    if(!terrain.scene.getObjectByName('Relief_Growth'))throw new Error('Missing Mars restoration growth');
    this.hero=hero.scene;this.corn=corn.scene;this.fighter=fighter.scene;
    this.mixer=new AnimationMixer(this.hero);this.cornMixer=new AnimationMixer(this.corn);
    const idle=corn.animations.find(a=>a.name==='Idle');if(idle)this.cornMixer.clipAction(idle).play();
    this.corn.position.set(RELIEF_CORN.x,0,RELIEF_CORN.z);this.corn.rotation.y=.1;
    const checkpoint=host.save.snapshot.location.checkpoint;
    const pump=RELIEF_PUMPS.find(p=>checkpoint==='mars.pump.'+p.id);
    this.hero.position.set(pump?.x??(checkpoint==='mars.corn'?0:5),0,pump?pump.z+5.5:checkpoint==='mars.corn'?15:26);
    this.fighter.position.set(RELIEF_LANDING.x,PARKED_HEIGHT+(host.arrival?8:0),RELIEF_LANDING.z);this.hero.visible=!host.arrival;
    const canopy=this.fighter.getObjectByName('Canopy_Hinge');if(canopy)canopy.rotation.x=-1.15;
    this.fighterOutline=fighterFootprint(this.fighter);
    this.scene.background=new Color(0x342820);this.scene.fog=new Fog(0x342820,65,170);this.scene.environment=host.environment;this.scene.environmentIntensity=.4;
    this.scene.add(terrain.scene,this.hero,this.corn,this.fighter,new AmbientLight(0xb8a692,.5));
    this.sun.castShadow=true;this.sun.shadow.mapSize.set(1024,1024);Object.assign(this.sun.shadow.camera,{left:-15,right:15,top:15,bottom:-15,near:1,far:80});this.sun.shadow.camera.updateProjectionMatrix();this.sun.shadow.bias=-.0003;this.sun.shadow.normalBias=.035;this.scene.add(this.sun,this.sun.target);
    const glow=new PointLight(0x00ff00,4,6,2);glow.position.set(0,1,.3);this.hero.add(glow);
    this.marker=new Mesh(new CylinderGeometry(0,.14,.30,4),this.green);this.scene.add(this.marker);
    this.shield.scale.set(.8,1.05,.8);this.shield.visible=false;this.scene.add(this.shield);
    const library=new Group();library.visible=false;library.add(drone.scene,new Mesh(this.boltGeometry,this.red));this.scene.add(library);
    for(const pump of RELIEF_PUMPS){
      if(this.quest.pumpClear(pump.id))continue;
      for(let i=0;i<pump.guards;i++){
        const pose=drone.scene.clone(true);pose.scale.setScalar(.11);
        const base=new Vector3(pump.x+(i===0?-4.8:i===1?4.8:0),1.15,pump.z+(i===2?-5:4));pose.position.copy(base);this.scene.add(pose);
        const tell=new Mesh(new CylinderGeometry(.8,.8,.015,20),new MeshBasicMaterial({color:0xff2200,transparent:true,opacity:.36,toneMapped:false,depthWrite:false}));tell.visible=false;this.scene.add(tell);
        this.guards.push({mesh:pose,tell,pump:pump.id,hp:SURFACE_COMBAT.guardHP,base,clock:1.2+i*.7,charge:0,target:new Vector3(),age:i*2});
      }
    }
    this.scene.traverse(o=>{if(o instanceof Mesh){o.receiveShadow=true;o.castShadow=!o.name.startsWith('Relief_');for(const m of Array.isArray(o.material)?o.material:[o.material])if(m.name.startsWith('Liquidity')||m.name.startsWith('Relief friendly'))m.toneMapped=false;}});
    this.comms=new CommsPanel(this.ui);this.buildUI();
    this.input=new SurfaceInput(host.renderer.domElement,this.fire,()=>this.canAct(),{interact:()=>this.interact(),pause:()=>this.togglePause(),repair:()=>this.repair(),shield:()=>this.toggleShield()});
    window.addEventListener('blur',this.pause,{signal:this.lifetime.signal});document.addEventListener('visibilitychange',()=>{if(document.hidden)this.pause();},{signal:this.lifetime.signal});
    this.play('Idle');this.updateCamera(true);this.refreshSite();this.paint();
  }
  private buildUI():void{
    this.ui.className='surface-ui';this.status.className='surface-status';this.hint.className='surface-hint';this.message.className='surface-message';
    const top=document.createElement('div');top.className='surface-top';
    const action=(label:string,run:()=>void,parent:HTMLElement,existing?:HTMLButtonElement)=>{const b=existing??document.createElement('button');b.type='button';b.textContent=label;b.addEventListener('click',e=>{e.stopPropagation();if(this.active)run();},{signal:this.lifetime.signal});parent.appendChild(b);return b;};
    action('PAUSE',()=>this.togglePause(),top,this.pauseButton);
    action('COMMS',()=>{if(!this.canAct())return;if(this.quest.introduced)this.conversation(this.quest.restored?'log':'intro',()=>true);else this.say('Meet Corn beside the relief canopy.');},top);
    action('ORBIT',()=>{if(!this.canAct())return;if(this.hero.position.distanceTo(new Vector3(5,0,26))>5){this.say('Return to your parked fighter to ascend.');return;}if(this.guards.some(g=>g.hp>0&&g.mesh.position.distanceTo(this.hero.position)<14)){this.say('Clear nearby defenders before boarding the fighter.');return;}this.input.clear();this.host.onOrbit();},top);
    const bottom=document.createElement('div');bottom.className='surface-actions';
    action('SHIELD',()=>this.toggleShield(),bottom,this.shieldButton);action('REPAIR',()=>this.repair(),bottom,this.repairButton);action('INTERACT',()=>this.interact(),bottom,this.interactButton);action('BLAST',()=>{},bottom,this.fire);this.fire.className='surface-fire';
    this.map.className='surface-map';this.map.width=140;this.map.height=150;this.map.setAttribute('aria-label','Relief site map: green allies, red seized pumps');
    this.ui.append(this.status,this.hint,top,this.message,this.map,bottom);this.ui.hidden=true;this.host.root.appendChild(this.ui);
  }
  private canAct():boolean{return this.active&&!this.paused&&!this.dead&&!this.comms.active&&this.arrival<=0;}
  setActive(value:boolean):void{this.active=value;this.ui.hidden=!value;this.input.setActive(value);this.comms.setActive(value);window.dispatchEvent(new CustomEvent('coded:music-cue',{detail:{cue:value?'transit':'silence'}}));}
  saveBeforeLeave():boolean{return true;}
  private readonly pause=():void=>{if(this.active){this.paused=true;this.input.clear();this.paint();}};
  private togglePause():void{if(!this.active||this.dead||this.comms.active)return;this.paused=!this.paused;this.input.clear();this.paint();}
  private say(message:string):void{this.message.textContent=message;this.notice=7;}
  private conversation(kind:keyof typeof MARS_RELIEF_COMMS,commit:()=>boolean):void{
    this.input.clear();this.play('Idle');this.comms.open(MARS_RELIEF_COMMS[kind],()=>{const ok=commit();this.input.clear();if(ok){this.refreshSite();this.paint();}return ok;});
  }
  private interact():void{
    if(!this.canAct())return;
    if(Math.hypot(this.hero.position.x-RELIEF_CORN.x,this.hero.position.z-RELIEF_CORN.z)<3.2){
      if(!this.quest.introduced)this.conversation('intro',()=>this.quest.meetCorn().ok);
      else if(!this.quest.restored&&RELIEF_PUMPS.every(p=>this.quest.pumpClear(p.id)))this.conversation('restored',()=>this.quest.completeRelief().ok);
      else if(this.quest.restored)this.conversation('log',()=>true);
      else this.say('CORN · Clear the seizure drones, then release all three pump valves.');
      return;
    }
    if(!this.quest.introduced){this.say('Meet Corn at the relief canopy first.');return;}
    const pump=RELIEF_PUMPS.find(p=>Math.hypot(this.hero.position.x-p.x,this.hero.position.z-(p.z+3.25))<2.5);
    if(!pump){this.say('Move beside Corn or a pump control to interact.');return;}
    if(this.quest.pumpClear(pump.id)){this.say(pump.label+' · Already restored.');return;}
    const remaining=this.guards.filter(g=>g.pump===pump.id&&g.hp>0).length;
    if(remaining){this.say(`${pump.label} · ${remaining} seizure drones still hold the valve.`);return;}
    const result=this.quest.releasePump(pump.id,remaining);
    if(!result.ok){this.say('Valve could not save. Stay here and interact to retry.');return;}
    this.refreshSite();sfx.play('pulse',.6);this.say(`${pump.label} ONLINE · 40 salvage. ${RELIEF_PUMPS.every(p=>this.quest.pumpClear(p.id))?'Return to Corn.':'Continue to the next valve.'}`);
  }
  private toggleShield():void{if(this.canAct()&&this.host.save.snapshot.heroUpgrades.ledger_shield){this.shielding=!this.shielding;this.paint();}}
  private repair():void{
    if(!this.canAct())return;const result=fieldRepair(this.life,this.repairCooldown,!!this.host.save.snapshot.heroUpgrades.field_repair);
    if(result.used){this.life=result.life;this.repairCooldown=result.cooldown;sfx.play('pulse',.6);this.say('FIELD REPAIR · Vitals restored.');this.paint();}
  }
  private refreshSite():void{
    if(this.factionRevision===this.host.save.snapshot.revision)return;this.factionRevision=this.host.save.snapshot.revision;
    const terrain=this.host.models[3].scene,retired=new Set<MeshStandardMaterial|MeshBasicMaterial>();
    for(const p of RELIEF_PUMPS)for(const prefix of ['Pump_','Valve_','Conduit_']){
      const node=terrain.getObjectByName(prefix+p.id+(prefix==='Pump_'?'_Lights':''))!;
      node.traverse(o=>{if(o instanceof Mesh){const mats=Array.isArray(o.material)?o.material:[o.material];for(const m of mats)if(m!==this.green&&m!==this.red)retired.add(m);o.material=this.quest.pumpClear(p.id)?this.green:this.red;}});
    }
    for(const material of retired)material.dispose();
    terrain.getObjectByName('Relief_Growth')!.visible=RELIEF_PUMPS.every(p=>this.quest.pumpClear(p.id));
    this.repairButton.hidden=!this.host.save.snapshot.heroUpgrades.field_repair;this.shieldButton.hidden=!this.host.save.snapshot.heroUpgrades.ledger_shield;
  }
  private play(name:string):void{
    if(this.clip===name)return;const clip=this.host.models[0].animations.find(a=>a.name===name);if(!clip)return;
    const previous=this.host.models[0].animations.find(a=>a.name===this.clip),next=this.mixer.clipAction(clip).reset().play();if(previous)this.mixer.clipAction(previous).crossFadeTo(next,.14,false);this.clip=name;
  }
  private visible(position:Vector3):boolean{const p=position.clone().project(this.camera);return p.z>-1&&p.z<1&&Math.abs(p.x)<.92&&Math.abs(p.y)<.85;}
  private shoot(position:Vector3,direction:Vector3,hostile:boolean):void{
    if(this.bolts.length>=64)return;const mesh=new Mesh(this.boltGeometry,hostile?this.red:this.green);mesh.position.copy(position);mesh.scale.set(1,1,hostile?1:2.5);this.scene.add(mesh);
    this.bolts.push({mesh,velocity:direction.clone().normalize().multiplyScalar(hostile?SURFACE_COMBAT.hostileBoltSpeed:SURFACE_COMBAT.heroBoltSpeed),hostile,life:hostile?2.2:1.1});sfx.play(hostile?'enemyShoot':'shoot',.35);if(!hostile)this.shots++;
  }
  private damage():void{
    if(this.invulnerable>0||this.dead)return;this.invulnerable=.38;this.injuries++;
    if(this.shielding&&this.shieldCharge>0){this.shieldCharge=Math.max(0,this.shieldCharge-16);sfx.play('pulse',.35);return;}
    this.life=Math.max(0,this.life-SURFACE_COMBAT.hostileDamage);sfx.play('hurt',.4);
    if(this.life<=0){this.dead=true;this.input.clear();this.play('KnockdownRecover');const panel=document.createElement('section');panel.className='boarding-shop';const text=document.createElement('p');text.textContent='Relief signal lost. Released valves stay restored. Return to the last safe checkpoint.';const retry=document.createElement('button');retry.textContent='RETRY RELIEF SITE';retry.addEventListener('click',()=>{if(this.active)this.host.onRetry();},{signal:this.lifetime.signal});panel.append(text,retry);this.ui.appendChild(panel);}
  }
  private updateGuards(dt:number):void{
    let tells=this.guards.filter(g=>g.hp>0&&g.charge>0).length;
    for(const g of this.guards){
      if(g.hp<=0)continue;g.age+=dt;g.mesh.position.y=1.15+Math.sin(g.age*2)*.12;
      const distance=g.mesh.position.distanceTo(this.hero.position);g.mesh.rotation.y=Math.atan2(this.hero.position.x-g.mesh.position.x,this.hero.position.z-g.mesh.position.z);
      if(!this.quest.introduced)continue;
      if(g.charge>0){
        g.charge-=dt;g.tell.visible=true;g.tell.position.copy(g.target);g.tell.position.y=.04;g.tell.scale.setScalar(1+.25*Math.sin(this.elapsed*20));
        if(g.charge<=0){g.tell.visible=false;tells--;if(this.visible(g.mesh.position)&&distance<16&&surfaceLineClear(g.mesh.position,g.target))this.shoot(g.mesh.position,g.target.clone().sub(g.mesh.position),true);g.clock=2.7;}
      }else{
        g.clock-=dt;
        if(g.clock<=0&&canSurfaceTell(distance,this.visible(g.mesh.position),tells)&&surfaceLineClear(g.mesh.position,this.hero.position)){
          g.charge=.85;g.target.copy(this.hero.position);g.target.y=1;tells++;
        }
      }
    }
  }
  private updateBolts(dt:number):void{
    for(let i=this.bolts.length-1;i>=0;i--){
      const b=this.bolts[i],previous=b.mesh.position.clone();b.life-=dt;b.mesh.position.addScaledVector(b.velocity,dt);
      if(!surfaceLineClear(previous,b.mesh.position))b.life=0;
      if(b.life>0&&b.hostile&&surfaceSegmentHit(previous,b.mesh.position,this.hero.position,.48)){this.damage();b.life=0;}
      if(b.life>0&&!b.hostile){const hit=this.guards.find(g=>g.hp>0&&surfaceSegmentHit(previous,b.mesh.position,g.mesh.position,.7));if(hit){hit.hp-=SURFACE_COMBAT.heroDamage;this.hits++;b.life=0;sfx.play('hit',.3);if(hit.hp<=0){hit.mesh.visible=false;hit.tell.visible=false;sfx.play('explode',.4);}}}
      if(b.life<=0){this.scene.remove(b.mesh);this.bolts.splice(i,1);}
    }
  }
  update(dt:number):void{
    if(!this.active)return;const wasTalking=this.comms.active;this.comms.update(dt);if(wasTalking&&!this.comms.active)this.input.clear();
    if(this.paused||this.dead||this.comms.active){this.paint();return;}
    if(this.arrival>0){this.arrival=Math.max(0,this.arrival-dt);this.fighter.position.y=PARKED_HEIGHT+8*(this.arrival/4)**2;this.hero.visible=this.arrival===0;this.updateCamera();this.paint();return;}
    this.hero.visible=true;this.elapsed+=dt;this.invulnerable=Math.max(0,this.invulnerable-dt);this.repairCooldown=Math.max(0,this.repairCooldown-dt);this.fireClock-=dt;
    if(this.notice>0){this.notice-=dt;if(this.notice<=0)this.message.textContent='';}
    const move=this.input.move,next=surfaceMove(this.hero.position,move.x*SURFACE_COMBAT.heroSpeed*dt,move.y*SURFACE_COMBAT.heroSpeed*dt,this.fighterOutline);this.hero.position.x=next.x;this.hero.position.z=next.z;
    if(Math.hypot(move.x,move.y)>.1)this.hero.rotation.y=Math.atan2(move.x,move.y);
    const target=this.quest.introduced?this.guards.filter(g=>g.hp>0&&g.mesh.position.distanceTo(this.hero.position)<SURFACE_COMBAT.range&&this.visible(g.mesh.position)&&surfaceLineClear(this.hero.position,g.mesh.position)).sort((a,b)=>a.mesh.position.distanceToSquared(this.hero.position)-b.mesh.position.distanceToSquared(this.hero.position))[0]:undefined;
    if(this.input.firing&&target){this.hero.rotation.y=Math.atan2(target.mesh.position.x-this.hero.position.x,target.mesh.position.z-this.hero.position.z);if(this.fireClock<=0){this.hero.updateMatrixWorld(true);const hand=this.hero.getObjectByName('Hand_R')?.getWorldPosition(new Vector3())??this.hero.position.clone().add(new Vector3(0,1,0));this.shoot(hand,target.mesh.position.clone().sub(hand),false);this.fireClock=SURFACE_COMBAT.heroInterval+Math.max(-.05,this.fireClock);}}
    this.play(this.input.firing&&target?'AimFire':Math.hypot(move.x,move.y)>.1?'Run':'Idle');this.mixer.update(dt);this.cornMixer.update(dt);
    this.updateGuards(dt);this.updateBolts(dt);
    this.shieldCharge=Math.min(100,Math.max(0,this.shieldCharge+(this.shielding?-14:18)*dt));if(this.shieldCharge===0)this.shielding=false;
    this.shield.visible=this.shielding;this.shield.position.copy(this.hero.position).y+=1;
    this.marker.position.copy(this.corn.position).y=2.2+Math.sin(this.elapsed*3)*.06;
    this.updateCamera();this.hudClock+=dt;if(this.hudClock>.1){this.hudClock=0;this.paint();}
  }
  private updateCamera(snap=false):void{
    const aspect=this.host.root.clientWidth/Math.max(1,this.host.root.clientHeight);const distance=aspect<1?1.12:1;
    const focus=this.arrival>0?new Vector3(RELIEF_LANDING.x,Math.max(0,this.fighter.position.y-1),RELIEF_LANDING.z):this.hero.position.clone();
    const framing=this.arrival>0?1.35:1;
    const goal=focus.clone().add(new Vector3(0,16*distance*framing,17*distance*framing));if(snap)this.camera.position.copy(goal);else this.camera.position.lerp(goal,.14);
    this.camera.lookAt(focus.x,focus.y,focus.z-1.5);this.camera.updateMatrixWorld(true);
    this.sun.position.copy(this.hero.position).add(new Vector3(-14,25,8));this.sun.target.position.copy(this.hero.position);this.sun.target.updateMatrixWorld(true);
  }
  private paint():void{
    this.refreshSite();const count=RELIEF_PUMPS.filter(p=>this.quest.pumpClear(p.id)).length;
    this.status.textContent=`MARS · RELIEF SITE\nVITALS ${Math.ceil(this.life)} · SHIELD ${Math.ceil(this.shieldCharge)}\nPUMPS ${count}/3${this.paused?' · PAUSED':''}`;
    this.hint.textContent=this.arrival>0?'FIGHTER DESCENT':!this.quest.introduced?'Meet Corn at the green marker.':count<3?'Clear red seizure drones. Interact at each valve.':!this.quest.restored?'Return to Corn for the field repair unit.':'RELIEF SIGNAL SECURED · Field repair acquired.';
    this.interactButton.textContent='INTERACT';
    const nearCorn=Math.hypot(this.hero.position.x-RELIEF_CORN.x,this.hero.position.z-RELIEF_CORN.z)<3.2;
    const nearby=RELIEF_PUMPS.map(p=>({pump:p,distance:Math.hypot(this.hero.position.x-p.x,this.hero.position.z-p.z-3.25)})).sort((a,b)=>a.distance-b.distance)[0];
    if(nearCorn)this.interactButton.textContent='TALK';
    else if(this.quest.introduced&&nearby.distance<6&&!this.quest.pumpClear(nearby.pump.id)){
      const defenders=this.guards.filter(g=>g.hp>0&&g.pump===nearby.pump.id).length;
      this.hint.textContent=defenders?`${nearby.pump.label} · ${defenders} defenders hold the valve.`:nearby.distance<2.5?`${nearby.pump.label} · Release the valve.`:`${nearby.pump.label} · Move closer to the control (${nearby.distance.toFixed(1)} m).`;
      if(!defenders&&nearby.distance<2.5)this.interactButton.textContent='RELEASE';
    }
    this.pauseButton.textContent=this.paused?'RESUME':'PAUSE';this.shieldButton.textContent=this.shielding?'SHIELD ON':'SHIELD';this.repairButton.textContent=this.repairCooldown>0?`REPAIR ${Math.ceil(this.repairCooldown)}s`:'REPAIR';this.repairButton.disabled=this.life>=100||this.repairCooldown>0;
    const ctx=this.map.getContext('2d');if(ctx){const plot=(x:number,z:number):[number,number]=>[(x+33)/66*140,(z+50)/90*150];ctx.clearRect(0,0,140,150);ctx.fillStyle='#061009ee';ctx.fillRect(0,0,140,150);for(const p of RELIEF_PUMPS){const [x,z]=plot(p.x,p.z);ctx.fillStyle=this.quest.pumpClear(p.id)?'#00ff00':'#ff2200';ctx.fillRect(x-4,z-4,8,8);}for(const [p,r]of[[RELIEF_CORN,3],[this.hero.position,4]]as const){const[x,z]=plot(p.x,p.z);ctx.fillStyle='#00ff00';ctx.beginPath();ctx.arc(x,z,r,0,Math.PI*2);ctx.fill();}ctx.strokeStyle='#87a187';ctx.strokeRect(...plot(0,26),5,5);}
    if(this.host.save.testSlot){Object.assign(this.ui.dataset,{position:JSON.stringify(this.hero.position.toArray()),life:String(this.life),shield:String(this.shieldCharge),paused:String(this.paused),dialogue:String(this.comms.active),arrival:String(this.arrival),pumps:String(count),introduced:String(this.quest.introduced),restored:String(this.quest.restored),shots:String(this.shots),hits:String(this.hits),injuries:String(this.injuries),firing:String(this.input.firing),guards:JSON.stringify(this.guards.filter(g=>g.hp>0).map(g=>({pump:g.pump,hp:g.hp,position:g.mesh.position.toArray(),telling:g.charge>0}))),repairCooldown:String(this.repairCooldown)});}
  }
  render():void{this.camera.aspect=this.host.root.clientWidth/Math.max(1,this.host.root.clientHeight);this.camera.updateProjectionMatrix();this.host.renderer.render(this.scene,this.camera);if(this.host.save.testSlot){const info=this.host.renderer.info;Object.assign(this.ui.dataset,{triangles:String(info.render.triangles),calls:String(info.render.calls),geometries:String(info.memory.geometries),textures:String(info.memory.textures)});}}
  dispose():void{this.active=false;this.input.dispose();this.comms.dispose();this.lifetime.abort();this.mixer.stopAllAction();this.mixer.uncacheRoot(this.hero);this.cornMixer.stopAllAction();this.cornMixer.uncacheRoot(this.corn);disposeObject(this.scene);this.ui.remove();}
}
