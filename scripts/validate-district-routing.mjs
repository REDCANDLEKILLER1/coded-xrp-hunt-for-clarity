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

const ROUTES = ['showLanding', 'showBoarding', 'showSpace', 'showBullionReach', 'showFogMoon', 'showMars', 'showExcavation'];
const observed = [];
for (const route of ROUTES) {
  const stored = new Map();
  const save = new CampaignSave({ getItem: key => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value) }, `routing:${route}`);
  if (route !== 'showLanding') save.update(draft => { draft.warshipOwned = true; });
  handoffs.length = 0;
  try { await runtime.MeshRuntime.prototype[route].call(host, save); } catch { /* a route that cannot finish headlessly still recorded its loads */ }
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

const report = observed.map(entry => {
  const resident = entry.handoffs.flat().filter(model => districts.includes(model));
  return `${entry.route} ${resident.length}${resident.length ? ` [${resident.join(', ')}]` : ''}`;
}).join('; ');
console.log(`district-routing: OK — ${ROUTES.length} real MeshRuntime routes driven, districts from ${source}: ${districts.join(', ')}; districts per route: ${report}; negative control fires when a second district is registered.`);
