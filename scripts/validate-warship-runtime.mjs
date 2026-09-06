import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { build } from 'esbuild';
import { createHash } from 'node:crypto';

async function load(path) {
  const result = await build({entryPoints:[path], bundle:true, format:'esm', write:false, logLevel:'silent'});
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}
const w = await load('src/game/space3d/Warship.ts');
const {project} = await load('src/game/space3d/Projection.ts');
const hardpoints = w.BATTERY_PAIRS.flat();
assert.equal(new Set(hardpoints).size, 4);
assert.equal(Object.keys(w.WARSHIP_NODES).length, 9);
const camera = {x:500,y:-120,z:900,yaw:0,pitch:0,roll:0,cx:195,cy:422,focal:470};
let attitudes = 0;
for (const yaw of [-Math.PI, -1, 0, 1, Math.PI]) {
  for (const pitch of [-Math.PI/2, -.7, 0, .7, Math.PI/2]) {
    for (const roll of [-1, 0, 1]) {
      const c = {...camera,yaw,pitch,roll};
      const origins = [];
      for (const name of hardpoints) {
        const {origin,direction,target} = w.batteryShot(c,name);
        origins.push(JSON.stringify(origin));
        assert.ok(Object.values(direction).every(Number.isFinite));
        assert.ok(Math.abs(Math.hypot(...Object.values(direction))-1)<1e-10);
        const length = Math.hypot(target.x-origin.x,target.y-origin.y,target.z-origin.z);
        const dot = (direction.x*(target.x-c.x)+direction.y*(target.y-c.y)+direction.z*(target.z-c.z))/w.WARSHIP_AIM_DISTANCE;
        assert.ok(dot > .99, 'every barrel must fire forward, including at the pitch poles');
        for (const axis of ['x','y','z']) assert.ok(Math.abs(origin[axis]+direction[axis]*length-target[axis])<1e-8);
        const aim = project(c,target.x,target.y,target.z);
        assert.ok(aim.visible && Math.abs(aim.sx-c.cx)<1e-8 && Math.abs(aim.sy-c.cy)<1e-8);
      }
      assert.equal(new Set(origins).size,4);
      const center=w.nodePosition(c,'Ship_Origin');
      const point=(x,y,z)=>{const d=w.shipOffset(c,{x,y,z});return {x:center.x+d.x,y:center.y+d.y,z:center.z+d.z};};
      assert.ok(w.hitsWarship(c,point(0,0,-200),point(0,0,200)), 'fast segment must hit');
      assert.ok(!w.hitsWarship(c,point(25,0,-200),point(25,0,200)), 'outside narrow hull must miss');
      assert.ok(w.hitsWarship(c,point(25,0,-200),point(25,0,200),2), 'missile radius must expand hull');
      assert.ok(w.hitsWarship(c,center,center), 'stationary overlap');
      assert.ok(!w.hitsWarship(c,point(0,16,0),point(0,16,0)), 'outside vertical hull');
      attitudes++;
    }
  }
}
assert.ok(w.nodePosition(camera,'Muzzle_FL').x < w.nodePosition(camera,'Muzzle_FR').x, 'port must project left');
globalThis.window = {addEventListener() {}};
const {Space3DGame}=await load('src/game/space3d/Space3DGame.ts');
const game=Object.create(Space3DGame.prototype);
Object.assign(game,{camera,keys:new Set([' ']),weaponPointers:new Map(),tapFiring:false,tapFireFloor:0,gunClock:0,batteryPair:0,bolts:[],batteryCounts:Object.fromEntries(hardpoints.map(n=>[n,0]))});
for(let i=0;i<1200;i++) game.fireGuns(1/60);
const counts=Object.values(game.batteryCounts);
assert.ok(Math.min(...counts)>50 && Math.max(...counts)-Math.min(...counts)<=1, 'hold must sustain all four barrels evenly');
const fired=game.bolts.length;
game.keys.clear();
for(let i=0;i<60;i++) game.fireGuns(1/60);
assert.equal(game.bolts.length,fired,'release must stop firing');
game.weaponPointers.set(7,'guns');
game.fireGuns(1/60);
assert.equal(game.bolts.length,fired+2,'touch gun hold must use same battery');
const manifest=JSON.parse(readFileSync('public/assets/manifest.json','utf8'));
const asset=manifest.ships[w.WARSHIP_ASSET];
assert.equal(asset.sheet.frames,w.WARSHIP_FRAMES);
assert.equal(asset.sheet.frameWidth,w.WARSHIP_FRAME_WIDTH);
assert.equal(asset.sheet.frameHeight,w.WARSHIP_FRAME_HEIGHT);
assert.ok(statSync(`public${asset.src}`).size<64*1024,'runtime atlas budget 64 KiB');
assert.equal(asset.src, '/assets/ships/captured_warship.webp', 'runtime must load locally, never from the master archive');
assert.equal(createHash('sha256').update(readFileSync(`public${asset.src}`)).digest('hex'),'ad7b70c6c687170c301b433e3fa75a7bec9134dca91f94d1c51d365229ad9f3b','only the approved Blender-derived runtime atlas belongs in this slot');
const main=readFileSync('src/main.ts','utf8').replace(/\r\n/g,'\n');
const handoff=main.split("window.addEventListener('coded:boarding-complete'")[1]?.split('\n});')[0] ?? '';
assert.ok(handoff.includes('space.show(') && handoff.includes('onFoot.hide('), 'capture must reach the existing 3D route');
const source=readFileSync('src/game/space3d/Space3DGame.ts','utf8');
assert.ok(source.includes("getImage('ships', WARSHIP_ASSET)"),'manifest entry must have actual consumer');
assert.ok(source.includes('const TILT_STEERING = false'),'finger-drag remains primary');
assert.ok(!source.includes('gunHeat'),'no primary heat gating');
console.log(`Warship runtime: ${attitudes} attitudes, four origins, reticle convergence, swept hull, sustained/released/touch battery and manifest budget passed.`);
