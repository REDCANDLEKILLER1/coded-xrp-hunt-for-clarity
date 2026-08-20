import { PLANET_BY_KEY } from './CampaignPlanets';

export type LegacyCheckpointStage = 'space' | 'guardian' | 'surface' | 'boss';

export interface MissionCheckpointSnapshot {
  planetKey: string;
  missionKey: string;
  checkpointKey: string;
  checkpointLabel: string;
  resumeActKey: string;
  shipKey: string;
  weaponTier: number;
  bombs: number;
  score: number;
  savedAt: number;
}

export interface CampaignProgress {
  highScore: number;
  highestWave: number;
  victories: number;
  currentPlanet: string;
  discoveredPlanets: string[];
  clearedPlanets: string[];
  defeatedGuardians: string[];
  defeatedSurfaceBosses: string[];
  checkpoints: Record<string, LegacyCheckpointStage>;
  missionCheckpoints: Record<string, MissionCheckpointSnapshot>;
  shipTech: string[];
  upgradePoints: number;
}

export const CAMPAIGN_PROGRESS_STORAGE_KEY = 'coded-xrp-campaign-progress-v3';
export const LEGACY_PROGRESS_STORAGE_KEY = 'coded-xrp-campaign-progress-v2';
export const LEGACY_V1_PROGRESS_STORAGE_KEY = 'coded-xrp-campaign-progress-v1';

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
  missionCheckpoints: {},
  shipTech: [],
  upgradePoints: 0,
};

