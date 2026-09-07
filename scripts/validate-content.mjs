// Data-driven content smoke test.
//
// Pure data validation of game content — no DOM, no engine.
// Bundles the TypeScript modules with the already-installed esbuild (a Vite
// dependency; no new package is added) and runs their validators. Exits
// non-zero on any problem so it can gate locally or in CI later.
//
// Run with: npm test

import { build } from 'esbuild';
import { readFileSync, readdirSync } from 'node:fs';

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
  || !cleared.discoveredPlanets.includes('mars')
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
const preservedWorlds=['ledger_prime','mars','fog_moon','bullion_reach','rugfall','sec_outpost','whale_haven','liquidity_depths','court_nexus','regulatory_crown','clarity_zero'];
if (preservedWorlds.some(key=>!campaign.PLANET_BY_KEY[key]) || campaign.CAMPAIGN_ROUTES.length < preservedWorlds.length-1) {
  console.error('Planet campaign validation FAILED: original worlds and the added Mars route must remain connected.');
  process.exit(1);
}
if (campaign.PLANET_BY_KEY.ledger_prime?.label !== 'EARTH') {
  console.error('Planet campaign validation FAILED: Earth must remain the first campaign world.');
  process.exit(1);
}

const migrated=progress.parseCampaignProgress(JSON.stringify({discoveredPlanets:['ledger_prime','fog_moon','rugfall'],clearedPlanets:['ledger_prime']}));
if(!['mars','fog_moon','rugfall'].every(key=>migrated.discoveredPlanets.includes(key)))throw Error('Mars insertion must preserve old unlocks');
console.log('Planet campaign validation OK — preserved worlds, Mars insertion and additive unlock migration.');

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
if (earthMission.acts.at(-1)?.mode !== 'complete') {
  console.error('Mission validation FAILED: Earth Level 1 does not end on a completion act.');
  process.exit(1);
}

// Checkpoint coverage, not a count.
//
// This asserted exactly four checkpoints, which said nothing about whether
// they were in useful places -- four in a row at the start would have passed.
// Level 1 runs about half an hour, and with four across twelve acts a death at
// Gary Fog threw away Ledger City and the whole Defense Grid. What matters is
// the gap: how many acts a single death can cost.
const resumable = new Set(earthMission.checkpoints.map((checkpoint) => checkpoint.resumeActKey));
for (const checkpoint of earthMission.checkpoints) {
  if (!earthMission.acts.some((act) => act.key === checkpoint.resumeActKey)) {
    console.error(`Mission validation FAILED: checkpoint ${checkpoint.key} resumes into "${checkpoint.resumeActKey}", which is not an act.`);
    process.exit(1);
  }
}
// ---- checkpoint keys named as STRINGS in code must actually exist ---------
//
// `DirectBoardingRuntime` dispatches `checkpointKey: 'earth.boarding_lock'` as
// a bare string, and the three guardian plans in EarthBossFlow name theirs the
// same way. TypeScript cannot see any of it, so the mission spine and the code
// that references it can drift apart in silence -- and they nearly did: the
// commit that removed the superseded interior deleted two sibling checkpoints
// with nothing in the build objecting. Deleting one more would have severed
// the capture handoff into the 3D transit and still shipped green.
//
// Scoped to real checkpoint-reference sites -- string literals assigned to a
// `checkpointKey` field -- rather than to every `earth.*` string under src/.
// The broad version is a wider net than the invariant, and would eventually
// fire on a label, an asset id or a telemetry key that merely shares the
// prefix. This is the semantic reference, so it stays true as unrelated
// identifiers come and go.
{
  const declared = new Set(earthMission.checkpoints.map((checkpoint) => checkpoint.key));
  const roots = ['src'];
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walk(full);
      else if (full.endsWith('.ts')) files.push(full);
    }
  };
  for (const root of roots) walk(root);

  let referenced = 0;
  for (const file of files) {
    // Comments stripped: a checkpoint key quoted in an explanation is not a
    // reference, and this repo has been bitten five times by greps that could
    // not tell the difference.
    const code = readFileSync(file, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    for (const match of code.matchAll(/checkpointKey:\s*'([^']+)'/g)) {
      referenced += 1;
      if (!declared.has(match[1])) {
        console.error(`Mission validation FAILED: ${file} references checkpoint "${match[1]}", which the mission does not declare.`);
        process.exit(1);
      }
    }
  }
  // A scraper that finds nothing passes everything. The boarding dispatch and
  // the three guardian plans are four references; fewer means this stopped
  // reading the code rather than that the code stopped referencing.
  if (referenced < 4) {
    console.error(`Mission validation FAILED: only ${referenced} checkpoint reference(s) found in src/ — the scraper is broken.`);
    process.exit(1);
  }
}

