// ZamnShowcase.ts — the Mr Zamn TruFi mech showcase (Phase 2.5).
//
// Turn-based side mission between Moon and Mars. Cryptotron scouts probe
// the newly captured lunar base; Mr Zamn takes the mech out to hold the
// line. This is Zamn's mission — he is the playable character, not XRPman.
//
// Purpose:
//  1. Second real turn-based fight before the Red Candle King (difficulty ramp).
//  2. Seeds Mr Zamn's playable kit ahead of the Part 2 party system.
//  3. Palate cleanser between the Moon base capture and the Mars campaign.
//
// Optional side mission: Mars remains reachable without completing this.

import type { ActionDef, Combatant } from './Actions';
import { createCombatant, zamnActions } from './Actions';
import { LUNAR_SURFACE } from './Locations';
import type { TurnArena } from './Arena';
import { TurnEngine } from './TurnEngine';

export const ZAMN_SHOWCASE_ID = 'zamn_showcase';

/** Credits awarded for completing the showcase. */
export const ZAMN_SHOWCASE_CREDITS = 120;
/** Difficulty rating for XP scaling (scouts + leader). */
export const ZAMN_SHOWCASE_DIFFICULTY = 3;

/** Zamn's intro lines. He's a soldier, not a poet. */
export const ZAMN_SHOWCASE_LINES = {
  intro: [
    'MR ZAMN: Contacts on the perimeter. Cryptotron scouts, probing the new base.',
    'MR ZAMN: RCK\'s busy. Boo\'s napping. This one\'s mine.',
    'MR ZAMN: TruFi online. Shield up. Protect the team.',
  ],
  midFight: [
    'MR ZAMN: They called friends. Fine. More targets.',
  ],
  victory: [
    'MR ZAMN: Perimeter secure. Base holds.',
    'MR ZAMN: Firewall Defense protocol unlocked. The team gets this too, when they\'re ready.',
  ],
} as const;

/** Module state: availability + completion. Set by main.ts event wiring. */
let showcaseAvailable = false;
let showcaseComplete = false;
let firewallUnlocked = false;

/** The showcase becomes available after the lunar base is captured. */
export function setShowcaseAvailable(available: boolean): void {
  showcaseAvailable = available;
}

export function isShowcaseAvailable(): boolean {
  return showcaseAvailable;
}

export function isShowcaseComplete(): boolean {
  return showcaseComplete;
}

export function isFirewallUnlocked(): boolean {
  return firewallUnlocked;
}

/**
 * Mark the showcase complete. Grants credits and unlocks Firewall Defense.
 * Returns the rewards for the caller to apply to player progress.
 */
export function completeShowcase(): { credits: number; firewallUnlocked: boolean } {
  showcaseComplete = true;
  firewallUnlocked = true;
  return { credits: ZAMN_SHOWCASE_CREDITS, firewallUnlocked: true };
}

/** Reset module state (tests). */
export function resetShowcaseState(): void {
  showcaseAvailable = false;
  showcaseComplete = false;
  firewallUnlocked = false;
}

/** Build Mr Zamn in the TruFi mech: slow, heavy, high defense. The tank. */
export function buildZamn(): Combatant {
  return createCombatant({
    id: 'zamn',
    name: 'Mr Zamn',
    team: 'player',
    maxHp: 140,
    attack: 10,
    defense: 10,
    speed: 7,
    x: -6,
    z: 0,
    actions: zamnActions(firewallUnlocked),
  });
}

/** Cryptotron scout: fast, weak, swarm tactics. */
function scoutActions(): ActionDef[] {
  return [
    {
      id: 'scout_sting',
      name: 'Scout Sting',
      kind: 'attack',
      power: 7,
      range: 3.5,
      cooldown: 0,
      description: 'Quick melee sting.',
    },
    {
      id: 'dart_volley',
      name: 'Dart Volley',
      kind: 'ability',
      power: 12,
      range: 9,
      cooldown: 3,
      description: 'Ranged dart burst. 3-turn cooldown.',
    },
  ];
}

/** Scout leader: tougher, calls one reinforcement wave at 50% HP. */
function scoutLeaderActions(): ActionDef[] {
  return [
    {
      id: 'leader_slash',
      name: 'Leader Slash',
      kind: 'attack',
      power: 11,
      range: 3.5,
      cooldown: 0,
      description: 'Heavy melee slash.',
    },
    {
      id: 'rally_cry',
      name: 'Rally Cry',
      kind: 'ability',
      power: 0,
      range: 0,
      cooldown: 99,
      description: 'Calls a reinforcement scout. Once per battle.',
    },
  ];
}

/** Build 3 scouts + 1 leader. */
export function buildScoutEnemies(): Combatant[] {
  const positions = [
    { x: 5, z: -4 },
    { x: 6, z: 0 },
    { x: 5, z: 4 },
  ];
  const scouts = positions.map((p, i) =>
    createCombatant({
      id: `scout${i + 1}`,
      name: 'Cryptotron Scout',
      team: 'enemy',
      maxHp: 30,
      attack: 6,
      defense: 1,
      speed: 14,
      x: p.x,
      z: p.z,
      actions: scoutActions(),
    }),
  );
  const leader = createCombatant({
    id: 'scout_leader',
    name: 'Scout Leader',
    team: 'enemy',
    maxHp: 70,
    attack: 9,
    defense: 3,
    speed: 11,
    x: 7,
    z: 0,
    actions: scoutLeaderActions(),
  });
  return [...scouts, leader];
}

/** Build a single reinforcement scout (spawned by the leader's rally). */
export function buildReinforcementScout(n: number): Combatant {
  return createCombatant({
    id: `scout_reinforce${n}`,
    name: 'Cryptotron Scout',
    team: 'enemy',
    maxHp: 30,
    attack: 6,
    defense: 1,
    speed: 14,
    x: 8,
    z: n % 2 === 0 ? -5 : 5,
    actions: scoutActions(),
  });
}

export interface ReinforcementState {
  called: boolean;
  spawned: number;
}

/**
 * Check whether the scout leader should call reinforcements.
 * Triggers once when the leader drops to 50% HP or below.
 * Pure logic: the caller supplies the spawn function (Arena or test).
 */
export function maybeCallReinforcements(
  engine: TurnEngine,
  spawn: (c: Combatant) => void,
  state: ReinforcementState,
): boolean {
  if (state.called) return false;
  const leader = engine.getCombatant('scout_leader');
  if (!leader || !leader.alive) return false;
  if (leader.hp > leader.maxHp / 2) return false;
  state.called = true;
  state.spawned += 1;
  const reinforcement = buildReinforcementScout(state.spawned);
  spawn(reinforcement);
  engine.log.push(`${leader.name} emits a rally cry — reinforcements inbound!`);
  return true;
}

/**
 * Start the Zamn showcase in the given arena.
 * Wires the reinforcement trigger to the arena's turn-end hook.
 * Returns the combatants for test/verification use.
 */
export function startZamnShowcase(arena: TurnArena): Combatant[] {
  const zamn = buildZamn();
  const enemies = buildScoutEnemies();
  const reinfState: ReinforcementState = { called: false, spawned: 0 };
  arena.onTurnEnd = () => {
    const engine = arena.getEngine();
    if (!engine) return;
    maybeCallReinforcements(engine, (c) => arena.spawnReinforcement(c), reinfState);
  };
  arena.startBattleWith([zamn, ...enemies], LUNAR_SURFACE);
  return [zamn, ...enemies];
}
