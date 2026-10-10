// Actions.ts — action definitions, combatant state, and cooldown tracking
// for the turn-based combat system. Pure logic: no DOM, no Three.js,
// so this module is directly testable by scripts/validate-turnbased.mjs.

export type ActionKind = 'attack' | 'ability' | 'item' | 'move';

export interface ActionDef {
  id: string;
  name: string;
  kind: ActionKind;
  /** Base damage for attack/ability, heal amount for item, 0 for move. */
  power: number;
  /** Max range in arena units. 0 = self-targeted. */
  range: number;
  /** Turns before reuse. 0 = usable every turn. */
  cooldown: number;
  description: string;
  /** Upgrade tier (1..3). Absent = 1. */
  tier?: number;
  /** Tier-3 Strike: bleed applied on hit. */
  bleed?: { damage: number; turns: number };
  /** Tier-3 Pulse Blast: fraction of damage splashed to other enemies in range. */
  splash?: number;
  /** Tier-3 Shield Wall: fraction of melee damage reflected to attacker. */
  reflect?: number;
}

export type Team = 'player' | 'enemy';

/** Minimal 2D position on the arena plane. */
export interface ArenaPos {
  x: number;
  z: number;
}

export interface Combatant {
  id: string;
  name: string;
  team: Team;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  /** Initiative: higher acts first. Ties broken by id for determinism. */
  speed: number;
  x: number;
  z: number;
  actions: ActionDef[];
  /** actionId -> turns remaining before reuse. Absent/0 = ready. */
  cooldowns: Map<string, number>;
  alive: boolean;
  /** Temporary defense bonus (e.g. Shield Wall). */
  defenseBuff: number;
  defenseBuffTurns: number;
  /** Bleed: damage per turn + turns remaining (tier-3 Strike). */
  bleedDamage: number;
  bleedTurns: number;
  /** Fraction of melee damage reflected to the attacker (tier-3 Shield Wall). */
  reflectPct: number;
  /** Consumable inventory: itemId -> count (e.g. stem_pack). */
  items: Map<string, number>;
}

export interface CombatantSpec {
  id: string;
  name: string;
  team: Team;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  x: number;
  z: number;
  actions: ActionDef[];
}

export function createCombatant(spec: CombatantSpec): Combatant {
  return {
    id: spec.id,
    name: spec.name,
    team: spec.team,
    hp: spec.maxHp,
    maxHp: spec.maxHp,
    attack: spec.attack,
    defense: spec.defense,
    speed: spec.speed,
    x: spec.x,
    z: spec.z,
    actions: spec.actions.map((a) => ({ ...a })),
    cooldowns: new Map<string, number>(),
    alive: true,
    defenseBuff: 0,
    defenseBuffTurns: 0,
    bleedDamage: 0,
    bleedTurns: 0,
    reflectPct: 0,
    items: new Map<string, number>(),
  };
}

/** Tiered player kit. Tiers come from PlayerProgress.abilityTiers.
 *
 *  Strike:      T1 power 12 / T2 power 18 / T3 power 18 + bleed (4/turn, 2 turns)
 *  Pulse Blast: T1 power 22 cd 3 / T2 power 30 cd 3 / T3 power 30 + 50% splash
 *  Shield Wall: T1 +8 def 2 turns cd 4 / T2 +12 def 2 turns cd 3 /
 *               T3 +12 def 3 turns cd 3 + 50% melee reflect
 *  Stem Pack:   consumable item, heals 40, costs the turn. Not tiered.
 */
