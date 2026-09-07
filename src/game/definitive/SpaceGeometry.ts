import { Box3, Group, Mesh, Object3D, Quaternion, Raycaster, Vector3 } from 'three';

export const CAPITAL_MUZZLES=['Muzzle_FL','Muzzle_FR','Muzzle_L','Muzzle_R'] as const;
export const FORWARD=new Vector3(0,0,-1),UP=new Vector3(0,1,0),RIGHT=new Vector3(1,0,0);
export const MIN_CONVERGENCE=400,DEFAULT_CONVERGENCE=550;

/** Exactly one orientation adapter: glTF +Z bow -> engine -Z forward. Metres 1:1. */
export function flightHull(model:Group):Group {
  const pose=new Group();model.rotation.y+=Math.PI;pose.add(model);pose.updateMatrixWorld(true);return pose;
}
export function forwardPoint(pose:Object3D,range=DEFAULT_CONVERGENCE):Vector3 {
  pose.updateMatrixWorld(true);
  // Keep convergence on the gun deck's upper plane. A centre-of-hull target
  // points the aft side barrels downward through the swept shoulder armor.
  const heights=CAPITAL_MUZZLES.map(name=>pose.getObjectByName(name)).filter((node):node is Object3D=>!!node).map(node=>pose.worldToLocal(node.getWorldPosition(new Vector3())).y);
  return pose.localToWorld(new Vector3(0,heights.length?Math.max(...heights):0,-Math.max(MIN_CONVERGENCE,Math.min(2000,range))));
}
export function capitalVolley(pose:Object3D,range=DEFAULT_CONVERGENCE):{name:string;origin:Vector3;direction:Vector3;target:Vector3}[] {
  pose.updateMatrixWorld(true);const target=forwardPoint(pose,range);
  return CAPITAL_MUZZLES.map(name=>{
    const node=pose.getObjectByName(name);if(!node)throw new Error(`Missing capital hardpoint: ${name}`);
    const origin=node.getWorldPosition(new Vector3());return {name,origin,direction:target.clone().sub(origin).normalize(),target:target.clone()};
  });
}
export function turnFlight(orientation:Quaternion,yaw:number,pitch:number,roll:number,dt:number):void {
  orientation.multiply(new Quaternion().setFromAxisAngle(UP,-yaw*dt));
  orientation.multiply(new Quaternion().setFromAxisAngle(RIGHT,-pitch*dt));
  orientation.multiply(new Quaternion().setFromAxisAngle(FORWARD,roll*dt)).normalize();
}
export function segmentSphere(start:Vector3,end:Vector3,center:Vector3,radius:number):boolean {
  const delta=end.clone().sub(start),t=Math.max(0,Math.min(1,center.clone().sub(start).dot(delta)/Math.max(1e-10,delta.lengthSq())));
  return start.clone().addScaledVector(delta,t).distanceToSquared(center)<=radius*radius;
}

/** Visual lead only; the weapon continues to shoot through the forward reticle. */
export function interceptPoint(origin:Vector3,target:Vector3,relativeVelocity:Vector3,speed:number):Vector3 {
  const r=target.clone().sub(origin),a=relativeVelocity.lengthSq()-speed*speed,b=2*r.dot(relativeVelocity),c=r.lengthSq();
  let time=0;const discriminant=b*b-4*a*c;
  if(Math.abs(a)<1e-7){if(Math.abs(b)>1e-7)time=-c/b;}
  else if(discriminant>=0){const root=Math.sqrt(discriminant),values=[(-b-root)/(2*a),(-b+root)/(2*a)].filter(t=>t>0);if(values.length)time=Math.min(...values);}
  return target.clone().addScaledVector(relativeVelocity,Math.max(0,Math.min(4,time)));
}

/** Broad bound followed by actual hull triangles. Radius uses five swept rays. */
export class HullSweep {
  private readonly meshes:Mesh[]=[];
  private readonly ray=new Raycaster();
  private readonly localBound:Box3;
  constructor(private readonly root:Object3D){
    root.updateMatrixWorld(true);root.traverse(o=>{if((o as Mesh).isMesh)this.meshes.push(o as Mesh);});
    this.localBound=new Box3();
    for(const mesh of this.meshes){mesh.geometry.computeBoundingBox();const box=mesh.geometry.boundingBox!.clone().applyMatrix4(mesh.matrixWorld);for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])this.localBound.expandByPoint(root.worldToLocal(new Vector3(x,y,z)));}
  }
  hit(start:Vector3,end:Vector3,radius=0):boolean{
    this.root.updateMatrixWorld(true);const bound=this.localBound.clone().applyMatrix4(this.root.matrixWorld).expandByScalar(radius);
    const delta=end.clone().sub(start),length=delta.length();if(length<1e-8)return false;
    this.ray.set(start,delta.clone().divideScalar(length));this.ray.far=length;
    if(!this.ray.ray.intersectsBox(bound))return false;
    const a=delta.clone().cross(Math.abs(delta.y/length)>.9?RIGHT:UP).normalize().multiplyScalar(radius),b=delta.clone().cross(a).normalize().multiplyScalar(radius);
    const offsets=radius>0?[new Vector3(),a,a.clone().negate(),b,b.clone().negate()]:[new Vector3()];
    return offsets.some(offset=>{this.ray.set(start.clone().add(offset),delta.clone().divideScalar(length));return this.ray.intersectObjects(this.meshes,false).length>0;});
  }
}
