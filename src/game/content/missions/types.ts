import type { EarthFlightEncounterDef } from '../EarthFlightEncounters';

export type MissionActMode = 'flight' | 'boss' | 'transition' | 'on_foot' | 'complete';

export interface MissionActDef {
  key: string;
  label: string;
  objective: string;
  mode: MissionActMode;
}

export interface MissionCheckpointDef {
  key: string;
  label: string;
  resumeActKey: string;
}

export interface MissionDef {
  key: string;
  planetKey: string;
  label: string;
  acts: MissionActDef[];
  checkpoints: MissionCheckpointDef[];
  /**
   * Phase 0B mission framework (all optional for backward compatibility).
   *
   * - encounters: per-act authored encounter defs, keyed by act key. When an
   *   act has no entry here, the Earth-authored table is consulted as a
   *   fallback so legacy content resolves unchanged.
   * - bossRefs: boss registry key per boss act, keyed by act key.
   * - musicCues: music track key per act, keyed by act key.
   * - unlocks: planet keys unlocked when this mission completes.
   *
   * Adding a new planet = writing a mission def file with these fields and
   * registering it in `missions/index.ts`. No engine changes required.
   */
  encounters?: Record<string, EarthFlightEncounterDef>;
  bossRefs?: Record<string, string>;
  musicCues?: Record<string, string>;
  unlocks?: string[];
}
