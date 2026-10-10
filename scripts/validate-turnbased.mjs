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
const {
  freshProgress, xpToNext, victoryRewards, gainXp, allocateStatPoint,
  abilityTier, upgradeAbility, buyStemPack, rest, serializeSave, deserializeSave,
  MAX_STEM_PACKS, STEM_PACK_HEAL,
} = await load('src/game/turnbased/Progression.ts');
const { WARSHIP_BRIDGE, LUNAR_BASE, LOCATIONS, locationById, PROP_CLEAR_RADIUS } =
  await load('src/game/turnbased/Locations.ts');

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

console.log('progression: xp & levels:');
// 13. XP gain and level-up at threshold.
{
  const p = freshProgress();
  check(p.level === 0 && p.xp === 0, 'fresh progress starts at level 0');
  check(xpToNext(0) === 50, 'level 0 -> 1 needs 50 xp');
  const r = gainXp(p, 50);
  check(r.levelsGained === 1 && p.level === 1, '50 xp levels 0 -> 1');
  check(p.statPoints === 1, 'level-up grants 1 stat point');
  check(p.xp === 0, 'xp remainder carried (exact threshold)');
}
// 14. Multiple level-ups from a large award.
{
  const p = freshProgress();
  const r = gainXp(p, 200); // 50 + 100 = 150 -> level 2, 50 xp toward 150
  check(r.levelsGained === 2 && p.level === 2, `200 xp gains 2 levels (got ${r.levelsGained})`);
  check(p.statPoints === 2, 'two level-ups grant 2 stat points');
  check(p.xp === 50, `50 xp remainder toward level 3 (got ${p.xp})`);
}
// 15. Victory rewards scale with difficulty.
{
  const easy = victoryRewards(1);
  const hard = victoryRewards(3);
  check(easy.xp === 40 && easy.credits === 20, 'difficulty 1 -> 40 xp, 20 credits');
  check(hard.xp === 120 && hard.credits === 60, 'difficulty 3 -> 120 xp, 60 credits');
}
// 16. Stat point allocation.
{
  const p = freshProgress();
  gainXp(p, 50);
  const c = mkPlayer();
  check(allocateStatPoint(p, c, 'attack'), 'allocate attack point');
  check(c.attack === 10, `attack 8 -> 10 (got ${c.attack})`);
  check(p.statPoints === 0, 'stat point consumed');
  check(!allocateStatPoint(p, c, 'defense'), 'no points left -> allocation fails');
  // maxHp allocation also heals.
  gainXp(p, 100);
  const c2 = mkPlayer({ maxHp: 100 });
  c2.hp = 60;
  allocateStatPoint(p, c2, 'maxHp');
  check(c2.maxHp === 115 && c2.hp === 75, `maxHp +15 and heal +15 (got ${c2.maxHp}/${c2.hp})`);
}

console.log('progression: ability tiers:');
// 17. Tier gating: level and credits required.
{
  const p = freshProgress();
  let r = upgradeAbility(p, 'strike');
  check(!r.ok && /level 2/.test(r.reason ?? ''), 'tier 2 blocked below level 2');
  gainXp(p, 50); // level 1
  p.credits = 200;
  r = upgradeAbility(p, 'strike');
  check(!r.ok && /level 2/.test(r.reason ?? ''), 'tier 2 still blocked at level 1');
  gainXp(p, 100); // level 2
  r = upgradeAbility(p, 'strike');
  check(r.ok && abilityTier(p, 'strike') === 2, 'tier 2 unlocks at level 2');
  check(p.credits === 125, `75 credits deducted (got ${p.credits})`);
  r = upgradeAbility(p, 'strike');
  check(!r.ok && /level 4/.test(r.reason ?? ''), 'tier 3 blocked below level 4');
}
// 18. Tier 2 power bump on Strike.
{
  const t2 = playerActions({ strike: 2 });
  const strike = t2.find((a) => a.id === 'strike');
  check(strike.power === 18, `tier-2 strike power 18 (got ${strike.power})`);
  check(!strike.bleed, 'tier-2 strike has no bleed');
}
// 19. Tier-3 Strike applies bleed.
{
  const p = mkPlayer({ x: 0, z: 0, actions: playerActions({ strike: 3 }) });
  const e = mkEnemy({ x: 1, z: 0 });
  const eng = new TurnEngine([p, e]);
  eng.start();
  eng.executeAction('strike', 'dummy');
  check(e.bleedDamage === 4 && e.bleedTurns === 2, 'tier-3 strike applies bleed 4/2');
  const hpBefore = e.hp;
  eng.endTurn(); // player ends -> enemy turn ticks? no: tick applies to actor (player)
  // Bleed ticks on the victim's own endTurn.
  eng.endTurn(); // enemy ends -> bleed ticks
  check(e.hp === hpBefore - 4, `bleed deals 4 on victim turn (got ${hpBefore - e.hp})`);
}
// 20. Tier-3 Pulse Blast splashes to a second enemy.
{
  const p = mkPlayer({ x: 0, z: 0, actions: playerActions({ pulse_blast: 3 }) });
  const e1 = mkEnemy({ id: 'e1', x: 5, z: 0, maxHp: 200 });
  const e2 = mkEnemy({ id: 'e2', x: 6, z: 2, maxHp: 200 });
  const eng = new TurnEngine([p, e1, e2]);
  eng.start();
  const out = eng.executeAction('pulse_blast', 'e1');
  // damage = 8 + 30 - 2 = 36; splash = floor(36 * 0.5) = 18
  check(out.ok && out.damageDealt === 36, `tier-3 pulse blast deals 36 (got ${out.damageDealt})`);
  check(e2.hp === 200 - 18, `splash hits e2 for 18 (got ${200 - e2.hp})`);
}
// 21. Tier-3 Shield Wall buffs harder and reflects melee.
{
  const p = mkPlayer({ x: 0, z: 0, speed: 20, actions: playerActions({ shield_wall: 3 }) });
  const e = mkEnemy({ x: 1, z: 0, speed: 1 });
  const eng = new TurnEngine([p, e]);
  eng.start();
  eng.executeAction('shield_wall', null);
  check(p.defenseBuff === 12 && p.defenseBuffTurns === 3, 'tier-3 wall: +12 for 3 turns');
  check(p.reflectPct === 0.5, 'tier-3 wall: 50% reflect');
  eng.endTurn(); // player -> enemy turn
  const eHpBefore = e.hp;
  eng.executeAction('claw', 'player'); // melee: 7 + 10 - (4 + 12) = 1 (min)
  const reflected = eHpBefore - e.hp;
  check(reflected >= 1, `melee attacker takes reflect damage (got ${reflected})`);
}

