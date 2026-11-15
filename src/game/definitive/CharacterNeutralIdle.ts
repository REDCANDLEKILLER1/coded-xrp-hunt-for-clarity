import {
  AnimationClip,Bone,Object3D,QuaternionKeyframeTrack,VectorKeyframeTrack,
  type KeyframeTrack,
} from 'three';

/**
 * The November 8 Meshy "Idle" was sampled from a walking stride and holds an
 * asymmetric shoulder/arm swing. Use the unchanged skin's neutral rig pose
 * instead: both arms naturally hang at the thighs in the native bind pose.
 *
 * UUID bindings target the *loaded instance* and avoid Mixamo colon/name
 * sanitization differences. This does not alter the source GLB or run clip.
 */
export function makeNeutralXRPManIdle(root:Object3D):AnimationClip {
  const tracks:KeyframeTrack[]=[];
  const frames=[0,1];
  root.traverse(object=>{
    if(!(object instanceof Bone))return;
    const path=object.uuid;
    const position=object.position.toArray(),rotation=object.quaternion.toArray(),scale=object.scale.toArray();
    tracks.push(new VectorKeyframeTrack(`${path}.position`,frames,[...position,...position]));
    tracks.push(new QuaternionKeyframeTrack(`${path}.quaternion`,frames,[...rotation,...rotation]));
    tracks.push(new VectorKeyframeTrack(`${path}.scale`,frames,[...scale,...scale]));
  });
  if(tracks.length<3*60)throw new Error('Neutral XRPMan idle needs the verified full skeletal rig');
  return new AnimationClip('Idle',1,tracks);
}
