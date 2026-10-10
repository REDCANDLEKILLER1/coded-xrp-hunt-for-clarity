import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
const require=createRequire(import.meta.url);
const {createCanvas,loadImage}=require('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas/index.js');
globalThis.window={addEventListener(){},removeEventListener(){},dispatchEvent(){}};
globalThis.document={createElement(){const c=createCanvas(1,1);c.style={};c.setAttribute=()=>{};c.addEventListener=()=>{};return c;},addEventListener(){},removeEventListener(){}};
const b=await build({entryPoints:['src/game/space3d/Space3DGame.ts'],bundle:true,write:false,format:'esm'});
const {Space3DGame}=await import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'));
const atlas=await loadImage('public/assets/ships/captured_warship.webp');
for(const [name,w,h] of [['portrait',390,844],['landscape',844,390]]){
 const g=new Space3DGame({appendChild(){}});g.canvas.width=w;g.canvas.height=h;g.viewW=w;g.viewH=h;g.mode='arrival';g.arrivalClock=1.8;g.assets.getImage=(group,id)=>id==='captured_warship'?atlas:null;
 g.render();writeFileSync('docs/audits/warship-salvage/'+name+'.png',g.canvas.toBuffer('image/png'));
}
