import assert from 'node:assert/strict';
import { build } from 'esbuild';

const compiled = await build({ stdin: { contents: `export * from './src/game/definitive/CampaignSave.ts'; export { configureCampaignPersistence, loadCampaignProgress, saveCampaignProgress } from './src/game/content/CampaignProgress.ts';`, resolveDir: process.cwd() }, bundle: true, format: 'esm', write: false, logLevel: 'silent' });
const { CampaignSave, SAVE_PREFIX, newDefinitiveSave, parseDefinitiveSave, reviewSaveSlot, configureCampaignPersistence, loadCampaignProgress, saveCampaignProgress } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
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
