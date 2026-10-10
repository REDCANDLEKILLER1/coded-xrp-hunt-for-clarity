// BaseCapture.ts — the lunar base capture encounter.
//
// First real use of the turn-based system beyond the test arena.
// Tutorial-grade: 1 commander + 2 guards, teaches move/attack/ability/stem pack.
// Boo appears as advisor (dialogue only, non-combat).
//
// Victory → lunar base captured → moon_secured → player owns second hub.

import type { ActionDef, Combatant } from './Actions';
import { createCombatant, playerActions } from './Actions';
import { LUNAR_BASE } from './Locations';
import type { TurnArena } from './Arena';

/** Boo's advisor dialogue. Shown before and during the fight. Non-combat. */
export const BOO_ADVISOR_LINES = {
  intro: [
    "BOO: Ruggers don't sleep. Boo does. But not today.",
    "BOO: That's the base commander. Big chair, big mouth, medium brain.",
    "BOO: Guards first — they're soft. Then the commander. Phase shift if it gets hot.",
  ],
  midFight: [
    "BOO: He's charging something. Move or shield, don't just stand there.",
  ],
  victory: [
    "BOO: Base is ours. Ghost mode: OFF. Nap mode: ON.",
    "BOO: This place has bunks, a repair bay, and terrible coffee. Home sweet home.",
  ],
} as const;

/** Commander actions: heavier than guards, with a telegraphed special. */
function commanderActions(): ActionDef[] {
  return [
    {
      id: 'command_strike',
      name: 'Command Strike',
      kind: 'attack',
      power: 14,
      range: 3.5,
      cooldown: 0,
      description: 'Heavy melee strike.',
    },
    {
      id: 'suppression_burst',
      name: 'Suppression Burst',
      kind: 'ability',
      power: 22,
      range: 9,
      cooldown: 3,
      description: 'Telegraphed AoE burst. Move out of range or shield.',
    },
  ];
}

/** Guard actions: basic, tutorial-grade. */
function guardActions(): ActionDef[] {
  return [
    {
      id: 'guard_shot',
      name: 'Guard Shot',
      kind: 'attack',
      power: 8,
      range: 9,
      cooldown: 0,
      description: 'Basic ranged attack.',
    },
  ];
}

/** Build the player combatant for the base capture. Uses current progression. */
export function buildBaseCapturePlayer(level = 1): Combatant {
  const hp = 100 + (level - 1) * 15;
  return createCombatant({
    id: 'player',
    name: 'Pilot',
    team: 'player',
    maxHp: hp,
    attack: 8 + (level - 1) * 2,
    defense: 4 + (level - 1),
    speed: 12,
    x: -6,
    z: 0,
    actions: playerActions(),
  });
}

/** Build the commander + 2 guards. */
export function buildBaseCaptureEnemies(): Combatant[] {
  const commander = createCombatant({
    id: 'commander',
    name: 'Base Commander',
    team: 'enemy',
    maxHp: 120,
    attack: 10,
    defense: 5,
    speed: 8,
    x: 6,
    z: 0,
    actions: commanderActions(),
  });
  const guard1 = createCombatant({
    id: 'guard1',
    name: 'Base Guard',
    team: 'enemy',
    maxHp: 45,
    attack: 6,
    defense: 2,
    speed: 10,
    x: 4,
    z: -3,
    actions: guardActions(),
  });
  const guard2 = createCombatant({
    id: 'guard2',
    name: 'Base Guard',
    team: 'enemy',
    maxHp: 45,
    attack: 6,
    defense: 2,
    speed: 10,
    x: 4,
    z: 3,
    actions: guardActions(),
  });
  return [commander, guard1, guard2];
}

/**
 * Start the lunar base capture in the given arena.
 * Returns the combatants for test/verification use.
 */
export function startBaseCapture(arena: TurnArena, playerLevel = 1): Combatant[] {
  const player = buildBaseCapturePlayer(playerLevel);
  const enemies = buildBaseCaptureEnemies();
  arena.startBattleWith([player, ...enemies], LUNAR_BASE);
  return [player, ...enemies];
}
