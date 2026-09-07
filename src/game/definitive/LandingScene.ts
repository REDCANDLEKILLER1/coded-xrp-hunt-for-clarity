import { AmbientLight, BoxGeometry, BufferGeometry, Color, DirectionalLight, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, PerspectiveCamera, Points, PointsMaterial, Scene, Texture, WebGLRenderer } from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import type { CampaignSave } from './CampaignSave';
import type { ManagedScene } from './SceneController';
import { disposeObject } from './ModelAssets';
import { LANDING_DURATION, landingPose, PARKED_HEIGHT, dockFighter } from './LandingPlan';
import deck from './boarding-deck.json';

interface Host {renderer:WebGLRenderer;environment:Texture;root:HTMLElement;save:CampaignSave;warship:GLTF;fighter:GLTF;onDock:()=>void}

/** Guided recovery keeps the same fighter and real bay coordinates into boarding. */
export class LandingScene implements ManagedScene {
  private readonly scene=new Scene();
  private readonly camera=new PerspectiveCamera(48,1,.1,2000);
  private readonly ui=document.createElement('section');
  private readonly text=document.createElement('p');
  private readonly button=document.createElement('button');
  private readonly lifetime=new AbortController();
  private readonly lift=new Group();
  private active=false;
  private paused=true;
  private elapsed=0;
  private finishing=false;
  constructor(private readonly host:Host){
    this.paused=host.save.testSlot;
    this.scene.background=new Color(0x02060c);this.scene.environment=host.environment;this.scene.environmentIntensity=.4;
    this.scene.add(host.warship.scene,host.fighter.scene,new AmbientLight(0x6c89a3,.7));
    const earthLight=new DirectionalLight(0xb0d1ff,3.5);earthLight.position.set(-50,-90,50);this.scene.add(earthLight);
    const rim=new DirectionalLight(0xff5635,2);rim.position.set(60,30,-50);this.scene.add(rim);
    host.fighter.scene.traverse(o=>{if(o instanceof Mesh)for(const m of Array.isArray(o.material)?o.material:[o.material])if(m.name.startsWith('Liquidity'))m.toneMapped=false;});
    const stars=[];let seed=902;
    const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    for(let i=0;i<600;i++){const z=random()*2-1,a=random()*Math.PI*2,r=600;stars.push(r*Math.sqrt(1-z*z)*Math.cos(a),r*z,r*Math.sqrt(1-z*z)*Math.sin(a));}
    const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(stars,3));
    this.scene.add(new Points(geometry,new PointsMaterial({color:0xd4e4ff,size:1.1,sizeAttenuation:true})));
    const platform=new Mesh(new BoxGeometry(8.55,.15,11.75),new MeshStandardMaterial({color:0x1b2832,metalness:.7,roughness:.5}));platform.position.y=-.075;this.lift.add(platform);
    const light=new MeshBasicMaterial({color:0x00ff00,toneMapped:false});
    for(const x of [-4.05,4.05]){const strip=new Mesh(new BoxGeometry(.06,.02,11.3),light);strip.position.set(x,.015,0);this.lift.add(strip);}
    this.lift.position.z=deck.landing.center[1];this.lift.visible=false;this.scene.add(this.lift);
    this.ui.className='landing-ui';const heading=document.createElement('strong');heading.textContent='REGULATORY WARSHIP · RECOVERY BAY';
    this.button.type='button';this.button.addEventListener('click',()=>{if(!this.active||this.finishing)return;this.paused=!this.paused;this.paint();},{signal:this.lifetime.signal});
    this.ui.append(heading,this.text,this.button);host.root.appendChild(this.ui);
    window.addEventListener('blur',this.pause,{signal:this.lifetime.signal});document.addEventListener('visibilitychange',()=>{if(document.hidden)this.pause();},{signal:this.lifetime.signal});
    this.applyPose();this.paint();
  }
  private readonly pause=():void=>{if(this.active){this.paused=true;this.paint();}};
  setActive(value:boolean):void{this.active=value;this.ui.hidden=!value;}
  private paint():void{
    this.button.textContent=this.paused?(this.elapsed===0?'BEGIN APPROACH':'RESUME'):'PAUSE';
    this.text.textContent=this.elapsed<10?'The capital ship is disabled. Your fighter approaches its ventral recovery bay.':this.elapsed<17?'Recovery lift engaged. Hold steady—the fighter stays with you.':'Docking clamps secured. XRPMan is ready to disembark.';
    if(this.host.save.testSlot){this.ui.dataset.seconds=this.elapsed.toFixed(3);this.ui.dataset.stage=landingPose(this.elapsed).stage;this.ui.dataset.fighter=this.host.save.snapshot.fighterShipKey;this.ui.dataset.paused=String(this.paused);}
  }
  private applyPose():void{
    const pose=landingPose(this.elapsed);this.host.fighter.scene.position.copy(pose.fighter);
    this.camera.position.copy(pose.camera);this.camera.lookAt(pose.target);
    this.lift.visible=this.elapsed>=10;this.lift.position.y=pose.fighter.y-PARKED_HEIGHT;
  }
  update(dt:number):void{
    if(!this.active||this.paused||this.finishing)return;
    this.elapsed=Math.min(LANDING_DURATION,this.elapsed+dt);this.applyPose();this.paint();
    if(this.elapsed<LANDING_DURATION)return;
    const result=dockFighter(this.host.save);
    if(!result.ok){this.paused=true;this.paint();this.text.textContent='Docking is safe, but the checkpoint could not be saved. Resume to retry.';return;}
    this.finishing=true;this.host.onDock();
  }
  render():void{this.camera.aspect=this.host.root.clientWidth/Math.max(1,this.host.root.clientHeight);this.camera.fov=this.camera.aspect<1?67:48;this.camera.updateProjectionMatrix();this.host.renderer.render(this.scene,this.camera);}
  dispose():void{this.active=false;this.lifetime.abort();this.ui.remove();disposeObject(this.scene);}
}
