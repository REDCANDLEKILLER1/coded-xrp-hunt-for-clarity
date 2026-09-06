import { CAMPAIGN_PROGRESS_STORAGE_KEY, LEGACY_PROGRESS_STORAGE_KEY, LEGACY_V1_PROGRESS_STORAGE_KEY, parseCampaignProgress, type CampaignProgress } from '../content/CampaignProgress';

export const SAVE_VERSION = 1;
export const SAVE_PREFIX = 'coded-xrp-definitive-v1';
export const WORLD_KEYS = ['ledger_prime', 'mars', 'fog_moon', 'bullion_reach', 'rugfall', 'sec_outpost', 'whale_haven', 'liquidity_depths', 'court_nexus', 'regulatory_crown', 'clarity_zero'] as const;
export type WorldKey = typeof WORLD_KEYS[number];
export type ChapterMode = 'earth' | 'boarding' | 'hub' | 'space' | 'surface';
export type SaveStorage = Pick<Storage, 'getItem' | 'setItem'>;
export type SaveResult = { ok: true; changed: boolean } | { ok: false; reason: 'duplicate' | 'condition' | 'storage' | 'conflict' | 'invalid' | 'protected' };

export interface DefinitiveSave {
  version: 1;
  revision: number;
  updatedAt: number;
  earth: CampaignProgress;
  location: { mode: ChapterMode; world: WorldKey; checkpoint: string };
  credits: number;
  quests: string[];
  visitedRooms: string[];
  clearedRooms: string[];
  recruits: string[];
  rewards: string[];
  dialogueSeen: string[];
  warshipOwned: boolean;
  fighterShipKey: string;
  fighterUpgrades: Record<string, number>;
  heroUpgrades: Record<string, number>;
  capitalUpgrades: Record<string, number>;
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const id = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,120}$/.test(value);
const count = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= 1_000_000_000;
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const ids = (value: unknown): value is string[] => Array.isArray(value) && value.length <= 4096 && value.every(id) && new Set(value).size === value.length;
const upgrades = (value: unknown): value is Record<string, number> => record(value) && Object.keys(value).length <= 64 && Object.entries(value).every(([key, rank]) => id(key) && Number.isInteger(rank) && Number(rank) >= 0 && Number(rank) <= 20);

export function newDefinitiveSave(earth = parseCampaignProgress(null)): DefinitiveSave {
  return {
    version: SAVE_VERSION, revision: 0, updatedAt: 0, earth: clone(earth),
    location: { mode: 'earth', world: 'ledger_prime', checkpoint: 'earth.launch' },
    credits: 0, quests: [], visitedRooms: [], clearedRooms: [], recruits: [], rewards: [], dialogueSeen: [],
    warshipOwned: false, fighterShipKey: earth.missionCheckpoints.ledger_prime?.shipKey ?? 'player',
    fighterUpgrades: {}, heroUpgrades: {}, capitalUpgrades: {},
  };
}

/** Reject invalid/future records rather than silently replacing a user's save. */
export function parseDefinitiveSave(raw: string): DefinitiveSave | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!record(value) || value.version !== SAVE_VERSION || !count(value.revision) || !Number.isFinite(value.updatedAt) || Number(value.updatedAt) < 0) return null;
    if (!record(value.earth) || !record(value.location)) return null;
    const place = value.location;
    if (!['earth', 'boarding', 'hub', 'space', 'surface'].includes(String(place.mode)) || !(WORLD_KEYS as readonly unknown[]).includes(place.world) || !id(place.checkpoint)) return null;
    for (const key of ['quests', 'visitedRooms', 'clearedRooms', 'recruits', 'rewards', 'dialogueSeen']) if (!ids(value[key])) return null;
    if (!count(value.credits) || typeof value.warshipOwned !== 'boolean' || !id(value.fighterShipKey)) return null;
    if (!upgrades(value.fighterUpgrades) || !upgrades(value.heroUpgrades) || !upgrades(value.capitalUpgrades)) return null;
    // Copy only declared fields: imported data cannot inject executable state.
    return {
      version: SAVE_VERSION, revision: value.revision as number, updatedAt: Number(value.updatedAt),
      earth: parseCampaignProgress(JSON.stringify(value.earth)),
      location: { mode: place.mode as ChapterMode, world: place.world as WorldKey, checkpoint: String(place.checkpoint) },
      credits: Number(value.credits), warshipOwned: value.warshipOwned, fighterShipKey: value.fighterShipKey,
      quests: [...value.quests as string[]], visitedRooms: [...value.visitedRooms as string[]], clearedRooms: [...value.clearedRooms as string[]],
      recruits: [...value.recruits as string[]], rewards: [...value.rewards as string[]], dialogueSeen: [...value.dialogueSeen as string[]],
      fighterUpgrades: { ...value.fighterUpgrades }, heroUpgrades: { ...value.heroUpgrades }, capitalUpgrades: { ...value.capitalUpgrades },
    };
  } catch { return null; }
}

