// RedCandleKing.ts — the Part 1 finale boss fight (turn-based).
//
// The Red Candle King: Michael's brand made manifest. RedCandleKiller vs
// the Red Candle King. Trading card defines the kit:
//   - Liquidity Drain Claws (Strength 30): drains credits on hit (Phase 2)
//   - Razor Teeth (Agility 10): slow but devastating melee (Phase 1)
//   - Intelligence 25, Defense 28: tactical, heavily armored
//   - Power Level 120: end-of-Part-1 boss, should feel like it
//
// Three phases by HP threshold (120 max):
//   Phase 1 (120-72):  Razor Teeth — telegraphed heavy slams, slow.
//   Phase 2 (72-36):   Liquidity Drain Claws — drains credits, new patterns.
//   Phase 3 (36-0):    Enrage — faster, candle-flame AoE (burn DoT), combos.

import type { ActionDef, Combatant } from './Actions';
import { createCombatant, playerActions } from './Actions';
import { KINGS_LAIR } from './Locations';
import type { TurnArena } from './Arena';

export const KING_MAX_HP = 120;
export const PHASE_2_THRESHOLD = 72;
export const PHASE_3_THRESHOLD = 36;

/** Boss dialogue. Arrogant, theatrical — this is Michael's brand character. */
export const KING_DIALOGUE = {
  intro: [
    "RED CANDLE KING: So. The little killer comes to Mars.",
    "RED CANDLE KING: I am every red candle you ever feared. I am the dump. I am the rug.",
    "RED CANDLE KING: Come then. Let me show you what liquidity really costs.",
  ],
  phase2: [
    "RED CANDLE KING: You bite. Good. Now watch me take back what's mine.",
    "RED CANDLE KING: Your credits. Your progress. Your little numbers. MINE.",
  ],
  phase3: [
    "RED CANDLE KING: ENOUGH. The flame does not negotiate.",
    "RED CANDLE KING: BURN. BURN LIKE EVERY PORTFOLIO I EVER TOUCHED.",
  ],
  victory_player: [
    "RED CANDLE KING: ...impossible. The candle... gutters...",
    "RED CANDLE KING: The ledger... remembers... you...",
  ],
  defeat_player: [
    "RED CANDLE KING: Another green candle, snuffed out.",
    "RED CANDLE KING: Come back when you've learned what red means.",
  ],
} as const;

export type KingPhase = 1 | 2 | 3;

/** Determine phase from current HP. */
export function kingPhase(hp: number): KingPhase {
  if (hp <= PHASE_3_THRESHOLD) return 3;
  if (hp <= PHASE_2_THRESHOLD) return 2;
  return 1;
}

/** Phase 1: Razor Teeth — slow, telegraphed heavy melee sweeps. */
function phase1Actions(): ActionDef[] {
  return [
    {
      id: 'razor_teeth',
      name: 'Razor Teeth',
      kind: 'attack',
      power: 16,
      // Sweeping bite: the King's maw covers a huge arc.
      range: 8,
      cooldown: 0,
      description: 'Devastating sweeping bite. Slow windup, massive reach.',
    },
    {
      id: 'titan_stomp',
      name: 'Titan Stomp',
      kind: 'ability',
      power: 24,
      // Stomp shockwave: covers most of the arena.
      range: 12,
      cooldown: 3,
      description: 'The King stomps. The arena shakes. Move far or shield.',
    },
  ];
}

/** Phase 2: Liquidity Drain Claws — drains credits, faster patterns. */
function phase2Actions(): ActionDef[] {
  return [
    {
      id: 'razor_teeth',
      name: 'Razor Teeth',
      kind: 'attack',
      power: 16,
      range: 8,
      cooldown: 0,
      description: 'Devastating sweeping bite. Slow windup, massive reach.',
    },
    {
      id: 'liquidity_drain',
      name: 'Liquidity Drain Claws',
      kind: 'ability',
      power: 14,
      // Claw sweep: long reach.
      range: 8,
      cooldown: 2,
      description: 'Rakes the target, draining 30 credits per hit.',
      drain: { credits: 30 },
    },
    {
      id: 'titan_stomp',
      name: 'Titan Stomp',
      kind: 'ability',
      power: 24,
      range: 12,
      cooldown: 3,
      description: 'The King stomps. The arena shakes. Move far or shield.',
    },
  ];
}

