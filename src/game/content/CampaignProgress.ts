import { PLANET_BY_KEY } from './CampaignPlanets';

export interface CampaignProgress {
  highScore: number;
  highestWave: number;
  victories: number;
  currentPlanet: string;
  discoveredPlanets: string[];
  clearedPlanets: string[];
  defeatedGuardians: string[];
  defeatedSurfaceBosses: string[];
  checkpoints: Record<string, 'space' | 'guardian' | 'surface' | 'boss'>;
  upgradePoints: number;
}

export const CAMPAIGN_PROGRESS_STORAGE_KEY = 'coded-xrp-campaign-progress-v2';
export const LEGACY_PROGRESS_STORAGE_KEY = 'coded-xrp-campaign-progress-v1';

export const EMPTY_PROGRESS: CampaignProgress = {
  highScore: 0,
  highestWave: 1,
  victories: 0,
  currentPlanet: 'ledger_prime',
  discoveredPlanets: ['ledger_prime'],
  clearedPlanets: [],
  defeatedGuardians: [],
  defeatedSurfaceBosses: [],
  checkpoints: {},
  upgradePoints: 0,
};

/** Parses untrusted local persistence without allowing malformed values into the game. */
export function parseCampaignProgress(raw: string | null): CampaignProgress {
  if (!raw) return { ...EMPTY_PROGRESS };
  try {
    const value = JSON.parse(raw) as Partial<CampaignProgress>;
    return {
      highScore: safeCount(value.highScore, 0),
      highestWave: safeCount(value.highestWave, 1),
      victories: safeCount(value.victories, 0),
      currentPlanet: safeKey(value.currentPlanet, EMPTY_PROGRESS.currentPlanet),
      discoveredPlanets: ensureFirstPlanet(safeKeys(value.discoveredPlanets)),
      clearedPlanets: safeKeys(value.clearedPlanets),
      defeatedGuardians: safeKeys(value.defeatedGuardians),
      defeatedSurfaceBosses: safeKeys(value.defeatedSurfaceBosses),
      checkpoints: safeCheckpoints(value.checkpoints),
      upgradePoints: safeCount(value.upgradePoints, 0),
    };
  } catch {
    return { ...EMPTY_PROGRESS };
  }
}

export function recordCampaignRun(
  current: CampaignProgress,
  score: number,
  wave: number,
  victory: boolean,
): CampaignProgress {
  return {
    highScore: Math.max(current.highScore, safeCount(score, 0)),
    highestWave: Math.max(current.highestWave, safeCount(wave, 1)),
    victories: current.victories + (victory ? 1 : 0),
    currentPlanet: current.currentPlanet,
    discoveredPlanets: [...current.discoveredPlanets],
    clearedPlanets: [...current.clearedPlanets],
    defeatedGuardians: [...current.defeatedGuardians],
    defeatedSurfaceBosses: [...current.defeatedSurfaceBosses],
    checkpoints: { ...current.checkpoints },
    upgradePoints: current.upgradePoints,
  };
}

export function recordPlanetSelection(current: CampaignProgress, planetKey: string): CampaignProgress {
  const safe = safeKey(planetKey, current.currentPlanet);
  return {
    ...current,
    currentPlanet: safe,
    discoveredPlanets: current.discoveredPlanets.includes(safe)
      ? [...current.discoveredPlanets]
      : [...current.discoveredPlanets, safe],
  };
}

export function recordPlanetCleared(current: CampaignProgress, planetKey: string, upgradeReward: number): CampaignProgress {
  const planet = PLANET_BY_KEY[planetKey];
  if (!planet) return { ...current };
  return {
    ...current,
    currentPlanet: planetKey,
    discoveredPlanets: unique([...current.discoveredPlanets, planetKey, ...planet.unlocks]),
    clearedPlanets: unique([...current.clearedPlanets, planetKey]),
    defeatedGuardians: unique([...current.defeatedGuardians, planetKey]),
    defeatedSurfaceBosses: unique([...current.defeatedSurfaceBosses, planetKey]),
    checkpoints: { ...current.checkpoints, [planetKey]: 'boss' },
    upgradePoints: current.upgradePoints + safeCount(upgradeReward, 0),
  };
}

export function loadCampaignProgress(): CampaignProgress {
  try {
    return parseCampaignProgress(localStorage.getItem(CAMPAIGN_PROGRESS_STORAGE_KEY) ?? localStorage.getItem(LEGACY_PROGRESS_STORAGE_KEY));
  } catch {
    return parseCampaignProgress(null);
  }
}

export function saveCampaignProgress(progress: CampaignProgress): void {
  try {
    localStorage.setItem(CAMPAIGN_PROGRESS_STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Device-local persistence is optional and must never block play.
  }
}

function safeCount(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;
}

function safeKey(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^[a-z0-9_]{1,64}$/.test(value) ? value : fallback;
}

function safeKeys(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return unique(value.map((item) => safeKey(item, '')).filter(Boolean));
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function ensureFirstPlanet(keys: string[]): string[] {
  return keys.includes('ledger_prime') ? keys : ['ledger_prime', ...keys];
}

function safeCheckpoints(value: unknown): Record<string, 'space' | 'guardian' | 'surface' | 'boss'> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const allowed = new Set(['space', 'guardian', 'surface', 'boss']);
  const result: Record<string, 'space' | 'guardian' | 'surface' | 'boss'> = {};
  for (const [key, checkpoint] of Object.entries(value)) {
    if (safeKey(key, '') && typeof checkpoint === 'string' && allowed.has(checkpoint)) {
      result[key] = checkpoint as 'space' | 'guardian' | 'surface' | 'boss';
    }
  }
  return result;
}
