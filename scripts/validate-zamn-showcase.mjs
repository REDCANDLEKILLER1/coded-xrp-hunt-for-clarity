// validate-zamn-showcase.mjs — behavioral validator for the Phase 2.5
// Mr Zamn TruFi mech showcase (src/game/turnbased/ZamnShowcase.ts).
//
// Covers: Zamn's kit (taunt, heavy melee, locked firewall), taunt
// redirection + expiry, reinforcement trigger (once, at 50% HP),
// mid-battle reinforcement join, victory/defeat, lunar surface location,
// and mission optionality (Mars reachable without the showcase).
//
// Pure-logic modules bundle under node via esbuild (same pattern as
// scripts/validate-turnbased.mjs). Arena.ts is DOM/Three.js coupled and
// is covered by tsc + build instead.

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

const {
  createCombatant,
  zamnActions,
  selectTarget,
  tickCooldowns,
  canUseAction,
} = await load('src/game/turnbased/Actions.ts');
const { TurnEngine } = await load('src/game/turnbased/TurnEngine.ts');
const {
  LUNAR_SURFACE,
  LOCATIONS,
  PROP_CLEAR_RADIUS,
} = await load('src/game/turnbased/Locations.ts');
const {
  buildZamn,
  buildScoutEnemies,
  buildReinforcementScout,
  maybeCallReinforcements,
  completeShowcase,
  isShowcaseComplete,
  isFirewallUnlocked,
  setShowcaseAvailable,
  isShowcaseAvailable,
  resetShowcaseState,
  ZAMN_SHOWCASE_CREDITS,
  ZAMN_SHOWCASE_LINES,
} = await load('src/game/turnbased/ZamnShowcase.ts');
const { MOON_MISSION } = await load('src/game/content/missions/moon.ts');

// ---- Zamn's kit --------------------------------------------------------

resetShowcaseState();
const zamnKit = zamnActions(false);
const kitIds = zamnKit.map((a) => a.id);
check(kitIds.includes('pulse_cannons'), 'Zamn kit has Pulse Cannons');
check(kitIds.includes('energy_shield'), 'Zamn kit has Energy Shield');
check(kitIds.includes('impact_gauntlets'), 'Zamn kit has Impact Gauntlets');
check(!kitIds.includes('firewall_defense'), 'Firewall Defense locked before showcase completion');
check(kitIds.includes('stem_pack'), 'Zamn kit has Stem Pack');

const fwKit = zamnActions(true);
check(
  fwKit.some((a) => a.id === 'firewall_defense'),
  'Firewall Defense present when unlocked',
);

const zamn = buildZamn();
check(zamn.name === 'Mr Zamn', 'Zamn combatant named correctly');
check(zamn.team === 'player', 'Zamn is on the player team');
check(zamn.maxHp === 140, `Zamn has 140 HP (got ${zamn.maxHp})`);
check(zamn.defense === 10, `Zamn has 10 defense (got ${zamn.defense})`);
check(zamn.speed === 7, `Zamn is slow at speed 7 (got ${zamn.speed})`);

const mkFoe = (id) =>
  createCombatant({
    id, name: id, team: 'enemy', maxHp: 30, attack: 5, defense: 0,
    speed: 5, x: 5, z: 0, actions: [],
  });

// ---- Energy Shield: taunt + defense buff --------------------------------

const shield = zamn.actions.find((a) => a.id === 'energy_shield');
check(shield.taunt === 2, `Energy Shield taunts for 2 turns (got ${shield.taunt})`);
check(
  shield.defBuff?.amount === 8 && shield.defBuff?.turns === 2,
  'Energy Shield grants +8 defense for 2 turns',
);
check(shield.cooldown === 4, `Energy Shield has 4-turn cooldown (got ${shield.cooldown})`);

const engine1 = new TurnEngine([zamn, mkFoe('dummy1')]);
engine1.start();
let out = engine1.executeAction('energy_shield', null);
check(out.ok, 'Energy Shield executes');
check(zamn.tauntTurns === 2, `taunt applied for 2 turns (got ${zamn.tauntTurns})`);
check(
  zamn.defenseBuff === 8 && zamn.defenseBuffTurns === 2,
  'defense buff applied (+8, 2 turns)',
);

// ---- Taunt redirection ---------------------------------------------------

