import assert from 'node:assert/strict';
import { build } from 'esbuild';

const compiled = await build({ stdin: { contents: `export * from './src/game/definitive/CampaignSave.ts'; export {startFreshTestRun} from './src/game/definitive/TestRun.ts'; export { configureCampaignPersistence, loadCampaignProgress, saveCampaignProgress } from './src/game/content/CampaignProgress.ts';`, resolveDir: process.cwd() }, bundle: true, format: 'esm', write: false, logLevel: 'silent' });
const { startFreshTestRun, CampaignSave, SAVE_PREFIX, newDefinitiveSave, parseDefinitiveSave, reviewSaveSlot, configureCampaignPersistence, loadCampaignProgress, saveCampaignProgress } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
const data = new Map();
let failWrites = false;
const writes = [];
const storage = { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => { if (failWrites) throw new Error('Quota exceeded'); writes.push(key); data.set(key, value); } };
const legacyKey = 'coded-xrp-campaign-progress-v3';
const legacyRaw = JSON.stringify({ highScore: 1234, highestWave: 8, shipTech: ['fog_breaker_pulse'], currentPlanet: 'fog_moon' });
data.set(legacyKey, legacyRaw);
const game = new CampaignSave(storage);
assert.equal(game.snapshot.earth.highScore, 1234, 'campaign reads legacy progress');
assert.equal(game.snapshot.warshipOwned, false, 'legacy completion cannot grant the new ship capture');
assert.equal(writes.length, 0, 'opening does not rewrite any save');
const fixture = new CampaignSave(storage, 'test:boarding');
assert.equal(fixture.snapshot.earth.highScore, 0, 'section tests start independently');
assert.equal(reviewSaveSlot(new URLSearchParams('space')), 'test:space');
assert.equal(reviewSaveSlot(new URLSearchParams('review=boarding')), 'test:boarding');
assert.equal(reviewSaveSlot(new URLSearchParams('review=boarding&run=deck2')), 'test:boarding:deck2');
assert.equal(reviewSaveSlot(new URLSearchParams('run=deck2')), 'campaign','test-run labels never alter a real campaign slot');
assert.equal(reviewSaveSlot(new URLSearchParams('review=boarding&run=../bad')), 'test:boarding');
assert.equal(reviewSaveSlot(new URLSearchParams()), 'campaign');

const reward = (draft) => {
  draft.credits += 120;
  draft.quests.push('bridge_secured');
  draft.recruits.push('mr_zamn');
  draft.heroUpgrades.ledger_shield = 1;
  draft.warshipOwned = true;
  draft.location = { mode: 'hub', world: 'ledger_prime', checkpoint: 'bridge.secured' };
};
assert.equal(game.claim('earth:bridge', reward).ok, true);
const after = game.snapshot;
const reloaded = new CampaignSave(storage);
assert.deepEqual(reloaded.snapshot, after, 'ownership, quest, recruit, upgrade, credits and checkpoint commit together');
assert.deepEqual(reloaded.claim('earth:bridge', reward), { ok: false, reason: 'duplicate' });
assert.deepEqual(reloaded.snapshot, after, 'repeated reward is inert after reload');
assert.equal(data.get(legacyKey), legacyRaw, 'legacy source bytes stay untouched');
assert.ok(writes.every((key) => key.startsWith(SAVE_PREFIX)), 'all writes belong to the definitive namespace');
assert.deepEqual(after.capitalUpgrades, {}, 'hero reward cannot upgrade capital guns');
assert.deepEqual(after.fighterUpgrades, {}, 'hero reward cannot upgrade fighter guns');
assert.deepEqual(after.inventory, {}, 'established saves migrate to an empty cargo inventory');

assert.equal(reloaded.purchase('shop:capacitor', 80, (draft) => { draft.heroUpgrades.capacitor = 1; }).ok, true);
assert.equal(reloaded.snapshot.credits, 40);
const bought = reloaded.snapshot;
assert.equal(reloaded.purchase('shop:too-expensive', 90, (draft) => { draft.heroUpgrades.capacitor = 9; }).ok, false);
assert.deepEqual(reloaded.snapshot, bought, 'failed purchase cannot partly mutate upgrades or balance');
assert.equal(reloaded.purchase('shop:capacitor', 80, () => {}).ok, false);
assert.deepEqual(reloaded.snapshot, bought, 'repeated purchase is not charged twice');