export function reviewSaveSlot(params: URLSearchParams): string {
  const section = params.get('review') ?? ['flight', 'space', 'onfoot', 'boss', 'model'].find((key) => params.has(key));
  const run=params.get('run');
  return section ? `test:${id(section) ? section : 'section'}${run&&/^[a-zA-Z0-9_-]{1,32}$/.test(run)?`:${run}`:''}` : 'campaign';
}

/** One record commits rewards, purchases, checkpoints and ownership together. */
export class CampaignSave {
  readonly key: string;
  readonly testSlot: boolean;
  private state = newDefinitiveSave();
  private persisted: string | null = null;
  private protectedRecord = false;
  private listeners = new Set<(result: SaveResult) => void>();
  lastResult: SaveResult = { ok: true, changed: false };

  constructor(private readonly storage: SaveStorage | null, slot = 'campaign') {
    if (!id(slot)) throw new Error('Invalid save slot');
    this.key = `${SAVE_PREFIX}:${slot}`;
    this.testSlot = slot.startsWith('test:');
    this.reload();
  }

  get snapshot(): DefinitiveSave { return clone(this.state); }
  get persistence(): 'device' | 'session' | 'protected' { return this.protectedRecord ? 'protected' : this.storage ? 'device' : 'session'; }
  subscribe(listener: (result: SaveResult) => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }

  reload(): void {
    try {
      this.persisted = this.storage?.getItem(this.key) ?? null;
      this.protectedRecord = false;
      if (this.persisted !== null) {
        const parsed = parseDefinitiveSave(this.persisted);
        if (!parsed) { this.protectedRecord = true; this.report({ ok: false, reason: 'protected' }); return; }
        this.state = parsed;
      } else {
        // Legacy keys are read once for the campaign, never written or removed.
        const legacy = this.testSlot ? null : this.storage?.getItem(CAMPAIGN_PROGRESS_STORAGE_KEY)
          ?? this.storage?.getItem(LEGACY_PROGRESS_STORAGE_KEY) ?? this.storage?.getItem(LEGACY_V1_PROGRESS_STORAGE_KEY) ?? null;
        this.state = newDefinitiveSave(parseCampaignProgress(legacy));
      }
      this.report({ ok: true, changed: false });
    } catch { this.report({ ok: false, reason: 'storage' }); }
  }

  update(apply: (draft: DefinitiveSave) => boolean | void): SaveResult {
    if (this.protectedRecord) return this.report({ ok: false, reason: 'protected' });
    const draft = clone(this.state);
    try {
      if (apply(draft) === false) return this.report({ ok: false, reason: 'condition' });
      if (JSON.stringify(draft) === JSON.stringify(this.state)) return this.report({ ok: true, changed: false });
      draft.revision = this.state.revision + 1;
      draft.updatedAt = Date.now();
      const raw = JSON.stringify(draft);
      const checked = parseDefinitiveSave(raw);
      if (!checked) return this.report({ ok: false, reason: 'invalid' });
      if (this.storage) {
        if (this.storage.getItem(this.key) !== this.persisted) return this.report({ ok: false, reason: 'conflict' });
        this.storage.setItem(this.key, raw);
      }
      this.persisted = raw;
      this.state = checked;
      return this.report({ ok: true, changed: true });
    } catch { return this.report({ ok: false, reason: 'storage' }); }
  }

  claim(rewardId: string, apply: (draft: DefinitiveSave) => boolean | void): SaveResult {
    if (!id(rewardId)) return this.report({ ok: false, reason: 'invalid' });
    if (this.state.rewards.includes(rewardId)) return this.report({ ok: false, reason: 'duplicate' });
    return this.update((draft) => {
      if (apply(draft) === false) return false;
      draft.rewards.push(rewardId);
    });
  }

  purchase(receiptId: string, price: number, apply: (draft: DefinitiveSave) => boolean | void): SaveResult {
    if (!count(price)) return this.report({ ok: false, reason: 'invalid' });
    return this.claim(receiptId, (draft) => {
      if (draft.credits < price || apply(draft) === false) return false;
      draft.credits -= price;
    });
  }

  private report(result: SaveResult): SaveResult {
    this.lastResult = result;
    for (const listener of this.listeners) listener(result);
    return result;
  }
}
