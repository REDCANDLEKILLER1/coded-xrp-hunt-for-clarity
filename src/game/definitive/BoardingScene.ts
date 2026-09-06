import { AmbientLight, AnimationMixer, BoxGeometry, Color, CylinderGeometry, DirectionalLight, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, PerspectiveCamera, Plane, Raycaster, Scene, SphereGeometry, Texture, Vector2, Vector3, WebGLRenderer } from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { sfx } from '../audio/Sfx';
import { BoardingQuest, type BoardingRoom, type BoardingStep } from './BoardingQuest';
import { DECK, DECK_DOORS, DECK_LAYOUT, canCross, deckRoom, insideWallMargin, roomAt } from './BoardingLayout';
import { BOARDING_DIALOGUE, Dialogue, type DialogueScene } from './Dialogue';
import { disposeObject } from './ModelAssets';
import type { ManagedScene } from './SceneController';
import { coreExposure, selectBoardingTarget } from './BoardingCombat';

interface Enemy { mesh: Group; tell: Mesh; barrier?: Mesh; room: BoardingRoom; hp: number; clock: number; charge: number; target: Vector3; base: Vector3; kind: 'guard' | 'relay' | 'core' }
interface Bolt { mesh: Mesh; velocity: Vector3; life: number; hostile: boolean; damage: number }
interface SceneHost { renderer: WebGLRenderer; environment: Texture; root: HTMLElement; hud: HTMLElement; quest: BoardingQuest; hero: GLTF; crew: GLTF; onDeparture: () => void }

/** Continuous deck prototype: real skinned actor, measured rooms and finite combat. */
export class BoardingScene implements ManagedScene {
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(43, 1, .1, 220);
  private readonly ui = document.createElement('div');
  private readonly status = document.createElement('div');
  private readonly hint = document.createElement('p');
  private readonly health = document.createElement('div');
  private readonly dialoguePanel = document.createElement('section');
  private readonly dialogueSpeaker = document.createElement('strong');
  private readonly dialogueText = document.createElement('p');
  private readonly dialoguePage = document.createElement('span');
  private readonly map = document.createElement('canvas');
  private readonly dialog = new Dialogue();
  private readonly lifetime = new AbortController();
  private readonly hero: Group;
  private readonly mixer: AnimationMixer;
  private readonly crew: Group;
  private readonly crewMixer: AnimationMixer;
  private readonly crewMarker: Mesh;
  private readonly roomGroups = new Map<BoardingRoom, Group>();
  private readonly terminals = new Map<BoardingRoom, Mesh>();
  private readonly doorPanels: { door: typeof DECK_DOORS[number]; mesh: Mesh }[] = [];
  private readonly enemies: Enemy[] = [];
  private readonly bolts: Bolt[] = [];
  private readonly obstacles: {x:number;z:number;w:number;d:number}[]=[];
  private readonly keys = new Set<string>();
  private readonly ray = new Raycaster();
  private readonly ground = new Plane(new Vector3(0,1,0),0);
  private readonly aim = new Vector3();
  private readonly stick = new Vector2();
  private readonly move = new Vector3();
  private stickPointer: number | null = null;
  private stickOrigin = new Vector2();
  private firingPointer: number | null = null;
  private active = false;
  private paused = false;
  private dead = false;
  private room: BoardingRoom;
  private life = 100;
  private shield = 100;
  private shieldOn = false;
  private clock = 0;
  private fireClock = 0;
  private dodgeClock = 0;
  private dodgeCooldown = 0;
  private invulnerability = 0;
  private clip = '';
  private message = '';
  private messageClock = 0;
  private statsClock = 0;
  private shotsFired = 0;
  private pauseButton: HTMLButtonElement | null = null;
  private coreStarted = false;
  private readonly box = new BoxGeometry(1,1,1);
  private readonly boltGeometry = new SphereGeometry(.09,8,6);
  private readonly metal = new MeshStandardMaterial({ color:0x25303c, roughness:.58, metalness:.68 });
  private readonly floor = new MeshStandardMaterial({ color:0x111923, roughness:.7, metalness:.32 });
  private readonly trim = new MeshStandardMaterial({ color:0x56616c, roughness:.4, metalness:.7 });
  private readonly red = new MeshBasicMaterial({ color:0xff351e, toneMapped:false });
  private readonly green = new MeshBasicMaterial({ color:0x00ff00, toneMapped:false });
  private readonly blue = new MeshBasicMaterial({ color:0x2e8cff, toneMapped:false });
  private readonly barrierMaterial = new MeshBasicMaterial({ color:0xff351e, wireframe:true, transparent:true, opacity:.22, toneMapped:false });
  private readonly heroShield = new Mesh(new SphereGeometry(1,20,12),new MeshBasicMaterial({color:0x00ff00,wireframe:true,transparent:true,opacity:.14,toneMapped:false}));
  private readonly exitField = new Mesh(this.box,this.red);