/** Parses untrusted local persistence without allowing malformed values into the game. */
export function parseCampaignProgress(raw: string | null): CampaignProgress {
  if (!raw) return freshEmptyProgress();
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
      checkpoints: safeLegacyCheckpoints(value.checkpoints),
      missionCheckpoints: safeMissionCheckpoints(value.missionCheckpoints),
      shipTech: safeKeys(value.shipTech),
      upgradePoints: safeCount(value.upgradePoints, 0),
    };
  } catch {
    return freshEmptyProgress();
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
    missionCheckpoints: { ...current.missionCheckpoints },
    shipTech: [...current.shipTech],
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

/** Records a guardian win and its permanent fighter-tech reward idempotently. */
export function recordGuardianDefeated(current: CampaignProgress, planetKey: string, techKey: string): CampaignProgress {
  const safePlanet = safeKey(planetKey, '');
  const safeTech = safeKey(techKey, '');
  if (!safePlanet || !safeTech || !PLANET_BY_KEY[safePlanet]) return cloneProgress(current);
  return {
    ...current,
    defeatedGuardians: unique([...current.defeatedGuardians, safePlanet]),
    shipTech: unique([...current.shipTech, safeTech]),
  };
}

export function hasShipTech(current: CampaignProgress, techKey: string): boolean {
  const safe = safeKey(techKey, '');
  return Boolean(safe && current.shipTech.includes(safe));
}

export function recordMissionCheckpoint(
  current: CampaignProgress,
  snapshot: MissionCheckpointSnapshot,
): CampaignProgress {
  const safe = sanitizeMissionCheckpoint(snapshot);
  if (!safe) return cloneProgress(current);
  return {
    ...current,
    currentPlanet: safe.planetKey,
    discoveredPlanets: ensureFirstPlanet(unique([...current.discoveredPlanets, safe.planetKey])),
    checkpoints: { ...current.checkpoints },
    missionCheckpoints: { ...current.missionCheckpoints, [safe.planetKey]: safe },
  };
}

export function clearMissionCheckpoint(current: CampaignProgress, planetKey: string): CampaignProgress {
  const safe = safeKey(planetKey, '');
  if (!safe || !current.missionCheckpoints[safe]) return cloneProgress(current);
  const missionCheckpoints = { ...current.missionCheckpoints };
  delete missionCheckpoints[safe];
  return { ...current, missionCheckpoints };
}

export function missionCheckpointFor(current: CampaignProgress, planetKey: string): MissionCheckpointSnapshot | undefined {
  const safe = safeKey(planetKey, '');
  return safe ? current.missionCheckpoints[safe] : undefined;
}

export function recordPlanetCleared(current: CampaignProgress, planetKey: string, upgradeReward: number): CampaignProgress {
  const planet = PLANET_BY_KEY[planetKey];
  if (!planet) return cloneProgress(current);
  const missionCheckpoints = { ...current.missionCheckpoints };
  delete missionCheckpoints[planetKey];
  return {
    ...current,
    currentPlanet: planetKey,
    discoveredPlanets: unique([...current.discoveredPlanets, planetKey, ...planet.unlocks]),
    clearedPlanets: unique([...current.clearedPlanets, planetKey]),
    defeatedGuardians: unique([...current.defeatedGuardians, planetKey]),
    defeatedSurfaceBosses: unique([...current.defeatedSurfaceBosses, planetKey]),
    checkpoints: { ...current.checkpoints, [planetKey]: 'boss' },
    missionCheckpoints,
    upgradePoints: current.upgradePoints + safeCount(upgradeReward, 0),
  };
}

export function loadCampaignProgress(): CampaignProgress {
  try {
    return parseCampaignProgress(
      localStorage.getItem(CAMPAIGN_PROGRESS_STORAGE_KEY)
      ?? localStorage.getItem(LEGACY_PROGRESS_STORAGE_KEY)
      ?? localStorage.getItem(LEGACY_V1_PROGRESS_STORAGE_KEY),
    );
  } catch {
    return freshEmptyProgress();
  }
}

export function saveCampaignProgress(progress: CampaignProgress): void {
  try {
    localStorage.setItem(CAMPAIGN_PROGRESS_STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Device-local persistence is optional and must never block play.
  }
}

function freshEmptyProgress(): CampaignProgress {
  return {
    ...EMPTY_PROGRESS,
    discoveredPlanets: [...EMPTY_PROGRESS.discoveredPlanets],
    clearedPlanets: [],
    defeatedGuardians: [],
    defeatedSurfaceBosses: [],
    checkpoints: {},
    missionCheckpoints: {},
    shipTech: [],
  };
}

function cloneProgress(current: CampaignProgress): CampaignProgress {
  return {
    ...current,
    discoveredPlanets: [...current.discoveredPlanets],
    clearedPlanets: [...current.clearedPlanets],
    defeatedGuardians: [...current.defeatedGuardians],
    defeatedSurfaceBosses: [...current.defeatedSurfaceBosses],
    checkpoints: { ...current.checkpoints },
    missionCheckpoints: { ...current.missionCheckpoints },
    shipTech: [...current.shipTech],
  };
}

function sanitizeMissionCheckpoint(value: unknown): MissionCheckpointSnapshot | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const snapshot = value as Partial<MissionCheckpointSnapshot>;
  const planetKey = safeKey(snapshot.planetKey, '');
  const missionKey = safeKey(snapshot.missionKey, '');
  const checkpointKey = safeCheckpointKey(snapshot.checkpointKey);
  const checkpointLabel = safeLabel(snapshot.checkpointLabel);
  const resumeActKey = safeKey(snapshot.resumeActKey, '');
  const shipKey = safeKey(snapshot.shipKey, '');
  if (!planetKey || !missionKey || !checkpointKey || !checkpointLabel || !resumeActKey || !shipKey) return null;
  return {
    planetKey,
    missionKey,
    checkpointKey,
    checkpointLabel,
    resumeActKey,
    shipKey,
    weaponTier: clamp(safeCount(snapshot.weaponTier, 1), 1, 9),
    bombs: clamp(safeCount(snapshot.bombs, 0), 0, 9),
    score: safeCount(snapshot.score, 0),
    savedAt: safeCount(snapshot.savedAt, 0),
  };
}

function safeMissionCheckpoints(value: unknown): Record<string, MissionCheckpointSnapshot> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result: Record<string, MissionCheckpointSnapshot> = {};
  for (const item of Object.values(value)) {
    const snapshot = sanitizeMissionCheckpoint(item);
    if (snapshot) result[snapshot.planetKey] = snapshot;
  }
  return result;
}

function safeCount(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;
}

function safeKey(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^[a-z0-9_]{1,64}$/.test(value) ? value : fallback;
}

function safeCheckpointKey(value: unknown): string {
  return typeof value === 'string' && /^[a-z0-9_.-]{1,96}$/.test(value) ? value : '';
}

function safeLabel(value: unknown): string {
  return typeof value === 'string' && value.length > 0 && value.length <= 64 ? value : '';
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

function safeLegacyCheckpoints(value: unknown): Record<string, LegacyCheckpointStage> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const allowed = new Set<LegacyCheckpointStage>(['space', 'guardian', 'surface', 'boss']);
  const result: Record<string, LegacyCheckpointStage> = {};
  for (const [key, checkpoint] of Object.entries(value)) {
    if (safeKey(key, '') && typeof checkpoint === 'string' && allowed.has(checkpoint as LegacyCheckpointStage)) {
      result[key] = checkpoint as LegacyCheckpointStage;
    }
  }
  return result;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
