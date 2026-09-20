// Re-record the model provenance baseline from the models actually on disk.
//
// Run this after a legitimate re-bake, never to make a failing gate go quiet.
// The gate (validate-model-provenance.mjs) compares the committed models against
// this file; regenerating it is how a rebuild is *declared*, so the diff in a
// review shows exactly which counts moved and by how much.
//
//   node scripts/record-model-provenance.mjs            # rewrite the baseline
//   node scripts/record-model-provenance.mjs --check    # print drift, write nothing
//
// Anything already recorded keeps its prose (`source`, `status`); only measured
// facts are refreshed, so re-recording never silently discards human notes.

import { readFileSync, writeFileSync } from 'node:fs';
import { modelFacts } from './model-facts.mjs';

const BASELINE = 'docs/definitive/model-provenance.json';
const check = process.argv.includes('--check');

const manifest = JSON.parse(readFileSync('public/assets/manifest.json', 'utf8'));
let previous = { models: {} };
try { previous = JSON.parse(readFileSync(BASELINE, 'utf8')); } catch { /* first run */ }

const models = {};
const moved = [];
for (const [id, entry] of Object.entries(manifest.models).sort(([a], [b]) => a.localeCompare(b))) {
  const facts = modelFacts(readFileSync(`public${entry.src}`), id);
  const before = previous.models[id];
  models[id] = { src: entry.src, ...facts, ...(before?.note ? { note: before.note } : {}) };
  if (!before) { moved.push(`${id}: NEW`); continue; }
  for (const key of ['bytes', 'sha256', 'triangles', 'materialGroups', 'materials', 'images', 'bones']) {
    if (before[key] !== facts[key]) moved.push(`${id}.${key}: ${before[key]} -> ${facts[key]}`);
  }
  for (const key of ['animations', 'anchors']) {
    const was = (before[key] ?? []).join(','), now = facts[key].join(',');
    if (was !== now) moved.push(`${id}.${key}: [${was}] -> [${now}]`);
  }
}

const baseline = { generated: 'scripts/record-model-provenance.mjs', models };
if (check) {
  for (const line of moved) console.log('  ' + line);
  console.log(moved.length ? `${moved.length} fact(s) differ from ${BASELINE}` : `${BASELINE} matches all ${Object.keys(models).length} models`);
  process.exit(moved.length ? 1 : 0);
}
writeFileSync(BASELINE, JSON.stringify(baseline, null, 2) + '\n');
console.log(`recorded ${Object.keys(models).length} models to ${BASELINE}${moved.length ? `; ${moved.length} fact(s) changed` : ''}`);
for (const line of moved) console.log('  ' + line);
