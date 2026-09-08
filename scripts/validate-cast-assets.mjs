import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {AnimationMixer,Box3,Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
globalThis.self=globalThis;globalThis.createImageBitmap=async()=>({width:1024,height:1024,close(){}});
const catalog=JSON.parse(readFileSync('public/assets/manifest.json','utf8'));
const limits={corn:{triangles:80000,clips:['Hit','Idle','Interact'],images:6},lex:{triangles:50000,clips:['Hit','Idle','Interact','Walk'],images:7},boo:{triangles:45000,clips:['Glide','Idle','Interact'],images:3}};
let samples=0;
for(const [id,limit] of Object.entries(limits)){
 const entry=catalog.models[id],raw=readFileSync('public'+entry.src);assert.equal(raw.length,entry.bytes);assert.equal(createHash('sha256').update(raw).digest('hex'),entry.sha256);
 const doc=JSON.parse(raw.subarray(20,20+raw.readUInt32LE(12)));assert.equal(doc.skins.length,1);assert.equal(doc.images.length,limit.images);assert.deepEqual(doc.animations.map(a=>a.name).sort(),limit.clips);
 assert.ok(doc.buffers.every(b=>!b.uri)&&doc.images.every(i=>!i.uri&&Number.isInteger(i.bufferView)),'runtime textures are self-contained');
 let triangles=0;
 for(const mesh of doc.meshes)for(const primitive of mesh.primitives){
  triangles+=(doc.accessors[primitive.indices??primitive.attributes.POSITION].count)/3;
  const material=doc.materials[primitive.material];
  const textures=[material.normalTexture,material.occlusionTexture,material.emissiveTexture,material.pbrMetallicRoughness?.baseColorTexture,material.pbrMetallicRoughness?.metallicRoughnessTexture].filter(Boolean);
  for(const texture of textures)assert.ok(Number.isInteger(primitive.attributes['TEXCOORD_'+(texture.texCoord??0)]),id+' has UV coordinates for every material map');
  assert.ok(Number.isInteger(primitive.attributes.JOINTS_0)&&Number.isInteger(primitive.attributes.WEIGHTS_0),id+' retains animation weights');
 }
 assert.ok(triangles<=limit.triangles,`${id} geometry budget: ${triangles}`);
 const gltf=await new GLTFLoader().parseAsync(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.length),'');const mixer=new AnimationMixer(gltf.scene);
 const names=id==='boo'?['Boo_Origin','Face_Focus','Pulse_Origin','Tail_Anchor']:['Hero_Origin','Hand_R','Hand_L'];
 for(const n of names)assert.ok(gltf.scene.getObjectByName(n),id+' socket '+n);
 for(const clip of gltf.animations){mixer.stopAllAction();mixer.clipAction(clip).play();for(let i=0;i<=8;i++){
  mixer.setTime(clip.duration*i/8);gltf.scene.updateMatrixWorld(true);gltf.scene.traverse(o=>{if(o.isSkinnedMesh){o.skeleton.update();o.computeBoundingBox();}});
  const box=new Box3().setFromObject(gltf.scene,true),size=box.getSize(new Vector3());assert.ok(size.toArray().every(x=>Number.isFinite(x)&&x>0&&x<3),`${id} ${clip.name} remains anatomically bounded`);
  for(const n of names)assert.ok(gltf.scene.getObjectByName(n).getWorldPosition(new Vector3()).toArray().every(Number.isFinite));samples++;
 }}
 console.log(`${id}: ${raw.length} bytes, ${triangles} triangles, ${doc.images.length} embedded images; animated bounds and sockets OK`);
}
console.log(`cast-assets: OK — ${samples} poses; material UV sets, embedded maps, geometry budgets and verified hashes.`);
