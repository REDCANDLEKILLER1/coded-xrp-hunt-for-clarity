import {PerspectiveCamera,Vector3} from 'three';
/** Fit two standing actors into the portion of the screen left by dialogue.
 * Positions stay in world metres; viewport framing never moves the actors. */
export function frameConversation(camera:PerspectiveCamera,a:Vector3,b:Vector3,width:number,height:number):void{
  const aspect=width/Math.max(1,height),landscape=aspect>1.25;
  const center=a.clone().add(b).multiplyScalar(.5);center.y+=1.05;
  const direction=new Vector3(1,.48,1.05).normalize(),right=new Vector3(0,1,0).cross(direction).normalize(),up=direction.clone().cross(right);
  let halfWidth=0,halfHeight=0,depth=0;
  for(const actor of [a,b])for(const x of [-.55,.55])for(const z of [-.45,.45])for(const y of [0,2.25]){
    const offset=actor.clone().add(new Vector3(x,y,z)).sub(center);halfWidth=Math.max(halfWidth,Math.abs(offset.dot(right)));halfHeight=Math.max(halfHeight,Math.abs(offset.dot(up)));depth=Math.max(depth,Math.abs(offset.dot(direction)));
  }
  const tangent=Math.tan(camera.fov*Math.PI/360),fractionX=landscape?.43:.86,fractionY=landscape?.62:.49;
  const distance=Math.max(halfWidth/(tangent*aspect*fractionX),halfHeight/(tangent*fractionY))+depth;
  camera.aspect=aspect;camera.position.copy(center).addScaledVector(direction,distance);camera.lookAt(center);
  camera.setViewOffset(width,height,landscape?width*.255:0,landscape?-height*.025:height*.11,width,height);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
}
