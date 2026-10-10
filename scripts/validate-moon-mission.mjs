// validate-moon-mission.mjs — Phase 2 Moon mission integrity checks.
//
// Verifies:
// 1. Moon mission def: acts, checkpoints, encounters all consistent.
// 2. All flight acts have authored encounters (no silent empty acts).
// 3. New Moon enemies exist in the registry with valid defs.
// 4. space_fog_raider is wired (no longer orphaned).
// 5. Campaign route: Earth → Moon → Mars.
// 6. Mars has no mission def (honest placeholder, not a fake mission).
// 7. Base capture encounter: commander + 2 guards build correctly.
// 8. Boo advisor dialogue present.

import assert from 'node:assert/strict';
import { build } from 'esbuild';

const load = async (entry) => {
  const compiled = await build({ entryPoints: [entry], bundle: true, format: 'esm', write: false, logLevel: 'silent' });
  return import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
};

let passed = 0;
const ok = (name, cond) => {
  assert.ok(cond, `FAIL: ${name}`);
  passed++;
  console.log(`  ok: ${name}`);
};

console.log('moon-mission:');

// 1. Mission def integrity
const { MOON_MISSION } = await load('src/game/content/missions/moon.ts');
const { MISSIONS, missionForPlanet, validateMissions } = await load('src/game/content/missions/index.ts');
ok('moon mission registered', MISSIONS.some((m) => m.key === 'moon_lunar_campaign'));
ok('moon mission found by planet', missionForPlanet('moon')?.key === 'moon_lunar_campaign');
ok('no mission validation errors', validateMissions().length === 0);
ok('7 acts defined', MOON_MISSION.acts.length === 7);
const actKeys = MOON_MISSION.acts.map((a) => a.key);
for (const key of ['deployment', 'orbital_approach', 'crater_field', 'dark_side', 'base_approach', 'base_breach', 'moon_secured']) {
  ok(`act ${key} exists`, actKeys.includes(key));
}
ok('moon_secured is complete mode', MOON_MISSION.acts.find((a) => a.key === 'moon_secured')?.mode === 'complete');
ok('base_breach is transition mode', MOON_MISSION.acts.find((a) => a.key === 'base_breach')?.mode === 'transition');

// 2. All flight acts have encounters
for (const act of MOON_MISSION.acts.filter((a) => a.mode === 'flight')) {
  const enc = MOON_MISSION.encounters?.[act.key];
  ok(`flight act ${act.key} has encounters`, !!enc && enc.groups.length > 0);
  for (const group of enc.groups) {
    ok(`group ${group.label} has spawns`, group.spawns.length > 0);
  }
}

// 3. Moon enemies in registry
const { ENEMIES } = await load('src/game/content/registry.ts');
for (const key of ['lunar_drifter', 'crater_ambusher', 'lunar_raider']) {
  const e = ENEMIES[key];
  ok(`enemy ${key} registered`, !!e);
  ok(`${key} has sprite`, !!e?.sprite?.id);
  ok(`${key} has positive hp`, (e?.hp ?? 0) > 0);
}

// 4. space_fog_raider wired
ok('lunar_raider wires space_fog_raider model', ENEMIES['lunar_raider']?.modelId === 'space_fog_raider');

// 5. Campaign route
const { PLANETS, validateCampaignPlanets } = await load('src/game/content/CampaignPlanets.ts');
ok('no campaign validation errors', validateCampaignPlanets().length === 0);
const earth = PLANETS.find((p) => p.key === 'ledger_prime');
const moon = PLANETS.find((p) => p.key === 'moon');
const mars = PLANETS.find((p) => p.key === 'mars');
ok('earth unlocks moon', earth?.unlocks.includes('moon'));
ok('moon unlocks mars', moon?.unlocks.includes('mars'));
ok('moon planet on map', !!moon);

// 6. Mars is an honest placeholder (no mission def)
ok('mars has no mission def (honest placeholder)', missionForPlanet('mars') === undefined);
ok('mars still on campaign map', !!mars);

// 7. Base capture encounter builds
const { buildBaseCapturePlayer, buildBaseCaptureEnemies, BOO_ADVISOR_LINES } = await load('src/game/turnbased/BaseCapture.ts');
const player = buildBaseCapturePlayer(1);
ok('base capture player builds', player.id === 'player' && player.team === 'player');
const enemies = buildBaseCaptureEnemies();
ok('1 commander + 2 guards', enemies.length === 3);
ok('commander identified', enemies.some((e) => e.id === 'commander'));
ok('2 guards', enemies.filter((e) => e.id.startsWith('guard')).length === 2);
ok('all enemies on enemy team', enemies.every((e) => e.team === 'enemy'));

// 8. Boo dialogue present
ok('boo intro lines', BOO_ADVISOR_LINES.intro.length >= 3);
ok('boo victory lines', BOO_ADVISOR_LINES.victory.length >= 2);

// 9. Lunar base hub
const { createLunarBaseState, baseRepair, baseLaunchDestination } = await load('src/game/turnbased/LunarBase.ts');
const { createCombatant, playerActions } = await load('src/game/turnbased/Actions.ts');
const hubState = createLunarBaseState({ level: 1, xp: 0, credits: 100, stemPacks: 1, abilityTiers: {} });
ok('hub state captured', hubState.captured === true);
ok('launch goes to campaign map', baseLaunchDestination() === 'campaign_map');

// 10. Moon unlocks Mars (mission def unlocks field)
ok('moon mission unlocks mars', MOON_MISSION.unlocks?.includes('mars'));

console.log(`\nPASS: all ${passed} moon-mission checks passed.`);
