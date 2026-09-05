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
// Consumers come in five shapes and all five are collected:
//   1. Content records -- the running registries are walked for {category,id}
//      SpriteRefs, so what is checked is what the game actually holds, not a
//      grep of what the source appears to say.
//   2. Inline refs in engine code, e.g. the boss arena backdrop, which is a
//      literal in Game2A rather than a content record.
//   3. Hard-coded '/assets/...' paths, which is how the interiors and the
//      character sheets are loaded.
//   4. GLB ids named in loadModel/loadModels, plus the FIGHTER_MODELS
//      indirection they are looked up through. The Chapter One scenes are
//      LAZILY imported, so nothing reaches these through the 2D entry bundle
//      and a path-literal scan finds nothing either -- the id is a bare string
//      and ModelAssets builds the URL from the manifest.
//   5. Music tracks, which are reached through a SECOND manifest
//      (/assets/audio/manifest.json) that maps a cue to a track. Cue and track
//      are checked as their own chain below, so a track file that no cue can
//      reach is still caught even though the entry is 'consumed'.
//
// Scene tags are checked too. AssetLoader skips any entry whose `scenes` list
// excludes the scene being loaded, which makes a tag a download instruction:
// a typo'd scene name silently stops an asset ever loading, and a tag on an
// asset nothing draws is bytes on a phone for nothing.

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

// key -> EVERY way it was reached, not just the first.
//
// First-wins was a bug: the deliberately generous "dynamic id in this
// category" rule fired before the direct catalog read in SpaceBackdrop was
// seen, so two backgrounds looked like they were AssetLoader's alone and the
// scene check called them unreachable. An asset can have several routes and
// the scene rule below turns on whether ANY of them bypasses the loader.
const referenced = new Map();
const note = (key, how) => {
  const routes = referenced.get(key) ?? new Set();
  routes.add(how);
  referenced.set(key, routes);
};
const routesFor = (key) => [...(referenced.get(key) ?? [])];

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
  // A dynamic id -- draw('bosses', boss.spriteKey), getImage('hazards', art.id)
  // -- is NOT treated as "the whole category is reachable". That was the first
  // draft's rule and it quietly destroyed the check this file exists for: one
  // dynamic draw marked every entry in the category consumed, so a dead
  // hazard, a dead background and a dead boss could all sit in the manifest
  // unreported. Every dynamic id in this repo is read off a CONTENT RECORD,
  // and the record walk above resolves those precisely, so nothing is lost by
  // requiring that. If a future dynamic id has no record behind it, this file
  // will call its asset an orphan -- which is the correct, loud failure.
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