// ---- the capture handoff into the 3D transit is still connected -----------
//
// The other half of a contract #108 only tested one side of. Every assertion
// there proved the two new bosses do NOT enter 3D early; none proved the real
// capture still does. A spine cleanup that severed it would have passed them
// all.
{
  const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const boarding = strip(readFileSync('src/game/ui/DirectBoardingRuntime.ts', 'utf8'));
  const main = strip(readFileSync('src/main.ts', 'utf8'));
  const fail = (message) => { console.error(`Mission validation FAILED: ${message}`); process.exit(1); };

  if (!/coded:boarding-complete/.test(boarding)) fail('the boarding runtime no longer announces completion — nothing would enter the 3D transit');
  if (!/warship\.state !== 'disabled'/.test(boarding)) fail('boarding must gate on the warship actually being disabled');
  if (!/coded:boarding-complete/.test(main)) fail('main.ts no longer listens for boarding completion');
  if (!/enterWarship\(definitiveSave,entry\)/.test(main)||!/meshRuntime\.showLanding\(definitiveSave\)/.test(main)||!/meshRuntime\.showSpace\(definitiveSave\)/.test(main)) fail('actual entry must bank the selected fighter and connect 3D landing through captured-hull space');
  for (const act of ['regulatory_warship', 'boarding']) {
    if (!earthMission.acts.some((a) => a.key === act)) fail(`the "${act}" act is gone — the capture route into 3D is broken`);
  }
  const order = earthMission.acts.map((a) => a.key);
  if (order.indexOf('boarding') < order.indexOf('regulatory_warship')) {
    fail('boarding must follow the warship fight, not precede it');
  }
}

