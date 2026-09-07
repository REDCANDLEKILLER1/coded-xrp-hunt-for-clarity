import {Vector3,type Mesh,type Object3D} from 'three';
export interface GroundPoint{x:number;z:number}
const turn=(a:GroundPoint,b:GroundPoint,c:GroundPoint)=>(b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x);
/** A conservative ground-plane hull from the actual selected parked model.
 * Computed once on scene entry; no guessed or mirrored wing offsets. */
export function fighterFootprint(model:Object3D):GroundPoint[]{
  model.updateMatrixWorld(true);const points:GroundPoint[]=[],v=new Vector3();
  model.traverse(o=>{const mesh=o as Mesh;if(!mesh.isMesh)return;const vertices=mesh.geometry.getAttribute('position');for(let i=0;i<vertices.count;i++){v.fromBufferAttribute(vertices,i).applyMatrix4(mesh.matrixWorld);if(Number.isFinite(v.x)&&Number.isFinite(v.z))points.push({x:v.x,z:v.z});}});
  points.sort((a,b)=>a.x-b.x||a.z-b.z);if(points.length<3)throw new Error('The selected fighter has no valid footprint');
  const edge=(list:GroundPoint[])=>{const hull:GroundPoint[]=[];for(const p of list){while(hull.length>=2&&turn(hull[hull.length-2],hull[hull.length-1],p)<=0)hull.pop();hull.push(p);}return hull;};
  const lower=edge(points),upper=edge([...points].reverse());lower.pop();upper.pop();return[...lower,...upper];
}
export function withinFootprint(point:GroundPoint,hull:readonly GroundPoint[],radius=.32):boolean{
  for(let i=0;i<hull.length;i++){const a=hull[i],b=hull[(i+1)%hull.length];if(turn(a,b,point)<-radius*Math.hypot(b.x-a.x,b.z-a.z))return false;}
  return hull.length>=3;
}
/** Conservative offline navigation default; the live scene always supplies
 * the hull measured from its selected fighter. */
export const RELIEF_FIGHTER_PROXY:readonly GroundPoint[]=[{x:0,z:30.5},{x:-1.4,z:28.6},{x:-3.7,z:23.8},{x:-3.7,z:22.1},{x:-1.4,z:21.4},{x:1.4,z:21.4},{x:3.7,z:22.1},{x:3.7,z:23.8},{x:1.4,z:28.6}];
