import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {AnimationMixer,Box3,Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const catalog=JSON.parse(readFileSync('public/assets/manifest.json','utf8'));
const entry=catalog.models.mr_zamn,bytes=readFileSync(`public${entry.src}`);
assert.equal(entry.bytes,bytes.length);assert.ok(bytes.length<4_000_000);
assert.equal(entry.sha256,createHash('sha256').update(bytes).digest('hex'));
const length=bytes.readUInt32LE(12),doc=JSON.parse(bytes.subarray(20,20+length));
assert.equal(doc.skins.length,1);assert.equal(doc.images.length,3);assert.ok(doc.meshes.length<=10);
assert.deepEqual(doc.animations.map(a=>a.name).sort(),['Hit','Idle','Interact']);
assert.ok(doc.buffers.every(buffer=>!buffer.uri)&&doc.images.every(image=>!image.uri));
assert.ok(doc.materials.some(material=>material.name==='TruFi blue'));
assert.ok(doc.materials.every(material=>!material.name.startsWith('Liquidity')),'crew retains blue identity');
globalThis.self=globalThis;
globalThis.createImageBitmap=async()=>({width:1024,height:1024,close(){}});
const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length),'');
gltf.scene.updateMatrixWorld(true);
assert.ok(Math.abs(new Box3().setFromObject(gltf.scene).getSize(new Vector3()).y-1.96)<.025);
let triangles=0;
gltf.scene.traverse(object=>{if(object.isSkinnedMesh){triangles+=object.geometry.index.count/3;const w=object.geometry.attributes.skinWeight;for(let i=0;i<w.count;i++)assert.ok(Math.abs(w.getX(i)+w.getY(i)+w.getZ(i)+w.getW(i)-1)<.001);}});
assert.ok(triangles<50_000);
const mixer=new AnimationMixer(gltf.scene);
for(const clip of gltf.animations){
  mixer.stopAllAction();mixer.clipAction(clip).reset().play();let previous=null,travel=0;
  for(let i=0;i<10;i++){
    mixer.update(clip.duration/11);gltf.scene.updateMatrixWorld(true);
    const hand=gltf.scene.getObjectByName('Hand_R').getWorldPosition(new Vector3());
    assert.ok(hand.length()<2.6&&Number.isFinite(hand.length()));if(previous)travel+=hand.distanceTo(previous);previous=hand;
    gltf.scene.traverse(object=>{if(!object.isSkinnedMesh)return;for(let j=0;j<object.geometry.attributes.position.count;j+=257){const v=new Vector3().fromBufferAttribute(object.geometry.attributes.position,j);object.applyBoneTransform(j,v);assert.ok(Number.isFinite(v.length())&&v.length()<3,'finite bounded crew skin');}});
  }
  assert.ok(travel>.0001,`${clip.name} animates the actual rig`);
}
console.log(`crew: OK — ${bytes.length} bytes, ${triangles} triangles, distinct blue material, three actual skinned clips and bounded palm nodes.`);