const duplicates = earthMission.checkpoints.length - resumable.size;
if (duplicates > 0) {
  console.error(`Mission validation FAILED: ${duplicates} checkpoint(s) resume into an act another already covers.`);
  process.exit(1);
}
// The opening act cannot be a resume point (it IS the start) and the closing
// one needs none. Every act between them should be reachable from a save.
const middle = earthMission.acts.slice(1, -1);
const uncovered = middle.filter((act) => !resumable.has(act.key));
if (uncovered.length > 0) {
  console.error(`Mission validation FAILED: no checkpoint resumes into ${uncovered.map((act) => act.key).join(', ')}.`);
  process.exit(1);
}
// And the worst-case loss, stated in acts rather than left implicit.
let worstGap = 0;
let run = 0;
for (const act of earthMission.acts) {
  run = resumable.has(act.key) ? 0 : run + 1;
  worstGap = Math.max(worstGap, run);
}
if (worstGap > 2) {
  console.error(`Mission validation FAILED: a death can cost ${worstGap} acts of progress; two is the ceiling.`);
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

// ---- a guardian fight happens WHERE the act it interrupts happens ---------
//
// The two boss acts have no authored encounter, so currentStage() finds no
// stageKey for them and, before this, fell through to the WAVE ladder. Both
// landed in `data_canyon` -- a stage Level 1 never visits -- taking its sky,
// accent, props and HUD label for the length of each fight and flipping back
// afterwards. It survived every capture in this PR because a boss forces the
// `boss_arena` backdrop image, which hides the largest part of the symptom.
{
  const bossFlowBuild = await build({
    entryPoints: ['src/game/content/EarthBossFlow.ts'],
    bundle: true, format: 'esm', write: false, logLevel: 'silent',
  });
  const bossFlow = await import(
    'data:text/javascript,' + encodeURIComponent(bossFlowBuild.outputFiles[0].text)
  );
  const { GUARDIAN_PLANS } = bossFlow;
  const acts = earthMission.acts.map((act) => act.key);
  const stageOf = (actKey) => encounters.EARTH_FLIGHT_ENCOUNTERS[actKey]?.stageKey;

  // Named outcomes, not merely "not data_canyon": a wrong-but-different stage
  // has to fail too, or this only guards the one value we happened to see.
  const intended = {
    regulatory_behemoth: 'deep_space_lane',
    clarity_destroyer: 'ledger_city',
    gary_fog: 'ledger_city',
  };
  for (const [actKey, want] of Object.entries(intended)) {
    const plan = GUARDIAN_PLANS.find((p) => p.actKey === actKey);
    if (!plan) {
      console.error(`Mission validation FAILED: no guardian plan for "${actKey}".`);
      process.exit(1);
    }
    if (plan.stageKey !== want) {
      console.error(`Mission validation FAILED: ${actKey} is presented in "${plan.stageKey}", expected "${want}".`);
      process.exit(1);
    }
  }

  // The general rule, and the one that catches the NEXT act inserted without a
  // stage: a guardian interrupts a place, it does not travel to a new one, so
  // its stage is always that of the act it follows. This is also what keeps
  // the explicit stageKey honest as acts are reordered.
  for (const plan of GUARDIAN_PLANS) {
    const index = acts.indexOf(plan.actKey);
    if (index < 1) {
      console.error(`Mission validation FAILED: guardian "${plan.actKey}" is not an act, or has nothing before it.`);
      process.exit(1);
    }
    const previous = stageOf(acts[index - 1]);
    if (!previous) {
      console.error(`Mission validation FAILED: guardian "${plan.actKey}" follows "${acts[index - 1]}", which authors no stage.`);
      process.exit(1);
    }
    if (plan.stageKey !== previous) {
      console.error(
        `Mission validation FAILED: guardian "${plan.actKey}" follows "${acts[index - 1]}" (${previous}) `
        + `but is presented in "${plan.stageKey}".`,
      );
      process.exit(1);
    }
  }

  // And no guardian may reach the wave ladder at all -- the fallback is what
  // produced data_canyon, and every boss act must be answered before it.
  for (const plan of GUARDIAN_PLANS) {
    if (!plan.stageKey) {
      console.error(`Mission validation FAILED: guardian "${plan.actKey}" has no stage and would fall to the wave ladder.`);
      process.exit(1);
    }
  }

  // THE DATA BEING RIGHT IS NOT ENOUGH. Everything above checks the plans;
  // none of it checks that currentStage() reads them. Found by mutation:
  // stubbing the lookup out sent every guardian back to the wave ladder and
  // the whole gate stayed green, because the stageKeys were still correct --
  // which is precisely the shape of the bug this block exists to prevent.
  const stageFn = readFileSync('src/game/core/Game2A.ts', 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .split('private currentStage(')[1]?.split('\n  }')[0] ?? '';
  if (!stageFn) {
    console.error('Mission validation FAILED: could not read currentStage() — the scraper is broken.');
    process.exit(1);
  }
  if (!/guardianPlanFor\(/.test(stageFn) || !/\.stageKey/.test(stageFn)) {
    console.error('Mission validation FAILED: currentStage() must resolve a guardian act through its plan, or boss fights fall to the wave ladder.');
    process.exit(1);
  }
  // A reverted hand-written special case would satisfy the grep above while
  // leaving the other two guardians on the fallback.
  if (/currentAct\?\.key === 'gary_fog'/.test(stageFn)) {
    console.error('Mission validation FAILED: currentStage() hand-cases gary_fog again — every guardian must come from its plan.');
    process.exit(1);
  }
}

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
// The group count is derived, not hardcoded: it was pinned at 4 when the act
// happened to have four groups, which made growing the level a test failure.
// The contract is that the director completes once every group has cleared.
const expectedGroups = encounters.EARTH_FLIGHT_ENCOUNTERS.orbital_approach.groups.length;
let guard = 0;
while (!step.completed && guard < expectedGroups * 3 + 10) {
  step = encounterDirector.update(10, 0);
  guard += 1;
}
if (!step.completed || encounterDirector.totalGroups !== expectedGroups) {
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