console.log('progression: stem packs:');
// 22. Stem pack heals, capped at maxHp, consumes inventory and the turn.
{
  const p = mkPlayer({ x: 0, z: 0, speed: 20, maxHp: 100 });
  p.hp = 50;
  p.items.set('stem_pack', 2);
  const e = mkEnemy({ x: 10, z: 0, speed: 1 });
  const eng = new TurnEngine([p, e]);
  eng.start();
  const out = eng.executeAction('stem_pack', null);
  check(out.ok && out.healed === 40, `stem pack heals 40 (got ${out.healed})`);
  check(p.hp === 90, `hp 50 -> 90 (got ${p.hp})`);
  check(p.items.get('stem_pack') === 1, 'one pack consumed');
}
// 23. Stem pack heal caps at maxHp; fails with empty inventory.
{
  const p = mkPlayer({ maxHp: 100 });
  p.hp = 90;
  p.items.set('stem_pack', 1);
  const e = mkEnemy({ speed: 1 });
  const eng = new TurnEngine([p, e]);
  eng.start();
  const out = eng.executeAction('stem_pack', null);
  check(out.ok && out.healed === 10, `heal capped at maxHp (got ${out.healed})`);
  const out2 = eng.executeAction('stem_pack', null);
  check(!out2.ok && /no Stem Pack left/.test(out2.reason ?? ''), 'empty inventory fails');
}
// 24. Buying stem packs: cost and cap.
{
  const p = freshProgress();
  p.credits = 100;
  check(buyStemPack(p).ok && p.stemPacks === 2, 'buy pack: 1 -> 2');
  check(p.credits === 75, '25 credits deducted');
  p.stemPacks = MAX_STEM_PACKS;
  check(!buyStemPack(p).ok, 'cannot buy beyond max');
}

console.log('progression: rest & save:');
// 25. rest() restores HP, clears state, refills packs, returns save.
{
  const p = freshProgress();
  p.level = 3;
  p.credits = 120;
  p.stemPacks = 1;
  const c = mkPlayer();
  c.hp = 20;
  c.cooldowns.set('pulse_blast', 2);
  c.defenseBuff = 8;
  c.defenseBuffTurns = 2;
  c.bleedDamage = 4;
  c.bleedTurns = 2;
  const save = rest(p, c);
  check(c.hp === c.maxHp, 'rest restores full HP');
  check(c.cooldowns.size === 0 && c.defenseBuff === 0, 'rest clears cooldowns and buffs');
  check(c.bleedTurns === 0, 'rest clears bleed');
  check(p.stemPacks === MAX_STEM_PACKS, 'rest refills stem packs');
  const data = deserializeSave(save);
  check(data !== null && data.progress.level === 3, 'save round-trips progress');
  check(data.combatant.attack === c.attack, 'save round-trips combatant stats');
  check(deserializeSave('not json') === null, 'corrupt save returns null');
}

console.log('locations:');
// 26. Location defs are structurally valid.
{
  check(LOCATIONS.length === 2, 'two prototype locations');
  check(locationById('warship_bridge')?.name === 'Warship Bridge', 'bridge lookup by id');
  check(locationById('lunar_base')?.name === 'Lunar Base Interior', 'lunar base lookup by id');
  check(locationById('nope') === undefined, 'unknown id returns undefined');
  for (const L of LOCATIONS) {
    check(L.ringColors.length === 3, `${L.id}: 3 ring colors`);
    check(L.props.length > 0, `${L.id}: has props`);
  }
}
// 27. Props stay clear of the combat circle.
{
  let clear = true;
  for (const L of LOCATIONS) {
    for (const pr of L.props) {
      const d = Math.hypot(pr.x, pr.z);
      if (d < PROP_CLEAR_RADIUS) {
        clear = false;
        console.log(`  prop violation: ${L.id} ${pr.kind} at dist ${d.toFixed(1)}`);
      }
    }
  }
  check(clear, `all props beyond clear radius ${PROP_CLEAR_RADIUS}`);
}
// 28. The two locations are visually distinct.
{
  check(
    WARSHIP_BRIDGE.background !== LUNAR_BASE.background &&
      WARSHIP_BRIDGE.keyLightColor !== LUNAR_BASE.keyLightColor,
    'bridge and lunar base have distinct palettes',
  );
}

if (failures.length > 0) {
  console.error(`\nFAIL: ${failures.length} check(s) failed:`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('\nPASS: all turn-based checks passed.');
