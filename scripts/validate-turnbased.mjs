// validate-turnbased.mjs — behavioral validator for the Phase 1
// turn-based combat scaffold (src/game/turnbased/).
//
// Covers: turn order correctness, damage calculation, ability cooldowns,
// win/lose triggers, range enforcement, and buff expiry.
//
// The engine modules (Actions.ts, TurnEngine.ts) are pure logic — no DOM,
// no Three.js — so they bundle cleanly under node via esbuild.

import { build } from 'esbuild';

const failures = [];
const check = (ok, message) => {
  if (!ok) failures.push(message);
  else console.log(`  ok: ${message}`);
};

const load = async (entry) => {
  const b = await build({
    entryPoints: [entry],
    bundle: true,
    format: 'esm',
    write: false,
    logLevel: 'silent',
  });
  return import(
    `data:text/javascript;base64,${Buffer.from(b.outputFiles[0].text).toString('base64')}`
  );
};

const { createCombatant, playerActions, testEnemyActions, canUseAction, rangeBand } =
  await load('src/game/turnbased/Actions.ts');
const { TurnEngine, initiativeOrder, computeDamage } =
  await load('src/game/turnbased/TurnEngine.ts');

const mkPlayer = (over = {}) =>
  createCombatant({
    id: 'player',
    name: 'Pilot',
    team: 'player',
    maxHp: 100,
    attack: 8,
    defense: 4,
    speed: 12,
    x: -6,
    z: 0,
    actions: playerActions(),
    ...over,
  });
const mkEnemy = (over = {}) =>
  createCombatant({
    id: 'dummy',
    name: 'Rogue Drone',
    team: 'enemy',
    maxHp: 70,
    attack: 7,
    defense: 2,
    speed: 9,
    x: 6,
    z: 0,
    actions: testEnemyActions(),
    ...over,
  });

console.log('turn order:');
// 1. Higher speed acts first.
{
  const e = new TurnEngine([mkEnemy(), mkPlayer()]);
  e.start();
  check(e.current()?.id === 'player', 'higher speed acts first (player speed 12 > enemy 9)');
}
// 2. Ties broken deterministically by id.
{
  const a = mkPlayer({ id: 'b-player', speed: 10 });
  const b = mkEnemy({ id: 'a-enemy', speed: 10 });
  const order = initiativeOrder([a, b]);
  check(order[0].id === 'a-enemy', 'speed tie broken by id (a-enemy before b-player)');
}

console.log('damage:');
// 3. Damage formula: attack + power - defense, min 1.
{
  const p = mkPlayer();
  const e = mkEnemy();
  const strike = p.actions.find((a) => a.id === 'strike');
  // 8 attack + 12 power - 2 defense = 18
  check(computeDamage(p, strike, e) === 18, `strike damage = 18 (got ${computeDamage(p, strike, e)})`);
}
// 4. Minimum 1 damage vs heavy defense.
{
  const p = mkPlayer({ attack: 1 });
  const tank = mkEnemy({ defense: 999 });
  const strike = p.actions.find((a) => a.id === 'strike');
  check(computeDamage(p, strike, tank) === 1, 'damage floors at 1 vs heavy defense');
}
// 5. Defense buff reduces damage.
{
  const p = mkPlayer();
  const e = mkEnemy();
  e.defenseBuff = 8;
  const strike = p.actions.find((a) => a.id === 'strike');
  // 8 + 12 - (2 + 8) = 10
  check(computeDamage(p, strike, e) === 10, `shield wall reduces strike to 10 (got ${computeDamage(p, strike, e)})`);
}

