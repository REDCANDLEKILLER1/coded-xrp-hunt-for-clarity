import { AmbientLight, AnimationMixer, BoxGeometry, CanvasTexture, Color, CylinderGeometry, DirectionalLight, DoubleSide, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, PerspectiveCamera, Plane, PlaneGeometry, PointLight, Raycaster, Scene, SphereGeometry, SRGBColorSpace, Texture, TextureLoader, Vector2, Vector3, WebGLRenderer } from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { sfx } from '../audio/Sfx';
import { BoardingQuest, type BoardingRoom, type BoardingStep } from './BoardingQuest';
import { DECK, DECK_DOORS, DECK_LAYOUT, canCross, deckRoom, insideWallMargin, roomAt } from './BoardingLayout';
import { BOARDING_DIALOGUE, Dialogue, type DialogueScene } from './Dialogue';
import { disposeObject } from './ModelAssets';
import type { ManagedScene } from './SceneController';
import { boardingObstacleBlocksMove, boardingEnemyDamage, boardingEnemyHealth, boardingEnemyVolley, boardingInteraction, boardingPressure, boardingWeapon, canCrossExitField, companionGait, companionPlan, coreExposure, sapperRangeMove, selectBoardingTarget, type BoardingEnemyKind } from './BoardingCombat';
import { PARKED_HEIGHT } from './LandingPlan';

interface Enemy { mesh: Group; tell: Mesh; barrier?: Mesh; room: BoardingRoom; hp: number; maxHp:number; clock: number; charge: number; target: Vector3; base: Vector3; tactic: number; kind: BoardingEnemyKind }
interface Bolt { mesh: Mesh; velocity: Vector3; life: number; owner: 'hero' | 'crew' | 'enemy'; damage: number }
interface SceneHost { renderer: WebGLRenderer; environment: Texture; root: HTMLElement; hud: HTMLElement; quest: BoardingQuest; hero: GLTF; crew: GLTF; fighter: GLTF; deck:GLTF; entryRoom?:BoardingRoom; onDeparture: () => void }

/** Continuous deck prototype: real skinned actor, measured rooms and finite combat. */
export class BoardingScene implements ManagedScene {
  private readonly scene = new Scene();
  private readonly keyLight = new DirectionalLight(0xc4d9e7,2);
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
  private crewRoom: BoardingRoom | null = null;
  private crewClip = '';
  private crewFireClock = 0;
  private crewActionClock = 0;
  private readonly roomGroups = new Map<BoardingRoom, Group>();
  private readonly roomLights = new Map<BoardingRoom, Mesh[]>();
  private factionRevision = -1;
  private readonly terminals = new Map<BoardingRoom, Mesh>();
  private readonly doorPanels: { door: typeof DECK_DOORS[number]; mesh: Mesh }[] = [];
  private readonly enemies: Enemy[] = [];
  private readonly bolts: Bolt[] = [];
  private readonly obstacles: {x:number;z:number;w:number;d:number;cover?:boolean}[]=[];
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
  private crewShotsFired = 0;
  private verticalVelocity = 0;
  private meleeClock = 0;
  private meleeCombo = 0;
  private jumpCount = 0;
  private hiddenPanel: Group | null = null;
  private readonly factionLights: PointLight[] = [];
  private readonly floorMaterials: MeshBasicMaterial[] = [];
  private readonly wallMaterials: MeshBasicMaterial[] = [];
  private pauseButton: HTMLButtonElement | null = null;
  private coreStarted = false;
  private captureClock = 0;
  private readonly box = new BoxGeometry(1,1,1);
  private readonly boltGeometry = new SphereGeometry(.09,8,6);
  private readonly metal = new MeshStandardMaterial({ color:0x25303c, roughness:.58, metalness:.68 });
  private readonly trim = new MeshStandardMaterial({ color:0x56616c, roughness:.4, metalness:.7 });
  private readonly red = new MeshBasicMaterial({ color:0xff351e, toneMapped:false });
  private readonly green = new MeshBasicMaterial({ color:0x00ff00, toneMapped:false });
  private readonly blue = new MeshBasicMaterial({ color:0x2e8cff, toneMapped:false });
  private readonly barrierMaterial = new MeshBasicMaterial({ color:0xff351e, wireframe:true, transparent:true, opacity:.22, toneMapped:false });
  private readonly bossMetal = new MeshStandardMaterial({color:0x42151b,roughness:.34,metalness:.82});
  private readonly heroShield = new Mesh(new SphereGeometry(1,20,12),new MeshBasicMaterial({color:0x00ff00,wireframe:true,transparent:true,opacity:.14,toneMapped:false}));
  private readonly exitField = new Mesh(this.box,this.red);

  constructor(private readonly host: SceneHost) {
    this.paused=host.quest.save.testSlot;
    this.hero = host.hero.scene; this.mixer = new AnimationMixer(this.hero);
    this.crew=host.crew.scene;this.crewMixer=new AnimationMixer(this.crew);
    this.playCrew('Idle');
    this.crewMarker=new Mesh(new CylinderGeometry(0,.13,.26,4),this.green);this.scene.add(this.crewMarker);
    this.scene.add(this.crew);
    this.crew.traverse(object=>{if(object instanceof Mesh)for(const material of Array.isArray(object.material)?object.material:[object.material])if(material.name==='TruFi blue')material.toneMapped=false;});
    this.room = host.entryRoom ?? host.quest.checkpoint;
    const start=deckRoom(this.room);
    this.hero.position.set(start.x,0,start.z-(this.room==='hangar'?5:this.room==='bridge'?start.depth*.5-.55:start.depth*.3));
    const fighter=host.fighter.scene;
    fighter.position.set(DECK_LAYOUT.landing.center[0],PARKED_HEIGHT,DECK_LAYOUT.landing.center[1]);
    const canopy=fighter.getObjectByName('Canopy_Hinge');if(canopy)canopy.rotation.x=-1.15;
    fighter.updateMatrixWorld(true);this.scene.add(fighter);
    if(this.room==='hangar'){
      const exit=fighter.getObjectByName('Pilot_Exit');if(exit)exit.getWorldPosition(this.hero.position);
      this.hero.position.y=0;
    }
    fighter.traverse(o=>{if(o instanceof Mesh)for(const m of Array.isArray(o.material)?o.material:[o.material])if(m.name.startsWith('Liquidity'))m.toneMapped=false;});
    this.obstacles.push({x:0,z:-28,w:1.85,d:8.8},{x:0,z:-30.4,w:7.1,d:2.8});
    this.scene.background=new Color(0x040911); this.scene.environment=host.environment; this.scene.environmentIntensity=.35;
    this.scene.add(this.hero,new AmbientLight(0xaec4db,.4));
    const liquidityLight=new PointLight(0x00ff00,7,7,2);liquidityLight.position.set(0,1.2,.25);this.hero.add(liquidityLight);
    this.heroShield.scale.set(.78,1.1,.78);this.heroShield.visible=false;this.scene.add(this.heroShield);
    this.exitField.position.set(0,.025,DECK_LAYOUT.core.exitFieldZ);this.exitField.scale.set(9,.025,.45);this.scene.add(this.exitField);
    const key=this.keyLight;key.castShadow=true;key.shadow.mapSize.set(1024,1024);
    Object.assign(key.shadow.camera,{left:-14,right:14,top:14,bottom:-14,near:1,far:55});key.shadow.bias=-.0002;key.shadow.normalBias=.025;
    key.shadow.camera.updateProjectionMatrix();
    this.scene.add(key,key.target);
    const rim=new DirectionalLight(0x6c91b9,.7);rim.position.set(10,8,15);this.scene.add(rim);
    this.hero.traverse(obj=>{
      if(!(obj instanceof Mesh))return;
      for(const material of Array.isArray(obj.material)?obj.material:[obj.material]) if(material.name.startsWith('Liquidity'))material.toneMapped=false;
    });
    this.buildDeck(); this.buildUI(); this.bindInput(); this.spawnRoom(this.room);
    this.scene.traverse(object=>{if(object instanceof Mesh&&!(object.material instanceof MeshBasicMaterial)){object.castShadow=true;object.receiveShadow=true;}});
    // Flat plates and trim receive contact shadows; only the pressure walls need
    // to cast them. This avoids redrawing the entire deck into the shadow map.
    host.deck.scene.traverse(object=>{if(object instanceof Mesh)object.castShadow=object.material instanceof MeshStandardMaterial&&object.material.name==='Deck carbon ceramic';});
    this.camera.position.copy(this.hero.position).add(new Vector3(10,15,-14));this.camera.lookAt(this.hero.position);
    this.play('Idle');
    if(!host.quest.save.snapshot.dialogueSeen.includes(BOARDING_DIALOGUE.threshold.id))this.conversation(BOARDING_DIALOGUE.threshold);
  }

