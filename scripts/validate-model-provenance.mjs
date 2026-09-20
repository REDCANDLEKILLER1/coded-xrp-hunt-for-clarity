import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { modelFacts, readDocument } from './model-facts.mjs';

/**
 * Model provenance gate: a runtime model may not change without the change
 * being declared.
 *
 * The Blender masters live outside this repository by policy, so nothing here
 * can re-bake a GLB and diff it. That is exactly why drift is invisible: a
 * hand-finished mesh committed over a script-built one passes every existing
 * check. validate-static-roundtrip and friends only prove a model survives
 * import/export, which a hand-edited model does perfectly.
 *
 * So provenance is pinned instead of recomputed. Three stores have to agree:
 *
 *   the file        what is actually committed under public/assets/models
 *   the manifest    public/assets/manifest.json -- shipped, already carries bytes+sha256
 *   the baseline    docs/definitive/model-provenance.json -- structure and anchors
 *
 * Any one of them moving alone is drift and fails here. Re-recording the
 * baseline (scripts/record-model-provenance.mjs) is how a real re-bake is
 * declared, and its diff is what a reviewer reads.
 *
 * `anchors` is the assertion that earns its keep. The runtime resolves model
 * nodes by name in 53 places, and MarsExcavationScene throws outright when one
 * is missing. A re-bake that renames Muzzle_L or drops Gate_Frame is a crash
 * with no failing test; here it is a red gate.
 */

const MODELS = 'public/assets/models';
const BASELINE = 'docs/definitive/model-provenance.json';
const LEDGER = 'docs/definitive/ASSET_LEDGER.json';

const manifest = JSON.parse(readFileSync('public/assets/manifest.json', 'utf8'));
const baseline = JSON.parse(readFileSync(BASELINE, 'utf8'));

// --- P1: every model on disk is declared, and every declared model is on disk.
const onDisk = readdirSync(MODELS).filter((name) => name.endsWith('.glb')).sort();
const declared = Object.entries(manifest.models).map(([id, entry]) => [id, entry.src.split('/').pop()]);
assert.deepEqual(
  declared.map(([, file]) => file).sort(), onDisk,
  'every committed model must be declared in the manifest and every manifest model must exist',
);
assert.deepEqual(
  Object.keys(baseline.models).sort(), Object.keys(manifest.models).sort(),
  `every manifest model must be pinned in ${BASELINE} -- run scripts/record-model-provenance.mjs`,
);
assert.ok(onDisk.length >= 29, `expected the full model set, found ${onDisk.length}`);

// --- P2: file, manifest and baseline agree, fact by fact.
const FACTS = ['bytes', 'sha256', 'triangles', 'materialGroups', 'materials', 'images', 'bones'];
const LISTS = ['animations', 'anchors'];
let checkedTriangles = 0;
for (const [id, entry] of Object.entries(manifest.models)) {
  const bytes = readFileSync(`public${entry.src}`);
  const actual = modelFacts(bytes, id);
  const pinned = baseline.models[id];

  assert.equal(actual.bytes, entry.bytes, `${id}: manifest records ${entry.bytes} bytes, file holds ${actual.bytes}`);
  assert.equal(actual.sha256, entry.sha256, `${id}: manifest sha256 does not match the committed file`);
  assert.equal(pinned.src, entry.src, `${id}: baseline points at ${pinned.src}, manifest at ${entry.src}`);

  for (const key of FACTS) {
    assert.equal(actual[key], pinned[key],
      `${id}.${key}: committed model reports ${actual[key]}, baseline pins ${pinned[key]} -- re-bake undeclared, or re-record the baseline`);
  }
  for (const key of LISTS) {
    assert.deepEqual(actual[key], pinned[key],
      `${id}.${key}: committed model has [${actual[key]}], baseline pins [${pinned[key]}]`);
  }

  // A runtime model must carry its own payload; an external URI 404s on device.
  assert.equal(actual.externalBuffers, 0, `${id}: buffer referenced by URI instead of embedded`);
  assert.equal(actual.externalImages, 0, `${id}: image referenced by URI instead of embedded`);

  // Anchors are resolved by name, so a duplicate makes the lookup ambiguous.
  const doc = readDocument(bytes, id);
  for (const name of actual.anchors) {
    assert.equal(doc.nodes.filter((node) => node.name === name).length, 1, `${id}: anchor ${name} is not unique`);
  }
  checkedTriangles += actual.triangles;
}

// --- P3: the human-readable ledger may not contradict the manifest.
// It is documentation, not a source of truth, but a stale ledger is how a
// rebuild gets forgotten: corn and boo were rebuilt in cd08052 and the ledger
// was left describing the models they replaced.
const ledger = JSON.parse(readFileSync(LEDGER, 'utf8'));
const byPath = new Map(Object.values(manifest.models).map((entry) => [`public${entry.src}`, entry]));
let reconciled = 0;
for (const record of ledger.assets) {
  const entry = byPath.get(record.path);
  if (!entry) continue;
  assert.equal(record.sha256, entry.sha256,
    `${record.path}: ASSET_LEDGER records a model that is no longer committed -- the ledger is stale, re-record it`);
  assert.equal(record.bytes, entry.bytes, `${record.path}: ASSET_LEDGER byte count disagrees with the manifest`);
  reconciled += 1;
}
assert.ok(reconciled >= 16, `expected the ledger to still cover the model set, reconciled only ${reconciled}`);

// --- P4: negative control. Mutate the subject -- a real GLB, rebuilt with one
// anchor renamed -- and require the fact comparison to fail on it. This proves
// the pipeline above reads the file rather than echoing the baseline.
{
  const id = 'fighter_player';
  const bytes = readFileSync(`public${manifest.models[id].src}`);
  const doc = readDocument(bytes, id);
  const target = doc.nodes.find((node) => node.name === 'Muzzle_L');
  assert.ok(target, 'negative control needs a known anchor to rename');
  target.name = 'Muzzle_LEFT';

  // Rebuild a structurally valid GLB around the edited JSON chunk.
  const json = Buffer.from(JSON.stringify(doc), 'utf8');
  const padded = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 0x20)]);
  const binary = bytes.subarray(20 + bytes.readUInt32LE(12));
  const header = Buffer.alloc(20);
  header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4);
  header.writeUInt32LE(20 + padded.length + binary.length, 8);
  header.writeUInt32LE(padded.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
  const mutated = Buffer.concat([header, padded, binary]);

  const facts = modelFacts(mutated, id);
  assert.ok(facts.anchors.includes('Muzzle_LEFT') && !facts.anchors.includes('Muzzle_L'),
    'the negative control did not actually rename the anchor');
  assert.throws(
    () => assert.deepEqual(facts.anchors, baseline.models[id].anchors),
    'a renamed anchor must fail the provenance comparison',
  );
  assert.throws(
    () => assert.equal(facts.sha256, baseline.models[id].sha256),
    'an edited model must fail the hash comparison',
  );
}

console.log(`model-provenance: OK — ${onDisk.length} models pinned across file, manifest and baseline (${checkedTriangles.toLocaleString('en-US')} triangles, ${Object.values(baseline.models).reduce((n, m) => n + m.anchors.length, 0)} named anchors, ${reconciled} reconciled against ASSET_LEDGER); negative control fires on a renamed anchor.`);
