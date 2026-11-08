import {
  AmbientLight, AnimationMixer, BoxGeometry, Color, CylinderGeometry, DirectionalLight,
  GridHelper, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, PerspectiveCamera,
  Plane, PlaneGeometry, PointLight, Raycaster, Scene, SphereGeometry, Texture, Vector2,
  Vector3, WebGLRenderer
} from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import {disposeObject} from './ModelAssets';
import type {ManagedScene} from './SceneController';
import {
  ACTION_POINTS, DOOR_GUARD_TRIGGER_METRES, canTacticalMove, createTacticalActor,
  gainTacticalXp, pinchTacticalCamera, tacticalDamage, type TacticalActor, type TacticalPhase
} from './ArrivalTacticsRules';

interface Host {renderer:WebGLRenderer;environment:Texture;root:HTMLElement;hero:GLTF}
type BattleAction='move'|'shoot';
interface Flash {mesh:Mesh;left:number}

/**
 * One-room standalone playtest. No CampaignSave, rewards, room transitions or campaign mutations.
 * Free-walk approach to the doorway guard, then two-action turn-based combat.
 */
export class ArrivalTacticsScene implements ManagedScene {
  private readonly scene=new Scene();
  private readonly camera=new PerspectiveCamera(44,1,.1,180);
  private readonly lifetime=new AbortController();
  private readonly hero:Group;
  private readonly mixer:AnimationMixer;
  private readonly guard=new Group();
  private readonly ui=document.createElement('section');
  private readonly title=document.createElement('div');
  private readonly headline=document.createElement('div');
  private readonly stats=document.createElement('div');
  private readonly notice=document.createElement('div');
  private readonly actions=document.createElement('div');
  private readonly ray=new Raycaster();
  private readonly ground=new Plane(new Vector3(0,1,0),0);
  private readonly touches=new Map<number,Vector2>();
  private readonly touchOrigins=new Map<number,Vector2>();
  private readonly keys=new Set<string>();
  private readonly effects:Flash[]=[];
  private readonly coverPositions=[new Vector3(-5,0,3),new Vector3(5,0,2),new Vector3(-5,0,-5),new Vector3(5,0,-6)];
  private active=false;
  private phase:TacticalPhase='explore';
  private actor:TacticalActor=createTacticalActor('xrpman',100,22);
  private enemy:TacticalActor=createTacticalActor('security_guard',60,11);
  private ap=ACTION_POINTS;
  private chosen:BattleAction='move';
  private covered=false;
  private zoom=1;
  private pinchPrevious:number|null=null;
  private ignoreTap=false;
  private moveTarget:Vector3|null=null;
  private enemyClock=0;
  private clip='';
  private message='Walk toward the red-lit security door. One Level 1 guard blocks the way.';
  private idle=0;

