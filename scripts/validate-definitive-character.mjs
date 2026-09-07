import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { AnimationMixer, Box3, Vector3 } from 'three';
import { build } from 'esbuild';

const catalog = JSON.parse(readFileSync('public/assets/manifest.json','utf8'));
const entry = catalog.models.xrpman;
const bytes = readFileSync(`public${entry.src}`);
assert.equal(entry.type, 'model');
assert.equal(entry.bytes, bytes.length);
assert.equal(entry.sha256, createHash('sha256').update(bytes).digest('hex'));
assert.ok(bytes.length < 5_000_000, 'hero bundle budget');
const jsonLength = bytes.readUInt32LE(12);
const doc = JSON.parse(bytes.subarray(20,20+jsonLength).toString());
const binary = bytes.subarray(28+jsonLength);
assert.ok(doc.buffers.every(buffer => !buffer.uri));
assert.equal(doc.skins.length,1);
assert.ok(doc.meshes.length <= 10);
assert.equal(doc.images.length,3, 'embedded original albedo, normal and roughness');
for (const image of doc.images) {
  assert.ok(!image.uri, 'no external textures');
  const view = doc.bufferViews[image.bufferView];
  const data = binary.subarray(view.byteOffset,view.byteOffset+view.byteLength);
  assert.equal(data.subarray(1,4).toString(),'PNG');
  assert.ok(data.readUInt32BE(16)<=1024 && data.readUInt32BE(20)<=1024, 'texture limit');
}
const names=['Idle','Walk','Run','AimFire','Interact','Hit','Dodge','KnockdownRecover'];
assert.deepEqual(doc.animations.map(a=>a.name).sort(),names.slice().sort());
assert.ok(doc.animations.every(a=>a.channels.length>0 && a.channels.length<30),'redundant rest tracks removed');
for (const name of ['Hero_Origin','Hand_R','Hand_L']) assert.equal(doc.nodes.filter(n=>n.name===name).length,1);

// Node validates skin/animation decoding and PNG headers; real pixel decoding is
// checked in the browser. This bitmap stand-in supplies texture dimensions only.
globalThis.self = globalThis;
let textureCount=0;
globalThis.createImageBitmap=async()=>({width:1024,height:1024,close(){textureCount++;}});
const nativeFetch=globalThis.fetch;
globalThis.fetch=async(url, options)=>String(url).startsWith('blob:') ? nativeFetch(url,options) : new Response(String(url).endsWith('manifest.json')?JSON.stringify(catalog):bytes);
const compiled=await build({entryPoints:['src/game/definitive/ModelAssets.ts'],bundle:true,format:'esm',write:false,logLevel:'silent'});
const {loadModel,disposeObject}=await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
const gltf=await loadModel('xrpman',new AbortController().signal);
gltf.scene.updateMatrixWorld(true);
let triangles=0, skinCount=0;
gltf.scene.traverse(object=>{
  if (!object.isSkinnedMesh) return;
  skinCount++;
  const geometry=object.geometry;
  triangles+=geometry.index.count/3;
  const weights=geometry.attributes.skinWeight, joints=geometry.attributes.skinIndex;
  for (let i=0;i<weights.count;i++) {
    const sum=weights.getX(i)+weights.getY(i)+weights.getZ(i)+weights.getW(i);
    assert.ok(Math.abs(sum-1)<.001,`normalized skin weight: ${i}`);
    for(let k=0;k<4;k++) assert.ok(joints.array[i*4+k]<object.skeleton.bones.length);
  }
});
assert.equal(skinCount,10);
assert.ok(triangles<50_000 && triangles>25_000);
const box=new Box3().setFromObject(gltf.scene);
assert.ok(Math.abs(box.getSize(new Vector3()).y-1.9304)<.015,'canonical 6 ft 4 in height');
const attachmentPositions=()=>['Hand_R','Hand_L'].map(name=>gltf.scene.getObjectByName(name).getWorldPosition(new Vector3()));
const base=attachmentPositions();
assert.ok(base.every(v=>v.length()<2.5),'hand nodes stay with the character');
const mixer=new AnimationMixer(gltf.scene);
mixer.clipAction(gltf.animations.find(clip=>clip.name==='AimFire')).play();
mixer.update(.2); gltf.scene.updateMatrixWorld(true);
const aim=attachmentPositions();
assert.ok(aim[0].z-base[0].z>.3, 'firing hand reaches forward along the GLB +Z axis');
assert.ok(aim[0].distanceTo(aim[1])>.25, 'hand sockets remain distinct');
let palmDistance=Infinity;
gltf.scene.traverse(object=>{
  if(!object.isSkinnedMesh)return;
  for(let i=0;i<object.geometry.attributes.position.count;i++){
    const v=new Vector3().fromBufferAttribute(object.geometry.attributes.position,i);object.applyBoneTransform(i,v);v.applyMatrix4(object.matrixWorld);
    palmDistance=Math.min(palmDistance,v.distanceTo(aim[0]));
  }
});
assert.ok(palmDistance<.06,'the firing socket touches the actual posed hand surface');
mixer.stopAllAction();
const movement={};
for (const clip of gltf.animations) {
  mixer.stopAllAction();
  const action=mixer.clipAction(clip).reset().play();
  let variation=0;
  let previous=null;
  for (let step=0;step<12;step++) {
    mixer.update(clip.duration/13); gltf.scene.updateMatrixWorld(true);
    const pose=[];
    gltf.scene.traverse(object=>{
      if (!object.isSkinnedMesh) return;
      for (let i=0;i<object.geometry.attributes.position.count;i+=179) {
        const v=new Vector3().fromBufferAttribute(object.geometry.attributes.position,i);
        object.applyBoneTransform(i,v);
        assert.ok([v.x,v.y,v.z].every(Number.isFinite),'finite deformed vertices');
        assert.ok(v.length()<3,'no exploding skin'); pose.push(v);
      }
    });
    if(previous) variation+=pose.reduce((sum,v,i)=>sum+v.distanceTo(previous[i]),0);
    previous=pose;
  }
  movement[clip.name]=Number(variation.toFixed(4));
  assert.ok(variation>.003,`${clip.name} deforms actual skin`);
  action.stop();
}
mixer.stopAllAction(); mixer.uncacheRoot(gltf.scene);
disposeObject(gltf.scene);
assert.equal(textureCount,3,'embedded textures disposed');
console.log('definitive-character: OK',JSON.stringify({bytes:bytes.length,triangles,skinCount,clips:movement}));
