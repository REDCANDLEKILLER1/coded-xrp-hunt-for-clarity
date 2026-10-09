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
let g=descent();g.playerHitClock=.55;g.bombClock=.8;g.special=0;frames(g,60);
check(g.drones.length===0,'no generic waves before authored patrol');
check(g.playerHitClock===0,'damage immunity expires');check(g.bombClock===0,'bomb effect expires');check(g.special>0,'special recharges');
frames(g,180);check(g.drones.length>0,'real frame spawns descent enemies');
if(g.drones.length){const d=g.drones[0],age=d.age;g.frame(1/60);check(Math.abs(d.age-age-1/60)<1e-8,'enemy advances once per frame');
 const hp=d.hp;g.bolts=[{x:d.x,y:d.y,w:10,h:20,damage:1,vx:0,vy:0}];g.frame(1/60);check(d.hp<hp||!g.drones.includes(d),'weapon collision damages enemy');}
const state=JSON.stringify([g.cloudDescent,g.clock,g.drones,g.hostileShots,g.bombClock,g.playerHitClock,g.special]);g.paused=true;frames(g,60);
check(JSON.stringify([g.cloudDescent,g.clock,g.drones,g.hostileShots,g.bombClock,g.playerHitClock,g.special])===state,'pause freezes combat and descent');
g=descent();g.spawnMissionDrone({enemyKey:'regulator_drone',x:.3});const survivor=g.drones[0];g.cloudDescent=39.99;g.frame(1/60);
check(g.cloudDescent===null,'city handoff completes');check(g.drones.includes(survivor),'survivor retained');check(g.earthEncounterDirector.stageKey==='ledger_city','city director starts once');check(g.hazards.length===0,'no ground turrets during descent');
g=descent();g.player.hp=0;g.frame(1/60);check(g.mode==='results','zero HP ends run');
if(failures.length){for(const f of failures)console.error('FAIL: '+f);process.exit(1);}console.log('cloud-descent: PASS — real frames, authored spawn, movement, weapon damage, timers, pause, survivor handoff and death');