// ---- 3b. records that carry an id but not its category ------------------
//
// Two record sets name a manifest id WITHOUT the category beside it, because
// the category is fixed at the draw site instead:
//
//   GroundDefense art -- {id: 'tracking_turret_v1', ...} -- drawn by
//     getImage('hazards', art.id) in Game2A.
//   SpaceLane bosses  -- {spriteKey: 'cyber_battleship'} -- drawn by
//     draw('bosses', boss.spriteKey) in Space3DGame.
//
// The category is therefore knowledge this file has to hold, which is exactly
// the kind of duplicated assumption that goes stale silently. So each pairing
// asserts its own draw site still exists: move or rename the draw and this
// check fails loudly instead of quietly calling six live assets orphans.
const IMPLIED = [
  { entryPoint: 'src/game/content/GroundDefense.ts', category: 'hazards', fields: ['id'], drawnBy: /getImage\(\s*'hazards'\s*,\s*[A-Za-z_$][\w.$]*\.id/ },
  { entryPoint: 'src/game/space3d/SpaceLane.ts', category: 'bosses', fields: ['spriteKey'], drawnBy: /draw\(\s*'bosses'\s*,\s*[A-Za-z_$][\w.$]*\.spriteKey/ },
];
for (const { entryPoint, category, fields, drawnBy } of IMPLIED) {
  check(sources.some(({ code }) => drawnBy.test(code)), `nothing draws ${category} the way ${entryPoint} expects any more -- this mapping is stale`);
  const bundled = await build({ entryPoints: [entryPoint], bundle: true, format: 'esm', write: false, logLevel: 'silent' });
  const mod = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
  let found = 0;
  const seen = new Set();
  const scan = (value) => {
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    for (const field of fields) {
      if (typeof value[field] !== 'string') continue;
      note(`${category}/${value[field]}`, `${entryPoint} record`);
      found += 1;
    }
    for (const child of Object.values(value)) scan(child);
  };
  for (const exported of Object.values(mod)) scan(exported);
  check(found > 0, `${entryPoint} named no ${category} ids -- the walk is broken and its art would look orphaned`);
}

// ---- 4b. direct catalog reads: catalog.backgrounds?.[id] ---------------
//
// Some code skips AssetLoader and resolves an entry from the catalog itself:
// SpaceBackdrop builds a texture from `catalog.backgrounds?.[id]`. Only the
// ids named in THAT FILE count -- reading the catalog is not a licence for the
// whole category, which is the mistake made just above.
//
// The scene check below also needs this: an asset fetched this way is not
// AssetLoader's, so its scene tags are not download instructions.
for (const { code } of sources) {
  const cats = new Set([...code.matchAll(/\b(?:catalog|manifest)\.([a-z0-9_]+)\s*\?\.\[/g)].map(([, category]) => category).filter((category) => CATEGORIES.has(category)));
  if (cats.size === 0) continue;
  for (const [, id] of code.matchAll(/'([a-z0-9_]+)'/g)) {
    for (const category of cats) if (entries.has(`${category}/${id}`)) note(`${category}/${id}`, `catalog read of '${category}'`);
  }
}

// ---- 5. GLB ids: loadModel('x') and loadModels(['a', 'b']) --------------
//
// A model is fetched by BARE ID -- ModelAssets looks the id up in the manifest
// and builds the URL -- so neither a path literal nor a {category, id} pair
// appears anywhere. Collected from the call sites directly.
for (const { code } of sources) {
  for (const [, id] of code.matchAll(/\bloadModel\(\s*'([a-z0-9_]+)'/g)) note(`models/${id}`, 'loadModel call');
  // loadModels takes an array that mixes literals with fighterModel(...) calls,
  // so the array text is scanned for quoted ids rather than parsed.
  for (const [, list] of code.matchAll(/\bloadModels\(\s*\[([^\]]*)\]/g)) {
    for (const [, id] of list.matchAll(/'([a-z0-9_]+)'/g)) note(`models/${id}`, 'loadModels call');
  }
}

// The fighter model is chosen at runtime from the saved ship key, so its three
// ids never appear at a call site. Imported rather than grepped: this is the
// table the game actually indexes.
//
// The rest are named in runtime TABLES, not at a call site: the fighter model
// is chosen from the saved ship key, and a space route names the planet at
// each end. SPACE_MODELS is built by template (`space_${key}`), so its ids do
// not exist as literals anywhere. These are imported and walked for the same
// reason the registries are -- what is checked is the table the game indexes,
// not a grep of what the source appears to say.
const MODEL_IDS = new Set([...entries.keys()].filter((key) => key.startsWith('models/')).map((key) => key.slice('models/'.length)));
for (const entryPoint of ['src/game/definitive/LandingPlan.ts', 'src/game/definitive/SpaceProgress.ts', 'src/game/definitive/SpaceRoutes.ts']) {
  const bundled = await build({ entryPoints: [entryPoint], bundle: true, format: 'esm', write: false, logLevel: 'silent' });
  const mod = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
  let found = 0;
  const seen = new Set();
  const scan = (value) => {
    if (typeof value === 'string') { if (MODEL_IDS.has(value)) { note(`models/${value}`, `${entryPoint} table`); found += 1; } return; }
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    for (const child of Object.values(value)) scan(child);
  };
  for (const exported of Object.values(mod)) scan(exported);
  check(found > 0, `${entryPoint} named no models -- the table walk is broken and its models would look like orphans`);
}

// ---- 6. music: the cue -> track -> file chain ---------------------------
//
// Three layers have to agree, and each one can rot independently: a cue the
// engine asks for that the audio manifest does not define plays silence; a
// track no cue names is a download nothing can start; a track whose file is
// not in the asset manifest 404s on the first gesture.
{
  const audio = JSON.parse(readFileSync('public/assets/audio/manifest.json', 'utf8'));
  const tracks = Object.keys(audio.tracks ?? {});
  const cues = audio.cues ?? {};
  check(tracks.length > 0, 'the audio manifest lists no tracks -- this check would pass vacuously');

  const reachable = new Set(Object.values(cues).filter((track) => typeof track === 'string'));
  for (const track of tracks) {
    check(reachable.has(track), `audio track '${track}' is defined but no cue maps to it -- nothing can ever play it`);
    note(`audio/${track}`, 'audio manifest track');
  }
  for (const [cue, track] of Object.entries(cues)) {
    check(track === null || tracks.includes(track), `cue '${cue}' points at track '${track}', which the audio manifest does not define`);
  }
  // Every cue the engine actually asks for must exist. Variable cues (a plan's
  // musicCueKey) are resolved from the content records rather than the literal.
  const asked = new Set();
  for (const { code } of sources) {
    for (const [, cue] of code.matchAll(/\bcueMusic\(\s*'([a-z0-9_]+)'/g)) asked.add(cue);
    for (const [, cue] of code.matchAll(/musicCueKey:\s*'([a-z0-9_]+)'/g)) asked.add(cue);
  }
  check(asked.size > 3, `only ${asked.size} music cues found in src/ -- the cue scan is broken`);
  for (const cue of asked) check(cue in cues, `the engine asks for music cue '${cue}', which the audio manifest does not define -- it plays silence`);
}

// ---- scene tags: a tag is a download instruction ------------------------
//
// AssetLoader preloads only entries whose `scenes` list contains the scene
// being loaded, and `getImage` is a plain Map lookup with NO lazy fetch -- so
// an image that no requested scene tags is not merely un-warmed, it is never
// available and the game silently draws the procedural fallback instead.
//
// Only entries whose ONLY route is AssetLoader are held to this. Several
// assets are fetched by their own loaders and never touch it: the interior
// backdrops load from a `backgroundSrc` path, the character sheets from a
// templated path, and the space dust reads the catalog directly in
// SpaceBackdrop. Models and audio are not AssetLoader's at all -- ModelAssets
// fetches a GLB by id and MusicDirector streams a cue -- so their scene tags
// are documentation, not instructions, and are exempt by type.
{
  const loaderSource = readFileSync('src/game/core/AssetLoader.ts', 'utf8');
  check(/definition\.scenes/.test(loaderSource), 'AssetLoader no longer filters on scenes -- this check is testing a mechanism that is gone');

  // The scenes actually asked for: every loadManifest argument, plus the
  // default in the signature, which is what the 2D game relies on.
  const requested = new Set();
  for (const [, scene] of loaderSource.matchAll(/async loadManifest\(scene = '([a-z0-9_]+)'/g)) requested.add(scene);
  for (const { code } of sources) {
    for (const [, scene] of code.matchAll(/loadManifest\(\s*'([a-z0-9_]+)'/g)) requested.add(scene);
  }
  check(requested.size > 1, `only ${requested.size} scene(s) are ever requested -- the scan for loadManifest call sites is broken`);

  const VIA_LOADER = new Set(['inline ref', 'two-string call']);
  for (const [key, { category, id }] of entries) {
    const definition = manifest[category]?.[id];
    if (!definition || typeof definition === 'string') continue;
    if (definition.type !== 'image' && definition.type !== 'spritesheet') continue;
    if (!Array.isArray(definition.scenes)) continue;
    const routes = routesFor(key);
    if (routes.length === 0) continue; // an orphan; the pass below reports it.
    const viaLoader = (how) => VIA_LOADER.has(how) || how.endsWith(' record') || how.startsWith('dynamic id in ');
    if (!routes.every(viaLoader)) continue; // something fetches it another way.
    check(
      definition.scenes.some((scene) => requested.has(scene)),
      `${key} is only reachable through AssetLoader (${routes.join('; ')}) but is tagged only for [${definition.scenes.join(', ')}], and no scene there is ever loaded -- it will silently fall back to procedural art`,
    );
  }
}

// ---- orphans: in the manifest, reached by nothing ------------------------
const orphans = [...entries.keys()].filter((key) => !referenced.has(key));
for (const key of orphans) {
  check(false, `${key} is in the manifest but nothing in src/ consumes it (${entries.get(key).src}) -- delete it or give it a consumer`);
}

// ---- dangling: reached by something, missing from the manifest -----------
for (const [key, routes] of referenced) {
  if (entries.has(key)) continue;
  check(false, `${key} is referenced (${[...routes].join('; ')}) but has no manifest entry -- it will silently fall back to procedural art`);
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
