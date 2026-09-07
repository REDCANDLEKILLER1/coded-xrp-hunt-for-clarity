import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Box3,DoubleSide,Raycaster,SRGBColorSpace,Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const catalog=JSON.parse(readFileSync('public/assets/manifest.json','utf8'));
const layout=JSON.parse(readFileSync('src/game/definitive/boarding-deck.json','utf8'));
const entry=catalog.models.boarding_deck,bytes=readFileSync(`public${entry.src}`);
assert.equal(entry.bytes,bytes.length);assert.equal(entry.sha256,createHash('sha256').update(bytes).digest('hex'));
assert.ok(bytes.length<4_200_000);
const doc=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
assert.ok(doc.images.length===3&&doc.images.every(i=>!i.uri&&Number.isInteger(i.bufferView)));
const boardingBytes=['xrpman','mr_zamn','boarding_deck'].reduce((sum,id)=>sum+catalog.models[id].bytes,0)+Math.max(...['fighter_player','fighter_xrpl_striker','fighter_ledger_warden'].map(id=>catalog.models[id].bytes));
assert.ok(boardingBytes+900_000<12*1024*1024,'largest boarding scene plus a reserved 900 KB renderer stays below 12 MiB');
globalThis.self=globalThis;globalThis.createImageBitmap=async()=>({width:1024,height:1024,close(){}});
const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length),'');gltf.scene.updateMatrixWorld(true);
const geometry=[];let triangles=0;
gltf.scene.traverse(o=>{if(o.isMesh){geometry.push(o);o.material.side=DoubleSide;triangles+=o.geometry.index.count/3;if(o.material.map)assert.equal(o.material.map.colorSpace,SRGBColorSpace);}});
assert.ok(triangles<60_000&&geometry.length<=32);
const ray=new Raycaster();let samples=0;
for(const room of layout.rooms){
  const group=gltf.scene.getObjectByName(`Deck_${room.id}`);assert.ok(group);
  const box=new Box3().setFromObject(group),center=box.getCenter(new Vector3()),size=box.getSize(new Vector3());
  assert.ok(Math.abs(center.x-room.x)<.1&&Math.abs(center.z-room.z)<.1,'architecture follows navigation room origin');
  assert.ok(size.x<=room.width+.5&&size.z<=room.depth+.5&&box.max.y<1.3,'cutaway envelope preserves measured deck');
  for(let i=0;i<9;i++)for(let j=0;j<9;j++){
    const x=room.x+(i/8-.5)*(room.width-2),z=room.z+(j/8-.5)*(room.depth-2);
    ray.set(new Vector3(x,2,z),new Vector3(0,-1,0));ray.far=3;
    assert.ok(ray.intersectObject(group,true).some(hit=>Math.abs(hit.point.y)<.08),'plate or continuous pressure floor beneath its narrow seams');samples++;
  }
}
for(const door of layout.doors){
  const axis=door.axis==='x'?new Vector3(1,0,0):new Vector3(0,0,1);
  ray.set(new Vector3(door.x,.6,door.z).addScaledVector(axis,-2),axis);ray.far=4;
  assert.equal(ray.intersectObjects(geometry,false).length,0,'authored wall geometry leaves the navigation door open');
}
console.log(`boarding-architecture: OK — ${triangles} triangles / ${geometry.length} surfaces, ${samples} floor samples, seven open doorways, ${boardingBytes} model bytes and reserved renderer within 12 MiB.`);
