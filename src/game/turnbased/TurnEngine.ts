// TurnEngine.ts — core turn loop for the turn-based combat system.
// Pure logic: no DOM, no Three.js. Directly testable by
// scripts/validate-turnbased.mjs.
//
// Design notes:
// - Single-character player for now; the Combatant shape is shared so a
//   party system can attach later without changing the engine.
// - Deterministic: initiative ties broken by combatant id.
// - The engine owns rules (turn order, damage, win/lose). Presentation
//   (Arena.ts) owns visuals and input.

import {
  ActionDef,
  Combatant,
  canUseAction,
  distance,
  effectiveDefense,
  putOnCooldown,
  tickCooldowns,
} from './Actions.ts';

export type BattleResult = 'ongoing' | 'victory' | 'defeat';

export interface ActionOutcome {
  ok: boolean;
  reason?: string;
  /** Human-readable log lines describing what happened. */
  log: string[];
  damageDealt?: number;
  healed?: number;
}

export interface TurnState {
  round: number;
  turnIndex: number;
  currentId: string | null;
  result: BattleResult;
}

/**
 * Sort combatants into initiative order: speed descending,
 * id ascending as a deterministic tiebreak.
 */
export function initiativeOrder(combatants: Combatant[]): Combatant[] {
  return [...combatants].sort((a, b) => {
    if (b.speed !== a.speed) return b.speed - a.speed;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/**
 * Damage formula: attacker's attack + action power, minus target's
 * effective defense. Minimum 1 on a hit. No randomness — deterministic
 * for validator testing and future replay support.
 */
export function computeDamage(
  attacker: Combatant,
  action: ActionDef,
  target: Combatant,
): number {
  const raw = attacker.attack + action.power - effectiveDefense(target);
  return Math.max(1, raw);
}

export class TurnEngine {
  readonly combatants: Combatant[];
  private order: Combatant[] = [];
  private turnIndex = 0;
  private round = 1;
  readonly log: string[] = [];

  constructor(combatants: Combatant[]) {
    // Defensive copy so the engine owns its state.
    this.combatants = combatants;
  }

  /** Begin combat: roll initiative and announce the first turn. */
  start(): TurnState {
    this.order = initiativeOrder(this.combatants.filter((c) => c.alive));
    this.turnIndex = 0;
    this.round = 1;
    this.log.length = 0;
    const first = this.current();
    this.log.push(`--- Round 1 ---`);
    if (first) this.log.push(`${first.name} acts first (speed ${first.speed}).`);
    return this.state();
  }

  /** The combatant whose turn it is now, or null if battle ended. */
  current(): Combatant | null {
    if (this.checkEnd() !== 'ongoing') return null;
    // Skip dead combatants in the order.
    let guard = 0;
    while (guard < this.order.length && !this.order[this.turnIndex].alive) {
      this.advanceIndex();
      guard++;
    }
    return this.order[this.turnIndex] ?? null;
  }

  /** Execute an action for the current combatant. */
  executeAction(actionId: string, targetId: string | null): ActionOutcome {
    const actor = this.current();
    const out: ActionOutcome = { ok: false, log: [] };
    if (!actor) {
      out.reason = 'no active turn (battle ended)';
      return out;
    }
    const action = actor.actions.find((a) => a.id === actionId);
    if (!action) {
      out.reason = `unknown action ${actionId}`;
      return out;
    }
    if (!canUseAction(actor, actionId)) {
      out.reason = `${action.name} is on cooldown`;
      return out;
    }

    if (action.kind === 'move') {
      out.reason = 'move is handled by Arena positioning, not the engine';
      return out;
    }

    // Self-targeted abilities (range 0), e.g. Shield Wall.
    if (action.range === 0 || targetId === null) {
      return this.applySelfAction(actor, action);
    }

    const target = this.combatants.find((c) => c.id === targetId);
    if (!target || !target.alive) {
      out.reason = 'invalid or defeated target';
      return out;
    }
    const d = distance(actor, target);
    if (d > action.range) {
      out.reason = `${target.name} is out of range (${d.toFixed(1)} > ${action.range})`;
      return out;
    }

    if (action.kind === 'item') {
      return this.applyItem(actor, action, target);
    }
    return this.applyAttack(actor, action, target);
  }

  private applyAttack(
    actor: Combatant,
    action: ActionDef,
    target: Combatant,
  ): ActionOutcome {
    const damage = computeDamage(actor, action, target);
    target.hp = Math.max(0, target.hp - damage);
    if (target.hp <= 0) {
      target.alive = false;
    }
    putOnCooldown(actor, action);
    const lines: string[] = [];
    lines.push(`${actor.name} uses ${action.name} on ${target.name} for ${damage} damage.`);

    // Tier-3 Strike bleed.
    if (action.bleed && target.alive) {
      target.bleedDamage = action.bleed.damage;
      target.bleedTurns = action.bleed.turns;
      lines.push(`${target.name} is bleeding (${action.bleed.damage}/turn).`);
    }

    // Candle-flame burn (Red Candle King Phase 3).
    if (action.burn && target.alive) {
      target.burnDamage = action.burn.damage;
      target.burnTurns = action.burn.turns;
      lines.push(`${target.name} is burning (${action.burn.damage}/turn).`);
    }

    // Liquidity Drain (Red Candle King Phase 2): steal credits on hit.
    if (action.drain && target.alive) {
      const stolen = Math.min(action.drain.credits, target.credits);
      target.credits -= stolen;
      actor.credits += stolen;
      lines.push(`${actor.name} drains ${stolen} credits from ${target.name}.`);
    }

    // Tier-3 Pulse Blast splash: half damage to other enemies in range.
    if (action.splash) {
      for (const other of this.combatants) {
        if (other === target || other.team !== target.team || !other.alive) continue;
        if (distance(actor, other) > action.range) continue;
        const splashDmg = Math.max(1, Math.floor(damage * (action.splash ?? 0)));
        other.hp = Math.max(0, other.hp - splashDmg);
        if (other.hp <= 0) other.alive = false;
        lines.push(`Splash hits ${other.name} for ${splashDmg} damage.`);
      }
    }

    // Tier-3 Shield Wall reflect: melee attackers take a fraction back.
    if (target.reflectPct > 0 && action.range <= 3.5 && actor.alive) {
      const reflected = Math.max(1, Math.floor(damage * target.reflectPct));
      actor.hp = Math.max(0, actor.hp - reflected);
      if (actor.hp <= 0) actor.alive = false;
      lines.push(`${target.name} reflects ${reflected} damage to ${actor.name}.`);
    }

    if (!target.alive) lines.push(`${target.name} is defeated!`);
    for (const l of lines) this.log.push(l);
    const result = this.checkEnd();
    if (result === 'victory') this.log.push('Victory!');
    if (result === 'defeat') this.log.push('Defeat...');
    return { ok: true, log: [lines[0]], damageDealt: damage };
  }

  private applySelfAction(actor: Combatant, action: ActionDef): ActionOutcome {
    // Consumable items (stem pack): check inventory, heal self, costs the turn.
    if (action.kind === 'item') {
      const count = actor.items.get(action.id) ?? 0;
      if (count <= 0) {
        return { ok: false, reason: `no ${action.name} left`, log: [] };
      }
      actor.items.set(action.id, count - 1);
      const healed = Math.min(action.power, actor.maxHp - actor.hp);
      actor.hp += healed;
      const line = `${actor.name} uses ${action.name}, restoring ${healed} HP.`;
      this.log.push(line);
      return { ok: true, log: [line], healed };
    }
    // Generic self-buff abilities (Energy Shield, Firewall Defense, ...):
    // apply taunt and/or defense buff from the action definition.
    if (action.taunt || action.defBuff) {
      const lines: string[] = [];
      if (action.taunt) {
        actor.tauntTurns = action.taunt;
        lines.push(`enemies must target ${actor.name} for ${action.taunt} turns`);
      }
      if (action.defBuff) {
        actor.defenseBuff = action.defBuff.amount;
        actor.defenseBuffTurns = action.defBuff.turns;
        lines.push(`+${action.defBuff.amount} defense for ${action.defBuff.turns} turns`);
      }
      // Firewall Defense also cleanses bleed and debuffs.
      if (action.id === 'firewall_defense') {
        actor.bleedDamage = 0;
        actor.bleedTurns = 0;
        lines.push('cleansed of bleed and debuffs');
      }
      putOnCooldown(actor, action);
      const line = `${actor.name} activates ${action.name} (${lines.join(', ')}).`;
      this.log.push(line);
      return { ok: true, log: [line] };
    }
    // Shield Wall: defense buff (+ tier scaling) and optional reflect.
    if (action.id === 'shield_wall') {
      const tier = action.tier ?? 1;
      actor.defenseBuff = tier >= 2 ? 12 : 8;
      actor.defenseBuffTurns = tier >= 3 ? 3 : 2;
      actor.reflectPct = action.reflect ?? 0;
      putOnCooldown(actor, action);
      const line =
        `${actor.name} raises ${action.name} ` +
        `(+${actor.defenseBuff} defense, ${actor.defenseBuffTurns} turns` +
        (actor.reflectPct > 0 ? ', reflecting melee damage' : '') +
        `).`;
      this.log.push(line);
      return { ok: true, log: [line] };
    }
    putOnCooldown(actor, action);
    const line = `${actor.name} uses ${action.name}.`;
    this.log.push(line);
    return { ok: true, log: [line] };
  }

  private applyItem(
    actor: Combatant,
    action: ActionDef,
    target: Combatant,
  ): ActionOutcome {
    const healed = Math.min(action.power, target.maxHp - target.hp);
    target.hp += healed;
    putOnCooldown(actor, action);
    const line = `${actor.name} uses ${action.name} on ${target.name}, restoring ${healed} HP.`;
    this.log.push(line);
    return { ok: true, log: [line], healed };
  }

  /** End the current turn: tick cooldowns/buffs/bleed, advance to next combatant. */
  endTurn(): TurnState {
    const actor = this.order[this.turnIndex];
    if (actor) {
      const bleed = tickCooldowns(actor);
      if (bleed > 0) {
        this.log.push(`${actor.name} bleeds for ${bleed} damage.`);
        if (!actor.alive) this.log.push(`${actor.name} succumbs to bleeding!`);
      }
    }
    this.advanceIndex();
    const result = this.checkEnd();
    const cur = result === 'ongoing' ? this.order[this.turnIndex] : null;
    if (cur && this.turnIndex === 0) {
      this.round += 1;
      this.log.push(`--- Round ${this.round} ---`);
    }
    return this.state();
  }

  private advanceIndex(): void {
    if (this.order.length === 0) return;
    this.turnIndex = (this.turnIndex + 1) % this.order.length;
  }

  /** Add a combatant mid-battle (e.g. called reinforcements).
   *  Recomputes initiative, keeping the current actor's turn. */
  addCombatant(c: Combatant): void {
    const currentId = this.order[this.turnIndex]?.id ?? null;
    this.combatants.push(c);
    this.order = initiativeOrder(this.combatants.filter((x) => x.alive));
    if (currentId) {
      const idx = this.order.findIndex((x) => x.id === currentId);
      this.turnIndex = idx >= 0 ? idx : 0;
    } else {
      this.turnIndex = 0;
    }
    this.log.push(`${c.name} joins the battle!`);
  }

  /** victory = all enemies dead; defeat = all players dead. */
  checkEnd(): BattleResult {
    const playersAlive = this.combatants.some((c) => c.team === 'player' && c.alive);
    const enemiesAlive = this.combatants.some((c) => c.team === 'enemy' && c.alive);
    if (!enemiesAlive) return 'victory';
    if (!playersAlive) return 'defeat';
    return 'ongoing';
  }

  state(): TurnState {
    const cur = this.checkEnd() === 'ongoing' ? this.order[this.turnIndex] : null;
    return {
      round: this.round,
      turnIndex: this.turnIndex,
      currentId: cur ? cur.id : null,
      result: this.checkEnd(),
    };
  }

  getCombatant(id: string): Combatant | undefined {
    return this.combatants.find((c) => c.id === id);
  }
}
