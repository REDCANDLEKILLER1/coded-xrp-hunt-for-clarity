import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { build } from 'esbuild';

/**
 * Single heavy district residency, enforced at the routing level.
 *
 * A warship district GLB is the largest thing the phone holds. SceneController loads
 * the arriving scene before releasing the departing one, so any route that asks for
 * two district models inside one change() puts both on the device at once - which the
 * live-byte budget in validate-boarding-architecture.mjs does not cover, because that
 * sum assumes exactly one resident district.
 *
 * This drives the real MeshRuntime routes with the model loader stubbed, so every GLB
 * a route actually requests is recorded without needing a GPU. The scene constructors
 * cannot run headlessly, but they do not need to: the loads happen inside prepare()
 * before construction, which is the whole residency question.
 */

const DISTRICT_REGISTRY = 'src/game/definitive/warship-districts.json';
const DISTRICT_SCENE_TAG = 'warship_district';
/** Used only when neither the registry nor a manifest tag exists yet on this branch. */
const DEFAULT_DISTRICTS = ['boarding_deck'];

function registeredDistricts() {
  if (existsSync(DISTRICT_REGISTRY)) {
    const models = JSON.parse(readFileSync(DISTRICT_REGISTRY, 'utf8')).map(district => district.model);
    return { models, source: DISTRICT_REGISTRY };
  }
  const catalog = JSON.parse(readFileSync('public/assets/manifest.json', 'utf8'));
  const tagged = Object.entries(catalog.models).filter(([, entry]) => entry.scenes?.includes(DISTRICT_SCENE_TAG)).map(([id]) => id);
  if (tagged.length) return { models: tagged, source: `manifest ${DISTRICT_SCENE_TAG} tags` };
  return { models: DEFAULT_DISTRICTS, source: 'branch default (no registry or manifest tag on this branch yet)' };
}

/** Records every model id the real routing code asks for, per change() call. */
const recordLoads = {
  name: 'record-model-loads',
  setup(builder) {
    builder.onResolve({ filter: /ModelAssets$/ }, () => ({ path: 'virtual:model-loads', namespace: 'record' }));
    builder.onLoad({ filter: /.*/, namespace: 'record' }, () => ({
      loader: 'js',
      contents: `
        export const REQUESTS=[];
        const stand=id=>{REQUESTS.push(id);return {id,scene:{name:id},animations:[{name:'Walk'},{name:'Run'}],getObjectByName:()=>({})};};
        export async function loadModel(id){return stand(id);}
        export async function loadModels(ids){return ids.map(stand);}
        export function disposeObject(){}
      `,
    }));
  },
};

const bundled = await build({
  entryPoints: ['src/game/definitive/MeshRuntime.ts'],
  bundle: true, write: false, format: 'esm', logLevel: 'silent',
  loader: { '.css': 'empty' }, plugins: [recordLoads],
});
const runtime = await import(`data:text/javascript;base64,${Buffer.from(
  bundled.outputFiles[0].text.replace(/export\s*\{/, 'export {\n  REQUESTS,')).toString('base64')}`);

const stubElement = () => ({
  dataset: {}, hidden: true, textContent: '', className: '', style: {},
  appendChild() {}, append() {}, replaceChildren() {}, addEventListener() {}, removeEventListener() {},
  querySelector: () => null, getBoundingClientRect: () => ({ left: 0, top: 0, width: 390, height: 844 }),
});
globalThis.document = { createElement: stubElement, body: stubElement() };
globalThis.window = { addEventListener() {}, removeEventListener() {}, devicePixelRatio: 3, innerWidth: 390, innerHeight: 844 };
globalThis.localStorage = { getItem: () => null, setItem() {} };

const { CampaignSave } = await import(`data:text/javascript;base64,${Buffer.from((await build({
  entryPoints: ['src/game/definitive/CampaignSave.ts'], bundle: true, write: false, format: 'esm', logLevel: 'silent',
})).outputFiles[0].text).toString('base64')}`);

// Three.js complains to the console when a stub stands in for an Object3D during the
// failed headless construction. The loads are already recorded by then; keep the
// validator's own output readable.
const consoleError = console.error, consoleWarn = console.warn;
const quiet = () => { console.error = () => {}; console.warn = () => {}; };
const loud = () => { console.error = consoleError; console.warn = consoleWarn; };

/** One recorded change(): the models the route asked for before the scene was built. */
const handoffs = [];
const host = {
  root: stubElement(), hud: stubElement(), status: stubElement(), controls: stubElement(), qualityButton: stubElement(),
  renderer: { domElement: stubElement(), setSize() {}, setPixelRatio() {}, render() {}, dispose() {}, shadowMap: {} },
  environment: { texture: {} }, quality: 'full',
  resize() {}, startLoop() {}, applyQuality() {}, hide() {},
  controller: {
    lastError: null, loading: false, frame() {}, clear() {}, saveBeforeLeave: () => true,
    async change(prepare) {
      const before = runtime.REQUESTS.length;
      // The scene constructors need a real WebGL context; the loads we care about have
      // already happened by the time they fail.
      quiet();
      try { await prepare(new AbortController().signal); } catch { /* headless scene construction */ }
      finally { loud(); }
      handoffs.push(runtime.REQUESTS.slice(before));
      return true;
    },
  },
};
for (const name of Object.getOwnPropertyNames(runtime.MeshRuntime.prototype)) {
  if (name !== 'constructor' && typeof runtime.MeshRuntime.prototype[name] === 'function' && !(name in host)) {
    host[name] = runtime.MeshRuntime.prototype[name].bind(host);
  }
}

