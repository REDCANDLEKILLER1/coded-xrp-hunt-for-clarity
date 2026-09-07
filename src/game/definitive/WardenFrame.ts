import {Box3,PerspectiveCamera,Vector3} from 'three';
/** Reserve the same portrait/beside-dialogue areas as the actor conversations. */
export function frameWarden(camera:PerspectiveCamera,bounds:Box3,width:number,height:number):void{
  const aspect=width/Math.max(1,height),wide=aspect>1.25,center=bounds.getCenter(new Vector3());
  const direction=new Vector3(.55,.65,1).normalize(),right=new Vector3(0,1,0).cross(direction).normalize(),up=direction.clone().cross(right);
  let x=0,y=0,depth=0;for(const px of [bounds.min.x,bounds.max.x])for(const py of [bounds.min.y,bounds.max.y])for(const pz of [bounds.min.z,bounds.max.z]){const p=new Vector3(px,py,pz).sub(center);x=Math.max(x,Math.abs(p.dot(right)));y=Math.max(y,Math.abs(p.dot(up)));depth=Math.max(depth,Math.abs(p.dot(direction)));}
  const tan=Math.tan(camera.fov*Math.PI/360),distance=Math.max(x/(tan*aspect*(wide?.42:.87)),y/(tan*(wide?.64:.51)))+depth;
  camera.aspect=aspect;camera.position.copy(center).addScaledVector(direction,distance);camera.lookAt(center);camera.setViewOffset(width,height,wide?width*.26:0,wide?-height*.025:height*.10,width,height);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
}