// Two players: one taunting, one not. Enemies must pick the taunting one.
const quietAlly = createCombatant({
  id: 'ally', name: 'Ally', team: 'player', maxHp: 50, attack: 5, defense: 0,
  speed: 5, x: -5, z: 2, actions: [],
});
const foe = mkFoe('foe1');
const picked = selectTarget(foe, [quietAlly, zamn, foe]);
check(picked?.id === 'zamn', `taunting Zamn draws fire (got ${picked?.id})`);

// Without taunt, falls back to first alive player.
zamn.tauntTurns = 0;
const picked2 = selectTarget(foe, [quietAlly, zamn, foe]);
check(picked2?.id === 'ally', `no taunt -> first alive player (got ${picked2?.id})`);

// Taunt expires after 2 ticks.
zamn.tauntTurns = 2;
tickCooldowns(zamn);
check(zamn.tauntTurns === 1, 'taunt ticks down to 1');
tickCooldowns(zamn);
check(zamn.tauntTurns === 0, 'taunt expires after 2 turns');

// ---- Impact Gauntlets: heavy damage + cooldown ----------------------------

const gauntlets = zamn.actions.find((a) => a.id === 'impact_gauntlets');
check(gauntlets.power === 28, `Impact Gauntlets power 28 (got ${gauntlets.power})`);
check(gauntlets.range === 3.5, 'Impact Gauntlets are melee range');
check(gauntlets.cooldown === 3, 'Impact Gauntlets have 3-turn cooldown');

const dummy = mkFoe('dummy');
dummy.x = 1; dummy.z = 0; // in melee range of zamn at (-6,0)? no — move zamn close
zamn.x = 0; zamn.z = 0;
const engine2 = new TurnEngine([zamn, dummy]);
engine2.start();
// Zamn is slowest (speed 7 vs dummy 5?) — dummy speed 5 < 7, so zamn acts first.
out = engine2.executeAction('impact_gauntlets', 'dummy');
check(out.ok, 'Impact Gauntlets execute in melee range');
check((out.damageDealt ?? 0) >= 28, `heavy damage dealt (got ${out.damageDealt})`);
check(!canUseAction(zamn, 'impact_gauntlets'), 'Gauntlets on cooldown after use');

// ---- Firewall Defense unlock -----------------------------------------------

check(!isShowcaseComplete(), 'showcase not complete before victory');
check(!isFirewallUnlocked(), 'firewall locked before victory');
const rewards = completeShowcase();
check(isShowcaseComplete(), 'showcase marked complete');
check(isFirewallUnlocked(), 'firewall unlocked after victory');
check(
  rewards.credits === ZAMN_SHOWCASE_CREDITS && rewards.firewallUnlocked,
  `rewards grant ${ZAMN_SHOWCASE_CREDITS} credits + firewall unlock`,
);
resetShowcaseState();

// ---- Enemies: 3 scouts + leader ---------------------------------------------

const enemies = buildScoutEnemies();
check(enemies.length === 4, `4 enemies spawn (got ${enemies.length})`);
const scouts = enemies.filter((e) => e.id.startsWith('scout') && e.id !== 'scout_leader');
check(scouts.length === 3, `3 Cryptotron Scouts (got ${scouts.length})`);
const leader = enemies.find((e) => e.id === 'scout_leader');
check(!!leader, 'Scout Leader present');
check(leader.maxHp === 70, `leader has 70 HP (got ${leader?.maxHp})`);
check(
  scouts.every((s) => s.speed === 14 && s.maxHp === 30),
  'scouts are fast (14) and fragile (30 HP)',
);
check(
  scouts.every((s) => s.actions.some((a) => a.kind === 'attack')),
  'every scout has a basic attack',
);

// ---- Reinforcement trigger --------------------------------------------------

const engine3 = new TurnEngine([buildZamn(), ...buildScoutEnemies()]);
engine3.start();
const state = { called: false, spawned: 0 };
const spawned = [];
// Leader above 50%: no trigger.
maybeCallReinforcements(engine3, (c) => spawned.push(c), state);
check(!state.called && spawned.length === 0, 'no reinforcement above 50% HP');

