import { build } from 'esbuild';

async function loadModule(entryPoint) {
  const result = await build({
    entryPoints: [entryPoint],
    bundle: true,
    format: 'esm',
    write: false,
    logLevel: 'silent',
  });
  return import('data:text/javascript,' + encodeURIComponent(result.outputFiles[0].text));
}

const progress = await loadModule('src/game/content/CampaignProgress.ts');

const legacy = progress.parseCampaignProgress('{"highScore":1200,"currentPlanet":"ledger_prime","discoveredPlanets":["ledger_prime"]}');
if (!Array.isArray(legacy.shipTech) || legacy.shipTech.length !== 0) {
  console.error('L1-E validation FAILED: legacy progress did not safely default shipTech to empty.');
  process.exit(1);
}

const once = progress.recordGuardianDefeated(progress.EMPTY_PROGRESS, 'ledger_prime', 'fog_breaker_pulse');
const twice = progress.recordGuardianDefeated(once, 'ledger_prime', 'fog_breaker_pulse');
if (
  twice.shipTech.filter((key) => key === 'fog_breaker_pulse').length !== 1
  || twice.defeatedGuardians.filter((key) => key === 'ledger_prime').length !== 1
  || !progress.hasShipTech(twice, 'fog_breaker_pulse')
) {
  console.error('L1-E validation FAILED: Gary reward is not idempotent.');
  process.exit(1);
}

const reloaded = progress.parseCampaignProgress(JSON.stringify(twice));
const afterRun = progress.recordCampaignRun(reloaded, 2000, 6, false);
if (!progress.hasShipTech(reloaded, 'fog_breaker_pulse') || !progress.hasShipTech(afterRun, 'fog_breaker_pulse')) {
  console.error('L1-E validation FAILED: permanent fighter tech did not survive serialization/run recording.');
  process.exit(1);
}

console.log('L1-E progress validation OK — Fog Breaker is permanent and reload-safe.');

const cinematics = await loadModule('src/game/content/Level1Cinematics.ts');
const cinematicErrors = cinematics.validateLevel1Cinematics();
if (cinematicErrors.length > 0) {
  console.error('L1-E cinematic validation FAILED:');
  for (const error of cinematicErrors) console.error('  - ' + error);
  process.exit(1);
}

const launchDuration = cinematics.revealTotalDuration(cinematics.EARTH_LAUNCH_REVEAL);
const garyDuration = cinematics.revealTotalDuration(cinematics.GARY_FOG_REVEAL);
if (launchDuration < 5 || cinematics.GARY_FOG_REVEAL.musicLead < 5 || garyDuration < 9) {
  console.error('L1-E cinematic validation FAILED: music-led launch/boss buildup was shortened below the design floor.');
  process.exit(1);
}

console.log(`L1-E cinematic validation OK — launch ${launchDuration.toFixed(1)}s, Gary reveal ${garyDuration.toFixed(1)}s.`);

const bossFlow = await loadModule('src/game/content/EarthBossFlow.ts');
const bossErrors = bossFlow.validateGaryFogGuardianPlan();
if (bossErrors.length > 0) {
  console.error('L1-E Gary Fog validation FAILED:');
  for (const error of bossErrors) console.error('  - ' + error);
  process.exit(1);
}

const awardedOnce = bossFlow.awardGaryFogVictory(progress.EMPTY_PROGRESS);
const awardedTwice = bossFlow.awardGaryFogVictory(awardedOnce);
if (
  !bossFlow.hasFogBreaker(awardedTwice)
  || awardedTwice.shipTech.filter((key) => key === bossFlow.FOG_BREAKER_TECH_KEY).length !== 1
  || bossFlow.GARY_FOG_GUARDIAN_PLAN.musicLeadSeconds < 5
) {
  console.error('L1-E Gary Fog validation FAILED: reward or music-first reveal contract is broken.');
  process.exit(1);
}

console.log('L1-E Gary Fog validation OK — guardian reward and music-first reveal are locked.');
