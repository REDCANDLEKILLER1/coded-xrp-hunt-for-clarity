/**
 * Player settings for the transit level, persisted locally.
 *
 * Small on purpose: this is not a preferences system, it is the two knobs a
 * tester actually needs on a phone. Tilt sensitivity, because what feels right
 * varies more between people than any single tuning can cover, and a
 * recalibrate the player can reach without restarting the level.
 *
 * EVERY read is defensive. Storage can be absent (private browsing), it can
 * throw (a browser set to block site data), and it can contain anything at all
 * -- an older build's shape, a half-written value, or something the player
 * pasted in. A settings module that throws on load takes the whole level with
 * it, and a level that will not start is a far worse failure than a slider
 * that reverted to normal.
 */

export type TiltSensitivity = 'low' | 'normal' | 'high';

export interface TransitSettings {
  tiltSensitivity: TiltSensitivity;
}

export const DEFAULT_SETTINGS: TransitSettings = {
  tiltSensitivity: 'normal',
};

export const SETTINGS_STORAGE_KEY = 'coded-xrp-transit-settings-v1';

const SENSITIVITIES: readonly TiltSensitivity[] = ['low', 'normal', 'high'];

/**
 * Degrees of physical tilt for full deflection, per setting.
 *
 * BIGGER IS LESS SENSITIVE: the number is how far you have to lean to reach
 * full rate, so LOW asks for more wrist and HIGH asks for less. The naming is
 * the way round players expect ("high sensitivity" = twitchy) even though the
 * numbers run the other way, which is exactly the sort of inversion worth
 * saying out loud next to the table.
 *
 * NORMAL is the shipped tuning, unchanged, so a player who never opens the
 * menu flies precisely what was tested.
 */
export const TILT_SCALE_BY_SENSITIVITY: Record<TiltSensitivity, { x: number; y: number }> = {
  low: { x: 18, y: 21 },
  normal: { x: 12, y: 14 },
  high: { x: 8, y: 9.5 },
};

export function isTiltSensitivity(value: unknown): value is TiltSensitivity {
  return typeof value === 'string' && (SENSITIVITIES as readonly string[]).includes(value);
}

/** The next setting in the cycle, so one control can step through all three. */
export function nextSensitivity(current: TiltSensitivity): TiltSensitivity {
  const index = SENSITIVITIES.indexOf(current);
  return SENSITIVITIES[(index + 1) % SENSITIVITIES.length];
}

/**
 * Reads settings, falling back to the defaults for anything unrecognised.
 *
 * Never throws. Anything at all may be in storage.
 */
export function loadSettings(storage?: Pick<Storage, 'getItem'> | null): TransitSettings {
  const store = storage ?? safeStorage();
  if (!store) return { ...DEFAULT_SETTINGS };
  let raw: string | null = null;
  try {
    raw = store.getItem(SETTINGS_STORAGE_KEY);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
  if (!raw) return { ...DEFAULT_SETTINGS };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
  if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_SETTINGS };
  const candidate = (parsed as { tiltSensitivity?: unknown }).tiltSensitivity;
  return {
    tiltSensitivity: isTiltSensitivity(candidate) ? candidate : DEFAULT_SETTINGS.tiltSensitivity,
  };
}

/** Writes settings. Never throws: a failed save must not interrupt the game. */
export function saveSettings(settings: TransitSettings, storage?: Pick<Storage, 'setItem'> | null): void {
  const store = storage ?? safeStorage();
  if (!store) return;
  try {
    store.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Quota, private browsing, or blocked site data. The setting still applies
    // for this session; it simply will not survive a reload.
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    // Accessing the accessor itself throws in some privacy configurations.
    return null;
  }
}
