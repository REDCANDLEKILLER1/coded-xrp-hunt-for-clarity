import {Quaternion,Vector3} from 'three';
/** At tell start, three parallel lanes commit to the ship's projected crossing.
 * Later steering cannot rotate or home the committed warning and volley. */
export function commitBomberLanes(position:Vector3,orientation:Quaternion,speed:number):Vector3[]{
  if(![...position.toArray(),...orientation.toArray(),speed].every(Number.isFinite))throw Error('Finite bomber lane input required');
  const forward=new Vector3(0,0,-1).applyQuaternion(orientation),right=new Vector3(1,0,0).applyQuaternion(orientation);
  return [-110,0,110].map(offset=>position.clone().addScaledVector(forward,Math.max(0,speed)*2.5).addScaledVector(right,offset));
}
export function bomberVolley(muzzles:readonly Vector3[],lanes:readonly Vector3[]):{origin:Vector3;direction:Vector3}[]{
  if(muzzles.length!==2||lanes.length!==3||![...muzzles,...lanes].every(v=>v.toArray().every(Number.isFinite)))throw Error('Two real bomber muzzles and three committed lanes required');
  return lanes.flatMap(target=>muzzles.map(origin=>({origin:origin.clone(),direction:target.clone().sub(origin).normalize()})));
}
