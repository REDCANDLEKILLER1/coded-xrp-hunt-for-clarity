import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { build } from 'esbuild';

async function verify() {
  const mutation = process.env.CODED_TRAVEL_MUTATION;
  class Element extends EventTarget {
    dataset = {}; children = []; hidden = false; textContent = ''; clientWidth = 390; clientHeight = 844;
    append(...items) { this.children.push(...items); }
    replaceChildren(...items) { this.children = items; }
  }
  globalThis.window = new EventTarget();
  globalThis.document = new Element();
  document.createElement = () => new Element();
  globalThis.localStorage = { getItem: () => null };
  globalThis.travelHarness = {};
  const plugin = { name: 'travel-boundary-fixtures', setup(b) {
    b.onLoad({ filter: /[\\/](ModelAssets|SpaceBackdrop|BoardingScene|SpaceScene|CampaignNavigation|RevisitTravel|MeshRuntime)\.ts$/ }, ({ path }) => {
      if(path.endsWith('SpaceBackdrop.ts'))return {loader:'ts',contents:`export async function loadSpaceBackdrop(){if(globalThis.travelHarness.backgroundFailure)throw Error('planned backdrop failure');return {};}export function disposeSpaceBackdrop(){globalThis.travelHarness.disposed++;}`};
      if (path.endsWith('ModelAssets.ts')) return { loader: 'ts', contents: `
        export async function loadModels(ids, signal) { return globalThis.travelHarness.load(ids, signal); }
        export async function loadModel(id, signal) { return (await loadModels([id], signal))[0]; }
        export function disposeObject() { globalThis.travelHarness.disposed++; }
      ` };
      if (path.endsWith('BoardingScene.ts') || path.endsWith('SpaceScene.ts')) {
        const name = path.endsWith('BoardingScene.ts') ? 'BoardingScene' : 'SpaceScene';
        return { loader: 'ts', contents: `export class ${name} {
          constructor(host) { this.host=host; globalThis.travelHarness.construct(host); }
          setActive(value) { this.active=value; }
          update() {} render() {}
          dispose() { this.disposed=true; globalThis.travelHarness.disposed++; }
        }` };
      }
      let contents = readFileSync(path, 'utf8');
      if (mutation === 'unvisited' && path.endsWith('CampaignNavigation.ts')) contents = contents.replace('save.quests.includes(`${world}.orbit_reached`)', 'true');
      if (mutation === 'restart-fog' && path.endsWith('CampaignNavigation.ts')) contents = contents.replace("!save.quests.includes('fog_moon.voyage_started')", 'true');
      if (mutation === 'reward-return' && path.endsWith('RevisitTravel.ts')) contents = contents.replace('draft.transit = checkpoint;', 'draft.transit = checkpoint; draft.credits += 100;');
      if (mutation === 'stale-return' && path.endsWith('RevisitTravel.ts')) contents = contents.replace('save.snapshot.revision !== expectedRevision', 'false');
      if (mutation === 'early-bridge' && path.endsWith('MeshRuntime.ts')) contents = contents.replace('const before=save.snapshot;', 'const before=save.snapshot; quest.begin(before.fighterShipKey);');
      return { contents, loader: 'ts' };
    });
  } };
  const out = await build({ stdin: { contents: `
    export * from './src/game/definitive/CampaignSave';
    export * from './src/game/definitive/CampaignNavigation';
    export * from './src/game/definitive/RevisitTravel';
    export * from './src/game/definitive/SpaceProgress';
    export * from './src/game/definitive/FogMoon';
    export * from './src/game/definitive/MarsRelief';
    export * from './src/game/definitive/MeshRuntime';
    export * from './src/game/definitive/SceneController';
  `, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, write: false, format: 'esm', loader: { '.css': 'empty' }, plugins: [plugin], logLevel: 'silent' });
  const m = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
  let serial = 0, fail = false;
  const data = new Map(), storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => { if (fail) throw Error('storage unavailable'); data.set(key, value); } };
  function fresh() {
    const save = new m.CampaignSave(storage, `test:travel${++serial}`);
    assert.ok(m.prepareFogReview(save).ok); assert.ok(m.startTransit(save).ok);
    assert.ok(save.update(d => { d.transit.hull = 57; d.transit.fore = 23; d.transit.aft = 71; d.credits = 741; d.rewards.push('reward.space.mars_fog_moon.wave.0'); }).ok);
    return save;
  }
  function retained(save) {
    const d = save.snapshot;
    return { hull: d.transit.hull, fore: d.transit.fore, aft: d.transit.aft, fighter: d.fighterShipKey,
      credits: d.credits, rewards: d.rewards, quests: d.quests, recruits: d.recruits,
      hero: d.heroUpgrades, capital: d.capitalUpgrades, weapons: d.fighterUpgrades };
  }
  const save = fresh(), original = save.snapshot, keep = retained(save);
  assert.equal(m.safeOrbit(original), 'fog_moon');
  assert.deepEqual(m.campaignNavigation(save, 'mars'), { action: 'revisit', world: 'mars', label: 'RETURN TO MARS ORBIT' });
  assert.equal(m.campaignNavigation(save, 'rugfall').action, 'blocked', 'old discovery is not rebuilt content');
  assert.equal(m.campaignNavigation(save, 'bullion_reach').action, 'continue', 'unrestored Fog cannot skip to the newly built chapter');
  const candidate = m.revisitCheckpoint(save, 'mars');
  assert.equal(candidate.phase, 'mars'); assert.equal(candidate.wave, 4); assert.deepEqual(save.snapshot, original);
  assert.ok(m.beginRevisit(save, 'mars', original.revision).ok); assert.deepEqual(retained(save), keep);
  assert.equal(m.canPlotFogMoon(save), false, 'a completed route must not restart claimed waves');
  assert.equal(m.beginFogVoyage(save).ok, false);
  assert.equal(m.campaignNavigation(save, 'fog_moon').action, 'revisit');
  assert.ok(m.canDescendToRelief(save)); assert.ok(m.beginMarsRelief(save).ok);
  assert.equal(m.canRevisitOrbit(save.snapshot, 'fog_moon'), false, 'cannot leave an active surface through another map selection');
  assert.equal(m.campaignNavigation(save, 'fog_moon').label, 'CONTINUE MARS SURFACE');
  assert.ok(m.startTransit(save).ok); assert.ok(m.beginRevisit(save, 'fog_moon', save.snapshot.revision).ok);
  assert.deepEqual(retained(save), keep); assert.ok(m.beginFogLanding(save).ok);
  const reloaded = new m.CampaignSave(storage, save.key.split('coded-xrp-definitive-v1:')[1]);
  assert.deepEqual(reloaded.snapshot, save.snapshot);

  for (const change of [d => { d.transit.hull = 0; }, d => { d.warshipOwned = false; }, d => { d.location.mode = 'surface'; },
    d => { d.location.world = 'mars'; }, d => { d.transit.phase = 'transit'; }, d => { d.quests = d.quests.filter(q => q !== 'mars.orbit_reached'); }]) {
    const blocked = fresh(); assert.ok(blocked.update(change).ok); const before = blocked.snapshot;
    assert.equal(m.revisitCheckpoint(blocked, 'mars'), null); assert.equal(m.beginRevisit(blocked, 'mars', before.revision).ok, false); assert.deepEqual(blocked.snapshot, before);
  }
  const legacy = new m.CampaignSave(null, 'test:old-discovery');
  legacy.update(d => d.earth.discoveredPlanets.push('mars', 'fog_moon', 'bullion_reach'));
  assert.equal(m.campaignNavigation(legacy, 'ledger_prime').action, 'earth');
  assert.equal(m.campaignNavigation(legacy, 'mars').action, 'blocked');
  assert.equal(m.campaignNavigation(legacy, 'fog_moon').action, 'blocked');
  // Old guardian/clear records cannot misreport the rebuilt encounters.
  legacy.update(d => { d.earth.defeatedGuardians.push('mars'); d.earth.defeatedSurfaceBosses.push('fog_moon'); });
  assert.equal(m.chapterRecord(legacy, 'mars').surface, 'MARGIN WARDEN');
  assert.equal(m.chapterRecord(legacy, 'mars').orbitalCleared, false);
  assert.equal(m.chapterRecord(legacy, 'fog_moon').surfaceCleared, false);
  legacy.update(d => { d.quests.push('mars.orbit_reached', 'mars.margin_warden_defeated', 'fog_moon.restored'); });
  assert.equal(m.chapterRecord(legacy, 'mars').orbitalCleared, true);
  assert.equal(m.chapterRecord(legacy, 'mars').surfaceCleared, true);
  assert.equal(m.chapterRecord(legacy, 'fog_moon').surfaceCleared, true);
  assert.equal(m.chapterRecord(legacy, 'rugfall'), undefined);
  assert.equal(m.chapterRecord(legacy, 'bullion_reach').surfaceCleared, false);
  const first = fresh(); first.update(d => { d.location.world = 'mars'; d.transit.route = 'earth_mars'; d.transit.phase = 'mars'; d.transit.wave = 4; d.quests = d.quests.filter(q => !q.startsWith('fog_moon.')); });
  assert.equal(m.campaignNavigation(first, 'fog_moon').action, 'fogVoyage');
  assert.ok(m.beginFogVoyage(first).ok); assert.equal(m.canPlotFogMoon(first), false);
  const stale = fresh(), revision = stale.snapshot.revision;
  stale.update(d => { d.credits++; }); const newer = stale.snapshot;
  assert.equal(m.beginRevisit(stale, 'mars', revision).ok, false); assert.deepEqual(stale.snapshot, newer);
  fail = true; assert.equal(m.beginRevisit(stale, 'mars', newer.revision).ok, false); assert.deepEqual(stale.snapshot, newer); fail = false;

  // Run the real MeshRuntime transition methods with controllable asset boundaries.
  // Actual meshes/rendering receive the separate browser playtest.
  async function runtime() {
    const r = Object.create(m.MeshRuntime.prototype), old = { active: false, disposed: false, setActive(v) { this.active = v; }, render() {}, update() {}, dispose() { this.disposed = true; } };
    Object.assign(r, { root: new Element(), hud: new Element(), status: new Element(), controls: new Element(), renderer: {}, environment: { texture: null }, controller: new m.SceneController(), resize() {}, startLoop() {} });
    await r.controller.change(async () => old);
    globalThis.travelHarness = { disposed: 0, load: async ids => ids.map(id => ({ scene: { id } })), construct() {} };
    return { r, old };
  }
  for (const mode of ['bridge', 'revisit']) {
    const current = fresh(), before = current.snapshot, { r, old } = await runtime();
    travelHarness.load = async () => { throw Error('planned download failure'); };
    await (mode === 'bridge' ? r.showBoarding(current) : r.showSpace(current, false, 'mars'));
    assert.deepEqual(current.snapshot, before, `${mode}: failed download must not change route`); assert.ok(old.active && !old.disposed);
    assert.equal(r.hud.dataset.recovery, 'true');
    let release; travelHarness.load = ids => new Promise(resolve => { release = () => resolve(ids.map(id => ({ scene: { id } }))); });
    travelHarness.construct = host => { assert.deepEqual(current.snapshot, before, 'scene must exist before commit'); if (mode === 'bridge') assert.equal(host.entryRoom, 'bridge'); };
    const pending = mode === 'bridge' ? r.showBoarding(current) : r.showSpace(current, false, 'mars');
    await Promise.resolve(); assert.deepEqual(current.snapshot, before); assert.equal(old.active, false);
    release(); await pending; assert.ok(old.disposed); assert.equal(current.snapshot.location.mode, mode === 'bridge' ? 'hub' : 'space');
    assert.equal(current.snapshot.location.world, mode === 'bridge' ? 'fog_moon' : 'mars'); assert.equal(current.snapshot.credits, before.credits);
  }
  for (const mode of ['bridge', 'revisit']) for (const problem of ['construction', 'storage', 'stale', 'cancel', ...(mode==='revisit'?['background']:[])]) {
    const current = fresh(), before = current.snapshot, { r, old } = await runtime();
    if(problem==='background')travelHarness.backgroundFailure=true;
    if (problem === 'construction') travelHarness.construct = () => { throw Error('candidate construction failed'); };
    if (problem === 'storage') fail = true;
    if (problem === 'stale' || problem === 'cancel') travelHarness.load = async ids => {
      if (problem === 'stale') current.update(d => { d.credits++; }); else r.controller.clear();
      return ids.map(id => ({ scene: { id } }));
    };
    await (mode === 'bridge' ? r.showBoarding(current) : r.showSpace(current, false, 'mars')); fail = false;
    assert.deepEqual(current.snapshot.location, before.location); assert.deepEqual(current.snapshot.transit, before.transit);
    assert.equal(current.snapshot.credits, before.credits + (problem === 'stale' ? 1 : 0));
    assert.ok(problem === 'cancel' ? old.disposed : old.active && !old.disposed); assert.ok(travelHarness.disposed > 0);
  }
  // Inspect bundler dependencies, not source spelling, to keep the map lightweight.
  const pure = await build({ entryPoints: ['src/game/definitive/CampaignNavigation.ts'], bundle: true, write: false, metafile: true, format: 'esm', logLevel: 'silent' });
  assert.ok(Object.keys(pure.metafile.inputs).every(path => !path.includes('node_modules/three/')), 'navigation must not eagerly import Three.js');
  console.log('return-travel: PASS - earned-orbit guards, honest map actions, old unlock preservation, reward-free revisits, real transition load/construction/storage/stale/cancel recovery, lazy map dependencies.');
}
try {
  await verify();
  if (!process.env.CODED_TRAVEL_MUTATION) for (const mutation of ['unvisited', 'restart-fog', 'reward-return', 'stale-return', 'early-bridge']) {
    const result = spawnSync(process.execPath, [process.argv[1]], { env: { ...process.env, CODED_TRAVEL_MUTATION: mutation }, encoding: 'utf8', timeout: 60000 });
    assert.notEqual(result.status, 0, `must detect ${mutation}`);
    assert.ok(!result.error && (result.stderr.includes('AssertionError') || result.stderr.includes('ERR_ASSERTION')), `${mutation} must fail behavior, not tooling`);
  }
  if (!process.env.CODED_TRAVEL_MUTATION) console.log('return-travel: five deliberately broken travel/commit controls detected.');
} catch (error) { console.error(error); process.exit(1); }