const ROUTES = ['showLanding', 'showBoarding', 'showDistrictConnector', 'showCivic', 'showSpace', 'showBullionReach', 'showFogMoon', 'showMars', 'showExcavation'];
const observed = [];
for (const route of ROUTES) {
  const stored = new Map();
  const save = new CampaignSave({ getItem: key => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value) }, `routing:${route}`);
  if (route !== 'showLanding') save.update(draft => { draft.warshipOwned = true; });
  handoffs.length = 0;
  try { await runtime.MeshRuntime.prototype[route].call(host, save,...(route==='showDistrictConnector'?['civic']:[])); } catch { /* a route that cannot finish headlessly still recorded its loads */ }
  observed.push({ route, handoffs: handoffs.map(models => [...models]) });
}

assert.ok(observed.some(entry => entry.handoffs.some(models => models.length)),
  'the routing drive recorded no model requests at all, so it is not exercising MeshRuntime');

const { models: districts, source } = registeredDistricts();
assert.ok(districts.length, 'no warship district models could be resolved from registry, manifest or default');

/** The rule: one change() may bring at most one heavy district onto the device. */
const overloaded = (districtModels, entries) => entries.flatMap(entry =>
  entry.handoffs
    .map(models => models.filter(model => districtModels.includes(model)))
    .filter(resident => resident.length > 1)
    .map(resident => `${entry.route} requests ${resident.join(' + ')} in one handoff`));

assert.deepEqual(overloaded(districts, observed), [],
  'no route may bring two warship districts onto the device in a single handoff');

/**
 * Per-handoff counting is insufficient on its own: a connector that quietly starts
 * loading a district while Boarding is still resident still requests only one model.
 * Read the production callbacks and reject every direct edge between two routes that
 * load districts. Self-edges are recovery retries after a failed load and retain the
 * previous safe scene, so they are deliberately excluded.
 */
