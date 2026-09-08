import {Box3,Group,Object3D,Mesh,MeshStandardMaterial,Raycaster,Vector3,LineSegments,BufferGeometry,LineBasicMaterial,Float32BufferAttribute} from 'three';
import {CAPITAL_PARTS,CapitalTactics,type CapitalPart,type CapitalCheckpoint} from './CapitalTactics';
import {HullSweep,segmentSphere} from './SpaceGeometry';
export interface CapitalLane {from:Vector3;to:Vector3}
/** One anchored warship. Its guns commit to a visible lane before firing; they never track during the warning. */
export class CapitalEncounter {
 readonly tactics:CapitalTactics;
 readonly hull:HullSweep;
 readonly targets=new Map<CapitalPart,Object3D>();
 readonly warnings:LineSegments;
 readonly lanes:CapitalLane[]=[];
 readonly bounds:Box3;
 private ray=new Raycaster();
 private timer=4;
 private activeBank:CapitalPart='battery_port';
 private fired=false;
 private damaged=false;
 private nextPort=true;
 private readonly meshes:Mesh[]=[];
 constructor(readonly pose:Group,readonly label:string,wave:number,saved?:CapitalCheckpoint){
  this.tactics=new CapitalTactics(wave,saved);pose.updateMatrixWorld(true);this.hull=new HullSweep(pose);this.bounds=new Box3().setFromObject(pose);
  pose.traverse(o=>{if(o instanceof Mesh){this.meshes.push(o);o.material=Array.isArray(o.material)?o.material.map(m=>m.clone()):o.material.clone();}});
  for(const key of CAPITAL_PARTS){const node=pose.getObjectByName(key);if(!node)throw Error('Missing warship component '+key);this.targets.set(key,node);}
  this.warnings=new LineSegments(new BufferGeometry(),new LineBasicMaterial({color:0xff3518,transparent:true,opacity:.75,depthWrite:false}));this.warnings.frustumCulled=false;this.paint();
 }
 get warning():string{return this.lanes.length?`${this.fired?'SALVO':'BROADSIDE IN '+Math.max(0,this.timer-.5).toFixed(1)+'s'} · ${this.activeBank==='battery_port'?'PORT':'STARBOARD'}`:'';}
 get attackOrigin():Vector3{return this.batteryOrigin(this.activeBank);}
 private batteryOrigin(bank:CapitalPart):Vector3{const local=this.pose.worldToLocal(this.point(bank));local.x+=bank==='battery_port'?-34:34;return this.pose.localToWorld(local);}
 point(key:CapitalPart):Vector3{return new Box3().setFromObject(this.targets.get(key)!).getCenter(new Vector3());}
 hit(from:Vector3,to:Vector3,damage:number):'miss'|'armor'|'component'{
  const d=to.clone().sub(from),length=d.length();if(length<.0001)return 'miss';this.ray.set(from,d.divideScalar(length));this.ray.far=length;
  const a=d.clone().cross(Math.abs(d.y)>.9?new Vector3(1,0,0):new Vector3(0,1,0)).normalize().multiplyScalar(1.3),b=d.clone().cross(a).normalize().multiplyScalar(1.3);
  const hits=[new Vector3(),a,a.clone().negate(),b,b.clone().negate()].flatMap(offset=>{this.ray.set(from.clone().add(offset),d);return this.ray.intersectObjects(this.meshes,false);});
  const hit=hits.sort((a,b)=>a.distance-b.distance)[0];if(!hit)return 'miss';
  let object:Object3D|null=hit.object,key:CapitalPart|undefined;while(object&&!key){key=CAPITAL_PARTS.find(k=>this.targets.get(k)===object);object=object.parent;}
  const damaged=key?this.tactics.damage(key,damage):false;if(damaged)this.paint();return damaged?'component':'armor';
 }
 /** Returns one impact at most per committed broadside. */
 update(dt:number,player:Vector3,previous:Vector3,velocity:Vector3):boolean {
  if(!Number.isFinite(dt)||dt<=0||dt>.25||this.tactics.defeated)return false;
  this.timer-=dt;
  if(this.lanes.length&&this.tactics.hp[this.activeBank]===0){this.clearLanes();this.timer=3;return false;}
  if(!this.lanes.length&&this.timer<=2.8){
   let bank:CapitalPart=this.nextPort?'battery_port':'battery_starboard';this.nextPort=!this.nextPort;
   const aim=player.clone().addScaledVector(velocity,.8),other:CapitalPart=bank==='battery_port'?'battery_starboard':'battery_port';
   const clear=(candidate:CapitalPart)=>this.tactics.hp[candidate]>0&&!this.hull.hit(this.batteryOrigin(candidate),aim,1);
   if(!clear(bank))bank=other;if(!clear(bank)){this.timer=3;return false;}
   this.activeBank=bank;const from=this.batteryOrigin(bank),across=aim.clone().sub(from).cross(new Vector3(0,1,0)).normalize();
   for(const offset of [-125,0,125]){const target=aim.clone().addScaledVector(across,offset);const to=from.clone().addScaledVector(target.clone().sub(from).normalize(),Math.max(2200,from.distanceTo(target)+750));this.lanes.push({from:from.clone(),to});}
   const positions=this.lanes.flatMap(l=>[...l.from.toArray(),...l.to.toArray()]);this.warnings.geometry.dispose();this.warnings.geometry=new BufferGeometry();this.warnings.geometry.setAttribute('position',new Float32BufferAttribute(positions,3));this.warnings.visible=true;this.fired=false;this.damaged=false;
  }
  let damage=false;
  if(this.lanes.length&&this.timer<=.5){
   this.fired=true;(this.warnings.material as LineBasicMaterial).opacity=1;
   // Player swept motion matters too, so crossing a live strip between frames cannot tunnel through it.
   if(!this.damaged&&this.lanes.some(l=>segmentSphere(l.from,l.to,player,33)||segmentSphere(l.from,l.to,previous,33)||segmentSphere(l.from,l.to,player.clone().lerp(previous,.5),33))){this.damaged=true;damage=true;}
  }
  if(this.timer<=0){this.clearLanes();this.timer=this.tactics.exposed?6.8:8.8;}
  return damage;
 }
 private clearLanes():void{this.lanes.length=0;this.warnings.visible=false;(this.warnings.material as LineBasicMaterial).opacity=.75;}
 private paint():void {
  if(this.tactics.defeated){this.clearLanes();for(const mesh of this.meshes)for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])if(material instanceof MeshStandardMaterial){material.emissiveIntensity=0;material.roughness=.95;}}
  for(const [key,target] of this.targets){target.traverse(mesh=>{if(!(mesh instanceof Mesh))return;for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material])if(m instanceof MeshStandardMaterial){
   if(this.tactics.hp[key]===0){m.color.setHex(0x151b21);m.emissive.setHex(0x000000);m.emissiveIntensity=0;}
   else if(key==='reactor'){m.color.setHex(this.tactics.exposed?0xffae32:0x241b23);m.emissive.setHex(this.tactics.exposed?0xff7900:0x330300);m.emissiveIntensity=this.tactics.exposed?3:.2;}
  }});}
 }
}
