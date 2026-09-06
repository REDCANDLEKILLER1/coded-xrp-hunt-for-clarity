import { CampaignSave, type DefinitiveSave, type SaveResult } from './CampaignSave';

export const BOARDING_STEPS = ['hangar_safe', 'security_relay', 'rescue_junction', 'engineering_power', 'command_access', 'core_defeated', 'bridge_secured', 'departure_ready'] as const;
export type BoardingStep = typeof BOARDING_STEPS[number];
export const BOARDING_ROOMS = ['hangar', 'security', 'rescue', 'engineering', 'cache', 'command', 'core', 'bridge'] as const;
export type BoardingRoom = typeof BOARDING_ROOMS[number];
export const questFlag = (step: BoardingStep): string => `boarding.${step}`;
export const roomFlag = (room: BoardingRoom): string => `boarding.${room}`;
const add = (values: string[], value: string): void => { if (!values.includes(value)) values.push(value); };

export const BOARDING_OBJECTIVES: Record<BoardingStep, string> = {
  hangar_safe: 'Land safely. Test movement and open the bay terminal.',
  security_relay: 'Clear the security detail and disable its door relay.',
  rescue_junction: 'Open the crew route and meet Mr Zamn.',
  engineering_power: 'Clear engineering and restore power to the hangar.',
  command_access: 'Use the command terminal to open the Core chamber.',
  core_defeated: 'Break the two relays, then defeat the Ledger Defense Core.',
  bridge_secured: 'Use Ledger Shield through the exit field. Secure the bridge.',
  departure_ready: 'Check the ship terminal and prepare the captured Warship.',
};

/** Quest effects, dialogue receipts and rewards commit in one save transaction. */
export class BoardingQuest {
  constructor(readonly save: CampaignSave) {}
  get step(): BoardingStep | null { return BOARDING_STEPS.find(step => !this.has(step)) ?? null; }
  get objective(): string { return this.step ? BOARDING_OBJECTIVES[this.step] : 'Warship captured. The route ledger points to Mars.'; }
  has(step: BoardingStep): boolean { return this.save.snapshot.quests.includes(questFlag(step)); }
  isClear(room: BoardingRoom): boolean { return this.save.snapshot.clearedRooms.includes(roomFlag(room)); }
  get checkpoint(): BoardingRoom {
    const room = this.save.snapshot.location.checkpoint.replace('boarding.', '');
    return BOARDING_ROOMS.includes(room as BoardingRoom) ? room as BoardingRoom : 'hangar';
  }

  enter(room: BoardingRoom): SaveResult {
    const blocked = this.lockReason(room);
    if (blocked) return { ok: false, reason: 'condition' };
    return this.save.update(draft => {
      add(draft.visitedRooms, roomFlag(room));
      draft.location = { mode: draft.warshipOwned ? 'hub' : 'boarding', world: 'ledger_prime', checkpoint: roomFlag(room) };
    });
  }

  begin(fighterShipKey: string): SaveResult {
    return this.save.update(draft => {
      // Re-entry/reload preserves earned room checkpoints and the original fighter.
      if (draft.location.mode === 'boarding' || draft.location.mode === 'hub') return;
      if (draft.warshipOwned) { draft.location = { mode: 'hub', world: 'ledger_prime', checkpoint: 'boarding.bridge' }; return; }
      draft.fighterShipKey = fighterShipKey;
      draft.location = { mode: 'boarding', world: 'ledger_prime', checkpoint: 'boarding.hangar' };
      add(draft.visitedRooms, 'boarding.hangar');
    });
  }

  lockReason(room: BoardingRoom): string | null {
    const requirements: Partial<Record<BoardingRoom, BoardingStep>> = {
      security: 'hangar_safe', rescue: 'security_relay', engineering: 'rescue_junction',
      command: 'engineering_power', core: 'command_access', bridge: 'core_defeated', cache: 'rescue_junction',
    };
    const required = requirements[room];
    return required && !this.has(required) ? BOARDING_OBJECTIVES[required] : null;
  }

  clear(room: BoardingRoom): SaveResult {
    if (!['security', 'engineering', 'core'].includes(room) || this.lockReason(room)) return { ok: false, reason: 'condition' };
    return this.save.update(draft => { add(draft.clearedRooms, roomFlag(room)); });
  }

  complete(step: BoardingStep, dialogueId?: string): SaveResult {
    return this.save.claim(`reward.boarding.${step}`, draft => {
      const index = BOARDING_STEPS.indexOf(step);
      if (index > 0 && !draft.quests.includes(questFlag(BOARDING_STEPS[index - 1]))) return false;
      if (step === 'security_relay' && !draft.clearedRooms.includes('boarding.security')) return false;
      if (step === 'engineering_power' && !draft.clearedRooms.includes('boarding.engineering')) return false;
      if (step === 'core_defeated' && !draft.clearedRooms.includes('boarding.core')) return false;
      add(draft.quests, questFlag(step));
      if (dialogueId) add(draft.dialogueSeen, dialogueId);
      if (step === 'rescue_junction') add(draft.quests, 'crew.zamn_introduced');
      if (step === 'engineering_power') add(draft.quests, 'earth.hangar_power_restored');
      if (step === 'core_defeated') {
        draft.heroUpgrades.ledger_shield = 1;
        draft.location = { mode: 'boarding', world: 'ledger_prime', checkpoint: 'boarding.core' };
      }
      if (step === 'bridge_secured') {
        draft.warshipOwned = true;
        add(draft.recruits, 'mr_zamn'); add(draft.quests, 'earth.routes_restored');
        draft.credits += 300;
        draft.location = { mode: 'hub', world: 'ledger_prime', checkpoint: 'boarding.bridge' };
      }
    });
  }

  cache(): SaveResult {
    return this.save.claim('reward.boarding.shield_cache', draft => {
      if (!draft.heroUpgrades.ledger_shield || !draft.quests.includes('boarding.rescue_junction')) return false;
      draft.credits += 100;
      add(draft.clearedRooms, 'boarding.cache');
    });
  }

  defeatCore(): SaveResult {
    return this.save.claim('reward.boarding.core_defeated', draft => {
      if (!draft.quests.includes('boarding.command_access')) return false;
      add(draft.clearedRooms, 'boarding.core'); add(draft.quests, 'boarding.core_defeated');
      draft.heroUpgrades.ledger_shield = 1;
      draft.location = { mode: 'boarding', world: 'ledger_prime', checkpoint: 'boarding.core' };
    });
  }

  purchase(item: 'repair' | 'shield_module'): SaveResult {
    const price = item === 'repair' ? 50 : 150;
    return this.save.purchase(`purchase.bridge.${item}`, price, draft => {
      if (!draft.warshipOwned) return false;
      // Fixed first-introduction stock, claimed once; later shops have distinct IDs.
      draft.capitalUpgrades[item === 'repair' ? 'initial_repair' : 'shield_capacity'] = 1;
    });
  }

  recordDialogue(id: string): SaveResult {
    return this.save.update(draft => { add(draft.dialogueSeen, id); });
  }
}

export function boardingRetryRoom(state: DefinitiveSave): BoardingRoom {
  const saved = state.location.checkpoint.replace('boarding.', '') as BoardingRoom;
  return BOARDING_ROOMS.includes(saved) ? saved : 'hangar';
}
