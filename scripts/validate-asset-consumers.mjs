// Every runtime image is reachable, and every reference resolves.
//
// The repo has a standing rule -- no unused assets, add through the manifest
// only when a runtime consumer exists -- and until now it was enforced by
// review alone. It had already slipped: `hazards/defense_turret` lost its
// consumer in 233266a and stayed in the manifest, duplicating the master
// already shipped as `hazards/basic_turret`, and AssetLoader fetched it on
// every launch.
//
// The other direction was unguarded too. Nothing cross-checked a registry
// SpriteRef against the manifest, so a typo'd id degraded silently to the
// procedural fallback with only the in-game diagnostics panel as evidence.
//
// This closes both. A manifest entry must be reached by something, and
// everything reached must exist.
//
// Consumers come in three shapes and all three are collected:
//   1. Content records -- the running registries are walked for {category,id}
//      SpriteRefs, so what is checked is what the game actually holds, not a
//      grep of what the source appears to say.
//   2. Inline refs in engine code, e.g. the boss arena backdrop, which is a
//      literal in Game2A rather than a content record.
//   3. Hard-coded '/assets/...' paths, which is how the interiors and the
//      character sheets are loaded.

import { build } from 'esbuild';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };

// ---- the manifest -------------------------------------------------------
const manifest = JSON.parse(readFileSync('public/assets/manifest.json', 'utf8'));
/** category/id -> { src } */
const entries = new Map();
for (const [category, group] of Object.entries(manifest)) {
  if (!group || typeof group !== 'object') continue;
  for (const [id, value] of Object.entries(group)) {
    const src = typeof value === 'string' ? value : value?.src;
    entries.set(`${category}/${id}`, { category, id, src });
  }
}
check(entries.size > 0, 'the manifest parsed to nothing -- this check would pass vacuously');

// ---- every source file, comments stripped -------------------------------
//
// Stripped because this repo has repeatedly matched prose instead of code: a
// key named in a comment is documentation, not a consumer.
const sources = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) { walk(path); continue; }
    if (!/\.(ts|tsx|js|mjs)$/.test(path)) continue;
    sources.push({ path: relative('.', path), code: readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1') });
  }
};
walk('src');
check(sources.length > 10, `only ${sources.length} source files scanned -- the walker is broken`);

const referenced = new Map(); // key -> how it was reached
const note = (key, how) => { if (!referenced.has(key)) referenced.set(key, how); };

// ---- 1. the running content registries ----------------------------------
const modules = ['src/game/content/registry.ts', 'src/game/content/EarthThreats.ts'];
for (const entryPoint of modules) {
  const bundled = await build({ entryPoints: [entryPoint], bundle: true, format: 'esm', write: false, logLevel: 'silent' });
  const mod = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
  const seen = new Set();
  const scan = (value) => {
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    if (typeof value.category === 'string' && typeof value.id === 'string') {
      note(`${value.category}/${value.id}`, `${entryPoint} record`);
      return;
    }
    for (const child of Object.values(value)) scan(child);
  };
  for (const exported of Object.values(mod)) scan(exported);
}
check(referenced.size > 20, `only ${referenced.size} refs found in the registries -- the walker is not reaching the records`);

// ---- 2. inline {category, id} literals in engine code -------------------
for (const { code } of sources) {
  for (const [, category, id] of code.matchAll(/category:\s*'([a-z0-9_]+)'\s*,\s*id:\s*'([a-z0-9_]+)'/g)) {
    note(`${category}/${id}`, 'inline ref');
  }
}

// ---- 3. two-string calls: getImage('ui', 'x'), sprites.draw('bosses', k) --
//
// The cockpit overlay is fetched as getImage('ui', 'regulatory_warship_cockpit')
// and the 3D boss is drawn as sprites.draw('bosses', boss.spriteKey, ...) --
// neither is a {category, id} literal, and the first draft of this file called
// both of them orphans.
const CATEGORIES = new Set(Object.keys(manifest));
for (const { code } of sources) {
  for (const [, category, id] of code.matchAll(/\b(?:getImage|getSheet|draw)\(\s*'([a-z0-9_]+)'\s*,\s*'([a-z0-9_]+)'/g)) {
    note(`${category}/${id}`, 'two-string call');
  }
  // A category named as a literal beside a variable id -- draw('bosses', key).
  // The id cannot be resolved statically, so every manifest entry in that
  // category is considered reachable. Deliberately generous: this file exists
  // to catch assets nothing can reach, not to prove which one is drawn.
  for (const [, category] of code.matchAll(/\b(?:getImage|getSheet|draw)\(\s*'([a-z0-9_]+)'\s*,\s*[A-Za-z_$]/g)) {
    if (!CATEGORIES.has(category)) continue;
    for (const key of entries.keys()) if (key.startsWith(`${category}/`)) note(key, `dynamic id in '${category}'`);
  }
}

// ---- 4. hard-coded and templated /assets/ paths --------------------------
//
// The on-foot sheets are loaded as `/assets/characters/xrpman_${key}.png`, so
// a whole-string match finds nothing. A template's literal prefix counts for
// every manifest entry underneath it.
const bySrc = new Map([...entries].map(([key, value]) => [value.src, key]));
for (const { code } of sources) {
  for (const [path] of code.matchAll(/\/assets\/[A-Za-z0-9_\-./]+/g)) {
    const key = bySrc.get(path);
    if (key) note(key, 'path literal');
  }
  for (const [, prefix] of code.matchAll(/`(\/assets\/[A-Za-z0-9_\-./]*)\$\{/g)) {
    for (const [key, { src }] of entries) if (typeof src === 'string' && src.startsWith(prefix)) note(key, 'templated path');
  }
}

// ---- orphans: in the manifest, reached by nothing ------------------------
const orphans = [...entries.keys()].filter((key) => !referenced.has(key));
for (const key of orphans) {
  check(false, `${key} is in the manifest but nothing in src/ consumes it (${entries.get(key).src}) -- delete it or give it a consumer`);
}

// ---- dangling: reached by something, missing from the manifest -----------
for (const [key, how] of referenced) {
  if (entries.has(key)) continue;
  check(false, `${key} is referenced (${how}) but has no manifest entry -- it will silently fall back to procedural art`);
}

// ---- the files behind the manifest actually exist ------------------------
for (const [key, { src }] of entries) {
  check(typeof src === 'string' && src.startsWith('/assets/'), `${key} has no usable src`);
  if (typeof src !== 'string') continue;
  let size = -1;
  try { size = statSync(join('public', src)).size; } catch { size = -1; }
  check(size > 0, `${key} points at ${src}, which is missing or empty`);
}

if (failures.length) {
  console.error('asset-consumers: FAIL');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(`asset-consumers: OK — ${entries.size} manifest entries, every one consumed, every reference resolved.`);
