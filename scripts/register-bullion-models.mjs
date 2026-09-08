import {readFileSync,writeFileSync,copyFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root=process.argv[2];if(!root)throw Error('Pass the approved private master root');
const catalogPath='public/assets/manifest.json',catalog=JSON.parse(readFileSync(catalogPath,'utf8'));
const assets=[
 ['lex','characters/lex/exports/lex_canon_v12_runtime.glb',['bullion'],'Original source-aligned TruFi commander: broad brown-skinned adult face, bald head, black beard, fitted mirrored aviators, black/gunmetal armor, cobalt emblem and metal medallion. Four clips, three sockets and seven original maps. Private original JPEG is not embedded. BullionReachScene consumer.'],
 ['relief_hauler','worlds/bullion_reach/v01/relief_hauler.glb',['bullion'],'Original metre-scale relief hauler, six wheel pivots and physical repair/cargo anchors. BullionReachScene renders two instances from one asset.'],
 ['market_siege_engine','worlds/bullion_reach/v01/market_siege_engine.glb',['bullion'],'Original moving siege artillery with four actual mortar anchors, rear control and sliding armor shutters. BullionReachScene consumer.'],
 ['bullion_freight_yard','worlds/bullion_reach/v03/bullion_freight_yard_runtime.glb',['bullion'],'Original freight yard from shared collision/layout data, real barricades and scanner. One embedded original generated mineral albedo; private master remains outside runtime.'],
 ['planet_bullion_reach','worlds/bullion_reach/v01/planet_bullion_reach.glb',['space'],'Original fictional mineral globe using procedural geometry and vertex colors. Fog-to-Bullion route and earned return-orbit consumer.'],
];
for(const [id,relative,scenes,notes] of assets){const bytes=readFileSync(root+'/'+relative),src='/assets/models/'+id+'.glb';copyFileSync(root+'/'+relative,'public'+src);catalog.models[id]={src,type:'model',scenes,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),notes};}
for(const id of ['xrpman','space_regulator_drone','fighter_player','fighter_xrpl_striker','fighter_ledger_warden'])if(catalog.models[id])catalog.models[id].scenes=[...new Set([...catalog.models[id].scenes,'bullion'])];
writeFileSync(catalogPath,JSON.stringify(catalog,null,2)+'\n');console.log('Registered five consumed Bullion runtime derivatives; no raw master/reference images copied.');
