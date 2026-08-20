// Data-driven content smoke test.
//
// Pure data validation of game content — no DOM, no engine.
// Bundles the TypeScript modules with the already-installed esbuild (a Vite
// dependency; no new package is added) and runs their validators. Exits
// non-zero on any problem so it can gate locally or in CI later.
//
// Run with: npm test

import { build } from 'esbuild';

const result = await build({
  entryPoints: ['src/game/content/registry.ts'],
  bundle: true,
  format: 'esm',
  write: false,
  logLevel: 'silent',
});

const mod = await import(
  'data:text/javascript,' + encodeURIComponent(result.outputFiles[0].text)
);

const errors = mod.validateContent();

if (errors.length > 0) {
  console.error('Content validation FAILED:');
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}

console.log('Content validation OK — registry is well-formed.');

const earthThreatResult = await build({
  entryPoints: ['src/game/content/EarthThreats.ts'],
  bundle: true,
  format: 'esm',
  write: false,
  logLevel: 'silent',
});

const earthThreats = await import(
  'data:text/javascript,' + encodeURIComponent(earthThreatResult.outputFiles[0].text)
);

const earthThreatErrors = earthThreats.validateEarthThreats();
if (earthThreatErrors.length > 0) {
  console.error('Earth threat validation FAILED:');
  for (const e of earthThreatErrors) console.error('  - ' + e);
  process.exit(1);
}
if (!earthThreats.EARTH_ENEMIES.fast_scout || !earthThreats.EARTH_HAZARDS.armored_space_mine) {
  console.error('Earth threat validation FAILED: Level 1 Scout/mine definitions are missing.');
  process.exit(1);
}

console.log('Earth threat validation OK — Scout and mine stay campaign-specific.');

const progressResult = await build({
  entryPoints: ['src/game/content/CampaignProgress.ts'],
  bundle: true,
  format: 'esm',
  write: false,
  logLevel: 'silent',
});

const progress = await import(
  'data:text/javascript,' + encodeURIComponent(progressResult.outputFiles[0].text)
);

const malformed = progress.parseCampaignProgress('{not-json');
const sanitized = progress.parseCampaignProgress('{"highScore":-4,"highestWave":8.9,"victories":"many"}');
const legacyV2 = progress.parseCampaignProgress('{"highScore":750,"highestWave":6,"currentPlanet":"ledger_prime","discoveredPlanets":["ledger_prime"],"checkpoints":{"ledger_prime":"space"}}');
const recorded = progress.recordCampaignRun({ ...progress.EMPTY_PROGRESS, highScore: 500, highestWave: 4, victories: 1 }, 900, 7, true);

if (malformed.highScore !== 0 || sanitized.highScore !== 0 || sanitized.highestWave !== 8 || sanitized.victories !== 0) {
  console.error('Campaign progress validation FAILED: malformed persistence was not sanitized.');
  process.exit(1);
}
if (legacyV2.highScore !== 750 || legacyV2.checkpoints.ledger_prime !== 'space' || Object.keys(legacyV2.missionCheckpoints).length !== 0) {
  console.error('Campaign progress validation FAILED: v2 progress did not migrate safely into the v3 shape.');
  process.exit(1);
}
if (recorded.highScore !== 900 || recorded.highestWave !== 7 || recorded.victories !== 2) {
  console.error('Campaign progress validation FAILED: completed run was not recorded correctly.');
  process.exit(1);
}