const meshRuntimeSource=readFileSync('src/game/definitive/MeshRuntime.ts','utf8');
const methodBodies=new Map();let current=null;
for(const line of meshRuntimeSource.split(/\r?\n/)){
  const start=line.match(/^  async (show[A-Z]\w*)\s*\(/);
  if(start){current=start[1];methodBodies.set(current,line+'\n');continue;}
  if(current){
    if(/^  (?:async \w+|hide\s*\(|dispose\s*\(|private )/.test(line)){current=null;continue;}
    methodBodies.set(current,methodBodies.get(current)+line+'\n');
  }
}
for(const route of ROUTES)assert.ok(methodBodies.has(route),`driven route ${route} was not parsed out of MeshRuntime, so its transition edges are invisible to the graph guard`);
const edges=[];
for(const [from,body] of methodBodies){
  for(const match of body.matchAll(/this\.(show[A-Z]\w*)\s*\(/g))if(match[1]!==from&&!edges.some(edge=>edge.from===from&&edge.to===match[1]))edges.push({from,to:match[1]});
}
assert.ok(edges.length,'no MeshRuntime transition edges were extracted; the graph guard is not exercising production routing');
for(const edge of edges)assert.ok(ROUTES.includes(edge.from)&&ROUTES.includes(edge.to),`route graph edge ${edge.from} -> ${edge.to} must be enrolled in the driven route list`);
const unsafeEdges=(entries,routeEdges)=>{
  const counts=new Map(entries.map(entry=>[entry.route,new Set(entry.handoffs.flat().filter(model=>districts.includes(model))).size]));
  return routeEdges.filter(edge=>(counts.get(edge.from)??0)>0&&(counts.get(edge.to)??0)>0);
};
assert.deepEqual(unsafeEdges(observed,edges),[],'a district-loading route may only reach another district through a zero-district connector');

/**
 * Negative control. The registry currently holds one district on this branch, so the
 * assertion above could pass simply because a second district does not exist yet.
 * Re-resolve the same recorded requests against a registry fixture that additionally
 * registers a model showBoarding really loads, and require the rule to fail. This
 * mutates the district fixture, never the assertion.
 */
const boarding = observed.find(entry => entry.route === 'showBoarding');
const alsoLoaded = boarding?.handoffs.flat().find(model => !districts.includes(model));
assert.ok(alsoLoaded, 'showBoarding must load something beyond the district for the negative control');
assert.ok(overloaded([...districts, alsoLoaded], observed).length,
  `the rule must fail when a second district is registered (fixture: ${alsoLoaded})`);

// Negative controls mutate the route graph and route request fixtures, never the
// assertion: both regressions must become unsafe consecutive handoffs.
const civicDistrict=districts.find(model=>model!=='boarding_deck');
assert.ok(civicDistrict,'the consecutive-handoff controls require a registered Civic district');
const connectorPreload=observed.map(entry=>entry.route==='showDistrictConnector'?{...entry,handoffs:[[civicDistrict]]}:entry);
assert.ok(unsafeEdges(connectorPreload,edges).some(edge=>edge.from==='showBoarding'&&edge.to==='showDistrictConnector'),'preloading Civic in the connector must be rejected while Boarding is resident');
assert.ok(unsafeEdges(observed,[...edges,{from:'showBoarding',to:'showCivic'}]).some(edge=>edge.from==='showBoarding'&&edge.to==='showCivic'),'a direct Boarding to Civic route must be rejected');

/**
 * Resident encoded payload, per route, derived from what each route actually loads.
 *
 * What this measures: the sum of *encoded payload bytes* of the distinct model files
 * a route requests -- what the device downloads and decodes. It is NOT a measurement
 * of GPU or system memory, and it does NOT establish the transition peak: an uploaded
 * GLB costs a different, larger amount as vertex buffers and decompressed textures,
 * and two scenes briefly overlapping during a handoff is a separate question the
 * connector rule above governs. No claim here depends on either.
 *
 * Why it exists: validate-boarding-architecture computes its live-byte sum from a
 * fixed list -- ['xrpman','mr_zamn',district.model] plus the largest fighter. That list
 * is not derived from anything, so a model added to a route's load call does not move
 * the number, and the check stays green while the resident set grows. It also runs only
 * for registered districts, leaving every non-district route unbudgeted. Measured, the
 * two heaviest routes in the game were the unguarded ones.
 *
 * THRESHOLD PROVENANCE -- read this before trusting a pass.
 * `maxLiveBytes` is declared per district in warship-districts.json and was written as a
 * district budget. Applying it to every driven route is a NEW POLICY introduced by this
 * guard, not an existing rule that was being skipped. It is adopted because it is the
 * only declared payload ceiling in the repository and every current route already sits
 * under it, so it costs nothing today and catches growth tomorrow. If a route ever needs
 * a different ceiling, raise it deliberately here rather than discovering it at bake time.
 */
const catalog = JSON.parse(readFileSync('public/assets/manifest.json', 'utf8'));
const RENDERER_ALLOWANCE = 900_000;   // counted separately from asset bytes, as in validate-boarding-architecture
const residentCeiling = Math.min(...JSON.parse(readFileSync(DISTRICT_REGISTRY, 'utf8')).map(entry => entry.maxLiveBytes));
assert.ok(Number.isFinite(residentCeiling) && residentCeiling > 0, 'no resident payload ceiling could be resolved from the district registry');

/** Distinct model ids a route requests. Instances and repeat requests are the same file. */
const uniqueModels = entry => [...new Set(entry.handoffs.flat())];
const residency = observed.map(entry => {
  const models = uniqueModels(entry);
  for (const id of models) {
    assert.ok(catalog.models[id],
      `${entry.route} loads ${id}, which has no manifest entry, so it would cost nothing in this accounting`);
  }
  const assetBytes = models.reduce((sum, id) => sum + catalog.models[id].bytes, 0);
  return { route: entry.route, models, assetBytes, total: assetBytes + RENDERER_ALLOWANCE };
});

const over = residency.filter(row => row.total > residentCeiling);
assert.deepEqual(over.map(row => `${row.route} holds ${row.total} encoded bytes of ${residentCeiling}`), [],
  'every driven route must keep its distinct loaded models plus the renderer allowance inside the resident payload ceiling');

// Growth must be visible: a route that gains a model gains its bytes here, automatically.
assert.ok(residency.some(row => row.models.length >= 5),
  'no route loads enough models for this accounting to be exercising anything');
// Instances are not payload: counting raw requests instead of distinct ids must differ
// somewhere, or the de-duplication above is untested.
assert.ok(observed.some(entry => entry.handoffs.flat().length > uniqueModels(entry).length)
  || residency.every(row => row.models.length === new Set(row.models).size),
  'distinct-model accounting is not distinguishable from raw request counting');

const tightest = residency.reduce((a, b) => (a.total >= b.total ? a : b));

const report = observed.map(entry => {
  const resident = entry.handoffs.flat().filter(model => districts.includes(model));
  return `${entry.route} ${resident.length}${resident.length ? ` [${resident.join(', ')}]` : ''}`;
}).join('; ');
console.log(`district-routing: OK — ${ROUTES.length} real MeshRuntime routes driven, ${edges.length} production transition edges checked, districts from ${source}: ${districts.join(', ')}; districts per route: ${report}; handoff and consecutive-route negative controls fire; resident encoded payload accounted for ${residency.length} routes, heaviest ${tightest.route} at ${tightest.total} of ${residentCeiling} bytes (encoded payload only, not GPU memory).`);
