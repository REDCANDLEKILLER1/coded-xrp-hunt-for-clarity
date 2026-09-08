import type {FreightPoint,FreightPoint3} from './FreightConvoy';
/** First segment contact in a metre-scale oriented box; null means a true miss. */
export function freightBoxHit(from:FreightPoint3,to:FreightPoint3,pose:FreightPoint&{heading:number},halfX:number,minY:number,maxY:number,halfZ:number):number|null{
  if(![from.x,from.y,from.z,to.x,to.y,to.z,pose.x,pose.z,pose.heading,halfX,minY,maxY,halfZ].every(Number.isFinite))return null;
  const s=Math.sin(pose.heading),c=Math.cos(pose.heading);
  const local=(p:FreightPoint3)=>[c*(p.x-pose.x)-s*(p.z-pose.z),p.y,s*(p.x-pose.x)+c*(p.z-pose.z)];
  const a=local(from),b=local(to);let lo=0,hi=1;
  for(let axis=0;axis<3;axis++){
    const min=[-halfX,minY,-halfZ][axis],max=[halfX,maxY,halfZ][axis],delta=b[axis]-a[axis];
    if(Math.abs(delta)<1e-8){if(a[axis]<min||a[axis]>max)return null;}
    else{const t1=(min-a[axis])/delta,t2=(max-a[axis])/delta;lo=Math.max(lo,Math.min(t1,t2));hi=Math.min(hi,Math.max(t1,t2));}
  }
  return lo<=hi?lo:null;
}
export function freightSphereHit(from:FreightPoint3,to:FreightPoint3,center:FreightPoint3,radius:number):number|null{
  const dx=to.x-from.x,dy=to.y-from.y,dz=to.z-from.z,ox=from.x-center.x,oy=from.y-center.y,oz=from.z-center.z;
  const a=dx*dx+dy*dy+dz*dz,c=ox*ox+oy*oy+oz*oz-radius*radius;
  if(!Number.isFinite(a+c)||radius<0)return null;if(c<=0)return 0;if(a<1e-12)return null;
  const b=2*(dx*ox+dy*oy+dz*oz),disc=b*b-4*a*c;if(disc<0)return null;
  const t=(-b-Math.sqrt(disc))/(2*a);return t>=0&&t<=1?t:null;
}
export function freightBoxContains(at:FreightPoint,pose:FreightPoint&{heading:number},halfX:number,halfZ:number):boolean{
  return freightBoxHit({...at,y:1},{...at,y:1},pose,halfX,0,2,halfZ)!==null;
}
/** A rotating or moving vehicle cannot trap a person inside its next footprint.
 * Try the nearest exterior face, then other clear faces if cover blocks it. */
export function freightPushOut(at:FreightPoint,pose:FreightPoint&{heading:number},halfX:number,halfZ:number,clear:(p:FreightPoint)=>boolean):FreightPoint|null{
  if(!freightBoxContains(at,pose,halfX,halfZ))return null;
  const s=Math.sin(pose.heading),c=Math.cos(pose.heading),dx=at.x-pose.x,dz=at.z-pose.z,x=c*dx-s*dz,z=s*dx+c*dz;
  const candidates=[{x:halfX+.12,z},{x:-halfX-.12,z},{x,z:halfZ+.12},{x,z:-halfZ-.12}].map(p=>({x:pose.x+c*p.x+s*p.z,z:pose.z-s*p.x+c*p.z}));
  return candidates.sort((a,b)=>Math.hypot(a.x-at.x,a.z-at.z)-Math.hypot(b.x-at.x,b.z-at.z)).find(clear)??null;
}
