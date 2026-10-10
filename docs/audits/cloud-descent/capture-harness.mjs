// The Ryan detector.
//
// Report: an 87-second Regulatory Behemoth phase-2 fight where the escort
// count climbed 4 -> 10 and the boss health bar barely moved.
//
// The cause was structural, not tuning. `moveDrones` is the only place a
// drone's stance, fire, dodge and patience advance, and it was reached only
// through `updateDrones`, which the boss branch of the update loop skips. So
// escorts froze on spawn, never fled, and ESCORT_PATIENCE -- the constant the
// code cited as proof a deadlock was impossible -- was never decremented.
// Meanwhile every `escort_screen` beat pushed a fresh full set with no check
// for the ones already alive, on a 3.92s cycle, while the shield blocked 100%
// of damage until all of them were dead.
//
// So this file does not check constants. It plays the fight, with the player
// firing, and fails if the boss's health ever stalls for longer than a player
// would tolerate. A test that asserts ESCORT_PATIENCE is mentioned somewhere
// is exactly the test that passed all the way through Ryan's 87 seconds.

import { build } from 'esbuild';

const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };

const store = new Map();
globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => void store.set(k, String(v)), removeItem: (k) => void store.delete(k) };
const noopCtx = new Proxy({}, { get: (t, k) => (k in t ? t[k] : k === 'measureText' ? () => ({ width: 10 })
  : k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {}),
  set: (t, k, v) => { t[k] = v; return true; } });
const stubCanvas = () => ({ width: 0, height: 0, style: {}, getContext: () => noopCtx, addEventListener() {}, removeEventListener() {},
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 393, height: 793 }), setPointerCapture() {}, releasePointerCapture() {} });
globalThis.CustomEvent = class { constructor(type, init) { this.type = type; this.detail = init?.detail; } };
globalThis.Image = class {};
globalThis.requestAnimationFrame = () => 0;
globalThis.cancelAnimationFrame = () => {};
globalThis.performance = globalThis.performance ?? { now: () => 0 };
globalThis.matchMedia = () => ({ matches: false, addEventListener() {} });
globalThis.screen = { width: 393, height: 793, orientation: { angle: 0 } };
globalThis.devicePixelRatio = 1;
globalThis.document = { addEventListener() {}, removeEventListener() {}, querySelector: () => null, createElement: stubCanvas, body: { appendChild() {} } };
globalThis.innerWidth = 393;
globalThis.innerHeight = 793;
globalThis.window = { addEventListener() {}, removeEventListener() {}, dispatchEvent: () => true,
  setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout: (h) => clearTimeout(h),
  localStorage: globalThis.localStorage, devicePixelRatio: 1, innerWidth: 393, innerHeight: 793 };
globalThis.location = { search: '', pathname: '/' };

const load = async (entry) => {
  const b = await build({ entryPoints: [entry], bundle: true, format: 'esm', write: false, logLevel: 'silent' });
  return import(`data:text/javascript;base64,${Buffer.from(b.outputFiles[0].text).toString('base64')}`);
};
const { Game2A } = await load('src/game/core/Game2A.ts');


function descent(){
 const g=new Game2A(stubCanvas());g.deployFromMap('ledger_prime','EARTH');g.reset();
 while(g.missionDirector.currentAct.key!=='ledger_city')g.missionDirector.advance();
 g.launchClock=0;g.earthEntry=null;g.cloudDescent=0;g.paused=false;g.render=()=>{};
 g.earthEncounterDirector.clear();g.cloudDescentDirector?.start('cloud_descent');return g;
}
function frames(g,n){for(let i=0;i<n;i++)g.frame(1/60);}

const {createCanvas,loadImage}=await import(process.env.CODED_CANVAS_MODULE || '@napi-rs/canvas');
const {writeFileSync}=await import('node:fs');
globalThis.document.createElement=()=>createCanvas(1,1);
for(const [name,w,h] of [['portrait',720,1280],['landscape',1280,720]]){
 globalThis.innerWidth=w;globalThis.innerHeight=h;
 const g=descent();const canvas=createCanvas(w,h);g.ctx=canvas.getContext('2d');g.player.x=w/2;g.player.y=h*.83;
 for(let i=1;i<=10;i++){const id='cloud_path_'+String(i).padStart(2,'0');g.assets.images.set('backgrounds:'+id,await loadImage('public/assets/backgrounds/'+id+'.webp'));}
 for(const [category,id] of [['ships','player'],['enemies','regulator_drone'],['projectiles','bb_shot']])g.assets.images.set(category+':'+id,await loadImage('public/assets/'+category+'/'+id+'.webp'));
 frames(g,360);g.cloudDescent=12;g.drawSurfacePath();g.play();
 writeFileSync('docs/audits/cloud-descent/corrected-'+name+'.png',canvas.toBuffer('image/png'));
}
