import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { build } from 'esbuild';
import { createHash } from 'node:crypto';

// Departure reveal (PR #122 salvage, piece 1): presentation-only arrival
// reveal for the captured warship. Heat management, seeker arming, and all
// combat rules are untouched by this piece.

async function load(path) {
  const result = await build({entryPoints:[path],bundle:true,format:'esm',write:false,logLevel:'silent'});
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}
const w = await load('src/game/space3d/Warship.ts');

// ---- reveal constants ----
assert.equal(w.WARSHIP_REVEAL_SECONDS, 3.8, 'reveal runs 3.8s');
assert.equal(w.WARSHIP_FRAMES, 3, 'three atlas frames');
assert.equal(w.WARSHIP_FRAME_WIDTH, 512);
assert.equal(w.WARSHIP_FRAME_HEIGHT, 384);
assert.equal(w.WARSHIP_ASSET, 'captured_warship');
// No battery or combat surface in this module.
assert.ok(!('BATTERY_PAIRS' in w), 'battery pairs must not be salvaged');
assert.ok(!('batteryShot' in w), 'batteryShot must not be salvaged');

// ---- manifest slot + pinned atlas ----
const manifest = JSON.parse(readFileSync('public/assets/manifest.json','utf8'));
const asset = manifest.ships[w.WARSHIP_ASSET];
assert.ok(asset, 'manifest must have the captured_warship slot');
assert.equal(asset.src, '/assets/ships/captured_warship.webp', 'runtime must load locally');
assert.equal(asset.type, 'spritesheet');
assert.equal(asset.sheet.frames, w.WARSHIP_FRAMES);
assert.equal(asset.sheet.frameWidth, w.WARSHIP_FRAME_WIDTH);
assert.equal(asset.sheet.frameHeight, w.WARSHIP_FRAME_HEIGHT);
const size = statSync(`public${asset.src}`).size;
assert.equal(size, 35540, 'atlas must be the approved 35,540-byte render');
assert.ok(size < 64*1024, 'runtime atlas budget 64 KiB');
assert.equal(
  createHash('sha256').update(readFileSync(`public${asset.src}`)).digest('hex'),
  'ad7b70c6c687170c301b433e3fa75a7bec9134dca91f94d1c51d365229ad9f3b',
  'only the approved Blender-derived runtime atlas belongs in this slot',
);

// ---- wiring in the game ----
const game = readFileSync('src/game/space3d/Space3DGame.ts','utf8');
assert.ok(game.includes("getImage('ships', 'captured_warship')"), 'manifest entry must have an actual consumer');
assert.ok(game.includes('drawCapturedWarship'), 'reveal painter must exist');
assert.ok(/arrivalClock < WARSHIP_REVEAL_SECONDS/.test(game), 'reveal must be clock-gated at 3.8s');
assert.ok(game.includes("this.mode === 'arrival') this.drawCapturedWarship"), 'reveal draws in arrival mode');
assert.ok(game.includes("!(this.mode === 'arrival' && this.arrivalClock < WARSHIP_REVEAL_SECONDS)) this.drawReticle()"),
  'reticle must stay holstered during the reveal');
assert.ok(game.includes('captureReveal:'), 'cockpit state must carry the reveal flag');
// Heat is kept: the reveal must not have touched it.
assert.ok(game.includes('gunHeat'), 'heat state must survive the reveal');
assert.ok(/const HEAT_MAX_SLOWDOWN = 2\.1/.test(game), 'heat constants must survive the reveal');

const cockpit = readFileSync('src/game/space3d/Cockpit.ts','utf8');
assert.ok(cockpit.includes('captureReveal?: boolean'), 'cockpit state must declare the reveal flag');
assert.ok(cockpit.includes('if (!state.captureReveal) this.drawAttitude'), 'attitude must park during the reveal');
assert.ok(cockpit.includes("'DRAG TO FLY'"), 'drag-to-fly label must exist');
assert.ok(cockpit.includes('gunHeat: number'), 'cockpit heat readout must survive the reveal');

console.log('warship-reveal: OK — 3.8s presentation reveal, pinned atlas, reticle/attitude gating, heat untouched.');