failWrites = true;
assert.deepEqual(reloaded.claim('earth:cache', (draft) => { draft.credits += 60; }), { ok: false, reason: 'storage' });
assert.deepEqual(reloaded.snapshot, bought, 'quota failure cannot grant an unrecorded reward');
failWrites = false;
assert.deepEqual(new CampaignSave(storage).snapshot, bought);
assert.equal(reloaded.claim('earth:cache', (draft) => { draft.credits += 60; }).ok, true, 'failed write is retryable');

const firstTab = new CampaignSave(storage);
const secondTab = new CampaignSave(storage);
assert.equal(firstTab.claim('world:terminal', (draft) => { draft.credits += 5; }).ok, true);
assert.deepEqual(secondTab.claim('world:locker', (draft) => { draft.credits += 8; }), { ok: false, reason: 'conflict' });
secondTab.reload();
assert.equal(secondTab.claim('world:locker', (draft) => { draft.credits += 8; }).ok, true);
assert.ok(secondTab.snapshot.rewards.includes('world:terminal'), 'tab conflict cannot overwrite earlier rewards');
const detached = secondTab.snapshot;
detached.credits = 999999;
assert.notEqual(secondTab.snapshot.credits, detached.credits, 'caller cannot mutate internal state');

for (const raw of ['{broken', JSON.stringify({ ...newDefinitiveSave(), version: 99 }), JSON.stringify({ ...newDefinitiveSave(), credits: -1 })]) {
  data.set(`${SAVE_PREFIX}:test:protected`, raw);
  const protectedSave = new CampaignSave(storage, 'test:protected');
  assert.equal(protectedSave.persistence, 'protected');
  assert.deepEqual(protectedSave.claim('test:reward', (draft) => { draft.credits += 1; }), { ok: false, reason: 'protected' });
  assert.equal(data.get(protectedSave.key), raw, 'unknown or damaged saves are preserved exactly');
}
assert.equal(parseDefinitiveSave(JSON.stringify({ ...newDefinitiveSave(), rewards: ['same', 'same'] })), null);
assert.equal(parseDefinitiveSave(JSON.stringify({ ...newDefinitiveSave(), heroUpgrades: { blast: 2000 } })), null);
assert.equal(parseDefinitiveSave(JSON.stringify({ ...newDefinitiveSave(), inventory: { med_pack: -1 } })), null);
const legacyInventory=newDefinitiveSave();delete legacyInventory.inventory;
assert.deepEqual(parseDefinitiveSave(JSON.stringify(legacyInventory)).inventory,{},'older v1 saves gain empty cargo without losing progress');
const nullInventory={...newDefinitiveSave(),credits:77,inventory:null};
const migratedNullInventory=parseDefinitiveSave(JSON.stringify(nullInventory));assert.deepEqual(migratedNullInventory.inventory,{});assert.equal(migratedNullInventory.credits,77,'null cargo migrates without losing progress');
const session = new CampaignSave(null, 'test:session');
assert.equal(session.persistence, 'session');
assert.equal(session.claim('test:one', (draft) => { draft.credits += 2; }).ok, true);

// Exercise the existing 2D game's actual load/save functions with the adapter.
configureCampaignPersistence({ load: () => secondTab.snapshot.earth, save: (progress) => { secondTab.update((draft) => { draft.earth = progress; }); } });
const earth = loadCampaignProgress();
earth.highScore += 10;
saveCampaignProgress(earth);
assert.equal(new CampaignSave(storage).snapshot.earth.highScore, 1244);
assert.equal(data.get(legacyKey), legacyRaw);
console.log('definitive-save: OK — separate campaign/test saves, read-only migration, atomic rewards/purchases, reload deduplication, quota and tab conflicts, protected future saves, actual 2D adapter.');

