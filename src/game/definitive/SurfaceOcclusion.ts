import {Mesh,Raycaster,Vector3,type Camera,type Material,type Object3D} from 'three';

/** Fade only selected architecture when it blocks the actual hero sight line.
 * Each cloned material belongs to its mesh and is released with the scene. */
export class SurfaceOcclusion{
  private readonly ray=new Raycaster();
  private readonly materials=new Set<Material>();
  constructor(private readonly root:Object3D){
    root.traverse(o=>{if(o instanceof Mesh){const clone=(m:Material)=>{const copy=m.clone();this.materials.add(copy);return copy;};o.material=Array.isArray(o.material)?o.material.map(clone):clone(o.material);}});
  }
  update(camera:Camera,hero:Object3D,enabled=true):void{
    const origin=camera.getWorldPosition(new Vector3()),target=hero.getWorldPosition(new Vector3()).add(new Vector3(0,1.1,0)),direction=target.sub(origin),distance=direction.length();
    this.root.updateWorldMatrix(true,true);this.ray.set(origin,direction.normalize());this.ray.near=0;this.ray.far=Math.max(0,distance-.1);
    const blocked=enabled&&this.ray.intersectObject(this.root,true).length>0;
    for(const material of this.materials){if(material.transparent!==blocked){material.transparent=blocked;material.needsUpdate=true;}material.opacity=blocked?.14:1;material.depthWrite=!blocked;}
  }
}
