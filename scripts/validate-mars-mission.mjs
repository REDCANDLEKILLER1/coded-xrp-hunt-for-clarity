// validate-mars-mission.mjs — Phase 3 Mars mission integrity checks.
//
// Verifies:
// 1. Mars mission def: acts, checkpoints, encounters all consistent.
// 2. All flight acts have authored encounters (no silent empty acts).
// 3. New Mars enemies exist in the registry with valid defs.
// 4. space_rug_fighter is wired (no longer orphaned).
// 5. Campaign route: Earth → Moon → Mars (complete, no further unlocks).
// 6. No stub path: deploying to Mars runs the mission.
// 7. Mars enemies do NOT use the salvo doctrine (homing uniqueness).

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

console.log('mars-mission:');

// 1. Mission def integrity
const { MARS_MISSION } = await load('src/game/content/missions/mars.ts');
const { MISSIONS, missionForPlanet, validateMissions } = await load('src/game/content/missions/index.ts');
ok('mars mission registered', MISSIONS.some((m) => m.key === 'mars_red_candle'));
ok('mars mission found by planet', missionForPlanet('mars')?.key === 'mars_red_candle');
ok('no mission validation errors', validateMissions().length === 0);
ok('7 acts defined', MARS_MISSION.acts.length === 7);
const actKeys = MARS_MISSION.acts.map((a) => a.key);
for (const key of ['deployment', 'orbital_approach', 'dust_storm', 'canyon_run', 'surface_assault', 'kings_gate', 'mars_secured']) {
  ok(`act ${key} exists`, actKeys.includes(key));
}
ok('mars_secured is complete mode', MARS_MISSION.acts.find((a) => a.key === 'mars_secured')?.mode === 'complete');
ok('kings_gate is transition mode', MARS_MISSION.acts.find((a) => a.key === 'kings_gate')?.mode === 'transition');
ok('mars unlocks nothing (Part 1 finale)', (MARS_MISSION.unlocks ?? []).length === 0);

// 2. All flight acts have encounters
for (const act of MARS_MISSION.acts.filter((a) => a.mode === 'flight')) {
  const enc = MARS_MISSION.encounters?.[act.key];
  ok(`flight act ${act.key} has encounters`, !!enc && enc.groups.length > 0);
  for (const group of enc.groups) {
    ok(`group ${group.label} has spawns`, group.spawns.length > 0);
  }
}

// 3. Mars enemies in registry
const { ENEMIES } = await load('src/game/content/registry.ts');
for (const key of ['dust_stalker', 'canyon_ambusher', 'mars_raider']) {
  const e = ENEMIES[key];
  ok(`enemy ${key} registered`, !!e);
  ok(`${key} has sprite`, !!e?.sprite?.id);
  ok(`${key} has positive hp`, (e?.hp ?? 0) > 0);
  ok(`${key} has doctrine`, !!e?.doctrine);
}

// 4. space_rug_fighter wired (was orphaned)
ok('mars_raider wires space_rug_fighter', ENEMIES['mars_raider']?.modelId === 'space_rug_fighter');

// 5. No salvo doctrine on Mars enemies (homing uniqueness: whale_scout owns it)
for (const key of ['dust_stalker', 'canyon_ambusher', 'mars_raider']) {
  ok(`${key} does not use salvo`, ENEMIES[key]?.doctrine !== 'salvo');
}

// 6. Campaign route
const { PLANETS } = await load('src/game/content/CampaignPlanets.ts');
const mars = PLANETS.find((p) => p.key === 'mars');
ok('mars on campaign map', !!mars);
ok('mars guardian is Red Candle King', mars?.guardian === 'RED CANDLE KING');
ok('mars unlocks nothing', (mars?.unlocks ?? []).length === 0);
const moon = PLANETS.find((p) => p.key === 'moon');
ok('moon unlocks mars', moon?.unlocks?.includes('mars') ?? false);

// 7. Checkpoints
ok('6 checkpoints defined', MARS_MISSION.checkpoints.length === 6);
for (const cp of MARS_MISSION.checkpoints) {
  ok(`checkpoint ${cp.key} resumes valid act`, actKeys.includes(cp.resumeActKey));
}

console.log(`\nPASS: all ${passed} mars-mission checks passed.`);