// Restart must overwrite the active record, never remove it and reimport legacy progress.
const restartSave = new CampaignSave(storage, 'test:restart');
restartSave.update(draft => { draft.credits = 800; draft.warshipOwned = true; draft.quests.push('captured'); draft.earth.highScore = 500; draft.location = { mode: 'hub', world: 'ledger_prime', checkpoint: 'bridge.secured' }; });
const beforeRestart = restartSave.snapshot;
failWrites = true;
assert.equal(restartSave.restart().ok, false);
assert.deepEqual(restartSave.snapshot, beforeRestart, 'failed restart retains the checkpoint');
failWrites = false;
assert.equal(restartSave.restart().ok, true);
const restarted = new CampaignSave(storage, 'test:restart').snapshot;
const expectedFresh = newDefinitiveSave();
assert.deepEqual({ ...restarted, revision: 0, updatedAt: 0 }, expectedFresh, 'fresh state survives a reload');
assert.equal(data.get(legacyKey), legacyRaw, 'restart leaves legacy records alone');
const staleRestart = new CampaignSave(storage, 'test:restart');
restartSave.update(draft => { draft.credits = 5; });
assert.deepEqual(staleRestart.restart(), { ok: false, reason: 'conflict' }, 'restart cannot overwrite newer progress from another tab');
const protectedRestart = new CampaignSave(storage, 'test:protected');
assert.deepEqual(protectedRestart.restart(), { ok: false, reason: 'protected' });
console.log('Campaign restart checks passed');

// Public testing boot purges campaign records and never loads them, even when
// localStorage cannot delete. Sound/settings are independent of game progress.
const oldRecords=new Map([
 [`${SAVE_PREFIX}:campaign`,JSON.stringify({...newDefinitiveSave(),fighterUpgrades:{weapon_rank:20,weapon_family:4,rapid_fire:4,weapon_level:20}})],
 [`${SAVE_PREFIX}:test:landing`,'old section checkpoint'],
 ['coded-xrp-campaign-progress-v3',legacyRaw],
 ['coded-xrp-campaign-progress-v2','old'],['coded-xrp-campaign-progress-v1','old'],['music-muted','true']
]);
const bootStorage={get length(){return oldRecords.size;},key:i=>[...oldRecords.keys()][i]??null,getItem:k=>oldRecords.get(k)??null,setItem:(k,v)=>oldRecords.set(k,v),removeItem:k=>oldRecords.delete(k)};
const firstBoot=startFreshTestRun(bootStorage);
assert.equal(firstBoot.persistence,'session');assert.equal(firstBoot.snapshot.location.mode,'earth');
assert.deepEqual(firstBoot.snapshot.fighterUpgrades,{weapon_rank:1,weapon_family:0,rapid_fire:0,weapon_level:1});
assert.deepEqual([...oldRecords.entries()],[['music-muted','true']]);
firstBoot.update(d=>{d.fighterUpgrades.weapon_level=20;d.fighterUpgrades.rapid_fire=4;d.credits=500;});
const reopened=startFreshTestRun(bootStorage);assert.equal(reopened.snapshot.fighterUpgrades.weapon_level,1);assert.equal(reopened.snapshot.credits,0);
assert.equal(oldRecords.size,1,'no new persistent save is written');
const blockedStorage={get length(){throw Error('blocked');},removeItem(){throw Error('blocked');}};
assert.equal(startFreshTestRun(blockedStorage).snapshot.fighterUpgrades.rapid_fire,0);
assert.equal(startFreshTestRun(null).snapshot.fighterUpgrades.weapon_level,1);
console.log('fresh test opening: legacy purge, settings preserved, session-only retry checkpoints, reload reset and blocked storage passed');

const withoutPoints=newDefinitiveSave();delete withoutPoints.fighterWeaponPoints;
assert.equal(parseDefinitiveSave(JSON.stringify(withoutPoints)).fighterWeaponPoints,0,'older saves migrate with zero weapon points');
for(const value of [-1,NaN,1.5,'24'])assert.equal(parseDefinitiveSave(JSON.stringify({...newDefinitiveSave(),fighterWeaponPoints:value})),null);
assert.equal(startFreshTestRun(null).snapshot.fighterWeaponPoints,0,'every page opening resets weapon points');
