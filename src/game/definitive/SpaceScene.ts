import { AmbientLight, BackSide, BufferGeometry, CapsuleGeometry, Color, ConeGeometry, DirectionalLight, DoubleSide, Float32BufferAttribute, Group, InstancedMesh, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, PerspectiveCamera, Points, PointsMaterial, Quaternion, Scene, ShaderMaterial, SphereGeometry, Texture, TorusGeometry, Vector3, WebGLRenderer } from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import './space.css';
import type { CampaignSave } from './CampaignSave';
import type { SpaceCheckpoint } from './SpaceCheckpoint';
import type { ManagedScene } from './SceneController';
import { disposeObject } from './ModelAssets';
import { capitalVolley, flightHull, forwardPoint, FORWARD, HullSweep, interceptPoint, segmentSphere, turnFlight, UP } from './SpaceGeometry';
import { SpaceInput } from './SpaceInput';
import {CommsPanel,PORTAL_COMMS} from './CommsPanel';
import {sfx} from '../audio/Sfx';
import { arriveMars, checkpointTransit, clearSpaceWave, finishDeparture, PORTAL_POSITION, SPACE_ENEMIES, SPACE_WAVES, type SpaceEnemyKey } from './SpaceProgress';

interface Host {renderer:WebGLRenderer;environment:Texture;root:HTMLElement;save:CampaignSave;models:GLTF[];onHub:()=>void;onRetry:()=>void}
interface Enemy {key:SpaceEnemyKey;pose:Group;sweep:HullSweep;hp:number;slot:number;age:number;nextShot:number;tell:number;velocity:Vector3;retreat:number;approach:Quaternion}
interface Bolt {position:Vector3;previous:Vector3;velocity:Vector3;age:number;kind:'primary'|'hostile'|'missile';damage:number}
const PROFILE:Record<SpaceEnemyKey,{hp:number;speed:number;period:number;weight:number}>={
  regulator_drone:{hp:150,speed:300,period:10,weight:.5},fast_scout:{hp:110,speed:390,period:11,weight:.75},
  fog_raider:{hp:140,speed:340,period:12,weight:1},rug_fighter:{hp:260,speed:285,period:13,weight:1.5},whale_scout:{hp:380,speed:275,period:14,weight:2},
};
const PORTAL=new Vector3(...PORTAL_POSITION),MISSILE_SPEED=340,BOLT_SPEED=900;

/** Real meshes, one metre scale, one flight pose shared by cameras and hardpoints. */
export class SpaceScene implements ManagedScene {
  private readonly scene=new Scene();
  private readonly camera=new PerspectiveCamera(55,1,1,100000);
  private readonly ui=document.createElement('section');
  private readonly hud=document.createElement('p');
  private readonly message=document.createElement('p');
  private readonly reticle=document.createElement('span');
  private readonly nav=document.createElement('span');
  private readonly contacts=document.createElement('div');
  private readonly pauseButton=document.createElement('button');
  private readonly lifetime=new AbortController();
  private readonly input=new SpaceInput();
  private readonly comms:CommsPanel;
  private readonly ship:Group;
  private readonly hull:HullSweep;
  private readonly templates=new Map<SpaceEnemyKey,Group>();
  private readonly enemies:Enemy[]=[];
  private readonly bolts:Bolt[]=[];
  private readonly pools:Record<Bolt['kind'],InstancedMesh>;
  private readonly portal=new Group();
  private readonly earth:Group;
  private readonly mars:Group;
  private readonly stars:Points;
  private readonly flames:Mesh[]=[];
  private readonly flashes:{mesh:Mesh;time:number}[]=[];
  private readonly dummy=new Object3D();
  private readonly sun=new DirectionalLight(0xd9e6ff,3.5);
  private state:SpaceCheckpoint;
  private active=false;
  private paused=true;
  private dead=false;
  private cockpit=false;
  private nextFire=0;
  private saveClock=0;
  private hudClock=0;
  private noticeClock=0;
  private yaw=0;
  private pitch=0;
  private speed=0;
  private volleys=0;
  private fired=0;
  private hits=0;
  private incomingHits=0;
  private lastDamage=-100;
  private waveSpawned=false;
  private portalCrossing=false;
  private hitFlash=0;

