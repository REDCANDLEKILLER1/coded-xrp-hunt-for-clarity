import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Box3,DoubleSide,Raycaster,SRGBColorSpace,Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const catalog=JSON.parse(readFileSync('public/assets/manifest.json','utf8'));
const layout=JSON.parse(readFileSync('src/game/definitive/boarding-deck.json','utf8'));
const districts=JSON.parse(readFileSync('src/game/definitive/warship-districts.json','utf8'));
assert.ok(Array.isArray(districts)&&districts.length>0,'warship architecture registry cannot be empty');
assert.equal(new Set(districts.map(d=>d.model)).size,districts.length,'each warship district model is registered once');
const tagged=Object.entries(catalog.models).filter(([,entry])=>entry.scenes?.includes('warship_district')).map(([id])=>id).sort();
assert.deepEqual(tagged,districts.map(d=>d.model).sort(),'every manifested warship district is enrolled in architecture validation');

const vendorRoot='scripts/vendor/kenney-space-station-kit';
const license=readFileSync(`${vendorRoot}/LICENSE-KENNEY.txt`,'utf8');
assert.match(license,/Creative Commons Zero|CC0/i,'vendored architecture must retain its CC0 license receipt');
for(const name of ['balcony-floor.glb','balcony-rail.glb','computer-wide.glb','display-wall-wide.glb','stairs.glb','structure-barrier-high.glb','wall-window.glb','Textures/colormap.png'])assert.ok(statSync(`${vendorRoot}/${name}`).size>0,`vendored module ${name} is present`);

globalThis.self=globalThis;globalThis.createImageBitmap=async()=>({width:1024,height:1024,close(){}});
const loader=new GLTFLoader(),results=[];
for(const district of districts){
  const entry=catalog.models[district.model];assert.ok(entry,`registered district ${district.model} exists in manifest`);
  const bytes=readFileSync(`public${entry.src}`);
  assert.equal(entry.bytes,bytes.length);assert.equal(entry.sha256,createHash('sha256').update(bytes).digest('hex'));
  assert.ok(bytes.length<=district.maxBytes,`${district.model} stays inside its encoded phone budget`);
  const doc=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
  assert.ok((doc.images??[]).every(i=>!i.uri&&Number.isInteger(i.bufferView)),`${district.model} embeds textures instead of making surprise network requests`);
  const gltf=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length),'');gltf.scene.updateMatrixWorld(true);
  const geometry=[];let triangles=0;
  gltf.scene.traverse(o=>{if(o.isMesh){geometry.push(o);o.material.side=DoubleSide;triangles+=o.geometry.index?.count/3??o.geometry.attributes.position.count/3;if(o.material.map)assert.equal(o.material.map.colorSpace,SRGBColorSpace);}});
  assert.ok(triangles<=district.maxTriangles,`${district.model} triangle budget`);
  assert.ok(geometry.length<=district.maxSurfaces,`${district.model} draw-surface budget`);
  const liveBytes=[...new Set(['xrpman','mr_zamn',district.model,...(district.residentModels??[])])].reduce((sum,id)=>sum+catalog.models[id].bytes,0)+Math.max(...['fighter_player','fighter_xrpl_striker','fighter_ledger_warden'].map(id=>catalog.models[id].bytes))+900_000;
  assert.ok(liveBytes<=district.maxLiveBytes,`${district.model} plus hero, crew, fighter and renderer reserve stays in its live phone budget`);
  results.push({district,gltf,geometry,triangles,bytes:bytes.length,liveBytes});
}

const boarding=results.find(result=>result.district.id==='boarding');assert.ok(boarding&&boarding.district.model==='boarding_deck');
const {gltf,geometry}=boarding,ray=new Raycaster();let samples=0;
const boardingBytes=readFileSync(`public${catalog.models.boarding_deck.src}`),boardingDoc=JSON.parse(boardingBytes.subarray(20,20+boardingBytes.readUInt32LE(12)));
assert.equal(boardingDoc.images.length,3,'boarding deck keeps its measured three-texture material set');
for(const room of layout.rooms){
  const group=gltf.scene.getObjectByName(`Deck_${room.id}`);assert.ok(group);
  const box=new Box3().setFromObject(group),center=box.getCenter(new Vector3()),size=box.getSize(new Vector3());
  assert.ok(Math.abs(center.x-room.x)<.1&&Math.abs(center.z-room.z)<.1,'architecture follows navigation room origin');
  const heightLimit=room.id==='rescue'?3.05:1.3;
  assert.ok(size.x<=room.width+.5&&size.z<=room.depth+.5&&box.max.y<heightLimit,'cutaway envelope preserves measured deck; only the two-level Atrium receives extra height');
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
console.log(`boarding-architecture: OK — ${results.length} enrolled district model(s); boarding ${boarding.triangles} triangles / ${geometry.length} surfaces, ${samples} floor samples, ${layout.doors.length} open doorways, ${boarding.liveBytes} live bytes within budget.`);
