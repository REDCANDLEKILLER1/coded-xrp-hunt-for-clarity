export interface CampaignProgress {
  highScore: number;
  highestWave: number;
  victories: number;
}

export const EMPTY_PROGRESS: CampaignProgress = { highScore: 0, highestWave: 1, victories: 0 };

/** Parses untrusted local persistence without allowing malformed values into the game. */
export function parseCampaignProgress(raw: string | null): CampaignProgress {
  if (!raw) return { ...EMPTY_PROGRESS };
  try {
    const value = JSON.parse(raw) as Partial<CampaignProgress>;
    return {
      highScore: safeCount(value.highScore, 0),
      highestWave: safeCount(value.highestWave, 1),
      victories: safeCount(value.victories, 0),
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
  };
}

function safeCount(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;
}