// Drop leader to exactly 50%: trigger fires once.
const ldr = engine3.getCombatant('scout_leader');
ldr.hp = Math.floor(ldr.maxHp / 2);
const fired = maybeCallReinforcements(engine3, (c) => spawned.push(c), state);
check(fired && state.called, 'reinforcement triggers at 50% HP');
check(spawned.length === 1, 'exactly one reinforcement spawned');
check(
  spawned[0]?.team === 'enemy' && spawned[0]?.maxHp === 30,
  'reinforcement is a Cryptotron Scout',
);

// Second call: no double-trigger.
const fired2 = maybeCallReinforcements(engine3, (c) => spawned.push(c), state);
check(!fired2 && spawned.length === 1, 'reinforcement fires only once');

// Dead leader: no trigger.
const engine4 = new TurnEngine([buildZamn(), ...buildScoutEnemies()]);
engine4.start();
const ldr4 = engine4.getCombatant('scout_leader');
ldr4.hp = 0; ldr4.alive = false;
const state4 = { called: false, spawned: 0 };
maybeCallReinforcements(engine4, () => {}, state4);
check(!state4.called, 'dead leader calls no reinforcements');

// ---- addCombatant: mid-battle join ------------------------------------------

const engine5 = new TurnEngine([buildZamn(), ...buildScoutEnemies()]);
const s0 = engine5.start();
const before = engine5.combatants.length;
const extra = buildReinforcementScout(9);
engine5.addCombatant(extra);
check(
  engine5.combatants.length === before + 1,
  'reinforcement joins the combatant list',
);
check(
  engine5.combatants.some((c) => c.id === extra.id && c.alive),
  'reinforcement is alive in initiative',
);
check(
  engine5.state().result === 'ongoing',
  'battle continues after reinforcement joins',
);

// ---- Victory / defeat --------------------------------------------------------

const engine6 = new TurnEngine([buildZamn(), ...buildScoutEnemies()]);
engine6.start();
for (const e of engine6.combatants.filter((c) => c.team === 'enemy')) {
  e.hp = 0; e.alive = false;
}
check(engine6.checkEnd() === 'victory', 'victory when all scouts defeated');

const engine7 = new TurnEngine([buildZamn(), ...buildScoutEnemies()]);
engine7.start();
const z7 = engine7.getCombatant('zamn');
z7.hp = 0; z7.alive = false;
check(engine7.checkEnd() === 'defeat', 'defeat when Zamn falls');

// ---- Lunar surface location ---------------------------------------------------

check(LOCATIONS.some((l) => l.id === 'lunar_surface'), 'lunar_surface registered');
check(
  LUNAR_SURFACE.background !== 0x111318,
  'lunar surface has its own palette (not lunar base)',
);
check(
  LUNAR_SURFACE.keyLightIntensity > 2.5,
  `harsh sunlight (intensity ${LUNAR_SURFACE.keyLightIntensity})`,
);
check(
  LUNAR_SURFACE.ambientIntensity < 0.5,
  `deep shadows (ambient ${LUNAR_SURFACE.ambientIntensity})`,
);
const badProps = LUNAR_SURFACE.props.filter(
  (p) => Math.hypot(p.x, p.z) < PROP_CLEAR_RADIUS && (p.y ?? 0) < 10,
);
check(
  badProps.length === 0,
  `all ground props clear of the combat circle (${badProps.length} violations)`,
);
check(
  LUNAR_SURFACE.props.some((p) => p.kind === 'sphere'),
  'Earth hangs in the sky',
);

// ---- Dialogue lines ------------------------------------------------------------

check(ZAMN_SHOWCASE_LINES.intro.length >= 2, 'Zamn intro dialogue present');
check(ZAMN_SHOWCASE_LINES.victory.length >= 1, 'Zamn victory dialogue present');

// ---- Optionality: Mars reachable without the showcase ----------------------------

check(
  MOON_MISSION.unlocks?.includes('mars'),
  'Moon unlocks Mars directly',
);
check(
  !(MOON_MISSION.unlocks ?? []).includes('zamn_showcase'),
  'showcase is NOT in the unlock chain (optional)',
);

// ---- Availability gating ---------------------------------------------------------

resetShowcaseState();
check(!isShowcaseAvailable(), 'showcase unavailable before moon capture');
setShowcaseAvailable(true);
check(isShowcaseAvailable(), 'showcase available after moon capture');
resetShowcaseState();

if (failures.length > 0) {
  console.error(`FAIL: ${failures.length} zamn-showcase checks failed:`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('PASS: all zamn-showcase checks passed.');