  constructor(private readonly host:Host){
    const saved=host.save.snapshot.transit;if(!saved)throw new Error('Departure checkpoint is missing');this.state=structuredClone(saved);
    this.paused=host.save.testSlot;this.ship=flightHull(host.models[0].scene);this.ship.position.fromArray(saved.position);this.ship.quaternion.fromArray(saved.orientation);
    this.scene.add(this.ship);this.hull=new HullSweep(this.ship);
    this.scene.background=new Color(0x01030a);this.scene.environment=host.environment;this.scene.environmentIntensity=.4;
    this.scene.add(new AmbientLight(0x506789,.5));this.sun.position.set(-20000,15000,-8000);this.scene.add(this.sun);
    this.ship.traverse(o=>{if(o instanceof Mesh)for(const m of Array.isArray(o.material)?o.material:[o.material])if(m instanceof MeshStandardMaterial&&/Hostile|Engine/.test(m.name)){m.color.set('#003800');m.emissive.set('#00FF00');m.emissiveIntensity=1;m.toneMapped=false;}});
    for(const name of ['Camera_Chase','Camera_Cockpit_Forward','Engine_L','Engine_R'])if(!this.ship.getObjectByName(name))throw new Error(`Missing flight attachment ${name}`);
    const engineMat=new MeshBasicMaterial({color:0x00ff00,transparent:true,opacity:.6,toneMapped:false,depthWrite:false});
    for(const name of ['Engine_L','Engine_R']){
      const flame=new Mesh(new ConeGeometry(2.3,24,12),engineMat);flame.rotation.x=Math.PI/2;
      flame.position.copy(this.ship.worldToLocal(this.ship.getObjectByName(name)!.getWorldPosition(new Vector3()))).z+=12;
      flame.scale.y=.02;this.ship.add(flame);this.flames.push(flame);
    }
    const library=new Group();library.visible=false;this.scene.add(library);
    SPACE_ENEMIES.forEach((key,index)=>{const template=flightHull(host.models[index+1].scene);library.add(template);this.templates.set(key,template);});
    this.earth=host.models[6].scene;this.earth.scale.setScalar(6200);this.earth.position.set(-600,-7900,4800);this.earth.rotation.set(0,1.7,.4);this.scene.add(this.earth);
    this.mars=host.models[7].scene;this.mars.scale.setScalar(4400);this.scene.add(this.mars);
    const atmosphere=new Mesh(new SphereGeometry(1.014,64,32),new ShaderMaterial({transparent:true,depthWrite:false,side:BackSide,uniforms:{},vertexShader:'varying vec3 n; varying vec3 v; void main(){vec4 p=modelViewMatrix*vec4(position,1.0);n=normalize(normalMatrix*normal);v=normalize(-p.xyz);gl_Position=projectionMatrix*p;}',fragmentShader:'varying vec3 n; varying vec3 v; void main(){float rim=pow(1.0-abs(dot(normalize(n),normalize(v))),3.0);gl_FragColor=vec4(0.08,0.32,0.8,rim*0.48);}'}));this.earth.add(atmosphere);
    let seed=812;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};const coordinates=[];
    for(let i=0;i<1100;i++){const y=rand()*2-1,a=rand()*Math.PI*2,r=38000;coordinates.push(r*Math.sqrt(1-y*y)*Math.cos(a),r*y,r*Math.sqrt(1-y*y)*Math.sin(a));}
    const starGeometry=new BufferGeometry();starGeometry.setAttribute('position',new Float32BufferAttribute(coordinates,3));
    this.stars=new Points(starGeometry,new PointsMaterial({color:0xb6cdec,size:16,sizeAttenuation:true}));this.scene.add(this.stars);
    const portalMaterial=new MeshStandardMaterial({color:0x172430,metalness:.8,roughness:.35});
    this.portal.add(new Mesh(new TorusGeometry(180,12,12,96),portalMaterial));
    const glow=new Mesh(new TorusGeometry(165,2,8,96),new MeshBasicMaterial({color:0x00ff00,toneMapped:false}));this.portal.add(glow);
    const segments=new InstancedMesh(new ConeGeometry(8,38,4),portalMaterial,12);for(let i=0;i<12;i++){const a=i*Math.PI/6;this.dummy.position.set(Math.cos(a)*198,Math.sin(a)*198,0);this.dummy.rotation.set(0,0,a-Math.PI/2);this.dummy.updateMatrix();segments.setMatrixAt(i,this.dummy.matrix);}this.portal.add(segments);
    this.portal.position.copy(PORTAL);this.scene.add(this.portal);
    const makePool=(kind:Bolt['kind'],geometry:BufferGeometry,color:number,capacity:number)=>{
      const material=kind==='missile'?new MeshStandardMaterial({color:0x873526,metalness:.6,roughness:.4,emissive:0xff2200,emissiveIntensity:.45}):new MeshBasicMaterial({color,toneMapped:false});
      const pool=new InstancedMesh(geometry,material,capacity);pool.count=0;pool.frustumCulled=false;this.scene.add(pool);return pool;
    };
    this.pools={primary:makePool('primary',new CapsuleGeometry(.18,16,3,6),0x00ff00,160),hostile:makePool('hostile',new CapsuleGeometry(1.2,13,3,6),0xff2411,100),missile:makePool('missile',new ConeGeometry(2.5,15,8),0xff4400,32)};
    this.comms=new CommsPanel(this.ui);this.buildUI();this.applyPhase();this.updateCamera(true);this.portalBriefing();this.paint();
  }

  private buildUI():void{
    this.ui.className='space-mesh-ui';this.hud.className='space-mesh-status';this.message.className='space-mesh-message';
    this.reticle.className='space-mesh-reticle';this.reticle.textContent='+';this.nav.className='space-mesh-nav';this.contacts.className='space-mesh-contacts';
    const top=document.createElement('div');top.className='space-mesh-top';
    const button=(label:string,run:()=>void,parent:HTMLElement=top)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.addEventListener('click',run,{signal:this.lifetime.signal});parent.appendChild(b);return b;};
    this.pauseButton.type='button';this.pauseButton.addEventListener('click',()=>{if(this.dead)return;this.paused=!this.paused;this.input.clear();this.paint();},{signal:this.lifetime.signal});top.appendChild(this.pauseButton);
    const camera=button('COCKPIT',()=>{this.cockpit=!this.cockpit;camera.textContent=this.cockpit?'CHASE':'COCKPIT';this.updateCamera(true);});
    button('LOG',()=>{if(this.comms.active)return;const seen=this.host.save.snapshot.dialogueSeen;if(seen.includes(PORTAL_COMMS.id)){this.input.clear();this.comms.open(PORTAL_COMMS,()=>true);}else this.say('No completed flight conversations yet.');});
    button('BRIDGE',()=>{if(this.state.phase!=='mars'&&this.enemies.length){this.say('Clear the active patrol before returning to the bridge.');return;}if(this.persist())this.host.onHub();});
    const bottom=document.createElement('div');bottom.className='space-mesh-bottom';
    const hint=document.createElement('span');hint.textContent='DRAG TO STEER · HOLD GUNS';bottom.appendChild(hint);
    for(const [label,action] of [['BOOST','boost'],['GUNS','guns']] as const){const b=document.createElement('button');b.type='button';b.textContent=label;b.dataset.action=action;bottom.appendChild(b);}
    this.ui.append(this.hud,top,this.message,this.reticle,this.nav,this.contacts,bottom);this.host.root.appendChild(this.ui);
    const signal=this.lifetime.signal,root=this.host.root;
    root.addEventListener('pointerdown',e=>{
      const target=e.target as HTMLElement,action=target.closest<HTMLElement>('[data-action]')?.dataset.action;
      if(target.closest('button')&&!action)return;if(!this.canFly())return;
      e.preventDefault();root.setPointerCapture(e.pointerId);this.input.down(e.pointerId,e.clientX,e.clientY,action==='guns'||action==='boost'?action:'steer',performance.now()/1000);
    },{signal});
    root.addEventListener('pointermove',e=>{this.input.move(e.pointerId,e.clientX,e.clientY,Math.min(root.clientWidth,root.clientHeight)*.26);},{signal});
    const end=(e:PointerEvent)=>{this.input.up(e.pointerId);if(root.hasPointerCapture(e.pointerId))root.releasePointerCapture(e.pointerId);};
    root.addEventListener('pointerup',end,{signal});root.addEventListener('pointercancel',end,{signal});root.addEventListener('lostpointercapture',e=>this.input.up(e.pointerId),{signal});
    window.addEventListener('keydown',e=>{if(!this.active||e.repeat)return;if(e.code==='Escape'){this.pause();return;}if(e.code==='KeyC'){camera.click();return;}if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyQ','KeyE','Space','ShiftLeft','ShiftRight','KeyX'].includes(e.code)){e.preventDefault();if(this.canFly())this.input.key(e.code,true);}},{signal});
    window.addEventListener('keyup',e=>this.input.key(e.code,false),{signal});window.addEventListener('blur',this.pause,{signal});document.addEventListener('visibilitychange',()=>{if(document.hidden)this.pause();},{signal});
    this.say(this.state.phase==='departure'?'MR ZAMN · Four guns online. The original fighter is secured below.':'Flight checkpoint restored. Drag to steer; hold GUNS to fire.');
  }
  private canFly():boolean{return this.active&&!this.paused&&!this.dead&&!this.comms.active;}
  private readonly pause=():void=>{if(this.active){this.paused=true;this.input.clear();if(!this.dead)this.persist();this.paint();}};
  setActive(value:boolean):void{this.active=value;this.ui.hidden=!value;this.input.clear();this.comms.setActive(value);window.dispatchEvent(new CustomEvent('coded:music-cue',{detail:{cue:value?'transit':'silence'}}));}
  saveBeforeLeave():boolean{return this.dead||this.persist();}
  private snapshot():SpaceCheckpoint{return {...this.state,position:this.ship.position.toArray() as [number,number,number],orientation:this.ship.quaternion.toArray() as [number,number,number,number]};}
  private persist():boolean{
    const result=checkpointTransit(this.host.save,this.snapshot());if(!result.ok){this.paused=true;this.input.clear();this.say('Checkpoint could not save. Pause here and retry after restoring storage.');}return result.ok;
  }
  private say(text:string):void{this.message.textContent=text;this.noticeClock=8;}
  private portalBriefing():void{
    if(this.state.phase!=='transit'||this.state.wave!==4||this.host.save.snapshot.dialogueSeen.includes(PORTAL_COMMS.id)||this.comms.active)return;
    this.input.clear();this.comms.open(PORTAL_COMMS,()=>{
      const result=this.host.save.update(d=>{if(!d.transit||d.transit.phase!=='transit'||d.transit.wave!==4)return false;d.transit=this.snapshot();if(!d.dialogueSeen.includes(PORTAL_COMMS.id))d.dialogueSeen.push(PORTAL_COMMS.id);});
      if(result.ok)this.input.clear();return result.ok;
    });
  }
  private applyPhase():void{
    const mars=this.state.phase==='mars';this.mars.visible=mars;this.earth.visible=!mars;this.portal.visible=!mars;
    if(mars){this.mars.position.copy(PORTAL).add(new Vector3(0,-1800,-9500));this.sun.position.set(-16000,10000,-35000);}
  }
  private spawnWave():void{
    const wave=SPACE_WAVES[this.state.wave];if(!wave)return;
    wave.enemies.forEach((key,slot)=>{
      const pose=this.templates.get(key)!.clone(true);pose.visible=true;pose.position.copy(this.ship.localToWorld(new Vector3((slot-.5)*140,slot?35:-15,-1100-slot*100)));pose.quaternion.copy(this.ship.quaternion).multiply(new Quaternion().setFromAxisAngle(UP,Math.PI));this.scene.add(pose);
      this.enemies.push({key,pose,sweep:new HullSweep(pose),hp:PROFILE[key].hp,slot,age:0,nextShot:5+slot*2,tell:0,velocity:new Vector3(),retreat:0,approach:this.ship.quaternion.clone()});
    });this.waveSpawned=true;this.say(`${wave.label.toUpperCase()} · ${wave.enemies.map(k=>k.replace(/_/g,' ')).join(' + ')} ahead. Red marks warn before attacks.`);
  }
  private shoot():void{
    if(this.bolts.filter(b=>b.kind==='primary').length>150)return;
    const mounts=capitalVolley(this.ship,this.aimRange());
    for(const muzzle of mounts){this.bolts.push({position:muzzle.origin,previous:muzzle.origin.clone(),velocity:muzzle.direction.multiplyScalar(BOLT_SPEED).addScaledVector(FORWARD.clone().applyQuaternion(this.ship.quaternion),this.speed),age:0,kind:'primary',damage:22});this.fired++;}
    this.volleys++;
    sfx.play('capitalShoot');
  }
  private aimRange():number{
    let best=.35,range=550;
    for(const enemy of this.enemies){const p=this.ship.worldToLocal(enemy.pose.position.clone()),angle=Math.hypot(p.x,p.y)/Math.max(1,-p.z);if(p.z<-350&&angle<best){best=angle;range=-p.z;}}
    // Rangefinder adjusts depth only. Player orientation alone sets direction.
    return Math.max(400,Math.min(2000,range));
  }
  private enemyAttack(enemy:Enemy):void{
    sfx.play('enemyShoot');
    const missile=enemy.key==='whale_scout',lead=this.ship.position.clone().addScaledVector(FORWARD.clone().applyQuaternion(this.ship.quaternion),this.speed*(missile?.55:.35));
    const mounts=['Muzzle_L','Muzzle_R'];
    for(const [index,name] of mounts.entries()){
      if(this.bolts.filter(b=>b.kind!=='primary').length>=90)return;
      const node=enemy.pose.getObjectByName(name);if(!node)continue;const position=node.getWorldPosition(new Vector3());
      const aim=lead.clone().add(new Vector3((index?1:-1)*(missile?15:8),0,0)).sub(position).normalize();
      this.bolts.push({position,previous:position.clone(),velocity:aim.multiplyScalar(missile?MISSILE_SPEED:570),age:0,kind:missile?'missile':'hostile',damage:missile?30:enemy.key==='rug_fighter'?16:enemy.key==='fog_raider'?10:8});
    }
  }
  private updateEnemies(dt:number):void{
    for(const enemy of this.enemies){
      enemy.age+=dt;enemy.nextShot-=dt;
      const fast=enemy.key==='fast_scout',wide=enemy.key==='rug_fighter'||enemy.key==='whale_scout';
      const cycle=(enemy.age+enemy.slot*2)%PROFILE[enemy.key].period,extending=cycle>7;
      const sway=Math.sin(enemy.age*(fast?.45:.22)+enemy.slot*2)*(fast?90:wide?25:40);
      const offset=new Vector3((enemy.slot-.5)*120+sway+(extending?(enemy.slot?1:-1)*240:0),Math.sin(enemy.age*.2+enemy.slot)*18,-(enemy.retreat>0?950:extending?650:410+enemy.slot*120));
      // An approach keeps its bearing while the player aims. Rotating this
      // formation with every steering input made a target impossible to catch.
      if(enemy.pose.position.distanceTo(this.ship.position)>1900)enemy.approach.slerp(this.ship.quaternion,dt*.2);
      const target=this.ship.position.clone().add(offset.applyQuaternion(enemy.approach)),delta=target.sub(enemy.pose.position);
      const wanted=delta.multiplyScalar(.7).addScaledVector(FORWARD.clone().applyQuaternion(this.ship.quaternion),this.speed);
      wanted.clampLength(0,PROFILE[enemy.key].speed);enemy.velocity.lerp(wanted,Math.min(1,dt*2));enemy.pose.position.addScaledVector(enemy.velocity,dt);
      const look=new Object3D();look.position.copy(enemy.pose.position);look.up.copy(UP).applyQuaternion(enemy.approach);look.lookAt(extending?enemy.pose.position.clone().add(enemy.velocity):this.ship.position);look.rotateY(Math.PI);enemy.pose.quaternion.slerp(look.quaternion,Math.min(1,dt*(wide?.7:1.4)));
      if(enemy.retreat>0)enemy.retreat-=dt;
      if(enemy.nextShot<=1.1&&enemy.tell===0){enemy.tell=1.1;this.say(`${enemy.key==='whale_scout'?'MISSILE LOCK':enemy.key.replace(/_/g,' ').toUpperCase()+' FIRING'} · Turn across the red firing line.`);}
      if(enemy.tell>0)enemy.tell=Math.max(.001,enemy.tell-dt);
      if(enemy.nextShot<=0){this.enemyAttack(enemy);enemy.nextShot=PROFILE[enemy.key].period;enemy.tell=0;if(enemy.key==='fog_raider')enemy.retreat=2.5;}
    }
  }
  private armor(enemy:Enemy,from:Vector3):number{
    const incoming=enemy.pose.worldToLocal(from.clone()).normalize();
    if(enemy.key==='rug_fighter')return incoming.z<-.55?.35:incoming.z>.5?2:1;
    if(enemy.key==='whale_scout')return incoming.y>.3?1.8:incoming.z<-.55?.6:1;
    return 1;
  }
  private impact(at:Vector3,color:number):void{
    if(this.flashes.length>=16){const old=this.flashes.shift()!;this.scene.remove(old.mesh);disposeObject(old.mesh);}
    const mesh=new Mesh(new SphereGeometry(4,8,6),new MeshBasicMaterial({color,transparent:true,opacity:.85,toneMapped:false,depthWrite:false}));mesh.position.copy(at);this.scene.add(mesh);this.flashes.push({mesh,time:.25});
  }
  private damageShip(bolt:Bolt):void{
    const local=this.ship.worldToLocal(bolt.previous.clone()),bank=local.z<0?'fore':'aft';let amount=bolt.damage;
    const blocked=Math.min(this.state[bank],amount);this.state[bank]-=blocked;amount-=blocked;this.state.hull=Math.max(0,this.state.hull-amount);this.lastDamage=this.state.seconds;this.incomingHits++;this.hitFlash=.25;
    this.impact(bolt.position,blocked?0x00ff00:0xff4400);sfx.play(blocked?'hit':'hurt');if(this.state.hull===0)this.defeat();
  }
  private updateBolts(dt:number):void{
    for(let i=this.bolts.length-1;i>=0;i--){
      const bolt=this.bolts[i];bolt.previous.copy(bolt.position);bolt.age+=dt;
      if(bolt.kind==='missile'&&bolt.age<2){const aim=this.ship.position.clone().sub(bolt.position).normalize().multiplyScalar(MISSILE_SPEED);bolt.velocity.lerp(aim,dt*.65).setLength(MISSILE_SPEED);}
      bolt.position.addScaledVector(bolt.velocity,dt);let hit=false;
      if(bolt.kind==='primary'){
        for(const enemy of this.enemies){
          if(!segmentSphere(bolt.previous,bolt.position,enemy.pose.position,65))continue;
          if(enemy.sweep.hit(bolt.previous,bolt.position,1.3)){enemy.hp-=bolt.damage*this.armor(enemy,bolt.previous);this.hits++;this.impact(bolt.position,0xff7733);hit=true;break;}
        }
        if(!hit)for(let j=0;j<this.bolts.length;j++){const missile=this.bolts[j];if(missile.kind==='missile'&&missile.age<20&&segmentSphere(bolt.previous,bolt.position,missile.position,6)){missile.age=20;this.impact(missile.position,0xff9944);hit=true;break;}}
      }else if(segmentSphere(bolt.previous,bolt.position,this.ship.position,75)&&this.hull.hit(bolt.previous,bolt.position,bolt.kind==='missile'?2.5:1.2)){this.damageShip(bolt);hit=true;}
      if(hit||bolt.age>(bolt.kind==='primary'?2.5:8))this.bolts.splice(i,1);
    }
    for(let i=this.enemies.length-1;i>=0;i--)if(this.enemies[i].hp<=0){this.impact(this.enemies[i].pose.position,0xff6633);sfx.play('explode');this.scene.remove(this.enemies[i].pose);this.enemies.splice(i,1);}
    if(this.waveSpawned&&!this.enemies.length&&!this.dead){const result=clearSpaceWave(this.host.save,this.snapshot());if(result.ok){this.state.wave++;this.waveSpawned=false;this.bolts.length=0;this.say(this.state.wave===4?'Portal guard cleared. Follow the green navigation marker through the ring.':'Patrol cleared · 100 salvage. Continue toward the portal.');this.portalBriefing();}else{this.paused=true;this.say('Patrol cleared, but the reward could not save. Resume to retry.');}}
  }
  private defeat():void{
    this.dead=true;this.paused=true;this.input.clear();const panel=document.createElement('div');panel.className='space-mesh-defeat';
    const title=document.createElement('h2');title.textContent='HULL DISABLED';const text=document.createElement('p');text.textContent='Retry the current patrol. Earned salvage, crew and the stored fighter are retained.';
    const retry=document.createElement('button');retry.textContent='RETRY PATROL';retry.addEventListener('click',()=>{
      const result=this.host.save.update(d=>{if(!d.transit)return false;d.transit.hull=100;d.transit.fore=d.transit.aft=d.capitalUpgrades.shield_capacity?150:100;});if(result.ok)this.host.onRetry();else text.textContent='Checkpoint could not save. Retry when storage is available.';
    },{signal:this.lifetime.signal});panel.append(title,text,retry);this.ui.appendChild(panel);this.paint();
  }
  private updateCamera(immediate=false):void{
    this.ship.updateMatrixWorld(true);const mount=this.ship.getObjectByName(this.cockpit?'Camera_Cockpit_Forward':'Camera_Chase')!;
    const desired=mount.getWorldPosition(new Vector3());
    if(!this.cockpit&&this.host.root.clientWidth<this.host.root.clientHeight){const relative=desired.clone().sub(this.ship.position);desired.copy(this.ship.position).addScaledVector(relative,1.35);}
    if(this.state.phase==='departure'&&!this.cockpit){
      const blend=Math.max(0,Math.min(1,(this.state.seconds-3)/5));
      const opening=this.ship.localToWorld(new Vector3(150,85,-190));desired.lerpVectors(opening,desired,blend*blend*(3-2*blend));
      this.camera.position.copy(desired);this.camera.up.copy(UP).applyQuaternion(this.ship.quaternion);this.camera.lookAt(this.ship.position.clone().lerp(forwardPoint(this.ship,1100),blend));
    }else{this.camera.position.copy(desired);this.camera.up.copy(UP).applyQuaternion(this.ship.quaternion);this.camera.lookAt(forwardPoint(this.ship,1100));}
    this.ship.visible=!this.cockpit;void immediate;
  }
  update(dt:number):void{
    if(!this.active)return;
    this.comms.update(dt);
    if(!this.canFly()){this.paint();return;}
    this.state.seconds+=dt;this.saveClock+=dt;this.hudClock+=dt;this.noticeClock-=dt;this.hitFlash=Math.max(0,this.hitFlash-dt);
    if(this.noticeClock<=0)this.message.textContent='';
    this.earth.rotation.y+=dt*.003;this.mars.rotation.y+=dt*.004;
    if(this.state.phase==='departure'){
      this.speed=130*Math.min(1,this.state.seconds/7);this.ship.position.addScaledVector(FORWARD.clone().applyQuaternion(this.ship.quaternion),this.speed*dt);
      if(this.state.seconds>=8){const result=finishDeparture(this.host.save,this.snapshot());if(result.ok){this.state.phase='transit';this.say('CAPITAL FLIGHT · Drag to steer. All four guns converge on the forward cross.');}else{this.paused=true;this.say('Departure checkpoint could not save. Resume to retry.');}}
    }else{
      const blend=1-Math.exp(-3.4*dt);this.yaw+=(this.input.x*1.35-this.yaw)*blend;this.pitch+=(this.input.y*1.35-this.pitch)*blend;
      turnFlight(this.ship.quaternion,this.yaw,this.pitch,this.input.roll*.8,dt);
      const cruise=this.state.phase==='mars'?70:130;this.speed+=(cruise*(this.input.braking?.3:this.input.boosting?2.2:1)-this.speed)*Math.min(1,dt*1.5);
      this.ship.position.addScaledVector(FORWARD.clone().applyQuaternion(this.ship.quaternion),this.speed*dt);
      this.nextFire=Math.max(0,this.nextFire-dt);if(this.input.firing&&this.nextFire===0){this.shoot();this.nextFire=.28;}
      if(this.state.phase==='transit'){
        const wave=SPACE_WAVES[this.state.wave];if(wave&&!this.waveSpawned&&-this.ship.position.z>=wave.at)this.spawnWave();
        this.updateEnemies(dt);this.updateBolts(dt);
        if(!this.comms.active&&this.ship.position.distanceTo(PORTAL)<140&&this.state.wave===SPACE_WAVES.length&&!this.portalCrossing){
          const direction=FORWARD.clone().applyQuaternion(this.ship.quaternion);if(direction.z<-.35){
            const result=arriveMars(this.host.save,this.snapshot());if(result.ok){this.state.phase='mars';this.portalCrossing=true;this.bolts.length=0;this.applyPhase();this.say('MARS · Relief beacon acquired. Return to the bridge to review the surface approach.');}else{this.paused=true;this.say('Portal arrival could not save. Resume to retry.');}
          }
        }
        if(this.ship.position.z<-24500&&this.state.wave<4)this.say('The portal is sealed by the remaining patrols. Follow the red contacts.');
      }else this.updateBolts(dt);
    }
    if(this.state.seconds-this.lastDamage>7){const cap=this.host.save.snapshot.capitalUpgrades.shield_capacity?150:100;this.state.fore=Math.min(cap,this.state.fore+dt*4);this.state.aft=Math.min(cap,this.state.aft+dt*4);}
    for(const flame of this.flames)flame.scale.y=Math.max(.02,this.speed/130)*(1+Math.sin(this.state.seconds*35)*.06);
    for(let i=this.flashes.length-1;i>=0;i--){const f=this.flashes[i];f.time-=dt;f.mesh.scale.multiplyScalar(1+dt*5);(f.mesh.material as MeshBasicMaterial).opacity=Math.max(0,f.time*3);if(f.time<=0){this.scene.remove(f.mesh);disposeObject(f.mesh);this.flashes.splice(i,1);}}
    this.stars.position.copy(this.ship.position);this.updateCamera();
    if(this.saveClock>=10&&!this.dead){this.saveClock=0;this.persist();}
    if(this.hudClock>=.1){this.hudClock=0;this.paint();}
  }
  private place(element:HTMLElement,world:Vector3,clamp=false):void{
    const point=world.clone().project(this.camera);const local=this.camera.worldToLocal(world.clone()),behind=local.z>0;
    element.hidden=!clamp&&(behind||Math.abs(point.x)>1||Math.abs(point.y)>1);
    const x=behind?-point.x:point.x,y=behind?-point.y:point.y;
    element.style.left=`${(clamp?Math.max(-.82,Math.min(.82,x)):x)*50+50}%`;element.style.top=`${(clamp?Math.max(-.62,Math.min(.6,y)):y)*-50+50}%`;
    element.dataset.behind=String(behind);
  }
  private paint():void{
    this.pauseButton.textContent=this.paused?(this.state.seconds===0?'BEGIN DEPARTURE':'RESUME'):'PAUSE';
    const distance=this.ship.position.distanceTo(PORTAL),phase=this.state.phase==='mars'?'MARS ORBIT':this.state.phase==='departure'?'ENGINE START':'EARTH → MARS';
    this.hud.textContent=`${phase}\nHULL ${Math.ceil(this.state.hull)} · FORE ${Math.ceil(this.state.fore)} · AFT ${Math.ceil(this.state.aft)}\n${Math.round(this.speed)} m/s · ${this.state.phase==='mars'?'RELIEF SIGNAL AHEAD':`${(distance/1000).toFixed(1)} km TO PORTAL · PATROL ${Math.min(4,this.state.wave+1)}/4`}`;
    this.reticle.style.opacity=this.state.phase==='departure'?'0':'1';this.place(this.reticle,forwardPoint(this.ship,this.aimRange()));
    const navigation=this.state.phase==='mars'?this.mars.position:PORTAL;this.place(this.nav,navigation,true);this.nav.textContent=this.state.phase==='mars'?'◇ MARS':`◇ PORTAL ${(distance/1000).toFixed(1)} km`;
    this.contacts.replaceChildren();
    let closest:Enemy|null=null,score=Infinity;
    for(const enemy of this.enemies){
      const tag=document.createElement('span');tag.className='space-mesh-contact';tag.dataset.warning=String(enemy.tell>0);tag.textContent=enemy.tell>0?'⚠':'◇';this.place(tag,enemy.pose.position,true);this.contacts.appendChild(tag);
      const relative=enemy.velocity.clone().addScaledVector(FORWARD.clone().applyQuaternion(this.ship.quaternion),-this.speed),lead=interceptPoint(this.ship.position,enemy.pose.position,relative,BOLT_SPEED);
      const marker=document.createElement('span');marker.className='space-mesh-lead';marker.textContent='·';marker.dataset.enemy=enemy.key;marker.dataset.contact=`${enemy.key}:${enemy.slot}`;this.place(marker,lead);this.contacts.appendChild(marker);
      const local=this.ship.worldToLocal(enemy.pose.position.clone()),angle=Math.hypot(local.x,local.y)/Math.max(1,-local.z);if(local.z<0&&angle<score){score=angle;closest=enemy;}
    }
    if(closest)this.hud.textContent+=`\n${closest.key.replace(/_/g,' ').toUpperCase()} · ${Math.round(closest.pose.position.distanceTo(this.ship.position))} m · ${Math.max(0,Math.ceil(closest.hp))} ARMOR`;
    this.ui.style.boxShadow=this.hitFlash>0?'inset 0 0 70px #ff200060':'none';
    if(this.host.save.testSlot){const data=this.ui.dataset;data.phase=this.state.phase;data.seconds=this.state.seconds.toFixed(2);data.wave=String(this.state.wave);data.enemies=String(this.enemies.length);data.position=JSON.stringify(this.ship.position.toArray());data.orientation=JSON.stringify(this.ship.quaternion.toArray());data.volleys=String(this.volleys);data.bolts=String(this.fired);data.hits=String(this.hits);data.incomingHits=String(this.incomingHits);data.paused=String(this.paused);data.hull=String(this.state.hull);data.firing=String(this.input.firing);data.yaw=String(this.input.x);data.pitch=String(this.input.y);data.camera=this.cockpit?'cockpit':'chase';}
  }
  render():void{
    this.camera.aspect=this.host.root.clientWidth/Math.max(1,this.host.root.clientHeight);this.camera.fov=this.camera.aspect<1?66:55;this.camera.updateProjectionMatrix();
    const counts={primary:0,hostile:0,missile:0};
    for(const bolt of this.bolts){const pool=this.pools[bolt.kind],index=counts[bolt.kind]++;if(index>=pool.instanceMatrix.count)continue;this.dummy.position.copy(bolt.position);this.dummy.quaternion.setFromUnitVectors(UP,bolt.velocity.clone().normalize());this.dummy.scale.setScalar(1);this.dummy.updateMatrix();pool.setMatrixAt(index,this.dummy.matrix);}
    for(const kind of ['primary','hostile','missile'] as const){this.pools[kind].count=Math.min(counts[kind],this.pools[kind].instanceMatrix.count);this.pools[kind].instanceMatrix.needsUpdate=true;}
    this.host.renderer.render(this.scene,this.camera);
    if(this.host.save.testSlot){const info=this.host.renderer.info;this.ui.dataset.triangles=String(info.render.triangles);this.ui.dataset.calls=String(info.render.calls);this.ui.dataset.geometries=String(info.memory.geometries);this.ui.dataset.textures=String(info.memory.textures);}
  }
  dispose():void{this.active=false;this.input.clear();this.comms.dispose();this.lifetime.abort();this.ui.remove();disposeObject(this.scene);}
}