const checkpointSnapshot = {
  planetKey: 'ledger_prime',
  missionKey: 'earth_ledger_prime',
  checkpointKey: 'earth.defense_grid',
  checkpointLabel: 'DEFENSE GRID',
  resumeActKey: 'gary_fog',
  shipKey: 'player',
  weaponTier: 2,
  bombs: 1,
  score: 2400,
  savedAt: 1787191200000,
};
const withCheckpoint = progress.recordMissionCheckpoint(progress.EMPTY_PROGRESS, checkpointSnapshot);
const reloadedCheckpointProgress = progress.parseCampaignProgress(JSON.stringify(withCheckpoint));
const reloadedCheckpoint = progress.missionCheckpointFor(reloadedCheckpointProgress, 'ledger_prime');
if (
  !reloadedCheckpoint
  || reloadedCheckpoint.checkpointKey !== 'earth.defense_grid'
  || reloadedCheckpoint.resumeActKey !== 'gary_fog'
  || reloadedCheckpoint.shipKey !== 'player'
  || reloadedCheckpoint.weaponTier !== 2
  || reloadedCheckpoint.bombs !== 1
  || reloadedCheckpoint.score !== 2400
) {
  console.error('Campaign progress validation FAILED: mission checkpoint did not survive serialization.');
  process.exit(1);
}
const withoutCheckpoint = progress.clearMissionCheckpoint(reloadedCheckpointProgress, 'ledger_prime');
if (progress.missionCheckpointFor(withoutCheckpoint, 'ledger_prime')) {
  console.error('Campaign progress validation FAILED: restart did not clear the selected mission checkpoint.');
  process.exit(1);
}

const cleared = progress.recordPlanetCleared(withCheckpoint, 'ledger_prime', 3);
if (
  !cleared.clearedPlanets.includes('ledger_prime')
  || !cleared.discoveredPlanets.includes('fog_moon')
  || cleared.upgradePoints !== 3
  || progress.missionCheckpointFor(cleared, 'ledger_prime')
) {
  console.error('Campaign progress validation FAILED: planet clear did not unlock its route or clear its mission checkpoint.');
  process.exit(1);
}

console.log('Campaign progress validation OK — v3 persistence, migration, and mission checkpoints are safe.');

const campaignResult = await build({
  entryPoints: ['src/game/content/CampaignPlanets.ts'],
  bundle: true,
  format: 'esm',
  write: false,
  logLevel: 'silent',
});

const campaign = await import(
  'data:text/javascript,' + encodeURIComponent(campaignResult.outputFiles[0].text)
);

const campaignErrors = campaign.validateCampaignPlanets();
if (campaignErrors.length > 0) {
  console.error('Planet campaign validation FAILED:');
  for (const e of campaignErrors) console.error('  - ' + e);
  process.exit(1);
}
if (campaign.PLANETS.length !== 10 || campaign.CAMPAIGN_ROUTES.length < 9) {
  console.error('Planet campaign validation FAILED: expected ten routed worlds.');
  process.exit(1);
}
if (campaign.PLANET_BY_KEY.ledger_prime?.label !== 'EARTH') {
  console.error('Planet campaign validation FAILED: Earth must remain the first campaign world.');
  process.exit(1);
}

console.log('Planet campaign validation OK — ten routed worlds are registered.');

const missionResult = await build({
  entryPoints: ['src/game/content/missions/index.ts'],
  bundle: true,
  format: 'esm',
  write: false,
  logLevel: 'silent',
});

const missions = await import(
  'data:text/javascript,' + encodeURIComponent(missionResult.outputFiles[0].text)
);

const missionErrors = missions.validateMissions();
if (missionErrors.length > 0) {
  console.error('Mission validation FAILED:');
  for (const e of missionErrors) console.error('  - ' + e);
  process.exit(1);
}

const earthMission = missions.missionForPlanet('ledger_prime');
if (!earthMission || earthMission.key !== 'earth_ledger_prime' || earthMission.acts.length < 10) {
  console.error('Mission validation FAILED: Earth Level 1 mission skeleton is missing or incomplete.');
  process.exit(1);
}
if (earthMission.acts.at(-1)?.mode !== 'complete' || earthMission.checkpoints.length !== 4) {
  console.error('Mission validation FAILED: Earth Level 1 completion/checkpoint spine is incomplete.');
  process.exit(1);
}

const directorResult = await build({
  entryPoints: ['src/game/content/MissionDirector.ts'],
  bundle: true,
  format: 'esm',
  write: false,
  logLevel: 'silent',
});