  setActive(value:boolean):void { this.active=value; this.ui.hidden=!value; this.clearInput(); }
  private part(parent:Object3D,pos:[number,number,number],size:[number,number,number],material:MeshStandardMaterial|MeshBasicMaterial=this.metal):Mesh {
    const mesh=new Mesh(this.box,material);mesh.position.set(...pos);mesh.scale.set(...size);mesh.castShadow=material instanceof MeshStandardMaterial;mesh.receiveShadow=mesh.castShadow;parent.add(mesh);return mesh;
  }
  private buildRoomArt(parent:Object3D,room:typeof DECK[number]):void {
    const backgrounds:Record<BoardingRoom,string>={
      hangar:'/assets/interior/regulatory_docking_bay.webp',security:'/assets/interior/regulatory_security_checkpoint.webp',
      rescue:'/assets/interior/regulatory_security_atrium.webp',engineering:'/assets/interior/regulatory_maintenance_shaft.webp',
      cache:'/assets/interior/regulatory_field_control.webp',command:'/assets/interior/regulatory_defense_deck.webp',
      core:'/assets/interior/regulatory_core_chamber.webp',bridge:'/assets/interior/regulatory_bridge_arena.webp',
    };
    const wallTexture=new TextureLoader().load(backgrounds[room.id]);wallTexture.colorSpace=SRGBColorSpace;
    const wallMaterial=new MeshBasicMaterial({map:wallTexture,color:0xff8c86,side:DoubleSide,toneMapped:false});this.wallMaterials.push(wallMaterial);
    const panel=new Mesh(new PlaneGeometry(Math.min(12,room.width*.8),2.7),wallMaterial);
    panel.position.set(room.x,1.62,room.z+room.depth/2-.08);panel.rotation.y=Math.PI;parent.add(panel);
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;const ctx=canvas.getContext('2d');if(!ctx)return;
    ctx.fillStyle='#07111c';ctx.fillRect(0,0,512,256);ctx.strokeStyle='#ffffff';ctx.lineWidth=18;ctx.strokeRect(12,12,488,232);
    ctx.strokeStyle='#ffffff';ctx.lineWidth=5;for(let x=-80;x<560;x+=64){ctx.beginPath();ctx.moveTo(x,232);ctx.lineTo(x+46,24);ctx.stroke();}
    ctx.fillStyle='#07111c';ctx.fillRect(52,78,408,100);ctx.strokeStyle='#d9ecff';ctx.lineWidth=9;ctx.beginPath();for(let i=0;i<6;i++){const a=Math.PI/3*i-Math.PI/6,x=256+Math.cos(a)*64,y=128+Math.sin(a)*42;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.closePath();ctx.stroke();
    ctx.strokeStyle='#ffffff';ctx.lineWidth=12;ctx.beginPath();ctx.moveTo(226,98);ctx.lineTo(286,158);ctx.moveTo(286,98);ctx.lineTo(226,158);ctx.stroke();
    const floorTexture=new CanvasTexture(canvas);floorTexture.colorSpace=SRGBColorSpace;
    const floorMaterial=new MeshBasicMaterial({map:floorTexture,color:0xff351e,transparent:true,opacity:.78,side:DoubleSide,toneMapped:false});this.floorMaterials.push(floorMaterial);
    const floor=new Mesh(new PlaneGeometry(Math.min(room.width*.66,11),Math.min(room.depth*.25,3.2)),floorMaterial);
    floor.rotation.set(-Math.PI/2,0,Math.PI);floor.position.set(room.x,.025,room.z);parent.add(floor);
  }
  private buildObjectiveLandmark(parent:Object3D,room:typeof DECK[number]):void {
    const [x,z]=room.terminal,structure=new Group();parent.add(structure);
    // Every objective has a physical alcove, overhead frame, task light and floor plinth.
    this.part(structure,[x-1.15,1.45,z+.42],[.18,2.9,.5],this.trim);this.part(structure,[x+1.15,1.45,z+.42],[.18,2.9,.5],this.trim);
    this.part(structure,[x,2.82,z+.42],[2.45,.2,.5],this.metal);this.part(structure,[x,.09,z],[3,.16,2.2],this.bossMetal);
    const taskLight=new PointLight(0xff2418,4,6,2);taskLight.position.set(x,2.35,z-.55);structure.add(taskLight);this.factionLights.push(taskLight);
    if(room.id==='hangar'){
      for(const sign of [-1,1]){this.part(structure,[x+sign*2.1,1.25,z],[.32,2.5,.32],this.trim);this.part(structure,[x+sign*2.1,2.55,z],[.55,.16,.55],this.red);}
      this.part(structure,[x,2.48,z],[4.5,.2,.35],this.metal);this.part(structure,[x,.2,z-1.4],[4.8,.05,.12],this.green);
    }else if(room.id==='security'){
      for(const sign of [-1,1]){const relay=new Mesh(new CylinderGeometry(.38,.52,2.45,12),this.bossMetal);relay.position.set(x+sign*2,1.22,z+.25);structure.add(relay);this.part(structure,[x+sign*2,2.12,z+.25],[.55,.16,.55],this.red);}
      this.part(structure,[x,1.85,z+.55],[3.6,.12,.2],this.blue);
    }else if(room.id==='rescue'){
      const secret=new Group();parent.add(secret);this.hiddenPanel=secret;
      this.part(secret,[10.35,1.35,6.8],[2.8,2.7,.34],this.bossMetal);for(const sign of [-1,1])this.part(secret,[10.35+sign*1.28,1.45,6.52],[.14,2.9,.18],this.red);
      this.part(secret,[10.35,.08,6.25],[3.15,.08,1.45],this.red);this.part(secret,[10.35,2.7,6.5],[3,.18,.4],this.trim);
      for(const sign of [-1,1])this.part(structure,[x+sign*2.05,.75,z],[.7,1.5,1.2],this.metal);
    }else if(room.id==='engineering'){
      for(const sign of [-1,1]){const coil=new Mesh(new CylinderGeometry(.55,.55,2.6,16),this.bossMetal);coil.position.set(x+sign*2,1.3,z+.15);structure.add(coil);for(const y of [.45,1.05,1.65,2.25])this.part(structure,[x+sign*2,y,z+.15],[1.25,.08,1.25],this.red);}
      this.part(structure,[x,2.35,z+.8],[4.4,.18,.25],this.trim);
    }else if(room.id==='cache'){
      this.part(structure,[x,1.45,z+.75],[4.6,2.9,.45],this.bossMetal);for(const sign of [-1,1])this.part(structure,[x+sign*1.65,1.45,z+.48],[.16,2.45,.14],this.red);
      this.part(structure,[x,.3,z-.9],[3.8,.22,.7],this.trim);
    }else if(room.id==='command'){
      const table=new Mesh(new CylinderGeometry(1.45,1.65,.78,8),this.bossMetal);table.position.set(x+3.25,.39,z);structure.add(table);
      const holo=new Mesh(new CylinderGeometry(.75,1.15,.05,24),this.blue);holo.position.set(x+3.25,.84,z);structure.add(holo);this.obstacles.push({x:x+3.25,z,w:3.1,d:3.1,cover:true});
      for(const [px,pz,sx,sz] of [[x+2,z-1.55,4,.12],[x+5.85,z+.4,.12,4],[x+5.45,z+2.35,.9,.12]])this.part(structure,[px,.035,pz],[sx,.03,sz],this.blue);
      for(const sign of [-1,1])this.part(structure,[x+sign*1.65,2.1,z+.55],[.12,1.25,.12],this.red);
    }else if(room.id==='core'){
      for(const sign of [-1,1]){this.part(structure,[x+sign*2.15,1.4,z+.3],[.55,2.8,.55],this.bossMetal);this.part(structure,[x+sign*2.15,1.4,z-.02],[.14,2.25,.14],this.red);}
      this.part(structure,[x,2.55,z+.5],[4.8,.22,.5],this.trim);
    }else{
      // The bridge terminal sits on a command dais with a layered approach and flanking data towers.
      this.part(structure,[x,.13,z-.5],[5,.24,3.4],this.bossMetal);this.part(structure,[x,.3,z-2.05],[3.7,.18,.55],this.trim);this.part(structure,[x,.46,z-2.42],[2.8,.18,.55],this.trim);
      for(const sign of [-1,1]){this.part(structure,[x+sign*2.05,1.35,z+.4],[.65,2.7,.65],this.metal);this.part(structure,[x+sign*2.05,1.55,z-.02],[.4,1.4,.08],this.blue);}
      this.part(structure,[x,2.75,z+.65],[4.8,.24,.65],this.trim);
    }
  }
  private addConsole(parent:Object3D,x:number,z:number,rotation=0):void {
    const console=new Group();console.position.set(x,0,z);console.rotation.y=rotation;parent.add(console);
    this.part(console,[0,.42,0],[1.7,.84,.9],this.bossMetal);
    const screen=this.part(console,[0,.9,-.08],[1.42,.07,.68],this.blue);screen.rotation.x=-.48;
    this.part(console,[-.62,.95,-.46],[.14,.12,.08],this.red);this.part(console,[.62,.95,-.46],[.14,.12,.08],this.red);
    this.obstacles.push({x,z,w:rotation?1:1.7,d:rotation?1.7:1,cover:true});
  }
  private addCover(parent:Object3D,x:number,z:number,w:number,d:number):void {
    this.part(parent,[x,.36,z],[w,.72,d]);this.part(parent,[x,.74,z],[w*.9,.05,d*.86],this.blue);
    this.obstacles.push({x,z,w,d,cover:true});
  }  private buildDeck():void {
    this.scene.add(this.host.deck.scene);
    const replacedLights = new Set<MeshStandardMaterial>();
    const cover:Partial<Record<BoardingRoom,readonly [number,number,number,number][]>>={
      hangar:[[-6,-28,2.4,1],[6,-28,2.4,1]],security:[[0,-16,2.8,.9]],rescue:[[0,-2,3,.9],[0,4,2.4,.9]],
      engineering:[[-18,0,2.8,1]],cache:[[18,-2,2.8,1],[18,3,2.2,.9]],command:[[0,13,3,.9],[6,16,2,.8]],
      core:[[-6,30,2.2,.9],[6,30,2.2,.9]],bridge:[[0,38,2.6,.9]],
    };
    for(const room of DECK){
      const group=this.host.deck.scene.getObjectByName('Deck_'+room.id) as Group;
      if(!group)throw new Error('Missing architecture room: '+room.id);
      this.roomGroups.set(room.id,group);
      const serviceLights:Mesh[]=[];
      group.traverse(object=>{if(object instanceof Mesh&&object.material instanceof MeshStandardMaterial&&object.material.name==='Deck warm working light'){replacedLights.add(object.material);object.material=this.red;serviceLights.push(object);}});
      this.roomLights.set(room.id,serviceLights);
      const alarm=new PointLight(0xff2418,5,Math.max(room.width,room.depth)*1.25,2);alarm.position.set(room.x,2.7,room.z);group.add(alarm);this.factionLights.push(alarm);
      for(const sign of [-1,1])this.part(group,[room.x+sign*room.width*.42,1.55,room.z+room.depth*.42],[.55,3.1,1.1],this.trim);
      this.buildRoomArt(group,room);
      for(const [x,z,w,d] of cover[room.id]??[])this.addCover(group,x,z,w,d);
      const [x,z]=room.terminal;this.part(group,[x,.6,z],[1.3,1.2,.85]);
      this.obstacles.push({x,z,w:1.3,d:.85,cover:true});
      const terminal=this.part(group,[x,1.23,z],[1.1,.08,.7],this.red);this.terminals.set(room.id,terminal);
      this.addConsole(group,x+(room.id==='engineering'?2:-2),z,room.id==='engineering'?Math.PI/2:0);
      this.buildObjectiveLandmark(group,room);
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
        this.part(group,[x,.7,43],[1.6,1.4,1]);this.part(group,[x,1.42,43],[1.4,.04,.8],this.green);
        this.obstacles.push({x,z:43,w:1.6,d:1});
      }
      if(room.id==='hangar')for(const x of [-5,5])this.part(group,[x,.02,-29],[.12,.03,11],this.green);
    }
    for(const material of replacedLights)material.dispose();
    this.refreshFactionLighting();
    const frames=new InstancedMesh(this.box,this.trim,DECK_DOORS.length*3);const matrix=new Matrix4();let frameIndex=0;this.scene.add(frames);
    for(const door of DECK_DOORS){
      const frame=new Group();this.scene.add(frame);
      for(const sign of [-1,1]){matrix.makeScale(.35,3.4,.35);matrix.setPosition(door.x+(door.axis==='z'?sign*2:0),1.7,door.z+(door.axis==='x'?sign*2:0));frames.setMatrixAt(frameIndex++,matrix);}
      matrix.makeScale(door.axis==='z'?4.4:.4,.25,door.axis==='x'?4.4:.4);matrix.setPosition(door.x,3.3,door.z);frames.setMatrixAt(frameIndex++,matrix);
      const panel=this.part(frame,[door.x,1.45,door.z],[door.axis==='z'?door.width:.16,2.9,door.axis==='x'?door.width:.16],this.metal);
      const indicator=new Mesh(this.box,this.red);indicator.scale.set(door.axis==='z'?.82:1.2,.025,door.axis==='x'?.82:1.2);indicator.position.y=.4;panel.add(indicator);
      this.doorPanels.push({door,mesh:panel});
    }
  }
  private refreshFactionLighting():void {
    const save=this.host.quest.save.snapshot;
    if(save.revision===this.factionRevision)return;
    this.factionRevision=save.revision;
    const friendly=save.warshipOwned;
    for(const lights of this.roomLights.values())for(const light of lights)light.material=friendly?this.green:this.red;
    for(const terminal of this.terminals.values())terminal.material=friendly?this.green:this.red;
    for(const material of this.floorMaterials)material.color.set(friendly?0x00ff00:0xff351e);
    for(const material of this.wallMaterials)material.color.set(friendly?0x8dff9d:0xff8c86);
    for(const light of this.factionLights){light.color.set(friendly?0x00ff55:0xff2418);light.intensity=friendly?3.2:5;}
    this.exitField.material=friendly?this.green:this.red;
    this.barrierMaterial.color.set(friendly?0x00ff00:0xff351e);
  }
  private buildUI():void {
    this.ui.className='boarding-ui';this.status.className='boarding-status';this.health.className='boarding-health';this.hint.className='boarding-hint';
    this.status.append(this.health,this.hint);this.map.width=130;this.map.height=170;this.map.className='boarding-map';this.map.setAttribute('aria-label','Warship deck map');
    const controls=document.createElement('div');controls.className='boarding-actions';
    const button=(label:string,action:()=>void,parent:HTMLElement=controls)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.addEventListener('click',e=>{e.stopPropagation();if(this.active)action();},{signal:this.lifetime.signal});parent.appendChild(b);return b;};
    const fire=button('BLAST',()=>{});fire.className='boarding-fire';
    fire.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();if(!this.canAct())return;this.firingPointer=e.pointerId;fire.setPointerCapture(e.pointerId);},{signal:this.lifetime.signal});
    for(const name of ['pointerup','pointercancel','lostpointercapture'])fire.addEventListener(name,e=>{if((e as PointerEvent).pointerId===this.firingPointer)this.firingPointer=null;},{signal:this.lifetime.signal});
    button('INTERACT',()=>this.interact());button('PUNCH',()=>this.punch());button('JUMP',()=>this.jump());button('DODGE',()=>this.dodge());
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
      if(!event.repeat){if(event.code==='KeyE')this.interact();if(event.code==='KeyF')this.punch();if(event.code==='KeyJ')this.jump();if(event.code==='ShiftLeft')this.dodge();if(event.code==='KeyQ'&&this.host.quest.save.snapshot.heroUpgrades.ledger_shield)this.shieldOn=!this.shieldOn;}
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
  private canAct():boolean{return this.active&&!this.paused&&!this.dead&&this.captureClock<=0&&!this.dialog.active&&!this.ui.querySelector('.boarding-shop');}
  private say(text:string):void{this.message=text;this.messageClock=4;}
  private conversation(scene:DialogueScene,step?:BoardingStep,record=true):void {
    this.clearInput();this.play('Idle');
    if(this.crew.visible&&this.hero.position.distanceTo(this.crew.position)<6){
      const delta=this.crew.position.clone().sub(this.hero.position);this.hero.rotation.y=Math.atan2(delta.x,delta.z);this.crew.rotation.y=this.hero.rotation.y+Math.PI;
    }
    this.dialog.open(scene,()=>{
      const result=step&&!this.host.quest.has(step)?this.host.quest.complete(step,scene.id):record?this.host.quest.recordDialogue(scene.id):{ok:true};
      if(result.ok){if(step==='bridge_secured'){this.captureClock=5;this.clearInput();}this.clearInput();return true;}return false;
    });
  }
  private interact():void {
    if(!this.canAct())return;
    const q=this.host.quest,room=deckRoom(this.room),distance=Math.hypot(this.hero.position.x-room.terminal[0],this.hero.position.z-room.terminal[1]);
    const hiddenDistance=this.room==='rescue'?Math.hypot(this.hero.position.x-10.35,this.hero.position.z-6.8):Infinity;
    const hiddenRouteOpen=q.save.snapshot.quests.includes('boarding.hidden_route');
    if(hiddenDistance<2.35&&!hiddenRouteOpen){if(!q.has('engineering_power'))this.say('A sealed wall seam. Engineering power may expose its lock.');else if(!q.isClear('rescue'))this.say('Hostiles still control the hidden-deck lock.');else if(q.findHiddenRoute().ok){this.say('SECRET FOUND · Detention route open. ARC SCATTERGUN acquired.');this.syncCrew();}return;}
    const focus=boardingInteraction(distance,this.hero.position.distanceTo(this.crew.position),this.crew.visible);
    if(focus==='crew'){
      if(!q.has('rescue_junction')&&!q.isClear('rescue'))this.say('MR ZAMN · Clear this junction. Then I can move with you.');
      else if(!q.has('rescue_junction'))this.conversation(BOARDING_DIALOGUE.zamn,'rescue_junction');
      else this.say(q.has('bridge_secured')?'MR ZAMN · Shields checked. Use the command terminal when you are ready.':'MR ZAMN · On your shoulder. I will cover the nearest threat.');
      return;
    }
    if(focus==='none'){this.say('Move close to the glowing terminal to interact.');return;}
    switch(this.room){
      case 'hangar':if(!q.isClear('hangar'))this.say('Terminal locked under fire. Clear the arrival bay, then return to claim it.');else{q.complete('hangar_safe');this.say('Bay secured. PULSE REPEATER acquired. Security deck open.');}break;
      case 'security':if(!q.isClear('security'))this.say('Clear the security detail first.');else{q.complete('security_relay');this.say('Door relay disabled. Crew junction unlocked.');}break;
      case 'rescue':this.say(!q.isClear('rescue')?'Clear the Security Atrium.':!q.has('engineering_power')?'Restore Engineering power, then search the outer wall seams.':!q.save.snapshot.quests.includes('boarding.hidden_route')?'The scanner marks a false wall near the far red panel.':'The detention passage is open. Find Mr Zamn behind it.');break;
      case 'engineering':if(!q.isClear('engineering'))this.say('Clear engineering before rerouting power.');else if(!q.has('engineering_power'))this.conversation(BOARDING_DIALOGUE.engineering,'engineering_power');else this.say('Hangar power is restored.');break;
      case 'command':if(!q.isClear('command'))this.say('Clear command access before opening the Core chamber.');else{q.complete('command_access');this.say('Core chamber open. Destroy its two relays.');}break;
      case 'core':if(q.has('core_defeated'))this.say('Ledger Shield acquired. Activate SHIELD before the bridge exit field.');else this.say('Break both red relays, then strike while the Core is exposed.');break;
      case 'cache':this.say(!q.isClear('cache')?'Clear the shield-cache guards first.':q.cache().ok?'Cache secured: 100 salvage credits.':q.save.snapshot.heroUpgrades.ledger_shield?'This cache has already been collected.':'Return here with Ledger Shield to open the cache.');break;
      case 'bridge':if(!q.isClear('bridge'))this.say('Clear the bridge guard before taking command.');else if(!q.has('bridge_secured'))this.conversation(BOARDING_DIALOGUE.secured,'bridge_secured');else this.openShop();break;
    }
  }
  private openShop():void {
    const panel=document.createElement('section');panel.className='boarding-shop';
    const title=document.createElement('h2');title.textContent='WARSHIP TERMINAL';const balance=document.createElement('p');
    const paint=()=>{balance.textContent=`${this.host.quest.save.snapshot.credits} SALVAGE CREDITS`;};paint();panel.append(title,balance);
    for(const [label,item] of [['Repair hull · 50','repair'],['Shield capacity · 150','shield_module']] as const){
      const b=document.createElement('button');b.textContent=label;b.addEventListener('click',()=>{const result=this.host.quest.purchase(item);if(result.ok){this.say('Installed on the capital ship.');paint();b.disabled=true;}else this.say('Already installed or insufficient salvage.');});panel.appendChild(b);
    }
    if(this.host.quest.save.snapshot.recruits.includes('lex')){
      const note=document.createElement('p');note.textContent='LEX · LOGISTICS — Field Repair cycles faster beside relief haulers.';
      const module=document.createElement('button');module.textContent='Convoy service module · 180';module.disabled=!!this.host.quest.save.snapshot.heroUpgrades.logistics_service;
      module.addEventListener('click',()=>{const result=this.host.quest.purchase('logistics_module');if(result.ok){module.disabled=true;paint();this.say('Convoy repair cooldown reduced from 18 to 10 seconds.');}else this.say('The module could not install. Check salvage and retry.');});panel.append(note,module);
    }
    const depart=document.createElement('button');depart.textContent=this.host.quest.has('departure_ready')?'DEPART WARSHIP':'PREPARE DEPARTURE';depart.addEventListener('click',()=>{panel.remove();this.paused=false;this.clearInput();if(this.host.quest.has('departure_ready'))this.host.onDeparture();else this.conversation(BOARDING_DIALOGUE.outbound,'departure_ready');});panel.appendChild(depart);
    const close=document.createElement('button');close.textContent='BACK';close.addEventListener('click',()=>{panel.remove();this.paused=false;this.clearInput();});panel.appendChild(close);
    this.ui.appendChild(panel);this.paused=true;this.clearInput();
  }
  private spawnRoom(room:BoardingRoom):void {
    if(this.host.quest.isClear(room)||this.enemies.some(e=>e.room===room))return;
    if(room==='rescue'){
      const roles:readonly BoardingEnemyKind[]=['rifle','breacher','technician','ceiling'];
      deckRoom(room).enemies.forEach(([x,z],index)=>this.enemy(room,x,z,roles[index%roles.length]));
    }else if(room==='engineering'){
      const roles:readonly BoardingEnemyKind[]=['breacher','sapper','technician','rifle','ceiling'];
      deckRoom(room).enemies.forEach(([x,z],index)=>this.enemy(room,x,z,roles[index%roles.length]));
    }else if(room==='command'){
      const roles:readonly BoardingEnemyKind[]=['rifle','sapper','breacher','technician'];
      deckRoom(room).enemies.forEach(([x,z],index)=>this.enemy(room,x,z,roles[index%roles.length]));
    }else for(const [x,z] of deckRoom(room).enemies)this.enemy(room,x,z,'guard');
    const miniboss:Partial<Record<BoardingRoom,readonly [number,number,BoardingEnemyKind]>>={
      hangar:[0,-22,'warden'],security:[0,-12,'warden'],rescue:[7,-6,'warden'],engineering:[-18,3,'warden'],
      cache:[18,3,'warden'],command:[0,16,'warden'],bridge:[0,40,'captain'],
    };
    const elite=miniboss[room];if(elite)this.enemy(room,elite[0],elite[1],elite[2]);
    if(room==='core'){
      for(const [x,z] of DECK_LAYOUT.core.relays)this.enemy(room,x,z,'relay');
      this.enemy(room,DECK_LAYOUT.core.center[0],DECK_LAYOUT.core.center[1],'core');
      if(!this.coreStarted){this.coreStarted=true;if(!this.host.quest.save.snapshot.dialogueSeen.includes(BOARDING_DIALOGUE.core.id))this.conversation(BOARDING_DIALOGUE.core);}
    }
  }
  private enemy(room:BoardingRoom,x:number,z:number,kind:Enemy['kind']):void {
    const core=kind==='core',relay=kind==='relay',captain=kind==='captain',warden=kind==='warden',elite=captain||warden,ceiling=kind==='ceiling',human=['rifle','breacher','technician','sapper'].includes(kind);
    const group=new Group();group.position.set(x,core?1.8:ceiling?2.45:elite?1.35:human?1.02:1.1,z);this.scene.add(group);
    this.part(group,[0,0,0],core?[2.6,2.2,2.6]:captain?[2,1.65,1.8]:warden?[1.45,1.2,1.3]:relay?[.7,1.6,.7]:ceiling?[1.1,.35,.85]:human?[.68,1.05,.48]:[.9,.55,.85],elite?this.bossMetal:this.metal);
    this.part(group,[0,.05,-(core?1.32:captain?.94:warden?.69:.44)],core?[1.8,.5,.07]:elite?[1.05,.28,.08]:[.6,.15,.07],this.red);
    if(!relay)for(const sign of [-1,1])this.part(group,[sign*(core?1.6:captain?1.2:warden?.9:human?.48:.7),human?-.18:-.1,0],core?[.5,.9,2.1]:captain?[.42,.4,1.55]:warden?[.35,.3,1.2]:human?[.18,.62,.2]:[.35,.22,.95],this.trim);
    if(elite){this.part(group,[0,.75,0],[captain?.7:.48,captain?.42:.34,captain?.65:.45],this.red);for(const sign of [-1,1])this.part(group,[sign*(captain?.72:.5),.48,-.45],[.16,.16,.7],this.red);}
    if(human){
      const head=new Mesh(new SphereGeometry(.28,12,8),this.trim);head.position.y=.72;group.add(head);
      for(const sign of [-1,1])this.part(group,[sign*.19,-.72,0],[.19,.55,.22],this.bossMetal);
      if(kind==='rifle')this.part(group,[.43,.05,-.48],[.14,.14,.86],this.red);
      if(kind==='breacher'){
        const shield=this.part(group,[0,.02,.57],[1.05,1.25,.12],this.bossMetal);shield.rotation.x=-.08;
        this.part(group,[0,.03,.65],[.62,.72,.035],this.red);
      }
      if(kind==='technician'){
        this.part(group,[0,.08,-.42],[.8,.72,.28],this.blue);
        for(const sign of [-1,1])this.part(group,[sign*.24,.14,-.61],[.1,.45,.09],this.green);
      }
      if(kind==='sapper'){
        this.part(group,[0,.12,-.46],[.84,.86,.32],this.bossMetal);
        for(const sign of [-1,1]){
          const coil=new Mesh(new CylinderGeometry(.17,.17,.48,10),this.blue);coil.position.set(sign*.28,.16,-.68);coil.rotation.x=Math.PI/2;group.add(coil);
        }
        this.part(group,[.46,.02,-.5],[.18,.2,1.02],this.red);
      }
    }
    if(ceiling){
      for(const sign of [-1,1])this.part(group,[sign*.7,.05,0],[.52,.12,.24],this.trim);
      this.part(group,[0,-.28,0],[.32,.38,.32],this.red);
    }
    const tell=new Mesh(this.box,this.red);tell.visible=false;this.scene.add(tell);
    let barrier:Mesh|undefined;if(core){barrier=new Mesh(new SphereGeometry(2.3,18,12),this.barrierMaterial);group.add(barrier);}
    const tactic=this.enemies.filter(enemy=>enemy.room===room&&!['core','relay','warden','captain'].includes(enemy.kind)).length%3,maxHp=boardingEnemyHealth(kind);
    this.enemies.push({mesh:group,tell,barrier,room,hp:maxHp,maxHp,clock:.6+tactic*.25,charge:0,target:new Vector3(),base:group.position.clone(),tactic,kind});
  }
  private play(name:string):void {
    if(this.clip===name)return;const clip=this.host.hero.animations.find(a=>a.name===name);if(!clip)return;
    const previous=this.host.hero.animations.find(a=>a.name===this.clip);const action=this.mixer.clipAction(clip).reset().play();
    if(previous)action.crossFadeFrom(this.mixer.clipAction(previous),.12,false);this.clip=name;
  }
  private jump():void {if(!this.canAct()||this.hero.position.y>.04)return;this.verticalVelocity=6.4;this.jumpCount++;sfx.play('pulse',.3);}
  private punch():void {
    if(!this.canAct())return;const hit=selectBoardingTarget(this.enemies.filter(enemy=>enemy.room===this.room&&enemy.hp>0&&this.hero.position.distanceTo(enemy.mesh.position)<2.55).map(enemy=>({enemy,kind:enemy.kind,hp:enemy.hp,x:enemy.mesh.position.x,z:enemy.mesh.position.z})),this.hero.position.x,this.hero.position.z)?.enemy;
    this.meleeClock=.38;this.play('Interact');this.invulnerability=Math.max(this.invulnerability,.18);if(!hit){this.meleeCombo=0;this.say('Punch missed. Close the distance or use your boarding weapon.');return;}
    this.meleeCombo=Math.min(3,this.meleeCombo+1);const raw=this.hero.position.y>.35?42:20+this.meleeCombo*6,damage=boardingEnemyDamage(hit.kind,raw,false,true);hit.hp-=damage;const push=hit.mesh.position.clone().sub(this.hero.position).setY(0).normalize().multiplyScalar(.55);hit.mesh.position.add(push);sfx.play('hit',.65);this.say(this.hero.position.y>.35?'JUMP STRIKE · '+damage:'FIST COMBO · '+damage);if(hit.hp<=0){this.scene.remove(hit.mesh,hit.tell);sfx.play('explode',.6);}
  }
  private playCrew(name:'Idle'|'Interact'|'Walk'|'Run'):void {
    if(this.crewClip===name)return;const clip=this.host.crew.animations.find(candidate=>candidate.name===name);if(!clip)return;
    const previous=this.host.crew.animations.find(candidate=>candidate.name===this.crewClip);const action=this.crewMixer.clipAction(clip).reset().play();
    if(previous)action.crossFadeFrom(this.crewMixer.clipAction(previous),.1,false);this.crewClip=name;
  }  private dodge():void {if(!this.canAct()||this.dodgeCooldown>0)return;this.dodgeClock=.32;this.dodgeCooldown=1.5;this.invulnerability=.36;sfx.play('pulse',.4);}
  private fire(origin:Vector3,direction:Vector3,owner:'hero'|'crew'|'enemy',damage=14):void {
    if(owner==='hero')this.shotsFired++;else if(owner==='crew')this.crewShotsFired++;
    const hostile=owner==='enemy';const mesh=new Mesh(this.boltGeometry,hostile?this.red:owner==='crew'?this.blue:this.green);mesh.position.copy(origin);this.scene.add(mesh);
    this.bolts.push({mesh,velocity:direction.clone().normalize().multiplyScalar(hostile?9:24),life:2,owner,damage});sfx.play(hostile?'enemyShoot':'shoot',owner==='crew'?.25:.4);
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
      const room=deckRoom(this.room);this.hero.position.set(room.x,0,this.room==='bridge'?DECK_LAYOUT.core.exitFieldZ-.55:room.z-room.depth*.32);
      if(this.room==='hangar'){this.host.fighter.scene.getObjectByName('Pilot_Exit')?.getWorldPosition(this.hero.position);this.hero.position.y=0;}
      this.verticalVelocity=0;this.dodgeClock=0;this.meleeClock=0;
      this.life=100;this.shield=100;this.dead=false;this.invulnerability=1;this.spawnRoom(this.room);panel.remove();this.clearInput();
    });panel.append(title,text,button);this.ui.appendChild(panel);
  }
  private coverBlocks(start:Vector3,end:Vector3):boolean {
    return this.obstacles.some(obstacle=>{
      if(!obstacle.cover)return false;let near=0,far=1;
      for(const axis of ['x','z'] as const){
        const delta=end[axis]-start[axis],min=obstacle[axis]-obstacle[axis==='x'?'w':'d']/2,max=obstacle[axis]+obstacle[axis==='x'?'w':'d']/2;
        if(Math.abs(delta)<.0001){if(start[axis]<min||start[axis]>max)return false;continue;}
        const a=(min-start[axis])/delta,b=(max-start[axis])/delta;near=Math.max(near,Math.min(a,b));far=Math.min(far,Math.max(a,b));if(near>far)return false;
      }
      return far>.04&&near<.98;
    });
  }
  private syncCrew():void {
    const recruited=this.host.quest.has('rescue_junction');
    if(!recruited){const found=this.host.quest.save.snapshot.quests.includes('boarding.hidden_route'),position=found?[9,6] as const:DECK_LAYOUT.crew.rescue;this.crew.position.set(position[0],0,position[1]);this.crew.visible=found&&this.room==='rescue';this.crewRoom='rescue';}
    else{
      this.crew.visible=true;
      if(this.crewRoom!==this.room||companionPlan(this.hero.position.distanceTo(this.crew.position),Infinity,false).warp){
        const room=deckRoom(this.room),intoRoom=new Vector3(room.x-this.hero.position.x,0,room.z-this.hero.position.z).normalize();
        this.crew.position.copy(this.hero.position).addScaledVector(intoRoom,1.5);this.crew.position.y=0;this.crewRoom=this.room;
      }
    }
    if(this.hiddenPanel)this.hiddenPanel.visible=!this.host.quest.save.snapshot.quests.includes('boarding.hidden_route');
    this.crewMarker.visible=this.crew.visible;this.crewMarker.position.copy(this.crew.position).y=2.4;
  }
  private updateCrew(dt:number):void {
    if(!this.crew.visible||!this.host.quest.has('rescue_junction'))return;
    this.crewFireClock=Math.max(0,this.crewFireClock-dt);this.crewActionClock=Math.max(0,this.crewActionClock-dt);
    const target=selectBoardingTarget(this.enemies.filter(enemy=>enemy.room===this.room).map(enemy=>({enemy,kind:enemy.kind,hp:enemy.hp,x:enemy.mesh.position.x,z:enemy.mesh.position.z})),this.crew.position.x,this.crew.position.z)?.enemy;
    const forward=new Vector3(Math.sin(this.hero.rotation.y),0,Math.cos(this.hero.rotation.y));
    const destination=this.hero.position.clone().addScaledVector(forward,-1.9).add(new Vector3(forward.z,0,-forward.x).multiplyScalar(.75));
    const follow=destination.sub(this.crew.position);follow.y=0;
    let crewGait:'Idle'|'Walk'|'Run'='Idle';
    const followDistance=follow.length();
    if(companionPlan(this.hero.position.distanceTo(this.crew.position),Infinity,false).advance&&followDistance>0.25){const step=follow.normalize().multiplyScalar(Math.min(followDistance,dt*4.35));for(const axis of ['x','z'] as const){const next=this.crew.position.clone();next[axis]+=step[axis];const room=deckRoom(this.room);if(insideWallMargin(room,next.x,next.z)&&!boardingObstacleBlocksMove(this.obstacles,this.crew.position,next,.25)){this.crew.position[axis]=next[axis];crewGait=companionGait(followDistance);}}}
    const focus=target?.mesh.position??this.hero.position;const direction=focus.clone().sub(this.crew.position);const angle=Math.atan2(direction.x,direction.z);this.crew.rotation.y+=Math.atan2(Math.sin(angle-this.crew.rotation.y),Math.cos(angle-this.crew.rotation.y))*Math.min(1,dt*8);
    if(target&&direction.length()<15&&this.crewFireClock<=0){
      const hand=this.crew.getObjectByName('Hand_R');const origin=hand?hand.getWorldPosition(new Vector3()):this.crew.position.clone().add(new Vector3(0,1.05,0));
      const targetPoint=target.mesh.position.clone();targetPoint.y=Math.max(.8,targetPoint.y);
      if(companionPlan(this.hero.position.distanceTo(this.crew.position),direction.length(),this.coverBlocks(origin,targetPoint)).fire){this.fire(origin,targetPoint.sub(origin),'crew',7);this.crewFireClock=.72;this.crewActionClock=.3;this.playCrew('Interact');}
    }
    if(this.crewActionClock<=0)this.playCrew(crewGait);this.crewMarker.position.copy(this.crew.position).y=2.4;
  }  update(dt:number):void {
    if(!this.active)return;this.dialog.update(dt);
    this.refreshFactionLighting();
    this.dialoguePanel.hidden=!this.dialog.active;this.dialogueSpeaker.textContent=this.dialog.speaker;
    this.dialoguePanel.dataset.allegiance=this.dialog.allegiance;
    this.ui.classList.toggle('is-conversation',this.dialog.active);
    this.dialogueText.textContent=this.dialog.text;this.dialoguePage.textContent=this.dialog.failed?'Save failed. Retry CONTINUE or SKIP.':this.dialog.page;
    this.syncCrew();
    if(this.dialog.active){
      this.mixer.update(dt);this.crewMixer.update(dt);
      const focus=this.hero.position.clone();if(this.crew.visible&&focus.distanceTo(this.crew.position)<6)focus.lerp(this.crew.position,.5);
      this.camera.position.lerp(focus.clone().add(new Vector3(4,4.6,-7)),1-Math.exp(-dt*5));this.camera.lookAt(focus);
    }
    if(this.captureClock>0&&!this.dialog.active){
      this.captureClock=Math.max(0,this.captureClock-dt);const progress=1-this.captureClock/5,color=new Color(0xff2418).lerp(new Color(0x00ff55),progress);
      for(const light of this.factionLights){light.color.copy(color);light.intensity=5-progress*1.8;}
      for(const material of this.floorMaterials)material.color.copy(color);
      for(const material of this.wallMaterials)material.color.copy(new Color(0xff8c86).lerp(new Color(0x8dff9d),progress));
      for(const terminal of this.terminals.values())terminal.material=progress>.68?this.green:this.red;
      this.exitField.material=progress>.82?this.green:this.red;
      const focus=new Vector3(0,1,40);this.camera.position.lerp(new Vector3(11-progress*3,8+progress*4,27+progress*7),1-Math.exp(-dt*2.4));this.camera.lookAt(focus);
      this.mixer.update(dt);this.crewMixer.update(dt);this.message='CAPTURE SEQUENCE · Regulatory red yielding to XRP green';this.messageClock=1;this.paintHUD();
      if(this.captureClock===0){this.paused=false;this.say('WARSHIP CAPTURED · All decks under green control.');}
      return;
    }
    if(this.dead){this.mixer.update(dt);return;}
    if(this.paused||this.dialog.active||this.ui.querySelector('.boarding-shop')){this.paintHUD();return;}
    this.clock+=dt;this.fireClock-=dt;this.dodgeClock=Math.max(0,this.dodgeClock-dt);
    this.verticalVelocity-=15*dt;this.hero.position.y=Math.max(0,this.hero.position.y+this.verticalVelocity*dt);if(this.hero.position.y===0)this.verticalVelocity=0;this.meleeClock=Math.max(0,this.meleeClock-dt);this.dodgeCooldown=Math.max(0,this.dodgeCooldown-dt);this.invulnerability=Math.max(0,this.invulnerability-dt);this.messageClock-=dt;
    this.updateCrew(dt);this.crewMixer.update(dt);
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
      if(this.room==='bridge'&&!canCrossExitField(this.hero.position.z,target.z,DECK_LAYOUT.core.exitFieldZ,this.shieldOn,this.host.quest.has('bridge_secured'))){this.say('Activate Ledger Shield to cross this low-power exit field.');continue;}
      if(this.hero.position.y<.72&&boardingObstacleBlocksMove(this.obstacles,this.hero.position,target))continue;
      if(this.enemies.some(e=>e.room===this.room&&e.hp>0&&Math.hypot(target.x-e.mesh.position.x,target.z-e.mesh.position.z)<(e.kind==='core'?2.2:e.kind==='captain'?1.55:e.kind==='warden'?1.2:.72)))continue;
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
    this.play(this.dodgeClock>0||this.hero.position.y>.18?'Dodge':this.meleeClock>0?'Interact':firing?'AimFire':this.move.lengthSq()>.04?'Run':'Idle');this.mixer.update(dt);this.hero.updateMatrixWorld(true);
    if(firing&&this.fireClock<=0){const weapon=boardingWeapon(this.host.quest.save.snapshot.heroUpgrades.boarding_weapon);this.fireClock=weapon.cooldown;const origin=this.hero.getObjectByName('Hand_R')!.getWorldPosition(new Vector3());const point=target?.mesh.position.clone()??origin.clone().add(new Vector3(Math.sin(this.hero.rotation.y),0,Math.cos(this.hero.rotation.y)).multiplyScalar(15));const direction=point.sub(origin);for(let shot=0;shot<weapon.shots;shot++){const offset=(shot-(weapon.shots-1)/2)*weapon.spread;this.fire(origin,direction.clone().applyAxisAngle(new Vector3(0,1,0),offset),'hero',weapon.damage);}}
    this.updateEnemies(dt);this.updateBolts(dt);
    if(this.room==='bridge'&&!this.host.quest.has('bridge_secured')&&this.hero.position.z<DECK_LAYOUT.core.exitFieldZ+1&&!this.shieldOn)this.say('Activate Ledger Shield to cross this low-power exit field.');
    const focus=this.hero.position.clone().add(new Vector3(0,.7,0));
    if(this.room==='core')focus.lerp(new Vector3(deckRoom('core').x,.7,deckRoom('core').z),.4);
    const offset=new Vector3(9,14,-12).multiplyScalar(this.room==='core'&&this.camera.aspect<1?1.15:1);
    const cameraTarget=focus.clone().add(offset);this.camera.position.lerp(cameraTarget,1-Math.exp(-dt*7));this.camera.lookAt(focus);
    this.statsClock+=dt;if(this.statsClock>.1){this.paintHUD();this.statsClock=0;}
  }
  private updateEnemies(dt:number):void {
    const pressure=boardingPressure(this.room);
    let attackers=this.enemies.filter(e=>e.room===this.room&&e.hp>0&&e.charge>0).length;
    for(const enemy of this.enemies){
      enemy.mesh.visible=enemy.room===this.room;
      enemy.tell.visible=enemy.room===this.room&&enemy.hp>0&&enemy.charge>0;
      if(enemy.barrier)enemy.barrier.visible=!this.coreExposed();
      if(enemy.room!==this.room||enemy.hp<=0)continue;
      if(enemy.kind==='relay')continue;
      enemy.clock-=dt;
      if(enemy.kind==='guard'||enemy.kind==='rifle'){const orbit=this.clock*(.42+enemy.tactic*.08)+enemy.base.z*.31;enemy.mesh.position.x=enemy.base.x+Math.sin(orbit)*(1+enemy.tactic*.35);enemy.mesh.position.z=enemy.base.z+Math.cos(orbit*.83)*(.45+enemy.tactic*.18);enemy.mesh.position.y=enemy.base.y+Math.sin(this.clock*2+enemy.tactic)*.08;}
      else if(enemy.kind==='ceiling'){const orbit=this.clock*.55+enemy.tactic;enemy.mesh.position.x=enemy.base.x+Math.sin(orbit)*2.2;enemy.mesh.position.z=enemy.base.z+Math.cos(orbit*.8)*1.1;enemy.mesh.position.y=enemy.base.y+Math.sin(this.clock*1.7)*.22;}
      else if(enemy.kind==='technician'){const orbit=this.clock*.24+enemy.base.x;enemy.mesh.position.x=enemy.base.x+Math.sin(orbit)*.7;enemy.mesh.position.z=enemy.base.z+Math.cos(orbit)*.45;}
      else if(enemy.kind==='sapper'){
        const offset=this.hero.position.clone().sub(enemy.mesh.position).setY(0),range=offset.length();
        const move=sapperRangeMove(range);
        if(move)enemy.mesh.position.addScaledVector(offset.normalize(),dt*(move>0?.8:-.9));
        else enemy.mesh.position.add(new Vector3(Math.cos(this.clock+enemy.tactic),0,-Math.sin(this.clock+enemy.tactic)).multiplyScalar(dt*.55));
      }
      else if(enemy.kind==='breacher'){
        const approach=this.hero.position.clone().sub(enemy.mesh.position).setY(0),range=approach.length();
        if(range>4.2)enemy.mesh.position.addScaledVector(approach.normalize(),dt*1.15);
      }
      else enemy.mesh.rotation.y+=dt*.25;
      if(['rifle','breacher','technician','sapper','ceiling'].includes(enemy.kind)){
        const face=this.hero.position.clone().sub(enemy.mesh.position);enemy.mesh.rotation.y=Math.atan2(face.x,face.z);
      }
      if(enemy.charge>0){enemy.charge-=dt;enemy.mesh.scale.setScalar(1+Math.sin(this.clock*24)*.035);
        const direction=enemy.target.clone().sub(enemy.mesh.position);direction.y=0;
        enemy.tell.position.copy(enemy.mesh.position).addScaledVector(direction,.5);enemy.tell.position.y=.035;
        enemy.tell.rotation.y=Math.atan2(direction.x,direction.z);enemy.tell.scale.set(.18+.12*Math.sin(this.clock*18)**2,.025,direction.length());
        if(enemy.charge<=0){const origin=enemy.mesh.position.clone(),direction=enemy.target.clone().sub(origin),damage=enemy.kind==='captain'?15:enemy.kind==='core'?15:enemy.kind==='warden'?12:enemy.kind==='breacher'?9:enemy.kind==='sapper'?7:enemy.kind==='technician'?8:enemy.kind==='ceiling'?8:enemy.kind==='rifle'?10:11;for(const angle of boardingEnemyVolley(enemy.kind,enemy.tactic))this.fire(origin,direction.clone().applyAxisAngle(new Vector3(0,1,0),angle),'enemy',damage);enemy.clock=(enemy.kind==='captain'?1.25:enemy.kind==='core'?1.65:enemy.kind==='warden'?1.55:enemy.kind==='breacher'?2.2:enemy.kind==='sapper'?2.7:enemy.kind==='technician'?2.65:enemy.kind==='ceiling'?2.1:1.7+enemy.tactic*.18)*pressure.cadence;enemy.mesh.scale.setScalar(1);}
      }else if(enemy.clock<=0&&enemy.kind==='technician'){
        const wounded=this.enemies.filter(other=>other.room===this.room&&other!==enemy&&other.hp>0&&other.hp<other.maxHp).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0];
        if(wounded){wounded.hp=Math.min(wounded.maxHp,wounded.hp+16);enemy.clock=4.5;enemy.tell.visible=true;enemy.tell.position.copy(wounded.mesh.position);enemy.tell.position.y=.04;enemy.tell.scale.set(1.1,.025,1.1);this.say('SECURITY TECHNICIAN · Repair pulse. Break line and remove support.');}
        else if(attackers<pressure.attackers&&this.onScreen(enemy.mesh.position)){enemy.charge=.82;enemy.target.copy(this.hero.position).add(new Vector3(0,1.1,0));attackers++;}
      }else if(enemy.clock<=0&&attackers<pressure.attackers&&this.onScreen(enemy.mesh.position)){enemy.charge=enemy.kind==='captain'?.95:enemy.kind==='warden'?.82:enemy.kind==='breacher'?.95:enemy.kind==='sapper'?1.05:enemy.kind==='ceiling'?.76:.62+enemy.tactic*.08;enemy.target.copy(this.hero.position).add(new Vector3(0,1.1,0));if(enemy.kind==='sapper')this.say('ARC SAPPER · Five-lane discharge. Read the fan and dodge through a gap.');attackers++;}
    }
  }
  private updateBolts(dt:number):void {
    const remove=(index:number)=>{this.scene.remove(this.bolts[index].mesh);this.bolts.splice(index,1);};
    for(let i=this.bolts.length-1;i>=0;i--){
      const bolt=this.bolts[i],start=bolt.mesh.position.clone();bolt.mesh.position.addScaledVector(bolt.velocity,dt);bolt.life-=dt;
      const end=bolt.mesh.position;
      const swept=(target:Vector3,radius:number)=>{const v=end.clone().sub(start);const t=Math.max(0,Math.min(1,target.clone().sub(start).dot(v)/Math.max(.00001,v.lengthSq())));return start.clone().addScaledVector(v,t).distanceTo(target)<radius;};
      if(this.coverBlocks(start,end)){remove(i);continue;}
      if(bolt.owner==='enemy'){if(swept(this.hero.position.clone().add(new Vector3(0,1,0)),.75)){this.hurt(bolt.damage);remove(i);continue;}}
      else{
        const hit=this.enemies.find(e=>e.room===this.room&&e.hp>0&&swept(e.mesh.position,e.kind==='core'?1.7:e.kind==='captain'?1.45:e.kind==='warden'?1.15:.8));
        if(hit){const exposed=hit.kind!=='core'||this.coreExposed();
          if(exposed){const forward=new Vector3(Math.sin(hit.mesh.rotation.y),0,Math.cos(hit.mesh.rotation.y)),incoming=start.clone().sub(hit.mesh.position).setY(0).normalize(),frontHit=hit.kind==='breacher'&&forward.dot(incoming)>.2,damage=boardingEnemyDamage(hit.kind,bolt.damage,frontHit);hit.hp-=damage;sfx.play('hit',.5);if(frontHit)this.say('BREACHER SHIELD · Flank, dodge past, or close for melee.');}else this.say('Core shield active. Relays first; strike during the exposure window.');
          if(hit.hp<=0){this.scene.remove(hit.mesh,hit.tell);sfx.play('explode',.6);}
          remove(i);continue;
        }
      }
      const next=roomAt(end.x,end.z);if(bolt.life<=0||!next||next.id!==this.room||!insideWallMargin(next,end.x,end.z,0))remove(i);
    }
    if(!this.host.quest.isClear(this.room)&&this.enemies.some(e=>e.room===this.room)&&!this.enemies.some(e=>e.room===this.room&&e.hp>0)){
      const result=this.room==='core'?this.host.quest.defeatCore():this.host.quest.clear(this.room);
      if(result.ok){this.life=Math.min(100,this.life+12);this.say(this.room==='core'?'Ledger Shield acquired. Activate SHIELD at the bridge exit.':'Room secured. Checkpoint saved.');}
    }
  }
  private paintHUD():void {
    if(this.pauseButton)this.pauseButton.textContent=this.paused?'RESUME':'PAUSE';
    if(this.host.quest.save.testSlot){
      this.ui.dataset.room=this.room;this.ui.dataset.x=this.hero.position.x.toFixed(3);this.ui.dataset.z=this.hero.position.z.toFixed(3);
      this.ui.dataset.shots=String(this.shotsFired);this.ui.dataset.firing=String(this.firingPointer!==null||this.keys.has('Space'));
      this.ui.dataset.crewShots=String(this.crewShotsFired);this.ui.dataset.enemies=String(this.enemies.filter(enemy=>enemy.room===this.room&&enemy.hp>0).length);
      this.ui.dataset.weapon=String(boardingWeapon(this.host.quest.save.snapshot.heroUpgrades.boarding_weapon).level);this.ui.dataset.combo=String(this.meleeCombo);this.ui.dataset.jumps=String(this.jumpCount);this.ui.dataset.capture=this.captureClock.toFixed(2);
      this.ui.dataset.crewX=this.crew.position.x.toFixed(3);this.ui.dataset.crewZ=this.crew.position.z.toFixed(3);this.ui.dataset.crewVisible=String(this.crew.visible);
      this.ui.dataset.drawCalls=String(this.host.renderer.info.render.calls);this.ui.dataset.triangles=String(this.host.renderer.info.render.triangles);
      this.ui.dataset.geometries=String(this.host.renderer.info.memory.geometries);this.ui.dataset.textures=String(this.host.renderer.info.memory.textures);
    }
    const q=this.host.quest,weapon=boardingWeapon(q.save.snapshot.heroUpgrades.boarding_weapon),core=this.enemies.find(e=>e.kind==='core'&&e.hp>0),elite=this.enemies.find(e=>e.room===this.room&&['warden','captain'].includes(e.kind)&&e.hp>0);
    this.health.textContent=deckRoom(this.room).title+'   VITALS '+Math.ceil(this.life)+'   '+weapon.label+(q.save.snapshot.heroUpgrades.ledger_shield?'   SHIELD '+Math.ceil(this.shield)+(this.shieldOn?' · ACTIVE':''):'')+(this.paused?'   PAUSED':'')+(this.captureClock>0?'   CAPTURE':'')+(this.room==='core'&&core?'   CORE '+Math.ceil(core.hp)+' · '+(this.coreExposed()?'EXPOSED':'SHIELDED'):elite?'   '+(elite.kind==='captain'?'BRIDGE CAPTAIN':'WARDEN')+' '+Math.ceil(elite.hp)+'/'+elite.maxHp:'');
    this.hint.textContent=this.messageClock>0?this.message:q.objective;
    for(const {door,mesh} of this.doorPanels)mesh.visible=!!q.lockReason(door.b);
    for(const [id,group] of this.roomGroups)group.visible=Math.hypot(deckRoom(id).x-this.hero.position.x,deckRoom(id).z-this.hero.position.z)<35;
    const ctx=this.map.getContext('2d');if(!ctx)return;ctx.clearRect(0,0,130,170);ctx.fillStyle='#07101bd9';ctx.fillRect(0,0,130,170);
    for(const room of DECK){ctx.fillStyle=room.id===this.room?'#00a822':q.lockReason(room.id)?'#70241f':'#243a4c';ctx.fillRect(65+(room.x-room.width/2)*2.2,159-(room.z+room.depth/2+37)*1.8,room.width*2.2-1,room.depth*1.8-1);}
    ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(65+this.hero.position.x*2.2,159-(this.hero.position.z+37)*1.8,2.4,0,Math.PI*2);ctx.fill();
  }
  private coreExposed():boolean{return coreExposure(this.enemies.some(e=>e.room==='core'&&e.kind==='relay'&&e.hp>0),this.clock);}
  private onScreen(position:Vector3):boolean{const p=position.clone().project(this.camera);return Math.abs(p.x)<.92&&Math.abs(p.y)<.8&&p.z>-1&&p.z<1;}
  render():void {
    this.keyLight.position.copy(this.hero.position).add(new Vector3(-8,18,-10));this.keyLight.target.position.copy(this.hero.position);
    this.camera.aspect=this.host.root.clientWidth/Math.max(1,this.host.root.clientHeight);this.camera.fov=this.camera.aspect<1?49:43;this.camera.updateProjectionMatrix();this.host.renderer.render(this.scene,this.camera);
  }
  dispose():void {
    this.active=false;this.clearInput();this.lifetime.abort();this.mixer.stopAllAction();this.mixer.uncacheRoot(this.hero);this.crewMixer.stopAllAction();this.crewMixer.uncacheRoot(this.crew);this.dialog.closeWithoutEffects();this.ui.remove();
    // Include pooled/dead objects so shared GPU resources are released exactly once.
    for(const enemy of this.enemies)this.scene.add(enemy.mesh,enemy.tell);
    this.scene.add(new Mesh(this.boltGeometry,this.red),new Mesh(this.box,this.barrierMaterial));
    disposeObject(this.scene);
  }
}
