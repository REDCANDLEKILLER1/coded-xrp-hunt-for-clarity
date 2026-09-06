import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DoubleSide, Raycaster, Vector3 } from 'three';
const layout=JSON.parse(readFileSync('src/game/definitive/boarding-deck.json','utf8'));
const bytes=readFileSync('public/assets/models/regulatory_warship.glb');
globalThis.self=globalThis;globalThis.createImageBitmap=async()=>({width:1024,height:1024,close(){}});
const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
gltf.scene.updateMatrixWorld(true);
const hull=[];
gltf.scene.traverse(object=>{
  if(object.isMesh&&/^(Armor|Door)/.test(object.material.name)){
    object.material.side=DoubleSide;hull.push(object);
  }
});
assert.ok(hull.length>0);
const ray=new Raycaster();let samples=0;const errors=[];
for(const room of layout.rooms){
  for(let i=0;i<=8;i++)for(let j=0;j<=8;j++){
    const x=room.x+(i/8-.5)*(room.width-.5),z=room.z+(j/8-.5)*(room.depth-.5);
    ray.set(new Vector3(x,30,z),new Vector3(0,-1,0));
    const hits=ray.intersectObjects(hull,false).map(hit=>hit.point.y);
    const floor=layout.frame.floorInShip;
    if(!hits.some(y=>y<floor-.1)||!hits.some(y=>y>floor+3.2))errors.push({room:room.id,x,z,hits});
    samples++;
  }
  assert.ok(room.z-room.depth/2>=-38,'usable deck stays forward of the engine block');
}
assert.deepEqual(errors,[],`interior floor and 3.2 m usable height must fit actual loaded hull (${errors.length} failures)`);
assert.equal(layout.rooms[0].z,layout.landing.entryInShip[2],'arrival bay aligns with the actual ventral boarding door');
console.log(`boarding-fit: OK — ${samples} actual GLB ray samples enclose the compact deck floor and 3.2 m clearance; engines excluded; arrival bay aligned.`);