const directorModule = await import(
  'data:text/javascript,' + encodeURIComponent(directorResult.outputFiles[0].text)
);

const director = new directorModule.MissionDirector();
director.start(earthMission);
if (director.currentAct?.key !== 'deployment' || director.currentActIndex !== 0 || director.isComplete) {
  console.error('Mission director validation FAILED: mission did not start at deployment.');
  process.exit(1);
}
director.startAtAct(earthMission, 'gary_fog');
if (director.currentAct?.key !== 'gary_fog') {
  console.error('Mission director validation FAILED: checkpoint resume did not start at the requested act.');
  process.exit(1);
}
director.restart();
for (let index = 1; index < earthMission.acts.length; index += 1) director.advance();
if (!director.isComplete || director.currentAct?.key !== 'earth_defended') {
  console.error('Mission director validation FAILED: mission did not advance to Earth defended.');
  process.exit(1);
}
director.restart();
if (director.currentAct?.key !== 'deployment' || director.currentActIndex !== 0) {
  console.error('Mission director validation FAILED: restart did not return to deployment.');
  process.exit(1);
}
director.clear();
if (director.activeMission !== null || director.currentAct !== undefined) {
  console.error('Mission director validation FAILED: clear did not remove mission state.');
  process.exit(1);
}

console.log('Mission validation OK — Earth Level 1 checkpoint resume state is explicit and testable.');

const encounterResult = await build({
  entryPoints: ['src/game/content/EarthFlightEncounters.ts'],
  bundle: true,
  format: 'esm',
  write: false,
  logLevel: 'silent',
});

const encounters = await import(
  'data:text/javascript,' + encodeURIComponent(encounterResult.outputFiles[0].text)
);

const encounterErrors = encounters.validateEarthFlightEncounters();
if (encounterErrors.length > 0) {
  console.error('Earth encounter validation FAILED:');
  for (const e of encounterErrors) console.error('  - ' + e);
  process.exit(1);
}

for (const actKey of ['orbital_approach', 'fog_belt', 'ledger_city', 'defense_grid']) {
  if (!encounters.earthFlightEncounterFor(actKey)) {
    console.error(`Earth encounter validation FAILED: missing authored encounter for ${actKey}.`);
    process.exit(1);
  }
}
if (encounters.earthFlightEncounterFor('gary_fog')) {
  console.error('Earth encounter validation FAILED: L1-D2 must stop authored flight at the Gary Fog boundary.');
  process.exit(1);
}

const encounterDirector = new encounters.EarthFlightEncounterDirector();
encounterDirector.start('orbital_approach');
let step = encounterDirector.update(10, 0);
if (step.spawns.length !== 1 || step.completed || encounterDirector.currentGroupNumber !== 1) {
  console.error('Earth encounter director FAILED: first authored group did not spawn deterministically.');
  process.exit(1);
}
step = encounterDirector.update(0.1, 1);
if (step.spawns.length !== 0 || step.completed) {
  console.error('Earth encounter director FAILED: advanced while an authored threat was still active.');
  process.exit(1);
}
let guard = 0;
while (!step.completed && guard < 20) {
  step = encounterDirector.update(10, 0);
  guard += 1;
}
if (!step.completed || encounterDirector.totalGroups !== 4) {
  console.error('Earth encounter director FAILED: authored act did not complete after all groups cleared.');
  process.exit(1);
}

const grid = encounters.earthFlightEncounterFor('defense_grid');
const hasMixedGrid = grid?.groups.some((group) => {
  const kinds = new Set(group.spawns.map((spawn) => spawn.kind));
  return kinds.has('enemy') && kinds.has('hazard');
});
if (!hasMixedGrid) {
  console.error('Earth encounter validation FAILED: Defense Grid never combines air and ground threats.');
  process.exit(1);
}

console.log('Earth encounter validation OK — threats are taught individually before mixed Defense Grid pressure.');
