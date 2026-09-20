// What can a new warship district actually spend?
//
// Deliberately NOT a validator and NOT in the npm test chain -- the budgets are
// already enforced by validate-boarding-architecture (per district) and
// validate-district-routing (at most one district resident). This answers the
// question those two cannot: *before* anything is modelled, how much is left?
//
//   node scripts/district-budget.mjs
//   node scripts/district-budget.mjs --candidate path/to/market_deck.glb
//
// What this is NOT: a measurement of GPU memory. maxLiveBytes guards the sum of
// *encoded payload bytes* -- what the device downloads and decodes -- and a GLB's
// footprint once uploaded as vertex buffers and decompressed textures is a
// different, larger number this cannot see. Treat the output as a payload guard.
// Real device memory, frame rate and heat remain unmeasurable from here.
//
// The ceiling is not the whole budget either. A district shares the device with
// the hero, the crew rig, the largest fighter and a renderer reserve, all of
// which are resident whatever district is loaded:
//
//   ceiling = maxLiveBytes - (xrpman + mr_zamn + largest fighter) - reserve
//
// That subtraction is the whole point. 12 MiB looks generous until the 6.4 MB
// of cast comes out of it first.
//
// This holds only while at most one district is resident, which is what the
// zero-district connector rule in validate-district-routing.mjs guarantees. A
// route that ever loads two districts in one handoff invalidates every number
// printed here, and that validator is what stops it.

import { readFileSync } from 'node:fs';

const RESIDENT_CAST = ['xrpman', 'mr_zamn'];
const FIGHTERS = ['fighter_player', 'fighter_xrpl_striker', 'fighter_ledger_warden'];
/** Matches the reserve validate-boarding-architecture.mjs adds for the renderer. */
const RENDERER_RESERVE = 900_000;

const manifest = JSON.parse(readFileSync('public/assets/manifest.json', 'utf8'));
const districts = JSON.parse(readFileSync('src/game/definitive/warship-districts.json', 'utf8'));
const bytesOf = (id) => manifest.models[id]?.bytes ?? 0;
const n = (value) => value.toLocaleString('en-US');

const cast = RESIDENT_CAST.reduce((sum, id) => sum + bytesOf(id), 0);
const fighter = Math.max(...FIGHTERS.map(bytesOf));
const persistent = cast + fighter + RENDERER_RESERVE;
const liveBudget = Math.min(...districts.map((d) => d.maxLiveBytes));
const ceiling = liveBudget - persistent;

console.log(`encoded payload budget ${n(liveBudget).padStart(12)}   (payload bytes, not GPU memory)`);
for (const id of RESIDENT_CAST) console.log(`  - ${id.padEnd(18)} ${n(bytesOf(id)).padStart(12)}`);
console.log(`  - largest fighter    ${n(fighter).padStart(12)}`);
console.log(`  - renderer reserve   ${n(RENDERER_RESERVE).padStart(12)}`);
console.log(`= district ceiling     ${n(ceiling).padStart(12)}  (${(ceiling / 1024 / 1024).toFixed(2)} MiB for ONE district)\n`);

console.log('registered districts');
for (const district of districts) {
  const bytes = bytesOf(district.model);
  const share = bytes / ceiling;
  const flag = bytes > district.maxBytes ? '  OVER ITS OWN maxBytes' : '';
  console.log(`  ${district.id.padEnd(10)} ${district.model.padEnd(16)} ${n(bytes).padStart(10)}  ${(share * 100).toFixed(1).padStart(5)}% of ceiling   registry cap ${n(district.maxBytes).padStart(9)}${flag}`);
}

const index = process.argv.indexOf('--candidate');
if (index === -1) {
  const largest = Math.max(...districts.map((d) => bytesOf(d.model)));
  console.log(`\nheadroom for a new district: ${n(ceiling)} bytes.`);
  console.log(`the largest district today (${n(largest)}) uses ${((largest / ceiling) * 100).toFixed(1)}% of it.`);
  console.log(`\npass --candidate <file.glb> to size an unregistered model against this ceiling.`);
  process.exit(0);
}

// --- Candidate sizing. Structure is read from the container, not guessed.
const path = process.argv[index + 1];
if (!path) { console.error('--candidate needs a path to a .glb'); process.exit(2); }
const bytes = readFileSync(path);
if (bytes.readUInt32LE(0) !== 0x46546c67) { console.error(`${path}: not a GLB`); process.exit(2); }
const doc = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8'));
let triangles = 0, surfaces = 0;
for (const mesh of doc.meshes ?? []) {
  for (const primitive of mesh.primitives ?? []) {
    surfaces += 1;
    if ((primitive.mode ?? 4) !== 4) continue;
    triangles += Math.floor(doc.accessors[primitive.indices ?? primitive.attributes.POSITION].count / 3);
  }
}
const joints = new Set((doc.skins ?? []).flatMap((skin) => skin.joints ?? []));
const anchors = (doc.nodes ?? []).filter((node, i) => node.name && node.mesh === undefined && !joints.has(i)).map((node) => node.name);

// Measure against the tightest registered district, which is the shape a new
// district is most likely to be asked to match.
const tightest = districts.reduce((a, b) => (a.maxTriangles <= b.maxTriangles ? a : b));
const rows = [
  ['bytes', bytes.length, ceiling, 'district payload ceiling'],
  ['triangles', triangles, tightest.maxTriangles, `tightest registry cap (${tightest.id})`],
  ['draw surfaces', surfaces, tightest.maxSurfaces, `tightest registry cap (${tightest.id})`],
];
console.log(`\ncandidate ${path}`);
let over = 0;
for (const [label, value, limit, note] of rows) {
  const ok = value <= limit;
  if (!ok) over += 1;
  console.log(`  ${ok ? 'fits' : 'OVER'}  ${label.padEnd(14)} ${n(value).padStart(10)} / ${n(limit).padStart(10)}  ${((value / limit) * 100).toFixed(1).padStart(6)}%  ${note}`);
}
console.log(`  anchors (${anchors.length}): ${anchors.join(', ') || '(none -- scene code resolves districts by node name, so a district with no anchors is almost certainly wrong)'}`);
console.log(over ? `\n${over} budget(s) exceeded.` : `\nfits inside the district budget.`);
process.exit(over ? 1 : 0);
