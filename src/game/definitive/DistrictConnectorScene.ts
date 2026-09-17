import {AmbientLight,BoxGeometry,Color,Mesh,MeshBasicMaterial,PerspectiveCamera,Scene} from 'three';
import type {ManagedScene} from './SceneController';
import {disposeObject} from './ModelAssets';
import type {WebGLRenderer} from 'three';

interface Host{renderer:WebGLRenderer;root:HTMLElement;label:string;onArrive:()=>void}
/** A tiny lift scene breaks heavy-district loads into two committed handoffs. */
export class DistrictConnectorScene implements ManagedScene{
  private readonly scene=new Scene();private readonly camera=new PerspectiveCamera(48,1,.1,30);private readonly ui=document.createElement('section');private active=false;private age=0;
  constructor(private readonly host:Host){
    this.scene.background=new Color(0x02070c);this.scene.add(new AmbientLight(0xffffff,1));this.camera.position.set(0,1.5,5);
    const frame=new Mesh(new BoxGeometry(4.5,3.4,.3),new MeshBasicMaterial({color:0x17313d}));frame.position.z=-.5;this.scene.add(frame);
    const door=new Mesh(new BoxGeometry(3.5,2.7,.12),new MeshBasicMaterial({color:0x00aa44}));door.position.z=-.3;door.name='Lift_Door';this.scene.add(door);
    this.ui.className='district-connector';const title=document.createElement('h2');title.textContent='CAPTURED WARSHIP · TRANSIT LIFT';const copy=document.createElement('p');copy.textContent=`Previous district released. ${host.label} is ready to load.`;const go=document.createElement('button');go.textContent=`OPEN ${host.label}`;go.addEventListener('click',()=>{if(this.active)host.onArrive();});this.ui.append(title,copy,go);this.ui.hidden=true;host.root.appendChild(this.ui);
  }
  setActive(v:boolean):void{this.active=v;this.ui.hidden=!v;}
  update(dt:number):void{if(this.active){this.age+=dt;const door=this.scene.getObjectByName('Lift_Door') as Mesh;(door.material as MeshBasicMaterial).opacity=.72+.2*Math.sin(this.age*3);(door.material as MeshBasicMaterial).transparent=true;}}
  render():void{this.camera.aspect=this.host.root.clientWidth/Math.max(1,this.host.root.clientHeight);this.camera.updateProjectionMatrix();this.host.renderer.render(this.scene,this.camera);}
  dispose():void{this.active=false;disposeObject(this.scene);this.ui.remove();}
}
