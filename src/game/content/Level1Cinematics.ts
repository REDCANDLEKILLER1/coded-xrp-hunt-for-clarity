export interface CinematicRevealTiming {
  musicLead: number;
  entranceDelay: number;
  entranceDuration: number;
  combatDelay: number;
}

/**
 * Earth Level 1 opens with the music and environment before combat. The player
 * fighter rises from below the screen, settles into position, and only then do
 * authored enemy formations begin. This is intentionally skipped for checkpoint
 * resumes so a death never forces the player through the full opening again.
 */
export const EARTH_LAUNCH_REVEAL: CinematicRevealTiming = {
  musicLead: 0,
  entranceDelay: 1.2,
  entranceDuration: 2.8,
  combatDelay: 1.4,
};

/**
 * Gary Fog receives a long music-first reveal. Boss music begins, the arena is
 * allowed to breathe for six seconds, then Gary slowly creeps into frame before
 * becoming attackable. The goal is anticipation rather than an instant pop-in.
 */
export const GARY_FOG_REVEAL: CinematicRevealTiming = {
  musicLead: 6,
  entranceDelay: 0,
  entranceDuration: 3.6,
  combatDelay: 1,
};

export function revealTotalDuration(timing: CinematicRevealTiming): number {
  return timing.musicLead + timing.entranceDelay + timing.entranceDuration + timing.combatDelay;
}

export function validateLevel1Cinematics(): string[] {
  const errors: string[] = [];
  for (const [key, timing] of Object.entries({ earthLaunch: EARTH_LAUNCH_REVEAL, garyFog: GARY_FOG_REVEAL })) {
    for (const [field, value] of Object.entries(timing)) {
      if (!(typeof value === 'number' && Number.isFinite(value) && value >= 0)) {
        errors.push(`${key}.${field}: timing must be a non-negative finite number`);
      }
    }
  }
  if (GARY_FOG_REVEAL.musicLead < 5) errors.push('garyFog.musicLead: boss music must lead the visual reveal by at least five seconds');
  if (EARTH_LAUNCH_REVEAL.entranceDuration < 2) errors.push('earthLaunch.entranceDuration: fighter entrance is too abrupt');
  return errors;
}