  constructor(private readonly host:Host){
    this.hero=host.hero.scene;
    this.mixer=new AnimationMixer(this.hero);
    this.scene.background=new Color('#030911');
    this.scene.environment=host.environment;
    this.scene.environmentIntensity=.48;
    this.scene.add(new AmbientLight(0x8bb3d5,.72));
    const key=new DirectionalLight(0xb6dcff,2.9);
    key.position.set(-7,18,10);this.scene.add(key);
    const red=new PointLight(0xff3325,30,16,2);red.position.set(0,3,-11);
    const blue=new PointLight(0x1677ef,22,17,2);blue.position.set(-10,5,4);
    this.scene.add(red,blue);
    this.makeRoom();
    this.hero.position.set(0,0,10);
    this.hero.rotation.y=Math.PI;
    this.scene.add(this.hero);
    this.play('Idle');
    this.makeGuard();
    this.guard.position.set(0,0,-10);
    this.guard.rotation.y=0;
    this.scene.add(this.guard);
    this.camera.position.set(19,27,35);
    this.camera.lookAt(0,0,0);
    this.makeUI();
    this.bindInput();
    this.paint();
  }
  private makeRoom():void{
    const metal=new MeshStandardMaterial({color:0x172431,metalness:.67,roughness:.57});
    const trim=new MeshStandardMaterial({color:0x53677c,metalness:.78,roughness:.4});
    const danger=new MeshBasicMaterial({color:0xff382a,toneMapped:false});
    const green=new MeshBasicMaterial({color:0x00ff00,toneMapped:false});
    const box=new BoxGeometry(1,1,1);
    const block=(x:number,y:number,z:number,w:number,h:number,d:number,material:MeshStandardMaterial|MeshBasicMaterial=metal)=>{
      const mesh=new Mesh(box,material);mesh.position.set(x,y,z);mesh.scale.set(w,h,d);mesh.receiveShadow=true;this.scene.add(mesh);return mesh;
    };
    const floor=new Mesh(new PlaneGeometry(28,30),new MeshStandardMaterial({color:0x182735,metalness:.62,roughness:.68}));
    floor.rotation.x=-Math.PI/2;floor.position.y=-.07;floor.receiveShadow=true;this.scene.add(floor);
    const grid=new GridHelper(28,14,0x31a480,0x244458);
    grid.position.y=.01;this.scene.add(grid);
    for(const x of [-13.75,13.75]){
      block(x,1.45,0,.5,2.9,30,metal);
      for(const z of [-12,-6,0,6,12])block(x,1.4,z,.2,2.8,.14,trim);
    }
    block(-8.5,1.4,-14.7,11,2.8,.6);
    block(8.5,1.4,-14.7,11,2.8,.6);
    block(0,2.85,-14.7,6,.28,.7,trim);
    block(0,1.35,-14.85,4.8,2.6,.18,danger);
    block(0,1.35,-14.7,4.2,2.25,.22,metal);
    for(const x of [-2.25,2.25])block(x,1.35,-14.44,.13,2.3,.13,danger);
    block(0,.13,-13.3,4,.08,.6,danger);
    block(0,.06,13,7,.08,.22,green);
    for(const x of [-8,8]){
      for(const z of [-10,10]){
        block(x,.7,z,1,1.4,1,metal);block(x,1.42,z,1.2,.12,1.2,trim);
        block(x,1.55,z,.6,.035,.6,x>0?danger:green);
      }
    }
    for(const p of this.coverPositions){
      block(p.x,.5,p.z,2.2,1,1.7,metal);
      block(p.x,1.06,p.z,2.25,.12,1.78,trim);
      for(const sign of [-1,1])block(p.x+sign*.9,.54,p.z,.13,.75,1.8,green);
    }
    for(const x of [-10,10])for(const z of [-11,-2,7])block(x,.035,z,.18,.04,4,trim);
  }
  private makeGuard():void{
    const armor=new MeshStandardMaterial({color:0x354456,metalness:.72,roughness:.49});
    const black=new MeshStandardMaterial({color:0x0f161e,metalness:.4,roughness:.64});
    const red=new MeshBasicMaterial({color:0xff392b,toneMapped:false});
    const box=new BoxGeometry(1,1,1);
    const part=(x:number,y:number,z:number,w:number,h:number,d:number,material:MeshStandardMaterial|MeshBasicMaterial=armor)=>{
      const mesh=new Mesh(box,material);mesh.position.set(x,y,z);mesh.scale.set(w,h,d);this.guard.add(mesh);
    };
    part(0,1.13,0,.75,.8,.48);
    part(0,.72,0,.45,.17,.35,black);
    part(0,1.72,0,.42,.46,.39,black);
    part(0,1.72,-.212,.34,.09,.035,red);
    for(const s of [-1,1]){
      part(s*.53,1.22,0,.3,.55,.4,armor);
      part(s*.25,.35,0,.28,.72,.36,black);
      part(s*.25,.13,-.13,.35,.22,.58,armor);
      part(s*.53,1.47,0,.35,.19,.5,armor);
    }
    part(.45,1.03,-.34,.18,.16,.97,black);
    part(.45,1.08,-.95,.09,.09,.36,red);
    const ring=new Mesh(new CylinderGeometry(1.1,1.1,.028,24),new MeshBasicMaterial({color:0xff3322,wireframe:true,transparent:true,opacity:.85,toneMapped:false}));
    ring.position.y=.06;this.guard.add(ring);
  }
  private makeUI():void{
    this.ui.className='arrival-tactics-ui';
    this.ui.dataset.mode='explore';
    this.title.className='arrival-tactics-title';
    this.title.textContent='CODED / REGULATORY WARSHIP / ARRIVAL BAY · TACTICAL TEST';
    this.headline.className='arrival-tactics-headline';
    this.stats.className='arrival-tactics-stats';
    this.notice.className='arrival-tactics-notice';
    this.actions.className='arrival-tactics-actions';
    this.ui.append(this.title,this.headline,this.stats,this.notice,this.actions);
    this.host.root.appendChild(this.ui);
  }
  private bindInput():void{
    const canvas=this.host.renderer.domElement,signal=this.lifetime.signal;
    canvas.addEventListener('pointerdown',event=>{
      if(!this.active)return;
      this.touches.set(event.pointerId,new Vector2(event.clientX,event.clientY));
      this.touchOrigins.set(event.pointerId,new Vector2(event.clientX,event.clientY));
      if(this.touches.size>=2){
        this.ignoreTap=true;this.pinchPrevious=this.touchSpacing();
      }
      canvas.setPointerCapture(event.pointerId);
      event.preventDefault();
    },{signal});
    canvas.addEventListener('pointermove',event=>{
      if(!this.touches.has(event.pointerId))return;
      this.touches.get(event.pointerId)!.set(event.clientX,event.clientY);
      if(this.touches.size>=2){
        const spacing=this.touchSpacing();
        if(this.pinchPrevious!==null)this.zoom=pinchTacticalCamera(this.zoom,this.pinchPrevious,spacing);
        this.pinchPrevious=spacing;
      }
    },{signal});
    const release=(event:PointerEvent)=>{
      const origin=this.touchOrigins.get(event.pointerId);
      const wasSingle=this.touches.size===1;
      const distance=origin?origin.distanceTo(new Vector2(event.clientX,event.clientY)):Infinity;
      this.touches.delete(event.pointerId);this.touchOrigins.delete(event.pointerId);
      if(this.touches.size<2)this.pinchPrevious=null;
      if(this.touches.size===0){
        if(wasSingle&&!this.ignoreTap&&distance<12&&event.type==='pointerup')this.tap(event.clientX,event.clientY);
        this.ignoreTap=false;
      }
    };
    canvas.addEventListener('pointerup',release,{signal});
    canvas.addEventListener('pointercancel',release,{signal});
    canvas.addEventListener('lostpointercapture',release,{signal});
    canvas.addEventListener('wheel',event=>{
      if(!this.active)return;this.zoom=Math.max(.62,Math.min(1.65,this.zoom*Math.exp(event.deltaY*.0014)));event.preventDefault();
    },{signal,passive:false});
    window.addEventListener('keydown',event=>{
      if(!this.active)return;
      this.keys.add(event.code);
      if(this.phase==='player'&&event.code==='Space'){event.preventDefault();this.shoot();}
      if(this.phase==='player'&&event.code==='KeyE')this.endTurn();
    },{signal});
    window.addEventListener('keyup',event=>{this.keys.delete(event.code);},{signal});
    window.addEventListener('blur',()=>{this.keys.clear();this.moveTarget=null;},{signal});
  }
  private touchSpacing():number{
    const pair=[...this.touches.values()];
    return pair.length>=2?pair[0].distanceTo(pair[1]):0;
  }
  private tap(clientX:number,clientY:number):void{
    if(this.phase!=='explore'&&this.phase!=='player')return;
    const bounds=this.host.renderer.domElement.getBoundingClientRect();
    this.ray.setFromCamera(new Vector2((clientX-bounds.left)/bounds.width*2-1,-(clientY-bounds.top)/bounds.height*2+1),this.camera);
    const point=new Vector3();
    if(!this.ray.ray.intersectPlane(this.ground,point))return;
    if(this.phase==='explore') {
      point.set(Math.max(-11.7,Math.min(11.7,point.x)),0,Math.max(-11.7,Math.min(11.7,point.z)));
      this.moveTarget=point;this.message='Approach the guard at the locked security door.';
    } else if(this.chosen==='move')this.moveInCombat(point);
    this.paint();
  }
  private play(name:string):void{
    if(name===this.clip)return;
    const clip=this.host.hero.animations.find(a=>a.name===name);
    if(!clip)return;
    const next=this.mixer.clipAction(clip).reset().play();
    const prior=this.host.hero.animations.find(a=>a.name===this.clip);
    if(prior)next.crossFadeFrom(this.mixer.clipAction(prior),.16,false);
    this.clip=name;
  }
  private encounter():void{
    if(this.phase!=='explore')return;
    this.moveTarget=null;this.phase='player';this.ap=ACTION_POINTS;
    this.message='HOSTILE CONTACT · Security guard LV 1. Your turn: 2 action points.';
    this.paint();
  }
  private blocked(point:Vector3):boolean{
    return this.coverPositions.some(p=>point.distanceTo(p)<1.45)||point.distanceTo(this.guard.position)<1.25;
  }
  private moveInCombat(point:Vector3):void{
    if(this.phase!=='player'||this.ap<1||this.moveTarget)return;
    const target=new Vector3(Math.round(point.x/2)*2,0,Math.round(point.z/2)*2);
    if(!canTacticalMove(this.hero.position,target,this.ap)||this.blocked(target)){
      this.message='MOVE: choose an open tile within 6 metres. Crates and the guard block movement.';
      this.paint();return;
    }
    this.ap-=1;this.covered=false;this.moveTarget=target;
    this.message='MOVE · 1 action point spent.';
    this.paint();
  }
  private effect(from:Vector3,to:Vector3,hostile:boolean):void{
    const delta=to.clone().sub(from);
    const mesh=new Mesh(new CylinderGeometry(.045,.045,delta.length(),6),new MeshBasicMaterial({color:hostile?0xff392b:0x00ff00,toneMapped:false,transparent:true,opacity:1}));
    mesh.position.copy(from).addScaledVector(delta,.5);
    mesh.quaternion.setFromUnitVectors(new Vector3(0,1,0),delta.normalize());
    this.scene.add(mesh);this.effects.push({mesh,left:.3});
  }
  private shoot():void{
    if(this.phase!=='player'||this.ap<1||this.moveTarget)return;
    if(this.hero.position.distanceTo(this.guard.position)>17){
      this.message='Target outside weapon range. Move closer.';this.paint();return;
    }
    this.ap-=1;
    this.covered=false;
    this.play('AimFire');
    this.effect(this.hero.position.clone().add(new Vector3(0,1.18,0)),this.guard.position.clone().add(new Vector3(0,1.1,0)),false);
    this.enemy.hp=Math.max(0,this.enemy.hp-tacticalDamage(this.actor.attack,false));
    if(this.enemy.hp===0){
      this.phase='victory';
      this.actor=gainTacticalXp(this.actor,60);
      this.message='DOOR GUARD DEFEATED · +60 XP · XRPMan Level '+this.actor.level+'. No campaign rewards granted.';
      this.guard.visible=false;
    } else {
      this.message='ION SHOT · '+this.actor.attack+' damage. Guard has '+this.enemy.hp+' HP.';
      if(this.ap===0)this.queueEnemy();
    }
    this.paint();
  }
  private takeCover():void{
    if(this.phase!=='player'||this.ap<1||this.moveTarget)return;
    if(!this.coverPositions.some(p=>this.hero.position.distanceTo(p)<3)){
      this.message='Move next to a cargo crate before taking cover.';this.paint();return;
    }
    this.covered=true;this.ap--;
    this.message='COVER ACTIVE · Incoming damage reduced until you move or fire.';
    if(this.ap===0)this.queueEnemy();
    this.paint();
  }
  private queueEnemy():void{
    if(this.phase!=='player')return;
    this.phase='enemy';this.enemyClock=.75;
    this.message='ENEMY TURN · Security guard is taking aim.';
    this.paint();
  }
  private enemyTurn():void{
    if(this.phase!=='enemy')return;
    if(this.guard.position.distanceTo(this.hero.position)>15){
      const direction=this.hero.position.clone().sub(this.guard.position).setY(0).normalize();
      this.guard.position.addScaledVector(direction,3);
      this.message='Guard advances 3 metres.';
    } else {
      this.effect(this.guard.position.clone().add(new Vector3(0,1.1,0)),this.hero.position.clone().add(new Vector3(0,1.05,0)),true);
      const damage=tacticalDamage(this.enemy.attack,this.covered);
      this.actor.hp=Math.max(0,this.actor.hp-damage);
      this.message='Guard fires: '+damage+' damage'+(this.covered?' (cover reduced hit)':'')+'.';
    }
    if(this.actor.hp===0){
      this.phase='defeat';this.message='XRPMAN DOWN · Test encounter failed. Retry to restart the isolated room.';
    }else{
      this.phase='player';this.ap=ACTION_POINTS;
      this.message+=' Your turn · 2 AP.';
    }
    this.paint();
  }
  private endTurn():void{
    if(this.phase==='player'&&!this.moveTarget)this.queueEnemy();
  }
  private reset():void{
    this.phase='explore';
    this.actor=createTacticalActor('xrpman',100,22);
    this.enemy=createTacticalActor('security_guard',60,11);
    this.ap=ACTION_POINTS;this.covered=false;this.zoom=1;this.chosen='move';
    this.hero.position.set(0,0,10);this.hero.rotation.y=Math.PI;
    this.guard.position.set(0,0,-10);this.guard.visible=true;
    this.moveTarget=null;this.enemyClock=0;this.clip='';
    this.play('Idle');this.message='Approach the security door. The guard is waiting.';
    this.paint();
  }
  private paint():void{
    this.ui.dataset.mode=this.phase;
    this.ui.dataset.ap=String(this.ap);
    this.ui.dataset.guardHp=String(this.enemy.hp);
    this.ui.dataset.heroLevel=String(this.actor.level);
    this.headline.textContent=this.phase==='explore'?'EXPLORE · APPROACH THE DOOR':this.phase==='player'?'YOUR TURN · '+this.ap+' / 2 AP':this.phase==='enemy'?'ENEMY TURN':this.phase==='victory'?'VICTORY · ARRIVAL BAY CLEAR':'MISSION FAILED';
    this.stats.replaceChildren();
    const actor=(name:string,a:TacticalActor,hostile:boolean)=>{
      const panel=document.createElement('div');panel.className='arrival-tactics-actor'+(hostile?' hostile':'');
      const title=document.createElement('strong');title.textContent=name+' · LV '+a.level;
      const hp=document.createElement('span');hp.textContent=a.hp+' / '+a.maxHp+' HP';
      const bar=document.createElement('div');bar.className='arrival-tactics-bar';
      const fill=document.createElement('i');fill.style.width=(100*a.hp/a.maxHp)+'%';bar.append(fill);
      const extra=document.createElement('small');extra.textContent=hostile?'SECURITY FORCES':'XP '+a.xp+' / '+a.nextXp+' · DMG '+a.attack;
      panel.append(title,hp,bar,extra);this.stats.append(panel);
    };
    actor('XRPMAN',this.actor,false);actor('DOOR GUARD',this.enemy,true);
    this.notice.textContent=this.message+(this.phase==='explore'?' Tap ground or use WASD to walk. Pinch to zoom.':'');
    this.actions.replaceChildren();
    const add=(label:string,run:()=>void,disabled=false,selected=false)=>{
      const b=document.createElement('button');b.type='button';b.textContent=label;b.disabled=disabled;
      if(selected)b.setAttribute('aria-pressed','true');
      b.addEventListener('click',event=>{event.stopPropagation();run();},{signal:this.lifetime.signal});
      this.actions.append(b);
    };
    if(this.phase==='explore'){
      add('ENGAGE GUARD',()=>this.encounter());
      add('WALK TO THE DOOR',()=>{this.moveTarget=new Vector3(0,0,-4);this.paint();});
    }else if(this.phase==='player'){
      add('MOVE · 1 AP',()=>{this.chosen='move';this.message='Tap an open grid tile within 6 m.';this.paint();},this.ap<1||!!this.moveTarget,this.chosen==='move');
      add('SHOOT · 1 AP',()=>this.shoot(),this.ap<1||!!this.moveTarget);
      add('TAKE COVER · 1 AP',()=>this.takeCover(),this.ap<1||!!this.moveTarget);
      add('END TURN',()=>this.endTurn(),!!this.moveTarget);
    }else if(this.phase==='victory'||this.phase==='defeat')add('RETRY BATTLE',()=>this.reset());
    else add('ENEMY ACTING',()=>{},true);
    this.ui.classList.toggle('arrival-combat',this.phase!=='explore');
  }
  setActive(value:boolean):void{
    this.active=value;this.ui.hidden=!value;
    window.dispatchEvent(new CustomEvent('coded:music-cue',{detail:{cue:value?'warship_interior':'silence'}}));
  }
  update(dt:number):void{
    if(!this.active)return;
    this.mixer.update(dt);
    if(this.phase==='explore'){
      const dx=Number(this.keys.has('KeyD')||this.keys.has('ArrowRight'))-Number(this.keys.has('KeyA')||this.keys.has('ArrowLeft'));
      const dz=Number(this.keys.has('KeyS')||this.keys.has('ArrowDown'))-Number(this.keys.has('KeyW')||this.keys.has('ArrowUp'));
      if(dx||dz){this.moveTarget=null;const direction=new Vector3(dx,0,dz).normalize();
        this.hero.position.x=Math.max(-11.7,Math.min(11.7,this.hero.position.x+direction.x*dt*3.5));
        this.hero.position.z=Math.max(-11.7,Math.min(11.7,this.hero.position.z+direction.z*dt*3.5));
        this.hero.rotation.y=Math.atan2(direction.x,direction.z);this.play('Walk');
      }else if(!this.moveTarget)this.play('Idle');
    }
    if(this.moveTarget){
      const delta=this.moveTarget.clone().sub(this.hero.position);
      const distance=delta.length();const direction=delta.clone().normalize();
      if(distance<.12){this.hero.position.copy(this.moveTarget);this.moveTarget=null;this.play('Idle');if(this.phase==='player'&&this.ap===0)this.queueEnemy();}
      else{
        this.hero.position.addScaledVector(direction,Math.min(distance,dt*3.4));
        this.hero.rotation.y=Math.atan2(direction.x,direction.z);this.play('Walk');
      }
    }
    if(this.phase==='explore'&&this.hero.position.distanceTo(this.guard.position)<DOOR_GUARD_TRIGGER_METRES)this.encounter();
    if(this.phase==='enemy'){
      this.enemyClock-=dt;if(this.enemyClock<=0)this.enemyTurn();
    }
    for(let i=this.effects.length-1;i>=0;i--){
      const effect=this.effects[i];effect.left-=dt;
      (effect.mesh.material as MeshBasicMaterial).opacity=Math.max(0,effect.left/.3);
      if(effect.left<=0){this.scene.remove(effect.mesh);effect.mesh.geometry.dispose();(effect.mesh.material as MeshBasicMaterial).dispose();this.effects.splice(i,1);}
    }
    const target=this.hero.position.clone().add(new Vector3(0,.5,0));
    const offset=new Vector3(19,27,25).multiplyScalar(this.zoom);
    this.camera.position.lerp(target.clone().add(offset),1-Math.exp(-dt*4));
    this.camera.lookAt(target);
    this.idle+=dt;
  }
  render():void{
    this.camera.aspect=this.host.root.clientWidth/Math.max(1,this.host.root.clientHeight);
    this.camera.fov=this.camera.aspect<1?62:44;
    this.camera.updateProjectionMatrix();
    this.host.renderer.render(this.scene,this.camera);
  }
  dispose():void{
    this.active=false;this.lifetime.abort();this.ui.remove();
    this.mixer.stopAllAction();this.mixer.uncacheRoot(this.hero);
    for(const effect of this.effects)this.scene.add(effect.mesh);
    disposeObject(this.scene);
  }
}
