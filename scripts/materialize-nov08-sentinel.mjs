// CODED: deterministic assembly of the mobile-optimized Nov 8 XRPMan model.
// Parts are byte-identical Git blobs staged outside public/. The browser sees one GLB.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';

const PARTS=[600000,600000,600000,600000,600000,600000,320284];
const SHA256='de9143986d77a5b9671c748f4ee16d59f5e1d33d0b95da0f372a95118ef06944';
const TARGET='public/assets/models/xrpman_sentinel_nov08.glb';
const chunks=PARTS.map((expected,index)=>{
  const file=join('build-assets',`xrpman_nov08_run.glb.part${index}`);
  const bytes=readFileSync(file);
  if(bytes.length!==expected)throw new Error(`Invalid Nov08 Sentinel part ${index}: expected ${expected} bytes, got ${bytes.length}`);
  return bytes;
});
const assembled=Buffer.concat(chunks);
if(assembled.length!==3920284)throw new Error('Incorrect Sentinel GLB length');
const sha=createHash('sha256').update(assembled).digest('hex');
if(sha!==SHA256)throw new Error(`Sentinel GLB checksum mismatch: ${sha}`);
if(assembled.toString('ascii',0,4)!=='glTF'||assembled.readUInt32LE(4)!==2||assembled.readUInt32LE(8)!==assembled.length)throw new Error('Invalid Sentinel GLB header');
const chunkLength=assembled.readUInt32LE(12);
const doc=JSON.parse(assembled.subarray(20,20+chunkLength).toString('utf8'));
if(doc.skins?.length!==1||doc.skins[0].joints.length!==66)throw new Error('Sentinel skeleton contract changed');
if(doc.meshes?.length!==1||doc.images?.length!==3)throw new Error('Sentinel geometry/texture contract changed');
const names=doc.animations?.map(animation=>animation.name);
if(JSON.stringify(names)!==JSON.stringify(['Running','Walking','Idle']))throw new Error('Sentinel motion clips changed');
if(!existsSync(TARGET)||!readFileSync(TARGET).equals(assembled)){
  mkdirSync('public/assets/models',{recursive:true});
  writeFileSync(TARGET,assembled);
}
console.log(`sentinel: verified ${assembled.length} bytes, sha256 ${sha}, 66 joints, Running/Walking/Idle`);