/** Phase 3: Enrage — faster, candle-flame AoE, combos. */
function phase3Actions(): ActionDef[] {
  return [
    {
      id: 'razor_teeth',
      name: 'Razor Teeth',
      kind: 'attack',
      power: 18,
      range: 8,
      cooldown: 0,
      description: 'Faster, angrier sweeping bite.',
    },
    {
      id: 'liquidity_drain',
      name: 'Liquidity Drain Claws',
      kind: 'ability',
      power: 14,
      range: 8,
      cooldown: 2,
      description: 'Rakes the target, draining 30 credits per hit.',
      drain: { credits: 30 },
    },
    {
      id: 'candle_immolation',
      name: 'Candle-Flame Immolation',
      kind: 'ability',
      power: 12,
      // Immolation washes over the arena.
      range: 14,
      cooldown: 3,
      description: 'Engulfs the target in candle-flame. Burns 6/turn for 3 turns.',
      burn: { damage: 6, turns: 3 },
    },
  ];
}

/** Get the King's action set for a phase. */
export function kingActionsForPhase(phase: KingPhase): ActionDef[] {
  switch (phase) {
    case 1: return phase1Actions();
    case 2: return phase2Actions();
    case 3: return phase3Actions();
  }
}

/** Build the Red Candle King combatant. Starts in Phase 1. */
export function buildRedCandleKing(): Combatant {
  return createCombatant({
    id: 'red_candle_king',
    name: 'Red Candle King',
    team: 'enemy',
    maxHp: KING_MAX_HP,
    attack: 12,
    defense: 8,
    // Low agility per the card (10) — but Phase 3 enrage speeds up.
    // Base speed 7; phase transitions adjust.
    speed: 7,
    x: 6,
    z: 0,
    actions: phase1Actions(),
    // ~100ft tall vs XRPman's 6'4": the boss towers over the arena.
    meshScale: 6,
  });
}

/** Build the player for the King fight. Uses current progression. */
export function buildKingFightPlayer(level = 3, tiers?: Record<string, number>): Combatant {
  const hp = 100 + (level - 1) * 15;
  const player = createCombatant({
    id: 'player',
    name: 'Pilot',
    team: 'player',
    maxHp: hp,
    attack: 8 + (level - 1) * 2,
    defense: 4 + (level - 1),
    speed: 12,
    x: -6,
    z: 0,
    actions: playerActions(tiers),
  });
  // Player brings battle credits the King can drain.
  player.credits = 150;
  // Start with 2 stem packs.
  player.items.set('stem_pack', 2);
  return player;
}

/**
 * Check and apply a phase transition for the King.
 * Returns the new phase (and whether it changed) plus dialogue lines.
 * Mutates the King's action set and speed on transition.
 */
export function checkKingPhaseTransition(king: Combatant): {
  phase: KingPhase;
  changed: boolean;
  lines: string[];
} {
  const phase = kingPhase(king.hp);
  const currentIds = new Set(king.actions.map((a) => a.id));
  const expected = kingActionsForPhase(phase);
  const expectedIds = new Set(expected.map((a) => a.id));
  const same =
    currentIds.size === expectedIds.size &&
    [...currentIds].every((id) => expectedIds.has(id));
  if (same) return { phase, changed: false, lines: [] };

  // Phase changed: swap action set, adjust speed.
  king.actions = expected.map((a) => ({ ...a }));
  if (phase === 2) king.speed = 8;
  if (phase === 3) king.speed = 11; // Enrage: faster.

  const lines =
    phase === 2 ? [...KING_DIALOGUE.phase2] :
    phase === 3 ? [...KING_DIALOGUE.phase3] : [];
  return { phase, changed: true, lines };
}

/**
 * Start the Red Candle King fight in the given arena.
 * Returns { player, king } for test/verification use.
 */
export function startRedCandleKingFight(
  arena: TurnArena,
  playerLevel = 3,
  tiers?: Record<string, number>,
): { player: Combatant; king: Combatant } {
  const player = buildKingFightPlayer(playerLevel, tiers);
  const king = buildRedCandleKing();
  arena.startBattleWith([player, king], KINGS_LAIR);
  return { player, king };
}
