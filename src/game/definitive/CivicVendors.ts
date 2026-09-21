import {AnimationMixer,type AnimationClip,type Mesh,type MeshStandardMaterial} from 'three';
import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';
import type {GLTF} from 'three/addons/loaders/GLTFLoader.js';

/** Two independent skeletons share one downloaded geometry set. */
export function createCivicVendors(asset:GLTF,clips:AnimationClip[]){
    const mixers:AnimationMixer[]=[];
    const vendorRoots=[asset.scene,cloneSkeleton(asset.scene)];
    vendorRoots.forEach((vendor,index)=>{
      vendor.position.set(-26,0,index===0?6.5:-13.5);
      vendor.rotation.y=0;
      vendor.traverse(node=>{const object=node as Mesh;if((object as Mesh).isMesh){const wasArray=Array.isArray(object.material);const materials=(wasArray?object.material as MeshStandardMaterial[]:[object.material as MeshStandardMaterial]).map(source=>{const material=(index===0?source:source.clone()) as MeshStandardMaterial;if(material.name==='Vendor trade cloth')material.color.setHex(index===0?0xd5e9e3:0x34495c);if(material.name==='Vendor ledger trim')material.color.setHex(index===0?0x218f85:0xc99547);return material;});object.material=wasArray?materials:materials[0];}});
      const mixer=new AnimationMixer(vendor);
      const idle=clips.find(clip=>clip.name==='Idle');if(idle)mixer.clipAction(idle).play();
      mixer.setTime(index*.6);mixers.push(mixer);
    });
    return {roots:vendorRoots,mixers};
}