  constructor(private readonly host: SceneHost) {
    this.paused=host.quest.save.testSlot;
    this.hero = host.hero.scene; this.mixer = new AnimationMixer(this.hero);
    this.crew=host.crew.scene;this.crewMixer=new AnimationMixer(this.crew);
    const idle=host.crew.animations.find(clip=>clip.name==='Idle');if(idle)this.crewMixer.clipAction(idle).play();
    this.crewMarker=new Mesh(new CylinderGeometry(0,.13,.26,4),this.blue);this.scene.add(this.crewMarker);
    this.scene.add(this.crew);
    this.crew.traverse(object=>{if(object instanceof Mesh)for(const material of Array.isArray(object.material)?object.material:[object.material])if(material.name==='TruFi blue')material.toneMapped=false;});
    this.room = host.quest.checkpoint;
    const start=deckRoom(this.room);
    this.hero.position.set(start.x,0,start.z-(this.room==='hangar'?5:start.depth*.3));
    this.scene.background=new Color(0x040911); this.scene.environment=host.environment; this.scene.environmentIntensity=.55;
    this.scene.add(this.hero,new AmbientLight(0xaec4db,1.3));
    this.heroShield.scale.set(.78,1.1,.78);this.heroShield.visible=false;this.scene.add(this.heroShield);
    this.exitField.position.set(0,.025,DECK_LAYOUT.core.exitFieldZ);this.exitField.scale.set(9,.025,.45);this.scene.add(this.exitField);
    const key=new DirectionalLight(0xb9d9ff,2.3);key.position.set(-12,22,-8);this.scene.add(key);
    const rim=new DirectionalLight(0xff7955,1);rim.position.set(10,8,15);this.scene.add(rim);
    this.hero.traverse(obj=>{
      if(!(obj instanceof Mesh))return;
      for(const material of Array.isArray(obj.material)?obj.material:[obj.material]) if(material.name.startsWith('Liquidity'))material.toneMapped=false;
    });
    this.buildDeck(); this.buildUI(); this.bindInput(); this.spawnRoom(this.room);
    this.camera.position.copy(this.hero.position).add(new Vector3(10,15,-14));this.camera.lookAt(this.hero.position);
    this.play('Idle');
    if(!host.quest.save.snapshot.dialogueSeen.includes(BOARDING_DIALOGUE.threshold.id))this.conversation(BOARDING_DIALOGUE.threshold);
  }

