// Mission framework validation (Phase 0B).
//
// Proves the generalized mission framework:
// - test_moon deploys via missionForPlanet (does NOT hit the old stub path)
// - Earth still resolves identically (fallback to Earth-authored table)
// - Unknown planets still return undefined (stub path preserved)
// - MissionDirector drives the 2-act test mission start-to-finish
// - Per-planet encounter defs resolve; Earth falls back to its table

import { build } from 'esbuild';

const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };

const missionsSrc = await build({
  entryPoints: ['src/game/content/missions/index.ts'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
});
const missions = await import(`data:text/javascript;base64,${Buffer.from(missionsSrc.outputFiles[0].contents).toString('base64')}`);

const directorSrc = await build({
  entryPoints: ['src/game/content/MissionDirector.ts'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
});
const { MissionDirector } = await import(`data:text/javascript;base64,${Buffer.from(directorSrc.outputFiles[0].contents).toString('base64')}`);

const { missionForPlanet, MISSIONS, TEST_MOON_MISSION, EARTH_LEDGER_PRIME_MISSION } = missions;

// 1. test_moon resolves (the whole point: no stub path)
const testMoon = missionForPlanet('test_moon');
check(testMoon !== undefined, 'missionForPlanet(test_moon) resolves');
check(testMoon?.key === 'test_moon_mission', 'test_moon has the right mission key');
check(testMoon === TEST_MOON_MISSION, 'test_moon resolves to the registered def');

// 2. Earth still resolves identically
const earth = missionForPlanet('ledger_prime');
check(earth !== undefined, 'missionForPlanet(ledger_prime) resolves');
check(earth === EARTH_LEDGER_PRIME_MISSION, 'ledger_prime resolves to the Earth def');
check(earth?.acts.length === 12, `Earth still has 12 acts (got ${earth?.acts.length})`);

// 3. Unknown planets still hit the stub path (undefined).
// Mars now has a real mission (Phase 3) — no longer undefined.
check(missionForPlanet('nonexistent_planet') === undefined, 'unknown planet returns undefined (stub path preserved)');
check(missionForPlanet('mars')?.key === 'mars_red_candle', 'mars resolves to the Mars mission');

// 4. MissionDirector drives the 2-act test mission
const director = new MissionDirector();
const firstAct = director.start(testMoon);
check(firstAct?.key === 'test_approach', `test_moon starts at test_approach (got ${firstAct?.key})`);
check(director.currentAct?.key === 'test_approach', 'currentAct is test_approach');
const secondAct = director.advance();
check(secondAct?.key === 'test_assault', `advance goes to test_assault (got ${secondAct?.key})`);
const afterLast = director.advance();
check(afterLast?.key === 'test_assault', 'advance past the last act stays (no crash)');
director.clear();
check(director.activeMission === null, 'clear() resets the director');

// 5. Per-planet encounter defs resolve
check(testMoon?.encounters?.test_approach !== undefined, 'test_approach has an encounter def');
check(testMoon?.encounters?.test_assault !== undefined, 'test_assault has an encounter def');
check(testMoon?.encounters?.test_approach?.groups.length === 1, 'test_approach has exactly 1 group');
check(testMoon?.encounters?.test_assault?.groups.length === 1, 'test_assault has exactly 1 group');
const approachSpawn = testMoon?.encounters?.test_approach?.groups[0]?.spawns[0];
check(approachSpawn?.kind === 'enemy' && approachSpawn?.enemyKey === 'regulator_drone', 'test_approach spawns a regulator_drone');

// 6. Earth has no per-planet encounters (falls back to Earth table) — backward compat
check(earth?.encounters === undefined, 'Earth def carries no encounters field (uses Earth-table fallback)');

// 7. Framework validation still passes for both missions
const errors = missions.validateMissions();
check(errors.length === 0, `validateMissions() clean (got: ${errors.join('; ')})`);

// 8. MISSIONS registry has all expected entries (Earth + Moon + Mars + test_moon fixture)
check(MISSIONS.length === 4, `MISSIONS has 4 entries (got ${MISSIONS.length})`);
check(MISSIONS.some((m) => m.planetKey === 'ledger_prime'), 'MISSIONS includes ledger_prime');
check(MISSIONS.some((m) => m.planetKey === 'moon'), 'MISSIONS includes moon');
check(MISSIONS.some((m) => m.planetKey === 'mars'), 'MISSIONS includes mars');
check(MISSIONS.some((m) => m.planetKey === 'test_moon'), 'MISSIONS includes test_moon');

if (failures.length > 0) {
  console.error(`FAIL: ${failures.length} mission-framework checks failed:`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('PASS: all mission-framework checks passed.');