export function playerActions(tiers?: Record<string, number>): ActionDef[] {
  const t = (id: string): number => tiers?.[id] ?? 1;
  const strikeTier = t('strike');
  const pulseTier = t('pulse_blast');
  const shieldTier = t('shield_wall');
  return [
    {
      id: 'strike',
      name: strikeTier >= 3 ? 'Strike III' : strikeTier === 2 ? 'Strike II' : 'Strike',
      kind: 'attack',
      power: strikeTier >= 2 ? 18 : 12,
      range: 3.5,
      cooldown: 0,
      tier: strikeTier,
      description:
        strikeTier >= 3
          ? 'Empowered melee attack. Applies bleed (4/turn, 2 turns).'
          : 'Basic melee attack.',
      ...(strikeTier >= 3 ? { bleed: { damage: 4, turns: 2 } } : {}),
    },
    {
      id: 'pulse_blast',
      name: pulseTier >= 3 ? 'Pulse Blast III' : pulseTier === 2 ? 'Pulse Blast II' : 'Pulse Blast',
      kind: 'ability',
      power: pulseTier >= 2 ? 30 : 22,
      range: 9,
      cooldown: 3,
      tier: pulseTier,
      description:
        pulseTier >= 3
          ? 'Ranged energy blast. Splashes 50% to nearby enemies. 3-turn cooldown.'
          : 'Ranged energy blast. 3-turn cooldown.',
      ...(pulseTier >= 3 ? { splash: 0.5 } : {}),
    },
    {
      id: 'shield_wall',
      name: shieldTier >= 3 ? 'Shield Wall III' : shieldTier === 2 ? 'Shield Wall II' : 'Shield Wall',
      kind: 'ability',
      power: 0,
      range: 0,
      cooldown: shieldTier >= 2 ? 3 : 4,
      tier: shieldTier,
      description:
        shieldTier >= 3
          ? '+12 defense for 3 turns, reflects 50% of melee damage.'
          : shieldTier === 2
            ? '+12 defense for 2 turns. 3-turn cooldown.'
            : '+8 defense for 2 turns. 4-turn cooldown.',
      ...(shieldTier >= 3 ? { reflect: 0.5 } : {}),
    },
    {
      id: 'stem_pack',
      name: 'Stem Pack',
      kind: 'item',
      power: 40,
      range: 0,
      cooldown: 0,
      description: 'Restore 40 HP. Costs the turn. Limited supply.',
    },
  ];
}

/** Test enemy kit: basic attack + 1 special on cooldown. */
export function testEnemyActions(): ActionDef[] {
  return [
    {
      id: 'claw',
      name: 'Claw Swipe',
      kind: 'attack',
      power: 10,
      range: 3.5,
      cooldown: 0,
      description: 'Basic melee attack.',
    },
    {
      id: 'savage_roar',
      name: 'Savage Roar',
      kind: 'ability',
      power: 18,
      range: 7,
      cooldown: 4,
      description: 'Damaging shockwave. 4-turn cooldown.',
    },
  ];
}

/** True when the action exists on the combatant and its cooldown is ready. */
export function canUseAction(c: Combatant, actionId: string): boolean {
  const def = c.actions.find((a) => a.id === actionId);
  if (!def) return false;
  if (!c.alive) return false;
  return (c.cooldowns.get(actionId) ?? 0) <= 0;
}

/** Put an action on cooldown after use. No-op for cooldown-0 actions. */
export function putOnCooldown(c: Combatant, action: ActionDef): void {
  if (action.cooldown > 0) c.cooldowns.set(action.id, action.cooldown);
}

/** Advance all cooldowns and buff timers by one turn for a combatant.
 *  Returns bleed damage dealt this tick (0 when no bleed). */
export function tickCooldowns(c: Combatant): number {
  for (const [id, turns] of c.cooldowns) {
    if (turns <= 1) c.cooldowns.delete(id);
    else c.cooldowns.set(id, turns - 1);
  }
  if (c.defenseBuffTurns > 0) {
    c.defenseBuffTurns -= 1;
    if (c.defenseBuffTurns <= 0) c.defenseBuff = 0;
  }
  let bleed = 0;
  if (c.bleedTurns > 0 && c.alive) {
    bleed = c.bleedDamage;
    c.hp = Math.max(0, c.hp - bleed);
    if (c.hp <= 0) c.alive = false;
    c.bleedTurns -= 1;
    if (c.bleedTurns <= 0) c.bleedDamage = 0;
  }
  return bleed;
}

export function distance(a: ArenaPos, b: ArenaPos): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

/** Range bands for free-position combat (no grid). */
export type RangeBand = 'melee' | 'short' | 'long' | 'out';

export function rangeBand(d: number): RangeBand {
  if (d <= 3.5) return 'melee';
  if (d <= 9) return 'short';
  if (d <= 15) return 'long';
  return 'out';
}

/** Effective defense including temporary buffs. */
export function effectiveDefense(c: Combatant): number {
  return c.defense + c.defenseBuff;
}