  setActive(value:boolean):void { this.active=value; this.ui.hidden=!value; this.clearInput(); }
  private part(parent:Object3D,pos:[number,number,number],size:[number,number,number],material:MeshStandardMaterial|MeshBasicMaterial=this.metal):Mesh {
    const mesh=new Mesh(this.box,material);mesh.position.set(...pos);mesh.scale.set(...size);parent.add(mesh);return mesh;
  }
  private buildDeck():void {
    for(const room of DECK){
      const group=new Group();this.roomGroups.set(room.id,group);this.scene.add(group);
      const nx=Math.floor(room.width/2),nz=Math.floor(room.depth/2);
      const tiles=new InstancedMesh(this.box,this.floor,nx*nz);const matrix=new Matrix4();let i=0;
      for(let x=0;x<nx;x++)for(let z=0;z<nz;z++){
        matrix.makeScale(1.965,.18,1.965);matrix.setPosition(room.x-room.width/2+1+x*2,-.1,room.z-room.depth/2+1+z*2);tiles.setMatrixAt(i++,matrix);
      }group.add(tiles);
      // Low cutaway walls preserve sight of the hero; door lintels show full height.
      const blocks:{position:Vector3;scale:Vector3}[]=[];
      for(const axis of ['x','z'] as const)for(const sign of [-1,1]){
        const along=axis==='x'?room.depth:room.width;const fixed=(axis==='x'?room.x:room.z)+sign*(axis==='x'?room.width:room.depth)/2;
        for(let j=-along/2+.5;j<along/2;j+=1){
          const x=axis==='x'?fixed:room.x+j,z=axis==='z'?fixed:room.z+j;
          if(DECK_DOORS.some(d=>(d.a===room.id||d.b===room.id)&&Math.hypot(x-d.x,z-d.z)<d.width*.6))continue;
          blocks.push({position:new Vector3(x,.6,z),scale:new Vector3(axis==='x'?.25:.99,1.2,axis==='z'?.25:.99)});
        }
      }
      const walls=new InstancedMesh(this.box,this.metal,blocks.length);
      blocks.forEach((block,index)=>{matrix.makeScale(...block.scale.toArray() as [number,number,number]);matrix.setPosition(block.position);walls.setMatrixAt(index,matrix);});group.add(walls);
      const stripe=new InstancedMesh(this.box,this.trim,4);
      [[room.x-room.width/2+.7,room.z,.07,room.depth-1.4],[room.x+room.width/2-.7,room.z,.07,room.depth-1.4],[room.x,room.z-room.depth/2+.7,room.width-1.4,.07],[room.x,room.z+room.depth/2-.7,room.width-1.4,.07]].forEach(([x,z,w,d],index)=>{matrix.makeScale(w,.015,d);matrix.setPosition(x,.006,z);stripe.setMatrixAt(index,matrix);});group.add(stripe);
      const [x,z]=room.terminal;this.part(group,[x,.6,z],[1.3,1.2,.85]);
      this.obstacles.push({x,z,w:1.3,d:.85});
      const terminal=this.part(group,[x,1.23,z],[1.1,.08,.7],this.green);this.terminals.set(room.id,terminal);
      // Functional rooms have distinct machinery rather than recolored boxes.
      if(room.id==='engineering'){
        const cylinder=new Mesh(new CylinderGeometry(1.4,1.4,2.4,16),this.metal);cylinder.position.set(-23,1.2,0);group.add(cylinder);
        this.obstacles.push({x:-23,z:0,w:2.7,d:2.7});
        this.part(group,[-23,2.43,0],[2.3,.06,1.6],this.red);
      }
      if(room.id==='rescue'){
        this.part(group,[6,.35,-3],[4,.7,1.7]);this.part(group,[6,.73,-3],[3.8,.05,1.6],this.blue);
        this.obstacles.push({x:6,z:-3,w:4,d:1.7});
      }
      if(room.id==='bridge')for(const x of [-3.5,3.5]){
        this.part(group,[x,.7,43],[1.6,1.4,1]);this.part(group,[x,1.42,43],[1.4,.04,.8],this.blue);
        this.obstacles.push({x,z:43,w:1.6,d:1});
      }
      if(room.id==='hangar')for(const x of [-5,5])this.part(group,[x,.02,-29],[.12,.03,11],this.green);
    }
    for(const door of DECK_DOORS){
      const frame=new Group();this.scene.add(frame);
      for(const sign of [-1,1])this.part(frame,[door.x+(door.axis==='z'?sign*2:0),1.7,door.z+(door.axis==='x'?sign*2:0)],[.35,3.4,.35],this.trim);
      this.part(frame,[door.x,3.3,door.z],[door.axis==='z'?4.4:.4,.25,door.axis==='x'?4.4:.4],this.trim);
      const panel=this.part(frame,[door.x,1.45,door.z],[door.axis==='z'?door.width:.1,2.9,door.axis==='x'?door.width:.1],this.red);
      this.doorPanels.push({door,mesh:panel});
    }
  }
  private buildUI():void {
    this.ui.className='boarding-ui';this.status.className='boarding-status';this.health.className='boarding-health';this.hint.className='boarding-hint';
    this.status.append(this.health,this.hint);this.map.width=130;this.map.height=170;this.map.className='boarding-map';this.map.setAttribute('aria-label','Warship deck map');
    const controls=document.createElement('div');controls.className='boarding-actions';
    const button=(label:string,action:()=>void,parent:HTMLElement=controls)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.addEventListener('click',e=>{e.stopPropagation();if(this.active)action();},{signal:this.lifetime.signal});parent.appendChild(b);return b;};
    const fire=button('BLAST',()=>{});fire.className='boarding-fire';
    fire.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();if(!this.canAct())return;this.firingPointer=e.pointerId;fire.setPointerCapture(e.pointerId);},{signal:this.lifetime.signal});
    for(const name of ['pointerup','pointercancel','lostpointercapture'])fire.addEventListener(name,e=>{if((e as PointerEvent).pointerId===this.firingPointer)this.firingPointer=null;},{signal:this.lifetime.signal});
    button('INTERACT',()=>this.interact());button('DODGE',()=>this.dodge());
    button('SHIELD',()=>{if(this.host.quest.save.snapshot.heroUpgrades.ledger_shield)this.shieldOn=!this.shieldOn;else this.say('Ledger Shield is earned by defeating the Core.');});
    const top=document.createElement('div');top.className='boarding-top';
    const pause=button('PAUSE',()=>{if(this.ui.querySelector('.boarding-shop'))return;this.paused=!this.paused;pause.textContent=this.paused?'RESUME':'PAUSE';this.clearInput();},top);
    this.pauseButton=pause;
    button('LOG',()=>{const seen=this.host.quest.save.snapshot.dialogueSeen;const lines=(Object.values(BOARDING_DIALOGUE) as readonly DialogueScene[]).filter(d=>seen.includes(d.id)).flatMap(d=>d.lines);if(lines.length)this.conversation({id:'review.dialogue_log',lines},undefined,false);else this.say('No completed conversations yet.');},top);
    const move=document.createElement('div');move.className='boarding-stick';move.textContent='DRAG TO MOVE';move.setAttribute('aria-hidden','true');
    this.dialoguePanel.className='boarding-dialogue';this.dialoguePanel.setAttribute('role','dialog');this.dialoguePanel.setAttribute('aria-label','Conversation');
    this.dialoguePanel.append(this.dialogueSpeaker,this.dialogueText,this.dialoguePage);
    button('CONTINUE',()=>this.dialog.press(),this.dialoguePanel);button('SKIP',()=>this.dialog.skip(),this.dialoguePanel);
    this.ui.append(this.status,this.map,controls,top,move,this.dialoguePanel);this.host.root.appendChild(this.ui);
  }
  private bindInput():void {
    const canvas=this.host.renderer.domElement,options={signal:this.lifetime.signal};
    canvas.addEventListener('pointerdown',event=>{
      if(!this.canAct())return;
      if(event.pointerType==='mouse'){this.firingPointer=event.pointerId;this.mouseAim(event);}
      else if(this.stickPointer===null){this.stickPointer=event.pointerId;this.stickOrigin.set(event.clientX,event.clientY);this.stick.set(0,0);}
      canvas.setPointerCapture(event.pointerId);event.preventDefault();
    },options);
    canvas.addEventListener('pointermove',event=>{
      if(!this.active)return;
      if(event.pointerType==='mouse')this.mouseAim(event);
      if(event.pointerId===this.stickPointer)this.stick.set((event.clientX-this.stickOrigin.x)/48,(event.clientY-this.stickOrigin.y)/48).clampLength(0,1);
    },options);
    const release=(event:PointerEvent)=>{if(event.pointerId===this.stickPointer){this.stickPointer=null;this.stick.set(0,0);}if(event.pointerId===this.firingPointer)this.firingPointer=null;};
    canvas.addEventListener('pointerup',release,options);canvas.addEventListener('pointercancel',release,options);canvas.addEventListener('lostpointercapture',release,options);
    window.addEventListener('keydown',event=>{
      if(!this.active)return;
      if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.code))event.preventDefault();
      if(this.dialog.active){if(!event.repeat&&['Enter','Space'].includes(event.code))this.dialog.press();return;}
      this.keys.add(event.code);
      if(!event.repeat){if(event.code==='KeyE')this.interact();if(event.code==='ShiftLeft')this.dodge();if(event.code==='KeyQ'&&this.host.quest.save.snapshot.heroUpgrades.ledger_shield)this.shieldOn=!this.shieldOn;}
    },options);
    window.addEventListener('keyup',event=>this.keys.delete(event.code),options);
    window.addEventListener('blur',()=>{this.clearInput();if(this.active)this.paused=true;},options);
    document.addEventListener('visibilitychange',()=>{if(document.hidden){this.clearInput();if(this.active)this.paused=true;}},options);
  }
  private mouseAim(event:PointerEvent):void {
    const bounds=this.host.renderer.domElement.getBoundingClientRect();
    this.ray.setFromCamera(new Vector2((event.clientX-bounds.left)/bounds.width*2-1,-(event.clientY-bounds.top)/bounds.height*2+1),this.camera);
    this.ray.ray.intersectPlane(this.ground,this.aim);
  }
  private clearInput():void {
    for(const id of [this.stickPointer,this.firingPointer])if(id!==null)for(const element of [this.host.renderer.domElement,...this.ui.querySelectorAll('button')])if(element.hasPointerCapture(id))element.releasePointerCapture(id);
    this.keys.clear();this.stick.set(0,0);this.stickPointer=null;this.firingPointer=null;
  }
  private canAct():boolean{return this.active&&!this.paused&&!this.dead&&!this.dialog.active&&!this.ui.querySelector('.boarding-shop');}
  private say(text:string):void{this.message=text;this.messageClock=4;}
  private conversation(scene:DialogueScene,step?:BoardingStep,record=true):void {
    this.clearInput();this.play('Idle');
    if(this.crew.visible&&this.hero.position.distanceTo(this.crew.position)<6){
      const delta=this.crew.position.clone().sub(this.hero.position);this.hero.rotation.y=Math.atan2(delta.x,delta.z);this.crew.rotation.y=this.hero.rotation.y+Math.PI;
    }
    this.dialog.open(scene,()=>{
      const result=step&&!this.host.quest.has(step)?this.host.quest.complete(step,scene.id):record?this.host.quest.recordDialogue(scene.id):{ok:true};
      if(result.ok){this.clearInput();return true;}return false;
    });
  }
  private interact():void {
    if(!this.canAct())return;
    const q=this.host.quest;
    if(this.crew.visible&&this.hero.position.distanceTo(this.crew.position)<2.6){
      if(!q.has('rescue_junction'))this.conversation(BOARDING_DIALOGUE.zamn,'rescue_junction');
      else this.say(q.has('bridge_secured')?'MR ZAMN · Shields checked. Use the command terminal when you are ready.':'MR ZAMN · I will hold this route. Restore engineering power.');
      return;
    }
    const room=deckRoom(this.room),distance=Math.hypot(this.hero.position.x-room.terminal[0],this.hero.position.z-room.terminal[1]);
    if(distance>2.5){this.say('Move close to the glowing terminal to interact.');return;}
    switch(this.room){
      case 'hangar':q.complete('hangar_safe');this.say('Bay secured. The security door is open.');break;
      case 'security':if(!q.isClear('security'))this.say('Clear the security detail first.');else{q.complete('security_relay');this.say('Door relay disabled. Crew junction unlocked.');}break;
      case 'rescue':this.say('Mr Zamn is guarding the blue survivor platform. Speak to him.');break;
      case 'engineering':if(!q.isClear('engineering'))this.say('Clear engineering before rerouting power.');else if(!q.has('engineering_power'))this.conversation(BOARDING_DIALOGUE.engineering,'engineering_power');else this.say('Hangar power is restored.');break;
      case 'command':q.complete('command_access');this.say('Core chamber open. Destroy its two relays.');break;
      case 'core':if(q.has('core_defeated'))this.say('Ledger Shield acquired. Activate SHIELD before the bridge exit field.');else this.say('Break both red relays, then strike while the Core is exposed.');break;
      case 'cache':this.say(q.cache().ok?'Cache secured: 100 salvage credits.':q.save.snapshot.heroUpgrades.ledger_shield?'This cache has already been collected.':'Return here with Ledger Shield to open the cache.');break;
      case 'bridge':if(!q.has('bridge_secured'))this.conversation(BOARDING_DIALOGUE.secured,'bridge_secured');else this.openShop();break;
    }
  }
  private openShop():void {
    const panel=document.createElement('section');panel.className='boarding-shop';
    const title=document.createElement('h2');title.textContent='WARSHIP TERMINAL';const balance=document.createElement('p');
    const paint=()=>{balance.textContent=`${this.host.quest.save.snapshot.credits} SALVAGE CREDITS`;};paint();panel.append(title,balance);
    for(const [label,item] of [['Repair hull · 50','repair'],['Shield capacity · 150','shield_module']] as const){
      const b=document.createElement('button');b.textContent=label;b.addEventListener('click',()=>{const result=this.host.quest.purchase(item);if(result.ok){this.say('Installed on the capital ship.');paint();b.disabled=true;}else this.say('Already installed or insufficient salvage.');});panel.appendChild(b);
    }
    const depart=document.createElement('button');depart.textContent='PREPARE DEPARTURE';depart.addEventListener('click',()=>{panel.remove();this.paused=false;this.conversation(BOARDING_DIALOGUE.outbound,'departure_ready');});panel.appendChild(depart);
    const close=document.createElement('button');close.textContent='BACK';close.addEventListener('click',()=>{panel.remove();this.paused=false;this.clearInput();});panel.appendChild(close);
    this.ui.appendChild(panel);this.paused=true;this.clearInput();
  }
  private spawnRoom(room:BoardingRoom):void {
    if(this.host.quest.isClear(room)||this.enemies.some(e=>e.room===room))return;
    for(const [x,z] of deckRoom(room).enemies)this.enemy(room,x,z,'guard');
    if(room==='core'){
      for(const [x,z] of DECK_LAYOUT.core.relays)this.enemy(room,x,z,'relay');
      this.enemy(room,DECK_LAYOUT.core.center[0],DECK_LAYOUT.core.center[1],'core');
      if(!this.coreStarted){this.coreStarted=true;if(!this.host.quest.save.snapshot.dialogueSeen.includes(BOARDING_DIALOGUE.core.id))this.conversation(BOARDING_DIALOGUE.core);}
    }
  }
  private enemy(room:BoardingRoom,x:number,z:number,kind:Enemy['kind']):void {
    const group=new Group();group.position.set(x,kind==='core'?1.8:1.1,z);this.scene.add(group);
    const core=kind==='core',relay=kind==='relay';
    this.part(group,[0,0,0],core?[2.6,2.2,2.6]:relay?[.7,1.6,.7]:[.9,.55,.85]);
    this.part(group,[0,.05,-(core?1.32:.44)],core?[1.8,.5,.07]:[.6,.15,.07],this.red);
    if(!relay)for(const sign of [-1,1])this.part(group,[sign*(core?1.6:.7),-.1,0],core?[.5,.9,2.1]:[.35,.22,.95],this.trim);
    const tell=new Mesh(this.box,this.red);tell.visible=false;this.scene.add(tell);
    let barrier:Mesh|undefined;
    if(core){barrier=new Mesh(new SphereGeometry(2.3,18,12),this.barrierMaterial);group.add(barrier);}
    this.enemies.push({mesh:group,tell,barrier,room,hp:core?650:relay?65:36,clock:.7+this.enemies.length*.3,charge:0,target:new Vector3(),base:group.position.clone(),kind});
  }
  private play(name:string):void {
    if(this.clip===name)return;const clip=this.host.hero.animations.find(a=>a.name===name);if(!clip)return;
    const previous=this.host.hero.animations.find(a=>a.name===this.clip);const action=this.mixer.clipAction(clip).reset().play();
    if(previous)action.crossFadeFrom(this.mixer.clipAction(previous),.12,false);this.clip=name;
  }
  private dodge():void {if(!this.canAct()||this.dodgeCooldown>0)return;this.dodgeClock=.32;this.dodgeCooldown=1.5;this.invulnerability=.36;sfx.play('pulse',.4);}
  private fire(origin:Vector3,direction:Vector3,hostile:boolean,damage=14):void {
    if(!hostile)this.shotsFired++;
    const mesh=new Mesh(this.boltGeometry,hostile?this.red:this.green);mesh.position.copy(origin);this.scene.add(mesh);
    this.bolts.push({mesh,velocity:direction.clone().normalize().multiplyScalar(hostile?9:24),life:2,hostile,damage});sfx.play(hostile?'enemyShoot':'shoot',.4);
  }
  private hurt(amount:number):void {
    if(this.invulnerability>0)return;
    if(this.shieldOn&&this.shield>0){this.shield=Math.max(0,this.shield-amount*2);sfx.play('pulse',.4);return;}
    this.life=Math.max(0,this.life-amount);this.invulnerability=.45;sfx.play('hurt');
    if(this.life===0){this.dead=true;this.clearInput();this.play('KnockdownRecover');this.retryPanel();this.paintHUD();}
  }
  private retryPanel():void {
    const panel=document.createElement('section');panel.className='boarding-shop';const title=document.createElement('h2');title.textContent='RETURN TO CHECKPOINT';
    const text=document.createElement('p');text.textContent='Cleared rooms, collected upgrades and rescued crew remain saved.';
    const button=document.createElement('button');button.textContent='RETRY ROOM';button.addEventListener('click',()=>{
      for(const e of this.enemies.filter(e=>e.room===this.room)){this.scene.remove(e.mesh,e.tell);if(e.barrier)e.barrier.geometry.dispose();}
      for(let i=this.enemies.length-1;i>=0;i--)if(this.enemies[i].room===this.room)this.enemies.splice(i,1);
      for(const b of this.bolts)this.scene.remove(b.mesh);this.bolts.length=0;
      const room=deckRoom(this.room);this.hero.position.set(room.x,0,room.z-room.depth*.32);
      this.life=100;this.shield=100;this.dead=false;this.invulnerability=1;this.spawnRoom(this.room);panel.remove();this.clearInput();
    });panel.append(title,text,button);this.ui.appendChild(panel);
  }
  update(dt:number):void {
    if(!this.active)return;this.dialog.update(dt);
    this.dialoguePanel.hidden=!this.dialog.active;this.dialogueSpeaker.textContent=this.dialog.speaker;
    this.ui.classList.toggle('is-conversation',this.dialog.active);
    this.dialogueText.textContent=this.dialog.text;this.dialoguePage.textContent=this.dialog.failed?'Save failed. Retry CONTINUE or SKIP.':this.dialog.page;
    const crewInHub=this.host.quest.has('bridge_secured');
    const crewPosition=crewInHub?DECK_LAYOUT.crew.hub:DECK_LAYOUT.crew.rescue;
    this.crew.position.set(crewPosition[0],0,crewPosition[1]);this.crew.visible=this.room===(crewInHub?'bridge':'rescue');
    this.crewMarker.visible=this.crew.visible&&!this.host.quest.has('rescue_junction');this.crewMarker.position.copy(this.crew.position).y=2.4;
    if(this.dialog.active){
      this.mixer.update(dt);this.crewMixer.update(dt);
      const focus=this.hero.position.clone();if(this.crew.visible&&focus.distanceTo(this.crew.position)<6)focus.lerp(this.crew.position,.5);
      this.camera.position.lerp(focus.clone().add(new Vector3(4,4.6,-7)),1-Math.exp(-dt*5));this.camera.lookAt(focus);
    }
    if(this.dead){this.mixer.update(dt);return;}
    if(this.paused||this.dialog.active||this.ui.querySelector('.boarding-shop')){this.paintHUD();return;}
    this.clock+=dt;this.fireClock-=dt;this.dodgeClock=Math.max(0,this.dodgeClock-dt);this.dodgeCooldown=Math.max(0,this.dodgeCooldown-dt);this.invulnerability=Math.max(0,this.invulnerability-dt);this.messageClock-=dt;
    this.crewMixer.update(dt);
    if(this.crew.visible){const direction=this.hero.position.clone().sub(this.crew.position);const angle=Math.atan2(direction.x,direction.z);this.crew.rotation.y+=Math.atan2(Math.sin(angle-this.crew.rotation.y),Math.cos(angle-this.crew.rotation.y))*Math.min(1,dt*2);}
    if(this.shieldOn){this.shield=Math.max(0,this.shield-dt*6);if(!this.shield)this.shieldOn=false;}else this.shield=Math.min(100,this.shield+dt*14);
    this.heroShield.visible=this.shieldOn;this.heroShield.position.copy(this.hero.position).y+=1;
    this.exitField.material=this.host.quest.has('bridge_secured')?this.green:this.red;
    const x=this.stick.x+Number(this.keys.has('KeyD')||this.keys.has('ArrowRight'))-Number(this.keys.has('KeyA')||this.keys.has('ArrowLeft'));
    const y=this.stick.y+Number(this.keys.has('KeyS')||this.keys.has('ArrowDown'))-Number(this.keys.has('KeyW')||this.keys.has('ArrowUp'));
    const right=new Vector3().setFromMatrixColumn(this.camera.matrixWorld,0);right.y=0;right.normalize();
    const back=new Vector3().setFromMatrixColumn(this.camera.matrixWorld,2);back.y=0;back.normalize();
    this.move.copy(right).multiplyScalar(x).addScaledVector(back,y).clampLength(0,1);
    if(this.dodgeClock>0&&this.move.lengthSq()<.01)this.move.set(Math.sin(this.hero.rotation.y),0,Math.cos(this.hero.rotation.y));
    const distance=(this.dodgeClock>0?8:3.7)*dt;
    for(const axis of ['x','z'] as const){
      const target=this.hero.position.clone();target[axis]+=this.move[axis]*distance;const next=roomAt(target.x,target.z);
      if(!next||!insideWallMargin(next,target.x,target.z)||!canCross(this.room,next.id,target.x,target.z))continue;
      if(this.obstacles.some(o=>Math.abs(target.x-o.x)<o.w/2+.3&&Math.abs(target.z-o.z)<o.d/2+.3))continue;
      if(this.crew.visible&&target.distanceTo(this.crew.position)<.85)continue;
      if(this.enemies.some(e=>e.room===this.room&&e.hp>0&&Math.hypot(target.x-e.mesh.position.x,target.z-e.mesh.position.z)<(e.kind==='core'?2.2:.72)))continue;
      const reason=this.host.quest.lockReason(next.id);
      if(reason){this.say(reason);continue;}
      if(next.id!==this.room){const result=this.host.quest.enter(next.id);if(!result.ok){this.say('Checkpoint could not be saved. Retry after storage is available.');continue;}this.room=next.id;this.spawnRoom(next.id);}
      this.hero.position.copy(target);
    }
    const firing=this.firingPointer!==null||this.keys.has('Space');
    const target=selectBoardingTarget(this.enemies.filter(e=>e.room===this.room).map(e=>({enemy:e,kind:e.kind,hp:e.hp,x:e.mesh.position.x,z:e.mesh.position.z})),this.hero.position.x,this.hero.position.z)?.enemy;
    let direction=this.move.clone();
    if(firing){const point=target?.mesh.position??this.aim;direction.copy(point).sub(this.hero.position);direction.y=0;}
    if(direction.lengthSq()>.001){const desired=Math.atan2(direction.x,direction.z);this.hero.rotation.y+=Math.atan2(Math.sin(desired-this.hero.rotation.y),Math.cos(desired-this.hero.rotation.y))*Math.min(1,dt*14);}
    this.play(this.dodgeClock>0?'Dodge':firing?'AimFire':this.move.lengthSq()>.04?'Run':'Idle');this.mixer.update(dt);this.hero.updateMatrixWorld(true);
    if(firing&&this.fireClock<=0){this.fireClock=.23;const origin=this.hero.getObjectByName('Hand_R')!.getWorldPosition(new Vector3());const point=target?.mesh.position.clone()??origin.clone().add(new Vector3(Math.sin(this.hero.rotation.y),0,Math.cos(this.hero.rotation.y)).multiplyScalar(15));this.fire(origin,point.sub(origin),false);}
    this.updateEnemies(dt);this.updateBolts(dt);
    if(this.room==='bridge'&&!this.host.quest.has('bridge_secured')&&this.hero.position.z<DECK_LAYOUT.core.exitFieldZ+1&&!this.shieldOn){this.hurt(2);this.say('Activate Ledger Shield to cross this low-power exit field.');}
    const focus=this.hero.position.clone().add(new Vector3(0,.7,0));
    if(this.room==='core')focus.lerp(new Vector3(deckRoom('core').x,.7,deckRoom('core').z),.4);
    const offset=new Vector3(9,14,-12).multiplyScalar(this.room==='core'&&this.camera.aspect<1?1.15:1);
    const cameraTarget=focus.clone().add(offset);this.camera.position.lerp(cameraTarget,1-Math.exp(-dt*7));this.camera.lookAt(focus);
    this.statsClock+=dt;if(this.statsClock>.1){this.paintHUD();this.statsClock=0;}
  }
  private updateEnemies(dt:number):void {
    let attackers=this.enemies.filter(e=>e.room===this.room&&e.charge>0).length;
    for(const enemy of this.enemies){
      enemy.mesh.visible=enemy.room===this.room;
      enemy.tell.visible=enemy.room===this.room&&enemy.hp>0&&enemy.charge>0;
      if(enemy.barrier)enemy.barrier.visible=!this.coreExposed();
      if(enemy.room!==this.room||enemy.hp<=0)continue;
      if(enemy.kind==='relay')continue;
      enemy.clock-=dt;
      if(enemy.kind==='guard'){enemy.mesh.position.x=enemy.base.x+Math.sin(this.clock*.8+enemy.base.z)*.65;enemy.mesh.position.y=enemy.base.y+Math.sin(this.clock*2)*.08;}
      else enemy.mesh.rotation.y+=dt*.25;
      if(enemy.charge>0){enemy.charge-=dt;enemy.mesh.scale.setScalar(1+Math.sin(this.clock*24)*.035);
        const direction=enemy.target.clone().sub(enemy.mesh.position);direction.y=0;
        enemy.tell.position.copy(enemy.mesh.position).addScaledVector(direction,.5);enemy.tell.position.y=.035;
        enemy.tell.rotation.y=Math.atan2(direction.x,direction.z);enemy.tell.scale.set(.18+.12*Math.sin(this.clock*18)**2,.025,direction.length());
        if(enemy.charge<=0){const origin=enemy.mesh.position.clone();const direction=enemy.target.clone().sub(origin);this.fire(origin,direction,true,enemy.kind==='core'?18:10);if(enemy.kind==='core')for(const s of [-1,1])this.fire(origin,direction.clone().applyAxisAngle(new Vector3(0,1,0),s*.28),true,15);enemy.clock=enemy.kind==='core'?1.8:2.6;enemy.mesh.scale.setScalar(1);}
      }else if(enemy.clock<=0&&attackers<2&&this.onScreen(enemy.mesh.position)){enemy.charge=.85;enemy.target.copy(this.hero.position).add(new Vector3(0,1.1,0));attackers++;}
    }
  }
  private updateBolts(dt:number):void {
    const remove=(index:number)=>{this.scene.remove(this.bolts[index].mesh);this.bolts.splice(index,1);};
    for(let i=this.bolts.length-1;i>=0;i--){
      const bolt=this.bolts[i],start=bolt.mesh.position.clone();bolt.mesh.position.addScaledVector(bolt.velocity,dt);bolt.life-=dt;
      const end=bolt.mesh.position;
      const swept=(target:Vector3,radius:number)=>{const v=end.clone().sub(start);const t=Math.max(0,Math.min(1,target.clone().sub(start).dot(v)/Math.max(.00001,v.lengthSq())));return start.clone().addScaledVector(v,t).distanceTo(target)<radius;};
      if(bolt.hostile){if(swept(this.hero.position.clone().add(new Vector3(0,1,0)),.75)){this.hurt(bolt.damage);remove(i);continue;}}
      else{
        const hit=this.enemies.find(e=>e.room===this.room&&e.hp>0&&swept(e.mesh.position,e.kind==='core'?1.7:.8));
        if(hit){const exposed=hit.kind!=='core'||this.coreExposed();
          if(exposed){hit.hp-=bolt.damage;sfx.play('hit',.5);}else this.say('Core shield active. Relays first; strike during the exposure window.');
          if(hit.hp<=0){this.scene.remove(hit.mesh,hit.tell);sfx.play('explode',.6);}
          remove(i);continue;
        }
      }
      const next=roomAt(end.x,end.z);if(bolt.life<=0||!next||next.id!==this.room||!insideWallMargin(next,end.x,end.z,0))remove(i);
    }
    if(['security','engineering','core'].includes(this.room)&&!this.host.quest.isClear(this.room)&&this.enemies.some(e=>e.room===this.room)&&!this.enemies.some(e=>e.room===this.room&&e.hp>0)){
      const result=this.room==='core'?this.host.quest.defeatCore():this.host.quest.clear(this.room);
      if(result.ok){this.life=Math.min(100,this.life+25);this.say(this.room==='core'?'Ledger Shield acquired. Activate SHIELD at the bridge exit.':'Room secured. Checkpoint saved.');}
    }
  }
  private paintHUD():void {
    if(this.pauseButton)this.pauseButton.textContent=this.paused?'RESUME':'PAUSE';
    if(this.host.quest.save.testSlot){
      this.ui.dataset.room=this.room;this.ui.dataset.x=this.hero.position.x.toFixed(3);this.ui.dataset.z=this.hero.position.z.toFixed(3);
      this.ui.dataset.shots=String(this.shotsFired);this.ui.dataset.firing=String(this.firingPointer!==null||this.keys.has('Space'));
      this.ui.dataset.drawCalls=String(this.host.renderer.info.render.calls);this.ui.dataset.triangles=String(this.host.renderer.info.render.triangles);
      this.ui.dataset.geometries=String(this.host.renderer.info.memory.geometries);this.ui.dataset.textures=String(this.host.renderer.info.memory.textures);
    }
    const q=this.host.quest;const core=this.enemies.find(e=>e.kind==='core'&&e.hp>0);
    this.health.textContent=`${deckRoom(this.room).title}   VITALS ${Math.ceil(this.life)}${q.save.snapshot.heroUpgrades.ledger_shield?`   SHIELD ${Math.ceil(this.shield)}${this.shieldOn?' · ACTIVE':''}`:''}${this.paused?'   PAUSED':''}${this.room==='core'&&core?`   CORE ${Math.ceil(core.hp)} · ${this.coreExposed()?'EXPOSED':'SHIELDED'}`:''}`;
    this.hint.textContent=this.messageClock>0?this.message:q.objective;
    for(const {door,mesh} of this.doorPanels)mesh.visible=!!q.lockReason(door.b);
    for(const [id,group] of this.roomGroups)group.visible=Math.hypot(deckRoom(id).x-this.hero.position.x,deckRoom(id).z-this.hero.position.z)<35;
    const ctx=this.map.getContext('2d');if(!ctx)return;ctx.clearRect(0,0,130,170);ctx.fillStyle='#07101bd9';ctx.fillRect(0,0,130,170);
    for(const room of DECK){ctx.fillStyle=room.id===this.room?'#00a822':q.lockReason(room.id)?'#70241f':'#243a4c';ctx.fillRect(65+(room.x-room.width/2)*2.2,159-(room.z+room.depth/2+37)*1.8,room.width*2.2-1,room.depth*1.8-1);}
    ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(65+this.hero.position.x*2.2,159-(this.hero.position.z+37)*1.8,2.4,0,Math.PI*2);ctx.fill();
  }
  private coreExposed():boolean{return coreExposure(this.enemies.some(e=>e.room==='core'&&e.kind==='relay'&&e.hp>0),this.clock);}
  private onScreen(position:Vector3):boolean{const p=position.clone().project(this.camera);return Math.abs(p.x)<.92&&Math.abs(p.y)<.8&&p.z>-1&&p.z<1;}
  render():void {this.camera.aspect=this.host.root.clientWidth/Math.max(1,this.host.root.clientHeight);this.camera.fov=this.camera.aspect<1?49:43;this.camera.updateProjectionMatrix();this.host.renderer.render(this.scene,this.camera);}
  dispose():void {
    this.active=false;this.clearInput();this.lifetime.abort();this.mixer.stopAllAction();this.mixer.uncacheRoot(this.hero);this.crewMixer.stopAllAction();this.crewMixer.uncacheRoot(this.crew);this.dialog.closeWithoutEffects();this.ui.remove();
    // Include pooled/dead objects so shared GPU resources are released exactly once.
    for(const enemy of this.enemies)this.scene.add(enemy.mesh,enemy.tell);
    this.scene.add(new Mesh(this.boltGeometry,this.red),new Mesh(this.box,this.barrierMaterial));
    disposeObject(this.scene);
  }
}
