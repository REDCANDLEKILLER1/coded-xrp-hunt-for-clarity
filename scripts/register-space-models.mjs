import {readFileSync,writeFileSync,copyFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const master=process.argv[2];if(!master)throw Error('Pass the private master root');
const path='public/assets/manifest.json',catalog=JSON.parse(readFileSync(path,'utf8'));
for(const key of ['regulator_drone','fast_scout','fog_raider','rug_fighter','whale_scout','earth','mars']){
  const planet=['earth','mars'].includes(key),id=`${planet?'planet':'space'}_${key}`;
  const source=planet?`${master}/planets/runtime_v01/${key}.glb`:`${master}/enemies/space_v01/${key}/${key}.glb`;
  const bytes=readFileSync(source);const src=`/assets/models/${id}.glb`;copyFileSync(source,`public${src}`);
  catalog.models[id]={src,type:'model',scenes:['space'],bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),notes:planet?`World-space sphere; 1024x512 NASA surface map. See docs/definitive/SPACE_ASSET_CREDITS.md. SpaceScene consumer.`:`Original textured Blender mesh; five attachment nodes. SpaceScene ${key} doctrine consumer. Private editable master retained.`};
}
catalog.models.regulatory_warship.scenes=['model_review','space'];
writeFileSync(path,JSON.stringify(catalog,null,2)+'\n');
console.log('Registered seven optimized space models with hashes and actual scene consumers.');