console.log('cooldowns:');
// 6. Ability usable, then on cooldown, then ready again after ticks.
{
  const p = mkPlayer();
  const e = mkEnemy();
  const eng = new TurnEngine([p, e]);
  eng.start();
  // Move player next to enemy for pulse_blast range (9).
  p.x = 0; e.x = 5;
  check(canUseAction(p, 'pulse_blast'), 'pulse_blast ready on turn 1');
  const out = eng.executeAction('pulse_blast', 'dummy');
  check(out.ok, 'pulse_blast executes');
  check(!canUseAction(p, 'pulse_blast'), 'pulse_blast on cooldown after use');
  check((p.cooldowns.get('pulse_blast') ?? 0) === 3, 'cooldown set to 3 turns');
  // Cooldown-0 action unaffected.
  check(canUseAction(p, 'strike'), 'strike (cooldown 0) still ready');
}
// 7. Cooldown ticks down on endTurn.
{
  const p = mkPlayer();
  p.cooldowns.set('pulse_blast', 2);
  const e = mkEnemy();
  const eng = new TurnEngine([p, e]);
  eng.start();
  eng.endTurn(); // player turn ends -> tick
  check((p.cooldowns.get('pulse_blast') ?? 0) === 1, 'cooldown ticks 2 -> 1 after endTurn');
}
// 8. Shield wall applies buff and it expires.
{
  const p = mkPlayer();
  const e = mkEnemy();
  const eng = new TurnEngine([p, e]);
  eng.start();
  eng.executeAction('shield_wall', null);
  check(p.defenseBuff === 8 && p.defenseBuffTurns === 2, 'shield wall grants +8 for 2 turns');
  eng.endTurn(); // player
  eng.endTurn(); // enemy
  check(p.defenseBuffTurns === 1 && p.defenseBuff === 8, 'buff persists after 1 round');
  eng.endTurn(); // player
  eng.endTurn(); // enemy
  check(p.defenseBuffTurns === 0 && p.defenseBuff === 0, 'buff expires after 2 rounds');
}

console.log('range:');
// 9. Out-of-range attack fails.
{
  const p = mkPlayer({ x: 0, z: 0 });
  const e = mkEnemy({ x: 20, z: 0 });
  const eng = new TurnEngine([p, e]);
  eng.start();
  const out = eng.executeAction('strike', 'dummy');
  check(!out.ok && /out of range/.test(out.reason ?? ''), 'strike fails beyond range 3.5');
  check(rangeBand(20) === 'out', 'rangeBand(20) = out');
  check(rangeBand(2) === 'melee', 'rangeBand(2) = melee');
  check(rangeBand(6) === 'short', 'rangeBand(6) = short');
  check(rangeBand(12) === 'long', 'rangeBand(12) = long');
}

console.log('win/lose:');
// 10. Victory when all enemies dead.
{
  const p = mkPlayer({ x: 0, z: 0 });
  const e = mkEnemy({ x: 1, z: 0, maxHp: 1 });
  const eng = new TurnEngine([p, e]);
  eng.start();
  eng.executeAction('strike', 'dummy');
  check(eng.checkEnd() === 'victory', 'victory when last enemy defeated');
  check(eng.current() === null, 'no current turn after victory');
}
// 11. Defeat when player dead.
{
  const p = mkPlayer({ maxHp: 1, x: 0, z: 0, speed: 1 });
  const e = mkEnemy({ x: 1, z: 0, speed: 99 });
  const eng = new TurnEngine([p, e]);
  eng.start();
  check(eng.current()?.id === 'dummy', 'fast enemy acts first');
  eng.executeAction('claw', 'player');
  check(eng.checkEnd() === 'defeat', 'defeat when player defeated');
}
// 12. Dead combatants are skipped in turn order.
{
  const p = mkPlayer({ speed: 5 });
  const e1 = mkEnemy({ id: 'e1', speed: 10, maxHp: 1 });
  const e2 = mkEnemy({ id: 'e2', speed: 8 });
  const eng = new TurnEngine([p, e1, e2]);
  eng.start();
  // Kill e1 out of turn to simulate prior damage.
  e1.hp = 0; e1.alive = false;
  const cur = eng.current();
  check(cur?.id === 'e2', `dead e1 skipped, e2 acts (got ${cur?.id})`);
}

if (failures.length > 0) {
  console.error(`\nFAIL: ${failures.length} check(s) failed:`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('\nPASS: all turn-based checks passed.');
